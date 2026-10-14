(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const l of document.querySelectorAll('link[rel="modulepreload"]'))s(l);new MutationObserver(l=>{for(const c of l)if(c.type==="childList")for(const f of c.addedNodes)f.tagName==="LINK"&&f.rel==="modulepreload"&&s(f)}).observe(document,{childList:!0,subtree:!0});function i(l){const c={};return l.integrity&&(c.integrity=l.integrity),l.referrerPolicy&&(c.referrerPolicy=l.referrerPolicy),l.crossOrigin==="use-credentials"?c.credentials="include":l.crossOrigin==="anonymous"?c.credentials="omit":c.credentials="same-origin",c}function s(l){if(l.ep)return;l.ep=!0;const c=i(l);fetch(l.href,c)}})();var Rh={exports:{}},Jo={};/**
 * @license React
 * react-jsx-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var __;function Oy(){if(__)return Jo;__=1;var r=Symbol.for("react.transitional.element"),t=Symbol.for("react.fragment");function i(s,l,c){var f=null;if(c!==void 0&&(f=""+c),l.key!==void 0&&(f=""+l.key),"key"in l){c={};for(var d in l)d!=="key"&&(c[d]=l[d])}else c=l;return l=c.ref,{$$typeof:r,type:s,key:f,ref:l!==void 0?l:null,props:c}}return Jo.Fragment=t,Jo.jsx=i,Jo.jsxs=i,Jo}var v_;function Py(){return v_||(v_=1,Rh.exports=Oy()),Rh.exports}var Ct=Py(),Ch={exports:{}},pe={};/**
 * @license React
 * react.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var x_;function zy(){if(x_)return pe;x_=1;var r=Symbol.for("react.transitional.element"),t=Symbol.for("react.portal"),i=Symbol.for("react.fragment"),s=Symbol.for("react.strict_mode"),l=Symbol.for("react.profiler"),c=Symbol.for("react.consumer"),f=Symbol.for("react.context"),d=Symbol.for("react.forward_ref"),m=Symbol.for("react.suspense"),p=Symbol.for("react.memo"),_=Symbol.for("react.lazy"),v=Symbol.for("react.activity"),g=Symbol.iterator;function x(B){return B===null||typeof B!="object"?null:(B=g&&B[g]||B["@@iterator"],typeof B=="function"?B:null)}var b={isMounted:function(){return!1},enqueueForceUpdate:function(){},enqueueReplaceState:function(){},enqueueSetState:function(){}},A=Object.assign,M={};function S(B,J,bt){this.props=B,this.context=J,this.refs=M,this.updater=bt||b}S.prototype.isReactComponent={},S.prototype.setState=function(B,J){if(typeof B!="object"&&typeof B!="function"&&B!=null)throw Error("takes an object of state variables to update or a function which returns an object of state variables.");this.updater.enqueueSetState(this,B,J,"setState")},S.prototype.forceUpdate=function(B){this.updater.enqueueForceUpdate(this,B,"forceUpdate")};function O(){}O.prototype=S.prototype;function U(B,J,bt){this.props=B,this.context=J,this.refs=M,this.updater=bt||b}var w=U.prototype=new O;w.constructor=U,A(w,S.prototype),w.isPureReactComponent=!0;var z=Array.isArray;function N(){}var L={H:null,A:null,T:null,S:null},E=Object.prototype.hasOwnProperty;function D(B,J,bt){var Rt=bt.ref;return{$$typeof:r,type:B,key:J,ref:Rt!==void 0?Rt:null,props:bt}}function F(B,J){return D(B.type,J,B.props)}function H(B){return typeof B=="object"&&B!==null&&B.$$typeof===r}function X(B){var J={"=":"=0",":":"=2"};return"$"+B.replace(/[=:]/g,function(bt){return J[bt]})}var ct=/\/+/g;function ut(B,J){return typeof B=="object"&&B!==null&&B.key!=null?X(""+B.key):J.toString(36)}function Z(B){switch(B.status){case"fulfilled":return B.value;case"rejected":throw B.reason;default:switch(typeof B.status=="string"?B.then(N,N):(B.status="pending",B.then(function(J){B.status==="pending"&&(B.status="fulfilled",B.value=J)},function(J){B.status==="pending"&&(B.status="rejected",B.reason=J)})),B.status){case"fulfilled":return B.value;case"rejected":throw B.reason}}throw B}function P(B,J,bt,Rt,Ut){var et=typeof B;(et==="undefined"||et==="boolean")&&(B=null);var yt=!1;if(B===null)yt=!0;else switch(et){case"bigint":case"string":case"number":yt=!0;break;case"object":switch(B.$$typeof){case r:case t:yt=!0;break;case _:return yt=B._init,P(yt(B._payload),J,bt,Rt,Ut)}}if(yt)return Ut=Ut(B),yt=Rt===""?"."+ut(B,0):Rt,z(Ut)?(bt="",yt!=null&&(bt=yt.replace(ct,"$&/")+"/"),P(Ut,J,bt,"",function(zt){return zt})):Ut!=null&&(H(Ut)&&(Ut=F(Ut,bt+(Ut.key==null||B&&B.key===Ut.key?"":(""+Ut.key).replace(ct,"$&/")+"/")+yt)),J.push(Ut)),1;yt=0;var Q=Rt===""?".":Rt+":";if(z(B))for(var gt=0;gt<B.length;gt++)Rt=B[gt],et=Q+ut(Rt,gt),yt+=P(Rt,J,bt,et,Ut);else if(gt=x(B),typeof gt=="function")for(B=gt.call(B),gt=0;!(Rt=B.next()).done;)Rt=Rt.value,et=Q+ut(Rt,gt++),yt+=P(Rt,J,bt,et,Ut);else if(et==="object"){if(typeof B.then=="function")return P(Z(B),J,bt,Rt,Ut);throw J=String(B),Error("Objects are not valid as a React child (found: "+(J==="[object Object]"?"object with keys {"+Object.keys(B).join(", ")+"}":J)+"). If you meant to render a collection of children, use an array instead.")}return yt}function k(B,J,bt){if(B==null)return B;var Rt=[],Ut=0;return P(B,Rt,"","",function(et){return J.call(bt,et,Ut++)}),Rt}function tt(B){if(B._status===-1){var J=B._result;J=J(),J.then(function(bt){(B._status===0||B._status===-1)&&(B._status=1,B._result=bt)},function(bt){(B._status===0||B._status===-1)&&(B._status=2,B._result=bt)}),B._status===-1&&(B._status=0,B._result=J)}if(B._status===1)return B._result.default;throw B._result}var _t=typeof reportError=="function"?reportError:function(B){if(typeof window=="object"&&typeof window.ErrorEvent=="function"){var J=new window.ErrorEvent("error",{bubbles:!0,cancelable:!0,message:typeof B=="object"&&B!==null&&typeof B.message=="string"?String(B.message):String(B),error:B});if(!window.dispatchEvent(J))return}else if(typeof process=="object"&&typeof process.emit=="function"){process.emit("uncaughtException",B);return}console.error(B)},Et={map:k,forEach:function(B,J,bt){k(B,function(){J.apply(this,arguments)},bt)},count:function(B){var J=0;return k(B,function(){J++}),J},toArray:function(B){return k(B,function(J){return J})||[]},only:function(B){if(!H(B))throw Error("React.Children.only expected to receive a single React element child.");return B}};return pe.Activity=v,pe.Children=Et,pe.Component=S,pe.Fragment=i,pe.Profiler=l,pe.PureComponent=U,pe.StrictMode=s,pe.Suspense=m,pe.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE=L,pe.__COMPILER_RUNTIME={__proto__:null,c:function(B){return L.H.useMemoCache(B)}},pe.cache=function(B){return function(){return B.apply(null,arguments)}},pe.cacheSignal=function(){return null},pe.cloneElement=function(B,J,bt){if(B==null)throw Error("The argument must be a React element, but you passed "+B+".");var Rt=A({},B.props),Ut=B.key;if(J!=null)for(et in J.key!==void 0&&(Ut=""+J.key),J)!E.call(J,et)||et==="key"||et==="__self"||et==="__source"||et==="ref"&&J.ref===void 0||(Rt[et]=J[et]);var et=arguments.length-2;if(et===1)Rt.children=bt;else if(1<et){for(var yt=Array(et),Q=0;Q<et;Q++)yt[Q]=arguments[Q+2];Rt.children=yt}return D(B.type,Ut,Rt)},pe.createContext=function(B){return B={$$typeof:f,_currentValue:B,_currentValue2:B,_threadCount:0,Provider:null,Consumer:null},B.Provider=B,B.Consumer={$$typeof:c,_context:B},B},pe.createElement=function(B,J,bt){var Rt,Ut={},et=null;if(J!=null)for(Rt in J.key!==void 0&&(et=""+J.key),J)E.call(J,Rt)&&Rt!=="key"&&Rt!=="__self"&&Rt!=="__source"&&(Ut[Rt]=J[Rt]);var yt=arguments.length-2;if(yt===1)Ut.children=bt;else if(1<yt){for(var Q=Array(yt),gt=0;gt<yt;gt++)Q[gt]=arguments[gt+2];Ut.children=Q}if(B&&B.defaultProps)for(Rt in yt=B.defaultProps,yt)Ut[Rt]===void 0&&(Ut[Rt]=yt[Rt]);return D(B,et,Ut)},pe.createRef=function(){return{current:null}},pe.forwardRef=function(B){return{$$typeof:d,render:B}},pe.isValidElement=H,pe.lazy=function(B){return{$$typeof:_,_payload:{_status:-1,_result:B},_init:tt}},pe.memo=function(B,J){return{$$typeof:p,type:B,compare:J===void 0?null:J}},pe.startTransition=function(B){var J=L.T,bt={};L.T=bt;try{var Rt=B(),Ut=L.S;Ut!==null&&Ut(bt,Rt),typeof Rt=="object"&&Rt!==null&&typeof Rt.then=="function"&&Rt.then(N,_t)}catch(et){_t(et)}finally{J!==null&&bt.types!==null&&(J.types=bt.types),L.T=J}},pe.unstable_useCacheRefresh=function(){return L.H.useCacheRefresh()},pe.use=function(B){return L.H.use(B)},pe.useActionState=function(B,J,bt){return L.H.useActionState(B,J,bt)},pe.useCallback=function(B,J){return L.H.useCallback(B,J)},pe.useContext=function(B){return L.H.useContext(B)},pe.useDebugValue=function(){},pe.useDeferredValue=function(B,J){return L.H.useDeferredValue(B,J)},pe.useEffect=function(B,J){return L.H.useEffect(B,J)},pe.useEffectEvent=function(B){return L.H.useEffectEvent(B)},pe.useId=function(){return L.H.useId()},pe.useImperativeHandle=function(B,J,bt){return L.H.useImperativeHandle(B,J,bt)},pe.useInsertionEffect=function(B,J){return L.H.useInsertionEffect(B,J)},pe.useLayoutEffect=function(B,J){return L.H.useLayoutEffect(B,J)},pe.useMemo=function(B,J){return L.H.useMemo(B,J)},pe.useOptimistic=function(B,J){return L.H.useOptimistic(B,J)},pe.useReducer=function(B,J,bt){return L.H.useReducer(B,J,bt)},pe.useRef=function(B){return L.H.useRef(B)},pe.useState=function(B){return L.H.useState(B)},pe.useSyncExternalStore=function(B,J,bt){return L.H.useSyncExternalStore(B,J,bt)},pe.useTransition=function(){return L.H.useTransition()},pe.version="19.2.8",pe}var S_;function fp(){return S_||(S_=1,Ch.exports=zy()),Ch.exports}var Zn=fp(),Dh={exports:{}},Qo={},Uh={exports:{}},Nh={};/**
 * @license React
 * scheduler.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var y_;function By(){return y_||(y_=1,(function(r){function t(P,k){var tt=P.length;P.push(k);t:for(;0<tt;){var _t=tt-1>>>1,Et=P[_t];if(0<l(Et,k))P[_t]=k,P[tt]=Et,tt=_t;else break t}}function i(P){return P.length===0?null:P[0]}function s(P){if(P.length===0)return null;var k=P[0],tt=P.pop();if(tt!==k){P[0]=tt;t:for(var _t=0,Et=P.length,B=Et>>>1;_t<B;){var J=2*(_t+1)-1,bt=P[J],Rt=J+1,Ut=P[Rt];if(0>l(bt,tt))Rt<Et&&0>l(Ut,bt)?(P[_t]=Ut,P[Rt]=tt,_t=Rt):(P[_t]=bt,P[J]=tt,_t=J);else if(Rt<Et&&0>l(Ut,tt))P[_t]=Ut,P[Rt]=tt,_t=Rt;else break t}}return k}function l(P,k){var tt=P.sortIndex-k.sortIndex;return tt!==0?tt:P.id-k.id}if(r.unstable_now=void 0,typeof performance=="object"&&typeof performance.now=="function"){var c=performance;r.unstable_now=function(){return c.now()}}else{var f=Date,d=f.now();r.unstable_now=function(){return f.now()-d}}var m=[],p=[],_=1,v=null,g=3,x=!1,b=!1,A=!1,M=!1,S=typeof setTimeout=="function"?setTimeout:null,O=typeof clearTimeout=="function"?clearTimeout:null,U=typeof setImmediate<"u"?setImmediate:null;function w(P){for(var k=i(p);k!==null;){if(k.callback===null)s(p);else if(k.startTime<=P)s(p),k.sortIndex=k.expirationTime,t(m,k);else break;k=i(p)}}function z(P){if(A=!1,w(P),!b)if(i(m)!==null)b=!0,N||(N=!0,X());else{var k=i(p);k!==null&&Z(z,k.startTime-P)}}var N=!1,L=-1,E=5,D=-1;function F(){return M?!0:!(r.unstable_now()-D<E)}function H(){if(M=!1,N){var P=r.unstable_now();D=P;var k=!0;try{t:{b=!1,A&&(A=!1,O(L),L=-1),x=!0;var tt=g;try{e:{for(w(P),v=i(m);v!==null&&!(v.expirationTime>P&&F());){var _t=v.callback;if(typeof _t=="function"){v.callback=null,g=v.priorityLevel;var Et=_t(v.expirationTime<=P);if(P=r.unstable_now(),typeof Et=="function"){v.callback=Et,w(P),k=!0;break e}v===i(m)&&s(m),w(P)}else s(m);v=i(m)}if(v!==null)k=!0;else{var B=i(p);B!==null&&Z(z,B.startTime-P),k=!1}}break t}finally{v=null,g=tt,x=!1}k=void 0}}finally{k?X():N=!1}}}var X;if(typeof U=="function")X=function(){U(H)};else if(typeof MessageChannel<"u"){var ct=new MessageChannel,ut=ct.port2;ct.port1.onmessage=H,X=function(){ut.postMessage(null)}}else X=function(){S(H,0)};function Z(P,k){L=S(function(){P(r.unstable_now())},k)}r.unstable_IdlePriority=5,r.unstable_ImmediatePriority=1,r.unstable_LowPriority=4,r.unstable_NormalPriority=3,r.unstable_Profiling=null,r.unstable_UserBlockingPriority=2,r.unstable_cancelCallback=function(P){P.callback=null},r.unstable_forceFrameRate=function(P){0>P||125<P?console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"):E=0<P?Math.floor(1e3/P):5},r.unstable_getCurrentPriorityLevel=function(){return g},r.unstable_next=function(P){switch(g){case 1:case 2:case 3:var k=3;break;default:k=g}var tt=g;g=k;try{return P()}finally{g=tt}},r.unstable_requestPaint=function(){M=!0},r.unstable_runWithPriority=function(P,k){switch(P){case 1:case 2:case 3:case 4:case 5:break;default:P=3}var tt=g;g=P;try{return k()}finally{g=tt}},r.unstable_scheduleCallback=function(P,k,tt){var _t=r.unstable_now();switch(typeof tt=="object"&&tt!==null?(tt=tt.delay,tt=typeof tt=="number"&&0<tt?_t+tt:_t):tt=_t,P){case 1:var Et=-1;break;case 2:Et=250;break;case 5:Et=1073741823;break;case 4:Et=1e4;break;default:Et=5e3}return Et=tt+Et,P={id:_++,callback:k,priorityLevel:P,startTime:tt,expirationTime:Et,sortIndex:-1},tt>_t?(P.sortIndex=tt,t(p,P),i(m)===null&&P===i(p)&&(A?(O(L),L=-1):A=!0,Z(z,tt-_t))):(P.sortIndex=Et,t(m,P),b||x||(b=!0,N||(N=!0,X()))),P},r.unstable_shouldYield=F,r.unstable_wrapCallback=function(P){var k=g;return function(){var tt=g;g=k;try{return P.apply(this,arguments)}finally{g=tt}}}})(Nh)),Nh}var M_;function Iy(){return M_||(M_=1,Uh.exports=By()),Uh.exports}var Lh={exports:{}},Wn={};/**
 * @license React
 * react-dom.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var b_;function Fy(){if(b_)return Wn;b_=1;var r=fp();function t(m){var p="https://react.dev/errors/"+m;if(1<arguments.length){p+="?args[]="+encodeURIComponent(arguments[1]);for(var _=2;_<arguments.length;_++)p+="&args[]="+encodeURIComponent(arguments[_])}return"Minified React error #"+m+"; visit "+p+" for the full message or use the non-minified dev environment for full errors and additional helpful warnings."}function i(){}var s={d:{f:i,r:function(){throw Error(t(522))},D:i,C:i,L:i,m:i,X:i,S:i,M:i},p:0,findDOMNode:null},l=Symbol.for("react.portal");function c(m,p,_){var v=3<arguments.length&&arguments[3]!==void 0?arguments[3]:null;return{$$typeof:l,key:v==null?null:""+v,children:m,containerInfo:p,implementation:_}}var f=r.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;function d(m,p){if(m==="font")return"";if(typeof p=="string")return p==="use-credentials"?p:""}return Wn.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE=s,Wn.createPortal=function(m,p){var _=2<arguments.length&&arguments[2]!==void 0?arguments[2]:null;if(!p||p.nodeType!==1&&p.nodeType!==9&&p.nodeType!==11)throw Error(t(299));return c(m,p,null,_)},Wn.flushSync=function(m){var p=f.T,_=s.p;try{if(f.T=null,s.p=2,m)return m()}finally{f.T=p,s.p=_,s.d.f()}},Wn.preconnect=function(m,p){typeof m=="string"&&(p?(p=p.crossOrigin,p=typeof p=="string"?p==="use-credentials"?p:"":void 0):p=null,s.d.C(m,p))},Wn.prefetchDNS=function(m){typeof m=="string"&&s.d.D(m)},Wn.preinit=function(m,p){if(typeof m=="string"&&p&&typeof p.as=="string"){var _=p.as,v=d(_,p.crossOrigin),g=typeof p.integrity=="string"?p.integrity:void 0,x=typeof p.fetchPriority=="string"?p.fetchPriority:void 0;_==="style"?s.d.S(m,typeof p.precedence=="string"?p.precedence:void 0,{crossOrigin:v,integrity:g,fetchPriority:x}):_==="script"&&s.d.X(m,{crossOrigin:v,integrity:g,fetchPriority:x,nonce:typeof p.nonce=="string"?p.nonce:void 0})}},Wn.preinitModule=function(m,p){if(typeof m=="string")if(typeof p=="object"&&p!==null){if(p.as==null||p.as==="script"){var _=d(p.as,p.crossOrigin);s.d.M(m,{crossOrigin:_,integrity:typeof p.integrity=="string"?p.integrity:void 0,nonce:typeof p.nonce=="string"?p.nonce:void 0})}}else p==null&&s.d.M(m)},Wn.preload=function(m,p){if(typeof m=="string"&&typeof p=="object"&&p!==null&&typeof p.as=="string"){var _=p.as,v=d(_,p.crossOrigin);s.d.L(m,_,{crossOrigin:v,integrity:typeof p.integrity=="string"?p.integrity:void 0,nonce:typeof p.nonce=="string"?p.nonce:void 0,type:typeof p.type=="string"?p.type:void 0,fetchPriority:typeof p.fetchPriority=="string"?p.fetchPriority:void 0,referrerPolicy:typeof p.referrerPolicy=="string"?p.referrerPolicy:void 0,imageSrcSet:typeof p.imageSrcSet=="string"?p.imageSrcSet:void 0,imageSizes:typeof p.imageSizes=="string"?p.imageSizes:void 0,media:typeof p.media=="string"?p.media:void 0})}},Wn.preloadModule=function(m,p){if(typeof m=="string")if(p){var _=d(p.as,p.crossOrigin);s.d.m(m,{as:typeof p.as=="string"&&p.as!=="script"?p.as:void 0,crossOrigin:_,integrity:typeof p.integrity=="string"?p.integrity:void 0})}else s.d.m(m)},Wn.requestFormReset=function(m){s.d.r(m)},Wn.unstable_batchedUpdates=function(m,p){return m(p)},Wn.useFormState=function(m,p,_){return f.H.useFormState(m,p,_)},Wn.useFormStatus=function(){return f.H.useHostTransitionStatus()},Wn.version="19.2.8",Wn}var E_;function Hy(){if(E_)return Lh.exports;E_=1;function r(){if(!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__>"u"||typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE!="function"))try{__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(r)}catch(t){console.error(t)}}return r(),Lh.exports=Fy(),Lh.exports}/**
 * @license React
 * react-dom-client.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var T_;function Gy(){if(T_)return Qo;T_=1;var r=Iy(),t=fp(),i=Hy();function s(e){var n="https://react.dev/errors/"+e;if(1<arguments.length){n+="?args[]="+encodeURIComponent(arguments[1]);for(var a=2;a<arguments.length;a++)n+="&args[]="+encodeURIComponent(arguments[a])}return"Minified React error #"+e+"; visit "+n+" for the full message or use the non-minified dev environment for full errors and additional helpful warnings."}function l(e){return!(!e||e.nodeType!==1&&e.nodeType!==9&&e.nodeType!==11)}function c(e){var n=e,a=e;if(e.alternate)for(;n.return;)n=n.return;else{e=n;do n=e,(n.flags&4098)!==0&&(a=n.return),e=n.return;while(e)}return n.tag===3?a:null}function f(e){if(e.tag===13){var n=e.memoizedState;if(n===null&&(e=e.alternate,e!==null&&(n=e.memoizedState)),n!==null)return n.dehydrated}return null}function d(e){if(e.tag===31){var n=e.memoizedState;if(n===null&&(e=e.alternate,e!==null&&(n=e.memoizedState)),n!==null)return n.dehydrated}return null}function m(e){if(c(e)!==e)throw Error(s(188))}function p(e){var n=e.alternate;if(!n){if(n=c(e),n===null)throw Error(s(188));return n!==e?null:e}for(var a=e,o=n;;){var u=a.return;if(u===null)break;var h=u.alternate;if(h===null){if(o=u.return,o!==null){a=o;continue}break}if(u.child===h.child){for(h=u.child;h;){if(h===a)return m(u),e;if(h===o)return m(u),n;h=h.sibling}throw Error(s(188))}if(a.return!==o.return)a=u,o=h;else{for(var y=!1,C=u.child;C;){if(C===a){y=!0,a=u,o=h;break}if(C===o){y=!0,o=u,a=h;break}C=C.sibling}if(!y){for(C=h.child;C;){if(C===a){y=!0,a=h,o=u;break}if(C===o){y=!0,o=h,a=u;break}C=C.sibling}if(!y)throw Error(s(189))}}if(a.alternate!==o)throw Error(s(190))}if(a.tag!==3)throw Error(s(188));return a.stateNode.current===a?e:n}function _(e){var n=e.tag;if(n===5||n===26||n===27||n===6)return e;for(e=e.child;e!==null;){if(n=_(e),n!==null)return n;e=e.sibling}return null}var v=Object.assign,g=Symbol.for("react.element"),x=Symbol.for("react.transitional.element"),b=Symbol.for("react.portal"),A=Symbol.for("react.fragment"),M=Symbol.for("react.strict_mode"),S=Symbol.for("react.profiler"),O=Symbol.for("react.consumer"),U=Symbol.for("react.context"),w=Symbol.for("react.forward_ref"),z=Symbol.for("react.suspense"),N=Symbol.for("react.suspense_list"),L=Symbol.for("react.memo"),E=Symbol.for("react.lazy"),D=Symbol.for("react.activity"),F=Symbol.for("react.memo_cache_sentinel"),H=Symbol.iterator;function X(e){return e===null||typeof e!="object"?null:(e=H&&e[H]||e["@@iterator"],typeof e=="function"?e:null)}var ct=Symbol.for("react.client.reference");function ut(e){if(e==null)return null;if(typeof e=="function")return e.$$typeof===ct?null:e.displayName||e.name||null;if(typeof e=="string")return e;switch(e){case A:return"Fragment";case S:return"Profiler";case M:return"StrictMode";case z:return"Suspense";case N:return"SuspenseList";case D:return"Activity"}if(typeof e=="object")switch(e.$$typeof){case b:return"Portal";case U:return e.displayName||"Context";case O:return(e._context.displayName||"Context")+".Consumer";case w:var n=e.render;return e=e.displayName,e||(e=n.displayName||n.name||"",e=e!==""?"ForwardRef("+e+")":"ForwardRef"),e;case L:return n=e.displayName||null,n!==null?n:ut(e.type)||"Memo";case E:n=e._payload,e=e._init;try{return ut(e(n))}catch{}}return null}var Z=Array.isArray,P=t.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,k=i.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,tt={pending:!1,data:null,method:null,action:null},_t=[],Et=-1;function B(e){return{current:e}}function J(e){0>Et||(e.current=_t[Et],_t[Et]=null,Et--)}function bt(e,n){Et++,_t[Et]=e.current,e.current=n}var Rt=B(null),Ut=B(null),et=B(null),yt=B(null);function Q(e,n){switch(bt(et,n),bt(Ut,e),bt(Rt,null),n.nodeType){case 9:case 11:e=(e=n.documentElement)&&(e=e.namespaceURI)?Hg(e):0;break;default:if(e=n.tagName,n=n.namespaceURI)n=Hg(n),e=Gg(n,e);else switch(e){case"svg":e=1;break;case"math":e=2;break;default:e=0}}J(Rt),bt(Rt,e)}function gt(){J(Rt),J(Ut),J(et)}function zt(e){e.memoizedState!==null&&bt(yt,e);var n=Rt.current,a=Gg(n,e.type);n!==a&&(bt(Ut,e),bt(Rt,a))}function At(e){Ut.current===e&&(J(Rt),J(Ut)),yt.current===e&&(J(yt),qo._currentValue=tt)}var oe,Xt;function fe(e){if(oe===void 0)try{throw Error()}catch(a){var n=a.stack.trim().match(/\n( *(at )?)/);oe=n&&n[1]||"",Xt=-1<a.stack.indexOf(`
    at`)?" (<anonymous>)":-1<a.stack.indexOf("@")?"@unknown:0:0":""}return`
`+oe+e+Xt}var ve=!1;function ge(e,n){if(!e||ve)return"";ve=!0;var a=Error.prepareStackTrace;Error.prepareStackTrace=void 0;try{var o={DetermineComponentFrameRoot:function(){try{if(n){var Mt=function(){throw Error()};if(Object.defineProperty(Mt.prototype,"props",{set:function(){throw Error()}}),typeof Reflect=="object"&&Reflect.construct){try{Reflect.construct(Mt,[])}catch(dt){var lt=dt}Reflect.construct(e,[],Mt)}else{try{Mt.call()}catch(dt){lt=dt}e.call(Mt.prototype)}}else{try{throw Error()}catch(dt){lt=dt}(Mt=e())&&typeof Mt.catch=="function"&&Mt.catch(function(){})}}catch(dt){if(dt&&lt&&typeof dt.stack=="string")return[dt.stack,lt.stack]}return[null,null]}};o.DetermineComponentFrameRoot.displayName="DetermineComponentFrameRoot";var u=Object.getOwnPropertyDescriptor(o.DetermineComponentFrameRoot,"name");u&&u.configurable&&Object.defineProperty(o.DetermineComponentFrameRoot,"name",{value:"DetermineComponentFrameRoot"});var h=o.DetermineComponentFrameRoot(),y=h[0],C=h[1];if(y&&C){var G=y.split(`
`),it=C.split(`
`);for(u=o=0;o<G.length&&!G[o].includes("DetermineComponentFrameRoot");)o++;for(;u<it.length&&!it[u].includes("DetermineComponentFrameRoot");)u++;if(o===G.length||u===it.length)for(o=G.length-1,u=it.length-1;1<=o&&0<=u&&G[o]!==it[u];)u--;for(;1<=o&&0<=u;o--,u--)if(G[o]!==it[u]){if(o!==1||u!==1)do if(o--,u--,0>u||G[o]!==it[u]){var xt=`
`+G[o].replace(" at new "," at ");return e.displayName&&xt.includes("<anonymous>")&&(xt=xt.replace("<anonymous>",e.displayName)),xt}while(1<=o&&0<=u);break}}}finally{ve=!1,Error.prepareStackTrace=a}return(a=e?e.displayName||e.name:"")?fe(a):""}function Xe(e,n){switch(e.tag){case 26:case 27:case 5:return fe(e.type);case 16:return fe("Lazy");case 13:return e.child!==n&&n!==null?fe("Suspense Fallback"):fe("Suspense");case 19:return fe("SuspenseList");case 0:case 15:return ge(e.type,!1);case 11:return ge(e.type.render,!1);case 1:return ge(e.type,!0);case 31:return fe("Activity");default:return""}}function rn(e){try{var n="",a=null;do n+=Xe(e,a),a=e,e=e.return;while(e);return n}catch(o){return`
Error generating stack: `+o.message+`
`+o.stack}}var tn=Object.prototype.hasOwnProperty,mn=r.unstable_scheduleCallback,Fe=r.unstable_cancelCallback,un=r.unstable_shouldYield,Y=r.unstable_requestPaint,Me=r.unstable_now,Le=r.unstable_getCurrentPriorityLevel,I=r.unstable_ImmediatePriority,T=r.unstable_UserBlockingPriority,j=r.unstable_NormalPriority,rt=r.unstable_LowPriority,pt=r.unstable_IdlePriority,Dt=r.log,Ot=r.unstable_setDisableYieldValue,ft=null,mt=null;function Lt(e){if(typeof Dt=="function"&&Ot(e),mt&&typeof mt.setStrictMode=="function")try{mt.setStrictMode(ft,e)}catch{}}var kt=Math.clz32?Math.clz32:Yt,It=Math.log,Bt=Math.LN2;function Yt(e){return e>>>=0,e===0?32:31-(It(e)/Bt|0)|0}var te=256,le=262144,q=4194304;function Nt(e){var n=e&42;if(n!==0)return n;switch(e&-e){case 1:return 1;case 2:return 2;case 4:return 4;case 8:return 8;case 16:return 16;case 32:return 32;case 64:return 64;case 128:return 128;case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:return e&261888;case 262144:case 524288:case 1048576:case 2097152:return e&3932160;case 4194304:case 8388608:case 16777216:case 33554432:return e&62914560;case 67108864:return 67108864;case 134217728:return 134217728;case 268435456:return 268435456;case 536870912:return 536870912;case 1073741824:return 0;default:return e}}function vt(e,n,a){var o=e.pendingLanes;if(o===0)return 0;var u=0,h=e.suspendedLanes,y=e.pingedLanes;e=e.warmLanes;var C=o&134217727;return C!==0?(o=C&~h,o!==0?u=Nt(o):(y&=C,y!==0?u=Nt(y):a||(a=C&~e,a!==0&&(u=Nt(a))))):(C=o&~h,C!==0?u=Nt(C):y!==0?u=Nt(y):a||(a=o&~e,a!==0&&(u=Nt(a)))),u===0?0:n!==0&&n!==u&&(n&h)===0&&(h=u&-u,a=n&-n,h>=a||h===32&&(a&4194048)!==0)?n:u}function Pt(e,n){return(e.pendingLanes&~(e.suspendedLanes&~e.pingedLanes)&n)===0}function Ht(e,n){switch(e){case 1:case 2:case 4:case 8:case 64:return n+250;case 16:case 32:case 128:case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:return n+5e3;case 4194304:case 8388608:case 16777216:case 33554432:return-1;case 67108864:case 134217728:case 268435456:case 536870912:case 1073741824:return-1;default:return-1}}function Tt(){var e=q;return q<<=1,(q&62914560)===0&&(q=4194304),e}function jt(e){for(var n=[],a=0;31>a;a++)n.push(e);return n}function qt(e,n){e.pendingLanes|=n,n!==268435456&&(e.suspendedLanes=0,e.pingedLanes=0,e.warmLanes=0)}function ht(e,n,a,o,u,h){var y=e.pendingLanes;e.pendingLanes=a,e.suspendedLanes=0,e.pingedLanes=0,e.warmLanes=0,e.expiredLanes&=a,e.entangledLanes&=a,e.errorRecoveryDisabledLanes&=a,e.shellSuspendCounter=0;var C=e.entanglements,G=e.expirationTimes,it=e.hiddenUpdates;for(a=y&~a;0<a;){var xt=31-kt(a),Mt=1<<xt;C[xt]=0,G[xt]=-1;var lt=it[xt];if(lt!==null)for(it[xt]=null,xt=0;xt<lt.length;xt++){var dt=lt[xt];dt!==null&&(dt.lane&=-536870913)}a&=~Mt}o!==0&&wt(e,o,0),h!==0&&u===0&&e.tag!==0&&(e.suspendedLanes|=h&~(y&~n))}function wt(e,n,a){e.pendingLanes|=n,e.suspendedLanes&=~n;var o=31-kt(n);e.entangledLanes|=n,e.entanglements[o]=e.entanglements[o]|1073741824|a&261930}function he(e,n){var a=e.entangledLanes|=n;for(e=e.entanglements;a;){var o=31-kt(a),u=1<<o;u&n|e[o]&n&&(e[o]|=n),a&=~u}}function ee(e,n){var a=n&-n;return a=(a&42)!==0?1:de(a),(a&(e.suspendedLanes|n))!==0?0:a}function de(e){switch(e){case 2:e=1;break;case 8:e=4;break;case 32:e=16;break;case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:case 4194304:case 8388608:case 16777216:case 33554432:e=128;break;case 268435456:e=134217728;break;default:e=0}return e}function Pe(e){return e&=-e,2<e?8<e?(e&134217727)!==0?32:268435456:8:2}function Sn(){var e=k.p;return e!==0?e:(e=window.event,e===void 0?32:u_(e.type))}function Dn(e,n){var a=k.p;try{return k.p=e,n()}finally{k.p=a}}var Jn=Math.random().toString(36).slice(2),fn="__reactFiber$"+Jn,_n="__reactProps$"+Jn,en="__reactContainer$"+Jn,Qn="__reactEvents$"+Jn,oa="__reactListeners$"+Jn,nn="__reactHandles$"+Jn,ii="__reactResources$"+Jn,Ai="__reactMarker$"+Jn;function Fa(e){delete e[fn],delete e[_n],delete e[Qn],delete e[oa],delete e[nn]}function la(e){var n=e[fn];if(n)return n;for(var a=e.parentNode;a;){if(n=a[en]||a[fn]){if(a=n.alternate,n.child!==null||a!==null&&a.child!==null)for(e=Zg(e);e!==null;){if(a=e[fn])return a;e=Zg(e)}return n}e=a,a=e.parentNode}return null}function ca(e){if(e=e[fn]||e[en]){var n=e.tag;if(n===5||n===6||n===13||n===31||n===26||n===27||n===3)return e}return null}function ys(e){var n=e.tag;if(n===5||n===26||n===27||n===6)return e.stateNode;throw Error(s(33))}function Ha(e){var n=e[ii];return n||(n=e[ii]={hoistableStyles:new Map,hoistableScripts:new Map}),n}function bn(e){e[Ai]=!0}var bl=new Set,R={};function K(e,n){ot(e,n),ot(e+"Capture",n)}function ot(e,n){for(R[e]=n,e=0;e<n.length;e++)bl.add(n[e])}var at=RegExp("^[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD][:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$"),st={},Gt={};function Zt(e){return tn.call(Gt,e)?!0:tn.call(st,e)?!1:at.test(e)?Gt[e]=!0:(st[e]=!0,!1)}function Ft(e,n,a){if(Zt(n))if(a===null)e.removeAttribute(n);else{switch(typeof a){case"undefined":case"function":case"symbol":e.removeAttribute(n);return;case"boolean":var o=n.toLowerCase().slice(0,5);if(o!=="data-"&&o!=="aria-"){e.removeAttribute(n);return}}e.setAttribute(n,""+a)}}function Jt(e,n,a){if(a===null)e.removeAttribute(n);else{switch(typeof a){case"undefined":case"function":case"symbol":case"boolean":e.removeAttribute(n);return}e.setAttribute(n,""+a)}}function Kt(e,n,a,o){if(o===null)e.removeAttribute(a);else{switch(typeof o){case"undefined":case"function":case"symbol":case"boolean":e.removeAttribute(a);return}e.setAttributeNS(n,a,""+o)}}function se(e){switch(typeof e){case"bigint":case"boolean":case"number":case"string":case"undefined":return e;case"object":return e;default:return""}}function xe(e){var n=e.type;return(e=e.nodeName)&&e.toLowerCase()==="input"&&(n==="checkbox"||n==="radio")}function ne(e,n,a){var o=Object.getOwnPropertyDescriptor(e.constructor.prototype,n);if(!e.hasOwnProperty(n)&&typeof o<"u"&&typeof o.get=="function"&&typeof o.set=="function"){var u=o.get,h=o.set;return Object.defineProperty(e,n,{configurable:!0,get:function(){return u.call(this)},set:function(y){a=""+y,h.call(this,y)}}),Object.defineProperty(e,n,{enumerable:o.enumerable}),{getValue:function(){return a},setValue:function(y){a=""+y},stopTracking:function(){e._valueTracker=null,delete e[n]}}}}function ze(e){if(!e._valueTracker){var n=xe(e)?"checked":"value";e._valueTracker=ne(e,n,""+e[n])}}function hn(e){if(!e)return!1;var n=e._valueTracker;if(!n)return!0;var a=n.getValue(),o="";return e&&(o=xe(e)?e.checked?"true":"false":e.value),e=o,e!==a?(n.setValue(e),!0):!1}function an(e){if(e=e||(typeof document<"u"?document:void 0),typeof e>"u")return null;try{return e.activeElement||e.body}catch{return e.body}}var We=/[\n"\\]/g;function qe(e){return e.replace(We,function(n){return"\\"+n.charCodeAt(0).toString(16)+" "})}function Wt(e,n,a,o,u,h,y,C){e.name="",y!=null&&typeof y!="function"&&typeof y!="symbol"&&typeof y!="boolean"?e.type=y:e.removeAttribute("type"),n!=null?y==="number"?(n===0&&e.value===""||e.value!=n)&&(e.value=""+se(n)):e.value!==""+se(n)&&(e.value=""+se(n)):y!=="submit"&&y!=="reset"||e.removeAttribute("value"),n!=null?Te(e,y,se(n)):a!=null?Te(e,y,se(a)):o!=null&&e.removeAttribute("value"),u==null&&h!=null&&(e.defaultChecked=!!h),u!=null&&(e.checked=u&&typeof u!="function"&&typeof u!="symbol"),C!=null&&typeof C!="function"&&typeof C!="symbol"&&typeof C!="boolean"?e.name=""+se(C):e.removeAttribute("name")}function Xn(e,n,a,o,u,h,y,C){if(h!=null&&typeof h!="function"&&typeof h!="symbol"&&typeof h!="boolean"&&(e.type=h),n!=null||a!=null){if(!(h!=="submit"&&h!=="reset"||n!=null)){ze(e);return}a=a!=null?""+se(a):"",n=n!=null?""+se(n):a,C||n===e.value||(e.value=n),e.defaultValue=n}o=o??u,o=typeof o!="function"&&typeof o!="symbol"&&!!o,e.checked=C?e.checked:!!o,e.defaultChecked=!!o,y!=null&&typeof y!="function"&&typeof y!="symbol"&&typeof y!="boolean"&&(e.name=y),ze(e)}function Te(e,n,a){n==="number"&&an(e.ownerDocument)===e||e.defaultValue===""+a||(e.defaultValue=""+a)}function Un(e,n,a,o){if(e=e.options,n){n={};for(var u=0;u<a.length;u++)n["$"+a[u]]=!0;for(a=0;a<e.length;a++)u=n.hasOwnProperty("$"+e[a].value),e[a].selected!==u&&(e[a].selected=u),u&&o&&(e[a].defaultSelected=!0)}else{for(a=""+se(a),n=null,u=0;u<e.length;u++){if(e[u].value===a){e[u].selected=!0,o&&(e[u].defaultSelected=!0);return}n!==null||e[u].disabled||(n=e[u])}n!==null&&(n.selected=!0)}}function fi(e,n,a){if(n!=null&&(n=""+se(n),n!==e.value&&(e.value=n),a==null)){e.defaultValue!==n&&(e.defaultValue=n);return}e.defaultValue=a!=null?""+se(a):""}function zi(e,n,a,o){if(n==null){if(o!=null){if(a!=null)throw Error(s(92));if(Z(o)){if(1<o.length)throw Error(s(93));o=o[0]}a=o}a==null&&(a=""),n=a}a=se(n),e.defaultValue=a,o=e.textContent,o===a&&o!==""&&o!==null&&(e.value=o),ze(e)}function hi(e,n){if(n){var a=e.firstChild;if(a&&a===e.lastChild&&a.nodeType===3){a.nodeValue=n;return}}e.textContent=n}var Ye=new Set("animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth boxFlex boxFlexGroup boxOrdinalGroup columnCount columns flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea gridRow gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd gridColumnSpan gridColumnStart fontWeight lineClamp lineHeight opacity order orphans scale tabSize widows zIndex zoom fillOpacity floodOpacity stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth MozAnimationIterationCount MozBoxFlex MozBoxFlexGroup MozLineClamp msAnimationIterationCount msFlex msZoom msFlexGrow msFlexNegative msFlexOrder msFlexPositive msFlexShrink msGridColumn msGridColumnSpan msGridRow msGridRowSpan WebkitAnimationIterationCount WebkitBoxFlex WebKitBoxFlexGroup WebkitBoxOrdinalGroup WebkitColumnCount WebkitColumns WebkitFlex WebkitFlexGrow WebkitFlexPositive WebkitFlexShrink WebkitLineClamp".split(" "));function dn(e,n,a){var o=n.indexOf("--")===0;a==null||typeof a=="boolean"||a===""?o?e.setProperty(n,""):n==="float"?e.cssFloat="":e[n]="":o?e.setProperty(n,a):typeof a!="number"||a===0||Ye.has(n)?n==="float"?e.cssFloat=a:e[n]=(""+a).trim():e[n]=a+"px"}function Bi(e,n,a){if(n!=null&&typeof n!="object")throw Error(s(62));if(e=e.style,a!=null){for(var o in a)!a.hasOwnProperty(o)||n!=null&&n.hasOwnProperty(o)||(o.indexOf("--")===0?e.setProperty(o,""):o==="float"?e.cssFloat="":e[o]="");for(var u in n)o=n[u],n.hasOwnProperty(u)&&a[u]!==o&&dn(e,u,o)}else for(var h in n)n.hasOwnProperty(h)&&dn(e,h,n[h])}function Ge(e){if(e.indexOf("-")===-1)return!1;switch(e){case"annotation-xml":case"color-profile":case"font-face":case"font-face-src":case"font-face-uri":case"font-face-format":case"font-face-name":case"missing-glyph":return!1;default:return!0}}var Yi=new Map([["acceptCharset","accept-charset"],["htmlFor","for"],["httpEquiv","http-equiv"],["crossOrigin","crossorigin"],["accentHeight","accent-height"],["alignmentBaseline","alignment-baseline"],["arabicForm","arabic-form"],["baselineShift","baseline-shift"],["capHeight","cap-height"],["clipPath","clip-path"],["clipRule","clip-rule"],["colorInterpolation","color-interpolation"],["colorInterpolationFilters","color-interpolation-filters"],["colorProfile","color-profile"],["colorRendering","color-rendering"],["dominantBaseline","dominant-baseline"],["enableBackground","enable-background"],["fillOpacity","fill-opacity"],["fillRule","fill-rule"],["floodColor","flood-color"],["floodOpacity","flood-opacity"],["fontFamily","font-family"],["fontSize","font-size"],["fontSizeAdjust","font-size-adjust"],["fontStretch","font-stretch"],["fontStyle","font-style"],["fontVariant","font-variant"],["fontWeight","font-weight"],["glyphName","glyph-name"],["glyphOrientationHorizontal","glyph-orientation-horizontal"],["glyphOrientationVertical","glyph-orientation-vertical"],["horizAdvX","horiz-adv-x"],["horizOriginX","horiz-origin-x"],["imageRendering","image-rendering"],["letterSpacing","letter-spacing"],["lightingColor","lighting-color"],["markerEnd","marker-end"],["markerMid","marker-mid"],["markerStart","marker-start"],["overlinePosition","overline-position"],["overlineThickness","overline-thickness"],["paintOrder","paint-order"],["panose-1","panose-1"],["pointerEvents","pointer-events"],["renderingIntent","rendering-intent"],["shapeRendering","shape-rendering"],["stopColor","stop-color"],["stopOpacity","stop-opacity"],["strikethroughPosition","strikethrough-position"],["strikethroughThickness","strikethrough-thickness"],["strokeDasharray","stroke-dasharray"],["strokeDashoffset","stroke-dashoffset"],["strokeLinecap","stroke-linecap"],["strokeLinejoin","stroke-linejoin"],["strokeMiterlimit","stroke-miterlimit"],["strokeOpacity","stroke-opacity"],["strokeWidth","stroke-width"],["textAnchor","text-anchor"],["textDecoration","text-decoration"],["textRendering","text-rendering"],["transformOrigin","transform-origin"],["underlinePosition","underline-position"],["underlineThickness","underline-thickness"],["unicodeBidi","unicode-bidi"],["unicodeRange","unicode-range"],["unitsPerEm","units-per-em"],["vAlphabetic","v-alphabetic"],["vHanging","v-hanging"],["vIdeographic","v-ideographic"],["vMathematical","v-mathematical"],["vectorEffect","vector-effect"],["vertAdvY","vert-adv-y"],["vertOriginX","vert-origin-x"],["vertOriginY","vert-origin-y"],["wordSpacing","word-spacing"],["writingMode","writing-mode"],["xmlnsXlink","xmlns:xlink"],["xHeight","x-height"]]),Ga=/^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i;function Ms(e){return Ga.test(""+e)?"javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')":e}function ua(){}var Eu=null;function Tu(e){return e=e.target||e.srcElement||window,e.correspondingUseElement&&(e=e.correspondingUseElement),e.nodeType===3?e.parentNode:e}var nr=null,ir=null;function Fp(e){var n=ca(e);if(n&&(e=n.stateNode)){var a=e[_n]||null;t:switch(e=n.stateNode,n.type){case"input":if(Wt(e,a.value,a.defaultValue,a.defaultValue,a.checked,a.defaultChecked,a.type,a.name),n=a.name,a.type==="radio"&&n!=null){for(a=e;a.parentNode;)a=a.parentNode;for(a=a.querySelectorAll('input[name="'+qe(""+n)+'"][type="radio"]'),n=0;n<a.length;n++){var o=a[n];if(o!==e&&o.form===e.form){var u=o[_n]||null;if(!u)throw Error(s(90));Wt(o,u.value,u.defaultValue,u.defaultValue,u.checked,u.defaultChecked,u.type,u.name)}}for(n=0;n<a.length;n++)o=a[n],o.form===e.form&&hn(o)}break t;case"textarea":fi(e,a.value,a.defaultValue);break t;case"select":n=a.value,n!=null&&Un(e,!!a.multiple,n,!1)}}}var Au=!1;function Hp(e,n,a){if(Au)return e(n,a);Au=!0;try{var o=e(n);return o}finally{if(Au=!1,(nr!==null||ir!==null)&&(uc(),nr&&(n=nr,e=ir,ir=nr=null,Fp(n),e)))for(n=0;n<e.length;n++)Fp(e[n])}}function lo(e,n){var a=e.stateNode;if(a===null)return null;var o=a[_n]||null;if(o===null)return null;a=o[n];t:switch(n){case"onClick":case"onClickCapture":case"onDoubleClick":case"onDoubleClickCapture":case"onMouseDown":case"onMouseDownCapture":case"onMouseMove":case"onMouseMoveCapture":case"onMouseUp":case"onMouseUpCapture":case"onMouseEnter":(o=!o.disabled)||(e=e.type,o=!(e==="button"||e==="input"||e==="select"||e==="textarea")),e=!o;break t;default:e=!1}if(e)return null;if(a&&typeof a!="function")throw Error(s(231,n,typeof a));return a}var fa=!(typeof window>"u"||typeof window.document>"u"||typeof window.document.createElement>"u"),wu=!1;if(fa)try{var co={};Object.defineProperty(co,"passive",{get:function(){wu=!0}}),window.addEventListener("test",co,co),window.removeEventListener("test",co,co)}catch{wu=!1}var Va=null,Ru=null,El=null;function Gp(){if(El)return El;var e,n=Ru,a=n.length,o,u="value"in Va?Va.value:Va.textContent,h=u.length;for(e=0;e<a&&n[e]===u[e];e++);var y=a-e;for(o=1;o<=y&&n[a-o]===u[h-o];o++);return El=u.slice(e,1<o?1-o:void 0)}function Tl(e){var n=e.keyCode;return"charCode"in e?(e=e.charCode,e===0&&n===13&&(e=13)):e=n,e===10&&(e=13),32<=e||e===13?e:0}function Al(){return!0}function Vp(){return!1}function ai(e){function n(a,o,u,h,y){this._reactName=a,this._targetInst=u,this.type=o,this.nativeEvent=h,this.target=y,this.currentTarget=null;for(var C in e)e.hasOwnProperty(C)&&(a=e[C],this[C]=a?a(h):h[C]);return this.isDefaultPrevented=(h.defaultPrevented!=null?h.defaultPrevented:h.returnValue===!1)?Al:Vp,this.isPropagationStopped=Vp,this}return v(n.prototype,{preventDefault:function(){this.defaultPrevented=!0;var a=this.nativeEvent;a&&(a.preventDefault?a.preventDefault():typeof a.returnValue!="unknown"&&(a.returnValue=!1),this.isDefaultPrevented=Al)},stopPropagation:function(){var a=this.nativeEvent;a&&(a.stopPropagation?a.stopPropagation():typeof a.cancelBubble!="unknown"&&(a.cancelBubble=!0),this.isPropagationStopped=Al)},persist:function(){},isPersistent:Al}),n}var bs={eventPhase:0,bubbles:0,cancelable:0,timeStamp:function(e){return e.timeStamp||Date.now()},defaultPrevented:0,isTrusted:0},wl=ai(bs),uo=v({},bs,{view:0,detail:0}),Nx=ai(uo),Cu,Du,fo,Rl=v({},uo,{screenX:0,screenY:0,clientX:0,clientY:0,pageX:0,pageY:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,getModifierState:Nu,button:0,buttons:0,relatedTarget:function(e){return e.relatedTarget===void 0?e.fromElement===e.srcElement?e.toElement:e.fromElement:e.relatedTarget},movementX:function(e){return"movementX"in e?e.movementX:(e!==fo&&(fo&&e.type==="mousemove"?(Cu=e.screenX-fo.screenX,Du=e.screenY-fo.screenY):Du=Cu=0,fo=e),Cu)},movementY:function(e){return"movementY"in e?e.movementY:Du}}),kp=ai(Rl),Lx=v({},Rl,{dataTransfer:0}),Ox=ai(Lx),Px=v({},uo,{relatedTarget:0}),Uu=ai(Px),zx=v({},bs,{animationName:0,elapsedTime:0,pseudoElement:0}),Bx=ai(zx),Ix=v({},bs,{clipboardData:function(e){return"clipboardData"in e?e.clipboardData:window.clipboardData}}),Fx=ai(Ix),Hx=v({},bs,{data:0}),Xp=ai(Hx),Gx={Esc:"Escape",Spacebar:" ",Left:"ArrowLeft",Up:"ArrowUp",Right:"ArrowRight",Down:"ArrowDown",Del:"Delete",Win:"OS",Menu:"ContextMenu",Apps:"ContextMenu",Scroll:"ScrollLock",MozPrintableKey:"Unidentified"},Vx={8:"Backspace",9:"Tab",12:"Clear",13:"Enter",16:"Shift",17:"Control",18:"Alt",19:"Pause",20:"CapsLock",27:"Escape",32:" ",33:"PageUp",34:"PageDown",35:"End",36:"Home",37:"ArrowLeft",38:"ArrowUp",39:"ArrowRight",40:"ArrowDown",45:"Insert",46:"Delete",112:"F1",113:"F2",114:"F3",115:"F4",116:"F5",117:"F6",118:"F7",119:"F8",120:"F9",121:"F10",122:"F11",123:"F12",144:"NumLock",145:"ScrollLock",224:"Meta"},kx={Alt:"altKey",Control:"ctrlKey",Meta:"metaKey",Shift:"shiftKey"};function Xx(e){var n=this.nativeEvent;return n.getModifierState?n.getModifierState(e):(e=kx[e])?!!n[e]:!1}function Nu(){return Xx}var Wx=v({},uo,{key:function(e){if(e.key){var n=Gx[e.key]||e.key;if(n!=="Unidentified")return n}return e.type==="keypress"?(e=Tl(e),e===13?"Enter":String.fromCharCode(e)):e.type==="keydown"||e.type==="keyup"?Vx[e.keyCode]||"Unidentified":""},code:0,location:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,repeat:0,locale:0,getModifierState:Nu,charCode:function(e){return e.type==="keypress"?Tl(e):0},keyCode:function(e){return e.type==="keydown"||e.type==="keyup"?e.keyCode:0},which:function(e){return e.type==="keypress"?Tl(e):e.type==="keydown"||e.type==="keyup"?e.keyCode:0}}),qx=ai(Wx),Yx=v({},Rl,{pointerId:0,width:0,height:0,pressure:0,tangentialPressure:0,tiltX:0,tiltY:0,twist:0,pointerType:0,isPrimary:0}),Wp=ai(Yx),Zx=v({},uo,{touches:0,targetTouches:0,changedTouches:0,altKey:0,metaKey:0,ctrlKey:0,shiftKey:0,getModifierState:Nu}),Kx=ai(Zx),Jx=v({},bs,{propertyName:0,elapsedTime:0,pseudoElement:0}),Qx=ai(Jx),jx=v({},Rl,{deltaX:function(e){return"deltaX"in e?e.deltaX:"wheelDeltaX"in e?-e.wheelDeltaX:0},deltaY:function(e){return"deltaY"in e?e.deltaY:"wheelDeltaY"in e?-e.wheelDeltaY:"wheelDelta"in e?-e.wheelDelta:0},deltaZ:0,deltaMode:0}),$x=ai(jx),tS=v({},bs,{newState:0,oldState:0}),eS=ai(tS),nS=[9,13,27,32],Lu=fa&&"CompositionEvent"in window,ho=null;fa&&"documentMode"in document&&(ho=document.documentMode);var iS=fa&&"TextEvent"in window&&!ho,qp=fa&&(!Lu||ho&&8<ho&&11>=ho),Yp=" ",Zp=!1;function Kp(e,n){switch(e){case"keyup":return nS.indexOf(n.keyCode)!==-1;case"keydown":return n.keyCode!==229;case"keypress":case"mousedown":case"focusout":return!0;default:return!1}}function Jp(e){return e=e.detail,typeof e=="object"&&"data"in e?e.data:null}var ar=!1;function aS(e,n){switch(e){case"compositionend":return Jp(n);case"keypress":return n.which!==32?null:(Zp=!0,Yp);case"textInput":return e=n.data,e===Yp&&Zp?null:e;default:return null}}function sS(e,n){if(ar)return e==="compositionend"||!Lu&&Kp(e,n)?(e=Gp(),El=Ru=Va=null,ar=!1,e):null;switch(e){case"paste":return null;case"keypress":if(!(n.ctrlKey||n.altKey||n.metaKey)||n.ctrlKey&&n.altKey){if(n.char&&1<n.char.length)return n.char;if(n.which)return String.fromCharCode(n.which)}return null;case"compositionend":return qp&&n.locale!=="ko"?null:n.data;default:return null}}var rS={color:!0,date:!0,datetime:!0,"datetime-local":!0,email:!0,month:!0,number:!0,password:!0,range:!0,search:!0,tel:!0,text:!0,time:!0,url:!0,week:!0};function Qp(e){var n=e&&e.nodeName&&e.nodeName.toLowerCase();return n==="input"?!!rS[e.type]:n==="textarea"}function jp(e,n,a,o){nr?ir?ir.push(o):ir=[o]:nr=o,n=_c(n,"onChange"),0<n.length&&(a=new wl("onChange","change",null,a,o),e.push({event:a,listeners:n}))}var po=null,mo=null;function oS(e){Og(e,0)}function Cl(e){var n=ys(e);if(hn(n))return e}function $p(e,n){if(e==="change")return n}var tm=!1;if(fa){var Ou;if(fa){var Pu="oninput"in document;if(!Pu){var em=document.createElement("div");em.setAttribute("oninput","return;"),Pu=typeof em.oninput=="function"}Ou=Pu}else Ou=!1;tm=Ou&&(!document.documentMode||9<document.documentMode)}function nm(){po&&(po.detachEvent("onpropertychange",im),mo=po=null)}function im(e){if(e.propertyName==="value"&&Cl(mo)){var n=[];jp(n,mo,e,Tu(e)),Hp(oS,n)}}function lS(e,n,a){e==="focusin"?(nm(),po=n,mo=a,po.attachEvent("onpropertychange",im)):e==="focusout"&&nm()}function cS(e){if(e==="selectionchange"||e==="keyup"||e==="keydown")return Cl(mo)}function uS(e,n){if(e==="click")return Cl(n)}function fS(e,n){if(e==="input"||e==="change")return Cl(n)}function hS(e,n){return e===n&&(e!==0||1/e===1/n)||e!==e&&n!==n}var di=typeof Object.is=="function"?Object.is:hS;function go(e,n){if(di(e,n))return!0;if(typeof e!="object"||e===null||typeof n!="object"||n===null)return!1;var a=Object.keys(e),o=Object.keys(n);if(a.length!==o.length)return!1;for(o=0;o<a.length;o++){var u=a[o];if(!tn.call(n,u)||!di(e[u],n[u]))return!1}return!0}function am(e){for(;e&&e.firstChild;)e=e.firstChild;return e}function sm(e,n){var a=am(e);e=0;for(var o;a;){if(a.nodeType===3){if(o=e+a.textContent.length,e<=n&&o>=n)return{node:a,offset:n-e};e=o}t:{for(;a;){if(a.nextSibling){a=a.nextSibling;break t}a=a.parentNode}a=void 0}a=am(a)}}function rm(e,n){return e&&n?e===n?!0:e&&e.nodeType===3?!1:n&&n.nodeType===3?rm(e,n.parentNode):"contains"in e?e.contains(n):e.compareDocumentPosition?!!(e.compareDocumentPosition(n)&16):!1:!1}function om(e){e=e!=null&&e.ownerDocument!=null&&e.ownerDocument.defaultView!=null?e.ownerDocument.defaultView:window;for(var n=an(e.document);n instanceof e.HTMLIFrameElement;){try{var a=typeof n.contentWindow.location.href=="string"}catch{a=!1}if(a)e=n.contentWindow;else break;n=an(e.document)}return n}function zu(e){var n=e&&e.nodeName&&e.nodeName.toLowerCase();return n&&(n==="input"&&(e.type==="text"||e.type==="search"||e.type==="tel"||e.type==="url"||e.type==="password")||n==="textarea"||e.contentEditable==="true")}var dS=fa&&"documentMode"in document&&11>=document.documentMode,sr=null,Bu=null,_o=null,Iu=!1;function lm(e,n,a){var o=a.window===a?a.document:a.nodeType===9?a:a.ownerDocument;Iu||sr==null||sr!==an(o)||(o=sr,"selectionStart"in o&&zu(o)?o={start:o.selectionStart,end:o.selectionEnd}:(o=(o.ownerDocument&&o.ownerDocument.defaultView||window).getSelection(),o={anchorNode:o.anchorNode,anchorOffset:o.anchorOffset,focusNode:o.focusNode,focusOffset:o.focusOffset}),_o&&go(_o,o)||(_o=o,o=_c(Bu,"onSelect"),0<o.length&&(n=new wl("onSelect","select",null,n,a),e.push({event:n,listeners:o}),n.target=sr)))}function Es(e,n){var a={};return a[e.toLowerCase()]=n.toLowerCase(),a["Webkit"+e]="webkit"+n,a["Moz"+e]="moz"+n,a}var rr={animationend:Es("Animation","AnimationEnd"),animationiteration:Es("Animation","AnimationIteration"),animationstart:Es("Animation","AnimationStart"),transitionrun:Es("Transition","TransitionRun"),transitionstart:Es("Transition","TransitionStart"),transitioncancel:Es("Transition","TransitionCancel"),transitionend:Es("Transition","TransitionEnd")},Fu={},cm={};fa&&(cm=document.createElement("div").style,"AnimationEvent"in window||(delete rr.animationend.animation,delete rr.animationiteration.animation,delete rr.animationstart.animation),"TransitionEvent"in window||delete rr.transitionend.transition);function Ts(e){if(Fu[e])return Fu[e];if(!rr[e])return e;var n=rr[e],a;for(a in n)if(n.hasOwnProperty(a)&&a in cm)return Fu[e]=n[a];return e}var um=Ts("animationend"),fm=Ts("animationiteration"),hm=Ts("animationstart"),pS=Ts("transitionrun"),mS=Ts("transitionstart"),gS=Ts("transitioncancel"),dm=Ts("transitionend"),pm=new Map,Hu="abort auxClick beforeToggle cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(" ");Hu.push("scrollEnd");function Ii(e,n){pm.set(e,n),K(n,[e])}var Dl=typeof reportError=="function"?reportError:function(e){if(typeof window=="object"&&typeof window.ErrorEvent=="function"){var n=new window.ErrorEvent("error",{bubbles:!0,cancelable:!0,message:typeof e=="object"&&e!==null&&typeof e.message=="string"?String(e.message):String(e),error:e});if(!window.dispatchEvent(n))return}else if(typeof process=="object"&&typeof process.emit=="function"){process.emit("uncaughtException",e);return}console.error(e)},wi=[],or=0,Gu=0;function Ul(){for(var e=or,n=Gu=or=0;n<e;){var a=wi[n];wi[n++]=null;var o=wi[n];wi[n++]=null;var u=wi[n];wi[n++]=null;var h=wi[n];if(wi[n++]=null,o!==null&&u!==null){var y=o.pending;y===null?u.next=u:(u.next=y.next,y.next=u),o.pending=u}h!==0&&mm(a,u,h)}}function Nl(e,n,a,o){wi[or++]=e,wi[or++]=n,wi[or++]=a,wi[or++]=o,Gu|=o,e.lanes|=o,e=e.alternate,e!==null&&(e.lanes|=o)}function Vu(e,n,a,o){return Nl(e,n,a,o),Ll(e)}function As(e,n){return Nl(e,null,null,n),Ll(e)}function mm(e,n,a){e.lanes|=a;var o=e.alternate;o!==null&&(o.lanes|=a);for(var u=!1,h=e.return;h!==null;)h.childLanes|=a,o=h.alternate,o!==null&&(o.childLanes|=a),h.tag===22&&(e=h.stateNode,e===null||e._visibility&1||(u=!0)),e=h,h=h.return;return e.tag===3?(h=e.stateNode,u&&n!==null&&(u=31-kt(a),e=h.hiddenUpdates,o=e[u],o===null?e[u]=[n]:o.push(n),n.lane=a|536870912),h):null}function Ll(e){if(50<Fo)throw Fo=0,jf=null,Error(s(185));for(var n=e.return;n!==null;)e=n,n=e.return;return e.tag===3?e.stateNode:null}var lr={};function _S(e,n,a,o){this.tag=e,this.key=a,this.sibling=this.child=this.return=this.stateNode=this.type=this.elementType=null,this.index=0,this.refCleanup=this.ref=null,this.pendingProps=n,this.dependencies=this.memoizedState=this.updateQueue=this.memoizedProps=null,this.mode=o,this.subtreeFlags=this.flags=0,this.deletions=null,this.childLanes=this.lanes=0,this.alternate=null}function pi(e,n,a,o){return new _S(e,n,a,o)}function ku(e){return e=e.prototype,!(!e||!e.isReactComponent)}function ha(e,n){var a=e.alternate;return a===null?(a=pi(e.tag,n,e.key,e.mode),a.elementType=e.elementType,a.type=e.type,a.stateNode=e.stateNode,a.alternate=e,e.alternate=a):(a.pendingProps=n,a.type=e.type,a.flags=0,a.subtreeFlags=0,a.deletions=null),a.flags=e.flags&65011712,a.childLanes=e.childLanes,a.lanes=e.lanes,a.child=e.child,a.memoizedProps=e.memoizedProps,a.memoizedState=e.memoizedState,a.updateQueue=e.updateQueue,n=e.dependencies,a.dependencies=n===null?null:{lanes:n.lanes,firstContext:n.firstContext},a.sibling=e.sibling,a.index=e.index,a.ref=e.ref,a.refCleanup=e.refCleanup,a}function gm(e,n){e.flags&=65011714;var a=e.alternate;return a===null?(e.childLanes=0,e.lanes=n,e.child=null,e.subtreeFlags=0,e.memoizedProps=null,e.memoizedState=null,e.updateQueue=null,e.dependencies=null,e.stateNode=null):(e.childLanes=a.childLanes,e.lanes=a.lanes,e.child=a.child,e.subtreeFlags=0,e.deletions=null,e.memoizedProps=a.memoizedProps,e.memoizedState=a.memoizedState,e.updateQueue=a.updateQueue,e.type=a.type,n=a.dependencies,e.dependencies=n===null?null:{lanes:n.lanes,firstContext:n.firstContext}),e}function Ol(e,n,a,o,u,h){var y=0;if(o=e,typeof e=="function")ku(e)&&(y=1);else if(typeof e=="string")y=My(e,a,Rt.current)?26:e==="html"||e==="head"||e==="body"?27:5;else t:switch(e){case D:return e=pi(31,a,n,u),e.elementType=D,e.lanes=h,e;case A:return ws(a.children,u,h,n);case M:y=8,u|=24;break;case S:return e=pi(12,a,n,u|2),e.elementType=S,e.lanes=h,e;case z:return e=pi(13,a,n,u),e.elementType=z,e.lanes=h,e;case N:return e=pi(19,a,n,u),e.elementType=N,e.lanes=h,e;default:if(typeof e=="object"&&e!==null)switch(e.$$typeof){case U:y=10;break t;case O:y=9;break t;case w:y=11;break t;case L:y=14;break t;case E:y=16,o=null;break t}y=29,a=Error(s(130,e===null?"null":typeof e,"")),o=null}return n=pi(y,a,n,u),n.elementType=e,n.type=o,n.lanes=h,n}function ws(e,n,a,o){return e=pi(7,e,o,n),e.lanes=a,e}function Xu(e,n,a){return e=pi(6,e,null,n),e.lanes=a,e}function _m(e){var n=pi(18,null,null,0);return n.stateNode=e,n}function Wu(e,n,a){return n=pi(4,e.children!==null?e.children:[],e.key,n),n.lanes=a,n.stateNode={containerInfo:e.containerInfo,pendingChildren:null,implementation:e.implementation},n}var vm=new WeakMap;function Ri(e,n){if(typeof e=="object"&&e!==null){var a=vm.get(e);return a!==void 0?a:(n={value:e,source:n,stack:rn(n)},vm.set(e,n),n)}return{value:e,source:n,stack:rn(n)}}var cr=[],ur=0,Pl=null,vo=0,Ci=[],Di=0,ka=null,Zi=1,Ki="";function da(e,n){cr[ur++]=vo,cr[ur++]=Pl,Pl=e,vo=n}function xm(e,n,a){Ci[Di++]=Zi,Ci[Di++]=Ki,Ci[Di++]=ka,ka=e;var o=Zi;e=Ki;var u=32-kt(o)-1;o&=~(1<<u),a+=1;var h=32-kt(n)+u;if(30<h){var y=u-u%5;h=(o&(1<<y)-1).toString(32),o>>=y,u-=y,Zi=1<<32-kt(n)+u|a<<u|o,Ki=h+e}else Zi=1<<h|a<<u|o,Ki=e}function qu(e){e.return!==null&&(da(e,1),xm(e,1,0))}function Yu(e){for(;e===Pl;)Pl=cr[--ur],cr[ur]=null,vo=cr[--ur],cr[ur]=null;for(;e===ka;)ka=Ci[--Di],Ci[Di]=null,Ki=Ci[--Di],Ci[Di]=null,Zi=Ci[--Di],Ci[Di]=null}function Sm(e,n){Ci[Di++]=Zi,Ci[Di++]=Ki,Ci[Di++]=ka,Zi=n.id,Ki=n.overflow,ka=e}var In=null,on=null,Ue=!1,Xa=null,Ui=!1,Zu=Error(s(519));function Wa(e){var n=Error(s(418,1<arguments.length&&arguments[1]!==void 0&&arguments[1]?"text":"HTML",""));throw xo(Ri(n,e)),Zu}function ym(e){var n=e.stateNode,a=e.type,o=e.memoizedProps;switch(n[fn]=e,n[_n]=o,a){case"dialog":we("cancel",n),we("close",n);break;case"iframe":case"object":case"embed":we("load",n);break;case"video":case"audio":for(a=0;a<Go.length;a++)we(Go[a],n);break;case"source":we("error",n);break;case"img":case"image":case"link":we("error",n),we("load",n);break;case"details":we("toggle",n);break;case"input":we("invalid",n),Xn(n,o.value,o.defaultValue,o.checked,o.defaultChecked,o.type,o.name,!0);break;case"select":we("invalid",n);break;case"textarea":we("invalid",n),zi(n,o.value,o.defaultValue,o.children)}a=o.children,typeof a!="string"&&typeof a!="number"&&typeof a!="bigint"||n.textContent===""+a||o.suppressHydrationWarning===!0||Ig(n.textContent,a)?(o.popover!=null&&(we("beforetoggle",n),we("toggle",n)),o.onScroll!=null&&we("scroll",n),o.onScrollEnd!=null&&we("scrollend",n),o.onClick!=null&&(n.onclick=ua),n=!0):n=!1,n||Wa(e,!0)}function Mm(e){for(In=e.return;In;)switch(In.tag){case 5:case 31:case 13:Ui=!1;return;case 27:case 3:Ui=!0;return;default:In=In.return}}function fr(e){if(e!==In)return!1;if(!Ue)return Mm(e),Ue=!0,!1;var n=e.tag,a;if((a=n!==3&&n!==27)&&((a=n===5)&&(a=e.type,a=!(a!=="form"&&a!=="button")||dh(e.type,e.memoizedProps)),a=!a),a&&on&&Wa(e),Mm(e),n===13){if(e=e.memoizedState,e=e!==null?e.dehydrated:null,!e)throw Error(s(317));on=Yg(e)}else if(n===31){if(e=e.memoizedState,e=e!==null?e.dehydrated:null,!e)throw Error(s(317));on=Yg(e)}else n===27?(n=on,ss(e.type)?(e=vh,vh=null,on=e):on=n):on=In?Li(e.stateNode.nextSibling):null;return!0}function Rs(){on=In=null,Ue=!1}function Ku(){var e=Xa;return e!==null&&(li===null?li=e:li.push.apply(li,e),Xa=null),e}function xo(e){Xa===null?Xa=[e]:Xa.push(e)}var Ju=B(null),Cs=null,pa=null;function qa(e,n,a){bt(Ju,n._currentValue),n._currentValue=a}function ma(e){e._currentValue=Ju.current,J(Ju)}function Qu(e,n,a){for(;e!==null;){var o=e.alternate;if((e.childLanes&n)!==n?(e.childLanes|=n,o!==null&&(o.childLanes|=n)):o!==null&&(o.childLanes&n)!==n&&(o.childLanes|=n),e===a)break;e=e.return}}function ju(e,n,a,o){var u=e.child;for(u!==null&&(u.return=e);u!==null;){var h=u.dependencies;if(h!==null){var y=u.child;h=h.firstContext;t:for(;h!==null;){var C=h;h=u;for(var G=0;G<n.length;G++)if(C.context===n[G]){h.lanes|=a,C=h.alternate,C!==null&&(C.lanes|=a),Qu(h.return,a,e),o||(y=null);break t}h=C.next}}else if(u.tag===18){if(y=u.return,y===null)throw Error(s(341));y.lanes|=a,h=y.alternate,h!==null&&(h.lanes|=a),Qu(y,a,e),y=null}else y=u.child;if(y!==null)y.return=u;else for(y=u;y!==null;){if(y===e){y=null;break}if(u=y.sibling,u!==null){u.return=y.return,y=u;break}y=y.return}u=y}}function hr(e,n,a,o){e=null;for(var u=n,h=!1;u!==null;){if(!h){if((u.flags&524288)!==0)h=!0;else if((u.flags&262144)!==0)break}if(u.tag===10){var y=u.alternate;if(y===null)throw Error(s(387));if(y=y.memoizedProps,y!==null){var C=u.type;di(u.pendingProps.value,y.value)||(e!==null?e.push(C):e=[C])}}else if(u===yt.current){if(y=u.alternate,y===null)throw Error(s(387));y.memoizedState.memoizedState!==u.memoizedState.memoizedState&&(e!==null?e.push(qo):e=[qo])}u=u.return}e!==null&&ju(n,e,a,o),n.flags|=262144}function zl(e){for(e=e.firstContext;e!==null;){if(!di(e.context._currentValue,e.memoizedValue))return!0;e=e.next}return!1}function Ds(e){Cs=e,pa=null,e=e.dependencies,e!==null&&(e.firstContext=null)}function Fn(e){return bm(Cs,e)}function Bl(e,n){return Cs===null&&Ds(e),bm(e,n)}function bm(e,n){var a=n._currentValue;if(n={context:n,memoizedValue:a,next:null},pa===null){if(e===null)throw Error(s(308));pa=n,e.dependencies={lanes:0,firstContext:n},e.flags|=524288}else pa=pa.next=n;return a}var vS=typeof AbortController<"u"?AbortController:function(){var e=[],n=this.signal={aborted:!1,addEventListener:function(a,o){e.push(o)}};this.abort=function(){n.aborted=!0,e.forEach(function(a){return a()})}},xS=r.unstable_scheduleCallback,SS=r.unstable_NormalPriority,En={$$typeof:U,Consumer:null,Provider:null,_currentValue:null,_currentValue2:null,_threadCount:0};function $u(){return{controller:new vS,data:new Map,refCount:0}}function So(e){e.refCount--,e.refCount===0&&xS(SS,function(){e.controller.abort()})}var yo=null,tf=0,dr=0,pr=null;function yS(e,n){if(yo===null){var a=yo=[];tf=0,dr=ah(),pr={status:"pending",value:void 0,then:function(o){a.push(o)}}}return tf++,n.then(Em,Em),n}function Em(){if(--tf===0&&yo!==null){pr!==null&&(pr.status="fulfilled");var e=yo;yo=null,dr=0,pr=null;for(var n=0;n<e.length;n++)(0,e[n])()}}function MS(e,n){var a=[],o={status:"pending",value:null,reason:null,then:function(u){a.push(u)}};return e.then(function(){o.status="fulfilled",o.value=n;for(var u=0;u<a.length;u++)(0,a[u])(n)},function(u){for(o.status="rejected",o.reason=u,u=0;u<a.length;u++)(0,a[u])(void 0)}),o}var Tm=P.S;P.S=function(e,n){lg=Me(),typeof n=="object"&&n!==null&&typeof n.then=="function"&&yS(e,n),Tm!==null&&Tm(e,n)};var Us=B(null);function ef(){var e=Us.current;return e!==null?e:sn.pooledCache}function Il(e,n){n===null?bt(Us,Us.current):bt(Us,n.pool)}function Am(){var e=ef();return e===null?null:{parent:En._currentValue,pool:e}}var mr=Error(s(460)),nf=Error(s(474)),Fl=Error(s(542)),Hl={then:function(){}};function wm(e){return e=e.status,e==="fulfilled"||e==="rejected"}function Rm(e,n,a){switch(a=e[a],a===void 0?e.push(n):a!==n&&(n.then(ua,ua),n=a),n.status){case"fulfilled":return n.value;case"rejected":throw e=n.reason,Dm(e),e;default:if(typeof n.status=="string")n.then(ua,ua);else{if(e=sn,e!==null&&100<e.shellSuspendCounter)throw Error(s(482));e=n,e.status="pending",e.then(function(o){if(n.status==="pending"){var u=n;u.status="fulfilled",u.value=o}},function(o){if(n.status==="pending"){var u=n;u.status="rejected",u.reason=o}})}switch(n.status){case"fulfilled":return n.value;case"rejected":throw e=n.reason,Dm(e),e}throw Ls=n,mr}}function Ns(e){try{var n=e._init;return n(e._payload)}catch(a){throw a!==null&&typeof a=="object"&&typeof a.then=="function"?(Ls=a,mr):a}}var Ls=null;function Cm(){if(Ls===null)throw Error(s(459));var e=Ls;return Ls=null,e}function Dm(e){if(e===mr||e===Fl)throw Error(s(483))}var gr=null,Mo=0;function Gl(e){var n=Mo;return Mo+=1,gr===null&&(gr=[]),Rm(gr,e,n)}function bo(e,n){n=n.props.ref,e.ref=n!==void 0?n:null}function Vl(e,n){throw n.$$typeof===g?Error(s(525)):(e=Object.prototype.toString.call(n),Error(s(31,e==="[object Object]"?"object with keys {"+Object.keys(n).join(", ")+"}":e)))}function Um(e){function n($,W){if(e){var nt=$.deletions;nt===null?($.deletions=[W],$.flags|=16):nt.push(W)}}function a($,W){if(!e)return null;for(;W!==null;)n($,W),W=W.sibling;return null}function o($){for(var W=new Map;$!==null;)$.key!==null?W.set($.key,$):W.set($.index,$),$=$.sibling;return W}function u($,W){return $=ha($,W),$.index=0,$.sibling=null,$}function h($,W,nt){return $.index=nt,e?(nt=$.alternate,nt!==null?(nt=nt.index,nt<W?($.flags|=67108866,W):nt):($.flags|=67108866,W)):($.flags|=1048576,W)}function y($){return e&&$.alternate===null&&($.flags|=67108866),$}function C($,W,nt,St){return W===null||W.tag!==6?(W=Xu(nt,$.mode,St),W.return=$,W):(W=u(W,nt),W.return=$,W)}function G($,W,nt,St){var re=nt.type;return re===A?xt($,W,nt.props.children,St,nt.key):W!==null&&(W.elementType===re||typeof re=="object"&&re!==null&&re.$$typeof===E&&Ns(re)===W.type)?(W=u(W,nt.props),bo(W,nt),W.return=$,W):(W=Ol(nt.type,nt.key,nt.props,null,$.mode,St),bo(W,nt),W.return=$,W)}function it($,W,nt,St){return W===null||W.tag!==4||W.stateNode.containerInfo!==nt.containerInfo||W.stateNode.implementation!==nt.implementation?(W=Wu(nt,$.mode,St),W.return=$,W):(W=u(W,nt.children||[]),W.return=$,W)}function xt($,W,nt,St,re){return W===null||W.tag!==7?(W=ws(nt,$.mode,St,re),W.return=$,W):(W=u(W,nt),W.return=$,W)}function Mt($,W,nt){if(typeof W=="string"&&W!==""||typeof W=="number"||typeof W=="bigint")return W=Xu(""+W,$.mode,nt),W.return=$,W;if(typeof W=="object"&&W!==null){switch(W.$$typeof){case x:return nt=Ol(W.type,W.key,W.props,null,$.mode,nt),bo(nt,W),nt.return=$,nt;case b:return W=Wu(W,$.mode,nt),W.return=$,W;case E:return W=Ns(W),Mt($,W,nt)}if(Z(W)||X(W))return W=ws(W,$.mode,nt,null),W.return=$,W;if(typeof W.then=="function")return Mt($,Gl(W),nt);if(W.$$typeof===U)return Mt($,Bl($,W),nt);Vl($,W)}return null}function lt($,W,nt,St){var re=W!==null?W.key:null;if(typeof nt=="string"&&nt!==""||typeof nt=="number"||typeof nt=="bigint")return re!==null?null:C($,W,""+nt,St);if(typeof nt=="object"&&nt!==null){switch(nt.$$typeof){case x:return nt.key===re?G($,W,nt,St):null;case b:return nt.key===re?it($,W,nt,St):null;case E:return nt=Ns(nt),lt($,W,nt,St)}if(Z(nt)||X(nt))return re!==null?null:xt($,W,nt,St,null);if(typeof nt.then=="function")return lt($,W,Gl(nt),St);if(nt.$$typeof===U)return lt($,W,Bl($,nt),St);Vl($,nt)}return null}function dt($,W,nt,St,re){if(typeof St=="string"&&St!==""||typeof St=="number"||typeof St=="bigint")return $=$.get(nt)||null,C(W,$,""+St,re);if(typeof St=="object"&&St!==null){switch(St.$$typeof){case x:return $=$.get(St.key===null?nt:St.key)||null,G(W,$,St,re);case b:return $=$.get(St.key===null?nt:St.key)||null,it(W,$,St,re);case E:return St=Ns(St),dt($,W,nt,St,re)}if(Z(St)||X(St))return $=$.get(nt)||null,xt(W,$,St,re,null);if(typeof St.then=="function")return dt($,W,nt,Gl(St),re);if(St.$$typeof===U)return dt($,W,nt,Bl(W,St),re);Vl(W,St)}return null}function Qt($,W,nt,St){for(var re=null,Be=null,$t=W,ye=W=0,De=null;$t!==null&&ye<nt.length;ye++){$t.index>ye?(De=$t,$t=null):De=$t.sibling;var Ie=lt($,$t,nt[ye],St);if(Ie===null){$t===null&&($t=De);break}e&&$t&&Ie.alternate===null&&n($,$t),W=h(Ie,W,ye),Be===null?re=Ie:Be.sibling=Ie,Be=Ie,$t=De}if(ye===nt.length)return a($,$t),Ue&&da($,ye),re;if($t===null){for(;ye<nt.length;ye++)$t=Mt($,nt[ye],St),$t!==null&&(W=h($t,W,ye),Be===null?re=$t:Be.sibling=$t,Be=$t);return Ue&&da($,ye),re}for($t=o($t);ye<nt.length;ye++)De=dt($t,$,ye,nt[ye],St),De!==null&&(e&&De.alternate!==null&&$t.delete(De.key===null?ye:De.key),W=h(De,W,ye),Be===null?re=De:Be.sibling=De,Be=De);return e&&$t.forEach(function(us){return n($,us)}),Ue&&da($,ye),re}function ce($,W,nt,St){if(nt==null)throw Error(s(151));for(var re=null,Be=null,$t=W,ye=W=0,De=null,Ie=nt.next();$t!==null&&!Ie.done;ye++,Ie=nt.next()){$t.index>ye?(De=$t,$t=null):De=$t.sibling;var us=lt($,$t,Ie.value,St);if(us===null){$t===null&&($t=De);break}e&&$t&&us.alternate===null&&n($,$t),W=h(us,W,ye),Be===null?re=us:Be.sibling=us,Be=us,$t=De}if(Ie.done)return a($,$t),Ue&&da($,ye),re;if($t===null){for(;!Ie.done;ye++,Ie=nt.next())Ie=Mt($,Ie.value,St),Ie!==null&&(W=h(Ie,W,ye),Be===null?re=Ie:Be.sibling=Ie,Be=Ie);return Ue&&da($,ye),re}for($t=o($t);!Ie.done;ye++,Ie=nt.next())Ie=dt($t,$,ye,Ie.value,St),Ie!==null&&(e&&Ie.alternate!==null&&$t.delete(Ie.key===null?ye:Ie.key),W=h(Ie,W,ye),Be===null?re=Ie:Be.sibling=Ie,Be=Ie);return e&&$t.forEach(function(Ly){return n($,Ly)}),Ue&&da($,ye),re}function $e($,W,nt,St){if(typeof nt=="object"&&nt!==null&&nt.type===A&&nt.key===null&&(nt=nt.props.children),typeof nt=="object"&&nt!==null){switch(nt.$$typeof){case x:t:{for(var re=nt.key;W!==null;){if(W.key===re){if(re=nt.type,re===A){if(W.tag===7){a($,W.sibling),St=u(W,nt.props.children),St.return=$,$=St;break t}}else if(W.elementType===re||typeof re=="object"&&re!==null&&re.$$typeof===E&&Ns(re)===W.type){a($,W.sibling),St=u(W,nt.props),bo(St,nt),St.return=$,$=St;break t}a($,W);break}else n($,W);W=W.sibling}nt.type===A?(St=ws(nt.props.children,$.mode,St,nt.key),St.return=$,$=St):(St=Ol(nt.type,nt.key,nt.props,null,$.mode,St),bo(St,nt),St.return=$,$=St)}return y($);case b:t:{for(re=nt.key;W!==null;){if(W.key===re)if(W.tag===4&&W.stateNode.containerInfo===nt.containerInfo&&W.stateNode.implementation===nt.implementation){a($,W.sibling),St=u(W,nt.children||[]),St.return=$,$=St;break t}else{a($,W);break}else n($,W);W=W.sibling}St=Wu(nt,$.mode,St),St.return=$,$=St}return y($);case E:return nt=Ns(nt),$e($,W,nt,St)}if(Z(nt))return Qt($,W,nt,St);if(X(nt)){if(re=X(nt),typeof re!="function")throw Error(s(150));return nt=re.call(nt),ce($,W,nt,St)}if(typeof nt.then=="function")return $e($,W,Gl(nt),St);if(nt.$$typeof===U)return $e($,W,Bl($,nt),St);Vl($,nt)}return typeof nt=="string"&&nt!==""||typeof nt=="number"||typeof nt=="bigint"?(nt=""+nt,W!==null&&W.tag===6?(a($,W.sibling),St=u(W,nt),St.return=$,$=St):(a($,W),St=Xu(nt,$.mode,St),St.return=$,$=St),y($)):a($,W)}return function($,W,nt,St){try{Mo=0;var re=$e($,W,nt,St);return gr=null,re}catch($t){if($t===mr||$t===Fl)throw $t;var Be=pi(29,$t,null,$.mode);return Be.lanes=St,Be.return=$,Be}finally{}}}var Os=Um(!0),Nm=Um(!1),Ya=!1;function af(e){e.updateQueue={baseState:e.memoizedState,firstBaseUpdate:null,lastBaseUpdate:null,shared:{pending:null,lanes:0,hiddenCallbacks:null},callbacks:null}}function sf(e,n){e=e.updateQueue,n.updateQueue===e&&(n.updateQueue={baseState:e.baseState,firstBaseUpdate:e.firstBaseUpdate,lastBaseUpdate:e.lastBaseUpdate,shared:e.shared,callbacks:null})}function Za(e){return{lane:e,tag:0,payload:null,callback:null,next:null}}function Ka(e,n,a){var o=e.updateQueue;if(o===null)return null;if(o=o.shared,(He&2)!==0){var u=o.pending;return u===null?n.next=n:(n.next=u.next,u.next=n),o.pending=n,n=Ll(e),mm(e,null,a),n}return Nl(e,o,n,a),Ll(e)}function Eo(e,n,a){if(n=n.updateQueue,n!==null&&(n=n.shared,(a&4194048)!==0)){var o=n.lanes;o&=e.pendingLanes,a|=o,n.lanes=a,he(e,a)}}function rf(e,n){var a=e.updateQueue,o=e.alternate;if(o!==null&&(o=o.updateQueue,a===o)){var u=null,h=null;if(a=a.firstBaseUpdate,a!==null){do{var y={lane:a.lane,tag:a.tag,payload:a.payload,callback:null,next:null};h===null?u=h=y:h=h.next=y,a=a.next}while(a!==null);h===null?u=h=n:h=h.next=n}else u=h=n;a={baseState:o.baseState,firstBaseUpdate:u,lastBaseUpdate:h,shared:o.shared,callbacks:o.callbacks},e.updateQueue=a;return}e=a.lastBaseUpdate,e===null?a.firstBaseUpdate=n:e.next=n,a.lastBaseUpdate=n}var of=!1;function To(){if(of){var e=pr;if(e!==null)throw e}}function Ao(e,n,a,o){of=!1;var u=e.updateQueue;Ya=!1;var h=u.firstBaseUpdate,y=u.lastBaseUpdate,C=u.shared.pending;if(C!==null){u.shared.pending=null;var G=C,it=G.next;G.next=null,y===null?h=it:y.next=it,y=G;var xt=e.alternate;xt!==null&&(xt=xt.updateQueue,C=xt.lastBaseUpdate,C!==y&&(C===null?xt.firstBaseUpdate=it:C.next=it,xt.lastBaseUpdate=G))}if(h!==null){var Mt=u.baseState;y=0,xt=it=G=null,C=h;do{var lt=C.lane&-536870913,dt=lt!==C.lane;if(dt?(Ce&lt)===lt:(o&lt)===lt){lt!==0&&lt===dr&&(of=!0),xt!==null&&(xt=xt.next={lane:0,tag:C.tag,payload:C.payload,callback:null,next:null});t:{var Qt=e,ce=C;lt=n;var $e=a;switch(ce.tag){case 1:if(Qt=ce.payload,typeof Qt=="function"){Mt=Qt.call($e,Mt,lt);break t}Mt=Qt;break t;case 3:Qt.flags=Qt.flags&-65537|128;case 0:if(Qt=ce.payload,lt=typeof Qt=="function"?Qt.call($e,Mt,lt):Qt,lt==null)break t;Mt=v({},Mt,lt);break t;case 2:Ya=!0}}lt=C.callback,lt!==null&&(e.flags|=64,dt&&(e.flags|=8192),dt=u.callbacks,dt===null?u.callbacks=[lt]:dt.push(lt))}else dt={lane:lt,tag:C.tag,payload:C.payload,callback:C.callback,next:null},xt===null?(it=xt=dt,G=Mt):xt=xt.next=dt,y|=lt;if(C=C.next,C===null){if(C=u.shared.pending,C===null)break;dt=C,C=dt.next,dt.next=null,u.lastBaseUpdate=dt,u.shared.pending=null}}while(!0);xt===null&&(G=Mt),u.baseState=G,u.firstBaseUpdate=it,u.lastBaseUpdate=xt,h===null&&(u.shared.lanes=0),ts|=y,e.lanes=y,e.memoizedState=Mt}}function Lm(e,n){if(typeof e!="function")throw Error(s(191,e));e.call(n)}function Om(e,n){var a=e.callbacks;if(a!==null)for(e.callbacks=null,e=0;e<a.length;e++)Lm(a[e],n)}var _r=B(null),kl=B(0);function Pm(e,n){e=Ea,bt(kl,e),bt(_r,n),Ea=e|n.baseLanes}function lf(){bt(kl,Ea),bt(_r,_r.current)}function cf(){Ea=kl.current,J(_r),J(kl)}var mi=B(null),Ni=null;function Ja(e){var n=e.alternate;bt(yn,yn.current&1),bt(mi,e),Ni===null&&(n===null||_r.current!==null||n.memoizedState!==null)&&(Ni=e)}function uf(e){bt(yn,yn.current),bt(mi,e),Ni===null&&(Ni=e)}function zm(e){e.tag===22?(bt(yn,yn.current),bt(mi,e),Ni===null&&(Ni=e)):Qa()}function Qa(){bt(yn,yn.current),bt(mi,mi.current)}function gi(e){J(mi),Ni===e&&(Ni=null),J(yn)}var yn=B(0);function Xl(e){for(var n=e;n!==null;){if(n.tag===13){var a=n.memoizedState;if(a!==null&&(a=a.dehydrated,a===null||gh(a)||_h(a)))return n}else if(n.tag===19&&(n.memoizedProps.revealOrder==="forwards"||n.memoizedProps.revealOrder==="backwards"||n.memoizedProps.revealOrder==="unstable_legacy-backwards"||n.memoizedProps.revealOrder==="together")){if((n.flags&128)!==0)return n}else if(n.child!==null){n.child.return=n,n=n.child;continue}if(n===e)break;for(;n.sibling===null;){if(n.return===null||n.return===e)return null;n=n.return}n.sibling.return=n.return,n=n.sibling}return null}var ga=0,Se=null,Qe=null,Tn=null,Wl=!1,vr=!1,Ps=!1,ql=0,wo=0,xr=null,bS=0;function vn(){throw Error(s(321))}function ff(e,n){if(n===null)return!1;for(var a=0;a<n.length&&a<e.length;a++)if(!di(e[a],n[a]))return!1;return!0}function hf(e,n,a,o,u,h){return ga=h,Se=n,n.memoizedState=null,n.updateQueue=null,n.lanes=0,P.H=e===null||e.memoizedState===null?x0:wf,Ps=!1,h=a(o,u),Ps=!1,vr&&(h=Im(n,a,o,u)),Bm(e),h}function Bm(e){P.H=Do;var n=Qe!==null&&Qe.next!==null;if(ga=0,Tn=Qe=Se=null,Wl=!1,wo=0,xr=null,n)throw Error(s(300));e===null||An||(e=e.dependencies,e!==null&&zl(e)&&(An=!0))}function Im(e,n,a,o){Se=e;var u=0;do{if(vr&&(xr=null),wo=0,vr=!1,25<=u)throw Error(s(301));if(u+=1,Tn=Qe=null,e.updateQueue!=null){var h=e.updateQueue;h.lastEffect=null,h.events=null,h.stores=null,h.memoCache!=null&&(h.memoCache.index=0)}P.H=S0,h=n(a,o)}while(vr);return h}function ES(){var e=P.H,n=e.useState()[0];return n=typeof n.then=="function"?Ro(n):n,e=e.useState()[0],(Qe!==null?Qe.memoizedState:null)!==e&&(Se.flags|=1024),n}function df(){var e=ql!==0;return ql=0,e}function pf(e,n,a){n.updateQueue=e.updateQueue,n.flags&=-2053,e.lanes&=~a}function mf(e){if(Wl){for(e=e.memoizedState;e!==null;){var n=e.queue;n!==null&&(n.pending=null),e=e.next}Wl=!1}ga=0,Tn=Qe=Se=null,vr=!1,wo=ql=0,xr=null}function jn(){var e={memoizedState:null,baseState:null,baseQueue:null,queue:null,next:null};return Tn===null?Se.memoizedState=Tn=e:Tn=Tn.next=e,Tn}function Mn(){if(Qe===null){var e=Se.alternate;e=e!==null?e.memoizedState:null}else e=Qe.next;var n=Tn===null?Se.memoizedState:Tn.next;if(n!==null)Tn=n,Qe=e;else{if(e===null)throw Se.alternate===null?Error(s(467)):Error(s(310));Qe=e,e={memoizedState:Qe.memoizedState,baseState:Qe.baseState,baseQueue:Qe.baseQueue,queue:Qe.queue,next:null},Tn===null?Se.memoizedState=Tn=e:Tn=Tn.next=e}return Tn}function Yl(){return{lastEffect:null,events:null,stores:null,memoCache:null}}function Ro(e){var n=wo;return wo+=1,xr===null&&(xr=[]),e=Rm(xr,e,n),n=Se,(Tn===null?n.memoizedState:Tn.next)===null&&(n=n.alternate,P.H=n===null||n.memoizedState===null?x0:wf),e}function Zl(e){if(e!==null&&typeof e=="object"){if(typeof e.then=="function")return Ro(e);if(e.$$typeof===U)return Fn(e)}throw Error(s(438,String(e)))}function gf(e){var n=null,a=Se.updateQueue;if(a!==null&&(n=a.memoCache),n==null){var o=Se.alternate;o!==null&&(o=o.updateQueue,o!==null&&(o=o.memoCache,o!=null&&(n={data:o.data.map(function(u){return u.slice()}),index:0})))}if(n==null&&(n={data:[],index:0}),a===null&&(a=Yl(),Se.updateQueue=a),a.memoCache=n,a=n.data[n.index],a===void 0)for(a=n.data[n.index]=Array(e),o=0;o<e;o++)a[o]=F;return n.index++,a}function _a(e,n){return typeof n=="function"?n(e):n}function Kl(e){var n=Mn();return _f(n,Qe,e)}function _f(e,n,a){var o=e.queue;if(o===null)throw Error(s(311));o.lastRenderedReducer=a;var u=e.baseQueue,h=o.pending;if(h!==null){if(u!==null){var y=u.next;u.next=h.next,h.next=y}n.baseQueue=u=h,o.pending=null}if(h=e.baseState,u===null)e.memoizedState=h;else{n=u.next;var C=y=null,G=null,it=n,xt=!1;do{var Mt=it.lane&-536870913;if(Mt!==it.lane?(Ce&Mt)===Mt:(ga&Mt)===Mt){var lt=it.revertLane;if(lt===0)G!==null&&(G=G.next={lane:0,revertLane:0,gesture:null,action:it.action,hasEagerState:it.hasEagerState,eagerState:it.eagerState,next:null}),Mt===dr&&(xt=!0);else if((ga&lt)===lt){it=it.next,lt===dr&&(xt=!0);continue}else Mt={lane:0,revertLane:it.revertLane,gesture:null,action:it.action,hasEagerState:it.hasEagerState,eagerState:it.eagerState,next:null},G===null?(C=G=Mt,y=h):G=G.next=Mt,Se.lanes|=lt,ts|=lt;Mt=it.action,Ps&&a(h,Mt),h=it.hasEagerState?it.eagerState:a(h,Mt)}else lt={lane:Mt,revertLane:it.revertLane,gesture:it.gesture,action:it.action,hasEagerState:it.hasEagerState,eagerState:it.eagerState,next:null},G===null?(C=G=lt,y=h):G=G.next=lt,Se.lanes|=Mt,ts|=Mt;it=it.next}while(it!==null&&it!==n);if(G===null?y=h:G.next=C,!di(h,e.memoizedState)&&(An=!0,xt&&(a=pr,a!==null)))throw a;e.memoizedState=h,e.baseState=y,e.baseQueue=G,o.lastRenderedState=h}return u===null&&(o.lanes=0),[e.memoizedState,o.dispatch]}function vf(e){var n=Mn(),a=n.queue;if(a===null)throw Error(s(311));a.lastRenderedReducer=e;var o=a.dispatch,u=a.pending,h=n.memoizedState;if(u!==null){a.pending=null;var y=u=u.next;do h=e(h,y.action),y=y.next;while(y!==u);di(h,n.memoizedState)||(An=!0),n.memoizedState=h,n.baseQueue===null&&(n.baseState=h),a.lastRenderedState=h}return[h,o]}function Fm(e,n,a){var o=Se,u=Mn(),h=Ue;if(h){if(a===void 0)throw Error(s(407));a=a()}else a=n();var y=!di((Qe||u).memoizedState,a);if(y&&(u.memoizedState=a,An=!0),u=u.queue,yf(Vm.bind(null,o,u,e),[e]),u.getSnapshot!==n||y||Tn!==null&&Tn.memoizedState.tag&1){if(o.flags|=2048,Sr(9,{destroy:void 0},Gm.bind(null,o,u,a,n),null),sn===null)throw Error(s(349));h||(ga&127)!==0||Hm(o,n,a)}return a}function Hm(e,n,a){e.flags|=16384,e={getSnapshot:n,value:a},n=Se.updateQueue,n===null?(n=Yl(),Se.updateQueue=n,n.stores=[e]):(a=n.stores,a===null?n.stores=[e]:a.push(e))}function Gm(e,n,a,o){n.value=a,n.getSnapshot=o,km(n)&&Xm(e)}function Vm(e,n,a){return a(function(){km(n)&&Xm(e)})}function km(e){var n=e.getSnapshot;e=e.value;try{var a=n();return!di(e,a)}catch{return!0}}function Xm(e){var n=As(e,2);n!==null&&ci(n,e,2)}function xf(e){var n=jn();if(typeof e=="function"){var a=e;if(e=a(),Ps){Lt(!0);try{a()}finally{Lt(!1)}}}return n.memoizedState=n.baseState=e,n.queue={pending:null,lanes:0,dispatch:null,lastRenderedReducer:_a,lastRenderedState:e},n}function Wm(e,n,a,o){return e.baseState=a,_f(e,Qe,typeof o=="function"?o:_a)}function TS(e,n,a,o,u){if(jl(e))throw Error(s(485));if(e=n.action,e!==null){var h={payload:u,action:e,next:null,isTransition:!0,status:"pending",value:null,reason:null,listeners:[],then:function(y){h.listeners.push(y)}};P.T!==null?a(!0):h.isTransition=!1,o(h),a=n.pending,a===null?(h.next=n.pending=h,qm(n,h)):(h.next=a.next,n.pending=a.next=h)}}function qm(e,n){var a=n.action,o=n.payload,u=e.state;if(n.isTransition){var h=P.T,y={};P.T=y;try{var C=a(u,o),G=P.S;G!==null&&G(y,C),Ym(e,n,C)}catch(it){Sf(e,n,it)}finally{h!==null&&y.types!==null&&(h.types=y.types),P.T=h}}else try{h=a(u,o),Ym(e,n,h)}catch(it){Sf(e,n,it)}}function Ym(e,n,a){a!==null&&typeof a=="object"&&typeof a.then=="function"?a.then(function(o){Zm(e,n,o)},function(o){return Sf(e,n,o)}):Zm(e,n,a)}function Zm(e,n,a){n.status="fulfilled",n.value=a,Km(n),e.state=a,n=e.pending,n!==null&&(a=n.next,a===n?e.pending=null:(a=a.next,n.next=a,qm(e,a)))}function Sf(e,n,a){var o=e.pending;if(e.pending=null,o!==null){o=o.next;do n.status="rejected",n.reason=a,Km(n),n=n.next;while(n!==o)}e.action=null}function Km(e){e=e.listeners;for(var n=0;n<e.length;n++)(0,e[n])()}function Jm(e,n){return n}function Qm(e,n){if(Ue){var a=sn.formState;if(a!==null){t:{var o=Se;if(Ue){if(on){e:{for(var u=on,h=Ui;u.nodeType!==8;){if(!h){u=null;break e}if(u=Li(u.nextSibling),u===null){u=null;break e}}h=u.data,u=h==="F!"||h==="F"?u:null}if(u){on=Li(u.nextSibling),o=u.data==="F!";break t}}Wa(o)}o=!1}o&&(n=a[0])}}return a=jn(),a.memoizedState=a.baseState=n,o={pending:null,lanes:0,dispatch:null,lastRenderedReducer:Jm,lastRenderedState:n},a.queue=o,a=g0.bind(null,Se,o),o.dispatch=a,o=xf(!1),h=Af.bind(null,Se,!1,o.queue),o=jn(),u={state:n,dispatch:null,action:e,pending:null},o.queue=u,a=TS.bind(null,Se,u,h,a),u.dispatch=a,o.memoizedState=e,[n,a,!1]}function jm(e){var n=Mn();return $m(n,Qe,e)}function $m(e,n,a){if(n=_f(e,n,Jm)[0],e=Kl(_a)[0],typeof n=="object"&&n!==null&&typeof n.then=="function")try{var o=Ro(n)}catch(y){throw y===mr?Fl:y}else o=n;n=Mn();var u=n.queue,h=u.dispatch;return a!==n.memoizedState&&(Se.flags|=2048,Sr(9,{destroy:void 0},AS.bind(null,u,a),null)),[o,h,e]}function AS(e,n){e.action=n}function t0(e){var n=Mn(),a=Qe;if(a!==null)return $m(n,a,e);Mn(),n=n.memoizedState,a=Mn();var o=a.queue.dispatch;return a.memoizedState=e,[n,o,!1]}function Sr(e,n,a,o){return e={tag:e,create:a,deps:o,inst:n,next:null},n=Se.updateQueue,n===null&&(n=Yl(),Se.updateQueue=n),a=n.lastEffect,a===null?n.lastEffect=e.next=e:(o=a.next,a.next=e,e.next=o,n.lastEffect=e),e}function e0(){return Mn().memoizedState}function Jl(e,n,a,o){var u=jn();Se.flags|=e,u.memoizedState=Sr(1|n,{destroy:void 0},a,o===void 0?null:o)}function Ql(e,n,a,o){var u=Mn();o=o===void 0?null:o;var h=u.memoizedState.inst;Qe!==null&&o!==null&&ff(o,Qe.memoizedState.deps)?u.memoizedState=Sr(n,h,a,o):(Se.flags|=e,u.memoizedState=Sr(1|n,h,a,o))}function n0(e,n){Jl(8390656,8,e,n)}function yf(e,n){Ql(2048,8,e,n)}function wS(e){Se.flags|=4;var n=Se.updateQueue;if(n===null)n=Yl(),Se.updateQueue=n,n.events=[e];else{var a=n.events;a===null?n.events=[e]:a.push(e)}}function i0(e){var n=Mn().memoizedState;return wS({ref:n,nextImpl:e}),function(){if((He&2)!==0)throw Error(s(440));return n.impl.apply(void 0,arguments)}}function a0(e,n){return Ql(4,2,e,n)}function s0(e,n){return Ql(4,4,e,n)}function r0(e,n){if(typeof n=="function"){e=e();var a=n(e);return function(){typeof a=="function"?a():n(null)}}if(n!=null)return e=e(),n.current=e,function(){n.current=null}}function o0(e,n,a){a=a!=null?a.concat([e]):null,Ql(4,4,r0.bind(null,n,e),a)}function Mf(){}function l0(e,n){var a=Mn();n=n===void 0?null:n;var o=a.memoizedState;return n!==null&&ff(n,o[1])?o[0]:(a.memoizedState=[e,n],e)}function c0(e,n){var a=Mn();n=n===void 0?null:n;var o=a.memoizedState;if(n!==null&&ff(n,o[1]))return o[0];if(o=e(),Ps){Lt(!0);try{e()}finally{Lt(!1)}}return a.memoizedState=[o,n],o}function bf(e,n,a){return a===void 0||(ga&1073741824)!==0&&(Ce&261930)===0?e.memoizedState=n:(e.memoizedState=a,e=ug(),Se.lanes|=e,ts|=e,a)}function u0(e,n,a,o){return di(a,n)?a:_r.current!==null?(e=bf(e,a,o),di(e,n)||(An=!0),e):(ga&42)===0||(ga&1073741824)!==0&&(Ce&261930)===0?(An=!0,e.memoizedState=a):(e=ug(),Se.lanes|=e,ts|=e,n)}function f0(e,n,a,o,u){var h=k.p;k.p=h!==0&&8>h?h:8;var y=P.T,C={};P.T=C,Af(e,!1,n,a);try{var G=u(),it=P.S;if(it!==null&&it(C,G),G!==null&&typeof G=="object"&&typeof G.then=="function"){var xt=MS(G,o);Co(e,n,xt,xi(e))}else Co(e,n,o,xi(e))}catch(Mt){Co(e,n,{then:function(){},status:"rejected",reason:Mt},xi())}finally{k.p=h,y!==null&&C.types!==null&&(y.types=C.types),P.T=y}}function RS(){}function Ef(e,n,a,o){if(e.tag!==5)throw Error(s(476));var u=h0(e).queue;f0(e,u,n,tt,a===null?RS:function(){return d0(e),a(o)})}function h0(e){var n=e.memoizedState;if(n!==null)return n;n={memoizedState:tt,baseState:tt,baseQueue:null,queue:{pending:null,lanes:0,dispatch:null,lastRenderedReducer:_a,lastRenderedState:tt},next:null};var a={};return n.next={memoizedState:a,baseState:a,baseQueue:null,queue:{pending:null,lanes:0,dispatch:null,lastRenderedReducer:_a,lastRenderedState:a},next:null},e.memoizedState=n,e=e.alternate,e!==null&&(e.memoizedState=n),n}function d0(e){var n=h0(e);n.next===null&&(n=e.alternate.memoizedState),Co(e,n.next.queue,{},xi())}function Tf(){return Fn(qo)}function p0(){return Mn().memoizedState}function m0(){return Mn().memoizedState}function CS(e){for(var n=e.return;n!==null;){switch(n.tag){case 24:case 3:var a=xi();e=Za(a);var o=Ka(n,e,a);o!==null&&(ci(o,n,a),Eo(o,n,a)),n={cache:$u()},e.payload=n;return}n=n.return}}function DS(e,n,a){var o=xi();a={lane:o,revertLane:0,gesture:null,action:a,hasEagerState:!1,eagerState:null,next:null},jl(e)?_0(n,a):(a=Vu(e,n,a,o),a!==null&&(ci(a,e,o),v0(a,n,o)))}function g0(e,n,a){var o=xi();Co(e,n,a,o)}function Co(e,n,a,o){var u={lane:o,revertLane:0,gesture:null,action:a,hasEagerState:!1,eagerState:null,next:null};if(jl(e))_0(n,u);else{var h=e.alternate;if(e.lanes===0&&(h===null||h.lanes===0)&&(h=n.lastRenderedReducer,h!==null))try{var y=n.lastRenderedState,C=h(y,a);if(u.hasEagerState=!0,u.eagerState=C,di(C,y))return Nl(e,n,u,0),sn===null&&Ul(),!1}catch{}finally{}if(a=Vu(e,n,u,o),a!==null)return ci(a,e,o),v0(a,n,o),!0}return!1}function Af(e,n,a,o){if(o={lane:2,revertLane:ah(),gesture:null,action:o,hasEagerState:!1,eagerState:null,next:null},jl(e)){if(n)throw Error(s(479))}else n=Vu(e,a,o,2),n!==null&&ci(n,e,2)}function jl(e){var n=e.alternate;return e===Se||n!==null&&n===Se}function _0(e,n){vr=Wl=!0;var a=e.pending;a===null?n.next=n:(n.next=a.next,a.next=n),e.pending=n}function v0(e,n,a){if((a&4194048)!==0){var o=n.lanes;o&=e.pendingLanes,a|=o,n.lanes=a,he(e,a)}}var Do={readContext:Fn,use:Zl,useCallback:vn,useContext:vn,useEffect:vn,useImperativeHandle:vn,useLayoutEffect:vn,useInsertionEffect:vn,useMemo:vn,useReducer:vn,useRef:vn,useState:vn,useDebugValue:vn,useDeferredValue:vn,useTransition:vn,useSyncExternalStore:vn,useId:vn,useHostTransitionStatus:vn,useFormState:vn,useActionState:vn,useOptimistic:vn,useMemoCache:vn,useCacheRefresh:vn};Do.useEffectEvent=vn;var x0={readContext:Fn,use:Zl,useCallback:function(e,n){return jn().memoizedState=[e,n===void 0?null:n],e},useContext:Fn,useEffect:n0,useImperativeHandle:function(e,n,a){a=a!=null?a.concat([e]):null,Jl(4194308,4,r0.bind(null,n,e),a)},useLayoutEffect:function(e,n){return Jl(4194308,4,e,n)},useInsertionEffect:function(e,n){Jl(4,2,e,n)},useMemo:function(e,n){var a=jn();n=n===void 0?null:n;var o=e();if(Ps){Lt(!0);try{e()}finally{Lt(!1)}}return a.memoizedState=[o,n],o},useReducer:function(e,n,a){var o=jn();if(a!==void 0){var u=a(n);if(Ps){Lt(!0);try{a(n)}finally{Lt(!1)}}}else u=n;return o.memoizedState=o.baseState=u,e={pending:null,lanes:0,dispatch:null,lastRenderedReducer:e,lastRenderedState:u},o.queue=e,e=e.dispatch=DS.bind(null,Se,e),[o.memoizedState,e]},useRef:function(e){var n=jn();return e={current:e},n.memoizedState=e},useState:function(e){e=xf(e);var n=e.queue,a=g0.bind(null,Se,n);return n.dispatch=a,[e.memoizedState,a]},useDebugValue:Mf,useDeferredValue:function(e,n){var a=jn();return bf(a,e,n)},useTransition:function(){var e=xf(!1);return e=f0.bind(null,Se,e.queue,!0,!1),jn().memoizedState=e,[!1,e]},useSyncExternalStore:function(e,n,a){var o=Se,u=jn();if(Ue){if(a===void 0)throw Error(s(407));a=a()}else{if(a=n(),sn===null)throw Error(s(349));(Ce&127)!==0||Hm(o,n,a)}u.memoizedState=a;var h={value:a,getSnapshot:n};return u.queue=h,n0(Vm.bind(null,o,h,e),[e]),o.flags|=2048,Sr(9,{destroy:void 0},Gm.bind(null,o,h,a,n),null),a},useId:function(){var e=jn(),n=sn.identifierPrefix;if(Ue){var a=Ki,o=Zi;a=(o&~(1<<32-kt(o)-1)).toString(32)+a,n="_"+n+"R_"+a,a=ql++,0<a&&(n+="H"+a.toString(32)),n+="_"}else a=bS++,n="_"+n+"r_"+a.toString(32)+"_";return e.memoizedState=n},useHostTransitionStatus:Tf,useFormState:Qm,useActionState:Qm,useOptimistic:function(e){var n=jn();n.memoizedState=n.baseState=e;var a={pending:null,lanes:0,dispatch:null,lastRenderedReducer:null,lastRenderedState:null};return n.queue=a,n=Af.bind(null,Se,!0,a),a.dispatch=n,[e,n]},useMemoCache:gf,useCacheRefresh:function(){return jn().memoizedState=CS.bind(null,Se)},useEffectEvent:function(e){var n=jn(),a={impl:e};return n.memoizedState=a,function(){if((He&2)!==0)throw Error(s(440));return a.impl.apply(void 0,arguments)}}},wf={readContext:Fn,use:Zl,useCallback:l0,useContext:Fn,useEffect:yf,useImperativeHandle:o0,useInsertionEffect:a0,useLayoutEffect:s0,useMemo:c0,useReducer:Kl,useRef:e0,useState:function(){return Kl(_a)},useDebugValue:Mf,useDeferredValue:function(e,n){var a=Mn();return u0(a,Qe.memoizedState,e,n)},useTransition:function(){var e=Kl(_a)[0],n=Mn().memoizedState;return[typeof e=="boolean"?e:Ro(e),n]},useSyncExternalStore:Fm,useId:p0,useHostTransitionStatus:Tf,useFormState:jm,useActionState:jm,useOptimistic:function(e,n){var a=Mn();return Wm(a,Qe,e,n)},useMemoCache:gf,useCacheRefresh:m0};wf.useEffectEvent=i0;var S0={readContext:Fn,use:Zl,useCallback:l0,useContext:Fn,useEffect:yf,useImperativeHandle:o0,useInsertionEffect:a0,useLayoutEffect:s0,useMemo:c0,useReducer:vf,useRef:e0,useState:function(){return vf(_a)},useDebugValue:Mf,useDeferredValue:function(e,n){var a=Mn();return Qe===null?bf(a,e,n):u0(a,Qe.memoizedState,e,n)},useTransition:function(){var e=vf(_a)[0],n=Mn().memoizedState;return[typeof e=="boolean"?e:Ro(e),n]},useSyncExternalStore:Fm,useId:p0,useHostTransitionStatus:Tf,useFormState:t0,useActionState:t0,useOptimistic:function(e,n){var a=Mn();return Qe!==null?Wm(a,Qe,e,n):(a.baseState=e,[e,a.queue.dispatch])},useMemoCache:gf,useCacheRefresh:m0};S0.useEffectEvent=i0;function Rf(e,n,a,o){n=e.memoizedState,a=a(o,n),a=a==null?n:v({},n,a),e.memoizedState=a,e.lanes===0&&(e.updateQueue.baseState=a)}var Cf={enqueueSetState:function(e,n,a){e=e._reactInternals;var o=xi(),u=Za(o);u.payload=n,a!=null&&(u.callback=a),n=Ka(e,u,o),n!==null&&(ci(n,e,o),Eo(n,e,o))},enqueueReplaceState:function(e,n,a){e=e._reactInternals;var o=xi(),u=Za(o);u.tag=1,u.payload=n,a!=null&&(u.callback=a),n=Ka(e,u,o),n!==null&&(ci(n,e,o),Eo(n,e,o))},enqueueForceUpdate:function(e,n){e=e._reactInternals;var a=xi(),o=Za(a);o.tag=2,n!=null&&(o.callback=n),n=Ka(e,o,a),n!==null&&(ci(n,e,a),Eo(n,e,a))}};function y0(e,n,a,o,u,h,y){return e=e.stateNode,typeof e.shouldComponentUpdate=="function"?e.shouldComponentUpdate(o,h,y):n.prototype&&n.prototype.isPureReactComponent?!go(a,o)||!go(u,h):!0}function M0(e,n,a,o){e=n.state,typeof n.componentWillReceiveProps=="function"&&n.componentWillReceiveProps(a,o),typeof n.UNSAFE_componentWillReceiveProps=="function"&&n.UNSAFE_componentWillReceiveProps(a,o),n.state!==e&&Cf.enqueueReplaceState(n,n.state,null)}function zs(e,n){var a=n;if("ref"in n){a={};for(var o in n)o!=="ref"&&(a[o]=n[o])}if(e=e.defaultProps){a===n&&(a=v({},a));for(var u in e)a[u]===void 0&&(a[u]=e[u])}return a}function b0(e){Dl(e)}function E0(e){console.error(e)}function T0(e){Dl(e)}function $l(e,n){try{var a=e.onUncaughtError;a(n.value,{componentStack:n.stack})}catch(o){setTimeout(function(){throw o})}}function A0(e,n,a){try{var o=e.onCaughtError;o(a.value,{componentStack:a.stack,errorBoundary:n.tag===1?n.stateNode:null})}catch(u){setTimeout(function(){throw u})}}function Df(e,n,a){return a=Za(a),a.tag=3,a.payload={element:null},a.callback=function(){$l(e,n)},a}function w0(e){return e=Za(e),e.tag=3,e}function R0(e,n,a,o){var u=a.type.getDerivedStateFromError;if(typeof u=="function"){var h=o.value;e.payload=function(){return u(h)},e.callback=function(){A0(n,a,o)}}var y=a.stateNode;y!==null&&typeof y.componentDidCatch=="function"&&(e.callback=function(){A0(n,a,o),typeof u!="function"&&(es===null?es=new Set([this]):es.add(this));var C=o.stack;this.componentDidCatch(o.value,{componentStack:C!==null?C:""})})}function US(e,n,a,o,u){if(a.flags|=32768,o!==null&&typeof o=="object"&&typeof o.then=="function"){if(n=a.alternate,n!==null&&hr(n,a,u,!0),a=mi.current,a!==null){switch(a.tag){case 31:case 13:return Ni===null?fc():a.alternate===null&&xn===0&&(xn=3),a.flags&=-257,a.flags|=65536,a.lanes=u,o===Hl?a.flags|=16384:(n=a.updateQueue,n===null?a.updateQueue=new Set([o]):n.add(o),eh(e,o,u)),!1;case 22:return a.flags|=65536,o===Hl?a.flags|=16384:(n=a.updateQueue,n===null?(n={transitions:null,markerInstances:null,retryQueue:new Set([o])},a.updateQueue=n):(a=n.retryQueue,a===null?n.retryQueue=new Set([o]):a.add(o)),eh(e,o,u)),!1}throw Error(s(435,a.tag))}return eh(e,o,u),fc(),!1}if(Ue)return n=mi.current,n!==null?((n.flags&65536)===0&&(n.flags|=256),n.flags|=65536,n.lanes=u,o!==Zu&&(e=Error(s(422),{cause:o}),xo(Ri(e,a)))):(o!==Zu&&(n=Error(s(423),{cause:o}),xo(Ri(n,a))),e=e.current.alternate,e.flags|=65536,u&=-u,e.lanes|=u,o=Ri(o,a),u=Df(e.stateNode,o,u),rf(e,u),xn!==4&&(xn=2)),!1;var h=Error(s(520),{cause:o});if(h=Ri(h,a),Io===null?Io=[h]:Io.push(h),xn!==4&&(xn=2),n===null)return!0;o=Ri(o,a),a=n;do{switch(a.tag){case 3:return a.flags|=65536,e=u&-u,a.lanes|=e,e=Df(a.stateNode,o,e),rf(a,e),!1;case 1:if(n=a.type,h=a.stateNode,(a.flags&128)===0&&(typeof n.getDerivedStateFromError=="function"||h!==null&&typeof h.componentDidCatch=="function"&&(es===null||!es.has(h))))return a.flags|=65536,u&=-u,a.lanes|=u,u=w0(u),R0(u,e,a,o),rf(a,u),!1}a=a.return}while(a!==null);return!1}var Uf=Error(s(461)),An=!1;function Hn(e,n,a,o){n.child=e===null?Nm(n,null,a,o):Os(n,e.child,a,o)}function C0(e,n,a,o,u){a=a.render;var h=n.ref;if("ref"in o){var y={};for(var C in o)C!=="ref"&&(y[C]=o[C])}else y=o;return Ds(n),o=hf(e,n,a,y,h,u),C=df(),e!==null&&!An?(pf(e,n,u),va(e,n,u)):(Ue&&C&&qu(n),n.flags|=1,Hn(e,n,o,u),n.child)}function D0(e,n,a,o,u){if(e===null){var h=a.type;return typeof h=="function"&&!ku(h)&&h.defaultProps===void 0&&a.compare===null?(n.tag=15,n.type=h,U0(e,n,h,o,u)):(e=Ol(a.type,null,o,n,n.mode,u),e.ref=n.ref,e.return=n,n.child=e)}if(h=e.child,!Ff(e,u)){var y=h.memoizedProps;if(a=a.compare,a=a!==null?a:go,a(y,o)&&e.ref===n.ref)return va(e,n,u)}return n.flags|=1,e=ha(h,o),e.ref=n.ref,e.return=n,n.child=e}function U0(e,n,a,o,u){if(e!==null){var h=e.memoizedProps;if(go(h,o)&&e.ref===n.ref)if(An=!1,n.pendingProps=o=h,Ff(e,u))(e.flags&131072)!==0&&(An=!0);else return n.lanes=e.lanes,va(e,n,u)}return Nf(e,n,a,o,u)}function N0(e,n,a,o){var u=o.children,h=e!==null?e.memoizedState:null;if(e===null&&n.stateNode===null&&(n.stateNode={_visibility:1,_pendingMarkers:null,_retryCache:null,_transitions:null}),o.mode==="hidden"){if((n.flags&128)!==0){if(h=h!==null?h.baseLanes|a:a,e!==null){for(o=n.child=e.child,u=0;o!==null;)u=u|o.lanes|o.childLanes,o=o.sibling;o=u&~h}else o=0,n.child=null;return L0(e,n,h,a,o)}if((a&536870912)!==0)n.memoizedState={baseLanes:0,cachePool:null},e!==null&&Il(n,h!==null?h.cachePool:null),h!==null?Pm(n,h):lf(),zm(n);else return o=n.lanes=536870912,L0(e,n,h!==null?h.baseLanes|a:a,a,o)}else h!==null?(Il(n,h.cachePool),Pm(n,h),Qa(),n.memoizedState=null):(e!==null&&Il(n,null),lf(),Qa());return Hn(e,n,u,a),n.child}function Uo(e,n){return e!==null&&e.tag===22||n.stateNode!==null||(n.stateNode={_visibility:1,_pendingMarkers:null,_retryCache:null,_transitions:null}),n.sibling}function L0(e,n,a,o,u){var h=ef();return h=h===null?null:{parent:En._currentValue,pool:h},n.memoizedState={baseLanes:a,cachePool:h},e!==null&&Il(n,null),lf(),zm(n),e!==null&&hr(e,n,o,!0),n.childLanes=u,null}function tc(e,n){return n=nc({mode:n.mode,children:n.children},e.mode),n.ref=e.ref,e.child=n,n.return=e,n}function O0(e,n,a){return Os(n,e.child,null,a),e=tc(n,n.pendingProps),e.flags|=2,gi(n),n.memoizedState=null,e}function NS(e,n,a){var o=n.pendingProps,u=(n.flags&128)!==0;if(n.flags&=-129,e===null){if(Ue){if(o.mode==="hidden")return e=tc(n,o),n.lanes=536870912,Uo(null,e);if(uf(n),(e=on)?(e=qg(e,Ui),e=e!==null&&e.data==="&"?e:null,e!==null&&(n.memoizedState={dehydrated:e,treeContext:ka!==null?{id:Zi,overflow:Ki}:null,retryLane:536870912,hydrationErrors:null},a=_m(e),a.return=n,n.child=a,In=n,on=null)):e=null,e===null)throw Wa(n);return n.lanes=536870912,null}return tc(n,o)}var h=e.memoizedState;if(h!==null){var y=h.dehydrated;if(uf(n),u)if(n.flags&256)n.flags&=-257,n=O0(e,n,a);else if(n.memoizedState!==null)n.child=e.child,n.flags|=128,n=null;else throw Error(s(558));else if(An||hr(e,n,a,!1),u=(a&e.childLanes)!==0,An||u){if(o=sn,o!==null&&(y=ee(o,a),y!==0&&y!==h.retryLane))throw h.retryLane=y,As(e,y),ci(o,e,y),Uf;fc(),n=O0(e,n,a)}else e=h.treeContext,on=Li(y.nextSibling),In=n,Ue=!0,Xa=null,Ui=!1,e!==null&&Sm(n,e),n=tc(n,o),n.flags|=4096;return n}return e=ha(e.child,{mode:o.mode,children:o.children}),e.ref=n.ref,n.child=e,e.return=n,e}function ec(e,n){var a=n.ref;if(a===null)e!==null&&e.ref!==null&&(n.flags|=4194816);else{if(typeof a!="function"&&typeof a!="object")throw Error(s(284));(e===null||e.ref!==a)&&(n.flags|=4194816)}}function Nf(e,n,a,o,u){return Ds(n),a=hf(e,n,a,o,void 0,u),o=df(),e!==null&&!An?(pf(e,n,u),va(e,n,u)):(Ue&&o&&qu(n),n.flags|=1,Hn(e,n,a,u),n.child)}function P0(e,n,a,o,u,h){return Ds(n),n.updateQueue=null,a=Im(n,o,a,u),Bm(e),o=df(),e!==null&&!An?(pf(e,n,h),va(e,n,h)):(Ue&&o&&qu(n),n.flags|=1,Hn(e,n,a,h),n.child)}function z0(e,n,a,o,u){if(Ds(n),n.stateNode===null){var h=lr,y=a.contextType;typeof y=="object"&&y!==null&&(h=Fn(y)),h=new a(o,h),n.memoizedState=h.state!==null&&h.state!==void 0?h.state:null,h.updater=Cf,n.stateNode=h,h._reactInternals=n,h=n.stateNode,h.props=o,h.state=n.memoizedState,h.refs={},af(n),y=a.contextType,h.context=typeof y=="object"&&y!==null?Fn(y):lr,h.state=n.memoizedState,y=a.getDerivedStateFromProps,typeof y=="function"&&(Rf(n,a,y,o),h.state=n.memoizedState),typeof a.getDerivedStateFromProps=="function"||typeof h.getSnapshotBeforeUpdate=="function"||typeof h.UNSAFE_componentWillMount!="function"&&typeof h.componentWillMount!="function"||(y=h.state,typeof h.componentWillMount=="function"&&h.componentWillMount(),typeof h.UNSAFE_componentWillMount=="function"&&h.UNSAFE_componentWillMount(),y!==h.state&&Cf.enqueueReplaceState(h,h.state,null),Ao(n,o,h,u),To(),h.state=n.memoizedState),typeof h.componentDidMount=="function"&&(n.flags|=4194308),o=!0}else if(e===null){h=n.stateNode;var C=n.memoizedProps,G=zs(a,C);h.props=G;var it=h.context,xt=a.contextType;y=lr,typeof xt=="object"&&xt!==null&&(y=Fn(xt));var Mt=a.getDerivedStateFromProps;xt=typeof Mt=="function"||typeof h.getSnapshotBeforeUpdate=="function",C=n.pendingProps!==C,xt||typeof h.UNSAFE_componentWillReceiveProps!="function"&&typeof h.componentWillReceiveProps!="function"||(C||it!==y)&&M0(n,h,o,y),Ya=!1;var lt=n.memoizedState;h.state=lt,Ao(n,o,h,u),To(),it=n.memoizedState,C||lt!==it||Ya?(typeof Mt=="function"&&(Rf(n,a,Mt,o),it=n.memoizedState),(G=Ya||y0(n,a,G,o,lt,it,y))?(xt||typeof h.UNSAFE_componentWillMount!="function"&&typeof h.componentWillMount!="function"||(typeof h.componentWillMount=="function"&&h.componentWillMount(),typeof h.UNSAFE_componentWillMount=="function"&&h.UNSAFE_componentWillMount()),typeof h.componentDidMount=="function"&&(n.flags|=4194308)):(typeof h.componentDidMount=="function"&&(n.flags|=4194308),n.memoizedProps=o,n.memoizedState=it),h.props=o,h.state=it,h.context=y,o=G):(typeof h.componentDidMount=="function"&&(n.flags|=4194308),o=!1)}else{h=n.stateNode,sf(e,n),y=n.memoizedProps,xt=zs(a,y),h.props=xt,Mt=n.pendingProps,lt=h.context,it=a.contextType,G=lr,typeof it=="object"&&it!==null&&(G=Fn(it)),C=a.getDerivedStateFromProps,(it=typeof C=="function"||typeof h.getSnapshotBeforeUpdate=="function")||typeof h.UNSAFE_componentWillReceiveProps!="function"&&typeof h.componentWillReceiveProps!="function"||(y!==Mt||lt!==G)&&M0(n,h,o,G),Ya=!1,lt=n.memoizedState,h.state=lt,Ao(n,o,h,u),To();var dt=n.memoizedState;y!==Mt||lt!==dt||Ya||e!==null&&e.dependencies!==null&&zl(e.dependencies)?(typeof C=="function"&&(Rf(n,a,C,o),dt=n.memoizedState),(xt=Ya||y0(n,a,xt,o,lt,dt,G)||e!==null&&e.dependencies!==null&&zl(e.dependencies))?(it||typeof h.UNSAFE_componentWillUpdate!="function"&&typeof h.componentWillUpdate!="function"||(typeof h.componentWillUpdate=="function"&&h.componentWillUpdate(o,dt,G),typeof h.UNSAFE_componentWillUpdate=="function"&&h.UNSAFE_componentWillUpdate(o,dt,G)),typeof h.componentDidUpdate=="function"&&(n.flags|=4),typeof h.getSnapshotBeforeUpdate=="function"&&(n.flags|=1024)):(typeof h.componentDidUpdate!="function"||y===e.memoizedProps&&lt===e.memoizedState||(n.flags|=4),typeof h.getSnapshotBeforeUpdate!="function"||y===e.memoizedProps&&lt===e.memoizedState||(n.flags|=1024),n.memoizedProps=o,n.memoizedState=dt),h.props=o,h.state=dt,h.context=G,o=xt):(typeof h.componentDidUpdate!="function"||y===e.memoizedProps&&lt===e.memoizedState||(n.flags|=4),typeof h.getSnapshotBeforeUpdate!="function"||y===e.memoizedProps&&lt===e.memoizedState||(n.flags|=1024),o=!1)}return h=o,ec(e,n),o=(n.flags&128)!==0,h||o?(h=n.stateNode,a=o&&typeof a.getDerivedStateFromError!="function"?null:h.render(),n.flags|=1,e!==null&&o?(n.child=Os(n,e.child,null,u),n.child=Os(n,null,a,u)):Hn(e,n,a,u),n.memoizedState=h.state,e=n.child):e=va(e,n,u),e}function B0(e,n,a,o){return Rs(),n.flags|=256,Hn(e,n,a,o),n.child}var Lf={dehydrated:null,treeContext:null,retryLane:0,hydrationErrors:null};function Of(e){return{baseLanes:e,cachePool:Am()}}function Pf(e,n,a){return e=e!==null?e.childLanes&~a:0,n&&(e|=vi),e}function I0(e,n,a){var o=n.pendingProps,u=!1,h=(n.flags&128)!==0,y;if((y=h)||(y=e!==null&&e.memoizedState===null?!1:(yn.current&2)!==0),y&&(u=!0,n.flags&=-129),y=(n.flags&32)!==0,n.flags&=-33,e===null){if(Ue){if(u?Ja(n):Qa(),(e=on)?(e=qg(e,Ui),e=e!==null&&e.data!=="&"?e:null,e!==null&&(n.memoizedState={dehydrated:e,treeContext:ka!==null?{id:Zi,overflow:Ki}:null,retryLane:536870912,hydrationErrors:null},a=_m(e),a.return=n,n.child=a,In=n,on=null)):e=null,e===null)throw Wa(n);return _h(e)?n.lanes=32:n.lanes=536870912,null}var C=o.children;return o=o.fallback,u?(Qa(),u=n.mode,C=nc({mode:"hidden",children:C},u),o=ws(o,u,a,null),C.return=n,o.return=n,C.sibling=o,n.child=C,o=n.child,o.memoizedState=Of(a),o.childLanes=Pf(e,y,a),n.memoizedState=Lf,Uo(null,o)):(Ja(n),zf(n,C))}var G=e.memoizedState;if(G!==null&&(C=G.dehydrated,C!==null)){if(h)n.flags&256?(Ja(n),n.flags&=-257,n=Bf(e,n,a)):n.memoizedState!==null?(Qa(),n.child=e.child,n.flags|=128,n=null):(Qa(),C=o.fallback,u=n.mode,o=nc({mode:"visible",children:o.children},u),C=ws(C,u,a,null),C.flags|=2,o.return=n,C.return=n,o.sibling=C,n.child=o,Os(n,e.child,null,a),o=n.child,o.memoizedState=Of(a),o.childLanes=Pf(e,y,a),n.memoizedState=Lf,n=Uo(null,o));else if(Ja(n),_h(C)){if(y=C.nextSibling&&C.nextSibling.dataset,y)var it=y.dgst;y=it,o=Error(s(419)),o.stack="",o.digest=y,xo({value:o,source:null,stack:null}),n=Bf(e,n,a)}else if(An||hr(e,n,a,!1),y=(a&e.childLanes)!==0,An||y){if(y=sn,y!==null&&(o=ee(y,a),o!==0&&o!==G.retryLane))throw G.retryLane=o,As(e,o),ci(y,e,o),Uf;gh(C)||fc(),n=Bf(e,n,a)}else gh(C)?(n.flags|=192,n.child=e.child,n=null):(e=G.treeContext,on=Li(C.nextSibling),In=n,Ue=!0,Xa=null,Ui=!1,e!==null&&Sm(n,e),n=zf(n,o.children),n.flags|=4096);return n}return u?(Qa(),C=o.fallback,u=n.mode,G=e.child,it=G.sibling,o=ha(G,{mode:"hidden",children:o.children}),o.subtreeFlags=G.subtreeFlags&65011712,it!==null?C=ha(it,C):(C=ws(C,u,a,null),C.flags|=2),C.return=n,o.return=n,o.sibling=C,n.child=o,Uo(null,o),o=n.child,C=e.child.memoizedState,C===null?C=Of(a):(u=C.cachePool,u!==null?(G=En._currentValue,u=u.parent!==G?{parent:G,pool:G}:u):u=Am(),C={baseLanes:C.baseLanes|a,cachePool:u}),o.memoizedState=C,o.childLanes=Pf(e,y,a),n.memoizedState=Lf,Uo(e.child,o)):(Ja(n),a=e.child,e=a.sibling,a=ha(a,{mode:"visible",children:o.children}),a.return=n,a.sibling=null,e!==null&&(y=n.deletions,y===null?(n.deletions=[e],n.flags|=16):y.push(e)),n.child=a,n.memoizedState=null,a)}function zf(e,n){return n=nc({mode:"visible",children:n},e.mode),n.return=e,e.child=n}function nc(e,n){return e=pi(22,e,null,n),e.lanes=0,e}function Bf(e,n,a){return Os(n,e.child,null,a),e=zf(n,n.pendingProps.children),e.flags|=2,n.memoizedState=null,e}function F0(e,n,a){e.lanes|=n;var o=e.alternate;o!==null&&(o.lanes|=n),Qu(e.return,n,a)}function If(e,n,a,o,u,h){var y=e.memoizedState;y===null?e.memoizedState={isBackwards:n,rendering:null,renderingStartTime:0,last:o,tail:a,tailMode:u,treeForkCount:h}:(y.isBackwards=n,y.rendering=null,y.renderingStartTime=0,y.last=o,y.tail=a,y.tailMode=u,y.treeForkCount=h)}function H0(e,n,a){var o=n.pendingProps,u=o.revealOrder,h=o.tail;o=o.children;var y=yn.current,C=(y&2)!==0;if(C?(y=y&1|2,n.flags|=128):y&=1,bt(yn,y),Hn(e,n,o,a),o=Ue?vo:0,!C&&e!==null&&(e.flags&128)!==0)t:for(e=n.child;e!==null;){if(e.tag===13)e.memoizedState!==null&&F0(e,a,n);else if(e.tag===19)F0(e,a,n);else if(e.child!==null){e.child.return=e,e=e.child;continue}if(e===n)break t;for(;e.sibling===null;){if(e.return===null||e.return===n)break t;e=e.return}e.sibling.return=e.return,e=e.sibling}switch(u){case"forwards":for(a=n.child,u=null;a!==null;)e=a.alternate,e!==null&&Xl(e)===null&&(u=a),a=a.sibling;a=u,a===null?(u=n.child,n.child=null):(u=a.sibling,a.sibling=null),If(n,!1,u,a,h,o);break;case"backwards":case"unstable_legacy-backwards":for(a=null,u=n.child,n.child=null;u!==null;){if(e=u.alternate,e!==null&&Xl(e)===null){n.child=u;break}e=u.sibling,u.sibling=a,a=u,u=e}If(n,!0,a,null,h,o);break;case"together":If(n,!1,null,null,void 0,o);break;default:n.memoizedState=null}return n.child}function va(e,n,a){if(e!==null&&(n.dependencies=e.dependencies),ts|=n.lanes,(a&n.childLanes)===0)if(e!==null){if(hr(e,n,a,!1),(a&n.childLanes)===0)return null}else return null;if(e!==null&&n.child!==e.child)throw Error(s(153));if(n.child!==null){for(e=n.child,a=ha(e,e.pendingProps),n.child=a,a.return=n;e.sibling!==null;)e=e.sibling,a=a.sibling=ha(e,e.pendingProps),a.return=n;a.sibling=null}return n.child}function Ff(e,n){return(e.lanes&n)!==0?!0:(e=e.dependencies,!!(e!==null&&zl(e)))}function LS(e,n,a){switch(n.tag){case 3:Q(n,n.stateNode.containerInfo),qa(n,En,e.memoizedState.cache),Rs();break;case 27:case 5:zt(n);break;case 4:Q(n,n.stateNode.containerInfo);break;case 10:qa(n,n.type,n.memoizedProps.value);break;case 31:if(n.memoizedState!==null)return n.flags|=128,uf(n),null;break;case 13:var o=n.memoizedState;if(o!==null)return o.dehydrated!==null?(Ja(n),n.flags|=128,null):(a&n.child.childLanes)!==0?I0(e,n,a):(Ja(n),e=va(e,n,a),e!==null?e.sibling:null);Ja(n);break;case 19:var u=(e.flags&128)!==0;if(o=(a&n.childLanes)!==0,o||(hr(e,n,a,!1),o=(a&n.childLanes)!==0),u){if(o)return H0(e,n,a);n.flags|=128}if(u=n.memoizedState,u!==null&&(u.rendering=null,u.tail=null,u.lastEffect=null),bt(yn,yn.current),o)break;return null;case 22:return n.lanes=0,N0(e,n,a,n.pendingProps);case 24:qa(n,En,e.memoizedState.cache)}return va(e,n,a)}function G0(e,n,a){if(e!==null)if(e.memoizedProps!==n.pendingProps)An=!0;else{if(!Ff(e,a)&&(n.flags&128)===0)return An=!1,LS(e,n,a);An=(e.flags&131072)!==0}else An=!1,Ue&&(n.flags&1048576)!==0&&xm(n,vo,n.index);switch(n.lanes=0,n.tag){case 16:t:{var o=n.pendingProps;if(e=Ns(n.elementType),n.type=e,typeof e=="function")ku(e)?(o=zs(e,o),n.tag=1,n=z0(null,n,e,o,a)):(n.tag=0,n=Nf(null,n,e,o,a));else{if(e!=null){var u=e.$$typeof;if(u===w){n.tag=11,n=C0(null,n,e,o,a);break t}else if(u===L){n.tag=14,n=D0(null,n,e,o,a);break t}}throw n=ut(e)||e,Error(s(306,n,""))}}return n;case 0:return Nf(e,n,n.type,n.pendingProps,a);case 1:return o=n.type,u=zs(o,n.pendingProps),z0(e,n,o,u,a);case 3:t:{if(Q(n,n.stateNode.containerInfo),e===null)throw Error(s(387));o=n.pendingProps;var h=n.memoizedState;u=h.element,sf(e,n),Ao(n,o,null,a);var y=n.memoizedState;if(o=y.cache,qa(n,En,o),o!==h.cache&&ju(n,[En],a,!0),To(),o=y.element,h.isDehydrated)if(h={element:o,isDehydrated:!1,cache:y.cache},n.updateQueue.baseState=h,n.memoizedState=h,n.flags&256){n=B0(e,n,o,a);break t}else if(o!==u){u=Ri(Error(s(424)),n),xo(u),n=B0(e,n,o,a);break t}else{switch(e=n.stateNode.containerInfo,e.nodeType){case 9:e=e.body;break;default:e=e.nodeName==="HTML"?e.ownerDocument.body:e}for(on=Li(e.firstChild),In=n,Ue=!0,Xa=null,Ui=!0,a=Nm(n,null,o,a),n.child=a;a;)a.flags=a.flags&-3|4096,a=a.sibling}else{if(Rs(),o===u){n=va(e,n,a);break t}Hn(e,n,o,a)}n=n.child}return n;case 26:return ec(e,n),e===null?(a=jg(n.type,null,n.pendingProps,null))?n.memoizedState=a:Ue||(a=n.type,e=n.pendingProps,o=vc(et.current).createElement(a),o[fn]=n,o[_n]=e,Gn(o,a,e),bn(o),n.stateNode=o):n.memoizedState=jg(n.type,e.memoizedProps,n.pendingProps,e.memoizedState),null;case 27:return zt(n),e===null&&Ue&&(o=n.stateNode=Kg(n.type,n.pendingProps,et.current),In=n,Ui=!0,u=on,ss(n.type)?(vh=u,on=Li(o.firstChild)):on=u),Hn(e,n,n.pendingProps.children,a),ec(e,n),e===null&&(n.flags|=4194304),n.child;case 5:return e===null&&Ue&&((u=o=on)&&(o=cy(o,n.type,n.pendingProps,Ui),o!==null?(n.stateNode=o,In=n,on=Li(o.firstChild),Ui=!1,u=!0):u=!1),u||Wa(n)),zt(n),u=n.type,h=n.pendingProps,y=e!==null?e.memoizedProps:null,o=h.children,dh(u,h)?o=null:y!==null&&dh(u,y)&&(n.flags|=32),n.memoizedState!==null&&(u=hf(e,n,ES,null,null,a),qo._currentValue=u),ec(e,n),Hn(e,n,o,a),n.child;case 6:return e===null&&Ue&&((e=a=on)&&(a=uy(a,n.pendingProps,Ui),a!==null?(n.stateNode=a,In=n,on=null,e=!0):e=!1),e||Wa(n)),null;case 13:return I0(e,n,a);case 4:return Q(n,n.stateNode.containerInfo),o=n.pendingProps,e===null?n.child=Os(n,null,o,a):Hn(e,n,o,a),n.child;case 11:return C0(e,n,n.type,n.pendingProps,a);case 7:return Hn(e,n,n.pendingProps,a),n.child;case 8:return Hn(e,n,n.pendingProps.children,a),n.child;case 12:return Hn(e,n,n.pendingProps.children,a),n.child;case 10:return o=n.pendingProps,qa(n,n.type,o.value),Hn(e,n,o.children,a),n.child;case 9:return u=n.type._context,o=n.pendingProps.children,Ds(n),u=Fn(u),o=o(u),n.flags|=1,Hn(e,n,o,a),n.child;case 14:return D0(e,n,n.type,n.pendingProps,a);case 15:return U0(e,n,n.type,n.pendingProps,a);case 19:return H0(e,n,a);case 31:return NS(e,n,a);case 22:return N0(e,n,a,n.pendingProps);case 24:return Ds(n),o=Fn(En),e===null?(u=ef(),u===null&&(u=sn,h=$u(),u.pooledCache=h,h.refCount++,h!==null&&(u.pooledCacheLanes|=a),u=h),n.memoizedState={parent:o,cache:u},af(n),qa(n,En,u)):((e.lanes&a)!==0&&(sf(e,n),Ao(n,null,null,a),To()),u=e.memoizedState,h=n.memoizedState,u.parent!==o?(u={parent:o,cache:o},n.memoizedState=u,n.lanes===0&&(n.memoizedState=n.updateQueue.baseState=u),qa(n,En,o)):(o=h.cache,qa(n,En,o),o!==u.cache&&ju(n,[En],a,!0))),Hn(e,n,n.pendingProps.children,a),n.child;case 29:throw n.pendingProps}throw Error(s(156,n.tag))}function xa(e){e.flags|=4}function Hf(e,n,a,o,u){if((n=(e.mode&32)!==0)&&(n=!1),n){if(e.flags|=16777216,(u&335544128)===u)if(e.stateNode.complete)e.flags|=8192;else if(pg())e.flags|=8192;else throw Ls=Hl,nf}else e.flags&=-16777217}function V0(e,n){if(n.type!=="stylesheet"||(n.state.loading&4)!==0)e.flags&=-16777217;else if(e.flags|=16777216,!i_(n))if(pg())e.flags|=8192;else throw Ls=Hl,nf}function ic(e,n){n!==null&&(e.flags|=4),e.flags&16384&&(n=e.tag!==22?Tt():536870912,e.lanes|=n,Er|=n)}function No(e,n){if(!Ue)switch(e.tailMode){case"hidden":n=e.tail;for(var a=null;n!==null;)n.alternate!==null&&(a=n),n=n.sibling;a===null?e.tail=null:a.sibling=null;break;case"collapsed":a=e.tail;for(var o=null;a!==null;)a.alternate!==null&&(o=a),a=a.sibling;o===null?n||e.tail===null?e.tail=null:e.tail.sibling=null:o.sibling=null}}function ln(e){var n=e.alternate!==null&&e.alternate.child===e.child,a=0,o=0;if(n)for(var u=e.child;u!==null;)a|=u.lanes|u.childLanes,o|=u.subtreeFlags&65011712,o|=u.flags&65011712,u.return=e,u=u.sibling;else for(u=e.child;u!==null;)a|=u.lanes|u.childLanes,o|=u.subtreeFlags,o|=u.flags,u.return=e,u=u.sibling;return e.subtreeFlags|=o,e.childLanes=a,n}function OS(e,n,a){var o=n.pendingProps;switch(Yu(n),n.tag){case 16:case 15:case 0:case 11:case 7:case 8:case 12:case 9:case 14:return ln(n),null;case 1:return ln(n),null;case 3:return a=n.stateNode,o=null,e!==null&&(o=e.memoizedState.cache),n.memoizedState.cache!==o&&(n.flags|=2048),ma(En),gt(),a.pendingContext&&(a.context=a.pendingContext,a.pendingContext=null),(e===null||e.child===null)&&(fr(n)?xa(n):e===null||e.memoizedState.isDehydrated&&(n.flags&256)===0||(n.flags|=1024,Ku())),ln(n),null;case 26:var u=n.type,h=n.memoizedState;return e===null?(xa(n),h!==null?(ln(n),V0(n,h)):(ln(n),Hf(n,u,null,o,a))):h?h!==e.memoizedState?(xa(n),ln(n),V0(n,h)):(ln(n),n.flags&=-16777217):(e=e.memoizedProps,e!==o&&xa(n),ln(n),Hf(n,u,e,o,a)),null;case 27:if(At(n),a=et.current,u=n.type,e!==null&&n.stateNode!=null)e.memoizedProps!==o&&xa(n);else{if(!o){if(n.stateNode===null)throw Error(s(166));return ln(n),null}e=Rt.current,fr(n)?ym(n):(e=Kg(u,o,a),n.stateNode=e,xa(n))}return ln(n),null;case 5:if(At(n),u=n.type,e!==null&&n.stateNode!=null)e.memoizedProps!==o&&xa(n);else{if(!o){if(n.stateNode===null)throw Error(s(166));return ln(n),null}if(h=Rt.current,fr(n))ym(n);else{var y=vc(et.current);switch(h){case 1:h=y.createElementNS("http://www.w3.org/2000/svg",u);break;case 2:h=y.createElementNS("http://www.w3.org/1998/Math/MathML",u);break;default:switch(u){case"svg":h=y.createElementNS("http://www.w3.org/2000/svg",u);break;case"math":h=y.createElementNS("http://www.w3.org/1998/Math/MathML",u);break;case"script":h=y.createElement("div"),h.innerHTML="<script><\/script>",h=h.removeChild(h.firstChild);break;case"select":h=typeof o.is=="string"?y.createElement("select",{is:o.is}):y.createElement("select"),o.multiple?h.multiple=!0:o.size&&(h.size=o.size);break;default:h=typeof o.is=="string"?y.createElement(u,{is:o.is}):y.createElement(u)}}h[fn]=n,h[_n]=o;t:for(y=n.child;y!==null;){if(y.tag===5||y.tag===6)h.appendChild(y.stateNode);else if(y.tag!==4&&y.tag!==27&&y.child!==null){y.child.return=y,y=y.child;continue}if(y===n)break t;for(;y.sibling===null;){if(y.return===null||y.return===n)break t;y=y.return}y.sibling.return=y.return,y=y.sibling}n.stateNode=h;t:switch(Gn(h,u,o),u){case"button":case"input":case"select":case"textarea":o=!!o.autoFocus;break t;case"img":o=!0;break t;default:o=!1}o&&xa(n)}}return ln(n),Hf(n,n.type,e===null?null:e.memoizedProps,n.pendingProps,a),null;case 6:if(e&&n.stateNode!=null)e.memoizedProps!==o&&xa(n);else{if(typeof o!="string"&&n.stateNode===null)throw Error(s(166));if(e=et.current,fr(n)){if(e=n.stateNode,a=n.memoizedProps,o=null,u=In,u!==null)switch(u.tag){case 27:case 5:o=u.memoizedProps}e[fn]=n,e=!!(e.nodeValue===a||o!==null&&o.suppressHydrationWarning===!0||Ig(e.nodeValue,a)),e||Wa(n,!0)}else e=vc(e).createTextNode(o),e[fn]=n,n.stateNode=e}return ln(n),null;case 31:if(a=n.memoizedState,e===null||e.memoizedState!==null){if(o=fr(n),a!==null){if(e===null){if(!o)throw Error(s(318));if(e=n.memoizedState,e=e!==null?e.dehydrated:null,!e)throw Error(s(557));e[fn]=n}else Rs(),(n.flags&128)===0&&(n.memoizedState=null),n.flags|=4;ln(n),e=!1}else a=Ku(),e!==null&&e.memoizedState!==null&&(e.memoizedState.hydrationErrors=a),e=!0;if(!e)return n.flags&256?(gi(n),n):(gi(n),null);if((n.flags&128)!==0)throw Error(s(558))}return ln(n),null;case 13:if(o=n.memoizedState,e===null||e.memoizedState!==null&&e.memoizedState.dehydrated!==null){if(u=fr(n),o!==null&&o.dehydrated!==null){if(e===null){if(!u)throw Error(s(318));if(u=n.memoizedState,u=u!==null?u.dehydrated:null,!u)throw Error(s(317));u[fn]=n}else Rs(),(n.flags&128)===0&&(n.memoizedState=null),n.flags|=4;ln(n),u=!1}else u=Ku(),e!==null&&e.memoizedState!==null&&(e.memoizedState.hydrationErrors=u),u=!0;if(!u)return n.flags&256?(gi(n),n):(gi(n),null)}return gi(n),(n.flags&128)!==0?(n.lanes=a,n):(a=o!==null,e=e!==null&&e.memoizedState!==null,a&&(o=n.child,u=null,o.alternate!==null&&o.alternate.memoizedState!==null&&o.alternate.memoizedState.cachePool!==null&&(u=o.alternate.memoizedState.cachePool.pool),h=null,o.memoizedState!==null&&o.memoizedState.cachePool!==null&&(h=o.memoizedState.cachePool.pool),h!==u&&(o.flags|=2048)),a!==e&&a&&(n.child.flags|=8192),ic(n,n.updateQueue),ln(n),null);case 4:return gt(),e===null&&lh(n.stateNode.containerInfo),ln(n),null;case 10:return ma(n.type),ln(n),null;case 19:if(J(yn),o=n.memoizedState,o===null)return ln(n),null;if(u=(n.flags&128)!==0,h=o.rendering,h===null)if(u)No(o,!1);else{if(xn!==0||e!==null&&(e.flags&128)!==0)for(e=n.child;e!==null;){if(h=Xl(e),h!==null){for(n.flags|=128,No(o,!1),e=h.updateQueue,n.updateQueue=e,ic(n,e),n.subtreeFlags=0,e=a,a=n.child;a!==null;)gm(a,e),a=a.sibling;return bt(yn,yn.current&1|2),Ue&&da(n,o.treeForkCount),n.child}e=e.sibling}o.tail!==null&&Me()>lc&&(n.flags|=128,u=!0,No(o,!1),n.lanes=4194304)}else{if(!u)if(e=Xl(h),e!==null){if(n.flags|=128,u=!0,e=e.updateQueue,n.updateQueue=e,ic(n,e),No(o,!0),o.tail===null&&o.tailMode==="hidden"&&!h.alternate&&!Ue)return ln(n),null}else 2*Me()-o.renderingStartTime>lc&&a!==536870912&&(n.flags|=128,u=!0,No(o,!1),n.lanes=4194304);o.isBackwards?(h.sibling=n.child,n.child=h):(e=o.last,e!==null?e.sibling=h:n.child=h,o.last=h)}return o.tail!==null?(e=o.tail,o.rendering=e,o.tail=e.sibling,o.renderingStartTime=Me(),e.sibling=null,a=yn.current,bt(yn,u?a&1|2:a&1),Ue&&da(n,o.treeForkCount),e):(ln(n),null);case 22:case 23:return gi(n),cf(),o=n.memoizedState!==null,e!==null?e.memoizedState!==null!==o&&(n.flags|=8192):o&&(n.flags|=8192),o?(a&536870912)!==0&&(n.flags&128)===0&&(ln(n),n.subtreeFlags&6&&(n.flags|=8192)):ln(n),a=n.updateQueue,a!==null&&ic(n,a.retryQueue),a=null,e!==null&&e.memoizedState!==null&&e.memoizedState.cachePool!==null&&(a=e.memoizedState.cachePool.pool),o=null,n.memoizedState!==null&&n.memoizedState.cachePool!==null&&(o=n.memoizedState.cachePool.pool),o!==a&&(n.flags|=2048),e!==null&&J(Us),null;case 24:return a=null,e!==null&&(a=e.memoizedState.cache),n.memoizedState.cache!==a&&(n.flags|=2048),ma(En),ln(n),null;case 25:return null;case 30:return null}throw Error(s(156,n.tag))}function PS(e,n){switch(Yu(n),n.tag){case 1:return e=n.flags,e&65536?(n.flags=e&-65537|128,n):null;case 3:return ma(En),gt(),e=n.flags,(e&65536)!==0&&(e&128)===0?(n.flags=e&-65537|128,n):null;case 26:case 27:case 5:return At(n),null;case 31:if(n.memoizedState!==null){if(gi(n),n.alternate===null)throw Error(s(340));Rs()}return e=n.flags,e&65536?(n.flags=e&-65537|128,n):null;case 13:if(gi(n),e=n.memoizedState,e!==null&&e.dehydrated!==null){if(n.alternate===null)throw Error(s(340));Rs()}return e=n.flags,e&65536?(n.flags=e&-65537|128,n):null;case 19:return J(yn),null;case 4:return gt(),null;case 10:return ma(n.type),null;case 22:case 23:return gi(n),cf(),e!==null&&J(Us),e=n.flags,e&65536?(n.flags=e&-65537|128,n):null;case 24:return ma(En),null;case 25:return null;default:return null}}function k0(e,n){switch(Yu(n),n.tag){case 3:ma(En),gt();break;case 26:case 27:case 5:At(n);break;case 4:gt();break;case 31:n.memoizedState!==null&&gi(n);break;case 13:gi(n);break;case 19:J(yn);break;case 10:ma(n.type);break;case 22:case 23:gi(n),cf(),e!==null&&J(Us);break;case 24:ma(En)}}function Lo(e,n){try{var a=n.updateQueue,o=a!==null?a.lastEffect:null;if(o!==null){var u=o.next;a=u;do{if((a.tag&e)===e){o=void 0;var h=a.create,y=a.inst;o=h(),y.destroy=o}a=a.next}while(a!==u)}}catch(C){Ke(n,n.return,C)}}function ja(e,n,a){try{var o=n.updateQueue,u=o!==null?o.lastEffect:null;if(u!==null){var h=u.next;o=h;do{if((o.tag&e)===e){var y=o.inst,C=y.destroy;if(C!==void 0){y.destroy=void 0,u=n;var G=a,it=C;try{it()}catch(xt){Ke(u,G,xt)}}}o=o.next}while(o!==h)}}catch(xt){Ke(n,n.return,xt)}}function X0(e){var n=e.updateQueue;if(n!==null){var a=e.stateNode;try{Om(n,a)}catch(o){Ke(e,e.return,o)}}}function W0(e,n,a){a.props=zs(e.type,e.memoizedProps),a.state=e.memoizedState;try{a.componentWillUnmount()}catch(o){Ke(e,n,o)}}function Oo(e,n){try{var a=e.ref;if(a!==null){switch(e.tag){case 26:case 27:case 5:var o=e.stateNode;break;case 30:o=e.stateNode;break;default:o=e.stateNode}typeof a=="function"?e.refCleanup=a(o):a.current=o}}catch(u){Ke(e,n,u)}}function Ji(e,n){var a=e.ref,o=e.refCleanup;if(a!==null)if(typeof o=="function")try{o()}catch(u){Ke(e,n,u)}finally{e.refCleanup=null,e=e.alternate,e!=null&&(e.refCleanup=null)}else if(typeof a=="function")try{a(null)}catch(u){Ke(e,n,u)}else a.current=null}function q0(e){var n=e.type,a=e.memoizedProps,o=e.stateNode;try{t:switch(n){case"button":case"input":case"select":case"textarea":a.autoFocus&&o.focus();break t;case"img":a.src?o.src=a.src:a.srcSet&&(o.srcset=a.srcSet)}}catch(u){Ke(e,e.return,u)}}function Gf(e,n,a){try{var o=e.stateNode;iy(o,e.type,a,n),o[_n]=n}catch(u){Ke(e,e.return,u)}}function Y0(e){return e.tag===5||e.tag===3||e.tag===26||e.tag===27&&ss(e.type)||e.tag===4}function Vf(e){t:for(;;){for(;e.sibling===null;){if(e.return===null||Y0(e.return))return null;e=e.return}for(e.sibling.return=e.return,e=e.sibling;e.tag!==5&&e.tag!==6&&e.tag!==18;){if(e.tag===27&&ss(e.type)||e.flags&2||e.child===null||e.tag===4)continue t;e.child.return=e,e=e.child}if(!(e.flags&2))return e.stateNode}}function kf(e,n,a){var o=e.tag;if(o===5||o===6)e=e.stateNode,n?(a.nodeType===9?a.body:a.nodeName==="HTML"?a.ownerDocument.body:a).insertBefore(e,n):(n=a.nodeType===9?a.body:a.nodeName==="HTML"?a.ownerDocument.body:a,n.appendChild(e),a=a._reactRootContainer,a!=null||n.onclick!==null||(n.onclick=ua));else if(o!==4&&(o===27&&ss(e.type)&&(a=e.stateNode,n=null),e=e.child,e!==null))for(kf(e,n,a),e=e.sibling;e!==null;)kf(e,n,a),e=e.sibling}function ac(e,n,a){var o=e.tag;if(o===5||o===6)e=e.stateNode,n?a.insertBefore(e,n):a.appendChild(e);else if(o!==4&&(o===27&&ss(e.type)&&(a=e.stateNode),e=e.child,e!==null))for(ac(e,n,a),e=e.sibling;e!==null;)ac(e,n,a),e=e.sibling}function Z0(e){var n=e.stateNode,a=e.memoizedProps;try{for(var o=e.type,u=n.attributes;u.length;)n.removeAttributeNode(u[0]);Gn(n,o,a),n[fn]=e,n[_n]=a}catch(h){Ke(e,e.return,h)}}var Sa=!1,wn=!1,Xf=!1,K0=typeof WeakSet=="function"?WeakSet:Set,zn=null;function zS(e,n){if(e=e.containerInfo,fh=Tc,e=om(e),zu(e)){if("selectionStart"in e)var a={start:e.selectionStart,end:e.selectionEnd};else t:{a=(a=e.ownerDocument)&&a.defaultView||window;var o=a.getSelection&&a.getSelection();if(o&&o.rangeCount!==0){a=o.anchorNode;var u=o.anchorOffset,h=o.focusNode;o=o.focusOffset;try{a.nodeType,h.nodeType}catch{a=null;break t}var y=0,C=-1,G=-1,it=0,xt=0,Mt=e,lt=null;e:for(;;){for(var dt;Mt!==a||u!==0&&Mt.nodeType!==3||(C=y+u),Mt!==h||o!==0&&Mt.nodeType!==3||(G=y+o),Mt.nodeType===3&&(y+=Mt.nodeValue.length),(dt=Mt.firstChild)!==null;)lt=Mt,Mt=dt;for(;;){if(Mt===e)break e;if(lt===a&&++it===u&&(C=y),lt===h&&++xt===o&&(G=y),(dt=Mt.nextSibling)!==null)break;Mt=lt,lt=Mt.parentNode}Mt=dt}a=C===-1||G===-1?null:{start:C,end:G}}else a=null}a=a||{start:0,end:0}}else a=null;for(hh={focusedElem:e,selectionRange:a},Tc=!1,zn=n;zn!==null;)if(n=zn,e=n.child,(n.subtreeFlags&1028)!==0&&e!==null)e.return=n,zn=e;else for(;zn!==null;){switch(n=zn,h=n.alternate,e=n.flags,n.tag){case 0:if((e&4)!==0&&(e=n.updateQueue,e=e!==null?e.events:null,e!==null))for(a=0;a<e.length;a++)u=e[a],u.ref.impl=u.nextImpl;break;case 11:case 15:break;case 1:if((e&1024)!==0&&h!==null){e=void 0,a=n,u=h.memoizedProps,h=h.memoizedState,o=a.stateNode;try{var Qt=zs(a.type,u);e=o.getSnapshotBeforeUpdate(Qt,h),o.__reactInternalSnapshotBeforeUpdate=e}catch(ce){Ke(a,a.return,ce)}}break;case 3:if((e&1024)!==0){if(e=n.stateNode.containerInfo,a=e.nodeType,a===9)mh(e);else if(a===1)switch(e.nodeName){case"HEAD":case"HTML":case"BODY":mh(e);break;default:e.textContent=""}}break;case 5:case 26:case 27:case 6:case 4:case 17:break;default:if((e&1024)!==0)throw Error(s(163))}if(e=n.sibling,e!==null){e.return=n.return,zn=e;break}zn=n.return}}function J0(e,n,a){var o=a.flags;switch(a.tag){case 0:case 11:case 15:Ma(e,a),o&4&&Lo(5,a);break;case 1:if(Ma(e,a),o&4)if(e=a.stateNode,n===null)try{e.componentDidMount()}catch(y){Ke(a,a.return,y)}else{var u=zs(a.type,n.memoizedProps);n=n.memoizedState;try{e.componentDidUpdate(u,n,e.__reactInternalSnapshotBeforeUpdate)}catch(y){Ke(a,a.return,y)}}o&64&&X0(a),o&512&&Oo(a,a.return);break;case 3:if(Ma(e,a),o&64&&(e=a.updateQueue,e!==null)){if(n=null,a.child!==null)switch(a.child.tag){case 27:case 5:n=a.child.stateNode;break;case 1:n=a.child.stateNode}try{Om(e,n)}catch(y){Ke(a,a.return,y)}}break;case 27:n===null&&o&4&&Z0(a);case 26:case 5:Ma(e,a),n===null&&o&4&&q0(a),o&512&&Oo(a,a.return);break;case 12:Ma(e,a);break;case 31:Ma(e,a),o&4&&$0(e,a);break;case 13:Ma(e,a),o&4&&tg(e,a),o&64&&(e=a.memoizedState,e!==null&&(e=e.dehydrated,e!==null&&(a=WS.bind(null,a),fy(e,a))));break;case 22:if(o=a.memoizedState!==null||Sa,!o){n=n!==null&&n.memoizedState!==null||wn,u=Sa;var h=wn;Sa=o,(wn=n)&&!h?ba(e,a,(a.subtreeFlags&8772)!==0):Ma(e,a),Sa=u,wn=h}break;case 30:break;default:Ma(e,a)}}function Q0(e){var n=e.alternate;n!==null&&(e.alternate=null,Q0(n)),e.child=null,e.deletions=null,e.sibling=null,e.tag===5&&(n=e.stateNode,n!==null&&Fa(n)),e.stateNode=null,e.return=null,e.dependencies=null,e.memoizedProps=null,e.memoizedState=null,e.pendingProps=null,e.stateNode=null,e.updateQueue=null}var pn=null,si=!1;function ya(e,n,a){for(a=a.child;a!==null;)j0(e,n,a),a=a.sibling}function j0(e,n,a){if(mt&&typeof mt.onCommitFiberUnmount=="function")try{mt.onCommitFiberUnmount(ft,a)}catch{}switch(a.tag){case 26:wn||Ji(a,n),ya(e,n,a),a.memoizedState?a.memoizedState.count--:a.stateNode&&(a=a.stateNode,a.parentNode.removeChild(a));break;case 27:wn||Ji(a,n);var o=pn,u=si;ss(a.type)&&(pn=a.stateNode,si=!1),ya(e,n,a),ko(a.stateNode),pn=o,si=u;break;case 5:wn||Ji(a,n);case 6:if(o=pn,u=si,pn=null,ya(e,n,a),pn=o,si=u,pn!==null)if(si)try{(pn.nodeType===9?pn.body:pn.nodeName==="HTML"?pn.ownerDocument.body:pn).removeChild(a.stateNode)}catch(h){Ke(a,n,h)}else try{pn.removeChild(a.stateNode)}catch(h){Ke(a,n,h)}break;case 18:pn!==null&&(si?(e=pn,Xg(e.nodeType===9?e.body:e.nodeName==="HTML"?e.ownerDocument.body:e,a.stateNode),Nr(e)):Xg(pn,a.stateNode));break;case 4:o=pn,u=si,pn=a.stateNode.containerInfo,si=!0,ya(e,n,a),pn=o,si=u;break;case 0:case 11:case 14:case 15:ja(2,a,n),wn||ja(4,a,n),ya(e,n,a);break;case 1:wn||(Ji(a,n),o=a.stateNode,typeof o.componentWillUnmount=="function"&&W0(a,n,o)),ya(e,n,a);break;case 21:ya(e,n,a);break;case 22:wn=(o=wn)||a.memoizedState!==null,ya(e,n,a),wn=o;break;default:ya(e,n,a)}}function $0(e,n){if(n.memoizedState===null&&(e=n.alternate,e!==null&&(e=e.memoizedState,e!==null))){e=e.dehydrated;try{Nr(e)}catch(a){Ke(n,n.return,a)}}}function tg(e,n){if(n.memoizedState===null&&(e=n.alternate,e!==null&&(e=e.memoizedState,e!==null&&(e=e.dehydrated,e!==null))))try{Nr(e)}catch(a){Ke(n,n.return,a)}}function BS(e){switch(e.tag){case 31:case 13:case 19:var n=e.stateNode;return n===null&&(n=e.stateNode=new K0),n;case 22:return e=e.stateNode,n=e._retryCache,n===null&&(n=e._retryCache=new K0),n;default:throw Error(s(435,e.tag))}}function sc(e,n){var a=BS(e);n.forEach(function(o){if(!a.has(o)){a.add(o);var u=qS.bind(null,e,o);o.then(u,u)}})}function ri(e,n){var a=n.deletions;if(a!==null)for(var o=0;o<a.length;o++){var u=a[o],h=e,y=n,C=y;t:for(;C!==null;){switch(C.tag){case 27:if(ss(C.type)){pn=C.stateNode,si=!1;break t}break;case 5:pn=C.stateNode,si=!1;break t;case 3:case 4:pn=C.stateNode.containerInfo,si=!0;break t}C=C.return}if(pn===null)throw Error(s(160));j0(h,y,u),pn=null,si=!1,h=u.alternate,h!==null&&(h.return=null),u.return=null}if(n.subtreeFlags&13886)for(n=n.child;n!==null;)eg(n,e),n=n.sibling}var Fi=null;function eg(e,n){var a=e.alternate,o=e.flags;switch(e.tag){case 0:case 11:case 14:case 15:ri(n,e),oi(e),o&4&&(ja(3,e,e.return),Lo(3,e),ja(5,e,e.return));break;case 1:ri(n,e),oi(e),o&512&&(wn||a===null||Ji(a,a.return)),o&64&&Sa&&(e=e.updateQueue,e!==null&&(o=e.callbacks,o!==null&&(a=e.shared.hiddenCallbacks,e.shared.hiddenCallbacks=a===null?o:a.concat(o))));break;case 26:var u=Fi;if(ri(n,e),oi(e),o&512&&(wn||a===null||Ji(a,a.return)),o&4){var h=a!==null?a.memoizedState:null;if(o=e.memoizedState,a===null)if(o===null)if(e.stateNode===null){t:{o=e.type,a=e.memoizedProps,u=u.ownerDocument||u;e:switch(o){case"title":h=u.getElementsByTagName("title")[0],(!h||h[Ai]||h[fn]||h.namespaceURI==="http://www.w3.org/2000/svg"||h.hasAttribute("itemprop"))&&(h=u.createElement(o),u.head.insertBefore(h,u.querySelector("head > title"))),Gn(h,o,a),h[fn]=e,bn(h),o=h;break t;case"link":var y=e_("link","href",u).get(o+(a.href||""));if(y){for(var C=0;C<y.length;C++)if(h=y[C],h.getAttribute("href")===(a.href==null||a.href===""?null:a.href)&&h.getAttribute("rel")===(a.rel==null?null:a.rel)&&h.getAttribute("title")===(a.title==null?null:a.title)&&h.getAttribute("crossorigin")===(a.crossOrigin==null?null:a.crossOrigin)){y.splice(C,1);break e}}h=u.createElement(o),Gn(h,o,a),u.head.appendChild(h);break;case"meta":if(y=e_("meta","content",u).get(o+(a.content||""))){for(C=0;C<y.length;C++)if(h=y[C],h.getAttribute("content")===(a.content==null?null:""+a.content)&&h.getAttribute("name")===(a.name==null?null:a.name)&&h.getAttribute("property")===(a.property==null?null:a.property)&&h.getAttribute("http-equiv")===(a.httpEquiv==null?null:a.httpEquiv)&&h.getAttribute("charset")===(a.charSet==null?null:a.charSet)){y.splice(C,1);break e}}h=u.createElement(o),Gn(h,o,a),u.head.appendChild(h);break;default:throw Error(s(468,o))}h[fn]=e,bn(h),o=h}e.stateNode=o}else n_(u,e.type,e.stateNode);else e.stateNode=t_(u,o,e.memoizedProps);else h!==o?(h===null?a.stateNode!==null&&(a=a.stateNode,a.parentNode.removeChild(a)):h.count--,o===null?n_(u,e.type,e.stateNode):t_(u,o,e.memoizedProps)):o===null&&e.stateNode!==null&&Gf(e,e.memoizedProps,a.memoizedProps)}break;case 27:ri(n,e),oi(e),o&512&&(wn||a===null||Ji(a,a.return)),a!==null&&o&4&&Gf(e,e.memoizedProps,a.memoizedProps);break;case 5:if(ri(n,e),oi(e),o&512&&(wn||a===null||Ji(a,a.return)),e.flags&32){u=e.stateNode;try{hi(u,"")}catch(Qt){Ke(e,e.return,Qt)}}o&4&&e.stateNode!=null&&(u=e.memoizedProps,Gf(e,u,a!==null?a.memoizedProps:u)),o&1024&&(Xf=!0);break;case 6:if(ri(n,e),oi(e),o&4){if(e.stateNode===null)throw Error(s(162));o=e.memoizedProps,a=e.stateNode;try{a.nodeValue=o}catch(Qt){Ke(e,e.return,Qt)}}break;case 3:if(yc=null,u=Fi,Fi=xc(n.containerInfo),ri(n,e),Fi=u,oi(e),o&4&&a!==null&&a.memoizedState.isDehydrated)try{Nr(n.containerInfo)}catch(Qt){Ke(e,e.return,Qt)}Xf&&(Xf=!1,ng(e));break;case 4:o=Fi,Fi=xc(e.stateNode.containerInfo),ri(n,e),oi(e),Fi=o;break;case 12:ri(n,e),oi(e);break;case 31:ri(n,e),oi(e),o&4&&(o=e.updateQueue,o!==null&&(e.updateQueue=null,sc(e,o)));break;case 13:ri(n,e),oi(e),e.child.flags&8192&&e.memoizedState!==null!=(a!==null&&a.memoizedState!==null)&&(oc=Me()),o&4&&(o=e.updateQueue,o!==null&&(e.updateQueue=null,sc(e,o)));break;case 22:u=e.memoizedState!==null;var G=a!==null&&a.memoizedState!==null,it=Sa,xt=wn;if(Sa=it||u,wn=xt||G,ri(n,e),wn=xt,Sa=it,oi(e),o&8192)t:for(n=e.stateNode,n._visibility=u?n._visibility&-2:n._visibility|1,u&&(a===null||G||Sa||wn||Bs(e)),a=null,n=e;;){if(n.tag===5||n.tag===26){if(a===null){G=a=n;try{if(h=G.stateNode,u)y=h.style,typeof y.setProperty=="function"?y.setProperty("display","none","important"):y.display="none";else{C=G.stateNode;var Mt=G.memoizedProps.style,lt=Mt!=null&&Mt.hasOwnProperty("display")?Mt.display:null;C.style.display=lt==null||typeof lt=="boolean"?"":(""+lt).trim()}}catch(Qt){Ke(G,G.return,Qt)}}}else if(n.tag===6){if(a===null){G=n;try{G.stateNode.nodeValue=u?"":G.memoizedProps}catch(Qt){Ke(G,G.return,Qt)}}}else if(n.tag===18){if(a===null){G=n;try{var dt=G.stateNode;u?Wg(dt,!0):Wg(G.stateNode,!1)}catch(Qt){Ke(G,G.return,Qt)}}}else if((n.tag!==22&&n.tag!==23||n.memoizedState===null||n===e)&&n.child!==null){n.child.return=n,n=n.child;continue}if(n===e)break t;for(;n.sibling===null;){if(n.return===null||n.return===e)break t;a===n&&(a=null),n=n.return}a===n&&(a=null),n.sibling.return=n.return,n=n.sibling}o&4&&(o=e.updateQueue,o!==null&&(a=o.retryQueue,a!==null&&(o.retryQueue=null,sc(e,a))));break;case 19:ri(n,e),oi(e),o&4&&(o=e.updateQueue,o!==null&&(e.updateQueue=null,sc(e,o)));break;case 30:break;case 21:break;default:ri(n,e),oi(e)}}function oi(e){var n=e.flags;if(n&2){try{for(var a,o=e.return;o!==null;){if(Y0(o)){a=o;break}o=o.return}if(a==null)throw Error(s(160));switch(a.tag){case 27:var u=a.stateNode,h=Vf(e);ac(e,h,u);break;case 5:var y=a.stateNode;a.flags&32&&(hi(y,""),a.flags&=-33);var C=Vf(e);ac(e,C,y);break;case 3:case 4:var G=a.stateNode.containerInfo,it=Vf(e);kf(e,it,G);break;default:throw Error(s(161))}}catch(xt){Ke(e,e.return,xt)}e.flags&=-3}n&4096&&(e.flags&=-4097)}function ng(e){if(e.subtreeFlags&1024)for(e=e.child;e!==null;){var n=e;ng(n),n.tag===5&&n.flags&1024&&n.stateNode.reset(),e=e.sibling}}function Ma(e,n){if(n.subtreeFlags&8772)for(n=n.child;n!==null;)J0(e,n.alternate,n),n=n.sibling}function Bs(e){for(e=e.child;e!==null;){var n=e;switch(n.tag){case 0:case 11:case 14:case 15:ja(4,n,n.return),Bs(n);break;case 1:Ji(n,n.return);var a=n.stateNode;typeof a.componentWillUnmount=="function"&&W0(n,n.return,a),Bs(n);break;case 27:ko(n.stateNode);case 26:case 5:Ji(n,n.return),Bs(n);break;case 22:n.memoizedState===null&&Bs(n);break;case 30:Bs(n);break;default:Bs(n)}e=e.sibling}}function ba(e,n,a){for(a=a&&(n.subtreeFlags&8772)!==0,n=n.child;n!==null;){var o=n.alternate,u=e,h=n,y=h.flags;switch(h.tag){case 0:case 11:case 15:ba(u,h,a),Lo(4,h);break;case 1:if(ba(u,h,a),o=h,u=o.stateNode,typeof u.componentDidMount=="function")try{u.componentDidMount()}catch(it){Ke(o,o.return,it)}if(o=h,u=o.updateQueue,u!==null){var C=o.stateNode;try{var G=u.shared.hiddenCallbacks;if(G!==null)for(u.shared.hiddenCallbacks=null,u=0;u<G.length;u++)Lm(G[u],C)}catch(it){Ke(o,o.return,it)}}a&&y&64&&X0(h),Oo(h,h.return);break;case 27:Z0(h);case 26:case 5:ba(u,h,a),a&&o===null&&y&4&&q0(h),Oo(h,h.return);break;case 12:ba(u,h,a);break;case 31:ba(u,h,a),a&&y&4&&$0(u,h);break;case 13:ba(u,h,a),a&&y&4&&tg(u,h);break;case 22:h.memoizedState===null&&ba(u,h,a),Oo(h,h.return);break;case 30:break;default:ba(u,h,a)}n=n.sibling}}function Wf(e,n){var a=null;e!==null&&e.memoizedState!==null&&e.memoizedState.cachePool!==null&&(a=e.memoizedState.cachePool.pool),e=null,n.memoizedState!==null&&n.memoizedState.cachePool!==null&&(e=n.memoizedState.cachePool.pool),e!==a&&(e!=null&&e.refCount++,a!=null&&So(a))}function qf(e,n){e=null,n.alternate!==null&&(e=n.alternate.memoizedState.cache),n=n.memoizedState.cache,n!==e&&(n.refCount++,e!=null&&So(e))}function Hi(e,n,a,o){if(n.subtreeFlags&10256)for(n=n.child;n!==null;)ig(e,n,a,o),n=n.sibling}function ig(e,n,a,o){var u=n.flags;switch(n.tag){case 0:case 11:case 15:Hi(e,n,a,o),u&2048&&Lo(9,n);break;case 1:Hi(e,n,a,o);break;case 3:Hi(e,n,a,o),u&2048&&(e=null,n.alternate!==null&&(e=n.alternate.memoizedState.cache),n=n.memoizedState.cache,n!==e&&(n.refCount++,e!=null&&So(e)));break;case 12:if(u&2048){Hi(e,n,a,o),e=n.stateNode;try{var h=n.memoizedProps,y=h.id,C=h.onPostCommit;typeof C=="function"&&C(y,n.alternate===null?"mount":"update",e.passiveEffectDuration,-0)}catch(G){Ke(n,n.return,G)}}else Hi(e,n,a,o);break;case 31:Hi(e,n,a,o);break;case 13:Hi(e,n,a,o);break;case 23:break;case 22:h=n.stateNode,y=n.alternate,n.memoizedState!==null?h._visibility&2?Hi(e,n,a,o):Po(e,n):h._visibility&2?Hi(e,n,a,o):(h._visibility|=2,yr(e,n,a,o,(n.subtreeFlags&10256)!==0||!1)),u&2048&&Wf(y,n);break;case 24:Hi(e,n,a,o),u&2048&&qf(n.alternate,n);break;default:Hi(e,n,a,o)}}function yr(e,n,a,o,u){for(u=u&&((n.subtreeFlags&10256)!==0||!1),n=n.child;n!==null;){var h=e,y=n,C=a,G=o,it=y.flags;switch(y.tag){case 0:case 11:case 15:yr(h,y,C,G,u),Lo(8,y);break;case 23:break;case 22:var xt=y.stateNode;y.memoizedState!==null?xt._visibility&2?yr(h,y,C,G,u):Po(h,y):(xt._visibility|=2,yr(h,y,C,G,u)),u&&it&2048&&Wf(y.alternate,y);break;case 24:yr(h,y,C,G,u),u&&it&2048&&qf(y.alternate,y);break;default:yr(h,y,C,G,u)}n=n.sibling}}function Po(e,n){if(n.subtreeFlags&10256)for(n=n.child;n!==null;){var a=e,o=n,u=o.flags;switch(o.tag){case 22:Po(a,o),u&2048&&Wf(o.alternate,o);break;case 24:Po(a,o),u&2048&&qf(o.alternate,o);break;default:Po(a,o)}n=n.sibling}}var zo=8192;function Mr(e,n,a){if(e.subtreeFlags&zo)for(e=e.child;e!==null;)ag(e,n,a),e=e.sibling}function ag(e,n,a){switch(e.tag){case 26:Mr(e,n,a),e.flags&zo&&e.memoizedState!==null&&by(a,Fi,e.memoizedState,e.memoizedProps);break;case 5:Mr(e,n,a);break;case 3:case 4:var o=Fi;Fi=xc(e.stateNode.containerInfo),Mr(e,n,a),Fi=o;break;case 22:e.memoizedState===null&&(o=e.alternate,o!==null&&o.memoizedState!==null?(o=zo,zo=16777216,Mr(e,n,a),zo=o):Mr(e,n,a));break;default:Mr(e,n,a)}}function sg(e){var n=e.alternate;if(n!==null&&(e=n.child,e!==null)){n.child=null;do n=e.sibling,e.sibling=null,e=n;while(e!==null)}}function Bo(e){var n=e.deletions;if((e.flags&16)!==0){if(n!==null)for(var a=0;a<n.length;a++){var o=n[a];zn=o,og(o,e)}sg(e)}if(e.subtreeFlags&10256)for(e=e.child;e!==null;)rg(e),e=e.sibling}function rg(e){switch(e.tag){case 0:case 11:case 15:Bo(e),e.flags&2048&&ja(9,e,e.return);break;case 3:Bo(e);break;case 12:Bo(e);break;case 22:var n=e.stateNode;e.memoizedState!==null&&n._visibility&2&&(e.return===null||e.return.tag!==13)?(n._visibility&=-3,rc(e)):Bo(e);break;default:Bo(e)}}function rc(e){var n=e.deletions;if((e.flags&16)!==0){if(n!==null)for(var a=0;a<n.length;a++){var o=n[a];zn=o,og(o,e)}sg(e)}for(e=e.child;e!==null;){switch(n=e,n.tag){case 0:case 11:case 15:ja(8,n,n.return),rc(n);break;case 22:a=n.stateNode,a._visibility&2&&(a._visibility&=-3,rc(n));break;default:rc(n)}e=e.sibling}}function og(e,n){for(;zn!==null;){var a=zn;switch(a.tag){case 0:case 11:case 15:ja(8,a,n);break;case 23:case 22:if(a.memoizedState!==null&&a.memoizedState.cachePool!==null){var o=a.memoizedState.cachePool.pool;o!=null&&o.refCount++}break;case 24:So(a.memoizedState.cache)}if(o=a.child,o!==null)o.return=a,zn=o;else t:for(a=e;zn!==null;){o=zn;var u=o.sibling,h=o.return;if(Q0(o),o===a){zn=null;break t}if(u!==null){u.return=h,zn=u;break t}zn=h}}}var IS={getCacheForType:function(e){var n=Fn(En),a=n.data.get(e);return a===void 0&&(a=e(),n.data.set(e,a)),a},cacheSignal:function(){return Fn(En).controller.signal}},FS=typeof WeakMap=="function"?WeakMap:Map,He=0,sn=null,Ae=null,Ce=0,Ze=0,_i=null,$a=!1,br=!1,Yf=!1,Ea=0,xn=0,ts=0,Is=0,Zf=0,vi=0,Er=0,Io=null,li=null,Kf=!1,oc=0,lg=0,lc=1/0,cc=null,es=null,Nn=0,ns=null,Tr=null,Ta=0,Jf=0,Qf=null,cg=null,Fo=0,jf=null;function xi(){return(He&2)!==0&&Ce!==0?Ce&-Ce:P.T!==null?ah():Sn()}function ug(){if(vi===0)if((Ce&536870912)===0||Ue){var e=le;le<<=1,(le&3932160)===0&&(le=262144),vi=e}else vi=536870912;return e=mi.current,e!==null&&(e.flags|=32),vi}function ci(e,n,a){(e===sn&&(Ze===2||Ze===9)||e.cancelPendingCommit!==null)&&(Ar(e,0),is(e,Ce,vi,!1)),qt(e,a),((He&2)===0||e!==sn)&&(e===sn&&((He&2)===0&&(Is|=a),xn===4&&is(e,Ce,vi,!1)),Qi(e))}function fg(e,n,a){if((He&6)!==0)throw Error(s(327));var o=!a&&(n&127)===0&&(n&e.expiredLanes)===0||Pt(e,n),u=o?VS(e,n):th(e,n,!0),h=o;do{if(u===0){br&&!o&&is(e,n,0,!1);break}else{if(a=e.current.alternate,h&&!HS(a)){u=th(e,n,!1),h=!1;continue}if(u===2){if(h=n,e.errorRecoveryDisabledLanes&h)var y=0;else y=e.pendingLanes&-536870913,y=y!==0?y:y&536870912?536870912:0;if(y!==0){n=y;t:{var C=e;u=Io;var G=C.current.memoizedState.isDehydrated;if(G&&(Ar(C,y).flags|=256),y=th(C,y,!1),y!==2){if(Yf&&!G){C.errorRecoveryDisabledLanes|=h,Is|=h,u=4;break t}h=li,li=u,h!==null&&(li===null?li=h:li.push.apply(li,h))}u=y}if(h=!1,u!==2)continue}}if(u===1){Ar(e,0),is(e,n,0,!0);break}t:{switch(o=e,h=u,h){case 0:case 1:throw Error(s(345));case 4:if((n&4194048)!==n)break;case 6:is(o,n,vi,!$a);break t;case 2:li=null;break;case 3:case 5:break;default:throw Error(s(329))}if((n&62914560)===n&&(u=oc+300-Me(),10<u)){if(is(o,n,vi,!$a),vt(o,0,!0)!==0)break t;Ta=n,o.timeoutHandle=Vg(hg.bind(null,o,a,li,cc,Kf,n,vi,Is,Er,$a,h,"Throttled",-0,0),u);break t}hg(o,a,li,cc,Kf,n,vi,Is,Er,$a,h,null,-0,0)}}break}while(!0);Qi(e)}function hg(e,n,a,o,u,h,y,C,G,it,xt,Mt,lt,dt){if(e.timeoutHandle=-1,Mt=n.subtreeFlags,Mt&8192||(Mt&16785408)===16785408){Mt={stylesheets:null,count:0,imgCount:0,imgBytes:0,suspenseyImages:[],waitingForImages:!0,waitingForViewTransition:!1,unsuspend:ua},ag(n,h,Mt);var Qt=(h&62914560)===h?oc-Me():(h&4194048)===h?lg-Me():0;if(Qt=Ey(Mt,Qt),Qt!==null){Ta=h,e.cancelPendingCommit=Qt(Sg.bind(null,e,n,h,a,o,u,y,C,G,xt,Mt,null,lt,dt)),is(e,h,y,!it);return}}Sg(e,n,h,a,o,u,y,C,G)}function HS(e){for(var n=e;;){var a=n.tag;if((a===0||a===11||a===15)&&n.flags&16384&&(a=n.updateQueue,a!==null&&(a=a.stores,a!==null)))for(var o=0;o<a.length;o++){var u=a[o],h=u.getSnapshot;u=u.value;try{if(!di(h(),u))return!1}catch{return!1}}if(a=n.child,n.subtreeFlags&16384&&a!==null)a.return=n,n=a;else{if(n===e)break;for(;n.sibling===null;){if(n.return===null||n.return===e)return!0;n=n.return}n.sibling.return=n.return,n=n.sibling}}return!0}function is(e,n,a,o){n&=~Zf,n&=~Is,e.suspendedLanes|=n,e.pingedLanes&=~n,o&&(e.warmLanes|=n),o=e.expirationTimes;for(var u=n;0<u;){var h=31-kt(u),y=1<<h;o[h]=-1,u&=~y}a!==0&&wt(e,a,n)}function uc(){return(He&6)===0?(Ho(0),!1):!0}function $f(){if(Ae!==null){if(Ze===0)var e=Ae.return;else e=Ae,pa=Cs=null,mf(e),gr=null,Mo=0,e=Ae;for(;e!==null;)k0(e.alternate,e),e=e.return;Ae=null}}function Ar(e,n){var a=e.timeoutHandle;a!==-1&&(e.timeoutHandle=-1,ry(a)),a=e.cancelPendingCommit,a!==null&&(e.cancelPendingCommit=null,a()),Ta=0,$f(),sn=e,Ae=a=ha(e.current,null),Ce=n,Ze=0,_i=null,$a=!1,br=Pt(e,n),Yf=!1,Er=vi=Zf=Is=ts=xn=0,li=Io=null,Kf=!1,(n&8)!==0&&(n|=n&32);var o=e.entangledLanes;if(o!==0)for(e=e.entanglements,o&=n;0<o;){var u=31-kt(o),h=1<<u;n|=e[u],o&=~h}return Ea=n,Ul(),a}function dg(e,n){Se=null,P.H=Do,n===mr||n===Fl?(n=Cm(),Ze=3):n===nf?(n=Cm(),Ze=4):Ze=n===Uf?8:n!==null&&typeof n=="object"&&typeof n.then=="function"?6:1,_i=n,Ae===null&&(xn=1,$l(e,Ri(n,e.current)))}function pg(){var e=mi.current;return e===null?!0:(Ce&4194048)===Ce?Ni===null:(Ce&62914560)===Ce||(Ce&536870912)!==0?e===Ni:!1}function mg(){var e=P.H;return P.H=Do,e===null?Do:e}function gg(){var e=P.A;return P.A=IS,e}function fc(){xn=4,$a||(Ce&4194048)!==Ce&&mi.current!==null||(br=!0),(ts&134217727)===0&&(Is&134217727)===0||sn===null||is(sn,Ce,vi,!1)}function th(e,n,a){var o=He;He|=2;var u=mg(),h=gg();(sn!==e||Ce!==n)&&(cc=null,Ar(e,n)),n=!1;var y=xn;t:do try{if(Ze!==0&&Ae!==null){var C=Ae,G=_i;switch(Ze){case 8:$f(),y=6;break t;case 3:case 2:case 9:case 6:mi.current===null&&(n=!0);var it=Ze;if(Ze=0,_i=null,wr(e,C,G,it),a&&br){y=0;break t}break;default:it=Ze,Ze=0,_i=null,wr(e,C,G,it)}}GS(),y=xn;break}catch(xt){dg(e,xt)}while(!0);return n&&e.shellSuspendCounter++,pa=Cs=null,He=o,P.H=u,P.A=h,Ae===null&&(sn=null,Ce=0,Ul()),y}function GS(){for(;Ae!==null;)_g(Ae)}function VS(e,n){var a=He;He|=2;var o=mg(),u=gg();sn!==e||Ce!==n?(cc=null,lc=Me()+500,Ar(e,n)):br=Pt(e,n);t:do try{if(Ze!==0&&Ae!==null){n=Ae;var h=_i;e:switch(Ze){case 1:Ze=0,_i=null,wr(e,n,h,1);break;case 2:case 9:if(wm(h)){Ze=0,_i=null,vg(n);break}n=function(){Ze!==2&&Ze!==9||sn!==e||(Ze=7),Qi(e)},h.then(n,n);break t;case 3:Ze=7;break t;case 4:Ze=5;break t;case 7:wm(h)?(Ze=0,_i=null,vg(n)):(Ze=0,_i=null,wr(e,n,h,7));break;case 5:var y=null;switch(Ae.tag){case 26:y=Ae.memoizedState;case 5:case 27:var C=Ae;if(y?i_(y):C.stateNode.complete){Ze=0,_i=null;var G=C.sibling;if(G!==null)Ae=G;else{var it=C.return;it!==null?(Ae=it,hc(it)):Ae=null}break e}}Ze=0,_i=null,wr(e,n,h,5);break;case 6:Ze=0,_i=null,wr(e,n,h,6);break;case 8:$f(),xn=6;break t;default:throw Error(s(462))}}kS();break}catch(xt){dg(e,xt)}while(!0);return pa=Cs=null,P.H=o,P.A=u,He=a,Ae!==null?0:(sn=null,Ce=0,Ul(),xn)}function kS(){for(;Ae!==null&&!un();)_g(Ae)}function _g(e){var n=G0(e.alternate,e,Ea);e.memoizedProps=e.pendingProps,n===null?hc(e):Ae=n}function vg(e){var n=e,a=n.alternate;switch(n.tag){case 15:case 0:n=P0(a,n,n.pendingProps,n.type,void 0,Ce);break;case 11:n=P0(a,n,n.pendingProps,n.type.render,n.ref,Ce);break;case 5:mf(n);default:k0(a,n),n=Ae=gm(n,Ea),n=G0(a,n,Ea)}e.memoizedProps=e.pendingProps,n===null?hc(e):Ae=n}function wr(e,n,a,o){pa=Cs=null,mf(n),gr=null,Mo=0;var u=n.return;try{if(US(e,u,n,a,Ce)){xn=1,$l(e,Ri(a,e.current)),Ae=null;return}}catch(h){if(u!==null)throw Ae=u,h;xn=1,$l(e,Ri(a,e.current)),Ae=null;return}n.flags&32768?(Ue||o===1?e=!0:br||(Ce&536870912)!==0?e=!1:($a=e=!0,(o===2||o===9||o===3||o===6)&&(o=mi.current,o!==null&&o.tag===13&&(o.flags|=16384))),xg(n,e)):hc(n)}function hc(e){var n=e;do{if((n.flags&32768)!==0){xg(n,$a);return}e=n.return;var a=OS(n.alternate,n,Ea);if(a!==null){Ae=a;return}if(n=n.sibling,n!==null){Ae=n;return}Ae=n=e}while(n!==null);xn===0&&(xn=5)}function xg(e,n){do{var a=PS(e.alternate,e);if(a!==null){a.flags&=32767,Ae=a;return}if(a=e.return,a!==null&&(a.flags|=32768,a.subtreeFlags=0,a.deletions=null),!n&&(e=e.sibling,e!==null)){Ae=e;return}Ae=e=a}while(e!==null);xn=6,Ae=null}function Sg(e,n,a,o,u,h,y,C,G){e.cancelPendingCommit=null;do dc();while(Nn!==0);if((He&6)!==0)throw Error(s(327));if(n!==null){if(n===e.current)throw Error(s(177));if(h=n.lanes|n.childLanes,h|=Gu,ht(e,a,h,y,C,G),e===sn&&(Ae=sn=null,Ce=0),Tr=n,ns=e,Ta=a,Jf=h,Qf=u,cg=o,(n.subtreeFlags&10256)!==0||(n.flags&10256)!==0?(e.callbackNode=null,e.callbackPriority=0,YS(j,function(){return Tg(),null})):(e.callbackNode=null,e.callbackPriority=0),o=(n.flags&13878)!==0,(n.subtreeFlags&13878)!==0||o){o=P.T,P.T=null,u=k.p,k.p=2,y=He,He|=4;try{zS(e,n,a)}finally{He=y,k.p=u,P.T=o}}Nn=1,yg(),Mg(),bg()}}function yg(){if(Nn===1){Nn=0;var e=ns,n=Tr,a=(n.flags&13878)!==0;if((n.subtreeFlags&13878)!==0||a){a=P.T,P.T=null;var o=k.p;k.p=2;var u=He;He|=4;try{eg(n,e);var h=hh,y=om(e.containerInfo),C=h.focusedElem,G=h.selectionRange;if(y!==C&&C&&C.ownerDocument&&rm(C.ownerDocument.documentElement,C)){if(G!==null&&zu(C)){var it=G.start,xt=G.end;if(xt===void 0&&(xt=it),"selectionStart"in C)C.selectionStart=it,C.selectionEnd=Math.min(xt,C.value.length);else{var Mt=C.ownerDocument||document,lt=Mt&&Mt.defaultView||window;if(lt.getSelection){var dt=lt.getSelection(),Qt=C.textContent.length,ce=Math.min(G.start,Qt),$e=G.end===void 0?ce:Math.min(G.end,Qt);!dt.extend&&ce>$e&&(y=$e,$e=ce,ce=y);var $=sm(C,ce),W=sm(C,$e);if($&&W&&(dt.rangeCount!==1||dt.anchorNode!==$.node||dt.anchorOffset!==$.offset||dt.focusNode!==W.node||dt.focusOffset!==W.offset)){var nt=Mt.createRange();nt.setStart($.node,$.offset),dt.removeAllRanges(),ce>$e?(dt.addRange(nt),dt.extend(W.node,W.offset)):(nt.setEnd(W.node,W.offset),dt.addRange(nt))}}}}for(Mt=[],dt=C;dt=dt.parentNode;)dt.nodeType===1&&Mt.push({element:dt,left:dt.scrollLeft,top:dt.scrollTop});for(typeof C.focus=="function"&&C.focus(),C=0;C<Mt.length;C++){var St=Mt[C];St.element.scrollLeft=St.left,St.element.scrollTop=St.top}}Tc=!!fh,hh=fh=null}finally{He=u,k.p=o,P.T=a}}e.current=n,Nn=2}}function Mg(){if(Nn===2){Nn=0;var e=ns,n=Tr,a=(n.flags&8772)!==0;if((n.subtreeFlags&8772)!==0||a){a=P.T,P.T=null;var o=k.p;k.p=2;var u=He;He|=4;try{J0(e,n.alternate,n)}finally{He=u,k.p=o,P.T=a}}Nn=3}}function bg(){if(Nn===4||Nn===3){Nn=0,Y();var e=ns,n=Tr,a=Ta,o=cg;(n.subtreeFlags&10256)!==0||(n.flags&10256)!==0?Nn=5:(Nn=0,Tr=ns=null,Eg(e,e.pendingLanes));var u=e.pendingLanes;if(u===0&&(es=null),Pe(a),n=n.stateNode,mt&&typeof mt.onCommitFiberRoot=="function")try{mt.onCommitFiberRoot(ft,n,void 0,(n.current.flags&128)===128)}catch{}if(o!==null){n=P.T,u=k.p,k.p=2,P.T=null;try{for(var h=e.onRecoverableError,y=0;y<o.length;y++){var C=o[y];h(C.value,{componentStack:C.stack})}}finally{P.T=n,k.p=u}}(Ta&3)!==0&&dc(),Qi(e),u=e.pendingLanes,(a&261930)!==0&&(u&42)!==0?e===jf?Fo++:(Fo=0,jf=e):Fo=0,Ho(0)}}function Eg(e,n){(e.pooledCacheLanes&=n)===0&&(n=e.pooledCache,n!=null&&(e.pooledCache=null,So(n)))}function dc(){return yg(),Mg(),bg(),Tg()}function Tg(){if(Nn!==5)return!1;var e=ns,n=Jf;Jf=0;var a=Pe(Ta),o=P.T,u=k.p;try{k.p=32>a?32:a,P.T=null,a=Qf,Qf=null;var h=ns,y=Ta;if(Nn=0,Tr=ns=null,Ta=0,(He&6)!==0)throw Error(s(331));var C=He;if(He|=4,rg(h.current),ig(h,h.current,y,a),He=C,Ho(0,!1),mt&&typeof mt.onPostCommitFiberRoot=="function")try{mt.onPostCommitFiberRoot(ft,h)}catch{}return!0}finally{k.p=u,P.T=o,Eg(e,n)}}function Ag(e,n,a){n=Ri(a,n),n=Df(e.stateNode,n,2),e=Ka(e,n,2),e!==null&&(qt(e,2),Qi(e))}function Ke(e,n,a){if(e.tag===3)Ag(e,e,a);else for(;n!==null;){if(n.tag===3){Ag(n,e,a);break}else if(n.tag===1){var o=n.stateNode;if(typeof n.type.getDerivedStateFromError=="function"||typeof o.componentDidCatch=="function"&&(es===null||!es.has(o))){e=Ri(a,e),a=w0(2),o=Ka(n,a,2),o!==null&&(R0(a,o,n,e),qt(o,2),Qi(o));break}}n=n.return}}function eh(e,n,a){var o=e.pingCache;if(o===null){o=e.pingCache=new FS;var u=new Set;o.set(n,u)}else u=o.get(n),u===void 0&&(u=new Set,o.set(n,u));u.has(a)||(Yf=!0,u.add(a),e=XS.bind(null,e,n,a),n.then(e,e))}function XS(e,n,a){var o=e.pingCache;o!==null&&o.delete(n),e.pingedLanes|=e.suspendedLanes&a,e.warmLanes&=~a,sn===e&&(Ce&a)===a&&(xn===4||xn===3&&(Ce&62914560)===Ce&&300>Me()-oc?(He&2)===0&&Ar(e,0):Zf|=a,Er===Ce&&(Er=0)),Qi(e)}function wg(e,n){n===0&&(n=Tt()),e=As(e,n),e!==null&&(qt(e,n),Qi(e))}function WS(e){var n=e.memoizedState,a=0;n!==null&&(a=n.retryLane),wg(e,a)}function qS(e,n){var a=0;switch(e.tag){case 31:case 13:var o=e.stateNode,u=e.memoizedState;u!==null&&(a=u.retryLane);break;case 19:o=e.stateNode;break;case 22:o=e.stateNode._retryCache;break;default:throw Error(s(314))}o!==null&&o.delete(n),wg(e,a)}function YS(e,n){return mn(e,n)}var pc=null,Rr=null,nh=!1,mc=!1,ih=!1,as=0;function Qi(e){e!==Rr&&e.next===null&&(Rr===null?pc=Rr=e:Rr=Rr.next=e),mc=!0,nh||(nh=!0,KS())}function Ho(e,n){if(!ih&&mc){ih=!0;do for(var a=!1,o=pc;o!==null;){if(e!==0){var u=o.pendingLanes;if(u===0)var h=0;else{var y=o.suspendedLanes,C=o.pingedLanes;h=(1<<31-kt(42|e)+1)-1,h&=u&~(y&~C),h=h&201326741?h&201326741|1:h?h|2:0}h!==0&&(a=!0,Ug(o,h))}else h=Ce,h=vt(o,o===sn?h:0,o.cancelPendingCommit!==null||o.timeoutHandle!==-1),(h&3)===0||Pt(o,h)||(a=!0,Ug(o,h));o=o.next}while(a);ih=!1}}function ZS(){Rg()}function Rg(){mc=nh=!1;var e=0;as!==0&&sy()&&(e=as);for(var n=Me(),a=null,o=pc;o!==null;){var u=o.next,h=Cg(o,n);h===0?(o.next=null,a===null?pc=u:a.next=u,u===null&&(Rr=a)):(a=o,(e!==0||(h&3)!==0)&&(mc=!0)),o=u}Nn!==0&&Nn!==5||Ho(e),as!==0&&(as=0)}function Cg(e,n){for(var a=e.suspendedLanes,o=e.pingedLanes,u=e.expirationTimes,h=e.pendingLanes&-62914561;0<h;){var y=31-kt(h),C=1<<y,G=u[y];G===-1?((C&a)===0||(C&o)!==0)&&(u[y]=Ht(C,n)):G<=n&&(e.expiredLanes|=C),h&=~C}if(n=sn,a=Ce,a=vt(e,e===n?a:0,e.cancelPendingCommit!==null||e.timeoutHandle!==-1),o=e.callbackNode,a===0||e===n&&(Ze===2||Ze===9)||e.cancelPendingCommit!==null)return o!==null&&o!==null&&Fe(o),e.callbackNode=null,e.callbackPriority=0;if((a&3)===0||Pt(e,a)){if(n=a&-a,n===e.callbackPriority)return n;switch(o!==null&&Fe(o),Pe(a)){case 2:case 8:a=T;break;case 32:a=j;break;case 268435456:a=pt;break;default:a=j}return o=Dg.bind(null,e),a=mn(a,o),e.callbackPriority=n,e.callbackNode=a,n}return o!==null&&o!==null&&Fe(o),e.callbackPriority=2,e.callbackNode=null,2}function Dg(e,n){if(Nn!==0&&Nn!==5)return e.callbackNode=null,e.callbackPriority=0,null;var a=e.callbackNode;if(dc()&&e.callbackNode!==a)return null;var o=Ce;return o=vt(e,e===sn?o:0,e.cancelPendingCommit!==null||e.timeoutHandle!==-1),o===0?null:(fg(e,o,n),Cg(e,Me()),e.callbackNode!=null&&e.callbackNode===a?Dg.bind(null,e):null)}function Ug(e,n){if(dc())return null;fg(e,n,!0)}function KS(){oy(function(){(He&6)!==0?mn(I,ZS):Rg()})}function ah(){if(as===0){var e=dr;e===0&&(e=te,te<<=1,(te&261888)===0&&(te=256)),as=e}return as}function Ng(e){return e==null||typeof e=="symbol"||typeof e=="boolean"?null:typeof e=="function"?e:Ms(""+e)}function Lg(e,n){var a=n.ownerDocument.createElement("input");return a.name=n.name,a.value=n.value,e.id&&a.setAttribute("form",e.id),n.parentNode.insertBefore(a,n),e=new FormData(e),a.parentNode.removeChild(a),e}function JS(e,n,a,o,u){if(n==="submit"&&a&&a.stateNode===u){var h=Ng((u[_n]||null).action),y=o.submitter;y&&(n=(n=y[_n]||null)?Ng(n.formAction):y.getAttribute("formAction"),n!==null&&(h=n,y=null));var C=new wl("action","action",null,o,u);e.push({event:C,listeners:[{instance:null,listener:function(){if(o.defaultPrevented){if(as!==0){var G=y?Lg(u,y):new FormData(u);Ef(a,{pending:!0,data:G,method:u.method,action:h},null,G)}}else typeof h=="function"&&(C.preventDefault(),G=y?Lg(u,y):new FormData(u),Ef(a,{pending:!0,data:G,method:u.method,action:h},h,G))},currentTarget:u}]})}}for(var sh=0;sh<Hu.length;sh++){var rh=Hu[sh],QS=rh.toLowerCase(),jS=rh[0].toUpperCase()+rh.slice(1);Ii(QS,"on"+jS)}Ii(um,"onAnimationEnd"),Ii(fm,"onAnimationIteration"),Ii(hm,"onAnimationStart"),Ii("dblclick","onDoubleClick"),Ii("focusin","onFocus"),Ii("focusout","onBlur"),Ii(pS,"onTransitionRun"),Ii(mS,"onTransitionStart"),Ii(gS,"onTransitionCancel"),Ii(dm,"onTransitionEnd"),ot("onMouseEnter",["mouseout","mouseover"]),ot("onMouseLeave",["mouseout","mouseover"]),ot("onPointerEnter",["pointerout","pointerover"]),ot("onPointerLeave",["pointerout","pointerover"]),K("onChange","change click focusin focusout input keydown keyup selectionchange".split(" ")),K("onSelect","focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" ")),K("onBeforeInput",["compositionend","keypress","textInput","paste"]),K("onCompositionEnd","compositionend focusout keydown keypress keyup mousedown".split(" ")),K("onCompositionStart","compositionstart focusout keydown keypress keyup mousedown".split(" ")),K("onCompositionUpdate","compositionupdate focusout keydown keypress keyup mousedown".split(" "));var Go="abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(" "),$S=new Set("beforetoggle cancel close invalid load scroll scrollend toggle".split(" ").concat(Go));function Og(e,n){n=(n&4)!==0;for(var a=0;a<e.length;a++){var o=e[a],u=o.event;o=o.listeners;t:{var h=void 0;if(n)for(var y=o.length-1;0<=y;y--){var C=o[y],G=C.instance,it=C.currentTarget;if(C=C.listener,G!==h&&u.isPropagationStopped())break t;h=C,u.currentTarget=it;try{h(u)}catch(xt){Dl(xt)}u.currentTarget=null,h=G}else for(y=0;y<o.length;y++){if(C=o[y],G=C.instance,it=C.currentTarget,C=C.listener,G!==h&&u.isPropagationStopped())break t;h=C,u.currentTarget=it;try{h(u)}catch(xt){Dl(xt)}u.currentTarget=null,h=G}}}}function we(e,n){var a=n[Qn];a===void 0&&(a=n[Qn]=new Set);var o=e+"__bubble";a.has(o)||(Pg(n,e,2,!1),a.add(o))}function oh(e,n,a){var o=0;n&&(o|=4),Pg(a,e,o,n)}var gc="_reactListening"+Math.random().toString(36).slice(2);function lh(e){if(!e[gc]){e[gc]=!0,bl.forEach(function(a){a!=="selectionchange"&&($S.has(a)||oh(a,!1,e),oh(a,!0,e))});var n=e.nodeType===9?e:e.ownerDocument;n===null||n[gc]||(n[gc]=!0,oh("selectionchange",!1,n))}}function Pg(e,n,a,o){switch(u_(n)){case 2:var u=wy;break;case 8:u=Ry;break;default:u=bh}a=u.bind(null,n,a,e),u=void 0,!wu||n!=="touchstart"&&n!=="touchmove"&&n!=="wheel"||(u=!0),o?u!==void 0?e.addEventListener(n,a,{capture:!0,passive:u}):e.addEventListener(n,a,!0):u!==void 0?e.addEventListener(n,a,{passive:u}):e.addEventListener(n,a,!1)}function ch(e,n,a,o,u){var h=o;if((n&1)===0&&(n&2)===0&&o!==null)t:for(;;){if(o===null)return;var y=o.tag;if(y===3||y===4){var C=o.stateNode.containerInfo;if(C===u)break;if(y===4)for(y=o.return;y!==null;){var G=y.tag;if((G===3||G===4)&&y.stateNode.containerInfo===u)return;y=y.return}for(;C!==null;){if(y=la(C),y===null)return;if(G=y.tag,G===5||G===6||G===26||G===27){o=h=y;continue t}C=C.parentNode}}o=o.return}Hp(function(){var it=h,xt=Tu(a),Mt=[];t:{var lt=pm.get(e);if(lt!==void 0){var dt=wl,Qt=e;switch(e){case"keypress":if(Tl(a)===0)break t;case"keydown":case"keyup":dt=qx;break;case"focusin":Qt="focus",dt=Uu;break;case"focusout":Qt="blur",dt=Uu;break;case"beforeblur":case"afterblur":dt=Uu;break;case"click":if(a.button===2)break t;case"auxclick":case"dblclick":case"mousedown":case"mousemove":case"mouseup":case"mouseout":case"mouseover":case"contextmenu":dt=kp;break;case"drag":case"dragend":case"dragenter":case"dragexit":case"dragleave":case"dragover":case"dragstart":case"drop":dt=Ox;break;case"touchcancel":case"touchend":case"touchmove":case"touchstart":dt=Kx;break;case um:case fm:case hm:dt=Bx;break;case dm:dt=Qx;break;case"scroll":case"scrollend":dt=Nx;break;case"wheel":dt=$x;break;case"copy":case"cut":case"paste":dt=Fx;break;case"gotpointercapture":case"lostpointercapture":case"pointercancel":case"pointerdown":case"pointermove":case"pointerout":case"pointerover":case"pointerup":dt=Wp;break;case"toggle":case"beforetoggle":dt=eS}var ce=(n&4)!==0,$e=!ce&&(e==="scroll"||e==="scrollend"),$=ce?lt!==null?lt+"Capture":null:lt;ce=[];for(var W=it,nt;W!==null;){var St=W;if(nt=St.stateNode,St=St.tag,St!==5&&St!==26&&St!==27||nt===null||$===null||(St=lo(W,$),St!=null&&ce.push(Vo(W,St,nt))),$e)break;W=W.return}0<ce.length&&(lt=new dt(lt,Qt,null,a,xt),Mt.push({event:lt,listeners:ce}))}}if((n&7)===0){t:{if(lt=e==="mouseover"||e==="pointerover",dt=e==="mouseout"||e==="pointerout",lt&&a!==Eu&&(Qt=a.relatedTarget||a.fromElement)&&(la(Qt)||Qt[en]))break t;if((dt||lt)&&(lt=xt.window===xt?xt:(lt=xt.ownerDocument)?lt.defaultView||lt.parentWindow:window,dt?(Qt=a.relatedTarget||a.toElement,dt=it,Qt=Qt?la(Qt):null,Qt!==null&&($e=c(Qt),ce=Qt.tag,Qt!==$e||ce!==5&&ce!==27&&ce!==6)&&(Qt=null)):(dt=null,Qt=it),dt!==Qt)){if(ce=kp,St="onMouseLeave",$="onMouseEnter",W="mouse",(e==="pointerout"||e==="pointerover")&&(ce=Wp,St="onPointerLeave",$="onPointerEnter",W="pointer"),$e=dt==null?lt:ys(dt),nt=Qt==null?lt:ys(Qt),lt=new ce(St,W+"leave",dt,a,xt),lt.target=$e,lt.relatedTarget=nt,St=null,la(xt)===it&&(ce=new ce($,W+"enter",Qt,a,xt),ce.target=nt,ce.relatedTarget=$e,St=ce),$e=St,dt&&Qt)e:{for(ce=ty,$=dt,W=Qt,nt=0,St=$;St;St=ce(St))nt++;St=0;for(var re=W;re;re=ce(re))St++;for(;0<nt-St;)$=ce($),nt--;for(;0<St-nt;)W=ce(W),St--;for(;nt--;){if($===W||W!==null&&$===W.alternate){ce=$;break e}$=ce($),W=ce(W)}ce=null}else ce=null;dt!==null&&zg(Mt,lt,dt,ce,!1),Qt!==null&&$e!==null&&zg(Mt,$e,Qt,ce,!0)}}t:{if(lt=it?ys(it):window,dt=lt.nodeName&&lt.nodeName.toLowerCase(),dt==="select"||dt==="input"&&lt.type==="file")var Be=$p;else if(Qp(lt))if(tm)Be=fS;else{Be=cS;var $t=lS}else dt=lt.nodeName,!dt||dt.toLowerCase()!=="input"||lt.type!=="checkbox"&&lt.type!=="radio"?it&&Ge(it.elementType)&&(Be=$p):Be=uS;if(Be&&(Be=Be(e,it))){jp(Mt,Be,a,xt);break t}$t&&$t(e,lt,it),e==="focusout"&&it&&lt.type==="number"&&it.memoizedProps.value!=null&&Te(lt,"number",lt.value)}switch($t=it?ys(it):window,e){case"focusin":(Qp($t)||$t.contentEditable==="true")&&(sr=$t,Bu=it,_o=null);break;case"focusout":_o=Bu=sr=null;break;case"mousedown":Iu=!0;break;case"contextmenu":case"mouseup":case"dragend":Iu=!1,lm(Mt,a,xt);break;case"selectionchange":if(dS)break;case"keydown":case"keyup":lm(Mt,a,xt)}var ye;if(Lu)t:{switch(e){case"compositionstart":var De="onCompositionStart";break t;case"compositionend":De="onCompositionEnd";break t;case"compositionupdate":De="onCompositionUpdate";break t}De=void 0}else ar?Kp(e,a)&&(De="onCompositionEnd"):e==="keydown"&&a.keyCode===229&&(De="onCompositionStart");De&&(qp&&a.locale!=="ko"&&(ar||De!=="onCompositionStart"?De==="onCompositionEnd"&&ar&&(ye=Gp()):(Va=xt,Ru="value"in Va?Va.value:Va.textContent,ar=!0)),$t=_c(it,De),0<$t.length&&(De=new Xp(De,e,null,a,xt),Mt.push({event:De,listeners:$t}),ye?De.data=ye:(ye=Jp(a),ye!==null&&(De.data=ye)))),(ye=iS?aS(e,a):sS(e,a))&&(De=_c(it,"onBeforeInput"),0<De.length&&($t=new Xp("onBeforeInput","beforeinput",null,a,xt),Mt.push({event:$t,listeners:De}),$t.data=ye)),JS(Mt,e,it,a,xt)}Og(Mt,n)})}function Vo(e,n,a){return{instance:e,listener:n,currentTarget:a}}function _c(e,n){for(var a=n+"Capture",o=[];e!==null;){var u=e,h=u.stateNode;if(u=u.tag,u!==5&&u!==26&&u!==27||h===null||(u=lo(e,a),u!=null&&o.unshift(Vo(e,u,h)),u=lo(e,n),u!=null&&o.push(Vo(e,u,h))),e.tag===3)return o;e=e.return}return[]}function ty(e){if(e===null)return null;do e=e.return;while(e&&e.tag!==5&&e.tag!==27);return e||null}function zg(e,n,a,o,u){for(var h=n._reactName,y=[];a!==null&&a!==o;){var C=a,G=C.alternate,it=C.stateNode;if(C=C.tag,G!==null&&G===o)break;C!==5&&C!==26&&C!==27||it===null||(G=it,u?(it=lo(a,h),it!=null&&y.unshift(Vo(a,it,G))):u||(it=lo(a,h),it!=null&&y.push(Vo(a,it,G)))),a=a.return}y.length!==0&&e.push({event:n,listeners:y})}var ey=/\r\n?/g,ny=/\u0000|\uFFFD/g;function Bg(e){return(typeof e=="string"?e:""+e).replace(ey,`
`).replace(ny,"")}function Ig(e,n){return n=Bg(n),Bg(e)===n}function je(e,n,a,o,u,h){switch(a){case"children":typeof o=="string"?n==="body"||n==="textarea"&&o===""||hi(e,o):(typeof o=="number"||typeof o=="bigint")&&n!=="body"&&hi(e,""+o);break;case"className":Jt(e,"class",o);break;case"tabIndex":Jt(e,"tabindex",o);break;case"dir":case"role":case"viewBox":case"width":case"height":Jt(e,a,o);break;case"style":Bi(e,o,h);break;case"data":if(n!=="object"){Jt(e,"data",o);break}case"src":case"href":if(o===""&&(n!=="a"||a!=="href")){e.removeAttribute(a);break}if(o==null||typeof o=="function"||typeof o=="symbol"||typeof o=="boolean"){e.removeAttribute(a);break}o=Ms(""+o),e.setAttribute(a,o);break;case"action":case"formAction":if(typeof o=="function"){e.setAttribute(a,"javascript:throw new Error('A React form was unexpectedly submitted. If you called form.submit() manually, consider using form.requestSubmit() instead. If you\\'re trying to use event.stopPropagation() in a submit event handler, consider also calling event.preventDefault().')");break}else typeof h=="function"&&(a==="formAction"?(n!=="input"&&je(e,n,"name",u.name,u,null),je(e,n,"formEncType",u.formEncType,u,null),je(e,n,"formMethod",u.formMethod,u,null),je(e,n,"formTarget",u.formTarget,u,null)):(je(e,n,"encType",u.encType,u,null),je(e,n,"method",u.method,u,null),je(e,n,"target",u.target,u,null)));if(o==null||typeof o=="symbol"||typeof o=="boolean"){e.removeAttribute(a);break}o=Ms(""+o),e.setAttribute(a,o);break;case"onClick":o!=null&&(e.onclick=ua);break;case"onScroll":o!=null&&we("scroll",e);break;case"onScrollEnd":o!=null&&we("scrollend",e);break;case"dangerouslySetInnerHTML":if(o!=null){if(typeof o!="object"||!("__html"in o))throw Error(s(61));if(a=o.__html,a!=null){if(u.children!=null)throw Error(s(60));e.innerHTML=a}}break;case"multiple":e.multiple=o&&typeof o!="function"&&typeof o!="symbol";break;case"muted":e.muted=o&&typeof o!="function"&&typeof o!="symbol";break;case"suppressContentEditableWarning":case"suppressHydrationWarning":case"defaultValue":case"defaultChecked":case"innerHTML":case"ref":break;case"autoFocus":break;case"xlinkHref":if(o==null||typeof o=="function"||typeof o=="boolean"||typeof o=="symbol"){e.removeAttribute("xlink:href");break}a=Ms(""+o),e.setAttributeNS("http://www.w3.org/1999/xlink","xlink:href",a);break;case"contentEditable":case"spellCheck":case"draggable":case"value":case"autoReverse":case"externalResourcesRequired":case"focusable":case"preserveAlpha":o!=null&&typeof o!="function"&&typeof o!="symbol"?e.setAttribute(a,""+o):e.removeAttribute(a);break;case"inert":case"allowFullScreen":case"async":case"autoPlay":case"controls":case"default":case"defer":case"disabled":case"disablePictureInPicture":case"disableRemotePlayback":case"formNoValidate":case"hidden":case"loop":case"noModule":case"noValidate":case"open":case"playsInline":case"readOnly":case"required":case"reversed":case"scoped":case"seamless":case"itemScope":o&&typeof o!="function"&&typeof o!="symbol"?e.setAttribute(a,""):e.removeAttribute(a);break;case"capture":case"download":o===!0?e.setAttribute(a,""):o!==!1&&o!=null&&typeof o!="function"&&typeof o!="symbol"?e.setAttribute(a,o):e.removeAttribute(a);break;case"cols":case"rows":case"size":case"span":o!=null&&typeof o!="function"&&typeof o!="symbol"&&!isNaN(o)&&1<=o?e.setAttribute(a,o):e.removeAttribute(a);break;case"rowSpan":case"start":o==null||typeof o=="function"||typeof o=="symbol"||isNaN(o)?e.removeAttribute(a):e.setAttribute(a,o);break;case"popover":we("beforetoggle",e),we("toggle",e),Ft(e,"popover",o);break;case"xlinkActuate":Kt(e,"http://www.w3.org/1999/xlink","xlink:actuate",o);break;case"xlinkArcrole":Kt(e,"http://www.w3.org/1999/xlink","xlink:arcrole",o);break;case"xlinkRole":Kt(e,"http://www.w3.org/1999/xlink","xlink:role",o);break;case"xlinkShow":Kt(e,"http://www.w3.org/1999/xlink","xlink:show",o);break;case"xlinkTitle":Kt(e,"http://www.w3.org/1999/xlink","xlink:title",o);break;case"xlinkType":Kt(e,"http://www.w3.org/1999/xlink","xlink:type",o);break;case"xmlBase":Kt(e,"http://www.w3.org/XML/1998/namespace","xml:base",o);break;case"xmlLang":Kt(e,"http://www.w3.org/XML/1998/namespace","xml:lang",o);break;case"xmlSpace":Kt(e,"http://www.w3.org/XML/1998/namespace","xml:space",o);break;case"is":Ft(e,"is",o);break;case"innerText":case"textContent":break;default:(!(2<a.length)||a[0]!=="o"&&a[0]!=="O"||a[1]!=="n"&&a[1]!=="N")&&(a=Yi.get(a)||a,Ft(e,a,o))}}function uh(e,n,a,o,u,h){switch(a){case"style":Bi(e,o,h);break;case"dangerouslySetInnerHTML":if(o!=null){if(typeof o!="object"||!("__html"in o))throw Error(s(61));if(a=o.__html,a!=null){if(u.children!=null)throw Error(s(60));e.innerHTML=a}}break;case"children":typeof o=="string"?hi(e,o):(typeof o=="number"||typeof o=="bigint")&&hi(e,""+o);break;case"onScroll":o!=null&&we("scroll",e);break;case"onScrollEnd":o!=null&&we("scrollend",e);break;case"onClick":o!=null&&(e.onclick=ua);break;case"suppressContentEditableWarning":case"suppressHydrationWarning":case"innerHTML":case"ref":break;case"innerText":case"textContent":break;default:if(!R.hasOwnProperty(a))t:{if(a[0]==="o"&&a[1]==="n"&&(u=a.endsWith("Capture"),n=a.slice(2,u?a.length-7:void 0),h=e[_n]||null,h=h!=null?h[a]:null,typeof h=="function"&&e.removeEventListener(n,h,u),typeof o=="function")){typeof h!="function"&&h!==null&&(a in e?e[a]=null:e.hasAttribute(a)&&e.removeAttribute(a)),e.addEventListener(n,o,u);break t}a in e?e[a]=o:o===!0?e.setAttribute(a,""):Ft(e,a,o)}}}function Gn(e,n,a){switch(n){case"div":case"span":case"svg":case"path":case"a":case"g":case"p":case"li":break;case"img":we("error",e),we("load",e);var o=!1,u=!1,h;for(h in a)if(a.hasOwnProperty(h)){var y=a[h];if(y!=null)switch(h){case"src":o=!0;break;case"srcSet":u=!0;break;case"children":case"dangerouslySetInnerHTML":throw Error(s(137,n));default:je(e,n,h,y,a,null)}}u&&je(e,n,"srcSet",a.srcSet,a,null),o&&je(e,n,"src",a.src,a,null);return;case"input":we("invalid",e);var C=h=y=u=null,G=null,it=null;for(o in a)if(a.hasOwnProperty(o)){var xt=a[o];if(xt!=null)switch(o){case"name":u=xt;break;case"type":y=xt;break;case"checked":G=xt;break;case"defaultChecked":it=xt;break;case"value":h=xt;break;case"defaultValue":C=xt;break;case"children":case"dangerouslySetInnerHTML":if(xt!=null)throw Error(s(137,n));break;default:je(e,n,o,xt,a,null)}}Xn(e,h,C,G,it,y,u,!1);return;case"select":we("invalid",e),o=y=h=null;for(u in a)if(a.hasOwnProperty(u)&&(C=a[u],C!=null))switch(u){case"value":h=C;break;case"defaultValue":y=C;break;case"multiple":o=C;default:je(e,n,u,C,a,null)}n=h,a=y,e.multiple=!!o,n!=null?Un(e,!!o,n,!1):a!=null&&Un(e,!!o,a,!0);return;case"textarea":we("invalid",e),h=u=o=null;for(y in a)if(a.hasOwnProperty(y)&&(C=a[y],C!=null))switch(y){case"value":o=C;break;case"defaultValue":u=C;break;case"children":h=C;break;case"dangerouslySetInnerHTML":if(C!=null)throw Error(s(91));break;default:je(e,n,y,C,a,null)}zi(e,o,u,h);return;case"option":for(G in a)if(a.hasOwnProperty(G)&&(o=a[G],o!=null))switch(G){case"selected":e.selected=o&&typeof o!="function"&&typeof o!="symbol";break;default:je(e,n,G,o,a,null)}return;case"dialog":we("beforetoggle",e),we("toggle",e),we("cancel",e),we("close",e);break;case"iframe":case"object":we("load",e);break;case"video":case"audio":for(o=0;o<Go.length;o++)we(Go[o],e);break;case"image":we("error",e),we("load",e);break;case"details":we("toggle",e);break;case"embed":case"source":case"link":we("error",e),we("load",e);case"area":case"base":case"br":case"col":case"hr":case"keygen":case"meta":case"param":case"track":case"wbr":case"menuitem":for(it in a)if(a.hasOwnProperty(it)&&(o=a[it],o!=null))switch(it){case"children":case"dangerouslySetInnerHTML":throw Error(s(137,n));default:je(e,n,it,o,a,null)}return;default:if(Ge(n)){for(xt in a)a.hasOwnProperty(xt)&&(o=a[xt],o!==void 0&&uh(e,n,xt,o,a,void 0));return}}for(C in a)a.hasOwnProperty(C)&&(o=a[C],o!=null&&je(e,n,C,o,a,null))}function iy(e,n,a,o){switch(n){case"div":case"span":case"svg":case"path":case"a":case"g":case"p":case"li":break;case"input":var u=null,h=null,y=null,C=null,G=null,it=null,xt=null;for(dt in a){var Mt=a[dt];if(a.hasOwnProperty(dt)&&Mt!=null)switch(dt){case"checked":break;case"value":break;case"defaultValue":G=Mt;default:o.hasOwnProperty(dt)||je(e,n,dt,null,o,Mt)}}for(var lt in o){var dt=o[lt];if(Mt=a[lt],o.hasOwnProperty(lt)&&(dt!=null||Mt!=null))switch(lt){case"type":h=dt;break;case"name":u=dt;break;case"checked":it=dt;break;case"defaultChecked":xt=dt;break;case"value":y=dt;break;case"defaultValue":C=dt;break;case"children":case"dangerouslySetInnerHTML":if(dt!=null)throw Error(s(137,n));break;default:dt!==Mt&&je(e,n,lt,dt,o,Mt)}}Wt(e,y,C,G,it,xt,h,u);return;case"select":dt=y=C=lt=null;for(h in a)if(G=a[h],a.hasOwnProperty(h)&&G!=null)switch(h){case"value":break;case"multiple":dt=G;default:o.hasOwnProperty(h)||je(e,n,h,null,o,G)}for(u in o)if(h=o[u],G=a[u],o.hasOwnProperty(u)&&(h!=null||G!=null))switch(u){case"value":lt=h;break;case"defaultValue":C=h;break;case"multiple":y=h;default:h!==G&&je(e,n,u,h,o,G)}n=C,a=y,o=dt,lt!=null?Un(e,!!a,lt,!1):!!o!=!!a&&(n!=null?Un(e,!!a,n,!0):Un(e,!!a,a?[]:"",!1));return;case"textarea":dt=lt=null;for(C in a)if(u=a[C],a.hasOwnProperty(C)&&u!=null&&!o.hasOwnProperty(C))switch(C){case"value":break;case"children":break;default:je(e,n,C,null,o,u)}for(y in o)if(u=o[y],h=a[y],o.hasOwnProperty(y)&&(u!=null||h!=null))switch(y){case"value":lt=u;break;case"defaultValue":dt=u;break;case"children":break;case"dangerouslySetInnerHTML":if(u!=null)throw Error(s(91));break;default:u!==h&&je(e,n,y,u,o,h)}fi(e,lt,dt);return;case"option":for(var Qt in a)if(lt=a[Qt],a.hasOwnProperty(Qt)&&lt!=null&&!o.hasOwnProperty(Qt))switch(Qt){case"selected":e.selected=!1;break;default:je(e,n,Qt,null,o,lt)}for(G in o)if(lt=o[G],dt=a[G],o.hasOwnProperty(G)&&lt!==dt&&(lt!=null||dt!=null))switch(G){case"selected":e.selected=lt&&typeof lt!="function"&&typeof lt!="symbol";break;default:je(e,n,G,lt,o,dt)}return;case"img":case"link":case"area":case"base":case"br":case"col":case"embed":case"hr":case"keygen":case"meta":case"param":case"source":case"track":case"wbr":case"menuitem":for(var ce in a)lt=a[ce],a.hasOwnProperty(ce)&&lt!=null&&!o.hasOwnProperty(ce)&&je(e,n,ce,null,o,lt);for(it in o)if(lt=o[it],dt=a[it],o.hasOwnProperty(it)&&lt!==dt&&(lt!=null||dt!=null))switch(it){case"children":case"dangerouslySetInnerHTML":if(lt!=null)throw Error(s(137,n));break;default:je(e,n,it,lt,o,dt)}return;default:if(Ge(n)){for(var $e in a)lt=a[$e],a.hasOwnProperty($e)&&lt!==void 0&&!o.hasOwnProperty($e)&&uh(e,n,$e,void 0,o,lt);for(xt in o)lt=o[xt],dt=a[xt],!o.hasOwnProperty(xt)||lt===dt||lt===void 0&&dt===void 0||uh(e,n,xt,lt,o,dt);return}}for(var $ in a)lt=a[$],a.hasOwnProperty($)&&lt!=null&&!o.hasOwnProperty($)&&je(e,n,$,null,o,lt);for(Mt in o)lt=o[Mt],dt=a[Mt],!o.hasOwnProperty(Mt)||lt===dt||lt==null&&dt==null||je(e,n,Mt,lt,o,dt)}function Fg(e){switch(e){case"css":case"script":case"font":case"img":case"image":case"input":case"link":return!0;default:return!1}}function ay(){if(typeof performance.getEntriesByType=="function"){for(var e=0,n=0,a=performance.getEntriesByType("resource"),o=0;o<a.length;o++){var u=a[o],h=u.transferSize,y=u.initiatorType,C=u.duration;if(h&&C&&Fg(y)){for(y=0,C=u.responseEnd,o+=1;o<a.length;o++){var G=a[o],it=G.startTime;if(it>C)break;var xt=G.transferSize,Mt=G.initiatorType;xt&&Fg(Mt)&&(G=G.responseEnd,y+=xt*(G<C?1:(C-it)/(G-it)))}if(--o,n+=8*(h+y)/(u.duration/1e3),e++,10<e)break}}if(0<e)return n/e/1e6}return navigator.connection&&(e=navigator.connection.downlink,typeof e=="number")?e:5}var fh=null,hh=null;function vc(e){return e.nodeType===9?e:e.ownerDocument}function Hg(e){switch(e){case"http://www.w3.org/2000/svg":return 1;case"http://www.w3.org/1998/Math/MathML":return 2;default:return 0}}function Gg(e,n){if(e===0)switch(n){case"svg":return 1;case"math":return 2;default:return 0}return e===1&&n==="foreignObject"?0:e}function dh(e,n){return e==="textarea"||e==="noscript"||typeof n.children=="string"||typeof n.children=="number"||typeof n.children=="bigint"||typeof n.dangerouslySetInnerHTML=="object"&&n.dangerouslySetInnerHTML!==null&&n.dangerouslySetInnerHTML.__html!=null}var ph=null;function sy(){var e=window.event;return e&&e.type==="popstate"?e===ph?!1:(ph=e,!0):(ph=null,!1)}var Vg=typeof setTimeout=="function"?setTimeout:void 0,ry=typeof clearTimeout=="function"?clearTimeout:void 0,kg=typeof Promise=="function"?Promise:void 0,oy=typeof queueMicrotask=="function"?queueMicrotask:typeof kg<"u"?function(e){return kg.resolve(null).then(e).catch(ly)}:Vg;function ly(e){setTimeout(function(){throw e})}function ss(e){return e==="head"}function Xg(e,n){var a=n,o=0;do{var u=a.nextSibling;if(e.removeChild(a),u&&u.nodeType===8)if(a=u.data,a==="/$"||a==="/&"){if(o===0){e.removeChild(u),Nr(n);return}o--}else if(a==="$"||a==="$?"||a==="$~"||a==="$!"||a==="&")o++;else if(a==="html")ko(e.ownerDocument.documentElement);else if(a==="head"){a=e.ownerDocument.head,ko(a);for(var h=a.firstChild;h;){var y=h.nextSibling,C=h.nodeName;h[Ai]||C==="SCRIPT"||C==="STYLE"||C==="LINK"&&h.rel.toLowerCase()==="stylesheet"||a.removeChild(h),h=y}}else a==="body"&&ko(e.ownerDocument.body);a=u}while(a);Nr(n)}function Wg(e,n){var a=e;e=0;do{var o=a.nextSibling;if(a.nodeType===1?n?(a._stashedDisplay=a.style.display,a.style.display="none"):(a.style.display=a._stashedDisplay||"",a.getAttribute("style")===""&&a.removeAttribute("style")):a.nodeType===3&&(n?(a._stashedText=a.nodeValue,a.nodeValue=""):a.nodeValue=a._stashedText||""),o&&o.nodeType===8)if(a=o.data,a==="/$"){if(e===0)break;e--}else a!=="$"&&a!=="$?"&&a!=="$~"&&a!=="$!"||e++;a=o}while(a)}function mh(e){var n=e.firstChild;for(n&&n.nodeType===10&&(n=n.nextSibling);n;){var a=n;switch(n=n.nextSibling,a.nodeName){case"HTML":case"HEAD":case"BODY":mh(a),Fa(a);continue;case"SCRIPT":case"STYLE":continue;case"LINK":if(a.rel.toLowerCase()==="stylesheet")continue}e.removeChild(a)}}function cy(e,n,a,o){for(;e.nodeType===1;){var u=a;if(e.nodeName.toLowerCase()!==n.toLowerCase()){if(!o&&(e.nodeName!=="INPUT"||e.type!=="hidden"))break}else if(o){if(!e[Ai])switch(n){case"meta":if(!e.hasAttribute("itemprop"))break;return e;case"link":if(h=e.getAttribute("rel"),h==="stylesheet"&&e.hasAttribute("data-precedence"))break;if(h!==u.rel||e.getAttribute("href")!==(u.href==null||u.href===""?null:u.href)||e.getAttribute("crossorigin")!==(u.crossOrigin==null?null:u.crossOrigin)||e.getAttribute("title")!==(u.title==null?null:u.title))break;return e;case"style":if(e.hasAttribute("data-precedence"))break;return e;case"script":if(h=e.getAttribute("src"),(h!==(u.src==null?null:u.src)||e.getAttribute("type")!==(u.type==null?null:u.type)||e.getAttribute("crossorigin")!==(u.crossOrigin==null?null:u.crossOrigin))&&h&&e.hasAttribute("async")&&!e.hasAttribute("itemprop"))break;return e;default:return e}}else if(n==="input"&&e.type==="hidden"){var h=u.name==null?null:""+u.name;if(u.type==="hidden"&&e.getAttribute("name")===h)return e}else return e;if(e=Li(e.nextSibling),e===null)break}return null}function uy(e,n,a){if(n==="")return null;for(;e.nodeType!==3;)if((e.nodeType!==1||e.nodeName!=="INPUT"||e.type!=="hidden")&&!a||(e=Li(e.nextSibling),e===null))return null;return e}function qg(e,n){for(;e.nodeType!==8;)if((e.nodeType!==1||e.nodeName!=="INPUT"||e.type!=="hidden")&&!n||(e=Li(e.nextSibling),e===null))return null;return e}function gh(e){return e.data==="$?"||e.data==="$~"}function _h(e){return e.data==="$!"||e.data==="$?"&&e.ownerDocument.readyState!=="loading"}function fy(e,n){var a=e.ownerDocument;if(e.data==="$~")e._reactRetry=n;else if(e.data!=="$?"||a.readyState!=="loading")n();else{var o=function(){n(),a.removeEventListener("DOMContentLoaded",o)};a.addEventListener("DOMContentLoaded",o),e._reactRetry=o}}function Li(e){for(;e!=null;e=e.nextSibling){var n=e.nodeType;if(n===1||n===3)break;if(n===8){if(n=e.data,n==="$"||n==="$!"||n==="$?"||n==="$~"||n==="&"||n==="F!"||n==="F")break;if(n==="/$"||n==="/&")return null}}return e}var vh=null;function Yg(e){e=e.nextSibling;for(var n=0;e;){if(e.nodeType===8){var a=e.data;if(a==="/$"||a==="/&"){if(n===0)return Li(e.nextSibling);n--}else a!=="$"&&a!=="$!"&&a!=="$?"&&a!=="$~"&&a!=="&"||n++}e=e.nextSibling}return null}function Zg(e){e=e.previousSibling;for(var n=0;e;){if(e.nodeType===8){var a=e.data;if(a==="$"||a==="$!"||a==="$?"||a==="$~"||a==="&"){if(n===0)return e;n--}else a!=="/$"&&a!=="/&"||n++}e=e.previousSibling}return null}function Kg(e,n,a){switch(n=vc(a),e){case"html":if(e=n.documentElement,!e)throw Error(s(452));return e;case"head":if(e=n.head,!e)throw Error(s(453));return e;case"body":if(e=n.body,!e)throw Error(s(454));return e;default:throw Error(s(451))}}function ko(e){for(var n=e.attributes;n.length;)e.removeAttributeNode(n[0]);Fa(e)}var Oi=new Map,Jg=new Set;function xc(e){return typeof e.getRootNode=="function"?e.getRootNode():e.nodeType===9?e:e.ownerDocument}var Aa=k.d;k.d={f:hy,r:dy,D:py,C:my,L:gy,m:_y,X:xy,S:vy,M:Sy};function hy(){var e=Aa.f(),n=uc();return e||n}function dy(e){var n=ca(e);n!==null&&n.tag===5&&n.type==="form"?d0(n):Aa.r(e)}var Cr=typeof document>"u"?null:document;function Qg(e,n,a){var o=Cr;if(o&&typeof n=="string"&&n){var u=qe(n);u='link[rel="'+e+'"][href="'+u+'"]',typeof a=="string"&&(u+='[crossorigin="'+a+'"]'),Jg.has(u)||(Jg.add(u),e={rel:e,crossOrigin:a,href:n},o.querySelector(u)===null&&(n=o.createElement("link"),Gn(n,"link",e),bn(n),o.head.appendChild(n)))}}function py(e){Aa.D(e),Qg("dns-prefetch",e,null)}function my(e,n){Aa.C(e,n),Qg("preconnect",e,n)}function gy(e,n,a){Aa.L(e,n,a);var o=Cr;if(o&&e&&n){var u='link[rel="preload"][as="'+qe(n)+'"]';n==="image"&&a&&a.imageSrcSet?(u+='[imagesrcset="'+qe(a.imageSrcSet)+'"]',typeof a.imageSizes=="string"&&(u+='[imagesizes="'+qe(a.imageSizes)+'"]')):u+='[href="'+qe(e)+'"]';var h=u;switch(n){case"style":h=Dr(e);break;case"script":h=Ur(e)}Oi.has(h)||(e=v({rel:"preload",href:n==="image"&&a&&a.imageSrcSet?void 0:e,as:n},a),Oi.set(h,e),o.querySelector(u)!==null||n==="style"&&o.querySelector(Xo(h))||n==="script"&&o.querySelector(Wo(h))||(n=o.createElement("link"),Gn(n,"link",e),bn(n),o.head.appendChild(n)))}}function _y(e,n){Aa.m(e,n);var a=Cr;if(a&&e){var o=n&&typeof n.as=="string"?n.as:"script",u='link[rel="modulepreload"][as="'+qe(o)+'"][href="'+qe(e)+'"]',h=u;switch(o){case"audioworklet":case"paintworklet":case"serviceworker":case"sharedworker":case"worker":case"script":h=Ur(e)}if(!Oi.has(h)&&(e=v({rel:"modulepreload",href:e},n),Oi.set(h,e),a.querySelector(u)===null)){switch(o){case"audioworklet":case"paintworklet":case"serviceworker":case"sharedworker":case"worker":case"script":if(a.querySelector(Wo(h)))return}o=a.createElement("link"),Gn(o,"link",e),bn(o),a.head.appendChild(o)}}}function vy(e,n,a){Aa.S(e,n,a);var o=Cr;if(o&&e){var u=Ha(o).hoistableStyles,h=Dr(e);n=n||"default";var y=u.get(h);if(!y){var C={loading:0,preload:null};if(y=o.querySelector(Xo(h)))C.loading=5;else{e=v({rel:"stylesheet",href:e,"data-precedence":n},a),(a=Oi.get(h))&&xh(e,a);var G=y=o.createElement("link");bn(G),Gn(G,"link",e),G._p=new Promise(function(it,xt){G.onload=it,G.onerror=xt}),G.addEventListener("load",function(){C.loading|=1}),G.addEventListener("error",function(){C.loading|=2}),C.loading|=4,Sc(y,n,o)}y={type:"stylesheet",instance:y,count:1,state:C},u.set(h,y)}}}function xy(e,n){Aa.X(e,n);var a=Cr;if(a&&e){var o=Ha(a).hoistableScripts,u=Ur(e),h=o.get(u);h||(h=a.querySelector(Wo(u)),h||(e=v({src:e,async:!0},n),(n=Oi.get(u))&&Sh(e,n),h=a.createElement("script"),bn(h),Gn(h,"link",e),a.head.appendChild(h)),h={type:"script",instance:h,count:1,state:null},o.set(u,h))}}function Sy(e,n){Aa.M(e,n);var a=Cr;if(a&&e){var o=Ha(a).hoistableScripts,u=Ur(e),h=o.get(u);h||(h=a.querySelector(Wo(u)),h||(e=v({src:e,async:!0,type:"module"},n),(n=Oi.get(u))&&Sh(e,n),h=a.createElement("script"),bn(h),Gn(h,"link",e),a.head.appendChild(h)),h={type:"script",instance:h,count:1,state:null},o.set(u,h))}}function jg(e,n,a,o){var u=(u=et.current)?xc(u):null;if(!u)throw Error(s(446));switch(e){case"meta":case"title":return null;case"style":return typeof a.precedence=="string"&&typeof a.href=="string"?(n=Dr(a.href),a=Ha(u).hoistableStyles,o=a.get(n),o||(o={type:"style",instance:null,count:0,state:null},a.set(n,o)),o):{type:"void",instance:null,count:0,state:null};case"link":if(a.rel==="stylesheet"&&typeof a.href=="string"&&typeof a.precedence=="string"){e=Dr(a.href);var h=Ha(u).hoistableStyles,y=h.get(e);if(y||(u=u.ownerDocument||u,y={type:"stylesheet",instance:null,count:0,state:{loading:0,preload:null}},h.set(e,y),(h=u.querySelector(Xo(e)))&&!h._p&&(y.instance=h,y.state.loading=5),Oi.has(e)||(a={rel:"preload",as:"style",href:a.href,crossOrigin:a.crossOrigin,integrity:a.integrity,media:a.media,hrefLang:a.hrefLang,referrerPolicy:a.referrerPolicy},Oi.set(e,a),h||yy(u,e,a,y.state))),n&&o===null)throw Error(s(528,""));return y}if(n&&o!==null)throw Error(s(529,""));return null;case"script":return n=a.async,a=a.src,typeof a=="string"&&n&&typeof n!="function"&&typeof n!="symbol"?(n=Ur(a),a=Ha(u).hoistableScripts,o=a.get(n),o||(o={type:"script",instance:null,count:0,state:null},a.set(n,o)),o):{type:"void",instance:null,count:0,state:null};default:throw Error(s(444,e))}}function Dr(e){return'href="'+qe(e)+'"'}function Xo(e){return'link[rel="stylesheet"]['+e+"]"}function $g(e){return v({},e,{"data-precedence":e.precedence,precedence:null})}function yy(e,n,a,o){e.querySelector('link[rel="preload"][as="style"]['+n+"]")?o.loading=1:(n=e.createElement("link"),o.preload=n,n.addEventListener("load",function(){return o.loading|=1}),n.addEventListener("error",function(){return o.loading|=2}),Gn(n,"link",a),bn(n),e.head.appendChild(n))}function Ur(e){return'[src="'+qe(e)+'"]'}function Wo(e){return"script[async]"+e}function t_(e,n,a){if(n.count++,n.instance===null)switch(n.type){case"style":var o=e.querySelector('style[data-href~="'+qe(a.href)+'"]');if(o)return n.instance=o,bn(o),o;var u=v({},a,{"data-href":a.href,"data-precedence":a.precedence,href:null,precedence:null});return o=(e.ownerDocument||e).createElement("style"),bn(o),Gn(o,"style",u),Sc(o,a.precedence,e),n.instance=o;case"stylesheet":u=Dr(a.href);var h=e.querySelector(Xo(u));if(h)return n.state.loading|=4,n.instance=h,bn(h),h;o=$g(a),(u=Oi.get(u))&&xh(o,u),h=(e.ownerDocument||e).createElement("link"),bn(h);var y=h;return y._p=new Promise(function(C,G){y.onload=C,y.onerror=G}),Gn(h,"link",o),n.state.loading|=4,Sc(h,a.precedence,e),n.instance=h;case"script":return h=Ur(a.src),(u=e.querySelector(Wo(h)))?(n.instance=u,bn(u),u):(o=a,(u=Oi.get(h))&&(o=v({},a),Sh(o,u)),e=e.ownerDocument||e,u=e.createElement("script"),bn(u),Gn(u,"link",o),e.head.appendChild(u),n.instance=u);case"void":return null;default:throw Error(s(443,n.type))}else n.type==="stylesheet"&&(n.state.loading&4)===0&&(o=n.instance,n.state.loading|=4,Sc(o,a.precedence,e));return n.instance}function Sc(e,n,a){for(var o=a.querySelectorAll('link[rel="stylesheet"][data-precedence],style[data-precedence]'),u=o.length?o[o.length-1]:null,h=u,y=0;y<o.length;y++){var C=o[y];if(C.dataset.precedence===n)h=C;else if(h!==u)break}h?h.parentNode.insertBefore(e,h.nextSibling):(n=a.nodeType===9?a.head:a,n.insertBefore(e,n.firstChild))}function xh(e,n){e.crossOrigin==null&&(e.crossOrigin=n.crossOrigin),e.referrerPolicy==null&&(e.referrerPolicy=n.referrerPolicy),e.title==null&&(e.title=n.title)}function Sh(e,n){e.crossOrigin==null&&(e.crossOrigin=n.crossOrigin),e.referrerPolicy==null&&(e.referrerPolicy=n.referrerPolicy),e.integrity==null&&(e.integrity=n.integrity)}var yc=null;function e_(e,n,a){if(yc===null){var o=new Map,u=yc=new Map;u.set(a,o)}else u=yc,o=u.get(a),o||(o=new Map,u.set(a,o));if(o.has(e))return o;for(o.set(e,null),a=a.getElementsByTagName(e),u=0;u<a.length;u++){var h=a[u];if(!(h[Ai]||h[fn]||e==="link"&&h.getAttribute("rel")==="stylesheet")&&h.namespaceURI!=="http://www.w3.org/2000/svg"){var y=h.getAttribute(n)||"";y=e+y;var C=o.get(y);C?C.push(h):o.set(y,[h])}}return o}function n_(e,n,a){e=e.ownerDocument||e,e.head.insertBefore(a,n==="title"?e.querySelector("head > title"):null)}function My(e,n,a){if(a===1||n.itemProp!=null)return!1;switch(e){case"meta":case"title":return!0;case"style":if(typeof n.precedence!="string"||typeof n.href!="string"||n.href==="")break;return!0;case"link":if(typeof n.rel!="string"||typeof n.href!="string"||n.href===""||n.onLoad||n.onError)break;switch(n.rel){case"stylesheet":return e=n.disabled,typeof n.precedence=="string"&&e==null;default:return!0}case"script":if(n.async&&typeof n.async!="function"&&typeof n.async!="symbol"&&!n.onLoad&&!n.onError&&n.src&&typeof n.src=="string")return!0}return!1}function i_(e){return!(e.type==="stylesheet"&&(e.state.loading&3)===0)}function by(e,n,a,o){if(a.type==="stylesheet"&&(typeof o.media!="string"||matchMedia(o.media).matches!==!1)&&(a.state.loading&4)===0){if(a.instance===null){var u=Dr(o.href),h=n.querySelector(Xo(u));if(h){n=h._p,n!==null&&typeof n=="object"&&typeof n.then=="function"&&(e.count++,e=Mc.bind(e),n.then(e,e)),a.state.loading|=4,a.instance=h,bn(h);return}h=n.ownerDocument||n,o=$g(o),(u=Oi.get(u))&&xh(o,u),h=h.createElement("link"),bn(h);var y=h;y._p=new Promise(function(C,G){y.onload=C,y.onerror=G}),Gn(h,"link",o),a.instance=h}e.stylesheets===null&&(e.stylesheets=new Map),e.stylesheets.set(a,n),(n=a.state.preload)&&(a.state.loading&3)===0&&(e.count++,a=Mc.bind(e),n.addEventListener("load",a),n.addEventListener("error",a))}}var yh=0;function Ey(e,n){return e.stylesheets&&e.count===0&&Ec(e,e.stylesheets),0<e.count||0<e.imgCount?function(a){var o=setTimeout(function(){if(e.stylesheets&&Ec(e,e.stylesheets),e.unsuspend){var h=e.unsuspend;e.unsuspend=null,h()}},6e4+n);0<e.imgBytes&&yh===0&&(yh=62500*ay());var u=setTimeout(function(){if(e.waitingForImages=!1,e.count===0&&(e.stylesheets&&Ec(e,e.stylesheets),e.unsuspend)){var h=e.unsuspend;e.unsuspend=null,h()}},(e.imgBytes>yh?50:800)+n);return e.unsuspend=a,function(){e.unsuspend=null,clearTimeout(o),clearTimeout(u)}}:null}function Mc(){if(this.count--,this.count===0&&(this.imgCount===0||!this.waitingForImages)){if(this.stylesheets)Ec(this,this.stylesheets);else if(this.unsuspend){var e=this.unsuspend;this.unsuspend=null,e()}}}var bc=null;function Ec(e,n){e.stylesheets=null,e.unsuspend!==null&&(e.count++,bc=new Map,n.forEach(Ty,e),bc=null,Mc.call(e))}function Ty(e,n){if(!(n.state.loading&4)){var a=bc.get(e);if(a)var o=a.get(null);else{a=new Map,bc.set(e,a);for(var u=e.querySelectorAll("link[data-precedence],style[data-precedence]"),h=0;h<u.length;h++){var y=u[h];(y.nodeName==="LINK"||y.getAttribute("media")!=="not all")&&(a.set(y.dataset.precedence,y),o=y)}o&&a.set(null,o)}u=n.instance,y=u.getAttribute("data-precedence"),h=a.get(y)||o,h===o&&a.set(null,u),a.set(y,u),this.count++,o=Mc.bind(this),u.addEventListener("load",o),u.addEventListener("error",o),h?h.parentNode.insertBefore(u,h.nextSibling):(e=e.nodeType===9?e.head:e,e.insertBefore(u,e.firstChild)),n.state.loading|=4}}var qo={$$typeof:U,Provider:null,Consumer:null,_currentValue:tt,_currentValue2:tt,_threadCount:0};function Ay(e,n,a,o,u,h,y,C,G){this.tag=1,this.containerInfo=e,this.pingCache=this.current=this.pendingChildren=null,this.timeoutHandle=-1,this.callbackNode=this.next=this.pendingContext=this.context=this.cancelPendingCommit=null,this.callbackPriority=0,this.expirationTimes=jt(-1),this.entangledLanes=this.shellSuspendCounter=this.errorRecoveryDisabledLanes=this.expiredLanes=this.warmLanes=this.pingedLanes=this.suspendedLanes=this.pendingLanes=0,this.entanglements=jt(0),this.hiddenUpdates=jt(null),this.identifierPrefix=o,this.onUncaughtError=u,this.onCaughtError=h,this.onRecoverableError=y,this.pooledCache=null,this.pooledCacheLanes=0,this.formState=G,this.incompleteTransitions=new Map}function a_(e,n,a,o,u,h,y,C,G,it,xt,Mt){return e=new Ay(e,n,a,y,G,it,xt,Mt,C),n=1,h===!0&&(n|=24),h=pi(3,null,null,n),e.current=h,h.stateNode=e,n=$u(),n.refCount++,e.pooledCache=n,n.refCount++,h.memoizedState={element:o,isDehydrated:a,cache:n},af(h),e}function s_(e){return e?(e=lr,e):lr}function r_(e,n,a,o,u,h){u=s_(u),o.context===null?o.context=u:o.pendingContext=u,o=Za(n),o.payload={element:a},h=h===void 0?null:h,h!==null&&(o.callback=h),a=Ka(e,o,n),a!==null&&(ci(a,e,n),Eo(a,e,n))}function o_(e,n){if(e=e.memoizedState,e!==null&&e.dehydrated!==null){var a=e.retryLane;e.retryLane=a!==0&&a<n?a:n}}function Mh(e,n){o_(e,n),(e=e.alternate)&&o_(e,n)}function l_(e){if(e.tag===13||e.tag===31){var n=As(e,67108864);n!==null&&ci(n,e,67108864),Mh(e,67108864)}}function c_(e){if(e.tag===13||e.tag===31){var n=xi();n=de(n);var a=As(e,n);a!==null&&ci(a,e,n),Mh(e,n)}}var Tc=!0;function wy(e,n,a,o){var u=P.T;P.T=null;var h=k.p;try{k.p=2,bh(e,n,a,o)}finally{k.p=h,P.T=u}}function Ry(e,n,a,o){var u=P.T;P.T=null;var h=k.p;try{k.p=8,bh(e,n,a,o)}finally{k.p=h,P.T=u}}function bh(e,n,a,o){if(Tc){var u=Eh(o);if(u===null)ch(e,n,o,Ac,a),f_(e,o);else if(Dy(u,e,n,a,o))o.stopPropagation();else if(f_(e,o),n&4&&-1<Cy.indexOf(e)){for(;u!==null;){var h=ca(u);if(h!==null)switch(h.tag){case 3:if(h=h.stateNode,h.current.memoizedState.isDehydrated){var y=Nt(h.pendingLanes);if(y!==0){var C=h;for(C.pendingLanes|=2,C.entangledLanes|=2;y;){var G=1<<31-kt(y);C.entanglements[1]|=G,y&=~G}Qi(h),(He&6)===0&&(lc=Me()+500,Ho(0))}}break;case 31:case 13:C=As(h,2),C!==null&&ci(C,h,2),uc(),Mh(h,2)}if(h=Eh(o),h===null&&ch(e,n,o,Ac,a),h===u)break;u=h}u!==null&&o.stopPropagation()}else ch(e,n,o,null,a)}}function Eh(e){return e=Tu(e),Th(e)}var Ac=null;function Th(e){if(Ac=null,e=la(e),e!==null){var n=c(e);if(n===null)e=null;else{var a=n.tag;if(a===13){if(e=f(n),e!==null)return e;e=null}else if(a===31){if(e=d(n),e!==null)return e;e=null}else if(a===3){if(n.stateNode.current.memoizedState.isDehydrated)return n.tag===3?n.stateNode.containerInfo:null;e=null}else n!==e&&(e=null)}}return Ac=e,null}function u_(e){switch(e){case"beforetoggle":case"cancel":case"click":case"close":case"contextmenu":case"copy":case"cut":case"auxclick":case"dblclick":case"dragend":case"dragstart":case"drop":case"focusin":case"focusout":case"input":case"invalid":case"keydown":case"keypress":case"keyup":case"mousedown":case"mouseup":case"paste":case"pause":case"play":case"pointercancel":case"pointerdown":case"pointerup":case"ratechange":case"reset":case"resize":case"seeked":case"submit":case"toggle":case"touchcancel":case"touchend":case"touchstart":case"volumechange":case"change":case"selectionchange":case"textInput":case"compositionstart":case"compositionend":case"compositionupdate":case"beforeblur":case"afterblur":case"beforeinput":case"blur":case"fullscreenchange":case"focus":case"hashchange":case"popstate":case"select":case"selectstart":return 2;case"drag":case"dragenter":case"dragexit":case"dragleave":case"dragover":case"mousemove":case"mouseout":case"mouseover":case"pointermove":case"pointerout":case"pointerover":case"scroll":case"touchmove":case"wheel":case"mouseenter":case"mouseleave":case"pointerenter":case"pointerleave":return 8;case"message":switch(Le()){case I:return 2;case T:return 8;case j:case rt:return 32;case pt:return 268435456;default:return 32}default:return 32}}var Ah=!1,rs=null,os=null,ls=null,Yo=new Map,Zo=new Map,cs=[],Cy="mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset".split(" ");function f_(e,n){switch(e){case"focusin":case"focusout":rs=null;break;case"dragenter":case"dragleave":os=null;break;case"mouseover":case"mouseout":ls=null;break;case"pointerover":case"pointerout":Yo.delete(n.pointerId);break;case"gotpointercapture":case"lostpointercapture":Zo.delete(n.pointerId)}}function Ko(e,n,a,o,u,h){return e===null||e.nativeEvent!==h?(e={blockedOn:n,domEventName:a,eventSystemFlags:o,nativeEvent:h,targetContainers:[u]},n!==null&&(n=ca(n),n!==null&&l_(n)),e):(e.eventSystemFlags|=o,n=e.targetContainers,u!==null&&n.indexOf(u)===-1&&n.push(u),e)}function Dy(e,n,a,o,u){switch(n){case"focusin":return rs=Ko(rs,e,n,a,o,u),!0;case"dragenter":return os=Ko(os,e,n,a,o,u),!0;case"mouseover":return ls=Ko(ls,e,n,a,o,u),!0;case"pointerover":var h=u.pointerId;return Yo.set(h,Ko(Yo.get(h)||null,e,n,a,o,u)),!0;case"gotpointercapture":return h=u.pointerId,Zo.set(h,Ko(Zo.get(h)||null,e,n,a,o,u)),!0}return!1}function h_(e){var n=la(e.target);if(n!==null){var a=c(n);if(a!==null){if(n=a.tag,n===13){if(n=f(a),n!==null){e.blockedOn=n,Dn(e.priority,function(){c_(a)});return}}else if(n===31){if(n=d(a),n!==null){e.blockedOn=n,Dn(e.priority,function(){c_(a)});return}}else if(n===3&&a.stateNode.current.memoizedState.isDehydrated){e.blockedOn=a.tag===3?a.stateNode.containerInfo:null;return}}}e.blockedOn=null}function wc(e){if(e.blockedOn!==null)return!1;for(var n=e.targetContainers;0<n.length;){var a=Eh(e.nativeEvent);if(a===null){a=e.nativeEvent;var o=new a.constructor(a.type,a);Eu=o,a.target.dispatchEvent(o),Eu=null}else return n=ca(a),n!==null&&l_(n),e.blockedOn=a,!1;n.shift()}return!0}function d_(e,n,a){wc(e)&&a.delete(n)}function Uy(){Ah=!1,rs!==null&&wc(rs)&&(rs=null),os!==null&&wc(os)&&(os=null),ls!==null&&wc(ls)&&(ls=null),Yo.forEach(d_),Zo.forEach(d_)}function Rc(e,n){e.blockedOn===n&&(e.blockedOn=null,Ah||(Ah=!0,r.unstable_scheduleCallback(r.unstable_NormalPriority,Uy)))}var Cc=null;function p_(e){Cc!==e&&(Cc=e,r.unstable_scheduleCallback(r.unstable_NormalPriority,function(){Cc===e&&(Cc=null);for(var n=0;n<e.length;n+=3){var a=e[n],o=e[n+1],u=e[n+2];if(typeof o!="function"){if(Th(o||a)===null)continue;break}var h=ca(a);h!==null&&(e.splice(n,3),n-=3,Ef(h,{pending:!0,data:u,method:a.method,action:o},o,u))}}))}function Nr(e){function n(G){return Rc(G,e)}rs!==null&&Rc(rs,e),os!==null&&Rc(os,e),ls!==null&&Rc(ls,e),Yo.forEach(n),Zo.forEach(n);for(var a=0;a<cs.length;a++){var o=cs[a];o.blockedOn===e&&(o.blockedOn=null)}for(;0<cs.length&&(a=cs[0],a.blockedOn===null);)h_(a),a.blockedOn===null&&cs.shift();if(a=(e.ownerDocument||e).$$reactFormReplay,a!=null)for(o=0;o<a.length;o+=3){var u=a[o],h=a[o+1],y=u[_n]||null;if(typeof h=="function")y||p_(a);else if(y){var C=null;if(h&&h.hasAttribute("formAction")){if(u=h,y=h[_n]||null)C=y.formAction;else if(Th(u)!==null)continue}else C=y.action;typeof C=="function"?a[o+1]=C:(a.splice(o,3),o-=3),p_(a)}}}function m_(){function e(h){h.canIntercept&&h.info==="react-transition"&&h.intercept({handler:function(){return new Promise(function(y){return u=y})},focusReset:"manual",scroll:"manual"})}function n(){u!==null&&(u(),u=null),o||setTimeout(a,20)}function a(){if(!o&&!navigation.transition){var h=navigation.currentEntry;h&&h.url!=null&&navigation.navigate(h.url,{state:h.getState(),info:"react-transition",history:"replace"})}}if(typeof navigation=="object"){var o=!1,u=null;return navigation.addEventListener("navigate",e),navigation.addEventListener("navigatesuccess",n),navigation.addEventListener("navigateerror",n),setTimeout(a,100),function(){o=!0,navigation.removeEventListener("navigate",e),navigation.removeEventListener("navigatesuccess",n),navigation.removeEventListener("navigateerror",n),u!==null&&(u(),u=null)}}}function wh(e){this._internalRoot=e}Dc.prototype.render=wh.prototype.render=function(e){var n=this._internalRoot;if(n===null)throw Error(s(409));var a=n.current,o=xi();r_(a,o,e,n,null,null)},Dc.prototype.unmount=wh.prototype.unmount=function(){var e=this._internalRoot;if(e!==null){this._internalRoot=null;var n=e.containerInfo;r_(e.current,2,null,e,null,null),uc(),n[en]=null}};function Dc(e){this._internalRoot=e}Dc.prototype.unstable_scheduleHydration=function(e){if(e){var n=Sn();e={blockedOn:null,target:e,priority:n};for(var a=0;a<cs.length&&n!==0&&n<cs[a].priority;a++);cs.splice(a,0,e),a===0&&h_(e)}};var g_=t.version;if(g_!=="19.2.8")throw Error(s(527,g_,"19.2.8"));k.findDOMNode=function(e){var n=e._reactInternals;if(n===void 0)throw typeof e.render=="function"?Error(s(188)):(e=Object.keys(e).join(","),Error(s(268,e)));return e=p(n),e=e!==null?_(e):null,e=e===null?null:e.stateNode,e};var Ny={bundleType:0,version:"19.2.8",rendererPackageName:"react-dom",currentDispatcherRef:P,reconcilerVersion:"19.2.8"};if(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__<"u"){var Uc=__REACT_DEVTOOLS_GLOBAL_HOOK__;if(!Uc.isDisabled&&Uc.supportsFiber)try{ft=Uc.inject(Ny),mt=Uc}catch{}}return Qo.createRoot=function(e,n){if(!l(e))throw Error(s(299));var a=!1,o="",u=b0,h=E0,y=T0;return n!=null&&(n.unstable_strictMode===!0&&(a=!0),n.identifierPrefix!==void 0&&(o=n.identifierPrefix),n.onUncaughtError!==void 0&&(u=n.onUncaughtError),n.onCaughtError!==void 0&&(h=n.onCaughtError),n.onRecoverableError!==void 0&&(y=n.onRecoverableError)),n=a_(e,1,!1,null,null,a,o,null,u,h,y,m_),e[en]=n.current,lh(e),new wh(n)},Qo.hydrateRoot=function(e,n,a){if(!l(e))throw Error(s(299));var o=!1,u="",h=b0,y=E0,C=T0,G=null;return a!=null&&(a.unstable_strictMode===!0&&(o=!0),a.identifierPrefix!==void 0&&(u=a.identifierPrefix),a.onUncaughtError!==void 0&&(h=a.onUncaughtError),a.onCaughtError!==void 0&&(y=a.onCaughtError),a.onRecoverableError!==void 0&&(C=a.onRecoverableError),a.formState!==void 0&&(G=a.formState)),n=a_(e,1,!0,n,a??null,o,u,G,h,y,C,m_),n.context=s_(null),a=n.current,o=xi(),o=de(o),u=Za(o),u.callback=null,Ka(a,u,o),a=o,n.current.lanes=a,qt(n,a),Qi(n),e[en]=n.current,lh(e),new Dc(n)},Qo.version="19.2.8",Qo}var A_;function Vy(){if(A_)return Dh.exports;A_=1;function r(){if(!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__>"u"||typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE!="function"))try{__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(r)}catch(t){console.error(t)}}return r(),Dh.exports=Gy(),Dh.exports}var ky=Vy();/**
 * @license lucide-react v0.510.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Xy=r=>r.replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase(),Wy=r=>r.replace(/^([A-Z])|[\s-_]+(\w)/g,(t,i,s)=>s?s.toUpperCase():i.toLowerCase()),w_=r=>{const t=Wy(r);return t.charAt(0).toUpperCase()+t.slice(1)},Xv=(...r)=>r.filter((t,i,s)=>!!t&&t.trim()!==""&&s.indexOf(t)===i).join(" ").trim(),qy=r=>{for(const t in r)if(t.startsWith("aria-")||t==="role"||t==="title")return!0};/**
 * @license lucide-react v0.510.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */var Yy={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"};/**
 * @license lucide-react v0.510.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Zy=Zn.forwardRef(({color:r="currentColor",size:t=24,strokeWidth:i=2,absoluteStrokeWidth:s,className:l="",children:c,iconNode:f,...d},m)=>Zn.createElement("svg",{ref:m,...Yy,width:t,height:t,stroke:r,strokeWidth:s?Number(i)*24/Number(t):i,className:Xv("lucide",l),...!c&&!qy(d)&&{"aria-hidden":"true"},...d},[...f.map(([p,_])=>Zn.createElement(p,_)),...Array.isArray(c)?c:[c]]));/**
 * @license lucide-react v0.510.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const $s=(r,t)=>{const i=Zn.forwardRef(({className:s,...l},c)=>Zn.createElement(Zy,{ref:c,iconNode:t,className:Xv(`lucide-${Xy(w_(r))}`,`lucide-${r}`,s),...l}));return i.displayName=w_(r),i};/**
 * @license lucide-react v0.510.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ky=[["path",{d:"M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z",key:"1tc9qg"}],["circle",{cx:"12",cy:"13",r:"3",key:"1vg3eu"}]],Jy=$s("camera",Ky);/**
 * @license lucide-react v0.510.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Qy=[["path",{d:"m12 14 4-4",key:"9kzdfg"}],["path",{d:"M3.34 19a10 10 0 1 1 17.32 0",key:"19p75a"}]],jy=$s("gauge",Qy);/**
 * @license lucide-react v0.510.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const $y=[["rect",{x:"14",y:"4",width:"4",height:"16",rx:"1",key:"zuxfzm"}],["rect",{x:"6",y:"4",width:"4",height:"16",rx:"1",key:"1okwgv"}]],tM=$s("pause",$y);/**
 * @license lucide-react v0.510.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const eM=[["polygon",{points:"6 3 20 12 6 21 6 3",key:"1oa8hb"}]],Wv=$s("play",eM);/**
 * @license lucide-react v0.510.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const nM=[["path",{d:"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8",key:"1357e3"}],["path",{d:"M3 3v5h5",key:"1xhq8a"}]],iM=$s("rotate-ccw",nM);/**
 * @license lucide-react v0.510.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const aM=[["path",{d:"M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z",key:"uqj9uw"}],["path",{d:"M16 9a5 5 0 0 1 0 6",key:"1q6k2b"}],["path",{d:"M19.364 18.364a9 9 0 0 0 0-12.728",key:"ijwkga"}]],sM=$s("volume-2",aM);/**
 * @license lucide-react v0.510.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const rM=[["path",{d:"M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z",key:"uqj9uw"}],["line",{x1:"22",x2:"16",y1:"9",y2:"15",key:"1ewh16"}],["line",{x1:"16",x2:"22",y1:"9",y2:"15",key:"5ykzw1"}]],oM=$s("volume-x",rM);/**
 * @license
 * Copyright 2010-2026 Three.js Authors
 * SPDX-License-Identifier: MIT
 */const hp="185",lM=0,R_=1,cM=2,cl=1,uM=2,ol=3,xs=0,ni=1,Na=2,Oa=0,Jr=1,C_=2,D_=3,U_=4,fM=5,Xs=100,hM=101,dM=102,pM=103,mM=104,gM=200,_M=201,vM=202,xM=203,vd=204,xd=205,SM=206,yM=207,MM=208,bM=209,EM=210,TM=211,AM=212,wM=213,RM=214,Sd=0,yd=1,Md=2,$r=3,bd=4,Ed=5,Td=6,Ad=7,qv=0,CM=1,DM=2,ia=0,Yv=1,Zv=2,Kv=3,dp=4,Jv=5,Qv=6,jv=7,$v=300,Qs=301,to=302,Oh=303,Ph=304,xu=306,fu=1e3,La=1001,wd=1002,Vn=1003,UM=1004,Nc=1005,Kn=1006,zh=1007,qs=1008,Ei=1009,tx=1010,ex=1011,vl=1012,pp=1013,sa=1014,Wi=1015,za=1016,mp=1017,gp=1018,xl=1020,nx=35902,ix=35899,ax=1021,sx=1022,qi=1023,Ba=1026,Ys=1027,_p=1028,vp=1029,js=1030,xp=1031,Sp=1033,ru=33776,ou=33777,lu=33778,cu=33779,Rd=35840,Cd=35841,Dd=35842,Ud=35843,Nd=36196,Ld=37492,Od=37496,Pd=37488,zd=37489,hu=37490,Bd=37491,Id=37808,Fd=37809,Hd=37810,Gd=37811,Vd=37812,kd=37813,Xd=37814,Wd=37815,qd=37816,Yd=37817,Zd=37818,Kd=37819,Jd=37820,Qd=37821,jd=36492,$d=36494,tp=36495,ep=36283,np=36284,du=36285,ip=36286,NM=3200,ap=0,LM=1,_s="",ei="srgb",pu="srgb-linear",mu="linear",Je="srgb",Lr=7680,N_=519,OM=512,PM=513,zM=514,yp=515,BM=516,IM=517,Mp=518,FM=519,L_=35044,O_="300 es",ea=2e3,Sl=2001;function HM(r){for(let t=r.length-1;t>=0;--t)if(r[t]>=65535)return!0;return!1}function yl(r){return document.createElementNS("http://www.w3.org/1999/xhtml",r)}function GM(){const r=yl("canvas");return r.style.display="block",r}const P_={};function z_(...r){const t="THREE."+r.shift();console.log(t,...r)}function rx(r){const t=r[0];if(typeof t=="string"&&t.startsWith("TSL:")){const i=r[1];i&&i.isStackTrace?r[0]+=" "+i.getLocation():r[1]='Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.'}return r}function ue(...r){r=rx(r);const t="THREE."+r.shift();{const i=r[0];i&&i.isStackTrace?console.warn(i.getError(t)):console.warn(t,...r)}}function Oe(...r){r=rx(r);const t="THREE."+r.shift();{const i=r[0];i&&i.isStackTrace?console.error(i.getError(t)):console.error(t,...r)}}function Qr(...r){const t=r.join(" ");t in P_||(P_[t]=!0,ue(...r))}function VM(r,t,i){return new Promise(function(s,l){function c(){switch(r.clientWaitSync(t,r.SYNC_FLUSH_COMMANDS_BIT,0)){case r.WAIT_FAILED:l();break;case r.TIMEOUT_EXPIRED:setTimeout(c,i);break;default:s()}}setTimeout(c,i)})}const kM={[Sd]:yd,[Md]:Td,[bd]:Ad,[$r]:Ed,[yd]:Sd,[Td]:Md,[Ad]:bd,[Ed]:$r};class tr{addEventListener(t,i){this._listeners===void 0&&(this._listeners={});const s=this._listeners;s[t]===void 0&&(s[t]=[]),s[t].indexOf(i)===-1&&s[t].push(i)}hasEventListener(t,i){const s=this._listeners;return s===void 0?!1:s[t]!==void 0&&s[t].indexOf(i)!==-1}removeEventListener(t,i){const s=this._listeners;if(s===void 0)return;const l=s[t];if(l!==void 0){const c=l.indexOf(i);c!==-1&&l.splice(c,1)}}dispatchEvent(t){const i=this._listeners;if(i===void 0)return;const s=i[t.type];if(s!==void 0){t.target=this;const l=s.slice(0);for(let c=0,f=l.length;c<f;c++)l[c].call(this,t);t.target=null}}}const qn=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"];let B_=1234567;const ul=Math.PI/180,Ml=180/Math.PI;function io(){const r=Math.random()*4294967295|0,t=Math.random()*4294967295|0,i=Math.random()*4294967295|0,s=Math.random()*4294967295|0;return(qn[r&255]+qn[r>>8&255]+qn[r>>16&255]+qn[r>>24&255]+"-"+qn[t&255]+qn[t>>8&255]+"-"+qn[t>>16&15|64]+qn[t>>24&255]+"-"+qn[i&63|128]+qn[i>>8&255]+"-"+qn[i>>16&255]+qn[i>>24&255]+qn[s&255]+qn[s>>8&255]+qn[s>>16&255]+qn[s>>24&255]).toLowerCase()}function Ee(r,t,i){return Math.max(t,Math.min(i,r))}function bp(r,t){return(r%t+t)%t}function XM(r,t,i,s,l){return s+(r-t)*(l-s)/(i-t)}function WM(r,t,i){return r!==t?(i-r)/(t-r):0}function fl(r,t,i){return(1-i)*r+i*t}function qM(r,t,i,s){return fl(r,t,1-Math.exp(-i*s))}function YM(r,t=1){return t-Math.abs(bp(r,t*2)-t)}function ZM(r,t,i){return r<=t?0:r>=i?1:(r=(r-t)/(i-t),r*r*(3-2*r))}function KM(r,t,i){return r<=t?0:r>=i?1:(r=(r-t)/(i-t),r*r*r*(r*(r*6-15)+10))}function JM(r,t){return r+Math.floor(Math.random()*(t-r+1))}function QM(r,t){return r+Math.random()*(t-r)}function jM(r){return r*(.5-Math.random())}function $M(r){r!==void 0&&(B_=r);let t=B_+=1831565813;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}function t1(r){return r*ul}function e1(r){return r*Ml}function n1(r){return(r&r-1)===0&&r!==0}function i1(r){return Math.pow(2,Math.ceil(Math.log(r)/Math.LN2))}function a1(r){return Math.pow(2,Math.floor(Math.log(r)/Math.LN2))}function s1(r,t,i,s,l){const c=Math.cos,f=Math.sin,d=c(i/2),m=f(i/2),p=c((t+s)/2),_=f((t+s)/2),v=c((t-s)/2),g=f((t-s)/2),x=c((s-t)/2),b=f((s-t)/2);switch(l){case"XYX":r.set(d*_,m*v,m*g,d*p);break;case"YZY":r.set(m*g,d*_,m*v,d*p);break;case"ZXZ":r.set(m*v,m*g,d*_,d*p);break;case"XZX":r.set(d*_,m*b,m*x,d*p);break;case"YXY":r.set(m*x,d*_,m*b,d*p);break;case"ZYZ":r.set(m*b,m*x,d*_,d*p);break;default:ue("MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+l)}}function Kr(r,t){switch(t.constructor){case Float32Array:return r;case Uint32Array:return r/4294967295;case Uint16Array:return r/65535;case Uint8Array:return r/255;case Int32Array:return Math.max(r/2147483647,-1);case Int16Array:return Math.max(r/32767,-1);case Int8Array:return Math.max(r/127,-1);default:throw new Error("THREE.MathUtils: Invalid component type.")}}function $n(r,t){switch(t.constructor){case Float32Array:return r;case Uint32Array:return Math.round(r*4294967295);case Uint16Array:return Math.round(r*65535);case Uint8Array:return Math.round(r*255);case Int32Array:return Math.round(r*2147483647);case Int16Array:return Math.round(r*32767);case Int8Array:return Math.round(r*127);default:throw new Error("THREE.MathUtils: Invalid component type.")}}const Zs={DEG2RAD:ul,RAD2DEG:Ml,generateUUID:io,clamp:Ee,euclideanModulo:bp,mapLinear:XM,inverseLerp:WM,lerp:fl,damp:qM,pingpong:YM,smoothstep:ZM,smootherstep:KM,randInt:JM,randFloat:QM,randFloatSpread:jM,seededRandom:$M,degToRad:t1,radToDeg:e1,isPowerOfTwo:n1,ceilPowerOfTwo:i1,floorPowerOfTwo:a1,setQuaternionFromProperEuler:s1,normalize:$n,denormalize:Kr},Op=class Op{constructor(t=0,i=0){this.x=t,this.y=i}get width(){return this.x}set width(t){this.x=t}get height(){return this.y}set height(t){this.y=t}set(t,i){return this.x=t,this.y=i,this}setScalar(t){return this.x=t,this.y=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setComponent(t,i){switch(t){case 0:this.x=i;break;case 1:this.y=i;break;default:throw new Error("THREE.Vector2: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;default:throw new Error("THREE.Vector2: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y)}copy(t){return this.x=t.x,this.y=t.y,this}add(t){return this.x+=t.x,this.y+=t.y,this}addScalar(t){return this.x+=t,this.y+=t,this}addVectors(t,i){return this.x=t.x+i.x,this.y=t.y+i.y,this}addScaledVector(t,i){return this.x+=t.x*i,this.y+=t.y*i,this}sub(t){return this.x-=t.x,this.y-=t.y,this}subScalar(t){return this.x-=t,this.y-=t,this}subVectors(t,i){return this.x=t.x-i.x,this.y=t.y-i.y,this}multiply(t){return this.x*=t.x,this.y*=t.y,this}multiplyScalar(t){return this.x*=t,this.y*=t,this}divide(t){return this.x/=t.x,this.y/=t.y,this}divideScalar(t){return this.multiplyScalar(1/t)}applyMatrix3(t){const i=this.x,s=this.y,l=t.elements;return this.x=l[0]*i+l[3]*s+l[6],this.y=l[1]*i+l[4]*s+l[7],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this}clamp(t,i){return this.x=Ee(this.x,t.x,i.x),this.y=Ee(this.y,t.y,i.y),this}clampScalar(t,i){return this.x=Ee(this.x,t,i),this.y=Ee(this.y,t,i),this}clampLength(t,i){const s=this.length();return this.divideScalar(s||1).multiplyScalar(Ee(s,t,i))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(t){return this.x*t.x+this.y*t.y}cross(t){return this.x*t.y-this.y*t.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(t){const i=Math.sqrt(this.lengthSq()*t.lengthSq());if(i===0)return Math.PI/2;const s=this.dot(t)/i;return Math.acos(Ee(s,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){const i=this.x-t.x,s=this.y-t.y;return i*i+s*s}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,i){return this.x+=(t.x-this.x)*i,this.y+=(t.y-this.y)*i,this}lerpVectors(t,i,s){return this.x=t.x+(i.x-t.x)*s,this.y=t.y+(i.y-t.y)*s,this}equals(t){return t.x===this.x&&t.y===this.y}fromArray(t,i=0){return this.x=t[i],this.y=t[i+1],this}toArray(t=[],i=0){return t[i]=this.x,t[i+1]=this.y,t}fromBufferAttribute(t,i){return this.x=t.getX(i),this.y=t.getY(i),this}rotateAround(t,i){const s=Math.cos(i),l=Math.sin(i),c=this.x-t.x,f=this.y-t.y;return this.x=c*s-f*l+t.x,this.y=c*l+f*s+t.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}};Op.prototype.isVector2=!0;let ae=Op;class ao{constructor(t=0,i=0,s=0,l=1){this.isQuaternion=!0,this._x=t,this._y=i,this._z=s,this._w=l}static slerpFlat(t,i,s,l,c,f,d){let m=s[l+0],p=s[l+1],_=s[l+2],v=s[l+3],g=c[f+0],x=c[f+1],b=c[f+2],A=c[f+3];if(v!==A||m!==g||p!==x||_!==b){let M=m*g+p*x+_*b+v*A;M<0&&(g=-g,x=-x,b=-b,A=-A,M=-M);let S=1-d;if(M<.9995){const O=Math.acos(M),U=Math.sin(O);S=Math.sin(S*O)/U,d=Math.sin(d*O)/U,m=m*S+g*d,p=p*S+x*d,_=_*S+b*d,v=v*S+A*d}else{m=m*S+g*d,p=p*S+x*d,_=_*S+b*d,v=v*S+A*d;const O=1/Math.sqrt(m*m+p*p+_*_+v*v);m*=O,p*=O,_*=O,v*=O}}t[i]=m,t[i+1]=p,t[i+2]=_,t[i+3]=v}static multiplyQuaternionsFlat(t,i,s,l,c,f){const d=s[l],m=s[l+1],p=s[l+2],_=s[l+3],v=c[f],g=c[f+1],x=c[f+2],b=c[f+3];return t[i]=d*b+_*v+m*x-p*g,t[i+1]=m*b+_*g+p*v-d*x,t[i+2]=p*b+_*x+d*g-m*v,t[i+3]=_*b-d*v-m*g-p*x,t}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get w(){return this._w}set w(t){this._w=t,this._onChangeCallback()}set(t,i,s,l){return this._x=t,this._y=i,this._z=s,this._w=l,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(t){return this._x=t.x,this._y=t.y,this._z=t.z,this._w=t.w,this._onChangeCallback(),this}setFromEuler(t,i=!0){const s=t._x,l=t._y,c=t._z,f=t._order,d=Math.cos,m=Math.sin,p=d(s/2),_=d(l/2),v=d(c/2),g=m(s/2),x=m(l/2),b=m(c/2);switch(f){case"XYZ":this._x=g*_*v+p*x*b,this._y=p*x*v-g*_*b,this._z=p*_*b+g*x*v,this._w=p*_*v-g*x*b;break;case"YXZ":this._x=g*_*v+p*x*b,this._y=p*x*v-g*_*b,this._z=p*_*b-g*x*v,this._w=p*_*v+g*x*b;break;case"ZXY":this._x=g*_*v-p*x*b,this._y=p*x*v+g*_*b,this._z=p*_*b+g*x*v,this._w=p*_*v-g*x*b;break;case"ZYX":this._x=g*_*v-p*x*b,this._y=p*x*v+g*_*b,this._z=p*_*b-g*x*v,this._w=p*_*v+g*x*b;break;case"YZX":this._x=g*_*v+p*x*b,this._y=p*x*v+g*_*b,this._z=p*_*b-g*x*v,this._w=p*_*v-g*x*b;break;case"XZY":this._x=g*_*v-p*x*b,this._y=p*x*v-g*_*b,this._z=p*_*b+g*x*v,this._w=p*_*v+g*x*b;break;default:ue("Quaternion: .setFromEuler() encountered an unknown order: "+f)}return i===!0&&this._onChangeCallback(),this}setFromAxisAngle(t,i){const s=i/2,l=Math.sin(s);return this._x=t.x*l,this._y=t.y*l,this._z=t.z*l,this._w=Math.cos(s),this._onChangeCallback(),this}setFromRotationMatrix(t){const i=t.elements,s=i[0],l=i[4],c=i[8],f=i[1],d=i[5],m=i[9],p=i[2],_=i[6],v=i[10],g=s+d+v;if(g>0){const x=.5/Math.sqrt(g+1);this._w=.25/x,this._x=(_-m)*x,this._y=(c-p)*x,this._z=(f-l)*x}else if(s>d&&s>v){const x=2*Math.sqrt(1+s-d-v);this._w=(_-m)/x,this._x=.25*x,this._y=(l+f)/x,this._z=(c+p)/x}else if(d>v){const x=2*Math.sqrt(1+d-s-v);this._w=(c-p)/x,this._x=(l+f)/x,this._y=.25*x,this._z=(m+_)/x}else{const x=2*Math.sqrt(1+v-s-d);this._w=(f-l)/x,this._x=(c+p)/x,this._y=(m+_)/x,this._z=.25*x}return this._onChangeCallback(),this}setFromUnitVectors(t,i){let s=t.dot(i)+1;return s<1e-8?(s=0,Math.abs(t.x)>Math.abs(t.z)?(this._x=-t.y,this._y=t.x,this._z=0,this._w=s):(this._x=0,this._y=-t.z,this._z=t.y,this._w=s)):(this._x=t.y*i.z-t.z*i.y,this._y=t.z*i.x-t.x*i.z,this._z=t.x*i.y-t.y*i.x,this._w=s),this.normalize()}angleTo(t){return 2*Math.acos(Math.abs(Ee(this.dot(t),-1,1)))}rotateTowards(t,i){const s=this.angleTo(t);if(s===0)return this;const l=Math.min(1,i/s);return this.slerp(t,l),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(t){return this._x*t._x+this._y*t._y+this._z*t._z+this._w*t._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let t=this.length();return t===0?(this._x=0,this._y=0,this._z=0,this._w=1):(t=1/t,this._x=this._x*t,this._y=this._y*t,this._z=this._z*t,this._w=this._w*t),this._onChangeCallback(),this}multiply(t){return this.multiplyQuaternions(this,t)}premultiply(t){return this.multiplyQuaternions(t,this)}multiplyQuaternions(t,i){const s=t._x,l=t._y,c=t._z,f=t._w,d=i._x,m=i._y,p=i._z,_=i._w;return this._x=s*_+f*d+l*p-c*m,this._y=l*_+f*m+c*d-s*p,this._z=c*_+f*p+s*m-l*d,this._w=f*_-s*d-l*m-c*p,this._onChangeCallback(),this}slerp(t,i){let s=t._x,l=t._y,c=t._z,f=t._w,d=this.dot(t);d<0&&(s=-s,l=-l,c=-c,f=-f,d=-d);let m=1-i;if(d<.9995){const p=Math.acos(d),_=Math.sin(p);m=Math.sin(m*p)/_,i=Math.sin(i*p)/_,this._x=this._x*m+s*i,this._y=this._y*m+l*i,this._z=this._z*m+c*i,this._w=this._w*m+f*i,this._onChangeCallback()}else this._x=this._x*m+s*i,this._y=this._y*m+l*i,this._z=this._z*m+c*i,this._w=this._w*m+f*i,this.normalize();return this}slerpQuaternions(t,i,s){return this.copy(t).slerp(i,s)}random(){const t=2*Math.PI*Math.random(),i=2*Math.PI*Math.random(),s=Math.random(),l=Math.sqrt(1-s),c=Math.sqrt(s);return this.set(l*Math.sin(t),l*Math.cos(t),c*Math.sin(i),c*Math.cos(i))}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._w===this._w}fromArray(t,i=0){return this._x=t[i],this._y=t[i+1],this._z=t[i+2],this._w=t[i+3],this._onChangeCallback(),this}toArray(t=[],i=0){return t[i]=this._x,t[i+1]=this._y,t[i+2]=this._z,t[i+3]=this._w,t}fromBufferAttribute(t,i){return this._x=t.getX(i),this._y=t.getY(i),this._z=t.getZ(i),this._w=t.getW(i),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}}const Pp=class Pp{constructor(t=0,i=0,s=0){this.x=t,this.y=i,this.z=s}set(t,i,s){return s===void 0&&(s=this.z),this.x=t,this.y=i,this.z=s,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setComponent(t,i){switch(t){case 0:this.x=i;break;case 1:this.y=i;break;case 2:this.z=i;break;default:throw new Error("THREE.Vector3: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("THREE.Vector3: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this}addVectors(t,i){return this.x=t.x+i.x,this.y=t.y+i.y,this.z=t.z+i.z,this}addScaledVector(t,i){return this.x+=t.x*i,this.y+=t.y*i,this.z+=t.z*i,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this}subVectors(t,i){return this.x=t.x-i.x,this.y=t.y-i.y,this.z=t.z-i.z,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this}multiplyVectors(t,i){return this.x=t.x*i.x,this.y=t.y*i.y,this.z=t.z*i.z,this}applyEuler(t){return this.applyQuaternion(I_.setFromEuler(t))}applyAxisAngle(t,i){return this.applyQuaternion(I_.setFromAxisAngle(t,i))}applyMatrix3(t){const i=this.x,s=this.y,l=this.z,c=t.elements;return this.x=c[0]*i+c[3]*s+c[6]*l,this.y=c[1]*i+c[4]*s+c[7]*l,this.z=c[2]*i+c[5]*s+c[8]*l,this}applyNormalMatrix(t){return this.applyMatrix3(t).normalize()}applyMatrix4(t){const i=this.x,s=this.y,l=this.z,c=t.elements,f=1/(c[3]*i+c[7]*s+c[11]*l+c[15]);return this.x=(c[0]*i+c[4]*s+c[8]*l+c[12])*f,this.y=(c[1]*i+c[5]*s+c[9]*l+c[13])*f,this.z=(c[2]*i+c[6]*s+c[10]*l+c[14])*f,this}applyQuaternion(t){const i=this.x,s=this.y,l=this.z,c=t.x,f=t.y,d=t.z,m=t.w,p=2*(f*l-d*s),_=2*(d*i-c*l),v=2*(c*s-f*i);return this.x=i+m*p+f*v-d*_,this.y=s+m*_+d*p-c*v,this.z=l+m*v+c*_-f*p,this}project(t){return this.applyMatrix4(t.matrixWorldInverse).applyMatrix4(t.projectionMatrix)}unproject(t){return this.applyMatrix4(t.projectionMatrixInverse).applyMatrix4(t.matrixWorld)}transformDirection(t){const i=this.x,s=this.y,l=this.z,c=t.elements;return this.x=c[0]*i+c[4]*s+c[8]*l,this.y=c[1]*i+c[5]*s+c[9]*l,this.z=c[2]*i+c[6]*s+c[10]*l,this.normalize()}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this}divideScalar(t){return this.multiplyScalar(1/t)}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this}clamp(t,i){return this.x=Ee(this.x,t.x,i.x),this.y=Ee(this.y,t.y,i.y),this.z=Ee(this.z,t.z,i.z),this}clampScalar(t,i){return this.x=Ee(this.x,t,i),this.y=Ee(this.y,t,i),this.z=Ee(this.z,t,i),this}clampLength(t,i){const s=this.length();return this.divideScalar(s||1).multiplyScalar(Ee(s,t,i))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,i){return this.x+=(t.x-this.x)*i,this.y+=(t.y-this.y)*i,this.z+=(t.z-this.z)*i,this}lerpVectors(t,i,s){return this.x=t.x+(i.x-t.x)*s,this.y=t.y+(i.y-t.y)*s,this.z=t.z+(i.z-t.z)*s,this}cross(t){return this.crossVectors(this,t)}crossVectors(t,i){const s=t.x,l=t.y,c=t.z,f=i.x,d=i.y,m=i.z;return this.x=l*m-c*d,this.y=c*f-s*m,this.z=s*d-l*f,this}projectOnVector(t){const i=t.lengthSq();if(i===0)return this.set(0,0,0);const s=t.dot(this)/i;return this.copy(t).multiplyScalar(s)}projectOnPlane(t){return Bh.copy(this).projectOnVector(t),this.sub(Bh)}reflect(t){return this.sub(Bh.copy(t).multiplyScalar(2*this.dot(t)))}angleTo(t){const i=Math.sqrt(this.lengthSq()*t.lengthSq());if(i===0)return Math.PI/2;const s=this.dot(t)/i;return Math.acos(Ee(s,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){const i=this.x-t.x,s=this.y-t.y,l=this.z-t.z;return i*i+s*s+l*l}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)+Math.abs(this.z-t.z)}setFromSpherical(t){return this.setFromSphericalCoords(t.radius,t.phi,t.theta)}setFromSphericalCoords(t,i,s){const l=Math.sin(i)*t;return this.x=l*Math.sin(s),this.y=Math.cos(i)*t,this.z=l*Math.cos(s),this}setFromCylindrical(t){return this.setFromCylindricalCoords(t.radius,t.theta,t.y)}setFromCylindricalCoords(t,i,s){return this.x=t*Math.sin(i),this.y=s,this.z=t*Math.cos(i),this}setFromMatrixPosition(t){const i=t.elements;return this.x=i[12],this.y=i[13],this.z=i[14],this}setFromMatrixScale(t){const i=this.setFromMatrixColumn(t,0).length(),s=this.setFromMatrixColumn(t,1).length(),l=this.setFromMatrixColumn(t,2).length();return this.x=i,this.y=s,this.z=l,this}setFromMatrixColumn(t,i){return this.fromArray(t.elements,i*4)}setFromMatrix3Column(t,i){return this.fromArray(t.elements,i*3)}setFromEuler(t){return this.x=t._x,this.y=t._y,this.z=t._z,this}setFromColor(t){return this.x=t.r,this.y=t.g,this.z=t.b,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z}fromArray(t,i=0){return this.x=t[i],this.y=t[i+1],this.z=t[i+2],this}toArray(t=[],i=0){return t[i]=this.x,t[i+1]=this.y,t[i+2]=this.z,t}fromBufferAttribute(t,i){return this.x=t.getX(i),this.y=t.getY(i),this.z=t.getZ(i),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){const t=Math.random()*Math.PI*2,i=Math.random()*2-1,s=Math.sqrt(1-i*i);return this.x=s*Math.cos(t),this.y=i,this.z=s*Math.sin(t),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}};Pp.prototype.isVector3=!0;let V=Pp;const Bh=new V,I_=new ao,zp=class zp{constructor(t,i,s,l,c,f,d,m,p){this.elements=[1,0,0,0,1,0,0,0,1],t!==void 0&&this.set(t,i,s,l,c,f,d,m,p)}set(t,i,s,l,c,f,d,m,p){const _=this.elements;return _[0]=t,_[1]=l,_[2]=d,_[3]=i,_[4]=c,_[5]=m,_[6]=s,_[7]=f,_[8]=p,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(t){const i=this.elements,s=t.elements;return i[0]=s[0],i[1]=s[1],i[2]=s[2],i[3]=s[3],i[4]=s[4],i[5]=s[5],i[6]=s[6],i[7]=s[7],i[8]=s[8],this}extractBasis(t,i,s){return t.setFromMatrix3Column(this,0),i.setFromMatrix3Column(this,1),s.setFromMatrix3Column(this,2),this}setFromMatrix4(t){const i=t.elements;return this.set(i[0],i[4],i[8],i[1],i[5],i[9],i[2],i[6],i[10]),this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,i){const s=t.elements,l=i.elements,c=this.elements,f=s[0],d=s[3],m=s[6],p=s[1],_=s[4],v=s[7],g=s[2],x=s[5],b=s[8],A=l[0],M=l[3],S=l[6],O=l[1],U=l[4],w=l[7],z=l[2],N=l[5],L=l[8];return c[0]=f*A+d*O+m*z,c[3]=f*M+d*U+m*N,c[6]=f*S+d*w+m*L,c[1]=p*A+_*O+v*z,c[4]=p*M+_*U+v*N,c[7]=p*S+_*w+v*L,c[2]=g*A+x*O+b*z,c[5]=g*M+x*U+b*N,c[8]=g*S+x*w+b*L,this}multiplyScalar(t){const i=this.elements;return i[0]*=t,i[3]*=t,i[6]*=t,i[1]*=t,i[4]*=t,i[7]*=t,i[2]*=t,i[5]*=t,i[8]*=t,this}determinant(){const t=this.elements,i=t[0],s=t[1],l=t[2],c=t[3],f=t[4],d=t[5],m=t[6],p=t[7],_=t[8];return i*f*_-i*d*p-s*c*_+s*d*m+l*c*p-l*f*m}invert(){const t=this.elements,i=t[0],s=t[1],l=t[2],c=t[3],f=t[4],d=t[5],m=t[6],p=t[7],_=t[8],v=_*f-d*p,g=d*m-_*c,x=p*c-f*m,b=i*v+s*g+l*x;if(b===0)return this.set(0,0,0,0,0,0,0,0,0);const A=1/b;return t[0]=v*A,t[1]=(l*p-_*s)*A,t[2]=(d*s-l*f)*A,t[3]=g*A,t[4]=(_*i-l*m)*A,t[5]=(l*c-d*i)*A,t[6]=x*A,t[7]=(s*m-p*i)*A,t[8]=(f*i-s*c)*A,this}transpose(){let t;const i=this.elements;return t=i[1],i[1]=i[3],i[3]=t,t=i[2],i[2]=i[6],i[6]=t,t=i[5],i[5]=i[7],i[7]=t,this}getNormalMatrix(t){return this.setFromMatrix4(t).invert().transpose()}transposeIntoArray(t){const i=this.elements;return t[0]=i[0],t[1]=i[3],t[2]=i[6],t[3]=i[1],t[4]=i[4],t[5]=i[7],t[6]=i[2],t[7]=i[5],t[8]=i[8],this}setUvTransform(t,i,s,l,c,f,d){const m=Math.cos(c),p=Math.sin(c);return this.set(s*m,s*p,-s*(m*f+p*d)+f+t,-l*p,l*m,-l*(-p*f+m*d)+d+i,0,0,1),this}scale(t,i){return Qr("Matrix3: .scale() is deprecated. Use .makeScale() instead."),this.premultiply(Ih.makeScale(t,i)),this}rotate(t){return Qr("Matrix3: .rotate() is deprecated. Use .makeRotation() instead."),this.premultiply(Ih.makeRotation(-t)),this}translate(t,i){return Qr("Matrix3: .translate() is deprecated. Use .makeTranslation() instead."),this.premultiply(Ih.makeTranslation(t,i)),this}makeTranslation(t,i){return t.isVector2?this.set(1,0,t.x,0,1,t.y,0,0,1):this.set(1,0,t,0,1,i,0,0,1),this}makeRotation(t){const i=Math.cos(t),s=Math.sin(t);return this.set(i,-s,0,s,i,0,0,0,1),this}makeScale(t,i){return this.set(t,0,0,0,i,0,0,0,1),this}equals(t){const i=this.elements,s=t.elements;for(let l=0;l<9;l++)if(i[l]!==s[l])return!1;return!0}fromArray(t,i=0){for(let s=0;s<9;s++)this.elements[s]=t[s+i];return this}toArray(t=[],i=0){const s=this.elements;return t[i]=s[0],t[i+1]=s[1],t[i+2]=s[2],t[i+3]=s[3],t[i+4]=s[4],t[i+5]=s[5],t[i+6]=s[6],t[i+7]=s[7],t[i+8]=s[8],t}clone(){return new this.constructor().fromArray(this.elements)}};zp.prototype.isMatrix3=!0;let me=zp;const Ih=new me,F_=new me().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),H_=new me().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function r1(){const r={enabled:!0,workingColorSpace:pu,spaces:{},convert:function(l,c,f){return this.enabled===!1||c===f||!c||!f||(this.spaces[c].transfer===Je&&(l.r=Pa(l.r),l.g=Pa(l.g),l.b=Pa(l.b)),this.spaces[c].primaries!==this.spaces[f].primaries&&(l.applyMatrix3(this.spaces[c].toXYZ),l.applyMatrix3(this.spaces[f].fromXYZ)),this.spaces[f].transfer===Je&&(l.r=jr(l.r),l.g=jr(l.g),l.b=jr(l.b))),l},workingToColorSpace:function(l,c){return this.convert(l,this.workingColorSpace,c)},colorSpaceToWorking:function(l,c){return this.convert(l,c,this.workingColorSpace)},getPrimaries:function(l){return this.spaces[l].primaries},getTransfer:function(l){return l===_s?mu:this.spaces[l].transfer},getToneMappingMode:function(l){return this.spaces[l].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(l,c=this.workingColorSpace){return l.fromArray(this.spaces[c].luminanceCoefficients)},define:function(l){Object.assign(this.spaces,l)},_getMatrix:function(l,c,f){return l.copy(this.spaces[c].toXYZ).multiply(this.spaces[f].fromXYZ)},_getDrawingBufferColorSpace:function(l){return this.spaces[l].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(l=this.workingColorSpace){return this.spaces[l].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(l,c){return Qr("ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),r.workingToColorSpace(l,c)},toWorkingColorSpace:function(l,c){return Qr("ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),r.colorSpaceToWorking(l,c)}},t=[.64,.33,.3,.6,.15,.06],i=[.2126,.7152,.0722],s=[.3127,.329];return r.define({[pu]:{primaries:t,whitePoint:s,transfer:mu,toXYZ:F_,fromXYZ:H_,luminanceCoefficients:i,workingColorSpaceConfig:{unpackColorSpace:ei},outputColorSpaceConfig:{drawingBufferColorSpace:ei}},[ei]:{primaries:t,whitePoint:s,transfer:Je,toXYZ:F_,fromXYZ:H_,luminanceCoefficients:i,outputColorSpaceConfig:{drawingBufferColorSpace:ei}}}),r}const Ne=r1();function Pa(r){return r<.04045?r*.0773993808:Math.pow(r*.9478672986+.0521327014,2.4)}function jr(r){return r<.0031308?r*12.92:1.055*Math.pow(r,.41666)-.055}let Or;class o1{static getDataURL(t,i="image/png"){if(/^data:/i.test(t.src)||typeof HTMLCanvasElement>"u")return t.src;let s;if(t instanceof HTMLCanvasElement)s=t;else{Or===void 0&&(Or=yl("canvas")),Or.width=t.width,Or.height=t.height;const l=Or.getContext("2d");t instanceof ImageData?l.putImageData(t,0,0):l.drawImage(t,0,0,t.width,t.height),s=Or}return s.toDataURL(i)}static sRGBToLinear(t){if(typeof HTMLImageElement<"u"&&t instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&t instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&t instanceof ImageBitmap){const i=yl("canvas");i.width=t.width,i.height=t.height;const s=i.getContext("2d");s.drawImage(t,0,0,t.width,t.height);const l=s.getImageData(0,0,t.width,t.height),c=l.data;for(let f=0;f<c.length;f++)c[f]=Pa(c[f]/255)*255;return s.putImageData(l,0,0),i}else if(t.data){const i=t.data.slice(0);for(let s=0;s<i.length;s++)i instanceof Uint8Array||i instanceof Uint8ClampedArray?i[s]=Math.floor(Pa(i[s]/255)*255):i[s]=Pa(i[s]);return{data:i,width:t.width,height:t.height}}else return ue("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),t}}let l1=0;class Ep{constructor(t=null){this.isSource=!0,Object.defineProperty(this,"id",{value:l1++}),this.uuid=io(),this.data=t,this.dataReady=!0,this.version=0}getSize(t){const i=this.data;return typeof HTMLVideoElement<"u"&&i instanceof HTMLVideoElement?t.set(i.videoWidth,i.videoHeight,0):typeof VideoFrame<"u"&&i instanceof VideoFrame?t.set(i.displayWidth,i.displayHeight,0):i!==null?t.set(i.width,i.height,i.depth||0):t.set(0,0,0),t}set needsUpdate(t){t===!0&&this.version++}toJSON(t){const i=t===void 0||typeof t=="string";if(!i&&t.images[this.uuid]!==void 0)return t.images[this.uuid];const s={uuid:this.uuid,url:""},l=this.data;if(l!==null){let c;if(Array.isArray(l)){c=[];for(let f=0,d=l.length;f<d;f++)l[f].isDataTexture?c.push(Fh(l[f].image)):c.push(Fh(l[f]))}else c=Fh(l);s.url=c}return i||(t.images[this.uuid]=s),s}}function Fh(r){return typeof HTMLImageElement<"u"&&r instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&r instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&r instanceof ImageBitmap?o1.getDataURL(r):r.data?{data:Array.from(r.data),width:r.width,height:r.height,type:r.data.constructor.name}:(ue("Texture: Unable to serialize Texture."),{})}let c1=0;const Hh=new V;class kn extends tr{constructor(t=kn.DEFAULT_IMAGE,i=kn.DEFAULT_MAPPING,s=La,l=La,c=Kn,f=qs,d=qi,m=Ei,p=kn.DEFAULT_ANISOTROPY,_=_s){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:c1++}),this.uuid=io(),this.name="",this.source=new Ep(t),this.mipmaps=[],this.mapping=i,this.channel=0,this.wrapS=s,this.wrapT=l,this.magFilter=c,this.minFilter=f,this.anisotropy=p,this.format=d,this.internalFormat=null,this.type=m,this.offset=new ae(0,0),this.repeat=new ae(1,1),this.center=new ae(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new me,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=_,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(t&&t.depth&&t.depth>1),this.pmremVersion=0,this.normalized=!1}get width(){return this.source.getSize(Hh).x}get height(){return this.source.getSize(Hh).y}get depth(){return this.source.getSize(Hh).z}get image(){return this.source.data}set image(t){this.source.data=t}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(t,i){this.updateRanges.push({start:t,count:i})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(t){return this.name=t.name,this.source=t.source,this.mipmaps=t.mipmaps.slice(0),this.mapping=t.mapping,this.channel=t.channel,this.wrapS=t.wrapS,this.wrapT=t.wrapT,this.magFilter=t.magFilter,this.minFilter=t.minFilter,this.anisotropy=t.anisotropy,this.format=t.format,this.internalFormat=t.internalFormat,this.type=t.type,this.normalized=t.normalized,this.offset.copy(t.offset),this.repeat.copy(t.repeat),this.center.copy(t.center),this.rotation=t.rotation,this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrix.copy(t.matrix),this.generateMipmaps=t.generateMipmaps,this.premultiplyAlpha=t.premultiplyAlpha,this.flipY=t.flipY,this.unpackAlignment=t.unpackAlignment,this.colorSpace=t.colorSpace,this.renderTarget=t.renderTarget,this.isRenderTargetTexture=t.isRenderTargetTexture,this.isArrayTexture=t.isArrayTexture,this.userData=JSON.parse(JSON.stringify(t.userData)),this.needsUpdate=!0,this}setValues(t){for(const i in t){const s=t[i];if(s===void 0){ue(`Texture.setValues(): parameter '${i}' has value of undefined.`);continue}const l=this[i];if(l===void 0){ue(`Texture.setValues(): property '${i}' does not exist.`);continue}l&&s&&l.isVector2&&s.isVector2||l&&s&&l.isVector3&&s.isVector3||l&&s&&l.isMatrix3&&s.isMatrix3?l.copy(s):this[i]=s}}toJSON(t){const i=t===void 0||typeof t=="string";if(!i&&t.textures[this.uuid]!==void 0)return t.textures[this.uuid];const s={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(t).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(s.userData=this.userData),i||(t.textures[this.uuid]=s),s}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(t){if(this.mapping!==$v)return t;if(t.applyMatrix3(this.matrix),t.x<0||t.x>1)switch(this.wrapS){case fu:t.x=t.x-Math.floor(t.x);break;case La:t.x=t.x<0?0:1;break;case wd:Math.abs(Math.floor(t.x)%2)===1?t.x=Math.ceil(t.x)-t.x:t.x=t.x-Math.floor(t.x);break}if(t.y<0||t.y>1)switch(this.wrapT){case fu:t.y=t.y-Math.floor(t.y);break;case La:t.y=t.y<0?0:1;break;case wd:Math.abs(Math.floor(t.y)%2)===1?t.y=Math.ceil(t.y)-t.y:t.y=t.y-Math.floor(t.y);break}return this.flipY&&(t.y=1-t.y),t}set needsUpdate(t){t===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(t){t===!0&&this.pmremVersion++}}kn.DEFAULT_IMAGE=null;kn.DEFAULT_MAPPING=$v;kn.DEFAULT_ANISOTROPY=1;const Bp=class Bp{constructor(t=0,i=0,s=0,l=1){this.x=t,this.y=i,this.z=s,this.w=l}get width(){return this.z}set width(t){this.z=t}get height(){return this.w}set height(t){this.w=t}set(t,i,s,l){return this.x=t,this.y=i,this.z=s,this.w=l,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this.w=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setW(t){return this.w=t,this}setComponent(t,i){switch(t){case 0:this.x=i;break;case 1:this.y=i;break;case 2:this.z=i;break;case 3:this.w=i;break;default:throw new Error("THREE.Vector4: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("THREE.Vector4: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this.w=t.w!==void 0?t.w:1,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this.w+=t.w,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this.w+=t,this}addVectors(t,i){return this.x=t.x+i.x,this.y=t.y+i.y,this.z=t.z+i.z,this.w=t.w+i.w,this}addScaledVector(t,i){return this.x+=t.x*i,this.y+=t.y*i,this.z+=t.z*i,this.w+=t.w*i,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this.w-=t.w,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this.w-=t,this}subVectors(t,i){return this.x=t.x-i.x,this.y=t.y-i.y,this.z=t.z-i.z,this.w=t.w-i.w,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this.w*=t.w,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this.w*=t,this}applyMatrix4(t){const i=this.x,s=this.y,l=this.z,c=this.w,f=t.elements;return this.x=f[0]*i+f[4]*s+f[8]*l+f[12]*c,this.y=f[1]*i+f[5]*s+f[9]*l+f[13]*c,this.z=f[2]*i+f[6]*s+f[10]*l+f[14]*c,this.w=f[3]*i+f[7]*s+f[11]*l+f[15]*c,this}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this.w/=t.w,this}divideScalar(t){return this.multiplyScalar(1/t)}setAxisAngleFromQuaternion(t){this.w=2*Math.acos(t.w);const i=Math.sqrt(1-t.w*t.w);return i<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=t.x/i,this.y=t.y/i,this.z=t.z/i),this}setAxisAngleFromRotationMatrix(t){let i,s,l,c;const m=t.elements,p=m[0],_=m[4],v=m[8],g=m[1],x=m[5],b=m[9],A=m[2],M=m[6],S=m[10];if(Math.abs(_-g)<.01&&Math.abs(v-A)<.01&&Math.abs(b-M)<.01){if(Math.abs(_+g)<.1&&Math.abs(v+A)<.1&&Math.abs(b+M)<.1&&Math.abs(p+x+S-3)<.1)return this.set(1,0,0,0),this;i=Math.PI;const U=(p+1)/2,w=(x+1)/2,z=(S+1)/2,N=(_+g)/4,L=(v+A)/4,E=(b+M)/4;return U>w&&U>z?U<.01?(s=0,l=.707106781,c=.707106781):(s=Math.sqrt(U),l=N/s,c=L/s):w>z?w<.01?(s=.707106781,l=0,c=.707106781):(l=Math.sqrt(w),s=N/l,c=E/l):z<.01?(s=.707106781,l=.707106781,c=0):(c=Math.sqrt(z),s=L/c,l=E/c),this.set(s,l,c,i),this}let O=Math.sqrt((M-b)*(M-b)+(v-A)*(v-A)+(g-_)*(g-_));return Math.abs(O)<.001&&(O=1),this.x=(M-b)/O,this.y=(v-A)/O,this.z=(g-_)/O,this.w=Math.acos((p+x+S-1)/2),this}setFromMatrixPosition(t){const i=t.elements;return this.x=i[12],this.y=i[13],this.z=i[14],this.w=i[15],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this.w=Math.min(this.w,t.w),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this.w=Math.max(this.w,t.w),this}clamp(t,i){return this.x=Ee(this.x,t.x,i.x),this.y=Ee(this.y,t.y,i.y),this.z=Ee(this.z,t.z,i.z),this.w=Ee(this.w,t.w,i.w),this}clampScalar(t,i){return this.x=Ee(this.x,t,i),this.y=Ee(this.y,t,i),this.z=Ee(this.z,t,i),this.w=Ee(this.w,t,i),this}clampLength(t,i){const s=this.length();return this.divideScalar(s||1).multiplyScalar(Ee(s,t,i))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z+this.w*t.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,i){return this.x+=(t.x-this.x)*i,this.y+=(t.y-this.y)*i,this.z+=(t.z-this.z)*i,this.w+=(t.w-this.w)*i,this}lerpVectors(t,i,s){return this.x=t.x+(i.x-t.x)*s,this.y=t.y+(i.y-t.y)*s,this.z=t.z+(i.z-t.z)*s,this.w=t.w+(i.w-t.w)*s,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z&&t.w===this.w}fromArray(t,i=0){return this.x=t[i],this.y=t[i+1],this.z=t[i+2],this.w=t[i+3],this}toArray(t=[],i=0){return t[i]=this.x,t[i+1]=this.y,t[i+2]=this.z,t[i+3]=this.w,t}fromBufferAttribute(t,i){return this.x=t.getX(i),this.y=t.getY(i),this.z=t.getZ(i),this.w=t.getW(i),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}};Bp.prototype.isVector4=!0;let gn=Bp;class u1 extends tr{constructor(t=1,i=1,s={}){super(),s=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:Kn,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1,useArrayDepthTexture:!1},s),this.isRenderTarget=!0,this.width=t,this.height=i,this.depth=s.depth,this.scissor=new gn(0,0,t,i),this.scissorTest=!1,this.viewport=new gn(0,0,t,i),this.textures=[];const l={width:t,height:i,depth:s.depth},c=new kn(l),f=s.count;for(let d=0;d<f;d++)this.textures[d]=c.clone(),this.textures[d].isRenderTargetTexture=!0,this.textures[d].renderTarget=this;this._setTextureOptions(s),this.depthBuffer=s.depthBuffer,this.stencilBuffer=s.stencilBuffer,this.resolveDepthBuffer=s.resolveDepthBuffer,this.resolveStencilBuffer=s.resolveStencilBuffer,this._depthTexture=null,this.depthTexture=s.depthTexture,this.samples=s.samples,this.multiview=s.multiview,this.useArrayDepthTexture=s.useArrayDepthTexture}_setTextureOptions(t={}){const i={minFilter:Kn,generateMipmaps:!1,flipY:!1,internalFormat:null};t.mapping!==void 0&&(i.mapping=t.mapping),t.wrapS!==void 0&&(i.wrapS=t.wrapS),t.wrapT!==void 0&&(i.wrapT=t.wrapT),t.wrapR!==void 0&&(i.wrapR=t.wrapR),t.magFilter!==void 0&&(i.magFilter=t.magFilter),t.minFilter!==void 0&&(i.minFilter=t.minFilter),t.format!==void 0&&(i.format=t.format),t.type!==void 0&&(i.type=t.type),t.anisotropy!==void 0&&(i.anisotropy=t.anisotropy),t.colorSpace!==void 0&&(i.colorSpace=t.colorSpace),t.flipY!==void 0&&(i.flipY=t.flipY),t.generateMipmaps!==void 0&&(i.generateMipmaps=t.generateMipmaps),t.internalFormat!==void 0&&(i.internalFormat=t.internalFormat);for(let s=0;s<this.textures.length;s++)this.textures[s].setValues(i)}get texture(){return this.textures[0]}set texture(t){this.textures[0]=t}set depthTexture(t){this._depthTexture!==null&&(this._depthTexture.renderTarget=null),t!==null&&(t.renderTarget=this),this._depthTexture=t}get depthTexture(){return this._depthTexture}setSize(t,i,s=1){if(this.width!==t||this.height!==i||this.depth!==s){this.width=t,this.height=i,this.depth=s;for(let l=0,c=this.textures.length;l<c;l++)this.textures[l].image.width=t,this.textures[l].image.height=i,this.textures[l].image.depth=s,this.textures[l].isData3DTexture!==!0&&(this.textures[l].isArrayTexture=this.textures[l].image.depth>1);this.dispose()}this.viewport.set(0,0,t,i),this.scissor.set(0,0,t,i)}clone(){return new this.constructor().copy(this)}copy(t){this.width=t.width,this.height=t.height,this.depth=t.depth,this.scissor.copy(t.scissor),this.scissorTest=t.scissorTest,this.viewport.copy(t.viewport),this.textures.length=0;for(let i=0,s=t.textures.length;i<s;i++){this.textures[i]=t.textures[i].clone(),this.textures[i].isRenderTargetTexture=!0,this.textures[i].renderTarget=this;const l=Object.assign({},t.textures[i].image);this.textures[i].source=new Ep(l)}return this.depthBuffer=t.depthBuffer,this.stencilBuffer=t.stencilBuffer,this.resolveDepthBuffer=t.resolveDepthBuffer,this.resolveStencilBuffer=t.resolveStencilBuffer,t.depthTexture!==null&&(this.depthTexture=t.depthTexture.clone()),this.samples=t.samples,this.multiview=t.multiview,this.useArrayDepthTexture=t.useArrayDepthTexture,this}dispose(){this.dispatchEvent({type:"dispose"})}}class aa extends u1{constructor(t=1,i=1,s={}){super(t,i,s),this.isWebGLRenderTarget=!0}}class ox extends kn{constructor(t=null,i=1,s=1,l=1){super(null),this.isDataArrayTexture=!0,this.image={data:t,width:i,height:s,depth:l},this.magFilter=Vn,this.minFilter=Vn,this.wrapR=La,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(t){this.layerUpdates.add(t)}clearLayerUpdates(){this.layerUpdates.clear()}}class f1 extends kn{constructor(t=null,i=1,s=1,l=1){super(null),this.isData3DTexture=!0,this.image={data:t,width:i,height:s,depth:l},this.magFilter=Vn,this.minFilter=Vn,this.wrapR=La,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}const vu=class vu{constructor(t,i,s,l,c,f,d,m,p,_,v,g,x,b,A,M){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],t!==void 0&&this.set(t,i,s,l,c,f,d,m,p,_,v,g,x,b,A,M)}set(t,i,s,l,c,f,d,m,p,_,v,g,x,b,A,M){const S=this.elements;return S[0]=t,S[4]=i,S[8]=s,S[12]=l,S[1]=c,S[5]=f,S[9]=d,S[13]=m,S[2]=p,S[6]=_,S[10]=v,S[14]=g,S[3]=x,S[7]=b,S[11]=A,S[15]=M,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new vu().fromArray(this.elements)}copy(t){const i=this.elements,s=t.elements;return i[0]=s[0],i[1]=s[1],i[2]=s[2],i[3]=s[3],i[4]=s[4],i[5]=s[5],i[6]=s[6],i[7]=s[7],i[8]=s[8],i[9]=s[9],i[10]=s[10],i[11]=s[11],i[12]=s[12],i[13]=s[13],i[14]=s[14],i[15]=s[15],this}copyPosition(t){const i=this.elements,s=t.elements;return i[12]=s[12],i[13]=s[13],i[14]=s[14],this}setFromMatrix3(t){const i=t.elements;return this.set(i[0],i[3],i[6],0,i[1],i[4],i[7],0,i[2],i[5],i[8],0,0,0,0,1),this}extractBasis(t,i,s){return this.determinantAffine()===0?(t.set(1,0,0),i.set(0,1,0),s.set(0,0,1),this):(t.setFromMatrixColumn(this,0),i.setFromMatrixColumn(this,1),s.setFromMatrixColumn(this,2),this)}makeBasis(t,i,s){return this.set(t.x,i.x,s.x,0,t.y,i.y,s.y,0,t.z,i.z,s.z,0,0,0,0,1),this}extractRotation(t){if(t.determinantAffine()===0)return this.identity();const i=this.elements,s=t.elements,l=1/Pr.setFromMatrixColumn(t,0).length(),c=1/Pr.setFromMatrixColumn(t,1).length(),f=1/Pr.setFromMatrixColumn(t,2).length();return i[0]=s[0]*l,i[1]=s[1]*l,i[2]=s[2]*l,i[3]=0,i[4]=s[4]*c,i[5]=s[5]*c,i[6]=s[6]*c,i[7]=0,i[8]=s[8]*f,i[9]=s[9]*f,i[10]=s[10]*f,i[11]=0,i[12]=0,i[13]=0,i[14]=0,i[15]=1,this}makeRotationFromEuler(t){const i=this.elements,s=t.x,l=t.y,c=t.z,f=Math.cos(s),d=Math.sin(s),m=Math.cos(l),p=Math.sin(l),_=Math.cos(c),v=Math.sin(c);if(t.order==="XYZ"){const g=f*_,x=f*v,b=d*_,A=d*v;i[0]=m*_,i[4]=-m*v,i[8]=p,i[1]=x+b*p,i[5]=g-A*p,i[9]=-d*m,i[2]=A-g*p,i[6]=b+x*p,i[10]=f*m}else if(t.order==="YXZ"){const g=m*_,x=m*v,b=p*_,A=p*v;i[0]=g+A*d,i[4]=b*d-x,i[8]=f*p,i[1]=f*v,i[5]=f*_,i[9]=-d,i[2]=x*d-b,i[6]=A+g*d,i[10]=f*m}else if(t.order==="ZXY"){const g=m*_,x=m*v,b=p*_,A=p*v;i[0]=g-A*d,i[4]=-f*v,i[8]=b+x*d,i[1]=x+b*d,i[5]=f*_,i[9]=A-g*d,i[2]=-f*p,i[6]=d,i[10]=f*m}else if(t.order==="ZYX"){const g=f*_,x=f*v,b=d*_,A=d*v;i[0]=m*_,i[4]=b*p-x,i[8]=g*p+A,i[1]=m*v,i[5]=A*p+g,i[9]=x*p-b,i[2]=-p,i[6]=d*m,i[10]=f*m}else if(t.order==="YZX"){const g=f*m,x=f*p,b=d*m,A=d*p;i[0]=m*_,i[4]=A-g*v,i[8]=b*v+x,i[1]=v,i[5]=f*_,i[9]=-d*_,i[2]=-p*_,i[6]=x*v+b,i[10]=g-A*v}else if(t.order==="XZY"){const g=f*m,x=f*p,b=d*m,A=d*p;i[0]=m*_,i[4]=-v,i[8]=p*_,i[1]=g*v+A,i[5]=f*_,i[9]=x*v-b,i[2]=b*v-x,i[6]=d*_,i[10]=A*v+g}return i[3]=0,i[7]=0,i[11]=0,i[12]=0,i[13]=0,i[14]=0,i[15]=1,this}makeRotationFromQuaternion(t){return this.compose(h1,t,d1)}lookAt(t,i,s){const l=this.elements;return Si.subVectors(t,i),Si.lengthSq()===0&&(Si.z=1),Si.normalize(),fs.crossVectors(s,Si),fs.lengthSq()===0&&(Math.abs(s.z)===1?Si.x+=1e-4:Si.z+=1e-4,Si.normalize(),fs.crossVectors(s,Si)),fs.normalize(),Lc.crossVectors(Si,fs),l[0]=fs.x,l[4]=Lc.x,l[8]=Si.x,l[1]=fs.y,l[5]=Lc.y,l[9]=Si.y,l[2]=fs.z,l[6]=Lc.z,l[10]=Si.z,this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,i){const s=t.elements,l=i.elements,c=this.elements,f=s[0],d=s[4],m=s[8],p=s[12],_=s[1],v=s[5],g=s[9],x=s[13],b=s[2],A=s[6],M=s[10],S=s[14],O=s[3],U=s[7],w=s[11],z=s[15],N=l[0],L=l[4],E=l[8],D=l[12],F=l[1],H=l[5],X=l[9],ct=l[13],ut=l[2],Z=l[6],P=l[10],k=l[14],tt=l[3],_t=l[7],Et=l[11],B=l[15];return c[0]=f*N+d*F+m*ut+p*tt,c[4]=f*L+d*H+m*Z+p*_t,c[8]=f*E+d*X+m*P+p*Et,c[12]=f*D+d*ct+m*k+p*B,c[1]=_*N+v*F+g*ut+x*tt,c[5]=_*L+v*H+g*Z+x*_t,c[9]=_*E+v*X+g*P+x*Et,c[13]=_*D+v*ct+g*k+x*B,c[2]=b*N+A*F+M*ut+S*tt,c[6]=b*L+A*H+M*Z+S*_t,c[10]=b*E+A*X+M*P+S*Et,c[14]=b*D+A*ct+M*k+S*B,c[3]=O*N+U*F+w*ut+z*tt,c[7]=O*L+U*H+w*Z+z*_t,c[11]=O*E+U*X+w*P+z*Et,c[15]=O*D+U*ct+w*k+z*B,this}multiplyScalar(t){const i=this.elements;return i[0]*=t,i[4]*=t,i[8]*=t,i[12]*=t,i[1]*=t,i[5]*=t,i[9]*=t,i[13]*=t,i[2]*=t,i[6]*=t,i[10]*=t,i[14]*=t,i[3]*=t,i[7]*=t,i[11]*=t,i[15]*=t,this}determinant(){const t=this.elements,i=t[0],s=t[4],l=t[8],c=t[12],f=t[1],d=t[5],m=t[9],p=t[13],_=t[2],v=t[6],g=t[10],x=t[14],b=t[3],A=t[7],M=t[11],S=t[15],O=m*x-p*g,U=d*x-p*v,w=d*g-m*v,z=f*x-p*_,N=f*g-m*_,L=f*v-d*_;return i*(A*O-M*U+S*w)-s*(b*O-M*z+S*N)+l*(b*U-A*z+S*L)-c*(b*w-A*N+M*L)}determinantAffine(){const t=this.elements,i=t[0],s=t[4],l=t[8],c=t[1],f=t[5],d=t[9],m=t[2],p=t[6],_=t[10];return i*(f*_-d*p)-s*(c*_-d*m)+l*(c*p-f*m)}transpose(){const t=this.elements;let i;return i=t[1],t[1]=t[4],t[4]=i,i=t[2],t[2]=t[8],t[8]=i,i=t[6],t[6]=t[9],t[9]=i,i=t[3],t[3]=t[12],t[12]=i,i=t[7],t[7]=t[13],t[13]=i,i=t[11],t[11]=t[14],t[14]=i,this}setPosition(t,i,s){const l=this.elements;return t.isVector3?(l[12]=t.x,l[13]=t.y,l[14]=t.z):(l[12]=t,l[13]=i,l[14]=s),this}invert(){const t=this.elements,i=t[0],s=t[1],l=t[2],c=t[3],f=t[4],d=t[5],m=t[6],p=t[7],_=t[8],v=t[9],g=t[10],x=t[11],b=t[12],A=t[13],M=t[14],S=t[15],O=i*d-s*f,U=i*m-l*f,w=i*p-c*f,z=s*m-l*d,N=s*p-c*d,L=l*p-c*m,E=_*A-v*b,D=_*M-g*b,F=_*S-x*b,H=v*M-g*A,X=v*S-x*A,ct=g*S-x*M,ut=O*ct-U*X+w*H+z*F-N*D+L*E;if(ut===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);const Z=1/ut;return t[0]=(d*ct-m*X+p*H)*Z,t[1]=(l*X-s*ct-c*H)*Z,t[2]=(A*L-M*N+S*z)*Z,t[3]=(g*N-v*L-x*z)*Z,t[4]=(m*F-f*ct-p*D)*Z,t[5]=(i*ct-l*F+c*D)*Z,t[6]=(M*w-b*L-S*U)*Z,t[7]=(_*L-g*w+x*U)*Z,t[8]=(f*X-d*F+p*E)*Z,t[9]=(s*F-i*X-c*E)*Z,t[10]=(b*N-A*w+S*O)*Z,t[11]=(v*w-_*N-x*O)*Z,t[12]=(d*D-f*H-m*E)*Z,t[13]=(i*H-s*D+l*E)*Z,t[14]=(A*U-b*z-M*O)*Z,t[15]=(_*z-v*U+g*O)*Z,this}scale(t){const i=this.elements,s=t.x,l=t.y,c=t.z;return i[0]*=s,i[4]*=l,i[8]*=c,i[1]*=s,i[5]*=l,i[9]*=c,i[2]*=s,i[6]*=l,i[10]*=c,i[3]*=s,i[7]*=l,i[11]*=c,this}getMaxScaleOnAxis(){const t=this.elements,i=t[0]*t[0]+t[1]*t[1]+t[2]*t[2],s=t[4]*t[4]+t[5]*t[5]+t[6]*t[6],l=t[8]*t[8]+t[9]*t[9]+t[10]*t[10];return Math.sqrt(Math.max(i,s,l))}makeTranslation(t,i,s){return t.isVector3?this.set(1,0,0,t.x,0,1,0,t.y,0,0,1,t.z,0,0,0,1):this.set(1,0,0,t,0,1,0,i,0,0,1,s,0,0,0,1),this}makeRotationX(t){const i=Math.cos(t),s=Math.sin(t);return this.set(1,0,0,0,0,i,-s,0,0,s,i,0,0,0,0,1),this}makeRotationY(t){const i=Math.cos(t),s=Math.sin(t);return this.set(i,0,s,0,0,1,0,0,-s,0,i,0,0,0,0,1),this}makeRotationZ(t){const i=Math.cos(t),s=Math.sin(t);return this.set(i,-s,0,0,s,i,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(t,i){const s=Math.cos(i),l=Math.sin(i),c=1-s,f=t.x,d=t.y,m=t.z,p=c*f,_=c*d;return this.set(p*f+s,p*d-l*m,p*m+l*d,0,p*d+l*m,_*d+s,_*m-l*f,0,p*m-l*d,_*m+l*f,c*m*m+s,0,0,0,0,1),this}makeScale(t,i,s){return this.set(t,0,0,0,0,i,0,0,0,0,s,0,0,0,0,1),this}makeShear(t,i,s,l,c,f){return this.set(1,s,c,0,t,1,f,0,i,l,1,0,0,0,0,1),this}compose(t,i,s){const l=this.elements,c=i._x,f=i._y,d=i._z,m=i._w,p=c+c,_=f+f,v=d+d,g=c*p,x=c*_,b=c*v,A=f*_,M=f*v,S=d*v,O=m*p,U=m*_,w=m*v,z=s.x,N=s.y,L=s.z;return l[0]=(1-(A+S))*z,l[1]=(x+w)*z,l[2]=(b-U)*z,l[3]=0,l[4]=(x-w)*N,l[5]=(1-(g+S))*N,l[6]=(M+O)*N,l[7]=0,l[8]=(b+U)*L,l[9]=(M-O)*L,l[10]=(1-(g+A))*L,l[11]=0,l[12]=t.x,l[13]=t.y,l[14]=t.z,l[15]=1,this}decompose(t,i,s){const l=this.elements;t.x=l[12],t.y=l[13],t.z=l[14];const c=this.determinantAffine();if(c===0)return s.set(1,1,1),i.identity(),this;let f=Pr.set(l[0],l[1],l[2]).length();const d=Pr.set(l[4],l[5],l[6]).length(),m=Pr.set(l[8],l[9],l[10]).length();c<0&&(f=-f),Gi.copy(this);const p=1/f,_=1/d,v=1/m;return Gi.elements[0]*=p,Gi.elements[1]*=p,Gi.elements[2]*=p,Gi.elements[4]*=_,Gi.elements[5]*=_,Gi.elements[6]*=_,Gi.elements[8]*=v,Gi.elements[9]*=v,Gi.elements[10]*=v,i.setFromRotationMatrix(Gi),s.x=f,s.y=d,s.z=m,this}makePerspective(t,i,s,l,c,f,d=ea,m=!1){const p=this.elements,_=2*c/(i-t),v=2*c/(s-l),g=(i+t)/(i-t),x=(s+l)/(s-l);let b,A;if(m)b=c/(f-c),A=f*c/(f-c);else if(d===ea)b=-(f+c)/(f-c),A=-2*f*c/(f-c);else if(d===Sl)b=-f/(f-c),A=-f*c/(f-c);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+d);return p[0]=_,p[4]=0,p[8]=g,p[12]=0,p[1]=0,p[5]=v,p[9]=x,p[13]=0,p[2]=0,p[6]=0,p[10]=b,p[14]=A,p[3]=0,p[7]=0,p[11]=-1,p[15]=0,this}makeOrthographic(t,i,s,l,c,f,d=ea,m=!1){const p=this.elements,_=2/(i-t),v=2/(s-l),g=-(i+t)/(i-t),x=-(s+l)/(s-l);let b,A;if(m)b=1/(f-c),A=f/(f-c);else if(d===ea)b=-2/(f-c),A=-(f+c)/(f-c);else if(d===Sl)b=-1/(f-c),A=-c/(f-c);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+d);return p[0]=_,p[4]=0,p[8]=0,p[12]=g,p[1]=0,p[5]=v,p[9]=0,p[13]=x,p[2]=0,p[6]=0,p[10]=b,p[14]=A,p[3]=0,p[7]=0,p[11]=0,p[15]=1,this}equals(t){const i=this.elements,s=t.elements;for(let l=0;l<16;l++)if(i[l]!==s[l])return!1;return!0}fromArray(t,i=0){for(let s=0;s<16;s++)this.elements[s]=t[s+i];return this}toArray(t=[],i=0){const s=this.elements;return t[i]=s[0],t[i+1]=s[1],t[i+2]=s[2],t[i+3]=s[3],t[i+4]=s[4],t[i+5]=s[5],t[i+6]=s[6],t[i+7]=s[7],t[i+8]=s[8],t[i+9]=s[9],t[i+10]=s[10],t[i+11]=s[11],t[i+12]=s[12],t[i+13]=s[13],t[i+14]=s[14],t[i+15]=s[15],t}};vu.prototype.isMatrix4=!0;let Ve=vu;const Pr=new V,Gi=new Ve,h1=new V(0,0,0),d1=new V(1,1,1),fs=new V,Lc=new V,Si=new V,G_=new Ve,V_=new ao;class Ss{constructor(t=0,i=0,s=0,l=Ss.DEFAULT_ORDER){this.isEuler=!0,this._x=t,this._y=i,this._z=s,this._order=l}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get order(){return this._order}set order(t){this._order=t,this._onChangeCallback()}set(t,i,s,l=this._order){return this._x=t,this._y=i,this._z=s,this._order=l,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(t){return this._x=t._x,this._y=t._y,this._z=t._z,this._order=t._order,this._onChangeCallback(),this}setFromRotationMatrix(t,i=this._order,s=!0){const l=t.elements,c=l[0],f=l[4],d=l[8],m=l[1],p=l[5],_=l[9],v=l[2],g=l[6],x=l[10];switch(i){case"XYZ":this._y=Math.asin(Ee(d,-1,1)),Math.abs(d)<.9999999?(this._x=Math.atan2(-_,x),this._z=Math.atan2(-f,c)):(this._x=Math.atan2(g,p),this._z=0);break;case"YXZ":this._x=Math.asin(-Ee(_,-1,1)),Math.abs(_)<.9999999?(this._y=Math.atan2(d,x),this._z=Math.atan2(m,p)):(this._y=Math.atan2(-v,c),this._z=0);break;case"ZXY":this._x=Math.asin(Ee(g,-1,1)),Math.abs(g)<.9999999?(this._y=Math.atan2(-v,x),this._z=Math.atan2(-f,p)):(this._y=0,this._z=Math.atan2(m,c));break;case"ZYX":this._y=Math.asin(-Ee(v,-1,1)),Math.abs(v)<.9999999?(this._x=Math.atan2(g,x),this._z=Math.atan2(m,c)):(this._x=0,this._z=Math.atan2(-f,p));break;case"YZX":this._z=Math.asin(Ee(m,-1,1)),Math.abs(m)<.9999999?(this._x=Math.atan2(-_,p),this._y=Math.atan2(-v,c)):(this._x=0,this._y=Math.atan2(d,x));break;case"XZY":this._z=Math.asin(-Ee(f,-1,1)),Math.abs(f)<.9999999?(this._x=Math.atan2(g,p),this._y=Math.atan2(d,c)):(this._x=Math.atan2(-_,x),this._y=0);break;default:ue("Euler: .setFromRotationMatrix() encountered an unknown order: "+i)}return this._order=i,s===!0&&this._onChangeCallback(),this}setFromQuaternion(t,i,s){return G_.makeRotationFromQuaternion(t),this.setFromRotationMatrix(G_,i,s)}setFromVector3(t,i=this._order){return this.set(t.x,t.y,t.z,i)}reorder(t){return V_.setFromEuler(this),this.setFromQuaternion(V_,t)}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._order===this._order}fromArray(t){return this._x=t[0],this._y=t[1],this._z=t[2],t[3]!==void 0&&(this._order=t[3]),this._onChangeCallback(),this}toArray(t=[],i=0){return t[i]=this._x,t[i+1]=this._y,t[i+2]=this._z,t[i+3]=this._order,t}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}}Ss.DEFAULT_ORDER="XYZ";class lx{constructor(){this.mask=1}set(t){this.mask=(1<<t|0)>>>0}enable(t){this.mask|=1<<t|0}enableAll(){this.mask=-1}toggle(t){this.mask^=1<<t|0}disable(t){this.mask&=~(1<<t|0)}disableAll(){this.mask=0}test(t){return(this.mask&t.mask)!==0}isEnabled(t){return(this.mask&(1<<t|0))!==0}}let p1=0;const k_=new V,zr=new ao,wa=new Ve,Oc=new V,jo=new V,m1=new V,g1=new ao,X_=new V(1,0,0),W_=new V(0,1,0),q_=new V(0,0,1),Y_={type:"added"},_1={type:"removed"},Br={type:"childadded",child:null},Gh={type:"childremoved",child:null};class Cn extends tr{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:p1++}),this.uuid=io(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=Cn.DEFAULT_UP.clone();const t=new V,i=new Ss,s=new ao,l=new V(1,1,1);function c(){s.setFromEuler(i,!1)}function f(){i.setFromQuaternion(s,void 0,!1)}i._onChange(c),s._onChange(f),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:t},rotation:{configurable:!0,enumerable:!0,value:i},quaternion:{configurable:!0,enumerable:!0,value:s},scale:{configurable:!0,enumerable:!0,value:l},modelViewMatrix:{value:new Ve},normalMatrix:{value:new me}}),this.matrix=new Ve,this.matrixWorld=new Ve,this.matrixAutoUpdate=Cn.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=Cn.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new lx,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(t){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(t),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(t){return this.quaternion.premultiply(t),this}setRotationFromAxisAngle(t,i){this.quaternion.setFromAxisAngle(t,i)}setRotationFromEuler(t){this.quaternion.setFromEuler(t,!0)}setRotationFromMatrix(t){this.quaternion.setFromRotationMatrix(t)}setRotationFromQuaternion(t){this.quaternion.copy(t)}rotateOnAxis(t,i){return zr.setFromAxisAngle(t,i),this.quaternion.multiply(zr),this}rotateOnWorldAxis(t,i){return zr.setFromAxisAngle(t,i),this.quaternion.premultiply(zr),this}rotateX(t){return this.rotateOnAxis(X_,t)}rotateY(t){return this.rotateOnAxis(W_,t)}rotateZ(t){return this.rotateOnAxis(q_,t)}translateOnAxis(t,i){return k_.copy(t).applyQuaternion(this.quaternion),this.position.add(k_.multiplyScalar(i)),this}translateX(t){return this.translateOnAxis(X_,t)}translateY(t){return this.translateOnAxis(W_,t)}translateZ(t){return this.translateOnAxis(q_,t)}localToWorld(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(this.matrixWorld)}worldToLocal(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(wa.copy(this.matrixWorld).invert())}lookAt(t,i,s){t.isVector3?Oc.copy(t):Oc.set(t,i,s);const l=this.parent;this.updateWorldMatrix(!0,!1),jo.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?wa.lookAt(jo,Oc,this.up):wa.lookAt(Oc,jo,this.up),this.quaternion.setFromRotationMatrix(wa),l&&(wa.extractRotation(l.matrixWorld),zr.setFromRotationMatrix(wa),this.quaternion.premultiply(zr.invert()))}add(t){if(arguments.length>1){for(let i=0;i<arguments.length;i++)this.add(arguments[i]);return this}return t===this?(Oe("Object3D.add: object can't be added as a child of itself.",t),this):(t&&t.isObject3D?(t.removeFromParent(),t.parent=this,this.children.push(t),t.dispatchEvent(Y_),Br.child=t,this.dispatchEvent(Br),Br.child=null):Oe("Object3D.add: object not an instance of THREE.Object3D.",t),this)}remove(t){if(arguments.length>1){for(let s=0;s<arguments.length;s++)this.remove(arguments[s]);return this}const i=this.children.indexOf(t);return i!==-1&&(t.parent=null,this.children.splice(i,1),t.dispatchEvent(_1),Gh.child=t,this.dispatchEvent(Gh),Gh.child=null),this}removeFromParent(){const t=this.parent;return t!==null&&t.remove(this),this}clear(){return this.remove(...this.children)}attach(t){return this.updateWorldMatrix(!0,!1),wa.copy(this.matrixWorld).invert(),t.parent!==null&&(t.parent.updateWorldMatrix(!0,!1),wa.multiply(t.parent.matrixWorld)),t.applyMatrix4(wa),t.removeFromParent(),t.parent=this,this.children.push(t),t.updateWorldMatrix(!1,!0),t.dispatchEvent(Y_),Br.child=t,this.dispatchEvent(Br),Br.child=null,this}getObjectById(t){return this.getObjectByProperty("id",t)}getObjectByName(t){return this.getObjectByProperty("name",t)}getObjectByProperty(t,i){if(this[t]===i)return this;for(let s=0,l=this.children.length;s<l;s++){const f=this.children[s].getObjectByProperty(t,i);if(f!==void 0)return f}}getObjectsByProperty(t,i,s=[]){this[t]===i&&s.push(this);const l=this.children;for(let c=0,f=l.length;c<f;c++)l[c].getObjectsByProperty(t,i,s);return s}getWorldPosition(t){return this.updateWorldMatrix(!0,!1),t.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(jo,t,m1),t}getWorldScale(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(jo,g1,t),t}getWorldDirection(t){this.updateWorldMatrix(!0,!1);const i=this.matrixWorld.elements;return t.set(i[8],i[9],i[10]).normalize()}raycast(){}traverse(t){t(this);const i=this.children;for(let s=0,l=i.length;s<l;s++)i[s].traverse(t)}traverseVisible(t){if(this.visible===!1)return;t(this);const i=this.children;for(let s=0,l=i.length;s<l;s++)i[s].traverseVisible(t)}traverseAncestors(t){const i=this.parent;i!==null&&(t(i),i.traverseAncestors(t))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);const t=this.pivot;if(t!==null){const i=t.x,s=t.y,l=t.z,c=this.matrix.elements;c[12]+=i-c[0]*i-c[4]*s-c[8]*l,c[13]+=s-c[1]*i-c[5]*s-c[9]*l,c[14]+=l-c[2]*i-c[6]*s-c[10]*l}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(t){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||t)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,t=!0);const i=this.children;for(let s=0,l=i.length;s<l;s++)i[s].updateMatrixWorld(t)}updateWorldMatrix(t,i,s=!1){const l=this.parent;if(t===!0&&l!==null&&l.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||s)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,s=!0),i===!0){const c=this.children;for(let f=0,d=c.length;f<d;f++)c[f].updateWorldMatrix(!1,!0,s)}}toJSON(t){const i=t===void 0||typeof t=="string",s={};i&&(t={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},s.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});const l={};l.uuid=this.uuid,l.type=this.type,this.name!==""&&(l.name=this.name),this.castShadow===!0&&(l.castShadow=!0),this.receiveShadow===!0&&(l.receiveShadow=!0),this.visible===!1&&(l.visible=!1),this.frustumCulled===!1&&(l.frustumCulled=!1),this.renderOrder!==0&&(l.renderOrder=this.renderOrder),this.static!==!1&&(l.static=this.static),Object.keys(this.userData).length>0&&(l.userData=this.userData),l.layers=this.layers.mask,l.matrix=this.matrix.toArray(),l.up=this.up.toArray(),this.pivot!==null&&(l.pivot=this.pivot.toArray()),this.matrixAutoUpdate===!1&&(l.matrixAutoUpdate=!1),this.morphTargetDictionary!==void 0&&(l.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(l.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(l.type="InstancedMesh",l.count=this.count,l.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(l.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(l.type="BatchedMesh",l.perObjectFrustumCulled=this.perObjectFrustumCulled,l.sortObjects=this.sortObjects,l.drawRanges=this._drawRanges,l.reservedRanges=this._reservedRanges,l.geometryInfo=this._geometryInfo.map(d=>({...d,boundingBox:d.boundingBox?d.boundingBox.toJSON():void 0,boundingSphere:d.boundingSphere?d.boundingSphere.toJSON():void 0})),l.instanceInfo=this._instanceInfo.map(d=>({...d})),l.availableInstanceIds=this._availableInstanceIds.slice(),l.availableGeometryIds=this._availableGeometryIds.slice(),l.nextIndexStart=this._nextIndexStart,l.nextVertexStart=this._nextVertexStart,l.geometryCount=this._geometryCount,l.maxInstanceCount=this._maxInstanceCount,l.maxVertexCount=this._maxVertexCount,l.maxIndexCount=this._maxIndexCount,l.geometryInitialized=this._geometryInitialized,l.matricesTexture=this._matricesTexture.toJSON(t),l.indirectTexture=this._indirectTexture.toJSON(t),this._colorsTexture!==null&&(l.colorsTexture=this._colorsTexture.toJSON(t)),this.boundingSphere!==null&&(l.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(l.boundingBox=this.boundingBox.toJSON()));function c(d,m){return d[m.uuid]===void 0&&(d[m.uuid]=m.toJSON(t)),m.uuid}if(this.isScene)this.background&&(this.background.isColor?l.background=this.background.toJSON():this.background.isTexture&&(l.background=this.background.toJSON(t).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(l.environment=this.environment.toJSON(t).uuid);else if(this.isMesh||this.isLine||this.isPoints){l.geometry=c(t.geometries,this.geometry);const d=this.geometry.parameters;if(d!==void 0&&d.shapes!==void 0){const m=d.shapes;if(Array.isArray(m))for(let p=0,_=m.length;p<_;p++){const v=m[p];c(t.shapes,v)}else c(t.shapes,m)}}if(this.isSkinnedMesh&&(l.bindMode=this.bindMode,l.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(c(t.skeletons,this.skeleton),l.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){const d=[];for(let m=0,p=this.material.length;m<p;m++)d.push(c(t.materials,this.material[m]));l.material=d}else l.material=c(t.materials,this.material);if(this.children.length>0){l.children=[];for(let d=0;d<this.children.length;d++)l.children.push(this.children[d].toJSON(t).object)}if(this.animations.length>0){l.animations=[];for(let d=0;d<this.animations.length;d++){const m=this.animations[d];l.animations.push(c(t.animations,m))}}if(i){const d=f(t.geometries),m=f(t.materials),p=f(t.textures),_=f(t.images),v=f(t.shapes),g=f(t.skeletons),x=f(t.animations),b=f(t.nodes);d.length>0&&(s.geometries=d),m.length>0&&(s.materials=m),p.length>0&&(s.textures=p),_.length>0&&(s.images=_),v.length>0&&(s.shapes=v),g.length>0&&(s.skeletons=g),x.length>0&&(s.animations=x),b.length>0&&(s.nodes=b)}return s.object=l,s;function f(d){const m=[];for(const p in d){const _=d[p];delete _.metadata,m.push(_)}return m}}clone(t){return new this.constructor().copy(this,t)}copy(t,i=!0){if(this.name=t.name,this.up.copy(t.up),this.position.copy(t.position),this.rotation.order=t.rotation.order,this.quaternion.copy(t.quaternion),this.scale.copy(t.scale),this.pivot=t.pivot!==null?t.pivot.clone():null,this.matrix.copy(t.matrix),this.matrixWorld.copy(t.matrixWorld),this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrixWorldAutoUpdate=t.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=t.matrixWorldNeedsUpdate,this.layers.mask=t.layers.mask,this.visible=t.visible,this.castShadow=t.castShadow,this.receiveShadow=t.receiveShadow,this.frustumCulled=t.frustumCulled,this.renderOrder=t.renderOrder,this.static=t.static,this.animations=t.animations.slice(),this.userData=JSON.parse(JSON.stringify(t.userData)),i===!0)for(let s=0;s<t.children.length;s++){const l=t.children[s];this.add(l.clone())}return this}}Cn.DEFAULT_UP=new V(0,1,0);Cn.DEFAULT_MATRIX_AUTO_UPDATE=!0;Cn.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;class na extends Cn{constructor(){super(),this.isGroup=!0,this.type="Group"}}const v1={type:"move"};class Vh{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new na,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new na,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new V,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new V),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new na,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new V,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new V,this._grip.eventsEnabled=!1),this._grip}dispatchEvent(t){return this._targetRay!==null&&this._targetRay.dispatchEvent(t),this._grip!==null&&this._grip.dispatchEvent(t),this._hand!==null&&this._hand.dispatchEvent(t),this}connect(t){if(t&&t.hand){const i=this._hand;if(i)for(const s of t.hand.values())this._getHandJoint(i,s)}return this.dispatchEvent({type:"connected",data:t}),this}disconnect(t){return this.dispatchEvent({type:"disconnected",data:t}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(t,i,s){let l=null,c=null,f=null;const d=this._targetRay,m=this._grip,p=this._hand;if(t&&i.session.visibilityState!=="visible-blurred"){if(p&&t.hand){f=!0;for(const A of t.hand.values()){const M=i.getJointPose(A,s),S=this._getHandJoint(p,A);M!==null&&(S.matrix.fromArray(M.transform.matrix),S.matrix.decompose(S.position,S.rotation,S.scale),S.matrixWorldNeedsUpdate=!0,S.jointRadius=M.radius),S.visible=M!==null}const _=p.joints["index-finger-tip"],v=p.joints["thumb-tip"],g=_.position.distanceTo(v.position),x=.02,b=.005;p.inputState.pinching&&g>x+b?(p.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:t.handedness,target:this})):!p.inputState.pinching&&g<=x-b&&(p.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:t.handedness,target:this}))}else m!==null&&t.gripSpace&&(c=i.getPose(t.gripSpace,s),c!==null&&(m.matrix.fromArray(c.transform.matrix),m.matrix.decompose(m.position,m.rotation,m.scale),m.matrixWorldNeedsUpdate=!0,c.linearVelocity?(m.hasLinearVelocity=!0,m.linearVelocity.copy(c.linearVelocity)):m.hasLinearVelocity=!1,c.angularVelocity?(m.hasAngularVelocity=!0,m.angularVelocity.copy(c.angularVelocity)):m.hasAngularVelocity=!1,m.eventsEnabled&&m.dispatchEvent({type:"gripUpdated",data:t,target:this})));d!==null&&(l=i.getPose(t.targetRaySpace,s),l===null&&c!==null&&(l=c),l!==null&&(d.matrix.fromArray(l.transform.matrix),d.matrix.decompose(d.position,d.rotation,d.scale),d.matrixWorldNeedsUpdate=!0,l.linearVelocity?(d.hasLinearVelocity=!0,d.linearVelocity.copy(l.linearVelocity)):d.hasLinearVelocity=!1,l.angularVelocity?(d.hasAngularVelocity=!0,d.angularVelocity.copy(l.angularVelocity)):d.hasAngularVelocity=!1,this.dispatchEvent(v1)))}return d!==null&&(d.visible=l!==null),m!==null&&(m.visible=c!==null),p!==null&&(p.visible=f!==null),this}_getHandJoint(t,i){if(t.joints[i.jointName]===void 0){const s=new na;s.matrixAutoUpdate=!1,s.visible=!1,t.joints[i.jointName]=s,t.add(s)}return t.joints[i.jointName]}}const cx={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},hs={h:0,s:0,l:0},Pc={h:0,s:0,l:0};function kh(r,t,i){return i<0&&(i+=1),i>1&&(i-=1),i<1/6?r+(t-r)*6*i:i<1/2?t:i<2/3?r+(t-r)*6*(2/3-i):r}class Re{constructor(t,i,s){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(t,i,s)}set(t,i,s){if(i===void 0&&s===void 0){const l=t;l&&l.isColor?this.copy(l):typeof l=="number"?this.setHex(l):typeof l=="string"&&this.setStyle(l)}else this.setRGB(t,i,s);return this}setScalar(t){return this.r=t,this.g=t,this.b=t,this}setHex(t,i=ei){return t=Math.floor(t),this.r=(t>>16&255)/255,this.g=(t>>8&255)/255,this.b=(t&255)/255,Ne.colorSpaceToWorking(this,i),this}setRGB(t,i,s,l=Ne.workingColorSpace){return this.r=t,this.g=i,this.b=s,Ne.colorSpaceToWorking(this,l),this}setHSL(t,i,s,l=Ne.workingColorSpace){if(t=bp(t,1),i=Ee(i,0,1),s=Ee(s,0,1),i===0)this.r=this.g=this.b=s;else{const c=s<=.5?s*(1+i):s+i-s*i,f=2*s-c;this.r=kh(f,c,t+1/3),this.g=kh(f,c,t),this.b=kh(f,c,t-1/3)}return Ne.colorSpaceToWorking(this,l),this}setStyle(t,i=ei){function s(c){c!==void 0&&parseFloat(c)<1&&ue("Color: Alpha component of "+t+" will be ignored.")}let l;if(l=/^(\w+)\(([^\)]*)\)/.exec(t)){let c;const f=l[1],d=l[2];switch(f){case"rgb":case"rgba":if(c=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(d))return s(c[4]),this.setRGB(Math.min(255,parseInt(c[1],10))/255,Math.min(255,parseInt(c[2],10))/255,Math.min(255,parseInt(c[3],10))/255,i);if(c=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(d))return s(c[4]),this.setRGB(Math.min(100,parseInt(c[1],10))/100,Math.min(100,parseInt(c[2],10))/100,Math.min(100,parseInt(c[3],10))/100,i);break;case"hsl":case"hsla":if(c=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(d))return s(c[4]),this.setHSL(parseFloat(c[1])/360,parseFloat(c[2])/100,parseFloat(c[3])/100,i);break;default:ue("Color: Unknown color model "+t)}}else if(l=/^\#([A-Fa-f\d]+)$/.exec(t)){const c=l[1],f=c.length;if(f===3)return this.setRGB(parseInt(c.charAt(0),16)/15,parseInt(c.charAt(1),16)/15,parseInt(c.charAt(2),16)/15,i);if(f===6)return this.setHex(parseInt(c,16),i);ue("Color: Invalid hex color "+t)}else if(t&&t.length>0)return this.setColorName(t,i);return this}setColorName(t,i=ei){const s=cx[t.toLowerCase()];return s!==void 0?this.setHex(s,i):ue("Color: Unknown color "+t),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(t){return this.r=t.r,this.g=t.g,this.b=t.b,this}copySRGBToLinear(t){return this.r=Pa(t.r),this.g=Pa(t.g),this.b=Pa(t.b),this}copyLinearToSRGB(t){return this.r=jr(t.r),this.g=jr(t.g),this.b=jr(t.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(t=ei){return Ne.workingToColorSpace(Yn.copy(this),t),Math.round(Ee(Yn.r*255,0,255))*65536+Math.round(Ee(Yn.g*255,0,255))*256+Math.round(Ee(Yn.b*255,0,255))}getHexString(t=ei){return("000000"+this.getHex(t).toString(16)).slice(-6)}getHSL(t,i=Ne.workingColorSpace){Ne.workingToColorSpace(Yn.copy(this),i);const s=Yn.r,l=Yn.g,c=Yn.b,f=Math.max(s,l,c),d=Math.min(s,l,c);let m,p;const _=(d+f)/2;if(d===f)m=0,p=0;else{const v=f-d;switch(p=_<=.5?v/(f+d):v/(2-f-d),f){case s:m=(l-c)/v+(l<c?6:0);break;case l:m=(c-s)/v+2;break;case c:m=(s-l)/v+4;break}m/=6}return t.h=m,t.s=p,t.l=_,t}getRGB(t,i=Ne.workingColorSpace){return Ne.workingToColorSpace(Yn.copy(this),i),t.r=Yn.r,t.g=Yn.g,t.b=Yn.b,t}getStyle(t=ei){Ne.workingToColorSpace(Yn.copy(this),t);const i=Yn.r,s=Yn.g,l=Yn.b;return t!==ei?`color(${t} ${i.toFixed(3)} ${s.toFixed(3)} ${l.toFixed(3)})`:`rgb(${Math.round(i*255)},${Math.round(s*255)},${Math.round(l*255)})`}offsetHSL(t,i,s){return this.getHSL(hs),this.setHSL(hs.h+t,hs.s+i,hs.l+s)}add(t){return this.r+=t.r,this.g+=t.g,this.b+=t.b,this}addColors(t,i){return this.r=t.r+i.r,this.g=t.g+i.g,this.b=t.b+i.b,this}addScalar(t){return this.r+=t,this.g+=t,this.b+=t,this}sub(t){return this.r=Math.max(0,this.r-t.r),this.g=Math.max(0,this.g-t.g),this.b=Math.max(0,this.b-t.b),this}multiply(t){return this.r*=t.r,this.g*=t.g,this.b*=t.b,this}multiplyScalar(t){return this.r*=t,this.g*=t,this.b*=t,this}lerp(t,i){return this.r+=(t.r-this.r)*i,this.g+=(t.g-this.g)*i,this.b+=(t.b-this.b)*i,this}lerpColors(t,i,s){return this.r=t.r+(i.r-t.r)*s,this.g=t.g+(i.g-t.g)*s,this.b=t.b+(i.b-t.b)*s,this}lerpHSL(t,i){this.getHSL(hs),t.getHSL(Pc);const s=fl(hs.h,Pc.h,i),l=fl(hs.s,Pc.s,i),c=fl(hs.l,Pc.l,i);return this.setHSL(s,l,c),this}setFromVector3(t){return this.r=t.x,this.g=t.y,this.b=t.z,this}applyMatrix3(t){const i=this.r,s=this.g,l=this.b,c=t.elements;return this.r=c[0]*i+c[3]*s+c[6]*l,this.g=c[1]*i+c[4]*s+c[7]*l,this.b=c[2]*i+c[5]*s+c[8]*l,this}equals(t){return t.r===this.r&&t.g===this.g&&t.b===this.b}fromArray(t,i=0){return this.r=t[i],this.g=t[i+1],this.b=t[i+2],this}toArray(t=[],i=0){return t[i]=this.r,t[i+1]=this.g,t[i+2]=this.b,t}fromBufferAttribute(t,i){return this.r=t.getX(i),this.g=t.getY(i),this.b=t.getZ(i),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}}const Yn=new Re;Re.NAMES=cx;class Tp{constructor(t,i=1,s=1e3){this.isFog=!0,this.name="",this.color=new Re(t),this.near=i,this.far=s}clone(){return new Tp(this.color,this.near,this.far)}toJSON(){return{type:"Fog",name:this.name,color:this.color.getHex(),near:this.near,far:this.far}}}class x1 extends Cn{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new Ss,this.environmentIntensity=1,this.environmentRotation=new Ss,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(t,i){return super.copy(t,i),t.background!==null&&(this.background=t.background.clone()),t.environment!==null&&(this.environment=t.environment.clone()),t.fog!==null&&(this.fog=t.fog.clone()),this.backgroundBlurriness=t.backgroundBlurriness,this.backgroundIntensity=t.backgroundIntensity,this.backgroundRotation.copy(t.backgroundRotation),this.environmentIntensity=t.environmentIntensity,this.environmentRotation.copy(t.environmentRotation),t.overrideMaterial!==null&&(this.overrideMaterial=t.overrideMaterial.clone()),this.matrixAutoUpdate=t.matrixAutoUpdate,this}toJSON(t){const i=super.toJSON(t);return this.fog!==null&&(i.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(i.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(i.object.backgroundIntensity=this.backgroundIntensity),i.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(i.object.environmentIntensity=this.environmentIntensity),i.object.environmentRotation=this.environmentRotation.toArray(),i}}const Vi=new V,Ra=new V,Xh=new V,Ca=new V,Ir=new V,Fr=new V,Z_=new V,Wh=new V,qh=new V,Yh=new V,Zh=new gn,Kh=new gn,Jh=new gn;class Xi{constructor(t=new V,i=new V,s=new V){this.a=t,this.b=i,this.c=s}static getNormal(t,i,s,l){l.subVectors(s,i),Vi.subVectors(t,i),l.cross(Vi);const c=l.lengthSq();return c>0?l.multiplyScalar(1/Math.sqrt(c)):l.set(0,0,0)}static getBarycoord(t,i,s,l,c){Vi.subVectors(l,i),Ra.subVectors(s,i),Xh.subVectors(t,i);const f=Vi.dot(Vi),d=Vi.dot(Ra),m=Vi.dot(Xh),p=Ra.dot(Ra),_=Ra.dot(Xh),v=f*p-d*d;if(v===0)return c.set(0,0,0),null;const g=1/v,x=(p*m-d*_)*g,b=(f*_-d*m)*g;return c.set(1-x-b,b,x)}static containsPoint(t,i,s,l){return this.getBarycoord(t,i,s,l,Ca)===null?!1:Ca.x>=0&&Ca.y>=0&&Ca.x+Ca.y<=1}static getInterpolation(t,i,s,l,c,f,d,m){return this.getBarycoord(t,i,s,l,Ca)===null?(m.x=0,m.y=0,"z"in m&&(m.z=0),"w"in m&&(m.w=0),null):(m.setScalar(0),m.addScaledVector(c,Ca.x),m.addScaledVector(f,Ca.y),m.addScaledVector(d,Ca.z),m)}static getInterpolatedAttribute(t,i,s,l,c,f){return Zh.setScalar(0),Kh.setScalar(0),Jh.setScalar(0),Zh.fromBufferAttribute(t,i),Kh.fromBufferAttribute(t,s),Jh.fromBufferAttribute(t,l),f.setScalar(0),f.addScaledVector(Zh,c.x),f.addScaledVector(Kh,c.y),f.addScaledVector(Jh,c.z),f}static isFrontFacing(t,i,s,l){return Vi.subVectors(s,i),Ra.subVectors(t,i),Vi.cross(Ra).dot(l)<0}set(t,i,s){return this.a.copy(t),this.b.copy(i),this.c.copy(s),this}setFromPointsAndIndices(t,i,s,l){return this.a.copy(t[i]),this.b.copy(t[s]),this.c.copy(t[l]),this}setFromAttributeAndIndices(t,i,s,l){return this.a.fromBufferAttribute(t,i),this.b.fromBufferAttribute(t,s),this.c.fromBufferAttribute(t,l),this}clone(){return new this.constructor().copy(this)}copy(t){return this.a.copy(t.a),this.b.copy(t.b),this.c.copy(t.c),this}getArea(){return Vi.subVectors(this.c,this.b),Ra.subVectors(this.a,this.b),Vi.cross(Ra).length()*.5}getMidpoint(t){return t.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(t){return Xi.getNormal(this.a,this.b,this.c,t)}getPlane(t){return t.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(t,i){return Xi.getBarycoord(t,this.a,this.b,this.c,i)}getInterpolation(t,i,s,l,c){return Xi.getInterpolation(t,this.a,this.b,this.c,i,s,l,c)}containsPoint(t){return Xi.containsPoint(t,this.a,this.b,this.c)}isFrontFacing(t){return Xi.isFrontFacing(this.a,this.b,this.c,t)}intersectsBox(t){return t.intersectsTriangle(this)}closestPointToPoint(t,i){const s=this.a,l=this.b,c=this.c;let f,d;Ir.subVectors(l,s),Fr.subVectors(c,s),Wh.subVectors(t,s);const m=Ir.dot(Wh),p=Fr.dot(Wh);if(m<=0&&p<=0)return i.copy(s);qh.subVectors(t,l);const _=Ir.dot(qh),v=Fr.dot(qh);if(_>=0&&v<=_)return i.copy(l);const g=m*v-_*p;if(g<=0&&m>=0&&_<=0)return f=m/(m-_),i.copy(s).addScaledVector(Ir,f);Yh.subVectors(t,c);const x=Ir.dot(Yh),b=Fr.dot(Yh);if(b>=0&&x<=b)return i.copy(c);const A=x*p-m*b;if(A<=0&&p>=0&&b<=0)return d=p/(p-b),i.copy(s).addScaledVector(Fr,d);const M=_*b-x*v;if(M<=0&&v-_>=0&&x-b>=0)return Z_.subVectors(c,l),d=(v-_)/(v-_+(x-b)),i.copy(l).addScaledVector(Z_,d);const S=1/(M+A+g);return f=A*S,d=g*S,i.copy(s).addScaledVector(Ir,f).addScaledVector(Fr,d)}equals(t){return t.a.equals(this.a)&&t.b.equals(this.b)&&t.c.equals(this.c)}}class er{constructor(t=new V(1/0,1/0,1/0),i=new V(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=t,this.max=i}set(t,i){return this.min.copy(t),this.max.copy(i),this}setFromArray(t){this.makeEmpty();for(let i=0,s=t.length;i<s;i+=3)this.expandByPoint(ki.fromArray(t,i));return this}setFromBufferAttribute(t){this.makeEmpty();for(let i=0,s=t.count;i<s;i++)this.expandByPoint(ki.fromBufferAttribute(t,i));return this}setFromPoints(t){this.makeEmpty();for(let i=0,s=t.length;i<s;i++)this.expandByPoint(t[i]);return this}setFromCenterAndSize(t,i){const s=ki.copy(i).multiplyScalar(.5);return this.min.copy(t).sub(s),this.max.copy(t).add(s),this}setFromObject(t,i=!1){return this.makeEmpty(),this.expandByObject(t,i)}clone(){return new this.constructor().copy(this)}copy(t){return this.min.copy(t.min),this.max.copy(t.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(t){return this.isEmpty()?t.set(0,0,0):t.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(t){return this.isEmpty()?t.set(0,0,0):t.subVectors(this.max,this.min)}expandByPoint(t){return this.min.min(t),this.max.max(t),this}expandByVector(t){return this.min.sub(t),this.max.add(t),this}expandByScalar(t){return this.min.addScalar(-t),this.max.addScalar(t),this}expandByObject(t,i=!1){t.updateWorldMatrix(!1,!1);const s=t.geometry;if(s!==void 0){const c=s.getAttribute("position");if(i===!0&&c!==void 0&&t.isInstancedMesh!==!0)for(let f=0,d=c.count;f<d;f++)t.isMesh===!0?t.getVertexPosition(f,ki):ki.fromBufferAttribute(c,f),ki.applyMatrix4(t.matrixWorld),this.expandByPoint(ki);else t.boundingBox!==void 0?(t.boundingBox===null&&t.computeBoundingBox(),zc.copy(t.boundingBox)):(s.boundingBox===null&&s.computeBoundingBox(),zc.copy(s.boundingBox)),zc.applyMatrix4(t.matrixWorld),this.union(zc)}const l=t.children;for(let c=0,f=l.length;c<f;c++)this.expandByObject(l[c],i);return this}containsPoint(t){return t.x>=this.min.x&&t.x<=this.max.x&&t.y>=this.min.y&&t.y<=this.max.y&&t.z>=this.min.z&&t.z<=this.max.z}containsBox(t){return this.min.x<=t.min.x&&t.max.x<=this.max.x&&this.min.y<=t.min.y&&t.max.y<=this.max.y&&this.min.z<=t.min.z&&t.max.z<=this.max.z}getParameter(t,i){return i.set((t.x-this.min.x)/(this.max.x-this.min.x),(t.y-this.min.y)/(this.max.y-this.min.y),(t.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(t){return t.max.x>=this.min.x&&t.min.x<=this.max.x&&t.max.y>=this.min.y&&t.min.y<=this.max.y&&t.max.z>=this.min.z&&t.min.z<=this.max.z}intersectsSphere(t){return this.clampPoint(t.center,ki),ki.distanceToSquared(t.center)<=t.radius*t.radius}intersectsPlane(t){let i,s;return t.normal.x>0?(i=t.normal.x*this.min.x,s=t.normal.x*this.max.x):(i=t.normal.x*this.max.x,s=t.normal.x*this.min.x),t.normal.y>0?(i+=t.normal.y*this.min.y,s+=t.normal.y*this.max.y):(i+=t.normal.y*this.max.y,s+=t.normal.y*this.min.y),t.normal.z>0?(i+=t.normal.z*this.min.z,s+=t.normal.z*this.max.z):(i+=t.normal.z*this.max.z,s+=t.normal.z*this.min.z),i<=-t.constant&&s>=-t.constant}intersectsTriangle(t){if(this.isEmpty())return!1;this.getCenter($o),Bc.subVectors(this.max,$o),Hr.subVectors(t.a,$o),Gr.subVectors(t.b,$o),Vr.subVectors(t.c,$o),ds.subVectors(Gr,Hr),ps.subVectors(Vr,Gr),Fs.subVectors(Hr,Vr);let i=[0,-ds.z,ds.y,0,-ps.z,ps.y,0,-Fs.z,Fs.y,ds.z,0,-ds.x,ps.z,0,-ps.x,Fs.z,0,-Fs.x,-ds.y,ds.x,0,-ps.y,ps.x,0,-Fs.y,Fs.x,0];return!Qh(i,Hr,Gr,Vr,Bc)||(i=[1,0,0,0,1,0,0,0,1],!Qh(i,Hr,Gr,Vr,Bc))?!1:(Ic.crossVectors(ds,ps),i=[Ic.x,Ic.y,Ic.z],Qh(i,Hr,Gr,Vr,Bc))}clampPoint(t,i){return i.copy(t).clamp(this.min,this.max)}distanceToPoint(t){return this.clampPoint(t,ki).distanceTo(t)}getBoundingSphere(t){return this.isEmpty()?t.makeEmpty():(this.getCenter(t.center),t.radius=this.getSize(ki).length()*.5),t}intersect(t){return this.min.max(t.min),this.max.min(t.max),this.isEmpty()&&this.makeEmpty(),this}union(t){return this.min.min(t.min),this.max.max(t.max),this}applyMatrix4(t){return this.isEmpty()?this:(Da[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(t),Da[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(t),Da[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(t),Da[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(t),Da[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(t),Da[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(t),Da[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(t),Da[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(t),this.setFromPoints(Da),this)}translate(t){return this.min.add(t),this.max.add(t),this}equals(t){return t.min.equals(this.min)&&t.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(t){return this.min.fromArray(t.min),this.max.fromArray(t.max),this}}const Da=[new V,new V,new V,new V,new V,new V,new V,new V],ki=new V,zc=new er,Hr=new V,Gr=new V,Vr=new V,ds=new V,ps=new V,Fs=new V,$o=new V,Bc=new V,Ic=new V,Hs=new V;function Qh(r,t,i,s,l){for(let c=0,f=r.length-3;c<=f;c+=3){Hs.fromArray(r,c);const d=l.x*Math.abs(Hs.x)+l.y*Math.abs(Hs.y)+l.z*Math.abs(Hs.z),m=t.dot(Hs),p=i.dot(Hs),_=s.dot(Hs);if(Math.max(-Math.max(m,p,_),Math.min(m,p,_))>d)return!1}return!0}const Rn=new V,Fc=new ae;let S1=0;class Ti extends tr{constructor(t,i,s=!1){if(super(),Array.isArray(t))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:S1++}),this.name="",this.array=t,this.itemSize=i,this.count=t!==void 0?t.length/i:0,this.normalized=s,this.usage=L_,this.updateRanges=[],this.gpuType=Wi,this.version=0}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}setUsage(t){return this.usage=t,this}addUpdateRange(t,i){this.updateRanges.push({start:t,count:i})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.name=t.name,this.array=new t.array.constructor(t.array),this.itemSize=t.itemSize,this.count=t.count,this.normalized=t.normalized,this.usage=t.usage,this.gpuType=t.gpuType,this}copyAt(t,i,s){t*=this.itemSize,s*=i.itemSize;for(let l=0,c=this.itemSize;l<c;l++)this.array[t+l]=i.array[s+l];return this}copyArray(t){return this.array.set(t),this}applyMatrix3(t){if(this.itemSize===2)for(let i=0,s=this.count;i<s;i++)Fc.fromBufferAttribute(this,i),Fc.applyMatrix3(t),this.setXY(i,Fc.x,Fc.y);else if(this.itemSize===3)for(let i=0,s=this.count;i<s;i++)Rn.fromBufferAttribute(this,i),Rn.applyMatrix3(t),this.setXYZ(i,Rn.x,Rn.y,Rn.z);return this}applyMatrix4(t){for(let i=0,s=this.count;i<s;i++)Rn.fromBufferAttribute(this,i),Rn.applyMatrix4(t),this.setXYZ(i,Rn.x,Rn.y,Rn.z);return this}applyNormalMatrix(t){for(let i=0,s=this.count;i<s;i++)Rn.fromBufferAttribute(this,i),Rn.applyNormalMatrix(t),this.setXYZ(i,Rn.x,Rn.y,Rn.z);return this}transformDirection(t){for(let i=0,s=this.count;i<s;i++)Rn.fromBufferAttribute(this,i),Rn.transformDirection(t),this.setXYZ(i,Rn.x,Rn.y,Rn.z);return this}set(t,i=0){return this.array.set(t,i),this}getComponent(t,i){let s=this.array[t*this.itemSize+i];return this.normalized&&(s=Kr(s,this.array)),s}setComponent(t,i,s){return this.normalized&&(s=$n(s,this.array)),this.array[t*this.itemSize+i]=s,this}getX(t){let i=this.array[t*this.itemSize];return this.normalized&&(i=Kr(i,this.array)),i}setX(t,i){return this.normalized&&(i=$n(i,this.array)),this.array[t*this.itemSize]=i,this}getY(t){let i=this.array[t*this.itemSize+1];return this.normalized&&(i=Kr(i,this.array)),i}setY(t,i){return this.normalized&&(i=$n(i,this.array)),this.array[t*this.itemSize+1]=i,this}getZ(t){let i=this.array[t*this.itemSize+2];return this.normalized&&(i=Kr(i,this.array)),i}setZ(t,i){return this.normalized&&(i=$n(i,this.array)),this.array[t*this.itemSize+2]=i,this}getW(t){let i=this.array[t*this.itemSize+3];return this.normalized&&(i=Kr(i,this.array)),i}setW(t,i){return this.normalized&&(i=$n(i,this.array)),this.array[t*this.itemSize+3]=i,this}setXY(t,i,s){return t*=this.itemSize,this.normalized&&(i=$n(i,this.array),s=$n(s,this.array)),this.array[t+0]=i,this.array[t+1]=s,this}setXYZ(t,i,s,l){return t*=this.itemSize,this.normalized&&(i=$n(i,this.array),s=$n(s,this.array),l=$n(l,this.array)),this.array[t+0]=i,this.array[t+1]=s,this.array[t+2]=l,this}setXYZW(t,i,s,l,c){return t*=this.itemSize,this.normalized&&(i=$n(i,this.array),s=$n(s,this.array),l=$n(l,this.array),c=$n(c,this.array)),this.array[t+0]=i,this.array[t+1]=s,this.array[t+2]=l,this.array[t+3]=c,this}onUpload(t){return this.onUploadCallback=t,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){const t={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(t.name=this.name),this.usage!==L_&&(t.usage=this.usage),t}dispose(){this.dispatchEvent({type:"dispose"})}}class ux extends Ti{constructor(t,i,s){super(new Uint16Array(t),i,s)}}class fx extends Ti{constructor(t,i,s){super(new Uint32Array(t),i,s)}}class ke extends Ti{constructor(t,i,s){super(new Float32Array(t),i,s)}}const y1=new er,tl=new V,jh=new V;class so{constructor(t=new V,i=-1){this.isSphere=!0,this.center=t,this.radius=i}set(t,i){return this.center.copy(t),this.radius=i,this}setFromPoints(t,i){const s=this.center;i!==void 0?s.copy(i):y1.setFromPoints(t).getCenter(s);let l=0;for(let c=0,f=t.length;c<f;c++)l=Math.max(l,s.distanceToSquared(t[c]));return this.radius=Math.sqrt(l),this}copy(t){return this.center.copy(t.center),this.radius=t.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(t){return t.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(t){return t.distanceTo(this.center)-this.radius}intersectsSphere(t){const i=this.radius+t.radius;return t.center.distanceToSquared(this.center)<=i*i}intersectsBox(t){return t.intersectsSphere(this)}intersectsPlane(t){return Math.abs(t.distanceToPoint(this.center))<=this.radius}clampPoint(t,i){const s=this.center.distanceToSquared(t);return i.copy(t),s>this.radius*this.radius&&(i.sub(this.center).normalize(),i.multiplyScalar(this.radius).add(this.center)),i}getBoundingBox(t){return this.isEmpty()?(t.makeEmpty(),t):(t.set(this.center,this.center),t.expandByScalar(this.radius),t)}applyMatrix4(t){return this.center.applyMatrix4(t),this.radius=this.radius*t.getMaxScaleOnAxis(),this}translate(t){return this.center.add(t),this}expandByPoint(t){if(this.isEmpty())return this.center.copy(t),this.radius=0,this;tl.subVectors(t,this.center);const i=tl.lengthSq();if(i>this.radius*this.radius){const s=Math.sqrt(i),l=(s-this.radius)*.5;this.center.addScaledVector(tl,l/s),this.radius+=l}return this}union(t){return t.isEmpty()?this:this.isEmpty()?(this.copy(t),this):(this.center.equals(t.center)===!0?this.radius=Math.max(this.radius,t.radius):(jh.subVectors(t.center,this.center).setLength(t.radius),this.expandByPoint(tl.copy(t.center).add(jh)),this.expandByPoint(tl.copy(t.center).sub(jh))),this)}equals(t){return t.center.equals(this.center)&&t.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(t){return this.radius=t.radius,this.center.fromArray(t.center),this}}let M1=0;const Pi=new Ve,$h=new Cn,kr=new V,yi=new er,el=new er,Bn=new V;class Ln extends tr{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:M1++}),this.uuid=io(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={},this._transformed=!1}getIndex(){return this.index}setIndex(t){return Array.isArray(t)?this.index=new(HM(t)?fx:ux)(t,1):this.index=t,this}setIndirect(t,i=0){return this.indirect=t,this.indirectOffset=i,this}getIndirect(){return this.indirect}getAttribute(t){return this.attributes[t]}setAttribute(t,i){return this.attributes[t]=i,this}deleteAttribute(t){return delete this.attributes[t],this}hasAttribute(t){return this.attributes[t]!==void 0}addGroup(t,i,s=0){this.groups.push({start:t,count:i,materialIndex:s})}clearGroups(){this.groups=[]}setDrawRange(t,i){this.drawRange.start=t,this.drawRange.count=i}applyMatrix4(t){const i=this.attributes.position;i!==void 0&&(i.applyMatrix4(t),i.needsUpdate=!0);const s=this.attributes.normal;if(s!==void 0){const c=new me().getNormalMatrix(t);s.applyNormalMatrix(c),s.needsUpdate=!0}const l=this.attributes.tangent;return l!==void 0&&(l.transformDirection(t),l.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this._transformed=!0,this}applyQuaternion(t){return Pi.makeRotationFromQuaternion(t),this.applyMatrix4(Pi),this}rotateX(t){return Pi.makeRotationX(t),this.applyMatrix4(Pi),this}rotateY(t){return Pi.makeRotationY(t),this.applyMatrix4(Pi),this}rotateZ(t){return Pi.makeRotationZ(t),this.applyMatrix4(Pi),this}translate(t,i,s){return Pi.makeTranslation(t,i,s),this.applyMatrix4(Pi),this}scale(t,i,s){return Pi.makeScale(t,i,s),this.applyMatrix4(Pi),this}lookAt(t){return $h.lookAt(t),$h.updateMatrix(),this.applyMatrix4($h.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(kr).negate(),this.translate(kr.x,kr.y,kr.z),this}setFromPoints(t){const i=this.getAttribute("position");if(i===void 0){const s=[];for(let l=0,c=t.length;l<c;l++){const f=t[l];s.push(f.x,f.y,f.z||0)}this.setAttribute("position",new ke(s,3))}else{const s=Math.min(t.length,i.count);for(let l=0;l<s;l++){const c=t[l];i.setXYZ(l,c.x,c.y,c.z||0)}t.length>i.count&&ue("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),i.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new er);const t=this.attributes.position,i=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){Oe("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new V(-1/0,-1/0,-1/0),new V(1/0,1/0,1/0));return}if(t!==void 0){if(this.boundingBox.setFromBufferAttribute(t),i)for(let s=0,l=i.length;s<l;s++){const c=i[s];yi.setFromBufferAttribute(c),this.morphTargetsRelative?(Bn.addVectors(this.boundingBox.min,yi.min),this.boundingBox.expandByPoint(Bn),Bn.addVectors(this.boundingBox.max,yi.max),this.boundingBox.expandByPoint(Bn)):(this.boundingBox.expandByPoint(yi.min),this.boundingBox.expandByPoint(yi.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&Oe('BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new so);const t=this.attributes.position,i=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){Oe("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new V,1/0);return}if(t){const s=this.boundingSphere.center;if(yi.setFromBufferAttribute(t),i)for(let c=0,f=i.length;c<f;c++){const d=i[c];el.setFromBufferAttribute(d),this.morphTargetsRelative?(Bn.addVectors(yi.min,el.min),yi.expandByPoint(Bn),Bn.addVectors(yi.max,el.max),yi.expandByPoint(Bn)):(yi.expandByPoint(el.min),yi.expandByPoint(el.max))}yi.getCenter(s);let l=0;for(let c=0,f=t.count;c<f;c++)Bn.fromBufferAttribute(t,c),l=Math.max(l,s.distanceToSquared(Bn));if(i)for(let c=0,f=i.length;c<f;c++){const d=i[c],m=this.morphTargetsRelative;for(let p=0,_=d.count;p<_;p++)Bn.fromBufferAttribute(d,p),m&&(kr.fromBufferAttribute(t,p),Bn.add(kr)),l=Math.max(l,s.distanceToSquared(Bn))}this.boundingSphere.radius=Math.sqrt(l),isNaN(this.boundingSphere.radius)&&Oe('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){const t=this.index,i=this.attributes;if(t===null||i.position===void 0||i.normal===void 0||i.uv===void 0){Oe("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}const s=i.position,l=i.normal,c=i.uv;let f=this.getAttribute("tangent");(f===void 0||f.count!==s.count)&&(f=new Ti(new Float32Array(4*s.count),4),this.setAttribute("tangent",f));const d=[],m=[];for(let E=0;E<s.count;E++)d[E]=new V,m[E]=new V;const p=new V,_=new V,v=new V,g=new ae,x=new ae,b=new ae,A=new V,M=new V;function S(E,D,F){p.fromBufferAttribute(s,E),_.fromBufferAttribute(s,D),v.fromBufferAttribute(s,F),g.fromBufferAttribute(c,E),x.fromBufferAttribute(c,D),b.fromBufferAttribute(c,F),_.sub(p),v.sub(p),x.sub(g),b.sub(g);const H=1/(x.x*b.y-b.x*x.y);isFinite(H)&&(A.copy(_).multiplyScalar(b.y).addScaledVector(v,-x.y).multiplyScalar(H),M.copy(v).multiplyScalar(x.x).addScaledVector(_,-b.x).multiplyScalar(H),d[E].add(A),d[D].add(A),d[F].add(A),m[E].add(M),m[D].add(M),m[F].add(M))}let O=this.groups;O.length===0&&(O=[{start:0,count:t.count}]);for(let E=0,D=O.length;E<D;++E){const F=O[E],H=F.start,X=F.count;for(let ct=H,ut=H+X;ct<ut;ct+=3)S(t.getX(ct+0),t.getX(ct+1),t.getX(ct+2))}const U=new V,w=new V,z=new V,N=new V;function L(E){z.fromBufferAttribute(l,E),N.copy(z);const D=d[E];U.copy(D),U.sub(z.multiplyScalar(z.dot(D))).normalize(),w.crossVectors(N,D);const H=w.dot(m[E])<0?-1:1;f.setXYZW(E,U.x,U.y,U.z,H)}for(let E=0,D=O.length;E<D;++E){const F=O[E],H=F.start,X=F.count;for(let ct=H,ut=H+X;ct<ut;ct+=3)L(t.getX(ct+0)),L(t.getX(ct+1)),L(t.getX(ct+2))}this._transformed=!0}computeVertexNormals(){const t=this.index,i=this.getAttribute("position");if(i!==void 0){let s=this.getAttribute("normal");if(s===void 0||s.count!==i.count)s=new Ti(new Float32Array(i.count*3),3),this.setAttribute("normal",s);else for(let g=0,x=s.count;g<x;g++)s.setXYZ(g,0,0,0);const l=new V,c=new V,f=new V,d=new V,m=new V,p=new V,_=new V,v=new V;if(t)for(let g=0,x=t.count;g<x;g+=3){const b=t.getX(g+0),A=t.getX(g+1),M=t.getX(g+2);l.fromBufferAttribute(i,b),c.fromBufferAttribute(i,A),f.fromBufferAttribute(i,M),_.subVectors(f,c),v.subVectors(l,c),_.cross(v),d.fromBufferAttribute(s,b),m.fromBufferAttribute(s,A),p.fromBufferAttribute(s,M),d.add(_),m.add(_),p.add(_),s.setXYZ(b,d.x,d.y,d.z),s.setXYZ(A,m.x,m.y,m.z),s.setXYZ(M,p.x,p.y,p.z)}else for(let g=0,x=i.count;g<x;g+=3)l.fromBufferAttribute(i,g+0),c.fromBufferAttribute(i,g+1),f.fromBufferAttribute(i,g+2),_.subVectors(f,c),v.subVectors(l,c),_.cross(v),s.setXYZ(g+0,_.x,_.y,_.z),s.setXYZ(g+1,_.x,_.y,_.z),s.setXYZ(g+2,_.x,_.y,_.z);this.normalizeNormals(),s.needsUpdate=!0}}normalizeNormals(){const t=this.attributes.normal;for(let i=0,s=t.count;i<s;i++)Bn.fromBufferAttribute(t,i),Bn.normalize(),t.setXYZ(i,Bn.x,Bn.y,Bn.z)}toNonIndexed(){function t(d,m){const p=d.array,_=d.itemSize,v=d.normalized,g=new p.constructor(m.length*_);let x=0,b=0;for(let A=0,M=m.length;A<M;A++){d.isInterleavedBufferAttribute?x=m[A]*d.data.stride+d.offset:x=m[A]*_;for(let S=0;S<_;S++)g[b++]=p[x++]}return new Ti(g,_,v)}if(this.index===null)return ue("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;const i=new Ln,s=this.index.array,l=this.attributes;for(const d in l){const m=l[d],p=t(m,s);i.setAttribute(d,p)}const c=this.morphAttributes;for(const d in c){const m=[],p=c[d];for(let _=0,v=p.length;_<v;_++){const g=p[_],x=t(g,s);m.push(x)}i.morphAttributes[d]=m}i.morphTargetsRelative=this.morphTargetsRelative;const f=this.groups;for(let d=0,m=f.length;d<m;d++){const p=f[d];i.addGroup(p.start,p.count,p.materialIndex)}return i}toJSON(){const t={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(t.uuid=this.uuid,t.type=this.parameters!==void 0&&this._transformed===!0?"BufferGeometry":this.type,this.name!==""&&(t.name=this.name),Object.keys(this.userData).length>0&&(t.userData=this.userData),this.parameters!==void 0&&this._transformed!==!0){const m=this.parameters;for(const p in m)m[p]!==void 0&&(t[p]=m[p]);return t}t.data={attributes:{}};const i=this.index;i!==null&&(t.data.index={type:i.array.constructor.name,array:Array.prototype.slice.call(i.array)});const s=this.attributes;for(const m in s){const p=s[m];t.data.attributes[m]=p.toJSON(t.data)}const l={};let c=!1;for(const m in this.morphAttributes){const p=this.morphAttributes[m],_=[];for(let v=0,g=p.length;v<g;v++){const x=p[v];_.push(x.toJSON(t.data))}_.length>0&&(l[m]=_,c=!0)}c&&(t.data.morphAttributes=l,t.data.morphTargetsRelative=this.morphTargetsRelative);const f=this.groups;f.length>0&&(t.data.groups=JSON.parse(JSON.stringify(f)));const d=this.boundingSphere;return d!==null&&(t.data.boundingSphere=d.toJSON()),t}clone(){return new this.constructor().copy(this)}copy(t){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;const i={};this.name=t.name;const s=t.index;s!==null&&this.setIndex(s.clone());const l=t.attributes;for(const p in l){const _=l[p];this.setAttribute(p,_.clone(i))}const c=t.morphAttributes;for(const p in c){const _=[],v=c[p];for(let g=0,x=v.length;g<x;g++)_.push(v[g].clone(i));this.morphAttributes[p]=_}this.morphTargetsRelative=t.morphTargetsRelative;const f=t.groups;for(let p=0,_=f.length;p<_;p++){const v=f[p];this.addGroup(v.start,v.count,v.materialIndex)}const d=t.boundingBox;d!==null&&(this.boundingBox=d.clone());const m=t.boundingSphere;return m!==null&&(this.boundingSphere=m.clone()),this.drawRange.start=t.drawRange.start,this.drawRange.count=t.drawRange.count,this.userData=t.userData,this._transformed=t._transformed,this}dispose(){this.dispatchEvent({type:"dispose"})}}let b1=0;class ro extends tr{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:b1++}),this.uuid=io(),this.name="",this.type="Material",this.blending=Jr,this.side=xs,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=vd,this.blendDst=xd,this.blendEquation=Xs,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new Re(0,0,0),this.blendAlpha=0,this.depthFunc=$r,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=N_,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Lr,this.stencilZFail=Lr,this.stencilZPass=Lr,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(t){this._alphaTest>0!=t>0&&this.version++,this._alphaTest=t}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(t){if(t!==void 0)for(const i in t){const s=t[i];if(s===void 0){ue(`Material: parameter '${i}' has value of undefined.`);continue}const l=this[i];if(l===void 0){ue(`Material: '${i}' is not a property of THREE.${this.type}.`);continue}l&&l.isColor?l.set(s):l&&l.isVector2&&s&&s.isVector2||l&&l.isEuler&&s&&s.isEuler||l&&l.isVector3&&s&&s.isVector3?l.copy(s):this[i]=s}}toJSON(t){const i=t===void 0||typeof t=="string";i&&(t={textures:{},images:{}});const s={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};s.uuid=this.uuid,s.type=this.type,this.name!==""&&(s.name=this.name),this.color&&this.color.isColor&&(s.color=this.color.getHex()),this.roughness!==void 0&&(s.roughness=this.roughness),this.metalness!==void 0&&(s.metalness=this.metalness),this.sheen!==void 0&&(s.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(s.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(s.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(s.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(s.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(s.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(s.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(s.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(s.shininess=this.shininess),this.clearcoat!==void 0&&(s.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(s.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(s.clearcoatMap=this.clearcoatMap.toJSON(t).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(s.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(t).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(s.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(t).uuid,s.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(s.sheenColorMap=this.sheenColorMap.toJSON(t).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(s.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(t).uuid),this.dispersion!==void 0&&(s.dispersion=this.dispersion),this.iridescence!==void 0&&(s.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(s.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(s.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(s.iridescenceMap=this.iridescenceMap.toJSON(t).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(s.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(t).uuid),this.anisotropy!==void 0&&(s.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(s.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(s.anisotropyMap=this.anisotropyMap.toJSON(t).uuid),this.map&&this.map.isTexture&&(s.map=this.map.toJSON(t).uuid),this.matcap&&this.matcap.isTexture&&(s.matcap=this.matcap.toJSON(t).uuid),this.alphaMap&&this.alphaMap.isTexture&&(s.alphaMap=this.alphaMap.toJSON(t).uuid),this.lightMap&&this.lightMap.isTexture&&(s.lightMap=this.lightMap.toJSON(t).uuid,s.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(s.aoMap=this.aoMap.toJSON(t).uuid,s.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(s.bumpMap=this.bumpMap.toJSON(t).uuid,s.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(s.normalMap=this.normalMap.toJSON(t).uuid,s.normalMapType=this.normalMapType,s.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(s.displacementMap=this.displacementMap.toJSON(t).uuid,s.displacementScale=this.displacementScale,s.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(s.roughnessMap=this.roughnessMap.toJSON(t).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(s.metalnessMap=this.metalnessMap.toJSON(t).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(s.emissiveMap=this.emissiveMap.toJSON(t).uuid),this.specularMap&&this.specularMap.isTexture&&(s.specularMap=this.specularMap.toJSON(t).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(s.specularIntensityMap=this.specularIntensityMap.toJSON(t).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(s.specularColorMap=this.specularColorMap.toJSON(t).uuid),this.envMap&&this.envMap.isTexture&&(s.envMap=this.envMap.toJSON(t).uuid,this.combine!==void 0&&(s.combine=this.combine)),this.envMapRotation!==void 0&&(s.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(s.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(s.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(s.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(s.gradientMap=this.gradientMap.toJSON(t).uuid),this.transmission!==void 0&&(s.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(s.transmissionMap=this.transmissionMap.toJSON(t).uuid),this.thickness!==void 0&&(s.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(s.thicknessMap=this.thicknessMap.toJSON(t).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(s.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(s.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(s.size=this.size),this.shadowSide!==null&&(s.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(s.sizeAttenuation=this.sizeAttenuation),this.blending!==Jr&&(s.blending=this.blending),this.side!==xs&&(s.side=this.side),this.vertexColors===!0&&(s.vertexColors=!0),this.opacity<1&&(s.opacity=this.opacity),this.transparent===!0&&(s.transparent=!0),this.blendSrc!==vd&&(s.blendSrc=this.blendSrc),this.blendDst!==xd&&(s.blendDst=this.blendDst),this.blendEquation!==Xs&&(s.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(s.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(s.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(s.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(s.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(s.blendAlpha=this.blendAlpha),this.depthFunc!==$r&&(s.depthFunc=this.depthFunc),this.depthTest===!1&&(s.depthTest=this.depthTest),this.depthWrite===!1&&(s.depthWrite=this.depthWrite),this.colorWrite===!1&&(s.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(s.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==N_&&(s.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(s.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(s.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==Lr&&(s.stencilFail=this.stencilFail),this.stencilZFail!==Lr&&(s.stencilZFail=this.stencilZFail),this.stencilZPass!==Lr&&(s.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(s.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(s.rotation=this.rotation),this.polygonOffset===!0&&(s.polygonOffset=!0),this.polygonOffsetFactor!==0&&(s.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(s.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(s.linewidth=this.linewidth),this.dashSize!==void 0&&(s.dashSize=this.dashSize),this.gapSize!==void 0&&(s.gapSize=this.gapSize),this.scale!==void 0&&(s.scale=this.scale),this.dithering===!0&&(s.dithering=!0),this.alphaTest>0&&(s.alphaTest=this.alphaTest),this.alphaHash===!0&&(s.alphaHash=!0),this.alphaToCoverage===!0&&(s.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(s.premultipliedAlpha=!0),this.forceSinglePass===!0&&(s.forceSinglePass=!0),this.allowOverride===!1&&(s.allowOverride=!1),this.wireframe===!0&&(s.wireframe=!0),this.wireframeLinewidth>1&&(s.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(s.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(s.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(s.flatShading=!0),this.visible===!1&&(s.visible=!1),this.toneMapped===!1&&(s.toneMapped=!1),this.fog===!1&&(s.fog=!1),Object.keys(this.userData).length>0&&(s.userData=this.userData);function l(c){const f=[];for(const d in c){const m=c[d];delete m.metadata,f.push(m)}return f}if(i){const c=l(t.textures),f=l(t.images);c.length>0&&(s.textures=c),f.length>0&&(s.images=f)}return s}fromJSON(t,i){if(t.uuid!==void 0&&(this.uuid=t.uuid),t.name!==void 0&&(this.name=t.name),t.color!==void 0&&this.color!==void 0&&this.color.setHex(t.color),t.roughness!==void 0&&(this.roughness=t.roughness),t.metalness!==void 0&&(this.metalness=t.metalness),t.sheen!==void 0&&(this.sheen=t.sheen),t.sheenColor!==void 0&&(this.sheenColor=new Re().setHex(t.sheenColor)),t.sheenRoughness!==void 0&&(this.sheenRoughness=t.sheenRoughness),t.emissive!==void 0&&this.emissive!==void 0&&this.emissive.setHex(t.emissive),t.specular!==void 0&&this.specular!==void 0&&this.specular.setHex(t.specular),t.specularIntensity!==void 0&&(this.specularIntensity=t.specularIntensity),t.specularColor!==void 0&&this.specularColor!==void 0&&this.specularColor.setHex(t.specularColor),t.shininess!==void 0&&(this.shininess=t.shininess),t.clearcoat!==void 0&&(this.clearcoat=t.clearcoat),t.clearcoatRoughness!==void 0&&(this.clearcoatRoughness=t.clearcoatRoughness),t.dispersion!==void 0&&(this.dispersion=t.dispersion),t.iridescence!==void 0&&(this.iridescence=t.iridescence),t.iridescenceIOR!==void 0&&(this.iridescenceIOR=t.iridescenceIOR),t.iridescenceThicknessRange!==void 0&&(this.iridescenceThicknessRange=t.iridescenceThicknessRange),t.transmission!==void 0&&(this.transmission=t.transmission),t.thickness!==void 0&&(this.thickness=t.thickness),t.attenuationDistance!==void 0&&(this.attenuationDistance=t.attenuationDistance),t.attenuationColor!==void 0&&this.attenuationColor!==void 0&&this.attenuationColor.setHex(t.attenuationColor),t.anisotropy!==void 0&&(this.anisotropy=t.anisotropy),t.anisotropyRotation!==void 0&&(this.anisotropyRotation=t.anisotropyRotation),t.fog!==void 0&&(this.fog=t.fog),t.flatShading!==void 0&&(this.flatShading=t.flatShading),t.blending!==void 0&&(this.blending=t.blending),t.combine!==void 0&&(this.combine=t.combine),t.side!==void 0&&(this.side=t.side),t.shadowSide!==void 0&&(this.shadowSide=t.shadowSide),t.opacity!==void 0&&(this.opacity=t.opacity),t.transparent!==void 0&&(this.transparent=t.transparent),t.alphaTest!==void 0&&(this.alphaTest=t.alphaTest),t.alphaHash!==void 0&&(this.alphaHash=t.alphaHash),t.depthFunc!==void 0&&(this.depthFunc=t.depthFunc),t.depthTest!==void 0&&(this.depthTest=t.depthTest),t.depthWrite!==void 0&&(this.depthWrite=t.depthWrite),t.colorWrite!==void 0&&(this.colorWrite=t.colorWrite),t.blendSrc!==void 0&&(this.blendSrc=t.blendSrc),t.blendDst!==void 0&&(this.blendDst=t.blendDst),t.blendEquation!==void 0&&(this.blendEquation=t.blendEquation),t.blendSrcAlpha!==void 0&&(this.blendSrcAlpha=t.blendSrcAlpha),t.blendDstAlpha!==void 0&&(this.blendDstAlpha=t.blendDstAlpha),t.blendEquationAlpha!==void 0&&(this.blendEquationAlpha=t.blendEquationAlpha),t.blendColor!==void 0&&this.blendColor!==void 0&&this.blendColor.setHex(t.blendColor),t.blendAlpha!==void 0&&(this.blendAlpha=t.blendAlpha),t.stencilWriteMask!==void 0&&(this.stencilWriteMask=t.stencilWriteMask),t.stencilFunc!==void 0&&(this.stencilFunc=t.stencilFunc),t.stencilRef!==void 0&&(this.stencilRef=t.stencilRef),t.stencilFuncMask!==void 0&&(this.stencilFuncMask=t.stencilFuncMask),t.stencilFail!==void 0&&(this.stencilFail=t.stencilFail),t.stencilZFail!==void 0&&(this.stencilZFail=t.stencilZFail),t.stencilZPass!==void 0&&(this.stencilZPass=t.stencilZPass),t.stencilWrite!==void 0&&(this.stencilWrite=t.stencilWrite),t.wireframe!==void 0&&(this.wireframe=t.wireframe),t.wireframeLinewidth!==void 0&&(this.wireframeLinewidth=t.wireframeLinewidth),t.wireframeLinecap!==void 0&&(this.wireframeLinecap=t.wireframeLinecap),t.wireframeLinejoin!==void 0&&(this.wireframeLinejoin=t.wireframeLinejoin),t.rotation!==void 0&&(this.rotation=t.rotation),t.linewidth!==void 0&&(this.linewidth=t.linewidth),t.dashSize!==void 0&&(this.dashSize=t.dashSize),t.gapSize!==void 0&&(this.gapSize=t.gapSize),t.scale!==void 0&&(this.scale=t.scale),t.polygonOffset!==void 0&&(this.polygonOffset=t.polygonOffset),t.polygonOffsetFactor!==void 0&&(this.polygonOffsetFactor=t.polygonOffsetFactor),t.polygonOffsetUnits!==void 0&&(this.polygonOffsetUnits=t.polygonOffsetUnits),t.dithering!==void 0&&(this.dithering=t.dithering),t.alphaToCoverage!==void 0&&(this.alphaToCoverage=t.alphaToCoverage),t.premultipliedAlpha!==void 0&&(this.premultipliedAlpha=t.premultipliedAlpha),t.forceSinglePass!==void 0&&(this.forceSinglePass=t.forceSinglePass),t.allowOverride!==void 0&&(this.allowOverride=t.allowOverride),t.visible!==void 0&&(this.visible=t.visible),t.toneMapped!==void 0&&(this.toneMapped=t.toneMapped),t.userData!==void 0&&(this.userData=t.userData),t.vertexColors!==void 0&&(typeof t.vertexColors=="number"?this.vertexColors=t.vertexColors>0:this.vertexColors=t.vertexColors),t.size!==void 0&&(this.size=t.size),t.sizeAttenuation!==void 0&&(this.sizeAttenuation=t.sizeAttenuation),t.map!==void 0&&(this.map=i[t.map]||null),t.matcap!==void 0&&(this.matcap=i[t.matcap]||null),t.alphaMap!==void 0&&(this.alphaMap=i[t.alphaMap]||null),t.bumpMap!==void 0&&(this.bumpMap=i[t.bumpMap]||null),t.bumpScale!==void 0&&(this.bumpScale=t.bumpScale),t.normalMap!==void 0&&(this.normalMap=i[t.normalMap]||null),t.normalMapType!==void 0&&(this.normalMapType=t.normalMapType),t.normalScale!==void 0){let s=t.normalScale;Array.isArray(s)===!1&&(s=[s,s]),this.normalScale=new ae().fromArray(s)}return t.displacementMap!==void 0&&(this.displacementMap=i[t.displacementMap]||null),t.displacementScale!==void 0&&(this.displacementScale=t.displacementScale),t.displacementBias!==void 0&&(this.displacementBias=t.displacementBias),t.roughnessMap!==void 0&&(this.roughnessMap=i[t.roughnessMap]||null),t.metalnessMap!==void 0&&(this.metalnessMap=i[t.metalnessMap]||null),t.emissiveMap!==void 0&&(this.emissiveMap=i[t.emissiveMap]||null),t.emissiveIntensity!==void 0&&(this.emissiveIntensity=t.emissiveIntensity),t.specularMap!==void 0&&(this.specularMap=i[t.specularMap]||null),t.specularIntensityMap!==void 0&&(this.specularIntensityMap=i[t.specularIntensityMap]||null),t.specularColorMap!==void 0&&(this.specularColorMap=i[t.specularColorMap]||null),t.envMap!==void 0&&(this.envMap=i[t.envMap]||null),t.envMapRotation!==void 0&&this.envMapRotation.fromArray(t.envMapRotation),t.envMapIntensity!==void 0&&(this.envMapIntensity=t.envMapIntensity),t.reflectivity!==void 0&&(this.reflectivity=t.reflectivity),t.refractionRatio!==void 0&&(this.refractionRatio=t.refractionRatio),t.lightMap!==void 0&&(this.lightMap=i[t.lightMap]||null),t.lightMapIntensity!==void 0&&(this.lightMapIntensity=t.lightMapIntensity),t.aoMap!==void 0&&(this.aoMap=i[t.aoMap]||null),t.aoMapIntensity!==void 0&&(this.aoMapIntensity=t.aoMapIntensity),t.gradientMap!==void 0&&(this.gradientMap=i[t.gradientMap]||null),t.clearcoatMap!==void 0&&(this.clearcoatMap=i[t.clearcoatMap]||null),t.clearcoatRoughnessMap!==void 0&&(this.clearcoatRoughnessMap=i[t.clearcoatRoughnessMap]||null),t.clearcoatNormalMap!==void 0&&(this.clearcoatNormalMap=i[t.clearcoatNormalMap]||null),t.clearcoatNormalScale!==void 0&&(this.clearcoatNormalScale=new ae().fromArray(t.clearcoatNormalScale)),t.iridescenceMap!==void 0&&(this.iridescenceMap=i[t.iridescenceMap]||null),t.iridescenceThicknessMap!==void 0&&(this.iridescenceThicknessMap=i[t.iridescenceThicknessMap]||null),t.transmissionMap!==void 0&&(this.transmissionMap=i[t.transmissionMap]||null),t.thicknessMap!==void 0&&(this.thicknessMap=i[t.thicknessMap]||null),t.anisotropyMap!==void 0&&(this.anisotropyMap=i[t.anisotropyMap]||null),t.sheenColorMap!==void 0&&(this.sheenColorMap=i[t.sheenColorMap]||null),t.sheenRoughnessMap!==void 0&&(this.sheenRoughnessMap=i[t.sheenRoughnessMap]||null),this}clone(){return new this.constructor().copy(this)}copy(t){this.name=t.name,this.blending=t.blending,this.side=t.side,this.vertexColors=t.vertexColors,this.opacity=t.opacity,this.transparent=t.transparent,this.blendSrc=t.blendSrc,this.blendDst=t.blendDst,this.blendEquation=t.blendEquation,this.blendSrcAlpha=t.blendSrcAlpha,this.blendDstAlpha=t.blendDstAlpha,this.blendEquationAlpha=t.blendEquationAlpha,this.blendColor.copy(t.blendColor),this.blendAlpha=t.blendAlpha,this.depthFunc=t.depthFunc,this.depthTest=t.depthTest,this.depthWrite=t.depthWrite,this.stencilWriteMask=t.stencilWriteMask,this.stencilFunc=t.stencilFunc,this.stencilRef=t.stencilRef,this.stencilFuncMask=t.stencilFuncMask,this.stencilFail=t.stencilFail,this.stencilZFail=t.stencilZFail,this.stencilZPass=t.stencilZPass,this.stencilWrite=t.stencilWrite;const i=t.clippingPlanes;let s=null;if(i!==null){const l=i.length;s=new Array(l);for(let c=0;c!==l;++c)s[c]=i[c].clone()}return this.clippingPlanes=s,this.clipIntersection=t.clipIntersection,this.clipShadows=t.clipShadows,this.shadowSide=t.shadowSide,this.colorWrite=t.colorWrite,this.precision=t.precision,this.polygonOffset=t.polygonOffset,this.polygonOffsetFactor=t.polygonOffsetFactor,this.polygonOffsetUnits=t.polygonOffsetUnits,this.dithering=t.dithering,this.alphaTest=t.alphaTest,this.alphaHash=t.alphaHash,this.alphaToCoverage=t.alphaToCoverage,this.premultipliedAlpha=t.premultipliedAlpha,this.forceSinglePass=t.forceSinglePass,this.allowOverride=t.allowOverride,this.visible=t.visible,this.toneMapped=t.toneMapped,this.userData=JSON.parse(JSON.stringify(t.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(t){t===!0&&this.version++}}const Ua=new V,td=new V,Hc=new V,ms=new V,ed=new V,Gc=new V,nd=new V;class hx{constructor(t=new V,i=new V(0,0,-1)){this.origin=t,this.direction=i}set(t,i){return this.origin.copy(t),this.direction.copy(i),this}copy(t){return this.origin.copy(t.origin),this.direction.copy(t.direction),this}at(t,i){return i.copy(this.origin).addScaledVector(this.direction,t)}lookAt(t){return this.direction.copy(t).sub(this.origin).normalize(),this}recast(t){return this.origin.copy(this.at(t,Ua)),this}closestPointToPoint(t,i){i.subVectors(t,this.origin);const s=i.dot(this.direction);return s<0?i.copy(this.origin):i.copy(this.origin).addScaledVector(this.direction,s)}distanceToPoint(t){return Math.sqrt(this.distanceSqToPoint(t))}distanceSqToPoint(t){const i=Ua.subVectors(t,this.origin).dot(this.direction);return i<0?this.origin.distanceToSquared(t):(Ua.copy(this.origin).addScaledVector(this.direction,i),Ua.distanceToSquared(t))}distanceSqToSegment(t,i,s,l){td.copy(t).add(i).multiplyScalar(.5),Hc.copy(i).sub(t).normalize(),ms.copy(this.origin).sub(td);const c=t.distanceTo(i)*.5,f=-this.direction.dot(Hc),d=ms.dot(this.direction),m=-ms.dot(Hc),p=ms.lengthSq(),_=Math.abs(1-f*f);let v,g,x,b;if(_>0)if(v=f*m-d,g=f*d-m,b=c*_,v>=0)if(g>=-b)if(g<=b){const A=1/_;v*=A,g*=A,x=v*(v+f*g+2*d)+g*(f*v+g+2*m)+p}else g=c,v=Math.max(0,-(f*g+d)),x=-v*v+g*(g+2*m)+p;else g=-c,v=Math.max(0,-(f*g+d)),x=-v*v+g*(g+2*m)+p;else g<=-b?(v=Math.max(0,-(-f*c+d)),g=v>0?-c:Math.min(Math.max(-c,-m),c),x=-v*v+g*(g+2*m)+p):g<=b?(v=0,g=Math.min(Math.max(-c,-m),c),x=g*(g+2*m)+p):(v=Math.max(0,-(f*c+d)),g=v>0?c:Math.min(Math.max(-c,-m),c),x=-v*v+g*(g+2*m)+p);else g=f>0?-c:c,v=Math.max(0,-(f*g+d)),x=-v*v+g*(g+2*m)+p;return s&&s.copy(this.origin).addScaledVector(this.direction,v),l&&l.copy(td).addScaledVector(Hc,g),x}intersectSphere(t,i){Ua.subVectors(t.center,this.origin);const s=Ua.dot(this.direction),l=Ua.dot(Ua)-s*s,c=t.radius*t.radius;if(l>c)return null;const f=Math.sqrt(c-l),d=s-f,m=s+f;return m<0?null:d<0?this.at(m,i):this.at(d,i)}intersectsSphere(t){return t.radius<0?!1:this.distanceSqToPoint(t.center)<=t.radius*t.radius}distanceToPlane(t){const i=t.normal.dot(this.direction);if(i===0)return t.distanceToPoint(this.origin)===0?0:null;const s=-(this.origin.dot(t.normal)+t.constant)/i;return s>=0?s:null}intersectPlane(t,i){const s=this.distanceToPlane(t);return s===null?null:this.at(s,i)}intersectsPlane(t){const i=t.distanceToPoint(this.origin);return i===0||t.normal.dot(this.direction)*i<0}intersectBox(t,i){let s,l,c,f,d,m;const p=1/this.direction.x,_=1/this.direction.y,v=1/this.direction.z,g=this.origin;return p>=0?(s=(t.min.x-g.x)*p,l=(t.max.x-g.x)*p):(s=(t.max.x-g.x)*p,l=(t.min.x-g.x)*p),_>=0?(c=(t.min.y-g.y)*_,f=(t.max.y-g.y)*_):(c=(t.max.y-g.y)*_,f=(t.min.y-g.y)*_),s>f||c>l||((c>s||isNaN(s))&&(s=c),(f<l||isNaN(l))&&(l=f),v>=0?(d=(t.min.z-g.z)*v,m=(t.max.z-g.z)*v):(d=(t.max.z-g.z)*v,m=(t.min.z-g.z)*v),s>m||d>l)||((d>s||s!==s)&&(s=d),(m<l||l!==l)&&(l=m),l<0)?null:this.at(s>=0?s:l,i)}intersectsBox(t){return this.intersectBox(t,Ua)!==null}intersectTriangle(t,i,s,l,c){ed.subVectors(i,t),Gc.subVectors(s,t),nd.crossVectors(ed,Gc);let f=this.direction.dot(nd),d;if(f>0){if(l)return null;d=1}else if(f<0)d=-1,f=-f;else return null;ms.subVectors(this.origin,t);const m=d*this.direction.dot(Gc.crossVectors(ms,Gc));if(m<0)return null;const p=d*this.direction.dot(ed.cross(ms));if(p<0||m+p>f)return null;const _=-d*ms.dot(nd);return _<0?null:this.at(_/f,c)}applyMatrix4(t){return this.origin.applyMatrix4(t),this.direction.transformDirection(t),this}equals(t){return t.origin.equals(this.origin)&&t.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}}class gu extends ro{constructor(t){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new Re(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Ss,this.combine=qv,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.specularMap=t.specularMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.combine=t.combine,this.reflectivity=t.reflectivity,this.refractionRatio=t.refractionRatio,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.fog=t.fog,this}}const K_=new Ve,Gs=new hx,Vc=new so,J_=new V,kc=new V,Xc=new V,Wc=new V,id=new V,qc=new V,Q_=new V,Yc=new V;class ie extends Cn{constructor(t=new Ln,i=new gu){super(),this.isMesh=!0,this.type="Mesh",this.geometry=t,this.material=i,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(t,i){return super.copy(t,i),t.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=t.morphTargetInfluences.slice()),t.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},t.morphTargetDictionary)),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}updateMorphTargets(){const i=this.geometry.morphAttributes,s=Object.keys(i);if(s.length>0){const l=i[s[0]];if(l!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let c=0,f=l.length;c<f;c++){const d=l[c].name||String(c);this.morphTargetInfluences.push(0),this.morphTargetDictionary[d]=c}}}}getVertexPosition(t,i){const s=this.geometry,l=s.attributes.position,c=s.morphAttributes.position,f=s.morphTargetsRelative;i.fromBufferAttribute(l,t);const d=this.morphTargetInfluences;if(c&&d){qc.set(0,0,0);for(let m=0,p=c.length;m<p;m++){const _=d[m],v=c[m];_!==0&&(id.fromBufferAttribute(v,t),f?qc.addScaledVector(id,_):qc.addScaledVector(id.sub(i),_))}i.add(qc)}return i}raycast(t,i){const s=this.geometry,l=this.material,c=this.matrixWorld;l!==void 0&&(s.boundingSphere===null&&s.computeBoundingSphere(),Vc.copy(s.boundingSphere),Vc.applyMatrix4(c),Gs.copy(t.ray).recast(t.near),!(Vc.containsPoint(Gs.origin)===!1&&(Gs.intersectSphere(Vc,J_)===null||Gs.origin.distanceToSquared(J_)>(t.far-t.near)**2))&&(K_.copy(c).invert(),Gs.copy(t.ray).applyMatrix4(K_),!(s.boundingBox!==null&&Gs.intersectsBox(s.boundingBox)===!1)&&this._computeIntersections(t,i,Gs)))}_computeIntersections(t,i,s){let l;const c=this.geometry,f=this.material,d=c.index,m=c.attributes.position,p=c.attributes.uv,_=c.attributes.uv1,v=c.attributes.normal,g=c.groups,x=c.drawRange;if(d!==null)if(Array.isArray(f))for(let b=0,A=g.length;b<A;b++){const M=g[b],S=f[M.materialIndex],O=Math.max(M.start,x.start),U=Math.min(d.count,Math.min(M.start+M.count,x.start+x.count));for(let w=O,z=U;w<z;w+=3){const N=d.getX(w),L=d.getX(w+1),E=d.getX(w+2);l=Zc(this,S,t,s,p,_,v,N,L,E),l&&(l.faceIndex=Math.floor(w/3),l.face.materialIndex=M.materialIndex,i.push(l))}}else{const b=Math.max(0,x.start),A=Math.min(d.count,x.start+x.count);for(let M=b,S=A;M<S;M+=3){const O=d.getX(M),U=d.getX(M+1),w=d.getX(M+2);l=Zc(this,f,t,s,p,_,v,O,U,w),l&&(l.faceIndex=Math.floor(M/3),i.push(l))}}else if(m!==void 0)if(Array.isArray(f))for(let b=0,A=g.length;b<A;b++){const M=g[b],S=f[M.materialIndex],O=Math.max(M.start,x.start),U=Math.min(m.count,Math.min(M.start+M.count,x.start+x.count));for(let w=O,z=U;w<z;w+=3){const N=w,L=w+1,E=w+2;l=Zc(this,S,t,s,p,_,v,N,L,E),l&&(l.faceIndex=Math.floor(w/3),l.face.materialIndex=M.materialIndex,i.push(l))}}else{const b=Math.max(0,x.start),A=Math.min(m.count,x.start+x.count);for(let M=b,S=A;M<S;M+=3){const O=M,U=M+1,w=M+2;l=Zc(this,f,t,s,p,_,v,O,U,w),l&&(l.faceIndex=Math.floor(M/3),i.push(l))}}}}function E1(r,t,i,s,l,c,f,d){let m;if(t.side===ni?m=s.intersectTriangle(f,c,l,!0,d):m=s.intersectTriangle(l,c,f,t.side===xs,d),m===null)return null;Yc.copy(d),Yc.applyMatrix4(r.matrixWorld);const p=i.ray.origin.distanceTo(Yc);return p<i.near||p>i.far?null:{distance:p,point:Yc.clone(),object:r}}function Zc(r,t,i,s,l,c,f,d,m,p){r.getVertexPosition(d,kc),r.getVertexPosition(m,Xc),r.getVertexPosition(p,Wc);const _=E1(r,t,i,s,kc,Xc,Wc,Q_);if(_){const v=new V;Xi.getBarycoord(Q_,kc,Xc,Wc,v),l&&(_.uv=Xi.getInterpolatedAttribute(l,d,m,p,v,new ae)),c&&(_.uv1=Xi.getInterpolatedAttribute(c,d,m,p,v,new ae)),f&&(_.normal=Xi.getInterpolatedAttribute(f,d,m,p,v,new V),_.normal.dot(s.direction)>0&&_.normal.multiplyScalar(-1));const g={a:d,b:m,c:p,normal:new V,materialIndex:0};Xi.getNormal(kc,Xc,Wc,g.normal),_.face=g,_.barycoord=v}return _}class dx extends kn{constructor(t=null,i=1,s=1,l,c,f,d,m,p=Vn,_=Vn,v,g){super(null,f,d,m,p,_,l,c,v,g),this.isDataTexture=!0,this.image={data:t,width:i,height:s},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class j_ extends Ti{constructor(t,i,s,l=1){super(t,i,s),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=l}copy(t){return super.copy(t),this.meshPerAttribute=t.meshPerAttribute,this}toJSON(){const t=super.toJSON();return t.meshPerAttribute=this.meshPerAttribute,t.isInstancedBufferAttribute=!0,t}}const Xr=new Ve,$_=new Ve,Kc=[],tv=new er,T1=new Ve,nl=new ie,il=new so;class Ks extends ie{constructor(t,i,s){super(t,i),this.isInstancedMesh=!0,this.instanceMatrix=new j_(new Float32Array(s*16),16),this.instanceColor=null,this.morphTexture=null,this.count=s,this.boundingBox=null,this.boundingSphere=null;for(let l=0;l<s;l++)this.setMatrixAt(l,T1)}computeBoundingBox(){const t=this.geometry,i=this.count;this.boundingBox===null&&(this.boundingBox=new er),t.boundingBox===null&&t.computeBoundingBox(),this.boundingBox.makeEmpty();for(let s=0;s<i;s++)this.getMatrixAt(s,Xr),tv.copy(t.boundingBox).applyMatrix4(Xr),this.boundingBox.union(tv)}computeBoundingSphere(){const t=this.geometry,i=this.count;this.boundingSphere===null&&(this.boundingSphere=new so),t.boundingSphere===null&&t.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let s=0;s<i;s++)this.getMatrixAt(s,Xr),il.copy(t.boundingSphere).applyMatrix4(Xr),this.boundingSphere.union(il)}copy(t,i){return super.copy(t,i),this.instanceMatrix.copy(t.instanceMatrix),t.morphTexture!==null&&(this.morphTexture=t.morphTexture.clone()),t.instanceColor!==null&&(this.instanceColor=t.instanceColor.clone()),this.count=t.count,t.boundingBox!==null&&(this.boundingBox=t.boundingBox.clone()),t.boundingSphere!==null&&(this.boundingSphere=t.boundingSphere.clone()),this}getColorAt(t,i){return this.instanceColor===null?i.setRGB(1,1,1):i.fromArray(this.instanceColor.array,t*3)}getMatrixAt(t,i){return i.fromArray(this.instanceMatrix.array,t*16)}getMorphAt(t,i){const s=i.morphTargetInfluences,l=this.morphTexture.source.data.data,c=s.length+1,f=t*c+1;for(let d=0;d<s.length;d++)s[d]=l[f+d]}raycast(t,i){const s=this.matrixWorld,l=this.count;if(nl.geometry=this.geometry,nl.material=this.material,nl.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),il.copy(this.boundingSphere),il.applyMatrix4(s),t.ray.intersectsSphere(il)!==!1))for(let c=0;c<l;c++){this.getMatrixAt(c,Xr),$_.multiplyMatrices(s,Xr),nl.matrixWorld=$_,nl.raycast(t,Kc);for(let f=0,d=Kc.length;f<d;f++){const m=Kc[f];m.instanceId=c,m.object=this,i.push(m)}Kc.length=0}}setColorAt(t,i){return this.instanceColor===null&&(this.instanceColor=new j_(new Float32Array(this.instanceMatrix.count*3).fill(1),3)),i.toArray(this.instanceColor.array,t*3),this}setMatrixAt(t,i){return i.toArray(this.instanceMatrix.array,t*16),this}setMorphAt(t,i){const s=i.morphTargetInfluences,l=s.length+1;this.morphTexture===null&&(this.morphTexture=new dx(new Float32Array(l*this.count),l,this.count,_p,Wi));const c=this.morphTexture.source.data.data;let f=0;for(let p=0;p<s.length;p++)f+=s[p];const d=this.geometry.morphTargetsRelative?1:1-f,m=l*t;return c[m]=d,c.set(s,m+1),this}updateMorphTargets(){}dispose(){this.dispatchEvent({type:"dispose"}),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null)}}const ad=new V,A1=new V,w1=new me;class ks{constructor(t=new V(1,0,0),i=0){this.isPlane=!0,this.normal=t,this.constant=i}set(t,i){return this.normal.copy(t),this.constant=i,this}setComponents(t,i,s,l){return this.normal.set(t,i,s),this.constant=l,this}setFromNormalAndCoplanarPoint(t,i){return this.normal.copy(t),this.constant=-i.dot(this.normal),this}setFromCoplanarPoints(t,i,s){const l=ad.subVectors(s,i).cross(A1.subVectors(t,i)).normalize();return this.setFromNormalAndCoplanarPoint(l,t),this}copy(t){return this.normal.copy(t.normal),this.constant=t.constant,this}normalize(){const t=1/this.normal.length();return this.normal.multiplyScalar(t),this.constant*=t,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(t){return this.normal.dot(t)+this.constant}distanceToSphere(t){return this.distanceToPoint(t.center)-t.radius}projectPoint(t,i){return i.copy(t).addScaledVector(this.normal,-this.distanceToPoint(t))}intersectLine(t,i,s=!0){const l=t.delta(ad),c=this.normal.dot(l);if(c===0)return this.distanceToPoint(t.start)===0?i.copy(t.start):null;const f=-(t.start.dot(this.normal)+this.constant)/c;return s===!0&&(f<0||f>1)?null:i.copy(t.start).addScaledVector(l,f)}intersectsLine(t){const i=this.distanceToPoint(t.start),s=this.distanceToPoint(t.end);return i<0&&s>0||s<0&&i>0}intersectsBox(t){return t.intersectsPlane(this)}intersectsSphere(t){return t.intersectsPlane(this)}coplanarPoint(t){return t.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(t,i){const s=i||w1.getNormalMatrix(t),l=this.coplanarPoint(ad).applyMatrix4(t),c=this.normal.applyMatrix3(s).normalize();return this.constant=-l.dot(c),this}translate(t){return this.constant-=t.dot(this.normal),this}equals(t){return t.normal.equals(this.normal)&&t.constant===this.constant}clone(){return new this.constructor().copy(this)}}const Vs=new so,R1=new ae(.5,.5),Jc=new V;class Ap{constructor(t=new ks,i=new ks,s=new ks,l=new ks,c=new ks,f=new ks){this.planes=[t,i,s,l,c,f]}set(t,i,s,l,c,f){const d=this.planes;return d[0].copy(t),d[1].copy(i),d[2].copy(s),d[3].copy(l),d[4].copy(c),d[5].copy(f),this}copy(t){const i=this.planes;for(let s=0;s<6;s++)i[s].copy(t.planes[s]);return this}setFromProjectionMatrix(t,i=ea,s=!1){const l=this.planes,c=t.elements,f=c[0],d=c[1],m=c[2],p=c[3],_=c[4],v=c[5],g=c[6],x=c[7],b=c[8],A=c[9],M=c[10],S=c[11],O=c[12],U=c[13],w=c[14],z=c[15];if(l[0].setComponents(p-f,x-_,S-b,z-O).normalize(),l[1].setComponents(p+f,x+_,S+b,z+O).normalize(),l[2].setComponents(p+d,x+v,S+A,z+U).normalize(),l[3].setComponents(p-d,x-v,S-A,z-U).normalize(),s)l[4].setComponents(m,g,M,w).normalize(),l[5].setComponents(p-m,x-g,S-M,z-w).normalize();else if(l[4].setComponents(p-m,x-g,S-M,z-w).normalize(),i===ea)l[5].setComponents(p+m,x+g,S+M,z+w).normalize();else if(i===Sl)l[5].setComponents(m,g,M,w).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+i);return this}intersectsObject(t){if(t.boundingSphere!==void 0)t.boundingSphere===null&&t.computeBoundingSphere(),Vs.copy(t.boundingSphere).applyMatrix4(t.matrixWorld);else{const i=t.geometry;i.boundingSphere===null&&i.computeBoundingSphere(),Vs.copy(i.boundingSphere).applyMatrix4(t.matrixWorld)}return this.intersectsSphere(Vs)}intersectsSprite(t){Vs.center.set(0,0,0);const i=R1.distanceTo(t.center);return Vs.radius=.7071067811865476+i,Vs.applyMatrix4(t.matrixWorld),this.intersectsSphere(Vs)}intersectsSphere(t){const i=this.planes,s=t.center,l=-t.radius;for(let c=0;c<6;c++)if(i[c].distanceToPoint(s)<l)return!1;return!0}intersectsBox(t){const i=this.planes;for(let s=0;s<6;s++){const l=i[s];if(Jc.x=l.normal.x>0?t.max.x:t.min.x,Jc.y=l.normal.y>0?t.max.y:t.min.y,Jc.z=l.normal.z>0?t.max.z:t.min.z,l.distanceToPoint(Jc)<0)return!1}return!0}containsPoint(t){const i=this.planes;for(let s=0;s<6;s++)if(i[s].distanceToPoint(t)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}}class sp extends ro{constructor(t){super(),this.isPointsMaterial=!0,this.type="PointsMaterial",this.color=new Re(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.alphaMap=t.alphaMap,this.size=t.size,this.sizeAttenuation=t.sizeAttenuation,this.fog=t.fog,this}}const ev=new Ve,rp=new hx,Qc=new so,jc=new V;class nv extends Cn{constructor(t=new Ln,i=new sp){super(),this.isPoints=!0,this.type="Points",this.geometry=t,this.material=i,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(t,i){return super.copy(t,i),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}raycast(t,i){const s=this.geometry,l=this.matrixWorld,c=t.params.Points.threshold,f=s.drawRange;if(s.boundingSphere===null&&s.computeBoundingSphere(),Qc.copy(s.boundingSphere),Qc.applyMatrix4(l),Qc.radius+=c,t.ray.intersectsSphere(Qc)===!1)return;ev.copy(l).invert(),rp.copy(t.ray).applyMatrix4(ev);const d=c/((this.scale.x+this.scale.y+this.scale.z)/3),m=d*d,p=s.index,v=s.attributes.position;if(p!==null){const g=Math.max(0,f.start),x=Math.min(p.count,f.start+f.count);for(let b=g,A=x;b<A;b++){const M=p.getX(b);jc.fromBufferAttribute(v,M),iv(jc,M,m,l,t,i,this)}}else{const g=Math.max(0,f.start),x=Math.min(v.count,f.start+f.count);for(let b=g,A=x;b<A;b++)jc.fromBufferAttribute(v,b),iv(jc,b,m,l,t,i,this)}}updateMorphTargets(){const i=this.geometry.morphAttributes,s=Object.keys(i);if(s.length>0){const l=i[s[0]];if(l!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let c=0,f=l.length;c<f;c++){const d=l[c].name||String(c);this.morphTargetInfluences.push(0),this.morphTargetDictionary[d]=c}}}}}function iv(r,t,i,s,l,c,f){const d=rp.distanceSqToPoint(r);if(d<i){const m=new V;rp.closestPointToPoint(r,m),m.applyMatrix4(s);const p=l.ray.origin.distanceTo(m);if(p<l.near||p>l.far)return;c.push({distance:p,distanceToRay:Math.sqrt(d),point:m,index:t,face:null,faceIndex:null,barycoord:null,object:f})}}class px extends kn{constructor(t=[],i=Qs,s,l,c,f,d,m,p,_){super(t,i,s,l,c,f,d,m,p,_),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(t){this.image=t}}class C1 extends kn{constructor(t,i,s,l,c,f,d,m,p){super(t,i,s,l,c,f,d,m,p),this.isCanvasTexture=!0,this.needsUpdate=!0}}class eo extends kn{constructor(t,i,s=sa,l,c,f,d=Vn,m=Vn,p,_=Ba,v=1){if(_!==Ba&&_!==Ys)throw new Error("THREE.DepthTexture: format must be either THREE.DepthFormat or THREE.DepthStencilFormat");const g={width:t,height:i,depth:v};super(g,l,c,f,d,m,_,s,p),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(t){return super.copy(t),this.source=new Ep(Object.assign({},t.image)),this.compareFunction=t.compareFunction,this}toJSON(t){const i=super.toJSON(t);return this.compareFunction!==null&&(i.compareFunction=this.compareFunction),i}}class D1 extends eo{constructor(t,i=sa,s=Qs,l,c,f=Vn,d=Vn,m,p=Ba){const _={width:t,height:t,depth:1},v=[_,_,_,_,_,_];super(t,t,i,s,l,c,f,d,m,p),this.image=v,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(t){this.image=t}}class mx extends kn{constructor(t=null){super(),this.sourceTexture=t,this.isExternalTexture=!0}copy(t){return super.copy(t),this.sourceTexture=t.sourceTexture,this}}class cn extends Ln{constructor(t=1,i=1,s=1,l=1,c=1,f=1){super(),this.type="BoxGeometry",this.parameters={width:t,height:i,depth:s,widthSegments:l,heightSegments:c,depthSegments:f};const d=this;l=Math.floor(l),c=Math.floor(c),f=Math.floor(f);const m=[],p=[],_=[],v=[];let g=0,x=0;b("z","y","x",-1,-1,s,i,t,f,c,0),b("z","y","x",1,-1,s,i,-t,f,c,1),b("x","z","y",1,1,t,s,i,l,f,2),b("x","z","y",1,-1,t,s,-i,l,f,3),b("x","y","z",1,-1,t,i,s,l,c,4),b("x","y","z",-1,-1,t,i,-s,l,c,5),this.setIndex(m),this.setAttribute("position",new ke(p,3)),this.setAttribute("normal",new ke(_,3)),this.setAttribute("uv",new ke(v,2));function b(A,M,S,O,U,w,z,N,L,E,D){const F=w/L,H=z/E,X=w/2,ct=z/2,ut=N/2,Z=L+1,P=E+1;let k=0,tt=0;const _t=new V;for(let Et=0;Et<P;Et++){const B=Et*H-ct;for(let J=0;J<Z;J++){const bt=J*F-X;_t[A]=bt*O,_t[M]=B*U,_t[S]=ut,p.push(_t.x,_t.y,_t.z),_t[A]=0,_t[M]=0,_t[S]=N>0?1:-1,_.push(_t.x,_t.y,_t.z),v.push(J/L),v.push(1-Et/E),k+=1}}for(let Et=0;Et<E;Et++)for(let B=0;B<L;B++){const J=g+B+Z*Et,bt=g+B+Z*(Et+1),Rt=g+(B+1)+Z*(Et+1),Ut=g+(B+1)+Z*Et;m.push(J,bt,Ut),m.push(bt,Rt,Ut),tt+=6}d.addGroup(x,tt,D),x+=tt,g+=k}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new cn(t.width,t.height,t.depth,t.widthSegments,t.heightSegments,t.depthSegments)}}class hl extends Ln{constructor(t=1,i=32,s=0,l=Math.PI*2){super(),this.type="CircleGeometry",this.parameters={radius:t,segments:i,thetaStart:s,thetaLength:l},i=Math.max(3,i);const c=[],f=[],d=[],m=[],p=new V,_=new ae;f.push(0,0,0),d.push(0,0,1),m.push(.5,.5);for(let v=0,g=3;v<=i;v++,g+=3){const x=s+v/i*l;p.x=t*Math.cos(x),p.y=t*Math.sin(x),f.push(p.x,p.y,p.z),d.push(0,0,1),_.x=(f[g]/t+1)/2,_.y=(f[g+1]/t+1)/2,m.push(_.x,_.y)}for(let v=1;v<=i;v++)c.push(v,v+1,0);this.setIndex(c),this.setAttribute("position",new ke(f,3)),this.setAttribute("normal",new ke(d,3)),this.setAttribute("uv",new ke(m,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new hl(t.radius,t.segments,t.thetaStart,t.thetaLength)}}class ui extends Ln{constructor(t=1,i=1,s=1,l=32,c=1,f=!1,d=0,m=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:t,radiusBottom:i,height:s,radialSegments:l,heightSegments:c,openEnded:f,thetaStart:d,thetaLength:m};const p=this;l=Math.floor(l),c=Math.floor(c);const _=[],v=[],g=[],x=[];let b=0;const A=[],M=s/2;let S=0;O(),f===!1&&(t>0&&U(!0),i>0&&U(!1)),this.setIndex(_),this.setAttribute("position",new ke(v,3)),this.setAttribute("normal",new ke(g,3)),this.setAttribute("uv",new ke(x,2));function O(){const w=new V,z=new V;let N=0;const L=(i-t)/s;for(let E=0;E<=c;E++){const D=[],F=E/c,H=F*(i-t)+t;for(let X=0;X<=l;X++){const ct=X/l,ut=ct*m+d,Z=Math.sin(ut),P=Math.cos(ut);z.x=H*Z,z.y=-F*s+M,z.z=H*P,v.push(z.x,z.y,z.z),w.set(Z,L,P).normalize(),g.push(w.x,w.y,w.z),x.push(ct,1-F),D.push(b++)}A.push(D)}for(let E=0;E<l;E++)for(let D=0;D<c;D++){const F=A[D][E],H=A[D+1][E],X=A[D+1][E+1],ct=A[D][E+1];(t>0||D!==0)&&(_.push(F,H,ct),N+=3),(i>0||D!==c-1)&&(_.push(H,X,ct),N+=3)}p.addGroup(S,N,0),S+=N}function U(w){const z=b,N=new ae,L=new V;let E=0;const D=w===!0?t:i,F=w===!0?1:-1;for(let X=1;X<=l;X++)v.push(0,M*F,0),g.push(0,F,0),x.push(.5,.5),b++;const H=b;for(let X=0;X<=l;X++){const ut=X/l*m+d,Z=Math.cos(ut),P=Math.sin(ut);L.x=D*P,L.y=M*F,L.z=D*Z,v.push(L.x,L.y,L.z),g.push(0,F,0),N.x=Z*.5+.5,N.y=P*.5*F+.5,x.push(N.x,N.y),b++}for(let X=0;X<l;X++){const ct=z+X,ut=H+X;w===!0?_.push(ut,ut+1,ct):_.push(ut+1,ut,ct),E+=3}p.addGroup(S,E,w===!0?1:2),S+=E}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new ui(t.radiusTop,t.radiusBottom,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}}class dl extends ui{constructor(t=1,i=1,s=32,l=1,c=!1,f=0,d=Math.PI*2){super(0,t,i,s,l,c,f,d),this.type="ConeGeometry",this.parameters={radius:t,height:i,radialSegments:s,heightSegments:l,openEnded:c,thetaStart:f,thetaLength:d}}static fromJSON(t){return new dl(t.radius,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}}class wp extends Ln{constructor(t=[],i=[],s=1,l=0){super(),this.type="PolyhedronGeometry",this.parameters={vertices:t,indices:i,radius:s,detail:l};const c=[],f=[];d(l),p(s),_(),this.setAttribute("position",new ke(c,3)),this.setAttribute("normal",new ke(c.slice(),3)),this.setAttribute("uv",new ke(f,2)),l===0?this.computeVertexNormals():this.normalizeNormals();function d(O){const U=new V,w=new V,z=new V;for(let N=0;N<i.length;N+=3)x(i[N+0],U),x(i[N+1],w),x(i[N+2],z),m(U,w,z,O)}function m(O,U,w,z){const N=z+1,L=[];for(let E=0;E<=N;E++){L[E]=[];const D=O.clone().lerp(w,E/N),F=U.clone().lerp(w,E/N),H=N-E;for(let X=0;X<=H;X++)X===0&&E===N?L[E][X]=D:L[E][X]=D.clone().lerp(F,X/H)}for(let E=0;E<N;E++)for(let D=0;D<2*(N-E)-1;D++){const F=Math.floor(D/2);D%2===0?(g(L[E][F+1]),g(L[E+1][F]),g(L[E][F])):(g(L[E][F+1]),g(L[E+1][F+1]),g(L[E+1][F]))}}function p(O){const U=new V;for(let w=0;w<c.length;w+=3)U.x=c[w+0],U.y=c[w+1],U.z=c[w+2],U.normalize().multiplyScalar(O),c[w+0]=U.x,c[w+1]=U.y,c[w+2]=U.z}function _(){const O=new V;for(let U=0;U<c.length;U+=3){O.x=c[U+0],O.y=c[U+1],O.z=c[U+2];const w=M(O)/2/Math.PI+.5,z=S(O)/Math.PI+.5;f.push(w,1-z)}b(),v()}function v(){for(let O=0;O<f.length;O+=6){const U=f[O+0],w=f[O+2],z=f[O+4],N=Math.max(U,w,z),L=Math.min(U,w,z);N>.9&&L<.1&&(U<.2&&(f[O+0]+=1),w<.2&&(f[O+2]+=1),z<.2&&(f[O+4]+=1))}}function g(O){c.push(O.x,O.y,O.z)}function x(O,U){const w=O*3;U.x=t[w+0],U.y=t[w+1],U.z=t[w+2]}function b(){const O=new V,U=new V,w=new V,z=new V,N=new ae,L=new ae,E=new ae;for(let D=0,F=0;D<c.length;D+=9,F+=6){O.set(c[D+0],c[D+1],c[D+2]),U.set(c[D+3],c[D+4],c[D+5]),w.set(c[D+6],c[D+7],c[D+8]),N.set(f[F+0],f[F+1]),L.set(f[F+2],f[F+3]),E.set(f[F+4],f[F+5]),z.copy(O).add(U).add(w).divideScalar(3);const H=M(z);A(N,F+0,O,H),A(L,F+2,U,H),A(E,F+4,w,H)}}function A(O,U,w,z){z<0&&O.x===1&&(f[U]=O.x-1),w.x===0&&w.z===0&&(f[U]=z/2/Math.PI+.5)}function M(O){return Math.atan2(O.z,-O.x)}function S(O){return Math.atan2(-O.y,Math.sqrt(O.x*O.x+O.z*O.z))}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new wp(t.vertices,t.indices,t.radius,t.detail)}}class Rp extends wp{constructor(t=1,i=0){const s=(1+Math.sqrt(5))/2,l=1/s,c=[-1,-1,-1,-1,-1,1,-1,1,-1,-1,1,1,1,-1,-1,1,-1,1,1,1,-1,1,1,1,0,-l,-s,0,-l,s,0,l,-s,0,l,s,-l,-s,0,-l,s,0,l,-s,0,l,s,0,-s,0,-l,s,0,-l,-s,0,l,s,0,l],f=[3,11,7,3,7,15,3,15,13,7,19,17,7,17,6,7,6,15,17,4,8,17,8,10,17,10,6,8,0,16,8,16,2,8,2,10,0,12,1,0,1,18,0,18,16,6,10,2,6,2,13,6,13,15,2,16,18,2,18,3,2,3,13,18,1,9,18,9,11,18,11,3,4,14,12,4,12,0,4,0,8,11,9,5,11,5,19,11,19,7,19,5,14,19,14,4,19,4,17,1,12,14,1,14,5,1,5,9];super(c,f,t,i),this.type="DodecahedronGeometry",this.parameters={radius:t,detail:i}}static fromJSON(t){return new Rp(t.radius,t.detail)}}class Ia{constructor(){this.type="Curve",this.arcLengthDivisions=200,this.needsUpdate=!1,this.cacheArcLengths=null}getPoint(){ue("Curve: .getPoint() not implemented.")}getPointAt(t,i){const s=this.getUtoTmapping(t);return this.getPoint(s,i)}getPoints(t=5){const i=[];for(let s=0;s<=t;s++)i.push(this.getPoint(s/t));return i}getSpacedPoints(t=5){const i=[];for(let s=0;s<=t;s++)i.push(this.getPointAt(s/t));return i}getLength(){const t=this.getLengths();return t[t.length-1]}getLengths(t=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===t+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;const i=[];let s,l=this.getPoint(0),c=0;i.push(0);for(let f=1;f<=t;f++)s=this.getPoint(f/t),c+=s.distanceTo(l),i.push(c),l=s;return this.cacheArcLengths=i,i}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(t,i=null){const s=this.getLengths();let l=0;const c=s.length;let f;i?f=i:f=t*s[c-1];let d=0,m=c-1,p;for(;d<=m;)if(l=Math.floor(d+(m-d)/2),p=s[l]-f,p<0)d=l+1;else if(p>0)m=l-1;else{m=l;break}if(l=m,s[l]===f)return l/(c-1);const _=s[l],g=s[l+1]-_,x=(f-_)/g;return(l+x)/(c-1)}getTangent(t,i){let l=t-1e-4,c=t+1e-4;l<0&&(l=0),c>1&&(c=1);const f=this.getPoint(l),d=this.getPoint(c),m=i||(f.isVector2?new ae:new V);return m.copy(d).sub(f).normalize(),m}getTangentAt(t,i){const s=this.getUtoTmapping(t);return this.getTangent(s,i)}computeFrenetFrames(t,i=!1){const s=new V,l=[],c=[],f=[],d=new V,m=new Ve;for(let x=0;x<=t;x++){const b=x/t;l[x]=this.getTangentAt(b,new V)}c[0]=new V,f[0]=new V;let p=Number.MAX_VALUE;const _=Math.abs(l[0].x),v=Math.abs(l[0].y),g=Math.abs(l[0].z);_<=p&&(p=_,s.set(1,0,0)),v<=p&&(p=v,s.set(0,1,0)),g<=p&&s.set(0,0,1),d.crossVectors(l[0],s).normalize(),c[0].crossVectors(l[0],d),f[0].crossVectors(l[0],c[0]);for(let x=1;x<=t;x++){if(c[x]=c[x-1].clone(),f[x]=f[x-1].clone(),d.crossVectors(l[x-1],l[x]),d.length()>Number.EPSILON){d.normalize();const b=Math.acos(Ee(l[x-1].dot(l[x]),-1,1));c[x].applyMatrix4(m.makeRotationAxis(d,b))}f[x].crossVectors(l[x],c[x])}if(i===!0){let x=Math.acos(Ee(c[0].dot(c[t]),-1,1));x/=t,l[0].dot(d.crossVectors(c[0],c[t]))>0&&(x=-x);for(let b=1;b<=t;b++)c[b].applyMatrix4(m.makeRotationAxis(l[b],x*b)),f[b].crossVectors(l[b],c[b])}return{tangents:l,normals:c,binormals:f}}clone(){return new this.constructor().copy(this)}copy(t){return this.arcLengthDivisions=t.arcLengthDivisions,this}toJSON(){const t={metadata:{version:4.7,type:"Curve",generator:"Curve.toJSON"}};return t.arcLengthDivisions=this.arcLengthDivisions,t.type=this.type,t}fromJSON(t){return this.arcLengthDivisions=t.arcLengthDivisions,this}}class gx extends Ia{constructor(t=0,i=0,s=1,l=1,c=0,f=Math.PI*2,d=!1,m=0){super(),this.isEllipseCurve=!0,this.type="EllipseCurve",this.aX=t,this.aY=i,this.xRadius=s,this.yRadius=l,this.aStartAngle=c,this.aEndAngle=f,this.aClockwise=d,this.aRotation=m}getPoint(t,i=new ae){const s=i,l=Math.PI*2;let c=this.aEndAngle-this.aStartAngle;const f=Math.abs(c)<Number.EPSILON;for(;c<0;)c+=l;for(;c>l;)c-=l;c<Number.EPSILON&&(f?c=0:c=l),this.aClockwise===!0&&!f&&(c===l?c=-l:c=c-l);const d=this.aStartAngle+t*c;let m=this.aX+this.xRadius*Math.cos(d),p=this.aY+this.yRadius*Math.sin(d);if(this.aRotation!==0){const _=Math.cos(this.aRotation),v=Math.sin(this.aRotation),g=m-this.aX,x=p-this.aY;m=g*_-x*v+this.aX,p=g*v+x*_+this.aY}return s.set(m,p)}copy(t){return super.copy(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}toJSON(){const t=super.toJSON();return t.aX=this.aX,t.aY=this.aY,t.xRadius=this.xRadius,t.yRadius=this.yRadius,t.aStartAngle=this.aStartAngle,t.aEndAngle=this.aEndAngle,t.aClockwise=this.aClockwise,t.aRotation=this.aRotation,t}fromJSON(t){return super.fromJSON(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}}class U1 extends gx{constructor(t,i,s,l,c,f){super(t,i,s,s,l,c,f),this.isArcCurve=!0,this.type="ArcCurve"}}function Cp(){let r=0,t=0,i=0,s=0;function l(c,f,d,m){r=c,t=d,i=-3*c+3*f-2*d-m,s=2*c-2*f+d+m}return{initCatmullRom:function(c,f,d,m,p){l(f,d,p*(d-c),p*(m-f))},initNonuniformCatmullRom:function(c,f,d,m,p,_,v){let g=(f-c)/p-(d-c)/(p+_)+(d-f)/_,x=(d-f)/_-(m-f)/(_+v)+(m-d)/v;g*=_,x*=_,l(f,d,g,x)},calc:function(c){const f=c*c,d=f*c;return r+t*c+i*f+s*d}}}const av=new V,sv=new V,sd=new Cp,rd=new Cp,od=new Cp;class op extends Ia{constructor(t=[],i=!1,s="centripetal",l=.5){super(),this.isCatmullRomCurve3=!0,this.type="CatmullRomCurve3",this.points=t,this.closed=i,this.curveType=s,this.tension=l}getPoint(t,i=new V){const s=i,l=this.points,c=l.length,f=(c-(this.closed?0:1))*t;let d=Math.floor(f),m=f-d;this.closed?d+=d>0?0:(Math.floor(Math.abs(d)/c)+1)*c:m===0&&d===c-1&&(d=c-2,m=1);let p,_;this.closed||d>0?p=l[(d-1)%c]:(sv.subVectors(l[0],l[1]).add(l[0]),p=sv);const v=l[d%c],g=l[(d+1)%c];if(this.closed||d+2<c?_=l[(d+2)%c]:(av.subVectors(l[c-1],l[c-2]).add(l[c-1]),_=av),this.curveType==="centripetal"||this.curveType==="chordal"){const x=this.curveType==="chordal"?.5:.25;let b=Math.pow(p.distanceToSquared(v),x),A=Math.pow(v.distanceToSquared(g),x),M=Math.pow(g.distanceToSquared(_),x);A<1e-4&&(A=1),b<1e-4&&(b=A),M<1e-4&&(M=A),sd.initNonuniformCatmullRom(p.x,v.x,g.x,_.x,b,A,M),rd.initNonuniformCatmullRom(p.y,v.y,g.y,_.y,b,A,M),od.initNonuniformCatmullRom(p.z,v.z,g.z,_.z,b,A,M)}else this.curveType==="catmullrom"&&(sd.initCatmullRom(p.x,v.x,g.x,_.x,this.tension),rd.initCatmullRom(p.y,v.y,g.y,_.y,this.tension),od.initCatmullRom(p.z,v.z,g.z,_.z,this.tension));return s.set(sd.calc(m),rd.calc(m),od.calc(m)),s}copy(t){super.copy(t),this.points=[];for(let i=0,s=t.points.length;i<s;i++){const l=t.points[i];this.points.push(l.clone())}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}toJSON(){const t=super.toJSON();t.points=[];for(let i=0,s=this.points.length;i<s;i++){const l=this.points[i];t.points.push(l.toArray())}return t.closed=this.closed,t.curveType=this.curveType,t.tension=this.tension,t}fromJSON(t){super.fromJSON(t),this.points=[];for(let i=0,s=t.points.length;i<s;i++){const l=t.points[i];this.points.push(new V().fromArray(l))}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}}function rv(r,t,i,s,l){const c=(s-t)*.5,f=(l-i)*.5,d=r*r,m=r*d;return(2*i-2*s+c+f)*m+(-3*i+3*s-2*c-f)*d+c*r+i}function N1(r,t){const i=1-r;return i*i*t}function L1(r,t){return 2*(1-r)*r*t}function O1(r,t){return r*r*t}function pl(r,t,i,s){return N1(r,t)+L1(r,i)+O1(r,s)}function P1(r,t){const i=1-r;return i*i*i*t}function z1(r,t){const i=1-r;return 3*i*i*r*t}function B1(r,t){return 3*(1-r)*r*r*t}function I1(r,t){return r*r*r*t}function ml(r,t,i,s,l){return P1(r,t)+z1(r,i)+B1(r,s)+I1(r,l)}class F1 extends Ia{constructor(t=new ae,i=new ae,s=new ae,l=new ae){super(),this.isCubicBezierCurve=!0,this.type="CubicBezierCurve",this.v0=t,this.v1=i,this.v2=s,this.v3=l}getPoint(t,i=new ae){const s=i,l=this.v0,c=this.v1,f=this.v2,d=this.v3;return s.set(ml(t,l.x,c.x,f.x,d.x),ml(t,l.y,c.y,f.y,d.y)),s}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){const t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}}class H1 extends Ia{constructor(t=new V,i=new V,s=new V,l=new V){super(),this.isCubicBezierCurve3=!0,this.type="CubicBezierCurve3",this.v0=t,this.v1=i,this.v2=s,this.v3=l}getPoint(t,i=new V){const s=i,l=this.v0,c=this.v1,f=this.v2,d=this.v3;return s.set(ml(t,l.x,c.x,f.x,d.x),ml(t,l.y,c.y,f.y,d.y),ml(t,l.z,c.z,f.z,d.z)),s}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){const t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}}class G1 extends Ia{constructor(t=new ae,i=new ae){super(),this.isLineCurve=!0,this.type="LineCurve",this.v1=t,this.v2=i}getPoint(t,i=new ae){const s=i;return t===1?s.copy(this.v2):(s.copy(this.v2).sub(this.v1),s.multiplyScalar(t).add(this.v1)),s}getPointAt(t,i){return this.getPoint(t,i)}getTangent(t,i=new ae){return i.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,i){return this.getTangent(t,i)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){const t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}}class V1 extends Ia{constructor(t=new V,i=new V){super(),this.isLineCurve3=!0,this.type="LineCurve3",this.v1=t,this.v2=i}getPoint(t,i=new V){const s=i;return t===1?s.copy(this.v2):(s.copy(this.v2).sub(this.v1),s.multiplyScalar(t).add(this.v1)),s}getPointAt(t,i){return this.getPoint(t,i)}getTangent(t,i=new V){return i.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,i){return this.getTangent(t,i)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){const t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}}class k1 extends Ia{constructor(t=new ae,i=new ae,s=new ae){super(),this.isQuadraticBezierCurve=!0,this.type="QuadraticBezierCurve",this.v0=t,this.v1=i,this.v2=s}getPoint(t,i=new ae){const s=i,l=this.v0,c=this.v1,f=this.v2;return s.set(pl(t,l.x,c.x,f.x),pl(t,l.y,c.y,f.y)),s}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){const t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}}class _x extends Ia{constructor(t=new V,i=new V,s=new V){super(),this.isQuadraticBezierCurve3=!0,this.type="QuadraticBezierCurve3",this.v0=t,this.v1=i,this.v2=s}getPoint(t,i=new V){const s=i,l=this.v0,c=this.v1,f=this.v2;return s.set(pl(t,l.x,c.x,f.x),pl(t,l.y,c.y,f.y),pl(t,l.z,c.z,f.z)),s}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){const t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}}class X1 extends Ia{constructor(t=[]){super(),this.isSplineCurve=!0,this.type="SplineCurve",this.points=t}getPoint(t,i=new ae){const s=i,l=this.points,c=(l.length-1)*t,f=Math.floor(c),d=c-f,m=l[f===0?f:f-1],p=l[f],_=l[f>l.length-2?l.length-1:f+1],v=l[f>l.length-3?l.length-1:f+2];return s.set(rv(d,m.x,p.x,_.x,v.x),rv(d,m.y,p.y,_.y,v.y)),s}copy(t){super.copy(t),this.points=[];for(let i=0,s=t.points.length;i<s;i++){const l=t.points[i];this.points.push(l.clone())}return this}toJSON(){const t=super.toJSON();t.points=[];for(let i=0,s=this.points.length;i<s;i++){const l=this.points[i];t.points.push(l.toArray())}return t}fromJSON(t){super.fromJSON(t),this.points=[];for(let i=0,s=t.points.length;i<s;i++){const l=t.points[i];this.points.push(new ae().fromArray(l))}return this}}var W1=Object.freeze({__proto__:null,ArcCurve:U1,CatmullRomCurve3:op,CubicBezierCurve:F1,CubicBezierCurve3:H1,EllipseCurve:gx,LineCurve:G1,LineCurve3:V1,QuadraticBezierCurve:k1,QuadraticBezierCurve3:_x,SplineCurve:X1});class Su extends Ln{constructor(t=1,i=1,s=1,l=1){super(),this.type="PlaneGeometry",this.parameters={width:t,height:i,widthSegments:s,heightSegments:l};const c=t/2,f=i/2,d=Math.floor(s),m=Math.floor(l),p=d+1,_=m+1,v=t/d,g=i/m,x=[],b=[],A=[],M=[];for(let S=0;S<_;S++){const O=S*g-f;for(let U=0;U<p;U++){const w=U*v-c;b.push(w,-O,0),A.push(0,0,1),M.push(U/d),M.push(1-S/m)}}for(let S=0;S<m;S++)for(let O=0;O<d;O++){const U=O+p*S,w=O+p*(S+1),z=O+1+p*(S+1),N=O+1+p*S;x.push(U,w,N),x.push(w,z,N)}this.setIndex(x),this.setAttribute("position",new ke(b,3)),this.setAttribute("normal",new ke(A,3)),this.setAttribute("uv",new ke(M,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Su(t.width,t.height,t.widthSegments,t.heightSegments)}}class Dp extends Ln{constructor(t=.5,i=1,s=32,l=1,c=0,f=Math.PI*2){super(),this.type="RingGeometry",this.parameters={innerRadius:t,outerRadius:i,thetaSegments:s,phiSegments:l,thetaStart:c,thetaLength:f},s=Math.max(3,s),l=Math.max(1,l);const d=[],m=[],p=[],_=[];let v=t;const g=(i-t)/l,x=new V,b=new ae;for(let A=0;A<=l;A++){for(let M=0;M<=s;M++){const S=c+M/s*f;x.x=v*Math.cos(S),x.y=v*Math.sin(S),m.push(x.x,x.y,x.z),p.push(0,0,1),b.x=(x.x/i+1)/2,b.y=(x.y/i+1)/2,_.push(b.x,b.y)}v+=g}for(let A=0;A<l;A++){const M=A*(s+1);for(let S=0;S<s;S++){const O=S+M,U=O,w=O+s+1,z=O+s+2,N=O+1;d.push(U,w,N),d.push(w,z,N)}}this.setIndex(d),this.setAttribute("position",new ke(m,3)),this.setAttribute("normal",new ke(p,3)),this.setAttribute("uv",new ke(_,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Dp(t.innerRadius,t.outerRadius,t.thetaSegments,t.phiSegments,t.thetaStart,t.thetaLength)}}class Mi extends Ln{constructor(t=1,i=32,s=16,l=0,c=Math.PI*2,f=0,d=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:t,widthSegments:i,heightSegments:s,phiStart:l,phiLength:c,thetaStart:f,thetaLength:d},i=Math.max(3,Math.floor(i)),s=Math.max(2,Math.floor(s));const m=Math.min(f+d,Math.PI);let p=0;const _=[],v=new V,g=new V,x=[],b=[],A=[],M=[];for(let S=0;S<=s;S++){const O=[],U=S/s,w=f+U*d,z=t*Math.cos(w),N=Math.sqrt(t*t-z*z);let L=0;S===0&&f===0?L=.5/i:S===s&&m===Math.PI&&(L=-.5/i);for(let E=0;E<=i;E++){const D=E/i,F=l+D*c;v.x=-N*Math.cos(F),v.y=z,v.z=N*Math.sin(F),b.push(v.x,v.y,v.z),g.copy(v).normalize(),A.push(g.x,g.y,g.z),M.push(D+L,1-U),O.push(p++)}_.push(O)}for(let S=0;S<s;S++)for(let O=0;O<i;O++){const U=_[S][O+1],w=_[S][O],z=_[S+1][O],N=_[S+1][O+1];(S!==0||f>0)&&x.push(U,w,N),(S!==s-1||m<Math.PI)&&x.push(w,z,N)}this.setIndex(x),this.setAttribute("position",new ke(b,3)),this.setAttribute("normal",new ke(A,3)),this.setAttribute("uv",new ke(M,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Mi(t.radius,t.widthSegments,t.heightSegments,t.phiStart,t.phiLength,t.thetaStart,t.thetaLength)}}class Up extends Ln{constructor(t=1,i=.4,s=12,l=48,c=Math.PI*2,f=0,d=Math.PI*2){super(),this.type="TorusGeometry",this.parameters={radius:t,tube:i,radialSegments:s,tubularSegments:l,arc:c,thetaStart:f,thetaLength:d},s=Math.floor(s),l=Math.floor(l);const m=[],p=[],_=[],v=[],g=new V,x=new V,b=new V;for(let A=0;A<=s;A++){const M=f+A/s*d;for(let S=0;S<=l;S++){const O=S/l*c;x.x=(t+i*Math.cos(M))*Math.cos(O),x.y=(t+i*Math.cos(M))*Math.sin(O),x.z=i*Math.sin(M),p.push(x.x,x.y,x.z),g.x=t*Math.cos(O),g.y=t*Math.sin(O),b.subVectors(x,g).normalize(),_.push(b.x,b.y,b.z),v.push(S/l),v.push(A/s)}}for(let A=1;A<=s;A++)for(let M=1;M<=l;M++){const S=(l+1)*A+M-1,O=(l+1)*(A-1)+M-1,U=(l+1)*(A-1)+M,w=(l+1)*A+M;m.push(S,O,w),m.push(O,U,w)}this.setIndex(m),this.setAttribute("position",new ke(p,3)),this.setAttribute("normal",new ke(_,3)),this.setAttribute("uv",new ke(v,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Up(t.radius,t.tube,t.radialSegments,t.tubularSegments,t.arc)}}class _u extends Ln{constructor(t=new _x(new V(-1,-1,0),new V(-1,1,0),new V(1,1,0)),i=64,s=1,l=8,c=!1){super(),this.type="TubeGeometry",this.parameters={path:t,tubularSegments:i,radius:s,radialSegments:l,closed:c};const f=t.computeFrenetFrames(i,c);this.tangents=f.tangents,this.normals=f.normals,this.binormals=f.binormals;const d=new V,m=new V,p=new ae;let _=new V;const v=[],g=[],x=[],b=[];A(),this.setIndex(b),this.setAttribute("position",new ke(v,3)),this.setAttribute("normal",new ke(g,3)),this.setAttribute("uv",new ke(x,2));function A(){for(let U=0;U<i;U++)M(U);M(c===!1?i:0),O(),S()}function M(U){_=t.getPointAt(U/i,_);const w=f.normals[U],z=f.binormals[U];for(let N=0;N<=l;N++){const L=N/l*Math.PI*2,E=Math.sin(L),D=-Math.cos(L);m.x=D*w.x+E*z.x,m.y=D*w.y+E*z.y,m.z=D*w.z+E*z.z,m.normalize(),g.push(m.x,m.y,m.z),d.x=_.x+s*m.x,d.y=_.y+s*m.y,d.z=_.z+s*m.z,v.push(d.x,d.y,d.z)}}function S(){for(let U=1;U<=i;U++)for(let w=1;w<=l;w++){const z=(l+1)*(U-1)+(w-1),N=(l+1)*U+(w-1),L=(l+1)*U+w,E=(l+1)*(U-1)+w;b.push(z,N,E),b.push(N,L,E)}}function O(){for(let U=0;U<=i;U++)for(let w=0;w<=l;w++)p.x=U/i,p.y=w/l,x.push(p.x,p.y)}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}toJSON(){const t=super.toJSON();return t.path=this.parameters.path.toJSON(),t}static fromJSON(t){return new _u(new W1[t.path.type]().fromJSON(t.path),t.tubularSegments,t.radius,t.radialSegments,t.closed)}}function no(r){const t={};for(const i in r){t[i]={};for(const s in r[i]){const l=r[i][s];if(ov(l))l.isRenderTargetTexture?(ue("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),t[i][s]=null):t[i][s]=l.clone();else if(Array.isArray(l))if(ov(l[0])){const c=[];for(let f=0,d=l.length;f<d;f++)c[f]=l[f].clone();t[i][s]=c}else t[i][s]=l.slice();else t[i][s]=l}}return t}function ti(r){const t={};for(let i=0;i<r.length;i++){const s=no(r[i]);for(const l in s)t[l]=s[l]}return t}function ov(r){return r&&(r.isColor||r.isMatrix3||r.isMatrix4||r.isVector2||r.isVector3||r.isVector4||r.isTexture||r.isQuaternion)}function q1(r){const t=[];for(let i=0;i<r.length;i++)t.push(r[i].clone());return t}function vx(r){const t=r.getRenderTarget();return t===null?r.outputColorSpace:t.isXRRenderTarget===!0?t.texture.colorSpace:Ne.workingColorSpace}const Y1={clone:no,merge:ti};var Z1=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,K1=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;class ra extends ro{constructor(t){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=Z1,this.fragmentShader=K1,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,t!==void 0&&this.setValues(t)}copy(t){return super.copy(t),this.fragmentShader=t.fragmentShader,this.vertexShader=t.vertexShader,this.uniforms=no(t.uniforms),this.uniformsGroups=q1(t.uniformsGroups),this.defines=Object.assign({},t.defines),this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.fog=t.fog,this.lights=t.lights,this.clipping=t.clipping,this.extensions=Object.assign({},t.extensions),this.glslVersion=t.glslVersion,this.defaultAttributeValues=Object.assign({},t.defaultAttributeValues),this.index0AttributeName=t.index0AttributeName,this.uniformsNeedUpdate=t.uniformsNeedUpdate,this}toJSON(t){const i=super.toJSON(t);i.glslVersion=this.glslVersion,i.uniforms={};for(const l in this.uniforms){const f=this.uniforms[l].value;f&&f.isTexture?i.uniforms[l]={type:"t",value:f.toJSON(t).uuid}:f&&f.isColor?i.uniforms[l]={type:"c",value:f.getHex()}:f&&f.isVector2?i.uniforms[l]={type:"v2",value:f.toArray()}:f&&f.isVector3?i.uniforms[l]={type:"v3",value:f.toArray()}:f&&f.isVector4?i.uniforms[l]={type:"v4",value:f.toArray()}:f&&f.isMatrix3?i.uniforms[l]={type:"m3",value:f.toArray()}:f&&f.isMatrix4?i.uniforms[l]={type:"m4",value:f.toArray()}:i.uniforms[l]={value:f}}Object.keys(this.defines).length>0&&(i.defines=this.defines),i.vertexShader=this.vertexShader,i.fragmentShader=this.fragmentShader,i.lights=this.lights,i.clipping=this.clipping;const s={};for(const l in this.extensions)this.extensions[l]===!0&&(s[l]=!0);return Object.keys(s).length>0&&(i.extensions=s),i}fromJSON(t,i){if(super.fromJSON(t,i),t.uniforms!==void 0)for(const s in t.uniforms){const l=t.uniforms[s];switch(this.uniforms[s]={},l.type){case"t":this.uniforms[s].value=i[l.value]||null;break;case"c":this.uniforms[s].value=new Re().setHex(l.value);break;case"v2":this.uniforms[s].value=new ae().fromArray(l.value);break;case"v3":this.uniforms[s].value=new V().fromArray(l.value);break;case"v4":this.uniforms[s].value=new gn().fromArray(l.value);break;case"m3":this.uniforms[s].value=new me().fromArray(l.value);break;case"m4":this.uniforms[s].value=new Ve().fromArray(l.value);break;default:this.uniforms[s].value=l.value}}if(t.defines!==void 0&&(this.defines=t.defines),t.vertexShader!==void 0&&(this.vertexShader=t.vertexShader),t.fragmentShader!==void 0&&(this.fragmentShader=t.fragmentShader),t.glslVersion!==void 0&&(this.glslVersion=t.glslVersion),t.extensions!==void 0)for(const s in t.extensions)this.extensions[s]=t.extensions[s];return t.lights!==void 0&&(this.lights=t.lights),t.clipping!==void 0&&(this.clipping=t.clipping),this}}class J1 extends ra{constructor(t){super(t),this.isRawShaderMaterial=!0,this.type="RawShaderMaterial"}}class _e extends ro{constructor(t){super(),this.isMeshStandardMaterial=!0,this.type="MeshStandardMaterial",this.defines={STANDARD:""},this.color=new Re(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Re(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=ap,this.normalScale=new ae(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Ss,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.defines={STANDARD:""},this.color.copy(t.color),this.roughness=t.roughness,this.metalness=t.metalness,this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.emissive.copy(t.emissive),this.emissiveMap=t.emissiveMap,this.emissiveIntensity=t.emissiveIntensity,this.bumpMap=t.bumpMap,this.bumpScale=t.bumpScale,this.normalMap=t.normalMap,this.normalMapType=t.normalMapType,this.normalScale.copy(t.normalScale),this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.roughnessMap=t.roughnessMap,this.metalnessMap=t.metalnessMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.envMapIntensity=t.envMapIntensity,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.flatShading=t.flatShading,this.fog=t.fog,this}}class Q1 extends ro{constructor(t){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=NM,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(t)}copy(t){return super.copy(t),this.depthPacking=t.depthPacking,this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this}}class j1 extends ro{constructor(t){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(t)}copy(t){return super.copy(t),this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this}}const ld={enabled:!1,files:{},add:function(r,t){this.enabled!==!1&&(lv(r)||(this.files[r]=t))},get:function(r){if(this.enabled!==!1&&!lv(r))return this.files[r]},remove:function(r){delete this.files[r]},clear:function(){this.files={}}};function lv(r){try{const t=r.slice(r.indexOf(":")+1);return new URL(t).protocol==="blob:"}catch{return!1}}class $1{constructor(t,i,s){const l=this;let c=!1,f=0,d=0,m;const p=[];this.onStart=void 0,this.onLoad=t,this.onProgress=i,this.onError=s,this._abortController=null,this.itemStart=function(_){d++,c===!1&&l.onStart!==void 0&&l.onStart(_,f,d),c=!0},this.itemEnd=function(_){f++,l.onProgress!==void 0&&l.onProgress(_,f,d),f===d&&(c=!1,l.onLoad!==void 0&&l.onLoad())},this.itemError=function(_){l.onError!==void 0&&l.onError(_)},this.resolveURL=function(_){return _=_.normalize("NFC"),m?m(_):_},this.setURLModifier=function(_){return m=_,this},this.addHandler=function(_,v){return p.push(_,v),this},this.removeHandler=function(_){const v=p.indexOf(_);return v!==-1&&p.splice(v,2),this},this.getHandler=function(_){for(let v=0,g=p.length;v<g;v+=2){const x=p[v],b=p[v+1];if(x.global&&(x.lastIndex=0),x.test(_))return b}return null},this.abort=function(){return this.abortController.abort(),this._abortController=null,this}}get abortController(){return this._abortController||(this._abortController=new AbortController),this._abortController}}const tb=new $1;class Np{constructor(t){this.manager=t!==void 0?t:tb,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}load(){}loadAsync(t,i){const s=this;return new Promise(function(l,c){s.load(t,l,i,c)})}parse(){}setCrossOrigin(t){return this.crossOrigin=t,this}setWithCredentials(t){return this.withCredentials=t,this}setPath(t){return this.path=t,this}setResourcePath(t){return this.resourcePath=t,this}setRequestHeader(t){return this.requestHeader=t,this}abort(){return this}}Np.DEFAULT_MATERIAL_NAME="__DEFAULT";const Wr=new WeakMap;class eb extends Np{constructor(t){super(t)}load(t,i,s,l){this.path!==void 0&&(t=this.path+t),t=this.manager.resolveURL(t);const c=this,f=ld.get(`image:${t}`);if(f!==void 0){if(f.complete===!0)c.manager.itemStart(t),setTimeout(function(){i&&i(f),c.manager.itemEnd(t)},0);else{let v=Wr.get(f);v===void 0&&(v=[],Wr.set(f,v)),v.push({onLoad:i,onError:l})}return f}const d=yl("img");function m(){_(),i&&i(this);const v=Wr.get(this)||[];for(let g=0;g<v.length;g++){const x=v[g];x.onLoad&&x.onLoad(this)}Wr.delete(this),c.manager.itemEnd(t)}function p(v){_(),l&&l(v),ld.remove(`image:${t}`);const g=Wr.get(this)||[];for(let x=0;x<g.length;x++){const b=g[x];b.onError&&b.onError(v)}Wr.delete(this),c.manager.itemError(t),c.manager.itemEnd(t)}function _(){d.removeEventListener("load",m,!1),d.removeEventListener("error",p,!1)}return d.addEventListener("load",m,!1),d.addEventListener("error",p,!1),t.slice(0,5)!=="data:"&&this.crossOrigin!==void 0&&(d.crossOrigin=this.crossOrigin),ld.add(`image:${t}`,d),c.manager.itemStart(t),d.src=t,d}}class nb extends Np{constructor(t){super(t)}load(t,i,s,l){const c=new kn,f=new eb(this.manager);return f.setCrossOrigin(this.crossOrigin),f.setPath(this.path),f.load(t,function(d){c.image=d,c.needsUpdate=!0,i!==void 0&&i(c)},s,l),c}}class yu extends Cn{constructor(t,i=1){super(),this.isLight=!0,this.type="Light",this.color=new Re(t),this.intensity=i}dispose(){this.dispatchEvent({type:"dispose"})}copy(t,i){return super.copy(t,i),this.color.copy(t.color),this.intensity=t.intensity,this}toJSON(t){const i=super.toJSON(t);return i.object.color=this.color.getHex(),i.object.intensity=this.intensity,i}}class ib extends yu{constructor(t,i,s){super(t,s),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(Cn.DEFAULT_UP),this.updateMatrix(),this.groundColor=new Re(i)}copy(t,i){return super.copy(t,i),this.groundColor.copy(t.groundColor),this}toJSON(t){const i=super.toJSON(t);return i.object.groundColor=this.groundColor.getHex(),i}}const cd=new Ve,cv=new V,uv=new V;class xx{constructor(t){this.camera=t,this.intensity=1,this.bias=0,this.biasNode=null,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new ae(512,512),this.mapType=Ei,this.map=null,this.mapPass=null,this.matrix=new Ve,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new Ap,this._frameExtents=new ae(1,1),this._viewportCount=1,this._viewports=[new gn(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(t){const i=this.camera,s=this.matrix;cv.setFromMatrixPosition(t.matrixWorld),i.position.copy(cv),uv.setFromMatrixPosition(t.target.matrixWorld),i.lookAt(uv),i.updateMatrixWorld(),cd.multiplyMatrices(i.projectionMatrix,i.matrixWorldInverse),this._frustum.setFromProjectionMatrix(cd,i.coordinateSystem,i.reversedDepth),i.coordinateSystem===Sl||i.reversedDepth?s.set(.5,0,0,.5,0,.5,0,.5,0,0,1,0,0,0,0,1):s.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),s.multiply(cd)}getViewport(t){return this._viewports[t]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(t){return this.camera=t.camera.clone(),this.intensity=t.intensity,this.bias=t.bias,this.radius=t.radius,this.autoUpdate=t.autoUpdate,this.needsUpdate=t.needsUpdate,this.normalBias=t.normalBias,this.blurSamples=t.blurSamples,this.mapSize.copy(t.mapSize),this.biasNode=t.biasNode,this}clone(){return new this.constructor().copy(this)}toJSON(){const t={};return this.intensity!==1&&(t.intensity=this.intensity),this.bias!==0&&(t.bias=this.bias),this.normalBias!==0&&(t.normalBias=this.normalBias),this.radius!==1&&(t.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(t.mapSize=this.mapSize.toArray()),t.camera=this.camera.toJSON(!1).object,delete t.camera.matrix,t}}const $c=new V,tu=new ao,ji=new V;class Sx extends Cn{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new Ve,this.projectionMatrix=new Ve,this.projectionMatrixInverse=new Ve,this.coordinateSystem=ea,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(t,i){return super.copy(t,i),this.matrixWorldInverse.copy(t.matrixWorldInverse),this.projectionMatrix.copy(t.projectionMatrix),this.projectionMatrixInverse.copy(t.projectionMatrixInverse),this.coordinateSystem=t.coordinateSystem,this}getWorldDirection(t){return super.getWorldDirection(t).negate()}updateMatrixWorld(t){super.updateMatrixWorld(t),this.matrixWorld.decompose($c,tu,ji),ji.x===1&&ji.y===1&&ji.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose($c,tu,ji.set(1,1,1)).invert()}updateWorldMatrix(t,i,s=!1){super.updateWorldMatrix(t,i,s),this.matrixWorld.decompose($c,tu,ji),ji.x===1&&ji.y===1&&ji.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose($c,tu,ji.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}}const gs=new V,fv=new ae,hv=new ae;class bi extends Sx{constructor(t=50,i=1,s=.1,l=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=t,this.zoom=1,this.near=s,this.far=l,this.focus=10,this.aspect=i,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(t,i){return super.copy(t,i),this.fov=t.fov,this.zoom=t.zoom,this.near=t.near,this.far=t.far,this.focus=t.focus,this.aspect=t.aspect,this.view=t.view===null?null:Object.assign({},t.view),this.filmGauge=t.filmGauge,this.filmOffset=t.filmOffset,this}setFocalLength(t){const i=.5*this.getFilmHeight()/t;this.fov=Ml*2*Math.atan(i),this.updateProjectionMatrix()}getFocalLength(){const t=Math.tan(ul*.5*this.fov);return .5*this.getFilmHeight()/t}getEffectiveFOV(){return Ml*2*Math.atan(Math.tan(ul*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(t,i,s){gs.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),i.set(gs.x,gs.y).multiplyScalar(-t/gs.z),gs.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),s.set(gs.x,gs.y).multiplyScalar(-t/gs.z)}getViewSize(t,i){return this.getViewBounds(t,fv,hv),i.subVectors(hv,fv)}setViewOffset(t,i,s,l,c,f){this.aspect=t/i,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=i,this.view.offsetX=s,this.view.offsetY=l,this.view.width=c,this.view.height=f,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const t=this.near;let i=t*Math.tan(ul*.5*this.fov)/this.zoom,s=2*i,l=this.aspect*s,c=-.5*l;const f=this.view;if(this.view!==null&&this.view.enabled){const m=f.fullWidth,p=f.fullHeight;c+=f.offsetX*l/m,i-=f.offsetY*s/p,l*=f.width/m,s*=f.height/p}const d=this.filmOffset;d!==0&&(c+=t*d/this.getFilmWidth()),this.projectionMatrix.makePerspective(c,c+l,i,i-s,t,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){const i=super.toJSON(t);return i.object.fov=this.fov,i.object.zoom=this.zoom,i.object.near=this.near,i.object.far=this.far,i.object.focus=this.focus,i.object.aspect=this.aspect,this.view!==null&&(i.object.view=Object.assign({},this.view)),i.object.filmGauge=this.filmGauge,i.object.filmOffset=this.filmOffset,i}}class ab extends xx{constructor(){super(new bi(90,1,.5,500)),this.isPointLightShadow=!0}}class lp extends yu{constructor(t,i,s=0,l=2){super(t,i),this.isPointLight=!0,this.type="PointLight",this.distance=s,this.decay=l,this.shadow=new ab}get power(){return this.intensity*4*Math.PI}set power(t){this.intensity=t/(4*Math.PI)}dispose(){super.dispose(),this.shadow.dispose()}copy(t,i){return super.copy(t,i),this.distance=t.distance,this.decay=t.decay,this.shadow=t.shadow.clone(),this}toJSON(t){const i=super.toJSON(t);return i.object.distance=this.distance,i.object.decay=this.decay,i.object.shadow=this.shadow.toJSON(),i}}class Lp extends Sx{constructor(t=-1,i=1,s=1,l=-1,c=.1,f=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=t,this.right=i,this.top=s,this.bottom=l,this.near=c,this.far=f,this.updateProjectionMatrix()}copy(t,i){return super.copy(t,i),this.left=t.left,this.right=t.right,this.top=t.top,this.bottom=t.bottom,this.near=t.near,this.far=t.far,this.zoom=t.zoom,this.view=t.view===null?null:Object.assign({},t.view),this}setViewOffset(t,i,s,l,c,f){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=i,this.view.offsetX=s,this.view.offsetY=l,this.view.width=c,this.view.height=f,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const t=(this.right-this.left)/(2*this.zoom),i=(this.top-this.bottom)/(2*this.zoom),s=(this.right+this.left)/2,l=(this.top+this.bottom)/2;let c=s-t,f=s+t,d=l+i,m=l-i;if(this.view!==null&&this.view.enabled){const p=(this.right-this.left)/this.view.fullWidth/this.zoom,_=(this.top-this.bottom)/this.view.fullHeight/this.zoom;c+=p*this.view.offsetX,f=c+p*this.view.width,d-=_*this.view.offsetY,m=d-_*this.view.height}this.projectionMatrix.makeOrthographic(c,f,d,m,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){const i=super.toJSON(t);return i.object.zoom=this.zoom,i.object.left=this.left,i.object.right=this.right,i.object.top=this.top,i.object.bottom=this.bottom,i.object.near=this.near,i.object.far=this.far,this.view!==null&&(i.object.view=Object.assign({},this.view)),i}}class sb extends xx{constructor(){super(new Lp(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}}class ud extends yu{constructor(t,i){super(t,i),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(Cn.DEFAULT_UP),this.updateMatrix(),this.target=new Cn,this.shadow=new sb}dispose(){super.dispose(),this.shadow.dispose()}copy(t){return super.copy(t),this.target=t.target.clone(),this.shadow=t.shadow.clone(),this}toJSON(t){const i=super.toJSON(t);return i.object.shadow=this.shadow.toJSON(),i.object.target=this.target.uuid,i}}class rb extends yu{constructor(t,i){super(t,i),this.isAmbientLight=!0,this.type="AmbientLight"}}const qr=-90,Yr=1;class ob extends Cn{constructor(t,i,s){super(),this.type="CubeCamera",this.renderTarget=s,this.coordinateSystem=null,this.activeMipmapLevel=0;const l=new bi(qr,Yr,t,i);l.layers=this.layers,this.add(l);const c=new bi(qr,Yr,t,i);c.layers=this.layers,this.add(c);const f=new bi(qr,Yr,t,i);f.layers=this.layers,this.add(f);const d=new bi(qr,Yr,t,i);d.layers=this.layers,this.add(d);const m=new bi(qr,Yr,t,i);m.layers=this.layers,this.add(m);const p=new bi(qr,Yr,t,i);p.layers=this.layers,this.add(p)}updateCoordinateSystem(){const t=this.coordinateSystem,i=this.children.concat(),[s,l,c,f,d,m]=i;for(const p of i)this.remove(p);if(t===ea)s.up.set(0,1,0),s.lookAt(1,0,0),l.up.set(0,1,0),l.lookAt(-1,0,0),c.up.set(0,0,-1),c.lookAt(0,1,0),f.up.set(0,0,1),f.lookAt(0,-1,0),d.up.set(0,1,0),d.lookAt(0,0,1),m.up.set(0,1,0),m.lookAt(0,0,-1);else if(t===Sl)s.up.set(0,-1,0),s.lookAt(-1,0,0),l.up.set(0,-1,0),l.lookAt(1,0,0),c.up.set(0,0,1),c.lookAt(0,1,0),f.up.set(0,0,-1),f.lookAt(0,-1,0),d.up.set(0,-1,0),d.lookAt(0,0,1),m.up.set(0,-1,0),m.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+t);for(const p of i)this.add(p),p.updateMatrixWorld()}update(t,i){this.parent===null&&this.updateMatrixWorld();const{renderTarget:s,activeMipmapLevel:l}=this;this.coordinateSystem!==t.coordinateSystem&&(this.coordinateSystem=t.coordinateSystem,this.updateCoordinateSystem());const[c,f,d,m,p,_]=this.children,v=t.getRenderTarget(),g=t.getActiveCubeFace(),x=t.getActiveMipmapLevel(),b=t.xr.enabled;t.xr.enabled=!1;const A=s.texture.generateMipmaps;s.texture.generateMipmaps=!1;let M=!1;t.isWebGLRenderer===!0?M=t.state.buffers.depth.getReversed():M=t.reversedDepthBuffer,t.setRenderTarget(s,0,l),M&&t.autoClear===!1&&t.clearDepth(),t.render(i,c),t.setRenderTarget(s,1,l),M&&t.autoClear===!1&&t.clearDepth(),t.render(i,f),t.setRenderTarget(s,2,l),M&&t.autoClear===!1&&t.clearDepth(),t.render(i,d),t.setRenderTarget(s,3,l),M&&t.autoClear===!1&&t.clearDepth(),t.render(i,m),t.setRenderTarget(s,4,l),M&&t.autoClear===!1&&t.clearDepth(),t.render(i,p),s.texture.generateMipmaps=A,t.setRenderTarget(s,5,l),M&&t.autoClear===!1&&t.clearDepth(),t.render(i,_),t.setRenderTarget(v,g,x),t.xr.enabled=b,s.texture.needsPMREMUpdate=!0}}class lb extends bi{constructor(t=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=t}}const Ip=class Ip{constructor(t,i,s,l){this.elements=[1,0,0,1],t!==void 0&&this.set(t,i,s,l)}identity(){return this.set(1,0,0,1),this}fromArray(t,i=0){for(let s=0;s<4;s++)this.elements[s]=t[s+i];return this}set(t,i,s,l){const c=this.elements;return c[0]=t,c[2]=i,c[1]=s,c[3]=l,this}};Ip.prototype.isMatrix2=!0;let dv=Ip;function pv(r,t,i,s){const l=cb(s);switch(i){case ax:return r*t;case _p:return r*t/l.components*l.byteLength;case vp:return r*t/l.components*l.byteLength;case js:return r*t*2/l.components*l.byteLength;case xp:return r*t*2/l.components*l.byteLength;case sx:return r*t*3/l.components*l.byteLength;case qi:return r*t*4/l.components*l.byteLength;case Sp:return r*t*4/l.components*l.byteLength;case ru:case ou:return Math.floor((r+3)/4)*Math.floor((t+3)/4)*8;case lu:case cu:return Math.floor((r+3)/4)*Math.floor((t+3)/4)*16;case Cd:case Ud:return Math.max(r,16)*Math.max(t,8)/4;case Rd:case Dd:return Math.max(r,8)*Math.max(t,8)/2;case Nd:case Ld:case Pd:case zd:return Math.floor((r+3)/4)*Math.floor((t+3)/4)*8;case Od:case hu:case Bd:return Math.floor((r+3)/4)*Math.floor((t+3)/4)*16;case Id:return Math.floor((r+3)/4)*Math.floor((t+3)/4)*16;case Fd:return Math.floor((r+4)/5)*Math.floor((t+3)/4)*16;case Hd:return Math.floor((r+4)/5)*Math.floor((t+4)/5)*16;case Gd:return Math.floor((r+5)/6)*Math.floor((t+4)/5)*16;case Vd:return Math.floor((r+5)/6)*Math.floor((t+5)/6)*16;case kd:return Math.floor((r+7)/8)*Math.floor((t+4)/5)*16;case Xd:return Math.floor((r+7)/8)*Math.floor((t+5)/6)*16;case Wd:return Math.floor((r+7)/8)*Math.floor((t+7)/8)*16;case qd:return Math.floor((r+9)/10)*Math.floor((t+4)/5)*16;case Yd:return Math.floor((r+9)/10)*Math.floor((t+5)/6)*16;case Zd:return Math.floor((r+9)/10)*Math.floor((t+7)/8)*16;case Kd:return Math.floor((r+9)/10)*Math.floor((t+9)/10)*16;case Jd:return Math.floor((r+11)/12)*Math.floor((t+9)/10)*16;case Qd:return Math.floor((r+11)/12)*Math.floor((t+11)/12)*16;case jd:case $d:case tp:return Math.ceil(r/4)*Math.ceil(t/4)*16;case ep:case np:return Math.ceil(r/4)*Math.ceil(t/4)*8;case du:case ip:return Math.ceil(r/4)*Math.ceil(t/4)*16}throw new Error(`Unable to determine texture byte length for ${i} format.`)}function cb(r){switch(r){case Ei:case tx:return{byteLength:1,components:1};case vl:case ex:case za:return{byteLength:2,components:1};case mp:case gp:return{byteLength:2,components:4};case sa:case pp:case Wi:return{byteLength:4,components:1};case nx:case ix:return{byteLength:4,components:3}}throw new Error(`THREE.TextureUtils: Unknown texture type ${r}.`)}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:hp}}));typeof window<"u"&&(window.__THREE__?ue("WARNING: Multiple instances of Three.js being imported."):window.__THREE__=hp);/**
 * @license
 * Copyright 2010-2026 Three.js Authors
 * SPDX-License-Identifier: MIT
 */function yx(){let r=null,t=!1,i=null,s=null;function l(c,f){i(c,f),s=r.requestAnimationFrame(l)}return{start:function(){t!==!0&&i!==null&&r!==null&&(s=r.requestAnimationFrame(l),t=!0)},stop:function(){r!==null&&r.cancelAnimationFrame(s),t=!1},setAnimationLoop:function(c){i=c},setContext:function(c){r=c}}}function ub(r){const t=new WeakMap;function i(d,m){const p=d.array,_=d.usage,v=p.byteLength,g=r.createBuffer();r.bindBuffer(m,g),r.bufferData(m,p,_),d.onUploadCallback();let x;if(p instanceof Float32Array)x=r.FLOAT;else if(typeof Float16Array<"u"&&p instanceof Float16Array)x=r.HALF_FLOAT;else if(p instanceof Uint16Array)d.isFloat16BufferAttribute?x=r.HALF_FLOAT:x=r.UNSIGNED_SHORT;else if(p instanceof Int16Array)x=r.SHORT;else if(p instanceof Uint32Array)x=r.UNSIGNED_INT;else if(p instanceof Int32Array)x=r.INT;else if(p instanceof Int8Array)x=r.BYTE;else if(p instanceof Uint8Array)x=r.UNSIGNED_BYTE;else if(p instanceof Uint8ClampedArray)x=r.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+p);return{buffer:g,type:x,bytesPerElement:p.BYTES_PER_ELEMENT,version:d.version,size:v}}function s(d,m,p){const _=m.array,v=m.updateRanges;if(r.bindBuffer(p,d),v.length===0)r.bufferSubData(p,0,_);else{v.sort((x,b)=>x.start-b.start);let g=0;for(let x=1;x<v.length;x++){const b=v[g],A=v[x];A.start<=b.start+b.count+1?b.count=Math.max(b.count,A.start+A.count-b.start):(++g,v[g]=A)}v.length=g+1;for(let x=0,b=v.length;x<b;x++){const A=v[x];r.bufferSubData(p,A.start*_.BYTES_PER_ELEMENT,_,A.start,A.count)}m.clearUpdateRanges()}m.onUploadCallback()}function l(d){return d.isInterleavedBufferAttribute&&(d=d.data),t.get(d)}function c(d){d.isInterleavedBufferAttribute&&(d=d.data);const m=t.get(d);m&&(r.deleteBuffer(m.buffer),t.delete(d))}function f(d,m){if(d.isInterleavedBufferAttribute&&(d=d.data),d.isGLBufferAttribute){const _=t.get(d);(!_||_.version<d.version)&&t.set(d,{buffer:d.buffer,type:d.type,bytesPerElement:d.elementSize,version:d.version});return}const p=t.get(d);if(p===void 0)t.set(d,i(d,m));else if(p.version<d.version){if(p.size!==d.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");s(p.buffer,d,m),p.version=d.version}}return{get:l,remove:c,update:f}}var fb=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,hb=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,db=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,pb=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,mb=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,gb=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,_b=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,vb=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,xb=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec4 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 );
	}
#endif`,Sb=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,yb=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,Mb=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,bb=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,Eb=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,Tb=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,Ab=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,wb=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,Rb=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,Cb=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,Db=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,Ub=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,Nb=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,Lb=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec4( 1.0 );
#endif
#ifdef USE_COLOR_ALPHA
	vColor *= color;
#elif defined( USE_COLOR )
	vColor.rgb *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.rgb *= instanceColor.rgb;
#endif
#ifdef USE_BATCHING_COLOR
	vColor *= getBatchingColor( getIndirectIndex( gl_DrawID ) );
#endif`,Ob=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
#define inverseTransformDirection transformDirectionByInverseViewMatrix
vec3 transformNormalByInverseViewMatrix( in vec3 normal, in mat4 viewMatrix ) {
	return normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
}
vec3 transformDirectionByInverseViewMatrix( in vec3 dir, in mat4 viewMatrix ) {
	return normalize( ( vec4( dir, 0.0 ) * viewMatrix ).xyz );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,Pb=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,zb=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
#endif`,Bb=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,Ib=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,Fb=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,Hb=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,Gb="gl_FragColor = linearToOutputTexel( gl_FragColor );",Vb=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,kb=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * reflectVec );
		#ifdef ENVMAP_BLENDING_MULTIPLY
			outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_MIX )
			outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_ADD )
			outgoingLight += envColor.xyz * specularStrength * reflectivity;
		#endif
	#endif
#endif`,Xb=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,Wb=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,qb=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,Yb=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,Zb=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,Kb=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,Jb=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,Qb=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,jb=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,$b=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,tE=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,eE=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,nE=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif
#include <lightprobes_pars_fragment>`,iE=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
			reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,aE=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,sE=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,rE=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,oE=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,lE=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
material.metalness = metalnessFactor;
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor;
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = vec3( 0.04 );
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,cE=`uniform sampler2D dfgLUT;
struct PhysicalMaterial {
	vec3 diffuseColor;
	vec3 diffuseContribution;
	vec3 specularColor;
	vec3 specularColorBlended;
	float roughness;
	float metalness;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
		vec3 iridescenceFresnelDielectric;
		vec3 iridescenceFresnelMetallic;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		return 0.5 / max( gv + gl, EPSILON );
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColorBlended;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transpose( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float rInv = 1.0 / ( roughness + 0.1 );
	float a = -1.9362 + 1.0678 * roughness + 0.4573 * r2 - 0.8469 * rInv;
	float b = -0.6014 + 0.5538 * roughness - 0.4670 * r2 - 0.1255 * rInv;
	float DG = exp( a * dotNV + b );
	return saturate( DG );
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
vec3 BRDF_GGX_Multiscatter( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 singleScatter = BRDF_GGX( lightDir, viewDir, normal, material );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 dfgV = texture2D( dfgLUT, vec2( material.roughness, dotNV ) ).rg;
	vec2 dfgL = texture2D( dfgLUT, vec2( material.roughness, dotNL ) ).rg;
	vec3 FssEss_V = material.specularColorBlended * dfgV.x + material.specularF90 * dfgV.y;
	vec3 FssEss_L = material.specularColorBlended * dfgL.x + material.specularF90 * dfgL.y;
	float Ess_V = dfgV.x + dfgV.y;
	float Ess_L = dfgL.x + dfgL.y;
	float Ems_V = 1.0 - Ess_V;
	float Ems_L = 1.0 - Ess_L;
	vec3 Favg = material.specularColorBlended + ( 1.0 - material.specularColorBlended ) * 0.047619;
	vec3 Fms = FssEss_V * FssEss_L * Favg / ( 1.0 - Ems_V * Ems_L * Favg + EPSILON );
	float compensationFactor = Ems_V * Ems_L;
	vec3 multiScatter = Fms * compensationFactor;
	return singleScatter + multiScatter;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
		#ifdef USE_CLEARCOAT
			vec3 Ncc = geometryClearcoatNormal;
			vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );
			vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );
			vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );
			mat3 mInvClearcoat = mat3(
				vec3( t1Clearcoat.x, 0, t1Clearcoat.y ),
				vec3(             0, 1,             0 ),
				vec3( t1Clearcoat.z, 0, t1Clearcoat.w )
			);
			vec3 fresnelClearcoat = material.clearcoatF0 * t2Clearcoat.x + ( material.clearcoatF90 - material.clearcoatF0 ) * t2Clearcoat.y;
			clearcoatSpecularDirect += lightColor * fresnelClearcoat * LTC_Evaluate( Ncc, viewDir, position, mInvClearcoat, rectCoords );
		#endif
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
 
 		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
 
 		float sheenAlbedoV = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
 		float sheenAlbedoL = IBLSheenBRDF( geometryNormal, directLight.direction, material.sheenRoughness );
 
 		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * max( sheenAlbedoV, sheenAlbedoL );
 
 		irradiance *= sheenEnergyComp;
 
 	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX_Multiscatter( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution );
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		diffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectDiffuse += diffuse;
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;
 	#endif
	vec3 singleScatteringDielectric = vec3( 0.0 );
	vec3 multiScatteringDielectric = vec3( 0.0 );
	vec3 singleScatteringMetallic = vec3( 0.0 );
	vec3 multiScatteringMetallic = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnelDielectric, material.roughness, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceFresnelMetallic, material.roughness, singleScatteringMetallic, multiScatteringMetallic );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscattering( geometryNormal, geometryViewDir, material.diffuseColor, material.specularF90, material.roughness, singleScatteringMetallic, multiScatteringMetallic );
	#endif
	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );
	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );
	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;
	vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	vec3 indirectSpecular = radiance * singleScattering;
	indirectSpecular += multiScattering * cosineWeightedIrradiance;
	vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		indirectSpecular *= sheenEnergyComp;
		indirectDiffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectSpecular += indirectSpecular;
	reflectedLight.indirectDiffuse += indirectDiffuse;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,uE=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );
		material.iridescenceFresnel = mix( material.iridescenceFresnelDielectric, material.iridescenceFresnelMetallic, material.metalness );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
	#ifdef USE_LIGHT_PROBES_GRID
		vec3 probeWorldPos = ( ( vec4( geometryPosition, 1.0 ) - viewMatrix[ 3 ] ) * viewMatrix ).xyz;
		vec3 probeWorldNormal = transformNormalByInverseViewMatrix( geometryNormal, viewMatrix );
		irradiance += getLightProbeGridIrradiance( probeWorldPos, probeWorldNormal );
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,fE=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )
			iblIrradiance += getIBLIrradiance( geometryNormal );
		#endif
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,hE=`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,dE=`#ifdef USE_LIGHT_PROBES_GRID
uniform highp sampler3D probesSH;
uniform vec3 probesMin;
uniform vec3 probesMax;
uniform vec3 probesResolution;
vec3 getLightProbeGridIrradiance( vec3 worldPos, vec3 worldNormal ) {
	vec3 res = probesResolution;
	vec3 gridRange = probesMax - probesMin;
	vec3 resMinusOne = res - 1.0;
	vec3 probeSpacing = gridRange / resMinusOne;
	vec3 samplePos = worldPos + worldNormal * probeSpacing * 0.5;
	vec3 uvw = clamp( ( samplePos - probesMin ) / gridRange, 0.0, 1.0 );
	uvw = uvw * resMinusOne / res + 0.5 / res;
	float nz          = res.z;
	float paddedSlices = nz + 2.0;
	float atlasDepth  = 7.0 * paddedSlices;
	float uvZBase     = uvw.z * nz + 1.0;
	vec4 s0 = texture( probesSH, vec3( uvw.xy, ( uvZBase                       ) / atlasDepth ) );
	vec4 s1 = texture( probesSH, vec3( uvw.xy, ( uvZBase +       paddedSlices   ) / atlasDepth ) );
	vec4 s2 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 2.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s3 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 3.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s4 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 4.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s5 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 5.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s6 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 6.0 * paddedSlices   ) / atlasDepth ) );
	vec3 c0 = s0.xyz;
	vec3 c1 = vec3( s0.w, s1.xy );
	vec3 c2 = vec3( s1.zw, s2.x );
	vec3 c3 = s2.yzw;
	vec3 c4 = s3.xyz;
	vec3 c5 = vec3( s3.w, s4.xy );
	vec3 c6 = vec3( s4.zw, s5.x );
	vec3 c7 = s5.yzw;
	vec3 c8 = s6.xyz;
	float x = worldNormal.x, y = worldNormal.y, z = worldNormal.z;
	vec3 result = c0 * 0.886227;
	result += c1 * 2.0 * 0.511664 * y;
	result += c2 * 2.0 * 0.511664 * z;
	result += c3 * 2.0 * 0.511664 * x;
	result += c4 * 2.0 * 0.429043 * x * y;
	result += c5 * 2.0 * 0.429043 * y * z;
	result += c6 * ( 0.743125 * z * z - 0.247708 );
	result += c7 * 2.0 * 0.429043 * x * z;
	result += c8 * 0.429043 * ( x * x - y * y );
	return max( result, vec3( 0.0 ) );
}
#endif`,pE=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,mE=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,gE=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,_E=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,vE=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,xE=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,SE=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,yE=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,ME=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,bE=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,EE=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,TE=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,AE=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,wE=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,RE=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,CE=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#ifdef DOUBLE_SIDED
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#ifdef DOUBLE_SIDED
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,DE=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#if defined( USE_PACKED_NORMALMAP )
		mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );
	#endif
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,UE=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,NE=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,LE=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,OE=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,PE=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,zE=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,BE=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,IE=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,FE=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,HE=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	#ifdef USE_REVERSED_DEPTH_BUFFER
	
		return depth * ( far - near ) - far;
	#else
		return depth * ( near - far ) - near;
	#endif
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	
	#ifdef USE_REVERSED_DEPTH_BUFFER
		return ( near * far ) / ( ( near - far ) * depth - near );
	#else
		return ( near * far ) / ( ( far - near ) * depth - far );
	#endif
}`,GE=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,VE=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,kE=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,XE=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,WE=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,qE=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,YE=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#else
			uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#endif
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#else
			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#endif
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#elif defined( SHADOWMAP_TYPE_BASIC )
			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#endif
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float interleavedGradientNoise( vec2 position ) {
			return fract( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) );
		}
		vec2 vogelDiskSample( int sampleIndex, int samplesCount, float phi ) {
			const float goldenAngle = 2.399963229728653;
			float r = sqrt( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) );
			float theta = float( sampleIndex ) * goldenAngle + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;
		}
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			shadowCoord.z += shadowBias;
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				float radius = shadowRadius * texelSize.x;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				shadow = (
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )
				) * 0.2;
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#elif defined( SHADOWMAP_TYPE_VSM )
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 distribution = texture2D( shadowMap, shadowCoord.xy ).rg;
				float mean = distribution.x;
				float variance = distribution.y * distribution.y;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					float hard_shadow = step( mean, shadowCoord.z );
				#else
					float hard_shadow = step( shadowCoord.z, mean );
				#endif
				
				if ( hard_shadow == 1.0 ) {
					shadow = 1.0;
				} else {
					variance = max( variance, 0.0000001 );
					float d = shadowCoord.z - mean;
					float p_max = variance / ( variance + d * d );
					p_max = clamp( ( p_max - 0.3 ) / 0.65, 0.0, 1.0 );
					shadow = max( hard_shadow, p_max );
				}
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#else
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				float depth = texture2D( shadowMap, shadowCoord.xy ).r;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					shadow = step( depth, shadowCoord.z );
				#else
					shadow = step( shadowCoord.z, depth );
				#endif
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	#if defined( SHADOWMAP_TYPE_PCF )
	float getPointShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 bd3D = normalize( lightToPosition );
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				float dp = ( shadowCameraNear * ( shadowCameraFar - viewSpaceZ ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp -= shadowBias;
			#else
				float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp += shadowBias;
			#endif
			float texelSize = shadowRadius / shadowMapSize.x;
			vec3 absDir = abs( bd3D );
			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
			tangent = normalize( cross( bd3D, tangent ) );
			vec3 bitangent = cross( bd3D, tangent );
			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
			vec2 sample0 = vogelDiskSample( 0, 5, phi );
			vec2 sample1 = vogelDiskSample( 1, 5, phi );
			vec2 sample2 = vogelDiskSample( 2, 5, phi );
			vec2 sample3 = vogelDiskSample( 3, 5, phi );
			vec2 sample4 = vogelDiskSample( 4, 5, phi );
			shadow = (
				texture( shadowMap, vec4( bd3D + ( tangent * sample0.x + bitangent * sample0.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample1.x + bitangent * sample1.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample2.x + bitangent * sample2.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample3.x + bitangent * sample3.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample4.x + bitangent * sample4.y ) * texelSize, dp ) )
			) * 0.2;
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#elif defined( SHADOWMAP_TYPE_BASIC )
	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			float depth = textureCube( shadowMap, bd3D ).r;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				depth = 1.0 - depth;
			#endif
			shadow = step( dp, depth );
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#endif
	#endif
#endif`,ZE=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,KE=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	#ifdef HAS_NORMAL
		vec3 shadowWorldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
	#else
		vec3 shadowWorldNormal = vec3( 0.0 );
	#endif
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,JE=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0 && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,QE=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,jE=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,$E=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,tT=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,eT=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,nT=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,iT=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,aT=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,sT=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,rT=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,oT=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,lT=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,cT=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,uT=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`;const fT=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,hT=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,dT=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,pT=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vWorldDirection );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,mT=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,gT=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,_T=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,vT=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,xT=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,ST=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );
}`,yT=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,MT=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,bT=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,ET=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,TT=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,AT=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,wT=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,RT=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,CT=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,DT=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,UT=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,NT=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,LT=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,OT=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,PT=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,zT=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
 
		outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;
 
 	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,BT=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,IT=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,FT=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,HT=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,GT=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,VT=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,kT=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,XT=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,be={alphahash_fragment:fb,alphahash_pars_fragment:hb,alphamap_fragment:db,alphamap_pars_fragment:pb,alphatest_fragment:mb,alphatest_pars_fragment:gb,aomap_fragment:_b,aomap_pars_fragment:vb,batching_pars_vertex:xb,batching_vertex:Sb,begin_vertex:yb,beginnormal_vertex:Mb,bsdfs:bb,iridescence_fragment:Eb,bumpmap_pars_fragment:Tb,clipping_planes_fragment:Ab,clipping_planes_pars_fragment:wb,clipping_planes_pars_vertex:Rb,clipping_planes_vertex:Cb,color_fragment:Db,color_pars_fragment:Ub,color_pars_vertex:Nb,color_vertex:Lb,common:Ob,cube_uv_reflection_fragment:Pb,defaultnormal_vertex:zb,displacementmap_pars_vertex:Bb,displacementmap_vertex:Ib,emissivemap_fragment:Fb,emissivemap_pars_fragment:Hb,colorspace_fragment:Gb,colorspace_pars_fragment:Vb,envmap_fragment:kb,envmap_common_pars_fragment:Xb,envmap_pars_fragment:Wb,envmap_pars_vertex:qb,envmap_physical_pars_fragment:iE,envmap_vertex:Yb,fog_vertex:Zb,fog_pars_vertex:Kb,fog_fragment:Jb,fog_pars_fragment:Qb,gradientmap_pars_fragment:jb,lightmap_pars_fragment:$b,lights_lambert_fragment:tE,lights_lambert_pars_fragment:eE,lights_pars_begin:nE,lights_toon_fragment:aE,lights_toon_pars_fragment:sE,lights_phong_fragment:rE,lights_phong_pars_fragment:oE,lights_physical_fragment:lE,lights_physical_pars_fragment:cE,lights_fragment_begin:uE,lights_fragment_maps:fE,lights_fragment_end:hE,lightprobes_pars_fragment:dE,logdepthbuf_fragment:pE,logdepthbuf_pars_fragment:mE,logdepthbuf_pars_vertex:gE,logdepthbuf_vertex:_E,map_fragment:vE,map_pars_fragment:xE,map_particle_fragment:SE,map_particle_pars_fragment:yE,metalnessmap_fragment:ME,metalnessmap_pars_fragment:bE,morphinstance_vertex:EE,morphcolor_vertex:TE,morphnormal_vertex:AE,morphtarget_pars_vertex:wE,morphtarget_vertex:RE,normal_fragment_begin:CE,normal_fragment_maps:DE,normal_pars_fragment:UE,normal_pars_vertex:NE,normal_vertex:LE,normalmap_pars_fragment:OE,clearcoat_normal_fragment_begin:PE,clearcoat_normal_fragment_maps:zE,clearcoat_pars_fragment:BE,iridescence_pars_fragment:IE,opaque_fragment:FE,packing:HE,premultiplied_alpha_fragment:GE,project_vertex:VE,dithering_fragment:kE,dithering_pars_fragment:XE,roughnessmap_fragment:WE,roughnessmap_pars_fragment:qE,shadowmap_pars_fragment:YE,shadowmap_pars_vertex:ZE,shadowmap_vertex:KE,shadowmask_pars_fragment:JE,skinbase_vertex:QE,skinning_pars_vertex:jE,skinning_vertex:$E,skinnormal_vertex:tT,specularmap_fragment:eT,specularmap_pars_fragment:nT,tonemapping_fragment:iT,tonemapping_pars_fragment:aT,transmission_fragment:sT,transmission_pars_fragment:rT,uv_pars_fragment:oT,uv_pars_vertex:lT,uv_vertex:cT,worldpos_vertex:uT,background_vert:fT,background_frag:hT,backgroundCube_vert:dT,backgroundCube_frag:pT,cube_vert:mT,cube_frag:gT,depth_vert:_T,depth_frag:vT,distance_vert:xT,distance_frag:ST,equirect_vert:yT,equirect_frag:MT,linedashed_vert:bT,linedashed_frag:ET,meshbasic_vert:TT,meshbasic_frag:AT,meshlambert_vert:wT,meshlambert_frag:RT,meshmatcap_vert:CT,meshmatcap_frag:DT,meshnormal_vert:UT,meshnormal_frag:NT,meshphong_vert:LT,meshphong_frag:OT,meshphysical_vert:PT,meshphysical_frag:zT,meshtoon_vert:BT,meshtoon_frag:IT,points_vert:FT,points_frag:HT,shadow_vert:GT,shadow_frag:VT,sprite_vert:kT,sprite_frag:XT},Vt={common:{diffuse:{value:new Re(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new me},alphaMap:{value:null},alphaMapTransform:{value:new me},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new me}},envmap:{envMap:{value:null},envMapRotation:{value:new me},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new me}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new me}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new me},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new me},normalScale:{value:new ae(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new me},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new me}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new me}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new me}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Re(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:null},probesMin:{value:new V},probesMax:{value:new V},probesResolution:{value:new V}},points:{diffuse:{value:new Re(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new me},alphaTest:{value:0},uvTransform:{value:new me}},sprite:{diffuse:{value:new Re(16777215)},opacity:{value:1},center:{value:new ae(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new me},alphaMap:{value:null},alphaMapTransform:{value:new me},alphaTest:{value:0}}},ta={basic:{uniforms:ti([Vt.common,Vt.specularmap,Vt.envmap,Vt.aomap,Vt.lightmap,Vt.fog]),vertexShader:be.meshbasic_vert,fragmentShader:be.meshbasic_frag},lambert:{uniforms:ti([Vt.common,Vt.specularmap,Vt.envmap,Vt.aomap,Vt.lightmap,Vt.emissivemap,Vt.bumpmap,Vt.normalmap,Vt.displacementmap,Vt.fog,Vt.lights,{emissive:{value:new Re(0)},envMapIntensity:{value:1}}]),vertexShader:be.meshlambert_vert,fragmentShader:be.meshlambert_frag},phong:{uniforms:ti([Vt.common,Vt.specularmap,Vt.envmap,Vt.aomap,Vt.lightmap,Vt.emissivemap,Vt.bumpmap,Vt.normalmap,Vt.displacementmap,Vt.fog,Vt.lights,{emissive:{value:new Re(0)},specular:{value:new Re(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:be.meshphong_vert,fragmentShader:be.meshphong_frag},standard:{uniforms:ti([Vt.common,Vt.envmap,Vt.aomap,Vt.lightmap,Vt.emissivemap,Vt.bumpmap,Vt.normalmap,Vt.displacementmap,Vt.roughnessmap,Vt.metalnessmap,Vt.fog,Vt.lights,{emissive:{value:new Re(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:be.meshphysical_vert,fragmentShader:be.meshphysical_frag},toon:{uniforms:ti([Vt.common,Vt.aomap,Vt.lightmap,Vt.emissivemap,Vt.bumpmap,Vt.normalmap,Vt.displacementmap,Vt.gradientmap,Vt.fog,Vt.lights,{emissive:{value:new Re(0)}}]),vertexShader:be.meshtoon_vert,fragmentShader:be.meshtoon_frag},matcap:{uniforms:ti([Vt.common,Vt.bumpmap,Vt.normalmap,Vt.displacementmap,Vt.fog,{matcap:{value:null}}]),vertexShader:be.meshmatcap_vert,fragmentShader:be.meshmatcap_frag},points:{uniforms:ti([Vt.points,Vt.fog]),vertexShader:be.points_vert,fragmentShader:be.points_frag},dashed:{uniforms:ti([Vt.common,Vt.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:be.linedashed_vert,fragmentShader:be.linedashed_frag},depth:{uniforms:ti([Vt.common,Vt.displacementmap]),vertexShader:be.depth_vert,fragmentShader:be.depth_frag},normal:{uniforms:ti([Vt.common,Vt.bumpmap,Vt.normalmap,Vt.displacementmap,{opacity:{value:1}}]),vertexShader:be.meshnormal_vert,fragmentShader:be.meshnormal_frag},sprite:{uniforms:ti([Vt.sprite,Vt.fog]),vertexShader:be.sprite_vert,fragmentShader:be.sprite_frag},background:{uniforms:{uvTransform:{value:new me},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:be.background_vert,fragmentShader:be.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new me}},vertexShader:be.backgroundCube_vert,fragmentShader:be.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:be.cube_vert,fragmentShader:be.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:be.equirect_vert,fragmentShader:be.equirect_frag},distance:{uniforms:ti([Vt.common,Vt.displacementmap,{referencePosition:{value:new V},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:be.distance_vert,fragmentShader:be.distance_frag},shadow:{uniforms:ti([Vt.lights,Vt.fog,{color:{value:new Re(0)},opacity:{value:1}}]),vertexShader:be.shadow_vert,fragmentShader:be.shadow_frag}};ta.physical={uniforms:ti([ta.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new me},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new me},clearcoatNormalScale:{value:new ae(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new me},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new me},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new me},sheen:{value:0},sheenColor:{value:new Re(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new me},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new me},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new me},transmissionSamplerSize:{value:new ae},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new me},attenuationDistance:{value:0},attenuationColor:{value:new Re(0)},specularColor:{value:new Re(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new me},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new me},anisotropyVector:{value:new ae},anisotropyMap:{value:null},anisotropyMapTransform:{value:new me}}]),vertexShader:be.meshphysical_vert,fragmentShader:be.meshphysical_frag};const eu={r:0,b:0,g:0},WT=new Ve,Mx=new me;Mx.set(-1,0,0,0,1,0,0,0,1);function qT(r,t,i,s,l,c){const f=new Re(0);let d=l===!0?0:1,m,p,_=null,v=0,g=null;function x(O){let U=O.isScene===!0?O.background:null;if(U&&U.isTexture){const w=O.backgroundBlurriness>0;U=t.get(U,w)}return U}function b(O){let U=!1;const w=x(O);w===null?M(f,d):w&&w.isColor&&(M(w,1),U=!0);const z=r.xr.getEnvironmentBlendMode();z==="additive"?i.buffers.color.setClear(0,0,0,1,c):z==="alpha-blend"&&i.buffers.color.setClear(0,0,0,0,c),(r.autoClear||U)&&(i.buffers.depth.setTest(!0),i.buffers.depth.setMask(!0),i.buffers.color.setMask(!0),r.clear(r.autoClearColor,r.autoClearDepth,r.autoClearStencil))}function A(O,U){const w=x(U);w&&(w.isCubeTexture||w.mapping===xu)?(p===void 0&&(p=new ie(new cn(1,1,1),new ra({name:"BackgroundCubeMaterial",uniforms:no(ta.backgroundCube.uniforms),vertexShader:ta.backgroundCube.vertexShader,fragmentShader:ta.backgroundCube.fragmentShader,side:ni,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),p.geometry.deleteAttribute("normal"),p.geometry.deleteAttribute("uv"),p.onBeforeRender=function(z,N,L){this.matrixWorld.copyPosition(L.matrixWorld)},Object.defineProperty(p.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),s.update(p)),p.material.uniforms.envMap.value=w,p.material.uniforms.backgroundBlurriness.value=U.backgroundBlurriness,p.material.uniforms.backgroundIntensity.value=U.backgroundIntensity,p.material.uniforms.backgroundRotation.value.setFromMatrix4(WT.makeRotationFromEuler(U.backgroundRotation)).transpose(),w.isCubeTexture&&w.isRenderTargetTexture===!1&&p.material.uniforms.backgroundRotation.value.premultiply(Mx),p.material.toneMapped=Ne.getTransfer(w.colorSpace)!==Je,(_!==w||v!==w.version||g!==r.toneMapping)&&(p.material.needsUpdate=!0,_=w,v=w.version,g=r.toneMapping),p.layers.enableAll(),O.unshift(p,p.geometry,p.material,0,0,null)):w&&w.isTexture&&(m===void 0&&(m=new ie(new Su(2,2),new ra({name:"BackgroundMaterial",uniforms:no(ta.background.uniforms),vertexShader:ta.background.vertexShader,fragmentShader:ta.background.fragmentShader,side:xs,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),m.geometry.deleteAttribute("normal"),Object.defineProperty(m.material,"map",{get:function(){return this.uniforms.t2D.value}}),s.update(m)),m.material.uniforms.t2D.value=w,m.material.uniforms.backgroundIntensity.value=U.backgroundIntensity,m.material.toneMapped=Ne.getTransfer(w.colorSpace)!==Je,w.matrixAutoUpdate===!0&&w.updateMatrix(),m.material.uniforms.uvTransform.value.copy(w.matrix),(_!==w||v!==w.version||g!==r.toneMapping)&&(m.material.needsUpdate=!0,_=w,v=w.version,g=r.toneMapping),m.layers.enableAll(),O.unshift(m,m.geometry,m.material,0,0,null))}function M(O,U){O.getRGB(eu,vx(r)),i.buffers.color.setClear(eu.r,eu.g,eu.b,U,c)}function S(){p!==void 0&&(p.geometry.dispose(),p.material.dispose(),p=void 0),m!==void 0&&(m.geometry.dispose(),m.material.dispose(),m=void 0)}return{getClearColor:function(){return f},setClearColor:function(O,U=1){f.set(O),d=U,M(f,d)},getClearAlpha:function(){return d},setClearAlpha:function(O){d=O,M(f,d)},render:b,addToRenderList:A,dispose:S}}function YT(r,t){const i=r.getParameter(r.MAX_VERTEX_ATTRIBS),s={},l=g(null);let c=l,f=!1;function d(H,X,ct,ut,Z){let P=!1;const k=v(H,ut,ct,X);c!==k&&(c=k,p(c.object)),P=x(H,ut,ct,Z),P&&b(H,ut,ct,Z),Z!==null&&t.update(Z,r.ELEMENT_ARRAY_BUFFER),(P||f)&&(f=!1,w(H,X,ct,ut),Z!==null&&r.bindBuffer(r.ELEMENT_ARRAY_BUFFER,t.get(Z).buffer))}function m(){return r.createVertexArray()}function p(H){return r.bindVertexArray(H)}function _(H){return r.deleteVertexArray(H)}function v(H,X,ct,ut){const Z=ut.wireframe===!0;let P=s[X.id];P===void 0&&(P={},s[X.id]=P);const k=H.isInstancedMesh===!0?H.id:0;let tt=P[k];tt===void 0&&(tt={},P[k]=tt);let _t=tt[ct.id];_t===void 0&&(_t={},tt[ct.id]=_t);let Et=_t[Z];return Et===void 0&&(Et=g(m()),_t[Z]=Et),Et}function g(H){const X=[],ct=[],ut=[];for(let Z=0;Z<i;Z++)X[Z]=0,ct[Z]=0,ut[Z]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:X,enabledAttributes:ct,attributeDivisors:ut,object:H,attributes:{},index:null}}function x(H,X,ct,ut){const Z=c.attributes,P=X.attributes;let k=0;const tt=ct.getAttributes();for(const _t in tt)if(tt[_t].location>=0){const B=Z[_t];let J=P[_t];if(J===void 0&&(_t==="instanceMatrix"&&H.instanceMatrix&&(J=H.instanceMatrix),_t==="instanceColor"&&H.instanceColor&&(J=H.instanceColor)),B===void 0||B.attribute!==J||J&&B.data!==J.data)return!0;k++}return c.attributesNum!==k||c.index!==ut}function b(H,X,ct,ut){const Z={},P=X.attributes;let k=0;const tt=ct.getAttributes();for(const _t in tt)if(tt[_t].location>=0){let B=P[_t];B===void 0&&(_t==="instanceMatrix"&&H.instanceMatrix&&(B=H.instanceMatrix),_t==="instanceColor"&&H.instanceColor&&(B=H.instanceColor));const J={};J.attribute=B,B&&B.data&&(J.data=B.data),Z[_t]=J,k++}c.attributes=Z,c.attributesNum=k,c.index=ut}function A(){const H=c.newAttributes;for(let X=0,ct=H.length;X<ct;X++)H[X]=0}function M(H){S(H,0)}function S(H,X){const ct=c.newAttributes,ut=c.enabledAttributes,Z=c.attributeDivisors;ct[H]=1,ut[H]===0&&(r.enableVertexAttribArray(H),ut[H]=1),Z[H]!==X&&(r.vertexAttribDivisor(H,X),Z[H]=X)}function O(){const H=c.newAttributes,X=c.enabledAttributes;for(let ct=0,ut=X.length;ct<ut;ct++)X[ct]!==H[ct]&&(r.disableVertexAttribArray(ct),X[ct]=0)}function U(H,X,ct,ut,Z,P,k){k===!0?r.vertexAttribIPointer(H,X,ct,Z,P):r.vertexAttribPointer(H,X,ct,ut,Z,P)}function w(H,X,ct,ut){A();const Z=ut.attributes,P=ct.getAttributes(),k=X.defaultAttributeValues;for(const tt in P){const _t=P[tt];if(_t.location>=0){let Et=Z[tt];if(Et===void 0&&(tt==="instanceMatrix"&&H.instanceMatrix&&(Et=H.instanceMatrix),tt==="instanceColor"&&H.instanceColor&&(Et=H.instanceColor)),Et!==void 0){const B=Et.normalized,J=Et.itemSize,bt=t.get(Et);if(bt===void 0)continue;const Rt=bt.buffer,Ut=bt.type,et=bt.bytesPerElement,yt=Ut===r.INT||Ut===r.UNSIGNED_INT||Et.gpuType===pp;if(Et.isInterleavedBufferAttribute){const Q=Et.data,gt=Q.stride,zt=Et.offset;if(Q.isInstancedInterleavedBuffer){for(let At=0;At<_t.locationSize;At++)S(_t.location+At,Q.meshPerAttribute);H.isInstancedMesh!==!0&&ut._maxInstanceCount===void 0&&(ut._maxInstanceCount=Q.meshPerAttribute*Q.count)}else for(let At=0;At<_t.locationSize;At++)M(_t.location+At);r.bindBuffer(r.ARRAY_BUFFER,Rt);for(let At=0;At<_t.locationSize;At++)U(_t.location+At,J/_t.locationSize,Ut,B,gt*et,(zt+J/_t.locationSize*At)*et,yt)}else{if(Et.isInstancedBufferAttribute){for(let Q=0;Q<_t.locationSize;Q++)S(_t.location+Q,Et.meshPerAttribute);H.isInstancedMesh!==!0&&ut._maxInstanceCount===void 0&&(ut._maxInstanceCount=Et.meshPerAttribute*Et.count)}else for(let Q=0;Q<_t.locationSize;Q++)M(_t.location+Q);r.bindBuffer(r.ARRAY_BUFFER,Rt);for(let Q=0;Q<_t.locationSize;Q++)U(_t.location+Q,J/_t.locationSize,Ut,B,J*et,J/_t.locationSize*Q*et,yt)}}else if(k!==void 0){const B=k[tt];if(B!==void 0)switch(B.length){case 2:r.vertexAttrib2fv(_t.location,B);break;case 3:r.vertexAttrib3fv(_t.location,B);break;case 4:r.vertexAttrib4fv(_t.location,B);break;default:r.vertexAttrib1fv(_t.location,B)}}}}O()}function z(){D();for(const H in s){const X=s[H];for(const ct in X){const ut=X[ct];for(const Z in ut){const P=ut[Z];for(const k in P)_(P[k].object),delete P[k];delete ut[Z]}}delete s[H]}}function N(H){if(s[H.id]===void 0)return;const X=s[H.id];for(const ct in X){const ut=X[ct];for(const Z in ut){const P=ut[Z];for(const k in P)_(P[k].object),delete P[k];delete ut[Z]}}delete s[H.id]}function L(H){for(const X in s){const ct=s[X];for(const ut in ct){const Z=ct[ut];if(Z[H.id]===void 0)continue;const P=Z[H.id];for(const k in P)_(P[k].object),delete P[k];delete Z[H.id]}}}function E(H){for(const X in s){const ct=s[X],ut=H.isInstancedMesh===!0?H.id:0,Z=ct[ut];if(Z!==void 0){for(const P in Z){const k=Z[P];for(const tt in k)_(k[tt].object),delete k[tt];delete Z[P]}delete ct[ut],Object.keys(ct).length===0&&delete s[X]}}}function D(){F(),f=!0,c!==l&&(c=l,p(c.object))}function F(){l.geometry=null,l.program=null,l.wireframe=!1}return{setup:d,reset:D,resetDefaultState:F,dispose:z,releaseStatesOfGeometry:N,releaseStatesOfObject:E,releaseStatesOfProgram:L,initAttributes:A,enableAttribute:M,disableUnusedAttributes:O}}function ZT(r,t,i){let s;function l(m){s=m}function c(m,p){r.drawArrays(s,m,p),i.update(p,s,1)}function f(m,p,_){_!==0&&(r.drawArraysInstanced(s,m,p,_),i.update(p,s,_))}function d(m,p,_){if(_===0)return;t.get("WEBGL_multi_draw").multiDrawArraysWEBGL(s,m,0,p,0,_);let g=0;for(let x=0;x<_;x++)g+=p[x];i.update(g,s,1)}this.setMode=l,this.render=c,this.renderInstances=f,this.renderMultiDraw=d}function KT(r,t,i,s){let l;function c(){if(l!==void 0)return l;if(t.has("EXT_texture_filter_anisotropic")===!0){const L=t.get("EXT_texture_filter_anisotropic");l=r.getParameter(L.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else l=0;return l}function f(L){return!(L!==qi&&s.convert(L)!==r.getParameter(r.IMPLEMENTATION_COLOR_READ_FORMAT))}function d(L){const E=L===za&&(t.has("EXT_color_buffer_half_float")||t.has("EXT_color_buffer_float"));return!(L!==Ei&&s.convert(L)!==r.getParameter(r.IMPLEMENTATION_COLOR_READ_TYPE)&&L!==Wi&&!E)}function m(L){if(L==="highp"){if(r.getShaderPrecisionFormat(r.VERTEX_SHADER,r.HIGH_FLOAT).precision>0&&r.getShaderPrecisionFormat(r.FRAGMENT_SHADER,r.HIGH_FLOAT).precision>0)return"highp";L="mediump"}return L==="mediump"&&r.getShaderPrecisionFormat(r.VERTEX_SHADER,r.MEDIUM_FLOAT).precision>0&&r.getShaderPrecisionFormat(r.FRAGMENT_SHADER,r.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let p=i.precision!==void 0?i.precision:"highp";const _=m(p);_!==p&&(ue("WebGLRenderer:",p,"not supported, using",_,"instead."),p=_);const v=i.logarithmicDepthBuffer===!0,g=i.reversedDepthBuffer===!0&&t.has("EXT_clip_control");i.reversedDepthBuffer===!0&&g===!1&&ue("WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.");const x=r.getParameter(r.MAX_TEXTURE_IMAGE_UNITS),b=r.getParameter(r.MAX_VERTEX_TEXTURE_IMAGE_UNITS),A=r.getParameter(r.MAX_TEXTURE_SIZE),M=r.getParameter(r.MAX_CUBE_MAP_TEXTURE_SIZE),S=r.getParameter(r.MAX_VERTEX_ATTRIBS),O=r.getParameter(r.MAX_VERTEX_UNIFORM_VECTORS),U=r.getParameter(r.MAX_VARYING_VECTORS),w=r.getParameter(r.MAX_FRAGMENT_UNIFORM_VECTORS),z=r.getParameter(r.MAX_SAMPLES),N=r.getParameter(r.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:c,getMaxPrecision:m,textureFormatReadable:f,textureTypeReadable:d,precision:p,logarithmicDepthBuffer:v,reversedDepthBuffer:g,maxTextures:x,maxVertexTextures:b,maxTextureSize:A,maxCubemapSize:M,maxAttributes:S,maxVertexUniforms:O,maxVaryings:U,maxFragmentUniforms:w,maxSamples:z,samples:N}}function JT(r){const t=this;let i=null,s=0,l=!1,c=!1;const f=new ks,d=new me,m={value:null,needsUpdate:!1};this.uniform=m,this.numPlanes=0,this.numIntersection=0,this.init=function(v,g){const x=v.length!==0||g||s!==0||l;return l=g,s=v.length,x},this.beginShadows=function(){c=!0,_(null)},this.endShadows=function(){c=!1},this.setGlobalState=function(v,g){i=_(v,g,0)},this.setState=function(v,g,x){const b=v.clippingPlanes,A=v.clipIntersection,M=v.clipShadows,S=r.get(v);if(!l||b===null||b.length===0||c&&!M)c?_(null):p();else{const O=c?0:s,U=O*4;let w=S.clippingState||null;m.value=w,w=_(b,g,U,x);for(let z=0;z!==U;++z)w[z]=i[z];S.clippingState=w,this.numIntersection=A?this.numPlanes:0,this.numPlanes+=O}};function p(){m.value!==i&&(m.value=i,m.needsUpdate=s>0),t.numPlanes=s,t.numIntersection=0}function _(v,g,x,b){const A=v!==null?v.length:0;let M=null;if(A!==0){if(M=m.value,b!==!0||M===null){const S=x+A*4,O=g.matrixWorldInverse;d.getNormalMatrix(O),(M===null||M.length<S)&&(M=new Float32Array(S));for(let U=0,w=x;U!==A;++U,w+=4)f.copy(v[U]).applyMatrix4(O,d),f.normal.toArray(M,w),M[w+3]=f.constant}m.value=M,m.needsUpdate=!0}return t.numPlanes=A,t.numIntersection=0,M}}const vs=4,mv=[.125,.215,.35,.446,.526,.582],Ws=20,QT=256,al=new Lp,gv=new Re;let fd=null,hd=0,dd=0,pd=!1;const jT=new V;class _v{constructor(t){this._renderer=t,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._sigmas=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(t,i=0,s=.1,l=100,c={}){const{size:f=256,position:d=jT}=c;fd=this._renderer.getRenderTarget(),hd=this._renderer.getActiveCubeFace(),dd=this._renderer.getActiveMipmapLevel(),pd=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(f);const m=this._allocateTargets();return m.depthBuffer=!0,this._sceneToCubeUV(t,s,l,m,d),i>0&&this._blur(m,0,0,i),this._applyPMREM(m),this._cleanup(m),m}fromEquirectangular(t,i=null){return this._fromTexture(t,i)}fromCubemap(t,i=null){return this._fromTexture(t,i)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=Sv(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=xv(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._backgroundBox!==null&&(this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose())}_setSize(t){this._lodMax=Math.floor(Math.log2(t)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let t=0;t<this._lodMeshes.length;t++)this._lodMeshes[t].geometry.dispose()}_cleanup(t){this._renderer.setRenderTarget(fd,hd,dd),this._renderer.xr.enabled=pd,t.scissorTest=!1,Zr(t,0,0,t.width,t.height)}_fromTexture(t,i){t.mapping===Qs||t.mapping===to?this._setSize(t.image.length===0?16:t.image[0].width||t.image[0].image.width):this._setSize(t.image.width/4),fd=this._renderer.getRenderTarget(),hd=this._renderer.getActiveCubeFace(),dd=this._renderer.getActiveMipmapLevel(),pd=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;const s=i||this._allocateTargets();return this._textureToCubeUV(t,s),this._applyPMREM(s),this._cleanup(s),s}_allocateTargets(){const t=3*Math.max(this._cubeSize,112),i=4*this._cubeSize,s={magFilter:Kn,minFilter:Kn,generateMipmaps:!1,type:za,format:qi,colorSpace:pu,depthBuffer:!1},l=vv(t,i,s);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==t||this._pingPongRenderTarget.height!==i){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=vv(t,i,s);const{_lodMax:c}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods,sigmas:this._sigmas}=$T(c)),this._blurMaterial=eA(c,t,i),this._ggxMaterial=tA(c,t,i)}return l}_compileMaterial(t){const i=new ie(new Ln,t);this._renderer.compile(i,al)}_sceneToCubeUV(t,i,s,l,c){const m=new bi(90,1,i,s),p=[1,-1,1,1,1,1],_=[1,1,1,-1,-1,-1],v=this._renderer,g=v.autoClear,x=v.toneMapping;v.getClearColor(gv),v.toneMapping=ia,v.autoClear=!1,v.state.buffers.depth.getReversed()&&(v.setRenderTarget(l),v.clearDepth(),v.setRenderTarget(null)),this._backgroundBox===null&&(this._backgroundBox=new ie(new cn,new gu({name:"PMREM.Background",side:ni,depthWrite:!1,depthTest:!1})));const A=this._backgroundBox,M=A.material;let S=!1;const O=t.background;O?O.isColor&&(M.color.copy(O),t.background=null,S=!0):(M.color.copy(gv),S=!0);for(let U=0;U<6;U++){const w=U%3;w===0?(m.up.set(0,p[U],0),m.position.set(c.x,c.y,c.z),m.lookAt(c.x+_[U],c.y,c.z)):w===1?(m.up.set(0,0,p[U]),m.position.set(c.x,c.y,c.z),m.lookAt(c.x,c.y+_[U],c.z)):(m.up.set(0,p[U],0),m.position.set(c.x,c.y,c.z),m.lookAt(c.x,c.y,c.z+_[U]));const z=this._cubeSize;Zr(l,w*z,U>2?z:0,z,z),v.setRenderTarget(l),S&&v.render(A,m),v.render(t,m)}v.toneMapping=x,v.autoClear=g,t.background=O}_textureToCubeUV(t,i){const s=this._renderer,l=t.mapping===Qs||t.mapping===to;l?(this._cubemapMaterial===null&&(this._cubemapMaterial=Sv()),this._cubemapMaterial.uniforms.flipEnvMap.value=t.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=xv());const c=l?this._cubemapMaterial:this._equirectMaterial,f=this._lodMeshes[0];f.material=c;const d=c.uniforms;d.envMap.value=t;const m=this._cubeSize;Zr(i,0,0,3*m,2*m),s.setRenderTarget(i),s.render(f,al)}_applyPMREM(t){const i=this._renderer,s=i.autoClear;i.autoClear=!1;const l=this._lodMeshes.length;for(let c=1;c<l;c++)this._applyGGXFilter(t,c-1,c);i.autoClear=s}_applyGGXFilter(t,i,s){const l=this._renderer,c=this._pingPongRenderTarget,f=this._ggxMaterial,d=this._lodMeshes[s];d.material=f;const m=f.uniforms,p=s/(this._lodMeshes.length-1),_=i/(this._lodMeshes.length-1),v=Math.sqrt(p*p-_*_),g=0+p*1.25,x=v*g,{_lodMax:b}=this,A=this._sizeLods[s],M=3*A*(s>b-vs?s-b+vs:0),S=4*(this._cubeSize-A);m.envMap.value=t.texture,m.roughness.value=x,m.mipInt.value=b-i,Zr(c,M,S,3*A,2*A),l.setRenderTarget(c),l.render(d,al),m.envMap.value=c.texture,m.roughness.value=0,m.mipInt.value=b-s,Zr(t,M,S,3*A,2*A),l.setRenderTarget(t),l.render(d,al)}_blur(t,i,s,l,c){const f=this._pingPongRenderTarget;this._halfBlur(t,f,i,s,l,"latitudinal",c),this._halfBlur(f,t,s,s,l,"longitudinal",c)}_halfBlur(t,i,s,l,c,f,d){const m=this._renderer,p=this._blurMaterial;f!=="latitudinal"&&f!=="longitudinal"&&Oe("blur direction must be either latitudinal or longitudinal!");const _=3,v=this._lodMeshes[l];v.material=p;const g=p.uniforms,x=this._sizeLods[s]-1,b=isFinite(c)?Math.PI/(2*x):2*Math.PI/(2*Ws-1),A=c/b,M=isFinite(c)?1+Math.floor(_*A):Ws;M>Ws&&ue(`sigmaRadians, ${c}, is too large and will clip, as it requested ${M} samples when the maximum is set to ${Ws}`);const S=[];let O=0;for(let L=0;L<Ws;++L){const E=L/A,D=Math.exp(-E*E/2);S.push(D),L===0?O+=D:L<M&&(O+=2*D)}for(let L=0;L<S.length;L++)S[L]=S[L]/O;g.envMap.value=t.texture,g.samples.value=M,g.weights.value=S,g.latitudinal.value=f==="latitudinal",d&&(g.poleAxis.value=d);const{_lodMax:U}=this;g.dTheta.value=b,g.mipInt.value=U-s;const w=this._sizeLods[l],z=3*w*(l>U-vs?l-U+vs:0),N=4*(this._cubeSize-w);Zr(i,z,N,3*w,2*w),m.setRenderTarget(i),m.render(v,al)}}function $T(r){const t=[],i=[],s=[];let l=r;const c=r-vs+1+mv.length;for(let f=0;f<c;f++){const d=Math.pow(2,l);t.push(d);let m=1/d;f>r-vs?m=mv[f-r+vs-1]:f===0&&(m=0),i.push(m);const p=1/(d-2),_=-p,v=1+p,g=[_,_,v,_,v,v,_,_,v,v,_,v],x=6,b=6,A=3,M=2,S=1,O=new Float32Array(A*b*x),U=new Float32Array(M*b*x),w=new Float32Array(S*b*x);for(let N=0;N<x;N++){const L=N%3*2/3-1,E=N>2?0:-1,D=[L,E,0,L+2/3,E,0,L+2/3,E+1,0,L,E,0,L+2/3,E+1,0,L,E+1,0];O.set(D,A*b*N),U.set(g,M*b*N);const F=[N,N,N,N,N,N];w.set(F,S*b*N)}const z=new Ln;z.setAttribute("position",new Ti(O,A)),z.setAttribute("uv",new Ti(U,M)),z.setAttribute("faceIndex",new Ti(w,S)),s.push(new ie(z,null)),l>vs&&l--}return{lodMeshes:s,sizeLods:t,sigmas:i}}function vv(r,t,i){const s=new aa(r,t,i);return s.texture.mapping=xu,s.texture.name="PMREM.cubeUv",s.scissorTest=!0,s}function Zr(r,t,i,s,l){r.viewport.set(t,i,s,l),r.scissor.set(t,i,s,l)}function tA(r,t,i){return new ra({name:"PMREMGGXConvolution",defines:{GGX_SAMPLES:QT,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/i,CUBEUV_MAX_MIP:`${r}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:Mu(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float roughness;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359

			// Van der Corput radical inverse
			float radicalInverse_VdC(uint bits) {
				bits = (bits << 16u) | (bits >> 16u);
				bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
				bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
				bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
				bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
				return float(bits) * 2.3283064365386963e-10; // / 0x100000000
			}

			// Hammersley sequence
			vec2 hammersley(uint i, uint N) {
				return vec2(float(i) / float(N), radicalInverse_VdC(i));
			}

			// GGX VNDF importance sampling (Eric Heitz 2018)
			// "Sampling the GGX Distribution of Visible Normals"
			// https://jcgt.org/published/0007/04/01/
			vec3 importanceSampleGGX_VNDF(vec2 Xi, vec3 V, float roughness) {
				float alpha = roughness * roughness;

				// Section 4.1: Orthonormal basis
				vec3 T1 = vec3(1.0, 0.0, 0.0);
				vec3 T2 = cross(V, T1);

				// Section 4.2: Parameterization of projected area
				float r = sqrt(Xi.x);
				float phi = 2.0 * PI * Xi.y;
				float t1 = r * cos(phi);
				float t2 = r * sin(phi);
				float s = 0.5 * (1.0 + V.z);
				t2 = (1.0 - s) * sqrt(1.0 - t1 * t1) + s * t2;

				// Section 4.3: Reprojection onto hemisphere
				vec3 Nh = t1 * T1 + t2 * T2 + sqrt(max(0.0, 1.0 - t1 * t1 - t2 * t2)) * V;

				// Section 3.4: Transform back to ellipsoid configuration
				return normalize(vec3(alpha * Nh.x, alpha * Nh.y, max(0.0, Nh.z)));
			}

			void main() {
				vec3 N = normalize(vOutputDirection);
				vec3 V = N; // Assume view direction equals normal for pre-filtering

				vec3 prefilteredColor = vec3(0.0);
				float totalWeight = 0.0;

				// For very low roughness, just sample the environment directly
				if (roughness < 0.001) {
					gl_FragColor = vec4(bilinearCubeUV(envMap, N, mipInt), 1.0);
					return;
				}

				// Tangent space basis for VNDF sampling
				vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
				vec3 tangent = normalize(cross(up, N));
				vec3 bitangent = cross(N, tangent);

				for(uint i = 0u; i < uint(GGX_SAMPLES); i++) {
					vec2 Xi = hammersley(i, uint(GGX_SAMPLES));

					// For PMREM, V = N, so in tangent space V is always (0, 0, 1)
					vec3 H_tangent = importanceSampleGGX_VNDF(Xi, vec3(0.0, 0.0, 1.0), roughness);

					// Transform H back to world space
					vec3 H = normalize(tangent * H_tangent.x + bitangent * H_tangent.y + N * H_tangent.z);
					vec3 L = normalize(2.0 * dot(V, H) * H - V);

					float NdotL = max(dot(N, L), 0.0);

					if(NdotL > 0.0) {
						// Sample environment at fixed mip level
						// VNDF importance sampling handles the distribution filtering
						vec3 sampleColor = bilinearCubeUV(envMap, L, mipInt);

						// Weight by NdotL for the split-sum approximation
						// VNDF PDF naturally accounts for the visible microfacet distribution
						prefilteredColor += sampleColor * NdotL;
						totalWeight += NdotL;
					}
				}

				if (totalWeight > 0.0) {
					prefilteredColor = prefilteredColor / totalWeight;
				}

				gl_FragColor = vec4(prefilteredColor, 1.0);
			}
		`,blending:Oa,depthTest:!1,depthWrite:!1})}function eA(r,t,i){const s=new Float32Array(Ws),l=new V(0,1,0);return new ra({name:"SphericalGaussianBlur",defines:{n:Ws,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/i,CUBEUV_MAX_MIP:`${r}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:s},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:l}},vertexShader:Mu(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:Oa,depthTest:!1,depthWrite:!1})}function xv(){return new ra({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:Mu(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:Oa,depthTest:!1,depthWrite:!1})}function Sv(){return new ra({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:Mu(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:Oa,depthTest:!1,depthWrite:!1})}function Mu(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}class bx extends aa{constructor(t=1,i={}){super(t,t,i),this.isWebGLCubeRenderTarget=!0;const s={width:t,height:t,depth:1},l=[s,s,s,s,s,s];this.texture=new px(l),this._setTextureOptions(i),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(t,i){this.texture.type=i.type,this.texture.colorSpace=i.colorSpace,this.texture.generateMipmaps=i.generateMipmaps,this.texture.minFilter=i.minFilter,this.texture.magFilter=i.magFilter;const s={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},l=new cn(5,5,5),c=new ra({name:"CubemapFromEquirect",uniforms:no(s.uniforms),vertexShader:s.vertexShader,fragmentShader:s.fragmentShader,side:ni,blending:Oa});c.uniforms.tEquirect.value=i;const f=new ie(l,c),d=i.minFilter;return i.minFilter===qs&&(i.minFilter=Kn),new ob(1,10,this).update(t,f),i.minFilter=d,f.geometry.dispose(),f.material.dispose(),this}clear(t,i=!0,s=!0,l=!0){const c=t.getRenderTarget();for(let f=0;f<6;f++)t.setRenderTarget(this,f),t.clear(i,s,l);t.setRenderTarget(c)}}function nA(r){let t=new WeakMap,i=new WeakMap,s=null;function l(g,x=!1){return g==null?null:x?f(g):c(g)}function c(g){if(g&&g.isTexture){const x=g.mapping;if(x===Oh||x===Ph)if(t.has(g)){const b=t.get(g).texture;return d(b,g.mapping)}else{const b=g.image;if(b&&b.height>0){const A=new bx(b.height);return A.fromEquirectangularTexture(r,g),t.set(g,A),g.addEventListener("dispose",p),d(A.texture,g.mapping)}else return null}}return g}function f(g){if(g&&g.isTexture){const x=g.mapping,b=x===Oh||x===Ph,A=x===Qs||x===to;if(b||A){let M=i.get(g);const S=M!==void 0?M.texture.pmremVersion:0;if(g.isRenderTargetTexture&&g.pmremVersion!==S)return s===null&&(s=new _v(r)),M=b?s.fromEquirectangular(g,M):s.fromCubemap(g,M),M.texture.pmremVersion=g.pmremVersion,i.set(g,M),M.texture;if(M!==void 0)return M.texture;{const O=g.image;return b&&O&&O.height>0||A&&O&&m(O)?(s===null&&(s=new _v(r)),M=b?s.fromEquirectangular(g):s.fromCubemap(g),M.texture.pmremVersion=g.pmremVersion,i.set(g,M),g.addEventListener("dispose",_),M.texture):null}}}return g}function d(g,x){return x===Oh?g.mapping=Qs:x===Ph&&(g.mapping=to),g}function m(g){let x=0;const b=6;for(let A=0;A<b;A++)g[A]!==void 0&&x++;return x===b}function p(g){const x=g.target;x.removeEventListener("dispose",p);const b=t.get(x);b!==void 0&&(t.delete(x),b.dispose())}function _(g){const x=g.target;x.removeEventListener("dispose",_);const b=i.get(x);b!==void 0&&(i.delete(x),b.dispose())}function v(){t=new WeakMap,i=new WeakMap,s!==null&&(s.dispose(),s=null)}return{get:l,dispose:v}}function iA(r){const t={};function i(s){if(t[s]!==void 0)return t[s];const l=r.getExtension(s);return t[s]=l,l}return{has:function(s){return i(s)!==null},init:function(){i("EXT_color_buffer_float"),i("WEBGL_clip_cull_distance"),i("OES_texture_float_linear"),i("EXT_color_buffer_half_float"),i("WEBGL_multisampled_render_to_texture"),i("WEBGL_render_shared_exponent")},get:function(s){const l=i(s);return l===null&&Qr("WebGLRenderer: "+s+" extension not supported."),l}}}function aA(r,t,i,s){const l={},c=new WeakMap;function f(v){const g=v.target;g.index!==null&&t.remove(g.index);for(const b in g.attributes)t.remove(g.attributes[b]);g.removeEventListener("dispose",f),delete l[g.id];const x=c.get(g);x&&(t.remove(x),c.delete(g)),s.releaseStatesOfGeometry(g),g.isInstancedBufferGeometry===!0&&delete g._maxInstanceCount,i.memory.geometries--}function d(v,g){return l[g.id]===!0||(g.addEventListener("dispose",f),l[g.id]=!0,i.memory.geometries++),g}function m(v){const g=v.attributes;for(const x in g)t.update(g[x],r.ARRAY_BUFFER)}function p(v){const g=[],x=v.index,b=v.attributes.position;let A=0;if(b===void 0)return;if(x!==null){const O=x.array;A=x.version;for(let U=0,w=O.length;U<w;U+=3){const z=O[U+0],N=O[U+1],L=O[U+2];g.push(z,N,N,L,L,z)}}else{const O=b.array;A=b.version;for(let U=0,w=O.length/3-1;U<w;U+=3){const z=U+0,N=U+1,L=U+2;g.push(z,N,N,L,L,z)}}const M=new(b.count>=65535?fx:ux)(g,1);M.version=A;const S=c.get(v);S&&t.remove(S),c.set(v,M)}function _(v){const g=c.get(v);if(g){const x=v.index;x!==null&&g.version<x.version&&p(v)}else p(v);return c.get(v)}return{get:d,update:m,getWireframeAttribute:_}}function sA(r,t,i){let s;function l(v){s=v}let c,f;function d(v){c=v.type,f=v.bytesPerElement}function m(v,g){r.drawElements(s,g,c,v*f),i.update(g,s,1)}function p(v,g,x){x!==0&&(r.drawElementsInstanced(s,g,c,v*f,x),i.update(g,s,x))}function _(v,g,x){if(x===0)return;t.get("WEBGL_multi_draw").multiDrawElementsWEBGL(s,g,0,c,v,0,x);let A=0;for(let M=0;M<x;M++)A+=g[M];i.update(A,s,1)}this.setMode=l,this.setIndex=d,this.render=m,this.renderInstances=p,this.renderMultiDraw=_}function rA(r){const t={geometries:0,textures:0},i={frame:0,calls:0,triangles:0,points:0,lines:0};function s(c,f,d){switch(i.calls++,f){case r.TRIANGLES:i.triangles+=d*(c/3);break;case r.LINES:i.lines+=d*(c/2);break;case r.LINE_STRIP:i.lines+=d*(c-1);break;case r.LINE_LOOP:i.lines+=d*c;break;case r.POINTS:i.points+=d*c;break;default:Oe("WebGLInfo: Unknown draw mode:",f);break}}function l(){i.calls=0,i.triangles=0,i.points=0,i.lines=0}return{memory:t,render:i,programs:null,autoReset:!0,reset:l,update:s}}function oA(r,t,i){const s=new WeakMap,l=new gn;function c(f,d,m){const p=f.morphTargetInfluences,_=d.morphAttributes.position||d.morphAttributes.normal||d.morphAttributes.color,v=_!==void 0?_.length:0;let g=s.get(d);if(g===void 0||g.count!==v){let D=function(){L.dispose(),s.delete(d),d.removeEventListener("dispose",D)};g!==void 0&&g.texture.dispose();const x=d.morphAttributes.position!==void 0,b=d.morphAttributes.normal!==void 0,A=d.morphAttributes.color!==void 0,M=d.morphAttributes.position||[],S=d.morphAttributes.normal||[],O=d.morphAttributes.color||[];let U=0;x===!0&&(U=1),b===!0&&(U=2),A===!0&&(U=3);let w=d.attributes.position.count*U,z=1;w>t.maxTextureSize&&(z=Math.ceil(w/t.maxTextureSize),w=t.maxTextureSize);const N=new Float32Array(w*z*4*v),L=new ox(N,w,z,v);L.type=Wi,L.needsUpdate=!0;const E=U*4;for(let F=0;F<v;F++){const H=M[F],X=S[F],ct=O[F],ut=w*z*4*F;for(let Z=0;Z<H.count;Z++){const P=Z*E;x===!0&&(l.fromBufferAttribute(H,Z),N[ut+P+0]=l.x,N[ut+P+1]=l.y,N[ut+P+2]=l.z,N[ut+P+3]=0),b===!0&&(l.fromBufferAttribute(X,Z),N[ut+P+4]=l.x,N[ut+P+5]=l.y,N[ut+P+6]=l.z,N[ut+P+7]=0),A===!0&&(l.fromBufferAttribute(ct,Z),N[ut+P+8]=l.x,N[ut+P+9]=l.y,N[ut+P+10]=l.z,N[ut+P+11]=ct.itemSize===4?l.w:1)}}g={count:v,texture:L,size:new ae(w,z)},s.set(d,g),d.addEventListener("dispose",D)}if(f.isInstancedMesh===!0&&f.morphTexture!==null)m.getUniforms().setValue(r,"morphTexture",f.morphTexture,i);else{let x=0;for(let A=0;A<p.length;A++)x+=p[A];const b=d.morphTargetsRelative?1:1-x;m.getUniforms().setValue(r,"morphTargetBaseInfluence",b),m.getUniforms().setValue(r,"morphTargetInfluences",p)}m.getUniforms().setValue(r,"morphTargetsTexture",g.texture,i),m.getUniforms().setValue(r,"morphTargetsTextureSize",g.size)}return{update:c}}function lA(r,t,i,s,l){let c=new WeakMap;function f(p){const _=l.render.frame,v=p.geometry,g=t.get(p,v);if(c.get(g)!==_&&(t.update(g),c.set(g,_)),p.isInstancedMesh&&(p.hasEventListener("dispose",m)===!1&&p.addEventListener("dispose",m),c.get(p)!==_&&(i.update(p.instanceMatrix,r.ARRAY_BUFFER),p.instanceColor!==null&&i.update(p.instanceColor,r.ARRAY_BUFFER),c.set(p,_))),p.isSkinnedMesh){const x=p.skeleton;c.get(x)!==_&&(x.update(),c.set(x,_))}return g}function d(){c=new WeakMap}function m(p){const _=p.target;_.removeEventListener("dispose",m),s.releaseStatesOfObject(_),i.remove(_.instanceMatrix),_.instanceColor!==null&&i.remove(_.instanceColor)}return{update:f,dispose:d}}const cA={[Yv]:"LINEAR_TONE_MAPPING",[Zv]:"REINHARD_TONE_MAPPING",[Kv]:"CINEON_TONE_MAPPING",[dp]:"ACES_FILMIC_TONE_MAPPING",[Qv]:"AGX_TONE_MAPPING",[jv]:"NEUTRAL_TONE_MAPPING",[Jv]:"CUSTOM_TONE_MAPPING"};function uA(r,t,i,s,l,c){const f=new aa(t,i,{type:r,depthBuffer:l,stencilBuffer:c,samples:s?4:0,depthTexture:l?new eo(t,i):void 0}),d=new aa(t,i,{type:za,depthBuffer:!1,stencilBuffer:!1}),m=new Ln;m.setAttribute("position",new ke([-1,3,0,-1,-1,0,3,-1,0],3)),m.setAttribute("uv",new ke([0,2,0,0,2,0],2));const p=new J1({uniforms:{tDiffuse:{value:null}},vertexShader:`
			precision highp float;

			uniform mat4 modelViewMatrix;
			uniform mat4 projectionMatrix;

			attribute vec3 position;
			attribute vec2 uv;

			varying vec2 vUv;

			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			}`,fragmentShader:`
			precision highp float;

			uniform sampler2D tDiffuse;

			varying vec2 vUv;

			#include <tonemapping_pars_fragment>
			#include <colorspace_pars_fragment>

			void main() {
				gl_FragColor = texture2D( tDiffuse, vUv );

				#ifdef LINEAR_TONE_MAPPING
					gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );
				#elif defined( REINHARD_TONE_MAPPING )
					gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );
				#elif defined( CINEON_TONE_MAPPING )
					gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );
				#elif defined( ACES_FILMIC_TONE_MAPPING )
					gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );
				#elif defined( AGX_TONE_MAPPING )
					gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );
				#elif defined( NEUTRAL_TONE_MAPPING )
					gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );
				#elif defined( CUSTOM_TONE_MAPPING )
					gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );
				#endif

				#ifdef SRGB_TRANSFER
					gl_FragColor = sRGBTransferOETF( gl_FragColor );
				#endif
			}`,depthTest:!1,depthWrite:!1}),_=new ie(m,p),v=new Lp(-1,1,1,-1,0,1);let g=null,x=null,b=!1,A,M=null,S=[],O=!1;this.setSize=function(U,w){f.setSize(U,w),d.setSize(U,w);for(let z=0;z<S.length;z++){const N=S[z];N.setSize&&N.setSize(U,w)}},this.setEffects=function(U){S=U,O=S.length>0&&S[0].isRenderPass===!0;const w=f.width,z=f.height;for(let N=0;N<S.length;N++){const L=S[N];L.setSize&&L.setSize(w,z)}},this.begin=function(U,w){if(b||U.toneMapping===ia&&S.length===0)return!1;if(M=w,w!==null){const z=w.width,N=w.height;(f.width!==z||f.height!==N)&&this.setSize(z,N)}return O===!1&&U.setRenderTarget(f),A=U.toneMapping,U.toneMapping=ia,!0},this.hasRenderPass=function(){return O},this.end=function(U,w){U.toneMapping=A,b=!0;let z=f,N=d;for(let L=0;L<S.length;L++){const E=S[L];if(E.enabled!==!1&&(E.render(U,N,z,w),E.needsSwap!==!1)){const D=z;z=N,N=D}}if(g!==U.outputColorSpace||x!==U.toneMapping){g=U.outputColorSpace,x=U.toneMapping,p.defines={},Ne.getTransfer(g)===Je&&(p.defines.SRGB_TRANSFER="");const L=cA[x];L&&(p.defines[L]=""),p.needsUpdate=!0}p.uniforms.tDiffuse.value=z.texture,U.setRenderTarget(M),U.render(_,v),M=null,b=!1},this.isCompositing=function(){return b},this.dispose=function(){f.depthTexture&&f.depthTexture.dispose(),f.dispose(),d.dispose(),m.dispose(),p.dispose()}}const Ex=new kn,cp=new eo(1,1),Tx=new ox,Ax=new f1,wx=new px,yv=[],Mv=[],bv=new Float32Array(16),Ev=new Float32Array(9),Tv=new Float32Array(4);function oo(r,t,i){const s=r[0];if(s<=0||s>0)return r;const l=t*i;let c=yv[l];if(c===void 0&&(c=new Float32Array(l),yv[l]=c),t!==0){s.toArray(c,0);for(let f=1,d=0;f!==t;++f)d+=i,r[f].toArray(c,d)}return c}function On(r,t){if(r.length!==t.length)return!1;for(let i=0,s=r.length;i<s;i++)if(r[i]!==t[i])return!1;return!0}function Pn(r,t){for(let i=0,s=t.length;i<s;i++)r[i]=t[i]}function bu(r,t){let i=Mv[t];i===void 0&&(i=new Int32Array(t),Mv[t]=i);for(let s=0;s!==t;++s)i[s]=r.allocateTextureUnit();return i}function fA(r,t){const i=this.cache;i[0]!==t&&(r.uniform1f(this.addr,t),i[0]=t)}function hA(r,t){const i=this.cache;if(t.x!==void 0)(i[0]!==t.x||i[1]!==t.y)&&(r.uniform2f(this.addr,t.x,t.y),i[0]=t.x,i[1]=t.y);else{if(On(i,t))return;r.uniform2fv(this.addr,t),Pn(i,t)}}function dA(r,t){const i=this.cache;if(t.x!==void 0)(i[0]!==t.x||i[1]!==t.y||i[2]!==t.z)&&(r.uniform3f(this.addr,t.x,t.y,t.z),i[0]=t.x,i[1]=t.y,i[2]=t.z);else if(t.r!==void 0)(i[0]!==t.r||i[1]!==t.g||i[2]!==t.b)&&(r.uniform3f(this.addr,t.r,t.g,t.b),i[0]=t.r,i[1]=t.g,i[2]=t.b);else{if(On(i,t))return;r.uniform3fv(this.addr,t),Pn(i,t)}}function pA(r,t){const i=this.cache;if(t.x!==void 0)(i[0]!==t.x||i[1]!==t.y||i[2]!==t.z||i[3]!==t.w)&&(r.uniform4f(this.addr,t.x,t.y,t.z,t.w),i[0]=t.x,i[1]=t.y,i[2]=t.z,i[3]=t.w);else{if(On(i,t))return;r.uniform4fv(this.addr,t),Pn(i,t)}}function mA(r,t){const i=this.cache,s=t.elements;if(s===void 0){if(On(i,t))return;r.uniformMatrix2fv(this.addr,!1,t),Pn(i,t)}else{if(On(i,s))return;Tv.set(s),r.uniformMatrix2fv(this.addr,!1,Tv),Pn(i,s)}}function gA(r,t){const i=this.cache,s=t.elements;if(s===void 0){if(On(i,t))return;r.uniformMatrix3fv(this.addr,!1,t),Pn(i,t)}else{if(On(i,s))return;Ev.set(s),r.uniformMatrix3fv(this.addr,!1,Ev),Pn(i,s)}}function _A(r,t){const i=this.cache,s=t.elements;if(s===void 0){if(On(i,t))return;r.uniformMatrix4fv(this.addr,!1,t),Pn(i,t)}else{if(On(i,s))return;bv.set(s),r.uniformMatrix4fv(this.addr,!1,bv),Pn(i,s)}}function vA(r,t){const i=this.cache;i[0]!==t&&(r.uniform1i(this.addr,t),i[0]=t)}function xA(r,t){const i=this.cache;if(t.x!==void 0)(i[0]!==t.x||i[1]!==t.y)&&(r.uniform2i(this.addr,t.x,t.y),i[0]=t.x,i[1]=t.y);else{if(On(i,t))return;r.uniform2iv(this.addr,t),Pn(i,t)}}function SA(r,t){const i=this.cache;if(t.x!==void 0)(i[0]!==t.x||i[1]!==t.y||i[2]!==t.z)&&(r.uniform3i(this.addr,t.x,t.y,t.z),i[0]=t.x,i[1]=t.y,i[2]=t.z);else{if(On(i,t))return;r.uniform3iv(this.addr,t),Pn(i,t)}}function yA(r,t){const i=this.cache;if(t.x!==void 0)(i[0]!==t.x||i[1]!==t.y||i[2]!==t.z||i[3]!==t.w)&&(r.uniform4i(this.addr,t.x,t.y,t.z,t.w),i[0]=t.x,i[1]=t.y,i[2]=t.z,i[3]=t.w);else{if(On(i,t))return;r.uniform4iv(this.addr,t),Pn(i,t)}}function MA(r,t){const i=this.cache;i[0]!==t&&(r.uniform1ui(this.addr,t),i[0]=t)}function bA(r,t){const i=this.cache;if(t.x!==void 0)(i[0]!==t.x||i[1]!==t.y)&&(r.uniform2ui(this.addr,t.x,t.y),i[0]=t.x,i[1]=t.y);else{if(On(i,t))return;r.uniform2uiv(this.addr,t),Pn(i,t)}}function EA(r,t){const i=this.cache;if(t.x!==void 0)(i[0]!==t.x||i[1]!==t.y||i[2]!==t.z)&&(r.uniform3ui(this.addr,t.x,t.y,t.z),i[0]=t.x,i[1]=t.y,i[2]=t.z);else{if(On(i,t))return;r.uniform3uiv(this.addr,t),Pn(i,t)}}function TA(r,t){const i=this.cache;if(t.x!==void 0)(i[0]!==t.x||i[1]!==t.y||i[2]!==t.z||i[3]!==t.w)&&(r.uniform4ui(this.addr,t.x,t.y,t.z,t.w),i[0]=t.x,i[1]=t.y,i[2]=t.z,i[3]=t.w);else{if(On(i,t))return;r.uniform4uiv(this.addr,t),Pn(i,t)}}function AA(r,t,i){const s=this.cache,l=i.allocateTextureUnit();s[0]!==l&&(r.uniform1i(this.addr,l),s[0]=l);let c;this.type===r.SAMPLER_2D_SHADOW?(cp.compareFunction=i.isReversedDepthBuffer()?Mp:yp,c=cp):c=Ex,i.setTexture2D(t||c,l)}function wA(r,t,i){const s=this.cache,l=i.allocateTextureUnit();s[0]!==l&&(r.uniform1i(this.addr,l),s[0]=l),i.setTexture3D(t||Ax,l)}function RA(r,t,i){const s=this.cache,l=i.allocateTextureUnit();s[0]!==l&&(r.uniform1i(this.addr,l),s[0]=l),i.setTextureCube(t||wx,l)}function CA(r,t,i){const s=this.cache,l=i.allocateTextureUnit();s[0]!==l&&(r.uniform1i(this.addr,l),s[0]=l),i.setTexture2DArray(t||Tx,l)}function DA(r){switch(r){case 5126:return fA;case 35664:return hA;case 35665:return dA;case 35666:return pA;case 35674:return mA;case 35675:return gA;case 35676:return _A;case 5124:case 35670:return vA;case 35667:case 35671:return xA;case 35668:case 35672:return SA;case 35669:case 35673:return yA;case 5125:return MA;case 36294:return bA;case 36295:return EA;case 36296:return TA;case 35678:case 36198:case 36298:case 36306:case 35682:return AA;case 35679:case 36299:case 36307:return wA;case 35680:case 36300:case 36308:case 36293:return RA;case 36289:case 36303:case 36311:case 36292:return CA}}function UA(r,t){r.uniform1fv(this.addr,t)}function NA(r,t){const i=oo(t,this.size,2);r.uniform2fv(this.addr,i)}function LA(r,t){const i=oo(t,this.size,3);r.uniform3fv(this.addr,i)}function OA(r,t){const i=oo(t,this.size,4);r.uniform4fv(this.addr,i)}function PA(r,t){const i=oo(t,this.size,4);r.uniformMatrix2fv(this.addr,!1,i)}function zA(r,t){const i=oo(t,this.size,9);r.uniformMatrix3fv(this.addr,!1,i)}function BA(r,t){const i=oo(t,this.size,16);r.uniformMatrix4fv(this.addr,!1,i)}function IA(r,t){r.uniform1iv(this.addr,t)}function FA(r,t){r.uniform2iv(this.addr,t)}function HA(r,t){r.uniform3iv(this.addr,t)}function GA(r,t){r.uniform4iv(this.addr,t)}function VA(r,t){r.uniform1uiv(this.addr,t)}function kA(r,t){r.uniform2uiv(this.addr,t)}function XA(r,t){r.uniform3uiv(this.addr,t)}function WA(r,t){r.uniform4uiv(this.addr,t)}function qA(r,t,i){const s=this.cache,l=t.length,c=bu(i,l);On(s,c)||(r.uniform1iv(this.addr,c),Pn(s,c));let f;this.type===r.SAMPLER_2D_SHADOW?f=cp:f=Ex;for(let d=0;d!==l;++d)i.setTexture2D(t[d]||f,c[d])}function YA(r,t,i){const s=this.cache,l=t.length,c=bu(i,l);On(s,c)||(r.uniform1iv(this.addr,c),Pn(s,c));for(let f=0;f!==l;++f)i.setTexture3D(t[f]||Ax,c[f])}function ZA(r,t,i){const s=this.cache,l=t.length,c=bu(i,l);On(s,c)||(r.uniform1iv(this.addr,c),Pn(s,c));for(let f=0;f!==l;++f)i.setTextureCube(t[f]||wx,c[f])}function KA(r,t,i){const s=this.cache,l=t.length,c=bu(i,l);On(s,c)||(r.uniform1iv(this.addr,c),Pn(s,c));for(let f=0;f!==l;++f)i.setTexture2DArray(t[f]||Tx,c[f])}function JA(r){switch(r){case 5126:return UA;case 35664:return NA;case 35665:return LA;case 35666:return OA;case 35674:return PA;case 35675:return zA;case 35676:return BA;case 5124:case 35670:return IA;case 35667:case 35671:return FA;case 35668:case 35672:return HA;case 35669:case 35673:return GA;case 5125:return VA;case 36294:return kA;case 36295:return XA;case 36296:return WA;case 35678:case 36198:case 36298:case 36306:case 35682:return qA;case 35679:case 36299:case 36307:return YA;case 35680:case 36300:case 36308:case 36293:return ZA;case 36289:case 36303:case 36311:case 36292:return KA}}class QA{constructor(t,i,s){this.id=t,this.addr=s,this.cache=[],this.type=i.type,this.setValue=DA(i.type)}}class jA{constructor(t,i,s){this.id=t,this.addr=s,this.cache=[],this.type=i.type,this.size=i.size,this.setValue=JA(i.type)}}class $A{constructor(t){this.id=t,this.seq=[],this.map={}}setValue(t,i,s){const l=this.seq;for(let c=0,f=l.length;c!==f;++c){const d=l[c];d.setValue(t,i[d.id],s)}}}const md=/(\w+)(\])?(\[|\.)?/g;function Av(r,t){r.seq.push(t),r.map[t.id]=t}function t2(r,t,i){const s=r.name,l=s.length;for(md.lastIndex=0;;){const c=md.exec(s),f=md.lastIndex;let d=c[1];const m=c[2]==="]",p=c[3];if(m&&(d=d|0),p===void 0||p==="["&&f+2===l){Av(i,p===void 0?new QA(d,r,t):new jA(d,r,t));break}else{let v=i.map[d];v===void 0&&(v=new $A(d),Av(i,v)),i=v}}}class uu{constructor(t,i){this.seq=[],this.map={};const s=t.getProgramParameter(i,t.ACTIVE_UNIFORMS);for(let f=0;f<s;++f){const d=t.getActiveUniform(i,f),m=t.getUniformLocation(i,d.name);t2(d,m,this)}const l=[],c=[];for(const f of this.seq)f.type===t.SAMPLER_2D_SHADOW||f.type===t.SAMPLER_CUBE_SHADOW||f.type===t.SAMPLER_2D_ARRAY_SHADOW?l.push(f):c.push(f);l.length>0&&(this.seq=l.concat(c))}setValue(t,i,s,l){const c=this.map[i];c!==void 0&&c.setValue(t,s,l)}setOptional(t,i,s){const l=i[s];l!==void 0&&this.setValue(t,s,l)}static upload(t,i,s,l){for(let c=0,f=i.length;c!==f;++c){const d=i[c],m=s[d.id];m.needsUpdate!==!1&&d.setValue(t,m.value,l)}}static seqWithValue(t,i){const s=[];for(let l=0,c=t.length;l!==c;++l){const f=t[l];f.id in i&&s.push(f)}return s}}function wv(r,t,i){const s=r.createShader(t);return r.shaderSource(s,i),r.compileShader(s),s}const e2=37297;let n2=0;function i2(r,t){const i=r.split(`
`),s=[],l=Math.max(t-6,0),c=Math.min(t+6,i.length);for(let f=l;f<c;f++){const d=f+1;s.push(`${d===t?">":" "} ${d}: ${i[f]}`)}return s.join(`
`)}const Rv=new me;function a2(r){Ne._getMatrix(Rv,Ne.workingColorSpace,r);const t=`mat3( ${Rv.elements.map(i=>i.toFixed(4))} )`;switch(Ne.getTransfer(r)){case mu:return[t,"LinearTransferOETF"];case Je:return[t,"sRGBTransferOETF"];default:return ue("WebGLProgram: Unsupported color space: ",r),[t,"LinearTransferOETF"]}}function Cv(r,t,i){const s=r.getShaderParameter(t,r.COMPILE_STATUS),c=(r.getShaderInfoLog(t)||"").trim();if(s&&c==="")return"";const f=/ERROR: 0:(\d+)/.exec(c);if(f){const d=parseInt(f[1]);return i.toUpperCase()+`

`+c+`

`+i2(r.getShaderSource(t),d)}else return c}function s2(r,t){const i=a2(t);return[`vec4 ${r}( vec4 value ) {`,`	return ${i[1]}( vec4( value.rgb * ${i[0]}, value.a ) );`,"}"].join(`
`)}const r2={[Yv]:"Linear",[Zv]:"Reinhard",[Kv]:"Cineon",[dp]:"ACESFilmic",[Qv]:"AgX",[jv]:"Neutral",[Jv]:"Custom"};function o2(r,t){const i=r2[t];return i===void 0?(ue("WebGLProgram: Unsupported toneMapping:",t),"vec3 "+r+"( vec3 color ) { return LinearToneMapping( color ); }"):"vec3 "+r+"( vec3 color ) { return "+i+"ToneMapping( color ); }"}const nu=new V;function l2(){Ne.getLuminanceCoefficients(nu);const r=nu.x.toFixed(4),t=nu.y.toFixed(4),i=nu.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${r}, ${t}, ${i} );`,"	return dot( weights, rgb );","}"].join(`
`)}function c2(r){return[r.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",r.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(ll).join(`
`)}function u2(r){const t=[];for(const i in r){const s=r[i];s!==!1&&t.push("#define "+i+" "+s)}return t.join(`
`)}function f2(r,t){const i={},s=r.getProgramParameter(t,r.ACTIVE_ATTRIBUTES);for(let l=0;l<s;l++){const c=r.getActiveAttrib(t,l),f=c.name;let d=1;c.type===r.FLOAT_MAT2&&(d=2),c.type===r.FLOAT_MAT3&&(d=3),c.type===r.FLOAT_MAT4&&(d=4),i[f]={type:c.type,location:r.getAttribLocation(t,f),locationSize:d}}return i}function ll(r){return r!==""}function Dv(r,t){const i=t.numSpotLightShadows+t.numSpotLightMaps-t.numSpotLightShadowsWithMaps;return r.replace(/NUM_DIR_LIGHTS/g,t.numDirLights).replace(/NUM_SPOT_LIGHTS/g,t.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,t.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,i).replace(/NUM_RECT_AREA_LIGHTS/g,t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,t.numPointLights).replace(/NUM_HEMI_LIGHTS/g,t.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,t.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,t.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,t.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,t.numPointLightShadows)}function Uv(r,t){return r.replace(/NUM_CLIPPING_PLANES/g,t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,t.numClippingPlanes-t.numClipIntersection)}const h2=/^[ \t]*#include +<([\w\d./]+)>/gm;function up(r){return r.replace(h2,p2)}const d2=new Map;function p2(r,t){let i=be[t];if(i===void 0){const s=d2.get(t);if(s!==void 0)i=be[s],ue('WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',t,s);else throw new Error("THREE.WebGLProgram: Can not resolve #include <"+t+">")}return up(i)}const m2=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function Nv(r){return r.replace(m2,g2)}function g2(r,t,i,s){let l="";for(let c=parseInt(t);c<parseInt(i);c++)l+=s.replace(/\[\s*i\s*\]/g,"[ "+c+" ]").replace(/UNROLLED_LOOP_INDEX/g,c);return l}function Lv(r){let t=`precision ${r.precision} float;
	precision ${r.precision} int;
	precision ${r.precision} sampler2D;
	precision ${r.precision} samplerCube;
	precision ${r.precision} sampler3D;
	precision ${r.precision} sampler2DArray;
	precision ${r.precision} sampler2DShadow;
	precision ${r.precision} samplerCubeShadow;
	precision ${r.precision} sampler2DArrayShadow;
	precision ${r.precision} isampler2D;
	precision ${r.precision} isampler3D;
	precision ${r.precision} isamplerCube;
	precision ${r.precision} isampler2DArray;
	precision ${r.precision} usampler2D;
	precision ${r.precision} usampler3D;
	precision ${r.precision} usamplerCube;
	precision ${r.precision} usampler2DArray;
	`;return r.precision==="highp"?t+=`
#define HIGH_PRECISION`:r.precision==="mediump"?t+=`
#define MEDIUM_PRECISION`:r.precision==="lowp"&&(t+=`
#define LOW_PRECISION`),t}const _2={[cl]:"SHADOWMAP_TYPE_PCF",[ol]:"SHADOWMAP_TYPE_VSM"};function v2(r){return _2[r.shadowMapType]||"SHADOWMAP_TYPE_BASIC"}const x2={[Qs]:"ENVMAP_TYPE_CUBE",[to]:"ENVMAP_TYPE_CUBE",[xu]:"ENVMAP_TYPE_CUBE_UV"};function S2(r){return r.envMap===!1?"ENVMAP_TYPE_CUBE":x2[r.envMapMode]||"ENVMAP_TYPE_CUBE"}const y2={[to]:"ENVMAP_MODE_REFRACTION"};function M2(r){return r.envMap===!1?"ENVMAP_MODE_REFLECTION":y2[r.envMapMode]||"ENVMAP_MODE_REFLECTION"}const b2={[qv]:"ENVMAP_BLENDING_MULTIPLY",[CM]:"ENVMAP_BLENDING_MIX",[DM]:"ENVMAP_BLENDING_ADD"};function E2(r){return r.envMap===!1?"ENVMAP_BLENDING_NONE":b2[r.combine]||"ENVMAP_BLENDING_NONE"}function T2(r){const t=r.envMapCubeUVHeight;if(t===null)return null;const i=Math.log2(t)-2,s=1/t;return{texelWidth:1/(3*Math.max(Math.pow(2,i),112)),texelHeight:s,maxMip:i}}function A2(r,t,i,s){const l=r.getContext(),c=i.defines;let f=i.vertexShader,d=i.fragmentShader;const m=v2(i),p=S2(i),_=M2(i),v=E2(i),g=T2(i),x=c2(i),b=u2(c),A=l.createProgram();let M,S,O=i.glslVersion?"#version "+i.glslVersion+`
`:"";i.isRawShaderMaterial?(M=["#define SHADER_TYPE "+i.shaderType,"#define SHADER_NAME "+i.shaderName,b].filter(ll).join(`
`),M.length>0&&(M+=`
`),S=["#define SHADER_TYPE "+i.shaderType,"#define SHADER_NAME "+i.shaderName,b].filter(ll).join(`
`),S.length>0&&(S+=`
`)):(M=[Lv(i),"#define SHADER_TYPE "+i.shaderType,"#define SHADER_NAME "+i.shaderName,b,i.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",i.batching?"#define USE_BATCHING":"",i.batchingColor?"#define USE_BATCHING_COLOR":"",i.instancing?"#define USE_INSTANCING":"",i.instancingColor?"#define USE_INSTANCING_COLOR":"",i.instancingMorph?"#define USE_INSTANCING_MORPH":"",i.useFog&&i.fog?"#define USE_FOG":"",i.useFog&&i.fogExp2?"#define FOG_EXP2":"",i.map?"#define USE_MAP":"",i.envMap?"#define USE_ENVMAP":"",i.envMap?"#define "+_:"",i.lightMap?"#define USE_LIGHTMAP":"",i.aoMap?"#define USE_AOMAP":"",i.bumpMap?"#define USE_BUMPMAP":"",i.normalMap?"#define USE_NORMALMAP":"",i.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",i.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",i.displacementMap?"#define USE_DISPLACEMENTMAP":"",i.emissiveMap?"#define USE_EMISSIVEMAP":"",i.anisotropy?"#define USE_ANISOTROPY":"",i.anisotropyMap?"#define USE_ANISOTROPYMAP":"",i.clearcoatMap?"#define USE_CLEARCOATMAP":"",i.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",i.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",i.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",i.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",i.specularMap?"#define USE_SPECULARMAP":"",i.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",i.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",i.roughnessMap?"#define USE_ROUGHNESSMAP":"",i.metalnessMap?"#define USE_METALNESSMAP":"",i.alphaMap?"#define USE_ALPHAMAP":"",i.alphaHash?"#define USE_ALPHAHASH":"",i.transmission?"#define USE_TRANSMISSION":"",i.transmissionMap?"#define USE_TRANSMISSIONMAP":"",i.thicknessMap?"#define USE_THICKNESSMAP":"",i.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",i.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",i.mapUv?"#define MAP_UV "+i.mapUv:"",i.alphaMapUv?"#define ALPHAMAP_UV "+i.alphaMapUv:"",i.lightMapUv?"#define LIGHTMAP_UV "+i.lightMapUv:"",i.aoMapUv?"#define AOMAP_UV "+i.aoMapUv:"",i.emissiveMapUv?"#define EMISSIVEMAP_UV "+i.emissiveMapUv:"",i.bumpMapUv?"#define BUMPMAP_UV "+i.bumpMapUv:"",i.normalMapUv?"#define NORMALMAP_UV "+i.normalMapUv:"",i.displacementMapUv?"#define DISPLACEMENTMAP_UV "+i.displacementMapUv:"",i.metalnessMapUv?"#define METALNESSMAP_UV "+i.metalnessMapUv:"",i.roughnessMapUv?"#define ROUGHNESSMAP_UV "+i.roughnessMapUv:"",i.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+i.anisotropyMapUv:"",i.clearcoatMapUv?"#define CLEARCOATMAP_UV "+i.clearcoatMapUv:"",i.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+i.clearcoatNormalMapUv:"",i.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+i.clearcoatRoughnessMapUv:"",i.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+i.iridescenceMapUv:"",i.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+i.iridescenceThicknessMapUv:"",i.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+i.sheenColorMapUv:"",i.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+i.sheenRoughnessMapUv:"",i.specularMapUv?"#define SPECULARMAP_UV "+i.specularMapUv:"",i.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+i.specularColorMapUv:"",i.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+i.specularIntensityMapUv:"",i.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+i.transmissionMapUv:"",i.thicknessMapUv?"#define THICKNESSMAP_UV "+i.thicknessMapUv:"",i.vertexTangents&&i.flatShading===!1?"#define USE_TANGENT":"",i.vertexNormals?"#define HAS_NORMAL":"",i.vertexColors?"#define USE_COLOR":"",i.vertexAlphas?"#define USE_COLOR_ALPHA":"",i.vertexUv1s?"#define USE_UV1":"",i.vertexUv2s?"#define USE_UV2":"",i.vertexUv3s?"#define USE_UV3":"",i.pointsUvs?"#define USE_POINTS_UV":"",i.flatShading?"#define FLAT_SHADED":"",i.skinning?"#define USE_SKINNING":"",i.morphTargets?"#define USE_MORPHTARGETS":"",i.morphNormals&&i.flatShading===!1?"#define USE_MORPHNORMALS":"",i.morphColors?"#define USE_MORPHCOLORS":"",i.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+i.morphTextureStride:"",i.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+i.morphTargetsCount:"",i.doubleSided?"#define DOUBLE_SIDED":"",i.flipSided?"#define FLIP_SIDED":"",i.shadowMapEnabled?"#define USE_SHADOWMAP":"",i.shadowMapEnabled?"#define "+m:"",i.sizeAttenuation?"#define USE_SIZEATTENUATION":"",i.numLightProbes>0?"#define USE_LIGHT_PROBES":"",i.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",i.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(ll).join(`
`),S=[Lv(i),"#define SHADER_TYPE "+i.shaderType,"#define SHADER_NAME "+i.shaderName,b,i.useFog&&i.fog?"#define USE_FOG":"",i.useFog&&i.fogExp2?"#define FOG_EXP2":"",i.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",i.map?"#define USE_MAP":"",i.matcap?"#define USE_MATCAP":"",i.envMap?"#define USE_ENVMAP":"",i.envMap?"#define "+p:"",i.envMap?"#define "+_:"",i.envMap?"#define "+v:"",g?"#define CUBEUV_TEXEL_WIDTH "+g.texelWidth:"",g?"#define CUBEUV_TEXEL_HEIGHT "+g.texelHeight:"",g?"#define CUBEUV_MAX_MIP "+g.maxMip+".0":"",i.lightMap?"#define USE_LIGHTMAP":"",i.aoMap?"#define USE_AOMAP":"",i.bumpMap?"#define USE_BUMPMAP":"",i.normalMap?"#define USE_NORMALMAP":"",i.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",i.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",i.packedNormalMap?"#define USE_PACKED_NORMALMAP":"",i.emissiveMap?"#define USE_EMISSIVEMAP":"",i.anisotropy?"#define USE_ANISOTROPY":"",i.anisotropyMap?"#define USE_ANISOTROPYMAP":"",i.clearcoat?"#define USE_CLEARCOAT":"",i.clearcoatMap?"#define USE_CLEARCOATMAP":"",i.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",i.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",i.dispersion?"#define USE_DISPERSION":"",i.iridescence?"#define USE_IRIDESCENCE":"",i.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",i.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",i.specularMap?"#define USE_SPECULARMAP":"",i.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",i.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",i.roughnessMap?"#define USE_ROUGHNESSMAP":"",i.metalnessMap?"#define USE_METALNESSMAP":"",i.alphaMap?"#define USE_ALPHAMAP":"",i.alphaTest?"#define USE_ALPHATEST":"",i.alphaHash?"#define USE_ALPHAHASH":"",i.sheen?"#define USE_SHEEN":"",i.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",i.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",i.transmission?"#define USE_TRANSMISSION":"",i.transmissionMap?"#define USE_TRANSMISSIONMAP":"",i.thicknessMap?"#define USE_THICKNESSMAP":"",i.vertexTangents&&i.flatShading===!1?"#define USE_TANGENT":"",i.vertexColors||i.instancingColor?"#define USE_COLOR":"",i.vertexAlphas||i.batchingColor?"#define USE_COLOR_ALPHA":"",i.vertexUv1s?"#define USE_UV1":"",i.vertexUv2s?"#define USE_UV2":"",i.vertexUv3s?"#define USE_UV3":"",i.pointsUvs?"#define USE_POINTS_UV":"",i.gradientMap?"#define USE_GRADIENTMAP":"",i.flatShading?"#define FLAT_SHADED":"",i.doubleSided?"#define DOUBLE_SIDED":"",i.flipSided?"#define FLIP_SIDED":"",i.shadowMapEnabled?"#define USE_SHADOWMAP":"",i.shadowMapEnabled?"#define "+m:"",i.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",i.numLightProbes>0?"#define USE_LIGHT_PROBES":"",i.numLightProbeGrids>0?"#define USE_LIGHT_PROBES_GRID":"",i.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",i.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",i.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",i.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",i.toneMapping!==ia?"#define TONE_MAPPING":"",i.toneMapping!==ia?be.tonemapping_pars_fragment:"",i.toneMapping!==ia?o2("toneMapping",i.toneMapping):"",i.dithering?"#define DITHERING":"",i.opaque?"#define OPAQUE":"",be.colorspace_pars_fragment,s2("linearToOutputTexel",i.outputColorSpace),l2(),i.useDepthPacking?"#define DEPTH_PACKING "+i.depthPacking:"",`
`].filter(ll).join(`
`)),f=up(f),f=Dv(f,i),f=Uv(f,i),d=up(d),d=Dv(d,i),d=Uv(d,i),f=Nv(f),d=Nv(d),i.isRawShaderMaterial!==!0&&(O=`#version 300 es
`,M=[x,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+M,S=["#define varying in",i.glslVersion===O_?"":"layout(location = 0) out highp vec4 pc_fragColor;",i.glslVersion===O_?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+S);const U=O+M+f,w=O+S+d,z=wv(l,l.VERTEX_SHADER,U),N=wv(l,l.FRAGMENT_SHADER,w);l.attachShader(A,z),l.attachShader(A,N),i.index0AttributeName!==void 0?l.bindAttribLocation(A,0,i.index0AttributeName):i.hasPositionAttribute===!0&&l.bindAttribLocation(A,0,"position"),l.linkProgram(A);function L(H){if(r.debug.checkShaderErrors){const X=l.getProgramInfoLog(A)||"",ct=l.getShaderInfoLog(z)||"",ut=l.getShaderInfoLog(N)||"",Z=X.trim(),P=ct.trim(),k=ut.trim();let tt=!0,_t=!0;if(l.getProgramParameter(A,l.LINK_STATUS)===!1)if(tt=!1,typeof r.debug.onShaderError=="function")r.debug.onShaderError(l,A,z,N);else{const Et=Cv(l,z,"vertex"),B=Cv(l,N,"fragment");Oe("WebGLProgram: Shader Error "+l.getError()+" - VALIDATE_STATUS "+l.getProgramParameter(A,l.VALIDATE_STATUS)+`

Material Name: `+H.name+`
Material Type: `+H.type+`

Program Info Log: `+Z+`
`+Et+`
`+B)}else Z!==""?ue("WebGLProgram: Program Info Log:",Z):(P===""||k==="")&&(_t=!1);_t&&(H.diagnostics={runnable:tt,programLog:Z,vertexShader:{log:P,prefix:M},fragmentShader:{log:k,prefix:S}})}l.deleteShader(z),l.deleteShader(N),E=new uu(l,A),D=f2(l,A)}let E;this.getUniforms=function(){return E===void 0&&L(this),E};let D;this.getAttributes=function(){return D===void 0&&L(this),D};let F=i.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return F===!1&&(F=l.getProgramParameter(A,e2)),F},this.destroy=function(){s.releaseStatesOfProgram(this),l.deleteProgram(A),this.program=void 0},this.type=i.shaderType,this.name=i.shaderName,this.id=n2++,this.cacheKey=t,this.usedTimes=1,this.program=A,this.vertexShader=z,this.fragmentShader=N,this}let w2=0;class R2{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(t,i,s){const l=this._getShaderCacheForMaterial(t);return l.has(i)===!1&&(l.add(i),i.usedTimes++),l.has(s)===!1&&(l.add(s),s.usedTimes++),this}remove(t){const i=this.materialCache.get(t);for(const s of i)s.usedTimes--,s.usedTimes===0&&this.shaderCache.delete(s.code);return this.materialCache.delete(t),this}getVertexShaderStage(t){return this._getShaderStage(t.vertexShader)}getFragmentShaderStage(t){return this._getShaderStage(t.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(t){const i=this.materialCache;let s=i.get(t);return s===void 0&&(s=new Set,i.set(t,s)),s}_getShaderStage(t){const i=this.shaderCache;let s=i.get(t);return s===void 0&&(s=new C2(t),i.set(t,s)),s}}class C2{constructor(t){this.id=w2++,this.code=t,this.usedTimes=0}}function D2(r){return r===js||r===hu||r===du}function U2(r,t,i,s,l,c){const f=new lx,d=new R2,m=new Set,p=[],_=new Map,v=s.logarithmicDepthBuffer;let g=s.precision;const x={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distance",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function b(E){return m.add(E),E===0?"uv":`uv${E}`}function A(E,D,F,H,X,ct){const ut=H.fog,Z=X.geometry,P=E.isMeshStandardMaterial||E.isMeshLambertMaterial||E.isMeshPhongMaterial?H.environment:null,k=E.isMeshStandardMaterial||E.isMeshLambertMaterial&&!E.envMap||E.isMeshPhongMaterial&&!E.envMap,tt=t.get(E.envMap||P,k),_t=tt&&tt.mapping===xu?tt.image.height:null,Et=x[E.type];E.precision!==null&&(g=s.getMaxPrecision(E.precision),g!==E.precision&&ue("WebGLProgram.getParameters:",E.precision,"not supported, using",g,"instead."));const B=Z.morphAttributes.position||Z.morphAttributes.normal||Z.morphAttributes.color,J=B!==void 0?B.length:0;let bt=0;Z.morphAttributes.position!==void 0&&(bt=1),Z.morphAttributes.normal!==void 0&&(bt=2),Z.morphAttributes.color!==void 0&&(bt=3);let Rt,Ut,et,yt;if(Et){const qt=ta[Et];Rt=qt.vertexShader,Ut=qt.fragmentShader}else{Rt=E.vertexShader,Ut=E.fragmentShader;const qt=d.getVertexShaderStage(E),ht=d.getFragmentShaderStage(E);d.update(E,qt,ht),et=qt.id,yt=ht.id}const Q=r.getRenderTarget(),gt=r.state.buffers.depth.getReversed(),zt=X.isInstancedMesh===!0,At=X.isBatchedMesh===!0,oe=!!E.map,Xt=!!E.matcap,fe=!!tt,ve=!!E.aoMap,ge=!!E.lightMap,Xe=!!E.bumpMap&&E.wireframe===!1,rn=!!E.normalMap,tn=!!E.displacementMap,mn=!!E.emissiveMap,Fe=!!E.metalnessMap,un=!!E.roughnessMap,Y=E.anisotropy>0,Me=E.clearcoat>0,Le=E.dispersion>0,I=E.iridescence>0,T=E.sheen>0,j=E.transmission>0,rt=Y&&!!E.anisotropyMap,pt=Me&&!!E.clearcoatMap,Dt=Me&&!!E.clearcoatNormalMap,Ot=Me&&!!E.clearcoatRoughnessMap,ft=I&&!!E.iridescenceMap,mt=I&&!!E.iridescenceThicknessMap,Lt=T&&!!E.sheenColorMap,kt=T&&!!E.sheenRoughnessMap,It=!!E.specularMap,Bt=!!E.specularColorMap,Yt=!!E.specularIntensityMap,te=j&&!!E.transmissionMap,le=j&&!!E.thicknessMap,q=!!E.gradientMap,Nt=!!E.alphaMap,vt=E.alphaTest>0,Pt=!!E.alphaHash,Ht=!!E.extensions;let Tt=ia;E.toneMapped&&(Q===null||Q.isXRRenderTarget===!0)&&(Tt=r.toneMapping);const jt={shaderID:Et,shaderType:E.type,shaderName:E.name,vertexShader:Rt,fragmentShader:Ut,defines:E.defines,customVertexShaderID:et,customFragmentShaderID:yt,isRawShaderMaterial:E.isRawShaderMaterial===!0,glslVersion:E.glslVersion,precision:g,batching:At,batchingColor:At&&X._colorsTexture!==null,instancing:zt,instancingColor:zt&&X.instanceColor!==null,instancingMorph:zt&&X.morphTexture!==null,outputColorSpace:Q===null?r.outputColorSpace:Q.isXRRenderTarget===!0?Q.texture.colorSpace:Ne.workingColorSpace,alphaToCoverage:!!E.alphaToCoverage,map:oe,matcap:Xt,envMap:fe,envMapMode:fe&&tt.mapping,envMapCubeUVHeight:_t,aoMap:ve,lightMap:ge,bumpMap:Xe,normalMap:rn,displacementMap:tn,emissiveMap:mn,normalMapObjectSpace:rn&&E.normalMapType===LM,normalMapTangentSpace:rn&&E.normalMapType===ap,packedNormalMap:rn&&E.normalMapType===ap&&D2(E.normalMap.format),metalnessMap:Fe,roughnessMap:un,anisotropy:Y,anisotropyMap:rt,clearcoat:Me,clearcoatMap:pt,clearcoatNormalMap:Dt,clearcoatRoughnessMap:Ot,dispersion:Le,iridescence:I,iridescenceMap:ft,iridescenceThicknessMap:mt,sheen:T,sheenColorMap:Lt,sheenRoughnessMap:kt,specularMap:It,specularColorMap:Bt,specularIntensityMap:Yt,transmission:j,transmissionMap:te,thicknessMap:le,gradientMap:q,opaque:E.transparent===!1&&E.blending===Jr&&E.alphaToCoverage===!1,alphaMap:Nt,alphaTest:vt,alphaHash:Pt,combine:E.combine,mapUv:oe&&b(E.map.channel),aoMapUv:ve&&b(E.aoMap.channel),lightMapUv:ge&&b(E.lightMap.channel),bumpMapUv:Xe&&b(E.bumpMap.channel),normalMapUv:rn&&b(E.normalMap.channel),displacementMapUv:tn&&b(E.displacementMap.channel),emissiveMapUv:mn&&b(E.emissiveMap.channel),metalnessMapUv:Fe&&b(E.metalnessMap.channel),roughnessMapUv:un&&b(E.roughnessMap.channel),anisotropyMapUv:rt&&b(E.anisotropyMap.channel),clearcoatMapUv:pt&&b(E.clearcoatMap.channel),clearcoatNormalMapUv:Dt&&b(E.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:Ot&&b(E.clearcoatRoughnessMap.channel),iridescenceMapUv:ft&&b(E.iridescenceMap.channel),iridescenceThicknessMapUv:mt&&b(E.iridescenceThicknessMap.channel),sheenColorMapUv:Lt&&b(E.sheenColorMap.channel),sheenRoughnessMapUv:kt&&b(E.sheenRoughnessMap.channel),specularMapUv:It&&b(E.specularMap.channel),specularColorMapUv:Bt&&b(E.specularColorMap.channel),specularIntensityMapUv:Yt&&b(E.specularIntensityMap.channel),transmissionMapUv:te&&b(E.transmissionMap.channel),thicknessMapUv:le&&b(E.thicknessMap.channel),alphaMapUv:Nt&&b(E.alphaMap.channel),vertexTangents:!!Z.attributes.tangent&&(rn||Y),vertexNormals:!!Z.attributes.normal,vertexColors:E.vertexColors,vertexAlphas:E.vertexColors===!0&&!!Z.attributes.color&&Z.attributes.color.itemSize===4,pointsUvs:X.isPoints===!0&&!!Z.attributes.uv&&(oe||Nt),fog:!!ut,useFog:E.fog===!0,fogExp2:!!ut&&ut.isFogExp2,flatShading:E.wireframe===!1&&(E.flatShading===!0||Z.attributes.normal===void 0&&rn===!1&&(E.isMeshLambertMaterial||E.isMeshPhongMaterial||E.isMeshStandardMaterial||E.isMeshPhysicalMaterial)),sizeAttenuation:E.sizeAttenuation===!0,logarithmicDepthBuffer:v,reversedDepthBuffer:gt,skinning:X.isSkinnedMesh===!0,hasPositionAttribute:Z.attributes.position!==void 0,morphTargets:Z.morphAttributes.position!==void 0,morphNormals:Z.morphAttributes.normal!==void 0,morphColors:Z.morphAttributes.color!==void 0,morphTargetsCount:J,morphTextureStride:bt,numDirLights:D.directional.length,numPointLights:D.point.length,numSpotLights:D.spot.length,numSpotLightMaps:D.spotLightMap.length,numRectAreaLights:D.rectArea.length,numHemiLights:D.hemi.length,numDirLightShadows:D.directionalShadowMap.length,numPointLightShadows:D.pointShadowMap.length,numSpotLightShadows:D.spotShadowMap.length,numSpotLightShadowsWithMaps:D.numSpotLightShadowsWithMaps,numLightProbes:D.numLightProbes,numLightProbeGrids:ct.length,numClippingPlanes:c.numPlanes,numClipIntersection:c.numIntersection,dithering:E.dithering,shadowMapEnabled:r.shadowMap.enabled&&F.length>0,shadowMapType:r.shadowMap.type,toneMapping:Tt,decodeVideoTexture:oe&&E.map.isVideoTexture===!0&&Ne.getTransfer(E.map.colorSpace)===Je,decodeVideoTextureEmissive:mn&&E.emissiveMap.isVideoTexture===!0&&Ne.getTransfer(E.emissiveMap.colorSpace)===Je,premultipliedAlpha:E.premultipliedAlpha,doubleSided:E.side===Na,flipSided:E.side===ni,useDepthPacking:E.depthPacking>=0,depthPacking:E.depthPacking||0,index0AttributeName:E.index0AttributeName,extensionClipCullDistance:Ht&&E.extensions.clipCullDistance===!0&&i.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(Ht&&E.extensions.multiDraw===!0||At)&&i.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:i.has("KHR_parallel_shader_compile"),customProgramCacheKey:E.customProgramCacheKey()};return jt.vertexUv1s=m.has(1),jt.vertexUv2s=m.has(2),jt.vertexUv3s=m.has(3),m.clear(),jt}function M(E){const D=[];if(E.shaderID?D.push(E.shaderID):(D.push(E.customVertexShaderID),D.push(E.customFragmentShaderID)),E.defines!==void 0)for(const F in E.defines)D.push(F),D.push(E.defines[F]);return E.isRawShaderMaterial===!1&&(S(D,E),O(D,E),D.push(r.outputColorSpace)),D.push(E.customProgramCacheKey),D.join()}function S(E,D){E.push(D.precision),E.push(D.outputColorSpace),E.push(D.envMapMode),E.push(D.envMapCubeUVHeight),E.push(D.mapUv),E.push(D.alphaMapUv),E.push(D.lightMapUv),E.push(D.aoMapUv),E.push(D.bumpMapUv),E.push(D.normalMapUv),E.push(D.displacementMapUv),E.push(D.emissiveMapUv),E.push(D.metalnessMapUv),E.push(D.roughnessMapUv),E.push(D.anisotropyMapUv),E.push(D.clearcoatMapUv),E.push(D.clearcoatNormalMapUv),E.push(D.clearcoatRoughnessMapUv),E.push(D.iridescenceMapUv),E.push(D.iridescenceThicknessMapUv),E.push(D.sheenColorMapUv),E.push(D.sheenRoughnessMapUv),E.push(D.specularMapUv),E.push(D.specularColorMapUv),E.push(D.specularIntensityMapUv),E.push(D.transmissionMapUv),E.push(D.thicknessMapUv),E.push(D.combine),E.push(D.fogExp2),E.push(D.sizeAttenuation),E.push(D.morphTargetsCount),E.push(D.morphAttributeCount),E.push(D.numDirLights),E.push(D.numPointLights),E.push(D.numSpotLights),E.push(D.numSpotLightMaps),E.push(D.numHemiLights),E.push(D.numRectAreaLights),E.push(D.numDirLightShadows),E.push(D.numPointLightShadows),E.push(D.numSpotLightShadows),E.push(D.numSpotLightShadowsWithMaps),E.push(D.numLightProbes),E.push(D.shadowMapType),E.push(D.toneMapping),E.push(D.numClippingPlanes),E.push(D.numClipIntersection),E.push(D.depthPacking)}function O(E,D){f.disableAll(),D.instancing&&f.enable(0),D.instancingColor&&f.enable(1),D.instancingMorph&&f.enable(2),D.matcap&&f.enable(3),D.envMap&&f.enable(4),D.normalMapObjectSpace&&f.enable(5),D.normalMapTangentSpace&&f.enable(6),D.clearcoat&&f.enable(7),D.iridescence&&f.enable(8),D.alphaTest&&f.enable(9),D.vertexColors&&f.enable(10),D.vertexAlphas&&f.enable(11),D.vertexUv1s&&f.enable(12),D.vertexUv2s&&f.enable(13),D.vertexUv3s&&f.enable(14),D.vertexTangents&&f.enable(15),D.anisotropy&&f.enable(16),D.alphaHash&&f.enable(17),D.batching&&f.enable(18),D.dispersion&&f.enable(19),D.batchingColor&&f.enable(20),D.gradientMap&&f.enable(21),D.packedNormalMap&&f.enable(22),D.vertexNormals&&f.enable(23),E.push(f.mask),f.disableAll(),D.fog&&f.enable(0),D.useFog&&f.enable(1),D.flatShading&&f.enable(2),D.logarithmicDepthBuffer&&f.enable(3),D.reversedDepthBuffer&&f.enable(4),D.skinning&&f.enable(5),D.morphTargets&&f.enable(6),D.morphNormals&&f.enable(7),D.morphColors&&f.enable(8),D.premultipliedAlpha&&f.enable(9),D.shadowMapEnabled&&f.enable(10),D.doubleSided&&f.enable(11),D.flipSided&&f.enable(12),D.useDepthPacking&&f.enable(13),D.dithering&&f.enable(14),D.transmission&&f.enable(15),D.sheen&&f.enable(16),D.opaque&&f.enable(17),D.pointsUvs&&f.enable(18),D.decodeVideoTexture&&f.enable(19),D.decodeVideoTextureEmissive&&f.enable(20),D.alphaToCoverage&&f.enable(21),D.numLightProbeGrids>0&&f.enable(22),D.hasPositionAttribute&&f.enable(23),E.push(f.mask)}function U(E){const D=x[E.type];let F;if(D){const H=ta[D];F=Y1.clone(H.uniforms)}else F=E.uniforms;return F}function w(E,D){let F=_.get(D);return F!==void 0?++F.usedTimes:(F=new A2(r,D,E,l),p.push(F),_.set(D,F)),F}function z(E){if(--E.usedTimes===0){const D=p.indexOf(E);p[D]=p[p.length-1],p.pop(),_.delete(E.cacheKey),E.destroy()}}function N(E){d.remove(E)}function L(){d.dispose()}return{getParameters:A,getProgramCacheKey:M,getUniforms:U,acquireProgram:w,releaseProgram:z,releaseShaderCache:N,programs:p,dispose:L}}function N2(){let r=new WeakMap;function t(f){return r.has(f)}function i(f){let d=r.get(f);return d===void 0&&(d={},r.set(f,d)),d}function s(f){r.delete(f)}function l(f,d,m){r.get(f)[d]=m}function c(){r=new WeakMap}return{has:t,get:i,remove:s,update:l,dispose:c}}function L2(r,t){return r.groupOrder!==t.groupOrder?r.groupOrder-t.groupOrder:r.renderOrder!==t.renderOrder?r.renderOrder-t.renderOrder:r.material.id!==t.material.id?r.material.id-t.material.id:r.materialVariant!==t.materialVariant?r.materialVariant-t.materialVariant:r.z!==t.z?r.z-t.z:r.id-t.id}function Ov(r,t){return r.groupOrder!==t.groupOrder?r.groupOrder-t.groupOrder:r.renderOrder!==t.renderOrder?r.renderOrder-t.renderOrder:r.z!==t.z?t.z-r.z:r.id-t.id}function Pv(){const r=[];let t=0;const i=[],s=[],l=[];function c(){t=0,i.length=0,s.length=0,l.length=0}function f(g){let x=0;return g.isInstancedMesh&&(x+=2),g.isSkinnedMesh&&(x+=1),x}function d(g,x,b,A,M,S){let O=r[t];return O===void 0?(O={id:g.id,object:g,geometry:x,material:b,materialVariant:f(g),groupOrder:A,renderOrder:g.renderOrder,z:M,group:S},r[t]=O):(O.id=g.id,O.object=g,O.geometry=x,O.material=b,O.materialVariant=f(g),O.groupOrder=A,O.renderOrder=g.renderOrder,O.z=M,O.group=S),t++,O}function m(g,x,b,A,M,S){const O=d(g,x,b,A,M,S);b.transmission>0?s.push(O):b.transparent===!0?l.push(O):i.push(O)}function p(g,x,b,A,M,S){const O=d(g,x,b,A,M,S);b.transmission>0?s.unshift(O):b.transparent===!0?l.unshift(O):i.unshift(O)}function _(g,x,b){i.length>1&&i.sort(g||L2),s.length>1&&s.sort(x||Ov),l.length>1&&l.sort(x||Ov),b&&(i.reverse(),s.reverse(),l.reverse())}function v(){for(let g=t,x=r.length;g<x;g++){const b=r[g];if(b.id===null)break;b.id=null,b.object=null,b.geometry=null,b.material=null,b.group=null}}return{opaque:i,transmissive:s,transparent:l,init:c,push:m,unshift:p,finish:v,sort:_}}function O2(){let r=new WeakMap;function t(s,l){const c=r.get(s);let f;return c===void 0?(f=new Pv,r.set(s,[f])):l>=c.length?(f=new Pv,c.push(f)):f=c[l],f}function i(){r=new WeakMap}return{get:t,dispose:i}}function P2(){const r={};return{get:function(t){if(r[t.id]!==void 0)return r[t.id];let i;switch(t.type){case"DirectionalLight":i={direction:new V,color:new Re};break;case"SpotLight":i={position:new V,direction:new V,color:new Re,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":i={position:new V,color:new Re,distance:0,decay:0};break;case"HemisphereLight":i={direction:new V,skyColor:new Re,groundColor:new Re};break;case"RectAreaLight":i={color:new Re,position:new V,halfWidth:new V,halfHeight:new V};break}return r[t.id]=i,i}}}function z2(){const r={};return{get:function(t){if(r[t.id]!==void 0)return r[t.id];let i;switch(t.type){case"DirectionalLight":i={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new ae};break;case"SpotLight":i={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new ae};break;case"PointLight":i={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new ae,shadowCameraNear:1,shadowCameraFar:1e3};break}return r[t.id]=i,i}}}let B2=0;function I2(r,t){return(t.castShadow?2:0)-(r.castShadow?2:0)+(t.map?1:0)-(r.map?1:0)}function F2(r){const t=new P2,i=z2(),s={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let p=0;p<9;p++)s.probe.push(new V);const l=new V,c=new Ve,f=new Ve;function d(p){let _=0,v=0,g=0;for(let D=0;D<9;D++)s.probe[D].set(0,0,0);let x=0,b=0,A=0,M=0,S=0,O=0,U=0,w=0,z=0,N=0,L=0;p.sort(I2);for(let D=0,F=p.length;D<F;D++){const H=p[D],X=H.color,ct=H.intensity,ut=H.distance;let Z=null;if(H.shadow&&H.shadow.map&&(H.shadow.map.texture.format===js?Z=H.shadow.map.texture:Z=H.shadow.map.depthTexture||H.shadow.map.texture),H.isAmbientLight)_+=X.r*ct,v+=X.g*ct,g+=X.b*ct;else if(H.isLightProbe){for(let P=0;P<9;P++)s.probe[P].addScaledVector(H.sh.coefficients[P],ct);L++}else if(H.isDirectionalLight){const P=t.get(H);if(P.color.copy(H.color).multiplyScalar(H.intensity),H.castShadow){const k=H.shadow,tt=i.get(H);tt.shadowIntensity=k.intensity,tt.shadowBias=k.bias,tt.shadowNormalBias=k.normalBias,tt.shadowRadius=k.radius,tt.shadowMapSize=k.mapSize,s.directionalShadow[x]=tt,s.directionalShadowMap[x]=Z,s.directionalShadowMatrix[x]=H.shadow.matrix,O++}s.directional[x]=P,x++}else if(H.isSpotLight){const P=t.get(H);P.position.setFromMatrixPosition(H.matrixWorld),P.color.copy(X).multiplyScalar(ct),P.distance=ut,P.coneCos=Math.cos(H.angle),P.penumbraCos=Math.cos(H.angle*(1-H.penumbra)),P.decay=H.decay,s.spot[A]=P;const k=H.shadow;if(H.map&&(s.spotLightMap[z]=H.map,z++,k.updateMatrices(H),H.castShadow&&N++),s.spotLightMatrix[A]=k.matrix,H.castShadow){const tt=i.get(H);tt.shadowIntensity=k.intensity,tt.shadowBias=k.bias,tt.shadowNormalBias=k.normalBias,tt.shadowRadius=k.radius,tt.shadowMapSize=k.mapSize,s.spotShadow[A]=tt,s.spotShadowMap[A]=Z,w++}A++}else if(H.isRectAreaLight){const P=t.get(H);P.color.copy(X).multiplyScalar(ct),P.halfWidth.set(H.width*.5,0,0),P.halfHeight.set(0,H.height*.5,0),s.rectArea[M]=P,M++}else if(H.isPointLight){const P=t.get(H);if(P.color.copy(H.color).multiplyScalar(H.intensity),P.distance=H.distance,P.decay=H.decay,H.castShadow){const k=H.shadow,tt=i.get(H);tt.shadowIntensity=k.intensity,tt.shadowBias=k.bias,tt.shadowNormalBias=k.normalBias,tt.shadowRadius=k.radius,tt.shadowMapSize=k.mapSize,tt.shadowCameraNear=k.camera.near,tt.shadowCameraFar=k.camera.far,s.pointShadow[b]=tt,s.pointShadowMap[b]=Z,s.pointShadowMatrix[b]=H.shadow.matrix,U++}s.point[b]=P,b++}else if(H.isHemisphereLight){const P=t.get(H);P.skyColor.copy(H.color).multiplyScalar(ct),P.groundColor.copy(H.groundColor).multiplyScalar(ct),s.hemi[S]=P,S++}}M>0&&(r.has("OES_texture_float_linear")===!0?(s.rectAreaLTC1=Vt.LTC_FLOAT_1,s.rectAreaLTC2=Vt.LTC_FLOAT_2):(s.rectAreaLTC1=Vt.LTC_HALF_1,s.rectAreaLTC2=Vt.LTC_HALF_2)),s.ambient[0]=_,s.ambient[1]=v,s.ambient[2]=g;const E=s.hash;(E.directionalLength!==x||E.pointLength!==b||E.spotLength!==A||E.rectAreaLength!==M||E.hemiLength!==S||E.numDirectionalShadows!==O||E.numPointShadows!==U||E.numSpotShadows!==w||E.numSpotMaps!==z||E.numLightProbes!==L)&&(s.directional.length=x,s.spot.length=A,s.rectArea.length=M,s.point.length=b,s.hemi.length=S,s.directionalShadow.length=O,s.directionalShadowMap.length=O,s.pointShadow.length=U,s.pointShadowMap.length=U,s.spotShadow.length=w,s.spotShadowMap.length=w,s.directionalShadowMatrix.length=O,s.pointShadowMatrix.length=U,s.spotLightMatrix.length=w+z-N,s.spotLightMap.length=z,s.numSpotLightShadowsWithMaps=N,s.numLightProbes=L,E.directionalLength=x,E.pointLength=b,E.spotLength=A,E.rectAreaLength=M,E.hemiLength=S,E.numDirectionalShadows=O,E.numPointShadows=U,E.numSpotShadows=w,E.numSpotMaps=z,E.numLightProbes=L,s.version=B2++)}function m(p,_){let v=0,g=0,x=0,b=0,A=0;const M=_.matrixWorldInverse;for(let S=0,O=p.length;S<O;S++){const U=p[S];if(U.isDirectionalLight){const w=s.directional[v];w.direction.setFromMatrixPosition(U.matrixWorld),l.setFromMatrixPosition(U.target.matrixWorld),w.direction.sub(l),w.direction.transformDirection(M),v++}else if(U.isSpotLight){const w=s.spot[x];w.position.setFromMatrixPosition(U.matrixWorld),w.position.applyMatrix4(M),w.direction.setFromMatrixPosition(U.matrixWorld),l.setFromMatrixPosition(U.target.matrixWorld),w.direction.sub(l),w.direction.transformDirection(M),x++}else if(U.isRectAreaLight){const w=s.rectArea[b];w.position.setFromMatrixPosition(U.matrixWorld),w.position.applyMatrix4(M),f.identity(),c.copy(U.matrixWorld),c.premultiply(M),f.extractRotation(c),w.halfWidth.set(U.width*.5,0,0),w.halfHeight.set(0,U.height*.5,0),w.halfWidth.applyMatrix4(f),w.halfHeight.applyMatrix4(f),b++}else if(U.isPointLight){const w=s.point[g];w.position.setFromMatrixPosition(U.matrixWorld),w.position.applyMatrix4(M),g++}else if(U.isHemisphereLight){const w=s.hemi[A];w.direction.setFromMatrixPosition(U.matrixWorld),w.direction.transformDirection(M),A++}}}return{setup:d,setupView:m,state:s}}function zv(r){const t=new F2(r),i=[],s=[],l=[];function c(g){v.camera=g,i.length=0,s.length=0,l.length=0}function f(g){i.push(g)}function d(g){s.push(g)}function m(g){l.push(g)}function p(){t.setup(i)}function _(g){t.setupView(i,g)}const v={lightsArray:i,shadowsArray:s,lightProbeGridArray:l,camera:null,lights:t,transmissionRenderTarget:{},textureUnits:0};return{init:c,state:v,setupLights:p,setupLightsView:_,pushLight:f,pushShadow:d,pushLightProbeGrid:m}}function H2(r){let t=new WeakMap;function i(l,c=0){const f=t.get(l);let d;return f===void 0?(d=new zv(r),t.set(l,[d])):c>=f.length?(d=new zv(r),f.push(d)):d=f[c],d}function s(){t=new WeakMap}return{get:i,dispose:s}}const G2=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,V2=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ).rg;
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ).r;
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( max( 0.0, squared_mean - mean * mean ) );
	gl_FragColor = vec4( mean, std_dev, 0.0, 1.0 );
}`,k2=[new V(1,0,0),new V(-1,0,0),new V(0,1,0),new V(0,-1,0),new V(0,0,1),new V(0,0,-1)],X2=[new V(0,-1,0),new V(0,-1,0),new V(0,0,1),new V(0,0,-1),new V(0,-1,0),new V(0,-1,0)],Bv=new Ve,sl=new V,gd=new V;function W2(r,t,i){let s=new Ap;const l=new ae,c=new ae,f=new gn,d=new Q1,m=new j1,p={},_=i.maxTextureSize,v={[xs]:ni,[ni]:xs,[Na]:Na},g=new ra({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new ae},radius:{value:4}},vertexShader:G2,fragmentShader:V2}),x=g.clone();x.defines.HORIZONTAL_PASS=1;const b=new Ln;b.setAttribute("position",new Ti(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));const A=new ie(b,g),M=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=cl;let S=this.type;this.render=function(N,L,E){if(M.enabled===!1||M.autoUpdate===!1&&M.needsUpdate===!1||N.length===0)return;this.type===uM&&(ue("WebGLShadowMap: PCFSoftShadowMap has been deprecated. Using PCFShadowMap instead."),this.type=cl);const D=r.getRenderTarget(),F=r.getActiveCubeFace(),H=r.getActiveMipmapLevel(),X=r.state;X.setBlending(Oa),X.buffers.depth.getReversed()===!0?X.buffers.color.setClear(0,0,0,0):X.buffers.color.setClear(1,1,1,1),X.buffers.depth.setTest(!0),X.setScissorTest(!1);const ct=S!==this.type;ct&&L.traverse(function(ut){ut.material&&(Array.isArray(ut.material)?ut.material.forEach(Z=>Z.needsUpdate=!0):ut.material.needsUpdate=!0)});for(let ut=0,Z=N.length;ut<Z;ut++){const P=N[ut],k=P.shadow;if(k===void 0){ue("WebGLShadowMap:",P,"has no shadow.");continue}if(k.autoUpdate===!1&&k.needsUpdate===!1)continue;l.copy(k.mapSize);const tt=k.getFrameExtents();l.multiply(tt),c.copy(k.mapSize),(l.x>_||l.y>_)&&(l.x>_&&(c.x=Math.floor(_/tt.x),l.x=c.x*tt.x,k.mapSize.x=c.x),l.y>_&&(c.y=Math.floor(_/tt.y),l.y=c.y*tt.y,k.mapSize.y=c.y));const _t=r.state.buffers.depth.getReversed();if(k.camera._reversedDepth=_t,k.map===null||ct===!0){if(k.map!==null&&(k.map.depthTexture!==null&&(k.map.depthTexture.dispose(),k.map.depthTexture=null),k.map.dispose()),this.type===ol){if(P.isPointLight){ue("WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.");continue}k.map=new aa(l.x,l.y,{format:js,type:za,minFilter:Kn,magFilter:Kn,generateMipmaps:!1}),k.map.texture.name=P.name+".shadowMap",k.map.depthTexture=new eo(l.x,l.y,Wi),k.map.depthTexture.name=P.name+".shadowMapDepth",k.map.depthTexture.format=Ba,k.map.depthTexture.compareFunction=null,k.map.depthTexture.minFilter=Vn,k.map.depthTexture.magFilter=Vn}else P.isPointLight?(k.map=new bx(l.x),k.map.depthTexture=new D1(l.x,sa)):(k.map=new aa(l.x,l.y),k.map.depthTexture=new eo(l.x,l.y,sa)),k.map.depthTexture.name=P.name+".shadowMap",k.map.depthTexture.format=Ba,this.type===cl?(k.map.depthTexture.compareFunction=_t?Mp:yp,k.map.depthTexture.minFilter=Kn,k.map.depthTexture.magFilter=Kn):(k.map.depthTexture.compareFunction=null,k.map.depthTexture.minFilter=Vn,k.map.depthTexture.magFilter=Vn);k.camera.updateProjectionMatrix()}const Et=k.map.isWebGLCubeRenderTarget?6:1;for(let B=0;B<Et;B++){if(k.map.isWebGLCubeRenderTarget)r.setRenderTarget(k.map,B),r.clear();else{B===0&&(r.setRenderTarget(k.map),r.clear());const J=k.getViewport(B);f.set(c.x*J.x,c.y*J.y,c.x*J.z,c.y*J.w),X.viewport(f)}if(P.isPointLight){const J=k.camera,bt=k.matrix,Rt=P.distance||J.far;Rt!==J.far&&(J.far=Rt,J.updateProjectionMatrix()),sl.setFromMatrixPosition(P.matrixWorld),J.position.copy(sl),gd.copy(J.position),gd.add(k2[B]),J.up.copy(X2[B]),J.lookAt(gd),J.updateMatrixWorld(),bt.makeTranslation(-sl.x,-sl.y,-sl.z),Bv.multiplyMatrices(J.projectionMatrix,J.matrixWorldInverse),k._frustum.setFromProjectionMatrix(Bv,J.coordinateSystem,J.reversedDepth)}else k.updateMatrices(P);s=k.getFrustum(),w(L,E,k.camera,P,this.type)}k.isPointLightShadow!==!0&&this.type===ol&&O(k,E),k.needsUpdate=!1}S=this.type,M.needsUpdate=!1,r.setRenderTarget(D,F,H)};function O(N,L){const E=t.update(A);g.defines.VSM_SAMPLES!==N.blurSamples&&(g.defines.VSM_SAMPLES=N.blurSamples,x.defines.VSM_SAMPLES=N.blurSamples,g.needsUpdate=!0,x.needsUpdate=!0),N.mapPass===null&&(N.mapPass=new aa(l.x,l.y,{format:js,type:za})),g.uniforms.shadow_pass.value=N.map.depthTexture,g.uniforms.resolution.value=N.mapSize,g.uniforms.radius.value=N.radius,r.setRenderTarget(N.mapPass),r.clear(),r.renderBufferDirect(L,null,E,g,A,null),x.uniforms.shadow_pass.value=N.mapPass.texture,x.uniforms.resolution.value=N.mapSize,x.uniforms.radius.value=N.radius,r.setRenderTarget(N.map),r.clear(),r.renderBufferDirect(L,null,E,x,A,null)}function U(N,L,E,D){let F=null;const H=E.isPointLight===!0?N.customDistanceMaterial:N.customDepthMaterial;if(H!==void 0)F=H;else if(F=E.isPointLight===!0?m:d,r.localClippingEnabled&&L.clipShadows===!0&&Array.isArray(L.clippingPlanes)&&L.clippingPlanes.length!==0||L.displacementMap&&L.displacementScale!==0||L.alphaMap&&L.alphaTest>0||L.map&&L.alphaTest>0||L.alphaToCoverage===!0){const X=F.uuid,ct=L.uuid;let ut=p[X];ut===void 0&&(ut={},p[X]=ut);let Z=ut[ct];Z===void 0&&(Z=F.clone(),ut[ct]=Z,L.addEventListener("dispose",z)),F=Z}if(F.visible=L.visible,F.wireframe=L.wireframe,D===ol?F.side=L.shadowSide!==null?L.shadowSide:L.side:F.side=L.shadowSide!==null?L.shadowSide:v[L.side],F.alphaMap=L.alphaMap,F.alphaTest=L.alphaToCoverage===!0?.5:L.alphaTest,F.map=L.map,F.clipShadows=L.clipShadows,F.clippingPlanes=L.clippingPlanes,F.clipIntersection=L.clipIntersection,F.displacementMap=L.displacementMap,F.displacementScale=L.displacementScale,F.displacementBias=L.displacementBias,F.wireframeLinewidth=L.wireframeLinewidth,F.linewidth=L.linewidth,E.isPointLight===!0&&F.isMeshDistanceMaterial===!0){const X=r.properties.get(F);X.light=E}return F}function w(N,L,E,D,F){if(N.visible===!1)return;if(N.layers.test(L.layers)&&(N.isMesh||N.isLine||N.isPoints)&&(N.castShadow||N.receiveShadow&&F===ol)&&(!N.frustumCulled||s.intersectsObject(N))){N.modelViewMatrix.multiplyMatrices(E.matrixWorldInverse,N.matrixWorld);const ct=t.update(N),ut=N.material;if(Array.isArray(ut)){const Z=ct.groups;for(let P=0,k=Z.length;P<k;P++){const tt=Z[P],_t=ut[tt.materialIndex];if(_t&&_t.visible){const Et=U(N,_t,D,F);N.onBeforeShadow(r,N,L,E,ct,Et,tt),r.renderBufferDirect(E,null,ct,Et,N,tt),N.onAfterShadow(r,N,L,E,ct,Et,tt)}}}else if(ut.visible){const Z=U(N,ut,D,F);N.onBeforeShadow(r,N,L,E,ct,Z,null),r.renderBufferDirect(E,null,ct,Z,N,null),N.onAfterShadow(r,N,L,E,ct,Z,null)}}const X=N.children;for(let ct=0,ut=X.length;ct<ut;ct++)w(X[ct],L,E,D,F)}function z(N){N.target.removeEventListener("dispose",z);for(const E in p){const D=p[E],F=N.target.uuid;F in D&&(D[F].dispose(),delete D[F])}}}function q2(r,t){function i(){let q=!1;const Nt=new gn;let vt=null;const Pt=new gn(0,0,0,0);return{setMask:function(Ht){vt!==Ht&&!q&&(r.colorMask(Ht,Ht,Ht,Ht),vt=Ht)},setLocked:function(Ht){q=Ht},setClear:function(Ht,Tt,jt,qt,ht){ht===!0&&(Ht*=qt,Tt*=qt,jt*=qt),Nt.set(Ht,Tt,jt,qt),Pt.equals(Nt)===!1&&(r.clearColor(Ht,Tt,jt,qt),Pt.copy(Nt))},reset:function(){q=!1,vt=null,Pt.set(-1,0,0,0)}}}function s(){let q=!1,Nt=!1,vt=null,Pt=null,Ht=null;return{setReversed:function(Tt){if(Nt!==Tt){const jt=t.get("EXT_clip_control");Tt?jt.clipControlEXT(jt.LOWER_LEFT_EXT,jt.ZERO_TO_ONE_EXT):jt.clipControlEXT(jt.LOWER_LEFT_EXT,jt.NEGATIVE_ONE_TO_ONE_EXT),Nt=Tt;const qt=Ht;Ht=null,this.setClear(qt)}},getReversed:function(){return Nt},setTest:function(Tt){Tt?Q(r.DEPTH_TEST):gt(r.DEPTH_TEST)},setMask:function(Tt){vt!==Tt&&!q&&(r.depthMask(Tt),vt=Tt)},setFunc:function(Tt){if(Nt&&(Tt=kM[Tt]),Pt!==Tt){switch(Tt){case Sd:r.depthFunc(r.NEVER);break;case yd:r.depthFunc(r.ALWAYS);break;case Md:r.depthFunc(r.LESS);break;case $r:r.depthFunc(r.LEQUAL);break;case bd:r.depthFunc(r.EQUAL);break;case Ed:r.depthFunc(r.GEQUAL);break;case Td:r.depthFunc(r.GREATER);break;case Ad:r.depthFunc(r.NOTEQUAL);break;default:r.depthFunc(r.LEQUAL)}Pt=Tt}},setLocked:function(Tt){q=Tt},setClear:function(Tt){Ht!==Tt&&(Ht=Tt,Nt&&(Tt=1-Tt),r.clearDepth(Tt))},reset:function(){q=!1,vt=null,Pt=null,Ht=null,Nt=!1}}}function l(){let q=!1,Nt=null,vt=null,Pt=null,Ht=null,Tt=null,jt=null,qt=null,ht=null;return{setTest:function(wt){q||(wt?Q(r.STENCIL_TEST):gt(r.STENCIL_TEST))},setMask:function(wt){Nt!==wt&&!q&&(r.stencilMask(wt),Nt=wt)},setFunc:function(wt,he,ee){(vt!==wt||Pt!==he||Ht!==ee)&&(r.stencilFunc(wt,he,ee),vt=wt,Pt=he,Ht=ee)},setOp:function(wt,he,ee){(Tt!==wt||jt!==he||qt!==ee)&&(r.stencilOp(wt,he,ee),Tt=wt,jt=he,qt=ee)},setLocked:function(wt){q=wt},setClear:function(wt){ht!==wt&&(r.clearStencil(wt),ht=wt)},reset:function(){q=!1,Nt=null,vt=null,Pt=null,Ht=null,Tt=null,jt=null,qt=null,ht=null}}}const c=new i,f=new s,d=new l,m=new WeakMap,p=new WeakMap;let _={},v={},g={},x=new WeakMap,b=[],A=null,M=!1,S=null,O=null,U=null,w=null,z=null,N=null,L=null,E=new Re(0,0,0),D=0,F=!1,H=null,X=null,ct=null,ut=null,Z=null;const P=r.getParameter(r.MAX_COMBINED_TEXTURE_IMAGE_UNITS);let k=!1,tt=0;const _t=r.getParameter(r.VERSION);_t.indexOf("WebGL")!==-1?(tt=parseFloat(/^WebGL (\d)/.exec(_t)[1]),k=tt>=1):_t.indexOf("OpenGL ES")!==-1&&(tt=parseFloat(/^OpenGL ES (\d)/.exec(_t)[1]),k=tt>=2);let Et=null,B={};const J=r.getParameter(r.SCISSOR_BOX),bt=r.getParameter(r.VIEWPORT),Rt=new gn().fromArray(J),Ut=new gn().fromArray(bt);function et(q,Nt,vt,Pt){const Ht=new Uint8Array(4),Tt=r.createTexture();r.bindTexture(q,Tt),r.texParameteri(q,r.TEXTURE_MIN_FILTER,r.NEAREST),r.texParameteri(q,r.TEXTURE_MAG_FILTER,r.NEAREST);for(let jt=0;jt<vt;jt++)q===r.TEXTURE_3D||q===r.TEXTURE_2D_ARRAY?r.texImage3D(Nt,0,r.RGBA,1,1,Pt,0,r.RGBA,r.UNSIGNED_BYTE,Ht):r.texImage2D(Nt+jt,0,r.RGBA,1,1,0,r.RGBA,r.UNSIGNED_BYTE,Ht);return Tt}const yt={};yt[r.TEXTURE_2D]=et(r.TEXTURE_2D,r.TEXTURE_2D,1),yt[r.TEXTURE_CUBE_MAP]=et(r.TEXTURE_CUBE_MAP,r.TEXTURE_CUBE_MAP_POSITIVE_X,6),yt[r.TEXTURE_2D_ARRAY]=et(r.TEXTURE_2D_ARRAY,r.TEXTURE_2D_ARRAY,1,1),yt[r.TEXTURE_3D]=et(r.TEXTURE_3D,r.TEXTURE_3D,1,1),c.setClear(0,0,0,1),f.setClear(1),d.setClear(0),Q(r.DEPTH_TEST),f.setFunc($r),Xe(!1),rn(R_),Q(r.CULL_FACE),ve(Oa);function Q(q){_[q]!==!0&&(r.enable(q),_[q]=!0)}function gt(q){_[q]!==!1&&(r.disable(q),_[q]=!1)}function zt(q,Nt){return g[q]!==Nt?(r.bindFramebuffer(q,Nt),g[q]=Nt,q===r.DRAW_FRAMEBUFFER&&(g[r.FRAMEBUFFER]=Nt),q===r.FRAMEBUFFER&&(g[r.DRAW_FRAMEBUFFER]=Nt),!0):!1}function At(q,Nt){let vt=b,Pt=!1;if(q){vt=x.get(Nt),vt===void 0&&(vt=[],x.set(Nt,vt));const Ht=q.textures;if(vt.length!==Ht.length||vt[0]!==r.COLOR_ATTACHMENT0){for(let Tt=0,jt=Ht.length;Tt<jt;Tt++)vt[Tt]=r.COLOR_ATTACHMENT0+Tt;vt.length=Ht.length,Pt=!0}}else vt[0]!==r.BACK&&(vt[0]=r.BACK,Pt=!0);Pt&&r.drawBuffers(vt)}function oe(q){return A!==q?(r.useProgram(q),A=q,!0):!1}const Xt={[Xs]:r.FUNC_ADD,[hM]:r.FUNC_SUBTRACT,[dM]:r.FUNC_REVERSE_SUBTRACT};Xt[pM]=r.MIN,Xt[mM]=r.MAX;const fe={[gM]:r.ZERO,[_M]:r.ONE,[vM]:r.SRC_COLOR,[vd]:r.SRC_ALPHA,[EM]:r.SRC_ALPHA_SATURATE,[MM]:r.DST_COLOR,[SM]:r.DST_ALPHA,[xM]:r.ONE_MINUS_SRC_COLOR,[xd]:r.ONE_MINUS_SRC_ALPHA,[bM]:r.ONE_MINUS_DST_COLOR,[yM]:r.ONE_MINUS_DST_ALPHA,[TM]:r.CONSTANT_COLOR,[AM]:r.ONE_MINUS_CONSTANT_COLOR,[wM]:r.CONSTANT_ALPHA,[RM]:r.ONE_MINUS_CONSTANT_ALPHA};function ve(q,Nt,vt,Pt,Ht,Tt,jt,qt,ht,wt){if(q===Oa){M===!0&&(gt(r.BLEND),M=!1);return}if(M===!1&&(Q(r.BLEND),M=!0),q!==fM){if(q!==S||wt!==F){if((O!==Xs||z!==Xs)&&(r.blendEquation(r.FUNC_ADD),O=Xs,z=Xs),wt)switch(q){case Jr:r.blendFuncSeparate(r.ONE,r.ONE_MINUS_SRC_ALPHA,r.ONE,r.ONE_MINUS_SRC_ALPHA);break;case C_:r.blendFunc(r.ONE,r.ONE);break;case D_:r.blendFuncSeparate(r.ZERO,r.ONE_MINUS_SRC_COLOR,r.ZERO,r.ONE);break;case U_:r.blendFuncSeparate(r.DST_COLOR,r.ONE_MINUS_SRC_ALPHA,r.ZERO,r.ONE);break;default:Oe("WebGLState: Invalid blending: ",q);break}else switch(q){case Jr:r.blendFuncSeparate(r.SRC_ALPHA,r.ONE_MINUS_SRC_ALPHA,r.ONE,r.ONE_MINUS_SRC_ALPHA);break;case C_:r.blendFuncSeparate(r.SRC_ALPHA,r.ONE,r.ONE,r.ONE);break;case D_:Oe("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case U_:Oe("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:Oe("WebGLState: Invalid blending: ",q);break}U=null,w=null,N=null,L=null,E.set(0,0,0),D=0,S=q,F=wt}return}Ht=Ht||Nt,Tt=Tt||vt,jt=jt||Pt,(Nt!==O||Ht!==z)&&(r.blendEquationSeparate(Xt[Nt],Xt[Ht]),O=Nt,z=Ht),(vt!==U||Pt!==w||Tt!==N||jt!==L)&&(r.blendFuncSeparate(fe[vt],fe[Pt],fe[Tt],fe[jt]),U=vt,w=Pt,N=Tt,L=jt),(qt.equals(E)===!1||ht!==D)&&(r.blendColor(qt.r,qt.g,qt.b,ht),E.copy(qt),D=ht),S=q,F=!1}function ge(q,Nt){q.side===Na?gt(r.CULL_FACE):Q(r.CULL_FACE);let vt=q.side===ni;Nt&&(vt=!vt),Xe(vt),q.blending===Jr&&q.transparent===!1?ve(Oa):ve(q.blending,q.blendEquation,q.blendSrc,q.blendDst,q.blendEquationAlpha,q.blendSrcAlpha,q.blendDstAlpha,q.blendColor,q.blendAlpha,q.premultipliedAlpha),f.setFunc(q.depthFunc),f.setTest(q.depthTest),f.setMask(q.depthWrite),c.setMask(q.colorWrite);const Pt=q.stencilWrite;d.setTest(Pt),Pt&&(d.setMask(q.stencilWriteMask),d.setFunc(q.stencilFunc,q.stencilRef,q.stencilFuncMask),d.setOp(q.stencilFail,q.stencilZFail,q.stencilZPass)),mn(q.polygonOffset,q.polygonOffsetFactor,q.polygonOffsetUnits),q.alphaToCoverage===!0?Q(r.SAMPLE_ALPHA_TO_COVERAGE):gt(r.SAMPLE_ALPHA_TO_COVERAGE)}function Xe(q){H!==q&&(q?r.frontFace(r.CW):r.frontFace(r.CCW),H=q)}function rn(q){q!==lM?(Q(r.CULL_FACE),q!==X&&(q===R_?r.cullFace(r.BACK):q===cM?r.cullFace(r.FRONT):r.cullFace(r.FRONT_AND_BACK))):gt(r.CULL_FACE),X=q}function tn(q){q!==ct&&(k&&r.lineWidth(q),ct=q)}function mn(q,Nt,vt){q?(Q(r.POLYGON_OFFSET_FILL),(ut!==Nt||Z!==vt)&&(ut=Nt,Z=vt,f.getReversed()&&(Nt=-Nt),r.polygonOffset(Nt,vt))):gt(r.POLYGON_OFFSET_FILL)}function Fe(q){q?Q(r.SCISSOR_TEST):gt(r.SCISSOR_TEST)}function un(q){q===void 0&&(q=r.TEXTURE0+P-1),Et!==q&&(r.activeTexture(q),Et=q)}function Y(q,Nt,vt){vt===void 0&&(Et===null?vt=r.TEXTURE0+P-1:vt=Et);let Pt=B[vt];Pt===void 0&&(Pt={type:void 0,texture:void 0},B[vt]=Pt),(Pt.type!==q||Pt.texture!==Nt)&&(Et!==vt&&(r.activeTexture(vt),Et=vt),r.bindTexture(q,Nt||yt[q]),Pt.type=q,Pt.texture=Nt)}function Me(){const q=B[Et];q!==void 0&&q.type!==void 0&&(r.bindTexture(q.type,null),q.type=void 0,q.texture=void 0)}function Le(){try{r.compressedTexImage2D(...arguments)}catch(q){Oe("WebGLState:",q)}}function I(){try{r.compressedTexImage3D(...arguments)}catch(q){Oe("WebGLState:",q)}}function T(){try{r.texSubImage2D(...arguments)}catch(q){Oe("WebGLState:",q)}}function j(){try{r.texSubImage3D(...arguments)}catch(q){Oe("WebGLState:",q)}}function rt(){try{r.compressedTexSubImage2D(...arguments)}catch(q){Oe("WebGLState:",q)}}function pt(){try{r.compressedTexSubImage3D(...arguments)}catch(q){Oe("WebGLState:",q)}}function Dt(){try{r.texStorage2D(...arguments)}catch(q){Oe("WebGLState:",q)}}function Ot(){try{r.texStorage3D(...arguments)}catch(q){Oe("WebGLState:",q)}}function ft(){try{r.texImage2D(...arguments)}catch(q){Oe("WebGLState:",q)}}function mt(){try{r.texImage3D(...arguments)}catch(q){Oe("WebGLState:",q)}}function Lt(q){return v[q]!==void 0?v[q]:r.getParameter(q)}function kt(q,Nt){v[q]!==Nt&&(r.pixelStorei(q,Nt),v[q]=Nt)}function It(q){Rt.equals(q)===!1&&(r.scissor(q.x,q.y,q.z,q.w),Rt.copy(q))}function Bt(q){Ut.equals(q)===!1&&(r.viewport(q.x,q.y,q.z,q.w),Ut.copy(q))}function Yt(q,Nt){let vt=p.get(Nt);vt===void 0&&(vt=new WeakMap,p.set(Nt,vt));let Pt=vt.get(q);Pt===void 0&&(Pt=r.getUniformBlockIndex(Nt,q.name),vt.set(q,Pt))}function te(q,Nt){const Pt=p.get(Nt).get(q);m.get(Nt)!==Pt&&(r.uniformBlockBinding(Nt,Pt,q.__bindingPointIndex),m.set(Nt,Pt))}function le(){r.disable(r.BLEND),r.disable(r.CULL_FACE),r.disable(r.DEPTH_TEST),r.disable(r.POLYGON_OFFSET_FILL),r.disable(r.SCISSOR_TEST),r.disable(r.STENCIL_TEST),r.disable(r.SAMPLE_ALPHA_TO_COVERAGE),r.blendEquation(r.FUNC_ADD),r.blendFunc(r.ONE,r.ZERO),r.blendFuncSeparate(r.ONE,r.ZERO,r.ONE,r.ZERO),r.blendColor(0,0,0,0),r.colorMask(!0,!0,!0,!0),r.clearColor(0,0,0,0),r.depthMask(!0),r.depthFunc(r.LESS),f.setReversed(!1),r.clearDepth(1),r.stencilMask(4294967295),r.stencilFunc(r.ALWAYS,0,4294967295),r.stencilOp(r.KEEP,r.KEEP,r.KEEP),r.clearStencil(0),r.cullFace(r.BACK),r.frontFace(r.CCW),r.polygonOffset(0,0),r.activeTexture(r.TEXTURE0),r.bindFramebuffer(r.FRAMEBUFFER,null),r.bindFramebuffer(r.DRAW_FRAMEBUFFER,null),r.bindFramebuffer(r.READ_FRAMEBUFFER,null),r.useProgram(null),r.lineWidth(1),r.scissor(0,0,r.canvas.width,r.canvas.height),r.viewport(0,0,r.canvas.width,r.canvas.height),r.pixelStorei(r.PACK_ALIGNMENT,4),r.pixelStorei(r.UNPACK_ALIGNMENT,4),r.pixelStorei(r.UNPACK_FLIP_Y_WEBGL,!1),r.pixelStorei(r.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),r.pixelStorei(r.UNPACK_COLORSPACE_CONVERSION_WEBGL,r.BROWSER_DEFAULT_WEBGL),r.pixelStorei(r.PACK_ROW_LENGTH,0),r.pixelStorei(r.PACK_SKIP_PIXELS,0),r.pixelStorei(r.PACK_SKIP_ROWS,0),r.pixelStorei(r.UNPACK_ROW_LENGTH,0),r.pixelStorei(r.UNPACK_IMAGE_HEIGHT,0),r.pixelStorei(r.UNPACK_SKIP_PIXELS,0),r.pixelStorei(r.UNPACK_SKIP_ROWS,0),r.pixelStorei(r.UNPACK_SKIP_IMAGES,0),_={},v={},Et=null,B={},g={},x=new WeakMap,b=[],A=null,M=!1,S=null,O=null,U=null,w=null,z=null,N=null,L=null,E=new Re(0,0,0),D=0,F=!1,H=null,X=null,ct=null,ut=null,Z=null,Rt.set(0,0,r.canvas.width,r.canvas.height),Ut.set(0,0,r.canvas.width,r.canvas.height),c.reset(),f.reset(),d.reset()}return{buffers:{color:c,depth:f,stencil:d},enable:Q,disable:gt,bindFramebuffer:zt,drawBuffers:At,useProgram:oe,setBlending:ve,setMaterial:ge,setFlipSided:Xe,setCullFace:rn,setLineWidth:tn,setPolygonOffset:mn,setScissorTest:Fe,activeTexture:un,bindTexture:Y,unbindTexture:Me,compressedTexImage2D:Le,compressedTexImage3D:I,texImage2D:ft,texImage3D:mt,pixelStorei:kt,getParameter:Lt,updateUBOMapping:Yt,uniformBlockBinding:te,texStorage2D:Dt,texStorage3D:Ot,texSubImage2D:T,texSubImage3D:j,compressedTexSubImage2D:rt,compressedTexSubImage3D:pt,scissor:It,viewport:Bt,reset:le}}function Y2(r,t,i,s,l,c,f){const d=t.has("WEBGL_multisampled_render_to_texture")?t.get("WEBGL_multisampled_render_to_texture"):null,m=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),p=new ae,_=new WeakMap,v=new Set;let g;const x=new WeakMap;let b=!1;try{b=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function A(I,T){return b?new OffscreenCanvas(I,T):yl("canvas")}function M(I,T,j){let rt=1;const pt=Le(I);if((pt.width>j||pt.height>j)&&(rt=j/Math.max(pt.width,pt.height)),rt<1)if(typeof HTMLImageElement<"u"&&I instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&I instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&I instanceof ImageBitmap||typeof VideoFrame<"u"&&I instanceof VideoFrame){const Dt=Math.floor(rt*pt.width),Ot=Math.floor(rt*pt.height);g===void 0&&(g=A(Dt,Ot));const ft=T?A(Dt,Ot):g;return ft.width=Dt,ft.height=Ot,ft.getContext("2d").drawImage(I,0,0,Dt,Ot),ue("WebGLRenderer: Texture has been resized from ("+pt.width+"x"+pt.height+") to ("+Dt+"x"+Ot+")."),ft}else return"data"in I&&ue("WebGLRenderer: Image in DataTexture is too big ("+pt.width+"x"+pt.height+")."),I;return I}function S(I){return I.generateMipmaps}function O(I){r.generateMipmap(I)}function U(I){return I.isWebGLCubeRenderTarget?r.TEXTURE_CUBE_MAP:I.isWebGL3DRenderTarget?r.TEXTURE_3D:I.isWebGLArrayRenderTarget||I.isCompressedArrayTexture?r.TEXTURE_2D_ARRAY:r.TEXTURE_2D}function w(I,T,j,rt,pt,Dt=!1){if(I!==null){if(r[I]!==void 0)return r[I];ue("WebGLRenderer: Attempt to use non-existing WebGL internal format '"+I+"'")}let Ot;rt&&(Ot=t.get("EXT_texture_norm16"),Ot||ue("WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension"));let ft=T;if(T===r.RED&&(j===r.FLOAT&&(ft=r.R32F),j===r.HALF_FLOAT&&(ft=r.R16F),j===r.UNSIGNED_BYTE&&(ft=r.R8),j===r.UNSIGNED_SHORT&&Ot&&(ft=Ot.R16_EXT),j===r.SHORT&&Ot&&(ft=Ot.R16_SNORM_EXT)),T===r.RED_INTEGER&&(j===r.UNSIGNED_BYTE&&(ft=r.R8UI),j===r.UNSIGNED_SHORT&&(ft=r.R16UI),j===r.UNSIGNED_INT&&(ft=r.R32UI),j===r.BYTE&&(ft=r.R8I),j===r.SHORT&&(ft=r.R16I),j===r.INT&&(ft=r.R32I)),T===r.RG&&(j===r.FLOAT&&(ft=r.RG32F),j===r.HALF_FLOAT&&(ft=r.RG16F),j===r.UNSIGNED_BYTE&&(ft=r.RG8),j===r.UNSIGNED_SHORT&&Ot&&(ft=Ot.RG16_EXT),j===r.SHORT&&Ot&&(ft=Ot.RG16_SNORM_EXT)),T===r.RG_INTEGER&&(j===r.UNSIGNED_BYTE&&(ft=r.RG8UI),j===r.UNSIGNED_SHORT&&(ft=r.RG16UI),j===r.UNSIGNED_INT&&(ft=r.RG32UI),j===r.BYTE&&(ft=r.RG8I),j===r.SHORT&&(ft=r.RG16I),j===r.INT&&(ft=r.RG32I)),T===r.RGB_INTEGER&&(j===r.UNSIGNED_BYTE&&(ft=r.RGB8UI),j===r.UNSIGNED_SHORT&&(ft=r.RGB16UI),j===r.UNSIGNED_INT&&(ft=r.RGB32UI),j===r.BYTE&&(ft=r.RGB8I),j===r.SHORT&&(ft=r.RGB16I),j===r.INT&&(ft=r.RGB32I)),T===r.RGBA_INTEGER&&(j===r.UNSIGNED_BYTE&&(ft=r.RGBA8UI),j===r.UNSIGNED_SHORT&&(ft=r.RGBA16UI),j===r.UNSIGNED_INT&&(ft=r.RGBA32UI),j===r.BYTE&&(ft=r.RGBA8I),j===r.SHORT&&(ft=r.RGBA16I),j===r.INT&&(ft=r.RGBA32I)),T===r.RGB&&(j===r.UNSIGNED_SHORT&&Ot&&(ft=Ot.RGB16_EXT),j===r.SHORT&&Ot&&(ft=Ot.RGB16_SNORM_EXT),j===r.UNSIGNED_INT_5_9_9_9_REV&&(ft=r.RGB9_E5),j===r.UNSIGNED_INT_10F_11F_11F_REV&&(ft=r.R11F_G11F_B10F)),T===r.RGBA){const mt=Dt?mu:Ne.getTransfer(pt);j===r.FLOAT&&(ft=r.RGBA32F),j===r.HALF_FLOAT&&(ft=r.RGBA16F),j===r.UNSIGNED_BYTE&&(ft=mt===Je?r.SRGB8_ALPHA8:r.RGBA8),j===r.UNSIGNED_SHORT&&Ot&&(ft=Ot.RGBA16_EXT),j===r.SHORT&&Ot&&(ft=Ot.RGBA16_SNORM_EXT),j===r.UNSIGNED_SHORT_4_4_4_4&&(ft=r.RGBA4),j===r.UNSIGNED_SHORT_5_5_5_1&&(ft=r.RGB5_A1)}return(ft===r.R16F||ft===r.R32F||ft===r.RG16F||ft===r.RG32F||ft===r.RGBA16F||ft===r.RGBA32F)&&t.get("EXT_color_buffer_float"),ft}function z(I,T){let j;return I?T===null||T===sa||T===xl?j=r.DEPTH24_STENCIL8:T===Wi?j=r.DEPTH32F_STENCIL8:T===vl&&(j=r.DEPTH24_STENCIL8,ue("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):T===null||T===sa||T===xl?j=r.DEPTH_COMPONENT24:T===Wi?j=r.DEPTH_COMPONENT32F:T===vl&&(j=r.DEPTH_COMPONENT16),j}function N(I,T){return S(I)===!0||I.isFramebufferTexture&&I.minFilter!==Vn&&I.minFilter!==Kn?Math.log2(Math.max(T.width,T.height))+1:I.mipmaps!==void 0&&I.mipmaps.length>0?I.mipmaps.length:I.isCompressedTexture&&Array.isArray(I.image)?T.mipmaps.length:1}function L(I){const T=I.target;T.removeEventListener("dispose",L),D(T),T.isVideoTexture&&_.delete(T),T.isHTMLTexture&&v.delete(T)}function E(I){const T=I.target;T.removeEventListener("dispose",E),H(T)}function D(I){const T=s.get(I);if(T.__webglInit===void 0)return;const j=I.source,rt=x.get(j);if(rt){const pt=rt[T.__cacheKey];pt.usedTimes--,pt.usedTimes===0&&F(I),Object.keys(rt).length===0&&x.delete(j)}s.remove(I)}function F(I){const T=s.get(I);r.deleteTexture(T.__webglTexture);const j=I.source,rt=x.get(j);delete rt[T.__cacheKey],f.memory.textures--}function H(I){const T=s.get(I);if(I.depthTexture&&(I.depthTexture.dispose(),s.remove(I.depthTexture)),I.isWebGLCubeRenderTarget)for(let rt=0;rt<6;rt++){if(Array.isArray(T.__webglFramebuffer[rt]))for(let pt=0;pt<T.__webglFramebuffer[rt].length;pt++)r.deleteFramebuffer(T.__webglFramebuffer[rt][pt]);else r.deleteFramebuffer(T.__webglFramebuffer[rt]);T.__webglDepthbuffer&&r.deleteRenderbuffer(T.__webglDepthbuffer[rt])}else{if(Array.isArray(T.__webglFramebuffer))for(let rt=0;rt<T.__webglFramebuffer.length;rt++)r.deleteFramebuffer(T.__webglFramebuffer[rt]);else r.deleteFramebuffer(T.__webglFramebuffer);if(T.__webglDepthbuffer&&r.deleteRenderbuffer(T.__webglDepthbuffer),T.__webglMultisampledFramebuffer&&r.deleteFramebuffer(T.__webglMultisampledFramebuffer),T.__webglColorRenderbuffer)for(let rt=0;rt<T.__webglColorRenderbuffer.length;rt++)T.__webglColorRenderbuffer[rt]&&r.deleteRenderbuffer(T.__webglColorRenderbuffer[rt]);T.__webglDepthRenderbuffer&&r.deleteRenderbuffer(T.__webglDepthRenderbuffer)}const j=I.textures;for(let rt=0,pt=j.length;rt<pt;rt++){const Dt=s.get(j[rt]);Dt.__webglTexture&&(r.deleteTexture(Dt.__webglTexture),f.memory.textures--),s.remove(j[rt])}s.remove(I)}let X=0;function ct(){X=0}function ut(){return X}function Z(I){X=I}function P(){const I=X;return I>=l.maxTextures&&ue("WebGLTextures: Trying to use "+I+" texture units while this GPU supports only "+l.maxTextures),X+=1,I}function k(I){const T=[];return T.push(I.wrapS),T.push(I.wrapT),T.push(I.wrapR||0),T.push(I.magFilter),T.push(I.minFilter),T.push(I.anisotropy),T.push(I.internalFormat),T.push(I.format),T.push(I.type),T.push(I.generateMipmaps),T.push(I.premultiplyAlpha),T.push(I.flipY),T.push(I.unpackAlignment),T.push(I.colorSpace),T.join()}function tt(I,T){const j=s.get(I);if(I.isVideoTexture&&Y(I),I.isRenderTargetTexture===!1&&I.isExternalTexture!==!0&&I.version>0&&j.__version!==I.version){const rt=I.image;if(rt===null)ue("WebGLRenderer: Texture marked for update but no image data found.");else if(rt.complete===!1)ue("WebGLRenderer: Texture marked for update but image is incomplete");else{gt(j,I,T);return}}else I.isExternalTexture&&(j.__webglTexture=I.sourceTexture?I.sourceTexture:null);i.bindTexture(r.TEXTURE_2D,j.__webglTexture,r.TEXTURE0+T)}function _t(I,T){const j=s.get(I);if(I.isRenderTargetTexture===!1&&I.version>0&&j.__version!==I.version){gt(j,I,T);return}else I.isExternalTexture&&(j.__webglTexture=I.sourceTexture?I.sourceTexture:null);i.bindTexture(r.TEXTURE_2D_ARRAY,j.__webglTexture,r.TEXTURE0+T)}function Et(I,T){const j=s.get(I);if(I.isRenderTargetTexture===!1&&I.version>0&&j.__version!==I.version){gt(j,I,T);return}i.bindTexture(r.TEXTURE_3D,j.__webglTexture,r.TEXTURE0+T)}function B(I,T){const j=s.get(I);if(I.isCubeDepthTexture!==!0&&I.version>0&&j.__version!==I.version){zt(j,I,T);return}i.bindTexture(r.TEXTURE_CUBE_MAP,j.__webglTexture,r.TEXTURE0+T)}const J={[fu]:r.REPEAT,[La]:r.CLAMP_TO_EDGE,[wd]:r.MIRRORED_REPEAT},bt={[Vn]:r.NEAREST,[UM]:r.NEAREST_MIPMAP_NEAREST,[Nc]:r.NEAREST_MIPMAP_LINEAR,[Kn]:r.LINEAR,[zh]:r.LINEAR_MIPMAP_NEAREST,[qs]:r.LINEAR_MIPMAP_LINEAR},Rt={[OM]:r.NEVER,[FM]:r.ALWAYS,[PM]:r.LESS,[yp]:r.LEQUAL,[zM]:r.EQUAL,[Mp]:r.GEQUAL,[BM]:r.GREATER,[IM]:r.NOTEQUAL};function Ut(I,T){if(T.type===Wi&&t.has("OES_texture_float_linear")===!1&&(T.magFilter===Kn||T.magFilter===zh||T.magFilter===Nc||T.magFilter===qs||T.minFilter===Kn||T.minFilter===zh||T.minFilter===Nc||T.minFilter===qs)&&ue("WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),r.texParameteri(I,r.TEXTURE_WRAP_S,J[T.wrapS]),r.texParameteri(I,r.TEXTURE_WRAP_T,J[T.wrapT]),(I===r.TEXTURE_3D||I===r.TEXTURE_2D_ARRAY)&&r.texParameteri(I,r.TEXTURE_WRAP_R,J[T.wrapR]),r.texParameteri(I,r.TEXTURE_MAG_FILTER,bt[T.magFilter]),r.texParameteri(I,r.TEXTURE_MIN_FILTER,bt[T.minFilter]),T.compareFunction&&(r.texParameteri(I,r.TEXTURE_COMPARE_MODE,r.COMPARE_REF_TO_TEXTURE),r.texParameteri(I,r.TEXTURE_COMPARE_FUNC,Rt[T.compareFunction])),t.has("EXT_texture_filter_anisotropic")===!0){if(T.magFilter===Vn||T.minFilter!==Nc&&T.minFilter!==qs||T.type===Wi&&t.has("OES_texture_float_linear")===!1)return;if(T.anisotropy>1||s.get(T).__currentAnisotropy){const j=t.get("EXT_texture_filter_anisotropic");r.texParameterf(I,j.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(T.anisotropy,l.getMaxAnisotropy())),s.get(T).__currentAnisotropy=T.anisotropy}}}function et(I,T){let j=!1;I.__webglInit===void 0&&(I.__webglInit=!0,T.addEventListener("dispose",L));const rt=T.source;let pt=x.get(rt);pt===void 0&&(pt={},x.set(rt,pt));const Dt=k(T);if(Dt!==I.__cacheKey){pt[Dt]===void 0&&(pt[Dt]={texture:r.createTexture(),usedTimes:0},f.memory.textures++,j=!0),pt[Dt].usedTimes++;const Ot=pt[I.__cacheKey];Ot!==void 0&&(pt[I.__cacheKey].usedTimes--,Ot.usedTimes===0&&F(T)),I.__cacheKey=Dt,I.__webglTexture=pt[Dt].texture}return j}function yt(I,T,j){return Math.floor(Math.floor(I/j)/T)}function Q(I,T,j,rt){const Dt=I.updateRanges;if(Dt.length===0)i.texSubImage2D(r.TEXTURE_2D,0,0,0,T.width,T.height,j,rt,T.data);else{Dt.sort((kt,It)=>kt.start-It.start);let Ot=0;for(let kt=1;kt<Dt.length;kt++){const It=Dt[Ot],Bt=Dt[kt],Yt=It.start+It.count,te=yt(Bt.start,T.width,4),le=yt(It.start,T.width,4);Bt.start<=Yt+1&&te===le&&yt(Bt.start+Bt.count-1,T.width,4)===te?It.count=Math.max(It.count,Bt.start+Bt.count-It.start):(++Ot,Dt[Ot]=Bt)}Dt.length=Ot+1;const ft=i.getParameter(r.UNPACK_ROW_LENGTH),mt=i.getParameter(r.UNPACK_SKIP_PIXELS),Lt=i.getParameter(r.UNPACK_SKIP_ROWS);i.pixelStorei(r.UNPACK_ROW_LENGTH,T.width);for(let kt=0,It=Dt.length;kt<It;kt++){const Bt=Dt[kt],Yt=Math.floor(Bt.start/4),te=Math.ceil(Bt.count/4),le=Yt%T.width,q=Math.floor(Yt/T.width),Nt=te,vt=1;i.pixelStorei(r.UNPACK_SKIP_PIXELS,le),i.pixelStorei(r.UNPACK_SKIP_ROWS,q),i.texSubImage2D(r.TEXTURE_2D,0,le,q,Nt,vt,j,rt,T.data)}I.clearUpdateRanges(),i.pixelStorei(r.UNPACK_ROW_LENGTH,ft),i.pixelStorei(r.UNPACK_SKIP_PIXELS,mt),i.pixelStorei(r.UNPACK_SKIP_ROWS,Lt)}}function gt(I,T,j){let rt=r.TEXTURE_2D;(T.isDataArrayTexture||T.isCompressedArrayTexture)&&(rt=r.TEXTURE_2D_ARRAY),T.isData3DTexture&&(rt=r.TEXTURE_3D);const pt=et(I,T),Dt=T.source;i.bindTexture(rt,I.__webglTexture,r.TEXTURE0+j);const Ot=s.get(Dt);if(Dt.version!==Ot.__version||pt===!0){if(i.activeTexture(r.TEXTURE0+j),(typeof ImageBitmap<"u"&&T.image instanceof ImageBitmap)===!1){const vt=Ne.getPrimaries(Ne.workingColorSpace),Pt=T.colorSpace===_s?null:Ne.getPrimaries(T.colorSpace),Ht=T.colorSpace===_s||vt===Pt?r.NONE:r.BROWSER_DEFAULT_WEBGL;i.pixelStorei(r.UNPACK_FLIP_Y_WEBGL,T.flipY),i.pixelStorei(r.UNPACK_PREMULTIPLY_ALPHA_WEBGL,T.premultiplyAlpha),i.pixelStorei(r.UNPACK_COLORSPACE_CONVERSION_WEBGL,Ht)}i.pixelStorei(r.UNPACK_ALIGNMENT,T.unpackAlignment);let mt=M(T.image,!1,l.maxTextureSize);mt=Me(T,mt);const Lt=c.convert(T.format,T.colorSpace),kt=c.convert(T.type);let It=w(T.internalFormat,Lt,kt,T.normalized,T.colorSpace,T.isVideoTexture);Ut(rt,T);let Bt;const Yt=T.mipmaps,te=T.isVideoTexture!==!0,le=Ot.__version===void 0||pt===!0,q=Dt.dataReady,Nt=N(T,mt);if(T.isDepthTexture)It=z(T.format===Ys,T.type),le&&(te?i.texStorage2D(r.TEXTURE_2D,1,It,mt.width,mt.height):i.texImage2D(r.TEXTURE_2D,0,It,mt.width,mt.height,0,Lt,kt,null));else if(T.isDataTexture)if(Yt.length>0){te&&le&&i.texStorage2D(r.TEXTURE_2D,Nt,It,Yt[0].width,Yt[0].height);for(let vt=0,Pt=Yt.length;vt<Pt;vt++)Bt=Yt[vt],te?q&&i.texSubImage2D(r.TEXTURE_2D,vt,0,0,Bt.width,Bt.height,Lt,kt,Bt.data):i.texImage2D(r.TEXTURE_2D,vt,It,Bt.width,Bt.height,0,Lt,kt,Bt.data);T.generateMipmaps=!1}else te?(le&&i.texStorage2D(r.TEXTURE_2D,Nt,It,mt.width,mt.height),q&&Q(T,mt,Lt,kt)):i.texImage2D(r.TEXTURE_2D,0,It,mt.width,mt.height,0,Lt,kt,mt.data);else if(T.isCompressedTexture)if(T.isCompressedArrayTexture){te&&le&&i.texStorage3D(r.TEXTURE_2D_ARRAY,Nt,It,Yt[0].width,Yt[0].height,mt.depth);for(let vt=0,Pt=Yt.length;vt<Pt;vt++)if(Bt=Yt[vt],T.format!==qi)if(Lt!==null)if(te){if(q)if(T.layerUpdates.size>0){const Ht=pv(Bt.width,Bt.height,T.format,T.type);for(const Tt of T.layerUpdates){const jt=Bt.data.subarray(Tt*Ht/Bt.data.BYTES_PER_ELEMENT,(Tt+1)*Ht/Bt.data.BYTES_PER_ELEMENT);i.compressedTexSubImage3D(r.TEXTURE_2D_ARRAY,vt,0,0,Tt,Bt.width,Bt.height,1,Lt,jt)}T.clearLayerUpdates()}else i.compressedTexSubImage3D(r.TEXTURE_2D_ARRAY,vt,0,0,0,Bt.width,Bt.height,mt.depth,Lt,Bt.data)}else i.compressedTexImage3D(r.TEXTURE_2D_ARRAY,vt,It,Bt.width,Bt.height,mt.depth,0,Bt.data,0,0);else ue("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else te?q&&i.texSubImage3D(r.TEXTURE_2D_ARRAY,vt,0,0,0,Bt.width,Bt.height,mt.depth,Lt,kt,Bt.data):i.texImage3D(r.TEXTURE_2D_ARRAY,vt,It,Bt.width,Bt.height,mt.depth,0,Lt,kt,Bt.data)}else{te&&le&&i.texStorage2D(r.TEXTURE_2D,Nt,It,Yt[0].width,Yt[0].height);for(let vt=0,Pt=Yt.length;vt<Pt;vt++)Bt=Yt[vt],T.format!==qi?Lt!==null?te?q&&i.compressedTexSubImage2D(r.TEXTURE_2D,vt,0,0,Bt.width,Bt.height,Lt,Bt.data):i.compressedTexImage2D(r.TEXTURE_2D,vt,It,Bt.width,Bt.height,0,Bt.data):ue("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):te?q&&i.texSubImage2D(r.TEXTURE_2D,vt,0,0,Bt.width,Bt.height,Lt,kt,Bt.data):i.texImage2D(r.TEXTURE_2D,vt,It,Bt.width,Bt.height,0,Lt,kt,Bt.data)}else if(T.isDataArrayTexture)if(te){if(le&&i.texStorage3D(r.TEXTURE_2D_ARRAY,Nt,It,mt.width,mt.height,mt.depth),q)if(T.layerUpdates.size>0){const vt=pv(mt.width,mt.height,T.format,T.type);for(const Pt of T.layerUpdates){const Ht=mt.data.subarray(Pt*vt/mt.data.BYTES_PER_ELEMENT,(Pt+1)*vt/mt.data.BYTES_PER_ELEMENT);i.texSubImage3D(r.TEXTURE_2D_ARRAY,0,0,0,Pt,mt.width,mt.height,1,Lt,kt,Ht)}T.clearLayerUpdates()}else i.texSubImage3D(r.TEXTURE_2D_ARRAY,0,0,0,0,mt.width,mt.height,mt.depth,Lt,kt,mt.data)}else i.texImage3D(r.TEXTURE_2D_ARRAY,0,It,mt.width,mt.height,mt.depth,0,Lt,kt,mt.data);else if(T.isData3DTexture)te?(le&&i.texStorage3D(r.TEXTURE_3D,Nt,It,mt.width,mt.height,mt.depth),q&&i.texSubImage3D(r.TEXTURE_3D,0,0,0,0,mt.width,mt.height,mt.depth,Lt,kt,mt.data)):i.texImage3D(r.TEXTURE_3D,0,It,mt.width,mt.height,mt.depth,0,Lt,kt,mt.data);else if(T.isFramebufferTexture){if(le)if(te)i.texStorage2D(r.TEXTURE_2D,Nt,It,mt.width,mt.height);else{let vt=mt.width,Pt=mt.height;for(let Ht=0;Ht<Nt;Ht++)i.texImage2D(r.TEXTURE_2D,Ht,It,vt,Pt,0,Lt,kt,null),vt>>=1,Pt>>=1}}else if(T.isHTMLTexture){if("texElementImage2D"in r){const vt=r.canvas;if(vt.hasAttribute("layoutsubtree")||vt.setAttribute("layoutsubtree","true"),mt.parentNode!==vt){vt.appendChild(mt),v.add(T),vt.onpaint=Pt=>{const Ht=Pt.changedElements;for(const Tt of v)Ht.includes(Tt.image)&&(Tt.needsUpdate=!0)},vt.requestPaint();return}if(r.texElementImage2D.length===3)r.texElementImage2D(r.TEXTURE_2D,r.RGBA8,mt);else{const Ht=r.RGBA,Tt=r.RGBA,jt=r.UNSIGNED_BYTE;r.texElementImage2D(r.TEXTURE_2D,0,Ht,Tt,jt,mt)}r.texParameteri(r.TEXTURE_2D,r.TEXTURE_MIN_FILTER,r.LINEAR),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_WRAP_S,r.CLAMP_TO_EDGE),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_WRAP_T,r.CLAMP_TO_EDGE)}}else if(Yt.length>0){if(te&&le){const vt=Le(Yt[0]);i.texStorage2D(r.TEXTURE_2D,Nt,It,vt.width,vt.height)}for(let vt=0,Pt=Yt.length;vt<Pt;vt++)Bt=Yt[vt],te?q&&i.texSubImage2D(r.TEXTURE_2D,vt,0,0,Lt,kt,Bt):i.texImage2D(r.TEXTURE_2D,vt,It,Lt,kt,Bt);T.generateMipmaps=!1}else if(te){if(le){const vt=Le(mt);i.texStorage2D(r.TEXTURE_2D,Nt,It,vt.width,vt.height)}q&&i.texSubImage2D(r.TEXTURE_2D,0,0,0,Lt,kt,mt)}else i.texImage2D(r.TEXTURE_2D,0,It,Lt,kt,mt);S(T)&&O(rt),Ot.__version=Dt.version,T.onUpdate&&T.onUpdate(T)}I.__version=T.version}function zt(I,T,j){if(T.image.length!==6)return;const rt=et(I,T),pt=T.source;i.bindTexture(r.TEXTURE_CUBE_MAP,I.__webglTexture,r.TEXTURE0+j);const Dt=s.get(pt);if(pt.version!==Dt.__version||rt===!0){i.activeTexture(r.TEXTURE0+j);const Ot=Ne.getPrimaries(Ne.workingColorSpace),ft=T.colorSpace===_s?null:Ne.getPrimaries(T.colorSpace),mt=T.colorSpace===_s||Ot===ft?r.NONE:r.BROWSER_DEFAULT_WEBGL;i.pixelStorei(r.UNPACK_FLIP_Y_WEBGL,T.flipY),i.pixelStorei(r.UNPACK_PREMULTIPLY_ALPHA_WEBGL,T.premultiplyAlpha),i.pixelStorei(r.UNPACK_ALIGNMENT,T.unpackAlignment),i.pixelStorei(r.UNPACK_COLORSPACE_CONVERSION_WEBGL,mt);const Lt=T.isCompressedTexture||T.image[0].isCompressedTexture,kt=T.image[0]&&T.image[0].isDataTexture,It=[];for(let Tt=0;Tt<6;Tt++)!Lt&&!kt?It[Tt]=M(T.image[Tt],!0,l.maxCubemapSize):It[Tt]=kt?T.image[Tt].image:T.image[Tt],It[Tt]=Me(T,It[Tt]);const Bt=It[0],Yt=c.convert(T.format,T.colorSpace),te=c.convert(T.type),le=w(T.internalFormat,Yt,te,T.normalized,T.colorSpace),q=T.isVideoTexture!==!0,Nt=Dt.__version===void 0||rt===!0,vt=pt.dataReady;let Pt=N(T,Bt);Ut(r.TEXTURE_CUBE_MAP,T);let Ht;if(Lt){q&&Nt&&i.texStorage2D(r.TEXTURE_CUBE_MAP,Pt,le,Bt.width,Bt.height);for(let Tt=0;Tt<6;Tt++){Ht=It[Tt].mipmaps;for(let jt=0;jt<Ht.length;jt++){const qt=Ht[jt];T.format!==qi?Yt!==null?q?vt&&i.compressedTexSubImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+Tt,jt,0,0,qt.width,qt.height,Yt,qt.data):i.compressedTexImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+Tt,jt,le,qt.width,qt.height,0,qt.data):ue("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):q?vt&&i.texSubImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+Tt,jt,0,0,qt.width,qt.height,Yt,te,qt.data):i.texImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+Tt,jt,le,qt.width,qt.height,0,Yt,te,qt.data)}}}else{if(Ht=T.mipmaps,q&&Nt){Ht.length>0&&Pt++;const Tt=Le(It[0]);i.texStorage2D(r.TEXTURE_CUBE_MAP,Pt,le,Tt.width,Tt.height)}for(let Tt=0;Tt<6;Tt++)if(kt){q?vt&&i.texSubImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+Tt,0,0,0,It[Tt].width,It[Tt].height,Yt,te,It[Tt].data):i.texImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+Tt,0,le,It[Tt].width,It[Tt].height,0,Yt,te,It[Tt].data);for(let jt=0;jt<Ht.length;jt++){const ht=Ht[jt].image[Tt].image;q?vt&&i.texSubImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+Tt,jt+1,0,0,ht.width,ht.height,Yt,te,ht.data):i.texImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+Tt,jt+1,le,ht.width,ht.height,0,Yt,te,ht.data)}}else{q?vt&&i.texSubImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+Tt,0,0,0,Yt,te,It[Tt]):i.texImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+Tt,0,le,Yt,te,It[Tt]);for(let jt=0;jt<Ht.length;jt++){const qt=Ht[jt];q?vt&&i.texSubImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+Tt,jt+1,0,0,Yt,te,qt.image[Tt]):i.texImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+Tt,jt+1,le,Yt,te,qt.image[Tt])}}}S(T)&&O(r.TEXTURE_CUBE_MAP),Dt.__version=pt.version,T.onUpdate&&T.onUpdate(T)}I.__version=T.version}function At(I,T,j,rt,pt,Dt){const Ot=c.convert(j.format,j.colorSpace),ft=c.convert(j.type),mt=w(j.internalFormat,Ot,ft,j.normalized,j.colorSpace),Lt=s.get(T),kt=s.get(j);if(kt.__renderTarget=T,!Lt.__hasExternalTextures){const It=Math.max(1,T.width>>Dt),Bt=Math.max(1,T.height>>Dt);pt===r.TEXTURE_3D||pt===r.TEXTURE_2D_ARRAY?i.texImage3D(pt,Dt,mt,It,Bt,T.depth,0,Ot,ft,null):i.texImage2D(pt,Dt,mt,It,Bt,0,Ot,ft,null)}i.bindFramebuffer(r.FRAMEBUFFER,I),un(T)?d.framebufferTexture2DMultisampleEXT(r.FRAMEBUFFER,rt,pt,kt.__webglTexture,0,Fe(T)):(pt===r.TEXTURE_2D||pt>=r.TEXTURE_CUBE_MAP_POSITIVE_X&&pt<=r.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&r.framebufferTexture2D(r.FRAMEBUFFER,rt,pt,kt.__webglTexture,Dt),i.bindFramebuffer(r.FRAMEBUFFER,null)}function oe(I,T,j){if(r.bindRenderbuffer(r.RENDERBUFFER,I),T.depthBuffer){const rt=T.depthTexture,pt=rt&&rt.isDepthTexture?rt.type:null,Dt=z(T.stencilBuffer,pt),Ot=T.stencilBuffer?r.DEPTH_STENCIL_ATTACHMENT:r.DEPTH_ATTACHMENT;un(T)?d.renderbufferStorageMultisampleEXT(r.RENDERBUFFER,Fe(T),Dt,T.width,T.height):j?r.renderbufferStorageMultisample(r.RENDERBUFFER,Fe(T),Dt,T.width,T.height):r.renderbufferStorage(r.RENDERBUFFER,Dt,T.width,T.height),r.framebufferRenderbuffer(r.FRAMEBUFFER,Ot,r.RENDERBUFFER,I)}else{const rt=T.textures;for(let pt=0;pt<rt.length;pt++){const Dt=rt[pt],Ot=c.convert(Dt.format,Dt.colorSpace),ft=c.convert(Dt.type),mt=w(Dt.internalFormat,Ot,ft,Dt.normalized,Dt.colorSpace);un(T)?d.renderbufferStorageMultisampleEXT(r.RENDERBUFFER,Fe(T),mt,T.width,T.height):j?r.renderbufferStorageMultisample(r.RENDERBUFFER,Fe(T),mt,T.width,T.height):r.renderbufferStorage(r.RENDERBUFFER,mt,T.width,T.height)}}r.bindRenderbuffer(r.RENDERBUFFER,null)}function Xt(I,T,j){const rt=T.isWebGLCubeRenderTarget===!0;if(i.bindFramebuffer(r.FRAMEBUFFER,I),!(T.depthTexture&&T.depthTexture.isDepthTexture))throw new Error("THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.");const pt=s.get(T.depthTexture);if(pt.__renderTarget=T,(!pt.__webglTexture||T.depthTexture.image.width!==T.width||T.depthTexture.image.height!==T.height)&&(T.depthTexture.image.width=T.width,T.depthTexture.image.height=T.height,T.depthTexture.needsUpdate=!0),rt){if(pt.__webglInit===void 0&&(pt.__webglInit=!0,T.depthTexture.addEventListener("dispose",L)),pt.__webglTexture===void 0){pt.__webglTexture=r.createTexture(),i.bindTexture(r.TEXTURE_CUBE_MAP,pt.__webglTexture),Ut(r.TEXTURE_CUBE_MAP,T.depthTexture);const Lt=c.convert(T.depthTexture.format),kt=c.convert(T.depthTexture.type);let It;T.depthTexture.format===Ba?It=r.DEPTH_COMPONENT24:T.depthTexture.format===Ys&&(It=r.DEPTH24_STENCIL8);for(let Bt=0;Bt<6;Bt++)r.texImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+Bt,0,It,T.width,T.height,0,Lt,kt,null)}}else tt(T.depthTexture,0);const Dt=pt.__webglTexture,Ot=Fe(T),ft=rt?r.TEXTURE_CUBE_MAP_POSITIVE_X+j:r.TEXTURE_2D,mt=T.depthTexture.format===Ys?r.DEPTH_STENCIL_ATTACHMENT:r.DEPTH_ATTACHMENT;if(T.depthTexture.format===Ba)un(T)?d.framebufferTexture2DMultisampleEXT(r.FRAMEBUFFER,mt,ft,Dt,0,Ot):r.framebufferTexture2D(r.FRAMEBUFFER,mt,ft,Dt,0);else if(T.depthTexture.format===Ys)un(T)?d.framebufferTexture2DMultisampleEXT(r.FRAMEBUFFER,mt,ft,Dt,0,Ot):r.framebufferTexture2D(r.FRAMEBUFFER,mt,ft,Dt,0);else throw new Error("THREE.WebGLTextures: Unknown depthTexture format.")}function fe(I){const T=s.get(I),j=I.isWebGLCubeRenderTarget===!0;if(T.__boundDepthTexture!==I.depthTexture){const rt=I.depthTexture;if(T.__depthDisposeCallback&&T.__depthDisposeCallback(),rt){const pt=()=>{delete T.__boundDepthTexture,delete T.__depthDisposeCallback,rt.removeEventListener("dispose",pt)};rt.addEventListener("dispose",pt),T.__depthDisposeCallback=pt}T.__boundDepthTexture=rt}if(I.depthTexture&&!T.__autoAllocateDepthBuffer)if(j)for(let rt=0;rt<6;rt++)Xt(T.__webglFramebuffer[rt],I,rt);else{const rt=I.texture.mipmaps;rt&&rt.length>0?Xt(T.__webglFramebuffer[0],I,0):Xt(T.__webglFramebuffer,I,0)}else if(j){T.__webglDepthbuffer=[];for(let rt=0;rt<6;rt++)if(i.bindFramebuffer(r.FRAMEBUFFER,T.__webglFramebuffer[rt]),T.__webglDepthbuffer[rt]===void 0)T.__webglDepthbuffer[rt]=r.createRenderbuffer(),oe(T.__webglDepthbuffer[rt],I,!1);else{const pt=I.stencilBuffer?r.DEPTH_STENCIL_ATTACHMENT:r.DEPTH_ATTACHMENT,Dt=T.__webglDepthbuffer[rt];r.bindRenderbuffer(r.RENDERBUFFER,Dt),r.framebufferRenderbuffer(r.FRAMEBUFFER,pt,r.RENDERBUFFER,Dt)}}else{const rt=I.texture.mipmaps;if(rt&&rt.length>0?i.bindFramebuffer(r.FRAMEBUFFER,T.__webglFramebuffer[0]):i.bindFramebuffer(r.FRAMEBUFFER,T.__webglFramebuffer),T.__webglDepthbuffer===void 0)T.__webglDepthbuffer=r.createRenderbuffer(),oe(T.__webglDepthbuffer,I,!1);else{const pt=I.stencilBuffer?r.DEPTH_STENCIL_ATTACHMENT:r.DEPTH_ATTACHMENT,Dt=T.__webglDepthbuffer;r.bindRenderbuffer(r.RENDERBUFFER,Dt),r.framebufferRenderbuffer(r.FRAMEBUFFER,pt,r.RENDERBUFFER,Dt)}}i.bindFramebuffer(r.FRAMEBUFFER,null)}function ve(I,T,j){const rt=s.get(I);T!==void 0&&At(rt.__webglFramebuffer,I,I.texture,r.COLOR_ATTACHMENT0,r.TEXTURE_2D,0),j!==void 0&&fe(I)}function ge(I){const T=I.texture,j=s.get(I),rt=s.get(T);I.addEventListener("dispose",E);const pt=I.textures,Dt=I.isWebGLCubeRenderTarget===!0,Ot=pt.length>1;if(Ot||(rt.__webglTexture===void 0&&(rt.__webglTexture=r.createTexture()),rt.__version=T.version,f.memory.textures++),Dt){j.__webglFramebuffer=[];for(let ft=0;ft<6;ft++)if(T.mipmaps&&T.mipmaps.length>0){j.__webglFramebuffer[ft]=[];for(let mt=0;mt<T.mipmaps.length;mt++)j.__webglFramebuffer[ft][mt]=r.createFramebuffer()}else j.__webglFramebuffer[ft]=r.createFramebuffer()}else{if(T.mipmaps&&T.mipmaps.length>0){j.__webglFramebuffer=[];for(let ft=0;ft<T.mipmaps.length;ft++)j.__webglFramebuffer[ft]=r.createFramebuffer()}else j.__webglFramebuffer=r.createFramebuffer();if(Ot)for(let ft=0,mt=pt.length;ft<mt;ft++){const Lt=s.get(pt[ft]);Lt.__webglTexture===void 0&&(Lt.__webglTexture=r.createTexture(),f.memory.textures++)}if(I.samples>0&&un(I)===!1){j.__webglMultisampledFramebuffer=r.createFramebuffer(),j.__webglColorRenderbuffer=[],i.bindFramebuffer(r.FRAMEBUFFER,j.__webglMultisampledFramebuffer);for(let ft=0;ft<pt.length;ft++){const mt=pt[ft];j.__webglColorRenderbuffer[ft]=r.createRenderbuffer(),r.bindRenderbuffer(r.RENDERBUFFER,j.__webglColorRenderbuffer[ft]);const Lt=c.convert(mt.format,mt.colorSpace),kt=c.convert(mt.type),It=w(mt.internalFormat,Lt,kt,mt.normalized,mt.colorSpace,I.isXRRenderTarget===!0),Bt=Fe(I);r.renderbufferStorageMultisample(r.RENDERBUFFER,Bt,It,I.width,I.height),r.framebufferRenderbuffer(r.FRAMEBUFFER,r.COLOR_ATTACHMENT0+ft,r.RENDERBUFFER,j.__webglColorRenderbuffer[ft])}r.bindRenderbuffer(r.RENDERBUFFER,null),I.depthBuffer&&(j.__webglDepthRenderbuffer=r.createRenderbuffer(),oe(j.__webglDepthRenderbuffer,I,!0)),i.bindFramebuffer(r.FRAMEBUFFER,null)}}if(Dt){i.bindTexture(r.TEXTURE_CUBE_MAP,rt.__webglTexture),Ut(r.TEXTURE_CUBE_MAP,T);for(let ft=0;ft<6;ft++)if(T.mipmaps&&T.mipmaps.length>0)for(let mt=0;mt<T.mipmaps.length;mt++)At(j.__webglFramebuffer[ft][mt],I,T,r.COLOR_ATTACHMENT0,r.TEXTURE_CUBE_MAP_POSITIVE_X+ft,mt);else At(j.__webglFramebuffer[ft],I,T,r.COLOR_ATTACHMENT0,r.TEXTURE_CUBE_MAP_POSITIVE_X+ft,0);S(T)&&O(r.TEXTURE_CUBE_MAP),i.unbindTexture()}else if(Ot){for(let ft=0,mt=pt.length;ft<mt;ft++){const Lt=pt[ft],kt=s.get(Lt);let It=r.TEXTURE_2D;(I.isWebGL3DRenderTarget||I.isWebGLArrayRenderTarget)&&(It=I.isWebGL3DRenderTarget?r.TEXTURE_3D:r.TEXTURE_2D_ARRAY),i.bindTexture(It,kt.__webglTexture),Ut(It,Lt),At(j.__webglFramebuffer,I,Lt,r.COLOR_ATTACHMENT0+ft,It,0),S(Lt)&&O(It)}i.unbindTexture()}else{let ft=r.TEXTURE_2D;if((I.isWebGL3DRenderTarget||I.isWebGLArrayRenderTarget)&&(ft=I.isWebGL3DRenderTarget?r.TEXTURE_3D:r.TEXTURE_2D_ARRAY),i.bindTexture(ft,rt.__webglTexture),Ut(ft,T),T.mipmaps&&T.mipmaps.length>0)for(let mt=0;mt<T.mipmaps.length;mt++)At(j.__webglFramebuffer[mt],I,T,r.COLOR_ATTACHMENT0,ft,mt);else At(j.__webglFramebuffer,I,T,r.COLOR_ATTACHMENT0,ft,0);S(T)&&O(ft),i.unbindTexture()}I.depthBuffer&&fe(I)}function Xe(I){const T=I.textures;for(let j=0,rt=T.length;j<rt;j++){const pt=T[j];if(S(pt)){const Dt=U(I),Ot=s.get(pt).__webglTexture;i.bindTexture(Dt,Ot),O(Dt),i.unbindTexture()}}}const rn=[],tn=[];function mn(I){if(I.samples>0){if(un(I)===!1){const T=I.textures,j=I.width,rt=I.height;let pt=r.COLOR_BUFFER_BIT;const Dt=I.stencilBuffer?r.DEPTH_STENCIL_ATTACHMENT:r.DEPTH_ATTACHMENT,Ot=s.get(I),ft=T.length>1;if(ft)for(let Lt=0;Lt<T.length;Lt++)i.bindFramebuffer(r.FRAMEBUFFER,Ot.__webglMultisampledFramebuffer),r.framebufferRenderbuffer(r.FRAMEBUFFER,r.COLOR_ATTACHMENT0+Lt,r.RENDERBUFFER,null),i.bindFramebuffer(r.FRAMEBUFFER,Ot.__webglFramebuffer),r.framebufferTexture2D(r.DRAW_FRAMEBUFFER,r.COLOR_ATTACHMENT0+Lt,r.TEXTURE_2D,null,0);i.bindFramebuffer(r.READ_FRAMEBUFFER,Ot.__webglMultisampledFramebuffer);const mt=I.texture.mipmaps;mt&&mt.length>0?i.bindFramebuffer(r.DRAW_FRAMEBUFFER,Ot.__webglFramebuffer[0]):i.bindFramebuffer(r.DRAW_FRAMEBUFFER,Ot.__webglFramebuffer);for(let Lt=0;Lt<T.length;Lt++){if(I.resolveDepthBuffer&&(I.depthBuffer&&(pt|=r.DEPTH_BUFFER_BIT),I.stencilBuffer&&I.resolveStencilBuffer&&(pt|=r.STENCIL_BUFFER_BIT)),ft){r.framebufferRenderbuffer(r.READ_FRAMEBUFFER,r.COLOR_ATTACHMENT0,r.RENDERBUFFER,Ot.__webglColorRenderbuffer[Lt]);const kt=s.get(T[Lt]).__webglTexture;r.framebufferTexture2D(r.DRAW_FRAMEBUFFER,r.COLOR_ATTACHMENT0,r.TEXTURE_2D,kt,0)}r.blitFramebuffer(0,0,j,rt,0,0,j,rt,pt,r.NEAREST),m===!0&&(rn.length=0,tn.length=0,rn.push(r.COLOR_ATTACHMENT0+Lt),I.depthBuffer&&I.resolveDepthBuffer===!1&&(rn.push(Dt),tn.push(Dt),r.invalidateFramebuffer(r.DRAW_FRAMEBUFFER,tn)),r.invalidateFramebuffer(r.READ_FRAMEBUFFER,rn))}if(i.bindFramebuffer(r.READ_FRAMEBUFFER,null),i.bindFramebuffer(r.DRAW_FRAMEBUFFER,null),ft)for(let Lt=0;Lt<T.length;Lt++){i.bindFramebuffer(r.FRAMEBUFFER,Ot.__webglMultisampledFramebuffer),r.framebufferRenderbuffer(r.FRAMEBUFFER,r.COLOR_ATTACHMENT0+Lt,r.RENDERBUFFER,Ot.__webglColorRenderbuffer[Lt]);const kt=s.get(T[Lt]).__webglTexture;i.bindFramebuffer(r.FRAMEBUFFER,Ot.__webglFramebuffer),r.framebufferTexture2D(r.DRAW_FRAMEBUFFER,r.COLOR_ATTACHMENT0+Lt,r.TEXTURE_2D,kt,0)}i.bindFramebuffer(r.DRAW_FRAMEBUFFER,Ot.__webglMultisampledFramebuffer)}else if(I.depthBuffer&&I.resolveDepthBuffer===!1&&m){const T=I.stencilBuffer?r.DEPTH_STENCIL_ATTACHMENT:r.DEPTH_ATTACHMENT;r.invalidateFramebuffer(r.DRAW_FRAMEBUFFER,[T])}}}function Fe(I){return Math.min(l.maxSamples,I.samples)}function un(I){const T=s.get(I);return I.samples>0&&t.has("WEBGL_multisampled_render_to_texture")===!0&&T.__useRenderToTexture!==!1}function Y(I){const T=f.render.frame;_.get(I)!==T&&(_.set(I,T),I.update())}function Me(I,T){const j=I.colorSpace,rt=I.format,pt=I.type;return I.isCompressedTexture===!0||I.isVideoTexture===!0||j!==pu&&j!==_s&&(Ne.getTransfer(j)===Je?(rt!==qi||pt!==Ei)&&ue("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):Oe("WebGLTextures: Unsupported texture color space:",j)),T}function Le(I){return typeof HTMLImageElement<"u"&&I instanceof HTMLImageElement?(p.width=I.naturalWidth||I.width,p.height=I.naturalHeight||I.height):typeof VideoFrame<"u"&&I instanceof VideoFrame?(p.width=I.displayWidth,p.height=I.displayHeight):(p.width=I.width,p.height=I.height),p}this.allocateTextureUnit=P,this.resetTextureUnits=ct,this.getTextureUnits=ut,this.setTextureUnits=Z,this.setTexture2D=tt,this.setTexture2DArray=_t,this.setTexture3D=Et,this.setTextureCube=B,this.rebindTextures=ve,this.setupRenderTarget=ge,this.updateRenderTargetMipmap=Xe,this.updateMultisampleRenderTarget=mn,this.setupDepthRenderbuffer=fe,this.setupFrameBufferTexture=At,this.useMultisampledRTT=un,this.isReversedDepthBuffer=function(){return i.buffers.depth.getReversed()}}function Z2(r,t){function i(s,l=_s){let c;const f=Ne.getTransfer(l);if(s===Ei)return r.UNSIGNED_BYTE;if(s===mp)return r.UNSIGNED_SHORT_4_4_4_4;if(s===gp)return r.UNSIGNED_SHORT_5_5_5_1;if(s===nx)return r.UNSIGNED_INT_5_9_9_9_REV;if(s===ix)return r.UNSIGNED_INT_10F_11F_11F_REV;if(s===tx)return r.BYTE;if(s===ex)return r.SHORT;if(s===vl)return r.UNSIGNED_SHORT;if(s===pp)return r.INT;if(s===sa)return r.UNSIGNED_INT;if(s===Wi)return r.FLOAT;if(s===za)return r.HALF_FLOAT;if(s===ax)return r.ALPHA;if(s===sx)return r.RGB;if(s===qi)return r.RGBA;if(s===Ba)return r.DEPTH_COMPONENT;if(s===Ys)return r.DEPTH_STENCIL;if(s===_p)return r.RED;if(s===vp)return r.RED_INTEGER;if(s===js)return r.RG;if(s===xp)return r.RG_INTEGER;if(s===Sp)return r.RGBA_INTEGER;if(s===ru||s===ou||s===lu||s===cu)if(f===Je)if(c=t.get("WEBGL_compressed_texture_s3tc_srgb"),c!==null){if(s===ru)return c.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(s===ou)return c.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(s===lu)return c.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(s===cu)return c.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(c=t.get("WEBGL_compressed_texture_s3tc"),c!==null){if(s===ru)return c.COMPRESSED_RGB_S3TC_DXT1_EXT;if(s===ou)return c.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(s===lu)return c.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(s===cu)return c.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(s===Rd||s===Cd||s===Dd||s===Ud)if(c=t.get("WEBGL_compressed_texture_pvrtc"),c!==null){if(s===Rd)return c.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(s===Cd)return c.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(s===Dd)return c.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(s===Ud)return c.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(s===Nd||s===Ld||s===Od||s===Pd||s===zd||s===hu||s===Bd)if(c=t.get("WEBGL_compressed_texture_etc"),c!==null){if(s===Nd||s===Ld)return f===Je?c.COMPRESSED_SRGB8_ETC2:c.COMPRESSED_RGB8_ETC2;if(s===Od)return f===Je?c.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:c.COMPRESSED_RGBA8_ETC2_EAC;if(s===Pd)return c.COMPRESSED_R11_EAC;if(s===zd)return c.COMPRESSED_SIGNED_R11_EAC;if(s===hu)return c.COMPRESSED_RG11_EAC;if(s===Bd)return c.COMPRESSED_SIGNED_RG11_EAC}else return null;if(s===Id||s===Fd||s===Hd||s===Gd||s===Vd||s===kd||s===Xd||s===Wd||s===qd||s===Yd||s===Zd||s===Kd||s===Jd||s===Qd)if(c=t.get("WEBGL_compressed_texture_astc"),c!==null){if(s===Id)return f===Je?c.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:c.COMPRESSED_RGBA_ASTC_4x4_KHR;if(s===Fd)return f===Je?c.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:c.COMPRESSED_RGBA_ASTC_5x4_KHR;if(s===Hd)return f===Je?c.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:c.COMPRESSED_RGBA_ASTC_5x5_KHR;if(s===Gd)return f===Je?c.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:c.COMPRESSED_RGBA_ASTC_6x5_KHR;if(s===Vd)return f===Je?c.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:c.COMPRESSED_RGBA_ASTC_6x6_KHR;if(s===kd)return f===Je?c.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:c.COMPRESSED_RGBA_ASTC_8x5_KHR;if(s===Xd)return f===Je?c.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:c.COMPRESSED_RGBA_ASTC_8x6_KHR;if(s===Wd)return f===Je?c.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:c.COMPRESSED_RGBA_ASTC_8x8_KHR;if(s===qd)return f===Je?c.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:c.COMPRESSED_RGBA_ASTC_10x5_KHR;if(s===Yd)return f===Je?c.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:c.COMPRESSED_RGBA_ASTC_10x6_KHR;if(s===Zd)return f===Je?c.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:c.COMPRESSED_RGBA_ASTC_10x8_KHR;if(s===Kd)return f===Je?c.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:c.COMPRESSED_RGBA_ASTC_10x10_KHR;if(s===Jd)return f===Je?c.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:c.COMPRESSED_RGBA_ASTC_12x10_KHR;if(s===Qd)return f===Je?c.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:c.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(s===jd||s===$d||s===tp)if(c=t.get("EXT_texture_compression_bptc"),c!==null){if(s===jd)return f===Je?c.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:c.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(s===$d)return c.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(s===tp)return c.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(s===ep||s===np||s===du||s===ip)if(c=t.get("EXT_texture_compression_rgtc"),c!==null){if(s===ep)return c.COMPRESSED_RED_RGTC1_EXT;if(s===np)return c.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(s===du)return c.COMPRESSED_RED_GREEN_RGTC2_EXT;if(s===ip)return c.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return s===xl?r.UNSIGNED_INT_24_8:r[s]!==void 0?r[s]:null}return{convert:i}}const K2=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,J2=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`;class Q2{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(t,i){if(this.texture===null){const s=new mx(t.texture);(t.depthNear!==i.depthNear||t.depthFar!==i.depthFar)&&(this.depthNear=t.depthNear,this.depthFar=t.depthFar),this.texture=s}}getMesh(t){if(this.texture!==null&&this.mesh===null){const i=t.cameras[0].viewport,s=new ra({vertexShader:K2,fragmentShader:J2,uniforms:{depthColor:{value:this.texture},depthWidth:{value:i.z},depthHeight:{value:i.w}}});this.mesh=new ie(new Su(20,20),s)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}}class j2 extends tr{constructor(t,i){super();const s=this;let l=null,c=1,f=null,d="local-floor",m=1,p=null,_=null,v=null,g=null,x=null,b=null;const A=typeof XRWebGLBinding<"u",M=new Q2,S={},O=i.getContextAttributes();let U=null,w=null;const z=[],N=[],L=new ae;let E=null;const D=new bi;D.viewport=new gn;const F=new bi;F.viewport=new gn;const H=[D,F],X=new lb;let ct=null,ut=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(et){let yt=z[et];return yt===void 0&&(yt=new Vh,z[et]=yt),yt.getTargetRaySpace()},this.getControllerGrip=function(et){let yt=z[et];return yt===void 0&&(yt=new Vh,z[et]=yt),yt.getGripSpace()},this.getHand=function(et){let yt=z[et];return yt===void 0&&(yt=new Vh,z[et]=yt),yt.getHandSpace()};function Z(et){const yt=N.indexOf(et.inputSource);if(yt===-1)return;const Q=z[yt];Q!==void 0&&(Q.update(et.inputSource,et.frame,p||f),Q.dispatchEvent({type:et.type,data:et.inputSource}))}function P(){l.removeEventListener("select",Z),l.removeEventListener("selectstart",Z),l.removeEventListener("selectend",Z),l.removeEventListener("squeeze",Z),l.removeEventListener("squeezestart",Z),l.removeEventListener("squeezeend",Z),l.removeEventListener("end",P),l.removeEventListener("inputsourceschange",k);for(let et=0;et<z.length;et++){const yt=N[et];yt!==null&&(N[et]=null,z[et].disconnect(yt))}ct=null,ut=null,M.reset();for(const et in S)delete S[et];t.setRenderTarget(U),x=null,g=null,v=null,l=null,w=null,Ut.stop(),s.isPresenting=!1,t.setPixelRatio(E),t.setSize(L.width,L.height,!1),s.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(et){c=et,s.isPresenting===!0&&ue("WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(et){d=et,s.isPresenting===!0&&ue("WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return p||f},this.setReferenceSpace=function(et){p=et},this.getBaseLayer=function(){return g!==null?g:x},this.getBinding=function(){return v===null&&A&&(v=new XRWebGLBinding(l,i)),v},this.getFrame=function(){return b},this.getSession=function(){return l},this.setSession=async function(et){if(l=et,l!==null){if(U=t.getRenderTarget(),l.addEventListener("select",Z),l.addEventListener("selectstart",Z),l.addEventListener("selectend",Z),l.addEventListener("squeeze",Z),l.addEventListener("squeezestart",Z),l.addEventListener("squeezeend",Z),l.addEventListener("end",P),l.addEventListener("inputsourceschange",k),O.xrCompatible!==!0&&await i.makeXRCompatible(),E=t.getPixelRatio(),t.getSize(L),A&&"createProjectionLayer"in XRWebGLBinding.prototype){let Q=null,gt=null,zt=null;O.depth&&(zt=O.stencil?i.DEPTH24_STENCIL8:i.DEPTH_COMPONENT24,Q=O.stencil?Ys:Ba,gt=O.stencil?xl:sa);const At={colorFormat:i.RGBA8,depthFormat:zt,scaleFactor:c};v=this.getBinding(),g=v.createProjectionLayer(At),l.updateRenderState({layers:[g]}),t.setPixelRatio(1),t.setSize(g.textureWidth,g.textureHeight,!1),w=new aa(g.textureWidth,g.textureHeight,{format:qi,type:Ei,depthTexture:new eo(g.textureWidth,g.textureHeight,gt,void 0,void 0,void 0,void 0,void 0,void 0,Q),stencilBuffer:O.stencil,colorSpace:t.outputColorSpace,samples:O.antialias?4:0,resolveDepthBuffer:g.ignoreDepthValues===!1,resolveStencilBuffer:g.ignoreDepthValues===!1})}else{const Q={antialias:O.antialias,alpha:!0,depth:O.depth,stencil:O.stencil,framebufferScaleFactor:c};x=new XRWebGLLayer(l,i,Q),l.updateRenderState({baseLayer:x}),t.setPixelRatio(1),t.setSize(x.framebufferWidth,x.framebufferHeight,!1),w=new aa(x.framebufferWidth,x.framebufferHeight,{format:qi,type:Ei,colorSpace:t.outputColorSpace,stencilBuffer:O.stencil,resolveDepthBuffer:x.ignoreDepthValues===!1,resolveStencilBuffer:x.ignoreDepthValues===!1})}w.isXRRenderTarget=!0,this.setFoveation(m),p=null,f=await l.requestReferenceSpace(d),Ut.setContext(l),Ut.start(),s.isPresenting=!0,s.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(l!==null)return l.environmentBlendMode},this.getDepthTexture=function(){return M.getDepthTexture()};function k(et){for(let yt=0;yt<et.removed.length;yt++){const Q=et.removed[yt],gt=N.indexOf(Q);gt>=0&&(N[gt]=null,z[gt].disconnect(Q))}for(let yt=0;yt<et.added.length;yt++){const Q=et.added[yt];let gt=N.indexOf(Q);if(gt===-1){for(let At=0;At<z.length;At++)if(At>=N.length){N.push(Q),gt=At;break}else if(N[At]===null){N[At]=Q,gt=At;break}if(gt===-1)break}const zt=z[gt];zt&&zt.connect(Q)}}const tt=new V,_t=new V;function Et(et,yt,Q){tt.setFromMatrixPosition(yt.matrixWorld),_t.setFromMatrixPosition(Q.matrixWorld);const gt=tt.distanceTo(_t),zt=yt.projectionMatrix.elements,At=Q.projectionMatrix.elements,oe=zt[14]/(zt[10]-1),Xt=zt[14]/(zt[10]+1),fe=(zt[9]+1)/zt[5],ve=(zt[9]-1)/zt[5],ge=(zt[8]-1)/zt[0],Xe=(At[8]+1)/At[0],rn=oe*ge,tn=oe*Xe,mn=gt/(-ge+Xe),Fe=mn*-ge;if(yt.matrixWorld.decompose(et.position,et.quaternion,et.scale),et.translateX(Fe),et.translateZ(mn),et.matrixWorld.compose(et.position,et.quaternion,et.scale),et.matrixWorldInverse.copy(et.matrixWorld).invert(),zt[10]===-1)et.projectionMatrix.copy(yt.projectionMatrix),et.projectionMatrixInverse.copy(yt.projectionMatrixInverse);else{const un=oe+mn,Y=Xt+mn,Me=rn-Fe,Le=tn+(gt-Fe),I=fe*Xt/Y*un,T=ve*Xt/Y*un;et.projectionMatrix.makePerspective(Me,Le,I,T,un,Y),et.projectionMatrixInverse.copy(et.projectionMatrix).invert()}}function B(et,yt){yt===null?et.matrixWorld.copy(et.matrix):et.matrixWorld.multiplyMatrices(yt.matrixWorld,et.matrix),et.matrixWorldInverse.copy(et.matrixWorld).invert()}this.updateCamera=function(et){if(l===null)return;let yt=et.near,Q=et.far;M.texture!==null&&(M.depthNear>0&&(yt=M.depthNear),M.depthFar>0&&(Q=M.depthFar)),X.near=F.near=D.near=yt,X.far=F.far=D.far=Q,(ct!==X.near||ut!==X.far)&&(l.updateRenderState({depthNear:X.near,depthFar:X.far}),ct=X.near,ut=X.far),X.layers.mask=et.layers.mask|6,D.layers.mask=X.layers.mask&-5,F.layers.mask=X.layers.mask&-3;const gt=et.parent,zt=X.cameras;B(X,gt);for(let At=0;At<zt.length;At++)B(zt[At],gt);zt.length===2?Et(X,D,F):X.projectionMatrix.copy(D.projectionMatrix),J(et,X,gt)};function J(et,yt,Q){Q===null?et.matrix.copy(yt.matrixWorld):(et.matrix.copy(Q.matrixWorld),et.matrix.invert(),et.matrix.multiply(yt.matrixWorld)),et.matrix.decompose(et.position,et.quaternion,et.scale),et.updateMatrixWorld(!0),et.projectionMatrix.copy(yt.projectionMatrix),et.projectionMatrixInverse.copy(yt.projectionMatrixInverse),et.isPerspectiveCamera&&(et.fov=Ml*2*Math.atan(1/et.projectionMatrix.elements[5]),et.zoom=1)}this.getCamera=function(){return X},this.getFoveation=function(){if(!(g===null&&x===null))return m},this.setFoveation=function(et){m=et,g!==null&&(g.fixedFoveation=et),x!==null&&x.fixedFoveation!==void 0&&(x.fixedFoveation=et)},this.hasDepthSensing=function(){return M.texture!==null},this.getDepthSensingMesh=function(){return M.getMesh(X)},this.getCameraTexture=function(et){return S[et]};let bt=null;function Rt(et,yt){if(_=yt.getViewerPose(p||f),b=yt,_!==null){const Q=_.views;x!==null&&(t.setRenderTargetFramebuffer(w,x.framebuffer),t.setRenderTarget(w));let gt=!1;Q.length!==X.cameras.length&&(X.cameras.length=0,gt=!0);for(let Xt=0;Xt<Q.length;Xt++){const fe=Q[Xt];let ve=null;if(x!==null)ve=x.getViewport(fe);else{const Xe=v.getViewSubImage(g,fe);ve=Xe.viewport,Xt===0&&(t.setRenderTargetTextures(w,Xe.colorTexture,Xe.depthStencilTexture),t.setRenderTarget(w))}let ge=H[Xt];ge===void 0&&(ge=new bi,ge.layers.enable(Xt),ge.viewport=new gn,H[Xt]=ge),ge.matrix.fromArray(fe.transform.matrix),ge.matrix.decompose(ge.position,ge.quaternion,ge.scale),ge.projectionMatrix.fromArray(fe.projectionMatrix),ge.projectionMatrixInverse.copy(ge.projectionMatrix).invert(),ge.viewport.set(ve.x,ve.y,ve.width,ve.height),Xt===0&&(X.matrix.copy(ge.matrix),X.matrix.decompose(X.position,X.quaternion,X.scale)),gt===!0&&X.cameras.push(ge)}const zt=l.enabledFeatures;if(zt&&zt.includes("depth-sensing")&&l.depthUsage=="gpu-optimized"&&A){v=s.getBinding();const Xt=v.getDepthInformation(Q[0]);Xt&&Xt.isValid&&Xt.texture&&M.init(Xt,l.renderState)}if(zt&&zt.includes("camera-access")&&A){t.state.unbindTexture(),v=s.getBinding();for(let Xt=0;Xt<Q.length;Xt++){const fe=Q[Xt].camera;if(fe){let ve=S[fe];ve||(ve=new mx,S[fe]=ve);const ge=v.getCameraImage(fe);ve.sourceTexture=ge}}}}for(let Q=0;Q<z.length;Q++){const gt=N[Q],zt=z[Q];gt!==null&&zt!==void 0&&zt.update(gt,yt,p||f)}bt&&bt(et,yt),yt.detectedPlanes&&s.dispatchEvent({type:"planesdetected",data:yt}),b=null}const Ut=new yx;Ut.setAnimationLoop(Rt),this.setAnimationLoop=function(et){bt=et},this.dispose=function(){}}}const $2=new Ve,Rx=new me;Rx.set(-1,0,0,0,1,0,0,0,1);function t3(r,t){function i(M,S){M.matrixAutoUpdate===!0&&M.updateMatrix(),S.value.copy(M.matrix)}function s(M,S){S.color.getRGB(M.fogColor.value,vx(r)),S.isFog?(M.fogNear.value=S.near,M.fogFar.value=S.far):S.isFogExp2&&(M.fogDensity.value=S.density)}function l(M,S,O,U,w){S.isNodeMaterial?S.uniformsNeedUpdate=!1:S.isMeshBasicMaterial?c(M,S):S.isMeshLambertMaterial?(c(M,S),S.envMap&&(M.envMapIntensity.value=S.envMapIntensity)):S.isMeshToonMaterial?(c(M,S),v(M,S)):S.isMeshPhongMaterial?(c(M,S),_(M,S),S.envMap&&(M.envMapIntensity.value=S.envMapIntensity)):S.isMeshStandardMaterial?(c(M,S),g(M,S),S.isMeshPhysicalMaterial&&x(M,S,w)):S.isMeshMatcapMaterial?(c(M,S),b(M,S)):S.isMeshDepthMaterial?c(M,S):S.isMeshDistanceMaterial?(c(M,S),A(M,S)):S.isMeshNormalMaterial?c(M,S):S.isLineBasicMaterial?(f(M,S),S.isLineDashedMaterial&&d(M,S)):S.isPointsMaterial?m(M,S,O,U):S.isSpriteMaterial?p(M,S):S.isShadowMaterial?(M.color.value.copy(S.color),M.opacity.value=S.opacity):S.isShaderMaterial&&(S.uniformsNeedUpdate=!1)}function c(M,S){M.opacity.value=S.opacity,S.color&&M.diffuse.value.copy(S.color),S.emissive&&M.emissive.value.copy(S.emissive).multiplyScalar(S.emissiveIntensity),S.map&&(M.map.value=S.map,i(S.map,M.mapTransform)),S.alphaMap&&(M.alphaMap.value=S.alphaMap,i(S.alphaMap,M.alphaMapTransform)),S.bumpMap&&(M.bumpMap.value=S.bumpMap,i(S.bumpMap,M.bumpMapTransform),M.bumpScale.value=S.bumpScale,S.side===ni&&(M.bumpScale.value*=-1)),S.normalMap&&(M.normalMap.value=S.normalMap,i(S.normalMap,M.normalMapTransform),M.normalScale.value.copy(S.normalScale),S.side===ni&&M.normalScale.value.negate()),S.displacementMap&&(M.displacementMap.value=S.displacementMap,i(S.displacementMap,M.displacementMapTransform),M.displacementScale.value=S.displacementScale,M.displacementBias.value=S.displacementBias),S.emissiveMap&&(M.emissiveMap.value=S.emissiveMap,i(S.emissiveMap,M.emissiveMapTransform)),S.specularMap&&(M.specularMap.value=S.specularMap,i(S.specularMap,M.specularMapTransform)),S.alphaTest>0&&(M.alphaTest.value=S.alphaTest);const O=t.get(S),U=O.envMap,w=O.envMapRotation;U&&(M.envMap.value=U,M.envMapRotation.value.setFromMatrix4($2.makeRotationFromEuler(w)).transpose(),U.isCubeTexture&&U.isRenderTargetTexture===!1&&M.envMapRotation.value.premultiply(Rx),M.reflectivity.value=S.reflectivity,M.ior.value=S.ior,M.refractionRatio.value=S.refractionRatio),S.lightMap&&(M.lightMap.value=S.lightMap,M.lightMapIntensity.value=S.lightMapIntensity,i(S.lightMap,M.lightMapTransform)),S.aoMap&&(M.aoMap.value=S.aoMap,M.aoMapIntensity.value=S.aoMapIntensity,i(S.aoMap,M.aoMapTransform))}function f(M,S){M.diffuse.value.copy(S.color),M.opacity.value=S.opacity,S.map&&(M.map.value=S.map,i(S.map,M.mapTransform))}function d(M,S){M.dashSize.value=S.dashSize,M.totalSize.value=S.dashSize+S.gapSize,M.scale.value=S.scale}function m(M,S,O,U){M.diffuse.value.copy(S.color),M.opacity.value=S.opacity,M.size.value=S.size*O,M.scale.value=U*.5,S.map&&(M.map.value=S.map,i(S.map,M.uvTransform)),S.alphaMap&&(M.alphaMap.value=S.alphaMap,i(S.alphaMap,M.alphaMapTransform)),S.alphaTest>0&&(M.alphaTest.value=S.alphaTest)}function p(M,S){M.diffuse.value.copy(S.color),M.opacity.value=S.opacity,M.rotation.value=S.rotation,S.map&&(M.map.value=S.map,i(S.map,M.mapTransform)),S.alphaMap&&(M.alphaMap.value=S.alphaMap,i(S.alphaMap,M.alphaMapTransform)),S.alphaTest>0&&(M.alphaTest.value=S.alphaTest)}function _(M,S){M.specular.value.copy(S.specular),M.shininess.value=Math.max(S.shininess,1e-4)}function v(M,S){S.gradientMap&&(M.gradientMap.value=S.gradientMap)}function g(M,S){M.metalness.value=S.metalness,S.metalnessMap&&(M.metalnessMap.value=S.metalnessMap,i(S.metalnessMap,M.metalnessMapTransform)),M.roughness.value=S.roughness,S.roughnessMap&&(M.roughnessMap.value=S.roughnessMap,i(S.roughnessMap,M.roughnessMapTransform)),S.envMap&&(M.envMapIntensity.value=S.envMapIntensity)}function x(M,S,O){M.ior.value=S.ior,S.sheen>0&&(M.sheenColor.value.copy(S.sheenColor).multiplyScalar(S.sheen),M.sheenRoughness.value=S.sheenRoughness,S.sheenColorMap&&(M.sheenColorMap.value=S.sheenColorMap,i(S.sheenColorMap,M.sheenColorMapTransform)),S.sheenRoughnessMap&&(M.sheenRoughnessMap.value=S.sheenRoughnessMap,i(S.sheenRoughnessMap,M.sheenRoughnessMapTransform))),S.clearcoat>0&&(M.clearcoat.value=S.clearcoat,M.clearcoatRoughness.value=S.clearcoatRoughness,S.clearcoatMap&&(M.clearcoatMap.value=S.clearcoatMap,i(S.clearcoatMap,M.clearcoatMapTransform)),S.clearcoatRoughnessMap&&(M.clearcoatRoughnessMap.value=S.clearcoatRoughnessMap,i(S.clearcoatRoughnessMap,M.clearcoatRoughnessMapTransform)),S.clearcoatNormalMap&&(M.clearcoatNormalMap.value=S.clearcoatNormalMap,i(S.clearcoatNormalMap,M.clearcoatNormalMapTransform),M.clearcoatNormalScale.value.copy(S.clearcoatNormalScale),S.side===ni&&M.clearcoatNormalScale.value.negate())),S.dispersion>0&&(M.dispersion.value=S.dispersion),S.iridescence>0&&(M.iridescence.value=S.iridescence,M.iridescenceIOR.value=S.iridescenceIOR,M.iridescenceThicknessMinimum.value=S.iridescenceThicknessRange[0],M.iridescenceThicknessMaximum.value=S.iridescenceThicknessRange[1],S.iridescenceMap&&(M.iridescenceMap.value=S.iridescenceMap,i(S.iridescenceMap,M.iridescenceMapTransform)),S.iridescenceThicknessMap&&(M.iridescenceThicknessMap.value=S.iridescenceThicknessMap,i(S.iridescenceThicknessMap,M.iridescenceThicknessMapTransform))),S.transmission>0&&(M.transmission.value=S.transmission,M.transmissionSamplerMap.value=O.texture,M.transmissionSamplerSize.value.set(O.width,O.height),S.transmissionMap&&(M.transmissionMap.value=S.transmissionMap,i(S.transmissionMap,M.transmissionMapTransform)),M.thickness.value=S.thickness,S.thicknessMap&&(M.thicknessMap.value=S.thicknessMap,i(S.thicknessMap,M.thicknessMapTransform)),M.attenuationDistance.value=S.attenuationDistance,M.attenuationColor.value.copy(S.attenuationColor)),S.anisotropy>0&&(M.anisotropyVector.value.set(S.anisotropy*Math.cos(S.anisotropyRotation),S.anisotropy*Math.sin(S.anisotropyRotation)),S.anisotropyMap&&(M.anisotropyMap.value=S.anisotropyMap,i(S.anisotropyMap,M.anisotropyMapTransform))),M.specularIntensity.value=S.specularIntensity,M.specularColor.value.copy(S.specularColor),S.specularColorMap&&(M.specularColorMap.value=S.specularColorMap,i(S.specularColorMap,M.specularColorMapTransform)),S.specularIntensityMap&&(M.specularIntensityMap.value=S.specularIntensityMap,i(S.specularIntensityMap,M.specularIntensityMapTransform))}function b(M,S){S.matcap&&(M.matcap.value=S.matcap)}function A(M,S){const O=t.get(S).light;M.referencePosition.value.setFromMatrixPosition(O.matrixWorld),M.nearDistance.value=O.shadow.camera.near,M.farDistance.value=O.shadow.camera.far}return{refreshFogUniforms:s,refreshMaterialUniforms:l}}function e3(r,t,i,s){let l={},c={},f=[];const d=r.getParameter(r.MAX_UNIFORM_BUFFER_BINDINGS);function m(w,z){const N=z.program;s.uniformBlockBinding(w,N)}function p(w,z){let N=l[w.id];N===void 0&&(M(w),N=_(w),l[w.id]=N,w.addEventListener("dispose",O));const L=z.program;s.updateUBOMapping(w,L);const E=t.render.frame;c[w.id]!==E&&(g(w),c[w.id]=E)}function _(w){const z=v();w.__bindingPointIndex=z;const N=r.createBuffer(),L=w.__size,E=w.usage;return r.bindBuffer(r.UNIFORM_BUFFER,N),r.bufferData(r.UNIFORM_BUFFER,L,E),r.bindBuffer(r.UNIFORM_BUFFER,null),r.bindBufferBase(r.UNIFORM_BUFFER,z,N),N}function v(){for(let w=0;w<d;w++)if(f.indexOf(w)===-1)return f.push(w),w;return Oe("WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function g(w){const z=l[w.id],N=w.uniforms,L=w.__cache;r.bindBuffer(r.UNIFORM_BUFFER,z);for(let E=0,D=N.length;E<D;E++){const F=N[E];if(Array.isArray(F))for(let H=0,X=F.length;H<X;H++)x(F[H],E,H,L);else x(F,E,0,L)}r.bindBuffer(r.UNIFORM_BUFFER,null)}function x(w,z,N,L){if(A(w,z,N,L)===!0){const E=w.__offset,D=w.value;if(Array.isArray(D)){let F=0;for(let H=0;H<D.length;H++){const X=D[H],ct=S(X);b(X,w.__data,F),typeof X!="number"&&typeof X!="boolean"&&!X.isMatrix3&&!ArrayBuffer.isView(X)&&(F+=ct.storage/Float32Array.BYTES_PER_ELEMENT)}}else b(D,w.__data,0);r.bufferSubData(r.UNIFORM_BUFFER,E,w.__data)}}function b(w,z,N){typeof w=="number"||typeof w=="boolean"?z[0]=w:w.isMatrix3?(z[0]=w.elements[0],z[1]=w.elements[1],z[2]=w.elements[2],z[3]=0,z[4]=w.elements[3],z[5]=w.elements[4],z[6]=w.elements[5],z[7]=0,z[8]=w.elements[6],z[9]=w.elements[7],z[10]=w.elements[8],z[11]=0):ArrayBuffer.isView(w)?z.set(new w.constructor(w.buffer,w.byteOffset,z.length)):w.toArray(z,N)}function A(w,z,N,L){const E=w.value,D=z+"_"+N;if(L[D]===void 0)return typeof E=="number"||typeof E=="boolean"?L[D]=E:ArrayBuffer.isView(E)?L[D]=E.slice():L[D]=E.clone(),!0;{const F=L[D];if(typeof E=="number"||typeof E=="boolean"){if(F!==E)return L[D]=E,!0}else{if(ArrayBuffer.isView(E))return!0;if(F.equals(E)===!1)return F.copy(E),!0}}return!1}function M(w){const z=w.uniforms;let N=0;const L=16;for(let D=0,F=z.length;D<F;D++){const H=Array.isArray(z[D])?z[D]:[z[D]];for(let X=0,ct=H.length;X<ct;X++){const ut=H[X],Z=Array.isArray(ut.value)?ut.value:[ut.value];for(let P=0,k=Z.length;P<k;P++){const tt=Z[P],_t=S(tt),Et=N%L,B=Et%_t.boundary,J=Et+B;N+=B,J!==0&&L-J<_t.storage&&(N+=L-J),ut.__data=new Float32Array(_t.storage/Float32Array.BYTES_PER_ELEMENT),ut.__offset=N,N+=_t.storage}}}const E=N%L;return E>0&&(N+=L-E),w.__size=N,w.__cache={},this}function S(w){const z={boundary:0,storage:0};return typeof w=="number"||typeof w=="boolean"?(z.boundary=4,z.storage=4):w.isVector2?(z.boundary=8,z.storage=8):w.isVector3||w.isColor?(z.boundary=16,z.storage=12):w.isVector4?(z.boundary=16,z.storage=16):w.isMatrix3?(z.boundary=48,z.storage=48):w.isMatrix4?(z.boundary=64,z.storage=64):w.isTexture?ue("WebGLRenderer: Texture samplers can not be part of an uniforms group."):ArrayBuffer.isView(w)?(z.boundary=16,z.storage=w.byteLength):ue("WebGLRenderer: Unsupported uniform value type.",w),z}function O(w){const z=w.target;z.removeEventListener("dispose",O);const N=f.indexOf(z.__bindingPointIndex);f.splice(N,1),r.deleteBuffer(l[z.id]),delete l[z.id],delete c[z.id]}function U(){for(const w in l)r.deleteBuffer(l[w]);f=[],l={},c={}}return{bind:m,update:p,dispose:U}}const n3=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]);let $i=null;function i3(){return $i===null&&($i=new dx(n3,16,16,js,za),$i.name="DFG_LUT",$i.minFilter=Kn,$i.magFilter=Kn,$i.wrapS=La,$i.wrapT=La,$i.generateMipmaps=!1,$i.needsUpdate=!0),$i}class a3{constructor(t={}){const{canvas:i=GM(),context:s=null,depth:l=!0,stencil:c=!1,alpha:f=!1,antialias:d=!1,premultipliedAlpha:m=!0,preserveDrawingBuffer:p=!1,powerPreference:_="default",failIfMajorPerformanceCaveat:v=!1,reversedDepthBuffer:g=!1,outputBufferType:x=Ei}=t;this.isWebGLRenderer=!0;let b;if(s!==null){if(typeof WebGLRenderingContext<"u"&&s instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");b=s.getContextAttributes().alpha}else b=f;const A=x,M=new Set([Sp,xp,vp]),S=new Set([Ei,sa,vl,xl,mp,gp]),O=new Uint32Array(4),U=new Int32Array(4),w=new V;let z=null,N=null;const L=[],E=[];let D=null;this.domElement=i,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=ia,this.toneMappingExposure=1,this.transmissionResolutionScale=1;const F=this;let H=!1,X=null,ct=null,ut=null,Z=null;this._outputColorSpace=ei;let P=0,k=0,tt=null,_t=-1,Et=null;const B=new gn,J=new gn;let bt=null;const Rt=new Re(0);let Ut=0,et=i.width,yt=i.height,Q=1,gt=null,zt=null;const At=new gn(0,0,et,yt),oe=new gn(0,0,et,yt);let Xt=!1;const fe=new Ap;let ve=!1,ge=!1;const Xe=new Ve,rn=new V,tn=new gn,mn={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};let Fe=!1;function un(){return tt===null?Q:1}let Y=s;function Me(R,K){return i.getContext(R,K)}try{const R={alpha:!0,depth:l,stencil:c,antialias:d,premultipliedAlpha:m,preserveDrawingBuffer:p,powerPreference:_,failIfMajorPerformanceCaveat:v};if("setAttribute"in i&&i.setAttribute("data-engine",`three.js r${hp}`),i.addEventListener("webglcontextlost",ht,!1),i.addEventListener("webglcontextrestored",wt,!1),i.addEventListener("webglcontextcreationerror",he,!1),Y===null){const K="webgl2";if(Y=Me(K,R),Y===null)throw Me(K)?new Error("THREE.WebGLRenderer: Error creating WebGL context with your selected attributes."):new Error("THREE.WebGLRenderer: Error creating WebGL context.")}}catch(R){throw Oe("WebGLRenderer: "+R.message),R}let Le,I,T,j,rt,pt,Dt,Ot,ft,mt,Lt,kt,It,Bt,Yt,te,le,q,Nt,vt,Pt,Ht,Tt;function jt(){Le=new iA(Y),Le.init(),Pt=new Z2(Y,Le),I=new KT(Y,Le,t,Pt),T=new q2(Y,Le),I.reversedDepthBuffer&&g&&T.buffers.depth.setReversed(!0),ct=Y.createFramebuffer(),ut=Y.createFramebuffer(),Z=Y.createFramebuffer(),j=new rA(Y),rt=new N2,pt=new Y2(Y,Le,T,rt,I,Pt,j),Dt=new nA(F),Ot=new ub(Y),Ht=new YT(Y,Ot),ft=new aA(Y,Ot,j,Ht),mt=new lA(Y,ft,Ot,Ht,j),q=new oA(Y,I,pt),Yt=new JT(rt),Lt=new U2(F,Dt,Le,I,Ht,Yt),kt=new t3(F,rt),It=new O2,Bt=new H2(Le),le=new qT(F,Dt,T,mt,b,m),te=new W2(F,mt,I),Tt=new e3(Y,j,I,T),Nt=new ZT(Y,Le,j),vt=new sA(Y,Le,j),j.programs=Lt.programs,F.capabilities=I,F.extensions=Le,F.properties=rt,F.renderLists=It,F.shadowMap=te,F.state=T,F.info=j}jt(),A!==Ei&&(D=new uA(A,i.width,i.height,d,l,c));const qt=new j2(F,Y);this.xr=qt,this.getContext=function(){return Y},this.getContextAttributes=function(){return Y.getContextAttributes()},this.forceContextLoss=function(){const R=Le.get("WEBGL_lose_context");R&&R.loseContext()},this.forceContextRestore=function(){const R=Le.get("WEBGL_lose_context");R&&R.restoreContext()},this.getPixelRatio=function(){return Q},this.setPixelRatio=function(R){R!==void 0&&(Q=R,this.setSize(et,yt,!1))},this.getSize=function(R){return R.set(et,yt)},this.setSize=function(R,K,ot=!0){if(qt.isPresenting){ue("WebGLRenderer: Can't change size while VR device is presenting.");return}et=R,yt=K,i.width=Math.floor(R*Q),i.height=Math.floor(K*Q),ot===!0&&(i.style.width=R+"px",i.style.height=K+"px"),D!==null&&D.setSize(i.width,i.height),this.setViewport(0,0,R,K)},this.getDrawingBufferSize=function(R){return R.set(et*Q,yt*Q).floor()},this.setDrawingBufferSize=function(R,K,ot){et=R,yt=K,Q=ot,i.width=Math.floor(R*ot),i.height=Math.floor(K*ot),this.setViewport(0,0,R,K)},this.setEffects=function(R){if(A===Ei){Oe("WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.");return}if(R){for(let K=0;K<R.length;K++)if(R[K].isOutputPass===!0){ue("WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.");break}}D.setEffects(R||[])},this.getCurrentViewport=function(R){return R.copy(B)},this.getViewport=function(R){return R.copy(At)},this.setViewport=function(R,K,ot,at){R.isVector4?At.set(R.x,R.y,R.z,R.w):At.set(R,K,ot,at),T.viewport(B.copy(At).multiplyScalar(Q).round())},this.getScissor=function(R){return R.copy(oe)},this.setScissor=function(R,K,ot,at){R.isVector4?oe.set(R.x,R.y,R.z,R.w):oe.set(R,K,ot,at),T.scissor(J.copy(oe).multiplyScalar(Q).round())},this.getScissorTest=function(){return Xt},this.setScissorTest=function(R){T.setScissorTest(Xt=R)},this.setOpaqueSort=function(R){gt=R},this.setTransparentSort=function(R){zt=R},this.getClearColor=function(R){return R.copy(le.getClearColor())},this.setClearColor=function(){le.setClearColor(...arguments)},this.getClearAlpha=function(){return le.getClearAlpha()},this.setClearAlpha=function(){le.setClearAlpha(...arguments)},this.clear=function(R=!0,K=!0,ot=!0){let at=0;if(R){let st=!1;if(tt!==null){const Gt=tt.texture.format;st=M.has(Gt)}if(st){const Gt=tt.texture.type,Zt=S.has(Gt),Ft=le.getClearColor(),Jt=le.getClearAlpha(),Kt=Ft.r,se=Ft.g,xe=Ft.b;Zt?(O[0]=Kt,O[1]=se,O[2]=xe,O[3]=Jt,Y.clearBufferuiv(Y.COLOR,0,O)):(U[0]=Kt,U[1]=se,U[2]=xe,U[3]=Jt,Y.clearBufferiv(Y.COLOR,0,U))}else at|=Y.COLOR_BUFFER_BIT}K&&(at|=Y.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),ot&&(at|=Y.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),at!==0&&Y.clear(at)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(R){R.setRenderer(this),X=R},this.dispose=function(){i.removeEventListener("webglcontextlost",ht,!1),i.removeEventListener("webglcontextrestored",wt,!1),i.removeEventListener("webglcontextcreationerror",he,!1),le.dispose(),It.dispose(),Bt.dispose(),rt.dispose(),Dt.dispose(),mt.dispose(),Ht.dispose(),Tt.dispose(),Lt.dispose(),qt.dispose(),qt.removeEventListener("sessionstart",fn),qt.removeEventListener("sessionend",_n),en.stop()};function ht(R){R.preventDefault(),z_("WebGLRenderer: Context Lost."),H=!0}function wt(){z_("WebGLRenderer: Context Restored."),H=!1;const R=j.autoReset,K=te.enabled,ot=te.autoUpdate,at=te.needsUpdate,st=te.type;jt(),j.autoReset=R,te.enabled=K,te.autoUpdate=ot,te.needsUpdate=at,te.type=st}function he(R){Oe("WebGLRenderer: A WebGL context could not be created. Reason: ",R.statusMessage)}function ee(R){const K=R.target;K.removeEventListener("dispose",ee),de(K)}function de(R){Pe(R),rt.remove(R)}function Pe(R){const K=rt.get(R).programs;K!==void 0&&(K.forEach(function(ot){Lt.releaseProgram(ot)}),R.isShaderMaterial&&Lt.releaseShaderCache(R))}this.renderBufferDirect=function(R,K,ot,at,st,Gt){K===null&&(K=mn);const Zt=st.isMesh&&st.matrixWorld.determinantAffine()<0,Ft=Ha(R,K,ot,at,st);T.setMaterial(at,Zt);let Jt=ot.index,Kt=1;if(at.wireframe===!0){if(Jt=ft.getWireframeAttribute(ot),Jt===void 0)return;Kt=2}const se=ot.drawRange,xe=ot.attributes.position;let ne=se.start*Kt,ze=(se.start+se.count)*Kt;Gt!==null&&(ne=Math.max(ne,Gt.start*Kt),ze=Math.min(ze,(Gt.start+Gt.count)*Kt)),Jt!==null?(ne=Math.max(ne,0),ze=Math.min(ze,Jt.count)):xe!=null&&(ne=Math.max(ne,0),ze=Math.min(ze,xe.count));const hn=ze-ne;if(hn<0||hn===1/0)return;Ht.setup(st,at,Ft,ot,Jt);let an,We=Nt;if(Jt!==null&&(an=Ot.get(Jt),We=vt,We.setIndex(an)),st.isMesh)at.wireframe===!0?(T.setLineWidth(at.wireframeLinewidth*un()),We.setMode(Y.LINES)):We.setMode(Y.TRIANGLES);else if(st.isLine){let qe=at.linewidth;qe===void 0&&(qe=1),T.setLineWidth(qe*un()),st.isLineSegments?We.setMode(Y.LINES):st.isLineLoop?We.setMode(Y.LINE_LOOP):We.setMode(Y.LINE_STRIP)}else st.isPoints?We.setMode(Y.POINTS):st.isSprite&&We.setMode(Y.TRIANGLES);if(st.isBatchedMesh)if(Le.get("WEBGL_multi_draw"))We.renderMultiDraw(st._multiDrawStarts,st._multiDrawCounts,st._multiDrawCount);else{const qe=st._multiDrawStarts,Wt=st._multiDrawCounts,Xn=st._multiDrawCount,Te=Jt?Ot.get(Jt).bytesPerElement:1,Un=rt.get(at).currentProgram.getUniforms();for(let fi=0;fi<Xn;fi++)Un.setValue(Y,"_gl_DrawID",fi),We.render(qe[fi]/Te,Wt[fi])}else if(st.isInstancedMesh)We.renderInstances(ne,hn,st.count);else if(ot.isInstancedBufferGeometry){const qe=ot._maxInstanceCount!==void 0?ot._maxInstanceCount:1/0,Wt=Math.min(ot.instanceCount,qe);We.renderInstances(ne,hn,Wt)}else We.render(ne,hn)};function Sn(R,K,ot){R.transparent===!0&&R.side===Na&&R.forceSinglePass===!1?(R.side=ni,R.needsUpdate=!0,Fa(R,K,ot),R.side=xs,R.needsUpdate=!0,Fa(R,K,ot),R.side=Na):Fa(R,K,ot)}this.compile=function(R,K,ot=null){ot===null&&(ot=R),N=Bt.get(ot),N.init(K),E.push(N),ot.traverseVisible(function(st){st.isLight&&st.layers.test(K.layers)&&(N.pushLight(st),st.castShadow&&N.pushShadow(st))}),R!==ot&&R.traverseVisible(function(st){st.isLight&&st.layers.test(K.layers)&&(N.pushLight(st),st.castShadow&&N.pushShadow(st))}),N.setupLights();const at=new Set;return R.traverse(function(st){if(!(st.isMesh||st.isPoints||st.isLine||st.isSprite))return;const Gt=st.material;if(Gt)if(Array.isArray(Gt))for(let Zt=0;Zt<Gt.length;Zt++){const Ft=Gt[Zt];Sn(Ft,ot,st),at.add(Ft)}else Sn(Gt,ot,st),at.add(Gt)}),N=E.pop(),at},this.compileAsync=function(R,K,ot=null){const at=this.compile(R,K,ot);return new Promise(st=>{function Gt(){if(at.forEach(function(Zt){rt.get(Zt).currentProgram.isReady()&&at.delete(Zt)}),at.size===0){st(R);return}setTimeout(Gt,10)}Le.get("KHR_parallel_shader_compile")!==null?Gt():setTimeout(Gt,10)})};let Dn=null;function Jn(R){Dn&&Dn(R)}function fn(){en.stop()}function _n(){en.start()}const en=new yx;en.setAnimationLoop(Jn),typeof self<"u"&&en.setContext(self),this.setAnimationLoop=function(R){Dn=R,qt.setAnimationLoop(R),R===null?en.stop():en.start()},qt.addEventListener("sessionstart",fn),qt.addEventListener("sessionend",_n),this.render=function(R,K){if(K!==void 0&&K.isCamera!==!0){Oe("WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(H===!0)return;X!==null&&X.renderStart(R,K);const ot=qt.enabled===!0&&qt.isPresenting===!0,at=D!==null&&(tt===null||ot)&&D.begin(F,tt);if(R.matrixWorldAutoUpdate===!0&&R.updateMatrixWorld(),K.parent===null&&K.matrixWorldAutoUpdate===!0&&K.updateMatrixWorld(),qt.enabled===!0&&qt.isPresenting===!0&&(D===null||D.isCompositing()===!1)&&(qt.cameraAutoUpdate===!0&&qt.updateCamera(K),K=qt.getCamera()),R.isScene===!0&&R.onBeforeRender(F,R,K,tt),N=Bt.get(R,E.length),N.init(K),N.state.textureUnits=pt.getTextureUnits(),E.push(N),Xe.multiplyMatrices(K.projectionMatrix,K.matrixWorldInverse),fe.setFromProjectionMatrix(Xe,ea,K.reversedDepth),ge=this.localClippingEnabled,ve=Yt.init(this.clippingPlanes,ge),z=It.get(R,L.length),z.init(),L.push(z),qt.enabled===!0&&qt.isPresenting===!0){const Zt=F.xr.getDepthSensingMesh();Zt!==null&&Qn(Zt,K,-1/0,F.sortObjects)}Qn(R,K,0,F.sortObjects),z.finish(),F.sortObjects===!0&&z.sort(gt,zt,K.reversedDepth),Fe=qt.enabled===!1||qt.isPresenting===!1||qt.hasDepthSensing()===!1,Fe&&le.addToRenderList(z,R),this.info.render.frame++,this.info.autoReset===!0&&this.info.reset(),ve===!0&&Yt.beginShadows();const st=N.state.shadowsArray;if(te.render(st,R,K),ve===!0&&Yt.endShadows(),(at&&D.hasRenderPass())===!1){const Zt=z.opaque,Ft=z.transmissive;if(N.setupLights(),K.isArrayCamera){const Jt=K.cameras;if(Ft.length>0)for(let Kt=0,se=Jt.length;Kt<se;Kt++){const xe=Jt[Kt];nn(Zt,Ft,R,xe)}Fe&&le.render(R);for(let Kt=0,se=Jt.length;Kt<se;Kt++){const xe=Jt[Kt];oa(z,R,xe,xe.viewport)}}else Ft.length>0&&nn(Zt,Ft,R,K),Fe&&le.render(R),oa(z,R,K)}tt!==null&&k===0&&(pt.updateMultisampleRenderTarget(tt),pt.updateRenderTargetMipmap(tt)),at&&D.end(F),R.isScene===!0&&R.onAfterRender(F,R,K),Ht.resetDefaultState(),_t=-1,Et=null,E.pop(),E.length>0?(N=E[E.length-1],pt.setTextureUnits(N.state.textureUnits),ve===!0&&Yt.setGlobalState(F.clippingPlanes,N.state.camera)):N=null,L.pop(),L.length>0?z=L[L.length-1]:z=null,X!==null&&X.renderEnd()};function Qn(R,K,ot,at){if(R.visible===!1)return;if(R.layers.test(K.layers)){if(R.isGroup)ot=R.renderOrder;else if(R.isLOD)R.autoUpdate===!0&&R.update(K);else if(R.isLightProbeGrid)N.pushLightProbeGrid(R);else if(R.isLight)N.pushLight(R),R.castShadow&&N.pushShadow(R);else if(R.isSprite){if(!R.frustumCulled||fe.intersectsSprite(R)){at&&tn.setFromMatrixPosition(R.matrixWorld).applyMatrix4(Xe);const Zt=mt.update(R),Ft=R.material;Ft.visible&&z.push(R,Zt,Ft,ot,tn.z,null)}}else if((R.isMesh||R.isLine||R.isPoints)&&(!R.frustumCulled||fe.intersectsObject(R))){const Zt=mt.update(R),Ft=R.material;if(at&&(R.boundingSphere!==void 0?(R.boundingSphere===null&&R.computeBoundingSphere(),tn.copy(R.boundingSphere.center)):(Zt.boundingSphere===null&&Zt.computeBoundingSphere(),tn.copy(Zt.boundingSphere.center)),tn.applyMatrix4(R.matrixWorld).applyMatrix4(Xe)),Array.isArray(Ft)){const Jt=Zt.groups;for(let Kt=0,se=Jt.length;Kt<se;Kt++){const xe=Jt[Kt],ne=Ft[xe.materialIndex];ne&&ne.visible&&z.push(R,Zt,ne,ot,tn.z,xe)}}else Ft.visible&&z.push(R,Zt,Ft,ot,tn.z,null)}}const Gt=R.children;for(let Zt=0,Ft=Gt.length;Zt<Ft;Zt++)Qn(Gt[Zt],K,ot,at)}function oa(R,K,ot,at){const{opaque:st,transmissive:Gt,transparent:Zt}=R;N.setupLightsView(ot),ve===!0&&Yt.setGlobalState(F.clippingPlanes,ot),at&&T.viewport(B.copy(at)),st.length>0&&ii(st,K,ot),Gt.length>0&&ii(Gt,K,ot),Zt.length>0&&ii(Zt,K,ot),T.buffers.depth.setTest(!0),T.buffers.depth.setMask(!0),T.buffers.color.setMask(!0),T.setPolygonOffset(!1)}function nn(R,K,ot,at){if((ot.isScene===!0?ot.overrideMaterial:null)!==null)return;if(N.state.transmissionRenderTarget[at.id]===void 0){const ne=Le.has("EXT_color_buffer_half_float")||Le.has("EXT_color_buffer_float");N.state.transmissionRenderTarget[at.id]=new aa(1,1,{generateMipmaps:!0,type:ne?za:Ei,minFilter:qs,samples:Math.max(4,I.samples),stencilBuffer:c,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:Ne.workingColorSpace})}const Gt=N.state.transmissionRenderTarget[at.id],Zt=at.viewport||B;Gt.setSize(Zt.z*F.transmissionResolutionScale,Zt.w*F.transmissionResolutionScale);const Ft=F.getRenderTarget(),Jt=F.getActiveCubeFace(),Kt=F.getActiveMipmapLevel();F.setRenderTarget(Gt),F.getClearColor(Rt),Ut=F.getClearAlpha(),Ut<1&&F.setClearColor(16777215,.5),F.clear(),Fe&&le.render(ot);const se=F.toneMapping;F.toneMapping=ia;const xe=at.viewport;if(at.viewport!==void 0&&(at.viewport=void 0),N.setupLightsView(at),ve===!0&&Yt.setGlobalState(F.clippingPlanes,at),ii(R,ot,at),pt.updateMultisampleRenderTarget(Gt),pt.updateRenderTargetMipmap(Gt),Le.has("WEBGL_multisampled_render_to_texture")===!1){let ne=!1;for(let ze=0,hn=K.length;ze<hn;ze++){const an=K[ze],{object:We,geometry:qe,material:Wt,group:Xn}=an;if(Wt.side===Na&&We.layers.test(at.layers)){const Te=Wt.side;Wt.side=ni,Wt.needsUpdate=!0,Ai(We,ot,at,qe,Wt,Xn),Wt.side=Te,Wt.needsUpdate=!0,ne=!0}}ne===!0&&(pt.updateMultisampleRenderTarget(Gt),pt.updateRenderTargetMipmap(Gt))}F.setRenderTarget(Ft,Jt,Kt),F.setClearColor(Rt,Ut),xe!==void 0&&(at.viewport=xe),F.toneMapping=se}function ii(R,K,ot){const at=K.isScene===!0?K.overrideMaterial:null;for(let st=0,Gt=R.length;st<Gt;st++){const Zt=R[st],{object:Ft,geometry:Jt,group:Kt}=Zt;let se=Zt.material;se.allowOverride===!0&&at!==null&&(se=at),Ft.layers.test(ot.layers)&&Ai(Ft,K,ot,Jt,se,Kt)}}function Ai(R,K,ot,at,st,Gt){R.onBeforeRender(F,K,ot,at,st,Gt),R.modelViewMatrix.multiplyMatrices(ot.matrixWorldInverse,R.matrixWorld),R.normalMatrix.getNormalMatrix(R.modelViewMatrix),st.onBeforeRender(F,K,ot,at,R,Gt),st.transparent===!0&&st.side===Na&&st.forceSinglePass===!1?(st.side=ni,st.needsUpdate=!0,F.renderBufferDirect(ot,K,at,st,R,Gt),st.side=xs,st.needsUpdate=!0,F.renderBufferDirect(ot,K,at,st,R,Gt),st.side=Na):F.renderBufferDirect(ot,K,at,st,R,Gt),R.onAfterRender(F,K,ot,at,st,Gt)}function Fa(R,K,ot){K.isScene!==!0&&(K=mn);const at=rt.get(R),st=N.state.lights,Gt=N.state.shadowsArray,Zt=st.state.version,Ft=Lt.getParameters(R,st.state,Gt,K,ot,N.state.lightProbeGridArray),Jt=Lt.getProgramCacheKey(Ft);let Kt=at.programs;at.environment=R.isMeshStandardMaterial||R.isMeshLambertMaterial||R.isMeshPhongMaterial?K.environment:null,at.fog=K.fog;const se=R.isMeshStandardMaterial||R.isMeshLambertMaterial&&!R.envMap||R.isMeshPhongMaterial&&!R.envMap;at.envMap=Dt.get(R.envMap||at.environment,se),at.envMapRotation=at.environment!==null&&R.envMap===null?K.environmentRotation:R.envMapRotation,Kt===void 0&&(R.addEventListener("dispose",ee),Kt=new Map,at.programs=Kt);let xe=Kt.get(Jt);if(xe!==void 0){if(at.currentProgram===xe&&at.lightsStateVersion===Zt)return ca(R,Ft),xe}else Ft.uniforms=Lt.getUniforms(R),X!==null&&R.isNodeMaterial&&X.build(R,ot,Ft),R.onBeforeCompile(Ft,F),xe=Lt.acquireProgram(Ft,Jt),Kt.set(Jt,xe),at.uniforms=Ft.uniforms;const ne=at.uniforms;return(!R.isShaderMaterial&&!R.isRawShaderMaterial||R.clipping===!0)&&(ne.clippingPlanes=Yt.uniform),ca(R,Ft),at.needsLights=bl(R),at.lightsStateVersion=Zt,at.needsLights&&(ne.ambientLightColor.value=st.state.ambient,ne.lightProbe.value=st.state.probe,ne.directionalLights.value=st.state.directional,ne.directionalLightShadows.value=st.state.directionalShadow,ne.spotLights.value=st.state.spot,ne.spotLightShadows.value=st.state.spotShadow,ne.rectAreaLights.value=st.state.rectArea,ne.ltc_1.value=st.state.rectAreaLTC1,ne.ltc_2.value=st.state.rectAreaLTC2,ne.pointLights.value=st.state.point,ne.pointLightShadows.value=st.state.pointShadow,ne.hemisphereLights.value=st.state.hemi,ne.directionalShadowMatrix.value=st.state.directionalShadowMatrix,ne.spotLightMatrix.value=st.state.spotLightMatrix,ne.spotLightMap.value=st.state.spotLightMap,ne.pointShadowMatrix.value=st.state.pointShadowMatrix),at.lightProbeGrid=N.state.lightProbeGridArray.length>0,at.currentProgram=xe,at.uniformsList=null,xe}function la(R){if(R.uniformsList===null){const K=R.currentProgram.getUniforms();R.uniformsList=uu.seqWithValue(K.seq,R.uniforms)}return R.uniformsList}function ca(R,K){const ot=rt.get(R);ot.outputColorSpace=K.outputColorSpace,ot.batching=K.batching,ot.batchingColor=K.batchingColor,ot.instancing=K.instancing,ot.instancingColor=K.instancingColor,ot.instancingMorph=K.instancingMorph,ot.skinning=K.skinning,ot.morphTargets=K.morphTargets,ot.morphNormals=K.morphNormals,ot.morphColors=K.morphColors,ot.morphTargetsCount=K.morphTargetsCount,ot.numClippingPlanes=K.numClippingPlanes,ot.numIntersection=K.numClipIntersection,ot.vertexAlphas=K.vertexAlphas,ot.vertexTangents=K.vertexTangents,ot.toneMapping=K.toneMapping}function ys(R,K){if(R.length===0)return null;if(R.length===1)return R[0].texture!==null?R[0]:null;w.setFromMatrixPosition(K.matrixWorld);for(let ot=0,at=R.length;ot<at;ot++){const st=R[ot];if(st.texture!==null&&st.boundingBox.containsPoint(w))return st}return null}function Ha(R,K,ot,at,st){K.isScene!==!0&&(K=mn),pt.resetTextureUnits();const Gt=K.fog,Zt=at.isMeshStandardMaterial||at.isMeshLambertMaterial||at.isMeshPhongMaterial?K.environment:null,Ft=tt===null?F.outputColorSpace:tt.isXRRenderTarget===!0?tt.texture.colorSpace:Ne.workingColorSpace,Jt=at.isMeshStandardMaterial||at.isMeshLambertMaterial&&!at.envMap||at.isMeshPhongMaterial&&!at.envMap,Kt=Dt.get(at.envMap||Zt,Jt),se=at.vertexColors===!0&&!!ot.attributes.color&&ot.attributes.color.itemSize===4,xe=!!ot.attributes.tangent&&(!!at.normalMap||at.anisotropy>0),ne=!!ot.morphAttributes.position,ze=!!ot.morphAttributes.normal,hn=!!ot.morphAttributes.color;let an=ia;at.toneMapped&&(tt===null||tt.isXRRenderTarget===!0)&&(an=F.toneMapping);const We=ot.morphAttributes.position||ot.morphAttributes.normal||ot.morphAttributes.color,qe=We!==void 0?We.length:0,Wt=rt.get(at),Xn=N.state.lights;if(ve===!0&&(ge===!0||R!==Et)){const Ge=R===Et&&at.id===_t;Yt.setState(at,R,Ge)}let Te=!1;at.version===Wt.__version?(Wt.needsLights&&Wt.lightsStateVersion!==Xn.state.version||Wt.outputColorSpace!==Ft||st.isBatchedMesh&&Wt.batching===!1||!st.isBatchedMesh&&Wt.batching===!0||st.isBatchedMesh&&Wt.batchingColor===!0&&st.colorTexture===null||st.isBatchedMesh&&Wt.batchingColor===!1&&st.colorTexture!==null||st.isInstancedMesh&&Wt.instancing===!1||!st.isInstancedMesh&&Wt.instancing===!0||st.isSkinnedMesh&&Wt.skinning===!1||!st.isSkinnedMesh&&Wt.skinning===!0||st.isInstancedMesh&&Wt.instancingColor===!0&&st.instanceColor===null||st.isInstancedMesh&&Wt.instancingColor===!1&&st.instanceColor!==null||st.isInstancedMesh&&Wt.instancingMorph===!0&&st.morphTexture===null||st.isInstancedMesh&&Wt.instancingMorph===!1&&st.morphTexture!==null||Wt.envMap!==Kt||at.fog===!0&&Wt.fog!==Gt||Wt.numClippingPlanes!==void 0&&(Wt.numClippingPlanes!==Yt.numPlanes||Wt.numIntersection!==Yt.numIntersection)||Wt.vertexAlphas!==se||Wt.vertexTangents!==xe||Wt.morphTargets!==ne||Wt.morphNormals!==ze||Wt.morphColors!==hn||Wt.toneMapping!==an||Wt.morphTargetsCount!==qe||!!Wt.lightProbeGrid!=N.state.lightProbeGridArray.length>0)&&(Te=!0):(Te=!0,Wt.__version=at.version);let Un=Wt.currentProgram;Te===!0&&(Un=Fa(at,K,st),X&&at.isNodeMaterial&&X.onUpdateProgram(at,Un,Wt));let fi=!1,zi=!1,hi=!1;const Ye=Un.getUniforms(),dn=Wt.uniforms;if(T.useProgram(Un.program)&&(fi=!0,zi=!0,hi=!0),at.id!==_t&&(_t=at.id,zi=!0),Wt.needsLights){const Ge=ys(N.state.lightProbeGridArray,st);Wt.lightProbeGrid!==Ge&&(Wt.lightProbeGrid=Ge,zi=!0)}if(fi||Et!==R){T.buffers.depth.getReversed()&&R.reversedDepth!==!0&&(R._reversedDepth=!0,R.updateProjectionMatrix()),Ye.setValue(Y,"projectionMatrix",R.projectionMatrix),Ye.setValue(Y,"viewMatrix",R.matrixWorldInverse);const Yi=Ye.map.cameraPosition;Yi!==void 0&&Yi.setValue(Y,rn.setFromMatrixPosition(R.matrixWorld)),I.logarithmicDepthBuffer&&Ye.setValue(Y,"logDepthBufFC",2/(Math.log(R.far+1)/Math.LN2)),(at.isMeshPhongMaterial||at.isMeshToonMaterial||at.isMeshLambertMaterial||at.isMeshBasicMaterial||at.isMeshStandardMaterial||at.isShaderMaterial)&&Ye.setValue(Y,"isOrthographic",R.isOrthographicCamera===!0),Et!==R&&(Et=R,zi=!0,hi=!0)}if(Wt.needsLights&&(Xn.state.directionalShadowMap.length>0&&Ye.setValue(Y,"directionalShadowMap",Xn.state.directionalShadowMap,pt),Xn.state.spotShadowMap.length>0&&Ye.setValue(Y,"spotShadowMap",Xn.state.spotShadowMap,pt),Xn.state.pointShadowMap.length>0&&Ye.setValue(Y,"pointShadowMap",Xn.state.pointShadowMap,pt)),st.isSkinnedMesh){Ye.setOptional(Y,st,"bindMatrix"),Ye.setOptional(Y,st,"bindMatrixInverse");const Ge=st.skeleton;Ge&&(Ge.boneTexture===null&&Ge.computeBoneTexture(),Ye.setValue(Y,"boneTexture",Ge.boneTexture,pt))}st.isBatchedMesh&&(Ye.setOptional(Y,st,"batchingTexture"),Ye.setValue(Y,"batchingTexture",st._matricesTexture,pt),Ye.setOptional(Y,st,"batchingIdTexture"),Ye.setValue(Y,"batchingIdTexture",st._indirectTexture,pt),Ye.setOptional(Y,st,"batchingColorTexture"),st._colorsTexture!==null&&Ye.setValue(Y,"batchingColorTexture",st._colorsTexture,pt));const Bi=ot.morphAttributes;if((Bi.position!==void 0||Bi.normal!==void 0||Bi.color!==void 0)&&q.update(st,ot,Un),(zi||Wt.receiveShadow!==st.receiveShadow)&&(Wt.receiveShadow=st.receiveShadow,Ye.setValue(Y,"receiveShadow",st.receiveShadow)),(at.isMeshStandardMaterial||at.isMeshLambertMaterial||at.isMeshPhongMaterial)&&at.envMap===null&&K.environment!==null&&(dn.envMapIntensity.value=K.environmentIntensity),dn.dfgLUT!==void 0&&(dn.dfgLUT.value=i3()),zi){if(Ye.setValue(Y,"toneMappingExposure",F.toneMappingExposure),Wt.needsLights&&bn(dn,hi),Gt&&at.fog===!0&&kt.refreshFogUniforms(dn,Gt),kt.refreshMaterialUniforms(dn,at,Q,yt,N.state.transmissionRenderTarget[R.id]),Wt.needsLights&&Wt.lightProbeGrid){const Ge=Wt.lightProbeGrid;dn.probesSH.value=Ge.texture,dn.probesMin.value.copy(Ge.boundingBox.min),dn.probesMax.value.copy(Ge.boundingBox.max),dn.probesResolution.value.copy(Ge.resolution)}uu.upload(Y,la(Wt),dn,pt)}if(at.isShaderMaterial&&at.uniformsNeedUpdate===!0&&(uu.upload(Y,la(Wt),dn,pt),at.uniformsNeedUpdate=!1),at.isSpriteMaterial&&Ye.setValue(Y,"center",st.center),Ye.setValue(Y,"modelViewMatrix",st.modelViewMatrix),Ye.setValue(Y,"normalMatrix",st.normalMatrix),Ye.setValue(Y,"modelMatrix",st.matrixWorld),at.uniformsGroups!==void 0){const Ge=at.uniformsGroups;for(let Yi=0,Ga=Ge.length;Yi<Ga;Yi++){const Ms=Ge[Yi];Tt.update(Ms,Un),Tt.bind(Ms,Un)}}return Un}function bn(R,K){R.ambientLightColor.needsUpdate=K,R.lightProbe.needsUpdate=K,R.directionalLights.needsUpdate=K,R.directionalLightShadows.needsUpdate=K,R.pointLights.needsUpdate=K,R.pointLightShadows.needsUpdate=K,R.spotLights.needsUpdate=K,R.spotLightShadows.needsUpdate=K,R.rectAreaLights.needsUpdate=K,R.hemisphereLights.needsUpdate=K}function bl(R){return R.isMeshLambertMaterial||R.isMeshToonMaterial||R.isMeshPhongMaterial||R.isMeshStandardMaterial||R.isShadowMaterial||R.isShaderMaterial&&R.lights===!0}this.getActiveCubeFace=function(){return P},this.getActiveMipmapLevel=function(){return k},this.getRenderTarget=function(){return tt},this.setRenderTargetTextures=function(R,K,ot){const at=rt.get(R);at.__autoAllocateDepthBuffer=R.resolveDepthBuffer===!1,at.__autoAllocateDepthBuffer===!1&&(at.__useRenderToTexture=!1),rt.get(R.texture).__webglTexture=K,rt.get(R.depthTexture).__webglTexture=at.__autoAllocateDepthBuffer?void 0:ot,at.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(R,K){const ot=rt.get(R);ot.__webglFramebuffer=K,ot.__useDefaultFramebuffer=K===void 0},this.setRenderTarget=function(R,K=0,ot=0){tt=R,P=K,k=ot;let at=null,st=!1,Gt=!1;if(R){const Ft=rt.get(R);if(Ft.__useDefaultFramebuffer!==void 0){T.bindFramebuffer(Y.FRAMEBUFFER,Ft.__webglFramebuffer),B.copy(R.viewport),J.copy(R.scissor),bt=R.scissorTest,T.viewport(B),T.scissor(J),T.setScissorTest(bt),_t=-1;return}else if(Ft.__webglFramebuffer===void 0)pt.setupRenderTarget(R);else if(Ft.__hasExternalTextures)pt.rebindTextures(R,rt.get(R.texture).__webglTexture,rt.get(R.depthTexture).__webglTexture);else if(R.depthBuffer){const se=R.depthTexture;if(Ft.__boundDepthTexture!==se){if(se!==null&&rt.has(se)&&(R.width!==se.image.width||R.height!==se.image.height))throw new Error("THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.");pt.setupDepthRenderbuffer(R)}}const Jt=R.texture;(Jt.isData3DTexture||Jt.isDataArrayTexture||Jt.isCompressedArrayTexture)&&(Gt=!0);const Kt=rt.get(R).__webglFramebuffer;R.isWebGLCubeRenderTarget?(Array.isArray(Kt[K])?at=Kt[K][ot]:at=Kt[K],st=!0):R.samples>0&&pt.useMultisampledRTT(R)===!1?at=rt.get(R).__webglMultisampledFramebuffer:Array.isArray(Kt)?at=Kt[ot]:at=Kt,B.copy(R.viewport),J.copy(R.scissor),bt=R.scissorTest}else B.copy(At).multiplyScalar(Q).floor(),J.copy(oe).multiplyScalar(Q).floor(),bt=Xt;if(ot!==0&&(at=ct),T.bindFramebuffer(Y.FRAMEBUFFER,at)&&T.drawBuffers(R,at),T.viewport(B),T.scissor(J),T.setScissorTest(bt),st){const Ft=rt.get(R.texture);Y.framebufferTexture2D(Y.FRAMEBUFFER,Y.COLOR_ATTACHMENT0,Y.TEXTURE_CUBE_MAP_POSITIVE_X+K,Ft.__webglTexture,ot)}else if(Gt){const Ft=K;for(let Jt=0;Jt<R.textures.length;Jt++){const Kt=rt.get(R.textures[Jt]);Y.framebufferTextureLayer(Y.FRAMEBUFFER,Y.COLOR_ATTACHMENT0+Jt,Kt.__webglTexture,ot,Ft)}}else if(R!==null&&ot!==0){const Ft=rt.get(R.texture);Y.framebufferTexture2D(Y.FRAMEBUFFER,Y.COLOR_ATTACHMENT0,Y.TEXTURE_2D,Ft.__webglTexture,ot)}_t=-1},this.readRenderTargetPixels=function(R,K,ot,at,st,Gt,Zt,Ft=0){if(!(R&&R.isWebGLRenderTarget)){Oe("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let Jt=rt.get(R).__webglFramebuffer;if(R.isWebGLCubeRenderTarget&&Zt!==void 0&&(Jt=Jt[Zt]),Jt){T.bindFramebuffer(Y.FRAMEBUFFER,Jt);try{const Kt=R.textures[Ft],se=Kt.format,xe=Kt.type;if(R.textures.length>1&&Y.readBuffer(Y.COLOR_ATTACHMENT0+Ft),!I.textureFormatReadable(se)){Oe("WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!I.textureTypeReadable(xe)){Oe("WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}K>=0&&K<=R.width-at&&ot>=0&&ot<=R.height-st&&Y.readPixels(K,ot,at,st,Pt.convert(se),Pt.convert(xe),Gt)}finally{const Kt=tt!==null?rt.get(tt).__webglFramebuffer:null;T.bindFramebuffer(Y.FRAMEBUFFER,Kt)}}},this.readRenderTargetPixelsAsync=async function(R,K,ot,at,st,Gt,Zt,Ft=0){if(!(R&&R.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let Jt=rt.get(R).__webglFramebuffer;if(R.isWebGLCubeRenderTarget&&Zt!==void 0&&(Jt=Jt[Zt]),Jt)if(K>=0&&K<=R.width-at&&ot>=0&&ot<=R.height-st){T.bindFramebuffer(Y.FRAMEBUFFER,Jt);const Kt=R.textures[Ft],se=Kt.format,xe=Kt.type;if(R.textures.length>1&&Y.readBuffer(Y.COLOR_ATTACHMENT0+Ft),!I.textureFormatReadable(se))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!I.textureTypeReadable(xe))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");const ne=Y.createBuffer();Y.bindBuffer(Y.PIXEL_PACK_BUFFER,ne),Y.bufferData(Y.PIXEL_PACK_BUFFER,Gt.byteLength,Y.STREAM_READ),Y.readPixels(K,ot,at,st,Pt.convert(se),Pt.convert(xe),0);const ze=tt!==null?rt.get(tt).__webglFramebuffer:null;T.bindFramebuffer(Y.FRAMEBUFFER,ze);const hn=Y.fenceSync(Y.SYNC_GPU_COMMANDS_COMPLETE,0);return Y.flush(),await VM(Y,hn,4),Y.bindBuffer(Y.PIXEL_PACK_BUFFER,ne),Y.getBufferSubData(Y.PIXEL_PACK_BUFFER,0,Gt),Y.deleteBuffer(ne),Y.deleteSync(hn),Gt}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(R,K=null,ot=0){const at=Math.pow(2,-ot),st=Math.floor(R.image.width*at),Gt=Math.floor(R.image.height*at),Zt=K!==null?K.x:0,Ft=K!==null?K.y:0;pt.setTexture2D(R,0),Y.copyTexSubImage2D(Y.TEXTURE_2D,ot,0,0,Zt,Ft,st,Gt),T.unbindTexture()},this.copyTextureToTexture=function(R,K,ot=null,at=null,st=0,Gt=0){let Zt,Ft,Jt,Kt,se,xe,ne,ze,hn;const an=R.isCompressedTexture?R.mipmaps[Gt]:R.image;if(ot!==null)Zt=ot.max.x-ot.min.x,Ft=ot.max.y-ot.min.y,Jt=ot.isBox3?ot.max.z-ot.min.z:1,Kt=ot.min.x,se=ot.min.y,xe=ot.isBox3?ot.min.z:0;else{const dn=Math.pow(2,-st);Zt=Math.floor(an.width*dn),Ft=Math.floor(an.height*dn),R.isDataArrayTexture?Jt=an.depth:R.isData3DTexture?Jt=Math.floor(an.depth*dn):Jt=1,Kt=0,se=0,xe=0}at!==null?(ne=at.x,ze=at.y,hn=at.z):(ne=0,ze=0,hn=0);const We=Pt.convert(K.format),qe=Pt.convert(K.type);let Wt;K.isData3DTexture?(pt.setTexture3D(K,0),Wt=Y.TEXTURE_3D):K.isDataArrayTexture||K.isCompressedArrayTexture?(pt.setTexture2DArray(K,0),Wt=Y.TEXTURE_2D_ARRAY):(pt.setTexture2D(K,0),Wt=Y.TEXTURE_2D),T.activeTexture(Y.TEXTURE0),T.pixelStorei(Y.UNPACK_FLIP_Y_WEBGL,K.flipY),T.pixelStorei(Y.UNPACK_PREMULTIPLY_ALPHA_WEBGL,K.premultiplyAlpha),T.pixelStorei(Y.UNPACK_ALIGNMENT,K.unpackAlignment);const Xn=T.getParameter(Y.UNPACK_ROW_LENGTH),Te=T.getParameter(Y.UNPACK_IMAGE_HEIGHT),Un=T.getParameter(Y.UNPACK_SKIP_PIXELS),fi=T.getParameter(Y.UNPACK_SKIP_ROWS),zi=T.getParameter(Y.UNPACK_SKIP_IMAGES);T.pixelStorei(Y.UNPACK_ROW_LENGTH,an.width),T.pixelStorei(Y.UNPACK_IMAGE_HEIGHT,an.height),T.pixelStorei(Y.UNPACK_SKIP_PIXELS,Kt),T.pixelStorei(Y.UNPACK_SKIP_ROWS,se),T.pixelStorei(Y.UNPACK_SKIP_IMAGES,xe);const hi=R.isDataArrayTexture||R.isData3DTexture,Ye=K.isDataArrayTexture||K.isData3DTexture;if(R.isDepthTexture){const dn=rt.get(R),Bi=rt.get(K),Ge=rt.get(dn.__renderTarget),Yi=rt.get(Bi.__renderTarget);T.bindFramebuffer(Y.READ_FRAMEBUFFER,Ge.__webglFramebuffer),T.bindFramebuffer(Y.DRAW_FRAMEBUFFER,Yi.__webglFramebuffer);for(let Ga=0;Ga<Jt;Ga++)hi&&(Y.framebufferTextureLayer(Y.READ_FRAMEBUFFER,Y.COLOR_ATTACHMENT0,rt.get(R).__webglTexture,st,xe+Ga),Y.framebufferTextureLayer(Y.DRAW_FRAMEBUFFER,Y.COLOR_ATTACHMENT0,rt.get(K).__webglTexture,Gt,hn+Ga)),Y.blitFramebuffer(Kt,se,Zt,Ft,ne,ze,Zt,Ft,Y.DEPTH_BUFFER_BIT,Y.NEAREST);T.bindFramebuffer(Y.READ_FRAMEBUFFER,null),T.bindFramebuffer(Y.DRAW_FRAMEBUFFER,null)}else if(st!==0||R.isRenderTargetTexture||rt.has(R)){const dn=rt.get(R),Bi=rt.get(K);T.bindFramebuffer(Y.READ_FRAMEBUFFER,ut),T.bindFramebuffer(Y.DRAW_FRAMEBUFFER,Z);for(let Ge=0;Ge<Jt;Ge++)hi?Y.framebufferTextureLayer(Y.READ_FRAMEBUFFER,Y.COLOR_ATTACHMENT0,dn.__webglTexture,st,xe+Ge):Y.framebufferTexture2D(Y.READ_FRAMEBUFFER,Y.COLOR_ATTACHMENT0,Y.TEXTURE_2D,dn.__webglTexture,st),Ye?Y.framebufferTextureLayer(Y.DRAW_FRAMEBUFFER,Y.COLOR_ATTACHMENT0,Bi.__webglTexture,Gt,hn+Ge):Y.framebufferTexture2D(Y.DRAW_FRAMEBUFFER,Y.COLOR_ATTACHMENT0,Y.TEXTURE_2D,Bi.__webglTexture,Gt),st!==0?Y.blitFramebuffer(Kt,se,Zt,Ft,ne,ze,Zt,Ft,Y.COLOR_BUFFER_BIT,Y.NEAREST):Ye?Y.copyTexSubImage3D(Wt,Gt,ne,ze,hn+Ge,Kt,se,Zt,Ft):Y.copyTexSubImage2D(Wt,Gt,ne,ze,Kt,se,Zt,Ft);T.bindFramebuffer(Y.READ_FRAMEBUFFER,null),T.bindFramebuffer(Y.DRAW_FRAMEBUFFER,null)}else Ye?R.isDataTexture||R.isData3DTexture?Y.texSubImage3D(Wt,Gt,ne,ze,hn,Zt,Ft,Jt,We,qe,an.data):K.isCompressedArrayTexture?Y.compressedTexSubImage3D(Wt,Gt,ne,ze,hn,Zt,Ft,Jt,We,an.data):Y.texSubImage3D(Wt,Gt,ne,ze,hn,Zt,Ft,Jt,We,qe,an):R.isDataTexture?Y.texSubImage2D(Y.TEXTURE_2D,Gt,ne,ze,Zt,Ft,We,qe,an.data):R.isCompressedTexture?Y.compressedTexSubImage2D(Y.TEXTURE_2D,Gt,ne,ze,an.width,an.height,We,an.data):Y.texSubImage2D(Y.TEXTURE_2D,Gt,ne,ze,Zt,Ft,We,qe,an);T.pixelStorei(Y.UNPACK_ROW_LENGTH,Xn),T.pixelStorei(Y.UNPACK_IMAGE_HEIGHT,Te),T.pixelStorei(Y.UNPACK_SKIP_PIXELS,Un),T.pixelStorei(Y.UNPACK_SKIP_ROWS,fi),T.pixelStorei(Y.UNPACK_SKIP_IMAGES,zi),Gt===0&&K.generateMipmaps&&Y.generateMipmap(Wt),T.unbindTexture()},this.initRenderTarget=function(R){rt.get(R).__webglFramebuffer===void 0&&pt.setupRenderTarget(R)},this.initTexture=function(R){R.isCubeTexture?pt.setTextureCube(R,0):R.isData3DTexture?pt.setTexture3D(R,0):R.isDataArrayTexture||R.isCompressedArrayTexture?pt.setTexture2DArray(R,0):pt.setTexture2D(R,0),T.unbindTexture()},this.resetState=function(){P=0,k=0,tt=null,T.reset(),Ht.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return ea}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(t){this._outputColorSpace=t;const i=this.getContext();i.drawingBufferColorSpace=Ne._getDrawingBufferColorSpace(t),i.unpackColorSpace=Ne._getUnpackColorSpace()}}function s3(r,t,i,s,l,c){const f=l*l,d=f*l;return c.set(.5*(2*t.x+(-r.x+i.x)*l+(2*r.x-5*t.x+4*i.x-s.x)*f+(-r.x+3*t.x-3*i.x+s.x)*d),.5*(2*t.y+(-r.y+i.y)*l+(2*r.y-5*t.y+4*i.y-s.y)*f+(-r.y+3*t.y-3*i.y+s.y)*d),.5*(2*t.z+(-r.z+i.z)*l+(2*r.z-5*t.z+4*i.z-s.z)*f+(-r.z+3*t.z-3*i.z+s.z)*d)),c}function Cx(r,t=14){const i=[],s=r.length,l=new V;for(let c=0;c<s;c++){const f=r[(c-1+s)%s],d=r[c],m=r[(c+1)%s],p=r[(c+2)%s];for(let _=0;_<t;_++){const v=_/t;i.push(s3(f,d,m,p,v,l).clone())}}return i}function r3(){const r=[],t=(i,s,l)=>r.push(new V(i,s,l));return t(0,1.2,22),t(8,1.4,24),t(16,2.2,20),t(22,5.5,12),t(24,9.5,2),t(20,12.5,-8),t(10,8,-16),t(0,4.5,-20),t(-6,6,-18),t(-8,11,-14),t(-6,14,-10),t(-2,12,-8),t(0,7,-10),t(4,3.5,-14),t(12,2.8,-18),t(18,3.2,-12),t(20,6,-2),t(14,10,6),t(4,13,8),t(-6,14.5,4),t(-14,12,-2),t(-18,8,-8),t(-22,4,-4),t(-24,2.5,6),t(-18,2,16),t(-8,1.5,20),r}function o3(r,t,i,s){const l=r.clone().lerp(t,.5),c=t.clone().sub(r).normalize(),f=new V(-c.z,0,c.x).multiplyScalar(i==="A"?6:-6);l.add(f),l.y+=s+(i==="A"?1.2:2.4);const d=r.clone().lerp(l,.45);d.y+=s*.4;const m=l.clone().lerp(t,.45);return m.y+=s*.35,Cx([r,d,l,m,t],10)}function Iv(r,t){if(r.length<2)return r.slice();const i=[r[0].clone()];let s=0;for(let l=1;l<r.length;l++){const c=r[l-1],f=r[l];let d=c.distanceTo(f);if(d<1e-6)continue;const m=f.clone().sub(c).normalize();for(;s+d>=t;){const p=t-s;i.push(c.clone().addScaledVector(m,p)),c.addScaledVector(m,p),d-=p,s=0}s+=d}if(i.length>2){const l=i[0],c=i[i.length-1];l.distanceTo(c)>t*.4}return i}function Fv(r,t){const i=r.length;if(i<3)return[];const s=[];let l=0;const c=new V(0,1,0);let f=new V(1,0,0);for(let d=0;d<i;d++){const m=r[d],p=r[(d-1+i)%i],_=r[(d+1)%i],v=_.clone().sub(p).normalize();let g=new V().crossVectors(f,v).normalize();g.lengthSq()<1e-6&&(g=new V().crossVectors(c,v).normalize(),g.lengthSq()<1e-6&&g.set(1,0,0));const x=new V().crossVectors(v,g).normalize(),b=c.clone().sub(v.clone().multiplyScalar(c.dot(v))).normalize();b.lengthSq()>1e-4&&(g.lerp(b,.65).normalize(),x.crossVectors(v,g).normalize(),g.crossVectors(x,v).normalize()),f.copy(x);const A=m.clone().sub(p);(d>0||t)&&(l+=A.length());const M=m.clone().sub(p).normalize(),S=_.clone().sub(m).normalize(),O=Math.acos(Zs.clamp(M.dot(S),-1,1)),U=new V(v.x,0,v.z);let w=0;if(U.lengthSq()>1e-4){U.normalize();const z=Math.sign(new V().crossVectors(M,S).y||1e-4);w=Zs.clamp(O*1.8*z,-.9,.9)}s.push({position:m.clone(),tangent:v,normal:g,binormal:x,bank:w,height:m.y,curvature:O,s:l})}s[0].s=0;for(let d=1;d<s.length;d++)s[d].s=s[d-1].s+s[d].position.distanceTo(s[d-1].position);return s}function l3(){var p;const r=r3(),t=Iv(Cx(r,16),.55),i=Fv(t,!0),s=i[i.length-1].s,l=[{id:"meadow",enterS:s*.28,exitS:s*.38,choiceWindow:s*.06,labelA:"Willow Walk",labelB:"Buttercup Bypass"},{id:"ridge",enterS:s*.55,exitS:s*.66,choiceWindow:s*.06,labelA:"Skyline Swoop",labelB:"Pine Needle Plunge"},{id:"harbor",enterS:s*.8,exitS:s*.9,choiceWindow:s*.06,labelA:"Boardwalk Bloom",labelB:"Lighthouse Looplet"}],c={meadow:{A:[],B:[]},ridge:{A:[],B:[]},harbor:{A:[],B:[]}};for(const _ of l){const v=f(i,_.enterS),g=f(i,_.exitS);for(const x of["A","B"]){const b=Iv(o3(v.position,g.position,x,x==="A"?1.5:3),.45);b[0]=v.position.clone(),b[b.length-1]=g.position.clone();const A=Fv(b,!1),M=((p=A[A.length-1])==null?void 0:p.s)||1;for(const S of A)S.s=_.enterS+S.s/M*(_.exitS-_.enterS),S.junction=_.id,S.branch=x,S.bank*=x==="A"?.8:1.15;c[_.id][x]=A}}function f(_,v){const g=_[_.length-1].s;let x=(v%g+g)%g,b=0,A=_.length-1;for(;b<A-1;){const w=b+A>>1;_[w].s<=x?b=w:A=w}const M=_[b],S=_[A],O=Math.max(1e-6,S.s-M.s),U=Zs.clamp((x-M.s)/O,0,1);return{position:M.position.clone().lerp(S.position,U),tangent:M.tangent.clone().lerp(S.tangent,U).normalize(),normal:M.normal.clone().lerp(S.normal,U).normalize(),binormal:M.binormal.clone().lerp(S.binormal,U).normalize(),bank:Zs.lerp(M.bank,S.bank,U),height:Zs.lerp(M.height,S.height,U),curvature:Zs.lerp(M.curvature,S.curvature,U),s:x,junction:M.junction,branch:M.branch}}function d(_,v){const g=s,x=(_%g+g)%g;for(const b of l)if(x>=b.enterS&&x<=b.exitS){const A=v[b.id]||"A",M=c[b.id][A];if(M.length>1)return f(M,x)}return f(i,x)}function m(_){const v=(_%s+s)%s;for(const g of l){const x=g.enterS-g.choiceWindow;if(v>=x&&v<=g.enterS+(g.exitS-g.enterS)*.35)return g}return null}for(const _ of l)for(const v of i)v.s>=_.enterS&&v.s<=_.exitS&&(v.junction=_.id);return{samples:i,totalLength:s,junctions:l,getFrame:d,getNearJunction:m}}function Hv(r,t){return t.map(i=>r[i.id]==="B"?i.labelB:i.labelA).map(i=>i.split(" ")[0]).join(" · ")}const c3={};function u3(r){let t=r>>>0;return()=>{t=t+1831565813>>>0;let i=t;return i=Math.imul(i^i>>>15,i|1),i^=i+Math.imul(i^i>>>7,i|61),((i^i>>>14)>>>0)/4294967296}}function gl(r,t){const i=new nb,l=r.startsWith("/")?`${"/".replace(/\/?$/,"/")}${r.slice(1)}`:r,c=i.load(l,void 0,void 0,()=>{});return c.colorSpace=ei,c.wrapS=c.wrapT=fu,c.anisotropy=Math.min(8,t.capabilities.getMaxAnisotropy()),c}function f3(){const t=document.createElement("canvas");t.width=t.height=64;const i=t.getContext("2d"),s=i.createRadialGradient(64/2,64/2,0,64/2,64/2,64/2);s.addColorStop(0,"rgba(255,255,255,0.95)"),s.addColorStop(.35,"rgba(255,255,255,0.45)"),s.addColorStop(1,"rgba(255,255,255,0)"),i.fillStyle=s,i.fillRect(0,0,64,64);const l=new C1(t);return l.colorSpace=ei,l}function h3(){return f3()}function d3(r){const t=new na,i=[],s=new _e({color:r?13919568:14725248,roughness:.42,metalness:.12}),l=new _e({color:16774374,roughness:.55}),c=new _e({color:3813932,roughness:.75}),f=new _e({color:r?16773336:13924456,roughness:.45}),d=new ie(new cn(1.15,.55,.72),s);d.position.y=.42,d.castShadow=!0,t.add(d);const m=new ie(new cn(1.05,.08,.74),f);m.position.y=.42,t.add(m);const p=new ie(new cn(.55,.42,.62),l);p.position.set(r?-.12:.05,.78,0),p.castShadow=!0,t.add(p);const _=new _e({color:11066096,roughness:.15,metalness:.2,transparent:!0,opacity:.8});for(const A of[-.22,.22]){const M=new ie(new cn(.28,.22,.04),_);M.position.set(p.position.x,.82,A),t.add(M)}const v=new ie(new cn(.62,.08,.68),c);v.position.set(p.position.x,1.02,0),t.add(v);for(const A of[-.35,.35])for(const M of[-.38,.38]){const S=new ie(new ui(.14,.14,.1,12),c);S.rotation.x=Math.PI/2,S.position.set(A,.14,M),S.castShadow=!0,t.add(S),i.push(S)}if(r){const A=new ie(new ui(.18,.22,.5,10),s);A.rotation.z=Math.PI/2,A.position.set(.55,.48,0),t.add(A);const M=new ie(new ui(.1,.14,.32,8),c);M.position.set(.35,.85,0),M.name="funnel",t.add(M);const S=new ie(new Mi(.08,8,8),new _e({color:16769184,emissive:16755285,emissiveIntensity:.85,roughness:.3,metalness:.4}));S.position.set(.78,.5,0),S.name="headlamp",t.add(S);const O=new lp(16763e3,.55,8,2);O.position.set(1,.55,0),O.name="headLight",t.add(O)}else{const A=new ie(new cn(.18,.08,.08),c);A.position.set(-.62,.35,0),t.add(A)}const g=new ie(new cn(.3,.12,.5),l);g.position.set(.25,.55,0),t.add(g);const x=new _e({color:15780008,roughness:.7}),b=new ie(new Mi(.09,8,8),x);if(b.position.set(.2,.78,0),t.add(b),!r){const A=new ie(new Mi(.08,8,8),x);A.position.set(-.05,.76,.12),t.add(A);const M=new ie(new ui(.07,.08,.05,8),new _e({color:12871760,roughness:.7}));M.position.set(-.05,.86,.12),t.add(M)}return{group:t,wheels:i}}function p3(r=4){const t=new na,i=[],s=[];for(let l=0;l<r;l++){const c=d3(l===0);t.add(c.group),i.push(c.group),s.push(c.wheels)}return{group:t,carGroups:i,wheels:s}}function m3(r,t){const i=new na,s=gl("./textures/track.jpg",t);s.repeat.set(2,8);const l=new _e({map:s,color:15235176,roughness:.4,metalness:.35}),c=new _e({map:gl("./textures/wood.jpg",t),color:14463104,roughness:.85});c.map&&c.map.repeat.set(1,1);const f=r.samples,d=.32,m=[],p=[];for(const L of f)m.push(L.position.clone().addScaledVector(L.binormal,-d)),p.push(L.position.clone().addScaledVector(L.binormal,d));m.push(m[0].clone()),p.push(p[0].clone());const _=(L,E,D)=>{const F=new op(L,!0,"catmullrom",.2),H=new _u(F,Math.min(L.length*2,600),E,5,!0),X=new ie(H,D);return X.castShadow=!0,X.receiveShadow=!0,X};i.add(_(m,.065,l)),i.add(_(p,.065,l));const v=new cn(.78,.08,.16),g=Math.floor(f.length/2),x=new Ks(v,c,g);x.castShadow=!0;const b=new Cn;let A=0;for(let L=0;L<f.length&&A<g;L+=2){const E=f[L];b.position.copy(E.position).addScaledVector(E.normal,-.12);const D=new Ve().makeBasis(E.binormal,E.normal,E.tangent);b.quaternion.setFromRotationMatrix(D),b.scale.set(1,1,1),b.updateMatrix(),x.setMatrixAt(A++,b.matrix)}i.add(x);const M=[];for(let L=0;L<f.length;L+=6)f[L].position.y>=2.4&&M.push(f[L]);if(M.length){const L=new ui(.07,.1,1,6),E=new _e({color:10516560,roughness:.9}),D=new Ks(L,E,M.length);D.castShadow=!0;for(let F=0;F<M.length;F++){const H=M[F],X=Math.max(.5,H.position.y-.15);b.position.set(H.position.x,X*.5,H.position.z),b.quaternion.identity(),b.scale.set(1,X,1),b.updateMatrix(),D.setMatrixAt(F,b.matrix)}i.add(D)}const S=new _e({color:16763048,roughness:.35,metalness:.35,emissive:16746592,emissiveIntensity:.25}),O=new _e({color:13146248,roughness:.55,metalness:.15,transparent:!0,opacity:.45}),U={};for(const L of r.junctions){U[L.id]={};for(const E of["A","B"]){const D={meadow:"A",ridge:"A",harbor:"A"};D[L.id]=E;const F=[],H=20;for(let X=0;X<=H;X++){const ct=L.enterS+(L.exitS-L.enterS)*X/H;F.push(r.getFrame(ct,D).position.clone())}if(F.length>2){const X=new op(F,!1),ct=new _u(X,H*2,.05,5,!1),ut=new ie(ct,E==="A"?S:O);ut.castShadow=!0,i.add(ut),U[L.id][E]=ut}}}const w={meshes:U,setActive(L){for(const E of Object.keys(U)){const D=U[E];if(!(D!=null&&D.A)||!(D!=null&&D.B))continue;const F=L[E];D.A.material=F==="A"?S:O,D.B.material=F==="B"?S:O,D.A.scale.setScalar(F==="A"?1.15:.9),D.B.scale.setScalar(F==="B"?1.15:.9)}}},z=[];for(let L=0;L<f.length;L+=4){const E=f[L];if(!(E.position.y<6&&E.curvature<.25))for(const D of[-1,1])z.push({p:E.position.clone().addScaledVector(E.binormal,D*.55).addScaledVector(E.normal,.35),b:E.binormal,n:E.normal,t:E.tangent})}if(z.length){const L=new cn(.04,.28,.55),E=new _e({color:16773860,roughness:.5}),D=new Ks(L,E,z.length);for(let F=0;F<z.length;F++){const H=z[F];b.position.copy(H.p);const X=new Ve().makeBasis(H.b,H.n,H.t);b.quaternion.setFromRotationMatrix(X),b.scale.set(1,1,1),b.updateMatrix(),D.setMatrixAt(F,b.matrix)}i.add(D)}const N=new _e({color:16115400,roughness:.6});for(const L of r.junctions){const E=r.getFrame(L.enterS,{meadow:"A",ridge:"A",harbor:"A"}),D=new ie(new ui(.06,.08,1.4,6),N);D.position.copy(E.position).addScaledVector(E.binormal,1.1).addScaledVector(E.normal,.7),D.castShadow=!0,D.userData.junctionFlag=L.id,i.add(D);const F=new ie(new cn(.45,.28,.04),new _e({color:14708832,roughness:.55,emissive:12603456,emissiveIntensity:.15}));F.position.copy(D.position).add(new V(.22,.45,0)),F.userData.junctionFlag=L.id,i.add(F)}return{root:i,branches:w}}function g3(r){const t=new na,i=u3(20260805),s=new Cn,l=[],c=gl("./textures/grass.jpg",r);c.repeat.set(14,14);const f=new ie(new hl(78,48),new _e({map:c,color:12112e3,roughness:.92}));f.rotation.x=-Math.PI/2,f.receiveShadow=!0,t.add(f);const d=new ie(new Dp(9.5,11.2,48),new _e({color:13217929,roughness:.95}));d.rotation.x=-Math.PI/2,d.position.y=.02,d.position.z=18,t.add(d);const m=new _e({color:10798200,roughness:.9});for(const[Q,gt,zt,At]of[[-28,-18,14,4],[30,10,12,3.2],[-10,28,10,2.4],[22,-26,11,3.6],[-34,12,9,2.8]]){const oe=new ie(new Mi(zt,20,14,0,Math.PI*2,0,Math.PI/2),m);oe.position.set(Q,0,gt),oe.scale.y=At/zt,oe.receiveShadow=!0,t.add(oe)}const p=new ie(new hl(7,28),new _e({color:8306896,roughness:.12,metalness:.4}));p.rotation.x=-Math.PI/2,p.position.set(-16,.08,10),t.add(p);const _=new _e({color:6986328,roughness:.8});for(let Q=0;Q<6;Q++){const gt=Q/6*Math.PI*2+.3,zt=new ie(new hl(.45,8),_);zt.rotation.x=-Math.PI/2,zt.position.set(-16+Math.cos(gt)*3.2,.12,10+Math.sin(gt)*3.2),t.add(zt)}const v=gl("./textures/wood.jpg",r);v.repeat.set(2,2);const g=new _e({map:v,color:14729368,roughness:.85}),x=new ie(new cn(8,.35,3.2),g);x.position.set(0,.95,24),x.receiveShadow=!0,x.castShadow=!0,t.add(x);for(const Q of[-2.2,2.2]){const gt=new ie(new cn(1.4,.12,.45),g);gt.position.set(Q,1.25,25.2),gt.castShadow=!0,t.add(gt);const zt=new ie(new cn(1.4,.45,.08),g);zt.position.set(Q,1.5,25.4),t.add(zt)}const b=new ie(new cn(9,.15,4),new _e({color:12871760,roughness:.7}));b.position.set(0,3.3,24),t.add(b);for(const Q of[-3.5,3.5]){const gt=new ie(new ui(.1,.12,2.2,8),g);gt.position.set(Q,2.05,24),t.add(gt)}const A=new _e({color:15255672,roughness:.35,metalness:.5,emissive:16755285,emissiveIntensity:.55});for(const Q of[-3.2,3.2]){const gt=new ie(new Mi(.16,10,10),A);gt.position.set(Q,2.9,24),t.add(gt);const zt=new lp(16763e3,.85,14,1.8);zt.position.set(Q,2.7,24),t.add(zt)}const M=[16773340,16109748,15003868,16774620,15786224];for(let Q=0;Q<10;Q++){const gt=Q/10*Math.PI*2+.4,zt=30+Q%3*3.5,At=Math.cos(gt)*zt,oe=Math.sin(gt)*zt,Xt=new na,fe=new ie(new cn(2.2,1.4,2),new _e({color:M[Q%M.length],roughness:.8}));fe.position.y=.7,fe.castShadow=!0,Xt.add(fe);const ve=new ie(new dl(1.7,1.1,4),new _e({color:12085328,roughness:.75}));ve.position.y=1.9,ve.rotation.y=Math.PI/4,Xt.add(ve);const ge=new ie(new cn(.4,.7,.08),new _e({color:9067066,roughness:.8}));ge.position.set(0,.4,1.02),Xt.add(ge);const Xe=new ie(new cn(.35,.3,.06),new _e({color:16769184,emissive:16760944,emissiveIntensity:.4,roughness:.4}));Xe.position.set(.55,.75,1.02),Xt.add(Xe),Xt.position.set(At,0,oe),Xt.rotation.y=-gt+Math.PI,t.add(Xt)}const S=new _e({color:5917242,roughness:.7}),O=new _e({color:16769184,emissive:16760944,emissiveIntensity:.7,roughness:.4});for(let Q=0;Q<12;Q++){const gt=Q/12*Math.PI*2,zt=Math.cos(gt)*20,At=Math.sin(gt)*20+6,oe=new ie(new ui(.06,.08,2.4,6),S);oe.position.set(zt,1.2,At),oe.castShadow=!0,t.add(oe);const Xt=new ie(new Mi(.18,8,8),O);if(Xt.position.set(zt,2.5,At),t.add(Xt),Q%3===0){const fe=new lp(16765072,.4,12,2);fe.position.set(zt,2.4,At),t.add(fe)}}const U=new ui(.12,.18,1.1,6),w=new dl(.75,1.8,7),z=new _e({color:8017208,roughness:.9}),N=[new _e({color:6990424,roughness:.85}),new _e({color:8043104,roughness:.85}),new _e({color:10140240,roughness:.85})],L=78,E=new Ks(U,z,L),D=N.map(Q=>new Ks(w,Q,Math.ceil(L/3)+2)),F=[0,0,0];E.castShadow=!0;for(const Q of D)Q.castShadow=!0;let H=0,X=0;for(;H<L&&X<3e3;){X++;const Q=(i()-.5)*118,gt=(i()-.5)*118,zt=Math.hypot(Q,gt);if(zt<15||zt>54||Math.hypot(Q+16,gt-10)<9)continue;const At=.75+i()*.85;s.position.set(Q,.55*At,gt),s.scale.setScalar(At),s.rotation.y=i()*Math.PI*2,s.updateMatrix(),E.setMatrixAt(H,s.matrix);const oe=H%3;s.position.y=1.4*At,s.updateMatrix(),D[oe].setMatrixAt(F[oe],s.matrix),F[oe]++,H++}t.add(E);for(let Q=0;Q<D.length;Q++)D[Q].count=F[Q],t.add(D[Q]);const ct=[15771832,15782016,13672672,15790320,14708848];for(let Q=0;Q<ct.length;Q++){const gt=new _e({color:ct[Q],roughness:.7}),zt=new Mi(.16,6,6),At=new Ks(zt,gt,14);for(let oe=0;oe<14;oe++){const Xt=oe/14*Math.PI*2+Q*.5,fe=9+Q*.35;s.position.set(Math.cos(Xt)*fe+(i()-.5)*.4,.18,Math.sin(Xt)*fe+20+(i()-.5)*.4),s.scale.setScalar(.7+i()*.6),s.quaternion.identity(),s.updateMatrix(),At.setMatrixAt(oe,s.matrix)}t.add(At)}const ut=new _e({color:15781984,roughness:.6});for(let Q=0;Q<18;Q++){const gt=new ie(new Mi(.22,6,6),ut);gt.position.set(10+(i()-.5)*8,.2,-16+(i()-.5)*6),t.add(gt)}const Z=new _e({color:10129544,roughness:.95});for(let Q=0;Q<10;Q++){const gt=new ie(new Rp(.4+i()*.5,0),Z);gt.position.set(-8+(i()-.5)*6,.35,4+(i()-.5)*4),gt.rotation.set(i(),i(),i()),gt.castShadow=!0,t.add(gt)}const P=new _e({map:v,color:13150328,roughness:.85});for(let Q=0;Q<5;Q++){const gt=new ie(new cn(.7,.55,.7),P);gt.position.set(-20+Q*1.2,.28,8+Q%2*.8),gt.rotation.y=i()*.4,gt.castShadow=!0,t.add(gt)}const k=gl("./textures/sky.jpg",r),tt=new ie(new Mi(110,28,18),new gu({map:k,color:1578e4,side:ni,fog:!1}));t.add(tt);const _t=new ie(new Mi(3.2,16,16),new gu({color:16769192,fog:!1,transparent:!0,opacity:.95}));_t.position.set(48,38,22),t.add(_t);const Et=new _e({color:16774894,transparent:!0,opacity:.72,roughness:1,depthWrite:!1});for(let Q=0;Q<10;Q++){const gt=new ie(new Mi(3.2+i()*1.8,8,8),Et);gt.position.set((i()-.5)*70,24+i()*8,(i()-.5)*70),gt.scale.set(1.8,.4,1.1),gt.userData.cloud=!0,t.add(gt),l.push(gt)}const B=new _e({color:15787216,roughness:.7}),J=new cn(.12,1.1,.12),bt=new Ks(J,B,56);for(let Q=0;Q<56;Q++){const gt=Q/56*Math.PI*2;s.position.set(Math.cos(gt)*48,.55,Math.sin(gt)*48),s.scale.set(1,1,1),s.quaternion.identity(),s.updateMatrix(),bt.setMatrixAt(Q,s.matrix)}t.add(bt);const Rt=new ie(new Up(48,.05,6,64),B);Rt.rotation.x=Math.PI/2,Rt.position.y=.85,t.add(Rt);const Ut=new na,et=new ie(new ui(2.2,2.4,.25,16),g);et.position.y=.15,Ut.add(et);const yt=new ie(new dl(2.6,1.2,10),new _e({color:13924456,roughness:.65}));yt.position.y=2.6,Ut.add(yt);for(let Q=0;Q<6;Q++){const gt=Q/6*Math.PI*2,zt=new ie(new ui(.05,.05,2.2,6),new _e({color:16115920}));zt.position.set(Math.cos(gt)*1.4,1.2,Math.sin(gt)*1.4),Ut.add(zt);const At=new ie(new cn(.35,.35,.18),new _e({color:[14708848,7381216,14729328][Q%3],roughness:.55}));At.position.set(Math.cos(gt)*1.4,.85,Math.sin(gt)*1.4),Ut.add(At)}return Ut.position.set(14,0,8),t.add(Ut),{root:t,carousel:Ut,clouds:l,dispose:()=>{t.traverse(Q=>{var gt;if(Q.isMesh){const zt=Q;(gt=zt.geometry)==null||gt.dispose();const At=zt.material;Array.isArray(At)?At.forEach(oe=>oe.dispose()):At==null||At.dispose()}})}}}function Gv(r,t,i,s=.28){const l=t.bank+i,c=Math.cos(l),f=Math.sin(l),d=t.normal.clone().multiplyScalar(c).addScaledVector(t.binormal,f),m=t.binormal.clone().multiplyScalar(c).addScaledVector(t.normal,-f),p=t.tangent;d.normalize(),m.crossVectors(p,d).normalize(),d.crossVectors(m,p).normalize(),r.position.copy(t.position).addScaledVector(d,s);const _=new Ve().makeBasis(m,d,p);r.quaternion.setFromRotationMatrix(_)}const _l={assisted:{id:"assisted",name:"Assisted",tagline:"Gentle climb, soft landings, and a guiding hand on the throttle.",maxSpeed:18,throttle:10,brake:14,autoThrottle:.55,gravityScale:.85,bankAssist:.85,recoveryStrength:1.2,derailThreshold:1.45,coach:!0,drama:.35},coached:{id:"coached",name:"Coached",tagline:"You drive — a quiet park attendant whispers when to brake.",maxSpeed:24,throttle:12,brake:16,autoThrottle:.15,gravityScale:1,bankAssist:.45,recoveryStrength:.9,derailThreshold:1.25,coach:!0,drama:.55},limit:{id:"limit",name:"Limit-Pushing",tagline:"Feel every crest. Banking is yours. The park trusts you.",maxSpeed:32,throttle:16,brake:18,autoThrottle:0,gravityScale:1.05,bankAssist:.15,recoveryStrength:.55,derailThreshold:1.1,coach:!1,drama:.8},unhinged:{id:"unhinged",name:"Unhinged",tagline:"Toy physics, maximal thrill, thin guardrails. Hold on.",maxSpeed:42,throttle:22,brake:20,autoThrottle:0,gravityScale:1.2,bankAssist:0,recoveryStrength:.25,derailThreshold:.92,coach:!1,drama:1.15}},_3=["assisted","coached","limit","unhinged"],Dx="miniature-coaster-v1",iu={version:1,mode:"coached",camera:"chase",bestSpeed:0,totalLaps:0,routesTaken:[],muted:!1};function Js(){try{const r=localStorage.getItem(Dx);if(!r)return{...iu};const t=JSON.parse(r);return{...iu,...t,version:1,routesTaken:Array.isArray(t.routesTaken)?t.routesTaken:[],camera:t.camera==="ride"||t.camera==="orbit"||t.camera==="chase"?t.camera:iu.camera}}catch{return{...iu}}}function Ux(r){const t={...Js(),...r,version:1};try{localStorage.setItem(Dx,JSON.stringify(t))}catch{}return t}function v3(r,t,i){const s=Js(),l=s.routesTaken.includes(r)?s.routesTaken:[...s.routesTaken,r].slice(-24);return Ux({routesTaken:l,bestSpeed:Math.max(s.bestSpeed,t),mode:i,totalLaps:s.totalLaps+1})}function rl(r,t,i){return Ux({mode:r,camera:t,muted:i})}function x3(r,t){const i=Js();let s=i.mode,l=i.camera||"chase",c=i.muted,f="title",d=i.bestSpeed;const m=new a3({canvas:r,antialias:!0,alpha:!1,powerPreference:"high-performance",preserveDrawingBuffer:!0});m.setClearColor(14731432,1),m.setPixelRatio(Math.min(window.devicePixelRatio||1,2)),m.shadowMap.enabled=!0,m.shadowMap.type=cl,m.outputColorSpace=ei,m.toneMapping=dp,m.toneMappingExposure=1.12;const p=new x1;p.background=new Re(14994352),p.fog=new Tp(14994352,55,130);const _=new bi(55,1,.15,280);p.add(new rb(16774634,.72));const v=new ib(16773341,6978120,.95);p.add(v);const g=new ud(16769208,1.55);g.position.set(30,50,20),g.castShadow=!0,g.shadow.mapSize.set(1536,1536),g.shadow.camera.near=2,g.shadow.camera.far=110,g.shadow.camera.left=-50,g.shadow.camera.right=50,g.shadow.camera.top=50,g.shadow.camera.bottom=-50,g.shadow.bias=-25e-5,p.add(g);const x=new ud(11585776,.4);x.position.set(-20,16,-14),p.add(x);const b=new ud(16756848,.3);b.position.set(40,20,30),p.add(b);const A=l3(),M=g3(m);p.add(M.root);const{root:S,branches:O}=m3(A,m);p.add(S);const U=p3(4);p.add(U.group);const w=h3(),z=new Ln,N=64,L=new Float32Array(N*3),E=new Float32Array(N);for(let ht=0;ht<N;ht++)E[ht]=Math.random();z.setAttribute("position",new Ti(L,3));const D=new nv(z,new sp({map:w,color:16773340,size:.28,transparent:!0,opacity:.5,depthWrite:!1,sizeAttenuation:!0}));p.add(D);const F=28,H=new Ln,X=new Float32Array(F*3),ct=new Float32Array(F);for(let ht=0;ht<F;ht++)ct[ht]=Math.random();H.setAttribute("position",new Ti(X,3));const ut=new nv(H,new sp({map:w,color:16775408,size:.38,transparent:!0,opacity:.5,depthWrite:!1,sizeAttenuation:!0}));p.add(ut);let Z=2,P=0,k=0,tt=1,_t=0,Et=0,B=0,J=null,bt=0,Rt=null,Ut=0,et=0,yt=0,Q=.8,gt=0,zt=0;const At={meadow:"A",ridge:"A",harbor:"A"},oe=new Set,Xt=new Set,fe=ht=>{Xt.add(ht.code),ht.code==="KeyC"&&f==="playing"&&un(),ht.code==="KeyM"&&(c=!c,rl(s,l,c),Yt()),(ht.code==="Escape"||ht.code==="KeyP")&&(f==="playing"?(f="paused",Yt()):f==="paused"&&(f="playing",Yt())),ht.code==="KeyR"&&(f==="derailed"||f==="paused")&&j()},ve=ht=>Xt.delete(ht.code),ge=()=>Xt.clear();window.addEventListener("keydown",fe),window.addEventListener("keyup",ve),window.addEventListener("blur",ge);let Xe=0,rn=0,tn=0;window.__coasterTouch=mn;function mn(ht){ht.throttle!==void 0&&(Xe=ht.throttle),ht.brake!==void 0&&(rn=ht.brake),ht.lean!==void 0&&(tn=ht.lean),ht.switchLeft&&Fe("A"),ht.switchRight&&Fe("B")}function Fe(ht){const wt=A.getNearJunction(Z);!wt||oe.has(wt.id)||(At[wt.id]=ht,O.setActive(At))}function un(){const ht=["chase","ride","orbit"],wt=ht.indexOf(l);l=ht[(wt+1)%ht.length],rl(s,l,c)}let Y=null,Me=null;function Le(){if(!(c||Y))try{Y=new AudioContext;const ht=2*Y.sampleRate,wt=Y.createBuffer(1,ht,Y.sampleRate),he=wt.getChannelData(0);for(let Pe=0;Pe<ht;Pe++)he[Pe]=Math.random()*2-1;const ee=Y.createBufferSource();ee.buffer=wt,ee.loop=!0;const de=Y.createBiquadFilter();de.type="lowpass",de.frequency.value=800,Me=Y.createGain(),Me.gain.value=0,ee.connect(de),de.connect(Me),Me.connect(Y.destination),ee.start()}catch{}}function I(){if(!Me||c){Me&&(Me.gain.value=0);return}const ht=Math.min(.08,Math.abs(P)/40*.08);Me.gain.value+=(ht-Me.gain.value)*.08}function T(){let ht=Xe,wt=rn,he=tn;(Xt.has("KeyW")||Xt.has("ArrowUp"))&&(ht=Math.max(ht,1)),(Xt.has("KeyS")||Xt.has("ArrowDown")||Xt.has("Space"))&&(wt=Math.max(wt,1)),(Xt.has("KeyA")||Xt.has("ArrowLeft"))&&(he=Math.max(he,1)),(Xt.has("KeyD")||Xt.has("ArrowRight"))&&(he=Math.min(he,-1)),Xt.has("KeyQ")&&Fe("A"),Xt.has("KeyE")&&Fe("B");const ee=A.getNearJunction(Z);ee&&!oe.has(ee.id)&&(he>.4&&(At[ee.id]="A",O.setActive(At)),he<-.4&&(At[ee.id]="B",O.setActive(At))),Ut=ht,et=wt,yt=he}function j(){Z=2,P=5,k=0,tt=1,_t=0,Et=0,B=0,gt=0,J="Hold W for steam · A/D to lean and choose paths",bt=4,Rt=null,oe.clear(),At.meadow="A",At.ridge="A",At.harbor="A",O.setActive(At),f="playing",l=Js().camera||"chase";const ht=A.getFrame(Z,At);_.position.copy(ht.position).addScaledVector(ht.tangent,-10).add(new V(0,5.5,0)),_.up.set(0,1,0),_.lookAt(ht.position.x,ht.position.y+1.2,ht.position.z),Yt()}function rt(){f="title",Z=2,P=0,k=0,Ut=0,et=0,yt=0,Xe=0,rn=0,tn=0,Xt.clear(),Rt=null,J=null,Yt()}function pt(ht){if(f!=="playing")return;const wt=_l[s];T();const he=A.getFrame(Z,At),de=(A.getFrame(Z+.5,At).height-he.height)/.5,Pe=9.81*wt.gravityScale;let Sn=-de*Pe*1.2;const Dn=wt.autoThrottle,Jn=Math.max(Ut,Dn*(P<wt.maxSpeed*.55?1:0));Sn+=Jn*wt.throttle,Sn-=et*wt.brake,Sn-=Math.sign(P||1)*.002*P*P,Sn-=P*.28,P+=Sn*ht,P=Zs.clamp(P,-wt.maxSpeed*.2,wt.maxSpeed);const fn=yt*.38*(1-wt.bankAssist*.45)+he.bank*wt.bankAssist*.2;k+=(fn-k)*Math.min(1,7*ht);const _n=Math.abs(he.curvature*P*P*.015+k*P*.4)/Math.max(1,wt.maxSpeed);tt=1+de*-.4+_n*.85+Math.abs(P)*.015,de<-.4&&P>8?gt=Math.min(8,gt+ht*12):gt=Math.max(0,gt-ht*6);const en=_n/wt.derailThreshold;if(en>.85?(Rt=en>1?"Losing the rails!":"Ease the lean",Et+=ht*(en-.7),B=Math.min(1,en-.7),k*=1-wt.recoveryStrength*ht*1.5,Et>.85&&s!=="assisted"&&(f="derailed",P*=.2,Yt())):(Et=Math.max(0,Et-ht*1.2),B*=.9,en<.5&&(Rt=null)),s==="assisted"&&(Et=Math.min(Et,.4)),Z+=P*ht,Z<0&&(Z+=A.totalLength),Z>=A.totalLength){Z-=A.totalLength,_t+=1;const Qn=Hv(At,A.junctions);v3(Qn,Math.abs(P),s),d=Math.max(d,Math.abs(P)),oe.clear(),J=`Lap ${_t} complete — ${Qn}`,bt=3.5}for(const Qn of A.junctions){const oa=(Z%A.totalLength+A.totalLength)%A.totalLength;oa>Qn.enterS+.5&&oa<Qn.exitS&&oe.add(Qn.id)}wt.coach?(bt-=ht,bt<=0&&(de>.25&&P>8?J="Crest ahead — ease throttle":de<-.35?J="Drop! Hold a gentle lean into the turn":A.getNearJunction(Z)?J="Junction — A/left or D/right to pick a path":P<3&&de>.1?J="Climbing — hold W for a little more steam":J=null,bt=2.2)):J=null,d=Math.max(d,Math.abs(P))}const Dt=new V,Ot=new V,ft=new V,mt=new V;function Lt(ht,wt){const he=.2+Math.abs(P)*.03+Ut*.65+(f==="title"?.25:0);for(let ee=0;ee<F;ee++){ct[ee]-=ht*he;const de=ee*3;if(ct[ee]<=0){if(Ut<.15&&Math.abs(P)<4&&f!=="title"){ct[ee]=.2,X[de]=wt.x,X[de+1]=-50,X[de+2]=wt.z;continue}ct[ee]=.7+Math.random()*.9,X[de]=wt.x+(Math.random()-.5)*.12,X[de+1]=wt.y,X[de+2]=wt.z+(Math.random()-.5)*.12}else X[de]+=(Math.random()-.5)*.015,X[de+1]+=ht*(.9+Math.random()*.5),X[de+2]+=(Math.random()-.5)*.015}ut.geometry.attributes.position.needsUpdate=!0,ut.material.opacity=Math.min(.6,.18+Math.abs(P)*.012+Ut*.22),ut.material.size=.28+Math.abs(P)*.008}function kt(ht,wt,he){const ee=Math.abs(P)>5;if(D.visible=ee||f==="title",!(!ee&&f!=="title")){for(let de=0;de<N;de++){E[de]-=ht*(.8+Math.abs(P)*.04);const Pe=de*3;if(E[de]<=0){E[de]=.35+Math.random()*.55;const Sn=-.4-Math.random()*1.8;L[Pe]=wt.x+he.x*Sn+(Math.random()-.5)*.6,L[Pe+1]=wt.y+.1+Math.random()*.35,L[Pe+2]=wt.z+he.z*Sn+(Math.random()-.5)*.6}else L[Pe+1]+=ht*.25}D.geometry.attributes.position.needsUpdate=!0,D.material.opacity=Math.min(.55,.15+Math.abs(P)*.012)}}function It(ht){const wt=_l[s],he=1.35;for(let nn=0;nn<U.carGroups.length;nn++){const ii=Z-nn*he,Ai=A.getFrame(ii,At);Gv(U.carGroups[nn],Ai,k*(1-nn*.12),.3)}zt+=P*ht*3.2;for(const nn of U.wheels)for(const ii of nn)ii.rotation.z=zt;const ee=A.getFrame(Z,At);kt(ht,ee.position,ee.tangent);const de=U.carGroups[0],Pe=new V(.35,1.05,0);de.localToWorld(Pe),Lt(ht,Pe),M.carousel.rotation.y+=ht*.35;for(const nn of M.clouds)nn.position.x+=ht*.12,nn.position.x>40&&(nn.position.x=-40);const Sn=A.getNearJunction(Z);S.traverse(nn=>{if(nn.userData.junctionFlag&&nn instanceof ie){const ii=nn.material;if(ii.emissive){const Ai=Sn&&nn.userData.junctionFlag===Sn.id;ii.emissiveIntensity=Ai?.35+Math.sin(performance.now()*.008)*.2:.1}}});const Dn=ee,Jn=Dn.bank+k,fn=Math.cos(Jn),_n=Math.sin(Jn);Dt.copy(Dn.normal).multiplyScalar(fn).addScaledVector(Dn.binormal,_n);const en=Dn.tangent,oa=(l==="orbit"?50:l==="chase"?58:55)+gt*wt.drama;if(_.fov+=(oa-_.fov)*Math.min(1,8*ht),_.updateProjectionMatrix(),l==="ride")ft.copy(Dn.position).addScaledVector(Dt,1.15).addScaledVector(en,-.2),_.position.lerp(ft,1-Math.exp(-12*ht)),Ot.copy(Dn.position).addScaledVector(en,10).addScaledVector(Dt,.25).add(new V(0,.2,0)),_.up.copy(Dt),_.lookAt(Ot);else if(l==="chase")mt.set(-en.z,0,en.x).normalize(),ft.copy(Dn.position).addScaledVector(en,-8.5).addScaledVector(mt,2.8).add(new V(0,4.8+Dn.height*.08,0)),ft.y=Math.max(ft.y,Dn.position.y+3.8),_.position.lerp(ft,1-Math.exp(-5.5*ht)),_.up.set(0,1,0),Ot.copy(Dn.position).addScaledVector(en,5).add(new V(0,1.4,0)),_.lookAt(Ot);else{Q+=ht*.1;const nn=36;_.position.set(Math.cos(Q)*nn,14+Math.sin(Q*.4)*1.5,Math.sin(Q)*nn+6),_.up.set(0,1,0),_.lookAt(4,3.5,8)}if(B>.02){const nn=B*.08*wt.drama;_.position.x+=(Math.random()-.5)*nn,_.position.y+=(Math.random()-.5)*nn}I()}function Bt(){const ht=A.getNearJunction(Z);let wt=null,he=null,ee=null;if(ht&&f==="playing"){const de=At[ht.id];he=de,ee={a:ht.labelA,b:ht.labelB},wt=`Junction — lean ${de==="A"?"left":"right"} for ${de==="A"?ht.labelA:ht.labelB}`}return{speed:Math.abs(P),maxSpeed:_l[s].maxSpeed,height:A.getFrame(Z,At).height,gForce:tt,progress:Z%A.totalLength/A.totalLength,routeLabel:Hv(At,A.junctions),warning:Rt,coach:J,mode:s,camera:l,junctionHint:wt,junctionPick:he,junctionLabels:ee,lean:k,throttle:Ut,brake:et,derailed:f==="derailed",lap:_t,bestSpeed:d,muted:c}}function Yt(){t(Bt(),f)}let te=0;const le=1/60;let q=performance.now()/1e3,Nt=!0,vt=0;function Pt(ht,wt){_.fov=48,_.updateProjectionMatrix(),_.position.set(Math.cos(ht*.1)*28,10+Math.sin(ht*.15)*1.4,Math.sin(ht*.1)*28+4),_.up.set(0,1,0),Z=ht*3.2%A.totalLength,P=3.2;for(let Pe=0;Pe<U.carGroups.length;Pe++){const Sn=Z-Pe*1.35;Gv(U.carGroups[Pe],A.getFrame(Sn,At),0,.3)}zt+=P*wt*3.2;for(const Pe of U.wheels)for(const Sn of Pe)Sn.rotation.z=zt;const ee=U.carGroups[0].position;_.lookAt(ee.x*.25,2.8,ee.z*.25+10);const de=new V(.35,1.05,0);U.carGroups[0].localToWorld(de),Lt(wt,de),kt(wt,ee,A.getFrame(Z,At).tangent),M.carousel.rotation.y+=wt*.35;for(const Pe of M.clouds)Pe.position.x+=wt*.1,Pe.position.x>40&&(Pe.position.x=-40)}function Ht(){const ht=r.parentElement,wt=r.clientWidth||(ht==null?void 0:ht.clientWidth)||window.innerWidth,he=r.clientHeight||(ht==null?void 0:ht.clientHeight)||window.innerHeight;if(wt<2||he<2)return;const ee=Math.min(window.devicePixelRatio||1,2),de=Math.floor(wt*ee),Pe=Math.floor(he*ee);(r.width!==de||r.height!==Pe)&&(_.aspect=wt/he,_.updateProjectionMatrix(),m.setPixelRatio(ee),m.setSize(wt,he,!1))}function Tt(){const ht=m.getContext(),wt=new Uint8Array(4),he=Math.floor(r.width/2),ee=Math.floor(r.height/2);return ht.readPixels(he,ee,1,1,ht.RGBA,ht.UNSIGNED_BYTE,wt),Array.from(wt)}function jt(){if(!Nt)return;Ht();const ht=performance.now()/1e3;let wt=Math.min(.1,ht-q);if(q=ht,f==="title")Pt(ht,wt);else{for(te+=wt;te>=le;)pt(le),te-=le;It(wt)}m.render(p,_),vt+=wt,vt>.08&&(vt=0,Yt())}m.setAnimationLoop(jt),Ht(),O.setActive(At);const qt=new ResizeObserver(()=>Ht());return qt.observe(r.parentElement||r),window.__controlsTest={getYaw:()=>k,getSpeed:()=>P,getLean:()=>k,setSteer:ht=>{tn=ht},setKeys:ht=>{Xt.clear();for(const wt of ht)Xt.add(wt)}},window.__coasterDebug={samples:A.samples.length,length:A.totalLength,children:p.children.length,calls:()=>m.info.render.calls,trainPos:()=>{var ht;return(ht=U.carGroups[0])==null?void 0:ht.position.toArray()},camPos:()=>_.position.toArray(),sample:()=>Tt()},{start:ht=>{s=ht,Le(),rl(s,l,c),j()},resume:()=>{(f==="paused"||f==="derailed")&&(f==="derailed"?j():(f="playing",Yt()))},pause:()=>{f==="playing"&&(f="paused",Yt())},reset:()=>j(),goTitle:rt,setCamera:ht=>{l=ht,rl(s,l,c),Yt()},setMuted:ht=>{c=ht,rl(s,l,c),c&&Me&&(Me.gain.value=0),Yt()},getHud:Bt,getScreen:()=>f,dispose:()=>{Nt=!1,m.setAnimationLoop(null),qt.disconnect(),window.removeEventListener("keydown",fe),window.removeEventListener("keyup",ve),window.removeEventListener("blur",ge),M.dispose(),S.traverse(ht=>{var wt;if(ht.isMesh){const he=ht;(wt=he.geometry)==null||wt.dispose();const ee=he.material;Array.isArray(ee)?ee.forEach(de=>de.dispose()):ee==null||ee.dispose()}}),z.dispose(),H.dispose(),w.dispose(),D.material.dispose(),ut.material.dispose(),m.dispose(),Y&&Y.close()}}}const S3={speed:0,maxSpeed:24,height:0,gForce:1,progress:0,routeLabel:"—",warning:null,coach:null,mode:"coached",camera:"chase",junctionHint:null,junctionPick:null,junctionLabels:null,lean:0,throttle:0,brake:0,derailed:!1,lap:0,bestSpeed:0,muted:!1};function y3(){const r=Zn.useRef(null),t=Zn.useRef(null),[i,s]=Zn.useState("title"),[l,c]=Zn.useState(S3),[f,d]=Zn.useState(()=>Js().mode),[m,p]=Zn.useState(()=>Js().muted),[_,v]=Zn.useState(!1);Zn.useEffect(()=>{const b=r.current;if(!b)return;const A=x3(b,(M,S)=>{c(M),s(S),p(M.muted)});return t.current=A,v(!0),()=>{A.dispose(),t.current=null}},[]);const g=Zn.useCallback(()=>{var b;(b=t.current)==null||b.start(f)},[f]),x=Zn.useCallback(b=>{var A;(A=window.__coasterTouch)==null||A.call(window,b)},[]);return Ct.jsxs("div",{className:"relative h-[100dvh] w-full overflow-hidden bg-bg text-fg",children:[Ct.jsx("canvas",{ref:r,className:"absolute inset-0 h-full w-full touch-none","aria-label":"Miniature coaster view"}),Ct.jsx("div",{className:"pointer-events-none absolute inset-0",style:{background:i==="title"?"radial-gradient(ellipse at 50% 35%, transparent 32%, rgba(12,11,10,0.32) 100%)":"radial-gradient(ellipse at center, transparent 58%, rgba(12,11,10,0.28) 100%)"}}),i==="title"&&Ct.jsx(M3,{mode:f,setMode:d,onStart:g,bestSpeed:l.bestSpeed||Js().bestSpeed,ready:_}),i==="playing"&&Ct.jsx(b3,{hud:l,muted:m,onMute:()=>{var A;const b=!m;p(b),(A=t.current)==null||A.setMuted(b)},onPause:()=>{var b;return(b=t.current)==null?void 0:b.pause()},onCamera:()=>{var M;const b=["chase","ride","orbit"],A=b.indexOf(l.camera);(M=t.current)==null||M.setCamera(b[(A+1)%b.length])},touch:x}),i==="paused"&&Ct.jsx(kv,{title:"Paused",body:"The little train waits at the crest. Take a breath.",primary:"Resume",onPrimary:()=>{var b;return(b=t.current)==null?void 0:b.resume()},secondary:"Restart",onSecondary:()=>{var b;return(b=t.current)==null?void 0:b.reset()},tertiary:"Title",onTertiary:()=>{var b;return(b=t.current)==null?void 0:b.goTitle()}}),i==="derailed"&&Ct.jsx(kv,{title:"Off the rails",body:"A little too much gusto on that bank. The park crew is already re-seating the cars.",primary:"Ride again",onPrimary:()=>{var b;return(b=t.current)==null?void 0:b.resume()},secondary:"Title",onSecondary:()=>{var b;return(b=t.current)==null?void 0:b.goTitle()}})]})}function M3({mode:r,setMode:t,onStart:i,bestSpeed:s,ready:l}){return Ct.jsx("div",{className:"absolute inset-0 flex flex-col items-center justify-end pb-8 pt-[max(1rem,env(safe-area-inset-top))] sm:justify-center sm:pb-0",children:Ct.jsxs("div",{className:"mx-4 w-full max-w-md rounded-[28px] border border-border bg-surface/85 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-md sm:p-8",children:[Ct.jsx("p",{className:"text-xs font-medium tracking-[0.18em] text-muted uppercase",children:"Golden Hour Park"}),Ct.jsx("h1",{className:"mt-2 text-[clamp(1.75rem,5vw,2.35rem)] leading-tight font-semibold tracking-tight text-fg",style:{fontFamily:"var(--font-display)"},children:"Miniature Coaster"}),Ct.jsx("p",{className:"mt-3 text-sm leading-relaxed text-muted",children:"A heartwarming toy-train ride through a tiny nostalgic park. Pick junctions, lean into banks, and chase the soft sunset glow."}),Ct.jsxs("div",{className:"mt-5 space-y-2",children:[Ct.jsx("p",{className:"text-xs font-medium tracking-wide text-faint uppercase",children:"Ride mode"}),Ct.jsx("div",{className:"grid grid-cols-2 gap-2",children:_3.map(c=>{const f=_l[c],d=r===c;return Ct.jsxs("button",{type:"button",onClick:()=>t(c),className:"rounded-[16px] border px-3 py-3 text-left transition-colors "+(d?"border-accent bg-accent text-accent-fg":"border-border bg-surface-2 text-fg hover:border-border-strong"),children:[Ct.jsx("span",{className:"block text-sm font-semibold",children:f.name}),Ct.jsx("span",{className:"mt-1 block text-[11px] leading-snug "+(d?"text-accent-fg/80":"text-muted"),children:f.tagline})]},c)})})]}),Ct.jsxs("button",{type:"button",disabled:!l,onClick:i,className:"mt-6 flex w-full items-center justify-center gap-2 rounded-[16px] bg-fg px-4 py-3.5 text-sm font-semibold text-bg transition-transform active:scale-[0.98] disabled:opacity-50",children:[Ct.jsx(Wv,{className:"size-4",strokeWidth:2.25}),"Board the train"]}),Ct.jsxs("div",{className:"mt-4 flex items-center justify-between text-xs text-faint",children:[Ct.jsxs("span",{children:["Best speed ",s.toFixed(0)," u/s"]}),Ct.jsx("span",{className:"hidden sm:inline",children:"WASD · Q/E junctions · C camera"})]})]})})}function b3({hud:r,muted:t,onMute:i,onPause:s,onCamera:l,touch:c}){const f=Math.min(1,r.speed/Math.max(1,r.maxSpeed)),d=Math.max(-1,Math.min(1,r.lean/.38)),m=Math.min(1,Math.max(0,r.progress));return Ct.jsxs(Ct.Fragment,{children:[Ct.jsxs("div",{className:"pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:p-4",children:[Ct.jsxs("div",{className:"pointer-events-auto flex gap-2",children:[Ct.jsx(_d,{onClick:s,label:"Pause",children:Ct.jsx(tM,{className:"size-4"})}),Ct.jsx(_d,{onClick:l,label:"Camera",children:Ct.jsx(Jy,{className:"size-4"})}),Ct.jsx(_d,{onClick:i,label:t?"Unmute":"Mute",children:t?Ct.jsx(oM,{className:"size-4"}):Ct.jsx(sM,{className:"size-4"})})]}),Ct.jsxs("div",{className:"rounded-[14px] border border-border bg-surface/75 px-3 py-2 backdrop-blur-md",children:[Ct.jsxs("div",{className:"flex items-center gap-2 text-xs text-muted",children:[Ct.jsx(jy,{className:"size-3.5"}),Ct.jsx("span",{className:"tabular font-semibold text-fg",children:r.speed.toFixed(0)}),Ct.jsxs("span",{children:["/ ",r.maxSpeed]})]}),Ct.jsx("div",{className:"mt-1.5 h-1.5 w-28 overflow-hidden rounded-full bg-surface-2",children:Ct.jsx("div",{className:"h-full rounded-full bg-accent transition-[width] duration-150",style:{width:`${f*100}%`}})}),Ct.jsx("div",{className:"mt-1.5 h-1 w-28 overflow-hidden rounded-full bg-surface-2",children:Ct.jsx("div",{className:"h-full rounded-full bg-warm/80 transition-[width] duration-200",style:{width:`${m*100}%`}})}),Ct.jsx("div",{className:"mt-1.5 flex h-1 w-28 items-center",children:Ct.jsx("div",{className:"relative h-1 w-full rounded-full bg-surface-2 "+(r.junctionHint?"ring-1 ring-accent/50":""),children:Ct.jsx("div",{className:"absolute top-1/2 size-2 -translate-y-1/2 rounded-full bg-warm transition-[left] duration-100",style:{left:`calc(50% + ${d*50}% - 4px)`}})})})]})]}),Ct.jsxs("div",{className:"pointer-events-none absolute inset-x-0 top-16 flex flex-col items-center gap-2 px-4 sm:top-20",children:[Ct.jsxs("div",{className:"rounded-full border border-border bg-surface/75 px-3 py-1.5 text-xs text-muted backdrop-blur-md",children:[Ct.jsx("span",{className:"text-faint",children:"Route"})," ",Ct.jsx("span",{className:"font-medium text-fg",children:r.routeLabel}),Ct.jsx("span",{className:"mx-2 text-faint",children:"·"}),Ct.jsxs("span",{className:"tabular",children:["Lap ",r.lap]})]}),r.junctionLabels&&Ct.jsxs("div",{className:"flex max-w-sm gap-2",children:[Ct.jsx(Vv,{label:r.junctionLabels.a,side:"A · Left",active:r.junctionPick==="A"}),Ct.jsx(Vv,{label:r.junctionLabels.b,side:"B · Right",active:r.junctionPick==="B"})]}),r.coach&&!r.junctionHint&&Ct.jsx("div",{className:"max-w-sm rounded-[12px] border border-border bg-surface/80 px-3 py-2 text-center text-xs text-muted backdrop-blur-md",children:r.coach}),r.warning&&Ct.jsx("div",{className:"rounded-[12px] border border-danger/40 bg-danger/15 px-3 py-2 text-center text-xs font-medium text-danger backdrop-blur-md",children:r.warning})]}),Ct.jsxs("div",{className:"absolute inset-x-0 bottom-0 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4",children:[Ct.jsxs("div",{className:"mb-3 flex justify-center gap-3 text-[11px] text-muted sm:justify-start",children:[Ct.jsx(au,{label:"G",value:r.gForce.toFixed(2)}),Ct.jsx(au,{label:"Ht",value:r.height.toFixed(1)}),Ct.jsx(au,{label:"Cam",value:r.camera}),Ct.jsx(au,{label:"Mode",value:_l[r.mode].name})]}),Ct.jsxs("div",{className:"flex items-end justify-between gap-3 sm:hidden",children:[Ct.jsxs("div",{className:"flex gap-2",children:[Ct.jsx(su,{label:"A",sub:"Left",onDown:()=>c({lean:1,switchLeft:!0}),onUp:()=>c({lean:0})}),Ct.jsx(su,{label:"D",sub:"Right",onDown:()=>c({lean:-1,switchRight:!0}),onUp:()=>c({lean:0})})]}),Ct.jsxs("div",{className:"flex gap-2",children:[Ct.jsx(su,{label:"S",sub:"Brake",onDown:()=>c({brake:1}),onUp:()=>c({brake:0})}),Ct.jsx(su,{label:"W",sub:"Steam",primary:!0,onDown:()=>c({throttle:1}),onUp:()=>c({throttle:0})})]})]}),Ct.jsx("p",{className:"mt-2 hidden text-center text-[11px] text-faint sm:block sm:text-left",children:"W throttle · S brake · A/D lean & junctions · Q/E force switch · C camera · P pause"})]})]})}function Vv({label:r,side:t,active:i}){return Ct.jsxs("div",{className:"rounded-[12px] border px-3 py-2 text-center backdrop-blur-md transition-colors "+(i?"border-accent bg-accent/90 text-accent-fg":"border-border bg-surface/70 text-muted"),children:[Ct.jsx("p",{className:"text-[10px] uppercase tracking-wide opacity-70",children:t}),Ct.jsx("p",{className:"text-xs font-semibold",children:r})]})}function au({label:r,value:t}){return Ct.jsxs("span",{className:"rounded-full border border-border bg-surface/70 px-2.5 py-1 backdrop-blur-md",children:[Ct.jsx("span",{className:"text-faint",children:r})," ",Ct.jsx("span",{className:"tabular font-medium text-fg",children:t})]})}function _d({children:r,onClick:t,label:i}){return Ct.jsx("button",{type:"button","aria-label":i,onClick:t,className:"flex size-11 items-center justify-center rounded-[14px] border border-border bg-surface/80 text-fg backdrop-blur-md transition-colors hover:bg-surface-2",children:r})}function su({label:r,sub:t,primary:i,onDown:s,onUp:l}){return Ct.jsxs("button",{type:"button",className:"flex h-16 w-16 flex-col items-center justify-center rounded-[18px] border text-sm font-semibold select-none "+(i?"border-accent bg-accent text-accent-fg":"border-border bg-surface/85 text-fg backdrop-blur-md"),onPointerDown:c=>{c.preventDefault(),c.target.setPointerCapture(c.pointerId),s()},onPointerUp:l,onPointerCancel:l,onPointerLeave:l,children:[Ct.jsx("span",{children:r}),Ct.jsx("span",{className:"text-[10px] font-normal opacity-70",children:t})]})}function kv({title:r,body:t,primary:i,onPrimary:s,secondary:l,onSecondary:c,tertiary:f,onTertiary:d}){return Ct.jsx("div",{className:"absolute inset-0 flex items-center justify-center bg-bg/55 p-4 backdrop-blur-sm",children:Ct.jsxs("div",{className:"w-full max-w-sm rounded-[24px] border border-border bg-surface p-6 shadow-[0_24px_80px_rgba(0,0,0,0.5)]",children:[Ct.jsx("h2",{className:"text-xl font-semibold tracking-tight",children:r}),Ct.jsx("p",{className:"mt-2 text-sm leading-relaxed text-muted",children:t}),Ct.jsxs("div",{className:"mt-5 flex flex-col gap-2",children:[Ct.jsxs("button",{type:"button",onClick:s,className:"flex items-center justify-center gap-2 rounded-[14px] bg-fg px-4 py-3 text-sm font-semibold text-bg active:scale-[0.98]",children:[Ct.jsx(Wv,{className:"size-4"}),i]}),l&&c&&Ct.jsxs("button",{type:"button",onClick:c,className:"flex items-center justify-center gap-2 rounded-[14px] border border-border bg-surface-2 px-4 py-3 text-sm font-medium text-fg",children:[Ct.jsx(iM,{className:"size-4"}),l]}),f&&d&&Ct.jsx("button",{type:"button",onClick:d,className:"rounded-[14px] px-4 py-2 text-sm text-muted",children:f})]})]})})}ky.createRoot(document.getElementById("root")).render(Ct.jsx(Zn.StrictMode,{children:Ct.jsx(y3,{})}));
