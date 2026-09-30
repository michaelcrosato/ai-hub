/** Small, optional encounters. All positions use metres along the sphere. */
const LIFE_SITES=[
 {id:'brume',kind:'cloud',name:'Brume',at:[28,-8],title:'A cloud with a mood',hint:'At the garden bend, listen to the cloud. Stay for a little rain.',memory:'cloud'},
 {id:'nibs',kind:'gopher',name:'Nibs',at:[22.8,-15.5],title:'Here, then not here',hint:'At the field edge, walk slowly. Wait beside a small burrow.',memory:'gopher'},
 {id:'tilly',kind:'bird',name:'Tilly & the hedge choir',at:[42,9],title:'A song with wings',hint:'Beyond the orchard sign, whistle back to the birds.',memory:'birds'},
 {id:'moss',kind:'tortoise',name:'Moss',at:[-51,2],title:'At our own pace',hint:'Between the pond and the woodland, walk with the tortoise family.',memory:'family'},
 {id:'marimba',kind:'instrument',name:'The rainwood keys',at:[12,-2],title:'Five wooden notes',hint:'On the garden path, play the five keys. There is no wrong tune.',memory:'marimba',instrument:'wood'},
 {id:'bottles',kind:'instrument',name:'The bottle organ',at:[-32,-18],title:'A tune in the trees',hint:'Near Hushwood, play five glass bottles. Watch the leaves respond.',memory:'bottles',instrument:'glass'}
];
const LIFE_MEMORIES=[...LIFE_SITES.map(x=>({id:x.memory,title:x.title,hint:x.hint,site:x.id})),
 {id:'rainfilm',title:'A little weather',hint:'Watch A Cloud of One’s Own at the cinema. This film is free.',site:'cinema'},
 {id:'slowfilm',title:'The slowest adventure',hint:'Watch Very Nearly There at the cinema. This film is free.',site:'cinema'}];
const FILMS=[
 {id:'rain',title:'A Cloud of One’s Own',seconds:18,subtitle:'A small cloud. A large mood.',memory:'rainfilm',free:true},
 {id:'slow',title:'Very Nearly There',seconds:16,subtitle:'Three tortoises. One picnic.',memory:'slowfilm',free:true},
 {id:'home',title:'The Long Way Home',seconds:14,subtitle:'The film from the archive.',memory:null,free:false}
];
const VOICES={
 pip:{base:510,type:'triangle',pace:.085,shape:[1,1.24,1.08,1.42],label:'quick, bright chirps'},
 miso:{base:265,type:'sine',pace:.16,shape:[1,1.12,.92],label:'soft, low murmurs'},
 mochi:{base:650,type:'sine',pace:.105,shape:[1,1.2,1.06,1.28],label:'light, rising notes'},
 pebble:{base:155,type:'triangle',pace:.19,shape:[1,.91,1.28],label:'round, bubbling croaks'},
 bramble:{base:230,type:'triangle',pace:.14,shape:[1,1.2,1,.82],label:'warm, bouncy hums'},
 sprig:{base:410,type:'sine',pace:.12,shape:[1,1.3,1.18],label:'clear, airy notes'},
 kiln:{base:180,type:'triangle',pace:.18,shape:[1,.86,1.12],label:'low, grainy hums'},
 baths:{base:325,type:'sine',pace:.21,shape:[1,1.06,1.16],label:'slow, flowing tones'},
 archive:{base:285,type:'sine',pace:.16,shape:[1,1.18,1.02],label:'quiet, measured notes'},
 usher:{base:565,type:'sine',pace:.145,shape:[1,1.08,1.26,.92],label:'soft, lilting syllables'},
 brume:{base:106,type:'triangle',pace:.24,shape:[1,.85,.93,.72],label:'low, grumbling rumbles'},
 nibs:{base:860,type:'triangle',pace:.062,shape:[1,1.35,.83,1.2],label:'tiny, rapid squeaks'},
 tilly:{base:1240,type:'sine',pace:.09,shape:[1,1.5,1.25,1.67],label:'bright, clear whistles'},
 moss:{base:130,type:'sine',pace:.26,shape:[1,1.06,.94],label:'slow, deep hums'},
 fern:{base:305,type:'triangle',pace:.17,shape:[1,1.17,1.05],label:'gentle, reedy notes'},
 pipkin:{base:740,type:'sine',pace:.10,shape:[1,1.33,1.67],label:'three small, eager peeps'}
};
const SMALL_TALK={
 pip:['I sorted the leaves by shape. Then the wind sorted them by everywhere.','That fountain has been telling the same story all day. I like it.','My best leaf has five points. Please wave with five fingers. Or a paw.'],
 miso:['The bridge is a good place to finish a chapter. Or start another one.','This book has a map. The blank part is my favorite.','I read very slowly when a sentence feels like a warm blanket.'],
 mochi:['I keep one apricot for the birds. They keep asking for six.','The old tree likes a gentle shake. I think it is ticklish.','There is a tiny choir behind the orchard. They accept whistles.'],
 pebble:['One ripple. Two ripples. Oh. A new ripple. I will start again.','The tortoise family walks near the woodland. They always wait for the smallest one.','My paper boat is not late. It is taking the scenic route.']
};
// Keep these points shared by scenery, tree clearance, and route tests.
const LIFE_PATHS=[[[11,1],[12,-2]],[[20,-15],[22.8,-15.5]],[[27,-8],[28,-8]],[[40,5],[42,7],[42,9]],[[-48,8],[-50,5],[-51,2],[-51,-4.8]],[[-32,-16],[-32,-18]]];

export { LIFE_SITES, LIFE_MEMORIES, FILMS, VOICES, SMALL_TALK, LIFE_PATHS };
