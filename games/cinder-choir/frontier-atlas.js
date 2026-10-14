/* The Far Reach: eight original areas. These are authored room and route
 * graphs, with stable mission anchors and collision fixtures. Existing atlas
 * entries are not changed. The outer paths support visible enemies, escorts,
 * return visits, and local records as well as the main story. */
(() => {
'use strict';
const A=globalThis.CC.Atlas;A.frontierVersion='4.0.0';
function add(id,anchors,spec){
 const names=['entry',...anchors.split(' ')];A.anchorNames[id]=names;
 A.layouts[id]={id,anchorNames:names,accents:['#e2bd7d','#8bc5b7','#bf8faf'],...spec};
}
add('farharbor','berth roster rigging breakwater signal drydock fleet',{
 size:[68,50],cut:39,gate:13,shell:'~',floor:'=',task:'e_reach_01',done:'reach_harbor_open',gateLabel:'North drydock boom',
 r:[[8,40,13,13],[8,22,11,13],[11,7,15,9],[27,10,13,11],[29,29,15,13],[49,13,15,15],[57,31,13,13],[47,42,17,11],[27,42,11,9]],
 names:['Eastwater landing','Rescue berth','Watch roster room','Rigging court','Breakwater steps','Signal deck','North drydock','The free fleet','Old pilot house'],
 links:[[0,1],[1,2],[2,3],[3,4,[[33,10],[33,29]]],[4,0,[[29,36],[8,36]]],[1,8,[[18,22],[18,42]]],[8,4],[4,5,[[34,29],[34,13],[41,13]]],[5,6,[[57,13]]],[6,7],[7,5,[[43,42],[43,13]]]],
 motifs:['barrel lamp','awning pot','sign candle','crate banner','rock hydrant','lamp fence','pillar firedrum','banner awning','window lantern'],
 fittings:[[1,-4,-4,2,3,'b'],[2,-6,-3,3,1,'H'],[3,4,2,2,3,'b'],[4,-5,-4,3,2,'~'],[4,3,3,3,2,'~'],[5,-5,-5,3,2,'b'],[6,3,-4,2,2,'H'],[7,-6,-3,4,1,'b']],
 details:[[2,'The missing watch','A slate assigns the same three pilots to every night. Under each name, someone has written a place where they can sleep.','The slate has spaces for rest, weather, and a second crew. The harbor keeps one boat free for an unplanned rescue.','sign'],[4,'The storm on the steps','White shells mark three old floods. The newest line passes above the rescue shed window.','A new handrail follows the shells to high ground. The low shed holds ropes and empty barrels.','rock'],[7,'Eight different bows','The boats have different hulls, sails, and engines. A faded order requires them all to turn at the same speed.','The shared chart lists what each boat can safely do. No captain must pretend to have another vessel.','banner']],
 secretLabel:'The pilot who stayed ashore',secretText:'A pilot house window contains a polished lens and a letter: My hands shake. I can still keep the light.',secretAfter:'A new seat faces the lens. The watch book records a clear signal on every night of the storm.',secretProp:'lantern',afterBay:[30,46,4,3],afterName:'Pilot rest porch'
});
add('tideglass','shore tide westmirror eastmirror lens channel causeway',{
 size:[66,54],axis:'y',cut:31,gate:41,shell:'~',task:'e_reach_02',done:'reach_tideglass_open',gateLabel:'Low-water lens bridge',
 r:[[8,9,11,11,'oval'],[24,8,13,9],[44,8,15,9],[9,23,13,11,'diamond'],[41,23,17,11,'diamond'],[41,41,15,13],[56,44,13,11,'oval'],[18,43,19,13],[23,23,9,9]],
 names:['Shell landing','Checked shore','Tide reader platform','Western mirror','Eastern mirror','Focus lens','Clear-water channel','Outer causeway','Mirror keeper shelter'],
 links:[[0,1],[1,2],[0,3],[2,4],[3,4,[[9,27],[41,27]]],[1,8],[8,3],[8,4],[4,5,[[41,29],[41,33]]],[5,6],[5,7],[6,7,[[57,49],[18,49]]]],
 motifs:['rock palm','fence lamp','hydrant sign','crystal fence','crystal lamp','crystal pillar','hydrant barrel','fence lamp','awning pot'],
 fittings:[[1,-5,-3,2,2,'~'],[2,-6,-3,3,2,'b'],[3,-3,-3,2,2,'~'],[4,4,2,3,2,'~'],[5,-5,-4,3,2,'b'],[6,3,-3,2,2,'~'],[7,-7,3,4,2,'b']],
 details:[[2,'The hour beside the height','The tide reader records water height but no time. Two matching readings can belong to opposite tides.','Each reading includes its time and whether the water rises or falls. A blank space is reserved for uncertain observations.','sign'],[4,'The mirror under salt','The eastern mirror has a clean circle where a sailor rubbed it with a sleeve. Outside that circle, the beam points toward open water.','The mirror has a cleaning handle and a covered rest position. Its useful angle is marked on the rim.','crystal'],[7,'Footprints that turn back','A line of old footprints ends at the highest dry stone. A second line returns to the shelter.','The marked road ends at a large turn-back sign. A crossing remains a choice after the light turns green.','fence']],
 secretLabel:'A pocket full of colored glass',secretText:'A tin holds seven scraps of glass. The keeper used them to explain signals to a child who could not hear the bell.',secretAfter:'The glass scraps sit beside seven carved shapes. Visitors can learn the signals by sight or touch.',secretProp:'crate',afterBay:[24,27,4,3],afterName:'Signal lesson nook'
});
add('mosswake','path seedbank nursery spring rootbridge reedbed grove',{
 size:[72,56],cut:37,gate:16,shell:'#',task:'e_reach_03',done:'reach_mosswake_open',gateLabel:'Root bridge safety span',
 r:[[8,43,13,13,'oval'],[8,24,11,13,'oval'],[10,8,15,11,'oval'],[25,43,13,13,'oval'],[27,12,15,13,'oval'],[47,16,17,15,'oval'],[60,33,17,15,'oval'],[49,47,17,11,'oval'],[25,27,11,11,'oval']],
 names:['Moss ferry clearing','Reed path','Dry seed bank','Six-season nursery','Spring ring','Living root bridge','Deep reed beds','The waking grove','Old gatherer hollow'],
 links:[[0,1,[[5,34]]],[1,2],[0,3],[2,4],[3,4,[[31,43],[31,12]]],[1,8],[8,4],[4,5,[[33,16],[39,16]]],[5,6,[[58,16],[58,33]]],[6,7,[[64,47]]],[7,5,[[42,47],[42,16]]]],
 motifs:['flowers pot','vines bush','crate lantern','flowers pot','rock grass','tree fence','vines palm','tree flowers','mushroom candle'],
 fittings:[[1,-4,-4,2,3,'#'],[2,-6,-3,3,2,'#'],[3,-4,2,2,3,'~'],[4,3,-4,3,2,'~'],[5,-5,3,3,3,'~'],[6,4,-4,3,3,'~'],[7,4,2,3,2,'#']],
 details:[[2,'Seed for more than one season','Every sealed jar has two dates: when it was gathered and when it last grew. The oldest seed is not always the weakest.','The seed bank keeps a few seeds from every successful bed. Gardeners can ask for a small trial before they promise a full planting.','crate'],[4,'The spring that answers slowly','A stone dipper hangs beside the pool. The return stream does not rise until long after a jar has been filled.','A waiting mark beside the pool reminds visitors to measure the return flow as well as the first draw.','rock'],[7,'A grove with no master tree','The largest stump bears a court crest. Around it, young trees of six kinds share the new light.','A narrow path passes between the six stands. No new trunk has been chosen to carry a crest.','tree']],
 secretLabel:'The moss book',secretText:'Leaves are pressed into a folded reed cover. The last page is a drawing of a meal, with names beside the plants.',secretAfter:'The last page has space for new meals and new names. A small note asks readers to identify a plant before they taste it.',secretProp:'pot',afterBay:[29,31,5,4],afterName:'Gatherer teaching bed'
});
add('redspan','yard cargo brake magnet coupling span terminus',{
 size:[78,44],cut:43,gate:28,floor:'=',task:'e_reach_04',done:'reach_redspan_open',gateLabel:'Magnetic coupling barrier',
 r:[[8,31,13,13],[8,10,13,11],[24,10,13,11],[36,10,9,13],[32,27,15,11],[52,28,13,11],[64,12,17,13],[66,35,17,11],[21,31,9,9]],
 names:['Western rail arrival','Western cargo yard','Open manifest shed','Manual brake house','Magnet chamber','Coupling platform','Red service span','Safe terminus','Porter signal hut'],
 links:[[0,1],[1,2],[2,3],[3,4],[4,0],[0,8],[8,2],[4,5,[[41,28],[45,28]]],[5,6,[[52,12]]],[5,7],[6,7,[[73,12],[73,35]]]],
 motifs:['crate sign','barrel awning','crate barrel','hydrant fence','crystal pillar','firedrum crate','banner streetlamp','crate lantern','window pot'],
 fittings:[[1,-5,-3,3,2,'H'],[2,-5,-3,2,3,'b'],[3,2,-4,1,3,'H'],[4,3,2,3,2,'b'],[5,-4,-3,2,2,'b'],[6,-6,-4,4,2,'H'],[6,4,3,3,2,'H'],[7,4,-3,3,2,'b']],
 details:[[2,'What the manifest weighs','A crate of stove plates is listed as empty because no fee was paid for its destination. The damaged axle disagrees.','The manifest lists actual mass, destination, and safe handling. The fee column has become a column for who will unload it.','sign'],[4,'North pulls south','Two magnet diagrams show opposite pole labels. A tiny date reveals that one diagram belongs to the machine that stood here before.','The current diagram is fixed to the current machine. The old one remains in a sleeve marked with its dates.','crystal'],[7,'A track that ends safely','The last rail points toward the edge. Red paint marks where a porter tried to warn drivers from below.','A gravel catch bed and a manual stop stand before the edge. The red mark is still visible from the cab.','fence']],
 secretLabel:'A porter signal glove',secretText:'The glove has a bright palm and a dark back. Inside, a folded card says: If you lose sight of me, stop.',secretAfter:'The signal card is sewn to each new glove. The old glove is kept where the next driver can see it.',secretProp:'crate',afterBay:[20,35,5,3],afterName:'Signal practice platform'
});
add('palehearth','approach stores hearth chimney shelter cistern ridge',{
 size:[66,62],axis:'y',cut:34,gate:14,task:'e_reach_05',done:'reach_palehearth_open',gateLabel:'Ice shelter wind door',
 r:[[10,10,15,13,'diamond'],[30,9,15,11],[52,9,17,11],[12,25,15,11],[33,25,15,11],[14,46,19,15],[35,51,17,13],[54,44,17,15,'diamond'],[52,25,11,11]],
 names:['Ice ferry arrival','White shelf approach','Winter stores','Common hearth','Chimney gallery','Inner shelter','Covered cistern','Windward ridge','Mender alcove'],
 links:[[0,1],[1,2],[0,3],[3,4],[2,4,[[45,9],[45,25]]],[2,8],[8,4],[4,5,[[14,25],[14,36]]],[5,6],[6,7],[7,5,[[54,57],[14,57]]]],
 motifs:['rock lamp','rock lamp','crate barrel','brazier pot','pillar firedrum','awning lantern','hydrant barrel','rock fence','window candle'],
 fittings:[[1,-6,-3,3,2,'H'],[1,3,3,3,1,'H'],[2,-6,2,4,2,'b'],[3,3,-3,2,2,'#'],[4,-5,-3,3,1,'b'],[5,-7,-4,3,2,'b'],[5,4,3,3,2,'b'],[6,-6,3,4,2,'~'],[7,3,-3,3,3,'#']],
 details:[[2,'The winter reserve','Food sacks are counted against an expected thaw date. The date is written in ink that has not changed for three years.','The stores board lists a range of possible thaw dates and enough food for the late one. A chalk column follows the actual season.','crate'],[4,'The black snow','Soot has settled inside the chimney rather than outside it. A draft test hangs folded beneath the fuel order.','A clear cloth now hangs at the inspection hatch. Any darkening starts an inspection before the next firing.','firedrum'],[7,'A light below the ridge','A traveler cut a notch into the cairn so the shelter lamp can be seen from a lower path.','A second lamp faces the lower path. Its keeper checks it from the notch, not from the warm doorway.','lamp']],
 secretLabel:'The blanket with many corners',secretText:'Small squares of different cloth have been joined into one thick blanket. Each square once belonged to a coat that could no longer be repaired.',secretAfter:'The blanket covers a long bench. The mender has left a basket of spare squares for the next torn corner.',secretProp:'pot',afterBay:[57,24,4,5],afterName:'Winter mending table'
});
add('stormloom','landing sail vane shuttle loom mast canopy',{
 size:[74,60],cut:40,gate:42,shell:'~',floor:'=',task:'e_reach_06',done:'reach_stormloom_open',gateLabel:'Loom service crossing',
 r:[[8,9,13,13],[27,9,17,11],[9,27,13,13],[10,48,15,13],[28,42,17,13],[53,42,19,15],[62,22,17,15],[53,8,19,11],[27,26,11,13]],
 names:['Sky barge arrival','Sky barge landing','Sail cutting room','Live wind vane','Shuttle workshop','Loom floor','Main mast platform','Canopy frame','Weaver rest bay'],
 links:[[0,1],[0,2],[2,3],[3,4],[1,4,[[34,9],[34,42]]],[2,8],[8,4],[4,5,[[38,42],[42,42]]],[5,6,[[65,42],[65,22]]],[6,7,[[57,22],[57,8]]],[7,5,[[45,8],[45,42]]]],
 motifs:['fence lamp','fence lamp','banner crate','hydrant sign','crate firedrum','pillar banner','pillar fence','awning banner','pot window'],
 fittings:[[1,-6,-3,4,2,'b'],[2,3,2,2,3,'H'],[3,-5,-4,3,2,'H'],[4,4,-4,3,2,'b'],[5,-7,-4,3,3,'b'],[5,4,3,4,2,'b'],[6,4,-4,3,2,'H'],[7,-7,2,4,2,'b']],
 details:[[3,'The wind in the margin','A weather sheet records average wind. The weaver has written the strongest gust in the margin, where the load table never looks.','Average and gust now have equal space on the load table. The stop mark follows the stronger reading.','sign'],[5,'One shuttle missing','An empty shuttle slot has been painted to look occupied. The loom has been crossing that space at full speed.','The slot is marked as empty, and the controller skips it. The new shuttle can wait until its guide is fitted.','crate'],[7,'Cloth that lets the storm pass','A sample sail has narrow openings that close in light wind and part in a gust. Its first test order demands that every opening be sealed.','The openings remain. The canopy shares a little of the wind instead of trying to own all of it.','banner']],
 secretLabel:'The weaver\'s rest bell',secretText:'The bell rope reaches every loom, but a knot holds it above head height. A stool below it is worn smooth.',secretAfter:'The knot is gone. A second pull hangs at the seated workbench. Both sound the same clear stop.',secretProp:'lantern',afterBay:[20,30,5,7],afterName:'Seated loom bench'
});
add('mirrorbay','jetty names consent basin prism archive reflection',{
 size:[72,58],axis:'y',cut:32,gate:33,shell:'~',task:'e_reach_07',done:'reach_mirrorbay_open',gateLabel:'Reflection basin screen',
 r:[[9,8,13,11],[28,8,15,11],[9,23,13,11],[29,23,13,11],[48,23,17,11],[33,44,19,15],[56,45,19,15],[11,45,17,15],[52,9,15,11]],
 names:['Mirror water arrival','Mirror water jetty','Visitors name table','Consent room','Still basin','Prism control','Private archive','Reflection garden','Keeper quiet room'],
 links:[[0,1],[0,2],[2,3],[3,1],[3,4],[1,8],[8,4],[4,5,[[33,23],[33,34]]],[5,6],[5,7],[6,7,[[61,53],[11,53]]]],
 motifs:['fence lantern','fence lantern','sign candle','window pot','crystal rock','crystal pillar','crate candelabra','rock flowers','pot candle'],
 fittings:[[1,-5,-3,3,1,'b'],[2,-4,2,3,1,'b'],[3,3,-3,2,2,'~'],[4,-6,-3,3,2,'H'],[5,-7,-5,3,3,'H'],[5,4,3,3,2,'H'],[6,-7,-4,3,3,'~'],[7,4,3,2,2,'~']],
 details:[[3,'A blank answer','The consent form offers keep or erase. Someone has drawn a third box: Ask me later.','The third box is printed on the form. A date can be suggested, but leaving it blank is still a complete answer.','sign'],[5,'A face out of time','The prism shows a face from an old record beside the person who stands before it. It keeps adjusting the living face to match.','The prism shows the date of its record. It no longer claims that a stored moment is a whole person.','crystal'],[7,'The shore beyond the glass','A low opening in the archive wall lets visitors see the water. The polished panels around it show the water from a different day.','The opening is larger. The dated panels remain for visitors who wish to compare the sea, rather than replace it.','window']],
 secretLabel:'A song left unfinished',secretText:'A folded score ends halfway through a phrase. Beside it: I do not want someone else to finish this for me.',secretAfter:'The score remains unfinished in a closed sleeve. The sleeve is labeled with the choice, not a guess at the missing notes.',secretProp:'crate',afterBay:[59,8,4,5],afterName:'Quiet reading alcove'
});
add('lastweather','approach barometer wind rain atlas crown horizon',{
 size:[80,64],cut:43,gate:30,task:'e_reach_11',done:'reach_lastweather_open',gateLabel:'Horizon control isolation gate',
 r:[[9,31,15,15],[10,9,15,11],[29,9,17,11],[11,52,17,13],[30,31,19,15],[56,30,19,17],[65,10,21,13],[66,51,21,15],[29,51,11,11]],
 names:['Weather station landing','Last weather approach','Pressure observatory','Wind observatory','Rain observatory','Unfinished atlas','Crown control hall','Horizon platform','Field recorder shelter'],
 links:[[0,1],[1,2],[2,4],[4,0],[0,3],[3,8],[8,4],[4,5,[[41,30],[45,30]]],[5,6],[5,7],[6,7,[[76,10],[76,51]]]],
 motifs:['rock lamp','rock lamp','hydrant window','banner sign','barrel hydrant','crate candle','crystal pillar','fence lamp','pot lantern'],
 fittings:[[1,-5,-3,3,2,'H'],[2,4,2,3,2,'b'],[3,-6,3,3,2,'~'],[4,-7,-5,4,2,'H'],[4,4,4,3,2,'b'],[5,-7,-5,3,3,'H'],[5,4,4,3,3,'H'],[6,5,-4,3,2,'#'],[7,-8,-4,4,2,'#']],
 details:[[2,'The needle at the stop','The pressure needle rests against its highest mark. An old notice calls a reading beyond the scale impossible.','The gauge now marks beyond range as a real report. Another instrument waits beside it to measure what the first cannot.','hydrant'],[5,'The map with a white edge','The atlas ends at the Reach. Its legend calls everything beyond the border stable, though no vessel has reported from there.','The edge is marked unmeasured. Reports include their source and time, with room for a different account beside them.','sign'],[7,'Weather with no final word','A brass plate promises a last storm after one final correction. Under it are scratches from six replaced plates.','The plates hang together at the exit. Outside, a small board gives the next watch and the current sky.','lamp']],
 secretLabel:'The observer\'s first drawing',secretText:'A pencil drawing shows a cloud shaped like a sleeping animal. No readings, orders, or warnings appear on the page.',secretAfter:'The drawing hangs beside a clear window. There is paper below it for anyone who wants to look without measuring.',secretProp:'crate',afterBay:[32,55,5,4],afterName:'Open observation desk'
});
})();
