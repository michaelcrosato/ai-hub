import { createAdventure, evaluateCondition } from './adventure.js';
import { flattenActions } from './content.js';

/** Derive optional work from existing facts. No new save fields are required. */
export function questProgress(definition, state) {
  const actions = flattenActions(definition);
  return (definition.quests || []).map(quest => {
    const steps = quest.steps.map(step => ({
      id: step.id, label: step.label, lead: step.lead,
      action: step.action || step.when?.completed || null,
      complete: evaluateCondition(state, step.when, definition),
    }));
    const complete = steps.every(step => step.complete);
    const started = steps.some(step => step.complete);
    const available = evaluateCondition(state, quest.when, definition);
    const active = !complete && !state.completed && (available || started);
    const pending = steps.find(step => !step.complete);
    const sourceStep = quest.steps.find(step => step.id === pending?.id);
    // Puzzle-only steps from older content can still point to their authored opener.
    const action = actions.find(action => pending?.action
      ? `${action.hotspot}/${action.id}` === pending.action
      : sourceStep?.when?.puzzle && Array.isArray(action.effects) &&
        action.effects.some(effect => effect.type === 'puzzle' && effect.id === sourceStep.when.puzzle));
    const target = definition.hotspots.find(spot => spot.id === action?.hotspot);
    const area = definition.areas.find(area => area.id === target?.area);
    const areaOpen = !!area && evaluateCondition(state, area.when, definition);
    const actionOpen = !!action && evaluateCondition(state, action.visibleWhen, definition) &&
      evaluateCondition(state, action.when ?? action.enabled, definition) &&
      !(action.once === true && state.completedActions?.includes(`${action.hotspot}/${action.id}`)) &&
      !(typeof action.once === 'string' && state.flags[action.once]);
    return {
      id: quest.id, title: quest.title, description: quest.description || '',
      unlock: quest.unlock || 'Continue the main investigation to make this task available.',
      reward: quest.reward, steps, completedSteps: steps.filter(step => step.complete).length,
      status: complete ? 'complete' : state.completed ? 'not completed' :
        started ? 'in progress' : available ? 'available' : 'not yet available',
      next: active ? pending?.lead || null : null,
      target: active && areaOpen && actionOpen ? target.id : null,
      targetName: active && areaOpen && actionOpen ? target.name || target.id : null,
      blockedReason: !active || (areaOpen && actionOpen) ? null :
        !areaOpen && area?.reason ? area.reason :
        typeof action?.reason === 'function' ? action.reason(state) : action?.reason || null,
    };
  });
}

/** Add journal controls and debrief findings without changing required objectives or score. */
export function withQuests(definition, quests, journalHotspots) {
  const ids = new Set();
  for (const quest of quests) {
    if (!quest.id || ids.has(quest.id) || !quest.steps?.length ||
        quest.steps.some(step => !step.id || !step.when || !step.lead) ||
        new Set(quest.steps.map(step => step.id)).size !== quest.steps.length) {
      throw new Error('Quests need unique IDs and nonempty steps with conditions and leads.');
    }
    ids.add(quest.id);
  }
  const base = createAdventure(definition);
  const enhanced = { ...definition, quests };
  enhanced.actions = [...flattenActions(definition)];
  for (const hotspot of journalHotspots) {
    if (!definition.hotspots.some(spot => spot.id === hotspot) ||
        enhanced.actions.some(action => action.hotspot === hotspot && action.id === 'optional-work')) {
      throw new Error(`Invalid quest journal target: ${hotspot}`);
    }
    enhanced.actions.push({
      id: 'optional-work', hotspot, label: 'Optional work · progress and next steps', readOnly: true,
      result: state => ({ title: 'Beyond the case', kind: 'story',
        text: 'Optional work never blocks the main investigation or lowers its score. Finish it before you sign the final report.\n\n' +
          questProgress(enhanced, state).map(quest =>
            `${quest.title} — ${quest.status.toUpperCase()}\n` +
            quest.steps.map(step => `${step.complete ? '[Done]' : '[Open]'} ${step.label}`).join('\n') +
            (quest.next ? `\nNext: ${quest.next}` : '') +
            (quest.status === 'complete' ? `\n${quest.reward}` : '')).join('\n\n'),
      }),
    });
  }
  enhanced.summary = state => {
    const summary = base.caseSummary(state);
    const progress = questProgress(enhanced, state);
    return { ...summary,
      findings: [...(summary.findings || []), ...progress.filter(quest => quest.status === 'complete').map(quest => quest.reward)],
      nextSteps: [...(summary.nextSteps || []), ...progress.filter(quest => quest.status !== 'complete').map(quest =>
        `${quest.title}: ${state.completed ? 'not completed during this case.' : quest.next || quest.unlock}`)],
    };
  };
  return enhanced;
}
