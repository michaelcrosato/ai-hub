import original from './case.js';
import { withQuests } from '../../runtime/quests.js';

const done = key => ({ completed: key });
const flag = id => ({ flag: id });
const all = (...conditions) => ({ all: conditions });
const gain = id => ({ type: 'evidence', id });
const response = (title, text, kind = 'success') => ({ title, text, kind });
const task = (hotspot, id, label, when, effects, title, text, reason) => ({
  hotspot, id, label: `Optional · ${label}`, once: true,
  visibleWhen: { not: flag('reportSubmitted') }, when, effects,
  reason, result: response(title, text),
});
const evidence = [
  { id: 'community-bicycle', title: 'Community follow-up · Niko’s bicycle', type: 'property',
    text: 'At Niko’s request, the bicycle was photographed in place after the collision traces were preserved. The property officer recorded the damaged wheel and frame condition before secure storage. The collision record remains separate.' },
  { id: 'community-receipt', title: 'Community follow-up · Property receipt delivered', type: 'record',
    text: 'The property receipt and incident reference were relayed to Niko through the medical liaison. Collection instructions do not require another witness interview. The bicycle remains available for any documented evidence examination.' },
  { id: 'community-witness', title: 'Community follow-up · June’s support plan', type: 'record',
    text: 'June requested a check of the diner entrance before closing. A patrol unit confirmed the area was clear. June received the incident reference and a contact for further concerns. Help was not made conditional on a statement.' },
  { id: 'community-hospital', title: 'Community follow-up · Hospital release plan', type: 'procedure',
    text: 'The hospital receiver and evidence officer are named in the follow-up record. M-314 remains under evidence control until release is approved. The plan preserves photographs, the serial record, and a signed receiver receipt. The report does not claim that release has already occurred.' },
];
const actions = [
  task('courier', 'property-request', 'Ask about Niko’s bicycle after medical handoff', flag('aidGiven'), [],
    'A concern beyond the interview', 'Through the medical liaison, Niko asks that his bicycle not be left in the rain. Explain that the collision record comes first. Document its condition before a property officer moves it.',
    'Complete Niko’s medical handoff first.'),
  task('trace', 'document-bicycle', 'Document the bicycle before property recovery',
    all(done('courier/property-request'), flag('tracePhotographed'), flag('paintBagged'), flag('sealBagged')), [gain('community-bicycle')],
    'The record survives the move', 'Photograph the bicycle where it rests and record the damaged wheel and frame. With the nearby traces already preserved, the property officer can move it to secure storage. Ask dispatch for the receipt.',
    'Record Niko’s request, photograph the collision traces, and preserve both trace exhibits first.'),
  task('radio', 'property-receipt', 'Get the bicycle storage receipt', done('trace/document-bicycle'), [],
    'A place and a reference', 'The property officer confirms secure storage and supplies the receipt and incident reference. The bicycle is not released or repaired while an evidence examination may still be needed.',
    'Document the bicycle and arrange its secure recovery first.'),
  task('radio', 'notify-courier', 'Send Niko the property receipt through the liaison', done('radio/property-receipt'), [gain('community-receipt')],
    'One less uncertainty', 'The medical liaison confirms delivery of the receipt and contact details. Niko can focus on care. You do not ask for another account in exchange for help.',
    'Obtain the secure storage receipt first.'),
  task('witness', 'closing-needs', 'Ask June what she needs before closing', flag('witnessLimits'), [],
    'Support without another statement', 'June is uneasy about closing alone after the collision. She asks for a patrol check of the entrance and the incident reference. She does not need to add to her statement to receive help.',
    'Record the limits of June’s witness account first.'),
  task('radio', 'closing-check', 'Arrange June’s requested patrol check', done('witness/closing-needs'), [],
    'A confirmed patrol check', 'A free patrol unit checks the diner entrance and reports it clear. Dispatch gives you the completion reference. Return to June rather than leaving her with an unconfirmed promise.',
    'Ask June what support she wants first.'),
  task('witness', 'confirm-support', 'Confirm the check and leave the incident contact', done('radio/closing-check'), [gain('community-witness')],
    'June can close when she is ready', 'Tell June the patrol check is complete. She receives the incident reference and the contact for further concerns. Her original statement remains unchanged.',
    'Get confirmation of the patrol check from dispatch first.'),
  task('manifest', 'hospital-inventory', 'Prepare a hospital cargo follow-up', flag('cargoRecovered'), [],
    'Recovery is not release', 'M-314 is accounted for, but the hospital still needs a clear plan. Preserve the recovery photographs, crate serial, and contents record. Ask dispatch to contact the hospital receiver and evidence officer.',
    'Recover and inventory M-314 under the recorded search authority first.'),
  task('radio', 'hospital-contact', 'Confirm who can authorize and receive M-314', done('manifest/hospital-inventory'), [],
    'Two different responsibilities', 'The evidence officer controls release. The hospital receiver can sign for an approved transfer. Dispatch records both contacts. Neither urgency nor a matching crate number replaces authorization.',
    'Prepare the hospital cargo follow-up at Dispatch records first.'),
  { ...task('manifest', 'hospital-receipt', 'Check the cargo release plan', done('radio/hospital-contact'), [{ type: 'puzzle', id: 'hospital-handoff' }],
    'What must survive the handoff?', 'Choose a release plan that protects both the hospital’s need and the evidence record.',
    'Confirm the evidence officer and hospital receiver through dispatch first.'), once: false },
  task('report', 'hospital-follow-up', 'Attach the verified hospital release plan', { puzzle: 'hospital-handoff' }, [gain('community-hospital')],
    'A useful task for the next watch', 'Attach the contacts, required approval, serial record, and receiver receipt instructions. M-314 stays under evidence control until release is approved. The handoff plan does not claim that transfer is complete.',
    'Verify the cargo release plan at Dispatch records first.'),
];
const puzzles = [{
  id: 'hospital-handoff', type: 'choice', title: 'Which cargo handoff preserves the record?',
  text: 'The hospital needs M-314. The evidence officer controls its release. The original crate serial, recovery photographs, and contents record are preserved.',
  answer: 'authorized', hint: 'Authorization and a named receiver are both necessary. Keep the case record even after an approved release.',
  choices: [
    { id: 'urgent', label: 'Send the crate now; write the receipt later.', value: 'urgent' },
    { id: 'verified', label: 'Get release approval and a named receiver receipt; retain the records.', value: 'authorized' },
    { id: 'discard', label: 'Release it and remove the cargo records from the case.', value: 'discard' },
  ], onSuccess: [],
  successResult: response('A complete plan', 'The plan retains the evidence record and requires release approval plus a signed receiver receipt. Attach it at the Case terminal.'),
  failureResult: response('The plan has a missing safeguard', 'Urgency does not replace authorization, and a release does not erase the investigation record. You can revise this plan without changing the main-case score.', 'warning'),
}];
const knownOriginalEvidence = new Set(original.evidence.map(entry => entry.id));
const knownEvidence = new Set([...knownOriginalEvidence, ...evidence.map(entry => entry.id)]);
export const communityRoute = [
  'courier/property-request', 'trace/document-bicycle', 'radio/property-receipt', 'radio/notify-courier',
  'witness/closing-needs', 'radio/closing-check', 'witness/confirm-support',
  'manifest/hospital-inventory', 'radio/hospital-contact', 'manifest/hospital-receipt',
  { type: 'puzzle', puzzle: 'hospital-handoff', choice: 'verified' }, 'report/hospital-follow-up',
];
const clean = original.routes.find(route => route.id === 'clean');
const expanded = {
  ...original,
  routes: [...original.routes, {
    id: 'community-complete',
    steps: [...clean.steps.slice(0, -1), ...communityRoute, { type: 'reload' }, clean.steps.at(-1)],
    expect: { completed: true, outcome: 'case-closed', score: 100,
      evidence: ['community-bicycle', 'community-receipt', 'community-witness', 'community-hospital'] },
  }],
  actions: [...original.actions.map(action => action.hotspot === 'report' && action.id === 'submit-report'
    ? { ...action, label: 'Submit final report · ends this case' } : action), ...actions],
  evidence: [...original.evidence, ...evidence],
  puzzles: [...original.puzzles, ...puzzles],
  objective(state) {
    const goal = original.objective(state);
    return !state.completed && state.phase === 5
      ? { ...goal, detail: `${goal.detail} Optional work is listed at Patrol radio and Case terminal. Finish it before submitting.` }
      : goal;
  },
  // Keep the original v1 flags, values, and initial state. Existing saves need no migration.
  // The generic runtime validates all exhibits; the legacy hook sees its own exhibit set.
  validate(state) {
    return Array.isArray(state?.evidence) && state.evidence.every(id => knownEvidence.has(id)) &&
      original.validate({ ...state, evidence: state.evidence.filter(id => knownOriginalEvidence.has(id)) });
  },
};
const step = (id, label, key, lead) => ({ id, label, when: done(key), lead });
const quests = [
  { id: 'bicycle', title: 'After the ambulance', when: flag('aidGiven'),
    reward: 'Community care: Niko’s bicycle was preserved and its storage receipt reached him through the medical liaison.', steps: [
      step('request', 'Record Niko’s property request.', 'courier/property-request', 'Ask about the bicycle at Niko’s contact after the medical handoff.'),
      step('document', 'Preserve the bicycle and nearby traces.', 'trace/document-bicycle', 'Document the bicycle at Collision marks after both trace exhibits are preserved.'),
      step('receipt', 'Obtain the secure storage receipt.', 'radio/property-receipt', 'Request the property receipt at Patrol radio.'),
      step('notify', 'Confirm delivery of the receipt.', 'radio/notify-courier', 'Send the receipt through the medical liaison at Patrol radio.'),
    ] },
  { id: 'closing-time', title: 'Closing time', when: flag('witnessLimits'),
    reward: 'Witness care: June received the requested patrol check and a clear follow-up contact.', steps: [
      step('needs', 'Ask June what support she wants.', 'witness/closing-needs', 'Speak to June at Night Owl after recording her witness limits.'),
      step('check', 'Get a confirmed patrol check.', 'radio/closing-check', 'Arrange the check at Patrol radio.'),
      step('confirm', 'Return with the result and contact details.', 'witness/confirm-support', 'Return to June and confirm the support plan.'),
    ] },
  { id: 'hospital', title: 'Beyond the loading bay', when: flag('cargoRecovered'),
    reward: 'Cargo follow-up: the hospital release plan identifies approval, preserved records, and a named receiver.', steps: [
      step('inventory', 'Prepare the cargo follow-up.', 'manifest/hospital-inventory', 'Use Dispatch records after the authorized recovery of M-314.'),
      step('contact', 'Identify the release and receiving contacts.', 'radio/hospital-contact', 'Contact dispatch at Patrol radio.'),
      { id: 'verify', label: 'Verify the release safeguards.', when: { puzzle: 'hospital-handoff' }, lead: 'Check the cargo release plan at Dispatch records.' },
      step('attach', 'Attach the verified plan.', 'report/hospital-follow-up', 'Attach the hospital plan at Case terminal before submitting the report.'),
    ] },
];
export default withQuests(expanded, quests, ['radio', 'report']);
