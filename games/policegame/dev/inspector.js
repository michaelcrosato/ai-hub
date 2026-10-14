import { flattenActions } from '../runtime/content.js';

const clone = value => structuredClone(value);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

/** Transactional editor operations are separate from their DOM controls so
 * invalid changes can never partially mutate the running case or its save. */
export function createAuthorTools({ definition, adventure, saves, getSession, setSession, onChange = () => {} }) {
  if (!saves.development) throw new Error('Author tools require a separate development save');
  const initial = adventure.freshCase();
  function apply(state, effect) {
    const response = adventure.applyEffects(state, effect);
    if (response?.error) throw new Error(response.error);
  }
  function transact(edit) {
    try {
      const next = clone(getSession());
      edit(next);
      if (!definition.areas.some(area => area.id === next.area)) throw new Error('Unknown area');
      if (!adventure.validateCase(next.state)) throw new Error('Edit rejected: the resulting state is invalid');
      next.state = adventure.restoreCase(next.state);
      setSession(next);
      onChange();
      return { ok: true };
    } catch (error) { return { ok: false, error: error.message }; }
  }
  return {
    setFlag(id, value) {
      return transact(({state}) => {
        if (!Object.hasOwn(initial.flags, id) || typeof value !== typeof initial.flags[id]) throw new Error('Unknown flag or incompatible value');
        state.flags[id] = value;
      });
    },
    setValue(id, value) {
      return transact(({state}) => {
        if (!Object.hasOwn(initial.values, id)) throw new Error('Choose a declared value');
        if (value === undefined) throw new Error('Value must be valid JSON');
        state.values[id] = clone(value);
      });
    },
    setItem(id, present) {
      return transact(({state}) => {
        if (!(definition.items || []).some(item => item.id === id) && !(state.inventory.includes(id) && !present)) throw new Error('Unknown item');
        apply(state, { type:'item', id, operation:present ? 'add' : 'remove' });
      });
    },
    setEvidence(id, stage) {
      return transact(({state}) => {
        if (!(definition.evidence || []).some(item => item.id === id)) throw new Error('Unknown exhibit');
        apply(state, { type:'evidence', id, ...(stage ? {stage} : {}), note:'Designer checkpoint adjustment' });
      });
    },
    jumpArea(id) {
      return transact(next => { next.area=id; if(Object.hasOwn(next.state,'area'))next.state.area=id; adventure.closeConversation(next.state); adventure.closePuzzle(next.state); });
    },
    checkpoint(name) { return saves.checkpoint(name, getSession()); },
    restoreCheckpoint(name) {
      const restored = saves.restoreCheckpoint(name);
      return restored.ok ? transact(next => Object.assign(next, restored.session)) : restored;
    },
    importSave(raw) {
      const imported = saves.importSave(raw, {persist:false});
      return imported.ok ? transact(next => Object.assign(next, imported.session)) : imported;
    },
    actions(hotspot) {
      const state = getSession().state;
      return flattenActions(definition).filter(action => action.hotspot === hotspot).map(action => {
        const available = adventure.actionsFor(state, hotspot).find(item => item.id === action.id);
        const details = adventure.explainCondition(state, action.when ?? action.enabled);
        return { id:action.id, label:action.label, visible:!!available, enabled:!!available && !available.disabled,
          reason:available?.reason || (!available ? 'Hidden or already completed.' : ''), conditions:details.reasons };
      });
    },
  };
}

/** Mounted only by explicit ?dev=1. All mutations use development persistence. */
export function installInspector(options) {
  const { definition, adventure, scene, saves, getSession, onChange = () => {} } = options;
  if (new URLSearchParams(globalThis.location?.search || '').get('dev') !== '1' || !saves.development) return null;
  const tools = createAuthorTools(options);
  const host = document.createElement('details');
  host.id = 'designer-inspector'; host.dataset.inputOwner = 'inventory';
  host.innerHTML = `<summary>◇ DESIGNER TOOLS <small>isolated development save</small></summary><div class="dev-body">
    <p>Edits affect this development case. Export placement snippets into content files to keep scene changes.</p>
    <div class="dev-row"><button data-dev="refresh">Refresh</button><label><input id="dev-overlay" type="checkbox"> Scene overlays</label></div>
    <details><summary>Live scene and camera</summary><pre id="dev-scene"></pre></details>
    <div class="dev-row"><input id="dev-camera-focus" aria-label="Camera focus" placeholder="camera x,y,z"><input id="dev-camera-zoom" aria-label="Camera zoom" placeholder="zoom (optional)"><button data-dev="camera">Preview camera</button><button data-dev="camera-reset">Reset</button></div>
    <fieldset><legend>Location and state</legend><div class="dev-row"><select id="dev-area" aria-label="Preview area"></select><button data-dev="jump">Jump</button></div><div id="dev-flags"></div>
    <div class="dev-row"><select id="dev-value" aria-label="Declared value"></select><input id="dev-value-json" aria-label="Value as JSON" placeholder="JSON value"><button data-dev="value">Set</button></div></fieldset>
    <fieldset><legend>Items and evidence</legend><div class="dev-row"><select id="dev-item" aria-label="Item"></select><button data-dev="item-add">Add</button><button data-dev="item-remove">Remove</button></div><p id="dev-inventory"></p>
    <div class="dev-row"><select id="dev-evidence" aria-label="Exhibit"></select><select id="dev-stage" aria-label="Evidence stage"></select><button data-dev="evidence">Record</button></div></fieldset>
    <fieldset><legend>Action conditions</legend><select id="dev-hotspot" aria-label="Inspect hotspot"></select><div id="dev-actions"></div></fieldset>
    <fieldset><legend>Navigation and placement</legend><p>World coordinates use [x,y] on the ground; z is height. Probe an approach before saving it.</p>
    <div class="dev-row"><input id="dev-from" aria-label="Probe from" placeholder="from x,y (blank: hero)"><input id="dev-to" aria-label="Probe to" placeholder="to x,y"><button data-dev="probe">Probe</button></div>
    <div class="dev-row"><select id="dev-kind" aria-label="Placement kind"><option value="hotspot">Hotspot</option><option value="actor">Actor</option><option value="prop">Prop</option></select><select id="dev-placement" aria-label="Placement ID"></select></div>
    <div class="dev-row"><input id="dev-point" aria-label="World placement" placeholder="x,y,z"><input id="dev-walk" aria-label="Hotspot approach point" placeholder="approach x,y (optional)"><button data-dev="place">Preview</button><button data-dev="snippet">Export snippet</button></div><textarea id="dev-output" aria-label="Probe or placement output" rows="5" readonly></textarea><button data-dev="copy">Copy output</button></fieldset>
    <fieldset><legend>Checkpoints and saves</legend><div class="dev-row"><input id="dev-checkpoint-name" aria-label="Checkpoint name" placeholder="Checkpoint name"><button data-dev="checkpoint">Save checkpoint</button></div><div class="dev-row"><select id="dev-checkpoint" aria-label="Named checkpoint"></select><button data-dev="restore">Restore</button></div><div class="dev-row"><button data-dev="export">Export save into editor</button><button data-dev="import">Validate and import</button></div><textarea id="dev-save" aria-label="Development save JSON" rows="5" placeholder="Exported development save JSON"></textarea></fieldset>
    <p id="dev-feedback" role="status" aria-live="polite"></p></div>`;
  const style = document.createElement('style');
  style.textContent = `#designer-inspector{position:fixed;z-index:10000;right:8px;bottom:8px;width:min(430px,calc(100vw - 16px));color:#edf2e6;background:#11252b;border:1px solid #86b6ad;box-shadow:0 8px 35px #0009;font:12px/1.5 system-ui;border-radius:6px}#designer-inspector>summary{padding:9px 12px;cursor:pointer;font-weight:700}#designer-inspector summary small{font-weight:400;display:block;font-size:10px;color:#a9c7bb}.dev-body{padding:0 12px 12px;max-height:72dvh;overflow:auto;overscroll-behavior:contain}#designer-inspector fieldset{margin:10px 0;padding:10px;border:1px solid #486269;min-width:0}#designer-inspector legend{color:#e5bc79}#designer-inspector .dev-row{display:flex;gap:5px;margin:6px 0;align-items:center;flex-wrap:wrap}#designer-inspector input,#designer-inspector select,#designer-inspector textarea,#designer-inspector button{font:inherit;color:#eaf1e4;background:#1e3940;border:1px solid #5a777b;border-radius:3px;padding:6px;min-width:0}#designer-inspector input:not([type=checkbox]),#designer-inspector select{flex:1;width:110px}#designer-inspector input[type=checkbox]{width:auto}#designer-inspector textarea{display:block;width:100%;resize:vertical}#designer-inspector button{cursor:pointer;min-height:32px}#designer-inspector button:hover{background:#385b5d}#designer-inspector pre{white-space:pre-wrap;word-break:break-word;font-size:10px}#dev-flags{max-height:160px;overflow:auto;display:grid;grid-template-columns:1fr 1fr;gap:3px}#dev-flags label{overflow-wrap:anywhere}#dev-actions{max-height:200px;overflow:auto}#dev-actions p{padding:4px 0;border-bottom:1px solid #324b50}#dev-feedback{position:sticky;bottom:0;background:#11252b;padding:7px;border-top:1px solid #486269}#designer-inspector :focus-visible{outline:2px solid #efc976;outline-offset:2px}`;
  document.head.append(style); document.body.append(host);
  const $ = id => host.querySelector(`#${id}`);
  const output = value => { $('dev-output').value = typeof value === 'string' ? value : JSON.stringify(value, null, 2); };
  const feedback = result => {
    $('dev-feedback').textContent = result?.ok === false ? result.error || result.reason || 'Operation rejected.' : typeof result === 'string' ? result : 'Development state updated.';
    refresh();
  };
  const choices = (element, entries) => {
    const value = element.value;
    element.innerHTML = entries.map(entry => `<option value="${esc(entry.id)}">${esc(entry.name || entry.title || entry.label || entry.id)}</option>`).join('');
    if (entries.some(entry => entry.id === value)) element.value = value;
  };
  function refreshStages() {
    const exhibit = (definition.evidence || []).find(entry => entry.id === $('dev-evidence').value);
    choices($('dev-stage'), (exhibit?.stages || ['recorded']).map(id => ({id})));
  }
  function refreshPlacements() {
    const kind = $('dev-kind').value;
    const entries = kind === 'hotspot' ? definition.hotspots : kind === 'actor' ? definition.actors : definition.props || definition.areas.flatMap(area => (area.props || []).map(prop => ({...prop,area:area.id})));
    choices($('dev-placement'), entries || []);
  }
  function refreshActions() {
    $('dev-actions').innerHTML = tools.actions($('dev-hotspot').value).map(action => `<p><b>${esc(action.id)}</b> · ${action.enabled?'enabled':action.visible?'blocked':'hidden'}<br>${esc(action.reason)}${action.conditions.length?`<small>${esc(action.conditions.join('; '))}</small>`:''}</p>`).join('') || 'No actions for this hotspot.';
  }
  function refresh() {
    const {state} = getSession();
    choices($('dev-area'), definition.areas);
    choices($('dev-value'), Object.keys(state.values).map(id => ({id})));
    choices($('dev-item'), [...new Set([...(definition.items || []).map(item=>item.id),...state.inventory])].map(id=>({id,name:(definition.items||[]).find(item=>item.id===id)?.name || id})));
    choices($('dev-evidence'), definition.evidence || []);
    choices($('dev-hotspot'), definition.hotspots || []);
    choices($('dev-checkpoint'), saves.checkpoints().map(id=>({id})));
    $('dev-flags').innerHTML = Object.entries(state.flags).map(([id,value])=>`<label><input data-dev-flag="${esc(id)}" type="checkbox" ${value?'checked':''}> ${esc(id)}</label>`).join('');
    $('dev-flags').querySelectorAll('[data-dev-flag]').forEach(input=>input.onchange=()=>feedback(tools.setFlag(input.dataset.devFlag,input.checked)));
    $('dev-inventory').textContent = `Inventory: ${state.inventory.join(', ') || '(empty)'}`;
    $('dev-scene').textContent = JSON.stringify(scene.diagnostics?.() || scene.game?.debug?.snapshot?.() || {},null,2);
    refreshStages(); refreshPlacements(); refreshActions();
  }
  function point(id, dimensions = 2) {
    const raw = $(id).value.trim();
    if (!raw) return undefined;
    const value = raw.replace(/[\[\]]/g,'').split(',').map(part=>Number(part.trim()));
    if (value.length < dimensions || value.length > 3 || !value.every(Number.isFinite)) throw new Error(`Enter ${dimensions === 3 ? 'x,y,z' : 'x,y'} coordinates`);
    return value;
  }
  const handlers = {
    refresh:()=>{refresh();return 'Scene and state refreshed.';},
    jump:()=>tools.jumpArea($('dev-area').value),
    value:()=>tools.setValue($('dev-value').value,JSON.parse($('dev-value-json').value)),
    'item-add':()=>tools.setItem($('dev-item').value,true), 'item-remove':()=>tools.setItem($('dev-item').value,false),
    evidence:()=>tools.setEvidence($('dev-evidence').value,$('dev-stage').value),
    probe:()=>{if(!scene.probe)throw new Error('Scene does not expose a navigation probe');const to=point('dev-to');if(!to)throw new Error('Enter a target coordinate');output(scene.probe({area:getSession().area,from:point('dev-from'),to}));return 'Navigation result is shown below.';},
    camera:()=>{const focus=point('dev-camera-focus',3),raw=$('dev-camera-zoom').value.trim(),zoom=raw?Number(raw):undefined;if(!focus&&zoom===undefined)throw new Error('Enter a camera focus or zoom');if(zoom!==undefined&&(!Number.isFinite(zoom)||zoom<0.2||zoom>4))throw new Error('Camera zoom must be between 0.2 and 4');const camera={...(focus?{focus}:{}),...(zoom!==undefined?{zoom}:{})};scene.cue({kind:'camera',camera,duration:10000});output({camera});return 'Camera preview lasts 10 seconds. Copy the camera snippet to retain it.';},
    'camera-reset':()=>{scene.resetCamera?scene.resetCamera():scene.cue({kind:'camera',camera:{},duration:0});return 'Authored camera restored.';},
    place:()=>{if(!scene.place)throw new Error('Scene does not expose placement previews');const value=point('dev-point'),walk=point('dev-walk');if(!value)throw new Error('Enter a placement coordinate');const result=scene.place($('dev-kind').value,$('dev-placement').value,{x:value[0],y:value[1],...(value.length===3?{z:value[2]}:{}),...(walk?{walk}: {})});output(result);return result;},
    snippet:()=>{if(!scene.placementSnippet)throw new Error('Scene does not expose placement snippets');output(scene.placementSnippet($('dev-kind').value,$('dev-placement').value));return 'Copy this snippet into the case content file.';},
    copy:async()=>{await navigator.clipboard.writeText($('dev-output').value);return 'Output copied.';},
    checkpoint:()=>tools.checkpoint($('dev-checkpoint-name').value.trim()),
    restore:()=>tools.restoreCheckpoint($('dev-checkpoint').value),
    export:()=>{$('dev-save').value=saves.exportSave(getSession());return 'Development save exported into the editor.';},
    import:()=>tools.importSave($('dev-save').value),
  };
  host.querySelectorAll('[data-dev]').forEach(button=>button.onclick=async()=>{try{feedback(await handlers[button.dataset.dev]());}catch(error){feedback({ok:false,error:error.message});}});
  $('dev-evidence').onchange=refreshStages; $('dev-kind').onchange=refreshPlacements; $('dev-hotspot').onchange=refreshActions;
  $('dev-overlay').onchange=()=>{const enabled=$('dev-overlay').checked;if(scene.setDebug)scene.setDebug({navigation:enabled,hotspots:enabled,camera:enabled});else feedback({ok:false,error:'Scene overlay API is unavailable.'});};
  host.addEventListener('toggle',()=>{if(host.open){refresh();$('dev-area').focus();}else onChange();});
  const timer=setInterval(()=>{if(host.open)$('dev-scene').textContent=JSON.stringify(scene.diagnostics?.() || {},null,2);},700);
  refresh();
  return { tools, refresh, element:host, dispose(){clearInterval(timer);host.remove();style.remove();} };
}
