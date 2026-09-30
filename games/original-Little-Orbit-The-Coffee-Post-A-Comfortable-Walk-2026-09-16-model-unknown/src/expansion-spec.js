/* World expansion data. Coordinates are metres along longitude and latitude.
 * Keep destinations and routes here. Geometry and progress rules are separate. */
const NEW_REGIONS=[
 {id:'market',name:'Thread & Crumb Lane',sub:'Two little shops. Another lane upstairs.',at:[17,26],radius:8.5},
 {id:'fields',name:'Sunpatch Fields',sub:'Leave something growing behind you.',at:[20,-20],radius:7},
 {id:'baths',name:'Cloudwater Baths',sub:'Warm stones. A little time to rest.',at:[35,-16],radius:7},
 {id:'kiln',name:'Ember Kiln',sub:'Make a cup that is not a delivery.',at:[57,-15],radius:7},
 {id:'ridge',name:'Pebbleback Ridge',sub:'Stone steps on the far side of the world.',at:[74,23],radius:8},
 {id:'woodland',name:'Hushwood',sub:'Three quiet notes among the trees.',at:[-36,-22],radius:8},
 {id:'archive',name:'The Canopy Archive',sub:'Old stories above the leaves.',at:[-60,-17],radius:12},
 {id:'cinema',name:'The Pocket Picturehouse',sub:'A small screen for a small world.',at:[-27,24],radius:7}
];
const TRAILS=[
 {id:'garden',name:'The garden walk',width:2.0,color:'#e2c99d',points:[[0,4],[6,6],[11,1],[15,-9],[20,-15],[27,-8],[35,-8],[44,-7],[54,-7],[59,-4],[56,4]]},
 {id:'field-entry',width:1.55,color:'#d6bc8d',points:[[20,-15],[20,-18],[20,-20]]},
 {id:'market-lane',width:2.3,color:'#ead8b3',points:[[15,18.3],[17,19.5],[17,22],[17,26],[17,30],[17,33],[3,34],[-12,32],[-21,31],[-27,31]]},
 {id:'picture-walk',name:'The picture walk',width:1.9,color:'#e8d5b2',points:[[-3.7,12],[-6,12],[-12,12],[-17,13],[-24,13],[-27,16],[-27,13],[-16,13],[-14,17],[-12,24],[-13,30],[-18,32],[-27,31]]},
 {id:'cinema-entry',width:1.7,color:'#e8d5b2',points:[[-27,16],[-27,20],[-27,23]]},
 {id:'pond-picture',width:1.8,color:'#dbd3ac',points:[[-27,16],[-29,13],[-37,13],[-40,17],[-43,18],[-48,8]]},
 {id:'forest-loop',name:'The woodland walk',width:1.85,color:'#c9bd98',points:[[-22,-7],[-25,-13],[-32,-16],[-40,-16],[-46,-7],[-51,-4.8],[-61,-5.4],[-66,-5.4],[-71,-2],[-70,8]]},
 {id:'south-loop',width:1.65,color:'#cfbe94',points:[[-40,-16],[-41,-24],[-34,-27],[-22,-29],[-6,-26],[10,-22],[20,-15]]},
 {id:'hushwood',width:1.45,color:'#d8c69e',points:[[-32,-16],[-31,-22],[-34,-27],[-41,-24],[-40,-16]]},
 {id:'ridge-loop',name:'The stone walk',width:1.85,color:'#c6bda9',points:[[56,4],[65,7],[69,14],[74,17],[74,23],[74,30.5],[-80,28],[-72,21],[-66,15],[-70,8]]},
 {id:'kiln-entry',width:1.5,color:'#d5b394',points:[[54,-7],[57,-8],[57,-12]]},
 {id:'bath-entry',width:1.6,color:'#e7d8b8',points:[[35,-8],[35,-10],[35,-12],[35,-14]]}
];
const STAMPS=[
 {id:'market',title:'A taste of the town',place:'Thread & Crumb Lane',hint:'Try a warm bun at the bakery. Take seeds from the other shop.',mark:'01'},
 {id:'fields',title:'Something that grows',place:'Sunpatch Fields',hint:'Bring seeds from the shop. Plant them in the empty bed.',mark:'02'},
 {id:'baths',title:'A quiet minute',place:'Cloudwater Baths',hint:'Open the warm tap. Rest beside the pool.',mark:'03'},
 {id:'ridge',title:'A pocket of clay',place:'Pebbleback Ridge',hint:'Cross the stone bridge. Take clay from the small basket.',mark:'04'},
 {id:'kiln',title:'Made by your paws',place:'Ember Kiln',hint:'Bring the ridge clay. Shape and fire a little cup.',mark:'05'},
 {id:'woodland',title:'The wood has a song',place:'Hushwood',hint:'Find three wooden chimes along the woodland loop.',mark:'06'},
 {id:'archive',title:'One more page',place:'The Canopy Archive',hint:'Climb to the treehouse. Read all three pages of the travel book.',mark:'07'},
 {id:'cinema',title:'The last little reel',place:'The Pocket Picturehouse',hint:'Bring the film reel from the archive. Watch the whole film.',mark:'08'}
];
const ARCHIVE_PAGES=[
 {title:'Page 1 · The long way round',text:'The first paths followed the stream. One led to warm water. One led to a field with room for a new seed.'},
 {title:'Page 2 · Things we made',text:'The ridge gave us clay. The kiln gave us cups. The forest gave us three notes for a very small song.'},
 {title:'Page 3 · A film between the pages',text:'A small film reel falls from the book. Take it to the Pocket Picturehouse, beyond the town. The screen is waiting.'}
];
const WALKING_ROUTES=[
 {name:'The garden walk',text:'Café → fields → baths → kiln → orchard. Take seeds from the town shop first.'},
 {name:'The woodland walk',text:'Meadow → three chimes → treehouse stairs → canopy bridge → pond. Read the travel book upstairs.'},
 {name:'The picture walk',text:'Square → cinema → upper town shops → library. Bring the archive film to the cinema.'},
 {name:'The stone walk',text:'Orchard → ridge bridge → clay basket → bell hill. Take the clay to the kiln.'}
];

export { NEW_REGIONS, TRAILS, STAMPS, ARCHIVE_PAGES, WALKING_ROUTES };
