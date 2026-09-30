/**
 * Cyberdyne continuation. Strata keeps its movement, physics world, and single fixed clock;
 * the kit supplies the renderer, the loop, and every input device.
 *
 * mount(kit, config, shell) builds one mission (restoring shell.checkpoint when there is one)
 * and returns its controls. The page (main.js) owns the menus, settings, records, and restarts.
 */
import * as THREE from 'three/webgpu';
import { FpsGame } from '../fps/FpsGame.js';
import { Vitals, Weapon } from '../fps/combat.js';
import { RAPIER } from '../engine/PhysicsWorld.js';
import { Scope } from '../engine/Scope.js';
import { yardLevel, registerYardArt } from './level.js';
import { PoliceLine } from './local-ai.js';
import { SceneArt } from './art.js';
import { Effects } from './effects.js';
import { DestructibleFleet } from './destruction.js';
import { T800Vision } from './vision.js';
import { WaveDirector, wavePlan } from './waves.js';
import { AirUnit } from './air-unit.js';
import { MINIGUN, DIFFICULTY, DIFFICULTY_ORDER, advanceBarrels, cleanSaved, formatTime } from './rules.js';

const _muzzle=new THREE.Vector3(),_landing=new THREE.Vector3();

export async function mount(kit,config,shell){
  const {hud,sound}=shell;
  const scope=new Scope();
  let noticeLeft=0,subTime=0;
  const notice=text=>{hud.text('notice',text);shell.status(text);noticeLeft=5;};
  const subtitle=(text,seconds=4)=>{hud.text('subtitle',text);subTime=seconds;};
  hud.toggle('scene-hud','is-menu',true);hud.text('notice','');hud.text('subtitle','');
  const saved=shell.checkpoint??{},restored=!!shell.checkpoint;
  const counters=cleanSaved(saved);
  let game,art,effects,fleet,police,vision,director,air,started=false,disposing=false,finished=false;
  let rounds=counters.rounds,hits=counters.hits,violations=counters.violations,reboots=counters.reboots,openingTime=counters.openingTime;
  let normalFov=shell.prefs().fov,lastTarget=null,lastPrompt=null,respawnKind='fall',wasSpotted=false,gasWarned=false,unlockedTime=0;
  let kick=0,hitTime=0,hurtTime=0,quietTime=0,warningTime=0,blockTime=0,resupplyTime=0,rumbleTime=0;
  // Records count a run at the lowest officer pressure it used, so switching late cannot inflate them.
  let lowestPressure=Math.max(0,DIFFICULTY_ORDER.indexOf(typeof saved.difficulty==='string'?saved.difficulty:shell.prefs().difficulty));
  const pressureName=()=>DIFFICULTY_ORDER[Math.min(lowestPressure,Math.max(0,DIFFICULTY_ORDER.indexOf(shell.prefs().difficulty)))];
  const barrel={spin:0,heat:0,overheated:false,firing:false};
  let pips=[];
  try{
    const vitals=new Vitals(config.maxHealth??100),weapon=new Weapon({...MINIGUN,...config.weapon});
    if(typeof saved.health==='number'&&typeof saved.armor==='number')try{vitals.restore({health:saved.health,armor:saved.armor});}catch{notice('Health data was reset.');}
    if(!vitals.alive)vitals.reset();
    if(typeof saved.ammo==='number'&&typeof saved.reserve==='number')try{weapon.restore({ammo:saved.ammo,reserve:saved.reserve});}catch{notice('Ammo data was reset.');}
    const snapshot=()=>({version:3,health:vitals.health,armor:vitals.armor,ammo:weapon.ammo,reserve:weapon.reserve,rounds,hits,violations,reboots,elapsed:director.elapsed,survival:director.snapshot(),vehicles:fleet?.snapshot()??[],vision:vision?.enabled??false,partsBroken:fleet?.partBreaks??0,openingTime,searchlights:air?.lampsBroken??0,difficulty:pressureName(),savedAt:Date.now()});
    const checkpoint=(silent=false)=>{
      if(finished||disposing||!director)return false;
      const ok=shell.saveCheckpoint(snapshot());
      if(!silent)notice(ok?'Checkpoint saved on this device.':'The checkpoint could not be saved here (browser storage is blocked). Use Export save.');
      return ok;
    };
    const progress=()=>shell.onProgress(pressureName(),{wavesCleared:director.cleared,vehicles:director.totalDisabled,parts:fleet?.partBreaks??0,openingTime});
    const resupply=(automatic=false)=>{
      if(!automatic&&resupplyTime>0){notice(`Support station ready in ${Math.ceil(resupplyTime)} seconds.`);return false;}
      weapon.reset();if(automatic)vitals.heal(32);else vitals.reset();barrel.heat=0;barrel.overheated=false;resupplyTime=15;sound.cue('reload');
      if(!automatic)subtitle('SUPPORT STATION / INTEGRITY AND AMMO RESTORED',3);
      return true;
    };
    const setPips=()=>{
      pips=[...fleet.cars.values()].map((v,i)=>{const n=document.createElement('span');n.textContent=String(i+1).padStart(2,'0');return {v,n,done:false};});
      hud.node('targets').replaceChildren(...pips.map(p=>p.n));
    };
    const buildWave=(plan,restoring=false)=>{
      if(!restoring){police.clear();fleet.clear();effects.clearBurns();}
      for(const spec of plan){const existing=restoring&&spec.wave===0?game.runtime.physics.entities.get(spec.id):null;const raw=restoring&&Array.isArray(saved.vehicles)?saved.vehicles.find(v=>v&&v.id===spec.id):null;fleet.add(spec,raw,existing);}
      police.addWave(plan);setPips();
      if(!restoring){resupply(true);subtitle(`WAVE ${director.wave} / ${plan.length} RESPONSE VEHICLES`,4);sound.cue('wave');air.beginWave(director.wave);}
    };
    director=new WaveDirector(saved.survival??{}, {
      cleared:wave=>{
        resupply(true);sound.cue('success');air?.endWave();
        let line=wave===0?'ORIGINAL SCENE COMPLETE / POLICE REINFORCEMENTS INBOUND':`WAVE ${wave} CLEARED / REINFORCEMENTS INBOUND`;
        if(wave===0&&!openingTime){
          openingTime=Math.max(.1,director.elapsed);
          const r=progress();line=`OPENING LINE CLEARED IN ${formatTime(openingTime)}${r?.improved.includes('opening')?' / NEW BEST':''} / REINFORCEMENTS INBOUND`;
        }else progress();
        subtitle(line,5);
        checkpoint(true);
      },spawn:plan=>buildWave(plan)
    });
    const cast=ray=>game.runtime.physics.world.castRay(ray,weapon.spec.range,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,game.player.collider,game.player.body);
    const describe=hit=>{
      if(!hit)return null;const handle=hit.collider.handle,id=game.runtime.physics.owners.get(handle),part=fleet?.partFor(hit),shield=police?.shields.get(handle),human=police?.officers.find(a=>a.id===id);
      return {id,part,shield,human,air:id==='air-unit'?air:null,distance:hit.timeOfImpact,hit};
    };
    const returnToLab=()=>{respawnKind='lab';game.player.respawn();};
    const beforeStep=(dt,g)=>{
      quietTime+=dt;vitals.tick(dt);weapon.tick(dt);resupplyTime=Math.max(0,resupplyTime-dt);
      kick=Math.max(0,kick-dt*2);hitTime=Math.max(0,hitTime-dt);hurtTime=Math.max(0,hurtTime-dt);warningTime=Math.max(0,warningTime-dt);blockTime=Math.max(0,blockTime-dt);rumbleTime=Math.max(0,rumbleTime-dt);
      lowestPressure=Math.min(lowestPressure,Math.max(0,DIFFICULTY_ORDER.indexOf(shell.prefs().difficulty)));
      if(quietTime>5)vitals.heal(dt*1.5);
      if(g.input.consume('vision')){const enabled=vision.toggle();sound.cue('scan');subtitle(enabled?'T-800 OPTICS / LIVE COMPONENT ANALYSIS':'NORMAL OPTICS',1.8);}
      if(g.input.consume('lab'))returnToLab();
      const zooming=g.input.down('zoom');
      g.player.motor.settings.fov=normalFov/(zooming?1.8:1);
      const held=g.input.down('fire'),pressed=g.input.consume('fire');
      barrel.firing=held&&barrel.spin>=.8&&!weapon.reloading&&!barrel.overheated&&weapon.ammo>0&&warningTime===0;
      const ready=advanceBarrels(barrel,held&&!weapon.reloading&&weapon.ammo>0,dt);
      if(g.input.consume('reload')&&weapon.reload()){sound.cue('reload');subtitle('REPLACING AMMUNITION BELT',1.4);}
      if(!g.player.held&&ready&&(held||pressed)&&!weapon.reloading){
        const ray=g.player.ray(),spread=zooming?.0008:.0018;
        ray.dir=new THREE.Vector3(ray.dir.x+(Math.random()-.5)*spread,ray.dir.y+(Math.random()-.5)*spread,ray.dir.z+(Math.random()-.5)*spread).normalize();
        const hit=cast(ray),target=describe(hit);
        if(target?.human){
          if(blockTime===0){violations=Math.min(1000000,violations+1);sound.cue('warning');}blockTime=.7;warningTime=.18;barrel.firing=false;
        }else if(weapon.fire(pressed,held)){
          warningTime=0;barrel.firing=true;kick=.035;rounds=Math.min(1000000,rounds+1);
          const raw=ray.pointAt(hit?.timeOfImpact??weapon.spec.range),point=new THREE.Vector3(raw.x,raw.y,raw.z);g.view.camera.updateMatrixWorld();
          const muzzle=g.view.camera.localToWorld(_muzzle.set(.29,-.17,-1.68));effects.tracer(muzzle,point);effects.shot(g.view.camera);
          g.player.shake=Math.max(g.player.shake,.35);
          if(rumbleTime===0){kit.input.rumble(.22,70);rumbleTime=.11;}
          if(hit){
            if(fleet.hit(hit,weapon.spec.damage,point,ray.dir)||police.hitShield(hit,weapon.spec.damage,point,ray.dir)||air.hit(hit,weapon.spec.damage,point)){hits=Math.min(1000000,hits+1);hitTime=.1;}
            else effects.impact(point,'concrete');police.suppress(point);
          }
        }
      }
      if(weapon.ammo===0&&weapon.reserve>0&&!weapon.reloading){weapon.reload();sound.cue('reload');}
      fleet.step(dt);police.step(dt);air.step(dt,g.player.current);
    };
    const afterStep=(dt,g)=>{
      if(g.player.current.y<5.3){respawnKind='fall';g.player.respawn();}
      director.step(dt,fleet.remaining);
      if(air.spotted&&!wasSpotted){sound.cue('spotted');kit.input.rumble(.3,90);}
      wasSpotted=air.spotted;
    };
    const render=(dt,g,realDt)=>{
      // Before the first start the menu scene still animates; after that, a pause freezes it.
      const visualDt=started?dt:Math.min(.04,realDt);
      noticeLeft=Math.max(0,noticeLeft-realDt);if(noticeLeft===0)hud.text('notice','');
      subTime=Math.max(0,subTime-dt);if(subTime===0)hud.text('subtitle','');
      const firing=g.running&&barrel.spin>=.8&&g.input.down('fire')&&!weapon.reloading&&!barrel.overheated&&weapon.ammo>0&&warningTime===0;
      if(!started)fleet.time+=visualDt; // roof lights flash behind the title menu too
      art.render(visualDt,{spin:barrel.spin,firing,kick});air.render(visualDt);effects.render(visualDt);fleet.render();police.render(dt);
      sound.update(dt,barrel.spin,firing,g.running,fleet.remaining,air.presence);
      const total=fleet.cars.size,disabled=total-fleet.remaining;
      hud.text('health',String(Math.ceil(vitals.health)).padStart(3,'0'));hud.width('health-fill',vitals.health/vitals.maxHealth*100);
      hud.text('system-state',vitals.grace>.5?'REBOOTED':vitals.health<30?'CRITICAL':'ONLINE');
      hud.text('ammo',String(weapon.ammo).padStart(3,'0'));hud.text('reserve',String(weapon.reserve).padStart(4,'0'));hud.text('mission-time',formatTime(director.elapsed));
      hud.text('remaining',`${String(disabled).padStart(2,'0')} / ${String(total).padStart(2,'0')}`);hud.width('mission-progress',total?disabled/total*100:0);
      hud.text('wave-label',director.wave?`WAVE ${director.wave}`:'OPENING SCENE');
      hud.text('wave-status',director.phase==='break'?`NEXT WAVE IN ${Math.ceil(director.countdown)} S`:`${fleet.remaining} VEHICLES ACTIVE${air.hunting&&air.lampAlive?' / AIR ONE':''}`);
      hud.width('heat-fill',barrel.heat*100);hud.toggle('heat-fill','hot',barrel.heat>.75);hud.text('spin-value',`${Math.round(barrel.spin*100)}%`);
      hud.text('weapon-state',weapon.reloading?`BELT CHANGE ${Math.round(weapon.reloadProgress*100)}%`:barrel.overheated?'COOLING / RELEASE TRIGGER':weapon.ammo===0&&weapon.reserve===0?'AMMO EMPTY / SUPPORT STATION':firing?'FIRING':barrel.spin>.05?'BARRELS ROTATING':'M134 / READY');
      hud.toggle('crosshair','hit',hitTime>0);hud.toggle('crosshair','blocked',warningTime>0);hud.opacity('damage',hurtTime>0?.75:0);hud.hidden('protection',warningTime<=0);
      hud.text('objective',director.phase==='break'?'Line cleared. Stay in the scene. Reinforcements are on the way.':director.wave?`Disable the wave ${director.wave} vehicles. Use cover. Keep officers alive.`:'Disable the 8 police vehicles. The game continues after this scene.');
      const prompt=g.running?g.runtime.prompt:'';
      hud.text('prompt',prompt?`${shell.label('interact')} · ${prompt}`:'');
      if(prompt!==lastPrompt){lastPrompt=prompt;kit.touch?.setShown('interact',!!prompt);}
      for(const p of pips)if(p.done!==p.v.disabled){p.done=p.v.disabled;p.n.classList.toggle('done',p.done);}
      lastTarget=describe(cast(g.player.ray()));
      const part=lastTarget?.part,airTarget=!!lastTarget?.air&&air.hunting&&air.lampAlive;
      hud.hidden('target-readout',!part&&!airTarget);
      if(part){hud.text('target-name',`${part.spec.label} / ${part.state.stage.toUpperCase()}`);hud.width('target-fill',part.state.hp/part.state.max*100);}
      else if(airTarget){hud.text('target-name','AIR ONE / SEARCHLIGHT LAMP');hud.width('target-fill',air.lampHp/air.lampMax*100);}
      // Gamepad and touch aim: the view turns slower over a live target. The aim ray itself never moves.
      const assist=kit.input.source!=='keyboard'&&((part&&!part.vehicle.disabled)||airTarget);
      g.player.lookScale=(g.input.down('zoom')?1/1.8:1)*(assist?.55:1);
      hud.hidden('spotted',!(g.running&&air.spotted));
      const gas=effects.gasAt(g.view.camera.position);
      hud.opacity('gas-haze',vision.enabled?0:gas*.72);
      // Running with a mouse but without pointer lock (refused, or re-lock too soon after Esc): say how to get it back.
      unlockedTime=g.running&&kit.input.source==='keyboard'&&!g.locked?unlockedTime+realDt:0;
      hud.hidden('lock-hint',unlockedTime<.7);
      vision.render(dt,{target:lastTarget,director,health:vitals.health,zoom:g.input.down('zoom'),zoomKey:shell.label('zoom'),gas});
    };
    game=new FpsGame(kit,yardLevel(config),{
      notice,
      mode:running=>{
        if(disposing)return;
        hud.toggle('scene-hud','is-menu',!running);
        if(running&&!started){started=true;game.player.pitch=-.25;game.player.render(1,0);subtitle(`DISABLE VEHICLES / ${shell.label('vision')}: T-800 VISION / ${shell.label('zoom')}: ZOOM`,5);}
        if(!running){barrel.firing=false;if(started)checkpoint(true);}
        shell.onMode(running,started);
      },
      configure:({prefabs,behaviors})=>{registerYardArt(prefabs);behaviors.register('board-car',()=>{},()=>({prompt:()=>resupplyTime>0?`Support station / ${Math.ceil(resupplyTime)} s`:'Repair and reload',interact:()=>resupply(false)}));},
      beforeStep,afterStep,render
    });
    scope.own(()=>game.dispose());
    art=new SceneArt(game,scope);effects=new Effects(art);
    effects.onGasLanded=()=>{sound.cue('hiss');if(!gasWarned){gasWarned=true;subtitle(`TEAR GAS ON THE TERRACE / ${shell.label('vision')}: T-800 OPTICS FILTER IT`,4.5);}};
    fleet=new DestructibleFleet(game,art,effects,scope,{
      disabled:(v,restoredCar)=>{
        police?.parked(v);police?.retreatVehicle(v.id);effects.destroy(v,restoredCar);
        if(!restoredCar){director.disabled();sound.cue('explosion');subtitle(`${v.info.label} ${v.label} DISABLED / OFFICERS WITHDRAW`,2.3);kit.input.rumble(.6,220);game.player.shake=Math.max(game.player.shake,.8);}
      },parked:v=>police?.parked(v),suppress:(p,id)=>police?.suppress(p,id),sound:kind=>sound.cue(kind),
      broken:p=>{if(p.spec.kind==='door')subtitle(`${p.spec.label} LOST / COVER REMOVED`,1.2);}
    });
    // Loose rigid-body debris is the main physics cost in long runs: 128 pieces at high, fewer on low tiers.
    fleet.maxDebris=kit.detail(128,32);
    police=new PoliceLine(game,fleet,art,effects,{
      returnFire:(from,to,type)=>{const target=to.clone();if(type!=='marksman'){target.x+=(Math.random()-.5)*1.5;target.y+=(Math.random()-.5)*.8;}effects.tracer(from,target,type==='marksman'?'#ff745b':'#a4d5fa');sound.cue('impact');},
      damage:amount=>{
        quietTime=0;const result=vitals.damage(amount,.12);
        if(result.healthLost>0){hurtTime=.14;game.player.shake=Math.max(game.player.shake,1);kit.input.rumble(.45,110);}
        if(result.killed){respawnKind='reboot';game.player.respawn();}
      },
      gas:(from,to)=>{
        // Lobbed onto the terrace near the player, never past its edges.
        _landing.set(Math.max(-18.5,Math.min(18.5,to.x+(Math.random()-.5)*4)),6.2,Math.max(-5.3,Math.min(3.2,to.z+(Math.random()-.5)*3)));
        if(effects.canister(from,_landing))sound.cue('launch');
      },
      pressure:()=>{
        const d=DIFFICULTY[shell.prefs().difficulty]??DIFFICULTY.standard,spot=air?.spotted;
        return {accuracy:d.accuracy*(spot?1.5:1),damage:d.damage,aim:spot?.55:1};
      },
      notice:text=>subtitle(text,1.8)
    });scope.own(()=>police.dispose());
    air=new AirUnit(game,art,effects,scope,{
      inbound:()=>subtitle('AIR ONE INBOUND / SEARCHLIGHT WILL EXPOSE YOU ON THE TERRACE',4),
      blinded:()=>{sound.cue('glass');subtitle('AIR ONE SEARCHLIGHT DISABLED / AIRCRAFT WITHDRAWS',3);kit.input.rumble(.35,120);}
    });
    // A saved later wave does not keep the initial placeholder vehicles or actors.
    if(director.wave>0){
      const p=game.runtime.physics;for(const [id,e] of [...p.entities])if(id.startsWith('patrol-')||id.startsWith('officer-')){for(const c of e.colliders)p.owners.delete(c.handle);p.world.removeRigidBody(e.body);e.root.removeFromParent();p.entities.delete(id);}
    }
    buildWave(wavePlan(director.wave),true);
    fleet.partBreaks=Number.isSafeInteger(saved.partsBroken)?Math.max(0,Math.min(100000000,saved.partsBroken)):0;
    air.lampsBroken=counters.searchlights;
    if(director.phase==='active')air.beginWave(director.wave,true);
    vision=new T800Vision(game,fleet,police,scope,{kit,hud,effects,air});vision.set(saved.vision===true);
    game.player.pitch=-.25;game.player.render(1,0);
    game.player.onRespawn=()=>{
      const kind=respawnKind;respawnKind='fall';
      barrel.spin=barrel.heat=0;barrel.overheated=barrel.firing=false;game.player.pitch=-.25;
      if(kind==='reboot'){
        vitals.reset();vitals.grace=2.5;weapon.reset();reboots=Math.min(1000000,reboots+1);
        sound.cue('reboot');kit.input.rumble(1,380);game.player.shake=1.4;
        notice('SYSTEM FAILURE / REBOOTED IN THE LAB. Integrity and ammo restored. Wave and vehicle damage are kept.');
      }else if(resupplyTime===0){resupply(false);notice('Returned to the lab. Integrity and ammo restored.');}
      else notice(`Returned to the lab. The support station is ready in ${Math.ceil(resupplyTime)} s.`);
    };
    kit.touch?.setShown('interact',false);
    // Compile the pipelines of things that only appear later (particles, tracers, gas) before play.
    try{
      const later=effects.prewarm().filter(o=>!o.visible);for(const o of later)o.visible=true;
      await kit.renderer.compileAsync(game.view.scene,game.view.camera);
      for(const o of later)o.visible=false;
    }catch(error){console.warn('[t2] prewarm skipped:',error);}
    const summary=()=>`wave ${director.wave} · ${formatTime(director.elapsed)} · integrity ${Math.ceil(vitals.health)}%`;
    return {
      game,restored,
      get started(){return started;},
      get running(){return game.running;},
      get openingComplete(){return director.openingComplete;},
      play(){game.play();},
      pause(){game.pause();},
      frame(dt){game.frame(dt);},
      applyPrefs(p){normalFov=p.fov;game.player.motor.settings.fov=p.fov;game.player.motor.settings.headBob=p.headBob;sound.volume=p.volume;},
      checkpoint,snapshot,summary,
      returnToLab(){if(started&&!finished)returnToLab();},
      endRun(){
        if(!director.openingComplete){notice('Clear the opening police line before you end the run.');return null;}
        const result={difficulty:pressureName(),wavesCleared:director.cleared,vehicles:director.totalDisabled,elapsed:director.elapsed,rounds,hits,accuracy:rounds?hits/rounds:0,parts:fleet.partBreaks,reboots,violations,searchlights:air.lampsBroken,openingTime,humanCasualties:0,finishedAt:new Date().toISOString(),checkpoint:snapshot()};
        finished=true;sound.cue('success');
        return result;
      },
      dispose(){disposing=true;scope.dispose();},
    };
  }catch(error){disposing=true;try{scope.dispose();}catch(disposeError){console.error(disposeError);}throw error;}
}
