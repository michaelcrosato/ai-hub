/** Four original rooms, authored only through the public scene data contract. */
export const areas = [
  { id: 'atrium', name: 'Atrium', shortName: 'Atrium', title: 'DEAD LETTER', subtitle: 'Intake', showTitle: false,
    bounds: [25, 75, 275, 248], spawn: [100, 205], obstacles: [[178, 98, 248, 133]],
    entrances: [{ id: 'front', x: 100, y: 205 }], camera: { focus: [150, 161, 12], fit: [460, 320] },
    ambience: { rain: false }, props: [{ id: 'intake-counter', kind: 'crate', x: 210, y: 118, z: 0, size: 1.7, color: '#83735e' }] },
  { id: 'sorting', name: 'Sorting room', shortName: 'Sorting', title: 'SORTING ROOM', subtitle: 'The label', showTitle: false,
    bounds: [35, 65, 310, 257], spawn: [85, 211], obstacles: [[180, 95, 240, 132], [265, 170, 295, 220]],
    entrances: [{ id: 'west', x: 85, y: 211 }], camera: { focus: [172, 161, 12], fit: [515, 345] },
    ambience: { rain: false }, props: [{ id: 'damp-parcel', kind: 'crate', x: 210, y: 116, z: 0, size: 1.3, color: '#aa8d62' }, { id: 'spare-box', kind: 'crate', x: 280, y: 198, z: 0, size: 1.5, color: '#546f76' }] },
  { id: 'archive', name: 'Clock archive', shortName: 'Archive', title: 'CLOCK ARCHIVE', subtitle: 'The time', showTitle: false,
    bounds: [48, 85, 240, 238], spawn: [85, 207], obstacles: [[137, 93, 211, 115]],
    entrances: [{ id: 'stairs', x: 85, y: 207 }], camera: { focus: [144, 125, 24], fit: [430, 330] },
    ambience: { rain: false }, props: [{ id: 'clock-cabinet', kind: 'crate', x: 176, y: 104, z: 0, size: 1.3, color: '#736f5f' }] },
  { id: 'roof-walk', name: 'Covered roof walk', shortName: 'Roof walk', title: 'ROOF WALK', subtitle: 'The clerk', showTitle: false,
    bounds: [20, 105, 330, 235], spawn: [75, 205], obstacles: [[235, 112, 291, 146]],
    entrances: [{ id: 'roof-door', x: 75, y: 205 }], camera: { focus: [175, 170, 12], fit: [535, 300] },
    ambience: { rain: true }, props: [{ id: 'roof-planter', kind: 'crate', x: 263, y: 130, z: 0, size: 1.3, color: '#526c60' }] },
];

export const hotspots = [
  { id: 'intake-desk', area: 'atrium', name: 'Intake ledger', type: 'procedure', description: 'A hold form and a return receipt wait at the desk.', x: 209, y: 118, z: 25, walk: [203, 158] },
  { id: 'parcel-table', area: 'sorting', name: 'Damp return parcel', type: 'evidence', description: 'A damaged label and a numbered seal need careful reading.', x: 210, y: 116, z: 25, walk: [210, 155] },
  { id: 'archive-clock', area: 'archive', name: 'Dispatch clock', type: 'document', description: 'The delivery slip reads 00:18. The clock has been running fast.', x: 173, y: 102, z: 29, walk: [175, 142] },
  { id: 'clerk-seat', area: 'roof-walk', actor: 'night-clerk', name: 'Mara Venn · night clerk', type: 'person', description: 'The municipal archive clerk kept watch during the outage.', x: 158, y: 135, z: 33, walk: [165, 169] },
];

export const actors = [{
  id: 'night-clerk', area: 'roof-walk', x: 158, y: 135, z: 0, facing: 0.3, portrait: true,
  appearance: { outfit: 'coat', sleeves: 'long', hair: 'short', colors: { skin: '#ad8068', hair: '#453832', coat: '#6b7b67', cloth: '#d5c7a9', pants: '#414f51', boot: '#252c30' } },
  appearances: [{ when: { flag: 'courteous' }, appearance: { colors: { coat: '#6a8068' } } }],
  animation: 'clerkGreeting', poses: [{ when: { flag: 'accountHeard' }, pose: 'wave' }],
}];
