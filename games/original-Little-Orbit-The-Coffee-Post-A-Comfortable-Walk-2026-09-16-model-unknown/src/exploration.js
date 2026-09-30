import { STAMPS, ARCHIVE_PAGES, NEW_REGIONS } from './expansion-spec.js';

/** Persistent, coffee-independent exploration rules. No DOM or renderer access. */
class ExplorationState {
 constructor(){this.stamps=new Set();this.notes=new Set();this.seeds=false;this.clay=false;this.reel=false;this.warm=false;this.pages=0;this.readCursor=0;this.track='';this.plantTime=-100;}
 has(id){return this.stamps.has(id);}
 get count(){return this.stamps.size;}
 get complete(){return this.count===STAMPS.length;}
 get pin(){return this.count>=4;}
 award(id){if(!STAMPS.some(s=>s.id===id))return false;const fresh=!this.stamps.has(id);this.stamps.add(id);return fresh;}
 use(kind,note){
  const info=(title,text,extra={})=>({ok:true,title,text,...extra});
  const stop=(title,text)=>({ok:false,title,text});
  switch(kind){
   case 'bakery':{const fresh=this.award('market');return info('A bun from Bramble','A little break in the town. There are free seeds in the shop across the lane.',{stamp:fresh?'market':null,cue:'happy'});}
   case 'seeds':if(this.has('fields'))return info('Seed & Thread','Your flowers are growing in Sunpatch Fields. Thank you for planting them.');if(this.seeds)return info('One packet is enough','Take your seeds to the empty bed in Sunpatch Fields.');this.seeds=true;return info('Seeds in your bag','Follow the garden path past the café. Plant these in the empty field bed.',{cue:'happy'});
   case 'plant':if(this.has('fields'))return info('Your little garden','The flowers you planted are still here. No coffee was needed.');if(!this.seeds)return stop('An empty bed','Take a free seed packet from Seed & Thread, in the upper town.');this.seeds=false;this.award('fields');return info('Something that grows','The first flowers are opening. This patch is part of your walk now.',{stamp:'fields',cue:'happy'});
   case 'tap':this.warm=!this.warm;return info('Cloudwater Baths',this.warm?'Warm water flows into the pool. Rest at the front edge.':'The tap is closed. The water is still.',{cue:'curious'});
   case 'rest':if(!this.warm)return stop('The water is cool','Open the warm tap on the left. Then rest by the pool.');return info('A quiet minute','Stay by the warm water.',{timed:'rest',seconds:3.2});
   case 'clay':{const fresh=this.award('ridge');if(!this.has('kiln'))this.clay=true;return info('A pocket of clay',this.has('kiln')?'This is where your little cup began.':'Take this clay to Ember Kiln, on the garden path beyond the baths.',{stamp:fresh?'ridge':null,cue:'happy'});}
   case 'pottery':if(this.has('kiln'))return info('Made by your paws','Your glazed cup is on the pottery table. It will stay here between coffee rounds.');if(!this.clay)return stop('The wheel is ready','Find clay in the basket on Pebbleback Ridge. Follow the stone path beyond the orchard.');return info('A cup takes shape','Stay by the wheel while the kiln warms your cup.',{timed:'pottery',seconds:4.2});
   case 'chime':if(!Number.isInteger(note)||note<0||note>2)return stop('No note','This chime has no note.');this.notes.add(note);{const fresh=this.notes.size===3?this.award('woodland'):false;return info('Hushwood · '+this.notes.size+' of 3 notes',this.notes.size===3?'Three notes make a small song. You have heard the whole wood.':'Follow the woodland loop to find the other wooden chimes.',{stamp:fresh?'woodland':null,note,cue:'curious'});}
   case 'read':{const page=this.readCursor%3;this.readCursor++;this.pages=Math.max(this.pages,page+1);const fresh=this.pages===3?this.award('archive'):false;if(this.pages===3)this.reel=true;return info(ARCHIVE_PAGES[page].title,ARCHIVE_PAGES[page].text,{stamp:fresh?'archive':null,cue:'curious'});}
   case 'film':if(!this.reel)return stop('A screen with no story','The lost film is in the Canopy Archive. Climb to the treehouse and read the travel book.');return info('The Long Way Home','An original small film. Press Escape to leave.',{film:true,seconds:14});
   default:return stop('Nothing to use','Try a different place.');
  }
 }
 finish(kind){
  if(kind==='rest'&&this.warm){const fresh=this.award('baths');return {ok:true,stamp:fresh?'baths':null,title:'A quiet minute',text:'Warm water, soft steam, and no rush. The baths are now in your field notes.',cue:'happy'};}
  if(kind==='pottery'&&this.clay){this.clay=false;this.award('kiln');return {ok:true,stamp:'kiln',title:'Made by your paws',text:'Your new glazed cup is on the table. It is not one of your delivery coffees.',cue:'happy'};}
  if(kind==='film'&&this.reel){const fresh=this.award('cinema');return {ok:true,stamp:fresh?'cinema':null,title:'The end. The path goes on.',text:'The film is now in your field notes. You can watch it again at any time.',cue:'happy'};}
  return {ok:false,title:'Not finished',text:'Return to the activity to try again.'};
 }
 get inventory(){return [this.seeds?'Seed packet':null,this.clay?'Ridge clay':null,this.reel?'Archive film':null,this.has('kiln')?'Glazed cup on display':null].filter(Boolean);}
 snapshot(){return {stamps:[...this.stamps],notes:[...this.notes],seeds:this.seeds,clay:this.clay,reel:this.reel,warm:this.warm,pages:this.pages,track:this.track};}
 restore(data){
  if(!data||typeof data!=='object')return;
  this.stamps=new Set((Array.isArray(data.stamps)?data.stamps:[]).filter(x=>STAMPS.some(s=>s.id===x)));
  this.notes=new Set((Array.isArray(data.notes)?data.notes:[]).filter(x=>Number.isInteger(x)&&x>=0&&x<3));
  this.seeds=data.seeds===true&&!this.has('fields');this.clay=data.clay===true&&!this.has('kiln');
  this.pages=Math.max(0,Math.min(3,Number.isInteger(data.pages)?data.pages:0));this.readCursor=this.pages===3?0:this.pages;
  this.reel=data.reel===true||this.has('archive');this.warm=data.warm===true;
  this.track=NEW_REGIONS.some(r=>r.id===data.track)?data.track:'';
 }
}

export { ExplorationState };
