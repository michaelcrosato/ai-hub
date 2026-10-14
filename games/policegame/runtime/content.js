/** Definition checks run before play; callbacks are registered extension points. */
export function flattenActions(definition) {
  return Array.isArray(definition.actions) ? definition.actions :
    Object.entries(definition.actions || {}).flatMap(([hotspot, actions]) =>
      actions.map((action) => ({ ...action, hotspot })));
}
export function validateContent(definition) {
  const errors = [], warnings = [];
  const error = (path, message) => errors.push({ path, message });
  const warn = (path, message) => warnings.push({ path, message });
  const list = (value, path) => {
    if (value === undefined) return [];
    if (!Array.isArray(value)) { error(path, "Expected an array"); return []; }
    return value.filter((entry, index) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) { error(`${path}[${index}]`, "Expected an object"); return false; }
      return true;
    });
  };
  if (!definition || typeof definition !== "object")
    return { valid: false, errors: [{ path: "definition", message: "Expected an object" }], warnings };
  if (typeof definition.id !== "string" || !definition.id.trim()) error("id", "Expected a stable nonempty case ID");
  if (!Number.isInteger(definition.version) || definition.version < 1) error("version", "Expected a positive integer content version");
  const sets = {};
  for (const group of ["areas", "hotspots", "actors", "items", "evidence", "conversations", "puzzles", "sequences", "objectives", "outcomes", "assets"]) {
    sets[group] = new Set();
    if (definition[group] !== undefined && !Array.isArray(definition[group])) { error(group, "Expected an array"); continue; }
    (definition[group] || []).forEach((entry, index) => {
      const path = `${group}[${index}].id`;
      if (!entry || typeof entry.id !== "string" || !entry.id) error(path, "Expected a nonempty ID");
      else if (sets[group].has(entry.id)) error(path, `Duplicate ID '${entry.id}'`);
      else sets[group].add(entry.id);
    });
  }
  for (const group of ["areas", "hotspots", "outcomes"]) if (!definition[group]?.length) error(group, "A playable case needs at least one entry");
  if (errors.length) return { valid: false, errors, warnings };
  if (definition.player) sets.actors.add(definition.player.id || "player");
  const ref = (group, id, path) => {
    if (typeof id !== "string" || !id) error(path, "Expected a referenced ID");
    else if (!sets[group]?.has(id)) error(path, `Unknown ${group} ID '${id}'`);
  };
  const extension = (group, name, path) => {
    if (typeof definition.extensions?.[group]?.[name] !== "function") error(path, `Unregistered ${group} extension '${name}'`);
  };
  const initial = typeof definition.initialState === "object" ? definition.initialState : {};
  const flags = new Set(Object.keys(definition.flags || initial.flags || {}));
  const values = new Set(Object.keys(definition.values || initial.values || {}));
  let actions;
  if (Array.isArray(definition.actions)) actions = list(definition.actions, "actions");
  else if (definition.actions && typeof definition.actions === "object") actions = Object.entries(definition.actions).flatMap(([hotspot, entries]) => list(entries, `actions.${hotspot}`).map((action) => ({ ...action, hotspot })));
  else { error("actions", "Expected an action array or hotspot action map"); actions = []; }
  const actionIds = new Set();
  for (const [i, action] of actions.entries()) {
    const key = `${action.hotspot}/${action.id}`;
    if (actionIds.has(key)) error(`actions[${i}].id`, `Duplicate action '${key}'`);
    actionIds.add(key);
  }
  function condition(value, path) {
    if (value == null || typeof value === "boolean") return;
    if (typeof value === "function") { warn(path, "Callback requires route tests; static dependency analysis is incomplete"); return; }
    if (typeof value !== "object" || Array.isArray(value)) { error(path, "Expected a condition object or callback"); return; }
    const operators = ["all", "any", "not", "flag", "value", "item", "evidence", "completed", "custom", "conversation", "puzzle"];
    if (operators.filter((key) => Object.hasOwn(value, key)).length !== 1) error(path, "Use exactly one condition operator; combine conditions with all/any/not");
    for (const op of ["all", "any"]) if (Object.hasOwn(value, op)) {
      if (!Array.isArray(value[op])) error(`${path}.${op}`, "Expected an array");
      else value[op].forEach((part, index) => condition(part, `${path}.${op}[${index}]`));
    }
    if (value.not !== undefined) condition(value.not, `${path}.not`);
    if (value.flag && !flags.has(value.flag)) error(`${path}.flag`, `Unknown flag '${value.flag}'`);
    if (value.value && !values.has(value.value)) error(`${path}.value`, `Unknown value '${value.value}'`);
    if (value.item) ref("items", value.item, `${path}.item`);
    if (value.evidence) ref("evidence", value.evidence, `${path}.evidence`);
    if (value.evidence && value.stage) {
      const exhibit = (definition.evidence || []).find((entry) => entry.id === value.evidence);
      if (exhibit?.stages && !exhibit.stages.includes(value.stage)) error(`${path}.stage`, "Evidence stage is not declared");
    }
    if (value.completed && !actionIds.has(value.completed)) error(`${path}.completed`, `Unknown action '${value.completed}'`);
    if (value.custom) extension("conditions", value.custom, `${path}.custom`);
    if (value.conversation) ref("conversations", value.conversation, `${path}.conversation`);
    if (value.puzzle) ref("puzzles", value.puzzle, `${path}.puzzle`);
    if (!Object.keys(value).some((key) => ["all", "any", "not", "flag", "value", "item", "evidence", "completed", "custom", "conversation", "puzzle"].includes(key)))
      error(path, "Unknown condition operator");
  }
  function effects(value, path) {
    if (value == null) return;
    if (typeof value === "function") { warn(path, "Callback effects require route tests"); return; }
    if (Array.isArray(value)) { value.forEach((effect, index) => effects(effect, `${path}[${index}]`)); return; }
    if (typeof value !== "object") { error(path, "Expected effect object, array, or callback"); return; }
    if (value.when !== undefined && value.then !== undefined) {
      condition(value.when, `${path}.when`); effects(value.then, `${path}.then`); effects(value.else, `${path}.else`); return;
    }
    const groups = { item: "items", evidence: "evidence", conversation: "conversations", puzzle: "puzzles", solvePuzzle: "puzzles", sequence: "sequences" };
    if (groups[value.type]) ref(groups[value.type], value.id, `${path}.id`);
    else if (value.type === "flag") { if (!flags.has(value.id)) error(`${path}.id`, `Unknown flag '${value.id}'`); }
    else if (value.type === "value") { if (!values.has(value.id)) error(`${path}.id`, `Unknown value '${value.id}'`); }
    else if (value.type === "custom") extension("effects", value.name, `${path}.name`);
    else if (value.type === "complete") { if (value.outcome) ref("outcomes", value.outcome, `${path}.outcome`); }
    else if (value.type === "travel") ref("areas", value.area, `${path}.area`);
    else if (value.type === "score") { if (!Number.isFinite(value.points)) error(`${path}.points`, "Expected finite score points"); }
    else if (!["mistake", "log"].includes(value.type)) error(`${path}.type`, `Unknown effect type '${value.type}'`);
    if (value.type === "evidence" && value.stage) {
      const exhibit = (definition.evidence || []).find((entry) => entry.id === value.id);
      if (exhibit?.stages && !exhibit.stages.includes(value.stage)) error(`${path}.stage`, "Evidence stage is not declared");
    }
  }
  function result(value, path) {
    if (value?.custom) extension("results", value.custom, `${path}.custom`);
    else if (value !== undefined && typeof value !== "function" && (!value || ["title", "text", "kind"].some((key) => typeof value[key] !== "string"))) error(path, "Result needs title, text and kind strings");
  }
  const inventory = definition.initialInventory || definition.inventory || [];
  if (!Array.isArray(inventory)) error("initialInventory", "Expected item IDs");
  else inventory.forEach((id, i) => ref("items", id, `initialInventory[${i}]`));
  ref("areas", definition.startArea, "startArea");
  ref("hotspots", definition.startHotspot, "startHotspot");
  for (const [i, area] of (definition.areas || []).entries()) {
    condition(area.when, `areas[${i}].when`);
    if (area.painter) extension("painters", area.painter, `areas[${i}].painter`);
    if (area.bounds && (!Array.isArray(area.bounds) || area.bounds.length !== 4 || !area.bounds.every(Number.isFinite) || area.bounds[0] >= area.bounds[2] || area.bounds[1] >= area.bounds[3]))
      error(`areas[${i}].bounds`, "Expected [minX,minY,maxX,maxY] with positive dimensions");
    if (area.spawn && (!Array.isArray(area.spawn) || area.spawn.length !== 2 || !area.spawn.every(Number.isFinite))) error(`areas[${i}].spawn`, "Expected finite [x,y]");
    if (Array.isArray(area.bounds) && area.bounds.length === 4 && area.spawn && !walkable(area.spawn, area)) error(`areas[${i}].spawn`, "Spawn is outside navigation bounds or inside an obstacle");
    if (area.obstacles !== undefined && (!Array.isArray(area.obstacles) || area.obstacles.some((rect) => !Array.isArray(rect) || rect.length !== 4 || !rect.every(Number.isFinite) || rect[0] > rect[2] || rect[1] > rect[3]))) error(`areas[${i}].obstacles`, "Expected finite [minX,minY,maxX,maxY] rectangles");
    if (area.camera) {
      for (const [key, size] of [["focus", 3], ["fit", 2]]) if (area.camera[key] && (!Array.isArray(area.camera[key]) || area.camera[key].length !== size || !area.camera[key].every(Number.isFinite))) error(`areas[${i}].camera.${key}`, `Expected ${size} finite coordinates`);
      for (const key of ["zoom", "yaw"]) if (area.camera[key] !== undefined && !Number.isFinite(area.camera[key])) error(`areas[${i}].camera.${key}`, "Expected a finite number");
    }
    for (const group of ["props", "entrances"]) {
      const ids = new Set();
      list(area[group], `areas[${i}].${group}`).forEach((entry, j) => {
        if (!entry.id || ids.has(entry.id)) error(`areas[${i}].${group}[${j}].id`, "Expected a unique local ID");
        ids.add(entry.id);
        condition(entry.visible, `areas[${i}].${group}[${j}].visible`);
        if (entry.to) ref("areas", entry.to, `areas[${i}].${group}[${j}].to`);
        if (entry.asset) ref("assets", entry.asset, `areas[${i}].${group}[${j}].asset`);
      });
    }
  }
  for (const [i, spot] of (definition.hotspots || []).entries()) {
    ref("areas", spot.area, `hotspots[${i}].area`);
    if (spot.actor) ref("actors", spot.actor, `hotspots[${i}].actor`);
    const area = (definition.areas || []).find((entry) => entry.id === spot.area);
    if (spot.walk && Array.isArray(area?.bounds) && area.bounds.length === 4 && Array.isArray(area.obstacles || [])) {
      if (!walkable(spot.walk, area)) error(`hotspots[${i}].walk`, "Approach point is outside navigation bounds or inside an obstacle");
      else if (area.spawn) {
        const path = reachable(area.spawn, spot.walk, area);
        if (path === null) warn(`hotspots[${i}].walk`, "Reachability unverified: navigation exceeds the 100000-cell diagnostic bound");
        else if (!path) error(`hotspots[${i}].walk`, "Approach point is unreachable from the area spawn");
      }
    }
  }
  for (const [i, actor] of (definition.actors || []).entries()) {
    ref("areas", actor.area, `actors[${i}].area`);
    list(actor.poses, `actors[${i}].poses`).forEach((pose, j) => condition(pose.when, `actors[${i}].poses[${j}].when`));
  }
  actions.forEach((action, i) => {
    const path = `actions[${i}]`;
    ref("hotspots", action.hotspot, `${path}.hotspot`);
    if (!action.id || typeof action.label !== "string") error(path, "Action needs an ID and a label");
    condition(action.visibleWhen, `${path}.visibleWhen`); condition(action.when ?? action.enabled, `${path}.when`);
    if (typeof action.once === "string" && !flags.has(action.once)) error(`${path}.once`, `Unknown flag '${action.once}'`);
    effects(action.effects, `${path}.effects`); result(action.result, `${path}.result`);
  });
  for (const group of ["items", "evidence"]) (definition[group] || []).forEach((item, i) => {
    list(item.uses || item.presentations, `${group}[${i}].uses`).forEach((use, j) => {
      const path = `${group}[${i}].uses[${j}]`;
      ref("hotspots", use.target, `${path}.target`); condition(use.when, `${path}.when`);
      if (use.action && !actionIds.has(`${use.target}/${use.action}`)) error(`${path}.action`, `Unknown action '${use.target}/${use.action}'`);
      effects(use.effects, `${path}.effects`); result(use.result, `${path}.result`);
    });
    if (item.mediaAsset) ref("assets", item.mediaAsset, `${group}[${i}].mediaAsset`);
    if (group === "evidence") {
      if (item.related !== undefined && !Array.isArray(item.related)) error(`${group}[${i}].related`, "Expected evidence IDs");
      else (item.related || []).forEach((id, j) => ref("evidence", id, `${group}[${i}].related[${j}]`));
      list(item.relationships, `${group}[${i}].relationships`).forEach((relation, j) => ref("evidence", relation.evidence, `${group}[${i}].relationships[${j}].evidence`));
      if (item.stages && (!Array.isArray(item.stages) || !item.stages.length || item.stages.some((stage) => typeof stage !== "string") || new Set(item.stages).size !== item.stages.length)) error(`${group}[${i}].stages`, "Expected unique stage names");
      if (item.initialStage && Array.isArray(item.stages) && !item.stages.includes(item.initialStage)) error(`${group}[${i}].initialStage`, "Initial stage is not declared");
      for (const [from, destinations] of Object.entries(item.transitions || {})) {
        if (!item.stages?.includes(from) || !Array.isArray(destinations) || destinations.some((to) => !item.stages?.includes(to))) error(`${group}[${i}].transitions.${from}`, "Transition stages must be declared");
      }
    }
  });
  for (const group of ["objectives", "outcomes"]) (definition[group] || []).forEach((entry, i) => condition(entry.when, `${group}[${i}].when`));
  (definition.conversations || []).forEach((conversation, i) => {
    const base = `conversations[${i}]`, entries = list(conversation.nodes, `${base}.nodes`), nodes = new Set(entries.map((node) => node.id));
    if (conversation.actor || conversation.actorId) ref("actors", conversation.actor || conversation.actorId, `${base}.actor`);
    if (!nodes.has(conversation.start)) error(`${base}.start`, `Unknown node '${conversation.start}'`);
    if (nodes.size !== entries.length) error(`${base}.nodes`, "Duplicate node IDs");
    entries.forEach((node, j) => {
      if (typeof node.id !== "string" || !node.id) error(`${base}.nodes[${j}].id`, "Expected a nonempty node ID");
      effects(node.effects, `${base}.nodes[${j}].effects`);
      const choices = new Set();
      list(node.choices, `${base}.nodes[${j}].choices`).forEach((choice, k) => {
        const path = `${base}.nodes[${j}].choices[${k}]`;
        if (choices.has(choice.id)) error(`${path}.id`, `Duplicate choice '${choice.id}'`); choices.add(choice.id);
        if (choice.to && !nodes.has(choice.to)) error(`${path}.to`, `Unknown node '${choice.to}'`);
        condition(choice.when, `${path}.when`); condition(choice.visibleWhen, `${path}.visibleWhen`); effects(choice.effects, `${path}.effects`);
      });
    });
  });
  (definition.puzzles || []).forEach((puzzle, i) => {
    if (!["choice", "clock", "timeline", "order", "custom"].includes(puzzle.type)) error(`puzzles[${i}].type`, `Unknown puzzle primitive '${puzzle.type}'`);
    if (puzzle.type === "custom") extension("puzzles", puzzle.handler, `puzzles[${i}].handler`);
    if (puzzle.type === "clock" && !Number.isFinite(puzzle.offsetMinutes)) error(`puzzles[${i}].offsetMinutes`, "Clock correction needs a finite number of minutes");
    const ids = new Set();
    list(puzzle.choices, `puzzles[${i}].choices`).forEach((choice, j) => {
      if (!choice.id || ids.has(choice.id)) error(`puzzles[${i}].choices[${j}].id`, "Expected unique choice ID");
      ids.add(choice.id); condition(choice.when, `puzzles[${i}].choices[${j}].when`);
    });
    effects(puzzle.onSuccess, `puzzles[${i}].onSuccess`); effects(puzzle.onFailure, `puzzles[${i}].onFailure`);
  });
  (definition.sequences || []).forEach((sequence, i) => {
    const ids = new Set();
    list(sequence.steps, `sequences[${i}].steps`).forEach((step, j) => {
      const id = step.id || String(j);
      if (ids.has(id)) error(`sequences[${i}].steps[${j}].id`, `Duplicate sequence step '${id}'`);
      ids.add(id); effects(step.effects, `sequences[${i}].steps[${j}].effects`);
      if (step.actor) ref("actors", step.actor, `sequences[${i}].steps[${j}].actor`);
      if (step.asset) ref("assets", step.asset, `sequences[${i}].steps[${j}].asset`);
    });
  });
  return { valid: errors.length === 0, errors, warnings };
}
export function assertContent(definition) {
  const report = validateContent(definition);
  if (!report.valid) throw new Error(report.errors.map((entry) => `${entry.path}: ${entry.message}`).join("\n"));
  return definition;
}
function walkable(point, area) {
  if (!Array.isArray(point) || point.length < 2 || !point.slice(0, 2).every(Number.isFinite)) return false;
  const [x, y] = point, [left, top, right, bottom] = area.bounds;
  return x >= left && x <= right && y >= top && y <= bottom &&
    !(Array.isArray(area.obstacles) ? area.obstacles : []).some((rect) => Array.isArray(rect) && x >= rect[0] && x <= rect[2] && y >= rect[1] && y <= rect[3]);
}
function reachable(start, target, area) {
  if (!walkable(start, area)) return false;
  // Small-grid diagnostic, not a replacement for the engine's exact navigation mask.
  const step = area.navigationStep || 4, [left, top, right, bottom] = area.bounds;
  const w = Math.ceil((right - left) / step) + 1, h = Math.ceil((bottom - top) / step) + 1;
  if (w * h > 100000) return null;
  const cell = ([x, y]) => [Math.round((x - left) / step), Math.round((y - top) / step)];
  const [sx, sy] = cell(start), [tx, ty] = cell(target), queue = [[sx, sy]], seen = new Set([`${sx},${sy}`]);
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i]; if (Math.abs(x - tx) + Math.abs(y - ty) <= 1) return true;
    for (const [nx, ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]) {
      const key = `${nx},${ny}`;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen.has(key) || !walkable([left + nx * step, top + ny * step], area)) continue;
      seen.add(key); queue.push([nx, ny]);
    }
  }
  return false;
}
