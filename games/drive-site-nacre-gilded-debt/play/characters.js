/* The live cast viewer uses the same rigs, clothing, and motion as the game. */
(function () {
  'use strict';
  const E = window.My3D2dge, $ = id => document.getElementById(id);
  const cast = [
    { id:'mara',role:'player',name:'Mara Vey',label:'The courier',title:'COURIER OF THE FREE CITY',color:'#314a5c',bio:'She knows the routes that the watch cannot see. Tonight, she carries a blade and an empty satchel. She means to leave with Vale’s ledger.',details:['Indigo hood and short mantle','Gold scarf and brass clasp','Close-fitting boots and a worn satchel'],motions:['idle','walk','run','sneak','listen','survey','take','strike','parry','dodge','climb','jump'] },
    { id:'soren-vale',role:'target',name:'Soren Vale',label:'The levy provost',title:'KEEPER OF THE CITY’S DEBT',color:'#80575b',bio:'Vale counts what the city owes him. His guards clear the court while he reads. The book in his hands can undo his power.',details:['Deep red coat and formal sash','Gold trim and a heavy belt','A ledger held close to his chest'],motions:['idle','walk','alert','strike'] },
    { id:'market-watch',role:'guard',name:'Market watch',label:'The street patrol',title:'CITY WATCH / MARKET DISTRICT',color:'#675e58',bio:'The watch moves through the crowd at an even pace. A quiet street can change in a moment. Watch their heads before you pass.',details:['City colours and shoulder armour','Leather gloves and tall boots','A sword, scabbard, and rank marks'],motions:['idle','walk','alert','run','strike','parry'] },
    { id:'roof-watch',role:'guard',name:'Roof sentinel',label:'The high watch',title:'CITY WATCH / ROOFTOPS',color:'#675e58',bio:'This guard watches the paths above the market. Stone walls give cover. Open roof edges do not.',details:['The same watch uniform','A short ochre shoulder flap','Equipment held close to the body'],motions:['idle','walk','alert','run','strike','parry'] },
    { id:'seal-courier',role:'courier',name:'Seal courier',label:'The service route',title:'MESSENGER TO THE COURT',color:'#b29157',bio:'The court’s messenger carries the seal that opens the service gate. Follow the route. Stay behind the courier when you reach for it.',details:['Ochre cloth and a folded cap','Cross-body strap and sealed satchel','A light build for a long route'],motions:['idle','walk'] },
    { id:'civil-0-0',role:'civilian',name:'Dock worker',label:'The working city',title:'TOWNSPEOPLE / THE QUAY',color:'#847e62',bio:'Work goes on as the watch passes. A swept path, a short rest, and another task. The city’s people give the streets a life of their own.',details:['Green work shirt and a cloth apron','Broad shoulders and short hair','A broom held with both hands'],motions:['idle','walk','talk'] },
    { id:'civil-1-2',role:'civilian',name:'Salt carrier',label:'A moment of rest',title:'TOWNSPEOPLE / THE MARKET',color:'#6d7677',bio:'A brief rest and a drink before the next load. The salt carrier hears more of the city’s news than any court messenger.',details:['A sleeveless tunic in warm ochre','A pale cloth head wrap','A small cup during a quiet pause'],motions:['idle','walk','talk'] },
    { id:'civil-3-5',role:'civilian',name:'Neighbour',label:'The evening crowd',title:'TOWNSPEOPLE / THE FREE CITY',color:'#c8ac88',bio:'A neighbour waits in the square and listens to the news. People move at different speeds. In the crowd, Mara can share their quiet pace.',details:['A soft shawl in pale stone colours','A grey beard and a bare head','Small, calm gestures at rest'],motions:['idle','walk','talk'] }
  ];
  const motions = {
    idle:{label:'At rest',note:'Small shifts of weight, breathing, and role-specific gestures.'},
    walk:{label:'Walk',note:'The step rate follows the character’s speed in the city.'},
    run:{label:'Run',note:'A stronger stride and forward body lean.'},
    sneak:{label:'Move unseen',note:'Mara lowers her body and takes measured steps.'},
    listen:{label:'Listen',note:'A quiet stance for blending into a crowd.'},
    survey:{label:'Survey the city',note:'Mara stops to study the route ahead.'},
    take:{label:'Take an item',note:'A short reach keeps the action close to the body.'},
    alert:{label:'Alert',note:'The guard brings the sword to the ready.'},
    talk:{label:'Talk',note:'An open hand and a small shift of weight.'},
    strike:{label:'Strike',note:'The blade follows the game’s wind-up, hit, and recovery.'},
    parry:{label:'Parry',note:'The arms guard the upper body.'},
    dodge:{label:'Dodge',note:'A quick drop and step to clear an attack.'},
    climb:{label:'Climb',note:'The arms reach as the feet push up the wall.'},
    jump:{label:'Jump',note:'The legs draw up during the jump and return for landing.'}
  };
  let current = cast[0], rig, attack, motion = 'idle', facing = .42, age = 0, pos = [0,0,0];
  let last = 0, running = !matchMedia('(prefers-reduced-motion: reduce)').matches, frames = 0;
  const canvas = $('cast-canvas'), g = canvas.getContext('2d'), small = $('scale-canvas'), sg = small.getContext('2d');
  function makeRig() {
    rig = new E.NacreRig(E.NacreCharacters.options(current.role,current.id,current.color));
    E.NacreMotion.attach(rig,{role:current.role,id:current.id,variant:rig.o.nacreProfile});
    attack = new E.Attack(current.role==='player'?'thrust':'slash',current.role==='player'?{wind:.11,active:.14,recover:.28,hitAt:.16,blade:1,reach:10,z0:17,z1:18,a0:.4,a1:-.25}:{wind:.65,active:.16,recover:.92,range:32,hitAt:.1});
    pos=[0,0,0];age=0;rig.update(1/60,state(0));
  }
  function choose(index) {
    current=cast[index];motion='idle';
    for(const button of $('cast-list').children)button.setAttribute('aria-pressed',String(Number(button.dataset.index)===index));
    $('character-number').textContent=String(index+1).padStart(2,'0')+' / '+String(cast.length).padStart(2,'0');
    $('character-role').textContent=current.title;$('character-name').textContent=current.name;$('character-bio').textContent=current.bio;
    $('character-details').replaceChildren(...current.details.map(detail=>{const li=document.createElement('li');li.textContent=detail;return li;}));
    $('motion-select').replaceChildren(...current.motions.map(key=>{const option=document.createElement('option');option.value=key;option.textContent=motions[key].label;return option;}));
    canvas.setAttribute('aria-label','Animated view of '+current.name);small.setAttribute('aria-label',current.name+' at game scale');
    setLabels();makeRig();
  }
  function idleLabel(){return current.role==='target'?'Read the ledger':current.role==='guard'?'Keep watch':current.role==='courier'?'Wait':current.id==='civil-0-0'?'Sweep the path':current.id==='civil-1-2'?'Take a drink':'At rest';}
  function setLabels(){
    const label=motion==='idle'?idleLabel():motions[motion].label;
    $('motion-label').textContent=label;
    const option=$('motion-select').querySelector('option[value="idle"]');if(option)option.textContent=idleLabel();
    $('motion-note').textContent=motion==='idle'&&current.role==='target'?'Vale holds the ledger while he reads.':motion==='idle'&&current.role==='guard'?'Small turns of the head reveal where the watch is looking.':motion==='idle'&&current.id==='civil-0-0'?'Both hands guide the broom across the ground.':motion==='idle'&&current.id==='civil-1-2'?'The cup follows the hand through a short drink.':motions[motion].note;
  }
  function state(dt) {
    let speed=motion==='walk'?(current.role==='player'?54:current.role==='target'?17:current.role==='guard'?27:current.role==='courier'?23:12):motion==='run'?(current.role==='player'?107:76):motion==='sneak'?32:0;
    const crouch=motion==='sneak'||motion==='listen', air=motion==='jump'&&age%2.2<.82, climbing=motion==='climb';
    pos[0]+=Math.cos(facing)*speed*dt;pos[1]+=Math.sin(facing)*speed*dt;
    let z=0,vz=0;if(air){const t=(age%2.2)/.82;z=Math.sin(Math.PI*t)*14;vz=Math.cos(Math.PI*t)*52;}
    if(motion==='strike'){if(!attack.busy&&age%2.5<.13)attack.start();attack.update(dt);}else attack.cancel();
    return {x:pos[0],y:pos[1],z,vx:Math.cos(facing)*speed,vy:Math.sin(facing)*speed,vz:climbing?38:vz,facing,
      mode:'play',role:current.role,dead:false,air,climb:climbing,mantle:climbing&&age%3>2.5?(age%3-2.5)*2:0,
      vault:air?.7:0,crouch,pose:motion==='parry'?'block':crouch?'crouch':null,parry:motion==='parry'?1:0,
      dodge:motion==='dodge'&&age%1.4<.32?.32-age%1.4:0,attack:attack.state,
      alert:motion==='alert',stance:motion==='alert'?'ready':null,
      interaction:motion==='listen'?'listen':motion==='survey'?'survey':motion==='take'?'seal':motion==='talk'?'talk':current.role==='target'&&motion==='idle'?'ledger':null,
      hold:['listen','survey','take','talk'].includes(motion)?.8:0,variant:rig.o.nacreProfile,preview:true};
  }
  function floor(ctx,W,H,view,origin,large) {
    ctx.clearRect(0,0,W,H);ctx.imageSmoothingEnabled=false;
    const [cx,cy]=origin,unit=large?Math.min(W,H)*.29:40;
    ctx.save();ctx.translate(cx,cy);ctx.strokeStyle=large?'#829b8633':'#8aa58f33';ctx.lineWidth=1;
    for(const radius of [unit*.62,unit]){ctx.beginPath();ctx.ellipse(0,0,radius,radius*.31,0,0,Math.PI*2);ctx.stroke();}
    if(large){ctx.beginPath();ctx.moveTo(-unit*1.25,0);ctx.lineTo(unit*1.25,0);ctx.moveTo(0,-unit*.39);ctx.lineTo(0,unit*.39);ctx.stroke();
      for(let k=0;k<8;k++){const a=k*Math.PI/4;ctx.fillStyle='#d0b77855';ctx.fillRect(Math.cos(a)*unit-1,Math.sin(a)*unit*.31-1,2,2);}}
    ctx.fillStyle='#09202455';ctx.beginPath();ctx.ellipse(0,1,view.scale*5.5,view.scale*1.8,0,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  function draw() {
    const rect=canvas.getBoundingClientRect(), W=Math.max(240,Math.round(rect.width)),H=Math.max(300,Math.round(rect.height));
    if(canvas.width!==W||canvas.height!==H){canvas.width=W;canvas.height=H;}
    const view=new E.View('cast','Nacre cast',35,30,Math.min(H/49,W/42,10),1),origin=[W*.5,H*.74];
    floor(g,W,H,view,origin,true);rig.draw(g,origin[0],origin[1]-rig.z*view.scale,view);
    const sr=small.getBoundingClientRect(),sw=Math.max(100,Math.round(sr.width)),sh=Math.max(80,Math.round(sr.height));if(small.width!==sw||small.height!==sh){small.width=sw;small.height=sh;}const dpr=Math.min(devicePixelRatio||1,3),screenScale=Math.max(1,Math.min(Math.floor(innerHeight*dpr/325),Math.floor(innerWidth*dpr/580)))/dpr;const sv=new E.View('cast-small','Game scale',35,40,1.4*screenScale,1),so=[sw/2,sh-12];floor(sg,sw,sh,sv,so,false);rig.draw(sg,so[0],so[1]-rig.z*sv.scale,sv);
    if(location.hostname==='terminal.local'&&frames%30===0){let qa=$('cast-qa-state');if(!qa){qa=document.createElement('pre');qa.id='cast-qa-state';qa.hidden=true;document.body.appendChild(qa);}qa.textContent=JSON.stringify({character:current.id,role:current.role,motion,clip:rig.motionName,weight:rig.motionWeight,time:rig.motionTime,running,finite:Object.values(rig.J).filter(Array.isArray).every(p=>p.every(Number.isFinite)),frames});}
  }
  function frame(time){const dt=Math.min(.04,Math.max(0,(time-last)/1000));last=time;if(running&&!document.hidden){age+=dt;rig.update(dt,state(dt));}draw();frames++;requestAnimationFrame(frame);}
  try {
    cast.forEach((item,index)=>{const button=document.createElement('button');button.className='cast-choice';button.dataset.index=index;button.setAttribute('aria-pressed',index===0?'true':'false');const strong=document.createElement('strong'),sub=document.createElement('span');strong.textContent=item.name;sub.textContent=item.label;button.append(strong,sub);button.onclick=()=>choose(index);$('cast-list').appendChild(button);});
    $('motion-select').onchange=e=>{motion=e.target.value;age=0;setLabels();};
    $('motion-toggle').onclick=()=>{running=!running;$('motion-toggle').textContent=running?'Pause motion':'Play motion';$('motion-toggle').setAttribute('aria-pressed',String(!running));};
    $('turn-left').onclick=()=>{facing-=Math.PI/4;if(!running)rig.update(1/60,state(0));};
    $('turn-right').onclick=()=>{facing+=Math.PI/4;if(!running)rig.update(1/60,state(0));};
    if(!running){$('motion-toggle').textContent='Play motion';$('motion-toggle').setAttribute('aria-pressed','true');}
    choose(0);requestAnimationFrame(frame);
  }catch(error){$('cast-error').hidden=false;$('cast-error').textContent='The characters could not load. '+error.message;console.error(error);}
})();
