import { flattenActions } from "./content.js";
import { addItem, removeItem, itemUses } from "./inventory.js";
import { recordEvidence, projectEvidence } from "./evidence.js";
import { conversationView as viewConversation, startConversation, chooseConversation as choose } from "./conversations.js";
import { submitPuzzle } from "./puzzles.js";
import { startSequence, advanceSequence, pauseSequence } from "./presentation.js";

const clone = (value) => structuredClone(value);
const plain = (value) => !!value && typeof value === "object" && !Array.isArray(value);
function serializable(value, seen = new WeakSet()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (!value || typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  const valid = Object.values(value).every((child) => serializable(child, seen));
  seen.delete(value);
  return valid;
}
export function evaluateCondition(state, expression, definition = {}) {
  if (expression == null) return true;
  if (typeof expression === "boolean") return expression;
  if (typeof expression === "function") return !!expression(state, { definition });
  if (expression.all) return expression.all.every((part) => evaluateCondition(state, part, definition));
  if (expression.any) return expression.any.some((part) => evaluateCondition(state, part, definition));
  if (expression.not !== undefined) return !evaluateCondition(state, expression.not, definition);
  if (expression.flag) return state.flags[expression.flag] === (expression.is ?? true);
  if (expression.item) return state.inventory.includes(expression.item);
  if (expression.evidence) return state.evidence.includes(expression.evidence) &&
    (!expression.stage || state.evidenceState?.[expression.evidence]?.stage === expression.stage);
  if (expression.completed) return !!state.completedActions?.includes(expression.completed);
  if (expression.conversation) return !!state.conversation?.[expression.conversation]?.ended;
  if (expression.puzzle) return !!state.puzzles?.[expression.puzzle]?.solved;
  if (expression.value) {
    const value = state.values[expression.value];
    if (Object.hasOwn(expression, "eq")) return Object.is(value, expression.eq);
    if (Object.hasOwn(expression, "gte")) return value >= expression.gte;
    if (Object.hasOwn(expression, "lte")) return value <= expression.lte;
    return !!value;
  }
  if (expression.custom) {
    const fn = definition.extensions?.conditions?.[expression.custom];
    if (!fn) throw new Error(`Unknown condition '${expression.custom}'`);
    return !!fn(state, expression, { definition });
  }
  throw new Error(`Unknown condition: ${JSON.stringify(expression)}`);
}
export function createAdventure(definition) {
  const actions = flattenActions(definition);
  const result = (title, text, kind = "story", speaker) => ({ title, text, kind, ...(speaker ? { speaker } : {}) });
  const warning = (text) => result("A step comes first", text, "warning");
  const condition = (state, expression) => evaluateCondition(state, expression, definition);
  function freshCase() {
    const initial = typeof definition.initialState === "function" ? definition.initialState() : clone(definition.initialState || {});
    return {
      version: definition.version || 1, caseId: definition.id,
      flags: clone(definition.flags || {}), values: clone(definition.values || {}),
      inventory: clone(definition.initialInventory || definition.inventory || []), evidence: [], evidenceState: {},
      log: clone(definition.initialLog || []), mistakes: [], completed: false, phase: 1,
      completedActions: [], conversation: {}, puzzles: {}, presentation: {},
      activeConversation: null, activePuzzle: null, outcome: null,
      activeSequence: null, area: definition.startArea || null, scoreBonus: 0, scoreEvents: [],
      ...initial,
    };
  }
  function validateCase(value) {
    if (!plain(value) || value.version !== (definition.version || 1) ||
        (value.caseId !== undefined && value.caseId !== definition.id)) return false;
    const initial = freshCase();
    if (!plain(value.flags) || Object.keys(initial.flags).some((key) => typeof value.flags[key] !== typeof initial.flags[key])) return false;
    if (!Array.isArray(value.inventory) || value.inventory.some((id) => typeof id !== "string") || new Set(value.inventory).size !== value.inventory.length) return false;
    if (!Array.isArray(value.evidence) || value.evidence.some((id) => !(definition.evidence || []).some((entry) => entry.id === id)) || new Set(value.evidence).size !== value.evidence.length) return false;
    if (!Number.isInteger(value.phase) || value.phase < 1 || typeof value.completed !== "boolean") return false;
    if (!Array.isArray(value.log) || value.log.length > 5000 || value.log.some((entry) => !plain(entry) || ["id", "title", "text", "kind"].some((key) => typeof entry[key] !== "string"))) return false;
    if (!Array.isArray(value.mistakes) || value.mistakes.length > 1000 || value.mistakes.some((entry) => !plain(entry) || typeof entry.id !== "string" || typeof entry.text !== "string" || !Number.isFinite(entry.penalty) || entry.penalty < 0)) return false;
    if (value.values !== undefined && (!plain(value.values) || Object.keys(initial.values).some((key) => !Object.hasOwn(value.values, key) || typeof value.values[key] !== typeof initial.values[key]))) return false;
    if (value.values === undefined && Object.keys(initial.values).length) return false;
    if (value.scoreBonus !== undefined && !Number.isFinite(value.scoreBonus)) return false;
    if (value.scoreEvents !== undefined && (!Array.isArray(value.scoreEvents) || value.scoreEvents.some((id) => typeof id !== "string"))) return false;
    if (value.area != null && !(definition.areas || []).some((area) => area.id === value.area) && definition.areas?.length) return false;
    if (value.completedActions !== undefined && (!Array.isArray(value.completedActions) || value.completedActions.some((key) => typeof key !== "string"))) return false;
    for (const key of ["evidenceState", "conversation", "puzzles", "presentation"]) if (value[key] !== undefined && !plain(value[key])) return false;
    for (const [id, saved] of Object.entries(value.conversation || {})) {
      const conversation = (definition.conversations || []).find((entry) => entry.id === id);
      if (!conversation || !plain(saved) || !conversation.nodes.some((node) => node.id === saved.node) || !Array.isArray(saved.visited) || typeof saved.ended !== "boolean") return false;
    }
    for (const [id, saved] of Object.entries(value.puzzles || {})) {
      if (!(definition.puzzles || []).some((entry) => entry.id === id) || !plain(saved) || typeof saved.solved !== "boolean" || !Number.isInteger(saved.attempts) || saved.attempts < 0) return false;
    }
    for (const [id, saved] of Object.entries(value.evidenceState || {})) {
      const exhibit = (definition.evidence || []).find((entry) => entry.id === id);
      if (!exhibit || !value.evidence.includes(id) || !plain(saved) || typeof saved.stage !== "string" || !Array.isArray(saved.history) || !saved.history.length || saved.history.some((entry) => !plain(entry) || typeof entry.stage !== "string" || typeof entry.note !== "string" || (exhibit.stages && !exhibit.stages.includes(entry.stage)))) return false;
      if (exhibit.stages && !exhibit.stages.includes(saved.stage)) return false;
      if (saved.history.at(-1).stage !== saved.stage) return false;
      for (let i = 1; i < saved.history.length; i++) {
        const from = saved.history[i - 1].stage, to = saved.history[i].stage;
        if (from !== to && exhibit.transitions && !(exhibit.transitions[from] || []).includes(to)) return false;
      }
    }
    for (const [id, saved] of Object.entries(value.presentation || {})) {
      const sequence = (definition.sequences || []).find((entry) => entry.id === id);
      if (!sequence || !plain(saved) || !Number.isInteger(saved.index) || saved.index < 0 || saved.index > sequence.steps.length || !Array.isArray(saved.applied) || typeof saved.paused !== "boolean" || typeof saved.completed !== "boolean") return false;
      if (saved.area != null && !(definition.areas || []).some((area) => area.id === saved.area)) return false;
      const stepKeys = sequence.steps.map((step, index) => step.id || String(index));
      if (new Set(saved.applied).size !== saved.applied.length || saved.applied.some((id) => !stepKeys.includes(id))) return false;
      if (saved.current != null && (!plain(saved.current) || saved.current.sequence !== id || !Number.isInteger(saved.current.index) || saved.current.index < 0 || saved.current.index >= sequence.steps.length || saved.current.index !== saved.index - 1 || saved.current.id !== sequence.steps[saved.current.index].id)) return false;
    }
    if (value.activeConversation && !value.conversation?.[value.activeConversation]) return false;
    if (value.activePuzzle && !(definition.puzzles || []).some((entry) => entry.id === value.activePuzzle)) return false;
    if (value.activeSequence && !value.presentation?.[value.activeSequence]) return false;
    if (value.outcome && !(definition.outcomes || []).some((entry) => entry.id === value.outcome)) return false;
    if (definition.validate && !definition.validate(value)) return false;
    if (!serializable(value)) return false;
    try { JSON.stringify(value); } catch { return false; }
    return true;
  }
  function restoreCase(value) {
    if (!validateCase(value)) return freshCase();
    const state = freshCase();
    for (const key of Object.keys(state)) if (Object.hasOwn(value, key)) state[key] = clone(value[key]);
    state.caseId = definition.id;
    refresh(state);
    return state;
  }
  function refresh(state) {
    definition.refresh?.(state);
    if (!definition.refresh) {
      if (state.completed) {
        state.phase = Math.max(1, ...(definition.objectives || []).map((entry) => entry.phase || 1));
        return;
      }
      const active = (definition.objectives || []).find((entry) => condition(state, entry.when));
      if (active?.phase) state.phase = active.phase;
    }
  }
  function responseFor(value, state, context) {
    if (typeof value === "function") return value(state, context);
    if (value?.custom) {
      const handler = definition.extensions?.results?.[value.custom];
      if (!handler) throw new Error(`Unknown result '${value.custom}'`);
      return handler(state, context, value);
    }
    return clone(value || result("Recorded", "Your action is recorded.", "success"));
  }
  function helpers(state, action) {
    const context = { definition, action, result,
      set: (...flags) => flags.forEach((flag) => { state.flags[flag] = true; }),
      gain: (...ids) => { const added = ids.filter((id) => !state.evidence.includes(id)); ids.forEach((id) => recordEvidence(state, definition, id)); return added; },
      warn: (id, penalty, title, text) => {
        if (!state.mistakes.some((entry) => entry.id === id)) state.mistakes.push({ id, text: title, penalty });
        return result(title, text, "warning");
      },
    };
    context.apply = (effects) => applyEffects(state, effects, context);
    return context;
  }
  function applyEffects(state, effects, context = helpers(state)) {
    if (effects == null) return;
    if (typeof effects === "function") { effects(state, context); return; }
    if (Array.isArray(effects)) { effects.forEach((effect) => applyEffects(state, effect, context)); return; }
    if (effects.when !== undefined && effects.then !== undefined) {
      applyEffects(state, condition(state, effects.when) ? effects.then : effects.else, context); return;
    }
    const e = effects;
    switch (e.type) {
      case "flag": state.flags[e.id] = e.value ?? true; break;
      case "value": state.values[e.id] = e.add !== undefined ? (state.values[e.id] || 0) + e.add : clone(e.value); break;
      case "travel":
        if (!(definition.areas || []).some((area) => area.id === e.area)) throw new Error(`Unknown travel area '${e.area}'`);
        if (!condition(state, definition.areas.find((area) => area.id === e.area).when)) throw new Error(`Travel area '${e.area}' prerequisites are not satisfied`);
        state.area = e.area; break;
      case "score":
        if (!Number.isFinite(e.points)) throw new Error("Score effect needs finite points");
        if (!e.id || !state.scoreEvents.includes(e.id)) {
          state.scoreBonus += e.points;
          if (e.id) state.scoreEvents.push(e.id);
        }
        break;
      case "item": e.operation === "remove" ? removeItem(state, e.id) : addItem(state, e.id); break;
      case "evidence": recordEvidence(state, definition, e.id, e); break;
      case "mistake": if (!state.mistakes.some((entry) => entry.id === e.id)) state.mistakes.push({ id: e.id, text: e.text, penalty: e.penalty }); break;
      case "complete": {
        const outcome = e.outcome || (definition.outcomes || []).find((entry) => condition(state, entry.when))?.id;
        if (outcome && !(definition.outcomes || []).some((entry) => entry.id === outcome)) throw new Error(`Unknown outcome '${outcome}'`);
        if (outcome && !condition(state, definition.outcomes.find((entry) => entry.id === outcome).when)) throw new Error(`Outcome '${outcome}' prerequisites are not satisfied`);
        state.outcome = outcome || null; state.completed = true; break;
      }
      case "conversation": startConversation(state, definition, e.id, context.apply); state.activeConversation = e.id; break;
      case "puzzle": state.activePuzzle = e.id; break;
      case "solvePuzzle": submitPuzzle(state, definition, e.id, e.answer, context.apply); break;
      case "sequence": startSequence(state, definition, e.id); state.activeSequence = e.id; break;
      case "log": if (!state.log.some((entry) => entry.id === e.id)) state.log.push({ id: e.id, title: e.title, text: e.text, kind: e.kind || "story" }); break;
      case "custom": {
        const handler = definition.extensions?.effects?.[e.name];
        if (!handler) throw new Error(`Unknown effect '${e.name}'`);
        handler(state, e, context); break;
      }
      default: throw new Error(`Unknown effect type '${e.type}'`);
    }
  }
  function exposed(state, action) {
    const key = `${action.hotspot}/${action.id}`;
    if (action.once === true && state.completedActions.includes(key)) return false;
    if (typeof action.once === "string" && state.flags[action.once]) return false;
    return condition(state, action.visibleWhen);
  }
  function actionsFor(state, hotspot) {
    return actions.filter((action) => action.hotspot === hotspot && exposed(state, action))
      .map((action) => ({ id: action.id, label: action.label,
        ...(!condition(state, action.when ?? action.enabled) ? { disabled: true, reason: typeof action.reason === "function" ? action.reason(state) : action.reason || "A step comes first." } : {}),
      }));
  }
  function finalize(state, previousEvidence, response, id) {
    refresh(state);
    const added = state.evidence.filter((entry) => !previousEvidence.includes(entry));
    if (added.length) response.newEvidence = added;
    if (id && !state.log.some((entry) => entry.id === id)) state.log.push({ id, title: response.title, text: response.text, kind: response.kind });
    return response;
  }
  function act(state, hotspot, id) {
    const action = actions.find((entry) => entry.hotspot === hotspot && entry.id === id && exposed(state, entry));
    if (!action) return warning("That action is no longer available. Review the current objective for your next step.");
    if (!condition(state, action.when ?? action.enabled)) return warning(typeof action.reason === "function" ? action.reason(state) : action.reason || "A step comes first.");
    if (action.readOnly || state.completed) {
      const detached = clone(state), context = helpers(detached, action);
      return action.run ? action.run(detached, context) : responseFor(action.result, detached, context);
    }
    const before = [...state.evidence], context = helpers(state, action), wasCompleted = state.completed;
    const response = action.run ? action.run(state, context) : (applyEffects(state, action.effects, context), responseFor(action.result, state, context));
    // Review actions on a finished case must remain observational.
    if (!wasCompleted) {
      const key = `${hotspot}/${id}`;
      if (!state.completedActions.includes(key)) state.completedActions.push(key);
      return finalize(state, before, response, action.record === false ? null : key);
    }
    return response;
  }
  function objective(state) {
    if (definition.objective) return definition.objective(state);
    if (state.completed) {
      const outcome = (definition.outcomes || []).find((entry) => entry.id === state.outcome);
      return { chapter: "CASE CLOSED", title: outcome?.title || "Case closed", detail: outcome?.ending || "Review your case record." };
    }
    const value = (definition.objectives || []).find((entry) => condition(state, entry.when));
    if (value) { const { when, ...projection } = value; return clone(projection); }
    return { chapter: state.completed ? "CASE CLOSED" : "INVESTIGATION", title: definition.title, detail: state.completed ? "Review your case record." : "Explore the available points of interest." };
  }
  function score(state) {
    if (definition.score) return definition.score(state);
    const milestones = definition.scoring?.milestones || [];
    const total = milestones.reduce((sum, entry) => sum + entry.points, 0);
    const earned = milestones.reduce((sum, entry) => sum + (condition(state, entry.when || { flag: entry.flag }) ? entry.points : 0), 0);
    return Math.max(0, Math.min(100, (total ? Math.round(earned * 100 / total) : state.completed ? 100 : 0) + (state.scoreBonus || 0) - state.mistakes.reduce((sum, entry) => sum + entry.penalty, 0)));
  }
  function caseSummary(state) {
    if (definition.summary || definition.caseSummary) return (definition.summary || definition.caseSummary)(state);
    const outcome = (definition.outcomes || []).find((entry) => entry.id === state.outcome) || {};
    const value = score(state);
    return { title: outcome.title || definition.title, completed: state.completed, score: value,
      rating: (definition.scoring?.ratings || []).find((entry) => value >= entry.min)?.label || (state.completed ? "Case complete" : "Investigation in progress"),
      evidenceCount: state.evidence.length, findings: clone(outcome.findings || []), nextSteps: clone(outcome.nextSteps || []),
      mistakes: clone(state.mistakes), ending: outcome.ending || objective(state).detail, outcome: state.outcome,
    };
  }
  function conversationView(state) {
    if (!state.activeConversation) return null;
    const view = viewConversation(state, definition, state.activeConversation, (expression) => condition(state, expression));
    const def = definition.conversations.find((entry) => entry.id === view.id);
    return { ...view, actorId: def.actor || def.actorId };
  }
  function chooseConversation(state, choiceId) {
    if (!state.activeConversation) return warning("No conversation is active.");
    const id = state.activeConversation, before = [...state.evidence];
    const view = choose(state, definition, id, choiceId, (expression) => condition(state, expression), helpers(state).apply);
    if (!view.ok) return warning(view.reason);
    return finalize(state, before, result(view.ended ? "Conversation recorded" : "Conversation", view.text || "The conversation continues.", "story", view.speaker), `conversation/${id}/${view.node}/${choiceId}`);
  }
  function puzzleView(state) {
    if (!state.activePuzzle) return null;
    const puzzle = definition.puzzles.find((entry) => entry.id === state.activePuzzle);
    if (!puzzle) return null;
    return { id: puzzle.id, title: puzzle.title || "Reconstruction", text: puzzle.text || "Choose the supported answer.", hint: puzzle.hint,
      solved: !!state.puzzles[puzzle.id]?.solved,
      choices: (puzzle.choices || []).map((choice) => ({ id: choice.id, label: choice.label, disabled: !condition(state, choice.when), reason: choice.reason })),
    };
  }
  function choosePuzzle(state, choiceId) {
    const puzzle = (definition.puzzles || []).find((entry) => entry.id === state.activePuzzle);
    const choice = puzzle?.choices?.find((entry) => entry.id === choiceId);
    if (!puzzle || !choice || !condition(state, choice.when)) return warning("That puzzle choice is unavailable.");
    const before = [...state.evidence];
    const solved = submitPuzzle(state, definition, puzzle.id, choice.value ?? choice.id, helpers(state).apply);
    const response = responseFor(solved.ok ? puzzle.successResult : puzzle.failureResult, state, helpers(state));
    if (!solved.ok && !puzzle.failureResult) Object.assign(response, warning("That answer does not fit the evidence. You can try again."));
    return finalize(state, before, response, `puzzle/${puzzle.id}/${choiceId}`);
  }
  function useBinding(state, bindings, target, fallback, itemId) {
    const binding = (bindings || []).find((entry) => entry.target === target && condition(state, entry.when) && (!entry.action || actionsFor(state, target).some((a) => a.id === entry.action && !a.disabled)));
    if (!binding) return warning(fallback);
    if (binding.action) return act(state, target, binding.action);
    const before = [...state.evidence], context = helpers(state);
    applyEffects(state, binding.effects, context);
    if (binding.consume && itemId) removeItem(state, itemId);
    return finalize(state, before, responseFor(binding.result, state, context), `use/${itemId || "evidence"}/${target}/${binding.id || "default"}`);
  }
  function useItem(state, itemId, target) {
    if (!state.inventory.includes(itemId)) return warning("You do not have that item.");
    const item = (definition.items || []).find((entry) => entry.id === itemId);
    return useBinding(state, item?.uses, target, "That item has no available use here.", itemId);
  }
  function presentEvidence(state, evidenceId, target) {
    if (!state.evidence.includes(evidenceId)) return warning("That evidence has not been recorded.");
    const exhibit = (definition.evidence || []).find((entry) => entry.id === evidenceId);
    return useBinding(state, exhibit?.presentations, target, "There is no available response to that evidence here.");
  }
  function explainCondition(state, expression) {
    const passed = condition(state, expression);
    if (passed) return { passed, reasons: [] };
    if (expression?.all || expression?.any) return { passed, reasons: (expression.all || expression.any).flatMap((part) => explainCondition(state, part).reasons) };
    return { passed, reasons: [typeof expression === "function" ? "Custom condition is false; inspect its registered callback." : JSON.stringify(expression)] };
  }
  function atomic(operation) {
    return (state, ...args) => {
      const before = clone(state);
      try {
        const response = operation(state, ...args);
        if (!validateCase(state)) throw new Error("Action produced an invalid case state");
        return response;
      } catch (error) {
        for (const key of Object.keys(state)) delete state[key];
        Object.assign(state, before);
        return { ...warning("That action could not finish. Your progress has been preserved."), error: String(error.message || error) };
      }
    };
  }
  return { definition, freshCase, createState: freshCase, restoreCase, restoreState: restoreCase, validateCase, validateState: validateCase,
    actionsFor, act: atomic(act), objective, score, caseSummary, condition, explainCondition,
    evidenceCards: (state) => projectEvidence(state, definition),
    journalEntries: (state) => state.log.map((entry, index) => ({ ...clone(entry), index: index + 1 })),
    applyEffects: atomic((state, effects) => { applyEffects(state, effects); refresh(state); }), conversationView, chooseConversation: atomic(chooseConversation), closeConversation: (state) => { state.activeConversation = null; },
    puzzleView, choosePuzzle: atomic(choosePuzzle), closePuzzle: (state) => { state.activePuzzle = null; }, useItem: atomic(useItem), presentEvidence: atomic(presentEvidence),
    itemUses: (state, target) => itemUses(definition, state, target, (expression) => condition(state, expression)),
    startSequence: atomic((state, id) => { state.activeSequence = id; return startSequence(state, definition, id); }),
    advanceSequence: atomic((state, id, options) => {
      const cue = advanceSequence(state, definition, id, helpers(state).apply, options);
      if (options?.skip || (state.presentation[id].completed && !cue)) state.activeSequence = null;
      refresh(state); return cue;
    }),
    pauseSequence: atomic((state, id, paused) => pauseSequence(state, definition, id, paused)),
    closeSequence: (state, id = state.activeSequence) => {
      if (state.presentation[id]) state.presentation[id].current = null;
      state.activeSequence = null;
    },
    cancelSequence: (state, id = state.activeSequence) => {
      if (state.presentation[id]) state.presentation[id].paused = true;
      state.activeSequence = null;
    },
  };
}
