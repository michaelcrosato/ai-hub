/* Crown & Clay — the interface: HUD, panels, map input and the game loop.
   Boots through the shared kit (three.js r186, WebGPU with WebGL2 fallback) and
   routes keyboard, mouse, touch and gamepad through kit.input actions. */
import * as THREE from 'three/webgpu';
import { boot } from 'kit/boot.js';
import { createPost } from 'kit/post.js';
import { MOUSE_LOOK, TOUCH_LOOK } from 'kit/input.js';
import * as ENGINE from './engine.js';
import { WorldView } from './world.js';

const { Game, TECHS, UNITS, BUILDS, TERRAIN, FACTIONS, DIFFICULTY, W, H, MAX_TURNS, dist, clamp } = ENGINE;
const $ = (id) => document.getElementById(id), esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ICONS = {
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4.2 4.2l2.1 2.1m11.4 11.4 2.1 2.1M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
 crown:'<path d="m3 6 4 5 5-8 5 8 4-5-2 13H5L3 6Z"/><path d="M6 16h12"/>',
 coin:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="5.5"/><path d="M14 8h-3a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4h-3m2-9v10"/>',
 flask:'<path d="M9 3h6m-5 0v7L5 18a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-8V3M8 14h8"/><path d="M9 18h.01M13 16h.01"/>',
 culture:'<path d="M12 3 14 8l6 1-4 4 1 6-5-3-5 3 1-6-4-4 6-1 2-5Z"/>',
 star:'<path d="m12 2 2.9 6.1 6.6 1-4.8 4.7 1.2 6.6-5.9-3.1-5.9 3.1 1.2-6.6L2.5 9.1l6.6-1L12 2Z"/>',
 flag:'<path d="M5 22V3m0 1c5-5 9 5 15 0v10c-6 5-10-5-15 0M2 22h6"/>',
 wheat:'<path d="M12 22V3m0 14c-5 0-7-3-7-5 4 0 7 1 7 5Zm0-6C7 11 5 8 5 6c4 0 7 1 7 5Zm0 3c5 0 7-3 7-5-4 0-7 1-7 5Zm0-6c5 0 6-3 6-5-4 0-6 1-6 5Z"/>',
 pick:'<path d="m5 21 12-17M9 3c6-1 10 3 12 8M7 5l3-3"/>',
 hammer:'<path d="m5 21 10-12m-6-5 4-3 8 7-4 4-8-8Z"/>',
 shield:'<path d="m12 2 8 3v7c0 5-8 10-8 10S4 17 4 12V5l8-3Z"/><path d="M12 5v13M7 10h10"/>',
 sword:'<path d="m4 20 12-12m-6 1 9-7 3 1-1 3-8 7M6 11l7 7M2 18l4 4"/>',
 compass:'<circle cx="12" cy="12" r="9"/><path d="m16 7-2 7-7 3 3-7 6-3Z"/><path d="m10 10 4 4"/>',
 book:'<path d="M12 5C9 2 5 2 2 3v16c4-1 7-1 10 2m0-16c3-3 7-3 10-2v16c-4-1-7-1-10 2V5Z"/><path d="M5 7h3m-3 4h3m8-4h3m-3 4h3"/>',
 wall:'<path d="M3 4h4v4h3V4h4v4h3V4h4v17H3V4Z"/><path d="M3 13h18M8 8v5m8 0v8M9 13v8"/>',
 jar:'<path d="M8 3h8M9 3v4c-9 6-6 14 3 14s12-8 3-14V3M5 12h14m-14 4h14"/>',
 obelisk:'<path d="m9 18 1-12 2-4 2 4 1 12M7 18h10v3H7v-3Z"/>',
 sunspire:'<path d="M9 19V8l3-6 3 6v11M6 19h12v3H6v-3ZM12 8v8M3 7l2 2m14 0 2-2M2 13h3m14 0h3"/>',
 gear:'<path d="m9 3 6 0 1 3 3 1 2 5-2 4-3 1-1 4H9l-1-4-3-1-2-4 2-5 3-1 1-3Z"/><circle cx="12" cy="12" r="3"/>',
 home:'<path d="m2 11 10-9 10 9M5 9v12h14V9m-10 12v-8h6v8"/>',
 city:'<path d="M2 21h20M4 21V8h6v13m0-16 5-3 5 3v16M6 11h2m-2 4h2m5-7h4m-4 4h4m-4 4h4"/>',
 council:'<path d="M3 11V6l4-3 5 2 5-2 4 3v5m-19 2 4-3 6 5-4 5-6-7Zm20 0-4-3-6 5 4 5 6-7ZM9 4l-3 4 5 4 5-4-3-3M8 20l3 2 5-2"/>',
 units:'<circle cx="8" cy="6" r="3"/><path d="M2 20v-4c0-6 12-6 12 0v4M16 4a3 3 0 0 1 0 6m2 3c3 1 4 3 4 7"/>',
 heart:'<path d="M12 21 3 12c-6-6 3-13 9-6 6-7 15 0 9 6l-9 9Z"/>',
 boot:'<path d="M6 3h7v9l7 3v5H3v-6l3-3V3Zm0 4h5m-5 3h5M3 17h17"/>',
 hourglass:'<path d="M5 2h14M5 22h14M7 2v5l5 5-5 5v5m10-20v5l-5 5 5 5v5"/>',
 check:'<path d="m4 12 5 5L20 6"/>',
 circle:'<circle cx="12" cy="12" r="8"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',minus:'<path d="M5 12h14"/>',
 arrow:'<path d="M3 12h17m-6-6 6 6-6 6"/>',chevron:'<path d="m9 5 7 7-7 7"/>',
 close:'<path d="m6 6 12 12M6 18 18 6"/>',menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
 help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4 3c-1 .5-1 1-1 2m0 3h.01"/>',
 rotate:'<path d="M4 9a8 8 0 1 1 0 7M4 3v6h6"/>',grid:'<rect x="3" y="3" width="18" height="18" rx="1"/><path d="M9 3v18m6-18v18M3 9h18M3 15h18"/>',
 road:'<path d="m5 22 3-20m11 20L16 2M12 4v3m0 3v4m0 4v3"/>',target:'<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3"/>',
 lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v2"/>',
 sound:'<path d="m3 9 5 0 5-5v16l-5-5H3V9Zm13-2c4 2 4 8 0 10m3-13c6 4 6 12 0 16"/>',
 save:'<path d="M4 3h13l4 4v14H3V3h1Zm3 0v7h10V3M7 21v-7h10v7"/>',
 export:'<path d="M12 3v13m-5-5 5 5 5-5M4 16v5h16v-5"/>',import:'<path d="M12 17V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
 leaf:'<path d="M19 3C2 1 1 12 6 17s17 1 13-14ZM4 21 16 7M8 17V9m0 5h6"/>',
 trophy:'<path d="M7 3h10v7a5 5 0 0 1-10 0V3Zm0 2H3v4c0 3 3 4 5 4m9-8h4v4c0 3-3 4-5 4m-4 2v5m-5 1h10"/>',
 map:'<path d="m3 5 6-3 6 3 6-3v17l-6 3-6-3-6 3V5Zm6-3v17m6-14v17"/>',
 eye:'<path d="M2 12c5-9 15-9 20 0-5 9-15 9-20 0Z"/><circle cx="12" cy="12" r="3"/>',
 pad:'<path d="M7 8h10a5 5 0 0 1 4.8 6.4l-1 3.4a2.5 2.5 0 0 1-4.3.9L14 16h-4l-2.5 2.7a2.5 2.5 0 0 1-4.3-.9l-1-3.4A5 5 0 0 1 7 8Z"/><path d="M7 11v3m-1.5-1.5h3M16 11.5h.01M18 13.5h.01"/>'
};
function icon(name, cls = '') { return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.star}</svg>`; }
document.querySelectorAll('[data-icon]').forEach((n) => (n.innerHTML = icon(n.dataset.icon)));
function portrait(type='settler',owner=0){const color=FACTIONS[owner]?.color||'#77634a';if(type==='city')return `<svg viewBox="0 0 80 80" aria-hidden="true"><path fill="#aab78d" d="M7 56 40 37l33 19-33 19Z"/><path fill="#c9bc92" d="M20 38 40 26l20 12v22L40 71 20 60Z"/><path fill="#e4d8b5" d="M20 38 40 49v22L20 60Z"/><path fill="#b8ae8d" d="M40 49 60 38v22L40 71Z"/><path fill="#b37150" d="m17 38 23-22 23 22-23 13Z"/><path fill="#ca8e63" d="m17 38 23-22v35Z"/><path fill="#536958" d="m29 51 8 5v13l-8-5Z"/><path stroke="#8a8457" stroke-width="1.5" d="M47 35V6"/><path fill="${color}" d="M48 7 65 11l-5 9-12-3Z"/></svg>`;
 if(type==='terrain')return `<svg viewBox="0 0 80 80" aria-hidden="true"><path fill="#799966" d="m6 60 31-23 38 20-32 20Z"/><path fill="#a5b88a" d="m28 54 16-32 23 40Z"/><path fill="#d9dbc1" d="m38 34 6-12 11 19-12-6Z"/><path fill="#567b55" d="M10 55 26 19l15 36Z"/><path fill="#688d59" d="M14 38 26 9l12 29Z"/><path fill="#928164" d="M24 54h5v11h-5Z"/></svg>`;
 return `<svg viewBox="0 0 80 80" aria-hidden="true"><path fill="#9eaf84" d="m4 73 37-13 36 13H4Z"/><path fill="#615d48" d="M25 61h12v18H25Zm19 0h12v18H44Z"/><path fill="${color}" d="m24 34 18-5 17 6 3 32H20Z"/><path fill="#dfb987" d="m25 9 17-5 15 7v21l-15 9-17-9Z"/><path fill="#c9a279" d="m42 4 15 7v21l-15 9V4Z"/><path fill="#394f40" d="M30 20h3v3h-3Zm17 0h3v3h-3Z"/><path fill="#a78662" d="M36 31h10v2H36Z"/>${type==='warrior'||type==='spearman'?`<path fill="#baa572" d="m22 11 4-9h29l6 9-3 9H23Z"/><path fill="#b87650" d="M37 0h12v9H37Z"/><path fill="#d2bd8d" d="M7 42h22v19L18 71 7 61Z"/><path fill="${color}" d="M10 45h16v14l-8 8-8-8Z"/><path stroke="#a99264" stroke-width="3" d="M68 73V15"/><path fill="#d8dac8" d="m64 18 4-12 5 12Z"/>`:type==='scout'?`<path fill="#809364" d="m17 15 26-14 20 14-19 4Z"/><path fill="#dac79b" d="m46 5 17-4-10 11Z"/><path stroke="#978259" stroke-width="3" d="M67 74V24"/>`:type==='worker'?`<path fill="#c8b889" d="m18 12 9-10h28l8 13-21 3Z"/><path fill="#ad946a" d="M27 45h26v26H27Z"/><path stroke="#846f4f" stroke-width="4" d="m65 76-2-40"/><path stroke="#7d8d82" stroke-width="5" d="m54 36 22 8"/>`:`<path fill="#c8b789" d="m19 14 9-13h26l9 13-21 5Z"/><path fill="#b2986a" d="M11 35h12v30H11Z"/><path stroke="#9d8659" stroke-width="2" d="M67 76V8"/><path fill="${color}" d="M68 9 79 13v15l-11-5Z"/>`}</svg>`;
}
function ruler(o){return `<svg viewBox="0 0 70 80" aria-hidden="true"><path fill="${o===1?'#c29e65':'#9eafb3'}" d="M0 80V65l16-18h38l16 18v15Z"/><path fill="${FACTIONS[o].color}" d="m11 80 8-33 16 12 16-12 8 33Z"/><path fill="${o===1?'#ce9b70':'#ac9879'}" d="m19 17 16-8 17 9v26L35 57 19 44Z"/><path fill="${o===1?'#ddab80':'#bea98b'}" d="M19 17 35 9v48L19 44Z"/><path fill="#485447" d="M26 30h3v3h-3Zm16 0h3v3h-3Z"/>${o===1?'<path fill="#665342" d="M15 46V16L24 5h22l11 13v28l-7-6V20l-15-6-13 8v18Z"/><path fill="#e0be78" d="M19 9 18 0l10 6 7-6 8 6 10-6-1 9-17 5Z"/>':'<path fill="#d6d8c6" d="M17 21 18 7 33 1l22 12v11l-18-8-20 5Z"/><path fill="#e0decb" d="m20 39 15 9 17-9-4 19-13 9-10-9Z"/><path fill="#c7b678" d="m8 79 6-18 21 12 22-12 5 18H8Z"/>'}</svg>`;}

/* ---------------------------------------------------------------- state */
let kit = null, view = null, post = null;
let game, selection, target = null, modalType = null, modalData = {}, labels = [], busy = false, lastVictory = null, saveStatus = 'Local save is ready.', previousFocus = null, loaded = false;
const settings = { audio: false, grid: false, yields: false };
try { const saved = JSON.parse(localStorage.getItem('crown-clay-settings-v1') || '{}'); for (const k of Object.keys(settings)) if (typeof saved[k] === 'boolean') settings[k] = saved[k]; } catch {}
let saveError = '';
try { const raw = localStorage.getItem('crown-clay-save-v1'); if (raw) { game = new Game(JSON.parse(raw)); loaded = true; } } catch (error) { if (error.name !== 'SecurityError') saveError = 'The previous save could not be read. A new age has begun.'; }
if (!game) game = new Game();
selection = game.cities().length ? { type: 'city', id: game.cities()[0].id } : { type: 'unit', id: game.units().find((u) => u.type === 'settler')?.id || game.units()[0]?.id };

/* ---------------------------------------------------------------- sound (all synthesised) */
class Sound {
 constructor() { this.ctx = null; this.timer = null; this.step = 0; this.paused = false; }
 start() {
  try {
   this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
   if (!this.paused) this.ctx.resume()?.catch?.(() => {});
   if (!this.timer) this.timer = setInterval(() => { if (settings.audio && !document.hidden && !this.paused) { const notes = [196, 246.94, 293.66, 329.63, 392, 440]; this.note(notes[this.step++ % notes.length], .85, .013); if (this.step % 2 === 0) this.note(notes[(this.step + 2) % notes.length] / 2, 1.8, .009); } }, 3700);
  } catch {}
 }
 pause(on) { this.paused = on; if (!this.ctx) return; try { (on ? this.ctx.suspend() : this.ctx.resume())?.catch?.(() => {}); } catch {} }
 note(freq, len = .35, vol = .025, delay = 0, type = 'triangle') {
  if (!settings.audio || this.paused) return;
  if (!this.ctx) this.start();
  if (!this.ctx) return;
  const o = this.ctx.createOscillator(), g = this.ctx.createGain(), t = this.ctx.currentTime + delay;
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .015); g.gain.exponentialRampToValueAtTime(.0001, t + len);
  o.connect(g); g.connect(this.ctx.destination); o.start(t); o.stop(t + len + .05);
 }
 cue(kind) {
  if (!settings.audio) return;
  const N = { city: [261.63, 329.63, 392], research: [329.63, 440, 659.25], victory: [261.63, 329.63, 392, 523.25], battle: [110, 82.4], turn: [220, 293.66], discovery: [392, 493.88, 587.33], diplomacy: [293.66, 369.99], danger: [196, 164.81], build: [261.63, 392], culture: [329.63, 392, 493.88] };
  (N[kind] || [392]).forEach((n, i) => this.note(n, kind === 'victory' ? .8 : .34, .025, i * .13, kind === 'battle' ? 'sawtooth' : 'triangle'));
 }
}
const sound = new Sound();
// Browsers only start audio from a gesture: any tap, click or key press unlocks it.
const unlockAudio = () => { if (settings.audio) sound.start(); };
document.addEventListener('pointerdown', unlockAudio, { passive: true });
document.addEventListener('keydown', unlockAudio);

/* ---------------------------------------------------------------- records (per device) */
const RECORDS_KEY = 'crown-clay-records-v1';
function loadRecords() { try { const r = JSON.parse(localStorage.getItem(RECORDS_KEY) || '{}'); return r && typeof r === 'object' ? r : {}; } catch { return {}; } }
function saveRecords(r) { try { localStorage.setItem(RECORDS_KEY, JSON.stringify(r)); } catch {} }
/** Record the ending once (the save remembers that it was counted) and report the best legacy for this difficulty. */
function recordEnding() {
 const end = game.s.ended; if (!end) return null;
 const rec = loadRecords(), d = game.s.difficulty || 'standard';
 rec.best = rec.best && typeof rec.best === 'object' ? rec.best : {};
 let newBest = false;
 if (!end.recorded) {
  end.recorded = true;
  rec.games = (rec.games || 0) + 1;
  if (end.winner === 0) rec.wins = (rec.wins || 0) + 1;
  const score = game.score();
  if (!rec.best[d] || score > rec.best[d].score) { rec.best[d] = { score, type: end.winner === 0 ? end.type : 'Defeat', turn: Math.min(game.s.turn, MAX_TURNS) }; newBest = true; }
  saveRecords(rec); store();
 }
 return { best: rec.best[d], newBest, diff: DIFFICULTY[d]?.name || 'Standard' };
}

/* ---------------------------------------------------------------- helpers */
function year(){let y=4000-(game.s.turn-1)*50;return y>0?`${y} BC`:`${1-y} AD`;}
function toast(text,kind='info'){const box=document.createElement('div');box.className='toast '+kind;const iname={city:'city',research:'flask',build:'hammer',discovery:'compass',battle:'sword',danger:'shield',victory:'trophy',culture:'culture',diplomacy:'council'}[kind]||'sun';box.innerHTML=`${icon(iname)}<span>${esc(text)}</span><button aria-label="Dismiss message">${icon('close')}</button>`;box.querySelector('button').onclick=()=>box.remove();$('toasts').append(box);while($('toasts').children.length>3)$('toasts').firstElementChild.remove();setTimeout(()=>{box.classList.add('fade');setTimeout(()=>box.remove(),250);},kind==='research'?7500:5400);}
function store(){try{localStorage.setItem('crown-clay-save-v1',JSON.stringify(game.s));saveStatus='Saved on this device. Export a save to keep a separate copy.';}catch{saveStatus='This browser has blocked local saves. Use Export save in the menu.';}}
function saveSettings(){try{localStorage.setItem('crown-clay-settings-v1',JSON.stringify(settings));}catch{}}
function attachGame(){game.onChange(()=>refresh(true));}
function ensureSelection(){if(selection?.type==='unit'&&!game.unit(selection.id))selection=game.cities().length?{type:'city',id:game.cities()[0].id}:game.units().length?{type:'unit',id:game.units()[0].id}:null;if(selection?.type==='city'&&!game.city(selection.id))selection=null;}
function syncSelection(){view?.setSelection(selection,target);}
function select(type,id,focus=false){target=null;selection=type==='tile'?{type,tile:id}:{type,id};ensureSelection();syncSelection();updateContext();updateLabels();if(focus&&view){const a=type==='unit'?game.unit(id):type==='city'?game.city(id):id;if(a)view.focus(a.x,a.z);}}
function refresh(rebuild=true){ensureSelection();syncSelection();const inc=game.income();$('gold-value').textContent=Math.floor(game.s.gold);$('gold-rate').textContent=(inc.gold>=0?'+':'')+inc.gold;$('science-value').textContent=inc.science;$('culture-value').textContent=game.s.culture;$('culture-rate').textContent='+'+inc.culture;$('year').textContent=year();$('turn-count').textContent=`TURN ${String(game.s.turn).padStart(2,'0')} / ${MAX_TURNS}`;
 const tech=TECHS[game.s.research],bank=game.s.researchBank[game.s.research]||0,turns=tech?Math.max(1,Math.ceil(Math.max(0,tech.cost-bank)/Math.max(1,inc.science))):0;
 $('research-card').innerHTML=`<div class="research-top"><span class="research-emblem">${icon(tech?.icon||'flask')}</span><div><div class="kicker">${tech?'Now researching':'An age of knowledge'}</div><div class="research-title">${tech?.name||'All paths discovered'}</div></div><span class="research-turns">${tech?(inc.science?turns+' turns':'Found a city'):icon('check')}</span>${icon('chevron','research-arrow')}</div><div class="research-bottom"><span>${tech?`${bank} / ${tech.cost} science`:'The future belongs to you'}</span><span>${inc.science?'+'+inc.science+' each turn':'Knowledge starts at home'}</span></div><div class="progress blue-progress"><i style="width:${tech?Math.min(100,bank/tech.cost*100):100}%"></i></div>`;
 const goals=[game.cities().length>0,game.s.ruins>0,game.s.techs.length>0,game.cities().length>=2],next=goals.findIndex(v=>!v),chapters=[['A place to begin.','Found a capital beside the river. A good home is the start of a great story.'],['Beyond the familiar.','Send your scout into the unknown. Ancient ruins may hold a useful gift.'],['An age of ideas.','End turns to gather science. Your first discovery will unlock new choices.'],['Room to grow.','Train a settler. Found a second city at least 3 tiles from any other city.'],['Make your mark.','Build the Sunspire, take both rival capitals, or lead the score at the end of turn 60.']];let c=chapters[next<0?4:next];
 const card=$('chapter-card'),td=game.openTiding();card.classList.toggle('tiding',!!td);card.dataset.action=td?'tiding':'journey';
 if(td)card.innerHTML=`<div class="between"><span class="kicker">A matter awaits</span><span class="chapter-number">${icon(td.icon)}</span></div><h2 class="chapter-title">${esc(td.title)}</h2><p class="chapter-copy">${esc(td.kicker)}. Open it to decide. If the turn ends first, your people choose for you.</p><div class="chapter-foot"><span class="chapter-dots">${goals.map(a=>`<i class="${a?'done':''}"></i>`).join('')}</span><span class="row">Decide ${icon('chevron')}</span></div>`;
 else card.innerHTML=`<div class="between"><span class="kicker">Your next chapter</span><span class="chapter-number">0${next<0?5:next+1}</span></div><h2 class="chapter-title">${c[0]}</h2><p class="chapter-copy">${c[1]}</p><div class="chapter-foot"><span class="chapter-dots">${goals.map(a=>`<i class="${a?'done':''}"></i>`).join('')}</span><span class="row">The path ahead ${icon('chevron')}</span></div>`;
 $('realm-dots').innerHTML=[1,2].map(o=>`<i class="${game.s.relations[o].met?'met':''} ${game.s.relations[o].status==='war'?'war':''}"></i>`).join('');let ready=game.units().filter(u=>u.moves>0&&!u.fortified&&!u.job).length;$('unit-count').textContent=ready?`${ready} ready to act`:'All orders given';$('turn-hint').textContent=game.s.ended&&!game.s.keepPlaying?'The age has ended':ready?`${ready} unit${ready===1?'':'s'} ready`:'All orders given';$('end-turn').disabled=busy;$('grid-tool').classList.toggle('active',settings.grid);updateContext();updateLabels();if(view&&rebuild)view.rebuild();drawMinimap();store();
 const events=game.events.splice(0);for(const e of events.slice(-3)){toast(e.text,e.kind);sound.cue(e.kind);}if(events.some(e=>e.kind==='danger'))kit?.input.rumble(.6,200);
 const end=game.s.ended;if(end&&!game.s.keepPlaying){const key=`${end.winner}|${end.type}|${end.text}`;if(lastVictory!==key){lastVictory=key;setTimeout(()=>openModal('victory',{record:recordEnding()}),350);}}
}
function unitStats(u){const data=UNITS[u.type];return `<div class="unit-stats"><span>${icon('boot')}${u.moves}/${data.moves}</span>${data.str?`<span>${icon('shield')}${(data.str+u.bonus).toFixed(data.str%1?1:0)}</span>`:''}<span>${icon('heart')}${u.hp}<span class="health-mini"><i style="width:${u.hp}%"></i></span></span>${u.fortified?'<span>Fortified</span>':''}</div>`;}
function updateContext(){const el=$('context');if(!selection){el.innerHTML=`<div class="context-head"><div class="portrait">${portrait('terrain')}</div><div class="context-info"><div class="kicker">The first dawn</div><h2>A world of possibilities.</h2><p class="context-note">Select a city or unit to give an order.</p></div></div><div class="context-actions"><button class="secondary" data-action="next-unit">${icon('units')}Find a unit</button><button class="primary" data-action="journey">${icon('trophy')}Victory goals</button></div>`;positionMinimap();return;}
 if(selection.type==='unit'){const u=game.unit(selection.id);if(!u)return;const d=UNITS[u.type];let buttons='',note='',extra='';
 if(target){const p=game.path(u,target.x,target.z),preview=target.visible?game.preview(u.id,target.x,target.z):null;if(preview&&preview.defender.owner!==0){const inRange=dist(u,target)<=(d.range||1),can=d.str>0&&u.moves>0&&inRange,owner=preview.defender.owner;extra=`<div class="target-info danger">${icon('sword')}<span>${esc(preview.defender.type?UNITS[preview.defender.type].name:preview.defender.name)} · ${preview.defender.hp} health<br>${preview.war?`${inRange?'Expected':'At attack range'}: −${preview.damage} enemy / −${preview.returnDamage} you`:'At peace. War must be declared before an attack.'}</span><button data-action="clear-target" aria-label="Cancel target">${icon('close')}</button></div>`;buttons=preview.war?`<button class="primary" data-action="attack" ${can?'':'disabled'}>${icon('sword')}${!d.str?'Cannot attack':!inRange?'Move closer':u.moves<=0?'Next turn':'Attack'}</button>`:`<button class="danger-btn" data-action="war-confirm" data-owner="${owner}">${icon('sword')}Declare war</button>`;note=inRange?'Tap the target again or press Attack. Damage uses unit strength, health, terrain, and fortification.':'Melee units must be on an adjacent tile. Catapults can attack from 2 tiles.';}
 else{extra=`<div class="target-info">${icon('target')}<span>${target.explored?TERRAIN[target.type].name:'Uncharted land'} · ${p?`${p.cost} movement`:'No route this turn'}</span><button data-action="clear-target" aria-label="Cancel destination">${icon('close')}</button></div>`;buttons=`<button class="primary gold-btn" data-action="move" ${p&&p.cost>0?'':'disabled'}>${icon('boot')}${p?'Move here':'Out of reach'}</button>`;note=p?'Tap the tile again or press Move here. Tap another tile to change the route.':'Forests and hills cost 2 movement. Water and mountains cannot be crossed.';}buttons+=`<button class="secondary" data-action="clear-target">Cancel</button>`;
 }else if(u.job){buttons=`<button class="primary" disabled>${icon('hammer')}Building ${u.job.kind} · ${u.job.left} turns</button><button class="secondary" data-action="stop-job">Stop</button>`;note='End turns to finish the job. This worker stays on this tile.';}
 else if(u.type==='settler'){const t=game.tile(u.x,u.z),valid=u.moves>0&&!game.s.cities.some(c=>dist(c,u)<3)&&t.owner<=0;buttons=`<button class="primary gold-btn" data-action="found" ${valid?'':'disabled'}>${icon('flag')}${game.s.everFounded?'Found city':'Found capital'}</button><button class="secondary" data-action="wait">${icon('hourglass')}Wait</button>`;note=game.s.everFounded?'New cities must be at least 3 tiles from every other city.':'This river valley is a strong site for your first city.';}
 else if(u.type==='worker'){const t=game.tile(u.x,u.z),base=u.moves>0&&t.owner===0&&!game.cityAt(u.x,u.z);buttons=`<button class="primary" data-action="improve" data-key="farm" ${base&&game.has('agriculture')&&['grass','plains','sand'].includes(t.type)&&t.improvement!=='farm'?'':'disabled'} title="A farm adds 2 food">${icon('wheat')}Farm</button><button class="secondary" data-action="improve" data-key="mine" ${base&&game.has('mining')&&(t.type==='hill'||['gold','stone'].includes(t.resource))&&t.improvement!=='mine'?'':'disabled'} title="A mine adds 2 production">${icon('pick')}Mine</button><button class="secondary mini-action" data-action="improve" data-key="road" ${base&&!t.road?'':'disabled'} aria-label="Build road" title="Build a road in 2 turns">${icon('road')}</button><button class="secondary mini-action" data-action="wait" title="Wait one turn" aria-label="Wait one turn">${icon('hourglass')}</button>`;note=game.cityAt(u.x,u.z)?'Move to a tile inside your borders. Then build an improvement.':'Farms and mines help your cities. Roads make travel faster.';}
 else{buttons=`<button class="primary" data-action="${u.type==='scout'?'explore':'fortify'}" ${u.moves<=0&&!u.fortified?'disabled':''}>${icon(u.type==='scout'?'compass':'shield')}${u.type==='scout'?'Scout ahead':u.fortified?'Wake unit':'Fortify & heal'}</button><button class="secondary" data-action="wait">${icon('hourglass')}Wait</button>`;note=u.type==='scout'?'Tap a tile to choose a route, or scout ahead automatically.':u.fortified?'This unit will rest and heal each turn. Wake it to give a move order.':'Tap a tile to move. Tap an enemy to see the attack result.';}
 el.innerHTML=`<div class="context-head"><div class="portrait">${portrait(u.type)}</div><div class="context-info"><div class="kicker">The Dawnfolk · ${u.type==='settler'?'A new beginning':u.type==='worker'?'Shape the land':u.type==='scout'?'Into the unknown':'Stand together'}</div><h2>${d.name}</h2>${unitStats(u)}</div><button class="context-close" data-action="deselect" aria-label="Clear selection">${icon('close')}</button></div>${extra}<div class="context-actions">${buttons}</div><p class="context-note">${note}</p>`;
 }else if(selection.type==='city'){const c=game.city(selection.id);if(!c)return;const y=game.yields(c),b=BUILDS[c.build],stock=c.stock[c.build]||0,turns=b.cost?Math.max(1,Math.ceil((b.cost-stock)/Math.max(1,y.prod))):0;
 el.innerHTML=`<div class="context-head"><div class="portrait">${portrait('city',c.owner)}</div><div class="context-info"><div class="kicker">${esc(FACTIONS[c.owner]?.name||'Raider hold')} · ${c.capital!==null?'Capital':'City'}</div><h2>${esc(c.name)}</h2><div class="city-yields"><span>${icon('units')}${c.pop}</span><span>${icon('wheat')}+${y.surplus}</span><span>${icon('hammer')}${y.prod}</span><span>${icon('flask')}${y.science}</span><span>${icon('heart')}${c.hp}</span></div></div><button class="context-close" data-action="deselect" aria-label="Clear selection">${icon('close')}</button></div>${c.owner===0?`<div class="project-line"><div class="between"><span class="row">${icon(b.icon)}${esc(b.name)}</span><span class="muted">${b.cost?turns+' turns':'+ '+y.prod+' gold / turn'}</span></div>${b.cost?`<div class="progress gold-progress"><i style="width:${Math.min(100,stock/b.cost*100)}%"></i></div>`:''}</div><div class="context-actions"><button class="primary" data-action="production" data-id="${c.id}">${icon('hammer')}Change production</button><button class="secondary mini-action" data-action="city-detail" data-id="${c.id}" aria-label="Manage city" title="Manage city">${icon('city')}</button></div>`:`<p class="context-note">${game.hostile(0,c.owner)?'At war. Defeat the garrison, then reduce city health to zero with a melee unit to capture it.':'At peace. Open the Council to trade or declare war.'}</p><div class="context-actions"><button class="primary" data-action="council">${icon('council')}Open Council</button><button class="secondary" data-action="next-unit">${icon('units')}Your units</button></div>`}`;
 }else{const t=selection.tile;if(!t)return;const y=game.yieldTile(t),visible=t.explored;let name=visible?TERRAIN[t.type].name:'Lands unknown',sub=visible?(t.resource?`${t.resource[0].toUpperCase()+t.resource.slice(1)} · `:'')+(t.owner<0?'Unclaimed land':FACTIONS[t.owner]?.name||'Raider land'):'A new chapter waits beyond the horizon.';
 el.innerHTML=`<div class="context-head"><div class="portrait">${portrait('terrain')}</div><div class="context-info"><div class="kicker">${visible?`Tile ${t.x+1} · ${t.z+1}`:'Explore to reveal'}</div><h2>${name}</h2><p class="tiny muted">${esc(sub)}</p></div><button class="context-close" data-action="deselect" aria-label="Clear selection">${icon('close')}</button></div>${visible?`<div class="tile-yields"><span>${icon('wheat')}${y.food} food</span><span>${icon('hammer')}${y.prod} production</span><span>${icon('coin')}${y.gold} gold</span></div>`:''}<p class="context-note">${!visible?'Send a scout to reveal this land.':t.ruin?'Ancient ruins. Move a unit here to find a gift.':t.camp?'A raider camp. Clear it with a military unit to earn 35 gold.':t.improvement?`A ${t.improvement} improves this tile. Cities work useful tiles automatically.`:t.type==='water'||t.type==='mountain'?'This terrain cannot be crossed in the First Dawn.':'Cities work the best tiles inside their borders, up to one tile per person.'}</p><div class="context-actions"><button class="primary" data-action="next-unit">${icon('units')}Choose a unit</button></div>`;
 }
 // Lift the small map when a tall selection card is open, without covering the turn buttons.
 positionMinimap();
}
function positionMinimap(){const mini=$('minimap-wrap');if(innerWidth<=720){mini.style.bottom=`calc(${Math.max(245,$('context').offsetHeight+98)}px + env(safe-area-inset-bottom))`;}else mini.style.bottom='';}
new ResizeObserver(positionMinimap).observe($('context'));window.addEventListener('resize',()=>requestAnimationFrame(positionMinimap));

/* ---------------------------------------------------------------- map picks */
/** A tap or click on the map: tapping the current move target again confirms the move or attack. */
function pickTile(t){if(busy||modalType||!t)return;const u=selection?.type==='unit'?game.unit(selection.id):null;
 if(u&&!(u.x===t.x&&u.z===t.z)){if(target&&target.x===t.x&&target.z===t.z){confirmTarget();return;}target=t;syncSelection();updateContext();return;}
 const city=game.cityAt(t.x,t.z),own=game.unitsAt(t.x,t.z).filter(a=>a.owner===0);
 if(u&&own.length>1){select('unit',own[(own.findIndex(a=>a.id===u.id)+1)%own.length].id);return;}
 if(city&&t.explored){select('city',city.id);return;}if(own.length){select('unit',own.find(a=>a.moves>0)?.id||own[0].id);return;}select('tile',t);
}
function confirmTarget(){const u=currentUnit();if(!u||!target)return;const pv=target.visible?game.preview(u.id,target.x,target.z):null;if(pv&&pv.defender.owner!==0){if(pv.war)act('attack');else toast('At peace. Declare war through the Council before you attack.');return;}act('move');}
/** Unit and city labels let pointer events through to the map (so a drag that starts on one still pans); taps find them here. */
function labelAt(x,y){for(let i=labels.length-1;i>=0;i--){const l=labels[i];if((l.type!=='unit'&&l.type!=='city')||l.vis==='hidden')continue;const b=l.el?.firstElementChild;if(!b)continue;const r=b.getBoundingClientRect();if(x>=r.left-3&&x<=r.right+3&&y>=r.top-3&&y<=r.bottom+3)return b;}return null;}
function tapAt(x,y){if(busy||modalType||!view)return;const b=labelAt(x,y);if(b){act(b.dataset.action,b.dataset);return;}pickTile(view.pick(x,y));}

/* ---------------------------------------------------------------- world labels */
const LP={x:0,y:0,visible:false},seaEl=$('sea-label'),seaPos={x:NaN,y:NaN};
function updateLabels(){if(!view)return;let html='',list=[];
 for(const c of game.s.cities){if(!game.tile(c.x,c.z).explored)continue;let key='city-'+c.id;html+=`<div class="world-label" id="${key}"><button class="city-label ${c.owner?'enemy'+c.owner:''}" data-action="select-city" data-id="${c.id}" aria-label="Select ${esc(c.name)}"><span class="population">${c.pop}</span>${c.capital!==null?icon('star','city-star'):''}<span>${esc(c.name)}</span></button></div>`;list.push({key,type:'city',id:c.id});}
 for(const u of game.s.units){if(u.owner!==0&&!game.tile(u.x,u.z).visible)continue;let key='unit-'+u.id,sel=selection?.type==='unit'&&selection.id===u.id;html+=`<div class="world-label" id="${key}"><button class="unit-label ${sel?'selected':''} ${u.owner!==0?'enemy':''} ${u.moves<=0||u.fortified?'used':''}" data-action="${u.owner===0?'select-unit':'enemy-target'}" data-id="${u.id}" aria-label="${u.owner===0?'Select':'Inspect'} ${UNITS[u.type].name}">${icon(UNITS[u.type].icon)}${u.owner===0&&u.moves>0&&!u.fortified?'<span class="ready-dot"></span>':''}${u.hp<100?`<span class="unit-hp"><i style="width:${u.hp}%"></i></span>`:''}</button></div>`;list.push({key,type:'unit',id:u.id});}
 for(const t of game.tiles){if(!t.explored)continue;if(t.ruin){const key=`ruin-${t.x}-${t.z}`;html+=`<div class="world-label" id="${key}"><span class="ruin-label">ANCIENT RUINS</span></div>`;list.push({key,type:'ruin',tile:t});}if(settings.yields&&t.type!=='water'&&t.type!=='mountain'&&!game.cityAt(t.x,t.z)){let y=game.yieldTile(t),key=`yield-${t.x}-${t.z}`;html+=`<div class="world-label" id="${key}"><span class="resource-label">${icon('wheat')}${y.food}${icon('hammer')}${y.prod}${y.gold?icon('coin')+y.gold:''}</span></div>`;list.push({key,type:'yield',tile:t});}}
 $('labels').innerHTML=html;labels=list.map(l=>({...l,el:$(l.key),x:NaN,y:NaN,vis:''}));positionLabels();}
/** Every frame: move labels with the camera, writing to the DOM only when a label actually moved. */
function positionLabels(){if(!view)return;const w=view.width,h=view.height;
 for(const l of labels){if(!l.el)continue;
  if(l.type==='unit'){const u=game.unit(l.id);if(!u)continue;const pos=view.unitPos.get(u.id);if(pos)view.projectWorld(pos[0],1.64*pos[2]+.45,pos[1],LP);else{const of=view.unitOffset(u),wp=view.world(u.x,u.z);view.projectWorld(wp[0]+of[0],1.64*of[2]+.45,wp[1]+of[1],LP);}}
  else if(l.type==='city'){const c=game.city(l.id);if(!c)continue;view.project(c.x,c.z,c.buildings.includes('sunspire')?3.3:2.38,LP);}
  else view.project(l.tile.x,l.tile.z,l.type==='ruin'?1.22:.6,LP);
  const x=Math.round(LP.x),y=Math.round(LP.y);if(x!==l.x||y!==l.y){l.x=x;l.y=y;l.el.style.transform=`translate(${x}px,${y}px)`;}
  const vis=LP.visible&&LP.x>-80&&LP.x<w+80&&LP.y>0&&LP.y<h?'visible':'hidden';if(vis!==l.vis){l.vis=vis;l.el.style.visibility=vis;}}
 view.project(2.8,14.3,.12,LP);const sx=Math.round(LP.x),sy=Math.round(LP.y);if(sx!==seaPos.x||sy!==seaPos.y){seaPos.x=sx;seaPos.y=sy;seaEl.style.left=sx+'px';seaEl.style.top=sy+'px';}}
function drawMinimap(){const cv=$('minimap'),ctx=cv.getContext('2d'),cw=cv.width/W,ch=cv.height/H;ctx.fillStyle='#7d9c93';ctx.fillRect(0,0,cv.width,cv.height);const colors={water:'#659b99',grass:'#9cba85',plains:'#b7bf87',hill:'#91a274',forest:'#5e8c65',sand:'#cabd86',mountain:'#bec5b4'};
 for(const t of game.tiles){ctx.fillStyle=t.explored?colors[t.type]:'#c4cbbb';ctx.fillRect(t.x*cw,t.z*ch,cw+.5,ch+.5);if(t.owner>=0&&t.explored){ctx.fillStyle=(FACTIONS[t.owner]?.color||'#555555')+'60';ctx.fillRect(t.x*cw,t.z*ch,cw+.5,ch+.5);}}
 for(const c of game.s.cities)if(game.tile(c.x,c.z).explored){ctx.fillStyle='#f6e6b2';ctx.fillRect(c.x*cw+cw*.1,c.z*ch+ch*.1,cw*.8,ch*.8);ctx.fillStyle=FACTIONS[c.owner]?.color||'#775b4c';ctx.fillRect(c.x*cw+cw*.25,c.z*ch+ch*.25,cw*.5,ch*.5);}
 for(const u of game.units()){ctx.fillStyle='#f3f0cb';ctx.beginPath();ctx.arc((u.x+.5)*cw,(u.z+.5)*ch,2.1,0,Math.PI*2);ctx.fill();}
 if(view){const w=view.width,h=view.height,corners=[[0,0],[w,0],[w,h],[0,h]].map(p=>view.ground(p[0],p[1]));ctx.strokeStyle='#f5efc5bb';ctx.lineWidth=1.5;ctx.beginPath();corners.forEach((p,i)=>{let x=(p[0]/2+W/2)*cw,z=(p[1]/2+H/2)*ch;i?ctx.lineTo(x,z):ctx.moveTo(x,z);});ctx.closePath();ctx.stroke();}}
let miniKey='';
/** The view frame on the small map follows the camera, redrawn only when the camera moved. */
function drawMinimapIfMoved(){if(!view)return;const k=`${view.current[0].toFixed(2)},${view.current[2].toFixed(2)},${view.span.toFixed(2)},${view.yaw.toFixed(3)},${view.width},${view.height}`;if(k!==miniKey){miniKey=k;drawMinimap();}}

/* ---------------------------------------------------------------- panels */
function modalHeader(title,kicker='The Dawnfolk · '+year()){return `<div class="modal-head"><div><div class="kicker">${esc(kicker)}</div><h2 id="modal-title">${title}</h2></div><button class="icon-btn" data-action="close-modal" aria-label="Close panel">${icon('close')}</button></div>`;}
/* Focus goes back to where it was only for keyboard users (a focus ring was showing): a HUD button
   that merely kept focus from a click would otherwise swallow the next Space or Enter. */
function openModal(type,data={}){if(!modalType){const a=document.activeElement;previousFocus=a&&a!==document.body&&a.matches?.(':focus-visible')?a:null;}modalType=type;modalData=data;paintModal();if(!modalType)return;$('modal-backdrop').classList.remove('hidden');setTimeout(()=>{if(!modalType)return;$('modal').querySelector('button:not(:disabled)')?.focus({preventScroll:true});padCursor.snapFirst();},30);}
function closeModal(){const was=modalType;modalType=null;$('modal-backdrop').classList.add('hidden');if(was){if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});else if($('modal').contains(document.activeElement))document.activeElement.blur();}previousFocus=null;kit?.input.settle();}
/** The controls the player is using right now: keyboard and mouse, controller, or touch. */
function controlsList(){const src=kit?.input.source||'keyboard';
 const list=src==='gamepad'?[['Left stick','Move the cursor'],['A','Select · confirm'],['B','Back'],['X','Next unit'],['Y','End turn'],['Right stick','Pan the map'],['LB RB','Zoom'],['LT RT','Rotate'],['D-pad','Jump between buttons'],['R3','Home'],['Back','Research'],['Start','Menu']]
  :src==='touch'?[['Tap','Select a unit, city, or tile'],['Tap again','Confirm a move or attack'],['Drag','Pan the map'],['Pinch','Zoom'],['Small map','Jump there']]
  :[['Click','Select'],['Click again','Confirm a move or attack'],['Drag','Pan'],['Wheel','Zoom'],['Enter','End turn'],['Space','Next unit'],['F','Found / fortify'],['W A S D','Pan'],['Q E','Rotate'],['+ −','Zoom'],['H','Home'],['R','Research'],['C','Council'],['J','Goals'],['G','Grid'],['Y','Yields'],['Esc','Back / menu'],['F9','Display settings']];
 return `<p class="tiny muted controls-line">${list.map(([k,v])=>`<span class="control"><span class="key">${k}</span> ${v}</span>`).join('')}</p>`;}
function recordsLine(){const rec=loadRecords(),d=game.s.difficulty||'standard',best=rec.best?.[d];if(!rec.games)return 'No age has ended on this device yet.';return `${rec.games} age${rec.games===1?'':'s'} played · ${rec.wins||0} won${best?` · best legacy on ${DIFFICULTY[d].name}: ${best.score} (${best.type}, turn ${best.turn})`:''}.`;}
function paintModal(){const type=modalType,oldScroll=$('modal').querySelector('.modal-body')?.scrollTop||0;let title='',kicker='',body='';$('modal').classList.toggle('small',['menu','confirm','new','victory','tiding'].includes(type));
 if(type==='research'){title='The tree of knowledge';kicker=`${game.income().science} science each turn · ${game.s.techs.length} of ${Object.keys(TECHS).length} discoveries`;body=`<p class="modal-intro">Choose what your people learn next. Research is kept when you switch. Each discovery opens new ways to build and grow.</p><div class="research-grid">${[0,1,2].map((era)=>`<div class="tech-column"><div class="kicker">${['I · First ideas','II · Settled life','III · Great works'][era]}</div>${Object.entries(TECHS).filter(([k,t])=>t.era===era).map(([k,t])=>{const done=game.has(k),locked=t.req.some(r=>!game.has(r)),chosen=game.s.research===k,b=game.s.researchBank[k]||0;return `<button class="tech-card ${done?'done':''} ${chosen?'selected':''}" data-action="set-research" data-key="${k}" ${done||locked?'disabled':''}><span class="top">${icon(t.icon)}${done?icon('check'):chosen?'<span class="badge current">LEARNING</span>':locked?icon('lock'):`<span class="tech-cost">${t.cost} ${icon('flask')}</span>`}</span><span class="tech-name">${t.name}</span><p>${t.desc}</p><span class="foot">${done?'Discovered':locked?'Needs '+t.req.filter(r=>!game.has(r)).map(r=>TECHS[r].name).join(' + '):`${b} / ${t.cost} science`}</span>${chosen?`<div class="progress blue-progress"><i style="width:${b/t.cost*100}%"></i></div>`:''}</button>`;}).join('')}</div>`).join('')}</div>`;
 }else if(type==='production'){const c=game.city(modalData.id);if(!c)return closeModal();const prod=Math.max(1,game.yields(c).prod);title='Build something great';kicker=`${c.name} · ${game.yields(c).prod} production each turn`;body=`<p class="modal-intro">Choose one project for ${esc(c.name)}. Progress is kept for each project when you switch. New units appear in the city. Lesser wonders can be built by only one realm: if a rival finishes first, half the work returns as gold.</p><div class="build-grid">${Object.entries(BUILDS).map(([k,b])=>{const err=game.canBuild(c,k),chosen=c.build===k,bank=c.stock[k]||0,turns=Math.max(1,Math.ceil((b.cost-bank)/prod));return `<button class="build-card ${chosen?'selected':''} ${b.wonder?'wonder':''}" data-action="set-build" data-key="${k}" data-id="${c.id}" ${err?'disabled':''}>${icon(b.icon)}<h3>${b.name}</h3><p>${b.desc}</p><span class="foot">${err||`${chosen?'In progress · ':''}${b.cost?`${turns} turns · ${bank?bank+' / ':''}${b.cost} production`:'No turn limit'}`}</span></button>`;}).join('')}</div>`;
 }else if(type==='city'){const c=game.city(modalData.id);if(!c)return closeModal();const y=game.yields(c);title=esc(c.name);kicker=`${c.capital!==null?'Capital':'City'} of the Dawnfolk · ${c.pop} people`;body=`<p class="modal-intro">Your people work the best ${c.pop} nearby ${c.pop===1?'tile':'tiles'} automatically. Choose a focus to change which tiles they work.</p><div class="economy">${[['wheat','+'+y.surplus,'Food surplus'],['hammer',y.prod,'Production'],['flask',y.science,'Science'],['coin',y.gold,'Gold']].map(a=>`<div>${icon(a[0])}<strong>${a[1]}</strong><span>${a[2]} / turn</span></div>`).join('')}</div><div class="section-head"><h3>City focus</h3></div><div class="focus-options">${[['balanced','Balanced'],['food','Food'],['production','Production'],['gold','Gold']].map(([k,n])=>`<button data-action="focus" data-id="${c.id}" data-key="${k}" class="${c.focus===k?'active':''}">${n}</button>`).join('')}</div><div class="rule"></div><div class="between"><span class="tiny">Growth · ${c.food} / ${12+c.pop*6} food</span><span class="tiny muted">${c.pop>=y.limit?'Growth limit reached':y.surplus<=0?'No surplus food':Math.max(1,Math.ceil((12+c.pop*6-c.food)/y.surplus))+' turns to grow'}</span></div><div class="progress" style="margin-top:9px"><i style="width:${Math.min(100,c.food/(12+c.pop*6)*100)}%"></i></div><p class="context-note">Growth limit: ${y.limit}. A temple or the Moonwell Gardens raise the limit by 2. A granary saves food at each growth step.</p><div class="section-head"><h3>Within the walls</h3><span class="tiny muted">${c.hp} / ${c.maxHp} health</span></div><div class="building-tags">${c.buildings.length?c.buildings.map(k=>`<span class="badge">${icon(BUILDS[k].icon)}${BUILDS[k].name}</span>`).join(''):'<span class="tiny muted">No buildings yet. Every great city starts small.</span>'}</div><div class="rule"></div><button class="primary" data-action="production" data-id="${c.id}">${icon('hammer')}Change production</button>`;
 }else if(type==='journey'){title='A little empire. A lasting story.';kicker=`Three paths to victory · ${DIFFICULTY[game.s.difficulty]?.name||'Standard'}`;let caps=game.s.cities.filter(c=>(c.capital===1||c.capital===2)&&c.owner===0).length;body=`<p class="modal-intro">Lead the Dawnfolk through 60 turns of the First Dawn. Your choices decide how this age ends.</p><div class="goal-grid"><div class="goal-card">${icon('sunspire')}<h3>Build a wonder</h3><p>Found 2 cities. Discover Engineering and Philosophy. Complete the Sunspire in one city.</p><small>${game.has('engineering')?'✓':'○'} Engineering · ${game.has('philosophy')?'✓':'○'} Philosophy</small></div><div class="goal-card">${icon('crown')}<h3>Unite the land</h3><p>Capture Cinderhold and Pearlwatch, the two rival capitals. You must defeat their defenders first.</p><small>${caps} / 2 capitals held</small></div><div class="goal-card">${icon('culture')}<h3>Leave a legacy</h3><p>Have the highest score after turn 60. Grow cities, learn ideas, build, and gather culture.</p><small>${game.score()} legacy points · ${Math.max(0,61-game.s.turn)} turns left</small></div></div><div class="section-head"><h3>Your first steps</h3><span class="kicker">A guide, not a limit</span></div>${[[game.cities().length>0,'Found your capital','A home for your people'],[game.s.ruins>0,'Explore ancient ruins','Move a unit onto the ruins'],[game.s.techs.length>0,'Make your first discovery','End turns to gather science'],[game.cities().length>=2,'Found a second city','Train and move a settler'],[game.cities().some(c=>c.buildings.includes('gardens')||c.buildings.includes('archive')),'Raise a lesser wonder','Moonwell Gardens or the Clay Archive']].map(([done,n,d])=>`<div class="check-row ${done?'done':''}">${icon(done?'check':'circle')}<span>${n}</span><small>${done?'Complete':d}</small></div>`).join('')}<div class="section-head"><h3>The balance of power</h3></div>${scoreTable()}<p class="context-note">Score: 40 per city, 12 per person, 15 per discovery, 5 per building, 1 per 3 culture, 1 per 10 gold, and 8 per ruin explored.</p><div class="section-head"><h3>The record of your age</h3></div>${game.s.log.length?game.s.log.slice(0,12).map(l=>`<div class="log-line"><small>TURN ${l.turn}</small><span>${esc(l.text)}</span></div>`).join(''):'<p class="modal-intro">The page is blank. Your people are ready to write.</p>'}`;
 }else if(type==='council'){title='The council of realms';kicker='A word can open a border. Or close it.';body=`<p class="modal-intro">Trade brings gold and knowledge to both realms. Gifts improve goodwill. The Ember Court may attack a weak realm when goodwill is low.</p><div class="rival-grid">${[1,2].map(o=>{const r=game.s.relations[o],alive=game.cities(o).length>0;if(!r.met)return `<div class="rival-card unknown-rival">${icon('compass')}<h3>Beyond the horizon</h3><p>Explore the map to meet this realm.<br>A scout sees farther than other units.</p></div>`;return `<div class="rival-card"><div class="rival-top"><div class="rival-portrait">${ruler(o)}</div><div><div class="kicker">${FACTIONS[o].leader}</div><h3>${FACTIONS[o].name}</h3><span class="badge ${r.status==='war'?'danger':''}">${!alive?'REALM FALLEN':r.status==='war'?'AT WAR':r.trade?'TRADE PARTNERS':'AT PEACE'}</span></div></div><p>${o===1?'“Strong walls make fine neighbours. Strong armies make better ones.”':'“Let our roads carry goods, not soldiers.”'}</p><div class="goodwill between"><span>Goodwill</span><span>${r.favor} / 100</span></div><div class="progress"><i style="width:${clamp(r.favor,0,100)}%"></i></div>${alive?`<div class="rival-actions">${r.status==='war'?`<button class="primary" data-action="diplomacy" data-owner="${o}" data-key="peace" ${game.s.gold<30?'disabled':''}>${icon('leaf')}Peace · 30 gold</button>`:`<button class="secondary" data-action="diplomacy" data-owner="${o}" data-key="gift" ${game.s.gold<20||r.favor>=100?'disabled':''}>${icon('coin')}Gift · 20 gold</button><button class="secondary" data-action="diplomacy" data-owner="${o}" data-key="trade" ${!game.has('writing')||r.trade||game.s.gold<20?'disabled':''} title="Requires Writing. Costs 20 gold. Adds 3 gold and 1 science per turn.">${icon('road')}${r.trade?'Pact active':'Trade · 20 gold'}</button><button class="secondary" data-action="diplomacy" data-owner="${o}" data-key="maps" ${r.favor<25||game.s.gold<15?'disabled':''} title="Requires 25 goodwill">${icon('map')}Maps · 15 gold</button><button class="danger-btn" data-action="war-confirm" data-owner="${o}">${icon('sword')}Declare war</button>`}</div>`:''}${!game.has('writing')?'<p class="context-note">Discover Writing to sign trade pacts.</p>':''}</div>`;}).join('')}</div><div class="section-head"><h3>How shall we live?</h3><span class="kicker">Civics</span></div><p class="context-note" style="margin:0 0 12px">A change of civic costs 15 gold. The bonus applies to each city.</p><div class="civic-grid">${[['tradition','Tradition','A balanced start. No per-turn bonus or penalty.',''],['industry','Craft Guilds','+2 production and −1 gold each turn.','bronze'],['council','Council','+2 science and +1 culture each turn.','philosophy']].map(([key,n,d,req])=>`<button class="civic-card ${game.s.civic===key?'active':''}" data-action="civic" data-key="${key}" ${req&&!game.has(req)||game.s.civic!==key&&game.s.gold<15?'disabled':''}><h3>${n}</h3><p>${d}</p><small>${game.s.civic===key?'Current civic':req&&!game.has(req)?'Needs '+TECHS[req].name:'Adopt · 15 gold'}</small></button>`).join('')}</div>`;
 }else if(type==='menu'){const d=DIFFICULTY[game.s.difficulty]||DIFFICULTY.standard;title='A moment to consider';kicker='Crown & Clay · The First Dawn';body=`<div class="setting-row"><div><h3>Sound & music</h3><p>Soft notes and sounds for your actions.</p></div><button class="toggle ${settings.audio?'on':''}" data-action="audio">${settings.audio?'On':'Off'}</button></div><div class="setting-row"><div><h3>Display & controls</h3><p>Quality, resolution, renderer, touch, and controller options. Also on F9.</p></div><button class="toggle" data-action="display">Open</button></div><div class="setting-row"><div><h3>Tile grid</h3><p>Show the square map tiles.</p></div><button class="toggle ${settings.grid?'on':''}" data-action="grid">${settings.grid?'On':'Off'}</button></div><div class="setting-row"><div><h3>Tile yields</h3><p>Show food, production, and gold on the map.</p></div><button class="toggle ${settings.yields?'on':''}" data-action="yields">${settings.yields?'On':'Off'}</button></div><div class="setting-row"><div><h3>Difficulty · ${d.name}</h3><p>${esc(d.desc)} Choose another when you begin a new age.</p></div></div><div class="setting-row"><div><h3>Records</h3><p>${esc(recordsLine())}</p></div></div><div class="menu-actions"><button class="secondary" data-action="export">${icon('export')}Export save</button><button class="secondary" data-action="import">${icon('import')}Import save</button></div><p class="save-status">${esc(saveStatus)}</p><div class="menu-actions"><button class="secondary" data-action="help">${icon('help')}How to play</button><button class="danger-btn" data-action="new-confirm">${icon('rotate')}New age</button></div><div class="rule"></div><p class="tiny muted" style="line-height:1.65">An original, independent tribute to the joy of turn-based empire games. All models and sounds are made by code. No online services, accounts, or downloads are required during play.</p><p class="tiny muted" style="margin-top:9px">${esc(kit?.backendLabel||'')} · three.js r${THREE.REVISION} · v1.1</p>`;
 }else if(type==='help'){title='Every great story starts small';kicker='How to play';body=`<div class="help-grid"><div class="help-block"><h3>1. Settle, then explore</h3><p>Select the settler and press <b>Found capital</b>. Select your scout. Tap a tile, then tap it again or press <b>Move here</b>. Gold dots show reachable tiles. Ruins give a one-time gift.</p><p>Drag the map to pan. Pinch to zoom on a touch screen. Use the mouse wheel on desktop. Tap the small map to jump to that area.</p><h3>2. Build your home</h3><p>Select a city and choose <b>Change production</b>. Workers build improvements. Settlers found cities. Soldiers protect your land.</p><p>A city works one nearby tile per person. Food grows the population. Production completes projects. Gold pays for upkeep and treaties. Culture expands borders at 10 and 50 local culture.</p></div><div class="help-block"><h3>3. Learn and improve</h3><p>Tap the research card to choose a discovery. End turns to gather science. Move a worker onto land inside your borders. Farms need Agriculture; mines need Mining. Each job takes 2 turns.</p><p>Roads cost half a movement point when both tiles have roads. Hills and forests cost 2 points. Scouts ignore these extra costs. Water and mountains are not passable in this age.</p><h3>4. Trade or take a stand</h3><p>Meet rivals by exploring. Use the Council for trade, gifts, peace, or war. Gifts raise goodwill by 25. Trade costs 20 gold and adds 3 gold and 1 science each turn.</p><p>To attack, select a soldier and tap an enemy. Review the damage, then tap again or press <b>Attack</b>. Melee troops attack adjacent tiles. Catapults attack from 2 tiles but cannot capture a city. Fortified troops gain 30% defence. Resting heals 12 health; fortifying heals 22.</p></div></div><div class="rule"></div><div class="help-block"><h3>Tidings and lesser wonders</h3><p>Every few turns a small matter reaches your people: a comet, a flood, an envoy, a master builder. Choose an answer in its panel, or leave it and your people take the last, free choice when the turn ends. Pottery unlocks the Moonwell Gardens and Writing the Clay Archive. Only one realm can raise each of them, and your rivals will try.</p></div><div class="rule"></div><div class="help-block"><h3>Winning the First Dawn</h3><p>Complete the Sunspire with 2 cities and both Engineering and Philosophy. Or capture both rival capitals. Or have the highest score after turn 60. You lose if your last city falls and you have no settler.</p><p>Units regain their movement each turn. <b>End turn does not move your units for you.</b> You may skip unused moves. Auto-save keeps each order on this device. Export a save from the menu for a separate copy.</p></div><div class="rule"></div>${controlsList()}`;
 }else if(type==='confirm'){title='Let this be clear.';kicker='A declaration of war';const o=modalData.owner;body=`<p class="modal-intro">Declare war on <b>${FACTIONS[o]?.name||'this realm'}</b>? Any trade pact will end. Their armies will move against your cities. A peace treaty later costs 30 gold.</p><div class="menu-actions"><button class="secondary" data-action="council">Keep the peace</button><button class="danger-btn" data-action="declare-war" data-owner="${o}">${icon('sword')}Declare war</button></div>`;
 }else if(type==='new'){title='Turn a fresh page';kicker='Start a new age';const dk=Object.hasOwn(DIFFICULTY,modalData.difficulty||'')?modalData.difficulty:game.s.difficulty||'standard';modalData.difficulty=dk;if(modalData.seed==null)modalData.seed=Math.floor(Math.random()*99900)+100;body=`<p class="modal-intro">Start with a settler, a scout, and a warrior. This replaces the local auto-save. Export your current save first to keep it.</p><div class="section-head"><h3>Difficulty</h3></div><div class="focus-options">${Object.entries(DIFFICULTY).map(([k,d])=>`<button data-action="difficulty" data-key="${k}" class="${k===dk?'active':''}">${d.name}</button>`).join('')}</div><p class="context-note">${esc(DIFFICULTY[dk].desc)}</p><label class="kicker seed-label" for="world-seed">World seed</label><input class="seed-input" id="world-seed" type="number" min="1" max="999999" value="${esc(modalData.seed)}" inputmode="numeric"><p class="context-note">The First Dawn keeps its main landmarks. The seed changes the smaller terrain details and resources.</p><div class="menu-actions"><button class="secondary" data-action="export">${icon('export')}Export current save</button><button class="primary gold-btn" data-action="new-game">${icon('sun')}Begin a new age</button></div>`;
 }else if(type==='tiding'){const e=game.openTiding();if(!e){if(game.s.pending)game.decide(0);return closeModal();}title=esc(e.title);kicker=`${e.kicker} · ${year()}`;body=`<div class="tiding-hero">${icon(e.icon)}</div><p class="modal-intro">${esc(e.text(game))}</p><div class="tiding-choices">${e.choices.map((c,i)=>{const err=c.can?c.can(game):'';return `<button class="tiding-choice" data-action="decide" data-key="${i}" ${err?'disabled':''}><strong>${esc(c.label)}</strong><span>${esc(err||c.detail(game))}</span></button>`;}).join('')}</div><p class="context-note">Close this page to decide later. If the turn ends first, your people choose “${esc(e.choices[e.choices.length-1].label)}”.</p>`;
 }else if(type==='victory'){const end=game.s.ended;if(!end)return closeModal();const won=end.winner===0,rec=modalData.record;title=won?'Your name will be remembered.':'Every ending holds a beginning.';kicker='The First Dawn · Final record';body=`<div class="victory-hero"><div class="victory-seal">${icon(won?'sunspire':'leaf')}</div><div class="kicker">${won?end.type+' victory':end.type==='Defeat'?'Your realm has fallen':FACTIONS[end.winner]?.name+' wins'}</div><h3>${won?'A small realm.<br>A great legacy.':'The sun will<br>rise again.'}</h3><p>${esc(end.text)}</p><div class="victory-stats"><div><strong>${game.cities().length}</strong><span>Cities</span></div><div><strong>${game.s.techs.length}</strong><span>Discoveries</span></div><div><strong>${game.score()}</strong><span>Legacy</span></div></div>${rec?.best?`<p class="record-line">${rec.newBest?'<span class="badge current">NEW RECORD</span> ':''}Best legacy on ${esc(rec.diff)}: <b>${rec.best.score}</b></p>`:''}</div>${scoreTable(true)}<div class="menu-actions"><button class="secondary" data-action="keep-playing">Continue this world</button><button class="primary gold-btn" data-action="new-confirm">${icon('sun')}A new beginning</button></div>`;
 }
 $('modal').innerHTML=modalHeader(title,kicker||undefined)+`<div class="modal-body">${body}</div>`;if(oldScroll&&type===modalType)$('modal').querySelector('.modal-body').scrollTop=oldScroll;
}
function scoreTable(all=false){return `<table class="score-table"><thead><tr><th>Realm</th><th>Cities</th><th>Legacy</th></tr></thead><tbody>${[0,1,2].sort((a,b)=>game.score(b)-game.score(a)).map(o=>{let known=all||o===0||game.s.relations[o].met;return `<tr><td><span class="realm-dot" style="background:${known?FACTIONS[o].color:'#afb89e'}"></span>${known?FACTIONS[o].name:'Unknown realm'}${o===0?' · You':''}</td><td>${known?game.cities(o).length:'—'}</td><td>${known?game.score(o):'—'}</td></tr>`;}).join('')}</tbody></table>`;}
function result(r){if(!r?.ok){toast(r?.msg||'That order is not available.');return false;}return true;}
function currentUnit(){return selection?.type==='unit'?game.unit(selection.id):null;}
function nextUnit(){const all=game.units(),ready=all.filter(u=>u.moves>0&&!u.fortified&&!u.job),list=ready.length?ready:all;if(!list.length){toast('Train a unit in one of your cities.');return;}let i=list.findIndex(u=>u.id===selection?.id);select('unit',list[(i+1)%list.length].id,true);}
function explore(){const u=currentUnit();if(!u||u.moves<=0)return;const r=game.reachable(u),targets=[...r.keys()].map(k=>game.tiles[k]).filter(t=>!(t.x===u.x&&t.z===u.z));if(!targets.length){toast('No open route. Wait for the next turn.');return;}const unknown=game.tiles.filter(t=>!t.explored);function val(t){let n=game.tiles.filter(a=>!a.explored&&dist(t,a)<=3).length;let nd=unknown.length?Math.min(...unknown.map(a=>dist(t,a))):0;let danger=game.s.units.some(v=>game.hostile(u.owner,v.owner)&&dist(v,t)<=1)?45:0;return n*3+(t.ruin?100:0)-nd*4-danger-r.get(t.z*W+t.x)*.2;}
 targets.sort((a,b)=>val(b)-val(a));const t=targets[0];target=null;if(result(game.move(u.id,t.x,t.z))){view?.focus(t.x,t.z);sound.cue('move');}}
function exportSave(){try{const blob=new Blob([JSON.stringify(game.s,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`crown-and-clay-turn-${game.s.turn}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);toast('Your save has been exported.');}catch{toast('The browser could not export this save.','danger');}}
function useGame(next){game=next;attachGame();view.setGame(game);selection=game.cities().length?{type:'city',id:game.cities()[0].id}:game.units().length?{type:'unit',id:game.units()[0].id}:null;target=null;lastVictory=null;}
function startNew(seed,difficulty){useGame(new Game(null,clamp(Math.trunc(Number(seed))||417,1,999999),difficulty));view.resetCamera();selection={type:'unit',id:game.units()[0].id};closeModal();$('toasts').innerHTML='';view.home();refresh(false);sound.cue('city');}
async function act(action,data={}){if(busy&&action!=='close-modal')return;const u=currentUnit(),id=Number(data.id),key=data.key,owner=Number(data.owner);
 switch(action){
 case 'research':openModal('research');break;case 'journey':openModal('journey');break;case 'council':openModal('council');break;case 'menu':openModal('menu');break;case 'help':openModal('help');break;
 case 'tiding':openModal('tiding');break;
 case 'decide':if(result(game.decide(Number(key))))closeModal();break;
 case 'close-modal':closeModal();break;case 'production':openModal('production',{id:id||selection?.id});break;case 'city-detail':openModal('city',{id:id||selection?.id});break;
 case 'set-research':if(result(game.setResearch(key))){closeModal();toast('Your people will study '+TECHS[key].name+'.');sound.cue('move');}break;
 case 'set-build':if(result(game.setBuild(id,key))){closeModal();select('city',id);toast(game.city(id).name+' begins '+BUILDS[key].name+'.');}break;
 case 'focus':if(result(game.setFocus(id,key)))paintModal();break;
 case 'select-unit':select('unit',id);break;
 case 'select-city':{const c=game.city(id);if(u&&c&&c.owner!==0)pickTile(game.tile(c.x,c.z));else select('city',id);break;}
 case 'enemy-target':{const enemy=game.unit(id);if(enemy){if(u)pickTile(game.tile(enemy.x,enemy.z));else select('tile',game.tile(enemy.x,enemy.z));}break;}
 case 'deselect':selection=null;target=null;syncSelection();updateContext();updateLabels();break;
 case 'next-unit':closeModal();nextUnit();break;
 case 'clear-target':target=null;syncSelection();updateContext();break;
 case 'found':if(u){let x=u.x,z=u.z,r=game.found(u.id);if(result(r)){select('city',r.city);view?.burst(x,z);sound.cue('city');kit?.input.rumble(.3,90);}}break;
 case 'move':if(u&&target){let t=target;target=null;if(result(game.move(u.id,t.x,t.z))){syncSelection();updateContext();sound.cue('move');}else{target=t;syncSelection();updateContext();}}break;
 case 'attack':if(u&&target){let t=target;target=null;const r=game.attack(u.id,t.x,t.z);if(result(r)){view?.burst(t.x,t.z,'#dfaa66');sound.cue('battle');kit?.input.rumble(r.lost?.8:.5,r.lost?220:130);}syncSelection();updateContext();}break;
 case 'wait':case 'stop-job':if(u)result(game.wait(u.id,false));break;
 case 'fortify':if(u)result(game.wait(u.id,true));break;
 case 'explore':explore();break;
 case 'improve':if(u)result(game.improve(u.id,key));break;
 case 'end-turn':{if(modalType)return;if(!game.active()){openModal('victory',{record:recordEnding()});return;}busy=true;$('end-turn').disabled=true;$('end-turn').classList.add('busy');await new Promise(r=>setTimeout(r,80));target=null;try{game.endTurn();}catch(err){console.error(err);toast('The turn could not finish. Export your save before reloading.','danger');}busy=false;$('end-turn').disabled=false;$('end-turn').classList.remove('busy');syncSelection();updateContext();sound.cue('turn');$('turn-flash').textContent=year();$('turn-flash').classList.remove('show');void $('turn-flash').offsetWidth;$('turn-flash').classList.add('show');
  if(game.openTiding()&&!(game.s.ended&&!game.s.keepPlaying))setTimeout(()=>{if(!modalType&&!busy&&game.openTiding())openModal('tiding');},900);break;}
 case 'home':view?.home();break;case 'zoom-in':view?.zoom(.85);break;case 'zoom-out':view?.zoom(1.18);break;case 'rotate-left':view?.rotate(-Math.PI/4);break;case 'rotate-right':view?.rotate(Math.PI/4);break;
 case 'grid':settings.grid=!settings.grid;if(view){view.grid=settings.grid;view.rebuild();}$('grid-tool').classList.toggle('active',settings.grid);saveSettings();if(modalType==='menu')paintModal();break;
 case 'yields':settings.yields=!settings.yields;updateLabels();saveSettings();if(modalType==='menu')paintModal();break;
 case 'display':kit?.menu.open();break;
 case 'audio':settings.audio=!settings.audio;if(settings.audio){sound.start();sound.cue('city');}saveSettings();paintModal();break;
 case 'diplomacy':if(result(game.diplomacy(owner,key)))paintModal();break;
 case 'war-confirm':if(owner>=1&&owner<=2)openModal('confirm',{owner});break;
 case 'declare-war':if(result(game.diplomacy(owner,'war'))){closeModal();updateContext();}break;
 case 'civic':if(result(game.setCivic(key)))paintModal();break;
 case 'export':exportSave();break;case 'import':$('save-file').click();break;
 case 'new-confirm':openModal('new');break;
 case 'difficulty':if(Object.hasOwn(DIFFICULTY,key||'')){modalData.seed=$('world-seed')?.value??modalData.seed;modalData.difficulty=key;paintModal();}break;
 case 'new-game':startNew($('world-seed')?.value,modalData.difficulty||game.s.difficulty);break;
 case 'keep-playing':game.s.keepPlaying=true;closeModal();refresh(false);break;
 }
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b&&!b.disabled&&!b.closest('.kit-menu,.kit-touch')){e.stopPropagation();act(b.dataset.action,b.dataset);}});
$('modal-backdrop').addEventListener('click',e=>{if(e.target===$('modal-backdrop'))closeModal();});
$('save-file').addEventListener('change',async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;if(file.size>2000000){toast('This save is too large.','danger');return;}try{const s=JSON.parse(await file.text()),ng=new Game(s);useGame(ng);closeModal();view.home();refresh(false);toast('Your saved age has been restored.','city');}catch(err){toast('This save could not be read. '+err.message,'danger');}});
/* The small map: tap or drag to move the camera there. */
const mini=$('minimap');let miniDrag=false;
function miniFocus(cx,cy){const r=mini.getBoundingClientRect(),x=clamp(Math.floor((cx-r.left)/r.width*W),0,W-1),z=clamp(Math.floor((cy-r.top)/r.height*H),0,H-1);view?.focus(x,z);}
mini.addEventListener('pointerdown',e=>{e.preventDefault();miniDrag=true;try{mini.setPointerCapture(e.pointerId);}catch{}miniFocus(e.clientX,e.clientY);});
mini.addEventListener('pointermove',e=>{if(miniDrag)miniFocus(e.clientX,e.clientY);});
for(const t of ['pointerup','pointercancel','lostpointercapture'])mini.addEventListener(t,()=>{miniDrag=false;});
// Keep keyboard focus inside an open panel.
window.addEventListener('keydown',e=>{if(e.key!=='Tab'||!modalType)return;const btns=[...$('modal').querySelectorAll('button:not(:disabled),input')].filter(b=>b.offsetParent!==null),first=btns[0],last=btns.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}});

/* ---------------------------------------------------------------- controller cursor
   The left stick moves a cursor over the map and every panel, the D-pad jumps between
   buttons (and unit or city labels), A clicks what is under it. The map scrolls when
   the cursor is pushed against the screen edge. */
const padCursor=(()=>{
 const el=document.createElement('div');el.className='pad-cursor';el.hidden=true;el.setAttribute('aria-hidden','true');document.body.append(el);
 const CLICKABLE='button:not([disabled]),input:not([type=file]),a[href]',DIRS=['Up','Down','Left','Right'];
 let x=innerWidth/2,y=innerHeight/2,active=false,hot=null,drawnX=NaN,drawnY=NaN,repeatAt=0,repeatDir=null;
 const scope=()=>modalType?$('modal'):document.body;
 const shown=b=>{if(b.closest('.kit-menu,.kit-touch'))return false;if(b.offsetParent===null&&getComputedStyle(b).position!=='fixed')return false;const w=b.closest('.world-label');if(w&&w.style.visibility==='hidden')return false;const r=b.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth;};
 const clampXY=()=>{x=Math.max(2,Math.min(innerWidth-2,x));y=Math.max(2,Math.min(innerHeight-2,y));};
 function under(){const hit=document.elementFromPoint(x,y);if(!hit)return null;if(hit===kit.canvas)return 'map';if(hit===mini)return 'minimap';const b=hit.closest(CLICKABLE);return b&&scope().contains(b)?b:null;}
 function setHot(n){if(n===hot)return;hot?.classList?.remove('pad-hover');hot=n;hot?.classList?.add('pad-hover');}
 function draw(){if(x!==drawnX||y!==drawnY){drawnX=x;drawnY=y;el.style.transform=`translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;}}
 function snapTo(b){if(!b||!active)return;b.scrollIntoView?.({block:'nearest',inline:'nearest'});const r=b.getBoundingClientRect();x=r.left+r.width/2;y=r.top+r.height/2;clampXY();draw();}
 /** Spatial navigation: the nearest button in that direction, favouring ones in line with the cursor. */
 function jump(dir){const dx=dir==='Left'?-1:dir==='Right'?1:0,dy=dir==='Up'?-1:dir==='Down'?1:0;let best=null,score=Infinity;
  for(const b of scope().querySelectorAll(CLICKABLE)){if(!shown(b))continue;const r=b.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,along=(cx-x)*dx+(cy-y)*dy,across=Math.abs((cx-x)*dy)+Math.abs((cy-y)*dx);if(along<6||across>along*1.5)continue;const s=along+across*2.5;if(s<score){score=s;best=b;}}
  if(best)snapTo(best);}
 return{
  get active(){return active;},
  update(dt){const on=kit.input.source==='gamepad'&&!kit.menu.isOpen;if(on!==active){active=on;el.hidden=!on;if(!on)setHot(null);else{clampXY();draw();}}if(!on)return;
   const v=kit.input.vector('cursor'),m=Math.hypot(v.x,v.y);if(m>0){const speed=Math.min(innerWidth,innerHeight)*1.3*m;x+=v.x*speed*dt;y-=v.y*speed*dt;clampXY();}
   const now=performance.now();for(const dir of DIRS){const name='nav'+dir;if(kit.input.pressed(name)){jump(dir);repeatDir=dir;repeatAt=now+380;}else if(repeatDir===dir&&kit.input.down(name)&&now>repeatAt){jump(dir);repeatAt=now+130;}else if(repeatDir===dir&&!kit.input.down(name))repeatDir=null;}
   if(!modalType&&view){const e=40,ex=x<e&&v.x<-.2?1:x>innerWidth-e&&v.x>.2?-1:0,ey=y<e&&v.y>.2?1:y>innerHeight-e&&v.y<-.2?-1:0;if(ex||ey)view.pan(ex*650*dt,ey*650*dt);}
   draw();const t=under();setHot(t==='map'||t==='minimap'?null:t);},
  click(){if(!active)return;const t=under();if(t==='map')tapAt(x,y);else if(t==='minimap')miniFocus(x,y);else if(t){if(t.tagName==='INPUT')t.focus();else t.click();}},
  center(){if(active){x=innerWidth/2;y=innerHeight/2;draw();}},
  mapTile(){return active&&view&&!modalType&&under()==='map'?view.pick(x,y):null;},
  snapFirst(){if(active&&modalType)snapTo($('modal').querySelector('.modal-body button:not(:disabled)')||$('modal').querySelector('button:not(:disabled)'));},
 };
})();

/* ---------------------------------------------------------------- input and the frame loop */
const ACTIONS={
 pan:{type:'vector',keys:'wasd+arrows',gamepad:'rightStick'},
 cursor:{type:'vector',gamepad:'leftStick'},
 look:{type:'look',mouse:'drag',touch:'drag',gamepad:[]},
 click:{mouse:[0]},
 navUp:{gamepad:['Up']},navDown:{gamepad:['Down']},navLeft:{gamepad:['Left']},navRight:{gamepad:['Right']},
 confirm:{gamepad:['A']},
 back:{keys:['Escape','Backspace'],gamepad:['B']},
 menu:{keys:['KeyP'],gamepad:['Start']},
 endTurn:{keys:['Enter','NumpadEnter'],gamepad:['Y']},
 nextUnit:{keys:['Space'],gamepad:['X']},
 found:{keys:['KeyF']},
 zoomIn:{keys:['Equal','NumpadAdd'],gamepad:['RB']},zoomOut:{keys:['Minus','NumpadSubtract'],gamepad:['LB']},
 rotateLeft:{keys:['KeyQ'],gamepad:['LT']},rotateRight:{keys:['KeyE'],gamepad:['RT']},
 home:{keys:['KeyH'],gamepad:['RS']},
 grid:{keys:['KeyG']},yields:{keys:['KeyY']},
 research:{keys:['KeyR'],gamepad:['Back']},council:{keys:['KeyC']},goals:{keys:['KeyJ']},
};
function back(){if(modalType){closeModal();return;}if(target){act('clear-target');return;}if(selection){act('deselect');return;}openModal('menu');}
const tap={on:false,ok:false,x:0,y:0};
let miniTimer=0;
function handleInput(dt){
 const inp=kit.input,p=inp.pointer;
 padCursor.update(dt);
 if(inp.pressed('menu')){if(modalType==='menu')closeModal();else openModal('menu');return;}
 if(inp.pressed('back')){back();return;}
 if(inp.pressed('confirm'))padCursor.click();
 if(modalType){const v=inp.vector('pan'),body=$('modal').querySelector('.modal-body');if(v.y&&body)body.scrollTop-=v.y*900*dt;tap.on=false;return;}
 // The map: a click or tap selects, a drag pans, wheel and pinch zoom.
 if(p.justDown&&(p.type!=='mouse'||inp.down('click'))){tap.on=true;tap.ok=true;tap.x=p.x;tap.y=p.y;}
 if(tap.on&&tap.ok&&(Math.hypot(p.x-tap.x,p.y-tap.y)>8||inp.zoom()!==0))tap.ok=false;
 if(p.justUp&&tap.on){tap.on=false;if(tap.ok)tapAt(tap.x,tap.y);}
 const lk=inp.look('look');
 if(lk.x||lk.y){const s=kit.settings.get(),k=(p.type==='touch'?TOUCH_LOOK:MOUSE_LOOK)*(s.lookSensitivity||1),inv=s.invertY?-1:1;view.pan(lk.x/k,lk.y/(k*inv));}
 const z=inp.zoom();if(z)view.zoom(Math.exp(-z*(p.type==='touch'?.25:.1)),p.type==='touch');
 const v=inp.vector('pan');if(v.x||v.y)view.pan(-v.x*720*dt,v.y*720*dt);
 if(inp.pressed('zoomIn'))act('zoom-in');if(inp.pressed('zoomOut'))act('zoom-out');
 if(inp.pressed('rotateLeft'))act('rotate-left');if(inp.pressed('rotateRight'))act('rotate-right');
 if(inp.pressed('home'))act('home');if(inp.pressed('grid'))act('grid');if(inp.pressed('yields'))act('yields');
 if(inp.pressed('research'))act('research');else if(inp.pressed('council'))act('council');else if(inp.pressed('goals'))act('journey');
 if(inp.pressed('nextUnit')){act('next-unit');padCursor.center();}
 if(inp.pressed('found'))act(currentUnit()?.type==='settler'?'found':'fortify');
 if(inp.pressed('endTurn'))act('end-turn');
 // Hover: the tile under the mouse or the controller cursor (touch has none).
 if(padCursor.active)view.setHover(padCursor.mapTile());
 else if(p.type==='mouse'&&p.over&&!p.down)view.setHover(view.pick(p.x,p.y));
 else if(view.hoverTile)view.setHover(null);
}
function frame(dt){
 handleInput(dt);
 view.update(dt);
 post.render();
 positionLabels();
 if(++miniTimer>=6){miniTimer=0;drawMinimapIfMoved();}
}
function updateHints(){const s=kit.input.source;$('map-hint').innerHTML=s==='gamepad'?'Left stick: cursor <span class="sep">·</span> A: select <span class="sep">·</span> Y: end turn <span class="sep">·</span> Start: menu':s==='touch'?'Drag to explore <span class="sep">·</span> Pinch to zoom':'Drag to explore <span class="sep">·</span> Scroll to zoom <span class="sep">·</span> Click a tile twice to move';if(modalType==='help')paintModal();}

/* ---------------------------------------------------------------- start */
kit=await boot({title:'Crown & Clay',canvas:$('world'),gear:'none',accent:'#edcf8b',background:'#315f51',touch:{hint:false},input:ACTIONS});
kit.loading.progress(.75,'Shaping the land…');
view=new WorldView(kit,game);
view.grid=settings.grid;view.rebuild();
post=createPost(kit,view.scene,view.camera,{output:(color,ctx)=>view.finishNode(color,ctx.scenePass)});
kit.onPause(p=>sound.pause(p));
kit.input.onSourceChange(updateHints);updateHints();
attachGame();refresh(false);
if(loaded){view.home();setTimeout(()=>toast('Welcome back. Your age continues at turn '+game.s.turn+'.','city'),800);}
if(saveError)setTimeout(()=>toast(saveError,'danger'),800);
view.update(0);
kit.loading.progress(.9,'Lighting the first fires…');
try{await kit.renderer.compileAsync(view.scene,view.camera);}catch(err){console.warn(err);}
kit.start(frame);
if(game.openTiding()&&!game.s.ended)setTimeout(()=>{if(!modalType&&game.openTiding())openModal('tiding');},1200);

// Small, read-only public identity. The test bridge is present only when explicitly requested.
window.CrownAndClay={version:'1.1',title:'Crown & Clay: The First Dawn',exportSave};
if(new URLSearchParams(location.search).has('test'))window.__CC={get game(){return game;},get renderer(){return view;},get selection(){return selection;},get target(){return target;},act,select,pickTile,refresh,openModal,closeModal,startNew,constants:ENGINE};
