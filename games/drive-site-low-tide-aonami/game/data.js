(function (root) {
    'use strict';
    const D = {};
    D.title = 'Low Tide';
    D.version = '1.0.0';
    D.objectives = [
        { title: "A brother's trail", text: 'Ask Hana at the tea shop about Ken.', target: 'hana', hint: 'Hana stands outside the tea shop on Lantern Lane. Follow the amber mark on your map.' },
        { title: 'The empty sleeve', text: "Visit Sato's repair shop. Inspect the tape sleeve.", target: 'sato', hint: 'The repair shop is on the east side of Lantern Lane. Turn the sleeve and examine both sides.' },
        { title: 'A name and a time', text: 'Meet Emi at the slipway after 17:30.', target: 'emi', hint: 'You can wait at the waterfront bench. Emi walks from the workshop to the slipway at 17:30.' },
        { title: 'The evening load', text: 'Help Jun load three crates at the cargo quay.', target: 'jun', hint: 'Jun is at the east cargo quay. Pick up each marked crate with E. Carry it to the painted loading square.' },
        { title: 'Locker 04', text: 'Use the key at the ferry lockers.', target: 'lockers', hint: 'The lockers are beside the blue warehouse. The sleeve has the correct locker number.' },
        { title: 'A stolen voice', text: 'Recover the tape from the dock collectors.', target: 'fight', hint: 'Use J for a punch, K for a kick, L to guard, and Space to step away. Their bright stance warns of an attack.' },
        { title: 'The missing signal', text: 'Play the tape at the old signal station.', target: 'radio', hint: 'The signal station is at the west end of the upper lane. The tape label has the radio frequency.' },
        { title: 'A signal in the dark', text: 'The case is complete. Spend the evening in Aonami.', target: null, hint: 'Talk to your neighbors, train with Imai, or try to beat your score at Signal Catch.' }
    ];
    D.buildings = [
        { id: 'signal', name: 'SIGNAL STATION', x: 55, y: 80, w: 105, d: 95, h: 71, color: '#688080', roof: '#394c57', trim: '#bcc2b2', type: 'signal' },
        { id: 'tea', name: 'HANA TEA', x: 180, y: 160, w: 110, d: 120, h: 72, color: '#877966', roof: '#474d51', trim: '#aa563f', type: 'tea' },
        { id: 'books', name: 'KOMA BOOKS', x: 310, y: 170, w: 90, d: 110, h: 92, color: '#9a9682', roof: '#51575a', trim: '#3f6863', type: 'books' },
        { id: 'repair', name: 'SATO RADIO', x: 425, y: 160, w: 105, d: 120, h: 82, color: '#698385', roof: '#485a60', trim: '#b9a47b', type: 'repair' },
        { id: 'warehouse', name: 'QUAY 04', x: 580, y: 65, w: 115, d: 195, h: 86, color: '#556f7a', roof: '#394d59', trim: '#d1b978', type: 'warehouse' },
        { id: 'workshop', name: 'EMI MOTORS', x: 335, y: 30, w: 160, d: 80, h: 60, color: '#7c8279', roof: '#465f65', trim: '#b36e47', type: 'garage' },
        { id: 'arcade', name: 'NAMI GAMES', x: 75, y: 395, w: 120, d: 90, h: 60, color: '#5f7c78', roof: '#465552', trim: '#b55542', type: 'arcade' },
        { id: 'store', name: 'MORNING STORE', x: 255, y: 425, w: 112, d: 86, h: 56, color: '#8a907a', roof: '#52676a', trim: '#baab81', type: 'store' },
        { id: 'ferry', name: 'AONAMI FERRY', x: 475, y: 440, w: 95, d: 78, h: 57, color: '#989b86', roof: '#566b6a', trim: '#738984', type: 'ferry' }
    ];
    D.npcs = [
        { id: 'hana', name: 'Hana', role: 'Tea shop owner', x: 229, y: 307, color: '#a16f57', pants: '#344c4a', hair: '#ddd1b5', size: .83, pose: 'hips' },
        { id: 'sato', name: 'Sato', role: 'Radio repairer', x: 461, y: 305, color: '#879f9b', pants: '#364448', hair: '#807b6b', size: .92, pose: 'hips' },
        { id: 'emi', name: 'Emi', role: 'Ferry mechanic', x: 417, y: 127, color: '#baa36f', pants: '#364b56', hair: '#243941', size: .89, hairStyle: 'ponytail' },
        { id: 'jun', name: 'Jun', role: 'Cargo foreman', x: 659, y: 446, color: '#476c79', pants: '#303f45', hair: '#343733', size: 1.04, pose: 'hips' },
        { id: 'imai', name: 'Imai', role: 'Retired dockworker', x: 211, y: 400, color: '#b0b3a0', pants: '#444d4e', hair: '#cdc8b2', size: .98, pose: 'guard' },
        { id: 'aya', name: 'Aya', role: 'Signal keeper', x: 121, y: 197, color: '#557d78', pants: '#293d42', hair: '#342e30', size: .87, hairStyle: 'long' },
        { id: 'yui', name: 'Yui', role: 'Bookshop clerk', x: 350, y: 307, color: '#875e63', pants: '#32404d', hair: '#2e3540', size: .84 },
        { id: 'tomo', name: 'Tomo', role: 'Ferry clerk', x: 492, y: 538, color: '#6a8992', pants: '#344753', hair: '#4f4b41', size: .91, pose: 'hips' },
        { id: 'visitor1', name: 'A neighbor', role: 'On the way home', x: 326, y: 365, color: '#8e766a', pants: '#465455', hair: '#292e34', size: .9, ambient: true, route: [[330, 355], [550, 355], [550, 400], [410, 400], [330, 355]] },
        { id: 'visitor2', name: 'A dockworker', role: 'Evening shift', x: 715, y: 335, color: '#c09662', pants: '#344c55', hair: '#4c4a40', size: 1, ambient: true, route: [[715, 345], [740, 490], [690, 490], [620, 365], [715, 345]] },
        { id: 'visitor3', name: 'A neighbor', role: 'A daily walk', x: 120, y: 343, color: '#6c826a', pants: '#4d4c49', hair: '#c0b7a6', size: .84, ambient: true, route: [[110, 340], [300, 340], [303, 384], [225, 380], [110, 340]] },
        { id: 'visitor4', name: 'A student', role: 'A book under one arm', x: 400, y: 336, color: '#556274', pants: '#2a3e4a', hair: '#283139', size: .83, ambient: true, route: [[405, 330], [560, 330], [558, 395], [405, 395], [405, 330]] }
    ];
    D.props = [
        { id: 'bench', name: 'Waterfront bench', type: 'bench', x: 412, y: 541, r: 32 },
        { id: 'lockers', name: 'Ferry lockers', type: 'lockers', x: 585, y: 286, r: 29 },
        { id: 'radio', name: 'Signal station radio', type: 'radio', x: 100, y: 194, r: 29 },
        { id: 'arcade', name: 'Signal Catch', type: 'arcade', x: 142, y: 365, r: 27 },
        { id: 'capsule', name: 'Harbor capsule toys', type: 'capsule', x: 173, y: 366, r: 23 },
        { id: 'vending', name: 'Cold drinks · ¥100', type: 'vending', x: 532, y: 291, r: 24 },
        { id: 'cat', name: 'A small harbor cat', type: 'cat', x: 279, y: 533, r: 24 },
        { id: 'board', name: 'District noticeboard', type: 'board', x: 363, y: 400, r: 25 },
        { id: 'flowers', name: 'Flowers by the seawall', type: 'flowers', x: 366, y: 570, r: 23 },
        { id: 'ferrybell', name: 'Ferry departure bell', type: 'ferrybell', x: 565, y: 558, r: 24 }
    ];
    D.landmarks = [{ name: 'Signal station', x: 100, y: 180 }, { name: 'Hana Tea', x: 232, y: 284 }, { name: 'Koma Books', x: 350, y: 284 }, { name: 'Sato Radio', x: 474, y: 283 }, { name: 'Emi Motors', x: 415, y: 111 }, { name: 'Warehouse 04', x: 636, y: 265 }, { name: 'Nami Games', x: 140, y: 388 }, { name: 'Practice yard', x: 225, y: 400 }, { name: 'Waterfront bench', x: 412, y: 553 }, { name: 'Cargo quay', x: 694, y: 468 }, { name: 'Ferry office', x: 520, y: 532 }, { name: 'Slipway', x: 765, y: 394 }];
    D.crates = [{ id: 0, x: 613, y: 426, tag: '01' }, { id: 1, x: 624, y: 459, tag: '02' }, { id: 2, x: 600, y: 488, tag: '03' }];
    D.loading = { x: 731, y: 508, w: 48, d: 46 };
    D.toys = [{ id: 'toy-gull', name: 'White gull', description: 'A small gull with one wing raised. It seems to be waiting for the wind.' }, { id: 'toy-boat', name: 'Blue ferry', description: 'A tiny ferry with a red roof. Someone painted the cabin windows by hand.' }, { id: 'toy-light', name: 'North light', description: 'A brass-colored model of the lighthouse across the bay.' }];
    root.HARBOR_DATA = D;
})(window);
