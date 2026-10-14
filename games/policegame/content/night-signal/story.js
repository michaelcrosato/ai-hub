const set = id => ({ type: 'flag', id });
const gain = id => ({ type: 'evidence', id });
const reply = (title, text, kind = 'success') => ({ title, text, kind });

export const conversations = [
  { id: 'attendant-account', actor: 'ivo', speaker: 'Ivo Chen', start: 'start', nodes: [
    { id: 'start', text: 'People keep saying the contractor did it. I saw Lena leave the tram, but I did not see a contractor near the equipment.', choices: [
      { id: 'observed', label: 'Tell me only what you saw yourself.', to: 'sighting' },
      { id: 'rumor', label: 'Where did the contractor story come from?', to: 'rumor' },
    ] },
    { id: 'rumor', text: 'A passenger repeated it after the alarm. I do not know who first said it.', choices: [
      { id: 'separate', label: 'Keep that separate. What did you see?', to: 'sighting' },
    ] },
    { id: 'sighting', text: 'The tram was stationary. Lena walked to the platform notice, then toward the service shelter. I could not see the relay room.', choices: [
      { id: 'limits', label: 'Record the sighting and the limits of your view.', to: 'recorded' },
    ] },
    { id: 'recorded', text: 'That is all I can say from my own view. The station can preserve the platform recording for you.', end: true,
      effects: [set('witnessHeard'), gain('attendant-account')] },
  ] },
  { id: 'driver-account', actor: 'lena', speaker: 'Lena Ortiz', start: 'start', nodes: [
    { id: 'start', text: 'I stopped the tram. Now people say I broke the signal because I was outside. My radio was dead. Nobody heard me call.', choices: [
      { id: 'listen', label: 'You are safe. Tell me what happened in your own words.', to: 'account', effects: [set('driverReassured')] },
      { id: 'accuse', label: 'You were outside. Did you cause the fault?', to: 'reset', effects: [
        { type: 'mistake', id: 'unsupported-driver-accusation', text: 'The driver was accused without supporting evidence.', penalty: 5 },
      ] },
    ] },
    { id: 'reset', text: 'Being outside does not mean I caused it. I was checking the notice after I stopped.', choices: [
      { id: 'reset-tone', label: 'You are right. Let us record the order without an accusation.', to: 'account' },
    ] },
    { id: 'account', text: 'The signal went dark. I stopped, checked the platform notice, and went to the shelter. The radio battery failed. I never opened the relay cabinet.', choices: [
      { id: 'limits', label: 'Separate her actions from the unknown cause of the fault.', to: 'recorded' },
    ] },
    { id: 'recorded', text: 'Check the platform recording and the controller notice. Those are better than my guess about the time.', end: true,
      effects: [set('driverHeard'), gain('driver-account')] },
  ] },
  { id: 'engineer-account', actor: 'samir', speaker: 'Samir Das', start: 'start', nodes: [
    { id: 'start', text: 'The line is held. I have isolated the cabinet under the incident reference. You can document it with me. I will remove the part after you photograph it.', choices: [
      { id: 'scope', label: 'Confirm who controls access, removal, and restoration.', to: 'scope' },
    ] },
    { id: 'scope', text: 'I control the equipment. Your report will not restore service. The required part, its rating, and the fitted label must agree. My test result goes in writing.', choices: [
      { id: 'record', label: 'Record the isolation and inspection limits.', to: 'recorded' },
    ] },
    { id: 'recorded', text: 'Read the work order and stock receipt. Then inspect and photograph the fitted label. We will compare all three before drawing a conclusion.', end: true,
      effects: [set('isolated'), gain('isolation-record')] },
  ] },
];

export const puzzles = [
  { id: 'midnight-clock', type: 'clock', title: 'When did Lena inspect the notice?',
    text: 'The original export displays 00:03. The recorder is five minutes fast. Include the date change in your answer.',
    displayed: '00:03', offsetMinutes: -5, hint: 'A fast clock is ahead. Subtract five minutes, crossing into the previous date.',
    choices: [
      { id: 'display', label: '00:03 · current date, no correction', value: '00:03' },
      { id: 'previous', label: '23:58 · previous date', value: '23:58' },
      { id: 'later', label: '00:08 · current date, add the error', value: '00:08' },
    ], onSuccess: [set('timeCorrected'), gain('corrected-time')],
    successResult: reply('23:58 on the previous date', 'The inspection followed the 23:57 fault. Record the corrected time separately from the original display.'),
    failureResult: reply('A fast clock is ahead', 'Subtract the error from 00:03. Cross midnight when needed. This is a working calculation; you can correct it without a score penalty.', 'warning') },
  { id: 'part-match', type: 'choice', title: 'What does the part comparison establish?',
    text: 'Q-18 requires R-28 / 24 V. The fitted label and stock receipt read R-82 / 48 V. Its carton was marked R-28. Samir’s signed test confirms the fitted part is incompatible.',
    answer: 'incompatible', hint: 'Compare both the part ID and rating. A stock error does not establish who intended what.',
    choices: [
      { id: 'same', label: 'The carton is marked R-28, so the fitted part is correct.', value: 'same' },
      { id: 'mismatch', label: 'The fitted part is incompatible; intent remains unproved.', value: 'incompatible' },
      { id: 'sabotage', label: 'The mismatch proves deliberate sabotage by the contractor.', value: 'sabotage' },
    ], onSuccess: [set('relayMatched'), gain('part-comparison')],
    successResult: reply('A supported cause, not an invented motive', 'The fitted identity and rating are wrong. Samir’s test supports an incompatible replacement. The supplier still needs to explain the stock error.'),
    failureResult: reply('Do not let a label or an allegation replace the comparison', 'Use the fitted part and written test. A mismatch supports a replacement error, but does not by itself establish intent. Revise the draft finding.', 'warning') },
  { id: 'signal-timeline', type: 'timeline', title: 'Put the fault, inspection, and alarm in order',
    text: 'Controller notice: 23:57, previous date. Corrected platform inspection: 23:58, previous date. Alarm at control: 00:01, current date.',
    answer: ['fault', 'inspection', 'alarm'], hint: 'The alarm after midnight belongs after both events on the previous date.',
    choices: [
      { id: 'clock-sort', label: 'Alarm → fault → inspection', value: ['alarm', 'fault', 'inspection'] },
      { id: 'supported', label: 'Fault → inspection → alarm', value: ['fault', 'inspection', 'alarm'] },
      { id: 'assumption', label: 'Inspection → fault → alarm', value: ['inspection', 'fault', 'alarm'] },
    ], onSuccess: [set('timelineSolved'), gain('event-order')],
    successResult: reply('The fault came first', 'The dated records place Lena’s inspection after the fault. Her presence outside does not establish that she caused it.'),
    failureResult: reply('Dates matter as well as clock numbers', 'The two 23:xx entries are on the previous date. The 00:01 entry is a later alarm report. All records remain available while you revise the order.', 'warning') },
  { id: 'property-claim', type: 'choice', title: 'How should you verify the lunchbox claim?',
    text: 'The private property log records a repaired yellow handle and an inside card naming Ada Bell. Ada says she lost a blue lunchbox.',
    answer: 'independent', hint: 'Ask for details the claimant has not been shown or told.',
    choices: [
      { id: 'color', label: 'Return it because she knows that it is blue.', value: 'color' },
      { id: 'prompt', label: 'Show the handle and card, then ask whether they are hers.', value: 'prompt' },
      { id: 'describe', label: 'Ask her to describe hidden details before showing the box.', value: 'independent' },
    ], onSuccess: [set('claimChecked')],
    successResult: reply('The description matches independently', 'Without seeing the box, Ada describes a yellow handle repaired by her grandson and a card with her full name. Return it through the attendant with a receipt.'),
    failureResult: reply('That check gives too much away', 'A public color is weak identification. Showing the private details first removes their value as an independent check. The box stays secure while you revise the approach.', 'warning') },
];
export const sequences = [{ id: 'shift-handoff', steps: [
  { id: 'lena', kind: 'line', speaker: 'Lena Ortiz', text: 'Thank you for checking the order of events. I did not need someone to take my side. I needed someone to check.' },
  { id: 'pause', kind: 'wait', duration: 700, text: 'The rain taps against the shelter roof.' },
  { id: 'acknowledge', kind: 'pose', actor: 'lena', pose: 'wave', duration: 850, text: 'Lena acknowledges the incoming watch.' },
  { id: 'handoff', kind: 'line', speaker: 'Mercer', text: 'The driver is safe. The line stays held. The next decision belongs to the repair and test record.', effects: [set('handoffSeen')] },
] }];
