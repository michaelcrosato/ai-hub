/*
 * Electric Sheepish — Before the Rain.
 *
 * The game's own code, recovered from its original single-file bundle (which
 * also carried two copies of three.js) and moved onto the hub's shared 3D
 * stack: three.js r186 from /lib/three, started by kit/boot.js (WebGPU with
 * the WebGL2 fallback), input through kit.input actions (keyboard and mouse,
 * gamepad, touch), quality tiers and the settings panel from the kit.
 *
 * The identifiers are still the bundler's short names; the content (scenes,
 * people, dialogue, favours, puzzles) is unchanged.
 */
import * as THREE from "three/webgpu";
import * as TSL from "three/tsl";
import { boot } from "kit/boot.js";
import { createPost } from "kit/post.js";

var {
    DISTRICT_VERSION: RX,
    DISTRICT_AREAS: $s,
    DISTRICT_PEOPLE: Sl,
    DISTRICT_QUESTS: wr,
    DISTRICT_KEYS: tX,
    DISTRICT_CROWD_COUNT: sX,
  } = {
    DISTRICT_VERSION: "4.0.0",
    DISTRICT_AREAS: [
      {
        id: "noodles",
        index: 0,
        name: "Noodle Row",
        shop: "White Dragon Noodles",
        x: 0,
        z: 12,
        color: "#f2bd79",
        air: "Steam catches beneath a patched canopy. People eat with one shoulder kept out of the rain.",
        sound: "market",
        note: "A seat is a small luxury. Nobody wastes it.",
        stock: "Broth / grain noodles / two pieces. Ask before taking another bowl.",
        lore: [
          {
            id: "noodles-1",
            title: "The stool ledger",
            text: "A row of names has been crossed out, but not erased. Paid meals stay beside unpaid meals. Toma does not display the difference.",
            position: [-7, 7],
          },
          {
            id: "noodles-2",
            title: "The water receipt",
            text: "The kitchen buys clean water by the sealed canister. The washing line uses a different supply.",
            position: [7, 7],
          },
        ],
        overheard: [
          "Keep the empty stool. Someone is still on shift.",
          "Two bowls, one lid. We are sharing the walk home.",
          "The menu is older than that sign. Ask what arrived today.",
          "Your coat can dry here, but not on the burner.",
        ],
      },
      {
        id: "protein",
        index: 1,
        name: "Protein Market",
        shop: "Mariko Protein Grill",
        x: -28,
        z: 12,
        color: "#e88c75",
        air: "Hot griddles, stacked cans, and customers counting tokens twice.",
        sound: "market",
        note: "People bargain over portions, not taste.",
        stock: "Cultured protein / fungus bread / salt greens. Weigh before wrapping.",
        lore: [
          {
            id: "protein-1",
            title: "The ingredient board",
            text: "Three ingredients have fresh paper labels. Substitutions change with each freight delivery. The cook keeps the old labels underneath.",
            position: [-35, 7],
          },
          {
            id: "protein-2",
            title: "The weight seal",
            text: "A brass test weight has its mass stamped into the side. The market scale must return to zero with an empty tray.",
            position: [-21, 7],
          },
        ],
        overheard: [
          "Weigh the empty tray first. I will wait.",
          "Save the starter. The next batch begins with it.",
          "Read the label beneath the old label.",
          "One portion now. Wrap the other for later.",
        ],
      },
      {
        id: "umbrella",
        index: 2,
        name: "Umbrella Arcade",
        shop: "Tannh\xE4user Rainwear",
        x: 28,
        z: 12,
        color: "#ab9edf",
        air: "A dry corridor holds more people than it was built for. Umbrellas drip into shared channels.",
        sound: "arcade",
        note: "A repaired seam can mean one more night at work.",
        stock: "New cloth is upstairs. Good repairs are here.",
        lore: [
          {
            id: "umbrella-1",
            title: "Repair guarantee",
            text: "The guarantee covers the seam, not the weather. Aiko writes every repair date in ink that does not run.",
            position: [21, 7],
          },
          {
            id: "umbrella-2",
            title: "The listening card",
            text: "Please face the speaker. Please leave room for a reply. Jo sells communication cards beside ordinary greeting cards.",
            position: [35, 7],
          },
        ],
        overheard: [
          "Move left. The seam over there still holds.",
          "I can read your card. You do not need to hurry.",
          "This handle belonged to three umbrellas before this one.",
          "The guarantee covers the repair, not the rain.",
        ],
      },
      {
        id: "animals",
        index: 3,
        name: "Animoid Alley",
        shop: "Koi Electric Animal Care",
        x: -28,
        z: -12,
        color: "#90c8ae",
        air: "Small cages, quiet motors, and hand-written feeding times line the alley.",
        sound: "birds",
        note: "Owners remember habits that the service manual never lists.",
        stock: "Feed / cells / quiet repairs. No proof of ownership required for emergency care.",
        lore: [
          {
            id: "animals-1",
            title: "Care before provenance",
            text: "The public leaflet describes shelter, water, and regular service. It does not put a price on affection.",
            position: [-35, -17],
          },
          {
            id: "animals-2",
            title: "The empty cage invoice",
            text: "A cage costs less than its lamp. The invoice has a space for an animal name and another for a serial number.",
            position: [-21, -17],
          },
        ],
        overheard: [
          "Use its name while I change the cell.",
          "That cage has a service card and a birthday.",
          "Quiet does not always mean broken.",
          "I do not need an invoice to miss something.",
        ],
      },
      {
        id: "memory",
        index: 4,
        name: "Pawn & Memory Row",
        shop: "Kipple Pawn & Memory",
        x: 0,
        z: -12,
        color: "#b6a2d0",
        air: "Photographs hang behind a dry sheet of glass. Old machines keep their scratches.",
        sound: "archive",
        note: "The pawn ticket says what an object costs. Its owner tells you what it is worth.",
        stock: "Photographs cleaned, never improved without permission.",
        lore: [
          {
            id: "memory-1",
            title: "The retouch consent form",
            text: "The form asks which marks must stay. Ivo has circled a torn corner: the customer remembers who tore it.",
            position: [-7, -17],
          },
          {
            id: "memory-2",
            title: "The pawn grace period",
            text: "A stamped extension gives a customer seven more nights. The shop keeps the item where its owner can still see it.",
            position: [7, -17],
          },
        ],
        overheard: [
          "Leave the tear. I remember how it happened.",
          "Seven more nights. I wrote the extension on both copies.",
          "Do not improve the face. Just dry the paper.",
          "I know that courtyard, but the street has another name now.",
        ],
      },
      {
        id: "medicine",
        index: 5,
        name: "Medicine Steps",
        shop: "Chela\u2019s Night Clinic",
        x: 28,
        z: -12,
        color: "#81c5cb",
        air: "The clinic opens onto broad, shallow steps. A queue bends around the working lamp.",
        sound: "medical",
        note: "A chair, a clean cup, and time to be heard matter here.",
        stock: "Fictional clinic supplies. Sealed parcels stay sealed.",
        lore: [
          {
            id: "medicine-1",
            title: "The queue board",
            text: "Appointment cards have colours, not diagnoses. The board keeps private information out of the street.",
            position: [21, -17],
          },
          {
            id: "medicine-2",
            title: "The lift notice",
            text: "The housing lift is out of service again. Volunteers carry sealed clinic parcels to residents who cannot use the stairs.",
            position: [35, -17],
          },
        ],
        overheard: [
          "The seat is for whoever needs it next.",
          "No diagnosis on the public board, please.",
          "The parcel stays sealed through the handover.",
          "Someone from the food run is still on the way.",
        ],
      },
      {
        id: "west",
        index: 6,
        name: "Service Alley West",
        shop: "Little Osaka Repairs",
        x: -28,
        z: -36,
        color: "#d5b174",
        air: "Fans, converters, and labelled spare parts fill an open repair bay.",
        sound: "laboratory",
        note: "The district runs on repairs that nobody notices until they stop.",
        stock: "Measure first. Disconnect before repair. Ask for the correct part.",
        lore: [
          {
            id: "west-1",
            title: "The load schedule",
            text: "The lights, food heaters, and clinic have separate circuits. The music outlet is low priority, but it has a place.",
            position: [-35, -41],
          },
          {
            id: "west-2",
            title: "The repair library",
            text: "Borrowed tools have coloured loops. A missing tool is marked as borrowed before it is marked as lost.",
            position: [-21, -41],
          },
        ],
        overheard: [
          "Leave the clinic feed alone. The spare line is marked.",
          "That part is borrowed. Put its tag where you found it.",
          "Disconnect the test lead before you move the cabinet.",
          "A quiet bearing is a successful repair.",
        ],
      },
      {
        id: "bazaar",
        index: 7,
        name: "Night Bazaar Courtyard",
        shop: "Blue Lantern Tea",
        x: 0,
        z: -36,
        color: "#e5af77",
        air: "A small stage faces an uneven court. Tea cups travel between strangers.",
        sound: "piano",
        note: "A familiar tune makes a temporary room out of a street.",
        stock: "Tea after shift / hot cups returned here.",
        lore: [
          {
            id: "bazaar-1",
            title: "The performance slate",
            text: "Tonight\u2019s musicians share one power socket. A handwritten note says the clinic circuit is not available.",
            position: [-7, -41],
          },
          {
            id: "bazaar-2",
            title: "The cup return shelf",
            text: "A deposit keeps cups moving. The shelf also holds cups for people who cannot leave a deposit.",
            position: [7, -41],
          },
        ],
        overheard: [
          "The cups without a deposit go on this shelf.",
          "I know that tune from a room I never entered.",
          "The meeting starts after the late shift.",
          "Keep the centre clear. Someone will dance there eventually.",
        ],
      },
      {
        id: "transit",
        index: 8,
        name: "Transit Spine",
        shop: "Sunburst News & Tickets",
        x: 28,
        z: -36,
        color: "#93b8df",
        air: "Traffic crosses high above. At ground level, travellers wait beside a damaged route board.",
        sound: "flight",
        note: "The advertisements promise distance. The timetable promises only a platform.",
        stock: "Local lines / freight notices / departures subject to review.",
        lore: [
          {
            id: "transit-1",
            title: "The off-world conditions",
            text: "The large headline offers a new life. The small print lists screening, contract terms, and passage conditions. This notice is original game lore.",
            position: [21, -41],
          },
          {
            id: "transit-2",
            title: "The platform correction",
            text: "The platform number has changed three times. Lin keeps a handwritten copy beside the failed public screen.",
            position: [35, -41],
          },
        ],
        overheard: [
          "Platform six. The display still says four.",
          "Read the conditions under the headline.",
          "I have a ticket. I am still deciding whether I have a plan.",
          "A timetable tells you where. It does not tell you why.",
        ],
      },
      {
        id: "east",
        index: 9,
        name: "Service Alley East",
        shop: "Ember Spice & Freight",
        x: -28,
        z: -60,
        color: "#cc9370",
        air: "Warm spice dust reaches a wet loading lane. Parcels wait under borrowed tarps.",
        sound: "ruin",
        note: "Every bright shop has a delivery door behind it.",
        stock: "Freight received by label and signature, not by guesswork.",
        lore: [
          {
            id: "east-1",
            title: "The freight marks",
            text: "Blue means dry storage. A red diagonal means a fragile parcel. The marks survive when a paper address does not.",
            position: [-35, -65],
          },
          {
            id: "east-2",
            title: "The sleeping agreement",
            text: "An alley notice keeps the delivery door clear until midnight. After that, the dry recess belongs to people, not crates.",
            position: [-21, -65],
          },
        ],
        overheard: [
          "Blue for dry storage. Red diagonal for fragile.",
          "The recess is clear after midnight. That is the agreement.",
          "Get a signature from the person, not the shop front.",
          "There is a little warm air beside the freight door.",
        ],
      },
      {
        id: "temple",
        index: 10,
        name: "Little Temple Court",
        shop: "Cinder Books & Offerings",
        x: 0,
        z: -60,
        color: "#c9be90",
        air: "Books sit beside a small shrine. A sheltered bench is almost always occupied.",
        sound: "tower",
        note: "People leave names here without being asked for evidence.",
        stock: "Manuals / second-hand books / blank memorial cards.",
        lore: [
          {
            id: "temple-1",
            title: "The memorial cards",
            text: "Some cards name a person. Others name a pet, a street, or a place the writer cannot return to.",
            position: [-7, -65],
          },
          {
            id: "temple-2",
            title: "The annotated manual",
            text: "Five hands have corrected the same repair diagram. The latest owner leaves room for a sixth.",
            position: [7, -65],
          },
        ],
        overheard: [
          "You can leave the card blank.",
          "That manual has helped four shops already.",
          "The lantern in the picture always leaned left.",
          "Finish your thought. The next move can wait.",
        ],
      },
      {
        id: "roof",
        index: 11,
        name: "Rooftop Access Stair",
        shop: "Cloudline Radio & Salvage",
        x: 28,
        z: -60,
        color: "#87b4bc",
        air: "A radio bench opens beside a stair. Above it, the district becomes a pattern of roofs and light.",
        sound: "wind",
        note: "From the roof, every private room becomes one window among thousands.",
        stock: "Receivers repaired / local weather channel / roof stair to the right.",
        lore: [
          {
            id: "roof-1",
            title: "The receiver map",
            text: "Small circles mark local callers. The map is a network of people who answer, not a list of official transmitters.",
            position: [21, -65],
          },
          {
            id: "roof-2",
            title: "The roof access notice",
            text: "Keep the stair clear. Close the upper gate. The roof is shared space, not an off-world departure lounge.",
            position: [35, -65],
          },
        ],
        overheard: [
          "The radio reaches three streets and one lonely window.",
          "The forecast says rain. This roof can confirm it.",
          "Every window down there contains an ordinary night.",
          "Take the marked stair. The ladder belongs to the delivery crew.",
        ],
      },
    ],
    DISTRICT_PEOPLE: [
      {
        id: "toma",
        index: 0,
        name: "Toma Ishii",
        role: "Noodle cook",
        area: "noodles",
        trait: "Counts bowls by touch.",
        greeting: "There is room at the counter. Keep your coat off the burner.",
        topics: [
          {
            id: "work",
            label: "Ask about their work",
            text: "I cook what arrives, not what the old sign promises. The broth takes more care than the protein.",
          },
          {
            id: "district",
            label: "Ask about life here",
            text: "The first customers want silence. The last customers want someone to notice they came home.",
          },
          {
            id: "memory",
            label: "Ask what they remember",
            text: "My father measured portions with a chipped cup. I still use it. A new cup changes the balance.",
          },
          {
            id: "rumour",
            label: "Ask about a local lead",
            text: "A freight clerk eats here before the late run. Ask Pal about routes, not me.",
          },
        ],
        position: [-5, 9],
        look: { skin: "#c98b69", hair: "#20292e", coat: "#477076", hairStyle: 0, face: 0, accessory: "none", age: 48 },
      },
      {
        id: "sumi",
        index: 1,
        name: "Sumi Kwan",
        role: "Counter bookkeeper",
        area: "noodles",
        trait: "Keeps a dry pencil behind one ear.",
        greeting: "The dry side of the book is for names. What is yours?",
        topics: [
          {
            id: "work",
            label: "Ask about their work",
            text: "I record the meal, the token, and who collected it. A debt is not a public announcement.",
          },
          {
            id: "district",
            label: "Ask about life here",
            text: "We keep a few bowls unclaimed until late. Somebody always finds a use for them.",
          },
          {
            id: "memory",
            label: "Ask what they remember",
            text: "I remember handwriting better than faces. Marta makes a little hook on her meal tickets.",
          },
          {
            id: "rumour",
            label: "Ask about a local lead",
            text: "The token by the drain may belong to a clinic volunteer. Check its mark before you return it.",
          },
        ],
        position: [5, 15],
        look: {
          skin: "#8d583f",
          hair: "#202020",
          coat: "#785752",
          hairStyle: 1,
          face: 1,
          accessory: "glasses",
          age: 34,
        },
      },
      {
        id: "dae",
        index: 2,
        name: "Dae Morgan",
        role: "Utensil washer",
        area: "noodles",
        trait: "Aligns every spoon.",
        greeting: "A spoon is clean when I say it is. Give me a moment.",
        topics: [
          {
            id: "work",
            label: "Ask about their work",
            text: "I use two basins. The supplier bills us for only one kind of water, but we buy two.",
          },
          {
            id: "district",
            label: "Ask about life here",
            text: "Customers talk over the washer. That does not make the washer absent.",
          },
          {
            id: "memory",
            label: "Ask what they remember",
            text: "My old flat had a tap that ran clear. I remember wasting water without knowing it.",
          },
          {
            id: "rumour",
            label: "Ask about a local lead",
            text: "The awning drains toward the stools. Aiko knows which seam has failed.",
          },
        ],
        position: [-5, 19],
        look: {
          skin: "#d7aa86",
          hair: "#6b4336",
          coat: "#6a6554",
          hairStyle: 2,
          face: 2,
          accessory: "earring",
          age: 61,
        },
      },
      {
        id: "marta",
        index: 3,
        name: "Marta Velez",
        role: "Meal courier",
        area: "noodles",
        trait: "Taps a brass token against her sleeve.",
        greeting: "A meal went missing between the kitchen and the clinic. The food is not the expensive part.",
        topics: [
          {
            id: "work",
            label: "Ask about their work",
            text: "I carry dinner to people whose shifts end after the stalls close. I keep the names inside the bag.",
          },
          {
            id: "district",
            label: "Ask about life here",
            text: "People pay when they can. Toma calls it a route problem so nobody has to call it charity.",
          },
          {
            id: "memory",
            label: "Ask what they remember",
            text: "One winter a neighbour brought food to my door. I never found out who asked them.",
          },
          {
            id: "rumour",
            label: "Ask about a local lead",
            text: "Sumi records each token mark. Her ledger can tell us who is still waiting.",
          },
        ],
        position: [6, 20],
        look: { skin: "#6e4639", hair: "#a6a19b", coat: "#486478", hairStyle: 3, face: 3, accessory: "cap", age: 28 },
      },
      {
        id: "fenn",
        index: 4,
        name: "Fenn Okoye",
        role: "Retired dock worker",
        area: "noodles",
        trait: "Hears freight engines before anyone else.",
        greeting: "That engine is running heavy. You learn the sound before you learn the number.",
        topics: [
          {
            id: "work",
            label: "Ask about their work",
            text: "I used to unload sealed containers. I was paid to count them, not to ask what was inside.",
          },
          {
            id: "district",
            label: "Ask about life here",
            text: "Everyone here has a job they no longer do. It does not stop being part of them.",
          },
          {
            id: "memory",
            label: "Ask what they remember",
            text: "I kept a hook from my first shift. It is too worn to use and too useful to throw away.",
          },
          {
            id: "rumour",
            label: "Ask about a local lead",
            text: "The docks have changed a local delivery lane. Pal is still correcting labels.",
          },
        ],
        position: [0, 21],
        look: { skin: "#b87b60", hair: "#583925", coat: "#5c6c55", hairStyle: 4, face: 4, accessory: "scar", age: 72 },
      },
      {
        id: "mariko",
        index: 5,
        name: "Mariko Sato",
        role: "Protein grill owner",
        area: "protein",
        trait: "Tests the griddle with one drop of water.",
        greeting: "Look at the tray before you argue with the price.",
        topics: [
          {
            id: "work",
            label: "Ask about their work",
            text: "My supply changes every week. I can change a recipe faster than I can change a sign.",
          },
          {
            id: "district",
            label: "Ask about life here",
            text: "A small portion has to be honest. People remember the weight even when they forget the taste.",
          },
          {
            id: "memory",
            label: "Ask what they remember",
            text: "My mother could feed six people from what I would now call leftovers.",
          },
          {
            id: "rumour",
            label: "Ask about a local lead",
            text: "Ren says the scale drifts. The repair queue says I am not the only one.",
          },
        ],
        position: [-33, 10],
        look: {
          skin: "#ad7655",
          hair: "#41312e",
          coat: "#71607b",
          hairStyle: 5,
          face: 5,
          accessory: "headwrap",
          age: 43,
        },
      },
      {
        id: "ren",
        index: 6,
        name: "Ren Adeyemi",
        role: "Market customer",
        area: "protein",
        trait: "Carries a brass test weight.",
        greeting: "The same token bought more yesterday. I brought something that does not have an opinion.",
        topics: [
          {
            id: "work",
            label: "Ask about their work",
            text: "This is a certified test weight from my old workshop. An empty tray should return to zero.",
          },
          {
            id: "district",
            label: "Ask about life here",
            text: "Nobody wants a fight in the food queue. That does not make a bad measurement acceptable.",
          },
          {
            id: "memory",
            label: "Ask what they remember",
            text: "I trained apprentices to check the tool before blaming their hands.",
          },
          {
            id: "rumour",
            label: "Ask about a local lead",
            text: "Asa has an independent scale. Compare both readings before you accuse anyone.",
          },
        ],
        position: [-23, 15],
        look: { skin: "#c98b69", hair: "#20292e", coat: "#477076", hairStyle: 6, face: 6, accessory: "visor", age: 56 },
      },
      {
        id: "laleh",
        index: 7,
        name: "Laleh Rahimi",
        role: "Fungus baker",
        area: "protein",
        trait: "Dusts flour from her cuffs before speaking.",
        greeting: "Careful. The last tray is still hot.",
        topics: [
          {
            id: "work",
            label: "Ask about their work",
            text: "The culture stays alive if the room stays warm. I keep a spare starter with a neighbour.",
          },
          {
            id: "district",
            label: "Ask about life here",
            text: "The smell of bread carries farther than our sign. It brings people from the clinic queue.",
          },
          {
            id: "memory",
            label: "Ask what they remember",
            text: "My first starter failed. Someone left a fresh one outside my door without a note.",
          },
          {
            id: "rumour",
            label: "Ask about a local lead",
            text: "A meal courier is looking for a token. The kitchen mark should match the recipient record.",
          },
        ],
        position: [-33, 19],
        look: { skin: "#8d583f", hair: "#202020", coat: "#785752", hairStyle: 7, face: 0, accessory: "beard", age: 48 },
      },
      {
        id: "jules",
        index: 8,
        name: "Jules Tan",
        role: "Ingredient clerk",
        area: "protein",
        trait: "Reads tiny print without glasses.",
        greeting: "The large print is the product. The small print is what we actually received.",
        topics: [
          {
            id: "work",
            label: "Ask about their work",
            text: "I translate labels and count substitutions. A familiar package can contain something new.",
          },
          {
            id: "district",
            label: "Ask about life here",
            text: "We put the ingredient sheet where customers can reach it. Questions should not cost extra.",
          },
          {
            id: "memory",
            label: "Ask what they remember",
            text: "I once bought a box because it showed fruit I remembered. The box was the closest part.",
          },
          {
            id: "rumour",
            label: "Ask about a local lead",
            text: "The latest freight uses colour marks when the address gets wet.",
          },
        ],
        position: [-22, 20],
        look: {
          skin: "#d7aa86",
          hair: "#6b4336",
          coat: "#6a6554",
          hairStyle: 8,
          face: 1,
          accessory: "headset",
          age: 34,
        },
      },
      {
        id: "aiko",
        index: 9,
        name: "Aiko Mensah",
        role: "Umbrella mender",
        area: "umbrella",
        trait: "Measures cloth with a knotted cord.",
        greeting: "Stay under the good seam. The bad one is over there.",
        topics: [
          {
            id: "work",
            label: "Ask about their work",
            text: "I can repair a seam with scrap cloth. I cannot make a drain run uphill.",
          },
          {
            id: "district",
            label: "Ask about life here",
            text: "Our canopy protects three stalls. A private repair can still be a public service.",
          },
          {
            id: "memory",
            label: "Ask what they remember",
            text: "The cord came from a coat I wore until the lining disappeared.",
          },
          {
            id: "rumour",
            label: "Ask about a local lead",
            text: "Ember keeps waterproof offcuts. Find a patch before this drip reaches Jo\u2019s terminal.",
          },
        ],
        position: [23, 10],
        look: { skin: "#6e4639", hair: "#a6a19b", coat: "#486478", hairStyle: 9, face: 2, accessory: "none", age: 61 },
      },
      {
        id: "jo",
        index: 10,
        name: "Jo Vale",
        role: "Card seller",
        area: "umbrella",
        trait: "Uses a worn text terminal.",
        greeting: "The screen writes: Give me time. I am answering.",
        topics: [
          {
            id: "work",
            label: "Ask about their work",
            text: "My voice does not work reliably. My words do. Customers sometimes confuse those two facts.",
          },
          {
            id: "district",
            label: "Ask about life here",
            text: "People talk louder at a broken speaker. A readable screen is more useful.",
          },
          {
            id: "memory",
            label: "Ask what they remember",
            text: "I remember a friend waiting through a whole failed message without finishing it for me.",
          },
          {
            id: "rumour",
            label: "Ask about a local lead",
            text: "Little Osaka has a spare display. The connector on mine is loose.",
          },
        ],
        position: [33, 15],
        look: { skin: "#b87b60", hair: "#583925", coat: "#5c6c55", hairStyle: 0, face: 3, accessory: "none", age: 28 },
      },
      {
        id: "yara",
        index: 11,
        name: "Yara Bell",
        role: "Rooming-house keeper",
        area: "umbrella",
        trait: "Watches reflections, not faces.",
        greeting: "Do not turn around yet. The same coat has crossed this arcade three times.",
        topics: [
          {
            id: "work",
            label: "Ask about their work",
            text: "I collect rent and repair requests. Today I would rather not collect another problem.",
          },
          {
            id: "district",
            label: "Ask about life here",
            text: "A busy street can be good cover for someone who wants to remain unseen.",
          },
          {
            id: "memory",
            label: "Ask what they remember",
            text: "I used to know every footstep on my stair. Now there are too many short leases.",
          },
          {
            id: "rumour",
            label: "Ask about a local lead",
            text: "A messenger left a mark near the east loading door. I do not know whether it was meant for me.",
          },
        ],
        position: [23, 19],
        look: {
          skin: "#ad7655",
          hair: "#41312e",
          coat: "#71607b",
          hairStyle: 1,
          face: 4,
          accessory: "glasses",
          age: 72,
        },
      },
      {
        id: "otis",
        index: 12,
        name: "Otis Baptiste",
        role: "Cane and handle maker",
        area: "umbrella",
        trait: "Tests a handle before offering it.",
        greeting: "Put your weight on it. A handle should not ask you to trust the label.",
        topics: [
          {
            id: "work",
            label: "Ask about their work",
            text: "I replace grips and joints. The old wood usually lasts longer than the new fittings.",
          },
          {
            id: "district",
            label: "Ask about life here",
            text: "A good handle moves between umbrellas, walking sticks, and shopping carts.",
          },
          {
            id: "memory",
            label: "Ask what they remember",
            text: "My daughter gave me a straight branch. I made it into three things over ten years.",
          },
          {
            id: "rumour",
            label: "Ask about a local lead",
            text: "Jo\u2019s terminal needs a screen, not someone to speak on Jo\u2019s behalf.",
          },
        ],
        position: [34, 20],
        look: {
          skin: "#c98b69",
          hair: "#20292e",
          coat: "#477076",
          hairStyle: 2,
          face: 5,
          accessory: "earring",
          age: 43,
        },
      },
      {
        id: "kira",
        index: 13,
        name: "Kira Sol",
        role: "Animoid technician",
        area: "animals",
        trait: "Keeps an oil pencil tied to her wrist.",
        greeting: "That small sheep is not scrap. It is waiting for somebody to stop calling it scrap.",
        topics: [
          {
            id: "work",
            label: "Ask about their work",
            text: "I repair artificial animals. I ask about the fault before I ask about the owner.",
          },
          {
            id: "district",
            label: "Ask about life here",
            text: "The serial number tells me which part fits. It does not tell me who will miss the animal.",
          },
          {
            id: "memory",
            label: "Ask what they remember",
            text: "My first repair was a bird that kept falling asleep mid-song. Its owner liked the pause.",
          },
          {
            id: "rumour",
            label: "Ask about a local lead",
            text: "There is a spare cell at Little Osaka. The service label gives the channel order.",
          },
        ],
        position: [-33, -14],
        look: { skin: "#8d583f", hair: "#202020", coat: "#785752", hairStyle: 3, face: 6, accessory: "cap", age: 56 },
      },
      {
        id: "niko",
        index: 14,
        name: "Niko Chen",
        role: "Dove keeper",
        area: "animals",
        trait: "Protects a small carrier from the rain.",
        greeting: "The bird is quiet. That is not the same as being broken.",
        topics: [
          {
            id: "work",
            label: "Ask about their work",
            text: "I clean the carrier and count its feeds. Nobody agrees on what kind of bird it is.",
          },
          {
            id: "district",
            label: "Ask about life here",
            text: "Adults ask what it cost before they ask its name. Its name is Pip.",
          },
          {
            id: "memory",
            label: "Ask what they remember",
            text: "I remember the first time it settled on my hand. That happened whether it has a maker or not.",
          },
          {
            id: "rumour",
            label: "Ask about a local lead",
            text: "Sela has a gentle scanner. We can check the leg band without hurting Pip.",
          },
        ],
        position: [-23, -9],
        look: { skin: "#d7aa86", hair: "#6b4336", coat: "#6a6554", hairStyle: 4, face: 0, accessory: "scar", age: 48 },
      },
      {
        id: "sela",
        index: 15,
        name: "Sela Moreno",
        role: "Animal-care volunteer",
        area: "animals",
        trait: "Writes service notes in green ink.",
        greeting: "Bring the carrier into the dry part. We can examine the band here.",
        topics: [
          {
            id: "work",
            label: "Ask about their work",
            text: "I work with what the animal needs now. A sales story can wait.",
          },
          {
            id: "district",
            label: "Ask about life here",
            text: "People bring injured pets here before they admit they cannot pay for help.",
          },
          {
            id: "memory",
            label: "Ask what they remember",
            text: "I kept the first thank-you note. It is mostly a drawing of a tail.",
          },
          {
            id: "rumour",
            label: "Ask about a local lead",
            text: "A blank scan is not proof of a natural bird. An old band can simply be unreadable.",
          },
        ],
        position: [-33, -5],
        look: {
          skin: "#6e4639",
          hair: "#a6a19b",
          coat: "#486478",
          hairStyle: 5,
          face: 1,
          accessory: "headwrap",
          age: 34,
        },
      },
      {
        id: "bo",
        index: 16,
        name: "Bo Nakamura",
        role: "Battery trader",
        area: "animals",
        trait: "Labels every cell with its test date.",
        greeting: "These are tested. Those are merely shiny.",
        topics: [
          {
            id: "work",
            label: "Ask about their work",
            text: "A cell that lights a sign may still be wrong for a small motor. Read the load rating.",
          },
          {
            id: "district",
            label: "Ask about life here",
            text: "The cheap cells arrive without dates. I test them so the buyer does not have to guess.",
          },
          {
            id: "memory",
            label: "Ask what they remember",
            text: "I used to sell by appearance. A melted toy taught me what that saves and what it costs.",
          },
          {
            id: "rumour",
            label: "Ask about a local lead",
            text: "Kira wrote the sheep\u2019s correct cell code on the service shelf.",
          },
        ],
        position: [-22, -4],
        look: { skin: "#b87b60", hair: "#583925", coat: "#5c6c55", hairStyle: 6, face: 2, accessory: "visor", age: 61 },
      },
      {
        id: "esme",
        index: 17,
        name: "Esme Duarte",
        role: "Feed seller",
        area: "animals",
        trait: "Carries two differently marked scoops.",
        greeting: "The tins look alike. That is why the scoops do not.",
        topics: [
          {
            id: "work",
            label: "Ask about their work",
            text: "Some feed is for living animals. Some is a care product sold beside it. Labels matter.",
          },
          {
            id: "district",
            label: "Ask about life here",
            text: "People keep an empty food tin long after an animal is gone. I do not rush them.",
          },
          {
            id: "memory",
            label: "Ask what they remember",
            text: "I can still identify my old cat by the sound of a lid opening in my memory.",
          },
          {
            id: "rumour",
            label: "Ask about a local lead",
            text: "Niko wants an answer about Pip. Be careful not to sell certainty you do not have.",
          },
        ],
        position: [-28, -3],
        look: { skin: "#ad7655", hair: "#41312e", coat: "#71607b", hairStyle: 7, face: 3, accessory: "beard", age: 28 },
      },
      {
        id: "ivo",
        index: 18,
        name: "Ivo Park",
        role: "Photograph cleaner",
        area: "memory",
        trait: "Leaves the torn edges untouched.",
        greeting: "I remove water damage. I do not remove years.",
        topics: [
          {
            id: "work",
            label: "Ask about their work",
            text: "A photograph can be repaired without being made new. I ask what the owner wants to preserve.",
          },
          {
            id: "district",
            label: "Ask about life here",
            text: "Many customers come here for the story while their picture dries.",
          },
          {
            id: "memory",
            label: "Ask what they remember",
            text: "Someone asked me to keep a thumbprint on a wedding photograph. It was all they could identify of one guest.",
          },
          {
            id: "rumour",
            label: "Ask about a local lead",
            text: "A photograph found near transit may belong to Wen. Ada knew that old courtyard.",
          },
        ],
        position: [-5, -14],
        look: {
          skin: "#c98b69",
          hair: "#20292e",
          coat: "#477076",
          hairStyle: 8,
          face: 4,
          accessory: "headset",
          age: 72,
        },
      },
      {
        id: "wen",
        index: 19,
        name: "Wen Alvarez",
        role: "Transit widow",
        area: "memory",
        trait: "Keeps an empty photo sleeve.",
        greeting: "I came to collect a picture. I seem to have lost the part that was not replaceable.",
        topics: [
          {
            id: "work",
            label: "Ask about their work",
            text: "I mend work clothes. The patches tell me which knee somebody uses most.",
          },
          {
            id: "district",
            label: "Ask about life here",
            text: "We used to live around one courtyard. Now I find neighbours in different queues.",
          },
          {
            id: "memory",
            label: "Ask what they remember",
            text: "The picture had a crooked lantern and a child hiding behind a chair. The hidden child is me.",
          },
          {
            id: "rumour",
            label: "Ask about a local lead",
            text: "Ada kept the courtyard key for years after the building was gone.",
          },
        ],
        position: [5, -9],
        look: { skin: "#8d583f", hair: "#202020", coat: "#785752", hairStyle: 9, face: 5, accessory: "none", age: 43 },
      },
      {
        id: "mina",
        index: 20,
        name: "Mina Desai",
        role: "Pawn-shop proprietor",
        area: "memory",
        trait: "Polishes the counter around, never under, tickets.",
        greeting: "A sale and a loan are different forms. Read the one in front of you.",
        topics: [
          {
            id: "work",
            label: "Ask about their work",
            text: "I lend against objects. I allow extensions because objects are easier to store than regret.",
          },
          {
            id: "district",
            label: "Ask about life here",
            text: "The ticket window stays lit after the shop closes. People check whether their time has run out.",
          },
          {
            id: "memory",
            label: "Ask what they remember",
            text: "I once bought back my own coat. I recognised the repair before I recognised the cloth.",
          },
          {
            id: "rumour",
            label: "Ask about a local lead",
            text: "Ivo does not alter faces without consent. Do not let a customer call that part optional.",
          },
        ],
        position: [-5, -5],
        look: { skin: "#d7aa86", hair: "#6b4336", coat: "#6a6554", hairStyle: 0, face: 6, accessory: "none", age: 56 },
      },
      {
        id: "hollis",
        index: 21,
        name: "Hollis Reed",
        role: "Obsolete-camera repairer",
        area: "memory",
        trait: "Listens to each shutter.",
        greeting: "That click was late. It still got there.",
        topics: [
          {
            id: "work",
            label: "Ask about their work",
            text: "I repair cameras that nobody makes parts for. The shutter only needs one honest instant.",
          },
          {
            id: "district",
            label: "Ask about life here",
            text: "New machines hide the fault in a sealed box. Old ones at least show me where to look.",
          },
          {
            id: "memory",
            label: "Ask what they remember",
            text: "I remember waiting a week to see whether a photograph had worked.",
          },
          {
            id: "rumour",
            label: "Ask about a local lead",
            text: "Cloudline has a receiver from the same factory as this camera. Parts move in strange families.",
          },
        ],
        position: [6, -4],
        look: {
          skin: "#6e4639",
          hair: "#a6a19b",
          coat: "#486478",
          hairStyle: 1,
          face: 0,
          accessory: "glasses",
          age: 48,
        },
      },
      {
        id: "chela",
        index: 22,
        name: "Chela Nwosu",
        role: "Night-clinic clerk",
        area: "medicine",
        trait: "Checks each seal twice.",
        greeting: "The parcel is sealed and labelled. It must stay that way.",
        topics: [
          {
            id: "work",
            label: "Ask about their work",
            text: "I organise deliveries and appointments. Treatment decisions stay with the clinician.",
          },
          {
            id: "district",
            label: "Ask about life here",
            text: "A long queue does not tell you who is most tired. We make room before asking for explanations.",
          },
          {
            id: "memory",
            label: "Ask what they remember",
            text: "A neighbour once carried my shopping upstairs for a month. I still remember every trip.",
          },
          {
            id: "rumour",
            label: "Ask about a local lead",
            text: "Oren\u2019s lift is out. The delivery relay can arrange a runner after you log the parcel.",
          },
        ],
        position: [23, -14],
        look: {
          skin: "#b87b60",
          hair: "#583925",
          coat: "#5c6c55",
          hairStyle: 2,
          face: 1,
          accessory: "earring",
          age: 34,
        },
      },
      {
        id: "oren",
        index: 23,
        name: "Oren Salcedo",
        role: "Retired projectionist",
        area: "medicine",
        trait: "Keeps a folded cinema programme.",
        greeting: "Sit for a moment. I have had enough people speaking from doorways.",
        topics: [
          {
            id: "work",
            label: "Ask about their work",
            text: "I used to change reels before the audience noticed. That was the job: make the join disappear.",
          },
          {
            id: "district",
            label: "Ask about life here",
            text: "This clinic bench is where I meet people now. Nobody has to buy a ticket.",
          },
          {
            id: "memory",
            label: "Ask what they remember",
            text: "I remember the light in the booth before I remember any film.",
          },
          {
            id: "rumour",
            label: "Ask about a local lead",
            text: "The delivery parcel is mine. Ask Chela about the seal, not about its contents.",
          },
        ],
        position: [33, -9],
        look: { skin: "#ad7655", hair: "#41312e", coat: "#71607b", hairStyle: 3, face: 2, accessory: "cap", age: 61 },
      },
      {
        id: "pavel",
        index: 24,
        name: "Pavel Singh",
        role: "Street medic",
        area: "medicine",
        trait: "Washes his hands before touching equipment.",
        greeting: "Leave the work surface clear, please.",
        topics: [
          {
            id: "work",
            label: "Ask about their work",
            text: "The clinic uses sealed kits and private records. A public counter is not a place for a diagnosis.",
          },
          {
            id: "district",
            label: "Ask about life here",
            text: "People bring their neighbours. That tells me more about the district than any advert does.",
          },
          {
            id: "memory",
            label: "Ask what they remember",
            text: "A teacher told me that listening is work. Some nights it is most of the work.",
          },
          {
            id: "rumour",
            label: "Ask about a local lead",
            text: "The power relay must leave the clinic line alone. Asa marked it in red.",
          },
        ],
        position: [23, -5],
        look: { skin: "#c98b69", hair: "#20292e", coat: "#477076", hairStyle: 4, face: 3, accessory: "scar", age: 28 },
      },
      {
        id: "imani",
        index: 25,
        name: "Imani Wells",
        role: "Queue volunteer",
        area: "medicine",
        trait: "Carries a stack of folding seats.",
        greeting: "This seat is free. You do not have to explain why you need it.",
        topics: [
          {
            id: "work",
            label: "Ask about their work",
            text: "I keep the doorway clear and find people a place to rest. There is no charge for the bench. The clinic helps pay for clean blankets.",
          },
          {
            id: "district",
            label: "Ask about life here",
            text: "Most arguments in this queue begin with someone who has been standing too long.",
          },
          {
            id: "memory",
            label: "Ask what they remember",
            text: "I used to think helping meant having an answer. Sometimes it means moving a chair.",
          },
          {
            id: "rumour",
            label: "Ask about a local lead",
            text: "Marta\u2019s meal run ends here. Sumi can identify the token that went missing.",
          },
        ],
        position: [34, -4],
        look: {
          skin: "#8d583f",
          hair: "#202020",
          coat: "#785752",
          hairStyle: 5,
          face: 4,
          accessory: "headwrap",
          age: 72,
        },
      },
      {
        id: "asa",
        index: 26,
        name: "Asa Ito",
        role: "Power technician",
        area: "west",
        trait: "Carries a ceramic test lead.",
        greeting: "Do not borrow a live connection. Borrow my meter.",
        topics: [
          {
            id: "work",
            label: "Ask about their work",
            text: "I balance the local circuits. The clinic comes first, then food, then everything that can wait.",
          },
          {
            id: "district",
            label: "Ask about life here",
            text: "The music circuit has its own low-power route. Sharing does not have to mean taking.",
          },
          {
            id: "memory",
            label: "Ask what they remember",
            text: "My first repair worked until the rain came. I learned to finish the enclosure.",
          },
          {
            id: "rumour",
            label: "Ask about a local lead",
            text: "Mariko\u2019s scale can be compared with mine. Bring the empty-tray reading.",
          },
        ],
        position: [-33, -38],
        look: { skin: "#d7aa86", hair: "#6b4336", coat: "#6a6554", hairStyle: 6, face: 5, accessory: "visor", age: 43 },
      },
      {
        id: "haru",
        index: 27,
        name: "Haru Malik",
        role: "Tool librarian",
        area: "west",
        trait: "Places returned tools in their own outlines.",
        greeting: "Tell me what you need to do, not what tool you saw in a window.",
        topics: [
          {
            id: "work",
            label: "Ask about their work",
            text: "I lend tools and show people how to return them intact. The deposit can be work, not money. Someone cleaned this bench for an hour with a borrowed brush.",
          },
          {
            id: "district",
            label: "Ask about life here",
            text: "A library can be built from books, spanners, or spare time. The rule is the same.",
          },
          {
            id: "memory",
            label: "Ask what they remember",
            text: "Someone trusted me with a good tool before I could afford one.",
          },
          {
            id: "rumour",
            label: "Ask about a local lead",
            text: "There is a spare text display on the shelf. It fits Jo\u2019s terminal.",
          },
        ],
        position: [-23, -33],
        look: { skin: "#6e4639", hair: "#a6a19b", coat: "#486478", hairStyle: 7, face: 6, accessory: "beard", age: 56 },
      },
      {
        id: "celia",
        index: 28,
        name: "Celia Tran",
        role: "Fan mechanic",
        area: "west",
        trait: "Has a paper wind vane on her bench.",
        greeting: "That fan moves dust, not air. I can hear the difference.",
        topics: [
          {
            id: "work",
            label: "Ask about their work",
            text: "I clean bearings and replace the parts that wear first. A shop can survive a broken fan. It cannot survive a month without one.",
          },
          {
            id: "district",
            label: "Ask about life here",
            text: "A quiet fan is worth more in a crowded room. People need sleep more than a bright badge.",
          },
          {
            id: "memory",
            label: "Ask what they remember",
            text: "My old room had one fan for four beds. We took turns choosing the direction.",
          },
          {
            id: "rumour",
            label: "Ask about a local lead",
            text: "The canopy drain can be cleared without pulling down the whole cover.",
          },
        ],
        position: [-33, -29],
        look: {
          skin: "#b87b60",
          hair: "#583925",
          coat: "#5c6c55",
          hairStyle: 8,
          face: 0,
          accessory: "headset",
          age: 48,
        },
      },
      {
        id: "ash",
        index: 29,
        name: "Ash Laurent",
        role: "Sanitation worker",
        area: "west",
        trait: "Marks safe paths with chalk.",
        greeting: "Keep the painted lane clear. I need it once everyone else is asleep.",
        topics: [
          {
            id: "work",
            label: "Ask about their work",
            text: "I clear drains and remove what the shops cannot sell. Water takes the lowest path. My shift starts where that path stops.",
          },
          {
            id: "district",
            label: "Ask about life here",
            text: "The district notices sanitation when it fails. That is not a measure of how often it works.",
          },
          {
            id: "memory",
            label: "Ask what they remember",
            text: "I know where a vanished shop stood by the shape of its drain.",
          },
          {
            id: "rumour",
            label: "Ask about a local lead",
            text: "The east alley has a fresh courier mark. It is not a police mark.",
          },
        ],
        position: [-22, -28],
        look: { skin: "#ad7655", hair: "#41312e", coat: "#71607b", hairStyle: 9, face: 1, accessory: "none", age: 34 },
      },
      {
        id: "etta",
        index: 30,
        name: "Etta Voss",
        role: "Synth musician",
        area: "bazaar",
        trait: "Taps a rhythm on an unplugged keyboard.",
        greeting: "You can hear the rhythm. The instrument is the quiet part.",
        topics: [
          {
            id: "work",
            label: "Ask about their work",
            text: "I play for people waiting between shifts. Nobody has to stop to listen.",
          },
          {
            id: "district",
            label: "Ask about life here",
            text: "A tune travels under the canopies. Sometimes the chorus returns from a different street.",
          },
          {
            id: "memory",
            label: "Ask what they remember",
            text: "I learned this pattern from a neighbour through a thin wall. I never learned their name.",
          },
          {
            id: "rumour",
            label: "Ask about a local lead",
            text: "Asa says a spare low-power circuit is available. The clinic line is not ours to use.",
          },
        ],
        position: [-5, -38],
        look: { skin: "#c98b69", hair: "#20292e", coat: "#477076", hairStyle: 0, face: 2, accessory: "none", age: 61 },
      },
      {
        id: "bao",
        index: 31,
        name: "Bao Kim",
        role: "Tea seller",
        area: "bazaar",
        trait: "Warms cups before filling them.",
        greeting: "Take the cup with both hands. It has been out in the rain.",
        topics: [
          {
            id: "work",
            label: "Ask about their work",
            text: "I sell tea and lend a place to wait. The second service is not on the menu.",
          },
          {
            id: "district",
            label: "Ask about life here",
            text: "The court is a room with no landlord for a few hours each night.",
          },
          {
            id: "memory",
            label: "Ask what they remember",
            text: "I remember a kitchen where everyone left through the same door. This court comes close.",
          },
          {
            id: "rumour",
            label: "Ask about a local lead",
            text: "Etta\u2019s music changes how long people stay. Fixing a socket can change a whole square.",
          },
        ],
        position: [5, -33],
        look: {
          skin: "#8d583f",
          hair: "#202020",
          coat: "#785752",
          hairStyle: 1,
          face: 3,
          accessory: "glasses",
          age: 28,
        },
      },
      {
        id: "sofia",
        index: 32,
        name: "Sofia Nadir",
        role: "Permit inspector",
        area: "bazaar",
        trait: "Keeps a separate list of urgent repairs.",
        greeting: "I am looking at the cable, not counting the cups.",
        topics: [
          {
            id: "work",
            label: "Ask about their work",
            text: "I inspect stalls. A form can record a fault; it cannot repair one.",
          },
          {
            id: "district",
            label: "Ask about life here",
            text: "Closing every bad canopy would leave everyone standing in the rain. We schedule repairs first.",
          },
          {
            id: "memory",
            label: "Ask what they remember",
            text: "I once filed a report so complete that nobody read the danger on the last page.",
          },
          {
            id: "rumour",
            label: "Ask about a local lead",
            text: "The public circuit has a limit. The load board makes it visible before someone trips it.",
          },
        ],
        position: [-5, -29],
        look: {
          skin: "#d7aa86",
          hair: "#6b4336",
          coat: "#6a6554",
          hairStyle: 2,
          face: 4,
          accessory: "earring",
          age: 72,
        },
      },
      {
        id: "malik",
        index: 33,
        name: "Malik Chen",
        role: "Night-shift union runner",
        area: "bazaar",
        trait: "Wears a faded route patch.",
        greeting: "The next meeting is after the late shift. People cannot miss wages to discuss wages.",
        topics: [
          {
            id: "work",
            label: "Ask about their work",
            text: "I carry notices between crews that never work at the same time.",
          },
          {
            id: "district",
            label: "Ask about life here",
            text: "A shared break is rare here. We use the tea shelf as a message board.",
          },
          {
            id: "memory",
            label: "Ask what they remember",
            text: "My first notice had three names. I still know where all three people worked.",
          },
          {
            id: "rumour",
            label: "Ask about a local lead",
            text: "Pal\u2019s package route has changed. The old platform stamp is still on some parcels.",
          },
        ],
        position: [6, -28],
        look: { skin: "#6e4639", hair: "#a6a19b", coat: "#486478", hairStyle: 3, face: 5, accessory: "cap", age: 43 },
      },
      {
        id: "lin",
        index: 34,
        name: "Lin Reyes",
        role: "News and ticket seller",
        area: "transit",
        trait: "Corrects the public board by hand.",
        greeting: "Trust the pencil for the platform. The screen has not received the update.",
        topics: [
          {
            id: "work",
            label: "Ask about their work",
            text: "I sell tickets and copy corrections. News travels faster than the maintenance crew.",
          },
          {
            id: "district",
            label: "Ask about life here",
            text: "People read the off-world headline while waiting for a local train.",
          },
          {
            id: "memory",
            label: "Ask what they remember",
            text: "I saved a ticket from a journey I never took. It is still good for remembering the plan.",
          },
          {
            id: "rumour",
            label: "Ask about a local lead",
            text: "The recruitment notice has terms below the bright heading. Rafi has only read the heading.",
          },
        ],
        position: [23, -38],
        look: { skin: "#b87b60", hair: "#583925", coat: "#5c6c55", hairStyle: 4, face: 6, accessory: "scar", age: 56 },
      },
      {
        id: "rafi",
        index: 35,
        name: "Rafi Das",
        role: "Freight apprentice",
        area: "transit",
        trait: "Keeps a departure brochure inside a manual.",
        greeting: "Do you think a person can leave without becoming someone else?",
        topics: [
          {
            id: "work",
            label: "Ask about their work",
            text: "I move freight now. The brochure offers work that comes with a view.",
          },
          {
            id: "district",
            label: "Ask about life here",
            text: "People tell me to go, then ask who will cover my shift. Both questions matter.",
          },
          {
            id: "memory",
            label: "Ask what they remember",
            text: "I have never seen the horizon without buildings in front of it.",
          },
          {
            id: "rumour",
            label: "Ask about a local lead",
            text: "Neris worked away from Earth. I would rather hear one real experience than ten adverts.",
          },
        ],
        position: [33, -33],
        look: {
          skin: "#ad7655",
          hair: "#41312e",
          coat: "#71607b",
          hairStyle: 5,
          face: 0,
          accessory: "headwrap",
          age: 48,
        },
      },
      {
        id: "con",
        index: 36,
        name: "Con Valdez",
        role: "Local patrol officer",
        area: "transit",
        trait: "Removes rain from a notebook before opening it.",
        greeting: "You can make a report without making a scene.",
        topics: [
          {
            id: "work",
            label: "Ask about their work",
            text: "I work this walking route. I know the entrances better than the people behind them.",
          },
          {
            id: "district",
            label: "Ask about life here",
            text: "A uniform makes some people speak and others go quiet. I have to notice both.",
          },
          {
            id: "memory",
            label: "Ask what they remember",
            text: "My first report was about a lost animal. It mattered to the person who made it.",
          },
          {
            id: "rumour",
            label: "Ask about a local lead",
            text: "A coat following a route is not yet evidence of a threat. Start with times and places.",
          },
        ],
        position: [23, -29],
        look: { skin: "#c98b69", hair: "#20292e", coat: "#477076", hairStyle: 6, face: 1, accessory: "visor", age: 34 },
      },
      {
        id: "ruth",
        index: 37,
        name: "Ruth Ko",
        role: "Platform announcer",
        area: "transit",
        trait: "Repeats corrections at the same calm volume.",
        greeting: "That announcement was for platform six. It used to be four.",
        topics: [
          {
            id: "work",
            label: "Ask about their work",
            text: "I say the same thing until the people who need it have heard it.",
          },
          {
            id: "district",
            label: "Ask about life here",
            text: "A broken display turns a voice into a public service. People read the platform board to strangers. You learn quickly which announcements need repeating.",
          },
          {
            id: "memory",
            label: "Ask what they remember",
            text: "I remember a passenger who thanked me for repeating myself. Most people only hear the first attempt.",
          },
          {
            id: "rumour",
            label: "Ask about a local lead",
            text: "A loose photograph caught on the transit railing. I put it where the rain would not reach it.",
          },
        ],
        position: [34, -28],
        look: { skin: "#8d583f", hair: "#202020", coat: "#785752", hairStyle: 7, face: 2, accessory: "beard", age: 61 },
      },
      {
        id: "pal",
        index: 38,
        name: "Pal Okafor",
        role: "Freight courier",
        area: "east",
        trait: "Checks a parcel against a thumb-sized map.",
        greeting: "This package has two addresses. Only one can be current.",
        topics: [
          {
            id: "work",
            label: "Ask about their work",
            text: "I deliver to a person who can sign. A familiar shop front is not enough.",
          },
          {
            id: "district",
            label: "Ask about life here",
            text: "The front street changes names. The delivery doors keep old numbers.",
          },
          {
            id: "memory",
            label: "Ask what they remember",
            text: "I once delivered to a shop that had closed a year earlier. Its neighbour knew where the owner went.",
          },
          {
            id: "rumour",
            label: "Ask about a local lead",
            text: "The Cinder order has a red diagonal and a book symbol. Lin has the route correction.",
          },
        ],
        position: [-33, -62],
        look: {
          skin: "#d7aa86",
          hair: "#6b4336",
          coat: "#6a6554",
          hairStyle: 8,
          face: 3,
          accessory: "headset",
          age: 28,
        },
      },
      {
        id: "ember",
        index: 39,
        name: "Ember Haddad",
        role: "Spice and freight seller",
        area: "east",
        trait: "Labels each jar in two scripts.",
        greeting: "The sealed jar stays sealed. You can smell the sample one.",
        topics: [
          {
            id: "work",
            label: "Ask about their work",
            text: "I sell spices beside freight work. The small trade keeps the large one bearable.",
          },
          {
            id: "district",
            label: "Ask about life here",
            text: "A familiar smell can make an unfamiliar room feel less temporary.",
          },
          {
            id: "memory",
            label: "Ask what they remember",
            text: "I keep a little jar from the first shipment I received. It has nothing left in it but smell.",
          },
          {
            id: "rumour",
            label: "Ask about a local lead",
            text: "Aiko can use the waterproof offcuts beside the loading tarp. They are too small for a new coat, but big enough to keep a stall dry.",
          },
        ],
        position: [-23, -57],
        look: { skin: "#6e4639", hair: "#a6a19b", coat: "#486478", hairStyle: 9, face: 4, accessory: "none", age: 72 },
      },
      {
        id: "tariq",
        index: 40,
        name: "Tariq Zhou",
        role: "Housing runner",
        area: "east",
        trait: "Carries a ring of service keys.",
        greeting: "The lift is still out. I can take a sealed parcel up the service stair.",
        topics: [
          {
            id: "work",
            label: "Ask about their work",
            text: "I connect delivery counters with doors. The building makes that harder than it sounds.",
          },
          {
            id: "district",
            label: "Ask about life here",
            text: "People remember a runner who knocks twice and waits. Some customers need time to stand up. A clock does not know that.",
          },
          {
            id: "memory",
            label: "Ask what they remember",
            text: "My grandmother could hear the service key from inside her flat. She called before I knocked.",
          },
          {
            id: "rumour",
            label: "Ask about a local lead",
            text: "Chela logs the clinic seal. I log the handover. Both parts keep the parcel traceable.",
          },
        ],
        position: [-33, -53],
        look: { skin: "#b87b60", hair: "#583925", coat: "#5c6c55", hairStyle: 0, face: 5, accessory: "none", age: 43 },
      },
      {
        id: "ada",
        index: 41,
        name: "Ada Nouri",
        role: "Courtyard historian",
        area: "temple",
        trait: "Draws old streets on blank receipts.",
        greeting: "Tell me one detail. A name may have changed, but a crooked lamp tends to stay crooked.",
        topics: [
          {
            id: "work",
            label: "Ask about their work",
            text: "I keep maps of places that are no longer there. When someone brings an old photograph, I can sometimes place the street behind the people.",
          },
          {
            id: "district",
            label: "Ask about life here",
            text: "A demolished building leaves neighbours scattered across many queues.",
          },
          {
            id: "memory",
            label: "Ask what they remember",
            text: "Wen used to hide behind a chair when photographs were taken. The lantern above her always leaned left.",
          },
          {
            id: "rumour",
            label: "Ask about a local lead",
            text: "There is a photograph near transit. I can identify the courtyard, but Wen must identify her own picture.",
          },
        ],
        position: [-5, -62],
        look: {
          skin: "#ad7655",
          hair: "#41312e",
          coat: "#71607b",
          hairStyle: 1,
          face: 6,
          accessory: "glasses",
          age: 56,
        },
      },
      {
        id: "teo",
        index: 42,
        name: "Teo Ruiz",
        role: "Book and manual seller",
        area: "temple",
        trait: "Repairs bindings with different-coloured thread.",
        greeting: "A marked page is not a damaged page unless you cannot read it.",
        topics: [
          {
            id: "work",
            label: "Ask about their work",
            text: "I sell books that have already helped someone once. Look at the notes in the margin. They tell you what the first reader could not afford to get wrong.",
          },
          {
            id: "district",
            label: "Ask about life here",
            text: "Manuals travel between shops. Stories travel farther and come back with more wear.",
          },
          {
            id: "memory",
            label: "Ask what they remember",
            text: "My oldest book has three names inside. I have met none of them.",
          },
          {
            id: "rumour",
            label: "Ask about a local lead",
            text: "The parcel from Pal is for this shop. Check the book symbol and current route label.",
          },
        ],
        position: [5, -57],
        look: {
          skin: "#c98b69",
          hair: "#20292e",
          coat: "#477076",
          hairStyle: 2,
          face: 0,
          accessory: "earring",
          age: 48,
        },
      },
      {
        id: "sister-mae",
        index: 43,
        name: "Mae Daran",
        role: "Shrine caretaker",
        area: "temple",
        trait: "Makes room for blank memorial cards.",
        greeting: "You can leave a name, or leave the card blank.",
        topics: [
          {
            id: "work",
            label: "Ask about their work",
            text: "I keep this corner dry. What people remember here is their own business.",
          },
          {
            id: "district",
            label: "Ask about life here",
            text: "Some visitors come for belief. Some come because nobody asks them to buy anything.",
          },
          {
            id: "memory",
            label: "Ask what they remember",
            text: "I remember who sat beside me after a loss more clearly than what they said.",
          },
          {
            id: "rumour",
            label: "Ask about a local lead",
            text: "A bird\u2019s maker does not decide whether somebody is allowed to mourn it.",
          },
        ],
        position: [-5, -53],
        look: { skin: "#8d583f", hair: "#202020", coat: "#785752", hairStyle: 3, face: 1, accessory: "cap", age: 34 },
      },
      {
        id: "lev",
        index: 44,
        name: "Lev Morita",
        role: "Chess player",
        area: "temple",
        trait: "Moves worn pieces with steady hands.",
        greeting: "I am thinking. That does not mean the seat is taken.",
        topics: [
          {
            id: "work",
            label: "Ask about their work",
            text: "I repair clocks in the day and lose at chess at night. Both jobs need patience. Only one pays for dinner.",
          },
          {
            id: "district",
            label: "Ask about life here",
            text: "People stop here because the game does not ask why they are out late.",
          },
          {
            id: "memory",
            label: "Ask what they remember",
            text: "My first board was drawn on a crate. We kept the pieces in a food tin.",
          },
          {
            id: "rumour",
            label: "Ask about a local lead",
            text: "Cloudline\u2019s roof is quiet enough to hear a clock. Take the marked stair, not the delivery ladder.",
          },
        ],
        position: [6, -52],
        look: { skin: "#d7aa86", hair: "#6b4336", coat: "#6a6554", hairStyle: 4, face: 2, accessory: "scar", age: 61 },
      },
      {
        id: "neris",
        index: 45,
        name: "Neris Abebe",
        role: "Returned contract worker",
        area: "roof",
        trait: "Folds every contract along its signature line.",
        greeting: "The view is real. It is not the whole account.",
        topics: [
          {
            id: "work",
            label: "Ask about their work",
            text: "I worked under a contract away from Earth. My experience is one person\u2019s, not a promise to Rafi.",
          },
          {
            id: "district",
            label: "Ask about life here",
            text: "An advert shows the arrival. Ask about the ordinary working day and how you return.",
          },
          {
            id: "memory",
            label: "Ask what they remember",
            text: "I remember a friend saving a cup of soil. We both laughed, then helped seal the lid.",
          },
          {
            id: "rumour",
            label: "Ask about a local lead",
            text: "Read the terms with Rafi. Do not replace the brochure with another confident story.",
          },
        ],
        position: [25, -68],
        look: {
          skin: "#6e4639",
          hair: "#a6a19b",
          coat: "#486478",
          hairStyle: 5,
          face: 3,
          accessory: "headwrap",
          age: 28,
        },
      },
      {
        id: "sable",
        index: 46,
        name: "Sable Kimura",
        role: "Radio repairer",
        area: "roof",
        trait: "Keeps an ear on the weather channel.",
        greeting: "The static is local. The silence beyond it may not be.",
        topics: [
          {
            id: "work",
            label: "Ask about their work",
            text: "I repair receivers. A weak voice still deserves a clean channel.",
          },
          {
            id: "district",
            label: "Ask about life here",
            text: "The district uses the radio when signs fail or people cannot leave a room.",
          },
          {
            id: "memory",
            label: "Ask what they remember",
            text: "My first receiver found a neighbour two floors below. Distance was not the important part.",
          },
          {
            id: "rumour",
            label: "Ask about a local lead",
            text: "Jo\u2019s terminal can carry text over a simple local link once the display works.",
          },
        ],
        position: [33, -57],
        look: { skin: "#b87b60", hair: "#583925", coat: "#5c6c55", hairStyle: 6, face: 4, accessory: "visor", age: 72 },
      },
      {
        id: "eno",
        index: 47,
        name: "Eno Silva",
        role: "Private messenger",
        area: "roof",
        trait: "Carries a delivery card in plain sight.",
        greeting: "This card has an address and a request for a signature. Nothing hidden.",
        topics: [
          {
            id: "work",
            label: "Ask about their work",
            text: "I carry messages for people who do not know where someone moved.",
          },
          {
            id: "district",
            label: "Ask about life here",
            text: "Walking the same route can look like following a person. I should have asked at the front desk.",
          },
          {
            id: "memory",
            label: "Ask what they remember",
            text: "A wrong address once sent me in circles for a whole shift. I leave clearer marks now.",
          },
          {
            id: "rumour",
            label: "Ask about a local lead",
            text: "The arcade message is a housing repair notice for Yara. Ask her before you pass on her location.",
          },
        ],
        position: [23, -53],
        look: { skin: "#ad7655", hair: "#41312e", coat: "#71607b", hairStyle: 7, face: 5, accessory: "beard", age: 43 },
      },
      {
        id: "noura",
        index: 48,
        name: "Noura Akintola",
        role: "Weather-channel volunteer",
        area: "roof",
        trait: "Measures rain in a chipped gauge.",
        greeting: "The broadcast says rain. The gauge tells me how much reaches this roof.",
        topics: [
          {
            id: "work",
            label: "Ask about their work",
            text: "I send local observations to Sable. Large forecasts miss small leaks.",
          },
          {
            id: "district",
            label: "Ask about life here",
            text: "Roof gardens, washing lines, and radio aerials share the same few dry metres.",
          },
          {
            id: "memory",
            label: "Ask what they remember",
            text: "I remember the first morning I could see another roof clearly. Everyone came outside.",
          },
          {
            id: "rumour",
            label: "Ask about a local lead",
            text: "The canopy patch will move water toward a different drain. Check where it lands.",
          },
        ],
        position: [34, -52],
        look: {
          skin: "#c98b69",
          hair: "#20292e",
          coat: "#477076",
          hairStyle: 8,
          face: 6,
          accessory: "headset",
          age: 56,
        },
      },
      {
        id: "vera",
        index: 49,
        name: "Vera Quinn",
        role: "Night-load coordinator",
        area: "east",
        trait: "Keeps delivery times in a pocket clock.",
        greeting: "You can cross now. The next cart is not due yet.",
        topics: [
          {
            id: "work",
            label: "Ask about their work",
            text: "I separate loading times from the hours people use this alley for shelter.",
          },
          {
            id: "district",
            label: "Ask about life here",
            text: "A timetable can make room for people instead of pushing them into the road.",
          },
          {
            id: "memory",
            label: "Ask what they remember",
            text: "I used to sleep in this recess between shifts. I still keep it clear after midnight.",
          },
          {
            id: "rumour",
            label: "Ask about a local lead",
            text: "Pal is waiting for a signature. Do not sign for someone you have not found.",
          },
        ],
        position: [-22, -52],
        look: { skin: "#8d583f", hair: "#202020", coat: "#785752", hairStyle: 9, face: 0, accessory: "none", age: 48 },
      },
    ],
    DISTRICT_QUESTS: [
      {
        id: "mercies",
        title: "Small Mercies",
        giver: "kira",
        summary: "Give a discarded electric sheep a reliable cell and a place to stay.",
        reward: "Electric sheep",
        state: "sheep",
        steps: [
          {
            kind: "npc",
            target: "kira",
            label: "Ask Kira about the sheep",
            text: "Its motor still responds. Read the service label before you choose a cell.",
            choices: [],
          },
          {
            kind: "object",
            target: "sheep-label",
            area: "animals",
            position: [-26, -15],
            label: "Read the sheep\u2019s service label",
            text: "The label shows three channels: ON, OFF, ON. The motor needs the small, tested cell.",
            answer: 0,
            choices: ["Record ON / OFF / ON.", "Record ON / ON / ON.", "Record OFF / OFF / ON."],
            model: "paper",
          },
          {
            kind: "object",
            target: "sheep-cell",
            area: "west",
            position: [-30, -39],
            label: "Fit the tested cell",
            text: "The service label calls for ON / OFF / ON. Use the channel switches, then test the motor.",
            answer: 0,
            choices: ["Set ON / OFF / ON.", "Set ON / ON / ON.", "Use an unmarked cell."],
            model: "toy",
          },
          {
            kind: "npc",
            target: "kira",
            label: "Return the repaired sheep",
            text: "The motor settles into a quiet pulse. Kira asks where to put its care card.",
            choices: [
              {
                label: "Make it a shared neighbourhood pet.",
                effect: "shared",
                text: "A shared care card hangs beside the enclosure. The sheep begins to walk.",
              },
              {
                label: "Register it with the repair stall.",
                effect: "stall",
                text: "Kira puts the care card on her work board. The sheep begins to walk.",
              },
            ],
          },
        ],
      },
      {
        id: "dinner",
        title: "Dinner for Somebody",
        giver: "marta",
        summary: "Match a lost meal token to a delivery record.",
        reward: "Courier favour",
        state: "meal",
        steps: [
          {
            kind: "npc",
            target: "marta",
            label: "Ask Marta about the missing meal",
            text: "Find the token by the counter drain. Sumi can read its mark.",
            choices: [],
          },
          {
            kind: "object",
            target: "ration-token",
            area: "noodles",
            position: [3, 19],
            label: "Recover the ration token",
            text: "A hooked mark sits beside the clinic stamp. The token is still valid.",
            answer: 0,
            choices: ["Keep the mark with the token.", "Trade it at an unrelated stall."],
            model: "paper",
          },
          {
            kind: "npc",
            target: "sumi",
            label: "Check the meal ledger",
            text: "The hook matches Imani\u2019s clinic route. The meal was paid for; its delivery was not completed.",
            choices: [],
          },
          {
            kind: "npc",
            target: "imani",
            label: "Deliver the token and meal",
            text: "Imani clears a place on the bench. Marta can complete the delivery without asking anyone to pay again.",
            choices: [
              {
                label: "Leave the recipient\u2019s name private.",
                effect: "private",
                text: "The sealed meal goes beside the waiting chair. Marta records a completed route.",
              },
              {
                label: "Ask the counter to hold another spare meal.",
                effect: "reserve",
                text: "A second place is marked on the kitchen slate. The first meal reaches its recipient.",
              },
            ],
          },
        ],
      },
      {
        id: "rain",
        title: "Rain Catcher",
        giver: "aiko",
        summary: "Patch a shared canopy without sending its leak onto another stall.",
        reward: "Canopy repair note",
        state: "canopy",
        steps: [
          {
            kind: "npc",
            target: "aiko",
            label: "Inspect Aiko\u2019s leaking canopy",
            text: "A waterproof patch is available at Ember\u2019s loading bay. Bring one with an intact edge.",
            choices: [],
          },
          {
            kind: "object",
            target: "awning-patch",
            area: "east",
            position: [-25, -63],
            label: "Choose a waterproof offcut",
            text: "The intact coated panel has no holes at its edge. The thin packing paper is not a patch.",
            answer: 0,
            choices: ["Take the coated panel.", "Take the packing paper."],
            model: "fabric",
          },
          {
            kind: "object",
            target: "canopy-seam",
            area: "umbrella",
            position: [30, 9],
            label: "Patch and divert the seam",
            text: "The drain points into the marked gutter. Pull the new seam toward that gutter, not Jo\u2019s stall.",
            answer: 1,
            choices: ["Drain toward the card stall.", "Drain toward the marked gutter."],
            model: "device",
          },
          {
            kind: "npc",
            target: "aiko",
            label: "Check the repair with Aiko",
            text: "The seam holds. Three neighbouring stalls share its dry space.",
            choices: [
              {
                label: "Leave repair instructions for the neighbours.",
                effect: "shared",
                text: "A repair card joins the canopy post. The drip beneath the seam stops.",
              },
              {
                label: "Give the remaining patch to Aiko.",
                effect: "spare",
                text: "Aiko keeps a dry spare under the counter. The drip beneath the seam stops.",
              },
            ],
          },
        ],
      },
      {
        id: "photo",
        title: "The Lost Photograph",
        giver: "ivo",
        summary: "Find a picture\u2019s owner without inventing its history.",
        reward: "Courtyard photograph note",
        state: "photo",
        steps: [
          {
            kind: "npc",
            target: "ivo",
            label: "Ask Ivo about the empty sleeve",
            text: "A lost photograph was sheltered on the transit railing. Do not rub its wet surface.",
            choices: [],
          },
          {
            kind: "object",
            target: "found-photo",
            area: "transit",
            position: [31, -39],
            label: "Read the sheltered photograph",
            text: "A crooked lantern hangs above a chair. A small hand is visible behind the chair.",
            answer: 0,
            choices: ["Record the lantern and hidden child.", "Assume it is an off-world scene."],
            model: "photo",
          },
          {
            kind: "npc",
            target: "ada",
            label: "Ask Ada about the courtyard",
            text: "The leaning lantern identifies the old courtyard. Wen was the child who hid behind the chair.",
            choices: [],
          },
          {
            kind: "npc",
            target: "wen",
            label: "Offer Wen the photograph",
            text: "Wen names the person who took the picture before she turns it over.",
            choices: [
              {
                label: "Return the original and keep no copy.",
                effect: "returned",
                text: "The photograph goes into Wen\u2019s empty sleeve. A dry copy is not made.",
              },
              {
                label: "Ask permission for a repair copy.",
                effect: "copy",
                text: "Wen agrees to a repair copy. The original returns to her sleeve.",
              },
            ],
          },
        ],
      },
      {
        id: "scales",
        title: "Counterfeit Scales",
        giver: "ren",
        summary: "Check a disputed weight before deciding what to do.",
        reward: "Scale comparison note",
        state: "scale",
        steps: [
          {
            kind: "npc",
            target: "ren",
            label: "Hear Ren\u2019s complaint",
            text: "Measure the empty tray first. A test without a baseline proves little.",
            choices: [],
          },
          {
            kind: "object",
            target: "scale-zero",
            area: "protein",
            position: [-26, 9],
            label: "Read the empty scale",
            text: "The tray is empty, but the display shows 80 grams. Record the offset.",
            answer: 0,
            choices: ["Record the 80-gram offset.", "Call the empty tray zero."],
            model: "scale",
          },
          {
            kind: "npc",
            target: "asa",
            label: "Compare Ren\u2019s weight on Asa\u2019s scale",
            text: "Asa\u2019s empty tray reads zero. The brass weight agrees with its stamped value. The market scale needs correction.",
            choices: [],
          },
          {
            kind: "npc",
            target: "mariko",
            label: "Present both readings to Mariko",
            text: "Mariko sees the two recorded baselines. She resets her scale and agrees to correct the affected portions.",
            choices: [
              {
                label: "Ask for a correction without a public accusation.",
                effect: "private",
                text: "The scale is corrected. A small compensation tray appears beside the grill.",
              },
              {
                label: "Ask for a public correction notice.",
                effect: "public",
                text: "The scale is corrected. A clear notice invites customers to check their portions.",
              },
            ],
          },
        ],
      },
      {
        id: "medicine",
        title: "Prescription Run",
        giver: "chela",
        summary: "Deliver a sealed fictional clinic parcel through a broken-lift relay.",
        reward: "Clinic handover record",
        state: "clinic",
        steps: [
          {
            kind: "npc",
            target: "chela",
            label: "Collect Chela\u2019s delivery instructions",
            text: "The parcel is for Oren. Read the recipient card and leave the medical contents sealed.",
            choices: [],
          },
          {
            kind: "object",
            target: "clinic-parcel",
            area: "medicine",
            position: [30, -15],
            label: "Check the sealed parcel",
            text: "The card names Oren Salcedo. The seal number matches Chela\u2019s ledger.",
            answer: 0,
            choices: ["Match the name and intact seal.", "Open the parcel to inspect its contents."],
            model: "cabinet",
          },
          {
            kind: "npc",
            target: "tariq",
            label: "Log the stair-relay handover",
            text: "Tariq records the seal number and places the parcel in the clinic return tray. Oren is waiting at Medicine Steps.",
            choices: [],
          },
          {
            kind: "npc",
            target: "oren",
            label: "Complete the delivery to Oren",
            text: "Oren checks his name on the sealed parcel. The delivery record is complete.",
            choices: [
              {
                label: "Stay for a short conversation.",
                effect: "company",
                text: "Oren opens his cinema programme. The delivered parcel remains on the bench beside him.",
              },
              {
                label: "Ask before telling Chela he received it.",
                effect: "receipt",
                text: "Oren agrees to a receipt. Chela\u2019s delivery board gains a completed mark.",
              },
            ],
          },
        ],
      },
      {
        id: "silent",
        title: "The Silent Vendor",
        giver: "jo",
        summary: "Repair Jo\u2019s text display, then let Jo choose the words.",
        reward: "Text-link card",
        state: "terminal",
        steps: [
          {
            kind: "npc",
            target: "jo",
            label: "Read Jo\u2019s repair request",
            text: "The damaged screen writes: A display. Not a replacement voice. Haru has the correct part.",
            choices: [],
          },
          {
            kind: "npc",
            target: "haru",
            label: "Collect the compatible text display",
            text: "Haru checks the connector code against Jo\u2019s request. The matching display is ready.",
            choices: [],
          },
          {
            kind: "object",
            target: "text-terminal",
            area: "umbrella",
            position: [26, 9],
            label: "Connect and test the text display",
            text: "The test message is: I choose my words. Match the four-pin display connector.",
            answer: 1,
            choices: ["Use the audio-only lead.", "Use the four-pin display lead."],
            model: "device",
          },
          {
            kind: "npc",
            target: "jo",
            label: "Let Jo test the repaired terminal",
            text: "The screen is clear. Jo deletes the preset greeting and writes a new one.",
            choices: [
              {
                label: "Wait for Jo\u2019s own message.",
                effect: "own",
                text: "The terminal displays Jo\u2019s own greeting. Customers can read it without shouting.",
              },
              {
                label: "Ask which preset Jo wants to keep.",
                effect: "chosen",
                text: "Jo keeps one useful preset and writes the rest. The choice belongs to the seller.",
              },
            ],
          },
        ],
      },
      {
        id: "offworld",
        title: "Off-World Dreams",
        giver: "rafi",
        summary: "Help Rafi compare an advert with terms and a personal account.",
        reward: "Departure questions",
        state: "dream",
        steps: [
          {
            kind: "npc",
            target: "rafi",
            label: "Ask what Rafi wants from departure",
            text: "Rafi has read the headline. Find the conditions below it before you offer an opinion.",
            choices: [],
          },
          {
            kind: "object",
            target: "contract-terms",
            area: "transit",
            position: [26, -39],
            label: "Read the recruitment conditions",
            text: "Screening, work terms, passage conditions, and return arrangements need separate questions.",
            answer: 0,
            choices: ["Record the terms that need answers.", "Treat the headline as a guarantee."],
            model: "paper",
          },
          {
            kind: "npc",
            target: "neris",
            label: "Hear Neris on the shared roof",
            text: "Neris describes one contract and one return. It is an account to compare, not a promise of what Rafi will find.",
            choices: [],
          },
          {
            kind: "npc",
            target: "rafi",
            label: "Return the questions to Rafi",
            text: "Rafi places the contract beside the brochure. The decision remains Rafi\u2019s.",
            choices: [
              {
                label: "Help list questions for the recruiter.",
                effect: "questions",
                text: "Rafi starts a written question list instead of signing tonight.",
              },
              {
                label: "Help keep copies for a later decision.",
                effect: "copies",
                text: "Rafi stores copies of the terms. The brochure stays, but it is no longer the only page.",
              },
            ],
          },
        ],
      },
      {
        id: "bird",
        title: "The Broken Bird",
        giver: "niko",
        summary: "Examine Pip without turning uncertainty into a diagnosis.",
        reward: "Pip care record",
        state: "bird",
        steps: [
          {
            kind: "npc",
            target: "niko",
            label: "Ask about Pip\u2019s quiet carrier",
            text: "Niko asks whether Pip is natural. Start with the leg band, not a guess.",
            choices: [],
          },
          {
            kind: "object",
            target: "bird-band",
            area: "animals",
            position: [-30, -15],
            label: "Read Pip\u2019s worn leg band",
            text: "The band is old and partly worn away. Its incomplete number does not identify a maker.",
            answer: 0,
            choices: ["Record the incomplete number.", "Invent the missing digits."],
            model: "bird",
          },
          {
            kind: "npc",
            target: "sela",
            label: "Ask Sela for a gentle scan",
            text: "The non-contact scan cannot identify a readable service tag. Sela says that absence is not a proof of origin.",
            choices: [],
          },
          {
            kind: "npc",
            target: "niko",
            label: "Explain the result to Niko",
            text: "You have a care record and an uncertain origin. Pip still needs a dry, quiet carrier.",
            choices: [
              {
                label: "Keep caring for Pip without a label.",
                effect: "care",
                text: "Niko opens the sheltered side of the carrier. Pip begins a small, steady movement.",
              },
              {
                label: "Keep the record for a later specialist.",
                effect: "record",
                text: "Niko keeps the scan record and settles Pip under cover. No false answer is filed.",
              },
            ],
          },
        ],
      },
      {
        id: "music",
        title: "Street Music Circuit",
        giver: "etta",
        summary: "Restore the courtyard\u2019s sound without taking clinic power.",
        reward: "Courtyard circuit note",
        state: "music",
        steps: [
          {
            kind: "npc",
            target: "etta",
            label: "Ask Etta about the silent keyboard",
            text: "The instrument works. The shared outlet does not. Ask Asa for the safe route.",
            choices: [],
          },
          {
            kind: "npc",
            target: "asa",
            label: "Check the local load schedule",
            text: "Leave the clinic feed on. Use the spare low-power loop for music and switch off the unused sign.",
            choices: [],
          },
          {
            kind: "object",
            target: "music-relay",
            area: "west",
            position: [-26, -39],
            label: "Set the music relay",
            text: "Three loads: clinic, spare music loop, unused sign. The board permits ON / ON / OFF.",
            answer: 1,
            choices: ["Set OFF / ON / ON.", "Set ON / ON / OFF.", "Set ON / ON / ON."],
            model: "device",
          },
          {
            kind: "npc",
            target: "etta",
            label: "Return to the courtyard stage",
            text: "The keyboard wakes without disturbing the clinic line. Etta asks which sound carries best tonight.",
            choices: [
              {
                label: "Start with the soft bell pattern.",
                effect: "bells",
                text: "A quiet bell pattern begins. The stage lights turn warm.",
              },
              {
                label: "Start with the low pulse pattern.",
                effect: "pulse",
                text: "A low, steady pattern begins. The stage lights turn blue.",
              },
            ],
          },
        ],
      },
      {
        id: "courier",
        title: "Courier Mix-up",
        giver: "pal",
        summary: "Deliver the right parcel using marks and a corrected route.",
        reward: "Signed freight receipt",
        state: "delivery",
        steps: [
          {
            kind: "npc",
            target: "pal",
            label: "Read Pal\u2019s conflicting addresses",
            text: "The old platform stamp is no longer reliable. Start with the parcel\u2019s persistent marks.",
            choices: [],
          },
          {
            kind: "object",
            target: "parcel-marks",
            area: "east",
            position: [-30, -63],
            label: "Inspect the parcel marks",
            text: "A red diagonal and a book symbol remain beneath the wet address.",
            answer: 0,
            choices: ["Record fragile cargo for a book shop.", "Assume it is clinic cargo."],
            model: "cabinet",
          },
          {
            kind: "npc",
            target: "lin",
            label: "Check Lin\u2019s corrected route",
            text: "The book order now uses Cinder\u2019s temple-court entrance. Teo must sign for it.",
            choices: [],
          },
          {
            kind: "npc",
            target: "teo",
            label: "Deliver the parcel to Teo",
            text: "Teo matches the order number and signs the receipt. The manuals go onto the repair shelf.",
            choices: [
              {
                label: "Return a copy of the receipt to Pal\u2019s route file.",
                effect: "filed",
                text: "Pal\u2019s route file gains a receipt. A fresh box of manuals appears in Cinder Books.",
              },
              {
                label: "Ask Teo to confirm by local radio.",
                effect: "radio",
                text: "Teo confirms the delivery over Sable\u2019s local link. The manuals reach the shelf.",
              },
            ],
          },
        ],
      },
      {
        id: "watcher",
        title: "Watcher in the Crowd",
        giver: "yara",
        summary: "Check a repeated route without exposing someone\u2019s private address.",
        reward: "Verified message account",
        state: "watcher",
        steps: [
          {
            kind: "npc",
            target: "yara",
            label: "Hear Yara\u2019s concern",
            text: "Yara noticed a repeated coat and a chalk mark. Look for a time or route before naming a threat.",
            choices: [],
          },
          {
            kind: "object",
            target: "courier-mark",
            area: "east",
            position: [-21, -54],
            label: "Inspect the fresh route mark",
            text: "The mark contains a delivery time and a roof-radio symbol. It is a courier notation, not a police warrant.",
            answer: 0,
            choices: ["Follow the delivery reference.", "Declare a threat from the mark alone."],
            model: "paper",
          },
          {
            kind: "npc",
            target: "eno",
            label: "Ask Eno about the arcade message",
            text: "Eno shows an addressed housing-repair notice and an unsigned delivery card. He has not asked Yara where to receive it.",
            choices: [],
          },
          {
            kind: "npc",
            target: "yara",
            label: "Let Yara choose how to receive the message",
            text: "The route and delivery card explain the repeated visits. Yara can receive the notice in public without giving a private address.",
            choices: [
              {
                label: "Arrange a public handover at the tea court.",
                effect: "public",
                text: "Yara accepts a public handover. Eno waits by the court, not her door.",
              },
              {
                label: "Arrange collection through the front desk.",
                effect: "desk",
                text: "Yara chooses front-desk collection. Eno removes the obsolete route mark.",
              },
            ],
          },
        ],
      },
    ],
    DISTRICT_KEYS: ["noodles", "fish-counter"],
    DISTRICT_CROWD_COUNT: 132,
  },
  {
    PROLOGUE_VERSION: MX,
    PROLOGUE_SCENES: ji,
    PROLOGUE_PEOPLE: Ha,
    PROLOGUE_FAVOURS: qn,
    HOLDEN_PORTRAIT: z_,
    LEON_PORTRAIT: iX,
  } = (() => {
    let a = "5.0.0",
      e = {
        hades: {
          key: "hades",
          role: "Deckard",
          title: "The city before the case",
          regions: [
            {
              id: "dispatch",
              name: "Dispatch booth",
              x: -18,
              z: -13,
              tone: "#85d5d5",
              air: "A public board gives platform numbers. A second channel carries service requests.",
              lore: [
                {
                  id: "hades:dispatch:1",
                  title: "The missing line",
                  source: "ROUTE BOARD / PUBLIC COPY",
                  text: "The printed board offers a direct lift to the street. A handwritten strip adds the stop where wheelchairs and heavy parcels must change lifts. Someone updates the strip every night.",
                  position: [-23, -6],
                },
                {
                  id: "hades:dispatch:2",
                  title: "A shift on paper",
                  source: "SHIFT DESK / PAY ENVELOPE",
                  text: "A pilot keeps two clocks: one for hours at work and one for hours the company accepts. The dispatch clerk has underlined the difference. Neither clock has stopped.",
                  position: [-13, -6],
                },
              ],
              cues: [
                { id: "hades:dispatch:cue-1", text: "Platform six is for street transfers. Not the departure ships." },
                {
                  id: "hades:dispatch:cue-2",
                  text: "I can hear you. The public address line cannot. Tell me the stop again.",
                },
                {
                  id: "hades:dispatch:cue-3",
                  text: "The shift ends when the next person arrives. Not when the board says so.",
                },
              ],
            },
            {
              id: "overlook",
              name: "City observation rail",
              x: 0,
              z: -13,
              tone: "#e5b97c",
              air: "Furnace towers open below the flight lanes. Warm glass separates this deck from the wind.",
              lore: [
                {
                  id: "hades:overlook:1",
                  title: "An offer above the smoke",
                  source: "AIRSHIP / ADVERTISING SMALL PRINT",
                  text: "The screen sells a life elsewhere. The small print lists checks, travel conditions, and contract terms. It shows a garden. It does not show a return ticket.",
                  position: [-5, -6],
                },
                {
                  id: "hades:overlook:2",
                  title: "The river that moved",
                  source: "OLD CITY / VIEWING MAP",
                  text: "A faded map marks a river beyond the stacks. The new map marks an industrial channel in its place. A porter has drawn the old bend back in pencil.",
                  position: [5, -6],
                },
              ],
              cues: [
                {
                  id: "hades:overlook:cue-1",
                  text: "Those little white lights are maintenance craft. The bright ones are selling something.",
                },
                { id: "hades:overlook:cue-2", text: "A flight lane looks empty until you need to cross it." },
                {
                  id: "hades:overlook:cue-3",
                  text: "The furnaces are quieter from up here. That does not make them quiet below.",
                },
              ],
            },
            {
              id: "canteen",
              name: "Last-service canteen",
              x: 18,
              z: -13,
              tone: "#e7aa79",
              air: "Workers eat under an amber canopy. Fresh cups sit beside bowls that have been repaired twice.",
              lore: [
                {
                  id: "hades:canteen:1",
                  title: "What is in the broth",
                  source: "NIGHT MENU / INGREDIENT CHANGES",
                  text: "The main list says protein broth. A smaller card names this batch: cultured protein, mushroom stock, and leaf stems. The cook changes the small card, not the large promise.",
                  position: [13, -6],
                },
                {
                  id: "hades:canteen:2",
                  title: "The suspended meal",
                  source: "CANTEEN / SHARED TAB",
                  text: "One column records paid meals. Another records meals waiting for someone who cannot pay tonight. Names stay on the inside of the cover, out of the queue's sight.",
                  position: [23, -6],
                },
              ],
              cues: [
                { id: "hades:canteen:cue-1", text: "Keep that lid down. It stays hot for the walk to Noodle Row." },
                { id: "hades:canteen:cue-2", text: "That is not a new cup. It is the same cup with a better handle." },
                { id: "hades:canteen:cue-3", text: "You can pay the tab tomorrow. Eat before your lift arrives." },
              ],
            },
            {
              id: "freight",
              name: "Small freight and animal lockers",
              x: -18,
              z: 12,
              tone: "#a2b69b",
              air: "Tiny carriers share shelf space with cells, empty crates, and personal luggage.",
              lore: [
                {
                  id: "hades:freight:1",
                  title: "Care is not a serial number",
                  source: "ANIMAL CARRIER / SERVICE CARD",
                  text: "The card has spaces for cell type and seal number. The owner has added a name, a favourite sound, and a warning about cold feet. None of that fits the printed boxes.",
                  position: [-23, 19],
                },
                {
                  id: "hades:freight:2",
                  title: "Not abandoned",
                  source: "LOCKER / HANDWRITTEN RECEIPT",
                  text: "The storage term ended three nights ago. A clerk has crossed out the disposal stamp. Beside it: owner on a double shift; keep until collected. A second signature agrees.",
                  position: [-13, 19],
                },
              ],
              cues: [
                { id: "hades:freight:cue-1", text: "Put the carrier above the warm pipe. Not against it." },
                { id: "hades:freight:cue-2", text: "A spare part is cheap until it is the last one in the district." },
                {
                  id: "hades:freight:cue-3",
                  text: "That parcel has a person waiting for it. Leave the receipt attached.",
                },
              ],
            },
            {
              id: "service",
              name: "Filter and signal workshop",
              x: 18,
              z: 12,
              tone: "#86b8cf",
              air: "A fan moves cloth test strips. Used filters have dates written on their frames.",
              lore: [
                {
                  id: "hades:service:1",
                  title: "Air has a maintenance cost",
                  source: "FILTER RACK / WORK NOTE",
                  text: "Clean air arrives in replaceable layers. The workshop keeps a fresh layer for the waiting room. Its own filter carries one more service mark than the printed limit.",
                  position: [13, 19],
                },
                {
                  id: "hades:service:2",
                  title: "Three voices, one speaker",
                  source: "SIGNAL BENCH / CHANNEL DIAGRAM",
                  text: "An advertisement, a public route call, and a work request share the same old speaker. The repair note asks for separation, not more volume. Someone wants to hear the people underneath the advert.",
                  position: [23, 19],
                },
              ],
              cues: [
                {
                  id: "hades:service:cue-1",
                  text: "The filter is full again. I changed it at the start of the shift.",
                },
                {
                  id: "hades:service:cue-2",
                  text: "Leave the sound test low. There are people sleeping by the lockers.",
                },
                {
                  id: "hades:service:cue-3",
                  text: "This repair is for the public line. Leave the police carrier alone.",
                },
              ],
            },
            {
              id: "concourse",
              name: "Transfer concourse",
              x: 0,
              z: 12,
              tone: "#d8c589",
              air: "Wet coats pass a shelter rail. A street-level lift waits beyond the ticket check.",
              lore: [
                {
                  id: "hades:concourse:1",
                  title: "A city in coat pockets",
                  source: "LOST PROPERTY / DISPLAY",
                  text: "A comb, a school card, two keys, and a photograph sit under clear covers. Every object has a claim number. Most have a name written in a different hand.",
                  position: [-5, 19],
                },
                {
                  id: "hades:concourse:2",
                  title: "Street service remains open",
                  source: "TRANSFER MAP / LOCAL STOPS",
                  text: "White Dragon counter: open. Tea court: open. Animal repairs: bell service. The map does not call these places destinations. For most people on this platform, they are.",
                  position: [5, 19],
                },
              ],
              cues: [
                {
                  id: "hades:concourse:cue-1",
                  text: "Street level first. Then food. Then I will think about tomorrow.",
                },
                { id: "hades:concourse:cue-2", text: "The dry space is for everyone. Move your bag over a little." },
                {
                  id: "hades:concourse:cue-3",
                  text: "Noodle Row is still serving. Follow the warm signs after the lift.",
                },
              ],
            },
          ],
          spawn: { x: 0, y: 1.72, z: 23, yaw: 0, pitch: 0.03 },
          crowd: 56,
          intro:
            "Your transit flight settles at a shared transfer deck. Furnace light still moves under the cloud. Below you, the late stalls are opening. The city is already in motion.",
          exitText:
            "The city gives way to Holden's interview at Tyrell. The staff you met continue towards their own shifts.",
          ambience: "furnace",
        },
        holden: {
          key: "holden",
          role: "Holden",
          title: "People behind the glass",
          regions: [
            {
              id: "waiting",
              name: "Employee waiting room",
              x: -18,
              z: 12,
              tone: "#89bcb5",
              air: "Lunch tins rest beside interview slips. The chairs face a clock with no second hand.",
              lore: [
                {
                  id: "holden:waiting:1",
                  title: "Someone saved a place",
                  source: "WAITING ROOM / FOLDED CARD",
                  text: "A worker has folded a seat number around a photograph. The number faces out. The photograph faces the chair. It is a small way to keep a private life private.",
                  position: [-23, 19],
                },
                {
                  id: "holden:waiting:2",
                  title: "Two sorts of waiting",
                  source: "APPOINTMENT BOARD / LOCAL COPY",
                  text: "The board lists appointment times and arrival times. A handwritten note asks staff not to treat a late shuttle as a late worker. It has been signed, removed, and signed again.",
                  position: [-13, 19],
                },
              ],
              cues: [
                {
                  id: "holden:waiting:cue-1",
                  text: "You can sit here. I am keeping the other chair for someone on the late shuttle.",
                },
                {
                  id: "holden:waiting:cue-2",
                  text: "They told me to bring identification. They did not say how many times.",
                },
                {
                  id: "holden:waiting:cue-3",
                  text: "The water is for the waiting room. You do not need another token.",
                },
              ],
            },
            {
              id: "reception",
              name: "Tyrell staff reception",
              x: 0,
              z: 12,
              tone: "#deb580",
              air: "A quiet desk turns people into appointment numbers. A clerk still uses their names.",
              lore: [
                {
                  id: "holden:reception:1",
                  title: "The visitor-facing story",
                  source: "RECEPTION / COMPANY BROCHURE",
                  text: "The brochure shows a human hand above a flawless eye. The text promises precision. The desk behind it holds a worn hand pad, a spare pencil, and a repair request.",
                  position: [-5, 19],
                },
                {
                  id: "holden:reception:2",
                  title: "The person at the desk",
                  source: "RECEPTION / SHIFT NOTE",
                  text: "The note asks the next clerk to pronounce each name before calling it. There is no box for this in the official procedure. The clerk has made one.",
                  position: [5, 19],
                },
              ],
              cues: [
                { id: "holden:reception:cue-1", text: "Your name, please. Not only the appointment number." },
                {
                  id: "holden:reception:cue-2",
                  text: "The service entrance is for deliveries. No one told the new driver.",
                },
                { id: "holden:reception:cue-3", text: "We will call you. You do not have to stand under the speaker." },
              ],
            },
            {
              id: "records",
              name: "Dispatch and records office",
              x: 18,
              z: 12,
              tone: "#9aafc7",
              air: "Paper copies move beside green screens. One tray is for public information; the other is locked.",
              lore: [
                {
                  id: "holden:records:1",
                  title: "A route, not a person",
                  source: "DISPATCH / PUBLIC COPY RULE",
                  text: "This tray holds route changes. It does not hold employee files. A torn copy shows how easily the two can become one sheet when the printer feeds badly.",
                  position: [13, 19],
                },
                {
                  id: "holden:records:2",
                  title: "The promise of a copy",
                  source: "RECORDS / DUPLICATE REQUEST",
                  text: "The request asks for a second copy of an employment record. The first line is a number. Beneath it someone has written: this is the only record I have of that year.",
                  position: [23, 19],
                },
              ],
              cues: [
                {
                  id: "holden:records:cue-1",
                  text: "Public route information goes in the outer tray. Keep the names inside.",
                },
                { id: "holden:records:cue-2", text: "The screen says sent. I will wait for the paper to come back." },
                { id: "holden:records:cue-3", text: "A duplicate is not the same as a replacement. Keep both." },
              ],
            },
            {
              id: "garden",
              name: "Indoor garden and wash station",
              x: -18,
              z: -13,
              tone: "#b8bf83",
              air: "A small tree receives filtered light. A cleaner keeps the passage beside it dry.",
              lore: [
                {
                  id: "holden:garden:1",
                  title: "A living thing with a logbook",
                  source: "GARDEN / CARE LABEL",
                  text: "The tree's care sheet records water, light, and replacement leaves. It does not settle whether the tree is natural. The gardener checks the roots before reading the label.",
                  position: [-23, -6],
                },
                {
                  id: "holden:garden:2",
                  title: "The route behind the shine",
                  source: "CLEANING STORE / PASSAGE MAP",
                  text: "The public plan shows polished floors. The service plan shows drains, blind corners, and where a cart can turn. Both describe the same building, but only one explains how it stays open.",
                  position: [-13, -6],
                },
              ],
              cues: [
                {
                  id: "holden:garden:cue-1",
                  text: "People look up at the tree and miss the wet floor. Put the sign where they walk.",
                },
                { id: "holden:garden:cue-2", text: "The leaves are clean. I am still checking the roots." },
                {
                  id: "holden:garden:cue-3",
                  text: "There is a staff wash station behind the wall. The brochure leaves it out.",
                },
              ],
            },
            {
              id: "interview",
              name: "Interview suite",
              x: 0,
              z: -13,
              tone: "#dea576",
              air: "A ceiling fan moves slowly over an optical instrument. Leon waits across the table.",
              lore: [
                {
                  id: "holden:interview:1",
                  title: "An instrument needs care",
                  source: "OPTICAL BENCH / SERVICE CARD",
                  text: "A scratched lens can produce a clean-looking error. The card asks the operator to check the baseline before the interview. The instrument needs evidence too.",
                  position: [-5, -6],
                },
                {
                  id: "holden:interview:2",
                  title: "A limit to the record",
                  source: "INTERVIEW / OPERATOR NOTE",
                  text: "The recorder stores a response and its timing. It does not store every reason a person might hesitate. Holden has left room for observations beside the measured values.",
                  position: [5, -6],
                },
              ],
              cues: [
                {
                  id: "holden:interview:cue-1",
                  text: "INTERCOM: Interview room ready. No need to hurry the baseline.",
                },
                { id: "holden:interview:cue-2", text: "LEON: Do you need the chair closer to the table?" },
                {
                  id: "holden:interview:cue-3",
                  text: "The recorder runs quietly. Its green light does not explain what it records.",
                },
              ],
            },
            {
              id: "optics",
              name: "Optics service and staff tea",
              x: 18,
              z: -13,
              tone: "#98c8cf",
              air: "Lenses dry in numbered trays. Staff cups stay on the opposite bench.",
              lore: [
                {
                  id: "holden:optics:1",
                  title: "A repair the catalogue forgets",
                  source: "OPTICS / RETURNED PARTS",
                  text: "A lens mount has three layers of repair marks. Its original serial number is almost hidden. The technician adds today's check beside the previous worker's initials.",
                  position: [13, -6],
                },
                {
                  id: "holden:optics:2",
                  title: "A window is also a boundary",
                  source: "STAFF TEA / SHADE REQUEST",
                  text: "The staff asked for an opaque strip at seated eye level. The room still admits light. It no longer turns every break into a display for visitors.",
                  position: [23, -6],
                },
              ],
              cues: [
                {
                  id: "holden:optics:cue-1",
                  text: "A spare fan is ready. Do not make the interview louder to hide a bearing.",
                },
                { id: "holden:optics:cue-2", text: "The cup bench is over here. Keep liquid away from the optics." },
                {
                  id: "holden:optics:cue-3",
                  text: "You can admire the glass after the people behind it have finished their break.",
                },
              ],
            },
          ],
          spawn: { x: 0, y: 1.72, z: 23, yaw: 0, pitch: 0.03 },
          crowd: 28,
          intro:
            "Earlier in the shift. You are Holden, not Deckard. Staff are waiting, working, and trying to finish small tasks around the interview suite. Leon waits inside.",
          exitText:
            "Leon fires and escapes. Holden survives on life support. The viewpoint returns to Deckard at Noodle Row.",
          ambience: "office",
        },
      },
      t = [
        {
          id: "ruth",
          name: "Ruth Ko",
          role: "Platform announcer",
          scene: "hades",
          area: "dispatch",
          position: [-19, -12],
          trait: "Repeats corrections at the same calm volume.",
          job: "type",
          greeting: "The public board is one stop behind the real service.",
          topics: [
            {
              id: "work",
              label: "Your work",
              text: "I repeat the route until the last person in the queue understands. A louder announcement is not always a clearer one.",
            },
            {
              id: "life",
              label: "Life between shifts",
              text: "My next shift is at the street ticket counter. Same routes, more rain, fewer working speakers.",
            },
            {
              id: "city",
              label: "What this place hides",
              text: "Look at the handwritten strip below the bright display. The bright part is paid for. The useful part usually is not.",
            },
            {
              id: "next",
              label: "Where next?",
              text: "Find Lin at Noodle Row for street tickets. I will be there after the platform clears.",
            },
          ],
          reuse: "ruth",
          index: 60,
        },
        {
          id: "sable",
          name: "Sable Kimura",
          role: "Radio repairer",
          scene: "hades",
          area: "service",
          position: [19, 12],
          trait: "Keeps an ear on the weather channel.",
          job: "work",
          greeting: "There are three voices in this relay and no one can hear the route call.",
          topics: [
            {
              id: "work",
              label: "Your work",
              text: "The public channel is full of advert spill. I can clean that without touching the police carrier you need.",
            },
            {
              id: "life",
              label: "Life between shifts",
              text: "I work on the shared roof when the weather permits. Rain is usually first in the repair queue.",
            },
            {
              id: "city",
              label: "What this place hides",
              text: "A radio can make the whole city sound like an order. Listen beneath it. Most of the traffic is people asking for help.",
            },
            {
              id: "next",
              label: "Where next?",
              text: "The roof above Noodle Row has room for a small aerial. Come up when the street becomes too loud.",
            },
          ],
          reuse: "sable",
          index: 61,
        },
        {
          id: "marta",
          name: "Marta Velez",
          role: "Meal courier",
          scene: "hades",
          area: "canteen",
          position: [18, -11],
          trait: "Taps a brass token against her sleeve.",
          job: "carry",
          greeting: "The food is ready. I am waiting for the crate seal, not the cook.",
          topics: [
            {
              id: "work",
              label: "Your work",
              text: "These bowls are for workers whose break ended before the queue did. I keep the lids warm with a cloth.",
            },
            {
              id: "life",
              label: "Life between shifts",
              text: "I eat standing up, then tell everyone else to find a seat. It is easier to give advice than follow it.",
            },
            {
              id: "city",
              label: "What this place hides",
              text: "A delivery can be correct on paper and useless by the time it arrives. A meal has to arrive while someone can eat it.",
            },
            {
              id: "next",
              label: "Where next?",
              text: "I collect at the White Dragon later. Toma keeps the counter open when the signs say otherwise.",
            },
          ],
          reuse: "marta",
          index: 62,
        },
        {
          id: "bo",
          name: "Bo Nakamura",
          role: "Battery trader",
          scene: "hades",
          area: "freight",
          position: [-20, 12],
          trait: "Labels every cell with its test date.",
          job: "check",
          greeting: "Careful with that carrier. The warm cell is waiting for a check.",
          topics: [
            {
              id: "work",
              label: "Your work",
              text: "I test every used cell before I sell it. Cheap power is not cheap if it fails in the animal that someone loves.",
            },
            {
              id: "life",
              label: "Life between shifts",
              text: "The dates on the labels are my handwriting. That lets a customer find me if something goes wrong.",
            },
            {
              id: "city",
              label: "What this place hides",
              text: "People ask whether an animal is real. First ask whether its owner knows how to keep it alive or working.",
            },
            {
              id: "next",
              label: "Where next?",
              text: "Kira has a bench in Animoid Alley. I take the tested stock there after this transfer.",
            },
          ],
          reuse: "bo",
          index: 63,
        },
        {
          id: "inez",
          name: "Inez Rook",
          role: "Transfer pilot",
          scene: "hades",
          area: "overlook",
          position: [-4, -18],
          trait: "Checks the horizon before checking the clock.",
          job: "check",
          greeting: "We are at the transfer stop. The view is free while the lane clears.",
          topics: [
            {
              id: "work",
              label: "Your work",
              text: "The automatic system holds the approach. A person still checks the lane. Machines also need someone to notice the unusual.",
            },
            {
              id: "life",
              label: "Life between shifts",
              text: "I keep a spare scarf under the seat. The front glass never gets as warm as the passenger brochure suggests.",
            },
            {
              id: "city",
              label: "What this place hides",
              text: "From here you can see gardens behind high glass and roofs catching dirty rain. Distance makes both look peaceful.",
            },
            {
              id: "next",
              label: "Where next?",
              text: "The street lift is behind the concourse. The food stalls below will still be serving when you arrive.",
            },
          ],
          reuse: null,
          index: 64,
          look: {
            skin: "#af846b",
            hair: "#292e33",
            coat: "#527781",
            accessory: "visor",
            hairStyle: 4,
            face: 4,
            age: 33,
          },
        },
        {
          id: "amal",
          name: "Amal Serrin",
          role: "Night cook",
          scene: "hades",
          area: "canteen",
          position: [23, -17],
          trait: "Sets cracked cups aside without throwing them away.",
          job: "stir",
          greeting: "The last pot is still hot. The display clock does not eat here.",
          topics: [
            {
              id: "work",
              label: "Your work",
              text: "Mushroom stems give the broth body. The big menu calls it something more expensive. My small card says what is actually in it.",
            },
            {
              id: "life",
              label: "Life between shifts",
              text: "My sister eats here between shifts. We have not managed the same meal time this week.",
            },
            {
              id: "city",
              label: "What this place hides",
              text: "The suspended-meal book stays shut to the queue. Help should not require a public performance.",
            },
            {
              id: "next",
              label: "Where next?",
              text: "White Dragon serves at street level. Tell the cook this pot lasted through the last transfer.",
            },
          ],
          reuse: null,
          index: 65,
          look: {
            skin: "#b68972",
            hair: "#3c3130",
            coat: "#936b49",
            accessory: "headwrap",
            hairStyle: 6,
            face: 5,
            age: 35,
          },
        },
        {
          id: "tavi",
          name: "Tavi Sen",
          role: "Freight clerk",
          scene: "hades",
          area: "freight",
          position: [-14, 7],
          trait: "Places fragile stamps above, never across, a person's name.",
          job: "file",
          greeting: "Some of these parcels are leaving Earth. Most are going three streets away.",
          topics: [
            {
              id: "work",
              label: "Your work",
              text: "I check the destination against the small receipt, not the promotional label on the box.",
            },
            {
              id: "life",
              label: "Life between shifts",
              text: "Lost property stays a little longer on my shift. A late worker is not the same as an absent owner.",
            },
            {
              id: "city",
              label: "What this place hides",
              text: "You can tell a contract parcel by its labels. A personal parcel has repairs, string, and someone asking us to be careful.",
            },
            {
              id: "next",
              label: "Where next?",
              text: "Pal makes local deliveries near Noodle Row. He knows which shop names changed and which doors did not.",
            },
          ],
          reuse: null,
          index: 66,
          look: {
            skin: "#a27962",
            hair: "#29343a",
            coat: "#667885",
            accessory: "glasses",
            hairStyle: 2,
            face: 0,
            age: 37,
          },
        },
        {
          id: "jory",
          name: "Jory Vale",
          role: "Air-system cleaner",
          scene: "hades",
          area: "concourse",
          position: [5, 14],
          trait: "Writes the replacement date on the side people can see.",
          job: "sweep",
          greeting: "I am clearing the dry path. Please leave a little room by the rail.",
          topics: [
            {
              id: "work",
              label: "Your work",
              text: "The filters are arranged by the order they serve. Waiting room first. My bench gets the last clean section.",
            },
            {
              id: "life",
              label: "Life between shifts",
              text: "At home I put wet shoes above a tray. I spend enough time moving other people's water at work.",
            },
            {
              id: "city",
              label: "What this place hides",
              text: "A bright lobby is someone's long shift. The light does not polish the floor on its own.",
            },
            {
              id: "next",
              label: "Where next?",
              text: "Ash keeps a safe passage in Noodle Row. Follow the chalk marks when the drains overflow.",
            },
          ],
          reuse: null,
          index: 67,
          look: { skin: "#7c5c49", hair: "#2a292b", coat: "#7e7461", accessory: "cap", hairStyle: 1, face: 1, age: 39 },
        },
        {
          id: "imani",
          name: "Imani Wells",
          role: "Queue volunteer",
          scene: "holden",
          area: "waiting",
          position: [-19, 13],
          trait: "Carries a stack of folding seats.",
          job: "check",
          greeting: "You are the interviewer. Before you start, this waiting room could use drinking water.",
          topics: [
            {
              id: "work",
              label: "Your work",
              text: "I help people find the right queue. Some arrived with one shift notice and found three desks asking for it.",
            },
            {
              id: "life",
              label: "Life between shifts",
              text: "I have a seat stack at the clinic too. Most systems assume everyone can stand as long as the queue takes.",
            },
            {
              id: "city",
              label: "What this place hides",
              text: "The token slot is from an old dispenser. Water for this room is shared. The misleading light is the part we need to fix.",
            },
            {
              id: "next",
              label: "Where next?",
              text: "I return to the night clinic after this shift. These people will know me there, not necessarily you.",
            },
          ],
          reuse: "imani",
          index: 68,
        },
        {
          id: "vera",
          name: "Vera Quinn",
          role: "Night-load coordinator",
          scene: "holden",
          area: "records",
          position: [18, 13],
          trait: "Keeps delivery times in a pocket clock.",
          job: "file",
          greeting: "The dispatch copy is stuck behind a page of employee names.",
          topics: [
            {
              id: "work",
              label: "Your work",
              text: "I only need the public route change. The personnel page belongs inside this office.",
            },
            {
              id: "life",
              label: "Life between shifts",
              text: "A delay here becomes a missed delivery below. No one sees the desk where the delay began.",
            },
            {
              id: "city",
              label: "What this place hides",
              text: "Two papers can stick together. That does not make their contents equally public. Keep the record narrow.",
            },
            {
              id: "next",
              label: "Where next?",
              text: "My next load goes to Noodle Row. Any note I send will name the route, not this interview.",
            },
          ],
          reuse: "vera",
          index: 69,
        },
        {
          id: "ash",
          name: "Ash Laurent",
          role: "Sanitation worker",
          scene: "holden",
          area: "garden",
          position: [-20, -12],
          trait: "Marks safe paths with chalk.",
          job: "sweep",
          greeting: "People look at the garden and miss the wet turn beside it.",
          topics: [
            {
              id: "work",
              label: "Your work",
              text: "A service cart is blocking the dry route. The painted plan says this corner is wide enough. The cart disagrees.",
            },
            {
              id: "life",
              label: "Life between shifts",
              text: "I carry chalk home. A broken step needs a warning before it needs a complaint form.",
            },
            {
              id: "city",
              label: "What this place hides",
              text: "The service map tells you where the drains are. The visitor map shows the sculpture. You need both to walk safely.",
            },
            {
              id: "next",
              label: "Where next?",
              text: "I work the west alley in Noodle Row later. A public passage stays public only when someone clears it.",
            },
          ],
          reuse: "ash",
          index: 70,
        },
        {
          id: "celia",
          name: "Celia Tran",
          role: "Fan mechanic",
          scene: "holden",
          area: "optics",
          position: [20, -12],
          trait: "Has a paper wind vane on her bench.",
          job: "work",
          greeting: "The main duct is rattling. A spare circuit is waiting on the panel.",
          topics: [
            {
              id: "work",
              label: "Your work",
              text: "The spare fan supplies the waiting room. It is separate from your optical baseline. One repair must not conceal another fault.",
            },
            {
              id: "life",
              label: "Life between shifts",
              text: "At the street bench I use a paper vane. A small moving strip explains airflow better than an expensive screen.",
            },
            {
              id: "city",
              label: "What this place hides",
              text: "The interview room is quiet because the machines have been moved into someone else's workspace. Listen here.",
            },
            {
              id: "next",
              label: "Where next?",
              text: "You can send the work note to my street bench. Do not send the interview record with it.",
            },
          ],
          reuse: "celia",
          index: 71,
        },
        {
          id: "miri",
          name: "Miri Anwar",
          role: "Staff reception clerk",
          scene: "holden",
          area: "reception",
          position: [-4, 14],
          trait: "Reads a name aloud before entering its number.",
          job: "type",
          greeting: "Holden. Your instrument is ready for calibration. Leon is waiting inside.",
          topics: [
            {
              id: "work",
              label: "Your work",
              text: "My job is to tell people where to go without making them feel they have already done something wrong.",
            },
            {
              id: "life",
              label: "Life between shifts",
              text: "The names on this list will be different tomorrow. I still try to learn how to pronounce today's names.",
            },
            {
              id: "city",
              label: "What this place hides",
              text: "A company can count an appointment more easily than it can count the cost of waiting for one.",
            },
            {
              id: "next",
              label: "Where next?",
              text: "Check the optical bench, set the baseline, then speak to Leon. Start only when you are ready to leave the annex behind.",
            },
          ],
          reuse: null,
          index: 72,
          look: {
            skin: "#bd9b7f",
            hair: "#33323b",
            coat: "#5b7774",
            accessory: "earring",
            hairStyle: 7,
            face: 0,
            age: 49,
          },
        },
        {
          id: "kess",
          name: "Kess Morita",
          role: "Optical service technician",
          scene: "holden",
          area: "optics",
          position: [23, -5],
          trait: "Keeps cleaning cloths apart from ordinary rags.",
          job: "check",
          greeting: "The lens is clean. The baseline still needs your own check.",
          topics: [
            {
              id: "work",
              label: "Your work",
              text: "I test the equipment, not the person. Those are different duties. Keep that distinction in your notes.",
            },
            {
              id: "life",
              label: "Life between shifts",
              text: "The oldest repair mark on that mount is not mine. I leave space for the next technician beside it.",
            },
            {
              id: "city",
              label: "What this place hides",
              text: "A precise number can be attached to a poor observation. The operator still has to know what was measured.",
            },
            {
              id: "next",
              label: "Where next?",
              text: "Leon is in the suite. Write what you observe, not what someone else might expect to find.",
            },
          ],
          reuse: null,
          index: 73,
          look: {
            skin: "#b99778",
            hair: "#c1b69c",
            coat: "#6a7a81",
            accessory: "glasses",
            hairStyle: 8,
            face: 1,
            age: 51,
          },
        },
        {
          id: "nessa",
          name: "Nessa Venn",
          role: "Staff welfare clerk",
          scene: "holden",
          area: "garden",
          position: [-15, -18],
          trait: "Turns a privacy card towards the room, not the visitor.",
          job: "file",
          greeting: "The glass gives light. It does not have to give everyone a view of a tired worker.",
          topics: [
            {
              id: "work",
              label: "Your work",
              text: "The staff asked for a shade across seated eye level. It is a small request. That does not make it unimportant.",
            },
            {
              id: "life",
              label: "Life between shifts",
              text: "I eat behind the shaded window. It is the only room where I am not watching a queue.",
            },
            {
              id: "city",
              label: "What this place hides",
              text: "A bright building can still have tired people inside. The brochure has no picture for that.",
            },
            {
              id: "next",
              label: "Where next?",
              text: "I stay with the waiting room until everyone has left. The interview is your responsibility.",
            },
          ],
          reuse: null,
          index: 74,
          look: {
            skin: "#936d58",
            hair: "#2a2e35",
            coat: "#78725d",
            accessory: "headwrap",
            hairStyle: 4,
            face: 2,
            age: 53,
          },
        },
        {
          id: "ajay",
          name: "Ajay Lorne",
          role: "New stock assistant",
          scene: "holden",
          area: "waiting",
          position: [-14, 5],
          trait: "Folds an appointment slip until the crease becomes soft.",
          job: "wait",
          greeting: "I am not the person you are testing. I am waiting for a stores key.",
          topics: [
            {
              id: "work",
              label: "Your work",
              text: "I count containers, then count them again after the lift arrives. Most of the job is finding why the two counts differ.",
            },
            {
              id: "life",
              label: "Life between shifts",
              text: "I brought a lunch tin. No one could tell me whether this shift includes a meal break.",
            },
            {
              id: "city",
              label: "What this place hides",
              text: "From outside, this building looks like one employer. Inside, each desk seems to work for a different clock.",
            },
            {
              id: "next",
              label: "Where next?",
              text: "Leon was called to the interview room. I do not know him. We shared a waiting room, not a life.",
            },
          ],
          reuse: null,
          index: 75,
          look: {
            skin: "#b39270",
            hair: "#35312b",
            coat: "#6a6f80",
            accessory: "none",
            hairStyle: 2,
            face: 3,
            age: 55,
          },
        },
      ].map((n) => {
        let o = Sl.find((l) => l.id === n.reuse);
        return o ? { ...n, look: { ...o.look }, index: o.index } : n;
      });
    return {
      PROLOGUE_VERSION: a,
      PROLOGUE_SCENES: e,
      PROLOGUE_PEOPLE: t,
      PROLOGUE_FAVOURS: [
        {
          id: "route-strip",
          title: "The stop that vanished",
          scene: "hades",
          person: "ruth",
          area: "dispatch",
          position: [-14, -17],
          model: "sign",
          summary: "Give the public board the missing street-transfer stop.",
          clue: "The public route is marked LOCAL 06. The large board still names the old platform. Ruth's paper slip says STREET TRANSFER / BAY 6.",
          options: [
            "Post the public Bay 6 correction.",
            "Copy a police landing code.",
            "Replace the board with the off-world advert.",
          ],
          answer: 0,
          result: "A fresh strip covers the old platform number. The queue divides into the correct lanes.",
          ending: ["Read the correction aloud for Ruth.", "Leave Ruth a clear printed copy."],
          callback: "Ruth can acknowledge the public route correction at Noodle Row.",
        },
        {
          id: "meal-seal",
          title: "Before the broth goes cold",
          scene: "hades",
          person: "marta",
          area: "canteen",
          position: [14, -17],
          model: "paper",
          summary: "Match a meal crate to the local workers' delivery.",
          clue: "The cloth-covered crate says WHITE DRAGON / LOCAL STAFF. The cold parcel beside it is marked RETURN TO STORE.",
          options: ["Send the cold return parcel.", "Seal the warm local-staff crate.", "Send both crates off-world."],
          answer: 1,
          result: "Marta takes the warm crate. A worker at the far counter receives a bowl.",
          ending: ["Write the cook's name on the receipt.", "Keep the receipt simple and help carry the crate."],
          callback: "Marta remembers this delivery, without completing her later ration-token favour.",
        },
        {
          id: "cell-check",
          title: "A carrier worth keeping",
          scene: "hades",
          person: "bo",
          area: "freight",
          position: [-24, 5],
          model: "device",
          summary: "Help Bo separate a warm used cell from the tested stock.",
          clue: "The dated label means tested. The red sleeve means waiting for inspection. The carrier must use the green, tested stock.",
          options: [
            "Fit the untested red-sleeve cell.",
            "Erase the red test mark.",
            "Move the red-sleeve cell into the check tray.",
          ],
          answer: 2,
          result: "The untested cell is isolated. The carrier lamp settles to a steady green.",
          ending: ["Keep the owner's care note with the carrier.", "Add the test date to Bo's receipt."],
          callback: "Bo remembers how you handled the carrier. The later sheep repair still needs its own work.",
        },
        {
          id: "public-relay",
          title: "A voice under the advert",
          scene: "hades",
          person: "sable",
          area: "service",
          position: [24, 5],
          model: "device",
          summary: "Restore the public route voice without changing the police channel.",
          clue: "Sable's diagram separates ADVERT, PUBLIC, and POLICE. The loose bridge joins ADVERT to PUBLIC. The police circuit is already isolated.",
          options: [
            "Keep the public circuit separate from the advert.",
            "Join all three circuits.",
            "Mute the public voice.",
          ],
          answer: 0,
          result:
            "The public voice returns. The advert stays on its own circuit. Your required police-channel calibration is still unfinished.",
          ending: ["Test the quiet route announcement.", "Leave the test note for the next shift."],
          callback: "Sable recognises you on the shared roof and remembers the public relay.",
        },
        {
          id: "water-queue",
          title: "No token required",
          scene: "holden",
          person: "imani",
          area: "waiting",
          position: [-24, 5],
          model: "device",
          summary: "Restore the waiting room's shared-water indicator.",
          clue: "The label reads STAFF AND VISITORS / NO TOKEN. The obsolete token lamp is on. The shared-service indicator is off.",
          options: [
            "Ask each visitor to buy another token.",
            "Select the labelled shared-service indicator.",
            "Close the dispenser for the night.",
          ],
          answer: 1,
          result: "The correct indicator lights. A cup fills at the waiting-room dispenser.",
          ending: ["Put a clear no-token card beside the cup.", "Tell the queue volunteer that service is restored."],
          callback: "At Noodle Row, Imani can report that Holden helped; she must not credit Deckard.",
        },
        {
          id: "public-copy",
          title: "Only the route",
          scene: "holden",
          person: "vera",
          area: "records",
          position: [24, 5],
          model: "paper",
          summary: "Make a public route copy without exposing personnel records.",
          clue: "The top sheet is a public delivery-route change. The lower sheet lists employee names. Vera needs only the top sheet.",
          options: [
            "Copy both sheets.",
            "Post the personnel list in the waiting room.",
            "Separate and copy only the route sheet.",
          ],
          answer: 2,
          result: "The route copy enters the outer tray. The personnel sheet stays behind the desk.",
          ending: ["Mark the copy for the street dispatch desk.", "Give the copy directly to Vera."],
          callback: "Vera later mentions a narrow, public handoff from Tyrell, not personal knowledge of Deckard.",
        },
        {
          id: "dry-turn",
          title: "Room to pass",
          scene: "holden",
          person: "ash",
          area: "garden",
          position: [-24, -3.5],
          model: "cabinet",
          summary: "Open the dry route beside the indoor garden.",
          clue: "The service map marks a recess for the cart. The wet corner is not the safe route. The folding caution sign must remain visible.",
          options: [
            "Move the cart into its marked recess.",
            "Hide the wet-floor sign.",
            "Put the cart across the staff door.",
          ],
          answer: 0,
          result: "The cart fits its recess. The dry passage opens. The caution sign remains at the wet turn.",
          ending: ["Leave a clear chalk arrow on the safe side.", "Check the passage with Ash."],
          callback: "Ash later describes the cleared passage as Holden's help, not Deckard's.",
        },
        {
          id: "spare-fan",
          title: "The quieter room",
          scene: "holden",
          person: "celia",
          area: "optics",
          position: [24, -18],
          model: "device",
          summary: "Switch the waiting-room air system to its marked spare.",
          clue: "Celia's tag reads WAITING ROOM / SPARE B. The optical bench and the interview recorder are separate controls.",
          options: [
            "Turn off the interview recorder.",
            "Select the marked waiting-room spare.",
            "Change the optical baseline to hide the vibration.",
          ],
          answer: 1,
          result: "The waiting-room duct settles. The optical baseline still needs your own check.",
          ending: ["Leave the faulty unit tagged for service.", "Write down the change for the next shift."],
          callback: "Celia sends a public repair note to her street bench. Interview contents stay private.",
        },
      ],
      HOLDEN_PORTRAIT: {
        id: "holden",
        index: 81,
        name: "Holden",
        role: "Interview officer",
        look: {
          skin: "#a9876f",
          hair: "#594e43",
          coat: "#778080",
          hairStyle: 5,
          face: 1,
          accessory: "stubble",
          age: 43,
        },
      },
      LEON_PORTRAIT: {
        id: "leon",
        index: 82,
        name: "Leon",
        role: "New employee",
        look: { skin: "#bb9b7b", hair: "#574735", coat: "#685e4c", hairStyle: 0, face: 5, accessory: "none", age: 31 },
      },
    };
  })(),
  {
    cleanOpeningState: nT,
    openingCompleteCount: sT,
    openingReturnLine: H3,
  } = (() => {
    let a = (i, r) => (Array.isArray(i) ? [...new Set(i.filter((n) => typeof n == "string" && r.has(n)))] : []);
    function e(i) {
      let r = new Set(Object.values(ji).flatMap((c) => c.regions.flatMap((h) => h.lore.map((d) => d.id)))),
        n = new Set(Object.values(ji).flatMap((c) => c.regions.flatMap((h) => h.cues.map((d) => d.id)))),
        o = new Set(Object.values(ji).flatMap((c) => c.regions.map((h) => c.key + ":" + h.id))),
        l = {
          version: 1,
          met: { Deckard: [], Holden: [] },
          topics: Object.fromEntries(Ha.map((c) => [c.scene + ":" + c.id, []])),
          rapport: {},
          favours: {},
          lore: [],
          heard: [],
          areas: [],
          log: [],
          position: null,
          tracked: null,
        };
      if (i && typeof i == "object") {
        for (let d of ["Deckard", "Holden"])
          l.met[d] = a(i.met?.[d], new Set(Ha.filter((f) => ji[f.scene].role === d).map((f) => f.id)));
        for (let d of Ha) {
          let f = d.scene + ":" + d.id;
          l.topics[f] = a(i.topics?.[f], new Set(d.topics.map((u) => u.id)));
          let g = i.rapport?.[f];
          Number.isFinite(g) && (l.rapport[f] = Math.max(-4, Math.min(4, Math.floor(g))));
        }
        for (let [d, f] of [
          ["lore", r],
          ["heard", n],
          ["areas", o],
        ])
          l[d] = a(i[d], f);
        Array.isArray(i.log) &&
          (l.log = i.log
            .filter(
              (d) =>
                d &&
                ["hades", "holden"].includes(d.scene) &&
                ["Deckard", "Holden"].includes(d.role) &&
                d.role === ji[d.scene].role &&
                typeof d.id == "string" &&
                typeof d.text == "string",
            )
            .slice(-200)
            .map((d) => ({
              id: d.id.slice(0, 100),
              role: d.role,
              scene: d.scene,
              title: String(d.title || "").slice(0, 100),
              text: d.text.slice(0, 1600),
            })));
        let c = i.position;
        c &&
          ji[c.scene] &&
          ["x", "z", "yaw"].every((d) => Number.isFinite(c[d])) &&
          Math.abs(c.x) <= 26.5 &&
          Math.abs(c.z) <= 26.5 &&
          (l.position = { scene: c.scene, x: c.x, z: c.z, yaw: Math.max(-1e4, Math.min(1e4, c.yaw)) });
        let h = i.tracked;
        h &&
          ((h.type === "person" && Ha.some((d) => d.id === h.id)) ||
            (h.type === "favour" && qn.some((d) => d.id === h.id)) ||
            (h.type === "lore" && r.has(h.id)) ||
            (h.type === "area" && o.has(h.id))) &&
          (l.tracked = { type: h.type, id: h.id });
      }
      for (let c of qn) {
        let h = i?.favours?.[c.id],
          d = Number.isFinite(h?.stage) ? Math.max(0, Math.min(3, Math.floor(h.stage))) : 0,
          f = [0, 1].includes(h?.choice) ? h.choice : null;
        (d === 3 && f === null && (d = 2), (l.favours[c.id] = { stage: d, choice: d === 3 ? f : null }));
      }
      return l;
    }
    function t(i, r = null) {
      return qn.filter((n) => (!r || n.scene === r) && i?.favours?.[n.id]?.stage === 3).length;
    }
    function s(i, r) {
      let n = Ha.find((d) => d.reuse === i);
      if (!n || !r) return null;
      let o = ji[n.scene].role,
        l = r.met?.[o]?.includes(i),
        c = qn.find((d) => d.person === i),
        h = c && r.favours?.[c.id]?.stage === 3;
      return o === "Deckard" && l
        ? {
            role: o,
            kind: "recognition",
            title: "REMEMBERS DECKARD / TRANSFER DECK",
            text: {
              ruth: h
                ? "You helped correct Bay 6. The last passengers found their lift. I kept your copy."
                : "I saw you at the transfer deck. Down here the board is still one stop behind.",
              sable: h
                ? "The public relay is still clear. I brought the service note to this roof. The advert no longer covers the route call."
                : "We spoke above the city. This is the roof I told you about. The weather channel is easier to hear here.",
              marta: h
                ? "That warm crate reached the workers in time. This token delivery is another job. Thank you for the first one."
                : "You were at the transfer canteen. I made it down before the next queue formed.",
              bo: h
                ? "I kept the care note with the carrier. The tested stock is here now. Kira still needs to examine that street sheep separately."
                : "You looked at the carrier on the transfer deck. I brought the tested cells down with me.",
            }[i],
            choice: h ? r.favours[c.id].choice : null,
          }
        : o === "Holden" && h
          ? {
              role: o,
              kind: "handoff",
              title: "PUBLIC SHIFT HANDOFF / ABOUT HOLDEN",
              text: {
                imani:
                  "Holden helped restore the waiting-room water at Tyrell. I heard about the interview later. You are not him; I know. I am glad someone is asking.",
                vera: "A public route copy came down from Tyrell before the alarm. Holden helped keep the personnel names off it. This copy says nothing about the interview.",
                ash: "An officer named Holden helped me clear a passage upstairs. The chalk stayed after he went into the interview. You remind me of the work still left to do, not of knowing him.",
                celia:
                  "Holden helped switch the waiting room to its spare fan. I sent the repair note here. I did not send an interview record. I do not have one.",
              }[i],
              choice: r.favours[c.id].choice,
            }
          : null;
    }
    return { cleanOpeningState: e, openingCompleteCount: t, openingReturnLine: s };
  })(),
  {
    PLAYER_PORTRAIT: aT,
    GAFF_PORTRAIT: rX,
    portraitSVG: Yi,
  } = (() => {
    let a = (i) =>
        String(i ?? "").replace(
          /[&<>"']/g,
          (r) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[r],
        ),
      e = {
        id: "deckard",
        index: 51,
        name: "Deckard",
        role: "Former blade runner",
        look: {
          skin: "#b78e75",
          hair: "#323338",
          coat: "#666951",
          hairStyle: 2,
          face: 3,
          accessory: "stubble",
          age: 42,
        },
      },
      t = {
        id: "gaff",
        index: 52,
        name: "Gaff",
        role: "Police escort",
        look: { skin: "#aa876b", hair: "#262b33", coat: "#776346", hairStyle: 3, face: 5, accessory: "hat", age: 45 },
      };
    function s(i, r = "neutral", n = "portrait") {
      let o = i || e,
        l = o.look,
        c = (o.id + "-" + n).replace(/[^a-z0-9_-]/gi, ""),
        h = o.index || 0,
        d = l.face || 0,
        f = 46 + d * 2,
        g = 30 + (d % 4) * 4,
        u = 225 + (d % 3) * 5,
        p = 153 + (d % 3) * 3,
        m = ["#82d9ce", "#ddb179", "#b1a1d8", "#90b9db"][h % 4],
        y = ["#f2bc85", "#d79471", "#e1b5a0"][h % 3],
        b = r === "warm" ? 1 : r === "guarded" ? -1 : 0,
        x = l.age || 40,
        T = l.hair || "#28333a",
        v = l.skin || "#b98c70",
        A = l.coat || "#4f6570",
        S = b > 0 ? "M110 203 Q129 214 148 201" : b < 0 ? "M111 205 Q130 200 147 207" : "M112 204 Q129 207 146 203",
        _ = [
          "M78 147 L75 105 Q88 60 133 69 Q179 68 184 112 L178 154 L165 120 L103 107Z",
          "M79 154 Q52 81 97 68 Q166 36 186 98 L178 166 L165 110 L148 98 L118 121 L90 113Z",
          "M78 144 L72 114 L80 87 L102 81 L108 66 L153 77 L177 97 L181 143 L165 123 L153 115 L156 98 L109 110 L91 111Z",
          "M75 148 L74 94 Q123 52 178 92 L185 141 L165 121 L95 120Z",
          "M79 174 Q60 108 84 82 Q107 65 131 72 Q178 58 186 99 L193 187 L166 176 L166 124 L100 112 L91 178Z",
          "M77 144 Q72 96 91 85 Q130 59 173 92 L182 151 L166 139 L162 111 Q128 104 98 121 L88 145Z",
          "M65 211 L69 118 Q63 67 122 61 Q182 54 192 104 L196 212 L173 210 L168 122 L150 101 L108 121 L91 202Z",
          "M75 146 L68 99 L78 77 L102 65 L115 75 L132 61 L150 74 L173 72 L186 97 L182 145 L165 113 L102 115Z",
          "M80 132 Q82 77 128 76 Q173 78 177 132 L162 110 L145 91 L117 92 L96 112Z",
          "M75 152 L75 107 Q85 61 124 70 Q179 69 185 109 L181 154 L161 135 L142 108 L97 119Z",
        ],
        k = "",
        E = l.accessory;
      (["glasses", "visor"].includes(E) &&
        (k += `<g fill="${E === "visor" ? "#346075" : "none"}" fill-opacity=".65" stroke="#8faeb0" stroke-width="3"><path d="M83 ${p - 9}h39v23H87Z M136 ${p - 9}h38l-4 23h-34Z"/><path d="M122 ${p}h14"/></g>`),
        E === "earring" &&
          (k += `<circle cx="180" cy="177" r="9" fill="none" stroke="${m}" stroke-width="4"/><path d="M180 186v15" stroke="${m}" stroke-width="3"/>`),
        (E === "cap" || E === "hat") &&
          (k +=
            E === "hat"
              ? `<path d="M81 104 L89 57 L150 50 L174 105Z" fill="${A}"/><path d="M88 92l81-5 4 17-90 6Z" fill="#242e30"/><path d="M54 110l132-13 19 13-147 18Z" fill="${A}"/>`
              : `<path d="M73 113Q79 72 127 73Q176 78 182 113L146 106Z" fill="${A}"/><path d="M93 107l96 5 14 14-116-3Z" fill="#6f8281"/>`),
        E === "headwrap" &&
          (k += `<path d="M71 150Q52 77 119 64Q186 56 189 151L172 130Q158 105 84 125Z" fill="${m}"/><path d="M77 111Q133 82 182 111M77 95Q133 64 171 90M76 125l56-28" stroke="#425764" stroke-width="5" fill="none" opacity=".7"/>`),
        (E === "beard" || E === "stubble") &&
          (k += `<path d="M83 177l16 20 16 7 14-6 19 5 18-18 8-12-8 42-29 20-28-8-18-14Z" fill="${T}" opacity="${E === "stubble" ? ".24" : ".87"}"/><path d="M109 199l16-4 25 4-4 7-19-4-15 5Z" fill="${T}" opacity=".7"/>`),
        E === "headset" &&
          (k += `<path d="M71 164Q49 90 97 68" stroke="#799ba3" stroke-width="8" fill="none"/><rect x="60" y="143" width="17" height="42" rx="5" fill="#254957"/><path d="M68 181l28 21 13 1" stroke="${m}" stroke-width="3" fill="none"/>`),
        E === "scar" && (k += '<path d="M159 132l-8 22 4 16" fill="none" stroke="#d5a18a" stroke-width="2"/>'));
      let M = "";
      x > 45 &&
        (M =
          '<g stroke="#715a51" stroke-width="1.4" opacity=".6" fill="none"><path d="M97 129q27-7 52 0 M101 122q22-6 43-1 M91 170l17 3 M153 174l13-6 M106 194l-8 12 M151 193l9 15"/></g>');
      let R = Array.from(
        { length: 12 },
        (N, P) => `<path d="M${12 + ((P * 31 + h * 9) % 235)} ${(P * 47) % 280}l-8 29"/>`,
      ).join("");
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 340" role="img" aria-label="Illustrated portrait of ${a(o.name)}" class="character-portrait">
 <defs><linearGradient id="${c}-bg" x2="1" y2="1"><stop stop-color="#182f3d"/><stop offset="1" stop-color="#060f19"/></linearGradient><linearGradient id="${c}-face"><stop stop-color="${y}"/><stop offset=".48" stop-color="${v}"/><stop offset="1" stop-color="#604c46"/></linearGradient><linearGradient id="${c}-coat" x2="1" y2=".2"><stop stop-color="${A}"/><stop offset="1" stop-color="#162e3a"/></linearGradient></defs>
 <rect width="260" height="340" fill="url(#${c}-bg)"/><path d="M13 52h22v228H13ZM212 25h16v234h-16Z" fill="${m}" opacity=".28"/>
 <path d="M0 269L51 257 88 246 166 246 222 272 260 327v13H0Z" fill="url(#${c}-coat)"/>
 <path d="M99 223v31l29 34 32-38-3-31Z" fill="${v}"/><path d="M98 226l28 20 33-22-5 22-25 24-29-16Z" fill="#584c48" opacity=".68"/>
 <path d="M83 244l44 45-37 45-31-61ZM162 241l-34 48 25 48 41-66Z" fill="${A}"/>
 <path d="M82 246l35 45-24 19-30-37M164 244l-26 45 13 20 40-40" fill="none" stroke="${m}" opacity=".45" stroke-width="2"/>
 <path d="M${129 - f} 117Q${118 - f} 82 129 79Q${135 + f} 81 ${129 + f} 115L${128 + f} 178 166 214 ${129 + g / 2} ${u} 119 ${u + 3} ${129 - g} 214 84 181Z" fill="url(#${c}-face)"/>
 <path d="M133 97l35 25-5 47-14 20-3 20-18 8 31 5 17-22 6-53-7-40Z" fill="#584a45" opacity=".3"/>
 <path d="M80 146l-9 4 3 27 11 6M177 149l10 6-7 25-7 1" fill="${v}"/>
 <path d="M89 ${p - 10 - b * 2}l25 ${-3 + b * 3} M139 ${p - 12 + b * 2}l25 ${4 - b * 3}" fill="none" stroke="${T}" stroke-width="4"/>
 <path d="M90 ${p}q13 ${-6 + b * 2} 24 0q-11 8-24 0 M139 ${p}q12 ${-5 + b * 2} 25 1q-12 7-25-1" fill="#c6bdab"/>
 <circle cx="104" cy="${p}" r="3.8" fill="#162d35"/><circle cx="151" cy="${p}" r="3.8" fill="#162d35"/>
 <circle cx="105" cy="${p - 1}" r="1.2" fill="${m}"/><circle cx="152" cy="${p - 1}" r="1.2" fill="${m}"/>
 <path d="M130 151l-7 31 13 3" fill="none" stroke="#6b5148" stroke-width="2.2"/><path d="M120 186l15 2" stroke="${y}" stroke-width="2"/>
 ${M}<path d="${_[l.hairStyle % 10]}" fill="${T}"/><path d="M88 100q31-30 75-7" fill="none" stroke="${m}" stroke-width="2" opacity=".36"/>
 <path d="${S}" fill="none" stroke="#593f40" stroke-width="2.6"/>${k}
 <path d="M${128 + f} 117l-1 61-13 34" fill="none" stroke="${m}" stroke-width="2.5" opacity=".76"/>
 <g stroke="${m}" stroke-width="1" opacity=".13">${R}</g>
 <rect y="315" width="260" height="25" fill="#0b1d29" opacity=".72"/><path d="M13 327h27" stroke="${m}" stroke-width="2"/>
 <text x="48" y="331" fill="${m}" font-size="10" font-family="monospace" letter-spacing="2">${a((o.id === "deckard" ? "FIELD / 26354" : "ROW / " + String(h + 1).padStart(2, "0")).toUpperCase())}</text></svg>`;
    }
    return { PLAYER_PORTRAIT: e, GAFF_PORTRAIT: t, portraitSVG: s };
  })(),
  {
    cleanDistrictState: oT,
    districtQuestTarget: V_,
    districtCompleteCount: Bf,
  } = (() => {
    let a = (i, r, n) => Math.max(r, Math.min(n, i));
    function e(i, r = {}) {
      let n = {
          version: 1,
          met: [],
          topics: Object.fromEntries(Sl.map((g) => [g.id, []])),
          rapport: {},
          visits: 0,
          visitedAreas: [],
          readLore: [],
          heard: [],
          quests: {},
          changes: {},
          inventory: [],
          log: [],
          clock: 0,
          tracked: null,
          position: null,
          gaff: { announced: !1, departed: !1 },
          lastVisit: "",
        },
        o = new Set(Sl.map((g) => g.id)),
        l = new Set($s.map((g) => g.id)),
        c = new Set($s.flatMap((g) => g.lore.map((u) => u.id))),
        h = new Set($s.flatMap((g) => g.overheard.map((u, p) => g.id + ":" + p))),
        d = new Set(wr.map((g) => g.reward)),
        f = (g, u) => (Array.isArray(g) ? [...new Set(g.filter((p) => typeof p == "string" && u.has(p)))] : []);
      if (i && typeof i == "object") {
        ((n.met = f(i.met, o)),
          (n.visitedAreas = f(i.visitedAreas, l)),
          (n.readLore = f(i.readLore, c)),
          (n.heard = f(i.heard, h)),
          (n.inventory = f(i.inventory, d)),
          (n.visits = a(Math.floor(Number(i.visits) || 0), 0, 1e4)),
          (n.clock = a(Number(i.clock) || 0, 0, 1e6)),
          (n.lastVisit = ["noodles", "fish-counter"].includes(i.lastVisit) ? i.lastVisit : ""));
        for (let u of Sl)
          ((n.topics[u.id] = f(i.topics?.[u.id], new Set(u.topics.map((p) => p.id)))),
            Number.isFinite(i.rapport?.[u.id]) && (n.rapport[u.id] = a(Math.floor(i.rapport[u.id]), -4, 4)));
        (i.gaff &&
          typeof i.gaff == "object" &&
          (n.gaff = { announced: i.gaff.announced === !0, departed: i.gaff.departed === !0 }),
          i.position &&
            Number.isFinite(i.position.x) &&
            Number.isFinite(i.position.z) &&
            i.position.x >= -42 &&
            i.position.x <= 42 &&
            i.position.z >= -74 &&
            i.position.z <= 27 &&
            (n.position = {
              x: i.position.x,
              z: i.position.z,
              yaw: Number.isFinite(i.position.yaw) ? i.position.yaw : 0,
            }));
        let g = i.tracked;
        (g &&
          typeof g == "object" &&
          { area: l, person: o, quest: new Set(wr.map((u) => u.id)), lore: c }[g.type]?.has(g.id) &&
          (n.tracked = { type: g.type, id: g.id }),
          Array.isArray(i.log) &&
            (n.log = i.log
              .filter((u) => u && typeof u.id == "string" && typeof u.title == "string" && typeof u.text == "string")
              .slice(-280)
              .map((u) => ({
                id: u.id.slice(0, 120),
                title: u.title.slice(0, 100),
                text: u.text.slice(0, 1400),
                kind: typeof u.kind == "string" ? u.kind.slice(0, 25) : "note",
              }))));
      }
      for (let g of wr) {
        let u = i?.quests?.[g.id],
          p = g.steps.at(-1),
          m = new Set(p.choices.map((x) => x.effect)),
          y = u && Number.isFinite(u.stage) ? a(Math.floor(u.stage), 0, g.steps.length) : 0,
          b = m.has(u?.outcome) ? u.outcome : null;
        (y === g.steps.length && !b && (y = g.steps.length - 1),
          !i &&
            ((g.id === "mercies" && r.inventory?.includes("Electric sheep")) ||
              (g.id === "dinner" && r.sidequests?.includes("Dinner for somebody"))) &&
            ((y = g.steps.length), (b = p.choices[0].effect)),
          (n.quests[g.id] = { stage: y, outcome: b }),
          y === g.steps.length &&
            ((n.changes[g.state] = b), n.inventory.includes(g.reward) || n.inventory.push(g.reward)));
      }
      return n;
    }
    function t(i, r) {
      return i.steps[r.quests[i.id]?.stage || 0] || null;
    }
    function s(i) {
      return wr.filter((r) => i.quests[r.id]?.stage === r.steps.length).length;
    }
    return { cleanDistrictState: e, districtQuestTarget: t, districtCompleteCount: s };
  })(),
  { SCENE_LIFE: bd, LIFE_VERSION: EX } = {
    SCENE_LIFE: {
      hades: {
        sound: "furnace",
        air: "Furnace light moves under the cloud. The transfer deck carries a low vibration.",
        people: [],
        props: [
          {
            model: "radio",
            name: "Transfer-channel speaker",
            action: "Lower the platform speaker",
            before: "Dispatch fills the concourse. A loose speaker grille vibrates.",
            after: "The voice drops. You can hear the parked shuttle cool between calls.",
            undo: "Raise the platform speaker",
            id: "detail-1",
          },
          {
            model: "vent",
            name: "Observation-rail demister",
            action: "Clear the viewing glass",
            before: "Moisture has gathered around the cold edge of the window.",
            after: "Warm air clears a narrow view of the furnace stacks.",
            id: "detail-2",
          },
          {
            model: "lamp",
            name: "Map-reading light",
            action: "Dim the chart light",
            before: "The chart light throws your reflection across the glass.",
            after: "The reflection recedes. The city becomes easier to see.",
            undo: "Restore the chart light",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / FURNACE",
            text: "Furnace light moves under the cloud. The transfer deck carries a low vibration.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "FLIGHT CHANNEL",
            text: "A maintenance crew asks for a lower lane. The request receives a landing code, not a reply.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "TRANSFER DESK",
            text: "A red indicator becomes green. The street lift is ready to take the next group.",
            trigger: "after",
          },
        ],
      },
      holden: {
        sound: "office",
        air: "A ceiling fan stirs the smoke above the interview table.",
        people: [],
        props: [
          {
            model: "cup",
            name: "Coffee beside the test",
            action: "Move the cup clear",
            before: "A warm cup rests too close to the optical cable.",
            after: "You move it to the far side. A pale ring remains on the table.",
            id: "detail-1",
          },
          {
            model: "fan",
            name: "Desk cooling fan",
            action: "Stop the loose fan",
            before: "The small fan adds an uneven tick to the room.",
            after: "The blades stop. The interview equipment becomes the loudest thing here.",
            undo: "Start the desk fan",
            id: "detail-2",
          },
          {
            model: "blinds",
            name: "Interview-room slats",
            action: "Angle the window slats",
            before: "Light falls across the test operator\u2019s seat.",
            after: "The slats turn. Their shadow moves away from the instrument.",
            undo: "Open the slats",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / OFFICE",
            text: "A ceiling fan stirs the smoke above the interview table.",
            trigger: "arrival",
          },
          { id: "near", speaker: "LEON", text: "Should I keep my hands on the table?", trigger: "near" },
          {
            id: "after",
            speaker: "ROOM",
            text: "The fan coasts to a halt. The space between the two chairs feels larger.",
            trigger: "after",
          },
        ],
      },
      noodles: {
        sound: "market",
        air: "Steam rises through the canopy. Rain taps on bowls that have not been collected.",
        people: [
          { name: "Night cook", job: "stir", color: "#78604b", line: "Careful. The bowl is hotter than the counter." },
          { name: "Waiting customer", job: "sip", color: "#526071", line: "I only came out for something warm." },
        ],
        props: [
          {
            model: "bowl",
            name: "Cooling supper",
            action: "Turn the bowl from the rain",
            before: "Water reaches the outside edge of your bowl.",
            after: "You slide the bowl under the canopy. Steam gathers over the dry rim.",
            id: "detail-1",
          },
          {
            model: "awning",
            name: "Loose counter awning",
            action: "Secure the canopy catch",
            before: "The canvas knocks against its support whenever the wind changes.",
            after: "The catch holds. The next gust sheds water into the gutter.",
            memory: "row-awning",
            id: "detail-2",
          },
          {
            model: "radio",
            name: "Cook\u2019s old radio",
            action: "Restore the kitchen channel",
            before: "A small radio hisses behind the stacked cups.",
            after: "A local night broadcast replaces the hiss. The cook keeps stirring.",
            memory: "row-radio",
            undo: "Mute the kitchen radio",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / MARKET",
            text: "Steam rises through the canopy. Rain taps on bowls that have not been collected.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "WAITING CUSTOMER",
            text: "There is always room for one more bowl. There is never room for one more umbrella.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "NIGHT COOK",
            text: "I will keep it covered. Work always arrives before dinner is finished.",
            trigger: "after",
          },
        ],
      },
      "spinner-recall": {
        sound: "flight",
        air: "Landing lights pass over the cabin. Gaff does not turn his head.",
        people: [],
        props: [
          {
            model: "belt",
            name: "Loose passenger harness",
            action: "Fasten the loose harness",
            before: "A metal buckle knocks against the empty seat.",
            after: "The strap lies flat. One small sound disappears from the cabin.",
            id: "detail-1",
          },
          {
            model: "vent",
            name: "Passenger air outlet",
            action: "Turn the outlet away",
            before: "Cold air falls directly onto your wet sleeve.",
            after: "The outlet turns towards the window. The sleeve stops moving.",
            id: "detail-2",
          },
          {
            model: "cup",
            name: "Gaff\u2019s travel cup",
            action: "Set the cup in its holder",
            before: "An old cup moves with each change in the flight path.",
            after: "The holder catches it. Gaff acknowledges the movement without looking.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / FLIGHT",
            text: "Landing lights pass over the cabin. Gaff does not turn his head.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "GAFF",
            text: "Keep the loose things secured. The approach gets rough below the towers.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "CABIN",
            text: "A landing tone sounds twice. Gaff places the folded paper out of the draught.",
            trigger: "after",
          },
        ],
      },
      "police-lobby": {
        sound: "office",
        air: "Wet coats steam beside the duty desk. A printer has more work than the staff.",
        people: [
          {
            name: "Duty clerk",
            job: "type",
            color: "#606454",
            line: "Put the wet papers on the tray, not on the keys.",
          },
          {
            name: "Off-duty officer",
            job: "walk",
            color: "#3c5665",
            line: "Another night. Another change to the roster.",
          },
        ],
        props: [
          {
            model: "printer",
            name: "Overfilled duty printer",
            action: "Clear the output tray",
            before: "Printed strips have curled back towards the feed rollers.",
            after: "The stack moves clear. A new strip feeds into the empty tray.",
            id: "detail-1",
          },
          {
            model: "coat",
            name: "Dripping coat stand",
            action: "Move the drip tray",
            before: "Water from the coats misses the metal tray below.",
            after: "The tray catches the drips. The dry strip across the floor stays clear.",
            id: "detail-2",
          },
          {
            model: "lamp",
            name: "Desk queue lamp",
            action: "Reset the waiting lamp",
            before: "The lamp still marks a place that is now empty.",
            after: "The number clears. A tired clerk looks up from the next file.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / OFFICE",
            text: "Wet coats steam beside the duty desk. A printer has more work than the staff.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "DUTY CLERK",
            text: "Everyone signs in. Even the people who say they no longer work here.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "OFF-DUTY OFFICER",
            text: "The desk will still be here when the rest of us go home.",
            trigger: "after",
          },
        ],
      },
      bryant: {
        sound: "office",
        air: "The desk has a clean rectangle where a case folder sat for too long.",
        people: [],
        props: [
          {
            model: "ashtray",
            name: "Overfull ashtray",
            action: "Empty the cold ash tray",
            before: "Cold ash has reached the edge of the tray.",
            after: "The tray is empty. Bryant has already found something else to ignore.",
            id: "detail-1",
          },
          {
            model: "projector",
            name: "Dossier projector",
            action: "Clean the projection glass",
            before: "Dust scatters the reel light across the wall.",
            after: "The edges of the projected forms become sharper.",
            id: "detail-2",
          },
          {
            model: "fan",
            name: "Office ceiling fan control",
            action: "Lower the fan speed",
            before: "The fan pushes every loose corner of paper in the same direction.",
            after: "The papers settle. The room remains too warm.",
            undo: "Restore the fan speed",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / OFFICE",
            text: "The desk has a clean rectangle where a case folder sat for too long.",
            trigger: "arrival",
          },
          { id: "near", speaker: "BRYANT", text: "You can tidy the desk. It will not tidy the job.", trigger: "near" },
          { id: "after", speaker: "GAFF", text: "A folded corner can hold a whole shape together.", trigger: "after" },
        ],
      },
      "dossier-room": {
        sound: "archive",
        air: "Rows of file drawers absorb the sound from the corridor.",
        people: [
          {
            name: "Archive technician",
            job: "file",
            color: "#667265",
            line: "Keep the original order. Someone else has to read this tomorrow.",
          },
        ],
        props: [
          {
            model: "cabinet",
            name: "Open archive drawer",
            action: "Close the loose drawer",
            before: "A drawer projects into the narrow service aisle.",
            after: "The runners click shut. The aisle is clear.",
            id: "detail-1",
          },
          {
            model: "projector",
            name: "Reel transport",
            action: "Guide the loose reel leader",
            before: "The leader brushes the metal housing on each turn.",
            after: "The strip tracks between the guides. The repeated scrape stops.",
            id: "detail-2",
          },
          {
            model: "stamp",
            name: "Dry date stamp",
            action: "Refresh the stamp pad",
            before: "An almost dry pad leaves a broken date on scrap paper.",
            after: "The next test date is legible. It does not change any existing record.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / ARCHIVE",
            text: "Rows of file drawers absorb the sound from the corridor.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "ARCHIVE TECHNICIAN",
            text: "A copy is useful. A copy with no source is just another question.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "ARCHIVE",
            text: "The reel winds back. Faces vanish from the wall one at a time.",
            trigger: "after",
          },
        ],
      },
      "hospital-one": {
        sound: "medical",
        air: "The respirator sets the pace. Everything else in the ward waits between its cycles.",
        people: [
          {
            name: "Night nurse",
            job: "check",
            color: "#88978a",
            line: "Please leave the breathing controls to the ward staff.",
          },
        ],
        props: [
          {
            model: "blinds",
            name: "Bedside shade",
            action: "Lower the bedside shade",
            before: "A corridor lamp falls across the pillow.",
            after: "The shade blocks the glare without covering the monitor.",
            memory: "hospital-shade",
            id: "detail-1",
          },
          {
            model: "flowers",
            name: "Plastic bedside flowers",
            action: "Straighten the fallen flowers",
            before: "A stem has fallen behind the waterless vase.",
            after: "The flowers stand together again. Nothing living was disturbed.",
            id: "detail-2",
          },
          {
            model: "chair",
            name: "Visitor\u2019s chair",
            action: "Move the chair from the cable",
            before: "A chair leg presses close to a floor cable.",
            after: "The chair slides clear. The cable is not touched.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / MEDICAL",
            text: "The respirator sets the pace. Everything else in the ward waits between its cycles.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "NIGHT NURSE",
            text: "He hears more than people expect. Speak to him, not to the screen.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "WARD",
            text: "The monitor returns to its regular pulse. The chair beside it is still warm.",
            trigger: "after",
          },
        ],
      },
      "tyrell-flight": {
        sound: "flight",
        air: "The upper air is quieter. Furnace light no longer reaches every surface.",
        people: [],
        props: [
          {
            model: "radio",
            name: "Approach repeat speaker",
            action: "Cut the repeated channel",
            before: "Two speakers repeat the same clearance with a slight delay.",
            after: "The second speaker goes quiet. One clear voice remains.",
            id: "detail-1",
          },
          {
            model: "lamp",
            name: "Cabin reading panel",
            action: "Shade the reading panel",
            before: "The panel throws a white patch on the forward glass.",
            after: "The hood slides over it. Tower lights take its place.",
            id: "detail-2",
          },
          {
            model: "belt",
            name: "Empty equipment strap",
            action: "Secure the equipment strap",
            before: "A loose strap flicks against the seat frame.",
            after: "The strap is secured. The seat stops ticking.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / FLIGHT",
            text: "The upper air is quieter. Furnace light no longer reaches every surface.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "APPROACH CONTROL",
            text: "Hold this lane. The upper pad is not yet clear.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "CABIN",
            text: "The pad lights change. The flight settles into its final descent.",
            trigger: "after",
          },
        ],
      },
      "tyrell-ante": {
        sound: "tower",
        air: "The room is too large for its few sounds. The bird is listening.",
        people: [
          {
            name: "Reception attendant",
            job: "wait",
            color: "#9a8264",
            line: "The appointment is ready. There is no need to raise your voice.",
          },
        ],
        props: [
          {
            model: "owl",
            name: "Owl\u2019s perch rail",
            action: "Secure the loose perch sleeve",
            before: "A thin metal sleeve rattles beneath the perch.",
            after: "The sleeve locks. The owl turns its head towards your hand.",
            id: "detail-1",
          },
          {
            model: "water",
            name: "Still-water display",
            action: "Clear the return channel",
            before: "A small return channel has caught a fallen decorative leaf.",
            after: "The water resumes its thin, even flow.",
            id: "detail-2",
          },
          {
            model: "blinds",
            name: "Reception sun screen",
            action: "Reduce the window glare",
            before: "The low light fills the reception seat.",
            after: "The screen lowers one section. The seat falls into soft shadow.",
            undo: "Raise the reception screen",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / TOWER",
            text: "The room is too large for its few sounds. The bird is listening.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "RECEPTION ATTENDANT",
            text: "The bird notices movement before the door system does.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "ROOM",
            text: "The owl follows the last movement, then returns its attention to the empty space.",
            trigger: "after",
          },
        ],
      },
      "rachael-test": {
        sound: "tower",
        air: "The optical unit adds a small mechanical sound to the large, warm room.",
        people: [],
        props: [
          {
            model: "lamp",
            name: "Optical work light",
            action: "Shield the work light",
            before: "A reflection sits on the rim of the optical housing.",
            after: "The hood blocks the reflection. The room beyond the unit stays visible.",
            id: "detail-1",
          },
          {
            model: "glass",
            name: "Untouched water glass",
            action: "Move the glass from the cable",
            before: "The water stands still. Its glass is beside the moving lead.",
            after: "The glass is clear of the lead. No one reaches for it.",
            id: "detail-2",
          },
          {
            model: "fan",
            name: "Instrument cooling unit",
            action: "Seat the loose grille",
            before: "The cooling unit gives a fine metallic buzz.",
            after: "The grille sits flush. Only the airflow remains.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / TOWER",
            text: "The optical unit adds a small mechanical sound to the large, warm room.",
            trigger: "arrival",
          },
          { id: "near", speaker: "RACHAEL", text: "Does the room have to be this quiet?", trigger: "near" },
          {
            id: "after",
            speaker: "ROOM",
            text: "The instrument returns to its idle signal. No machine tells you how to end a conversation.",
            trigger: "after",
          },
        ],
      },
      "hotel-corridor": {
        sound: "hotel",
        air: "A leaking pipe marks time above the runner carpet.",
        people: [
          {
            name: "Late resident",
            job: "wait",
            color: "#6a5a52",
            line: "That door has been quiet. The pipes have not.",
          },
        ],
        props: [
          {
            model: "bucket",
            name: "Overflowing drip bucket",
            action: "Place the bucket under the leak",
            before: "The drip lands on the edge of the metal bucket.",
            after: "The water falls inside it. The sharp tap becomes a low plink.",
            id: "detail-1",
          },
          {
            model: "lamp",
            name: "Stair indicator",
            action: "Seat the loose indicator cover",
            before: "A loose cover vibrates with the building power supply.",
            after: "The cover sits still. The amber light stops breaking into strips.",
            id: "detail-2",
          },
          {
            model: "cart",
            name: "Linen trolley",
            action: "Move the linen trolley aside",
            before: "A stack of folded sheets narrows the passage.",
            after: "The trolley rolls against the wall. One sheet corner keeps hanging loose.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / HOTEL",
            text: "A leaking pipe marks time above the runner carpet.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "LATE RESIDENT",
            text: "People hear a closed door and decide they know what is behind it.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "CORRIDOR",
            text: "A lock turns on another floor. No one enters this corridor.",
            trigger: "after",
          },
        ],
      },
      "leon-bedroom": {
        sound: "hotel",
        air: "The room is small. The careful arrangement of its few possessions makes it smaller.",
        people: [],
        props: [
          {
            model: "coat",
            name: "Coat on the spare hook",
            action: "Move the hook from the damp patch",
            before: "Moisture is spreading behind the spare wall hook.",
            after: "You move the empty hook, leaving the evidence and coat undisturbed.",
            id: "detail-1",
          },
          {
            model: "lamp",
            name: "Bedside reading lamp",
            action: "Aim the lamp at the floor",
            before: "The lamp points towards the photographs.",
            after: "Its warm patch falls beside the bed. Nothing on the bed has moved.",
            undo: "Restore the lamp angle",
            id: "detail-2",
          },
          {
            model: "drawer",
            name: "Loose bed-frame drawer",
            action: "Close the empty lower drawer",
            before: "An empty lower drawer will not stay against the frame.",
            after: "The drawer closes with a soft wooden knock. The room falls quiet.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / HOTEL",
            text: "The room is small. The careful arrangement of its few possessions makes it smaller.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "ROOM",
            text: "A neighbour runs water. The sound comes through the wall as if the tap were in here.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "ROOM",
            text: "When the scanner goes quiet, the old clock is still working.",
            trigger: "after",
          },
        ],
      },
      "leon-bathroom": {
        sound: "water",
        air: "The tiles keep the cold. Water has left a line below every fitting.",
        people: [],
        props: [
          {
            model: "valve",
            name: "Running basin tap",
            action: "Close the basin tap",
            before: "A thin stream strikes the stained basin.",
            after: "The stream stops. A final drop gathers under the outlet.",
            id: "detail-1",
          },
          {
            model: "mirror",
            name: "Steamed mirror edge",
            action: "Clear an unused corner",
            before: "The mirror is clouded away from the evidence area.",
            after: "A small clear patch reflects the lamp, not the whole room.",
            id: "detail-2",
          },
          {
            model: "towel",
            name: "Fallen clean towel",
            action: "Hang the spare towel",
            before: "A spare towel has slipped from its dry rail.",
            after: "The towel returns to the rail. You leave the floor evidence untouched.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / WATER",
            text: "The tiles keep the cold. Water has left a line below every fitting.",
            trigger: "arrival",
          },
          { id: "near", speaker: "BATHROOM", text: "The pipes answer when another room opens a tap.", trigger: "near" },
          {
            id: "after",
            speaker: "BATHROOM",
            text: "The sample is sealed. The rest of the room remains somebody else\u2019s interrupted routine.",
            trigger: "after",
          },
        ],
      },
      "leon-window": {
        sound: "rain",
        air: "Rain breaks the hotel sign into colour on the pavement.",
        people: [
          {
            name: "Building caretaker",
            job: "sweep",
            color: "#6c6750",
            line: "Keep the doorway clear. People still live upstairs.",
          },
        ],
        props: [
          {
            model: "awning",
            name: "Caretaker\u2019s entrance cover",
            action: "Fasten the entrance cover",
            before: "Rain has folded one corner of the small cover inward.",
            after: "The corner holds. A dry patch returns beside the door.",
            id: "detail-1",
          },
          {
            model: "newspaper",
            name: "Scattered delivery sheets",
            action: "Collect the loose blank wrappers",
            before: "Blank wrappers drift into the entrance drain.",
            after: "The wrappers sit in the delivery crate. The drain stays clear.",
            id: "detail-2",
          },
          {
            model: "radio",
            name: "Street maintenance box",
            action: "Silence the fault buzzer",
            before: "An unattended panel repeats a low fault buzz.",
            after: "The buzzer is acknowledged. Its amber fault lamp stays on.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / RAIN",
            text: "Rain breaks the hotel sign into colour on the pavement.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "BUILDING CARETAKER",
            text: "Watching a window will not make the person inside open it.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "STREET",
            text: "The caretaker returns to the doorway. The upper window stays still.",
            trigger: "after",
          },
        ],
      },
      chew: {
        sound: "freezer",
        air: "Cold vapour sits low around the benches. The machinery never stops working.",
        people: [],
        props: [
          {
            model: "vent",
            name: "Blocked cold-store vent",
            action: "Clear the loose packing from the vent",
            before: "A strip of packing flutters across the intake.",
            after: "The strip is secured. Vapour flows away from the service aisle.",
            memory: "eye-vent",
            id: "detail-1",
          },
          {
            model: "glove",
            name: "Spare thermal glove",
            action: "Place the glove on the warmer",
            before: "A spare glove lies on the cold edge of the bench.",
            after: "The glove rests on the warming pad, away from the specimens.",
            id: "detail-2",
          },
          {
            model: "tank",
            name: "Loose specimen-tank lid",
            action: "Secure the outer tank cover",
            before: "The outer cover vibrates. The sealed specimen chamber is intact.",
            after: "The external catch closes. The tank keeps its steady hum.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / FREEZER",
            text: "Cold vapour sits low around the benches. The machinery never stops working.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "CHEW",
            text: "That bench is cold enough to punish a careless hand.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "COLD STORE",
            text: "The cleared vent draws the vapour sideways. Rows of labelled tanks emerge from it.",
            trigger: "after",
          },
        ],
      },
      "chew-service": {
        sound: "freezer",
        air: "The work continues behind the service wall. Each tank adds one small vibration.",
        people: [],
        props: [
          {
            model: "vent",
            name: "Service return vent",
            action: "Clear the service return",
            before: "Loose packing has reached the shared air return.",
            after: "The common return is clear. The cold mist thins around both benches.",
            memory: "eye-vent",
            id: "detail-1",
          },
          {
            model: "cabinet",
            name: "Component rack cover",
            action: "Latch the outer rack cover",
            before: "A cover stands open below a row of sealed components.",
            after: "The outer cover is latched. None of the seals have been opened.",
            id: "detail-2",
          },
          {
            model: "printer",
            name: "Humidity log printer",
            action: "Guide the curled humidity strip",
            before: "The log strip has curled around its output roller.",
            after: "It feeds onto the tray. Small variations keep appearing on the line.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / FREEZER",
            text: "The work continues behind the service wall. Each tank adds one small vibration.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "SERVICE AISLE",
            text: "A fan changes speed beyond the wall. The floor carries the change before you hear it.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "COLD STORE",
            text: "The last service entry remains on the tray, waiting for the next shift.",
            trigger: "after",
          },
        ],
      },
      "home-arrival": {
        sound: "apartment",
        air: "The corridor noise follows you through the open door, then becomes distant.",
        people: [],
        props: [
          {
            model: "blinds",
            name: "Apartment window shade",
            action: "Lower the glare screen",
            before: "An advertising light sweeps across the room.",
            after: "The shade lowers. The light becomes a narrow band at the sill.",
            memory: "home-shade",
            undo: "Raise the glare screen",
            id: "detail-1",
          },
          {
            model: "coat",
            name: "Wet coat hook",
            action: "Place a tray under the coat",
            before: "Water from the coat hook reaches the floor.",
            after: "The tray catches it. The patch by the door begins to dry.",
            memory: "home-coat",
            id: "detail-2",
          },
          {
            model: "lamp",
            name: "Entrance table lamp",
            action: "Switch on the entrance lamp",
            before: "The switch can be found by touch beside the door.",
            after: "A small warm light reaches the visitor\u2019s side of the room.",
            memory: "home-lamp",
            undo: "Switch off the entrance lamp",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / APARTMENT",
            text: "The corridor noise follows you through the open door, then becomes distant.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "CORRIDOR",
            text: "A lift cable moves beyond the wall. Someone else is coming home.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "APARTMENT",
            text: "The visitor\u2019s photograph catches the table light.",
            trigger: "after",
          },
        ],
      },
      "rachael-memory": {
        sound: "apartment",
        air: "A chair waits near the photographs. The city keeps moving beyond the blinds.",
        people: [],
        props: [
          {
            model: "chair",
            name: "Chair beside the photographs",
            action: "Set the chair towards the room",
            before: "The spare chair faces the wall rather than the table.",
            after: "You turn it towards the room. The way to the door stays clear.",
            id: "detail-1",
          },
          {
            model: "blinds",
            name: "Bright window band",
            action: "Lower the glare screen",
            before: "The passing advertisement lights the photograph frames in turn.",
            after: "The screen cuts the glare. The frames return to their own colours.",
            memory: "home-shade",
            undo: "Raise the glare screen",
            id: "detail-2",
          },
          {
            model: "glass",
            name: "Unfilled water glass",
            action: "Set out a clean glass",
            before: "One clean glass is still on the drying shelf.",
            after: "You place it where the visitor can reach it. It is an offer, not an instruction.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / APARTMENT",
            text: "A chair waits near the photographs. The city keeps moving beyond the blinds.",
            trigger: "arrival",
          },
          { id: "near", speaker: "RACHAEL", text: "Some objects are easier to hold than to explain.", trigger: "near" },
          {
            id: "after",
            speaker: "APARTMENT",
            text: "The chair remains turned towards the room after the conversation ends.",
            trigger: "after",
          },
        ],
      },
      "pris-street": {
        sound: "rain",
        air: "Wind pushes loose paper into the sheltered recesses of the building.",
        people: [
          {
            name: "Passing resident",
            job: "walk",
            color: "#675a6d",
            line: "The covered side is drier. Not dry, just drier.",
          },
        ],
        props: [
          {
            model: "awning",
            name: "Torn doorway cover",
            action: "Secure the lower cover strap",
            before: "A loose cover snaps beside the recessed doorway.",
            after: "The strap holds. The recess is no longer directly under the runoff.",
            id: "detail-1",
          },
          {
            model: "newspaper",
            name: "Paper caught at the grate",
            action: "Free the street drain",
            before: "Wet paper forms a small dam across the grate.",
            after: "Water carries the loose dirt into the drain. The pavement clears.",
            id: "detail-2",
          },
          {
            model: "lamp",
            name: "Recess service light",
            action: "Seat the service-light plug",
            before: "A maintenance light has slipped from its low-voltage socket.",
            after: "The recess gains a steady amber light. It does not reach the whole street.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / RAIN",
            text: "Wind pushes loose paper into the sheltered recesses of the building.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "PASSING RESIDENT",
            text: "Nobody stays in this rain because they enjoy it.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "STREET",
            text: "A door opens. For a moment the sound of the building reaches the pavement.",
            trigger: "after",
          },
        ],
      },
      "bradbury-welcome": {
        sound: "toys",
        air: "The cage lift creaks. Small metal feet answer from inside the apartment.",
        people: [],
        props: [
          {
            model: "toy",
            name: "Bear\u2019s dragging wheel",
            action: "Free the bear\u2019s sleeve from its wheel",
            before: "The cloth sleeve brushes one small wheel.",
            after: "The wheel turns freely. The bear gives a short, uneven salute.",
            memory: "friend-bear",
            id: "detail-1",
          },
          {
            model: "valve",
            name: "Lift guide oiler",
            action: "Fill the accessible guide pad",
            before: "The lift guide makes a dry scrape at the landing.",
            after: "The felt pad carries oil to the guide. The scrape becomes softer.",
            memory: "lift-guide",
            id: "detail-2",
          },
          {
            model: "bell",
            name: "Small brass welcome bell",
            action: "Ring the little welcome bell",
            before: "The bell has a polished patch where many hands have touched it.",
            after: "Two bright notes carry through the room. A mechanical friend turns towards them.",
            undo: "Ring the welcome bell again",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / TOYS",
            text: "The cage lift creaks. Small metal feet answer from inside the apartment.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "SEBASTIAN",
            text: "They notice visitors. They remember them in their own way.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "MECHANICAL FRIEND",
            text: "The bear\u2019s salute is late. The Kaiser\u2019s answer is later still.",
            trigger: "after",
          },
        ],
      },
      "unicorn-dream": {
        sound: "forest",
        air: "The air is open and still. The city has no surface on which to place its light.",
        people: [],
        props: [
          {
            model: "water",
            name: "Pool between the roots",
            action: "Touch the still pool",
            before: "The branches hold their reflection on the surface.",
            after: "Small rings cross the reflected branches and fade.",
            id: "detail-1",
          },
          {
            model: "leaf",
            name: "Leaf on a low branch",
            action: "Brush the low branch",
            before: "One leaf hangs lower than the others.",
            after: "The branch lifts and settles. The animal keeps its distance.",
            id: "detail-2",
          },
          {
            model: "owl",
            name: "Empty fallen perch",
            action: "Set the broken branch aside",
            before: "A pale branch lies across the soft ground.",
            after: "The ground is clear. Nothing here supplies a date for the memory.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / FOREST",
            text: "The air is open and still. The city has no surface on which to place its light.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "MEMORY",
            text: "A leaf moves without any sound of traffic behind it.",
            trigger: "near",
          },
          { id: "after", speaker: "MEMORY", text: "The quiet lasts longer than the image.", trigger: "after" },
        ],
      },
      "esper-setup": {
        sound: "apartment",
        air: "The scanner warms its glass. A loose print waits beside the feed slot.",
        people: [],
        props: [
          {
            model: "projector",
            name: "Esper feed rollers",
            action: "Clean the unused roller edge",
            before: "Dry dust has reached the outside of the feed roller.",
            after: "The roller turns cleanly. The photograph itself is not wiped.",
            id: "detail-1",
          },
          {
            model: "lamp",
            name: "Work-table task light",
            action: "Shade the optical table",
            before: "The table light reflects in the scanner glass.",
            after: "The shade moves. The reflection leaves the glass.",
            memory: "esper-lamp",
            id: "detail-2",
          },
          {
            model: "printer",
            name: "Empty print receiver",
            action: "Seat the print receiver",
            before: "The output tray is not fully attached to the machine.",
            after: "The tray clicks into place. The next print has somewhere to land.",
            memory: "esper-tray",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / APARTMENT",
            text: "The scanner warms its glass. A loose print waits beside the feed slot.",
            trigger: "arrival",
          },
          { id: "near", speaker: "ESPER", text: "The feed motor tests its travel, then waits.", trigger: "near" },
          {
            id: "after",
            speaker: "APARTMENT",
            text: "The image is loaded. The rest of the room seems to step back from the screen.",
            trigger: "after",
          },
        ],
      },
      "esper-search": {
        sound: "apartment",
        air: "The photograph fills the monitor. Small motor movements reach your hands through the desk.",
        people: [],
        props: [
          {
            model: "printer",
            name: "Esper output tray",
            action: "Seat the output tray",
            before: "The tray has a loose outer catch.",
            after: "The catch closes. Paper settles flat in the receiver.",
            memory: "esper-tray",
            id: "detail-1",
          },
          {
            model: "lamp",
            name: "Optical-table light",
            action: "Shade the optical table",
            before: "A reflection remains at the edge of the monitor.",
            after: "The hood blocks it. The displayed room becomes easier to examine.",
            memory: "esper-lamp",
            id: "detail-2",
          },
          {
            model: "cup",
            name: "Cold cup beside the console",
            action: "Move the cup from the console",
            before: "The old cup stands close to the vent.",
            after: "You move it onto a coaster. The vent stays clear.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / APARTMENT",
            text: "The photograph fills the monitor. Small motor movements reach your hands through the desk.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "ESPER",
            text: "The machine waits after each adjustment. It never hurries you.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "APARTMENT",
            text: "The finished print is small enough to hold. The questions around it are not.",
            trigger: "after",
          },
        ],
      },
      "home-reset": {
        sound: "water",
        air: "The tap keeps running after everything else has stopped.",
        people: [],
        props: [
          {
            model: "valve",
            name: "Apartment basin valve",
            action: "Seat the worn tap washer",
            before: "A worn washer will not quite close the outlet.",
            after: "The washer seats. For once, the basin is quiet.",
            memory: "home-water",
            id: "detail-1",
          },
          {
            model: "towel",
            name: "Dry towel on the wrong hook",
            action: "Move the towel from the leak",
            before: "The dry towel hangs directly below the damp pipe.",
            after: "The towel moves to the clear hook. Its lower edge stays dry.",
            memory: "home-towel",
            id: "detail-2",
          },
          {
            model: "mirror",
            name: "Clouded mirror corner",
            action: "Clear the mirror corner",
            before: "Moisture has gathered across the lower glass.",
            after: "A clean corner returns your outline. It supplies no answer about it.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / WATER",
            text: "The tap keeps running after everything else has stopped.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "APARTMENT",
            text: "The pipes carry a distant neighbour\u2019s evening through the wall.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "APARTMENT",
            text: "You are ready to leave. The room will keep whatever small repairs you made.",
            trigger: "after",
          },
        ],
      },
      "fish-counter": {
        sound: "market",
        air: "The same canopy holds a different smell. Ice water runs between the trays.",
        people: [
          {
            name: "Fish-counter worker",
            job: "stir",
            color: "#6e7965",
            line: "Mind the meltwater. It reaches the edge before I can wipe it.",
          },
        ],
        props: [
          {
            model: "awning",
            name: "Familiar canopy catch",
            action: "Secure the canopy catch",
            before: "The old strap has the same loose catch.",
            after: "The canopy keeps the rain clear of the counter.",
            memory: "row-awning",
            id: "detail-1",
          },
          {
            model: "radio",
            name: "Kitchen-band radio",
            action: "Restore the kitchen channel",
            before: "The radio competes with the refrigeration unit.",
            after: "The local broadcast returns behind the counter.",
            memory: "row-radio",
            undo: "Mute the kitchen radio",
            id: "detail-2",
          },
          {
            model: "ice",
            name: "Blocked meltwater tray",
            action: "Clear the tray outlet",
            before: "A piece of empty wrapping has blocked the meltwater slot.",
            after: "The water drains below the tray. The display stays cold.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / MARKET",
            text: "The same canopy holds a different smell. Ice water runs between the trays.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "FISH-COUNTER WORKER",
            text: "Everything here has a label. Not every label tells you enough.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "COUNTER",
            text: "Fresh ice lands with a sharp crack. The worker resumes the next order.",
            trigger: "after",
          },
        ],
      },
      "animal-row": {
        sound: "market",
        air: "Pumps hum beneath the calls of buyers. Some cages contain no breathing at all.",
        people: [
          { name: "Cage attendant", job: "check", color: "#797b57", line: "Please do not tap the glass." },
          { name: "Window shopper", job: "walk", color: "#6b5670", line: "I came to look. Looking is still free." },
        ],
        props: [
          {
            model: "tank",
            name: "Display-tank air hose",
            action: "Straighten the outside air hose",
            before: "A bend in the external hose makes the bubbles arrive in bursts.",
            after: "The hose lies straight. Bubbles rise in an even stream.",
            id: "detail-1",
          },
          {
            model: "bird",
            name: "Covered songbird cage",
            action: "Shade the cage from the sign",
            before: "A flashing sign reaches under the cage cover.",
            after: "You lower the cover\u2019s outer flap. The bird settles on its perch.",
            id: "detail-2",
          },
          {
            model: "water",
            name: "Empty display water dish",
            action: "Refill the service water dish",
            before: "The dish beside the display has dried at its edge.",
            after: "The dish holds a shallow pool. The attendant gives a small nod.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / MARKET",
            text: "Pumps hum beneath the calls of buyers. Some cages contain no breathing at all.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "CAGE ATTENDANT",
            text: "They still need care, whichever invoice came with them.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "MARKET",
            text: "A buyer walks away. The attendant checks the dish before checking the price card.",
            trigger: "after",
          },
        ],
      },
      "scale-bench": {
        sound: "laboratory",
        air: "The inspection lamp gives a dry click as it warms. A fan carries air across the bench.",
        people: [
          {
            name: "Bench assistant",
            job: "check",
            color: "#779284",
            line: "Use the tool rack. It keeps hands away from the sample.",
          },
        ],
        props: [
          {
            model: "lamp",
            name: "Microscope task lamp",
            action: "Move the glare shield",
            before: "A reflection crosses the unused rim of the stage.",
            after: "The shield blocks the reflection without touching the specimen.",
            id: "detail-1",
          },
          {
            model: "glove",
            name: "Clean tool envelope",
            action: "Open the outer tool wrapper",
            before: "The sealed tools are inside a larger paper sleeve.",
            after: "The outer sleeve opens. The clean inner seals remain intact.",
            id: "detail-2",
          },
          {
            model: "fan",
            name: "Bench extraction grille",
            action: "Secure the filter latch",
            before: "The grille rattles at the fan\u2019s lowest speed.",
            after: "The latch sits flat. The instrument desk becomes quieter.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / LABORATORY",
            text: "The inspection lamp gives a dry click as it warms. A fan carries air across the bench.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "BENCH ASSISTANT",
            text: "A clear image first. The conclusion can wait.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "LABORATORY",
            text: "The lamp cools. The sealed sample is no longer warm under your hand.",
            trigger: "after",
          },
        ],
      },
      hassan: {
        sound: "market",
        air: "Drawers slide behind the dealer. The invoice machine has outlived its case.",
        people: [
          {
            name: "Parts runner",
            job: "carry",
            color: "#765e47",
            line: "Put that delivery under the shelf. The sign leaks above it.",
          },
        ],
        props: [
          {
            model: "cabinet",
            name: "Loose invoice drawer",
            action: "Close the empty invoice drawer",
            before: "An empty lower drawer hangs on one runner.",
            after: "The runner catches. The drawer closes without disturbing the sale records.",
            id: "detail-1",
          },
          {
            model: "stamp",
            name: "Dealer\u2019s receipt stamp",
            action: "Set the receipt stamp upright",
            before: "The stamp has fallen into its lid.",
            after: "The handle stands upright. No record has been changed.",
            id: "detail-2",
          },
          {
            model: "snake",
            name: "Demonstration snake",
            action: "Secure the demonstration-box catch",
            before: "The outer demonstration box has a loose catch.",
            after: "The cover is secure. The model inside continues its slow movement.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / MARKET",
            text: "Drawers slide behind the dealer. The invoice machine has outlived its case.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "PARTS RUNNER",
            text: "The service book matters after the sale, too.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "SHOP",
            text: "Hassan returns the unrelated invoices to their place. One small order can take a long time.",
            trigger: "after",
          },
        ],
      },
      taffey: {
        sound: "club",
        air: "Bass reaches the floor before it reaches your ears. A server carries empty glasses back through the light.",
        people: [
          {
            name: "Glass collector",
            job: "carry",
            color: "#724c61",
            line: "Leave the service edge clear. I have to come back this way.",
          },
          { name: "Waiting patron", job: "sip", color: "#586379", line: "The queue moves when it feels like moving." },
        ],
        props: [
          {
            model: "glass",
            name: "Glass at the table edge",
            action: "Move the glass from the edge",
            before: "The low bass walks an empty glass towards the table edge.",
            after: "The glass rests in the centre. It still trembles with the music.",
            id: "detail-1",
          },
          {
            model: "curtain",
            name: "Loose service curtain",
            action: "Fasten the curtain tie",
            before: "A curtain brushes the trays each time a server passes.",
            after: "The tie holds the fabric clear of the service route.",
            id: "detail-2",
          },
          {
            model: "radio",
            name: "Crackling table speaker",
            action: "Lower the damaged speaker",
            before: "One small speaker adds a buzz above the room\u2019s low pulse.",
            after: "The buzz drops away. The main room remains loud.",
            undo: "Restore the table speaker",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / CLUB",
            text: "Bass reaches the floor before it reaches your ears. A server carries empty glasses back through the light.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "GLASS COLLECTOR",
            text: "People think the room resets itself between shows.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "CLUB",
            text: "The next tray goes past. The table looks ready for somebody else\u2019s night.",
            trigger: "after",
          },
        ],
      },
      vidphone: {
        sound: "club",
        air: "The booth reduces the room to a low pulse. The handset is warm from the last call.",
        people: [],
        props: [
          {
            model: "phone",
            name: "Loose handset cradle",
            action: "Seat the handset cradle",
            before: "The cradle moves when the cable pulls against it.",
            after: "The cradle locks. The return tone becomes steady.",
            id: "detail-1",
          },
          {
            model: "curtain",
            name: "Booth privacy screen",
            action: "Pull the side screen",
            before: "The service route is reflected in the booth glass.",
            after: "The screen moves across the reflection. The exit remains open.",
            undo: "Open the side screen",
            id: "detail-2",
          },
          {
            model: "coin",
            name: "Coins in the return tray",
            action: "Free the stuck return flap",
            before: "An empty return flap is caught half open.",
            after: "The flap closes and opens freely. It contains no forgotten money.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / CLUB",
            text: "The booth reduces the room to a low pulse. The handset is warm from the last call.",
            trigger: "arrival",
          },
          { id: "near", speaker: "BOOTH", text: "The line clicks twice before it answers.", trigger: "near" },
          {
            id: "after",
            speaker: "BOOTH",
            text: "The disconnected line sounds larger in the small booth.",
            trigger: "after",
          },
        ],
      },
      "club-floor": {
        sound: "club",
        air: "The room looks towards a curtain that has not yet moved.",
        people: [
          {
            name: "Stage technician",
            job: "work",
            color: "#5e526e",
            line: "Watch the cable. The aisle is not part of the stage.",
          },
          { name: "Usher", job: "wait", color: "#5d5e73", line: "The service passage is on the dry side." },
        ],
        props: [
          {
            model: "cable",
            name: "Loose aisle cable",
            action: "Secure the cable cover",
            before: "A cable cover has lifted beside the service aisle.",
            after: "The cover lies flat. Trays can pass without catching it.",
            id: "detail-1",
          },
          {
            model: "lamp",
            name: "Spare footlight",
            action: "Shade the unused footlight",
            before: "A spare light points into the side aisle.",
            after: "Its hood turns towards the empty stage edge.",
            id: "detail-2",
          },
          {
            model: "chair",
            name: "Misplaced audience stool",
            action: "Move the stool to the table",
            before: "A stool projects into the route used by the staff.",
            after: "The stool sits under its table. The aisle has room again.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / CLUB",
            text: "The room looks towards a curtain that has not yet moved.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "STAGE TECHNICIAN",
            text: "The room is never as ready as the people in it expect.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "CLUB",
            text: "The house light falls one step. The staff keep moving through it.",
            trigger: "after",
          },
        ],
      },
      "zhora-backstage": {
        sound: "backstage",
        air: "Warm bulbs frame mirrors that have seen too many late finishes.",
        people: [],
        props: [
          {
            model: "mirror",
            name: "Dressing mirror shade",
            action: "Shield the loose mirror bulb",
            before: "A bright lamp points into the service path.",
            after: "The small shade turns. The light returns to the mirror.",
            id: "detail-1",
          },
          {
            model: "coat",
            name: "Fallen costume cover",
            action: "Lift the cover from the floor",
            before: "An empty garment cover lies against a wet shoe mark.",
            after: "The empty cover hangs clear. No costume or evidence is moved.",
            id: "detail-2",
          },
          {
            model: "water",
            name: "Animal-care water tray",
            action: "Move the tray from the heater",
            before: "The care tray sits too near a heater outlet.",
            after: "The tray moves into the cooler part of the service shelf.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / BACKSTAGE",
            text: "Warm bulbs frame mirrors that have seen too many late finishes.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "BACKSTAGE",
            text: "A stage cue sounds through the wall. Here it is only a muffled number.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "BACKSTAGE",
            text: "One mirror lamp stays lit after the room\u2019s quiet ends.",
            trigger: "after",
          },
        ],
      },
      "zhora-arcade": {
        sound: "arcade",
        air: "Shop lights divide the wet floor into squares. Shutters begin to close ahead.",
        people: [
          { name: "Arcade cleaner", job: "sweep", color: "#64745e", line: "Take the centre. The display edge is wet." },
          { name: "Late shopper", job: "walk", color: "#665f7c", line: "What is happening back there?" },
        ],
        props: [
          {
            model: "sign",
            name: "Fallen wet-floor stand",
            action: "Raise the wet-floor stand",
            before: "The warning stand lies flat beside the shop front.",
            after: "The stand is visible from the approach. It does not block the route.",
            id: "detail-1",
          },
          {
            model: "cart",
            name: "Abandoned display cart",
            action: "Roll the empty cart to the wall",
            before: "An empty cart sits just outside the central route.",
            after: "The cart is against the shutter. Its wheels stop turning.",
            id: "detail-2",
          },
          {
            model: "lamp",
            name: "Service-exit lamp",
            action: "Reset the exit indicator",
            before: "The lamp shows the route only in brief flashes.",
            after: "A steady light marks the service exit.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / ARCADE",
            text: "Shop lights divide the wet floor into squares. Shutters begin to close ahead.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "ARCADE CLEANER",
            text: "The floor does not care why you are running.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "ARCADE",
            text: "A shutter reaches the floor with a long metal rattle.",
            trigger: "after",
          },
        ],
      },
      "zhora-pursuit": {
        sound: "arcade",
        air: "The shop glass reflects movement from both sides of the arcade.",
        people: [{ name: "Shop assistant", job: "wait", color: "#826273", line: "Stay away from the display edge." }],
        props: [
          {
            model: "bell",
            name: "Shop warning chime",
            action: "Test the empty-aisle chime",
            before: "A chime button waits beside the closed display.",
            after: "A clear note sounds inside the shop. No alarm is cancelled.",
            id: "detail-1",
          },
          {
            model: "sign",
            name: "Loose display notice",
            action: "Secure the loose notice",
            before: "A hanging notice strikes the glass in the draught.",
            after: "The notice is fixed to its support. Its tapping stops.",
            id: "detail-2",
          },
          {
            model: "glass",
            name: "Empty display cup",
            action: "Move the cup behind the rail",
            before: "An unused display cup sits near the open edge.",
            after: "The cup is clear of the aisle. Its pale reflection remains in the glass.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / ARCADE",
            text: "The shop glass reflects movement from both sides of the arcade.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "SHOP ASSISTANT",
            text: "I have asked them to close this section early.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "ARCADE",
            text: "The floor keeps its reflections after the movement has stopped.",
            trigger: "after",
          },
        ],
      },
      "street-bryant": {
        sound: "rain",
        air: "A cordon divides the street, but cannot divide its noise.",
        people: [
          {
            name: "Cordon officer",
            job: "wait",
            color: "#415d71",
            line: "Please use the other side. The businesses are still open.",
          },
        ],
        props: [
          {
            model: "barrier",
            name: "Loose cordon base",
            action: "Weight the loose barrier foot",
            before: "The wind rocks the empty end of the barrier.",
            after: "The foot stays planted. The open public route stays open.",
            id: "detail-1",
          },
          {
            model: "radio",
            name: "Cordon repeat radio",
            action: "Reduce the repeated channel",
            before: "The local speaker repeats every call from the officer\u2019s set.",
            after: "The repeat speaker is quieter. The working radio remains clear.",
            id: "detail-2",
          },
          {
            model: "lamp",
            name: "Pavement work light",
            action: "Aim the work light down",
            before: "The lamp shines into the waiting crowd.",
            after: "The light falls on the pavement instead of their faces.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / RAIN",
            text: "A cordon divides the street, but cannot divide its noise.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "CORDON OFFICER",
            text: "They still need to get home. Give them a way around.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "STREET",
            text: "The revised order is filed. The public queue has barely moved.",
            trigger: "after",
          },
        ],
      },
      "rachael-crowd": {
        sound: "rain",
        air: "Umbrellas pass like moving walls. Water runs from every edge.",
        people: [
          { name: "Parcel carrier", job: "carry", color: "#707555", line: "There is a clear line by the shutters." },
          { name: "Commuter", job: "walk", color: "#7a5460", line: "I cannot see the crossing light from here." },
        ],
        props: [
          {
            model: "umbrella",
            name: "Discarded open umbrella",
            action: "Fold the empty umbrella",
            before: "An abandoned open umbrella blocks part of the shop recess.",
            after: "The umbrella folds against the wall. Nobody is forced into the road.",
            id: "detail-1",
          },
          {
            model: "cart",
            name: "Empty parcel handcart",
            action: "Move the empty handcart",
            before: "The handcart narrows the only dry strip of pavement.",
            after: "The cart rolls into a closed delivery bay.",
            id: "detail-2",
          },
          {
            model: "lamp",
            name: "Crossing repeater",
            action: "Wipe the crossing-lamp cover",
            before: "Rain and dirt have dulled the small repeater.",
            after: "The cover is clear. The current signal is easier to see.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / RAIN",
            text: "Umbrellas pass like moving walls. Water runs from every edge.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "PARCEL CARRIER",
            text: "A little space is enough. Just keep it open.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "CROWD",
            text: "For a moment, the umbrellas part without anyone having to push.",
            trigger: "after",
          },
        ],
      },
      "leon-attack": {
        sound: "rain",
        air: "The main street is close. It sounds much farther away from this side passage.",
        people: [],
        props: [
          {
            model: "lamp",
            name: "Alley maintenance lamp",
            action: "Turn the work lamp from the eyes",
            before: "The lamp points along the path at head height.",
            after: "Its light falls lower, across the broken paving.",
            id: "detail-1",
          },
          {
            model: "bucket",
            name: "Tipped cleaning bucket",
            action: "Set the empty bucket upright",
            before: "An empty bucket rolls against a drain.",
            after: "The bucket stays beside the wall. The drain remains open.",
            id: "detail-2",
          },
          {
            model: "radio",
            name: "Abandoned service speaker",
            action: "Acknowledge the service tone",
            before: "A maintenance panel has been repeating one tone all night.",
            after: "The tone stops. The fault light stays visible.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / RAIN",
            text: "The main street is close. It sounds much farther away from this side passage.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "ALLEY",
            text: "A delivery door closes somewhere behind the street noise.",
            trigger: "near",
          },
          { id: "after", speaker: "RACHAEL", text: "Stay still for a moment. The street can wait.", trigger: "after" },
        ],
      },
      "home-firstaid": {
        sound: "water",
        air: "The room is familiar. Your hands make its small tasks less familiar.",
        people: [],
        props: [
          {
            model: "valve",
            name: "Familiar basin valve",
            action: "Seat the worn tap washer",
            before: "The tap has not quite stopped.",
            after: "The basin goes quiet. The repair will remain when you return.",
            memory: "home-water",
            id: "detail-1",
          },
          {
            model: "towel",
            name: "Spare dry towel",
            action: "Move the towel to the dry hook",
            before: "The spare towel hangs below the damp pipe.",
            after: "The dry hook keeps it clear of the leak.",
            memory: "home-towel",
            id: "detail-2",
          },
          {
            model: "lamp",
            name: "Entrance lamp switch",
            action: "Switch on the entrance lamp",
            before: "The route to the door is darker than the work table.",
            after: "The low lamp lights the floor without glare.",
            memory: "home-lamp",
            undo: "Switch off the entrance lamp",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / WATER",
            text: "The room is familiar. Your hands make its small tasks less familiar.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "APARTMENT",
            text: "Water moves behind the wall. The room itself is quieter.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "RACHAEL",
            text: "There is no need to do every small thing at once.",
            trigger: "after",
          },
        ],
      },
      "home-piano": {
        sound: "piano",
        air: "The piano adds a real vibration to the room. The keys are worn in places you cannot explain.",
        people: [],
        props: [
          {
            model: "piano",
            name: "Loose piano rest",
            action: "Secure the music rest",
            before: "The empty rest buzzes with the lower notes.",
            after: "The catch holds. The next note fades without a rattle.",
            memory: "home-piano",
            id: "detail-1",
          },
          {
            model: "lamp",
            name: "Piano reading lamp",
            action: "Lower the piano lamp glare",
            before: "The lamp reflects in the polished edge above the keys.",
            after: "The hood lowers. The white keys stay clear.",
            memory: "piano-shade",
            id: "detail-2",
          },
          {
            model: "chair",
            name: "Unsteady piano stool",
            action: "Seat the loose stool pad",
            before: "One felt pad has slipped beneath the stool.",
            after: "The pad is seated. The stool no longer rocks.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / PIANO",
            text: "The piano adds a real vibration to the room. The keys are worn in places you cannot explain.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "RACHAEL",
            text: "A familiar movement can arrive before the memory that should explain it.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "APARTMENT",
            text: "The last note travels through the wood after the hands have left the keys.",
            trigger: "after",
          },
        ],
      },
      "pris-dresses": {
        sound: "toys",
        air: "Old cloth hangs in layers. The smallest movement makes a different outline.",
        people: [],
        props: [
          {
            model: "coat",
            name: "Dragging empty dress cover",
            action: "Lift the empty cover clear",
            before: "An empty cover trails from the lowest rail.",
            after: "The cloth hangs clear of the floor and the walking route.",
            id: "detail-1",
          },
          {
            model: "mirror",
            name: "Covered fitting mirror",
            action: "Fold back the loose corner",
            before: "One cover corner blocks the safe passage by the mirror.",
            after: "The corner is held back. The mirror reflects a single clear strip.",
            id: "detail-2",
          },
          {
            model: "toy",
            name: "Unwound display toy",
            action: "Wind the display toy once",
            before: "The key stands still at the back of the old toy.",
            after: "The toy takes a few careful steps and raises one arm.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / TOYS",
            text: "Old cloth hangs in layers. The smallest movement makes a different outline.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "DRESS ROOM",
            text: "A hanger touches another hanger. No one has entered the room.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "DRESS ROOM",
            text: "The toy\u2019s little routine finishes. The hanging shapes become still again.",
            trigger: "after",
          },
        ],
      },
      "sebastian-lab": {
        sound: "toys",
        air: "Unfinished parts share the benches with things repaired many times.",
        people: [],
        props: [
          {
            model: "toy",
            name: "Bear at the repair bench",
            action: "Free the bear\u2019s sleeve",
            before: "A cloth sleeve has reached a drive wheel.",
            after: "The wheel turns freely. The bear remembers its uneven salute.",
            memory: "friend-bear",
            id: "detail-1",
          },
          {
            model: "solder",
            name: "Workbench extraction hood",
            action: "Seat the hood catch",
            before: "The outer hood has slipped from its catch.",
            after: "The hood sits over the unused work pad. The fume path is clear.",
            id: "detail-2",
          },
          {
            model: "cabinet",
            name: "Loose small-parts drawer",
            action: "Close the empty parts drawer",
            before: "The lowest drawer projects beside the repair stool.",
            after: "The drawer closes. The labelled upper drawers remain untouched.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / TOYS",
            text: "Unfinished parts share the benches with things repaired many times.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "SEBASTIAN",
            text: "Some of them need me. That is not the same as all of them being broken.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "WORKSHOP",
            text: "A small friend finishes a task that nobody asked it to begin.",
            trigger: "after",
          },
        ],
      },
      "home-trust": {
        sound: "apartment",
        air: "The door is visible from every seat. Nothing has been placed in front of it.",
        people: [],
        props: [
          {
            model: "blinds",
            name: "Apartment glare screen",
            action: "Lower the glare screen",
            before: "The city light still moves across the photograph frames.",
            after: "The screen lowers. The small room has its own light again.",
            memory: "home-shade",
            undo: "Raise the glare screen",
            id: "detail-1",
          },
          {
            model: "piano",
            name: "Piano music rest",
            action: "Secure the music rest",
            before: "The old rest has a loose catch.",
            after: "The rest stays fixed. The piano waits quietly.",
            memory: "home-piano",
            id: "detail-2",
          },
          {
            model: "chair",
            name: "Chair by the doorway",
            action: "Move the chair clear of the door",
            before: "A spare chair narrows the approach to the open door.",
            after: "The route to the door is clear. It stays that way.",
            memory: "home-door",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / APARTMENT",
            text: "The door is visible from every seat. Nothing has been placed in front of it.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "APARTMENT",
            text: "A passing light reaches the open doorway, then leaves it.",
            trigger: "near",
          },
          { id: "after", speaker: "RACHAEL", text: "A clear way out makes a room different.", trigger: "after" },
        ],
      },
      "roy-sebastian": {
        sound: "toys",
        air: "The chess clock is stopped. The machinery elsewhere in the room is not.",
        people: [],
        props: [
          {
            model: "clock",
            name: "Silent chess clock",
            action: "Seat the loose clock cover",
            before: "The clock\u2019s rear cover rattles when the table moves.",
            after: "The cover sits still. You do not alter the position or the clocks.",
            id: "detail-1",
          },
          {
            model: "toy",
            name: "Watching mechanical friend",
            action: "Free its caught hand",
            before: "A small cloth cuff catches the toy\u2019s hand against its side.",
            after: "The hand comes free. The toy completes its patient wave.",
            id: "detail-2",
          },
          {
            model: "lamp",
            name: "Chess-table shade",
            action: "Move the shade from the board",
            before: "The shade casts a hard edge across the table.",
            after: "The edge moves away. All squares have the same light.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / TOYS",
            text: "The chess clock is stopped. The machinery elsewhere in the room is not.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "SEBASTIAN",
            text: "They wait until I come back to finish a game. They are good at waiting.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "ROOM",
            text: "The little friend resumes its wave after the larger conversation has moved on.",
            trigger: "after",
          },
        ],
      },
      "hospital-two": {
        sound: "medical",
        air: "The same monitor is on the same cycle. The visit does not feel the same.",
        people: [
          { name: "Night nurse", job: "check", color: "#88978a", line: "The ward is quieter after the last round." },
        ],
        props: [
          {
            model: "blinds",
            name: "Familiar bedside shade",
            action: "Lower the bedside shade",
            before: "A line of corridor light reaches the pillow.",
            after: "The shade blocks the glare, as it did before.",
            memory: "hospital-shade",
            id: "detail-1",
          },
          {
            model: "chair",
            name: "Returned visitor\u2019s chair",
            action: "Move the chair clear of the lead",
            before: "The chair has returned close to the cable route.",
            after: "It slides clear again. Care sometimes means repeating a small task.",
            id: "detail-2",
          },
          {
            model: "flowers",
            name: "Waterless flower vase",
            action: "Straighten the vase base",
            before: "The plastic vase stands on a curled paper mat.",
            after: "The mat is flat. The vase stops leaning.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / MEDICAL",
            text: "The same monitor is on the same cycle. The visit does not feel the same.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "NIGHT NURSE",
            text: "He knows when a visitor has been here, even when the room looks unchanged.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "WARD",
            text: "The nurse checks the monitor, then looks at the person beside it.",
            trigger: "after",
          },
        ],
      },
      "sebastian-call": {
        sound: "phone",
        air: "The street phone keeps its own small pool of light in the rain.",
        people: [
          {
            name: "Waiting caller",
            job: "wait",
            color: "#647363",
            line: "Take the time you need. I am only calling home.",
          },
        ],
        props: [
          {
            model: "phone",
            name: "Rain-wet handset cradle",
            action: "Clear the handset cradle",
            before: "Water has gathered in the unused half of the cradle.",
            after: "The cradle is dry. The spring returns the contact cleanly.",
            id: "detail-1",
          },
          {
            model: "awning",
            name: "Phone-box rain flap",
            action: "Fasten the rain flap",
            before: "The narrow roof flap drains onto the caller\u2019s shoulder.",
            after: "The flap sends the runoff behind the booth.",
            id: "detail-2",
          },
          {
            model: "coin",
            name: "Return-tray shutter",
            action: "Free the return shutter",
            before: "The empty tray shutter has caught on its frame.",
            after: "The shutter moves freely. It returns to its closed position.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / PHONE",
            text: "The street phone keeps its own small pool of light in the rain.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "WAITING CALLER",
            text: "The cheap lines work better when everyone else has gone home.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "PHONE BOX",
            text: "The waiting caller steps back from the door and lets the silence finish.",
            trigger: "after",
          },
        ],
      },
      "pris-playback": {
        sound: "phone",
        air: "The caller\u2019s image has become a field of bright lines and small delays.",
        people: [],
        props: [
          {
            model: "projector",
            name: "Playback housing grille",
            action: "Seat the loose grille",
            before: "The playback motor makes its housing buzz.",
            after: "The grille sits flat. The motor sound becomes even.",
            id: "detail-1",
          },
          {
            model: "lamp",
            name: "Booth inspection lamp",
            action: "Shade the playback glass",
            before: "The booth light reflects across the saved image.",
            after: "The shade clears the image without altering the recording.",
            id: "detail-2",
          },
          {
            model: "printer",
            name: "Playback print receiver",
            action: "Align the empty receiver",
            before: "The receiver tray sits at an angle below the slot.",
            after: "The tray is level. It is ready for a hard copy.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / PHONE",
            text: "The caller\u2019s image has become a field of bright lines and small delays.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "PLAYBACK",
            text: "A recorded pause repeats with exactly the same length.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "PHONE BOX",
            text: "The printed image is still. The booth\u2019s light continues to move in the rain.",
            trigger: "after",
          },
        ],
      },
      "tyrell-lift": {
        sound: "tower",
        air: "The lift leaves the public floors behind. The floor numbers continue.",
        people: [],
        props: [
          {
            model: "rail",
            name: "Lift handrail cap",
            action: "Seat the loose rail cap",
            before: "A metal end cap ticks against the rail.",
            after: "The cap stays in place. The lift\u2019s low motor hum remains.",
            id: "detail-1",
          },
          {
            model: "lamp",
            name: "Reading panel hood",
            action: "Lower the panel hood",
            before: "The panel adds a bright reflection to the glass.",
            after: "The hood removes the glare from the height indicators.",
            id: "detail-2",
          },
          {
            model: "vent",
            name: "Lift return outlet",
            action: "Turn the draught away",
            before: "The outlet pushes cold air against the standing space.",
            after: "The air moves towards the closed side panel.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / TOWER",
            text: "The lift leaves the public floors behind. The floor numbers continue.",
            trigger: "arrival",
          },
          { id: "near", speaker: "LIFT", text: "A service floor passes without the lift slowing.", trigger: "near" },
          {
            id: "after",
            speaker: "LIFT",
            text: "The arrival tone is softer here than it was below.",
            trigger: "after",
          },
        ],
      },
      "chess-access": {
        sound: "tower",
        air: "The access speaker waits beside the board. Every small sound travels across the room.",
        people: [],
        props: [
          {
            model: "clock",
            name: "Access-table clock cover",
            action: "Secure the clock cover",
            before: "A loose cover rests against the clock case.",
            after: "The cover closes. You do not change the chess position.",
            id: "detail-1",
          },
          {
            model: "glass",
            name: "Water on the access desk",
            action: "Move the glass clear of the board",
            before: "The glass is close to the outer edge of the board.",
            after: "The glass moves onto a coaster beyond the playing area.",
            id: "detail-2",
          },
          {
            model: "lamp",
            name: "Board task lamp",
            action: "Lower the bright edge",
            before: "The lamp creates a bright band across one corner.",
            after: "The shade evens the light across the board.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / TOWER",
            text: "The access speaker waits beside the board. Every small sound travels across the room.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "ACCESS DESK",
            text: "The speaker opens a channel, then waits for a response.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "TOWER",
            text: "A lock releases beyond the room. The board remains exactly where the game left it.",
            trigger: "after",
          },
        ],
      },
      "maker-question": {
        sound: "tower",
        air: "The private room has the quiet of a place maintained by other people.",
        people: [],
        props: [
          {
            model: "water",
            name: "Bedroom water feature",
            action: "Clear the outer return",
            before: "A loose decorative strip touches the return water.",
            after: "The strip sits above the channel. The water returns evenly.",
            id: "detail-1",
          },
          {
            model: "curtain",
            name: "Loose bedside curtain",
            action: "Secure the empty curtain tie",
            before: "The end of a tie brushes a warm lamp housing.",
            after: "The tie is secured away from the heat.",
            id: "detail-2",
          },
          {
            model: "lamp",
            name: "Low reading lamp",
            action: "Lower the reading glare",
            before: "The reading light reaches the visitor\u2019s standing space.",
            after: "The light falls onto the empty bedside table instead.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / TOWER",
            text: "The private room has the quiet of a place maintained by other people.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "PRIVATE ROOM",
            text: "A service system adjusts the room temperature by a fraction.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "PRIVATE ROOM",
            text: "The water keeps moving while the technical conversation runs out of room.",
            trigger: "after",
          },
        ],
      },
      "maker-fall": {
        sound: "tower",
        air: "The room\u2019s service systems continue. Their order makes the silence worse.",
        people: [],
        props: [
          {
            model: "curtain",
            name: "Shifting window curtain",
            action: "Secure the loose curtain",
            before: "A loose curtain keeps moving against the wall.",
            after: "The curtain holds. The room loses one unnecessary movement.",
            id: "detail-1",
          },
          {
            model: "lamp",
            name: "Empty reading area",
            action: "Turn the reading light down",
            before: "The lamp still lights an unused page rest.",
            after: "The light becomes a low amber patch.",
            id: "detail-2",
          },
          {
            model: "clock",
            name: "Service clock cover",
            action: "Close the clock\u2019s loose rear cover",
            before: "The clock cover vibrates against the wall.",
            after: "The cover sits still. The clock continues to mark time.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / TOWER",
            text: "The room\u2019s service systems continue. Their order makes the silence worse.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "ROOM",
            text: "A distant pump starts. Nothing in its routine has changed.",
            trigger: "near",
          },
          { id: "after", speaker: "ROOM", text: "The service lights remain on when the visit ends.", trigger: "after" },
        ],
      },
      "roy-descent": {
        sound: "tower",
        air: "The lift has more empty space on the way down.",
        people: [],
        props: [
          {
            model: "rail",
            name: "Warm lift rail cap",
            action: "Seat the rail cap",
            before: "The cap has worked loose during the descent.",
            after: "It settles. Your hand leaves a faint mark on the metal.",
            id: "detail-1",
          },
          {
            model: "radio",
            name: "Lift service speaker",
            action: "Lower the service speaker",
            before: "Routine floor messages fill the lift.",
            after: "The messages become quiet enough to leave space between them.",
            id: "detail-2",
          },
          {
            model: "vent",
            name: "Lift cooling outlet",
            action: "Turn the outlet away",
            before: "Air moves across the place where another passenger stood.",
            after: "The outlet faces the glass. The standing space is still.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / TOWER",
            text: "The lift has more empty space on the way down.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "LIFT",
            text: "The doors remain closed as the public floors return.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "LIFT",
            text: "At the next stop, the motor is the last thing to become quiet.",
            trigger: "after",
          },
        ],
      },
      "bradbury-return": {
        sound: "ruin",
        air: "The building has the same parts. They no longer seem to welcome you.",
        people: [],
        props: [
          {
            model: "valve",
            name: "Cage-lift guide pad",
            action: "Fill the guide pad",
            before: "The guide makes a dry scrape near the landing.",
            after: "The lubricated guide carries a softer sound through the cage.",
            memory: "lift-guide",
            id: "detail-1",
          },
          {
            model: "toy",
            name: "Bear in the entrance",
            action: "Free the bear\u2019s sleeve",
            before: "The little wheel catches a loose cuff.",
            after: "The wheel turns. The old salute returns in an empty hall.",
            memory: "friend-bear",
            id: "detail-2",
          },
          {
            model: "lamp",
            name: "Entrance work lamp",
            action: "Lower the work-light glare",
            before: "A temporary lamp shines across the approach.",
            after: "The hood lowers. The floor is lit without masking the upper shadows.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / RUIN",
            text: "The building has the same parts. They no longer seem to welcome you.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "BUILDING",
            text: "The little mechanisms have not learned that the visit is different.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "ATRIUM",
            text: "A cable moves above. It takes the whole shaft to carry the sound down.",
            trigger: "after",
          },
        ],
      },
      "bradbury-stairs": {
        sound: "ruin",
        air: "Water has found a route down the stair wall. The boards have found ways to answer it.",
        people: [],
        props: [
          {
            model: "rail",
            name: "Loose landing handrail cap",
            action: "Seat the accessible rail cap",
            before: "A cap rattles beside the safe side of the landing.",
            after: "The cap is secure. This does not repair the broken stair.",
            id: "detail-1",
          },
          {
            model: "cable",
            name: "Lifted cable mat",
            action: "Flatten the service mat",
            before: "An unused service cable raises one edge of a mat.",
            after: "The mat lies flat along the wall, clear of the safe route.",
            id: "detail-2",
          },
          {
            model: "lamp",
            name: "Landing service light",
            action: "Aim the service light down",
            before: "The lamp lights the ceiling more than the floor.",
            after: "Its beam reaches the first safe section of the landing.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / RUIN",
            text: "Water has found a route down the stair wall. The boards have found ways to answer it.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "STAIRWELL",
            text: "A small object falls on another floor. You never hear it land.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "LANDING",
            text: "The board behind you settles after your weight has left it.",
            trigger: "after",
          },
        ],
      },
      "doll-room": {
        sound: "backstage",
        air: "The display uses stillness as camouflage. The broken motor does not know when to stop.",
        people: [],
        props: [
          {
            model: "toy",
            name: "Clicking display motor",
            action: "Stop the empty display motor",
            before: "A vacant display stand clicks at the end of its travel.",
            after: "The motor stops. No occupied display is disturbed.",
            id: "detail-1",
          },
          {
            model: "curtain",
            name: "Display-side drape",
            action: "Tie the loose side drape",
            before: "A narrow strip of drape moves in the passage.",
            after: "The strip is fixed. The route has one less moving shape.",
            id: "detail-2",
          },
          {
            model: "lamp",
            name: "Inspection floodlight",
            action: "Lower the direct glare",
            before: "The light points back towards the entrance.",
            after: "The hood directs it at the empty floor between the displays.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / BACKSTAGE",
            text: "The display uses stillness as camouflage. The broken motor does not know when to stop.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "DISPLAY ROOM",
            text: "A clockwork click comes from a stand with nothing on it.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "DISPLAY ROOM",
            text: "The empty stand stays still. The other shapes do not become easier to read.",
            trigger: "after",
          },
        ],
      },
      "pris-ambush": {
        sound: "backstage",
        air: "The room offers too many edges and too little open floor.",
        people: [],
        props: [
          {
            model: "cable",
            name: "Loose floor cable loop",
            action: "Secure the unused cable loop",
            before: "A disconnected cable loop lies beside the entry.",
            after: "The loop is clipped against the wall, away from your feet.",
            id: "detail-1",
          },
          {
            model: "lamp",
            name: "Entry work light",
            action: "Aim the entry lamp down",
            before: "The lamp makes a reflection at eye level.",
            after: "The light moves to the floor. The displays retain their shadows.",
            id: "detail-2",
          },
          {
            model: "curtain",
            name: "Empty garment cover",
            action: "Pin the empty cover back",
            before: "An empty cover brushes the entry route.",
            after: "The cover is held against its rail, clear of the path.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / BACKSTAGE",
            text: "The room offers too many edges and too little open floor.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "ROOM",
            text: "A sound from the lift arrives through the wall as a low tremor.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "ROOM",
            text: "When the movement ends, the empty garments still take time to settle.",
            trigger: "after",
          },
        ],
      },
      "roy-return": {
        sound: "ruin",
        air: "The lift sound reaches the landing before the cage appears.",
        people: [],
        props: [
          {
            model: "valve",
            name: "Upper lift guide pad",
            action: "Fill the guide pad",
            before: "The common guide scrapes at the upper landing.",
            after: "The guide runs more quietly. The cage itself still announces every stop.",
            memory: "lift-guide",
            id: "detail-1",
          },
          {
            model: "bell",
            name: "Loose service chime cover",
            action: "Seat the chime cover",
            before: "The cover vibrates with the lift cable.",
            after: "The cover is fixed. A real arrival can still sound the chime.",
            id: "detail-2",
          },
          {
            model: "lamp",
            name: "Upper route lamp",
            action: "Lower the lamp hood",
            before: "The lamp throws glare across the doorway.",
            after: "The light falls on the connected route instead.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / RUIN",
            text: "The lift sound reaches the landing before the cage appears.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "LANDING",
            text: "The cage stops below, pauses, and begins to rise again.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "LANDING",
            text: "The route is clear. The lift is not far behind it.",
            trigger: "after",
          },
        ],
      },
      billiard: {
        sound: "ruin",
        air: "Rain has reached the billiard cloth. The room amplifies every hard contact.",
        people: [],
        props: [
          {
            model: "billiard",
            name: "Loose ball at the route edge",
            action: "Roll the loose ball into the tray",
            before: "A loose ball rests beside the passage, not on the playing surface.",
            after: "It rolls into the empty return tray and stops with one clear knock.",
            id: "detail-1",
          },
          {
            model: "curtain",
            name: "Broken cue-rack strap",
            action: "Fasten the empty rack strap",
            before: "A strap knocks against an empty cue rack.",
            after: "The strap is secured. The tapping stops.",
            id: "detail-2",
          },
          {
            model: "lamp",
            name: "Billiard side lamp",
            action: "Turn the side lamp from the doorway",
            before: "The side light makes the doorway difficult to read.",
            after: "The hood shifts. The doorway is no longer behind the glare.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / RUIN",
            text: "Rain has reached the billiard cloth. The room amplifies every hard contact.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "BILLIARD ROOM",
            text: "One old ball settles against another in the return channel.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "ROOM",
            text: "The small knocks have stopped. The larger sounds still come through the wall.",
            trigger: "after",
          },
        ],
      },
      armoire: {
        sound: "ruin",
        air: "The cabinet creaks under its own age before it carries anything else.",
        people: [],
        props: [
          {
            model: "drawer",
            name: "Empty lower cabinet drawer",
            action: "Close the empty lower drawer",
            before: "The drawer blocks the approach to the cabinet side.",
            after: "The drawer seats fully. The climbing route itself is unchanged.",
            id: "detail-1",
          },
          {
            model: "coat",
            name: "Loose empty hanger",
            action: "Secure the empty hanger",
            before: "A spare hanger taps against the cabinet wall.",
            after: "The hanger sits on a lower hook, clear of the handhold.",
            id: "detail-2",
          },
          {
            model: "lamp",
            name: "Cabinet inspection light",
            action: "Aim the light at the base",
            before: "The lamp shines above the useful edge.",
            after: "Its beam reaches the cabinet foot and the clear approach.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / RUIN",
            text: "The cabinet creaks under its own age before it carries anything else.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "CABINET",
            text: "The wood answers a movement elsewhere in the building.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "ROOM",
            text: "The cabinet stops shifting slowly, one joint at a time.",
            trigger: "after",
          },
        ],
      },
      "upper-bath": {
        sound: "water",
        air: "Water ticks into a stained basin. The upper pipes carry footsteps badly.",
        people: [],
        props: [
          {
            model: "valve",
            name: "Upper-room tap",
            action: "Close the loose tap",
            before: "The tap\u2019s last quarter turn has been left open.",
            after: "The water stops. You can hear beyond the basin.",
            id: "detail-1",
          },
          {
            model: "towel",
            name: "Spare cloth on the rail",
            action: "Move the spare cloth to the dry end",
            before: "The cloth hangs under a slow roof drip.",
            after: "The dry end of the rail keeps the spare cloth clear.",
            id: "detail-2",
          },
          {
            model: "mirror",
            name: "Loose mirror catch",
            action: "Secure the mirror\u2019s outer catch",
            before: "The outer frame taps against its fitting.",
            after: "The frame is still. Its damaged glass is left untouched.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / WATER",
            text: "Water ticks into a stained basin. The upper pipes carry footsteps badly.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "BATHROOM",
            text: "A step travels along a pipe, then disappears into the wall.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "BATHROOM",
            text: "The bound hand can leave the basin. The quiet has not made the next room safe.",
            trigger: "after",
          },
        ],
      },
      "pigeon-closet": {
        sound: "birds",
        air: "Feathers collect in the corners. The birds keep away from the open floor.",
        people: [],
        props: [
          {
            model: "bird",
            name: "Loose perch bracket",
            action: "Seat the outer perch bracket",
            before: "The unused end of the perch vibrates against the frame.",
            after: "The bracket holds. A pigeon turns towards the quiet.",
            id: "detail-1",
          },
          {
            model: "water",
            name: "Empty pigeon dish",
            action: "Fill the shallow dish",
            before: "The old dish is dry along one edge.",
            after: "A shallow pool covers the base. You leave room around it.",
            id: "detail-2",
          },
          {
            model: "curtain",
            name: "Snagged window cloth",
            action: "Fasten the loose cloth edge",
            before: "A narrow cloth edge moves beside the closed window.",
            after: "The edge is pinned clear of the planned opening.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / BIRDS",
            text: "Feathers collect in the corners. The birds keep away from the open floor.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "CLOSET",
            text: "The pigeons shift along the perch as one, then separate again.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "CLOSET",
            text: "Air moves through the opening. The feathers find it first.",
            trigger: "after",
          },
        ],
      },
      "outer-ledge": {
        sound: "wind",
        air: "The wall is close enough to touch. Everything beyond it is not.",
        people: [],
        props: [
          {
            model: "cable",
            name: "Loose maintenance tether",
            action: "Clip the unused tether to its bracket",
            before: "A service tether swings against the wall near the safe recess.",
            after: "The loose end is clipped clear. It is not a climbing line.",
            id: "detail-1",
          },
          {
            model: "lamp",
            name: "Recess work lamp",
            action: "Turn the recess lamp down",
            before: "The work lamp shines into rain at eye level.",
            after: "The light reaches the recess floor. The exposed ledge remains dark.",
            id: "detail-2",
          },
          {
            model: "sign",
            name: "Loose maintenance plate",
            action: "Secure the rattling plate",
            before: "The plate strikes its bracket in each gust.",
            after: "The bracket holds. Wind replaces the sharp metal knock.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / WIND",
            text: "The wall is close enough to touch. Everything beyond it is not.",
            trigger: "arrival",
          },
          { id: "near", speaker: "LEDGE", text: "The wind has no wall to stop it on the other side.", trigger: "near" },
          {
            id: "after",
            speaker: "LEDGE",
            text: "The next roof becomes a measured distance, not a safe promise.",
            trigger: "after",
          },
        ],
      },
      "roof-leap": {
        sound: "wind",
        air: "The roof edge turns the city into depth. Water runs towards it without hesitation.",
        people: [],
        props: [
          {
            model: "vent",
            name: "Loose roof-vent cover",
            action: "Seat the loose outer cover",
            before: "The outer cover lifts in the gusts.",
            after: "The cover locks. The vent keeps breathing below it.",
            id: "detail-1",
          },
          {
            model: "lamp",
            name: "Service marker lamp",
            action: "Aim the lamp at the safe patch",
            before: "The lamp points past the place where a foot can stand.",
            after: "The hood marks the near-side safe patch, not the gap.",
            id: "detail-2",
          },
          {
            model: "cable",
            name: "Unused service lead",
            action: "Secure the loose service lead",
            before: "The lead drags over the safe approach.",
            after: "The lead is fixed along the wall. The gap is no smaller.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / WIND",
            text: "The roof edge turns the city into depth. Water runs towards it without hesitation.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "ROOF",
            text: "The nearest sign lights the rain, then leaves the depth black again.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "ROOF",
            text: "A hand has changed what the fall meant. The rain has not changed at all.",
            trigger: "after",
          },
        ],
      },
      "roy-witness": {
        sound: "rain",
        air: "The roof offers no shelter. The small bird finds stillness in a pair of hands.",
        people: [],
        props: [
          {
            model: "lamp",
            name: "Roof service lamp",
            action: "Turn the glare away",
            before: "A service lamp points towards the seated figure.",
            after: "The light moves to the empty wet roof. Faces no longer sit behind its glare.",
            id: "detail-1",
          },
          {
            model: "water",
            name: "Rain-filled roof cup",
            action: "Set the shallow cup upright",
            before: "A shallow service cup lies on its side beside the safe wall.",
            after: "Rain begins to fill it. It is a small place for water to remain.",
            id: "detail-2",
          },
          {
            model: "vent",
            name: "Rattling roof grille",
            action: "Seat the outer grille",
            before: "The grille repeats a metallic tick under the rain.",
            after: "The grille is still. The roof has fewer sounds competing with a voice.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / RAIN",
            text: "The roof offers no shelter. The small bird finds stillness in a pair of hands.",
            trigger: "arrival",
          },
          { id: "near", speaker: "ROOF", text: "The bird makes one small adjustment of its feet.", trigger: "near" },
          {
            id: "after",
            speaker: "ROOF",
            text: "The space where the voice was remains part of the sound of the rain.",
            trigger: "after",
          },
        ],
      },
      "gaff-dawn": {
        sound: "dawn",
        air: "The light is changing without warming anything yet.",
        people: [],
        props: [
          {
            model: "lamp",
            name: "Unneeded roof lamp",
            action: "Dim the service lamp",
            before: "The lamp is brighter than the growing daylight.",
            after: "The lamp dims. The roof takes on the colour of the sky.",
            id: "detail-1",
          },
          {
            model: "sign",
            name: "Loose service plate",
            action: "Secure the service plate",
            before: "The plate knocks against the parapet fitting.",
            after: "The plate stays still. The new day has one less loose edge.",
            id: "detail-2",
          },
          {
            model: "water",
            name: "Rain-filled service dish",
            action: "Move the dish from the footpath",
            before: "The dish has caught a night\u2019s rain in the walking route.",
            after: "The dish sits against the wall, still holding the rain.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / DAWN",
            text: "The light is changing without warming anything yet.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "ROOF",
            text: "A distant morning shift starts before the night shift has quite ended.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "ROOF",
            text: "The warning ends. Dawn continues without waiting for an answer.",
            trigger: "after",
          },
        ],
      },
      "home-last": {
        sound: "apartment",
        air: "The familiar room holds the marks of the night\u2019s smaller choices.",
        people: [],
        props: [
          {
            model: "blinds",
            name: "Apartment glare screen",
            action: "Lower the glare screen",
            before: "The screen still has its old loose pull.",
            after: "The room keeps its own soft light.",
            memory: "home-shade",
            undo: "Raise the glare screen",
            id: "detail-1",
          },
          {
            model: "valve",
            name: "Familiar basin washer",
            action: "Seat the worn tap washer",
            before: "The washer sits at the last point where the tap can leak.",
            after: "The basin is quiet. The repair has lasted this far.",
            memory: "home-water",
            id: "detail-2",
          },
          {
            model: "lamp",
            name: "Entrance lamp",
            action: "Switch on the entrance lamp",
            before: "The small lamp stands by the same clear route to the door.",
            after: "The warm patch returns to the entrance floor.",
            memory: "home-lamp",
            undo: "Switch off the entrance lamp",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / APARTMENT",
            text: "The familiar room holds the marks of the night\u2019s smaller choices.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "APARTMENT",
            text: "The room remembers where you left its light, shade, and water.",
            trigger: "near",
          },
          { id: "after", speaker: "RACHAEL", text: "We do not have to take the whole room with us.", trigger: "after" },
        ],
      },
      packing: {
        sound: "apartment",
        air: "Open cases give ordinary things a sudden weight.",
        people: [],
        props: [
          {
            model: "suitcase",
            name: "Loose overnight-case strap",
            action: "Secure the empty outer strap",
            before: "The outer strap hangs below the closed case frame.",
            after: "The strap is secured without adding or removing any packed item.",
            id: "detail-1",
          },
          {
            model: "piano",
            name: "Piano\u2019s old music rest",
            action: "Secure the music rest",
            before: "The empty rest still has its familiar catch.",
            after: "The rest is quiet. The instrument can stay behind without its rattle.",
            memory: "home-piano",
            id: "detail-2",
          },
          {
            model: "coat",
            name: "Tray below the coat hook",
            action: "Place the tray under the coat",
            before: "The old hook drips onto the entrance floor.",
            after: "The tray catches the last water from the coat.",
            memory: "home-coat",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / APARTMENT",
            text: "Open cases give ordinary things a sudden weight.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "APARTMENT",
            text: "An empty drawer can look larger than a full case.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "ROOM",
            text: "The fastened cases stand near the door. Everything else remains a room, not luggage.",
            trigger: "after",
          },
        ],
      },
      "unicorn-corridor": {
        sound: "apartment",
        air: "The corridor is too quiet for such a small object to be hard to notice.",
        people: [],
        props: [
          {
            model: "lamp",
            name: "Corridor service light",
            action: "Lower the direct glare",
            before: "The service light shines across the floor from the side.",
            after: "The hood lowers. It no longer masks the paper\u2019s outline.",
            id: "detail-1",
          },
          {
            model: "cable",
            name: "Loose doormat corner",
            action: "Flatten the doormat corner",
            before: "The corner has lifted beside the clear walking route.",
            after: "The mat lies flat. The paper figure is left untouched.",
            id: "detail-2",
          },
          {
            model: "bell",
            name: "Loose lift-call cover",
            action: "Secure the call-button cover",
            before: "The outer cover clicks against its fitting.",
            after: "The cover is still. The working call button is unchanged.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / APARTMENT",
            text: "The corridor is too quiet for such a small object to be hard to notice.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "CORRIDOR",
            text: "The lift moves somewhere below you. The paper does not move at all.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "CORRIDOR",
            text: "A small object can stay small even when its meaning does not.",
            trigger: "after",
          },
        ],
      },
      "final-lift": {
        sound: "lift",
        air: "The doors have not closed yet. There is still a strip of the old floor between them.",
        people: [],
        props: [
          {
            model: "belt",
            name: "Loose case handle",
            action: "Secure the empty handle loop",
            before: "The handle loop knocks against the case side.",
            after: "The loop lies flat. The case is ready to carry.",
            id: "detail-1",
          },
          {
            model: "rail",
            name: "Lift rail cap",
            action: "Seat the loose rail cap",
            before: "The cap makes a soft tick beside your hand.",
            after: "The cap is secure. The lift\u2019s own sounds remain.",
            id: "detail-2",
          },
          {
            model: "lamp",
            name: "Lift reading lamp",
            action: "Dim the reading lamp",
            before: "The lamp throws a reflection into the closing-door space.",
            after: "The reflection fades. The strip of corridor remains clear.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / LIFT",
            text: "The doors have not closed yet. There is still a strip of the old floor between them.",
            trigger: "arrival",
          },
          { id: "near", speaker: "LIFT", text: "A small shift of weight passes through the floor.", trigger: "near" },
          {
            id: "after",
            speaker: "LIFT",
            text: "The last sound from the apartment floor ends with the doors.",
            trigger: "after",
          },
        ],
      },
      "forest-draft": {
        sound: "forest",
        air: "Daylight reaches the road in broken bands. The cabin carries the night with it.",
        people: [],
        props: [
          {
            model: "vent",
            name: "Cabin air inlet",
            action: "Open the fresh-air inlet",
            before: "The cabin air still holds the damp of the city.",
            after: "Cool outside air reaches the seats. The road remains ahead.",
            id: "detail-1",
          },
          {
            model: "belt",
            name: "Loose luggage strap",
            action: "Secure the luggage strap",
            before: "A loose strap knocks against the rear case.",
            after: "The cases stay together. Their weight no longer shifts at each bend.",
            id: "detail-2",
          },
          {
            model: "radio",
            name: "Unused city-band speaker",
            action: "Lower the city-band speaker",
            before: "The city channel is mostly distance and interference now.",
            after: "The loud hiss drops. No signal or pursuer is removed by the switch.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / FOREST",
            text: "Daylight reaches the road in broken bands. The cabin carries the night with it.",
            trigger: "arrival",
          },
          {
            id: "near",
            speaker: "CABIN",
            text: "The tyres change sound as the road crosses an old repair.",
            trigger: "near",
          },
          {
            id: "after",
            speaker: "ROAD",
            text: "The air is open. The route does not promise that the past has stayed behind.",
            trigger: "after",
          },
        ],
      },
      "forest-theatrical": {
        sound: "forest",
        air: "The road is brighter than any room from the night. Its next bend remains out of sight.",
        people: [],
        props: [
          {
            model: "vent",
            name: "Outside-air control",
            action: "Open the fresh-air inlet",
            before: "The old cabin air holds the last damp of the city.",
            after: "Cool air moves across the seats.",
            id: "detail-1",
          },
          {
            model: "belt",
            name: "Loose travel-case strap",
            action: "Secure the luggage strap",
            before: "The strap taps against a case at each bend.",
            after: "The strap is fixed. The cases travel without the repeated knock.",
            id: "detail-2",
          },
          {
            model: "radio",
            name: "Distant city receiver",
            action: "Lower the unused receiver",
            before: "Only a weak city carrier reaches the speaker.",
            after: "The receiver becomes quiet. Tyres and wind fill the cabin instead.",
            id: "detail-3",
          },
        ],
        cues: [
          {
            id: "arrival",
            speaker: "SOUND / FOREST",
            text: "The road is brighter than any room from the night. Its next bend remains out of sight.",
            trigger: "arrival",
          },
          { id: "near", speaker: "CABIN", text: "Light crosses the seats between the trees.", trigger: "near" },
          {
            id: "after",
            speaker: "ROAD",
            text: "The next bend arrives. There is no answer printed on the daylight.",
            trigger: "after",
          },
        ],
      },
    },
    LIFE_VERSION: "3.0.0",
  },
  {
    PROP_MODELS: CX,
    addSceneLife: H_,
    setLifeStates: nX,
    animateSceneLife: aX,
  } = (() => {
    let a = {
        wood: "#625041",
        dark: "#21343a",
        metal: "#7b8985",
        paper: "#d7cfad",
        mint: "#a0dbc5",
        gold: "#edbc76",
        cloth: "#6a756d",
      },
      e = {
        glass: "cup",
        ashtray: "cup",
        ice: "water",
        leaf: "plant",
        coin: "phone",
        belt: "strap",
        rail: "rail",
        glove: "cloth",
        towel: "cloth",
        sign: "sign",
        newspaper: "paper",
        solder: "workbench",
        clock: "clock",
        billiard: "billiard",
      },
      t = (u, p, m) => Math.max(p, Math.min(m, u)),
      s = new Set([
        "radio",
        "vent",
        "lamp",
        "cup",
        "fan",
        "blinds",
        "bowl",
        "awning",
        "belt",
        "printer",
        "coat",
        "projector",
        "cabinet",
        "stamp",
        "flowers",
        "chair",
        "owl",
        "water",
        "glass",
        "bucket",
        "cart",
        "drawer",
        "valve",
        "mirror",
        "towel",
        "newspaper",
        "glove",
        "tank",
        "toy",
        "bell",
        "leaf",
        "ice",
        "bird",
        "snake",
        "curtain",
        "phone",
        "coin",
        "cable",
        "sign",
        "ashtray",
        "umbrella",
        "barrier",
        "piano",
        "solder",
        "clock",
        "rail",
        "billiard",
        "suitcase",
      ]);
    function i(u, p, m, y = 0.75) {
      return (
        !u.collides(p, m, y) &&
        !u.hotspots.some((b) => Math.hypot(b.x - p, b.z - m) < 1.65) &&
        Math.hypot(p, m - 12) > 1.65
      );
    }
    function r(u, p, m = null) {
      let y = {
        hades: [
          [-4.2, 8.8],
          [-5, -24],
          [-4.3, -17],
        ],
        holden: [
          [-5.7, -12],
          [5.3, -12],
          [-5.5, -21],
        ],
      };
      if (u.isPrologue && y[u.def.key]?.[p] && i(u, ...y[u.def.key][p], 0.5)) return y[u.def.key][p];
      let b = {
        "home-water": [2, 3],
        "home-shade": [-6.4, -2],
        "home-lamp": [4, 9],
        "home-coat": [-5.8, 10.3],
        "home-door": [-1.8, 9.3],
        "home-piano": [-5.5, -13],
        "piano-shade": [-3.9, -13],
        "eye-vent": [-3.8, -19],
        "friend-bear": [-4.4, 8.5],
        "lift-guide": [-5, -21.5],
        "hospital-shade": [-6.8, -1],
        "row-awning": [-6.4, 2],
        "row-radio": [-4.3, 1.6],
        "esper-lamp": [5.9, -10],
        "esper-tray": [3.7, -6],
      };
      if (m && b[m] && i(u, ...b[m], 0.5)) return b[m];
      let x = p === 0 ? [-4.2, 8.8] : p === 1 ? [4.2, -4.6] : [-4.3, -17];
      return (
        [
          x,
          [x[0] * -1, x[1]],
          ...[-5.5, -4, 4, 5.5, -2, 2].flatMap((v) => [x[1], x[1] + 2, x[1] - 2].map((A) => [v, A])),
        ].find(([v, A]) => i(u, v, A) && !(u.life?.spots || []).some((S) => Math.hypot(v - S.x, A - S.z) < 2.5)) || [
          p % 2 ? 3.5 : -3.5,
          10 - p * 11,
        ]
      );
    }
    function n(u, p, m, y, b) {
      let x = e[p.model] || p.model,
        T = {
          ...p,
          x: m,
          y: 1.25,
          z: y,
          parts: [],
          state: !1,
          phase: b * 1.47 + ((u.def.id * 7) % 19),
          family: x,
          blend: 0,
        },
        v = (R, N, P, D, q, K, ee = a.metal, Z = "", ne = {}) => {
          let fe = u.box(m + R, N, y + P, D, q, K, ee, { dynamic: !0, lifeDetail: !0, ...ne }),
            Ee = { o: fe, ox: R, by: N, oz: P, bw: D, bh: q, bd: K, role: Z };
          return (T.parts.push(Ee), fe);
        },
        A = (R = 0.85, N = 1.45) => {
          v(0, R, 0, N, 0.12, 0.9, a.wood);
          for (let P of [-N * 0.4, N * 0.4]) for (let D of [-0.32, 0.32]) v(P, R / 2, D, 0.065, R, 0.065, a.dark);
        },
        S = (R, N, P, D, q, K, ee = "light", Z = a.gold) => v(R, N, P, D, q, K, Z, ee, { emissive: 1.3 }),
        _ = (R, N, P, D = 5) => {
          for (let q = 0; q < D; q++)
            v(R + (q % 2) * 0.065, N + q * 0.13, P, 0.085, 0.09, 0.08, "#b7cdca", "steam" + q, { alpha: 0.15 });
        },
        k = (R, N = 0.38, P = 0.34) => {
          for (let D of [-1, 1])
            (v((D * N) / 2, R, 0, 0.065, 0.23, P, a.paper, "move"),
              v(0, R, (D * P) / 2, N, 0.23, 0.055, a.paper, "move"));
          v(0, R - 0.11, 0, N, 0.045, P, a.paper, "move");
        };
      if (x === "cup" || x === "bowl")
        (A(0.78, 1.4),
          k(0.99, x === "bowl" ? 0.62 : 0.29, x === "bowl" ? 0.52 : 0.29),
          v(
            0,
            1.02,
            0,
            x === "bowl" ? 0.47 : 0.18,
            0.025,
            x === "bowl" ? 0.38 : 0.18,
            p.model === "ashtray" ? "#403c35" : "#7b5832",
            p.model === "ashtray" ? "contents" : "move",
          ),
          p.model !== "ashtray" &&
            (_(0, 1.17, 0, 4),
            v(0.43, 0.88, 0, 0.38, 0.015, 0.028, "#c0a879"),
            v(0.45, 0.895, 0.045, 0.38, 0.015, 0.028, "#c0a879")),
          (T.y = 1.04));
      else if (x === "radio" || x === "phone" || x === "projector") {
        (A(),
          v(0, 1.15, 0, 1.02, 0.57, 0.53, "#405b5c"),
          v(-0.14, 1.25, 0.29, 0.58, 0.3, 0.035, "#132e38"),
          S(-0.14, 1.25, 0.315, 0.47, 0.014, 0.014, "signal", a.mint));
        for (let R = 0; R < 5; R++) v(-0.36 + R * 0.115, 1.17, 0.315, 0.035, 0.12, 0.014, "#6c8278");
        if (
          (v(0.37, 1.06, 0.31, 0.14, 0.14, 0.075, a.gold, "switch"),
          x === "radio" &&
            (v(0.26, 1.86, -0.2, 0.025, 0.91, 0.025, a.metal), v(0.27, 2.28, -0.2, 0.05, 0.06, 0.05, a.gold)),
          x === "phone" &&
            (v(0.62, 1.23, 0.1, 0.2, 0.6, 0.24, a.dark, "move"), v(0.53, 0.93, 0.17, 0.17, 0.14, 0.17, a.dark)),
          x === "projector")
        ) {
          for (let R of [-0.25, 0.25])
            (v(R, 1.66, -0.02, 0.39, 0.39, 0.11, a.metal, "rotor"),
              v(R, 1.66, 0.065, 0.045, 0.36, 0.025, a.dark, "rotor"));
          S(0, 1.36, 0.38, 0.15, 0.16, 0.23, "light", a.mint);
        }
      } else if (x === "lamp")
        (v(0, 0.07, 0, 0.58, 0.14, 0.5, a.dark),
          v(0, 0.77, 0, 0.065, 1.35, 0.065, a.metal),
          v(0, 1.45, 0, 0.62, 0.12, 0.38, "#54716c", "hinge"),
          S(0, 1.385, 0.02, 0.48, 0.028, 0.26),
          v(0, 0.018, 0.12, 1.65, 0.009, 1.5, a.gold, "pool", { alpha: 0.09 }),
          (T.y = 1.45));
      else if (x === "fan" || x === "vent") {
        (v(0, 0.12, 0, 0.9, 0.25, 0.65, a.dark),
          v(0, 0.64, -0.18, 0.07, 1.2, 0.08, a.metal),
          v(0, 1.28, 0, 1.02, 1.02, 0.3, "#405956"),
          v(0, 1.28, 0.18, 0.84, 0.84, 0.04, a.dark),
          v(0, 1.28, 0.24, 0.71, 0.085, 0.02, a.metal, "rotor"),
          v(0, 1.28, 0.25, 0.09, 0.71, 0.02, a.metal, "rotor"));
        for (let R = -2; R < 3; R++) v(R * 0.17, 1.28, 0.29, 0.018, 0.84, 0.018, "#9aaa99");
        (v(0.39, 0.85, 0.33, 0.22, 0.065, 0.055, a.gold, "switch"), x === "vent" && _(0.2, 0.9, 0.37, 6));
      } else if (x === "blinds" || x === "curtain" || x === "awning") {
        let R = x === "awning",
          N = R ? 2.65 : 2.1;
        for (let P of [-0.95, 0.95]) v(P, N / 2, 0, 0.065, N, 0.065, a.dark);
        if ((v(0, N, 0, 2.02, 0.095, 0.08, a.metal), R)) {
          for (let P = 0; P < 8; P++)
            v(-0.87 + P * 0.25, N, -0.28, 0.23, 0.08, 1.3, P % 2 ? "#577d74" : "#88704f", "fold");
          v(0.85, 1.7, 0.02, 0.045, 0.62, 0.03, a.paper, "strap");
        } else
          for (let P = 0; P < 9; P++)
            v(
              0,
              0.48 + P * 0.175,
              0,
              1.76,
              x === "blinds" ? 0.115 : 0.18,
              0.028,
              P % 2 ? "#6a7a6f" : "#829183",
              "slat" + P,
            );
        (v(0.99, 0.93, 0.06, 0.035, 0.83, 0.025, a.gold, "switch"), (T.y = 1.36));
      } else if (x === "printer") {
        (A(),
          v(0, 1.17, 0, 0.9, 0.49, 0.6, "#9ca592"),
          v(0, 1.23, 0.32, 0.57, 0.12, 0.035, a.dark),
          v(0, 0.96, 0.53, 0.93, 0.055, 0.43, a.metal, "tray"),
          v(0, 1.08, 0.57, 0.7, 0.03, 0.38, a.paper, "paper"));
        for (let R = 0; R < 5; R++) v(0, 1.103, 0.43 + R * 0.05, 0.47, 0.008, 0.012, "#5b6f68", "paper");
        S(0.33, 1.22, 0.335, 0.07, 0.07, 0.02, "signal", a.mint);
      } else if (x === "coat" || x === "cloth" || x === "umbrella") {
        if (
          (v(0, 0.055, 0, 0.85, 0.11, 0.65, a.dark),
          v(0, 1, 0, 0.055, 1.95, 0.055, a.metal),
          v(0, 1.94, 0, 1.04, 0.07, 0.055, a.metal),
          x === "umbrella")
        ) {
          for (let R = -2; R <= 2; R++) v(R * 0.22, 1.99 - Math.abs(R) * 0.09, 0, 0.3, 0.08, 0.85, "#69897e", "fold");
          v(0, 1.6, 0.1, 0.025, 0.5, 0.025, a.gold, "fold");
        } else
          (v(0.19, 1.45, 0, 0.64, 0.77, 0.17, p.model === "glove" ? "#c9be98" : "#7b7565", "move"),
            v(-0.22, 1.62, 0, 0.24, 0.48, 0.14, "#8c8368", "move"));
        (v(0, 0.09, 0.22, 0.8, 0.14, 0.57, a.metal, "tray"), (T.y = 1.25));
      } else if (x === "cabinet" || x === "drawer") {
        (v(0, 0.81, 0, 1.06, 1.62, 0.74, "#5a4c3f"), v(0, 1.67, 0, 1.16, 0.1, 0.83, a.wood));
        for (let R = 0; R < 3; R++)
          (v(0, 0.29 + R * 0.52, 0.41, 1, 0.44, 0.07, "#87745b", R === 0 ? "move" : ""),
            v(0, 0.29 + R * 0.52, 0.465, 0.27, 0.045, 0.05, a.gold, R === 0 ? "move" : ""));
        T.y = 0.9;
      } else if (x === "chair") {
        for (let R of [-0.31, 0.31]) for (let N of [-0.28, 0.28]) v(R, 0.36, N, 0.06, 0.7, 0.06, a.dark, "move");
        (v(0, 0.72, 0, 0.79, 0.13, 0.73, "#77644f", "move"),
          v(0, 1.09, -0.28, 0.8, 0.68, 0.1, "#87735b", "move"),
          (T.y = 0.9));
      } else if (x === "cart") {
        v(0, 0.26, 0, 1.08, 0.13, 1.28, a.metal, "move");
        for (let R of [-0.43, 0.43]) for (let N of [-0.5, 0.5]) v(R, 0.12, N, 0.15, 0.23, 0.19, a.dark, "move");
        (v(0, 0.59, 0, 1, 0.52, 1, "#73877b", "move"), v(0, 0.97, -0.52, 1.08, 0.09, 0.08, a.metal, "move"));
        for (let R of [-0.45, 0.45]) v(R, 0.67, -0.52, 0.06, 0.6, 0.06, a.metal, "move");
        T.y = 0.8;
      } else if (x === "bucket" || x === "water") {
        x === "water" && A(0.57, 1.1);
        let R = x === "water" ? 0.78 : 0.26;
        for (let N of [-0.3, 0.3]) v(N, R, 0, 0.07, 0.45, 0.55, "#779087", "move");
        for (let N of [-0.27, 0.27]) v(0, R, N, 0.66, 0.45, 0.07, "#779087", "move");
        (v(0, R - 0.2, 0, 0.64, 0.06, 0.58, a.dark, "move"),
          v(0, R - 0.075, 0, 0.49, 0.015, 0.4, "#68a2a3", "water", { alpha: 0.65 }));
        for (let N = 0; N < 4; N++)
          v(0, R + 0.55 + N * 0.12, 0, 0.025, 0.06, 0.025, "#a3c7bf", "drip" + N, { alpha: 0.4 });
        T.y = R + 0.25;
      } else if (x === "valve") {
        (v(0, 0.32, 0, 1.25, 0.64, 0.9, "#56736d"),
          v(0, 0.69, 0, 1.34, 0.11, 1, "#b9c4b7"),
          v(0, 0.77, 0, 0.9, 0.025, 0.61, "#597d7e"),
          v(0, 1.03, -0.32, 0.09, 0.68, 0.09, a.metal),
          v(0, 1.38, -0.16, 0.095, 0.1, 0.37, a.metal),
          v(0.28, 1.13, -0.31, 0.36, 0.055, 0.045, a.gold, "switch"));
        for (let R = 0; R < 4; R++) v(0, 0.84 + R * 0.13, 0, 0.03, 0.09, 0.03, "#b4d8d1", "drip" + R, { alpha: 0.45 });
        T.y = 1.12;
      } else if (x === "mirror") {
        (v(0, 1.36, 0, 1, 1.5, 0.11, a.wood), v(0, 1.36, 0.07, 0.85, 1.34, 0.035, "#789fa3", "glass", { metal: !0 }));
        for (let R = 0; R < 4; R++)
          v(-0.3 + R * 0.16, 1.63 - R * 0.2, 0.1, 0.16, 0.43, 0.015, "#b3c4b8", "wipe", { alpha: 0.13 });
        (v(0, 0.5, -0.08, 0.64, 0.16, 0.49, a.metal), (T.y = 1.36));
      } else if (x === "tank" || x === "snake") {
        (A(0.65),
          v(0, 0.86, 0, 1.12, 0.3, 0.76, a.dark),
          v(0, 1.4, 0, 1.1, 0.78, 0.7, "#79b6b4", "glass", { alpha: 0.2 }),
          v(0, 1.82, 0, 1.2, 0.08, 0.79, a.metal, "lid"));
        for (let R = 0; R < 6; R++)
          v(
            (R - 3) * 0.12,
            1.08,
            Math.sin(R) * 0.12,
            0.16,
            0.085,
            0.1,
            x === "snake" ? "#bba77c" : "#d4a372",
            "swim" + R,
          );
        for (let R = 0; R < 4; R++)
          v(0.38, 1.11 + R * 0.13, 0, 0.037, 0.044, 0.038, "#a9d7ca", "bubble" + R, { alpha: 0.5 });
      } else if (x === "bird" || x === "owl") {
        (v(0, 0.08, 0, 0.8, 0.13, 0.68, a.dark),
          v(0, 0.68, 0, 0.055, 1.2, 0.055, a.wood),
          v(0, 1.32, 0, 1.05, 0.055, 0.055, a.wood, "perch"),
          v(0, 1.49, 0, 0.33, 0.32, 0.45, "#aab7aa", "bird"),
          v(0, 1.74, 0.16, 0.29, 0.26, 0.29, "#d4d8c2", "birdhead"),
          v(0, 1.71, 0.34, 0.11, 0.065, 0.12, a.gold, "beak"));
        for (let R of [-0.14, 0.14]) v(R, 1.48, 0, 0.1, 0.26, 0.4, "#788e86", "wing");
        for (let R of [-0.1, 0.1]) v(R, 1.78, 0.31, 0.045, 0.055, 0.016, a.dark, "eye");
        T.y = 1.5;
      } else if (x === "toy") {
        (v(0, 0.16, 0, 0.45, 0.27, 0.36, "#585d4f", "body"),
          v(0, 0.63, 0, 0.48, 0.66, 0.34, "#a7895e", "body"),
          v(0, 1.1, 0, 0.47, 0.33, 0.4, "#c0a072", "head"));
        for (let R of [-0.12, 0.12]) v(R, 1.16, 0.21, 0.055, 0.067, 0.02, a.dark, "head");
        for (let R of [-0.35, 0.35]) v(R, 0.67, 0, 0.18, 0.57, 0.22, "#90794f", R > 0 ? "arm" : "body");
        for (let R of [-0.14, 0.14]) v(R, 0.1, 0.05, 0.2, 0.16, 0.3, a.dark, "body");
        (v(0.31, 0.53, -0.22, 0.17, 0.05, 0.26, a.gold, "key"), (T.y = 0.8));
      } else if (x === "piano") {
        (v(0, 0.77, 0, 1.65, 1.43, 0.69, "#3f372f"), v(0, 1.44, -0.19, 1.65, 0.22, 0.3, "#584333"));
        for (let R = 0; R < 12; R++)
          (v(-0.73 + R * 0.13, 1.35, 0.34, 0.12, 0.045, 0.28, a.paper, "key" + R),
            R % 3 !== 0 && v(-0.68 + R * 0.13, 1.39, 0.27, 0.062, 0.065, 0.18, a.dark, "key" + R));
        (v(0, 1.78, -0.09, 0.83, 0.4, 0.06, a.wood, "hinge"), (T.y = 1.46));
      } else if (x === "suitcase") {
        v(0, 0.5, 0, 1.03, 0.87, 0.5, "#8b6e4c");
        for (let R of [-0.36, 0.36]) v(R, 0.5, 0.27, 0.065, 0.84, 0.025, "#c3ab7f", "strap");
        (v(0, 1.02, 0, 0.3, 0.17, 0.065, a.dark, "strap"), v(0, 0.34, 0.28, 0.89, 0.035, 0.028, a.gold), (T.y = 0.85));
      } else if (x === "strap" || x === "rail" || x === "cable") {
        if (x === "rail") {
          for (let R of [-0.7, 0.7]) v(R, 0.65, 0, 0.06, 1.3, 0.06, a.metal);
          (v(0, 1.2, 0, 1.7, 0.065, 0.065, a.metal), v(0.76, 1.2, 0.02, 0.16, 0.13, 0.14, a.gold, "move"));
        } else if (x === "strap")
          (v(0, 0.57, 0, 0.85, 0.88, 0.72, "#586659"),
            v(0, 1.02, 0, 0.83, 0.09, 0.75, "#6a7869"),
            v(0.18, 0.66, 0.4, 0.09, 0.73, 0.035, a.gold, "strap"),
            v(0.18, 0.32, 0.45, 0.15, 0.11, 0.06, a.metal, "switch"));
        else {
          v(0, 0.04, 0, 1.17, 0.08, 0.94, a.dark);
          for (let R = 0; R < 8; R++)
            v(Math.sin(R * 0.5) * 0.28, 0.1, Math.cos(R * 0.5) * 0.28, 0.07, 0.07, 0.25, a.gold, "cable");
        }
        T.y = x === "cable" ? 0.15 : 1.2;
      } else if (x === "bell" || x === "stamp" || x === "clock") {
        if (
          (A(0.85, 1.05),
          x === "bell" &&
            (v(0, 1.09, 0, 0.43, 0.22, 0.32, a.gold, "hinge"), v(0, 1.25, 0, 0.065, 0.2, 0.065, a.metal, "switch")),
          x === "stamp" &&
            (v(0, 0.97, 0, 0.31, 0.12, 0.24, a.dark, "move"),
            v(0, 1.1, 0, 0.08, 0.22, 0.08, a.wood, "move"),
            v(0, 1.22, 0, 0.25, 0.09, 0.18, a.wood, "move"),
            v(0.28, 0.95, 0.15, 0.31, 0.055, 0.24, a.gold)),
          x === "clock")
        ) {
          v(0, 1.18, 0, 0.67, 0.48, 0.28, a.wood);
          for (let R of [-0.18, 0.18])
            (v(R, 1.21, 0.15, 0.25, 0.27, 0.02, a.paper), v(R, 1.22, 0.17, 0.018, 0.18, 0.014, a.dark, "hand"));
          v(0, 1.48, 0, 0.5, 0.04, 0.15, a.metal, "hinge");
        }
      } else if (x === "paper" || x === "sign") {
        (v(0, 0.66, 0, 0.84, 1.22, 0.12, "#5a665e", "hinge"), v(0, 0.79, 0.075, 0.69, 0.64, 0.018, a.paper, "hinge"));
        for (let R = 0; R < 4; R++) v(0, 0.97 - R * 0.12, 0.09, 0.48, 0.022, 0.012, "#5c6b64", "hinge");
        (v(0, 0.04, 0, 0.95, 0.07, 0.54, a.dark), (T.y = 0.8));
      } else if (x === "barrier") {
        for (let R of [-0.73, 0.73])
          (v(R, 0.11, 0, 0.55, 0.2, 0.59, a.dark, "move"), v(R, 0.56, 0, 0.07, 0.9, 0.07, a.metal, "move"));
        v(0, 0.95, 0, 1.9, 0.27, 0.11, "#9e7950");
        for (let R = 0; R < 5; R++) v(-0.77 + R * 0.38, 0.95, 0.066, 0.14, 0.24, 0.022, a.paper);
        T.y = 1;
      } else if (x === "flowers" || x === "plant") {
        v(0, 0.37, 0, 0.5, 0.66, 0.42, "#8b7859");
        for (let R = 0; R < 5; R++) {
          let N = (R - 2) * 0.085;
          (v(N, 0.94, 0, 0.021, 0.68 + R * 0.07, 0.025, "#779171", "sway"),
            v(N, 1.2 + R * 0.04, 0.06, 0.18, 0.17, 0.18, x === "flowers" ? "#c2b986" : "#7ea780", "sway"));
        }
        T.y = 1.25;
      } else if (x === "workbench")
        (A(0.81, 1.65),
          v(0, 1.15, -0.12, 0.65, 0.3, 0.63, a.dark, "hinge"),
          v(0.45, 0.9, 0.17, 0.49, 0.06, 0.37, a.metal),
          v(-0.46, 0.94, 0.05, 0.37, 0.2, 0.41, a.gold),
          S(-0.45, 1.05, 0.08, 0.1, 0.012, 0.12, "light"));
      else if (x === "billiard")
        (v(0, 0.44, 0, 1.26, 0.83, 0.8, a.wood),
          v(0, 0.89, 0, 1.14, 0.055, 0.74, "#536c57"),
          v(-0.34, 1, 0.04, 0.16, 0.16, 0.16, a.paper, "ball"),
          v(0.44, 0.94, 0.05, 0.13, 0.18, 0.71, a.dark),
          (T.y = 1));
      else throw new Error("No physical detail model: " + p.model);
      let M = T.parts
        .filter(
          (R) =>
            !R.o.alpha &&
            R.by < 1.8 &&
            R.by + R.bh / 2 > 0.18 &&
            R.bw > 0.35 &&
            R.bd > 0.25 &&
            !["pool", "water", "light"].includes(R.role),
        )
        .sort((R, N) => N.bw * N.bd - R.bw * R.bd)[0];
      return (M && ((M.o.collide = !0), (M.o.lifeOwner = "life:" + p.id), u.obstacles.push(M.o)), T);
    }
    function o(u, p) {
      let m = u.box.bind(u),
        y = p.sound,
        b = ["apartment", "piano", "tower", "toys"].includes(y),
        x = b ? "#ac895e" : "#618881";
      for (let T = 0; T < 17; T++) {
        let v = T % 2 ? -1 : 1,
          A = 12 - Math.floor(T / 2) * 4.8,
          S = v * (5.7 + (T % 3) * 0.24);
        (m(S, 0.015, A, 0.21 + (T % 3) * 0.13, 0.012, 0.75, T % 3 ? "#35464a" : "#5a6860", { lifeDetail: !0 }),
          !u.outside &&
            T < 9 &&
            (m(v * 8.08, 0.5, A, 0.03, 0.02, 2.4, "#8b8268", { lifeDetail: !0 }),
            m(v * 8.07, 2.4, A, 0.05, 0.06, 0.26, a.metal, { lifeDetail: !0 })));
      }
      if (u.outside && !u.day)
        for (let T = 0; T < 4; T++) {
          let v = T % 2 ? -5.9 : 5.9,
            A = 8 - T * 8.2;
          m(v, 0.018, A, 2.3, 0.012, 1.5, T % 2 ? "#da9e69" : "#5dabae", { alpha: 0.075, lifeDetail: !0 });
          for (let S = 0; S < 5; S++) {
            let _ = m(v + (S - 2) * 0.12, 0.026, A + (S % 2) * 0.33, 0.02, 0.012, 0.14, "#c2ded2", {
              dynamic: !0,
              alpha: 0.24,
              lifeDetail: !0,
            });
            u.life.effects.push({ kind: "ripple", o: _, x: _.x, z: _.z, phase: T * 1.8 + S });
          }
        }
      if (
        ["market", "rain", "arcade"].includes(y) &&
        !["leon-attack", "roy-witness", "leon-window"].includes(u.def.key)
      )
        for (let T of [-1, 1])
          for (let v = 0; v < 3; v++) {
            let A = T * 8.2,
              S = 6 - v * 11;
            m(A, 2.8, S, 1.6, 0.12, 3.7, v % 2 ? "#5b7470" : "#856650", { lifeDetail: !0 });
            for (let _ = 0; _ < 3; _++)
              m(A - T * 0.6, 1.05, S - 1 + _ * 0.84, 0.58, 0.83, 0.6, v % 2 ? "#4d665e" : "#776049", {
                lifeDetail: !0,
              });
            m(A - T * 0.45, 3.45, S, 0.24, 0.48, 0.24, "#d5a367", { emissive: 1.1, lifeDetail: !0 });
          }
      if (["office", "archive"].includes(y))
        for (let T = 0; T < 5; T++) {
          let v = T % 2 ? 7.8 : -7.8,
            A = 7 - T * 7;
          m(v, 2.2, A, 0.09, 1.1, 1.5, "#88775a", { lifeDetail: !0 });
          for (let S = 0; S < 4; S++)
            m(v + (v > 0 ? -0.06 : 0.06), 2.3 + (S % 2) * 0.15, A - 0.46 + S * 0.28, 0.028, 0.35, 0.23, "#c8c1a4", {
              lifeDetail: !0,
            });
        }
      if (u.def.env === "apartment")
        for (let T of [-1, 1])
          for (let v = 0; v < 4; v++)
            for (let A = 0; A < 9; A++) {
              let S = 12 - A * 4.4 + (v % 2) * 0.2;
              (m(T * 8.1, 0.5 + v * 0.57, S, 0.075, 0.47, 3.8, v % 2 ? "#60574a" : "#514d43", { lifeDetail: !0 }),
                m(T * 8.04, 0.5 + v * 0.57, S, 0.09, 0.18, 0.33, "#77705c", { lifeDetail: !0 }));
            }
      if (["ruin", "toys", "backstage", "hotel"].includes(y))
        for (let T = 0; T < 7; T++) {
          let v = T % 2 ? 7.7 : -7.7,
            A = 10 - T * 5.8;
          (m(v, 3.2, A, 0.13, 2.2, 2.3, "#4b4941", { lifeDetail: !0 }),
            m(v, 1.5, A, 0.18, 0.12, 2.7, "#8a7961", { lifeDetail: !0 }),
            m(v, 0.08, A, 1.1, 0.08, 0.87, "#696451", { lifeDetail: !0 }));
        }
      if (["freezer", "medical", "laboratory"].includes(y))
        for (let T = 0; T < 7; T++) {
          let v = T % 2 ? 7.4 : -7.4,
            A = 8 - T * 5.8;
          (m(v, 4.7, A, 0.27, 0.27, 4.6, "#93aaa1", { lifeDetail: !0 }),
            m(v, 4.7, A, 0.4, 0.4, 0.12, "#c8ccb5", { lifeDetail: !0 }));
        }
      if (["freezer", "market", "rain", "flight", "furnace"].includes(y))
        for (let T = 0; T < 10; T++) {
          let v = (T % 2 ? 1 : -1) * (5.8 + (T % 3) * 0.24),
            A = 5 - Math.floor(T / 2) * 7.4,
            S = m(v, 0.22 + (T % 3) * 0.1, A, 0.21, 0.16, 0.27, "#b6cdc5", {
              alpha: 0.12,
              dynamic: !0,
              lifeDetail: !0,
            });
          u.life.effects.push({ kind: "steam", o: S, x: v, z: A, phase: T * 0.63 });
        }
      if (!u.outside && ["office", "hotel", "apartment", "piano", "toys", "ruin"].includes(y)) {
        m(0, 5.35, -4, 0.08, 0.55, 0.08, a.metal, { lifeDetail: !0 });
        for (let T = 0; T < 2; T++) {
          let v = m(0, 5.05, -4, T ? 0.13 : 3.2, 0.07, T ? 3.2 : 0.13, "#7b8070", { dynamic: !0, lifeDetail: !0 });
          u.life.effects.push({ kind: "fan", o: v, phase: (T * Math.PI) / 2 });
        }
      }
      u.life.tint = x;
    }
    function l(u, p, m) {
      if (!p.parts?.length) return;
      p.lifeName = m || p.name;
      let y = {
          Rachael: ["#4b5156", "#322c2a"],
          Roy: ["#3d4548", "#c1b995"],
          Pris: ["#3d4446", "#aea77b"],
          Leon: ["#655d47", "#554837"],
          Gaff: ["#4f5b4e", "#313b38"],
          Sebastian: ["#786b59", "#51483e"],
          Chew: ["#869181", "#4e5a57"],
          Bryant: ["#695b47", "#655b4a"],
        },
        b = Object.keys(y).find((x) => p.lifeName.includes(x));
      if (b) {
        let [x, T] = y[b];
        for (let v of [4, 5, 6, 7]) p.parts[v] && (p.parts[v].color = x);
        p.parts[11] && (p.parts[11].color = T);
      }
      ((p.lifeHome = { x: p.x, z: p.z }),
        (p.lifeControlled = !0),
        p.contact ||
          (p.contact = u.box(p.x, 0.023, p.z, 0.83, 0.01, 0.63, "#081920", {
            alpha: 0.24,
            dynamic: !0,
            lifeDetail: !0,
          })));
    }
    function c(u, p, m) {
      if (!m) return;
      let y = u.def.key;
      if (["vidphone", "sebastian-call"].includes(y) || m.label === "Write the incident report") {
        ((p.active = !1), (p.lifeRemote = !0));
        for (let _ of p.parts) _.hidden = !0;
        let T = p.x,
          v = p.z,
          A = (_, k, E, M, R, N, P, D = {}) => u.box(T + _, k, v + E, M, R, N, P, { lifeDetail: !0, ...D });
        if (
          (A(0, 0.59, 0, 1.16, 1.18, 0.6, "#445b5a"),
          A(0, 1.45, -0.1, 1.16, 0.64, 0.39, "#687c73"),
          A(0, 1.46, 0.12, 0.91, 0.44, 0.025, "#19363c"),
          m.label === "Write the incident report")
        )
          for (let _ = 0; _ < 5; _++) A(-0.08, 1.6 - _ * 0.065, 0.145, 0.6, 0.012, 0.012, "#a0ccae");
        else
          (A(0, 1.48, 0.146, 0.18, 0.2, 0.014, "#a2b79e"),
            A(0, 1.31, 0.146, 0.36, 0.12, 0.014, "#627f72"),
            A(-0.045, 1.51, 0.16, 0.025, 0.024, 0.012, "#243d40"),
            A(0.045, 1.51, 0.16, 0.025, 0.024, 0.012, "#243d40"),
            A(0.66, 1.24, 0.04, 0.17, 0.59, 0.23, "#293d40"));
        A(0, 1.04, 0.31, 0.9, 0.06, 0.39, "#9ba58d");
        for (let _ = 0; _ < 6; _++)
          A(-0.3 + (_ % 3) * 0.28, 1.09, 0.2 + Math.floor(_ / 3) * 0.13, 0.17, 0.022, 0.08, "#405e58");
        let S = u.hotspots.find((_) => _.id === m.id);
        S && (S.y = 1.43);
        return;
      }
      let x = "stand";
      if (
        (["hospital-one", "hospital-two"].includes(y)
          ? (x = "bed")
          : y === "roy-witness"
            ? (x = "kneel")
            : (y === "bryant" ||
                (y === "holden" && m.subject === "Leon") ||
                (y === "rachael-test" && m.subject === "Rachael") ||
                y === "home-piano" ||
                (y === "taffey" && m.label.includes("Taffey"))) &&
              (x = "sit"),
        (p.lifePose = x),
        (p.lifeShape = p.parts.map((T) => ({ w: T.w, h: T.h, d: T.d }))),
        (p.lifeShiver = y === "chew"),
        x === "sit")
      ) {
        for (let T of [-0.32, 0.32])
          for (let v of [-0.27, 0.27]) u.box(p.x + T, 0.2, p.z + v, 0.07, 0.4, 0.07, a.dark, { lifeDetail: !0 });
        (u.box(p.x, 0.42, p.z, 0.85, 0.11, 0.75, "#75644c", { lifeDetail: !0 }),
          u.box(p.x, 0.83, p.z - 0.34, 0.85, 0.86, 0.08, "#75644c", { lifeDetail: !0 }));
      }
      if (x === "bed") {
        (u.box(p.x, 0.28, p.z, 1.23, 0.48, 2.35, "#4c6968", { lifeDetail: !0 }),
          u.box(p.x, 0.56, p.z, 1.2, 0.12, 2.24, "#adb6a1", { lifeDetail: !0 }),
          u.box(p.x, 0.64, p.z - 0.69, 0.9, 0.13, 0.55, "#d5d4b7", { lifeDetail: !0 }));
        for (let A of [-1, 1])
          (u.box(p.x + A * 0.65, 0.73, p.z, 0.035, 0.24, 1.65, "#8eaba2", { lifeDetail: !0 }),
            u.box(p.x + A * 0.56, 0.075, p.z + 0.65, 0.19, 0.14, 0.2, a.dark, { lifeDetail: !0 }));
        let T = u.box(p.x + 1, 0.92, p.z - 0.6, 0.36, 0.7, 0.21, "#577671", { lifeDetail: !0 });
        u.box(p.x + 1, 1.09, p.z - 0.478, 0.25, 0.02, 0.016, "#ace1bf", { emissive: 0.8, lifeDetail: !0 });
        let v = u.hotspots.find((A) => A.id === m.id);
        v && (v.y = 0.98);
      }
    }
    function h(u, p) {
      if (
        ((u.life = {
          spec: p,
          spots: [],
          effects: [],
          support: [],
          clock: 0,
          lastPlayer: { x: 0, z: 12 },
          stepClock: 0,
        }),
        !!p)
      ) {
        for (let [m, y] of p.props.entries()) {
          if (!s.has(y.model)) throw new Error("Unknown local prop " + y.model);
          let [b, x] = r(u, m, y.memory),
            T = n(u, y, b, x, m);
          u.life.spots.push({
            ...T,
            id: "life:" + y.id,
            detailId: u.def.key + ":" + y.id,
            life: !0,
            optional: !0,
            definition: y,
          });
        }
        o(u, p);
        for (let m of u.actors) {
          if (m.namedDistrict || m.districtCrowd || m.animal) continue;
          let y = u.def.steps.find((b) => b.label === m.name);
          (c(u, m, y), l(u, m, y?.actor || y?.subject || m.name), (m.lifeStep = y?.id));
        }
        for (let [m, y] of p.people.entries()) {
          let b = [m % 2 ? 5.35 : -5.35, m ? -13 : 2.7],
            x = i(u, ...b, 0.35) ? b : r(u, (m + 1) % 3),
            T = u.character(y.name, ...x, y.color, { hat: y.job === "sweep", lifeSupporting: !0, patrol: !0 });
          (l(u, T, y.name),
            (T.person = y),
            (T.route = [
              { x: T.x, z: T.z },
              { x: T.x, z: T.z + (m % 2 ? 3.2 : -3.2) },
            ]),
            (T.routeIndex = 1),
            (T.pause = 2 + m),
            (T.facing = 0),
            u.life.support.push(T));
          let v = null;
          if (["sweep", "carry", "stir", "type", "check", "file", "work"].includes(y.job)) {
            let A =
              y.job === "sweep"
                ? [0.055, 1.4, 0.055]
                : y.job === "carry"
                  ? [0.65, 0.22, 0.45]
                  : y.job === "stir"
                    ? [0.045, 0.65, 0.045]
                    : [0.34, 0.07, 0.28];
            ((v = u.box(T.x + 0.52, 0.89, T.z + 0.2, ...A, y.job === "sweep" ? "#9a8c67" : "#9f9b80", {
              dynamic: !0,
              lifeDetail: !0,
            })),
              (T.tool = { o: v, ox: 0.52, oy: 0.89, oz: 0.2 }));
          }
        }
        for (let m of u.actors.filter((y) => y.name === "Pedestrian"))
          ((m.patrol = !0),
            (m.lifeSupporting = !0),
            (m.person = { name: "Passer-by", job: "walk", line: "Excuse me. I will go around." }),
            (m.route = [
              { x: m.x, z: m.z },
              { x: m.x, z: m.z + 3.5 },
            ]),
            (m.routeIndex = 1),
            (m.pause = 1),
            u.life.support.push(m));
        for (let m of u.hotspots.filter((y) => y.step && !["talk", "vk", "interview"].includes(y.step.kind)))
          for (let y of u.objects)
            if (
              !y.lifeDetail &&
              (y.text &&
                y.x === m.x &&
                Math.abs(y.z - (m.z + 0.52)) < 0.01 &&
                Math.abs(y.h - 0.26) < 0.02 &&
                (y.hidden = !0),
              y.x === m.x && y.z === m.z && Math.abs(y.w - 1.35) < 0.01 && Math.abs(y.h - 1.4) < 0.01)
            ) {
              ((y.h = 0.12),
                (y.y = 1.29),
                (y.color = ["apartment", "tower", "hotel", "atrium"].includes(u.def.env) ? a.wood : "#58716e"));
              for (let b of [-0.51, 0.51]) u.box(m.x + b, 0.65, m.z, 0.07, 1.27, 0.7, a.dark, { lifeDetail: !0 });
            }
      }
    }
    function d(u, p) {
      let m = p?.life;
      for (let y of u.life?.spots || []) {
        let b = y.memory || y.detailId;
        ((y.state = !!m?.states?.[b]), (y.blend = y.state ? 1 : 0), (y.seen = !!m?.seen?.includes(y.detailId)));
      }
    }
    function f(u, p, m, y, b, x, T, v = !1) {
      if (p.lifeRemote) {
        for (let P of p.parts) P.hidden = !0;
        p.contact && (p.contact.hidden = !0);
        return;
      }
      p.contact && ((p.contact.x = p.x), (p.contact.z = p.z), (p.contact.hidden = !p.active));
      let A = b.x - p.x,
        S = b.z - p.z,
        _ = Math.hypot(A, S) < 3.7,
        k = _ ? Math.atan2(A, S) : p.facing || 0,
        E = Math.atan2(Math.sin(k - (p.lookAngle || 0)), Math.cos(k - (p.lookAngle || 0)));
      !v && !x && (p.lookAngle = (p.lookAngle || 0) + E * 0.065);
      let M = p.facing || 0,
        R = Math.cos(M),
        N = Math.sin(M);
      u.moveActor(p, p.x, p.z, m, y && !x);
      for (let P = 0; P < p.parts.length; P++) {
        let D = p.parts[P];
        p.lifeShape && ((D.w = p.lifeShape[P].w), (D.h = p.lifeShape[P].h), (D.d = p.lifeShape[P].d));
        let q = P >= 10 && P <= 14,
          K = q && _ ? p.lookAngle : M,
          ee = Math.cos(K),
          Z = Math.sin(K);
        if (
          ((D.x = p.x + D.ox * ee + D.oz * Z), (D.z = p.z - D.ox * Z + D.oz * ee), (D.rotY = K), p.lifePose === "bed")
        ) {
          let fe = p.lifeShape[P];
          ((D.x = p.x + D.ox),
            (D.y = 0.79 + D.oz + (x ? 0 : Math.sin(m * 1.1) * 0.008)),
            (D.z = p.z + 0.84 - D.oy),
            (D.h = fe.d),
            (D.d = fe.h),
            (D.rotY = 0));
          continue;
        }
        if (p.lifePose === "sit" || p.lifePose === "kneel") {
          let fe = p.lifePose === "sit" ? 0.18 : 0.42;
          (P >= 4 && (D.y -= fe),
            P < 2 && ((D.h = 0.26), (D.d = 0.48), (D.y = 0.3), (D.z += 0.2)),
            (P === 2 || P === 3) && (D.z += 0.35));
        }
        if (x) {
          ((D.y =
            p.y +
            D.oy -
            ((p.lifePose === "sit" || p.lifePose === "kneel") && P >= 4 ? (p.lifePose === "sit" ? 0.18 : 0.42) : 0)),
            P < 2 && (p.lifePose === "sit" || p.lifePose === "kneel") && (D.y = 0.3));
          continue;
        }
        (p.lifeShiver && P >= 4 && ((D.x += Math.sin(m * 13 + p.phase) * 0.006), (D.y += Math.sin(m * 11) * 0.004)),
          y && P < 4 && (D.z += Math.sin(m * 6.5 + (P % 2 ? Math.PI : 0)) * 0.15),
          y && [6, 7, 8, 9].includes(P) && (D.z += Math.sin(m * 6.5 + (P % 2 ? 0 : Math.PI)) * 0.12));
        let ne = p.person?.job;
        if (
          (["stir", "sweep", "work", "type", "file", "check"].includes(ne) &&
            [7, 9].includes(P) &&
            ((D.z += 0.12 + Math.sin(m * (ne === "type" ? 3.5 : 1.9) + p.phase) * 0.07),
            (D.y += 0.04 + Math.sin(m * 1.1 + p.phase) * 0.055)),
          ne === "sip" && [7, 9].includes(P))
        ) {
          let fe = Math.max(0, Math.sin(m * 0.55 + p.phase));
          ((D.y += fe * 0.42), (D.z += fe * 0.22));
        }
        T && [6, 8].includes(P) && ((D.y += 0.06 + Math.sin(m * 2.1) * 0.045), (D.z += 0.12));
      }
      if (p.tool) {
        let P = p.tool.o;
        ((P.x = p.x + p.tool.ox * R + p.tool.oz * N),
          (P.y = p.tool.oy + (x ? 0 : Math.sin(m * 1.9 + p.phase) * 0.05)),
          (P.z = p.z - p.tool.ox * N + p.tool.oz * R),
          (P.rotY = M),
          (P.hidden = !p.active));
      }
    }
    function g(u, p, m, y = {}) {
      let b = u.life;
      if (!b?.spec) return;
      let { cam: x = { x: 0, z: 12 }, reduced: T = !1, paused: v = !1, encounter: A = null, engaged: S = null } = y;
      v || (b.clock += p);
      let _ = b.clock;
      for (let k of b.spots) {
        v || (k.blend += (Number(k.state) - k.blend) * Math.min(1, p * 7));
        let E = T ? Number(k.state) : k.blend;
        for (let M of k.parts) {
          let R = M.o,
            N = M.role;
          if (
            ((R.x = k.x + M.ox),
            (R.y = M.by),
            (R.z = k.z + M.oz),
            (R.w = M.bw),
            (R.h = M.bh),
            (R.d = M.bd),
            (R.rotY = 0),
            (R.hidden = !1),
            N === "perch" && ((R.y += E * 0.04), (R.x -= E * 0.035)),
            N === "move")
          ) {
            k.family === "rail" && (R.x -= E * 0.42);
            let P = ["cabinet", "drawer"].includes(k.family) ? 0 : 0.34;
            ((R.x += E * P), (R.z += (1 - E) * (["cabinet", "drawer"].includes(k.family) ? 0.31 : 0)));
          }
          if (
            (N === "switch" && (R.rotY = E * Math.PI * 0.5),
            N === "fold" && ((R.y += E * 0.09), (R.d *= 1 - E * 0.18)),
            N.startsWith("slat") &&
              ((R.y += E * 0.08),
              (R.h *= 1 + E * 0.36),
              k.family === "curtain" && (R.x += E * 0.25),
              (R.rotY = E * 0.11)),
            N === "rotor" &&
              (R.rotY = T ? 0 : _ * (k.state ? (k.action.toLowerCase().includes("stop") ? 0 : 0.2) : 1.6) + k.phase),
            N === "hinge" && ((R.y += E * 0.055), (R.rotY = E * 0.28)),
            N === "tray" && ((R.z -= E * 0.12), (R.x += E * 0.13)),
            N === "paper" && (R.z += (T ? 0 : Math.sin(_ * 0.65 + k.phase) * 0.025) * (k.state ? 1 : 0.3)),
            N === "strap" && ((R.x -= E * 0.08), (R.y += E * 0.08)),
            N === "water" && ((R.y += E * 0.1), (R.w *= 0.94 + (T ? 0 : Math.sin(_ * 1.2) * 0.03))),
            N === "wipe" && (R.hidden = k.state),
            N === "lid" && (R.y += (1 - E) * 0.09),
            N === "contents" && (R.hidden = k.state),
            N === "light" || N === "pool")
          ) {
            let P = k.action.toLowerCase().includes("switch on");
            ((R.hidden = P && !k.state),
              (R.w = M.bw * (P ? 0.82 + E * 0.18 : 1 - E * 0.18)),
              N === "pool" && (R.d = M.bd * (P ? 0.8 + E * 0.2 : 1 - E * 0.2)),
              (R.lifeDim = P ? 0.16 + E * 0.84 : 1 - E * 0.42));
          }
          if (
            (N === "signal" &&
              ((R.w = M.bw * (0.48 + (T ? 0.48 : Math.sin(_ * 1.4 + k.phase) * 0.18 + 0.3))),
              (R.lifeDim = k.state ? 0.8 : 1)),
            N.startsWith("steam"))
          ) {
            let P = Number(N.slice(5)),
              D = (((_ * 0.27 + P * 0.22) % 1) + 1) % 1;
            ((R.hidden = T),
              (R.y = M.by + D * 0.49),
              (R.x += Math.sin(_ + P) * 0.065),
              (R.w = M.bw * (0.5 + D)),
              (R.d = M.bd * (0.5 + D)));
          }
          if (N.startsWith("drip")) {
            let P = Number(N.slice(4));
            ((R.hidden = T || (k.family === "valve" && k.state)),
              (R.y = M.by - ((_ * 1.1 + P * 0.21) % 1) * 0.31),
              (R.x += k.family === "bucket" ? 0.36 : 0));
          }
          if (N.startsWith("bubble")) {
            let P = Number(N.slice(6));
            ((R.y = 1.08 + ((_ * 0.3 + P * 0.23) % 1) * 0.65), (R.hidden = T));
          }
          if (N.startsWith("swim")) {
            let P = Number(N.slice(4));
            ((R.x = k.x + M.ox + (T ? 0 : Math.sin(_ * 0.6 + P * 0.4) * 0.07)),
              (R.z = k.z + M.oz + (T ? 0 : Math.sin(_ * 0.9 + P * 0.4) * 0.06)));
          }
          if (
            (["bird", "birdhead", "beak", "wing", "eye"].includes(N) &&
              ((R.y += T ? 0 : Math.sin(_ * 1.8 + k.phase) * 0.012),
              N === "birdhead" && (R.rotY = T ? 0 : Math.sin(_ * 0.5) * 0.34)),
            ["body", "head", "arm", "key"].includes(N) && k.family === "toy")
          ) {
            let P = k.action.toLowerCase().includes("stop") ? !k.state : k.state;
            ((R.x += P && !T ? Math.sin(_ * 0.65) * 0.17 : 0),
              N === "key" && (R.rotY = E * Math.PI * 0.5),
              N === "arm" && (R.y += E * 0.1 + (P && !T ? Math.max(0, Math.sin(_ * 1.8)) * 0.32 : 0)));
          }
          (N === "cable" && ((R.x += E * 0.28), (R.z *= 1), (R.y -= E * 0.05)),
            N === "ball" && (R.x += E * 0.65),
            N === "sway" && ((R.x += E * 0.075), T || (R.x += Math.sin(_ * 0.7 + k.phase) * 0.018)),
            N === "hand" && !T && (R.rotY = _ * 0.06));
        }
      }
      for (let k of b.effects) {
        if (k.kind === "ripple") {
          let E = (_ * 0.65 + k.phase) % 1;
          ((k.o.x = k.x + E * 0.13), (k.o.z = k.z + E * 0.13), (k.o.w = 0.03 + E * 0.16), (k.o.hidden = T || E > 0.86));
        }
        if (k.kind === "steam") {
          let E = (_ * 0.19 + k.phase) % 1;
          ((k.o.x = k.x + Math.sin(_ * 0.55 + k.phase) * 0.13),
            (k.o.y = 0.12 + E * 1.05),
            (k.o.w = 0.12 + E * 0.22),
            (k.o.hidden = T));
        }
        k.kind === "fan" && (k.o.rotY = T ? k.phase : _ * 0.45 + k.phase);
      }
      for (let k of b.support) {
        let E = k.person,
          M = Math.hypot(x.x - k.x, x.z - k.z),
          R = !1;
        if (
          !v &&
          !T &&
          k.active &&
          ["walk", "carry", "sweep"].includes(E.job) &&
          ((k.pause = Math.max(0, (k.pause || 0) - p)), k.pause === 0 && M > 1.4)
        ) {
          let N = k.route[k.routeIndex],
            P = N.x - k.x,
            D = N.z - k.z,
            q = Math.hypot(P, D);
          if (q < 0.16) ((k.routeIndex = 1 - k.routeIndex), (k.pause = 2.2));
          else {
            let K = E.job === "sweep" ? 0.19 : 0.43,
              ee = k.x + (P / q) * K * p,
              Z = k.z + (D / q) * K * p;
            u.collides(ee, Z, 0.19)
              ? ((k.routeIndex = 1 - k.routeIndex), (k.pause = 1.2))
              : ((k.x = ee), (k.z = Z), (R = !0), (k.facing = Math.atan2(P, D)));
          }
        }
        ((k.y = 0), f(u, k, _, R, x, T, S === k.lifeName, v));
      }
      for (let k of u.actors)
        k === A?.enemy || k.lifeSupporting || (k.lifeControlled && f(u, k, _, !1, x, T, S === k.lifeStep, v));
    }
    return { PROP_MODELS: s, addSceneLife: h, setLifeStates: d, animateSceneLife: g };
  })(),
  { installLivingSystems: oX, cleanLifeState: Q3 } = (() => {
    function a(t, s) {
      let i = { states: {}, seen: [], heard: [], log: [] },
        r = new Set(),
        n = new Set(),
        o = new Set();
      for (let [l, c] of Object.entries(s)) {
        for (let h of c.props) (n.add(l + ":" + h.id), r.add(h.memory || l + ":" + h.id));
        for (let h of c.cues) o.add(l + ":" + h.id);
        for (let h = 0; h < c.people.length; h++) o.add(l + ":person-" + h);
      }
      if (!t || typeof t != "object") return i;
      if (t.states && typeof t.states == "object")
        for (let [l, c] of Object.entries(t.states)) r.has(l) && typeof c == "boolean" && (i.states[l] = c);
      for (let [l, c] of [
        ["seen", n],
        ["heard", o],
      ])
        Array.isArray(t[l]) && (i[l] = [...new Set(t[l].filter((h) => typeof h == "string" && c.has(h)))]);
      return (
        Array.isArray(t.log) &&
          (i.log = t.log
            .filter(
              (l) =>
                l &&
                typeof l == "object" &&
                Object.hasOwn(s, l.scene) &&
                typeof l.text == "string" &&
                typeof l.who == "string",
            )
            .slice(-650)
            .map((l) => ({
              scene: l.scene,
              who: l.who.slice(0, 100),
              text: l.text.slice(0, 700),
              kind: l.kind === "action" ? "action" : "heard",
              id: typeof l.id == "string" ? l.id.slice(0, 160) : "",
            }))),
        i
      );
    }
    function e(t, { SCENES: s, SCENE_LIFE: i, project: r, setLifeStates: n, animateSceneLife: o }) {
      let l = t.prototype,
        c = {},
        h = (m) => document.getElementById(m),
        d = (m) =>
          String(m ?? "").replace(
            /[&<>"']/g,
            (y) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[y],
          );
      for (let m of [
        "bind",
        "loadScene",
        "showMenu",
        "interact",
        "updateMarkers",
        "finishNode",
        "journal",
        "addJournalTabs",
        "settings",
        "showCredits",
        "applyPrefs",
        "expandedGuide",
        "about",
        "savePrefs",
      ])
        c[m] = l[m];
      let f = (m, y, b) => Math.max(y, Math.min(b, m)),
        g = {};
      for (let m of Object.values(i)) for (let y of m.props) y.memory && (g[y.memory] = (g[y.memory] || 0) + 1);
      let u = new Set(Object.keys(g).filter((m) => g[m] > 1)),
        p = (m) =>
          ({
            bowl: "water",
            water: "water",
            valve: "water",
            bucket: "water",
            ice: "water",
            towel: "cloth",
            glove: "cloth",
            coat: "cloth",
            curtain: "cloth",
            awning: "cloth",
            blinds: "cloth",
            newspaper: "paper",
            printer: "paper",
            sign: "paper",
            owl: "bird",
            bird: "bird",
            fan: "motor",
            vent: "motor",
            projector: "motor",
            radio: "motor",
            bell: "bell",
            piano: "keys",
            drawer: "wood",
            cabinet: "wood",
            chair: "wood",
            billiard: "wood",
            mirror: "metal",
            rail: "metal",
            clock: "metal",
            cart: "metal",
            toy: "metal",
          })[m] || "switch";
      ((l.bind = function () {
        if ((c.bind.call(this), !h("life-caption"))) {
          let m = document.createElement("aside");
          ((m.id = "life-caption"),
            m.setAttribute("aria-live", "polite"),
            (m.innerHTML = '<span id="life-speaker"></span><p id="life-line"></p>'),
            h("hud").append(m));
          let y = document.createElement("aside");
          ((y.id = "detail-focus"),
            (y.hidden = !0),
            (y.innerHTML =
              '<span class="detail-tag">LOCAL DETAIL / OPTIONAL</span><strong id="detail-name"></strong><p id="detail-line"></p>'),
            h("hud").append(y));
          let b = document.createElement("button");
          ((b.id = "life-counter"),
            b.setAttribute("aria-label", "Open local scene details"),
            (b.innerHTML = "\u25C8 <span>0 / 3</span>"),
            h("hud").append(b));
          let x = -1 / 0;
          (b.addEventListener("pointerdown", (T) => {
            T.pointerType === "touch" && (T.preventDefault(), (x = performance.now()), this.journal("life"));
          }),
            (b.onclick = () => {
              performance.now() - x > 600 && this.journal("life");
            }));
        }
      }),
        (l.applyPrefs = function () {
          (c.applyPrefs.call(this),
            this.prefs.captions === void 0 && (this.prefs.captions = !0),
            this.prefs.detailHints === void 0 && (this.prefs.detailHints = !0));
        }),
        (l.resetLife = function () {
          ((this.state.life ??= a(null, i)),
            (this.localCaption = null),
            (this.lifeCueCooldown = 2),
            (this.lastLifeSound = 0),
            (this.lifeFootDistance = 0),
            (this.lifeLastPosition = { x: this.cam.x, z: this.cam.z }),
            (this.lifeAccent = 8),
            n(this.world, this.state),
            this.audio.setScene?.(this.world.life?.spec?.sound || "rain"),
            h("life-caption") && (h("life-caption").classList.remove("visible"), (h("detail-focus").hidden = !0)));
        }),
        (l.loadScene = function (m, y = {}) {
          if ((c.loadScene.call(this, m, y), this.resetLife(), this.overlay === "intro")) {
            let b = document.createElement("p");
            ((b.className = "life-intro"),
              (b.textContent =
                (this.world.life?.spec?.air || "") +
                " Local objects are optional. Face an object and press E or tap. V opens its notes."),
              h("modal-actions").before(b));
          }
        }),
        (l.showMenu = function () {
          (c.showMenu.call(this), this.resetLife(), h("life-counter") && (h("life-counter").hidden = !0));
        }),
        (l.lifeRecord = function (m, y, b, x = "heard") {
          let T = this.state.life;
          !T ||
            T.log.some((v) => v.id === m) ||
            (T.log.push({ id: m, scene: this.scene.key, who: y, text: b, kind: x }),
            T.log.length > 650 && T.log.shift());
        }),
        (l.sayLocal = function (m, y, { id: b = null, kind: x = "heard", force: T = !1 } = {}) {
          return !T && (this.localCaption?.remaining > 0 || this.lifeCueCooldown > 0)
            ? !1
            : ((this.localCaption = { who: m, text: y, remaining: f(3.4 + y.length * 0.031, 5, 9) }),
              (this.lifeCueCooldown = 3),
              b &&
                (this.lifeRecord(b, m, y, x),
                x === "heard" && !this.state.life.heard.includes(b) && this.state.life.heard.push(b),
                this.save()),
              !0);
        }),
        (l.useLifeDetail = function (m) {
          if (!m || !this.inGame || this.overlay || this.encounter) return !1;
          ((this.toastTime = 0), h("toast").classList.remove("visible"));
          let y = this.state.life,
            b = m.memory || m.detailId,
            x = !!y.states[b],
            T = !y.seen.includes(m.detailId);
          (x && !m.undo ? (m.state = !0) : ((m.state = !x), (y.states[b] = m.state)),
            (m.seen = !0),
            T && y.seen.push(m.detailId));
          let v = m.state ? m.after : m.before;
          return (
            T && this.lifeRecord(m.detailId, m.name, v, "action"),
            this.sayLocal(m.name.toUpperCase(), v, { force: !0 }),
            this.audio.localSound?.(p(m.model), this.lifePan(m), 0.8),
            m.model === "piano" && !this.prefs.reducedMotion && this.audio.note?.(0),
            this.save(),
            this.updateMarkers(this.simTime),
            !0
          );
        }),
        (l.interact = function () {
          if (this.nearby?.life && !this.overlay) {
            this.useLifeDetail(this.nearby);
            return;
          }
          c.interact.call(this);
        }),
        (l.lifePan = function (m) {
          let y = m.x - this.cam.x,
            b = m.z - this.cam.z;
          return f((y * Math.cos(this.cam.yaw) - b * Math.sin(this.cam.yaw)) / 6, -0.9, 0.9);
        }),
        (l.lifeVisible = function (m) {
          let y = m.x - this.cam.x,
            b = m.z - this.cam.z,
            x = Math.hypot(y, b);
          for (let T = 0.4; T < x - 0.35; T += 0.4) {
            let v = this.cam.x + (y * T) / x,
              A = this.cam.z + (b * T) / x;
            if (
              this.world.obstacles.some(
                (S) =>
                  S.lifeOwner !== m.id &&
                  !S.hidden &&
                  S.h > 0.8 &&
                  Math.abs(v - S.x) < S.w / 2 &&
                  Math.abs(A - S.z) < S.d / 2,
              )
            )
              return !1;
          }
          return !0;
        }),
        (l.updateMarkers = function (m) {
          c.updateMarkers.call(this, m);
          let y = h("detail-focus"),
            b = h("life-counter");
          if (!y) return;
          let x = this.world.life,
            T = !this.inGame || this.overlay || this.encounter || h("hud").hidden;
          // Each flag is decided once and written once, so nothing flips back and forth per frame.
          if ((b.hidden !== !!T && (b.hidden = !!T), T)) {
            (y.hidden || (y.hidden = !0), h("hud").classList.remove("has-local-focus"));
            return;
          }
          let v = (x?.spots || []).filter((_) => this.state.life?.seen.includes(_.detailId)).length;
          (setHTML(b, `\u25C8 <span>${v} / ${x?.spots.length || 3}</span>`),
            b.title || (b.title = "Local details. Optional. Open with V."));
          let A = null,
            S = 1 / 0;
          for (let _ of x?.spots || []) {
            let k = Math.hypot(_.x - this.cam.x, _.z - this.cam.z),
              E = r({ x: _.x, y: _.y, z: _.z }, this.cam, innerWidth, innerHeight);
            if (E.z < 0.2 || k > 8 || !this.lifeVisible(_)) continue;
            let M = Math.abs(E.x - innerWidth / 2) / innerWidth,
              R = Math.abs(E.y - innerHeight / 2) / innerHeight;
            if (
              (((this.scanTime > 0 && k < 8) || (k < 3.1 && M < 0.32 && this.prefs.detailHints !== !1)) &&
                E.x > 20 &&
                E.x < innerWidth - 20 &&
                E.y > 85 &&
                E.y < innerHeight - 130 &&
                (this.markerHTML += `<div class="local-dot ${_.seen ? "seen" : ""}" style="left:${E.x.toFixed(1)}px;top:${E.y.toFixed(1)}px"><i></i>${this.scanTime > 0 ? `<small>${d(_.name)}</small>` : ""}</div>`),
              k < 2.65 && M < 0.27 && R < 0.43)
            ) {
              let N = k + M * 4;
              N < S && ((A = _), (S = N));
            }
          }
          if (A && this.nearby && !this.nearby.life) {
            let _ = r({ x: this.nearby.x, y: this.nearby.y, z: this.nearby.z }, this.cam, innerWidth, innerHeight),
              k = Math.hypot(this.nearby.x - this.cam.x, this.nearby.z - this.cam.z);
            Math.abs(_.x - innerWidth / 2) < innerWidth * 0.14 && k < 2.3 && (A = null);
          }
          let F = !!A && !(this.mobile && this.prefs.captions !== !1 && this.localCaption?.remaining > 0);
          if ((y.hidden !== !F && (y.hidden = !F), h("hud").classList.toggle("has-local-focus", !!A), A)) {
            ((this.nearby = A),
              setText(h("detail-name"), A.name),
              setText(h("detail-line"), A.state ? A.after : A.before));
            let _ = A.state ? A.undo || "Examine " + A.name : A.action;
            ((this.promptDisabled = !1),
              (this.promptLocal = !0),
              (this.promptHTML = `<kbd>${this.keyHint("E")}</kbd><span>${d(_.toUpperCase())}</span><b>\u25C8</b>`));
          } else this.promptLocal = !1;
        }),
        (l.tickLife = function (m, y) {
          if (!this.world?.life) return;
          let b = this.inGame && !this.overlay && !this.encounter && !document.hidden && !h("hud").hidden,
            x = this.inGame && (!b || !!this.overlay);
          o(this.world, m, y, {
            cam: this.cam,
            reduced: this.prefs.reducedMotion,
            paused: x,
            encounter: this.encounter,
            engaged: this.overlay
              ? this.world.actors.find((A) => A.lifeStep === this.scene.steps[this.state.step]?.id)?.lifeStep
              : null,
          });
          let T = h("life-caption");
          if (!T) return;
          if (b) {
            ((this.lifeCueCooldown = Math.max(0, (this.lifeCueCooldown || 0) - m)),
              this.localCaption && (this.localCaption.remaining -= m),
              (this.lifeAccent = (this.lifeAccent ?? 8) - m),
              this.lifeAccent <= 0 &&
                (this.audio.sceneAccent?.(this.world.life.spec?.sound, 0.25 * Math.sin(y)),
                (this.lifeAccent = 10 + (this.state.scene % 6))));
            let A = this.lifeLastPosition || this.cam,
              S = Math.hypot(this.cam.x - A.x, this.cam.z - A.z);
            if ((S < 1 && (this.lifeFootDistance = (this.lifeFootDistance || 0) + S), this.lifeFootDistance > 1.4)) {
              this.lifeFootDistance = 0;
              let _ = this.world.day
                ? "step-wood"
                : this.world.outside
                  ? "step-wet"
                  : ["apartment", "hotel", "atrium"].includes(this.scene.env)
                    ? "step-wood"
                    : "step-metal";
              this.audio.localSound?.(_, Math.sin(y) * 0.1, this.crouchToggle ? 0.35 : 0.62);
            }
            if (
              (this.processLifeCues(), (this.lastLifeSound = (this.lastLifeSound || 0) + m), this.lastLifeSound > 2.3)
            ) {
              this.lastLifeSound = 0;
              let _ = this.world.life.spots.find(
                (k) =>
                  Math.hypot(k.x - this.cam.x, k.z - this.cam.z) < 5.5 &&
                  (!k.state || k.model === "tank") &&
                  ["valve", "bucket", "water", "tank", "bird", "owl"].includes(k.model),
              );
              _ && this.audio.localSound?.(["bird", "owl"].includes(_.model) ? "bird" : "water", this.lifePan(_), 0.28);
            }
          }
          this.lifeLastPosition = { x: this.cam.x, z: this.cam.z };
          let v = b && this.prefs.captions !== !1 && this.localCaption?.remaining > 0;
          (T.classList.toggle("visible", !!v),
            h("hud").classList.toggle("has-local-caption", !!v),
            v && this.mobile && (h("detail-focus").hidden = !0),
            v &&
              ((h("life-speaker").textContent = this.localCaption.who),
              (h("life-line").textContent = this.localCaption.text)));
        }),
        (l.processLifeCues = function () {
          let m = this.world.life,
            y = m?.spec,
            b = this.state.life?.heard;
          if (!(!y || !b || this.localCaption?.remaining > 0 || this.lifeCueCooldown > 0)) {
            for (let x of y.cues) {
              let T = this.scene.key + ":" + x.id;
              if (b.includes(T)) continue;
              if (
                x.trigger === "arrival"
                  ? m.clock > 4
                  : x.trigger === "near"
                    ? m.clock > 11 && m.spots.some((A) => Math.hypot(A.x - this.cam.x, A.z - this.cam.z) < 4.2)
                    : this.state.beats.length === this.scene.steps.length
              ) {
                this.sayLocal(x.speaker, x.text, { id: T });
                return;
              }
            }
            if (m.clock > 8)
              for (let [x, T] of y.people.entries()) {
                let v = m.support.find((S) => S.person?.name === T.name),
                  A = this.scene.key + ":person-" + x;
                if (v && T.line && !b.includes(A) && Math.hypot(v.x - this.cam.x, v.z - this.cam.z) < 3.1) {
                  this.sayLocal(T.name.toUpperCase(), T.line, { id: A });
                  return;
                }
              }
          }
        }),
        (l.finishNode = function (m, y = {}) {
          let b = this.scene.key;
          if (
            (c.finishNode.call(this, m, y),
            this.scene.key === b && this.state.beats.length === this.scene.steps.length && this.overlay === "credits")
          ) {
            let x = i[b]?.cues.find((T) => T.trigger === "after");
            if (x) {
              let T = b + ":" + x.id;
              (this.lifeRecord(T, x.speaker, x.text),
                this.state.life.heard.includes(T) || this.state.life.heard.push(T),
                this.save());
            }
          }
        }),
        (l.addJournalTabs = function (m) {
          c.addJournalTabs.call(this, m);
          let y = h("modal").querySelector("nav.tabs");
          if (y && !y.querySelector('[data-tab="life"]')) {
            let b = document.createElement("button");
            ((b.dataset.tab = "life"),
              (b.textContent = "LIFE"),
              (b.className = m === "life" ? "active" : ""),
              (b.onclick = () => this.journal("life")),
              y.insertBefore(b, y.children[2] || null));
          }
        }),
        (l.journal = function (m = "board") {
          if (m !== "life") {
            if ((c.journal.call(this, m), m === "map")) {
              let T = document.createElement("section");
              ((T.className = "life-map-list"),
                (T.innerHTML =
                  "<h3>LOCAL DETAILS / OPTIONAL</h3>" +
                  (this.world.life?.spots || [])
                    .map(
                      (A) =>
                        `<p><b>${this.state.life.seen.includes(A.detailId) ? "\u2713" : "\u25C8"} ${d(A.name)}</b><span>${d(A.action)}</span></p>`,
                    )
                    .join("")),
                h("journal-content")?.append(T));
              let v = h("area-map");
              if (v) {
                let A = v.getContext("2d");
                A.fillStyle = "#e8c894";
                for (let S of this.world.life?.spots || [])
                  ((A.strokeStyle = "#e8c894"), A.strokeRect(256 + S.x * 20, 346 + S.z * 12, 8, 8));
              }
            }
            return;
          }
          (this.showModal(
            "The small things.",
            "Objects, sounds, and people you noticed. None are required to close the scene.",
            "LOCAL LIFE / SAVED WITH YOUR CASE",
            "journal",
            { wide: !0 },
          ),
            h("modal-actions").remove(),
            h("modal").insertAdjacentHTML("beforeend", '<div id="journal-content"></div>'),
            this.addJournalTabs("life"),
            this.state.finished &&
              !this.replay &&
              (h("modal").querySelector(".close").onclick = () => this.showCredits()));
          let y = this.state.life,
            b = this.world.life?.spots || [],
            x = y.log.slice(-45).reverse();
          h("journal-content").innerHTML =
            `<div class="life-summary"><div><b>${y.seen.length}</b><span>OBJECTS USED</span></div><div><b>${y.heard.length}</b><span>MOMENTS HEARD</span></div><div><b>${Object.keys(y.states).filter((T) => y.states[T] && u.has(T)).length}</b><span>SHARED ROOM CHANGES</span></div></div><h3 class="section-label">${d(this.scene.place)} / THREE OPTIONAL DETAILS</h3><div class="life-cards">${b.map((T) => `<article><small>${y.seen.includes(T.detailId) ? "NOTICED" : "NOT YET NOTICED"}${u.has(T.memory) ? " / PERSISTS ON RETURN" : ""}</small><h3>${d(T.name)}</h3><p>${d(T.state ? T.after : T.before)}</p><strong>${d(T.state ? T.undo || "Already set" : T.action)}</strong><span>Find this object in the room. Face it and press E or tap.</span></article>`).join("")}</div><h3 class="section-label">RECENT LOCAL RECORD</h3><div class="life-log">${x.length ? x.map((T) => `<article><small>${d(s.find((v) => v.key === T.scene)?.title || T.scene)} / ${d(T.kind.toUpperCase())}</small><h4>${d(T.who)}</h4><p>${d(T.text)}</p></article>`).join("") : "<p>Walk through a scene. Nearby objects have a small amber marker. Use SCAN to find them.</p>"}</div>`;
        }),
        (l.settings = function () {
          c.settings.call(this);
          let m = document.createElement("div");
          ((m.className = "life-settings"),
            (m.innerHTML =
              "<h3>LOCAL SCENE LIFE</h3><p>Ambient dialogue uses text captions. Local sounds are synthesized. No actor voices are included.</p>"));
          for (let [y, b] of [
            ["captions", "Ambient captions"],
            ["detailHints", "Nearby detail markers"],
          ]) {
            let x = document.createElement("button");
            ((x.className = "secondary"),
              (x.textContent = b + ": " + (this.prefs[y] !== !1 ? "ON" : "OFF")),
              x.setAttribute("aria-pressed", String(this.prefs[y] !== !1)),
              (x.onclick = () => {
                ((this.prefs[y] = this.prefs[y] === !1),
                  this.savePrefs(),
                  (x.textContent = b + ": " + (this.prefs[y] ? "ON" : "OFF")),
                  x.setAttribute("aria-pressed", String(this.prefs[y])));
              }),
              m.append(x));
          }
          h("modal-actions").before(m);
        }),
        (l.expandedGuide = function () {
          c.expandedGuide.call(this);
          let m = document.createElement("section");
          ((m.className = "guide-section"),
            (m.innerHTML =
              "<h3>LIVING SCENES / VERSION 3.0</h3><p>Every scene has three local objects. Walk close and face an object. Press E or tap to use it without opening a panel. SCAN reveals nearby objects. Their amber dots differ from green story leads.</p><p>Local work is optional. It gives no experience points and cannot replace required evidence. Some changes persist across scenes in the same room. The LIFE tab records your actions and heard captions. V opens it.</p><p>Supporting people follow short local routines and pause near you. The new audio is synthesized. Dialogue appears in captions, not recorded voices. Reduced motion stops cosmetic particles and reduces movement. Captions and nearby hints can be turned off separately.</p><p>Version 1 and 2 saves can be imported. New local details start unmarked. This version uses a separate automatic-save slot and does not overwrite the older slot.</p>"),
            h("journal-content").prepend(m));
        }),
        (l.about = function () {
          (c.about.call(this), (h("modal").querySelector(".modal-kicker").textContent = "VERSION 3.0 / LIVING SCENES"));
          let m = document.createElement("p");
          ((m.className = "modal-body"),
            (m.textContent =
              "71 scene-specific detail sets. 213 physical local interactions. Persistent room changes, supporting routines, distance-based sound, and original ambient captions."),
            h("modal-actions").before(m));
        }),
        (l.showCredits = function () {
          if ((c.showCredits.call(this), this.state.life)) {
            let m = document.createElement("p");
            ((m.className = "life-end"),
              (m.textContent = `You noticed ${this.state.life.seen.length} local objects and heard ${this.state.life.heard.length} small moments. These records remain in the LIFE tab.`),
              h("modal-actions").before(m));
          }
        }));
    }
    return { installLivingSystems: e, cleanLifeState: a };
  })(),
  {
    SCENES: Ve,
    ITEMS: W_,
    COVERAGE: lX,
    VK_QUESTIONS: W3,
    VERSION: cX,
    ROUTES: Of,
    ROUTE_META: hX,
    LEGACY_SCENES: j3,
    sceneIndex: Qr,
  } = (() => {
    let a = "5.0.0",
      e = [
        {
          key: "hades",
          title: "The city below",
          env: "roof",
          place: "HADES \u2022 FLIGHT CHANNEL",
          intro: "A furnace opens beneath the cloud. You are on a police transit flight. The night shift has begun.",
          anchor: "The city is established. The case then opens with Holden at the Tyrell interview desk.",
          steps: [
            {
              id: "channel",
              label: "Tune the city channel",
              kind: "tune",
              text: "Match the carrier and gain. The signal has to remain clear through the industrial interference.",
              target: [67, 42],
              result: "The police channel is clear. A test room at Tyrell is accepting a new employee.",
              item: "City channel log",
              requires: [],
              index: 0,
              position: [-3, -8],
            },
            {
              id: "airship",
              label: "Read the off-world advertisement",
              kind: "inspect",
              text: "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
              item: "Off-world advert",
              model: "sign",
              points: [
                { x: 0.24, y: 0.39, mode: "visible", label: "A paid offer of escape" },
                { x: 0.72, y: 0.61, mode: "infrared", label: "A list of entry conditions" },
                { x: 0.53, y: 0.25, mode: "ultraviolet", label: "Earth remains outside the warranty" },
              ],
              requires: ["channel"],
              index: 1,
              position: [4, -21],
            },
          ],
          optional: [],
          role: "Deckard",
          source: "shared",
          editions: ["draft", "final", "theatrical"],
          case: "PROLOGUE",
          time: "NIGHT",
          exit: "Continue the case",
          detail: "hades",
          legacy: null,
          id: 0,
          number: "01",
          sourceNote: "A story beat shared by the draft and film. The playable route is an adaptation.",
        },
        {
          key: "holden",
          title: "Before the rain",
          env: "office",
          place: "TYRELL \u2022 INTERVIEW ROOM",
          intro: "A new employee. An old test. The city has not yet heard the shot that will bring you back to work.",
          anchor: "The interview breaks down. Leon escapes; Holden survives on life support.",
          steps: [
            {
              id: "vk",
              label: "Calibrate the instrument",
              kind: "collect",
              text: "The bellows settle. A small screen enlarges an eye until it looks like a planet. The test measures a response, not a soul.",
              item: "Voight-Kampff instrument",
              index: 0,
              requires: [],
              position: [-4, -8],
            },
            {
              id: "baseline",
              label: "Set the optical baseline",
              kind: "tune",
              text: "Match the return signal before you begin. A saturated eye image gives a false reading.",
              target: [58, 64],
              result: "The test is ready. The baseline is kept with the interview.",
              item: "Test baseline",
              requires: ["vk"],
              index: 1,
              position: [4, -8],
            },
            {
              id: "leon",
              label: "Interview Leon",
              kind: "vk",
              text: "Keep the signal stable. Ask about care, memory, and responsibility. Your handling changes the quality of the recording, not what Leon does next.",
              subject: "Leon",
              result:
                "The readings lag behind the anger. A flash overwhelms the recorder. The emergency channel opens.",
              index: 2,
              requires: ["baseline"],
              position: [0, -16],
            },
          ],
          optional: [],
          role: "Holden",
          source: "draft",
          editions: ["draft", "final", "theatrical"],
          case: "PROLOGUE",
          time: "18:41",
          exit: "Continue the case",
          detail: "interview",
          legacy: 0,
          id: 1,
          number: "02",
          sourceNote: "A draft story beat. Gameplay and dialogue are newly written.",
        },
        {
          key: "noodles",
          title: "Two, not four",
          env: "street",
          place: "LOWER CITY \u2022 NOODLE ROW",
          intro:
            "Rain puts a shine on everything, even things that stopped being clean years ago. You came here for dinner. The department came here for you.",
          anchor: "Gaff escorts Deckard to police headquarters in a spinner.",
          steps: [
            {
              id: "counter",
              label: "Order at the counter",
              kind: "talk",
              text: "The counterman slides a steaming bowl beneath the awning. A small portion is apparently the only portion on the menu.",
              options: [
                {
                  label: "Take the two. It is a long night.",
                  text: "The noodles are hot. You remember being hungry.",
                  effect: { health: 15, empathy: 1 },
                },
                {
                  label: "Try to order four, one more time.",
                  text: "Two pieces arrive. The counterman has won this round.",
                  effect: { health: 15, insight: 1 },
                },
              ],
              index: 0,
              requires: [],
              position: [-2.8, 6.5],
            },
            {
              id: "news",
              label: "Inspect the discarded news sheet",
              kind: "inspect",
              text: "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
              item: "Night-shift clipping",
              model: "paper",
              points: [
                { x: 0.24, y: 0.39, mode: "visible", label: "An old off-world departure date" },
                { x: 0.72, y: 0.61, mode: "infrared", label: "A changed freight route" },
                { x: 0.53, y: 0.25, mode: "ultraviolet", label: "A repair stall advertisement" },
              ],
              requires: [],
              index: 1,
              position: [3.1, -1],
            },
            {
              id: "gaff",
              label: "Hear Gaff out",
              kind: "talk",
              text: "The man in the immaculate coat shows a badge. You do not need a translation for the name Bryant.",
              options: [
                {
                  label: "Ask whether Holden is alive.",
                  text: "You give the person, rather than the case, a little room.",
                  effect: { empathy: 2 },
                },
                { label: "Ask what changed.", text: "The useful details go into the record.", effect: { insight: 2 } },
                {
                  label: "Make Gaff show the order.",
                  text: "A sharper approach gets an answer, but leaves a mark.",
                  effect: { pressure: 2 },
                },
              ],
              index: 2,
              requires: ["news"],
              position: [-3, -9],
            },
          ],
          optional: [
            {
              id: "sheep",
              label: "Repair the stray electric sheep",
              text: "A discarded toy bleats from a drain. Match the three power channels to its service label. Someone once thought this was a pet.",
              kind: "circuit",
              optional: !0,
              item: "Electric sheep",
              quest: "Small mercies",
              target: [1, 0, 1],
              reward: "A quiet bleat, and one less abandoned thing.",
              source: "original",
              position: [-5, 10.3],
            },
            {
              id: "token",
              label: "Return a ration token",
              text: "A courier searches the gutter. Their token is caught under a stool.",
              kind: "talk",
              optional: !0,
              item: "Courier favour",
              quest: "Dinner for somebody",
              options: [
                {
                  label: "Give it back.",
                  text: "The courier promises to keep a path clear if you ever need one.",
                  effect: { empathy: 3 },
                },
                {
                  label: "Trade it for a street tip.",
                  text: "You learn which storefront shutters open from the alley.",
                  effect: { insight: 2 },
                },
              ],
              source: "original",
              position: [5.2, 10.3],
            },
            {
              id: "menu",
              label: "Read the night menu",
              kind: "inspect",
              text: "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
              item: "Night menu",
              model: "sign",
              points: [
                { x: 0.24, y: 0.39, mode: "visible", label: "A ration price" },
                { x: 0.72, y: 0.61, mode: "infrared", label: "A closed breakfast service" },
                { x: 0.53, y: 0.25, mode: "ultraviolet", label: "A handwritten extra" },
              ],
              optional: !0,
              quest: "Read the night menu",
              source: "original",
              position: [-5, 4.300000000000001],
            },
          ],
          role: "Deckard",
          source: "draft",
          editions: ["draft", "final", "theatrical"],
          case: "01 / THE RECALL",
          time: "21:08",
          exit: "Continue the case",
          detail: "noodles",
          legacy: 1,
          id: 2,
          number: "03",
          sourceNote: "A draft story beat. Gameplay and dialogue are newly written.",
        },
        {
          key: "spinner-recall",
          title: "A seat beside Gaff",
          env: "roof",
          place: "SPINNER \u2022 POLICE APPROACH",
          intro:
            "Gaff takes the controls. The street drops below the canopy. A borrowed badge is waiting at the other end.",
          anchor: "Gaff lands at police headquarters. Deckard goes inside to meet Bryant.",
          steps: [
            {
              id: "radio",
              label: "Clear the landing channel",
              kind: "tune",
              text: "Keep the landing call separate from the advertisement signal.",
              target: [67, 42],
              result: "The tower assigns a pad. Gaff brings the spinner down.",
              item: "Police approach clearance",
              requires: [],
              index: 0,
              position: [-2.8, 6.5],
            },
            {
              id: "fold",
              label: "Inspect the folded paper",
              kind: "inspect",
              text: "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
              item: "Paper-fold observation",
              model: "origami",
              points: [
                { x: 0.24, y: 0.39, mode: "visible", label: "A sharp crease" },
                { x: 0.72, y: 0.61, mode: "infrared", label: "A loose corner" },
                { x: 0.53, y: 0.25, mode: "ultraviolet", label: "Paper taken from an ordinary wrapper" },
              ],
              requires: ["radio"],
              index: 1,
              position: [3.1, -1],
            },
          ],
          optional: [],
          role: "Deckard",
          source: "shared",
          editions: ["draft", "final", "theatrical"],
          case: "01 / THE RECALL",
          time: "21:08",
          exit: "Continue the case",
          detail: "spinner",
          legacy: 1,
          id: 3,
          number: "04",
          sourceNote: "A story beat shared by the draft and film. The playable route is an adaptation.",
        },
        {
          key: "police-lobby",
          title: "The night desk",
          env: "office",
          place: "POLICE HEADQUARTERS \u2022 CONCOURSE",
          intro: "The lifts run without a break. Each counter has a queue. Yours ends at Bryant\u2019s office.",
          anchor: "Deckard reaches Bryant. The department has kept his old file.",
          steps: [
            {
              id: "desklog",
              label: "Read the duty ledger",
              kind: "inspect",
              text: "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
              item: "Duty ledger",
              model: "ledger",
              points: [
                { x: 0.24, y: 0.39, mode: "visible", label: "Holden is absent" },
                { x: 0.72, y: 0.61, mode: "infrared", label: "The case has no replacement" },
                { x: 0.53, y: 0.25, mode: "ultraviolet", label: "Your service number is still active" },
              ],
              requires: [],
              index: 0,
              position: [-2.8, 6.5],
            },
            {
              id: "records",
              label: "Open the sealed case wallet",
              kind: "sequence",
              text: "Check identity before opening. Record the seal before removing the file.",
              order: ["Check the case number", "Compare the seal", "Record the opening", "Remove the dossier"],
              result: "The wallet opens without breaking its evidence history.",
              item: "Case wallet",
              requires: ["desklog"],
              index: 1,
              position: [3.1, -1],
            },
          ],
          optional: [
            {
              id: "relay",
              label: "The cold relay",
              kind: "tune",
              text: "A forgotten recording has a readable return signal.",
              target: [38, 62],
              result: "The message concerns a lost delivery. It is not a secret character file.",
              item: "Unclaimed message",
              source: "original",
              optional: !0,
              quest: "The cold relay",
              position: [-5, 10.3],
            },
          ],
          role: "Deckard",
          source: "original",
          editions: ["draft", "final", "theatrical"],
          case: "01 / THE RECALL",
          time: "21:32",
          exit: "Continue the case",
          detail: "records",
          legacy: 2,
          id: 4,
          number: "05",
          sourceNote: "An original connecting investigation. It does not establish new film facts.",
        },
        {
          key: "bryant",
          title: "Borrowed badge",
          env: "office",
          place: "POLICE HEADQUARTERS \u2022 BRYANT\u2019S OFFICE",
          intro:
            "A badge on a desk can look a lot like a leash. Bryant has a file, a damaged colleague, and no intention of accepting your resignation.",
          anchor: "Deckard accepts the assignment and receives the Nexus-6 dossiers.",
          steps: [
            {
              id: "bryant",
              label: "Receive the assignment",
              kind: "talk",
              text: "A stolen shuttle. A breach at Tyrell. A test that did not keep Holden safe. Bryant wants the remaining fugitives found.",
              options: [
                {
                  label: "Ask why they came back.",
                  text: "You give the person, rather than the case, a little room.",
                  effect: { empathy: 2 },
                },
                {
                  label: "Review the infiltration report.",
                  text: "The useful details go into the record.",
                  effect: { insight: 2 },
                },
                {
                  label: "Ask why the count keeps changing.",
                  text: "A sharper approach gets an answer, but leaves a mark.",
                  effect: { pressure: 2 },
                },
              ],
              index: 0,
              requires: [],
              position: [-2.8, 6.5],
            },
            {
              id: "dossiers",
              label: "Review the dossier reels",
              kind: "collect",
              text: "Roy Batty, Leon, Pris, Zhora, and Mary appear in the files. Four-year lifespans turn the investigation into a countdown. The paperwork is not as consistent as Bryant pretends.",
              item: "Nexus-6 dossiers",
              index: 1,
              requires: ["bryant"],
              position: [3.1, -1],
            },
            {
              id: "chicken",
              label: "Inspect Gaff\u2019s paper figure",
              kind: "inspect",
              text: "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
              item: "Paper chicken",
              model: "origami",
              points: [
                { x: 0.24, y: 0.39, mode: "visible", label: "A bird shape" },
                { x: 0.72, y: 0.61, mode: "infrared", label: "A deliberate place on the desk" },
                { x: 0.53, y: 0.25, mode: "ultraviolet", label: "No written explanation" },
              ],
              requires: ["dossiers"],
              index: 2,
              position: [-3, -9],
            },
            {
              id: "blaster",
              label: "Sign out your equipment",
              kind: "collect",
              text: "A heavy service blaster, energy cassettes, an evidence wallet, and infrared goggles. Tools do not make the decisions that follow.",
              item: "Service blaster",
              index: 3,
              requires: ["chicken"],
              position: [2.8, -17],
            },
          ],
          optional: [
            {
              id: "mary",
              label: "Audit the missing name",
              text: "Mary has a dossier but no reliable chain of sightings in this draft. Keep the discrepancy open rather than inventing a victim or a resolution.",
              kind: "talk",
              optional: !0,
              item: "Unresolved manifest",
              quest: "The missing file",
              options: [
                {
                  label: "Flag the uncertainty.",
                  text: "The file stays open. An absence is not proof.",
                  effect: { insight: 3 },
                },
                {
                  label: "Make a private copy.",
                  text: "A copy goes into your own casebook, beyond Bryant\u2019s eraser.",
                  effect: { empathy: 2 },
                },
              ],
              source: "original",
              position: [-5, 10.3],
            },
          ],
          role: "Deckard",
          source: "draft",
          editions: ["draft", "final", "theatrical"],
          case: "01 / THE RECALL",
          time: "21:32",
          exit: "Continue the case",
          detail: "bryant",
          legacy: 2,
          id: 5,
          number: "06",
          sourceNote: "A draft story beat. Gameplay and dialogue are newly written.",
        },
        {
          key: "dossier-room",
          title: "Faces on the wall",
          env: "office",
          place: "POLICE HEADQUARTERS \u2022 RECORDS ROOM",
          intro: "The reels keep turning after Bryant leaves. Read them as evidence, not as a list of targets.",
          anchor: "The physical profiles and limited lifespans become part of Deckard\u2019s working case.",
          steps: [
            {
              id: "dates",
              label: "Audit the inception records",
              kind: "inspect",
              text: "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
              item: "Inception audit",
              model: "ledger",
              points: [
                { x: 0.24, y: 0.39, mode: "visible", label: "Several production dates" },
                { x: 0.72, y: 0.61, mode: "infrared", label: "Different assigned functions" },
                { x: 0.53, y: 0.25, mode: "ultraviolet", label: "A fixed service interval" },
              ],
              requires: [],
              index: 0,
              position: [-2.8, 6.5],
            },
            {
              id: "manifest",
              label: "Compare the manifest to the dossiers",
              kind: "deduce",
              text: "Select two pieces of evidence. Then choose the claim that both support. A reasonable guess is not enough.",
              evidence: ["Nexus-6 dossiers", "Inception audit"],
              claims: [
                "The profiles explain every absence.",
                "The files contain a count problem.",
                "A photograph proves a lifespan.",
              ],
              answer: 1,
              result: "The discrepancy stays open. No missing person is invented to make the count fit.",
              item: "Manifest discrepancy",
              requires: ["dates"],
              index: 1,
              position: [3.1, -1],
            },
          ],
          optional: [
            {
              id: "redact",
              label: "Recover a damaged ledger field",
              kind: "tune",
              text: "Tune the damaged field. The recovered text can identify a missing record, not a missing person.",
              target: [67, 42],
              result: "Only a missing entry is recovered. The case remains unresolved.",
              item: "Redacted ledger fragment",
              optional: !0,
              quest: "The incomplete ledger",
              source: "original",
              position: [-5, 10.3],
            },
            {
              id: "audit",
              label: "A paper trail with a hole",
              kind: "inspect",
              text: "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
              item: "Audit training note",
              model: "ledger",
              points: [
                { x: 0.24, y: 0.39, mode: "visible", label: "A missing field" },
                { x: 0.72, y: 0.61, mode: "infrared", label: "A known date" },
                { x: 0.53, y: 0.25, mode: "ultraviolet", label: "A gap that remains a gap" },
              ],
              optional: !0,
              quest: "A paper trail with a hole",
              source: "original",
              position: [5.2, 10.3],
            },
          ],
          role: "Deckard",
          source: "original",
          editions: ["draft", "final", "theatrical"],
          case: "01 / THE RECALL",
          time: "21:32",
          exit: "Continue the case",
          detail: "records",
          legacy: 2,
          id: 6,
          number: "07",
          sourceNote: "An original connecting investigation. It does not establish new film facts.",
        },
        {
          key: "hospital-one",
          title: "Artificial breathing",
          env: "hospital",
          place: "HOSPITAL \u2022 HOLDEN\u2019S ROOM",
          intro:
            "A breathing machine keeps time beside an unfinished book. Holden looks smaller than the warning he has become.",
          anchor:
            "Holden warns Deckard that the new replicants are difficult to distinguish; Deckard proceeds to Tyrell.",
          steps: [
            {
              id: "holden",
              label: "Talk to Holden",
              kind: "talk",
              text: "He remembers how ordinary Leon looked. The hospital lights make your reflection appear in the glass over his face.",
              options: [
                {
                  label: "Let him finish without interrupting.",
                  text: "You give the person, rather than the case, a little room.",
                  effect: { empathy: 2 },
                },
                {
                  label: "Ask which part of the test failed.",
                  text: "The useful details go into the record.",
                  effect: { insight: 2 },
                },
                {
                  label: "Press for a description of the weapon.",
                  text: "A sharper approach gets an answer, but leaves a mark.",
                  effect: { pressure: 2 },
                },
              ],
              index: 0,
              requires: [],
              position: [-2.8, 6.5],
            },
            {
              id: "record",
              label: "Take the damaged test recording",
              kind: "collect",
              text: "The record contains small delays, large uncertainty, and the sound of a room becoming an emergency. It will help you listen more carefully next time.",
              item: "Holden\u2019s recording",
              index: 1,
              requires: ["holden"],
              position: [3.1, -1],
            },
            {
              id: "breather",
              label: "Check the bedside controls",
              kind: "sequence",
              text: "Do not change medical settings. Read, check, call, then step back.",
              order: [
                "Read the alarm",
                "Check the connected tube",
                "Call the duty nurse",
                "Leave the controls with staff",
              ],
              result: "The nurse takes over. Your visit leaves the breathing support undisturbed.",
              item: "Hospital visit record",
              requires: ["record"],
              index: 2,
              position: [-3, -9],
            },
          ],
          optional: [
            {
              id: "book",
              label: "Bookmark Treasure Island",
              text: "Holden has lost his place. The screen scrolls faster than his breathing.",
              kind: "talk",
              optional: !0,
              item: "Bookmarked page",
              quest: "An unfinished chapter",
              options: [
                {
                  label: "Slow the reader and mark the page.",
                  text: "For a moment the room is a room, not a case file.",
                  effect: { empathy: 3, health: 10 },
                },
                {
                  label: "Read a little while he rests.",
                  text: "There is no tactical advantage. You do it anyway.",
                  effect: { empathy: 3 },
                },
              ],
              source: "original",
              position: [-5, 10.3],
            },
          ],
          role: "Deckard",
          source: "draft",
          editions: ["draft"],
          case: "01 / THE RECALL",
          time: "22:04",
          exit: "Continue the case",
          detail: "hospital",
          legacy: 3,
          id: 7,
          number: "08",
          sourceNote: "A draft story beat. Gameplay and dialogue are newly written.",
        },
        {
          key: "tyrell-flight",
          title: "Above the furnace",
          env: "roof",
          place: "HADES \u2022 TYRELL APPROACH",
          intro:
            "The spinner rises through a city of furnaces. Tyrell\u2019s pyramid catches a sun that never quite reaches the pavement.",
          anchor: "The spinner clears Tyrell security and lands at the pyramid.",
          steps: [
            {
              id: "flight",
              label: "Read the flight clearance",
              kind: "tune",
              text: "Set the receiver to the approach signal. Gaff remains the pilot.",
              target: [67, 42],
              result: "The city traffic separates from the Tyrell approach lane.",
              item: "Tyrell flight log",
              requires: [],
              index: 0,
              position: [-2.8, 6.5],
            },
            {
              id: "approach",
              label: "Stabilize the approach",
              kind: "timing",
              text: "Gaff flies; you handle the clearance transponder. Lock its pulse inside the marked band.",
              result: "The clearance light changes. Below you, the pyramid opens a landing channel.",
              index: 1,
              requires: ["flight"],
              position: [3.1, -1],
            },
            {
              id: "clearance",
              label: "Read the access display",
              kind: "collect",
              text: "Security protects the company from almost everything except the questions that people bring through the door.",
              item: "Tyrell visitor clearance",
              index: 2,
              requires: ["approach"],
              position: [-3, -9],
            },
          ],
          optional: [],
          role: "Deckard",
          source: "draft",
          editions: ["draft", "final", "theatrical"],
          case: "02 / MANUFACTURED MEMORY",
          time: "06:12",
          exit: "Continue the case",
          detail: "spinner",
          legacy: 4,
          id: 8,
          number: "09",
          sourceNote: "A draft story beat. Gameplay and dialogue are newly written.",
        },
        {
          key: "tyrell-ante",
          title: "The expensive bird",
          env: "tower",
          place: "TYRELL \u2022 OWL CHAMBER",
          intro: "Warm light fills a room above the haze. Rachael waits beside an artificial owl.",
          anchor: "Rachael leads Deckard to the test area. Tyrell requests a demonstration.",
          steps: [
            {
              id: "owl",
              label: "Examine the artificial owl",
              kind: "collect",
              text: "Its movements are exquisitely economical. Its price would buy a lot of real things the city no longer has.",
              item: "Artificial owl observation",
              index: 0,
              requires: [],
              position: [-2.8, 6.5],
            },
            {
              id: "reception",
              label: "Speak with Rachael",
              kind: "interview",
              text: "Choose each topic. Your manner changes the interview record. It does not reveal her test result in advance.",
              actor: "Rachael",
              topics: [
                {
                  label: "The owl",
                  ask: "Ask who looks after the bird.",
                  patient: "It has a keeper. Cost does not remove its need for care.",
                  precise: "The workshop records its maintenance.",
                  pressure: "She gives you the same fact, with less warmth.",
                },
                {
                  label: "The appointment",
                  ask: "Ask why Tyrell wants a demonstration.",
                  patient: "He wants to see your method before he accepts your result.",
                  precise: "He asked for a comparison test.",
                  pressure: "Your impatience does not change his schedule.",
                },
                {
                  label: "The room",
                  ask: "Ask about the view.",
                  patient: "She rarely goes down to the street.",
                  precise: "The glass filters the city light.",
                  pressure: "She turns back to the window.",
                },
              ],
              result: "The interview appointment begins.",
              item: "Rachael reception notes",
              requires: ["owl"],
              index: 1,
              position: [3.1, -1],
            },
          ],
          optional: [
            {
              id: "keeper",
              label: "Read the owl care card",
              kind: "inspect",
              text: "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
              item: "Owl care card",
              model: "ledger",
              points: [
                { x: 0.24, y: 0.39, mode: "visible", label: "Service intervals" },
                { x: 0.72, y: 0.61, mode: "infrared", label: "A keeper\u2019s initials" },
                { x: 0.53, y: 0.25, mode: "ultraviolet", label: "A replacement feather order" },
              ],
              optional: !0,
              quest: "Read the owl care card",
              source: "original",
              position: [-5, 10.3],
            },
          ],
          role: "Deckard",
          source: "shared",
          editions: ["draft", "final", "theatrical"],
          case: "02 / MANUFACTURED MEMORY",
          time: "06:28",
          exit: "Continue the case",
          detail: "owl",
          legacy: 5,
          id: 9,
          number: "10",
          sourceNote: "A story beat shared by the draft and film. The playable route is an adaptation.",
        },
        {
          key: "rachael-test",
          title: "More than a memory",
          env: "tower",
          place: "TYRELL PYRAMID \u2022 OBSERVATION ROOM",
          intro:
            "An owl turns its head. Rachael watches you watch it. Tyrell wants a demonstration before he gives you an answer.",
          anchor: "The extended test identifies Rachael as a replicant; Tyrell explains the implanted memories.",
          steps: [
            {
              id: "testbaseline",
              label: "Balance the response channel",
              kind: "tune",
              text: "Keep the iris signal below saturation. Compare reactions only after the return stabilizes.",
              target: [44, 71],
              result: "The instrument is ready for an extended test.",
              item: "Rachael baseline",
              requires: [],
              index: 0,
              position: [-2.8, 6.5],
            },
            {
              id: "rachael",
              label: "Test Rachael",
              kind: "vk",
              text: "The familiar questions are not enough. Her memories provide convincing explanations for reactions the instrument does not understand.",
              subject: "Rachael",
              result:
                "The extended reading converges. Tyrell confirms that the childhood she recalls belongs to somebody else.",
              index: 1,
              requires: ["testbaseline"],
              position: [3.1, -1],
            },
            {
              id: "tyrell",
              label: "Ask Tyrell about memory",
              kind: "talk",
              text: "He speaks of a person\u2019s past as if it were a component on a workbench.",
              options: [
                {
                  label: "Ask whether Rachael knows.",
                  text: "You give the person, rather than the case, a little room.",
                  effect: { empathy: 2 },
                },
                {
                  label: "Ask how implanted memory affects the test.",
                  text: "The useful details go into the record.",
                  effect: { insight: 2 },
                },
                {
                  label: "Challenge his definition of a product.",
                  text: "A sharper approach gets an answer, but leaves a mark.",
                  effect: { pressure: 2 },
                },
              ],
              index: 2,
              requires: ["rachael"],
              position: [-3, -9],
            },
          ],
          optional: [
            {
              id: "warranty",
              label: "Read the service disclaimer",
              text: "The warranty excludes distress arising from autobiographical inconsistency. Someone had to write that sentence.",
              kind: "collect",
              optional: !0,
              item: "Memory warranty",
              quest: "Terms of existence",
              source: "original",
              position: [-5, 10.3],
            },
          ],
          role: "Deckard",
          source: "draft",
          editions: ["draft", "final", "theatrical"],
          case: "02 / MANUFACTURED MEMORY",
          time: "06:28",
          exit: "Continue the case",
          detail: "interview",
          legacy: 5,
          id: 10,
          number: "11",
          sourceNote: "A draft story beat. Gameplay and dialogue are newly written.",
        },
        {
          key: "hotel-corridor",
          title: "The room at the end",
          env: "hotel",
          place: "HUNTERWASSER \u2022 CORRIDOR",
          intro:
            "A narrow corridor carries the sound of a television through several doors. Gaff waits while you check the number.",
          anchor: "Deckard and Gaff enter Leon\u2019s room. The search begins.",
          steps: [
            {
              id: "register",
              label: "Check the room register",
              kind: "inspect",
              text: "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
              item: "Hotel register",
              model: "ledger",
              points: [
                { x: 0.24, y: 0.39, mode: "visible", label: "Room 1187" },
                { x: 0.72, y: 0.61, mode: "infrared", label: "A recent occupancy entry" },
                { x: 0.53, y: 0.25, mode: "ultraviolet", label: "No verified forwarding address" },
              ],
              requires: [],
              index: 0,
              position: [-2.8, 6.5],
            },
            {
              id: "entry",
              label: "Enter without mixing the evidence",
              kind: "sequence",
              text: "Confirm the location before entry. Record the door before opening it.",
              order: ["Confirm the room", "Note the door condition", "Open the room", "Start the search log"],
              result: "The room is entered and the search log begins.",
              item: "Room entry record",
              requires: ["register"],
              index: 1,
              position: [3.1, -1],
            },
          ],
          optional: [
            {
              id: "label",
              label: "An address rubbed away",
              kind: "tune",
              text: "An old label has lost its printed return address.",
              target: [65, 35],
              result: "The luggage can be returned without opening it.",
              item: "Restored luggage label",
              source: "original",
              optional: !0,
              quest: "An address rubbed away",
              position: [-5, 10.3],
            },
          ],
          role: "Deckard",
          source: "original",
          editions: ["draft", "final", "theatrical"],
          case: "02 / MANUFACTURED MEMORY",
          time: "20:17",
          exit: "Continue the case",
          detail: "corridor",
          legacy: 6,
          id: 11,
          number: "12",
          sourceNote: "An original connecting investigation. It does not establish new film facts.",
        },
        {
          key: "leon-bedroom",
          title: "A carefully kept room",
          env: "hotel",
          place: "HUNTERWASSER HOTEL \u2022 ROOM & BATHROOM",
          intro:
            "A small room, kept unexpectedly neat. Someone tried to make a life here and had to leave it all behind.",
          anchor: "Deckard finds Leon\u2019s photographs. The search moves to the bathroom and floor.",
          steps: [
            {
              id: "goggles",
              label: "Use the infrared goggles",
              kind: "collect",
              text: "The bathroom cabinet is empty. Under infrared, your own face in the mirror looks as unfamiliar as the room.",
              item: "Infrared goggles",
              index: 0,
              requires: [],
              position: [-2.8, 6.5],
            },
            {
              id: "photos",
              label: "Examine the coat photographs",
              kind: "inspect",
              text: "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
              item: "Leon\u2019s photographs",
              model: "photo",
              points: [
                { x: 0.24, y: 0.39, mode: "visible", label: "A series of ordinary rooms" },
                { x: 0.72, y: 0.61, mode: "infrared", label: "A figure at the edge of a frame" },
                { x: 0.53, y: 0.25, mode: "ultraviolet", label: "A reflective surface behind the subject" },
              ],
              requires: ["goggles"],
              index: 1,
              position: [3.1, -1],
            },
            {
              id: "wardrobe",
              label: "Inspect the wardrobe",
              kind: "inspect",
              text: "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
              item: "Wardrobe observation",
              model: "cabinet",
              points: [
                { x: 0.24, y: 0.39, mode: "visible", label: "Neatly hung clothing" },
                { x: 0.72, y: 0.61, mode: "infrared", label: "An unused hanger" },
                { x: 0.53, y: 0.25, mode: "ultraviolet", label: "Dust disturbed beside the door" },
              ],
              requires: ["goggles"],
              index: 2,
              position: [-3, -9],
            },
          ],
          optional: [
            {
              id: "envelope",
              label: "Keep the photographs together",
              text: "Evidence labels would be easier if you separated everything. A handwritten arrangement suggests the order mattered to Leon.",
              kind: "talk",
              optional: !0,
              item: "Preserved photo sequence",
              quest: "Someone\u2019s album",
              options: [
                {
                  label: "Preserve the original order.",
                  text: "The album remains an album inside the evidence sleeve.",
                  effect: { empathy: 3, insight: 1 },
                },
                {
                  label: "Index the backs before filing.",
                  text: "The original sequence is recorded, then preserved.",
                  effect: { insight: 3 },
                },
              ],
              source: "original",
              position: [-5, 10.3],
            },
          ],
          role: "Deckard",
          source: "draft",
          editions: ["draft", "final", "theatrical"],
          case: "02 / MANUFACTURED MEMORY",
          time: "20:17",
          exit: "Continue the case",
          detail: "bedroom",
          legacy: 6,
          id: 12,
          number: "13",
          sourceNote: "A draft story beat. Gameplay and dialogue are newly written.",
        },
        {
          key: "leon-bathroom",
          title: "Something in the grout",
          env: "hotel",
          place: "HUNTERWASSER \u2022 BATHROOM",
          intro: "The sink is clean. The small floor catches more light than it should. Keep the samples separate.",
          anchor: "Deckard collects the flakes and leaves with the photographs. Leon observes the police from outside.",
          steps: [
            {
              id: "cabinet",
              label: "Examine the medicine cabinet",
              kind: "inspect",
              text: "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
              item: "Clean cabinet observation",
              model: "cabinet",
              points: [
                { x: 0.24, y: 0.39, mode: "visible", label: "A wiped shelf" },
                { x: 0.72, y: 0.61, mode: "infrared", label: "No medicine labels" },
                { x: 0.53, y: 0.25, mode: "ultraviolet", label: "Your reflected goggles" },
              ],
              requires: [],
              index: 0,
              position: [-2.8, 6.5],
            },
            {
              id: "scale",
              label: "Collect and inspect the flake",
              kind: "inspect",
              text: "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
              item: "Unidentified scale",
              model: "scale",
              points: [
                { x: 0.24, y: 0.39, mode: "visible", label: "A flexible edge" },
                { x: 0.72, y: 0.61, mode: "infrared", label: "An organic pattern" },
                { x: 0.53, y: 0.25, mode: "ultraviolet", label: "A faint manufactured mark" },
              ],
              requires: [],
              index: 1,
              position: [3.1, -1],
            },
            {
              id: "room-link",
              label: "Separate evidence from assumption",
              kind: "deduce",
              text: "Select two pieces of evidence. Then choose the claim that both support. A reasonable guess is not enough.",
              evidence: ["Leon\u2019s photographs", "Unidentified scale"],
              claims: [
                "The photograph identifies the scale species.",
                "The room proves that Leon acted alone.",
                "The image and sample need separate analysis.",
              ],
              answer: 2,
              result: "The image goes to the Esper. The scale needs a physical comparison.",
              requires: ["cabinet", "scale"],
              item: "Hotel search conclusion",
              index: 2,
              position: [-3, -9],
            },
          ],
          optional: [],
          role: "Deckard",
          source: "draft",
          editions: ["draft", "final", "theatrical"],
          case: "02 / MANUFACTURED MEMORY",
          time: "20:17",
          exit: "Continue the case",
          detail: "bathroom",
          legacy: 6,
          id: 13,
          number: "14",
          sourceNote: "A draft story beat. Gameplay and dialogue are newly written.",
        },
        {
          key: "leon-window",
          title: "A room you cannot enter",
          env: "street",
          place: "HUNTERWASSER \u2022 STREET BELOW",
          intro:
            "You are Leon. Light moves in the window of the room you left behind. The photographs are no longer private.",
          anchor: "Leon sees the police at his room and leaves. He and Roy continue to Chew.",
          steps: [
            {
              id: "window",
              label: "Watch the window",
              kind: "inspect",
              text: "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
              item: "Window sighting",
              model: "sign",
              points: [
                { x: 0.24, y: 0.39, mode: "visible", label: "A police coat" },
                { x: 0.72, y: 0.61, mode: "infrared", label: "Photographs in another hand" },
                { x: 0.53, y: 0.25, mode: "ultraviolet", label: "The room number above the entry" },
              ],
              requires: [],
              index: 0,
              position: [-2.8, 6.5],
            },
            {
              id: "withdraw",
              label: "Leave the entrance unwatched",
              kind: "stealth",
              text: "Stay outside the moving search light. Walk through the three safe points. Running makes more noise.",
              result: "Leon withdraws without entering the hotel. The room and its evidence stay with the police.",
              requires: ["window"],
              index: 1,
              position: [3.1, -1],
            },
          ],
          optional: [],
          role: "Leon",
          source: "draft",
          editions: ["draft", "final", "theatrical"],
          case: "02 / MANUFACTURED MEMORY",
          time: "20:17",
          exit: "Continue the case",
          detail: "hotel-exterior",
          legacy: 6,
          id: 14,
          number: "15",
          sourceNote: "A draft story beat. Gameplay and dialogue are newly written.",
        },
        {
          key: "chew",
          title: "Just eyes",
          env: "lab",
          place: "HANNIBAL CHEW \u2022 CRYOGENIC WORKSHOP",
          intro:
            "Elsewhere, the people being hunted conduct an investigation of their own. Cold vapour clings to every surface in Chew\u2019s workshop.",
          anchor: "Chew names Sebastian as the route to Tyrell. Roy and Leon leave to find him.",
          steps: [
            {
              id: "eyes",
              label: "Inspect the eye tanks",
              kind: "collect",
              text: "A thousand unfinished gazes float in solution. Leon refuses to be stared down by any of them.",
              item: "Nexus eye design",
              index: 0,
              requires: [],
              position: [-2.8, 6.5],
            },
            {
              id: "tank",
              label: "Read the eye-tank service signal",
              kind: "tune",
              text: "Separate the cooler alarm from the identity data. No setting here can extend a lifespan.",
              target: [71, 36],
              result: "The design reference is readable. The tank remains sealed.",
              item: "Eye-tank service code",
              requires: ["eyes"],
              index: 1,
              position: [3.1, -1],
            },
            {
              id: "chew",
              label: "Question Chew",
              kind: "talk",
              text: "He made eyes, not lifespans. There is fear in his answer and a name behind the fear: J. F. Sebastian.",
              options: [
                {
                  label: "Ask who can change the design.",
                  text: "Chew names Tyrell. Sebastian can get you close.",
                  effect: { insight: 2 },
                },
                {
                  label: "Ask who knows the incept dates.",
                  text: "The answer leads through Sebastian, a genetic designer.",
                  effect: { insight: 2 },
                },
                {
                  label: "Let him put on another coat first.",
                  text: "Warmth makes the answer steadier. The destination does not change.",
                  effect: { empathy: 3 },
                },
              ],
              index: 2,
              requires: ["tank"],
              position: [-3, -9],
            },
          ],
          optional: [
            {
              id: "coat",
              label: "Restore the workshop heater",
              text: "A torn coat cannot protect a man from this cold. Reconnect the heater before leaving.",
              kind: "circuit",
              optional: !0,
              target: [0, 1, 1],
              item: "Heater restored",
              quest: "Cold comfort",
              source: "original",
              position: [-5, 10.3],
            },
          ],
          role: "Roy Batty",
          source: "draft",
          editions: ["draft", "final", "theatrical"],
          case: "02 / MANUFACTURED MEMORY",
          time: "20:31",
          exit: "Continue the case",
          detail: "freezer",
          legacy: 7,
          id: 15,
          number: "16",
          sourceNote: "A draft story beat. Gameplay and dialogue are newly written.",
        },
        {
          key: "chew-service",
          title: "A name beyond the eyes",
          env: "lab",
          place: "CHEW \u2022 COLD SERVICE PASSAGE",
          intro: "Chew can name a designer. He cannot fix what the fugitives came to change.",
          anchor: "Roy and Leon leave with the Sebastian lead. Tyrell remains their final destination.",
          steps: [
            {
              id: "designer",
              label: "Read the component route",
              kind: "inspect",
              text: "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
              item: "Component route card",
              model: "ledger",
              points: [
                { x: 0.24, y: 0.39, mode: "visible", label: "Eye design is separate work" },
                { x: 0.72, y: 0.61, mode: "infrared", label: "A Sebastian service entry" },
                { x: 0.53, y: 0.25, mode: "ultraviolet", label: "Final approval belongs to Tyrell" },
              ],
              requires: [],
              index: 0,
              position: [-2.8, 6.5],
            },
            {
              id: "route",
              label: "Trace the next contact",
              kind: "deduce",
              text: "Select two pieces of evidence. Then choose the claim that both support. A reasonable guess is not enough.",
              evidence: ["Nexus eye design", "Component route card"],
              claims: [
                "Chew controls the full lifespan design.",
                "Sebastian is a route toward the maker.",
                "The tank records provide a cure.",
              ],
              answer: 1,
              result: "The lead points toward Sebastian, not toward a cure inside this freezer.",
              item: "Sebastian contact lead",
              requires: ["designer"],
              index: 1,
              position: [3.1, -1],
            },
          ],
          optional: [
            {
              id: "coldlog",
              label: "What the cooler costs",
              kind: "tune",
              text: "Read the cooler log without changing its settings.",
              target: [52, 68],
              result: "The log records a repair delay, not a biological cure.",
              item: "Cooler duty log",
              source: "original",
              optional: !0,
              quest: "What the cooler costs",
              position: [-5, 10.3],
            },
          ],
          role: "Roy Batty",
          source: "original",
          editions: ["draft", "final", "theatrical"],
          case: "02 / MANUFACTURED MEMORY",
          time: "20:31",
          exit: "Continue the case",
          detail: "freezer",
          legacy: 7,
          id: 16,
          number: "17",
          sourceNote: "An original connecting investigation. It does not establish new film facts.",
        },
        {
          key: "home-arrival",
          title: "The visitor in the corridor",
          env: "apartment",
          place: "DECKARD\u2019S BUILDING \u2022 LIFT LOBBY",
          intro: "Rachael has come down from the pyramid. She is waiting outside your home with a photograph.",
          anchor: "Deckard and Rachael enter the apartment. She asks about the test.",
          steps: [
            {
              id: "door",
              label: "Open the apartment intercom",
              kind: "tune",
              text: "Tune the old door receiver. The lock needs a clear signal, not a louder one.",
              target: [35, 58],
              result: "The door opens. Rachael enters with Deckard.",
              item: "Home entry log",
              requires: [],
              index: 0,
              position: [-2.8, 6.5],
            },
            {
              id: "portrait",
              label: "Look at the offered photograph",
              kind: "inspect",
              text: "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
              item: "Offered childhood portrait",
              model: "photo",
              points: [
                { x: 0.24, y: 0.39, mode: "visible", label: "A child with a parent" },
                { x: 0.72, y: 0.61, mode: "infrared", label: "An old paper surface" },
                { x: 0.53, y: 0.25, mode: "ultraviolet", label: "No proof of who recalls the event" },
              ],
              requires: ["door"],
              index: 1,
              position: [3.1, -1],
            },
          ],
          optional: [
            {
              id: "rent",
              label: "A neighbour\u2019s broken bell",
              kind: "circuit",
              text: "A neighbour cannot hear the failing door bell.",
              target: [1, 1, 0],
              item: "Repaired door bell",
              reward: "The bell works. Its owner can hear the delivery again.",
              source: "original",
              optional: !0,
              quest: "A neighbour\u2019s broken bell",
              position: [-5, 10.3],
            },
          ],
          role: "Deckard",
          source: "shared",
          editions: ["draft", "final", "theatrical"],
          case: "03 / THE PHOTOGRAPH",
          time: "21:10",
          exit: "Continue the case",
          detail: "corridor",
          legacy: 8,
          id: 17,
          number: "18",
          sourceNote: "A story beat shared by the draft and film. The playable route is an adaptation.",
        },
        {
          key: "rachael-memory",
          title: "Proof of childhood",
          env: "apartment",
          place: "DECKARD\u2019S APARTMENT \u2022 ENTRY & LIVING ROOM",
          intro:
            "Rachael is waiting in your building. A photograph is clasped in her hand like a passport to a country that no longer exists.",
          anchor:
            "Rachael learns her remembered childhood was implanted and leaves; Deckard is left with her photograph.",
          steps: [
            {
              id: "memory",
              label: "Hear Rachael\u2019s evidence",
              kind: "talk",
              text: "The picture is real. The remembered moment may not be hers. She asks you to explain the difference without destroying everything else.",
              options: [
                {
                  label: "Tell the truth, without making it a performance.",
                  text: "The truth hurts. At least you do not turn it into another test.",
                  effect: { empathy: 3 },
                },
                {
                  label: "Explain how the memories were selected.",
                  text: "Facts make a framework. They cannot make this fair.",
                  effect: { insight: 2 },
                },
                {
                  label: "Let the photograph speak first.",
                  text: "You listen before answering. Her distress is plainly her own.",
                  effect: { empathy: 3 },
                },
              ],
              index: 0,
              requires: [],
              position: [-2.8, 6.5],
            },
            {
              id: "memory-proof",
              label: "Test what the photograph can establish",
              kind: "deduce",
              text: "Select two pieces of evidence. Then choose the claim that both support. A reasonable guess is not enough.",
              evidence: ["Offered childhood portrait", "Rachael baseline"],
              claims: [
                "A genuine photo proves who remembers it.",
                "The test makes every feeling false.",
                "A photo and a memory are different evidence.",
              ],
              answer: 2,
              result:
                "The photograph cannot certify the owner of a memory. That does not erase the distress in the room.",
              item: "Memory distinction",
              requires: ["memory"],
              index: 1,
              position: [3.1, -1],
            },
            {
              id: "portrait",
              label: "Keep the abandoned photograph",
              kind: "collect",
              text: "After she leaves, the little image remains. It does not stop being someone\u2019s mother because the story around it changed.",
              item: "Rachael\u2019s photograph",
              index: 2,
              requires: ["memory-proof"],
              position: [-3, -9],
            },
          ],
          optional: [],
          role: "Deckard",
          source: "draft",
          editions: ["draft", "final", "theatrical"],
          case: "03 / THE PHOTOGRAPH",
          time: "21:10",
          exit: "Continue the case",
          detail: "living",
          legacy: 8,
          id: 18,
          number: "19",
          sourceNote: "A draft story beat. Gameplay and dialogue are newly written.",
        },
        {
          key: "pris-street",
          title: "Shelter from the rain",
          env: "street",
          place: "BRADBURY \u2022 STREET ENTRANCE",
          intro:
            "You are Pris. A passing vehicle lights the rubbish near the entrance. There is a place to hide, but not a place to sleep.",
          anchor: "Pris meets Sebastian. He offers shelter inside the Bradbury.",
          steps: [
            {
              id: "shelter",
              label: "Move between the dry recesses",
              kind: "stealth",
              text: "Use the recesses while the street light passes. Reach the three markers without raising the alert.",
              result: "Pris reaches the entrance. Sebastian notices her.",
              requires: [],
              index: 0,
              position: [-2.8, 6.5],
            },
            {
              id: "sebastian",
              label: "Meet Sebastian",
              kind: "talk",
              text: "A shopping bag has spilled. The man gathering it apologizes as if you were the one who lived here.",
              options: [
                {
                  label: "Help him collect the groceries.",
                  text: "You give the person, rather than the case, a little room.",
                  effect: { empathy: 2 },
                },
                {
                  label: "Ask about the building.",
                  text: "The useful details go into the record.",
                  effect: { insight: 2 },
                },
                {
                  label: "Say you need somewhere to sleep.",
                  text: "A sharper approach gets an answer, but leaves a mark.",
                  effect: { pressure: 2 },
                },
              ],
              index: 1,
              requires: ["shelter"],
              position: [3.1, -1],
            },
          ],
          optional: [],
          role: "Pris",
          source: "shared",
          editions: ["draft", "final", "theatrical"],
          case: "03 / THE PHOTOGRAPH",
          time: "21:44",
          exit: "Continue the case",
          detail: "bradbury-street",
          legacy: 9,
          id: 19,
          number: "20",
          sourceNote: "A story beat shared by the draft and film. The playable route is an adaptation.",
        },
        {
          key: "bradbury-welcome",
          title: "The lift and the little army",
          env: "atrium",
          place: "BRADBURY \u2022 STREET, ATRIUM & CAGE LIFT",
          intro:
            "A nearly empty building offers a better hiding place than an empty street. Sebastian is startled to find someone at his door.",
          anchor: "Sebastian offers Pris shelter and introduces his small mechanical friends.",
          steps: [
            {
              id: "lift",
              label: "Operate the cage elevator",
              kind: "timing",
              text: "Old machinery demands a patient hand. Hold the latch until the contact meets the green band.",
              result: "The cage rattles upward through a cavern of deserted balconies.",
              index: 0,
              requires: [],
              position: [-2.8, 6.5],
            },
            {
              id: "friends",
              label: "Meet the Kaiser and the bear",
              kind: "collect",
              text: "Two little figures march out to greet their maker. Sebastian has filled a lonely home with company he built himself.",
              item: "Sebastian\u2019s mechanical friends",
              index: 1,
              requires: ["lift"],
              position: [3.1, -1],
            },
            {
              id: "friends-detail",
              label: "Inspect a mechanical friend",
              kind: "inspect",
              text: "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
              item: "Mechanical friend detail",
              model: "toy",
              points: [
                { x: 0.24, y: 0.39, mode: "visible", label: "A hand-fitted gear" },
                { x: 0.72, y: 0.61, mode: "infrared", label: "A worn felt sleeve" },
                { x: 0.53, y: 0.25, mode: "ultraviolet", label: "A repair made more than once" },
              ],
              requires: ["friends"],
              index: 2,
              position: [-3, -9],
            },
          ],
          optional: [
            {
              id: "mail",
              label: "Read the returned post",
              kind: "inspect",
              text: "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
              item: "Returned post",
              model: "paper",
              points: [
                { x: 0.24, y: 0.39, mode: "visible", label: "An off-world address" },
                { x: 0.72, y: 0.61, mode: "infrared", label: "A returned envelope" },
                { x: 0.53, y: 0.25, mode: "ultraviolet", label: "No confirmed new tenant" },
              ],
              optional: !0,
              quest: "Read the returned post",
              source: "original",
              position: [-5, 10.3],
            },
          ],
          role: "Pris",
          source: "draft",
          editions: ["draft", "final", "theatrical"],
          case: "03 / THE PHOTOGRAPH",
          time: "21:44",
          exit: "Continue the case",
          detail: "atrium",
          legacy: 9,
          id: 20,
          number: "21",
          sourceNote: "A draft story beat. Gameplay and dialogue are newly written.",
        },
        {
          key: "unicorn-dream",
          title: "A memory without a date",
          env: "forest",
          place: "APARTMENT \u2022 UNICORN DAYDREAM",
          intro:
            "The piano is quiet. The room gives way to a forest image. Do not mistake an image for a certified memory.",
          anchor: "Deckard wakes from the unicorn daydream. The investigation resumes at the Esper.",
          steps: [
            {
              id: "dream",
              label: "Observe the white animal",
              kind: "inspect",
              text: "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
              item: "Unicorn daydream",
              model: "unicorn",
              points: [
                { x: 0.24, y: 0.39, mode: "visible", label: "A horn in the light" },
                { x: 0.72, y: 0.61, mode: "infrared", label: "Trees instead of towers" },
                { x: 0.53, y: 0.25, mode: "ultraviolet", label: "No date or place on the image" },
              ],
              requires: [],
              index: 0,
              position: [-2.8, 6.5],
            },
            {
              id: "wake",
              label: "Return to the apartment",
              kind: "collect",
              text: "The daydream ends. Record the image without deciding what it proves.",
              item: "Unplaced dream record",
              requires: ["dream"],
              index: 1,
              position: [3.1, -1],
            },
          ],
          optional: [],
          role: "Deckard",
          source: "film",
          editions: ["final"],
          case: "03 / THE PHOTOGRAPH",
          time: "23:48",
          exit: "Continue the case",
          detail: "dream",
          legacy: 10,
          sourceNote: "Unicorn daydream from the later film cuts. This is not a scene in the supplied draft.",
          id: 21,
          number: "22",
        },
        {
          key: "esper-setup",
          title: "Every picture has edges",
          env: "apartment",
          place: "DECKARD\u2019S HOME \u2022 ESPER DESK",
          intro: "The photos fill the desk. An ordinary image may contain a detail its owner never intended to show.",
          anchor: "Deckard loads Leon\u2019s photograph. The Esper is ready for the image search.",
          steps: [
            {
              id: "contactsheet",
              label: "Inspect the contact sheet",
              kind: "inspect",
              text: "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
              item: "Contact-sheet record",
              model: "photo",
              points: [
                { x: 0.24, y: 0.39, mode: "visible", label: "A shared room layout" },
                { x: 0.72, y: 0.61, mode: "infrared", label: "A partial reflection" },
                { x: 0.53, y: 0.25, mode: "ultraviolet", label: "The same garment in two positions" },
              ],
              requires: [],
              index: 0,
              position: [-2.8, 6.5],
            },
            {
              id: "load",
              label: "Load the photograph without damage",
              kind: "sequence",
              text: "Clean before loading. Keep the full image inside the boundary before scanning.",
              order: [
                "Clean the scan glass",
                "Place the photograph",
                "Set the frame boundary",
                "Start the optical pass",
              ],
              result: "The full image is loaded. Cropping has not removed the edges.",
              item: "Esper scan record",
              requires: ["contactsheet"],
              index: 1,
              position: [3.1, -1],
            },
          ],
          optional: [
            {
              id: "photoedge",
              label: "Preserve a damaged edge",
              kind: "inspect",
              text: "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
              item: "Photo edge preserved",
              model: "photo",
              points: [
                { x: 0.24, y: 0.39, mode: "visible", label: "An edge crease" },
                { x: 0.72, y: 0.61, mode: "infrared", label: "A torn corner" },
                { x: 0.53, y: 0.25, mode: "ultraviolet", label: "An intact image area" },
              ],
              optional: !0,
              quest: "Preserve a damaged edge",
              source: "original",
              position: [-5, 10.3],
            },
          ],
          role: "Deckard",
          source: "original",
          editions: ["draft", "final", "theatrical"],
          case: "03 / THE PHOTOGRAPH",
          time: "23:48",
          exit: "Continue the case",
          detail: "esper",
          legacy: 10,
          id: 22,
          number: "23",
          sourceNote: "An original connecting investigation. It does not establish new film facts.",
        },
        {
          key: "esper-search",
          title: "A room inside a photograph",
          env: "apartment",
          place: "DECKARD\u2019S APARTMENT \u2022 ESPER CONSOLE",
          intro:
            "The Esper turns one small photograph into a place you can investigate. Somewhere behind an ordinary shoulder, light catches something important.",
          anchor: "The Esper reveals a sequined garment; the flakes become the next lead.",
          steps: [
            {
              id: "esper",
              label: "Examine Leon\u2019s photograph",
              kind: "esper",
              text: "Move the inspection frame to the glint inside the wardrobe, then increase magnification. The image grid, not brute force, is your map.",
              item: "Esper hard copy",
              index: 0,
              requires: [],
              position: [-2.8, 6.5],
            },
            {
              id: "wallet",
              label: "Compare the flake with the hard copy",
              kind: "collect",
              text: "Sequins would be convenient. The material feels wrong. Put the comparison in your wallet; another pair of eyes may do better.",
              item: "Evidence wallet",
              index: 1,
              requires: ["esper"],
              position: [3.1, -1],
            },
            {
              id: "image-link",
              label: "Compare the image with the sample",
              kind: "deduce",
              text: "Select two pieces of evidence. Then choose the claim that both support. A reasonable guess is not enough.",
              evidence: ["Esper hard copy", "Unidentified scale"],
              claims: [
                "A bright flake must be a sequin.",
                "The garment is a lead, not a species test.",
                "The image proves the fugitive\u2019s address.",
              ],
              answer: 1,
              result: "The garment suggests a performer. The physical sample still needs a separate check.",
              item: "Esper comparison",
              requires: ["wallet"],
              index: 2,
              position: [-3, -9],
            },
          ],
          optional: [
            {
              id: "shutdown",
              label: "Shut the Esper down safely",
              text: "Its cooling fan has acquired a desperate rattle. A simple power-down costs nothing.",
              kind: "collect",
              optional: !0,
              item: "Esper safely cooled",
              quest: "Machines need rest too",
              source: "original",
              position: [-5, 10.3],
            },
          ],
          role: "Deckard",
          source: "draft",
          editions: ["draft", "final", "theatrical"],
          case: "03 / THE PHOTOGRAPH",
          time: "23:48",
          exit: "Continue the case",
          detail: "esper",
          legacy: 10,
          variants: {
            final: {
              sourceNote:
                "Film-informed Esper variant: the reflection reveals a face. The garment-only draft version remains in the draft route.",
              source: "film",
              anchor:
                "The Esper isolates a reflected figure. Deckard keeps the image and the physical scale as separate evidence.",
              stepOverrides: {
                esper: { text: "Search the reflected room. Center the small figure, then increase the magnification." },
                wallet: {
                  text: "The image gives you a visual lead. The physical sample still has no confirmed species. Store them as separate evidence.",
                },
                "image-link": {
                  claims: [
                    "The reflection proves a name.",
                    "The image is a visual lead, not a species test.",
                    "The photograph proves the fugitive\u2019s address.",
                  ],
                  result:
                    "The reflected figure gives you a visual comparison. The scale still needs its own physical test.",
                },
              },
            },
            theatrical: {
              sourceNote: "Film-informed Esper variant: the reflection reveals a face.",
              source: "film",
              anchor:
                "The Esper isolates a reflected figure. Deckard keeps the image and the physical scale as separate evidence.",
              stepOverrides: {
                esper: { text: "Search the reflected room. Center the small figure, then increase the magnification." },
                wallet: {
                  text: "The image gives you a visual lead. The physical sample still has no confirmed species. Store them as separate evidence.",
                },
                "image-link": {
                  claims: [
                    "The reflection proves a name.",
                    "The image is a visual lead, not a species test.",
                    "The photograph proves the fugitive\u2019s address.",
                  ],
                  result:
                    "The reflected figure gives you a visual comparison. The scale still needs its own physical test.",
                },
              },
            },
          },
          id: 23,
          number: "24",
          sourceNote: "A draft story beat. Gameplay and dialogue are newly written.",
        },
        {
          key: "home-reset",
          title: "The tap that will not stop",
          env: "apartment",
          place: "DECKARD\u2019S HOME \u2022 BATHROOM",
          intro:
            "The Esper is quiet. Water ticks into the basin. The case has kept you awake long past a normal shift.",
          anchor: "Deckard leaves home and returns to the late noodle counter.",
          steps: [
            {
              id: "wash",
              label: "Prepare for another street visit",
              kind: "sequence",
              text: "Seal evidence before washing. Keep the wallet dry.",
              order: ["Seal the evidence", "Put the wallet away", "Wash the residue away", "Check the exit"],
              result: "The samples remain clean. You leave for the lower city.",
              item: "Clean sample record",
              requires: [],
              index: 0,
              position: [-2.8, 6.5],
            },
          ],
          optional: [
            {
              id: "tap",
              label: "Repair the leaking tap",
              kind: "circuit",
              text: "The service card shows the correct valve pattern.",
              target: [0, 1, 1],
              item: "Tap repaired",
              reward: "One small noise stops. The room can be left quiet.",
              optional: !0,
              quest: "A quiet room",
              source: "original",
              position: [-5, 10.3],
            },
          ],
          role: "Deckard",
          source: "draft",
          editions: ["draft"],
          case: "03 / THE PHOTOGRAPH",
          time: "02:03",
          exit: "Continue the case",
          detail: "bathroom",
          legacy: 11,
          id: 24,
          number: "25",
          sourceNote: "A draft story beat. Gameplay and dialogue are newly written.",
        },
        {
          key: "fish-counter",
          title: "The wrong fish",
          env: "street",
          place: "NOODLE ROW \u2022 LATE SERVICE",
          intro:
            "The noodle counter is still open. Fish scales on a neighbour\u2019s plate give you the first useful idea of the night.",
          anchor: "Deckard compares the flakes with fish scales and takes the biological lead to Animal Row.",
          steps: [
            {
              id: "fish",
              label: "Ask for a fish-scale sample",
              kind: "talk",
              text: "Your neighbour is trying to eat. You are trying to solve a case. Only one of you has a good reason to touch this plate.",
              options: [
                {
                  label: "Buy the next portion and ask permission.",
                  text: "Dinner continues without a quarrel. You get a clean sample.",
                  effect: { empathy: 2 },
                },
                {
                  label: "Explain the comparison to the counterman.",
                  text: "He finds a sample behind the counter and keeps the peace.",
                  effect: { insight: 2 },
                },
              ],
              index: 0,
              requires: [],
              position: [-2.8, 6.5],
            },
            {
              id: "comparison",
              label: "Compare the two samples",
              kind: "collect",
              text: "Close, but not the same. Enough to justify a visit to the animal dealers, not enough to write a conclusion.",
              item: "Fish-scale comparison",
              index: 1,
              requires: ["fish"],
              position: [3.1, -1],
            },
            {
              id: "fish-link",
              label: "Reject the first easy answer",
              kind: "deduce",
              text: "Select two pieces of evidence. Then choose the claim that both support. A reasonable guess is not enough.",
              evidence: ["Fish-scale comparison", "Unidentified scale"],
              claims: [
                "The two samples are an exact match.",
                "The comparison rules out this fish sample.",
                "Every artificial scale has the same pattern.",
              ],
              answer: 1,
              result: "The comparison sends you to the animal dealers. It does not yet identify a snake.",
              item: "Fish comparison finding",
              requires: ["comparison"],
              index: 2,
              position: [-3, -9],
            },
          ],
          optional: [],
          role: "Deckard",
          source: "draft",
          editions: ["draft", "final", "theatrical"],
          case: "03 / THE PHOTOGRAPH",
          time: "02:03",
          exit: "Continue the case",
          detail: "noodles",
          legacy: 11,
          id: 25,
          number: "26",
          sourceNote: "A draft story beat. Gameplay and dialogue are newly written.",
        },
        {
          key: "animal-row",
          title: "The price of a living thing",
          env: "market",
          place: "ANIMAL ROW \u2022 STALLS",
          intro: "Every stall has a price board. Most boards need an extra line to say what is real.",
          anchor: "The animal dealers direct Deckard to a closer examination of the scale.",
          steps: [
            {
              id: "dealer",
              label: "Consult the fish dealer",
              kind: "talk",
              text: "The dealer barely needs the lens. The specimen is reptilian, not a fish scale.",
              options: [
                {
                  label: "Ask for the next specialist.",
                  text: "She points you down the row toward the reptile tanks.",
                  effect: { insight: 2 },
                },
                {
                  label: "Thank her for saving you a bad report.",
                  text: "She laughs once, then points out the reptile dealer.",
                  effect: { empathy: 2 },
                },
              ],
              index: 0,
              requires: [],
              position: [-2.8, 6.5],
            },
            {
              id: "catalog",
              label: "Compare the dealer\u2019s reference cards",
              kind: "inspect",
              text: "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
              item: "Scale reference cards",
              model: "scale",
              points: [
                { x: 0.24, y: 0.39, mode: "visible", label: "A fish pattern" },
                { x: 0.72, y: 0.61, mode: "infrared", label: "A reptile pattern" },
                { x: 0.53, y: 0.25, mode: "ultraviolet", label: "A maker mark below the surface" },
              ],
              requires: [],
              index: 1,
              position: [3.1, -1],
            },
            {
              id: "species",
              label: "Choose the right specialist",
              kind: "deduce",
              text: "Select two pieces of evidence. Then choose the claim that both support. A reasonable guess is not enough.",
              evidence: ["Scale reference cards", "Unidentified scale"],
              claims: [
                "A reptile specialist is the next useful contact.",
                "The specimen needs a clock repairer.",
                "There is no manufactured pattern here.",
              ],
              answer: 0,
              result: "The reference cards support a reptile examination.",
              item: "Reptile referral",
              requires: ["dealer", "catalog"],
              index: 2,
              position: [-3, -9],
            },
          ],
          optional: [
            {
              id: "animal",
              label: "Check a neglected terrarium",
              text: "The heat lamp is broken. Its tiny occupant keeps seeking a patch of warmth that is not there.",
              kind: "circuit",
              optional: !0,
              target: [1, 1, 0],
              item: "Terrarium repair",
              quest: "An inexpensive life",
              source: "original",
              position: [-5, 10.3],
            },
            {
              id: "relayfollow",
              label: "A delivery without an owner",
              kind: "tune",
              text: "The delivery number matches the record at the night desk.",
              target: [56, 74],
              result: "The shop agrees to hold the parcel until its owner returns.",
              item: "Unclaimed delivery",
              source: "original",
              optional: !0,
              quest: "A delivery without an owner",
              position: [5.2, 10.3],
            },
          ],
          role: "Deckard",
          source: "shared",
          editions: ["draft", "final", "theatrical"],
          case: "03 / THE PHOTOGRAPH",
          time: "02:27",
          exit: "Continue the case",
          detail: "market",
          legacy: 12,
          id: 26,
          number: "27",
          sourceNote: "A story beat shared by the draft and film. The playable route is an adaptation.",
        },
        {
          key: "scale-bench",
          title: "A number under the skin",
          env: "lab",
          place: "ANIMAL ROW \u2022 ANALYSIS BENCH",
          intro: "The scale sits under a lens. The useful mark is smaller than the pattern around it.",
          anchor: "A manufactured serial number is recovered from the scale.",
          steps: [
            {
              id: "light",
              label: "Set the specimen light",
              kind: "tune",
              text: "Set the gain and carrier for the specimen reader. Do not saturate the reflective surface.",
              target: [73, 29],
              result: "The embedded mark separates from the tissue pattern.",
              item: "Specimen calibration",
              requires: [],
              index: 0,
              position: [-2.8, 6.5],
            },
            {
              id: "microscope",
              label: "Focus the serial number",
              kind: "focus",
              text: "A number is embedded in the manufactured tissue. Adjust the lens until the lettering stops swimming.",
              item: "Snake serial 99069745xb7Y",
              index: 1,
              requires: ["light"],
              position: [3.1, -1],
            },
            {
              id: "serialproof",
              label: "Preserve the serial image",
              kind: "inspect",
              text: "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
              item: "Serial photograph",
              model: "scale",
              points: [
                { x: 0.24, y: 0.39, mode: "visible", label: "An embedded number" },
                { x: 0.72, y: 0.61, mode: "infrared", label: "An intact sample edge" },
                { x: 0.53, y: 0.25, mode: "ultraviolet", label: "The same pattern at a second angle" },
              ],
              requires: ["microscope"],
              index: 2,
              position: [-3, -9],
            },
          ],
          optional: [],
          role: "Deckard",
          source: "shared",
          editions: ["draft", "final", "theatrical"],
          case: "03 / THE PHOTOGRAPH",
          time: "02:27",
          exit: "Continue the case",
          detail: "analysis",
          legacy: 12,
          id: 27,
          number: "28",
          sourceNote: "A story beat shared by the draft and film. The playable route is an adaptation.",
        },
        {
          key: "hassan",
          title: "The maker\u2019s ledger",
          env: "market",
          place: "ANIMAL ROW \u2022 ABDUL HASSAN",
          intro: "A number can outlast a false name. The maker opens a ledger that was not meant to be a police file.",
          anchor: "The sale points to Taffey Lewis and the performer\u2019s artificial snake.",
          steps: [
            {
              id: "hassan",
              label: "Trace the sale with Abdul Hassan",
              kind: "talk",
              text: "A maker\u2019s records connect the artificial snake to a performer at Taffey Lewis\u2019s.",
              options: [
                {
                  label: "Follow the invoice trail.",
                  text: "The invoice puts a name and a stage on your next lead.",
                  effect: { insight: 2 },
                },
                {
                  label: "Ask what the buyer was like.",
                  text: "The maker remembers someone who cared about the animal.",
                  effect: { empathy: 2 },
                },
              ],
              index: 0,
              requires: [],
              position: [-2.8, 6.5],
            },
            {
              id: "invoice",
              label: "Read the sale record",
              kind: "inspect",
              text: "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
              item: "Snake sale invoice",
              model: "ledger",
              points: [
                { x: 0.24, y: 0.39, mode: "visible", label: "The specimen serial" },
                { x: 0.72, y: 0.61, mode: "infrared", label: "A delivery entry" },
                { x: 0.53, y: 0.25, mode: "ultraviolet", label: "Taffey Lewis as the venue contact" },
              ],
              requires: ["hassan"],
              index: 1,
              position: [3.1, -1],
            },
            {
              id: "sale",
              label: "Build the venue link",
              kind: "deduce",
              text: "Select two pieces of evidence. Then choose the claim that both support. A reasonable guess is not enough.",
              evidence: ["Snake serial 99069745xb7Y", "Snake sale invoice"],
              claims: [
                "A matching serial links the sample to this sale.",
                "Every venue owns the same snake.",
                "A sales entry proves a real childhood.",
              ],
              answer: 0,
              result: "The serial and invoice support a visit to Taffey\u2019s.",
              item: "Taffey venue lead",
              requires: ["invoice"],
              index: 2,
              position: [-3, -9],
            },
          ],
          optional: [
            {
              id: "keeper",
              label: "The snake keeper\u2019s routine",
              kind: "inspect",
              text: "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
              item: "Care routine record",
              model: "ledger",
              points: [
                { x: 0.24, y: 0.39, mode: "visible", label: "A heating schedule" },
                { x: 0.72, y: 0.61, mode: "infrared", label: "Fresh water checks" },
                { x: 0.53, y: 0.25, mode: "ultraviolet", label: "A patient handling note" },
              ],
              optional: !0,
              quest: "The snake keeper\u2019s routine",
              source: "original",
              position: [-5, 10.3],
            },
          ],
          role: "Deckard",
          source: "shared",
          editions: ["draft", "final", "theatrical"],
          case: "03 / THE PHOTOGRAPH",
          time: "02:27",
          exit: "Continue the case",
          detail: "dealer",
          legacy: 12,
          id: 28,
          number: "29",
          sourceNote: "A story beat shared by the draft and film. The playable route is an adaptation.",
        },
        {
          key: "taffey",
          title: "No free information",
          env: "club",
          place: "TAFFEY LEWIS\u2019S \u2022 BAR & VID-PHONE",
          intro:
            "Music conceals a thousand conversations. Taffey makes his living deciding which ones he did not hear.",
          anchor: "Deckard finds Salome\u2019s backstage room. Rachael declines his invitation over the vid-phone.",
          steps: [
            {
              id: "taffey",
              label: "Ask Taffey about the performer",
              kind: "talk",
              text: "The snake belongs to a dancer working as Salome. The proprietor is interested in patrons, not police.",
              options: [
                {
                  label: "Ask discreetly and keep the crowd out of it.",
                  text: "He points you toward the dressing rooms.",
                  effect: { empathy: 2 },
                },
                {
                  label: "Compare the invoice to the booking sheet.",
                  text: "The stage name and the purchase record meet in the same room.",
                  effect: { insight: 2 },
                },
                {
                  label: "Put the badge on the bar.",
                  text: "The direction is clear; the welcome is colder.",
                  effect: { pressure: 2 },
                },
              ],
              index: 0,
              requires: [],
              position: [-2.8, 6.5],
            },
            {
              id: "server",
              label: "Question the floor server",
              kind: "interview",
              text: "Ask about routine before you ask for identity. You can present the venue lead as supporting evidence.",
              actor: "Floor server",
              topics: [
                {
                  label: "The performer",
                  ask: "Ask about the next set.",
                  patient: "She checks her animal before she goes on.",
                  precise: "The stage list uses a performance name.",
                  pressure: "The server will not guess for you.",
                },
                {
                  label: "The snake",
                  ask: "Ask who handles the animal.",
                  patient: "The performer handles it herself.",
                  precise: "A delivery record came with the enclosure.",
                  pressure: "You are told to ask the owner.",
                },
                {
                  label: "The service door",
                  ask: "Ask for a safe way backstage.",
                  patient: "Keep out of the performers\u2019 changing area.",
                  precise: "The marked passage leads to the service desk.",
                  pressure: "The server points to the public door.",
                },
              ],
              result: "The service route is clear. The performer is still at the club.",
              present: "Taffey venue lead",
              item: "Floor-server account",
              requires: ["taffey"],
              index: 1,
              position: [3.1, -1],
            },
          ],
          optional: [
            {
              id: "bartender",
              label: "Listen to the bartender",
              text: "A server has seen Salome check the snake\u2019s enclosure after every set. Routine can reveal a person without exposing a hiding place.",
              kind: "collect",
              optional: !0,
              item: "Backstage routine",
              quest: "After the applause",
              source: "original",
              position: [-5, 10.3],
            },
          ],
          role: "Deckard",
          source: "draft",
          editions: ["draft", "final", "theatrical"],
          case: "04 / THE PRICE OF A LIFE",
          time: "03:01",
          exit: "Continue the case",
          detail: "club",
          legacy: 13,
          id: 29,
          number: "30",
          sourceNote: "A draft story beat. Gameplay and dialogue are newly written.",
        },
        {
          key: "vidphone",
          title: "The call that does not help",
          env: "club",
          place: "TAFFEY\u2019S \u2022 VID-PHONE ALCOVE",
          intro: "Music reaches the phone through a wall. Rachael is far from this room, but not far from the case.",
          anchor: "Deckard\u2019s call does not bring Rachael to the club. He returns to the investigation.",
          steps: [
            {
              id: "carrier",
              label: "Clear the vid-phone return",
              kind: "tune",
              text: "Tune the receiver before placing the call. The image should not break into noise.",
              target: [49, 66],
              result: "The connection is usable.",
              item: "Club call record",
              requires: [],
              index: 0,
              position: [-2.8, 6.5],
            },
            {
              id: "phone",
              label: "Call Rachael",
              kind: "talk",
              text: "The screen lights her face in a quiet room. She does not accept an invitation into this one.",
              options: [
                {
                  label: "Accept her answer.",
                  text: "You leave the line open long enough to say good night.",
                  effect: { empathy: 3 },
                },
                {
                  label: "Tell her where you can be reached.",
                  text: "She declines the invitation. You give the number anyway.",
                  effect: { insight: 1, empathy: 1 },
                },
              ],
              index: 1,
              requires: ["carrier"],
              position: [3.1, -1],
            },
          ],
          optional: [],
          role: "Deckard",
          source: "shared",
          editions: ["draft", "final", "theatrical"],
          case: "04 / THE PRICE OF A LIFE",
          time: "03:01",
          exit: "Continue the case",
          detail: "phone",
          legacy: 13,
          id: 30,
          number: "31",
          sourceNote: "A story beat shared by the draft and film. The playable route is an adaptation.",
        },
        {
          key: "club-floor",
          title: "Before the curtain",
          env: "club",
          place: "TAFFEY\u2019S \u2022 PERFORMANCE FLOOR",
          intro:
            "A snake act is announced. The public room is loud enough to hide a departure. Watch the service route.",
          anchor: "Deckard reaches the backstage passage before the performer leaves.",
          steps: [
            {
              id: "bill",
              label: "Read the performance bill",
              kind: "inspect",
              text: "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
              item: "Salome stage bill",
              model: "sign",
              points: [
                { x: 0.24, y: 0.39, mode: "visible", label: "A stage name" },
                { x: 0.72, y: 0.61, mode: "infrared", label: "A snake act" },
                { x: 0.53, y: 0.25, mode: "ultraviolet", label: "A backstage schedule" },
              ],
              requires: [],
              index: 0,
              position: [-2.8, 6.5],
            },
            {
              id: "backroute",
              label: "Cross to the service passage",
              kind: "stealth",
              text: "Stay clear of the moving stage light. Use the marked gaps between the tables.",
              result: "Deckard reaches the backstage passage. Zhora has not yet left.",
              requires: ["bill"],
              index: 1,
              position: [3.1, -1],
            },
          ],
          optional: [
            {
              id: "sound",
              label: "The silent monitor",
              kind: "circuit",
              text: "A stage monitor has a loose service channel.",
              target: [0, 1, 0],
              item: "Stage monitor repaired",
              reward: "The performer can hear the cue without a louder stage system.",
              source: "original",
              optional: !0,
              quest: "The silent monitor",
              position: [-5, 10.3],
            },
            {
              id: "notice",
              label: "After the last set",
              kind: "tune",
              text: "Recover the staff pickup notice from the wall receiver.",
              target: [42, 77],
              result: "The closing staff have a confirmed ride home.",
              item: "Staff pickup notice",
              source: "original",
              optional: !0,
              quest: "After the last set",
              position: [5.2, 10.3],
            },
          ],
          role: "Deckard",
          source: "shared",
          editions: ["draft", "final", "theatrical"],
          case: "04 / THE PRICE OF A LIFE",
          time: "03:19",
          exit: "Continue the case",
          detail: "stage",
          legacy: 14,
          id: 31,
          number: "32",
          sourceNote: "A story beat shared by the draft and film. The playable route is an adaptation.",
        },
        {
          key: "zhora-backstage",
          title: "Salome\u2019s last dance",
          env: "backstage",
          place: "BACKSTAGE \u2022 SALOME\u2019S DRESSING ROOM",
          intro: "The stage name is Salome. The face belongs to Zhora. Mirrors make an awkward room feel crowded.",
          anchor: "Zhora recognizes the threat, attacks Deckard, and escapes into the street.",
          steps: [
            {
              id: "snake",
              label: "Compare the snake to the invoice",
              kind: "collect",
              text: "The engineered pattern matches. Cosmetics, costume pieces, and a carefully tended snake occupy the dressing table.",
              item: "Zhora\u2019s artificial snake",
              index: 0,
              requires: [],
              position: [-2.8, 6.5],
            },
            {
              id: "snake-match",
              label: "Confirm the snake trace",
              kind: "deduce",
              text: "Select two pieces of evidence. Then choose the claim that both support. A reasonable guess is not enough.",
              evidence: ["Snake sale invoice", "Zhora\u2019s artificial snake"],
              claims: [
                "The serial chain leads to this enclosure.",
                "The invoice proves a different performer.",
                "The animal proves the owner is human.",
              ],
              answer: 0,
              result: "The sample, invoice, and enclosure form one chain. The interview can proceed.",
              item: "Zhora trace conclusion",
              requires: ["snake"],
              index: 1,
              position: [3.1, -1],
            },
            {
              id: "zhora",
              label: "Question Zhora",
              kind: "talk",
              text: "She keeps one eye on your reflection. The cover story will not survive many more questions.",
              options: [
                {
                  label: "Ask about the animal before the paperwork.",
                  text: "For a moment she answers as its keeper, not your suspect.",
                  effect: { empathy: 2 },
                },
                {
                  label: "Use the booking records as your cover.",
                  text: "The details buy a few more seconds.",
                  effect: { insight: 2 },
                },
                { label: "Let the badge show.", text: "She understands immediately.", effect: { pressure: 2 } },
              ],
              index: 2,
              requires: ["snake-match"],
              position: [-3, -9],
            },
            {
              id: "escape",
              label: "Recover from the sudden attack",
              kind: "timing",
              text: "The chair goes over. Brace before the impact marker crosses the red line.",
              result: "You regain your feet. Zhora is already beyond the dressing-room door.",
              index: 3,
              requires: ["zhora"],
              position: [2.8, -17],
            },
          ],
          optional: [],
          role: "Deckard",
          source: "draft",
          editions: ["draft", "final", "theatrical"],
          case: "04 / THE PRICE OF A LIFE",
          time: "03:19",
          exit: "Continue the case",
          detail: "dressing",
          legacy: 14,
          id: 32,
          number: "33",
          sourceNote: "A draft story beat. Gameplay and dialogue are newly written.",
        },
        {
          key: "zhora-arcade",
          title: "Through the arcade",
          env: "chase",
          place: "LOWER CITY \u2022 COVERED ARCADE",
          intro: "Zhora enters the moving crowd. There is room to follow, but no safe shortcut through another person.",
          anchor: "Deckard follows Zhora out of the covered arcade toward the display windows.",
          steps: [
            {
              id: "track",
              label: "Keep the route in sight",
              kind: "stealth",
              text: "Follow the three route markers. Avoid the moving light and the blocked shopfronts.",
              result: "The trail reaches the shop windows. The pursuit continues.",
              requires: [],
              index: 0,
              position: [-2.8, 6.5],
            },
            {
              id: "glassroute",
              label: "Read the broken route marker",
              kind: "inspect",
              text: "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
              item: "Arcade route record",
              model: "sign",
              points: [
                { x: 0.24, y: 0.39, mode: "visible", label: "A displaced display sign" },
                { x: 0.72, y: 0.61, mode: "infrared", label: "A fresh break in the glass" },
                { x: 0.53, y: 0.25, mode: "ultraviolet", label: "A clear route past a stopped shop shutter" },
              ],
              requires: ["track"],
              index: 1,
              position: [3.1, -1],
            },
          ],
          optional: [],
          role: "Deckard",
          source: "original",
          editions: ["draft", "final", "theatrical"],
          case: "04 / THE PRICE OF A LIFE",
          time: "03:23",
          exit: "Continue the case",
          detail: "arcade",
          legacy: 15,
          id: 33,
          number: "34",
          sourceNote: "An original connecting investigation. It does not establish new film facts.",
        },
        {
          key: "zhora-pursuit",
          title: "Through the glass",
          env: "chase",
          place: "LOWER CITY \u2022 SHOPPING ARCADE",
          intro:
            "Zhora disappears between umbrellas and light. The street is full of people who never agreed to become part of your case.",
          anchor: "The pursuit ends with Zhora\u2019s death. The official record calls it a retirement.",
          steps: [
            {
              id: "pursuit",
              label: "Pursue Zhora through the arcade",
              kind: "combat",
              text: "Follow the amber marker. Move around the display barriers, keep civilians clear, and use the service blaster. Three hits end the pursuit.",
              mode: "zhora",
              result:
                "Glass settles across the pavement. Zhora is dead. The case advances, but that does not make the street feel safer.",
              index: 0,
              requires: [],
              position: [-2.8, 6.5],
            },
            {
              id: "record",
              label: "Write the incident report",
              kind: "talk",
              text: "The form has room for a serial number and a cause of death. It has very little room for the person who ran.",
              options: [
                {
                  label: "Record the civilian risk and her name.",
                  text: "Her name survives in the account.",
                  effect: { empathy: 3 },
                },
                {
                  label: "Preserve the exact sequence of events.",
                  text: "No euphemism is permitted to replace what happened.",
                  effect: { insight: 3 },
                },
              ],
              index: 1,
              requires: ["pursuit"],
              position: [3.1, -1],
            },
          ],
          optional: [],
          role: "Deckard",
          source: "draft",
          editions: ["draft", "final", "theatrical"],
          case: "04 / THE PRICE OF A LIFE",
          time: "03:23",
          exit: "Continue the case",
          detail: "glass",
          legacy: 15,
          id: 34,
          number: "35",
          sourceNote: "A draft story beat. Gameplay and dialogue are newly written.",
        },
        {
          key: "street-bryant",
          title: "The count changes again",
          env: "street",
          place: "LOWER CITY \u2022 POLICE CORDON",
          intro: "Police lights wash the street. Bryant has another instruction before the scene has stopped moving.",
          anchor: "Bryant adds Rachael to Deckard\u2019s assignment. Deckard then sees her in the street.",
          steps: [
            {
              id: "neworder",
              label: "Question the revised order",
              kind: "interview",
              text: "The order changes the case. Your responses change only your own record of it.",
              actor: "Bryant",
              topics: [
                {
                  label: "The order",
                  ask: "Ask what changed at Tyrell.",
                  patient: "Rachael has left the company\u2019s control.",
                  precise: "The new order includes her.",
                  pressure: "Bryant repeats the order instead of explaining it.",
                },
                {
                  label: "The count",
                  ask: "Ask why the count changed.",
                  patient: "He wants the list closed.",
                  precise: "The record includes the new name.",
                  pressure: "He does not discuss the discrepancy.",
                },
                {
                  label: "The witness",
                  ask: "Ask to finish the current report.",
                  patient: "The crowd must be cleared first.",
                  precise: "The incident number is assigned.",
                  pressure: "Your time is being counted.",
                },
              ],
              result: "Rachael is added to the assignment. Deckard does not act on that order here.",
              item: "Revised order",
              requires: [],
              index: 0,
              position: [-2.8, 6.5],
            },
          ],
          optional: [],
          role: "Deckard",
          source: "film",
          editions: ["final", "theatrical"],
          case: "04 / THE PRICE OF A LIFE",
          time: "03:37",
          exit: "Continue the case",
          detail: "cordon",
          legacy: 16,
          sourceNote: "Film aftermath beat. This route does not insert it into the draft order.",
          id: 35,
          number: "36",
        },
        {
          key: "rachael-crowd",
          title: "A face among umbrellas",
          env: "street",
          place: "LOWER CITY \u2022 CROWD EDGE",
          intro: "You see Rachael beyond the police lights. The crowd keeps closing the gap between you.",
          anchor: "Deckard follows Rachael past the alley. Leon intercepts him.",
          steps: [
            {
              id: "crowd",
              label: "Find the clear route",
              kind: "inspect",
              text: "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
              item: "Crowd-route observation",
              model: "sign",
              points: [
                { x: 0.24, y: 0.39, mode: "visible", label: "A hat beyond the umbrellas" },
                { x: 0.72, y: 0.61, mode: "infrared", label: "The alley entrance" },
                { x: 0.53, y: 0.25, mode: "ultraviolet", label: "An open path beside the wall" },
              ],
              requires: [],
              index: 0,
              position: [-2.8, 6.5],
            },
            {
              id: "follow",
              label: "Follow without pushing through",
              kind: "sequence",
              text: "Wait for the first gap. Follow the wall toward the shutter and then the alley.",
              order: ["Wait for the crossing", "Move beside the wall", "Pass the shutter", "Reach the alley"],
              result: "Deckard reaches the alley mouth. Leon steps into his path.",
              requires: ["crowd"],
              index: 1,
              position: [3.1, -1],
            },
          ],
          optional: [],
          role: "Deckard",
          source: "shared",
          editions: ["draft", "final", "theatrical"],
          case: "04 / THE PRICE OF A LIFE",
          time: "03:37",
          exit: "Continue the case",
          detail: "crowd",
          legacy: 16,
          id: 36,
          number: "37",
          sourceNote: "A story beat shared by the draft and film. The playable route is an adaptation.",
        },
        {
          key: "leon-attack",
          title: "Hard reset",
          env: "chase",
          place: "SERVICE ALLEY \u2022 LEON\u2019S AMBUSH",
          intro: "You notice Leon too late. At this distance the advantage belongs to the stronger body.",
          anchor: "Rachael shoots Leon, saving Deckard. They leave together.",
          steps: [
            {
              id: "leonfight",
              label: "Survive Leon\u2019s attack",
              kind: "combat",
              text: "Keep your distance and dodge around the service crates. Your weapon is out of reach. Survive until help arrives.",
              mode: "leon",
              result:
                "A shot comes from behind Leon. Rachael is holding the weapon. She has made a choice the test never asked about.",
              index: 0,
              requires: [],
              position: [-2.8, 6.5],
            },
            {
              id: "rescue",
              label: "Thank Rachael",
              kind: "talk",
              text: "She looks at the fallen body and then at you. Neither of you has a prepared answer.",
              options: [
                {
                  label: "Ask whether she is hurt.",
                  text: "You check on each other before leaving the alley.",
                  effect: { empathy: 3 },
                },
                {
                  label: "Put the weapon away and offer shelter.",
                  text: "For tonight, there is somewhere to go.",
                  effect: { empathy: 2, health: 15 },
                },
              ],
              index: 1,
              requires: ["leonfight"],
              position: [3.1, -1],
            },
          ],
          optional: [],
          role: "Deckard",
          source: "draft",
          editions: ["draft", "final", "theatrical"],
          case: "04 / THE PRICE OF A LIFE",
          time: "03:37",
          exit: "Continue the case",
          detail: "alley",
          legacy: 16,
          id: 37,
          number: "38",
          sourceNote: "A draft story beat. Gameplay and dialogue are newly written.",
        },
        {
          key: "home-firstaid",
          title: "A hand that shakes",
          env: "apartment",
          place: "DECKARD\u2019S HOME \u2022 WASHROOM",
          intro: "You are home, but the body has not caught up. Rachael waits nearby while you find a clean dressing.",
          anchor: "Deckard treats his injuries. Rachael stays in the apartment.",
          steps: [
            {
              id: "firstaid",
              label: "Dress your injuries",
              kind: "collect",
              text: "The mirror gives you an honest inventory of damage. A clean dressing and a moment without pursuit do their work.",
              item: "First-aid dressing",
              heal: 100,
              index: 0,
              requires: [],
              position: [-2.8, 6.5],
            },
            {
              id: "returned",
              label: "Inspect the returned weapon",
              kind: "inspect",
              text: "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
              item: "Returned weapon record",
              model: "blaster",
              points: [
                { x: 0.24, y: 0.39, mode: "visible", label: "An empty chamber" },
                { x: 0.72, y: 0.61, mode: "infrared", label: "A grip wet with rain" },
                { x: 0.53, y: 0.25, mode: "ultraviolet", label: "No safe shot left in the alley" },
              ],
              requires: ["firstaid"],
              index: 1,
              position: [3.1, -1],
            },
            {
              id: "secure",
              label: "Make the room safe",
              kind: "sequence",
              text: "Clear the weapon before putting it aside. Leave the case materials safe before you return.",
              order: ["Clear the weapon", "Set it aside", "Put the evidence away", "Return to the living room"],
              result: "The immediate danger is over. The conversation can begin.",
              item: "Safe-room record",
              requires: ["returned"],
              index: 2,
              position: [-3, -9],
            },
          ],
          optional: [],
          role: "Deckard",
          source: "shared",
          editions: ["draft", "final", "theatrical"],
          case: "05 / SMALL FRIENDS",
          time: "04:16",
          exit: "Continue the case",
          detail: "bathroom",
          legacy: 17,
          id: 38,
          number: "39",
          sourceNote: "A story beat shared by the draft and film. The playable route is an adaptation.",
        },
        {
          key: "home-piano",
          title: "Lessons without a teacher",
          env: "apartment",
          place: "DECKARD\u2019S HOME \u2022 PIANO",
          intro: "A piano phrase crosses the room. Its origin is uncertain. The person playing it is not.",
          anchor: "Rachael plays. Deckard and Rachael remain together while the night continues.",
          steps: [
            {
              id: "piano",
              label: "Follow the piano phrase",
              kind: "memory",
              text: "Listen and watch the four notes. Repeat the phrase on the illuminated keys. You can replay it as often as needed.",
              item: "A shared melody",
              index: 0,
              requires: [],
              position: [-2.8, 6.5],
            },
            {
              id: "lessons",
              label: "Listen to Rachael",
              kind: "interview",
              text: "There is no test to pass in this conversation. The scene rewards listening, not ownership.",
              actor: "Rachael",
              topics: [
                {
                  label: "Lessons",
                  ask: "Ask what she remembers about learning.",
                  patient: "She remembers the practice, but cannot prove whose practice it was.",
                  precise: "The sequence of notes is still under her hands.",
                  pressure: "She stops playing until you stop treating it as a test.",
                },
                {
                  label: "The rescue",
                  ask: "Ask how she is after the alley.",
                  patient: "She has not had time to understand it.",
                  precise: "She remembers the action clearly.",
                  pressure: "She will not reduce it to a report for you.",
                },
                {
                  label: "Staying",
                  ask: "Ask what she wants to do next.",
                  patient: "She needs time to decide.",
                  precise: "The outside street is still dangerous.",
                  pressure: "Pressure will not make the room feel safe.",
                },
              ],
              result: "The piano falls quiet. The room remains a temporary refuge.",
              item: "Rachael piano account",
              requires: ["piano"],
              index: 1,
              position: [3.1, -1],
            },
          ],
          optional: [],
          role: "Deckard",
          source: "shared",
          editions: ["draft", "final", "theatrical"],
          case: "05 / SMALL FRIENDS",
          time: "04:16",
          exit: "Continue the case",
          detail: "piano",
          legacy: 17,
          id: 39,
          number: "40",
          sourceNote: "A story beat shared by the draft and film. The playable route is an adaptation.",
        },
        {
          key: "pris-dresses",
          title: "Borrowed celebrations",
          env: "atrium",
          place: "BRADBURY \u2022 DRESS ROOM",
          intro: "You are Pris. Dust covers the dresses. Their shapes suggest lives that were meant to continue.",
          anchor: "Pris explores the dress room and returns to Sebastian\u2019s work area.",
          steps: [
            {
              id: "dresses",
              label: "Explore the dress room",
              kind: "collect",
              text: "Dusty gowns form an audience. A mirror briefly offers a life there is not time to live.",
              item: "Dress-room observation",
              index: 0,
              requires: [],
              position: [-2.8, 6.5],
            },
            {
              id: "gown",
              label: "Inspect a damaged gown",
              kind: "inspect",
              text: "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
              item: "Dress-room detail",
              model: "fabric",
              points: [
                { x: 0.24, y: 0.39, mode: "visible", label: "An old seam repair" },
                { x: 0.72, y: 0.61, mode: "infrared", label: "Dust on the hem" },
                { x: 0.53, y: 0.25, mode: "ultraviolet", label: "A name label with no wearer present" },
              ],
              requires: ["dresses"],
              index: 1,
              position: [3.1, -1],
            },
          ],
          optional: [],
          role: "Pris",
          source: "draft",
          editions: ["draft", "final", "theatrical"],
          case: "05 / SMALL FRIENDS",
          time: "06:31",
          exit: "Continue the case",
          detail: "dresses",
          legacy: 18,
          id: 40,
          number: "41",
          sourceNote: "A draft story beat. Gameplay and dialogue are newly written.",
        },
        {
          key: "sebastian-lab",
          title: "Work that keeps him company",
          env: "lab",
          place: "BRADBURY \u2022 SEBASTIAN\u2019S LAB",
          intro:
            "Sebastian builds company out of parts. His own body gives him less time than the toys around him seem to have.",
          anchor: "Pris learns about Sebastian\u2019s work and condition. Roy arrives at the apartment.",
          steps: [
            {
              id: "jf",
              label: "Ask Sebastian about his work",
              kind: "talk",
              text: "His body is also running ahead of its allotted time. For a moment the distinction between guest and fugitive matters less.",
              options: [
                {
                  label: "Listen to what living alone has been like.",
                  text: "You give the person, rather than the case, a little room.",
                  effect: { empathy: 2 },
                },
                {
                  label: "Ask about the genetic design equipment.",
                  text: "The useful details go into the record.",
                  effect: { insight: 2 },
                },
                {
                  label: "Ask whether Tyrell could help.",
                  text: "A sharper approach gets an answer, but leaves a mark.",
                  effect: { pressure: 2 },
                },
              ],
              index: 0,
              requires: [],
              position: [-2.8, 6.5],
            },
            {
              id: "toybench",
              label: "Inspect the workbench",
              kind: "inspect",
              text: "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
              item: "Sebastian bench record",
              model: "toy",
              points: [
                { x: 0.24, y: 0.39, mode: "visible", label: "A hand-made mechanism" },
                { x: 0.72, y: 0.61, mode: "infrared", label: "Repeated repair dates" },
                { x: 0.53, y: 0.25, mode: "ultraviolet", label: "A design shared across several friends" },
              ],
              requires: ["jf"],
              index: 1,
              position: [3.1, -1],
            },
            {
              id: "roy",
              label: "Meet Roy at the door",
              kind: "talk",
              text: "Roy sees the chessboard before he asks about its owner. The clock inside him is louder than the room.",
              options: [
                {
                  label: "Tell him Sebastian plays Tyrell.",
                  text: "The game becomes a route past the guards.",
                  effect: { insight: 2 },
                },
                {
                  label: "Tell him Sebastian has offered shelter.",
                  text: "Roy recognizes the kindness, then asks about Tyrell.",
                  effect: { empathy: 2 },
                },
              ],
              index: 2,
              requires: ["toybench"],
              position: [-3, -9],
            },
          ],
          optional: [
            {
              id: "toy",
              label: "Repair the mechanical bear",
              text: "A greeting keeps stopping after its first syllable. Align the little controller\u2019s three channels.",
              kind: "circuit",
              optional: !0,
              target: [0, 1, 0],
              item: "Bear\u2019s service map",
              quest: "A friend repaired",
              reward: "The bear finishes its greeting and prints a maintenance route through the building.",
              source: "original",
              position: [-5, 10.3],
            },
            {
              id: "clock",
              label: "A toy that cannot stop",
              kind: "circuit",
              text: "A clockwork friend repeats the same greeting.",
              target: [1, 0, 0],
              item: "Quiet toy clock",
              reward: "The friend can stop and start again without losing its place.",
              source: "original",
              optional: !0,
              quest: "A toy that cannot stop",
              position: [5.2, 10.3],
            },
            {
              id: "friends",
              label: "The parts left behind",
              kind: "inspect",
              text: "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
              item: "Friends repair plan",
              model: "ledger",
              points: [
                { x: 0.24, y: 0.39, mode: "visible", label: "A labelled spare" },
                { x: 0.72, y: 0.61, mode: "infrared", label: "A reusable bearing" },
                { x: 0.53, y: 0.25, mode: "ultraviolet", label: "A repair sequence" },
              ],
              optional: !0,
              quest: "The parts left behind",
              source: "original",
              position: [-5, 4.300000000000001],
            },
          ],
          role: "Pris",
          source: "shared",
          editions: ["draft", "final", "theatrical"],
          case: "05 / SMALL FRIENDS",
          time: "06:31",
          exit: "Continue the case",
          detail: "toy-lab",
          legacy: 18,
          id: 41,
          number: "42",
          sourceNote: "A story beat shared by the draft and film. The playable route is an adaptation.",
        },
        {
          key: "home-trust",
          title: "A room, not a cage",
          env: "apartment",
          place: "DECKARD\u2019S HOME \u2022 LIVING ROOM",
          intro: "The case cannot answer what happens between two people. Put the instrument away before you speak.",
          anchor:
            "Deckard and Rachael remain together. The story then returns to the fugitives at Sebastian\u2019s home.",
          steps: [
            {
              id: "family",
              label: "Look at the family photographs",
              kind: "inspect",
              text: "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
              item: "Deckard photo record",
              model: "photo",
              points: [
                { x: 0.24, y: 0.39, mode: "visible", label: "A family arrangement" },
                { x: 0.72, y: 0.61, mode: "infrared", label: "Pictures from different years" },
                { x: 0.53, y: 0.25, mode: "ultraviolet", label: "No independent memory test" },
              ],
              requires: [],
              index: 0,
              position: [-2.8, 6.5],
            },
            {
              id: "trust",
              label: "Give Rachael a choice",
              kind: "talk",
              text: "There is space beside the piano and a door she can use. Tonight, closeness must be something freely chosen.",
              options: [
                {
                  label: "Ask her to stay; accept her answer.",
                  text: "She chooses to stay. No test, no order.",
                  effect: { empathy: 3 },
                },
                {
                  label: "Offer the room and some privacy.",
                  text: "She stays. Quiet becomes a form of trust.",
                  effect: { empathy: 3 },
                },
              ],
              index: 1,
              requires: ["family"],
              position: [3.1, -1],
            },
          ],
          optional: [],
          role: "Deckard",
          source: "shared",
          editions: ["draft", "final", "theatrical"],
          case: "05 / SMALL FRIENDS",
          time: "04:16",
          exit: "Continue the case",
          detail: "living",
          legacy: 17,
          sourceNote:
            "The relationship beat is adapted with new, non-explicit dialogue and clear consent. It is not a verbatim scene.",
          id: 42,
          number: "43",
        },
        {
          key: "roy-sebastian",
          title: "A game with very little time",
          env: "atrium",
          place: "BRADBURY \u2022 CHESS CORNER",
          intro:
            "You are Roy. Sebastian\u2019s chess game reaches someone you need to meet. Pris waits for a plan that is more than waiting.",
          anchor: "Roy persuades Sebastian to take him to Tyrell. Pris stays behind.",
          steps: [
            {
              id: "chessnote",
              label: "Read the unfinished position",
              kind: "inspect",
              text: "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
              item: "Unfinished chess position",
              model: "chess",
              points: [
                { x: 0.24, y: 0.39, mode: "visible", label: "The queen can be offered" },
                { x: 0.72, y: 0.61, mode: "infrared", label: "A bishop has a path" },
                { x: 0.53, y: 0.25, mode: "ultraviolet", label: "The remote opponent is Tyrell" },
              ],
              requires: [],
              index: 0,
              position: [-2.8, 6.5],
            },
            {
              id: "cooperate",
              label: "Ask Sebastian for access",
              kind: "interview",
              text: "Find the route through trust and the chess contact. There is no cure hidden in this room.",
              actor: "Sebastian",
              topics: [
                {
                  label: "His work",
                  ask: "Ask what part of you he helped design.",
                  patient: "He recognizes work he cared about.",
                  precise: "He worked on genetic design.",
                  pressure: "He becomes less willing to talk.",
                },
                {
                  label: "His time",
                  ask: "Ask what he knows about a short life.",
                  patient: "He does not have to imagine the fear.",
                  precise: "His own condition limits his choices.",
                  pressure: "He looks away from the board.",
                },
                {
                  label: "Tyrell",
                  ask: "Ask how the chess game reaches him.",
                  patient: "The game is a private point of contact.",
                  precise: "The lift can carry a chess message.",
                  pressure: "You still need him beside you.",
                },
              ],
              result: "Sebastian agrees to go. Roy follows him to the lift.",
              item: "Sebastian agreement",
              requires: ["chessnote"],
              index: 1,
              position: [3.1, -1],
            },
          ],
          optional: [
            {
              id: "spares",
              label: "Parts kept for company",
              kind: "tune",
              text: "Read the service register for Sebastian\u2019s friends.",
              target: [69, 45],
              result: "The register preserves his repair notes for whoever comes next.",
              item: "Friends service register",
              source: "original",
              optional: !0,
              quest: "Parts kept for company",
              position: [-5, 10.3],
            },
          ],
          role: "Roy Batty",
          source: "shared",
          editions: ["draft", "final", "theatrical"],
          case: "06 / MEETING THE MAKER",
          time: "18:54",
          exit: "Continue the case",
          detail: "chess",
          legacy: 21,
          id: 43,
          number: "44",
          sourceNote: "A story beat shared by the draft and film. The playable route is an adaptation.",
        },
        {
          key: "hospital-two",
          title: "No honest mirror",
          env: "hospital",
          place: "HOSPITAL \u2022 ROOM & SURVEILLANCE FEED",
          intro:
            "You return to the hospital with questions the department would rather call mistakes. Somewhere else, a monitor carries this conversation into Bryant\u2019s office.",
          anchor: "The hospital conversation is observed by Bryant and Gaff. Deckard continues toward Sebastian.",
          steps: [
            {
              id: "holden2",
              label: "Speak to Holden again",
              kind: "talk",
              text: "Fear has made Holden certain of things you are no longer certain about. He wants the world divided into safe categories.",
              options: [
                {
                  label: "Tell him what Rachael did in the alley.",
                  text: "He struggles to fit a freely given rescue into his categories.",
                  effect: { empathy: 3 },
                },
                {
                  label: "Ask what actually proves a difference.",
                  text: "The evidence is more difficult than the language.",
                  effect: { insight: 3 },
                },
                {
                  label: "Refuse to turn a person into an appliance.",
                  text: "The disagreement is real. So is your concern for him.",
                  effect: { empathy: 3 },
                },
              ],
              index: 0,
              requires: [],
              position: [-2.8, 6.5],
            },
            {
              id: "surveillance",
              label: "Notice the surveillance return",
              kind: "collect",
              text: "A red indicator on the room terminal reveals that this is not a private conversation. The casebook gains a question mark beside the department itself.",
              item: "Hospital surveillance trace",
              index: 1,
              requires: ["holden2"],
              position: [3.1, -1],
            },
            {
              id: "monitor",
              label: "Check the return channel",
              kind: "tune",
              text: "Look for a second carrier. Record its presence without changing hospital equipment.",
              target: [82, 37],
              result: "The room has a second listener. The recording does not identify every listener.",
              item: "Second-channel record",
              requires: ["surveillance"],
              index: 2,
              position: [-3, -9],
            },
          ],
          optional: [],
          role: "Deckard",
          source: "draft",
          editions: ["draft"],
          case: "05 / SMALL FRIENDS",
          time: "13:08",
          exit: "Continue the case",
          detail: "hospital",
          legacy: 19,
          id: 44,
          number: "45",
          sourceNote: "A draft story beat. Gameplay and dialogue are newly written.",
        },
        {
          key: "sebastian-call",
          title: "The person on the other end",
          env: "street",
          place: "DECKARD\u2019S CAR \u2022 VID-PHONE",
          intro: "The car screen carries Sebastian\u2019s file. The call reaches somebody else.",
          anchor: "Deckard records the caller and prepares a closer comparison.",
          steps: [
            {
              id: "call",
              label: "Call Sebastian\u2019s apartment",
              kind: "talk",
              text: "Pris answers briefly, then disconnects. A casual lie cannot erase the frame the recorder already caught.",
              options: [
                {
                  label: "Keep the question neutral.",
                  text: "She disconnects before the question becomes an interrogation.",
                  effect: { insight: 2 },
                },
                {
                  label: "Ask whether Sebastian is safe.",
                  text: "The momentary hesitation is preserved in the recording.",
                  effect: { empathy: 2 },
                },
              ],
              index: 0,
              requires: [],
              position: [-2.8, 6.5],
            },
            {
              id: "playbacksignal",
              label: "Stabilize the playback carrier",
              kind: "tune",
              text: "Tune the recorded signal. A better picture cannot add information that was never captured.",
              target: [61, 54],
              result: "The caller\u2019s face can be compared frame by frame.",
              item: "Vid-phone carrier record",
              requires: ["call"],
              index: 1,
              position: [3.1, -1],
            },
          ],
          optional: [],
          role: "Deckard",
          source: "shared",
          editions: ["draft", "final", "theatrical"],
          case: "06 / MEETING THE MAKER",
          time: "17:39",
          exit: "Continue the case",
          detail: "phone",
          legacy: 20,
          id: 45,
          number: "46",
          sourceNote: "A story beat shared by the draft and film. The playable route is an adaptation.",
        },
        {
          key: "pris-playback",
          title: "The frame that stays",
          env: "street",
          place: "DECKARD\u2019S CAR \u2022 SEBASTIAN VID-CALL",
          intro:
            "The little screen in the car is a window into a room you have not reached. Somebody unexpected answers.",
          anchor: "Deckard recognizes Pris in the call playback and heads to Sebastian\u2019s building.",
          steps: [
            {
              id: "playback",
              label: "Freeze and focus the caller",
              kind: "focus",
              text: "Bring the vid-phone image into focus, then compare it with the dossier.",
              item: "Pris vid-phone still",
              index: 0,
              requires: [],
              position: [-2.8, 6.5],
            },
            {
              id: "caller",
              label: "Compare the caller with the dossier",
              kind: "deduce",
              text: "Select two pieces of evidence. Then choose the claim that both support. A reasonable guess is not enough.",
              evidence: ["Pris vid-phone still", "Nexus-6 dossiers"],
              claims: [
                "The caller is a match for Pris.",
                "The call proves Sebastian is absent forever.",
                "The image gives Roy\u2019s current position.",
              ],
              answer: 0,
              result: "The caller is identified as Pris. Sebastian\u2019s address becomes the next destination.",
              item: "Pris caller match",
              requires: ["playback"],
              index: 1,
              position: [3.1, -1],
            },
          ],
          optional: [],
          role: "Deckard",
          source: "draft",
          editions: ["draft", "final", "theatrical"],
          case: "06 / MEETING THE MAKER",
          time: "17:39",
          exit: "Continue the case",
          detail: "phone",
          legacy: 20,
          id: 46,
          number: "47",
          sourceNote: "A draft story beat. Gameplay and dialogue are newly written.",
        },
        {
          key: "tyrell-lift",
          title: "Above the last public floor",
          env: "tower",
          place: "TYRELL PYRAMID \u2022 PRIVATE LIFT",
          intro:
            "You are Roy. Sebastian holds a stack of access cards. The lift expects him to choose before it finishes counting.",
          anchor: "The lift passes the security checks. Sebastian opens a chess call to Tyrell.",
          steps: [
            {
              id: "cards",
              label: "Read Sebastian\u2019s access cards",
              kind: "collect",
              text: "The elevator expects a matching clearance for each colour-coded security level. Red eighteen is marked on one card.",
              item: "Sebastian\u2019s access cards",
              index: 0,
              requires: [],
              position: [-2.8, 6.5],
            },
            {
              id: "clearances",
              label: "Apply the security cards in order",
              kind: "sequence",
              text: "Read before choosing. Wait for the level to clear before sending the request.",
              order: [
                "Read the requested level",
                "Select the matching card",
                "Wait for acceptance",
                "Send the chess request",
              ],
              result: "The lift accepts the cards and opens the private channel.",
              item: "Lift clearance record",
              requires: ["cards"],
              index: 1,
              position: [3.1, -1],
            },
          ],
          optional: [],
          role: "Roy Batty",
          source: "draft",
          editions: ["draft", "final", "theatrical"],
          case: "06 / MEETING THE MAKER",
          time: "18:54",
          exit: "Continue the case",
          detail: "lift",
          legacy: 21,
          id: 47,
          number: "48",
          sourceNote: "A draft story beat. Gameplay and dialogue are newly written.",
        },
        {
          key: "chess-access",
          title: "The immortal game",
          env: "tower",
          place: "TYRELL \u2022 SLOPING LIFT & CHESS ENTRY",
          intro:
            "Sebastian has a move to offer. You have very little time left in which to ask a question. The elevator speaker becomes a chessboard.",
          anchor: "The winning chess sequence persuades Tyrell to admit Sebastian and Roy.",
          steps: [
            {
              id: "chess",
              label: "Finish the access game",
              kind: "chess",
              text: "A queen can be given up to open a bishop\u2019s path. Select the queen\u2019s destination, then the bishop\u2019s finishing square.",
              item: "Chess access sequence",
              index: 0,
              requires: [],
              position: [-2.8, 6.5],
            },
            {
              id: "threshold",
              label: "Cross the private threshold",
              kind: "collect",
              text: "The doors open. Sebastian enters first. Roy follows him to the maker.",
              item: "Private-room access",
              requires: ["chess"],
              index: 1,
              position: [3.1, -1],
            },
          ],
          optional: [],
          role: "Roy Batty",
          source: "draft",
          editions: ["draft", "final", "theatrical"],
          case: "06 / MEETING THE MAKER",
          time: "18:54",
          exit: "Continue the case",
          detail: "chess",
          legacy: 21,
          id: 48,
          number: "49",
          sourceNote: "A draft story beat. Gameplay and dialogue are newly written.",
        },
        {
          key: "maker-question",
          title: "The request behind the visit",
          env: "tower",
          place: "TYRELL \u2022 BEDROOM",
          intro:
            "The chessboard has brought you into the room. It cannot solve the question that brought you to the building.",
          anchor: "Roy asks for more time. Tyrell explains that the available changes will not save him.",
          steps: [
            {
              id: "maker",
              label: "Ask Tyrell for more time",
              kind: "talk",
              text: "Tyrell explains that the alterations you propose would destroy the system they are meant to preserve. Praise is not an extension.",
              options: [
                {
                  label: "Ask about recombination.",
                  text: "The proposed change would not survive development.",
                  effect: { insight: 2 },
                },
                {
                  label: "Ask about a replacement sequence.",
                  text: "The answer closes another technical door.",
                  effect: { insight: 2 },
                },
                {
                  label: "Ask why the limit was necessary.",
                  text: "He can describe the design. He cannot make it just.",
                  effect: { empathy: 2 },
                },
              ],
              index: 0,
              requires: [],
              position: [-2.8, 6.5],
            },
            {
              id: "limits",
              label: "Review the proposed modifications",
              kind: "inspect",
              text: "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
              item: "Modification review",
              model: "ledger",
              points: [
                { x: 0.24, y: 0.39, mode: "visible", label: "A failed extension route" },
                { x: 0.72, y: 0.61, mode: "infrared", label: "Damage after attempted change" },
                { x: 0.53, y: 0.25, mode: "ultraviolet", label: "No viable procedure in the record" },
              ],
              requires: ["maker"],
              index: 1,
              position: [3.1, -1],
            },
            {
              id: "limit",
              label: "Review the longevity record",
              kind: "collect",
              text: "Every available procedure fails to give Roy a viable extension. The conclusion is technical. What follows is not. Violence is heard beyond the terminal; the scene fades before impact.",
              item: "Longevity dead end",
              index: 2,
              requires: ["limits"],
              position: [-3, -9],
            },
          ],
          optional: [],
          role: "Roy Batty",
          source: "shared",
          editions: ["draft", "final", "theatrical"],
          case: "06 / MEETING THE MAKER",
          time: "19:06",
          exit: "Continue the case",
          detail: "bedchamber",
          legacy: 22,
          id: 49,
          number: "50",
          sourceNote: "A story beat shared by the draft and film. The playable route is an adaptation.",
        },
        {
          key: "maker-fall",
          title: "No repair at the source",
          env: "tower",
          place: "TYRELL \u2022 INNER CHAMBER",
          intro:
            "The request has reached a closed end. Sebastian stands close enough to hear the change in Roy\u2019s voice.",
          anchor: "Roy kills Tyrell. Sebastian does not survive the visit. Roy leaves the private rooms.",
          steps: [
            {
              id: "deadend",
              label: "Confirm the technical dead end",
              kind: "deduce",
              text: "Select two pieces of evidence. Then choose the claim that both support. A reasonable guess is not enough.",
              evidence: ["Longevity dead end", "Modification review"],
              claims: [
                "A hidden procedure guarantees more time.",
                "The available procedures cannot provide an extension.",
                "The chess access can change the result.",
              ],
              answer: 1,
              result:
                "The records supply no repair. What follows is a story event, not a reward for solving the puzzle.",
              item: "Maker-visit conclusion",
              requires: [],
              index: 0,
              position: [-2.8, 6.5],
            },
            {
              id: "aftermath",
              label: "Witness the end of the visit",
              kind: "collect",
              text: "The scene cuts away from the violence. Tyrell and Sebastian do not survive. Roy returns to the lift alone.",
              item: "Tyrell incident record",
              requires: ["deadend"],
              index: 1,
              position: [3.1, -1],
            },
          ],
          optional: [],
          role: "Roy Batty",
          source: "shared",
          editions: ["draft", "final", "theatrical"],
          case: "06 / MEETING THE MAKER",
          time: "19:06",
          exit: "Continue the case",
          detail: "bedchamber",
          legacy: 22,
          id: 50,
          number: "51",
          sourceNote: "A story beat shared by the draft and film. The playable route is an adaptation.",
        },
        {
          key: "roy-descent",
          title: "The lift returns alone",
          env: "tower",
          place: "TYRELL \u2022 DESCENDING LIFT",
          intro:
            "The city fills the window. The lift is moving down, but the distance to the street still seems unchanged.",
          anchor: "Roy clears the descent and returns toward the Bradbury.",
          steps: [
            {
              id: "red18",
              label: "Clear the red-eighteen checkpoint",
              kind: "timing",
              text: "You descend alone with Sebastian\u2019s cards. Slot the clearance during the pulse before security locks the lift.",
              result: "The security light clears. Roy returns to the city without his maker or his guide.",
              index: 0,
              requires: [],
              position: [-2.8, 6.5],
            },
            {
              id: "descent",
              label: "Keep the lift return signal clear",
              kind: "tune",
              text: "Complete the descent channel. The private room is now behind you.",
              target: [33, 74],
              result: "The lift reaches its exit. Roy heads back to Pris.",
              item: "Descent record",
              requires: ["red18"],
              index: 1,
              position: [3.1, -1],
            },
          ],
          optional: [],
          role: "Roy Batty",
          source: "draft",
          editions: ["draft", "final", "theatrical"],
          case: "06 / MEETING THE MAKER",
          time: "19:06",
          exit: "Continue the case",
          detail: "lift",
          legacy: 22,
          id: 51,
          number: "52",
          sourceNote: "A draft story beat. Gameplay and dialogue are newly written.",
        },
        {
          key: "bradbury-return",
          title: "A building that listens",
          env: "atrium",
          place: "BRADBURY \u2022 ENTRANCE",
          intro: "You are Deckard again. The empty building turns each footstep into a question from another floor.",
          anchor: "Deckard enters the Bradbury and begins the ascent toward Sebastian\u2019s apartment.",
          steps: [
            {
              id: "dispatch",
              label: "Listen to the incident return",
              kind: "tune",
              text: "Tune the service channel before entering. Separate the location from the static.",
              target: [57, 68],
              result: "The incident points back to Sebastian\u2019s address.",
              item: "Bradbury dispatch record",
              requires: [],
              index: 0,
              position: [-2.8, 6.5],
            },
            {
              id: "entry",
              label: "Inspect the entrance",
              kind: "inspect",
              text: "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
              item: "Bradbury entrance record",
              model: "cabinet",
              points: [
                { x: 0.24, y: 0.39, mode: "visible", label: "An open internal route" },
                { x: 0.72, y: 0.61, mode: "infrared", label: "No reply from the upper floor" },
                { x: 0.53, y: 0.25, mode: "ultraviolet", label: "Fresh movement through the dust" },
              ],
              requires: ["dispatch"],
              index: 1,
              position: [3.1, -1],
            },
          ],
          optional: [
            {
              id: "relay2",
              label: "The reply at the night desk",
              kind: "tune",
              text: "The lost-delivery message has a reply.",
              target: [47, 63],
              result: "The owner has been found. No address is added to the police file.",
              item: "Delivery reply",
              source: "original",
              optional: !0,
              quest: "The reply at the night desk",
              position: [-5, 10.3],
            },
          ],
          role: "Deckard",
          source: "shared",
          editions: ["draft", "final", "theatrical"],
          case: "07 / THE LONG NIGHT",
          time: "20:12",
          exit: "Continue the case",
          detail: "atrium",
          legacy: 23,
          id: 52,
          number: "53",
          sourceNote: "A story beat shared by the draft and film. The playable route is an adaptation.",
        },
        {
          key: "bradbury-stairs",
          title: "The unsafe stair",
          env: "atrium",
          place: "BRADBURY \u2022 LOBBY, STAIRS & MANNEQUINS",
          intro:
            "The building seems empty until every small noise begins to sound intentional. Up above, somebody is waiting among the dolls.",
          anchor: "Deckard reaches Sebastian\u2019s apartment, where Pris is hiding.",
          steps: [
            {
              id: "stairs",
              label: "Cross the broken stair landing",
              kind: "timing",
              text: "Loose masonry carries sound through the stairwell. Time your step across the damaged landing.",
              result: "You reach the upper corridor without falling.",
              index: 0,
              requires: [],
              position: [-2.8, 6.5],
            },
            {
              id: "landing",
              label: "Cross the listening corridor",
              kind: "stealth",
              text: "Move between the safe points. The scan shows cover, but running carries through the empty hall.",
              result: "Deckard reaches the apartment landing.",
              requires: ["stairs"],
              index: 1,
              position: [3.1, -1],
            },
          ],
          optional: [
            {
              id: "map",
              label: "Read the bear\u2019s maintenance marks",
              text: "The little machine has left a route around unsafe stairs. The repaired service map makes the marks easier to understand.",
              kind: "collect",
              optional: !0,
              item: "Upper-floor maintenance route",
              quest: "The way through",
              source: "original",
              position: [-5, 10.3],
            },
            {
              id: "lamp",
              label: "A light for the next person",
              kind: "circuit",
              text: "The stair lamp can run from its emergency channel.",
              target: [1, 1, 1],
              item: "Stair lamp repaired",
              reward: "The route remains dangerous, but it is no longer unlit.",
              source: "original",
              optional: !0,
              quest: "A light for the next person",
              position: [5.2, 10.3],
            },
          ],
          role: "Deckard",
          source: "draft",
          editions: ["draft", "final", "theatrical"],
          case: "07 / THE LONG NIGHT",
          time: "20:12",
          exit: "Continue the case",
          detail: "stairs",
          legacy: 23,
          id: 53,
          number: "54",
          sourceNote: "A draft story beat. Gameplay and dialogue are newly written.",
        },
        {
          key: "doll-room",
          title: "One shape too many",
          env: "backstage",
          place: "BRADBURY \u2022 MANNEQUIN ROOM",
          intro:
            "The room is full of bodies that do not breathe. Scan for a difference, then remember what the instrument cannot prove.",
          anchor: "Deckard enters the mannequin room. Pris remains hidden until the ambush.",
          steps: [
            {
              id: "room",
              label: "Search the mannequin display",
              kind: "collect",
              text: "Painted eyes, fixed smiles, cloth, dust. The infrared goggles distinguish warmth, not innocence.",
              item: "Mannequin heat trace",
              index: 0,
              requires: [],
              position: [-2.8, 6.5],
            },
            {
              id: "display",
              label: "Compare the mannequin surfaces",
              kind: "inspect",
              text: "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
              item: "Display comparison",
              model: "fabric",
              points: [
                { x: 0.24, y: 0.39, mode: "visible", label: "Several cold shells" },
                { x: 0.72, y: 0.61, mode: "infrared", label: "Cloth over a support frame" },
                { x: 0.53, y: 0.25, mode: "ultraviolet", label: "One recent disturbance" },
              ],
              requires: ["room"],
              index: 1,
              position: [3.1, -1],
            },
            {
              id: "cassette",
              label: "Prepare a fresh cassette",
              kind: "collect",
              text: "The service blaster accepts the cassette with an indecently loud click. The room remains still.",
              item: "Spare energy cassette",
              index: 2,
              requires: ["display"],
              position: [-3, -9],
            },
          ],
          optional: [],
          role: "Deckard",
          source: "shared",
          editions: ["draft", "final", "theatrical"],
          case: "07 / THE LONG NIGHT",
          time: "20:19",
          exit: "Continue the case",
          detail: "dolls",
          legacy: 24,
          id: 54,
          number: "55",
          sourceNote: "A story beat shared by the draft and film. The playable route is an adaptation.",
        },
        {
          key: "pris-ambush",
          title: "Dollhouse",
          env: "backstage",
          place: "SEBASTIAN\u2019S APARTMENT \u2022 AMBUSH",
          intro: "One of the figures moves. The distance closes before your mind finishes separating person from prop.",
          anchor: "Deckard survives Pris\u2019s attack and kills her. Roy\u2019s elevator begins to rise.",
          steps: [
            {
              id: "prisfight",
              label: "Survive Pris\u2019s ambush",
              kind: "combat",
              text: "Pris closes in fast. Strafe around the furniture, watch her charge, and fire when the line is clear.",
              mode: "pris",
              result: "Pris falls. Before the silence can settle, the elevator motor starts below.",
              index: 0,
              requires: [],
              position: [-2.8, 6.5],
            },
            {
              id: "reload",
              label: "Reload before the elevator arrives",
              kind: "collect",
              text: "The cassette seats in the blaster. Footsteps approach. The stairs no longer look like a safe way out.",
              item: "Reloaded service blaster",
              index: 1,
              requires: ["prisfight"],
              position: [3.1, -1],
            },
          ],
          optional: [],
          role: "Deckard",
          source: "draft",
          editions: ["draft", "final", "theatrical"],
          case: "07 / THE LONG NIGHT",
          time: "20:19",
          exit: "Continue the case",
          detail: "dolls",
          legacy: 24,
          id: 55,
          number: "56",
          sourceNote: "A draft story beat. Gameplay and dialogue are newly written.",
        },
        {
          key: "roy-return",
          title: "The sound of the cage",
          env: "atrium",
          place: "BRADBURY \u2022 UPPER LIFT LANDING",
          intro: "The cage lift moves again. There is no safe route back through the stair you used.",
          anchor: "Roy reaches the floor and finds Pris dead. Deckard retreats into the adjoining rooms.",
          steps: [
            {
              id: "route",
              label: "Read the upper-floor plan",
              kind: "inspect",
              text: "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
              item: "Upper-floor plan",
              model: "map",
              points: [
                { x: 0.24, y: 0.39, mode: "visible", label: "A billiard room" },
                { x: 0.72, y: 0.61, mode: "infrared", label: "A damaged connecting wall" },
                { x: 0.53, y: 0.25, mode: "ultraviolet", label: "A route toward the rear rooms" },
              ],
              requires: [],
              index: 0,
              position: [-2.8, 6.5],
            },
            {
              id: "retreat",
              label: "Choose the connected route",
              kind: "sequence",
              text: "Do not use the blocked stair. Follow the connected rooms away from the lift.",
              order: [
                "Leave the lift landing",
                "Enter the apartment",
                "Pass the inner doorway",
                "Reach the billiard room",
              ],
              result: "Deckard reaches the billiard room as Roy enters the apartment.",
              requires: ["route"],
              index: 1,
              position: [3.1, -1],
            },
          ],
          optional: [],
          role: "Deckard",
          source: "shared",
          editions: ["draft", "final", "theatrical"],
          case: "07 / THE LONG NIGHT",
          time: "20:27",
          exit: "Continue the case",
          detail: "upper-landing",
          legacy: 25,
          id: 56,
          number: "57",
          sourceNote: "A story beat shared by the draft and film. The playable route is an adaptation.",
        },
        {
          key: "billiard",
          title: "Two fingers and a wall",
          env: "chase",
          place: "BRADBURY \u2022 BILLIARD ROOM",
          intro:
            "Roy\u2019s footsteps move on the other side of the wall. The room has cover, but no reliable shelter.",
          anchor: "Roy breaks two of Deckard\u2019s fingers. Deckard fires and retreats through the rear rooms.",
          steps: [
            {
              id: "holdcover",
              label: "Get through the billiard room",
              kind: "stealth",
              text: "Move through the cover points. The safe route is temporary; it does not prevent the fixed injury.",
              result: "A hand breaks through the wall. The injury occurs in the scene transition.",
              requires: [],
              index: 0,
              position: [-2.8, 6.5],
            },
            {
              id: "injury",
              label: "Recover the injured hand",
              kind: "collect",
              text: "Two fingers are broken. The blaster returns to the injured hand. Deckard fires and moves for the next room.",
              item: "Broken-hand record",
              heal: -15,
              requires: ["holdcover"],
              index: 1,
              position: [3.1, -1],
            },
          ],
          optional: [],
          role: "Deckard",
          source: "shared",
          editions: ["draft", "final", "theatrical"],
          case: "07 / THE LONG NIGHT",
          time: "20:27",
          exit: "Continue the case",
          detail: "billiard",
          legacy: 25,
          id: 57,
          number: "58",
          sourceNote: "A story beat shared by the draft and film. The playable route is an adaptation.",
        },
        {
          key: "armoire",
          title: "A way through the ceiling",
          env: "backstage",
          place: "BRADBURY \u2022 ARMOIRE ROOM",
          intro: "The door is no longer an exit. The armoire reaches toward damaged plaster above you.",
          anchor: "Deckard climbs through the upper floor while Roy follows.",
          steps: [
            {
              id: "cabinet",
              label: "Inspect the climbing route",
              kind: "inspect",
              text: "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
              item: "Armoire route",
              model: "cabinet",
              points: [
                { x: 0.24, y: 0.39, mode: "visible", label: "A strong outer frame" },
                { x: 0.72, y: 0.61, mode: "infrared", label: "A loose upper panel" },
                { x: 0.53, y: 0.25, mode: "ultraviolet", label: "A gap above the cabinet" },
              ],
              requires: [],
              index: 0,
              position: [-2.8, 6.5],
            },
            {
              id: "climb",
              label: "Hold the cabinet as it shifts",
              kind: "timing",
              text: "Lock the pulse while the cabinet settles. The injury narrows the available grip.",
              result: "Deckard reaches the opening above the armoire.",
              requires: ["cabinet"],
              index: 1,
              position: [3.1, -1],
            },
          ],
          optional: [],
          role: "Deckard",
          source: "draft",
          editions: ["draft", "final", "theatrical"],
          case: "07 / THE LONG NIGHT",
          time: "20:27",
          exit: "Continue the case",
          detail: "armoire",
          legacy: 25,
          id: 58,
          number: "59",
          sourceNote: "A draft story beat. Gameplay and dialogue are newly written.",
        },
        {
          key: "upper-bath",
          title: "Tape, water, footsteps",
          env: "hotel",
          place: "BRADBURY \u2022 UPPER BATHROOM",
          intro: "Water runs across the floor. The room gives you a few seconds to support the damaged hand.",
          anchor: "Deckard binds his fingers. Roy breaks into the bathroom, forcing him toward the closet.",
          steps: [
            {
              id: "tape",
              label: "Bind your broken fingers",
              kind: "collect",
              text: "Tape offers support, not repair. Below the ledge, the city has become a very long distance.",
              item: "Finger splint tape",
              heal: 25,
              index: 0,
              requires: [],
              position: [-2.8, 6.5],
            },
            {
              id: "splint",
              label: "Secure the hand support",
              kind: "sequence",
              text: "Use the in-game support sequence. Do not tighten the wrap.",
              order: [
                "Keep the fingers together",
                "Support the injured hand",
                "Wrap without tightening",
                "Check movement gently",
              ],
              result: "The hand is supported. The next crash comes from beside the basin.",
              item: "Secured hand support",
              requires: ["tape"],
              index: 1,
              position: [3.1, -1],
            },
            {
              id: "latch",
              label: "Clear the old door latch",
              kind: "tune",
              text: "Use the latch\u2019s service signal while the door is still clear.",
              target: [76, 51],
              result: "The closet door opens. Deckard moves through it.",
              item: "Closet latch record",
              requires: ["splint"],
              index: 2,
              position: [-3, -9],
            },
          ],
          optional: [],
          role: "Deckard",
          source: "draft",
          editions: ["draft", "final", "theatrical"],
          case: "07 / THE LONG NIGHT",
          time: "20:27",
          exit: "Continue the case",
          detail: "bathroom",
          legacy: 25,
          id: 59,
          number: "60",
          sourceNote: "A draft story beat. Gameplay and dialogue are newly written.",
        },
        {
          key: "pigeon-closet",
          title: "The only opening left",
          env: "backstage",
          place: "BRADBURY \u2022 PIGEON CLOSET",
          intro:
            "The room fills with wings. The door behind you is no longer useful. There is light around the window boards.",
          anchor: "Deckard opens the window and climbs onto the outer ledge.",
          steps: [
            {
              id: "boards",
              label: "Inspect the window boards",
              kind: "inspect",
              text: "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
              item: "Window-board record",
              model: "cabinet",
              points: [
                { x: 0.24, y: 0.39, mode: "visible", label: "Two loose ends" },
                { x: 0.72, y: 0.61, mode: "infrared", label: "A clear outer ledge" },
                { x: 0.53, y: 0.25, mode: "ultraviolet", label: "A final board across the opening" },
              ],
              requires: [],
              index: 0,
              position: [-2.8, 6.5],
            },
            {
              id: "window",
              label: "Open the window route",
              kind: "sequence",
              text: "Get clear before pulling. Remove the loose end before the final board.",
              order: [
                "Move from the falling debris",
                "Free the loose end",
                "Pull the last board",
                "Step onto the ledge",
              ],
              result: "The window opens. Deckard steps out into the rain.",
              requires: ["boards"],
              index: 1,
              position: [3.1, -1],
            },
          ],
          optional: [
            {
              id: "nest",
              label: "Room for the birds",
              kind: "tune",
              text: "A small service label identifies the outer vent latch.",
              target: [58, 31],
              result: "The vent opens. The birds have another way out.",
              item: "Open bird vent",
              source: "original",
              optional: !0,
              quest: "Room for the birds",
              position: [-5, 10.3],
            },
          ],
          role: "Deckard",
          source: "draft",
          editions: ["draft", "final", "theatrical"],
          case: "07 / THE LONG NIGHT",
          time: "20:27",
          exit: "Continue the case",
          detail: "pigeons",
          legacy: 25,
          id: 60,
          number: "61",
          sourceNote: "A draft story beat. Gameplay and dialogue are newly written.",
        },
        {
          key: "outer-ledge",
          title: "A wall at your shoulder",
          env: "roof",
          place: "BRADBURY \u2022 OUTER LEDGE",
          intro:
            "The city is below your feet. Keep the wall at your shoulder and find the cornice above the next window.",
          anchor: "Deckard reaches the first roof. Roy follows by a different opening.",
          steps: [
            {
              id: "edge",
              label: "Cross the outer ledge",
              kind: "timing",
              text: "Hold the movement pulse inside the band. The goal is the roof, not a faster crossing.",
              result: "Deckard reaches the roof edge.",
              requires: [],
              index: 0,
              position: [-2.8, 6.5],
            },
            {
              id: "gap",
              label: "Measure the next roof",
              kind: "inspect",
              text: "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
              item: "Roof-gap observation",
              model: "map",
              points: [
                { x: 0.24, y: 0.39, mode: "visible", label: "An exposed gap" },
                { x: 0.72, y: 0.61, mode: "infrared", label: "A lower cornice" },
                { x: 0.53, y: 0.25, mode: "ultraviolet", label: "No sheltered route back" },
              ],
              requires: ["edge"],
              index: 1,
              position: [3.1, -1],
            },
          ],
          optional: [],
          role: "Deckard",
          source: "shared",
          editions: ["draft", "final", "theatrical"],
          case: "07 / THE LONG NIGHT",
          time: "20:34",
          exit: "Continue the case",
          detail: "ledge",
          legacy: 26,
          id: 61,
          number: "62",
          sourceNote: "A story beat shared by the draft and film. The playable route is an adaptation.",
        },
        {
          key: "roof-leap",
          title: "A long way down",
          env: "roof",
          place: "BRADBURY \u2022 FIRST & SECOND ROOFS",
          intro:
            "No cover. No stairs. Another roof beyond a gap that is just too wide. Roy steps into the rain behind you.",
          anchor: "Deckard\u2019s jump falls short. Roy leaps across and pulls him to safety.",
          steps: [
            {
              id: "jump",
              label: "Make the running leap",
              kind: "timing",
              text: "Catch the take-off window to reach the opposite cornice. Missing the window is fatal; a successful jump still leaves you hanging.",
              result: "Your fingers catch stone. Your grip fails. A hand catches yours before the city can take you.",
              index: 0,
              requires: [],
              position: [-2.8, 6.5],
            },
            {
              id: "hand",
              label: "Accept the offered hand",
              kind: "talk",
              text: "Roy has the strength to let you fall. Instead, he lifts you onto the roof.",
              options: [
                {
                  label: "Take the hand.",
                  text: "You are alive because he decided you should be.",
                  effect: { empathy: 3 },
                },
                {
                  label: "Meet his eyes as he lifts you.",
                  text: "For once neither of you looks away.",
                  effect: { insight: 2, empathy: 2 },
                },
              ],
              index: 1,
              requires: ["jump"],
              position: [3.1, -1],
            },
          ],
          optional: [],
          role: "Deckard",
          source: "draft",
          editions: ["draft", "final", "theatrical"],
          case: "07 / THE LONG NIGHT",
          time: "20:34",
          exit: "Continue the case",
          detail: "roof-gap",
          legacy: 26,
          id: 62,
          number: "63",
          sourceNote: "A draft story beat. Gameplay and dialogue are newly written.",
        },
        {
          key: "roy-witness",
          title: "The witness in the rain",
          env: "roof",
          place: "SECOND ROOF \u2022 RAIN INTO DAWN",
          intro:
            "The pursuit is over. Roy is still here. For a little longer, there is someone to remember what he remembers.",
          anchor: "Roy dies after saving Deckard. Deckard remains as the witness.",
          steps: [
            {
              id: "witness",
              label: "Listen to Roy",
              kind: "talk",
              text: "He speaks of distant battles and extraordinary light, experiences no record will contain when he is gone. You have nothing to gain by interrupting.",
              options: [
                {
                  label: "Listen without reaching for the recorder.",
                  text: "You remember the person, not just the information.",
                  effect: { empathy: 4 },
                },
                {
                  label: "Ask him to keep talking.",
                  text: "You stay with him through the time that remains.",
                  effect: { empathy: 4 },
                },
              ],
              index: 0,
              requires: [],
              position: [-2.8, 6.5],
            },
            {
              id: "bird",
              label: "Watch the pigeon depart",
              kind: "collect",
              text: "A pigeon settles nearby, then flies. Roy is still. The city begins another day without asking whether this one mattered.",
              item: "Rooftop witness",
              index: 1,
              requires: ["witness"],
              position: [3.1, -1],
            },
          ],
          optional: [],
          role: "Deckard",
          source: "draft",
          editions: ["draft", "final", "theatrical"],
          case: "07 / THE LONG NIGHT",
          time: "DAWN",
          exit: "Continue the case",
          detail: "witness",
          legacy: 27,
          id: 63,
          number: "64",
          sourceNote: "A draft story beat. Gameplay and dialogue are newly written.",
        },
        {
          key: "gaff-dawn",
          title: "The other man on the roof",
          env: "roof",
          place: "ROOFTOP \u2022 DAWN",
          intro: "Another pair of footsteps reaches the roof. Gaff has watched enough to know that the case is ending.",
          anchor: "Gaff leaves Deckard alive and warns him about Rachael. Deckard returns home.",
          steps: [
            {
              id: "gaffdawn",
              label: "Hear Gaff\u2019s warning",
              kind: "talk",
              text: "Gaff returns the gun. His warning is almost a kindness, and the uncertainty in it is deliberate.",
              options: [
                {
                  label: "Leave the argument behind.",
                  text: "There is someone you need to get back to.",
                  effect: { empathy: 2 },
                },
                { label: "Ask nothing more of him.", text: "You understand enough to move.", effect: { insight: 2 } },
              ],
              index: 0,
              requires: [],
              position: [-2.8, 6.5],
            },
            {
              id: "witnessrecord",
              label: "Keep the witness record",
              kind: "collect",
              text: "Record that Roy saved you. Do not turn that act into a malfunction to make the report easier.",
              item: "Final witness record",
              requires: ["gaffdawn"],
              index: 1,
              position: [3.1, -1],
            },
          ],
          optional: [
            {
              id: "rain",
              label: "Watch the last runoff",
              kind: "inspect",
              text: "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
              item: "Rain observation",
              model: "map",
              points: [
                { x: 0.24, y: 0.39, mode: "visible", label: "A clear gutter" },
                { x: 0.72, y: 0.61, mode: "infrared", label: "Daylight on the ledge" },
                { x: 0.53, y: 0.25, mode: "ultraviolet", label: "Water moving toward the city" },
              ],
              optional: !0,
              quest: "Watch the last runoff",
              source: "original",
              position: [-5, 10.3],
            },
          ],
          role: "Deckard",
          source: "shared",
          editions: ["draft", "final", "theatrical"],
          case: "07 / THE LONG NIGHT",
          time: "DAWN",
          exit: "Continue the case",
          detail: "witness",
          legacy: 27,
          id: 64,
          number: "65",
          sourceNote: "A story beat shared by the draft and film. The playable route is an adaptation.",
        },
        {
          key: "home-last",
          title: "The room behind the door",
          env: "apartment",
          place: "DECKARD\u2019S HOME \u2022 KITCHEN AND BEDROOM",
          intro:
            "The corridor is quiet. There is no answer from the kitchen. Reach the bedroom before deciding what the silence means.",
          anchor: "Deckard finds Rachael alive. They prepare to leave together.",
          steps: [
            {
              id: "kitchen",
              label: "Check the kitchen",
              kind: "inspect",
              text: "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
              item: "Kitchen return observation",
              model: "cabinet",
              points: [
                { x: 0.24, y: 0.39, mode: "visible", label: "The room is quiet" },
                { x: 0.72, y: 0.61, mode: "infrared", label: "No clear sign of struggle" },
                { x: 0.53, y: 0.25, mode: "ultraviolet", label: "The bedroom door is closed" },
              ],
              requires: [],
              index: 0,
              position: [-2.8, 6.5],
            },
            {
              id: "alive",
              label: "Check the bedroom",
              kind: "collect",
              text: "Rachael is asleep, breathing. The tension in your shoulders finally changes into urgency.",
              item: "Rachael alive",
              index: 1,
              requires: [],
              position: [3.1, -1],
            },
            {
              id: "leave",
              label: "Ask Rachael to leave with you",
              kind: "talk",
              text: "You cannot offer a guaranteed future. You can offer a choice and a place beside you.",
              options: [
                {
                  label: "Tell her the risks and ask.",
                  text: "She chooses the uncertain road with you.",
                  effect: { empathy: 3 },
                },
                {
                  label: "Let her decide what to take.",
                  text: "Her belongings go into the bag beside yours.",
                  effect: { empathy: 3 },
                },
              ],
              index: 2,
              requires: ["kitchen", "alive"],
              position: [-3, -9],
            },
          ],
          optional: [
            {
              id: "exitnote",
              label: "The neighbour\u2019s safe corridor",
              kind: "inspect",
              text: "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
              item: "Safe-corridor note",
              model: "ledger",
              points: [
                { x: 0.24, y: 0.39, mode: "visible", label: "A working lift" },
                { x: 0.72, y: 0.61, mode: "infrared", label: "A clear exit" },
                { x: 0.53, y: 0.25, mode: "ultraviolet", label: "A neighbour\u2019s quiet help" },
              ],
              optional: !0,
              quest: "The neighbour\u2019s safe corridor",
              source: "original",
              position: [-5, 10.3],
            },
          ],
          role: "Deckard",
          source: "shared",
          editions: ["draft", "final", "theatrical"],
          case: "EPILOGUE",
          time: "07:13",
          exit: "Continue the case",
          detail: "bedroom",
          legacy: 28,
          id: 65,
          number: "66",
          sourceNote: "A story beat shared by the draft and film. The playable route is an adaptation.",
        },
        {
          key: "packing",
          title: "Only what you can carry",
          env: "apartment",
          place: "DECKARD\u2019S HOME \u2022 PACKING TABLE",
          intro:
            "There is no time to move a whole life. There is time to decide what will not be left to the department.",
          anchor: "Deckard and Rachael pack and leave the apartment.",
          steps: [
            {
              id: "bag",
              label: "Pack the overnight cases",
              kind: "collect",
              text: "Clothes, the remaining cassettes, a photograph. Not much of a life fits in a parachute bag, but enough can travel.",
              item: "Parachute bag",
              index: 0,
              requires: [],
              position: [-2.8, 6.5],
            },
            {
              id: "bagseal",
              label: "Pack the small case",
              kind: "sequence",
              text: "Protect the photograph first. Keep the loose equipment away from it before closing the case.",
              order: [
                "Protect the photograph",
                "Place the dry clothing",
                "Secure the loose equipment",
                "Close the case",
              ],
              result: "The case closes. Deckard and Rachael leave together.",
              item: "Packed escape case",
              requires: ["bag"],
              index: 1,
              position: [3.1, -1],
            },
          ],
          optional: [
            {
              id: "return",
              label: "Nothing left on loan",
              kind: "tune",
              text: "A borrowed item has a return address in the private notes.",
              target: [33, 55],
              result: "The item is left where its owner can collect it.",
              item: "Private return note",
              source: "original",
              optional: !0,
              quest: "Nothing left on loan",
              position: [-5, 10.3],
            },
          ],
          role: "Deckard",
          source: "draft",
          editions: ["draft", "final", "theatrical"],
          case: "EPILOGUE",
          time: "07:13",
          exit: "Continue the case",
          detail: "packing",
          legacy: 28,
          id: 66,
          number: "67",
          sourceNote: "A draft story beat. Gameplay and dialogue are newly written.",
        },
        {
          key: "unicorn-corridor",
          title: "The smallest visitor",
          env: "apartment",
          place: "DECKARD\u2019S BUILDING \u2022 CORRIDOR",
          intro: "Rachael has gone toward the lift. A small folded object remains on the floor behind her.",
          anchor: "Deckard finds Gaff\u2019s unicorn. He follows Rachael toward the exit.",
          steps: [
            {
              id: "unicorn",
              label: "Inspect the folded unicorn",
              kind: "inspect",
              text: "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
              item: "Tinfoil unicorn",
              model: "origami",
              points: [
                { x: 0.24, y: 0.39, mode: "visible", label: "A single horn" },
                { x: 0.72, y: 0.61, mode: "infrared", label: "Folded metal foil" },
                { x: 0.53, y: 0.25, mode: "ultraviolet", label: "Gaff\u2019s silent signature" },
              ],
              requires: [],
              index: 0,
              position: [-2.8, 6.5],
            },
            {
              id: "implication",
              label: "Record what you actually know",
              kind: "collect",
              text: "Gaff has been here. Rachael is alive. Keep the remaining implication as a question, not a new certified memory.",
              item: "Corridor conclusion",
              requires: ["unicorn"],
              index: 1,
              position: [3.1, -1],
            },
          ],
          optional: [],
          role: "Deckard",
          source: "shared",
          editions: ["draft", "final", "theatrical"],
          case: "EPILOGUE",
          time: "07:13",
          exit: "Continue the case",
          detail: "corridor",
          legacy: 28,
          id: 67,
          number: "68",
          sourceNote: "A story beat shared by the draft and film. The playable route is an adaptation.",
        },
        {
          key: "final-lift",
          title: "The doors close",
          env: "apartment",
          place: "DECKARD\u2019S BUILDING \u2022 EXIT LIFT",
          intro: "Rachael waits inside. The city outside has not changed. You enter beside her.",
          anchor: "The lift doors close with Deckard and Rachael together. The route ends without a forest epilogue.",
          steps: [
            {
              id: "lift",
              label: "Leave the floor",
              kind: "sequence",
              text: "Enter first. Put the case clear of the doors before you choose the exit.",
              order: ["Enter beside Rachael", "Set the case down", "Press the exit control", "Let the doors close"],
              result: "The doors meet. The film-informed route ends here.",
              item: "Closed-lift record",
              requires: [],
              index: 0,
              position: [-2.8, 6.5],
            },
          ],
          optional: [],
          role: "Deckard",
          source: "film",
          editions: ["final"],
          case: "EPILOGUE",
          time: "MORNING",
          exit: "Continue the case",
          detail: "lift",
          legacy: 29,
          sourceNote: "Later film ending. It replaces, rather than precedes, the draft forest pursuit.",
          id: 68,
          number: "69",
        },
        {
          key: "forest-draft",
          title: "No promised land",
          env: "forest",
          place: "FOREST ROAD \u2022 MOVING NORTH",
          intro:
            "Trees replace towers. Rachael sits beside you. A small shape of folded foil rests on the dashboard. The road does not promise to be empty.",
          anchor:
            "On the forest road, Deckard identifies himself with Roy and Rachael as manufactured beings. Gaff\u2019s spinner appears in pursuit as the credits roll.",
          steps: [
            {
              id: "road",
              label: "Keep the car on the forest road",
              kind: "drive",
              text: "Steer left and right to avoid road debris. Stay on the road until the city drops behind you. This is escape, not certainty.",
              result:
                "Deckard understands Roy as a brother in engineered combat, and Rachael as part of that shared future. The trees open for a moment. Gaff\u2019s spinner banks into pursuit. You keep driving.",
              index: 0,
              requires: [],
              position: [-2.8, 6.5],
            },
          ],
          optional: [],
          role: "Deckard",
          source: "draft",
          editions: ["draft"],
          case: "EPILOGUE",
          time: "MORNING",
          exit: "Continue the case",
          detail: "forest",
          legacy: 29,
          id: 69,
          number: "70",
          sourceNote: "A draft story beat. Gameplay and dialogue are newly written.",
        },
        {
          key: "forest-theatrical",
          title: "A road without a promise",
          env: "forest",
          place: "FOREST ROAD \u2022 THEATRICAL-ENDING ROUTE",
          intro: "The towers are behind you. Rachael sits beside you as the road runs into daylight.",
          anchor: "Deckard and Rachael drive away together. This route does not add the draft\u2019s pursuing spinner.",
          steps: [
            {
              id: "road",
              label: "Keep the car on the open road",
              kind: "drive",
              text: "Steer around the marked road debris. Forward motion is automatic.",
              result: "The road continues into the trees. The theatrical-ending route closes on their departure.",
              requires: [],
              index: 0,
              position: [-2.8, 6.5],
            },
            {
              id: "openend",
              label: "Keep the departure record",
              kind: "collect",
              text: "No pursuer is added to this version of the ending. The record closes with the two travellers together.",
              item: "Departure record",
              requires: ["road"],
              index: 1,
              position: [3.1, -1],
            },
          ],
          optional: [],
          role: "Deckard",
          source: "film",
          editions: ["theatrical"],
          case: "EPILOGUE",
          time: "MORNING",
          exit: "Continue the case",
          detail: "forest",
          legacy: 29,
          sourceNote: "Theatrical-ending variant. No claim that the full route is a shot-for-shot theatrical cut.",
          id: 70,
          number: "71",
        },
      ];
    return {
      SCENES: e,
      ITEMS: {
        "Service blaster":
          "Six-shot energy cassette. Fire only during authorized encounters. Reloading installs a spare cassette; civilians are never valid targets.",
        "Infrared goggles":
          "The scanner reveals nearby interactable evidence and route beacons. Focus upgrades extend its range and reduce its cooldown.",
        "Voight-Kampff instrument":
          "An unstable empathy signal requires patient calibration. The test is a story puzzle, not a real diagnostic instrument.",
        "Electric sheep":
          "An optional repaired companion. Its circuitry reduces scanner cooldown by one additional second.",
        "Courier favour": "A kindness remembered. Zhora\u2019s pursuit permits extra time before the trail is lost.",
        "Bear\u2019s service map":
          "A repaired friend\u2019s reward. Route beacons in Roy\u2019s pursuit are easier to reach.",
        "Finger splint tape": "Supports the injured hand and restores 25 condition points before the roof.",
        "Nexus-6 dossiers":
          "Includes Roy, Leon, Pris, Zhora, and Mary. The draft\u2019s inconsistent counts remain documented rather than silently resolved.",
        "Tinfoil unicorn":
          "The final paper clue. Its implication belongs to the shooting-draft ending; it does not settle every version of this story.",
        "A shared melody": "An original four-note phrase composed for this game. No film music is used.",
        "City channel log": "The police channel is clear. A test room at Tyrell is accepting a new employee.",
        "Off-world advert":
          "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
        "Test baseline": "The test is ready. The baseline is kept with the interview.",
        "Night-shift clipping":
          "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
        "Night menu":
          "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
        "Police approach clearance": "The tower assigns a pad. Gaff brings the spinner down.",
        "Paper-fold observation":
          "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
        "Duty ledger":
          "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
        "Case wallet": "The wallet opens without breaking its evidence history.",
        "Unclaimed message": "The message concerns a lost delivery. It is not a secret character file.",
        "Paper chicken":
          "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
        "Unresolved manifest":
          "Mary has a dossier but no reliable chain of sightings in this draft. Keep the discrepancy open rather than inventing a victim or a resolution.",
        "Inception audit":
          "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
        "Manifest discrepancy": "The discrepancy stays open. No missing person is invented to make the count fit.",
        "Redacted ledger fragment": "Only a missing entry is recovered. The case remains unresolved.",
        "Audit training note":
          "A careful audit makes evidence work easier. It adds one focus-equivalent point to signal calibration tolerance.",
        "Holden\u2019s recording":
          "The record contains small delays, large uncertainty, and the sound of a room becoming an emergency. It will help you listen more carefully next time.",
        "Hospital visit record": "The nurse takes over. Your visit leaves the breathing support undisturbed.",
        "Bookmarked page": "Holden has lost his place. The screen scrolls faster than his breathing.",
        "Tyrell flight log": "The city traffic separates from the Tyrell approach lane.",
        "Tyrell visitor clearance":
          "Security protects the company from almost everything except the questions that people bring through the door.",
        "Artificial owl observation":
          "Its movements are exquisitely economical. Its price would buy a lot of real things the city no longer has.",
        "Rachael reception notes": "The interview appointment begins.",
        "Owl care card":
          "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
        "Rachael baseline": "The instrument is ready for an extended test.",
        "Memory warranty":
          "The warranty excludes distress arising from autobiographical inconsistency. Someone had to write that sentence.",
        "Hotel register":
          "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
        "Room entry record": "The room is entered and the search log begins.",
        "Restored luggage label": "The luggage can be returned without opening it.",
        "Leon\u2019s photographs":
          "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
        "Wardrobe observation":
          "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
        "Preserved photo sequence":
          "Evidence labels would be easier if you separated everything. A handwritten arrangement suggests the order mattered to Leon.",
        "Clean cabinet observation":
          "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
        "Unidentified scale":
          "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
        "Hotel search conclusion": "The image goes to the Esper. The scale needs a physical comparison.",
        "Window sighting":
          "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
        "Nexus eye design":
          "A thousand unfinished gazes float in solution. Leon refuses to be stared down by any of them.",
        "Eye-tank service code": "The design reference is readable. The tank remains sealed.",
        "Heater restored": "A torn coat cannot protect a man from this cold. Reconnect the heater before leaving.",
        "Component route card":
          "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
        "Sebastian contact lead": "The lead points toward Sebastian, not toward a cure inside this freezer.",
        "Cooler duty log": "The log records a repair delay, not a biological cure.",
        "Home entry log": "The door opens. Rachael enters with Deckard.",
        "Offered childhood portrait":
          "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
        "Repaired door bell": "A neighbour cannot hear the failing door bell.",
        "Memory distinction":
          "The photograph cannot certify the owner of a memory. That does not erase the distress in the room.",
        "Rachael\u2019s photograph":
          "After she leaves, the little image remains. It does not stop being someone\u2019s mother because the story around it changed.",
        "Sebastian\u2019s mechanical friends":
          "Two little figures march out to greet their maker. Sebastian has filled a lonely home with company he built himself.",
        "Mechanical friend detail":
          "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
        "Returned post":
          "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
        "Unicorn daydream":
          "An image from the film-informed route. It does not independently establish Deckard\u2019s identity.",
        "Unplaced dream record": "The daydream ends. Record the image without deciding what it proves.",
        "Contact-sheet record":
          "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
        "Esper scan record": "The full image is loaded. Cropping has not removed the edges.",
        "Photo edge preserved":
          "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
        "Esper hard copy":
          "Move the inspection frame to the glint inside the wardrobe, then increase magnification. The image grid, not brute force, is your map.",
        "Evidence wallet":
          "Sequins would be convenient. The material feels wrong. Put the comparison in your wallet; another pair of eyes may do better.",
        "Esper comparison": "The garment suggests a performer. The physical sample still needs a separate check.",
        "Esper safely cooled": "Its cooling fan has acquired a desperate rattle. A simple power-down costs nothing.",
        "Clean sample record": "The samples remain clean. You leave for the lower city.",
        "Tap repaired": "The service card shows the correct valve pattern.",
        "Fish-scale comparison":
          "Close, but not the same. Enough to justify a visit to the animal dealers, not enough to write a conclusion.",
        "Fish comparison finding": "The comparison sends you to the animal dealers. It does not yet identify a snake.",
        "Scale reference cards":
          "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
        "Reptile referral": "The reference cards support a reptile examination.",
        "Terrarium repair":
          "The heat lamp is broken. Its tiny occupant keeps seeking a patch of warmth that is not there.",
        "Unclaimed delivery": "The shop agrees to hold the parcel until its owner returns.",
        "Specimen calibration": "The embedded mark separates from the tissue pattern.",
        "Snake serial 99069745xb7Y":
          "A number is embedded in the manufactured tissue. Adjust the lens until the lettering stops swimming.",
        "Serial photograph":
          "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
        "Snake sale invoice":
          "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
        "Taffey venue lead": "The serial and invoice support a visit to Taffey\u2019s.",
        "Care routine record":
          "A detailed witness record. It opens an evidence-present option in the club and records care that the dossier omits.",
        "Floor-server account": "The service route is clear. The performer is still at the club.",
        "Backstage routine":
          "A server has seen Salome check the snake\u2019s enclosure after every set. Routine can reveal a person without exposing a hiding place.",
        "Club call record": "The connection is usable.",
        "Salome stage bill":
          "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
        "Stage monitor repaired": "A stage monitor has a loose service channel.",
        "Staff pickup notice": "The closing staff have a confirmed ride home.",
        "Zhora\u2019s artificial snake":
          "The engineered pattern matches. Cosmetics, costume pieces, and a carefully tended snake occupy the dressing table.",
        "Zhora trace conclusion": "The sample, invoice, and enclosure form one chain. The interview can proceed.",
        "Arcade route record":
          "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
        "Revised order": "Rachael is added to the assignment. Deckard does not act on that order here.",
        "Crowd-route observation":
          "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
        "First-aid dressing":
          "The mirror gives you an honest inventory of damage. A clean dressing and a moment without pursuit do their work.",
        "Returned weapon record":
          "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
        "Safe-room record": "The immediate danger is over. The conversation can begin.",
        "Rachael piano account": "The piano falls quiet. The room remains a temporary refuge.",
        "Dress-room observation":
          "Dusty gowns form an audience. A mirror briefly offers a life there is not time to live.",
        "Dress-room detail":
          "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
        "Sebastian bench record":
          "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
        "Quiet toy clock": "A clockwork friend repeats the same greeting.",
        "Friends repair plan": "A saved repair plan. In stealth encounters it reduces the alert increase by 20%.",
        "Deckard photo record":
          "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
        "Unfinished chess position":
          "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
        "Sebastian agreement": "Sebastian agrees to go. Roy follows him to the lift.",
        "Friends service register": "The register preserves his repair notes for whoever comes next.",
        "Hospital surveillance trace":
          "A red indicator on the room terminal reveals that this is not a private conversation. The casebook gains a question mark beside the department itself.",
        "Second-channel record": "The room has a second listener. The recording does not identify every listener.",
        "Vid-phone carrier record": "The caller\u2019s face can be compared frame by frame.",
        "Pris vid-phone still": "Bring the vid-phone image into focus, then compare it with the dossier.",
        "Pris caller match": "The caller is identified as Pris. Sebastian\u2019s address becomes the next destination.",
        "Sebastian\u2019s access cards":
          "The elevator expects a matching clearance for each colour-coded security level. Red eighteen is marked on one card.",
        "Lift clearance record": "The lift accepts the cards and opens the private channel.",
        "Chess access sequence":
          "A queen can be given up to open a bishop\u2019s path. Select the queen\u2019s destination, then the bishop\u2019s finishing square.",
        "Private-room access": "The doors open. Sebastian enters first. Roy follows him to the maker.",
        "Modification review":
          "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
        "Longevity dead end":
          "Every available procedure fails to give Roy a viable extension. The conclusion is technical. What follows is not. Violence is heard beyond the terminal; the scene fades before impact.",
        "Maker-visit conclusion":
          "The records supply no repair. What follows is a story event, not a reward for solving the puzzle.",
        "Tyrell incident record":
          "The scene cuts away from the violence. Tyrell and Sebastian do not survive. Roy returns to the lift alone.",
        "Descent record": "The lift reaches its exit. Roy heads back to Pris.",
        "Bradbury dispatch record": "The incident points back to Sebastian\u2019s address.",
        "Bradbury entrance record":
          "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
        "Delivery reply": "The owner has been found. No address is added to the police file.",
        "Upper-floor maintenance route":
          "The little machine has left a route around unsafe stairs. The repaired service map makes the marks easier to understand.",
        "Stair lamp repaired": "The stair lamp can run from its emergency channel.",
        "Mannequin heat trace":
          "Painted eyes, fixed smiles, cloth, dust. The infrared goggles distinguish warmth, not innocence.",
        "Display comparison":
          "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
        "Spare energy cassette":
          "The service blaster accepts the cassette with an indecently loud click. The room remains still.",
        "Reloaded service blaster":
          "The cassette seats in the blaster. Footsteps approach. The stairs no longer look like a safe way out.",
        "Upper-floor plan":
          "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
        "Broken-hand record":
          "The injury is retained in the story. The room gives you a support sequence before the roof.",
        "Armoire route":
          "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
        "Secured hand support": "The hand is supported. The next crash comes from beside the basin.",
        "Closet latch record": "The closet door opens. Deckard moves through it.",
        "Window-board record":
          "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
        "Open bird vent": "The vent opens. The birds have another way out.",
        "Roof-gap observation":
          "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
        "Rooftop witness":
          "A pigeon settles nearby, then flies. Roy is still. The city begins another day without asking whether this one mattered.",
        "Final witness record":
          "Record that Roy saved you. Do not turn that act into a malfunction to make the report easier.",
        "Rain observation":
          "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
        "Kitchen return observation":
          "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
        "Rachael alive": "Rachael is asleep, breathing. The tension in your shoulders finally changes into urgency.",
        "Safe-corridor note": "A neighbour\u2019s route note. It reduces noise during stealth encounters by 15%.",
        "Parachute bag":
          "Clothes, the remaining cassettes, a photograph. Not much of a life fits in a parachute bag, but enough can travel.",
        "Packed escape case": "The case closes. Deckard and Rachael leave together.",
        "Private return note": "The item is left where its owner can collect it.",
        "Corridor conclusion":
          "Gaff has been here. Rachael is alive. Keep the remaining implication as a question, not a new certified memory.",
        "Closed-lift record": "The doors meet. The film-informed route ends here.",
        "Departure record":
          "No pursuer is added to this version of the ending. The record closes with the two travellers together.",
      },
      COVERAGE: [
        ["The city below", "A story beat shared by the draft and film. The playable route is an adaptation."],
        ["Before the rain", "A draft story beat. Gameplay and dialogue are newly written."],
        ["Two, not four", "A draft story beat. Gameplay and dialogue are newly written."],
        ["A seat beside Gaff", "A story beat shared by the draft and film. The playable route is an adaptation."],
        ["The night desk", "An original connecting investigation. It does not establish new film facts."],
        ["Borrowed badge", "A draft story beat. Gameplay and dialogue are newly written."],
        ["Faces on the wall", "An original connecting investigation. It does not establish new film facts."],
        ["Artificial breathing", "A draft story beat. Gameplay and dialogue are newly written."],
        ["Above the furnace", "A draft story beat. Gameplay and dialogue are newly written."],
        ["The expensive bird", "A story beat shared by the draft and film. The playable route is an adaptation."],
        ["More than a memory", "A draft story beat. Gameplay and dialogue are newly written."],
        ["The room at the end", "An original connecting investigation. It does not establish new film facts."],
        ["A carefully kept room", "A draft story beat. Gameplay and dialogue are newly written."],
        ["Something in the grout", "A draft story beat. Gameplay and dialogue are newly written."],
        ["A room you cannot enter", "A draft story beat. Gameplay and dialogue are newly written."],
        ["Just eyes", "A draft story beat. Gameplay and dialogue are newly written."],
        ["A name beyond the eyes", "An original connecting investigation. It does not establish new film facts."],
        [
          "The visitor in the corridor",
          "A story beat shared by the draft and film. The playable route is an adaptation.",
        ],
        ["Proof of childhood", "A draft story beat. Gameplay and dialogue are newly written."],
        ["Shelter from the rain", "A story beat shared by the draft and film. The playable route is an adaptation."],
        ["The lift and the little army", "A draft story beat. Gameplay and dialogue are newly written."],
        [
          "A memory without a date",
          "Unicorn daydream from the later film cuts. This is not a scene in the supplied draft.",
        ],
        ["Every picture has edges", "An original connecting investigation. It does not establish new film facts."],
        ["A room inside a photograph", "A draft story beat. Gameplay and dialogue are newly written."],
        ["The tap that will not stop", "A draft story beat. Gameplay and dialogue are newly written."],
        ["The wrong fish", "A draft story beat. Gameplay and dialogue are newly written."],
        [
          "The price of a living thing",
          "A story beat shared by the draft and film. The playable route is an adaptation.",
        ],
        ["A number under the skin", "A story beat shared by the draft and film. The playable route is an adaptation."],
        ["The maker\u2019s ledger", "A story beat shared by the draft and film. The playable route is an adaptation."],
        ["No free information", "A draft story beat. Gameplay and dialogue are newly written."],
        [
          "The call that does not help",
          "A story beat shared by the draft and film. The playable route is an adaptation.",
        ],
        ["Before the curtain", "A story beat shared by the draft and film. The playable route is an adaptation."],
        ["Salome\u2019s last dance", "A draft story beat. Gameplay and dialogue are newly written."],
        ["Through the arcade", "An original connecting investigation. It does not establish new film facts."],
        ["Through the glass", "A draft story beat. Gameplay and dialogue are newly written."],
        ["The count changes again", "Film aftermath beat. This route does not insert it into the draft order."],
        ["A face among umbrellas", "A story beat shared by the draft and film. The playable route is an adaptation."],
        ["Hard reset", "A draft story beat. Gameplay and dialogue are newly written."],
        ["A hand that shakes", "A story beat shared by the draft and film. The playable route is an adaptation."],
        [
          "Lessons without a teacher",
          "A story beat shared by the draft and film. The playable route is an adaptation.",
        ],
        ["Borrowed celebrations", "A draft story beat. Gameplay and dialogue are newly written."],
        [
          "Work that keeps him company",
          "A story beat shared by the draft and film. The playable route is an adaptation.",
        ],
        [
          "A room, not a cage",
          "The relationship beat is adapted with new, non-explicit dialogue and clear consent. It is not a verbatim scene.",
        ],
        [
          "A game with very little time",
          "A story beat shared by the draft and film. The playable route is an adaptation.",
        ],
        ["No honest mirror", "A draft story beat. Gameplay and dialogue are newly written."],
        [
          "The person on the other end",
          "A story beat shared by the draft and film. The playable route is an adaptation.",
        ],
        ["The frame that stays", "A draft story beat. Gameplay and dialogue are newly written."],
        ["Above the last public floor", "A draft story beat. Gameplay and dialogue are newly written."],
        ["The immortal game", "A draft story beat. Gameplay and dialogue are newly written."],
        [
          "The request behind the visit",
          "A story beat shared by the draft and film. The playable route is an adaptation.",
        ],
        ["No repair at the source", "A story beat shared by the draft and film. The playable route is an adaptation."],
        ["The lift returns alone", "A draft story beat. Gameplay and dialogue are newly written."],
        ["A building that listens", "A story beat shared by the draft and film. The playable route is an adaptation."],
        ["The unsafe stair", "A draft story beat. Gameplay and dialogue are newly written."],
        ["One shape too many", "A story beat shared by the draft and film. The playable route is an adaptation."],
        ["Dollhouse", "A draft story beat. Gameplay and dialogue are newly written."],
        ["The sound of the cage", "A story beat shared by the draft and film. The playable route is an adaptation."],
        ["Two fingers and a wall", "A story beat shared by the draft and film. The playable route is an adaptation."],
        ["A way through the ceiling", "A draft story beat. Gameplay and dialogue are newly written."],
        ["Tape, water, footsteps", "A draft story beat. Gameplay and dialogue are newly written."],
        ["The only opening left", "A draft story beat. Gameplay and dialogue are newly written."],
        ["A wall at your shoulder", "A story beat shared by the draft and film. The playable route is an adaptation."],
        ["A long way down", "A draft story beat. Gameplay and dialogue are newly written."],
        ["The witness in the rain", "A draft story beat. Gameplay and dialogue are newly written."],
        [
          "The other man on the roof",
          "A story beat shared by the draft and film. The playable route is an adaptation.",
        ],
        ["The room behind the door", "A story beat shared by the draft and film. The playable route is an adaptation."],
        ["Only what you can carry", "A draft story beat. Gameplay and dialogue are newly written."],
        ["The smallest visitor", "A story beat shared by the draft and film. The playable route is an adaptation."],
        ["The doors close", "Later film ending. It replaces, rather than precedes, the draft forest pursuit."],
        ["No promised land", "A draft story beat. Gameplay and dialogue are newly written."],
        [
          "A road without a promise",
          "Theatrical-ending variant. No claim that the full route is a shot-for-shot theatrical cut.",
        ],
      ],
      VK_QUESTIONS: [
        {
          prompt:
            "Someone leaves an injured animal beside a public walkway. The subject describes the scene but not a response.",
          answers: [
            "Ask what they would do next.",
            "Repeat the measurement without context.",
            "Demand an immediate answer.",
          ],
        },
        {
          prompt:
            "A childhood keepsake is lost. The subject recalls its texture more clearly than the person who gave it.",
          answers: ["Give the memory time to surface.", "Ask for a precise date.", "Call the memory unreliable."],
        },
        {
          prompt:
            "A stranger risks their life for someone who has harmed them. The subject asks why the risk was necessary.",
          answers: [
            "Ask what the stranger might value.",
            "Return to the original wording.",
            "Treat hesitation as a confession.",
          ],
        },
      ],
      VERSION: a,
      ROUTES: {
        draft: [
          "hades",
          "holden",
          "noodles",
          "spinner-recall",
          "police-lobby",
          "bryant",
          "dossier-room",
          "hospital-one",
          "tyrell-flight",
          "tyrell-ante",
          "rachael-test",
          "hotel-corridor",
          "leon-bedroom",
          "leon-bathroom",
          "leon-window",
          "chew",
          "chew-service",
          "home-arrival",
          "rachael-memory",
          "pris-street",
          "bradbury-welcome",
          "esper-setup",
          "esper-search",
          "home-reset",
          "fish-counter",
          "animal-row",
          "scale-bench",
          "hassan",
          "taffey",
          "vidphone",
          "club-floor",
          "zhora-backstage",
          "zhora-arcade",
          "zhora-pursuit",
          "rachael-crowd",
          "leon-attack",
          "home-firstaid",
          "home-piano",
          "pris-dresses",
          "sebastian-lab",
          "home-trust",
          "roy-sebastian",
          "hospital-two",
          "sebastian-call",
          "pris-playback",
          "tyrell-lift",
          "chess-access",
          "maker-question",
          "maker-fall",
          "roy-descent",
          "bradbury-return",
          "bradbury-stairs",
          "doll-room",
          "pris-ambush",
          "roy-return",
          "billiard",
          "armoire",
          "upper-bath",
          "pigeon-closet",
          "outer-ledge",
          "roof-leap",
          "roy-witness",
          "gaff-dawn",
          "home-last",
          "packing",
          "unicorn-corridor",
          "forest-draft",
        ],
        final: [
          "hades",
          "holden",
          "noodles",
          "spinner-recall",
          "police-lobby",
          "bryant",
          "dossier-room",
          "tyrell-flight",
          "tyrell-ante",
          "rachael-test",
          "hotel-corridor",
          "leon-bedroom",
          "leon-bathroom",
          "leon-window",
          "chew",
          "chew-service",
          "home-arrival",
          "rachael-memory",
          "pris-street",
          "bradbury-welcome",
          "unicorn-dream",
          "esper-setup",
          "esper-search",
          "fish-counter",
          "animal-row",
          "scale-bench",
          "hassan",
          "taffey",
          "vidphone",
          "club-floor",
          "zhora-backstage",
          "zhora-arcade",
          "zhora-pursuit",
          "street-bryant",
          "rachael-crowd",
          "leon-attack",
          "home-firstaid",
          "home-piano",
          "pris-dresses",
          "sebastian-lab",
          "home-trust",
          "roy-sebastian",
          "sebastian-call",
          "pris-playback",
          "tyrell-lift",
          "chess-access",
          "maker-question",
          "maker-fall",
          "roy-descent",
          "bradbury-return",
          "bradbury-stairs",
          "doll-room",
          "pris-ambush",
          "roy-return",
          "billiard",
          "armoire",
          "upper-bath",
          "pigeon-closet",
          "outer-ledge",
          "roof-leap",
          "roy-witness",
          "gaff-dawn",
          "home-last",
          "packing",
          "unicorn-corridor",
          "final-lift",
        ],
        theatrical: [
          "hades",
          "holden",
          "noodles",
          "spinner-recall",
          "police-lobby",
          "bryant",
          "dossier-room",
          "tyrell-flight",
          "tyrell-ante",
          "rachael-test",
          "hotel-corridor",
          "leon-bedroom",
          "leon-bathroom",
          "leon-window",
          "chew",
          "chew-service",
          "home-arrival",
          "rachael-memory",
          "pris-street",
          "bradbury-welcome",
          "esper-setup",
          "esper-search",
          "fish-counter",
          "animal-row",
          "scale-bench",
          "hassan",
          "taffey",
          "vidphone",
          "club-floor",
          "zhora-backstage",
          "zhora-arcade",
          "zhora-pursuit",
          "street-bryant",
          "rachael-crowd",
          "leon-attack",
          "home-firstaid",
          "home-piano",
          "pris-dresses",
          "sebastian-lab",
          "home-trust",
          "roy-sebastian",
          "sebastian-call",
          "pris-playback",
          "tyrell-lift",
          "chess-access",
          "maker-question",
          "maker-fall",
          "roy-descent",
          "bradbury-return",
          "bradbury-stairs",
          "doll-room",
          "pris-ambush",
          "roy-return",
          "billiard",
          "armoire",
          "upper-bath",
          "pigeon-closet",
          "outer-ledge",
          "roof-leap",
          "roy-witness",
          "gaff-dawn",
          "home-last",
          "packing",
          "unicorn-corridor",
          "forest-theatrical",
        ],
      },
      ROUTE_META: {
        draft: {
          label: "1981 DRAFT ROUTE",
          description:
            "Expanded draft order. Includes the hospital visits and the forest pursuit. No unicorn daydream.",
          ending: "forest-draft",
        },
        final: {
          label: "FINAL CUT\u2013INFORMED ROUTE",
          description:
            "Expanded playable adaptation with the unicorn dream and a closing lift. No hospital visits or forest ending.",
          ending: "final-lift",
        },
        theatrical: {
          label: "THEATRICAL-ENDING ROUTE",
          description:
            "Expanded film-informed adaptation without the daydream. Ends on the open forest road, without the draft pursuit.",
          ending: "forest-theatrical",
        },
      },
      LEGACY_SCENES: {
        0: "holden",
        1: "noodles",
        2: "police-lobby",
        3: "hospital-one",
        4: "tyrell-flight",
        5: "tyrell-ante",
        6: "hotel-corridor",
        7: "chew",
        8: "home-arrival",
        9: "pris-street",
        10: "esper-setup",
        11: "home-reset",
        12: "animal-row",
        13: "taffey",
        14: "club-floor",
        15: "zhora-arcade",
        16: "leon-attack",
        17: "home-firstaid",
        18: "pris-dresses",
        19: "hospital-two",
        20: "sebastian-call",
        21: "roy-sebastian",
        22: "maker-question",
        23: "bradbury-return",
        24: "doll-room",
        25: "roy-return",
        26: "outer-ledge",
        27: "roy-witness",
        28: "home-last",
        29: "forest-draft",
      },
      sceneIndex: (c) => e.findIndex((h) => h.key === c),
    };
  })(),
  {
    districtHeight: iT,
    districtAreaAt: Y3,
    buildDistrict: dX,
    animateDistrict: uX,
  } = (() => {
    let a = (c, h, d) => Math.max(h, Math.min(d, c));
    function e(c, h) {
      return c >= 38.5 && c <= 41.7 && h <= -51 && h >= -67
        ? a((-51 - h) / 16, 0, 1) * 4.4
        : c >= 18 && c <= 41.7 && h < -67 && h >= -73.5
          ? 4.4
          : 0;
    }
    function t(c, h) {
      let d = null,
        f = 1 / 0;
      for (let g of $s) {
        let u = Math.hypot(c - g.x, (h - g.z) * 0.9);
        u < f && ((d = g), (f = u));
      }
      return d;
    }
    function s(c) {
      return () => ((c = (Math.imul(c, 1664525) + 1013904223) >>> 0), c / 4294967296);
    }
    function i(c, h) {
      let d = h.x,
        f = h.z,
        g = h.color,
        u = (y, b, x, T, v, A, S, _ = {}) => c.box(d + y, b, f + x, T, v, A, S, { district: !0, lifeDetail: !0, ..._ });
      (u(0, -0.08, -4, 20, 0.16, 12, "#293f43", { ground: !0 }),
        u(0, 2, -10, 20, 4, 0.35, "#2d4145", { collide: !0 }),
        u(-10, 2, -5, 0.3, 4, 10, "#34434a", { collide: !0 }),
        u(10, 2, -5, 0.3, 4, 10, "#34434a", { collide: !0 }));
      for (let y of [-9.7, 9.7]) u(y, 2, 1, 0.22, 4, 0.25, "#54615d", { collide: !0 });
      (u(0, 4.18, -3.5, 21, 0.32, 14, "#344b50"), u(0, 3.74, 1.35, 19, 0.23, 0.18, g, { emissive: 0.8 }));
      let p = c.sign(h.shop.toUpperCase(), d, 3.08, f + 1.8, 15, 0.85, g);
      ((p.district = !0),
        u(-5, 0.56, -1, 6, 1.05, 1.7, "#4c5551", { collide: !0 }),
        u(-5, 1.16, -1, 6.2, 0.14, 1.85, "#879287"));
      for (let y of [0.6, 1.65, 2.7]) {
        u(0, y, -9, 16, 0.12, 0.8, "#687369");
        for (let b = 0; b < 11; b++)
          u(
            -7.4 + b * 1.4,
            y + 0.3,
            -9,
            0.35 + (b % 3) * 0.13,
            0.47,
            0.34,
            ["#af956f", "#82988b", "#855b50", "#c7bb92"][b % 4],
          );
      }
      for (let y of [-8, 8]) u(y, 2.8, -6, 0.2, 0.16, 0.38, g, { emissive: 2 });
      if (
        (u(8, 1.05, -7, 1.2, 1.8, 1.1, "#3d5658"),
        u(8, 1.4, -6.38, 0.8, 0.4, 0.035, g, { emissive: 0.4 }),
        h.id !== "roof")
      ) {
        (u(0, 7.6, -5, 20, 6.6, 9, "#1e343f"), u(0, 11, -5, 21, 0.3, 10, "#46565b"));
        for (let y = 0; y < 5; y++) {
          let b = -7.5 + y * 3.8;
          (u(b, 7.25, -0.44, 1.65, 2.1, 0.1, y % 3 ? "#977b53" : "#446677", { emissive: 0.45 }),
            u(b, 7.25, -0.34, 0.05, 2.1, 0.09, "#243940"));
        }
        (u(0, 6, -0.1, 20, 0.12, 1, "#53616a"), u(0, 6.75, 0.42, 20, 0.09, 0.08, "#70817a"));
        for (let y = 0; y < 10; y++) u(-9 + y * 2, 6.38, 0.42, 0.06, 0.7, 0.06, "#667875");
      }
      for (let y = 0; y < 9; y++) u(-9 + y * 2.2, 0.005, 10, 0.9, 0.01, 0.06, "#344950");
      if (
        (u(-9, 1.4, 6, 0.15, 2.8, 0.16, "#617574"), u(-9, 2.8, 6, 0.65, 0.1, 0.65, g, { emissive: 1 }), h.id !== "roof")
      ) {
        let y = {
          noodles: "EAT",
          protein: "GRILL",
          umbrella: "RAIN",
          animals: "PETS",
          memory: "MEMORY",
          medicine: "CARE",
          west: "REPAIR",
          bazaar: "TEA",
          transit: "LOCAL",
          east: "FREIGHT",
          temple: "BOOKS",
        };
        (c.sign(y[h.id], d + 9.5, 7.8, f + 2.6, 1.7, 5.7, g), u(-9.5, 5.1, 1.6, 0.2, 0.8, 0.2, g, { emissive: 2 }));
      }
      c.light(d, 4, f + 4, g, 50);
      let m = (y, b, x, T, v = 1) => c.prop(y, d + b, x, f + T, v);
      if (h.id === "noodles" || h.id === "protein") {
        for (let b = 0; b < 4; b++)
          (u(-7 + b * 1.5, 1.3, -1, 0.7, 0.12, 0.6, "#c6c3a4"),
            u(-7 + b * 1.5, 1.38, -1, 0.45, 0.055, 0.38, "#8c6743"));
        (u(-7, 2.7, -2, 0.06, 1.2, 0.07, "#495954"), u(-7, 1.6, -1, 0.1, 0.25, 0.8, "#8b9d92"));
        for (let b of [-7, -4, -1]) u(b, 0.52, 2.8, 0.7, 1, 0.7, "#566865");
        let y = c.box(d - 6, 2.1, f, 0.3, 0.45, 0.3, "#98b0ab", { dynamic: !0, alpha: 0.18, district: !0 });
        c.district.effects.push({ kind: "steam", object: y, baseY: 2.1, x: d - 6, z: f, phase: h.index });
      }
      if (h.id === "umbrella") {
        for (let x = 0; x < 6; x++) {
          let T = -7 + x * 2.7;
          (u(T, 2.6, -7, 1.8, 0.13, 1.3, ["#71495d", "#86714c", "#417075"][x % 3]),
            u(T, 1.85, -7, 0.055, 1.5, 0.055, "#bac1a8"));
        }
        let y = u(0, 4.15, 5, 20, 0.15, 7, "#766450", { dynamic: !0 });
        c.district.stateProps.canopy = y;
        let b = u(2, 2.5, 5, 0.03, 0.4, 0.035, "#a2c9d0", { dynamic: !0, emissive: 0.3 });
        c.district.effects.push({ kind: "leak", object: b, baseY: 2.5, x: d + 2, z: f + 5, phase: 1 });
      }
      if (h.id === "animals") {
        for (let b of [-7, 0, 7]) {
          u(b, 0.5, -7, 2.6, 1, 1.6, "#526866");
          for (let x of [-1.2, 0, 1.2]) u(b + x, 1.7, -7, 0.055, 1.5, 0.055, "#b7c3ad");
          u(b, 2.46, -7, 2.6, 0.1, 1.7, g);
        }
        let y = c.character("Shared electric sheep", d - 1, f + 6, "#c7c5a5", { skin: "#b8ad8b" });
        ((y.patrol = !0), (y.animal = !0));
        for (let b of y.parts) ((b.oy *= 0.45), (b.h *= 0.45), (b.ox *= 0.8), (b.w *= 0.8));
        ((y.districtEffect = "sheep"),
          c.district.pets.push(y),
          m("owl", 6, 1.4, -7, 0.75),
          m("snake", -7, 1.35, -7, 1.1));
      }
      if (h.id === "memory") {
        for (let y = 0; y < 5; y++)
          (u(-7 + y * 3.4, 2.6, -9, 0.95, 0.9, 0.12, "#9f8b68"), u(-7 + y * 3.4, 2.6, -8.9, 0.7, 0.7, 0.04, "#73908b"));
        (m("photo", -5, 1.3, -1, 1.2), m("cabinet", 6, 0, -1, 1.7));
      }
      if (h.id === "medicine") {
        for (let y of [-6, 0, 6]) (u(y, 0.6, 5, 2.2, 0.2, 0.9, "#8b9a8a"), u(y, 1, 4.55, 2.2, 0.7, 0.12, "#627d75"));
        (u(6, 2.4, -6, 1.7, 0.22, 0.06, g, { emissive: 2 }), u(6, 2.4, -6, 0.22, 1.7, 0.06, g, { emissive: 2 }));
      }
      if (h.id === "west") {
        for (let y = 0; y < 5; y++)
          (u(-7 + y * 3.2, 2.4, -8, 0.5, 0.7, 0.35, "#a2ac91"), u(-7 + y * 3.2, 2.95, -8, 0.06, 0.45, 0.08, "#627d77"));
        m("device", -6, 1.32, -1, 1.2);
      }
      if (h.id === "bazaar") {
        (u(0, 0.12, 7, 6, 0.25, 2.7, "#60493c"), u(0, 0.92, 7, 2.2, 0.12, 0.6, "#283a40"));
        for (let b = 0; b < 12; b++) u(-1 + b * 0.17, 1.01, 7, 0.12, 0.055, 0.42, b % 3 === 0 ? "#152c32" : "#bcc5ae");
        let y = u(0, 2.3, 7, 0.5, 0.22, 0.5, "#3f535c", { dynamic: !0, emissive: 0.6 });
        c.district.stateProps.music = y;
        for (let b of [-7, 7]) (u(b, 0.8, 5, 2.6, 0.14, 1.7, "#657166"), u(b, 0.4, 5, 0.22, 0.8, 0.22, "#4a5a58"));
      }
      if (
        (h.id === "transit" &&
          (u(10, 5, 7, 0.4, 10, 0.4, "#465c64"),
          u(-10, 5, 7, 0.4, 10, 0.4, "#465c64"),
          c.sign("LOCAL 06  /  REVISED PLATFORM", d, 4.7, f + 5, 14, 0.65, g),
          m("paper", -4, 1.3, -1, 1.4)),
        h.id === "east")
      ) {
        for (let y of [-7, 0, 7])
          (u(y, 0.6, -6, 2, 1.2, 1.8, "#755a41", { collide: !0 }), u(y, 1.28, -6, 1.9, 0.12, 1.7, "#637766"));
        u(-8, 0.7, 6, 2.2, 0.18, 1.4, "#817369");
      }
      if (h.id === "temple") {
        u(7, 0.6, -2, 2.4, 1.2, 1.3, "#625b4a");
        for (let y = 0; y < 5; y++) u(6.2 + y * 0.4, 1.42, -2, 0.14, 0.45, 0.14, g, { emissive: 1.5 });
        (m("chess", -5, 1.32, -1, 0.9), u(-4, 0.5, 6, 4, 0.2, 1, "#6b6656"));
      }
      if (h.id === "roof") {
        for (let y = 0; y < 24; y++) {
          let b = -51 - ((y + 0.5) * 16) / 24,
            x = ((y + 0.5) / 24) * 4.4;
          c.box(40.1, x / 2, b, 2.7, x, 16 / 24 + 0.02, "#5c7274", { district: !0 });
        }
        c.box(29.5, 4.28, -70, 23, 0.24, 6.5, "#50686b", { district: !0 });
        for (let y of [18.1, 41.7]) c.box(y, 4.95, -70, 0.12, 1.3, 6.7, "#899f9a", { district: !0, collide: !0 });
        c.box(30, 4.95, -73.4, 23.5, 1.3, 0.12, "#708c8b", { district: !0, collide: !0 });
        for (let y = 0; y < 8; y++)
          c.box(41.7, 1 + y * 0.57, -51 - y * 2, 0.08, 1.3, 0.12, "#9bafa6", { district: !0 });
        (c.sign("SHARED ROOF  \u2192", d + 8, 3.1, f + 8, 5, 0.6, g),
          u(7, 8, -4, 0.12, 9, 0.12, "#809997"),
          u(7, 11, -4, 4, 0.1, 0.1, "#819b94"));
      }
    }
    function r(c, h, d, f, g, u) {
      let p = ["#416171", "#756254", "#535f57", "#65576a", "#a28761", "#42666b"],
        m = {
          name: "Local passer-by",
          id: "crowd-" + h,
          x: d,
          z: f,
          y: 0,
          parts: [],
          phase: g * 1.93,
          patrol: !0,
          active: !0,
          districtCrowd: !0,
          area: u.id,
          base: { x: d, z: f },
          style: g % 6,
          clock: 0,
          mode: g % 4 === 0 ? "browse" : g % 7 === 0 ? "sweep" : g % 5 === 0 ? "wait" : "walk",
        },
        y = (b, x, T, v, A, S, _, k = 0) => {
          let E = c.box(d + b, x, f + T, v, A, S, _, {
            dynamic: !0,
            district: !0,
            crowd: !0,
            lifeDetail: !0,
            noShadow: !0,
          });
          (Object.assign(E, { ox: b, oy: x, oz: T, lod: k }), m.parts.push(E));
        };
      return (
        y(0, 0.82, 0, 0.58, 0.9, 0.36, p[g % 6]),
        y(0, 1.5, 0, 0.42, 0.42, 0.4, ["#bd8968", "#7c5845", "#c8a480"][g % 3]),
        y(-0.17, 0.26, 0, 0.22, 0.52, 0.3, "#23343d"),
        y(0.17, 0.26, 0, 0.22, 0.52, 0.3, "#23343d"),
        y(-0.4, 0.88, 0, 0.17, 0.65, 0.24, p[g % 6], 1),
        y(0.4, 0.88, 0, 0.17, 0.65, 0.24, p[g % 6], 1),
        y(0, 1.73, -0.02, 0.43, 0.1, 0.4, "#243139", 1),
        g % 3 === 0 &&
          (y(0, 2.25, 0, 1.5, 0.15, 1.2, ["#738b78", "#91724e", "#695268"][g % 3]),
          y(0.25, 1.7, 0, 0.025, 1.1, 0.025, "#93a39b", 1)),
        g % 5 === 0 && y(0.47, 0.62, 0.2, 0.4, 0.55, 0.32, "#927554", 1),
        c.actors.push(m),
        m
      );
    }
    function n(c) {
      ((c.outside = !0),
        (c.sheltered = !1),
        (c.day = !1),
        (c.bounds = { minX: -42, maxX: 42, minZ: -74, maxZ: 27 }),
        (c.isDistrict = !0),
        (c.groundHeight = e),
        (c.district = {
          npcs: [],
          crowd: [],
          spots: [],
          effects: [],
          pets: [],
          stateProps: {},
          clock: 0,
          spawn: { x: 13.5, z: 23, yaw: 0.2 },
          metrics: { near: 0, mid: 0, far: 0 },
          zones: $s,
        }),
        (c.animations = []),
        c.box(0, -0.25, -24, 100, 0.5, 112, "#18313b", { ground: !0 }));
      for (let p of [-14, 14]) {
        c.box(p, 0.008, -23, 5, 0.015, 98, "#29414a");
        for (let m = -70; m < 27; m += 7) c.box(p, 0.02, m, 0.1, 0.01, 2.4, "#738379", { emissive: 0.08 });
      }
      for (let p of [24, 0, -24, -48, -72]) c.box(0, 0.013, p, 86, 0.015, 3.3, "#314950");
      for (let p of $s) i(c, p);
      let h = s(13250);
      for (let p = 0; p < 40; p++) {
        let m = (p % 2 ? 1 : -1) * (48 + h() * 15),
          y = 27 - Math.floor(p / 2) * 6,
          b = 15 + h() * 32;
        c.box(m, b / 2, y, 7, b, 5, "#182c39");
        for (let x = 0; x < 6; x++)
          c.box(m, 4 + x * 4, y + 2.54, 2.5, 0.85, 0.05, x % 2 ? "#3c6979" : "#94744e", { emissive: 0.35 });
      }
      for (let p = 0; p < 16; p++) {
        let m = -42 + p * 5.5,
          y = 18 + h() * 35;
        c.box(m, y / 2, -82, 5, y, 6, "#203743");
        for (let b = 0; b < 5; b++) c.box(m, 3 + b * 4, -78.9, 1.8, 0.8, 0.06, "#6a8178", { emissive: 0.3 });
      }
      (c.box(1, 24, -55, 24, 3.8, 6, "#34505e"),
        c.sign("A DIFFERENT LIFE / OFF WORLD", 1, 24, -51.8, 21, 2.2, "#dcc082"),
        c.box(0, 14, -28, 90, 0.45, 4, "#263c48"));
      for (let p = -40; p <= 40; p += 8) c.box(p, 15, -26, 0.15, 1.8, 0.15, "#738b8b");
      for (let p = 0; p < 5; p++) {
        let m = [],
          y = [];
        for (let b of [
          c.box(-35 + p * 16, 15.1, -28, 4, 1.1, 2.8, "#57717c", { dynamic: !0 }),
          c.box(-35 + p * 16, 15.75, -28, 2.6, 0.5, 2.3, "#33535e", { dynamic: !0 }),
          c.box(-35 + p * 16, 15.1, -26.5, 3.1, 0.15, 0.08, "#e6b87a", { dynamic: !0, emissive: 1.8 }),
        ])
          (m.push(b), y.push({ x: b.x, y: b.y, z: b.z }));
        c.animations.push({ kind: "traffic", parts: m, base: y, phase: p });
      }
      for (let p = 0; p < 70; p++)
        c.box(
          -40 + h() * 80,
          0.03,
          -70 + h() * 93,
          0.4 + h() * 1.6,
          0.01,
          0.8 + h() * 2,
          ["#447c83", "#b39360", "#775c7c"][p % 3],
          { alpha: 0.18, emissive: 0.25, district: !0, lifeDetail: !0 },
        );
      for (let p of Sl) {
        let [m, y] = p.position,
          b = c.character(p.name, m, y, p.look.coat, {
            skin: p.look.skin,
            hair: p.look.hair,
            hat: p.look.accessory === "cap",
            patrol: !0,
          });
        ((b.namedDistrict = !0),
          (b.person = p),
          (b.y = e(m, y)),
          (b.base = { x: m, z: y }),
          (b.clock = p.index * 0.7),
          (b.facing = 0));
        for (let x of b.parts) ((x.district = !0), (x.lifeDetail = !0));
        (c.district.npcs.push(b),
          c.district.spots.push({
            id: "person:" + p.id,
            type: "person",
            person: p,
            x: m,
            z: y,
            y: b.y + 1.4,
            name: p.name,
          }));
      }
      for (let p of $s) {
        for (let m of p.lore) {
          let [y, b] = m.position;
          (c.box(y, 1.3, b, 0.88, 0.7, 0.08, "#abb29d", { district: !0 }),
            c.district.spots.push({
              id: "lore:" + m.id,
              type: "lore",
              lore: m,
              area: p.id,
              x: y,
              z: b,
              y: 1.5,
              name: m.title,
            }));
        }
        for (let m = 0; m < 11; m++) {
          let y = p.index * 11 + m,
            b = p.x - 10 + (m % 6) * 3.65,
            x = p.z + 4.2 + Math.floor(m / 6) * 4.4,
            T = r(c, y, b, x, y, p);
          ((T.route = [
            { x: p.x - 11, z: p.z + 3.4 + (m % 2) * 1.4 },
            { x: p.x + 11, z: p.z + 3.4 + (m % 2) * 1.4 },
            { x: p.x + 11, z: p.z + 10 },
            { x: p.x - 11, z: p.z + 10 },
          ]),
            (T.routeIndex = m % 4),
            (T.speed = 0.5 + (y % 5) * 0.13),
            (T.pause = m % 3),
            c.district.crowd.push(T));
        }
      }
      for (let p of wr)
        for (let [m, y] of p.steps.entries())
          if (y.kind === "object") {
            let [b, x] = y.position;
            (c.box(b, 0.56, x, 0.9, 1.12, 0.8, "#385158", { district: !0 }),
              c.prop(y.model || "device", b, 1.2, x, 0.72),
              c.district.spots.push({
                id: "task:" + y.target,
                type: "task",
                quest: p.id,
                stage: m,
                x: b,
                z: x,
                y: 1.45,
                name: y.label,
              }));
          }
      let d = (p, m, y, b, x, T, v, A, S) => {
        let _ = c.box(y, b, x, T, v, A, S, { dynamic: !0, district: !0, lifeDetail: !0 });
        return (
          (c.district.outcomes ??= []).push({
            key: p,
            kind: m,
            o: _,
            base: { x: y, y: b, z: x, w: T, h: v, d: A },
            color: S,
          }),
          _
        );
      };
      (d("meal", "meal", 34, 1.45, -4, 0.6, 0.18, 0.5, "#d6c1a0"),
        d("photo", "photo", -3, 2.2, -20, 1.4, 1, 0.08, "#b0a784"),
        d("scale", "scale", -24, 1.86, 11, 0.75, 0.08, 0.4, "#91ad88"),
        d("clinic", "parcel", 23, 0.74, -5, 0.8, 0.4, 0.55, "#c3b996"),
        d("terminal", "screen", 32, 1.8, 16, 0.95, 0.58, 0.045, "#87cbb1"),
        d("dream", "notebook", 25, 1.24, -32, 0.6, 0.08, 0.8, "#c1ae7d"),
        d("bird", "bird", -29, 1.5, -4, 0.28, 0.26, 0.4, "#c4c2a0"),
        d("delivery", "box", 4, 0.4, -52, 0.9, 0.8, 0.75, "#ac946c"),
        d("watcher", "route", 35, 0.04, 18, 1, 0.04, 0.1, "#8dcdb2"),
        d("watcher", "chalk", -23, 0.05, -54, 1.1, 0.04, 0.35, "#b7b1a0"));
      let f =
        c.def.key === "noodles"
          ? { counter: [-5, 9], news: [5, 14], gaff: [13, 19] }
          : { fish: [-5, 9], comparison: [5, 14], "fish-link": [7, 17] };
      for (let p of c.def.steps) {
        let [m, y] = f[p.id] || [0, 16];
        if (!["counter", "fish"].includes(p.id))
          if (p.id === "gaff") {
            let b = c.character("Gaff", m, y, "#655c48", { hat: !0, patrol: !0 });
            ((b.namedDistrict = !0), (b.base = { x: m, z: y }), (b.isGaff = !0), (c.district.gaff = b));
          } else (c.box(m, 0.7, y, 1.1, 1.4, 0.8, "#3c5358"), c.prop(p.model || "paper", m, 1.5, y, 0.8));
        c.hotspots.push({ id: p.id, step: p, x: m, y: 1.6, z: y, optional: !1 });
      }
      for (let [p, m] of c.def.optional.entries()) {
        let y = m.id === "sheep" ? [-27, -5] : m.id === "token" ? [3, 19] : [-8, 15];
        c.hotspots.push({
          id: m.id,
          step: m,
          x: y[0],
          z: y[1],
          y: 1.6,
          optional: !0,
          districtLegacy: ["sheep", "token"].includes(m.id),
        });
      }
      let g = 17,
        u = 23;
      (c.box(g, 0.65, u, 2.6, 1.1, 4.7, "#38546a", { collide: !0 }),
        c.box(g, 1.45, u, 2.2, 0.75, 2.6, "#1b3a4d"),
        c.box(g, 1.55, u + 1.35, 2, 0.48, 0.08, "#88bcca", { alpha: 0.7 }));
      for (let p of [g - 0.9, g + 0.9]) c.box(p, 0.95, u + 2.4, 0.4, 0.17, 0.05, "#f0cd90", { emissive: 2 });
      ((c.exit = { x: 13, y: 1.4, z: 24, id: "exit", exit: !0 }),
        c.hotspots.push(c.exit),
        H_(c, { ...bd[c.def.key], people: [] }));
      for (let p of c.actors) (p.namedDistrict || p.districtCrowd || p.animal) && (p.patrol = !0);
      if (((c.district.totalCrowd = sX), c.def.key === "fish-counter")) {
        for (let p of c.objects) p.district && p.emissive && p.y > 4 && (p.lifeDim = 0.62);
        c.sign("LATE SERVICE / COUNTER OPEN", 0, 3.35, 14.5, 12, 0.55, "#91cbb7");
      }
    }
    function o(c, h, d, f, g = 0, u = 0) {
      let p = Math.cos(g),
        m = Math.sin(g),
        y = f ? Math.sin(d * 7 + h.phase) * 0.025 : Math.sin(d * 0.8 + h.phase) * 0.008;
      for (let b = 0; b < h.parts.length; b++) {
        let x = h.parts[b];
        x.hidden = !h.active || (u > 0 && x.lod > 0) || (u > 1 && b >= 2);
        let T = x.ox,
          v = x.oz + (f && (b === 2 || b === 3) ? Math.sin(d * 7 + (b === 2 ? 0 : Math.PI)) * 0.14 : 0);
        ((x.x = h.x + T * p + v * m),
          (x.z = h.z - T * m + v * p),
          (x.y = (h.y || 0) + x.oy + y),
          (x.rotY = g),
          h.namedDistrict &&
            b >= 12 &&
            Math.hypot(c.district.camera?.x - h.x, c.district.camera?.z - h.z) > 17 &&
            (x.hidden = !0));
      }
    }
    function l(c, h, d, f = {}) {
      if (!c?.isDistrict) return;
      let g = c.district,
        u = f.cam || g.spawn,
        p = f.state || {},
        m = f.paused || !1,
        y = f.reduced || !1;
      ((g.camera = u), m || (g.clock += h));
      let b = y ? 0 : g.clock,
        x = 0,
        T = 0,
        v = 0;
      for (let S of g.npcs) {
        let _ = Math.hypot(u.x - S.x, u.z - S.z);
        S.active = _ < 78;
        let k = _ < 4 ? Math.atan2(u.x - S.x, u.z - S.z) : Math.sin(b * 0.11 + S.person.index) * 0.12;
        if ((o(c, S, b, !1, k, 0), !y && !m && _ > 2.2))
          for (let E of [6, 8]) {
            let M = S.parts[E];
            M && (M.y += Math.max(0, Math.sin(b * 1.7 + S.person.index)) * 0.16);
          }
      }
      g.gaff &&
        ((g.gaff.active = c.def.key === "noodles"), o(c, g.gaff, b, !1, Math.atan2(u.x - g.gaff.x, u.z - g.gaff.z)));
      let A = f.quality === "performance" ? 0.18 : 0.12;
      for (let S of g.crowd) {
        let _ = Math.hypot(u.x - S.x, u.z - S.z);
        S.active = _ < (f.quality === "performance" ? 48 : 66);
        let k = _ > 28 ? 2 : _ > 15 ? 1 : 0;
        (k === 0 ? x++ : k === 1 ? T++ : v++, (S.clock += h));
        let E = _ < 16 ? 0.035 : A;
        if (S.clock < E && S.lastLod === k) continue;
        let M = Math.min(S.clock, 0.3);
        ((S.clock = 0), (S.lastLod = k));
        let R = !1;
        if (!m && !y && S.mode === "walk" && ((S.pause = Math.max(0, S.pause - M)), S.pause === 0)) {
          let N = S.route[S.routeIndex],
            P = N.x - S.x,
            D = N.z - S.z,
            q = Math.hypot(P, D);
          if (q < 0.35) ((S.routeIndex = (S.routeIndex + 1) % S.route.length), (S.pause = (S.style % 3) * 0.6));
          else {
            let K = (P / q) * S.speed * M,
              ee = (D / q) * S.speed * M,
              Z = Math.hypot(S.x - u.x, S.z - u.z);
            Z < 1.35 && Z > 0.01 && ((K += ((S.x - u.x) / Z) * M * 0.75), (ee += ((S.z - u.z) / Z) * M * 0.75));
            let ne = g.npcs.find((fe) => Math.hypot(fe.x - S.x, fe.z - S.z) < 0.72);
            (ne && ((K += (S.x - ne.x) * M), (ee += (S.z - ne.z) * M)),
              c.collides(S.x + K, S.z + ee, 0.16)
                ? ((S.routeIndex = (S.routeIndex + 1) % S.route.length), (S.pause = 0.8))
                : ((S.x += K), (S.z += ee), (R = !0), (S.facing = Math.atan2(K, ee))));
          }
        }
        o(c, S, b, R, S.facing || 0, k);
      }
      for (let S of g.pets)
        ((S.active = !!p.changes?.sheep),
          (S.x = S.baseX ?? (S.baseX = S.x)),
          S.active && !y && (S.x = S.baseX + Math.sin(b * 0.4) * 0.7),
          o(c, S, b, S.active && !y, 0));
      for (let S of g.effects) {
        let _ = S.object;
        (S.kind === "steam" &&
          ((_.hidden = y),
          (_.y = S.baseY + ((b * 0.24 + S.phase) % 1) * 0.8),
          (_.w = 0.2 + ((b * 0.24 + S.phase) % 1) * 0.35)),
          S.kind === "leak" && ((_.hidden = y || !!p.changes?.canopy), (_.y = S.baseY - ((b * 0.8) % 1) * 1.5)));
      }
      (g.stateProps.canopy && (g.stateProps.canopy.lifeDim = p.changes?.canopy ? 1.15 : 0.78),
        g.stateProps.music && (g.stateProps.music.lifeDim = p.changes?.music ? 2.4 : 0.4));
      for (let S of g.outcomes || []) {
        let _ = p.changes?.[S.key],
          k = S.o;
        ((k.hidden = S.kind === "chalk" ? !!_ : !_),
          S.kind === "scale" && ((k.rotY = _ === "public" ? 0.1 : 0), (k.lifeDim = _ ? 1.3 : 0.6)),
          S.kind === "screen" && (k.lifeDim = _ ? 1.8 : 0.35),
          S.kind === "bird" &&
            _ &&
            !y &&
            ((k.y = S.base.y + Math.sin(b * 2) * 0.035), (k.rotY = Math.sin(b * 0.5) * 0.2)),
          S.kind === "photo" && _ === "copy" && (k.w = S.base.w * 0.7));
      }
      g.metrics = { near: x, mid: T, far: v, records: g.crowd.length, drawn: g.crowd.filter((S) => S.active).length };
    }
    return { districtHeight: e, districtAreaAt: t, buildDistrict: n, animateDistrict: l };
  })(),
  {
    prologueZoneAt: G_,
    buildPrologue: pX,
    animatePrologue: X3,
  } = (() => {
    let a = { ink: "#18313a", wall: "#334c55", mint: "#97cfbf", gold: "#e2b87c", paper: "#c1baa1", metal: "#7c918e" };
    function e(u, p, m) {
      return (u?.prologue?.spec?.regions || []).reduce(
        (b, x) => (!b || Math.hypot(x.x - p, x.z - m) < Math.hypot(b.x - p, b.z - m) ? x : b),
        null,
      );
    }
    function t(u, p, m, y, b, x, T, v = a.wall) {
      return u.box(p, m, y, b, x, T, v, { collide: !0, openingDetail: !0 });
    }
    function s(u, p, m, y = 3.2, b = "#687b74") {
      (t(u, p, 0.51, m, y, 0.18, 0.92, b), u.box(p, 0.88, m - 0.45, y, 0.73, 0.13, b, { lifeDetail: !0 }));
      for (let x of [-1, 1]) u.box(p + x * y * 0.38, 0.22, m, 0.1, 0.45, 0.65, "#30434b", { lifeDetail: !0 });
    }
    function i(u, p, m, y) {
      (t(u, p, 0.78, m, 5.8, 1.56, 1.35, "#3d545b"), u.box(p, 1.6, m, 6, 0.12, 1.48, y, { lifeDetail: !0 }));
      for (let b = 0; b < 7; b++)
        u.box(p - 2.4 + b * 0.78, 1.79, m, 0.35, 0.26, 0.37, b % 2 ? a.paper : "#96765b", { lifeDetail: !0 });
    }
    function r(u, p, m, y, b = a.mint) {
      (u.box(p, 0.73, m, 1.65, 1.46, 0.75, "#3e535d", { lifeDetail: !0 }),
        u.box(p, 1.7, m - 0.1, 1.6, 0.77, 0.18, "#647674", { lifeDetail: !0 }),
        u.sign(y, p, 1.7, m + 0.01, 1.4, 0.5, b, { lifeDetail: !0 }),
        u.box(p, 1.35, m + 0.35, 1.45, 0.08, 0.4, a.metal, { lifeDetail: !0 }));
    }
    function n(u, p, m, y) {
      for (let b of [-1, 1]) t(u, p + b * 7.8, 2.55, m + 2, 0.16, 5.1, 0.16, "#536976");
      (u.box(p, 5.2, m, 16.2, 0.28, 15, y), u.box(p, 4.9, m + 7.1, 16.2, 0.12, 0.1, a.gold, { emissive: 1.5 }));
      for (let b = 0; b < 6; b++) u.box(p - 6.5 + b * 2.6, 5.04, m, 0.09, 0.1, 14, "#a38f70", { lifeDetail: !0 });
    }
    function o(u, p, m, y, b) {
      (u.box(p, 1.62, m, 2, 0.98, 0.13, "#5a6b69", { lifeDetail: !0 }),
        u.sign(y.toUpperCase(), p, 1.68, m + 0.08, 1.85, 0.58, b, { lifeDetail: !0 }),
        u.box(p, 1.09, m + 0.02, 1.95, 0.09, 0.2, "#91a396", { lifeDetail: !0 }));
    }
    function l(u) {
      let p = u.rng;
      for (let m = 0; m < 35; m++) {
        let y = -100 + m * 6,
          b = -42 - (m % 4) * 14,
          x = 8 + p() * 32;
        u.box(y, x / 2 - 9, b, 4.7, x, 8, ["#253d48", "#20343e", "#30444b"][m % 3]);
        for (let T = 0; T < 5; T++)
          u.box(y, 1 + T * 4.2, b + 4.05, 2.8, 0.5, 0.07, T % 3 ? "#9c916d" : "#5f9b9e", { emissive: 0.4 });
        m % 4 === 0 &&
          (u.box(y, x - 7, b, 0.22, 5, 0.22, "#56676e"),
          u.box(y, x - 4.5, b, 0.34, 0.12, 0.34, "#cc8f62", { emissive: 1.5 }));
      }
      for (let m = 0; m < 11; m++)
        (u.box(4, 4 + m * 2.15, -108, 64 - m * 5.15, 2.2, 37 - m * 2.7, "#4c4943"),
          u.box(4, 4.8 + m * 2.15, -89.4 + m * 1.35, 62 - m * 5.1, 0.16, 0.08, "#b99365", { emissive: 0.6 }));
      for (let m = 0; m < 7; m++) {
        let y = -49 + m * 16,
          b = -42 - (m % 3) * 8;
        (u.box(y, -1, b, 3, 18, 3, "#4b4741"), u.box(y, 8, b, 3.4, 0.5, 3.4, "#6a6658"));
        let x = u.box(y, 10, b, 1.4, 3, 1.3, "#df9b58", { dynamic: !0, emissive: 2.7 });
        u.prologue.effects.push({ kind: "flare", o: x, base: { y: 10, h: 3 }, phase: m * 1.6 });
      }
      for (let m = 0; m < 9; m++) {
        let y = -60 + m * 13,
          b = 8 + (m % 3) * 4,
          x = -28 - m * 5,
          T = [];
        (T.push(u.box(y, b, x, 2.8, 0.65, 4.8, "#3f5965", { dynamic: !0 })),
          T.push(u.box(y, b + 0.55, x, 2, 0.5, 2.8, "#213e4e", { dynamic: !0 })));
        for (let v of [-1, 1])
          T.push(
            u.box(y + v * 0.94, b, x + 2.45, 0.35, 0.18, 0.07, m % 2 ? "#e4b976" : "#9ec9be", {
              emissive: 2,
              dynamic: !0,
            }),
          );
        u.prologue.traffic.push({
          parts: T,
          base: T.map((v) => ({ x: v.x, y: v.y, z: v.z })),
          speed: (m % 2 ? 1 : -1) * (2 + m * 0.17),
          phase: m,
        });
      }
      (u.box(-23, 26, -60, 25, 4.8, 9, "#344c5b"),
        u.sign("A DIFFERENT LIFE / OFF WORLD", -23, 26, -55.4, 22, 2.5, "#e0bb87"),
        u.box(-23, 22.9, -60, 3, 0.9, 2.5, "#8b8c6d", { emissive: 0.3 }));
      for (let m = 0; m < 12; m++) {
        let y = u.box(-60 + m * 10, -2 + (m % 3), -34 - (m % 3) * 8, 7, 1.8, 4, "#799491", {
          alpha: 0.08,
          dynamic: !0,
          noShadow: !0,
        });
        u.prologue.effects.push({ kind: "haze", o: y, base: { x: y.x, y: y.y }, phase: m });
      }
    }
    function c(u) {
      u.box(0, -0.3, 0, 58, 0.6, 57, "#263d46", { ground: !0 });
      for (let p of [-27, 27]) t(u, p, 1.1, 0, 0.25, 2.2, 54, "#526b75");
      (t(u, 0, 0.52, -27, 54, 1.04, 0.3, "#708884"),
        t(u, 0, 1.2, 27, 54, 2.4, 0.3, "#345361"),
        u.box(0, 2.15, -27, 54, 2.2, 0.07, "#87a9a9", { alpha: 0.07 }));
      for (let p of [-9, 9])
        for (let m of [-13, 12]) {
          t(u, p, 1.5, m, 0.2, 3, 13, "#425963");
          for (let y = 0.3; y < 3; y += 0.55) u.box(p + 0.13, y, m, 0.06, 0.05, 12, "#849692", { lifeDetail: !0 });
        }
      for (let p of [-23, -1, 23]) {
        u.box(0, 0.03, p, 52, 0.03, 1.1, "#68746b");
        for (let m = -25; m < 26; m += 3) u.box(m, 0.053, p, 0.9, 0.014, 0.055, a.gold, { emissive: 0.15 });
      }
      for (let p of [-8, 8]) u.box(p, 0.03, 0, 0.15, 0.025, 47, "#d0af79", { emissive: 0.2 });
      (n(u, -18, -13, "#455a68"),
        n(u, 18, -13, "#6c5e4b"),
        n(u, -18, 12, "#415b65"),
        n(u, 18, 12, "#486a6b"),
        u.sign("TRANSFER / STREET LEVEL", 0, 4.5, 21, 14, 1, "#98d1c7"),
        u.sign("LOS ANGELES / NOVEMBER 2019", 0, 6, -26.5, 22, 1.2, a.gold),
        u.sign("NIGHT DISPATCH", -18, 4.1, -5.6, 13, 0.72, "#8ecbd1"),
        u.sign("LAST POT / STAFF CANTEEN", 18, 4.1, -5.6, 13, 0.72, a.gold),
        u.sign("SMALL FREIGHT / CARE FIRST", -18, 4.1, 19.4, 14, 0.72, "#aebc9a"),
        u.sign("FILTERS / SIGNAL SERVICE", 18, 4.1, 19.4, 14, 0.72, "#95bdd0"),
        i(u, 20, -19, "#b39066"),
        r(u, -23, -17, "LOCAL / STANDBY"),
        r(u, -14, -17, "ROUTE / BAY 6"));
      for (let p = 0; p < 4; p++)
        (s(u, -4 + p * 2.6, 14, 1.7), u.box(-4 + p * 2.6, 1.38, 13.5, 0.33, 0.4, 0.3, "#8a7761", { lifeDetail: !0 }));
      for (let p of [14, 18, 22]) (s(u, p, -8, 2.3, "#967b5c"), u.prop("paper", p, 0.63, -7.7, 0.6));
      for (let p of [-24, -15])
        for (let m = 0; m < 3; m++) {
          u.box(p, 1 + m * 0.82, 16, 2.1, 0.12, 2, "#718780", { lifeDetail: !0 });
          for (let y = 0; y < 3; y++)
            u.box(p - 0.65 + y * 0.66, 1.25 + m * 0.82, 16, 0.5, 0.36, 0.7, ["#967f63", "#9eb194", "#466d78"][y], {
              lifeDetail: !0,
            });
        }
      (u.prop("owl", -24, 1.4, 11, 0.7), u.prop("toy", -15, 1.1, 14, 0.8));
      for (let p = 0; p < 5; p++)
        u.box(-24 + p * 0.45, 0.93, 5, 0.28, 0.5, 0.4, p === 0 ? "#b46b51" : "#899e81", { lifeDetail: !0 });
      r(u, 24, 5, "PUBLIC / SIGNAL");
      for (let p = 0; p < 5; p++) {
        u.box(24, 1.4, 10 + p * 1.6, 1.3, 1.7, 0.35, "#9ba590", { lifeDetail: !0 });
        for (let m = 0; m < 6; m++)
          u.box(24, 1.03 + m * 0.16, 10 + p * 1.6, 0.97, 0.047, 0.4, "#586e6c", { lifeDetail: !0 });
      }
      u.box(19, 1, 17, 5, 0.15, 1.5, "#8c9a81", { collide: !0 });
      for (let p = 0; p < 8; p++)
        u.box(17 + p * 0.57, 1.15, 17, 0.1, 0.22, 0.55, p % 2 ? a.paper : a.metal, { lifeDetail: !0 });
      for (let p = 0; p < 8; p++) {
        let m = u.box(18 + (p % 3) * 0.25, 2 + p * 0.14, -19, 0.17, 0.2, 0.17, "#b8c8b5", {
          alpha: 0.13,
          dynamic: !0,
          noShadow: !0,
        });
        u.prologue.effects.push({ kind: "steam", o: m, base: { y: m.y }, phase: p });
      }
      (u.box(20, 1.1, 24, 4, 1.5, 5.3, "#416373", { collide: !0 }),
        u.box(20, 2.35, 23.4, 3.2, 1.1, 3.3, "#254653"),
        u.box(20, 2.4, 25.1, 3, 0.75, 0.06, "#7bafba", { alpha: 0.35 }));
      for (let p of [18.6, 21.4]) u.box(p, 1.3, 26.68, 0.5, 0.25, 0.04, "#e6b777", { emissive: 2 });
      (l(u),
        u.light(-18, 5, -10, "#88d5d8", 60),
        u.light(18, 5, -13, "#eeb477", 75),
        u.light(16, 5, 12, "#83bfbd", 45));
    }
    function h(u) {
      u.box(0, -0.24, 0, 57, 0.45, 57, "#544e42", { ground: !0 });
      for (let p of [-27, 27]) t(u, p, 3.5, 0, 0.35, 7, 54, "#68675a");
      (t(u, 0, 3.5, 27, 54, 7, 0.3, "#4c5c5b"), u.box(0, 7.15, 0, 55, 0.2, 54, "#2b3a41"));
      for (let p of [-9, 9]) {
        for (let m of [-15, 15]) t(u, p, 2.1, m, 0.28, 4.2, 18, "#5a655e");
        u.box(p, 5.35, 0, 0.25, 2.5, 54, "#777767");
      }
      for (let p of [-18, 18]) for (let m of [-5.5, 5.5]) t(u, p + m, 2.1, 0, 6.5, 4.2, 0.3, "#6c6c5c");
      for (let p of [-6.8, 6.8]) t(u, p, 2.2, -1, 4.2, 4.4, 0.22, "#726d59");
      u.box(0, 4.5, -1, 18, 0.22, 0.4, "#a38f6c");
      for (let p of [-24, -1, 24]) u.box(0, 0.02, p, 54, 0.02, 0.1, "#a99978", { lifeDetail: !0 });
      for (let p of [-26, -9, 9, 26]) u.box(p, 0.025, 0, 0.045, 0.025, 53, "#b4a782", { lifeDetail: !0 });
      u.box(0, 3.5, -27, 54, 7, 0.15, "#b59463", { emissive: 0.22 });
      for (let p = 0; p < 18; p++) u.box(-26 + p * 3.05, 3.5, -26.8, 0.18, 7, 0.23, "#524d41");
      for (let p = 0.9; p < 6.9; p += 0.57) u.box(0, p, -26.6, 54, 0.13, 0.3, "#7c6a50");
      for (let p = 0; p < 10; p++)
        u.box(-17 + p * 3.8, 0.041, -13, 1.05, 0.013, 19, "#9a8355", { alpha: 0.11, lifeDetail: !0 });
      (u.sign("TYRELL / STAFF RECEPTION", 0, 5.3, 6, 15, 1, "#dcc290"),
        u.sign("APPOINTMENTS / PLEASE SIT", -18, 4.5, 21, 13, 0.7, "#adccc1"),
        u.sign("DISPATCH / RECORDS", 18, 4.5, 21, 13, 0.7, "#b3c6cf"),
        u.sign("INTERVIEW / OPTICAL TEST", 0, 4.7, -1, 13, 0.7, "#e5b985"),
        u.sign("SERVICE / OPTICS", 18, 4.5, -3, 13, 0.7, "#a1c6c3"),
        u.sign("STAFF GARDEN", -18, 4.5, -3, 13, 0.7, "#c0c58d"),
        i(u, 0, 17, "#b7a079"),
        r(u, 4, 15, "ARRIVALS / HOLD"));
      for (let p of [8, 18]) for (let m of [-22, -16]) s(u, m, p, 4, "#79928a");
      r(u, -24, 5, "SHARED / WATER");
      for (let p = 0; p < 4; p++) {
        let m = 14 + p * 3.25;
        u.box(m, 1.4, 20, 2.2, 2.8, 1.3, "#758079", { collide: !0 });
        for (let y = 0; y < 5; y++)
          (u.box(m, 0.34 + y * 0.51, 20.71, 1.94, 0.42, 0.08, "#929b8b", { lifeDetail: !0 }),
            u.box(m, 0.34 + y * 0.51, 20.78, 0.48, 0.05, 0.04, a.paper, { lifeDetail: !0 }));
      }
      (r(u, 24, 5, "PUBLIC / COPY"),
        i(u, 18, 8, "#a4b397"),
        u.box(-18, 0.5, -19, 5, 1, 3.3, "#7c7d65", { collide: !0 }));
      for (let p = 0; p < 4; p++) u.box(-18, 0.9 + p * 0.43, -19, 0.6 + p * 0.12, 1, 0.6, "#88785b");
      for (let [p, m, y, b, x, T] of [
        [-18, 3, -19, 4, 1.2, 3],
        [-19, 3.8, -19, 3, 0.85, 2],
        [-17, 4, -19, 2.3, 0.8, 2.7],
      ])
        u.box(p, m, y, b, x, T, "#819975");
      for (let p = 0; p < 6; p++) u.box(-23 + p * 2, 1, -24, 0.75, 1.6, 0.8, "#678276");
      (s(u, -16, -9, 4.4, "#8d8e75"),
        t(u, -24, 0.6, -5, 1.8, 1.2, 1.2, "#718580"),
        u.sign("WET FLOOR", -22, 1.5, -5, 1.5, 0.65, a.gold, { lifeDetail: !0 }),
        i(u, 19, -20, "#a8aca0"));
      for (let p = 0; p < 5; p++) u.prop("eye", 17 + p * 0.8, 1.8, -20, 0.65);
      (r(u, 24, -18, "WAITING / SPARE B"), u.box(24, 4, -10, 1.5, 1.1, 8, "#687c79"));
      for (let p = 0; p < 6; p++) u.box(24, 3.5, -13 + p, 0.99, 0.03, 0.06, "#a1b1a0", { lifeDetail: !0 });
      t(u, 0, 0.84, -14, 4.4, 0.17, 1.8, "#8d795a");
      for (let p of [-1.8, 1.8]) u.box(p, 0.4, -14, 0.12, 0.8, 1.4, "#3d4646");
      (u.box(-0.8, 1.3, -13.8, 1.1, 0.75, 0.76, "#3f5350"),
        u.sign("VK / OPTICAL RESPONSE", -0.8, 1.43, -13.38, 1, 0.43, "#a8d1b2"),
        u.box(-0.26, 1.8, -14, 0.09, 0.75, 0.14, "#a6ad8f"),
        u.box(-0.26, 2.13, -13.85, 0.45, 0.25, 0.4, "#658c8a"));
      for (let p = 0; p < 7; p++)
        u.box(-1.22 + p * 0.105, 1.24, -13.7, 0.037, 0.45, 0.55, "#283b40", { lifeDetail: !0 });
      s(u, 0, -11, 1.3, "#777c6c");
      for (let p = 0; p < 2; p++) {
        let m = u.box(0, 6, -14, p ? 0.17 : 5, 0.09, p ? 5 : 0.17, "#9b977e", { dynamic: !0 });
        u.prologue.effects.push({ kind: "fan", o: m, phase: (p * Math.PI) / 2 });
      }
      (u.box(0, 6.6, -14, 0.1, 1.2, 0.1, "#8b907e"),
        u.light(0, 5, -17, "#e5b17a", 65),
        u.light(-18, 5, 13, "#a2ccbd", 55),
        u.light(18, 5, 13, "#a0bcca", 45));
    }
    function d(u, p) {
      let m = u.prologue.spec.regions;
      for (let y = 0; y < p; y++) {
        let b = m[y % 6];
        u.def.key === "holden" && b.id === "interview" && (b = m[0]);
        let x = b.x - 5.8 + (Math.floor(y / 6) % 4) * 3.55,
          T = b.z + 2.6 + (Math.floor(y / 24) % 2) * 2.25;
        u.collides(x, T, 0.35) && ((x = b.x), (T = b.z + 4));
        let v = {
            name: "Shift worker",
            x,
            z: T,
            y: 0,
            parts: [],
            active: !0,
            patrol: !0,
            prologueActor: !0,
            crowd: !0,
            base: { x, z: T },
            phase: y * 1.9,
            mode: y % 4 === 0 ? "wait" : y % 5 === 0 ? "browse" : "walk",
            zone: b.id,
            index: y,
          },
          A = ["#587380", "#83755e", "#6e7781", "#668079", "#887779"][y % 5],
          S = (_, k, E, M, R, N, P, D = 0) => {
            let q = u.box(x + _, k, T + E, M, R, N, P, { dynamic: !0, noShadow: !0, lifeDetail: !0 });
            (Object.assign(q, { ox: _, oy: k, oz: E, lod: D }), v.parts.push(q));
          };
        (S(0, 0.82, 0, 0.59, 0.88, 0.39, A),
          S(0, 1.49, 0.02, 0.43, 0.43, 0.42, ["#b18d71", "#88694e", "#c3a487"][y % 3]),
          S(-0.17, 0.27, 0, 0.23, 0.54, 0.32, "#2c3b43"),
          S(0.17, 0.27, 0, 0.23, 0.54, 0.32, "#2c3b43"),
          S(-0.4, 0.88, 0, 0.18, 0.64, 0.25, A, 1),
          S(0.4, 0.88, 0, 0.18, 0.64, 0.25, A, 1),
          S(0, 1.74, 0, 0.46, 0.09, 0.43, "#40403b", 1),
          u.def.key === "hades" && y % 7 === 0
            ? (S(0.37, 1.68, 0, 0.025, 1.1, 0.025, "#8c9d95", 1), S(0, 2.27, 0, 1.47, 0.13, 1.2, "#7a8271", 1))
            : y % 6 === 0 && S(0.46, 0.65, 0.1, 0.4, 0.38, 0.4, "#a19173", 1),
          (v.route = [
            { x, z: T },
            { x: x + (y % 2 ? 1 : -1) * 2.4, z: T + 1.1 },
          ]),
          (v.routeIndex = 1),
          (v.pause = y % 5),
          (v.speed = 0.45 + (y % 4) * 0.1),
          u.actors.push(v),
          u.prologue.crowd.push(v));
      }
    }
    function f(u) {
      let p = ji[u.def.key];
      if (!p) return !1;
      ((u.isPrologue = !0),
        (u.outside = u.def.key === "hades"),
        (u.day = !1),
        (u.sheltered = !1),
        (u.bounds = { minX: -26.5, maxX: 26.5, minZ: -26.4, maxZ: 26.4 }),
        (u.animations = []),
        (u.prologue = {
          spec: p,
          spots: [],
          npcs: [],
          crowd: [],
          traffic: [],
          effects: [],
          outcomes: [],
          clock: 0,
          spawn: { ...p.spawn },
        }),
        u.def.key === "hades" ? c(u) : h(u));
      for (let y of p.regions)
        for (let b of y.lore) {
          let [x, T] = b.position;
          (o(u, x, T, b.title, y.tone),
            u.prologue.spots.push({ id: b.id, type: "lore", lore: b, x, z: T, y: 1.65, name: b.title, opening: !0 }));
        }
      for (let y of qn.filter((b) => b.scene === u.def.key)) {
        let [b, x] = y.position;
        (y.model === "paper" ? u.prop("paper", b, 1.25, x, 0.9) : y.model === "sign" && u.prop("sign", b, 1.25, x, 0.9),
          u.prologue.spots.push({
            id: y.id,
            type: "favour",
            quest: y,
            x: b,
            z: x,
            y: 1.6,
            name: y.title,
            opening: !0,
          }));
        let T = u.box(b, 2.18, x, 0.6, 0.12, 0.12, "#add3b0", { emissive: 1.1, dynamic: !0, hidden: !0 });
        if ((u.prologue.outcomes.push({ id: y.id, kind: "indicator", o: T }), y.id === "route-strip")) {
          let v = u.sign("LOCAL 06 / STREET TRANSFER", b, 2.6, x, 4, 0.55, "#bad7b5", { dynamic: !0, hidden: !0 });
          u.prologue.outcomes.push({ id: y.id, kind: "visibility", o: v });
        }
        if (y.id === "public-relay")
          for (let v = 0; v < 5; v++) {
            let A = u.box(b - 0.6 + v * 0.3, 1.64, x + 0.1, 0.13, 0.22 + v * 0.055, 0.02, "#a1d4bd", {
              dynamic: !0,
              emissive: 0.65,
              hidden: !0,
            });
            u.prologue.outcomes.push({ id: y.id, kind: "visibility", o: A });
          }
        if (y.id === "spare-fan") {
          u.box(24, 3.3, -18, 1.8, 1.8, 0.4, "#657970", { lifeDetail: !0 });
          for (let v = 0; v < 2; v++) {
            let A = u.box(24, 3.3, -17.73, v ? 1.3 : 0.13, v ? 0.13 : 1.3, 0.07, "#b4c0a5", { dynamic: !0 });
            u.prologue.effects.push({ kind: "repaired-fan", o: A, quest: y.id, phase: 0 });
          }
        }
        if (y.id === "meal-seal") {
          let v = u.box(22, 1.8, -19, 0.6, 0.2, 0.5, "#dfbd8d", { dynamic: !0, hidden: !0 });
          u.prologue.outcomes.push({ id: y.id, kind: "visibility", o: v });
        }
        if (y.id === "cell-check") {
          let v = u.box(-24, 1.2, 11, 0.14, 0.09, 0.12, "#94d6b0", { emissive: 1.3, dynamic: !0 });
          u.prologue.outcomes.push({ id: y.id, kind: "dim", o: v });
        }
        if (y.id === "water-queue") {
          let v = u.box(-24, 1.35, 5.45, 0.28, 0.24, 0.28, "#cbd1b8", { dynamic: !0, hidden: !0 });
          u.prologue.outcomes.push({ id: y.id, kind: "visibility", o: v });
        }
        if (y.id === "public-copy") {
          let v = u.box(19, 1.73, 8, 0.85, 0.018, 0.59, a.paper, { dynamic: !0, hidden: !0 });
          u.prologue.outcomes.push({ id: y.id, kind: "visibility", o: v });
        }
        if (y.id === "dry-turn") {
          let v = u.box(-22, 0.049, -4.5, 2.4, 0.015, 0.11, "#c5c7a2", { dynamic: !0, hidden: !0 });
          u.prologue.outcomes.push({ id: y.id, kind: "visibility", o: v });
          let A = u.obstacles.find((S) => S.x === -24 && S.z === -5);
          A && ((A.dynamic = !0), u.prologue.outcomes.push({ id: y.id, kind: "cart", o: A, baseX: A.x }));
        }
      }
      let m =
        u.def.key === "hades"
          ? { channel: [-3, -8], airship: [4, -21] }
          : { vk: [-4, -8], baseline: [4, -8], leon: [0, -16] };
      for (let y of u.def.steps) {
        let [b, x] = m[y.id] || y.position,
          T = { id: y.id, step: y, x: b, z: x, y: 1.6, optional: !1 };
        if ((u.hotspots.push(T), y.id === "leon")) {
          let v = u.character(y.label, b, x, "#74644e", { skin: "#bc9b7a", hair: "#544531" });
          u.prologue.leon = v;
        } else
          r(
            u,
            b,
            x,
            y.id === "channel"
              ? "POLICE / CHANNEL"
              : y.id === "airship"
                ? "OFF WORLD / OFFER"
                : y.id === "baseline"
                  ? "OPTICS / BASELINE"
                  : "VK / SERVICE",
          );
      }
      ((u.exit = {
        id: "exit",
        x: u.def.key === "hades" ? 0 : 3,
        y: 1.6,
        z: u.def.key === "hades" ? 25 : -21,
        exit: !0,
      }),
        u.hotspots.push(u.exit),
        u.def.key === "hades" && u.sign("STREET TRANSFER / CONTINUE", 0, 3, 26.4, 10, 0.9, "#aed5bf"),
        H_(u, bd[u.def.key]));
      for (let y of Ha.filter((b) => b.scene === u.def.key)) {
        let [b, x] = y.position,
          T = u.character(y.name, b, x, y.look.coat, {
            skin: y.look.skin,
            hair: y.look.hair,
            hat: ["cap", "hat"].includes(y.look.accessory),
            patrol: !0,
            prologueActor: !0,
          });
        if (
          ((T.person = y),
          (T.base = { x: b, z: x }),
          (T.phase = y.index * 0.6),
          (T.facing = 0),
          ["carry", "file", "check", "sweep", "stir", "work", "type"].includes(y.job))
        ) {
          let v = y.job === "carry" ? [0.65, 0.34, 0.45] : y.job === "sweep" ? [0.055, 1.3, 0.055] : [0.36, 0.1, 0.34];
          T.tool = u.box(b + 0.48, 0.92, x + 0.23, ...v, y.job === "sweep" ? "#b7a57b" : "#a1ac95", {
            dynamic: !0,
            lifeDetail: !0,
          });
        }
        for (let v of T.parts) v.lifeDetail = !0;
        (u.prologue.npcs.push(T),
          u.prologue.spots.push({
            id: y.id,
            type: "person",
            person: y,
            x: b,
            z: x,
            y: 1.52,
            name: y.name,
            opening: !0,
          }));
      }
      return (d(u, p.crowd), !0);
    }
    function g(u, p, m, { cam: y, state: b, reduced: x = !1, paused: T = !1, quality: v = "balanced" } = {}) {
      let A = u?.prologue;
      if (!A) return;
      (u.def.key === "hades" &&
        (u.sheltered =
          Math.abs(y.x) > 10 && Math.abs(y.x) < 26 && ((y.z > -20.5 && y.z < -5.5) || (y.z > 4.5 && y.z < 19.5))),
        T || (A.clock += p));
      let S = A.clock;
      for (let k of A.npcs) {
        let E = Math.hypot(y.x - k.x, y.z - k.z),
          M = E < 4 ? Math.atan2(y.x - k.x, y.z - k.z) : 0,
          R = Math.cos(M),
          N = Math.sin(M);
        for (let P = 0; P < k.parts.length; P++) {
          let D = k.parts[P],
            q = x ? 0 : Math.sin(S * (k.person.job === "stir" ? 2.7 : 1.2) + k.phase) * 0.045;
          ((D.x = k.x + D.ox * R + D.oz * N),
            (D.z = k.z - D.ox * N + D.oz * R),
            (D.y = D.oy + (P === 6 || P === 8 ? q : 0)),
            (D.rotY = M));
        }
        k.tool &&
          ((k.tool.x = k.x + 0.5 * R + 0.3 * N),
          (k.tool.z = k.z - 0.5 * N + 0.3 * R),
          (k.tool.y = 0.88 + (x ? 0 : Math.sin(S * 1.6 + k.phase) * 0.055)),
          (k.tool.rotY = M));
      }
      let _ = v === "performance" ? 24 : v === "cinematic" ? 49 : 36;
      A.visibleCrowd = 0;
      for (let k of A.crowd) {
        let E = Math.hypot(k.x - y.x, k.z - y.z),
          M = E < _;
        ((k.active = M), M && A.visibleCrowd++);
        let R = E < 12 || Math.floor(S * 8 + k.index) % 3 === 0;
        if (!T && !x && k.mode === "walk" && R) {
          let N = k.route[k.routeIndex],
            P = N.x - k.x,
            D = N.z - k.z,
            q = Math.hypot(P, D);
          if (
            ((k.pause = Math.max(0, k.pause - p * (E < 12 ? 1 : 3))),
            !k.pause && Math.hypot(y.x - k.x, y.z - k.z) > 1.15)
          )
            if (q < 0.17) ((k.routeIndex = 1 - k.routeIndex), (k.pause = 2 + (k.index % 4)));
            else {
              let K = Math.min(q, k.speed * p * (E < 12 ? 1 : 3)),
                ee = k.x + (P / q) * K,
                Z = k.z + (D / q) * K;
              u.collides(ee, Z, 0.24) ? ((k.routeIndex = 1 - k.routeIndex), (k.pause = 1)) : ((k.x = ee), (k.z = Z));
            }
        }
        for (let N = 0; N < k.parts.length; N++) {
          let P = k.parts[N];
          ((P.hidden = !M || (E > 14 && P.lod === 1)),
            (P.x = k.x + P.ox),
            (P.y = P.oy),
            (P.z = k.z + P.oz),
            !x &&
              k.mode === "walk" &&
              !k.pause &&
              (N === 2 || N === 3) &&
              (P.z += Math.sin(S * 7 + k.phase + (N === 3 ? Math.PI : 0)) * 0.1));
        }
      }
      for (let k of A.traffic)
        if (!(T || x))
          for (let E = 0; E < k.parts.length; E++) {
            let M = k.base[E];
            ((k.parts[E].x = ((M.x + S * k.speed + 300) % 150) - 75),
              (k.parts[E].y = M.y + Math.sin(S * 0.3 + k.phase) * 0.18));
          }
      for (let k of A.effects) {
        let E = k.o;
        ((k.kind === "haze" || k.kind === "steam") && (E.hidden = x || v === "performance"),
          !(T || x) &&
            (k.kind === "flare" &&
              ((E.h = k.base.h * (0.64 + 0.34 * Math.sin(S * 1.3 + k.phase) ** 2)), (E.y = k.base.y + E.h * 0.12)),
            k.kind === "haze" &&
              ((E.x = k.base.x + Math.sin(S * 0.14 + k.phase) * 2),
              (E.y = k.base.y + Math.sin(S * 0.3 + k.phase) * 0.3)),
            k.kind === "steam" && (E.y = k.base.y + ((S * 0.22 + k.phase * 0.13) % 1) * 0.5),
            k.kind === "fan" && (E.rotY = S * 0.48 + k.phase),
            k.kind === "repaired-fan" && (E.rotZ = (b?.favours?.[k.quest]?.stage || 0) >= 2 ? S * 1.8 : 0)));
      }
      for (let k of A.outcomes) {
        let E = (b?.favours?.[k.id]?.stage || 0) >= 2;
        ((k.kind === "visibility" || k.kind === "indicator") && (k.o.hidden = !E),
          k.kind === "dim" && (k.o.lifeDim = E ? 1.25 : 0.28),
          k.kind === "cart" && (k.o.x = k.baseX + (E ? -1.4 : 0)));
      }
    }
    return { prologueZoneAt: e, buildPrologue: f, animatePrologue: g };
  })(),
  { World: wl } = (() => {
    let e = {
      ink: "#091722",
      wall: "#1e3540",
      edge: "#36505a",
      mint: "#91ffd6",
      cyan: "#45cce0",
      red: "#ff694d",
      pink: "#ed6cab",
      gold: "#eabb78",
      skin: "#bd8e72",
      paper: "#d6d0b4",
    };
    function t(i) {
      return () => {
        ((i |= 0), (i = (i + 1831565813) | 0));
        let r = Math.imul(i ^ (i >>> 15), 1 | i);
        return ((r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)), ((r ^ (r >>> 14)) >>> 0) / 4294967296);
      };
    }
    class s {
      constructor(r, n = !1) {
        ((this.def = r),
          (this.menu = n),
          (this.objects = []),
          (this.actors = []),
          (this.hotspots = []),
          (this.obstacles = []),
          (this.lights = []),
          (this.bounds = { minX: -7, maxX: 7, minZ: -26, maxZ: 17 }),
          (this.rng = t(471 + r.id * 17)),
          this.build());
      }
      box(r, n, o, l, c, h, d = e.wall, f = {}) {
        let g = { x: r, y: n, z: o, w: l, h: c, d: h, color: d, shape: "box", ...f };
        return (this.objects.push(g), g.collide && this.obstacles.push(g), g);
      }
      sign(r, n, o, l, c = 3, h = 0.85, d = e.mint, f = {}) {
        return this.box(n, o, l, c, h, 0.12, d, { emissive: 1.7, text: r, ...f });
      }
      light(r, n, o, l, c = 35) {
        this.lights.push({ x: r, y: n, z: o, color: l, power: c });
      }
      character(r, n, o, l = e.edge, c = {}) {
        let h = { name: r, x: n, z: o, y: 0, parts: [], phase: this.rng() * 6.28, active: !0, ...c },
          d = (f, g, u, p, m, y, b, x = {}) => {
            let T = this.box(n + f, g, o + u, p, m, y, b, { dynamic: !0, ...x });
            return ((T.ox = f), (T.oy = g), (T.oz = u), h.parts.push(T), T);
          };
        return (
          d(-0.19, 0.3, 0, 0.27, 0.6, 0.35, "#1d2931"),
          d(0.19, 0.3, 0, 0.27, 0.6, 0.35, "#1d2931"),
          d(-0.19, 0.075, 0.1, 0.3, 0.15, 0.47, "#111d25"),
          d(0.19, 0.075, 0.1, 0.3, 0.15, 0.47, "#111d25"),
          d(0, 0.92, 0, 0.66, 0.7, 0.4, l),
          d(0, 0.62, 0, 0.76, 0.18, 0.44, l),
          d(-0.46, 0.93, 0, 0.23, 0.65, 0.28, l),
          d(0.46, 0.93, 0, 0.23, 0.65, 0.28, l),
          d(-0.46, 0.61, 0.025, 0.23, 0.22, 0.28, e.skin),
          d(0.46, 0.61, 0.025, 0.23, 0.22, 0.28, e.skin),
          d(0, 1.51, 0.015, 0.48, 0.47, 0.46, c.skin || e.skin),
          d(0, 1.78, -0.02, 0.51, 0.14, 0.48, c.hair || "#202226"),
          d(-0.11, 1.55, 0.255, 0.075, 0.07, 0.014, "#141d21"),
          d(0.11, 1.55, 0.255, 0.075, 0.07, 0.014, "#141d21"),
          d(0, 1.37, 0.254, 0.12, 0.025, 0.016, "#664e49"),
          c.hat && (d(0, 1.9, 0, 0.5, 0.22, 0.43, l), d(0, 1.77, 0.015, 0.75, 0.07, 0.62, l)),
          this.actors.push(h),
          h
        );
      }
      moveActor(r, n, o, l = 0, c = !1) {
        ((r.x = n), (r.z = o));
        for (let h = 0; h < r.parts.length; h++) {
          let d = r.parts[h];
          ((d.x = n + d.ox),
            (d.y = r.y + d.oy + (c ? Math.sin(l * 9 + r.phase) * 0.035 : Math.sin(l * 1.2 + r.phase) * 0.012)),
            (d.z = o + d.oz),
            c && h < 2 && (d.z += Math.sin(l * 9 + (h ? Math.PI : 0)) * 0.16),
            (d.hidden = !r.active));
        }
      }
      city() {
        let r = this.rng;
        this.box(0, -0.25, -24, 160, 0.45, 260, "#11252e", { ground: !0 });
        for (let n of [-1, 1]) {
          this.box(n * 8, -0.01, -27, 3.5, 0.18, 115, "#2b3b43");
          for (let o = 0; o < 12; o++) {
            let l = n * (10 + r() * 7),
              c = 13 - o * 10,
              h = 5 + r() * 6,
              d = 12 + r() * 31,
              f = 7 + r() * 5;
            (this.box(l, d / 2, c, h, d, f, o % 3 === 0 ? "#243b46" : "#192d38"),
              this.box(l, d + 0.5, c, h + 0.5, 1, f + 0.5, "#293d47"));
            for (let g = 0; g < Math.min(8, d / 3); g++)
              for (let u = 0; u < 3; u++)
                r() > 0.3 &&
                  this.box(
                    l - h * 0.4 + u * h * 0.4,
                    3 + g * 3,
                    c + f / 2 + 0.025,
                    0.65,
                    1.1,
                    0.07,
                    r() > 0.6 ? "#d8aa6d" : "#438d9d",
                    { emissive: 0.65 },
                  );
            o % 3 === 0 &&
              this.sign(
                o % 2 ? "HOTEL" : "LIFE / OFF WORLD",
                n * 8.8,
                5 + r() * 3,
                c + 2,
                n < 0 ? 1.3 : 3.8,
                n < 0 ? 3.8 : 1.2,
                o % 2 ? e.red : e.cyan,
              );
          }
          for (let o = 0; o < 5; o++) {
            let l = 12 - o * 18;
            (this.box(n * 7, 2.8, l, 0.16, 5.6, 0.16, "#51666d"),
              this.box(n * 6.6, 5.6, l, 1, 0.12, 0.25, e.gold, { emissive: 2.5 }));
          }
        }
        for (let n = 0; n < 17; n++) {
          let o = 15 - n * 7;
          this.box(0, 0.012, o, 0.12, 0.015, 2.6, "#789080", { emissive: 0.15 });
        }
        for (let n = 0; n < 26; n++) {
          let o = 14 - r() * 90,
            l = (r() - 0.5) * 12;
          this.box(l, 0.005, o, 0.12 + r() * 0.65, 0.008, 1 + r() * 5, [e.cyan, e.red, e.gold][n % 3], {
            emissive: 0.3,
            alpha: 0.2,
            reflection: !0,
          });
        }
        (this.box(0, 27, -75, 16, 3.1, 5.8, "#233a44"),
          this.sign("A LIFE ELSEWHERE", 0, 27, -71.9, 12, 1.8, e.gold),
          this.box(0, 25, -73, 2, 0.7, 1, e.gold, { emissive: 2 }));
        for (let n = 0; n < 8; n++) this.box(0, 6 + n * 2.2, -120, 48 - n * 5, 2.5, 28 - n * 2.6, "#293e45");
        (this.light(-5, 5, 5, e.cyan, 55), this.light(5, 5, -9, e.red, 50), this.light(0, 7, -24, e.gold, 45));
      }
      room() {
        let r = this.def.env,
          n = r === "tower" || r === "apartment",
          o = n ? "#3d3b36" : "#243944";
        (this.box(0, -0.19, -5, 19, 0.35, 48, n ? "#3b3833" : "#172e37", { ground: !0 }),
          this.box(-9, 4, -5, 0.5, 8, 48, o),
          this.box(9, 4, -5, 0.5, 8, 48, o),
          this.box(0, 4, -29, 18.5, 8, 0.4, o));
        for (let l = -24; l < 20; l += 6)
          for (let c of [-1, 1])
            (this.box(c * 8.6, 3, l, 0.3, 6, 0.65, n ? "#675344" : "#385562"),
              this.box(c * 8.4, 5.8, l, 0.08, 0.3, 2.5, n ? e.gold : e.cyan, { emissive: 1.6 }));
        for (let l = -20; l < 20; l += 5) this.box(0, 0.005, l, 18, 0.009, 0.035, n ? "#605348" : "#41545b");
        (this.light(-4, 5, 4, n ? e.gold : e.cyan, 65),
          this.light(4, 5, -12, n ? "#efa870" : e.mint, 55),
          this.sign(this.def.place.split("\u2022").pop().trim(), 0, 5.2, -28.6, 10, 1.1, n ? e.gold : e.mint));
      }
      desk(r, n) {
        this.box(r, 0.88, n, 2.7, 0.16, 1.25, "#49515a", { collide: !0 });
        for (let o of [-1, 1]) this.box(r + o * 1.1, 0.4, n, 0.12, 0.8, 1, "#22323b");
        (this.box(r, 1.32, n - 0.2, 1.1, 0.7, 0.2, "#0e1c27"),
          this.sign("\u2022 \u2022 \u2022  SYSTEM READY", r, 1.32, n - 0.075, 0.94, 0.47, e.mint));
      }
      bed(r, n) {
        (this.box(r, 0.35, n, 2.5, 0.6, 4, "#394d58", { collide: !0 }),
          this.box(r, 0.69, n, 2.4, 0.16, 3.7, "#81928f"),
          this.box(r, 0.84, n - 1.2, 1.65, 0.2, 0.8, "#c8c5ae"),
          this.box(r, 0.87, n + 0.5, 2.35, 0.18, 2, "#405a61"));
      }
      tank(r, n, o = e.cyan) {
        (this.box(r, 0.6, n, 1.6, 1.2, 1, "#304851"),
          this.box(r, 1.6, n, 1.5, 0.9, 0.9, o, { alpha: 0.24, emissive: 0.15 }),
          this.box(r, 2.1, n, 1.65, 0.15, 1.1, "#55666b"),
          this.box(r, 1.55, n, 1, 0.08, 0.12, e.paper),
          this.box(r + 0.45, 1.6, n, 0.17, 0.17, 0.2, e.gold, { emissive: 0.5 }));
      }
      setdress() {
        let r = this.def.env;
        if (["street", "chase", "market"].includes(r) && this.def.key !== "billiard") {
          (this.box(-5.5, 0.65, 5, 4.5, 1.2, 2.5, "#335558", { collide: !0 }),
            this.box(-5.5, 3.7, 5, 5.2, 0.35, 3.5, "#497476"));
          for (let n of [-7.6, -3.4]) this.box(n, 2.4, 5, 0.16, 2.7, 0.16, "#497476");
          this.sign(
            r === "market" ? "ANIMAL ROW" : r === "club" ? "TAFFEY\u2019S" : "NOODLES",
            -5.5,
            3.05,
            6.8,
            4.6,
            0.85,
            r === "club" ? e.pink : e.gold,
          );
          for (let n of [-7, -5.5, -4])
            (this.box(n, 0.35, 7.2, 0.13, 0.7, 0.13, e.edge),
              this.box(n, 0.75, 7.2, 0.6, 0.13, 0.55, "#596462"),
              this.box(n, 2.65, 5, 0.3, 0.65, 0.3, e.red, { emissive: 2 }));
          (this.sign("02 / 04", 5.7, 7, -1, 3, 1.3, e.red),
            this.sign("INCEPT", 6, 4, -10, 4, 1, e.cyan),
            this.sign("\u4EBA  \u5DE5  \u751F\u547D", -7, 7, -9, 1.25, 4.3, e.mint),
            this.box(5.6, 0.8, 10, 2.3, 0.9, 4.3, "#264657", { collide: !0 }),
            this.box(5.6, 1.45, 10, 1.8, 0.8, 2.6, "#17313e"),
            this.box(5.6, 1.55, 11.4, 1.8, 0.45, 0.06, e.cyan, { alpha: 0.5 }));
          for (let n of [4.7, 6.5]) this.box(n, 1, 12.2, 0.48, 0.25, 0.08, e.gold, { emissive: 2.7 });
          this.box(5.6, 1.95, 10, 0.9, 0.14, 0.3, e.red, { emissive: 3 });
        }
        if (r === "office") {
          (this.desk(-5, -8), this.desk(5, -16));
          for (let n = 0; n < 4; n++)
            this.sign(["ROY", "LEON", "PRIS", "ZHORA"][n], -6 + n * 4, 3, -28.65, 2.7, 2, e.cyan);
          this.box(0, 7, -7, 5, 0.1, 0.32, "#6c7372");
        }
        if (
          (r === "hospital" &&
            (this.bed(-5, -5),
            this.box(-5, 1.3, -5, 2.8, 1.3, 2, "#638184", { alpha: 0.3 }),
            this.sign("RESPIRATION   /   82", 5, 2.5, -12, 3.8, 1.8, e.mint),
            this.desk(5, -12),
            this.sign("HOLDEN  //  24H", -5, 3, -8, 3, 1, e.gold)),
          r === "tower")
        ) {
          for (let n of [-6, 6]) for (let o of [-20, -7, 7]) this.box(n, 5, o, 1.4, 10, 1.4, "#68503c");
          (this.box(0, 4.6, -28.7, 12, 6, 0.08, "#ef9959", { emissive: 0.75 }),
            this.sign("T Y R E L L", 0, 7.8, -28.5, 9, 1, e.gold),
            this.desk(-4, -7),
            this.bed(5, -20),
            this.box(5, 2, 2, 0.45, 4, 0.45, "#70523b"),
            this.box(5, 4.2, 2, 0.8, 0.5, 0.7, "#b4a575"),
            this.box(5, 4.55, 2, 0.5, 0.45, 0.42, "#d8c999"));
          for (let n of [4.83, 5.17]) this.box(n, 4.6, 2.23, 0.16, 0.16, 0.05, e.gold, { emissive: 1 });
        }
        if (
          (r === "hotel" &&
            (this.bed(-5, -8),
            this.box(6, 1.5, -16, 3, 3, 1.5, "#5b4e43", { collide: !0 }),
            this.sign("1187", 0, 4, -28.6, 2, 0.9, e.gold),
            this.box(5, 2, 5, 2, 2, 0.07, "#527c83", { metal: !0 }),
            this.box(5, 0.8, 4.8, 1.7, 0.8, 0.8, "#97a4a0", { collide: !0 })),
          r === "apartment")
        ) {
          (this.box(-5, 0.65, 1, 3, 1.1, 2, "#625245", { collide: !0 }),
            this.box(-5, 1.25, 0.1, 3, 0.8, 0.3, "#746451"),
            this.desk(5, -7),
            this.box(-5, 1, -16, 3, 1.8, 1.5, "#372f2a", { collide: !0 }));
          for (let n = 0; n < 18; n++)
            this.box(-6.3 + n * 0.15, 1.75, -15.1, 0.13, 0.06, 0.5, n % 3 ? "#dfdbbb" : "#17232b");
          this.bed(5, -22);
          for (let n = -18; n < 13; n += 5) {
            this.box(-8.7, 3, n, 0.05, 3, 3, "#b87b50", { emissive: 0.15 });
            for (let o = 1.7; o < 4.4; o += 0.3) this.box(-8.6, o, n, 0.08, 0.09, 3, "#342b29");
          }
        }
        if (r === "lab") {
          for (let n of [7, 0, -8, -17]) (this.tank(-6, n), this.tank(6, n, e.mint));
          (this.sign("HANNIBAL CHEW", 0, 4, -28.6, 8, 1.2, e.cyan), this.desk(-5, -23));
        }
        if (r === "market") {
          for (let n of [-6, -14, -22]) (this.tank(-6, n), this.tank(6, n, e.gold));
          this.sign("GENUINE / ARTIFICIAL", 0, 7, -24, 8, 1.1, e.gold);
        }
        if (r === "club") {
          this.box(0, 0.1, -12, 12, 0.15, 14, "#391f3e");
          for (let n = 0; n < 12; n++)
            this.box(
              (n % 4) * 2.8 - 4.2,
              0.2,
              -7 - Math.floor(n / 4) * 3,
              2.6,
              0.05,
              2.8,
              [e.pink, e.cyan, "#696269"][n % 3],
              { emissive: 0.18 },
            );
          (this.sign("THE SNAKE ROOM", 0, 5, -25, 10, 1.4, e.pink), this.light(0, 4, -12, e.pink, 55));
        }
        if (r === "backstage") {
          this.desk(-5, -10);
          for (let n of [-6, 6])
            for (let o of [5, -4, -14])
              (this.box(n, 1.2, o, 0.6, 1.7, 0.45, "#777d71"), this.box(n, 2.2, o, 0.45, 0.48, 0.4, "#a7a98e"));
          this.sign("NO ADMITTANCE", 0, 4.5, -28.6, 6, 1, e.red);
        }
        if (r === "atrium") {
          for (let n of [3.5, 7, 10.5])
            for (let o of [-7.7, 7.7]) {
              (this.box(o, n, -5, 2, 0.2, 46, "#665044"),
                this.box(o - (o > 0 ? 1 : -1), n + 0.6, -5, 0.1, 1.2, 46, "#ab8262"));
              for (let l = -24; l < 16; l += 3) this.box(o - (o > 0 ? 1 : -1), n + 0.6, l, 0.15, 1.2, 0.15, "#9c7760");
            }
          (this.sign("BRADBURY", 0, 7, -27, 8, 1.5, e.gold), this.box(0, 4, -27, 4, 6, 0.12, "#806b52"));
          for (let n = -1.8; n < 2; n += 0.35) this.box(n, 4, -26.8, 0.08, 5.8, 0.07, "#bea47d");
          this.character("Mechanical bear", -6, -17, "#745436", { skin: "#906e45" }).parts.forEach((n) => {
            ((n.w *= 0.7), (n.h *= 0.7), (n.d *= 0.7), (n.oy *= 0.7));
          });
        }
        if (r === "chase" && this.def.key !== "billiard") {
          for (let n = 0; n < 7; n++) {
            let o = n % 2 ? -3.8 : 3.8,
              l = 5 - n * 5;
            (this.box(o, 0.7, l, 2.3, 1.4, 1.5, "#364a50", { collide: !0 }),
              this.box(o, 1.43, l, 2.4, 0.06, 1.55, e.gold, { emissive: 0.16 }));
          }
          this.bounds.minZ = -55;
        }
        if (r === "roof") {
          this.box(0, -0.4, -6, 18, 0.8, 48, "#263943", { ground: !0 });
          for (let n of [-1, 1]) this.box(n * 8.5, 0.35, -6, 0.35, 0.7, 48, "#526066");
          for (let n of [2, -14]) this.box(-5, 1.1, n, 2, 2.2, 3, "#4a5659", { collide: !0 });
          (this.box(6, 5, -17, 0.18, 10, 0.18, e.edge),
            this.box(6, 7.5, -17, 4, 0.12, 0.12, e.edge),
            this.sign("ROOF ACCESS", 0, 3, -25, 5, 1, e.mint));
        }
        if (r === "forest") {
          ((this.bounds = { minX: -4.1, maxX: 4.1, minZ: -480, maxZ: 20 }),
            this.box(0, -0.2, -200, 12, 0.35, 480, "#344046", { ground: !0 }),
            this.box(0, -0.4, -200, 180, 0.5, 500, "#253c3b"));
          for (let n = 10; n > -480; n -= 7) {
            this.box(0, 0.012, n, 0.13, 0.014, 2.8, "#b6ac83");
            for (let o of [-1, 1]) {
              let l = o * (7 + this.rng() * 25),
                c = 9 + this.rng() * 7;
              (this.box(l, c / 2, n, 1, c, 1, "#878577"),
                this.box(l, c, n, 4 + this.rng() * 4, 5, 5, "#426457"),
                this.box(l, c + 3, n, 3, 3, 3, "#567766"));
            }
          }
          this.light(0, 14, -25, e.gold, 50);
        }
      }
      prop(r, n, o, l, c = 1) {
        let h = (d, f, g, u, p, m, y, b = {}) => this.box(n + d * c, o + f * c, l + g * c, u * c, p * c, m * c, y, b);
        if (["origami", "unicorn"].includes(r)) {
          (h(0, 0.15, 0, 0.44, 0.22, 0.24, e.paper),
            h(0.25, 0.34, 0, 0.17, 0.26, 0.18, e.paper),
            h(0.32, 0.48, 0.02, 0.28, 0.13, 0.17, e.paper),
            r === "unicorn" && h(0.4, 0.61, 0.02, 0.035, 0.22, 0.035, e.gold));
          for (let d of [-0.16, 0.16]) for (let f of [-0.085, 0.085]) h(d, -0.02, f, 0.045, 0.19, 0.045, e.paper);
          h(-0.28, 0.24, 0, 0.18, 0.045, 0.045, e.paper);
        } else if (["photo", "paper", "ledger", "fabric", "map", "sign"].includes(r))
          if (
            (h(0, 0.015, 0, 0.78, 0.04, 0.59, e.paper),
            h(0, 0.045, 0, 0.66, 0.016, 0.46, r === "photo" ? "#4f7479" : "#6b6860"),
            r === "photo")
          )
            (h(-0.1, 0.06, 0.02, 0.16, 0.02, 0.24, e.skin), h(-0.1, 0.065, -0.15, 0.13, 0.02, 0.1, "#283b42"));
          else for (let d = 0; d < 4; d++) h(-0.04, 0.06, -0.14 + d * 0.095, 0.47, 0.012, 0.018, "#bbbca7");
        else if (r === "scale") {
          (h(0, 0.02, 0, 0.7, 0.08, 0.64, "#8baba5"), h(0, 0.09, 0, 0.42, 0.06, 0.35, "#c49b57", { metal: !0 }));
          for (let d = -1; d < 2; d++) h(d * 0.095, 0.125, 0, 0.02, 0.013, 0.27, "#6b653f");
        } else if (r === "blaster")
          (h(0.05, 0.12, 0, 0.7, 0.14, 0.19, "#3d494d", { metal: !0 }),
            h(-0.22, 0.03, 0, 0.18, 0.23, 0.18, "#a8774c"),
            h(0.17, 0.22, 0, 0.37, 0.06, 0.14, "#697d7c", { metal: !0 }));
        else if (r === "owl") {
          (h(0, 0.5, 0, 0.62, 0.7, 0.42, "#b8a783"), h(0, 0.97, 0, 0.68, 0.33, 0.46, "#ded1a5"));
          for (let d of [-0.2, 0.2])
            (h(d, 1, 0.245, 0.18, 0.17, 0.035, e.gold, { emissive: 0.6 }),
              h(d, 1, 0.27, 0.055, 0.1, 0.02, "#121a1b"),
              h(d, 0.08, 0, 0.15, 0.16, 0.22, "#726441"));
          h(0, 0.85, 0.28, 0.11, 0.13, 0.11, "#b9904e");
        } else if (r === "eye")
          (h(0, 0.1, 0, 0.34, 0.22, 0.27, "#d8dbcb"),
            h(0, 0.13, 0.15, 0.16, 0.16, 0.025, "#85aaa6", { emissive: 0.2 }),
            h(0, 0.13, 0.17, 0.065, 0.08, 0.02, "#11212c"));
        else if (r === "snake") {
          for (let d = 0; d < 12; d++)
            h(
              Math.sin(d * 0.85) * 0.4,
              0.08 + Math.cos(d * 0.6) * 0.045,
              (d - 5) * 0.085,
              0.2,
              0.14,
              0.14,
              d % 2 ? "#a29359" : "#787643",
            );
          h(0.3, 0.12, 0.5, 0.25, 0.15, 0.18, "#b39c69");
        } else if (r === "chess") {
          for (let d = 0; d < 6; d++)
            for (let f = 0; f < 6; f++)
              h((d - 2.5) * 0.16, 0, (f - 2.5) * 0.16, 0.15, 0.03, 0.15, (d + f) % 2 ? "#6e5039" : e.paper);
          for (let d = 0; d < 6; d++)
            (h((d - 2.5) * 0.16, 0.12, -0.4, 0.1, 0.23, 0.1, "#46362b"),
              h((d - 2.5) * 0.16, 0.12, 0.4, 0.1, 0.23, 0.1, "#d1c5a3"));
        } else if (r === "toy") {
          (h(0, 0.25, 0, 0.42, 0.46, 0.25, "#97774e"), h(0, 0.64, 0, 0.38, 0.31, 0.28, "#b0976a"));
          for (let d of [-0.23, 0.23])
            (h(d, 0.8, 0, 0.15, 0.15, 0.15, "#a18357"),
              h(d, 0.24, 0, 0.16, 0.42, 0.22, "#957549"),
              h(d * 0.6, -0.07, 0.08, 0.17, 0.18, 0.28, "#806448"));
          for (let d of [-0.08, 0.08]) h(d, 0.69, 0.15, 0.045, 0.05, 0.015, "#16252b");
        } else if (r === "cabinet") {
          (h(0, 0.37, 0, 0.78, 0.75, 0.4, "#786c5d"), h(0, 0.4, 0.21, 0.028, 0.66, 0.03, "#293638"));
          for (let d of [-0.075, 0.075]) h(d, 0.4, 0.25, 0.03, 0.14, 0.035, e.gold);
        } else
          (h(0, 0.12, 0, 0.53, 0.24, 0.32, "#647a7f"), h(0, 0.14, 0.18, 0.31, 0.1, 0.02, e.mint, { emissive: 0.5 }));
      }
      details() {
        let r = this.def.detail,
          n =
            {
              analysis: "lab",
              dealer: "market",
              phone: "phone",
              stage: "club-floor",
              dressing: "zhora",
              dresses: "dolls",
              "toy-lab": "sebastian",
              lift: "tower-lift",
              bedchamber: "maker",
              pigeons: "pigeon",
              "roof-gap": "roof",
              witness: "roof",
              ledge: "roof",
            }[r] || r,
          o = this.def.env,
          l = this.box.bind(this),
          c = this.sign.bind(this);
        if (((this.animations = []), !this.day))
          for (let h = 0; h < 7; h++) {
            let d = 12 - h * 6;
            if (this.outside) {
              if (h < 5) {
                l(-7, 0.03, d, 0.8, 0.025, 0.75, "#3b4e53");
                for (let f = 0; f < 4; f++) l(-7 + 0.13 * f - 0.2, 0.05, d, 0.035, 0.015, 0.65, "#12252e");
              }
            } else
              for (let f of [-1, 1]) {
                (l(f * 8.32, 1.1, d, 0.12, 1.7, 4.6, h % 2 ? "#31464a" : "#39433f"),
                  l(f * 8.2, 0.28, d, 0.12, 0.11, 4.6, "#72736a"));
                for (let g = 0; g < 4; g++) l(f * 8.19, 1.15 + g * 0.11, d, 0.13, 0.035, 0.9, "#0f2029");
              }
          }
        if (this.outside && !this.day && o !== "roof")
          for (let h = 0; h < 3; h++) {
            let d = [],
              f = -30 + h * 17,
              g = 10 + h * 4,
              u = -20 - h * 20;
            (d.push(l(f, g, u, 2.3, 0.55, 3.9, "#354e5d", { dynamic: !0 })),
              d.push(l(f, g + 0.45, u, 1.7, 0.5, 2, "#173444", { dynamic: !0 })));
            for (let p of [-1, 1])
              d.push(l(f + p * 0.8, g, u + 2, 0.3, 0.17, 0.06, e.gold, { emissive: 2, dynamic: !0 }));
            this.animations.push({
              kind: "traffic",
              parts: d,
              base: d.map((p) => ({ x: p.x, y: p.y, z: p.z })),
              phase: h * 2.1,
            });
          }
        if (n === "hades") {
          for (let h = 0; h < 5; h++) {
            let d = 22 + h * 9,
              f = -44 - h * 8;
            l(d, 4, f, 2, 8, 2, "#4a4440");
            let g = l(d, 8.9, f, 0.8, 1.6, 0.8, "#ffbf6f", { emissive: 3, dynamic: !0 });
            this.animations.push({ kind: "flame", o: g, y: 8.9, phase: h });
          }
          c("LOS ANGELES  /  NOVEMBER 2019", 0, 12, -40, 17, 1.3, e.gold);
        }
        if (n === "spinner") {
          for (let h of [-1, 1])
            (l(h * 5.7, 0.9, -5, 1.1, 1.8, 25, "#344c56"), l(h * 5.7, 3, -5, 0.12, 2, 25, "#5995a3", { alpha: 0.13 }));
          (l(0, 3.9, -5, 12, 0.2, 30, "#1c303d"), l(0, 0.75, -23, 9, 1.5, 2, "#405562"));
          for (let h of [-3, 0, 3])
            (c(h ? "FLIGHT / 041" : "AUTO / PILOT", h, 1.5, -21.95, 2.1, 0.65, e.mint),
              l(h, 1, -21.8, 1.8, 0.06, 0.4, "#75877c"));
          c("SPINNER  /  APPROACH CHANNEL", 0, 3.1, -23, 8, 0.7, e.gold);
          for (let h of [-1, 1])
            (l(h * 3.3, 0.55, 10, 1.7, 1.1, 2, "#4c4c43"), l(h * 3.3, 1.3, 9, 1.7, 1.2, 0.3, "#5d5b4b"));
        }
        if (["interview", "bryant"].includes(n)) {
          (l(-5, 1, -5, 3, 0.17, 1.6, "#7b6951"),
            l(-5, 1.4, -5, 1, 0.67, 0.66, "#273b3c"),
            l(-4.65, 1.8, -4.75, 0.18, 0.48, 0.2, "#a0a896"),
            l(-4.65, 2, -4.55, 0.5, 0.28, 0.2, "#496970"),
            c("RESPONSE / BASELINE", -5, 1.47, -4.62, 0.9, 0.36, e.mint));
          for (let h = 0; h < 3; h++) l(-5.35 + h * 0.17, 1.08, -4.35, 0.1, 0.03, 0.12, e.gold);
          c("INTERVIEW IN PROGRESS", 0, 5, -26, 7, 0.55, e.gold);
          for (let h of [-1, 1]) for (let d = 2; d < 5; d += 0.35) l(h * 8.05, d, -6, 0.1, 0.13, 5, "#3f4c48");
        }
        if (n === "phone") {
          (l(5, 1, -10, 2, 2, 1.4, "#485956"),
            l(5, 2.1, -10, 1.6, 1.2, 0.6, "#344c50"),
            c("VID-PHONE / CONNECT", 5, 2.1, -9.65, 1.35, 0.75, e.mint),
            l(5, 1.05, -9.1, 1.25, 0.06, 0.5, "#78857d"));
          for (let h = 0; h < 3; h++)
            for (let d = 0; d < 3; d++) l(4.6 + h * 0.35, 1.1, -9.05 + d * 0.15, 0.2, 0.04, 0.1, e.paper);
        }
        if (n === "records") {
          for (let h of [-1, 1])
            for (let d = 0; d < 5; d++) {
              let f = h * 7.2,
                g = 9 - d * 7;
              l(f, 1.4, g, 1.2, 2.8, 2.6, "#45514e");
              for (let u = 0; u < 5; u++)
                (l(f - h * 0.64, 0.3 + u * 0.5, g, 0.04, 0.4, 2.35, "#69726a"),
                  l(f - h * 0.68, 0.33 + u * 0.5, g, 0.03, 0.08, 0.42, e.paper));
            }
          c("ARCHIVE / CHAIN OF CUSTODY", 0, 4.4, -27, 9, 0.7, e.mint);
        }
        if (["corridor", "hotel-exterior", "stairs", "bradbury-street"].includes(n)) {
          for (let h of [8, -3, -14])
            for (let d of [-1, 1])
              (l(d * 7.5, 1.55, h, 0.16, 3.1, 2.5, "#594f44"),
                c(String(1187 + Math.round((8 - h) / 11)), d * 6.9, 2.8, h, 1, 0.3, e.gold),
                l(d * 7.37, 1.45, h + 0.7, 0.13, 0.13, 0.25, "#c4ad7a", { metal: !0 }));
          if (n === "stairs") {
            for (let h = 0; h < 9; h++) l(7.1, h * 0.24, -17 + h * 0.75, 1.4, 0.24, 0.75, "#6d6252");
            c("UPPER FLOORS", 0, 4, -25, 6, 0.7, e.gold);
          }
        }
        if (["freezer", "lab"].includes(n)) {
          for (let h of [-1, 1])
            for (let d of [7, 0, -8, -17]) {
              (this.prop("eye", h * 6, 1.72, d, 0.95), l(h * 7.3, 0.7, d, 0.22, 1.4, 0.22, "#c1c7bd"));
              let f = l(h * 5.9, 0.3, d, 1.6, 0.13, 0.6, "#b6d1cd", { alpha: 0.18, dynamic: !0 });
              this.animations.push({ kind: "mist", o: f, y: 0.3, phase: d });
            }
          for (let h of [5, -7, -19]) l(0, 5.7, h, 15, 0.25, 0.4, "#a8b9ad");
          c("EYE DESIGN / COLD STORE", 0, 3.7, -27, 8, 0.65, e.cyan);
        }
        if (["bathroom", "firstaid", "upper-bath"].includes(n)) {
          for (let h of [-1, 1])
            for (let d = 0; d < 5; d++)
              for (let f = -20; f < 15; f += 4)
                l(h * 8.15, 0.65 + d * 0.6, f, 0.08, 0.55, 3.85, (d + f) % 2 ? "#839187" : "#72877f");
          (l(-5.7, 0.5, -12, 2.5, 1, 4.7, "#afbbb0"),
            l(-5.7, 1.04, -12, 2, 0.06, 4.2, "#5a7576"),
            l(6, 0.7, 2, 2, 1.2, 1.2, "#98aaa2"),
            l(6, 1.34, 2, 2.1, 0.12, 1.3, "#c6cec0"),
            l(6, 2.5, 1.45, 2.3, 2, 0.08, "#57838b", { metal: !0 }),
            l(6, 1.65, 1.8, 0.08, 0.6, 0.1, "#b2bbb1", { metal: !0 }),
            this.prop("paper", 5.7, 1.48, 2.2, 0.55),
            c("WATER / RECYCLED", -6, 2, -9.8, 2.2, 0.4, e.mint));
        }
        if (["bedroom", "living", "piano", "packing", "esper", "dream"].includes(n)) {
          for (let h of [8, -3, -14]) {
            l(-7, 1.25, h, 1, 2.5, 3.3, "#5e493b");
            for (let d = 0; d < 6; d++)
              l(
                -6.42,
                0.9 + (d % 2) * 0.8,
                h - 1 + (d % 3) * 0.7,
                0.07,
                0.58,
                0.22,
                ["#a2875f", "#758376", "#a06d54"][d % 3],
              );
          }
          for (let h = 0; h < 5; h++) l(5.6, 0.02, 5 + h * 0.25, 2.8, 0.01, 0.12, "#676458");
          for (let h of [-1.8, 0, 1.8])
            (l(h, 2.5, -28.35, 1.2, 1.45, 0.12, "#876e4f"), l(h, 2.5, -28.25, 1, 1.25, 0.07, "#445b5e"));
          if (
            (n === "esper" &&
              (l(5, 1.7, -7, 1.8, 1.15, 0.35, "#556968"),
              c("ESPER / OPTICAL ANALYSIS", 5, 1.76, -6.78, 1.6, 0.82, e.cyan),
              l(5.85, 1.18, -6.4, 0.6, 0.15, 0.8, "#bbbda5"),
              this.prop("photo", 5.8, 1.3, -6, 0.62)),
            n === "packing" &&
              (l(-4.7, 1.35, 1, 1.8, 0.27, 1.2, "#b08c65"),
              l(-4.7, 1.72, 0.35, 1.8, 0.66, 0.13, "#7f6348"),
              this.prop("blaster", -4.7, 1.56, 1, 0.65)),
            n === "dream")
          ) {
            this.prop("unicorn", 0, 0.3, -20, 5);
            for (let h of [-5.5, 5.5]) l(h, 3, -18, 0.4, 6, 0.4, "#b2c1b0");
            c("UNPLACED MEMORY", 0, 4, -25, 8, 0.6, e.mint);
          }
        }
        if (["owl", "maker", "chess", "tower-lift"].includes(n)) {
          (n === "owl" && (l(5, 1.8, -10, 0.45, 3.6, 0.45, "#81684c"), this.prop("owl", 5, 3.5, -10, 1.35)),
            n === "chess" && this.prop("chess", -4, 1.05, -7, 1.2));
          for (let h of [-1, 1])
            for (let d of [12, 0, -15])
              (l(h * 7.2, 2.5, d, 0.2, 5, 0.2, "#b08e54"), l(h * 7.2, 5.1, d, 0.5, 0.18, 0.5, e.gold, { emissive: 2 }));
          l(0, 6.4, -27, 8, 0.2, 0.8, "#b18b55");
        }
        if (["club", "club-floor", "backstage", "zhora"].includes(n) || o === "club") {
          for (let h of [-1, 1])
            for (let d of [4, -6, -17])
              (l(h * 6.7, 0.75, d, 1.6, 0.14, 1.4, "#6e3f50"),
                l(h * 6.7, 0.35, d, 0.12, 0.7, 0.12, e.edge),
                l(h * 6.7, 0.9, d, 0.17, 0.25, 0.17, e.gold, { alpha: 0.5 }));
          if (o === "club") {
            for (let h of [-4.7, 4.7]) l(h, 3.5, -25, 2.2, 7, 0.25, "#70475d");
            c("LIVE / TONIGHT", 0, 3, -24, 4, 0.6, e.gold);
          }
          if (o === "backstage" || n === "zhora") {
            for (let h of [-1, 1]) {
              l(h * 6, 2.5, -4, 2.6, 2.6, 0.15, "#648792", { metal: !0 });
              for (let d of [1.4, 2, 2.6, 3.2])
                for (let f of [-1.4, 1.4]) l(h * 6 + f, d, -3.8, 0.12, 0.12, 0.12, e.gold, { emissive: 2 });
            }
            (this.prop("snake", -5, 1.02, -10, 1.8), c("SALOME / DRESSING", 0, 4, -26, 6, 0.65, e.pink));
          }
        }
        if (["atrium", "sebastian", "dolls", "friends", "billiard", "armoire", "pigeon", "roof"].includes(n)) {
          for (let h = 0; h < 6; h++) {
            let d = h % 2 ? 6.6 : -6.6,
              f = 8 - Math.floor(h / 2) * 11;
            (l(d, 0.5, f, 1.2, 1, 0.8, "#52493d"), this.prop("toy", d, 1.2, f, 0.9 + (h % 3) * 0.18));
          }
          if (n === "billiard") {
            (l(-4.7, 0.85, -7, 3.5, 1.7, 5.3, "#5b4136", { collide: !0 }),
              l(-4.7, 1.73, -7, 3.1, 0.04, 4.9, "#59705a"));
            for (let h = 0; h < 6; h++)
              l(-4.9 + (h % 2) * 0.25, 1.81, -7 + h * 0.2, 0.12, 0.12, 0.12, [e.gold, e.paper, e.red][h % 3]);
          }
          if (n === "armoire") {
            l(-5.5, 1.6, -11, 3, 3.2, 1.6, "#63503e");
            for (let h of [-6.25, -4.75]) l(h, 1.6, -10.1, 1.4, 2.9, 0.1, "#917251");
          }
          if (n === "pigeon" || o === "roof")
            for (let h = 0; h < 5; h++) {
              let d = l(5.9 - h * 0.34, 1.7 + (h % 2) * 0.12, -18 - h * 0.4, 0.24, 0.25, 0.42, "#c0c8b6", {
                dynamic: !0,
              });
              (this.animations.push({ kind: "bird", o: d, y: d.y, phase: h }),
                l(d.x, 1.82, d.z + 0.23, 0.17, 0.19, 0.18, e.paper));
            }
        }
        if (n === "arcade" || o === "chase")
          for (let h of [-1, 1])
            for (let d = 0; d < 4; d++) {
              let f = 5 - d * 9;
              (l(h * 7.5, 2, f, 0.14, 4, 6, "#97c0ba", { alpha: 0.2, metal: !0 }),
                l(h * 7.1, 2, f - 3, 0.4, 4, 0.35, "#798786"),
                c(d % 2 ? "CLOTHING" : "DISPLAY / OPEN", h * 6.8, 4.5, f, 2.4, 0.5, d % 2 ? e.pink : e.gold));
            }
        if (this.def.steps.some((h) => h.kind === "stealth")) {
          for (let [h, d] of [
            [-5.5, 2],
            [5.5, -8],
            [-5.5, -19],
          ])
            l(h, 1, d, 1.2, 2, 2.4, "#4f5d59", { collide: !0 });
          c("SERVICE / KEEP CLEAR", 0, 4, -26, 6, 0.5, e.gold);
        }
      }
      animate(r, n, o = !1) {
        if (!o)
          for (let l of this.animations || []) {
            if (l.kind === "traffic")
              for (let c = 0; c < l.parts.length; c++) {
                let h = l.base[c];
                ((l.parts[c].x = ((h.x + r * (2.2 + l.phase * 0.25) + 60) % 120) - 60),
                  (l.parts[c].y = h.y + Math.sin(r * 0.5 + l.phase) * 0.18));
              }
            (l.kind === "flame" &&
              ((l.o.h = 1.3 + Math.sin(r * 8 + l.phase) * 0.3), (l.o.y = l.y + Math.sin(r * 8 + l.phase) * 0.16)),
              l.kind === "mist" && ((l.o.y = l.y + ((((r * 0.15 + l.phase) % 1) + 1) % 1) * 0.9), (l.o.alpha = 0.12)),
              l.kind === "bird" && (l.o.y = l.y + Math.sin(r * 2 + l.phase) * 0.035));
          }
      }
      build() {
        if (pX(this)) return;
        if (tX.includes(this.def.key)) {
          dX(this);
          return;
        }
        let r = ["street", "chase", "market", "roof"].includes(this.def.env) && this.def.key !== "billiard";
        ((this.sheltered = ["hades", "spinner-recall", "tyrell-flight"].includes(this.def.key)),
          (this.outside = r || this.def.env === "forest"),
          (this.day = this.def.env === "forest"),
          r ? this.city() : this.day || this.room(),
          this.setdress(),
          this.details());
        let n = [
          [-2.4, 5],
          [2.8, -3],
          [-2.6, -12],
          [2.6, -21],
        ];
        if (
          (this.def.steps.forEach((o, l) => {
            let [c, h] = o.position || n[l % n.length],
              d = 1.35;
            (["talk", "vk", "interview"].includes(o.kind)
              ? this.character(o.label, c, h, l % 2 ? "#79513f" : "#3c6065", {
                  hair: o.subject === "Rachael" ? "#352e2a" : o.subject === "Leon" ? "#564833" : void 0,
                  hat: o.id === "gaff",
                })
              : (this.box(c, 0.7, h, 1.35, 1.4, 0.9, "#293f49"),
                this.box(c, 1.48, h, 1.45, 0.12, 1, e.edge),
                this.sign(
                  o.kind === "collect" ? "EVIDENCE" : o.kind.toUpperCase(),
                  c,
                  1.53,
                  h + 0.52,
                  1.13,
                  0.26,
                  e.mint,
                ),
                this.prop(
                  o.model || (o.kind === "chess" ? "chess" : o.kind === "esper" ? "photo" : "device"),
                  c,
                  1.57,
                  h,
                  0.78,
                ),
                (d = 1.75)),
              this.hotspots.push({ id: o.id, step: o, x: c, y: d, z: h, optional: !1 }));
          }),
          this.def.optional.forEach((o, l) => {
            let [c, h] = o.position || [l % 2 ? 3.2 : -2.8, 12.4 - l * 2.8];
            (this.box(c, 0.65, h, 1.1, 1.3, 0.75, "#35484c"),
              this.prop(o.model || "device", c, 1.35, h, 0.65),
              this.sign("+", c, 2.05, h, 0.38, 0.38, e.gold),
              this.hotspots.push({ id: o.id, step: o, x: c, y: 1.65, z: h, optional: !0 }));
          }),
          (this.exit = { x: 0, y: 1.5, z: -25, id: "exit", exit: !0 }),
          this.hotspots.push(this.exit),
          this.box(0, 1.5, -26, 2.8, 3, 0.25, "#172e36"),
          this.sign("\u2192", 0, 1.8, -25.8, 1.2, 1.2, e.mint),
          r && this.def.env !== "roof")
        )
          for (let o = 0; o < 4; o++)
            this.character("Pedestrian", o % 2 ? 6.4 : -6.5, -6 - o * 7, ["#354847", "#535046", "#54424b"][o % 3], {
              hat: o % 2 === 0,
            });
        H_(this, bd[this.def.key]);
      }
      collides(r, n, o = 0.3) {
        if (r < this.bounds.minX || r > this.bounds.maxX || n < this.bounds.minZ || n > this.bounds.maxZ) return !0;
        let l = this.groundHeight?.(r, n) || 0;
        return this.obstacles.some(
          (c) =>
            !c.hidden &&
            (!this.isDistrict || (c.y + c.h / 2 > l + 0.25 && c.y - c.h / 2 < l + 1.7)) &&
            Math.abs(r - c.x) < c.w / 2 + o &&
            Math.abs(n - c.z) < c.d / 2 + o,
        );
      }
    }
    return { World: s };
  })(),
  { GPUWorldRenderer: Z3, project: lT } = (() => {
    // Screen position of a world point for the HUD markers. It matches the GPU camera below
    // (68° vertical field of view, yaw then pitch).
    function s(n, o, l, c) {
      let h = n.x - o.x,
        d = n.z - o.z,
        f = n.y - o.y,
        g = Math.cos(o.yaw),
        u = Math.sin(o.yaw),
        p = Math.cos(o.pitch),
        m = Math.sin(o.pitch),
        y = h * g - d * u,
        b = -h * u - d * g,
        x = f * p - b * m,
        T = b * p + f * m,
        v = c / (2 * Math.tan((68 * Math.PI) / 360));
      return { x: l / 2 + (y * v) / T, y: c / 2 - (x * v) / T, z: T, scale: v / T };
    }
    // The world renderer. The kit owns the WebGPURenderer (WebGPU, or WebGL2 when WebGPU is
    // missing), sizes it and picks the quality tier; this class owns the scene. One scene, camera,
    // light rig and post chain live for the whole session; setWorld() swaps the world's boxes,
    // signs and rain in and out of `content`.
    class r {
      constructor(kit) {
        let o = THREE,
          l = TSL,
          c = kit.renderer;
        ((this.kit = kit),
          (this.T = o),
          (this.N = l),
          (this.renderer = c),
          (this.materials = new Map()),
          (this.groups = []),
          (this.textures = []),
          (this.signMaterials = []),
          (this.signBindings = []),
          (this.label = kit.backend === "webgpu" ? "WEBGPU" : "WEBGL 2"),
          (c.toneMapping = o.ACESFilmicToneMapping),
          (c.toneMappingExposure = 1.18),
          (c.outputColorSpace = o.SRGBColorSpace),
          (c.shadowMap.enabled = !0),
          (c.shadowMap.type = o.PCFShadowMap),
          (this.camera = kit.fitCamera(new o.PerspectiveCamera(68, 1, 0.07, 250))),
          (this.camera.rotation.order = "YXZ"),
          (this.scene = new o.Scene()),
          (this.sky = [l.uniform(new o.Color("#07141f")), l.uniform(new o.Color("#28414a")), l.uniform(new o.Color("#0b1e27"))]),
          // The same screen-space sky gradient the game's original software view painted behind the city.
          (this.scene.backgroundNode = l.mix(
            l.mix(this.sky[0], this.sky[1], l.smoothstep(0, 0.56, l.screenUV.y)),
            this.sky[2],
            l.smoothstep(0.56, 1, l.screenUV.y),
          )),
          (this.scene.fog = new o.FogExp2("#132d39", 0.014)),
          // A bright, nearly neutral sky light keeps every box close to its authored colour, as the
          // original view showed it; the moon, lamps, shadows and bloom add the GPU detail on top.
          (this.hemi = new o.HemisphereLight("#eef3f1", "#74827f", 4.9)));
        let h = new o.DirectionalLight(10998491, 1.6);
        (h.position.set(-12, 24, 8),
          (h.castShadow = !0),
          Object.assign(h.shadow.camera, { left: -22, right: 22, top: 25, bottom: -25, far: 100 }),
          (h.shadow.normalBias = 0.045),
          (h.shadow.bias = -15e-5),
          kit.shadow(h, 2048),
          h.target.position.set(0, 0, -10),
          (this.moon = h),
          (this.localLights = Array.from({ length: 4 }, () => new o.PointLight(16777215, 0, 28, 2))),
          (this.lightCount = 4),
          (this.content = new o.Group()),
          this.scene.add(this.hemi, h, h.target, ...this.localLights, this.content),
          (this.geom = new o.BoxGeometry(1, 1, 1)),
          (this.instanceTint = new o.Color()),
          // Plain opaque boxes (most of every scene) share two materials for the whole session and
          // carry their colour per instance, so a scene is a handful of draw calls instead of one per
          // colour, and loading the next scene builds almost no new materials.
          (this.shared = [0.12, 0.6].map(
            (f) => new o.MeshStandardNodeMaterial({ color: 16777215, roughness: 0.72, metalness: f, flatShading: !0 }),
          )));
        // Bloom and the vignette stay on at every tier; the kit makes them cheaper on low and
        // medium and adds FXAA where there is no MSAA.
        let f = l.smoothstep(0.22, 0.8, l.screenUV.sub(0.5).length());
        ((this.post = createPost(kit, this.scene, this.camera, {
          bloom: { strength: 0.25, radius: 0.38, threshold: 1.05 },
          output: (g) => g.mul(l.mix(1, 0.72, f)),
        })),
          kit.onQuality(() => this.world && this.setWorld(this.world)));
      }
      material(o) {
        // Plain opaque boxes: one of the two shared materials, tinted per instance (see updateGroup).
        if (!o.emissive && !o.alpha && !o.ground) return this.shared[o.metal ? 1 : 0];
        let l = this.T,
          c = this.N,
          h = [o.color, o.emissive || 0, o.alpha || 1, o.ground ? "ground" : "box", o.metal ? "metal" : "plain"].join(
            "/",
          );
        if (this.materials.has(h)) return this.materials.get(h);
        let d = new l.MeshStandardNodeMaterial({
          color: o.color,
          roughness: o.ground ? 0.3 : 0.72,
          metalness: o.ground ? (this.world?.day ? 0.15 : 0.3) : o.metal ? 0.6 : 0.12,
          flatShading: !0,
        });
        if (
          (o.emissive && ((d.emissive = new l.Color(o.color)), (d.emissiveIntensity = o.emissive)),
          o.alpha && ((d.transparent = !0), (d.opacity = o.alpha), (d.depthWrite = !1)),
          o.ground)
        ) {
          let f = c.positionWorld,
            g = c
              .sin(f.x.mul(9).add(c.sin(f.z.mul(5))))
              .mul(0.055)
              .add(0.26);
          d.roughnessNode = g;
          let u = c
            .sin(f.x.mul(4))
            .mul(c.sin(f.z.mul(7)))
            .mul(0.055)
            .add(0.9);
          d.colorNode = c.color(o.color).mul(u);
        }
        return (this.materials.set(h, d), d);
      }
      setWorld(o) {
        let l = this.T,
          c = o.day;
        ((this.world = o),
          this.clear(),
          (c ? ["#6e8e88", "#a3b6a0", "#1a3032"] : ["#07141f", "#28414a", "#0b1e27"]).forEach((f, g) =>
            this.sky[g].value.set(f),
          ),
          this.scene.fog.color.set(c ? "#7e9d96" : "#132d39"),
          (this.scene.fog.density = c ? 0.009 : 0.014),
          this.hemi.color.set(c ? "#f4f7ee" : "#eef3f1"),
          this.hemi.groundColor.set(c ? "#7b8c80" : "#74827f"),
          (this.hemi.intensity = c ? 4.4 : 4.9),
          this.moon.color.set(c ? 16769971 : 10998491),
          (this.moon.intensity = c ? 3.2 : 1.6),
          this.moon.position.set(-12, 24, 8),
          this.moon.target.position.set(0, 0, -10),
          (this.lightCount = this.kit.tier.name === "low" ? 2 : 4),
          this.localLights.forEach((f, g) => {
            let u = g < this.lightCount ? o.lights[g] : null;
            u ? (f.color.set(u.color), (f.intensity = u.power), f.position.set(u.x, u.y, u.z)) : (f.intensity = 0);
          }));
        let h = new Map();
        for (let f of o.objects) {
          if (f.text) {
            this.addSign(f);
            continue;
          }
          let g = this.material(f),
            u = g.uuid + (f.dynamic ? ":dynamic" : ":static") + (f.noShadow ? ":unshadowed" : "");
          (h.has(u) || h.set(u, { mat: g, objects: [] }), h.get(u).objects.push(f));
        }
        for (let f of h.values()) {
          let g = new l.InstancedMesh(this.geom, f.mat, f.objects.length),
            u = f.objects.some((p) => p.dynamic);
          // Per-instance colour: the box's own colour on the shared materials, its brightness
          // (lifeDim) everywhere else.
          ((g.instanceColor = new l.InstancedBufferAttribute(new Float32Array(f.objects.length * 3).fill(1), 3)),
            (g.castShadow = !f.mat.transparent && !f.objects[0].noShadow),
            (g.receiveShadow = !0),
            (g.frustumCulled = !1),
            u && (g.instanceMatrix.setUsage(l.DynamicDrawUsage), g.instanceColor.setUsage(l.DynamicDrawUsage)),
            this.groups.push({ mesh: g, objects: f.objects, dynamic: u, tinted: this.shared.includes(f.mat) }),
            this.content.add(g),
            this.updateGroup(this.groups.at(-1), !0));
        }
        ((this.lightClock = -1), this.createRain(), (this.ready = !0));
      }
      addSign(o) {
        let l = this.T,
          c = document.createElement("canvas");
        ((c.width = this.kit.tier.name === "ultra" ? 1024 : 512), (c.height = o.h > o.w ? c.width : c.width / 4));
        let h = c.getContext("2d");
        if (
          ((h.fillStyle = "#122a31"),
          h.fillRect(0, 0, c.width, c.height),
          (h.strokeStyle = o.color),
          (h.lineWidth = c.width / 102.4),
          h.strokeRect(c.width * 0.01, c.width * 0.01, c.width * 0.98, c.height - c.width * 0.02),
          (h.fillStyle = o.color),
          (h.shadowColor = o.color),
          (h.shadowBlur = 16),
          (h.textAlign = "center"),
          (h.textBaseline = "middle"),
          o.h > o.w * 1.5)
        ) {
          let u = o.text.replaceAll(" ", "").split("");
          ((h.font = `bold ${Math.min(c.width * 0.3, (c.height * 0.9) / u.length)}px monospace`),
            u.forEach((p, m) => h.fillText(p, c.width / 2, ((m + 0.5) * c.height) / u.length, c.width * 0.81)));
        } else
          ((h.font = `bold ${c.height * 0.477}px monospace`),
            h.fillText(o.text, c.width / 2, c.height / 2, c.width * 0.9));
        let d = new l.CanvasTexture(c);
        ((d.colorSpace = l.SRGBColorSpace), (d.anisotropy = 4), this.textures.push(d));
        let f = new l.MeshStandardNodeMaterial({
          map: d,
          emissiveMap: d,
          emissive: 16777215,
          emissiveIntensity: 1.3,
          roughness: 0.55,
        });
        this.signMaterials.push(f);
        let g = new l.Mesh(this.geom, f);
        (g.position.set(o.x, o.y, o.z),
          g.scale.set(o.w, o.h, o.d),
          (g.visible = !o.hidden),
          this.content.add(g),
          this.signBindings.push({ o, mesh: g }));
      }
      /**
       * Write the instances of one group. With `all` false only dynamic boxes are visited, and a
       * box whose position, size, rotation, visibility and brightness are unchanged since the last
       * write is skipped (distant crowds update a few times a second, not every frame). The matrix
       * is composed directly: translate × rotateY × rotateZ × scale, the same as an Object3D with
       * rotation (0, rotY, rotZ) in XYZ order.
       */
      updateGroup(o, l = !1) {
        if (!l && !o.dynamic) return;
        let c = !1,
          m = o.mesh.instanceMatrix.array,
          k = o.mesh.instanceColor.array,
          n = o.objects;
        for (let d = 0; d < n.length; d++) {
          let h = n[d];
          if (!l && !h.dynamic) continue;
          let f = !!h.hidden,
            g = h.lifeDim ?? 1,
            u = h.rotY || 0,
            p = h.rotZ || 0,
            w = h._drawn;
          if (
            !l &&
            w &&
            w[0] === h.x &&
            w[1] === h.y &&
            w[2] === h.z &&
            w[3] === h.w &&
            w[4] === h.h &&
            w[5] === h.d &&
            w[6] === u &&
            w[7] === p &&
            w[8] === f &&
            w[9] === g
          )
            continue;
          (w || (w = h._drawn = [])),
            (w[0] = h.x),
            (w[1] = h.y),
            (w[2] = h.z),
            (w[3] = h.w),
            (w[4] = h.h),
            (w[5] = h.d),
            (w[6] = u),
            (w[7] = p),
            (w[8] = f),
            (w[9] = g);
          let y = f ? 0 : h.w,
            b = f ? 0 : h.h,
            x = f ? 0 : h.d,
            T = Math.cos(u),
            v = Math.sin(u),
            A = Math.cos(p),
            S = Math.sin(p),
            i = d * 16;
          ((m[i] = T * A * y),
            (m[i + 1] = S * y),
            (m[i + 2] = -v * A * y),
            (m[i + 3] = 0),
            (m[i + 4] = -T * S * b),
            (m[i + 5] = A * b),
            (m[i + 6] = v * S * b),
            (m[i + 7] = 0),
            (m[i + 8] = v * x),
            (m[i + 9] = 0),
            (m[i + 10] = T * x),
            (m[i + 11] = 0),
            (m[i + 12] = h.x),
            (m[i + 13] = h.y),
            (m[i + 14] = h.z),
            (m[i + 15] = 1));
          let j = d * 3;
          if (o.tinted) {
            let q = h._rgb || (h._rgb = this.instanceTint.set(h.color).toArray([]));
            ((k[j] = q[0] * g), (k[j + 1] = q[1] * g), (k[j + 2] = q[2] * g));
          } else k[j] = k[j + 1] = k[j + 2] = g;
          c = !0;
        }
        c && ((o.mesh.instanceMatrix.needsUpdate = !0), (o.mesh.instanceColor.needsUpdate = !0));
      }
      createRain() {
        if (!this.world.outside || (this.world.sheltered && !this.world.isPrologue) || this.world.day) return;
        let o = this.T,
          l = this.N,
          c = this.kit.detail(800),
          h = new o.BoxGeometry(0.016, 0.36, 0.016),
          d = new o.MeshBasicNodeMaterial({ color: "#b9dae0", transparent: !0, opacity: 0.38, depthWrite: !1 });
        ((this.rainTime = l.uniform(0)), (this.rainOrigin = l.uniform(new o.Vector3())));
        let f = l.instanceIndex.toFloat(),
          g = l
            .fract(l.sin(f.mul(12.9898)).mul(43758.5453))
            .mul(60)
            .sub(30),
          u = l
            .fract(l.sin(f.mul(78.233)).mul(43758.5453))
            .mul(80)
            .sub(48),
          p = l.fract(f.mul(0.618).sub(this.rainTime.mul(0.55))).mul(28);
        d.positionNode = l.positionLocal.add(l.vec3(g, p, u)).add(this.rainOrigin);
        let m = new o.InstancedMesh(h, d, c);
        m.frustumCulled = !1;
        let y = new o.Matrix4();
        for (let b = 0; b < c; b++) m.setMatrixAt(b, y);
        (this.content.add(m), (this.rainMesh = m));
      }
      render(o, l, { reducedMotion: c = !1 } = {}) {
        if (this.ready) {
          if (
            (this.camera.position.set(o.x, o.y, o.z),
            this.camera.rotation.set(o.pitch, o.yaw, 0, "YXZ"),
            this.groups.forEach((h) => this.updateGroup(h)),
            (this.world.isDistrict || this.world.isPrologue) &&
              (this.moon.position.set(o.x - 12, o.y + 24, o.z + 8),
              this.moon.target.position.set(o.x, 0, o.z - 10),
              l - this.lightClock > 0.3 || l < this.lightClock))
          ) {
            this.lightClock = l;
            let h = this.world.lights
              .slice()
              .sort((d, f) => Math.hypot(d.x - o.x, d.z - o.z) - Math.hypot(f.x - o.x, f.z - o.z));
            this.localLights.forEach((d, f) => {
              let g = f < this.lightCount ? h[f] : null;
              g && (d.color.set(g.color), (d.intensity = g.power), d.position.set(g.x, g.y, g.z));
            });
          }
          for (let { o: h, mesh: d } of this.signBindings)
            ((d.visible = !h.hidden),
              h.dynamic && (d.position.set(h.x, h.y, h.z), d.scale.set(h.w, h.h, h.d), (d.rotation.y = h.rotY || 0)),
              (d.material.emissiveIntensity = 1.3 * (h.lifeDim ?? 1)));
          (this.rainOrigin && this.rainOrigin.value.set(o.x, 0, o.z),
            this.rainTime && (this.rainTime.value = l),
            this.rainMesh && (this.rainMesh.visible = !c && !this.world.sheltered));
          try {
            this.post ? this.post.render() : this.renderer.render(this.scene, this.camera);
          } catch (h) {
            if (this.post)
              (console.warn("Using direct scene rendering after post-process error", h),
                this.post.dispose(),
                (this.post = null),
                this.renderer.render(this.scene, this.camera));
            else throw h;
          }
        }
      }
      clear() {
        ((this.ready = !1),
          this.groups.forEach((o) => o.mesh.dispose?.()),
          (this.groups = []),
          (this.signBindings = []),
          this.content.clear(),
          this.materials.forEach((o) => o.dispose()),
          this.materials.clear(),
          this.textures.forEach((o) => o.dispose()),
          (this.textures = []),
          this.signMaterials.forEach((o) => o.dispose()),
          (this.signMaterials = []),
          this.rainMesh && (this.rainMesh.geometry.dispose(), this.rainMesh.material.dispose(), (this.rainMesh = null)),
          (this.rainTime = null),
          (this.rainOrigin = null));
      }
    }
    return { GPUWorldRenderer: r, project: s };
  })(),
  { Soundscape: fX } = (() => {
    class a {
      constructor() {
        ((this.enabled = !0), (this.started = !1), (this.nodes = []));
      }
      async start() {
        if (this.started) {
          this.ctx.state === "suspended" && (await this.ctx.resume());
          return;
        }
        let i = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (i)
          try {
            ((this.ctx = new i()),
              (this.master = this.ctx.createGain()),
              (this.master.gain.value = this.enabled ? 0.34 : 0),
              this.master.connect(this.ctx.destination),
              (this.amb = this.ctx.createGain()),
              (this.amb.gain.value = 0.16),
              this.amb.connect(this.master));
            let r = this.ctx.createBiquadFilter();
            ((r.type = "lowpass"), (r.frequency.value = 430), (r.Q.value = 0.4), r.connect(this.amb));
            for (let [d, f] of [
              [55, -5],
              [82.4069, 5],
              [130.8128, -3],
            ]) {
              let g = this.ctx.createOscillator();
              ((g.type = "triangle"), (g.frequency.value = d), (g.detune.value = f));
              let u = this.ctx.createGain();
              ((u.gain.value = 0.09), g.connect(u), u.connect(r), g.start(), this.nodes.push(g));
            }
            let n = this.ctx.sampleRate * 2,
              o = this.ctx.createBuffer(1, n, this.ctx.sampleRate),
              l = o.getChannelData(0);
            for (let d = 0; d < n; d++) l[d] = (Math.random() * 2 - 1) * 0.19;
            let c = this.ctx.createBufferSource();
            ((c.buffer = o), (c.loop = !0));
            let h = this.ctx.createBiquadFilter();
            ((h.type = "highpass"),
              (h.frequency.value = 1150),
              (this.rainGain = this.ctx.createGain()),
              (this.rainGain.gain.value = 0.16),
              c.connect(h),
              h.connect(this.rainGain),
              this.rainGain.connect(this.master),
              c.start(),
              this.nodes.push(c),
              (this.started = !0));
          } catch (r) {
            console.warn("Audio unavailable:", r.message);
          }
      }
      setEnabled(i) {
        ((this.enabled = i), this.master && this.master.gain.setTargetAtTime(i ? 0.34 : 0, this.ctx.currentTime, 0.18));
      }
      /** Hold the whole soundscape while the kit's settings panel pauses the game. */
      suspend(i) {
        this.ctx && (i ? this.ctx.suspend() : this.ctx.resume()).catch(() => {});
      }
      indoors(i) {
        this.rainGain && this.rainGain.gain.setTargetAtTime(i ? 0.035 : 0.16, this.ctx.currentTime, 0.8);
      }
      tone(i = 440, r = 0.12, n = "sine", o = 0.16) {
        if (!this.started || !this.enabled) return;
        let l = this.ctx.currentTime,
          c = this.ctx.createOscillator(),
          h = this.ctx.createGain();
        ((c.type = n),
          c.frequency.setValueAtTime(i, l),
          h.gain.setValueAtTime(0.001, l),
          h.gain.exponentialRampToValueAtTime(o, l + 0.01),
          h.gain.exponentialRampToValueAtTime(0.001, l + r),
          c.connect(h),
          h.connect(this.master),
          c.start(l),
          c.stop(l + r + 0.02));
      }
      click() {
        this.tone(720, 0.07, "sine", 0.11);
      }
      evidence() {
        (this.tone(523.25, 0.35), setTimeout(() => this.tone(783.99, 0.5, "sine", 0.12), 100));
      }
      scan() {
        (this.tone(1200, 0.22, "sine", 0.1), setTimeout(() => this.tone(600, 0.32, "sine", 0.1), 90));
      }
      fire() {
        if (!this.started || !this.enabled) return;
        let i = this.ctx.currentTime,
          r = this.ctx.createOscillator(),
          n = this.ctx.createGain();
        ((r.type = "sawtooth"),
          r.frequency.setValueAtTime(170, i),
          r.frequency.exponentialRampToValueAtTime(42, i + 0.13),
          n.gain.setValueAtTime(0.32, i),
          n.gain.exponentialRampToValueAtTime(0.001, i + 0.18),
          r.connect(n),
          n.connect(this.master),
          r.start(),
          r.stop(i + 0.2));
      }
      hit() {
        this.tone(68, 0.22, "triangle", 0.28);
      }
      note(i) {
        this.tone([261.63, 311.13, 392, 466.16][i % 4], 0.7, "sine", 0.25);
      }
    }
    let e = {
        furnace: [48, 360, 0.12, 7],
        flight: [62, 520, 0.045, 9],
        office: [78, 340, 0.022, 12],
        archive: [66, 250, 0.012, 15],
        market: [92, 620, 0.14, 7],
        rain: [65, 510, 0.18, 9],
        medical: [110, 400, 0.014, 6],
        tower: [73, 310, 0.014, 13],
        hotel: [58, 280, 0.045, 12],
        water: [71, 430, 0.025, 8],
        freezer: [86, 760, 0.045, 8],
        laboratory: [98, 610, 0.018, 10],
        apartment: [65, 280, 0.025, 14],
        piano: [65, 260, 0.025, 16],
        toys: [82, 340, 0.035, 10],
        forest: [98, 940, 0.025, 10],
        club: [49, 480, 0.04, 5],
        backstage: [55, 370, 0.024, 9],
        arcade: [79, 680, 0.12, 8],
        phone: [98, 420, 0.11, 11],
        ruin: [54, 250, 0.08, 11],
        wind: [57, 480, 0.17, 7],
        birds: [87, 450, 0.05, 11],
        dawn: [82, 500, 0.08, 14],
        lift: [61, 440, 0.016, 11],
      },
      t = a.prototype.start;
    return (
      (a.prototype.start = async function () {
        (await t.call(this), this.started && (this.ensureRoomLayer(), this.profile && this.setScene(this.profile)));
      }),
      (a.prototype.ensureRoomLayer = function () {
        if (this.roomOsc || !this.started) return;
        ((this.roomBus = this.ctx.createGain()),
          (this.roomBus.gain.value = 0.025),
          this.roomBus.connect(this.master),
          (this.roomFilter = this.ctx.createBiquadFilter()),
          (this.roomFilter.type = "lowpass"),
          (this.roomFilter.Q.value = 0.4),
          this.roomFilter.connect(this.roomBus),
          (this.roomOsc = this.ctx.createOscillator()),
          (this.roomOsc.type = "sine"),
          (this.roomOsc.frequency.value = 65),
          this.roomOsc.connect(this.roomFilter),
          this.roomOsc.start(),
          this.nodes.push(this.roomOsc));
        let s = this.ctx.sampleRate * 0.28;
        this.localNoise = this.ctx.createBuffer(1, s, this.ctx.sampleRate);
        let i = this.localNoise.getChannelData(0);
        for (let r = 0; r < s; r++) i[r] = (Math.random() * 2 - 1) * (1 - r / s);
      }),
      (a.prototype.setScene = function (s) {
        if (((this.profile = s), !this.started)) return;
        this.ensureRoomLayer();
        let [i, r, n] = e[s] || e.rain,
          o = this.ctx.currentTime;
        (this.roomOsc.frequency.setTargetAtTime(i, o, 0.65),
          this.roomFilter.frequency.setTargetAtTime(r, o, 0.6),
          this.roomBus.gain.setTargetAtTime(s === "club" ? 0.09 : 0.027, o, 0.65),
          this.rainGain?.gain.setTargetAtTime(n, o, 0.6));
      }),
      (a.prototype.spatialTone = function (s, i = 0.15, r = 0.09, n = 0, o = "sine") {
        if (!this.started || !this.enabled) return;
        let l = this.ctx.currentTime,
          c = this.ctx.createOscillator(),
          h = this.ctx.createGain(),
          d = this.ctx.createStereoPanner?.();
        ((c.type = o),
          c.frequency.setValueAtTime(s, l),
          h.gain.setValueAtTime(1e-4, l),
          h.gain.exponentialRampToValueAtTime(Math.max(0.001, r), l + 0.008),
          h.gain.exponentialRampToValueAtTime(1e-4, l + i),
          c.connect(h),
          d
            ? ((d.pan.value = Math.max(-1, Math.min(1, n))), h.connect(d), d.connect(this.master))
            : h.connect(this.master),
          c.start(),
          c.stop(l + i + 0.03),
          (c.onended = () => {
            (c.disconnect(), h.disconnect(), d?.disconnect());
          }));
      }),
      (a.prototype.localNoiseSound = function (s = 600, i = 0.13, r = 0.07, n = 0) {
        if (!this.started || !this.enabled) return;
        this.ensureRoomLayer();
        let o = this.ctx.currentTime,
          l = this.ctx.createBufferSource(),
          c = this.ctx.createBiquadFilter(),
          h = this.ctx.createGain(),
          d = this.ctx.createStereoPanner?.();
        ((l.buffer = this.localNoise),
          (c.type = "bandpass"),
          (c.frequency.value = s),
          (c.Q.value = 0.7),
          h.gain.setValueAtTime(r, o),
          h.gain.exponentialRampToValueAtTime(1e-4, o + i),
          l.connect(c),
          c.connect(h),
          d
            ? ((d.pan.value = Math.max(-1, Math.min(1, n))), h.connect(d), d.connect(this.master))
            : h.connect(this.master),
          l.start(),
          l.stop(o + i + 0.02),
          (l.onended = () => {
            (l.disconnect(), c.disconnect(), h.disconnect(), d?.disconnect());
          }));
      }),
      (a.prototype.localSound = function (s, i = 0, r = 1) {
        let n = (l, c, h = 0.08, d = "sine") => this.spatialTone(l, c, h * r, i, d),
          o = (l, c, h = 0.07) => this.localNoiseSound(l, c, h * r, i);
        s === "water"
          ? (n(820, 0.13, 0.05), o(1500, 0.12, 0.05))
          : s === "paper" || s === "cloth"
            ? o(s === "paper" ? 2200 : 850, 0.19, 0.11)
            : s === "bell"
              ? (n(1175, 0.46, 0.1), n(1762, 0.32, 0.036))
              : s === "bird"
                ? (n(1880, 0.09, 0.045), n(2360, 0.15, 0.025))
                : s === "wood"
                  ? (n(138, 0.1, 0.09, "triangle"), o(510, 0.065, 0.06))
                  : s === "motor"
                    ? n(89, 0.29, 0.085, "triangle")
                    : s === "keys"
                      ? n(392, 0.65, 0.09)
                      : s === "metal"
                        ? (n(670, 0.24, 0.045, "triangle"), n(997, 0.17, 0.025))
                        : s === "step-wet"
                          ? (o(750, 0.12, 0.085), n(96, 0.08, 0.035, "triangle"))
                          : s === "step-wood"
                            ? (o(390, 0.1, 0.055), n(123, 0.08, 0.05, "triangle"))
                            : s === "step-metal"
                              ? (o(950, 0.08, 0.045), n(256, 0.11, 0.04, "triangle"))
                              : s === "wind"
                                ? o(600, 0.25, 0.08)
                                : (o(1750, 0.055, 0.06), n(420, 0.055, 0.03, "triangle"));
      }),
      (a.prototype.sceneAccent = function (s, i = 0) {
        let r =
          {
            medical: "bell",
            freezer: "motor",
            flight: "motor",
            furnace: "motor",
            office: "paper",
            archive: "paper",
            apartment: "wood",
            piano: "keys",
            tower: "water",
            hotel: "water",
            water: "water",
            market: "bird",
            birds: "bird",
            forest: "bird",
            club: "motor",
            backstage: "cloth",
            arcade: "metal",
            phone: "bell",
            ruin: "wood",
            wind: "wind",
            dawn: "bird",
            lift: "motor",
            toys: "metal",
          }[s] || "water";
        this.localSound(r, i, 0.28);
      }),
      { Soundscape: a }
    );
  })(),
  { installExpandedSystems: mX } = (() => {
    function a(e, t) {
      let {
          SCENES: s,
          ITEMS: i,
          ROUTES: r,
          ROUTE_META: n,
          sceneIndex: o,
          World: l,
          freshState: c,
          validateSave: h,
        } = t,
        d = (y) => document.getElementById(y),
        f = (y) =>
          String(y ?? "").replace(
            /[&<>"']/g,
            (b) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[b],
          ),
        g = (y) => JSON.parse(JSON.stringify(y)),
        u = (y, b, x) => Math.max(b, Math.min(x, y)),
        p = e.prototype,
        m = {};
      for (let y of [
        "bind",
        "loadScene",
        "showMenu",
        "openNode",
        "finishNode",
        "updateHUD",
        "journal",
        "combatBrief",
        "startEncounter",
        "tickEncounter",
        "updateMarkers",
        "action",
        "settings",
        "about",
        "puzzle",
        "pause",
        "closeModal",
        "damage",
      ])
        m[y] = p[y];
      (Object.defineProperty(p, "route", {
        get() {
          return r[this.state.cut] || r.final;
        },
      }),
        (p.bind = function () {
          (m.bind.call(this),
            document.addEventListener(
              "pointerdown",
              (b) => {
                b.pointerType === "touch" &&
                  ((this.lastTouchAt = performance.now()),
                  this.overlay && b.target.closest?.("#modal") && (this.modalTouchGuard = 0));
              },
              !0,
            ),
            document.addEventListener(
              "click",
              (b) => {
                b.isTrusted &&
                  performance.now() < (this.modalTouchGuard || 0) &&
                  b.target.closest?.("#modal") &&
                  (b.preventDefault(), b.stopImmediatePropagation());
              },
              !0,
            ));
          let y = (b, x) => {
            let T = d(b);
            if (!T) return;
            let v = -1 / 0;
            (T.addEventListener("pointerdown", (A) => {
              A.pointerType === "touch" && (A.preventDefault(), (v = performance.now()), x());
            }),
              (T.onclick = () => {
                performance.now() - v > 600 && x();
              }));
          };
          y("map-button", () => this.journal("map"));
        }),
        (p.chooseRoute = function () {
          ((this.selectedRoute = this.state.cut || "final"),
            this.showModal(
              "Choose the night.",
              "Each route has fixed story outcomes. They keep the conflicting endings separate. All dialogue is newly written.",
              "THE LONG NIGHT / CAMPAIGN ROUTE",
              "route",
              { wide: !0 },
            ),
            d("modal-actions").insertAdjacentHTML(
              "beforebegin",
              '<div class="route-options">' +
                Object.entries(n)
                  .map(
                    ([y, b]) =>
                      `<button class="route-card ${y === this.selectedRoute ? "selected" : ""}" data-route="${y}" aria-pressed="${y === this.selectedRoute}"><span class="source-tag">${r[y].length} PLAYABLE SCENES</span><strong>${f(b.label)}</strong><p>${f(b.description)}</p></button>`,
                  )
                  .join("") +
                '</div><p class="small-note">Film-informed routes are expanded adaptations, not exact film edits. Original side cases have separate source labels.</p>',
            ),
            d("modal")
              .querySelectorAll("[data-route]")
              .forEach(
                (y) =>
                  (y.onclick = () => {
                    ((this.selectedRoute = y.dataset.route),
                      d("modal")
                        .querySelectorAll("[data-route]")
                        .forEach((b) => {
                          (b.classList.toggle("selected", b === y), b.setAttribute("aria-pressed", String(b === y)));
                        }));
                  }),
              ),
            this.buttons([
              {
                label: "BEGIN THIS ROUTE",
                primary: !0,
                on: () => {
                  (this.audio.start(),
                    (this.replay = !1),
                    (this.state = c(this.selectedRoute)),
                    this.loadScene(this.state.scene, { reset: !0 }));
                },
              },
              { label: "RETURN TO TITLE", on: () => this.closeModal() },
            ]));
        }),
        (p.showMenu = function () {
          (m.showMenu.call(this),
            d("scene-total") && (d("scene-total").textContent = s.length),
            this.setCrouch(!1));
        }),
        (p.loadScene = function (y, b = {}) {
          if (
            (this.setCrouch(!1),
            b.reset !== !1 && (this.state.beats = []),
            (this.state.beats ??= []),
            (this.state.visited ??= []),
            this.state.visited.includes(s[y].key) || this.state.visited.push(s[y].key),
            m.loadScene.call(this, y, b),
            this.overlay === "intro")
          ) {
            let T = this.route.indexOf(this.scene.key) + 1,
              v = d("modal").querySelector(".scene-stamp");
            (v &&
              (v.innerHTML = `<b>${String(T).padStart(2, "0")}</b><span>OF ${this.route.length} ROUTE SCENES<br><br>FIRST PERSON / ${f(this.scene.role.toUpperCase())}</span>`),
              d("modal-actions").insertAdjacentHTML(
                "beforebegin",
                `<div class="source-line"><span class="source-tag ${this.scene.source}">${this.scene.source.toUpperCase()}</span><span>${f(this.scene.variants?.[this.state.cut]?.sourceNote || this.scene.sourceNote)}</span></div>`,
              ));
          }
        }),
        (p.activeSpots = function () {
          if (this.encounter) return [];
          let y = this.state.beats || [],
            b = this.world.hotspots.filter(
              (T) => T.step && !T.optional && !y.includes(T.id) && (T.step.requires || []).every((v) => y.includes(v)),
            ),
            x = this.world.hotspots.filter((T) => T.optional && !this.state.optional.includes(T.id));
          return [...(b.length ? b : y.length === this.scene.steps.length ? [this.world.exit] : []), ...x];
        }),
        (p.openNode = function (y) {
          if (!y.optional && !(y.requires || []).every((x) => this.state.beats.includes(x))) {
            this.toast("Complete the linked evidence first. Open the map to see the available leads.");
            return;
          }
          let b = {
            inspect: "inspectEvidence",
            deduce: "deduceEvidence",
            sequence: "sequencePuzzle",
            interview: "interviewWitness",
            tune: "tuneSignal",
          };
          if (b[y.kind]) {
            this[b[y.kind]](y);
            return;
          }
          if (y.kind === "stealth") {
            this.combatBrief(y);
            return;
          }
          m.openNode.call(this, y);
        }),
        (p.finishNode = function (y, b = {}) {
          let x = this.scene.key + ":" + y.id;
          if (
            !this.state.rewarded.includes(x) &&
            (b.deduction &&
              !this.state.deductions.includes(x) &&
              (this.state.deductions.push(x),
              this.state.history.push({ scene: this.state.scene, label: y.label, text: b.deduction })),
            b.testimony)
          ) {
            this.state.testimony.push(...b.testimony);
            let T = y.actor || "Witness";
            this.state.trust[T] = u((this.state.trust[T] || 0) + (b.trust || 0), -100, 100);
          }
          m.finishNode.call(this, y, b);
        }),
        (p.finishScene = function () {
          if (this.state.beats.length !== this.scene.steps.length) {
            this.toast("The required evidence is not complete. Check the map for an open lead.");
            return;
          }
          let y = this.state.scene,
            b = this.route.indexOf(this.scene.key),
            x = b === this.route.length - 1;
          if (
            (this.state.completed.includes(y) || this.state.completed.push(y),
            x || (this.state.unlocked = Math.max(this.state.unlocked, o(this.route[b + 1]))),
            x && !this.replay)
          ) {
            ((this.state.finished = !0), (this.state.ending = this.state.cut), this.save(), this.showCredits());
            return;
          }
          (this.save(),
            this.showModal(
              "Scene resolved.",
              this.scene.anchor,
              `${n[this.state.cut].label} / ${b + 1} OF ${this.route.length}`,
              "resolved",
              { close: !1 },
            ),
            d("modal-actions").insertAdjacentHTML(
              "beforebegin",
              `<div class="resolution-stats"><span>${this.state.beats.length} LEADS COMPLETE</span><span>${this.state.optional.length} / ${this.scene.optional.length} SIDE CASES</span><span>FIXED OUTCOME KEPT</span></div>`,
            ),
            this.replay
              ? this.buttons([
                  {
                    label: "RETURN FROM REPLAY",
                    primary: !0,
                    on: () => {
                      ((this.state = g(this.replayBackup)), (this.replay = !1), this.showMenu());
                    },
                  },
                ])
              : this.buttons([
                  { label: "NEXT SCENE", primary: !0, on: () => this.loadScene(o(this.route[b + 1]), { reset: !0 }) },
                  { label: "RETURN TO THE AREA", on: () => this.closeModal() },
                  { label: "OPEN EVIDENCE BOARD", on: () => this.journal("board") },
                ]));
        }),
        (p.inspectEvidence = function (y) {
          let b = this.scene.key + ":" + y.id,
            x = new Set(this.state.clues[b] || []),
            T = "visible",
            v = 0;
          (this.showModal(y.label, y.text, "EVIDENCE BENCH / THREE LIGHT BANDS", "inspect", { wide: !0 }),
            d("modal-actions").insertAdjacentHTML(
              "beforebegin",
              `<div class="bench-layout"><div class="specimen-frame"><canvas id="specimen" width="640" height="370" aria-label="Interactive evidence specimen"></canvas><div class="bench-scale">FIELD OPTICS / 1:1 <span id="specimen-mode">VISIBLE</span></div></div><div><div class="band-switch">${["visible", "infrared", "ultraviolet"].map((E) => `<button data-band="${E}" class="${E === T ? "selected" : ""}">${E.toUpperCase()}</button>`).join("")}</div><div class="inspection-log" id="inspection-log"></div><p class="small-note">Select each light band. Tap its diamond on the object. The light band reveals a different detail.</p></div></div>`,
            ));
          let A = d("specimen"),
            S = A.getContext("2d"),
            _ = () => {
              (S.clearRect(0, 0, 640, 370),
                (S.fillStyle = "#07151d"),
                S.fillRect(0, 0, 640, 370),
                (S.strokeStyle = "#36575b"),
                (S.lineWidth = 1));
              for (let M = 0; M < 640; M += 40) (S.beginPath(), S.moveTo(M, 0), S.lineTo(M, 370), S.stroke());
              for (let M = 0; M < 370; M += 40) (S.beginPath(), S.moveTo(0, M), S.lineTo(640, M), S.stroke());
              let E = T === "infrared" ? "#e9ae78" : T === "ultraviolet" ? "#bfa6ed" : "#b5c9b7";
              if (
                (S.save(),
                S.translate(320, 185),
                S.rotate(v),
                (S.fillStyle = E),
                (S.shadowColor = E),
                (S.shadowBlur = 14),
                y.model === "scale")
              ) {
                (S.beginPath(),
                  S.moveTo(-150, -85),
                  S.quadraticCurveTo(190, -135, 180, 70),
                  S.quadraticCurveTo(-45, 170, -150, -85),
                  S.fill(),
                  (S.shadowBlur = 0),
                  (S.strokeStyle = "#314a4f"));
                for (let M = 0; M < 8; M++)
                  (S.beginPath(), S.ellipse(15, 12, 30 + M * 17, 20 + M * 11, -0.2, 0.1, Math.PI * 1.5), S.stroke());
              } else if (y.model === "origami" || y.model === "unicorn") {
                S.beginPath();
                for (let [M, [R, N]] of [
                  [-135, 20],
                  [-70, -45],
                  [32, -22],
                  [75, -88],
                  [104, -122],
                  [106, -56],
                  [158, -25],
                  [112, 18],
                  [77, 4],
                  [48, 78],
                  [10, 20],
                  [-50, 23],
                  [-95, 91],
                  [-88, 20],
                ].entries())
                  M ? S.lineTo(R, N) : S.moveTo(R, N);
                (S.closePath(),
                  S.fill(),
                  (S.shadowBlur = 0),
                  (S.strokeStyle = "#37545a"),
                  S.beginPath(),
                  S.moveTo(-70, -45),
                  S.lineTo(10, 20),
                  S.lineTo(77, 4),
                  S.lineTo(75, -88),
                  S.stroke());
              } else if (y.model === "blaster")
                (S.fillRect(-160, -50, 265, 65),
                  (S.fillStyle = "#607b7d"),
                  S.fillRect(90, -43, 80, 48),
                  (S.fillStyle = "#786957"),
                  S.fillRect(-82, 8, 64, 86),
                  (S.strokeStyle = E),
                  S.strokeRect(-55, -38, 83, 39));
              else if (y.model === "toy")
                (S.fillRect(-70, -40, 140, 95),
                  S.fillRect(-49, -104, 98, 63),
                  S.fillRect(-102, -25, 25, 79),
                  S.fillRect(77, -25, 25, 79),
                  S.fillRect(-61, 55, 40, 65),
                  S.fillRect(21, 55, 40, 65),
                  (S.fillStyle = "#152d38"),
                  S.fillRect(-27, -83, 13, 14),
                  S.fillRect(15, -83, 13, 14),
                  (S.strokeStyle = "#42655c"),
                  S.strokeRect(-35, -18, 70, 45));
              else if (
                (S.fillRect(-210, -130, 420, 260),
                (S.shadowBlur = 0),
                (S.fillStyle = "#35555a"),
                S.fillRect(-194, -112, 388, 224),
                (S.fillStyle = "#61796f"),
                y.model === "photo")
              )
                (S.fillRect(-163, -66, 110, 100),
                  S.fillRect(-148, 33, 81, 64),
                  S.fillRect(30, -85, 136, 159),
                  (S.fillStyle = "#b9ae8e"),
                  S.fillRect(68, -22, 37, 38),
                  (S.fillStyle = "#172d34"),
                  S.fillRect(82, -13, 10, 7));
              else {
                for (let M = 0; M < 7; M++) S.fillRect(-164, -90 + M * 27, 280 - (M % 3) * 30, 7);
                ((S.fillStyle = E), S.fillRect(100, 65, 47, 20));
              }
              (S.restore(),
                (S.font = "11px monospace"),
                (S.fillStyle = "#9cb4b2"),
                S.fillText((y.item || "FIELD SAMPLE").toUpperCase(), 20, 25));
              for (let [M, R] of y.points.entries()) {
                if (R.mode !== T) continue;
                let N = R.x * 640,
                  P = R.y * 370;
                (S.save(),
                  S.translate(N, P),
                  S.rotate(Math.PI / 4),
                  (S.fillStyle = x.has(R.label) ? "#b5ffdd" : "#f0bd79"),
                  S.fillRect(-8, -8, 16, 16),
                  (S.strokeStyle = "#122833"),
                  S.strokeRect(-12, -12, 24, 24),
                  S.restore(),
                  (S.fillStyle = "#10212b"),
                  (S.font = "bold 12px monospace"),
                  S.fillText(String(M + 1), N - 3, P + 4));
              }
              // A detail visible in the current band can also be marked from the log, so the bench
              // works with a controller or keyboard as well as by tapping the diamond.
              ((d("specimen-mode").textContent = T.toUpperCase()),
                (d("inspection-log").innerHTML = y.points
                  .map((M, R) =>
                    !x.has(M.label) && M.mode === T
                      ? `<button class="inspection-row mark" data-mark="${R}"><b>${String(R + 1).padStart(2, "0")}</b><p>${f(M.mode.toUpperCase())} / Mark this detail \u25c7</p></button>`
                      : `<div class="inspection-row ${x.has(M.label) ? "found" : ""}"><b>${x.has(M.label) ? "\u2713" : String(R + 1).padStart(2, "0")}</b><p>${x.has(M.label) ? f(M.label) : f(M.mode.toUpperCase()) + " / Not yet recorded"}</p></div>`,
                  )
                  .join("")),
                d("inspection-log")
                  .querySelectorAll("[data-mark]")
                  .forEach((M) => {
                    M.onclick = () => {
                      let R = y.points[+M.dataset.mark];
                      R &&
                        R.mode === T &&
                        !x.has(R.label) &&
                        (x.add(R.label), (this.state.clues[b] = [...x]), this.save(), this.audio.evidence(), _());
                    };
                  }),
                this.buttons([
                  {
                    label:
                      x.size === y.points.length
                        ? "SEAL THE EVIDENCE"
                        : `RECORD ALL DETAILS / ${x.size} OF ${y.points.length}`,
                    primary: !0,
                    disabled: x.size !== y.points.length,
                    on: () => this.interlude(y.points.map((M) => M.label).join(". ") + ".", y, { insight: 3 }),
                  },
                ]));
            },
            k = (E, M) => {
              let R = y.points.find((N) => N.mode === T && Math.hypot((E - N.x) * 640, (M - N.y) * 370) < 34);
              R && (x.add(R.label), (this.state.clues[b] = [...x]), this.save(), this.audio.evidence(), _());
            };
          ((A.onpointerdown = (E) => {
            E.preventDefault();
            let M = A.getBoundingClientRect();
            k((E.clientX - M.left) / M.width, (E.clientY - M.top) / M.height);
          }),
            d("modal")
              .querySelectorAll("[data-band]")
              .forEach(
                (E) =>
                  (E.onclick = () => {
                    ((T = E.dataset.band),
                      d("modal")
                        .querySelectorAll("[data-band]")
                        .forEach((M) => M.classList.toggle("selected", M === E)),
                      _());
                  }),
              ),
            (this.mini = { kind: "inspect" }),
            _());
        }),
        (p.deduceEvidence = function (y) {
          let b = y.evidence.filter((_) => this.state.inventory.includes(_));
          if (b.length < y.evidence.length) {
            (this.showModal(
              "A link is missing.",
              "Collect the required evidence before making this deduction. Missing: " +
                y.evidence.filter((_) => !b.includes(_)).join("; "),
              "EVIDENCE BOARD / OPEN LEAD",
              "missing",
            ),
              this.buttons([
                { label: "RETURN TO THE SEARCH", primary: !0, on: () => this.closeModal() },
                { label: "VIEW THE LOCAL MAP", on: () => this.journal("map") },
              ]));
            return;
          }
          let x = this.state.inventory.filter((_) => !y.evidence.includes(_)).slice(-3),
            T = [...y.evidence, ...x].sort((_, k) => _.localeCompare(k)),
            v = new Set(),
            A = null,
            S = 0;
          (this.showModal(y.label, y.text, "EVIDENCE BOARD / SUPPORT THE CLAIM", "deduce", { wide: !0 }),
            d("modal-actions").insertAdjacentHTML(
              "beforebegin",
              `<div class="deduction-columns"><div><h3 class="section-label">1 / SELECT TWO SOURCES</h3><div class="evidence-options">${T.map((_, k) => `<button data-evidence="${k}" aria-pressed="false"><span>\u25C7</span><strong>${f(_)}</strong><small>${f(i[_] || "Field evidence")}</small></button>`).join("")}</div></div><div><h3 class="section-label">2 / CHOOSE THE CLAIM</h3><div class="claim-options">${y.claims.map((_, k) => `<button data-claim="${k}" aria-pressed="false">${f(_)}</button>`).join("")}</div><div id="deduce-status" class="puzzle-status">No claim is accepted until both sources support it.</div></div></div>`,
            ),
            d("modal")
              .querySelectorAll("[data-evidence]")
              .forEach(
                (_) =>
                  (_.onclick = () => {
                    let k = T[+_.dataset.evidence];
                    if (v.has(k)) v.delete(k);
                    else if (v.size < 2) v.add(k);
                    else {
                      this.audio.hit();
                      return;
                    }
                    (_.classList.toggle("selected", v.has(k)), _.setAttribute("aria-pressed", String(v.has(k))));
                  }),
              ),
            d("modal")
              .querySelectorAll("[data-claim]")
              .forEach(
                (_) =>
                  (_.onclick = () => {
                    ((A = +_.dataset.claim),
                      d("modal")
                        .querySelectorAll("[data-claim]")
                        .forEach((k) => {
                          (k.classList.toggle("selected", k === _), k.setAttribute("aria-pressed", String(k === _)));
                        }));
                  }),
              ),
            (this.mini = { kind: "deduce" }),
            this.buttons([
              {
                label: "TEST THE LINK",
                primary: !0,
                on: () => {
                  v.size === 2 && y.evidence.every((_) => v.has(_)) && A === y.answer
                    ? this.interlude(y.result, y, { insight: 4, deduction: y.claims[A] })
                    : (S++,
                      (d("deduce-status").textContent =
                        S > 1
                          ? "Compare " + y.evidence.join(" with ") + ". Read what each source can and cannot prove."
                          : "The link is not supported. Select exactly two relevant sources and one claim."),
                      this.audio.hit());
                },
              },
            ]));
        }),
        (p.sequencePuzzle = function (y) {
          let b = [],
            x = 0,
            T = y.order,
            v = T.map((S, _) => ({ text: S, index: _ })).sort(
              (S, _) => ((S.index * 7 + 3) % T.length) - ((_.index * 7 + 3) % T.length),
            );
          (this.showModal(y.label, y.text, "PROCEDURE / ORDER THE ACTIONS", "sequence"),
            d("modal-actions").insertAdjacentHTML(
              "beforebegin",
              '<div class="sequence-track" id="sequence-track"></div><div class="sequence-options" id="sequence-options"></div><div id="sequence-status" class="puzzle-status">Select the actions in the order described above.</div>',
            ));
          let A = () => {
            ((d("sequence-track").innerHTML = T.map(
              (S, _) => `<div><b>${_ + 1}</b><span>${b[_] != null ? f(T[b[_]]) : "\u2014"}</span></div>`,
            ).join("")),
              (d("sequence-options").innerHTML = v
                .map(
                  (S) =>
                    `<button data-order="${S.index}" ${b.includes(S.index) ? "disabled" : ""}>${f(S.text)}</button>`,
                )
                .join("")),
              d("modal")
                .querySelectorAll("[data-order]")
                .forEach(
                  (S) =>
                    (S.onclick = () => {
                      (b.push(+S.dataset.order), this.audio.click(), A());
                    }),
                ));
          };
          (this.buttons([
            {
              label: "CONFIRM THE SEQUENCE",
              primary: !0,
              on: () => {
                b.length === T.length && b.every((S, _) => S === _)
                  ? this.interlude(y.result, y, { insight: 2 })
                  : (x++,
                    (d("sequence-status").textContent =
                      x > 1
                        ? "Start with: " + T[0] + ". " + y.text
                        : "The order is not complete or is unsafe. Clear it and use the procedure text."),
                    this.audio.hit());
              },
            },
            {
              label: "CLEAR THE SEQUENCE",
              on: () => {
                ((b = []), A());
              },
            },
          ]),
            (this.mini = { kind: "sequence" }),
            A());
        }),
        (p.tuneSignal = function (y) {
          let b = 25,
            x = 25,
            T = y.target || [67, 42];
          (this.showModal(y.label, y.text, "SIGNAL DESK / CARRIER AND GAIN", "tune"),
            d("modal-actions").insertAdjacentHTML(
              "beforebegin",
              '<canvas id="signal-scope" width="560" height="160" aria-label="Signal alignment scope"></canvas><label class="signal-label" for="carrier">CARRIER <output id="carrier-value">25</output></label><input id="carrier" type="range" min="0" max="100" value="25"><label class="signal-label" for="gain">GAIN <output id="gain-value">25</output></label><input id="gain" type="range" min="0" max="100" value="25"><div class="signal-quality"><progress id="signal-quality" value="0" max="100"></progress><strong id="signal-status"></strong></div>',
            ));
          let v = d("signal-scope"),
            A = v.getContext("2d"),
            S = 4 + this.state.upgrades.focus + (this.state.inventory.includes("Audit training note") ? 1 : 0),
            _ = () => {
              ((b = +d("carrier").value),
                (x = +d("gain").value),
                (d("carrier-value").textContent = b),
                (d("gain-value").textContent = x),
                (A.fillStyle = "#07161f"),
                A.fillRect(0, 0, 560, 160),
                (A.strokeStyle = "#375259"),
                (A.lineWidth = 1));
              for (let R = 20; R < 160; R += 20) (A.beginPath(), A.moveTo(0, R), A.lineTo(560, R), A.stroke());
              for (let [R, N, P] of [
                [T[0], T[1], "#53686a"],
                [b, x, "#a1ffdc"],
              ]) {
                ((A.strokeStyle = P), (A.lineWidth = 2), A.beginPath());
                for (let D = 0; D < 560; D++) {
                  let q = 80 + Math.sin(D * (0.015 + R * 6e-4)) * (8 + N * 0.5);
                  D ? A.lineTo(D, q) : A.moveTo(D, q);
                }
                A.stroke();
              }
              let k = Math.abs(b - T[0]) + Math.abs(x - T[1]),
                E = u(Math.round(100 - k * 1.3), 0, 100);
              d("signal-quality").value = E;
              let M = Math.abs(b - T[0]) <= S && Math.abs(x - T[1]) <= S;
              d("signal-status").textContent = M
                ? "SIGNAL LOCKED / READY TO RECORD"
                : `CLARITY ${E}% / Align the bright trace with the faint trace.`;
            };
          ((d("carrier").oninput = _),
            (d("gain").oninput = _),
            (this.mini = { kind: "tune" }),
            _(),
            this.buttons([
              {
                label: "RECORD THE SIGNAL",
                primary: !0,
                on: () => {
                  Math.abs(b - T[0]) <= S && Math.abs(x - T[1]) <= S
                    ? this.interlude(y.result, y, { insight: 3 })
                    : ((d("signal-status").textContent =
                        "No stable lock. Move one control at a time and watch the clarity."),
                      this.audio.hit());
                },
              },
              {
                label: "READ THE SERVICE TARGET",
                on: () => {
                  d("signal-status").textContent =
                    `SERVICE TARGET / Carrier ${T[0]}; gain ${T[1]}. Set both controls near these values.`;
                },
              },
            ]));
        }),
        (p.interviewWitness = function (y) {
          let b = new Set(),
            x = [],
            T = 0,
            v = 0,
            A = !1,
            S =
              this.scene.key === "taffey" && this.state.inventory.includes("Care routine record")
                ? "Care routine record"
                : y.present;
          (this.showModal(y.label, y.text, `${y.actor.toUpperCase()} / WITNESS INTERVIEW`, "interview", { wide: !0 }),
            d("modal-actions").insertAdjacentHTML(
              "beforebegin",
              `<div class="witness-head"><div class="witness-portrait" aria-hidden="true"><i></i></div><div><span class="section-label">WITNESS / ${f(y.actor)}</span><h3 id="witness-topic">Choose a topic.</h3><p id="witness-line">Listen before you close the account.</p></div></div><div class="topic-tabs" id="topic-tabs"></div><div id="witness-choices"></div><div class="puzzle-status" id="witness-status">0 / ${y.topics.length} TOPICS RECORDED</div>`,
            ));
          let _ = () => {
              this.buttons([
                {
                  label: "FILE THE ACCOUNT",
                  primary: !0,
                  disabled: b.size < y.topics.length,
                  on: () =>
                    this.interlude(y.result, y, {
                      empathy: Math.max(0, T),
                      pressure: v,
                      insight: A ? 2 : 1,
                      trust: T,
                      testimony: x,
                    }),
                },
                ...(S
                  ? [
                      {
                        label: A ? "EVIDENCE PRESENTED" : "PRESENT: " + S,
                        disabled: A || !this.state.inventory.includes(S),
                        on: () => {
                          ((A = !0),
                            (T += 2),
                            (d("witness-line").textContent =
                              "The witness reads the supporting record. The account now has a named source."),
                            x.push({ who: y.actor, topic: "Evidence shown", text: S, scene: this.scene.key }),
                            _());
                        },
                      },
                    ]
                  : []),
              ]);
            },
            k = () => {
              ((d("topic-tabs").innerHTML = y.topics
                .map(
                  (M, R) =>
                    `<button data-topic="${R}" ${b.has(R) ? "disabled" : ""}>${b.has(R) ? "\u2713 " : ""}${f(M.label)}</button>`,
                )
                .join("")),
                d("modal")
                  .querySelectorAll("[data-topic]")
                  .forEach((M) => (M.onclick = () => E(+M.dataset.topic))));
            },
            E = (M) => {
              let R = y.topics[M];
              ((d("witness-topic").textContent = R.label),
                (d("witness-line").textContent = R.ask),
                (d("witness-choices").innerHTML = [
                  "Give them time to answer.",
                  "Ask for a precise detail.",
                  "Press for an immediate answer.",
                ]
                  .map(
                    (N, P) =>
                      `<button class="choice" data-approach="${P}"><span class="choice-n">0${P + 1}</span><span>${N}</span></button>`,
                  )
                  .join("")),
                d("modal")
                  .querySelectorAll("[data-approach]")
                  .forEach(
                    (N) =>
                      (N.onclick = () => {
                        let P = +N.dataset.approach,
                          D = [R.patient, R.precise, R.pressure][P];
                        ((T += P === 0 ? 1 : P === 2 ? -1 : 0),
                          (v += P === 2 ? 1 : 0),
                          b.add(M),
                          x.push({ who: y.actor, topic: R.label, text: D, scene: this.scene.key }),
                          (d("witness-line").textContent = D),
                          (d("witness-choices").innerHTML = ""),
                          (d("witness-status").textContent =
                            `${b.size} / ${y.topics.length} TOPICS RECORDED \xB7 ${T >= 0 ? "CALM" : "STRAINED"} ACCOUNT`),
                          k(),
                          _());
                      }),
                  ));
            };
          ((this.mini = { kind: "interview" }), k(), _());
        }),
        (p.combatBrief = function (y) {
          if (y.kind !== "stealth") return m.combatBrief.call(this, y);
          (this.showModal(y.label, y.text, "FIRST PERSON / COVER AND NOISE", "combat-brief"),
            d("modal-actions").insertAdjacentHTML(
              "beforebegin",
              '<div class="anchor">Reach three green markers. The moving amber light can detect you. Walls block its view. Running creates more noise. Hold C or use CROUCH to move quietly. An alert of 100 ends this attempt. Earlier evidence stays safe.</div>',
            ),
            this.buttons([{ label: "ENTER THE ROUTE", primary: !0, on: () => this.startEncounter(y) }]));
        }),
        (p.startEncounter = function (y) {
          if (y.kind !== "stealth") return m.startEncounter.call(this, y);
          (this.closeModal(),
            (this.cam = { x: 0, y: 1.72, z: 12, yaw: 0, pitch: 0 }),
            (this.state.health = Math.max(70, this.state.health)));
          let b = this.scene.id % 2 ? 5.9 : -5.9,
            x = this.world.character("Moving watch light", b, -8, "#54706e", { hat: !0 }),
            T = this.world.box(b, 1.85, -8, 0.55, 0.55, 0.4, "#efb675", { dynamic: !0, emissive: 1.3 }),
            v = [];
          for (let A = 1; A <= 6; A++)
            for (let S = -1; S <= 1; S++)
              v.push(
                this.world.box(b, 0.035, -8, 1, 0.015, 1, "#d4b46f", {
                  dynamic: !0,
                  emissive: 0.35,
                  alpha: 0.15,
                  beamRow: A,
                  beamLane: S,
                }),
              );
          ((this.encounter = {
            mode: "stealth",
            step: y,
            t: 0,
            enemy: x,
            beam: T,
            beamTiles: v,
            hp: 3,
            attackCd: 99,
            alert: 0,
            route: 0,
            routes: [
              { x: -2.5, z: 3 },
              { x: 2.4, z: -9 },
              { x: -1.5, z: -21 },
            ],
            last: { x: 0, z: 12 },
            direction: 0,
          }),
            this.renderer.setWorld(this.world),
            (d("encounter-bar").hidden = !1),
            (d("weapon").hidden = !0),
            (d("car-hood").hidden = !0),
            this.updateHUD());
        }),
        (p.tickEncounter = function (y, b) {
          let x = this.encounter;
          if (x?.mode !== "stealth") return m.tickEncounter.call(this, y, b);
          x.t += y;
          let T = x.enemy,
            v = -8 + Math.sin(x.t * 0.32) * 5;
          (this.world.moveActor(T, T.x, v, b, !0),
            (x.direction = Math.sin(x.t * 0.55) * 1.5 + (T.x > 0 ? -Math.PI / 2 : Math.PI / 2)));
          let A = this.cam.x - T.x,
            S = this.cam.z - T.z,
            _ = Math.hypot(A, S),
            k = Math.atan2(A, S),
            E = Math.atan2(Math.sin(k - x.direction), Math.cos(k - x.direction));
          ((x.beam.x = T.x + Math.sin(x.direction) * 1.2), (x.beam.z = T.z + Math.cos(x.direction) * 1.2));
          for (let Z of x.beamTiles) {
            let ne = Z.beamRow * 2,
              fe = Z.beamLane * ne * 0.25;
            ((Z.x = T.x + Math.sin(x.direction) * ne + Math.cos(x.direction) * fe),
              (Z.z = T.z + Math.cos(x.direction) * ne - Math.sin(x.direction) * fe),
              (Z.w = Z.d = 0.3 + ne * 0.19),
              (Z.hidden = !1));
            for (let Ee of this.world.obstacles)
              if (!(Ee.hidden || Ee.y + Ee.h / 2 < 1.4)) {
                for (let De = 0.1; De < 1; De += 0.1)
                  if (
                    Math.abs(T.x + (Z.x - T.x) * De - Ee.x) < Ee.w / 2 &&
                    Math.abs(T.z + (Z.z - T.z) * De - Ee.z) < Ee.d / 2
                  ) {
                    Z.hidden = !0;
                    break;
                  }
                if (Z.hidden) break;
              }
          }
          let M = !1;
          for (let Z of this.world.obstacles)
            if (!(Z.hidden || Z.y + Z.h / 2 < 1.4)) {
              for (let ne = 0.1; ne < 0.95; ne += 0.06)
                if (Math.abs(T.x + A * ne - Z.x) < Z.w / 2 && Math.abs(T.z + S * ne - Z.z) < Z.d / 2) {
                  M = !0;
                  break;
                }
              if (M) break;
            }
          let R = Math.hypot(this.cam.x - x.last.x, this.cam.z - x.last.z),
            N = R / Math.max(y, 0.001);
          x.last = { x: this.cam.x, z: this.cam.z };
          let P = this.crouchToggle || this.input.down("crouch"),
            D = P ? 0.12 : N > 4.5 ? 0.95 : N > 0.15 ? 0.42 : 0;
          this.state.inventory.includes("Safe-corridor note") && (D *= 0.85);
          let q = _ < 14 && Math.abs(E) < 0.48 && !M,
            K = q ? (P ? 12 : 23) : _ < 7 ? D * 13 : -13;
          (this.state.inventory.includes("Friends repair plan") && K > 0 && (K *= 0.8),
            this.prefs.assist && K > 0 && (K *= 0.7),
            (x.alert = u(x.alert + K * y, 0, 100)),
            (x.noise = D),
            (x.seen = q));
          let ee = x.routes[x.route];
          if (
            ee &&
            Math.hypot(this.cam.x - ee.x, this.cam.z - ee.z) <
              (this.state.inventory.includes("Bear\u2019s service map") ? 2.5 : 2.1)
          ) {
            if ((x.route++, this.audio.evidence(), x.route === x.routes.length)) {
              this.completeEncounter();
              return;
            }
            this.toast("ROUTE POINT REACHED / Stay in cover.");
          }
          x.alert >= 100 && this.damage(1e4);
        }),
        (p.action = function () {
          if (this.encounter?.mode === "stealth" && !this.overlay) {
            (this.setCrouch(!this.crouchToggle),
              this.toast(this.crouchToggle ? "CROUCH / Lower noise." : "STAND / Normal movement."));
            return;
          }
          m.action.call(this);
        }),
        // Quiet-movement markers ("SAFE ROUTE n") and the crouch prompt are drawn by the base
        // updateMarkers, which reads the encounter's route list directly.
        (p.updateMarkers = function (y) {
          m.updateMarkers.call(this, y);
        }),
        (p.updateHUD = function () {
          m.updateHUD.call(this);
          let y = this.route.indexOf(this.scene.key) + 1;
          d("case-label").textContent = `${this.replay ? "REPLAY" : this.scene.case} / ${y} OF ${this.route.length}`;
          let b = this.activeSpots().filter((T) => !T.optional && !T.exit);
          ((d("objective-progress").textContent = `${this.state.beats.length} / ${this.scene.steps.length}`),
            this.encounter ||
              (d("objective-detail").textContent =
                b.length > 1
                  ? `${b.length} leads can be checked in any order. M or MAP shows the area.`
                  : this.state.beats.length === this.scene.steps.length
                    ? "All required leads are complete. Reach the exit."
                    : "Follow the lead. Open MAP to see its evidence links."));
          let x = this.encounter;
          x?.mode === "stealth" &&
            ((d("encounter-label").textContent =
              `${x.seen ? "IN VIEW" : "COVER"} / NOISE ${Math.round((x.noise || 0) * 100)}%`),
            (d("encounter-value").textContent = `ALERT ${Math.round(x.alert)} / ${x.route} OF 3`),
            (d("encounter-progress").value = x.alert));
        }),
        (p.journal = function (y = "board") {
          if (["evidence", "training"].includes(y)) {
            (m.journal.call(this, y), this.addJournalTabs(y));
            return;
          }
          if (y === "guide") {
            this.expandedGuide();
            return;
          }
          (this.showModal(
            "The casebook.",
            "",
            `${this.state.inventory.length} ITEMS / ${this.state.deductions.length} SUPPORTED LINKS / ${this.state.sidequests.length} SIDE CASES`,
            "journal",
            { wide: !0 },
          ),
            d("modal-actions").remove(),
            d("modal").insertAdjacentHTML("beforeend", '<div id="journal-content"></div>'),
            this.addJournalTabs(y));
          let b = d("journal-content"),
            x = this.state;
          if (
            (x.finished &&
              this.inGame &&
              !this.replay &&
              (d("modal").querySelector(".close").onclick = () => this.showCredits()),
            y === "board")
          ) {
            let T = s
              .filter((v) => this.route.includes(v.key))
              .flatMap((v) => v.steps.filter((A) => A.kind === "deduce").map((A) => ({ scene: v, step: A })))
              .filter((v) => x.visited.includes(v.scene.key) || x.completed.includes(v.scene.id));
            b.innerHTML = `<div class="board-summary"><div><b>${x.deductions.length}</b><span>SUPPORTED LINKS</span></div><div><b>${Object.keys(x.clues).length}</b><span>EXAMINED OBJECTS</span></div><div><b>${x.testimony.length}</b><span>WITNESS NOTES</span></div></div><p class="small-note">This board separates evidence from claims. Complete an open deduction at its marker in the current scene.</p><div class="case-board">${
              T.length
                ? T.map(({ scene: v, step: A }) => {
                    let S = x.deductions.includes(v.key + ":" + A.id);
                    return `<article class="link-card ${S ? "complete" : ""}"><span class="source-tag">${S ? "SUPPORTED" : "OPEN LINK"}</span><h3>${f(A.label)}</h3><div class="linked-sources">${A.evidence.map((_) => `<div class="${x.inventory.includes(_) ? "owned" : ""}"><b>${x.inventory.includes(_) ? "\u2713" : "\u25CB"}</b>${f(_)}</div>`).join("<i>+</i>")}</div><p>${S ? f(A.claims[A.answer]) : "Collect both sources. Test the claim at the scene marker."}</p><small>${f(v.title)}</small></article>`;
                  }).join("")
                : '<p class="empty-state">No deduction has opened yet. Begin the case and examine the first evidence.</p>'
            }</div>`;
          }
          if (y === "map") {
            b.innerHTML = `<div class="area-map-layout"><div><canvas id="area-map" width="520" height="600" aria-label="Local area map with story leads"></canvas><p class="small-note">White: you. Green: available lead. Amber: side case. Dark: locked or complete.</p></div><div class="map-leads"><h3>${f(this.scene.place)}</h3>${this.scene.steps
              .map((N, P) => {
                let D = x.beats.includes(N.id),
                  q = N.requires.every((K) => x.beats.includes(K));
                return `<article><b>${D ? "\u2713" : q ? "\u25CB" : "\xB7"} ${f(N.label)}</b><small>${D ? "COMPLETE" : q ? "AVAILABLE" : "FIRST: " + N.requires.map((K) => this.scene.steps.find((ee) => ee.id === K)?.label || K).join("; ")}</small></article>`;
              })
              .join(
                "",
              )}<h3 class="section-label">OPTIONAL / ORIGINAL GAME CASES</h3>${this.scene.optional.map((N) => `<article><b>${x.optional.includes(N.id) ? "\u2713" : "\u25C7"} ${f(N.quest)}</b><small>${f(N.label)}</small></article>`).join("") || '<p class="small-note">No side case in this scene.</p>'}</div></div>`;
            let T = d("area-map"),
              v = T.getContext("2d"),
              A = 20,
              S = 12,
              _ = 260,
              k = 350,
              E = (N) => _ + N * A,
              M = (N) => k + N * S;
            ((v.fillStyle = "#081a23"), v.fillRect(0, 0, 520, 600), (v.strokeStyle = "#24414a"));
            for (let N = 0; N < 520; N += 40) (v.beginPath(), v.moveTo(N, 0), v.lineTo(N, 600), v.stroke());
            for (let N = 0; N < 600; N += 40) (v.beginPath(), v.moveTo(0, N), v.lineTo(520, N), v.stroke());
            ((v.strokeStyle = "#6c8b86"),
              v.strokeRect(
                E(this.world.bounds.minX),
                M(-26),
                (this.world.bounds.maxX - this.world.bounds.minX) * A,
                43 * S,
              ),
              (v.fillStyle = "#47615e"));
            for (let N of this.world.obstacles) v.fillRect(E(N.x - N.w / 2), M(N.z - N.d / 2), N.w * A, N.d * S);
            let R = this.activeSpots().map((N) => N.id);
            for (let N of this.world.hotspots)
              ((v.fillStyle = N.exit ? "#d8e5d4" : N.optional ? "#d9ab72" : R.includes(N.id) ? "#a1ffdc" : "#405655"),
                v.beginPath(),
                v.arc(E(N.x), M(N.z), 6, 0, Math.PI * 2),
                v.fill(),
                !N.optional &&
                  !N.exit &&
                  ((v.font = "12px monospace"), v.fillText(String((N.step.index || 0) + 1), E(N.x) + 10, M(N.z) + 4)));
            (v.save(),
              v.translate(E(this.cam.x), M(this.cam.z)),
              v.rotate(-this.cam.yaw),
              (v.fillStyle = "#ffffff"),
              v.beginPath(),
              v.moveTo(0, -12),
              v.lineTo(-7, 6),
              v.lineTo(7, 6),
              v.closePath(),
              v.fill(),
              v.restore());
          }
          if (y === "people") {
            let T = [...new Set(x.testimony.map((v) => v.who))];
            b.innerHTML = T.length
              ? T.map(
                  (v) =>
                    `<section class="person-file"><h3>${f(v)} <small>RAPPORT ${x.trust[v] || 0}</small></h3>${x.testimony
                      .filter((A) => A.who === v)
                      .map(
                        (A) => `<article><span class="section-label">${f(A.topic)}</span><p>${f(A.text)}</p></article>`,
                      )
                      .join("")}</section>`,
                ).join("")
              : '<p class="empty-state">Witness interviews add accounts here. Choose a topic, hear the reply, then file the account.</p>';
          }
          if (
            (y === "notes" &&
              ((b.innerHTML = `<label class="section-label" for="case-notes">YOUR NOTES / LOCAL TO THIS SAVE</label><textarea id="case-notes" maxlength="12000" placeholder="Keep questions, observations, and theories separate from established evidence."></textarea><span id="notes-status" class="small-note">Saved with your case. Included in save-file export.</span><h3 class="section-label">RECENT CASE RECORD</h3>${x.history
                .slice(-35)
                .reverse()
                .map((T) => `<article class="history-row"><b>${f(T.label)}</b><p>${f(T.text)}</p></article>`)
                .join("")}`),
              (d("case-notes").value = x.notes),
              (d("case-notes").oninput = () => {
                ((x.notes = d("case-notes").value),
                  this.save(),
                  (d("notes-status").textContent = "Notes saved with this case."));
              })),
            y === "scenes")
          ) {
            let T = s.filter((v) => this.route.includes(v.key) || x.finished);
            ((b.innerHTML = `<p class="small-note">${f(n[x.cut].label)}. Replays use a separate working state. A completed route opens the other edition scenes for review.</p><div class="scene-list">${T.map(
              (v) => {
                let A = x.finished || x.visited.includes(v.key) || x.completed.includes(v.id);
                return `<button class="scene-button" data-scene="${v.id}" ${A ? "" : "disabled"}><span>${v.number}</span><div><strong>${f(v.title)}</strong><small>${x.completed.includes(v.id) ? "\u2713 COMPLETE / " : ""}${v.source.toUpperCase()} / ${f(v.role.toUpperCase())}</small></div></button>`;
              },
            ).join("")}</div>`),
              d("modal")
                .querySelectorAll("[data-scene]")
                .forEach((v) => (v.onclick = () => this.beginReplay(+v.dataset.scene))));
          }
        }),
        (p.addJournalTabs = function (y) {
          d("modal").querySelector("nav.tabs")?.remove();
          let b = ["board", "map", "evidence", "people", "notes", "scenes", "training", "guide"],
            x = document.createElement("nav");
          ((x.className = "tabs expanded-tabs"),
            x.setAttribute("aria-label", "Casebook sections"),
            (x.innerHTML = b
              .map(
                (T) =>
                  `<button data-tab="${T}" class="${y === T ? "active" : ""}">${T.toUpperCase()}${T === "training" && this.points ? " +" + this.points : ""}</button>`,
              )
              .join("")),
            d("journal-content").before(x),
            x.querySelectorAll("[data-tab]").forEach((T) => (T.onclick = () => this.journal(T.dataset.tab))));
        }),
        (p.expandedGuide = function () {
          (this.showModal("Field guide.", "", "LIVING SCENES / VERSION 3.0", "journal", { wide: !0 }),
            d("modal-actions").remove(),
            d("modal").insertAdjacentHTML("beforeend", '<div id="journal-content"></div>'),
            this.addJournalTabs("guide"),
            this.state.finished &&
              this.inGame &&
              !this.replay &&
              (d("modal").querySelector(".close").onclick = () => this.showCredits()),
            (d("journal-content").innerHTML =
              '<div class="guide-section"><h3>INVESTIGATION</h3><p>Green markers are available leads. Some areas let you inspect several leads in any order. Other leads need earlier evidence. MAP shows these links. Amber markers are optional cases.</p><h3>THE EVIDENCE BENCH</h3><p>Switch between visible light, infrared, and ultraviolet. Tap the diamond in each band, or press its line in the log. Record all three details, then seal the evidence. Partial observations are saved.</p><h3>DEDUCTIONS AND WITNESSES</h3><p>Select two relevant sources and one supported claim. A wrong claim does not delete evidence. Interviews have several topics. Your approach changes the witness account and rapport. File the account to retain it.</p><h3>QUIET MOVEMENT</h3><p>Some passages have a moving watch light. Walls block its view. Running increases noise. C or CROUCH reduces noise. Reach the three route markers before alert reaches 100. A failed attempt restarts the passage.</p><h3>CONTROLS</h3><p>WASD moves. Mouse or right-side drag looks. E interacts. Q scans. F or Space acts. C crouches. Shift runs. R reloads. M opens the map. Tab opens the casebook. Escape pauses or closes the current panel. On touch screens, use the left stick and the buttons on the right. A controller works too: left stick moves, right stick looks, A acts, Y scans, B crouches, LT runs, Start pauses.</p><h3>ROUTES AND SOURCE LABELS</h3><p>The draft route has the hospital visits and forest pursuit. The Final Cut\u2013informed route has the unicorn dream and ends in the lift. The theatrical-ending route has no dream and ends on the forest road without a pursuing spinner. These are expanded game routes, not exact film edits.</p><p>DRAFT and SHARED identify story sources. FILM identifies film-informed additions. ORIGINAL identifies new connective investigations. All side cases and dialogue are new game material. Scene outcomes remain fixed. Intimacy is non-explicit, with clear consent. Some violence occurs in transitions.</p><h3>THEORIES</h3><p>The missing file and Deckard\u2019s identity remain questions where the selected route leaves them open. Notes and deductions do not turn a theory into a film fact.</p><h3>SAVES</h3><p>Version 1 saves preserve inventory, training, and recorded choices. They restart at the matching chapter, or at an earlier scene when a new clue is needed later. New scenes are not marked complete. The old browser save is not overwritten. Export and import remain in Settings.</p><h3>GRAPHICS</h3><p>Three.js r186 draws the city with WebGPU, or WebGL 2 where WebGPU is missing: TSL materials, tone mapping, shadows, and bloom on both. F9 opens the shared graphics and control settings.</p><h3>COVERAGE</h3><p>This build expands the earlier campaign. It is not an exhaustive, shot-for-shot or line-for-line recreation. The source archive includes a scene map and test results.</p></div>'));
        }),
        (p.beginReplay = function (y) {
          let b = s[y];
          !b ||
            !(this.state.finished || this.state.visited.includes(b.key)) ||
            (this.showModal("Replay this scene?", b.title, "REPLAY / CAMPAIGN SAVE PROTECTED", "confirm"),
            this.buttons([
              {
                label: "ENTER SCENE REPLAY",
                primary: !0,
                on: () => {
                  (this.replay || (this.replayBackup = g(this.state)),
                    (this.replay = !0),
                    (this.state = g(this.replayBackup)),
                    r[this.state.cut].includes(b.key) || (this.state.cut = b.editions[0]));
                  let x = r[this.state.cut].slice(0, r[this.state.cut].indexOf(b.key));
                  for (let T of x)
                    for (let v of s[o(T)].steps)
                      v.item && !this.state.inventory.includes(v.item) && this.state.inventory.push(v.item);
                  this.loadScene(y, { reset: !0 });
                },
              },
              { label: "RETURN TO CASEBOOK", on: () => this.journal("scenes") },
            ]));
        }),
        (p.showCredits = function () {
          ((this.inGame = !0), (this.encounter = null), (d("hud").hidden = !0), (d("menu").hidden = !0));
          let y = this.state,
            b = n[y.cut],
            x = {
              draft: "The forest road continues. The draft keeps Gaff\u2019s pursuit in the closing image.",
              final: "The lift doors close. The film-informed route leaves the journey beyond them unseen.",
              theatrical: "The road continues into daylight. This ending does not add the draft\u2019s pursuit.",
            };
          (this.showModal("The night leaves a record.", x[y.cut], b.label + " / CASE CLOSED", "credits", {
            wide: !0,
            close: !1,
          }),
            d("modal-actions").insertAdjacentHTML(
              "beforebegin",
              `<h3 class="credit-end">THE LONG NIGHT.</h3><div class="credits-grid"><div><strong>${y.completed.filter((T) => this.route.includes(s[T].key)).length}/${this.route.length}</strong><span>ROUTE SCENES</span></div><div><strong>${y.inventory.length}</strong><span>ITEMS AND RECORDS</span></div><div><strong>${y.deductions.length}</strong><span>SUPPORTED DEDUCTIONS</span></div><div><strong>${y.testimony.length}</strong><span>WITNESS NOTES</span></div><div><strong>${y.sidequests.length}</strong><span>SIDE CASES</span></div><div><strong>${y.deaths}</strong><span>RETRIES</span></div></div><p class="modal-body">The scene outcomes stayed fixed. Your evidence, choices, and witness accounts remain in the casebook. All edition scenes are now open for protected replay.</p><p class="small-note">Unofficial fan adaptation. New dialogue, procedural scenery, and original synthesized sound. No film recordings or screenplay transcript are bundled.</p>`,
            ),
            this.buttons([
              { label: "OPEN THE COMPLETED CASE", primary: !0, on: () => this.journal("board") },
              { label: "EXPORT THIS CASE", on: () => this.exportSave() },
              { label: "RETURN TO TITLE", on: () => this.showMenu() },
            ]));
        }),
        (p.about = function () {
          (this.showModal(
            "Electric Sheepish: The Long Night.",
            "A larger first-person investigation with separate draft and film-informed routes.",
            "VERSION 3.0 / UNOFFICIAL FAN GAME",
            "about",
          ),
            d("modal-actions").insertAdjacentHTML(
              "beforebegin",
              `<div class="guide-section"><p>${s.length} scene definitions. Evidence inspection, witness accounts, supported deductions, quiet movement, notes, and protected replay.</p><p>The linked 1981 shooting draft and released film versions do not agree on every beat or ending. This game labels additions and keeps incompatible endings apart. It does not reproduce the full screenplay or every film shot.</p><p>Original game dialogue and procedural art. No actor likenesses, film clips, film soundtrack, or copied screenplay dialogue are bundled.</p></div>`,
            ),
            this.buttons([
              { label: "READ THE FIELD GUIDE", primary: !0, on: () => this.expandedGuide() },
              { label: "RETURN", on: () => this.closeModal() },
            ]));
        }),
        (p.puzzle = function (y) {
          if ((m.puzzle.call(this, y), y.kind === "esper" && this.state.cut !== "draft")) {
            (d("esper-canvas")?.setAttribute(
              "aria-label",
              "Photograph reconstruction. The useful reflection is in frame E3 at magnification three.",
            ),
              (d("modal").querySelector(".modal-body").textContent =
                "Find the detail in the reflected room. The film-informed route records a face as well as the physical sample."));
            let x = d("modal-actions").querySelector("button").onclick;
            d("modal-actions").querySelector("button").onclick = () => {
              if ((x(), this.overlay === "result")) {
                let T = d("modal").querySelector(".quote-result");
                T &&
                  (T.textContent =
                    "The reconstruction isolates the reflected figure. The printed detail gives you a visual lead to compare at the club. The physical scale still needs its own examination.");
              }
            };
          }
        }));
    }
    return { installExpandedSystems: a };
  })(),
  { districtPath: NX, installDistrictSystems: gX } = (() => {
    let a = (o) =>
        String(o ?? "").replace(
          /[&<>"']/g,
          (l) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[l],
        ),
      e = (o, l, c) => Math.max(l, Math.min(c, o)),
      t = (o) => document.getElementById(o),
      s = (o) => Sl.find((l) => l.id === o),
      i = (o) => wr.find((l) => l.id === o);
    function r(o, l, c) {
      if (!o?.isDistrict || !c) return [];
      let h = -42,
        d = -74,
        f = 85,
        g = 102,
        u = f * g;
      if (!o.district.nav) {
        let M = new Uint8Array(u),
          R = new Float32Array(u);
        for (let N = 0; N < g; N++)
          for (let P = 0; P < f; P++) {
            let D = N * f + P;
            ((M[D] = o.collides(P + h, N + d, 0.24) ? 0 : 1), (R[D] = iT(P + h, N + d)));
          }
        o.district.nav = { free: M, y: R };
      }
      let { free: p, y: m } = o.district.nav,
        y = (M, R) => e(Math.round(R - d), 0, g - 1) * f + e(Math.round(M - h), 0, f - 1),
        b = (M) => {
          let R = y(M.x, M.z);
          if (p[R]) return R;
          let N = -1,
            P = 1 / 0;
          for (let D = -3; D <= 3; D++)
            for (let q = -3; q <= 3; q++) {
              let K = y(M.x + q, M.z + D);
              p[K] && q * q + D * D < P && ((P = q * q + D * D), (N = K));
            }
          return N;
        },
        x = b(l),
        T = b(c);
      if (x < 0 || T < 0) return [];
      let v = new Uint8Array(u),
        A = new Int32Array(u);
      A.fill(-1);
      let S = new Int32Array(u),
        _ = 0,
        k = 0;
      for (S[k++] = x, v[x] = 1; _ < k; ) {
        let M = S[_++];
        if (M === T) break;
        let R = M % f,
          N = Math.floor(M / f);
        for (let [P, D] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          let q = R + P,
            K = N + D,
            ee = K * f + q;
          q < 0 ||
            q >= f ||
            K < 0 ||
            K >= g ||
            v[ee] ||
            !p[ee] ||
            Math.abs(m[ee] - m[M]) > 0.5 ||
            ((v[ee] = 1), (A[ee] = M), (S[k++] = ee));
        }
      }
      if (!v[T]) return [];
      let E = [];
      for (let M = T; M !== -1 && (E.push({ x: (M % f) + h, z: Math.floor(M / f) + d }), M !== x); M = A[M]);
      return (E.reverse(), E);
    }
    function n(o, { SCENES: l, ITEMS: c, sceneIndex: h, freshState: d, project: f }) {
      let g = o.prototype,
        u = {};
      for (let p of [
        "bind",
        "applyPrefs",
        "showModal",
        "showMenu",
        "chooseRoute",
        "loadScene",
        "save",
        "activeSpots",
        "interact",
        "updateMarkers",
        "updateHUD",
        "journal",
        "addJournalTabs",
        "openNode",
        "finishNode",
        "finishScene",
        "settings",
        "about",
        "drawMap",
        "showCredits",
        "expandedGuide",
      ])
        u[p] = g[p];
      for (let p of wr) c[p.reward] || (c[p.reward] = "Original Noodle Row favour record. " + p.summary);
      ((g.bind = function () {
        u.bind.call(this);
        let p = document.createElement("button");
        ((p.id = "district-start"),
          (p.className = "secondary"),
          (p.innerHTML = "ENTER NOODLE ROW <span>03 \u2192</span>"),
          t("start").after(p),
          (p.onclick = () => {
            ((this.startInDistrict = !0), this.audio.start(), this.saved ? this.confirmNew() : this.chooseRoute());
          }));
        let m = document.createElement("button");
        ((m.id = "district-open"),
          m.setAttribute("aria-label", "Open district map and favours"),
          (m.innerHTML = "NOODLE ROW <span>MAP / FAVOURS</span>"),
          t("hud").append(m));
        let y = -1 / 0;
        (m.addEventListener("pointerdown", (T) => {
          T.pointerType === "touch" && (T.preventDefault(), (y = performance.now()), this.districtJournal("map"));
        }),
          (m.onclick = () => {
            performance.now() - y > 600 && this.districtJournal("map");
          }));
        let b = document.createElement("aside");
        ((b.id = "district-track"),
          (b.hidden = !0),
          (b.innerHTML = "<small>LOCAL FAVOUR / OPTIONAL</small><strong></strong><span></span>"),
          t("hud").append(b));
        let x = document.createElement("div");
        ((x.id = "district-place"),
          (x.hidden = !0),
          t("hud").append(x));
      }),
        (g.showModal = function (...p) {
          (u.showModal.apply(this, p), (this.toastTime = 0), t("toast").classList.remove("visible"));
        }),
        (g.applyPrefs = function () {
          u.applyPrefs.call(this);
        }),
        (g.chooseRoute = function () {
          u.chooseRoute.call(this);
          let p = document.createElement("div");
          ((p.className = "district-route-choice"),
            (p.innerHTML = `<label><input type="checkbox" id="district-entry" ${this.startInDistrict ? "checked" : ""}> Start in Scene 03: Noodle Row</label><p>Leave this off to play the two prologue scenes first. Direct entry does not mark them complete.</p>`),
            t("modal-actions").before(p),
            (t("district-entry").onchange = (y) => (this.startInDistrict = y.target.checked)));
          let m = t("modal-actions").querySelector("button");
          m.onclick = () => {
            (this.audio.start(),
              (this.replay = !1),
              (this.state = d(this.selectedRoute)),
              (this.state.startedAtDistrict = !!this.startInDistrict),
              this.loadScene(this.startInDistrict ? h("noodles") : this.state.scene, { reset: !0 }));
          };
        }),
        (g.showMenu = function () {
          (u.showMenu.call(this),
            (t("district-open").hidden = !0),
            (t("district-place").hidden = !0),
            (t("district-track").hidden = !0),
            document.body.classList.remove("district-active"));
          let p = t("menu").querySelector(".eyebrow");
          (p &&
            (p.innerHTML =
              '<span class="mini-line"></span> NOODLE ROW EXPANDED <span class="edition-name">/ V4</span>'),
            (t("menu").querySelector(".menu-spec").innerHTML =
              "<span><b>12</b> AREAS</span><span><b>50</b> LOCAL PEOPLE</span><span><b>132</b> CROWD NPCs</span>"));
        }),
        (g.loadScene = function (p, m = {}) {
          this.state.district ??= oT(null, this.state);
          let y = m.reset === !1 ? this.state.district.position : null;
          u.loadScene.call(this, p, m);
          let b = this.world.isDistrict;
          if (
            (document.body.classList.toggle("district-active", !!b),
            (t("district-open").hidden = !b),
            (t("district-place").hidden = !b),
            (t("district-track").hidden = !b),
            (this.districtTarget = null),
            (this.districtPathTimer = 0),
            (this.districtCueTimer = 5),
            (this.districtMusicTimer = 1),
            (this.districtLastZone = null),
            (this.districtApproach = "patient"),
            b)
          ) {
            let x = this.state.district;
            x.lastVisit !== this.scene.key && (x.visits++, (x.lastVisit = this.scene.key));
            let T = y && !this.world.collides(y.x, y.z) ? y : this.world.district.spawn;
            if (
              ((this.cam = { x: T.x, z: T.z, y: iT(T.x, T.z) + 1.72, yaw: T.yaw || 0, pitch: 0 }),
              (this.districtRoute = []),
              this.districtSyncLegacy(),
              this.overlay === "intro")
            ) {
              t("modal-title").textContent =
                this.scene.key === "noodles" ? "Noodle Row. The night is yours." : "Noodle Row. The late service.";
              let v = t("modal").querySelector(".modal-body");
              v &&
                (v.textContent =
                  this.scene.key === "noodles"
                    ? "The counter is open. Beyond it are twelve connected streets, shops, courts, and alleys. Meet the people who keep this part of the city working. Gaff will wait until you choose to leave."
                    : "You know some of these faces now. Favours, unfinished work, and local choices remain. The investigation continues at the counter.");
              let A = t("modal").querySelector(".life-intro");
              A &&
                (A.textContent =
                  "Walk into the shops. Face a person and press E or tap. B opens the district map. All twelve favours are optional. New local stories are original fan-game material.");
            }
            (this.updateHUD(), this.save());
          }
        }),
        (g.save = function (p = !1) {
          (this.world?.isDistrict &&
            this.inGame &&
            this.state?.district &&
            (this.state.district.position = { x: this.cam.x, z: this.cam.z, yaw: this.cam.yaw }),
            u.save.call(this, p));
        }),
        (g.districtSyncLegacy = function () {
          let p = this.state.district;
          if (this.scene.key === "noodles")
            for (let [m, y] of [
              ["mercies", "sheep"],
              ["dinner", "token"],
            ])
              p.quests[m].stage === 4 && !this.state.optional.includes(y) && this.state.optional.push(y);
        }),
        (g.activeSpots = function () {
          return u.activeSpots.call(this).filter((p) => !this.world.isDistrict || !p.districtLegacy);
        }),
        (g.districtLog = function (p, m, y, b = "note") {
          let x = this.state.district;
          x.log.some((T) => T.id === p) ||
            (x.log.push({ id: p, title: m, text: y, kind: b }), x.log.length > 280 && x.log.shift());
        }),
        (g.districtSpot = function (p, m) {
          return (
            this.world?.district?.spots.find(
              (y) => y.id === ({ person: "person:", lore: "lore:", task: "task:" }[p] || "") + m,
            ) || null
          );
        }),
        (g.districtCanReach = function (p) {
          if (
            !this.inGame ||
            !this.world.isDistrict ||
            !p ||
            Math.hypot(p.x - this.cam.x, p.z - this.cam.z) >= 3.5 ||
            Math.abs((p.y || 1.5) - this.cam.y) >= 2
          )
            return !1;
          let y = iT(this.cam.x, this.cam.z);
          return !this.world.obstacles.some((b) => {
            if (b.hidden || b.y + b.h / 2 < y + 1.62 || b.y - b.h / 2 > y + 1.7) return !1;
            for (let x = 1; x < 8; x++) {
              let T = x / 10,
                v = this.cam.x + (p.x - this.cam.x) * T,
                A = this.cam.z + (p.z - this.cam.z) * T;
              if (Math.abs(v - b.x) < b.w / 2 && Math.abs(A - b.z) < b.d / 2) return !0;
            }
            return !1;
          });
        }),
        (g.districtResolveTrack = function () {
          let p = this.state.district,
            m = p.tracked;
          if (!m || !this.world.isDistrict) return null;
          if (m.type === "quest") {
            let y = i(m.id),
              b = V_(y, p);
            if (!b) return null;
            let x = this.districtSpot(b.kind === "npc" ? "person" : "task", b.target);
            return x ? { ...x, name: b.label, quest: y.title } : null;
          }
          if (m.type === "area") {
            let y = $s.find((b) => b.id === m.id);
            return { x: y.x, z: y.z + 8, y: 1.4, name: y.name, quest: "Explore the district" };
          }
          return this.districtSpot(m.type, m.id);
        }),
        (g.districtTrack = function (p, m) {
          ((this.state.district.tracked = { type: p, id: m }),
            (this.localCaption = null),
            t("life-caption").classList.remove("visible"),
            (this.districtPathTimer = 0),
            this.save(),
            this.closeModal(),
            this.toast("Route marked. B or MAP shows the walking path."));
        }),
        (g.interact = function () {
          if (this.nearby?.district && this.inGame && !this.overlay && !this.encounter) {
            let p = this.nearby;
            if (!this.districtCanReach(p)) return;
            p.type === "person"
              ? this.districtTalk(p.person.id)
              : p.type === "lore"
                ? this.districtLore(p)
                : p.type === "task" && this.districtTask(p);
            return;
          }
          u.interact.call(this);
        }),
        (g.updateMarkers = function (p) {
          if (
            (u.updateMarkers.call(this, p), !this.world?.isDistrict || !this.inGame || this.overlay || this.encounter)
          )
            return;
          let m = innerWidth,
            y = innerHeight,
            b = [],
            x = null,
            T = 1 / 0;
          for (let _ of this.world.district.spots) {
            let k = Math.hypot(_.x - this.cam.x, _.z - this.cam.z);
            if (k > (this.scanTime > 0 ? 18 : 6.2)) continue;
            if (_.type === "task") {
              let P = i(_.quest);
              if (this.state.district.quests[P.id].stage !== _.stage) continue;
            }
            let E = f({ x: _.x, y: _.y + 0.3, z: _.z }, this.cam, m, y);
            if (E.z <= 0 || E.x < 20 || E.x > m - 20 || E.y < 90 || E.y > y - 130) continue;
            let M = Math.abs(E.x - m / 2) / m,
              R = Math.abs(E.y - y / 2) / y;
            this.districtCanReach(_) &&
              M < 0.26 &&
              R < 0.36 &&
              k + M * 6 < T &&
              ((x = { ..._, district: !0 }), (T = k + M * 6));
            let N =
              _.type === "person"
                ? this.state.district.met.includes(_.person.id)
                : _.type === "lore"
                  ? this.state.district.readLore.includes(_.lore.id)
                  : !1;
            b.push({ h: _, dist: k, p: E, centre: M, seen: N });
          }
          b.sort((_, k) => _.dist - k.dist);
          let v = "";
          for (let _ of b.slice(0, this.mobile ? 5 : 9)) {
            let { h: k, p: E, centre: M, dist: R, seen: N } = _,
              P = (M < 0.21 && R < 5) || this.scanTime > 0;
            v += `<div class="district-marker ${N ? "known" : ""}" style="left:${E.x.toFixed(1)}px;top:${E.y.toFixed(1)}px"><i>${k.type === "person" ? "\u25CF" : k.type === "task" ? "\u25C7" : "\u25A4"}</i>${P ? `<span>${a(k.name)}</span>` : ""}</div>`;
          }
          if (this.districtRoute?.length > 3) {
            let _ = this.districtRoute[Math.min(6, this.districtRoute.length - 1)],
              k = f({ x: _.x, y: iT(_.x, _.z) + 0.12, z: _.z }, this.cam, m, y);
            k.z > 0.5 &&
              k.x > 20 &&
              k.x < m - 20 &&
              k.y > 100 &&
              k.y < y - 100 &&
              (v += `<div class="district-route-dot" style="left:${k.x.toFixed(1)}px;top:${k.y.toFixed(1)}px">\u2316</div>`);
          }
          this.markerHTML += v;
          let A = this.nearby,
            S = !1;
          if (A && !A.life && !A.district) {
            let _ = f(A, this.cam, m, y);
            S = _.z > 0 && Math.abs(_.x - m / 2) < m * 0.1 && Math.hypot(A.x - this.cam.x, A.z - this.cam.z) < 2.5;
          }
          x &&
            (!S || (x.person?.id === "toma" && ["counter", "fish"].includes(A?.id))) &&
            ((this.nearby = x),
            (this.promptDisabled = !1),
            (this.promptLocal = !0),
            (this.promptHTML = `<kbd>${this.keyHint("E")}</kbd><span>${x.type === "person" ? "TALK / " : x.type === "lore" ? "READ / " : ""}${a(x.name.toUpperCase())}</span><b>\u2197</b>`));
        }),
        (g.districtMood = function (p) {
          let m = this.state.district.rapport[p] || 0;
          return m >= 1 ? "warm" : m < 0 ? "guarded" : "neutral";
        }),
        (g.districtTalk = function (p) {
          let m = s(p),
            y = this.districtSpot("person", p);
          if (!m || !this.districtCanReach(y)) return;
          let b = this.state.district,
            x = !b.met.includes(p);
          (x && b.met.push(p), (b.topics[p] ??= []));
          let T = wr.filter(
            (v) => b.quests[v.id].stage === 4 && v.steps.some((A) => A.kind === "npc" && A.target === p),
          );
          ((this.districtConversation = {
            id: p,
            first: x,
            approach: "patient",
            player: "I have a few questions.",
            text: T.length
              ? "You helped with " + T.map((v) => v.title.toLowerCase()).join(" and ") + ". " + m.greeting
              : x
                ? m.greeting
                : "You are back. " + m.greeting,
          }),
            this.districtLog("met:" + p, m.name, m.role + ". " + m.trait, "person"),
            this.save(),
            this.districtRenderTalk());
        }),
        (g.districtRenderTalk = function () {
          let p = this.districtConversation;
          if (!p) return;
          let m = s(p.id),
            y = this.state.district,
            b = this.districtMood(m.id);
          if (
            (this.showModal(
              m.name,
              "",
              m.role.toUpperCase() + " / " + $s.find((T) => T.id === m.area).name.toUpperCase(),
              "district-talk",
              { wide: !0 },
            ),
            t("modal").classList.add("portrait-modal"),
            t("modal-actions").insertAdjacentHTML(
              "beforebegin",
              `<div class="portrait-dialog"><aside class="portrait-person">${Yi(m, b, "talk")}<div class="portrait-label"><b>${a(m.name)}</b><span>${a(m.role)}</span></div><div class="portrait-mood">${b === "warm" ? "FAMILIAR" : b === "guarded" ? "GUARDED" : "LISTENING"} \xB7 ${y.topics[m.id]?.length || 0} / 4 TOPICS</div></aside><section class="portrait-copy"><p class="character-trait">${a(m.trait)}</p><div class="npc-speech" id="npc-speech" aria-live="polite">${a(p.text)}</div><div class="player-response">${Yi(aT, "neutral", "reply")}<div><small>DECKARD</small><p>${a(p.player)}</p></div></div><div class="talk-approach" aria-label="Conversation approach">${[
                ["patient", "Allow time"],
                ["direct", "Ask directly"],
                ["press", "Apply pressure"],
              ]
                .map(
                  ([T, v]) =>
                    `<button data-manner="${T}" class="${p.approach === T ? "active" : ""}" aria-pressed="${p.approach === T}">${v}</button>`,
                )
                .join(
                  "",
                )}</div><div class="district-topics">${m.topics.map((T) => `<button data-local-topic="${T.id}"><span>${y.topics[m.id]?.includes(T.id) ? "\u2713" : "+"}</span>${a(T.label)}</button>`).join("")}</div><div id="district-quest-options"></div><div id="district-evidence"></div></section></div>`,
            ),
            t("modal")
              .querySelectorAll("[data-manner]")
              .forEach(
                (T) =>
                  (T.onclick = () => {
                    ((p.approach = T.dataset.manner),
                      t("modal")
                        .querySelectorAll("[data-manner]")
                        .forEach((v) => {
                          (v.classList.toggle("active", v === T), v.setAttribute("aria-pressed", String(v === T)));
                        }));
                  }),
              ),
            t("modal")
              .querySelectorAll("[data-local-topic]")
              .forEach((T) => (T.onclick = () => this.districtTopic(m.id, T.dataset.localTopic))),
            this.districtQuestButtons(m.id),
            m.id === "toma")
          ) {
            let T = this.activeSpots().find((v) => ["counter", "fish"].includes(v.id));
            if (T) {
              let v = document.createElement("button");
              ((v.className = "primary district-story-action"),
                (v.textContent = "MAIN CASE / " + T.step.label.toUpperCase()),
                (v.onclick = () => this.openNode(T.step)),
                t("district-quest-options").prepend(v));
            }
          }
          let x = wr.filter((T) => y.inventory.includes(T.reward) && T.steps.some((v) => v.target === m.id));
          (x.length &&
            ((t("district-evidence").innerHTML =
              "<h4>SHOW A LOCAL RECORD</h4>" +
              x.map((T) => `<button data-local-evidence="${T.id}" class="secondary">${a(T.reward)}</button>`).join("")),
            t("district-evidence")
              .querySelectorAll("button")
              .forEach(
                (T) =>
                  (T.onclick = () => {
                    let v = i(T.dataset.localEvidence);
                    ((p.player = "This is the record we made."),
                      (p.text =
                        v.steps.at(-1).choices.find((A) => A.effect === y.quests[v.id].outcome)?.text || v.summary),
                      this.districtRenderTalk());
                  }),
              )),
            this.buttons([{ label: "BACK TO THE STREET", primary: !0, on: () => this.closeModal() }]));
        }),
        (g.districtTopic = function (p, m) {
          let y = s(p),
            b = y.topics.find((S) => S.id === m),
            x = this.state.district,
            T = this.districtConversation;
          if (!b || T?.id !== p || !this.districtCanReach(this.districtSpot("person", p))) return;
          let v = T.approach;
          x.topics[p].includes(m) ||
            (x.topics[p].push(m),
            (x.rapport[p] = e((x.rapport[p] || 0) + (v === "patient" ? 1 : v === "press" ? -1 : 0), -4, 4)),
            this.districtLog("topic:" + p + ":" + m, y.name + " / " + b.label, b.text, "conversation"));
          let A =
            {
              work: "Tell me about your work.",
              district: "What is life like here?",
              memory: "What do you remember?",
              rumour: "What should I look into nearby?",
            }[m] || b.label;
          ((T.player = v === "press" ? "I need an answer now. " + A : v === "direct" ? A : "Take your time. " + A),
            (T.text =
              (v === "press"
                ? "There is no need to push. "
                : v === "patient"
                  ? "Thank you for waiting. "
                  : "Here is what I know. ") + b.text),
            this.save(),
            this.districtRenderTalk());
        }),
        (g.districtQuestButtons = function (p) {
          let m = t("district-quest-options"),
            y = this.state.district;
          if (m) {
            m.innerHTML = "";
            for (let b of wr) {
              let x = V_(b, y);
              if (!x || x.kind !== "npc" || x.target !== p) continue;
              let T = document.createElement("section");
              ((T.className = "favour-hook"),
                (T.innerHTML = `<small>LOCAL FAVOUR \xB7 ${y.quests[b.id].stage + 1} / ${b.steps.length}</small><h4>${a(b.title)}</h4><p>${a(y.quests[b.id].stage === 0 ? b.summary : x.text)}</p>`),
                (x.choices.length ? x.choices : [{ label: x.label, effect: null }]).forEach((A, S) => {
                  let _ = document.createElement("button");
                  ((_.className = "secondary"),
                    (_.dataset.favour = b.id),
                    (_.dataset.choice = String(S)),
                    (_.textContent = A.label),
                    (_.onclick = () => {
                      this.advanceDistrictQuest(b.id, x.target, S) &&
                        ((this.districtConversation.player = A.label),
                        (this.districtConversation.text = x.choices.length ? A.text : x.text),
                        this.districtRenderTalk());
                    }),
                    T.append(_));
                }),
                m.append(T));
            }
          }
        }),
        (g.advanceDistrictQuest = function (p, m, y = 0) {
          let b = i(p),
            x = this.state.district;
          if (!b) return !1;
          let T = x.quests[b.id],
            v = b.steps[T.stage];
          if (!v || v.target !== m) return !1;
          let A = this.districtSpot(v.kind === "npc" ? "person" : "task", m);
          if (!this.districtCanReach(A)) return !1;
          if (v.answer !== null && v.answer !== void 0 && y !== v.answer)
            return (this.toast("That choice does not match the local evidence. Read the detail and try again."), !1);
          if (!Number.isInteger(y) || y < 0 || y >= Math.max(1, v.choices.length)) return !1;
          if (
            (this.districtLog("quest:" + p + ":" + T.stage, b.title, v.label + ". " + v.text, "favour"),
            T.stage++,
            T.stage === b.steps.length)
          ) {
            let S = v.choices[y];
            ((T.outcome = S.effect),
              (x.changes[b.state] = S.effect),
              x.inventory.includes(b.reward) || x.inventory.push(b.reward),
              this.state.inventory.includes(b.reward) || this.state.inventory.push(b.reward));
            let _ = p === "mercies" ? "noodles:sheep" : p === "dinner" ? "noodles:token" : null,
              k = "district:" + p;
            (!this.state.rewarded.includes(k) &&
              !this.state.rewarded.includes(_) &&
              ((this.state.xp += 45), this.state.rewarded.push(k)),
              _ && !this.state.rewarded.includes(_) && this.state.rewarded.push(_));
            let E = p === "mercies" ? "Small mercies" : p === "dinner" ? "Dinner for somebody" : b.title;
            this.state.sidequests.includes(E) || this.state.sidequests.push(E);
            for (let M of b.steps.filter((R) => R.kind === "npc"))
              x.rapport[M.target] = e((x.rapport[M.target] || 0) + 1, -4, 4);
            (this.districtLog("outcome:" + p, b.title, S.text, "outcome"),
              this.districtSyncLegacy(),
              this.audio.evidence(),
              this.toast(b.title.toUpperCase() + " / COMPLETE. The district remembers."));
          } else
            ((x.tracked = { type: "quest", id: p }),
              (this.districtPathTimer = 0),
              this.audio.click(),
              this.toast("LOCAL FAVOUR UPDATED / " + b.steps[T.stage].label));
          return (this.save(), this.updateHUD(), !0);
        }),
        (g.districtTask = function (p) {
          let m = i(p.quest),
            y = V_(m, this.state.district);
          if (!y || y.target !== p.id.slice(5) || !this.districtCanReach(p)) return;
          this.showModal(
            y.label,
            y.text,
            m.title.toUpperCase() + " / STEP " + (p.stage + 1) + " OF " + m.steps.length,
            "district-task",
            { wide: !0 },
          );
          let b = this.state.district.log.filter((x) => x.id.startsWith("quest:" + m.id + ":")).slice(-2);
          (t("modal-actions").insertAdjacentHTML(
            "beforebegin",
            `<div class="favour-observation"><span class="source-tag original">ORIGINAL / LOCAL FAVOUR</span><p>Use the information you found in the district. An incorrect choice does not destroy evidence.</p>${b.map((x) => `<blockquote>${a(x.text)}</blockquote>`).join("")}</div>`,
          ),
            this.buttons(
              y.choices.map((x, T) => ({
                label: typeof x == "string" ? x : x.label,
                choice: !0,
                on: () => {
                  this.advanceDistrictQuest(m.id, y.target, T) &&
                    (this.closeModal(),
                    this.sayLocal(
                      m.title.toUpperCase(),
                      "Recorded. " + (m.steps[p.stage + 1]?.label || "The local work is complete."),
                      { force: !0 },
                    ));
                },
              })),
            ));
        }),
        (g.districtLore = function (p) {
          if (!this.districtCanReach(p)) return;
          let m = this.state.district,
            y = p.lore;
          (m.readLore.includes(y.id) || m.readLore.push(y.id),
            this.districtLog("lore:" + y.id, y.title, y.text, "lore"),
            this.save(),
            this.showModal(y.title, y.text, $s.find((b) => b.id === p.area).shop.toUpperCase(), "district-lore"),
            t("modal-actions").insertAdjacentHTML(
              "beforebegin",
              '<p class="small-note">Original environmental writing for this game. Recorded in District \u2192 Lore.</p>',
            ),
            this.buttons([{ label: "BACK TO THE STREET", primary: !0, on: () => this.closeModal() }]));
        }),
        (g.openNode = function (p) {
          if (
            (u.openNode.call(this, p),
            !this.world?.isDistrict ||
              (!["talk", "dialog", "interview"].includes(p.kind) && p.id !== "gaff") ||
              !["dialog", "interview"].includes(this.overlay))
          )
            return;
          let m = p.id === "gaff" ? rX : s("toma"),
            y = document.createElement("div");
          ((y.className = "story-portrait-row"),
            (y.innerHTML = `<div>${Yi(m, "neutral", "story")}<span>${a(m.name)}</span></div><div class="story-portrait-note"><span>STORY CONVERSATION</span><p>${p.id === "gaff" ? "You can hear the order now and still finish local work before leaving." : "The counter is the start of the case, not the edge of the district."}</p></div><div>${Yi(aT, "neutral", "story-player")}<span>DECKARD</span></div>`),
            t("modal-actions").before(y));
        }),
        (g.finishNode = function (p, m = {}) {
          (u.finishNode.call(this, p, m), this.world?.isDistrict && (this.districtSyncLegacy(), this.save()));
        }),
        (g.finishScene = function () {
          if ((u.finishScene.call(this), this.scene.key !== "noodles" || this.overlay !== "resolved" || this.replay))
            return;
          let p = this.state.district,
            m = Bf(p);
          t("modal-title").textContent = "Gaff has a car waiting.";
          let y = document.createElement("p");
          ((y.className = "district-leave-note"),
            (y.textContent = `${m} of 12 local favours complete. ${p.met.length} of 50 local people met. Unfinished favours remain in your save. The story returns to this district during the investigation.`),
            t("modal-actions").before(y));
          let b = t("modal-actions").querySelector("button"),
            x = b.onclick;
          ((b.innerHTML = "LEAVE WITH GAFF <span>\u2192</span>"),
            (b.onclick = () => {
              ((p.gaff.departed = !0), this.save(), x());
            }));
        }),
        (g.tickDistrict = function (p, m) {
          if (!this.world?.isDistrict) return;
          let y = this.inGame && !this.overlay && !this.encounter && !document.hidden,
            b = this.state.district;
          if (
            (uX(this.world, p, m, {
              cam: this.cam,
              state: b,
              paused: !y && this.inGame,
              reduced: this.prefs.reducedMotion,
              quality: this.gfxQuality,
            }),
            !y)
          )
            return;
          b.clock += p;
          let x = Y3(this.cam.x, this.cam.z);
          if (
            (x?.id !== this.districtLastZone &&
              ((this.districtLastZone = x.id),
              this.audio.setScene(x.sound),
              b.visitedAreas.includes(x.id) ||
                (b.visitedAreas.push(x.id),
                this.districtLog("area:" + x.id, x.name, x.air + " " + x.note + " At the shop: " + x.stock, "place"),
                this.sayLocal(x.name.toUpperCase(), x.air, { force: !0 }),
                this.save())),
            !b.gaff.announced &&
              (b.visitedAreas.length >= 3 || b.met.length >= 6 || Bf(b) > 0 || b.clock > 180) &&
              ((b.gaff.announced = !0),
              this.districtLog(
                "gaff:wait",
                "A car at the counter",
                "Gaff is waiting near the counter. You choose when to leave.",
                "story",
              ),
              this.sayLocal(
                "GAFF / WAITING",
                "Bryant wants to see you. I will be by the car. Finish what you are doing.",
                { force: !0 },
              ),
              this.save()),
            (this.districtPathTimer -= p),
            this.districtPathTimer <= 0 &&
              ((this.districtPathTimer = 2.5),
              (this.districtTarget = this.districtResolveTrack()),
              (this.districtRoute = this.districtTarget ? r(this.world, this.cam, this.districtTarget) : [])),
            (this.districtCueTimer -= p),
            this.districtCueTimer <= 0 && !(this.localCaption?.remaining > 0))
          ) {
            this.districtCueTimer = 14;
            let T = x.overheard.findIndex((v, A) => !b.heard.includes(x.id + ":" + A));
            if (T >= 0) {
              let v = x.id + ":" + T;
              this.sayLocal(x.name.toUpperCase() + " / OVERHEARD", x.overheard[T]) &&
                (b.heard.push(v), this.districtLog("heard:" + v, x.name, x.overheard[T], "overheard"), this.save());
            }
          }
          if (((this.districtMusicTimer -= p), this.districtMusicTimer <= 0)) {
            this.districtMusicTimer = b.changes.music === "pulse" ? 0.65 : 1.15;
            let T = Math.hypot(this.cam.x, this.cam.z + 29);
            if (b.changes.music && T < 32) {
              let v = b.changes.music === "pulse" ? [65.4, 65.4, 82.4, 73.4] : [261.6, 311.1, 392, 349.2];
              ((this.districtMusicNote = ((this.districtMusicNote || 0) + 1) % v.length),
                this.audio.spatialTone(
                  v[this.districtMusicNote],
                  0.55,
                  0.13 * (1 - T / 32),
                  e(-this.cam.x / 20, -1, 1),
                  b.changes.music === "pulse" ? "triangle" : "sine",
                ));
            }
          }
        }),
        (g.updateHUD = function () {
          if ((u.updateHUD.call(this), !t("district-open"))) return;
          let p = this.inGame && this.world?.isDistrict;
          if (
            ((t("district-open").hidden = !p), (t("district-place").hidden = !p), (t("district-track").hidden = !p), !p)
          )
            return;
          let m = this.state.district,
            y = Y3(this.cam.x, this.cam.z);
          ((t("district-place").textContent = y.name.toUpperCase()),
            (t("district-open").innerHTML =
              `DISTRICT <span>${m.met.length}/50 PEOPLE \xB7 ${Bf(m)}/12 FAVOURS</span>`));
          let b = this.districtResolveTrack();
          ((t("district-track").hidden = !b),
            b &&
              ((t("district-track").querySelector("strong").textContent = b.name),
              (t("district-track").querySelector("span").textContent =
                (b.quest || "Local discovery") +
                " \xB7 " +
                Math.ceil(Math.hypot(b.x - this.cam.x, b.z - this.cam.z)) +
                " m")),
            (t("objective-detail").textContent =
              this.scene.key === "noodles"
                ? "Explore freely. Leave with Gaff when you are ready."
                : "Your previous local choices remain. The case continues at the counter."));
        }),
        (g.drawMap = function () {
          if (!this.world?.isDistrict) {
            u.drawMap.call(this);
            return;
          }
          let p = t("minimap"),
            m = p.getContext("2d"),
            y = 2.6;
          (m.clearRect(0, 0, 120, 120),
            m.save(),
            m.beginPath(),
            m.arc(60, 60, 58, 0, Math.PI * 2),
            m.clip(),
            (m.fillStyle = "#081c26"),
            m.fillRect(0, 0, 120, 120));
          let b = (T) => 60 + (T - this.cam.x) * y,
            x = (T) => 60 + (T - this.cam.z) * y;
          m.fillStyle = "#31525c";
          for (let T of $s) m.fillRect(b(T.x - 10), x(T.z - 10), 20 * y, 11 * y);
          ((m.strokeStyle = "#d9bb7f"),
            (m.lineWidth = 1.7),
            this.districtRoute?.length &&
              (m.beginPath(),
              this.districtRoute.forEach((T, v) => (v ? m.lineTo(b(T.x), x(T.z)) : m.moveTo(b(T.x), x(T.z)))),
              m.stroke()),
            (m.fillStyle = "#a1ffdc"));
          for (let T of this.activeSpots()) (m.beginPath(), m.arc(b(T.x), x(T.z), 2, 0, Math.PI * 2), m.fill());
          (m.save(),
            m.translate(60, 60),
            m.rotate(-this.cam.yaw),
            (m.fillStyle = "#f5f6df"),
            m.beginPath(),
            m.moveTo(0, -6),
            m.lineTo(-3, 4),
            m.lineTo(3, 4),
            m.closePath(),
            m.fill(),
            m.restore(),
            m.restore());
        }),
        (g.addJournalTabs = function (p) {
          u.addJournalTabs.call(this, p);
          let m = t("modal").querySelector("nav.tabs");
          if (m && !m.querySelector('[data-tab="district"]')) {
            let y = document.createElement("button");
            ((y.dataset.tab = "district"),
              (y.textContent = "DISTRICT"),
              (y.className = p === "district" ? "active" : ""),
              (y.onclick = () => this.districtJournal("map")),
              m.prepend(y));
          }
        }),
        (g.journal = function (p = "board") {
          if (p === "district" || (p === "map" && this.world?.isDistrict)) {
            this.districtJournal("map");
            return;
          }
          u.journal.call(this, p);
        }),
        (g.districtJournal = function (p = "map") {
          this.state.district ??= oT(null, this.state);
          let m = this.state.district,
            y = this.world?.isDistrict;
          (this.showModal(
            "The people below the lights.",
            "",
            `NOODLE ROW / ${m.visitedAreas.length} PLACES \xB7 ${m.met.length} PEOPLE \xB7 ${Bf(m)} FAVOURS`,
            "district-journal",
            { wide: !0 },
          ),
            t("modal-actions").remove(),
            t("modal").insertAdjacentHTML("beforeend", '<div id="journal-content"></div>'),
            this.addJournalTabs("district"));
          let b = t("journal-content");
          ((b.innerHTML = `<nav class="district-tabs" aria-label="District sections">${["map", "favours", "people", "lore"].map((T) => `<button data-district-tab="${T}" class="${T === p ? "active" : ""}">${T.toUpperCase()}</button>`).join("")}</nav><div id="district-page"></div>`),
            b
              .querySelectorAll("[data-district-tab]")
              .forEach((T) => (T.onclick = () => this.districtJournal(T.dataset.districtTab))));
          let x = t("district-page");
          if (p === "map") {
            x.innerHTML = `<div class="district-map-layout"><div><svg id="district-map" viewBox="0 0 520 680" role="img" aria-label="Twelve connected areas of Noodle Row"><rect width="520" height="680" fill="#10242e"/><defs><pattern id="district-grid" width="26" height="26" patternUnits="userSpaceOnUse"><path d="M26 0H0V26" fill="none" stroke="#29414a" stroke-width=".6"/></pattern></defs><rect width="520" height="680" fill="url(#district-grid)"/><text x="24" y="31" fill="#afc6bd" font-family="monospace" font-size="12" letter-spacing="2">LOWER CITY / PUBLIC WALKING MAP</text><g id="map-areas"></g><g id="map-path"></g></svg><p class="small-note">Select a place to mark a walking route. Gold: tracked path. Green: visited place. No fast travel. The roof stair is at the east edge.</p></div><div><h3>TWELVE PLACES TO ENTER</h3><div class="district-area-list">${$s.map((_) => `<button data-area-track="${_.id}" ${y ? "" : "disabled"}><span>${String(_.index + 1).padStart(2, "0")}</span><div><b>${a(_.name)}</b><small>${a(_.shop)}</small></div><i>${m.visitedAreas.includes(_.id) ? "\u2713" : "+"}</i></button>`).join("")}</div>${y ? "" : '<p class="small-note">Walking routes become available while you are in Noodle Row. The story returns here in Scene 26.</p>'}</div></div>`;
            let T = (_) => 260 + _ * 5.2,
              v = (_) => 510 + _ * 5.7,
              A = "";
            for (let _ of $s)
              A += `<g data-map-area="${_.id}" tabindex="0" role="button" aria-label="Track ${a(_.name)}"><rect x="${T(_.x) - 59}" y="${v(_.z) - 53}" width="118" height="108" rx="3" fill="${m.visitedAreas.includes(_.id) ? "#24483f" : "#1d3441"}" stroke="${_.color}" stroke-opacity=".55"/><rect x="${T(_.x) - 51}" y="${v(_.z) - 45}" width="102" height="43" fill="#30484e"/><text x="${T(_.x)}" y="${v(_.z) - 18}" fill="${_.color}" text-anchor="middle" font-family="monospace" font-size="11">${String(_.index + 1).padStart(2, "0")} / SHOP</text><text x="${T(_.x)}" y="${v(_.z) + 18}" fill="#d9e5d7" text-anchor="middle" font-family="sans-serif" font-size="10">${a(_.name)}</text></g>`;
            t("map-areas").innerHTML = A;
            let S = this.districtRoute || [];
            ((t("map-path").innerHTML =
              (S.length
                ? `<polyline points="${S.map((_) => T(_.x) + "," + v(_.z)).join(" ")}" fill="none" stroke="#efc97e" stroke-width="2.5"/>`
                : "") + (y ? `<circle cx="${T(this.cam.x)}" cy="${v(this.cam.z)}" r="5" fill="#ffffff"/>` : "")),
              x
                .querySelectorAll("[data-area-track]")
                .forEach((_) => (_.onclick = () => this.districtTrack("area", _.dataset.areaTrack))),
              x.querySelectorAll("[data-map-area]").forEach((_) => {
                ((_.onclick = () => y && this.districtTrack("area", _.dataset.mapArea)),
                  (_.onkeydown = (k) => {
                    k.key === "Enter" && y && this.districtTrack("area", _.dataset.mapArea);
                  }));
              }));
          }
          if (
            (p === "favours" &&
              ((x.innerHTML = `<p class="small-note">All favours are optional. Talk to the named person or use the object in the street. The journal cannot complete work remotely.</p><div class="district-favours">${wr
                .map((T) => {
                  let v = m.quests[T.id],
                    A = T.steps[v.stage],
                    S = !A,
                    _ = s(T.giver);
                  return `<article class="district-favour ${S ? "done" : ""}"><small>${S ? "COMPLETE" : v.stage ? "IN PROGRESS" : "NOT STARTED"} / ${Math.min(v.stage + 1, 4)} OF 4</small><h3>${a(T.title)}</h3><p>${a(T.summary)}</p><div class="favour-progress">${T.steps.map((k, E) => `<i class="${E < v.stage ? "filled" : ""}"></i>`).join("")}</div><strong>${a(A ? A.label : T.steps.at(-1).choices.find((k) => k.effect === v.outcome)?.text || "Complete")}</strong><p class="small-note">${a(_.name)} \xB7 ${a($s.find((k) => k.id === _.area).name)}</p>${S ? `<span class="favour-reward">${a(T.reward)}</span>` : `<button data-favour-track="${T.id}" class="secondary" ${y ? "" : "disabled"}>MARK WALKING ROUTE</button>`}</article>`;
                })
                .join("")}</div>`),
              x
                .querySelectorAll("[data-favour-track]")
                .forEach((T) => (T.onclick = () => this.districtTrack("quest", T.dataset.favourTrack)))),
            p === "people")
          ) {
            x.innerHTML =
              '<label class="district-search-label">FIND A LOCAL PERSON<input id="district-search" type="search" placeholder="Name, work, or place" autocomplete="off"></label><div id="district-people-grid" class="district-people-grid"></div>';
            let T = (v) => {
              let A = Sl.filter((S) =>
                (S.name + " " + S.role + " " + $s.find((_) => _.id === S.area).name)
                  .toLowerCase()
                  .includes(v.toLowerCase()),
              );
              ((t("district-people-grid").innerHTML = A.map(
                (S) =>
                  `<article class="district-person-card">${Yi(S, this.districtMood(S.id), "file")}<div><small>${m.met.includes(S.id) ? "MET / " + (m.topics[S.id]?.length || 0) + " TOPICS" : "NOT YET MET"}</small><h3>${a(S.name)}</h3><p>${a(S.role)}</p><p class="small-note">${a(S.trait)}</p><button class="secondary" data-person-track="${S.id}" ${y ? "" : "disabled"}>FIND IN DISTRICT</button>${
                    m.topics[S.id]?.length
                      ? `<details><summary>READ FILED CONVERSATION</summary>${S.topics
                          .filter((_) => m.topics[S.id].includes(_.id))
                          .map((_) => `<p><b>${a(_.label)}</b><br>${a(_.text)}</p>`)
                          .join("")}</details>`
                      : ""
                  }</div></article>`,
              ).join("")),
                t("district-people-grid")
                  .querySelectorAll("button")
                  .forEach((S) => (S.onclick = () => this.districtTrack("person", S.dataset.personTrack))));
            };
            (T(""), (t("district-search").oninput = (v) => T(v.target.value)));
          }
          if (p === "lore") {
            let T = m.log
              .filter((v) => ["lore", "overheard", "outcome", "place"].includes(v.kind))
              .slice()
              .reverse();
            x.innerHTML = `<div class="district-lore-header"><b>${m.readLore.length} / 24</b><span>READABLE OBJECTS</span><b>${m.heard.length} / 48</b><span>OVERHEARD LINES</span></div><p class="small-note">These shops, residents, notices, and favours are original fan-game additions. Local claims and memories are not proof of film canon.</p><div class="district-lore-list">${T.map((v) => `<article><small>${a(v.kind.toUpperCase())}</small><h3>${a(v.title)}</h3><p>${a(v.text)}</p></article>`).join("") || "<p>Read a notice or listen in a courtyard. New entries appear here.</p>"}</div>`;
          }
        }),
        (g.settings = function () {
          u.settings.call(this);
          let p = document.createElement("section");
          ((p.className = "life-settings"),
            (p.innerHTML =
              "<h3>DISTRICT GRAPHICS</h3><p>All 132 background people keep their records. Distant people use fewer parts and slower updates. Performance mode reduces the visible range, pixel ratio, and effects. Named people and quest access remain.</p><p>Portraits are embedded vector art. They need no image service or network connection. Conversations are text, not recorded voices.</p>"),
            t("modal-actions").before(p));
        }),
        (g.expandedGuide = function () {
          (u.expandedGuide.call(this),
            (t("modal").querySelector(".modal-kicker").textContent = "FIELD GUIDE / VERSION 4.0"));
          let p = document.createElement("section");
          ((p.className = "guide-section"),
            (p.innerHTML =
              "<h3>NOODLE ROW / WORLD IMMERSION PASS</h3><p>Enter twelve shops and courts. Meet fifty local people. Each has a portrait and four conversation topics. Read the twenty-four notices or listen for forty-eight local lines.</p><p>B or DISTRICT opens Map, Favours, People, and Lore. Select a route, then follow the gold path on the map. The path is a walking guide, not a teleport. The roof stair is on the east edge of the district.</p><p>Each favour has four stages. Speak to the current person or use the current object. Use the details in earlier replies to solve local tasks. The last choice gives one of two saved outcomes. The journal cannot complete a task remotely.</p><p>Gaff waits for your choice. Complete the three green story leads, then use the exit near the car. The later fish-scale scene uses this same district and your saved local state. Older completed sheep and meal favours stay complete.</p><p>All local residents and favours are original game additions. Vector portraits do not use film actors or online image services. The 132 background people use short routines and distance detail, not full city AI.</p>"),
            t("journal-content").prepend(p));
        }),
        (g.about = function () {
          (u.about.call(this),
            (t("modal").querySelector(".modal-kicker").textContent = "VERSION 4.0 / NOODLE ROW EXPANDED"));
          let p = document.createElement("p");
          ((p.className = "modal-body"),
            (p.textContent =
              "Scene 03: Noodle Row Expanded / World Immersion Pass. Twelve walk-in shops and areas, fifty original local characters with portraits, twelve multi-stage favours, and 132 background crowd records. The same district returns for the later fish-scale investigation."),
            t("modal-actions").before(p));
        }),
        (g.showCredits = function () {
          u.showCredits.call(this);
          let p = this.state.district;
          if (!p) return;
          let m = document.createElement("p");
          ((m.className = "life-end"),
            (m.textContent = `Noodle Row remembers: ${p.met.length} local people met, ${Bf(p)} favours completed, ${p.readLore.length} notices read. Your local choices remain in the district file.`),
            t("modal-actions").before(m));
        }));
    }
    return { districtPath: r, installDistrictSystems: n };
  })(),
  { openingPath: IX, installOpeningSystems: yX } = (() => {
    let a = (o) => document.getElementById(o),
      e = (o) =>
        String(o ?? "").replace(
          /[&<>"']/g,
          (l) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[l],
        ),
      t = (o) => Ha.find((l) => l.id === o),
      s = (o) => qn.find((l) => l.id === o),
      i = (o, l, c) => Math.max(l, Math.min(c, o));
    function r(o, l, c) {
      if (!o?.isPrologue || !c) return [];
      let h = 53,
        d = h * h,
        f = (S, _) => i(Math.round(_ + 26), 0, 52) * h + i(Math.round(S + 26), 0, 52),
        // The walkable grid only changes when an obstacle appears or disappears, so it is built once
        // per layout instead of on every route refresh (about once a second).
        w = o.obstacles.length;
      for (let S of o.obstacles) S.hidden && (w += 1e4);
      let g = o.prologueNav?.key === w ? o.prologueNav.free : null;
      if (!g) {
        g = new Uint8Array(d);
        for (let S = 0; S < h; S++) for (let _ = 0; _ < h; _++) g[S * h + _] = o.collides(_ - 26, S - 26, 0.25) ? 0 : 1;
        o.prologueNav = { key: w, free: g };
      }
      let u = (S) => {
          let _ = f(S.x, S.z);
          if (g[_]) return _;
          let k = -1,
            E = 1 / 0;
          for (let M = -3; M <= 3; M++)
            for (let R = -3; R <= 3; R++) {
              let N = f(S.x + R, S.z + M);
              g[N] && R * R + M * M < E && ((k = N), (E = R * R + M * M));
            }
          return k;
        },
        p = u(l),
        m = u(c);
      if (p < 0 || m < 0) return [];
      let y = new Int32Array(d);
      y.fill(-1);
      let b = new Uint8Array(d),
        x = new Int32Array(d),
        T = 0,
        v = 0;
      for (x[v++] = p, b[p] = 1; T < v; ) {
        let S = x[T++];
        if (S === m) break;
        let _ = S % h,
          k = Math.floor(S / h);
        for (let [E, M] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          let R = _ + E,
            N = k + M,
            P = N * h + R;
          R < 0 || R >= h || N < 0 || N >= h || !g[P] || b[P] || ((b[P] = 1), (y[P] = S), (x[v++] = P));
        }
      }
      if (!b[m]) return [];
      let A = [];
      for (let S = m; S >= 0 && (A.push({ x: (S % h) - 26, z: Math.floor(S / h) - 26 }), S !== p); S = y[S]);
      return A.reverse();
    }
    function n(o, { SCENES: l, World: c, sceneIndex: h, project: d }) {
      let f = o.prototype,
        g = {};
      for (let u of [
        "bind",
        "loadScene",
        "save",
        "showMenu",
        "interact",
        "updateMarkers",
        "updateHUD",
        "journal",
        "addJournalTabs",
        "openNode",
        "puzzle",
        "finishNode",
        "finishScene",
        "districtTalk",
        "districtRenderTalk",
        "districtJournal",
        "about",
        "expandedGuide",
        "drawMap",
        "processLifeCues",
      ])
        g[u] = f[u];
      ((f.bind = function () {
        g.bind.call(this);
        let u = document.createElement("button");
        ((u.id = "opening-open"),
          (u.hidden = !0),
          u.setAttribute("aria-label", "Open prologue map, people and favours"),
          (u.innerHTML = "BEFORE THE RAIN <span>MAP / PEOPLE / FAVOURS</span>"),
          a("hud").append(u));
        let p = -1 / 0;
        (u.addEventListener("pointerdown", (x) => {
          x.pointerType === "touch" && (x.preventDefault(), (p = performance.now()), this.openingJournal("map"));
        }),
          (u.onclick = () => {
            performance.now() - p > 600 && this.openingJournal("map");
          }));
        let m = document.createElement("aside");
        ((m.id = "opening-area"), (m.hidden = !0), a("hud").append(m));
        let y = document.createElement("aside");
        ((y.id = "opening-track"), (y.hidden = !0), a("hud").append(y));
        let b = a("start").onclick;
        a("start").onclick = (x) => {
          ((this.startInDistrict = !1), b(x));
        };
      }),
        (f.showMenu = function () {
          (g.showMenu.call(this),
            (a("opening-open").hidden = !0),
            (a("opening-area").hidden = !0),
            (a("opening-track").hidden = !0),
            document.body.classList.remove("opening-active"),
            (this.openingConversation = null));
          let u = a("menu").querySelector(".eyebrow");
          ((u.innerHTML = '<span class="mini-line"></span> BEFORE THE RAIN <span class="edition-name">/ V5</span>'),
            (a("menu").querySelector(".menu-spec").innerHTML =
              "<span><b>02</b> LIVING PROLOGUES</span><span><b>16</b> LOCAL PEOPLE</span><span><b>08</b> NEW FAVOURS</span>"));
          let p = a("menu").querySelector(".menu-tagline");
          p && (p.innerHTML = "Before the case, there is a city.<br><em>Meet the people who keep it working.</em>");
        }),
        (f.loadScene = function (u, p = {}) {
          this.state.opening ??= nT(null);
          let m = p.reset === !1 ? this.state.opening.position : null;
          ((this.openingConversation = null),
            (this.openingAftermath = !1),
            (this.openingBookScene = l[u].key),
            g.loadScene.call(this, u, p));
          let y = !!this.world.isPrologue;
          if (
            (document.body.classList.toggle("opening-active", y),
            (a("opening-open").hidden = !y),
            (a("opening-area").hidden = !y),
            (a("opening-track").hidden = !0),
            (this.openingZone = null),
            (this.openingCueTimer = 6),
            (this.openingAccentTimer = 4),
            (this.openingRouteTimer = 0),
            (this.openingRoute = []),
            y)
          ) {
            let b = this.world.prologue.spec,
              x = m?.scene === this.scene.key && !this.world.collides(m.x, m.z) ? m : b.spawn;
            if (((this.cam = { x: x.x, y: 1.72, z: x.z, yaw: x.yaw || 0, pitch: 0.02 }), this.overlay === "intro")) {
              a("modal-title").textContent = b.title;
              let T = a("modal").querySelector(".modal-body");
              T && (T.textContent = b.intro);
              let v = a("modal").querySelector(".life-intro");
              v &&
                (v.textContent =
                  "Six connected areas. Eight local people. Four optional favours. B opens your map. Green markers keep the main case in view.");
              let A = document.createElement("div");
              ((A.className = "opening-perspective"),
                (A.innerHTML = `<b>FIRST PERSON / ${b.role.toUpperCase()}</b><p>${b.role === "Holden" ? "These are Holden's observations. Deckard will not remember having these conversations." : "The transfer flight has stopped. Explore the deck before the record moves to Holden at Tyrell."}</p>`),
                a("modal-actions").before(A));
            }
            this.scene.key === "holden" &&
              this.state.beats.includes("leon") &&
              ((this.openingAftermath = !0), this.finishScene());
          }
          this.save();
        }),
        (f.save = function (u = !1) {
          (this.inGame &&
            this.world?.isPrologue &&
            this.state.opening &&
            !this.replay &&
            (this.state.opening.position = { scene: this.scene.key, x: this.cam.x, z: this.cam.z, yaw: this.cam.yaw }),
            g.save.call(this, u));
        }),
        (f.openingSpot = function (u, p) {
          return this.world?.prologue?.spots.find((m) => m.type === u && m.id === p);
        }),
        (f.openingCanReach = function (u) {
          if (
            !u ||
            !this.world?.isPrologue ||
            this.openingAftermath ||
            !this.inGame ||
            Math.hypot(u.x - this.cam.x, u.z - this.cam.z) > 3.4
          )
            return !1;
          for (let p = 1; p < 10; p++) {
            let m = p / 11,
              y = this.cam.x + (u.x - this.cam.x) * m,
              b = this.cam.z + (u.z - this.cam.z) * m;
            if (
              this.world.obstacles.some(
                (x) =>
                  !x.hidden &&
                  x.h > 0.7 &&
                  x.y + x.h / 2 > 0.8 &&
                  Math.abs(y - x.x) < x.w / 2 &&
                  Math.abs(b - x.z) < x.d / 2,
              )
            )
              return !1;
          }
          return !0;
        }),
        (f.openingRecord = function (u, p, m) {
          let y = this.state.opening;
          y.log.some((b) => b.id === u) ||
            y.log.push({ id: u, scene: this.scene.key, role: this.scene.role, title: p, text: m });
        }),
        (f.interact = function () {
          if (this.nearby?.opening && !this.overlay && !this.encounter) {
            let u = this.nearby;
            if (!this.openingCanReach(u)) return;
            (u.type === "person" && this.openingTalk(u.id),
              u.type === "lore" && this.openingRead(u.id),
              u.type === "favour" && this.openingTask(u.id));
            return;
          }
          g.interact.call(this);
        }),
        (f.openingTalk = function (u) {
          let p = t(u),
            m = this.openingSpot("person", u);
          if (!p || !this.openingCanReach(m)) return;
          let y = this.state.opening,
            b = p.scene + ":" + p.id,
            x = this.scene.role,
            T = y.met[x].includes(u);
          (T || y.met[x].push(u), (y.topics[b] ??= []));
          let v = qn.find((S) => S.person === u),
            A = v && y.favours[v.id].stage === 3;
          ((this.openingConversation = {
            id: u,
            approach: "patient",
            player: "There is time for a few questions.",
            text: A ? "The work is still done. Thank you. " + p.greeting : T ? "Back again. " + p.greeting : p.greeting,
          }),
            this.openingRecord("met:" + b, p.name, p.role + ". " + p.trait),
            this.save(),
            this.openingRenderTalk());
        }),
        (f.openingRenderTalk = function () {
          let u = this.openingConversation;
          if (!u) return;
          let p = t(u.id),
            m = this.state.opening,
            y = p.scene + ":" + p.id,
            b = this.scene.role,
            x = (m.rapport[y] || 0) > 0 ? "warm" : (m.rapport[y] || 0) < 0 ? "guarded" : "neutral",
            T = b === "Holden" ? z_ : aT;
          (this.showModal(
            p.name,
            "",
            p.role.toUpperCase() + " / " + ji[p.scene].regions.find((A) => A.id === p.area).name.toUpperCase(),
            "opening-talk",
            { wide: !0 },
          ),
            a("modal").classList.add("portrait-modal"),
            a("modal-actions").insertAdjacentHTML(
              "beforebegin",
              `<div class="portrait-dialog"><aside class="portrait-person">${Yi(p, x, "opening")}<div class="portrait-label"><b>${e(p.name)}</b><span>${e(p.role)}</span></div><div class="portrait-mood">${x === "warm" ? "AT EASE" : x === "guarded" ? "GUARDED" : "LISTENING"} \xB7 ${m.topics[y]?.length || 0} / 4 TOPICS</div></aside><section class="portrait-copy"><p class="character-trait">${e(p.trait)}</p><div class="npc-speech" id="opening-speech" aria-live="polite">${e(u.text)}</div><div class="player-response">${Yi(T, "neutral", "opening-reply")}<div><small>${b.toUpperCase()} / PERSONAL OBSERVATION</small><p>${e(u.player)}</p></div></div><div class="talk-approach">${[
                ["patient", "Allow time"],
                ["direct", "Ask directly"],
                ["press", "Apply pressure"],
              ]
                .map(
                  ([A, S]) =>
                    `<button data-opening-manner="${A}" class="${A === u.approach ? "active" : ""}" aria-pressed="${A === u.approach}">${S}</button>`,
                )
                .join(
                  "",
                )}</div><div class="district-topics">${p.topics.map((A) => `<button data-opening-topic="${A.id}"><span>${m.topics[y]?.includes(A.id) ? "\u2713" : "+"}</span>${e(A.label)}</button>`).join("")}</div><div id="opening-favour-options"></div><div class="opening-record-note">Recorded as ${b.toUpperCase()}. ${p.reuse ? "This person has a later shift in Noodle Row." : "Original supporting character."}</div></section></div>`,
            ),
            a("modal")
              .querySelectorAll("[data-opening-manner]")
              .forEach(
                (A) =>
                  (A.onclick = () => {
                    ((u.approach = A.dataset.openingManner), this.openingRenderTalk());
                  }),
              ),
            a("modal")
              .querySelectorAll("[data-opening-topic]")
              .forEach((A) => (A.onclick = () => this.openingTopic(p.id, A.dataset.openingTopic))));
          let v = qn.find((A) => A.person === p.id);
          if (v) {
            let A = m.favours[v.id].stage,
              S = a("opening-favour-options");
            S.innerHTML = `<section class="favour-hook"><small>LOCAL FAVOUR / OPTIONAL / ${A} OF 3 STAGES</small><h4>${e(v.title)}</h4><p>${e(A === 0 ? v.summary : A === 1 ? v.clue : A === 2 ? v.result : "Your choice: " + v.ending[m.favours[v.id].choice])}</p><div id="opening-favour-buttons"></div></section>`;
            let _ = a("opening-favour-buttons"),
              k = A === 0 ? [["I will take a look.", 0]] : A === 2 ? v.ending.map((E, M) => [E, M]) : [];
            for (let [E, M] of k) {
              let R = document.createElement("button");
              ((R.className = "secondary"),
                (R.dataset.openingAccept = v.id),
                (R.dataset.choice = M),
                (R.textContent = E),
                (R.onclick = () => {
                  this.openingAdvance(v.id, M) &&
                    ((u.player = E),
                    (u.text = A === 0 ? v.clue : v.result + " " + v.ending[M]),
                    this.openingRenderTalk());
                }),
                _.append(R));
            }
            if (A === 1) {
              let E = document.createElement("button");
              ((E.className = "secondary"),
                (E.textContent = "MARK THE WORK ON MY MAP"),
                (E.onclick = () => this.openingTrack("favour", v.id)),
                _.append(E));
            }
          }
          this.buttons([
            {
              label: b === "Holden" ? "BACK TO THE ANNEX" : "BACK TO THE TRANSFER DECK",
              primary: !0,
              on: () => this.closeModal(),
            },
          ]);
        }),
        (f.openingTopic = function (u, p) {
          let m = t(u),
            y = m?.topics.find((A) => A.id === p),
            b = this.openingConversation,
            x = this.openingSpot("person", u);
          if (!y || b?.id !== u || !this.openingCanReach(x)) return;
          let T = this.state.opening,
            v = m.scene + ":" + u;
          (T.topics[v].includes(p) ||
            (T.topics[v].push(p),
            (T.rapport[v] = i(
              (T.rapport[v] || 0) + (b.approach === "patient" ? 1 : b.approach === "press" ? -1 : 0),
              -4,
              4,
            )),
            this.openingRecord("topic:" + v + ":" + p, m.name + " / " + y.label, y.text)),
            (b.player =
              (b.approach === "patient"
                ? "Take your time. "
                : b.approach === "press"
                  ? "I need a clear answer. "
                  : "") +
              y.label +
              "?"),
            (b.text =
              (b.approach === "press"
                ? "Please do not push. "
                : b.approach === "patient"
                  ? "Thank you for waiting. "
                  : "") + y.text),
            this.save(),
            this.openingRenderTalk());
        }),
        (f.openingAdvance = function (u, p = 0) {
          let m = s(u),
            y = this.state.opening;
          if (!m || m.scene !== this.scene.key) return !1;
          let b = y.favours[u],
            x = b.stage;
          if (x >= 3) return !1;
          let T = this.openingSpot(x === 1 ? "favour" : "person", x === 1 ? u : m.person);
          return this.openingCanReach(T)
            ? x === 1 && p !== m.answer
              ? (this.toast("That does not match the local note. The task stays open."), !1)
              : x === 2 && ![0, 1].includes(p)
                ? !1
                : (b.stage++,
                  x === 2 && (b.choice = p),
                  (y.tracked = b.stage < 3 ? { type: "favour", id: u } : null),
                  (this.openingRouteTimer = 0),
                  this.openingRecord(
                    "favour:" + u + ":" + x,
                    m.title,
                    x === 0 ? m.clue : x === 1 ? m.result : m.result + " " + m.ending[p],
                  ),
                  this.audio.localSound?.(x === 1 ? "switch" : "paper", 0, 0.4),
                  X3(this.world, 0, 0, {
                    cam: this.cam,
                    state: y,
                    reduced: this.prefs.reducedMotion,
                    paused: !0,
                    quality: this.gfxQuality,
                  }),
                  this.save(),
                  !0)
            : !1;
        }),
        (f.openingTask = function (u) {
          let p = s(u),
            m = this.openingSpot("favour", u);
          if (!p || !this.openingCanReach(m)) return;
          let y = this.state.opening.favours[u].stage;
          if (y !== 1) {
            this.toast(y === 0 ? "Speak to " + t(p.person).name + " first." : "This local work is already recorded.");
            return;
          }
          (this.showModal(p.title, p.clue, this.scene.role.toUpperCase() + " / LOCAL WORK / OPTIONAL", "opening-task"),
            a("modal-actions").insertAdjacentHTML(
              "beforebegin",
              '<p class="opening-record-note">Use the local note. This work does not replace a required case lead.</p>',
            ),
            this.buttons(
              p.options.map((b, x) => ({
                label: b,
                choice: !0,
                on: () => {
                  this.openingAdvance(u, x) &&
                    (this.showModal(
                      p.title,
                      p.result,
                      "LOCAL CHANGE / RETURN TO " + t(p.person).name.toUpperCase(),
                      "opening-result",
                    ),
                    this.buttons([
                      { label: "RETURN TO THE AREA", primary: !0, on: () => this.closeModal() },
                      { label: "MARK THE PERSON ON MY MAP", on: () => this.openingTrack("favour", u) },
                    ]));
                },
              })),
            ));
        }),
        (f.openingRead = function (u) {
          let p = this.openingSpot("lore", u);
          if (!this.openingCanReach(p)) return;
          let m = this.state.opening;
          (m.lore.includes(u) || m.lore.push(u),
            this.openingRecord("lore:" + u, p.lore.title, p.lore.text),
            this.showModal(p.lore.title, p.lore.text, p.lore.source, "opening-lore"),
            a("modal-actions").insertAdjacentHTML(
              "beforebegin",
              `<p class="opening-record-note">${this.scene.role.toUpperCase()} / Original environmental lore for this adaptation.</p>`,
            ),
            this.buttons([{ label: "RETURN TO THE AREA", primary: !0, on: () => this.closeModal() }]),
            this.audio.localSound?.("paper", 0, 0.3),
            this.save());
        }),
        (f.openingTrack = function (u, p) {
          let m = { type: u, id: p };
          ((this.state.opening.tracked = m),
            (this.openingRouteTimer = 0),
            this.closeModal(),
            this.save(),
            this.toast("Walking route marked. B opens the map."));
        }),
        (f.openingTarget = function () {
          let u = this.state.opening?.tracked;
          if (!u || !this.world.isPrologue) return null;
          if (u.type === "favour") {
            let p = s(u.id);
            if (p?.scene !== this.scene.key) return null;
            let m = this.state.opening.favours[p.id].stage;
            if (m === 3) return null;
            let y = this.openingSpot(m === 1 ? "favour" : "person", m === 1 ? p.id : p.person);
            return y ? { ...y, name: m === 1 ? p.title : "Return to " + t(p.person).name } : null;
          }
          if (u.type === "area") {
            let [p, m] = u.id.split(":");
            if (p !== this.scene.key) return null;
            let y = this.world.prologue.spec.regions.find((b) => b.id === m);
            return y ? { x: y.x, z: y.z + 4, y: 1.5, name: y.name } : null;
          }
          return this.openingSpot(u.type, u.id);
        }),
        (f.updateMarkers = function (u) {
          if (
            (g.updateMarkers.call(this, u),
            !this.world?.isPrologue || !this.inGame || this.overlay || this.encounter || this.openingAftermath)
          )
            return;
          let p = null,
            m = 1 / 0,
            y = [],
            b = innerWidth,
            x = innerHeight;
          for (let _ of this.world.prologue.spots) {
            if (_.type === "favour" && this.state.opening.favours[_.id].stage !== 1) continue;
            let k = Math.hypot(_.x - this.cam.x, _.z - this.cam.z);
            if (k > (this.scanTime > 0 ? 15 : 6.5)) continue;
            let E = d(_, this.cam, b, x);
            if (E.z < 0.1 || E.x < 16 || E.x > b - 16 || E.y < 95 || E.y > x - 135) continue;
            let M = Math.abs(E.x - b / 2) / b,
              R = Math.abs(E.y - x / 2) / x,
              N = k + M * 5;
            (this.openingCanReach(_) && M < 0.27 && R < 0.4 && N < m && ((p = _), (m = N)),
              y.push({ h: _, p: E, dist: k, centre: M }));
          }
          y.sort((_, k) => _.dist - k.dist);
          let T = "";
          for (let { h: _, p: k, dist: E, centre: M } of y.slice(0, this.mobile ? 4 : 8)) {
            let R =
              _.type === "person"
                ? this.state.opening.met[this.scene.role].includes(_.id)
                : _.type === "lore"
                  ? this.state.opening.lore.includes(_.id)
                  : !1;
            T += `<div class="district-marker ${R ? "known" : ""}" style="left:${k.x.toFixed(1)}px;top:${k.y.toFixed(1)}px"><i>${_.type === "person" ? "\u25CF" : _.type === "favour" ? "\u25C7" : "\u25A4"}</i>${(E < 5 && M < 0.22) || this.scanTime > 0 ? `<span>${e(_.name)}</span>` : ""}</div>`;
          }
          this.markerHTML += T;
          let v = this.nearby,
            A = !1;
          if (v && !v.opening && !v.life) {
            let _ = d(v, this.cam, b, x);
            A = _.z > 0.1 && Math.abs(_.x - b / 2) < b * 0.12 && Math.hypot(v.x - this.cam.x, v.z - this.cam.z) < 2.7;
          }
          p &&
            !A &&
            ((this.nearby = p),
            (this.promptDisabled = !1),
            (this.promptLocal = !0),
            (this.promptHTML = `<kbd>${this.keyHint("E")}</kbd><span>${p.type === "person" ? "TALK / " : p.type === "lore" ? "READ / " : ""}${e(p.name.toUpperCase())}</span><b>\u2197</b>`));
          let S = this.openingRoute;
          if (S?.length > 3) {
            let _ = S[Math.min(5, S.length - 1)],
              k = d({ x: _.x, z: _.z, y: 0.07 }, this.cam, b, x);
            k.z > 0.3 &&
              k.x > 20 &&
              k.x < b - 20 &&
              k.y > 130 &&
              k.y < x - 100 &&
              (this.markerHTML += `<div class="district-route-dot" style="left:${k.x.toFixed(1)}px;top:${k.y.toFixed(1)}px">\u2316</div>`);
          }
        }),
        (f.processLifeCues = function () {
          (this.world?.isPrologue &&
            this.scene.key === "holden" &&
            G_(this.world, this.cam.x, this.cam.z)?.id !== "interview") ||
            g.processLifeCues.call(this);
        }),
        (f.tickOpening = function (u, p) {
          if (!this.world?.isPrologue) return;
          let m = this.inGame && !this.overlay && !this.encounter && !document.hidden && !this.openingAftermath;
          if (
            (X3(this.world, u, p, {
              cam: this.cam,
              state: this.state.opening,
              reduced: this.prefs.reducedMotion,
              paused: !m,
              quality: this.gfxQuality,
            }),
            !m)
          )
            return;
          let y = this.state.opening,
            b = G_(this.world, this.cam.x, this.cam.z),
            x = this.scene.key + ":" + b.id;
          if ((y.areas.includes(x) || (y.areas.push(x), this.save()), this.openingZone !== b.id)) {
            ((this.openingZone = b.id), (this.openingCueTimer = 7));
            let T = {
              dispatch: "flight",
              overlook: "furnace",
              canteen: "market",
              freight: "toys",
              service: "freezer",
              concourse: "arcade",
              waiting: "medical",
              reception: "tower",
              records: "archive",
              garden: "water",
              interview: "office",
              optics: "laboratory",
            };
            (this.audio.setScene?.(T[b.id] || "office"),
              this.prefs.captions !== !1 && this.sayLocal(b.name.toUpperCase(), b.air));
          }
          if (
            ((this.openingCueTimer -= u),
            (this.openingAccentTimer -= u),
            this.openingCueTimer <= 0 && !(this.localCaption?.remaining > 0))
          ) {
            let T = b.cues.find((v) => !y.heard.includes(v.id));
            (T &&
              (y.heard.push(T.id),
              this.sayLocal(b.name.toUpperCase(), T.text),
              this.openingRecord("heard:" + T.id, b.name, T.text),
              this.save()),
              (this.openingCueTimer = 12));
          }
          if (this.openingAccentTimer <= 0) {
            let T =
              b.id === "canteen"
                ? "water"
                : b.id === "freight"
                  ? "bird"
                  : b.id === "records"
                    ? "paper"
                    : b.id === "interview"
                      ? "motor"
                      : "bell";
            (this.audio.localSound?.(T, Math.sin(p * 0.2) * 0.5, 0.16), (this.openingAccentTimer = 10));
          }
          if (((this.openingRouteTimer -= u), this.openingRouteTimer <= 0)) {
            let T = this.openingTarget();
            ((this.openingRoute = T ? r(this.world, this.cam, T) : []), (this.openingRouteTimer = 1.1));
          }
        }),
        (f.updateHUD = function () {
          if ((g.updateHUD.call(this), !this.world?.isPrologue || !this.inGame)) return;
          let u = this.state.opening,
            p = G_(this.world, this.cam.x, this.cam.z),
            m = this.world.prologue.spec,
            y = u.met[m.role].length;
          a("opening-area").innerHTML =
            `<b>${e(p.name.toUpperCase())}</b><span>${m.role.toUpperCase()} / ${y} OF 8 PEOPLE / ${sT(u, this.scene.key)} OF 4 FAVOURS</span>`;
          let b = this.openingTarget(),
            x = a("opening-track");
          ((x.hidden = !b || !!this.overlay),
            b &&
              (x.innerHTML = `<small>OPTIONAL / WALKING ROUTE</small><strong>${e(b.name)}</strong><span>${this.openingRoute.length ? Math.max(1, Math.round(this.openingRoute.length)) + " m along the marked path" : "B opens the map"}</span>`),
            this.encounter ||
              (a("objective-detail").textContent =
                this.scene.key === "holden"
                  ? "Explore the annex before you start Leon\u2019s test."
                  : "Explore the transfer deck. Local favours are optional."));
        }),
        (f.drawMap = function () {
          if ((g.drawMap.call(this), !this.world?.isPrologue || !this.openingRoute?.length)) return;
          let u = a("minimap").getContext("2d");
          (u.save(),
            u.beginPath(),
            u.arc(60, 60, 57, 0, Math.PI * 2),
            u.clip(),
            (u.strokeStyle = "#e4ba78"),
            (u.lineWidth = 1.5),
            u.beginPath(),
            this.openingRoute.forEach((p, m) => {
              let y = 60 + (p.x - this.cam.x) * 3.1,
                b = 60 + (p.z - this.cam.z) * 3.1;
              m ? u.lineTo(y, b) : u.moveTo(y, b);
            }),
            u.stroke(),
            u.restore());
        }),
        (f.districtJournal = function (u = "map") {
          if (this.world?.isPrologue) {
            this.openingJournal(["map", "people", "lore", "favours"].includes(u) ? u : "map");
            return;
          }
          g.districtJournal.call(this, u);
        }),
        (f.addJournalTabs = function (u) {
          g.addJournalTabs.call(this, u);
          let p = a("modal").querySelector("nav.tabs");
          if (p && !p.querySelector('[data-tab="opening"]')) {
            let m = document.createElement("button");
            ((m.dataset.tab = "opening"),
              (m.textContent = "PROLOGUE"),
              (m.className = u === "opening" ? "active" : ""),
              (m.onclick = () => this.openingJournal("map")),
              p.insertBefore(m, p.children[1] || null));
          }
        }),
        (f.journal = function (u = "board") {
          if (u === "opening" || (u === "map" && this.world?.isPrologue)) {
            this.openingJournal("map");
            return;
          }
          g.journal.call(this, u);
        }),
        (f.openingJournal = function (u = "map", p = null) {
          let m = this.world?.isPrologue ? this.scene.key : null;
          ((p = p || m || (ji[this.openingBookScene] ? this.openingBookScene : "hades")), (this.openingBookScene = p));
          let y = ji[p],
            b = this.state.opening || nT(null),
            x = m === p;
          (this.showModal(
            y.title,
            "The city is shared. Personal memories are not.",
            y.role.toUpperCase() + " / PROLOGUE FIELD NOTES",
            "journal",
            { wide: !0 },
          ),
            a("modal-actions").remove(),
            a("modal").insertAdjacentHTML("beforeend", '<div id="journal-content"></div>'),
            this.addJournalTabs("opening"));
          let T = a("journal-content");
          ((T.innerHTML = `<div class="opening-view-select">${Object.entries(ji)
            .map(
              ([A, S]) =>
                `<button data-opening-scene="${A}" class="${p === A ? "active" : ""}" aria-pressed="${p === A}">${S.role.toUpperCase()} / ${A === "hades" ? "TRANSFER DECK" : "TYRELL ANNEX"}</button>`,
            )
            .join(
              "",
            )}</div><nav class="district-tabs" aria-label="Prologue sections">${["map", "people", "favours", "lore"].map((A) => `<button data-opening-tab="${A}" class="${u === A ? "active" : ""}">${A.toUpperCase()}</button>`).join("")}</nav><div class="opening-record-note">${y.role.toUpperCase()} / ${b.met[y.role].length} people met \xB7 ${sT(b, p)} favours complete \xB7 ${b.lore.filter((A) => A.startsWith(p + ":")).length} notices read. ${x ? "Tracking gives a walking path." : "This is a stored record. You cannot do local work from here."}</div><div id="opening-book"></div>`),
            T.querySelectorAll("[data-opening-scene]").forEach(
              (A) => (A.onclick = () => this.openingJournal(u, A.dataset.openingScene)),
            ),
            T.querySelectorAll("[data-opening-tab]").forEach(
              (A) => (A.onclick = () => this.openingJournal(A.dataset.openingTab, p)),
            ));
          let v = a("opening-book");
          if (u === "map") {
            v.innerHTML =
              '<div class="district-map-layout"><canvas id="opening-map" width="640" height="640" aria-label="Map of the six connected prologue areas"></canvas><div class="district-area-list">' +
              y.regions
                .map(
                  (E) =>
                    `<button data-opening-track="area" data-id="${p + ":" + E.id}" ${x ? "" : "disabled"}><small>${b.areas.includes(p + ":" + E.id) ? "VISITED" : "AREA"}</small><strong>${e(E.name)}</strong><span>${e(E.air)}</span></button>`,
                )
                .join("") +
              "</div></div>";
            let A = x ? this.world : new c(l[h(p)]),
              S = a("opening-map"),
              _ = S.getContext("2d"),
              k = (E, M) => [320 + E * 10.8, 320 + M * 10.8];
            ((_.fillStyle = "#0e2732"), _.fillRect(0, 0, 640, 640), (_.fillStyle = "#3d5960"));
            for (let E of A.obstacles) {
              let [M, R] = k(E.x, E.z);
              _.fillRect(M - E.w * 5.4, R - E.d * 5.4, E.w * 10.8, E.d * 10.8);
            }
            ((_.textAlign = "center"), (_.font = "bold 13px monospace"));
            for (let E of y.regions) {
              let [M, R] = k(E.x, E.z);
              ((_.fillStyle = E.tone), _.fillText(E.name.toUpperCase(), M, R - 35, 168));
            }
            for (let E of A.prologue.spots) {
              let [M, R] = k(E.x, E.z);
              ((_.fillStyle = E.type === "person" ? "#e1bd85" : E.type === "lore" ? "#8bb3c0" : "#d9a284"),
                _.beginPath(),
                _.arc(M, R, E.type === "person" ? 3.5 : 2.5, 0, Math.PI * 2),
                _.fill());
            }
            for (let E of A.hotspots) {
              let [M, R] = k(E.x, E.z);
              ((_.fillStyle = "#a1efd2"), _.fillRect(M - 4, R - 4, 8, 8));
            }
            if (x) {
              this.openingRoute?.length &&
                ((_.strokeStyle = "#efbe73"),
                (_.lineWidth = 2.4),
                _.beginPath(),
                this.openingRoute.forEach((R, N) => {
                  let [P, D] = k(R.x, R.z);
                  N ? _.lineTo(P, D) : _.moveTo(P, D);
                }),
                _.stroke());
              let [E, M] = k(this.cam.x, this.cam.z);
              (_.save(),
                _.translate(E, M),
                _.rotate(-this.cam.yaw),
                (_.fillStyle = "#f3ecdb"),
                _.beginPath(),
                _.moveTo(0, -9),
                _.lineTo(-6, 6),
                _.lineTo(6, 6),
                _.fill(),
                _.restore());
            }
            v.insertAdjacentHTML(
              "beforeend",
              '<p class="small-note">Green: main case. Gold: people. Blue: notices. Orange: local work. Walls and furniture block movement.</p>',
            );
          }
          (u === "people" &&
            (v.innerHTML =
              '<div class="district-people-grid">' +
              Ha.filter((A) => A.scene === p)
                .map((A) => {
                  let S = b.met[y.role].includes(A.id),
                    _ = b.topics[p + ":" + A.id] || [];
                  return `<article class="district-person-card">${Yi(A, S ? "warm" : "neutral", "book")}<div><small>${S ? "MET BY " + y.role.toUpperCase() : "NOT YET MET"}</small><h3>${e(A.name)}</h3><p>${e(A.role)}<br>${e(A.trait)}</p><button class="secondary" data-opening-track="person" data-id="${A.id}" ${x ? "" : "disabled"}>FIND IN THIS AREA</button></div><div class="opening-topic-notes">${A.topics
                    .filter((k) => _.includes(k.id))
                    .map((k) => `<details><summary>${e(k.label)}</summary><p>${e(k.text)}</p></details>`)
                    .join(
                      "",
                    )}${A.reuse ? '<p class="small-note">Later shift: Noodle Row. The same portrait identifies this person.</p>' : ""}</div></article>`;
                })
                .join("") +
              "</div>"),
            u === "favours" &&
              (v.innerHTML =
                '<div class="district-favours">' +
                qn
                  .filter((A) => A.scene === p)
                  .map((A) => {
                    let S = b.favours[A.id];
                    return `<article class="favour-card"><small>${S.stage === 3 ? "COMPLETE" : "OPTIONAL / " + S.stage + " OF 3 STAGES"}</small><h3>${e(A.title)}</h3><p>${e(A.summary)}</p><p class="small-note">${S.stage === 0 ? "Speak to " + t(A.person).name : S.stage === 1 ? A.clue : S.stage === 2 ? "Return to " + t(A.person).name : A.ending[S.choice]}</p><button class="secondary" data-opening-track="favour" data-id="${A.id}" ${x && S.stage < 3 ? "" : "disabled"}>${S.stage === 3 ? "RECORDED" : "MARK THE NEXT STEP"}</button>${S.stage === 3 ? '<p class="opening-record-note">' + e(A.callback) + "</p>" : ""}</article>`;
                  })
                  .join("") +
                "</div>"),
            u === "lore" &&
              (v.innerHTML = y.regions
                .map(
                  (A) =>
                    `<section class="opening-lore-section"><h3>${e(A.name)}</h3>${A.lore.map((S) => `<article class="opening-notice"><small>${e(S.source)}</small><h4>${e(S.title)}</h4><p>${b.lore.includes(S.id) ? e(S.text) : "Not read. Visit this notice to add it to the record."}</p>${b.lore.includes(S.id) ? "" : `<button class="secondary" data-opening-track="lore" data-id="${S.id}" ${x ? "" : "disabled"}>FIND THE NOTICE</button>`}</article>`).join("")}${A.cues
                      .filter((S) => b.heard.includes(S.id))
                      .map((S) => `<blockquote>${e(S.text)}</blockquote>`)
                      .join("")}</section>`,
                )
                .join("")),
            v
              .querySelectorAll("[data-opening-track]")
              .forEach((A) => (A.onclick = () => this.openingTrack(A.dataset.openingTrack, A.dataset.id))));
        }),
        (f.openNode = function (u) {
          if (this.scene.key === "holden" && u.id === "leon" && !this.openingAftermath) {
            let p = 4 - sT(this.state.opening, "holden");
            (this.showModal(
              "Begin Leon\u2019s interview?",
              `The local work is optional. ${p ? p + " favours remain unfinished. " : ""}After the interview resolves, this viewpoint ends. You can use protected scene replay later.`,
              "HOLDEN / MAIN CASE / CONFIRM",
              "opening-commit",
            ),
              this.buttons([
                {
                  label: "BEGIN THE INTERVIEW",
                  primary: !0,
                  on: () => {
                    g.openNode.call(this, u);
                  },
                },
                { label: "KEEP EXPLORING THE ANNEX", on: () => this.closeModal() },
              ]));
            return;
          }
          g.openNode.call(this, u);
        }),
        (f.puzzle = function (u) {
          if ((g.puzzle.call(this, u), this.scene.key === "holden" && u.id === "leon" && u.kind === "vk")) {
            a("modal").classList.add("opening-test");
            let p = document.createElement("div");
            ((p.className = "story-portrait-row"),
              (p.innerHTML = `${Yi(iX, "guarded", "vk")}<div class="story-portrait-note"><b>LEON / HOLDEN</b><p>Leon sits across the optical instrument.<br>The fan continues above the table.</p></div>${Yi(z_, "neutral", "vk")}`),
              a("modal").querySelector(".modal-title").after(p));
          }
        }),
        (f.finishNode = function (u, p = {}) {
          let m = this.scene.key;
          (g.finishNode.call(this, u, p),
            m === "holden" &&
              this.scene.key === m &&
              u.id === "leon" &&
              !u.optional &&
              ((this.openingAftermath = !0), this.finishScene()));
        }),
        (f.finishScene = function () {
          if ((g.finishScene.call(this), !this.world?.isPrologue || this.overlay !== "resolved")) return;
          let u = this.world.prologue.spec,
            p = this.state.opening,
            m = document.createElement("div");
          if (
            ((m.className = "opening-resolution"),
            (m.innerHTML = `<div class="opening-record-note">${u.role.toUpperCase()} / ${p.met[u.role].length} people met \xB7 ${sT(p, this.scene.key)} optional favours complete.</div><p>${e(u.exitText)}</p>`),
            a("modal-actions").before(m),
            this.scene.key === "holden")
          ) {
            ((this.openingAftermath = !0), (this.world.prologue.leon.active = !1));
            for (let b of this.world.prologue.leon.parts) b.hidden = !0;
            ((a("modal-title").textContent = "18:41 / Recorder signal lost"),
              a("modal").classList.add("opening-aftermath"));
            let y = document.createElement("div");
            ((y.className = "opening-handoff"),
              (y.innerHTML = `${Yi(z_, "neutral", "end")}<div><span>END OF HOLDEN\u2019S VIEWPOINT</span><p>A shot breaks the record. Emergency staff respond. Leon escapes. Holden\u2019s observations remain in his file.</p><b>NEXT / DECKARD AT NOODLE ROW</b></div>${Yi(aT, "neutral", "next")}`),
              a("modal-actions").before(y),
              this.replay ||
                this.buttons([
                  {
                    label: "CONTINUE AS DECKARD / NOODLE ROW",
                    primary: !0,
                    on: () => this.loadScene(h("noodles"), { reset: !0 }),
                  },
                ]));
          } else {
            let y = a("modal-title");
            y.textContent = "Above the city, before the case.";
          }
        }),
        (f.districtTalk = function (u) {
          if ((g.districtTalk.call(this, u), this.overlay !== "district-talk" || this.districtConversation?.id !== u))
            return;
          let p = H3(u, this.state.opening);
          p &&
            ((this.districtConversation.text = p.text + " " + this.districtConversation.text),
            (this.districtConversation.player =
              p.kind === "recognition"
                ? "We met on the transfer deck."
                : "That is a shift report about Holden. I was not at that interview."),
            this.districtRenderTalk());
        }),
        (f.districtRenderTalk = function () {
          if ((g.districtRenderTalk.call(this), this.overlay !== "district-talk")) return;
          let u = H3(this.districtConversation?.id, this.state.opening);
          if (u) {
            let p = document.createElement("div");
            ((p.className = "opening-return-note"),
              (p.id = "opening-return-note"),
              (p.innerHTML = `<b>${e(u.title)}</b><p>${u.kind === "recognition" ? "A personal memory from your earlier conversation." : "A public handoff about another officer. This is not Deckard\u2019s personal memory."}</p>`),
              a("modal").querySelector(".character-trait")?.after(p));
          }
        }),
        (f.about = function () {
          (g.about.call(this),
            (a("modal-title").textContent = "Electric Sheepish: Before the Rain."),
            (a("modal").querySelector(".modal-kicker").textContent = "VERSION 5.0 / BEFORE THE RAIN"));
          let u = document.createElement("p");
          ((u.className = "modal-body"),
            (u.textContent =
              "Two bespoke prologue areas precede Noodle Row. Six connected spaces in each, sixteen local characters, eight optional favours, twenty-four notices, and eighty-four background people. Eight locals have later shifts in Noodle Row. Holden and Deckard keep separate memories. This is original connective material, not a new claim of screenplay fidelity."),
            a("modal-actions").before(u));
        }),
        (f.expandedGuide = function () {
          (g.expandedGuide.call(this),
            (a("modal").querySelector(".modal-kicker").textContent = "FIELD GUIDE / VERSION 5.0"));
          let u = document.createElement("section");
          ((u.className = "guide-section"),
            (u.innerHTML =
              "<h3>BEFORE THE RAIN / PROLOGUE</h3><p>Begin the Night starts at the transfer deck. B opens the prologue map. Walk to a person or notice. E or TAP opens it. Each local favour has three stages: speak, do the work, then report back. Four favours belong to each viewpoint.</p><p>Green case leads are still required. The optional public-radio repair does not replace police-channel calibration. Work on the waiting-room fan does not replace the optical baseline.</p><p>Eight people work later shifts in Noodle Row. Four can remember meeting Deckard. Four met Holden; they can pass on public work reports but cannot remember meeting Deckard there.</p><p>Confirm Leon\u2019s interview when you are ready. Its successful conclusion ends Holden\u2019s viewpoint. The next scene is Deckard at Noodle Row. All added dialogue and environmental lore are original adaptation material.</p>"),
            a("journal-content")?.prepend(u));
        }));
    }
    return { openingPath: r, installOpeningSystems: n };
  })(),
  V = (a) => document.getElementById(a),
  Pt = (a) =>
    String(a ?? "").replace(
      /[&<>"']/g,
      (e) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[e],
    ),
  yt = (a, e, t) => Math.max(e, Math.min(t, a)),
  yd = (a) => JSON.parse(JSON.stringify(a)),
  $_ = "electric-sheepish.save.v5",
  J3 = "electric-sheepish.settings.v1",
  cT = (a = "final") => ({
    version: 5,
    opening: nT(null),
    district: oT(null),
    startedAtDistrict: !1,
    life: Q3(null, bd),
    cut: a,
    scene: Qr(Of[a][0]),
    sceneKey: Of[a][0],
    step: 0,
    beats: [],
    optional: [],
    inventory: [],
    rewarded: [],
    sidequests: [],
    history: [],
    completed: [],
    unlocked: 0,
    xp: 0,
    empathy: 0,
    insight: 0,
    pressure: 0,
    upgrades: { focus: 0, resolve: 0, footwork: 0 },
    health: 100,
    deaths: 0,
    shots: 0,
    playtime: 0,
    finished: !1,
    clues: {},
    deductions: [],
    testimony: [],
    trust: {},
    notes: "",
    visited: [],
    ending: null,
  }),
  q_ = (a, e = 1e3) => (Array.isArray(a) ? a.filter((t) => typeof t == "string" && t.length < 250).slice(0, e) : []);
function rT(a) {
  if (!a || typeof a != "object" || ![1, 2, 3, 4, 5].includes(a.version))
    throw Error("This is not a supported Electric Sheepish save.");
  let e = a.version === 1,
    t = e ? "draft" : Of[a.cut] ? a.cut : "final",
    s = cT(t),
    i = Of[t];
  ((s.opening = nT(a.opening)),
    (s.life = Q3(a.life, bd)),
    (s.district = oT(a.district, a)),
    (s.startedAtDistrict = a.startedAtDistrict === !0));
  for (let c of ["xp", "empathy", "insight", "pressure", "health", "deaths", "shots", "playtime"])
    Number.isFinite(a[c]) && (s[c] = Math.max(0, Math.min(1e6, a[c])));
  let r = e ? j3[Math.floor(a.scene) || 0] : a.sceneKey || Ve[a.scene]?.key;
  ((s.scene = Qr(i.includes(r) ? r : i[0])), (s.sceneKey = Ve[s.scene].key));
  for (let c of ["optional", "inventory", "rewarded", "sidequests", "deductions", "visited"])
    s[c] = [...new Set(q_(a[c]))];
  s.beats = e ? [] : q_(a.beats).filter((c) => Ve[s.scene].steps.some((h) => h.id === c));
  let n = !0;
  for (; n; )
    ((n = !1),
      (s.beats = s.beats.filter((c) => {
        let d = Ve[s.scene].steps.find((f) => f.id === c).requires.every((f) => s.beats.includes(f));
        return (d || (n = !0), d);
      })));
  ((s.step = Ve[s.scene].steps.findIndex((c) => !s.beats.includes(c.id))),
    s.step < 0 && (s.step = Ve[s.scene].steps.length),
    (s.optional = s.optional.filter((c) => Ve[s.scene].optional.some((h) => h.id === c))),
    (s.completed = e
      ? []
      : Array.isArray(a.completed)
        ? [...new Set(a.completed.filter((c) => Number.isInteger(c) && i.includes(Ve[c]?.key)))]
        : []),
    (s.unlocked = Math.max(s.scene, ...s.completed, 0)),
    (s.history = Array.isArray(a.history)
      ? a.history
          .filter((c) => c && typeof c.label == "string" && Number.isInteger(c.scene))
          .slice(-500)
          .map((c) => ({
            scene: e ? Qr(j3[c.scene] || i[0]) : yt(c.scene, 0, Ve.length - 1),
            label: c.label.slice(0, 200),
            text: String(c.text || "").slice(0, 700),
          }))
      : []));
  for (let c of Object.keys(s.upgrades)) s.upgrades[c] = yt(Math.floor(Number(a.upgrades?.[c]) || 0), 0, 4);
  let o = Math.floor(s.xp / 180);
  if (
    (Object.values(s.upgrades).reduce((c, h) => c + h, 0) > o && (s.upgrades = { focus: 0, resolve: 0, footwork: 0 }),
    (s.health = yt(s.health, 1, 100 + s.upgrades.resolve * 15)),
    (s.notes = typeof a.notes == "string" ? a.notes.slice(0, 12e3) : ""),
    !e && a.clues && typeof a.clues == "object")
  )
    for (let [c, h] of Object.entries(a.clues).slice(0, 500))
      c.length < 150 && !["__proto__", "constructor", "prototype"].includes(c) && (s.clues[c] = q_(h, 20));
  if (!e && a.trust && typeof a.trust == "object")
    for (let [c, h] of Object.entries(a.trust).slice(0, 60))
      !["__proto__", "constructor", "prototype"].includes(c) &&
        Number.isFinite(h) &&
        (s.trust[c.slice(0, 100)] = yt(h, -100, 100));
  if (
    ((s.testimony = Array.isArray(a.testimony)
      ? a.testimony
          .filter((c) => c && typeof c.who == "string" && typeof c.text == "string")
          .slice(-300)
          .map((c) => ({
            who: c.who.slice(0, 100),
            text: c.text.slice(0, 700),
            topic: String(c.topic || "").slice(0, 120),
            scene: String(c.scene || "").slice(0, 120),
          }))
      : []),
    (s.finished = !!(a.finished && !e && s.completed.includes(Qr(i.at(-1))))),
    (s.ending = s.finished ? t : null),
    e)
  ) {
    let c = s.sceneKey,
      h = i.indexOf(c),
      d = !0;
    for (; d; ) {
      d = !1;
      let f = new Set(s.inventory),
        g = h;
      for (let u of i.slice(h))
        for (let p of Ve[Qr(u)].steps) {
          if (p.kind === "deduce") {
            for (let m of p.evidence)
              if (!f.has(m)) {
                let y = i.findIndex((b) => Ve[Qr(b)].steps.some((x) => x.item === m));
                y >= 0 && y < g && (g = y);
              }
          }
          p.item && f.add(p.item);
        }
      g < h && ((h = g), (d = !0));
    }
    ((s.sceneKey = i[h]),
      (s.scene = Qr(s.sceneKey)),
      (s.step = 0),
      (s.beats = []),
      (s.optional = []),
      (s.migratedFrom = 1),
      s.history.push({
        scene: s.scene,
        label: "Version 1 case imported",
        text:
          "Inventory and training are preserved. " +
          (c === s.sceneKey
            ? "The route resumes at the corresponding chapter."
            : "The route returns to " + Ve[s.scene].title + " to collect new evidence needed later.") +
          " New scenes are not marked complete.",
      }));
  }
  return s;
}
/**
 * The HUD is refreshed every frame. These write an element's markup or text only when it
 * actually changed, so a player standing still (reading, looking around a room) costs no
 * DOM work at all. Every writer of an element must go through the same helper.
 */
function setHTML(a, e) {
  a && a.__html !== e && ((a.__html = e), (a.innerHTML = e));
}
function setText(a, e) {
  a && a.__text !== e && ((a.__text = e), (a.textContent = e));
}
var Al = class {
  constructor(kit) {
    // Graphics quality, look speed and invert-Y live in the kit's shared settings panel now.
    ((this.kit = kit),
      (this.input = kit.input),
      (this.canvas = kit.canvas),
      (this.audio = new fX()),
      (this.prefs = {
        sound: !0,
        reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
        assist: !0,
      }));
    try {
      let e = JSON.parse(localStorage.getItem(J3));
      if (e && typeof e == "object")
        for (let t of ["sound", "reducedMotion", "assist", "captions", "detailHints"])
          typeof e[t] == "boolean" && (this.prefs[t] = e[t]);
    } catch {}
    this.saved = null;
    try {
      let e =
        localStorage.getItem($_) ||
        localStorage.getItem("electric-sheepish.save.v4") ||
        localStorage.getItem("electric-sheepish.save.v3") ||
        localStorage.getItem("electric-sheepish.save.v2") ||
        localStorage.getItem("electric-sheepish.save.v1");
      e && (this.saved = rT(JSON.parse(e)));
    } catch {
      this.storageWarning =
        "Local saves are unavailable or unreadable. You can still play; export your case from Settings to keep it.";
    }
    ((this.state = this.saved ? yd(this.saved) : cT()),
      (this.inGame = !1),
      (this.overlay = null),
      (this.mini = null),
      (this.encounter = null),
      (this.scanTime = 0),
      (this.scanCooldown = 0),
      (this.shotCooldown = 0),
      (this.reloadTime = 0),
      (this.ammo = 6),
      (this.toastTime = 0),
      (this.autoTime = 0),
      (this.hitTime = 0),
      (this.simTime = 0),
      (this.hudTime = 0),
      (this.mobile = matchMedia("(pointer:coarse)").matches || innerWidth < 760),
      (this.cam = { x: 1.5, y: 2.15, z: 15, yaw: 0.08, pitch: 0.03 }),
      (this.replay = !1),
      (this.lastFocus = null),
      (this.modalToken = 0),
      (this.sprintToggle = !1),
      (this.crouchToggle = !1),
      (this.nav = { dir: "", next: 0 }),
      (this.hintSource = null),
      (this.touchHidden = null),
      (this.renderer = new Z3(kit)),
      (this.world = new wl(
        Ve.find((e) => e.key === "noodles"),
        !0,
      )),
      this.renderer.setWorld(this.world),
      this.applyPrefs(),
      this.bind(),
      this.showMenu(),
      this.refreshRenderLabel(),
      kit.onQuality(() => this.refreshRenderLabel()),
      kit.onPause((e) => this.audio.suspend(e)),
      this.storageWarning && setTimeout(() => this.toast(this.storageWarning), 500),
      kit.start((e) => this.loop(e)));
  }
  /** The game's own quality words, which its crowd and prop animation still read. */
  get gfxQuality() {
    let e = this.kit.tier.name;
    return e === "low" ? "performance" : e === "ultra" ? "cinematic" : "balanced";
  }
  get scene() {
    let e = Ve[this.state.scene],
      t = e.variants?.[this.state.cut];
    return t ? { ...e, ...t, steps: e.steps.map((s) => ({ ...s, ...t.stepOverrides?.[s.id] })) } : e;
  }
  get maxHealth() {
    return 100 + this.state.upgrades.resolve * 15;
  }
  get points() {
    return Math.max(0, Math.floor(this.state.xp / 180) - Object.values(this.state.upgrades).reduce((e, t) => e + t, 0));
  }
  applyPrefs() {
    (this.audio.setEnabled(this.prefs.sound),
      document.body.classList.toggle("reduced-motion", this.prefs.reducedMotion),
      (V("sound-button").textContent = this.prefs.sound ? "\u266A" : "\u2669"),
      V("sound-button").setAttribute("aria-pressed", String(this.prefs.sound)));
  }
  savePrefs() {
    try {
      localStorage.setItem(J3, JSON.stringify(this.prefs));
    } catch {}
    this.applyPrefs();
  }
  refreshRenderLabel() {
    let e = this.renderer.label;
    ((V("menu-renderer").textContent = e + " / LIVE"),
      (V("renderer-badge").textContent = e + " \xB7 " + this.kit.tier.name.toUpperCase()));
  }
  bind() {
    ((V("start").onclick = () => {
      (this.audio.start(), this.saved ? this.confirmNew() : this.newGame());
    }),
      (V("continue").onclick = () => {
        (this.audio.start(), this.resume());
      }),
      (V("menu-settings").onclick = () => this.settings()),
      (V("menu-casebook").onclick = () => this.journal("scenes")),
      (V("menu-about").onclick = () => this.about()),
      (V("journal-button").onclick = () => this.journal()),
      (V("pause-button").onclick = () => this.pause()),
      (V("sound-button").onclick = () => this.toggleSound()),
      (V("interact-prompt").onclick = () => (this.encounter ? this.action() : this.interact())));
    for (let t of ["journal-button", "pause-button", "sound-button", "interact-prompt"]) {
      let s = V(t),
        i = s.onclick,
        r = -1 / 0;
      (s.addEventListener("pointerdown", (n) => {
        n.pointerType === "touch" && !s.disabled && (n.preventDefault(), (r = performance.now()), i(n));
      }),
        (s.onclick = (n) => {
          performance.now() - r > 600 && i(n);
        }));
    }
    (window.addEventListener("resize", () => {
      this.mobile = matchMedia("(pointer:coarse)").matches || innerWidth < 760;
    }),
      window.addEventListener("blur", () => {
        (this.clearInput(), this.inGame && !this.overlay && this.pause());
      }),
      document.addEventListener("visibilitychange", () => {
        // The rain and room tone stop with the tab, and come back with it.
        (this.audio.suspend(document.hidden || this.kit.paused),
          document.hidden && (this.clearInput(), this.save(), this.inGame && !this.overlay && this.pause()));
      }),
      // Browsers only let sound start from a key, click or touch, never from a controller button.
      // If the night began from a controller, the first such gesture brings the soundscape in.
      ["pointerdown", "keydown"].forEach((t) =>
        window.addEventListener(t, () => this.inGame && !this.kit.paused && this.audio.start().catch(() => {}), !0),
      ),
      // Mouse-look: a click on the world asks for pointer lock; the kit reads the movement.
      this.canvas.addEventListener("click", (t) => {
        this.inGame &&
          !this.overlay &&
          t.pointerType !== "touch" &&
          !this.input.pointerLocked &&
          this.input.lockPointer();
      }),
      // Browsers only start audio after a gesture; any touch or click on the world counts.
      this.canvas.addEventListener("pointerdown", () => {
        this.inGame && !this.overlay && this.audio.start();
      }),
      (V("import-save").onchange = (t) => this.importSave(t.target.files?.[0])),
      window.addEventListener("beforeunload", () => this.save()));
  }
  /** Held keys and buttons count as already held, so a press that closed a panel does not also act in the world. */
  clearInput() {
    this.input.settle();
  }
  setSprint(e) {
    ((this.sprintToggle = !!e), this.kit.touch?.button("runToggle")?.classList.toggle("is-on", !!e));
  }
  setCrouch(e) {
    ((this.crouchToggle = !!e), this.kit.touch?.button("crouchToggle")?.classList.toggle("is-on", !!e));
  }
  /** The button to show in a prompt, for the device in use: a key, a controller button, or the touch ACT button. */
  keyHint(e) {
    let t = this.input.source;
    return t === "touch" ? "ACT" : t === "gamepad" ? (e === "C" ? "B" : "A") : e;
  }
  refreshHints() {
    let e = this.input.source;
    V("move-hint").innerHTML =
      e === "gamepad"
        ? "L-STICK move &nbsp; \xB7 &nbsp; R-STICK look &nbsp; \xB7 &nbsp; Y scan &nbsp; \xB7 &nbsp; START pause"
        : e === "touch"
          ? ""
          : "W A S D move &nbsp; \xB7 &nbsp; mouse look &nbsp; \xB7 &nbsp; Q scan";
  }
  /**
   * Every device reaches the game through the kit's actions (keyboard and mouse, gamepad,
   * touch). Menus and dialogs take the same actions: move or the D-pad walks the focus, A or
   * Enter presses, B / Esc / Start closes, Tab cycles.
   */
  pollInput(e) {
    let t = this.input,
      s = !this.inGame || !!this.overlay;
    if (
      (s !== this.touchHidden && ((this.touchHidden = s), this.kit.touch?.suspend(s, "game")),
      t.source !== this.hintSource && ((this.hintSource = t.source), this.refreshHints()),
      this.overlay)
    )
      return this.menuInput(V("modal"));
    if (!this.inGame) return this.menuInput(V("menu"));
    if (t.pressed("pause")) return this.pause();
    if (t.pressed("journal")) return this.journal();
    if (t.pressed("map")) return this.journal("map");
    if (t.pressed("district")) return this.districtJournal("map");
    if (t.pressed("life")) return this.journal("life");
    (t.pointer.justDown && t.pointer.type === "mouse" && t.pointerLocked && (this.encounter ? this.action() : this.interact()),
      t.pressed("interact") && this.interact(),
      t.pressed("action") && this.action(),
      t.pressed("scan") && this.scan(),
      t.pressed("reload") && this.reload(),
      !this.overlay && t.pressed("runToggle") && this.setSprint(!this.sprintToggle),
      !this.overlay &&
        t.pressed("crouchToggle") &&
        (this.encounter?.mode === "stealth" ? this.action() : this.setCrouch(!this.crouchToggle)));
  }
  menuInput(e) {
    let t = this.input;
    if (this.overlay) {
      if (this.mini?.kind === "timing" && (t.pressed("action") || t.pressed("confirm"))) return this.mini.lock();
      if (t.pressed("pause") || t.pressed("back")) return V("modal").querySelector(".close")?.click();
      for (let i = 1; i <= 4; i++)
        if (t.pressed("choice" + i))
          return this.mini?.kind === "memory"
            ? this.mini.press(i - 1)
            : V("modal").querySelectorAll(".choice")[i - 1]?.click();
      // The right stick scrolls long pages (casebook, guide).
      let i = t.look("look").y;
      Math.abs(i) > 1e-4 && t.source === "gamepad" && (e.scrollTop += i * 700);
    }
    if (t.pressed("journal")) return this.focusStep(e, t.down("sprint") ? -1 : 1);
    let s = this.navDirection();
    if (s) return this.focusMove(e, s);
    // With a controller, a panel that just opened gets its main button focused (without scrolling
    // away from the text at the top), so the first A press already answers it.
    t.pressed("confirm")
      ? this.activate(e)
      : t.source === "gamepad" &&
        (!e.contains(document.activeElement) || document.activeElement === e) &&
        this.focusFirst(e, !1);
  }
  /** Stick, D-pad or keys as one step per press, repeating while held. */
  navDirection() {
    let e = this.input.vector("move"),
      t = e.x - this.input.value("turn"),
      s = e.y,
      i =
        Math.max(Math.abs(t), Math.abs(s)) < 0.5
          ? ""
          : Math.abs(t) > Math.abs(s)
            ? t > 0
              ? "right"
              : "left"
            : s > 0
              ? "up"
              : "down",
      r = performance.now();
    return i
      ? i !== this.nav.dir
        ? ((this.nav.dir = i), (this.nav.next = r + 380), (this.nav.repeats = 0), i)
        : r >= this.nav.next
          ? ((this.nav.next = r + 140), this.nav.repeats++, i)
          : ""
      : ((this.nav.dir = ""), "");
  }
  focusables(e) {
    return [
      ...e.querySelectorAll('button, a[href]:not([href="#"]), input, select, textarea, summary, [tabindex="0"]'),
    ].filter((t) => !t.disabled && !t.closest("[hidden]") && t.getClientRects().length > 0);
  }
  focusEl(e, t = !0) {
    (document.querySelector(".pad-focus")?.classList.remove("pad-focus"),
      e.focus({ focusVisible: !0, preventScroll: !t }),
      e.classList.add("pad-focus"),
      e.addEventListener("blur", () => e.classList.remove("pad-focus"), { once: !0 }),
      t && e.scrollIntoView?.({ block: "nearest" }));
  }
  focusFirst(e, t = !0) {
    let s = this.focusables(e),
      i =
        s.find((r) => r.classList.contains("primary")) ||
        s.find((r) => !r.classList.contains("close") && !r.closest(".tabs")) ||
        s[0];
    i && this.focusEl(i, t);
  }
  focusStep(e, t) {
    let s = this.focusables(e),
      i = s.indexOf(document.activeElement);
    s.length && this.focusEl(s[i < 0 ? (t > 0 ? 0 : s.length - 1) : (i + t + s.length) % s.length]);
  }
  /** Move the focus to the nearest control in that direction (grids, rows and lists alike). */
  focusMove(e, t) {
    let s = this.focusables(e),
      i = document.activeElement;
    if (!s.includes(i)) return this.focusFirst(e);
    let r = t === "left" ? -1 : t === "right" ? 1 : 0,
      n = t === "up" ? -1 : t === "down" ? 1 : 0;
    if (r && i.type === "range")
      // Held left/right speeds up, so a dial can cross its whole range in a couple of seconds.
      return (
        r > 0 ? i.stepUp(this.nav.repeats > 4 ? 3 : 1) : i.stepDown(this.nav.repeats > 4 ? 3 : 1),
        i.dispatchEvent(new Event("input", { bubbles: !0 })),
        i.dispatchEvent(new Event("change", { bubbles: !0 }))
      );
    let o = i.getBoundingClientRect(),
      l = o.left + o.width / 2,
      c = o.top + o.height / 2,
      h = null,
      d = 1 / 0;
    for (let f of s) {
      if (f === i) continue;
      let g = f.getBoundingClientRect(),
        u = g.left + g.width / 2 - l,
        p = g.top + g.height / 2 - c,
        m = r ? u * r : p * n,
        y = r ? Math.abs(p) : Math.abs(u);
      if (m <= 4) continue;
      let b = m + y * 2.2;
      b < d && ((d = b), (h = f));
    }
    h ? this.focusEl(h) : n && this.focusStep(e, n);
  }
  activate(e) {
    let t = document.activeElement;
    if (!t || t === e || !e.contains(t)) return this.focusFirst(e);
    if (
      /^(TEXTAREA|SELECT)$/.test(t.tagName) ||
      (t.tagName === "INPUT" && !/^(checkbox|radio|button|submit)$/.test(t.type))
    )
      return;
    // Many panels redraw the control that was just pressed (chess squares, sequence steps, witness
    // topics, evidence marks). Keep the controller's place: focus the redrawn control, or the next
    // enabled one of the same kind.
    let s = t.id ? `#${CSS.escape(t.id)}` : "",
      i = [...t.attributes].find((r) => r.name.startsWith("data-") && r.name !== "data-setting"),
      r = i ? `[${i.name}="${CSS.escape(i.value)}"]` : "";
    if ((typeof t.click == "function" ? t.click() : t.dispatchEvent(new MouseEvent("click", { bubbles: !0 })), t.isConnected))
      return;
    let n = V("modal-layer").hidden ? V("menu") : V("modal"),
      o =
        (s && n.querySelector(s + ":not(:disabled)")) ||
        (r && n.querySelector(r + ":not(:disabled)")) ||
        (i && n.querySelector(`[${i.name}]:not(:disabled)`));
    o && this.focusables(n).includes(o) && this.focusEl(o);
  }
  toggleSound() {
    (this.audio.start(),
      (this.prefs.sound = !this.prefs.sound),
      this.savePrefs(),
      this.toast(this.prefs.sound ? "Original soundscape on." : "Sound muted."));
  }
  toast(e) {
    ((V("toast").textContent = e), V("toast").classList.add("visible"), (this.toastTime = 4.5));
  }
  save(e = !1) {
    if (!(this.replay || (!this.inGame && !e)))
      try {
        (localStorage.setItem($_, JSON.stringify(this.state)),
          (this.saved = yd(this.state)),
          (V("autosave").textContent = "\u25CF CHECKPOINT SAVED"),
          (this.autoTime = 2.5));
      } catch {
        V("autosave").textContent = "SAVE UNAVAILABLE \xB7 EXPORT FROM SETTINGS";
      }
  }
  confirmNew() {
    (this.showModal(
      "New case?",
      "Starting over replaces the current autosave. Export it from Settings to keep a copy.",
      "CONFIRM / NEW NIGHT",
      "confirm",
    ),
      this.buttons([
        { label: "START A NEW NIGHT", primary: !0, on: () => this.newGame() },
        { label: "KEEP MY CURRENT CASE", on: () => this.closeModal() },
      ]));
  }
  newGame() {
    this.chooseRoute();
  }
  resume() {
    if (this.saved) {
      if (((this.replay = !1), (this.state = rT(yd(this.saved))), this.state.finished)) {
        this.showCredits();
        return;
      }
      this.loadScene(this.state.scene, { reset: !1 });
    }
  }
  showMenu() {
    ((this.inGame = !1),
      (this.encounter = null),
      this.closeModal(),
      (V("menu").hidden = !1),
      (V("hud").hidden = !0),
      this.clearInput(),
      document.exitPointerLock?.(),
      (this.world = new wl(
        Ve.find((e) => e.key === "noodles"),
        !0,
      )),
      this.renderer.setWorld(this.world),
      (this.cam = { x: 1.5, y: 2.1, z: 15, yaw: 0.08, pitch: 0.02 }),
      (V("continue").hidden = !this.saved),
      (V("continue").innerHTML = this.saved?.finished
        ? "REVIEW COMPLETED CASE <span>\u2192</span>"
        : "CONTINUE CASE <span>\u2192</span>"),
      (V("start").innerHTML = (this.saved ? "NEW NIGHT" : "BEGIN THE NIGHT") + " <span>\u2197</span>"));
  }
  loadScene(e, { reset: t = !0, brief: s = !0 } = {}) {
    ((this.inGame = !0),
      (this.encounter = null),
      (this.mini = null),
      (this.state.scene = e),
      (this.state.sceneKey = Ve[e].key),
      (this.state.unlocked = Math.max(this.state.unlocked, e)),
      t &&
        ((this.state.step = 0),
        (this.state.beats = []),
        (this.state.optional = []),
        (this.state.health = this.maxHealth)),
      (this.state.health = Math.max(55, this.state.health)),
      (this.ammo = 6),
      (this.reloadTime = 0),
      (this.shotCooldown = 0),
      (this.scanTime = 0),
      (this.scanCooldown = 0),
      this.setSprint(!1),
      this.clearInput(),
      (this.world = new wl(this.scene)),
      this.renderer.setWorld(this.world),
      (this.cam = { x: 0, y: 1.72, z: 12, yaw: 0, pitch: 0 }),
      this.audio.indoors(!this.world.outside),
      (V("menu").hidden = !0),
      (V("hud").hidden = !1),
      (V("weapon").hidden = !0),
      (V("car-hood").hidden = !0),
      (V("encounter-bar").hidden = !0),
      this.updateHUD(),
      this.save(),
      s
        ? (this.showModal(this.scene.title, this.scene.intro, `${this.scene.case} / ${this.scene.place}`, "intro"),
          V("modal-actions").insertAdjacentHTML(
            "beforebegin",
            `<div class="scene-stamp"><b>${this.scene.number}</b><span>OF ${Ve.length} SCENES<br><br>FIRST-PERSON / ${Pt(this.scene.role.toUpperCase())} / ${this.scene.time}</span></div><details class="anchor"><summary>REVEAL FIXED SCENE ENDPOINT \xB7 SPOILERS</summary><p>${Pt(this.scene.anchor)}</p></details>`,
          ),
          this.buttons([
            {
              label: this.replay ? "ENTER REPLAY" : "ENTER SCENE",
              primary: !0,
              on: () => {
                (this.closeModal(),
                  this.toast(
                    e === 0
                      ? this.input.source === "gamepad"
                        ? "Walk to the green marker. A interacts. Y scans nearby evidence. Start pauses."
                        : this.input.source === "touch"
                          ? "Walk to the green marker. ACT or the prompt interacts. SCAN finds nearby evidence."
                          : "Walk to the green marker. E interacts. Q scans nearby evidence."
                      : "Your route can change. The scene\u2019s destination cannot.",
                  ));
              },
            },
          ]))
        : this.closeModal());
  }
  showModal(e, t, s = "", i = "dialog", { wide: r = !1, close: n = !0 } = {}) {
    ((this.toastTime = 0),
      V("toast").classList.remove("visible"),
      (this.overlay = i),
      (this.modalTouchGuard = performance.now() - (this.lastTouchAt ?? -1 / 0) < 120 ? performance.now() + 350 : 0),
      (this.mini = null),
      this.modalToken++,
      this.clearInput(),
      document.pointerLockElement && document.exitPointerLock(),
      (this.lastFocus = document.activeElement),
      (V("modal-layer").hidden = !1),
      (V("modal").className = r ? "wide" : ""),
      (V("modal").innerHTML =
        `${n ? '<button class="close" aria-label="Close dialog">\xD7</button>' : ""}<div class="modal-kicker">${Pt(s)}</div><h2 class="modal-title" id="modal-title">${Pt(e)}</h2>${t ? `<div class="modal-body">${Pt(t)}</div>` : ""}<div class="modal-actions" id="modal-actions"></div>`),
      V("modal")
        .querySelector(".close")
        ?.addEventListener("click", () => this.closeModal()),
      (V("modal").scrollTop = 0),
      setTimeout(() => V("modal").focus(), 0));
  }
  closeModal() {
    ((this.overlay = null), (this.mini = null), this.modalToken++, (V("modal-layer").hidden = !0), this.clearInput());
  }
  buttons(e) {
    let t = V("modal-actions");
    (t ||
      ((t = document.createElement("div")),
      (t.className = "modal-actions"),
      (t.id = "modal-actions"),
      V("modal").append(t)),
      (t.innerHTML = ""));
    for (let [s, i] of e.entries()) {
      let r = document.createElement("button");
      ((r.className = i.primary ? "primary" : i.danger ? "secondary danger" : i.choice ? "choice" : "secondary"),
        (r.innerHTML = i.choice
          ? `<span class="choice-n">0${s + 1}</span><span>${Pt(i.label)}</span>`
          : `${Pt(i.label)}${i.primary ? "<span>\u2192</span>" : ""}`),
        i.disabled && (r.disabled = !0),
        (r.onclick = () => {
          (this.audio.click(), i.on());
        }),
        t.appendChild(r));
    }
  }
  interlude(e, t, s = {}) {
    (this.showModal(
      t.label,
      "",
      t.optional ? "SIDE CASE / " + (t.quest || "OPTIONAL") : "FIELD RECORD / " + this.scene.role.toUpperCase(),
      "result",
    ),
      V("modal-actions").insertAdjacentHTML(
        "beforebegin",
        `<p class="quote-result">${Pt(e)}</p>${t.item ? `<div class="item-strip"><div class="item-icon">\u25C7</div><div><span>EVIDENCE / ITEM</span><strong>${Pt(t.item)}</strong></div></div>` : ""}`,
      ),
      this.buttons([
        { label: t.optional ? "CLOSE SIDE CASE" : "LOG & CONTINUE", primary: !0, on: () => this.finishNode(t, s) },
      ]));
  }
  activeSpots() {
    return this.encounter
      ? []
      : [
          this.state.step < this.scene.steps.length
            ? this.world.hotspots.find((t) => t.id === this.scene.steps[this.state.step].id)
            : this.world.exit,
          ...this.world.hotspots.filter((t) => t.optional && !this.state.optional.includes(t.id)),
        ].filter(Boolean);
  }
  interact() {
    if (!this.inGame || this.overlay) return;
    if (this.encounter) {
      this.action();
      return;
    }
    let e = this.nearby;
    if (!e) {
      this.toast("Move closer to the green marker and face it. Q or SCAN reveals nearby side cases.");
      return;
    }
    if (e.exit) {
      this.finishScene();
      return;
    }
    this.openNode(e.step);
  }
  openNode(e) {
    if (e.kind === "combat" || e.kind === "drive") {
      this.combatBrief(e);
      return;
    }
    if (["vk", "timing", "circuit", "focus", "esper", "chess", "memory"].includes(e.kind)) {
      this.puzzle(e);
      return;
    }
    e.options?.length
      ? (this.showModal(
          e.label,
          e.text,
          e.optional ? "OPTIONAL / " + (e.quest || "SIDE CASE") : this.scene.role.toUpperCase() + " / CONVERSATION",
          "dialog",
        ),
        this.buttons(
          e.options.map((t) => ({ label: t.label, choice: !0, on: () => this.interlude(t.text, e, t.effect) })),
        ))
      : this.interlude(e.text, e);
  }
  finishNode(e, t = {}) {
    let s = this.scene.key + ":" + e.id;
    if (!this.state.rewarded.includes(s)) {
      this.state.rewarded.push(s);
      let i = Math.floor(this.state.xp / 180);
      this.state.xp += e.optional ? 45 : 35;
      for (let r of ["empathy", "insight", "pressure"]) this.state[r] += Number(t[r]) || 0;
      ((this.state.health = yt(this.state.health + (t.health || 0) + (e.heal || 0), 1, this.maxHealth)),
        e.item && !this.state.inventory.includes(e.item) && this.state.inventory.push(e.item),
        e.optional && e.quest && !this.state.sidequests.includes(e.quest) && this.state.sidequests.push(e.quest),
        e.options?.length &&
          this.state.history.push({
            scene: this.state.scene,
            label: e.label,
            text: e.options.find((r) => r.effect === t)?.label || "Recorded without pressure.",
          }),
        Math.floor(this.state.xp / 180) > i
          ? this.toast("FIELD RANK INCREASED \xB7 Spend a training point in the casebook.")
          : this.toast(e.optional ? "SIDE CASE COMPLETE \xB7 +45 XP" : "EVIDENCE LOGGED \xB7 +35 XP"),
        this.audio.evidence(),
        this.input.rumble(0.2, 60));
    }
    (e.optional
      ? this.state.optional.includes(e.id) || this.state.optional.push(e.id)
      : (this.state.beats.includes(e.id) || this.state.beats.push(e.id),
        (this.state.step = this.scene.steps.findIndex((i) => !this.state.beats.includes(i.id))),
        this.state.step < 0 && (this.state.step = this.scene.steps.length)),
      this.closeModal(),
      this.updateHUD(),
      this.save(),
      this.scene.key === this.route.at(-1) && this.state.step === this.scene.steps.length && this.finishScene());
  }
  finishScene() {
    if (
      (this.state.completed.includes(this.state.scene) || this.state.completed.push(this.state.scene),
      (this.state.unlocked = Math.max(this.state.unlocked, Math.min(Ve.length - 1, this.state.scene + 1))),
      this.save(),
      this.state.scene === Ve.length - 1 && !this.replay)
    ) {
      ((this.state.finished = !0), this.save(), this.showCredits());
      return;
    }
    this.showModal(
      "Scene resolved",
      this.scene.anchor,
      `CASE RECORD / ${this.scene.number} OF ${Ve.length}`,
      "resolved",
      { close: !1 },
    );
    let e = this.scene.optional.length - this.state.optional.length;
    (V("modal-actions").insertAdjacentHTML(
      "beforebegin",
      `<div class="item-strip"><div class="item-icon">\u2713</div><div><span>FIXED ENDPOINT REACHED</span><strong>${Pt(this.scene.title)}</strong></div></div><p class="tiny" style="margin-bottom:22px">${this.state.optional.length} / ${this.scene.optional.length} OPTIONAL LEADS RECORDED${e ? " \xB7 You can return before continuing." : ""}</p>`,
    ),
      this.replay
        ? this.buttons([
            {
              label: "RETURN FROM REPLAY",
              primary: !0,
              on: () => {
                ((this.state = this.replayBackup), (this.replay = !1), this.showMenu());
              },
            },
          ])
        : this.buttons([
            { label: "NEXT SCENE", primary: !0, on: () => this.loadScene(this.state.scene + 1, { reset: !0 }) },
            { label: "RETURN TO THIS SCENE", on: () => this.closeModal() },
          ]));
  }
  pause() {
    this.inGame &&
      (this.showModal(
        "The city can wait.",
        "Your checkpoint is kept at each completed lead. An interrupted encounter restarts at its opening.",
        this.scene.place,
        "pause",
      ),
      this.save(),
      this.buttons([
        { label: "RESUME THE NIGHT", primary: !0, on: () => this.closeModal() },
        { label: "OPEN CASEBOOK", on: () => this.journal() },
        { label: "CONTROLS", on: () => this.controlsCard() },
        { label: "SETTINGS & SAVE FILE", on: () => this.settings() },
        {
          label: "RESTART THIS SCENE",
          on: () => {
            (this.state.deaths++, this.loadScene(this.state.scene, { reset: !0 }));
          },
        },
        {
          label: "RETURN TO TITLE",
          on: () => {
            (this.save(), this.replay && ((this.state = this.replayBackup), (this.replay = !1)), this.showMenu());
          },
        },
      ]));
  }
  /**
   * The controls for the device in use (keyboard and mouse, controller or touch), with tabs for
   * the other two. Opened from the pause menu.
   */
  controlsCard(e = this.input.source) {
    let t = {
        keyboard: [
          ["Move", "W A S D \xB7 \u2191 \u2193"],
          ["Look", "Mouse (click the world to lock it) \xB7 \u2190 \u2192 turn"],
          ["Interact / talk", "E \xB7 left click while looking"],
          ["Fire \xB7 evade \xB7 act", "F or Space"],
          ["Scan", "Q"],
          ["Run", "Hold Shift"],
          ["Crouch", "Hold C"],
          ["Reload", "R"],
          ["Casebook \xB7 map", "Tab \xB7 M"],
          ["District map \xB7 local notes", "B \xB7 V"],
          ["Dialogue choices", "1 2 3 4"],
          ["Pause \xB7 close panel", "Esc or P"],
          ["Graphics & controls", "F9"],
        ],
        gamepad: [
          ["Move", "Left stick \xB7 D-pad"],
          ["Look", "Right stick"],
          ["Interact \xB7 fire \xB7 evade", "A (or RT)"],
          ["Interact", "X"],
          ["Scan", "Y"],
          ["Run", "Hold LT \xB7 click L-stick to toggle"],
          ["Crouch", "B toggles"],
          ["Reload", "RB"],
          ["Map \xB7 casebook", "LB \xB7 View"],
          ["Pause", "Start"],
          ["Menus", "D-pad moves \xB7 A presses \xB7 B closes \xB7 R-stick scrolls"],
        ],
        touch: [
          ["Move", "Thumb anywhere on the left"],
          ["Look", "Drag the open screen"],
          ["Interact \xB7 fire \xB7 evade", "ACT, or tap the prompt"],
          ["Scan", "SCAN"],
          ["Run \xB7 crouch", "RUN \xB7 CROUCH toggle"],
          ["Casebook \xB7 map \xB7 pause", "The buttons at the top right"],
          ["Layout, size, left-handed", "Settings \u203A Graphics & controls"],
        ],
      },
      s = { keyboard: "KEYBOARD & MOUSE", gamepad: "CONTROLLER", touch: "TOUCH" };
    (t[e] || (e = "keyboard"),
      this.showModal("Controls.", "", "FIELD MANUAL / " + s[e], "controls"),
      V("modal-actions").insertAdjacentHTML(
        "beforebegin",
        `<nav class="tabs controls-tabs" aria-label="Control schemes">${Object.keys(t)
          .map((i) => `<button class="${i === e ? "active" : ""}" data-scheme="${i}">${s[i]}</button>`)
          .join("")}</nav><dl class="controls-list">${t[e].map(([i, r]) => `<div><dt>${Pt(i)}</dt><dd>${Pt(r)}</dd></div>`).join("")}</dl>`,
      ),
      V("modal")
        .querySelectorAll("[data-scheme]")
        .forEach((i) => (i.onclick = () => this.controlsCard(i.dataset.scheme))),
      this.buttons([
        { label: "BACK TO PAUSE", primary: !0, on: () => this.pause() },
        { label: "GRAPHICS & CONTROL SETTINGS", on: () => this.kit.menu.open() },
      ]));
  }
  scan() {
    if (!(!this.inGame || this.overlay)) {
      if (this.scanCooldown > 0) {
        this.toast(`Scanner recharging \xB7 ${Math.ceil(this.scanCooldown)}s`);
        return;
      }
      ((this.scanTime = 4.5),
        (this.scanCooldown = Math.max(
          3,
          10 - this.state.upgrades.focus * 1.5 - (this.state.inventory.includes("Electric sheep") ? 1 : 0),
        )),
        this.audio.scan(),
        this.toast("INFRARED SWEEP \xB7 Green: active lead. Amber: optional evidence."));
    }
  }
  puzzle(e) {
    this.showModal(e.label, e.text, `FIELD INSTRUMENT / ${e.kind.toUpperCase()}`, "puzzle");
    let t = this.modalToken,
      s = (r) => V("modal-actions").insertAdjacentHTML("beforebegin", r),
      i = (
        r = e.result || e.reward || "The reading is clear. The next lead can be entered in the record.",
        n = { insight: 2 },
      ) => this.interlude(r, e, n);
    if (e.kind === "vk") {
      let r = 0,
        n = 56;
      (s(
        '<div class="vk-panel"><div class="eye" aria-hidden="true"></div><div class="vk-readout"><span>IRIS RESPONSE / EMOTIONAL LATENCY</span><progress id="vk-signal" max="100" value="56"></progress><div class="puzzle-status" id="vk-status">SIGNAL STABILITY 56%</div></div></div><div class="vk-question" id="vk-question"></div>',
      ),
        (this.mini = { kind: "vk" }));
      let o = () => {
        ((V("vk-question").textContent = W3[r].prompt),
          (V("vk-status").textContent = `QUESTION ${r + 1} / 3 \xB7 SIGNAL ${n}%`),
          this.buttons(
            W3[r].answers.map((l, c) => ({
              label: l,
              choice: !0,
              on: () => {
                ((n = yt(n + [14, 4, -26][c], 0, 100)),
                  (V("vk-signal").value = n),
                  r++,
                  r < 3
                    ? o()
                    : n < 24
                      ? this.puzzleFailure(
                          e,
                          "The emotional signal is drowned out by pressure. Recalibrate and try a less confrontational line of questioning.",
                        )
                      : i(e.result, { empathy: n > 80 ? 3 : 1, insight: 2 }));
              },
            })),
          ));
      };
      o();
    }
    if (e.kind === "timing") {
      let r = (this.prefs.assist ? 0.08 : 0) + this.state.upgrades.footwork * 0.015,
        n = 0.4 - r,
        o = 0.65 + r;
      (s(
        `<div class="timing-track"><div class="timing-good" style="left:${n * 100}%;width:${(o - n) * 100}%"></div><div class="timing-needle" id="timing-needle"></div></div><div class="puzzle-status">LOCK THE PULSE IN THE GREEN BAND \xB7 TAP OR PRESS SPACE</div>`,
      ),
        (this.mini = {
          kind: "timing",
          elapsed: 0,
          position: 0.05,
          left: n,
          right: o,
          lock: () => {
            let l = this.mini?.position;
            l != null &&
              (l >= n && l <= o
                ? i()
                : this.puzzleFailure(
                    e,
                    "The pulse passed outside the safe window. This beat did not happen in the successful version of the scene. Try again.",
                  ));
          },
        }),
        this.buttons([{ label: "LOCK PULSE", primary: !0, on: () => this.mini?.lock() }]));
    }
    if (e.kind === "circuit") {
      let r = [0, 0, 0],
        n = e.target || [1, 0, 1];
      (s(
        `<div class="target-bits"><span>SERVICE LABEL</span><span>${n.map((o) => (o ? "ON" : "OFF")).join(" / ")}</span></div><div class="circuit-grid">${r.map((o, l) => `<button class="circuit-bit" data-bit="${l}" aria-label="Toggle ${["power", "ground", "signal"][l]}"><b>0</b><small>${["POWER", "GROUND", "SIGNAL"][l]}</small></button>`).join("")}</div><div class="puzzle-status" id="circuit-status">Match the three channels to the service label.</div>`,
      ),
        (this.mini = { kind: "circuit" }),
        V("modal")
          .querySelectorAll("[data-bit]")
          .forEach(
            (o) =>
              (o.onclick = () => {
                let l = Number(o.dataset.bit);
                ((r[l] = 1 - r[l]),
                  o.classList.toggle("on", !!r[l]),
                  (o.querySelector("b").textContent = r[l]),
                  this.audio.tone(r[l] ? 540 : 300, 0.1));
              }),
          ),
        this.buttons([
          {
            label: "RESTORE POWER",
            primary: !0,
            on: () => {
              r.every((o, l) => o === n[l])
                ? i(
                    e.reward ||
                      "The little mechanism wakes. Something in the city works a little better than it did before you arrived.",
                    { empathy: 3, insight: 1 },
                  )
                : ((V("circuit-status").textContent =
                    "Channel mismatch. Check POWER, GROUND, and SIGNAL against the label."),
                  this.audio.hit());
            },
          },
        ]));
    }
    if (e.kind === "focus") {
      let r = 63 + ((this.state.scene * 7) % 23),
        n = 30;
      (s(
        `<div class="focus-display"><span id="focus-text">${e.id === "playback" ? "PRIS / NEXUS-6" : "99069745xb7Y"}</span></div><label class="tiny" for="focus-slider">LENS CALIBRATION / DRAG TO SHARPEN</label><input id="focus-slider" type="range" min="0" max="100" value="30"><div class="puzzle-status" id="focus-status">Turn the lens until the specimen is crisp.</div>`,
      ),
        (this.mini = { kind: "focus" }));
      let o = () => {
        n = +V("focus-slider").value;
        let l = Math.abs(r - n) / 6;
        ((V("focus-text").style.filter = `blur(${l}px)`),
          (V("focus-text").style.opacity = yt(1 - l * 0.06, 0.3, 1)),
          (V("focus-status").textContent =
            Math.abs(r - n) < 7
              ? "IMAGE RESOLVED \xB7 Ready to record."
              : `FOCUS ${String(n).padStart(2, "0")} / 100 \xB7 Adjust for maximum clarity.`));
      };
      ((V("focus-slider").oninput = o),
        o(),
        this.buttons([
          {
            label: "RECORD THE READING",
            primary: !0,
            on: () =>
              Math.abs(r - n) < 7 + this.state.upgrades.focus
                ? i(
                    e.id === "playback"
                      ? "The caller is Pris. Sebastian\u2019s apartment becomes your destination."
                      : "The manufactured scale reveals its serial. A maker\u2019s number becomes a traceable sale.",
                  )
                : (V("focus-status").textContent =
                    "Too blurred to certify. Sharpen the lettering before you record it."),
          },
        ]));
    }
    if (e.kind === "memory") {
      let r = 0,
        n = !1,
        o = [0, 2, 1, 3];
      s(
        '<div class="piano-keys">' +
          ["I", "II", "III", "IV"]
            .map((d, f) => `<button class="piano-key" data-note="${f}" aria-label="Piano key ${f + 1}">${d}</button>`)
            .join("") +
          '</div><div class="puzzle-status" id="piano-status">Play the phrase, then repeat its four notes.</div>',
      );
      let l = (d) => {
          let f = V("modal").querySelector(`[data-note="${d}"]`);
          (f?.classList.add("lit"), this.audio.note(d), setTimeout(() => f?.classList.remove("lit"), 350));
        },
        c = () => {
          n ||
            ((r = 0),
            (n = !0),
            (V("piano-status").textContent = "LISTEN / WATCH THE FOUR KEYS"),
            o.forEach((d, f) =>
              setTimeout(() => {
                this.modalToken === t && l(d);
              }, f * 650),
            ),
            setTimeout(() => {
              this.modalToken === t &&
                ((n = !1),
                (V("piano-status").textContent = "YOUR TURN \xB7 Four notes, left to right numbered I\u2013IV."));
            }, 2700));
        },
        h = (d) => {
          if (!n) {
            if ((l(d), d !== o[r])) {
              ((r = 0),
                (V("piano-status").textContent =
                  "A different note. The phrase starts again; replay it whenever needed."));
              return;
            }
            (r++,
              (V("piano-status").textContent = `${r} / 4 NOTES RECALLed`.toUpperCase()),
              r === 4 &&
                setTimeout(() => {
                  this.modalToken === t &&
                    i("The phrase returns under your hands. A shared moment does not need a verified origin.", {
                      empathy: 3,
                    });
                }, 350));
          }
        };
      ((this.mini = { kind: "memory", press: h }),
        V("modal")
          .querySelectorAll("[data-note]")
          .forEach((d) => (d.onclick = () => h(+d.dataset.note))),
        this.buttons([{ label: "LISTEN TO THE PHRASE", primary: !0, on: c }]));
    }
    if (e.kind === "esper") {
      let r = 1,
        n = 2,
        o = 1,
        l = 0;
      s(
        '<div class="esper-wrap"><canvas id="esper-canvas" width="480" height="300" aria-label="Photograph grid. The wardrobe glint is in column E, row 3."></canvas></div><div class="esper-controls"><button data-pan="left" aria-label="Move selection left">\u2190</button><button data-pan="up" aria-label="Move selection up">\u2191</button><button data-pan="down" aria-label="Move selection down">\u2193</button><button data-pan="right" aria-label="Move selection right">\u2192</button><button id="esper-zoom">ZOOM \xD71</button></div><div class="puzzle-status" id="esper-status"></div>',
      );
      let c = V("esper-canvas"),
        h = c.getContext("2d"),
        d = document.createElement("canvas");
      ((d.width = 480), (d.height = 300));
      let f = d.getContext("2d");
      ((() => {
        ((f.fillStyle = "#364b4a"),
          f.fillRect(0, 0, 480, 300),
          (f.fillStyle = "#202d33"),
          f.fillRect(274, 30, 170, 243),
          (f.fillStyle = "#576256"),
          f.fillRect(283, 37, 10, 233),
          f.fillRect(427, 37, 10, 233),
          f.fillRect(286, 45, 145, 8),
          (f.fillStyle = "#303735"),
          f.fillRect(297, 60, 119, 204),
          (f.fillStyle = "#6d725b"),
          f.beginPath(),
          f.moveTo(352, 100),
          f.lineTo(390, 105),
          f.lineTo(411, 246),
          f.lineTo(320, 246),
          f.closePath(),
          f.fill());
        for (let p = 0; p < 50; p++)
          ((f.fillStyle = p % 4 ? "#aeb69a" : "#edcf85"),
            f.fillRect(335 + ((p * 37) % 64), 116 + ((p * 23) % 121), 2, 3));
        ((f.fillStyle = "#273431"),
          f.fillRect(145, 145, 112, 155),
          (f.fillStyle = "#677363"),
          f.fillRect(168, 76, 63, 74),
          (f.fillStyle = "#222d2c"),
          f.fillRect(160, 68, 74, 26),
          (f.fillStyle = "#a0a182"),
          f.fillRect(20, 205, 103, 24),
          (f.fillStyle = "#586057"),
          f.fillRect(30, 229, 12, 71),
          f.fillRect(102, 229, 12, 71),
          (f.fillStyle = "#efd39a"),
          f.fillRect(357, 144, 7, 11),
          f.fillRect(354, 148, 13, 3),
          (f.globalAlpha = 0.11));
        for (let p = 0; p < 300; p++) ((f.fillStyle = p % 2 ? "#132526" : "#e4d6b1"), f.fillRect(0, p, 480, 1));
        f.globalAlpha = 1;
      })(),
        this.state.cut !== "draft" &&
          ((f.fillStyle = "#405c5c"),
          f.fillRect(305, 62, 110, 198),
          (f.fillStyle = "#909881"),
          f.fillRect(346, 119, 33, 45),
          (f.fillStyle = "#202e31"),
          f.fillRect(342, 109, 42, 15),
          f.fillRect(350, 136, 5, 4),
          f.fillRect(369, 136, 5, 4),
          (f.fillStyle = "#566c60"),
          f.fillRect(337, 167, 52, 72),
          (f.fillStyle = "#96aea2"),
          f.fillRect(298, 60, 4, 207)));
      let u = () => {
        if ((h.clearRect(0, 0, 480, 300), o === 1)) h.drawImage(d, 0, 0);
        else {
          let p = 480 / o,
            m = 300 / o,
            y = yt((r + 0.5) * 80 - p / 2, 0, 480 - p),
            b = yt((n + 0.5) * 60 - m / 2, 0, 300 - m);
          h.drawImage(d, y, b, p, m, 0, 0, 480, 300);
        }
        ((h.strokeStyle = "#afd5b730"), (h.lineWidth = 1));
        for (let p = 1; p < 6; p++) (h.beginPath(), h.moveTo(p * 80, 0), h.lineTo(p * 80, 300), h.stroke());
        for (let p = 1; p < 5; p++) (h.beginPath(), h.moveTo(0, p * 60), h.lineTo(480, p * 60), h.stroke());
        ((h.strokeStyle = "#a1ffdc"),
          (h.lineWidth = 2),
          h.strokeRect(o === 1 ? r * 80 + 2 : 200, o === 1 ? n * 60 + 2 : 120, 76, 56),
          (h.fillStyle = "#a1ffdc"),
          (h.font = "11px monospace"),
          h.fillText("ESPER / OPTICAL RECONSTRUCTION", 12, 17),
          (V("esper-status").textContent =
            `FRAME ${"ABCDEF"[r]}${n + 1} \xB7 MAGNIFICATION \xD7${o} \xB7 ${this.state.cut === "draft" ? "Find the wardrobe glint." : "Find the reflected figure."}`),
          (V("esper-zoom").textContent = "ZOOM \xD7" + o));
      };
      ((c.onpointerdown = (p) => {
        let m = c.getBoundingClientRect();
        (o > 1 && (o = 1),
          (r = yt(Math.floor(((p.clientX - m.left) / m.width) * 6), 0, 5)),
          (n = yt(Math.floor(((p.clientY - m.top) / m.height) * 5), 0, 4)),
          u());
      }),
        V("modal")
          .querySelectorAll("[data-pan]")
          .forEach(
            (p) =>
              (p.onclick = () => {
                ((r = yt(r + (p.dataset.pan === "right" ? 1 : p.dataset.pan === "left" ? -1 : 0), 0, 5)),
                  (n = yt(n + (p.dataset.pan === "down" ? 1 : p.dataset.pan === "up" ? -1 : 0), 0, 4)),
                  u());
              }),
          ),
        (V("esper-zoom").onclick = () => {
          ((o = (o % 3) + 1), u());
        }),
        (this.mini = { kind: "esper" }),
        u(),
        this.buttons([
          {
            label: "ENHANCE & PRINT",
            primary: !0,
            on: () => {
              r === 4 && n === 2 && o === 3
                ? i(
                    "The wardrobe yields a sequined garment. You print the detail and set it beside the unexplained scale.",
                  )
                : (l++,
                  (V("esper-status").textContent =
                    l > 1
                      ? "TRACE ASSIST / Try E3 at \xD73 magnification."
                      : this.state.cut === "draft"
                        ? "No usable detail. Center the wardrobe glint, then use \xD73 magnification."
                        : "No usable detail. Center the reflected figure, then use \xD73 magnification."));
            },
          },
        ]));
    }
    if (e.kind === "chess") {
      let r = 0,
        n = "",
        o = 0,
        l = {
          e8: "\u265A",
          g8: "\u265E",
          f3: "\u2655",
          d6: "\u2657",
          e5: "\u2659",
          b1: "\u2658",
          a8: "\u265C",
          h8: "\u265C",
          d7: "\u265F",
        };
      s(
        '<div class="chessboard" id="chessboard"></div><div class="puzzle-status" id="chess-status">FIRST TRANSMISSION / The queen opens the route.</div><div class="tiny" style="margin-bottom:18px">Scripted chess-access sequence, not a general chess engine.</div>',
      );
      let c = () => {
        V("chessboard").innerHTML = "";
        for (let h = 8; h >= 1; h--)
          for (let d = 0; d < 8; d++) {
            let f = "abcdefgh"[d] + h,
              g = document.createElement("button");
            ((g.className = "chess-square" + ((d + h) % 2 ? " dark" : "") + (f === n ? " selected" : "")),
              (g.dataset.square = f),
              g.setAttribute("aria-label", f + (l[f] ? " occupied" : " empty")),
              (g.innerHTML = `${l[f] || ""}<small>${f}</small>`),
              (g.onclick = () => {
                n = f;
                let u = r === 0 ? "f6" : "e7";
                f === u
                  ? r === 0
                    ? (delete l.f3,
                      delete l.g8,
                      (l.f6 = "\u265E"),
                      (r = 1),
                      (V("chess-status").textContent =
                        "QUEEN SACRIFICED / Knight takes. Now send the bishop to finish."),
                      c())
                    : i("The final move is accepted. The elevator doors open to Tyrell\u2019s private rooms.")
                  : (o++,
                    (V("chess-status").textContent =
                      o > 1
                        ? `SEQUENCE HINT / Select ${u.toUpperCase()}.`
                        : "That destination does not complete this access sequence."),
                    c());
              }),
              V("chessboard").appendChild(g));
          }
      };
      ((this.mini = { kind: "chess" }),
        c(),
        this.buttons([
          {
            label: "CONSULT THE MOVE NOTATION",
            on: () => {
              V("chess-status").textContent =
                r === 0
                  ? "ACCESS NOTE / Queen to F6. The knight takes her."
                  : "ACCESS NOTE / Bishop to E7. The doors open.";
            },
          },
        ]));
    }
  }
  puzzleFailure(e, t) {
    (this.state.deaths++,
      this.save(),
      this.showModal("A different take.", t, "CHECKPOINT / SCENE ENDPOINT UNCHANGED", "failure", { close: !1 }),
      this.buttons([
        { label: "RETRY THE BEAT", primary: !0, on: () => this.openNode(e) },
        {
          label: "RETRY WITH WIDER TIMING WINDOWS",
          on: () => {
            ((this.prefs.assist = !0), this.savePrefs(), this.openNode(e));
          },
        },
      ]));
  }
  combatBrief(e) {
    this.showModal(
      e.label,
      e.text,
      e.kind === "drive" ? "FIRST-PERSON / DRIVING" : "FIRST-PERSON / LIVE ENCOUNTER",
      "combat-brief",
    );
    let t =
      e.mode === "leon"
        ? "Move and dodge. Survive 16 seconds; Rachael\u2019s intervention is fixed."
        : e.mode === "roy"
          ? "Reach all four green beacons. Roy is invulnerable in this encounter."
          : e.kind === "drive"
            ? "A / D or the left stick steers. Avoid the marked road debris for 24 seconds."
            : "WASD / left stick moves. Mouse / right stick / right-side drag aims. F / Space / A / ACT fires. R / RB or an empty-weapon action reloads. Three clean hits are required.";
    (V("modal-actions").insertAdjacentHTML(
      "beforebegin",
      `<div class="anchor">${Pt(t)}<br><br>Failure returns to this encounter\u2019s opening. ${this.prefs.assist ? "Aim assistance is on." : "Aim assistance is off."}</div>`,
    ),
      this.buttons([
        {
          label: e.kind === "drive" ? "TAKE THE WHEEL" : "ENTER ENCOUNTER",
          primary: !0,
          on: () => this.startEncounter(e),
        },
      ]));
  }
  startEncounter(e) {
    (this.closeModal(),
      (this.state.health = Math.max(this.state.health, this.prefs.assist ? 80 : 60)),
      (this.ammo = 6),
      (this.reloadTime = 0),
      (this.shotCooldown = 0),
      (this.cam = { x: 0, y: 1.72, z: 10, yaw: 0, pitch: 0 }));
    let t = e.kind === "drive" ? "drive" : e.mode,
      s = {
        mode: t,
        step: e,
        t: 0,
        hp: 3,
        attackCd: 1.5,
        route: 0,
        limit:
          t === "leon"
            ? 16
            : t === "drive"
              ? 24
              : t === "zhora"
                ? this.state.inventory.includes("Courier favour")
                  ? 60
                  : 48
                : 100,
      };
    if (t === "drive") {
      ((this.cam.y = 1.55), (this.cam.pitch = -0.025), (s.debris = []));
      for (let i = 0; i < 14; i++) {
        let r = [-3, 0, 3][(i * 5 + 1) % 3],
          n = this.world.box(r, 0.34, -15 - i * 22, 1.9, 0.65, 1.3, "#886e4d", { dynamic: !0 });
        (s.debris.push(n),
          this.world.box(r, 0.7, -15 - i * 22, 1.85, 0.05, 1.3, "#ffb27c", { dynamic: !0, emissive: 0.3 }));
      }
      V("car-hood").hidden = !1;
    } else {
      let i = { zhora: "Zhora", leon: "Leon", pris: "Pris", roy: "Roy Batty" },
        r = { zhora: "#82938c", leon: "#485752", pris: "#344047", roy: "#35494d" };
      ((s.enemy = this.world.character(i[t], 0, t === "roy" ? 16 : -5, r[t], {
        hair: t === "roy" ? "#cccbab" : t === "pris" ? "#c6c2a2" : "#382e2a",
        skin: t === "pris" ? "#d3d7c4" : "#be997d",
      })),
        t === "roy" &&
          (s.routes = [
            { x: -2, z: -3 },
            { x: 2, z: -14 },
            { x: -2, z: -25 },
            { x: 1, z: -40 },
          ]));
    }
    ((this.encounter = s),
      this.renderer.setWorld(this.world),
      (V("encounter-bar").hidden = !1),
      (V("weapon").hidden = !["zhora", "pris"].includes(t)),
      this.updateHUD());
  }
  reload() {
    !this.encounter ||
      this.reloadTime > 0 ||
      this.ammo === 6 ||
      !["zhora", "pris"].includes(this.encounter.mode) ||
      ((this.reloadTime = 1.5), this.toast("INSTALLING FRESH CASSETTE\u2026"), this.audio.tone(210, 0.14, "triangle"));
  }
  /** A brief ring on the crosshair when a shot connects. */
  flashCrosshair() {
    let e = V("crosshair");
    (e.classList.remove("hit"), void e.offsetWidth, e.classList.add("hit"));
    clearTimeout(this.crosshairTimer);
    this.crosshairTimer = setTimeout(() => e.classList.remove("hit"), 220);
  }
  action() {
    if (!this.inGame || this.overlay) return;
    if (!this.encounter) {
      this.interact();
      return;
    }
    let e = this.encounter;
    if (e.mode === "drive") return;
    if (["leon", "roy"].includes(e.mode)) {
      this.shotCooldown <= 0 &&
        ((this.shotCooldown = 1.4),
        (e.attackCd = Math.max(e.attackCd, 0.9)),
        this.toast(
          e.mode === "leon"
            ? "EVADE \xB7 Keep moving until help arrives."
            : "NO FIRING SOLUTION \xB7 Follow the route beacons.",
        ));
      return;
    }
    if (this.shotCooldown > 0 || this.reloadTime > 0) return;
    if (this.ammo <= 0) {
      this.reload();
      return;
    }
    let t = e.enemy,
      s = t.x - this.cam.x,
      i = t.z - this.cam.z,
      r = Math.hypot(s, i),
      n = Math.atan2(-s, -i),
      o = Math.atan2(Math.sin(n - this.cam.yaw), Math.cos(n - this.cam.yaw)),
      l = Math.atan2(1.2 - this.cam.y, r) - this.cam.pitch,
      c = (this.prefs.assist ? 0.23 : 0.1) + this.state.upgrades.focus * 0.022 + (this.mobile || this.input.source !== "keyboard" ? 0.08 : 0);
    (this.ammo--,
      this.state.shots++,
      (this.shotCooldown = 0.42),
      this.audio.fire(),
      this.input.rumble(0.3, 70),
      (V("weapon").style.transform = "translate(0,10px) rotate(2deg)"),
      setTimeout(() => (V("weapon").style.transform = ""), 110));
    let h = !1;
    for (let d of this.world.obstacles)
      if (!(d.hidden || d.y + d.h / 2 < 1.3)) {
        for (let f = 0.08; f < 0.95; f += 0.04)
          if (Math.abs(this.cam.x + s * f - d.x) < d.w / 2 && Math.abs(this.cam.z + i * f - d.z) < d.d / 2) {
            h = !0;
            break;
          }
        if (h) break;
      }
    (Math.abs(o) < c && Math.abs(l) < c + 0.12 && r < 30 && !h
      ? (e.hp--,
        this.audio.tone(940, 0.08, "square", 0.07),
        this.flashCrosshair(),
        this.input.rumble(0.55, 110),
        this.toast(e.hp > 0 ? "CONFIRMED HIT \xB7 Keep your line clear." : "ENCOUNTER RESOLVED"),
        e.hp <= 0 && this.completeEncounter())
      : h
        ? this.toast("DISPLAY BARRIER IN THE LINE OF FIRE \xB7 Reposition.")
        : this.toast("SHOT WIDE \xB7 Keep the marked target near the crosshair."),
      this.ammo === 0 &&
        !this.overlay &&
        setTimeout(() => {
          this.encounter === e && this.reload();
        }, 300),
      this.updateHUD());
  }
  damage(e) {
    if (this.encounter) {
      if (
        ((this.state.health = Math.max(0, this.state.health - e)),
        (this.hitTime = 0.65),
        (this.shakeTime = 0.45),
        this.input.rumble(yt(0.35 + e / 40, 0.35, 1), e >= 100 ? 420 : 200),
        this.audio.hit(),
        this.state.health <= 0)
      ) {
        let t = this.encounter.step;
        ((this.encounter = null),
          (V("weapon").hidden = !0),
          (V("car-hood").hidden = !0),
          (V("encounter-bar").hidden = !0),
          this.state.deaths++,
          this.save(),
          this.showModal(
            "The scene ends here.",
            "Not this version of it. Return to the encounter opening and try a different route. Your earlier evidence is safe.",
            "CHECKPOINT / TAKE ANOTHER ROUTE",
            "failure",
            { close: !1 },
          ),
          this.buttons([
            {
              label: "RETRY ENCOUNTER",
              primary: !0,
              on: () => {
                ((this.world = new wl(this.scene)),
                  this.renderer.setWorld(this.world),
                  (this.state.health = this.maxHealth),
                  this.startEncounter(t));
              },
            },
            {
              label: "ENABLE ASSIST & RETRY",
              on: () => {
                ((this.prefs.assist = !0),
                  this.savePrefs(),
                  (this.world = new wl(this.scene)),
                  this.renderer.setWorld(this.world),
                  (this.state.health = this.maxHealth),
                  this.startEncounter(t));
              },
            },
          ]));
      }
      this.updateHUD();
    }
  }
  completeEncounter() {
    let e = this.encounter;
    if (e) {
      e.beam && (e.beam.hidden = !0);
      for (let t of e.beamTiles || []) t.hidden = !0;
      (e.enemy && (e.enemy.active = !1),
        this.input.rumble(0.45, 260),
        (this.encounter = null),
        (V("weapon").hidden = !0),
        (V("car-hood").hidden = !0),
        (V("encounter-bar").hidden = !0),
        (this.cam = { x: 0, y: 1.72, z: 10, yaw: 0, pitch: 0 }),
        this.interlude(e.step.result, e.step, { insight: 2, empathy: e.mode === "leon" ? 2 : 0 }));
    }
  }
  tickEncounter(e, t) {
    let s = this.encounter;
    if (!s) return;
    if (((s.t += e), (s.attackCd -= e), s.mode === "drive")) {
      // Steering: A / D, the left and right arrows, the left stick or the touch stick.
      let r = yt(this.input.vector("move").x - this.input.value("turn"), -1, 1);
      ((this.cam.x = yt(this.cam.x + r * 4.4 * e, -4.15, 4.15)),
        (this.cam.z -= 12.8 * e),
        (this.cam.y = 1.55 + (this.prefs.reducedMotion ? 0 : Math.sin(s.t * 15) * 0.009)));
      for (let n of s.debris)
        if (
          !n.hit &&
          Math.abs(n.z - this.cam.z) < 1.3 &&
          Math.abs(n.x - this.cam.x) < 1.38 &&
          ((n.hit = !0), this.damage(this.prefs.assist ? 15 : 25), this.encounter !== s)
        )
          return;
      s.t >= s.limit && this.completeEncounter();
      return;
    }
    let i = s.enemy;
    if (s.mode === "zhora") {
      let r = -5 - s.t * 0.83,
        n = Math.sin(s.t * 0.65) * 2.1;
      if ((this.world.moveActor(i, n, r, t, !0), s.t >= s.limit)) {
        ((this.state.health = 1), this.damage(1));
        return;
      }
    } else {
      let r = this.cam.x - i.x,
        n = this.cam.z - i.z,
        o = Math.hypot(r, n),
        l = s.mode === "pris" && s.t % 4 < 0.8,
        c = s.mode === "roy" ? 3.05 : s.mode === "leon" ? 2.6 : l ? 5.8 : 2.1;
      if (
        (o > 0.95 && this.world.moveActor(i, i.x + (r / (o || 1)) * c * e, i.z + (n / (o || 1)) * c * e, t, !0),
        o < 1.65 &&
          s.attackCd <= 0 &&
          ((s.attackCd = 1.35), this.damage(this.prefs.assist ? 13 : 22), this.encounter !== s))
      )
        return;
      if (s.mode === "leon" && s.t >= s.limit) {
        this.completeEncounter();
        return;
      }
      if (s.mode === "roy") {
        let h = s.routes[s.route],
          d = this.state.inventory.includes("Bear\u2019s service map") ? 3 : 2.1;
        if (
          h &&
          Math.hypot(this.cam.x - h.x, this.cam.z - h.z) < d &&
          (s.route++,
          this.audio.evidence(),
          this.toast(
            ["BILLIARD ROOM CLEARED", "ARMOIRE PASSAGE CLEARED", "BATHROOM CLEARED", "ROOF ROUTE FOUND"][s.route - 1],
          ),
          s.route === s.routes.length)
        ) {
          this.completeEncounter();
          return;
        }
      }
    }
  }
  updateHUD() {
    let e = this.scene;
    ((V("case-label").textContent = (this.replay ? "REPLAY / " : e.case + " / ") + e.number + " OF " + Ve.length),
      (V("scene-title").textContent = e.title),
      (V("place-label").textContent = e.place),
      (V("role-label").textContent = e.role.toUpperCase()),
      (V("objective-progress").textContent = `${Math.min(this.state.step + 1, e.steps.length)} / ${e.steps.length}`));
    let t = e.steps[this.state.step];
    ((V("objective-text").textContent = t ? t.label : e.exit),
      (V("objective-detail").textContent = this.encounter
        ? this.encounter.mode === "roy"
          ? "Follow the green route. Do not fight Roy."
          : this.encounter.mode === "leon"
            ? "Dodge. Keep your distance. Help is coming."
            : this.encounter.mode === "drive"
              ? "Steer around debris. A / D or the left stick."
              : "Keep the target in sight. Reposition around cover."
        : t
          ? "Explore, then approach the green marker."
          : "The scene is resolved. Reach the exit marker."));
    let s = Math.ceil(this.state.health);
    ((V("health-value").textContent = s),
      (V("health-fill").style.width = yt((s / this.maxHealth) * 100, 0, 100) + "%"),
      (V("health-fill").style.background = s < 35 ? "var(--red)" : "var(--mint)"));
    let i = Math.floor(this.state.xp / 180) + 1,
      r = ["OBSERVER", "INVESTIGATOR", "TRACER", "SPECIALIST", "VETERAN", "WITNESS"];
    ((V("rank-value").textContent = `RANK ${String(i).padStart(2, "0")} \xB7 ${r[Math.min(i - 1, 5)]}`),
      (V("inventory-count").textContent = String(this.state.inventory.length).padStart(2, "0") + " ITEMS"),
      (V("xp-fill").style.width = ((this.state.xp % 180) / 180) * 100 + "%"),
      (V("ammo-value").textContent =
        this.reloadTime > 0 ? "RELOAD" : String(this.ammo).padStart(2, "0") + " / \u221E"));
    let n = ["N", "NW", "W", "SW", "S", "SE", "E", "NE"];
    if (((V("heading").textContent = n[((Math.round(this.cam.yaw / (Math.PI / 4)) % 8) + 8) % 8]), this.encounter)) {
      let o = this.encounter,
        l = o.mode,
        c = 0,
        h = "";
      (l === "drive"
        ? ((c = (o.t / o.limit) * 100),
          (h = "NORTHBOUND / KEEP DRIVING"),
          (V("encounter-value").textContent = Math.ceil(o.limit - o.t) + "s"),
          (V("speed-value").textContent = "092"))
        : l === "leon"
          ? ((c = (o.t / o.limit) * 100),
            (h = "SURVIVE / KEEP YOUR DISTANCE"),
            (V("encounter-value").textContent = Math.ceil(o.limit - o.t) + "s"))
          : l === "roy"
            ? ((c = (o.route / 4) * 100),
              (h = "UPPER-FLOOR ESCAPE ROUTE"),
              (V("encounter-value").textContent = o.route + " / 4"))
            : ((c = ((3 - o.hp) / 3) * 100),
              (h = l === "pris" ? "PRIS / WATCH THE CHARGE" : "ZHORA / CLEAR LINE OF FIRE"),
              (V("encounter-value").textContent = 3 - o.hp + " / 3")),
        (V("encounter-label").textContent = h),
        (V("encounter-progress").value = c));
    }
    this.drawMap();
  }
  /**
   * World markers and the interaction prompt for this frame. Nothing is written to the page
   * here: the markup is collected in markerHTML / promptHTML (the living-scene, district and
   * prologue layers add their own), and commitHUD() writes it once, only when it changed.
   */
  updateMarkers(e) {
    if (!this.inGame || this.overlay) {
      ((this.markerHTML = ""), (this.nearby = null));
      return;
    }
    let t = innerWidth,
      s = innerHeight,
      i = 12 + this.state.upgrades.focus * 4,
      r = [];
    if (this.encounter) {
      let h = this.encounter;
      if (h.mode === "roy" || h.mode === "stealth") {
        let d = h.routes[h.route];
        d &&
          (r = [
            {
              ...d,
              y: 1.5,
              name:
                h.mode === "stealth"
                  ? "SAFE ROUTE " + (h.route + 1)
                  : ["BILLIARD ROOM", "ARMOIRE", "BATHROOM", "PIGEON CLOSET"][h.route],
            },
          ]);
      } else h.enemy && (r = [{ x: h.enemy.x, y: 2.25, z: h.enemy.z, name: h.enemy.name, enemy: !0 }]);
    } else r = this.activeSpots();
    let n = "",
      o = null,
      l = 1 / 0;
    for (let h of r) {
      let d = Math.hypot(h.x - this.cam.x, h.z - this.cam.z),
        f = lT({ x: h.x, y: h.y + 0.45, z: h.z }, this.cam, t, s);
      if (h.optional && d > (this.scanTime > 0 ? i : 5.5)) continue;
      let g = f.z > 0 || d < 1.15;
      !this.encounter && d < 2.95 && g && d < l && ((o = h), (l = d));
      let u = h.name || h.exit ? h.name || "SCENE EXIT" : h.step?.label || "",
        p = f.x,
        m = f.y,
        y = !1;
      if (f.z < 0.1) {
        if (h.optional) continue;
        let b = h.x - this.cam.x,
          x = h.z - this.cam.z,
          T = Math.atan2(-b, -x) - this.cam.yaw;
        ((T = Math.atan2(Math.sin(T), Math.cos(T))),
          (p = T > 0 ? 45 : t - 45),
          (m = s * 0.5),
          (u = T > 0 ? "\u2190 TURN LEFT" : "TURN RIGHT \u2192"),
          (y = !0));
      } else {
        if (h.optional && (p < 0 || p > t || m < 0 || m > s)) continue;
        ((p = yt(p, 45, t - 45)), (m = yt(m, 100, s - 90)));
      }
      n += `<div class="world-marker ${h.optional ? "optional" : ""} ${h.enemy ? "enemy" : ""}" style="left:${p.toFixed(1)}px;top:${m.toFixed(1)}px"><span class="marker-name" style="transform:translateX(${(p < 120 ? 120 - p : p > t - 120 ? t - 120 - p : 0).toFixed(1)}px)">${Pt(u.toUpperCase())}</span><span class="diamond"></span><span class="distance">${Math.ceil(d)} M${y ? " / BEHIND" : ""}</span></div>`;
    }
    ((this.markerHTML = n), (this.nearby = o), (this.promptLocal = !1));
    if (this.encounter) {
      let h = this.encounter.mode;
      ((this.promptDisabled = h === "drive"),
        (this.promptHTML =
          h === "stealth"
            ? `<kbd>${this.keyHint("C")}</kbd><span>${this.crouchToggle ? "CROUCHED / FOLLOW THE ROUTE" : "USE COVER / CROUCH TO REDUCE NOISE"}</span><b>\u25C7</b>`
            : `<kbd>${this.keyHint("F")}</kbd><span>${h === "drive" ? "STEER / LEFT STICK" : h === "roy" ? "FOLLOW THE BEACONS" : h === "leon" ? "EVADE" : this.reloadTime > 0 ? "RELOADING\u2026" : this.ammo === 0 ? "RELOAD CASSETTE" : "FIRE / " + this.ammo + " CHARGES"}</span><b>\u25C7</b>`));
    } else
      ((this.promptDisabled = !o),
        (this.promptHTML = `<kbd>${this.keyHint("E")}</kbd><span>${o ? Pt(o.exit ? this.scene.exit.toUpperCase() : o.step.label.toUpperCase()) : "FOLLOW THE LEAD"}</span><b>\u2197</b>`));
    this.crosshairOn = !!o;
  }
  /** Write this frame's markers, prompt and crosshair to the page, touching only what changed. */
  commitHUD() {
    setHTML(V("markers"), this.markerHTML || "");
    let e = V("interact-prompt");
    (this.promptHTML != null && setHTML(e, this.promptHTML),
      e.disabled !== !!this.promptDisabled && (e.disabled = !!this.promptDisabled),
      e.classList.toggle("local-prompt", !!this.promptLocal));
    let t = this.crosshairOn ? "1" : ".65";
    this.crosshairShown !== t && ((this.crosshairShown = t), (V("crosshair").style.opacity = t));
  }
  drawMap() {
    let e = V("minimap"),
      t = e.getContext("2d"),
      s = 3.1;
    (t.clearRect(0, 0, 120, 120),
      t.save(),
      t.beginPath(),
      t.arc(60, 60, 57, 0, Math.PI * 2),
      t.clip(),
      (t.strokeStyle = "#92c9b522"),
      (t.lineWidth = 1));
    for (let r = 0; r < 120; r += 20)
      (t.beginPath(), t.moveTo(r, 0), t.lineTo(r, 120), t.moveTo(0, r), t.lineTo(120, r), t.stroke());
    t.fillStyle = "#58787577";
    for (let r of this.world.obstacles) {
      let n = 60 + (r.x - this.cam.x) * s,
        o = 60 + (r.z - this.cam.z) * s;
      t.fillRect(n - (r.w * s) / 2, o - (r.d * s) / 2, r.w * s, r.d * s);
    }
    // The next beacon on the Roy and quiet-movement routes, otherwise the current lead.
    let i = this.encounter?.routes ? this.encounter.routes[this.encounter.route] : this.activeSpots()[0];
    if (
      (i &&
        ((t.fillStyle = "#a1ffdc"),
        t.beginPath(),
        t.arc(yt(60 + (i.x - this.cam.x) * s, 6, 114), yt(60 + (i.z - this.cam.z) * s, 6, 114), 3, 0, Math.PI * 2),
        t.fill()),
      this.encounter?.enemy)
    ) {
      let r = this.encounter.enemy;
      ((t.fillStyle = "#ff7863"), t.fillRect(58 + (r.x - this.cam.x) * s, 58 + (r.z - this.cam.z) * s, 4, 4));
    }
    (t.translate(60, 60),
      t.rotate(-this.cam.yaw),
      (t.fillStyle = "#e4eee1"),
      t.beginPath(),
      t.moveTo(0, -6),
      t.lineTo(-4, 4),
      t.lineTo(0, 2),
      t.lineTo(4, 4),
      t.closePath(),
      t.fill(),
      t.restore());
  }
  /**
   * The camera the renderer draws from: the player's view, plus a short shake after a hit
   * (none with reduced motion). The shake never moves the player or the aim itself.
   */
  viewCamera(e) {
    if (!(this.shakeTime > 0)) return this.cam;
    this.shakeTime = Math.max(0, this.shakeTime - e);
    if (this.prefs.reducedMotion || this.overlay) return this.cam;
    let t = (this.view ??= { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 }),
      s = this.shakeTime * this.shakeTime * 0.22;
    return (
      (t.x = this.cam.x),
      (t.y = this.cam.y + (Math.random() - 0.5) * s * 0.6),
      (t.z = this.cam.z),
      (t.yaw = this.cam.yaw + (Math.random() - 0.5) * s),
      (t.pitch = this.cam.pitch + (Math.random() - 0.5) * s),
      t
    );
  }
  /** One frame, driven by the kit's loop (dt in seconds). */
  loop(e) {
    let t = yt(e, 0, 0.06);
    ((this.simTime += t), this.pollInput(t));
    let s = this.simTime,
      a = yt(this.hitTime, 0, 1);
    if (
      (this.toastTime > 0 && ((this.toastTime -= t), this.toastTime <= 0 && V("toast").classList.remove("visible")),
      this.autoTime > 0 && ((this.autoTime -= t), this.autoTime <= 0 && (V("autosave").textContent = "")),
      this.hitTime > 0 && (this.hitTime -= t),
      a !== this.damageShown && ((this.damageShown = a), (V("damage").style.opacity = a)),
      (this.shotCooldown = Math.max(0, this.shotCooldown - t)),
      this.inGame && !document.hidden)
    ) {
      if (((!this.overlay || this.mini) && (this.state.playtime += t), this.mini?.kind === "timing")) {
        let i = this.mini;
        ((i.elapsed += t), (i.position = 0.5 - 0.46 * Math.cos(i.elapsed * (this.prefs.assist ? 1.8 : 2.5))));
        let r = V("timing-needle");
        r && (r.style.left = i.position * 100 + "%");
      }
      if (!this.overlay) {
        if (
          ((this.scanCooldown = Math.max(0, this.scanCooldown - t)),
          (this.scanTime = Math.max(0, this.scanTime - t)),
          this.reloadTime > 0 &&
            ((this.reloadTime -= t),
            this.reloadTime <= 0 && ((this.ammo = 6), this.audio.click(), this.toast("CASSETTE READY \xB7 6 CHARGES"))),
          this.encounter?.mode !== "drive")
        ) {
          // Walk with move (WASD, up/down arrows, left stick, touch stick); turn with look (mouse,
          // right stick, touch drag) or the left/right arrows.
          let x = this.input.vector("move"),
            T = this.input.look("look"),
            i = x.y,
            r = x.x;
          ((this.cam.yaw += this.input.value("turn") * t * 1.7 - T.x),
            (this.cam.pitch = yt(this.cam.pitch - T.y, -1.05, 1.05)));
          let o = Math.abs(i) + Math.abs(r) > 0.04,
            l = this.input.down("sprint") || this.sprintToggle,
            c = this.input.down("crouch") || this.crouchToggle,
            h = (l ? 5.45 : 3.55) * (c ? 0.55 : 1) * (1 + this.state.upgrades.footwork * 0.07),
            d = (-Math.sin(this.cam.yaw) * i + Math.cos(this.cam.yaw) * r) * h * t,
            f = (-Math.cos(this.cam.yaw) * i - Math.sin(this.cam.yaw) * r) * h * t;
          (!this.world.collides(this.cam.x + d, this.cam.z) &&
            (!this.world.groundHeight ||
              Math.abs(
                this.world.groundHeight(this.cam.x + d, this.cam.z) - this.world.groundHeight(this.cam.x, this.cam.z),
              ) < 0.5) &&
            (this.cam.x += d),
            !this.world.collides(this.cam.x, this.cam.z + f) &&
              (!this.world.groundHeight ||
                Math.abs(
                  this.world.groundHeight(this.cam.x, this.cam.z + f) - this.world.groundHeight(this.cam.x, this.cam.z),
                ) < 0.5) &&
              (this.cam.z += f),
            (this.cam.y =
              (this.world.groundHeight?.(this.cam.x, this.cam.z) || 0) +
              (c ? 1.25 : 1.72) +
              (o && !this.prefs.reducedMotion ? Math.sin(s * (l ? 13 : 9)) * 0.025 : 0)));
        }
        this.tickEncounter(t, s);
      }
    } else
      !this.inGame &&
        !this.prefs.reducedMotion &&
        ((this.cam.yaw = 0.06 + Math.sin(s * 0.07) * 0.05), (this.cam.x = 1.5 + Math.sin(s * 0.11) * 0.25));
    this.world.animate?.(s, t, this.prefs.reducedMotion);
    for (let i of this.world.actors)
      i !== this.encounter?.enemy && !i.patrol && this.world.moveActor(i, i.x, i.z, s, !1);
    (this.tickLife?.(t, s),
      this.tickDistrict?.(t, s),
      this.tickOpening?.(t, s),
      V("scanline").classList.toggle("active", this.scanTime > 0 && !this.overlay));
    this.renderer.render(this.viewCamera(t), s, { reducedMotion: this.prefs.reducedMotion });
    ((this.hudTime += t),
      this.inGame &&
        (this.updateMarkers(s), this.commitHUD(), this.hudTime > 0.14 && (this.updateHUD(), (this.hudTime = 0))),
      this.inGame &&
        !this.replay &&
        Math.floor(s) % 25 === 0 &&
        this.lastPeriodicSave !== Math.floor(s) &&
        ((this.lastPeriodicSave = Math.floor(s)), this.save()));
  }
  journal(e = "evidence") {
    let t = this.state;
    (this.showModal(
      "The casebook.",
      "",
      `${t.inventory.length} EVIDENCE / ${t.sidequests.length} SIDE CASES / ${t.xp} XP`,
      "journal",
      { wide: !0 },
    ),
      V("modal-actions").remove(),
      V("modal").insertAdjacentHTML(
        "beforeend",
        `<nav class="tabs" aria-label="Casebook sections">${["evidence", "scenes", "training", "guide"].map((i) => `<button class="${e === i ? "active" : ""}" data-tab="${i}">${i.toUpperCase()}${i === "training" && this.points ? " +" + this.points : ""}</button>`).join("")}</nav><div id="journal-content"></div>`,
      ),
      V("modal")
        .querySelectorAll("[data-tab]")
        .forEach((i) => (i.onclick = () => this.journal(i.dataset.tab))));
    let s = V("journal-content");
    if (
      (this.state.finished &&
        this.inGame &&
        V("hud").hidden &&
        !this.replay &&
        (V("modal").querySelector(".close").onclick = () => this.showCredits()),
      e === "evidence" &&
        (t.inventory.length
          ? (s.innerHTML =
              '<div class="journal-grid">' +
              t.inventory
                .map(
                  (i) =>
                    `<article class="evidence-card"><h4>\u25C7 ${Pt(i)}</h4><p>${Pt(W_[i] || this.itemDescription(i))}</p></article>`,
                )
                .join("") +
              "</div>")
          : (s.innerHTML =
              '<p class="empty-state">No evidence filed. Begin the night and approach the first green marker. Items, photographs, and field observations are stored here as you find them.</p>'),
        t.sidequests.length &&
          s.insertAdjacentHTML(
            "beforeend",
            `<h3 class="modal-kicker" style="margin-top:26px">SIDE CASES CLOSED / ${t.sidequests.length}</h3><p class="modal-body">${t.sidequests.map(Pt).join(" \xB7 ")}</p>`,
          )),
      e === "scenes" &&
        ((s.innerHTML =
          '<p class="tiny" style="margin-bottom:17px">REPLAY UNLOCKED SCENES WITHOUT ALTERING YOUR CAMPAIGN SAVE. CHECK THE GUIDE TAB FOR SOURCE-COVERAGE NOTES.</p><div class="scene-list">' +
          Ve.map(
            (i, r) =>
              `<button class="scene-button" data-scene="${r}" ${r > t.unlocked && !t.finished ? "disabled" : ""}><span>${r > t.unlocked && !t.finished ? "\xB7" : i.number}</span><div><strong>${Pt(i.title)}</strong><small>${t.completed.includes(r) ? "\u2713 RESOLVED" : r === t.scene && this.saved ? "CURRENT CASE" : r > t.unlocked ? "LOCKED" : i.role.toUpperCase()}</small></div></button>`,
          ).join("") +
          "</div>"),
        V("modal")
          .querySelectorAll("[data-scene]")
          .forEach((i) => (i.onclick = () => this.beginReplay(+i.dataset.scene)))),
      e === "training")
    ) {
      s.innerHTML = `<p class="modal-body">${this.points} training point${this.points === 1 ? "" : "s"} available. Earn one for every 180 XP. Training changes the actual encounter mechanics, not the fixed story outcomes.</p>`;
      let i = {
        focus: [
          "Focus",
          "Scanner reveal range +4 m per rank. Scanner cooldown \u22121.5 s. Wider aim and microscope tolerance.",
        ],
        resolve: [
          "Resolve",
          "Maximum condition +15 per rank. Buying a rank immediately restores those 15 condition points.",
        ],
        footwork: ["Footwork", "Movement speed +7% per rank. Slightly wider timing windows for difficult transitions."],
      };
      for (let [r, [n, o]] of Object.entries(i))
        s.insertAdjacentHTML(
          "beforeend",
          `<article class="upgrade"><div class="upgrade-head"><strong>${n}</strong><span>${"\u25A0".repeat(t.upgrades[r])}${"\u25A1".repeat(4 - t.upgrades[r])}</span></div><p>${o}</p><button class="secondary" data-upgrade="${r}" ${this.points < 1 || t.upgrades[r] >= 4 ? "disabled" : ""}>${t.upgrades[r] >= 4 ? "FULLY TRAINED" : "TRAIN / 1 POINT"}</button></article>`,
        );
      V("modal")
        .querySelectorAll("[data-upgrade]")
        .forEach(
          (r) =>
            (r.onclick = () => {
              let n = r.dataset.upgrade;
              this.points > 0 &&
                t.upgrades[n] < 4 &&
                (t.upgrades[n]++,
                n === "resolve" && (t.health = Math.min(this.maxHealth, t.health + 15)),
                this.save(!0),
                this.audio.evidence(),
                this.journal("training"));
            }),
        );
    }
    e === "guide" &&
      (s.innerHTML = `<div class="guide-section"><h3>HOW THE NIGHT WORKS</h3><p>Walk to the green marker and interact. The next story lead unlocks after the current one. Amber markers are optional side cases; use the scanner to find them. Complete the required leads, then reach the exit. Every scene has a fixed entry and endpoint, disclosed under a spoiler foldout before entry. Choices change empathy, evidence, field experience, and your case record.</p><h3>DESKTOP</h3><p>WASD moves. Click the world for mouse-look; dragging also works. Arrow keys provide an alternative: up/down move and left/right turn. E interacts. Q scans. F or Space fires or evades in an encounter. R reloads. Shift runs. C crouches. Tab opens the casebook. Escape pauses. During timed puzzles, Space locks the pulse. Number keys choose dialogue options and play piano notes. F9 opens graphics and control settings.</p><h3>CONTROLLER</h3><p>Left stick or D-pad moves; right stick looks. A interacts, fires or evades. X interacts. Y scans. B crouches. Hold LT or click the left stick to run. RB reloads. LB opens the map, View the casebook, Start pauses. In menus and dialogs the D-pad moves between buttons, A presses, B closes, and the right stick scrolls.</p><h3>TOUCH</h3><p>Put a thumb anywhere on the left side to move and drag the open screen to look. ACT interacts, fires or evades. SCAN reveals side cases. RUN and CROUCH toggle. Landscape and portrait are supported. In the final drive, the stick steers while the car moves forward automatically.</p><h3>FAILURE, SAVING & REPLAY</h3><p>Failed tests and encounters retry from their opening. Earlier evidence is preserved. Scene restart never awards duplicate XP. Progress saves locally after each lead. Export a JSON save before clearing browser data or moving devices. Replayed scenes do not write to your campaign save. Completing the final scene unlocks the closing case record and every scene for replay.</p><h3>ADAPTATION SCOPE / SPOILERS</h3><p>This is a complete, condensed 30-scene fan campaign, not a shot-for-shot or no-omission transcription. The February 23, 1981 screenplay supplied by the player takes priority over other film cuts. Short connecting shots, room transitions, and some dialogue beats are consolidated. Dialogue is newly written; intimacy is non-explicit and consensual. Fatal story events are retained, with some violence occurring in scene transitions. Optional repair and investigation cases are original additions, not claims about screenplay canon.</p><details class="anchor"><summary>VIEW THE LOCATION & STORY COVERAGE MAP</summary>${lX.map(([i, r]) => `<p><strong>${Pt(i)}</strong><br>${Pt(r)}</p>`).join("")}</details><h3>THE MISSING DOSSIER</h3><p>Mary appears in the draft\u2019s files without a resolved playable encounter. The optional audit records the uncertainty. It does not silently invent an ending for her or treat an internet theory as fact.</p><h3>GRAPHICS & AUDIO</h3><p>Three.js r186 draws the city with WebGPU where the browser has it and WebGL 2 everywhere else: TSL node materials, tone mapping, shadows, and bloom on both. Quality, resolution, and control settings live in the shared settings panel (F9). Original synthesized ambience and effects start only after interaction.</p></div>`);
  }
  itemDescription(e) {
    for (let t of Ve) for (let s of [...t.steps, ...t.optional]) if (s.item === e) return s.text;
    return "A field observation retained in your case record.";
  }
  beginReplay(e) {
    (e > this.state.unlocked && !this.state.finished) ||
      (this.showModal(
        "Replay this scene?",
        Ve[e].title + " \u2014 " + Ve[e].place,
        "REHEARSAL / CAMPAIGN SAVE PROTECTED",
        "confirm",
      ),
      this.buttons([
        {
          label: "ENTER SCENE REPLAY",
          primary: !0,
          on: () => {
            (this.replay || (this.replayBackup = yd(this.state)),
              (this.replay = !0),
              (this.state = yd(this.replayBackup)),
              this.loadScene(e, { reset: !0 }));
          },
        },
        { label: "BACK TO CASEBOOK", on: () => this.journal("scenes") },
      ]));
  }
  settings() {
    (this.showModal("Make yourself at home.", "", `SETTINGS / ${this.renderer.label}`, "settings"),
      V("modal-actions").remove());
    let e = [
      ["sound", "Original soundscape", "Synthesized rain, low chords, and interaction tones."],
      ["assist", "Encounter assistance", "More forgiving aim, lower incoming damage, wider timing windows."],
      ["reducedMotion", "Reduced motion", "Removes camera bob, rain movement, and animated interface noise."],
    ];
    (V("modal").insertAdjacentHTML(
      "beforeend",
      e
        .map(
          ([t, s, i]) =>
            `<div class="settings-row"><div>${s}<small>${i}</small></div><button class="toggle ${this.prefs[t] ? "on" : ""}" data-setting="${t}" aria-pressed="${this.prefs[t]}">${this.prefs[t] ? "ON" : "OFF"}</button></div>`,
        )
        .join("") +
        `<div class="settings-row"><div>Graphics & controls<small>Quality, resolution, look speed, invert look, touch layout and vibration. Shared by every 3D game here. F9 opens it too.</small></div><button class="toggle" id="kit-settings">OPEN</button></div><div class="settings-row"><div>Save portability<small>Stored on this device. No account, telemetry, or server-side saves.</small></div></div><div class="row"><button class="secondary" id="export-save">EXPORT SAVE \u2193</button><button class="secondary" id="import-button">IMPORT SAVE \u2191</button></div><p class="modal-footer">Renderer: ${Pt(this.renderer.label)} \xB7 quality ${Pt(this.kit.tier.name.toUpperCase())}. WebGPU where the browser has it, WebGL 2 everywhere else.</p><div class="modal-actions" id="modal-actions"></div>`,
    ),
      V("modal")
        .querySelectorAll("[data-setting]")
        .forEach(
          (t) =>
            (t.onclick = () => {
              let s = t.dataset.setting;
              ((this.prefs[s] = !this.prefs[s]),
                this.audio.start(),
                this.savePrefs(),
                (t.textContent = this.prefs[s] ? "ON" : "OFF"),
                t.classList.toggle("on", this.prefs[s]),
                t.setAttribute("aria-pressed", String(this.prefs[s])));
            }),
        ),
      (V("kit-settings").onclick = () => this.kit.menu.open()),
      (V("export-save").onclick = () => this.exportSave()),
      (V("import-button").onclick = () => V("import-save").click()),
      this.buttons([{ label: "BACK TO THE NIGHT", primary: !0, on: () => this.closeModal() }]));
  }
  exportSave() {
    let e = this.replay ? this.replayBackup : this.state,
      t = new Blob([JSON.stringify(e, null, 2)], { type: "application/json" }),
      s = URL.createObjectURL(t),
      i = document.createElement("a");
    ((i.href = s),
      (i.download = "electric-sheepish-case.json"),
      i.click(),
      setTimeout(() => URL.revokeObjectURL(s), 1e3),
      this.toast("Case exported. Keep the JSON file to move your progress between devices."));
  }
  async importSave(e) {
    if (e)
      try {
        if (e.size > 15e5) throw Error("Save file is too large.");
        let t = rT(JSON.parse(await e.text()));
        (this.showModal(
          "Import this case?",
          `Scene ${t.scene + 1} / ${Ve.length}, ${t.inventory.length} items, ${t.xp} XP. Importing replaces the current local save.`,
          "SAVE IMPORT / CONFIRM",
          "confirm",
        ),
          this.buttons([
            {
              label: "IMPORT & CONTINUE",
              primary: !0,
              on: () => {
                ((this.replay = !1), (this.state = t), (this.saved = yd(t)));
                try {
                  localStorage.setItem($_, JSON.stringify(t));
                } catch {}
                t.finished ? this.showCredits() : this.loadScene(t.scene, { reset: !1 });
              },
            },
            { label: "CANCEL IMPORT", on: () => this.settings() },
          ]));
      } catch (t) {
        this.toast("Import rejected: " + t.message);
      } finally {
        V("import-save").value = "";
      }
  }
  about() {
    (this.showModal(
      "Electric Sheepish.",
      "Some memories are manufactured. What you do with them is yours.",
      "AN UNOFFICIAL, BRICK-BUILT NEO-NOIR",
      "about",
    ),
      V("modal-actions").insertAdjacentHTML(
        "beforebegin",
        `<div class="guide-section"><p>A first-person fan game inspired by <em>Blade Runner</em> and the Hampton Fancher / David Peoples shooting draft dated February 23, 1981. Thirty playable scenes cover the central story through the draft\u2019s forest-road pursuit. All game dialogue, procedural scenery, and synthesized audio are newly made for this adaptation.</p><p>This is not affiliated with the film\u2019s creators or rights holders. No film clips, actor likenesses, recordings, fonts, or screenplay text are bundled. Original repair cases and connective passages are identified as additions. The casebook explains what was consolidated.</p><p><a href="https://www.dailyscript.com/scripts/blade-runner_shooting.html" target="_blank" rel="noopener noreferrer">READ THE PLAYER-SUPPLIED SCREENPLAY \u2197</a></p><p>Engine: Three.js r186 (three/webgpu, TSL) on the hub\u2019s shared 3D kit, with an automatic WebGL 2 fallback. No installation or account is required for the standalone edition. Version ${cX}.</p></div>`,
      ),
      this.buttons([{ label: "RETURN TO THE CITY", primary: !0, on: () => this.closeModal() }]));
  }
  showCredits() {
    ((this.inGame = !0),
      (this.encounter = null),
      (this.state.finished = !0),
      (this.state.unlocked = Ve.length - 1),
      this.state.completed.includes(Ve.length - 1) || this.state.completed.push(Ve.length - 1),
      this.save(),
      (V("hud").hidden = !0),
      (V("menu").hidden = !0));
    let e = this.state,
      t =
        e.empathy >= e.insight
          ? "A witness, not a machine."
          : e.insight > e.pressure
            ? "A record that remembers."
            : "The cost of certainty.";
    (this.showModal(
      "The road is still open.",
      "Trees move past the windows. Deckard now sees Roy as a fellow engineered fighter, not a different kind of life. He claims kinship with Roy and Rachael. Then Gaff\u2019s spinner appears behind you. You keep driving.",
      "CASE CLOSED / THE 1981 DRAFT ENDING",
      "credits",
      { wide: !0, close: !1 },
    ),
      V("modal-actions").insertAdjacentHTML(
        "beforebegin",
        `<h3 class="credit-end">${t}</h3><div class="credits-grid"><div><strong>${e.completed.length}/${Ve.length}</strong><span>SCENES RESOLVED</span></div><div><strong>${e.inventory.length}</strong><span>ITEMS & OBSERVATIONS</span></div><div><strong>${e.sidequests.length}</strong><span>SIDE CASES CLOSED</span></div><div><strong>${e.empathy}</strong><span>EMPATHY / HUMANE CHOICES</span></div><div><strong>${e.insight}</strong><span>INSIGHT / CAREFUL READING</span></div><div><strong>${Math.floor(e.playtime / 60)}m</strong><span>PLAYED / ${e.deaths} CHECKPOINT RETRIES</span></div></div><p class="modal-body">${e.empathy >= e.pressure ? "Your case record kept making room for people the paperwork called objects." : "Your record is efficient. Its unanswered questions will remain with you."} ${e.sidequests.includes("Small mercies") ? "Somewhere in the lower city, a repaired electric sheep is still quietly bleating." : ""}</p><p class="modal-footer">ELECTRIC SHEEPISH / Original game design, dialogue, procedural art, and synthesized sound.<br>Inspired by BLADE RUNNER \xB7 Screenplay by Hampton Fancher and David Peoples \xB7 February 23, 1981 draft.<br>Three.js \xA9 its contributors, MIT license. An unofficial fan adaptation. All thirty scenes are now available for protected replay.</p>`,
      ),
      this.buttons([
        { label: "OPEN THE COMPLETED CASEBOOK", primary: !0, on: () => this.journal("scenes") },
        { label: "RETURN TO TITLE", on: () => this.showMenu() },
        { label: "EXPORT THIS CASE", on: () => this.exportSave() },
      ]));
  }
};
mX(Al, {
  SCENES: Ve,
  ITEMS: W_,
  ROUTES: Of,
  ROUTE_META: hX,
  sceneIndex: Qr,
  World: wl,
  freshState: cT,
  validateSave: rT,
});
oX(Al, { SCENES: Ve, SCENE_LIFE: bd, project: lT, setLifeStates: nX, animateSceneLife: aX });
gX(Al, { SCENES: Ve, ITEMS: W_, sceneIndex: Qr, freshState: cT, project: lT });
yX(Al, { SCENES: Ve, World: wl, sceneIndex: Qr, project: lT });
/*
 * THE LOST-AND-FOUND HOUR — an original side-case thread added in this version.
 *
 * A late-night radio host, Oriel, reads lost property back to the city on 88.1. Five optional
 * leads, one in each of five scenes that every route visits, follow her hour through the case:
 * a claim ticket (evidence bench), her broadcast (signal desk), a listener's request (dialogue),
 * a failing rooftop relay (circuit) and the last notice before dawn (dialogue). Each is an
 * ordinary side case built on the game's own systems (amber marker, scanner, XP, casebook).
 * Recording all five closes the thread: a closing record, a keepsake item, bonus XP and a line
 * in the credits. Like every side case, it is original fan-game material.
 */
function installLostAndFoundHour(a, { SCENES: e, ITEMS: t, sceneIndex: s }) {
  let i = "The lost-and-found hour",
    r = "Oriel’s thank-you",
    n = [
      {
        scene: "leon-bathroom",
        note: "A claim ticket from a late radio hour that reads lost property on air. A grey glove, a noodle bar, and a frequency: 88.1.",
        lead: {
          id: "lostticket",
          label: "Read the ticket taped to the cistern",
          kind: "inspect",
          text: "Inspect the object in three light bands. Record each marked detail before you seal the evidence.",
          item: "Lost-and-found ticket",
          model: "paper",
          points: [
            { x: 0.3, y: 0.44, mode: "visible", label: "Claim ticket 88-1: one grey glove, left at a noodle bar" },
            { x: 0.68, y: 0.6, mode: "infrared", label: "A frequency pencilled on the back: 88.1" },
            { x: 0.5, y: 0.27, mode: "ultraviolet", label: "A faint stamp: READ ON AIR, WITH THANKS — O." },
          ],
          quest: "A ticket for a glove",
        },
      },
      {
        scene: "rachael-memory",
        note: "88.1 after midnight. Oriel reads lost property back to the city, one item at a time, and asks nothing for it.",
        lead: {
          id: "radiohour",
          label: "Find the late hour on the kitchen radio",
          kind: "tune",
          text: "The radio on the counter hisses between stations. Under the noise, a calm voice is reading a list.",
          target: [71, 36],
          result:
            "A low, unhurried voice reads the night’s list: a grey glove at a noodle bar, a spare key on the Local 06 platform, a cat’s collar on Animal Row. “If it’s yours, it’s waiting. If it isn’t, leave it where it can be found.” The host signs off as Oriel.",
          item: "Oriel’s broadcast",
          quest: "The voice at 88.1",
        },
      },
      {
        scene: "vidphone",
        note: "A request for Oriel’s lost-and-found hour: one red umbrella, lost the night the power failed. The attendant who wrote it has no line of her own.",
        lead: {
          id: "requestcard",
          label: "Read the request card by the phone",
          kind: "talk",
          text: "A cloakroom attendant has written a card for the late radio hour: one red umbrella, left on the night the power failed. She has no line of her own, and the booth costs more than the umbrella did.",
          options: [
            {
              label: "Phone it in for her.",
              text: "The station line rings twice. You read the card slowly. Somewhere, a red umbrella joins tonight’s list.",
              effect: { empathy: 3 },
            },
            {
              label: "Copy the station’s relay address.",
              text: "The card names a relay on the Bradbury block. The attendant says the hour breaks up whenever it rains.",
              effect: { insight: 2 },
            },
          ],
          item: "Umbrella request card",
          quest: "One red umbrella",
        },
      },
      {
        scene: "sebastian-call",
        note: "A rooftop relay on the Bradbury block, repaired. Oriel’s hour now reaches three more blocks, even in the rain.",
        lead: {
          id: "relaybox",
          label: "Restore the relay under the cornice",
          kind: "circuit",
          text: "A small relay box is bolted under a dripping cornice, wired to an aerial nobody claims. Its service label is half legible. The lost-and-found hour drops out every time it rains.",
          target: [0, 1, 1],
          reward:
            "The relay settles into a hum. For three blocks, cheap radios find Oriel again. Tonight’s list includes one red umbrella, found.",
          item: "Bradbury relay restored",
          quest: "Keep the hour on the air",
        },
      },
      {
        scene: "unicorn-corridor",
        note: "The last notice of Oriel’s night. Found things are read on air until someone comes for them.",
        lead: {
          id: "lastnotice",
          label: "Listen to the radio left on in the corridor",
          kind: "talk",
          text: "Someone has left a radio on the corridor shelf, turned low. Oriel is reading the last notices before dawn.",
          options: [
            {
              label: "Listen to the end.",
              text: "“Last one tonight. Found: a small paper animal, folded with care. No name on it. Whoever made it knows where it was left.” The hour ends in rain.",
              effect: { empathy: 2 },
            },
            {
              label: "Turn it down and keep moving.",
              text: "The corridor goes quiet. The last notice is still read, only without you.",
              effect: { pressure: 1 },
            },
          ],
          item: "The last notice",
          quest: "The last notice before dawn",
        },
      },
    ];
  for (let { scene: o, note: l, lead: c } of n) {
    let h = e[s(o)];
    (h &&
      !h.optional.some((d) => d.id === c.id) &&
      h.optional.push({ ...c, optional: !0, source: "original", thread: "lostfound", position: [-5, 10.3] }),
      t[c.item] || (t[c.item] = l));
  }
  t[r] ||
    (t[r] =
      "Read on air at the end of the hour: “To whoever fixed the relay on the Bradbury block, thank you. Nothing lost down here stays lost for long.”");
  let o = n.map((l) => l.lead.item),
    l = a.prototype,
    c = { finishNode: l.finishNode, showCredits: l.showCredits, expandedGuide: l.expandedGuide };
  ((l.lostFoundCount = function () {
    return o.filter((h) => this.state.inventory.includes(h)).length;
  }),
    (l.finishNode = function (h, d = {}) {
      let f = h?.thread === "lostfound" && !this.state.rewarded.includes(this.scene.key + ":" + h.id);
      if ((c.finishNode.call(this, h, d), !f)) return;
      let g = this.lostFoundCount();
      if (g < o.length || this.state.sidequests.includes(i)) {
        // The side case's own toast (or a rank-up) stays; the thread count is added to it.
        V("toast").textContent += ` \xB7 LOST-AND-FOUND HOUR ${g} / ${o.length}`;
        return;
      }
      let u = Math.floor(this.state.xp / 180);
      (this.state.sidequests.push(i),
        this.state.inventory.includes(r) || this.state.inventory.push(r),
        (this.state.xp += 60),
        (this.state.empathy += 2),
        this.state.history.push({
          scene: this.state.scene,
          label: i,
          text: "Five notices recorded. Oriel’s hour reaches further than it did.",
        }),
        this.save(),
        this.audio.evidence(),
        this.input.rumble(0.4, 180),
        this.showModal(
          "The lost-and-found hour.",
          "",
          "SIDE CASE THREAD / FIVE NOTICES RECORDED",
          "result",
        ),
        V("modal-actions").insertAdjacentHTML(
          "beforebegin",
          `<p class="quote-result">A ticket in a hotel cistern. A list on your kitchen radio. A card by a club phone. A relay under a Bradbury cornice. The last notice before dawn. Somewhere below the rain, Oriel reads the list again tomorrow night, a little further than before.</p><div class="item-strip"><div class="item-icon">◇</div><div><span>KEEPSAKE / +60 XP${Math.floor(this.state.xp / 180) > u ? " \xB7 FIELD RANK INCREASED" : ""}</span><strong>${Pt(r)}</strong></div></div>`,
        ),
        this.buttons([{ label: "BACK TO THE NIGHT", primary: !0, on: () => this.closeModal() }]));
    }),
    (l.showCredits = function () {
      if ((c.showCredits.call(this), !V("modal-actions"))) return;
      let h = this.lostFoundCount(),
        d = document.createElement("p");
      ((d.className = "life-end"),
        (d.textContent = this.state.sidequests.includes(i)
          ? "Somewhere below the rain, 88.1 is still reading lost things back to their owners."
          : `The lost-and-found hour: ${h} of ${o.length} notices recorded.`),
        V("modal-actions").before(d));
    }),
    (l.expandedGuide = function () {
      c.expandedGuide.call(this);
      let h = document.createElement("section");
      ((h.className = "guide-section"),
        (h.innerHTML = `<h3>THE LOST-AND-FOUND HOUR / NEW SIDE CASES</h3><p>A late radio hour on 88.1 reads lost property back to the city. Five amber side cases follow it through the case, one each in Leon’s hotel bathroom, Deckard’s apartment, the vid-phone alcove at Taffey’s, the street outside the Bradbury, and the corridor near the end of the night. Every route visits all five. Record all five to close the thread. You have ${this.lostFoundCount()} of ${o.length}.</p>`),
        V("journal-content")?.prepend(h));
    }));
}
installLostAndFoundHour(Al, { SCENES: Ve, ITEMS: W_, sceneIndex: Qr });
var kit = await boot({
  title: "Electric Sheepish",
  canvas: V("world"),
  holdLoading: !0,
  background: "#081720",
  accent: "#a1ffdc",
  // The HUD's top-right tools and the game's own pause and settings screens hold the corners;
  // the settings panel opens from Settings > Graphics & controls, or F9.
  gear: "none",
  touch: { hint: !1 },
  input: {
    move: {
      type: "vector",
      keys: { up: ["KeyW", "ArrowUp"], down: ["KeyS", "ArrowDown"], left: ["KeyA"], right: ["KeyD"] },
      gamepad: "leftStick+dpad",
      touch: "stick",
    },
    look: { type: "look", mouse: "drag", gamepad: "rightStick", touch: "drag" },
    // The original keyboard layout turns with the left and right arrows.
    turn: { type: "axis", keys: { pos: ["ArrowLeft"], neg: ["ArrowRight"] } },
    action: { keys: ["KeyF", "Space"], gamepad: ["A", "RT"], touch: "Act" },
    interact: { keys: ["KeyE"], gamepad: ["X"] },
    scan: { keys: ["KeyQ"], gamepad: ["Y"], touch: "Scan" },
    reload: { keys: ["KeyR"], gamepad: ["RB"] },
    sprint: { keys: ["ShiftLeft", "ShiftRight"], gamepad: ["LT"] },
    runToggle: { gamepad: ["LS"], touch: "Run" },
    crouch: { keys: ["KeyC"] },
    crouchToggle: { gamepad: ["B"], touch: "Crouch" },
    journal: { keys: ["Tab"], gamepad: ["Back"] },
    map: { keys: ["KeyM"], gamepad: ["LB"] },
    district: { keys: ["KeyB"] },
    life: { keys: ["KeyV"] },
    pause: { keys: ["Escape", "KeyP"], gamepad: ["Start"] },
    confirm: { keys: ["Enter", "NumpadEnter"], gamepad: ["A"] },
    back: { gamepad: ["B"] },
    choice1: { keys: ["Digit1"] },
    choice2: { keys: ["Digit2"] },
    choice3: { keys: ["Digit3"] },
    choice4: { keys: ["Digit4"] },
  },
});
var bX = new Al(kit);
new URLSearchParams(location.search).has("test") && (window.__ES_GAME__ = bX);
// Build the title scene's pipelines before the loading card lifts, so the first frames do not stutter.
try {
  await kit.renderer.compileAsync(bX.renderer.scene, bX.renderer.camera);
} catch (e) {
  console.warn("Pipeline warm-up skipped:", e?.message || e);
}
kit.loading.done();
