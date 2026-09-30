/**
 * data.js — every room, word and lesson in Hudson’s little home.
 *
 * A word is one tappable thing in a room. Each word has exactly two lesson
 * pages ("Look" and "More") of three picture choices. A choice names the 3D
 * model it shows, what is said (its label, then its lines), and optionally a
 * variant (whose it is, a colour, a part) and an action the model acts out
 * (a door opening, a lid lifting, a duck floating…).
 */

/** One picture choice: its label is always said first. */
const choice = (label, model, lines, variant = '', action = '') => ({
  label,
  model,
  lines: [label + '.', ...lines],
  variant,
  action,
});
const page = (title, choices) => ({ title, choices });

export const KITCHEN_WORDS = [
  { id: 'fridge', word: 'Fridge', line: 'The fridge keeps food cold.', color: '#dfece1', category: 'room' },
  { id: 'chair', word: 'Chair', line: 'We sit on a chair.', color: '#f5e4ce', category: 'room' },
  { id: 'apple', word: 'Apple', line: 'This is a red apple.', color: '#f8ded7', category: 'food' },
  { id: 'cup', word: 'Cup', line: 'We drink from a cup.', color: '#e2e9f3', category: 'things' },
  { id: 'towel', word: 'Towel', line: 'A towel can dry our hands.', color: '#f5dfd5', category: 'things' },
  { id: 'sink', word: 'Sink', line: 'We wash our hands in the sink.', color: '#e1ece8', category: 'room' },
  { id: 'table', word: 'Table', line: 'Our food goes on the table.', color: '#efe3d1', category: 'room' },
  { id: 'spoon', word: 'Spoon', line: 'We eat with a spoon.', color: '#e3eaf0', category: 'things' },
  { id: 'bowl', word: 'Bowl', line: 'Food can go in a bowl.', color: '#e2e7f1', category: 'things' },
  { id: 'plate', word: 'Plate', line: 'Food goes on a plate.', color: '#f5ead5', category: 'things' },
  { id: 'banana', word: 'Banana', line: 'This is a yellow banana.', color: '#faf0c9', category: 'food' },
  { id: 'orange', word: 'Orange', line: 'An orange is round.', color: '#f7e2c8', category: 'food' },
  { id: 'bread', word: 'Bread', line: 'This is a loaf of bread.', color: '#f1e1c9', category: 'food' },
  { id: 'milk', word: 'Milk', line: 'Milk goes in the fridge.', color: '#e3eaf3', category: 'food' },
  {
    id: 'stove',
    word: 'Stove',
    line: 'A stove can be hot. Ask a grown-up.',
    color: '#f3e3d6',
    category: 'room',
    safety: true,
  },
  {
    id: 'oven',
    word: 'Oven',
    line: 'An oven can be hot. Ask a grown-up.',
    color: '#eee4d9',
    category: 'room',
    safety: true,
  },
  {
    id: 'pot',
    word: 'Pot',
    line: 'A pot can be hot. Ask a grown-up.',
    color: '#e4ead9',
    category: 'things',
    safety: true,
  },
  {
    id: 'pan',
    word: 'Pan',
    line: 'A pan can be hot. Ask a grown-up.',
    color: '#e4e7ea',
    category: 'things',
    safety: true,
  },
  {
    id: 'kettle',
    word: 'Kettle',
    line: 'A kettle can be hot. Ask a grown-up.',
    color: '#f5e6c9',
    category: 'things',
    safety: true,
  },
  {
    id: 'toaster',
    word: 'Toaster',
    line: 'A toaster can be hot. Ask a grown-up.',
    color: '#f5e0d6',
    category: 'things',
    safety: true,
  },
  { id: 'tap', word: 'Tap', line: 'Water comes from the tap.', color: '#e2eae8', category: 'things' },
  { id: 'soap', word: 'Soap', line: 'Soap helps us wash our hands.', color: '#e8e5f0', category: 'things' },
  { id: 'fork', word: 'Fork', line: 'We eat with a fork.', color: '#e5e8ed', category: 'things' },
  {
    id: 'cutting-board',
    word: 'Cutting board',
    line: 'A grown-up cuts food on this board.',
    color: '#efdfc7',
    category: 'things',
  },
  { id: 'jar', word: 'Jar', line: 'Food can go in a jar.', color: '#ede6d5', category: 'things' },
  { id: 'cabinet', word: 'Cabinet', line: 'We keep dishes in a cabinet.', color: '#e0e9dc', category: 'room' },
  { id: 'drawer', word: 'Drawer', line: 'Spoons can go in a drawer.', color: '#e6ecd9', category: 'room' },
  {
    id: 'dishwasher',
    word: 'Dishwasher',
    line: 'The dishwasher cleans our dishes.',
    color: '#e7eeea',
    category: 'room',
  },
  {
    id: 'microwave',
    word: 'Microwave',
    line: 'A microwave heats food. Ask a grown-up.',
    color: '#ede5de',
    category: 'room',
    safety: true,
  },
  { id: 'bin', word: 'Bin', line: 'Rubbish goes in the bin.', color: '#e0e8e5', category: 'room' },
  { id: 'plant', word: 'Plant', line: 'This plant has green leaves.', color: '#e2eddc', category: 'things' },
  { id: 'clock', word: 'Clock', line: 'A clock shows the time.', color: '#f6e9ce', category: 'room' },
  { id: 'light', word: 'Light', line: 'The light helps us see.', color: '#f6ebcf', category: 'room' },
  {
    id: 'window',
    word: 'Window',
    line: 'We look through the window.',
    color: '#dfedf0',
    category: 'room',
    surface: true,
  },
  { id: 'wall', word: 'Wall', line: 'This is the kitchen wall.', color: '#eee9dc', category: 'room', surface: true },
  { id: 'floor', word: 'Floor', line: 'We walk on the floor.', color: '#efe2cc', category: 'room', surface: true },
  { id: 'rug', word: 'Rug', line: 'The rug is on the floor.', color: '#f0dfd7', category: 'room', surface: true },
  { id: 'door', word: 'Door', line: 'We go through the door.', color: '#e7e7d6', category: 'room', surface: true },
];

export const FAMILY_WORDS = [
  { id: 'sofa', word: 'Sofa', line: 'We sit together on the sofa.', color: '#e3eadb', category: 'room' },
  { id: 'armchair', word: 'Chair', line: 'We sit on the chair.', color: '#eadfd5', category: 'room' },
  { id: 'pillow', word: 'Pillow', line: 'A pillow is soft.', color: '#e8e2ef', category: 'things' },
  { id: 'blanket', word: 'Blanket', line: 'A blanket can keep us warm.', color: '#e5e9d7', category: 'things' },
  { id: 'coffee-table', word: 'Table', line: 'Books can go on the table.', color: '#eee1cf', category: 'room' },
  {
    id: 'side-table',
    word: 'Side table',
    line: 'The lamp sits on the side table.',
    color: '#eee4d5',
    category: 'room',
  },
  { id: 'book', word: 'Book', line: 'We look at pictures in a book.', color: '#f2dfd2', category: 'things' },
  { id: 'bookshelf', word: 'Bookshelf', line: 'Books go on the bookshelf.', color: '#e4eadb', category: 'room' },
  { id: 'toy-box', word: 'Toy box', line: 'Toys go in the toy box.', color: '#e7e4d3', category: 'room' },
  { id: 'ball', word: 'Ball', line: 'The ball can roll.', color: '#e1e9f0', category: 'things' },
  { id: 'blocks', word: 'Blocks', line: 'We can stack blocks.', color: '#f3e6ca', category: 'things' },
  { id: 'teddy', word: 'Teddy bear', line: 'The teddy bear is soft.', color: '#efe1d1', category: 'things' },
  { id: 'lamp', word: 'Lamp', line: 'The lamp makes light.', color: '#f4e9cd', category: 'room', safety: true },
  {
    id: 'television',
    word: 'Television',
    line: 'We can watch pictures on the television.',
    color: '#e2e6e9',
    category: 'room',
    safety: true,
  },
  {
    id: 'remote',
    word: 'Remote',
    line: 'Mom or Dad uses the remote.',
    color: '#e5e5df',
    category: 'things',
    safety: true,
  },
  { id: 'picture', word: 'Picture', line: 'A picture can show our family.', color: '#efe4d4', category: 'things' },
  { id: 'family-plant', word: 'Plant', line: 'The plant has green leaves.', color: '#e2eddc', category: 'things' },
  {
    id: 'family-window',
    word: 'Window',
    line: 'We look outside through the window.',
    color: '#dfedf0',
    category: 'room',
    surface: true,
  },
  { id: 'curtain', word: 'Curtain', line: 'The curtain can cover the window.', color: '#e6e2ef', category: 'room' },
  {
    id: 'family-rug',
    word: 'Rug',
    line: 'The rug is on the floor.',
    color: '#f0dfd7',
    category: 'room',
    surface: true,
  },
  {
    id: 'family-wall',
    word: 'Wall',
    line: 'This is the family room wall.',
    color: '#eee9dc',
    category: 'room',
    surface: true,
  },
  {
    id: 'family-floor',
    word: 'Floor',
    line: 'Our feet go on the floor.',
    color: '#efe2cc',
    category: 'room',
    surface: true,
  },
  {
    id: 'family-door',
    word: 'Door',
    line: 'We go through the door with Mom or Dad.',
    color: '#e7e7d6',
    category: 'room',
    surface: true,
  },
  {
    id: 'outlet',
    word: 'Outlet',
    line: 'The outlet is for grown-ups. Do not touch.',
    color: '#eee7dc',
    category: 'room',
    safety: true,
  },
  { id: 'basket', word: 'Basket', line: 'Blankets can go in the basket.', color: '#eadfc8', category: 'things' },
  { id: 'family-clock', word: 'Clock', line: 'A clock shows the time.', color: '#f6e9ce', category: 'room' },
];

export const BATHROOM_WORDS = [
  { id: 'bath', word: 'Bath', line: 'We wash in the bath.', color: '#dfecee', category: 'room', safety: true },
  {
    id: 'bath-tap',
    word: 'Tap',
    line: 'Water comes from the tap.',
    color: '#e2eae8',
    category: 'things',
    safety: true,
  },
  { id: 'duck', word: 'Duck', line: 'The duck floats in the bath.', color: '#f8efc9', category: 'things' },
  { id: 'boat', word: 'Boat', line: 'The little boat floats.', color: '#f5e0d6', category: 'things' },
  { id: 'sponge', word: 'Sponge', line: 'A sponge is soft and squishy.', color: '#f7ecca', category: 'things' },
  {
    id: 'shampoo',
    word: 'Shampoo',
    line: 'Shampoo washes our hair.',
    color: '#e8e2ef',
    category: 'things',
    safety: true,
  },
  { id: 'toilet', word: 'Toilet', line: 'We use the toilet.', color: '#e7eeea', category: 'room' },
  { id: 'potty', word: 'Potty', line: 'Hudson can sit on the potty.', color: '#e6eed9', category: 'things' },
  { id: 'bath-sink', word: 'Sink', line: 'We brush our teeth at the sink.', color: '#e1ece8', category: 'room' },
  { id: 'mirror', word: 'Mirror', line: 'We see our face in the mirror.', color: '#e2ebf0', category: 'room' },
  {
    id: 'toothbrush',
    word: 'Toothbrush',
    line: 'We brush our teeth with a toothbrush.',
    color: '#f5e1d8',
    category: 'things',
  },
  {
    id: 'toothpaste',
    word: 'Toothpaste',
    line: 'A little toothpaste goes on the brush.',
    color: '#e3eaf3',
    category: 'things',
    safety: true,
  },
  { id: 'tooth-cup', word: 'Cup', line: 'Our toothbrushes stand in the cup.', color: '#e2e9f3', category: 'things' },
  { id: 'bath-soap', word: 'Soap', line: 'Soap makes bubbles.', color: '#e8e5f0', category: 'things' },
  {
    id: 'bath-towel',
    word: 'Towel',
    line: 'A big towel dries us after the bath.',
    color: '#dfe8ef',
    category: 'things',
  },
  { id: 'comb', word: 'Comb', line: 'We comb our hair.', color: '#f3e3d6', category: 'things' },
  {
    id: 'step-stool',
    word: 'Step stool',
    line: 'The step stool helps Hudson reach the sink.',
    color: '#efe3d1',
    category: 'room',
    safety: true,
  },
  {
    id: 'laundry',
    word: 'Laundry basket',
    line: 'Dirty clothes go in the basket.',
    color: '#eadfc8',
    category: 'room',
  },
  {
    id: 'bath-mat',
    word: 'Bath mat',
    line: 'The bath mat keeps our feet dry.',
    color: '#e2eddc',
    category: 'room',
    surface: true,
  },
  {
    id: 'bath-window',
    word: 'Window',
    line: 'Light comes through the window.',
    color: '#dfedf0',
    category: 'room',
    surface: true,
  },
  {
    id: 'bath-wall',
    word: 'Wall',
    line: 'This is the bathroom wall.',
    color: '#eee9dc',
    category: 'room',
    surface: true,
  },
  {
    id: 'bath-floor',
    word: 'Floor',
    line: 'The floor can be wet. We walk slowly.',
    color: '#efe2cc',
    category: 'room',
    surface: true,
    safety: true,
  },
  {
    id: 'bath-door',
    word: 'Door',
    line: 'We go through the door with Mom or Dad.',
    color: '#e7e7d6',
    category: 'room',
    surface: true,
  },
];

export const ROOMS = {
  kitchen: {
    key: 'kitchen',
    label: 'Kitchen',
    short: 'kitchen',
    number: '01',
    words: KITCHEN_WORDS,
    title: 'kitchen.',
    intro: 'So many things. So many new words.',
  },
  family: {
    key: 'family',
    label: 'Family room',
    short: 'family room',
    number: '02',
    words: FAMILY_WORDS,
    title: 'family room.',
    intro: 'Soft things. Play things. Family words.',
  },
  bathroom: {
    key: 'bathroom',
    label: 'Bathroom',
    short: 'bathroom',
    number: '03',
    words: BATHROOM_WORDS,
    title: 'bathroom.',
    intro: 'Splash and wash. Bath time words.',
  },
};

/** The order the rooms come in (the room button goes to the next one). */
export const ROOM_ORDER = ['kitchen', 'family', 'bathroom'];

export const LESSONS = {
  cup: [
    page('Our cups', [
      choice("Mom's cup", 'cup', ['Mom drinks from a cup.'], 'mom'),
      choice("Dad's cup", 'cup', ['Dad drinks from a cup.'], 'dad'),
      choice("Hudson's cup", 'cup', ['This cup is for Hudson.', 'We drink from cups.'], 'hudson'),
    ]),
    page('In a cup', [
      choice('Water', 'drink', ['Water in the cup.', 'We drink water.'], 'water'),
      choice('Juice', 'drink', ['Juice in the cup.', 'We drink juice.'], 'juice'),
      choice('Milk', 'drink', ['Milk in the cup.', 'We drink milk.'], 'milk'),
    ]),
  ],
  drawer: [
    page('Look with Mom or Dad', [
      choice('Drawer', 'drawer', ["Mom's things.", "Dad's things.", 'We do not open it.'], '', 'drawer-demo'),
      choice('Spoon', 'drawer', ['A spoon in the drawer.', 'Ask Mom or Dad.'], 'spoon', 'drawer-demo'),
      choice('Fork', 'drawer', ['A fork in the drawer.', 'Ask Mom or Dad.'], 'fork', 'drawer-demo'),
    ]),
    page('Mom and Dad help', [
      choice("Mom's towel", 'drawer', ['A towel in the drawer.', 'Mom opens the drawer.'], 'towel', 'drawer-demo'),
      choice("Dad's spoon", 'drawer', ['Dad opens the drawer.', 'We do not open it.'], 'spoon', 'drawer-demo'),
      choice('Closed', 'drawer', ['The drawer is closed.', 'We do not open it.'], '', 'closed'),
    ]),
  ],
  fridge: [
    page('In the fridge', [
      choice('Fridge', 'fridge', ['The fridge keeps food cold.', 'Mom opens the fridge.'], '', 'fridge-demo'),
      choice('Milk', 'milk', ['Milk goes in the fridge.', 'The milk is cold.']),
      choice('Apple', 'apple', ['An apple in the fridge.', 'Mom gets the apple.']),
    ]),
    page('Look inside', [
      choice('Door', 'fridge', ['The fridge has a door.', 'Dad opens the door.'], '', 'fridge-demo'),
      choice('Shelf', 'fridge', ['Food sits on a shelf.', 'Mom puts food inside.'], '', 'fridge-demo'),
      choice('Closed', 'fridge', ['The fridge door is closed.', 'The food stays cold.'], '', 'closed'),
    ]),
  ],
  chair: [
    page('Our chairs', [
      choice("Mom's chair", 'chair', ['Mom sits on a chair.'], 'mom'),
      choice("Dad's chair", 'chair', ['Dad sits on a chair.'], 'dad'),
      choice("Hudson's chair", 'highchair', ['Hudson sits to eat.', 'Mom or Dad helps.']),
    ]),
    page('Parts of a chair', [
      choice('Seat', 'chair', ['We sit on the seat.', 'We sit down.'], 'seat'),
      choice('Back', 'chair', ['The chair has a back.'], 'back'),
      choice('Legs', 'chair', ['The chair has four legs.'], 'legs'),
    ]),
  ],
  towel: [
    page('A towel helps', [
      choice('Towel', 'towel', ['A towel feels soft.']),
      choice('Wet hands', 'hands', ['Our hands are wet.'], 'wet'),
      choice('Dry hands', 'hands', ['A towel dries our hands.'], 'dry'),
    ]),
    page('Our towels', [
      choice("Mom's towel", 'towel', ['Mom dries her hands.'], 'mom'),
      choice("Dad's towel", 'towel', ['Dad dries his hands.'], 'dad'),
      choice("Hudson's towel", 'towel', ['Hudson dries his hands.'], 'hudson'),
    ]),
  ],
  sink: [
    page('At the sink', [
      choice('Sink', 'sink', ['We wash at the sink.']),
      choice('Water', 'wash-sink', ['Water goes in the sink.', 'Mom or Dad helps.'], '', 'water'),
      choice('Soap', 'soap', ['Soap helps us wash.']),
    ]),
    page('Wash our hands', [
      choice('Wet', 'hands', ['Water makes our hands wet.'], 'wet'),
      choice('Wash', 'hands', ['We wash with soap.'], 'soap'),
      choice('Dry', 'hands', ['We dry with a towel.'], 'dry'),
    ]),
  ],
  table: [
    page('At our table', [
      choice('Table', 'table', ['We eat at the table.']),
      choice('Plate', 'table-set', ['A plate on the table.'], 'plate'),
      choice('Cup', 'table-set', ['A cup on the table.'], 'cup'),
    ]),
    page('Our places', [
      choice("Mom's place", 'table-set', ['Mom sits here.'], 'mom'),
      choice("Dad's place", 'table-set', ['Dad sits here.'], 'dad'),
      choice("Hudson's place", 'table-set', ['Hudson sits here.', 'We eat together.'], 'hudson'),
    ]),
  ],
  spoon: [
    page('Our spoons', [
      choice("Mom's spoon", 'spoon', ['Mom eats with a spoon.'], 'mom'),
      choice("Dad's spoon", 'spoon', ['Dad eats with a spoon.'], 'dad'),
      choice("Hudson's spoon", 'spoon', ['Hudson eats with a spoon.'], 'hudson'),
    ]),
    page('Use a spoon', [
      choice('Scoop', 'spoon-bowl', ['We scoop with a spoon.'], '', 'scoop'),
      choice('Bowl', 'bowl', ['A spoon goes in a bowl.']),
      choice('Handle', 'spoon', ['We hold the handle.'], 'handle'),
    ]),
  ],
  bowl: [
    page('Our bowls', [
      choice("Mom's bowl", 'bowl', ['Food goes in a bowl.'], 'mom'),
      choice("Dad's bowl", 'bowl', ['Dad eats from a bowl.'], 'dad'),
      choice("Hudson's bowl", 'bowl', ['Hudson eats from a bowl.'], 'hudson'),
    ]),
    page('In the bowl', [
      choice('Empty', 'bowl', ['Nothing is in the bowl.']),
      choice('Food', 'food-bowl', ['Food is in the bowl.']),
      choice('Spoon', 'spoon-bowl', ['We use a spoon.'], '', 'scoop'),
    ]),
  ],
  plate: [
    page('Our plates', [
      choice("Mom's plate", 'plate', ['Food goes on a plate.'], 'mom'),
      choice("Dad's plate", 'plate', ['Dad eats from a plate.'], 'dad'),
      choice("Hudson's plate", 'plate', ['Hudson eats from a plate.'], 'hudson'),
    ]),
    page('On the plate', [
      choice('Empty', 'plate', ['Nothing is on the plate.']),
      choice('Bread', 'food-plate', ['Bread is on the plate.'], 'bread'),
      choice('Apple', 'food-plate', ['Mom cuts the apple.', 'Apple is on the plate.'], 'apple'),
    ]),
  ],
  apple: [
    page('Look at the apple', [
      choice('Apple', 'apple', ['An apple is a fruit.']),
      choice('Red', 'apple', ['This apple is red.']),
      choice('Green', 'apple', ['This apple is green.'], 'green'),
    ]),
    page('Ready to eat', [
      choice('Wash', 'washed-fruit', ['Mom washes the apple.'], 'apple', 'water'),
      choice('Pieces', 'fruit-pieces', ['Mom cuts the apple.', 'Small pieces of apple.'], 'apple'),
      choice('Plate', 'food-plate', ['Apple goes on a plate.', 'We sit to eat.'], 'apple'),
    ]),
  ],
  banana: [
    page('Look at the banana', [
      choice('Banana', 'banana', ['A banana is a fruit.']),
      choice('Yellow', 'banana', ['The banana is yellow.']),
      choice('Peel', 'peeled-banana', ['Mom takes the peel off.']),
    ]),
    page('Ready to eat', [
      choice('Pieces', 'fruit-pieces', ['Mom cuts the banana.'], 'banana'),
      choice('Bowl', 'food-bowl', ['Banana goes in a bowl.'], 'banana'),
      choice('Spoon', 'spoon-bowl', ['We eat with a spoon.', 'We sit to eat.'], '', 'scoop'),
    ]),
  ],
  orange: [
    page('Look at the orange', [
      choice('Orange', 'orange', ['An orange is a fruit.']),
      choice('Round', 'orange', ['The orange is round.']),
      choice('Peel', 'orange-pieces', ['Dad takes the peel off.']),
    ]),
    page('Ready to eat', [
      choice('Pieces', 'orange-pieces', ['Dad cuts the orange.']),
      choice('Plate', 'food-plate', ['Orange goes on a plate.'], 'orange'),
      choice('Juice', 'drink', ['This is orange juice.', 'Juice goes in a cup.'], 'juice'),
    ]),
  ],
  bread: [
    page('Look at the bread', [
      choice('Bread', 'bread', ['This is a loaf.']),
      choice('Crust', 'bread', ['The crust is outside.'], 'crust'),
      choice('Slice', 'bread-slice', ['Mom cuts a slice.']),
    ]),
    page('Bread at the table', [
      choice('Plate', 'food-plate', ['Bread goes on a plate.'], 'bread'),
      choice('Toast', 'bread-slice', ['Toast is warm bread.', 'Mom checks the toast.'], 'toast'),
      choice('Pieces', 'fruit-pieces', ['Mom makes small pieces.', 'We sit to eat.'], 'bread'),
    ]),
  ],
  milk: [
    page('Look at the milk', [
      choice('Milk', 'milk', ['Milk is in the carton.']),
      choice('White', 'drink', ['The milk is white.'], 'milk'),
      choice('Cold', 'milk', ['The milk is cold.']),
    ]),
    page('Milk in a cup', [
      choice('Fridge', 'fridge', ['Milk goes in the fridge.'], '', 'fridge-demo'),
      choice('Cup', 'drink', ['Mom puts milk in a cup.'], 'milk'),
      choice("Hudson's cup", 'cup', ['Hudson drinks from a cup.'], 'hudson'),
    ]),
  ],
  stove: [
    page('Look with a grown-up', [
      choice('Stove', 'stove', ['Mom cooks on the stove.', 'Do not touch.']),
      choice('Pot', 'pot', ['A pot sits on the stove.', 'It can be hot.']),
      choice('Pan', 'pan', ['A pan sits on the stove.', 'It can be hot.']),
    ]),
    page('Stay safe', [
      choice('Hot', 'stove', ['The stove can be hot.', 'Do not touch.'], '', 'hot'),
      choice("Mom's job", 'pot', ['Mom cooks our food.', 'We stay back.'], '', 'hot'),
      choice("Dad's job", 'pan', ['Dad cooks our food.', 'We stay back.'], '', 'hot'),
    ]),
  ],
  oven: [
    page('Look at the oven', [
      choice('Oven', 'oven', ['The oven cooks food.', 'Do not touch.']),
      choice('Door', 'oven', ['The oven has a door.', 'Mom or Dad opens it.']),
      choice('Bread', 'bread', ['Dad bakes bread in it.']),
    ]),
    page('Stay safe', [
      choice('Hot', 'oven', ['The oven can be hot.', 'We stay back.'], '', 'hot'),
      choice('Handle', 'oven', ['Only Mom or Dad touches.']),
      choice('Closed', 'oven', ['We leave the door closed.', 'Ask Mom or Dad.']),
    ]),
  ],
  pot: [
    page('Parts of a pot', [
      choice('Pot', 'pot', ['Mom cooks in a pot.']),
      choice('Lid', 'pot', ['The lid is on top.', 'Mom lifts the lid.'], '', 'lid'),
      choice('Handles', 'pot', ['Dad holds the handles.', 'The pot can be hot.']),
    ]),
    page('Cooking with a grown-up', [
      choice('Food', 'food-pot', ['Dad cooks food in a pot.']),
      choice('Stove', 'stove', ['The pot goes on the stove.']),
      choice('Hot', 'pot', ['The pot can be hot.', 'Do not touch.'], '', 'hot'),
    ]),
  ],
  pan: [
    page('Parts of a pan', [
      choice('Pan', 'pan', ['Dad cooks in a pan.']),
      choice('Handle', 'pan', ['The pan has a handle.'], 'handle'),
      choice('Food', 'food-pan', ['Food goes in the pan.']),
    ]),
    page('Cooking with a grown-up', [
      choice('Stove', 'stove', ['The pan goes on the stove.']),
      choice("Mom's job", 'food-pan', ['Mom cooks our food.']),
      choice('Hot', 'pan', ['The pan can be hot.', 'Do not touch.'], '', 'hot'),
    ]),
  ],
  kettle: [
    page('Parts of a kettle', [
      choice('Kettle', 'kettle', ['The kettle heats water.']),
      choice('Handle', 'kettle', ['Dad holds the handle.']),
      choice('Spout', 'kettle', ['Water comes from the spout.']),
    ]),
    page('Look with a grown-up', [
      choice('Water', 'drink', ['Water goes in the kettle.'], 'water'),
      choice("Mom's cup", 'cup', ['Mom uses her cup.'], 'mom'),
      choice('Hot', 'kettle', ['The kettle can be hot.', 'Do not touch.'], '', 'hot'),
    ]),
  ],
  toaster: [
    page('Bread and toast', [
      choice('Toaster', 'toaster', ['Dad makes toast in it.']),
      choice('Bread', 'bread-slice', ['Bread goes in the toaster.']),
      choice('Toast', 'bread-slice', ['The bread becomes toast.'], 'toast'),
    ]),
    page('Mom and Dad help', [
      choice('Hot', 'toaster', ['The toaster can be hot.', 'Do not touch.'], '', 'hot'),
      choice('Plate', 'food-plate', ['Mom puts toast on a plate.'], 'toast'),
      choice('Cool', 'bread-slice', ['Mom checks the toast.', 'We wait.'], 'toast'),
    ]),
  ],
  tap: [
    page('Water from the tap', [
      choice('Tap', 'tap', ['Water comes from the tap.']),
      choice('On', 'wash-sink', ['Mom turns the water on.'], '', 'water'),
      choice('Off', 'wash-sink', ['Dad turns the water off.']),
    ]),
    page('Wash with a grown-up', [
      choice('Water', 'hands', ['Water makes our hands wet.'], 'wet'),
      choice('Soap', 'hands', ['We wash with soap.'], 'soap'),
      choice('Towel', 'towel', ['We dry with a towel.']),
    ]),
  ],
  soap: [
    page('Soap and water', [
      choice('Soap', 'soap', ['Soap helps us wash.']),
      choice('Pump', 'soap', ['Mom presses the pump.'], '', 'pump'),
      choice('Bubbles', 'hands', ['Look at the soap bubbles.'], 'soap'),
    ]),
    page('Clean hands', [
      choice('Wash', 'hands', ['We wash our hands.'], 'soap'),
      choice('Rinse', 'hands', ['Water washes the soap off.'], 'wet'),
      choice('Dry', 'hands', ['A towel dries our hands.'], 'dry'),
    ]),
  ],
  fork: [
    page('Our forks', [
      choice("Mom's fork", 'fork', ['Mom eats with a fork.'], 'mom'),
      choice("Dad's fork", 'fork', ['Dad eats with a fork.'], 'dad'),
      choice("Hudson's fork", 'fork', ['Mom helps Hudson eat.'], 'hudson'),
    ]),
    page('At the table', [
      choice('Handle', 'fork', ['We hold the handle.'], 'handle'),
      choice('Plate', 'plate', ['Food is on the plate.']),
      choice('Drawer', 'drawer', ['Forks go in the drawer.', 'Ask Mom or Dad.'], 'fork', 'drawer-demo'),
    ]),
  ],
  'cutting-board': [
    page('Mom and Dad use it', [
      choice('Cutting board', 'cutting-board', ['Mom cuts food here.']),
      choice('Apple', 'fruit-pieces', ['Mom cuts the apple.'], 'apple'),
      choice('Bread', 'bread-slice', ['Dad cuts the bread.']),
    ]),
    page('Food for Hudson', [
      choice('Pieces', 'fruit-pieces', ['Small pieces for Hudson.'], 'apple'),
      choice('Plate', 'food-plate', ['The food goes on a plate.'], 'apple'),
      choice('Wash', 'cutting-board', ['Mom washes the board.'], '', 'water'),
    ]),
  ],
  jar: [
    page('Parts of a jar', [
      choice('Jar', 'jar', ['We keep food in a jar.']),
      choice('Lid', 'jar', ['The lid goes on top.', 'Mom opens the jar.'], '', 'lid'),
      choice('Closed', 'jar', ['The lid is on the jar.']),
    ]),
    page('Look with a grown-up', [
      choice('Food', 'food-bowl', ['Mom takes food out.']),
      choice('Bowl', 'bowl', ['Food goes in a bowl.']),
      choice('Shelf', 'cabinet', ['Dad puts the jar away.', 'Ask Mom or Dad.'], '', 'cabinet-demo'),
    ]),
  ],
  cabinet: [
    page('Inside the cabinet', [
      choice('Cabinet', 'cabinet', ['Mom opens the cabinet.', 'Ask Mom or Dad.'], '', 'cabinet-demo'),
      choice('Plates', 'cabinet', ['Plates are inside.', 'Mom gets a plate.'], 'plate', 'cabinet-demo'),
      choice('Bowls', 'cabinet', ['Bowls are inside.', 'Dad gets a bowl.'], 'bowl', 'cabinet-demo'),
    ]),
    page('Put things away', [
      choice('Cup', 'cup', ['Mom puts a cup away.'], 'mom'),
      choice('Shelf', 'cabinet', ['Dishes sit on the shelf.'], '', 'cabinet-demo'),
      choice('Closed', 'cabinet', ['The cabinet is closed.', 'Ask Mom or Dad.'], '', 'closed'),
    ]),
  ],
  dishwasher: [
    page('Clean our dishes', [
      choice('Dishwasher', 'dishwasher', ['It washes our dishes.', 'Mom or Dad uses it.']),
      choice('Plate', 'plate', ['Mom puts a plate inside.']),
      choice('Cup', 'cup', ['Dad puts a cup inside.'], 'dad'),
    ]),
    page('Before and after', [
      choice('Dirty', 'dirty-plate', ['The plate is dirty.']),
      choice('Wash', 'dishwasher', ['Water washes the dishes.', 'We leave it closed.']),
      choice('Clean', 'plate', ['Now the plate is clean.', 'Dad takes it out.']),
    ]),
  ],
  microwave: [
    page('Warm our food', [
      choice('Microwave', 'microwave', ['It makes our food warm.', 'Mom or Dad uses it.']),
      choice('Bowl', 'food-bowl', ['Mom puts food inside.']),
      choice('Door', 'microwave', ['The microwave has a door.', 'We leave it closed.']),
    ]),
    page('Mom and Dad help', [
      choice('Hot', 'microwave', ['The food can be hot.', 'Do not touch.'], '', 'hot'),
      choice('Wait', 'food-bowl', ['Mom checks the food.', 'We wait.']),
      choice('Table', 'table-set', ['Dad brings food to the table.'], 'plate'),
    ]),
  ],
  bin: [
    page('Things we throw away', [
      choice('Bin', 'bin', ['Trash goes in the bin.']),
      choice('Paper', 'paper', ['Used paper goes in the bin.']),
      choice('Peel', 'peeled-banana', ['Mom puts the peel away.']),
    ]),
    page('Keep our kitchen clean', [
      choice('Lid', 'bin', ['The lid goes on top.'], '', 'lid'),
      choice('Closed', 'bin', ['We keep the bin closed.']),
      choice('Wash', 'hands', ['We wash our hands.'], 'soap'),
    ]),
  ],
  plant: [
    page('Parts of a plant', [
      choice('Plant', 'plant', ['The plant grows.']),
      choice('Leaves', 'plant', ['The leaves are green.'], 'leaves'),
      choice('Pot', 'plant', ['The plant is in a pot.'], 'pot'),
    ]),
    page('Help the plant grow', [
      choice('Water', 'plant', ['Dad gives the plant water.'], '', 'water'),
      choice('Light', 'plant', ['The plant needs light.'], '', 'light'),
      choice('Look', 'plant', ['We look at the leaves.', 'Leaves stay on the plant.']),
    ]),
  ],
  clock: [
    page('Look at the clock', [
      choice('Clock', 'clock', ['A clock shows the time.']),
      choice('Long hand', 'clock', ['This hand is long.'], 'long'),
      choice('Short hand', 'clock', ['This hand is short.'], 'short'),
    ]),
    page('Time in our day', [
      choice('Tick', 'clock', ['The clock hands move.'], '', 'tick'),
      choice('Eat', 'table-set', ['It is time to eat.'], 'plate'),
      choice('Wash', 'hands', ['It is time to wash.'], 'soap'),
    ]),
  ],
  light: [
    page('Look at the light', [
      choice('Light', 'light', ['The light helps us see.']),
      choice('On', 'light', ['The light is on.'], '', 'light'),
      choice('Off', 'light', ['The light is off.'], 'off'),
    ]),
    page('Light in the kitchen', [
      choice('Bright', 'light', ['The light is bright.'], '', 'light'),
      choice('Shade', 'light', ['The light has a shade.']),
      choice('High', 'light', ['The light is up high.', 'Mom or Dad changes it.']),
    ]),
  ],
  window: [
    page('Look through the window', [
      choice('Window', 'window', ['We look through the window.']),
      choice('Outside', 'window', ['We can see outside.']),
      choice('Sun', 'window', ['The sun is outside.']),
    ]),
    page('At the window', [
      choice('Light', 'window', ['Light comes through the window.']),
      choice('Curtain', 'window', ['Curtains are by the window.']),
      choice('Closed', 'window', ['Mom or Dad opens windows.', 'We stay on the floor.']),
    ]),
  ],
  wall: [
    page('Our kitchen wall', [
      choice('Wall', 'wall', ['The wall is tall.']),
      choice('Clock', 'clock', ['The clock is on the wall.']),
      choice('Window', 'window', ['The window is in the wall.']),
    ]),
    page('Things on the wall', [
      choice('Cabinet', 'cabinet', ['The cabinet is on the wall.']),
      choice('Tiles', 'wall', ['These are kitchen tiles.']),
      choice('Door', 'door', ['The door is in the wall.']),
    ]),
  ],
  floor: [
    page('Under our feet', [
      choice('Floor', 'floor', ['We walk on the floor.']),
      choice('Rug', 'rug', ['The rug is on the floor.']),
      choice('Chair', 'chair', ['The chair is on the floor.']),
    ]),
    page('On the floor', [
      choice('Table', 'table', ['The table stands on the floor.']),
      choice('Bin', 'bin', ['The bin is on the floor.']),
      choice('Walk', 'floor', ['We walk in the kitchen.']),
    ]),
  ],
  rug: [
    page('Look at the rug', [
      choice('Rug', 'rug', ['The rug is on the floor.']),
      choice('Soft', 'rug', ['This rug feels soft.']),
      choice('Stripes', 'rug', ['The rug has stripes.']),
    ]),
    page('Around the rug', [
      choice('Floor', 'floor', ['The floor is under the rug.']),
      choice('Table', 'table', ['The table is on the rug.']),
      choice('Flat', 'rug', ['The rug lies flat.']),
    ]),
  ],
  door: [
    page('Parts of a door', [
      choice('Door', 'door', ['We go through the door.']),
      choice('Handle', 'door', ['Mom holds the handle.']),
      choice('Closed', 'door', ['This door is closed.']),
    ]),
    page('Go with a grown-up', [
      choice('Mom', 'door', ['Mom opens the door.', 'We go with Mom.']),
      choice('Dad', 'door', ['Dad closes the door.', 'Fingers stay away.']),
      choice('Wait', 'door', ['We wait for Mom or Dad.']),
    ]),
  ],
  sofa: [
    page('Our sofa', [
      choice("Mom's spot", 'sofa', ['Mom can sit on the sofa.'], 'mom'),
      choice("Dad's spot", 'sofa', ['Dad can sit on the sofa.'], 'dad'),
      choice("Hudson's spot", 'sofa', ['Hudson can sit with Mom or Dad.'], 'hudson'),
    ]),
    page('On the sofa', [
      choice('Sit', 'sofa', ['We sit on the sofa.']),
      choice('Pillow', 'pillow', ['A pillow can go on the sofa.']),
      choice('Blanket', 'blanket', ['A blanket can go on the sofa.']),
    ]),
  ],
  armchair: [
    page('A chair', [
      choice('Chair', 'armchair', ['We sit on the chair.']),
      choice('Seat', 'armchair', ['We sit on the seat.']),
      choice('Back', 'armchair', ['The chair has a back.']),
    ]),
    page('Chair parts', [
      choice('Arms', 'armchair', ['The chair has two arms.']),
      choice('Legs', 'armchair', ['The chair has four legs.']),
      choice('Sit down', 'armchair', ['We sit down on the chair.']),
    ]),
  ],
  pillow: [
    page('Our pillows', [
      choice("Mom's pillow", 'pillow', ['Mom has a pillow.'], 'mom'),
      choice("Dad's pillow", 'pillow', ['Dad has a pillow.'], 'dad'),
      choice("Hudson's pillow", 'pillow', ['Hudson has a pillow.'], 'hudson'),
    ]),
    page('A soft pillow', [
      choice('Soft', 'pillow', ['The pillow feels soft.']),
      choice('Head', 'pillow', ['Our head can rest on a pillow.']),
      choice('Sofa', 'sofa', ['A pillow can sit on the sofa.']),
    ]),
  ],
  blanket: [
    page('Our blankets', [
      choice("Mom's blanket", 'blanket', ['Mom can use a blanket.'], 'mom'),
      choice("Dad's blanket", 'blanket', ['Dad can use a blanket.'], 'dad'),
      choice("Hudson's blanket", 'blanket', ['Hudson can use a blanket.'], 'hudson'),
    ]),
    page('Warm and soft', [
      choice('Warm', 'blanket', ['A blanket can keep us warm.']),
      choice('Soft', 'blanket', ['The blanket feels soft.']),
      choice('Fold', 'blanket', ['We can fold the blanket.']),
    ]),
  ],
  'coffee-table': [
    page('The table', [
      choice('Table', 'coffee-table', ['The table is in the family room.']),
      choice('Book', 'book', ['A book can go on the table.']),
      choice('Basket', 'basket', ['A basket can sit near the table.']),
    ]),
    page('Around the table', [
      choice('Top', 'coffee-table', ['Things can sit on top.']),
      choice('Legs', 'coffee-table', ['The table has legs.']),
      choice('Feet down', 'coffee-table', ['Our feet stay on the floor.', 'We do not climb on the table.']),
    ]),
  ],
  'side-table': [
    page('Side table', [
      choice('Table', 'side-table', ['This is a small table.']),
      choice('Lamp', 'lamp', ['The lamp sits on the table.']),
      choice('Book', 'book', ['A book can sit on the table.']),
    ]),
    page('Look closely', [
      choice('Top', 'side-table', ['This is the top.']),
      choice('Legs', 'side-table', ['The table has legs.']),
      choice('Floor', 'family-floor', ['The table stands on the floor.']),
    ]),
  ],
  book: [
    page('Our books', [
      choice("Mom's book", 'book', ['Mom can read a book.'], 'mom'),
      choice("Dad's book", 'book', ['Dad can read a book.'], 'dad'),
      choice("Hudson's book", 'book', ['Hudson can look at a book.'], 'hudson'),
    ]),
    page('Inside a book', [
      choice('Open', 'book', ['We open the book.']),
      choice('Page', 'book', ['A book has pages.']),
      choice('Pictures', 'book', ['We look at the pictures.']),
    ]),
  ],
  bookshelf: [
    page('Books on a shelf', [
      choice('Bookshelf', 'bookshelf', ['Books go on the bookshelf.']),
      choice('Book', 'book', ['A book sits on the shelf.']),
      choice('Shelf', 'bookshelf', ['This is a shelf.']),
    ]),
    page('Ask for a book', [
      choice('Look', 'bookshelf', ['We look at the books.']),
      choice('Ask', 'book', ['Ask Mom or Dad for a book.']),
      choice('No climbing', 'bookshelf', ['Feet stay on the floor.', 'We do not climb the shelf.']),
    ]),
  ],
  'toy-box': [
    page('Toys in the box', [
      choice('Toy box', 'toy-box', ['Toys go in the toy box.']),
      choice('Ball', 'ball', ['The ball can go in the box.']),
      choice('Blocks', 'blocks', ['Blocks can go in the box.']),
    ]),
    page('Clean up', [
      choice('In', 'toy-box', ['Put the toy in.']),
      choice('Out', 'ball', ['Take one toy out.']),
      choice('All done', 'toy-box', ['We put toys away when we are done.']),
    ]),
  ],
  ball: [
    page('A ball', [
      choice('Ball', 'ball', ['This is a ball.']),
      choice('Round', 'ball', ['The ball is round.']),
      choice('Soft', 'ball', ['This ball is soft.']),
    ]),
    page('Move the ball', [
      choice('Roll', 'ball', ['The ball rolls on the floor.']),
      choice('Stop', 'ball', ['The ball can stop.']),
      choice('Again', 'ball', ['Roll the ball again.']),
    ]),
  ],
  blocks: [
    page('Blocks', [
      choice('Block', 'blocks', ['This is a block.']),
      choice('Blocks', 'blocks', ['Here are many blocks.']),
      choice('Colors', 'blocks', ['Blocks can have colors.']),
    ]),
    page('Build with blocks', [
      choice('Stack', 'blocks', ['We stack blocks up.']),
      choice('Up', 'blocks', ['The blocks go up.']),
      choice('Down', 'blocks', ['The blocks can fall down.']),
    ]),
  ],
  teddy: [
    page('Teddy bear', [
      choice('Teddy', 'teddy', ['This is a teddy bear.']),
      choice('Soft', 'teddy', ['The teddy feels soft.']),
      choice('Hug', 'teddy', ['Hudson can hug the teddy.']),
    ]),
    page('Teddy parts', [
      choice('Ears', 'teddy', ['Teddy has two ears.']),
      choice('Arms', 'teddy', ['Teddy has two arms.']),
      choice('Feet', 'teddy', ['Teddy has two feet.']),
    ]),
  ],
  lamp: [
    page('The lamp', [
      choice('Lamp', 'lamp', ['This is a lamp.']),
      choice('Light', 'lamp', ['The lamp makes light.']),
      choice('Shade', 'lamp', ['The lamp has a shade.']),
    ]),
    page('Mom or Dad helps', [
      choice('On', 'lamp', ['Mom or Dad can turn the lamp on.']),
      choice('Off', 'lamp', ['Mom or Dad can turn the lamp off.']),
      choice('Cord', 'lamp', ['The cord is for grown-ups.', 'Do not pull the cord.']),
    ]),
  ],
  television: [
    page('The television', [
      choice('Television', 'television', ['We can watch the television.']),
      choice('Screen', 'television', ['Pictures show on the screen.']),
      choice('Sound', 'television', ['The television can make sound.']),
    ]),
    page('Watch with family', [
      choice('Mom', 'television', ['Hudson can watch with Mom.'], 'mom'),
      choice('Dad', 'television', ['Hudson can watch with Dad.'], 'dad'),
      choice('Hands off', 'television', ['We look at the screen.', 'Hands stay off the screen.']),
    ]),
  ],
  remote: [
    page('The remote', [
      choice('Remote', 'remote', ['This is the remote.']),
      choice('Buttons', 'remote', ['The remote has buttons.']),
      choice('Television', 'television', ['The remote can control the television.']),
    ]),
    page('Give it to a grown-up', [
      choice('Mom', 'remote', ['Give the remote to Mom.'], 'mom'),
      choice('Dad', 'remote', ['Give the remote to Dad.'], 'dad'),
      choice('Not in mouth', 'remote', ['The remote stays out of our mouth.']),
    ]),
  ],
  picture: [
    page('Our family', [
      choice('Mom', 'picture', ['Mom is in our family.'], 'mom'),
      choice('Dad', 'picture', ['Dad is in our family.'], 'dad'),
      choice('Hudson', 'picture', ['Hudson is in our family.'], 'hudson'),
    ]),
    page('A picture', [
      choice('Picture', 'picture', ['A picture can show people.']),
      choice('Frame', 'picture', ['The picture has a frame.']),
      choice('Wall', 'family-wall', ['The picture can hang on the wall.']),
    ]),
  ],
  'family-plant': [
    page('The plant', [
      choice('Plant', 'family-plant', ['This is a plant.']),
      choice('Leaves', 'family-plant', ['The plant has green leaves.']),
      choice('Pot', 'family-plant', ['The plant sits in a pot.']),
    ]),
    page('Help the plant', [
      choice('Water', 'family-plant', ['Plants need water.']),
      choice('Light', 'family-plant', ['Plants need light.']),
      choice('Look', 'family-plant', ['We can look at the plant.']),
    ]),
  ],
  'family-window': [
    page('Look outside', [
      choice('Window', 'family-window', ['We look through the window.']),
      choice('Outside', 'family-window', ['Outside is on the other side.']),
      choice('Glass', 'family-window', ['The window has glass.']),
    ]),
    page('Stay safe', [
      choice('Curtain', 'curtain', ['The curtain is by the window.']),
      choice('Inside', 'family-window', ['Hudson stays inside with Mom or Dad.']),
      choice('Floor', 'family-floor', ['Our feet stay on the floor.']),
    ]),
  ],
  curtain: [
    page('The curtain', [
      choice('Curtain', 'curtain', ['This is the curtain.']),
      choice('Window', 'family-window', ['The curtain is by the window.']),
      choice('Soft', 'curtain', ['The curtain is soft cloth.']),
    ]),
    page('Open and closed', [
      choice('Open', 'curtain', ['Mom or Dad can open the curtain.']),
      choice('Closed', 'curtain', ['The curtain can cover the window.']),
      choice('Help', 'curtain', ['Ask Mom or Dad for help.']),
    ]),
  ],
  'family-rug': [
    page('The rug', [
      choice('Rug', 'family-rug', ['The rug is on the floor.']),
      choice('Soft', 'family-rug', ['The rug can feel soft.']),
      choice('Feet', 'family-rug', ['Our feet can stand on the rug.']),
    ]),
    page('On the rug', [
      choice('Sit', 'family-rug', ['We can sit on the rug.']),
      choice('Ball', 'ball', ['A ball can roll on the rug.']),
      choice('Blocks', 'blocks', ['We can play with blocks on the rug.']),
    ]),
  ],
  'family-wall': [
    page('The wall', [
      choice('Wall', 'family-wall', ['This is the family room wall.']),
      choice('Picture', 'picture', ['A picture can hang on the wall.']),
      choice('Outlet', 'outlet', ['An outlet can be on the wall.']),
    ]),
    page('Around the room', [
      choice('Window', 'family-window', ['A window is in the wall.']),
      choice('Door', 'family-door', ['A door is in the wall.']),
      choice('Room', 'family-wall', ['Walls go around the room.']),
    ]),
  ],
  'family-floor': [
    page('The floor', [
      choice('Floor', 'family-floor', ['We walk on the floor.']),
      choice('Rug', 'family-rug', ['The rug is on the floor.']),
      choice('Feet', 'family-floor', ['Our feet go on the floor.']),
    ]),
    page('Play on the floor', [
      choice('Ball', 'ball', ['The ball rolls on the floor.']),
      choice('Blocks', 'blocks', ['Blocks can sit on the floor.']),
      choice('Toys', 'toy-box', ['We pick toys up from the floor.']),
    ]),
  ],
  'family-door': [
    page('The door', [
      choice('Door', 'family-door', ['We go through the door.']),
      choice('Handle', 'family-door', ['Mom or Dad uses the handle.']),
      choice('Closed', 'family-door', ['The door can be closed.']),
    ]),
    page('Go with a grown-up', [
      choice('Mom', 'family-door', ['We go with Mom.'], 'mom'),
      choice('Dad', 'family-door', ['We go with Dad.'], 'dad'),
      choice('Wait', 'family-door', ['Wait for Mom or Dad.']),
    ]),
  ],
  outlet: [
    page('The outlet', [
      choice('Outlet', 'outlet', ['This is an outlet.']),
      choice('Wall', 'family-wall', ['The outlet is on the wall.']),
      choice('Plug', 'outlet', ['A plug can go in the outlet.', 'Only a grown-up uses it.']),
    ]),
    page('Do not touch', [
      choice('Stop', 'outlet', ['Do not touch the outlet.']),
      choice('Mom', 'outlet', ['Mom can help.'], 'mom'),
      choice('Dad', 'outlet', ['Dad can help.'], 'dad'),
    ]),
  ],
  basket: [
    page('The basket', [
      choice('Basket', 'basket', ['This is a basket.']),
      choice('Blanket', 'blanket', ['A blanket can go in the basket.']),
      choice('Teddy', 'teddy', ['A teddy can sit by the basket.']),
    ]),
    page('Put things away', [
      choice('In', 'basket', ['Put the blanket in.']),
      choice('Out', 'blanket', ['Take the blanket out.']),
      choice('Tidy', 'basket', ['We put things away.']),
    ]),
  ],
  'family-clock': [
    page('The clock', [
      choice('Clock', 'family-clock', ['This is a clock.']),
      choice('Numbers', 'family-clock', ['A clock has numbers.']),
      choice('Hands', 'family-clock', ['The clock has hands.']),
    ]),
    page('Time', [
      choice('Time', 'family-clock', ['The clock shows the time.']),
      choice('Day', 'family-clock', ['We do many things in a day.']),
      choice('Tick', 'family-clock', ['The clock can tick.']),
    ]),
  ],
  bath: [
    page('Bath time', [
      choice('Bath', 'bath', ['We wash in the bath.', 'Mom or Dad stays with us.']),
      choice('Water', 'bath', ['Warm water fills the bath.', 'Mom checks the water.'], '', 'fill'),
      choice('Bubbles', 'bath', ['Look at the bubbles.', 'Bubbles are soft.'], 'bubbles'),
    ]),
    page('Stay safe', [
      choice('Sit down', 'bath', ['We sit down in the bath.']),
      choice('Grown-up', 'bath', ['Mom or Dad stays close.', 'We are never alone in the bath.']),
      choice('All done', 'bath-towel', ['Bath time is done.', 'Dad brings the towel.']),
    ]),
  ],
  'bath-tap': [
    page('Water from the tap', [
      choice('Tap', 'bath-tap', ['Water comes from the tap.']),
      choice('On', 'tap-water', ['Mom turns the water on.']),
      choice('Off', 'bath-tap', ['Dad turns the water off.']),
    ]),
    page('Hot and cold', [
      choice('Hot', 'bath-tap', ['The water can be hot.', 'Do not touch.'], 'hot', 'hot'),
      choice('Cold', 'bath-tap', ['The blue side is cold.'], 'cold'),
      choice('Warm', 'tap-water', ['Mom makes the water warm.', 'Mom checks it first.']),
    ]),
  ],
  duck: [
    page('A little duck', [
      choice('Duck', 'duck', ['This is a duck.']),
      choice('Yellow', 'duck', ['The duck is yellow.']),
      choice('Beak', 'duck', ['The duck has a beak.'], 'beak'),
    ]),
    page('In the bath', [
      choice('Float', 'duck', ['The duck floats on the water.'], '', 'float'),
      choice('Squeak', 'duck', ['Squeeze the duck.', 'Squeak, squeak.'], '', 'squeeze'),
      choice('Bath', 'bath', ['The duck goes in the bath.']),
    ]),
  ],
  boat: [
    page('A little boat', [
      choice('Boat', 'boat', ['This is a boat.']),
      choice('Sail', 'boat', ['The boat has a sail.'], 'sail'),
      choice('Float', 'boat', ['The boat floats on the water.'], '', 'float'),
    ]),
    page('Bath toys', [
      choice('Duck', 'duck', ['The duck is a bath toy.'], '', 'float'),
      choice('Boat', 'boat', ['The boat is a bath toy.'], '', 'float'),
      choice('Bath', 'bath', ['Toys can go in the bath.']),
    ]),
  ],
  sponge: [
    page('A soft sponge', [
      choice('Sponge', 'sponge', ['This is a sponge.']),
      choice('Soft', 'sponge', ['The sponge feels soft.']),
      choice('Squeeze', 'sponge', ['Squeeze the sponge.', 'Water comes out.'], '', 'squeeze'),
    ]),
    page('Wash with a sponge', [
      choice('Wet', 'hands', ['The sponge makes us wet.'], 'wet'),
      choice('Soap', 'hands', ['Soap goes on the sponge.'], 'soap'),
      choice('Bath', 'bath', ['We wash in the bath.']),
    ]),
  ],
  shampoo: [
    page('Wash our hair', [
      choice('Shampoo', 'shampoo', ['This is shampoo.']),
      choice('Lid', 'shampoo', ['Mom opens the lid.'], '', 'lid'),
      choice('Bubbles', 'hands', ['Shampoo makes bubbles.'], 'soap'),
    ]),
    page('Hair wash', [
      choice('Rinse', 'tap-water', ['Water washes the shampoo off.']),
      choice('Eyes closed', 'shampoo', ['We close our eyes.', 'Mom or Dad helps.']),
      choice('Towel', 'bath-towel', ['A towel dries our hair.']),
    ]),
  ],
  toilet: [
    page('The toilet', [
      choice('Toilet', 'toilet', ['This is the toilet.']),
      choice('Lid', 'toilet', ['The lid goes up and down.'], '', 'flip-lid'),
      choice('Flush', 'toilet', ['Push the button to flush.'], '', 'flush'),
    ]),
    page('After the toilet', [
      choice('Wash', 'hands', ['We wash our hands.'], 'soap'),
      choice('Dry', 'hands', ['We dry our hands.'], 'dry'),
      choice('Lid down', 'toilet', ['We put the lid down.']),
    ]),
  ],
  potty: [
    page("Hudson's potty", [
      choice('Potty', 'potty', ["This is Hudson's potty."]),
      choice('Sit', 'potty', ['Hudson can sit on the potty.']),
      choice('Toilet', 'toilet', ['Mom and Dad use the toilet.']),
    ]),
    page('All done', [
      choice('Wash', 'hands', ['We wash our hands.'], 'soap'),
      choice('Dry', 'hands', ['A towel dries our hands.'], 'dry'),
      choice('Good job', 'potty', ['Good job, Hudson!']),
    ]),
  ],
  'bath-sink': [
    page('At the sink', [
      choice('Sink', 'bath-sink', ['We wash at the sink.']),
      choice('Water', 'tap-water', ['Water goes in the sink.', 'Mom or Dad helps.']),
      choice('Cupboard', 'bath-sink', ['Towels are inside.', 'Mom opens the doors.'], '', 'cabinet-demo'),
    ]),
    page('Brush our teeth', [
      choice('Toothbrush', 'toothbrush', ['We brush our teeth.'], '', 'brush'),
      choice('Toothpaste', 'toothpaste', ['Just a little toothpaste.'], '', 'squeeze'),
      choice('Step stool', 'step-stool', ['Hudson stands on the stool.', 'Mom or Dad stays close.']),
    ]),
  ],
  mirror: [
    page('Look in the mirror', [
      choice('Mirror', 'mirror', ['This is a mirror.']),
      choice('Face', 'mirror', ['We can see our face.']),
      choice('Smile', 'mirror', ['Smile at the mirror!']),
    ]),
    page('At the mirror', [
      choice('Comb', 'comb', ['We comb our hair.']),
      choice('Teeth', 'toothbrush', ['We brush our teeth.'], '', 'brush'),
      choice('Glass', 'mirror', ['The mirror is glass.', 'Hands stay off.']),
    ]),
  ],
  toothbrush: [
    page('Our toothbrushes', [
      choice("Mom's toothbrush", 'toothbrush', ['Mom brushes her teeth.'], 'mom'),
      choice("Dad's toothbrush", 'toothbrush', ['Dad brushes his teeth.'], 'dad'),
      choice("Hudson's toothbrush", 'toothbrush', ['Hudson brushes his teeth.'], 'hudson'),
    ]),
    page('Brush, brush', [
      choice('Brush', 'toothbrush', ['Brush up and down.'], '', 'brush'),
      choice('Toothpaste', 'toothpaste', ['A little bit of toothpaste.'], '', 'squeeze'),
      choice('Rinse', 'tooth-cup', ['We rinse with water.']),
    ]),
  ],
  toothpaste: [
    page('Toothpaste', [
      choice('Toothpaste', 'toothpaste', ['This is toothpaste.']),
      choice('Cap', 'toothpaste', ['The cap goes on top.'], 'cap'),
      choice('Squeeze', 'toothpaste', ['Mom squeezes a little.', 'Just a little bit.'], '', 'squeeze'),
    ]),
    page('Brush with Mom or Dad', [
      choice('Brush', 'toothbrush', ['Toothpaste goes on the brush.'], '', 'brush'),
      choice('Spit', 'bath-sink', ['We spit in the sink.']),
      choice('Rinse', 'tap-water', ['Water rinses the sink.']),
    ]),
  ],
  'tooth-cup': [
    page('Our cup', [
      choice('Cup', 'tooth-cup', ['Toothbrushes stand in the cup.']),
      choice('Water', 'drink', ['Water in the cup.', 'We rinse our mouth.'], 'water'),
      choice("Hudson's cup", 'cup', ['This cup is for Hudson.'], 'hudson'),
    ]),
    page('In the cup', [
      choice("Mom's toothbrush", 'toothbrush', ["Mom's toothbrush goes in."], 'mom'),
      choice("Dad's toothbrush", 'toothbrush', ["Dad's toothbrush goes in."], 'dad'),
      choice("Hudson's toothbrush", 'toothbrush', ["Hudson's toothbrush goes in."], 'hudson'),
    ]),
  ],
  'bath-soap': [
    page('Soap and water', [
      choice('Soap', 'bath-soap', ['This is a bar of soap.']),
      choice('Slippery', 'bath-soap', ['Wet soap is slippery.']),
      choice('Bubbles', 'hands', ['Soap makes bubbles.'], 'soap'),
    ]),
    page('Clean hands', [
      choice('Wet', 'hands', ['Water makes our hands wet.'], 'wet'),
      choice('Wash', 'hands', ['We wash with soap.'], 'soap'),
      choice('Dry', 'hands', ['A towel dries our hands.'], 'dry'),
    ]),
  ],
  'bath-towel': [
    page('A big towel', [
      choice('Towel', 'bath-towel', ['The towel is big and soft.']),
      choice('Dry', 'hands', ['The towel dries us.'], 'dry'),
      choice('Warm', 'bath-towel', ['A towel keeps us warm.']),
    ]),
    page('Our towels', [
      choice("Mom's towel", 'bath-towel', ['Mom dries with her towel.'], 'mom'),
      choice("Dad's towel", 'bath-towel', ['Dad dries with his towel.'], 'dad'),
      choice("Hudson's towel", 'bath-towel', ['Hudson dries with his towel.'], 'hudson'),
    ]),
  ],
  comb: [
    page('Comb our hair', [
      choice('Comb', 'comb', ['This is a comb.']),
      choice('Teeth', 'comb', ['A comb has many teeth.'], 'teeth'),
      choice('Hair', 'mirror', ['We comb our hair at the mirror.']),
    ]),
    page('Our combs', [
      choice("Mom's comb", 'comb', ['Mom combs her hair.'], 'mom'),
      choice("Dad's comb", 'comb', ['Dad combs his hair.'], 'dad'),
      choice("Hudson's comb", 'comb', ['Hudson combs his hair.'], 'hudson'),
    ]),
  ],
  'step-stool': [
    page('A step stool', [
      choice('Step stool', 'step-stool', ['This is a step stool.']),
      choice('Step up', 'step-stool', ['Hudson steps up.', 'Mom or Dad stays close.']),
      choice('Sink', 'bath-sink', ['Now Hudson can reach the sink.']),
    ]),
    page('Stay safe', [
      choice('Slowly', 'step-stool', ['We step slowly.']),
      choice('Feet', 'bath-mat', ['Our feet stay on the step.']),
      choice('Hands', 'hands', ['We wash our hands at the sink.'], 'soap'),
    ]),
  ],
  laundry: [
    page('The laundry basket', [
      choice('Basket', 'laundry', ['This is the laundry basket.']),
      choice('Clothes', 'laundry', ['Dirty clothes go inside.']),
      choice('Lid', 'laundry', ['The basket has a lid.'], '', 'lid'),
    ]),
    page('Help Mom and Dad', [
      choice('Socks', 'laundry', ['Socks go in the basket.']),
      choice('Towel', 'bath-towel', ['A wet towel goes in the basket.']),
      choice('Tidy', 'laundry', ['We keep the bathroom tidy.']),
    ]),
  ],
  'bath-mat': [
    page('The bath mat', [
      choice('Bath mat', 'bath-mat', ['The bath mat is soft.']),
      choice('Dry feet', 'bath-mat', ['The mat keeps our feet dry.']),
      choice('Bath', 'bath', ['The mat is by the bath.']),
    ]),
    page('Step out', [
      choice('Step', 'bath-mat', ['We step on the mat.']),
      choice('Towel', 'bath-towel', ['Dad brings the towel.']),
      choice('Floor', 'bath-floor', ['The floor can be wet.']),
    ]),
  ],
  'bath-window': [
    page('Look at the window', [
      choice('Window', 'bath-window', ['The window lets light in.']),
      choice('Light', 'bath-window', ['Light comes through the glass.']),
      choice('Glass', 'bath-window', ['This glass is cloudy.']),
    ]),
    page('Near the window', [
      choice('Mirror', 'mirror', ['The mirror is on the wall.']),
      choice('Towel', 'bath-towel', ['The towel hangs on the wall.']),
      choice('Closed', 'bath-window', ['Mom or Dad opens windows.', 'We stay on the floor.']),
    ]),
  ],
  'bath-wall': [
    page('Our bathroom wall', [
      choice('Wall', 'bath-wall', ['The wall is tall.']),
      choice('Tiles', 'bath-wall', ['These are bathroom tiles.']),
      choice('Mirror', 'mirror', ['The mirror is on the wall.']),
    ]),
    page('Things on the wall', [
      choice('Towel', 'bath-towel', ['The towel hangs on the wall.']),
      choice('Window', 'bath-window', ['The window is in the wall.']),
      choice('Door', 'bath-door', ['The door is in the wall.']),
    ]),
  ],
  'bath-floor': [
    page('Under our feet', [
      choice('Floor', 'bath-floor', ['We walk on the floor.']),
      choice('Wet', 'bath-floor', ['A wet floor is slippery.', 'We walk slowly.']),
      choice('Bath mat', 'bath-mat', ['The bath mat is on the floor.']),
    ]),
    page('On the floor', [
      choice('Potty', 'potty', ['The potty is on the floor.']),
      choice('Step stool', 'step-stool', ['The stool is on the floor.']),
      choice('Basket', 'laundry', ['The basket is on the floor.']),
    ]),
  ],
  'bath-door': [
    page('The bathroom door', [
      choice('Door', 'bath-door', ['We go through the door.']),
      choice('Knock', 'bath-door', ['Knock, knock.', 'We knock on the door.']),
      choice('Handle', 'bath-door', ['Mom holds the handle.']),
    ]),
    page('Go with a grown-up', [
      choice('Mom', 'bath-door', ['We go with Mom.'], 'mom'),
      choice('Dad', 'bath-door', ['We go with Dad.'], 'dad'),
      choice('Wait', 'bath-door', ['We wait for Mom or Dad.']),
    ]),
  ],
};

/** A short grown-up note shown under the word for things that can be hot, sharp or high. */
export const SAFETY_NOTES = {
  drawer: 'Mom or Dad opens it.',
  cabinet: 'Ask Mom or Dad.',
  stove: 'Hot. Do not touch.',
  oven: 'Hot. Do not touch.',
  pot: 'It can be hot. Ask Mom or Dad.',
  pan: 'It can be hot. Ask Mom or Dad.',
  kettle: 'Hot. Do not touch.',
  toaster: 'Hot. Do not touch.',
  microwave: 'Mom or Dad uses it.',
  dishwasher: 'Mom or Dad uses it.',
  'cutting-board': 'Mom or Dad cuts the food.',
  window: 'We stay on the floor.',
  lamp: 'Mom or Dad handles the cord.',
  television: 'Hands stay off the screen.',
  remote: 'Give it to Mom or Dad. Keep it out of your mouth.',
  outlet: 'Do not touch. Mom or Dad uses it.',
  'family-window': 'We stay on the floor.',
  bookshelf: 'Feet stay on the floor.',
  'coffee-table': 'We do not climb on the table.',
  bath: 'Mom or Dad always stays close.',
  'bath-tap': 'Hot water. Ask Mom or Dad.',
  shampoo: 'Keep it out of our eyes.',
  toothpaste: 'Just a little bit. We spit it out.',
  'step-stool': 'Mom or Dad stays close.',
  'bath-floor': 'A wet floor is slippery.',
};

/** Throws if any word is missing its two pages of three choices. */
export function validateLessons(words) {
  for (const word of words) {
    const pages = LESSONS[word.id];
    if (!pages || pages.length !== 2) throw new Error(`Missing lesson: ${word.id}`);
    for (const p of pages) {
      if (p.choices.length !== 3) throw new Error(`Each page needs three choices: ${word.id}`);
      for (const c of p.choices)
        if (!c.model || !c.label || !c.lines.length) throw new Error(`Invalid choice: ${word.id}`);
    }
  }
  return true;
}
