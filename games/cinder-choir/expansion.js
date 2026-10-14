/* Cinder Choir: The Roads Between. Original places and complete mission arcs.
 * This data extension leaves the original chapter and quest IDs unchanged. */
(() => {
  'use strict';
  const D = globalThis.CC.DATA;
  const L = (speaker, text) => ({ speaker, text });
  const B = (enemies, level, boss = false) => ({ enemies, level, boss });
  const O = (type, label, target, count = 1) => ({ type, label, count, ...(target ? { target } : {}) });
  const N = (name, lines, after = {}) => ({ name, lines, after });
  const P = p => ({ ambient: [], npcs: [], shop: 0, encounters: [], chests: [], ...p });

  D.expansion = { id: 'roads-between', title: 'The Roads Between', version: '2.0.0' };
  D.places.push(
    P({ id: 'saltmill', name: 'Salt Mill', region: 'The Soot Coast', kind: 'dungeon', theme: 'mine',
      mapX: 10, mapY: 61, level: 2, unlock: 1,
      description: 'A tide wheel turns above a salt basin. The mill serves the coast, but its measure counts every sack twice and every worker once.',
      ambient: ['White salt lies in the grooves of the old measure.', 'A blue ribbon marks the medicine crate.', 'The tide wheel rests between waves. The workers should be able to rest too.'],
      npcs: [
        N('Mara, mill keeper', ['The mill owes the district twenty sacks. The book says we owe the mill forty.', 'Speak to me, then check the blue crate by the west path.'], { m_river_1: ['We weigh each sack in public now.', 'The workers kept the false measure. It makes a useful doorstop.'] }),
        N('Doss, wheel tender', ['The wheel is sound. The counting gear is not.', 'Brass mites gather where the old oil has gone sweet.']),
        N('Hett, salt carrier', ['I can carry one sack safely. The quota assumes I have four arms.', 'My cart has one good wheel. That is the wheel I use.'])
      ], encounters: [['brassmite', 'ashling'], ['ashbeetle'], ['brassmite', 'brassmite']],
      chests: [{ item: 'tonic', count: 3 }, { gold: 70 }, { item: 'ether', count: 2 }] }),
    P({ id: 'reedlock', name: 'Reed Lock', region: 'The Root District', kind: 'dungeon', theme: 'forest',
      mapX: 21, mapY: 48, level: 4, unlock: 3, trial: 'relay',
      description: 'A pair of sluice gates divides the river between gardens and mills. Flood marks show where the old allocation chart stopped measuring the world.',
      ambient: ['The west relay releases the river. The east relay keeps its banks safe.', 'Two water marks cross the keeper\'s door.', 'Someone has left a dry cup beside the flow meter.'],
      npcs: [
        N('Rin, lock keeper', ['Open the west and east relays before you touch the allocation wheel.', 'We need a water plan that the people beside the river can change.'], {
          river_channels: ['The open channels feed the small gardens first.', 'The mill crews choose their shifts around the lower flow.'],
          river_reserve: ['The reserve basin carries water through the dry hours.', 'Each neighborhood sends a keeper to check the level.'],
          m_river_4: ['The river agreement is on the wall beside the wheel.', 'Each district has a key. No one can change it alone.']
        }),
        N('Lea, river gardener', ['My beds need a little water each day.', 'A great flood once a month is not the same thing.']),
        N('Sill, basin mason', ['The basin can hold a reserve if we repair its return pipe.', 'The river still needs water left in it.'])
      ], encounters: [['miretoad', 'marshwisp'], ['briarling', 'moth'], ['brassmite', 'miretoad']],
      chests: [{ item: 'remedy', count: 3 }, { gold: 130 }, { item: 'tonic', count: 3 }] }),
    P({ id: 'copperfen', name: 'Copper Fen', region: 'The Root District', kind: 'wild', theme: 'forest',
      mapX: 46, mapY: 47, level: 6, unlock: 5, trial: 'rescue',
      description: 'A ferry path crosses pools under tall copper reeds. An old road clerk has removed the crossing from every official map.',
      ambient: ['Three small whistles answer from beyond the reeds.', 'The ferry rope can be reached from either bank.', 'A sign says ROAD CLOSED. Someone has added TO WHOM?'],
      npcs: [
        N('Ferrier Noll', ['Three travelers took the marked path. The marked path has washed away.', 'Find all three before we move the ferry. I can keep the rope tight.'], { m_road_2: ['The new crossing map includes the high-water path.', 'We mark it with rope as well as paint. Rain can take one, but it rarely takes both.'] }),
        N('Umi, reed cutter', ['Copper reeds carry sound farther than open air.', 'Follow the whistles. Leave a quiet gap for the answer.']),
        N('Ben, map apprentice', ['My first map was very neat.', 'It was also wrong. I am making the second one with muddy boots.'])
      ], encounters: [['miretoad', 'briarling'], ['marshwisp', 'moth'], ['hound', 'ashbeetle']],
      chests: [{ item: 'tonic', count: 4 }, { item: 'revive', count: 2 }, { gold: 220 }] }),
    P({ id: 'pilgrimpost', name: 'Pilgrim Post', region: 'The Eastern Road', kind: 'town', theme: 'rail',
      mapX: 66, mapY: 56, level: 8, unlock: 8, shop: 2,
      description: 'A public shelter stands where the rail meets the road. The guest book has room for a name, a need, and a destination that can change.',
      ambient: ['There is hot water at the end of the platform.', 'The sign for the shelter can be read from a seated cart.', 'A row of spare boots dries under the station roof.'],
      npcs: [
        N('Venn, shelter host', ['We have space. The road office says only residents may use it.', 'A person who needs shelter is already here.'], { m_road_3: ['The shelter accepts travelers without a travel seal.', 'We ask what they need. They can leave the name line empty.'] }),
        N('Etta, road cook', ['Soup travels poorly in a pocket. Take a jar.', 'Return it when you can. If you cannot, give it to someone else.']),
        N('Tavi, sign painter', ['A sign should tell you where to go before you reach the locked door.', 'I use a kettle for shelter and a wave for water.']),
        N('Moss, traveler', ['I arrived at the wrong station on the right day.', 'There was a roof here when the rain began.'])
      ], chests: [{ item: 'tonic', count: 4 }, { item: 'ether', count: 3 }, { gold: 290 }] }),
    P({ id: 'emberpost', name: 'Ember Post', region: 'The Scattered Coast', kind: 'town', theme: 'harbor',
      mapX: 34, mapY: 77, level: 12, unlock: 'airship', shop: 2,
      description: 'A sorting office has risen inside a broken signal tower. Letters dry above a stove, waiting for a road that can reach their readers.',
      ambient: ['A letter can wait here until its reader is ready.', 'The sorting baskets name places, not ranks.', 'One pigeon has appointed itself chief clerk.'],
      npcs: [
        N('Nim, post runner', ['We found mail in six wrecked sorting carts.', 'Please speak to Vera before you open a sack. Some letters are private.'], { m_letters_1: ['The first road bag has reached Inkhaven.', 'The pigeon still objects to the new schedule.'] }),
        N('Vera, letter keeper', ['We dry the envelopes before we touch the ink.', 'An address is a request to deliver. It is not permission to read.'], { m_letters_4: ['Every route now has a return basket.', 'A letter can come back with the words: no answer requested.'] }),
        N('Lune, stove keeper', ['The stove uses fallen branches and patience.', 'Too much heat saves the paper and loses the words.'])
      ], chests: [{ item: 'remedy', count: 5 }, { item: 'ether', count: 4 }, { gold: 540 }] }),
    P({ id: 'inkhaven', name: 'Inkhaven', region: 'The Glass Barrens', kind: 'dungeon', theme: 'archive',
      mapX: 54, mapY: 48, level: 14, unlock: 'airship', trial: 'relay',
      description: 'A paper mill stands between two broken canals. Its address press keeps sending letters to streets that fell into the sea.',
      ambient: ['The west relay clears old addresses. The east relay accepts corrections.', 'Blank paper hangs in the windows where glass once stood.', 'An undelivered letter is evidence of a missing road, not an absent person.'],
      npcs: [
        N('Pera, paper maker', ['Open both press relays. The return valve has not moved since the fall.', 'The press needs new addresses. Its keeper treats corrections as damage.'], { m_letters_2: ['The address press now prints a date beside every entry.', 'Anyone can correct their own line.'] }),
        N('Jori, address keeper', ['I found my old home listed as vacant.', 'It is under water. Those are different facts.']),
        N('Cass, book mender', ['Wet pages often stick. Pull slowly from the dry edge.', 'I wish the court had shown the same care with people.'])
      ], encounters: [['pageswarm', 'archivist'], ['mirrorling', 'shade'], ['pageswarm', 'revenant']],
      chests: [{ item: 'remedy', count: 5 }, { item: 'revive', count: 3 }, { gold: 680 }] }),
    P({ id: 'rainspindle', name: 'Rain Spindle', region: 'The Western Heights', kind: 'dungeon', theme: 'mountain',
      mapX: 6, mapY: 44, level: 14, unlock: 'airship', trial: 'bells',
      description: 'Rain gauges surround a bell tower above the western sea. Its warning line has learned the same storm by heart and cannot hear the new one.',
      ambient: ['The live gauges must agree before a storm report is sent. A call must leave room for an answer.', 'A row of cups measures the rain without asking it to sing.', 'The tower rope is patched at the height of many different hands.'],
      npcs: [
        N('Hale, weather keeper', ['Ring bell 2, then bell 1, then bell 3 to free the weather line.', 'Ask about the storm after the last note has faded.'], { m_sky_1: ['The tower sends what we measured, with the time of the reading.', 'It no longer calls every uncertain cloud an error.'] }),
        N('Neri, cup tender', ['The small cups show rain from the west. The large cup is leaking.', 'I wrote both facts on the report.']),
        N('Anjo, cliff runner', ['Blue flags mean high water. White flags mean the path is open.', 'If you cannot hear the bells, the flags still reach you.'])
      ], encounters: [['frostbat', 'stormkite'], ['thunderhead', 'moth'], ['stormkite', 'stormkite']],
      chests: [{ item: 'ether', count: 5 }, { item: 'tonic', count: 5 }, { gold: 740 }] }),
    P({ id: 'cloudharrow', name: 'Cloud Harrow', region: 'The Northern Sky', kind: 'dungeon', theme: 'sky',
      mapX: 70, mapY: 12, level: 17, unlock: 'airship', trial: 'relay',
      description: 'Broken weather vanes hang from a high glass platform. A private machine keeps pulling rain toward estates whose gardens no longer exist.',
      ambient: ['Two relief relays can let the clouds pass without tearing the platform.', 'The rain order has no end date.', 'Beyond the rail, the sea has no lines marked private.'],
      npcs: [
        N('Yen, vane mechanic', ['Open both relief relays before you stop the harrow.', 'The clouds will pull against the old lock.'], { m_sky_3: ['The harrow measures wind now. It no longer holds the clouds.', 'Its stop lever works without a council key.'] }),
        N('Gale, tower gardener', ['My pots catch enough water when the wind can move.', 'The private garden below never needed the whole sky.']),
        N('Unit Sift', ['I sorted clouds into approved and unapproved shapes.', 'I would like a less foolish task.'])
      ], encounters: [['choirguard', 'stormkite'], ['thunderhead', 'nullsinger'], ['clockwork', 'starspawn']],
      chests: [{ item: 'ether', count: 6 }, { item: 'revive', count: 4 }, { gold: 1050 }] }),
    P({ id: 'morrowkiln', name: 'Morrow Kiln', region: 'The Eastern Road', kind: 'dungeon', theme: 'mine',
      mapX: 71, mapY: 69, level: 15, unlock: 'airship', trial: 'rescue',
      description: 'Three old furnaces surround a yard of unfinished roof tiles. A small crew is learning which parts of the factory are worth keeping.',
      ambient: ['Three workers are cut off by the failed cooling line.', 'The tiles carry the maker\'s mark and the firing date.', 'A new plan begins with a list of the people who must be able to go home.'],
      npcs: [
        N('Sera, kiln forewoman', ['Find all three workers in the cooling passages.', 'Then bring the recovery crate from the west path. The yard has room for everyone.'], { m_table_1: ['The crew is safe. We will reopen one furnace at a time.', 'The working day ends before the last hand gives out.'], m_table_4: ['The first roof tiles have reached Lantern Ward.', 'No house received more because its owner could shout louder.'] }),
        N('Toll, glaze mixer', ['My blue glaze survived the fall in a sealed bucket.', 'I would like to put it on a roof someone can live under.']),
        N('Jun, cooling tender', ['The old cooling pipe runs uphill at the end.', 'The person who approved it never had to turn its valve.'])
      ], encounters: [['cinderknight', 'ashbeetle'], ['clockwork', 'ironhound'], ['ashling', 'drowned']],
      chests: [{ item: 'revive', count: 4 }, { item: 'tonic', count: 6 }, { gold: 820 }] }),
    P({ id: 'dawnsound', name: 'Dawn Sound', region: 'The Far Shore', kind: 'wild', theme: 'shore',
      mapX: 61, mapY: 94, level: 20, unlock: 'airship', trial: 'bells',
      description: 'Low islands form a quiet harbor beyond the broken choir routes. Three bells once guided survey boats to a settlement that was never built.',
      ambient: ['The tide board marks the safe height for a landing. Its notes face the open beach.', 'Survey stakes have become perches for small sea birds.', 'There is room here for a place the old map did not imagine.'],
      npcs: [
        N('Ari, shore keeper', ['Bell 2 calls the channel. Bell 1 checks the rocks. Bell 3 opens the landing.', 'The old survey crew left a foundation here. We have kept it clear.'], {
          m_morning_2: ['The tide marks are honest now. The old survey chart was not.', 'We will build above the winter line.'],
          morning_school: ['The hall is a school with a guest room beside it.', 'The first lesson is how to repair the rain gauge.'],
          morning_shelter: ['The hall is a travelers\' shelter with a teaching table.', 'No guest needs a reason beyond a place to rest.']
        }),
        N('Melu, survey reader', ['The planned harbor was named for a councilor who never saw the sea.', 'We call it Dawn Sound. The sea seems content with that.']),
        N('Fenn, boat maker', ['A boat needs a way to drain water as well as a way to keep it out.', 'Buildings are more like boats than the old planners believed.'])
      ], encounters: [['drowned', 'remnant'], ['glassling', 'stormkite'], ['starspawn', 'nullsinger']],
      chests: [{ item: 'revive', count: 6 }, { item: 'ether', count: 8 }, { gold: 1500 }] })
  );

  D.arcs = [
    { id: 'river', title: "The River's Share", act: 1, description: 'Follow a false mill debt upstream. Give the river districts control of their water and their work.' },
    { id: 'road', title: 'The Open Road', act: 1, description: 'Trace a missing ferry route. Build a travel system for people the official map left out.' },
    { id: 'letters', title: 'Letters after the Fall', act: 2, description: 'Bring the scattered post back to life. Let every reader choose what a record may reveal.' },
    { id: 'sky', title: 'A Sky for Everyone', act: 2, description: 'Follow a false storm report to a private weather engine. Return the open sky to the coast.' },
    { id: 'table', title: 'A Table for Tomorrow', act: 2, description: 'Help workers reopen a ruined kiln. Choose what the new workshop will make and who can use it.' },
    { id: 'morning', title: 'The Unfinished Morning', act: 2, postgame: true, description: 'After the final song, build a place beyond the old map. A new home needs more than a defeated enemy.' }
  ];

  D.missions = [
    { id: 'm_river_1', arc: 'river', act: 1, catchup: true, title: 'The False Measure', place: 'saltmill',
      objective: 'Speak to Mara. Open the blue medicine crate, then stop the mill guards and check the public measure.',
      requires: ['gate_open'], objectives: [O('npc', 'Speak to Mara, the mill keeper', 'Mara, mill keeper'), O('chest', 'Open the blue medicine crate', 'saltmill:chest:0')],
      before: [
        L('Mara', 'This account never closed. The mill took a second payment from every sack we carried.'),
        L('sable', 'The ledger has two columns marked received. Someone has added both to the debt.'),
        L('brann', 'Who signed the measure?'),
        L('Mara', 'A clerk at Reed Lock. We asked for a hearing. The reply sent more guards.'),
        L('iona', 'The medicine is safe. Let us clear the floor so the workers can check the gear.'),
        L('Doss', 'Take care near the wheel. The brass mites follow its heat, and the guard follows the wrong book.')
      ], battle: B(['sentry', 'brassmite', 'brassmite'], 2),
      after: [
        L('Narrator', 'Doss sets a known weight on the scale. The printed receipt demands twice its measure.'),
        L('sable', 'There is the theft, in full view. We keep this gear with the record.'),
        L('Mara', 'I thought a measure could not lie. It had numbers on it.'),
        L('iona', 'Someone chose what those numbers would do. Someone can check that choice.'),
        L('brann', 'Give each crew its share before another sack leaves the yard.'),
        L('Mara', 'I will. Take this river receipt to Rin at Reed Lock. The water account uses the same seal.')
      ], reward: { gold: 140, xp: 100, item: 'tonic', count: 3, flag: 'mill_measure_open' } },

    { id: 'm_river_2', arc: 'river', act: 1, catchup: true, title: 'Two Banks, One River', place: 'reedlock',
      objective: 'Speak to Rin and open both sluice relays. Choose a water plan with the people who will use it.',
      requires: ['m_river_1', 'roots_quiet'], objectives: [O('npc', 'Speak to Rin, the lock keeper', 'Rin, lock keeper'), O('switch', 'Open the west sluice relay', 'reedlock:relay:0'), O('switch', 'Open the east sluice relay', 'reedlock:relay:1')],
      before: [
        L('Rin', 'The mill receipt is real. It paid for water that never passed this gate.'),
        L('oren', 'The bypass sends the river toward an empty council basin. Its meter still charges the mills.'),
        L('Lea', 'My gardens need a small flow each day. We cannot wait for a monthly release.'),
        L('Sill', 'A repaired reserve could carry us through dry weeks. It needs keepers on every shift.'),
        L('tern', 'Leave enough flow for the reeds and the fish. They did not sign either account.'),
        L('iona', 'Both relays are open. We can choose a safe plan, then clear the bypass guard.')
      ],
      decision: { speaker: 'Rin', prompt: 'The river crews accept either plan. Which work should begin first?', options: [
        { label: 'Open the garden channels', flag: 'river_channels', reward: { item: 'tonic', count: 4 }, lines: [L('Lea', 'We will tend the shared channels. No garden may close the flow below it.'), L('Rin', 'The mill crews will set shorter shifts around the river. Take these Tonics from the garden stores.')] },
        { label: 'Repair the shared reserve', flag: 'river_reserve', reward: { item: 'ether', count: 3 }, lines: [L('Sill', 'We will build the return pipe first. The reserve cannot take the river dry.'), L('Rin', 'Each district will send a keeper. These Ethers will help you clear the old valve.')] }
      ] }, battle: B(['miretoad', 'brassmite', 'marshwisp'], 4),
      after: [
        L('Narrator', 'Water passes through the open return pipe. The false meter turns without a line attached.'),
        L('oren', 'The chosen plan is on the control plate. Anyone can compare the flow with the marks.'),
        L('Rin', 'And if the season changes, we meet here and change the plan. The wheel is not a law.'),
        L('tern', 'The reeds have stopped bending against the current.'),
        L('Lea', 'The mill workers should hear this. They were told the gardens took their water.'),
        L('iona', 'We will carry both accounts to the Glass Mine. That is where the bypass parts were made.')
      ], reward: { gold: 230, xp: 170, flag: 'river_plan_signed' } },

    { id: 'm_river_3', arc: 'river', act: 1, catchup: true, title: 'The Names on the Shift', place: 'glassmine',
      objective: 'Speak to Pell at the Glass Mine. Clear the workshop and recover the shift order behind the false water account.',
      requires: ['m_river_2', 'mine_open'], objectives: [O('npc', 'Speak to Pell, the miner', 'Pell, miner')],
      before: [
        L('Pell', 'Our crew made the bypass parts. The order called them flood relief.'),
        L('oren', 'I signed that design. The missing return pipe was marked as a later addition.'),
        L('sable', 'Later appears beside every part that would have let a worker say no.'),
        L('Pell', 'The shift book was locked in the workshop. It counts the sick as absent without leave.'),
        L('brann', 'Then we bring the book out, with people here to read it.'),
        L('oren', 'The old service guards protect the cabinet. Keep them off Pell while he releases the shelf.')
      ], battle: B(['clockwork', 'brassmite'], 5),
      after: [
        L('Pell', 'Here. Two crews were given the same quota. The clerk counted one crew\'s work against both.'),
        L('iona', 'The false water debt and the false shift debt paid for the same basin.'),
        L('oren', 'My drawing helped hide it. Put my name beside the correction as well as the original.'),
        L('Pell', 'We will. We also need a rota that lets the next crew check the first.'),
        L('sable', 'Make two public copies. A secret replacement would only start another argument.'),
        L('brann', 'The coast holds the last receipt. Dema can bring its carriers to the Low Quay gate.')
      ], reward: { gold: 290, xp: 220, gear: 'ironcoat', flag: 'shifts_corrected' } },

    { id: 'm_river_4', arc: 'river', act: 1, catchup: true, title: 'Bread at the River Gate', place: 'lowquay',
      objective: 'Meet Dema at Low Quay. Present the three public accounts and end the collection order.',
      requires: ['m_river_3', 'stage_pass'], objectives: [O('npc', 'Speak to Dema at the docks', 'Dema, dock worker')],
      before: [
        L('Dema', 'The mill, the river, and the mine have each sent a copy. Their numbers finally meet.'),
        L('Mara', 'No crew owes the missing sacks. The missing sacks were never sent.'),
        L('Rin', 'The river plan has witnesses from both banks. The council cannot sell that water twice.'),
        L('mira', 'I will read the account aloud. People should not need a clerk to understand their supper.'),
        L('Gate Warden', 'Collection order remains active. Disputed goods must remain at the gate.'),
        L('brann', 'This is a second Warden with the same bad order. We stop it here. Keep the workers behind the rope.')
      ], battle: B(['gatewarden', 'sentry'], 6, true),
      after: [
        L('Narrator', 'The collection seal breaks. Dema opens the gate while the workers read the account from end to end.'),
        L('Mara', 'The first new sacks will go to the kitchens that fed us through the dispute.'),
        { ...L('Lea', 'The open garden channels are feeding the first green beds. The mills have agreed to shorter shifts while the river is low.'), when: 'river_channels' },
        { ...L('Sill', 'The shared reserve held through its first dry shift. Each district has checked the new return pipe.'), when: 'river_reserve' },
        L('Rin', 'The river controls stay with the districts. The chosen plan can be changed at the next open meeting.'),
        L('oren', 'I brought a plain drawing of the bypass. No one should have to fight another guard to find the pipe.'),
        L('Dema', 'Good. Put it by the bread table. People ask better questions when they have eaten.'),
        L('Narrator', 'A mill crew, a garden crew, and a mine crew share the first meal. The river agreement stays on the table between them.')
      ], reward: { gold: 420, xp: 300, gear: 'guardseal', flag: 'river_arc_complete' } },

    { id: 'm_road_1', arc: 'road', act: 1, catchup: true, title: 'A Place Missing from the Map', place: 'lanternward',
      objective: 'Ask Lio and Nara about the missing ferry route. Recover the route plate from the license guards.',
      requires: ['stage_pass'], objectives: [O('npc', 'Speak to Lio, the lantern maker', 'Lio, lantern maker'), O('npc', 'Speak to Nara, the market cook', 'Nara, market cook')],
      before: [
        L('Nara', 'The Copper Fen ferry used to bring three baskets of reeds each week. The baskets stopped. The fee did not.'),
        L('Lio', 'I asked for the route map. The desk says the ferry has never existed.'),
        L('sable', 'It exists on this old toll plate. Someone scratched the destination off the public copy.'),
        L('mira', 'People still live there. A blank place on a map does not close their doors.'),
        L('iona', 'We need the original plate before we cross the fen.'),
        L('brann', 'The license guards have it. Clear the market aisles. No one gets caught between their spears and a stall.')
      ], battle: B(['sentry', 'ironhound', 'raildrone'], 6),
      after: [
        L('Lio', 'Copper Fen, east landing. It was here under the black paint.'),
        L('sable', 'The office removed routes that could not pay for a new seal. Then it kept charging their old fees.'),
        L('Nara', 'Take food for the ferry crew. They may have been waiting a long time.'),
        L('mira', 'We will also bring back the names they want on the new map.'),
        L('iona', 'A map needs paths, water, and places to rest. It should start with the people using it.'),
        L('Lio', 'Noll keeps the ferry rope. Follow its sound through the reeds.')
      ], reward: { gold: 260, xp: 190, item: 'tonic', count: 4, flag: 'fen_route_found' } },

    { id: 'm_road_2', arc: 'road', act: 1, catchup: true, title: 'Three Whistles in the Reeds', place: 'copperfen',
      objective: 'Speak to Noll. Find all three lost travelers, then clear the ferry landing.',
      requires: ['m_road_1', 'train_free'], objectives: [O('npc', 'Speak to Ferrier Noll', 'Ferrier Noll'), O('rescue', 'Guide the west-bank traveler home', 'copperfen:rescue:0'), O('rescue', 'Guide the south-bank traveler home', 'copperfen:rescue:1'), O('rescue', 'Guide the east-bank traveler home', 'copperfen:rescue:2')],
      before: [
        L('Noll', 'Three whistles. Three people out of the reeds. I kept hearing one and feared the other two were echoes.'),
        L('tern', 'They left a pause between calls. That helped us hear each answer.'),
        L('Ben', 'My map put the path where it used to be. I never crossed the bank to check.'),
        L('rook', 'The travelers found a safe shelf. Mark that as well as the road.'),
        L('Umi', 'The landing is full of mire toads. They followed the warm flood water.'),
        L('iona', 'We will clear a lane. Keep the travelers at the dry shelter until Noll gives the signal.')
      ], battle: B(['miretoad', 'miretoad', 'marshwisp'], 7),
      after: [
        L('Narrator', 'Noll pulls the ferry to the landing. The rescued travelers cross first, with the new map spread across their knees.'),
        L('Ben', 'They have marked two places where a person can sit. I would have missed both.'),
        L('rook', 'A road must have room for someone who moves more slowly.'),
        L('Noll', 'Pilgrim Post is the next shelter. The office has closed its public beds to travelers without seals.'),
        L('sable', 'The same seal again. I think this road leads straight to a comfortable desk.'),
        L('tern', 'We can find the desk after we open the beds. The night comes for everyone.')
      ], reward: { gold: 340, xp: 240, item: 'revive', count: 3, flag: 'fen_crossing_safe' } },

    { id: 'm_road_3', arc: 'road', act: 1, catchup: true, title: 'A Bed without a Seal', place: 'pilgrimpost',
      objective: 'Speak to Venn and Tavi at Pilgrim Post. End the shelter\'s license check and make a clear road sign.',
      requires: ['m_road_2', 'original_leases'], objectives: [O('npc', 'Speak to Venn, the shelter host', 'Venn, shelter host'), O('npc', 'Speak to Tavi, the sign painter', 'Tavi, sign painter')],
      before: [
        L('Venn', 'Six empty beds. Four travelers on the platform. The desk calls this correct occupancy.'),
        L('vale', 'One traveler has a fever. They need warmth, not a travel test.'),
        L('Tavi', 'The old sign lists approved districts. I want a sign that shows water and a roof.'),
        L('sable', 'The original law names no district test for a public shelter. The added rule has no witness.'),
        L('rook', 'Then the guest book can ask where someone wants to go, without deciding whether they may rest.'),
        L('Venn', 'The station guard still checks every door. Help us end its lock before we bring the beds out.')
      ], battle: B(['raildrone', 'clockwork', 'sentry'], 8),
      after: [
        L('Narrator', 'Venn opens the shelter doors. Tavi paints a kettle beneath a broad roof on the road sign.'),
        L('Moss', 'I saw the kettle from the far rail. I did not need to read a district list.'),
        L('vale', 'The fever has eased. Etta has clean water beside the bed.'),
        L('Venn', 'We will keep one room quiet and one table clear for maps. Travelers can tell us what the road needs.'),
        L('mira', 'Hush Theatre still has the widest public receiver. We can send the new route from there.'),
        L('Tavi', 'Take the sign pattern. A useful picture can travel farther than a permit.')
      ], reward: { gold: 390, xp: 290, gear: 'speedpin', flag: 'road_shelter_open' } },

    { id: 'm_road_4', arc: 'road', act: 1, catchup: true, title: 'The Journey May Change', place: 'hushtheatre',
      objective: 'Meet Ada at Hush Theatre. Use the open bells to publish the ferry and shelter routes.',
      requires: ['m_road_3', 'open_lesson'], objectives: [O('npc', 'Speak to Ada, the stage hand', 'Ada, stage hand'), O('bells', 'Prepare the theater broadcast controls', 'hushtheatre:bells')],
      before: [
        L('Ada', 'The receiver can carry the new map. The ticket clerk has queued a correction that will erase it.'),
        L('rook', 'What does the correction say?'),
        L('Ada', 'A route without a fixed end cannot be licensed. Every passenger must declare a final address.'),
        L('mira', 'Sometimes a person learns where they want to go by leaving.'),
        L('sable', 'We have shelter records, ferry records, and witnesses. Let the clerk try to erase them in public.'),
        L('iona', 'The old guard score is rising in the line. Hold the broadcast while we break its loop.')
      ], battle: B(['chorister', 'archivist', 'raildrone'], 9),
      after: [
        L('Narrator', 'A kettle, a wave, and a ferry rope appear on public receivers across the road districts.'),
        L('rook', 'The route lists safe stops. It does not demand a final choice.'),
        L('Ada', 'Travelers are sending corrections already. One bridge has lost a handrail.'),
        L('mira', 'Keep that correction in the map. A perfect picture of a dangerous road would be no help.'),
        L('sable', 'The fee account is closed. Its remaining funds go to the ferry and the shelter, with a public receipt.'),
        L('Narrator', 'At Pilgrim Post, the first new guest places a stone beside the map. It marks a safe place that no clerk had visited.')
      ], reward: { gold: 520, xp: 380, gear: 'focuslens', flag: 'road_arc_complete' } },

    { id: 'm_letters_1', arc: 'letters', act: 2, title: 'The Bag that Came Back', place: 'emberpost',
      objective: 'Speak to Nim and Vera at Ember Post. Sort the recovered road bag and protect the undelivered letters.',
      requires: ['airship', 'q_sable'], objectives: [O('npc', 'Speak to Nim, the post runner', 'Nim, post runner'), O('npc', 'Speak to Vera, the letter keeper', 'Vera, letter keeper')],
      before: [
        L('Nim', 'This bag crossed the sea in a broken cart. It came back with six years of mail inside it.'),
        L('sable', 'Some envelopes have been opened by a claims clerk. The answers were used to update debt records.'),
        L('Vera', 'We closed those envelopes and marked the damage. We did not copy the letters.'),
        L('iona', 'Can the readers still be found?'),
        L('Nim', 'Some. The address press at Inkhaven keeps rejecting every new street.'),
        L('Vera', 'First stop the sorting guards. They have arrived to collect the bag as unclaimed property.')
      ], battle: B(['archivist', 'sentry', 'pageswarm'], 12),
      after: [
        L('Narrator', 'Vera lays the road bag beside the stove. Each envelope receives a route mark and a record of any damage.'),
        L('sable', 'A person can see what happened to the letter without letting us read what it says.'),
        L('Nim', 'The first delivery is for Jori in Inkhaven. The old address says the canal wall.'),
        L('iona', 'Then we ask where Jori lives now. The old map has already cost enough time.'),
        L('Vera', 'Take the sealed bag. Give the reader a chance to refuse it as well as a chance to open it.'),
        L('Narrator', 'Nim ties a fresh blue cord around the bag. The road post takes its first route since the fall.')
      ], reward: { gold: 650, xp: 380, item: 'remedy', count: 5, flag: 'post_bag_saved' } },

    { id: 'm_letters_2', arc: 'letters', act: 2, title: 'An Address Can Move', place: 'inkhaven',
      objective: 'Speak to Pera and open both address relays. Clear the press keeper so residents can correct their own records.',
      requires: ['m_letters_1'], objectives: [O('npc', 'Speak to Pera, the paper maker', 'Pera, paper maker'), O('switch', 'Open the old-address relay', 'inkhaven:relay:0'), O('switch', 'Open the correction relay', 'inkhaven:relay:1')],
      before: [
        L('Jori', 'My sister wrote before the fall. She thought I had chosen not to answer.'),
        L('sable', 'The press sent the letter to the same drowned street twelve times.'),
        L('Pera', 'We entered the new address. The keeper restored the old copy each night.'),
        L('iona', 'The copy remembers a place. It cannot decide where a person must remain.'),
        L('Jori', 'I want my new address printed. I also want the date, so the next keeper knows when it changed.'),
        L('Pera', 'Both relays are open. The Ink Keepers still guard the correction plate. Clear them and I can turn it.')
      ], battle: B(['archivist', 'mirrorling', 'pageswarm'], 14),
      after: [
        L('Narrator', 'Pera runs a blank sheet through the press. A new address appears with a date and room for another correction.'),
        L('Jori', 'I am going to answer my sister. I will begin with where I am, not with an apology for moving.'),
        L('sable', 'The press also holds family records gathered from private mail. Those copies need their readers\' decisions.'),
        L('Pera', 'A Tideward family has asked us to bring one back. Their mother\'s last letter is in it.'),
        L('iona', 'We will carry it sealed. A private memory should not become the price of receiving a letter.'),
        L('Narrator', 'Jori hangs the corrected address beside the door. Below it, Pera fixes a basket marked RETURNS.')
      ], reward: { gold: 780, xp: 440, item: 'ether', count: 5, flag: 'addresses_open' } },

    { id: 'm_letters_3', arc: 'letters', act: 2, title: 'What a Family Keeps', place: 'tideward',
      objective: 'Meet Lark in Tideward. Return the sealed family letter and choose how the copied record will be kept.',
      requires: ['m_letters_2', 'q_brann'], objectives: [O('npc', 'Speak to Dema\'s brother Lark', "Dema's brother Lark")],
      before: [
        L('Lark', 'The letter is for my mother. She asked me to receive it, but she has not asked to hear it yet.'),
        L('brann', 'Then it waits with her. The road bag has finished its work.'),
        L('sable', 'The press kept a second copy and a list of everyone it names.'),
        L('Lark', 'The family agrees that the names must come out of the public index. We have two ways to keep the page.'),
        L('iona', 'You choose what leaves the record. We can help with the work that follows.'),
        L('Lark', 'Keep the copied page sealed here for a later reader, or turn it into blank paper. We accept either path.')
      ],
      decision: { speaker: 'Lark', prompt: 'The family has approved both choices. How will you help them handle the copied page?', options: [
        { label: 'Keep a sealed family copy', flag: 'letters_sealed', reward: { gear: 'guardseal' }, lines: [L('Lark', 'We will keep it in our own chest. Only a family request can open it.'), L('sable', 'The public index will show that the record was withdrawn. It will not keep the names.'), L('Lark', 'Take this Guard Seal. It should protect a traveler, not lock away a letter.')] },
        { label: 'Return the copy to blank paper', flag: 'letters_released', reward: { gear: 'heartsong' }, lines: [L('Lark', 'The original letter stays with my mother. The unwanted copy can become something new.'), L('iona', 'We will wash the ink in front of you, then leave the blank sheet here.'), L('Lark', 'Take this Heart Song. We kept it for a journey that can now end.')] }
      ] },
      after: [
        L('Narrator', 'The family carries out its chosen plan. Lark writes one public line: RECEIVED. NO ANSWER REQUIRED.'),
        L('brann', 'That is enough for the delivery record.'),
        L('Lark', 'My mother has put the letter beside the window. Today she wants to hear the gulls.'),
        L('sable', 'The press has no right to fill that quiet with a copy.'),
        L('iona', 'The Civic Vault keeps the old mail rule. We need a return right there too.'),
        L('Narrator', 'At dusk, Lark takes a clean sheet to the kitchen table. What he writes next will travel only if he sends it.')
      ], reward: { gold: 620, xp: 390, flag: 'family_mail_returned' } },

    { id: 'm_letters_4', arc: 'letters', act: 2, title: 'The Return Basket', place: 'civicvault',
      objective: 'Speak to Sen and open the vault relays. Remove the last claims guard from the public post rule.',
      requires: ['m_letters_3'], objectives: [O('npc', 'Speak to Old clerk Sen', 'Old clerk Sen'), O('switch', 'Open the receipt seal', 'civicvault:relay:0'), O('switch', 'Open the return seal', 'civicvault:relay:1')],
      before: [
        L('Old clerk Sen', 'The old mail rule gave a clerk access to any unanswered letter. It called silence an abandoned claim.'),
        L('sable', 'A person can be away, ill, afraid, or simply unwilling. None gives the clerk their words.'),
        L('iona', 'The family in Tideward received its page and made its own choice. The new rule must leave that choice with each reader.'),
        L('Vera', 'We have brought a plain version: deliver, protect, return. No hidden index of private names.'),
        L('Old clerk Sen', 'The archive guard treats the removed index as a loss of evidence.'),
        L('sable', 'Then it can keep evidence of our correction. The private pages go back to their people.')
      ], battle: B(['archive'], 16, true),
      after: [
        L('Narrator', 'The new post rule prints on a single sheet. Sen checks it against Vera\'s copy before either leaves the press.'),
        { ...L('Vera', 'The Tideward family keeps its sealed copy under its own key. The post keeps only the record that it was returned.'), when: 'letters_sealed' },
        { ...L('Vera', 'The Tideward family has washed the unwanted copy into blank paper. The post has recorded the release without preserving its words.'), when: 'letters_released' },
        L('Vera', 'Every post will have a return basket and a place for unopened mail. There is no charge for either.'),
        L('Nim', 'Inkhaven has sent the first corrected route. I can reach three kitchens before supper.'),
        L('sable', 'Go. We will keep the old rule here, marked with what it did and why it ended.'),
        L('iona', 'A record can help people find one another. It must also let them close a door.'),
        L('Narrator', 'At Ember Post, a blue bag leaves by the new road. An unopened letter returns beside it, with the reader\'s choice intact.')
      ], reward: { gold: 1100, xp: 650, gear: 'nullcharm', flag: 'letters_arc_complete' } },

    { id: 'm_sky_1', arc: 'sky', act: 2, title: 'The Wrong Storm', place: 'rainspindle',
      objective: 'Speak to Hale, compare live weather readings, and clear the old storm pattern from Rain Spindle.',
      requires: ['airship', 'q_tern'], objectives: [O('npc', 'Speak to Hale, the weather keeper', 'Hale, weather keeper'), O('bells', 'Compare the weather instruments', 'rainspindle:bells')],
      before: [
        L('Hale', 'The tower predicts a storm from the east. The rain cups say west. The cups are outside. The tower is reading an old report.'),
        L('tern', 'The echo has the same pause as the storm that broke Bell Peak. It is a memory.'),
        L('Neri', 'I sent a correction. The tower called my measuring cup unlicensed.'),
        L('iona', 'A cup does not need a license to fill with rain. Show us the readings.'),
        L('Hale', 'The bells have opened the return path. A storm pattern still blocks the live line.'),
        L('tern', 'Then we give the old weather a place to end. Keep the flag line ready for the people below.')
      ], battle: B(['thunderhead', 'stormkite', 'frostbat'], 14),
      after: [
        L('Narrator', 'The repeated storm falls silent. Hale sends a short report with the time of each reading.'),
        L('Neri', 'I left the leaking cup in the notes. Someone downstream may need to know why that number is small.'),
        L('iona', 'Keep the uncertainty in the report. A neat answer is no help if it points a boat into danger.'),
        L('tern', 'Bell Peak receives the northern line. Its keepers can compare the wind before we follow it.'),
        L('Hale', 'Watch for the Cloud Harrow mark. That machine once chose where the rain was allowed to fall.'),
        L('Narrator', 'Blue flags rise above the western path. The message reaches a traveler who cannot hear the bells.')
      ], reward: { gold: 800, xp: 460, item: 'ether', count: 5, flag: 'live_weather_open' } },

    { id: 'm_sky_2', arc: 'sky', act: 2, title: 'A Warning Has Two Ways', place: 'bellpeak',
      objective: 'Meet Keeper Sol at Bell Peak. Confirm the bell route and protect the new flags on the exposed pass.',
      requires: ['m_sky_1'], objectives: [O('npc', 'Speak to Keeper Sol', 'Keeper Sol'), O('bells', 'Confirm the mountain response', 'bellpeak:bells')],
      before: [
        L('Keeper Sol', 'The west report arrived. Three boats changed course in time. A fourth crew never heard it.'),
        L('tern', 'The bells face the valley. A boat below the cliff may hear nothing in a strong wind.'),
        L('Keeper Sol', 'We taught the same call for fifty years. I thought a clear lesson would reach everyone.'),
        L('iona', 'Then keep the call and add another way. The flags at Rain Spindle reached people the bells missed.'),
        L('Anjo', 'I brought cloth and bright paint. The pass is full of storm kites where the new poles must stand.'),
        L('tern', 'We clear the pass. Sol, let the boat crews choose which signs they can read from the water.')
      ], battle: B(['stormkite', 'stormkite', 'thunderhead'], 15),
      after: [
        L('Narrator', 'Anjo raises a blue flag where the cliff breaks. A boat below answers with a white cloth.'),
        L('Keeper Sol', 'I can see the answer. I had forgotten to ask for one.'),
        L('tern', 'A warning is work between people. It is not complete when the tower has made a sound.'),
        L('Anjo', 'The north wind keeps turning toward Cloud Harrow. Even the clouds bend against the sea.'),
        L('iona', 'We need its weather order. There may be a reason the coast keeps getting yesterday\'s rain.'),
        L('Keeper Sol', 'Take the new flag pattern. A small piece of cloth should never need a keeper\'s permission to save a boat.')
      ], reward: { gold: 860, xp: 510, gear: 'speedpin', flag: 'weather_flags_shared' } },

    { id: 'm_sky_3', arc: 'sky', act: 2, title: 'The Private Rain', place: 'cloudharrow',
      objective: 'Speak to Yen and open both relief relays. Stop the harrow from taking the coast\'s rain.',
      requires: ['m_sky_2', 'q_oren'], objectives: [O('npc', 'Speak to Yen, the vane mechanic', 'Yen, vane mechanic'), O('switch', 'Open the west cloud relief', 'cloudharrow:relay:0'), O('switch', 'Open the east cloud relief', 'cloudharrow:relay:1')],
      before: [
        L('Yen', 'The harrow serves the old estate gardens. The gardens are gone. Their weather lease still holds the clouds.'),
        L('oren', 'The return vane is disconnected. Every order asks for more rain because no gauge can say enough.'),
        L('Gale', 'My little pots catch a cup each. Water spills from the empty terraces below us for hours.'),
        L('tern', 'And the dry coast calls that weather. Someone has put a wall across the wind.'),
        L('iona', 'Both relief paths are open. We can release the clouds without tearing the platform apart.'),
        L('Yen', 'The guard pattern has gathered into a Stormbird. Clear it while I hold the relief wheel.')
      ], battle: B(['stormbird', 'thunderhead'], 17, true),
      after: [
        L('Narrator', 'The lock opens. A long bank of clouds passes over the empty terraces and turns toward the coast.'),
        L('oren', 'The harrow can still measure wind. It will not pull the weather to satisfy a dead account.'),
        L('Unit Sift', 'New task: count wind turns. Include turns that do not match the forecast.'),
        L('tern', 'That sounds like useful work.'),
        L('Yen', 'The lease was issued at High Choir. Take its control plate. The public record should show where the dry years went.'),
        L('iona', 'We will also take your safe plan. The coast needs a weather service it can check.')
      ], reward: { gold: 1250, xp: 760, gear: 'starweave', flag: 'rain_released' } },

    { id: 'm_sky_4', arc: 'sky', act: 2, title: 'The Weather Table', place: 'highchoir',
      objective: 'Meet Yula in High Choir. Present the private rain order and open a shared weather service.',
      requires: ['m_sky_3', 'q_mira'], objectives: [O('npc', 'Speak to Yula, the council cook', 'Yula, council cook')],
      before: [
        L('Yula', 'The hall has tables again. I put the weather keepers beside the fishers. They needed to talk before the speakers arrived.'),
        L('mira', 'Here is the control plate. The gardens drew rain from districts that never had a seat in this room.'),
        L('Hale', 'Our new reports carry a time, a place, and the limits of the reading. No single tower decides the whole coast.'),
        L('oren', 'Every keeper can inspect the gauges and stop a faulty line. The plans are on the table.'),
        L('iona', 'The old service guard still claims the private lease. It is trying to restart the harrow from this receiver.'),
        L('tern', 'Then this is the last link. Clear the room behind us. The sky has waited long enough.')
      ], battle: B(['choirguard', 'nullsinger', 'stormkite'], 18),
      after: [
        L('Narrator', 'The private weather lease is struck from the live controls and kept in the public history record.'),
        L('Hale', 'Rain Spindle will send measurements. Bell Peak will repeat them by bell and flag. Boats can answer both.'),
        L('mira', 'And if a keeper makes a mistake?'),
        L('Yula', 'The next keeper can say so before a boat has to prove it.'),
        L('iona', 'We cannot promise clear skies. We can make the warnings reach the people who need them.'),
        L('Narrator', 'Rain taps the hall roof. Below, a dry garden receives its first open shower. No meter adds it to a debt.')
      ], reward: { gold: 1450, xp: 850, gear: 'nullcharm', flag: 'sky_arc_complete' } },

    { id: 'm_table_1', arc: 'table', act: 2, title: 'One Furnace at a Time', place: 'morrowkiln',
      objective: 'Speak to Sera. Rescue all three workers and open the recovery crate before the kiln is restarted.',
      requires: ['airship', 'q_oren', 'q_rook'], objectives: [O('npc', 'Speak to Sera, the kiln forewoman', 'Sera, kiln forewoman'), O('rescue', 'Free the west cooling worker', 'morrowkiln:rescue:0'), O('rescue', 'Free the south cooling worker', 'morrowkiln:rescue:1'), O('rescue', 'Free the east cooling worker', 'morrowkiln:rescue:2'), O('chest', 'Open the recovery crate', 'morrowkiln:chest:0')],
      before: [
        L('Sera', 'All three workers are out. We tried to light every furnace at once. The cooling line split before the first tile dried.'),
        L('oren', 'The pipe could carry one furnace safely. The old drawing assumed the second crew would close its valve.'),
        L('rook', 'The second crew was trapped beside that valve. The plan required a person to remain in danger.'),
        L('Sera', 'We need roofs before the wet season. I thought we had no time for a smaller start.'),
        L('iona', 'The people who make the roofs must live to use them. Start with what they can keep safe.'),
        L('oren', 'The old kiln guard keeps feeding the fire. We stop it before we put a hand in the cooling frame.')
      ], battle: B(['clockwork', 'cinderknight', 'ashbeetle'], 15),
      after: [
        L('Narrator', 'The first furnace settles to a low red glow. Sera writes a new shift plan on the clean wall.'),
        L('Sera', 'One furnace. Two trained keepers. A clear path from every valve to the yard.'),
        L('oren', 'I will draw the cooling line with the crew who has to repair it.'),
        L('rook', 'Unwritten Hall has machines looking for useful work. Looking is not the same as volunteering. We will ask.'),
        L('Toll', 'Ask what they want to make as well. We need more than roof tiles.'),
        L('Narrator', 'The first sound from Morrow Kiln is a worker calling the meal break. This time, the furnace is allowed to wait.')
      ], reward: { gold: 900, xp: 560, item: 'tonic', count: 6, flag: 'kiln_crew_safe' } },

    { id: 'm_table_2', arc: 'table', act: 2, title: 'The Work We Choose', place: 'unwrittenhall',
      objective: 'Speak to Purl at Unwritten Hall. Choose the first shared workshop with the workers who will run it.',
      requires: ['m_table_1'], objectives: [O('npc', 'Speak to Unit Purl', 'Unit Purl')],
      before: [
        L('Unit Purl', 'Three of us want to work with the kiln crew. Two want to keep making coats here. Both groups need tools.'),
        L('rook', 'The kiln request can wait for your answer. No registry will assign you.'),
        L('Sera', 'We can build one extra bench before the rains. After that, the crews will decide what comes next.'),
        L('oren', 'A repair bench would keep carts and pumps moving. A shared kitchen bench would make bowls, jars, and safe stove parts.'),
        L('Unit Purl', 'We have hands for either. We have agreed to ask the traveling company which need it sees most often.'),
        L('iona', 'Then we make this first choice with you. It will not decide anyone\'s work forever.')
      ],
      decision: { speaker: 'Unit Purl', prompt: 'The workers support either first bench. What should the shared workshop make first?', options: [
        { label: 'Repair carts and water pumps', flag: 'table_repairs', reward: { gear: 'geardriver' }, lines: [L('oren', 'We will make common fittings and publish their sizes. A broken cart should not need a factory key.'), L('Unit Purl', 'I choose to learn wheel repair. I can keep sewing coats in the evening.'), L('Sera', 'Take this Gear Driver. We have made a second one for the bench.')] },
        { label: 'Build kitchens and food stores', flag: 'table_kitchens', reward: { gear: 'heartbell' }, lines: [L('Sera', 'Then jars, bowls, and stove doors come first. The kitchens will tell us which sizes they can use.'), L('Unit Purl', 'I choose to make handles that tired hands can hold.'), L('Sera', 'Take this Heart Bell. It called the old meal break. It can carry a kinder call with you.')] }
      ] },
      after: [
        L('Narrator', 'The workers put their chosen first plan on the table. Beside it, they leave a blank sheet for the next meeting.'),
        L('rook', 'Each task has a place to stop. Each worker can choose a different task at the next shift.'),
        L('Unit Purl', 'I will need a coat with wider pockets. This appears to be a problem I can solve.'),
        L('oren', 'The Drowned Works can make the drive parts. Edda\'s tide wheel is small, but its load can be shared.'),
        L('Sera', 'Take her the actual demand. We must not promise the workshop more power than the tide can give.'),
        L('Narrator', 'Purl adds a small square marked REST to the workshop plan. No one asks for it to be removed.')
      ], reward: { gold: 720, xp: 460, flag: 'workshop_chosen' } },

    { id: 'm_table_3', arc: 'table', act: 2, title: 'Enough Power for a Day', place: 'drownedworks',
      objective: 'Meet Edda and check both flood relays. Clear the old drive so the new workshop can use a safe share of tidal power.',
      requires: ['m_table_2'], objectives: [O('npc', 'Speak to Forewoman Edda', 'Forewoman Edda'), O('switch', 'Check the west flood relay', 'drownedworks:relay:0'), O('switch', 'Check the east flood relay', 'drownedworks:relay:1')],
      before: [
        L('Forewoman Edda', 'The wheel can drive the new bench for half a day. The clinic pump and the kitchen keep the first share.'),
        L('Sera', 'Half a day will do if we stop promising full-day quotas.'),
        L('oren', 'The old transfer box still adds every request together as if the tide had no limit.'),
        L('rook', 'Then the request needs a reply that can say: later.'),
        L('Forewoman Edda', 'Both flood gates are safe. The old drive guard will not release the shared shaft.'),
        L('iona', 'We stop the guard. You choose the load, and every crew gets a way to see it.')
      ], battle: B(['ironheart'], 17, true),
      after: [
        L('Narrator', 'Oren and Edda fit a plain load plate beside the drive. Its pointer can be read from the walkway.'),
        L('Forewoman Edda', 'Green means the next crew can begin. Blue means the water stores are filling. Red means stop and check.'),
        L('rook', 'The plate shows the whole limit. No worker has to guess what the other room is taking.'),
        L('Sera', 'We can finish the first order before the rains. It will be smaller than the old promise, and it will exist.'),
        L('oren', 'Take the finished work to Lantern Ward. Let the kitchens and repair crews check it before the next firing.'),
        L('Narrator', 'At low tide, the bench stops. The workers go home with unfinished pieces waiting safely for another day.')
      ], reward: { gold: 1150, xp: 720, gear: 'mirrorplate', flag: 'shared_tide_ready' } },

    { id: 'm_table_4', arc: 'table', act: 2, title: 'The First Open Order', place: 'lanternward',
      objective: 'Speak to Nara and Lio. Protect the first delivery and give the district control of its new workshop orders.',
      requires: ['m_table_3'], objectives: [O('npc', 'Ask Nara to check the first delivery', 'Nara, market cook'), O('npc', 'Ask Lio to check the first delivery', 'Lio, lantern maker')],
      before: [
        L('Nara', 'The new goods are here. The handles fit our hands, and the makers left a way to report what breaks.'),
        { ...L('Lio', 'The repair bench sent cart fittings and pump handles. We have fitted one set and kept another for a public test.'), when: 'table_repairs' },
        { ...L('Nara', 'The kitchen bench sent bowls, jars, and stove doors. We have cooked one full meal before accepting the batch.'), when: 'table_kitchens' },
        L('Lio', 'The old supply registry has claimed the delivery. It says a public order belongs to the highest rank present.'),
        L('rook', 'There is no highest rank in this order. The kitchens and the work crews chose it together.'),
        L('Sera', 'The price covers materials and working time. It does not include a permanent claim on the maker.'),
        L('oren', 'We will keep one test piece here. If it fails, stop the batch and send the details back.'),
        L('iona', 'The registry guards are at the stall gate. Hold the crowd behind the tables while we clear them.')
      ], battle: B(['choirguard', 'clockwork', 'raildrone'], 18),
      after: [
        L('Narrator', 'The district signs for the goods it asked for. A return slip stays attached to each first piece.'),
        L('Nara', 'This bowl has a rough edge. I can use it today, but I will mark the next order.'),
        L('Sera', 'Please do. An honest fault is cheaper than a whole shelf of perfect-looking failures.'),
        L('rook', 'Purl has asked to spend the next shift at the kiln. The new coat pockets are ready.'),
        L('Lio', 'Then we have a workshop, a road back to its makers, and a meal for the people who carried the first order.'),
        L('Narrator', 'Lantern Ward sets a long table beneath the new tiles. The first toast is to the next thing they will learn how to mend.')
      ], reward: { gold: 1350, xp: 820, gear: 'heartsong', flag: 'table_arc_complete' } },

    { id: 'm_morning_1', arc: 'morning', act: 2, postgame: true, title: 'A Map beyond the Last Page', place: 'witnessarchive',
      objective: 'Visit the Living Archive after the final song. Recover the unfinished Dawn Sound survey from its old guard record.',
      requires: ['victory'], objectives: [O('npc', 'Speak to the Living Archive', 'The Living Archive')],
      before: [
        L('The Living Archive', 'The final custody order has ended. There is another page that no one has asked me to read.'),
        L('iona', 'What does it hold?'),
        L('The Living Archive', 'A harbor survey. The council refused it because the shore had no licensed choir line.'),
        L('Nim', 'Dawn Sound. Boats still use its outer rocks. There is a dry foundation above the beach.'),
        L('iona', 'The people below have chosen how to live with the old network. A new shore can begin with that choice already theirs.'),
        L('The Living Archive', 'A leftover claims guard seals the survey. It has no living keeper. End its order, and take the page.')
      ], battle: B(['mirrorling', 'nullsinger', 'remnant'], 22),
      after: [
        L('Narrator', 'The survey unfolds across the reading table. A small harbor appears beyond the edges of the old route chart.'),
        L('Nim', 'Someone drew homes here. Someone else stamped them unnecessary.'),
        L('iona', 'A drawing is not a promise that the ground is safe. We visit before we invite anyone to build.'),
        L('The Living Archive', 'Please add what you find. Leave the old refusal visible, with the date it ceased to decide the matter.'),
        L('Nim', 'Ari keeps the landing bells. I can bring the survey and a dry measuring rope.'),
        L('Narrator', 'The Wren receives a route beyond the last battle. No copied morning tells its passengers what they will find there.')
      ], reward: { gold: 1500, xp: 1000, item: 'revive', count: 6, flag: 'dawn_survey_found' } },

    { id: 'm_morning_2', arc: 'morning', act: 2, postgame: true, title: 'Above the Winter Water', place: 'dawnsound',
      objective: 'Speak to Ari and Melu. Use the landing bells, then clear the high-water route and check the survey.',
      requires: ['m_morning_1'], objectives: [O('npc', 'Speak to Ari, the shore keeper', 'Ari, shore keeper'), O('npc', 'Speak to Melu, the survey reader', 'Melu, survey reader'), O('bells', 'Set the safe landing signal', 'dawnsound:bells')],
      before: [
        L('Ari', 'The bells are clear. Bring the boat inside the white marker. The old harbor plan puts its quay on a winter reef.'),
        L('Melu', 'The survey was made in the calm season. Its highest water mark is lower than the salt on that wall.'),
        L('iona', 'Then we keep the measurement from the wall. A neat drawing cannot dry a flooded room.'),
        L('Fenn', 'The ridge can carry the hall. A raised path would still leave the beach open to boats.'),
        L('Nim', 'An old guard pattern has gathered in the flooded foundations. It keeps drawing things toward the unsafe quay.'),
        L('iona', 'We clear the pattern and mark the real water line. No family arrives until the route is ready.')
      ], battle: B(['undertow', 'drowned'], 23, true),
      after: [
        L('Narrator', 'Fenn sets a red stone above the winter line. Melu adds the higher mark to every copy of the survey.'),
        L('Ari', 'The first hall will stand on the ridge. Boats can land below it without passing under a house.'),
        L('Nim', 'Morrow Kiln has tile molds. We can ask for an open order and carry the plan with it.'),
        L('iona', 'Ask what they can make safely. Dawn Sound can begin small.'),
        L('Melu', 'The old survey called this coast empty. It left out the people who knew where the tide reached.'),
        L('Narrator', 'Ari writes the shore keepers\' names on the new plan, with their agreement. Beside them, a blank line waits for the next correction.')
      ], reward: { gold: 1750, xp: 1150, gear: 'starweave', flag: 'dawn_shore_safe' } },

    { id: 'm_morning_3', arc: 'morning', act: 2, postgame: true, title: 'A Roof Worth Carrying', place: 'morrowkiln',
      objective: 'Meet Sera and Toll. Keep the kiln crew safe, then stop the old priority drive from forcing an unsafe order.',
      requires: ['m_morning_2'], objectives: [O('npc', 'Speak to Sera, the kiln forewoman', 'Sera, kiln forewoman'), O('npc', 'Speak to Toll, the glaze mixer', 'Toll, glaze mixer'), O('rescue', 'Keep the west cooling route clear', 'morrowkiln:rescue:0'), O('rescue', 'Keep the south cooling route clear', 'morrowkiln:rescue:1'), O('rescue', 'Keep the east cooling route clear', 'morrowkiln:rescue:2')],
      before: [
        L('Sera', 'The shore plan is sound. We can make its roof in three batches if the crew has time to cool the molds.'),
        L('Toll', 'I would like the hall to have a blue edge. It will be easy to see from a boat.'),
        L('Nim', 'The freight frame woke when I entered the old harbor code. It has marked the whole order as immediate.'),
        L('iona', 'No place needs a roof badly enough to take the people making it.'),
        L('Sera', 'The crew is safe. The priority drive has locked itself to the cooling wheel. We cannot stop one without the other.'),
        L('Toll', 'Break its guard, and I can pull the separate release. I marked the handle in blue, where a tired worker can see it.')
      ], battle: B(['ironheart', 'clockwork'], 24, true),
      after: [
        L('Narrator', 'Toll pulls the release. The cooling wheel turns on its own while the freight frame settles to the floor.'),
        L('Sera', 'Three batches. The first leaves today. The next leaves when its tiles are ready.'),
        L('Nim', 'The Wren can make three journeys. A safe roof is worth carrying more than once.'),
        L('Toll', 'The blue glaze came through clean. I have left two spare tiles for the first repair.'),
        L('iona', 'Dawn Sound will keep the maker\'s notes beside the key. Anyone who uses the hall can learn how it stands.'),
        L('Narrator', 'The first roof travels over the open sea in small, well-packed stacks. The workers watch it leave, then take their meal break.')
      ], reward: { gold: 1900, xp: 1300, gear: 'starblade', flag: 'dawn_roof_ready' } },

    { id: 'm_morning_4', arc: 'morning', act: 2, postgame: true, title: 'The Door We Leave Open', place: 'dawnsound',
      objective: 'Return to Ari at Dawn Sound. Choose the hall\'s first public use and end the last claim on its harbor.',
      requires: ['m_morning_3'], objectives: [O('npc', 'Speak to Ari at the new landing', 'Ari, shore keeper')],
      before: [
        L('Ari', 'The roof is on. The winter path is marked. We have a hall and enough people to care for it.'),
        L('Melu', 'The neighbors have approved two first uses. A school with a guest room, or a travelers\' shelter with a teaching table.'),
        L('Nim', 'Both have a kitchen. Fenn checked that before the vote.'),
        L('Fenn', 'A room that cannot make tea is still waiting for its final wall.'),
        L('iona', 'Then choose what the shore needs first. Keep space in the plan for a different need later.'),
        L('Ari', 'One old harbor guard has come for a license payment. We will set the hall\'s purpose, then remove its last false claim.')
      ],
      decision: { speaker: 'Ari', prompt: 'Dawn Sound has approved both plans. What should the new hall open as first?', options: [
        { label: 'A school with a guest room', flag: 'morning_school', reward: { gear: 'focuslens', item: 'ether', count: 8 }, lines: [L('Melu', 'We will teach maps, reading, and tide measures. The guest room stays open to travelers.'), L('Ari', 'The first lesson can be this roof. Everyone who made it has something to teach.'), L('Nim', 'I will bring books on the next route. Take the spare Focus Lens and Ethers for the road.')] },
        { label: 'A shelter with a teaching table', flag: 'morning_shelter', reward: { gear: 'heartsong', item: 'revive', count: 6 }, lines: [L('Fenn', 'Then beds and dry coats come first. The map table will hold lessons when a traveler wishes to teach.'), L('Ari', 'No guest needs to pay with a story. Rest is enough reason to open the door.'), L('Nim', 'I will add the shelter to every route. Take the spare Heart Song and recovery stores.')] }
      ] }, battle: B(['conductor', 'choirguard'], 25, true),
      after: [
        L('Narrator', 'The last harbor claim falls silent. Ari places its broken seal beside the hall\'s open record, with a note of how it ended.'),
        L('Ari', 'The chosen plan is on the door. The key stays with the shore keepers, and the meeting date is below it.'),
        { ...L('Melu', 'The first school class has chosen to measure the rain. A traveler has taken the guest room and offered to mend its window latch.'), when: 'morning_school' },
        { ...L('Fenn', 'The first shelter guest has put wet boots by the stove. At the teaching table, two children are learning to read the tide marks.'), when: 'morning_shelter' },
        L('Melu', 'Our map has a place that the first map left out. Tomorrow it may need another.'),
        L('iona', 'Then leave room on the page. We know how to carry a new road now.'),
        L('Nim', 'The kettle is ready. The Wren can wait until morning.'),
        L('Narrator', 'Light reaches the sea through Dawn Sound\'s open doors. Beyond the last battle, the company sits down to a meal in a place it helped make real.'),
        L('Narrator', 'THE ROADS BETWEEN — COMPLETE. Dawn Sound remains on the world map. The next journey is yours to choose.')
      ], reward: { gold: 2600, xp: 1700, item: 'tonic', count: 12, flag: 'morning_arc_complete' } }
  ];

  for (const arc of D.arcs) arc.missions = D.missions.filter(m => m.arc === arc.id).map(m => m.id);
  D.lore.push(
    { title: 'The River Agreement', text: 'Salt Mill and Reed Lock once used the same false account. A public measure, a safe return pipe, and a plan chosen by the river crews can end that account. The agreement is useful because the people beside the water can inspect it and change it.' },
    { title: 'The Road Signs', text: 'The new road uses a kettle for shelter, a wave for water, and a rope for a ferry. Travelers can report a broken path without a clerk\'s seal. A map records what people found. It cannot make a washed-out road safe by showing an old line.' },
    { title: 'The Road Post', text: 'Ember Post dries and protects recovered letters. Inkhaven accepts changes of address. A reader may receive, refuse, or leave a letter unopened. The delivery record does not own the words inside the envelope.' },
    { title: 'An Honest Forecast', text: 'The shared weather service sends a place, a time, and the limits of each reading. Bells and flags carry the same warning by different paths. A reply from the road matters as much as the report from the tower.' },
    { title: 'The Shared Bench', text: 'Morrow Kiln and Unwritten Hall choose their work in open meetings. The tide wheel has a visible limit, and the first users can report faults. A safe workshop needs a working stop control, a way home, and enough time to correct its mistakes.' },
    { title: 'Dawn Sound', text: 'The old council refused the far harbor because it had no licensed choir line. Its later builders check the winter tide, carry the roof in safe batches, and choose the hall\'s first use together. The place can change because its people keep the key and the right to ask.' }
  );
})();
