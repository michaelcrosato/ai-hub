/* BRASSWING — authored sortie data. All names, events, and balance are original. */
(() => {
  'use strict';
  const frames = [
    {id:'kite',name:'KITE',code:'K-17',role:'MULTIROLE',hp:100,speed:202,power:1,price:0,desc:'Twin cannon · balanced handling'},
    {id:'needle',name:'NEEDLE',code:'N-04',role:'INTERCEPTOR',hp:82,speed:244,power:1.18,price:300,desc:'Focused cannon · fast response'},
    {id:'manta',name:'MANTA',code:'M-32',role:'STRIKE FIGHTER',hp:124,speed:173,power:.92,price:400,desc:'Wide cannon · reinforced hull'}
  ];
  const pilots = [
    {id:'mara',name:'MARA VENN',label:'ENGINEER',note:'Recovery lasts 2.3 seconds instead of 3.6.',short:'Faster recovery',recovery:2.3,ammo:0,cells:4},
    {id:'ivo',name:'IVO ROOK',label:'WEAPONS OFFICER',note:'Carries 4 more rounds for the selected special weapon.',short:'+4 special rounds',recovery:3.6,ammo:4,cells:4},
    {id:'sera',name:'SERA HALE',label:'TEST PILOT',note:'Main gun upgrades need 3 power cells instead of 4.',short:'Faster gun upgrades',recovery:3.6,ammo:0,cells:3}
  ];
  const weapons = [
    {id:'tracker',name:'TRACKER',symbol:'»',price:900,ammo:12,desc:'Guided missile pair. Finds air or ground targets.'},
    {id:'lance',name:'LANCE',symbol:'═',price:700,ammo:10,desc:'Piercing forward beam. Breaks through armor.'},
    {id:'undertow',name:'UNDERTOW',symbol:'⌄',price:800,ammo:14,desc:'Three diving rockets. Clears surface defenses.'}
  ];
  const difficulty = {
    cadet:{name:'CADET',speed:.82,damage:14,hp:.85,grace:1.5,score:.75,note:'Slower enemy fire. Reduced damage. One extra pulse.'},
    standard:{name:'STANDARD',speed:1,damage:22,hp:1,grace:1.12,score:1,note:'A second hit during recovery causes double damage.'},
    ace:{name:'ACE',speed:1.18,damage:25,hp:1.15,grace:.8,score:1.4,note:'A second hit during recovery is fatal. Faster enemy fire.'}
  };
  const events=[];
  const add=(t,type,data={})=>events.push({t,type,...data});
  const flight=(t,type,y,n=4,dy=0,gap=.55)=>add(t,'flight',{enemy:type,y,n,dy,gap});
  add(0,'radio',{speaker:'CONTROL',text:'Glass Tide is clear to launch. Bring the coast home.'});
  add(3,'hint',{text:'MOVE: WASD / ARROWS     SPECIAL: X     PULSE: C',seconds:8});
  flight(5,'scout',122,4,18); flight(11,'scout',235,4,-15);
  add(18,'radio',{speaker:'MARA',text:'Power cells improve your cannon. Collect the blue diamonds.'});
  flight(18,'scout',150,5,18); add(22,'turret',{y:296});
  flight(27,'interceptor',88,3,55,.9); add(30,'relay',{y:279});
  flight(35,'scout',225,5,-16); add(37,'turret',{y:300});
  add(43,'bomber',{y:135}); flight(45,'interceptor',245,3,-45,.75);
  add(50,'pickup',{kind:'repair',y:180});
  add(53,'sector',{sector:1,title:'02 / THE IRON CHANNEL',subtitle:'SURFACE DEFENSES AHEAD'});
  add(55,'radio',{speaker:'CONTROL',text:'Surface batteries ahead. Use special weapons to reach them.'});
  add(57,'missileBoat',{y:292}); add(62,'turret',{y:300});
  flight(59,'scout',155,5,18); flight(65,'interceptor',95,4,45,.9);
  add(70,'relay',{y:276}); add(71,'missileBoat',{y:292});
  add(76,'miniboss');
  add(77,'radio',{speaker:'CONTROL',text:'Escort gunship ahead. Its nose gun tracks your position.'});
  flight(84,'scout',92,4,15); flight(93,'interceptor',118,3,52,1.2);
  add(105,'radio',{speaker:'CONTROL',text:'Supply corridor secured. Refit in the air. Then press inland.'});
  add(106,'checkpoint',{label:'IRON CHANNEL'});
  add(107,'pickup',{kind:'repair',y:153}); add(109,'pickup',{kind:'ammo',y:218}); add(111,'pickup',{kind:'power',y:120});
  add(115,'sector',{sector:2,title:'03 / BREAKWATER APPROACH',subtitle:'DISABLE THE SIEGE CARRIER'});
  flight(117,'interceptor',103,4,43,.85); add(120,'bomber',{y:120});
  add(124,'relay',{y:275}); add(126,'missileBoat',{y:289});
  flight(129,'scout',223,5,-20); add(132,'turret',{y:297});
  add(134,'mines',{n:4}); add(136,'bomber',{y:94});
  flight(140,'interceptor',117,4,40,.8); add(143,'missileBoat',{y:291});
  flight(146,'scout',226,5,-18); add(150,'turret',{y:300});
  add(153,'mines',{n:4}); flight(155,'interceptor',90,3,66,1);
  add(161,'radio',{speaker:'CONTROL',text:'That is Breakwater. Remove both weapon pods to expose the reactor.'});
  add(162,'pickup',{kind:'repair',y:192}); add(164,'pickup',{kind:'ammo',y:130});
  add(167,'checkpoint',{label:'BREAKWATER'});
  add(169,'boss');
  window.BrasswingData={frames,pilots,weapons,difficulty,events:events.sort((a,b)=>a.t-b.t),budget:2200,bossTime:169};
})();
