/* Cinder Choir - authored area atlas. Coordinates describe rooms and routes,
 * not scatter seeds. Tile geometry is independent of the rendering engine.
 * Stage anchors stay stable across saves and across both world states. */
(() => {
'use strict';
const CC=globalThis.CC=globalThis.CC||{}, A=CC.Atlas={version:'3.0.0',layouts:{}};
const ANCHORS={
 lowquay:'office scales sluice warehouse roof gate dispatch',
 glassmine:'gauges vent roster pump engine spool shaft',
 wirewood:'westroot eastroot spring garden seedstore nest canopy',
 westrelay:'hospital feed return switchroom conduit relay ward',
 lanternward:'kitchen market homes memorial stall stage broadcast',
 brassline:'luggage passengers brakes signal engine cab platform',
 hushtheatre:'dressing prompt gallery stage booth shutter balcony',
 civicvault:'receipts returns originals press dispatch seal ledger',
 academy:'lesson court desk wing library board observatory',
 witnessarchive:'witness1 witness2 witness3 index survey keeper record',
 spireyard:'brace lift scaffold rubble platform winch roof',
 highchoir:'gallery evidence exits council weather throne balcony',
 crownbridge:'refuge westlock eastlock winch span gate lookout',
 heartengine:'feedwest feedeast feednorth copy heart escape reservoir',
 cinderstrand:'prow sail coil workshop shore wren deck',
 tideward:'stairs roof loft skiff shelter delivery rooftop',
 shardroad:'camp sealwest sealeast deed ravine return memorial',
 drownedworks:'gauge intake switchroom turbine undertow workbench outlet',
 windstage:'speakerwest speakereast gallery chorus roof stage balcony',
 bellpeak:'school lowbell highbell storm lookout roost summit',
 mercyisle:'patient1 patient2 patient3 stores clinic light garden',
 unwrittenhall:'bay1 bay2 bay3 locks workfloor registry yard',
 rootwell:'intake pressure relief signal exitroute seal core',
 namevault:'witness return index signal dispatch seal copy',
 skybelfry:'westtower easttower bridge signal beacon seal crown',
 stillstar:'root name bell memory return core dawn',
 saltmill:'measure bin infirmary wheel office spillway flour',
 reedlock:'gauge upper lower nursery chamber gate bank',
 copperfen:'beacon causeway reeds sink shelter ferry island',
 pilgrimpost:'desk bunk1 bunk2 kitchen ledger door courtyard',
 emberpost:'sorting returns parcels stamps counter dispatch roof',
 inkhaven:'register oldstreet newstreet press crossing store terrace',
 rainspindle:'barometer vane gauge report beacon tower roof',
 cloudharrow:'collector valvewest valveeast nursery platform reservoir rain',
 morrowkiln:'furnace cooling worker clay kiln dispatch roof',
 dawnsound:'survey tide landing posts hall hearth pier'
};
A.anchorNames=Object.fromEntries(Object.entries(ANCHORS).map(([id,s])=>[id,['entry',...s.split(' ')]]));
// room tuples: [centerX,centerY,width,height,shape?,floor?]. Room zero is
// the entrance, rooms one to seven hold stage anchors, room eight is a
// side chamber. Links are [from,to,optional intermediate tile points].
const add=(id,spec)=>{
 const names=A.anchorNames[id];
 A.layouts[id]={id,anchorNames:names,...spec};
};

// Soot coast. The customs quay, deep workings, and river woods have different
// routes even though the same party visits them in the opening chapters.
add('lowquay',{
 size:[54,42],cut:30,gate:19,shell:'~',floor:'=',task:'ch01',done:'gate_open',gateLabel:'Customs warehouse shutter',
 r:[[8,33,11,11],[8,20,11,9],[9,7,13,9],[23,8,9,9],[23,21,11,9],[39,19,11,11],[45,7,11,9],[44,33,13,11],[23,34,9,7]],
 names:['Ferry landing','Names office','Fish scales','Tide sluice','Customs warehouse','Net loft','Harbor gate','Dispatch quay','Old tide watch'],
 links:[[0,1],[1,2],[2,3],[3,4],[4,0,[[23,29],[8,29]]],[1,8,[[16,20],[16,34]]],[4,5,[[28,19],[32,19]]],[5,6,[[39,7]]],[5,7,[[39,33]]],[6,7,[[50,7],[50,33]]]],
 motifs:['barrel crate','sign lamp','awning barrel','hydrant fence','crate banner','vines lantern','pillar lamp','crate awning','lantern pot'],
 details:[[1,'An erased place on the list','Dema has written her brother\'s name over the scrape left by the customs blade. Below it, a clerk has written: Not authorized to return.','The scrape is framed in glass. New arrivals write their own names beside it.','sign'],[3,'A tide mark, not a border','Blue paint records the highest winter tide. The locked sluice stands a hand above the line.','The gate plate now carries flood levels. No name is used as a measure of water.','hydrant'],[7,'The shared dispatch board','Every cargo slip has a return address. The missing boats have none.','The board lists gardens, workshops, and kitchens. Each route names someone who can answer a late delivery.','sign']],
 secretLabel:'The tide keeper\'s lunch tin',secretText:'Under a loose plank: two dry biscuits and a note. If the gate closes, the west ladder still belongs to the sea.',secretAfter:'The lunch tin is full again. A new note says: Leave one meal; take one when you need it.',secretProp:'pot',afterBay:[24,37,3,3],afterName:'Public ladder'
});
add('glassmine',{
 size:[52,42],cut:28,gate:29,task:'ch02',done:'mine_open',gateLabel:'Pressure bulkhead',
 r:[[7,8,11,11],[20,8,11,9],[8,21,11,9],[9,34,13,9],[22,29,9,11],[36,29,11,11],[43,15,11,11],[37,6,13,7],[22,18,7,7]],
 names:['Chalk-marked entrance','Pressure gallery','Breathing shaft','Shift office','Main pump','Glass engine','Voice spool room','Lower shaft','Lunch ledge'],
 links:[[0,1],[0,2],[2,3],[3,4],[1,4,[[23,8],[23,29]]],[2,8],[4,5,[[26,29],[30,29]]],[5,6,[[36,15]]],[6,7]],
 motifs:['lamp rock','hydrant crystal','vines rock','crate candle','firedrum barrel','crystal pillar','lantern crate','crystal bones','pot candle'],
 details:[[1,'The pressure log','Each reading climbs after the stop bell. Oren has circled the pulse that arrives one beat too late.','A second column records the time each machine rests. Workers sign only for their own shifts.','sign'],[3,'The absent shift','Three wages are listed under equipment costs. The ink is newer than the dust.','The wages have names again. The desk keeps a blank form headed: Report an unsafe order.','crate'],[6,'A knot in the spool','The return wire is folded into the feed socket. Every request to stop becomes another start.','Two bright sleeves keep the feed and return wires apart. A hand crank can release the spool without power.','crystal']],
 secretLabel:'Pell\'s chalk drawing',secretText:'A child has drawn every miner at supper. One chair is left uncolored. Pell has kept the chalk beside it.',secretAfter:'The last chair is colored blue. A small arrow points toward the new tea shelf.',secretProp:'candle',afterBay:[24,20,3,5],afterName:'Tea shelf'
});
add('wirewood',{
 size:[56,44],cut:31,gate:12,shell:'#',task:'ch03',done:'roots_quiet',gateLabel:'Copper thorn arch',flipY:true,
 r:[[8,34,13,11,'oval'],[8,19,11,11,'oval'],[10,7,13,9,'oval'],[23,34,11,11,'oval'],[24,12,11,13,'oval'],[40,12,13,11,'oval'],[46,28,13,11,'oval'],[38,38,11,7,'oval'],[22,24,9,7,'oval']],
 names:['Seed keeper\'s clearing','Western root bed','Eastern root bed','Spring pool','Six-jar garden','Seed store','Thorn nest','Canopy walk','Quiet hollow'],
 links:[[0,1,[[5,27]]],[1,2],[0,3],[2,4,[[18,7]]],[3,4,[[27,34],[27,12]]],[1,8],[8,3],[4,5,[[29,12],[33,12]]],[5,6,[[40,25]]],[6,7],[7,5,[[38,31],[35,31],[35,22],[40,22]]]],
 motifs:['flowers pot','tree vines','pine bush','rock grass','flowers pot','crate lantern','vines tree','fence pine','mushroom flowers'],
 details:[[2,'A tree tied to a clock','Copper staples force a living root against a timing wheel. New bark has grown around every tooth.','The wheel hangs from a branch as a bird shelter. The root bends around its own stone again.','tree'],[4,'Six empty circles','Evi has cleared six places in the soil. Each circle is marked with a jar lid and the name of a neighbor who saved it.','Beans climb the old relay post. The six circles meet in one shared path.','flowers'],[7,'The canopy rail','The wooden rail carries both child-sized and adult-sized hand marks. The city once charged for each crossing.','A little sign asks taller visitors to check the rope before they leave.','fence']],
 secretLabel:'A seed that waited',secretText:'A clay jar is sealed with wax, not a court stamp. Evi\'s note says: Open when the ground is kind enough.',secretAfter:'The wax seal lies beside a green shoot. Someone has watered it this morning.',secretProp:'pot',afterBay:[26,22,4,5],afterName:'Volunteer nursery'
});
add('westrelay',{
 size:[52,40],cut:28,gate:20,task:'ch04',done:'return_line',gateLabel:'Hospital service door',
 r:[[7,20,11,11],[8,7,13,9],[21,7,9,9],[9,33,13,9],[22,20,9,11],[37,20,11,9],[43,7,11,9],[42,33,13,9],[22,33,7,7]],
 names:['Runner\'s platform','Field hospital','Feed room','Return room','Switch room','Conduit gallery','Signal relay','Quiet ward','Runner\'s rest'],
 links:[[0,1],[1,2],[0,3],[2,4],[3,4,[[22,33]]],[4,0],[3,8],[4,5,[[26,20],[30,20]]],[5,6],[5,7]],
 motifs:['sign lantern','awning pot','hydrant lamp','hydrant candle','firedrum pillar','crystal fence','lamp banner','pot lantern','crate flowers'],
 details:[[1,'A name by every bed','Vale has turned each admission slip over. On the clean side, each patient has written how they wish to be called.','The slips now include a box for rest, company, or quiet. It can be changed at any time.','pot'],[3,'The blue return cable','A clean cut runs through the return cable. Its other end has been tied to a decorative bell.','The joined cable is painted blue along its full length. Even at night, its path can be followed by touch.','hydrant'],[7,'A window that opens','The quiet ward has a window handle on the outside. Someone has tied a string through the frame.','The handle is inside now. The string holds a small paper bird.','lantern']],
 secretLabel:'Nim\'s route book',secretText:'The route book records every runner\'s safe stopping place. Nim has added: A late message is better than a lost messenger.',secretAfter:'The route book has a new column for rest days. Several pages are already full.',secretProp:'crate',afterBay:[23,35,3,3],afterName:'Runner\'s tea corner'
});
add('lanternward',{
 size:[56,42],cut:31,gate:29,shell:'~',floor:':',task:'ch05',done:'stage_pass',gateLabel:'Market service arcade',
 r:[[8,9,13,11],[8,24,11,11],[22,8,13,11],[9,36,13,7],[24,29,11,11],[40,29,13,11],[46,13,13,11],[40,6,11,7],[22,19,9,7]],
 names:['Lower-city steps','Nara\'s kitchen','Lantern market','Courtyard homes','Names memorial','Open-order stall','People\'s stage','Broadcast roof','Lamp maker\'s lane'],
 links:[[0,1],[0,2],[1,3],[3,4,[[24,36]]],[2,4],[1,8],[8,2],[4,5,[[29,29],[33,29]]],[5,6],[6,7]],
 motifs:['streetlamp sign','pot awning','awning lantern','window flowers','candle pillar','crate awning','banner candelabra','lamp fence','lantern barrel'],
 details:[[1,'The first bowl','The kitchen tally counts bowls served. Nara has crossed out the column for proof of residence.','A shelf holds bowls made in the new kiln. None have a maker\'s mark larger than the handle.','pot'],[4,'A name without a bill','A narrow brass strip records the workers who died keeping the district bright. Their families still receive light bills.','Small lamps stand under each name. They burn from the shared line, with no meter.','candle'],[6,'The missing district','The licensed lyric names eight rich wards. A penciled ninth verse has been hidden under the stage boards.','Children copy the ninth verse on paper lanterns. New verses have room beneath it.','banner']],
 secretLabel:'Lio\'s first lantern',secretText:'The lantern is crooked and carefully repaired. Lio\'s first customer brought it back each winter instead of buying another.',secretAfter:'The same lantern lights a shelf of free spare parts. Its repairs have become a pattern to teach.',secretProp:'lantern',afterBay:[26,20,4,3],afterName:'Repair shelf'
});
add('brassline',{
 size:[58,34],cut:35,gate:23,floor:'=',task:'ch06',done:'train_free',gateLabel:'Engine coupling lock',
 r:[[8,25,13,11],[8,10,11,9],[21,10,11,9],[30,10,7,9],[27,24,11,11],[43,23,11,9],[49,9,13,9],[48,29,13,7],[18,24,7,7]],
 names:['Station concourse','Luggage car','Passenger car','Brake deck','Signal platform','Engine bay','Driver\'s cab','Last platform','Porter\'s cupboard'],
 links:[[0,1],[1,2],[2,3],[3,4],[4,0],[0,8],[8,2],[4,5,[[33,23],[37,23]]],[5,6,[[43,9]]],[5,7]],
 motifs:['sign streetlamp','crate barrel','window lantern','hydrant fence','sign lamp','firedrum pillar','crystal window','fence lamp','crate pot'],
 details:[[2,'The return ticket','A ticket reads: Destination - continued service. Its reverse side has been folded into a tiny paper boat.','The timetable lists arrival, departure, and a final stop. A blank line leaves room for changed plans.','sign'],[3,'The emergency brake','A brass padlock holds the red brake handle. The safety notice says the lock prevents unauthorized safety.','The handle is uncovered. A second handle stands low enough for a child to reach.','hydrant'],[6,'Rook\'s little window','The driver\'s window faces the track. Rook has polished a patch at the side to watch passengers step down.','A small mirror now faces the platform. Rook has written: Check that everyone who wishes to leave has left.','window']],
 secretLabel:'Bex\'s lost property shelf',secretText:'One wool mitten waits beside a label: Keep until its owner is ready. The date is five winters old.',secretAfter:'The mitten is gone. In its place is a thank-you card and a new pair for any child who needs them.',secretProp:'crate',afterBay:[18,27,4,3],afterName:'Public waiting nook'
});
add('hushtheatre',{
 size:[54,44],cut:30,gate:11,task:'ch07',done:'truth_broadcast',gateLabel:'Broadcast shutter passage',flipX:true,
 r:[[9,35,13,11],[9,21,11,9],[23,34,9,11],[9,8,13,9],[23,11,11,13,'notch','S'],[39,11,11,11],[46,24,11,11],[40,37,13,9],[23,23,7,7]],
 names:['Theater foyer','Dressing rooms','Prompt desk','Public gallery','Main stage','Sound booth','Broadcast shutter','Open balcony','Costume store'],
 links:[[0,1],[0,2],[1,3],[3,4],[4,2],[1,8],[8,2],[4,5,[[28,11],[32,11]]],[5,6],[6,7]],
 motifs:['banner candelabra','window candle','crate candle','pillar banner','candelabra banner','crystal lamp','hydrant lantern','fence flowers','crate cobweb'],
 details:[[2,'Ada\'s cue card','The card has three large marks: Listen. Answer. Leave space. Each cue is written beside the safety check that must come first.','There are blank cue cards for visiting performers. Ada has kept the three instructions at the top.','sign'],[3,'The locked seats','A latch joins every row of seats to the next. The release key hangs backstage.','The latches are gone. Several seats face each other around small tables.','fence'],[7,'The open balcony','A street singer below repeats the first note from the stage. The thick glass prevents an answer from reaching the hall.','The glass is stacked safely by the wall. Street and stage can hear each other.','window']],
 secretLabel:'A costume with a repaired hem',secretText:'The star\'s coat has been let out, taken in, and let out again. Seven names are stitched inside the lining.',secretAfter:'An eighth name has been added. The coat now belongs to the theater, for any performer who can use it.',secretProp:'crate',afterBay:[26,21,3,5],afterName:'Borrowing rail'
});
add('civicvault',{
 size:[54,42],cut:30,gate:28,task:'ch08',done:'original_leases',gateLabel:'Original-records seal',
 r:[[8,9,11,11],[8,23,11,9],[23,8,11,11],[9,35,13,9],[23,28,11,11],[39,28,11,11],[45,14,11,11],[40,6,11,7],[22,18,9,7]],
 names:['Public counter','Receipt stacks','Return stacks','Original winter deeds','Copying press','Dispatch room','Mirror seal','Master ledger','Withdrawn records'],
 links:[[0,1],[0,2],[1,3],[3,4],[2,4],[1,8],[8,2],[4,5,[[28,28],[32,28]]],[5,6],[6,7]],
 motifs:['sign candle','crate pillar','crate candle','window candle','barrel lamp','crate sign','crystal pillar','candelabra statue','crate cobweb'],
 details:[[1,'A winter receipt','Heat was loaned for one winter. The return date has been covered by a second stamp reading: Permanent consideration.','The covered date is visible in the public copy. A clerk\'s note explains exactly where the false stamp was placed.','sign'],[3,'The original wax','The wax holds two fingerprints and a child\'s mitten thread. No court crest appears in it.','The deed lies in a sleeve that can be removed by its family. The sleeve, rather than the person, has an archive number.','candle'],[5,'The return basket','A basket is labeled undeliverable. Its shelves hold more letters than the entire outgoing desk.','The basket is empty at dusk. Each withdrawn record has a receipt that reveals no private text.','crate']],
 secretLabel:'Sen\'s unfiled note',secretText:'I copied the dates correctly until they told me not to. I kept this page so someone could know where to start.',secretAfter:'Sen\'s note is displayed with a reply: A record can admit a wrong. It must also help repair it.',secretProp:'candle',afterBay:[26,17,3,5],afterName:'Public correction desk'
});
add('academy',{
 size:[56,44],cut:31,gate:20,task:'ch09',done:'open_lesson',gateLabel:'West wing lesson door',flipX:true,
 r:[[8,22,13,11],[8,8,13,9],[22,8,11,9],[8,36,13,9],[24,21,11,13],[40,21,13,11],[46,7,13,9],[45,37,13,9],[23,35,9,7]],
 names:['Academy court','Singing classroom','Question court','Student desks','Closed west wing','Open library','Lesson board','Roof observatory','Unmarked practice room'],
 links:[[0,1],[1,2],[0,3],[3,4],[2,4],[0,4],[3,8],[4,5,[[29,20],[33,20]]],[5,6],[5,7]],
 motifs:['flowers pillar','window candle','statue flowers','crate candle','banner lantern','crate candelabra','sign lamp','crystal fence','pot candle'],
 details:[[1,'The ninth beat','A lesson requires eight steady beats. The examination sheet has no space to stop before the ninth.','Pip has drawn a rest after the fourth beat. Tutor Enna has marked it: A clear choice.','sign'],[5,'The missing page','A bound volume jumps from patterns to persons. The torn edge is clean, and much newer than the book.','The new page explains the difference between an echo that teaches and a person who can refuse.','crate'],[7,'The roof lesson','The telescope points toward the upper city. Its base has been bolted so it cannot turn toward the coast.','The bolts sit in a jar. The next lesson begins with whatever a student wishes to look at.','crystal']],
 secretLabel:'A song with no grade',secretText:'A child has written a tune on a scrap of wrapping paper. At its end: I like this part, even when I sing it wrong.',secretAfter:'Other students have added their own endings. No two use the same last note.',secretProp:'candle',afterBay:[24,37,4,3],afterName:'Free practice shelf'
});
add('witnessarchive',{
 size:[54,44],cut:30,gate:22,task:'ch10',done:'custody_key',gateLabel:'Witness index threshold',
 r:[[8,23,11,11],[8,8,11,9],[23,8,11,9],[9,37,13,9],[23,23,11,13],[39,22,11,11],[45,8,11,9],[44,37,13,9],[23,36,7,7]],
 names:['Listening vestibule','First witness cell','Second witness cell','Third witness cell','Living index','Unfinished survey','Keeper\'s chamber','Public record','Quiet chair'],
 links:[[0,1],[1,2],[0,3],[2,4],[3,4],[0,4],[3,8],[4,5,[[28,22],[32,22]]],[5,6],[6,7,[[50,8],[50,37]]]],
 motifs:['pillar candle','window lantern','window candle','window pot','crystal pillar','crate sign','statue candelabra','crate banner','pot candle'],
 details:[[1,'A witness pauses','The recording ends in a breath. The index marks that breath as damage, though the next page says the witness asked to stop.','The pause is preserved. A note explains that silence can be part of a complete statement.','lantern'],[4,'Three different inks','The same event has three dates and three honest accounts. The machine keeps trying to force them into one line.','Three lines remain. Readers can compare them without being told that one life must erase another.','sign'],[5,'Beyond the last margin','A coast survey stops where its patron\'s property ends. Pencil marks continue into the blank paper.','The pencil route is now the first path toward Dawn Sound. The next sheet is still blank and ready.','crate']],
 secretLabel:'The chair beside the record',secretText:'A comfortable chair faces an empty wall. A small card says: Nothing spoken here is copied.',secretAfter:'The chair has a new cushion. The card is unchanged.',secretProp:'pot',afterBay:[24,38,3,3],afterName:'Unrecorded conversation nook'
});
add('spireyard',{
 size:[56,44],cut:31,gate:11,task:'ch11',done:'evacuation_lifts',gateLabel:'Freight lift safety cage',
 r:[[8,35,11,11],[8,21,11,9],[22,35,11,9],[9,8,13,9],[24,11,11,11],[40,11,13,11],[46,26,13,11],[40,38,11,7],[22,23,9,7]],
 names:['Lower landing','Braced support','Freight lift','Broken scaffold','Rubble cut','Evacuation platform','Main winch','Signal roof','Tool cage'],
 links:[[0,1],[0,2],[1,3],[3,4],[2,4],[1,8],[8,2],[4,5,[[29,11],[33,11]]],[5,6],[6,7],[5,7,[[34,11],[34,38]]]],
 motifs:['sandbags lamp','pillar crate','hydrant fence','fence pillar','rock sandbags','banner fence','firedrum barrel','lamp sign','crate barrel'],
 details:[[1,'The brace calculation','Joss has crossed out the official load and written the number of people who must come down.','The brace carries both numbers: a safe load and the crew who checked it.','sign'],[3,'The missing rung','Three lengths of cloth mark where workers crossed a broken scaffold to help each other.','A new rung joins the cloth markers. The crew left the markers to show where the repair began.','fence'],[7,'Green evacuation lamps','The lamps face up toward the officers. From the lower landing, no one can see whether a lift is safe.','A second row faces the waiting workers. Each green light has a bell for people who cannot see it.','lamp']],
 secretLabel:'Joss\'s borrowed tools',secretText:'The tool cage has a tally of names, with no prices. The hammer slot is empty and marked: With the night crew.',secretAfter:'The hammer is back. The tally now includes a column for who can teach each tool\'s use.',secretProp:'crate',afterBay:[26,21,4,5],afterName:'Training bench'
});
add('highchoir',{
 size:[58,44],cut:32,gate:23,shell:'~',task:'ch12',done:'public_record',gateLabel:'Council inner gallery',
 r:[[8,23,13,11],[9,8,13,9],[24,8,11,9],[9,37,13,9],[25,23,11,13],[42,23,13,11],[49,8,13,9],[48,37,13,9],[24,36,9,7]],
 names:['Public arrival terrace','Witness gallery','Evidence table','Open exits','Council chamber','Weather table','Regent\'s dais','Coast balcony','Cook\'s stair'],
 links:[[0,1],[1,2],[0,3],[2,4],[3,4],[0,4],[3,8],[4,5,[[30,23],[34,23]]],[5,6],[5,7]],
 motifs:['pillar banner','window statue','crate candle','fence lamp','candelabra pillar','hydrant sign','statue banner','fence flowers','pot awning'],
 details:[[2,'The evidence table','The public table is lower than the council rail. Witnesses must lift each page so the council can see it.','The rail has been taken down. Pages can pass in both directions.','sign'],[5,'Weather by appointment','A polished chart shows clear weather over private estates. Its ink does not change when rain strikes the public windows.','Live measures sit beside the chart. Gardeners, sailors, and kiln workers each have a place at the table.','hydrant'],[7,'A city without its sound','Every lower district is visible. Thick window glass filters out the street noise that would make the view a place.','The windows are open. Yula has carried a second bread basket to the balcony.','window']],
 secretLabel:'Yula\'s serving stair',secretText:'A narrow stair reaches the council kitchen without passing the public gallery. Thousands of meals have climbed it unseen.',secretAfter:'The stair ends at a public tea room. Its little sign gives equal thanks to cooks, cleaners, and guests.',secretProp:'pot',afterBay:[25,38,4,3],afterName:'Public tea room'
});

add('crownbridge',{
 size:[58,38],cut:32,gate:19,shell:'~',task:'ch13',done:'regent_key',gateLabel:'Crown span barrier',
 r:[[8,19,13,11],[8,7,11,7],[23,7,13,7],[8,31,11,7],[25,20,11,11],[42,19,13,7],[50,7,11,7],[50,31,11,7],[23,31,9,7]],
 names:['Bridge refuge','Lower refuge','West locking tower','East locking tower','Safety winch','Open span','Regent\'s gate','Evacuation lookout','Mason\'s ledge'],
 links:[[0,1],[1,2],[0,3],[2,4],[3,4,[[25,31]]],[3,8],[8,2,[[28,31],[28,7]]],[4,5,[[30,19],[34,19]]],[5,6,[[42,7]]],[5,7,[[42,31]]],[6,7,[[54,7],[54,31]]]],
 motifs:['sandbags lamp','pot lantern','pillar hydrant','pillar fence','barrel firedrum','fence banner','statue pillar','lamp sign','rock crate'],
 details:[[1,'A space to wait','A refuge is marked for six people. Twelve sets of footprints lead here from the closed span.','The outer rail has been moved. There is space to wait without blocking anyone\'s return.','sign'],[4,'The winch release','The release faces the engine side. Closing the bridge leaves its own operator trapped across the gap.','A second release is within reach of the refuge. Both sides can open the crossing.','hydrant'],[7,'The lights below','Green lamps move through the lower streets like a second river. The bridge orders call them an acceptable loss.','The old order lies under a stone. A worker has drawn a line through the word acceptable.','lamp']],
 secretLabel:'A mason\'s handprint',secretText:'In the mortar beneath the great crest is a small handprint. The mason who set it signed only with the date.',secretAfter:'Names of the repair crew surround the handprint. The great crest has not been replaced.',secretProp:'rock',afterBay:[23,33,4,3],afterName:'Repair crew ledge'
});
add('heartengine',{
 size:[56,44],axis:'y',cut:25,gate:25,task:'ch14',done:'heart_open',gateLabel:'Reservoir isolation door',
 r:[[8,8,13,11],[24,8,13,9],[43,8,15,9],[8,20,11,7],[25,20,13,7],[25,34,13,11],[44,35,15,9],[8,35,11,9],[44,20,13,7]],
 names:['Service entrance','West voice feed','East voice feed','North voice feed','Remote-copy gallery','The held heart','Escape manifold','First reservoir','Engineer\'s station'],
 links:[[0,1],[1,2],[0,3],[3,4],[2,4,[[43,20]]],[3,1,[[17,20],[17,8]]],[2,8],[4,5,[[25,23],[25,27]]],[5,6],[5,7]],
 motifs:['pillar lamp','crystal hydrant','crystal firedrum','crystal pillar','window lamp','crystal candelabra','fence lamp','pillar brazier','crate candle'],
 details:[[2,'The second pulse','The gauge rises whenever the remote copy breathes. The drawing shows one city. The machine is carrying two.','The gauge rests at zero. Its scale has been kept so a future engineer can see what an overload meant.','hydrant'],[4,'Eight escape routes','Oren\'s service drawing has eight levers. The administrative copy replaced them with one authorized exit.','Eight blue arrows remain on the wall. None point through the former control desk.','sign'],[7,'The first reservoir','A ring of names circles the glass. Each name has a date when its owner meant to return.','The ring is empty. There is enough light to read the dates without taking anything from them.','crystal']],
 secretLabel:'Oren\'s first drawing',secretText:'The first plan includes a large stop handle. A later hand has crossed it out to make room for a second input.',secretAfter:'Someone has uncrossed the handle in green chalk. Beneath it: Keep this mistake where it can be learned from.',secretProp:'crate',afterBay:[48,18,4,3],afterName:'Failure record shelf'
});
add('cinderstrand',{
 size:[56,42],cut:31,gate:28,shell:'~',task:'q_airship',done:'airship',gateLabel:'Wren launch cradle',
 r:[[8,8,13,11,'oval'],[8,22,11,9],[23,8,11,9],[9,35,13,9,'oval'],[24,28,11,11],[40,28,13,11,'oval'],[47,14,13,11],[41,6,11,7],[22,18,9,7]],
 names:['Black-sand kitchen','Broken prow','Sail yard','Coil salvage','Open workshop','Safe launch shore','The Wren','Flight deck','Dema\'s shelter'],
 links:[[0,1],[0,2],[1,3],[3,4],[2,4],[1,8],[8,2],[4,5,[[29,28],[33,28]]],[5,6],[6,7],[7,5,[[35,6],[35,28]]]],
 motifs:['pot palm','crate fence','banner barrel','crystal rock','crate firedrum','fence lamp','pillar banner','hydrant lantern','awning pot'],
 details:[[1,'Three names on one prow','Parts from three wrecks have been fitted to one keel. No old crest faces forward.','The prow carries one small wren. The names of all three lost ships remain on the inner beam.','sign'],[4,'The stop handle','The new engine control has a stop handle larger than its start switch. Nim has drawn a hand beside it.','A traveler can reach the stop handle from either seat. No key is needed.','hydrant'],[7,'An unchosen course','The navigation board shows the old city lines. There is a whole clear edge where a new route could begin.','New routes cross the old border. A fresh piece of paper hangs beside the board.','sign']],
 secretLabel:'A kettle that survived',secretText:'Dema\'s dented kettle has a new handle made from voice-pipe copper. It is warm enough for another cup.',secretAfter:'There are more cups beside the kettle now. A note says to take a rest before choosing a direction.',secretProp:'pot',afterBay:[26,17,4,5],afterName:'Travelers\' tea step'
});
add('tideward',{
 size:[56,44],cut:31,gate:12,shell:'~',floor:'=',task:'q_brann',done:'tideward_safe',gateLabel:'Shelter roof crossing',flipY:true,
 r:[[8,35,13,11],[8,21,11,9],[9,8,13,9],[23,35,11,9],[24,12,11,11],[40,12,13,11],[46,28,13,11],[39,38,11,7],[22,24,9,7]],
 names:['Rope-marked landing','Braced stairs','School roof','Dry loft','Rescue skiff','Shared shelter','Family delivery room','Upper roof walk','Waterline cupboard'],
 links:[[0,1],[1,2],[0,3],[2,4],[3,4],[1,8],[8,3],[4,5,[[29,12],[33,12]]],[5,6],[6,7],[5,7,[[34,12],[34,38]]]],
 motifs:['fence lamp','pillar sandbags','awning pot','crate window','barrel fence','awning lantern','crate candle','fence flowers','barrel pot'],
 details:[[1,'Brann\'s brace','An old harbor gate plate is holding a stair roof above the water. The names once barred by the gate face the sky.','The plate is part of a proper shelter roof. Brann no longer has to hold it alone.','pillar'],[3,'The supper roll','Three cups are placed upside down for neighbors who have not returned. Their names are spoken before the meal begins.','Every cup is upright. A fourth waits for a guest with no need to explain their journey.','pot'],[6,'A family\'s copy','The envelope has been opened by the old court. A pressed flower is still caught in its torn seam.','The family has chosen what to keep. Their choice is recorded on the outside of an empty sleeve.','crate']],
 secretLabel:'The waterline marks',secretText:'A cupboard door records the high water in pencil. Children have added their own heights beside it.',secretAfter:'A bright new line marks the safe floor. The children\'s marks rise above it.',secretProp:'barrel',afterBay:[26,22,4,5],afterName:'Dry storage shelf'
});
add('shardroad',{
 size:[58,42],cut:32,gate:20,task:'q_sable',done:'deeds_returned',gateLabel:'Court-fragment bridge',
 r:[[8,20,13,11,'oval'],[8,7,11,9],[24,7,13,9],[8,34,11,9],[25,21,11,11],[42,20,13,9,'diamond'],[49,7,13,9],[48,34,13,9],[24,34,9,7]],
 names:['Covered deed cart','Travelers\' camp','Western debt seal','Eastern debt seal','False-deed desk','Glass ravine','Return table','Names memorial','Courier\'s recess'],
 links:[[0,1],[1,2],[0,3],[2,4],[3,4],[3,8],[8,2],[4,5,[[30,20],[34,20]]],[5,6],[5,7]],
 motifs:['awning crate','pot lantern','crystal pillar','crystal statue','crate candle','rock crystal','sign crate','candle flowers','crate vines'],
 details:[[2,'A debt with no first day','The seal has charged interest since before the oldest living debtor was born. The start date is a scratch in the glass.','The seal has been cut from its stand. Its false start date is visible to every traveler.','crystal'],[4,'Three generations','One page bears the same debt beside a mother, a daughter, and a child who cannot yet write her name.','The three names have been separated from the debt. Eris has left a clean page for the next family.','sign'],[7,'The unowned memorial','The court fragments still carry family crests. Small stones between them bear names with no claim attached.','The small stones outnumber the crests. No plot can be bought or inherited.','flowers']],
 secretLabel:'A courier\'s repaired wheel',secretText:'The deed cart\'s wheel has spokes cut from three kinds of wood. Eris has marked the safest piece with a blue ribbon.',secretAfter:'A workshop stamp gives the repair size in plain figures. Anyone can cut the next spoke.',secretProp:'crate',afterBay:[25,36,4,3],afterName:'Road repair nook'
});
add('drownedworks',{
 size:[56,44],axis:'y',cut:25,gate:40,shell:'~',task:'q_oren',done:'works_safe',gateLabel:'Lower workshop flood door',
 r:[[8,8,13,11],[24,8,13,9],[44,8,13,9],[9,20,13,7],[40,20,15,7],[40,34,15,11],[22,35,13,9],[8,35,11,9],[24,20,11,7]],
 names:['Dry inspection dock','Tide gauge','Sea intake','Isolation switch room','Idle turbine','Undertow chamber','Shared workbench','Return outlet','Forewoman\'s break room'],
 links:[[0,1],[1,2],[0,3],[3,4],[2,4],[1,8],[8,3],[4,5,[[40,23],[40,27]]],[5,6],[6,7]],
 motifs:['fence lamp','hydrant barrel','pillar firedrum','hydrant lamp','crystal pillar','rock vines','crate lantern','fence hydrant','pot awning'],
 details:[[1,'Power from the tide','The gauge measures what the sea gives each hour. The old schedule demands more at every low tide.','The work schedule follows the gauge. There is a planned rest when the water falls.','hydrant'],[3,'The large stop button','A red plate reaches from floor to waist height. Oren has worn a smooth patch while testing it with an elbow.','The plate has been copied on both sides of every powered door. No one must cross danger to stop it.','sign'],[6,'Edda\'s workbench','Oren\'s drawings lie beside repairs made without them. Edda has pinned a list of what the drawings missed.','A new plan includes the list and the crew\'s signatures. No one is asked to sign away the next correction.','crate']],
 secretLabel:'A shift that ends',secretText:'A little clock has been set beside a cold meal. Under it: This is a stop time, not a target to exceed.',secretAfter:'The meal is gone. Clean cups and a deck of worn cards fill the shelf.',secretProp:'pot',afterBay:[29,17,5,7],afterName:'Workers\' rest table'
});
add('windstage',{
 size:[54,44],cut:30,gate:29,task:'q_mira',done:'stage_open',gateLabel:'Echo booth curtain',flipX:true,
 r:[[8,9,13,11],[8,23,11,9],[23,8,11,11],[9,36,13,9],[23,29,11,11,'notch','S'],[39,29,11,11],[46,15,11,11,'rect','S'],[40,6,13,7],[22,19,9,7]],
 names:['Village roof square','Western speaker','Eastern speaker','Audience gallery','Living chorus','Open roof','Mira\'s old stage','Air balcony','Scenery store'],
 links:[[0,1],[0,2],[1,3],[3,4],[2,4],[1,8],[8,2],[4,5,[[28,29],[32,29]]],[5,6],[6,7]],
 motifs:['awning flowers','crystal banner','crystal pillar','fence candle','candelabra banner','flowers lantern','window crystal','fence pine','crate vines'],
 details:[[1,'A voice without a breath','Mira\'s recording joins the end of one perfect note to the start of the next. The speaker never makes room for a reply.','The old loop lies on an open shelf. A live microphone waits on a table at the same height as the audience.','crystal'],[3,'The audience door','Paint covers the words Remain Seated. Under the paint, the old door latch is still in place.','The latch is gone. The words have been replaced by: Come and go in your own time.','sign'],[5,'Clouds over sponsors','Children have painted clouds over the former patrons\' crests. One cloud has eight different hands.','Visitors have added weather from places beyond the coast. No name claims a cloud.','banner']],
 secretLabel:'Ada\'s paper thunder',secretText:'A sheet of bent copper can make a storm on stage. On its back, someone has scratched: Scary, but safe.',secretAfter:'Children use the sheet in their own play. Ada has rounded its sharp edge.',secretProp:'crate',afterBay:[26,17,3,5],afterName:'Community prop shelf'
});
add('bellpeak',{
 size:[54,46],cut:30,gate:12,shell:'~',task:'q_tern',done:'bell_school_open',gateLabel:'Storm stair bridge',
 r:[[8,37,11,11],[8,23,11,9],[9,8,13,11],[23,37,9,9],[23,12,11,11],[39,12,11,11],[45,27,11,11],[40,40,13,7],[22,25,9,7]],
 names:['Lower mountain path','Bell school','Low-bell terrace','High-bell terrace','Storm stair','Weather lookout','Storm roost','Open summit','Keeper\'s cave'],
 links:[[0,1],[1,2],[0,3],[2,4],[3,4],[1,8],[8,3],[4,5,[[28,12],[32,12]]],[5,6],[6,7],[5,7,[[34,12],[34,40]]]],
 motifs:['rock pine','sign candle','pillar lantern','pillar crystal','fence rock','sign lamp','vines crystal','fence lantern','pot pine'],
 details:[[1,'A lesson in silence','An old school rule calls silence obedience. Tern has written beside it: A breath can also be a choice.','The new lesson begins with a question. A pupil may answer with a word, a bell, or a rest.','sign'],[3,'Two ways to warn','The high bell sends sound into the valley. The flag pole beside it has no rope.','A bright flag moves with the warning bell. The coast can hear or see the same message.','banner'],[7,'The path beyond duty','The summit path continues beyond the school. Tern\'s footprints stop at the old boundary stone.','Fresh footprints pass the stone in both directions. Keeper Sol has left a flask for the longer walk.','rock']],
 secretLabel:'Keeper Sol\'s spare scarf',secretText:'A dry scarf hangs in the cave. The tag reads: For anyone who forgot that the summit is colder.',secretAfter:'There are two scarves now. The second is smaller, with an uneven but careful stitch.',secretProp:'pot',afterBay:[26,23,3,5],afterName:'Storm rest niche'
});
add('mercyisle',{
 size:[56,44],cut:31,gate:22,shell:'~',task:'q_vale',done:'clinic_safe',gateLabel:'Lighthouse shelter causeway',
 r:[[8,22,13,11,'oval'],[8,8,11,9],[23,8,11,9],[9,37,13,9],[24,23,11,11],[40,22,13,11],[47,8,13,9],[46,37,13,9,'oval'],[23,36,9,7]],
 names:['Clinic landing','Northern patient shelter','Garden patient shelter','Southern patient shelter','Medical stores','Lighthouse clinic','Open light','Recovery garden','Aven\'s wash room'],
 links:[[0,1],[1,2],[0,3],[2,4],[3,4],[0,4],[3,8],[4,5,[[29,22],[33,22]]],[5,6],[5,7]],
 motifs:['palm sign','awning pot','flowers window','awning barrel','crate lantern','window lamp','pillar crystal','flowers pine','pot barrel'],
 details:[[2,'A request beside the bed','The patient has asked for a view of the garden. The old intake form has no place for this kind of need.','The request is copied in the patient\'s own words. The bed now faces the open garden door.','flowers'],[5,'Vale\'s empty hook','A healer\'s coat hangs by the night desk. Its sleeves show years of repairs made after everyone else slept.','The coat is gone from the hook. Aven\'s shift board shows who will take the next watch.','sign'],[7,'A garden that asks nothing','Herbs grow beside a bench. No exercise plan or recovery target is posted there.','The bench has room for someone to sit beside a patient without turning the visit into another task.','flowers']],
 secretLabel:'The lighthouse cup shelf',secretText:'The cups have different handles and weights. Aven kept every shape after learning that comfort is not one size.',secretAfter:'New kiln cups have joined the old ones. A small card asks which kind should be made next.',secretProp:'pot',afterBay:[24,38,4,3],afterName:'Accessible wash shelf'
});
add('unwrittenhall',{
 size:[56,44],axis:'y',cut:25,gate:25,task:'q_rook',done:'machines_free',gateLabel:'Machine registry lock',flipX:true,
 r:[[8,8,13,11],[24,8,13,9],[44,8,13,9],[8,20,11,7],[25,20,13,7],[25,34,13,11],[44,35,15,9],[8,35,11,9],[43,20,13,7]],
 names:['Shared arrival hall','First work bay','Second work bay','Third work bay','Owner locks','Chosen work floor','Citizen registry','Open yard','Purl\'s sewing alcove'],
 links:[[0,1],[1,2],[0,3],[3,4],[2,4,[[44,20]]],[1,4],[2,8],[4,5,[[25,23],[25,27]]],[5,6],[5,7]],
 motifs:['sign pillar','crate hydrant','window banner','pot crate','crystal pillar','firedrum crate','statue candelabra','fence flowers','crate candle'],
 details:[[1,'The work that repeats','A machine paints the same sunrise. The order has no finish condition and no place for a different color.','Several paintings lean against the wall. Their mornings are different, and one is an evening.','banner'],[4,'An empty owner field','The registry accepts owned, abandoned, and destroyed. A fourth entry has been scratched between the ruled lines.','The fourth entry reads: Person. The field for work is a separate page that can be changed.','sign'],[5,'A shared order board','Old orders set production before asking what the coast needs. Spare handles sit beside houses with no stove doors.','The board begins with requests from kitchens, carts, and homes. A worker may choose an order or propose another.','crate']],
 secretLabel:'Purl\'s unfinished sleeve',secretText:'Purl has left a sleeve half sewn. A note says: I stopped because the evening was beautiful.',secretAfter:'The sleeve is finished. Beside it is a drawing of the evening, completed first.',secretProp:'crate',afterBay:[49,16,5,7],afterName:'Unscheduled art shelf'
});
add('rootwell',{
 size:[56,44],cut:31,gate:28,task:'branch_root',done:'root_seal',gateLabel:'Root Seal pressure door',
 r:[[8,8,13,11],[8,23,11,9],[24,8,11,11],[9,36,13,9],[24,28,11,11],[40,28,13,11],[47,14,13,11],[41,6,11,7],[23,19,9,7]],
 names:['Root team landing','World-line intake','Pressure cistern','Relief channel','Cross-team signal','Safe exit channel','Root Seal','Remote power core','Unused return duct'],
 links:[[0,1],[0,2],[1,3],[3,4],[2,4],[1,8],[8,2],[4,5,[[29,28],[33,28]]],[5,6],[6,7],[7,5,[[35,6],[35,28]]]],
 motifs:['pillar lamp','crystal hydrant','barrel firedrum','hydrant fence','crystal lantern','fence lamp','pillar brazier','crystal pillar','vines barrel'],
 details:[[1,'The world-line measure','The intake subtracts a little voice from every surviving district. No single district can see the full cost.','The gauge is divided by district, then disconnected. Its record remains public.','hydrant'],[4,'A signal from above','The root team\'s receiver has space for another team\'s voice. A single person cannot safely open all three seals.','The receiver keeps the final message in plain words: The path above is safe. You may stop.','lantern'],[6,'Power with an exit','The Root Seal is held behind a relief channel narrower than the feed. The imbalance is built into the stone.','The relief channel is open to its full width. No new feed can cover its marked line.','crystal']],
 secretLabel:'The unused return duct',secretText:'A duct was built for excess pressure and then filled with commemorative stone. A worker\'s chalk arrow still points through it.',secretAfter:'The stone is stacked beside the opening. The chalk arrow points along a working relief path.',secretProp:'barrel',afterBay:[27,17,3,5],afterName:'Relief inspection bay'
});
add('namevault',{
 size:[54,44],cut:30,gate:12,task:'branch_archive',done:'name_seal',gateLabel:'Name Seal witness door',flipY:true,
 r:[[8,36,11,11],[8,22,11,9],[23,36,9,9],[9,8,13,9],[23,12,11,11],[39,12,11,11],[46,27,11,11],[40,39,13,7],[22,25,9,7]],
 names:['Name team entrance','Witness circuit','Return circuit','Available-name index','Cross-team signal','Dispatch channel','Name Seal','Unowned public copy','Blank-paper store'],
 links:[[0,1],[0,2],[1,3],[3,4],[2,4],[1,8],[8,2],[4,5,[[28,12],[32,12]]],[5,6],[6,7],[7,5,[[34,39],[34,12]]]],
 motifs:['sign candle','window crystal','crate lantern','statue pillar','crystal lamp','crate banner','pillar candelabra','crate candle','pot cobweb'],
 details:[[3,'Available','The index reduces whole lives to a single word. A person who asks to leave is moved to an error column.','The index records what was taken and where a return can be requested. No page calls a person available.','sign'],[4,'The root team\'s answer','A copper receiver waits for the lower team to relieve pressure. Opening this door early would drive the stored names deeper.','The receiver\'s lamp is quiet. Its record names the team that made the return possible.','lantern'],[7,'A copy that can be refused','The machine treats every copied signature as fresh permission. Its pen has no space to lift.','The pen rests on its stand. Blank paper is available beside a clear withdrawal form.','crate']],
 secretLabel:'Paper without a purpose',secretText:'A store of blank sheets has no index number. Someone has drawn one small bird in a corner.',secretAfter:'The shelves hold letters, lessons, maps, and several more birds. Blank sheets remain at the front.',secretProp:'crate',afterBay:[26,23,3,5],afterName:'Public paper shelf'
});

add('skybelfry',{
 size:[58,44],axis:'y',cut:25,gate:43,shell:'~',task:'branch_sky',done:'bell_seal',gateLabel:'Belfry return bridge',
 r:[[8,8,13,11],[25,8,13,9],[46,8,13,9],[9,20,13,7],[43,20,15,7],[43,34,15,11],[24,35,13,9],[8,35,11,9],[25,20,11,7]],
 names:['Sky team mooring','West relay tower','East relay tower','Three-span bridge','Cross-team signal','World beacon','Bell Seal','Belfry crown','Bell maker\'s shelf'],
 links:[[0,1],[1,2],[0,3],[3,4],[2,4],[1,8],[8,3],[4,5,[[43,23],[43,27]]],[5,6],[6,7]],
 motifs:['fence lamp','pillar crystal','pillar lantern','fence banner','crystal lamp','brazier pillar','candelabra crystal','fence lantern','crate candle'],
 details:[[1,'A one-way bell','The west tower can send a command to every coast. Its answering wire has been wound around a silent clapper.','The answering wire is free. A voice from below can stop a command from above.','lantern'],[4,'The name team\'s signal','The receiver waits for the middle team. Until its return channel is open, the bell would speak over the names below.','The middle team\'s lamp remains steady. Every name below has a way out.','crystal'],[7,'The last conductor\'s stand','The stand has room for one pair of hands. The score demands every other voice follow without breath.','The old score is folded. Three open stands face one another across the crown.','sign']],
 secretLabel:'An imperfect clapper',secretText:'A bell maker rejected this clapper for a small crack. When tapped, it gives two notes instead of one.',secretAfter:'The double note has become the signal for an unanswered call. The crack is carefully supported.',secretProp:'crate',afterBay:[29,16,5,8],afterName:'Bell repair shelf'
});
add('stillstar',{
 size:[58,46],cut:32,gate:24,shell:'~',task:'finale',done:'victory',gateLabel:'Still Star memory threshold',
 r:[[8,24,13,11,'diamond'],[8,8,13,11,'diamond'],[25,8,11,11,'diamond'],[9,39,13,9,'diamond'],[25,24,11,13,'diamond'],[43,24,15,13,'oval'],[50,8,11,9,'diamond'],[49,39,13,9,'diamond'],[25,39,9,7,'diamond']],
 names:['Copied city edge','Root memory','Name memory','Bell memory','Unchanging morning','Return horizon','Still Star core','Second dawn','An unfixed window'],
 links:[[0,1],[1,2],[0,3],[2,4],[3,4],[0,4],[3,8],[4,5,[[30,24],[34,24]]],[5,6],[5,7],[6,7,[[55,8],[55,39]]]],
 motifs:['crystal pillar','crystal rock','window candle','lantern pillar','window crystal','flowers crystal','pillar brazier','flowers lantern','window candle'],
 details:[[1,'A stopped cup','Steam rests above a copied cup. It never cools. No one can lift the cup to drink.','The steam has thinned. The cup can cool, and a hand can hold it.','pot'],[4,'The same morning','Every window repeats one bright instant. A person inside each window is about to speak, and never can.','The windows show different weather. One is dark, because its room is resting.','window'],[7,'Room after the song','The horizon has no boundary mark. There is no diagram for what the next morning must contain.','The horizon still has no boundary mark. Something small has begun to grow beside the path.','flowers']],
 secretLabel:'A window that changed',secretText:'One pane does not quite match the others. Its light falls a little farther each time you look away.',secretAfter:'The pane shows an ordinary cloud. It passes beyond the frame without leaving a copy.',secretProp:'window',afterBay:[26,41,4,3],afterName:'Unwritten horizon step'
});

// The Roads Between. Each optional arc has an authored working place:
// waterworks, ferry routes, post rooms, weather stations, kiln, and new coast.
add('saltmill',{
 size:[56,42],axis:'y',cut:24,gate:24,task:'m_river_1',done:'mill_measure_open',gateLabel:'Mill wheel safety door',
 r:[[8,8,13,11],[24,8,13,9],[44,8,13,9],[8,19,11,7],[24,19,13,7],[24,33,13,11],[44,33,15,11],[8,34,11,9],[44,19,11,7]],
 names:['Mill loading yard','Official measure','Grain bin','Mill infirmary','Idle wheel','Account office','Spillway','Shared flour store','Millwright\'s cubby'],
 links:[[0,1],[1,2],[0,3],[3,4],[2,4,[[44,19]]],[1,4],[2,8],[4,5,[[24,22],[24,26]]],[5,6],[5,7],[6,7,[[50,38],[8,38]]]],
 motifs:['crate barrel','sign hydrant','barrel crate','pot candle','firedrum pillar','crate candle','fence hydrant','barrel awning','crate cobweb'],
 details:[[1,'Two different measures','The official scale gains weight after the grain is removed. A smaller kitchen scale beside it returns cleanly to zero.','Both scales return to zero. Mill crews check them together before the first sack is opened.','sign'],[3,'A flour-white coat','A worker\'s coat hangs above the infirmary bed. Its pockets hold dust where a wage slip should be.','The clean coat is folded for collection. A wage slip gives the worker\'s own name and shift.','pot'],[6,'Water paid for twice','The spillway pours the river back into the channel. The account lists it as water newly supplied by the mill.','The return channel has its own measure. Water returned is shown as returned.','hydrant']],
 secretLabel:'A millwright\'s fair weight',secretText:'An iron weight is wrapped in cloth. The note reads: Keep one measure that the office cannot adjust.',secretAfter:'The weight sits in an unlocked box. Neighbors can use it to check their own scales.',secretProp:'crate',afterBay:[47,19,4,3],afterName:'Public scale-check shelf'
});
add('reedlock',{
 size:[58,44],axis:'y',cut:25,gate:43,shell:'~',task:'m_river_2',done:'river_plan_signed',gateLabel:'Shared lock chamber',
 r:[[8,8,13,11,'oval'],[25,8,13,9],[46,8,13,9],[9,20,13,7,'oval'],[43,20,15,7,'oval'],[43,34,15,11],[24,35,13,9],[8,35,11,9,'oval'],[25,20,11,7,'oval']],
 names:['River meeting bank','Upstream gauge','Upper garden channel','Lower mill channel','Reed nursery','Lock chamber','Shared river gate','Lower bank','Seedling inlet'],
 links:[[0,1],[1,2],[0,3],[3,4],[2,4],[1,8],[8,3],[4,5,[[43,23],[43,27]]],[5,6],[6,7],[7,5,[[8,40],[51,40],[51,34]]]],
 motifs:['grass pot','hydrant rock','fence flowers','barrel grass','flowers pot','pillar hydrant','fence lantern','tree bush','pot grass'],
 details:[[1,'The river before the gate','The gauge records enough water for both banks across a day. The old schedule measures only the richest hour.','A shared slate records each day\'s river. The plan can change when the water does.','hydrant'],[4,'Roots below the notice','Young reeds grow beneath a notice calling the lower bank unused. Their roots keep the bank from washing away.','The notice has been replaced by a board naming the people and living ground the lock must serve.','flowers'],[7,'Two banks, one table','An old boundary stone sits between two cooking fires. Both meals use water from the same reach.','A table spans the place where the stone stood. The two kitchens bring food in their own pots.','pot']],
 secretLabel:'Lea\'s reserve jar',secretText:'The water jar has a low mark scratched inside. Lea stops pouring before the roots would be left dry.',secretAfter:'The same low mark is copied on the public gauge. It is checked by both banks.',secretProp:'pot',afterBay:[29,16,5,8],afterName:'Shared seedling shelf'
});
add('copperfen',{
 size:[58,46],cut:32,gate:13,shell:'~',task:'m_road_2',done:'fen_crossing_safe',gateLabel:'Ferry causeway crossing',flipY:true,
 r:[[8,38,13,11,'oval'],[8,23,11,11,'oval'],[9,8,13,11,'oval'],[24,38,13,9,'oval'],[25,13,11,13,'oval'],[43,13,13,11,'oval'],[50,29,11,11],[42,40,13,7,'oval'],[23,26,9,7,'oval']],
 names:['Raised fen camp','Whistle beacon','Old causeway','Reed shelter','Sinking cart','Dry travelers\' shelter','Community ferry','Far-bank island','Hidden reed nest'],
 links:[[0,1,[[5,30]]],[1,2],[0,3],[2,4],[3,4,[[28,38],[28,13]]],[1,8],[8,3],[4,5,[[30,13],[34,13]]],[5,6],[6,7]],
 motifs:['pine pot','sign lantern','fence rock','bush grass','crate vines','awning flowers','barrel fence','tree flowers','mushroom grass'],
 details:[[1,'Three whistles','A reed whistle hangs from each of three posts. Their lengths make distinct calls even in thick fog.','The posts carry matching raised marks. Travelers can identify each crossing by sound or touch.','sign'],[2,'The missing ferry road','The causeway survives beneath the reeds. Its stones were removed from the official map after the ferry stopped paying for a seal.','New white stones mark the path. The route board lists the ferry by where it goes.','fence'],[6,'A ferry for a changed journey','The ferry rope reaches both banks. The old ticket stand permits only a single direction.','A return loop is tied beside the main rope. A traveler can change their mind after crossing.','barrel']],
 secretLabel:'A quiet nest in the reeds',secretText:'A water bird has woven old route paper into its nest. The official blank patch is keeping three eggs warm.',secretAfter:'The nest is empty. Tiny tracks lead into the reeds on the bank the map once omitted.',secretProp:'bush',afterBay:[27,24,4,5],afterName:'Wildlife viewing step'
});
add('pilgrimpost',{
 size:[54,42],cut:30,gate:21,task:'m_road_3',done:'road_shelter_open',gateLabel:'Shelter registration door',flipX:true,
 r:[[8,21,13,11],[8,7,11,9],[23,7,11,9],[8,35,11,9],[23,22,11,11],[39,21,11,11],[46,7,11,9],[45,35,13,9],[23,35,9,7]],
 names:['Road arrival yard','Registration desk','First bunk room','Second bunk room','Travelers\' kitchen','Shelter ledger','Open door','Common courtyard','Night porter\'s nook'],
 links:[[0,1],[1,2],[0,3],[2,4],[3,4],[0,4],[3,8],[4,5,[[28,21],[32,21]]],[5,6],[5,7],[6,7,[[50,7],[50,35]]]],
 motifs:['sign streetlamp','crate candle','window pot','window lantern','pot awning','crate sign','pillar lamp','flowers fence','pot candle'],
 details:[[1,'Proof of a place to sleep','The form demands an address before it will assign a bed. Half the waiting travelers have lost their homes.','The form asks whether a traveler needs a quiet bunk, help with stairs, or room for a companion.','sign'],[2,'The unclaimed bed','A made bed remains empty because its daily allowance has no matching seal. Someone sleeps under the window outside.','The bed has been used. A clean sheet waits folded for the next arrival.','window'],[7,'A road with pauses','An official route board gives only departure times. A chalk note lists shade, clean water, and a bench for each mile.','The chalk notes have been copied into the route board. Rest is part of the journey.','sign']],
 secretLabel:'The night porter\'s key',secretText:'A worn key opens the side door. The porter\'s note says: If the desk is closed, wake me. Do not leave someone outside.',secretAfter:'The side door has a bell and a lamp. The key remains in case the new latch fails.',secretProp:'pot',afterBay:[24,37,4,3],afterName:'Late-arrival wash room'
});
add('emberpost',{
 size:[56,44],cut:31,gate:12,shell:'~',floor:'=',task:'m_letters_1',done:'post_bag_saved',gateLabel:'Return-post sorting shutter',
 r:[[8,36,13,11],[8,22,11,9],[23,36,11,9],[9,8,13,9],[24,12,11,11],[40,12,13,11],[47,28,13,11],[40,39,11,7],[22,25,9,7]],
 names:['Post landing','Sorting tables','Returns shelf','Parcel store','Route stamps','Public counter','Dispatch pier','Messenger roof','Undelivered corner'],
 links:[[0,1],[0,2],[1,3],[3,4],[2,4],[1,8],[8,2],[4,5,[[29,12],[33,12]]],[5,6],[6,7],[7,5,[[34,39],[34,12]]]],
 motifs:['sign lamp','crate candle','crate lantern','barrel crate','sign candle','awning pot','fence barrel','lamp fence','crate cobweb'],
 details:[[2,'The bag that came back','The same post bag has returned six times. Every old address is crossed out, but no letter has been opened.','The bag carries six new routes. Its repairs are tagged with the names of the people who helped it onward.','crate'],[4,'A seal after the city fell','The stamp demands a city seal that no office can now issue. The desk keeps applying it anyway.','The stamp reads: Received here. A second line names the person who accepted the bag.','sign'],[6,'The next boat','The dispatch slate leaves a space for weather and a space for the runner\'s return. Neither was in the old schedule.','Every dispatched bag has an answer route. A message need not travel the same way twice.','lantern']],
 secretLabel:'An unposted thank-you',secretText:'A letter thanks a nurse at an address that no longer exists. On the outside: Please do not throw this away.',secretAfter:'A new address is written in a different hand. A small note says the nurse is waiting for it.',secretProp:'crate',afterBay:[26,23,4,5],afterName:'Address tracing nook'
});
add('inkhaven',{
 size:[58,44],axis:'y',cut:25,gate:25,task:'m_letters_2',done:'addresses_open',gateLabel:'Address-press archive door',
 r:[[8,8,13,11],[25,8,13,9],[46,8,13,9],[8,20,11,7],[25,20,13,7],[25,34,13,11],[45,35,15,9],[8,35,11,9],[45,20,13,7]],
 names:['Address registry','Old register','Vanished street','New street steps','Address press','Rebuilt crossing','Public map store','Open terrace','Temporary-address shelf'],
 links:[[0,1],[1,2],[0,3],[3,4],[2,4,[[46,20]]],[1,4],[2,8],[4,5,[[25,23],[25,27]]],[5,6],[5,7],[6,7,[[51,40],[8,40]]]],
 motifs:['sign pillar','crate candle','window vines','flowers fence','barrel lamp','pillar fence','crate lantern','awning flowers','crate pot'],
 details:[[1,'An address is a place to find someone','The register treats a moved household as a missing household. It has no field for a roof built after the fall.','The new register records how to find someone now, and who may share that route.','sign'],[3,'A street that was not planned','Stairs, ropes, and a painted blue wall guide visitors better than the old numbered stones.','A route sketch preserves the blue wall and the rope turn. Official numbers are added only where they help.','fence'],[6,'The correction shelf','Old editions are locked away as if a map could never admit that a coast moved.','Readers can compare editions and mark a correction without surrendering their own copy.','crate']],
 secretLabel:'A temporary address',secretText:'Care of the house with three yellow cups. Ask for Sill. A date is added, so a future reader knows when the note was true.',secretAfter:'The note has a forwarding route. The three yellow cups still mark a welcome at the old door.',secretProp:'pot',afterBay:[49,19,4,3],afterName:'Forwarding-address desk'
});
add('rainspindle',{
 size:[54,46],cut:30,gate:16,shell:'~',task:'m_sky_1',done:'live_weather_open',gateLabel:'Live weather instrument stair',flipX:true,
 r:[[8,38,11,11],[8,24,11,9],[9,8,13,9],[23,38,9,9],[23,16,11,13],[39,16,11,13],[45,32,11,11],[41,6,13,7],[22,28,9,7]],
 names:['Mountain weather camp','Barometer room','Wind-vane ledge','Rain gauge','Official report desk','Coast beacon','Observation tower','Open instrument roof','Observer\'s niche'],
 links:[[0,1],[1,2],[0,3],[2,4],[3,4],[1,8],[8,3],[4,5,[[28,16],[32,16]]],[5,6],[5,7],[6,7,[[50,32],[50,6]]]],
 motifs:['pine pot','hydrant candle','fence banner','barrel rock','sign lantern','pillar lamp','crystal fence','hydrant lantern','pot candle'],
 details:[[1,'Yesterday\'s pressure','A sealed drum feeds the same reading to the official desk each morning. The live needle moves freely behind it.','The live needle feeds the desk. The drum is kept as evidence of the false report.','hydrant'],[2,'A vane that cannot turn','A wire ties the wind vane toward fair weather. Its mounting has bent against last night\'s storm.','The vane turns without resistance. A bright ribbon makes its motion visible from the lower path.','banner'],[7,'The observer\'s sky','The instrument roof has a wide horizon. The report form permits only three approved kinds of weather.','Blank space follows the measured readings. The observer can describe a sky the old form never expected.','sign']],
 secretLabel:'The observer\'s honest notebook',secretText:'Small pencil entries disagree with every official report. Each entry includes the hour and what the observer could actually see.',secretAfter:'The notebook rests beside the public readings. Its careful limits are taught to new observers.',secretProp:'crate',afterBay:[26,26,3,5],afterName:'Public observation desk'
});
add('cloudharrow',{
 size:[58,44],cut:32,gate:22,shell:'~',floor:'=',task:'m_sky_3',done:'rain_released',gateLabel:'Reservoir return gantry',
 r:[[8,22,13,11],[8,8,11,9],[24,8,13,9],[9,37,13,9],[25,23,11,11],[43,22,15,11],[50,8,11,9],[49,37,13,9],[24,36,9,7]],
 names:['Airship service dock','Cloud collector','West release valve','East release valve','Private nursery','Release platform','Held-rain reservoir','Rain return walk','Gardener\'s potting shelf'],
 links:[[0,1],[1,2],[0,3],[2,4],[3,4],[0,4],[3,8],[4,5,[[30,22],[34,22]]],[5,6],[5,7]],
 motifs:['fence lamp','crystal pillar','hydrant barrel','hydrant fence','flowers pot','pillar banner','crystal brazier','fence lantern','pot flowers'],
 details:[[1,'Rain before it falls','The collector catches water meant for a wide coast. Its accounts call the captured water newly created supply.','The collector measures what it diverts and what it returns. The coast can read both numbers.','crystal'],[4,'Green behind glass','The private nursery grows in warm mist while gardens below mark another dry week. Its plants did not choose this bargain.','The nursery feeds cuttings to the coast. Its doors open when the shared weather plan calls for rest.','flowers'],[7,'A return to the clouds','The return walk ends in a capped pipe. The drawing labels it waste, though it points toward fields below.','A fine rain passes beyond the rail. The cap has become a bowl for seedlings.','hydrant']],
 secretLabel:'A gardener\'s pressed leaf',secretText:'A gardener has pressed a leaf from a dry coast tree beside the perfect nursery specimens. Its brown edge is carefully preserved.',secretAfter:'The same tree has sent a green leaf. Both leaves remain in the book.',secretProp:'pot',afterBay:[25,38,4,3],afterName:'Coast seedling shelf'
});
add('morrowkiln',{
 size:[58,44],axis:'y',cut:25,gate:44,task:'m_table_1',done:'kiln_crew_safe',gateLabel:'Furnace safety cage',
 r:[[8,8,13,11],[25,8,13,9],[46,8,13,9],[9,20,13,7],[44,20,15,7],[44,34,15,11],[24,35,13,9],[8,35,11,9],[25,20,11,7]],
 names:['Kiln arrival yard','First furnace','Cooling bed','Worker shelter','Clay preparation','Shared kiln','Dispatch floor','Roof-tile yard','Glaze test alcove'],
 links:[[0,1],[1,2],[0,3],[3,4],[2,4],[1,8],[8,3],[4,5,[[44,23],[44,27]]],[5,6],[6,7]],
 motifs:['crate lamp','brazier pillar','barrel hydrant','awning pot','pot crate','firedrum brazier','crate sign','crate fence','pot candle'],
 details:[[1,'One furnace at a time','The restart order lights every furnace before any cooling channel is checked. Someone has underlined: Minimum delay.','The new order begins with a cold inspection and one test firing. The crew\'s stop mark is larger than the deadline.','brazier'],[6,'The first open order','A stack of ceremonial tiles waits beside a request for stove doors. The old office preferred the order with the finer seal.','The dispatch board shows homes, carts, and kitchens. Orders can be changed when people explain what they need.','sign'],[7,'A roof worth carrying','The roof tiles have a raised grip so tired hands can carry them safely. A small groove lets winter rain run clear.','A tile from Dawn Sound has returned with a note: Dry through the first storm. Thank you.','crate']],
 secretLabel:'The glaze test cups',secretText:'A row of imperfect cups records each firing. The safest glaze is the plainest one.',secretAfter:'The plain glaze is written on a public recipe card. Beautiful colors can wait until they are safe to use.',secretProp:'pot',afterBay:[29,16,5,8],afterName:'Public kiln-recipe shelf'
});
add('dawnsound',{
 size:[58,46],cut:32,gate:14,shell:'~',task:'m_morning_2',done:'dawn_shore_safe',gateLabel:'Winter-water hall crossing',flipY:true,
 r:[[8,38,13,11,'oval'],[8,23,11,11,'oval'],[9,8,13,11,'oval'],[24,38,13,9],[25,14,11,13],[43,14,13,11],[50,30,11,11],[42,40,13,7],[23,27,9,7,'oval']],
 names:['Unmapped coast landing','Coast survey','Winter tide mark','Safe landing shore','Foundation posts','New common hall','Shared hearth','Open pier','Windbreak hollow'],
 links:[[0,1],[1,2],[0,3],[2,4],[3,4],[1,8],[8,3],[4,5,[[30,14],[34,14]]],[5,6],[6,7]],
 motifs:['palm pot','sign rock','fence rock','barrel lamp','pillar crate','awning flowers','brazier pot','fence lantern','bush flowers'],
 details:[[1,'The end of the old map','The survey grid stops at a shore where people have already left cooking stones. Empty paper did not mean an empty place.','The new map records the stones and the people who explained them. Space remains for what the next visitor learns.','sign'],[2,'Above winter water','Three high-water marks climb the stone. The calm summer tide reaches none of them.','The hall floor stands above the highest mark. The marks stay visible for the next builders.','rock'],[5,'A door left open','The doorway has been measured before the rooms. There must be enough space to enter with a cart, a crutch, or a sleeping child.','The doorway is complete. A traveler can enter without a seal, an order, or a story to repay the welcome.','awning']],
 secretLabel:'A hollow out of the wind',secretText:'A low bank turns the sea wind aside. Someone has left dry grass here long before the survey arrived.',secretAfter:'A small bench fits within the same bank. No wall shuts out the view of the water.',secretProp:'bush',afterBay:[25,29,3,3],afterName:'Travelers\' rest hollow'
});

const point=(x,y)=>({x:x*16+8,y:y*16+8,z:0});
const walk=c=>c!==undefined&&!['#','H','b','~','G'].includes(c);
// Authored collision fixtures: shelves, seats, cisterns, thickets, and support
// blocks. They sit beside circulation lines, never on a stage anchor. Tuple:
// [room,dx,dy,width,height,tile]. Unlike decoration, these alter navigation.
const FITTINGS={
 lowquay:[[1,-4,-3,2,2,'H'],[1,3,-3,2,2,'H'],[2,-5,-3,3,1,'b'],[3,-3,-3,2,2,'~'],[4,3,2,2,2,'H'],[7,-5,-3,3,2,'H']],
 glassmine:[[1,-4,-3,2,2,'#'],[2,-4,2,2,2,'~'],[3,4,-3,2,2,'H'],[5,-4,-3,2,2,'~'],[5,3,2,2,2,'#'],[6,3,-3,2,2,'#']],
 wirewood:[[1,-4,-3,2,2,'#'],[2,3,-3,2,2,'#'],[3,-4,-3,2,2,'~'],[4,2,3,2,2,'~'],[6,-4,2,2,2,'#']],
 westrelay:[[1,-5,-3,3,1,'b'],[1,3,-3,3,1,'b'],[2,-3,-3,2,2,'H'],[3,-5,2,3,1,'H'],[5,3,-3,2,2,'H'],[7,-5,-3,3,1,'b'],[7,3,-3,3,1,'b']],
 lanternward:[[1,-4,-3,2,2,'b'],[2,-5,-3,3,2,'H'],[2,3,-3,3,2,'H'],[3,-5,-2,3,1,'b'],[5,3,2,3,2,'b'],[6,-5,-3,3,1,'b']],
 brassline:[[1,-3,-2,2,1,'b'],[1,2,-2,2,1,'b'],[2,-3,-2,2,1,'b'],[2,2,-2,2,1,'b'],[2,-3,2,2,1,'b'],[2,2,2,2,1,'b'],[5,-3,-2,2,2,'H'],[6,3,-2,2,1,'b']],
 hushtheatre:[[1,-4,-3,2,2,'H'],[3,-5,-3,3,1,'b'],[3,3,-3,3,1,'b'],[3,-5,2,3,1,'b'],[3,3,2,3,1,'b'],[5,-4,-3,2,2,'H'],[6,3,2,2,2,'H']],
 civicvault:[[1,-4,-3,2,2,'H'],[1,3,2,2,2,'H'],[2,-4,2,2,2,'H'],[3,-5,-3,3,2,'H'],[3,3,2,3,2,'H'],[5,-4,-3,2,2,'H'],[7,3,-2,2,1,'H']],
 academy:[[1,-5,-3,3,1,'b'],[1,3,-3,3,1,'b'],[3,-5,-3,3,1,'b'],[3,3,-3,3,1,'b'],[5,-5,-3,2,2,'H'],[5,4,2,2,2,'H'],[7,3,-3,2,2,'b']],
 witnessarchive:[[1,-4,-3,2,2,'H'],[2,3,-3,2,2,'H'],[3,-5,2,2,2,'H'],[4,-4,-4,2,3,'H'],[4,3,2,2,3,'H'],[5,3,-3,2,2,'H'],[7,-5,-3,3,2,'H']],
 spireyard:[[1,-4,-3,2,2,'#'],[2,3,-3,2,2,'b'],[3,-5,2,3,1,'b'],[4,3,2,2,2,'#'],[5,-5,-3,2,2,'b'],[6,4,2,2,2,'#']],
 highchoir:[[1,-5,-3,3,1,'b'],[2,-4,-3,2,2,'b'],[4,-4,-4,2,2,'b'],[4,3,3,2,2,'b'],[5,-5,-3,3,1,'b'],[6,3,-3,3,2,'H'],[7,-5,-3,3,1,'b']],
 crownbridge:[[1,-4,-2,2,1,'b'],[2,-5,-2,2,1,'H'],[3,3,2,2,1,'H'],[4,-4,2,2,2,'#'],[6,3,-2,2,1,'H'],[7,3,2,2,1,'b']],
 heartengine:[[1,-5,-3,2,2,'~'],[2,4,-3,2,2,'~'],[3,-4,-2,2,1,'H'],[4,3,-2,2,1,'H'],[5,-5,-3,3,2,'~'],[5,3,2,3,2,'~'],[6,4,2,2,2,'b']],
 cinderstrand:[[1,-4,-3,2,2,'b'],[2,3,2,2,2,'b'],[3,-5,-3,2,2,'#'],[4,3,-3,2,2,'b'],[6,-5,-3,3,1,'b'],[6,3,2,3,1,'b']],
 tideward:[[1,-4,2,2,2,'H'],[2,-5,-3,3,1,'b'],[3,3,-3,2,2,'H'],[4,-4,2,2,2,'b'],[5,-5,-3,3,2,'H'],[6,3,2,3,2,'H']],
 shardroad:[[1,-4,-3,2,2,'#'],[2,4,-3,2,2,'H'],[3,-4,2,2,2,'H'],[4,3,2,2,2,'b'],[5,3,-2,2,2,'#'],[7,-5,-3,2,2,'#']],
 drownedworks:[[1,-5,-3,3,2,'~'],[2,3,-3,3,2,'~'],[3,-5,-2,2,1,'H'],[4,4,-2,2,1,'H'],[5,-6,-3,3,2,'~'],[5,4,2,2,2,'~'],[6,3,-3,2,2,'b']],
 windstage:[[1,-4,-3,2,2,'H'],[2,3,-3,2,2,'H'],[3,-5,-3,3,1,'b'],[3,3,-3,3,1,'b'],[5,3,2,2,2,'b'],[6,-4,-3,2,2,'H']],
 bellpeak:[[1,-4,-3,2,2,'H'],[2,-5,3,2,2,'#'],[3,2,-3,2,2,'#'],[4,3,2,2,2,'#'],[5,-4,-3,2,2,'#'],[6,3,2,2,2,'#']],
 mercyisle:[[1,-4,-3,2,1,'b'],[2,3,2,2,1,'b'],[3,-5,-3,3,1,'b'],[4,3,2,2,2,'H'],[5,-5,-3,3,1,'b'],[5,3,-3,3,1,'b'],[6,3,-3,2,2,'#']],
 unwrittenhall:[[1,-5,-3,3,2,'b'],[2,3,2,3,2,'b'],[3,-4,-2,2,1,'b'],[4,3,-2,2,1,'H'],[5,-5,-3,3,2,'b'],[6,4,-3,2,2,'H']],
 rootwell:[[1,-4,-3,2,2,'~'],[2,3,2,2,2,'~'],[3,-5,2,3,1,'b'],[4,3,-3,2,2,'H'],[5,-5,-3,2,2,'~'],[6,4,2,2,2,'#']],
 namevault:[[1,-4,-3,2,2,'H'],[2,2,-3,2,2,'H'],[3,-5,-3,3,2,'H'],[4,3,2,2,2,'H'],[5,-4,-3,2,2,'H'],[7,3,-2,2,1,'H']],
 skybelfry:[[1,-5,-3,2,2,'#'],[2,3,-3,3,2,'#'],[3,-5,-2,2,1,'b'],[4,4,-2,2,1,'b'],[5,-6,-3,2,2,'#'],[6,3,2,2,2,'b']],
 stillstar:[[1,-4,-3,2,2,'#'],[2,3,-2,1,2,'H'],[3,-4,2,2,1,'b'],[4,3,3,1,2,'H'],[5,-5,-3,2,2,'~'],[6,3,-2,1,2,'#']],
 saltmill:[[1,-5,-3,3,2,'b'],[2,3,-3,3,2,'H'],[3,-4,-2,2,1,'b'],[4,3,-2,2,1,'#'],[5,-5,-3,3,2,'H'],[6,4,2,2,2,'~']],
 reedlock:[[1,-5,-3,2,2,'~'],[2,3,-3,3,2,'~'],[3,-5,-2,2,1,'#'],[4,4,-2,2,1,'#'],[5,-6,-3,3,2,'~'],[6,3,2,2,2,'b']],
 copperfen:[[1,-4,-3,2,2,'#'],[2,3,-3,2,2,'#'],[3,-5,2,2,1,'~'],[4,3,3,2,2,'~'],[5,-4,-3,2,2,'#'],[6,3,2,2,2,'b']],
 pilgrimpost:[[1,-4,-3,2,2,'b'],[2,-4,-3,3,1,'b'],[2,2,2,3,1,'b'],[3,-4,2,3,1,'b'],[4,3,-3,2,2,'b'],[5,-4,-3,2,2,'H']],
 emberpost:[[1,-4,-3,2,2,'b'],[2,3,-3,2,2,'H'],[3,-5,2,3,2,'H'],[4,3,2,2,2,'b'],[5,-5,-3,3,2,'b'],[6,4,2,2,2,'b']],
 inkhaven:[[1,-5,-3,3,2,'H'],[2,4,-3,2,2,'H'],[3,-4,-2,2,1,'H'],[4,3,-2,2,1,'H'],[5,-5,-3,3,2,'H'],[6,4,2,2,2,'H']],
 rainspindle:[[1,-4,-3,2,2,'b'],[2,4,2,2,2,'#'],[3,2,-3,2,2,'b'],[4,3,3,2,2,'H'],[5,-4,-4,2,2,'#'],[6,3,2,2,2,'#']],
 cloudharrow:[[1,-4,-3,2,2,'#'],[2,4,-3,2,2,'b'],[3,-5,2,2,2,'b'],[4,3,2,2,2,'~'],[5,-6,-3,3,2,'b'],[6,3,-3,2,2,'~']],
 morrowkiln:[[1,-5,-3,3,2,'#'],[2,3,-3,3,2,'~'],[3,-5,-2,2,1,'b'],[4,4,-2,2,1,'b'],[5,-6,-3,3,2,'#'],[6,3,2,2,2,'b']],
 dawnsound:[[1,-4,-3,2,2,'#'],[2,3,-3,2,2,'#'],[3,-5,2,3,1,'b'],[4,3,3,2,2,'b'],[5,-5,-3,3,1,'b'],[6,3,2,2,2,'b']]
};
for(const[id,fittings]of Object.entries(FITTINGS))A.layouts[id].fittings=fittings;
// Return visits can repair a different part of the same place. A returned
// letter, planted garden, or finished roof must wait for that particular story.
const AFTERMATH={
 lowquay:{dispatch:'river_arc_complete'},
 glassmine:{roster:'shifts_corrected'},
 wirewood:{garden:'garden_restored'},
 lanternward:{kitchen:'table_arc_complete',memorial:'lights_home',secret:'table_arc_complete'},
 civicvault:{receipts:'law_shared',dispatch:'letters_arc_complete'},
 academy:{observatory:'free_school'},
 witnessarchive:{survey:'dawn_survey_found'},
 highchoir:{weather:'sky_arc_complete'},
 tideward:{delivery:'family_mail_returned'},
 drownedworks:{gauge:'shared_tide_ready'},
 bellpeak:{highbell:'weather_flags_shared'},
 unwrittenhall:{workfloor:'workshop_chosen'},
 morrowkiln:{dispatch:'table_arc_complete',roof:'morning_arc_complete'},
 dawnsound:{tide:'morning_arc_complete',hall:'morning_arc_complete',secret:'morning_arc_complete'}
};
for(const[id,flags]of Object.entries(AFTERMATH))A.layouts[id].aftermath=flags;

A.build=(place,act=1,state={})=>{
 const s=A.layouts[place.id];
 if(!s)throw new Error('Missing authored area: '+place.id);
 const [width,height]=s.size, rows=Array.from({length:height},()=>Array(width).fill(s.shell||'#'));
 const mirrorX=s.flipX,mirrorY=s.flipY;
 const tx=x=>mirrorX?width-1-x:x,ty=y=>mirrorY?height-1-y:y;
 const put=(x,y,c)=>{if(x>0&&y>0&&x<width-1&&y<height-1)rows[ty(y)][tx(x)]=c;};
 const floor=s.floor||'.', rooms=[],anchors={},P=[],landmarks=[];
 const carveRoom=(r,name)=>{
  const[cx,cy,w,h,shape,tag]=r,x0=cx-Math.floor(w/2),y0=cy-Math.floor(h/2);
  for(let y=y0;y<y0+h;y++)for(let x=x0;x<x0+w;x++){
   const dx=Math.abs(x-cx)/(w/2),dy=Math.abs(y-cy)/(h/2);
   if(shape==='oval'&&dx*dx+dy*dy>1)continue;
   if(shape==='diamond'&&dx+dy>1.35)continue;
   if(shape==='notch'&&x<x0+Math.floor(w*.3)&&y<y0+Math.floor(h*.3))continue;
   put(x,y,tag||floor);
  }
  rooms.push({name,x:tx(x0+(mirrorX?w-1:0)),y:ty(y0+(mirrorY?h-1:0)),w,h});
 };
 s.r.forEach((r,i)=>carveRoom(r,s.names[i]));
 const route=(points,wide=1,tag=':')=>{
  const dab=(x,y)=>{for(let yy=-wide;yy<=wide;yy++)for(let xx=-wide;xx<=wide;xx++)put(x+xx,y+yy,tag);};
  for(let i=0;i<points.length-1;i++){
   let[x,y]=points[i];const[bx,by]=points[i+1];dab(x,y);
   while(x!==bx){x+=Math.sign(bx-x);dab(x,y);}
   while(y!==by){y+=Math.sign(by-y);dab(x,y);}
  }
 };
 for(const[a,b,via]of s.links)route([s.r[a].slice(0,2),...(via||[]),s.r[b].slice(0,2)],s.pathWidth??1,s.path||':');
 for(const[index,dx,dy,w,h,tile]of s.fittings||[]){
  const room=s.r[index];for(let y=room[1]+dy;y<room[1]+dy+h;y++)for(let x=room[0]+dx;x<room[0]+dx+w;x++)put(x,y,tile);
 }
 // The only route between the two mission districts crosses this seam.
 // It is sealed after carving, so an adjoining room cannot bypass a gate.
 const vertical=s.axis!=='y',cut=s.cut;
 for(let n=1;n<(vertical?height:width)-1;n++)put(vertical?cut:n,vertical?n:cut,s.shell||'#');
 const completed=!!(state.flags?.[s.done]||state.flags?.[s.task]||state.quests?.includes(s.task));
 const gateOpen=!!(state.adventure?.outcomes?.['gate:'+place.id]||completed);
 const gates=[];
 for(let delta=-1;delta<=1;delta++){
  const x=vertical?cut:s.gate+delta,y=vertical?s.gate+delta:cut;
  put(x,y,gateOpen?(s.path||':'):'G');gates.push([tx(x),ty(y)]);
 }
 // Each area has an authored side annex. Its door survives the fall,
 // while its inner floor gains a new usable bay in the changed world.
 const secret=s.r[8];
 if(act===2&&s.afterBay){
  const[x,y,w,h]=s.afterBay;for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)put(xx,yy,s.path||':');
  rooms.push({name:s.afterName,x:tx(x+(mirrorX?w-1:0)),y:ty(y+(mirrorY?h-1:0)),w,h});
 }
 // Room centres remain clear even when their silhouettes are irregular.
 s.r.forEach((r,i)=>{put(r[0],r[1],r[5]||floor);if(i<8)anchors[s.anchorNames[i]]=point(tx(r[0]),ty(r[1]));});
 const reserved=new Set(Object.values(anchors).map(p=>(p.x-8)/16+','+(p.y-8)/16));
 const candidates=(roomIndex)=>{
  const r=s.r[roomIndex],cx=tx(r[0]),cy=ty(r[1]),pts=[];
  for(let y=cy-Math.floor(r[3]/2)+1;y<cy+Math.ceil(r[3]/2)-1;y++)for(let x=cx-Math.floor(r[2]/2)+1;x<cx+Math.ceil(r[2]/2)-1;x++)if(walk(rows[y]?.[x]))pts.push([x,y]);
  return pts.sort((a,b)=>Math.hypot(a[0]-cx,a[1]-cy)-Math.hypot(b[0]-cx,b[1]-cy)||a[1]-b[1]||a[0]-b[0]);
 };
 const take=(roomIndex,preferred)=>{
  const points=preferred?[preferred,...candidates(roomIndex)]:candidates(roomIndex);
  let p=points.find(([x,y])=>walk(rows[y]?.[x])&&!reserved.has(x+','+y)&&Object.values(anchors).every(a=>Math.hypot(a.x-(x*16+8),a.y-(y*16+8))>=27));
  if(!p)p=points.find(([x,y])=>walk(rows[y]?.[x])&&!reserved.has(x+','+y));
  if(!p)throw new Error('No free authored slot: '+place.id+' room '+roomIndex);
  reserved.add(p.join(','));return point(...p);
 };
 const base={exit:take(0),camp:take(0),goal:take(0),shop:take(0),npcs:[],chests:[],enemies:[],switches:[],rescues:[]};
 (place.npcs||[]).forEach((_,i)=>base.npcs.push(take(i<3?0:(i%4)+1)));
 (place.chests||[]).forEach((_,i)=>base.chests.push(take([8,3,7,6][i%4])));
 (place.encounters||[]).slice(0,3).forEach((_,i)=>base.enemies.push(take([1,3,6][i])));
 for(const i of [2,3])base.switches.push(take(i));
 for(const i of [1,2,3])base.rescues.push(take(i));
 base.bells=take(3);
 const makeProp=(type,x,y,o={})=>P.push({type,...point(tx(x),ty(y)),o});
 // Set dressing belongs to named rooms. Props do not alter the collision map.
 const accents=s.accents||['#d9bc85','#76b7b4','#bb888d'];
 s.r.forEach((r,i)=>{
  const palette=act===2?'#75878b':accents[i%accents.length], motif=s.motifs[i%s.motifs.length].split(' ');
  const placements=[[r[0]-Math.floor(r[2]/2)+1,r[1]+Math.floor(r[3]/2)-1],[r[0]+Math.floor(r[2]/2)-1,r[1]-Math.floor(r[3]/2)+1]];
  placements.forEach(([x,y],n)=>{if(walk(rows[ty(y)]?.[tx(x)])&&!reserved.has(tx(x)+','+ty(y)))makeProp(motif[n%motif.length],x,y,{size:.72+(i%3)*.12,color:palette,broken:act===2&&i%3===0,light:/lamp|candle|brazier|crystal|lantern/.test(motif[n%motif.length])});});
 });
 for(const d of s.details){
  const[room,label,text,textAfter,prop='sign']=d,p=take(room);
  const afterFlag=s.aftermath?.[s.anchorNames[room]]||s.done,resolved=afterFlag===s.done?completed:!!state.flags?.[afterFlag];
  landmarks.push({id:place.id+':'+s.anchorNames[room]+':record',label,...p,text:resolved?textAfter:text,textBefore:text,textAfter,afterFlag});
  P.push({type:prop,x:p.x,y:p.y,z:0,o:{size:.82,color:accents[room%accents.length],light:prop==='lantern'}});
 }
 const sp=take(8),secretFlag=s.aftermath?.secret||s.done,secretResolved=secretFlag===s.done?completed:!!state.flags?.[secretFlag];
 landmarks.push({id:place.id+':secret',label:s.secretLabel,...sp,text:secretResolved?s.secretAfter:s.secretText,textBefore:s.secretText,textAfter:s.secretAfter,afterFlag:secretFlag,secret:true});
 P.push({type:s.secretProp||'chest',...sp,o:{size:.7,color:accents[2],open:true}});
 // A physical threshold and two lamps make the gated route legible in world view.
 for(const d of [-2,2]){
  const x=vertical?cut:s.gate+d,y=vertical?s.gate+d:cut;
  makeProp('pillar',x,y,{size:.68,color:accents[0],broken:gateOpen});
  makeProp('lantern',x,y,{size:.68,color:gateOpen?'#8edcc2':'#db9d76',light:true});
 }
 const signature=rows.map(r=>r.join('')).join('\n');
 const anchorLabels=Object.fromEntries(s.anchorNames.map((name,i)=>[name,s.names[i]]));
 return{rows,width,height,spawn:anchors.entry,anchors,anchorNames:s.anchorNames,anchorLabels,rooms,gates:[{id:place.id,label:s.gateLabel,tiles:gates,open:gateOpen}],props:P,base,landmarks,signature,layout:s};
};
})();
