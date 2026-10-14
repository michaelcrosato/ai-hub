/** Original Bellwether tram terminus. Walk points stay clear of all prop bounds. */
const room = (id, name, subtitle, props, obstacles, extra = {}) => ({
  id, name, shortName: name, title: name.toUpperCase(), subtitle, showTitle: false,
  bounds: [20, 70, 330, 265], spawn: [75, 225], obstacles,
  entrances: [{ id: 'entry', x: 75, y: 225 }],
  camera: { focus: [175, 164, 12], fit: [555, 355] },
  ambience: { rain: false }, props, ...extra,
});
const prop = (id, kind, x, y, color, size = 1.4) => ({ id, kind, x, y, z: 0, color, size });
export const areas = [
  room('control', 'Control room', 'Dispatch and case review', [
    prop('desk', 'crate', 224, 112, '#607f87', 2),
    prop('desk-lamp', 'lamp', 277, 103, '#d1b47c'),
    prop('radio-box', 'crate', 112, 112, '#727780'),
  ], [[194, 90, 254, 136], [96, 96, 127, 126], [267, 92, 287, 115]]),
  room('concourse', 'Concourse', 'Passengers and lost property', [
    prop('ticket-desk', 'crate', 260, 114, '#94765d', 2),
    prop('baggage', 'crate', 104, 115, '#b38a5c'),
    prop('shelter-lamp', 'lamp', 300, 166, '#e5bc7b'),
  ], [[230, 91, 290, 138], [89, 100, 120, 130], [290, 156, 310, 179]]),
  room('platform', 'Platform', 'Keep clear of the tracks', [
    prop('signal-post', 'streetlamp', 260, 109, '#b69467', 1.5),
    prop('barrier', 'barrel', 111, 113, '#bd744d'),
    prop('notice-box', 'crate', 205, 110, '#617677'),
  ], [[248, 95, 273, 123], [98, 100, 124, 126], [190, 96, 222, 124]],
  { ambience: { rain: true }, when: { flag: 'trafficHeld' }, reason: 'Ask transit control to hold all movements first.' }),
  room('shelter', 'Service shelter', 'The missing driver', [
    prop('heater', 'barrel', 263, 108, '#775d4e'),
    prop('dry-bench', 'crate', 112, 111, '#626f68', 1.7),
    prop('shelter-light', 'lamp', 296, 161, '#dec38a'),
  ], [[249, 95, 277, 124], [88, 94, 135, 130], [286, 149, 308, 174]],
  { when: { flag: 'searchAssigned' }, reason: 'Coordinate the shelter search at Dispatch console first.' }),
  room('relay-room', 'Relay room', 'A controlled engineering inspection', [
    prop('relay-cabinet', 'crate', 243, 111, '#5f727c', 2),
    prop('service-desk', 'crate', 110, 111, '#887860', 1.6),
    prop('work-lamp', 'lamp', 291, 166, '#d8b97b'),
  ], [[213, 86, 274, 139], [87, 92, 134, 131], [281, 154, 304, 181]],
  { when: { flag: 'engineerReady' }, reason: 'Request the engineer through dispatch after locating the driver.' }),
];
const spot = (id, area, name, type, x, y, walk, description, actor) => ({
  id, area, name, type, x, y, z: 28, walk, description, ...(actor ? { actor } : {}),
});
export const hotspots = [
  spot('dispatch', 'control', 'Dispatch console', 'procedure', 112, 112, [112, 155], 'Stop tram movements, coordinate assistance, and review optional work.'),
  spot('case-desk', 'control', 'Case review desk', 'procedure', 224, 112, [225, 164], 'Compare the records. A report must distinguish facts from unanswered questions.'),
  spot('attendant', 'concourse', 'Ivo Chen · attendant', 'person', 191, 159, [182, 194], 'The attendant saw the driver leave the platform.', 'ivo'),
  spot('property', 'concourse', 'Found lunchbox', 'evidence', 104, 115, [105, 160], 'A blue lunchbox was left under the ticket counter.'),
  spot('passenger', 'concourse', 'Ada Bell · passenger', 'person', 266, 170, [258, 207], 'A passenger needs a safe route home after the last tram is canceled.', 'ada'),
  spot('signal', 'platform', 'Signal and warning notice', 'evidence', 260, 109, [260, 153], 'The signal is dark. Do not touch the trackside equipment.'),
  spot('recorder', 'platform', 'Platform event recorder', 'document', 205, 110, [201, 157], 'A station export preserves the driver’s movement and the recorder clock check.'),
  spot('driver', 'shelter', 'Lena Ortiz · driver', 'person', 184, 144, [181, 189], 'The driver waits in the dry service shelter with a failed radio.', 'lena'),
  spot('engineer', 'relay-room', 'Samir Das · engineer', 'person', 171, 172, [171, 210], 'The engineer controls isolation and access to the signal equipment.', 'samir'),
  spot('service-log', 'relay-room', 'Service records', 'document', 110, 111, [108, 164], 'The work order, test record, and receipt can be compared.'),
  spot('relay', 'relay-room', 'Isolated relay cabinet', 'evidence', 243, 111, [240, 171], 'Photograph the fitted part before the engineer removes it.'),
];
const actor = (id, area, x, y, coat, skin, hair) => ({
  id, area, x, y, z: 0, facing: .35, portrait: true, pose: 'hips',
  appearance: { outfit: 'coat', sleeves: 'long', hair: 'short', weapon: null,
    colors: { coat, skin, hair, cloth: '#d4d0bb', pants: '#35464f', boot: '#202b32' } },
});
export const actors = [
  actor('ivo', 'concourse', 191, 159, '#627e75', '#be997e', '#302e2b'),
  actor('ada', 'concourse', 266, 170, '#997d66', '#a77d64', '#595754'),
  { ...actor('lena', 'shelter', 184, 144, '#567887', '#b5856c', '#3a302c'),
    poses: [{ when: { flag: 'driverHeard' }, pose: 'wave' }] },
  actor('samir', 'relay-room', 171, 172, '#a08658', '#9a735c', '#332d29'),
];
