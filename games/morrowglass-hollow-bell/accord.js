/* The Lantern Accord. Original side stories, town work, and saved content rules. */
(function(root){
'use strict';
const C=root.MorrowCampaign,old={...C},J=root.MorrowJourney;
const f=id=>({flag:id}),d=id=>({defeated:id}),step=(where,text,complete)=>({where,text,complete});
const scene=(...lines)=>lines;
const scenes={
 commission:scene(
  ['anwen','Anwen','The roads are open. The letters still stop at the borders. Every town has a different plan for the same bridge.'],
  ['ivo','Ivo','We could carry the plans. It is the only luggage that gets heavier when someone reads it.'],
  ['anwen','Anwen','First, carry your own replies. Edda, Iria, and Mara have each asked for you. Then help the towns test their shared work.'],
  ['mina','Mina','And when the work is done?'],
  ['anwen','Anwen','Bring everyone to Dawn Spire. The old signal there repeats our words before we have finished them. We need to teach it to listen.']
 ),
 'courier-start':scene(
  ['edda','Edda','This envelope has crossed my table three times. You kept changing the address, Ivo.'],
  ['ivo','Ivo','I knew where it had to go. I did not know what to put inside.'],
  ['edda','Edda','Fen kept the old route receipts. Read them at Wayfarer Camp. They tell you who was waiting.'],
  ['orrin','Orrin','We can carry the bag while you read.'],
  ['ivo','Ivo','I was going to make a joke about its weight. Thank you.']
 ),
 'courier-route':scene(
  ['fen','Fen','Here are your receipts. A meal held warm. A light left in a window. A chair moved out of the rain.'],
  ['ivo','Ivo','No one wrote that the packet was late.'],
  ['fen','Fen','They were waiting for the person who carried it. Nessa has the last return slip at Saltmere.'],
  ['mina','Mina','You can answer it as yourself. There is no route number for that.']
 ),
 'courier-home':scene(
  ['ivo','Ivo','Write this: I am well. I was afraid that coming home would mean I had stopped being useful. I would like to come anyway.'],
  ['nessa','Captain Nessa','Plain words. They will travel well.'],
  ['ivo','Ivo','The parcel watch is still holding the outgoing mail. We will free its loop, then I will take this reply to Edda.']
 ),
 'courier-visit':scene(
  ['ivo','Ivo','Write this: Can we share a meal when I return? I have many stories. I would like to hear yours first.'],
  ['nessa','Captain Nessa','A visit is a good thing to ask for. You do not have to earn it with a story.'],
  ['ivo','Ivo','The parcel watch is still holding the outgoing mail. We will free its loop, then I will take this reply to Edda.']
 ),
 'courier-return':scene(
  ['edda','Edda','You brought the letter in person.'],
  ['ivo','Ivo','It seemed safer than asking another courier to deliver me.'],
  ['edda','Edda','The chair is here. It will still be here after your next journey.'],
  ['ivo','Ivo','Then I can stop carrying it in my head.']
 ),
 'echo-start':scene(
  ['iria','Iria','One of the abbey lamps copies Mina’s voice. It says the right words, but it never asks a question.'],
  ['mina','Mina','I used to think that was how I should sound.'],
  ['iria','Iria','Yune has a blank record at Mothlight. Choose what you want to leave in it. Then take its light to Osa at Lastlight.'],
  ['orrin','Orrin','A record can be useful without being complete.']
 ),
 'echo-page':scene(
  ['yune','Yune','There is no date on this page. No one has claimed the first line.'],
  ['mina','Mina','May I leave part of it empty?'],
  ['yune','Yune','You may leave all of it empty. A blank page is still yours.'],
  ['mina','Mina','I want to leave something a person can use when they do not know who they are yet.']
 ),
 'echo-question':scene(
  ['mina','Mina','I will write a question: What did you choose to care for today?'],
  ['yune','Yune','That answer can change.'],
  ['mina','Mina','It should. Take a copy. I will carry the light to Lastlight.']
 ),
 'echo-practice':scene(
  ['mina','Mina','I will write how to tend a lamp. Clear the glass. Keep the flame low. Leave room for another hand.'],
  ['yune','Yune','A small task, done with care.'],
  ['mina','Mina','It helped me begin. Take a copy. I will carry the light to Lastlight.']
 ),
 'echo-return':scene(
  ['osa','Osa','The echo has stopped giving orders. The lamp has room for your voice now.'],
  ['mina','Mina','I do not need it to keep my voice. I need it to light the next person’s work.'],
  ['osa','Osa','Then you know what to leave here.'],
  ['mina','Mina','A clear glass. A low flame. Enough light for a question.']
 ),
 'oath-start':scene(
  ['mara','Mara','The old watch at Cinderbridge is still on duty. It has no next shift in its record.'],
  ['orrin','Orrin','I signed that order. I thought an end date would make the promise weak.'],
  ['mara','Mara','Bram can make a release fitting. Meet him at Copperwood. Then choose how the crossing will be kept.'],
  ['ivo','Ivo','I would like a guard who has had lunch.']
 ),
 'oath-fitting':scene(
  ['bram','Bram','This fitting will hold under strain. Pull the small pin and it will let go.'],
  ['orrin','Orrin','The release is part of its strength.'],
  ['bram','Bram','Yes. Now the bridge needs a plan that lets its keeper do the same.'],
  ['mina','Mina','Will you share the watch, or teach a new one? Either way, leave your own name off some days.']
 ),
 'oath-rota':scene(
  ['orrin','Orrin','We will keep a shared watch. Each shift will have a clear end. No one will have to ask to rest.'],
  ['bram','Bram','I will put the times beside the release pin.'],
  ['orrin','Orrin','The old watch at Cinderbridge still follows my first order. I must go there and end it.']
 ),
 'oath-teach':scene(
  ['orrin','Orrin','I will teach the next watch. I will show them the release before I show them the lock.'],
  ['bram','Bram','And who will teach the person after them?'],
  ['orrin','Orrin','They will. The old watch at Cinderbridge still follows my first order. I must go there and end it.']
 ),
 'oath-return':scene(
  ['orrin','Orrin','Your order is complete. The crossing is safe. You may stand down.'],
  ['narrator','The bridge watch','The guard lowers its arm. Beneath the old order, Orrin writes the time of its last shift.'],
  ['mina','Mina','What will you do with the rest of the day?'],
  ['orrin','Orrin','Have lunch. Then ask someone to walk with me.']
 ),
 'bridge-start':scene(
  ['rowan','Rowan','Our repair cart cannot cross the small span. The load pulls to one side. The bridge brace tries to hold it still.'],
  ['ivo','Ivo','The cart and the brace both mean well. That is often when I get called.'],
  ['rowan','Rowan','Fen has the load plan at Wayfarer Camp. Balance the cart there, then come back and free the brace.'],
  ['orrin','Orrin','We will repair the crossing before we ask it to carry more.']
 ),
 'bridge-plan':scene(
  ['fen','Fen','Six stone blocks. The center tray takes half the load. The east tray takes one block. The west tray takes what remains.'],
  ['mina','Mina','One for the east. Three in the center. Two for the west.'],
  ['fen','Fen','Set the cart beside the kettle. A wrong setting costs nothing. Check it before you move.']
 ),
 'bridge-balanced':scene(
  ['narrator','The repair cart','Both wheels settle at the same height. The cart is ready to return to Bracken Post.'],
  ['orrin','Orrin','Now we can release the old brace without leaving anyone stranded.']
 ),
 'bridge-return':scene(
  ['rowan','Rowan','The cart crossed. The bridge moved a little under it.'],
  ['orrin','Orrin','That is what a sound bridge does.'],
  ['rowan','Rowan','I left a wide place at the rail. Two people can stop there and let a third pass.'],
  ['ivo','Ivo','A road with room for a conversation. We should mark that on Fen’s map.']
 ),
 'tide-start':scene(
  ['nell','Nell','Three work messages arrived together. The old signal sent each one to the wrong keeper.'],
  ['mina','Mina','Did it ask anyone to check the address?'],
  ['nell','Nell','It only asked them to obey. Daro kept the messages at Glasswater. Free the signal wheel and set its addresses again.'],
  ['ivo','Ivo','A letter may be short. That does not make it an order.']
 ),
 'tide-plan':scene(
  ['daro','Daro','The wheel repeats every warning. It cannot tell a request from a fault. We must stop it before we route the notes.'],
  ['daro','Daro','I inspect lock gates. Tova keeps dry beds at Rainweald. Osa tends the lamp at Lastlight. Each message names its work.'],
  ['mina','Mina','Then the person who does the work will read it first.']
 ),
 'tide-routed':scene(
  ['narrator','Three replies','The wheel sends one note to each keeper. It waits for a reply before it turns again.'],
  ['daro','Daro','There. A pause is part of the signal. Tell Nell the line is clear.']
 ),
 'tide-return':scene(
  ['nell','Nell','All three keepers answered. One said the work would take another day.'],
  ['ivo','Ivo','Did the signal object?'],
  ['nell','Nell','It waited. I think that may be its most useful new skill.'],
  ['mina','Mina','We can practice it too.']
 ),
 'garden-start':scene(
  ['sena','Sena','Three small creatures left Moonwell. A warning bell and an old wire gate keep them from the water.'],
  ['mina','Mina','We can make a safe way back.'],
  ['sena','Sena','Read the tracks at Moonwell first. When the creatures are safe, we can remove the wire keeper here in the orchard.'],
  ['ivo','Ivo','No one has to fight the creatures. I would like that written on the work order.']
 ),
 'garden-signs':scene(
  ['narrator','Tracks by the well','Reed moths hide when the bell rings. A rain mouse waits by an empty bowl. A young rootback stands at the closed gate.'],
  ['mina','Mina','First quiet the bell. Then put down water. Open the gate only when the path is calm.'],
  ['orrin','Orrin','We will stay back. They can choose when to move.']
 ),
 'garden-safe':scene(
  ['narrator','The path to water','The moths leave the bell. The mouse drinks. The rootback walks through the open gate and waits for the others.'],
  ['mina','Mina','All three are safe. We can clear the empty wire keeper at the Old Orchard now.']
 ),
 'garden-return':scene(
  ['sena','Sena','I have put the old wire away. The gap in the hedge will stay open.'],
  ['orrin','Orrin','Will the creatures stay?'],
  ['sena','Sena','Some days. On other days they will use the road.'],
  ['ivo','Ivo','Then it is a very good road.']
 ),
 'afterglow-start':scene(
  ['ada','Ada','The gathering left a small echo in this lens. It shines even when every other lamp rests.'],
  ['mina','Mina','Is it afraid to go dark?'],
  ['ada','Ada','I do not know. Set the lens first. West on the left, North in the center, South on the right. Then we can ask it.'],
  ['orrin','Orrin','We have time for one more question.']
 ),
 'afterglow-aligned':scene(
  ['narrator','The open lens','Three narrow beams meet over the water. A small guardian gathers in their light.'],
  ['ada','Ada','It keeps the signal that remained after the meeting. Face it when you are ready. Rest at the camp first.']
 ),
 'afterglow-return':scene(
  ['mina','Mina','It was keeping a place for the next meeting.'],
  ['ada','Ada','Then we can leave it a date, and let the lamp rest until then.'],
  ['ivo','Ivo','I will deliver the invitations. After breakfast.'],
  ['orrin','Orrin','I will help. After breakfast.']
 ),
 'gathering-table':scene(
  ['anwen','Anwen','Shall we meet at one shared table, or carry the meeting from town to town?'],
  ['mina','Mina','Keep a table here. Leave empty chairs for late arrivals. Send the notes to anyone who cannot travel.'],
  ['anwen','Anwen','Then Hearthcross will keep the table. Each town will choose who speaks for it, and may change that choice.']
 ),
 'gathering-rounds':scene(
  ['anwen','Anwen','Shall we meet at one shared table, or carry the meeting from town to town?'],
  ['ivo','Ivo','Carry it along the roads. We can hear a place better when we stand in it.'],
  ['anwen','Anwen','Then each town will host in turn. Send the notes ahead, and let the hosts tell us what they need.']
 )
};
const choices={
 'courier-reply':{id:'courier-reply',title:'A reply at last',prompt:'What will Ivo put in his reply? Both choices keep every quest and reward available.',flag:'accord_courier_reply',options:[{id:'home',label:'Write a plain reply',scene:scenes['courier-home']},{id:'visit',label:'Ask for a shared meal',scene:scenes['courier-visit']}]},
 'mina-record':{id:'mina-record',title:'A page of her own',prompt:'What will Mina leave in the blank record? Both choices keep every quest and reward available.',flag:'accord_mina_record',options:[{id:'question',label:'Leave a question',scene:scenes['echo-question']},{id:'practice',label:'Leave a useful task',scene:scenes['echo-practice']}]},
 'orrin-watch':{id:'orrin-watch',title:'The next watch',prompt:'How will Orrin pass on the work? Both choices keep every quest and reward available.',flag:'accord_orrin_watch',options:[{id:'rota',label:'Share the watch',scene:scenes['oath-rota']},{id:'teach',label:'Teach the next watch',scene:scenes['oath-teach']}]},
 gathering:{id:'gathering',title:'The Lantern Accord',prompt:'Choose how the towns will meet. Both plans keep every quest and reward available.',flag:'accord_gathered',options:[{id:'table',label:'Keep a shared table',scene:scenes['gathering-table']},{id:'rounds',label:'Visit each town in turn',scene:scenes['gathering-rounds']}]}
};
const puzzles={
 'bridge-load':{id:'bridge-load',room:'waycamp',title:'Balance the repair cart',kind:'dials',prompt:'Place six blocks in three trays. The center takes half the load. The east takes one block. The west takes the rest.',labels:['East tray','Center tray','West tray'],max:4,initial:[0,0,0],solution:[1,3,2],flag:'accord_bridge_balanced',scene:scenes['bridge-balanced'],hints:['The three trays need six blocks in total.','Half of six is three. Put three blocks in the center.','Set East to 1, Center to 3, and West to 2.']},
 'coast-messages':{id:'coast-messages',room:'glasswater',title:'Route the work messages',kind:'match',prompt:'Match each request to the keeper who does that work. Read the task in each message.',labels:[{id:'repair',label:'Please inspect the lock gate hinge.'},{id:'shelter',label:'Please prepare two dry beds before the rain.'},{id:'lamp',label:'Please check the far lamp glass.'}],options:[{id:'daro',label:'Daro · Glasswater'},{id:'tova',label:'Tova · Rainweald'},{id:'osa',label:'Osa · Lastlight'}],initial:{},solution:{repair:'daro',shelter:'tova',lamp:'osa'},flag:'accord_tide_routed',scene:scenes['tide-routed'],hints:['Each keeper has one task. Look at the place beside each name.','Daro repairs locks. Tova keeps the shelter. Osa tends the far lamp.','Gate hinge → Daro. Dry beds → Tova. Lamp glass → Osa.']},
 'garden-care':{id:'garden-care',room:'moonwell',title:'A quiet path to water',kind:'order',prompt:'Make the path safe for all three creatures. Calm the noise before you provide water. Open the gate last.',options:[{id:'open',label:'Open the gate'},{id:'quiet',label:'Quiet the bell'},{id:'water',label:'Set down water'}],initial:[],solution:['quiet','water','open'],flag:'accord_garden_safe',scene:scenes['garden-safe'],hints:['The creatures will not approach while the bell rings.','Water must be ready before the gate opens.','Quiet the bell → Set down water → Open the gate.']},
 'afterglow-lens':{id:'afterglow-lens',room:'duskobservatory',title:'The light after the meeting',kind:'dials',prompt:'Turn the left lens West, the center lens North, and the right lens South. Directions run North, East, South, West.',labels:['Left lens','Center lens','Right lens'],valueLabels:['North','East','South','West'],max:3,initial:[0,0,0],solution:[3,0,2],flag:'accord_afterglow_aligned',scene:scenes['afterglow-aligned'],hints:['The center lens points North.','The outer lenses point West and South.','Left: West. Center: North. Right: South.']}
};
const gear={
 'courier-thread':{name:'Courier Thread',owner:'ivo',ability:'threadcut',skill:'Threadcut',need:28,atk:60,desc:'Adds 60 Attack. Threadcut strikes for 120% Attack. The next two hits deal 20% more damage within 12 active battle seconds. Learn it with 28 AP.'},
 'clear-prism':{name:'Clear Prism',owner:'mina',ability:'clearsong',skill:'Clear Song',need:28,atk:60,desc:'Adds 60 Attack. Clear Song heals living allies and removes Slow and Poison. Learn it with 28 AP.'},
 'promise-oath':{name:'Promise Oath',owner:'orrin',ability:'interpose',skill:'Interpose',need:28,atk:57,def:15,desc:'Adds 57 Attack and 15 Defense. Interpose reduces damage by 25% and gives party Regen for 12 active battle seconds. Learn it with 28 AP.'}
};
const q=(id,flag,title,where,text,requires,complete,rewardData,lines,steps,extra={})=>({id,flag,title,where,text,requires,complete,rewardData,scene:lines,steps,...extra});
const side=[
 q('accord-courier','accord_side_courier','A reply at last','morrowglass','Speak with Edda on Lantern Quay. Read Fen’s route receipts. Write a reply at Saltmere, free the parcel watch, and bring the reply home.',f('accord_courier_started'),[d('accord-courier'),f('accord_courier_returned')],{crowns:500,gear:'courier-thread',materials:{fiber:4,star:2}},scene(['edda','Edda','This thread came from the first bag you carried. I kept it when you asked for a larger one.'],['ivo','Ivo','It can carry one more thing. A way to ask for help.'],['narrator','Threadcut','Courier Thread teaches Threadcut. Equip it on Ivo to use the skill now. Earn 28 AP to keep it after changing equipment.']),[
  step('morrowglass','Speak with Edda at the Accord marker on Lantern Quay.',f('accord_courier_started')),
  step('waycamp','Read Fen’s route receipts at Wayfarer Camp.',f('accord_courier_route')),
  step('saltmere','Choose Ivo’s reply at Saltmere Harbor.',f('accord_courier_reply')),
  step('saltmere','Free the parcel watch at Saltmere Harbor.',d('accord-courier')),
  step('morrowglass','Bring the reply to Edda on Lantern Quay.',f('accord_courier_returned'))
 ],{start:'accord_courier_started',reward:'Courier Thread · Threadcut · 500 crowns',role:'ivo'}),
 q('accord-echo','accord_side_echo','A page of her own','whitewake','Speak with Iria at Whitewake. Read Yune’s blank page at Mothlight. Choose what Mina will leave, then take its light to Lastlight.',f('accord_echo_started'),[d('accord-echo'),f('accord_echo_returned')],{crowns:500,gear:'clear-prism',materials:{glass:4,star:2}},scene(['osa','Osa','Take this clear prism. It has no voice of its own.'],['mina','Mina','Good. I can use it to hear someone else.'],['narrator','Clear Song','Clear Prism teaches Clear Song. Equip it on Mina to heal living allies and remove Slow and Poison. Earn 28 AP to keep the skill.']),[
  step('whitewake','Speak with Iria at the Accord marker in Whitewake Abbey.',f('accord_echo_started')),
  step('mothlight','Read the blank page with Yune in Mothlight’s reading hall.',f('accord_echo_page')),
  step('mothlight','Choose what Mina will leave in the record.',f('accord_mina_record')),
  step('lastlight','Quiet the copied voice at Lastlight Isle.',d('accord-echo')),
  step('lastlight','Tend the clear lamp with Osa at Lastlight.',f('accord_echo_returned'))
 ],{start:'accord_echo_started',reward:'Clear Prism · Clear Song · 500 crowns',role:'mina'}),
 q('accord-oath','accord_side_oath','The end of a watch','foundry','Speak with Mara at Ember Foundry. Ask Bram for a release fitting. Choose the next watch, then end Orrin’s old order at Cinderbridge.',f('accord_oath_started'),[d('accord-oath'),f('accord_oath_returned')],{crowns:500,gear:'promise-oath',materials:{copper:4,star:2}},scene(['orrin','Orrin','I will keep this fitting beside my sword.'],['mina','Mina','To remind you that someone can take your place?'],['orrin','Orrin','To remind me to let them.'],['narrator','Interpose','Promise Oath teaches Interpose. Equip it on Orrin for party damage reduction and Regen. Earn 28 AP to keep the skill.']),[
  step('foundry','Speak with Mara at the Accord marker in Ember Foundry.',f('accord_oath_started')),
  step('copperwood','Collect Bram’s release fitting at Copperwood’s lower sluice.',f('accord_oath_fitting')),
  step('copperwood','Choose how the next watch will share its work.',f('accord_orrin_watch')),
  step('cinderbridge','Face the old watch at Cinderbridge.',d('accord-oath')),
  step('cinderbridge','End the old order at the watch record.',f('accord_oath_returned'))
 ],{start:'accord_oath_started',reward:'Promise Oath · Interpose · 500 crowns',role:'orrin'}),
 q('accord-bridge','accord_side_bridge','Room at the rail','bracken','Ask Rowan about the small crossing. Read Fen’s load plan, balance the repair cart, then return to Bracken and release the old brace.',f('accord_bridge_started'),[d('accord-bridge'),f('accord_bridge_returned')],{crowns:450,materials:{copper:5,fiber:5},tonic:3},scene(['rowan','Rowan','I sent the repair plan to every town on the route. There is space at the bottom for a better one.'],['ivo','Ivo','Leave room for a drawing of the kettle. That is how Fen will find it.']),[
  step('bracken','Speak with Rowan at the Accord marker in Bracken Post.',f('accord_bridge_started')),
  step('waycamp','Read Fen’s repair-cart plan at Wayfarer Camp.',f('accord_bridge_plan')),
  step('waycamp','Balance the repair cart: six blocks across three trays.',f('accord_bridge_balanced')),
  step('bracken','Free the old bridge brace at Bracken Post.',d('accord-bridge')),
  step('bracken','Inspect the repaired rail with Rowan.',f('accord_bridge_returned'))
 ],{start:'accord_bridge_started',reward:'450 crowns · Copper and root fiber'}),
 q('accord-tide','accord_side_tide','The time to answer','gullwake','Ask Nell about the crossed messages. Meet Daro at Glasswater, free the signal wheel, and route the three work notes. Return to Nell.',f('accord_tide_started'),[d('accord-tide'),f('accord_tide_routed'),f('accord_tide_returned')],{crowns:450,materials:{glass:5,pollen:5},ether:4},scene(['nell','Nell','The first reply says, “Thank you for waiting.”'],['mina','Mina','Keep that one by the wheel.']),[
  step('gullwake','Speak with Nell at the Accord marker in Gullwake Port.',f('accord_tide_started')),
  step('glasswater','Ask Daro about the crossed work messages.',f('accord_tide_plan')),
  step('glasswater','Free the repeating signal wheel at Glasswater Locks.',d('accord-tide')),
  step('glasswater','Match the work messages to Daro, Tova, and Osa.',f('accord_tide_routed')),
  step('gullwake','Bring the three replies to Nell at Gullwake.',f('accord_tide_returned'))
 ],{start:'accord_tide_started',reward:'450 crowns · Memory glass and moth pollen'}),
 q('accord-garden','accord_side_garden','A gate left open','orchard','Ask Sena about the creatures at Moonwell. Read their tracks and make a calm route to water. Clear the empty wire keeper, then return to Sena.',f('accord_garden_started'),[d('accord-garden'),f('accord_garden_safe'),f('accord_garden_returned')],{crowns:450,materials:{fiber:5,pollen:5},feather:3},scene(['sena','Sena','I left three small bowls by the road. Nothing has to stay hungry to be welcome.'],['mina','Mina','We can carry one more in the bag.'],['ivo','Ivo','I think we have always had room.']),[
  step('orchard','Speak with Sena at the Accord marker in the Old Orchard.',f('accord_garden_started')),
  step('moonwell','Read the creature tracks by Moonwell.',f('accord_garden_signs')),
  step('moonwell','Quiet the bell, provide water, then open the gate.',f('accord_garden_safe')),
  step('orchard','Remove the empty wire keeper at the Old Orchard.',d('accord-garden')),
  step('orchard','Leave the garden gate open with Sena.',f('accord_garden_returned'))
 ],{start:'accord_garden_started',reward:'450 crowns · Root fiber and moth pollen'}),
 q('accord-afterglow','accord_side_afterglow','After the last guest','duskobservatory','After the Accord gathering, speak with Ada at Dusk Observatory. Set the three lenses, face the Afterglow, and leave a date for the next meeting.',f('accord_afterglow_started'),[d('accord-afterglow'),f('accord_afterglow_returned')],{crowns:900,materials:{star:8,glass:4},tonic:4,ether:4},scene(['narrator','After the last guest','The lamp rests. A date remains on the table. There is no final visitor, only someone who has not arrived yet.'],['ivo','Ivo','Come on. There is a breakfast with our names on it.']),[
  step('duskobservatory','After the Accord ending, ask Ada about the light in the lens.',f('accord_afterglow_started')),
  step('duskobservatory','Set the left, center, and right lenses to West, North, and South.',f('accord_afterglow_aligned')),
  step('duskobservatory','Face the Afterglow. Rest and prepare first.',d('accord-afterglow')),
  step('duskobservatory','Speak with Ada at the quiet lens.',f('accord_afterglow_returned'))
 ],{start:'accord_afterglow_started',reward:'900 crowns · Eight star shards · Supplies'})
];
for(const quest of side)quest.available=f(quest.id==='accord-afterglow'?'accord_finished':'accord_commission');
const partyFlags=side.slice(0,3).map(x=>x.flag),townFlags=side.slice(3,6).map(x=>x.flag),sixFlags=[...partyFlags,...townFlags];
const main=[
 q('accord-road','accord_commission','The letters after the storm','hearthcross','After the Rootbound Atlas ending, speak with Anwen at Hearthcross. Help the people put the open roads to daily use.',f('root_finished'),f('accord_briefed'),{crowns:300,tonic:6,ether:6},scene(['anwen','Anwen','Begin where someone is waiting for you. Edda on Lantern Quay. Iria at Whitewake. Mara at Ember Foundry.'],['narrator','The Lantern Accord','New work is marked in the fields. Use the Journal to track one step at a time. No Accord mission or Roadside Moment expires.']),[step('hearthcross','Speak with Anwen at the Lantern Accord marker.',f('accord_briefed'))],{chapter:14}),
 q('accord-company','accord_party','Three replies','hearthcross','Finish Ivo’s, Mina’s, and Orrin’s side stories in any order. Each story grants equipment that teaches a new skill.',f('accord_commission'),partyFlags.map(f),{crowns:400,materials:{star:3},feather:3},scene(['anwen','Anwen','Three replies. Three people who chose how to give them.'],['orrin','Orrin','Now the towns need the same chance.'],['anwen','Anwen','Help Rowan’s crossing, Nell’s message line, and Sena’s open gate. Then bring the work to Dawn Spire.'],['narrator','Advanced contracts','Gale, Tide, and Root trials are now available. These repeatable fights can teach the new equipment skills before Dawn Spire.']),[
  step('morrowglass','Finish Ivo’s story, A reply at last.',f('accord_side_courier')),
  step('whitewake','Finish Mina’s story, A page of her own.',f('accord_side_echo')),
  step('foundry','Finish Orrin’s story, The end of a watch.',f('accord_side_oath'))
 ],{chapter:14}),
 q('accord-voices','accord_chorus','A pause between voices','dawnspire','Finish all six town and party stories. Go to Dawn Spire and free the Unfinished Chorus from its repeating orders.',f('accord_party'),[...sixFlags.map(f),d('accord-chorus')],{crowns:700,materials:{star:5,pollen:4}},scene(['narrator','The Unfinished Chorus','IF I WAIT, SOMEONE MAY GO UNHEARD.'],['mina','Mina','If you never wait, no one can answer.'],['ivo','Ivo','Carry one voice. Then leave room for the next.'],['orrin','Orrin','You do not have to speak for us. You can help us hear each other.'],['narrator','Dawn Spire','The signal stops. In the quiet, six small replies arrive from the roads below.'],['anwen','Anwen’s message','Come to Hearthcross. The guests are ready to choose how we meet.']),[
  step('bracken','Finish Room at the rail for Rowan.',f('accord_side_bridge')),
  step('gullwake','Finish The time to answer for Nell.',f('accord_side_tide')),
  step('orchard','Finish A gate left open for Sena.',f('accord_side_garden')),
  step('dawnspire','Free the Unfinished Chorus at Dawn Spire.',d('accord-chorus'))
 ],{chapter:15}),
 q('accord-morning','accord_finished','A place at the table','hearthcross','Return to Anwen after the Chorus is quiet. Choose how the towns will meet, then hear the first gathering.',f('accord_chorus'),f('accord_gathered'),{crowns:700,tonic:6,ether:6,feather:3,materials:{star:4}},scene(['anwen','Anwen','The first item is repairs. The second is who needs help with them.'],['rowan','Rowan','The bridge has room for another cart.'],['nell','Nell','The message line can wait for an answer.'],['sena','Sena','The garden gate will stay open.'],['orrin','Orrin','The watch has an end.'],['mina','Mina','The page has a space.'],['ivo','Ivo','And the courier has an address he can come back to.'],['narrator','The Lantern Accord','The meeting lasts past lunch. Someone brings another plate. Beyond the window, the road is quiet enough to hear the next arrival.']),[step('hearthcross','Choose the meeting plan with Anwen at Hearthcross.',f('accord_gathered'))],{chapter:15})
];
const moments=[
 {id:'saved-chair',title:'The saved chair',where:'morrowglass',requires:f('accord_side_courier'),scene:scene(['edda','Edda','You keep looking at the door.'],['ivo','Ivo','I am used to leaving before the plates are cleared.'],['edda','Edda','There are three plates and four hands free. Sit for a moment.'],['ivo','Ivo','I can learn that.'])},
 {id:'room-at-rail',title:'Two people at the rail',where:'bracken',requires:f('accord_side_bridge'),scene:scene(['rowan','Rowan','The wide place on the bridge has become a meeting place.'],['orrin','Orrin','Does it slow the carts?'],['rowan','Rowan','A little. The drivers stop to ask who needs a lift.'],['orrin','Orrin','Leave it wide, then.'])},
 {id:'one-cup',title:'One cup left',where:'waycamp',requires:f('accord_commission'),scene:scene(['fen','Fen','One cup left. I was about to put the kettle away.'],['ivo','Ivo','We can share it.'],['mina','Mina','Or we can put the kettle back on.'],['fen','Fen','Yes. I keep forgetting the fire is ours.'])},
 {id:'quiet-signal',title:'The quiet signal',where:'saltmere',requires:f('accord_side_courier'),scene:scene(['nessa','Captain Nessa','The harbor bell only rings for arrivals now.'],['ivo','Ivo','How do you mark a departure?'],['nessa','Captain Nessa','We wave until they cannot see us. Then we get on with the work.'],['ivo','Ivo','That sounds like a good way to be missed.'])},
 {id:'wrong-note',title:'A useful wrong note',where:'whitewake',requires:f('accord_echo_started'),scene:scene(['iria','Iria','You changed the last note.'],['mina','Mina','I could not remember the old one.'],['iria','Iria','The child beside you copied the new one. She was smiling.'],['mina','Mina','Then let us keep both.'])},
 {id:'between-lines',title:'Between the lines',where:'mothlight',requires:f('accord_side_echo'),scene:scene(['yune','Yune','Someone left a question under your record.'],['mina','Mina','Do I have to answer it?'],['yune','Yune','Only if you want to. I left a blank page after it.'],['mina','Mina','Good. I want to read the question twice.'])},
 {id:'watch-end',title:'When the watch ends',where:'cinderbridge',requires:f('accord_side_oath'),scene:scene(['ivo','Ivo','You are still standing beside the watch post.'],['orrin','Orrin','I am waiting for the next guard.'],['mina','Mina','They arrived ten minutes ago. They asked if you wanted tea.'],['orrin','Orrin','I thought that was a test. I will say yes.'])},
 {id:'answer-arrives',title:'The answer arrives',where:'gullwake',requires:f('accord_side_tide'),scene:scene(['nell','Nell','This reply only says, “Not today.”'],['orrin','Orrin','Will the work wait?'],['nell','Nell','It can. Now we know to ask someone else.'],['mina','Mina','That is still an answer that helps.'])},
 {id:'small-feet',title:'Very small feet',where:'moonwell',requires:f('accord_side_garden'),scene:scene(['narrator','Moonwell','The rain mouse has moved its bowl a few steps from the path.'],['ivo','Ivo','A request for a quieter address.'],['mina','Mina','We should update the map.'],['orrin','Orrin','Use small letters.'])},
 {id:'guest-list',title:'Guests, not signatures',where:'hearthcross',requires:f('accord_party'),scene:scene(['anwen','Anwen','Some invitations have come back without signatures.'],['orrin','Orrin','Do you need us to collect them?'],['anwen','Anwen','No. They wrote how many chairs they need. That is enough.'],['ivo','Ivo','At last, a form with a useful question.'])},
 {id:'own-voice',title:'A voice of its own',where:'dawnspire',requires:f('accord_chorus'),scene:scene(['narrator','Dawn Spire','A low note sounds from the quiet signal. It waits. No second note follows.'],['mina','Mina','That was its own voice.'],['orrin','Orrin','Does it need an answer?'],['mina','Mina','Perhaps only someone to hear it.'])},
 {id:'light-after',title:'The light after',where:'duskobservatory',requires:f('accord_side_afterglow'),scene:scene(['ada','Ada','The next date is on the table. No one has to guard it.'],['ivo','Ivo','What if the wind takes the paper?'],['ada','Ada','There are copies in every town.'],['orrin','Orrin','Then we can all go home.'])}
];
const trials=[
 {id:'accord-trial-gale',name:'Gale Trial',where:'observatory',need:'accord_party',text:'A repeatable advanced wind trial at Starfall Observatory. Current supplies carry into battle.',materials:{fiber:4,star:2}},
 {id:'accord-trial-tide',name:'Tide Trial',where:'tideglass',need:'accord_party',text:'A repeatable advanced water trial at Tideglass Shrine. Current supplies carry into battle.',materials:{glass:4,star:2}},
 {id:'accord-trial-root',name:'Root Trial',where:'crownroot',need:'accord_party',text:'A repeatable advanced root trial at Crownroot’s approach. Current supplies carry into battle.',materials:{copper:4,pollen:2,star:1}}
];
const hotspots=[];
function node(id,room,label,kind,p,requires,action,hide=null){hotspots.push({id:'accord-node:'+id,room,label,kind,p,requires,hide,action});}
function talk(id,room,label,p,requires,flag,sceneId=id){node(id,room,label,'talk',p,requires,{type:'scene',id:sceneId,flag},f(flag));}
function choose(id,room,label,p,requires){node(id,room,label,'puzzle',p,requires,{type:'choice',id},f(choices[id].flag));}
function puzzle(id,room,label,p,requires){node(id,room,label,'puzzle',p,requires,{type:'puzzle',id},f(puzzles[id].flag));}
function fight(id,room,label,p,requires){node(id+'-fight',room,label,'fight',p,requires,{type:'fight',id},d(id));}
const commissioned=f('accord_commission');
talk('commission','hearthcross','Anwen · The Lantern Accord',[387,474],f('root_finished'),'accord_briefed');
talk('courier-start','quay','Edda · A reply at last',[564,463],commissioned,'accord_courier_started');
talk('courier-route','waycamp','Fen · The route receipts',[379,475],f('accord_courier_started'),'accord_courier_route');
choose('courier-reply','saltmere','Write Ivo’s reply',[574,474],f('accord_courier_route'));
fight('accord-courier','saltmere','The parcel watch',[574,474],f('accord_courier_reply'));
talk('courier-return','quay','Edda · Deliver the reply',[564,463],d('accord-courier'),'accord_courier_returned');
talk('echo-start','whitewake','Iria · A page of her own',[585,474],commissioned,'accord_echo_started');
talk('echo-page','mothlight','Yune · The blank page',[555,476],f('accord_echo_started'),'accord_echo_page');
choose('mina-record','mothlight','Mina’s record',[555,476],f('accord_echo_page'));
fight('accord-echo','lastlight','The copied voice',[576,475],f('accord_mina_record'));
talk('echo-return','lastlight','Osa · The clear lamp',[576,475],d('accord-echo'),'accord_echo_returned');
talk('oath-start','foundry','Mara · The last watch',[572,474],commissioned,'accord_oath_started');
talk('oath-fitting','copperwood','Bram · The release fitting',[560,476],f('accord_oath_started'),'accord_oath_fitting');
choose('orrin-watch','copperwood','Plan the next watch',[560,476],f('accord_oath_fitting'));
fight('accord-oath','cinderbridge','The old watch',[572,475],f('accord_orrin_watch'));
talk('oath-return','cinderbridge','End the old order',[572,475],d('accord-oath'),'accord_oath_returned');
talk('bridge-start','bracken','Rowan · Room at the rail',[402,474],commissioned,'accord_bridge_started');
talk('bridge-plan','waycamp','Fen · The cart plan',[701,472],f('accord_bridge_started'),'accord_bridge_plan');
puzzle('bridge-load','waycamp','Balance the repair cart',[701,472],f('accord_bridge_plan'));
fight('accord-bridge','bracken','The old bridge brace',[402,474],f('accord_bridge_balanced'));
talk('bridge-return','bracken','Rowan · The repaired rail',[402,474],d('accord-bridge'),'accord_bridge_returned');
talk('tide-start','gullwake','Nell · The crossed messages',[578,473],commissioned,'accord_tide_started');
talk('tide-plan','glasswater','Daro · The work notes',[539,473],f('accord_tide_started'),'accord_tide_plan');
fight('accord-tide','glasswater','The repeating wheel',[539,473],f('accord_tide_plan'));
puzzle('coast-messages','glasswater','Route the work messages',[539,473],d('accord-tide'));
talk('tide-return','gullwake','Nell · The three replies',[578,473],f('accord_tide_routed'),'accord_tide_returned');
talk('garden-start','orchard','Sena · A gate left open',[569,475],commissioned,'accord_garden_started');
talk('garden-signs','moonwell','Read the small tracks',[569,475],f('accord_garden_started'),'accord_garden_signs');
puzzle('garden-care','moonwell','A quiet path to water',[569,475],f('accord_garden_signs'));
fight('accord-garden','orchard','The empty wire keeper',[569,475],f('accord_garden_safe'));
talk('garden-return','orchard','Sena · The open gate',[569,475],d('accord-garden'),'accord_garden_returned');
fight('accord-chorus','dawnspire','The Unfinished Chorus',[568,475],[f('accord_party'),...sixFlags.map(f)]);
choose('gathering','hearthcross','Anwen · The first gathering',[387,474],f('accord_chorus'));
talk('afterglow-start','duskobservatory','Ada · After the last guest',[565,475],f('accord_finished'),'accord_afterglow_started');
puzzle('afterglow-lens','duskobservatory','Set the meeting lens',[565,475],f('accord_afterglow_started'));
fight('accord-afterglow','duskobservatory','The Afterglow',[565,475],f('accord_afterglow_aligned'));
talk('afterglow-return','duskobservatory','Ada · The quiet lens',[565,475],d('accord-afterglow'),'accord_afterglow_returned');
for(const t of trials)node(t.id,t.where,t.name+' · Repeatable','fight',[723,474],f(t.need),{type:'contract',id:t.id});
// A later step replaces the earlier marker at the same point. No two steps in one chain stay active.
for(const h of hotspots){if(h.id!=='accord-node:commission')h.requires=[commissioned,h.requires];const id=h.action.id;if(id==='courier-reply')h.hide={any:[f('accord_courier_reply'),f('accord_side_courier')]};if(id==='mina-record')h.hide={any:[f('accord_mina_record'),f('accord_side_echo')]};if(id==='orrin-watch')h.hide={any:[f('accord_orrin_watch'),f('accord_side_oath')]};}
const legacySteps={
 delivery:[step('bracken','Ask Linn at Bracken Post for her letter.',f('delivery_started')),step('orchard','Deliver Linn’s letter to Sena in the Old Orchard.',f('delivery_delivered')),step('bracken','Return to Linn for the reply.',f('side_delivery'))],
 orchard:[step('orchard','Ask Sena about the last seed.',f('orchard_started')),step('orchard','Clear the orchard blight.',d('orchard-blight')),step('orchard','Plant the seed in the empty bed.',f('side_orchard'))],
 survey:[step('waycamp','Ask Fen for a field chart.',f('survey_started')),step('waycamp','Visit eight overworld destinations, then return to Fen.',f('side_survey'))],
 wreck:[step('saltmere','After the ferry is ready, ask Nessa about the wreck.',f('wreck_started')),step('saltmere','Clear the Wreck Diver by the harbor.',d('wreck-diver')),step('saltmere','Return the lost cargo to Nessa.',f('side_wreck'))],
 stars:[step('observatory','After Paperwing is ready, ask Aster about the false star.',f('stars_started')),step('dawnspire','Find and defeat the false star at Dawn Spire.',d('star-eater')),step('observatory','Return to Aster with the clear lens.',f('side_stars'))],
 cards:[step('driftmarket','Meet Orla at Driftmarket.',f('cards_started')),step('driftmarket','Win a hand at Orla’s island table.',f('side_cards'))],
 'return-address':[step('gullwake','Ask Nell about the lost packet.',f('tide_letter_started')),step('rainweald','Clear the packet nest at Rainweald.',d('returning-letter')),step('rainweald','Read Ivo’s old packet.',f('tide_packet_read')),step('gullwake','Bring Ivo’s reply to Nell.',f('tide_side_letter'))],
 'gentle-giant':[step('glasswater','After the locks run, ask Daro about the Glassback.',f('tide_glassback_started')),step('glasswater','Remove the old wire from the Glassback.',d('glassback')),step('glasswater','Return to Daro.',f('tide_side_glassback'))],
 'unfinished-lesson':[step('palewind','Ask Venn about Orrin’s old lesson.',f('tide_lesson_started')),step('whitewake','Collect Iria’s lesson note.',f('tide_iria_note')),step('foundry','Collect Mara’s lesson note.',f('tide_mara_note')),step('palewind','Return both notes to Venn’s workbench.',f('tide_side_lesson'))],
 'far-lantern':[step('gullwake','After the coast ending, read Nell’s Lastlight notice.',f('tide_lantern_started')),step('lastlight','Help Osa clear the Lastlight Warden.',d('lastlight-warden')),step('lastlight','Tend the far lantern.',f('tide_side_lantern'))],
 'root-map':[step('hearthcross','Ask Anwen about the borrowed map.',f('root_map_started')),step('waycamp','Ask Fen for his correction.',f('root_note_fen')),step('observatory','Ask Aster for his correction.',f('root_note_aster')),step('gullwake','Ask Nell for her correction.',f('root_note_nell')),step('hearthcross','Return all three corrections to Anwen.',f('root_map_returned'))],
 'root-pip':[step('stillwater','Ask Ada about Pip’s travelling lamp.',f('root_pip_started')),step('copperwood','Read the lamp plan at the lower sluice.',f('root_plan_copper')),step('mothlight','Read the lamp plan in the index room.',f('root_plan_moth')),step('sunkenstair','Read the lamp plan at the upper stair.',f('root_plan_stair')),step('stillwater','Return the three plans to Ada.',f('root_pip_returned'))],
 'root-debt':[step('copperwood','After the aqueduct is safe, ask Bram about the furnace debt.',f('root_debt_started')),step('copperwood','Free the furnace debtor in the counterweight room.',d('furnace-debt')),step('copperwood','Return to Bram at the lower sluice.',f('root_debt_returned'))],
 'root-name':[step('mothlight','Ask Yune about the unsigned record.',f('root_name_started')),step('mothlight','Read the fragment in the index room.',f('root_fragment_index')),step('stillwater','Read the fragment by the camp lamp.',f('root_fragment_camp')),step('crownroot','Read the fragment in the west anchor room.',f('root_fragment_west')),step('mothlight','Return to Yune and read the completed record.',f('root_name_returned'))],
 'root-orchard':[step('orchard','After the Sunken Stair, ask Sena about the shared roots.',f('root_orchard_started')),step('orchard','Clear the Orchard Hunger.',d('orchard-hunger')),step('orchard','Plant the shared seed with Sena.',f('root_seed_planted'))],
 'root-star':[step('stillwater','After the Hearthcross ending, ask Ada about the unbound star.',f('root_star_started')),step('duskobservatory','Quiet the Unbound Star.',d('unbound-star')),step('duskobservatory','Light the free lens.',f('root_lens_lit'))]
};
const encounters=['accord-courier','accord-echo','accord-oath','accord-bridge','accord-tide','accord-garden','accord-chorus','accord-afterglow',...trials.map(x=>x.id)];
const flags=[...new Set([...main,...side].flatMap(x=>[x.flag,x.start]).filter(Boolean).concat(hotspots.map(x=>x.action.flag).filter(Boolean),Object.values(puzzles).map(x=>x.flag),Object.values(choices).map(x=>x.flag)))];
function fresh(){return {version:1,puzzles:Object.fromEntries(Object.values(puzzles).map(p=>[p.id,JSON.parse(JSON.stringify(p.initial))])),choices:{},viewed:[],pending:[],claimed:[],trialWins:Object.fromEntries(trials.map(t=>[t.id,0])),book:{}};}
function currentStep(quest,c){return (quest?.steps||legacySteps[quest?.id]||[]).find(s=>!J.test({campaign:c},s.complete))||null;}
const bounded=(v,max)=>Number.isFinite(Number(v))?Math.min(max,Math.max(0,Math.floor(Number(v)))):0;
const strings=(v,allowed)=>Array.isArray(v)?[...new Set(v.filter(x=>typeof x==='string'&&allowed.includes(x)))]:[];
C.assets.push('accord-chorus');
C.main.push(...main);C.side.push(...side);C.flags.push(...flags);C.encounters.push(...encounters);Object.assign(C.gear,gear);
C.initial=()=>({...old.initial(),accord:fresh()});
C.normalize=value=>{
 const c=old.normalize(value),v=value?.accord&&typeof value.accord==='object'?value.accord:{},a=fresh();
 for(const p of Object.values(puzzles)){
  const raw=v.puzzles?.[p.id];
  if(p.kind==='dials')a.puzzles[p.id]=p.initial.map((_,i)=>bounded(raw?.[i],p.max));
  if(p.kind==='order')a.puzzles[p.id]=strings(raw,p.options.map(x=>x.id)).slice(0,p.solution.length);
  if(p.kind==='match')for(const item of p.labels)if(p.options.some(x=>x.id===raw?.[item.id]))a.puzzles[p.id][item.id]=raw[item.id];
 }
 for(const item of Object.values(choices))if(item.options.some(x=>x.id===v.choices?.[item.id]))a.choices[item.id]=v.choices[item.id];
 a.viewed=strings(v.viewed,moments.map(x=>x.id));
 a.pending=strings(v.pending,[...main,...side].map(x=>x.id)).filter(id=>c.flags[[...main,...side].find(x=>x.id===id).flag]);
 a.claimed=strings(v.claimed,[...main,...side].map(x=>x.flag));
 for(const t of trials){a.trialWins[t.id]=bounded(v.trialWins?.[t.id],9999);delete c.defeated[t.id];}
 const bookIds=[...new Set([...C.encounters,'thorns','sentry','boss'])];
 for(const id of bookIds){const entry=v.book?.[id],won=c.defeated[id]===true;if(won||entry&&typeof entry==='object'&&(entry.seen===true||Number(entry.wins)>0))a.book[id]={seen:true,wins:Math.max(won?1:0,bounded(entry?.wins,9999))};}
 c.accord=a;return c;
};
C.active=(quest,c)=>main.includes(quest)||side.includes(quest)?J.test({campaign:c},quest.requires):old.active(quest,c);
C.next=c=>C.main.find(quest=>!c.flags[quest.flag]&&C.active(quest,c))||main.at(-1);
C.objective=c=>{
 if(!c.flags.root_finished)return old.objective(c);
 const tracked=[...C.main,...C.side].find(quest=>quest.id===c.tracked);
 if(tracked&&!c.flags[tracked.flag]&&C.active(tracked,c))return currentStep(tracked,c)?.text||tracked.text;
 if(c.flags.accord_finished)return 'The Lantern Accord is complete. Visit Roadside Moments, finish earlier work, or ask Ada about the Afterglow at Dusk Observatory.';
 const next=C.next(c);return currentStep(next,c)?.text||next.text;
};
C.accord={version:'1.0.0',title:'The Lantern Accord',chapters:{14:'The letters after the storm',15:'A place at the table'},main,side,quests:[...main,...side],scenes,moments,choices,puzzles,gear,hotspots,trials,contracts:trials,encounters,flags,partyFlags,townFlags,sixFlags,legacySteps,fresh,currentStep,migrations:{fromSaveVersions:[1,2,3,4,5],stateVersion:1,notes:['Earlier quest flags, room progress, and inventory pass through the existing normalizer.','Accord choices, puzzles, scene claims, and viewed moments use known IDs only.','Old finite victories become seen field-guide entries. Repeatable trials never become defeated gates.']}};
})(typeof window!=='undefined'?window:globalThis);
