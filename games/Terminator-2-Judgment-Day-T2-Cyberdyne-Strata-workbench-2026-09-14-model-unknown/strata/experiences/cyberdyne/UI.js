/* DOM overlay for both the standalone player and the original workbench. */
import { VisionUI } from './VisionUI.js';
import { VEHICLES, OFFICERS, PRESSURE, wavePlan } from './Waves.js';
export const css = `
:root{color-scheme:dark;--t2-ice:#d8eaf3;--t2-cyan:#91c6df;--t2-amber:#eeb67c;--t2-muted:#718da3;--t2-line:#9ccae32b}
body.t2-standalone{margin:0;overflow:hidden;background:#091624;color:var(--t2-ice);font-family:Arial,Helvetica,sans-serif}
body.t2-standalone #app{display:block;width:100vw;height:100dvh;background:#0b1a2c}body.t2-standalone #canvas{position:absolute;inset:0;width:100%;height:100%;display:block;outline:none;touch-action:none}
#t2-ui{position:absolute;inset:0;z-index:15;color:var(--t2-ice);pointer-events:none;font-family:Arial,Helvetica,sans-serif;font-size:12px;overflow:hidden;--safe:clamp(20px,3.4vw,56px)}
#t2-ui *{box-sizing:border-box}#t2-ui button{font:inherit;cursor:pointer;border:1px solid var(--t2-line);border-radius:2px;pointer-events:auto;color:var(--t2-ice);background:#152939aa;padding:12px 18px;transition:background .2s,border-color .2s}#t2-ui button:hover{background:#2b4658c9;border-color:#9ccae39a}#t2-ui button:focus-visible{outline:2px solid #eeb67c;outline-offset:4px}
#t2-ui .t2-hide{display:none!important}.t2-shade{position:absolute;inset:0;background:linear-gradient(90deg,#06111dec 0%,#06111d9e 31%,#06111d15 68%),linear-gradient(0deg,#06111dba,transparent 34%,transparent 76%,#06111d70);transition:opacity .5s}
#t2-ui.t2-live .t2-shade{opacity:.30;pointer-events:none}#t2-ui:after{content:'';position:absolute;inset:0;z-index:-1;pointer-events:none;box-shadow:inset 0 0 170px #03101d88}
.t2-top{position:absolute;top:27px;left:var(--safe);right:var(--safe);display:flex;justify-content:space-between;align-items:center;gap:20px}.t2-brand{display:flex;align-items:center;gap:14px}.t2-mark{font-size:32px;font-weight:900;letter-spacing:-3px;line-height:1;position:relative}.t2-mark:after{content:'';height:2px;background:#eeb67c;width:25px;position:absolute;bottom:-8px;left:0}.t2-brand-text{border-left:1px solid #91aec54d;padding-left:15px;font:10px/1.7 monospace;letter-spacing:2px;color:#91a9bc}.t2-brand-text b{font-weight:400;color:#dbebf2;display:block;letter-spacing:2.4px}.t2-top-right{display:flex;align-items:center;gap:6px}.t2-status{font:9px monospace;letter-spacing:1.7px;color:#90a7b9;padding-right:18px}.t2-status:before{content:'';display:inline-block;width:5px;height:5px;background:#a1cfa9;border-radius:50%;margin-right:8px}#t2-ui .t2-small-btn{padding:9px 11px;font:9px monospace;letter-spacing:1px;background:#14263880}
.t2-intro{position:absolute;left:var(--safe);top:50%;transform:translateY(-45%);width:480px;max-width:70vw}.t2-kicker{font:10px monospace;letter-spacing:3.8px;color:var(--t2-amber);display:flex;align-items:center;gap:12px}.t2-kicker:before{content:'';display:inline-block;width:34px;height:1px;background:var(--t2-amber)}.t2-intro h1{font-size:clamp(46px,6.5vw,98px);letter-spacing:-4px;font-weight:800;line-height:.93;margin:24px 0 0;color:#e6eff4}.t2-intro h1 span{display:block;color:transparent;-webkit-text-stroke:1px #d9eaf2a1}.t2-subtitle{font:11px monospace;letter-spacing:5px;color:#95adbe;margin:22px 0 27px}.t2-intro p{font-size:13px;line-height:1.85;max-width:325px;color:#a5bbcc;margin:0 0 25px}.t2-actions{display:flex;gap:10px;margin-top:25px}#t2-ui .t2-primary{background:#d5e6ed;color:#0d2030;border-color:#d5e6ed;font-size:11px;letter-spacing:1.8px;text-transform:uppercase;font-weight:700;padding:16px 22px;min-width:156px}#t2-ui .t2-primary:hover{background:white;border-color:white}#t2-ui .t2-secondary{font-size:10px;text-transform:uppercase;letter-spacing:1.4px;padding:16px 19px}.t2-features{display:flex;gap:22px;margin-top:30px;font:8px monospace;letter-spacing:1.4px;color:#738da4}.t2-features b{display:block;font:17px Arial,sans-serif;letter-spacing:1px;color:#9eb7c7;margin-bottom:7px;font-weight:400}
.t2-bottom{position:absolute;bottom:22px;left:var(--safe);right:var(--safe);display:flex;justify-content:space-between;align-items:center;color:#718fa5;font:8px monospace;letter-spacing:1.2px}.t2-bottom span:last-child{color:#819aad}.t2-warning{position:absolute;right:var(--safe);bottom:74px;width:220px;border-top:1px solid var(--t2-line);padding-top:14px;text-align:right;font:9px/1.8 monospace;color:#8ba5b9;letter-spacing:.8px}.t2-warning strong{display:block;color:#c1d6e4;font-size:11px;letter-spacing:2.4px;margin-bottom:6px}.t2-warning i{font-style:normal;color:#eeb67c}
.t2-playhud{position:absolute;inset:0}.t2-objective{position:absolute;top:104px;left:var(--safe);padding-left:14px;border-left:2px solid #eeb67c;text-shadow:0 2px 12px #06111d}.t2-label{font:8px monospace;letter-spacing:2.2px;color:#9db4c7}.t2-objective h2{font-size:20px;font-weight:500;margin:9px 0 7px;letter-spacing:-.25px}.t2-objective p{margin:0;font-size:10px;color:#a1b7c7}.t2-counts{position:absolute;top:107px;right:var(--safe);display:flex;gap:28px;text-align:right;text-shadow:0 2px 8px #06111d}.t2-counts strong{font-size:25px;font-weight:300;letter-spacing:2px;display:block;margin-top:7px}.t2-counts strong small{font-size:12px;color:#92a9b9}.t2-counts .t2-zero{color:#d4dfcf}.t2-hud-bottom{position:absolute;left:var(--safe);right:var(--safe);bottom:66px;display:flex;justify-content:space-between;align-items:end}.t2-integrity{width:145px}.t2-number{font-size:36px;font-weight:300;letter-spacing:-1px;margin-top:6px}.t2-number small{font:10px monospace;letter-spacing:1px;color:#829db1;margin-left:9px}.t2-bar{height:2px;background:#c3dae52b;margin-top:10px}.t2-bar i{height:100%;display:block;background:#a3c6d8;transition:width .1s}.t2-weapon{text-align:right;width:185px}.t2-weapon .t2-number{font-size:43px}.t2-weapon .t2-label{color:#e4c8a9}.t2-heat{display:flex;gap:9px;align-items:center;margin-top:10px;font:8px monospace;letter-spacing:1px;color:#8ca6bb}.t2-heat .t2-bar{flex:1;margin:0;height:3px}.t2-heat .t2-bar i{background:#eeb67c}.t2-controls{position:absolute;bottom:23px;width:100%;display:flex;justify-content:center;align-items:center;gap:15px;font:9px monospace;color:#9fb4c5;letter-spacing:.3px}.t2-controls kbd{font:9px monospace;color:#d8e7f1;display:inline-block;border:1px solid #9bbaca45;padding:4px 6px;background:#11263599;border-radius:2px;margin-right:5px}.t2-reticle{position:absolute;width:38px;height:38px;left:50%;top:50%;transform:translate(-50%,-50%);border:1px solid #a6ced33b;border-radius:50%;filter:drop-shadow(0 0 3px #071d29)}.t2-reticle:before,.t2-reticle:after{content:'';position:absolute;background:#d5edf2}.t2-reticle:before{width:2px;height:8px;left:17px;top:-5px;box-shadow:0 37px #d5edf2}.t2-reticle:after{width:8px;height:2px;left:-5px;top:17px;box-shadow:37px 0 #d5edf2}.t2-reticle i{position:absolute;left:16px;top:16px;width:4px;height:4px;background:#e7e6cb;border-radius:50%}.t2-reticle.hit{border-color:#f3c78c;transform:translate(-50%,-50%) scale(.85)}.t2-reticle.safe{border-color:#ee9b7e}.t2-targets{position:absolute;inset:0}.t2-target{position:absolute;transform:translate(-50%,-50%);width:66px;height:33px;border-left:1px solid #e5c79d77;border-right:1px solid #e5c79d77;text-align:center;opacity:.8}.t2-target:before,.t2-target:after{content:'';position:absolute;top:0;height:4px;width:7px;border-top:1px solid #e5c79d77}.t2-target:before{left:0}.t2-target:after{right:0}.t2-target span{position:absolute;white-space:nowrap;top:-13px;left:50%;transform:translateX(-50%);font:7px monospace;letter-spacing:1px;color:#d6bea0;text-shadow:0 1px 5px black}.t2-target.disabled{border-color:#86ab9c44}.t2-target.disabled span{color:#99baaf}.t2-message{position:absolute;top:70%;left:50%;transform:translateX(-50%);font:10px monospace;letter-spacing:1.5px;color:#e9c597;text-shadow:0 2px 4px #05111d;background:#0d2130bd;padding:9px 15px;border-left:2px solid #e2b477;white-space:nowrap}.t2-progress{position:absolute;top:175px;right:var(--safe);width:210px;text-align:right}.t2-progress .t2-bar{height:2px}.t2-progress .t2-label{font-size:7px;letter-spacing:1.4px}.t2-demo-label{position:absolute;bottom:148px;left:50%;transform:translateX(-50%);font:9px monospace;letter-spacing:3px;color:#d4dcd9}.t2-scan{position:absolute;inset:0;opacity:0;background:repeating-linear-gradient(0deg,#ab2e160c 0px,#ab2e160c 1px,transparent 2px,transparent 4px);mix-blend-mode:screen;pointer-events:none}.scanner .t2-scan{opacity:1}.scanner{color:#f5b9a5!important}.scanner .t2-reticle{border-color:#ee9179}.t2-damage{position:absolute;inset:0;box-shadow:inset 0 0 140px #c46c4270;pointer-events:none;opacity:0}
.t2-pause{position:absolute;inset:0;display:grid;place-items:center;background:#07142299;backdrop-filter:blur(7px);pointer-events:auto}.t2-pause-box{width:400px;max-width:90vw;padding:35px;border:1px solid #96bace40;background:#102231ed}.t2-pause-box h2{font-size:32px;letter-spacing:-1px;font-weight:400;margin:18px 0}.t2-pause-box p{font-size:12px;color:#9fb7c8;line-height:1.9}.t2-pause-box .t2-actions{flex-wrap:wrap}.t2-result{display:flex;gap:30px;padding:18px 0;border-top:1px solid var(--t2-line);border-bottom:1px solid var(--t2-line);margin:20px 0}.t2-result strong{display:block;font-size:28px;font-weight:400;margin:8px 0}.t2-settings-panel{position:absolute;right:var(--safe);top:75px;width:300px;background:#102231f2;border:1px solid #63899f66;padding:22px;pointer-events:auto;box-shadow:0 20px 80px #03101999}.t2-settings-panel h3{margin:0 0 18px;font-weight:500;font-size:16px}.t2-settings-panel label{display:flex;align-items:center;justify-content:space-between;margin:18px 0;color:#a6bfce;font-size:11px;gap:15px}.t2-settings-panel input[type=range]{width:115px;accent-color:#a3c6d8}.t2-settings-panel input[type=checkbox]{accent-color:#a3c6d8}.t2-settings-panel p{color:#819aad;font-size:10px;line-height:1.8}.t2-toast{position:absolute;top:80px;left:50%;transform:translateX(-50%);max-width:80%;font:10px/1.7 monospace;background:#102839ed;padding:10px 17px;color:#cedfe8;border:1px solid #4f788f66}.t2-loading{font:13px monospace;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#a7c9db}
body.t2-studio-play .topbar,body.t2-studio-play .statusbar{display:none}body.t2-studio-play #app{grid-template-rows:0 minmax(0,1fr) 0}body.t2-studio-play #hud,body.t2-studio-play #modal-overlay,body.t2-studio-play #notice{display:none!important}
@media(max-width:800px){.t2-intro{max-width:85vw}.t2-intro h1{font-size:60px}.t2-top{top:20px}.t2-status{display:none}.t2-brand-text{font-size:8px}.t2-mark{font-size:28px}.t2-warning{display:none}.t2-counts{gap:15px}.t2-counts .t2-label{font-size:7px}.t2-objective h2{font-size:17px}.t2-objective p{max-width:210px;font-size:9px}.t2-progress{width:140px}.t2-controls{gap:7px;font-size:8px;flex-wrap:wrap;padding:0 14px}.t2-hud-bottom{bottom:87px}.t2-bottom span:last-child{display:none}.t2-features{gap:14px}.t2-features b{font-size:15px}}@media(max-height:630px){.t2-intro h1{font-size:60px}.t2-intro p{margin-bottom:10px;font-size:11px}.t2-subtitle{margin:15px 0}.t2-features{margin-top:18px}.t2-intro{transform:translateY(-38%)}.t2-kicker{font-size:8px}.t2-objective{top:82px}.t2-counts{top:85px}.t2-progress{top:151px}.t2-bottom{bottom:15px}.t2-intro .t2-features{display:none}}

.t2-machine-layer{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.t2-targets{display:none}.t2-objective{max-width:440px}.t2-live .t2-brand-text{font-size:8px}.t2-objective p{line-height:1.65;max-width:390px}
.t2-message{max-width:85%;white-space:normal;text-align:center;line-height:1.7;top:auto;bottom:175px}
.t2-wave-strip{position:absolute;left:var(--safe);top:191px;display:flex;align-items:center;gap:12px;font:9px monospace;letter-spacing:1.1px;color:#b8d6e7}
.t2-wave-strip span{border:1px solid #a0bac344;padding:6px 9px;background:#112433a8}.t2-wave-strip strong{font-weight:400;color:#e5d0ac}
.t2-wave-banner{position:absolute;top:29%;left:50%;transform:translateX(-50%);text-align:center;background:#081826e8;border-top:1px solid #e7c094;border-bottom:1px solid #e7c094;padding:19px 38px;min-width:390px;max-width:88%;color:#e1eaf0}
.t2-wave-banner .t2-label{color:#e7c094;line-height:1.8}.t2-wave-banner h2{font-size:30px;font-weight:400;margin:12px 0}.t2-wave-banner p{font:11px/1.7 monospace;color:#b1c8d5;max-width:400px;margin:0 auto}
.t2-alert{position:absolute;top:235px;left:50%;transform:translateX(-50%);color:#ffe0c4;background:#652a238e;border:1px solid #f0927966;padding:9px 18px;font:10px monospace;letter-spacing:1px}
.t2-vision-panel{position:absolute;top:265px;left:var(--safe);width:228px;border-left:2px solid #f68a72;background:linear-gradient(90deg,#230b09d9,#230b0970);padding:16px;color:#ffd5be;font:10px/1.75 monospace}
.t2-vision-panel header{font-size:11px;letter-spacing:2px;padding-bottom:10px;border-bottom:1px solid #fa9f7244;color:#ffe2c9}
.t2-vision-panel .t2-v-label{color:#db8b76;font-size:9px;letter-spacing:1px;margin-top:13px}.t2-vision-panel strong{display:block;font-weight:400;font-size:13px;line-height:1.7}
.t2-vision-panel dl{margin:12px 0;display:grid;grid-template-columns:85px 1fr;font-size:9px;gap:4px}
.t2-vision-panel dt{color:#c88e80}.t2-vision-panel dd{margin:0;color:#ffdecb}.t2-vision-panel .t2-bar{background:#9b3b3455;height:3px;margin:9px 0}.t2-vision-panel .t2-bar i{background:#ffd0b9}
.t2-vision-panel footer{font-size:9px;line-height:1.8;color:#eeb5a1;border-top:1px solid #f79f7344;padding-top:10px}.t2-vision-panel small{font-size:8px;letter-spacing:1px;color:#ffb593}
.t2-vision-status{position:absolute;bottom:170px;left:var(--safe);font:9px/1.8 monospace;letter-spacing:1.4px;color:#efbda8}
.t2-scan{mix-blend-mode:normal;background:repeating-linear-gradient(0deg,#0c00000d 0px,#0c00000d 1px,transparent 1px,transparent 4px);box-shadow:inset 0 0 130px #14000088;z-index:1}
.scanner .t2-label,.scanner .t2-controls,.scanner .t2-brand-text,.scanner .t2-wave-strip{color:#ffd0b9}
.scanner .t2-objective{border-left-color:#ffb79a}.scanner .t2-number,.scanner .t2-counts strong{color:#ffe2d1}
.scanner .t2-reticle{border-radius:0;border-color:#ffac8d}.scanner .t2-reticle:before,.scanner .t2-reticle:after,.scanner .t2-reticle i{background:#ffd9bd}
.scanner .t2-shade{opacity:0!important}.scanner .t2-bar i{background:#fba184}.scanner .t2-wave-strip span{background:#330e0eb0;border-color:#cb715f55}
.scanner .t2-objective p,.scanner .t2-number small{color:#e6b6a3}.scanner .t2-message{background:#280b09dd;border-color:#e9a486;color:#ffcfb4}
#t2-ui .t2-small-btn.vision-on{background:#692723c9;border-color:#ffa583;color:#ffddc2}
.t2-hide-reticle .t2-reticle{display:none}.t2-controls kbd{font-size:9px}.t2-toast{z-index:12;top:80px}.t2-settings-panel{z-index:15}.t2-pause{z-index:10}
@media(max-width:1100px){.t2-vision-panel{width:185px;left:23px;padding:12px}.t2-vision-panel dl{grid-template-columns:72px 1fr}.t2-objective{max-width:330px}.t2-vision-panel strong{font-size:11px}.t2-controls{font-size:8px;gap:8px}.t2-top-right .t2-status{display:none}}
@media(max-height:720px){.t2-vision-panel{top:232px;padding:10px;font-size:9px;width:190px}.t2-vision-panel dl{margin:6px 0}.t2-vision-panel .t2-v-label{margin-top:7px}.t2-vision-panel footer{padding-top:6px}.t2-vision-panel header{padding-bottom:6px}.t2-vision-status{bottom:150px;font-size:8px}.t2-wave-strip{top:174px}.t2-alert{top:214px}}
@media(max-width:800px){.t2-vision-panel{top:244px;width:164px}.t2-vision-panel dl{grid-template-columns:62px 1fr;font-size:8px}.t2-vision-panel footer{font-size:8px}.t2-wave-strip{top:203px;font-size:8px;gap:7px}.t2-wave-strip span{padding:4px}.t2-vision-status{display:none}.t2-top-right{gap:3px}#t2-ui .t2-small-btn{font-size:8px;padding:8px}.t2-objective p{max-width:225px}.t2-wave-banner{min-width:300px}.t2-alert{top:231px;font-size:8px}}

#t2-ui.t2-hide{display:none!important}
#t2-ui .nav-focus{outline:2px solid #eeb67c;outline-offset:4px}
.t2-intro-links{display:flex;gap:22px;margin-top:14px}
#t2-ui .t2-link{background:none;border:0;padding:6px 0;font:10px monospace;letter-spacing:1.4px;color:#9fc1d4;text-transform:uppercase}
#t2-ui .t2-link:hover{background:none;color:#e6f1f6}
.t2-best{margin-top:12px;font:10px monospace;letter-spacing:1.6px;color:#eeb67c}
#t2-ui .t2-pause-box .t2-best-line{font:10px monospace;letter-spacing:1.6px;color:#eeb67c;margin:0 0 6px}
.t2-result{flex-wrap:wrap;gap:22px}
#t2-ui .t2-wide{width:100%;margin:6px 0}
.t2-settings-panel{max-height:calc(100% - 95px);overflow:auto}
.t2-settings-panel select{width:125px;font:11px Arial,Helvetica,sans-serif;color:#d8eaf3;background:#0d1c29;border:1px solid #63899f66;padding:6px;border-radius:2px}
/* Keep the HUD clear of the on-screen touch controls: the kit publishes the space they take. */
.kit-touch-on .t2-hud-bottom{bottom:calc(10px + var(--kit-touch-bottom,0px))}
.kit-touch-on .t2-controls,.kit-touch-on .t2-vision-status{display:none}
.kit-touch-on .t2-message{bottom:calc(100px + var(--kit-touch-bottom,0px))}
.kit-touch-on .t2-demo-label{bottom:calc(80px + var(--kit-touch-bottom,0px))}
.kit-touch-on .t2-toast{top:max(80px,var(--kit-touch-top,0px))}
@media(max-width:560px){.t2-intro .t2-actions{flex-wrap:wrap}#t2-ui .t2-primary{min-width:0}.t2-top-right{flex-wrap:wrap;justify-content:flex-end}.t2-settings-panel{left:12px;right:12px;width:auto}.t2-pause-box{padding:24px}}

@media(prefers-reduced-motion:reduce){#t2-ui *{transition:none!important}}
`;
const html = `
<div class="t2-shade"></div><div class="t2-scan"></div><div class="t2-damage"></div>
<header class="t2-top"><div class="t2-brand"><div class="t2-mark">T2</div><div class="t2-brand-text"><b>CYBERDYNE SYSTEMS</b>STRATA / FIRST PERSON</div></div><div class="t2-top-right"><span class="t2-status">BUILD 02 / OFFLINE</span><button class="t2-small-btn" id="t2-vision-button" title="T-800 vision (Tab)">TAB / VISION</button><button class="t2-small-btn" id="t2-mute" title="Mute sound (M)">SOUND ON</button><button class="t2-small-btn" id="t2-settings">SETTINGS</button><button class="t2-small-btn" id="t2-full" title="Full screen">⛶</button><button class="t2-small-btn t2-hide" id="t2-pause-button">PAUSE</button></div></header>
<section class="t2-intro"><div class="t2-kicker">TERMINATOR 2 / FAN SCENE</div><h1>CYBERDYNE<span>STANDOFF</span></h1><div class="t2-subtitle">FIRST-PERSON / ENDLESS RESPONSE</div><p>Clear the first police line as the T-800.<br>Then hold the balcony against harder waves.<br><span id="t2-scan-hint">Press Tab to scan.</span> Keep every officer alive.</p><div class="t2-actions"><button class="t2-primary" id="t2-begin">▶ &nbsp; Begin scene</button><button class="t2-secondary t2-hide" id="t2-continue">Continue</button><button class="t2-secondary" id="t2-watch">Watch sequence ↗</button></div><div class="t2-intro-links"><button class="t2-link t2-hide" id="t2-workbench">Open the Strata workbench ↗</button><button class="t2-link" id="t2-intro-settings">Settings</button></div><div class="t2-best t2-hide" id="t2-best"></div><div class="t2-features"><span><b>TAB</b>T-800 VISION</span><span><b>∞</b>POLICE WAVES</span><span><b>00</b>CASUALTIES</span></div></section>
<div class="t2-warning"><strong>MODEL 101 / ACTIVE</strong>MISSION PARAMETER<br><i>HUMAN CASUALTIES: 0</i><br><br>Keyboard and mouse, gamepad or touch.<br>Contains flashing lights and gunfire.</div>
<footer class="t2-bottom"><span>BUILT IN STRATA &nbsp; / &nbsp; PROCEDURAL 3D</span><span>UNOFFICIAL FAN RECREATION &nbsp; · &nbsp; NO FILM AUDIO</span></footer>
<div class="t2-playhud t2-hide"><div class="t2-objective"><div class="t2-label">01 / HOLD THE BALCONY</div><h2>Clear the police line.</h2><p>Disable the vehicles. Let the officers withdraw.</p></div><div class="t2-counts"><div><div class="t2-label">VEHICLES DISABLED</div><strong id="t2-car-count">00 <small>/ 08</small></strong></div><div><div class="t2-label">HUMAN CASUALTIES</div><strong class="t2-zero">00</strong></div></div><div class="t2-progress"><span class="t2-label" id="t2-safe-count">OFFICERS WITHDRAWN / 00 OF 16</span><div class="t2-bar"><i id="t2-safe-bar" style="width:0"></i></div></div><div class="t2-targets"></div><canvas class="t2-machine-layer" aria-label="Live target tracks and contact display"></canvas>
<div class="t2-wave-strip"><span id="t2-wave-state">SCENE 01</span><span id="t2-wave-score">SCORE / 0</span><strong id="t2-wave-live">08 VEHICLES ACTIVE</strong></div>
<section class="t2-vision-panel t2-hide"><header>T-800 / MODEL 101</header><div class="t2-v-label">VISUAL ANALYSIS</div><strong id="t2-v-target">SEARCHING</strong><dl><dt>CLASS</dt><dd id="t2-v-class">—</dd><dt>RANGE</dt><dd id="t2-v-range">—</dd><dt>STATE</dt><dd id="t2-v-state">—</dd><dt>CONDITION</dt><dd id="t2-v-condition">—</dd></dl><small id="t2-v-analysis">WAITING FOR TARGET</small><div class="t2-bar"><i id="t2-v-progress" style="width:0"></i></div><footer id="t2-v-help">Keep a target in the reticle to identify it.</footer></section>
<div class="t2-vision-status t2-hide">NEURAL NET / READ-WRITE<br>HUMAN PROTECTION / ACTIVE<br><span id="t2-v-lock-state">TARGET LOCK / NONE</span></div>
<div class="t2-wave-banner t2-hide"><div class="t2-label" id="t2-break-label">LINE CLEAR</div><h2 id="t2-break-title">REINFORCEMENTS IN 10</h2><p id="t2-break-text"></p></div><div class="t2-alert t2-hide" id="t2-threat-alert"></div><div class="t2-reticle"><i></i></div><div class="t2-hud-bottom"><div class="t2-integrity"><div class="t2-label">T-800 / SYSTEM INTEGRITY</div><div class="t2-number"><span id="t2-health">100</span><small>%</small></div><div class="t2-bar"><i id="t2-health-bar" style="width:100%"></i></div></div><div class="t2-weapon"><div class="t2-label">MINIGUN / ROTARY SYSTEM</div><div class="t2-number"><span id="t2-ammo">1600</span><small>ROUNDS</small></div><div class="t2-heat"><span id="t2-heat-label">HEAT</span><div class="t2-bar"><i id="t2-heat-bar" style="width:0"></i></div></div></div></div><div class="t2-message t2-hide"></div><div class="t2-demo-label t2-hide">FIRST-PERSON DEMO</div><div class="t2-controls" id="t2-controls"></div></div>
<div class="t2-pause t2-hide"><div class="t2-pause-box"><div class="t2-kicker" id="t2-pause-kicker">SIMULATION PAUSED</div><h2 id="t2-pause-title">Scene paused.</h2><p id="t2-pause-text">The scene is stopped. Resume when you are ready.</p><div class="t2-result t2-hide"><div><div class="t2-label">CASUALTIES</div><strong>0</strong></div><div><div class="t2-label">VEHICLES</div><strong id="t2-result-cars">8</strong></div><div><div class="t2-label">TIME</div><strong id="t2-result-time">0:00</strong></div><div><div class="t2-label">SCORE</div><strong id="t2-result-score">0</strong></div></div><p class="t2-best-line t2-hide" id="t2-best-line"></p><div class="t2-actions"><button class="t2-primary" id="t2-resume">▶ &nbsp; Resume</button><button id="t2-restart">Restart</button><button id="t2-open-settings">Settings</button><button id="t2-menu">Main menu</button><button class="t2-hide" id="t2-edit">Back to Strata</button></div></div></div>
<div class="t2-settings-panel t2-hide"><h3>Scene settings</h3><label>Sound volume <input id="t2-volume" type="range" min="0" max="1" step=".01" aria-label="Sound volume"></label><label>Mute sound <input id="t2-muted" type="checkbox"></label><label>Mouse lock <input id="t2-lock" type="checkbox" checked></label><label>Police pressure <select id="t2-pressure" aria-label="Police pressure"><option value="relaxed">Relaxed</option><option value="standard">Standard</option><option value="relentless">Relentless</option></select></label><button id="t2-kit-settings" class="t2-wide">Graphics, controls and touch…</button><p id="t2-settings-help"></p><p>Police pressure sets how hard officers hit back and how often; each level keeps its own best score. Every cleared wave saves a checkpoint: Continue on the title screen picks it up. F5 saves, F8 loads. Sound is made in the browser. No network connection is needed.</p><button id="t2-settings-close" class="t2-wide">Close settings</button></div><div class="t2-toast t2-hide" role="status" aria-live="polite"></div>`;
/** Button prompts and help text for the device the player is using right now. */
const CONTROLS = {
  keyboard: [
    ['W A S D', 'Move'],
    ['MOUSE', 'Aim / fire'],
    ['TAB', 'T-800 vision'],
    ['Q', 'Lock'],
    ['CTRL', 'Cover'],
    ['R', 'Restart'],
    ['ESC / P', 'Pause'],
  ],
  gamepad: [
    ['L STICK', 'Move'],
    ['R STICK', 'Aim'],
    ['RT', 'Fire'],
    ['LT', 'Zoom / assist'],
    ['Y', 'T-800 vision'],
    ['X', 'Lock'],
    ['B', 'Cover'],
    ['START', 'Pause'],
  ],
  touch: [
    ['STICK', 'Move'],
    ['DRAG', 'Aim'],
    ['FIRE', 'Fire'],
    ['VISION', 'T-800 vision'],
    ['LOCK', 'Lock'],
    ['CROUCH', 'Cover'],
    ['II', 'Pause'],
  ],
};
const HELP = {
  keyboard:
    'Move the mouse to turn. Without mouse lock, use the arrow keys when the pointer reaches an edge. Hold the right mouse button to zoom. Hold Control or C to crouch behind cover. Press Tab (or V) for T-800 vision, scan a vehicle, then press Q to lock it. Hold the right mouse button to assist aim. Press Q again to release the target. R restarts, M mutes.',
  gamepad:
    'Left stick moves, right stick turns. RT fires. Hold LT to zoom and assist aim. Hold B to crouch behind cover. Y starts T-800 vision: scan a vehicle, then press X to lock it. Start pauses. The D-pad and A work every menu.',
  touch:
    'Move with the stick and drag anywhere else to turn. Hold Fire to spin up the minigun. Hold Aim to zoom and assist aim, Crouch to take cover. Vision starts the T-800 scan: scan a vehicle, then tap Lock. II pauses.',
};
const SCAN_HINT = { keyboard: 'Press Tab to scan.', gamepad: 'Press Y to scan.', touch: 'Tap Vision to scan.' };
const pad2 = (n) => String(n).padStart(2, '0');

export function installUI(host, { studio = false } = {}) {
  const kit = host.kit;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
  const root = document.createElement('div');
  root.id = 't2-ui';
  root.innerHTML = html;
  host.canvas.parentElement.append(root);
  let hasBegun = false,
    toastTimer = 0,
    active = false,
    showSettings = false,
    restarting = false,
    lockedByUs = false,
    helpSource = '';
  const q = (s) => root.querySelector(s),
    id = (s) => q('#t2-' + s),
    visible = (s, v) => q(s).classList.toggle('t2-hide', !v);
  const on = (s, fn) => id(s).addEventListener('click', fn),
    isScene = () => host.manifest?.id === 'cyberdyne';
  const source = () => (CONTROLS[kit.input.source] ? kit.input.source : 'keyboard');
  const L = (action) => host.input.label(action);
  const vision = new VisionUI(root);
  // Per-frame HUD writes only touch the DOM when a value changes.
  const text = (el, v) => {
    v = String(v);
    if (el._t !== v) {
      el._t = v;
      el.textContent = v;
    }
  };
  const markup = (el, v) => {
    if (el._h !== v) {
      el._h = v;
      el.innerHTML = v;
    }
  };
  const css1 = (el, prop, v) => {
    const k = '_s' + prop;
    if (el[k] !== v) {
      el[k] = v;
      el.style[prop] = v;
    }
  };
  // classList.toggle with a force argument leaves the element alone when nothing changes.
  const flag = (el, cls, v) => el.classList.toggle(cls, !!v);
  const show = (el, v) => el.classList.toggle('t2-hide', !v);
  const el = {
    intro: q('.t2-intro'),
    pause: q('.t2-pause'),
    pauseBox: q('.t2-pause-box'),
    settings: q('.t2-settings-panel'),
    toast: q('.t2-toast'),
    message: q('.t2-message'),
    damage: q('.t2-damage'),
    reticle: q('.t2-reticle'),
    objLabel: q('.t2-objective .t2-label'),
    objTitle: q('.t2-objective h2'),
    objText: q('.t2-objective p'),
    carCount: id('car-count'),
    safeCount: id('safe-count'),
    safeBar: id('safe-bar'),
    health: id('health'),
    healthBar: id('health-bar'),
    ammo: id('ammo'),
    heatBar: id('heat-bar'),
    heatLabel: id('heat-label'),
    visionButton: id('vision-button'),
    visionPanel: q('.t2-vision-panel'),
    visionStatus: q('.t2-vision-status'),
    demo: q('.t2-demo-label'),
    waveState: id('wave-state'),
    waveScore: id('wave-score'),
    waveLive: id('wave-live'),
    banner: q('.t2-wave-banner'),
    breakLabel: id('break-label'),
    breakTitle: id('break-title'),
    breakText: id('break-text'),
    alert: id('threat-alert'),
    vTarget: id('v-target'),
    vClass: id('v-class'),
    vRange: id('v-range'),
    vState: id('v-state'),
    vCondition: id('v-condition'),
    vAnalysis: id('v-analysis'),
    vProgress: id('v-progress'),
    vHelp: id('v-help'),
    vLock: id('v-lock-state'),
    controls: id('controls'),
    help: id('settings-help'),
    scanHint: id('scan-hint'),
    featureKey: q('.t2-features b'),
    mute: id('mute'),
  };
  const toast = (t) => {
    el.toast.textContent = t;
    el.toast.classList.remove('t2-hide');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.add('t2-hide'), 4000);
  };
  const formatTime = (t) => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
  const pressureKey = () => (PRESSURE[host.settings.t2Pressure] ? host.settings.t2Pressure : 'standard');

  /** Mouse lock for keyboard and mouse players (a pad or touch player turns without it). */
  function capture() {
    const e = host.experience;
    if (host.settings.mouseLock === false || !e || e.demo || kit.input.source !== 'keyboard') return;
    lockedByUs = true;
    kit.input.lockPointer();
  }
  async function begin(demo = false) {
    if (!isScene() || host.busy) return;
    host.audio.unlock();
    if (host.status === 'edit') await host.load('cyberdyne', { mode: 'play', ready: true });
    const e = host.experience;
    if (!isScene() || !e || e.failed) return;
    closeSettings();
    e.demo = demo;
    e.cameraMode = 1;
    hasBegun = true;
    if (!demo) capture();
    await host.play();
    host.canvas.focus({ preventScroll: true });
    renderMode();
  }
  async function resume() {
    const e = host.experience;
    if (!isScene() || !e || e.failed || host.busy || !['paused', 'ready'].includes(host.status)) return;
    closeSettings();
    hasBegun = true;
    if (!e.demo) capture();
    await host.play();
    host.canvas.focus({ preventScroll: true });
    renderMode();
  }
  async function restart(menu = false) {
    if (restarting || host.busy || !isScene()) return;
    restarting = true;
    try {
      closeSettings();
      if (document.pointerLockElement) document.exitPointerLock();
      const demo = !!host.experience?.demo;
      hasBegun = false;
      await host.restart();
      if (!isScene() || !host.experience) return;
      host.experience.demo = false;
      if (!menu) await begin(demo);
      renderMode();
    } finally {
      restarting = false;
    }
  }
  /** The latest wave checkpoint of this scene, if it can be continued. */
  function savedRun() {
    const info = host.checkpointInfo();
    const local = info?.experience === 'cyberdyne' ? info.local : null;
    return local && local.failed !== true && Number.isSafeInteger(local.wave) ? local : null;
  }
  async function continueRun() {
    if (host.busy || !savedRun()) return;
    host.audio.unlock();
    closeSettings();
    const ok = await host.loadCheckpoint();
    if (ok && isScene() && host.status === 'ready' && host.experience && !host.experience.failed) await resume();
  }
  function refreshTitle() {
    const run = savedRun();
    show(id('continue'), !!run);
    if (run) {
      const wave = run.phase === 'intermission' ? run.wave + 1 : run.wave;
      text(id('continue'), wave > 0 ? `Continue / wave ${wave}` : 'Continue');
    }
    const best = host.experience?.best;
    const pressure = PRESSURE[host.experience?.pressure || pressureKey()];
    show(id('best'), !!best?.score);
    if (best?.score)
      text(id('best'), `BEST / ${best.score.toLocaleString()} POINTS · WAVE ${best.wave}${pressure.label === 'Standard' ? '' : ' · ' + pressure.label.toUpperCase()}`);
  }
  /** Controls bar, settings help and the title hints follow the input device. */
  function renderHelp(force = false) {
    const src = source();
    if (!force && src === helpSource) return;
    helpSource = src;
    el.controls.innerHTML = CONTROLS[src].map(([k, label]) => `<span><kbd>${k}</kbd>${label}</span>`).join('');
    el.help.textContent = HELP[src];
    el.scanHint.textContent = SCAN_HINT[src];
    el.featureKey.textContent = L('scan');
    text(el.visionButton, `${L('scan')} / VISION${isScene() && host.experience?.scan ? ' ON' : ''}`);
  }
  function openSettings() {
    if (host.status === 'play') host.pause();
    showSettings = true;
    el.settings.classList.remove('t2-hide');
    id('volume').value = host.settings.volume;
    id('muted').checked = !!host.settings.muted;
    id('lock').checked = host.settings.mouseLock !== false;
    id('pressure').value = pressureKey();
    renderHelp(true);
  }
  function closeSettings() {
    if (!showSettings) return;
    showSettings = false;
    el.settings.classList.add('t2-hide');
    kit.input.settle();
  }
  function syncSound() {
    el.mute.textContent = host.settings.muted ? 'SOUND OFF' : 'SOUND ON';
    id('muted').checked = !!host.settings.muted;
  }
  function setMuted(muted) {
    host.settings.muted = muted;
    host.settingsChanged();
    syncSound();
  }
  function renderMode() {
    active = isScene() && (!studio || host.status !== 'edit');
    root.classList.toggle('t2-hide', !active);
    document.body.classList.toggle('t2-studio-play', studio && active);
    if (!active) {
      closeSettings();
      return;
    }
    const e = host.experience,
      playing = host.status === 'play',
      paused = host.status === 'paused',
      ready = host.status === 'ready',
      failed = !!e?.failed;
    if (playing) hasBegun = true;
    const title = ready && !hasBegun;
    root.classList.toggle('t2-live', hasBegun);
    root.classList.toggle('t2-hide-reticle', failed);
    visible('.t2-intro', title);
    visible('.t2-warning', title);
    visible('.t2-bottom', title);
    visible('.t2-playhud', hasBegun);
    visible('.t2-pause', paused || (ready && hasBegun) || failed);
    visible('#t2-pause-button', playing);
    visible('.t2-result', failed);
    visible('#t2-resume', !failed);
    visible('#t2-edit', studio);
    visible('#t2-workbench', studio);
    id('pause-kicker').textContent = failed ? 'SYSTEM OFFLINE' : ready ? 'CHECKPOINT READY' : 'SIMULATION PAUSED';
    id('pause-title').textContent = failed ? 'T-800 disabled.' : ready ? 'Checkpoint loaded.' : 'Scene paused.';
    id('pause-text').textContent = failed
      ? `Wave ${e.wave}. Score ${e.score.toLocaleString()}. ${e.wavesCleared} waves cleared. Restart to play again${savedRun() ? ', or continue from your last cleared wave from the main menu' : ''}.`
      : 'Resume to continue from this position.';
    const bestLine = id('best-line');
    show(bestLine, failed && !!e?.best?.score);
    if (failed) {
      id('result-cars').textContent = e.totalVehicles;
      id('result-time').textContent = formatTime(e.time);
      id('result-score').textContent = e.score.toLocaleString();
      if (e.best?.score) bestLine.textContent = e.newBest ? 'NEW BEST SCORE' : `BEST / ${e.best.score.toLocaleString()} · WAVE ${e.best.wave}`;
    }
    visible('.t2-demo-label', !!e?.demo);
    if (title) refreshTitle();
    renderHelp();
  }
  function loaded() {
    if (isScene()) {
      hasBegun = !!host.experience.started;
      vision.lastRoster = -1;
      root.classList.toggle('scanner', !!host.experience.scan);
    }
    renderMode();
  }
  on('begin', () => void begin(false));
  on('continue', () => void continueRun());
  on('watch', () => void begin(true));
  on('resume', () => void resume());
  on('restart', () => void restart());
  on('menu', () => void restart(true));
  on('edit', () => void host.edit());
  on('workbench', () => void host.edit());
  on('pause-button', () => host.pause());
  on('vision-button', () => {
    if (host.status === 'play') {
      host.experience.toggleVision();
      host.canvas.focus({ preventScroll: true });
    } else toast(`Start or resume play, then press ${L('scan')} for T-800 vision.`);
  });
  on('mute', () => setMuted(!host.settings.muted));
  on('full', async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch {
      toast('Full screen is not available in this view.');
    }
  });
  on('settings', () => (showSettings ? closeSettings() : openSettings()));
  on('intro-settings', openSettings);
  on('open-settings', openSettings);
  on('settings-close', closeSettings);
  on('kit-settings', () => kit.menu.open());
  id('volume').addEventListener('input', (ev) => {
    host.settings.volume = +ev.target.value;
    host.settings.muted = false;
    host.settingsChanged();
    syncSound();
  });
  id('muted').addEventListener('change', (ev) => setMuted(ev.target.checked));
  id('lock').addEventListener('change', (ev) => {
    host.settings.mouseLock = ev.target.checked;
    host.settingsChanged();
  });
  id('pressure').addEventListener('change', (ev) => {
    host.settings.t2Pressure = PRESSURE[ev.target.value] ? ev.target.value : 'standard';
    host.settingsChanged();
    // A run that has not started yet takes the new pressure now; a run in progress keeps its own.
    const e = host.experience;
    if (isScene() && e && !hasBegun && !e.started) {
      e.setPressure(host.settings.t2Pressure);
      refreshTitle();
    } else if (isScene()) toast('Police pressure changes from the next start.');
  });
  host.scope.on(document, 'pointerlockchange', () => {
    if (document.pointerLockElement || !lockedByUs) return;
    lockedByUs = false;
    if (host.status === 'play' && active && isScene() && !host.experience?.demo && kit.input.source === 'keyboard') host.pause();
  });
  host.scope.own(host.events.on('status', renderMode));
  host.scope.own(host.events.on('loaded', loaded));
  host.scope.own(host.events.on('settings', syncSound));
  host.scope.own(
    host.events.on('notice', (t) => {
      if (active && !t.includes('loaded.')) toast(t);
    }),
  );
  // Esc, P, Start or the II pill while paused: close the settings panel, or resume.
  host.scope.own(
    host.events.on('resume-request', () => {
      if (!active || !isScene()) return;
      if (showSettings) closeSettings();
      else void resume();
    }),
  );
  host.scope.own(kit.input.onSourceChange(() => active && renderHelp()));
  // Gamepad (and arrow-key) navigation of this overlay's menus, driven by the workbench's MenuNav.
  host.overlay = {
    menu() {
      if (!active) return null;
      if (showSettings) return { root: el.settings, back: closeSettings };
      if (!el.pause.classList.contains('t2-hide'))
        return { root: el.pauseBox, back: host.status === 'paused' && !host.experience?.failed ? () => void resume() : null };
      if (!el.intro.classList.contains('t2-hide')) return { root: el.intro, back: null };
      return null;
    },
  };
  host.scope.own(
    host.events.on('frame', () => {
      if (!active || !isScene()) return;
      const e = host.experience;
      if (!e) return;
      const k = kit.input;
      if (k.pressed('mute')) setMuted(!host.settings.muted);
      if (showSettings && k.pressed('pause') && host.status !== 'paused') closeSettings();
      if (k.pressed('restart') && hasBegun && !showSettings && ['play', 'paused'].includes(host.status)) {
        void restart();
        return;
      }
      if (e.failed && host.status === 'play') {
        host.pause();
        renderMode();
      }
      if (!hasBegun) {
        e.setCamera();
        e.hero.root.visible = false;
        return;
      }
      let disabled = 0,
        safe = 0;
      for (const c of e.cars) if (c.disabled) disabled++;
      for (const o of e.officers) if (o.safe) safe++;
      markup(el.carCount, pad2(disabled) + ' <small>/ ' + pad2(e.cars.length) + '</small>');
      text(el.safeCount, 'OFFICERS WITHDRAWN / ' + pad2(safe) + ' OF ' + e.officers.length);
      css1(el.safeBar, 'width', Math.round((safe / Math.max(1, e.officers.length)) * 1000) / 10 + '%');
      text(el.health, Math.ceil(e.integrity));
      css1(el.healthBar, 'width', Math.round(e.integrity * 10) / 10 + '%');
      text(el.ammo, e.ammo);
      css1(el.heatBar, 'width', Math.round(e.heat) + '%');
      text(el.heatLabel, e.overheated ? 'COOLING' : 'HEAT');
      css1(el.damage, 'opacity', String(Math.round(Math.min(0.85, e.hurt * 3) * 100) / 100));
      flag(root, 'scanner', e.scan);
      flag(el.visionButton, 'vision-on', e.scan);
      text(el.visionButton, `${L('scan')} / VISION${e.scan ? ' ON' : ''}`);
      show(el.visionPanel, e.scan);
      show(el.visionStatus, e.scan);
      flag(el.reticle, 'hit', e.hit > 0);
      flag(el.reticle, 'safe', e.heldSafe);
      const msg = e.heldSafe
        ? 'HUMAN DETECTED / FIRE BLOCKED'
        : e.overheated
          ? 'BARRELS COOLING / RELEASE FIRE'
          : e.beltTimer > 0
            ? 'FEEDING NEW BELT'
            : e.messageTime > 0
              ? e.message
              : disabled === e.cars.length && e.phase !== 'intermission'
                ? 'HOLD FIRE / OFFICERS WITHDRAWING'
                : '';
      text(el.message, msg);
      show(el.message, !!msg && !e.failed);
      show(el.demo, e.demo);
      const between = e.phase === 'intermission',
        plan = e.currentPlan;
      text(el.objLabel, e.wave === 0 ? 'SCENE 01 / ORIGINAL STANDOFF' : `WAVE ${pad2(e.wave)} / ${(plan?.name || 'POLICE RESPONSE').toUpperCase()}`);
      text(el.objTitle, between ? 'Police line clear.' : e.wave === 0 ? 'Clear the police line.' : 'Hold the balcony.');
      text(el.objText, e.wave === 0 ? 'Disable the vehicles. Let the officers withdraw.' : 'Disable each vehicle. Suppress the officers. Use cover.');
      text(el.waveState, between ? 'NEXT WAVE / ' + Math.ceil(e.intermission) + ' S' : e.wave === 0 ? 'SCENE 01' : `WAVE ${e.wave} / ENDLESS`);
      text(el.waveScore, 'SCORE / ' + e.score.toLocaleString());
      text(el.waveLive, e.inCover ? 'COVER POSITION' : e.cars.length - disabled + ' VEHICLES ACTIVE');
      show(el.banner, between && !e.failed);
      if (between) {
        text(el.breakLabel, e.wave === 0 ? 'ORIGINAL SCENE COMPLETE / NO CASUALTIES' : 'WAVE CLEAR / SYSTEM REPAIR +28% / AMMO REFILLED');
        text(el.breakTitle, 'WAVE ' + (e.wave + 1) + ' IN ' + Math.ceil(e.intermission));
        text(el.breakText, wavePlan(e.wave + 1).notice);
      }
      const warning = e.integrity < 25 ? 'SYSTEM DAMAGE / MOVE TO COVER' : e.warning;
      text(el.alert, warning);
      show(el.alert, !!warning && !between && !e.failed);
      if (e.scan) {
        const unit = e.focus,
          known = unit && e.identified.has(unit.data.id),
          human = unit?.kind === 'human';
        text(
          el.vTarget,
          e.scanBoot ? 'VISION STARTING' : unit ? (human ? OFFICERS[unit.officerType].name : VEHICLES[unit.vehicleType].name).toUpperCase() : 'SEARCHING',
        );
        text(el.vClass, unit ? (human ? 'HUMAN' : unit.vehicleType === 'helicopter' ? 'AIR VEHICLE' : 'GROUND VEHICLE') : '—');
        text(el.vRange, unit ? Math.hypot(...e.center(unit).map((v, i) => v - e.eye()[i])).toFixed(1) + ' M' : '—');
        text(
          el.vState,
          unit
            ? human
              ? unit.mode === 'run'
                ? 'WITHDRAWING'
                : unit.charge > 0
                  ? 'AIMING'
                  : 'ACTIVE'
              : unit.disabled
                ? 'DISABLED'
                : unit.vehicleType === 'helicopter'
                  ? 'TRACKING'
                  : unit.arrived
                    ? 'IN POSITION'
                    : 'APPROACHING'
            : '—',
        );
        text(el.vCondition, unit ? (human ? 'PROTECTED' : known ? Math.ceil((unit.hp / unit.maxHP) * 100) + '%' : 'SCANNING') : '—');
        const pct = known ? 100 : Math.round((e.focusTime / 0.65) * 100);
        text(el.vAnalysis, known ? 'ANALYSIS COMPLETE' : unit ? 'ANALYSIS / ' + pct + '%' : 'WAITING FOR TARGET');
        css1(el.vProgress, 'width', pct + '%');
        text(
          el.vHelp,
          human
            ? 'Human protection is active. Fire and target lock are blocked.'
            : unit?.disabled
              ? 'Vehicle disabled. Select another target.'
              : e.lockID
                ? `Target lock is active. Hold ${L('aim')} to assist aim.`
                : known
                  ? `Drive module identified: 2.35× damage. Press ${L('lock')} to lock this vehicle.`
                  : 'Keep a vehicle in the reticle to scan its drive module.',
        );
        text(el.vLock, e.lockID ? 'TARGET LOCK / ACTIVE' : 'TARGET LOCK / NONE');
      }
      vision.draw(e);
    }),
  );
  host.scope.own(() => {
    clearTimeout(toastTimer);
    root.remove();
    style.remove();
    document.body.classList.remove('t2-studio-play');
    if (host.overlay?.menu) host.overlay = null;
  });
  syncSound();
  if (isScene()) loaded();
  return { begin, restart, resume, root };
}
