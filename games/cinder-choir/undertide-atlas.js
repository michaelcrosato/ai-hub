/* The Undertide: eight authored stations beneath the southern sea.
 * Each station has its own room graph, closed gate, return loops, records,
 * side room, and second-act repair bay. The surface chart marks its launch.
 * This adapter extends the public game atlas. It does not patch the engine. */
(() => {
'use strict';
const A=globalThis.CC.Atlas;
const core=['entry','approach','register','stores','control','chamber','heart','horizon'];
const extras={lookout:9,shelter:10,workbench:11,archive:12,return:13};
const near=['entry','approach','register','stores','control','lookout','shelter','workbench'];
const far=['chamber','heart','horizon','archive','return'];
A.undertideVersion='5.0.0';
function add(id,spec){
 const names=[...core,...Object.keys(extras)];A.anchorNames[id]=names;
 A.layouts[id]={id,anchorNames:names,earlyAnchors:near.slice(),lateAnchors:far.slice(),extraAnchors:{...extras},
  accents:['#d7b477','#80c9bd','#9f9bc9'],...spec,done:spec.task};
}
add('bellhaven',{
 size:[86,66],cut:46,gate:32,shell:'~',floor:'=',task:'u_depth_01',gateLabel:'Bell launch pressure shutter',
 r:[[9,49,13,13],[10,31,15,13],[10,10,15,11],[28,12,17,11],[32,32,17,15],[56,32,15,13],[74,13,17,15],[72,49,21,15],[29,49,11,11],[23,59,13,9],[26,23,13,9],[41,12,7,11],[56,11,13,11],[55,53,13,13]],
 names:['Southern boat landing','The bell launch','Crew register','Dry supply house','Pressure bell console','The equalization chamber','Lower berth','Return signal deck','Keeper\'s net room','South lookout','Crew rest room','Rope and seal bench','Passage ledger','The waiting tender'],
 links:[[0,1],[1,2],[2,3],[3,4],[4,0,[[32,44],[9,44]]],[0,8],[8,9],[9,0],[1,10],[10,4],[3,11],[11,4],[4,5,[[44,32],[48,32]]],[5,6,[[74,32]]],[6,12],[12,5],[5,7],[7,13],[13,5]],
 motifs:['barrel lamp','pillar lantern','sign candle','crate pot','hydrant lantern','pillar crystal','fence lamp','banner lantern','crate window','fence lamp','awning pot','barrel firedrum','sign lantern','fence barrel'],
 fittings:[[1,-5,-4,3,2,'b'],[2,-5,-3,3,1,'H'],[3,3,-3,3,2,'b'],[4,-6,3,3,2,'~'],[5,3,-4,2,2,'b'],[6,-6,-5,4,2,'~'],[7,5,3,3,2,'b'],[10,-4,-2,2,2,'b'],[12,-4,-3,2,2,'b'],[13,3,2,2,3,'~']],
 details:[[2,'Names beside the return bell','The register has a space for each person who goes below. A smaller line records who will wait above.','The two lines have equal space. No descent starts until someone accepts the return watch.','sign'],[4,'A pause between pressures','Two gauges share one glass cover. Their needles must meet before the inner shutter can move.','The cover is clean. A hand stop remains beside the motor, within reach of a seated keeper.','hydrant'],[7,'A signal with an answer','The old cable can ring the launch bell from below. Its second strand ends beside an unused answer lever.','The answer lever moves freely. A return call now receives a reply before the bell is lowered.','lantern']],
 secretLabel:'The net with a bright corner',secretText:'One corner of a rescue net uses bright thread. The keeper can find its opening in dark water.',secretAfter:'Every new net has the same bright corner. The first net hangs beside a drawing of its safe load.',secretProp:'crate',afterBay:[34,49,5,5],afterName:'Net inspection platform'
});
add('kelpvault',{
 size:[88,74],axis:'y',cut:39,gate:46,shell:'~',task:'u_depth_03',gateLabel:'Living channel sluice',
 r:[[10,11,15,13,'oval'],[31,10,17,11,'oval'],[54,10,17,11],[10,28,15,13,'oval'],[46,28,19,13,'oval'],[46,51,19,15,'oval'],[71,57,21,21,'oval'],[15,58,21,19,'oval'],[73,27,13,13,'oval'],[75,9,17,11],[29,27,13,11,'oval'],[63,27,11,13],[37,66,15,9,'oval'],[69,44,15,7,'oval']],
 names:['Kelp landing basin','Root mooring','Seed register','Shade nursery','Return-water control','Living channel','The deep garden','Upper kelp canopy','Gardener\'s hollow','Canopy light gauge','Nursery rest ledge','Cutting bench','Six-season seed shelves','The rootward return'],
 links:[[0,1],[1,2],[2,9],[9,11],[11,4],[4,10],[10,3],[3,0],[1,10],[11,8],[8,9],[4,5,[[46,37],[46,41]]],[5,6],[6,13],[13,5],[5,7],[7,12],[12,5]],
 motifs:['rock lantern','vines fence','crate sign','flowers pot','hydrant grass','tree crystal','palm flowers','vines lantern','mushroom pot','crystal fence','awning pot','flowers crate','crate candle','rock grass'],
 fittings:[[1,-6,-3,3,2,'~'],[2,4,2,3,1,'b'],[3,3,-4,2,3,'~'],[4,-6,3,3,2,'~'],[5,-6,-4,3,2,'~'],[6,3,4,4,3,'~'],[6,-6,-5,2,3,'#'],[7,-6,4,3,2,'~'],[12,3,-2,3,1,'b']],
 details:[[2,'Seed that waits for shade','The oldest jars contain plants from before the harbor sank. Their lids record shade and water flow as well as age.','Each planting starts with a small trial. The gardeners keep enough seed to try again.','crate'],[4,'The water after the garden','A return pipe carries cloudy water past the new roots. A clear sample jar stands beside it.','The return stream passes through a settling bed. The clear jar remains as a check, not a promise.','hydrant'],[7,'A roof that grows','The high kelp leaves turn toward the open water. A wire frame holds several leaves where the light no longer falls.','The frame is gone. Small floats let the new canopy follow the moving light.','vines']],
 secretLabel:'A meal drawn on a leaf',secretText:'A gardener drew four bowls on a dried leaf. Each bowl names a different plant and the part that can be eaten.',secretAfter:'A fifth bowl has been added. A note asks visitors to seek the gardener before they gather an unfamiliar plant.',secretProp:'pot',afterBay:[77,32,5,5],afterName:'Young-root observation bed'
});
add('copperlung',{
 size:[94,60],cut:51,gate:39,floor:'=',task:'u_depth_02',gateLabel:'Cold pressure chamber door',
 r:[[8,46,13,13],[9,27,13,13],[10,9,15,11],[29,10,17,11],[38,39,19,13],[63,39,17,13],[80,12,21,15],[80,49,21,11],[25,47,11,9],[45,10,9,11],[28,26,13,11],[44,24,9,11],[61,13,13,13],[80,30,19,11]],
 names:['Pump-station arrival','Main intake','Duty register','Cold tool store','Manual vent control','The copper lung','Piston hall','Independent return pipe','Old fitter\'s locker','Relay lookout','Wash and rest room','Valve bench','Pressure log vault','Expansion buffer'],
 links:[[0,1],[1,2],[2,3],[3,9],[9,11],[11,4],[4,0,[[38,47]]],[1,10],[10,4],[3,10],[0,8],[8,10],[4,5,[[49,39],[53,39]]],[5,13],[13,6],[6,12],[12,5],[13,7],[7,5]],
 motifs:['barrel lamp','hydrant pillar','sign lantern','crate barrel','hydrant firedrum','pillar crystal','pillar hydrant','fence lamp','crate pot','window lantern','pot awning','crate firedrum','sign candle','hydrant pillar'],
 fittings:[[1,-4,-4,2,3,'b'],[2,-5,-3,3,2,'H'],[3,4,2,3,2,'b'],[4,-7,3,4,2,'H'],[5,-6,-4,3,2,'b'],[6,-8,-5,4,3,'H'],[6,4,3,4,2,'H'],[7,5,-3,3,2,'b'],[13,4,-3,3,2,'b']],
 details:[[2,'The missing change of crew','The duty register lists one crew across three shifts. The pressure log records a different hand every hour.','The register now names each actual crew. A shift ends when its replacement confirms the handover.','sign'],[4,'The valve that can stop','The motor can open the feed faster than the return pipe can empty it. A handwheel has been sealed under a brass order plate.','The handwheel is clear. Its open and closed positions can be checked without power.','hydrant'],[7,'Air with room to return','The return pipe has an unused expansion branch. Someone capped it to make the station look smaller on a plan.','The expansion branch is open. Its gauge shows the pressure it accepts when another chamber rests.','fence']],
 secretLabel:'Nera\'s first valve',secretText:'A small practice valve turns without resistance. Its wooden tag says: Learn the stop before the start.',secretAfter:'The valve sits on the lesson bench. A second hand can reach it from the other side.',secretProp:'hydrant',afterBay:[24,51,6,5],afterName:'Shared valve lesson bay'
});
add('palewreck',{
 size:[96,66],axis:'y',cut:32,gate:71,shell:'~',floor:'=',task:'u_depth_04',gateLabel:'Lower hold watertight door',
 r:[[9,11,13,13],[29,11,19,9],[53,10,17,11],[13,25,17,9],[71,22,15,13],[71,45,17,15],[46,44,21,15],[16,47,21,19],[45,25,13,9],[85,9,13,11],[29,25,11,9],[88,25,11,9],[90,47,7,15],[43,58,15,9]],
 names:['Wreck mooring','Exposed keel walk','Cargo manifest room','Survivors\' cabin','Breach survey deck','Lower hold','The silent bridge','Broken stern garden','Sailmaker\'s hidden berth','Mainmast lookout','Dry cabin shelter','Hull-patch bench','Passenger record cabinet','The stern return gangway'],
 links:[[0,1],[1,2],[2,4],[0,3],[3,10],[10,8],[8,2],[2,9],[9,11],[11,4],[4,5,[[71,30],[71,34]]],[5,6],[6,7],[5,12],[12,13,[[90,58]]],[13,6],[7,13,[[16,58]]]],
 motifs:['barrel fence','rock lamp','sign crate','window pot','fence lantern','crate barrel','pillar banner','flowers fence','crate candle','pillar lamp','awning pot','barrel firedrum','crate lantern','fence lamp'],
 fittings:[[1,-7,-2,4,1,'~'],[2,4,-3,3,2,'b'],[3,-6,2,3,1,'~'],[4,3,-4,2,3,'~'],[5,-6,3,3,3,'b'],[6,-8,-5,4,3,'~'],[6,4,3,3,2,'b'],[7,-7,-6,4,3,'~'],[7,4,5,3,2,'~'],[13,-5,-2,3,1,'b']],
 details:[[2,'Weight without a name','The cargo book lists passengers as deck weight. Pencil names appear beside those entries, written after the ship went down.','The names are copied to the public record. No passenger is reduced to the space they occupied.','sign'],[4,'A crack across two plates','The broken seam crosses two plates of different metal. Their bolts are sound; their movement was never allowed for.','The repair leaves room for the plates to move. The original crack remains marked on the inspection drawing.','fence'],[7,'Green inside the wreck','A small garden grows in spilled grain. The old bridge order called every seed cargo to be recovered.','The garden remains in the open stern. A few seeds are collected each season, with room for the plants that stay.','flowers']],
 secretLabel:'The sailmaker\'s spare place',secretText:'A narrow berth holds two cups and one blanket. The sailmaker saved a dry place for whoever reached it next.',secretAfter:'The berth has a second blanket. A route marker points to it from the lower deck.',secretProp:'pot',afterBay:[48,27,6,3],afterName:'Dry blanket shelf'
});
add('lumenreef',{
 size:[88,76],cut:45,gate:49,shell:'~',task:'u_depth_06',gateLabel:'Reef nursery observation screen',
 r:[[10,12,15,15,'diamond'],[28,10,17,11,'oval'],[10,34,17,15,'oval'],[11,59,17,17,'oval'],[32,49,17,15,'oval'],[59,49,19,17,'oval'],[71,24,23,17,'diamond'],[64,66,25,11,'oval'],[31,31,13,13,'oval'],[32,68,15,7],[29,22,13,9,'oval'],[31,39,11,9],[56,9,17,11,'oval'],[79,46,11,13,'diamond']],
 names:['Reef light landing','Quiet approach pool','Species record ledge','Dark nursery','Current and light control','The observation chamber','Lumen heart reef','Open-water light garden','Naturalist\'s hollow','Low-light lookout','Observer rest pool','Lens cleaning bench','Seasonal reef records','The shaded return'],
 links:[[0,1],[0,2],[2,3],[3,4],[1,10],[10,8],[8,11],[11,4],[2,8],[3,9],[9,4],[4,5,[[43,49],[47,49]]],[5,6],[6,12],[12,5,[[49,9],[49,49]]],[6,13],[13,5],[5,7],[7,13]],
 motifs:['rock lantern','crystal fence','sign pot','flowers rock','hydrant crystal','crystal pillar','crystal flowers','flowers lantern','mushroom pot','fence candle','awning pot','crate crystal','sign lantern','rock flowers'],
 fittings:[[1,3,-3,3,2,'~'],[2,-6,3,3,2,'~'],[3,3,-5,3,3,'~'],[4,-6,3,2,2,'~'],[5,-6,-5,3,2,'~'],[6,3,-5,4,3,'~'],[7,-8,2,4,2,'~'],[10,3,-2,2,1,'b'],[13,-3,3,2,2,'~']],
 details:[[2,'A light that means different things','The guide calls every bright patch healthy. A naturalist has marked one patch that shines most strongly when its water is poor.','The guide now records each species and its signs. Brightness alone cannot stand for the health of the reef.','sign'],[4,'Shade on the same schedule','A lamp gives the reef an endless noon. Its controller has no entry for night.','The controller has a dark interval. Visitors can watch the reef without asking it to shine for them.','crystal'],[7,'A garden with open water','The old fence closes the reef against the current that feeds it. Empty gaps have appeared behind the largest panels.','The heavy panels are stored ashore. Small markers show a safe path without closing the living water.','flowers']],
 secretLabel:'The dark page',secretText:'One page of the reef book is painted almost black. A caption asks the reader to wait before deciding that nothing is there.',secretAfter:'The page has tiny dots where the patient observer found new light. Several dark spaces remain.',secretProp:'crate',afterBay:[34,31,6,4],afterName:'Dark observation alcove'
});
add('driftcourt',{
 size:[86,80],axis:'y',cut:44,gate:18,shell:'~',floor:'=',task:'u_depth_05',gateLabel:'Common council water door',
 r:[[10,10,15,13],[31,10,17,11],[54,10,17,11],[11,29,15,15],[31,30,17,13],[18,58,21,15],[43,64,21,15],[70,61,23,19],[73,28,15,13],[74,10,17,11],[51,30,15,13],[31,40,11,5],[51,50,15,7],[17,73,23,7]],
 names:['Court ferry arrival','Common arrival hall','Residents\' register','Shared kitchen','Council door desk','The drift court','Living hall','Open-water square','Pax\'s quiet room','Surface-signal lookout','Guest rest room','Repair table','Public decision shelves','The evening return walk'],
 links:[[0,1],[1,2],[2,9],[0,3],[3,4],[4,10],[10,8],[8,9],[2,10],[4,11],[11,3],[4,5,[[18,30],[18,42],[18,46]]],[5,6],[6,7],[7,12],[12,5],[5,13],[13,6]],
 motifs:['fence lamp','awning lantern','sign candle','pot brazier','sign lantern','pillar banner','awning pot','flowers lantern','window candle','fence lamp','awning pot','crate firedrum','crate sign','fence flowers'],
 fittings:[[1,-6,2,3,2,'b'],[2,4,-3,3,2,'H'],[3,-5,3,2,3,'b'],[4,3,-4,3,2,'b'],[5,-8,-5,4,2,'H'],[6,4,3,4,2,'b'],[7,-9,4,4,3,'~'],[7,5,-6,3,2,'b'],[10,3,3,2,2,'b'],[12,-5,-2,3,1,'b']],
 details:[[2,'Who counts as a resident','The old register starts with a birth address. Most families here arrived after their first home went under.','The register starts with how to find someone now. A person can leave private details blank.','sign'],[4,'A place to disagree','The desk has one small speaking tube for the chair. The room beyond contains many marks where voices could not be heard.','Several tubes face the room. The record keeps a reason for disagreement beside the decision.','sign'],[7,'The square after the meeting','The square holds cooking pots, wet boots, toys, and a stage plank. The old plan labels the whole space waiting.','The plan names the square as shared living space. Meetings leave it clear for the next use.','flowers']],
 secretLabel:'Pax\'s unfinished invitation',secretText:'The invitation names a speaker but leaves the topic blank. A note says: Let them bring what they need to say.',secretAfter:'The invitation is folded beside the reply. The guest has chosen a topic no one had put on the agenda.',secretProp:'crate',afterBay:[74,33,6,5],afterName:'Quiet guest reading bay'
});
add('nightcable',{
 size:[104,64],cut:58,gate:31,floor:'=',task:'u_depth_07',gateLabel:'Live cable isolation gate',
 r:[[8,48,13,13],[9,29,13,13],[11,10,17,13],[30,11,17,11],[45,31,17,15],[70,31,17,15],[91,11,19,13],[91,49,19,15],[29,48,13,13],[48,11,13,11],[28,29,13,13],[46,49,13,11],[70,11,13,11],[70,50,15,11]],
 names:['Cable station arrival','Western cable drum','Signal register','Spare wire store','Manual isolation stand','Live cable gallery','Eastern signal hall','Night receiver deck','Line keeper\'s room','Test-lamp lookout','Warm rest room','Jointing bench','Cable fault archive','Independent return wire'],
 links:[[0,1],[1,2],[2,3],[3,9],[9,4],[4,11],[11,8],[8,0],[1,10],[10,4],[3,10],[4,5,[[56,31],[60,31]]],[5,6,[[91,31]]],[6,12],[12,5],[5,7,[[91,31]]],[7,13],[13,5]],
 motifs:['barrel lamp','pillar hydrant','sign lantern','crate barrel','hydrant lantern','pillar crystal','pillar lamp','fence crystal','crate window','fence lantern','pot brazier','crate firedrum','crate sign','hydrant lantern'],
 fittings:[[1,-4,-4,2,3,'b'],[2,-6,-4,3,2,'H'],[3,3,2,3,2,'b'],[4,4,-5,2,3,'H'],[5,-6,4,3,2,'b'],[6,-7,-4,3,2,'H'],[6,4,2,3,2,'H'],[7,4,-5,3,2,'b'],[12,3,-3,2,2,'b'],[13,-5,2,3,2,'b']],
 details:[[2,'The time beside the signal','The copied signals have no arrival time. A late warning can be mistaken for a new order.','Every received message carries its arrival time and its stated source. Unclear signals remain marked as unclear.','sign'],[4,'Two ways to stop a line','The live line has an automatic cutout. Its manual isolator is hidden behind a panel that needs the live line to open.','The panel is removed. The manual isolator can be reached without power and without an order from the far end.','hydrant'],[7,'An answer below the noise','The receiver repeats the loudest channel. A quiet return call is visible on a smaller needle.','The return call has its own channel. A loud broadcast can no longer cover a request to stop.','crystal']],
 secretLabel:'The keeper\'s small lamp',secretText:'A hand lamp has a warm handle and a wide base. Its maker expected the keeper to work slowly in a cold room.',secretAfter:'The hand lamp rests beside a second one. Neither needs the main cable to give light.',secretProp:'lantern',afterBay:[33,52,5,5],afterName:'Independent lamp shelf'
});
add('firstharbor',{
 size:[104,82],cut:59,gate:42,shell:'~',floor:'=',task:'u_depth_09',gateLabel:'First Harbor inner-quay shutter',
 r:[[10,54,15,15],[10,31,17,15],[13,10,19,13],[37,12,21,15],[44,42,21,17],[73,42,21,19],[87,15,25,17],[87,65,25,19],[30,61,15,13],[48,70,15,13],[34,28,17,11],[44,58,17,11],[68,13,15,13],[67,70,15,13]],
 names:['The last marked landing','First Harbor approach','Founders\' arrival register','The public storehouse','Tidal demand control','Inner quay','The first harbor heart','Beyond the old breakwater','The ferryman\'s room','Outer-current lookout','Travellers\' shelter','Old quay repair bench','Unclaimed record vault','The living return quay'],
 links:[[0,1],[1,2],[2,3],[3,10],[10,4],[4,11],[11,8],[8,0],[8,9],[9,11],[1,10],[4,5,[[57,42],[61,42]]],[5,6],[6,12],[12,5],[5,7],[7,13],[13,5],[6,7,[[100,15],[100,65]]]],
 motifs:['fence lantern','rock lamp','sign candle','crate barrel','hydrant crystal','pillar banner','pillar crystal','flowers fence','window pot','fence lamp','awning pot','crate firedrum','crate lantern','flowers lantern'],
 fittings:[[1,-6,-5,3,3,'~'],[2,-7,-4,4,2,'H'],[3,5,3,4,2,'b'],[4,-8,5,4,2,'~'],[5,5,-6,3,3,'b'],[6,-10,-6,4,3,'H'],[6,6,4,4,2,'~'],[7,-10,4,4,3,'~'],[7,5,-6,4,2,'b'],[13,3,3,3,2,'~']],
 details:[[2,'The first names on the shore','The first page lists arrivals from many coasts. A later hand has written a single founder above all the names.','The later heading is shown with its date. The original names remain readable beside it.','sign'],[4,'The demand beneath the tide','The old control adds every new request to one fixed daily flow. The living coast has never held that flow for a whole season.','The control records the present water and each agreed limit. It can accept a smaller plan without calling the sea a failure.','hydrant'],[7,'A harbor before its wall','Old landing stones continue beyond the breakwater. People used this coast before the first office drew its boundary.','The open stones are marked for visitors. No wall is allowed to stand for the whole history of the shore.','fence']],
 secretLabel:'The ferryman\'s empty return line',secretText:'A ferry book records fares and return times. Beside one crossing, a blank line waits for a person who never came home.',secretAfter:'The blank line remains. A flower rests beside the book without filling the space with a guessed answer.',secretProp:'crate',afterBay:[33,65,6,5],afterName:'Unanswered letters shelf'
});

// The original public atlas builds its first eight mission anchors. Extra
// station rooms are already carved by that function; this adapter exposes
// their centres and labels without a second collision representation.
// Oval and diamond rooms cannot use the base atlas's rectangular corner
// motifs. These authored interior groups keep their gardens and machinery
// visible while leaving all anchor centres and collision rows unchanged.
const roomArt={
 bellhaven:[['control',[-5,-1,'hydrant','#c89e65',1.2],[5,-1,'pillar','#b9c5ae',1],[-3,-4,'firedrum','#bb9167',.9],[3,4,'lantern','#98d9ce',1]],['heart',[-5,-2,'barrel','#c7a573',.8],[5,2,'fence','#b6c2ac',1],[0,-4,'lantern','#a7dfd3',1]]],
 kelpvault:[['heart',[-5,-1,'crystal','#8fd9bf',.8],[3,-2,'vines','#679d81',1.2],[-3,5,'palm','#71a78a',.8],[6,0,'mushroom','#aac7a0',1],[0,-4,'flowers','#85bd98',1.2]],['chamber',[-4,-2,'vines','#79b68e',1],[-4,3,'pot','#ceb38a',.85],[4,2,'flowers','#93cfa5',1.1]]],
 copperlung:[['heart',[-5,0,'hydrant','#ca9c6c',1.35],[5,-1,'pillar','#adc9bb',1.2],[0,-4,'firedrum','#c69a64',1],[0,4,'crystal','#82dace',.85]],['control',[-5,0,'hydrant','#c8a370',1],[5,0,'barrel','#b79367',1],[0,-4,'lantern','#9ad8cb',.9]]],
 palewreck:[['horizon',[-5,0,'crate','#b9ac8b',1.1],[5,-2,'barrel','#b39779',.9],[0,-5,'fence','#c5bc9a',1.3],[0,5,'flowers','#9fbe96',1]],['chamber',[-4,-2,'crate','#bea887',1.1],[4,-2,'barrel','#ac946f',.9],[0,4,'lantern','#9ed8d1',1]]],
 lumenreef:[['heart',[-5,-2,'crystal','#94e1d6',1.4],[4,3,'crystal','#9cacdf',1.15],[-4,4,'mushroom','#c3abd1',1.1],[0,-4,'crystal','#c1e3a6',.9]],['horizon',[-5,-1,'flowers','#a4c7b1',1.2],[5,-1,'crystal','#8ad6d3',1.1],[0,3,'flowers','#bfc7df',1]]],
 driftcourt:[['horizon',[-5,-2,'awning','#789f9b',1.1],[-5,2,'pot','#d3b38b',1],[5,-1,'crate','#bea07b',1],[5,3,'banner','#c6a5bc',1],[0,-6,'lantern','#abd7cc',1],[0,5,'flowers','#b4cf9d',1]],['heart',[-5,0,'pot','#c5af8c',1],[5,0,'brazier','#b49b80',.9],[0,-4,'banner','#bb9bb8',1]]],
 nightcable:[['heart',[-5,-2,'pillar','#bcbda3',1.15],[5,1,'hydrant','#ad977c',1.1],[0,-3,'crystal','#a5cee0',1],[-4,4,'barrel','#ad9577',.8],[4,4,'lantern','#a3d6d0',1]],['horizon',[-5,0,'fence','#b3c7bd',1.1],[5,0,'fence','#b3c7bd',1.1],[0,-4,'crystal','#9ec6dc',1.2]]],
 firstharbor:[['heart',[-7,-1,'pillar','#c5c3ab',1.3],[7,-1,'pillar','#c5c3ab',1.3],[0,-5,'lantern','#a9ded1',1.1]],['horizon',[-5,0,'pot','#b7b99a',1],[5,1,'flowers','#abceb0',1.2],[0,-5,'fence','#bbc7ae',1.1]]]
};
const build=A.build;
A.build=(place,act=1,state={})=>{
 const out=build(place,act,state),s=out.layout;if(!s.extraAnchors)return out;
 const point=r=>({x:((s.flipX?out.width-1-r[0]:r[0])+.5)*16,y:((s.flipY?out.height-1-r[1]:r[1])+.5)*16,z:0});
 for(const[name,index]of Object.entries(s.extraAnchors)){out.anchors[name]=point(s.r[index]);out.anchorLabels[name]=s.names[index];}
 for(const[anchor,...pieces]of roomArt[place.id]||[]){
  const p=out.anchors[anchor];
  for(const[dx,dy,type,color,size]of pieces){const x=p.x+dx*16,y=p.y+dy*16;if(['#','H','b','~','G'].includes(out.rows[Math.floor(y/16)]?.[Math.floor(x/16)]))continue;
   out.props.push({type,x,y,z:0,o:{size,color,light:['crystal','lantern','brazier'].includes(type)}});
  }
 }
 const placeProps=(anchor,types,color)=>{const p=out.anchors[anchor];types.forEach((type,i)=>out.props.push({type,x:p.x+(i-1)*26,y:p.y-22,z:0,o:{size:.82,color,light:['lantern','crystal'].includes(type)}}));};
 if(place.id==='bellhaven'&&state.flags?.depth_passage_windows){
  placeProps('register',['lantern','sign','lantern'],'#9edccc');out.choiceArt='Separate passage windows';
  const record=out.landmarks.find(r=>r.id.includes(':register:'));record.text='The passage board shows separate time windows. Each vessel can keep its own safe pace. A return watch remains free between windows.';
 }else if(place.id==='bellhaven'&&state.flags?.depth_passage_convoys){
  placeProps('register',['banner','lantern','banner'],'#d7be87');out.choiceArt='Shared convoy departures';
  const record=out.landmarks.find(r=>r.id.includes(':register:'));record.text='The passage board groups vessels by safe speed. Each convoy names a guide and a return watch. A small boat can ask for a separate crossing.';
 }
 if(place.id==='firstharbor'&&state.flags?.depth_reef_garden){
  placeProps('heart',['flowers','bush','pot'],'#80c9ad');placeProps('horizon',['flowers','lantern','flowers'],'#b7ddad');out.choiceArt='Living reef garden';
  const record=out.landmarks.find(r=>r.id.includes(':horizon:'));record.text='Young reef beds now share the open water with a marked path. Copies of the harbor record remain available in the shelter.';
 }else if(place.id==='firstharbor'&&state.flags?.depth_archive_quay){
  placeProps('heart',['crate','lantern','window'],'#d8c28f');placeProps('horizon',['sign','lantern','crate'],'#9ccad2');out.choiceArt='Open archive quay';
  const record=out.landmarks.find(r=>r.id.includes(':horizon:'));record.text='The open quay holds dated harbor records and a public reading desk. Marked channels keep water moving past the living reef.';
 }
 return out;
};
})();
