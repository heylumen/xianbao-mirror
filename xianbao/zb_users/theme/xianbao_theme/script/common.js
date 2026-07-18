//lscache
!function(a,b){"function"==typeof define&&define.amd?define([],b):"undefined"!=typeof module&&module.exports?module.exports=b():a.lscache=b()}(this,function(){function a(){var a="__lscachetest__",c=a;if(void 0!==o)return o;try{if(!localStorage)return!1}catch(a){return!1}try{h(a,c),i(a),o=!0}catch(a){o=!(!b(a)||!localStorage.length)}return o}function b(a){return a&&("QUOTA_EXCEEDED_ERR"===a.name||"NS_ERROR_DOM_QUOTA_REACHED"===a.name||"QuotaExceededError"===a.name)}function c(){return void 0===p&&(p=null!=window.JSON),p}function d(a){return a.replace(/[[\]{}()*+?.\\^$|]/g,"\\$&")}function e(a){return a+r}function f(){return Math.floor((new Date).getTime()/t)}function g(a){return localStorage.getItem(q+v+a)}function h(a,b){localStorage.removeItem(q+v+a),localStorage.setItem(q+v+a,b)}function i(a){localStorage.removeItem(q+v+a)}function j(a){var b,c,f=new RegExp("^"+q+d(v)+"(.*)"),g=[];for(c=0;c<localStorage.length;c++)b=localStorage.key(c),b=b&&b.match(f),b=b&&b[1],b&&b.indexOf(r)<0&&g.push(b);for(c=0;c<g.length;c++)a(g[c],e(g[c]))}function k(a){var b=e(a);i(a),i(b)}function l(a){var b=e(a),c=g(b);if(c){var d=parseInt(c,s);if(f()>=d)return i(a),i(b),!0}}function m(a,b){w&&"console"in window&&"function"==typeof window.console.warn&&(window.console.warn("lscache - "+a),b&&window.console.warn("lscache - The error was: "+b.message))}function n(a){return Math.floor(864e13/a)}var o,p,q="lscacfhe-",r="-cacheexpiration",s=10,t=6e4,u=n(t),v="",w=!1,x={set:function(d,l,n){if(!a())return!1;if(!c())return!1;try{l=JSON.stringify(l)}catch(a){return!1}try{h(d,l)}catch(a){if(!b(a))return m("Could not add item with key '"+d+"'",a),!1;var o,p=[];j(function(a,b){var c=g(b);c=c?parseInt(c,s):u,p.push({key:a,size:(g(a)||"").length,expiration:c})}),p.sort(function(a,b){return b.expiration-a.expiration});for(var q=(l||"").length;p.length&&q>0;)o=p.pop(),m("Cache is full, removing item with key '"+o.key+"'"),k(o.key),q-=o.size;try{h(d,l)}catch(a){return m("Could not add item with key '"+d+"', perhaps it's too big?",a),!1}}return n?h(e(d),(f()+n).toString(s)):i(e(d)),!0},get:function(b){if(!a())return null;if(l(b))return null;var d=g(b);if(!d||!c())return d;try{return JSON.parse(d)}catch(a){return d}},remove:function(b){a()&&k(b)},supported:function(){return a()},flush:function(){a()&&j(function(a){k(a)})},flushExpired:function(){a()&&j(function(a){l(a)})},setBucket:function(a){v=a},resetBucket:function(){v=""},getExpiryMilliseconds:function(){return t},setExpiryMilliseconds:function(a){t=a,u=n(t)},enableWarnings:function(a){w=a}};return x});lscache.setExpiryMilliseconds(1000);
//Push
!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{("undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof self?self:this).Push=e()}}(function(){return function e(t,n,i){function o(s,a){if(!n[s]){if(!t[s]){var u="function"==typeof require&&require;if(!a&&u)return u(s,!0);if(r)return r(s,!0);var c=new Error("Cannot find module '"+s+"'");throw c.code="MODULE_NOT_FOUND",c}var f=n[s]={exports:{}};t[s][0].call(f.exports,function(e){var n=t[s][1][e];return o(n||e)},f,f.exports,e,t,n,i)}return n[s].exports}for(var r="function"==typeof require&&require,s=0;s<i.length;s++)o(i[s]);return o}({1:[function(e,t,n){"use strict";Object.defineProperty(n,"__esModule",{value:!0});n.default={errors:{incompatible:"PushError: Push.js is incompatible with browser.",invalid_plugin:"PushError: plugin class missing from plugin manifest (invalid plugin). Please check the documentation.",invalid_title:"PushError: title of notification must be a string",permission_denied:"PushError: permission request declined",sw_notification_error:"PushError: could not show a ServiceWorker notification due to the following reason: ",sw_registration_error:"PushError: could not register the ServiceWorker due to the following reason: ",unknown_interface:"PushError: unable to create notification: unknown interface"}}},{}],2:[function(e,t,n){"use strict";function i(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}Object.defineProperty(n,"__esModule",{value:!0});var o=function(){function e(e,t){for(var n=0;n<t.length;n++){var i=t[n];i.enumerable=i.enumerable||!1,i.configurable=!0,"value"in i&&(i.writable=!0),Object.defineProperty(e,i.key,i)}}return function(t,n,i){return n&&e(t.prototype,n),i&&e(t,i),t}}(),r=function(){function e(t){i(this,e),this._win=t,this.DEFAULT="default",this.GRANTED="granted",this.DENIED="denied",this._permissions=[this.GRANTED,this.DEFAULT,this.DENIED]}return o(e,[{key:"request",value:function(e,t){var n=this,i=this.get(),o=function(i){i===n.GRANTED||0===i?e&&e():t&&t()};i!==this.DEFAULT?o(i):this._win.Notification&&this._win.Notification.requestPermission?this._win.Notification.requestPermission().then(o).catch(function(){t&&t()}):this._win.webkitNotifications&&this._win.webkitNotifications.checkPermission?this._win.webkitNotifications.requestPermission(o):e&&e()}},{key:"has",value:function(){return this.get()===this.GRANTED}},{key:"get",value:function(){return this._win.Notification&&this._win.Notification.permission?this._win.Notification.permission:this._win.webkitNotifications&&this._win.webkitNotifications.checkPermission?this._permissions[this._win.webkitNotifications.checkPermission()]:navigator.mozNotification?this.GRANTED:this._win.external&&this._win.external.msIsSiteMode?this._win.external.msIsSiteMode()?this.GRANTED:this.DEFAULT:this.GRANTED}}]),e}();n.default=r},{}],3:[function(e,t,n){"use strict";function i(e){return e&&e.__esModule?e:{default:e}}function o(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}Object.defineProperty(n,"__esModule",{value:!0});var r=function(){function e(e,t){for(var n=0;n<t.length;n++){var i=t[n];i.enumerable=i.enumerable||!1,i.configurable=!0,"value"in i&&(i.writable=!0),Object.defineProperty(e,i.key,i)}}return function(t,n,i){return n&&e(t.prototype,n),i&&e(t,i),t}}(),s=i(e("./Messages")),a=i(e("./Permission")),u=i(e("./Util")),c=i(e("./agents/DesktopAgent")),f=i(e("./agents/MobileChromeAgent")),l=i(e("./agents/MobileFirefoxAgent")),h=i(e("./agents/MSAgent")),d=i(e("./agents/WebKitAgent")),p=function(){function e(t){o(this,e),this._currentId=0,this._notifications={},this._win=t,this.Permission=new a.default(t),this._agents={desktop:new c.default(t),chrome:new f.default(t),firefox:new l.default(t),ms:new h.default(t),webkit:new d.default(t)},this._configuration={serviceWorker:"/serviceWorker.min.js",fallback:function(e){}}}return r(e,[{key:"_closeNotification",value:function(e){var t=!0,n=this._notifications[e];if(void 0!==n){if(t=this._removeNotification(e),this._agents.desktop.isSupported())this._agents.desktop.close(n);else if(this._agents.webkit.isSupported())this._agents.webkit.close(n);else{if(!this._agents.ms.isSupported())throw t=!1,new Error(s.default.errors.unknown_interface);this._agents.ms.close()}return t}return!1}},{key:"_addNotification",value:function(e){var t=this._currentId;return this._notifications[t]=e,this._currentId++,t}},{key:"_removeNotification",value:function(e){var t=!1;return this._notifications.hasOwnProperty(e)&&(delete this._notifications[e],t=!0),t}},{key:"_prepareNotification",value:function(e,t){var n=this,i=void 0;return i={get:function(){return n._notifications[e]},close:function(){n._closeNotification(e)}},t.timeout&&setTimeout(function(){i.close()},t.timeout),i}},{key:"_serviceWorkerCallback",value:function(e,t,n){var i=this,o=this._addNotification(e[e.length-1]);navigator.serviceWorker.addEventListener("message",function(e){var t=JSON.parse(e.data);"close"===t.action&&Number.isInteger(t.id)&&i._removeNotification(t.id)}),n(this._prepareNotification(o,t))}},{key:"_createCallback",value:function(e,t,n){var i=this,o=void 0,r=null;if(t=t||{},o=function(e){i._removeNotification(e),u.default.isFunction(t.onClose)&&t.onClose.call(i,r)},this._agents.desktop.isSupported())try{r=this._agents.desktop.create(e,t)}catch(o){var s=this._currentId,a=this.config().serviceWorker,c=function(e){return i._serviceWorkerCallback(e,t,n)};this._agents.chrome.isSupported()&&this._agents.chrome.create(s,e,t,a,c)}else this._agents.webkit.isSupported()?r=this._agents.webkit.create(e,t):this._agents.firefox.isSupported()?this._agents.firefox.create(e,t):this._agents.ms.isSupported()?r=this._agents.ms.create(e,t):(t.title=e,this.config().fallback(t));if(null!==r){var f=this._addNotification(r),l=this._prepareNotification(f,t);u.default.isFunction(t.onShow)&&r.addEventListener("show",t.onShow),u.default.isFunction(t.onError)&&r.addEventListener("error",t.onError),u.default.isFunction(t.onClick)&&r.addEventListener("click",t.onClick),r.addEventListener("close",function(){o(f)}),r.addEventListener("cancel",function(){o(f)}),n(l)}n(null)}},{key:"create",value:function(e,t){var n=this,i=void 0;if(!u.default.isString(e))throw new Error(s.default.errors.invalid_title);return i=this.Permission.has()?function(i,o){try{n._createCallback(e,t,i)}catch(e){o(e)}}:function(i,o){n.Permission.request(function(){try{n._createCallback(e,t,i)}catch(e){o(e)}},function(){o(s.default.errors.permission_denied)})},new Promise(i)}},{key:"count",value:function(){var e=void 0,t=0;for(e in this._notifications)this._notifications.hasOwnProperty(e)&&t++;return t}},{key:"close",value:function(e){var t=void 0;for(t in this._notifications)if(this._notifications.hasOwnProperty(t)&&this._notifications[t].tag===e)return this._closeNotification(t)}},{key:"clear",value:function(){var e=void 0,t=!0;for(e in this._notifications)this._notifications.hasOwnProperty(e)&&(t=t&&this._closeNotification(e));return t}},{key:"supported",value:function(){var e=!1;for(var t in this._agents)this._agents.hasOwnProperty(t)&&(e=e||this._agents[t].isSupported());return e}},{key:"config",value:function(e){return(void 0!==e||null!==e&&u.default.isObject(e))&&u.default.objectMerge(this._configuration,e),this._configuration}},{key:"extend",value:function(e){var t,n={}.hasOwnProperty;if(!n.call(e,"plugin"))throw new Error(s.default.errors.invalid_plugin);n.call(e,"config")&&u.default.isObject(e.config)&&null!==e.config&&this.config(e.config),t=new(0,e.plugin)(this.config());for(var i in t)n.call(t,i)&&u.default.isFunction(t[i])&&(this[i]=t[i])}}]),e}();n.default=p},{"./Messages":1,"./Permission":2,"./Util":4,"./agents/DesktopAgent":6,"./agents/MSAgent":7,"./agents/MobileChromeAgent":8,"./agents/MobileFirefoxAgent":9,"./agents/WebKitAgent":10}],4:[function(e,t,n){"use strict";function i(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}Object.defineProperty(n,"__esModule",{value:!0});var o="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},r=function(){function e(e,t){for(var n=0;n<t.length;n++){var i=t[n];i.enumerable=i.enumerable||!1,i.configurable=!0,"value"in i&&(i.writable=!0),Object.defineProperty(e,i.key,i)}}return function(t,n,i){return n&&e(t.prototype,n),i&&e(t,i),t}}(),s=function(){function e(){i(this,e)}return r(e,null,[{key:"isUndefined",value:function(e){return void 0===e}},{key:"isString",value:function(e){return"string"==typeof e}},{key:"isFunction",value:function(e){return e&&"[object Function]"==={}.toString.call(e)}},{key:"isObject",value:function(e){return"object"==(void 0===e?"undefined":o(e))}},{key:"objectMerge",value:function(e,t){for(var n in t)e.hasOwnProperty(n)&&this.isObject(e[n])&&this.isObject(t[n])?this.objectMerge(e[n],t[n]):e[n]=t[n]}}]),e}();n.default=s},{}],5:[function(e,t,n){"use strict";function i(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}Object.defineProperty(n,"__esModule",{value:!0});n.default=function e(t){i(this,e),this._win=t}},{}],6:[function(e,t,n){"use strict";function i(e){return e&&e.__esModule?e:{default:e}}function o(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}function r(e,t){if(!e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return!t||"object"!=typeof t&&"function"!=typeof t?e:t}function s(e,t){if("function"!=typeof t&&null!==t)throw new TypeError("Super expression must either be null or a function, not "+typeof t);e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,enumerable:!1,writable:!0,configurable:!0}}),t&&(Object.setPrototypeOf?Object.setPrototypeOf(e,t):e.__proto__=t)}Object.defineProperty(n,"__esModule",{value:!0});var a=function(){function e(e,t){for(var n=0;n<t.length;n++){var i=t[n];i.enumerable=i.enumerable||!1,i.configurable=!0,"value"in i&&(i.writable=!0),Object.defineProperty(e,i.key,i)}}return function(t,n,i){return n&&e(t.prototype,n),i&&e(t,i),t}}(),u=i(e("./AbstractAgent")),c=i(e("../Util")),f=function(e){function t(){return o(this,t),r(this,(t.__proto__||Object.getPrototypeOf(t)).apply(this,arguments))}return s(t,u.default),a(t,[{key:"isSupported",value:function(){return void 0!==this._win.Notification}},{key:"create",value:function(e,t){return new this._win.Notification(e,{icon:c.default.isString(t.icon)||c.default.isUndefined(t.icon)?t.icon:t.icon.x32,body:t.body,tag:t.tag,requireInteraction:t.requireInteraction})}},{key:"close",value:function(e){e.close()}}]),t}();n.default=f},{"../Util":4,"./AbstractAgent":5}],7:[function(e,t,n){"use strict";function i(e){return e&&e.__esModule?e:{default:e}}function o(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}function r(e,t){if(!e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return!t||"object"!=typeof t&&"function"!=typeof t?e:t}function s(e,t){if("function"!=typeof t&&null!==t)throw new TypeError("Super expression must either be null or a function, not "+typeof t);e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,enumerable:!1,writable:!0,configurable:!0}}),t&&(Object.setPrototypeOf?Object.setPrototypeOf(e,t):e.__proto__=t)}Object.defineProperty(n,"__esModule",{value:!0});var a=function(){function e(e,t){for(var n=0;n<t.length;n++){var i=t[n];i.enumerable=i.enumerable||!1,i.configurable=!0,"value"in i&&(i.writable=!0),Object.defineProperty(e,i.key,i)}}return function(t,n,i){return n&&e(t.prototype,n),i&&e(t,i),t}}(),u=i(e("./AbstractAgent")),c=i(e("../Util")),f=function(e){function t(){return o(this,t),r(this,(t.__proto__||Object.getPrototypeOf(t)).apply(this,arguments))}return s(t,u.default),a(t,[{key:"isSupported",value:function(){return void 0!==this._win.external&&void 0!==this._win.external.msIsSiteMode}},{key:"create",value:function(e,t){return this._win.external.msSiteModeClearIconOverlay(),this._win.external.msSiteModeSetIconOverlay(c.default.isString(t.icon)||c.default.isUndefined(t.icon)?t.icon:t.icon.x16,e),this._win.external.msSiteModeActivate(),null}},{key:"close",value:function(){this._win.external.msSiteModeClearIconOverlay()}}]),t}();n.default=f},{"../Util":4,"./AbstractAgent":5}],8:[function(e,t,n){"use strict";function i(e){return e&&e.__esModule?e:{default:e}}function o(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}function r(e,t){if(!e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return!t||"object"!=typeof t&&"function"!=typeof t?e:t}function s(e,t){if("function"!=typeof t&&null!==t)throw new TypeError("Super expression must either be null or a function, not "+typeof t);e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,enumerable:!1,writable:!0,configurable:!0}}),t&&(Object.setPrototypeOf?Object.setPrototypeOf(e,t):e.__proto__=t)}Object.defineProperty(n,"__esModule",{value:!0});var a=function(){function e(e,t){for(var n=0;n<t.length;n++){var i=t[n];i.enumerable=i.enumerable||!1,i.configurable=!0,"value"in i&&(i.writable=!0),Object.defineProperty(e,i.key,i)}}return function(t,n,i){return n&&e(t.prototype,n),i&&e(t,i),t}}(),u=i(e("./AbstractAgent")),c=i(e("../Util")),f=i(e("../Messages")),l=function(e){function t(){return o(this,t),r(this,(t.__proto__||Object.getPrototypeOf(t)).apply(this,arguments))}return s(t,u.default),a(t,[{key:"isSupported",value:function(){return void 0!==this._win.navigator&&void 0!==this._win.navigator.serviceWorker}},{key:"getFunctionBody",value:function(e){return e.toString().match(/function[^{]+{([\s\S]*)}$/)[1]}},{key:"create",value:function(e,t,n,i,o){var r=this;this._win.navigator.serviceWorker.register(i),this._win.navigator.serviceWorker.ready.then(function(i){var s={id:e,link:n.link,origin:document.location.href,onClick:c.default.isFunction(n.onClick)?r.getFunctionBody(n.onClick):"",onClose:c.default.isFunction(n.onClose)?r.getFunctionBody(n.onClose):""};void 0!==n.data&&null!==n.data&&(s=Object.assign(s,n.data)),i.showNotification(t,{icon:n.icon,body:n.body,vibrate:n.vibrate,tag:n.tag,data:s,requireInteraction:n.requireInteraction,silent:n.silent}).then(function(){i.getNotifications().then(function(e){i.active.postMessage(""),o(e)})}).catch(function(e){throw new Error(f.default.errors.sw_notification_error+e.message)})}).catch(function(e){throw new Error(f.default.errors.sw_registration_error+e.message)})}},{key:"close",value:function(){}}]),t}();n.default=l},{"../Messages":1,"../Util":4,"./AbstractAgent":5}],9:[function(e,t,n){"use strict";function i(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}function o(e,t){if(!e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return!t||"object"!=typeof t&&"function"!=typeof t?e:t}function r(e,t){if("function"!=typeof t&&null!==t)throw new TypeError("Super expression must either be null or a function, not "+typeof t);e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,enumerable:!1,writable:!0,configurable:!0}}),t&&(Object.setPrototypeOf?Object.setPrototypeOf(e,t):e.__proto__=t)}Object.defineProperty(n,"__esModule",{value:!0});var s=function(){function e(e,t){for(var n=0;n<t.length;n++){var i=t[n];i.enumerable=i.enumerable||!1,i.configurable=!0,"value"in i&&(i.writable=!0),Object.defineProperty(e,i.key,i)}}return function(t,n,i){return n&&e(t.prototype,n),i&&e(t,i),t}}(),a=function(e){return e&&e.__esModule?e:{default:e}}(e("./AbstractAgent")),u=function(e){function t(){return i(this,t),o(this,(t.__proto__||Object.getPrototypeOf(t)).apply(this,arguments))}return r(t,a.default),s(t,[{key:"isSupported",value:function(){return void 0!==this._win.navigator.mozNotification}},{key:"create",value:function(e,t){var n=this._win.navigator.mozNotification.createNotification(e,t.body,t.icon);return n.show(),n}}]),t}();n.default=u},{"./AbstractAgent":5}],10:[function(e,t,n){"use strict";function i(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}function o(e,t){if(!e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return!t||"object"!=typeof t&&"function"!=typeof t?e:t}function r(e,t){if("function"!=typeof t&&null!==t)throw new TypeError("Super expression must either be null or a function, not "+typeof t);e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,enumerable:!1,writable:!0,configurable:!0}}),t&&(Object.setPrototypeOf?Object.setPrototypeOf(e,t):e.__proto__=t)}Object.defineProperty(n,"__esModule",{value:!0});var s=function(){function e(e,t){for(var n=0;n<t.length;n++){var i=t[n];i.enumerable=i.enumerable||!1,i.configurable=!0,"value"in i&&(i.writable=!0),Object.defineProperty(e,i.key,i)}}return function(t,n,i){return n&&e(t.prototype,n),i&&e(t,i),t}}(),a=function(e){return e&&e.__esModule?e:{default:e}}(e("./AbstractAgent")),u=function(e){function t(){return i(this,t),o(this,(t.__proto__||Object.getPrototypeOf(t)).apply(this,arguments))}return r(t,a.default),s(t,[{key:"isSupported",value:function(){return void 0!==this._win.webkitNotifications}},{key:"create",value:function(e,t){var n=this._win.webkitNotifications.createNotification(t.icon,e,t.body);return n.show(),n}},{key:"close",value:function(e){e.cancel()}}]),t}();n.default=u},{"./AbstractAgent":5}],11:[function(e,t,n){"use strict";var i=function(e){return e&&e.__esModule?e:{default:e}}(e("./classes/Push"));t.exports=new i.default("undefined"!=typeof window?window:void 0)},{"./classes/Push":3}]},{},[11])(11)});
(function(global,factory){typeof exports==='object'&&typeof module!=='undefined'?module.exports=factory():typeof define==='function'&&define.amd?define(factory):(global=global||self,global.PullToRefresh=factory())}(this,function(){'use strict';var _shared={pullStartY:null,pullMoveY:null,handlers:[],styleEl:null,events:null,dist:0,state:'pending',timeout:null,distResisted:0,supportsPassive:false,supportsPointerEvents:typeof window!=='undefined'&&!!window.PointerEvent};try{window.addEventListener('test',null,{get passive(){_shared.supportsPassive=true}})}catch(e){}function setupDOM(handler){if(!handler.ptrElement){var ptr=document.createElement('div');if(handler.mainElement!==document.body){handler.mainElement.parentNode.insertBefore(ptr,handler.mainElement)}else{document.body.insertBefore(ptr,document.body.firstChild)}ptr.classList.add(((handler.classPrefix)+"ptr"));ptr.innerHTML=handler.getMarkup().replace(/__PREFIX__/g,handler.classPrefix);handler.ptrElement=ptr;if(typeof handler.onInit==='function'){handler.onInit(handler)}if(!_shared.styleEl){_shared.styleEl=document.createElement('style');_shared.styleEl.setAttribute('id','pull-to-refresh-js-style');document.head.appendChild(_shared.styleEl)}_shared.styleEl.textContent=handler.getStyles().replace(/__PREFIX__/g,handler.classPrefix).replace(/\s+/g,' ')}return handler}function onReset(handler){if(!handler.ptrElement){return}handler.ptrElement.classList.remove(((handler.classPrefix)+"refresh"));handler.ptrElement.style[handler.cssProp]='0px';setTimeout(function(){if(handler.ptrElement&&handler.ptrElement.parentNode){handler.ptrElement.parentNode.removeChild(handler.ptrElement);handler.ptrElement=null}_shared.state='pending'},handler.refreshTimeout)}function update(handler){var iconEl=handler.ptrElement.querySelector(("."+(handler.classPrefix)+"icon"));var textEl=handler.ptrElement.querySelector(("."+(handler.classPrefix)+"text"));if(iconEl){if(_shared.state==='refreshing'){iconEl.innerHTML=handler.iconRefreshing}else{iconEl.innerHTML=handler.iconArrow}}if(textEl){if(_shared.state==='releasing'){textEl.innerHTML=handler.instructionsReleaseToRefresh}if(_shared.state==='pulling'||_shared.state==='pending'){textEl.innerHTML=handler.instructionsPullToRefresh}if(_shared.state==='refreshing'){textEl.innerHTML=handler.instructionsRefreshing}}}var _ptr={setupDOM:setupDOM,onReset:onReset,update:update};var _timeout;var screenY=function screenY(event){if(_shared.pointerEventsEnabled&&_shared.supportsPointerEvents){return event.screenY}return event.touches[0].screenY};var _setupEvents=(function(){var _el;function _onTouchStart(e){var target=_shared.handlers.filter(function(h){return h.contains(e.target)})[0];_shared.enable=!!target;if(target&&_shared.state==='pending'){_el=_ptr.setupDOM(target);if(target.shouldPullToRefresh()){_shared.pullStartY=screenY(e)}clearTimeout(_shared.timeout);_ptr.update(target)}}function _onTouchMove(e){if(!(_el&&_el.ptrElement&&_shared.enable)){return}if(!_shared.pullStartY){if(_el.shouldPullToRefresh()){_shared.pullStartY=screenY(e)}}else{_shared.pullMoveY=screenY(e)}if(_shared.state==='refreshing'){if(e.cancelable&&_el.shouldPullToRefresh()&&_shared.pullStartY<_shared.pullMoveY){e.preventDefault()}return}if(_shared.state==='pending'){_el.ptrElement.classList.add(((_el.classPrefix)+"pull"));_shared.state='pulling';_ptr.update(_el)}if(_shared.pullStartY&&_shared.pullMoveY){_shared.dist=_shared.pullMoveY-_shared.pullStartY}_shared.distExtra=_shared.dist-_el.distIgnore;if(_shared.distExtra>0){if(e.cancelable){e.preventDefault()}_el.ptrElement.style[_el.cssProp]=(_shared.distResisted)+"px";_shared.distResisted=_el.resistanceFunction(_shared.distExtra/_el.distThreshold)*Math.min(_el.distMax,_shared.distExtra);if(_shared.state==='pulling'&&_shared.distResisted>_el.distThreshold){_el.ptrElement.classList.add(((_el.classPrefix)+"release"));_shared.state='releasing';_ptr.update(_el)}if(_shared.state==='releasing'&&_shared.distResisted<_el.distThreshold){_el.ptrElement.classList.remove(((_el.classPrefix)+"release"));_shared.state='pulling';_ptr.update(_el)}}}function _onTouchEnd(){if(!(_el&&_el.ptrElement&&_shared.enable)){return}clearTimeout(_timeout);_timeout=setTimeout(function(){if(_el&&_el.ptrElement&&_shared.state==='pending'){_ptr.onReset(_el)}},500);if(_shared.state==='releasing'&&_shared.distResisted>_el.distThreshold){_shared.state='refreshing';_el.ptrElement.style[_el.cssProp]=(_el.distReload)+"px";_el.ptrElement.classList.add(((_el.classPrefix)+"refresh"));_shared.timeout=setTimeout(function(){var retval=_el.onRefresh(function(){return _ptr.onReset(_el)});if(retval&&typeof retval.then==='function'){retval.then(function(){return _ptr.onReset(_el)})}if(!retval&&!_el.onRefresh.length){_ptr.onReset(_el)}},_el.refreshTimeout)}else{if(_shared.state==='refreshing'){return}_el.ptrElement.style[_el.cssProp]='0px';_shared.state='pending'}_ptr.update(_el);_el.ptrElement.classList.remove(((_el.classPrefix)+"release"));_el.ptrElement.classList.remove(((_el.classPrefix)+"pull"));_shared.pullStartY=_shared.pullMoveY=null;_shared.dist=_shared.distResisted=0}function _onScroll(){if(_el){_el.mainElement.classList.toggle(((_el.classPrefix)+"top"),_el.shouldPullToRefresh())}}var _passiveSettings=_shared.supportsPassive?{passive:_shared.passive||false}:undefined;if(_shared.pointerEventsEnabled&&_shared.supportsPointerEvents){window.addEventListener('pointerup',_onTouchEnd);window.addEventListener('pointerdown',_onTouchStart);window.addEventListener('pointermove',_onTouchMove,_passiveSettings)}else{window.addEventListener('touchend',_onTouchEnd);window.addEventListener('touchstart',_onTouchStart);window.addEventListener('touchmove',_onTouchMove,_passiveSettings)}window.addEventListener('scroll',_onScroll);return{onTouchEnd:_onTouchEnd,onTouchStart:_onTouchStart,onTouchMove:_onTouchMove,onScroll:_onScroll,destroy:function destroy(){if(_shared.pointerEventsEnabled&&_shared.supportsPointerEvents){window.removeEventListener('pointerdown',_onTouchStart);window.removeEventListener('pointerup',_onTouchEnd);window.removeEventListener('pointermove',_onTouchMove,_passiveSettings)}else{window.removeEventListener('touchstart',_onTouchStart);window.removeEventListener('touchend',_onTouchEnd);window.removeEventListener('touchmove',_onTouchMove,_passiveSettings)}window.removeEventListener('scroll',_onScroll)}}});var _ptrMarkup="\n<div class=\"__PREFIX__box\">\n  <div class=\"__PREFIX__content\">\n    <div class=\"__PREFIX__icon\"></div>\n    <div class=\"__PREFIX__text\"></div>\n  </div>\n</div>\n";var _ptrStyles="\n.__PREFIX__ptr {\n  box-shadow: inset 0 -3px 5px rgba(0, 0, 0, 0.12);\n  pointer-events: none;\n  font-size: 0.85em;\n  font-weight: bold;\n  top: 0;\n  height: 0;\n  transition: height 0.3s, min-height 0.3s;\n  text-align: center;\n  width: 100%;\n  overflow: hidden;\n  display: flex;\n  align-items: flex-end;\n  align-content: stretch;\n}\n\n.__PREFIX__box {\n  padding: 10px;\n  flex-basis: 100%;\n}\n\n.__PREFIX__pull {\n  transition: none;\n}\n\n.__PREFIX__text {\n  margin-top: .33em;\n  color: rgba(0, 0, 0, 0.3);\n}\n\n.__PREFIX__icon {\n  color: rgba(0, 0, 0, 0.3);\n  transition: transform .3s;\n}\n\n/*\nWhen at the top of the page, disable vertical overscroll so passive touch\nlisteners can take over.\n*/\n.__PREFIX__top {\n  touch-action: pan-x pan-down pinch-zoom;\n}\n\n.__PREFIX__release .__PREFIX__icon {\n  transform: rotate(180deg);\n}\n";var _defaults={distThreshold:60,distMax:80,distReload:50,distIgnore:0,mainElement:'body',triggerElement:'body',ptrElement:'.ptr',classPrefix:'ptr--',cssProp:'min-height',iconArrow:'&#8675;',iconRefreshing:'&hellip;',instructionsPullToRefresh:'Pull down to refresh',instructionsReleaseToRefresh:'Release to refresh',instructionsRefreshing:'Refreshing',refreshTimeout:500,getMarkup:function(){return _ptrMarkup},getStyles:function(){return _ptrStyles},onInit:function(){},onRefresh:function(){return location.reload()},resistanceFunction:function(t){return Math.min(1,t/2.5)},shouldPullToRefresh:function(){return!window.scrollY}};var _methods=['mainElement','ptrElement','triggerElement'];var _setupHandler=(function(options){var _handler={};Object.keys(_defaults).forEach(function(key){_handler[key]=options[key]||_defaults[key]});_handler.refreshTimeout=typeof options.refreshTimeout==='number'?options.refreshTimeout:_defaults.refreshTimeout;_methods.forEach(function(method){if(typeof _handler[method]==='string'){_handler[method]=document.querySelector(_handler[method])}});if(!_shared.events){_shared.events=_setupEvents()}_handler.contains=function(target){return _handler.triggerElement.contains(target)};_handler.destroy=function(){clearTimeout(_shared.timeout);var offset=_shared.handlers.indexOf(_handler);_shared.handlers.splice(offset,1)};return _handler});var index={setPassiveMode:function setPassiveMode(isPassive){_shared.passive=isPassive},setPointerEventsMode:function setPointerEventsMode(isEnabled){_shared.pointerEventsEnabled=isEnabled},destroyAll:function destroyAll(){if(_shared.events){_shared.events.destroy();_shared.events=null}_shared.handlers.forEach(function(h){h.destroy()})},init:function init(options){if(options===void 0)options={};var handler=_setupHandler(options);_shared.handlers.push(handler);return handler},_:{setupHandler:_setupHandler,setupEvents:_setupEvents,setupDOM:_ptr.setupDOM,onReset:_ptr.onReset,update:_ptr.update}};return index}));
/*Pull down refresh*/
!function(t,e){"object"==typeof exports&&"undefined"!=typeof module?module.exports=e():"function"==typeof define&&define.amd?define(e):(t="undefined"!=typeof globalThis?globalThis:t||self).InfiniteAjaxScroll=e()}(this,(function(){"use strict";function t(t){return"object"==typeof window.Node?t instanceof window.Node:null!==t&&"object"==typeof t&&"number"==typeof t.nodeType&&"string"==typeof t.nodeName}function e(e,n){if(void 0===n&&(n=document),e instanceof Array)return e.filter(t);if(t(e))return[e];if(o=Object.prototype.toString.call(i=e),"object"==typeof window.NodeList?i instanceof window.NodeList:null!==i&&"object"==typeof i&&"number"==typeof i.length&&/^\[object (HTMLCollection|NodeList|Object)\]$/.test(o)&&(0===i.length||t(i[0])))return Array.prototype.slice.call(e);var i,o;if("string"==typeof e)try{var r=n.querySelectorAll(e);return Array.prototype.slice.call(r)}catch(t){return[]}return[]}var n=Object.prototype.hasOwnProperty,i=Object.prototype.toString,o=Object.defineProperty,r=Object.getOwnPropertyDescriptor,s=function(t){return"function"==typeof Array.isArray?Array.isArray(t):"[object Array]"===i.call(t)},l=function(t){if(!t||"[object Object]"!==i.call(t))return!1;var e,o=n.call(t,"constructor"),r=t.constructor&&t.constructor.prototype&&n.call(t.constructor.prototype,"isPrototypeOf");if(t.constructor&&!o&&!r)return!1;for(e in t);return void 0===e||n.call(t,e)},a=function(t,e){o&&"__proto__"===e.name?o(t,e.name,{enumerable:!0,configurable:!0,value:e.newValue,writable:!0}):t[e.name]=e.newValue},h=function(t,e){if("__proto__"===e){if(!n.call(t,e))return;if(r)return r(t,e).value}return t[e]},c=function t(){var e,n,i,o,r,c,u=arguments,d=arguments[0],p=1,f=arguments.length,m=!1;for("boolean"==typeof d&&(m=d,d=arguments[1]||{},p=2),(null==d||"object"!=typeof d&&"function"!=typeof d)&&(d={});f>p;++p)if(null!=(e=u[p]))for(n in e)i=h(d,n),d!==(o=h(e,n))&&(m&&o&&(l(o)||(r=s(o)))?(r?(r=!1,c=i&&s(i)?i:[]):c=i&&l(i)?i:{},a(d,{name:n,newValue:t(m,c,o)})):void 0!==o&&a(d,{name:n,newValue:o}));return d},u="undefined"!=typeof globalThis?globalThis:"undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof self?self:{},d="Expected a function",p=/^\s+|\s+$/g,f=/^[-+]0x[0-9a-f]+$/i,m=/^0b[01]+$/i,y=/^0o[0-7]+$/i,g=parseInt,v="object"==typeof self&&self&&self.Object===Object&&self,b="object"==typeof u&&u&&u.Object===Object&&u||v||Function("return this")(),w=Object.prototype.toString,x=Math.max,O=Math.min,E=function(){return b.Date.now()};function S(t,e,n){var i,o,r,s,l,a,h=0,c=!1,u=!1,p=!0;if("function"!=typeof t)throw new TypeError(d);function f(e){var n=i,r=o;return i=o=void 0,h=e,s=t.apply(r,n)}function m(t){return h=t,l=setTimeout(g,e),c?f(t):s}function y(t){var n=t-a;return void 0===a||n>=e||0>n||u&&t-h>=r}function g(){var t=E();if(y(t))return v(t);l=setTimeout(g,function(t){var n=e-(t-a);return u?O(n,r-(t-h)):n}(t))}function v(t){return l=void 0,p&&i?f(t):(i=o=void 0,s)}function b(){var t=E(),n=y(t);if(i=arguments,o=this,a=t,n){if(void 0===l)return m(a);if(u)return l=setTimeout(g,e),f(a)}return void 0===l&&(l=setTimeout(g,e)),s}return e=j(e)||0,T(n)&&(c=!!n.leading,r=(u="maxWait"in n)?x(j(n.maxWait)||0,e):r,p="trailing"in n?!!n.trailing:p),b.cancel=function(){void 0!==l&&clearTimeout(l),h=0,i=a=o=l=void 0},b.flush=function(){return void 0===l?s:v(E())},b}function T(t){var e=typeof t;return!!t&&("object"==e||"function"==e)}function j(t){if("number"==typeof t)return t;if(function(t){return"symbol"==typeof t||function(t){return!!t&&"object"==typeof t}(t)&&"[object Symbol]"==w.call(t)}(t))return NaN;if(T(t)){var e="function"==typeof t.valueOf?t.valueOf():t;t=T(e)?e+"":e}if("string"!=typeof t)return 0===t?t:+t;t=t.replace(p,"");var n=m.test(t);return n||y.test(t)?g(t.slice(2),n?2:8):f.test(t)?NaN:+t}var L=function(t,e,n){var i=!0,o=!0;if("function"!=typeof t)throw new TypeError(d);return T(n)&&(i="leading"in n?!!n.leading:i,o="trailing"in n?!!n.trailing:o),S(t,e,{leading:i,maxWait:e,trailing:o})},I={item:void 0,next:void 0,pagination:void 0,responseType:"document",bind:!0,scrollContainer:window,spinner:!1,logger:!0,loadOnScroll:!0,negativeMargin:0,trigger:!1,prefill:!0},C=function(t,n){var i=e(t);if(i.length>1)throw Error('Expected single element for "'+n+'"');if(0===i.length)throw Error('Element "'+t+'" not found for "'+n+'"')},_=function(t,n){if(0===e(t).length)throw Error('Element "'+t+'" not found for "'+n+'"')},H=function(t){for(var e=[],n=arguments.length-1;n-- >0;)e[n]=arguments[n+1];try{t.apply(void 0,e)}catch(t){console&&console.warn&&console.warn(t.message)}};function N(t){if(t!==window)return{x:t.scrollLeft,y:t.scrollTop};var e=void 0!==window.pageXOffset,n="CSS1Compat"===(document.compatMode||"");return{x:e?window.pageXOffset:n?document.documentElement.scrollLeft:document.body.scrollLeft,y:e?window.pageYOffset:n?document.documentElement.scrollTop:document.body.scrollTop}}function M(t){var e;if(t!==window)e=t.getBoundingClientRect();else{var n=document.documentElement,i=document.body;e={top:0,left:0,right:n.clientWidth||i.clientWidth,width:n.clientWidth||i.clientWidth,bottom:n.clientHeight||i.clientHeight,height:n.clientHeight||i.clientHeight}}return e}var P="append",F="appended",R="binded",D="unbinded",k="hit",A="load",B="loaded",W="error",z="last",X="next",q="nexted",$="ready",V="scrolled",Y="resized",G="page",U="prefill",J="prefilled",K={y:0,x:0,deltaY:0,deltaX:0};function Q(t,e){var n=N(t);return n.deltaY=n.y-(e?e.y:n.y),n.deltaX=n.x-(e?e.x:n.x),n}function Z(){var t=this,e=t._lastScroll=Q(t.scrollContainer,t._lastScroll||K);this.emitter.emit(V,{scroll:e})}function tt(){var t=this,e=t._lastScroll=Q(t.scrollContainer,t._lastScroll||K);this.emitter.emit(Y,{scroll:e})}function et(){}et.prototype={on:function(t,e,n){var i=this.e||(this.e={});return(i[t]||(i[t]=[])).push({fn:e,ctx:n}),this},once:function(t,e,n){var i=this;function o(){i.off(t,o),e.apply(n,arguments)}return o._=e,this.on(t,o,n)},emit:function(t){for(var e=[].slice.call(arguments,1),n=((this.e||(this.e={}))[t]||[]).slice(),i=0,o=n.length;o>i;i++)n[i].fn.apply(n[i].ctx,e);return this},off:function(t,e){var n=this.e||(this.e={}),i=n[t],o=[];if(i&&e)for(var r=0,s=i.length;s>r;r++)i[r].fn!==e&&i[r].fn._!==e&&o.push(i[r]);return o.length?n[t]=o:delete n[t],this}};var nt=et;function it(t){var n=this,i=n._lastResponse||document,o=e(n.options.next,i)[0];if(o)return n.load(o.href).then((function(o){i=n._lastResponse=o.xhr.response;var r=e(n.options.next,i)[0];return n.append(o.items).then((function(){return!!r})).then((function(e){return!e&&1>=t&&console&&console.warn&&console.warn('Element "'+n.options.next+'" not found for "options.next" on "'+o.url+'"'),e}))}));H(C,n.options.next,"options.next")}nt.TinyEmitter=et;var ot={element:void 0,hide:!1};var rt=function(t,e){this.options=c({},ot,function(t){return"string"==typeof t||"object"==typeof t&&t.nodeType===Node.ELEMENT_NODE?t={element:t,hide:!0}:"boolean"==typeof t&&(t={element:void 0,hide:t}),t}(e)),this.originalDisplayStyles=new WeakMap,this.options.hide&&(H(_,this.options.element,"pagination.element"),t.on(R,this.hide.bind(this)),t.on(D,this.restore.bind(this)))};rt.prototype.hide=function(){var t=this;e(this.options.element).forEach((function(e){t.originalDisplayStyles.set(e,window.getComputedStyle(e).display),e.style.display="none"}))},rt.prototype.restore=function(){var t=this;e(this.options.element).forEach((function(e){e.style.display=t.originalDisplayStyles.get(e)||"block"}))};var st={element:void 0,delay:600,show:function(t){t.style.opacity="1"},hide:function(t){t.style.opacity="0"}};var lt=function(t,n){!1!==n&&(this.ias=t,this.options=c({},st,function(t){return("string"==typeof t||"object"==typeof t&&t.nodeType===Node.ELEMENT_NODE)&&(t={element:t}),t}(n)),void 0!==this.options.element&&C(this.options.element,"spinner.element"),this.element=e(this.options.element)[0],this.hideFn=this.options.hide,this.showFn=this.options.show,t.on(R,this.bind.bind(this)),t.on(R,this.hide.bind(this)))};lt.prototype.bind=function(){var t,e,n=this,i=this.ias;i.on(X,(function(){t=+new Date,n.show()})),i.on(z,(function(){n.hide()})),i.on(P,(function(i){e=Math.max(0,n.options.delay-(+new Date-t));var o=i.appendFn.bind({});i.appendFn=function(t,i,r){return new Promise((function(s){setTimeout((function(){n.hide().then((function(){o(t,i,r),s()}))}),e)}))}}))},lt.prototype.show=function(){return Promise.resolve(this.showFn(this.element))},lt.prototype.hide=function(){return Promise.resolve(this.hideFn(this.element))};var at={hit:function(){console.log("Hit scroll threshold")},binded:function(){console.log("Binded event handlers")},unbinded:function(){console.log("Unbinded event handlers")},next:function(t){console.log("Next page triggered [pageIndex="+t.pageIndex+"]")},nexted:function(t){console.log("Next page completed [pageIndex="+t.pageIndex+"]")},load:function(t){console.log("Start loading "+t.url)},loaded:function(){console.log("Finished loading")},append:function(){console.log("Start appending items")},appended:function(t){console.log("Finished appending "+t.items.length+" item(s)")},last:function(){console.log("No more pages left to load")},page:function(t){console.log("Page changed [pageIndex="+t.pageIndex+"]")},prefill:function(t){console.log("Start prefilling")},prefilled:function(t){console.log("Finished prefilling")}};var ht=function(t,e){if(!1!==e){var n=function(t){return!0===t&&(t=at),t}(e);Object.keys(n).forEach((function(e){t.on(e,n[e])}))}};var ct=function(t){this.ias=t,this.pageBreaks=[],this.currentPageIndex=t.pageIndex,this.currentScrollTop=0,t.on(R,this.binded.bind(this)),t.on(X,this.next.bind(this)),t.on(V,this.scrolled.bind(this)),t.on(Y,this.scrolled.bind(this))};ct.prototype.binded=function(){this.ias.sentinel()&&this.pageBreaks.push({pageIndex:this.currentPageIndex,url:""+document.location,title:document.title,sentinel:this.ias.sentinel()})},ct.prototype.next=function(){var t=this,e=""+document.location,n=document.title,i=function(t){e=t.url,t.xhr.response&&(n=t.xhr.response.title)};this.ias.once(B,i),this.ias.once(q,(function(o){t.pageBreaks.push({pageIndex:o.pageIndex,url:e,title:n,sentinel:t.ias.sentinel()}),t.update(),t.ias.off(B,i)}))},ct.prototype.scrolled=function(t){this.update(t.scroll.y)},ct.prototype.update=function(t){this.currentScrollTop=t||this.currentScrollTop;var e=function(t,e,n){for(var i=e+M(n).height,o=t.length-1;o>=0;o--)if(i>t[o].sentinel.getBoundingClientRect().bottom+e)return t[Math.min(o+1,t.length-1)];return t[0]}(this.pageBreaks,this.currentScrollTop,this.ias.scrollContainer);e&&e.pageIndex!==this.currentPageIndex&&(this.ias.emitter.emit(G,e),this.currentPageIndex=e.pageIndex)};var ut={element:void 0,when:function(t){return!0},show:function(t){t.style.opacity="1"},hide:function(t){t.style.opacity="0"}};var dt=function(t,n){var i=this;!1!==n&&(this.ias=t,this.options=c({},ut,function(t){if(("string"==typeof t||"function"==typeof t||"object"==typeof t&&t.nodeType===Node.ELEMENT_NODE)&&(t={element:t}),"function"==typeof t.element&&(t.element=t.element()),t.when&&Array.isArray(t.when)){var e=t.when;t.when=function(t){return-1!==e.indexOf(t)}}return t}(n)),void 0!==this.options.element&&C(this.options.element,"trigger.element"),this.element=e(this.options.element)[0],this.hideFn=this.options.hide,this.showFn=this.options.show,this.voter=this.options.when,this.showing=void 0,this.enabled=void 0,t.on(R,this.bind.bind(this)),t.on(D,this.unbind.bind(this)),t.on(k,this.hit.bind(this)),t.on(X,(function(t){return i.ias.once(F,(function(){return i.update(t.pageIndex)}))})))};function pt(t,e,n){var i=n?n.nextSibling:null,o=document.createDocumentFragment();t.forEach((function(t){o.appendChild(t)})),e.insertBefore(o,i)}dt.prototype.bind=function(){this.hide(),this.update(this.ias.pageIndex),this.element.addEventListener("click",this.clickHandler.bind(this))},dt.prototype.unbind=function(){this.element.removeEventListener("click",this.clickHandler.bind(this))},dt.prototype.clickHandler=function(){this.hide().then(this.ias.next.bind(this.ias))},dt.prototype.update=function(t){this.enabled=this.voter(t),this.enabled?this.ias.disableLoadOnScroll():this.ias.enableLoadOnScroll()},dt.prototype.hit=function(){this.enabled&&this.show()},dt.prototype.show=function(){if(!this.showing)return this.showing=!0,Promise.resolve(this.showFn(this.element))},dt.prototype.hide=function(){if(this.showing||void 0===this.showing)return this.showing=!1,Promise.resolve(this.hideFn(this.element))};var ft=window.ResizeObserver,mt=function(t,e){this.el=t,this.listener=e};mt.prototype.observe=function(){this.el.addEventListener("resize",this.listener)},mt.prototype.unobserve=function(){this.el.removeEventListener("resize",this.listener)};var yt=function(t,e){this.el=t,this.listener=e,this.ro=new ft(this.listener)};yt.prototype.observe=function(){this.ro.observe(this.el)},yt.prototype.unobserve=function(){this.ro.unobserve()};var gt=function(t,e){this.el=t,this.listener=e,this.interval=null,this.lastHeight=null};gt.prototype.pollHeight=function(){var t=Math.trunc(M(this.el).height);null!==this.lastHeight&&this.lastHeight!==t&&this.listener(),this.lastHeight=t},gt.prototype.observe=function(){this.interval=setInterval(this.pollHeight.bind(this),200)},gt.prototype.unobserve=function(){clearInterval(this.interval)};var vt=function(t,e){this.ias=t,this.enabled=e};vt.prototype.prefill=function(){var t=this;if(this.enabled&&0>=this.ias.distance())return this.ias.emitter.emit(U),this._prefill().then((function(){t.ias.emitter.emit(J),t.ias.measure()}))},vt.prototype._prefill=function(){var t=this;return this.ias.next().then((function(e){if(e)return 0>t.ias.distance()?t._prefill():void 0}))};var bt=function(t,n){var i,o,r,s=this;void 0===n&&(n={}),C(t,"container"),this.container=e(t)[0],this.options=c({},I,n),this.emitter=new nt,this.options.loadOnScroll?this.enableLoadOnScroll():this.disableLoadOnScroll(),this.negativeMargin=Math.abs(this.options.negativeMargin),this.scrollContainer=this.options.scrollContainer,this.options.scrollContainer!==window&&(C(this.options.scrollContainer,"options.scrollContainer"),this.scrollContainer=e(this.options.scrollContainer)[0]),this.nextHandler=it,!1===this.options.next?this.nextHandler=function(){}:"function"==typeof this.options.next&&(this.nextHandler=this.options.next),this.resizeObserver=(i=this,o=this.scrollContainer,r=L(tt,200).bind(i),o===window?new mt(o,r):ft?new yt(o,r):(console&&console.warn&&console.warn("ResizeObserver not supported. Falling back on polling."),new gt(o,r))),this._scrollListener=L(Z,200).bind(this),this.ready=!1,this.bindOnReady=!0,this.binded=!1,this.paused=!1,this.pageIndex=this.sentinel()?0:-1,this.on(k,(function(){s.loadOnScroll&&s.next()})),this.on(V,this.measure),this.on(Y,this.measure),this.pagination=new rt(this,this.options.pagination),this.spinner=new lt(this,this.options.spinner),this.logger=new ht(this,this.options.logger),this.paging=new ct(this),this.trigger=new dt(this,this.options.trigger),this.prefill=new vt(this,this.options.prefill),this.on(R,this.prefill.prefill.bind(this.prefill));var l=function(){s.ready||(s.ready=!0,s.emitter.emit($),s.bindOnReady&&s.options.bind&&s.bind())};"complete"===document.readyState||"interactive"===document.readyState?setTimeout(l,1):window.addEventListener("DOMContentLoaded",l)};return bt.prototype.bind=function(){this.binded||(this.ready||(this.bindOnReady=!1),this.scrollContainer.addEventListener("scroll",this._scrollListener),this.resizeObserver.observe(),this.binded=!0,this.emitter.emit(R))},bt.prototype.unbind=function(){this.binded?(this.resizeObserver.unobserve(),this.scrollContainer.removeEventListener("scroll",this._scrollListener),this.binded=!1,this.emitter.emit(D)):this.ready||this.once(R,this.unbind)},bt.prototype.next=function(){var t=this;if(!this.binded)return this.ready?void 0:this.once(R,this.next);this.pause();var e=this.pageIndex+1;return this.emitter.emit(X,{pageIndex:this.pageIndex+1}),Promise.resolve(this.nextHandler(e)).then((function(n){t.pageIndex=e,n?t.resume():t.emitter.emit(z)})).then((function(){t.emitter.emit(q,{pageIndex:t.pageIndex})}))},bt.prototype.load=function(t){var n=this;return new Promise((function(i,o){var r=new XMLHttpRequest,s={url:t,xhr:r,method:"GET",body:null,nocache:!1,responseType:n.options.responseType,headers:{"X-Requested-With":"XMLHttpRequest"}};n.emitter.emit(A,s);var l=s.url,a=s.method,h=s.responseType,c=s.headers,u=s.body;for(var d in s.nocache||(l=l+(/\?/.test(l)?"&":"?")+(new Date).getTime()),r.onreadystatechange=function(){if(r.readyState===XMLHttpRequest.DONE)if(0===r.status);else if(200===r.status){var t=r.response;"document"===h&&(t=e(n.options.item,r.response)),n.emitter.emit(B,{items:t,url:l,xhr:r}),i({items:t,url:l,xhr:r})}else n.emitter.emit(W,{url:l,method:a,xhr:r}),o(r)},r.onerror=function(){n.emitter.emit(W,{url:l,method:a,xhr:r}),o(r)},r.open(a,l,!0),r.responseType=h,c)r.setRequestHeader(d,c[d]);r.send(u)}))},bt.prototype.append=function(t,e){var n=this,i={items:t,parent:e=e||n.container,appendFn:pt};n.emitter.emit(P,i);return new Promise((function(o){window.requestAnimationFrame((function(){Promise.resolve(i.appendFn(i.items,i.parent,n.sentinel())).then((function(){o({items:t,parent:e})}))}))})).then((function(t){n.emitter.emit(F,t)}))},bt.prototype.sentinel=function(){var t=e(this.options.item,this.container);return t.length?t[t.length-1]:null},bt.prototype.pause=function(){this.paused=!0},bt.prototype.resume=function(){this.paused=!1},bt.prototype.enableLoadOnScroll=function(){this.loadOnScroll=!0},bt.prototype.disableLoadOnScroll=function(){this.loadOnScroll=!1},bt.prototype.distance=function(t,e){var n=t||M(this.scrollContainer),i=function(t,e,n){var i=n;if(!t)return-1*i.height;var o=e.y,r=t.getBoundingClientRect();return Math.trunc(o+r.bottom-i.top-(o+i.height))}(e||this.sentinel(),N(this.scrollContainer),n);return i-=this.negativeMargin,i},bt.prototype.measure=function(){if(!this.paused){var t=M(this.scrollContainer);if(0!==t.height){var e=this.sentinel(),n=this.distance(t,e);n>0||this.emitter.emit(k,{distance:n})}}},bt.prototype.on=function(t,e){this.emitter.on(t,e,this),t===R&&this.binded&&e.bind(this)()},bt.prototype.off=function(t,e){this.emitter.off(t,e,this)},bt.prototype.once=function(t,e){var n=this;return new Promise((function(i){n.emitter.once(t,(function(){Promise.resolve(e.apply(this,arguments)).then(i)}),n),t===R&&n.binded&&(e.bind(n)(),i())}))},bt}));
/*Fixed sidebar*/
!function(a){a.fn.theiaStickySidebar=function(E){function e(E,e){var ad=L(E,e);ad||(console.log("TSS: Body width smaller than options.minWidth. Init is delayed."),a(document).on("scroll."+E.namespace,function(E,e){return function(ad){var b=L(E,e);b&&a(this).unbind(ad)}}(E,e)),a(window).on("resize."+E.namespace,function(E,e){return function(ad){var b=L(E,e);b&&a(this).unbind(ad)}}(E,e)))}function L(E,e){return E.initialized===!0||!(a("body").width()<E.minWidth)&&(ad(E,e),!0)}function ad(E,e){E.initialized=!0;var L=a("#theia-sticky-sidebar-stylesheet-"+E.namespace);0===L.length&&a("head").append(a('<style id="theia-sticky-sidebar-stylesheet-'+E.namespace+'">.theiaStickySidebar:after {content: ""; display: table; clear: both;}</style>')),e.each(function(){function e(){ad.fixedScrollTop=0,ad.sidebar.css({"min-height":"1px"}),ad.stickySidebar.css({position:"static",width:"",transform:"none"})}function L(E){var e=E.height();return E.children().each(function(){e=Math.max(e,a(this).height())}),e}var ad={};if(ad.sidebar=a(this),ad.options=E||{},ad.container=a(ad.options.containerSelector),0==ad.container.length&&(ad.container=ad.sidebar.parent()),ad.sidebar.parents().css("-webkit-transform","none"),ad.sidebar.css({position:ad.options.defaultPosition,overflow:"visible","-webkit-box-sizing":"border-box","-moz-box-sizing":"border-box","box-sizing":"border-box"}),ad.stickySidebar=ad.sidebar.find(".theiaStickySidebar"),0==ad.stickySidebar.length){var Z=/(?:text|application)\/(?:x-)?(?:javascript|ecmascript)/i;ad.sidebar.find("script").filter(function(a,E){return 0===E.type.length||E.type.match(Z)}).remove(),ad.stickySidebar=a("<div>").addClass("theiaStickySidebar").append(ad.sidebar.children()),ad.sidebar.append(ad.stickySidebar)}ad.marginBottom=parseInt(ad.sidebar.css("margin-bottom")),ad.paddingTop=parseInt(ad.sidebar.css("padding-top")),ad.paddingBottom=parseInt(ad.sidebar.css("padding-bottom"));var ec=ad.stickySidebar.offset().top,c=ad.stickySidebar.outerHeight();ad.stickySidebar.css("padding-top",1),ad.stickySidebar.css("padding-bottom",1),ec-=ad.stickySidebar.offset().top,c=ad.stickySidebar.outerHeight()-c-ec,0==ec?(ad.stickySidebar.css("padding-top",0),ad.stickySidebarPaddingTop=0):ad.stickySidebarPaddingTop=1,0==c?(ad.stickySidebar.css("padding-bottom",0),ad.stickySidebarPaddingBottom=0):ad.stickySidebarPaddingBottom=1,ad.previousScrollTop=null,ad.fixedScrollTop=0,e(),ad.onScroll=function(ad){if(ad.stickySidebar.is(":visible")){if(a("body").width()<ad.options.minWidth)return void e();if(ad.options.disableOnResponsiveLayouts){var Z=ad.sidebar.outerWidth("none"==ad.sidebar.css("float"));if(Z+50>ad.container.width())return void e()}var ec=a(document).scrollTop(),c="static";if(ec>=ad.sidebar.offset().top+(ad.paddingTop-ad.options.additionalMarginTop)){var d,bA=ad.paddingTop+E.additionalMarginTop,cM=ad.paddingBottom+ad.marginBottom+E.additionalMarginBottom,f=ad.sidebar.offset().top,Lf=ad.sidebar.offset().top+L(ad.container),Y=0+E.additionalMarginTop,g=ad.stickySidebar.outerHeight()+bA+cM<a(window).height();d=g?Y+ad.stickySidebar.outerHeight():a(window).height()-ad.marginBottom-ad.paddingBottom-E.additionalMarginBottom;var j=f-ec+ad.paddingTop,dK=Lf-ec-ad.paddingBottom-ad.marginBottom,bU=ad.stickySidebar.offset().top-ec,gj=ad.previousScrollTop-ec;"fixed"==ad.stickySidebar.css("position")&&"modern"==ad.options.sidebarBehavior&&(bU+=gj),"stick-to-top"==ad.options.sidebarBehavior&&(bU=E.additionalMarginTop),"stick-to-bottom"==ad.options.sidebarBehavior&&(bU=d-ad.stickySidebar.outerHeight()),bU=gj>0?Math.min(bU,Y):Math.max(bU,d-ad.stickySidebar.outerHeight()),bU=Math.max(bU,j),bU=Math.min(bU,dK-ad.stickySidebar.outerHeight());var ade=ad.container.height()==ad.stickySidebar.outerHeight();c=(ade||bU!=Y)&&(ade||bU!=d-ad.stickySidebar.outerHeight())?ec+bU-ad.sidebar.offset().top-ad.paddingTop<=E.additionalMarginTop?"static":"absolute":"fixed"}if("fixed"==c){var A=a(document).scrollLeft();ad.stickySidebar.css({position:"fixed",width:b(ad.stickySidebar)+"px",transform:"translateY("+bU+"px)",left:ad.sidebar.offset().left+parseInt(ad.sidebar.css("padding-left"))-A+"px",top:"0px"})}else if("absolute"==c){var eW={};"absolute"!=ad.stickySidebar.css("position")&&(eW.position="absolute",eW.transform="translateY("+(ec+bU-ad.sidebar.offset().top-ad.stickySidebarPaddingTop-ad.stickySidebarPaddingBottom)+"px)",eW.top="0px"),eW.width=b(ad.stickySidebar)+"px",eW.left="",ad.stickySidebar.css(eW)}else"static"==c&&e();"static"!=c&&1==ad.options.updateSidebarHeight&&ad.sidebar.css({"min-height":ad.stickySidebar.outerHeight()+ad.stickySidebar.offset().top-ad.sidebar.offset().top+ad.paddingBottom}),ad.previousScrollTop=ec}},ad.onScroll(ad),a(document).on("scroll."+ad.options.namespace,function(a){return function(){a.onScroll(a)}}(ad)),a(window).on("resize."+ad.options.namespace,function(a){return function(){a.stickySidebar.css({position:"static"}),a.onScroll(a)}}(ad)),"undefined"!=typeof ResizeSensor&&new ResizeSensor(ad.stickySidebar[0],function(a){return function(){a.onScroll(a)}}(ad))})}function b(a){var E;try{E=a[0].getBoundingClientRect().width}catch(a){}return"undefined"==typeof E&&(E=a.width()),E}var Z={containerSelector:"",additionalMarginTop:0,additionalMarginBottom:0,updateSidebarHeight:!0,minWidth:0,disableOnResponsiveLayouts:!0,sidebarBehavior:"modern",defaultPosition:"relative",namespace:"TSS"};return E=a.extend(Z,E),E.additionalMarginTop=parseInt(E.additionalMarginTop)||0,E.additionalMarginBottom=parseInt(E.additionalMarginBottom)||0,e(E,this),this}}(jQuery);$(document).ready(function(){$("#sidebar").theiaStickySidebar({additionalMarginTop:0})});
/*text to link*/
$(function(){$(".art-comment-content .clbody .p").each(function(index,element){$(this).html($(this).html().replace(/\[s-(.*?)\]/ig,'<img class="expression" src="/zb_users/theme/xianbao_theme/image/expression/$1.png"/>'));$(this).html($(this).html().replace(/\[img\]*(.*?)\[\/img\]/ig,'<img src="$1" data-fancybox="commnet-img" title="查看大图"/>'))});const linkRegex=/(http|ftp|https):\/\/[\w\-_]+(\.[\w\-_]+)+([\w\-\.,@?^=%&:/~\+#;{}"']*[\w\-\@?^=%&/~\+#])?/g;const excludeTags=['head','script','style','iframe','input','textarea','select','button','option','label','nav','noscript','code','pre','svg','image','audio','video'];function shouldExcludeNode(node){if(node&&node.parentNode){return excludeTags.includes(node.parentNode.tagName.toLowerCase())}return false}function linkifyNode(node){if(node.nodeType===Node.TEXT_NODE){const text=node.textContent;let newText='';let lastIndex=0;let match=linkRegex.exec(text);while(match!==null){const prefix=text.slice(lastIndex,match.index);lastIndex=match.index+match[0].length;const link=match[0];newText+=`${prefix}<a href='${link}'target='_blank'>${link}</a>`;match=linkRegex.exec(text)}newText+=text.slice(lastIndex);if(newText!==text){const newNode=document.createElement('span');newNode.innerHTML=newText;node.parentNode.replaceChild(newNode,node)}}else if(node.nodeType===Node.ELEMENT_NODE&&!shouldExcludeNode(node)&&!$(node).is('a')){node.childNodes.forEach(linkifyNode)}}const containers=$('.post-comment, .article-content');containers.each(function(){linkifyNode(this)});const observer=new MutationObserver(mutations=>{mutations.forEach(mutation=>{const addedNodes=Array.from(mutation.addedNodes);addedNodes.forEach(node=>{if(node.nodeType===Node.ELEMENT_NODE&&($(node).is('.post-comment, .article-content')||$(node).closest('.post-comment, .article-content').length)){linkifyNode(node)}})})});observer.observe(document.body,{childList:true,subtree:true})});
function daohangchuli(a) {
    if (a == "赚客吧") {
        return '<li><a href="/category-zuankeba/" title="赚客吧" rel="nofollow">赚客吧</a></li>'
    } else if (a == "赚客吧热帖") {
        return '<li><a href="/zuankeba-hot.html" title="赚客吧热帖" rel="nofollow">赚客吧热帖</a></li>'
    } else if (a == "新赚吧") {
        return '<li><a href="/category-xinzuanba/" title="新赚吧" rel="nofollow">新赚吧</a></li>'
    } else if (a == "新赚吧热帖") {
        return '<li><a href="/xinzuanba-hot.html" title="新赚吧热帖" rel="nofollow">新赚吧热帖</a></li>'
    } else if (a == "微博线报") {
        return '<li><a href="/category-weibo/" title="微博线报" rel="nofollow">微博线报</a></li>'
    } else if (a == "微博热帖") {
        return '<li><a href="/weibo-hot.html" title="微博热帖" rel="nofollow">微博热帖</a></li>'
    } else if (a == "微博超话") {
        return '<li><a href="/category-weibo-chaohua/" title="微博超话" rel="nofollow">微博超话</a></li>'
    } else if (a == "豆瓣线报") {
        return '<li><a href="/category-douban/" title="豆瓣线报" rel="nofollow">豆瓣线报</a></li>'
    } else if (a == "豆瓣热帖") {
        return '<li><a href="/douban-hot.html" title="豆瓣热帖" rel="nofollow">豆瓣热帖</a></li>'
    } else if (a == "豆瓣买组") {
        return '<li><a href="/category-douban-maizu/" title="豆瓣买组" rel="nofollow">豆瓣买组</a></li>'
    } else if (a == "豆瓣拼组") {
        return '<li><a href="/category-douban-pinzu/" title="豆瓣拼组" rel="nofollow">豆瓣拼组</a></li>'
    } else if (a == "豆瓣发组") {
        return '<li><a href="/category-douban-fazu/" title="豆瓣发组" rel="nofollow">豆瓣发组</a></li>'
    } else if (a == "爱猫生活") {
        return '<li><a href="/category-douban-maolife/" title="豆瓣爱猫生活" rel="nofollow">豆瓣爱猫生活</a></li>'
    } else if (a == "爱猫澡盆") {
        return '<li><a href="/category-douban-maobathtub/" title="豆瓣爱猫澡盆" rel="nofollow">豆瓣爱猫澡盆</a></li>'
    } else if (a == "豆瓣狗组") {
        return '<li><a href="/category-douban-gouzu/" title="豆瓣狗组" rel="nofollow">豆瓣狗组</a></li>'
    } else if (a == "好单线报") {
        return '<li><a href="/category-haodan/" title="好单线报" rel="nofollow">好单线报</a></li>'
    } else if (a == "小嘀咕") {
        return '<li><a href="/category-xiaodigu/" title="小嘀咕" rel="nofollow">小嘀咕</a></li>'
    } else if (a == "值得买") {
        return '<li><a href="/category-zhidemai/" title="值得买" rel="nofollow">值得买</a></li>'
    } else if (a == "值得买热帖") {
        return '<li><a href="/zhidemai-hot.html" title="值得买热帖" rel="nofollow">值得买热帖</a></li>'
    } else if (a == "酷安") {
        return '<li><a href="/category-kuan/" title="酷安" rel="nofollow">酷安</a></li>'
    } else if (a == "葫芦侠三楼") {
        return '<li><a href="/category-huluxia/" title="葫芦侠三楼" rel="nofollow">葫芦侠三楼</a></li>'
    } else if (a == "更新较慢活动") {
        return '<li><a href="/category-man/" title="更新较慢活动" rel="nofollow">更新较慢活动</a></li>'
    } else if (a == "小刀娱乐网") {
        return '<li><a href="/category-xiaodao/" title="小刀娱乐网" rel="nofollow">小刀娱乐网</a></li>'
    } else if (a == "爱Q生活网") {
        return '<li><a href="/category-iqnew/" title="爱Q生活网" rel="nofollow">爱Q生活网</a></li>'
    } else if (a == "技术QQ网") {
        return '<li><a href="/category-qqjishu/" title="技术QQ网" rel="nofollow">技术QQ网</a></li>'
    } else if (a == "YYOK大全") {
        return '<li><a href="/category-yyok/" title="YYOK大全" rel="nofollow">YYOK大全</a></li>'
    } else if (a == "活动资讯网") {
        return '<li><a href="/category-huodong/" title="活动资讯网" rel="nofollow">活动资讯网</a></li>'
    } else if (a == "免费赚钱中心") {
        return '<li><a href="/category-mianfei/" title="免费赚钱中心" rel="nofollow">免费赚钱中心</a></li>'
    } else {
        return ''
    }
}
function adddaohang(a){if(a=="默认"){return}var daohangarr=a.split("|");var xindaohang="";for(j=0;j<daohangarr.length;j++){xindaohang=xindaohang+daohangchuli(daohangarr[j])}$(".nav2-ul").html('<li><a href="/" title="线报酷" rel="nofollow">首页</a></li><li><a href="/category-guanzhu/" title="我的关注-线报酷" rel="nofollow">我的关注</a></li><li><a href="/yixiaoshi-hot.html" title="排行榜-线报酷" rel="nofollow">排行榜</a></li>'+xindaohang);zhenglidaohang()}
function zhenglidaohang() {
    $(".nav2-ul li a").each(function () {
        if ($(this).attr("href") == $(".mianbaoxie a").eq(1).attr("href") || $(this).attr("href") == window.location.pathname) {
            $(".nav2-ul li").removeClass("nav2-ul-li");
            $(this).parent("li").addClass("nav2-ul-li")
        } else if ($(this).attr("href") == "/category-douban/" && $(".nav2-ul li a").hasClass("nav2-ul-li") ==false && window.location.pathname.indexOf("douban") != -1) {
            $(".nav2-ul li").removeClass("nav2-ul-li");
            $(this).parent("li").addClass("nav2-ul-li")
        } else if ($(this).attr("href") == "/category-weibo/" && window.location.pathname.indexOf("weibo") != -1) {
            $(".nav2-ul li").removeClass("nav2-ul-li");
            $(this).parent("li").addClass("nav2-ul-li")
        } else if ($(this).attr("href") == "/category-haodan/" && window.location.pathname.indexOf("haodan") != -1) {
            $(".nav2-ul li").removeClass("nav2-ul-li");
            $(this).parent("li").addClass("nav2-ul-li")
        } else if ($(this).attr("href") == "/category-guanzhu1/" && window.location.pathname.indexOf("guanzhu") != -1) {
            $(".nav2-ul li").removeClass("nav2-ul-li");
            $(this).parent("li").addClass("nav2-ul-li")
        } else if ($(this).attr("href") == "/category-zhidemai/" && window.location.pathname.indexOf("zhidemai") != -1) {
            $(".nav2-ul li").removeClass("nav2-ul-li");
            $(this).parent("li").addClass("nav2-ul-li")
        } else if ($(this).attr("href").indexOf($(".tip-main").data("type")) != -1) {
            $(".nav2-ul li").removeClass("nav2-ul-li");
            $(this).parent("li").addClass("nav2-ul-li")
        } else if ($(this).attr("href") == "/yixiaoshi-hot.html" && $(".pc-nav").attr("data-pagealias")) {
            $(".nav2-ul li").removeClass("nav2-ul-li");
            $(this).parent("li").addClass("nav2-ul-li")
        }
    });
    if ($(".nav2-ul-li").length > 0) {
        var w = 0;
        $(".nav2-ul-li").prevAll().each(function () {
            w = w + $(this).innerWidth()
        });
        w = w + ($(".nav2-ul-li").innerWidth() / 2);
        w = w - ($(".nav2-ul").innerWidth() / 2);
        $(".nav2-ul").scrollLeft(w)
    } else {
        $(".nav2-ul").find("li").eq(0).addClass("nav2-ul-li")
    }
}
$(function() {zhenglidaohang();});
$(function(){$("#toolbar").each(function(){$(this).find("#qr").mouseenter(function(){$(this).find("#qr-img").fadeIn("fast")});$(this).find("#qr").mouseleave(function(){$(this).find("#qr-img").fadeOut("fast")});$(this).find("#totop").click(function(){$("html, body").animate({"scroll-top":0},"fast")})});var a=false;$(window).scroll(function(){var b=$(window).scrollTop();if(b>500){$("#toolbar").data("status",true)}else{$("#toolbar").data("status",false)}if($("#toolbar").data("status")!=a){a=$("#toolbar").data("status");if(a){$("#totop").show()}else{$("#totop").hide()}}})});$(function(){var a=$("#flink a");a.addClass("iconfont icon-link")});
function xialashuaxin(type,redsign,pingbifenlei,pingbilouzhu,zhanxianlouzhu,pingbilouzhuplus,pingbibiaoti,zhanxianbiaoti,pingbibiaotiplus,pingbineirong,zhanxianneirong,pingbineirongplus,pingbitime){if(type=="普通"){PullToRefresh.init({mainElement:"#mainbox",triggerElement:"#mainbox",distThreshold:80,distMax:90,distIgnore:50,instructionsPullToRefresh:"下拉获取内容刷新",instructionsReleaseToRefresh:"释放后进行内容刷新",instructionsRefreshing:"正在请求中",refreshTimeout:300,onRefresh:function(){location.reload()}})}else{PullToRefresh.init({mainElement:"#mainbox",triggerElement:"#mainbox",distThreshold:80,distMax:90,distIgnore:50,instructionsPullToRefresh:"下拉获取内容刷新",instructionsReleaseToRefresh:"释放后进行内容刷新",instructionsRefreshing:"正在请求中",refreshTimeout:300,onRefresh:function(){$.ajax({url:window.location.href,success:function(result){var olddata=$("#mainbox .new-post").html();result = result.replace(/[\r\n]+/g, '');var newdataarr=result.match(new RegExp('<li class="article-list">(.*?)</li>',"g"));var shuliang=0;var tianjiahtml="";if(!newdataarr){return}for(var i=0;i<newdataarr.length;i++){var art=[];art.url=newdataarr[i].match(new RegExp('href="(.*?)"',"i"))[1];art.catename=newdataarr[i].match(new RegExp('data-catename="(.*?)"',"i"))[1];art.louzhu=newdataarr[i].match(new RegExp('data-louzhu="(.*?)"',"i"))[1];art.title=newdataarr[i].match(new RegExp('html" title="(.*?)" target',"i"))[1];art.content=newdataarr[i].match(new RegExp('data-content="(.*?)"',"i"));var panduanreg=art.url;if(olddata&&!olddata.match(new RegExp(panduanreg,"i"))){if(listfilter(art,pingbifenlei,pingbilouzhu,zhanxianlouzhu,pingbilouzhuplus,pingbibiaoti,zhanxianbiaoti,pingbibiaotiplus,pingbineirong,zhanxianneirong,pingbineirongplus,pingbitime)!=false){shuliang++;newdataarr[i]=newdataarr[i].replace('class="article-list"','class="article-list newest"');tianjiahtml=tianjiahtml+newdataarr[i];$("#mainbox .article-list").removeClass("newest")}}}if(tianjiahtml){if($("#mainbox .new-post .top:last").length>0){$("#mainbox .new-post .top:last").after(tianjiahtml)}else{$("#mainbox .new-post").prepend(tianjiahtml)}if(redsign){list_red(redsign,"list")}layer.msg("获取到"+shuliang+"个新数据")}else{layer.msg("未获取到新数据")}}})}})}}



function zdm_xialashuaxin(type, redsign, zdm_config) {
    if (type == "普通") {
        PullToRefresh.init({
            mainElement: "#mainbox",
            triggerElement: "#mainbox",
            distThreshold: 80,
            distMax: 90,
            distIgnore: 50,
            instructionsPullToRefresh: "下拉获取内容刷新",
            instructionsReleaseToRefresh: "释放后进行内容刷新",
            instructionsRefreshing: "正在请求中",
            refreshTimeout: 300,
            onRefresh: function () {
                location.reload()
            }
        })
    } else {
        PullToRefresh.init({
            mainElement: "#mainbox",
            triggerElement: "#mainbox",
            distThreshold: 80,
            distMax: 90,
            distIgnore: 50,
            instructionsPullToRefresh: "下拉获取内容刷新",
            instructionsReleaseToRefresh: "释放后进行内容刷新",
            instructionsRefreshing: "正在请求中",
            refreshTimeout: 300,
            onRefresh: function () {
                $.ajax({
                    url: window.location.href,
                    success: function (result) {
                        var olddata = $("#mainbox .new-post").html();
                        result = result.replace(/[\r\n]+/g, '');
                        var newdataarr = result.match(new RegExp('<li class="article-list">(.*?)</li>', "g"));
                        var shuliang = 0;
                        var tianjiahtml = "";
                        if (!newdataarr) {
                            return
                        }
                        
                        for (var i = 0; i < newdataarr.length; i++) {
                            var art = [];
                            art.title = newdataarr[i].match(new RegExp('title="(.*?)"', "i"))[1];
                            art.price = newdataarr[i].match(new RegExp('data-price="(.*?)"', "i"))[1];
                            art.type = newdataarr[i].match(new RegExp('data-type="(.*?)"', "i"))[1];
                            art.brand = newdataarr[i].match(new RegExp('data-brand="(.*?)"', "i"))[1];
                            art.mall_name = newdataarr[i].match(new RegExp('data-mall_name="(.*?)"', "i"))[1];
                            art.category_name = newdataarr[i].match(new RegExp('data-category_name="(.*?)"', "i"))[1];
                            art.url = newdataarr[i].match(new RegExp('href="(.*?)"', "i"))[1];
                            var panduanreg = art.url;
                            if (olddata && !olddata.match(new RegExp(panduanreg, "i"))) {
                                if (zdm_listfilter(art, zdm_config) != false) {
                                    shuliang++;
                                    newdataarr[i] = newdataarr[i].replace(
                                        'class="article-list"',
                                        'class="article-list newest"');
                                    tianjiahtml = tianjiahtml + newdataarr[i];
                                    $("#mainbox .article-list").removeClass("newest")
                                }
                            }
                        }
                        if (tianjiahtml) {
                            if ($("#mainbox .new-post .top:last").length > 0) {
                                $("#mainbox .new-post .top:last").after(tianjiahtml)
                            } else {
                                $("#mainbox .new-post").prepend(tianjiahtml)
                            }
                            if (redsign) {
                                list_red(redsign, "list")
                            }
                            layer.msg("获取到" + shuliang + "个新数据")
                        } else {
                            layer.msg("未获取到新数据")
                        }
                    }
                })
            }
        })
    }
}

function ajaxpaging(type,redsign,pingbifenlei,pingbilouzhu,zhanxianlouzhu,pingbilouzhuplus,pingbibiaoti,zhanxianbiaoti,pingbibiaotiplus,pingbineirong,zhanxianneirong,pingbineirongplus,pingbitime){if($("#mainbox .listbox").length>0&&$("#mainbox .pagebar .nav-links .next a").length>0){if(type=="点击加载"){$("#mainbox .listbox").after('<div class="pagination load-more"><i class="iconfont icon-refresh"></i>加载更多</div>')}Scrolldata=[];Scrolldata.item=".listbox .new-post li";Scrolldata.next=".pagebar .nav-links .next a";Scrolldata.pagination=".pagebar";Scrolldata.negativeMargin=400;Scrolldata.logger=false;Scrolldata.prefill=true;if(type=="点击加载"){Scrolldata.trigger=".load-more"}let ias=new InfiniteAjaxScroll(".listbox .new-post",Scrolldata);ias.on("append",function(event){var newitems=[];for(var i=0;i<event.items.length;i++){if(event.items[i].classList[1]=="top"){continue}var field=[];field.catename=event.items[i].querySelector('a').dataset.catename;field.title=event.items[i].querySelector('a').getAttribute('title');field.content=event.items[i].querySelector('a').dataset.content;field.louzhu=event.items[i].querySelector('a').dataset.louzhu;if(listfilter(field,pingbifenlei,pingbilouzhu,zhanxianlouzhu,pingbilouzhuplus,pingbibiaoti,zhanxianbiaoti,pingbibiaotiplus,pingbineirong,zhanxianneirong,pingbineirongplus,pingbitime)==true){newitems.push(event.items[i])}}event.items=[];event.items=newitems});ias.on("appended",function(){$("#mainbox .load-more").show();$("#mainbox .loading").remove();if(redsign){list_red(redsign,"list")}});ias.on("last",function(){$("#mainbox .loading").remove();$("#mainbox .load-more").remove();$("#mainbox .listbox").after('<div class="pagination end">已经是最后一页了</div>')});ias.on("page",function(event){document.title=event.title;let state=history.state;history.replaceState(state,event.title,event.url)});ias.on("next",function(event){$("#mainbox .load-more").hide();$("#mainbox .listbox").after('<div class="pagination loading"><img src="/zb_users/theme/xianbao_theme/image/loading.gif"/></div>')});ias.on("load",function(event){event.nocache=true})}}

function zdm_ajaxpaging(type, redsign, zdm_config) {
    if ($("#mainbox .listbox").length > 0 && $("#mainbox .pagebar .nav-links .next a").length > 0) {
        if (type == "点击加载") {
            $("#mainbox .listbox").after(
                '<div class="pagination load-more"><i class="iconfont icon-refresh"></i>加载更多</div>')
        }
        Scrolldata = [];
        Scrolldata.item = ".listbox .new-post li";
        Scrolldata.next = ".pagebar .nav-links .next a";
        Scrolldata.pagination = ".pagebar";
        Scrolldata.negativeMargin = 400;
        Scrolldata.logger = false;
        Scrolldata.prefill = true;
        if (type == "点击加载") {
            Scrolldata.trigger = ".load-more"
        }
        let ias = new InfiniteAjaxScroll(".listbox .new-post", Scrolldata);
        ias.on("append", function (event) {
            var newitems = [];
            for (var i = 0; i < event.items.length; i++) {
                if (event.items[i].classList[1] == "top") {
                    continue
                }
                var field = [];
                field.title = event.items[i].querySelector('a').getAttribute('title');
                field.price = event.items[i].querySelector('a').dataset.price;
                field.type = event.items[i].querySelector('a').dataset.type;
                field.brand = event.items[i].querySelector('a').dataset.brand;
                field.mall_name = event.items[i].querySelector('a').dataset.mall_name;
                field.category_name = event.items[i].querySelector('a').dataset.category_name;
                
                if (zdm_listfilter(field, zdm_config) == true) {
                    newitems.push(event.items[i]);
                }
            }
            event.items = [];
            event.items = newitems;
        });
        ias.on("appended", function () {
            $("#mainbox .load-more").show();
            $("#mainbox .loading").remove();
            if (redsign) {
                list_red(redsign, "list")
            }
        });
        ias.on("last", function () {
            $("#mainbox .loading").remove();
            $("#mainbox .load-more").remove();
            $("#mainbox .listbox").after('<div class="pagination end">已经是最后一页了</div>')
        });
        ias.on("page", function (event) {
            document.title = event.title;
            let state = history.state;
            history.replaceState(state, event.title, event.url)
        });
        ias.on("next", function (event) {
            $("#mainbox .load-more").hide();
            $("#mainbox .listbox").after(
                '<div class="pagination loading"><img src="/zb_users/theme/xianbao_theme/image/loading.gif"/></div>'
                )
        });
        ias.on("load", function (event) {
            event.nocache = true
        })
    }
}
function haodan_ajaxpaging(type,redsign,pingbifenlei,pingbi,zhanxian,pingbiplus,zhuanlian_config){if($(".tip-main .tipoff-list").length>0&&$(".pagebar .nav-links .next a").length>0){if(type=="点击加载"){$(".tip-main").append('<div class="pagination load-more"><i class="iconfont icon-refresh"></i>加载更多</div>')}Scrolldata=[];Scrolldata.item=".tipoff-list .haodan-list";Scrolldata.next=".pagebar .nav-links .next a";Scrolldata.pagination=".pagebar";Scrolldata.negativeMargin=400;Scrolldata.logger=false;Scrolldata.prefill=true;if(type=="点击加载"){Scrolldata.trigger=".load-more"}let ias=new InfiniteAjaxScroll(".tip-main .tipoff-list",Scrolldata);ias.on("append",function(event){let a="";event.items.forEach(function(item){let field=[];field.title=$(item).find('.right').text();field.catename=$(item).find('.right').data('catename');if(listfilter(field,pingbifenlei,"","","",pingbi,zhanxian,pingbiplus,"","","","")==true){console.log($(item).find('.right').text());a+=item.outerHTML}});var $container=$('.tipoff-list');var $newComAnimationPlace=$(a);$container.append($newComAnimationPlace);$container.masonry({itemSelector:'.haodan-list',gutter:1,isAnimated:true,isFitWidth:true,isResizable:true,columnWidth:0});$container.masonry('appended',$newComAnimationPlace);event.items=[]});ias.on("appended",function(){if(zhuanlian_config){haodanzhuanlian(zhuanlian_config)}if(redsign){haodan_red(redsign)}$(".tip-main .load-more").show();$(".tip-main .loading").remove()});ias.on("last",function(){$(".tip-main .loading").remove();$(".tip-main .load-more").remove();$(".tip-main").append('<div class="pagination end">已经是最后一页了</div>')});ias.on("page",function(event){document.title=event.title;let state=history.state;history.replaceState(state,event.title,event.url)});ias.on("next",function(event){$(".tip-main .load-more").hide();$(".tip-main").append('<div class="pagination loading"><img src="/zb_users/theme/xianbao_theme/image/loading.gif"/></div>')});ias.on("load",function(event){event.nocache=true})}}
// function guesslikechuli(result,shuliang,biaoqian,artid,redstr,pingbifenlei,pingbilouzhu,zhanxianlouzhu,pingbilouzhuplus,pingbibiaoti,zhanxianbiaoti,pingbibiaotiplus,pingbineirong,zhanxianneirong,pingbineirongplus,pingbitime){var myCars=[];var dangqianshu=0;$.each(result,function(i,field){if(biaoqian){var biaoqianreg=new RegExp(biaoqian,"i");var hebing=field.title+field.content;if(!hebing.match(biaoqianreg)){return true}}if(artid){var artidreg=new RegExp("/"+artid+".html","i");if(field.url.match(artidreg)){return true}}if(listfilter(field,pingbifenlei,pingbilouzhu,zhanxianlouzhu,pingbilouzhuplus,pingbibiaoti,zhanxianbiaoti,pingbibiaotiplus,pingbineirong,zhanxianneirong,pingbineirongplus,pingbitime)===false){return true}dangqianshu++;if(dangqianshu>shuliang){return false}myCars.push(field)});if(myCars.length<3){biaoqian="";var myCars=[];var dangqianshu=0;$.each(result,function(i,field){if(artid){var artidreg=new RegExp("/"+artid+".html","i");if(field.url.match(artidreg)){return true}}if(listfilter(field,pingbifenlei,pingbilouzhu,zhanxianlouzhu,pingbilouzhuplus,pingbibiaoti,zhanxianbiaoti,pingbibiaotiplus,pingbineirong,zhanxianneirong,pingbineirongplus,pingbitime)===false){return true}dangqianshu++;if(dangqianshu>shuliang){return false}myCars.push(field)})}myCars=sortByKey(myCars,"shijianchuo","desc");var newhtml1="";var newhtml2="";var newhtml3="";var newCars1=myCars.slice(0,15);var newCars2=myCars.slice(15,30);var newCars3=myCars.slice(30,45);if(newCars1.length>0){newhtml1='<div class="swiper-slide"><ul class="new-post">'+listtimechuli(newCars1)+'</ul></div>'}if(newCars2.length>0){newhtml2='<div class="swiper-slide"><ul class="new-post">'+listtimechuli(newCars2)+'</ul></div>'}if(newCars3.length>0){newhtml3='<div class="swiper-slide"><ul class="new-post">'+listtimechuli(newCars3)+'</ul></div>'}if(biaoqian){addbiaoqian="（"+biaoqian+"）"}else{addbiaoqian=""}if(newhtml1){var jieguo='<div class="xiangguan sb mt"><div class="clearfix"><div class="mianbaoxie">猜你还会喜欢'+addbiaoqian+'</div><div class="swiper"><div class="swiper-wrapper">'+newhtml1+newhtml2+newhtml3+'</div></div></div></div>';$("#mainbox").append(jieguo)}var mySwiper=new Swiper('.xiangguan .swiper',{autoHeight:true});list_red(redstr,"xiangguan")}
// function guesslike(netkaiguan,shuliang,redstr,pingbifenlei,pingbilouzhu,zhanxianlouzhu,pingbilouzhuplus,pingbibiaoti,zhanxianbiaoti,pingbibiaotiplus,pingbineirong,zhanxianneirong,pingbineirongplus,pingbitime){var biaoqian=$("#article-button").data("biaoqian");var artid=$("#article-button").data("id");if(lscache.supported()){if(lscache.get("guesslike")){result=lscache.get("guesslike");guesslikechuli(result,shuliang,biaoqian,artid,redstr,pingbifenlei,pingbilouzhu,zhanxianlouzhu,pingbilouzhuplus,pingbibiaoti,zhanxianbiaoti,pingbibiaotiplus,pingbineirong,zhanxianneirong,pingbineirongplus,pingbitime);return}if(netkaiguan=="on"){$.getJSON("/plus/json/rank/guesslike.json",function(result,status){if(status=="success"){lscache.set("guesslike",result,60*30);guesslikechuli(result,shuliang,biaoqian,artid,redstr,pingbifenlei,pingbilouzhu,zhanxianlouzhu,pingbilouzhuplus,pingbibiaoti,zhanxianbiaoti,pingbibiaotiplus,pingbineirong,zhanxianneirong,pingbineirongplus,pingbitime)}})}else{const gaofeng='<div class="xiangguan sb mt"><div class="clearfix"><div class="mianbaoxie">高峰时间猜你喜欢暂停输出</div></div></div>';$("#mainbox").append(gaofeng)}}}



function guesslikechuli(result, shuliang, biaoqian, artid, redstr, pingbifenlei, pingbilouzhu, zhanxianlouzhu,
    pingbilouzhuplus, pingbibiaoti, zhanxianbiaoti, pingbibiaotiplus, pingbineirong, zhanxianneirong, pingbineirongplus,
    pingbitime) {
    
    if (!result || !Array.isArray(result)) return;
    
    var filterOptions = {
        pingbifenlei: pingbifenlei,
        pingbilouzhu: pingbilouzhu,
        zhanxianlouzhu: zhanxianlouzhu,
        pingbilouzhuplus: pingbilouzhuplus,
        pingbibiaoti: pingbibiaoti,
        zhanxianbiaoti: zhanxianbiaoti,
        pingbibiaotiplus: pingbibiaotiplus,
        pingbineirong: pingbineirong,
        zhanxianneirong: zhanxianneirong,
        pingbineirongplus: pingbineirongplus,
        pingbitime: pingbitime
    };

    // 过滤并获取符合条件的文章
    function filterArticles(data, useTagFilter) {
        var filtered = [];
        var count = 0;
        
        $.each(data, function(i, field) {
            // 标签过滤
            if (useTagFilter && biaoqian) {
                var biaoqianreg = new RegExp(biaoqian, "i");
                var hebing = field.title + (field.content || '');
                if (field.cateid === "10" && field.catename) {
                    hebing += field.catename.replace("微博线报-", "");
                }
                if (field.cateid === "30" && field.catename) {
                    hebing += field.catename.replace("好单线报-", "");
                }
                if (!biaoqianreg.test(hebing)) {
                    return true; // continue
                }
            }
            
            // ID过滤
            if (!useTagFilter && artid) {
                var artidreg = new RegExp("/" + artid + ".html", "i");
                if (field.url && artidreg.test(field.url)) {
                    return true; // continue
                }
            }
            
            // 列表过滤
            if (listfilter(field, pingbifenlei, pingbilouzhu, zhanxianlouzhu, pingbilouzhuplus, pingbibiaoti,
    zhanxianbiaoti, pingbibiaotiplus, pingbineirong, zhanxianneirong, pingbineirongplus, pingbitime) === false) {
                return true; // continue
            }
            
            count++;
            if (count > shuliang) {
                return false; // break
            }
            
            filtered.push(field);
        });
        
        return filtered;
    }
    
    // 第一次尝试用标签过滤
    var myCars = filterArticles(result, true);
    
    // 如果结果不足，则不用标签再过滤一次
    if (myCars.length < 3) {
        myCars = filterArticles(result, false);
    }
    
    // 按时间戳排序
    myCars = sortByKey(myCars, "shijianchuo", "desc");
    
    // 分割数组并生成HTML
    var slides = [];
    for (var i = 0; i < 3; i++) {
        var start = i * 15;
        var end = start + 15;
        var slideData = myCars.slice(start, end);
        
        if (slideData.length > 0) {
            slides.push(
                '<div class="swiper-slide"><ul class="new-post">' + 
                listtimechuli(slideData) + 
                '</ul></div>'
            );
        }
    }
    
    // 如果有结果则显示
    if (slides.length > 0) {
        var addbiaoqian = biaoqian ? "（" + biaoqian + "）" : "";
        var jieguo = [
            '<div class="xiangguan sb mt">',
            '<div class="clearfix">',
            '<div class="mianbaoxie">猜你还会喜欢' + addbiaoqian + '</div>',
            '<div class="swiper"><div class="swiper-wrapper">',
            slides.join(''),
            '</div></div>',
            '</div></div>'
        ].join('');
        
        $("#mainbox").append(jieguo);
        
        // 初始化Swiper
        try {
            var mySwiper = new Swiper('.xiangguan .swiper', {
                autoHeight: true
            });
        } catch (e) {
            console.error('Swiper初始化失败:', e);
        }
        
        list_red(redstr, "xiangguan");
    }
}


function guesslike(netkaiguan, shuliang, redstr, pingbifenlei, pingbilouzhu, zhanxianlouzhu, pingbilouzhuplus,
    pingbibiaoti, zhanxianbiaoti, pingbibiaotiplus, pingbineirong, zhanxianneirong, pingbineirongplus, pingbitime) {
    
    var $articleButton = $("#article-button");
    if ($articleButton.length === 0) return;
    
    var biaoqian = $articleButton.data("biaoqian");
    var artid = $articleButton.data("id");
    
    // 检查本地缓存支持
    if (typeof lscache !== 'undefined' && lscache.supported()) {
        // 尝试从缓存获取
        var cachedResult = lscache.get("guesslike");
        if (cachedResult) {
            guesslikechuli(cachedResult, shuliang, biaoqian, artid, redstr, pingbifenlei, pingbilouzhu, zhanxianlouzhu,
                pingbilouzhuplus, pingbibiaoti, zhanxianbiaoti, pingbibiaotiplus, pingbineirong, zhanxianneirong,
                pingbineirongplus, pingbitime);
            return;
        }
        
        // 网络请求
        if (netkaiguan === "on") {
            $.ajax({
                url: "/plus/json/rank/guesslike.json",
                dataType: "json",
                success: function(result) {
                    lscache.set("guesslike", result, 60 * 30);
                    guesslikechuli(result, shuliang, biaoqian, artid, redstr, pingbifenlei, pingbilouzhu,
                        zhanxianlouzhu, pingbilouzhuplus, pingbibiaoti, zhanxianbiaoti, pingbibiaotiplus,
                        pingbineirong, zhanxianneirong, pingbineirongplus, pingbitime);
                },
                error: function(xhr, status, error) {
                    console.error("猜你喜欢数据请求失败:", status, error);
                }
            });
        } else {
            // 高峰时间提示
            var gaofeng = [
                '<div class="xiangguan sb mt">',
                '<div class="clearfix">',
                '<div class="mianbaoxie">高峰时间非会员猜你喜欢暂停输出</div>',
                '</div></div>'
            ].join('');
            $("#mainbox").append(gaofeng);
        }
    } else {
        console.warn("浏览器不支持本地存储，猜你喜欢功能受限");
    }
}


// function liebiaoshaixuan(pingbifenlei,pingbilouzhu,zhanxianlouzhu,pingbilouzhuplus,pingbibiaoti,zhanxianbiaoti,pingbibiaotiplus,pingbineirong,zhanxianneirong,pingbineirongplus,pingbitime){$("#mainbox .new-post .article-list:not(.top) .title a").each(function(){var shuzhu=[];shuzhu.catename=$(this).data("catename").toString();shuzhu.louzhu=$(this).data("louzhu").toString();shuzhu.louzhuregtime=$(this).data("louzhuregtime");shuzhu.title=$(this).text().toString();shuzhu.content=$(this).data("content").toString();if(listfilter(shuzhu,pingbifenlei,pingbilouzhu,zhanxianlouzhu,pingbilouzhuplus,pingbibiaoti,zhanxianbiaoti,pingbibiaotiplus,pingbineirong,zhanxianneirong,pingbineirongplus,pingbitime)==false){$(this).parent().parent().remove()}})}


function liebiaoshaixuan(
    pingbifenlei, 
    pingbilouzhu, 
    zhanxianlouzhu, 
    pingbilouzhuplus, 
    pingbibiaoti, 
    zhanxianbiaoti, 
    pingbibiaotiplus, 
    pingbineirong, 
    zhanxianneirong, 
    pingbineirongplus, 
    pingbitime
) {
    $("#mainbox .new-post .article-list:not(.top) .title a").each(function() {
        var $thisElement = $(this); // 缓存 jQuery 对象，提高性能

        // 安全地获取 data 属性和文本，并提供默认值
        var shuzhu = {
            catename: ($thisElement.data("catename") || '').toString(),
            louzhu: ($thisElement.data("louzhu") || '').toString(),
            louzhuregtime: $thisElement.data("louzhuregtime"), // 这个不转字符串，保留原始类型
            title: ($thisElement.text() || '').toString(), // 虽然 text() 很少返回 undefined，但保险起见
            content: ($thisElement.data("content") || '').toString()
        };

        // 假设 listfilter 函数需要这些参数
        if (listfilter(
            shuzhu, 
            pingbifenlei, 
            pingbilouzhu, 
            zhanxianlouzhu, 
            pingbilouzhuplus, 
            pingbibiaoti, 
            zhanxianbiaoti, 
            pingbibiaotiplus, 
            pingbineirong, 
            zhanxianneirong, 
            pingbineirongplus, 
            pingbitime
        ) === false) {
            // 移除包含此链接的整个项目
            $thisElement.closest('.title').closest('li').remove(); // 或者根据实际HTML结构调整
        }
    });
}

function haodan_shaixuan(pingbifenlei,pingbi,zhanxian,pingbiplus){$(".tipoff-box .haodan-list").each(function(){var shuzhu=[];shuzhu.catename=$(this).find('.right').data('catename');shuzhu.title=$(this).find('.right').text();if(listfilter(shuzhu,pingbifenlei,"","","",pingbi,zhanxian,pingbiplus,"","","","")==false){$(this).remove()}});$container=$('.tipoff-list');$container.masonry('reloadItems');$container.masonry({itemSelector:'.haodan-list',isAnimated:true,isFitWidth:true,isResizable:true,columnWidth:0}).masonry('layout')}
function huanyuanurl(){$(".new-post .article-list:has(.cg18)").each(function(){var yuanurl=$(this).find("a").data("yuanurl");if(yuanurl){$(this).find("a").attr("href",yuanurl)}})};
function list_red(a,quyu){if(quyu=="list"){yuansu="#mainbox .listbox .new-post a"}else if(quyu=="bangdan"){yuansu=".celan .bangdan .new-post a"}else if(quyu=="xiangguan"){yuansu=".xiangguan .new-post a"}else if(quyu=="smartart"){yuansu=".smartart .new-post a"}else{return}var seach_redarr=a.split("|");$(yuansu).each(function(){var text=$(this).text();for(j=0;j<seach_redarr.length;j++){if(seach_redarr[j]){text=text.replace(new RegExp(seach_redarr[j],"g"),'<span style="color: red;font-weight:bold;">'+seach_redarr[j]+"</span>")}}$(this).html(text)})}
function haodan_red(a){var seach_redarr=a.split("|");$(".haodan-list .detail-block li").each(function(){if($(this).html().match(new RegExp(/button/),"g")){}else{var text=$(this).text();for(j=0;j<seach_redarr.length;j++){if(seach_redarr[j]){text=text.replace(new RegExp(seach_redarr[j],"g"),'<span style="color: red;font-weight:bold;">'+seach_redarr[j]+"</span>")}}$(this).html(text)}})}
$(function () {
    if (window.location.href.indexOf("search.php") > 0) {
        if (getQueryVariable("cate") == "haodan") {
            haodan_red(getQueryVariable("q"))
        } else {
            let keywords = new Set();
            $('.article-list a em').each(function () {
                    keywords.add($(this).text());
            });
            
            let uniqueKeywords = Array.from(keywords).join('|');
            if (uniqueKeywords) {
                $(".listbox .new-post a").each(function () {
                    $(this).attr("href", $(this).attr("href") + "?key_red=" + uniqueKeywords)
                })
            }
        }
    }
})
function update(Article_ID){var index=layer.load();$.get("/plus/api/update.php?act=shoudong&wzid="+Article_ID,function(data,status){layer.close(index);layer.msg(data)});}
function zkb_password_tijiao(Article_ID){var index=layer.load();var zkbinput=$("#zkb_password_input").val();$(".zkb_password_box").remove();$.get("/plus/api/update.php?act=zkbmima&state=post&zkb_password="+zkbinput+"&wzid="+Article_ID,function(data,status){layer.close(index);layer.msg(data)});update(Article_ID)};
function add0(m) {return m < 10 ? '0' + m : m};
$(function () {
    // 缓存常用选择器和路径
    const $breadcrumbLink = $(".mianbaoxie a").eq(1);
    const currentPath = window.location.pathname;
    const currentSearch = window.location.search;
    const dangurl = $breadcrumbLink.attr("href");
    
    // 定义分类映射关系
    const categoryMap = {
        "xianbaoku": [
            "/guanyu.html", "/mianze.html", "/guanggao.html", "/tougao.html",
            "/category-xianbaoku/", "/category-jiaocheng/", "/category-gonggao/", "/category-guidang/"
        ],
        "guanzhu": [
            "/category-guanzhu1/","/category-guanzhu2/","/category-guanzhu3/"
        ],
        "zuankeba": [
            "/category-zuankeba/", "/zuankeba-hot.html"
        ],
        "xinzuanba": [
            "/category-xinzuanba/", "/xinzuanba-hot.html"
        ],
        "haodan": [
            // 动态检查包含"haodan"
        ],
        "zhidemai": [
            "/zhidemai-hot.html"
            // 动态检查包含"zhidemai"
        ],
        "douban": [
            "/category-douban/", "/category-douban-maizu/", "/category-douban-pinzu/",
            "/category-douban-fazu/", "/category-douban-maolife/", "/category-douban-maobathtub/",
            "/category-douban-gouzu/", "/douban-hot.html"
        ],
        "weibo": [
            "/weibo-hot.html"
            // 动态检查包含"weibo"
        ],
        "xiaodigu": [
            "/category-xiaodigu/"
        ],
        "smzdm": [
            "/category-smzdm"
        ],
        "kuan": [
            "/category-kuan/"
        ],
        "qita": [
            "/category-huluxia/", "/category-huizong/", "/category-zuixin/",
            "/category-xiaodao/", "/category-iqnew/", "/category-qqjishu/",
            "/category-yyok/", "/category-huodong/", "/category-mianfei/"
        ]
    };

    // 检查路径是否匹配
    function checkPath(category) {
        const paths = categoryMap[category];
        if (!paths) return false;
        
        // 静态路径检查
        if (paths.some(path => currentPath === path || dangurl === path)) {
            return true;
        }
        
        // 动态路径检查
        if (category === "haodan" && (currentPath.includes("haodan") || currentSearch.includes("cate=haodan"))) {
            return true;
        }
        if (category === "zhidemai" && (currentPath.includes("zhidemai") || currentSearch.includes("cate=19"))) {
            return true;
        }
        if (category === "weibo" && dangurl && dangurl.includes("weibo")) {
            return true;
        }
        
        return false;
    }

    // 确定激活的导航项
    let activeCategory = null;
    for (const category in categoryMap) {
        if (checkPath(category)) {
            activeCategory = category;
            break;
        }
    }

    // 设置active类
    if (activeCategory) {
        $(`#navbar-category-${activeCategory}`).addClass("active");
    } else if ($(".pc-nav").attr("data-pagealias")) {
        $("#navbar-page-paihangbang").addClass("active");
    } else {
        $("#nvabar-item-index").addClass("active");
    }
});

function tuisongswitch(){if(typeof(Worker)=="undefined"){layer.msg("当前浏览器不支持Worker：请更换/升级浏览器或者使用扩展插件，解决方案打开用户中心--推送设置--疑难解答");return}if(window.shuaswitch!="on"&&window.shenhe!="off"){layer.msg("用户中心未开启实时线报请求开关！");return}if(window.tuisongkaiguan!="on"){window.tuisongkaiguan="on";document.title="【监控推送中】"+document.title;layer.msg("线报推送开启成功");$(".tuisongswitch").text("监控推送中")}}

function htmlToMarkdown(shuju) {
  let html = shuju.content_html?shuju.content_html:'';

  // 1. 替换标题
  html = html.replace(/<h([1-6])>(.*?)<\/h\1>/gi, function(match, level, content){
    return '#'.repeat(level) + ' ' + content + '\\n\\n';
  });

  // 2. 替换链接
  html = html.replace(/<a\s+href="(.*?)".*?>(.*?)<\/a>/gi, '[$2]($1)');

  // 3. 替换图片（并在图片前后加换行）
  html = html.replace(/<img[^>]+src="([^"]+)"[^>]*alt="([^"]*)"[^>]*>/gi, '\\n\\n![$2]($1)\\n\\n');
  html = html.replace(/<img[^>]+src="([^"]+)"[^>]*>/gi, '\n\n![]($1)\\n\\n');

  // 4. 处理换行（<br> 替换为 \n\n）
  html = html.replace(/<br\s*\/?>/gi, '\\n\\n');

  // 5. 替换 <p> 为两个换行（Markdown 段落）
  html = html.replace(/<p[^>]*>/gi, '\\n\\n');
  html = html.replace(/<\/p>/gi, '\\n\\n');

  // 6. 移除其他 HTML 标签但保留内容
  html = html.replace(/<[^>]+>/g, '');

  // 7. 整理多余的空行（3个以上换行 → 2个换行）
  html = html.replace(/\n{3,}/g, '\\n\\n');

  // 8. 添加原文链接（前后加空行）
  html = `${html}\\n\\n原文链接：[${shuju.url}](${shuju.url})`;

  return html.trim();
}

function tuisong_replace(text, shuju) {
    if(shuju.category_name){
    shuju.catename = shuju.category_name;
    }
    if (shuju.posttime) {
        let posttime = new Date(shuju.posttime * 1000);
        shuju.datetime = `${posttime.getFullYear()}-${add0(posttime.getMonth() + 1)}-${add0(posttime.getDate())}`;
        shuju.shorttime = `${posttime.getHours()}:${add0(posttime.getMinutes())}`;
    }
    
    content_html=`${shuju.content_html}<br>&nbsp;<br>&nbsp;<br>原文链接：<a href="${shuju.url}" target="_blank">${shuju.url}</a><br>&nbsp;<br>&nbsp;<br>&`;
    content_html=content_html.split('"').join('\\"');
    
    const replacements = {
        '{标题}': shuju.title,
        '{正文}': shuju.content,
        '{内容}': shuju.content,
        '{Html内容}': content_html,
        '{Markdown内容}': htmlToMarkdown(shuju),
        '{分类名}': shuju.catename,
        '{分类ID}': shuju.cateid,
        '{链接}': shuju.url,
        '{日期}': shuju.datetime,
        '{时间}': shuju.shorttime,
        '{楼主}': shuju.louzhu,
        '{类目}': shuju.category_name,
        '{价格}': shuju.price,
        '{商城}': shuju.mall_name,
        '{品牌}': shuju.brand,
        '{图片}': shuju.pic
    };
    
    for (const [key, value] of Object.entries(replacements)) {
        if (value !== undefined) {
            text = text.replace(new RegExp(key, 'g'), value);
        } else {
            text = text.replace(new RegExp(key, 'g'), '');
        }
    }

    return text;
}

function tuisong_tihuan(text,config){if(config.includes("###")){var configarr=config.split("<br>");for(var j=0;j<configarr.length;j++){var xiaoconfigarr=configarr[j].split("###");var regex=new RegExp(xiaoconfigarr[0],"g");text=text.replace(regex,xiaoconfigarr[1])}}return text}
zbp.plugin.unbind("comment.reply.start","system-default");zbp.plugin.on("comment.reply.start","suiran_air",function(i){$("#inpRevID").val(i);var replydata=$("#AjaxComment"+i).parent().parent().html();var newdata=replydata.match(/<a class="author"([^>]*)>([^<]*)<([\s\S]*?)<div class="p">(.*?)<label/);var name=newdata[2];var connect=newdata[4].replace(/(\s*)<a([^>]*)class="comment-at"([^>]*)>([^<]*)<\/a>(\s*)/ig,"");$("#com-tishi").html("正在回复："+name+" ( "+connect+" )");$("#cancel-reply").show().bind("click",function(){$("#com-tishi").html("欢迎您发表评论：");$("#inpRevID").val(0);$("#cancel-reply").hide();window.location.hash="#commentbox";return false})});zbp.plugin.on("comment.post.success","suiran_air",function(t,e,n,o){$("#com-tishi").html("欢迎您发表评论：");var inprevid=$("#inpRevID").val();if(inprevid>0){var adddata=$("#AjaxComment"+inprevid).next().prop("outerHTML")+$("#AjaxComment"+inprevid).next().next().prop("outerHTML");$("#AjaxComment"+inprevid).next().next().remove();$("#AjaxComment"+inprevid).next().remove();$("#AjaxComment"+inprevid).parent().parent().parent().after(adddata);window.location.hash="#cmt"+inprevid}else{window.location.hash="#commentbox"}$("#inpRevID").val(0);$("#cancel-reply").hide();$(".comment-list").show();$(".art-comment-content .clbody").each(function(index,element){$(this).html($(this).html().replace(/\[s-(.*?)\]/ig,"<img  class=\"expression\" src=\"/zb_users/theme/xianbao_theme/image/expression/$1.png\" />"));$(this).html($(this).html().replace(/\[img\]*(.*?)\[\/img\]/ig,'<a href="$1" data-fancybox="images" target="_blank" title="查看大图"><img src="$1"/></a>'))})});
$(function(){var f=$(".responsive-nav");$(".m-nav-btn i").click(function(){$(".sub-nav").toggleClass("m-sub-nav");if($('.responsive-nav .m-nav').hasClass('pc-nav')){$(".m-nav-btn i.iconfont").css("position","fixed");$(".responsive-nav").addClass("show");$(".responsive-nav .m-nav").removeClass("pc-nav")}else{$(".m-nav-btn i.iconfont").css("position","absolute");$(".responsive-nav .m-nav").addClass("pc-nav");$(".responsive-nav").removeClass("show")}})});
$(function(){jQuery(".m-nav .nav-ul > li,.m-nav .nav-ul > li ul li").each(function(){jQuery(this).children(".m-nav .m-sub-nav").not(".active").css("display","none");jQuery(this).children(".m-nav .toggle-btn").bind("click",function(){$(".m-nav .m-sub-nav").addClass("active");jQuery(this).children().addClass(function(){if(jQuery(this).hasClass("active")){jQuery(this).removeClass("active");return""}return"active"});jQuery(this).siblings(".m-nav .m-sub-nav").slideToggle()})})});
$(function(){var f=$(".pc-nav").attr("data-type");$(".m-nav-btn i").click(function(){$(".m-nav-btn i").toggleClass("active");})});
$(function(){$("#search-button").click(function(){$("#search-button i").toggleClass("icon-close"),$("#search-button i").toggleClass("icon-search"),$("#mask-hidden").toggleClass("mask-show"),$("#search-area").fadeToggle("fast")})});
$(function(){var f=$("#flink a");f.addClass("iconfont icon-link")});
$(function () {
    // 表情面板显示控制
    $(".smilebg").on('mouseleave', function () {
        $(this).slideUp(200);
    });

    // 表情数据
    const emojis = [
        {alt: "[微笑]", name: "weixiao"}, {alt: "[害羞]", name: "haixiu"}, 
        {alt: "[眨眼睛]", name: "zhayanjing"}, {alt: "[晕]", name: "yun"},
        {alt: "[衰]", name: "shuai"}, {alt: "[闭嘴]", name: "bizhui"},
        {alt: "[机智]", name: "jizhi"}, {alt: "[求关注]", name: "qiuguanzhu"},
        {alt: "[指你]", name: "zhini"}, {alt: "[耶]", name: "ye"},
        {alt: "[捂脸]", name: "wulian"}, {alt: "[色]", name: "se"},
        {alt: "[打脸]", name: "dalian"}, {alt: "[憨笑]", name: "hanxiao"},
        {alt: "[哈欠]", name: "haqian"}, {alt: "[惊恐]", name: "jingkong"},
        {alt: "[爱心]", name: "aixin"}, {alt: "[盯着]", name: "dingzhe"},
        {alt: "[想哭]", name: "xiangku"}, {alt: "[鼓掌]", name: "guzhang"},
        {alt: "[发呆]", name: "fadai"}, {alt: "[偷笑]", name: "touxiao"},
        {alt: "[石化]", name: "shihua"}, {alt: "[坏笑]", name: "huaixiao"},
        {alt: "[抓狂]", name: "zhuakuang"}, {alt: "[流泪]", name: "liulei"},
        {alt: "[想钱]", name: "xiangqian"}, {alt: "[亲亲]", name: "qinqin"},
        {alt: "[笑哭]", name: "xiaoku"}, {alt: "[哭笑不得]", name: "kuxiaobude"},
        {alt: "[张嘴色]", name: "zhangzhuise"}, {alt: "[大哭]", name: "daku"},
        {alt: "[恐惧]", name: "kongju"}, {alt: "[笑眯眯]", name: "xiaomimi"},
        {alt: "[哭兮兮]", name: "kuxixi"}, {alt: "[抠鼻]", name: "koubi"},
        {alt: "[白眼]", name: "baiyan"}, {alt: "[互粉]", name: "hufen"},
        {alt: "[自责]", name: "zhize"}, {alt: "[鄙视]", name: "bishi"},
        {alt: "[大亲]", name: "daqin"}, {alt: "[露牙笑]", name: "louyaxiao"},
        {alt: "[呲牙]", name: "ciya"}, {alt: "[思考]", name: "shikao"},
        {alt: "[滑稽]", name: "huaji"}, {alt: "[吐血]", name: "tuxue"},
        {alt: "[虚]", name: "xu"}, {alt: "[墨镜笑]", name: "mojingxiao"},
        {alt: "[吓]", name: "xia"}, {alt: "[可怜]", name: "kelian"},
        {alt: "[口罩]", name: "kouzhao"}, {alt: "[睡]", name: "shui"},
        {alt: "[再见]", name: "zaijian"}, {alt: "[鸭嘴]", name: "yazhui"},
        {alt: "[发怒]", name: "fanu"}, {alt: "[黑脸]", name: "heilian"},
        {alt: "[狗头]", name: "goutou"}, {alt: "[黄狗头]", name: "huangtougou"},
        {alt: "[灰狗头]", name: "huigoutou"}, {alt: "[呆狗头]", name: "daigoutou"},
        {alt: "[炸弹]", name: "zadan"}, {alt: "[玫瑰花]", name: "meiguihua"},
        {alt: "[唇]", name: "chen"}, {alt: "[去污粉]", name: "quwufen"},
        {alt: "[黄瓜]", name: "huanggua"}, {alt: "[666]", name: "666"},
        {alt: "[啤酒]", name: "pijiu"}, {alt: "[赞]", name: "zan"},
        {alt: "[握手]", name: "woshou"}, {alt: "[祈祷]", name: "qidao"},
        {alt: "[吐彩虹]", name: "tucaihong"}, {alt: "[吃瓜]", name: "chigua"},
        {alt: "[亲嘴]", name: "qinzhui"}, {alt: "[调皮]", name: "tiaopi"},
        {alt: "[吐]", name: "tu"}, {alt: "[心]", name: "xin"},
        {alt: "[心碎]", name: "xinshui"}, {alt: "[屎]", name: "shi"},
        {alt: "[礼盒]", name: "lihe"}, {alt: "[蛋糕]", name: "dangao"},
        {alt: "[礼炮]", name: "lipao"}, {alt: "[刀]", name: "dao"},
        {alt: "[18禁]", name: "18jin"}, {alt: "[给力]", name: "geili"},
        {alt: "[亮眼]", name: "liangyan"}, {alt: "[小笑]", name: "xiaoxiao"},
        {alt: "[大汗]", name: "dahan"}, {alt: "[小眼]", name: "xiaoyan"},
        {alt: "[大赞]", name: "dazan"}, {alt: "[擦汗]", name: "chahan"},
        {alt: "[墨镜]", name: "mojin"}, {alt: "[吸烟]", name: "xiyan"},
        {alt: "[卖萌]", name: "maimeng"}, {alt: "[摸头]", name: "motou"},
        {alt: "[敲头]", name: "qiaotou"}, {alt: "[嗅大了]", name: "xiudale"},
        {alt: "[奋斗]", name: "fendou"}, {alt: "[绿帽]", name: "lvmao"}
    ];

    // 生成表情HTML - 使用传统for循环和字符串拼接
    var emojisHTML = '';
    for (var i = 0; i < emojis.length; i++) {
        var emoji = emojis[i];
        emojisHTML += '<a href="javascript:grin(\'[s-' + emoji.name + ']\')" title="' +
                     emoji.alt + '"><img src="/zb_users/theme/xianbao_theme/image/expression/' + 
                     emoji.name + '.png" alt="' + emoji.alt + '"/></a>';
    }

    // 插入表情HTML
    $(".compost .arrow").after(emojisHTML);
});

function tool_img(){layer.prompt({formType:0,title:'请输入网络图片链接',value:'',area:['300px','70px'],btn:['确认','打开图床','取消'],btn2:function(index,elem){var value=$('#layui-layer'+index+" .layui-layer-input").val();layer.msg("正在打开图床，上传图片获取直链后粘贴进输入框");window.open("https://www.hualigs.cn/");return false},btnAlign:'c',},function(value,index,elem){if((value.indexOf("http")!=-1)&&(value.indexOf(".jpg")!=-1||value.indexOf(".jpeg")!=-1||value.indexOf(".gif")!=-1||value.indexOf(".png")!=-1)){document.getElementById('txaArticle').value=document.getElementById('txaArticle').value+'[img]'+value+'[/img]';layer.close(index)}else{layer.msg("请输入正确的图片链接")}})}
function tool_bq(){if($('.smilebg').css('display')=='none'){$('.smilebg').slideDown(200)}else{$('.smilebg').slideUp(200)}}
function grin(tag){var myField;tag=''+tag+'';if(document.getElementById('txaArticle')&&document.getElementById('txaArticle').type=='textarea'){myField=document.getElementById('txaArticle')}else{return false}if(document.selection){myField.focus();sel=document.selection.createRange();sel.text=tag;myField.focus()}else if(myField.selectionStart||myField.selectionStart=='0'){var startPos=myField.selectionStart;var endPos=myField.selectionEnd;var cursorPos=endPos;myField.value=myField.value.substring(0,startPos)+tag+myField.value.substring(endPos,myField.value.length);cursorPos+=tag.length;myField.focus();myField.selectionStart=cursorPos;myField.selectionEnd=cursorPos}else{myField.value+=tag;myField.focus()}$(".smilebg").slideUp(200)}
$(function(){$(".art-comment-content .clbody .p").each(function(index,element){$(this).html($(this).html().replace(/\[S(([1-4]?[0-9])|50)\]/ig,"<img  class=\"expression\" src=\"/zb_users/theme/xianbao_theme/image/face/$1.gif\" />"));$(this).html($(this).html().replace(/\[img\]*(.*?)\[\/img\]/ig,"<a href=\"$1\" data-fancybox=\"images\" target=\"_blank\" title=\"查看大图\"><img src=\"$1\"/></a>"))})});
function daysComputed(time){var oldTimeFormat=new Date(time.replace(/-/g,'/'));var nowDate=new Date();if(nowDate.getTime()-oldTimeFormat.getTime()>0){var times=nowDate.getTime()-oldTimeFormat.getTime();var days=parseInt(times/(60*60*24*1000));return days}else{return 0}}
function getTime(timestamp){var date=new Date(timestamp*1000);let Y=date.getFullYear(),M=(date.getMonth()+1<10?'0'+(date.getMonth()+1):date.getMonth()+1),D=(date.getDate()<10?'0'+(date.getDate()):date.getDate()),h=(date.getHours()<10?'0'+(date.getHours()):date.getHours()),m=(date.getMinutes()<10?'0'+(date.getMinutes()):date.getMinutes()),s=(date.getSeconds()<10?'0'+(date.getSeconds()):date.getSeconds());return Y+'-'+M+'-'+D+' '+h+':'+m+':'+s}
$(function(){if($("#dianping").length){$("#dianping .comment-list .title").append('<span class="fr pinglunshunxu noselect" onclick="javascript:pinglunshunxu();">↹&nbsp;顺序</span>')}else{$("#comment .comment-list .title").append('<span class="fr pinglunshunxu noselect" onclick="javascript:pinglunshunxu();">↹&nbsp;顺序</span>')}})
function pinglunshunxu(){if(window.shunxuping&&window.shunxuping!="on"){window.shunxuping="on";$(".art-fujia-content .comment-list .pinglunshunxu").removeClass("pinglunshunxu-hover")}else{window.shunxuping="off";$(".art-fujia-content .comment-list .pinglunshunxu").addClass("pinglunshunxu-hover")}if($("#dianping").length){var newdianping="";$("#dianping .comment-list .ul").each(function(){newdianping='<div class="'+$(this).attr('class')+'">'+$(this).html()+'</div>'+newdianping;$(this).remove()});$("#dianping .comment-list").append(newdianping)}if($("#comment").length){var newcomment="";$("#comment .comment-list .ul").each(function(){newcomment='<div class="'+$(this).attr('class')+'">'+$(this).html()+'</div>'+newcomment;$(this).remove()});$("#comment .comment-list").append(newcomment)}}
function chakanlouzhu(){if(window.showlouzhu&&window.showlouzhu!="on"){window.showlouzhu="on";$(".art-fujia-content .comment-list .showlouzhu").removeClass("showlouzhu-hover")}else{window.showlouzhu="off";$(".art-fujia-content .comment-list .showlouzhu").addClass("showlouzhu-hover")}$(".art-fujia-content .comment-list .ul").each(function(){var jqObj=$(this);if(window.showlouzhu=="off"){if(!jqObj.has('.level-louzu').length){$(jqObj).addClass("hide")}}else{$(jqObj).removeClass("hide")}})}

function chulilouzhu(mode){if(mode=="自动"){if($("#dianping").length){$("#dianping .comment-list .title").append('<span class="fr showlouzhu noselect showlouzhu-hover">只看楼主</span>')}else{$("#comment .comment-list .title").append('<span class="fr showlouzhu noselect showlouzhu-hover">只看楼主</span>')}chakanlouzhu();setTimeout(function(){$(".art-fujia-content .comment-list .showlouzhu").click(function(){chakanlouzhu()})},50)}else if(mode=="手动"){if($("#dianping").length){$("#dianping .comment-list .title").append('<span class="fr showlouzhu noselect">只看楼主</span>');setTimeout(function(){$(".art-fujia-content .comment-list .showlouzhu").click(function(){chakanlouzhu()})},50)}else{$("#comment .comment-list .title").append('<span class="fr showlouzhu noselect">只看楼主</span>');setTimeout(function(){$(".art-fujia-content .comment-list .showlouzhu").click(function(){chakanlouzhu()})},50)}}}
function pinglunshuchuli(shezhi){pinglunshuarr=shezhi.split("<br>");for(j=0;j<pinglunshuarr.length;j++){xiaopinglunshuarr=pinglunshuarr[j].split("###");if(xiaopinglunshuarr[0]=="列表页"){list_comment("list",xiaopinglunshuarr[1])}else if(xiaopinglunshuarr[0]=="排行榜"){list_comment("bangdan",xiaopinglunshuarr[1])}}}
function list_comment(quyu,yangshi){if(quyu=="list"){yuansu="#mainbox .new-post .article-list:not(.top) .title a"}else if(quyu=="bangdan"){yuansu=".theiaStickySidebar .new-post a"}else if(quyu=="guesslike"){yuansu=".xiangguan .new-post a"}else{return}$(yuansu).each(function(){var jqObj=$(this).parent();if(!jqObj.has('.com').length){var comshu=$(this).data("comments").toString();$(this).before('<span class="badge com"><i class="iconfont icon-comment"></i>'+comshu+'</span>')}})}


function listfilter(group,pingbifenlei,pingbilouzhu,zhanxianlouzhu,pingbilouzhuplus,pingbibiaoti,zhanxianbiaoti,pingbibiaotiplus,pingbineirong,zhanxianneirong,pingbineirongplus,pingbitime){var louzhubaoliu,biaotibaoliu,neirongbaoliu,louzhupingbi,louzhupingbiplus,biaotipingbi,biaotipingbiplus,neirongpingbi,neirongpingbiplus;if(pingbitime&&group.louzhuregtime){if(pingbitime.match(new RegExp(/###/),"g")){pingbitimearr=pingbitime.split("<br>");for(j=0;j<pingbitimearr.length;j++){xiaopingbitimearr=pingbitimearr[j].split("###");if(group.catename.match(new RegExp(xiaopingbitimearr[0],"i"))&&xiaopingbitimearr[1]>daysComputed(group.louzhuregtime)){return false}}}else{if(pingbitime>daysComputed(group.louzhuregtime)){return false}}}if(pingbifenlei&&group.catename){if(group.catename.match(new RegExp(pingbifenlei,"i"))){return false}}if(zhanxianlouzhu&&group.louzhu){if(zhanxianlouzhu.match(new RegExp(/###/),"g")){zhanxianlouzhuarr=zhanxianlouzhu.split("<br>");for(j=0;j<zhanxianlouzhuarr.length;j++){xiaozhanxianlouzhuarr=zhanxianlouzhuarr[j].split("###");if(group.catename.match(new RegExp(xiaozhanxianlouzhuarr[0],"i"))&&group.louzhu.match(new RegExp(xiaozhanxianlouzhuarr[1],"i"))){louzhubaoliu=1}}}else{if(group.louzhu.match(new RegExp(zhanxianlouzhu,"i"))){louzhubaoliu=1}}}if(pingbilouzhu&&group.louzhu&&louzhubaoliu!=1){if(pingbilouzhu.match(new RegExp(/###/),"g")){pingbilouzhuarr=pingbilouzhu.split("<br>");for(j=0;j<pingbilouzhuarr.length;j++){xiaopingbilouzhuarr=pingbilouzhuarr[j].split("###");if(group.catename.match(new RegExp(xiaopingbilouzhuarr[0],"i"))&&group.louzhu.match(new RegExp(xiaopingbilouzhuarr[1],"i"))){louzhupingbi=1}}}else{if(group.louzhu.match(new RegExp(pingbilouzhu,"i"))){louzhupingbi=1}}}if(pingbilouzhuplus&&group.louzhu&&louzhupingbi!=1){if(pingbilouzhuplus.match(new RegExp(/###/),"g")){pingbilouzhuplusarr=pingbilouzhuplus.split("<br>");for(j=0;j<pingbilouzhuplusarr.length;j++){xiaopingbilouzhuplusarr=pingbilouzhuplusarr[j].split("###");if(group.catename.match(new RegExp(xiaopingbilouzhuplusarr[0],"i"))&&group.louzhu.match(new RegExp(xiaopingbilouzhuplusarr[1],"i"))){louzhupingbiplus=1;louzhubaoliu=0}}}else{if(group.louzhu.match(new RegExp(pingbilouzhuplus,"i"))){louzhupingbiplus=1;louzhubaoliu=0}}}if(louzhupingbi==1||louzhupingbiplus==1){return false}if(zhanxianbiaoti&&group.title){if(zhanxianbiaoti.match(new RegExp(/###/),"g")){zhanxianbiaotiarr=zhanxianbiaoti.split("<br>");for(j=0;j<zhanxianbiaotiarr.length;j++){xiaozhanxianbiaotiarr=zhanxianbiaotiarr[j].split("###");if(group.catename.match(new RegExp(xiaozhanxianbiaotiarr[0],"i"))&&group.title.match(new RegExp(xiaozhanxianbiaotiarr[1],"i"))){biaotibaoliu=1}}}else{if(group.title.match(new RegExp(zhanxianbiaoti,"i"))){biaotibaoliu=1}}}if(pingbibiaoti&&group.title&&louzhubaoliu!=1&&biaotibaoliu!=1){if(pingbibiaoti.match(new RegExp(/###/),"g")){pingbibiaotiarr=pingbibiaoti.split("<br>");for(j=0;j<pingbibiaotiarr.length;j++){xiaopingbibiaotiarr=pingbibiaotiarr[j].split("###");if(group.catename.match(new RegExp(xiaopingbibiaotiarr[0],"i"))&&group.title.match(new RegExp(xiaopingbibiaotiarr[1],"i"))){biaotipingbi=1}}}else{if(group.title.match(new RegExp(pingbibiaoti,"i"))){biaotipingbi=1}}}if(pingbibiaotiplus&&group.title&&louzhubaoliu!=1&&biaotipingbi!=1){if(pingbibiaotiplus.match(new RegExp(/###/),"g")){pingbibiaotiplusarr=pingbibiaotiplus.split("<br>");for(j=0;j<pingbibiaotiplusarr.length;j++){xiaopingbibiaotiplusarr=pingbibiaotiplusarr[j].split("###");if(group.catename.match(new RegExp(xiaopingbibiaotiplusarr[0],"i"))&&group.title.match(new RegExp(xiaopingbibiaotiplusarr[1],"i"))){biaotipingbiplus=1;biaotibaoliu=0}}}else{if(group.title.match(new RegExp(pingbibiaotiplus,"i"))){biaotipingbiplus=1;biaotibaoliu=0}}}if(biaotipingbi==1||biaotipingbiplus==1){return false}if(zhanxianneirong&&group.content){if(zhanxianneirong.match(new RegExp(/###/),"g")){zhanxianneirongarr=zhanxianneirong.split("<br>");for(j=0;j<zhanxianneirongarr.length;j++){xiaozhanxianneirongarr=zhanxianneirongarr[j].split("###");if(group.catename.match(new RegExp(xiaozhanxianneirongarr[0],"i"))&&group.content.match(new RegExp(xiaozhanxianneirongarr[1],"i"))){neirongbaoliu=1}}}else{if(group.content.match(new RegExp(zhanxianneirong,"i"))){neirongbaoliu=1}}}if(pingbineirong&&group.content&&louzhubaoliu!=1&&biaotibaoliu!=1&&neirongbaoliu!=1){if(pingbineirong.match(new RegExp(/###/),"g")){pingbineirongarr=pingbineirong.split("<br>");for(j=0;j<pingbineirongarr.length;j++){xiaopingbineirongarr=pingbineirongarr[j].split("###");if(group.catename.match(new RegExp(xiaopingbineirongarr[0],"i"))&&group.content.match(new RegExp(xiaopingbineirongarr[1],"i"))){neirongpingbi=1}}}else{if(group.content.match(new RegExp(pingbineirong,"i"))){neirongpingbi=1}}}if(pingbineirongplus&&group.content&&louzhubaoliu!=1&&biaotibaoliu!=1&&neirongpingbi!=1){if(pingbineirongplus.match(new RegExp(/###/),"g")){pingbineirongplusarr=pingbineirongplus.split("<br>");for(j=0;j<pingbineirongplusarr.length;j++){xiaopingbineirongplusarr=pingbineirongplusarr[j].split("###");if(group.catename.match(new RegExp(xiaopingbineirongplusarr[0],"i"))&&group.content.match(new RegExp(xiaopingbineirongplusarr[1],"i"))){neirongpingbiplus=1;neirongbaoliu=0}}}else{if(group.content.match(new RegExp(pingbineirongplus,"i"))){neirongpingbiplus=1;neirongbaoliu=0}}}if(neirongpingbi==1||neirongpingbiplus==1){return false}return true}

function change_icon(url){var favicon=document.querySelector('link[rel="shortcut icon"]');if(favicon!==null&&url!==null){favicon.href=url}}
function change_title(text){var titlexiugaiarr=text.split("###");var suiji=Math.ceil(Math.random()*titlexiugaiarr.length-1);document.title=titlexiugaiarr[suiji]}
function yuanditiaozhuan(){document.addEventListener('click',function(event){noddy=event.target;while(noddy.nodeName!=="A"&&noddy.nodeName!=="HTML"){noddy=noddy.parentNode}if('href'in noddy&&noddy.href.indexOf('http')!==-1){event.preventDefault();document.location.href=noddy.href}},false)}
function checkAuditTime(beginTime,endTime){var nowDate=new Date();var beginDate=new Date(nowDate);var endDate=new Date(nowDate);var beginIndex=beginTime.lastIndexOf("\:");var beginHour=beginTime.substring(0,beginIndex);var beginMinue=beginTime.substring(beginIndex+1,beginTime.length);beginDate.setHours(beginHour,beginMinue,0,0);var endIndex=endTime.lastIndexOf("\:");var endHour=endTime.substring(0,endIndex);var endMinue=endTime.substring(endIndex+1,endTime.length);endDate.setHours(endHour,endMinue,0,0);return nowDate.getTime()-beginDate.getTime()>=0&&nowDate.getTime()<=endDate.getTime()}
function shenchatime(confing){var tongguo;if(confing.match(new RegExp(/<br>/),"g")){var confingarr=confing.split("<br>");for(j=0;j<confingarr.length;j++){if(confingarr[j].match(new RegExp(/-/),"g")){let conarr=confingarr[j].split("-");if(checkAuditTime(conarr[0],conarr[1])===true){tongguo=1;break}}}}else{if(confing.match(new RegExp(/-/),"g")){let conarr=confing.split("-");if(checkAuditTime(conarr[0],conarr[1])===true){tongguo=1}}}if(tongguo==1){return true}else{return false}}
function getQueryVariable(variable){var query=window.location.search.substring(1);var vars=query.split("&");for(var i=0;i<vars.length;i++){var pair=vars[i].split("=");if(pair[0]==variable){return decodeURIComponent(pair[1])}}return(false)}


function art_red(a) {
    var seach_redarr = a.split("|").filter(Boolean); // 过滤掉空字符串

    // 处理标题
    var titleElement = $(".art-title");
    var titleText = titleElement.html(); // 使用 html() 以保留 HTML 标签

    // 标红标题中的关键词，避免重复处理
    seach_redarr.forEach(function (keyword) {
        // 使用正则表达式，确保不对已经被标红的文本进行处理
        var regex = new RegExp(`(?<!<span[^>]*?>)(?<!<[^>]*)(${keyword})(?!<\/span>)(?![^<]*?>)`, "g");
        titleText = titleText.replace(regex, '<span style="color: red;font-weight:bold;">\$1</span>');
    });
    titleElement.html(titleText);

    // 处理文章内容
    var contentElement = $(".article-content");
    var html = contentElement.html();

    // 保存链接、alt 和 title
    var link_list = [];
    var link_list2 = [];
    var alt_list = [];
    var title_list = [];

    // 替换链接、alt 和 title
    html = html.replace(/<a[^>]*>(.*?)<\/a>/g, function (match) {
        link_list.push(match);
        return "<{link}>";
    });

    html = html.replace(/(http|ftp|https):\/\/[\w\-_]+(\.[\w\-_]+)+([\w\-\.,@?^=%&:/~\+#;]*[\w\-\@?^=%&/~\+#])?/g, function (match) {
        link_list2.push(match);
        return "<{link2}>";
    });

    html = html.replace(/alt="([^"]*)"/g, function (match) {
        alt_list.push(match);
        return "<{alt}>";
    });

    html = html.replace(/title="([^"]*)"/g, function (match) {
        title_list.push(match);
        return "<{title}>";
    });

    // 标红内容中的关键词，避免重复处理
    seach_redarr.forEach(function (keyword) {
        var regex = new RegExp(`(?<!<span[^>]*?>)(?<!<[^>]*)(${keyword})(?!<\/span>)(?![^<]*?>)`, "g");
        html = html.replace(regex, '<span style="color: red;font-weight:bold;">\$1</span>');
    });

    // 恢复链接、alt 和 title
    link_list.forEach(function (link) {
        html = html.replace(/<{link}>/, link);
    });
    
    link_list2.forEach(function (link2) {
        html = html.replace(/<{link2}>/, link2);
    });

    alt_list.forEach(function (alt) {
        html = html.replace(/<{alt}>/, alt);
    });

    title_list.forEach(function (title) {
        html = html.replace(/<{title}>/, title);
    });

    contentElement.html(html);
}


$(function(){var key_red=getQueryVariable("key_red");if(key_red){art_red(key_red)}})
function retiechuli(cars,shuliang,sortkey,pingbifenlei,pingbilouzhu,zhanxianlouzhu,pingbibiaoti,zhanxianbiaoti,pingbineirong,zhanxianneirong,pingbitime){zuanCars=[];var dangqian=0;var bangdingshu=shuliang;$.each(cars,function(i,field){if(listfilter(field,pingbifenlei,pingbilouzhu,zhanxianlouzhu,pingbibiaoti,zhanxianbiaoti,pingbineirong,zhanxianneirong)==false){return true}zuanCars.push(field);dangqian++;if(dangqian==bangdingshu){return false}});if(sortkey!="1"){zuanCars=sortByKey(zuanCars,"shijianchuo","desc")}var adddata=listtimechuli(zuanCars);if(adddata){adddata='<div class="swiper-slide"><ul class="new-post">'+adddata+'</ul></div>';return adddata}}
function retielist(result,config,sortkey,pingbifenlei,pingbilouzhu,zhanxianlouzhu,pingbibiaoti,zhanxianbiaoti,pingbineirong,zhanxianneirong,pingbitime){var zuandata6=retiechuli(result.remen6,30,sortkey,pingbifenlei,pingbilouzhu,zhanxianlouzhu,pingbibiaoti,zhanxianbiaoti,pingbineirong,zhanxianneirong,pingbitime);var zuandata24=retiechuli(result.remen24,30,sortkey,pingbifenlei,pingbilouzhu,zhanxianlouzhu,pingbibiaoti,zhanxianbiaoti,pingbineirong,zhanxianneirong,pingbitime);var zuandata48=retiechuli(result.remen48,30,sortkey,pingbifenlei,pingbilouzhu,zhanxianlouzhu,pingbibiaoti,zhanxianbiaoti,pingbineirong,zhanxianneirong,pingbitime);if(config=="zuankeba-hot"||config=="xinzuanba-hot"){var name="赚吧"}else if(config=="weibo-hot"){name="微博"}else if(config=="douban-hot"){name="豆瓣"}var zuizhong='<div class="mianbaoxie zuankebatabs"><span class="active">'+name+'6小时热帖</span><span>'+name+'24小时热帖</span><span>'+name+'48小时热帖</span></div><div class="listbox"><ul class="retie-post"><div class="swiper zuankebahot"><div class="swiper-wrapper">'+zuandata6+zuandata24+zuandata48+'</div></div></ul></div></div>';$("#mainbox").append(zuizhong);var mySwiper=new Swiper('#mainbox .zuankebahot',{autoHeight:true,on:{slideChange:function(){$("#mainbox .zuankebatabs .active").removeClass('active');$("#mainbox .zuankebatabs span").eq(this.activeIndex).addClass('active')},},});$("#mainbox .zuankebatabs span").on('click',function(e){e.preventDefault();$("#mainbox .zuankebatabs .active").removeClass('active');$(this).addClass('active');mySwiper.slideTo($(this).index())});$("#mainbox .zuankebatabs span").hover(function(e){e.preventDefault();$("#mainbox .zuankebatabs .active").removeClass('active');$(this).addClass('active');mySwiper.slideTo($(this).index())})}
function zdm_retiechuli(cars) {
    zuanCars = [];
    var dangqian = 0;
    var bangdingshu = 40;
    $.each(cars, function (i, field) {
        zuanCars.push(field);
        dangqian++;
        if (dangqian == bangdingshu) {
            return false
        }
    });

    zuanCars = sortByKey(zuanCars, "posttime", "desc")

    var adddata = zdm_listtimechuli(zuanCars);
    if (adddata) {
        adddata = '<div class="swiper-slide"><ul class="new-post">' + adddata + '</ul></div>';
        return adddata
    }
}

function zdm_retielist(result) {
    var zuandata1 = zdm_retiechuli(result.remen1);
    var zuandata3 = zdm_retiechuli(result.remen3);
    var zuandata6 = zdm_retiechuli(result.remen6);

    var zuizhong =
        '<div class="mianbaoxie zuankebatabs"><span class="active">值得买1小时热帖</span><span>值得买3小时热帖</span><span>值得买6小时热帖</span></div><div class="listbox"><ul class="retie-post"><div class="swiper zuankebahot"><div class="swiper-wrapper">' +
        zuandata1 + zuandata3 + zuandata6 + '</div></div></ul></div></div>';
    $("#mainbox").append(zuizhong);
    var mySwiper = new Swiper('#mainbox .zuankebahot', {
        autoHeight: true,
        on: {
            slideChange: function () {
                $("#mainbox .zuankebatabs .active").removeClass('active');
                $("#mainbox .zuankebatabs span").eq(this.activeIndex).addClass('active')
            },
        },
    });
    $("#mainbox .zuankebatabs span").on('click', function (e) {
        e.preventDefault();
        $("#mainbox .zuankebatabs .active").removeClass('active');
        $(this).addClass('active');
        mySwiper.slideTo($(this).index())
    });
    $("#mainbox .zuankebatabs span").hover(function (e) {
        e.preventDefault();
        $("#mainbox .zuankebatabs .active").removeClass('active');
        $(this).addClass('active');
        mySwiper.slideTo($(this).index())
    })
}

function rementie(config, sortkey, pingbifenlei, pingbilouzhu, zhanxianlouzhu, pingbibiaoti, zhanxianbiaoti,
    pingbineirong, zhanxianneirong, pingbitime) {
    if (lscache.supported()) {
        if (lscache.get(config)) {
            result = lscache.get(config);
            if (pingbifenlei == "zhidemai-hot") {
                zdm_retielist(result);
            } else {
                retielist(result, config, sortkey, pingbifenlei, pingbilouzhu, zhanxianlouzhu, pingbibiaoti, zhanxianbiaoti, pingbineirong, zhanxianneirong, pingbitime);
            }
            return
        }
    }
    $.getJSON("/plus/json/rank/" + config + ".json", function (result, status) {
        if (status == "success") {
            lscache.set(config, result, 30 * 60);
            if (pingbifenlei == "zhidemai-hot") {
                zdm_retielist(result);
            } else {
                retielist(result, config, sortkey, pingbifenlei, pingbilouzhu, zhanxianlouzhu, pingbibiaoti, zhanxianbiaoti, pingbineirong, zhanxianneirong, pingbitime);
            }
        }
    })
}
$(function(){var fujia=$(".art-fujia-content").html();if(fujia){var catename=$(".pc-nav").data("catename");fujia=fujia.replace(new RegExp(/<span class="author">(.*?)(<span|<\/span>)/,"g"),'<span class="author"><a href="/record/'+catename+'/$1.html">$1</a>$2');fujia=fujia.replace(new RegExp(/<span class="dianpingming">(.*?)(<span|<\/span>)/,"g"),'<span class="dianpingming"><a href="/record/'+catename+'/$1.html">$1</a>$2');fujia=fujia.replace(new RegExp(/<span class="huifuming">(.*?)(<span|<\/span>)/,"g"),'<span class="huifuming"><a href="/record/'+catename+'/$1.html">$1</a>$2');$(".art-fujia-content").html(fujia)}$(".article-content img").each(function(){if($(this).attr("src").toLowerCase().endsWith(".svg")){return}$(this).attr("data-fancybox","article-img")});$(".art-fujia-content img").each(function(){$(this).attr("data-fancybox","pinglun-img")})});
$(function(){Fancybox.bind("[data-fancybox]",{Toolbar:{display:{left:["infobar"],middle:["zoomIn","zoomOut","toggle1to1","rotateCCW","rotateCW"],right:["thumbs","close"],},},Thumbs:{type:"classic",}})});
// $(function(){if($(".article-content").length>0){var wenzhang=$(".article-content").html();wenzhang=wenzhang.replace(/www.xianbaoku.net/g,document.domain);wenzhang=wenzhang.replace(/v1.xianbao.fun/g,document.domain);wenzhang=wenzhang.replace(/v2.xianbao.fun/g,document.domain);wenzhang=wenzhang.replace(/v3.xianbao.fun/g,document.domain);wenzhang=wenzhang.replace(/v4.xianbao.fun/g,document.domain);wenzhang=wenzhang.replace(/new.ixbk.fun/g,document.domain);wenzhang=wenzhang.replace(/new.xianbao.fun/g,document.domain);wenzhang=wenzhang.replace(/new.ixbk.net/g,document.domain);wenzhang=wenzhang.replace(/news.ixbk.fun/g,document.domain);wenzhang=wenzhang.replace(/news.xianbao.fun/g,document.domain);wenzhang=wenzhang.replace(/news.ixbk.net/g,document.domain);}$(".article-content").html(wenzhang);if($(".art-fujia-content").length>0){var fujia=$(".art-fujia-content").html();fujia=fujia.replace(/www.xianbaoku.net/g,document.domain);fujia=fujia.replace(/v1.xianbao.fun/g,document.domain);fujia=fujia.replace(/v2.xianbao.fun/g,document.domain);fujia=fujia.replace(/v3.xianbao.fun/g,document.domain);fujia=fujia.replace(/v4.xianbao.fun/g,document.domain);fujia=fujia.replace(/new.ixbk.fun/g,document.domain);fujia=fujia.replace(/new.xianbao.fun/g,document.domain);fujia=fujia.replace(/news.ixbk.net/g,document.domain);fujia=fujia.replace(/new.ixbk.fun/g,document.domain);fujia=fujia.replace(/news.xianbao.fun/g,document.domain);fujia=fujia.replace(/news.ixbk.net/g,document.domain);$(".art-fujia-content").html(fujia)};$('#qr-img').attr('src', 'https://api.qrserver.com/v1/create-qr-code/?data='+window.location.protocol+'//'+window.location.hostname+$('#qr-img').attr('src'));});
$(function () {
    var currentProtocol = window.location.protocol;
    var currentDomain = document.domain;

    var domainsToReplace = [
        "v1.xianbao.fun",
        "v2.xianbao.fun",
        "v3.xianbao.fun",
        "v4.xianbao.fun",
        "new.ixbk.fun",
        "new.xianbao.fun",
        "new.ixbk.net",
        "news.ixbk.fun",
        "news.xianbao.fun",
        "news.ixbk.net",
        "www.xianbaoku.net"
    ];

    var domainPattern = new RegExp(
        'https?://(' + domainsToReplace.map(function (domain) {
            return domain.replace(/\./g, '\\.');
        }).join('|') + ')',
        'g'
    );
    var noProtocolPattern = new RegExp(
        '(^|\\s)(' + domainsToReplace.map(function (domain) {
            return domain.replace(/\./g, '\\.');
        }).join('|') + ')(\\s|$)',
        'g'
    );

    function replaceDomain(html) {
        html = html.replace(domainPattern, currentProtocol + '//' + currentDomain);
        html = html.replace(noProtocolPattern, '$1' + currentDomain + '$3');
        return html;
    }

    var selectors = [".article-content", ".art-fujia-content"];

    selectors.forEach(function (selector) {
        var element = $(selector);
        if (element.length > 0) {
            element.html(function (_, html) {
                return replaceDomain(html);
            });
        }
    });
    
    $('#qr-img').attr('src', 'https://qrickit.com/api/qr.php?qrsize=200&d=' + window.location.protocol +'//' + window.location.hostname + $('#qr-img').attr('src'));
});
// function listtimechuli(myCars){var yuanurl;var timebiaoqian;var newjinday=new Date();var newzuoday=new Date(newjinday-1000*60*60*24);var jintianday=newjinday.getFullYear()+"-"+add0(newjinday.getMonth()+1)+"-"+add0(newjinday.getDate());var zuotianday=newzuoday.getFullYear()+"-"+add0(newzuoday.getMonth()+1)+"-"+add0(newzuoday.getDate());var zuoriday=add0(newzuoday.getMonth()+1)+"-"+add0(newzuoday.getDate());var jinnianyear=jintianday.substring(0,4);var myCars_data="";$.each(myCars,function(i,field){if(field.cateid==108){yuanurl=' data-yuanurl="'+field.yuanurl+'"'}else{yuanurl=""}if(field.datetime==jintianday){timebiaoqian='<time class="badge red" datetime="'+field.datetime+'" title="'+field.datetime+" "+field.shorttime+'">'+field.shorttime+'</time>'}else if(field.datetime==zuotianday){timebiaoqian='<time class="badge" datetime="'+field.datetime+'" title="'+field.datetime+" "+field.shorttime+'">'+zuoriday+" "+field.shorttime+'</time>'}else if((field.datetime).substring(0,4)==jinnianyear){timebiaoqian='<time class="badge" datetime="'+field.datetime+'" title="'+field.datetime+" "+field.shorttime+'">'+(field.datetime).substring(5,12)+'</time>'}else{timebiaoqian='<time class="badge" datetime="'+field.datetime+'" title="'+field.datetime+" "+field.shorttime+'">'+field.datetime+'</time>'}if(field.title){if(field.cateid=="24"&&field.title.includes('🔒')){}myCars_data=myCars_data+'<li class="article-list"><span class="figure cg'+field.cateid+'"></span><p class="title">'+timebiaoqian+'<span class="badge com"><i class="iconfont icon-comment"></i>'+field.comments+'</span><a href="'+field.url+'" title="'+field.title+'" target="_blank"  data-catename="'+field.catename+'" data-content="'+field.content+'" data-comments="'+field.comments+'" data-louzhu="'+field.louzhu+'"  data-louzhuregtime="'+field.louzhuregtime+'" '+yuanurl+">"+field.title+'</a></p></li>'}});return myCars_data}

function listtimechuli(myCars) {
    const newjinday = new Date(); // 获取当前日期
    const newzuoday = new Date(newjinday - 1000 * 60 * 60 * 24); // 获取昨天的日期
    const jintianday = `${newjinday.getFullYear()}-${add0(newjinday.getMonth() + 1)}-${add0(newjinday.getDate())}`; // 格式化今天的日期
    const zuotianday = `${newzuoday.getFullYear()}-${add0(newzuoday.getMonth() + 1)}-${add0(newzuoday.getDate())}`; // 格式化昨天的日期
    const zuoriday = `${add0(newzuoday.getMonth() + 1)}-${add0(newzuoday.getDate())}`; // 格式化昨天的短日期
    const jinnianyear = jintianday.substring(0, 4); // 获取当前年份

    let myCars_data = ""; // 初始化最终的 HTML 字符串

    $.each(myCars, function (i, field) {
        const yuanurl = field.cateid === 18 && field.yuanurl ? ` data-yuanurl="${field.yuanurl}"` : ''; // 判断是否有原网址

        // 生成时间标签
        let timebiaoqian;
        if (field.datetime === jintianday) {
            timebiaoqian = `<time class="badge red" datetime="${field.datetime}" title="${field.datetime} ${field.shorttime}">${field.shorttime}</time>`;
        } else if (field.datetime === zuotianday) {
            timebiaoqian = `<time class="badge" datetime="${field.datetime}" title="${field.datetime} ${field.shorttime}">${zuoriday} ${field.shorttime}</time>`;
        } else if (typeof field.datetime === 'string' && field.datetime.startsWith(jinnianyear)) {
            timebiaoqian = `<time class="badge" datetime="${field.datetime}" title="${field.datetime} ${field.shorttime}">${field.datetime.substring(5, 12)}</time>`;
        } else {
            timebiaoqian = `<time class="badge" datetime="${field.datetime}" title="${field.datetime} ${field.shorttime}">${field.datetime}</time>`;
        }

        
        
        if (field.title) {
            var cleanTitle = field.title.replace(/<\/?em>/gi, ''); 
            
            myCars_data += '<li class="article-list">' +
                '<span class="figure cg' + field.cateid + '"></span>' +
                '<p class="title">' +
                    timebiaoqian +
                    '<span class="badge com">' +
                        '<i class="iconfont icon-comment"></i>' + field.comments +
                    '</span>' +
                    '<a href="' + field.url + '" title="' + cleanTitle + '" target="_blank" ' +
                      'data-catename="' + field.catename + '" data-content="' + field.content + '" ' +
                      'data-comments="' + field.comments + '" data-louzhu="' + field.louzhu + '" ' +
                      'data-louzhuregtime="' + field.louzhuregtime + '"' + yuanurl + '>' +
                        field.title +
                    '</a>' +
                '</p>' +
            '</li>';
        }
    });

    return myCars_data;
}


function zdm_listtimechuli(myCars) {
    const newjinday = new Date(); // 获取当前日期
    const newzuoday = new Date(newjinday - 1000 * 60 * 60 * 24); // 获取昨天的日期
    const jintianday = `${newjinday.getFullYear()}-${add0(newjinday.getMonth() + 1)}-${add0(newjinday.getDate())}`; // 格式化今天的日期
    const zuotianday =`${newzuoday.getFullYear()}-${add0(newzuoday.getMonth() + 1)}-${add0(newzuoday.getDate())}`; // 格式化昨天的日期
    const zuoriday = `${add0(newzuoday.getMonth() + 1)}-${add0(newzuoday.getDate())}`; // 格式化昨天的短日期
    const jinnianyear = jintianday.substring(0, 4); // 获取当前年份

    let myCars_data = ""; // 初始化最终的 HTML 字符串

    $.each(myCars, function (i, field) {
        // 生成时间标签
        let timebiaoqian;
        let posttime =new Date(field.posttime * 1000);
        field.datetime = `${posttime.getFullYear()}-${add0(posttime.getMonth() + 1)}-${add0(posttime.getDate())}`;
        field.shorttime = `${posttime.getHours()}:${add0(posttime.getMinutes())}`;
        
        if (field.datetime === jintianday) {
            timebiaoqian =
                `<time class="badge red" datetime="${field.datetime}" title="${field.datetime} ${field.shorttime}">${field.shorttime}</time>`;
        } else if (field.datetime === zuotianday) {
            timebiaoqian =
                `<time class="badge" datetime="${field.datetime}" title="${field.datetime} ${field.shorttime}">${zuoriday} ${field.shorttime}</time>`;
        } else if (typeof field.datetime === 'string' && field.datetime.startsWith(jinnianyear)) {
            timebiaoqian =
                `<time class="badge" datetime="${field.datetime}" title="${field.datetime} ${field.shorttime}">${field.datetime.substring(5, 12)}</time>`;
        } else {
            timebiaoqian =
                `<time class="badge" datetime="${field.datetime}" title="${field.datetime} ${field.shorttime}">${field.datetime}</time>`;
        }



        if (field.title) {
            myCars_data += '<li class="article-list">' +
                '<span class="figure cg19"></span>' +
                '<p class="title">' + timebiaoqian +
                '<span class="badge com">' +
                '<i class="iconfont icon-RMB"></i>' + field.price +
                '</span>' +
                '<a href="' + field.url + '" title="' + field.title + '" target="_blank" ' +
                'data-type="' + field.type + '" ' +
                'data-brand="' + field.brand + '" ' +
                'data-mall_name="' + field.mall_name + '" ' +
                'data-category_name="' + field.category_name + '" ' +
                'data-price="' + field.price + '">' + field.title +
                '</a>' +
                '</p>' +
                '</li>';
        }

    });

    return myCars_data;
}

function encodeUnicode(str){var res=[];for(var i=0;i<str.length;i++){res[i]=("00"+str.charCodeAt(i).toString(16)).slice(-4)}var jieguo="\\u"+res.join("\\u");var reg=/\\u00a\\u00a/g;return jieguo.replace(reg,"\u005c\u0072\u005c\u006e");return jieguo};
function sortByKey(arr,key,order){for(i=0;i<arr.length;i++){for(j=i+1;j<arr.length;j++){if(order=="desc"){if(parseFloat(arr[i][key])<=parseFloat(arr[j][key])){var min=arr[i];arr[i]=arr[j];arr[j]=min}}else{if(parseFloat(arr[i][key])>=parseFloat(arr[j][key])){var max=arr[i];arr[i]=arr[j];arr[j]=max}}}}return arr};
$(function() {
    if ($(".article-content").length > 0) {
        let clipboard = new ClipboardJS('.mochu-us-copy', {
            text: function() {
                var arttext = $("#mainbox .article-content").html();
                arttext = arttext.replace(/<h(\d+)>/gi, "<p>");
                arttext = arttext.replace(/<\/h(\d+)>/gi, "</p>");
                arttext = arttext.replace(/<p(.*?)>/gi, "\n\n<p$1>");
                arttext = arttext.replace(/<\/p><p(.*?)>/g, "</p>\n\n<p$1>");
                arttext = arttext.replace(/<\/p><a(.*?)>/g, "</p>\n\n<a$1>");
                arttext = arttext.replace(/<p(.*?)>/gi, "");
                arttext = arttext.replace(/<\/p>/gi, "");
                arttext = arttext.replace(/<span(.*?)>/gi, "");
                arttext = arttext.replace(/<\/span>/gi, "");
                arttext = arttext.replace(/<strong(.*?)>/gi, "");
                arttext = arttext.replace(/<\/strong>/gi, "");
                arttext = arttext.replace(/<img(.*?)>/gi, "");
                arttext = arttext.replace(/&nbsp;/gi, " ");
                arttext = arttext.replace(/&amp;/gi, "&");
                arttext = arttext.replace(/<div class="guanlian"><div class="g-biaoti">/gi, "\n\n");
                arttext = arttext.replace(/<div class="g-neirong">/gi, "\n\n");
                arttext = arttext.replace(/<a(.*?)href="(.*?)"(.*?)>(.*?)<\/a>/gi, "$2");
                arttext = arttext.replace(/<div(.*?)>/gi, "");
                arttext = arttext.replace(/<\/div>/gi, "");
                arttext = arttext.replace(/<br>/gi, "\n");
                arttext = arttext.replace(/<i(.*?)>(.*?)<\/i>/gi, "");
                arttext = arttext.replace(/\n\n\n\n/gi, "\n\n");
                arttext = arttext.replace(/\n\n\n/gi, "\n\n");
                arttext = arttext.trim();
                console.log(arttext);
                return arttext
            }
        });
        clipboard.on('success', function(e) {
            layer.msg('复制成功')
        });
        clipboard.on('error', function(e) {
            console.error('Action:', e.action);
            console.error('Trigger:', e.trigger);
            layer.msg('复制失败，请手动长按进行复制。')
        })
    }
});
function ksort(o){let sorted={},keys=Object.keys(o);keys.sort();keys.forEach((key)=>{sorted[key]=o[key]});return sorted}
function dataoke_Sign(data,appSecret){data=ksort(data);var str="";for(var Key in data){str=str+'&'+Key+'='+data[Key]}str=str.trim();if(str.substr(0,1)=="&"){str=str.slice(1)}str=$.md5(str+"&key="+appSecret);str=str.toUpperCase();return str}
function http_build_query(data){var houzhui="";for(var Key in data){houzhui=houzhui+'&'+Key+'='+data[Key];if(houzhui.substr(0,1)=="&"){houzhui=houzhui.slice(1)}}return houzhui}
function dtaobaoshangpin(neirong,zhuanlian_config){tzhuanlianhost="https://openapi.dataoke.com/api/tb-service/get-privilege-link";var tzhuanliandata=[];tzhuanliandata['appKey']=zhuanlian_config["taobao_appkey"];tzhuanliandata['version']="1.3.1";tzhuanliandata['goodsId']=neirong;tzhuanliandata['pid']=zhuanlian_config["taobao_pid"];tzhuanliandata['channelId']=zhuanlian_config["taobao_channelid"];tzhuanliandata['authId']=zhuanlian_config["taobao_authid"];tzhuanliandata['sign']=dataoke_Sign(tzhuanliandata,zhuanlian_config["taobao_appSecret"]);tzhuanlianurl=tzhuanlianhost+"?"+http_build_query(tzhuanliandata);var defer=$.Deferred();$.ajax({url:tzhuanlianurl,success:function(data){defer.resolve(data)}});return defer.promise()}
function dtaobaofuchi(neirong,jaw_uid){var defer=$.Deferred();$.ajax({type:"POST",data:"content="+encodeURIComponent(neirong)+"&link_type=18&referer=https%253A%252F%252Fwww.dataoke.com%252Ftools%253Ftype%253D18&new_refer=https%253A%252F%252Fwww.dataoke.com%252Ftools%253Ftype%253D18%2526event_type%253Dclick%2526event_id%253Dtools%2526path%253Dtrans%252Fmultiple%2526project%253Ddtk&jaw_uid="+jaw_uid,url:"https://dtkapi.ffquan.cn/taobaoapi/parse-tb-multiple-new?app_token="+jaw_uid,success:function(data){defer.resolve(data)}});return defer.promise()}
function djingdongshangpin(neirong,zhuanlian_config){jzhuanlianhost="https://openapi.dataoke.com/api/dels/jd/kit/promotion-union-convert";var jzhuanliandata=[];jzhuanliandata['appKey']=zhuanlian_config["jingdong_appkey"];jzhuanliandata['version']="1.0.0";jzhuanliandata['materialId']=neirong;jzhuanliandata['unionId']=zhuanlian_config["jingdong_unionId"];jzhuanliandata['positionId']=zhuanlian_config["jingdong_positionId"];jzhuanliandata['pid']=zhuanlian_config["jingdong_pid"];jzhuanliandata['jdauthid']=zhuanlian_config["jingdong_authid"];jzhuanliandata['sign']=dataoke_Sign(jzhuanliandata,zhuanlian_config["jingdong_appSecret"]);jzhuanlianurl=jzhuanlianhost+"?"+http_build_query(jzhuanliandata);var defer=$.Deferred();$.ajax({url:jzhuanlianurl,success:function(data){defer.resolve(data)}});return defer.promise()}
function dpinpddshangpin(goodsSign,zhuanlian_config){pzhuanlianhost="https://openapi.dataoke.com/api/dels/pdd/kit/goods-prom-generate";var pzhuanliandata=[];pzhuanliandata['appKey']=zhuanlian_config["pingduoduo_appkey"];pzhuanliandata['version']="2.0.0";pzhuanliandata['pid']=zhuanlian_config["pingduoduo_pid"];pzhuanliandata['goodsSign']=goodsSign;pzhuanliandata['pddauthid']=zhuanlian_config["pingduoduo_authid"];pzhuanliandata['sign']=dataoke_Sign(pzhuanliandata,zhuanlian_config["pingduoduo_appSecret"]);pzhuanlianurl=pzhuanlianhost+"?"+http_build_query(pzhuanliandata);var defer=$.Deferred();$.ajax({url:pzhuanlianurl,success:function(data){defer.resolve(data)}});return defer.promise()}
function jianqieban(neirong,appKey,appSecret,zhuanlian_config){shibiehost="https://openapi.dataoke.com/api/dels/kit/contentParse";shibieappKey=appKey;shibieappSecret=appSecret;var shibiedata=[];shibiedata['appKey']=shibieappKey;shibiedata['version']="1.0.0";shibiedata['content']=neirong;shibiedata['TbPid']=zhuanlian_config["taobao_pid"];shibiedata['TbChannelId']=zhuanlian_config["taobao_channelid"];shibiedata['tbAuthId']=zhuanlian_config["taobao_authid"];shibiedata['JdUnionId']=zhuanlian_config["jingdong_unionId"];shibiedata['jdPositionId']=zhuanlian_config["jingdong_positionId"];shibiedata['JdPid']=zhuanlian_config["jingdong_pid"];shibiedata['jdAuthId']=zhuanlian_config["jingdong_authid"];shibiedata['PddPid']=zhuanlian_config["pingduoduo_pid"];shibiedata['pddAuthId']=zhuanlian_config["pingduoduo_authid"];shibiedata['sign']=dataoke_Sign(shibiedata,shibieappSecret);shibieurl=shibiehost+"?"+http_build_query(shibiedata);var defer=$.Deferred();$.ajax({url:shibieurl,success:function(data){defer.resolve(data)}});return defer.promise()}
function ddouyinshangpin(neirong,zhuanlian_config){dzhuanlianhost="https://openapiv2.dataoke.com/open-api/tiktok-kol-product-share";let dzhuanliandata=[];dzhuanliandata['appKey']=zhuanlian_config["douyin_appkey"];dzhuanliandata['appSecret']=zhuanlian_config["douyin_appSecret"];dzhuanliandata['version']="v1.0.0";dzhuanliandata['productUrl']=neirong;dzhuanliandata['externalInfo']="0";dzhuanlianurl=dzhuanlianhost+"?"+http_build_query(dzhuanliandata);var defer=$.Deferred();$.ajax({url:dzhuanlianurl,success:function(data){defer.resolve(data)}});return defer.promise()}
function ddouyinshibie(neirong,zhuanlian_config){dzhuanlianhost="https://openapiv2.dataoke.com/tiktok/tiktok-materials-products-details";let dzhuanliandata=[];dzhuanliandata['appkey']=zhuanlian_config["douyin_appkey"];dzhuanliandata['appSecret']=zhuanlian_config["douyin_appSecret"];dzhuanliandata['version']="v1.0.0";dzhuanliandata['productIds']=neirong;dzhuanlianurl=dzhuanlianhost+"?"+http_build_query(dzhuanliandata);var defer=$.Deferred();$.ajax({url:dzhuanlianurl,success:function(data){defer.resolve(data)}});return defer.promise()}
function rdouyinshangpin(neirong,zhuanlian_config){dzhuanlianhost="https://open.redu.com/service/openapi/product/productShareUrl";let dzhuanliandata=[];dzhuanliandata['appkey']=zhuanlian_config["douyin_appkey"];dzhuanliandata['appSecret']=zhuanlian_config["douyin_appSecret"];dzhuanliandata['version']="V1.0.0";dzhuanliandata['productId']=neirong;dzhuanliandata['needShareLink']=true;dzhuanliandata['externalInfo']="0";dzhuanlianurl=dzhuanlianhost+"?"+http_build_query(dzhuanliandata);var defer=$.Deferred();$.ajax({url:dzhuanlianurl,success:function(data){defer.resolve(data)}});return defer.promise()}
function rdouyinshibie(neirong,zhuanlian_config){dzhuanlianhost="https://open.redu.com/service/openapi/product/queryProductDetail";let dzhuanliandata=[];dzhuanliandata['appkey']=zhuanlian_config["douyin_appkey"];dzhuanliandata['appSecret']=zhuanlian_config["douyin_appSecret"];dzhuanliandata['version']="V1.0.0";dzhuanliandata['productId']=neirong;dzhuanlianurl=dzhuanlianhost+"?"+http_build_query(dzhuanliandata);var defer=$.Deferred();$.ajax({url:dzhuanlianurl,success:function(data){defer.resolve(data)}});return defer.promise()}

function zjingdongshangpin(neirong, zhuanlian_config) {
    jzhuanlianhost = "https://api.zhetaoke.com:10001/api/open_gaoyongzhuanlian_tkl_piliang.ashx";
    var jzhuanliandata = [];
    jzhuanliandata['appkey'] = zhuanlian_config["jingdong_appkey"];
    jzhuanliandata['sid'] = zhuanlian_config["jingdong_appSecret"];
    jzhuanliandata['unionId'] = zhuanlian_config["jingdong_unionId"];
    jzhuanliandata['positionId'] = zhuanlian_config["jingdong_positionId"];
    jzhuanliandata['pid'] = zhuanlian_config["jingdong_pid"] || "mm";
    jzhuanliandata['tkl'] = encodeURIComponent(neirong);
    jzhuanlianurl = jzhuanlianhost + "?" + http_build_query(jzhuanliandata);
    var defer = $.Deferred();
    $.ajax({
        url: jzhuanlianurl,
        success: function (data) {
            defer.resolve(data)
        }
    });
    return defer.promise()
}

function shangpinzhuanlian(yuansu, zhuanlian_config) {
    $(yuansu).find("a").each(function () {
        var bianli = this;
        var zhuanhref = $(bianli).attr("href");
        if (zhuanlian_config["taobao_kaiguan"] == "1") {
            if (zhuanhref.match(RegExp(/taobao.com|tb.cn|taobao.hk|tmall.com|tmall.hk/ig))) {
                if (zhuanlian_config["taobao_method"]) {
                    $.when(dtaobaofuchi(zhuanhref, zhuanlian_config["taobao_method"])).done(function (shibie) {
                        if (shibie.code == 1) {
                            shibie.data = shibie.data[0];
                            shibie.goods_info = shibie.data.goods_info;
                            var fanhuiyangshi = zhuanlian_config["taobao_shangpingeshi"];
                            if (shibie.goods_info.rate) {
                                if (shibie.goods_info.coupon_amount) {
                                    yongjin = shibie.goods_info.price * Number(shibie.goods_info.rate) /
                                        100;
                                    yongjin = yongjin.toFixed(2);
                                    daoshoujia = shibie.goods_info.price - yongjin;
                                    daoshoujia = daoshoujia.toFixed(2)
                                } else {
                                    yongjin = shibie.goods_info.original_price * Number(shibie
                                        .goods_info.rate) / 100;
                                    yongjin = yongjin.toFixed(2);
                                    daoshoujia = shibie.goods_info.original_price - yongjin;
                                    daoshoujia = daoshoujia.toFixed(2)
                                }
                                fanhuiyangshi = fanhuiyangshi.replace(/{所属平台}/g, "淘宝");
                                fanhuiyangshi = fanhuiyangshi.replace(/{商品名称}/g, shibie.goods_info
                                    .title);
                                fanhuiyangshi = fanhuiyangshi.replace(/{商品ID}/g, shibie.goods_info
                                    .item_id);
                                fanhuiyangshi = fanhuiyangshi.replace(/{月销量}/g, shibie.goods_info
                                    .sales);
                                fanhuiyangshi = fanhuiyangshi.replace(/{商品原价}/g, shibie.goods_info
                                    .original_price);
                                fanhuiyangshi = fanhuiyangshi.replace(/{商品券后价}/g, shibie.goods_info
                                    .price);
                                fanhuiyangshi = fanhuiyangshi.replace(/{优惠券面额}/g, shibie.goods_info
                                    .coupon_amount);
                                fanhuiyangshi = fanhuiyangshi.replace(/{佣金比例}/g, Number(shibie
                                    .goods_info
                                    .rate).toFixed(2));
                                fanhuiyangshi = fanhuiyangshi.replace(/{预估佣金}/g, yongjin);
                                fanhuiyangshi = fanhuiyangshi.replace(/{最终到手价}/g, daoshoujia);
                                $(bianli).attr("href", shibie.data.short_url);
                                $(bianli).text(shibie.data.short_url + fanhuiyangshi)
                            }
                        } else {
                            layer.msg("大淘客新手扶持计划转链失败(Token失效)：" + shibie.msg)
                        }
                    })
                } else {
                    $.when(jianqieban(zhuanhref, zhuanlian_config["taobao_appkey"], zhuanlian_config[
                        "taobao_appSecret"], zhuanlian_config)).done(function (shibie) {
                        if (shibie.msg == "成功v2") {
                            if (shibie.data.parseStatus == "3" && shibie.data.dataType == "goods" &&
                                shibie.data.itemId) {
                                $.when(dtaobaoshangpin(shibie.data.itemId, zhuanlian_config)).done(
                                    function (shangpin) {
                                        var fanhuiyangshi = zhuanlian_config[
                                            "taobao_shangpingeshi"];
                                        if (shibie.data.commissionRate) {
                                            if (zhuanlian_config["taobao_bili"] > 0) {
                                                shibie.data.commissionRate = (shibie.data
                                                    .commissionRate * zhuanlian_config[
                                                        "taobao_bili"] / 100).toFixed(2)
                                            }
                                            if (shibie.data.actualPrice) {
                                                yongjin = shibie.data.actualPrice * shibie.data
                                                    .commissionRate / 100;
                                                yongjin = yongjin.toFixed(2);
                                                daoshoujia = shibie.data.actualPrice - yongjin;
                                                daoshoujia = daoshoujia.toFixed(2)
                                            } else {
                                                yongjin = shibie.data.originalPrice * shibie.data
                                                    .commissionRate / 100;
                                                yongjin = yongjin.toFixed(2);
                                                daoshoujia = shibie.data.originalPrice - yongjin;
                                                daoshoujia = daoshoujia.toFixed(2)
                                            }
                                            fanhuiyangshi = fanhuiyangshi.replace(/{所属平台}/g, "淘宝");
                                            fanhuiyangshi = fanhuiyangshi.replace(/{商品名称}/g, shibie
                                                .data.itemName);
                                            fanhuiyangshi = fanhuiyangshi.replace(/{商品ID}/g, shibie
                                                .data.itemId);
                                            fanhuiyangshi = fanhuiyangshi.replace(/{月销量}/g, shibie
                                                .data.monthSales);
                                            fanhuiyangshi = fanhuiyangshi.replace(/{商品原价}/g, shibie
                                                .data.originalPrice);
                                            fanhuiyangshi = fanhuiyangshi.replace(/{商品券后价}/g, shibie
                                                .data.actualPrice);
                                            fanhuiyangshi = fanhuiyangshi.replace(/{优惠券面额}/g, shibie
                                                .data.couponPrice);
                                            fanhuiyangshi = fanhuiyangshi.replace(/{佣金比例}/g, shibie
                                                .data.commissionRate);
                                            fanhuiyangshi = fanhuiyangshi.replace(/{预估佣金}/g,
                                                yongjin);
                                            fanhuiyangshi = fanhuiyangshi.replace(/{最终到手价}/g,
                                                daoshoujia);
                                            $(bianli).attr("href", shangpin.data.shortUrl);
                                            $(bianli).text(shangpin.data.shortUrl + fanhuiyangshi)
                                        }
                                    })
                            } else if ((shibie.data.parseStatus == "4" || shibie.data.parseStatus ==
                                    "5") && shibie.data.dataType == "activity" && shibie.data.itemId) {
                                console.log("是活动，并且解析出了内容")
                            } else if (shibie.data.parseStatus == "2") {
                                console.log("有口令或链接，未解析出商品/活动ID，或解析出商品/活动ID但联盟无信息")
                            }
                        } else {
                            console.log("识别没成功")
                        }
                    })
                }
            }
        }
        if (zhuanlian_config["jingdong_kaiguan"] == "1") {
            if (zhuanhref.match(RegExp(/jd.com/ig))) {
                if (zhuanlian_config["jingdong_method"] == "" || zhuanlian_config["jingdong_method"] == "大淘客") {
                    layer.confirm('京东大淘客转链接口暂时无法使用<br>请进入用户中心按教程更换折京客转链。', {
                        icon: 3,
                        title: '提示',
                        btn: ['查看教程', '取消']
                    }, function (index) {
                        window.location.href = '/jiaocheng/718063.html';
                        layer.close(index);
                    }, function (index) {
                        layer.close(index);
                    });
                    $.when(jianqieban(zhuanhref, zhuanlian_config["jingdong_appkey"], zhuanlian_config[
                        "jingdong_appSecret"], zhuanlian_config)).done(function (shibie) {
                        if (shibie.msg == "成功v2") {
                            var fanhuiyangshi = zhuanlian_config["jingdong_shangpingeshi"];
                            if (shibie.data.itemName) {
                                if (shibie.data.commissionRate) {
                                    if (shibie.data.actualPrice) {
                                        yongjin = shibie.data.actualPrice * shibie.data.commissionRate /
                                            100;
                                        yongjin = yongjin.toFixed(2);
                                        daoshoujia = shibie.data.actualPrice - yongjin;
                                        daoshoujia = daoshoujia.toFixed(2);
                                        plusyongjin = shibie.data.actualPrice * shibie.data
                                            .plusCommissionRate / 100;
                                        plusyongjin = plusyongjin.toFixed(2);
                                        plusdaoshoujia = shibie.data.actualPrice - plusyongjin;
                                        plusdaoshoujia = plusdaoshoujia.toFixed(2)
                                    } else {
                                        yongjin = shibie.data.originalPrice * shibie.data
                                            .commissionRate /
                                            100;
                                        yongjin = yongjin.toFixed(2);
                                        daoshoujia = shibie.data.originalPrice - yongjin;
                                        daoshoujia = daoshoujia.toFixed(2);
                                        plusyongjin = shibie.data.originalPrice * shibie.data
                                            .plusCommissionRate / 100;
                                        plusyongjin = plusyongjin.toFixed(2);
                                        plusdaoshoujia = shibie.data.originalPrice - plusyongjin;
                                        plusdaoshoujia = plusdaoshoujia.toFixed(2)
                                    }
                                    fanhuiyangshi = fanhuiyangshi.replace(/{所属平台}/g, "京东");
                                    fanhuiyangshi = fanhuiyangshi.replace(/{商品名称}/g, shibie.data
                                        .itemName);
                                    fanhuiyangshi = fanhuiyangshi.replace(/{商品ID}/g, shibie.data
                                        .itemId);
                                    fanhuiyangshi = fanhuiyangshi.replace(/{月销量}/g, shibie.data
                                        .monthSales);
                                    fanhuiyangshi = fanhuiyangshi.replace(/{商品原价}/g, shibie.data
                                        .originalPrice);
                                    fanhuiyangshi = fanhuiyangshi.replace(/{商品券后价}/g, shibie.data
                                        .actualPrice);
                                    fanhuiyangshi = fanhuiyangshi.replace(/{优惠券面额}/g, shibie.data
                                        .couponPrice);
                                    fanhuiyangshi = fanhuiyangshi.replace(/{佣金比例}/g, shibie.data
                                        .commissionRate);
                                    fanhuiyangshi = fanhuiyangshi.replace(/{PLUS佣金比例}/g, shibie.data
                                        .plusCommissionRate);
                                    fanhuiyangshi = fanhuiyangshi.replace(/{预估佣金}/g, yongjin);
                                    fanhuiyangshi = fanhuiyangshi.replace(/{PLUS预估佣金}/g, plusyongjin);
                                    fanhuiyangshi = fanhuiyangshi.replace(/{最终到手价}/g, daoshoujia);
                                    fanhuiyangshi = fanhuiyangshi.replace(/{PLUS最终到手价}/g,
                                        plusdaoshoujia);
                                    if (shibie.data.promotionShortUrl) {
                                        $(bianli).attr("href", shibie.data.promotionShortUrl);

                                        $(bianli).text(shibie.data.promotionShortUrl + fanhuiyangshi)
                                    } else {
                                        $.when(djingdongshangpin(zhuanhref, zhuanlian_config)).done(
                                            function (shangpin) {
                                                if (shangpin.msg == "成功") {
                                                    $(bianli).attr("href", shangpin.data.shortUrl);

                                                    $(bianli).text(shangpin.data.shortUrl +
                                                        fanhuiyangshi)
                                                }
                                            })
                                    }
                                }
                            } else {
                                if (shibie.data.url != shibie.data.promotionShortUrl && shibie.data
                                    .promotionShortUrl) {
                                    fanhuiyangshi = "（转链成功）";
                                    $(bianli).attr("href", shibie.data.promotionShortUrl);

                                    $(bianli).text(shibie.data.promotionShortUrl + fanhuiyangshi)
                                }
                            }
                        }
                    })
                } else if (zhuanlian_config["jingdong_method"] == "折京客") {
                    $.when(zjingdongshangpin(zhuanhref, zhuanlian_config)).done(function (shibie) {
                        shibie = JSON.parse(shibie);
                        if (shibie.status === 200) {
                            var fanhuiyangshi = zhuanlian_config["jingdong_shangpingeshi"];
                            if (shibie.title) {
                                if (shibie.tkrate3) {
                                    if (shibie.quanhou_jiage) {
                                        yongjin = shibie.quanhou_jiage * shibie.tkrate3 / 100;
                                        yongjin = yongjin.toFixed(2);
                                        daoshoujia = shibie.quanhou_jiage - yongjin;
                                        daoshoujia = daoshoujia.toFixed(2);
                                        plusyongjin = yongjin;
                                        plusdaoshoujia = daoshoujia;
                                    } else {
                                        yongjin = shibie.size * shibie.tkrate3 /
                                            100;
                                        yongjin = yongjin.toFixed(2);
                                        daoshoujia = shibie.size - yongjin;
                                        daoshoujia = daoshoujia.toFixed(2);
                                        plusyongjin = yongjin;
                                        plusdaoshoujia = daoshoujia;
                                    }
                                    fanhuiyangshi = fanhuiyangshi.replace(/{所属平台}/g, "京东");
                                    fanhuiyangshi = fanhuiyangshi.replace(/{商品名称}/g, shibie.title);
                                    fanhuiyangshi = fanhuiyangshi.replace(/{商品ID}/g, shibie.tao_id);
                                    fanhuiyangshi = fanhuiyangshi.replace(/{月销量}/g, shibie.volume);
                                    fanhuiyangshi = fanhuiyangshi.replace(/{商品原价}/g, shibie.size);
                                    fanhuiyangshi = fanhuiyangshi.replace(/{商品券后价}/g, shibie
                                        .quanhou_jiage);
                                    fanhuiyangshi = fanhuiyangshi.replace(/{优惠券面额}/g, shibie.size -
                                        shibie.quanhou_jiage);
                                    fanhuiyangshi = fanhuiyangshi.replace(/{佣金比例}/g, shibie.tkrate3);
                                    fanhuiyangshi = fanhuiyangshi.replace(/{PLUS佣金比例}/g, shibie
                                        .tkrate3);
                                    fanhuiyangshi = fanhuiyangshi.replace(/{预估佣金}/g, yongjin);
                                    fanhuiyangshi = fanhuiyangshi.replace(/{PLUS预估佣金}/g, plusyongjin);
                                    fanhuiyangshi = fanhuiyangshi.replace(/{最终到手价}/g, daoshoujia);
                                    fanhuiyangshi = fanhuiyangshi.replace(/{PLUS最终到手价}/g,
                                        plusdaoshoujia);
                                    if (shibie.content && shibie.content != zhuanhref) {
                                        $(bianli).attr("href", shibie.content);
                                        $(bianli).text(shibie.content + fanhuiyangshi)
                                    }
                                }
                            } else {
                                if (shibie.content && shibie.content != zhuanhref) {
                                    fanhuiyangshi = "（转链成功）";
                                    $(bianli).attr("href", shibie.content);
                                    $(bianli).text(shibie.content + fanhuiyangshi)
                                }
                            }
                        } else {
                            if (!zhuanlian_config["jingdong_appSecret"] || shibie.content.includes("有问题，可联系15611448080")) {
                        layer.confirm('折京客京东转链升级<br>不升级无法完成京东转链', {
                            icon: 3,
                            title: '提示',
                            btn: ['查看教程', '取消']
                        }, function (index) {
                            window.location.href = '/jiaocheng/718063.html';
                            layer.close(index);
                        }, function (index) {
                            layer.close(index);
                        });
                    }else{
                        layer.msg(shibie.content)
                    }
                    
                            console.log(shibie);
                        }
                    })
                }
            }
        }
        if (zhuanlian_config["pingduoduo_kaiguan"] == "1") {
            if (zhuanhref.match(RegExp(/yangkeduo.com|pinduoduo.com/ig))) {
                $.when(jianqieban(zhuanhref, zhuanlian_config["pingduoduo_appkey"], zhuanlian_config[
                    "pingduoduo_appSecret"], zhuanlian_config)).done(function (shibie) {
                    if (shibie.msg == "成功v2") {
                        if (shibie.data.parseStatus == "3" && shibie.data.dataType == "goods" && shibie
                            .data.itemId) {
                            var fanhuiyangshi = zhuanlian_config["pingduoduo_shangpingeshi"];
                            $.when(dpinpddshangpin(shibie.data.itemId, zhuanlian_config)).done(
                                function (shangpin) {
                                    if (shibie.data.commissionRate) {
                                        if (shibie.data.actualPrice) {
                                            yongjin = shibie.data.actualPrice * shibie.data
                                                .commissionRate / 100;
                                            yongjin = yongjin.toFixed(2);
                                            daoshoujia = shibie.data.actualPrice - yongjin;
                                            daoshoujia = daoshoujia.toFixed(2)
                                        } else {
                                            yongjin = shibie.data.originalPrice * shibie.data
                                                .commissionRate / 100;
                                            yongjin = yongjin.toFixed(2);
                                            daoshoujia = shibie.data.originalPrice - yongjin;
                                            daoshoujia = daoshoujia.toFixed(2)
                                        }
                                        fanhuiyangshi = fanhuiyangshi.replace(/{所属平台}/g, "拼多多");
                                        fanhuiyangshi = fanhuiyangshi.replace(/{商品名称}/g, shibie.data
                                            .itemName);
                                        fanhuiyangshi = fanhuiyangshi.replace(/{商品ID}/g, shibie.data
                                            .itemId);
                                        fanhuiyangshi = fanhuiyangshi.replace(/{月销量}/g, shibie.data
                                            .monthSales);
                                        fanhuiyangshi = fanhuiyangshi.replace(/{商品原价}/g, shibie.data
                                            .originalPrice);
                                        fanhuiyangshi = fanhuiyangshi.replace(/{商品券后价}/g, shibie
                                            .data.actualPrice);
                                        fanhuiyangshi = fanhuiyangshi.replace(/{优惠券面额}/g, shibie
                                            .data.couponPrice);
                                        fanhuiyangshi = fanhuiyangshi.replace(/{佣金比例}/g, shibie.data
                                            .commissionRate);
                                        fanhuiyangshi = fanhuiyangshi.replace(/{预估佣金}/g, yongjin);
                                        fanhuiyangshi = fanhuiyangshi.replace(/{最终到手价}/g,
                                            daoshoujia);
                                        $(bianli).attr("href", shangpin.data.mobileShortUrl);


                                        $(bianli).text(shangpin.data.mobileShortUrl + fanhuiyangshi)
                                    }
                                })
                        } else if ((shibie.data.parseStatus == "4" || shibie.data.parseStatus == "5") &&
                            shibie.data.dataType == "activity" && shibie.data.itemId) {
                            console.log("是活动，并且解析出了内容")
                        } else if (shibie.data.parseStatus == "2") {
                            console.log("有口令或链接，未解析出商品/活动ID，或解析出商品/活动ID但联盟无信息")
                        }
                    } else {
                        console.log("识别没成功")
                    }
                })
            }
        }
    });
}



function haodanzhuanlian(zhuanlian_config) {
    $('.detail-block .right .btn.buy:not([data-fan]').each(function (index, element) {
        $(element).attr('data-fan', 'true');
        let arg2 = $(element).data("url");
        let item_id = $(element).data("itemid");
        let item_type = $(element).closest(".right").data("type");
        if (typeof (arg2) == "undefined") {
            return true
        }
        if (zhuanlian_config["taobao_kaiguan"] == "1") {
            if (arg2.match(RegExp(/taobao.com|tb.cn|taobao.hk|tmall.com|tmall.hk/ig))) {
                if (zhuanlian_config["taobao_method"]) {
                    $.when(dtaobaofuchi(arg2, zhuanlian_config["taobao_method"])).done(function (shibie) {
                        if (shibie.code == 1) {
                            shibie.data = shibie.data[0];
                            shibie.goods_info = shibie.data.goods_info;

                            if (shibie.goods_info.rate) {
                                $(element).attr("data-zhuanlianurl", shibie.data.short_url);
                                $(element).attr("data-zhuanliantkl", shibie.data.full_tpwd);
                                $(element).text("返利" + Number(shibie.goods_info.rate).toFixed(2) + "%")
                            }
                        }
                    })
                } else {
                    $.when(jianqieban(arg2, zhuanlian_config["taobao_appkey"], zhuanlian_config[
                        "taobao_appSecret"], zhuanlian_config)).done(function (shibie) {
                        if (shibie.msg == "成功v2") {
                            if (shibie.data.parseStatus == "3" && shibie.data.dataType == "goods" &&
                                shibie.data.itemId) {
                                $.when(dtaobaoshangpin(shibie.data.itemId, zhuanlian_config)).done(
                                    function (shangpin) {
                                        if (shibie.data.commissionRate) {
                                            if (zhuanlian_config["taobao_bili"] > 0) {
                                                shibie.data.commissionRate = shibie.data
                                                    .commissionRate * zhuanlian_config[
                                                        "taobao_bili"] / 100
                                            }
                                            $(element).attr("data-zhuanlianurl", shangpin.data
                                                .shortUrl);
                                            $(element).attr("data-zhuanliantkl", shangpin.data
                                                .longTpwd);
                                            $(element).text("返利" + Number(shibie.data
                                                .commissionRate).toFixed(2) + "%")
                                        }
                                    })
                            } else if ((shibie.data.parseStatus == "4" || shibie.data.parseStatus ==
                                    "5") && shibie.data.dataType == "activity" && shibie.data.itemId) {
                                console.log("是活动，并且解析出了内容")
                            } else if (shibie.data.parseStatus == "2") {
                                console.log("有口令或链接，未解析出商品/活动ID，或解析出商品/活动ID但联盟无信息")
                            }
                        } else {
                            console.log("识别没成功")
                        }
                    })
                }
            }
        }
        if (zhuanlian_config["jingdong_kaiguan"] == "1") {
            if (arg2.match(RegExp(/jd.com/ig))) {
                if (zhuanlian_config["jingdong_method"] == "" || zhuanlian_config["jingdong_method"] == "大淘客") {
                    layer.confirm('京东大淘客转链接口暂时无法使用<br>请进入用户中心按教程更换折京客转链。', {
                        icon: 3,
                        title: '提示',
                        btn: ['查看教程', '取消']
                    }, function (index) {
                        window.location.href = '/jiaocheng/718063.html';
                        layer.close(index);
                    }, function (index) {
                        layer.close(index);
                    });
                    $.when(jianqieban(arg2, zhuanlian_config["jingdong_appkey"], zhuanlian_config[
                        "jingdong_appSecret"], zhuanlian_config)).done(function (shibie) {
                        if (shibie.msg == "成功v2") {
                            if (shibie.data.itemName) {
                                if (shibie.data.commissionRate) {
                                    if (shibie.data.promotionShortUrl) {
                                        $(element).attr("data-zhuanlianurl", shibie.data
                                            .promotionShortUrl);
                                        $(element).text("返利" + Number(shibie.data.commissionRate)
                                            .toFixed(2) + "%")
                                    } else {
                                        $.when(djingdongshangpin(arg2, zhuanlian_config)).done(
                                            function (
                                                shangpin) {
                                                if (shangpin.msg == "成功") {
                                                    $(element).attr("data-zhuanlianurl", shangpin
                                                        .data
                                                        .shortUrl);
                                                    $(element).text("返利" + Number(shibie.data
                                                        .commissionRate).toFixed(2) + "%")
                                                }
                                            })
                                    }
                                }
                            } else {
                                if (shibie.data.url != shibie.data.promotionShortUrl && shibie.data
                                    .promotionShortUrl) {
                                    $(element).attr("data-zhuanlianurl", shibie.data.promotionShortUrl);
                                    $(element).text("转链成功")
                                }
                            }
                        }
                    })
                } else if (zhuanlian_config["jingdong_method"] == "折京客") {
                    $.when(zjingdongshangpin(arg2, zhuanlian_config)).done(function (shibie) {
                        shibie = JSON.parse(shibie);
                        if (shibie.status === 200) {
                            if (shibie.title) {
                                if (shibie.tkrate3 && shibie.content) {
                                    $(element).attr("data-zhuanlianurl", shibie.content);
                                    $(element).text("返利" + Number(shibie.tkrate3).toFixed(2) + "%");
                                }
                            } else {
                                if (shibie.content.shorturl != arg2) {
                                    $(element).attr("data-zhuanlianurl", shibie.content);
                                    $(element).text("转链成功");
                                }
                            }
                        } else {
                            if (!zhuanlian_config["jingdong_appSecret"] || shibie.content.includes("有问题，可联系15611448080")) {
                        layer.confirm('折京客京东转链升级<br>不升级无法完成京东转链', {
                            icon: 3,
                            title: '提示',
                            btn: ['查看教程', '取消']
                        }, function (index) {
                            window.location.href = '/jiaocheng/718063.html';
                            layer.close(index);
                        }, function (index) {
                            layer.close(index);
                        });
                    }else{
                        layer.msg(shibie.content)
                    }
                            console.log(shibie);
                        }
                    })

                }
            }
        }
        if (zhuanlian_config["pingduoduo_kaiguan"] == "1") {
            if (arg2.match(RegExp(/yangkeduo.com|pinduoduo.com/ig))) {
                $.when(jianqieban(arg2, zhuanlian_config["pingduoduo_appkey"], zhuanlian_config[
                    "pingduoduo_appSecret"], zhuanlian_config)).done(function (shibie) {
                    if (shibie.msg == "成功v2") {
                        if (shibie.data.parseStatus == "3" && shibie.data.dataType == "goods" && shibie
                            .data.itemId) {
                            $.when(dpinpddshangpin(shibie.data.itemId, zhuanlian_config)).done(
                                function (shangpin) {
                                    if (shibie.data.commissionRate) {
                                        $(element).attr("data-zhuanlianurl", shangpin.data
                                            .mobileShortUrl);
                                        $(element).text("返利" + Number(shibie.data.commissionRate)
                                            .toFixed(2) + "%")
                                    }
                                })
                        }
                    }
                })
            }
        }
        if (zhuanlian_config["douyin_kaiguan"] == "1") {
            if (zhuanlian_config["douyin_method"] == "大淘客抖音转链") {
                if (arg2.match(RegExp(/buydouke.com/ig))) {
                    setTimeout(function () {
                        $.when(ddouyinshangpin(arg2, zhuanlian_config)).done(function (shangpin) {
                            if (shangpin.msg == "ok") {
                                if (shangpin.data.shareLink) {
                                    $(element).attr("data-zhuanlianurl", shangpin.data
                                        .shareLink);
                                    $(element).attr("data-zhuanliantkl", shangpin.data
                                        .dyPassword);
                                    $.when(ddouyinshibie(item_id, zhuanlian_config)).done(
                                        function (shibie) {
                                            if (shibie.msg == "ok") {
                                                shibie.data = shibie.data.list[0];
                                                if (shibie.data.cosRatio) {
                                                    $(element).text("返利" + Number(shibie
                                                            .data.cosRatio).toFixed(2) +
                                                        "%")
                                                }
                                            } else {
                                                $(element).text("转链成功")
                                            }
                                        })
                                }
                            } else {
                                console.log("转链没成功");
                                console.log(shangpin)
                            }
                        })
                    }, 500 * index)
                }
            } else if (zhuanlian_config["douyin_method"] == "热度星推转巨量百应") {
                if (item_type == "douyin" && item_id) {
                    setTimeout(function () {
                        $.when(rdouyinshangpin(item_id, zhuanlian_config)).done(function (shangpin) {
                            if (shangpin.success == true) {
                                if (shangpin.data.shareLink) {
                                    $(element).attr("data-zhuanlianurl", shangpin.data
                                        .shareLink);
                                    $(element).attr("data-zhuanliantkl", shangpin.data
                                        .password);
                                    $.when(rdouyinshibie(item_id, zhuanlian_config)).done(
                                        function (shibie) {
                                            if (shibie.success == true) {
                                                if (shibie.data.cosRatio) {
                                                    $(element).text("返利" + Number(shibie
                                                            .data.cosRatio).toFixed(2) +
                                                        "%")
                                                }
                                            } else {
                                                $(element).text("转链成功")
                                            }
                                        })
                                }
                            } else {
                                console.log("转链没成功");
                                console.log(shangpin)
                            }
                        })
                    }, 500 * index)
                }
            }
        }
    })
}
function updateapp(newbanbenhao){if(isWebapp){if(window.webapp.getcode()<newbanbenhao){layer.confirm("检测到线报酷APP有升级，<br><br>请点击立即升级后下载升级。",{btn:["立即更新","取消"],},function(index){window.open("/gonggao/1597146.html");layer.close(index)},function(){layer.msg("不升级无法享受新功能喔！")})}}}
function initGM(newbanbenhao){if(typeof(GM_info)!="undefined"&&GM_info!=null){if(GM_info.script.name=="线报酷扩展"){window.kuozhan="on";console.log("检测到油猴扩展");var newkuozhanversion=newbanbenhao;if(GM_info.script.version!=newkuozhanversion){layer.confirm("检测到油猴脚本有升级，请点击确认后升级。<br><br>升级后请刷新当前页面，使最新油猴配置生效。",{btn:["立即更新","取消"],},function(index){window.open("https://scriptcat.org/zh-CN/script-show-page/3042/");layer.close(index)},function(){layer.msg("不升级会有未知的BUG出现喔！")})}}}}
function isMobile(){var userAgentInfo=navigator.userAgent;var mobileAgents=["Android","iPhone","SymbianOS","Windows Phone","iPad","iPod"];var mobile_flag=false;for(var v=0;v<mobileAgents.length;v++){if(userAgentInfo.indexOf(mobileAgents[v])>0){mobile_flag=true;break}}var screen_width=window.screen.width;var screen_height=window.screen.height;if(screen_width<500&&screen_height<800){mobile_flag=true}return mobile_flag}
function isWebapp(){var userAgentInfo=navigator.userAgent;var isapp=false;if(userAgentInfo.indexOf("xianbaoku webapp")>0){var isapp=true}return isapp}
function addrank(config,netkaiguan,shuliang,redstr,sortkey,pingbifenlei,pingbilouzhu,zhanxianlouzhu,pingbilouzhuplus,pingbibiaoti,zhanxianbiaoti,pingbibiaotiplus,pingbineirong,zhanxianneirong,pingbineirongplus,pingbitime){if(lscache.supported()&&lscache.get(config)){var data=lscache.get(config);var rankdata=rankchuli(data,shuliang,sortkey,pingbifenlei,pingbilouzhu,zhanxianlouzhu,pingbilouzhuplus,pingbibiaoti,zhanxianbiaoti,pingbibiaotiplus,pingbineirong,zhanxianneirong,pingbineirongplus,pingbitime);$(".rank").append(rankdata);list_red(redstr,"list")}else{if(netkaiguan=="on" || netkaiguan == "off"){$.getJSON("/plus/json/rank/"+config+".json",function(result,status){if(status=="success"){if(lscache.supported()){if(config=="yixiaoshi-hot"){lscache.set(config,result,60*5)}else if(config=="sanxiaoshi-hot"){lscache.set(config,result,60*10)}else if(config=="liuxiaoshi-hot"||config=="shierxiaoshi-hot"){lscache.set(config,result,60*60)}else{lscache.set(config,result,60*60)}}var rankdata=rankchuli(result,shuliang,sortkey,pingbifenlei,pingbilouzhu,zhanxianlouzhu,pingbilouzhuplus,pingbibiaoti,zhanxianbiaoti,pingbibiaotiplus,pingbineirong,zhanxianneirong,pingbineirongplus,pingbitime);$(".rank").append(rankdata);list_red(redstr,"list")}})}else{const gaofeng='<div class="bangdan"><div class="clearfix"><div class="mianbaoxie">高峰时间排行榜暂停输出</div></div></div>';$(".listbox.rank").append(gaofeng)}}}
function rankchuli(res,shuliang,sortkey,pingbifenlei,pingbilouzhu,zhanxianlouzhu,pingbilouzhuplus,pingbibiaoti,zhanxianbiaoti,pingbibiaotiplus,pingbineirong,zhanxianneirong,pingbineirongplus,pingbitime){dangqian=0;bangdingshu=shuliang;Cars=[];$.each(res,function(i,field){if(listfilter(field,pingbifenlei,pingbilouzhu,zhanxianlouzhu,pingbilouzhuplus,pingbibiaoti,zhanxianbiaoti,pingbibiaotiplus,pingbineirong,zhanxianneirong,pingbineirongplus,pingbitime)==false){return true}Cars.push(field);dangqian++;if(dangqian==bangdingshu){return false}});if(sortkey!="1"){Cars=sortByKey(Cars,"shijianchuo","desc")}if(Cars.length%2===1){Cars.pop()}data=listtimechuli(Cars);if(data){data='<ul class="new-post">'+data+'</ul>';return data}}
$(function(){var pagealias=$(".pc-nav").attr("data-pagealias");if(pagealias&&pagealias.includes("-hot")){$('.rank-tabs span[data-tabs="'+pagealias+'"]').addClass("active");$('.rank-tabs span[data-tabs]').on('click',function(){var dataTabsValue=$(this).data('tabs');window.open("/"+dataTabsValue+".html","_self")});var w=0;$(".active").prevAll().each(function(){w=w+$(".active").innerWidth()});w=w+($(".active").innerWidth()/2);w=w-($(".rank-tabs").innerWidth()/2);$(".rank-tabs").scrollLeft(w-250)}});
function getWeiboCategories(pageName) {
    const FIRST_LEVEL_CATEGORIES = [
    'xianbao', 
    'shipin', 
    'yinliao', 
    'danrou', 
    'liangyou', 
    'guoshu', 
    'riyong', 
    'fushi', 
    'meizhuang', 
    'muying', 
    'jiankang', 
    'yundong', 
    'yule', 
    'shuma', 
    'jiayong', 
    'chongwu', 
    'qita'
];

    const SECOND_LEVEL_CATEGORIES = ['tb', 'jd', 'pdd', 'tuan', 'other', 'zhengdian', 'maochao'];
    const categories = pageName.split('-').slice(1);
    const isInArray = (item, array) => array.includes(item);
    const firstLevel = isInArray(categories[0], FIRST_LEVEL_CATEGORIES) ? categories[0] : null;
    let secondLevel = categories.length > 1 && isInArray(categories[1], SECOND_LEVEL_CATEGORIES) ? categories[1] : null;
    if (!secondLevel) {
        secondLevel = isInArray(categories[0], SECOND_LEVEL_CATEGORIES) ? categories[0] : null
    }
    return {
        firstLevel,
        secondLevel
    }
}

$(function () {
    const currentURL = window.location.href;
    const pageType = currentURL.includes("weibo") ? "weibo" : 
                     currentURL.includes("zhidemai") ? "zhidemai" : 
                     currentURL.includes("haodan") ? "haodan" : null;
    
    if (!pageType) return;

    const pagetype = $(".pc-nav").data("type");
    const pagename = $(".pc-nav").data("catename");
    const pagebiaoqian = $(".pc-nav").data("biaoqian") === "线报活动" ? "线报" : $(".pc-nav").data("biaoqian");
    const pageplatforms = $(".pc-nav").data("platforms");

    // 通用函数：设置活动标签
    function setActiveTabs() {
        if (pagetype === "category") {
            const wbcategory = getWeiboCategories(pagename);
            const firstLevel = wbcategory.firstLevel || "index";
            const secondLevel = wbcategory.secondLevel || "index";
            
            $(`.tip-nav span[data-tabs="${firstLevel}"]`).addClass("active");
            $(`.sort-row span[data-tabs="${secondLevel}"]`).addClass("active");
        } else if (pagetype === "article") {
            const biaoqianArray = pagebiaoqian.split('|');
            let hasActive = false;
            
            $('.tip-nav span').each(function () {
                if (biaoqianArray.includes($(this).text())) {
                    $(this).addClass("active");
                    hasActive = true;
                }
            });
            
            if (!hasActive) {
                $('.tip-nav span[data-tabs="index"]').addClass("active");
            }
        }
    }

    // 通用函数：处理标签点击事件
    function setupTabClickHandlers() {
        if (pagetype === "category") {
            $('.tip-nav span[data-tabs]').on('click', function () {
                const firstTabsValue = $(this).data('tabs');
                const secondTabsValue = $(".sort-row span.active").data('tabs');
                handleCategoryTabClick(firstTabsValue, secondTabsValue);
            });
            
            $('.sort-row span[data-tabs]').on('click', function () {
                const firstTabsValue = $(".tip-nav span.active").data('tabs');
                const secondTabsValue = $(this).data('tabs');
                handleCategoryTabClick(firstTabsValue, secondTabsValue, true);
            });
        } else if (pagetype === "article") {
            $('.tip-nav span[data-tabs]').on('click', function () {
                const firstTabsValue = $(this).data('tabs');
                if (firstTabsValue === "index") {
                    window.open(`/category-${pageType}/`, "_self");
                } else {
                    window.open(`/category-${pageType}-${firstTabsValue}/`, "_self");
                }
            });
        }
    }

    // 处理分类标签点击
    function handleCategoryTabClick(firstTabsValue, secondTabsValue, isSecondTab = false) {
        if (isSecondTab) {
            if (secondTabsValue === "tehuigou") {
                return window.open("/haodan/tehuigou.html", "_self");
            }
            if (secondTabsValue === "bendi") {
                return window.open("/haodan/bendi.html#?code=i1C4W8HL", "_self");
            }
        }
        
        if (firstTabsValue === "index" && secondTabsValue === "index") {
            window.open(`/category-${pageType}/`, "_self");
        } else {
            let url = `/category-${pageType}`;
            if (firstTabsValue && firstTabsValue !== "index") url += `-${firstTabsValue}`;
            if (secondTabsValue && secondTabsValue !== "index") url += `-${secondTabsValue}`;
            window.open(`${url}/`, "_self");
        }
    }

    // 通用函数：滑动导航栏
    function scrollNavToActive(navClass) {
    const $active = $(`${navClass} .active`).eq(0);
    const $nav = $(navClass);
    
    if (!$active.length || !$nav.length) return;
    
    // 获取元素实际位置和尺寸
    const activePosition = $active.position().left;
    const activeWidth = $active.outerWidth();
    const navWidth = $nav.outerWidth();
    
    // 计算居中滚动位置
    const scrollTo = activePosition + (activeWidth / 2) - (navWidth / 2);
    
    $nav.scrollLeft(scrollTo);
}


    // 初始化
    setActiveTabs();
    setupTabClickHandlers();
    scrollNavToActive(".tip-nav");
    scrollNavToActive(".sort-row");
});


$(document).ready(function(){$('.art-content .copy').click(function(){var textToCopy=$(this).text();var clipboard2=new ClipboardJS('.art-content .copy',{text:function(){return textToCopy}});clipboard2.on('success',function(e){layer.msg("复制成功");e.clearSelection()});clipboard2.on('error',function(e){console.error('复制失败:',e.action);layer.msg('复制失败，请手动复制文本')})})});
function url_qr(){$('.url-qr').remove();$('.article-content a:not(.imgreader a):not(.g-biaoti a), .art-fujia .c-neirong a:not(.dianpingming a):not(.huifuming a)').each(function(){var linkHref=$(this).attr('href');var newIcon=$('<i>',{class:'url-qr hidden-sm-md-lg iconfont icon-qr','data-fancybox':'url-qr',href:'https://qrickit.com/api/qr.php?qrsize=200&d='+encodeURIComponent(linkHref)});$(this).after(newIcon)});}
$(function(){url_qr();const targetNodes=$('.article-content a:not(.imgreader a):not(.g-biaoti a), .art-fujia .c-neirong a:not(.dianpingming a):not(.huifuming a)');const observer=new MutationObserver(function(mutations){mutations.forEach(function(mutation){if(mutation.type==='attributes'&&mutation.attributeName==='href'){url_qr()}})});const config={attributes:true,childList:false,subtree:false};targetNodes.each(function(){observer.observe(this,config)})});
function jiance_time(type,name,config){if(!config||!type)return 5;if(config.includes("###")){const configArr=config.split("<br>");for(let j=0;j<configArr.length;j++){const xiaoConfigArr=configArr[j].split("###");if(type==="index"){name="首页"}if(new RegExp(xiaoConfigArr[0],"i").test(name)&&/^\d+$/.test(xiaoConfigArr[1])){return xiaoConfigArr[1]}}}else{return/^\d+$/.test(config)?config:5}return 5}

function logUniqueMessage(message,type) {
    const hash = md5(message);
    if (!lscache.get(hash)) {
        if(type=="log"){
        console.log(message);
        }else if(type=="warn"){
            console.warn(message);
        }else if(type=="error"){
            console.error(message);
        }else {
            console.warn("Unsupported logUniqueMessage log type:"+ type);
        }
        lscache.set(hash, true, 300);
    }
}

function zdm_checkMatches(item_gjc, item_pbc, groupValue) {
    const gjcMatches = item_gjc && new RegExp(item_gjc).test(groupValue);
    const pbcMatches = item_pbc && new RegExp(item_pbc).test(groupValue);
    if (gjcMatches && pbcMatches) {
        return true;
    }
    if (item_gjc && !gjcMatches) {
        return true;
    }
    if (item_pbc && pbcMatches) {
        return true;
    }
}


function zdm_listfilter(group, zdm_config) {
    const zdm_arr = Object.values(zdm_config);

    for (const item of zdm_arr) {
        if (item.Status !== 1) {
            continue;
        }
        
        if (group.type !== "smzdm") {
            // console.log("smzdm不符合")
            continue;
        }
        
        if (group.mall_name && item.mall_name && !new RegExp(item.mall_name).test(group.mall_name)) {
            // console.log("商城不符合")
            continue;
        }
        
        
        if ((item.Miprice !== "" && group.price!== "" && Number(group.price) < Number(item.Miprice)) || (item.Mxprice !== "" && group.price!== "" && Number(group.price) > Number(item.Mxprice))) {
                // console.log("价格不符合"+group.title+group.price)
            continue;
        }

        if (group.title && zdm_checkMatches(item.title_gjc, item.title_pbc, group.title)) {
            // console.log("标题不符合")
            continue;
        }

        if (group.brand && zdm_checkMatches(item.brand_gjc, item.brand_pbc, group.brand)) {
            // console.log("品牌不符合")
            continue;
        }

        if (group.category_name && zdm_checkMatches(item.category_gjc, item.category_pbc, group.category_name)) {
            // console.log("分类不符合")
            continue;
        }
        return true;
    }
    return false;
}




function zdm_liebiaoshaixuan(zdm_config) {
    $("#mainbox .new-post .article-list:not(.top) .title a").each(function () {
        var shuzhu = {
            title: $(this).text().toString(),
            price: $(this).data("price"),
            type: $(this).attr('data-type') ? $(this).attr('data-type').toString() : '',
            brand: $(this).attr('data-brand') ? $(this).attr('data-brand').toString() : '',
            mall_name: $(this).attr('data-mall_name') ? $(this).attr('data-mall_name').toString() : '',
            category_name: $(this).attr('data-category_name') ? $(this).attr('data-category_name').toString() : ''
        };
        
        if (zdm_listfilter(shuzhu, zdm_config) == false) {
            $(this).parent().parent().remove();
        }
    });
}

$(function () {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/zb_users/theme/xianbao_theme/script/pwa.js')
      .then((registration) => {
        console.log('Service Worker 注册成功: ', registration);
      })
      .catch((error) => {
        console.log('Service Worker 注册失败: ', error);
      });
  }
});


// 跨域名路径匹配的访问链接跟踪（无日志版）
(function() {
  // 配置项
  const config = {
    cacheKey: 'cross_domain_visited_links',
    linkSelector: '.article-list a',
    visitedClass: 'visited',
    visitedColor: '#afafaf',
    expireDays: 30,
    domainsToIgnore: [
      'xanbao.fun', 'news.xianbao.fun',
      'ixbk.fun', 'news.ixbk.fun',
      'ixbk.net', 'news.ixbk.net'
    ]
  };
  
  // 提取纯路径（忽略协议和指定域名）
  function getPurePath(url) {
    try {
      const urlObj = new URL(url);
      if (config.domainsToIgnore.some(domain => urlObj.hostname.endsWith(domain))) {
        return urlObj.pathname + urlObj.search;
      }
      return url;
    } catch {
      return url;
    }
  }
  
  // 标记已访问链接
  function markVisitedLinks() {
    const visitedPaths = lscache.get(config.cacheKey) || {};
    const currentPath = getPurePath(window.location.href);
    
    document.querySelectorAll(config.linkSelector).forEach(link => {
      const linkPath = getPurePath(link.href);
      if (visitedPaths[linkPath] || linkPath === currentPath) {
        link.classList.add(config.visitedClass);
        link.style.color = config.visitedColor;
      }
    });
  }
  
  // 记录点击的链接
  function recordClick(e) {
    let target = e.target;
    while (target && target.tagName !== 'A') {
      target = target.parentElement;
      if (!target) return;
    }
    
    if (target && target.matches(config.linkSelector)) {
      const visitedPaths = lscache.get(config.cacheKey) || {};
      const purePath = getPurePath(target.href);
      
      if (!visitedPaths[purePath]) {
        visitedPaths[purePath] = true;
        lscache.set(config.cacheKey, visitedPaths, config.expireDays);
        target.classList.add(config.visitedClass);
        target.style.color = config.visitedColor;
      }
    }
  }
  
  // 初始化
  function initTracker() {
    if (typeof lscache === 'undefined') {
      const script = document.createElement('script');
      script.src = '/zb_users/theme/xianbao_theme/script/lscache.min.js';
      script.onload = startTracking;
      document.head.appendChild(script);
    } else {
      startTracking();
    }
  }
  
  function startTracking() {
    document.addEventListener('click', recordClick, true);
    markVisitedLinks();
  }
  
  // 自动初始化
  initTracker();
})();
