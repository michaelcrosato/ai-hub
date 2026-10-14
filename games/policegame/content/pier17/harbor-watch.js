import original from './case.js';
import expanded, { communityRoute } from './expanded.js';
import { withQuests } from '../../runtime/quests.js';

const flag = id => ({ flag: id });
const done = key => ({ completed: key });
const all = (...conditions) => ({ all: conditions });
const solved = id => ({ puzzle: id });
const heard = id => ({ conversation: id });
const gain = id => ({ type: 'evidence', id });
const reply = (title, text, kind = 'success') => ({ title, text, kind });
const open = { not: flag('reportSubmitted') };
const task = (hotspot, id, label, when, effects, title, text, reason) => ({
  hotspot, id, label: `Optional · ${label}`, once: true, visibleWhen: open,
  when, effects, reason, result: reply(title, text),
});
const activity = (hotspot, id, label, when, type, activityId, reason) => ({
  ...task(hotspot, id, label, all(when, { not: type === 'puzzle' ? solved(activityId) : heard(activityId) }),
    [{ type, id: activityId }], label, 'Review the available information before you decide.', reason),
  once: false,
  visibleWhen: all(open, { not: type === 'puzzle' ? solved(activityId) : heard(activityId) }),
});
const step = (id, label, key, lead) => ({ id, label, when: done(key), action: key, lead });
const activityStep = (id, label, condition, action, lead) => ({ id, label, when: condition, action, lead });

const evidence = [
  { id: 'harbor-scene', title: 'Harbor lights · The ferry exit', type: 'observation',
    text: 'Lamp F-17 at the ferry exit is dark during the follow-up inspection. The road lamps near the collision still work. Photograph the two locations separately. A present fault does not prove the lighting condition at 22:14 or the cause of the collision.' },
  { id: 'harbor-account', title: 'Harbor lights · June’s limited observation', type: 'statement',
    text: 'June noticed the ferry exit was dark when she put out the closing board. She cannot place that event against the collision. She did not see a lamp fail. Her statement is retained as an observation with an uncertain time, not proof of a cause.' },
  { id: 'harbor-docket', title: 'Harbor lights · An open repair ticket', type: 'record',
    text: 'The harbor maintenance desk supplies ticket L-17: intermittent ferry-exit lamp, logged at 21:50. Status: OPEN. No repair completion is recorded. The ticket concerns F-17, not the road lamps beside the bicycle.', related: ['harbor-scene', 'harbor-account'] },
  { id: 'harbor-remedy', title: 'Harbor lights · Temporary protection confirmed', type: 'record',
    text: 'A harbor crew provides temporary light at the ferry exit and keeps the defective fixture out of use. Mercer checks the lit pedestrian route from the public side. Dispatch records the crew confirmation and the open permanent-repair ticket. No cause of the collision is inferred.' },
  { id: 'ferry-service', title: 'The last ferry · Service and travel options', type: 'record',
    text: 'The final ferry is canceled. Mara and her father Ed are together at Night Owl. They are not reported missing and do not need a search. Transit offers an accessible minibus. A family pickup is also possible, but only if Mara chooses to contact them.' },
  { id: 'ferry-bus', title: 'The last ferry · Passenger’s choice: minibus', type: 'record',
    text: 'Mara chooses the accessible minibus and asks to wait with Ed inside Night Owl. June agrees. The transport office receives only the details needed for the trip. The destination is confirmed privately with the passenger.' },
  { id: 'ferry-family', title: 'The last ferry · Passenger’s choice: family pickup', type: 'record',
    text: 'Mara chooses to contact her sister herself. She and Ed wait inside Night Owl with June’s agreement. Dispatch does not obtain an address or contact a relative without her request. Her sister confirms the vehicle and pickup arrangement.' },
  { id: 'ferry-handoff', title: 'The last ferry · Safe departure confirmed', type: 'record',
    text: 'Mara confirms the expected person, vehicle, and arrangement before she and Ed leave together. June confirms their departure. The passenger’s chosen travel option remains in the note. Their private destination is not copied into the collision evidence.' },
  { id: 'carbon-slip', title: 'The carbon copy · A second movement?', type: 'document',
    text: 'A folded carbon slip, Q-52, shows M-318 and a run reference shared with the missing shipment. Its direction field is obscured. Preserve it as found. It is a lead to check, not proof that a second crate was stolen.' },
  { id: 'carbon-register', title: 'The carbon copy · Signed receiving record', type: 'document',
    text: 'The receiving desk supplies its signed original: Q-52, M-318, RETURN, 21:42. A gate receipt records the same crate at 21:46. The 22:02 carbon was a desk copy of that return. M-314 is a different crate and remains part of the main case.', related: ['carbon-slip'], media: 'content/pier17/assets/carbon-records.svg' },
  { id: 'carbon-label', title: 'The carbon copy · Sleeve and serial', type: 'observation',
    text: 'The document sleeve on the outside of the van carries Q-52 / M-318 / RETURN. Read and photograph it without opening the van or changing the search record. The serial differs from M-314. A shared route number is not a shared crate identity.' },
  { id: 'carbon-correction', title: 'The carbon copy · A false lead resolved', type: 'analysis',
    text: 'Q-52 records the return of M-318, not another missing shipment. The signed original, gate receipt, and exterior sleeve agree. Keep the folded copy and attach a separate correction. Do not alter the source or weaken the independent case about M-314.', related: ['carbon-slip', 'carbon-register', 'carbon-label'] },
];

const conversations = [
  { id: 'harbor-account', start: 'opening', speaker: 'JUNE PARK', nodes: [
    { id: 'opening', text: '“The ferry exit was dark when I put the closing board out. Is that why Niko fell?”', choices: [
      { id: 'observe', label: 'Ask what she saw and when she saw it.', to: 'memory' },
      { id: 'assume', label: 'Suggest that the lamp caused the collision.', to: 'repair' },
    ] },
    { id: 'repair', text: 'June hesitates. “I did not see the lamp go out. I was asking you.” Your question supplied a cause that she did not report. Separate her observation from your suggestion.', choices: [
      { id: 'reset', label: 'Withdraw the suggestion. Ask for her own observation.', to: 'memory' },
    ] },
    { id: 'memory', text: '“The exit was dark. The lamps by the road were still on. I cannot remember whether I put the board out before the crash or after it.”', choices: [
      { id: 'qualify', label: 'Keep the observation and its uncertain time.', to: 'recorded' },
      { id: 'press', label: 'Ask her to choose a time even though she is unsure.', to: 'limits' },
    ] },
    { id: 'limits', text: '“Choosing one would just be a guess.” A more precise answer would not be a more reliable answer. The maintenance ticket may help, but it cannot change her memory.', choices: [
      { id: 'accept', label: 'Record that the time is not known.', to: 'recorded' },
    ] },
    { id: 'recorded', text: 'June’s words and their limits are recorded. Ask the harbor maintenance desk for the original repair ticket at Dispatch records.', effects: [gain('harbor-account')], end: true },
  ] },
  { id: 'ferry-plan', start: 'opening', speaker: 'MARA HOLT', nodes: [
    { id: 'opening', text: 'Mara puts the call on speaker beside Ed. “We are safe with June. Dad needs a step-free vehicle. I could call my sister, or we could take the minibus.”', choices: [
      { id: 'ask', label: 'Let Mara choose the travel option.', to: 'choice' },
      { id: 'decide', label: 'Offer to call her family without asking first.', to: 'consent' },
    ] },
    { id: 'consent', text: '“Please leave that to me. My sister is at work.” Being stranded does not remove Mara’s choice. Both options remain available.', choices: [
      { id: 'return-choice', label: 'Leave the decision with Mara.', to: 'choice' },
    ] },
    { id: 'choice', text: 'Ed agrees to wait inside. June can keep the warm seating area open while they arrange the trip. Which option does Mara choose?', choices: [
      { id: 'bus', label: 'Mara chooses the accessible minibus.', to: 'bus' },
      { id: 'family', label: 'Mara chooses to call her sister herself.', to: 'family' },
    ] },
    { id: 'bus', text: '“The minibus will work for us.” Confirm the booking through Patrol radio. Do not treat a booking as a completed pickup.', effects: [gain('ferry-bus')], end: true },
    { id: 'family', text: '“My sister can collect us. I will confirm the car with her.” Use Patrol radio to record the agreed pickup plan, without copying a private address into the case.', effects: [gain('ferry-family')], end: true },
  ] },
];

const choicePuzzle = (id, title, text, choices, answer, hint, successTitle, successText) => ({
  id, type: 'choice', title, text, answer, hint,
  choices: choices.map(([id, label]) => ({ id, label, value: id })), onSuccess: [],
  successResult: reply(successTitle, successText),
  failureResult: reply('Check what the records support', 'That conclusion goes beyond the available information. Review the source details and try again. Optional checks do not reduce the main case score.', 'warning'),
});
const puzzles = [
  choicePuzzle('harbor-assessment', 'What does the dark exit establish?',
    'F-17 is dark now. Ticket L-17 was opened at 21:50 with no completed repair. June cannot time her observation. The road lamps beside the collision still work.', [
      ['cause', 'The lamp fault caused the collision.'],
      ['hazard', 'There is a current pedestrian hazard. The collision cause is not established by it.'],
      ['repaired', 'An open ticket proves that the lamp was repaired.'],
    ], 'hazard', 'Separate the observed hazard, the repair status, and the cause of the collision.',
    'A useful finding without an invented cause', 'Request temporary light and a crew check at Patrol radio. Keep the permanent repair ticket open.'),
  choicePuzzle('ferry-pickup', 'When is the pickup ready?',
    'Mara and Ed are waiting inside Night Owl. A plan has been arranged. A vehicle has arrived outside, but arrival alone does not identify the driver.', [
      ['first', 'Send them to the first vehicle with its lights on.'],
      ['verify', 'Let Mara confirm the expected person, vehicle, and arrangement before departure.'],
      ['public', 'Announce their home address across the diner.'],
    ], 'verify', 'The passenger can confirm the agreed pickup. Keep private information private.',
    'The passenger confirms the match', 'Complete the departure check with June and Mara. A safe handoff is more than an assigned vehicle.'),
  { id: 'carbon-order', type: 'timeline', title: 'Put the three records in order',
    text: 'Signed return: 21:42. Gate receipt: 21:46. Desk carbon: 22:02. Read the event times, not the order in which you found the pages.',
    answer: ['return', 'gate', 'copy'], hint: 'The return was signed first. The desk copy was made last.',
    choices: [
      { id: 'copy-first', label: 'Desk copy → signed return → gate receipt', value: ['copy', 'return', 'gate'] },
      { id: 'source-order', label: 'Signed return → gate receipt → desk copy', value: ['return', 'gate', 'copy'] },
      { id: 'gate-first', label: 'Gate receipt → desk copy → signed return', value: ['gate', 'copy', 'return'] },
    ], onSuccess: [], successResult: reply('A copy is not a new movement', 'The 22:02 entry records paperwork made after the return. Now check the crate identity before you close this lead.'),
    failureResult: reply('Use the event times', 'Read all three times again. Finding a document later does not make its event later. No score is lost.', 'warning'),
  },
  choicePuzzle('carbon-finding', 'What happened to M-318?',
    'Q-52 / M-318 / RETURN appears on the signed original, gate receipt, and exterior sleeve. The carbon’s direction field is folded over. M-314 is the missing crate in the main case.', [
      ['second-theft', 'Record a second theft because the route number is shared.'],
      ['return', 'Record the verified return of M-318. Keep M-314 separate.'],
      ['erase', 'Discard the confusing carbon and change the source ledger.'],
    ], 'return', 'Match the full crate serial and movement direction. Preserve the source even when it is incomplete.',
    'The false lead has an answer', 'Attach the return records and a separate correction at Case terminal. The main M-314 investigation remains unchanged.'),
];

const actions = [
  task('radio', 'harbor-call', 'Take the ferry-exit lighting call', flag('aidGiven'), [],
    'Another problem on the same street', 'Harbor control reports a dark pedestrian exit. Niko’s care remains the priority. Once the collision traces are preserved, inspect the exit from the public pavement at Collision marks.', 'Complete the medical handoff first.'),
  task('trace', 'harbor-survey', 'Compare the ferry-exit and road lights', all(done('radio/harbor-call'), flag('tracePhotographed'), flag('paintBagged'), flag('sealBagged')), [gain('harbor-scene')],
    'Two places, two observations', 'The ferry exit is dark; the road lamps still work. Photograph lamp F-17 and the pedestrian route without moving collision evidence. June may have seen the exit earlier.', 'Take the lighting call and preserve both photographed trace exhibits first.'),
  activity('witness', 'harbor-account', 'Ask June about the ferry-exit light', all(done('trace/harbor-survey'), flag('witnessLimits')), 'conversation', 'harbor-account', 'Inspect the exit and finish June’s main witness account first.'),
  task('manifest', 'harbor-docket', 'Obtain the harbor repair ticket', heard('harbor-account'), [gain('harbor-docket')],
    'Reported does not mean repaired', 'The harbor maintenance desk supplies L-17. It was opened at 21:50 for an intermittent fault at F-17. There is no completion entry. Compare the ticket and June’s account at Case terminal.', 'Finish June’s lighting account first.'),
  activity('report', 'harbor-assessment', 'Separate the lighting hazard from the collision claim', done('manifest/harbor-docket'), 'puzzle', 'harbor-assessment', 'Obtain ticket L-17 from Dispatch records first.'),
  task('radio', 'harbor-safeguard', 'Request temporary light and a harbor crew', solved('harbor-assessment'), [],
    'A request is not a completed repair', 'Harbor control assigns a crew with temporary lighting. The permanent repair ticket remains open. Return to Collision marks to confirm what the crew has done.', 'Check what the lighting records establish at Case terminal first.'),
  task('trace', 'harbor-check', 'Confirm the crew’s temporary lighting', done('radio/harbor-safeguard'), [gain('harbor-remedy')],
    'The pedestrian route is lit', 'The crew confirms the temporary light is in place. From the public side, you check that the exit route is lit and the defective fixture remains out of use. Record the crew reference; do not call this a permanent repair.', 'Get the crew assignment from Patrol radio first.'),
  task('report', 'harbor-file', 'File the lighting follow-up and repair reference', done('trace/harbor-check'), [],
    'A safer exit for the next watch', 'Attach the observations, witness limits, repair ticket, and confirmed temporary protection. The permanent repair is still for harbor maintenance. The collision cause is not changed by this follow-up.', 'Confirm the temporary light at the ferry exit first.'),
  task('witness', 'ferry-note', 'Ask about the passengers waiting after the last ferry', flag('witnessLimits'), [],
    'No boat tonight', 'June introduces Mara and her father Ed, who are waiting at Night Owl after the final ferry was canceled. They are together and safe. Ask dispatch what travel options are available before making promises.', 'Finish June’s main witness account first.'),
  task('radio', 'ferry-service', 'Check canceled service and accessible travel', done('witness/ferry-note'), [gain('ferry-service')],
    'Two workable options', 'Transit confirms the cancellation and an accessible minibus option. Mara may instead contact her family herself. Return to Night Owl and let her choose. There is no need to start a missing-person search.', 'Speak to June about the waiting passengers first.'),
  activity('witness', 'ferry-plan', 'Agree on a travel plan with Mara and Ed', done('radio/ferry-service'), 'conversation', 'ferry-plan', 'Confirm the available travel options at Patrol radio first.'),
  { ...task('radio', 'ferry-arrange', 'Confirm the passengers’ chosen pickup plan', heard('ferry-plan'), [], '', '', 'Let Mara choose a travel option first.'),
    result: state => state.evidence.includes('ferry-bus')
      ? reply('A confirmed minibus booking', 'Transit gives a booking reference and vehicle details. Mara and Ed can wait inside Night Owl. Return to check the vehicle with Mara before recording a departure.')
      : reply('A family plan, confirmed by Mara', 'Mara confirms that her sister is on the way and gives the agreed vehicle description. No private address is entered in the collision file. Return to Night Owl to check the handoff.'),
  },
  activity('witness', 'ferry-pickup', 'Check the pickup before departure', done('radio/ferry-arrange'), 'puzzle', 'ferry-pickup', 'Confirm the chosen pickup plan at Patrol radio first.'),
  task('witness', 'ferry-handoff', 'Confirm that Mara and Ed leave together', solved('ferry-pickup'), [gain('ferry-handoff')],
    'Not left waiting', 'Mara confirms the expected person and vehicle. She and Ed leave together using their chosen travel option. June confirms the departure. Thank her for providing a warm place to wait.', 'Check the pickup details with Mara first.'),
  task('report', 'ferry-file', 'Attach the completed passenger follow-up', done('witness/ferry-handoff'), [],
    'A completed journey out of the incident', 'Record the chosen travel option and confirmed departure. Keep the passengers’ private destination out of the collision evidence. No statement was required in exchange for help.', 'Confirm the passengers’ departure at Night Owl first.'),
  task('manifest', 'carbon-notice', 'Inspect the folded carbon beneath the ledger', flag('manifestRead'), [gain('carbon-slip')],
    'A second crate number', 'The carbon shows Q-52 and M-318. A fold hides the movement direction. The shared run reference is easy to mistake for another missing load. Preserve the page and request its signed source.', 'Read the main cargo ledger first.'),
  task('radio', 'carbon-source', 'Ask the receiving desk to preserve the source records', done('manifest/carbon-notice'), [],
    'Go back to the first record', 'The receiving clerk locates the signed return and gate receipt for Q-52. Copies with the source and clerk reference will be available at Dispatch records. The folded carbon is retained.', 'Inspect the folded carbon at Dispatch records first.'),
  task('manifest', 'carbon-register', 'Compare the signed return and gate receipt', done('radio/carbon-source'), [gain('carbon-register')],
    'The direction field matters', 'The original says RETURN, M-318, 21:42. The matching gate receipt is 21:46. The carbon was made at 22:02. Inspect the van’s exterior document sleeve to check the full serial.', 'Request the signed source and gate receipt through Patrol radio first.'),
  task('van', 'carbon-label', 'Read the exterior document sleeve without opening the van', done('manifest/carbon-register'), [gain('carbon-label')],
    'One digit is a different crate', 'The exterior sleeve reads Q-52 / M-318 / RETURN. Photograph it without opening or moving anything. M-318 and M-314 are not interchangeable. Put the three document events in order at Case terminal.', 'Compare the signed return at Dispatch records first.'),
  activity('report', 'carbon-order', 'Order the return, receipt, and desk copy', done('van/carbon-label'), 'puzzle', 'carbon-order', 'Compare the exterior sleeve and receiving records first.'),
  activity('report', 'carbon-finding', 'Decide what the second crate record supports', solved('carbon-order'), 'puzzle', 'carbon-finding', 'Put the three source events in order first.'),
  task('report', 'carbon-file', 'Retain the carbon and attach a separate correction', solved('carbon-finding'), [gain('carbon-correction')],
    'One false lead closed; the real case intact', 'Keep every source page. Attach the verified return of M-318 as a separate correction, with the clerk and receipt references. M-314 remains the recovered crate in the main investigation.', 'Check the supported finding for M-318 first.'),
];

export const harborQuests = [
  { id: 'harbor-lights', title: 'Harbor lights', when: flag('aidGiven'), unlock: 'Complete Niko’s medical handoff.',
    description: 'A dark ferry exit needs a confirmed response, not a guess about the collision.',
    reward: 'Harbor lights: temporary protection was checked, the repair ticket stays open, and no unsupported collision cause was added.', steps: [
      step('call', 'Take the ferry-exit call.', 'radio/harbor-call', 'Take the lighting call at Patrol radio.'),
      step('survey', 'Compare the exit and road lights.', 'trace/harbor-survey', 'Inspect the ferry exit at Collision marks after preserving both trace exhibits.'),
      activityStep('account', 'Record June’s observation and its limits.', heard('harbor-account'), 'witness/harbor-account', 'Ask June about the light after her main witness account.'),
      step('docket', 'Obtain the original repair ticket.', 'manifest/harbor-docket', 'Request the maintenance ticket at Dispatch records.'),
      activityStep('assess', 'Separate the hazard from a cause claim.', solved('harbor-assessment'), 'report/harbor-assessment', 'Compare the lighting records at Case terminal.'),
      step('crew', 'Request temporary protection.', 'radio/harbor-safeguard', 'Request a crew at Patrol radio.'),
      step('check', 'Confirm the temporary lighting.', 'trace/harbor-check', 'Check the crew’s work at Collision marks.'),
      step('file', 'File the follow-up.', 'report/harbor-file', 'Attach the lighting note at Case terminal.'),
    ] },
  { id: 'last-ferry', title: 'The last ferry', when: flag('witnessLimits'), unlock: 'Finish June’s main witness account.',
    description: 'Two passengers need a way home. Their choice determines the pickup plan.',
    reward: 'The last ferry: Mara and Ed chose their travel, waited inside, and left together after a verified pickup.', steps: [
      step('note', 'Ask about the waiting passengers.', 'witness/ferry-note', 'Speak to June at Night Owl.'),
      step('service', 'Confirm the available travel options.', 'radio/ferry-service', 'Check service and accessible travel at Patrol radio.'),
      activityStep('plan', 'Let Mara choose a travel plan.', heard('ferry-plan'), 'witness/ferry-plan', 'Return to Night Owl to agree on the travel plan.'),
      step('arrange', 'Confirm the chosen pickup.', 'radio/ferry-arrange', 'Confirm the chosen pickup plan at Patrol radio.'),
      activityStep('verify', 'Verify the expected person and vehicle.', solved('ferry-pickup'), 'witness/ferry-pickup', 'Check the pickup with Mara at Night Owl.'),
      step('handoff', 'Confirm departure together.', 'witness/ferry-handoff', 'Complete the departure check at Night Owl.'),
      step('file', 'Attach the completed follow-up.', 'report/ferry-file', 'Attach the passenger note at Case terminal.'),
    ] },
  { id: 'carbon-copy', title: 'The carbon copy', when: flag('manifestRead'), unlock: 'Read the main cargo ledger.',
    description: 'A folded page suggests a second missing crate. Test the serial, direction, and event order.',
    reward: 'The carbon copy: M-318 was verified as a return. The source pages were retained and the M-314 case stayed separate.', steps: [
      step('notice', 'Preserve the folded carbon.', 'manifest/carbon-notice', 'Inspect the carbon at Dispatch records.'),
      step('source', 'Request the original records.', 'radio/carbon-source', 'Contact the receiving desk through Patrol radio.'),
      step('register', 'Compare the signed return and gate receipt.', 'manifest/carbon-register', 'Read the source copies at Dispatch records.'),
      step('label', 'Check the exterior sleeve and serial.', 'van/carbon-label', 'Read the document sleeve on the outside of the van.'),
      activityStep('order', 'Order the three document events.', solved('carbon-order'), 'report/carbon-order', 'Put the return records in order at Case terminal.'),
      activityStep('finding', 'Reach a supported finding.', solved('carbon-finding'), 'report/carbon-finding', 'Check the full crate identity at Case terminal.'),
      step('file', 'Attach a correction without changing the sources.', 'report/carbon-file', 'File the carbon correction at Case terminal.'),
    ] },
];

export const lightingRoute = ['radio/harbor-call', 'trace/harbor-survey', 'witness/harbor-account',
  { type: 'choice', conversation: 'harbor-account', choice: 'observe' },
  { type: 'choice', conversation: 'harbor-account', choice: 'qualify' },
  'manifest/harbor-docket', 'report/harbor-assessment',
  { type: 'puzzle', puzzle: 'harbor-assessment', choice: 'hazard' },
  'radio/harbor-safeguard', 'trace/harbor-check', 'report/harbor-file'];
export const ferryRoute = (choice = 'bus') => ['witness/ferry-note', 'radio/ferry-service', 'witness/ferry-plan',
  { type: 'choice', conversation: 'ferry-plan', choice: 'ask' },
  { type: 'choice', conversation: 'ferry-plan', choice },
  'radio/ferry-arrange', 'witness/ferry-pickup',
  { type: 'puzzle', puzzle: 'ferry-pickup', choice: 'verify' }, 'witness/ferry-handoff', 'report/ferry-file'];
export const carbonRoute = ['manifest/carbon-notice', 'radio/carbon-source', 'manifest/carbon-register', 'van/carbon-label',
  'report/carbon-order', { type: 'puzzle', puzzle: 'carbon-order', choice: 'source-order' },
  'report/carbon-finding', { type: 'puzzle', puzzle: 'carbon-finding', choice: 'return' }, 'report/carbon-file'];
const oldIds = new Set(expanded.evidence.map(entry => entry.id));
const allIds = new Set([...oldIds, ...evidence.map(entry => entry.id)]);
const clean = original.routes.find(route => route.id === 'clean');
const definition = {
  ...expanded,
  // Rebuild the combined journal once, rather than nesting summary decorators.
  summary: original.summary,
  actions: [...expanded.actions.filter(action => action.id !== 'optional-work'), ...actions],
  evidence: [...expanded.evidence, ...evidence],
  conversations: [...(expanded.conversations || []), ...conversations],
  puzzles: [...expanded.puzzles, ...puzzles],
  ui: { ...expanded.ui,
    introText: `${expanded.ui.introText} Beyond the main case, help stranded passengers, check the ferry-exit lights, and resolve a second crate record. Find optional work in the notebook.`,
  },
  validate(state) {
    return Array.isArray(state?.evidence) && state.evidence.every(id => allIds.has(id)) &&
      expanded.validate({ ...state, evidence: state.evidence.filter(id => oldIds.has(id)) });
  },
  routes: [...expanded.routes, ...['bus', 'family'].map(choice => ({
    id: `harbor-watch-${choice}`,
    steps: [...clean.steps.slice(0, -1), ...communityRoute, ...lightingRoute, ...ferryRoute(choice), ...carbonRoute,
      { type: 'reload' }, clean.steps.at(-1)],
    expect: { completed: true, outcome: 'case-closed', score: 100,
      evidence: ['harbor-remedy', `ferry-${choice}`, 'ferry-handoff', 'carbon-correction'] },
  }))],
};
export default withQuests(definition, [...expanded.quests, ...harborQuests], ['radio', 'report']);
