// Cloudflare Worker：在随机时刻触发 GitHub Actions workflow
// 目的：私有仓省额度（GitHub runner 不 sleep，只在真爬取时计费）+ 真随机隐蔽（落点小时级均匀分布）
//
// 机制：
//   1) Cloudflare Cron Trigger 每天触发一次本 Worker（作为“每天启动一次”的锚点）
//   2) Worker 计算一个随机延迟 RANDOM_WINDOW_SEC，写入 Durable Object 的 alarm
//   3) alarm 到点时调用 GitHub dispatch API，触发 backup.yml（workflow_dispatch）
//
// 这样 GitHub 每天只跑 1 次，时长 = 爬取本身；随机性由 Cloudflare 承担，不消耗 Actions 额度。

export default {
  async scheduled(controller, env, ctx) {
    const windowSec = Number(env.RANDOM_WINDOW_SEC || 7200); // 默认 2 小时窗口
    const delayMs = Math.floor(Math.random() * windowSec) * 1000;
    const fireAt = Date.now() + delayMs;

    const id = env.TRIGGER_DO.idFromName("xianbao-mirror");
    const stub = env.TRIGGER_DO.get(id);
    await stub.fetch("https://trigger.do/set?t=" + fireAt);

    return new Response("alarm scheduled in " + (delayMs / 1000) + "s (window=" + windowSec + "s)");
  }
};

export class TriggerDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/set") {
      const t = Number(url.searchParams.get("t"));
      await this.state.storage.setAlarm(t);
      return new Response("alarm set");
    }
    return new Response("unknown path", { status: 400 });
  }

  // alarm 到点：调用 GitHub dispatch 触发 workflow
  async alarm() {
    const resp = await fetch(
      "https://api.github.com/repos/xfxx2022/xianbao-mirror/actions/workflows/backup.yml/dispatches",
      {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + this.env.GH_TOKEN,
          "Accept": "application/vnd.github+json",
          "User-Agent": "xianbao-trigger"
        },
        body: JSON.stringify({ ref: "main" })
      }
    );
    if (!resp.ok) {
      // 抛错会让 Durable Object 自动重试（指数退避），直到成功
      throw new Error("GitHub dispatch failed: " + resp.status + " " + (await resp.text()).slice(0, 200));
    }
  }
}
