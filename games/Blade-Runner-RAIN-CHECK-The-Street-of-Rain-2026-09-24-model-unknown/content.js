/**
 * RAIN CHECK — content and rules.
 *
 * Everything the night is made of, with no DOM and no three.js: the twelve
 * cases and their tasks, the opening district (shops, fifty residents, the
 * local stories, city notes, goods), the living-city details, the save
 * validators, the puzzle rules, room generation (boxes, colliders, residents,
 * routes) and the vector portraits. main.js draws and plays it.
 */
var DISTRICT_NAME = "The Street of Rain",
  SHOPS = [
    {
      id: "canopy",
      room: 3,
      name: "Canopy / umbrella repairs",
      short: "CANOPY",
      style: "workshop",
      theme: "parts",
      sound: "workshop",
      floor: "wood",
      color: "#e6ac70",
      door: [-23, 5],
      tag: "REPAIR, NOT REPLACE",
      description: "Repaired canopies, unclaimed belongings, and a warm bench above the water.",
      senses: "Hot glue. Wet canvas. Rain on twelve different roofs.",
      arrival: "Iri hangs each umbrella at its owner\u2019s height. One hook has been lowered twice this year.",
      detail: ["The repair ledger", "A wall of handles", "The loan rack"],
      lore: [
        "The right to repair",
        "A manufacturer can license a hinge. It cannot stop Iri from making another one. The stall keeps its tools under an old kettle when inspectors pass.",
      ],
      goods: ["broth"],
    },
    {
      id: "recall",
      room: 4,
      name: "Secondhand Sun / recall exchange",
      short: "SECONDHAND SUN",
      style: "interview",
      theme: "registry",
      sound: "tape",
      floor: "carpet",
      color: "#c495c5",
      door: [-23, -7],
      tag: "YOUR PAST HAS VALUE",
      description: "A licensed memory counter with an unlicensed room for difficult questions.",
      senses: "Warm tape. Orange peel. A voice trying to remember summer.",
      arrival: "A sign offers sunlight by the minute. Below it, Nola has handwritten: You keep the original.",
      detail: ["The consent switch", "A price list for rain", "A customer\u2019s blank receipt"],
      lore: [
        "Ownership is not recollection",
        "The exchange sells a recording license, not a mind. Buyers can feel a copy. Sellers still remember the day. Debt contracts sometimes conceal exclusive rights to the recording.",
      ],
      goods: ["coolant"],
    },
    {
      id: "clinic",
      room: 5,
      name: "Night Window / street clinic",
      short: "NIGHT WINDOW",
      style: "interview",
      theme: "coolant",
      sound: "clinical",
      floor: "tile",
      color: "#85c5be",
      door: [-23, -19],
      tag: "CARE BEFORE PAYMENT",
      description: "A street clinic for tired bodies, replacement parts, and people without a current address.",
      senses: "Antiseptic. Tea. A fan that clicks on every third turn.",
      arrival: "Sena has turned the payment screen toward the wall. The waiting-room clock is correct, but nobody believes it.",
      detail: ["The hand-washing tap", "A patched patient curtain", "A tray of returned name tags"],
      lore: [
        "The body service contract",
        "Replacement organs have serial numbers. Their maintenance plans can expire while the owner is still using them. This clinic repairs parts without asking who owns the patent.",
      ],
      goods: ["patch", "coolant"],
    },
    {
      id: "birdhouse",
      room: 6,
      name: "Tin Sparrow / companion workshop",
      short: "TIN SPARROW",
      style: "workshop",
      theme: "toys",
      sound: "toys",
      floor: "wood",
      color: "#edbd83",
      door: [-8, -22],
      tag: "SMALL THINGS, LONG LIVES",
      description: "Companion animals, spare gears, and repair notes written like family histories.",
      senses: "Machine oil. Cedar shavings. Three birds singing out of time.",
      arrival: "A row of birds turns toward the door. One is missing a wing. Its owner has brought a paper replacement.",
      detail: ["A bird with a paper wing", "The adoption shelf", "An oil-stained birthday card"],
      lore: [
        "Animals on credit",
        "Living animals need scarce feed, permits, and clean air. Mechanical companions do not replace them. They fill the quiet spaces that the city left behind.",
      ],
      goods: ["bird"],
    },
    {
      id: "arcade",
      room: 7,
      name: "Nine Volt / market arcade",
      short: "NINE VOLT",
      style: "warehouse",
      theme: "market",
      sound: "market",
      floor: "concrete",
      color: "#da947e",
      door: [5, -22],
      tag: "NOT NEW. STILL GOOD.",
      description: "Food, coils, shoes, and disputed stock travel between narrow stalls.",
      senses: "Frying starch. Warm wiring. A hundred overlapping prices.",
      arrival: "A vendor removes the word NEW from a sign. Underneath, an older sign says TESTED.",
      detail: ["The market\u2019s common scale", "A cup of bent screws", "The stall rent board"],
      lore: [
        "The rent beneath the rent",
        "Stallholders pay for floor space, power, drainage, and permission to display a sign. Nine Volt shares one power license. Every stall keeps a candle anyway.",
      ],
      goods: ["coolant", "map"],
    },
    {
      id: "travel",
      room: 8,
      name: "Blue Horizon / passage bureau",
      short: "BLUE HORIZON",
      style: "waiting",
      theme: "registry",
      sound: "office",
      floor: "carpet",
      color: "#94b9d9",
      door: [20, -22],
      tag: "A FRESH START. TERMS APPLY.",
      description: "Colony posters, departure forms, and an offer that may cost more than a lifetime.",
      senses: "Carpet cleaner. Fresh paper. The hiss before each advertisement.",
      arrival: "The wall shows a blue sea. Orra quietly reduces its color setting until it resembles something possible.",
      detail: ["A brochure\u2019s small print", "The sample soil capsule", "A departure board with no dates"],
      lore: [
        "The price of leaving",
        "Colony passage can be financed through a labor contract. Travel, housing, and oxygen appear as separate charges. Some people leave for opportunity. Others leave because rent makes staying impossible.",
      ],
      goods: ["postcard"],
    },
    {
      id: "shrine",
      room: 9,
      name: "Underlight / memorial alley",
      short: "UNDERLIGHT",
      style: "corridor",
      theme: "shelter",
      sound: "shelter",
      floor: "stone",
      color: "#e3c48d",
      door: [25, -9],
      tag: "NO NAME IS TOO SMALL",
      description: "An alley shrine made from jars, photographs, and names the public screens omit.",
      senses: "Candle wax. Damp stone. A melody played behind a closed window.",
      arrival: "Suri lifts a candle out of the rain. The glass around it once held cheap coffee.",
      detail: ["The candle shelf", "A photograph turned inward", "The wall of unregistered names"],
      lore: [
        "Who gets remembered",
        "The municipal memorial accepts verified records. Underlight accepts a name from anyone who remembers it. A missing document is not treated as a missing life.",
      ],
      goods: ["candle"],
    },
    {
      id: "laundry",
      room: 10,
      name: "Seventh Landing / homes above",
      short: "SEVENTH LANDING",
      style: "laundry",
      theme: "laundry",
      sound: "laundry",
      floor: "tile",
      color: "#a9bca1",
      door: [25, 3],
      tag: "HOME IS A SHARED REPAIR",
      description: "Laundry bridges, divided flats, shared water, and arguments that are also acts of care.",
      senses: "Soap. Rice. Warm cloth hanging above a cold stair.",
      arrival: "Someone has sewn four room numbers into one blanket. The residents lend it to whoever works the early shift.",
      detail: ["The shared water clock", "Four families\u2019 cooking schedule", "A child\u2019s chart of the real sky"],
      lore: [
        "An address inside an address",
        "One licensed flat can contain six households. The building lists one resident. Neighbors keep the useful list: who works nights, who needs stairs cleared, and who is still missing.",
      ],
      goods: ["broth"],
    },
    {
      id: "relay",
      room: 11,
      name: "Dead Channel / back-lane electronics",
      short: "DEAD CHANNEL",
      style: "security",
      theme: "power",
      sound: "electrical",
      floor: "metal",
      color: "#92c0c8",
      door: [25, 15],
      tag: "WE FIX WHAT THEY SWITCH OFF",
      description: "Unlicensed scanners, warranty traps, and a workbench with no network connection.",
      senses: "Flux. Burnt plastic. A signal pulsing below the music.",
      arrival: "Lex puts a metal lid over the payment reader before speaking. Cash makes no broadcast.",
      detail: ["The isolated workbench", "A collection of failed warranties", "The spare-parts drawer"],
      lore: [
        "Remote ownership",
        "Some tools stop when their subscription ends. Others report who uses them. Dead Channel separates a working machine from the permission to use it.",
      ],
      goods: ["coolant", "patch"],
    },
    {
      id: "print",
      room: 12,
      name: "True Face / print room",
      short: "TRUE FACE",
      style: "darkroom",
      theme: "darkroom",
      sound: "darkroom",
      floor: "tile",
      color: "#ce93ac",
      door: [10, 17],
      tag: "A PORTRAIT IS NOT A PERMIT",
      description: "ID portraits, family prints, and the small errors that can remove a person from a system.",
      senses: "Fixing solution. Hot lamps. Paper carried carefully by its edges.",
      arrival: "Min shows a customer the unretouched proof first. The customer recognizes a scar and starts to smile.",
      detail: ["The unretouched proof", "A box of rejected faces", "The darkroom\u2019s red lamp"],
      lore: [
        "A face and a file",
        "A civic record links an image to an address, work permit, and payment history. A face is a person\u2019s face. A record is something an office can lose.",
      ],
      goods: ["portrait"],
    },
    {
      id: "transit",
      room: 13,
      name: "Low Line / lower transit",
      short: "LOW LINE",
      style: "waiting",
      theme: "terminal",
      sound: "terminal",
      floor: "stone",
      color: "#e0bb75",
      door: [-3, 17],
      tag: "THE LAST SERVICE STILL COUNTS",
      description: "Workers, ticket gates, unsent luggage, and one final service beneath the city.",
      senses: "Brake dust. Coffee. An announcement swallowed by a passing train.",
      arrival: "Tess wipes the arrival board with a sleeve. Beneath the delays, someone has written: We will get you home.",
      detail: ["The manual route board", "A sleeper\u2019s folded uniform", "The lost-property bell"],
      lore: [
        "The city below the adverts",
        "The upper line serves offices and departures. Low Line carries cleaners, carers, and freight crews. A journey costs less after midnight because employers asked for cheaper late shifts.",
      ],
      goods: ["broth"],
    },
    {
      id: "radio",
      room: 14,
      name: "Open Frequency / tea and radio",
      short: "OPEN FREQUENCY",
      style: "studio",
      theme: "studio",
      sound: "studio",
      floor: "wood",
      color: "#ccaa92",
      door: [-18, 17],
      tag: "TAKE A CUP. LEAVE A NAME.",
      description: "A tiny tea room above a radio repair counter. Every table is also a listening post.",
      senses: "Ginger. Hot valves. A singer leaving room for the audience to breathe.",
      arrival: "June writes the title of a song on a receipt. Someone at the back knows its other title.",
      detail: ["The open microphone", "A cup for absent regulars", "The request book"],
      lore: [
        "A voice between towers",
        "Public transmitters carry licensed channels. Repair workers can pass a low-power voice along service wiring. The signal is weak. That makes it hard to sell and hard to silence.",
      ],
      goods: ["tea"],
    },
  ],
  resident = (r, e, t, s, i, n, o, a, l) => ({
    id: r,
    name: e,
    room: t,
    role: s,
    group: i,
    bio: n,
    want: o,
    tie: a,
    topics: l.map(([c, h]) => ({ label: c, text: h })),
  }),
  RESIDENTS = [
    resident(
      "mara",
      "Mara Daro",
      0,
      "Night-kitchen owner",
      "neighbors",
      "Mara inherited a burner and bought the rest one bowl at a time. She keeps debts on paper so a network cannot sell them.",
      "Get the last delivery home.",
      "Ada runs her wash station.",
      [
        [
          "The price of a bowl",
          "Six credits with meat. Four without. Nothing tonight if you worked and did not get paid. Tomorrow is another night.",
        ],
        [
          "The people at the counter",
          "Bo fixes the tram. Neri runs food. Ada knows when everybody last ate. Ask a city what it eats, not what it advertises.",
        ],
        [
          "The missing runner",
          "Neri came back without the last meal. He says the address moved. Addresses do not move. The people inside them do.",
        ],
      ],
    ),
    resident(
      "ada",
      "Ada Pell",
      0,
      "Pot washer and former cook",
      "neighbors",
      "Ada has a good hand, a replaced hand, and a notebook full of recipes written before portions became smaller.",
      "Keep the kitchen\u2019s mutual-aid fund private.",
      "Sena treated her hand.",
      [
        [
          "The wash water",
          "We wash the bowls in the hot overflow. Then rinse them in clean water. Waste is expensive. Dirt is more expensive.",
        ],
        ["My hand", "The old hand still cooks in my dreams. This one works well. I did not ask the clinic to make it forget."],
        [
          "A place to start",
          "Try Iri\u2019s umbrella bench. People leave more than broken hinges there. Return something before you ask for anything.",
        ],
      ],
    ),
    resident(
      "bo",
      "Bo Serrat",
      0,
      "Tram mechanic",
      "workers",
      "Bo worked under three transit logos without changing depots. He knows which warning lamps mean danger and which mean a bill is late.",
      "Keep the last service running.",
      "Tess keeps him supplied with coffee.",
      [
        [
          "The trains overhead",
          "That noise is a wheel seam. That other noise is a bearing. The company calls both normal service. I replace the bearing.",
        ],
        [
          "The last train",
          "Low Line must clear the freight signal before the passenger gate opens. Release the brake last. Write that down.",
        ],
        [
          "Life after a shift",
          "I sleep with the radio on. Silence means the power is out. The music tells me the refrigerator is still working.",
        ],
      ],
    ),
    resident(
      "neri",
      "Neri Quill",
      0,
      "Meal runner",
      "workers",
      "Neri knows the district by kitchens and service doors. His delivery bag contains one real flower sealed between two repair receipts.",
      "Find the owner of bowl forty-seven.",
      "Jin taught him the dry routes.",
      [
        [
          "The dry routes",
          "The left side of Pump alley stays dry. The right side only looks dry. Follow the workers, not the reflections.",
        ],
        [
          "That last meal",
          "The tag said 47. The depot changed platforms, not delivery numbers. The embossed brass token is the current one. Ignore yesterday\u2019s chalk.",
        ],
        ["My own meal", "I eat after the deliveries. Mara pretends not to notice that I make the last one to myself."],
      ],
    ),
    resident(
      "sai",
      "Sai Ravel",
      0,
      "Street sweeper",
      "workers",
      "Sai cleans the street before the advertising team photographs it. She keeps objects that look as though someone will miss them.",
      "Get a drain grate lifted before the next flood.",
      "Pavel sorts her found objects.",
      [
        [
          "What the rain brings",
          "Photos stick face-down. Coins roll. Small metal charms settle in the first drain basket. The city sorts its rubbish by weight.",
        ],
        ["A cleaner\u2019s view", "They ask me to clean the places the cameras see. People sleep in the places they do not. I clean both."],
        ["Useful quiet", "Underlight has no sales screen. Stay there for a minute and you can hear your own shoes."],
      ],
    ),
    resident(
      "len",
      "Len Argo",
      0,
      "Retired meter inspector",
      "neighbors",
      "Len once wrote fines for unlicensed heaters. He now spends his pension buying fuel for the stairwells where he issued them.",
      "Pay a debt without announcing it.",
      "Omar leaves him a spare stair key.",
      [
        ["The old job", "The meter told me what was used. It never told me who was cold. I learned the difference late."],
        [
          "The new meters",
          "Some are set to landlord time. The expensive period begins before the official evening rate. Compare your bill with Bo\u2019s service clock.",
        ],
        [
          "Who keeps this place",
          "You see the towers. I see a woman holding a stair door while a neighbor carries dinner. That is the load-bearing part.",
        ],
      ],
    ),
    resident(
      "vex",
      "Vex Anwar",
      0,
      "Licensed collection agent",
      "exchange",
      "Vex collects small commercial debts and refuses home accounts. The refusal has kept her on the lowest commission band for seven years.",
      "Find an honest way to close an impossible account.",
      "Dima rents her old storage unit.",
      [
        [
          "The difference in a debt",
          "A shop can agree to terms. A child cannot. I do not visit homes. My manager calls that a lack of ambition.",
        ],
        [
          "Receipts and threats",
          "A printed company seal proves that somebody owns a printer. Ask for a contract number and a witness copy.",
        ],
        ["The travel offer", "Blue Horizon sells a wage before the worker earns it. Tavi knows which charges the poster leaves out."],
      ],
    ),
    resident(
      "kio",
      "Kio Valez",
      0,
      "Umbrella musician",
      "neighbors",
      "Kio plays a six-string instrument with five working strings. The missing note belongs to a partner who left on a colony ship.",
      "Get one song onto June\u2019s night channel.",
      "June keeps a microphone ready.",
      [
        [
          "The missing string",
          "It is not an artistic choice. It snapped. Then I learned to leave the note out. Sometimes the gap does the work.",
        ],
        ["The sound of home", "My partner sent a recording of colony rain. It sounded like a fan in a tin room. I said it was beautiful."],
        ["Open Frequency", "June serves tea until the station closes. The request book has names, not ratings. Put yours down."],
      ],
    ),
    resident(
      "rusk",
      "Rusk Mere",
      1,
      "Pump keeper",
      "workers",
      "Rusk maintains pipes older than their service map. His pencil marks are the only accurate record of which valves feed homes.",
      "Share water without losing pressure.",
      "Omar reads his pencil maps.",
      [
        [
          "Water pressure",
          "Five units to the lower flats. Six to the clinic. Seven to the upper tank. That is tonight\u2019s safe balance: 5 / 6 / 7.",
        ],
        ["What a patch means", "A patch is not neglect. A patch is somebody getting up, finding a tool, and making the morning possible."],
        [
          "The flooded basket",
          "Pavel\u2019s charm fell after the pump tripped. Clear the leaves, lift the basket, rinse the mud, then open the cloth pouch.",
        ],
      ],
    ),
    resident(
      "jin",
      "Jin Osei",
      1,
      "Delivery porter",
      "workers",
      "Jin carries fragile goods and refuses jobs marked replaceable human contents. Her uniform is sewn from two former employers\u2019 coats.",
      "Find the owner of a repaired umbrella.",
      "Iri repairs her canopy at cost.",
      [
        [
          "The blue umbrella",
          "Its owner stitches one silver cross beneath the handle. A name label can be swapped. That repair cannot be moved without cutting the cloth.",
        ],
        [
          "The route ledger",
          "The company tracks my parcels. Mara tracks whether I have eaten. Only one of those systems knows when I am missing.",
        ],
        [
          "A shortcut",
          "The laundry stairs join this alley. Omar locked them when the pump failed. Help with the water and he will open them again.",
        ],
      ],
    ),
    resident(
      "mesa",
      "Mesa Nouri",
      1,
      "Utility apprentice",
      "workers",
      "Mesa studies pipe diagrams by the light of the machine she is learning to repair. She records her mistakes instead of erasing them.",
      "Earn a full shift without hiding a fault.",
      "Rusk signs her training notes.",
      [
        [
          "The first repair",
          "I tightened the wrong collar. Rusk made me draw what happened. The drawing is on the wall. Nobody has made that mistake since.",
        ],
        ["Weather notices", "The notice says light rain. The pump measures the water. I trust the pump."],
        ["A proper record", "Write down who fixed a thing. Otherwise the next manager will call it automatic service."],
      ],
    ),
    resident(
      "eda",
      "Eda Morrow",
      2,
      "Depot mechanic",
      "workers",
      "Eda once designed cooling equipment for a manufacturer. She now repairs its cheapest failures and recognizes the same weak joint in every model.",
      "Get a cold box to the clinic safely.",
      "Sena treats the night crew.",
      [
        [
          "The cold-chain seal",
          "The clinic box needs cooling, not freezing. Set intake 4, circulation 7, exhaust 2. The embossed settings survive a label change.",
        ],
        ["A repair manual", "The manual says to replace the unit. I wrote the manual. They removed the repair section before printing it."],
        ["The depot after midnight", "Drivers bring their own seat cushions. We own the tools together. The company owns the sign."],
      ],
    ),
    resident(
      "tarn",
      "Tarn Fenn",
      2,
      "Relief driver",
      "workers",
      "Tarn leaves a small gap on each shift sheet so another driver can eat. Dispatch calls the gap an unexplained delay.",
      "Finish the route with every passenger accounted for.",
      "Arun is his regular late passenger.",
      [
        [
          "The forgotten bowl",
          "The brass depot token is 47. The chalk 74 marks a repaired bay. A meal addressed to 47 goes to the night cleaner.",
        ],
        ["The shift gap", "Eight minutes. Enough for hot food if you do not read messages. I recommend not reading messages."],
        ["The man with the case", "Ori asks passengers where they need to be, not where the meter can take them. There is a difference."],
      ],
    ),
    resident(
      "sela",
      "Sela Eren",
      2,
      "Depot dispatcher",
      "workers",
      "Sela draws routes by hand after the dispatch software loses street access. She keeps canceled journeys because people still remember making them.",
      "Protect drivers from impossible schedules.",
      "Tess calls her when Low Line is late.",
      [
        [
          "The missing stock",
          "Blue crate to arcade. Red receipt to depot. White seal to clinic. Green return to market. The order is on the loading camera\u2019s paper backup.",
        ],
        [
          "Canceled does not mean empty",
          "The computer canceled a trip after the passenger got home. It removed the driver\u2019s pay. I kept the paper strip.",
        ],
        ["A city map", "A map should show where you can rest. Ours only shows where you can spend. Ask June for the other kind."],
      ],
    ),
    resident(
      "iri",
      "Iri Sable",
      3,
      "Umbrella repairer",
      "neighbors",
      "Iri can identify a regular by the sound of a damaged hinge. Her bench is the district\u2019s unofficial waiting room.",
      "Return a canopy to its actual owner.",
      "Jin brings the difficult repairs.",
      [
        ["What survives the rain", "Good wire. Waxed thread. Someone who comes back with the thing instead of throwing it away."],
        ["Names on handles", "People borrow umbrellas. They lend names less easily. The blue one has two claims and one repair mark."],
        ["My trade", "The canopy is not waterproof forever. Nothing is. I promise to be here when it starts leaking again."],
      ],
    ),
    resident(
      "fen",
      "Fen Havel",
      3,
      "Canopy stitcher",
      "neighbors",
      "Fen makes patches from retired advertising cloth. The underside of every canopy contains part of a promise nobody kept.",
      "Save enough fabric for a roof over the loan rack.",
      "Nima sends her torn laundry covers.",
      [
        ["The old adverts", "This patch used to say FOREVER. Now it says FOR. A more honest warranty."],
        ["Borrowing rules", "Take the loan canopy. Return it dry if you can. Return it wet if you cannot. Just return it."],
        [
          "The silver thread",
          "Jin\u2019s cross is silver because copper stains your hand. I put it there. The red loop belongs to a stranger.",
        ],
      ],
    ),
    resident(
      "dahl",
      "Dahl Renn",
      3,
      "Night watch volunteer",
      "neighbors",
      "Dahl watches the shop lane from a chair that has three replacement legs. He has a whistle and no official powers.",
      "Keep the lane lit through the power cut.",
      "Lex lends him lamp cells.",
      [
        [
          "What I can do",
          "I can shout. I can wake a shopkeeper. I can remember a face. People expect a weapon. Usually a witness is enough.",
        ],
        ["The power cut", "Lex sold the last good cell at cost. Do not call him generous where a supplier can hear you."],
        ["A person to visit", "Emi at Underlight keeps photographs dry. She will make room for yours. You do not have to explain it."],
      ],
    ),
    resident(
      "nola",
      "Nola Kes",
      4,
      "Memory broker",
      "exchange",
      "Nola left a corporate archive after a client\u2019s memories were valued as collateral. Her counter has a physical disconnect switch.",
      "Settle a disputed recording without taking its owner\u2019s rights.",
      "Ves checks her damaged reels.",
      [
        [
          "A memory copy",
          "You can sell a licensed recording of a day. You cannot sell the fact that it happened to you. Read the difference in the contract.",
        ],
        [
          "The sunlight dispute",
          "Kell paid for an unedited dawn. The reel has a gap. A gap proves an edit, not a lie. Check the consent track.",
        ],
        ["The disconnect", "The red switch cuts the network physically. A software promise needs electricity. This one needs a hand."],
      ],
    ),
    resident(
      "kell",
      "Kell Orin",
      4,
      "Freight worker and memory buyer",
      "workers",
      "Kell has worked under a roof for eleven years. He bought a recording of dawn with three weeks of overtime.",
      "Know what was removed from his purchase.",
      "Hale works his freight shift.",
      [
        ["Why buy a morning", "I finish work in the dark. I wake in the dark. I wanted one morning that did not belong to a shift clock."],
        [
          "What is missing",
          "At eleven seconds the sound jumps. I thought somebody had stolen the best part. Ves says a private voice was removed.",
        ],
        ["What I need", "Tell me what I bought. Do not decide what I ought to feel about it."],
      ],
    ),
    resident(
      "ves",
      "Ves Imani",
      4,
      "Analog restoration specialist",
      "exchange",
      "Ves restores recordings without inventing missing sections. The shop charges less when a client accepts an honest gap.",
      "Keep a removed private message private.",
      "Min develops her reference prints.",
      [
        [
          "The consent track",
          "Track A is dawn. Track B is a private voice removed with consent. Track C is the continuous clock. The missing voice is a privacy edit.",
        ],
        [
          "A perfect restoration",
          "A perfect copy of damage is sometimes the truthful copy. I label every repair. Guesswork gets a different color.",
        ],
        [
          "The quiet part",
          "People pay me to make a lost voice clearer. Sometimes I can. I never pretend a machine has brought the speaker back.",
        ],
      ],
    ),
    resident(
      "sena",
      "Dr. Sena Holt",
      5,
      "Street physician",
      "neighbors",
      "Sena keeps a clinic for people whose service plans expired. Her best equipment is older than her youngest patients.",
      "Restore the cold cabinet without wasting the remaining stock.",
      "Eda maintains her cooling units.",
      [
        [
          "No current address",
          "The intake form can wait. Breathing cannot. We write an address after treatment, even when the address is this chair.",
        ],
        [
          "Cold storage",
          "The box contains ordinary temperature-sensitive clinic stock. Not miracle medicine. Eda knows the calibration. I need the seal intact.",
        ],
        ["My own maintenance", "I put my appointment on the same list. That is why it is always next week. Hale keeps moving it upward."],
      ],
    ),
    resident(
      "hale",
      "Hale Toma",
      5,
      "Freight worker on recovery leave",
      "workers",
      "Hale is learning to use a replacement knee without the paid training sessions. He makes the waiting room tea between exercises.",
      "Return to work without giving up recovery time.",
      "Kell covers his locker fee.",
      [
        ["The new knee", "It works. The stairs are the same stairs. The difficult part is asking people to wait."],
        [
          "The waiting room",
          "The order is about need, not what your plan covers. Sena wrote that on a card after the payment screen failed.",
        ],
        [
          "Cold cabinet",
          "The monitor alarm is quiet because Sena is tired of frightening patients. That does not mean the fault is small.",
        ],
      ],
    ),
    resident(
      "luz",
      "Luz Dan",
      5,
      "Clinic reception volunteer",
      "neighbors",
      "Luz writes patient names large enough to read without a scanner. She knows which residents cannot read the official forms.",
      "Replace a form with a conversation.",
      "Min prints her large-type notices.",
      [
        ["The questions we ask", "Your name. What hurts. Who should know you are here. The rest is paperwork."],
        ["The questions we do not ask", "We do not ask whether a part was bought new. We do not ask whether someone has earned help."],
        ["A useful errand", "Ask the printer for large letters, not more posters. A readable notice does more than an impressive one."],
      ],
    ),
    resident(
      "tomo",
      "Tomo Akari",
      6,
      "Companion repairer",
      "neighbors",
      "Tomo repairs small machines with histories attached. He keeps their old shells even when replacement would be cheaper.",
      "Repair Pip\u2019s bird without replacing its song.",
      "Kesh supplies discontinued contacts.",
      [
        [
          "A companion\u2019s value",
          "A new bird sings better. This bird sings the song Pip\u2019s grandmother recorded. Those are different kinds of better.",
        ],
        [
          "The broken contact",
          "The song is safe. The power route is not. Kesh has the bridge part. Close only the route between the marked contacts.",
        ],
        ["Care instructions", "Oil the joint. Keep it dry. Talk to it or do not. It does not need to pass a test to stay."],
      ],
    ),
    resident(
      "pip",
      "Pip Sen",
      6,
      "Student and bird keeper",
      "neighbors",
      "Pip carries a bird in a lunch box lined with an old school scarf. A timetable on the lid includes a daily repair period.",
      "Hear the old song again.",
      "Eli helps with schoolwork.",
      [
        ["The song", "It starts wrong. Grandma always started it wrong. Please do not fix that part."],
        [
          "School above the market",
          "We learn the names of trees from a screen. Tomo says one day he will show us real wood. I think his bench counts.",
        ],
        ["The paper wing", "It will get wet. I know. I made two."],
      ],
    ),
    resident(
      "eli",
      "Eli Rook",
      6,
      "Evening teacher",
      "neighbors",
      "Eli teaches four age groups in a converted storeroom. A mechanical bird announces breaks because the official bell is too loud.",
      "Find a lesson that belongs to the children\u2019s own street.",
      "Pip is in the late class.",
      [
        [
          "The lesson plan",
          "We count repair parts. We read rent notices. Then we write something that is not a form. It is a full evening.",
        ],
        [
          "Borrowed classroom",
          "The market gives us the stockroom after closing. School smells of oranges on delivery days. The students like that.",
        ],
        ["Real animals", "A drawing is not a bird. A machine is not a bird either. They can still teach us how to take care."],
      ],
    ),
    resident(
      "dima",
      "Dima Noor",
      7,
      "Market cooperative steward",
      "workers",
      "Dima tracks shared stock in a book that every vendor can read. She refused the title owner when the old manager left.",
      "Find missing supplies without accusing the wrong stall.",
      "Fenna keeps the receiving receipts.",
      [
        [
          "The common scale",
          "Every stall uses it. Every stall can see it. We argue about the price, not whether a kilogram changed during lunch.",
        ],
        [
          "Missing stock",
          "A clinic carton disappeared in our transfer queue. Fenna saw the handoff. Sela has the dispatch sequence. Find the gap before a name.",
        ],
        ["A cooperative", "It means the person who sweeps gets a vote. That is the part newcomers find surprising."],
      ],
    ),
    resident(
      "fenna",
      "Fenna Idris",
      7,
      "Food vendor",
      "workers",
      "Fenna grows herbs in washed cooling trays. She can distinguish her stock from a counterfeit by the knots in its binding.",
      "Keep the cooperative\u2019s record public.",
      "Dima shares her delivery cart.",
      [
        [
          "The carton",
          "Blue crate entered first. The red depot receipt followed. Then the clinic\u2019s white seal. The green market return came last.",
        ],
        ["What grows here", "Mint tolerates the window. Coriander does not. Customers request coriander. The mint and I endure it."],
        ["Why I kept the receipt", "A rumor is light enough for anybody to carry. A record is heavier. I would rather carry the record."],
      ],
    ),
    resident(
      "kesh",
      "Kesh Bako",
      7,
      "Parts seller",
      "exchange",
      "Kesh sorts salvage by what it can still do. His most valuable drawer contains parts that nobody makes anymore.",
      "Keep repair stock from being melted down.",
      "Tomo keeps him supplied with broken toys.",
      [
        [
          "The bird part",
          "A bridge contact. I kept it because Tomo would ask for one eventually. It belongs in the power route, not across both terminals.",
        ],
        [
          "The price of old",
          "Rare does not always mean precious. Sometimes it means the last thing standing between a working tool and a rubbish bin.",
        ],
        [
          "A safer purchase",
          "At Dead Channel, ask for the isolated bench. A scanner that works only while connected may be reporting more than faults.",
        ],
      ],
    ),
    resident(
      "orra",
      "Orra Bell",
      8,
      "Passage clerk",
      "exchange",
      "Orra sells tickets she cannot afford. She has begun giving applicants a handwritten total beside the official monthly figure.",
      "Let customers see the whole cost.",
      "Tavi checks the contracts after closing.",
      [
        ["The poster", "The sea exists. The house is a model. The person in front of it is an actor. The debt terms are quite real."],
        [
          "My calculation",
          "Passage plus housing plus air plus return reserve. The bold monthly number includes only passage. Ask Tavi to show you the rest.",
        ],
        ["Would I go", "I do not know. That is a better answer than the company allows on the training form."],
      ],
    ),
    resident(
      "asa",
      "Asa Vey",
      8,
      "Colony applicant",
      "neighbors",
      "Asa repairs air filters and wants to see a horizon without towers. Their savings fit inside a repaired ticket wallet.",
      "Decide about passage with the real terms in hand.",
      "Orra has delayed their signature.",
      [
        ["A better place", "I do not expect paradise. I expect a window I can open. It seems a modest ambition until you price it."],
        [
          "The offer",
          "Housing included, the poster says. The contract charges it separately. Tavi found the line. Show me what it means before I sign.",
        ],
        ["Leaving people", "Wanting to leave does not mean I hate this place. It means I want the choice to come back."],
      ],
    ),
    resident(
      "tavi",
      "Tavi Brant",
      8,
      "Contract reader",
      "neighbors",
      "Tavi reads agreements aloud for residents who are tired, hurried, or unable to read the office script. He does not sign for them.",
      "Make hidden charges visible without choosing for Asa.",
      "Vex sends him confusing debt claims.",
      [
        [
          "The hidden total",
          "Passage is 120. Housing is 80. Air is 20. The nonrefundable deposit is 30. The quoted 120 is not the 250-credit total.",
        ],
        [
          "What a reader does",
          "I point to the line. I explain the line. The customer makes the decision. A warning is not another kind of ownership.",
        ],
        ["A copy to keep", "Get the version number. A printed promise without its version can become a different promise by morning."],
      ],
    ),
    resident(
      "suri",
      "Suri Valeen",
      9,
      "Memorial caretaker",
      "neighbors",
      "Suri maintains an alley memorial without a permit. She records names in washable pencil so a family can change what is public.",
      "Recover a small charm without displaying its private inscription.",
      "Pavel searches the drain baskets.",
      [
        [
          "The empty place",
          "A token washed away during the pump failure. The name on its inside was never meant for the wall. Pavel knows where it fell.",
        ],
        [
          "No official record",
          "I accept a name from a person. Offices call that weak verification. I call it someone coming here in the rain.",
        ],
        ["The inward photos", "The family chooses which way a picture faces. Looking after a memory does not mean looking at all of it."],
      ],
    ),
    resident(
      "emi",
      "Emi Leto",
      9,
      "Photograph keeper",
      "neighbors",
      "Emi dries memorial photographs between clean kitchen towels. She remembers faces by the person who brought the print.",
      "Make room for another name without covering an old one.",
      "Min replaces damaged prints at cost.",
      [
        ["Water on a photograph", "Lift it by the edge. Let it dry flat. Do not rub away a face because you are impatient to see it."],
        ["The wall is full", "We add another board. That is our policy. It does not require a meeting."],
        ["Someone still here", "People bring photographs of the living too. A missing person is not a completed story."],
      ],
    ),
    resident(
      "pavel",
      "Pavel Doss",
      9,
      "Salvage sorter",
      "workers",
      "Pavel returns found wedding rings before weighing the rest of a drain basket. His work apron has pockets labeled ask first.",
      "Return Suri\u2019s charm unopened.",
      "Sai tells him when a drain is blocked.",
      [
        [
          "The lost charm",
          "First clear the leaves. Then lift the basket. Rinse the mud before opening the cloth pouch. The charm stays closed inside it.",
        ],
        ["The inscription", "It is inside for a reason. We can return the object without making the words belong to us."],
        ["The scrap price", "Metal has a weight. A lost thing has somebody waiting. I try not to confuse the two."],
      ],
    ),
    resident(
      "omar",
      "Omar Nadir",
      10,
      "Resident maintenance steward",
      "neighbors",
      "Omar receives no wage for keeping Seventh Landing habitable. Neighbors leave meals by his door when he misses dinner.",
      "Restore shared water and reopen the alley stairs.",
      "Rusk marked the correct valve balance.",
      [
        [
          "The shared supply",
          "We need eighteen units across three branches. Rusk marked 5 / 6 / 7. The dial order is lower flats, clinic, upper tank.",
        ],
        [
          "The locked stairs",
          "I closed them because the pipe burst over the landing. Fix the pressure and the Pump alley door opens again.",
        ],
        [
          "A building\u2019s owner",
          "The owner has never climbed these stairs. Bea climbs them carrying groceries for three flats. Decide which fact helps you tonight.",
        ],
      ],
    ),
    resident(
      "nima",
      "Nima Ward",
      10,
      "Laundry worker",
      "workers",
      "Nima washes uniforms for companies that no longer employ the people wearing them. She repairs the seams without replacing the names.",
      "Keep a shared drying line warm.",
      "Fen patches her weather covers.",
      [
        ["The uniforms", "Take away a logo and it is still a good coat. Take away a job and it is still a person."],
        [
          "The clothesline rule",
          "Work clothes before sheets. Children\u2019s coats before both. Nobody wrote it down. I suppose you just did.",
        ],
        [
          "Water choices",
          "The clinic needs steady pressure. So do the top-floor flats. Balance is not the same as whoever complains loudest.",
        ],
      ],
    ),
    resident(
      "bea",
      "Bea Hsu",
      10,
      "Tenant and informal carer",
      "neighbors",
      "Bea organizes meals around neighbors\u2019 shifts. Her door carries a map of the stairs with rest points marked in red.",
      "Make the landing easier for residents who cannot rush.",
      "Hale helped make her stair map.",
      [
        ["The rest points", "A chair is infrastructure when the stairs are steep enough. Leave the folding one by the fourth window."],
        ["The rent notice", "The fee went up because the tower across the road improved our view. It blocked the only patch of real sky."],
        ["Home", "It is the place somebody notices your light has not come on. We try to be that place for one another."],
      ],
    ),
    resident(
      "lex",
      "Lex Varo",
      11,
      "Unlicensed electronics repairer",
      "exchange",
      "Lex removes remote locks from tools after their makers stop supporting them. He keeps the removed boards in dated bags.",
      "Find the reporting circuit in a cheap scanner.",
      "Cyra can trace the transmitter.",
      [
        [
          "The bargain scanner",
          "It finds faults. It also sends its operator\u2019s position to a warranty server. The seller forgot that second feature on the box.",
        ],
        [
          "A workbench without a wire",
          "The isolated bench has no uplink. Test there. Connect only the power route and leave the broadcast spur open.",
        ],
        [
          "Who owns a tool",
          "The hand that maintains it has an argument. The company has a contract. Those are not always the same conversation.",
        ],
      ],
    ),
    resident(
      "roan",
      "Roan Pike",
      11,
      "Night security contractor",
      "workers",
      "Roan guards a stockroom rather than a person. He is trying to change his contract before the next renewal.",
      "Learn whether his scanner tracks him too.",
      "Dahl borrows his spare lamp.",
      [
        [
          "The uniform",
          "People decide what I am before I speak. Some days that helps. Most days it stops them asking the useful question.",
        ],
        ["The scanner warning", "I thought the location light meant it had found a signal. Cyra says it means somebody found me."],
        ["The watch chair", "Dahl sees more from that chair than our cameras see in a week. Cameras do not ask whether someone got home."],
      ],
    ),
    resident(
      "cyra",
      "Cyra Moss",
      11,
      "Circuit tracer",
      "exchange",
      "Cyra maps undocumented electronics on paper. She keeps network tools inside a biscuit tin until a test actually needs them.",
      "Show Lex a safe power route.",
      "Kesh saves old diagrams for her.",
      [
        [
          "The transmitter spur",
          "Follow matching contacts from IN to OUT. The side spur does not need power. Rotate the tiles, then run the isolated test.",
        ],
        [
          "The paper map",
          "A paper schematic cannot silently update itself. I can be wrong, but at least the mistake stays where I can find it.",
        ],
        ["My own device", "No microphone. No position service. It tells time and occasionally needs winding. A manageable relationship."],
      ],
    ),
    resident(
      "min",
      "Min Sato",
      12,
      "Portrait printer",
      "neighbors",
      "Min prints civic images and family photographs on the same machine. The family photographs receive better paper.",
      "Help a client correct a record without erasing their face.",
      "Reva is choosing what to disclose.",
      [
        [
          "The new face request",
          "Reva asked for a new face. The problem is an exposed home address. Sometimes people ask a machine for more than they need.",
        ],
        [
          "A portrait",
          "I leave the scar unless you ask. I leave the tired eyes unless you ask. This is your picture, not my advertisement.",
        ],
        [
          "The safe copy",
          "Reva wants an address removed, the name kept, and the face unchanged. It is a consent copy, not a fabricated identity.",
        ],
      ],
    ),
    resident(
      "joel",
      "Joel Amari",
      12,
      "Print archivist",
      "exchange",
      "Joel stores rejected photographs with their owners\u2019 permission. The archive reveals how often an office mistakes a technical fault for a person\u2019s fault.",
      "Get the scanner\u2019s error log made public.",
      "Luz uses his large-type prints.",
      [
        ["Rejected faces", "Too dark. Too pale. Reflection. Damage. The machine lists reasons. Most describe its own camera."],
        ["Who keeps the negative", "The person in the photograph. We can hold a backup if they ask. It costs nothing to say no."],
        [
          "A print for the clinic",
          "Large letters. Matte paper. No decorative watermark across the address. Those are not difficult requirements.",
        ],
      ],
    ),
    resident(
      "reva",
      "Reva Ilyan",
      12,
      "Records clerk on leave",
      "neighbors",
      "Reva discovered her home address in a commercial people-search feed. She wants privacy without surrendering the name her family gave her.",
      "Remove the address, not the self.",
      "Min is preparing a consent copy.",
      [
        [
          "What I asked for",
          "I said make me someone else. Then Min asked what was wrong. My face was not the problem. My address was public.",
        ],
        [
          "My choices",
          "Remove the address. Keep the name. Keep the face. Put a consent note on the copy. I want control, not a perfect disguise.",
        ],
        [
          "The correction queue",
          "I used to work that queue. I thought a request number was reassurance. Now I know how long a number can feel.",
        ],
      ],
    ),
    resident(
      "tess",
      "Tess Calder",
      13,
      "Low Line station controller",
      "workers",
      "Tess stays until the final passenger clears the platform. The station records that time as unauthorized overtime.",
      "Send the final train safely and get Arun home.",
      "Bo knows the manual signal order.",
      [
        [
          "The manual start",
          "Bo knows the procedure. Clear freight, set the passenger route, close the gates, release the brake. No step is a suggestion.",
        ],
        [
          "The last passenger",
          "Arun works above the cloud screens. He has not seen the sky tonight either. Do not let the uniform fool you.",
        ],
        ["Why stay", "My job ends at departure. Somebody\u2019s journey ends later. I prefer to wait for that."],
      ],
    ),
    resident(
      "arun",
      "Arun Das",
      13,
      "Tower cleaner",
      "workers",
      "Arun cleans windows above the weather display. His commuter bag holds a child\u2019s lunch box for the morning shift at home.",
      "Get home before another family shift begins.",
      "Tarn drove him during the last rail failure.",
      [
        ["The view upstairs", "A bright blue sky on the glass. Rain against the real window behind it. I clean both."],
        ["Missing the last train", "It costs a cab fare and a night\u2019s sleep. The company notices only if I arrive late tomorrow."],
        ["The morning at home", "My daughter wants breakfast with a story. Tonight I may have one with a train that actually came."],
      ],
    ),
    resident(
      "pax",
      "Pax Greer",
      13,
      "Lost-property attendant",
      "neighbors",
      "Pax catalogs things by where their owners will search, not where they were found. The official system calls this inconsistent indexing.",
      "Get unclaimed bags out of the rain.",
      "Neri uses the station as a meeting point.",
      [
        [
          "The right shelf",
          "A worker will ask where the late train\u2019s things went. They will not ask for category 41B. I use the question they will ask.",
        ],
        ["The lost bell", "Ring once. I am behind the shelves. Ring twice if the thing has legs. That has happened."],
        [
          "A free ride",
          "Help Tess with the manual service. The local platform links this district\u2019s stops. She can put you on the service route afterward.",
        ],
      ],
    ),
    resident(
      "june",
      "June Asterly",
      14,
      "Tea seller and radio host",
      "neighbors",
      "June inherited a surname that sounds like a corporation and a radio that reaches three streets. She trusts the radio more.",
      "Keep the night channel open for ordinary names.",
      "Kio plays the closing song.",
      [
        [
          "The station name",
          "Open Frequency is an invitation. Not a technical description. The signal is barely strong enough to reach the laundry.",
        ],
        [
          "What we broadcast",
          "Lost tools. Late meals. A birthday. Sometimes a name people want to erase. We ask before putting a private story on air.",
        ],
        [
          "The first cup",
          "You can sit without ordering. Mara taught me that. Pay it forward when you can, not when a screen tells you to.",
        ],
      ],
    ),
    resident(
      "otto",
      "Otto Quen",
      14,
      "Radio repairer",
      "exchange",
      "Otto restores receivers too old for current licenses. He remembers when an update meant replacing a part, not accepting terms.",
      "Repair the community receiver without removing its tuning knob.",
      "Lex sends him analog work.",
      [
        ["The knob", "You can turn it with wet hands. You can turn it without a password. I consider those advanced features."],
        ["The crowded band", "Different voices cross. Sometimes one covers another. Listening is partly learning to wait for a gap."],
        ["The relay city", "Service wires link rooms the official map keeps separate. A voice can take a route that a passenger cannot."],
      ],
    ),
    resident(
      "zuri",
      "Zuri Ansel",
      14,
      "Night-channel listener",
      "neighbors",
      "Zuri records short messages for residents who cannot stay awake for the broadcast. Every envelope has permission written on it.",
      "Make a record that does not become somebody\u2019s property.",
      "Emi sends her missing-person notices.",
      [
        [
          "Permission first",
          "I ask who may hear it. I ask how long to keep it. Most people have never been asked either question by a recording device.",
        ],
        [
          "The things people send",
          "An apology. A recipe. A person saying their new address twice. Small things are large when you are waiting for them.",
        ],
        [
          "Your own record",
          "You came to find a courier. You can also remember who served the meal, repaired the lamp, and waited for the train.",
        ],
      ],
    ),
  ],
  RESIDENT_BY_ID = Object.fromEntries(
    RESIDENTS.map((r, e) => [
      r.id,
      { ...r, index: e, color: ["#b9815d", "#648d8a", "#8a7894", "#849274", "#9a6971", "#6a8498", "#b49d75"][e % 7] },
    ]),
  ),
  LOCAL_QUESTS = [
    {
      id: "bowl",
      title: "The Missing Bowl",
      giver: "mara",
      witnesses: ["neri", "tarn"],
      room: 2,
      object: "The depot delivery board",
      intro: "A paid meal has no recipient. Follow its delivery tag before the night cleaner leaves hungry.",
      testimony: {
        neri: "The meal tag is 47. Ask Tarn which depot number is still current.",
        tarn: "Brass 47 is the active delivery token. Chalk 74 is a bay number. The torn paper 17 is obsolete.",
      },
      kind: "match",
      prompt: "Which token belongs to the current meal order?",
      clue: "Neri: meal 47. Tarn: brass is current; chalk is a bay; torn paper is old.",
      choices: ["Chalk 74 / repaired bay", "Brass 47 / night cleaner", "Paper 17 / canceled run"],
      answer: 1,
      item: "A warm meal, correctly addressed",
      reward: 8,
      group: "neighbors",
      outcomes: [
        [
          "Deliver the meal without naming the debtor.",
          "Mara wipes the amount from the tab, not the name. The cleaner eats before the next shift.",
          "A brass bowl token hangs by the kitchen. Nobody asks what it cost.",
        ],
        [
          "Let the cleaner add it to the shared meal fund.",
          "The cleaner accepts the meal and promises a contribution on payday. Mara adds a blank line, not a deadline.",
          "The meal fund has another name and no due date.",
        ],
      ],
    },
    {
      id: "canopy",
      title: "Rainproof",
      giver: "iri",
      witnesses: ["jin", "fen"],
      room: 3,
      object: "The disputed blue canopy",
      intro: "Two claims. One umbrella. A repair mark can identify the owner without a public argument.",
      testimony: {
        jin: "My canopy has one silver cross beneath the handle. I lent it to Neri, not my name.",
        fen: "I stitched that cross. The red loop is a replacement label. The blank canopy belongs to the loan rack.",
      },
      kind: "match",
      prompt: "Which mark confirms the repaired canopy?",
      clue: "The permanent repair is silver thread under the handle. A removable label is not enough.",
      choices: ["A red name loop", "An unused blank handle", "A silver cross under the handle"],
      answer: 2,
      item: "Jin\u2019s repaired canopy",
      reward: 7,
      group: "neighbors",
      outcomes: [
        [
          "Return it directly to Jin.",
          "Jin tests the hinge and offers the dry half of the canopy. The district has one fewer lost thing.",
          "Jin leaves a silver-thread repair token on Iri\u2019s counter.",
        ],
        [
          "Return it with permission for the loan rack.",
          "Jin agrees to keep it on the loan rack between shifts. Iri writes the owner\u2019s name inside, not on the street.",
          "The loan rack now includes a blue canopy with a silver cross.",
        ],
      ],
    },
    {
      id: "memory",
      title: "Borrowed Morning",
      giver: "nola",
      witnesses: ["kell", "ves"],
      room: 12,
      object: "The consent-track viewer",
      intro: "A buyer paid for an unedited dawn. Find what the gap proves before deciding what the seller owes.",
      testimony: {
        kell: "The sound jumps at eleven seconds. I paid for a morning, not a story about one.",
        ves: "The clock is continuous. The private voice was removed with consent. A privacy edit was not disclosed on the sale card.",
      },
      kind: "match",
      prompt: "What does the recording support?",
      clue: "Continuous clock. Removed private voice. A sale card that promised no edits.",
      choices: ["The entire dawn is fabricated.", "A privacy-edited dawn was sold as unedited.", "The buyer is remembering incorrectly."],
      answer: 1,
      item: "A consent and sale mismatch",
      reward: 10,
      group: "exchange",
      outcomes: [
        [
          "Offer a refund and keep the private voice sealed.",
          "Nola refunds the unedited premium. Kell keeps the dawn. The missing voice does not become public evidence.",
          "Secondhand Sun now labels consent edits beside the price.",
        ],
        [
          "Let Kell choose a clearly labeled replacement.",
          "Kell chooses another licensed morning. Nola keeps the rejected reel sealed until its owner decides what happens next.",
          "A replacement card reads: edited with consent, buyer informed.",
        ],
      ],
    },
    {
      id: "clinic",
      title: "Patch Job",
      giver: "sena",
      witnesses: ["eda", "luz"],
      room: 5,
      object: "The cold-chain calibration box",
      intro: "The clinic\u2019s last sealed stock is warming. Repair its storage controls instead of trusting an altered label.",
      testimony: {
        eda: "Intake 4. Circulation 7. Exhaust 2. Use the embossed service plate, not the sticker.",
        luz: "The seal is intact. The cabinet failed, not its contents. Sena needs a stable temperature, not a stronger alarm.",
      },
      kind: "dials",
      labels: ["Intake", "Circulation", "Exhaust"],
      targets: [4, 7, 2],
      prompt: "Restore the service plate\u2019s three calibration values.",
      clue: "Embossed service settings: 4 / 7 / 2. The sealed box must not be opened.",
      item: "An intact cold-chain seal",
      reward: 10,
      group: "neighbors",
      outcomes: [
        [
          "Put the repaired unit on the clinic\u2019s shared shelf.",
          "Sena labels the shelf for local clinics to borrow. Luz records every transfer so nobody loses the chain of care.",
          "Night Window\u2019s shared cold cabinet has a green lamp.",
        ],
        [
          "Keep the unit as a protected emergency reserve.",
          "Sena keeps it sealed for the next overnight failure. Hale adds its check to the opening routine.",
          "A reserve unit waits beside the clinic\u2019s emergency bag.",
        ],
      ],
    },
    {
      id: "bird",
      title: "Clockwork Bird",
      giver: "tomo",
      witnesses: ["pip", "kesh"],
      room: 6,
      object: "The sparrow\u2019s power bridge",
      intro: "Pip\u2019s companion is silent. Its old song is safe. Restore the power route without replacing the recording.",
      testimony: {
        pip: "Please keep the wrong note at the start. Grandma always sang it that way.",
        kesh: "The replacement bridge is in Tomo\u2019s parts tray. Close a matching route from IN to OUT. Do not erase the song.",
      },
      kind: "circuit",
      seed: 1,
      prompt: "Rotate the contacts to power the old song chip.",
      clue: "Only matching open contacts carry power. The song chip stays in place.",
      item: "The first imperfect note",
      reward: 8,
      group: "neighbors",
      outcomes: [
        [
          "Keep the old voice and the paper wing.",
          "The bird sings its familiar wrong note. Pip puts the paper wing back and stops holding the lunch box so tightly.",
          "A small sparrow sings above Tin Sparrow\u2019s workbench.",
        ],
        [
          "Keep the old voice and fit the spare metal wing.",
          "Pip chooses a metal wing for the rain. The paper one goes inside the lunch box. The old voice stays.",
          "A metal-winged sparrow turns toward the workshop door.",
        ],
      ],
    },
    {
      id: "market",
      title: "Market Sweep",
      giver: "dima",
      witnesses: ["fenna", "sela"],
      room: 7,
      object: "The cooperative\u2019s transfer ledger",
      intro: "A missing clinic carton has started a rumor. Rebuild its route before a vendor gets blamed.",
      testimony: {
        fenna: "The blue crate arrived before the red receipt. The green return was last.",
        sela: "The depot receipt came before the clinic\u2019s white seal. A return entry went to the wrong shelf, not the wrong owner.",
      },
      kind: "sequence",
      order: [
        "Blue crate received at the arcade",
        "Red depot receipt countersigned",
        "White clinic seal checked",
        "Green return placed on the market shelf",
      ],
      prompt: "Rebuild the handoff order from both witnesses.",
      clue: "Blue before red. Red before white. Green last.",
      item: "The complete transfer chain",
      reward: 12,
      group: "workers",
      outcomes: [
        [
          "Correct the shared ledger in public.",
          "Dima reads the correction aloud, including her own missed entry. The accused vendor gets the apology before the stock moves.",
          "Nine Volt\u2019s ledger now shows the corrected return in green.",
        ],
        [
          "Let the vendors correct it together.",
          "Fenna and the other stallholders walk the route once. They change the shelf labels and sign the repair together.",
          "The return shelf carries four vendors\u2019 signatures.",
        ],
      ],
    },
    {
      id: "passage",
      title: "A Better World",
      giver: "asa",
      witnesses: ["orra", "tavi"],
      room: 8,
      object: "The passage contract terminal",
      intro: "Asa is about to sign a colony contract. Expose the full price without making the decision for them.",
      testimony: {
        orra: "The large number covers passage only. Housing and air remain separate. I held the signature until someone checked.",
        tavi: "120 passage, 80 housing, 20 air, 30 deposit. The complete amount is 250. The offer screen says 120.",
      },
      kind: "match",
      prompt: "Which amount belongs on the full-cost disclosure?",
      clue: "Passage 120 + housing 80 + air 20 + deposit 30.",
      choices: ["120 credits / poster amount", "220 credits / no deposit", "250 credits / all stated charges"],
      answer: 2,
      item: "A complete passage cost statement",
      reward: 10,
      group: "neighbors",
      outcomes: [
        [
          "Give Asa the terms and time to decide.",
          "Asa postpones the signature and keeps a copy. Orra writes a new appointment with no deposit beside it.",
          "Blue Horizon has a handwritten full-cost card.",
        ],
        [
          "Help Asa file a request for corrected advertising.",
          "Asa keeps their travel plan but challenges the missing charges. Tavi files their request, not a decision made for them.",
          "A customer correction request sits beside Blue Horizon\u2019s poster.",
        ],
      ],
    },
    {
      id: "ashes",
      title: "Ashes in the Gutter",
      giver: "suri",
      witnesses: ["pavel", "rusk"],
      room: 1,
      object: "The storm-drain recovery tray",
      intro: "A memorial charm is under the drain basket. Recover it without opening the private inscription.",
      testimony: {
        pavel: "Leaves first. Basket second. Rinse the mud. Open the cloth pouch last, but leave the charm itself closed.",
        rusk: "The pump is isolated. Nothing here needs force. A rushed lift would wash the pouch into the main drain.",
      },
      kind: "sequence",
      order: [
        "Clear leaves from the grate",
        "Lift the isolated drain basket",
        "Rinse the mud from the cloth pouch",
        "Open the pouch and keep the charm closed",
      ],
      prompt: "Choose a recovery order that preserves the small object.",
      clue: "Clear before lifting. Lift before rinsing. Rinse before opening the pouch.",
      item: "A closed memorial charm",
      reward: 7,
      group: "neighbors",
      outcomes: [
        [
          "Return it to the private shelf.",
          "Suri returns the charm with its inscription closed. A candle is moved close enough to keep the glass dry.",
          "A recovered charm rests on Underlight\u2019s inward-facing shelf.",
        ],
        [
          "Let the family choose a new place for it.",
          "Suri contacts the family before setting it down. They choose a covered hook that the next flood cannot reach.",
          "A covered hook holds the charm above the flood line.",
        ],
      ],
    },
    {
      id: "water",
      title: "Water Rights",
      giver: "omar",
      witnesses: ["rusk", "nima"],
      room: 10,
      object: "The shared water manifold",
      intro: "Three branches share one failing supply. Restore a balanced flow and reopen the stair route.",
      testimony: {
        rusk: "Lower flats 5. Clinic 6. Upper tank 7. Total 18. The valves need all three numbers, not just the total.",
        nima: "Steady flow matters more than a brief surge. The top floor loses supply first when someone opens every valve.",
      },
      kind: "dials",
      labels: ["Lower flats", "Clinic", "Upper tank"],
      targets: [5, 6, 7],
      prompt: "Set the three branches to the safe balance.",
      clue: "Safe balance: 5 / 6 / 7. Eighteen units in total.",
      item: "A balanced shared supply",
      reward: 12,
      group: "workers",
      perk: "stairs",
      outcomes: [
        [
          "Put the valve chart where every tenant can read it.",
          "Omar posts the settings beside the meter. The pipe holds. The door between Pump alley and Seventh Landing opens.",
          "An open service stair joins Pump alley to Seventh Landing.",
        ],
        [
          "Give the tenants a rotating maintenance check.",
          "Nima volunteers the first check. The settings stay public. Omar unlocks the service stair and finally goes home for dinner.",
          "The reopened stair has a tenant-signed maintenance sheet.",
        ],
      ],
    },
    {
      id: "signal",
      title: "Counterfeit Signal",
      giver: "lex",
      witnesses: ["roan", "cyra"],
      room: 11,
      object: "The isolated scanner test bench",
      intro: "A cheap scanner reports its user\u2019s position. Test a safe power route on the disconnected bench.",
      testimony: {
        roan: "The location lamp lights even when there is nothing to scan. I thought that meant readiness.",
        cyra: "The output route works without the transmitter spur. Align matching contacts between IN and OUT. Keep the test off the network.",
      },
      kind: "circuit",
      seed: 6,
      prompt: "Power the useful circuit on an isolated bench.",
      clue: "IN to OUT. Matching contacts only. The bench has no uplink; this is a hardware test, not a network intrusion.",
      item: "A scanner without the reporting board",
      reward: 12,
      group: "exchange",
      outcomes: [
        [
          "Label the reporting feature on the remaining stock.",
          "Lex opens each box and adds a plain warning. Customers can refuse the part before paying for it.",
          "Every scanner box at Dead Channel carries a reporting warning.",
        ],
        [
          "Remove the board and keep it as documented evidence.",
          "Cyra seals the removed board with the circuit sketch. Roan keeps a scanner that works without reporting him.",
          "A dated transmitter board hangs in Dead Channel\u2019s warranty archive.",
        ],
      ],
    },
    {
      id: "face",
      title: "New Face",
      giver: "min",
      witnesses: ["reva", "joel"],
      room: 12,
      object: "The consent-copy printer",
      intro: "A client asks for a new identity. Find what they actually want to change before touching their portrait.",
      testimony: {
        reva: "Remove my home address. Keep my name and face. Add my consent note. I am not asking to disappear from myself.",
        joel: "A consent copy can omit a private field. Changing the face would not remove the exposed address from the original feed.",
      },
      kind: "match",
      prompt: "Which print follows Reva\u2019s stated choices?",
      clue: "Address removed. Name kept. Face unchanged. Consent note added.",
      choices: ["New face, new name, old address", "Same face and name, no address, consent note", "Blank face, no name, no explanation"],
      answer: 1,
      item: "A copy that follows Reva\u2019s consent",
      reward: 9,
      group: "neighbors",
      outcomes: [
        [
          "Give Reva the only new copy.",
          "Reva checks the print and takes it. Min clears the temporary file. The choice stays with the person in the picture.",
          "True Face\u2019s temporary-print indicator is dark.",
        ],
        [
          "Keep a sealed backup with Reva\u2019s permission.",
          "Reva asks for one sealed backup. Min labels its release conditions and gives the key to Reva.",
          "A sealed backup waits in True Face\u2019s consent drawer.",
        ],
      ],
    },
    {
      id: "train",
      title: "Last Train Down",
      giver: "tess",
      witnesses: ["bo", "arun"],
      room: 13,
      object: "The manual departure panel",
      intro: "The last train is stuck behind a freight signal. Follow the safe order and get the late workers home.",
      testimony: {
        bo: "Clear freight. Set passenger route. Close gates. Release brake. That order prevents a platform conflict.",
        arun: "The freight car passed already. I watched it while the clock stopped. The waiting passengers are all behind the line.",
      },
      kind: "sequence",
      order: [
        "Confirm the freight section is clear",
        "Set the passenger route",
        "Close and confirm the platform gates",
        "Release the departure brake",
      ],
      prompt: "Set the manual departure sequence.",
      clue: "Freight clear \u2192 passenger route \u2192 gates closed \u2192 brake released.",
      item: "A final departure confirmation",
      reward: 12,
      group: "workers",
      perk: "transit",
      outcomes: [
        [
          "Stay until the last passenger boards.",
          "Arun gets a seat. Tess closes the platform after the final bag, not after the scheduled minute. Service routes now connect the local stops.",
          "Low Line\u2019s local service board is lit again.",
        ],
        [
          "Help Tess record the delay and the unpaid overtime.",
          "The train leaves safely. Tess keeps a copy of the real departure time. The local service route is available again.",
          "A real departure time appears beside Low Line\u2019s printed schedule.",
        ],
      ],
    },
    // Long Night additions: two more local stories for residents the street had not yet asked for help.
    {
      id: "song",
      title: "The Closing Song",
      giver: "june",
      witnesses: ["kio", "otto"],
      room: 14,
      object: "The community receiver",
      intro:
        "Kio\u2019s closing song reached the night channel as three recordings. Only one is Kio\u2019s own. Find it before a patched copy goes out under Kio\u2019s name.",
      testimony: {
        kio: "Six notes, climbing. The fifth string snapped a year ago, so the fifth note is a gap. I leave it out on purpose now. Anyone who fills it did not play it.",
        otto: "One reel ends with a short high chirp. That is a resale license mark, not music. The clean master and Kio\u2019s tape have no chirp. The master has every note filled in.",
      },
      kind: "tones",
      takes: [
        { label: "Reel A / the clean master", notes: [0, 4, 7, 9, 12, 7], mark: !1 },
        { label: "Reel B / the archive copy", notes: [0, 4, 7, 9, null, 7], mark: !0 },
        { label: "Reel C / the tea-room tape", notes: [0, 4, 7, 9, null, 7], mark: !1 },
      ],
      answer: 2,
      prompt: "Play each reel. Choose the take that is Kio\u2019s own.",
      clue: "Kio: six notes, the fifth left silent. Otto: no licensing chirp at the end.",
      item: "Kio\u2019s own recording, gap and all",
      reward: 9,
      group: "neighbors",
      outcomes: [
        [
          "Play it live tonight, gap and all.",
          "June opens the microphone at the closing hour. Kio plays five strings and lets the tea room hold the sixth. Nobody asks for the missing note.",
          "Open Frequency closes every night with a song that leaves one note for the listener.",
        ],
        [
          "Give Kio the only master to keep.",
          "Otto seals the take on an old reel with no license chirp. Kio decides who may hear it. June writes the permission on the envelope in pencil, so it can change.",
          "A sealed reel waits behind the tea counter, labeled in Kio\u2019s hand: ask first.",
        ],
      ],
    },
    {
      id: "meter",
      title: "An Honest Account",
      giver: "vex",
      witnesses: ["len", "sai"],
      room: 0,
      object: "The street meter cabinet",
      intro:
        "Vex holds a stairwell-heater account nobody can pay. She wants to close it honestly. The street meter says one thing. The people on the stair say another.",
      testimony: {
        len: "Read the service clock, not landlord time. The evening rate starts one hour after six. Landlord time moves it to three. Each heater hour at that rate is two units.",
        sai: "I sweep that stair at midnight and again at two. The heater came on at midnight and it was cold by two. Two hours, whatever the bill claims.",
      },
      kind: "dials",
      labels: ["Evening rate from (hours after six)", "Heater hours", "Units owed"],
      targets: [1, 2, 4],
      prompt: "Set the meter to the reading both witnesses support.",
      clue: "Service clock: the rate starts one hour after six. The heater ran two hours. Two hours at two units each.",
      item: "A corrected meter reading, witnessed twice",
      reward: 10,
      group: "exchange",
      outcomes: [
        [
          "Close the account at the true reading and report the meter.",
          "Vex closes the account at four units and attaches Len\u2019s note on landlord time. Her manager calls it a small collection. She calls it a correct one.",
          "The street meter cabinet carries a service-clock sticker and Vex\u2019s initials.",
        ],
        [
          "Let Len pay the four units quietly.",
          "Len pays the corrected balance without putting his name on the receipt. Vex marks the account closed. The heater stays on for the stairwell.",
          "A stair heater hums at midnight. The account behind it is closed.",
        ],
      ],
    },
  ],
  QUEST_BY_ID = Object.fromEntries(LOCAL_QUESTS.map((r) => [r.id, r])),
  STREET_VOICES = [
    ["Vendor", "Hot broth. The lid is included. The spoon comes back."],
    ["Commuter", "They moved my shift. The train did not move with it."],
    ["Repair worker", "Keep the old screw. The new thread will not fit."],
    ["Station speaker", "Low Line passengers: the final service has not been canceled."],
    ["Tenant", "Hang the little coats above the pipe. They dry faster there."],
    ["Market porter", "Heavy crate on the left. People on the right. Thank you."],
    ["Recorded advert", "A room beneath a new sky. Ask which parts of the sky cost extra."],
    ["Night cleaner", "Leave the photograph. I will lift it after the puddle drains."],
    ["Neighbor", "Your light was off. I brought you a cell."],
    ["Tea seller", "One cup for here. One for someone still at work."],
    ["Patrol radio", "Keep the service lane clear. Do not close the kitchen queue."],
    ["Porter", "The lift is out. Again. Take the stairs slowly."],
    ["A tired customer", "Does the dawn recording include birds? The cheap one had traffic."],
    ["Parent", "Hold the rail, not the advert. The rail is real."],
    ["Distant radio", "This next song is for everyone whose last train is still late."],
    ["Customer", "Leave the dent. That is how I know it is mine."],
    ["Shop assistant", "Cash works during a network outage. We still have paper receipts."],
    ["A pair under one canopy", "Your shoulder is getting wet. So move closer."],
    ["Building notice", "Water pressure check in progress. Please leave the marked valves alone."],
    ["Worker", "No, the overtime is not a bonus. It is time I already worked."],
    ["Market announcer", "School stockroom closes at midnight. Leave the teaching bench clear."],
    ["Passing musician", "I know the song. I do not know who owns it this week."],
    ["Two vendors", "You fed my runner. I repaired your lamp. We can stop counting now."],
    ["Station speaker", "Lost property remains a person\u2019s property. Ask Pax at the lower desk."],
  ],
  CITY_LORE = [
    {
      id: "rain-tax",
      room: 0,
      title: "The weather is a service",
      text: "The tower screens sell a clear sky while real rain runs behind them. Tenants pay a drainage surcharge. The same bill charges for clean-water delivery. The city sells the rain twice.",
    },
    {
      id: "meal-board",
      room: 0,
      title: "The small-debt economy",
      text: "Mara\u2019s slips carry names without interest. Repairs, meals, and spare seats move through the district without a single shared currency. People still keep track. They simply choose what not to collect.",
    },
    {
      id: "shift-city",
      room: 0,
      title: "A city with no closing time",
      text: "The bright upper floors need cleaners after their workers leave. Freight arrives after passenger fares rise. A district that never closes does not mean its residents never need sleep.",
    },
    {
      id: "service-stairs",
      room: 1,
      title: "A map of maintenance",
      text: "The official plan ends at property boundaries. Pipes, workers, meals, and small acts of care cross those lines. A service stair can connect people whose addresses belong to different districts.",
    },
    {
      id: "cab-coop",
      room: 2,
      title: "Seats held in common",
      text: "The drivers share a cushion, a tool shelf, and the cost of recovery after a breakdown. Dispatch licenses the vehicles. The practical depot is a network of people lending things back.",
    },
    ...SHOPS.map((r) => ({ id: r.id + "-record", room: r.room, title: r.lore[0], text: r.lore[1] })),
  ],
  LOCAL_GOODS = {
    broth: { name: "Warm broth", price: 4, description: "Carry one bowl. Use it from Equipment to restore 35 integrity.", item: "broth" },
    coolant: {
      name: "Refilled coolant cell",
      price: 5,
      description: "Carry one cell. Use it from Equipment to restore 45 focus.",
      item: "coolant",
    },
    patch: { name: "Bench repair", price: 6, description: "Restore 35 integrity now. A service, not a new body.", heal: 35 },
    bird: {
      name: "Tin sparrow pin",
      price: 3,
      description: "A small companion on Vale\u2019s lapel. Changes the world model and the conversation portrait.",
      keepsake: "bird-pin",
    },
    map: {
      name: "A map with rest stops",
      price: 2,
      description: "Add the repair cooperative\u2019s rest-stop record to your district notes.",
      keepsake: "rest-map",
      lore: "Nine Volt has added dry benches and warm rooms to a discarded utility map. The kitchen closes at dawn. The clinic bench stays open. The last line reads: rest is not an obstruction.",
    },
    postcard: {
      name: "Unedited colony postcard",
      price: 2,
      description: "The industrial reverse of the blue-sky poster. A keepsake with both sides.",
      keepsake: "postcard",
      lore: "The front has a blue sky. The reverse has a loading yard, a shared dormitory, and a waiting worker. Someone wrote: the sky is real; it is not the whole place.",
    },
    candle: {
      name: "A candle for someone absent",
      price: 2,
      description: "Leave a lit candle at Underlight. Its glow stays in this save.",
      keepsake: "candle",
    },
    portrait: {
      name: "A portrait of Vale",
      price: 3,
      description: "Keep a printed, unretouched portrait in your personal record.",
      keepsake: "vale-print",
    },
    tea: { name: "Ginger tea", price: 2, description: "Restore 25 focus now. June lets the cup cool before handing it over.", focus: 25 },
  };
function residentsInRoom(r) {
  return RESIDENTS.filter((e) => e.room === r);
}
function questStatusLabel(r, e) {
  return e
    ? e.stage === 4
      ? "RESOLVED"
      : e.stage === 3
        ? "RETURN TO " + RESIDENT_BY_ID[r.giver].name.toUpperCase()
        : e.stage === 2
          ? "FIELD WORK READY"
          : "ASK THE LOCAL WITNESSES"
    : "NOT STARTED";
}
var CASE_SETTINGS = [
    {
      rooms: [
        { name: "Night kitchen", style: "street", description: "Steam hides the ceiling. The cab meter keeps running." },
        { name: "Pump alley", style: "pump", description: "A row of pumps pushes the rain uphill." },
        { name: "Night cab depot", style: "garage", description: "Drivers sleep beside machines that never do." },
      ],
      frames: [
        "The rain turns each shop sign into a second sign beneath your feet.",
        "A meal cools at an empty place. Mara has not cleared it.",
        "The courier left a route through the things she touched. Begin with the wrapper.",
      ],
      trace: {
        label: "The delivery wrapper",
        text: "A meal wrapper sits beneath a dry ledge. The fold holds more than a receipt.",
        observations: [
          {
            label: "Split adhesive",
            tool: "lens",
            visible: "A second seam crosses the old fold.",
            finding: "The wrapper was reopened after Mara sealed it. The courier used a depot repair strip.",
          },
          {
            label: "Service dye",
            tool: "uv",
            visible: "A pale stain follows the seam.",
            finding: "The dye belongs to night-cab coolant. It is absent from the kitchen stock.",
          },
          {
            label: "Meter imprint",
            tool: "lens",
            visible: "Small numbers press through the paper.",
            finding: "The meter marks a stop at Pump Three. The passenger left before the charge ended.",
          },
        ],
        evidence: "Depot repair strip",
      },
      challenge: {
        label: "Restore the depot switch",
        mechanic: "circuit",
        text: "The depot camera lost power when the pumps reversed. Restore a path from the inlet to the camera.",
        result: "The camera catches a civic van at Pump Three. Its driver leaves an archive access token.",
        events: null,
        evidence: "Civic van token",
      },
      deduction: {
        question: "Why did the courier stop at the pumps?",
        conclusions: ["She arranged a transfer away from the kitchen.", "She damaged the water supply.", "She waited for a food delivery."],
        correct: 0,
      },
      document: {
        title: "A menu after midnight",
        text: "Mara prints the same price beside every meal. The small note at the bottom says payment can wait. Someone has crossed it out and written: payment can always wait. The till still contains yesterday\u2019s shortage. Mara has marked it as rain damage.",
      },
      thread: {
        id: "clock",
        title: "Off the clock",
        text: "A small cleaner waits at the depot wall. Its work cycle has ended, but it will not leave a blocked drain.",
        choices: [
          [
            "Ask what it needs.",
            "It requests a tool, not an order. You mark its repair request for the parts exchange.",
            { trust: 1, threadApproach: "care" },
          ],
          [
            "Issue a service order.",
            "It accepts the order and stays at the drain. The request is now on the city ledger.",
            { xp: 15, threadApproach: "record" },
          ],
        ],
      },
    },
    {
      rooms: [
        { name: "Public registry", style: "station", description: "Each drawer holds a name. Some drawers are empty." },
        { name: "Playback suite", style: "interview", description: "The observer sits on the wrong side of the glass." },
        { name: "Unindexed stack", style: "archives", description: "Paper survives here because nobody wants to scan it." },
      ],
      frames: [
        "The archive lift stops one floor below the public entrance.",
        "A reel turns behind glass. The time display returns to the same minute.",
        "Restore the order of events before you accept the machine\u2019s conclusion.",
      ],
      trace: {
        label: "The overwritten minute",
        text: "The raw interview still contains sound beneath the deletion. Nothing here identifies a species.",
        observations: [
          {
            label: "Clock rim",
            tool: "lens",
            visible: "The wall clock shows through a frame edge.",
            finding: "The room clock advances normally. Only the recorder timestamp runs backward.",
          },
          {
            label: "Relay hum",
            tool: "audio",
            visible: "A low pulse survives between spoken words.",
            finding: "The recorder restarted from an external erase signal, not a power failure.",
          },
          {
            label: "Seal stain",
            tool: "uv",
            visible: "One screw carries two layers of seal dye.",
            finding: "A technician opened the machine before the interview. The inspection report says otherwise.",
          },
        ],
        evidence: "External erase pulse",
      },
      challenge: {
        label: "Put the minute back",
        mechanic: "timeline",
        text: "Place four surviving events in their true order. Use the words on the recorder cards.",
        result: "The surviving records now form a valid sequence.",
        events: [
          ["Door opens", "The guard opens the room before the subject arrives."],
          ["Subject sits", "The subject waits in the chair before the test begins."],
          ["Erase command", "A remote command arrives during the first question."],
          ["Alarm report", "The machine prints its report after the command ends."],
        ],
        evidence: "Recorder event order",
      },
      deduction: {
        question: "What caused the missing minute?",
        conclusions: ["The subject broke the recorder.", "A remote erase command altered the record.", "The room lost all power."],
        correct: 1,
      },
      document: {
        title: "Desk instruction 17",
        text: "The archive manual tells staff to remove blank fields before filing. Iven has added a note: A blank field can mean that someone was not allowed to answer. Leave it in. The supervisor\u2019s approval box is also blank.",
      },
      thread: {
        id: "names",
        title: "Names in the margins",
        text: "Iven has hidden three unindexed names beneath a loose drawer. Their families still send address changes.",
        choices: [
          [
            "Keep the families\u2019 details private.",
            "You preserve the names without exposing their hiding places. Nemi will recognise the file code.",
            { trust: 1, threadApproach: "care" },
          ],
          [
            "Add the details to the civic file.",
            "The names re-enter the system. Their addresses remain behind an access warning.",
            { xp: 15, threadApproach: "record" },
          ],
        ],
      },
    },
    {
      rooms: [
        { name: "Room 404", style: "hotel", description: "One room. Two places set at a table." },
        { name: "Service corridor", style: "corridor", description: "The hotel keeps its promises in a locked cabinet." },
        { name: "Roof laundry", style: "laundry", description: "Sheets dry beneath a roof that no longer exists." },
      ],
      frames: [
        "Water runs down the stairwell beside the hotel\u2019s clean-linen promise.",
        "The service door is closed. Its lock has no damage.",
        "Someone helped the courier leave. Find out how without exposing the helper.",
      ],
      trace: {
        label: "The room\u2019s other visitor",
        text: "The room is clean in the places a guest would not normally touch.",
        observations: [
          {
            label: "Door plate",
            tool: "lens",
            visible: "A clean arc surrounds the handle.",
            finding: "A master-key sleeve protected the visitor\u2019s hand. This was not forced entry.",
          },
          {
            label: "Dust band",
            tool: "uv",
            visible: "A bright rectangle sits beneath the bed.",
            finding: "A memory case stood here after the room was cleaned. Its handle faced the service door.",
          },
          {
            label: "Pipe echo",
            tool: "audio",
            visible: "Three short impacts carry through the pipe.",
            finding: "The neighbour used the pipe to warn the courier. The warning came before security arrived.",
          },
        ],
        evidence: "Master-key sleeve",
      },
      challenge: {
        label: "Cross the service passage",
        mechanic: "stealth",
        text: "Retrieve the master-key log at the centre terminal. Reach the exit without filling the alarm meter.",
        result: "The log names a private recovery team. The hotel employee left the fire door open for the courier.",
        events: null,
        evidence: "Recovery-team log",
      },
      deduction: {
        question: "Who opened the room after the guest left?",
        conclusions: [
          "A random burglar forced the door.",
          "The neighbour entered through the window.",
          "A recovery team used authorised access.",
        ],
        correct: 2,
      },
      document: {
        title: "The hotel\u2019s promise",
        text: "A faded card lists hot water, clean bedding, and discretion. Beside discretion, someone has drawn a small door that opens from the inside. Below it are dozens of room numbers. Room 404 is the newest.",
      },
      thread: {
        id: "letter",
        title: "The last delivery",
        text: "A letter in the hotel post rack is addressed to a room, not a person. The courier wrote it before she left.",
        choices: [
          [
            "Carry the sealed letter.",
            "You take responsibility for one more small object. The address points to the Blue Hour.",
            { trust: 1, threadApproach: "care" },
          ],
          [
            "Record the address; leave the seal intact.",
            "The hotel agrees to hold the letter. You copy only the delivery instructions.",
            { xp: 15, threadApproach: "record" },
          ],
        ],
      },
    },
    {
      rooms: [
        { name: "Vale\u2019s apartment", style: "apartment", description: "The reader glows beside an untouched second cup." },
        { name: "Chemical darkroom", style: "darkroom", description: "The old process can recover what a digital edit removed." },
        { name: "Fourth-floor landing", style: "corridor", description: "Somebody still leaves the hall light on." },
      ],
      frames: [
        "Your key turns before the hall light comes on.",
        "The second cup is dry. The space beside it is not.",
        "A private question can wait. The public case cannot.",
      ],
      trace: {
        label: "The second cup",
        text: "The cup is not a message. It is a small object with a history.",
        observations: [
          {
            label: "Handle repair",
            tool: "lens",
            visible: "A repaired crack crosses the handle.",
            finding: "Someone repaired the cup with the same patient care used on Ori\u2019s dashboard.",
          },
          {
            label: "Mineral line",
            tool: "uv",
            visible: "A narrow green band sits below the rim.",
            finding: "The water came from the east reservoir. Your current building draws from the west.",
          },
          {
            label: "Reader bleed",
            tool: "audio",
            visible: "The reader plays a breath before the first frame.",
            finding: "A voice says your name, then asks permission to continue. The recording predates this case.",
          },
        ],
        evidence: "Reservoir mineral trace",
      },
      challenge: {
        label: "Read the person, not the trace",
        mechanic: "empathy",
        text: "Ori agrees to review the old recording. The aim is to hear the account, not to classify the speaker.",
        result: "Ori confirms the recording is old. Neither of you can prove who owned the memory before it reached the reader.",
        events: null,
        evidence: "Ori\u2019s recorded account",
      },
      deduction: {
        question: "What can you prove about the second cup?",
        conclusions: [
          "It has a history connected to Ori, but its meaning remains uncertain.",
          "It proves Vale is an artificial person.",
          "It proves Ori invented the whole case.",
        ],
        correct: 0,
      },
      document: {
        title: "A letter never sent",
        text: "You find an envelope in your own handwriting. It contains no accusation and no revelation. It asks a friend to visit after work. The date is missing. You put it beside the second cup instead of inside the evidence bag.",
      },
      thread: {
        id: "cup",
        title: "The second cup",
        text: "The building caretaker remembers two sets of footsteps, but will not invent a face to satisfy your question.",
        choices: [
          [
            "Accept the limit of the memory.",
            "The caretaker gives you a repair date. It leads to a roof shelter, not a verdict about your past.",
            { trust: 1, threadApproach: "care" },
          ],
          [
            "Ask for the repair record.",
            "The caretaker retrieves the record. You agree not to treat a missing name as proof.",
            { xp: 15, threadApproach: "record" },
          ],
        ],
      },
    },
    {
      rooms: [
        { name: "Moth arcade", style: "market", description: "Nothing has a price until you show interest." },
        { name: "Parts exchange", style: "workshop", description: "A bin of spare hearts sits beside a bin of screws." },
        { name: "Shipping cage", style: "warehouse", description: "Every living thing arrives under a cargo number." },
      ],
      frames: [
        "The market opens its night shutters as the rest of the street closes.",
        "A moth\u2019s wings tap against a box labelled DISPLAY PART.",
        "Follow the repairs. Every repair leaves a mark.",
      ],
      trace: {
        label: "A box without air holes",
        text: "The cargo label calls the moth a display part. The box was packed as if it needed air.",
        observations: [
          {
            label: "Double label",
            tool: "uv",
            visible: "Old ink remains beneath the new stock code.",
            finding: "The original destination was a public shelter, not a private collection.",
          },
          {
            label: "Wing dust",
            tool: "lens",
            visible: "Fine glass rests against the foam.",
            finding: "The moth was carried awake. Its memory carrier has already recorded this journey.",
          },
          {
            label: "Latch tone",
            tool: "audio",
            visible: "The latch answers with two notes.",
            finding: "The second note is a service code. It matches Nemi\u2019s cold-store equipment.",
          },
        ],
        evidence: "Shelter cargo label",
      },
      challenge: {
        label: "Wake the freight reader",
        mechanic: "circuit",
        text: "The shipping cage reader has been wired to erase its own log. Restore the safe output.",
        result: "The log records a shelter delivery diverted to the Cold Room. Nemi took custody before the erase order.",
        events: null,
        evidence: "Diverted freight log",
      },
      deduction: {
        question: "Why did the shipment change course?",
        conclusions: [
          "The moth was sold to a collector.",
          "Nemi intercepted a shelter delivery before erasure.",
          "The shipping label fell off by accident.",
        ],
        correct: 1,
      },
      document: {
        title: "Repair conditions",
        text: "The parts stall offers a repair guarantee. It excludes rain, age, poor maintenance, and loneliness. The seller has underlined the last word twice. A repaired cleaner waits under the desk. Its warranty expired six years ago.",
      },
      thread: {
        id: "clock",
        title: "A tool of its own",
        text: "At the parts stall, a replacement hand sits in a plain box. The owner field on the repair request is empty.",
        choices: [
          [
            "Let the cleaner choose its own tool.",
            "The cleaner selects a brush instead of a stronger gripper. Sol can fit the joint.",
            { trust: 1, threadApproach: "care" },
          ],
          [
            "Choose the standard replacement.",
            "You choose a reliable gripper. The cleaner asks whether it may keep the old brush.",
            { xp: 15, threadApproach: "record" },
          ],
        ],
      },
    },
    {
      rooms: [
        { name: "Cold stores", style: "lab", description: "Breath forms a cloud. The sealed jars remain clear." },
        { name: "Response chamber", style: "interview", description: "A machine offers certainty. Nemi offers a chair." },
        { name: "Coolant floor", style: "pump", description: "The floor is warm where it should be frozen." },
      ],
      frames: [
        "Nemi closes the cold-store door with both hands.",
        "A response chart rolls from a machine that already knows its answer.",
        "Listen to the person before you read the report.",
      ],
      trace: {
        label: "The false baseline",
        text: "A printed response chart appears precise. Its reference sample does not.",
        observations: [
          {
            label: "Repeated curve",
            tool: "lens",
            visible: "Two unrelated records share an identical curve.",
            finding: "The reference response was copied. The machine compares people with a stored template.",
          },
          {
            label: "Warmed sensor",
            tool: "uv",
            visible: "Heat marks stop at the edge of a contact pad.",
            finding: "The sensor was tested on a heated plate, not on a consenting subject.",
          },
          {
            label: "Calibration click",
            tool: "audio",
            visible: "A click occurs before each alarm.",
            finding: "An operator selected the alarm threshold before the answers were recorded.",
          },
        ],
        evidence: "Copied response curve",
      },
      challenge: {
        label: "Challenge the response report",
        mechanic: "empathy",
        text: "Nemi lets you question a volunteer who was marked for erasure. Watch the pressure meter and listen to each answer.",
        result:
          "The report confuses distress with dishonesty. The volunteer permits you to record that defect, but not their private memories.",
        events: null,
        evidence: "Consent to testify",
      },
      deduction: {
        question: "What does the response report establish?",
        conclusions: [
          "Distress proves the subject is dangerous.",
          "The machine can identify a person\u2019s origin.",
          "The test used a fixed template and an imposed threshold.",
        ],
        correct: 2,
      },
      document: {
        title: "Cold-store inventory",
        text: "The jars have names on removable labels. Their permanent tags list temperatures, not owners. Nemi writes a short instruction on each shelf: Ask before opening. This is the only rule she prints larger than the safety warnings.",
      },
      thread: {
        id: "names",
        title: "A name kept cold",
        text: "Nemi holds a sealed record for one of the unindexed families. She asks who will be allowed to hear it.",
        choices: [
          [
            "Let the family set the access terms.",
            "Nemi records their consent and nothing more. The family can testify without surrendering its past.",
            { trust: 1, threadApproach: "care" },
          ],
          [
            "Keep a protected civic copy.",
            "Nemi supplies only the verification record. The private memory stays with the family.",
            { xp: 15, threadApproach: "record" },
          ],
        ],
      },
    },
    {
      rooms: [
        { name: "Blue Hour floor", style: "club", description: "Nobody claps until they know it is safe." },
        { name: "Backstage passage", style: "backstage", description: "A coat hangs beside a list of names." },
        { name: "Sound booth", style: "studio", description: "A red lamp marks the last live channel." },
      ],
      frames: [
        "A singer waits until the room is quiet enough to hear a name.",
        "Behind the stage, a runner checks a repaired coat.",
        "Get the tape out without leaving its people exposed.",
      ],
      trace: {
        label: "The empty dressing room",
        text: "Lark keeps her notes in a place where the music cannot drown them out.",
        observations: [
          {
            label: "Set-list pressure",
            tool: "lens",
            visible: "Names indent the page beneath the set list.",
            finding: "The first letters form a shelter route. The song carries instructions as well as names.",
          },
          {
            label: "Sleeve thread",
            tool: "uv",
            visible: "A bright thread hangs from the coat lining.",
            finding: "Ash repaired the lining to hold the real parcel. The obvious pocket is a decoy.",
          },
          {
            label: "Monitor bleed",
            tool: "audio",
            visible: "A quiet voice cuts through the monitor noise.",
            finding: "A caller warned the club before civic dispatch issued an alert. Someone inside Aster helped.",
          },
        ],
        evidence: "Set-list route",
      },
      challenge: {
        label: "Get the runner through",
        mechanic: "chase",
        text: "Keep the decoy carrier moving through the crowd. Change lanes before the barrier reaches the lower line.",
        result: "Ash reaches the roof access. The pursuers follow the visible parcel, as planned.",
        events: null,
        evidence: "Roof-access route",
      },
      deduction: {
        question: "How did the real parcel leave the club?",
        conclusions: [
          "Ash carried it inside the repaired coat lining.",
          "Lark mailed it from the sound booth.",
          "A patrol confiscated it at the front door.",
        ],
        correct: 0,
      },
      document: {
        title: "The unused encore",
        text: "The last song has no words. Lark\u2019s note tells the band to leave space for the audience. Another note says the set must end before the first shift train. The singer has not decided which instruction matters more.",
      },
      thread: {
        id: "letter",
        title: "The listener at table four",
        text: "An older listener asks about the letter. She knows the courier\u2019s tune, but cannot bring herself to say her name.",
        choices: [
          [
            "Ask permission before passing it on.",
            "She accepts the sealed letter. A reply can travel with the broadcast confirmation.",
            { trust: 1, threadApproach: "care" },
          ],
          [
            "Leave it for her to collect.",
            "You leave the letter with Lark under the listener\u2019s chosen name. Nobody opens it for her.",
            { xp: 15, threadApproach: "record" },
          ],
        ],
      },
    },
    {
      rooms: [
        { name: "Service bridge", style: "roof", description: "The rain has nowhere lower to fall." },
        { name: "Relay walk", style: "roof", description: "Red lamps travel across the puddles." },
        { name: "Roof shelter", style: "greenhouse", description: "The door is held open with a broken heater." },
      ],
      frames: [
        "The city is quiet above the last occupied floor.",
        "A service lamp blinks in a rhythm that is almost a word.",
        "Cross the faults. Keep a route open for the person behind you.",
      ],
      trace: {
        label: "A broken junction",
        text: "The junction failed in a sequence. The first break matters.",
        observations: [
          {
            label: "Melt edge",
            tool: "lens",
            visible: "The outer edge has cooled before the centre.",
            finding: "The fault began outside the relay. A patrol discharge caused the short.",
          },
          {
            label: "Insulation trail",
            tool: "uv",
            visible: "Bright drops lead away from the bridge.",
            finding: "Ash used the insulated service walk. The exposed bridge is the pursuers\u2019 route.",
          },
          {
            label: "Beacon gap",
            tool: "audio",
            visible: "The beacon repeats a signal with a missing beat.",
            finding: "The missing beat marks the shelter hatch. It is a navigation aid, not a damaged transmitter.",
          },
        ],
        evidence: "Insulated service route",
      },
      challenge: {
        label: "Follow the shelter lights",
        mechanic: "chase",
        text: "Cross the service walk. The amber barriers mark live faults. Use the open lane.",
        result: "The hatch opens. Ash and the real parcel reach shelter. Nobody needs to make this crossing again.",
        events: null,
        evidence: "Shelter confirmation",
      },
      deduction: {
        question: "Which route kept Ash safe?",
        conclusions: [
          "The open bridge with no cover.",
          "The insulated service walk and shelter beacon.",
          "The patrol\u2019s live relay route.",
        ],
        correct: 1,
      },
      document: {
        title: "Shelter maintenance book",
        text: "A maintenance worker records each repaired latch with a date and a weather symbol. After the worker\u2019s name disappears from the payroll, the entries continue. The last page says only: The door must open from both sides.",
      },
      thread: {
        id: "cup",
        title: "The shelter photograph",
        text: "A shelter photograph shows your coat beside Ori\u2019s cab. The face is lost in reflected rain.",
        choices: [
          [
            "Keep the shared place, not a claimed identity.",
            "Ori remembers waiting here. The memory is imperfect, but the waiting was a choice.",
            { trust: 1, threadApproach: "care" },
          ],
          [
            "Save the image for later review.",
            "You keep an unenhanced copy. Filling a gap would be easy. Leaving it open takes care.",
            { xp: 15, threadApproach: "record" },
          ],
        ],
      },
    },
    {
      rooms: [
        { name: "Toy workshop", style: "workshop", description: "Small feet stop moving when you turn your head." },
        { name: "Conservatory", style: "greenhouse", description: "The tree has pushed its roots through an invoice." },
        { name: "Service lift shop", style: "garage", description: "A lift panel carries Sol\u2019s first signature." },
      ],
      frames: [
        "Small machines watch you from an unfinished workbench.",
        "A real branch rests against the workshop roof.",
        "Sol has kept an older way into the tower. Help him bring it back.",
      ],
      trace: {
        label: "The tree\u2019s service history",
        text: "The tree has no serial number. The machine beside it has too many.",
        observations: [
          {
            label: "Cut roots",
            tool: "lens",
            visible: "A root grew around an old metal clamp.",
            finding: "The tree was moved, not manufactured. Sol kept it alive during an earlier evacuation.",
          },
          {
            label: "Panel layers",
            tool: "uv",
            visible: "Three company marks show beneath the paint.",
            finding: "The lift controller predates Aster. Sol still has the original service authority.",
          },
          {
            label: "Toy whistle",
            tool: "audio",
            visible: "A toy repeats four short tones.",
            finding: "The tones are a maintenance acknowledgement. Sol taught the toys to call for help.",
          },
        ],
        evidence: "Original service authority",
      },
      challenge: {
        label: "Restore the lift route",
        mechanic: "circuit",
        text: "Route power to the old lift motor without relying on Aster\u2019s network.",
        result:
          "The controller accepts Sol\u2019s original service authority. The lift can reach the archive without a public badge check.",
        events: null,
        evidence: "Lift acknowledgement",
      },
      deduction: {
        question: "Why will the old lift accept Sol\u2019s key?",
        conclusions: [
          "Aster gave every toy a current badge.",
          "The tree interrupted the security network.",
          "The controller still accepts its original service authority.",
        ],
        correct: 2,
      },
      document: {
        title: "A tree without a receipt",
        text: "Sol\u2019s oldest invoice lists a tree as scrap wood. The shipping inspector accepted the description because the branches had no leaves. Sol kept the invoice, but not as proof of ownership. It reminds him that a wrong label can sometimes save a life.",
      },
      thread: {
        id: "clock",
        title: "A shift that ends",
        text: "Sol fits the cleaner\u2019s new joint. It asks whether finishing the drain means it must start another street.",
        choices: [
          [
            "Give it a choice to stop.",
            "The cleaner stops beside the tree. Later it starts again, without a work order.",
            { trust: 1, threadApproach: "care" },
          ],
          [
            "Arrange a paid repair shift.",
            "Sol puts a credit beside the tree. The cleaner keeps the credit before picking up its brush.",
            { xp: 15, threadApproach: "record" },
          ],
        ],
      },
    },
    {
      rooms: [
        { name: "Upper reception", style: "tower", description: "The storm is very quiet at this height." },
        { name: "Archive vault", style: "archives", description: "The shelves contain futures already marked for disposal." },
        { name: "Security floor", style: "security", description: "A clerk\u2019s family photograph faces away from the cameras." },
      ],
      frames: [
        "The lift rises above the rain line.",
        "A clerk turns a family photograph away from the door.",
        "Take proof of the programme. Leave private lives in private hands.",
      ],
      trace: {
        label: "The consent desk",
        text: "The forms are tidy. The dates are not.",
        observations: [
          {
            label: "Ink order",
            tool: "uv",
            visible: "Approval ink lies under the signature space.",
            finding: "The decision was printed before the consent request reached its subject.",
          },
          {
            label: "Staple shadow",
            tool: "lens",
            visible: "A removed page left two small tears.",
            finding: "The removed page contains the withdrawal procedure. The contract was incomplete.",
          },
          {
            label: "Room recording",
            tool: "audio",
            visible: "The desk recorder has a second channel.",
            finding: "The private channel lists storage quotas. The public channel calls the operation voluntary.",
          },
        ],
        evidence: "Pre-approved consent form",
      },
      challenge: {
        label: "Enter the private vault",
        mechanic: "stealth",
        text: "Reach the central archive key, then leave through the service exit. Each move advances the patrol.",
        result: "The key opens a read-only copy channel. The original archive remains intact for its owners.",
        events: null,
        evidence: "Read-only archive key",
      },
      deduction: {
        question: "Why is the consent record invalid?",
        conclusions: [
          "Approval preceded consent, and the withdrawal page was removed.",
          "All printed forms are invalid.",
          "The clerk used a pencil.",
        ],
        correct: 0,
      },
      document: {
        title: "Venn\u2019s empty frame",
        text: "An empty frame rests face-down in a drawer. The backing bears the outline of a small photograph. There is no name or date. You record the empty frame, not a conclusion about the man who removed its contents.",
      },
      thread: {
        id: "names",
        title: "The missing names become people",
        text: "The clerk can attach the hidden names to the public proof. She asks whether to include their homes.",
        choices: [
          [
            "Publish the names only with consent.",
            "The consenting names appear. Their locations and private memories remain protected.",
            { trust: 1, threadApproach: "care" },
          ],
          [
            "Use anonymous verified records.",
            "The records establish the harm without naming the families. The families retain a right to speak later.",
            { xp: 15, threadApproach: "record" },
          ],
        ],
      },
    },
    {
      rooms: [
        { name: "Weather Crown", style: "storm", description: "The antenna sways before you feel the wind." },
        { name: "Power gallery", style: "power", description: "Three live lines. One private signal." },
        { name: "Cable span", style: "roof", description: "Ori\u2019s beacon blinks below the cloud line." },
      ],
      frames: [
        "The storm reaches the antenna before the warning does.",
        "Three relay lamps answer in different colours.",
        "A public record and a private memory must not share the same carrier.",
      ],
      trace: {
        label: "The antenna\u2019s hidden load",
        text: "The array carries an extra signal under the storm warnings.",
        observations: [
          {
            label: "Cable colour",
            tool: "lens",
            visible: "An unmarked cable enters the civic relay.",
            finding: "The erase carrier uses the public warning line. Cutting power would also silence shelter alerts.",
          },
          {
            label: "Insulation heat",
            tool: "uv",
            visible: "Two housings run colder than the third.",
            finding: "Only the middle relay carries live names. The outside relays can carry the proof instead.",
          },
          {
            label: "Carrier beat",
            tool: "audio",
            visible: "Two tones return before the main pulse.",
            finding: "The feedback permits a protected broadcast. Private memory data need not leave the archive.",
          },
        ],
        evidence: "Protected carrier route",
      },
      challenge: {
        label: "Separate the carriers",
        mechanic: "circuit",
        text: "Connect the proof channel to the public aerial. Keep the sheltered-memory line on its own supply.",
        result: "The proof carrier is stable. Private recordings remain sealed, while shelter alerts stay live.",
        events: null,
        evidence: "Stable broadcast carrier",
      },
      deduction: {
        question: "How can the city receive proof without private exposure?",
        conclusions: [
          "Cut power to the entire warning system.",
          "Use separate carriers and keep private records sealed.",
          "Broadcast every private memory first.",
        ],
        correct: 1,
      },
      document: {
        title: "A field repair note",
        text: "The antenna engineer wrote the original emergency procedure by hand. A later revision added a company access code. Under the code, a third hand has restored the old instruction: In a storm, the warning belongs to everyone.",
      },
      thread: {
        id: "letter",
        title: "A reply at the relay",
        text: "The listener\u2019s reply arrives as a short pulse. It asks the courier to call, with no demand for an explanation.",
        choices: [
          [
            "Send the reply through the private channel.",
            "The courier receives a place to return to, not another obligation. The delivery is complete.",
            { trust: 1, threadApproach: "care" },
          ],
          [
            "Save it for a hand delivery.",
            "The reply stays sealed beside the ferry ticket. Some messages deserve a quiet room.",
            { xp: 15, threadApproach: "record" },
          ],
        ],
      },
    },
    {
      rooms: [
        { name: "Morning pier", style: "dock", description: "The empty sky is brighter than any advertisement." },
        { name: "Ferry terminal", style: "waiting", description: "A printed timetable survives the power cut." },
        { name: "Passenger cabin", style: "cabin", description: "A second coffee waits beside the window." },
      ],
      frames: [
        "The street lamps switch off one at a time.",
        "A ferry worker wipes rain from a seat that will soon be dry.",
        "Close the custody record. The owner, not the investigator, chooses what comes next.",
      ],
      trace: {
        label: "The passenger ledger",
        text: "The ferry clerk has written corrections in ordinary pencil.",
        observations: [
          {
            label: "Erased seat",
            tool: "lens",
            visible: "A rubbed line remains beneath two seat numbers.",
            finding: "The ticket reserved a safe place, not a named passenger. Nobody was meant to be left behind.",
          },
          {
            label: "Transfer stamp",
            tool: "uv",
            visible: "An old stamp appears beneath today\u2019s mark.",
            finding: "The courier bought this passage before she knew who would carry the proof.",
          },
          {
            label: "Cabin message",
            tool: "audio",
            visible: "The arrival board plays a quiet service message.",
            finding: "The shelters confirm receipt. Their records list living people, not inventory.",
          },
        ],
        evidence: "Open passenger reservation",
      },
      challenge: {
        label: "Close the custody record",
        mechanic: "timeline",
        text: "Order the case record before returning the reel. Follow the transfer notes.",
        result: "The surviving records now form a valid sequence.",
        events: [
          ["Courier seals the reel", "The courier seals the original before leaving the room."],
          ["Vale receives the reel", "The neighbour passes the sealed reel to Vale after the warning."],
          ["Proof is broadcast", "The city receives proof before the ferry opens its gate."],
          ["Owner receives the choice", "The owner decides custody after the public record is safe."],
        ],
        evidence: "Custody record",
      },
      deduction: {
        question: "Who decides what happens to the original reel?",
        conclusions: [
          "Whoever carried it the farthest.",
          "The company that manufactured the reader.",
          "The person whose memory it contains.",
        ],
        correct: 2,
      },
      document: {
        title: "The next timetable",
        text: "The ferry timetable shows a service that ended years ago. Somebody has written the new departure beneath it. The clerk leaves both in place. People have different ways of knowing when it is time to go.",
      },
      thread: {
        id: "cup",
        title: "Two coffees, no test",
        text: "Ori sets a second cup on the cabin table. It resembles the one at home, but does not explain it.",
        choices: [
          [
            "Make a new memory together.",
            "You sit down before the coffee cools. You have not solved your past. You have stopped letting it cancel the morning.",
            { trust: 1, threadApproach: "care" },
          ],
          [
            "Keep the question open.",
            "Ori leaves the seat beside you free. A shared morning does not require a shared answer.",
            { xp: 15, threadApproach: "record" },
          ],
        ],
      },
    },
  ],
  WITNESSES = {
    mara: {
      name: "Mara",
      role: "Night-kitchen owner",
      color: "#c69864",
      topics: [
        {
          label: "The missing meal",
          text: "The courier paid for two meals. She left one untouched, then asked whether the pumps still hid the sound of a car. Mara answered the question she heard, not the one a badge might ask.",
        },
        {
          label: "Who watches the street?",
          text: "The cameras watch the road. Mara watches people who hesitate at the door. She saw the courier hesitate twice: once before ordering, once before leaving a note.",
        },
        {
          label: "The price of a quiet table",
          text: "Mara has never charged for a chair. She asks you not to start charging for a witness\u2019s time. When someone is frightened, a question can sound like another bill.",
        },
      ],
    },
    ori: {
      name: "Ori",
      role: "Night-cab driver",
      color: "#73aba8",
      topics: [
        {
          label: "The route between places",
          text: "Ori keeps an older street map under the seat. The official map removes closed shelters. The old map still shows doors that people can open.",
        },
        {
          label: "What the meter records",
          text: "A cab meter records distance, not what a passenger leaves behind. Ori can tell you where a journey ended. He will not pretend it explains why.",
        },
        {
          label: "Trust without certainty",
          text: "Ori asks whether you need an answer or a companion. Then he checks the fuel gauge. Whatever you choose, he intends to finish the trip.",
        },
      ],
    },
    iven: {
      name: "Iven",
      role: "Civic archivist",
      color: "#8aa8c0",
      topics: [
        {
          label: "The room clock",
          text: "Iven compared the recorder with the clock on the wall. The clock advances normally. The file does not. He wrote both observations before his supervisor arrived.",
        },
        {
          label: "The subject\u2019s response",
          text: "The subject laughed because the test used the same story twice. The machine recorded the laugh as a fault. Iven now doubts which side of the desk it was testing.",
        },
        {
          label: "The waste drawer",
          text: "Iven keeps names that do not fit the form. He cannot confirm every spelling. He can confirm that the letters keep arriving from people who miss them.",
        },
      ],
    },
    neighbor: {
      name: "The neighbour",
      role: "Room 403",
      color: "#9d8fba",
      topics: [
        {
          label: "The warning",
          text: "The neighbour heard the service lock turn before the lift stopped. She tapped the pipe three times. The courier understood and moved the case under the bed.",
        },
        {
          label: "The handover",
          text: "The courier passed the reel through the window space. She asked that it reach a reader, not the authorities. The neighbour now needs to know which one you are.",
        },
        {
          label: "What stays off the record",
          text: "The neighbour will describe a sound, a time, and a coat. She will not name the other people hiding here. You have enough to continue without asking her to.",
        },
      ],
    },
    seller: {
      name: "Pell",
      role: "Moth and parts seller",
      color: "#ae8a73",
      topics: [
        {
          label: "The maker\u2019s mark",
          text: "Pell sells finished moths, but repairs are more reliable work. Every wing carries a maker\u2019s pattern. A new pattern does not erase the old one underneath.",
        },
        {
          label: "Living cargo",
          text: "The box was labelled as a part. Pell cut air holes before reading the invoice. He says some habits survive even when the creature does not need them.",
        },
        {
          label: "The service code",
          text: "The latch tone is not a song. It is a technician\u2019s shortcut. Nemi used it when the network stopped accepting her badge.",
        },
      ],
    },
    nemi: {
      name: "Nemi",
      role: "Memory prosthetist",
      color: "#91b9aa",
      topics: [
        {
          label: "A borrowed baseline",
          text: "Nemi says a baseline is a comparison, not a person. This machine uses one fixed curve for everyone. Its printed confidence does not change that limit.",
        },
        {
          label: "What a memory can prove",
          text: "A memory can establish an experience. It cannot establish a right to own the person who had it. Nemi keeps the storage terms separate from the subject\u2019s consent.",
        },
        {
          label: "Why the room is cold",
          text: "Cold storage buys time for damaged carriers. Nemi lowers her voice when she adds that time is the only service she has never been able to guarantee.",
        },
      ],
    },
    lark: {
      name: "Lark",
      role: "Blue Hour singer",
      color: "#bb8fab",
      topics: [
        {
          label: "The missing names",
          text: "Lark asks families how to pronounce each name. The work takes longer than writing the melody. It is the part she refuses to cut.",
        },
        {
          label: "The coat",
          text: "Ash chose the coat because the lining could carry the parcel close to the body. The stage pocket holds the decoy. The repair thread is still visible under service light.",
        },
        {
          label: "Who called first?",
          text: "A caller knew the recovery team\u2019s route before civic dispatch did. The voice gave no name. Lark wrote down the warning, not a guess about the caller.",
        },
      ],
    },
    ash: {
      name: "Ash",
      role: "Independent runner",
      color: "#a99fb6",
      topics: [
        {
          label: "The parcel\u2019s weight",
          text: "Ash expected a childhood to feel heavy. It weighs less than the reader battery. That fact has made the job more difficult, not less.",
        },
        {
          label: "A route with an exit",
          text: "Ash checks the return route before the first step. The insulated service walk ends at a shelter that opens from both sides. The main bridge does not.",
        },
        {
          label: "After the delivery",
          text: "Ash has no next job booked. For the first time, that is a plan rather than a problem. He asks whether the morning ferry takes people without luggage.",
        },
      ],
    },
    sol: {
      name: "Sol",
      role: "Toy maker and engineer",
      color: "#b5a572",
      topics: [
        {
          label: "The old lift",
          text: "Sol helped install the original controller. Aster changed the front panel but left the motor logic intact. A machine can carry more than one owner\u2019s name without forgetting its first instructions.",
        },
        {
          label: "The tree",
          text: "Sol moved the tree during an evacuation. It looked dead, so the inspector let it pass as scrap. It put out leaves three weeks later. Sol never corrected the invoice.",
        },
        {
          label: "The little machines",
          text: "The toys copy Sol\u2019s habits. One has started switching off empty work lamps. Sol calls this an improvement and leaves a small step beneath each switch.",
        },
      ],
    },
    venn: {
      name: "Director Venn",
      role: "Aster administrator",
      color: "#c4b08c",
      topics: [
        {
          label: "The terms",
          text: "Venn says the programme keeps the city stable. When you ask where consent appears in the process, he points to the signature line. He does not turn to the missing page.",
        },
        {
          label: "The private channel",
          text: "The private ledger measures storage quotas. The public account describes voluntary transfers. Venn calls the difference an administrative necessity. You record the difference without accepting the explanation.",
        },
        {
          label: "The empty frame",
          text: "Venn notices you looking at the frame and closes the drawer. You do not know who the photograph showed. No useful evidence comes from inventing an answer.",
        },
      ],
    },
  },
  THREADS = {
    clock: {
      name: "Off the clock",
      chapters: [0, 4, 8],
      ending:
        "The cleaner finishes the drain. At Sol\u2019s tree, it pauses without waiting for an order. Work is no longer the only thing it knows how to do.",
    },
    names: {
      name: "Names in the margins",
      chapters: [1, 5, 9],
      ending:
        "The families control their own testimony. The public record establishes what happened without making their homes part of the broadcast.",
    },
    letter: {
      name: "The last delivery",
      chapters: [2, 6, 10],
      ending: "A sealed letter reaches its listener. A reply reaches the courier. Neither needed an investigator to open it first.",
    },
    cup: {
      name: "The second cup",
      chapters: [3, 7, 11],
      ending: "The old cup remains unexplained. The new one is placed beside yours by someone who chose to stay.",
    },
  },
  SKILLS = {
    analysis: {
      name: "Observation",
      desc: "Scanner costs 3 less focus per level. The image lens gets a wider capture area. Forensic mistakes cost less focus.",
    },
    empathy: {
      name: "Interview",
      desc: "Pressure from difficult questions falls by 2 per level. Calm questions recover more of the witness\u2019s trust.",
    },
    fieldcraft: {
      name: "Fieldcraft",
      desc: "Patrol alarm gain falls by 4 per level. Live-roof damage falls by 10% per level. Circuit hints reveal a useful tile.",
    },
  };
function expandCases(r, e) {
  r.forEach((t, s) => {
    let i = CASE_SETTINGS[s];
    ((t.rooms = i.rooms), (t.frames = i.frames));
    let n = t.tasks.filter((p) => p.kind !== "side" && p.kind !== "exit"),
      o = t.tasks.find((p) => p.kind === "side"),
      a = t.tasks.find((p) => p.kind === "exit");
    ((n[0].room = 0),
      (n[1].room = 1),
      (n[2].room = 0),
      (o.room = 0),
      (a.room = 0),
      n.forEach((p) => {
        WITNESSES[p.id] && (p.person = p.id);
      }));
    let l = {
      id: "field-trace",
      label: i.trace.label,
      kind: "forensic",
      room: 1,
      x: -4,
      z: 0,
      req: [n[0].id],
      ...i.trace,
      reward: "trace-" + s,
    };
    ((n[1].req = [...new Set([...(n[1].req || []), "field-trace"])]), (n[1].x = 4), (n[1].z = -3));
    let c = {
      id: "field-operation",
      label: i.challenge.label,
      kind: "challenge",
      room: 2,
      x: 2,
      z: -2,
      req: [n[1].id],
      ...i.challenge,
      reward: "operation-" + s,
    };
    n[2].req = [...new Set([...(n[2].req || []), "field-operation"])];
    let h = {
        id: "case-theory",
        label: "Connect the evidence",
        kind: "deduction",
        room: 0,
        x: 0,
        z: 3,
        req: [n[2].id],
        ...i.deduction,
        evidenceIds: ["trace-" + s, "operation-" + s],
      },
      u = { id: "local-record", kind: "document", label: i.document.title, room: 1, x: 5, z: 4, optional: !0, text: i.document.text },
      d = { id: "crossing-paths", kind: "thread", label: i.thread.title, room: 2, x: -5, z: 3, optional: !0, ...i.thread };
    ((d.id = "crossing-paths"),
      (d.thread = i.thread.id),
      (o.optional = !0),
      (a.req = [...a.req, "case-theory"]),
      (t.tasks = [n[0], l, n[1], c, n[2], h, o, u, d, a]),
      (e["trace-" + s] = [i.trace.evidence, i.trace.observations.map((p) => p.finding).join(" "), "\u2315"]),
      (e["operation-" + s] = [i.challenge.evidence, i.challenge.result, "\u25A6"]));
  });
}
CASE_SETTINGS[0].rooms.push(...SHOPS.map((r) => ({ name: r.name, style: r.style, description: r.description })));
var lifeDetail = (r, e, t, s = "", i = "", n = "") => ({ title: r, prop: e, text: t, action: s, result: i, after: n }),
  lifeResident = (r, e, t, s) => ({ name: r, role: e, routine: t, line: s }),
  lifePlace = (r, e, t, s, i, n, o, a, l, c) => ({
    name: r,
    theme: e,
    sound: t,
    floor: s,
    senses: i,
    arrival: n,
    resolved: o,
    details: a,
    event: l,
    residents: c,
  }),
  LIFE_PLACES = [
    [
      lifePlace(
        "Night kitchen",
        "kitchen",
        "kitchen",
        "wet",
        "Hot stock. Wet wool. A tram above the awning.",
        "Mara turns a bowl so its chipped side faces the wall. A driver sleeps over an empty plate. Nobody asks you to buy anything yet.",
        "Mara stops watching the alley. She starts a fresh pot for the drivers who will take the early shift.",
        [
          lifeDetail(
            "The rattling lid",
            "stockpot",
            "A bent lid taps the stockpot on each boil. Someone has wrapped the handle in a strip of blue uniform cloth. The pot has outlasted three owners.",
            "Set the lid straight",
            "The lid sits square. The sharp rattle stops. Mara raises two fingers without leaving the stove.",
            "The lid is quiet. A clean bowl waits beside it.",
          ),
          lifeDetail(
            "The wall of small debts",
            "notice",
            "Paper slips fill the space behind the till. None lists an interest charge. One reads: Ada, two bowls, whenever. Mara has crossed out the amount, not the name.",
          ),
          lifeDetail(
            "The umbrella nobody claims",
            "umbrella",
            "Five wire repairs hold its ribs together. Its label gives the kitchen address, not a person. People take it into the rain and return it on the next shift.",
          ),
        ],
        ["Mara", "You can warm your hands without ordering.", "Late driver", "That is why I keep coming back."],
        [
          lifeResident("Ada", "Pot washer", "work", "Leave the blue bowl. That one is for a regular."),
          lifeResident("Bo", "Tram mechanic", "walk", "The tram runs all night. The lift at my home does not."),
        ],
      ),
      lifePlace(
        "Pump alley",
        "pump",
        "drains",
        "wet",
        "A pump knocks behind brick. Warm drain water meets rain.",
        "Condensation beads on a service door. Someone has built a little roof over a junction box from delivery trays.",
        "The depot line holds its pressure. Water runs down the intended drain instead of through the wall.",
        [
          lifeDetail(
            "The bucket under the joint",
            "leak",
            "A pipe leaks onto the courier route. A mop bucket catches most of it. Chalk marks its highest level: too much for one night.",
            "Seat the loose drain collar",
            "The drip finds the drain. The bucket stops ringing. A worker can now cross without soaking a second pair of socks.",
            "The bucket is empty. The repaired joint holds.",
          ),
          lifeDetail(
            "An old high-water mark",
            "ruler",
            "Flood lines rise beside a child\u2019s height marks on the brick. On the latest line, two different hands have written the same date.",
          ),
          lifeDetail(
            "A shrine to a dry room",
            "shrine",
            "A battery candle stands inside a jar. Beside it sits a tiny model of a house, with a door that opens. The real buildings above have sealed windows.",
          ),
        ],
        ["Pump keeper", "That is the third patch this month.", "Delivery porter", "Then it is a good month. Last month needed five."],
        [
          lifeResident("Rusk", "Pump keeper", "work", "Keep clear of the blue pipe. It is warmer than it looks."),
          lifeResident("Jin", "Delivery porter", "walk", "The arrows lead to the depot. The dry spots do not."),
        ],
      ),
      lifePlace(
        "Night cab depot",
        "garage",
        "garage",
        "concrete",
        "Cooling motors. Cheap coffee. A radio between stations.",
        "Cabs stand with their hoods open. A mechanic has left a work lamp pointing at a driver\u2019s lunch rather than the engine.",
        "The dispatch strip wakes. The next cab gets a route, and the mechanic finally closes the hood.",
        [
          lifeDetail(
            "A lamp on its last contact",
            "lamp",
            "The work lamp goes dark whenever a train passes. A pencil props up the socket cover. There is a proper latch below the stand.",
            "Close the contact latch",
            "The lamp stays on. Its warm pool reaches the lunch tin and the open manual.",
            "The lamp is steady. The pencil has returned to the manual.",
          ),
          lifeDetail(
            "A child\u2019s route map",
            "map",
            "A drawing on the dispatch wall shows an impossible route: depot, moon, home. A driver has added charging stops with a service pencil.",
          ),
          lifeDetail(
            "The spare seat cushion",
            "bench",
            "One cushion has been patched with six different cab fabrics. The drivers move it to whichever seat has the worst spring. It has no assigned vehicle.",
          ),
        ],
        ["Mechanic", "Your meter says you owe yourself twelve credits.", "Driver", "Good. I know where I live."],
        [
          lifeResident("Eda", "Depot mechanic", "work", "Ori checks the passenger heater before the fuel."),
          lifeResident("Tarn", "Relief driver", "sip", "If you find my sleep, leave it in cab six."),
        ],
      ),
    ],
    [
      lifePlace(
        "Public registry",
        "registry",
        "office",
        "tile",
        "Paper dust. Hot terminals. A queue bell with no queue.",
        "The number display changes. Nobody moves. A cleaner lifts a chair by its back, careful not to wake the person asleep on it.",
        "Iven leaves the public window open. The next visitor will meet a person before a rejection notice.",
        [
          lifeDetail(
            "The stuck queue bell",
            "bell",
            "A relay holds the call bell down. Number 081 has been called for eleven minutes. An empty chair has started to feel responsible.",
            "Release the bell contact",
            "One last chime sounds. Then the desk is quiet enough for people to hear each other.",
            "The bell rests. The number has moved to 082.",
          ),
          lifeDetail(
            "Forms for a lost person",
            "forms",
            "A form asks for proof that a memory existed before it was removed. Someone has circled the question and written: Please explain how.",
          ),
          lifeDetail(
            "The coat on the radiator",
            "coat",
            "A child\u2019s raincoat dries beside a clerk\u2019s uniform. Both sleeves are held up with the same large office clips. A small sock warms underneath.",
          ),
        ],
        ["Waiting visitor", "Which form says I do not have the form?", "Desk clerk", "None. Sit here. We will start with your name."],
        [
          lifeResident("Sen", "Late desk clerk", "read", "The public clock runs fast. The deadlines do not."),
          lifeResident("Lio", "Waiting visitor", "walk", "They sent me upstairs. Upstairs sent me here."),
        ],
      ),
      lifePlace(
        "Playback suite",
        "playback",
        "tape",
        "tile",
        "Tape hiss. A fan bearing. Light from behind thick glass.",
        "Two chairs face the recorder. Only the operator\u2019s chair has a padded seat. Old cable ties mark the other one\u2019s legs.",
        "The recovered minute sits outside the loop. The recorder can no longer hide it between repeat marks.",
        [
          lifeDetail(
            "The tired monitor speaker",
            "speaker",
            "A loose cable makes the monitor click at every breath. The fault sounds like hesitation, even when no person hesitated.",
            "Seat the monitor cable",
            "The false clicks stop. You leave the original recording unchanged.",
            "The speaker is clear. Only the source noise remains.",
          ),
          lifeDetail(
            "Wear on one chair",
            "chair",
            "The visitor\u2019s armrests are worn smooth at the ends. The operator\u2019s chair is worn on one side, where a person turns away to watch the clock.",
          ),
          lifeDetail(
            "A note under the glass",
            "forms",
            "A former operator wrote one instruction in ink: Let the subject finish. The printed guide has since been replaced twice. The ink remains.",
          ),
        ],
        [
          "Playback operator",
          "The machine can repeat a minute forever.",
          "Iven, through the glass",
          "We only need it to tell the whole minute once.",
        ],
        [
          lifeResident("Moss", "Playback operator", "read", "A quiet recording is not the same as a calm room."),
          lifeResident("Tia", "Equipment cleaner", "work", "I clean the glass from both sides."),
        ],
      ),
      lifePlace(
        "Unindexed stack",
        "archives",
        "archive",
        "concrete",
        "Dry paper. Roller bearings. A draft through closed drawers.",
        "The shelf labels end at the aisle entrance. Further in, dates and names have been added by hand, one drawer at a time.",
        "A complete sequence lies in the open tray. The archive still has gaps, but this one has edges now.",
        [
          lifeDetail(
            "The shelf lamp",
            "lamp",
            "A reading lamp points at a blank wall. Below it, someone has been sorting names by emergency light. The arm can still turn.",
            "Turn the lamp toward the index",
            "The handwritten index becomes readable. A sorting clerk moves a stack out of the shadow.",
            "The light falls on names, not concrete.",
          ),
          lifeDetail(
            "The return trolley",
            "cart",
            "Its wheels have flat spots. The same trolley brings files in and takes them out, but the shelves only record the first journey.",
          ),
          lifeDetail(
            "A drawer left for tomorrow",
            "drawer",
            "The last drawer is empty except for sharpened pencils and a clean sheet. Its label reads: Still here. Someone expects to need it again.",
          ),
        ],
        ["Sorting clerk", "Do we put the missing names before the dates?", "Archive runner", "Put them where you can find them tomorrow."],
        [
          lifeResident("Ora", "Sorting clerk", "read", "The blank dividers are not spare. We are waiting for names."),
          lifeResident("Fenn", "Archive runner", "walk", "Do not trust the wheel brake. I use the doorstop."),
        ],
      ),
    ],
    [
      lifePlace(
        "Room 404",
        "hotel",
        "hotel",
        "carpet",
        "A wall radio next door. Damp fabric. A tap that will not settle.",
        "The room is too neat around the open suitcase. One shoe sits under the bed. Its mate is in the case, ready to leave.",
        "The return label has an owner again. You leave the room\u2019s remaining possessions where their owner can find them.",
        [
          lifeDetail(
            "The leaking washstand",
            "basin",
            "The tap fills a cup with one drop at a time. A folded towel keeps the sound out of the hall. The handle is barely open.",
            "Close the tap fully",
            "The last drop settles. The room grows quiet enough to hear the neighbour\u2019s radio.",
            "The cup no longer overflows. You leave the towel to dry.",
          ),
          lifeDetail(
            "The unpaired shoe",
            "shoe",
            "Its sole has been repaired more carefully than its upper. There is fresh mud at the heel. The suitcase contains clothes for a trip, not a new life.",
          ),
          lifeDetail(
            "A view behind the blind",
            "window",
            "Through one broken slat, every room in the opposite block is the same size. The lamps inside are not. One window has a paper sun.",
          ),
        ],
        ["Voice through the wall", "Did they leave?", "Another voice", "The light is still on."],
        [
          lifeResident("Housekeeper", "Halcyon staff", "work", "I will wait outside. Take care with what is left."),
          lifeResident("Night porter", "Halcyon staff", "read", "The room is paid through morning. Nobody needs to hurry it."),
        ],
      ),
      lifePlace(
        "Service corridor",
        "corridor",
        "hotel",
        "carpet",
        "Old carpet. Lift cables. Someone reheats a small meal.",
        "A door opens the width of a chain. Further down the hall, slippers wait in pairs outside rooms that the register calls vacant.",
        "The neighbour opens the door a little wider. The corridor has not changed size. It feels less narrow.",
        [
          lifeDetail(
            "The missing name card",
            "mailbox",
            "A loose card lies below the letter slots. It reads 403 in a careful hand. The slot still carries a printed VACANT strip.",
            "Put the room card back",
            "The card covers the vacant label. The neighbour watches until your hands are clear of the slot.",
            "The slot says 403 again. A fresh envelope has been placed inside.",
          ),
          lifeDetail(
            "A kettle shared by three doors",
            "kettle",
            "Three cups sit beside a kettle. Each handle faces a different door. A cloth under its feet keeps the boiling sound from the floor below.",
          ),
          lifeDetail(
            "The lift inspection sticker",
            "notice",
            "The last three inspections carry the same signature. The first is in ink, the second is a copy, and the third is a copy of that copy.",
          ),
        ],
        ["Neighbour", "I heard steps, not a face.", "Porter", "That is more careful than most reports."],
        [
          lifeResident("Neighbour", "Room 403", "read", "Some doors open better when you stop knocking."),
          lifeResident("Rell", "Night porter", "walk", "Nobody here has a room with a view of tomorrow."),
        ],
      ),
      lifePlace(
        "Roof laundry",
        "laundry",
        "laundry",
        "wet",
        "Wet cotton. Loose line clips. A washer turning off balance.",
        "Sheets make narrow passages in the roof wind. The service lights show through them as pale squares. A sock turns on one last clip.",
        "The service route is clear. Clean sheets still hide it from the street below.",
        [
          lifeDetail(
            "The loose clothesline clip",
            "cloth",
            "A work shirt is about to leave the line. The owner has stitched a name inside its collar, then crossed it out without removing the thread.",
            "Secure the shirt with a spare clip",
            "The shirt stays on the line. Its owner will not have to choose between a wet uniform and no uniform.",
            "Two clips hold the shirt. It moves with the line, not away from it.",
          ),
          lifeDetail(
            "The washer\u2019s wooden foot",
            "washer",
            "A wooden block corrects the machine\u2019s uneven stance. The block came from a child\u2019s toy. Half a painted wheel shows beneath the rust.",
          ),
          lifeDetail(
            "A roof garden in soap tins",
            "plant",
            "Three tiny plants grow in soap tins. Their labels list watering turns by room number. Room 404 still has a turn next week.",
          ),
        ],
        ["Laundry worker", "That sheet has been clean three times tonight.", "Roof porter", "It keeps catching the city on the way down."],
        [
          lifeResident("Ana", "Laundry worker", "work", "The high line dries first. It also loses more shirts."),
          lifeResident("Kes", "Roof porter", "walk", "Follow the lights. The sheets do not know where you are going."),
        ],
      ),
    ],
    [
      lifePlace(
        "Vale\u2019s apartment",
        "apartment",
        "home",
        "wood",
        "Rain on glass. An old refrigerator. A neighbour\u2019s piano.",
        "Your key leaves the same mark in the tray. Tonight you notice that the tray has room for two keys.",
        "The recovered reflection does not make the room familiar. It makes its unfamiliar parts worth keeping.",
        [
          lifeDetail(
            "The lamp by the second seat",
            "lamp",
            "The shade points away from the empty seat. You cannot recall turning it. A pale ring marks where another cup used to stand.",
            "Turn the lamp toward the seat",
            "Warm light reaches the empty cushion. You have not answered who sat there. You have stopped hiding the question.",
            "Both seats share the light.",
          ),
          lifeDetail(
            "A shelf of repaired books",
            "books",
            "The same plain covers hide several different bindings. Your name is in three. Another hand has corrected a date in one, without signing it.",
          ),
          lifeDetail(
            "The spare key tray",
            "keys",
            "There is your key, a small screw, and a space polished by something that is gone. The space has no label. Neither does the key.",
          ),
        ],
        ["Neighbour, through the wall", "That last note is wrong.", "Vale", "I know. I keep expecting it anyway."],
        [
          lifeResident("Service unit", "Window cleaner", "work", "The outside glass is scheduled for a day without rain."),
          lifeResident("Delivery attendant", "Hall visitor", "read", "A parcel for this floor. The sender left no return name."),
        ],
      ),
      lifePlace(
        "Chemical darkroom",
        "darkroom",
        "darkroom",
        "tile",
        "Developer trays. Red light. One drip from the wash tank.",
        "A strip of photographs hangs from a line. Most show ordinary meals, ordinary windows, ordinary days. None looks ordinary tonight.",
        "The reflection is filed without filling its gaps. The photographs stay on the line until they are dry.",
        [
          lifeDetail(
            "The print at the tray edge",
            "photo",
            "A print curls above a dry corner of the tray. The curl threatens a face that is not part of your case. A clean clip lies beside it.",
            "Secure the print to the drying line",
            "The face will dry flat. You preserve the image without making it evidence.",
            "The print hangs safely between two landscapes.",
          ),
          lifeDetail(
            "A borrowed exposure guide",
            "notice",
            "Exposure settings cover a scrap of food packaging. Below them, someone has written: Red light is not a promise of privacy.",
          ),
          lifeDetail(
            "A jar of failed strips",
            "jar",
            "Discarded negatives fill a jar marked NO RECOVERY. Some frames contain too much light. Some contain nothing. Neither lets you invent what was there.",
          ),
        ],
        ["Darkroom worker", "Do you need that face for the case?", "Vale", "No. It still needs to dry."],
        [
          lifeResident("Ren", "Darkroom worker", "work", "Use the clean clips. The metal ones stain."),
          lifeResident("Paz", "Print collector", "read", "I keep the blurred ones too. They were days, not products."),
        ],
      ),
      lifePlace(
        "Fourth-floor landing",
        "landing",
        "home",
        "tile",
        "A kettle behind a door. The slow fan over the stairs.",
        "People have put chairs where the landing widens. A building designed for passing through has become a place to stay.",
        "The conversation ends without a verdict. A person keeps their seat, their space, and the right to stop talking.",
        [
          lifeDetail(
            "A chair in the dark",
            "lamp",
            "The stair lamp points at an empty notice frame. A reading chair stands outside its beam. Its owner has placed a book on the bright floor.",
            "Aim the lamp at the chair",
            "The book can leave the floor. The person reading it does not need to move.",
            "The reading chair has its own light.",
          ),
          lifeDetail(
            "A row of repaired slippers",
            "shoe",
            "Three pairs dry on a rail. Each repair uses thread from a different coat. The repairs tell you who shares a needle, not who owns the shoes.",
          ),
          lifeDetail(
            "The notice frame",
            "notice",
            "The frame once held a rule against leaving chairs in the corridor. It now holds the washing rota and a note about a missing cat. Nobody has signed the change.",
          ),
        ],
        ["Landing resident", "Are you testing me?", "Vale", "Not while you are trying to finish a cup of tea."],
        [
          lifeResident("Eli", "Fourth-floor resident", "sip", "A landing is a room if people keep sitting in it."),
          lifeResident("Jun", "Night cleaner", "walk", "Leave the chairs. I clean around them."),
        ],
      ),
    ],
    [
      lifePlace(
        "Moth arcade",
        "market",
        "market",
        "wet",
        "Solder smoke. Rain under shutters. Wings near a warm lamp.",
        "The stalls sell replacement parts beside living things. Every price tag is new. Almost nothing else is.",
        "Pell covers the stock list but leaves the service directory open. Trust here is offered one page at a time.",
        [
          lifeDetail(
            "The moth lamp\u2019s open guard",
            "moth",
            "A moth circles the hot part of a display lamp. Its protective mesh has slipped. The seller is busy counting change.",
            "Close the lamp guard",
            "The moth settles on the cool mesh. The lamp still draws it close, but no longer burns its wings.",
            "The moth rests outside the closed guard.",
          ),
          lifeDetail(
            "A box of unmatched buttons",
            "buttons",
            "Coat buttons are sorted by colour, not make. A hand-painted sign offers one free when yours is lost. Full sets cost extra.",
          ),
          lifeDetail(
            "The patched market canopy",
            "awning",
            "Every patch is a different shop\u2019s old sign. One advertises a product no longer legal to own. It now keeps rain off cabbages.",
          ),
        ],
        ["Pell", "New does not always mean unused.", "Market repairer", "And old does not mean finished."],
        [
          lifeResident("Uma", "Canopy repairer", "work", "That red patch used to sell sunny holidays."),
          lifeResident("Noll", "Parts collector", "walk", "I need a hinge. Not the door, just a future for it."),
        ],
      ),
      lifePlace(
        "Parts exchange",
        "parts",
        "workshop",
        "concrete",
        "Oil cloth. Small metal parts. The click of a sorting tray.",
        "The shelves look random until you notice the hand marks. The parts that break most often are within the easiest reach.",
        "The maker\u2019s mark connects the stock to its route. A clerk moves the suspect box away from the live cargo.",
        [
          lifeDetail(
            "The jammed parts drawer",
            "drawer",
            "A loose screw holds the drawer half open. Its contents are labelled for repairs the shop no longer sells. The tools still fit.",
            "Free the drawer runner",
            "The drawer closes without force. The parts remain in order, ready for the next old machine.",
            "The drawer moves freely. Nothing had to be replaced.",
          ),
          lifeDetail(
            "The exchange scale",
            "scale",
            "One pan holds metal washers. The other holds a paper promise. The balance is level. The clerk accepts either, but remembers both.",
          ),
          lifeDetail(
            "A wall of obsolete plugs",
            "cables",
            "Twenty connector types hang from hooks. Their makers all called them permanent standards. Someone has built a working adapter from four of them.",
          ),
        ],
        ["Exchange clerk", "What model is it for?", "Customer", "The one my mother still uses."],
        [
          lifeResident("Dara", "Exchange clerk", "work", "Describe the fault. The model number may not help."),
          lifeResident("Tov", "Repair customer", "read", "The maker stopped supporting it. My mother did not."),
        ],
      ),
      lifePlace(
        "Shipping cage",
        "warehouse",
        "freight",
        "concrete",
        "Packing straw. Chain hoists. A scanner looking for a code.",
        "Crates move in lanes painted decades apart. The newest arrows lead to a locked gate. The oldest lead around it.",
        "The reader clears the route. A porter starts moving the shipment by its contents, not its overwritten label.",
        [
          lifeDetail(
            "The loose packing latch",
            "crate",
            "A crate lid knocks in the draft. The contents are spare glass tubes, packed with strips of handwritten forms. Nothing needs to break here.",
            "Secure the crate latch",
            "The lid stops moving. A fragile shipment remains a shipment, rather than another claim form.",
            "The latch is closed. The glass inside is still whole.",
          ),
          lifeDetail(
            "The porter\u2019s tally",
            "chalk",
            "The tally records loads moved, then loads returned. The second column is longer. Under both, the porter has written their break time.",
          ),
          lifeDetail(
            "A rejected destination label",
            "labels",
            "A label says RETURN TO SENDER. Another covers the sender\u2019s address. The third label is blank. The parcel has travelled further than its description.",
          ),
        ],
        ["Porter", "That one came back again.", "Reader attendant", "Then let us ask where it was meant to go."],
        [
          lifeResident("Hesh", "Freight porter", "walk", "Hold the latch, not the label."),
          lifeResident("Miri", "Reader attendant", "read", "The scanner accepts the barcode. I still check the box."),
        ],
      ),
    ],
    [
      lifePlace(
        "Cold stores",
        "cold",
        "cold",
        "tile",
        "Cold metal. Insulation. The careful hum of protected memories.",
        "Nemi touches the outer case before checking its number. Frost hides the lower half of every label except the handwritten names.",
        "The storm schedule is copied. Nemi checks the locks once more, then allows herself to sit down.",
        [
          lifeDetail(
            "The blanket cart",
            "blanket",
            "A stack of thermal blankets waits just outside the patient area. The cart brake has not been set. Each compressor cycle rolls it away.",
            "Set the cart brake",
            "The cart stays within reach. The next patient will not need to ask someone else to bring warmth.",
            "The blankets stay beside the patient door.",
          ),
          lifeDetail(
            "Labels beneath the frost",
            "jar",
            "The storage code is printed. The names are written by hand. One label includes a spelling correction, and another includes a preferred name.",
          ),
          lifeDetail(
            "A birthday candle in storage",
            "candle",
            "A small candle stands in a sealed jar with a date and no year. The flame is not part of the memory. Someone kept it anyway.",
          ),
        ],
        ["Nemi", "Warm hands first. The instruments can wait.", "Assistant", "I have put the kettle on."],
        [
          lifeResident("Val", "Clinic assistant", "work", "Do not wipe a name with the solvent."),
          lifeResident("Patient escort", "Waiting relative", "sip", "They remembered my voice before they remembered the address."),
        ],
      ),
      lifePlace(
        "Response chamber",
        "response",
        "clinical",
        "tile",
        "Filtered air. A metronome. A chair facing too much light.",
        "The instruments are level. The patient\u2019s footrest is not. The only decoration faces the operator rather than the person answering.",
        "The report includes the conditions in the room. A number no longer stands in for the person who produced it.",
        [
          lifeDetail(
            "The harsh examination lamp",
            "examlight",
            "The lamp reflects in the response lens and the patient\u2019s eyes. Its dimmer is set to maximum, though the sensor has its own light.",
            "Lower the comfort light",
            "The glare falls. The sensor stays at its measured setting. Comfort need not change the record.",
            "The lamp is low. The calibrated sensor is untouched.",
          ),
          lifeDetail(
            "The fixed-speed metronome",
            "metronome",
            "A card calls the tick a neutral reference. A patient has written underneath: It sounds like the clock at my last job.",
          ),
          lifeDetail(
            "The water glass",
            "cup",
            "The water sits behind the instrument stand, outside the patient\u2019s reach. A paper coaster promises that participation is voluntary.",
          ),
        ],
        ["Clinic assistant", "The lens is steady.", "Patient", "Good. I am not."],
        [
          lifeResident("Response assistant", "Nemi clinic", "read", "A baseline needs conditions, not just a number."),
          lifeResident("Patient", "Waiting for a break", "sip", "Please leave the door where I can see it."),
        ],
      ),
      lifePlace(
        "Coolant floor",
        "coolant",
        "drains",
        "metal",
        "Pumps through the floor. Frost on bolts. A warm return line.",
        "The clinic above depends on this room. The people who service it have left more personal things here than the patients are allowed upstairs.",
        "The archive settles into a stable cycle. The shift worker takes a hand off the emergency stop.",
        [
          lifeDetail(
            "The worn pipe label",
            "valve",
            "Two pipes have almost identical colours. A clear return-flow label has peeled off one. The exposed glue still marks its place.",
            "Secure the return-flow label",
            "The flow direction can be read from the walkway. The worker will not need to check it by touch.",
            "The return line has a clear arrow again.",
          ),
          lifeDetail(
            "A heated lunch shelf",
            "lunch",
            "Lunch tins sit on an insulated shelf above the warm return. The shelf is a careful piece of metalwork. It is absent from the floor plan.",
          ),
          lifeDetail(
            "A shift note on a glove",
            "glove",
            "A spare glove carries three reminders in marker: Check the seal. Call home. Come home. Only the first has a tick.",
          ),
        ],
        ["Coolant worker", "The people upstairs call this background noise.", "Assistant", "That means you are doing it right."],
        [
          lifeResident("Bren", "Coolant worker", "work", "The warm line returns. The cold line supplies."),
          lifeResident("Hal", "Shift relief", "walk", "My tea is above the return. It is not a cooling sample."),
        ],
      ),
    ],
    [
      lifePlace(
        "Blue Hour floor",
        "club",
        "club",
        "wood",
        "A low bass note. Wet coats. Glasses cleared between songs.",
        "Lark holds a note until a conversation stops. The room gives her the silence. A server keeps moving, more softly now.",
        "The master deck is safe. The next song is not louder. People simply make more room to hear it.",
        [
          lifeDetail(
            "The unlit table lamp",
            "tablelamp",
            "A lamp at table four has a clean shade and a loose base contact. Its guest keeps turning their page toward the stage light.",
            "Seat the lamp base",
            "A small warm light returns to the table. The guest can read without borrowing the stage.",
            "Table four has light of its own.",
          ),
          lifeDetail(
            "The glass with no drink",
            "glass",
            "An empty glass stands on a reserved table. Its coaster holds a name. Nobody tries to sell the absent guest another drink.",
          ),
          lifeDetail(
            "The set list in pencil",
            "setlist",
            "The last song has been crossed out and restored more than once. Beside it, Lark has drawn a small open door.",
          ),
        ],
        ["Server", "Another song?", "Guest at table four", "Let her finish this one first."],
        [
          lifeResident("Ves", "Floor server", "walk", "I can clear the table without clearing your place."),
          lifeResident("Table-four guest", "Regular listener", "sip", "Some nights I come here for the space between songs."),
        ],
      ),
      lifePlace(
        "Backstage passage",
        "backstage",
        "backstage",
        "wood",
        "Powder. Warm cables. Music through a wall, minus its words.",
        "A mirror bulb is missing above the empty chair. A spare hangs beside it in a net bag. A costume repair waits under the same light.",
        "The dressing-room trace is recorded. The empty chair remains empty, but the route from it is no longer a guess.",
        [
          lifeDetail(
            "The missing mirror bulb",
            "mirror",
            "The socket is sound. The spare bulb is the correct type. Someone stopped the repair when the set began.",
            "Fit the spare bulb",
            "The mirror lights evenly. The repairer can see the last seam without leaning toward the stage door.",
            "All the bulbs work. The chair has not been moved.",
          ),
          lifeDetail(
            "The coat on the wrong peg",
            "coat",
            "A light raincoat hangs among heavy stage clothes. One sleeve is rolled with the care of someone who expects to wear it again soon.",
          ),
          lifeDetail(
            "A seam sewn in green",
            "thread",
            "The dark costume is repaired with green thread. Under stage light, it disappears. Under work light, the repair is easy to find.",
          ),
        ],
        ["Wardrobe repairer", "You only notice a good seam when it fails.", "Stage hand", "Same as a good exit."],
        [
          lifeResident("Mave", "Wardrobe repairer", "work", "Do not judge the thread until you see the light."),
          lifeResident("Stage hand", "Blue Hour crew", "walk", "Keep the cable side clear. People leave in a hurry."),
        ],
      ),
      lifePlace(
        "Sound booth",
        "studio",
        "studio",
        "wood",
        "Monitor hiss. Cooling electronics. The click before a live channel.",
        "The room hears the club differently. Without its echo, every voice is close. A handwritten label marks the channel that must stay open.",
        "The runner is through. The operator removes a hand from the mute switch and lets the room breathe again.",
        [
          lifeDetail(
            "The loose monitor lead",
            "speaker",
            "The left monitor drops out when the door moves. A cable has been pulled halfway from its locking socket.",
            "Lock the monitor connector",
            "Both monitors hold the same level. The operator hears the room without leaning to one side.",
            "The connector is locked. The door no longer changes the sound.",
          ),
          lifeDetail(
            "The engineer\u2019s little map",
            "map",
            "The board layout is drawn in grease pencil. Routes marked SAFE lead to the floor, backstage, and out. They are not all audio routes.",
          ),
          lifeDetail(
            "A reel labelled room tone",
            "tape",
            "Thirty seconds of an empty club fills the reel. You can hear the refrigerator, a chair, and a person taking one quiet breath.",
          ),
        ],
        ["Sound operator", "The quiet channel is live.", "Runner on the line", "Then keep it quiet until I am through."],
        [
          lifeResident("Tess", "Sound operator", "work", "A red light means someone else is trusting you."),
          lifeResident("Patch assistant", "Blue Hour crew", "read", "The tape box is not an ashtray. It says so twice."),
        ],
      ),
    ],
    [
      lifePlace(
        "Service bridge",
        "bridge",
        "wind",
        "metal",
        "Wind through mesh. Footsteps on steel. Water far below.",
        "The bridge moves just enough to notice. Small lamps mark places where a person can stop without blocking someone else.",
        "Ash reaches the hatch with the parcel intact. The shelter lamps remain lit for the next person behind you.",
        [
          lifeDetail(
            "The loose shelter shutter",
            "shutter",
            "Wind lifts the edge of a shelter panel. The catch is present, but a strip of torn weather seal holds it open.",
            "Close the shutter catch",
            "The panel stays shut. Inside the shelter, the wind falls from a howl to a low hum.",
            "The shutter holds. There is a dry place behind it.",
          ),
          lifeDetail(
            "Handprints on the rail",
            "rail",
            "Paint has worn off where people grip during the longest gust. The handprints overlap, high and low, without a single clear owner.",
          ),
          lifeDetail(
            "A dry matchbox",
            "tin",
            "A matchbox rests inside a sealed bolt tin. It contains no matches, only a folded shelter number. Someone found a safer use for it.",
          ),
        ],
        ["Bridge worker", "Three lamps to the next cover.", "Stranded commuter", "I count them every time."],
        [
          lifeResident("Siv", "Bridge worker", "work", "Stay inside the marked edge. The wind does not read it."),
          lifeResident("Noor", "Stranded commuter", "walk", "I missed the last crossing. I am trying to miss nothing else."),
        ],
      ),
      lifePlace(
        "Relay walk",
        "relay",
        "electrical",
        "metal",
        "A broken electrical rhythm. Rain off cable trays.",
        "The relay lamps flash out of step. A worker has marked the faulty housing with a bright cloth instead of another faded sticker.",
        "The recovered junction record identifies the safe line. The warning cloth can stay until a proper repair team arrives.",
        [
          lifeDetail(
            "The warning lamp\u2019s dirty cover",
            "lamp",
            "Salt and grime hide an amber warning lamp. Its lens is intact. A clean cloth hangs from the service hook.",
            "Clean the warning lens",
            "The amber warning reaches the next platform. You have made the fault visible, not made it safe.",
            "The warning is clear. The marked hazard still needs care.",
          ),
          lifeDetail(
            "The service crew\u2019s ruler",
            "ruler",
            "Gust limits and rail clearances share one metal strip. Beneath them is a child\u2019s height, recorded in a different unit.",
          ),
          lifeDetail(
            "A cable tied with cloth",
            "cables",
            "A cloth tie keeps a signal cable away from a sharp corner. Its knot is loose enough for the next worker to undo. The repair expects a future.",
          ),
        ],
        ["Relay worker", "That light warns. It does not protect.", "Vale", "I will treat it as a warning."],
        [
          lifeResident("Demi", "Relay worker", "work", "The red housing is live. The bright cloth is deliberate."),
          lifeResident("Weather observer", "Night shift", "read", "The official gust reading comes from a sheltered roof."),
        ],
      ),
      lifePlace(
        "Roof shelter",
        "shelter",
        "shelter",
        "concrete",
        "Rain on sheet metal. A blanket being shaken dry.",
        "A shallow roof covers a kettle, a bench, and a crate of spare gloves. Someone has swept the water toward the door.",
        "The crossing ends under the same little roof. Someone shifts along the bench without needing to be asked.",
        [
          lifeDetail(
            "The wet blanket edge",
            "blanket",
            "A blanket has slipped from its rack into the doorway. Most of it is still dry. A high rail stands above the drip line.",
            "Hang the blanket on the high rail",
            "The dry part stays dry. The next person gets a blanket, not a cold apology.",
            "The blanket hangs clear of the doorway.",
          ),
          lifeDetail(
            "The shelter kettle",
            "kettle",
            "The kettle is labelled WATER, then FOR ANYONE. A newer note says: Yes, that includes you. The switch has no payment slot.",
          ),
          lifeDetail(
            "The message on the beam",
            "chalk",
            "Someone wrote HOME THIS WAY with an arrow. Later hands added district names on both sides. There is more than one correct direction.",
          ),
        ],
        ["Shelter keeper", "You can sit. You do not have to explain.", "Ash, at the hatch", "That is a rare kind of room."],
        [
          lifeResident("Ira", "Shelter keeper", "sip", "The dry gloves are on the upper shelf."),
          lifeResident("Toll", "Crossing worker", "walk", "I check this shelter before I clock out."),
        ],
      ),
    ],
    [
      lifePlace(
        "Toy workshop",
        "toys",
        "toys",
        "wood",
        "Wood dust. Clockwork. A little motor that refuses to give up.",
        "A wooden bird bows before it turns. Sol waits for it to finish, as if interrupting would be rude.",
        "The old lift plans are in your casebook. Sol clears a space for another repair rather than another sale.",
        [
          lifeDetail(
            "The toy bird\u2019s winding key",
            "bird",
            "The bird stops halfway through a bow. Its spring is intact. The winding key sits under its stand with a label: Slowly, please.",
            "Wind the bird gently",
            "The bird completes its bow and takes three little steps. Sol watches it as if it did something new.",
            "The bird walks its short route, then bows again.",
          ),
          lifeDetail(
            "A box marked useful mistakes",
            "scraps",
            "A crooked wheel, a short axle, and a hand with six fingers fill the box. Sol has written possible new uses on each small bag.",
          ),
          lifeDetail(
            "The toy with no maker\u2019s mark",
            "toy",
            "A hand-built figure has mismatched arms and a face drawn twice. There is no serial number. Its owner has given it a name on the underside.",
          ),
        ],
        ["Sol", "It is not built to do much.", "Apprentice", "It does enough to make you wait for it."],
        [
          lifeResident("Pip", "Workshop apprentice", "work", "We keep the spare pieces. Sometimes they need each other."),
          lifeResident("Rho", "Repair customer", "read", "The little machine forgets its steps. Sol writes them back."),
        ],
      ),
      lifePlace(
        "Conservatory",
        "greenhouse",
        "garden",
        "tile",
        "Damp earth. Water on leaves. The tick of a borrowed heater.",
        "The tree reaches toward a pane patched with clear packaging. Its leaves make shadows no manufacturer specified.",
        "The service history records years of care. The tree is not proof of ownership. It is proof that people kept returning.",
        [
          lifeDetail(
            "The dry irrigation cup",
            "plant",
            "One feed cup has tipped away from its root tray. The watering line still works. A leaf below it has curled at the edge.",
            "Set the feed cup upright",
            "Water reaches the root tray again. A small surface tremor replaces the sound of drops on tile.",
            "The feed cup is full. The water goes where it is needed.",
          ),
          lifeDetail(
            "The growth marks on the beam",
            "ruler",
            "Pencil marks follow the highest leaf, not a child\u2019s head. Three people have measured the same tree in different handwriting.",
          ),
          lifeDetail(
            "The pollinator\u2019s open box",
            "moth",
            "A shallow box holds paper shelter tubes. One tiny pollinator works between the flowers and the open box. There is no lock.",
          ),
        ],
        ["Garden keeper", "It grew toward the repaired pane.", "Apprentice", "Maybe that is where the light got in."],
        [
          lifeResident("Elm", "Garden keeper", "work", "Do not polish the leaves. They are not plastic."),
          lifeResident("Wren", "Seed keeper", "read", "The label says common tree. It is the only one I know."),
        ],
      ),
      lifePlace(
        "Service lift shop",
        "lift",
        "workshop",
        "metal",
        "Machine oil. Soft wheels. A lift chain heard through brick.",
        "Old lift controls cover the bench. Sol\u2019s drawings include the person holding the door, not just the motor that moves it.",
        "The route is restored. The lift answers a call with a gentle bell instead of a grinding delay.",
        [
          lifeDetail(
            "The loose tool-rack latch",
            "tools",
            "A rack leans above the lift controls. The tools are secure, but the rack\u2019s latch is not. A matching pin waits on the bench.",
            "Fit the rack pin",
            "The rack sits firm. The worker removes the hand they had been using to hold it still.",
            "The tools stay within reach. The latch holds.",
          ),
          lifeDetail(
            "The hand-drawn lift map",
            "map",
            "The official plan shows floors. Sol\u2019s overlay shows thresholds, narrow corners, and where someone with a cane can rest.",
          ),
          lifeDetail(
            "The maintenance lunch clock",
            "clock",
            "The clock above the bench has two hands and a third mark cut into its rim. It marks the end of the shift, regardless of delayed repairs.",
          ),
        ],
        ["Lift worker", "The drawing shows a place to stop.", "Sol, from the workshop", "People are part of the load."],
        [
          lifeResident("Kit", "Lift worker", "work", "A working lift should not ask why you need it."),
          lifeResident("Tams", "Shift relief", "walk", "I am here. You can put the tools down."),
        ],
      ),
    ],
    [
      lifePlace(
        "Upper reception",
        "reception",
        "tower",
        "stone",
        "Filtered air. Soft shoes. Water that never touches the floor.",
        "The reception desk reflects you without a ripple. A cleaner follows a visitor\u2019s wet footprints before the visitor reaches the lift.",
        "The master archive is copied under the terms you chose. The desk remains polished. Its record is no longer spotless.",
        [
          lifeDetail(
            "The visitor\u2019s dead desk lamp",
            "tablelamp",
            "A lamp lights the consent form but not the reader\u2019s face. Its second bulb has been switched off at the base.",
            "Turn on the reader\u2019s light",
            "The whole page is visible without leaning over the desk. A visitor sits back into their chair.",
            "The form and the person reading it share the light.",
          ),
          lifeDetail(
            "A perfect artificial plant",
            "plant",
            "Every leaf is the same age. A cleaner has taped a tiny paper flower under one branch, below the height of the security camera.",
          ),
          lifeDetail(
            "The bottled-water receipt",
            "receipt",
            "Complimentary water appears on a line with a price and an offsetting credit. The building records generosity as an exact zero.",
          ),
        ],
        ["Reception clerk", "Would you like water?", "Waiting visitor", "Will I need to sign for it?"],
        [
          lifeResident("Aster clerk", "Upper reception", "read", "The form continues on the back. Please turn it over."),
          lifeResident("Floor attendant", "Contract cleaner", "work", "The building has drains. They prefer that I use a cloth."),
        ],
      ),
      lifePlace(
        "Archive vault",
        "vault",
        "vault",
        "stone",
        "A fan behind sealed panels. Paper moved with gloves.",
        "The vault is warmer than the public registry. Blank signatures sit in the same careful light as completed ones.",
        "The unsigned record stays unsigned. You preserve the absence instead of explaining it away.",
        [
          lifeDetail(
            "The covered review lamp",
            "lamp",
            "A dust cover blocks half the review lamp. One side of each consent sheet is harder to read. The cover is not meant to stay on during use.",
            "Remove the review cover",
            "Both sides of the desk receive equal light. The blank signature field remains blank.",
            "The full sheet is visible under the lamp.",
          ),
          lifeDetail(
            "The shelf of superseded terms",
            "books",
            "Each bound volume replaces the last. The old agreements remain here, while the people who signed them received only the new summary.",
          ),
          lifeDetail(
            "The ink blotter",
            "forms",
            "A dark mark repeats across the blotter. It is where a pen was placed before a signature, then placed there again without signing.",
          ),
        ],
        ["Vault clerk", "An unsigned sheet is incomplete.", "Review assistant", "Not as evidence."],
        [
          lifeResident("Vault clerk", "Records custodian", "read", "Please keep the page order. Even the blank pages."),
          lifeResident("Review assistant", "Night review", "work", "I was told to close the file. I was not told how to sign it."),
        ],
      ),
      lifePlace(
        "Security floor",
        "security",
        "security",
        "tile",
        "Relay clicks. Old coffee. A chair that has not been empty.",
        "Camera feeds divide the city into quiet rectangles. A guard has turned one monitor toward a photograph beside the desk.",
        "The private route is open. The guard stops watching the access light and checks the shelter feed instead.",
        [
          lifeDetail(
            "The loose break-room radio",
            "radio",
            "A radio keeps losing the shelter channel. Its aerial folds when the desk fan turns. The hinge will hold if its collar is tight.",
            "Tighten the aerial collar",
            "The shelter channel holds. The guard can hear the public update without leaving the desk.",
            "The radio stays tuned to the shelter feed.",
          ),
          lifeDetail(
            "The family photograph",
            "photo",
            "A guard and a child stand in ordinary rain. The child holds an umbrella over both faces, so neither appears in the photograph.",
          ),
          lifeDetail(
            "The break rota",
            "notice",
            "The rota gives every guard twelve minutes. Someone has placed two marks beside the same name. A colleague covered a break that the system did not record.",
          ),
        ],
        ["Night guard", "Which camera covers the shelter?", "Desk partner", "That one. I moved it nearer you."],
        [
          lifeResident("Night guard", "Security staff", "read", "The monitors show entrances. They rarely show what happens inside."),
          lifeResident("Desk partner", "Security staff", "sip", "The coffee is fresh. I stopped trusting the dispenser clock."),
        ],
      ),
    ],
    [
      lifePlace(
        "Weather Crown",
        "crown",
        "storm",
        "metal",
        "Wind against antenna wires. A city-sized electrical hum.",
        "Water leaves the platform sideways. Far below, window lights switch on one at a time. Each is smaller than the warning lamp beside you.",
        "The erasure carrier becomes a public record. The distant windows keep lighting up, unevenly and for their own reasons.",
        [
          lifeDetail(
            "The access beacon\u2019s shutter",
            "beacon",
            "A maintenance shutter covers half the access beacon. It protects the lamp during service, but the next crew needs the light now.",
            "Open the beacon shutter",
            "The amber guide reaches across the platform. The access route is visible between gusts.",
            "The beacon shines over the service approach.",
          ),
          lifeDetail(
            "The city through the mesh",
            "window",
            "The towers hide some blocks. Between them, kitchens and landings shine in small warm bands. The city is not one light. It is thousands of decisions.",
          ),
          lifeDetail(
            "The last crew\u2019s chalk line",
            "chalk",
            "The line marks the safe standing area for a lower wind rating. Someone has drawn a second line further in. The weather report on the wall was not updated.",
          ),
        ],
        ["Maintenance radio", "Keep one hand for the rail.", "Ori, over the line", "Keep the other for coming back."],
        [
          lifeResident("Crown technician", "Emergency crew", "work", "Watch the local warning, not yesterday\u2019s forecast."),
          lifeResident("Signal watcher", "Emergency crew", "read", "Every window down there has somebody behind it."),
        ],
      ),
      lifePlace(
        "Power gallery",
        "power",
        "electrical",
        "metal",
        "Transformer hum. A ventilation fan. Warm copper behind guards.",
        "The gallery has more warning labels than places to stand. A service worker has put a chair just outside the marked area.",
        "The hidden load is isolated in the record. The worker can distinguish the public carrier from the system it concealed.",
        [
          lifeDetail(
            "The fan\u2019s loose guard",
            "fan",
            "The guard rattles against its frame. The motor runs normally. A spring catch has not engaged after the last inspection.",
            "Close the guard catch",
            "The sharp rattle stops. Air still moves through the gallery at the same rate.",
            "The guard is secure. The fan runs with a low, even sound.",
          ),
          lifeDetail(
            "A chair outside the line",
            "chair",
            "The chair sits exactly beyond the hazard boundary. Its legs have worn four small marks in the paint. Rest has become a precise operation.",
          ),
          lifeDetail(
            "The borrowed test leads",
            "cables",
            "Each lead carries a different workshop mark. None came from this facility. The people maintaining the system have supplied part of it themselves.",
          ),
        ],
        ["Power worker", "That hum changed.", "Signal watcher", "Good. Now we can hear what it was carrying."],
        [
          lifeResident("Power worker", "Crown maintenance", "work", "The guard is for contact. The painted line is for people."),
          lifeResident("Relief engineer", "Crown maintenance", "read", "We need an honest load reading, not a quiet alarm."),
        ],
      ),
      lifePlace(
        "Cable span",
        "span",
        "storm",
        "metal",
        "Cable tension. Rain on steel. A signal finding its way out.",
        "Two cable paths share the span. Their labels differ by one letter. The worker who marked them also tied different knots below each tag.",
        "The carriers separate. The proof leaves without dragging the city\u2019s private lives into the open.",
        [
          lifeDetail(
            "The route tag in the wind",
            "labels",
            "The safe return tag has twisted behind its cable. A second tie can hold it toward the walkway without touching the live line.",
            "Secure the route tag",
            "The return arrow faces the walkway. The next person can read it from the safe side.",
            "The arrow stays visible in the gusts.",
          ),
          lifeDetail(
            "Knots below the cable labels",
            "cables",
            "One tag has a square knot, the other a loop. Someone planned for darkness, rain, and a reader who could not trust a printed letter.",
          ),
          lifeDetail(
            "A spare rescue loop",
            "rope",
            "A sealed loop hangs beside the exit. Its inspection mark is current. The hook below it is polished by hands that checked without taking it.",
          ),
        ],
        ["Span worker", "Read the tag before you touch anything.", "Vale", "The return arrow is clear now."],
        [
          lifeResident("Span worker", "Safety crew", "work", "One route carries the proof. Keep the other private."),
          lifeResident("Return watch", "Safety crew", "read", "I stay until the last person crosses."),
        ],
      ),
    ],
    [
      lifePlace(
        "Morning pier",
        "pier",
        "harbour",
        "wood",
        "Water under timber. Gulls. A coffee grinder starting late.",
        "The rain has stopped. A worker folds away the wet-weather sign and leaves the shelter chairs where they are.",
        "The paper feather is in your care. The next departure line forms behind you without knowing your case number.",
        [
          lifeDetail(
            "The folded wet-weather sign",
            "signboard",
            "The sign leans across the dry-side path. Its feet are wet, but the boards beyond are safe. There is a storage bracket on the rail.",
            "Put the sign in its bracket",
            "The path clears. People stop stepping into yesterday\u2019s puddle to avoid today\u2019s sign.",
            "The sign waits in its bracket for another rainy day.",
          ),
          lifeDetail(
            "The first clean reflection",
            "water",
            "The water now holds a whole window instead of a broken strip of light. A boat passes. The window breaks, then returns by itself.",
          ),
          lifeDetail(
            "The worker\u2019s drying gloves",
            "glove",
            "Two gloves hang from a coffee cart. The fingers point toward the sea. Their owner has written LEFT inside both cuffs.",
          ),
        ],
        ["Pier worker", "Dry enough to fold the sign away.", "Coffee seller", "Not dry enough to put the chairs away."],
        [
          lifeResident("Pier worker", "Morning shift", "work", "Mind the board by the rail. It remembers the rain."),
          lifeResident("Coffee seller", "Ferry concession", "sip", "The first pot is for people who have not slept."),
        ],
      ),
      lifePlace(
        "Ferry terminal",
        "terminal",
        "terminal",
        "tile",
        "Departure bells. Drying coats. Two cups on a ticket counter.",
        "The departure board lists places rather than service zones. A clerk stamps a ticket and lets the passenger keep the date.",
        "The passenger record can be read in order. The gate remains a place to leave, not another place to be tested.",
        [
          lifeDetail(
            "The ticket printer\u2019s torn strip",
            "ticket",
            "A torn strip blocks the waste slot, not the printing head. The clerk has been catching each ticket by hand.",
            "Clear the loose paper strip",
            "Tickets fall into the tray without tearing. The clerk has a free hand to point out the gate.",
            "The tray catches the tickets. The dates stay intact.",
          ),
          lifeDetail(
            "An unclaimed little case",
            "suitcase",
            "The case has a plain tag and a painted moon. The lost-property book describes the moon before the estimated price.",
          ),
          lifeDetail(
            "The board after the last warning",
            "clock",
            "The board has room for an alert. For once, the space is blank. A maintenance worker has cleaned the entire empty strip.",
          ),
        ],
        ["Ticket clerk", "Single journey?", "Passenger", "That will do for a start."],
        [
          lifeResident("May", "Ticket clerk", "work", "Keep the stub until you reach the other side."),
          lifeResident("Waiting passenger", "Morning crossing", "read", "It is strange to know where the next hour goes."),
        ],
      ),
      lifePlace(
        "Passenger cabin",
        "cabin",
        "ferry",
        "wood",
        "A low engine. Cups on a table. Water beyond the glass.",
        "The seats are worn near the windows. Two cups slide a little when the ferry moves. Their rings will not be kept as records.",
        "The custody record is closed. The cabin keeps its ordinary sounds. Not every silence needs an explanation.",
        [
          lifeDetail(
            "The loose window catch",
            "window",
            "The window vibrates against its catch. It is closed against spray, not locked. The lever has one more notch.",
            "Seat the window catch",
            "The rattle stops. Water and engine noise remain, with room between them for a conversation.",
            "The window holds. The city moves beyond it.",
          ),
          lifeDetail(
            "The two cup rings",
            "cup",
            "One ring is clear, the other half wiped away. Neither proves who sat here. Both show that someone had a place to put a drink.",
          ),
          lifeDetail(
            "A plain route on the wall",
            "map",
            "The route ends at another shore. No approved purpose is printed below it. The boat will take people who have not chosen one yet.",
          ),
        ],
        ["Ori", "Do we need to record this part?", "Vale", "No. We need to be here for it."],
        [
          lifeResident("Cabin attendant", "Morning ferry", "walk", "The window seats are free. There is no better class."),
          lifeResident("Early passenger", "Morning ferry", "sip", "I am going to let the coffee get cold for once."),
        ],
      ),
    ],
  ],
  ECHOES = [
    {
      from: "0:0:0",
      to: "3:0",
      text: "A message from Mara waits on your home terminal: The pot stayed quiet. I noticed. No invoice follows.",
    },
    {
      from: "0:2:0",
      to: "7:2",
      text: "A depot lamp now lights the spare gloves. The note on it says Ori brought it from a bay that finally has working lights.",
    },
    {
      from: "1:1:0",
      to: "5:1",
      text: "The clinic\u2019s monitor carries a new check label: Cable seated. Test the room before testing the person.",
    },
    {
      from: "2:1:0",
      to: "9:1",
      text: "Among the corrections is a hotel entry restoring room 403 to occupied. Someone has kept the handwritten card as support.",
    },
    {
      from: "4:0:0",
      to: "8:1",
      text: "A repaired mesh guard protects the conservatory lamp. Pell\u2019s service label says the idea came from a careful customer.",
    },
    {
      from: "6:0:0",
      to: "11:1",
      text: "A passenger folds a programme from the Blue Hour. A note on its edge reads: Table four. The light came back.",
    },
    {
      from: "7:2:0",
      to: "11:0",
      text: "A shelter worker carries a dry blanket to the morning boat. The high rail kept it clear of the last downpour.",
    },
    {
      from: "8:0:0",
      to: "11:2",
      text: "Sol\u2019s little bird is drawn on a parcel label. Beneath it: It finished the bow. Thank you for waiting.",
    },
    {
      from: "9:2:0",
      to: "11:0",
      text: "The shelter broadcast thanks the night desk for keeping its receiver open. You recognise the steady radio tone.",
    },
  ];
for (let r of SHOPS) {
  let e = residentsInRoom(r.room),
    t = {
      canopy: "umbrella",
      recall: "recorder",
      clinic: "examlight",
      birdhouse: "bird",
      arcade: "scale",
      travel: "ticket",
      shrine: "shrine",
      laundry: "valve",
      relay: "radio",
      print: "photo",
      transit: "clock",
      radio: "radio",
    },
    s = [
      lifeDetail(r.detail[0], t[r.id] || "notice", r.lore[1]),
      lifeDetail(r.detail[1], "notice", e[1].bio + " " + e[1].topics[0].text),
      lifeDetail(r.detail[2], "cup", e[2].bio + " " + e[2].topics[2].text),
    ];
  LIFE_PLACES[0].push(
    lifePlace(
      r.name,
      r.theme,
      r.sound,
      r.floor,
      r.senses,
      r.arrival,
      "The case moves on. This room keeps its ordinary work.",
      s,
      [e[1].name, e[1].topics[0].text, e[2].name, e[2].topics[0].text],
      e.slice(0, 2).map((i, n) => lifeResident(i.name, i.role, n ? "read" : "work", i.topics[2].text)),
    ),
  );
}
LIFE_PLACES.forEach((r, e) =>
  r.forEach((t, s) => {
    ((t.chapter = e), (t.room = s), (t.id = `${e}:${s}`), t.details.forEach((i, n) => (i.id = `${e}:${s}:${n}`)));
  }),
);
var newLife = () => ({ seen: [], changed: [], heard: [], arrivals: {} }),
  LIFE_PLACE_IDS = new Set(LIFE_PLACES.flat().map((r) => r.id)),
  LIFE_DETAIL_IDS = new Set(LIFE_PLACES.flat().flatMap((r) => r.details.map((e) => e.id))),
  LIFE_ACTION_IDS = new Set(LIFE_PLACES.flat().flatMap((r) => r.details.filter((e) => e.action).map((e) => e.id)));
function validateLife(r) {
  if (r === void 0) return newLife();
  if (!r || typeof r != "object" || Array.isArray(r)) return null;
  let e = newLife();
  for (let [t, s, i] of [
    ["seen", LIFE_DETAIL_IDS, LIFE_DETAIL_IDS.size],
    ["changed", LIFE_ACTION_IDS, LIFE_ACTION_IDS.size],
    ["heard", LIFE_PLACE_IDS, LIFE_PLACE_IDS.size],
  ]) {
    if (!Array.isArray(r[t]) || r[t].length > i || new Set(r[t]).size !== r[t].length || !r[t].every((n) => s.has(n))) return null;
    e[t] = r[t].slice();
  }
  if (e.changed.some((t) => !e.seen.includes(t)) || !r.arrivals || typeof r.arrivals != "object" || Array.isArray(r.arrivals)) return null;
  for (let [t, s] of Object.entries(r.arrivals)) {
    if (!LIFE_PLACE_IDS.has(t) || !Number.isInteger(s) || s < 1 || s > 1e5) return null;
    e.arrivals[t] = s;
  }
  return e;
}
function markSeen(r, e) {
  return LIFE_DETAIL_IDS.has(e) ? (r.life.seen.includes(e) || r.life.seen.push(e), !0) : !1;
}
function markChanged(r, e) {
  return !LIFE_ACTION_IDS.has(e) || r.life.changed.includes(e) ? !1 : (markSeen(r, e), r.life.changed.push(e), !0);
}
function markHeard(r, e) {
  return !LIFE_PLACE_IDS.has(e) || r.life.heard.includes(e) ? !1 : (r.life.heard.push(e), !0);
}
function countArrival(r, e) {
  return LIFE_PLACE_IDS.has(e) ? ((r.life.arrivals[e] = Math.min(1e5, (r.life.arrivals[e] || 0) + 1)), r.life.arrivals[e]) : 0;
}
function echoesFor(r, e) {
  return ECHOES.filter((t) => t.to === e && r.life.changed.includes(t.from)).map((t) => t.text);
}
function roomResolved(r, e, t) {
  let s = t[r.chapter].tasks.filter((i) => (i.room || 0) === e && !i.optional && i.kind !== "exit");
  return s.length > 0 && s.every((i) => r.done[`${r.chapter}:${i.id}`]);
}
function newCaseRecord() {
  return {
    room: 0,
    clues: [],
    deductions: [],
    progress: {},
    relationships: {},
    threads: {},
    skills: { analysis: 0, empathy: 0, fieldcraft: 0 },
    skillPoints: 1,
    heat: 0,
    stats: { mistakes: 0, observations: 0, topics: 0, operations: 0 },
    visited: [],
    sceneFrame: 0,
  };
}
function progressKey(r, e) {
  return `${r.chapter}:${typeof e == "string" ? e : e.id}`;
}
function taskProgress(r, e) {
  let t = progressKey(r, e);
  return (
    r.progress[t] ??
    (r.progress[t] = {
      found: [],
      topics: [],
      tiles: null,
      order: null,
      pressure: 24,
      round: 0,
      turn: 0,
      x: 0,
      z: 4,
      key: !1,
      alarm: 0,
      distance: 0,
      hits: 0,
      lane: 1,
      failures: 0,
    })
  );
}
function recordMistake(r, e = 5) {
  (r.stats.mistakes++, (r.focus = Math.max(0, r.focus - e)), (r.heat = Math.min(100, r.heat + 3)));
}
function inspectObservation(r, e, t, s) {
  if (!Number.isInteger(t) || !e.observations?.[t]) return { ok: !1, text: "Select a valid part of the object." };
  let i = e.observations[t],
    n = taskProgress(r, e);
  return n.found.includes(t)
    ? { ok: !0, repeated: !0, text: i.finding }
    : i.tool !== s
      ? (recordMistake(r, Math.max(1, 4 - r.skills.analysis)),
        {
          ok: !1,
          text: `${i.visible} This instrument cannot resolve the detail. Try ${i.tool === "uv" ? "UV light" : i.tool === "audio" ? "the audio probe" : "the lens"}.`,
        })
      : (n.found.push(t),
        r.stats.observations++,
        r.journal.push({ chapter: r.chapter, title: e.label + " / " + i.label, text: i.finding }),
        { ok: !0, text: i.finding });
}
function trainSkill(r, e) {
  if (!Object.hasOwn(r.skills, e)) return !1;
  let t = r.skills[e],
    s = t + 1;
  return t >= 3 || r.skillPoints < s ? !1 : ((r.skillPoints -= s), r.skills[e]++, !0);
}
function canAfford(r, e = {}) {
  return !(e.credits < 0 && r.credits < -e.credits);
}
function applyTaskOutcome(r, e, t = {}) {
  let s = taskProgress(r, e);
  if (
    (e.reward && !r.clues.includes(e.reward) && ["forensic", "challenge"].includes(e.kind) && r.clues.push(e.reward),
    e.kind === "deduction" && !r.deductions.includes(r.chapter) && (r.deductions.push(r.chapter), r.skillPoints++),
    e.kind === "challenge" && r.stats.operations++,
    e.person && (r.relationships[e.person] = (r.relationships[e.person] || 0) + (t.trust > 0 ? t.trust : 1)),
    e.kind === "thread")
  ) {
    let i = r.threads[e.thread] ?? (r.threads[e.thread] = []);
    i.some((n) => n.chapter === r.chapter) || i.push({ chapter: r.chapter, approach: t.threadApproach || "care" });
  }
  (e.optional && e.kind !== "side" && r.sides.push(e.label), (r.heat = Math.max(0, r.heat - (t.trust > 0 ? 4 : 1))), (s.finished = !0));
}
function rotateTile(r, e = 1) {
  for (let t = 0; t < e; t++) r = ((r << 1) & 15) | ((r >> 3) & 1);
  return r;
}
function circuitLayout(r = 0) {
  let t = [
      [0, 1, 5, 6, 10, 14, 15],
      [0, 4, 8, 9, 5, 6, 7, 11, 15],
      [0, 1, 2, 6, 5, 9, 13, 14, 15],
      [0, 4, 5, 1, 2, 3, 7, 6, 10, 11, 15],
    ][Math.floor(Math.abs(r) / 3) % 4],
    s = Array.from({ length: 16 }, (n, o) => (o % 3 ? 3 : 5));
  for (let n = 0; n < t.length; n++) {
    let o = t[n],
      a = n ? t[n - 1] : -1,
      l = n === t.length - 1 ? 16 : t[n + 1],
      c = (h, u) => (u === h - 4 ? 1 : u === h + 4 ? 4 : u === h - 1 ? 8 : 2);
    s[o] = c(o, a) | c(o, l);
  }
  return { tiles: s.map((n, o) => rotateTile(n, 1 + ((o + r) % 3))), solution: s, path: t };
}
function circuitPower(r) {
  if (!Array.isArray(r) || r.length !== 16 || !(r[0] & 8)) return { solved: !1, powered: [] };
  let e = new Set([0]),
    t = [0],
    s = [
      [-4, 1, 4],
      [1, 2, 8],
      [4, 4, 1],
      [-1, 8, 2],
    ];
  for (; t.length; ) {
    let i = t.shift();
    for (let [n, o, a] of s) {
      let l = i + n;
      l < 0 || l >= 16 || Math.abs((i % 4) - (l % 4)) > 1 || !(r[i] & o) || !(r[l] & a) || e.has(l) || (e.add(l), t.push(l));
    }
  }
  return { solved: e.has(15) && !!(r[15] & 2), powered: [...e] };
}
var STEALTH_COVER = [
    [1, 1],
    [1, 3],
    [3, 1],
    [5, 3],
    [5, 1],
  ],
  STEALTH_WALLS = [
    [2, 3],
    [4, 1],
  ];
function patrolPositions(r) {
  return [
    { x: [2, 3, 4, 5, 6, 5, 4, 3][r % 8], z: 0 },
    { x: 4, z: [2, 3, 4, 3][r % 4] },
  ];
}
function stealthMove(r, e, t, s) {
  let i = taskProgress(r, e),
    n = i.x + t,
    o = i.z + s;
  if (
    !Number.isInteger(t) ||
    !Number.isInteger(s) ||
    Math.abs(t) + Math.abs(s) > 1 ||
    n < 0 ||
    n > 6 ||
    o < 0 ||
    o > 4 ||
    STEALTH_WALLS.some((c) => c[0] === n && c[1] === o)
  )
    return { ok: !1 };
  ((i.x = n), (i.z = o), i.turn++, n === 3 && o === 2 && (i.key = !0));
  let l =
    !STEALTH_COVER.some((c) => c[0] === n && c[1] === o) &&
    patrolPositions(i.turn).some((c) => (c.z === o && Math.abs(c.x - n) <= 2) || (c.x === n && Math.abs(c.z - o) <= 1));
  return (
    (i.alarm = Math.max(0, Math.min(100, i.alarm + (l ? 32 - r.skills.fieldcraft * 4 : -9)))),
    i.alarm >= 100
      ? (i.failures++, recordMistake(r, 8), (i.x = 0), (i.z = 4), (i.turn = 0), (i.alarm = 0), (i.key = !1), { ok: !0, failed: !0 })
      : { ok: !0, seen: l, won: n === 6 && o === 0 && i.key }
  );
}
function timelineSolved(r) {
  return Array.isArray(r) && r.length === 4 && r.every((e, t) => e === t);
}
function interviewAnswer(r, e, t) {
  let s = taskProgress(r, e),
    i = { listen: -11 - r.skills.empathy * 2, clarify: 8 - r.skills.empathy * 2, press: 25 - r.skills.empathy * 2 };
  return Object.hasOwn(i, t)
    ? ((s.pressure = Math.max(0, Math.min(100, s.pressure + i[t]))),
      s.round++,
      { finished: s.round >= 4, pressure: s.pressure, trust: s.round >= 4 ? (s.pressure < 35 ? 2 : s.pressure < 70 ? 1 : 0) : 0 })
    : null;
}
function validateCaseRecord(r, e) {
  let t = newCaseRecord();
  if (r.version === 1) return t;
  if (
    !Number.isInteger(r.room) ||
    r.room < 0 ||
    r.room >= (e[r.chapter]?.rooms.length || 3) ||
    !Number.isInteger(r.skillPoints) ||
    r.skillPoints < 0 ||
    r.skillPoints > 200 ||
    !Number.isFinite(r.heat) ||
    r.heat < 0 ||
    r.heat > 100 ||
    !r.skills ||
    Object.keys(t.skills).some((a) => !Number.isInteger(r.skills[a]) || r.skills[a] < 0 || r.skills[a] > 3) ||
    !Array.isArray(r.clues) ||
    r.clues.length > 100 ||
    !r.clues.every((a) => typeof a == "string" && /^(trace|operation)-\d{1,2}$/.test(a)) ||
    !Array.isArray(r.deductions) ||
    r.deductions.length > 12 ||
    !r.deductions.every((a) => Number.isInteger(a) && a >= 0 && a < 12) ||
    !Array.isArray(r.visited) ||
    r.visited.length > 48 ||
    !r.visited.every(
      (a) =>
        typeof a == "string" &&
        /^(\d|1[01]):(\d|1[0-4])$/.test(a) &&
        Number(a.split(":")[1]) < (e[Number(a.split(":")[0])]?.rooms.length || 0),
    ) ||
    !r.progress ||
    typeof r.progress != "object" ||
    Array.isArray(r.progress) ||
    Object.keys(r.progress).length > 150
  )
    return null;
  let s = new Set(e.flatMap((a, l) => a.tasks.map((c) => `${l}:${c.id}`))),
    i = {};
  for (let [a, l] of Object.entries(r.progress)) {
    if (!s.has(a) || !l || typeof l != "object" || Array.isArray(l)) return null;
    let c = {};
    for (let h of ["found", "topics"]) {
      if (!Array.isArray(l[h]) || l[h].length > 16 || !l[h].every((u) => Number.isInteger(u) && u >= 0 && u < 20)) return null;
      c[h] = l[h].slice();
    }
    for (let h of ["tiles", "order"]) {
      if (
        l[h] !== null &&
        (!Array.isArray(l[h]) ||
          l[h].length !== (h === "tiles" ? 16 : 4) ||
          !l[h].every((u) => Number.isInteger(u) && u >= 0 && u < (h === "tiles" ? 16 : 4)) ||
          (h === "order" && new Set(l[h]).size !== 4))
      )
        return null;
      c[h] = l[h];
    }
    for (let h of ["pressure", "round", "turn", "x", "z", "alarm", "distance", "hits", "lane", "failures"]) {
      if (!Number.isFinite(l[h]) || l[h] < 0 || l[h] > 1e5) return null;
      c[h] = l[h];
    }
    if (
      ["round", "turn", "x", "z", "hits", "lane", "failures"].some((h) => !Number.isInteger(c[h])) ||
      c.x > 6 ||
      c.z > 4 ||
      c.round > 4 ||
      c.lane > 2 ||
      c.pressure > 100 ||
      c.alarm > 100 ||
      c.distance > 100 ||
      typeof l.key != "boolean"
    )
      return null;
    if (((c.key = l.key), l.finished !== void 0)) {
      if (typeof l.finished != "boolean") return null;
      c.finished = l.finished;
    }
    i[a] = c;
  }
  let n = {};
  if (!r.relationships || typeof r.relationships != "object" || Array.isArray(r.relationships)) return null;
  for (let [a, l] of Object.entries(r.relationships)) {
    if (!/^[a-z]{2,12}$/.test(a) || ["__proto__", "constructor", "prototype"].includes(a) || !Number.isInteger(l) || l < 0 || l > 100)
      return null;
    n[a] = l;
  }
  let o = {};
  if (!r.threads || typeof r.threads != "object" || Array.isArray(r.threads)) return null;
  for (let [a, l] of Object.entries(r.threads)) {
    if (
      !["clock", "names", "letter", "cup"].includes(a) ||
      !Array.isArray(l) ||
      l.length > 3 ||
      !l.every((c) => c && Number.isInteger(c.chapter) && c.chapter >= 0 && c.chapter < 12 && ["care", "record"].includes(c.approach))
    )
      return null;
    o[a] = l.map((c) => ({ chapter: c.chapter, approach: c.approach }));
  }
  return !r.stats || Object.keys(t.stats).some((a) => !Number.isInteger(r.stats[a]) || r.stats[a] < 0 || r.stats[a] > 1e5)
    ? null
    : {
        ...t,
        room: r.room,
        clues: [...r.clues],
        deductions: [...r.deductions],
        visited: [...r.visited],
        progress: i,
        relationships: n,
        threads: o,
        skills: Object.fromEntries(Object.keys(t.skills).map((a) => [a, r.skills[a]])),
        skillPoints: r.skillPoints,
        heat: r.heat,
        stats: Object.fromEntries(Object.keys(t.stats).map((a) => [a, r.stats[a]])),
      };
}
var newDistrict = () => ({
    version: 1,
    met: [],
    topics: {},
    quests: {},
    lore: [],
    relationships: {},
    reputation: { neighbors: 0, workers: 0, exchange: 0 },
    keepsakes: [],
    purchases: {},
    tracked: null,
    arrived: !1,
  }),
  RESIDENT_IDS = new Set(RESIDENTS.map((r) => r.id)),
  QUEST_IDS = new Set(LOCAL_QUESTS.map((r) => r.id)),
  LORE_IDS = new Set(CITY_LORE.map((r) => r.id)),
  KEEPSAKE_IDS = new Set(
    Object.values(LOCAL_GOODS)
      .map((r) => r.keepsake)
      .filter(Boolean),
  ),
  isPlainObject = (r) => !!r && typeof r == "object" && !Array.isArray(r),
  intIn = (r, e, t) => Number.isInteger(r) && r >= e && r <= t,
  uniqueIdList = (r, e, t) => Array.isArray(r) && r.length <= t && new Set(r).size === r.length && r.every((s) => typeof s == "string" && e.has(s));
function validateDistrict(r) {
  if (r === void 0) return newDistrict();
  if (
    !isPlainObject(r) ||
    r.version !== 1 ||
    !uniqueIdList(r.met, RESIDENT_IDS, 50) ||
    !uniqueIdList(r.lore, LORE_IDS, 30) ||
    !uniqueIdList(r.keepsakes, KEEPSAKE_IDS, 20) ||
    !isPlainObject(r.topics) ||
    !isPlainObject(r.quests) ||
    !isPlainObject(r.relationships) ||
    !isPlainObject(r.reputation) ||
    !isPlainObject(r.purchases) ||
    typeof r.arrived != "boolean" ||
    (r.tracked !== null && !QUEST_IDS.has(r.tracked))
  )
    return null;
  let e = newDistrict();
  ((e.met = r.met.slice()),
    (e.lore = r.lore.slice()),
    (e.keepsakes = r.keepsakes.slice()),
    (e.tracked = r.tracked),
    (e.arrived = r.arrived));
  for (let [t, s] of Object.entries(r.topics)) {
    if (
      !RESIDENT_IDS.has(t) ||
      !r.met.includes(t) ||
      !Array.isArray(s) ||
      s.length > 3 ||
      new Set(s).size !== s.length ||
      !s.every((i) => intIn(i, 0, 2))
    )
      return null;
    e.topics[t] = s.slice();
  }
  for (let [t, s] of Object.entries(r.relationships)) {
    if (!RESIDENT_IDS.has(t) || !intIn(s, 0, 100)) return null;
    e.relationships[t] = s;
  }
  for (let t of Object.keys(e.reputation)) {
    if (!intIn(r.reputation[t], 0, 100)) return null;
    e.reputation[t] = r.reputation[t];
  }
  for (let [t, s] of Object.entries(r.purchases)) {
    if (!Object.hasOwn(LOCAL_GOODS, t) || !intIn(s, 0, 1e4)) return null;
    e.purchases[t] = s;
  }
  for (let [t, s] of Object.entries(r.quests)) {
    let i = Object.hasOwn(QUEST_BY_ID, t) ? QUEST_BY_ID[t] : null;
    if (
      !i ||
      !isPlainObject(s) ||
      !intIn(s.stage, 1, 4) ||
      !uniqueIdList(s.witnesses, new Set(i.witnesses), i.witnesses.length) ||
      !intIn(s.mistakes, 0, 1e4) ||
      (s.choice !== null && !intIn(s.choice, 0, 1)) ||
      (s.stage >= 2 && s.witnesses.length !== i.witnesses.length) ||
      (s.stage === 4 && s.choice === null) ||
      (s.stage < 4 && s.choice !== null) ||
      !Array.isArray(s.dials) ||
      s.dials.length !== 3 ||
      !s.dials.every((n) => intIn(n, 0, 10)) ||
      !Array.isArray(s.order) ||
      s.order.length !== 4 ||
      new Set(s.order).size !== 4 ||
      !s.order.every((n) => intIn(n, 0, 3))
    )
      return null;
    if (i.kind === "circuit") {
      if (!Array.isArray(s.tiles) || s.tiles.length !== 16 || !s.tiles.every((n) => intIn(n, 0, 15))) return null;
    } else if (s.tiles !== null) return null;
    e.quests[t] = {
      stage: s.stage,
      witnesses: s.witnesses.slice(),
      mistakes: s.mistakes,
      choice: s.choice,
      dials: s.dials.slice(),
      order: s.order.slice(),
      tiles: s.tiles?.slice() || null,
    };
  }
  return e;
}
function meetResident(r, e) {
  if (!RESIDENT_IDS.has(e)) return !1;
  let t = r.district;
  return (t.met.includes(e) || t.met.push(e), (t.topics[e] ??= []), !0);
}
function hearResidentTopic(r, e, t) {
  if (!intIn(t, 0, 2) || !meetResident(r, e)) return !1;
  let s = r.district;
  return (s.topics[e].includes(t) || (s.topics[e].push(t), (s.relationships[e] = Math.min(100, (s.relationships[e] || 0) + 1))), !0);
}
function readLore(r, e) {
  return LORE_IDS.has(e) ? (r.district.lore.includes(e) || r.district.lore.push(e), !0) : !1;
}
function startQuest(r, e) {
  let t = Object.hasOwn(QUEST_BY_ID, e) ? QUEST_BY_ID[e] : null,
    s = r.district;
  return !t || r.chapter !== 0 || r.room !== RESIDENT_BY_ID[t.giver].room || s.quests[e]
    ? !1
    : ((s.quests[e] = {
        stage: 1,
        witnesses: [],
        mistakes: 0,
        choice: null,
        dials: [0, 0, 0],
        order: [2, 0, 3, 1],
        tiles: t.kind === "circuit" ? circuitLayout(t.seed).tiles : null,
      }),
      (s.tracked = e),
      meetResident(r, t.giver),
      !0);
}
function hearWitness(r, e, t) {
  let s = Object.hasOwn(QUEST_BY_ID, e) ? QUEST_BY_ID[e] : null,
    i = r.district.quests[e];
  return !s || !i || i.stage !== 1 || !s.witnesses.includes(t) || r.chapter !== 0 || r.room !== RESIDENT_BY_ID[t].room
    ? !1
    : (i.witnesses.includes(t) || i.witnesses.push(t), meetResident(r, t), i.witnesses.length === s.witnesses.length && (i.stage = 2), !0);
}
function testQuestDevice(r, e, t = null) {
  let s = Object.hasOwn(QUEST_BY_ID, e) ? QUEST_BY_ID[e] : null,
    i = r.district.quests[e];
  return !s || !i || i.stage !== 2 || r.chapter !== 0 || r.room !== s.room
    ? !1
    : (
          s.kind === "match" || s.kind === "tones"
            ? t === s.answer
            : s.kind === "dials"
              ? i.dials.every((o, a) => o === s.targets[a])
              : s.kind === "sequence"
                ? i.order.every((o, a) => o === a)
                : circuitPower(i.tiles).solved
        )
      ? ((i.stage = 3), !0)
      : ((i.mistakes = Math.min(1e4, i.mistakes + 1)), !1);
}
function resolveQuest(r, e, t) {
  let s = Object.hasOwn(QUEST_BY_ID, e) ? QUEST_BY_ID[e] : null,
    i = r.district.quests[e],
    n = r.district;
  if (!s || !i || i.stage !== 3 || !intIn(t, 0, 1) || r.chapter !== 0 || r.room !== RESIDENT_BY_ID[s.giver].room) return !1;
  ((i.stage = 4),
    (i.choice = t),
    (r.credits += s.reward),
    (r.xp += 10),
    (n.reputation[s.group] = Math.min(100, n.reputation[s.group] + 2)));
  let o = t === 0 ? "neighbors" : "workers";
  ((n.reputation[o] = Math.min(100, n.reputation[o] + 1)), (n.relationships[s.giver] = Math.min(100, (n.relationships[s.giver] || 0) + 2)));
  for (let a of s.witnesses) n.relationships[a] = Math.min(100, (n.relationships[a] || 0) + 1);
  return (n.tracked === e && (n.tracked = null), !0);
}
var hasPerk = (r, e) => LOCAL_QUESTS.some((t) => t.perk === e && r.district.quests[t.id]?.stage === 4),
  localPrice = (r, e) => Math.max(1, LOCAL_GOODS[e].price - (r.district.reputation.neighbors >= 8 ? 1 : 0));
function buyLocal(r, e) {
  let t = Object.hasOwn(LOCAL_GOODS, e) ? LOCAL_GOODS[e] : null;
  if (!t || r.chapter !== 0) return { ok: !1, reason: "This service is in the opening district." };
  if (!(r.room === 0 ? ["broth"] : SHOPS.find((i) => i.room === r.room)?.goods || []).includes(e))
    return { ok: !1, reason: "This item is sold at a different counter." };
  let s = localPrice(r, e);
  return r.credits < s
    ? { ok: !1, reason: "Not enough credits." }
    : (t.keepsake && r.district.keepsakes.includes(t.keepsake)) || (t.item && r.inventory.includes(t.item))
      ? { ok: !1, reason: "You already carry one." }
      : (t.heal && r.hp >= 100) || (t.focus && r.focus >= 100)
        ? { ok: !1, reason: "No service is needed yet." }
        : ((r.credits -= s),
          t.item && r.inventory.push(t.item),
          t.keepsake && r.district.keepsakes.push(t.keepsake),
          t.heal && (r.hp = Math.min(100, r.hp + t.heal)),
          t.focus && (r.focus = Math.min(100, r.focus + t.focus)),
          (r.district.purchases[e] = (r.district.purchases[e] || 0) + 1),
          { ok: !0, price: s });
}
function questNextStep(r, e) {
  let t = Object.hasOwn(QUEST_BY_ID, e) ? QUEST_BY_ID[e] : null,
    s = r.district.quests[e];
  if (!t) return null;
  if (!s || s.stage === 3) {
    let i = RESIDENT_BY_ID[t.giver];
    return { room: i.room, id: "resident-" + i.id, label: i.name };
  }
  if (s.stage === 1) {
    let i = RESIDENT_BY_ID[t.witnesses.find((n) => !s.witnesses.includes(n))];
    return { room: i.room, id: "resident-" + i.id, label: i.name };
  }
  return s.stage === 2 ? { room: t.room, id: "district-device-" + e, label: t.object } : null;
}
function districtTotals(r) {
  return {
    met: r.district.met.length,
    topics: Object.values(r.district.topics).reduce((e, t) => e + t.length, 0),
    quests: Object.values(r.district.quests).filter((e) => e.stage === 4).length,
    active: Object.values(r.district.quests).filter((e) => e.stage < 4).length,
    lore: r.district.lore.length,
  };
}
var ITEMS = {
    badge: ["Civic badge", "Opens civic terminals. It does not make you right.", "\u25C7"],
    scanner: ["Resonance scanner", "Q / SCAN reveals interaction points and the nearest objective.", "\u2301"],
    broth: ["Midnight broth", "Use from the casebook: restores 35 integrity. A little warmth goes a long way.", "\u2668"],
    ticket: ["Paper ferry ticket", "A ticket for two. The date was rubbed off on purpose.", "\u25B1"],
    reel: ["Unlabelled memory reel", "Carries a memory of sunlight nobody in this city has seen.", "\u25CE"],
    audit: ["Erasure audit", "Proof that the coming blackout is deliberate, not a malfunction.", "\u25A4"],
    photo: ["Conservatory photograph", "An artificial moth, reflected in a window. The hidden address is legible now.", "\u25A7"],
    moth: ["Glass moth", "A tiny memory carrier. Its wings open when somebody tells the truth.", "\u22C8"],
    coolant: ["Coolant cell", "Use from the casebook: restores 45 focus.", "\u25A5"],
    key: ["Service key", "Gets you through Aster service doors without setting off a second alarm.", "\u26BF"],
    song: ["Lark\u2019s master tape", "A melody that encodes the names of the disappeared.", "\u266B"],
    cargo: ["Borrowed childhood", "A waterproof parcel of memories, delivered intact or carefully repaired.", "\u25A3"],
    seed: ["Real seed", "The smallest thing here that was never manufactured. Raises your final legacy.", "\u274B"],
    plan: ["Antenna schematic", "Three relays, one city. The maintenance channels are 24 / 62 / 81.", "\u2318"],
    master: ["Master archive", "A record of every scheduled erasure, with the names protected.", "\u25A6"],
    receipt: ["Broadcast receipt", "The city heard you. It cannot be taken back.", "\u2197"],
    feather: ["Paper feather", "Not proof of a soul. Just proof that somebody stayed long enough to fold it.", "\u224B"],
  },
  caseTask = (r, e, t, s, i, n, o = {}) => ({ id: r, label: e, kind: t, x: s, z: i, text: n, ...o }),
  CASES = [
    {
      id: "last-orders",
      title: "Last orders",
      district: "LOWER RAINWARD",
      time: "23:48",
      template: "street",
      intro:
        "The city rents you a sky, then charges extra when it leaks. Tonight, a courier vanished carrying a memory that Aster Industries insists never existed. Your last bowl of noodles will have to wait.",
      objective: "Find the courier\u2019s dead drop.",
      end: "The dead drop yields a ferry ticket and a civic archive reference. You board the night cab. The case is yours now.",
      tasks: [
        caseTask(
          "mara",
          "Mara\u2019s night kitchen",
          "talk",
          -4,
          0,
          "Mara turns down the burner. \u201CYour courier left hungry. People running from something usually do.\u201D",
          {
            choices: [
              [
                "Ask what they were afraid of.",
                "\u201CNot dying. Being forgotten.\u201D She remembers a silver sleeve and a room number.",
                { trust: 1 },
              ],
              ["Show the badge.", "She gives you the same room number. The kettle fills the silence.", { credits: 3 }],
            ],
            reward: "badge",
          },
        ),
        caseTask(
          "drop",
          "Courier\u2019s dead drop",
          "inspect",
          3,
          -4,
          "Under the vending machine: a damp envelope. Two ferry seats, one civic file number, no return address.",
          { req: ["mara"], reward: "ticket" },
        ),
        caseTask(
          "ori",
          "Ori \xB7 night cab",
          "talk",
          6,
          3,
          "Ori waits beside a grounded cab. \u201CI drive. You decide who deserves to get home.\u201D",
          {
            req: ["drop"],
            choices: [
              ["We find the person, not just the package.", "Ori makes room on the passenger seat.", { trust: 1 }],
              ["We follow the evidence.", "\u201CThen let\u2019s hope the evidence has a conscience.\u201D", { xp: 10 }],
            ],
          },
        ),
        caseTask(
          "broth",
          "One for the road",
          "side",
          -6,
          4,
          "A delivery robot cannot reach its owner across the flooded curb. Take a bowl over while Mara packs your own.",
          { reward: "broth", trust: 1, side: "A warm delivery" },
        ),
        caseTask("exit", "Take the night cab", "exit", 9, 6, "Civic Archives", { req: ["mara", "drop", "ori"] }),
      ],
    },
    {
      id: "negative-space",
      title: "Negative space",
      district: "CIVIC ARCHIVES",
      time: "00:16",
      template: "station",
      intro:
        "No broken doors. No missing files. Just one interview that ends a minute before it begins. Archivist Iven has been staring at the timestamp for six hours.",
      objective: "Recover the minute somebody removed.",
      end: "The missing minute names Room 404 at the Halcyon. You leave with evidence of an erasure order and a very unsettled archivist.",
      tasks: [
        caseTask(
          "iven",
          "Archivist Iven",
          "talk",
          -5,
          -2,
          "\u201CThe subject laughed at a sad story. Then the machine marked me as the anomaly.\u201D",
          {
            choices: [
              ["Ask how Iven felt.", "\u201CRelieved. Somebody else thought the test was wrong.\u201D", { trust: 1 }],
              ["Ask for the raw recording.", "Iven stops explaining and unlocks the console.", { xp: 10 }],
            ],
          },
        ),
        caseTask("record", "Interview recorder", "tune", 0, -5, "Restore the lost carrier. The maintenance sticker reads 32 / 68 / 44.", {
          req: ["iven"],
          targets: [32, 68, 44],
          reward: "audit",
        }),
        caseTask(
          "registry",
          "Room registry",
          "inspect",
          6,
          -1,
          "The recovered minute is a request for shelter, not a threat. The courier gave one safe address: Halcyon, Room 404.",
          { req: ["record"], reward: "scanner" },
        ),
        caseTask(
          "names",
          "The unindexed names",
          "side",
          -6,
          5,
          "An entire drawer is labelled \u201Cclerical waste.\u201D Preserve the names before the nightly shred cycle.",
          { trust: 1, xp: 20, side: "Nobody is clerical waste" },
        ),
        caseTask("exit", "Return to the cab", "exit", 9, 6, "The Halcyon", { req: ["iven", "record", "registry"] }),
      ],
    },
    {
      id: "room-404",
      title: "Room 404",
      district: "THE HALCYON",
      time: "00:53",
      template: "hotel",
      intro:
        "A hotel for people between lives. Rain taps on the empty window frame. Someone has paid for this room through the end of the world: Friday.",
      objective: "Find what the courier left behind.",
      end: "You recover the memory reel. A frightened witness stays unreported. The reel needs the reader in your own apartment.",
      tasks: [
        caseTask(
          "room",
          "The open suitcase",
          "inspect",
          -5,
          -3,
          "No clothes. Just an empty cassette sleeve, a dry patch on the carpet, and a pressed flower. Whoever left was interrupted.",
        ),
        caseTask(
          "neighbor",
          "The quiet neighbour",
          "talk",
          5,
          -3,
          "A voice behind the door: \u201CThey came for the things she remembered. I kept the reel. I didn\u2019t know what else to do.\u201D",
          {
            req: ["room"],
            choices: [
              ["You do not have to open the door.", "A reel slides underneath. Trust does not need a face.", { trust: 2 }],
              ["Tell me exactly what happened.", "The voice gives a statement, then slides out the reel.", { xp: 15 }],
            ],
            reward: "reel",
          },
        ),
        caseTask(
          "label",
          "A scratched return label",
          "photo",
          0,
          3,
          "Find the mark the courier circled on the return label. Select the tile with the moth.",
          { req: ["neighbor"], target: 5, clue: "moth" },
        ),
        caseTask(
          "plant",
          "A thirsty windowsill",
          "side",
          -7,
          5,
          "A small plant is dying under a leaking roof. Move its pot into the rain. Someone will come back to a living room.",
          { trust: 1, side: "A living room" },
        ),
        caseTask("exit", "Head home", "exit", 9, 6, "Vale\u2019s Apartment", { req: ["room", "neighbor", "label"] }),
      ],
    },
    {
      id: "memory-leak",
      title: "Memory leak",
      district: "VALE\u2019S APARTMENT",
      time: "01:21",
      template: "apartment",
      intro:
        "Your apartment remembers you better than you remember it. There is an extra cup by the sink. You live alone. The reader wakes before you touch it.",
      objective: "Reconstruct the courier\u2019s last memory.",
      end: "The restored memory shows a glass moth from the Night Market. You pocket the photograph and leave your own unanswered questions behind.",
      tasks: [
        caseTask(
          "reader",
          "Memory reader",
          "tune",
          -5,
          -3,
          "Seat the reel and match the three damaged tracks. Your handwritten settings read 18 / 54 / 76.",
          { targets: [18, 54, 76] },
        ),
        caseTask(
          "image",
          "The window reflection",
          "photo",
          1,
          -4,
          "A face is missing from the photograph, but an object remains. Find the moth in the reflected window.",
          { req: ["reader"], target: 2, clue: "moth", reward: "photo" },
        ),
        caseTask(
          "ori",
          "Ori on the line",
          "talk",
          6,
          2,
          "\u201CThat cup on your counter,\u201D Ori says. \u201CWas it always there?\u201D The line crackles like a room full of secrets.",
          {
            req: ["image"],
            choices: [
              ["I do not know.", "\u201CNeither do I. That does not make this conversation less real.\u201D", { trust: 1 }],
              ["Stay focused on the case.", "Ori sends the market coordinates without another question.", { xp: 10 }],
            ],
          },
        ),
        caseTask(
          "piano",
          "An unfinished melody",
          "side",
          -6,
          5,
          "The player piano knows a tune your hands do not. Let it finish. On the last note, you remember the smell of wet grass.",
          { trust: 1, xp: 15, side: "The extra cup" },
        ),
        caseTask("exit", "Follow the glass moth", "exit", 9, 6, "The Night Market", { req: ["reader", "image", "ori"] }),
      ],
    },
    {
      id: "small-print",
      title: "The small print",
      district: "NIGHT MARKET",
      time: "01:54",
      template: "market",
      intro:
        "Real animals cost more than apartments. Artificial ones cost more if they believe you love them. A moth seller offers you a discount for looking unhappy.",
      objective: "Trace the moth\u2019s manufacturer.",
      end: "The moth opens its glass wings. The maker\u2019s mark leads to the Cold Room, where an old technician keeps other people\u2019s secrets on ice.",
      tasks: [
        caseTask(
          "seller",
          "The moth seller",
          "talk",
          -5,
          -1,
          "\u201CA pet is just a memory that eats. This one remembers for you.\u201D The seller recognizes your photograph.",
          {
            choices: [
              ["Trade the photograph\u2019s story.", "A good story buys more here than a civic salary.", { trust: 1 }],
              ["Pay for a professional opinion.", "Five credits later, the seller is impressively professional.", { credits: -5 }],
            ],
            reward: "moth",
          },
        ),
        caseTask(
          "serial",
          "Read the maker\u2019s mark",
          "tune",
          1,
          -5,
          "The wing veins carry three wavelengths. The etched numbers are 41 / 23 / 87.",
          { req: ["seller"], targets: [41, 23, 87] },
        ),
        caseTask(
          "map",
          "The service directory",
          "inspect",
          6,
          1,
          "The serial belongs to Nemi, a memory prosthetist. Her workshop is listed as a refrigeration business. Efficient camouflage.",
          { req: ["serial"] },
        ),
        caseTask(
          "battery",
          "A tired street cleaner",
          "side",
          -6,
          5,
          "A municipal cleaner has one minute of battery and a hundred metres of street. Give it your spare charge; its grateful bow is entirely unnecessary.",
          { focus: -10, reward: "coolant", trust: 1, side: "Unnecessary kindness" },
        ),
        caseTask("exit", "Visit the Cold Room", "exit", 9, 6, "Nemi\u2019s Cold Room", { req: ["seller", "serial", "map"] }),
      ],
    },
    {
      id: "cold-comfort",
      title: "Cold comfort",
      district: "THE COLD ROOM",
      time: "02:26",
      template: "lab",
      intro:
        "The freezer holds no food. Each softly lit jar contains a moment somebody could not bear to lose. Nemi wears three coats and still shivers.",
      objective: "Learn what Aster is planning.",
      end: "The evidence reveals the coming storm will erase unlicensed memories. A singer named Lark has a master tape. Nemi sends you to the Blue Hour.",
      tasks: [
        caseTask(
          "nemi",
          "Nemi \xB7 memory prosthetist",
          "talk",
          -5,
          -2,
          "\u201CThey sell us four years of warranty, then call the rest a defect. These people are not broken. Their contract is.\u201D",
          {
            choices: [
              ["Ask whose memories she protects.", "\u201CAnyone who knocks.\u201D She gives you a service key.", { trust: 1 }],
              ["Ask how to stop the erasure.", "\u201CA broadcast. A public record. Something too many people know.\u201D", { xp: 15 }],
            ],
            reward: "key",
          },
        ),
        caseTask(
          "cool",
          "Stabilise the archive",
          "tune",
          1,
          -5,
          "The cooling control is drifting. Nemi points to the service card: 27 / 73 / 51.",
          { req: ["nemi"], targets: [27, 73, 51] },
        ),
        caseTask(
          "list",
          "The storm schedule",
          "inspect",
          6,
          1,
          "At 04:00, Aster will overwrite the city\u2019s unlicensed citizens through the weather relay. Lark\u2019s song carries the affected names.",
          { req: ["cool"] },
        ),
        caseTask(
          "jar",
          "One last birthday",
          "side",
          -6,
          5,
          "A jar is labelled \u201CDad, before he forgot me.\u201D Move it to the emergency cabinet. Nemi pretends to adjust her glasses.",
          { trust: 2, side: "Cold storage, warm memory" },
        ),
        caseTask("exit", "Find Lark", "exit", 9, 6, "The Blue Hour", { req: ["nemi", "cool", "list"] }),
      ],
    },
    {
      id: "blue-hour",
      title: "Blue hour",
      district: "THE BLUE HOUR",
      time: "02:58",
      template: "club",
      intro:
        "The club is closed. The audience has not left. People sit in darkness listening to a singer rehearse the names of everyone who might disappear.",
      objective: "Get Lark\u2019s master tape out safely.",
      end: "Lark entrusts you with the master tape. Her runner takes the exposed route with a decoy while you follow to keep them alive.",
      tasks: [
        caseTask(
          "lark",
          "Lark \xB7 the last set",
          "talk",
          -3,
          -2,
          "\u201CA list can be deleted. A song gets stuck in your head.\u201D Lark asks whether you came to stop the music.",
          {
            choices: [
              ["Ask her to sing one name.", "She sings her own. The room holds its breath.", { trust: 2 }],
              ["Show Nemi\u2019s service key.", "Lark recognizes the ribbon tied around it and nods.", { xp: 15 }],
            ],
          },
        ),
        caseTask("deck", "The master deck", "tune", 3, -5, "The tape deck has three channels. On the set list: 36 / 64 / 82.", {
          req: ["lark"],
          targets: [36, 64, 82],
          reward: "song",
        }),
        caseTask(
          "ash",
          "Ash \xB7 the runner",
          "talk",
          6,
          2,
          "\u201CThey will follow the parcel. I can be faster than their paperwork.\u201D Ash has already put on the coat.",
          {
            req: ["deck"],
            choices: [
              ["Nobody runs alone.", "\u201CTry to keep up, then.\u201D", { trust: 1 }],
              ["Take the covered route.", "Ash marks three safe relay boxes on your scanner.", { focus: 15 }],
            ],
          },
        ),
        caseTask(
          "lights",
          "One more encore",
          "side",
          -6,
          5,
          "Restore the audience lights. They have been afraid to look at one another. Now they can.",
          { trust: 1, side: "An audience, not a list" },
        ),
        caseTask("exit", "Follow Ash to the roofs", "exit", 9, 6, "The Service Roofs", { req: ["lark", "deck", "ash"] }),
      ],
    },
    {
      id: "rain-run",
      title: "Running on rain",
      district: "SERVICE ROOFS",
      time: "03:13",
      template: "roof",
      hazards: !0,
      intro:
        "The roofs are a second city, built for cables and people who cannot use the front door. Ahead, Ash vanishes behind a curtain of sparks.",
      objective: "Cross the live roof and recover the parcel.",
      end: "Ash reaches shelter and the parcel is recovered. Its return address belongs to Sol, a toy maker with an unusual greenhouse.",
      tasks: [
        caseTask(
          "relay1",
          "First shelter",
          "inspect",
          -6,
          -2,
          "The first junction is safe. Electrical pools pulse before they discharge. Wait for the light to fade; dash through with SHIFT or DASH.",
        ),
        caseTask(
          "relay2",
          "Second shelter",
          "inspect",
          1,
          -6,
          "Ash dropped the decoy under this relay. The real parcel was inside the lining all along.",
          { req: ["relay1"], reward: "cargo" },
        ),
        caseTask(
          "ash",
          "Ash at the hatch",
          "talk",
          7,
          0,
          "\u201CI was carrying a childhood,\u201D Ash says. \u201CI kept thinking it should be heavier.\u201D",
          {
            req: ["relay2"],
            choices: [
              ["Help Ash down before checking the parcel.", "You both reach the hatch. The parcel can wait a second.", { trust: 2 }],
              ["Secure the parcel, then the hatch.", "You check the seal twice. Ash keeps an eye on the storm.", { xp: 20 }],
            ],
          },
        ),
        caseTask(
          "signal",
          "Stranded maintenance drone",
          "side",
          -7,
          5,
          "A little drone spins against a snagged cable. Free it. It projects a grateful smile someone bothered to program.",
          { trust: 1, focus: 20, side: "A smile in the firmware" },
        ),
        caseTask("exit", "Descend to Sol\u2019s workshop", "exit", 9, 6, "The Glasshouse", { req: ["relay1", "relay2", "ash"] }),
      ],
    },
    {
      id: "small-miracles",
      title: "Small miracles",
      district: "THE GLASSHOUSE",
      time: "03:29",
      template: "workshop",
      intro:
        "Sol lives among toys that pretend not to watch you. Above them, a real tree grows through the roof. The city forgot to tell it this was impossible.",
      objective: "Find a way into Aster\u2019s archive.",
      end: "Sol restores the parcel and provides a maintenance route into Aster. You take the antenna schematic; the little toys stand aside to let you pass.",
      tasks: [
        caseTask(
          "sol",
          "Sol \xB7 maker of small things",
          "talk",
          -5,
          -2,
          "\u201CI give them personalities so I won\u2019t be lonely. Then I feel guilty switching them off. A design problem.\u201D",
          {
            choices: [
              ["Maybe that is the part you got right.", "Sol smiles at something over your shoulder. A toy smiles back.", { trust: 2 }],
              ["Ask about the service entrance.", "\u201CStraight to business. The tree does that too.\u201D", { xp: 15 }],
            ],
          },
        ),
        caseTask(
          "repair",
          "Repair the parcel",
          "tune",
          1,
          -5,
          "Rejoin the three damaged memory tracks. Sol\u2019s pencil marks read 22 / 57 / 79.",
          { req: ["sol"], targets: [22, 57, 79] },
        ),
        caseTask(
          "plans",
          "The old maintenance plans",
          "inspect",
          6,
          1,
          "Sol helped build the antenna. Three relays can turn a private erasure into a public broadcast. Channels: 24 / 62 / 81.",
          { req: ["repair"], reward: "plan" },
        ),
        caseTask(
          "seed",
          "Something never manufactured",
          "side",
          -6,
          5,
          "Sol offers you a seed from the tree. \u201CNo warranty. No owner. It might not grow.\u201D Take the risk.",
          { reward: "seed", trust: 1, side: "An unlicensed future" },
        ),
        caseTask("exit", "Enter Aster Industries", "exit", 9, 6, "Aster Central Archive", { req: ["sol", "repair", "plans"] }),
      ],
    },
    {
      id: "terms-of-service",
      title: "Terms of service",
      district: "ASTER CENTRAL ARCHIVE",
      time: "03:43",
      template: "tower",
      intro:
        "Above the clouds, the storm is just a line on a dashboard. Director Venn calls the coming erasure \u201Ca necessary correction.\u201D His office has no photographs.",
      objective: "Secure the evidence without exposing its subjects.",
      end: "The master archive is copied. The erasure system locks you out but cannot recall the copy. You take the service lift to the antenna.",
      tasks: [
        caseTask(
          "venn",
          "Director Venn",
          "talk",
          -5,
          -2,
          "\u201CA memory is licensed infrastructure. The city cannot function if everyone decides what belongs to them.\u201D",
          {
            choices: [
              ["Ask who owns his first memory.", "For once, Venn has no prepared answer.", { trust: 1 }],
              ["Keep him talking while the reader works.", "The scanner quietly copies the access handshake.", { focus: 20 }],
            ],
          },
        ),
        caseTask("terminal", "The consent ledger", "photo", 1, -5, "Find the only unsigned consent record. It is marked with an open circle.", {
          req: ["venn"],
          target: 6,
          clue: "circle",
        }),
        caseTask(
          "archive",
          "Copy the master archive",
          "talk",
          6,
          1,
          "The record includes every citizen\u2019s private memories. Evidence and exposure are one switch apart.",
          {
            req: ["terminal"],
            reward: "master",
            choices: [
              [
                "Copy the proof; redact private memories.",
                "The broadcast will expose Aster without exposing its victims.",
                { trust: 3, flag: "redacted" },
              ],
              [
                "Copy everything into an encrypted escrow.",
                "The full record survives under a key only Ori holds.",
                { xp: 25, flag: "escrow" },
              ],
            ],
          },
        ),
        caseTask(
          "worker",
          "The security clerk",
          "side",
          -6,
          5,
          "A clerk quietly asks whether the storm will affect her son. Give her the protected shelter frequency. She leaves her badge on the desk.",
          { trust: 2, side: "After office hours" },
        ),
        caseTask("exit", "Take the service lift", "exit", 9, 6, "The Weather Crown", { req: ["venn", "terminal", "archive"] }),
      ],
    },
    {
      id: "borrowed-weather",
      title: "Borrowed weather",
      district: "THE WEATHER CROWN",
      time: "03:57",
      template: "storm",
      hazards: !0,
      intro:
        "There is no ceiling left. Just the storm, three relay housings, and the whole city waiting below. Ori\u2019s voice arrives in fragments: \u201CStill\u2026 with you.\u201D",
      objective: "Turn the erasure signal into a broadcast.",
      end: "The three relays align. The proof and the names cross the city in a burst of borrowed weather. Dawn arrives without the erasure.",
      tasks: [
        caseTask(
          "west",
          "West relay",
          "tune",
          -6,
          -3,
          "Sol\u2019s antenna schematic specifies 24 / 62 / 81. Lock the west carrier between electrical pulses.",
          { targets: [24, 62, 81] },
        ),
        caseTask(
          "east",
          "East relay",
          "inspect",
          6,
          -4,
          "You bridge the relay with the service key. Below, windows begin to light up in uneven little constellations.",
          { req: ["west"] },
        ),
        caseTask(
          "broadcast",
          "Broadcast console",
          "talk",
          0,
          2,
          "The city is listening. One sentence before the evidence goes out. What do you say?",
          {
            req: ["east"],
            reward: "receipt",
            choices: [
              [
                "These lives belong to the people living them.",
                "The statement travels with the proof. Nobody gets erased tonight.",
                { trust: 2, flag: "voices" },
              ],
              [
                "Here is the evidence. Judge for yourselves.",
                "The record travels without a verdict. Nobody gets erased tonight.",
                { xp: 25, flag: "evidence" },
              ],
            ],
          },
        ),
        caseTask(
          "beacon",
          "Ori\u2019s failing beacon",
          "side",
          -7,
          5,
          "Antenna overload has knocked the cab\u2019s beacon out. Shunt power through your scanner and guide Ori to a safe landing.",
          { focus: -20, trust: 2, side: "Someone to come home to" },
        ),
        caseTask("exit", "Leave the antenna", "exit", 9, 6, "The Morning Ferry", { req: ["west", "east", "broadcast"] }),
      ],
    },
    {
      id: "rain-check",
      title: "A rain check",
      district: "MORNING FERRY",
      time: "05:08",
      template: "dock",
      intro:
        "The rain has stopped. Nobody seems to know what to do with their hands. At the ferry gate, Ori holds two coffees and a ticket with the date rubbed off.",
      objective: "Choose what to carry into the morning.",
      end: "The ferry leaves the city. The ticket was always for two. What comes after is not licensed, recorded, or guaranteed. It is yours.",
      tasks: [
        caseTask(
          "radio",
          "The morning transmission",
          "inspect",
          -5,
          -2,
          "Aster\u2019s erasure programme is public. Shelter doors are open. Someone has begun reading the missing names on every frequency.",
        ),
        caseTask(
          "ori",
          "Ori at the gate",
          "talk",
          2,
          -4,
          "\u201CWe can keep the reel,\u201D Ori says. \u201COr let its owner decide. Either way, I already paid for the coffee.\u201D",
          {
            req: ["radio"],
            choices: [
              [
                "Return the memory to its owner.",
                "You keep the case notes, not somebody else\u2019s childhood.",
                { trust: 2, flag: "returned" },
              ],
              ["Keep a sealed copy until they are safe.", "You promise to be a custodian, never an owner.", { xp: 20, flag: "custodian" }],
            ],
          },
        ),
        caseTask(
          "feather",
          "A folded paper feather",
          "inspect",
          6,
          1,
          "On the bench: a paper feather, creased by careful hands. There is no message. For once, you do not need one.",
          { req: ["ori"], reward: "feather" },
        ),
        caseTask(
          "coffee",
          "Pay a little forward",
          "side",
          -6,
          5,
          "The next passenger is counting small coins. Buy their coffee. It is not evidence. It is just a good thing to do.",
          { credits: -3, trust: 1, side: "One for the next person" },
        ),
        caseTask("exit", "Board the morning ferry", "exit", 9, 6, "The other side of the rain", { req: ["radio", "ori", "feather"] }),
      ],
    },
  ];
expandCases(CASES, ITEMS);
var SAVE_KEY = "rain-check-save-v2";
function newGame() {
  return {
    version: 2,
    chapter: 0,
    done: {},
    inventory: ["scanner"],
    trust: 0,
    credits: 18,
    xp: 0,
    hp: 100,
    focus: 100,
    flags: [],
    journal: [],
    sides: [],
    failures: 0,
    ended: !1,
    position: null,
    ...newCaseRecord(),
    life: newLife(),
    district: newDistrict(),
  };
}
function validateSave(r) {
  if (!r || ![1, 2].includes(r.version) || !Number.isInteger(r.chapter) || r.chapter < 0 || r.chapter >= CASES.length) return null;
  let e = newGame();
  for (let a of ["trust", "credits", "xp", "hp", "focus", "failures"])
    if (typeof r[a] != "number" || !Number.isFinite(r[a]) || r[a] < 0 || r[a] > 1e7) return null;
  for (let a of ["inventory", "flags", "journal", "sides"]) if (!Array.isArray(r[a]) || r[a].length > 1e3) return null;
  if (
    !r.inventory.every((a) => typeof a == "string" && Object.hasOwn(ITEMS, a)) ||
    !r.flags.every((a) => typeof a == "string" && a.length < 64) ||
    !r.sides.every((a) => typeof a == "string" && a.length < 150) ||
    !r.journal.every(
      (a) =>
        a &&
        Number.isInteger(a.chapter) &&
        a.chapter >= 0 &&
        a.chapter < 12 &&
        typeof a.title == "string" &&
        a.title.length < 200 &&
        typeof a.text == "string" &&
        a.text.length < 5e3,
    ) ||
    !r.done ||
    typeof r.done != "object" ||
    Array.isArray(r.done)
  )
    return null;
  let t = new Set(CASES.flatMap((a, l) => a.tasks.map((c) => `${l}:${c.id}`)));
  if (
    Object.entries(r.done).some(([a, l]) => !t.has(a) || typeof l != "boolean") ||
    typeof r.ended != "boolean" ||
    (r.ended && r.chapter !== 11) ||
    (r.position !== null &&
      r.position !== void 0 &&
      (!Number.isFinite(r.position.x) || !Number.isFinite(r.position.z) || Math.abs(r.position.x) > 40 || Math.abs(r.position.z) > 40))
  )
    return null;
  let s = validateCaseRecord(r, CASES);
  if (!s) return null;
  let i = validateLife(r.life);
  if (!i) return null;
  let n = validateDistrict(r.district);
  if (!n) return null;
  let o = {
    ...e,
    ...s,
    life: i,
    district: n,
    chapter: r.chapter,
    done: { ...r.done },
    inventory: [...new Set(r.inventory)],
    flags: [...r.flags],
    journal: r.journal.map((a) => ({ chapter: a.chapter, title: a.title, text: a.text })),
    sides: [...r.sides],
    ended: r.ended,
    position: r.position ? { x: r.position.x, z: r.position.z } : null,
  };
  for (let a of ["trust", "credits", "xp", "hp", "focus", "failures"]) o[a] = r[a];
  return (
    (o.hp = Math.max(1, Math.min(100, o.hp))),
    (o.focus = Math.min(100, o.focus)),
    r.version === 1 &&
      ((o.skillPoints = 1 + r.chapter),
      o.journal.push({
        chapter: r.chapter,
        title: "Long Night Edition",
        text: "Original progress imported. Earlier cases remain closed. New rooms and investigations are available in this case. The previous save is unchanged.",
      })),
    o
  );
}
function doneKey(r, e) {
  return `${r.chapter}:${e}`;
}
function isDone(r, e) {
  return !!r.done[doneKey(r, e)];
}
function isReady(r, e) {
  return !isDone(r, e.id) && (e.req || []).every((t) => isDone(r, t));
}
function applyDelta(r, e = {}) {
  for (let t of ["trust", "credits", "xp", "focus", "hp"]) r[t] += e[t] || 0;
  ((r.credits = Math.max(0, r.credits)),
    (r.focus = Math.max(0, Math.min(100, r.focus))),
    (r.hp = Math.max(0, Math.min(100, r.hp))),
    e.flag && !r.flags.includes(e.flag) && r.flags.push(e.flag));
}
function completeTask(r, e, t = {}) {
  return !isReady(r, e) || e.kind === "exit" || !canAfford(r, e) || !canAfford(r, t)
    ? !1
    : ((r.done[doneKey(r, e.id)] = !0),
      applyDelta(r, e),
      applyDelta(r, t),
      (r.xp += e.kind === "side" ? 25 : 20),
      e.reward && !r.inventory.includes(e.reward) && r.inventory.push(e.reward),
      e.side && !r.sides.includes(e.side) && r.sides.push(e.side),
      r.journal.push({ chapter: r.chapter, title: e.label, text: t.result || e.text || e.question }),
      applyTaskOutcome(r, e, t),
      !0);
}
function closeCase(r) {
  let e = CASES[r.chapter],
    t = e.tasks.find((s) => s.kind === "exit");
  return isReady(r, t)
    ? ((r.done[doneKey(r, "exit")] = !0),
      r.journal.push({ chapter: r.chapter, title: "Case closed", text: e.end }),
      (r.hp = Math.min(100, r.hp + 25)),
      (r.focus = Math.min(100, r.focus + 30)),
      (r.credits += 8),
      (r.xp += 50),
      (r.position = null),
      (r.room = 0),
      r.skillPoints++,
      (r.heat = Math.max(0, r.heat - 12)),
      r.chapter === CASES.length - 1 ? (r.ended = !0) : r.chapter++,
      !0)
    : !1;
}
function rankName(r) {
  return ["Street listener", "Memory tracer", "Night investigator", "City witness", "Keeper of names"][Math.min(4, Math.floor(r.xp / 320))];
}
function endingFor(r) {
  let e = r.trust >= 23 ? "A city that remembers" : r.trust >= 12 ? "A light left on" : "The public record",
    t = [
      r.trust >= 23
        ? "People answer your call before you finish asking. The city has learned that survival is something you do together."
        : r.trust >= 12
          ? "Not every door opens. Enough do. You have made a few honest connections in a city built to sell imitations."
          : "The evidence stands. Your work changes the law, even if very few people learn the name of the person who carried it.",
      r.flags.includes("redacted")
        ? "The broadcast protects private lives while exposing the programme that threatened them."
        : "Ori keeps the encrypted archive beyond Aster\u2019s reach. Its owners will decide what becomes public.",
      r.inventory.includes("seed")
        ? "On the ferry, you plant Sol\u2019s seed in an empty coffee cup. By the time you reach the other shore, you have already checked it twice."
        : "You watch the city shrink across the water. For the first time, its lights look small enough to turn off.",
      r.flags.includes("returned")
        ? "The courier gets her childhood back. You do not need to keep it to know it mattered."
        : "The reel stays sealed until its owner can claim it. A promise is not a licence. It asks more of you.",
      "Ori hands you the second coffee. There is no test for this.",
    ];
  return { title: e, lines: t };
}
function buildCaseRoom(r, e, t) {
  let s = [],
    i = [],
    n = [],
    o = [],
    a = (_, B, L, G, Z, W, se, ae, Te = {}) => {
      let Ce = { type: _, x: B, y: L, z: G, w: Z, h: W, d: se, color: ae, ...Te };
      return (s.push(Ce), Ce);
    },
    l = (_, B, L, G, Z, W, se, ae = {}) => a("box", _, B, L, G, Z, W, se, ae),
    c = (_, B, L, G, Z, W, se = {}) => a("cylinder", _, B, L, G * 2, Z, G * 2, W, se),
    h = (_, B, L, G, Z = 1.2, W = "#43535a") => {
      (l(_, Z / 2, B, L, Z, G, W), i.push({ x: _, z: B, w: L, d: G }));
    },
    u = (_, B, L, G, Z = 0.2) => a("glow", _, 0.025, B, L, 0.01, L, G, { alpha: Z }),
    d = (_, B, L, G, Z, W) => a("sign", B, L, G, Z, Z * 0.23, 0.03, W, { text: _, emissive: 1.5 }),
    p = t.style,
    f = ["pump", "interview", "archives", "security", "power"].includes(p),
    g = f ? "#63c7c9" : ["studio", "backstage", "darkroom"].includes(p) ? "#da80a0" : "#e6b576",
    m = ["roof", "laundry"].includes(p),
    y = r === 11;
  (l(0, -0.57, 0, 24.5, 1, 22, "#14232b"), l(0, -0.015, 0, 24, 0.12, 21.8, f ? "#263f47" : "#3d4040", { wet: m || p === "pump" }));
  for (let _ = -11; _ <= 11; _ += 1.4) l(_, 0.051, 0, 0.018, 0.01, 21, "#667375");
  for (let _ = -10; _ <= 10; _ += 1.4) l(0, 0.052, _, 23, 0.01, 0.018, "#667375");
  if (m) {
    for (let _ of [-11, 11]) {
      l(_, 0.6, 0, 0.1, 0.12, 21, "#789096");
      for (let B = -9; B < 10; B += 2.5) l(_, 0.4, B, 0.09, 0.8, 0.09, "#597278");
    }
    for (let _ = 0; _ < 12; _++) {
      let B = 9 + ((_ * 7 + r) % 16);
      l(-25 + _ * 4.7, B / 2, -24, 3.5, B, 4, "#1d313c");
      for (let L = 2; L < B; L += 3) l(-25 + _ * 4.7, L, -21.96, 1.4, 0.55, 0.03, g, { emissive: 0.3 });
    }
  } else {
    (l(0, 2.15, -10.45, 24, 4.3, 0.4, "#273740"), l(-11.7, 1.5, 0, 0.35, 3, 21, "#293b43"));
    for (let _ of [-10, -6, -2, 2, 6, 10])
      (l(_, 2.25, -10.14, 0.11, 4.4, 0.13, "#718084"), l(_, 3.85, -9.9, 1.3, 0.12, 0.35, g, { emissive: 1 }));
    l(0, 4.3, -10, 23, 0.17, 0.8, "#344b54");
  }
  (d(t.name.toUpperCase(), 0, 5.3, -9.6, 12, g),
    d("SECTOR " + String(r + 1).padStart(2, "0") + " / " + String(e + 1).padStart(2, "0"), -7, 3.15, -9.9, 3.6, "#a5b8b7"));
  let x = (_, B, L = 3) => {
      (h(_, B, L, 1.2, 1, "#6c655a"), l(_, 1.1, B, L + 0.2, 0.13, 1.4, "#a59476"));
    },
    w = (_, B) => {
      (x(_, B, 2),
        l(_, 1.8, B, 1.4, 1, 0.45, "#223d47"),
        l(_, 1.8, B + 0.24, 1.15, 0.65, 0.03, g, { emissive: 0.9 }),
        l(_, 1.19, B + 0.5, 1.4, 0.08, 0.3, "#2f424b"));
    },
    v = (_, B) => {
      (h(_, B, 2.7, 0.9, 0.5, "#775e50"), l(_, 0.9, B - 0.38, 2.7, 0.75, 0.15, "#8b7460"));
    },
    S = (_, B) => {
      h(_, B, 2, 1, 2.7, "#30464e");
      for (let L = 0.45; L < 2.7; L += 0.65) {
        l(_, L, B, 2.3, 0.09, 1.3, "#81918c");
        for (let G = 0; G < 4; G++)
          (l(_ - 0.7 + G * 0.47, L + 0.22, B + 0.2, 0.34, 0.35, 0.7, G % 2 ? "#8b8c75" : "#516e70"),
            l(_ - 0.7 + G * 0.47, L + 0.23, B + 0.56, 0.14, 0.09, 0.012, "#d4c7a6"));
      }
    },
    M = (_, B, L = 2) => {
      (c(_, 0.3, B, 0.45, 0.6, "#75634f"), l(_, L / 2 + 0.3, B, 0.13, L, 0.13, "#585a40"));
      for (let G = 0; G < 4; G++)
        a("cone", _ + Math.sin(G * 2) * 0.5, L * 0.7 + G * 0.22, B + Math.cos(G * 2) * 0.5, 1.2, 1.1, 1.1, "#657c59");
    },
    N = (_, B, L = "#707d79") => {
      (l(_, 0.45, B, 0.65, 0.14, 0.65, L), l(_, 0.9, B - 0.3, 0.65, 0.85, 0.12, L));
      for (let G of [-0.25, 0.25]) for (let Z of [-0.25, 0.25]) l(_ + G, 0.2, B + Z, 0.06, 0.4, 0.06, "#4a5960");
    },
    T = (_, B, L = g) => {
      (c(_, 2, B, 0.06, 4, "#61777c"), l(_, 4, B, 1, 0.12, 0.7, L, { emissive: 1.5 }), u(_, B, 4, L, 0.15));
    },
    E = (_, B) => {
      for (let L = 0; L < 3; L++)
        (c(_ + L * 0.5, 1.7, B, 0.16, 3.4, L === 1 ? "#618d91" : "#576e76"),
          l(_ + L * 0.5, 3.25, B + 0.8, 0.3, 0.3, 1.6, "#627d84"),
          c(_ + L * 0.5, 0.8, B + 0.45, 0.28, 0.15, g));
    };
  if (["pump", "power"].includes(p)) {
    for (let _ of [-8, -4, 7])
      (h(_, -7, 2.3, 2.5, 1.6, "#3a616a"),
        c(_, 1.8, -7, 0.7, 0.35, "#708c92"),
        l(_, 1, -5.68, 0.9, 0.4, 0.04, g, { emissive: 0.7 }),
        E(_ - 0.5, -8.8));
    l(-8, 0.12, 0, 2, 0.03, 9, "#426a72", { wet: !0 });
    for (let _ = -4; _ < 5; _++) l(-8, 0.14, _, 1.9, 0.035, 0.08, "#152e38");
    if ((w(7, -3), u(-5, -5, 10, g), p === "power"))
      for (let _ = -6; _ <= 6; _ += 3) l(_, 0.12, 0, 0.14, 0.05, 15, _ % 2 ? "#897351" : "#487b82");
  } else if (["garage", "warehouse"].includes(p)) {
    if (p === "garage") {
      (a("car", -0.7, 0.85, -6, 2.7, 0.8, 4.7, "#4e7386"),
        i.push({ x: -0.7, z: -6, w: 2.7, d: 4.7 }),
        l(-0.7, 0.1, -6, 4, 0.15, 6, "#69767a"));
      for (let _ of [-3.5, 2.3]) h(_, -6, 0.3, 0.4, 3.1, "#ac8152");
    } else
      for (let [_, B] of [
        [-7, -7],
        [-4, -7],
        [1, -7],
        [7, -7],
      ])
        (h(_, B, 2, 2, 1.4, "#6c6557"), l(_, 1.4, B, 2.03, 0.12, 2.03, "#938779"), l(_, 1.48, B, 0.16, 0.03, 2, "#43676b"));
    (S(-8, -2), w(7, -6), l(0, 0.08, 0, 1.8, 0.015, 15, "#7a7157"), T(-9, 6), T(9, 6));
  } else if (["archives", "security"].includes(p)) {
    for (let _ of [-8, -5, 0, 5, 8]) S(_, -7.4);
    (w(8, -3), h(-8, 2, 2, 2, 1.1, "#557078"));
    for (let _ of [-7, -3, 1, 5]) l(0, 0.08, _, 4, 0.02, 0.09, g, { emissive: 0.3 });
    if (p === "security")
      for (let _ = -7; _ <= 7; _ += 3.5) (l(_, 3, -10, 1.8, 1.2, 0.12, "#345a69"), l(_, 3, -9.92, 1.5, 0.85, 0.03, g, { emissive: 0.6 }));
    else (l(0, 0.12, -1, 5, 0.1, 0.4, "#5d6e6e"), d("NAMES / NOT NUMBERS", -7, 2.5, -10, 4, "#d8be92"));
  } else if (p === "interview")
    (x(0, -5, 4),
      N(0, -3.8),
      N(0, -6.5, "#9b9587"),
      w(7, -7),
      l(-6, 2.2, -10, 6, 2.4, 0.08, "#41616c", { wet: !0 }),
      l(0, 1.34, -5, 0.6, 0.35, 0.6, "#768b81"),
      l(0, 1.6, -5, 0.35, 0.12, 0.35, g, { emissive: 1 }),
      c(-1, 1.24, -4.8, 0.12, 0.25, "#d7cbb0"),
      v(-8, 1),
      l(0, 0.11, -5, 5, 0.05, 5, "#66726c"),
      u(0, -5, 8, g, 0.19));
  else if (p === "corridor") {
    for (let _ of [-8, -3, 3, 8])
      (l(_, 1.65, -10, 2.5, 3.3, 0.17, "#6f6960"),
        l(_ + 0.8, 1.5, -9.87, 0.09, 0.1, 0.08, "#cab888"),
        d(String(401 + Math.round(_ + 8)), _, 2.35, -9.85, 1.3, "#d6c397"));
    (x(-8, 1, 2), c(-8, 1.3, 1, 0.2, 0.4, "#ccbfa3"), v(8, -6), T(0, -7), S(-8, -5), l(0, 0.09, 0, 5, 0.02, 17, "#6b5a51"));
  } else if (p === "laundry") {
    for (let _ of [-8, -4, 1, 6])
      (h(_, -7.4, 2.3, 1.8, 1.7, "#7b9491"), c(_, 1, -6.4, 0.45, 0.12, "#344d58"), l(_, 1.6, -6.43, 1.6, 0.15, 0.02, "#c3c5ad"));
    for (let _ of [-8, 7]) l(_, 2.7, -3, 0.09, 5.4, 0.09, "#5d777a");
    l(0, 4.1, -3, 16, 0.035, 0.035, "#8c9c96");
    for (let _ of [-6, -3, 0, 4]) l(_, 3.2, -3, 1.8, 1.8, 0.035, _ % 2 ? "#7b9795" : "#bcbba2");
    (v(8, 4), T(-9, 6), u(3, -3, 8, g, 0.1));
  } else if (p === "darkroom") {
    (x(-7, -6, 5), l(-7, 1.24, -6, 2.5, 0.15, 0.9, "#9d9690"), l(-7, 1.34, -6, 2.3, 0.03, 0.7, "#425b62", { wet: !0 }), w(7, -7));
    for (let _ = -7; _ <= 6; _ += 2.5)
      (l(_, 2.8, -9.8, 1.7, 1.7, 0.035, "#b6b9a3"),
        l(_, 2.8, -9.75, 1.5, 1.35, 0.01, "#485765"),
        l(_ - 0.1, 2.7, -9.73, 0.25, 0.5, 0.01, "#d8ba8d"));
    (T(-2, -5, "#d75a62"), u(-5, -5, 12, "#d56b7a", 0.24), S(-8, 2), l(0, 0.1, 0, 7, 0.02, 9, "#42444e"));
  } else if (["backstage", "studio"].includes(p)) {
    for (let _ of [-9, 9])
      for (let B of [-7, -3, 1])
        (h(_, B, 1.5, 1.4, 2.3, "#394652"), l(_, 1.3, B + 0.72, 1.1, 1.5, 0.03, "#25343f"), c(_, 1.3, B + 0.75, 0.4, 0.06, "#4b6370"));
    if (p === "studio") {
      x(0, -6, 6);
      for (let _ = -2.5; _ <= 2.5; _ += 0.5)
        (l(_, 1.19, -6, 0.15, 0.05, 0.8, "#233f47"), l(_, 1.24, -6 + (_ % 1) * 0.4, 0.22, 0.06, 0.15, g, { emissive: 0.3 }));
      for (let _ = -2; _ <= 2; _ += 1) l(_, 2.1, -7.2, 0.25, 1 + (_ + 3) * 0.1, 0.08, g, { emissive: 0.7 });
    } else {
      l(0, 2.4, -10, 10, 4.7, 0.08, "#734551");
      for (let _ = -5; _ <= 5; _ += 0.5) l(_, 2.4, -9.9, 0.2, 4.7, 0.09, "#94616c");
      (x(5, -5), N(5, -3.5));
    }
    (u(-4, -3, 10, g, 0.22), T(7, 5), d("KEEP THE CHANNEL OPEN", 0, 3, -9.75, 8, g));
  } else if (["workshop", "greenhouse"].includes(p)) {
    (x(0, -7, 6), S(-8, -7), S(8, -7), w(8, -3), M(-8, 1, 2.5), M(7, 4, 2));
    for (let _ = -2; _ <= 2; _ += 1)
      (l(_, 1.45, -7, 0.45, 0.6, 0.4, ["#c59675", "#829f91", "#9190a9"][(_ + 2) % 3]), l(_, 1.95, -7, 0.35, 0.4, 0.35, "#c7b591"));
    if (p === "greenhouse") {
      (M(-5, -6, 4), M(5, -6, 3.6), l(0, 3.5, -10, 20, 3, 0.05, "#537c7d", { emissive: 0.15 }));
      for (let _ = -10; _ <= 10; _ += 2) l(_, 3.5, -9.92, 0.08, 3.5, 0.09, "#8aa49b");
      u(0, -4, 12, "#9eb57b", 0.14);
    } else {
      l(0, 0.09, 0, 7, 0.02, 8, "#69614e");
      for (let _ of [-4, 3]) n.push({ x: -8, z: _, color: "#ac8b66", style: "toy", phase: 0 });
    }
  } else if (p === "roof") {
    for (let [_, B] of [
      [-7, -7],
      [4, -7],
      [-8, 1],
      [8, 1],
    ]) {
      (h(_, B, 2.7, 1.8, 1.2, "#475f69"), l(_, 1.25, B, 2.8, 0.15, 2, "#75939a"));
      for (let L = 0; L < 7; L++) l(_ - 1.1 + L * 0.36, 1.35, B, 0.09, 0.03, 1.7, "#263d49");
    }
    (c(0, 4, -8, 0.16, 8, "#7b959c"), l(0, 6, -8, 5, 0.12, 0.13, g, { emissive: 0.7 }), T(-8, 7), T(8, 7), u(0, -5, 12, g, 0.12));
    for (let [_, B] of [
      [-1, -2],
      [4, 2],
      [-3, 5],
    ])
      o.push({ x: _, z: B, r: 0.9, phase: (_ + B) * 0.7 });
  } else if (["waiting", "cabin"].includes(p)) {
    for (let _ of [-8, 8]) for (let B of [-6, -2, 3]) v(_, B);
    if (p === "cabin") {
      l(0, 2.5, -10, 19, 2, 0.09, "#8eb6b8", { emissive: 0.18 });
      for (let _ = -9; _ <= 9; _ += 3) l(_, 2.5, -9.9, 0.16, 2.7, 0.12, "#8a927f");
      x(0, -6);
      for (let _ of [-0.7, 0.7]) c(_, 1.35, -6, 0.15, 0.25, "#dcc9a8");
    } else (w(0, -7), d("DEPARTURE / 05:30", 0, 3, -9.8, 7, "#ebc88d"), S(-8, 7));
    (T(0, -1, "#ead2a1"), M(8, 7, 1.8), u(0, -5, 17, "#d7c397", 0.12));
  }
  for (let [_, B] of [
    [-4, 0],
    [4, -3],
    [2, -2],
    [5, 4],
    [-5, 3],
  ])
    (l(_, 0.12, B, 0.65, 0.2, 0.5, "#586b6d"), l(_, 0.24, B, 0.5, 0.04, 0.34, g, { emissive: 0.3 }));
  for (let _ of [-8, 8]) (l(_, 0.09, 7, 2, 0.03, 1.5, "#607973"), l(_, 0.13, 7, 1.6, 0.02, 0.09, g, { emissive: 0.6 }));
  return (
    u(0, 0, 14, g, 0.07),
    {
      objects: s,
      colliders: i,
      npcs: n,
      hazards: o,
      type: p,
      mood: y ? "dawn" : f ? "cold" : "night",
      indoor: !m,
      bounds: { minX: -11.3, maxX: 11.3, minZ: -10, maxZ: 10.3 },
      room: e,
      title: t.name,
      chapter: r,
    }
  );
}
function scatterClutter(r, e, t) {
  let s = (i, n, o, a, l, c, h, u = {}) => r.objects.push({ type: "box", x: i, y: n, z: o, w: a, h: l, d: c, color: h, ...u });
  for (let i = 0; i < 14; i++) {
    let n = -10 + ((i * 7 + e * 3) % 21),
      o = -8 + ((i * 11 + e) % 17);
    if (!r.colliders.some((a) => Math.abs(n - a.x) < a.w / 2 + 0.2 && Math.abs(o - a.z) < a.d / 2 + 0.2))
      if (i % 3 === 0) (s(n, 0.085, o, 0.36, 0.018, 0.26, "#a5a797"), s(n, 0.101, o, 0.24, 0.005, 0.025, "#526b72"));
      else if (i % 3 === 1) for (let a = 0; a < 5; a++) s(n - 0.2 + a * 0.1, 0.082, o, 0.035, 0.015, 0.5, "#647b7e");
      else s(n, 0.08, o, 0.24, 0.04, 0.24, "#51656c");
  }
  for (let i of r.objects.slice())
    if (i.type === "box" && i.h > 0.7 && i.h < 1.8 && i.w > 2 && i.y + i.h / 2 < 2 && !i.emissive)
      for (let n = -i.w / 2 + 0.4; n < i.w / 2; n += 0.75)
        r.objects.push({ type: "cylinder", x: i.x + n, y: i.y + i.h / 2 + 0.025, z: i.z, w: 0.13, h: 0.05, d: 0.13, color: i.color });
  return ((r.room = t), (r.chapter = e), r);
}
var PROP_COLORS = {
  warm: "#e8bc81",
  paper: "#d1c4a5",
  wood: "#85664f",
  metal: "#607c84",
  dark: "#263e49",
  green: "#799978",
  red: "#b06d65",
  blue: "#81b7bd",
};
function addLife(r, e, t, s, i, n) {
  let o = LIFE_PLACES[e][t];
  ((r.lifeSpec = o), (r.living = []), (r.lifeFX = []), (r.details = []), (r.lifeActors = []));
  let a = PROP_COLORS,
    l = (w, v, S, M, N, T, E, _ = {}) => r.objects.push({ type: "box", x: w, y: v, z: S, w: M, h: N, d: T, color: E, ..._ });
  for (let w = 0; w < 8; w++) {
    let v = -10.3 + w * 2.9;
    (l(v, 0.23, -9.6, 2.5, 0.34, 0.13, "#263c45"), l(v, 3.52, -9.54, 2.8, 0.075, 0.13, "#698184"));
    for (let S = 0; S < 3; S++) l(v - 0.6 + S * 0.6, 0.3, -9.45, 0.27, 0.025, 0.02, "#728381");
    l(v, 1.18, -9.48, 0.07, 1.8, 0.08, "#475c65");
  }
  if (r.indoor)
    for (let w = 0; w < 5; w++) {
      let v = -8 + w * 4;
      l(v, 0.075, 3, 0.13, 0.008, 7, "#718086", { alpha: 0.11 });
    }
  else
    for (let w of [-10.4, 10.3])
      for (let v = -5; v < 9; v += 4) for (let S = 0; S < 6; S++) l(w - 0.32 + S * 0.13, 0.18, v, 0.05, 0.025, 0.9, "#738987");
  let c = (w, v, S, M, N, T, E, _ = {}) => l(w, v, S, M, N, T, E, _),
    h = (w, v, S, M, N, T = a.paper) => r.objects.push({ type: "sign", x: v, y: S, z: M, w: N, h: N * 0.25, d: 0.03, color: T, text: w }),
    u = (w, v, S, M, N = 0.12) => r.objects.push({ type: "glow", x: w, y: 0.18, z: v, w: S, h: 0.01, d: S, color: M, alpha: N }),
    d = (w, v, S) => {
      c(w, 2.25, v, 2.15, 1.45, 0.06, "#6c776d");
      for (let M = 0; M < 6; M++)
        c(w - 0.72 + (M % 3) * 0.72, 2.47 - Math.floor(M / 3) * 0.55, v + 0.05, 0.56, 0.43, 0.025, M % 2 ? a.paper : "#a5bbae");
      h(S, w, 3.18, v + 0.07, 3);
    },
    p = (w, v) => {
      (c(w, 3.5, v, 0.1, 2.1, 0.13, a.blue, { emissive: 0.8 }), u(w, v, 4, a.blue, 0.12));
    },
    f = o.theme;
  if (["kitchen", "market"].includes(f)) {
    d(-7, -4.72, f === "kitchen" ? "PAY WHEN YOU CAN" : "REPAIR / REUSE");
    for (let w = 0; w < 6; w++)
      (c(-9 + w * 0.8, 1.87, -4.72, 0.35, 0.56, 0.34, w % 2 ? "#877558" : "#b87e50"),
        c(-9 + w * 0.8, 2.21, -4.72, 0.3, 0.08, 0.3, a.paper));
    for (let w = 0; w < 5; w++) {
      let v = -9 + w * 1.5;
      r.living.push({ type: "box", x: v, y: 2.9, z: -4.15, w: 0.04, h: 0.48, d: 0.05, color: "#dfc08d", motion: "sway", phase: w });
    }
    r.lifeFX.push(
      { kind: "steam", x: -5, y: 1.7, z: -3.4, amount: 8, color: "#d8d7c0" },
      { kind: "moth", x: 7, y: 4.2, z: -5, amount: 3, color: "#efd9a3" },
    );
  } else if (["pump", "coolant", "power"].includes(f)) {
    for (let w = 0; w < 7; w++)
      (c(-10.6 + w * 0.22, 2.4, -5, 0.13, 4.5, 0.13, w % 2 ? "#6b8d94" : "#82755c"), c(-9.9, 4.55, -5, 2, 0.15, 0.4, a.metal));
    (d(4, -9.38, "SHIFT / HANDOVER"), p(-4, -9.2), r.lifeFX.push({ kind: "steam", x: -8, y: 0.25, z: -4, amount: 7, color: "#afc8c4" }));
  } else if (["registry", "archives", "vault", "security"].includes(f)) {
    d(-5, -9.38, f === "registry" ? "YOUR TURN WILL COME" : "REVIEW / RETURN");
    for (let w = 0; w < 9; w++) {
      let v = -10 + w * 0.44;
      (c(v, 1.05, -9.35, 0.36, 1.5, 0.35, ["#70847c", "#998776", "#5c797f"][w % 3]), c(v, 1.4, -9.15, 0.2, 0.035, 0.04, a.paper));
    }
    (p(10, -9.1), r.lifeFX.push({ kind: "dust", x: 2, y: 2, z: -6, amount: 9, color: "#d9ceb3" }));
  } else if (["hotel", "corridor", "apartment", "landing"].includes(f)) {
    d(-4, -9.38, f === "hotel" ? "HALCYON / STAY AWHILE" : f === "apartment" ? "THINGS TO KEEP" : "ON THIS FLOOR");
    for (let w = 0; w < 8; w++) c(8, 2.1 + w * 0.18, -9.34, 4, 0.045, 0.1, "#97b2ae");
    for (let w = 0; w < 5; w++) c(-10.8, 1 + w * 0.1, -5, 0.35, 0.08, 0.5, w % 2 ? a.paper : a.red);
    (r.lifeFX.push({ kind: "dust", x: 4, y: 1.8, z: -5, amount: 9, color: "#b4d1c7" }), u(5, -6, 9, "#95c1bd", 0.11));
  } else if (f === "laundry") {
    for (let w = 0; w < 7; w++)
      r.living.push({
        type: "box",
        x: -7 + w * 2.1,
        y: 3.2,
        z: -2.8,
        w: 1.25,
        h: 1.7 + (w % 2) * 0.25,
        d: 0.035,
        color: w % 2 ? "#9aaca6" : "#d3c6a6",
        motion: "cloth",
        phase: w,
      });
    (h("DRY LINE / SHARED", 0, 5, -8, 8), r.lifeFX.push({ kind: "drip", x: -6, y: 2.8, z: -2.5, amount: 9, color: "#99bec7" }));
  } else if (["club", "backstage", "studio"].includes(f)) {
    for (let w = 0; w < 7; w++) {
      let v = -4.5 + w * 1.5;
      (c(v, 3.8, -9.35, 0.3, 0.25, 0.25, "#e8b6ca", { emissive: 1.2 }), u(v, -5, 3, w % 2 ? "#799fbc" : "#d387a3", 0.15));
    }
    (d(6, -9.35, f === "club" ? "TONIGHT / LARK" : f === "studio" ? "ONE CHANNEL OPEN" : "CAST / CREW"),
      r.lifeFX.push({ kind: "dust", x: 0, y: 2.5, z: -4, amount: 12, color: "#c99cb6" }));
  } else if (["toys", "parts", "lift", "garage"].includes(f)) {
    d(-3, -9.35, "TOOLS BACK / PLEASE");
    for (let w = 0; w < 13; w++) {
      let v = -7 + w * 0.6;
      (c(v, 2.5 + (w % 3) * 0.18, -9.27, 0.12, 0.68, 0.08, w % 2 ? a.metal : "#ad9479"),
        c(v, 2.9 + (w % 3) * 0.18, -9.27, 0.3, 0.13, 0.12, a.metal));
    }
    (r.lifeFX.push({ kind: "dust", x: -4, y: 2.3, z: -5, amount: 8, color: "#d2bf9d" }), u(-3, -6, 7, a.warm, 0.14));
  } else if (f === "greenhouse") {
    for (let w = 0; w < 12; w++) {
      let v = -10 + w * 1.8;
      (c(v, 4.3, -9.35, 0.09, 3, 0.09, "#a3b8a4"), c(v, 3.9, -9.45, 1.6, 2.1, 0.04, "#689483", { alpha: 0.36 }));
    }
    (r.lifeFX.push(
      { kind: "moth", x: 0, y: 2.5, z: -5, amount: 5, color: "#d9dda2" },
      { kind: "drip", x: -6, y: 3.8, z: -8, amount: 5, color: "#a4d3c4" },
    ),
      u(0, -4, 15, "#b8c88a", 0.16));
  } else if (["bridge", "relay", "shelter", "crown", "span"].includes(f)) {
    for (let w = 0; w < 8; w++) {
      let v = -9 + w * 2.6;
      (c(v, 0.45, -9.2, 1.65, 0.15, 0.18, "#d6b87b"), c(v, 0.72, -9.2, 0.16, 0.4, 0.18, "#738992"));
    }
    for (let w = 0; w < 4; w++) {
      let v = -8 + w * 5.2;
      (c(v, 2.8, -8.9, 0.12, 5, 0.12, a.metal),
        r.living.push({
          type: "box",
          x: v + 0.32,
          y: 3.9,
          z: -8.9,
          w: 0.65,
          h: 0.42,
          d: 0.03,
          color: "#d4a581",
          motion: "cloth",
          phase: w,
        }));
    }
    (h("RETURN / STAY INSIDE THE RAIL", 0, 5.3, -9, 10, a.blue),
      r.lifeFX.push({ kind: "mist", x: 0, y: 0.35, z: -4, amount: 8, color: "#82a7b6" }));
  } else if (["pier", "terminal", "cabin"].includes(f)) {
    d(-5, -9.3, "MORNING / ALL WELCOME");
    for (let w = 0; w < 7; w++)
      (c(-9 + w * 2.8, 3.5, -9.3, 0.08, 3, 0.1, "#adbaae"), c(-9 + w * 2.8, 2.75, -9.38, 2.5, 1.35, 0.03, "#88b4b1", { alpha: 0.22 }));
    (u(0, -5, 18, "#e0c895", 0.13), r.lifeFX.push({ kind: "dust", x: 0, y: 2, z: -4, amount: 7, color: "#e1d4b6" }));
  } else
    (d(-5, -9.3, "PLEASE / TAKE YOUR TIME"), p(8, -9.2), r.lifeFX.push({ kind: "dust", x: 1, y: 2, z: -5, amount: 8, color: "#bbbcbe" }));
  let g = [],
    m = [...s, { x: 0, z: 6 }, { x: -8, z: 7 }, { x: 8, z: 7 }],
    y = [
      [-4, 3],
      [4, 2],
      [0, -6],
      [-7, 2],
      [7, 0],
      [-2, -2],
      [5, 5],
      [-4, 6],
      [3, -6],
      [-9, -3],
      [9, 3],
      [0, 1],
      [-6, -4],
      [6, -4],
      [0, 8],
    ];
  function x(w, v = !1) {
    let S = y.slice(w).concat(y.slice(0, w));
    for (let M = 0; M < 3; M++)
      for (let [N, T] of S) {
        let E = N + (M === 1 ? 0.7 : M === 2 ? -0.7 : 0),
          _ = T,
          B = _ - 0.9;
        if (
          !i(r, E, _, 0.38) ||
          !i(r, E, B, 0.7) ||
          m.some((G) => Math.hypot(G.x - E, G.z - B) < 1.8) ||
          g.some((G) => Math.hypot(G.x - E, G.z - _) < 2)
        )
          continue;
        let L = n(r, { x: 0, z: 6 }, { x: E, z: _ });
        if (!(!L.length || Math.hypot(L.at(-1).x - E, L.at(-1).z - _) > 1.4)) return (g.push({ x: E, z: _ }), { x: E, z: _ });
      }
    for (let M = 5; M >= -8; M -= 1.2)
      for (let N = -9; N <= 9; N += 1.2)
        if (i(r, N, M, 0.8) && !g.some((T) => Math.hypot(T.x - N, T.z - M) < 2) && !m.some((T) => Math.hypot(T.x - N, T.z - M) < 2))
          return (g.push({ x: N, z: M }), { x: N, z: M });
    throw new Error(`No detail anchor in ${o.id}`);
  }
  return (
    o.details.forEach((w, v) => {
      let S = x(v * 3),
        M = { x: S.x, z: S.z - 0.9 };
      (r.details.push({ ...w, x: S.x, z: S.z, kind: "detail", label: w.title, room: t, ready: !0, done: !1 }),
        addDetailProp(r, w, M.x, M.z, e * 3 + t),
        r.colliders.push({ x: M.x, z: M.z, w: 0.78, d: 0.65 }));
    }),
    o.residents.forEach((w, v) => {
      let S = x((v * 5 + 4) % y.length, !0),
        M = x((v * 5 + 7) % y.length, !0),
        N = n(r, S, M);
      N.length || (N = [S]);
      let T = [S, ...N],
        E = 0,
        _ = [];
      for (let B = 1; B < T.length; B++) {
        let L = Math.hypot(T[B].x - T[B - 1].x, T[B].z - T[B - 1].z);
        (_.push({ from: T[B - 1], to: T[B], start: E, len: L }), (E += L));
      }
      r.lifeActors.push({
        ...w,
        x: S.x,
        z: S.z,
        route: _,
        routeLength: E,
        phase: v * 4.2,
        pace: w.routine === "walk" ? 0.55 : 0.3,
        hold: w.routine === "walk" ? 4 : 12,
        color: [a.wood, "#7d9995", "#9992a1"][v % 3],
        umbrella: !r.indoor && e < 11,
      });
    }),
    r.npcs.forEach((w, v) =>
      r.lifeActors.push({
        ...w,
        name: "Local resident",
        role: "",
        routine: v % 2 ? "sip" : "read",
        route: [],
        routeLength: 0,
        phase: v * 2.8,
        pace: 0,
        hold: 10,
      }),
    ),
    (r.npcs = []),
    (r.lifeLights = [
      { x: r.details[0].x, z: r.details[0].z, color: a.warm },
      { x: 7, z: -5, color: ["club", "backstage", "studio"].includes(f) ? "#d089b5" : a.blue },
      { x: -6, z: 3, color: f === "greenhouse" ? "#b8c88a" : a.warm },
    ]),
    r
  );
}
function addDetailProp(r, e, t, s, i) {
  let n = PROP_COLORS,
    o = e.id,
    a = [],
    l = (d, p, f, g, m, y, x, w = {}) => {
      let v = { type: "box", x: t + d, y: p, z: s + f, w: g, h: m, d: y, color: x, detailId: o, ...w };
      return (a.push(v), v);
    },
    c = (d, p, f, g, m, y, x = {}) =>
      a.push({ type: "cylinder", x: t + d, y: p, z: s + f, w: g * 2, h: m, d: g * 2, color: y, detailId: o, ...x }),
    h = e.prop,
    u = ![
      "umbrella",
      "coat",
      "plant",
      "cloth",
      "blanket",
      "leak",
      "valve",
      "shutter",
      "window",
      "rail",
      "water",
      "awning",
      "rope",
      "chair",
      "bench",
      "fan",
      "examlight",
      "lamp",
      "beacon",
      "signboard",
    ].includes(h);
  if (u) {
    l(0, 0.76, 0, 1.15, 0.11, 0.85, n.wood);
    for (let d of [-0.46, 0.46]) for (let p of [-0.3, 0.3]) l(d, 0.39, p, 0.07, 0.7, 0.07, n.metal);
  }
  if (h === "bell")
    (c(0, 0.89, 0, 0.4, 0.12, n.dark),
      c(0, 1.06, 0, 0.34, 0.25, n.warm, { motion: "rattle", reacts: !0 }),
      c(0, 1.23, 0, 0.065, 0.09, n.metal),
      l(0.41, 1, 0, 0.12, 0.16, 0.2, n.red, { show: "before" }),
      l(0.44, 0.85, 0, 0.12, 0.05, 0.2, n.green, { show: "after" }));
  else if (["lamp", "tablelamp", "beacon", "examlight"].includes(h)) {
    let d = u ? 0.8 : 0,
      p = h === "tablelamp" ? 1 : 2.25;
    (c(0, d + 0.08, 0, 0.35, 0.12, n.dark),
      l(0, d + p / 2, 0, 0.07, p, 0.07, n.metal),
      l(0, d + p, -0.02, 0.8, 0.14, 0.5, n.wood),
      l(0, d + p - 0.075, 0.01, 0.64, 0.035, 0.4, n.warm, { emissive: 1, motion: "light", reacts: !!e.action }),
      r.lifeFX.push({ kind: "dust", x: t, y: d + 0.6, z: s + 0.15, amount: 6, color: n.warm }));
  } else if (["stockpot", "kettle"].includes(h)) {
    (c(0, 1.08, 0, 0.37, 0.55, n.metal),
      c(0, 1.37, 0, 0.42, 0.065, n.paper, { motion: h === "stockpot" ? "rattle" : "none", reacts: !!e.action }),
      c(0, 1.44, 0, 0.09, 0.09, n.dark));
    for (let d of [-1, 1]) l(d * 0.43, 1.17, 0, 0.16, 0.07, 0.2, n.dark);
    (l(0.29, 1.18, 0.22, 0.14, 0.14, 0.3, n.metal),
      r.lifeFX.push({ kind: "steam", x: t, y: 1.48, z: s, amount: 6, color: "#cbd0c4" }),
      h === "stockpot" &&
        (c(0.53, 0.9, 0.12, 0.22, 0.12, n.paper, { show: "after" }), c(0.53, 0.97, 0.12, 0.18, 0.012, n.dark, { show: "after" })));
  } else if (["notice", "forms", "map", "setlist", "receipt", "labels", "ticket", "chalk"].includes(h)) {
    if (["notice", "map", "labels", "chalk"].includes(h)) {
      (l(0, 1.5, 0, 1.5, 1.35, 0.1, n.wood), l(0, 1.5, 0.07, 1.32, 1.16, 0.025, h === "chalk" ? n.dark : n.paper));
      for (let d = 0; d < 8; d++) l(-0.08, 1.9 - d * 0.11, 0.09, 0.75 + (d % 3) * 0.14, 0.016, 0.015, h === "chalk" ? n.paper : n.dark);
    } else {
      for (let d = 0; d < 4; d++) l((d % 2) * 0.05, 0.845 + d * 0.016, 0, 0.8, 0.016, 0.55, d % 2 ? n.paper : "#e1d9c0");
      for (let d = 0; d < 5; d++) l(0, 0.914, 0.18 - d * 0.08, 0.54, 0.006, 0.014, n.dark);
    }
    h === "ticket" &&
      (l(0, 1.15, -0.18, 0.82, 0.5, 0.38, n.metal),
      l(0, 0.94, 0.24, 0.44, 0.03, 0.35, n.paper, { show: "before" }),
      l(0.3, 0.86, 0.14, 0.3, 0.025, 0.3, n.paper, { show: "after" }));
  } else if (["books", "drawer", "mailbox", "tools", "cables"].includes(h)) {
    l(0, 1.15, 0, 1.05, 0.65, 0.54, n.metal);
    for (let d = 0; d < 5; d++)
      (l(-0.4 + d * 0.2, 1.12, 0.3, 0.14, 0.48, 0.18, [n.paper, n.wood, n.blue][d % 3]),
        l(-0.4 + d * 0.2, 1.2, 0.398, 0.11, 0.025, 0.02, n.dark));
    (h === "drawer" && l(0, 0.92, 0.37, 0.86, 0.2, 0.35, n.paper, { motion: "drawer", reacts: !!e.action }),
      h === "mailbox" && l(0, 1.32, 0.405, 0.3, 0.14, 0.015, n.paper, { show: "after" }));
  } else if (["cup", "glass", "candle", "jar", "tin", "buttons"].includes(h)) {
    if (
      (c(0, 1.07, 0, h === "jar" ? 0.29 : 0.19, 0.44, h === "candle" ? n.paper : h === "glass" ? n.blue : n.wood),
      c(0, 1.302, 0, h === "jar" ? 0.28 : 0.17, 0.02, n.dark),
      h === "candle" && l(0, 1.4, 0, 0.06, 0.16, 0.06, n.warm, { emissive: 1, motion: "sway" }),
      h === "cup")
    )
      for (let d of [-1, 1]) (c(d * 0.31, 1.01, 0.14, 0.13, 0.28, n.paper), c(d * 0.31, 1.16, 0.14, 0.11, 0.02, "#6b4a39"));
    if (h === "buttons")
      for (let d = 0; d < 7; d++) c(-0.3 + (d % 3) * 0.26, 0.84, 0.22 - Math.floor(d / 3) * 0.19, 0.06, 0.03, d % 2 ? n.blue : n.red);
  } else if (["radio", "speaker", "tape", "clock", "metronome"].includes(h)) {
    (l(0, 1.14, 0, 0.95, 0.6, 0.42, n.dark), l(-0.16, 1.2, 0.22, 0.47, 0.32, 0.03, n.metal));
    for (let d = 0; d < 5; d++) l(-0.32 + d * 0.09, 1.19, 0.245, 0.025, 0.26, 0.015, n.dark);
    if (
      (c(0.31, 1.09, 0.22, 0.07, 0.06, n.warm),
      h === "radio" && l(0.24, 1.95, -0.12, 0.025, 1.12, 0.025, n.metal, { motion: "sway", reacts: !!e.action }),
      h === "tape")
    )
      for (let d of [-1, 1]) c(d * 0.2, 1.54, 0, 0.19, 0.08, n.paper, { motion: "spin" });
    h === "metronome" && l(0, 1.65, 0, 0.035, 0.5, 0.04, n.warm, { motion: "sway" });
  } else if (["leak", "valve", "basin", "washer", "fan"].includes(h))
    (l(0, 0.65, 0, 0.92, 1.2, 0.63, n.metal),
      l(0, 1.36, 0, 0.12, 0.24, 0.14, n.paper),
      c(0, 0.3, 0.2, 0.34, 0.34, n.dark),
      c(0, 0.49, 0.2, 0.32, 0.04, n.blue, { show: "before" }),
      h === "fan" && (l(0, 1.5, 0, 0.07, 1, 0.06, n.paper, { motion: "spin" }), l(0, 1.5, 0, 1, 0.07, 0.06, n.paper, { motion: "spin" })),
      ["leak", "basin"].includes(h) && r.lifeFX.push({ kind: "drip", x: t, y: 1.38, z: s + 0.23, amount: 6, color: n.blue, stop: o }));
  else if (["plant", "moth", "bird", "toy", "scraps"].includes(h))
    if (h === "plant") {
      (c(0, 0.26, 0, 0.4, 0.5, n.wood), l(0, 0.97, 0, 0.1, 1.4, 0.1, "#586445"));
      for (let d = 0; d < 7; d++) {
        let p = d * 2.4;
        l(Math.sin(p) * 0.35, 1 + d * 0.14, Math.cos(p) * 0.35, 0.63, 0.13, 0.38, d % 2 ? n.green : "#97ac78", {
          motion: "leaf",
          phase: d,
        });
      }
      c(0.36, 0.75, 0.13, 0.14, 0.2, n.blue, { show: "after" });
    } else if (h === "moth") {
      l(0, 1.02, 0, 0.88, 0.5, 0.58, n.wood);
      for (let d = 0; d < 5; d++) l(-0.4 + d * 0.2, 1.36, 0, 0.027, 0.6, 0.61, n.metal);
      (l(0, 1.02, 0.3, 0.8, 0.025, 0.025, n.metal),
        l(0.48, 1.23, 0.18, 0.04, 0.5, 0.3, n.metal, { show: "before" }),
        l(0, 1.52, 0, 0.86, 0.035, 0.6, n.metal, { show: "after" }),
        r.lifeFX.push({ kind: "moth", x: t, y: 1.8, z: s, amount: 2, color: n.warm, calm: o }));
    } else if (["bird", "toy"].includes(h)) {
      (l(0, 1.03, 0, 0.5, 0.3, 0.35, n.blue, { motion: h === "bird" ? "bird" : "sway", reacts: !!e.action }),
        l(0.28, 1.24, 0.03, 0.24, 0.25, 0.25, n.paper, { motion: h === "bird" ? "bird" : "sway", reacts: !!e.action }),
        l(0.43, 1.24, 0.03, 0.12, 0.08, 0.1, n.warm, { motion: h === "bird" ? "bird" : "sway", reacts: !!e.action }));
      for (let d of [-1, 1]) l(d * 0.14, 0.84, 0, 0.07, 0.2, 0.08, n.wood);
    } else
      for (let d = 0; d < 8; d++)
        l(-0.4 + (d % 3) * 0.35, 0.87 + Math.floor(d / 3) * 0.12, 0.12 - (d % 2) * 0.26, 0.25, 0.11, 0.2, d % 2 ? n.paper : n.blue);
  else if (["umbrella", "cloth", "coat", "blanket", "glove", "shoe", "thread", "awning"].includes(h))
    if (h === "umbrella")
      (l(0, 1.1, 0, 0.05, 2.2, 0.05, n.metal),
        a.push({ type: "cone", x: t, y: 2.25, z: s, w: 1.7, h: 0.55, d: 1.7, color: n.red, detailId: o, motion: "sway" }));
    else if (h === "shoe" || h === "glove") for (let d of [-1, 1]) l(d * 0.24, 0.93, 0.1, 0.25, 0.2, 0.52, d < 0 ? n.wood : n.red);
    else
      (l(-0.52, 1.1, 0, 0.07, 2.2, 0.07, n.metal),
        l(0.52, 1.1, 0, 0.07, 2.2, 0.07, n.metal),
        l(0, 2.15, 0, 1.18, 0.065, 0.07, n.metal),
        l(0, 1.5, 0.06, 0.98, 1.22, 0.07, h === "cloth" ? n.paper : h === "coat" ? n.wood : n.red, {
          motion: "cloth",
          reacts: !!e.action,
          liftOnChange: h === "blanket" ? 0.28 : 0,
        }),
        l(0.3, 2.15, 0.06, 0.065, 0.12, 0.1, n.paper, { show: "after" }));
  else if (["window", "shutter", "mirror", "shrine", "signboard"].includes(h)) {
    (l(0, 1.2, 0, 1.35, 2.2, 0.12, n.wood), l(0, 1.25, 0.08, 1.15, 1.9, 0.035, h === "mirror" ? "#7b9a9e" : "#4d7b86"));
    for (let d = 0; d < 6; d++) l(0, 0.56 + d * 0.29, 0.13, 1.23, 0.055, 0.07, n.metal);
    if ((l(0.58, 1.2, 0.17, 0.04, 0.28, 0.12, n.warm, { motion: "sway", reacts: !!e.action }), h === "mirror"))
      for (let d of [-1, 1])
        for (let p = 0; p < 3; p++)
          l(d * 0.65, 0.55 + p * 0.65, 0.16, 0.13, 0.13, 0.1, n.warm, { emissive: 1, motion: "light", reacts: !!e.action });
    h === "shrine" &&
      (l(0, 0.26, 0.5, 1.2, 0.1, 0.7, n.wood),
      l(0, 0.46, 0.5, 0.2, 0.35, 0.2, n.paper),
      l(0, 0.69, 0.5, 0.06, 0.12, 0.06, n.warm, { emissive: 1, motion: "sway" }));
  } else if (
    ["bench", "chair", "lunch", "scale", "suitcase", "crate", "cart", "rope", "keys", "ruler", "water", "rail", "photo"].includes(h)
  )
    if (h === "chair" || h === "bench") {
      (l(0, 0.53, 0, 1, 0.12, 0.8, n.wood), l(0, 1, -0.34, 1, 1, 0.12, n.wood));
      for (let d of [-0.4, 0.4]) l(d, 0.25, 0, 0.07, 0.5, 0.7, n.metal);
    } else
      h === "photo"
        ? (l(0, 1.12, 0, 1, 0.6, 0.055, n.paper, { motion: "cloth", reacts: !!e.action }),
          l(0, 1.13, 0.04, 0.8, 0.42, 0.014, "#537785"),
          l(0.1, 1.13, 0.055, 0.12, 0.28, 0.014, n.warm))
        : h === "rope"
          ? (c(0, 0.86, 0, 0.42, 0.11, n.wood), c(0, 0.925, 0, 0.25, 0.02, n.dark))
          : h === "water"
            ? (l(0, 0.21, 0, 1.3, 0.02, 1.25, n.blue, { alpha: 0.5 }),
              r.lifeFX.push({ kind: "water", x: t, y: 0.23, z: s, amount: 5, color: "#afc6bd" }))
            : (l(0, 1.04, 0, 0.95, 0.4, 0.62, h === "suitcase" ? n.red : n.wood),
              l(0, 1.27, 0, 0.5, 0.1, 0.1, n.metal),
              l(0.36, 1.02, 0.32, 0.1, 0.18, 0.04, n.paper, { show: "after" }));
  (e.action &&
    (l(0.43, 0.8, 0.29, 0.075, 0.1, 0.045, n.red, { show: "before" }), l(0.43, 0.8, 0.29, 0.075, 0.1, 0.045, n.green, { show: "after" })),
    r.objects.push({
      type: "sign",
      x: t,
      y: 0.38,
      z: s + 0.45,
      w: 1.35,
      h: 0.18,
      d: 0.01,
      color: "#96b4ae",
      text: String(i + 1).padStart(2, "0") + " / " + e.id.split(":")[2],
    }),
    r.living.push(...a));
}
function actorPose(r, e, t, s = !1) {
  let i = r.routeLength || 0,
    n = i / Math.max(0.1, r.pace || 0.1),
    o = n * 2 + r.hold * 2,
    a = ((s ? 0 : e) + (r.phase || 0)) % Math.max(1, o),
    l = 0,
    c = !1,
    h = !1;
  a > r.hold && a < r.hold + n
    ? ((l = (a - r.hold) * r.pace), (c = !0))
    : a >= r.hold + n && a < r.hold * 2 + n
      ? (l = i)
      : a >= r.hold * 2 + n && ((l = i - (a - r.hold * 2 - n) * r.pace), (c = !0), (h = !0));
  let u = r.x,
    d = r.z,
    p = 0.3;
  if (i && r.route?.length) {
    let f = r.route.find((m) => l <= m.start + m.len) || r.route.at(-1),
      g = Math.max(0, Math.min(1, (l - f.start) / Math.max(0.001, f.len)));
    ((u = f.from.x + (f.to.x - f.from.x) * g),
      (d = f.from.z + (f.to.z - f.from.z) * g),
      (p = Math.atan2(f.to.x - f.from.x, f.to.z - f.from.z) + (h ? Math.PI : 0)));
  }
  return (
    !c && t && Math.hypot(u - t.x, d - t.z) < 3.2 && (p = Math.atan2(t.x - u, t.z - d)),
    {
      x: u,
      z: d,
      angle: p,
      moving: !s && !!i && c,
      phase: s ? 0 : e * 7 + (r.phase || 0),
      routine: r.routine,
      umbrella: r.umbrella,
      color: r.color,
      style: r.style,
    }
  );
}
function animatePart(r, e, t, s = !1) {
  let i = t.has(r.detailId),
    n = { ...r };
  if ((r.show === "after" && !i) || (r.show === "before" && i)) return ((n.hidden = !0), n);
  let o = s ? 0 : e + (r.phase || 0);
  if (r.motion === "cloth") {
    let a = r.reacts && i ? 0.2 : 1;
    ((n.rotateY = Math.sin(o * 1.4) * 0.11 * a), (n.z += Math.sin(o * 1.4) * 0.12 * a), i && (n.y += r.liftOnChange || 0));
  }
  return (
    r.motion === "sway" && !(r.reacts && i) && ((n.rotateY = Math.sin(o * 1.2) * 0.18), (n.x += Math.sin(o * 1.2) * 0.04)),
    r.motion === "leaf" && (n.rotateY = Math.sin(o * 0.8) * 0.12),
    r.motion === "rattle" && !i && (n.y += Math.abs(Math.sin(o * 11)) * 0.045),
    r.motion === "drawer" && !i && (n.z += 0.22),
    r.motion === "bird" && (!r.reacts || i) && ((n.x += Math.sin(o * 0.8) * 0.22), (n.y += Math.abs(Math.sin(o * 4)) * 0.05)),
    r.motion === "spin" && (n.rotateY = o * 2),
    r.motion === "light" && (n.alpha = r.reacts && !i ? (Math.sin(o * 3) > 0.45 ? 0.3 : 0.6) : 1),
    n
  );
}
function lifeParticles(r, e, t, s = !1, i = "balanced") {
  let n = [];
  for (let o of r.lifeFX || []) {
    let a = o.amount;
    for (let l = 0; l < a; l++) {
      let c = (e * 0.27 + l * 0.618033) % 1,
        h = e * 0.8 + l * 2.39,
        u = o.calm && t.has(o.calm),
        d = o.x,
        p = o.z,
        f = o.y,
        g = 0.07,
        m = 0.22,
        y = h;
      (o.kind === "steam" || o.kind === "mist"
        ? ((d += Math.sin(h) * 0.25), (p += Math.cos(h * 0.7) * 0.14), (f += c * 1.5), (g = 0.14 + c * 0.42), (m = (1 - c) * 0.1))
        : o.kind === "drip"
          ? ((f -= c * Math.max(0.4, o.y - 0.2)), (d += l * 0.035), (g = 0.035), (m = 0.3))
          : o.kind === "moth"
            ? ((d += Math.sin(h * 1.3) * (u ? 0.12 : 0.65)),
              (p += Math.cos(h * 0.9) * (u ? 0.1 : 0.5)),
              (f += Math.sin(h * 1.9) * 0.28),
              (g = 0.06),
              (m = 0.8))
            : o.kind === "water"
              ? ((d += Math.sin(l * 2.7) * 0.4), (p += Math.cos(l * 1.7) * 0.4), (g = 0.08 + c * 0.25), (m = (1 - c) * 0.2))
              : ((d += Math.sin(h * 0.4 + l) * 1.8),
                (p += Math.cos(h * 0.35 + l) * 1.5),
                (f += Math.sin(h * 0.5) * 0.6),
                (g = 0.025),
                (m = 0.38)),
        n.push({
          type: "box",
          x: d,
          y: f,
          z: p,
          w: o.kind === "moth" ? g * 2.6 : g,
          h: o.kind === "drip" ? 0.16 : o.kind === "water" ? 0.009 : g * 0.6,
          d: g,
          color: o.color,
          alpha: m,
          rotateY: y,
          particle: !0,
          hidden: s || !!(o.stop && t.has(o.stop)) || (i === "low" && l % 2 === 1),
        }));
    }
  }
  return n;
}
function buildDistrictRoom(r, e, t, s, i) {
  ((r.district = !0), (r.residents = []), (r.districtDevices = []), (r.districtLore = []));
  let n = (m, y, x, w, v, S, M, N = {}) => r.objects.push({ type: "box", x: m, y, z: x, w, h: v, d: S, color: M, ...N }),
    o = (m, y, x, w, v, S, M = {}) => r.objects.push({ type: "cylinder", x: m, y, z: x, w: w * 2, h: v, d: w * 2, color: S, ...M }),
    a = (m, y, x, w, v, S) =>
      r.objects.push({ type: "sign", text: m, x: y, y: x, z: w, w: v, h: v * 0.25, d: 0.03, color: S, emissive: 1.1 }),
    l = (m, y, x, w, v, S) => {
      (n(m, v / 2, y, x, v, w, S), r.colliders.push({ x: m, z: y, w: x, d: w }));
    },
    c = (m, y, x, w = 6) => r.objects.push({ type: "glow", x: m, y: 0.05, z: y, w, h: 0.01, d: w, color: x, alpha: 0.13 });
  if (e === 0) {
    ((r.colliders = r.colliders.filter((m) => !(m.x === -8.4 && m.z === 7.5))),
      (r.title = "Night kitchen / The Street of Rain"),
      (r.bounds = { minX: -33, maxX: 33, minZ: -31, maxZ: 24 }),
      (r.isStreetHub = !0),
      (r.indoor = !1),
      (r.objects = r.objects.filter((m) => Math.abs(m.x) < 13 && m.z > -12 && !(m.x === -8.4 && m.z > 7 && m.z < 8))),
      n(0, -0.22, -3.5, 69, 0.35, 59, "#142b34", { wet: !0 }));
    for (let m of [-17, 11, 21]) n(0, -0.026, m, 65, 0.05, 3.7, "#213740", { wet: !0 });
    for (let m of [-16, 17]) n(m, -0.022, -3, 3.7, 0.06, 53, "#213740", { wet: !0 });
    for (let m = -31; m <= 31; m += 2) for (let y of [-17, 11, 21]) n(m, 0.013, y, 0.7, 0.01, 0.035, "#6f7f78");
    for (let m = -28; m <= 22; m += 2) for (let y of [-16, 17]) n(y, 0.013, m, 0.035, 0.01, 0.7, "#6f7f78");
    for (let m of SHOPS) {
      let [y, x] = m.door,
        w = x - 3.9;
      (l(y, w, 7, 5.4, 3.8, "#2c4047"),
        n(y, 4.1, w, 7.4, 0.36, 5.7, "#4a5250"),
        n(y, 1.9, x - 1.14, 5.8, 2.7, 0.07, "#172d36"),
        n(y, 2.4, x - 1.09, 2, 1.7, 0.035, m.color, { emissive: 0.24 }),
        n(y, 3.6, x - 1.5, 7.6, 0.22, 1.8, m.color),
        n(y, 3.48, x - 1.12, 7.2, 0.045, 0.1, m.color, { emissive: 1.6 }),
        a(m.short, y, 4.8, x - 1.1, 6.5, m.color),
        a(String(m.room + 1).padStart(2, "0") + " / OPEN", y, 2.7, x - 1.02, 2, "#d9d2b0"),
        c(y, x, m.color, 7));
      for (let v = 0; v < 4; v++)
        (n(y - 2.7 + v * 1.8, 0.65, x - 1.04, 0.65, 1.2, 0.32, v % 2 ? "#847b63" : "#586e73"),
          n(y - 2.7 + v * 1.8, 1.3, x - 1.04, 0.62, 0.07, 0.35, "#b2a78c"));
      if (
        (o(y - 3.4, 2, x, 0.045, 4, "#719197"),
        n(y - 3.4, 4, x, 0.8, 0.08, 0.45, m.color, { emissive: 1.2 }),
        r.lifeFX.push({ kind: m.id === "shrine" ? "moth" : "steam", x: y + 2.7, y: 0.5, z: x - 1, amount: 4, color: m.color }),
        ["canopy", "arcade", "radio"].includes(m.id))
      )
        for (let v = 0; v < 4; v++)
          r.living.push({
            type: "box",
            x: y - 2.4 + v * 1.6,
            y: 3,
            z: x - 1,
            w: 1.1,
            h: 0.65,
            d: 0.04,
            color: m.color,
            motion: "cloth",
            phase: v,
          });
    }
    for (let m = 0; m < 70; m++) {
      let y = -30 + ((m * 17) % 61),
        x = -28 + ((m * 23) % 50);
      !s(r, y, x, 0.8) ||
        (Math.abs(y) < 11 && Math.abs(x) < 10) ||
        (n(y, 0.035, x, 0.3, 0.014, 0.25, m % 3 ? "#8a9282" : "#b4a391"),
        m % 7 === 0 && (o(y, 0.34, x, 0.18, 0.64, "#536e6d"), n(y, 0.67, x, 0.35, 0.05, 0.35, "#a69e80")));
    }
    for (let [m, y] of [
      [-15, -14],
      [17, -14],
      [-15, 10],
      [17, 10],
      [0, 21],
    ])
      (o(m, 2.3, y, 0.055, 4.6, "#657f88"), n(m, 4.6, y, 1.2, 0.12, 0.8, "#8dd0cd", { emissive: 1 }), c(m, y, "#8dd0cd", 8));
    for (let m = 0; m < 17; m++) {
      let y = -45 + m * 5.5,
        x = 15 + ((m * 13) % 27),
        w = -42 - (m % 3) * 4;
      n(y, x / 2, w, 4.4, x, 5, "#203640");
      for (let v = 3; v < x; v += 3.8)
        for (let S = 0; S < 3; S++)
          n(y - 1.3 + S * 1.3, v, w + 2.53, 0.35, 0.65, 0.025, (m + S) % 3 ? "#6b8e8e" : "#bc9269", { emissive: 0.35 });
    }
    a("ASTER / A NEW DAY IS A SERVICE", 5, 22, -37, 24, "#ccb893");
    for (let m = 0; m < 5; m++) n(5, 3 + m * 2, -49, 30 - m * 3, 2, 16 - m * 1.5, "#34454c");
    (n(0, 7.1, -16, 65, 0.45, 1.2, "#354b55"), n(0, 7.4, -16, 65, 0.08, 0.1, "#b8a482"));
    for (let m of [-28, -12, 12, 29]) n(m, 3.5, -16, 0.32, 7, 0.45, "#50636a");
    (r.objects.push({ type: "car", x: 3, y: 10, z: -31, w: 2.25, h: 0.8, d: 4, color: "#6d7788", fly: !0 }),
      r.lifeFX.push({ kind: "mist", x: 0, y: 0.4, z: 12, amount: 8, color: "#9eb9ba" }));
  } else if (e >= 3) {
    let m = SHOPS.find((y) => y.room === e);
    if (((r.districtPlace = m), a(m.tag, 0, 3.4, -9.28, 10, m.color), c(0, -3, m.color, 10), m.id === "clinic")) {
      (n(-5, 0.75, -5, 2.2, 0.28, 3.8, "#acb8aa"),
        n(-5, 1.03, -6.2, 1.5, 0.18, 0.7, "#d9d1b6"),
        n(-5, 1.02, -4.7, 2.1, 0.1, 2.2, "#6c9a96"));
      for (let y = -7; y < -2.5; y += 0.4)
        r.living.push({
          type: "box",
          x: y,
          y: 2.4,
          z: -7.4,
          w: 0.38,
          h: 2.4,
          d: 0.04,
          color: y % 1 ? "#7faba7" : "#acc4b4",
          motion: "cloth",
          phase: y,
        });
    }
    if (m.id === "recall") {
      for (let y = 0; y < 10; y++)
        (n(-9 + y * 1.85, 2.8, -9.1, 0.9, 1.1, 0.09, "#d1b8a1"), o(-9 + y * 1.85, 2.8, -8.98, 0.3, 0.09, m.color));
      a("CONSENT CAN BE WITHDRAWN", 0, 2, -9.1, 7, m.color);
    }
    if (m.id === "shrine") {
      for (let y = 0; y < 22; y++) {
        let x = -9 + y * 0.8;
        (o(x, 0.6 + (y % 3) * 0.4, -7, 0.13, 0.4, "#dbc8a0"), n(x, 0.85 + (y % 3) * 0.4, -7, 0.05, 0.1, 0.05, "#ffc585", { emissive: 1 }));
      }
      for (let y = 0; y < 9; y++) n(-8 + y * 2, 2.3, -9, 0.65, 0.9, 0.06, ["#829da0", "#a18c81", "#718c83"][y % 3]);
    }
    if (m.id === "transit") {
      n(0, 1.4, -11, 17, 2.2, 2.5, "#8a9b94");
      for (let y = -7; y <= 7; y += 2.4)
        (n(y, 1.8, -9.72, 1.8, 0.9, 0.02, "#accbc2", { emissive: 0.12 }), n(y, 0.4, -9.69, 1.8, 0.08, 0.025, "#d1b177"));
      a("PLATFORM 09 / NIGHT SERVICE", 0, 4, -9.5, 11, m.color);
    }
    if (m.id === "birdhouse")
      for (let y = 0; y < 5; y++)
        (o(-7 + y * 3.2, 2.5, -9, 0.4, 1.5, "#566f73"),
          r.living.push({
            type: "box",
            x: -7 + y * 3.2,
            y: 2.5,
            z: -8.7,
            w: 0.35,
            h: 0.3,
            d: 0.5,
            color: ["#bba281", "#6b9692", "#b58f9d"][y % 3],
            motion: "bird",
            phase: y,
          }));
    if (
      (m.id === "travel" &&
        (n(-5, 2.7, -9.35, 5.5, 2.8, 0.06, "#80a3b1"),
        n(-5, 2.2, -9.29, 5.3, 0.9, 0.04, "#b9c7a5"),
        a("250 IS NOT 120", 4, 2.2, -9.1, 3.6, m.color)),
      m.id === "radio")
    ) {
      for (let y = 0; y < 8; y++) {
        n(-8 + y * 2.1, 1.5, -9, 1.4, 1.1, 0.7, "#7f655a");
        for (let x = 0; x < 5; x++) n(-8.4 + y * 2.1 + x * 0.2, 1.5, -8.63, 0.04, 0.7, 0.03, "#b9b091");
      }
      a("REQUESTS / NOT RATINGS", 0, 2.7, -9.1, 8, m.color);
    }
  }
  r.lifeActors = [];
  let h = [...t, ...r.details, { x: 0, z: 6 }, { x: -8, z: 7 }, { x: 8, z: 7 }],
    u =
      e === 0
        ? [
            [-4, 0],
            [-8, 3],
            [-2, 8],
            [3, 9],
            [11, 8],
            [0, -13],
            [13, -13],
            [-12, 8],
          ]
        : [
            [-6, 4],
            [6, 2],
            [-2, -4],
            [7, 5],
            [-8, -2],
            [2, 4],
            [-3, 7],
            [6, -5],
            [0, 1],
          ];
  function d(m) {
    for (let y = 0; y < 6; y++)
      for (let x = 0; x < u.length; x++) {
        let w = u[(x + m) % u.length],
          v = w[0] + ((y % 3) - 1) * 0.7,
          S = w[1] + Math.floor(y / 3) * 0.8;
        if (s(r, v, S, 0.75) && !h.some((M) => Math.hypot(M.x - v, M.z - S) < 1.65)) {
          let M = i(r, { x: 0, z: 6 }, { x: v, z: S });
          if (M.length && Math.hypot(M.at(-1).x - v, M.at(-1).z - S) < 1.3) return (h.push({ x: v, z: S }), { x: v, z: S });
        }
      }
    for (let y = -8; y <= 8; y += 1.2)
      for (let x = -9; x <= 9; x += 1.2)
        if (s(r, x, y, 0.8) && !h.some((w) => Math.hypot(w.x - x, w.z - y) < 1.6)) return (h.push({ x, z: y }), { x, z: y });
    throw new Error("No opening-district anchor in room " + e);
  }
  RESIDENTS.filter((m) => m.room === e).forEach((m, y) => {
    let x = d(y),
      w = {
        ...x,
        id: m.id,
        name: m.name,
        role: m.role,
        line: m.topics[2].text,
        routine: y % 3 === 0 ? "work" : y % 3 === 1 ? "sip" : "read",
        route: [],
        routeLength: 0,
        hold: 6,
        pace: 0,
        phase: y * 2.3,
        color: RESIDENT_BY_ID[m.id].color,
        skin: ["#c7a27e", "#9a6b50", "#d6b99a", "#795343"][RESIDENT_BY_ID[m.id].index % 4],
        umbrella: e === 0 && y > 3,
      };
    (r.lifeActors.push(w),
      r.residents.push({
        ...x,
        id: "resident-" + m.id,
        person: m.id,
        kind: "resident",
        label: m.name,
        room: e,
        ready: !0,
        done: !1,
        optional: !0,
      }));
  });
  for (let m of LOCAL_QUESTS.filter((y) => y.room === e)) {
    let y = d(2),
      x = y.z - 0.7,
      w = m.group === "exchange" ? "#b295ba" : m.group === "workers" ? "#8ebdb5" : "#d7b07c";
    (r.districtDevices.push({
      ...y,
      id: "district-device-" + m.id,
      quest: m.id,
      label: m.object,
      kind: "districtDevice",
      room: e,
      ready: !0,
      done: !1,
      optional: !0,
    }),
      n(y.x, 0.6, x, 1.1, 1.2, 0.6, "#405860"),
      n(y.x, 1.5, x, 0.95, 0.7, 0.45, "#253e49"),
      n(y.x, 1.5, x + 0.24, 0.76, 0.48, 0.02, w, { emissive: 0.45 }),
      a(m.title.toUpperCase(), y.x, 2.25, x, 2.5, w),
      c(y.x, y.z, w, 2),
      r.colliders.push({ x: y.x, z: x, w: 0.95, d: 0.45 }));
  }
  for (let m of CITY_LORE.filter((y) => y.room === e)) {
    let y = d(4);
    (r.districtLore.push({
      ...y,
      id: "district-lore-" + m.id,
      lore: m.id,
      label: m.title,
      kind: "districtLore",
      room: e,
      ready: !0,
      done: !1,
      optional: !0,
    }),
      n(y.x, 1.05, y.z - 0.62, 0.08, 2.1, 0.08, "#76928c"),
      n(y.x, 1.8, y.z - 0.62, 1.25, 0.9, 0.055, "#b5ad8d"));
    for (let x = 0; x < 5; x++) n(y.x, 2.02 - x * 0.105, y.z - 0.58, 0.9 - x * 0.1, 0.025, 0.01, "#38515a");
    r.colliders.push({ x: y.x, z: y.z - 0.62, w: 1.2, d: 0.1 });
  }
  let f = (
      e === 0
        ? [
            [
              { x: -12, z: 10 },
              { x: 14, z: 10 },
            ],
            [
              { x: 1, z: 8 },
              { x: 1, z: -14 },
            ],
            [
              { x: -16, z: 20 },
              { x: 18, z: 20 },
            ],
            [
              { x: -16, z: -17 },
              { x: 17, z: -17 },
            ],
            [
              { x: -16, z: -10 },
              { x: -16, z: 10 },
            ],
            [
              { x: 17, z: -10 },
              { x: 17, z: 10 },
            ],
          ]
        : [
            [
              { x: -7, z: 6 },
              { x: 7, z: 6 },
            ],
            [
              { x: 0, z: 5 },
              { x: 0, z: -4 },
            ],
          ]
    )
      .map(([m, y]) => {
        let x = [m, ...i(r, m, y)],
          w = [],
          v = 0;
        for (let S = 1; S < x.length; S++) {
          let M = Math.hypot(x[S].x - x[S - 1].x, x[S].z - x[S - 1].z);
          M > 0.001 && (w.push({ from: x[S - 1], to: x[S], start: v, len: M }), (v += M));
        }
        return { segments: w, length: v, start: m };
      })
      .filter((m) => m.length > 1),
    g = e === 0 ? 128 : 8;
  for (let m = 0; m < g; m++) {
    let y = f[m % f.length],
      x = 0.6 + (m % 5) * 0.12,
      w = 1.5 + (m % 4),
      v = (((m * 7) % 5) - 2) * 0.42,
      S = (((m * 11) % 7) - 3) * 0.32,
      M = y.segments.map((_) => ({ ..._, from: { x: _.from.x + v, z: _.from.z + S }, to: { x: _.to.x + v, z: _.to.z + S } })),
      T = M.every((_) =>
        [0, 0.25, 0.5, 0.75, 1].every((B) => s(r, _.from.x + (_.to.x - _.from.x) * B, _.from.z + (_.to.z - _.from.z) * B, 0.24)),
      )
        ? { segments: M, length: y.length, start: M[0].from }
        : y;
    if (e === 0 && m % 4 === 0) {
      let _ = SHOPS[Math.floor(m / 4) % 12],
        B = _.door[0] + (((m / 4) % 3) - 1) * 1.6,
        L = _.door[1] + 2 + (m % 3) * 0.65;
      s(r, B, L, 0.5) && !h.some((G) => Math.hypot(G.x - B, G.z - L) < 0.8) && (T = { segments: [], length: 0, start: { x: B, z: L } });
    }
    let E = Math.max(1, (T.length / x) * 2 + w * 2);
    r.lifeActors.push({
      id: "crowd-" + e + "-" + m,
      name: "Passing resident",
      role: "",
      x: T.start.x,
      z: T.start.z,
      routine: ["walk", "read", "sip", "work", "carry", "walk", "wait", "walk"][m % 8],
      route: T.segments,
      routeLength: T.length,
      pace: x,
      hold: w,
      phase: ((m * 0.61803398875) % 1) * E,
      color: ["#527b82", "#8f7760", "#667889", "#875e6d", "#63795e", "#938e79", "#526369", "#9c8368", "#6f6485"][m % 9],
      skin: ["#bc9271", "#8e624b", "#d1b393", "#6a4739"][m % 4],
      umbrella: e === 0 && m % 4 !== 0,
      crowd: !0,
      accessory: m % 6,
      bodyScale: 0.88 + (m % 5) * 0.045,
    });
  }
  return ((r.crowdCount = g), (r.namedCount = r.residents.length), r);
}
function districtDoors(r, e = !1) {
  return r === 0
    ? [
        { destination: 1, x: -8, z: 7 },
        { destination: 2, x: 8, z: 7 },
        ...SHOPS.map((t) => ({ destination: t.room, x: t.door[0], z: t.door[1] })),
      ]
    : r === 1
      ? [{ destination: 0, x: -8, z: 7 }, { destination: 2, x: 8, z: 7 }, ...(e ? [{ destination: 10, x: 0, z: 8.5 }] : [])]
      : r === 2
        ? [
            { destination: 0, x: -8, z: 7 },
            { destination: 1, x: 8, z: 7 },
          ]
        : [{ destination: 0, x: 0, z: 8.7 }, ...(r === 10 && e ? [{ destination: 1, x: 8, z: 7 }] : [])];
}
var PALETTE = {
  ink: "#091319",
  concrete: "#24323a",
  edge: "#35464b",
  gold: "#ffb75e",
  cyan: "#64e2dc",
  pink: "#f270ab",
  cream: "#eee5cf",
  coat: "#b88c61",
};
function buildCaseStreet(r) {
  let e = [],
    t = [],
    s = [],
    i = [],
    n = 431 + r * 1987,
    o = () => ((n = (n * 1664525 + 1013904223) >>> 0), n / 4294967296),
    a = (T, E, _, B, L, G, Z, W, se = {}) => {
      let ae = { type: T, x: E, y: _, z: B, w: L, h: G, d: Z, color: W, ...se };
      return (e.push(ae), ae);
    },
    l = (T, E, _, B, L, G, Z, W = {}) => a("box", T, E, _, B, L, G, Z, W),
    c = (T, E, _, B, L, G, Z = {}) => a("cylinder", T, E, _, B * 2, L, B * 2, G, Z),
    h = (T, E, _, B, L, G, Z = !1) => a("sign", E, _, B, L, Z ? L * 2.5 : L * 0.29, 0.05, G, { text: T, vertical: Z, emissive: 1.8 }),
    u = (T, E, _, B, L = 1.2, G = "#253940") => {
      (l(T, L / 2, E, _, L, B, G), t.push({ x: T, z: E, w: _, d: B }));
    },
    d = (T, E, _ = "#728288", B = "person") => {
      s.push({ x: T, z: E, color: _, style: B, phase: o() * 6 });
    },
    p = (T, E, _, B, L, G = 0.16) => a("glow", T, 0.018, E, _, 0.02, B, L, { alpha: G }),
    f = (T, E, _ = PALETTE.gold) => {
      (c(T, 2.3, E, 0.07, 4.6, "#33424c"), l(T + 0.3, 4.5, E, 0.9, 0.12, 0.3, _, { emissive: 2 }), p(T, E, 2.5, 4, _));
    },
    g = (T, E, _ = 1) => {
      (c(T, 0.35 * _, E, 0.4 * _, 0.7 * _, "#514745"), l(T, 1.15 * _, E, 0.12, 1.5 * _, 0.12, "#47483a"));
      for (let B = 0; B < 5; B++)
        a("cone", T + (o() - 0.5) * 0.8, 1.6 * _ + o() * 0.8, E + (o() - 0.5) * 0.8, 1.1 * _, 1.3 * _, 1.1 * _, "#4c6b58");
    },
    m = (T, E) => {
      (u(T, E, 2.2, 0.8, 0.45, "#6e5547"), l(T, 0.9, E - 0.32, 2.2, 0.7, 0.14, "#765d4d"));
    },
    y = (T, E, _, B) => {
      (u(T, E, 1.3, 1.05, 2.4, "#20343c"), l(T, 1.6, E + 0.55, 0.92, 0.72, 0.035, B, { emissive: 0.7 }), h(_, T, 2.75, E + 0.6, 1.65, B));
    },
    x = (T, E, _, B, L = !1) => {
      a("car", T, E, _, 2.25, 0.8, 4, B, { fly: L });
    };
  (l(0, -0.58, 0, 25, 1.1, 23, "#101f28"),
    l(0, -0.05, 0, 24.5, 0.18, 22.5, "#1c2b33", { wet: !0 }),
    l(0, -0.43, 11.53, 25, 0.08, 0.06, "#627279"));
  for (let T = -11; T <= 11; T += 1.5)
    for (let E = -10; E <= 10; E += 1.5)
      o() > 0.68 && p(T, E, 0.9 + o() * 1.7, 0.13 + o() * 0.7, o() > 0.5 ? "#49bcb9" : "#be8290", 0.045 + o() * 0.04);
  let w = (T, E, _, B, L, G) => {
    (l(T, L / 2 - 0.1, E, _, L, B, ["#17242f", "#20303b", "#1d2b34"][G % 3]), l(T, L + 0.12, E, _ + 0.25, 0.3, B + 0.25, "#29383f"));
    for (let Z = 1.6; Z < L - 0.5; Z += 1.1)
      for (let W = -_ / 2 + 0.48; W < _ / 2 - 0.2; W += 0.75)
        o() > 0.35 && l(T + W, Z, E + B / 2 + 0.015, 0.25, 0.45, 0.025, o() > 0.67 ? "#bc8758" : "#427478", { emissive: 0.3 });
    l(T, L + 1, E, 0.35, 1.8, 0.35, "#35424a");
  };
  for (let T = 0; T < 11; T++) w(-24 + T * 4.8, -21 - o() * 5, 3.5 + o(), 3.5, 10 + o() * 15, T);
  for (let T = 0; T < 5; T++) w(-19, -11 + T * 5.5, 3.6, 4, 8 + o() * 9, T + 1);
  for (let T = 0; T < 4; T++) w(20, -13 + T * 5.4, 4, 4, 10 + o() * 9, T + 2);
  for (let T = 0; T < 7; T++) l(4, 3 + T * 2.1, -33, 22 - T * 2.3, 2.1, 14 - T * 1.3, "#25323a");
  (h("ASTER", 4, 17.2, -25.8, 5, "#d9a96b"), x(-14, 8, -13, "#465c6d", !0), x(14, 12, -17, "#444e67", !0));
  let S = ["street", "station", "hotel", "apartment", "market", "lab", "club", "roof", "workshop", "tower", "storm", "dock"][r],
    M = ["station", "hotel", "apartment", "lab", "club", "workshop", "tower"].includes(S);
  if (M) {
    (l(0, 2, -10.3, 24, 4, 0.5, "#2b3439"), l(-12, 1.3, 0, 0.35, 2.6, 21, "#30373b"));
    for (let T = -10; T <= 10; T += 2) l(T, 2.4, -10, 0.12, 3.7, 0.1, r === 9 ? "#ae915f" : "#4c6064");
    for (let T = -10; T <= 10; T += 2.5) l(T, 0.07, 0, 0.02, 0.01, 21, "#31494f");
    for (let T = -10; T <= 10; T += 2.5) l(0, 0.07, T, 24, 0.01, 0.02, "#31494f");
  }
  if (S === "street" || S === "market") {
    l(2, 0.04, 1, 4.3, 0.08, 20, "#17252d", { wet: !0 });
    for (let T = -9; T < 10; T += 3.2) l(2, 0.092, T, 0.1, 0.016, 1.2, "#837c62");
    (l(-6.7, 0.15, -3, 8, 0.3, 12, "#394144"), u(-6, -7, 9, 4, 4, "#283639"), l(-6, 3.95, -4.8, 10, 0.24, 4.2, "#7e4035"));
    for (let T = 0; T < 10; T++) l(-10.5 + T, 4.1, -4.6, 0.42, 0.09, 4.2, T % 2 ? "#be7151" : "#66443b");
    (h(S === "market" ? "LITTLE WONDERS" : "NIGHTSHIFT", -6, 4.75, -4.7, 7.5, PALETTE.gold), l(-6, 2.35, -4.97, 7.5, 1.6, 0.08, "#765940"));
    for (let T = -9; T < -2; T += 1.15) l(T, 2.4, -4.86, 0.03, 1.5, 0.12, "#c18a4f");
    (u(-6, -3.25, 7.4, 1.2, 1.25, "#9b6445"), l(-6, 1.28, -3.25, 7.8, 0.18, 1.5, "#b69262"));
    for (let T = -8.8; T < -2.5; T += 1.45)
      (c(T, 1.53, -3.2, 0.24, 0.2, "#c9b58d"),
        c(T, 1.65, -3.2, 0.18, 0.03, "#9d5b38"),
        l(T + 0.15, 1.68, -3.2, 0.04, 0.04, 0.65, "#dfc09a"),
        c(T, 0.55, -1.8, 0.35, 0.12, "#804535"),
        c(T, 0.25, -1.8, 0.07, 0.5, "#34434b"));
    for (let T = -9; T < -2; T += 2)
      (c(T, 3.12, -3.9, 0.32, 0.72, "#d56a39", { emissive: 0.9 }),
        l(T, 3.6, -3.9, 0.035, 0.45, 0.035, "#303c42"),
        p(T, -1, 2, 5, PALETTE.gold, 0.22));
    (d(-6.8, -4.5, "#aab6a7"),
      d(-8, -1.2, "#677780"),
      w(8.4, -7.5, 5.9, 5, 7.4, 1),
      h(S === "market" ? "REPAIRS" : "MEMORY", 8.4, 5.8, -4.9, 4.9, PALETTE.pink),
      h("OPEN LATE", 7.6, 3.1, -4.91, 3.7, PALETTE.cyan),
      y(4.7, -7.1, "24 H", "#70cccd"),
      h("\u96E8", 11.5, 7.8, -4.7, 1.4, "#f079a7", !0),
      l(8.4, 4.8, -4.84, 5.1, 0.07, 0.12, PALETTE.pink, { emissive: 2.2 }),
      p(8, -1, 4.8, 8, PALETTE.pink, 0.19),
      p(5, -4, 3, 4, PALETTE.cyan, 0.15),
      f(-10.3, 5),
      f(10, 0, PALETTE.cyan),
      m(-8.4, 7.5),
      x(7.5, 0.65, 5.1, "#47677a"),
      d(4, 4, "#877484"),
      d(-1, 7, "#476570"),
      l(-10, 0.55, 1.7, 0.7, 1.1, 0.9, "#42727a"),
      S === "market" && (y(-9, 3, "MOTHS", PALETTE.gold), y(8, 0, "PARTS", PALETTE.pink), g(9, 9)));
  }
  if (S === "station") {
    h("CIVIC / ARCHIVES", 0, 4, -9.8, 10, PALETTE.cyan);
    for (let T = -8; T <= 8; T += 8) (u(T, -7, 2.4, 1.2, 2.2, "#344a50"), l(T, 1.7, -6.35, 1.6, 0.8, 0.06, "#639e92", { emissive: 0.7 }));
    for (let T of [-9, 9]) for (let E of [-3, 4]) u(T, E, 0.8, 0.8, 4, "#4b5656");
    (l(0, 0.13, 0, 3, 0.02, 16, "#365353"), m(-8, 7), m(5, 7), d(-5, -3, "#728c94"), p(0, -2, 10, 8, PALETTE.cyan, 0.12));
  }
  if (
    (S === "hotel" &&
      (h("HALCYON / 404", 0, 4, -9.9, 8, "#eea989"),
      u(-6, -6.5, 4.5, 3.1, 0.6, "#49494d"),
      l(-6, 0.79, -6.5, 4.2, 0.36, 2.8, "#8a8580"),
      l(-7, 0.99, -6.6, 1, 0.2, 2, "#b4ad95"),
      u(8, -6, 1.6, 3, 2.1, "#544940"),
      l(8, 2.5, -6, 0.16, 0.6, 0.16, PALETTE.gold, { emissive: 1 }),
      u(0, -8, 3, 0.8, 1, "#5f5244"),
      h("NO VACANCY", 6, 3.3, -9.9, 3, PALETTE.pink),
      g(-9, 6),
      p(2, -5, 7, 7, "#b97468", 0.13)),
    S === "apartment")
  ) {
    (h("A ROOM OF YOUR OWN?", 0, 4.3, -9.9, 10, "#aabaaf"), l(1, 2.7, -9.94, 10, 2, 0.05, "#477c85", { emissive: 0.25 }));
    for (let T = 1.8; T < 3.6; T += 0.25) l(1, T, -9.8, 10, 0.065, 0.1, "#2d393c");
    (u(-6, -6, 3.8, 1.2, 1.3, "#655042"),
      l(-6, 2, -6, 1.7, 1.15, 0.5, "#2b4447"),
      l(-6, 2, -5.72, 1.4, 0.8, 0.03, PALETTE.cyan, { emissive: 0.5 }),
      u(6, -6, 3.8, 1.8, 0.7, "#805e51"),
      l(6, 1.2, -6.75, 3.8, 0.7, 0.3, "#896650"),
      u(-9, 3, 1.2, 3, 1.1, "#57413b"));
    for (let T = 2; T < 4; T += 0.22) l(-8.3, 1.1, T, 0.25, 0.05, 0.16, "#d1cbb5");
    (g(8, 7, 1.2), p(0, -3, 9, 7, "#88c2c2", 0.15), m(2, 7));
  }
  if (S === "lab") {
    h("NEMI / COLD STORAGE", 0, 4.2, -9.8, 10, PALETTE.cyan);
    for (let T = -9; T <= 9; T += 3)
      (u(T, -7, 1.9, 1.9, 2.7, "#456068"),
        l(T, 1.7, -5.99, 1.3, 1.7, 0.03, "#77bcb9", { emissive: 0.35 }),
        c(T, 2, -7, 0.4, 0.9, "#99bdaf", { emissive: 0.3 }));
    u(-8, 1, 2, 3, 0.95, "#76817b");
    for (let T = 0; T <= 2; T++) c(-8, 1.5, T, 0.23, 0.8, "#b7d5b7", { emissive: 0.35 });
    (l(0, 0.15, 0, 10, 0.03, 9, "#37555b"), p(0, -3, 17, 7, PALETTE.cyan, 0.18), d(-5, -3, "#8eadaa"));
  }
  if (S === "club") {
    (h("BLUE HOUR", 0, 5, -9.8, 9, PALETTE.pink), l(0, 0.25, -6, 9, 0.5, 5, "#48404f"), l(0, 2.3, -9.8, 11, 4, 0.1, "#573349"));
    for (let T = -5; T < 6; T += 0.7) l(T, 2.3, -9.66, 0.25, 4, 0.12, "#6e4358");
    (c(-2, 1.1, -5, 0.06, 1.7, "#687c81"), l(-2, 2, -5, 0.13, 0.2, 0.3, "#a6bbb6"));
    for (let T = -3; T <= 3; T += 1.5)
      for (let E = -1; E <= 3; E += 1.5) l(T, 0.07, E, 1.37, 0.03, 1.37, (T + E) % 3 ? "#27535f" : "#72506a", { emissive: 0.14 });
    for (let T of [-9, 9]) for (let E of [-4, 2, 7]) (c(T, 0.7, E, 0.65, 0.18, "#78535d"), c(T, 0.3, E, 0.09, 0.6, "#45505b"));
    (d(-3, -4, "#cea49b"), p(-3, 0, 5, 10, PALETTE.pink, 0.23), p(4, 0, 5, 9, PALETTE.cyan, 0.19));
  }
  if (S === "roof" || S === "storm") {
    for (let T of [-10, 10]) {
      l(T, 0.25, 0, 0.12, 0.45, 20, "#6e7776");
      for (let E = -9; E < 10; E += 2.5) l(T, 0.75, E, 0.09, 1, 0.09, "#677578");
    }
    for (let [T, E] of [
      [-6, -6],
      [6, -7],
      [-8, 2],
      [5, 3],
    ]) {
      (u(T, E, 2.6, 1.7, 1.3, "#445761"), l(T, 1.4, E, 2.7, 0.12, 1.8, "#61767a"));
      for (let _ = 0; _ < 6; _++) l(T - 1 + _ * 0.4, 1.48, E, 0.1, 0.05, 1.5, "#243a42");
    }
    for (let T of [-7, 7]) (c(T, 4, -9, 0.17, 8, "#71878c"), l(T, 6.2, -9, 3, 0.08, 0.08, PALETTE.cyan, { emissive: 0.4 }));
    if (S === "storm") {
      c(0, 6.6, -8, 0.27, 13, "#708182");
      for (let T = 5; T <= 12; T += 2) l(0, T, -8, 6 - (T - 5) * 0.5, 0.12, 0.12, "#789496");
      h("WEATHER / CROWN", 0, 3, -10, 9, PALETTE.cyan);
    }
    for (let T = 0; T < 5; T++) i.push({ x: [-3, 2, 4, -2, 7][T], z: [-3, -2, 3, 5, -6][T], r: 1.15, phase: T * 0.83 });
    (p(0, -1, 18, 18, PALETTE.cyan, 0.06), f(-9, 7), d(7, -1, "#758587"));
  }
  if (S === "workshop") {
    (h("SOL / SMALL MIRACLES", 0, 4.4, -9.8, 11, PALETTE.gold), g(-7, -6, 2.5), g(7, -7, 2), g(8, 7, 1.3), u(0, -7.5, 6, 1.5, 1, "#796049"));
    for (let T = -2; T < 3; T++) d(T, -7, "#b88464", "toy");
    l(0, 0.08, 0, 8, 0.04, 7, "#5b5946");
    for (let T = -4; T <= 5; T += 3) d(-9, T, ["#7d9d8f", "#a68564", "#77909d"][(T + 4) / 3], "toy");
    (m(5, 5), p(0, -1, 10, 10, PALETTE.gold, 0.13));
  }
  if (S === "tower") {
    h("ASTER / OUR FUTURE, REMEMBERED", 0, 4.5, -9.8, 15, PALETTE.gold);
    for (let T of [-9, 9]) for (let E of [-6, 1, 7]) u(T, E, 0.7, 0.7, 5, "#ae8d56");
    (l(0, 0.13, 0, 6, 0.03, 20, "#65573e"), u(0, -7.6, 7, 1.4, 1.2, "#7a674a"), l(0, 1.9, -7.6, 2.2, 1, 0.1, "#acb98a", { emissive: 0.5 }));
    for (let T = -8; T <= 8; T += 4) l(T, 2.6, -9.9, 2, 2.7, 0.08, "#b7904b", { emissive: 0.2 });
    (p(0, -3, 16, 12, PALETTE.gold, 0.18), d(-5, -3, "#cbc2a7"));
  }
  if (S === "dock") {
    (l(18, -0.4, 3, 18, 0.14, 27, "#3c737d", { wet: !0 }), l(0, 0.07, 0, 21, 0.12, 20, "#5f665c"));
    for (let T = -10; T < 11; T += 0.8) l(T, 0.15, 0, 0.04, 0.015, 20, "#424f4d");
    h("MORNING / FERRY", 0, 4.2, -9.8, 11, PALETTE.gold);
    for (let T of [-10, 10]) for (let E = -9; E < 9; E += 3) c(T, 0.6, E, 0.18, 1.2, "#7b7760");
    (l(14, 0.7, 4, 5, 1.3, 10, "#ccbaa0"),
      l(14, 2.05, 3, 3.5, 1.6, 5, "#405e69"),
      l(14, 2.4, 5.55, 3, 1, 0.04, "#b4d3c2"),
      l(11.1, 0.23, 6, 3, 0.3, 2, "#9f9173"),
      m(-7, 6),
      y(-8, -6, "COFFEE", PALETTE.gold),
      d(2, -5, "#9ea7a0"),
      g(7, -7),
      p(0, 0, 20, 20, PALETTE.gold, 0.07));
  }
  return {
    objects: e,
    colliders: t,
    npcs: s,
    hazards: i,
    type: S,
    mood: S === "dock" ? "dawn" : S === "lab" ? "cold" : S === "tower" ? "gold" : "night",
    indoor: M,
    bounds: { minX: -11.3, maxX: 11.3, minZ: -10, maxZ: 10.3 },
  };
}
function walkable(r, e, t, s = 0.3) {
  let i = r.bounds;
  return e < i.minX + s || e > i.maxX - s || t < i.minZ + s || t > i.maxZ - s
    ? !1
    : !r.colliders.some((n) => Math.abs(e - n.x) < n.w / 2 + s && Math.abs(t - n.z) < n.d / 2 + s);
}
function findPath(r, e, t) {
  let i = Math.min(-12, Math.floor(Math.min(r.bounds.minX, r.bounds.minZ) / 0.6) * 0.6),
    n = Math.ceil((Math.max(r.bounds.maxX, r.bounds.maxZ) + 1 - i) / 0.6) + 1,
    o = (M) => Math.max(0, Math.min(n - 1, Math.round((M - i) / 0.6))),
    a = (M, N) => ({ x: i + M * 0.6, z: i + N * 0.6 }),
    l = o(e.x),
    c = o(e.z),
    h = o(t.x),
    u = o(t.z),
    d = (M, N) => N * n + M,
    p = [{ x: l, z: c, g: 0, f: 0 }],
    f = new Map([[d(l, c), 0]]),
    g = new Map(),
    m = new Set(),
    y = null,
    x = null,
    w = 1 / 0;
  for (let M = 0; p.length && M < n * n; M++) {
    p.sort((_, B) => _.f - B.f);
    let N = p.shift(),
      T = d(N.x, N.z);
    if (m.has(T)) continue;
    m.add(T);
    let E = Math.hypot(N.x - h, N.z - u);
    if ((E < w && ((w = E), (x = N)), E < 1.5)) {
      y = N;
      break;
    }
    for (let _ = -1; _ <= 1; _++)
      for (let B = -1; B <= 1; B++) {
        if (!_ && !B) continue;
        let L = N.x + _,
          G = N.z + B;
        if (L < 0 || G < 0 || L >= n || G >= n) continue;
        let Z = a(L, G);
        if (!walkable(r, Z.x, Z.z, 0.33)) continue;
        if (_ && B) {
          let ae = a(N.x + _, N.z),
            Te = a(N.x, N.z + B);
          if (!walkable(r, ae.x, ae.z, 0.33) || !walkable(r, Te.x, Te.z, 0.33)) continue;
        }
        let W = d(L, G),
          se = N.g + Math.hypot(_, B);
        se >= (f.get(W) ?? 1 / 0) || (f.set(W, se), g.set(W, T), p.push({ x: L, z: G, g: se, f: se + Math.hypot(L - h, G - u) }));
      }
  }
  if (((y = y || x), !y)) return [];
  let v = d(y.x, y.z),
    S = [];
  for (; v !== d(l, c) && (S.push(a(v % n, Math.floor(v / n))), (v = g.get(v)), v !== void 0); );
  return S.reverse();
}
function buildRoom(r, e = 0) {
  let t = CASE_SETTINGS[r].rooms[e],
    s = e ? buildCaseRoom(r, e, t) : buildCaseStreet(r);
  ((s.title = t.name), scatterClutter(s, r, e));
  let i = CASES[r].tasks.filter((n) => (n.room || 0) === e);
  return (addLife(s, r, e, i, walkable, findPath), r === 0 ? buildDistrictRoom(s, e, i, walkable, findPath) : s);
}
var PORTRAIT_CACHE = new Map(),
  escapeSvg = (r) => String(r).replace(/[&<>"']/g, (e) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[e]);
function portrait(r, e = "neutral", t = !1, s = !1) {
  let i = r + ":" + e + ":" + t + ":" + s;
  if (PORTRAIT_CACHE.has(i)) return PORTRAIT_CACHE.get(i);
  let n = RESIDENT_BY_ID[r],
    o = n?.index ?? (r === "vale" ? 56 : Array.from(r).reduce((_, B) => _ + B.charCodeAt(0), 0) % 50),
    a = n?.name || (r === "vale" ? "Inspector Vale" : r),
    l = "face-" + r + "-" + e + (t ? "-pin" : "") + (s ? "-sparrow" : ""),
    c = ["#c99d79", "#925f48", "#d6b295", "#ac7c5a", "#724b3d", "#b1876d"][o % 6],
    h = ["#926650", "#623b32", "#9a7461", "#744a3d", "#4e322c", "#7c564b"][o % 6],
    u = ["#172730", "#a79e8b", "#3d2729", "#252a30", "#887164", "#55483d", "#c0beb2"][o % 7],
    d = n?.color || "#a48461",
    p = ["#72c6c6", "#de9d74", "#c298c2", "#bdd291"][o % 4],
    f = 52 + (o % 4) * 4,
    g = 223 + (o % 3) * 6,
    m = 149 + (o % 3) * 3,
    y = o % 8 === 0,
    x = o % 9 === 0 || ["ves", "tavi", "joel", "otto", "eli"].includes(r),
    w = ["bo", "neri", "sai", "jin", "eda", "sela", "roan", "tess", "pax"].includes(r),
    v = ["iri", "fen", "sena", "nima", "reva", "zuri", "nola", "luz", "min"].includes(r),
    S = ["rusk", "dahl", "tarn", "pavel", "omar", "otto"].includes(r),
    M = o % 4 === 1,
    N =
      e === "guarded"
        ? "M110 138l28 8m40-1 26-9"
        : e === "warm"
          ? "M111 140q13-8 27-1m39 0q14-8 28 0"
          : e === "concerned"
            ? "M110 144l29-8m40 1 24 8"
            : "M111 141l28-1m38 0 28 2",
    T =
      e === "warm"
        ? "M137 200q22 16 44-1"
        : e === "concerned"
          ? "M137 206q21-11 43 0"
          : e === "guarded"
            ? "M137 204l45-3"
            : "M139 203q20 5 40-1",
    E = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 380" role="img" aria-label="${escapeSvg(a)}, ${e} portrait"><defs><linearGradient id="${l}-bg" x2="1" y2="1"><stop stop-color="#233b49"/><stop offset=".52" stop-color="#101d2c"/><stop offset="1" stop-color="#382c35"/></linearGradient><linearGradient id="${l}-skin"><stop stop-color="${h}"/><stop offset=".45" stop-color="${c}"/><stop offset="1" stop-color="${c}"/></linearGradient><linearGradient id="${l}-coat" x2="1" y2="1"><stop stop-color="${d}"/><stop offset="1" stop-color="#192a32"/></linearGradient><linearGradient id="${l}-rim"><stop stop-color="${p}" stop-opacity=".55"/><stop offset=".65" stop-color="${p}" stop-opacity="0"/></linearGradient><clipPath id="${l}-clip"><rect width="320" height="380" rx="4"/></clipPath></defs><g clip-path="url(#${l}-clip)"><rect width="320" height="380" fill="url(#${l}-bg)"/>
 ${Array.from({ length: 9 }, (_, B) => `<rect x="${B * 43 - 18}" y="${24 + ((B * 31 + o * 7) % 95)}" width="${12 + (B % 3) * 4}" height="${300 - B * 10}" fill="${B % 3 === 0 ? p : "#496773"}" opacity="${B % 3 === 0 ? 0.12 : 0.21}"/>`).join("")}<path d="M18 0v380M33 0v380M289 0v380" stroke="${p}" opacity=".25"/><path d="M0 279h320M0 287h320" stroke="${p}" opacity=".12"/>
 ${v ? `<path d="M89 112Q83 58 152 55Q226 56 230 124L251 290 201 300 96 283 71 286Z" fill="${u}"/>` : ""}
 <path d="M23 386l15-71q5-27 55-43l41-14h49l47 16q47 13 51 44l18 68" fill="url(#${l}-coat)" stroke="#122731" stroke-width="4"/><path d="M130 218l-2 47 31 27 30-28-8-49" fill="${h}"/><path d="M140 223v38l19 17 15-13v-42" fill="${c}"/>
 <path d="M93 138q-20-13-18 10l8 30 15 4m128-42q17-14 14 11l-8 26-12 2" fill="${h}"/>
 <path d="M${160 - f} 105Q111 72 160 73q57 1 ${f} 40l-4 63q-1 31-34 ${g - 177}l-25 8-26-13q-28-20-30-43Z" fill="url(#${l}-skin)" stroke="#3a3030" stroke-width="2"/>
 <path d="M108 120l-8 61 24 34 14 8-13-29-5-24 8-41" fill="${h}" opacity=".56"/><path d="M194 125l19 17-2 50-25 29" fill="none" stroke="${p}" stroke-width="3" opacity=".36"/>
 <path d="M96 131Q82 65 141 54q60-8 83 49l-4 38-15-21-12-30-26 20-45-7-13 33Z" fill="${u}"/>
 ${o % 5 === 2 ? '<path d="M105 99q45-30 96 3m-99 7q45-30 103 3" fill="none" stroke="#d2c8b3" stroke-width="4" opacity=".46"/>' : ""}
 ${v ? `<path d="M120 76q-31 61-21 144l-17 68 11-113-3-66Z" fill="${u}"/><path d="M189 82q30 41 22 129l19 43-4-131Z" fill="${u}"/>` : ""}
 ${w ? `<path d="M88 105q-4-44 69-50 66 4 70 50l-12 10-112-2Z" fill="${d}" stroke="#213641" stroke-width="3"/><path d="M87 103l142-2 16 15-146 9Z" fill="#263a43"/><path d="M113 79h34" stroke="${p}" stroke-width="5"/>` : ""}
 <path d="${N}" fill="none" stroke="${u}" stroke-width="5" stroke-linecap="round"/>
 <path d="M111 ${m + 6}q13-11 29 0-15 8-29 0m65 0q15-11 30 0-15 8-30 0" fill="#e0ccae"/>
 <circle cx="128" cy="${m + 5}" r="5.3" fill="#344342"/><circle cx="190" cy="${m + 5}" r="5.3" fill="${o % 10 === 4 ? p : "#35494b"}"/><circle cx="129" cy="${m + 5}" r="2.5" fill="#14222c"/><circle cx="191" cy="${m + 5}" r="2.5" fill="#14222c"/>
 <path d="M159 149l-10 35 16 5m-40-17-13 3m88-3 11 4" fill="none" stroke="${h}" stroke-width="3" stroke-linecap="round"/>
 ${S ? `<path d="M111 189l24 11 22-6 27 7 26-16-8 28-28 25-28-1-25-24Z" fill="${u}" opacity=".8"/>` : ""}
 <path d="${T}" fill="none" stroke="${S ? c : "#704d48"}" stroke-width="3" stroke-linecap="round"/>
 ${o % 3 === 0 ? `<path d="M117 174l17 3m42 0 19-2m-77-11 15 2m43 0 20-2" stroke="${h}" stroke-width="1.5" opacity=".68"/>` : ""}
 ${y ? '<path d="M192 130l8 36-6 18m0-22 10-3m-9-4 7-2" stroke="#ead2ba" fill="none" stroke-width="1.5" opacity=".7"/>' : ""}
 ${x ? '<g fill="#2a4a50" fill-opacity=".28" stroke="#c7b795" stroke-width="3"><rect x="101" y="143" width="46" height="28" rx="9"/><rect x="172" y="143" width="46" height="28" rx="9"/><path d="M147 150h25m-71-1-9-4m126 4 7-4" fill="none"/></g>' : ""}
 ${M ? `<circle cx="224" cy="181" r="7" fill="none" stroke="${p}" stroke-width="3"/>` : ""}
 <path d="M128 257l31 39 29-38 25 51-43 71h-38l-35-74Z" fill="#202e34"/><path d="M124 262l-20-2-27 56 48-10-9 24 31 50 9-81Z" fill="${d}"/><path d="M190 261l21 3 31 53-43-8 8 25-39 46-6-81Z" fill="${d}"/>
 <path d="M51 325l-9 55m226-53 11 53m-188-49 20 45m109-46-19 45" stroke="#182b33" stroke-width="3" opacity=".5"/>
 ${["sena", "luz"].includes(r) ? '<path d="M222 312v27m-13-13h26" stroke="#dae6d7" stroke-width="5"/>' : ""}
 ${["mara", "ada", "fenna", "june", "tomo"].includes(r) ? '<path d="M127 311h65l16 69H110Z" fill="#b6a185" opacity=".7"/><path d="M134 334h49v26h-49Z" stroke="#554c45" fill="none" stroke-width="2"/>' : ""}
 ${s ? '<path d="M91 310l9-9 13 7-12 9-3-6Z" fill="#99c8b4"/><path d="M98 306l-7-5 2 11" fill="#d7d2a6"/>' : ""}
 ${t || r === "vale" ? '<path d="M213 302l10-6 11 6-2 18-10 8-10-9Z" fill="#d9b567"/><path d="M218 307l10 0-5 12Z" fill="#795f41"/>' : ""}
 <path d="M86 73l-34 291" stroke="url(#${l}-rim)" stroke-width="7"/><rect width="320" height="380" fill="url(#${l}-rim)" opacity=".1"/>
 ${Array.from({ length: 12 }, (_, B) => `<path d="M${B * 31 + 13} 0l-36 380" stroke="#d4e4de" opacity=".025"/>`).join("")}
 <rect x="15" y="16" width="5" height="5" fill="${p}"/><path d="M25 18h36M15 25v20m290 304v16h-30" fill="none" stroke="${p}" opacity=".55"/><rect y="360" width="320" height="20" fill="#10232c" opacity=".75"/><text x="18" y="374" font-family="monospace" font-size="9" letter-spacing="2" fill="#b7c8c4">RAINWARD / ${String(o + 1).padStart(2, "0")} / ${e.toUpperCase()}</text></g></svg>`;
  return (PORTRAIT_CACHE.set(i, E), E);
}

export {
  CASES,
  CASE_SETTINGS,
  CITY_LORE,
  DISTRICT_NAME,
  ITEMS,
  LIFE_PLACES,
  LOCAL_GOODS,
  LOCAL_QUESTS,
  QUEST_BY_ID,
  RESIDENTS,
  RESIDENT_BY_ID,
  SAVE_KEY,
  SHOPS,
  SKILLS,
  STEALTH_COVER,
  STEALTH_WALLS,
  STREET_VOICES,
  THREADS,
  WITNESSES,
  actorPose,
  animatePart,
  buildRoom,
  buyLocal,
  canAfford,
  circuitLayout,
  circuitPower,
  closeCase,
  completeTask,
  countArrival,
  districtDoors,
  districtTotals,
  echoesFor,
  endingFor,
  findPath,
  hasPerk,
  hearResidentTopic,
  hearWitness,
  inspectObservation,
  interviewAnswer,
  isDone,
  isReady,
  lifeParticles,
  localPrice,
  markChanged,
  markHeard,
  markSeen,
  meetResident,
  newGame,
  patrolPositions,
  portrait,
  questNextStep,
  questStatusLabel,
  rankName,
  readLore,
  recordMistake,
  residentsInRoom,
  resolveQuest,
  roomResolved,
  rotateTile,
  startQuest,
  stealthMove,
  taskProgress,
  testQuestDevice,
  timelineSolved,
  trainSkill,
  validateSave,
  walkable,
};
