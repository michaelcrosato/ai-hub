import { questProgress } from '../runtime/quests.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const statusOrder = ['in progress', 'available', 'not yet available', 'complete', 'not completed'];

/** Render only derived progress. Reading a notebook never changes case state. */
export function questNotebook(definition, state, begun) {
  const progress = questProgress(definition, state);
  if (!progress.length) return '<p class="empty-note">This case has no optional tasks.</p>';
  const complete = progress.filter(quest => quest.status === 'complete').length;
  return `<section class="patrol-summary" aria-label="Optional work summary"><div><span class="micro gold">BEYOND THE CASE</span><h3>${complete} of ${progress.length} follow-ups complete</h3><p>${state.completed
    ? 'The final report is filed. This page shows what you completed during the case.'
    : 'These tasks do not block the main case or change its score. Finish them before you submit the final report. There is no timer.'}</p></div></section><div class="patrol-grid">${[...progress]
    .sort((a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status))
    .map(quest => {
      const locked = quest.status === 'not yet available';
      return `<article class="patrol-card" data-quest="${esc(quest.id)}" data-status="${esc(quest.status)}"><div class="patrol-heading"><span class="micro">${esc(quest.status.toUpperCase())}</span><span class="micro">${quest.completedSteps} / ${quest.steps.length}</span></div><h3>${esc(quest.title)}</h3>${quest.description ? `<p>${esc(quest.description)}</p>` : ''}<progress value="${quest.completedSteps}" max="${quest.steps.length}" aria-label="${esc(quest.title)} progress"></progress>${locked
        ? `<p class="patrol-next">${esc(quest.unlock)}</p>`
        : `<ol class="patrol-steps">${quest.steps.map(step => `<li class="${step.complete ? 'is-done' : ''}"><span aria-hidden="true">${step.complete ? '✓' : '○'}</span><span><span class="sr-only">${step.complete ? 'Complete: ' : 'Open: '}</span>${esc(step.label)}</span></li>`).join('')}</ol>`}${quest.next ? `<p class="patrol-next"><strong>Next:</strong> ${esc(quest.next)}</p>` : ''}${quest.blockedReason ? `<p class="small-note">First: ${esc(quest.blockedReason)}</p>` : ''}${begun && quest.target ? `<button class="secondary" data-quest-lead="${esc(quest.id)}">Go to ${esc(quest.targetName)} <span aria-hidden="true">→</span></button>` : ''}${quest.status === 'complete' ? `<p class="patrol-reward">${esc(quest.reward)}</p>` : ''}</article>`;
    }).join('')}</div>`;
}

/** Recheck a navigation request against current state; never trust a stale card. */
export function questDestination(definition, state, id) {
  return questProgress(definition, state).find(quest => quest.id === id)?.target || null;
}
