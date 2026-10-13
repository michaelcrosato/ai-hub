/* Optional street activities. Progress shares the original local save slot. */
(function(root){
    'use strict';
    const D=root.HARBOR_DATA,E=root.My3D2dge,P=E.px,$=id=>document.getElementById(id);
    const safe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const shuffled=a=>{const out=a.slice();for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;};
    const sec=n=>Math.floor(n/60)+':'+String(Math.floor(n%60)).padStart(2,'0');
    class HarborActivities{
        constructor(game){this.g=game;this.active=null;this.mini=null;this.hudTime=0;}
        reset(saved){this.mini=null;const a=saved?.active;this.active=a&&D.activityDefs.some(d=>d.id===a.id)&&Array.isArray(a.items)?JSON.parse(JSON.stringify(a)):null;this.updateHUD();}
        export(){return {active:this.active?JSON.parse(JSON.stringify(this.active)):null};}
        def(id=this.active?.id){return D.activityDefs.find(a=>a.id===id);}
        records(){return this.g.case.flags.sideRecords||{};}
        isCarrying(){return this.active?.id==='lunch'&&this.active.held;}
        offer(id){
            const g=this.g,d=this.def(id),record=this.records()[id],same=this.active?.id===id;
            const paid=g.case.flags['side-'+id],cost=id==='tinfish'&&g.case.flags.tinPlayed?10:0;
            g.showModal(d.place.toUpperCase(),d.name,`<p>${safe(d.desc)}</p><p class="text-small muted">${paid?'Keepsake earned. Play again to improve your record.':`First completion: ¥${d.reward} and ${safe(d.keepsake.toLowerCase())}.`}${record?`<br>Best: ${record.kind==='score'?record.value+' points':sec(record.value)}`:''}</p>${same?'<p>Your current round is ready to continue.</p>':this.active?'<p class="text-small">Starting this will replace your unfinished optional task.</p>':''}<div class="modal-actions"><button class="primary" id="side-start">${same?'Continue this round':cost?'Play · ¥'+cost:'Start '+safe(d.name)}</button>${id==='tinfish'?'<button class="secondary" id="side-practice">Free practice</button>':''}${same?'<button class="secondary" id="side-stop">Stop this task</button>':''}<button class="secondary" id="side-back">Back to the street</button></div>`);
            $('side-start').onclick=()=>{g.closeModal();if(same){if(['signal','tinfish'].includes(id))this.openMini(id);return;}this.start(id,false);};
            if(id==='tinfish')$('side-practice').onclick=()=>{g.closeModal();this.start(id,true);};
            if(same)$('side-stop').onclick=()=>{this.active=null;g.closeModal();g.save(false);this.updateHUD();g.toast('Borrowed items returned. You can start again at any time.','TASK STOPPED');};
            $('side-back').onclick=()=>g.closeModal();
        }
        start(id,practice=false){
            const g=this.g,d=this.def(id);if(!d)return false;
            if(g.work?.active||g.mode==='combat'){g.toast('Finish the current work or practice first.','ONE JOB AT A TIME');return false;}
            if(id==='tinfish'&&!practice){const price=g.case.flags.tinPlayed?10:0;if(!g.case.spend(price)){g.toast('You need ¥10. Free practice is available.','TIN FISH');return false;}g.case.flags.tinPlayed=true;}
            const a=this.active={id,elapsed:0,done:0,held:false,items:[],practice,sequence:[],misses:0};
            if(id==='lunch')a.items=shuffled([{x:-323,y:248,name:'Table 1 · rice',color:0},{x:-307,y:384,name:'Table 2 · fish',color:1},{x:-135,y:386,name:'Table 3 · tea',color:2}]);
            if(id==='oranges')a.items=shuffled([[-328,287],[-346,324],[-277,373],[-135,306],[-80,341],[-324,459],[-42,304],[-328,186]]).slice(0,5).map(([x,y],i)=>({x,y,dx:i%2?1:-1,dy:i%3?0:1,done:false}));
            if(id==='post'){
                for(const zone of shuffled(D.districts).slice(0,3)){
                    const pool=g.world.npcs.filter(n=>n.ambient&&n.x>zone.x&&n.x<zone.x+zone.w&&n.y>zone.y&&n.y<zone.y+zone.d);
                    const n=shuffled(pool.length?pool:g.world.npcs.filter(n=>n.ambient))[0];a.items.push({recipient:n.id,place:zone.name,done:false});
                }
            }
            if(id==='bottles')a.items=shuffled([[-332,-43],[-338,-207],[-287,-306],[-117,-289],[-327,-552],[-27,-544],[-482,-521],[-332,-178],[-291,-178],[-29,-199],[-286,-565],[-125,-452]]).slice(0,6).map(([x,y],i)=>({x,y,color:i%3,held:false,done:false}));
            if(id==='chimes'){a.items=[{x:59,y:-194,name:'Sun',color:0},{x:192,y:-44,name:'Moon',color:1},{x:327,y:-188,name:'Fish',color:2},{x:371,y:-29,name:'Star',color:3}];a.sequence=shuffled([0,1,2,3]);}
            if(id==='nets')a.items=[{x:89,y:-494,knots:0},{x:141,y:-490,knots:0},{x:290,y:-490,knots:0}];
            if(id==='signal')a.sequence=Array.from({length:6},()=>Math.floor(Math.random()*4));
            g.path=[];g.save(false);this.updateHUD();
            if(['signal','tinfish'].includes(id))this.openMini(id);else g.toast(this.instruction(),d.name.toUpperCase());
            return true;
        }
        instruction(){const a=this.active;if(!a)return '';switch(a.id){
            case'lunch':return a.held?'Take '+a.items[a.done].name.toLowerCase()+' to its marked table.':'Collect '+a.items[a.done].name.split(' · ')[1]+' at Arai’s counter.';
            case'oranges':return 'Catch the marked oranges. Press E beside each one.';
            case'post':return a.items.filter(i=>!i.done).map(i=>this.g.world.npc(i.recipient).name+' · '+i.place).join(' / ');
            case'bottles':return 'Collect bottles. Return clear, green, and brown glass to the matching racks.';
            case'chimes':return a.sequence.map((n,i)=>(i<a.done?'✓ ':'')+a.items[n].name).join(' → ');
            case'nets':return 'Make two knots at each marked net frame.';
            case'signal':return 'Copy the six flag signals. Speak to Senda to continue.';
            case'tinfish':return 'Five balls. Aim for the gold band. Speak to Haru to continue.';
        }}
        targets(){
            const a=this.active;if(!a||this.g.mode==='work')return [];const mk=(o,key,name,shape)=>({...o,id:'side-'+key,token:key,name,type:'side-target',shape,r:27});
            switch(a.id){
                case'lunch':return a.done>=3?[]:[a.held?mk(a.items[a.done],'table',a.items[a.done].name,'table'):mk(this.def(),'tray','Collect '+a.items[a.done].name.split(' · ')[1],'tray')];
                case'oranges':return a.items.flatMap((o,i)=>{if(o.done)return [];let x=o.x+Math.min(24,a.elapsed*1.8)*o.dx,y=o.y+Math.min(24,a.elapsed*1.8)*o.dy;if(!this.g.world.canWalk(x,y,4)){x=o.x;y=o.y;}return [mk({x,y},'orange-'+i,'Catch rolling orange','orange')];});
                case'post':return a.items.flatMap((o,i)=>o.done?[]:[mk(this.g.world.npc(o.recipient),'letter-'+i,'Deliver letter to '+this.g.world.npc(o.recipient).name,'letter')]);
                case'bottles':return a.items.flatMap((o,i)=>o.done||o.held?[]:[mk(o,'bottle-'+i,['Clear','Green','Brown'][o.color]+' bottle','bottle')]).concat(a.items.some(o=>o.held&&!o.done)?[0,1,2].map(color=>mk({x:-427+color*28,y:-20,color},'rack-'+color,['Clear','Green','Brown'][color]+' glass rack','rack')):[]);
                case'chimes':return a.items.map((o,i)=>mk(o,'chime-'+i,o.name+' chime','chime'));
                case'nets':return a.items.flatMap((o,i)=>o.knots>=2?[]:[mk(o,'net-'+i,'Repair net · '+o.knots+'/2 knots','net')]);
            }return [];
        }
        interact(o){
            const a=this.active,g=this.g;if(!a)return false;const key=o.token;
            if(a.id==='lunch'){if(key==='tray'){a.held=true;g.sound.play('crate');}else if(key==='table'){a.held=false;a.done++;g.sound.play('bell');if(a.done===3){this.finish(a.elapsed<=90?80:60);return true;}}}
            if(key.startsWith('orange-')){const n=+key.split('-')[1];if(!a.items[n].done){a.items[n].done=true;a.done++;g.sound.play('bell');}if(a.done===5){this.finish(a.elapsed<=60?50:30);return true;}}
            if(key.startsWith('letter-')){const i=a.items[+key.split('-')[1]];if(i.done)return true;i.done=true;a.done++;if(a.done===3){this.finish();return true;}g.say(i.recipient,['A letter from my sister. Thank you for finding me.']);}
            if(key.startsWith('bottle-')){const i=a.items[+key.split('-')[1]];i.held=true;g.sound.play('paper');}
            if(key.startsWith('rack-')){const color=+key.split('-')[1],i=a.items.find(i=>i.held&&!i.done&&i.color===color);if(!i){g.toast('Use the rack that matches your bottle color.','BOTTLE RETURN');return true;}i.done=true;a.done++;g.sound.play('bell');if(a.done===6){this.finish();return true;}}
            if(key.startsWith('chime-')){const i=+key.split('-')[1];g.sound.play('bell');if(i===a.sequence[a.done])a.done++;else{a.done=0;a.misses++;g.toast('Start again from the first shape.','A DIFFERENT TUNE');}if(a.done===4){this.finish(a.elapsed<=90?40:25);return true;}}
            if(key.startsWith('net-')){this.openMini('nets',+key.split('-')[1]);return true;}
            this.updateHUD();g.save(false);return true;
        }
        talk(id){const a=this.active;if(a?.id==='post'){const i=a.items.findIndex(n=>n.recipient===id&&!n.done);if(i>=0){this.interact({token:'letter-'+i});return true;}}
            const d=D.activityDefs.find(d=>d.host===id);if(d){this.offer(d.id);return true;}return false;
        }
        update(dt){if(!this.active||this.g.mode!=='explore')return;this.active.elapsed+=dt;this.hudTime-=dt;if(this.hudTime<=0){this.hudTime=.2;this.updateHUD();}}
        updateHUD(){const a=this.active,g=this.g;$('side-hud').hidden=!a||g.mode!=='explore';if(!a)return;const total={lunch:3,oranges:5,post:3,bottles:6,nets:6,chimes:4,signal:6,tinfish:5}[a.id];$('side-title').textContent=this.def().name;$('side-count').textContent=a.done+' / '+total+' · '+sec(a.elapsed);$('side-tip').textContent=this.instruction();}
        finish(reward,score){
            const a=this.active;if(!a)return;const g=this.g,d=this.def(),kind=score===undefined?'time':'score',value=score??a.elapsed;
            const records={...this.records()},old=records[a.id];if(!a.practice&&(!old||(kind==='score'?value>old.value:value<old.value)))records[a.id]={kind,value};g.case.flags.sideRecords=records;
            const success=a.id!=='tinfish'||score>=70;let earned=0;
            if(success&&!a.practice&&g.case.award('side-'+a.id,reward??d.reward)){earned=reward??d.reward;g.case.addItem('keepsake-'+a.id,d.keepsake,'A keepsake from '+d.name+' in '+d.place+'.');}
            this.active=null;this.mini=null;if(!$('modal-backdrop').hidden)g.closeModal();this.updateHUD();g.save(false);g.sound.play(success?'clue':'paper');
            const detail=kind==='score'?value+' points':sec(value),result=a.practice?'Practice complete':success?'A job well done':'Try another round';
            g.showModal(d.name.toUpperCase(),result,`<div class="side-result">${safe(detail)}</div><p>${success?'Thanks for spending part of your afternoon here.':'You need 70 points for the ferry pin. Aim nearer the center of the gold band.'}</p><p class="text-small muted">${earned?'¥'+earned+' earned · '+safe(d.keepsake)+' added to your notebook.':a.practice?'Practice is free. Prizes are available in a normal round.':success?'Your keepsake is already safe. Your best record is saved.':'Your score is saved. Free practice is always available.'}</p><div class="modal-actions"><button class="primary" id="side-done">Back to the street</button><button class="secondary" id="side-again">Play again</button></div>`);
            $('side-done').onclick=()=>g.closeModal();$('side-again').onclick=()=>this.offer(d.id);
        }
        openMini(id,frame){
            const a=this.active,g=this.g;if(!a)return;
            this.mini={id,frame,phase:-Math.PI/2,time:0,step:a.shots||0,score:a.score||0,attempts:0,message:'',flash:0,sequence:a.sequence};
            const label=id==='signal'?'Copy the signal':id==='nets'?'Tie the knot':'Five soft balls';
            g.showModal(this.def().name.toUpperCase(),label,`<canvas id="side-canvas" class="side-canvas" width="640" height="250" aria-label="${safe(label)}"></canvas><div class="side-mini-meta"><strong id="side-mini-count"></strong><span id="side-mini-message" aria-live="polite"></span></div>${id==='signal'?'<div class="signal-buttons"><button id="signal-up" class="secondary">↑ Up</button><button id="signal-right" class="secondary">→ Right</button><button id="signal-down" class="secondary">↓ Down</button><button id="signal-left" class="secondary">← Left</button></div>':'<button id="side-action" class="primary">'+(id==='nets'?'Pull knot · E':'Throw · E')+'</button>'}<p class="text-small muted">${id==='signal'?'Match the shown arrow. Missed signals repeat.':id==='nets'?'Press E or Pull knot while the marker is inside the gold band.':'Press E or Throw near the center. Five throws, up to 30 points each.'} Close this panel to return to the street.</p>`);
            if(id==='signal')['up','right','down','left'].forEach((k,i)=>$('signal-'+k).onclick=()=>this.inputMini(i));else $('side-action').onclick=()=>this.inputMini();
            this.drawMini();
        }
        inputMini(direction){
            const m=this.mini,a=this.active,g=this.g;if(!m||!a)return;
            if(m.id==='signal'){
                if(direction===a.sequence[a.done]){a.done++;m.message='Clear signal.';g.sound.play('bell');if(a.done===6){this.finish();return;}}
                else{a.misses++;m.message='Try that signal again.';}m.time=0;
            }else{
                const pos=(Math.sin(m.phase)+1)/2,accuracy=Math.abs(pos-.5);m.attempts++;
                if(m.id==='nets'){
                    if(accuracy<=(g.settings.assisted?.2:.14)){a.items[m.frame].knots++;a.done++;m.message='Knot secured.';g.sound.play('bell');if(a.done===6){this.finish();return;}if(a.items[m.frame].knots>=2){this.mini=null;g.closeModal();g.save(false);g.toast('This frame is ready. Move to the next marked net.','NET REPAIR');return;}}
                    else{a.misses++;m.message='The loop slipped. Try again.';}
                }else{
                    const points=accuracy<.075?30:accuracy<.18?20:accuracy<.29?10:0;m.score+=points;m.step++;a.done=m.step;a.shots=m.step;a.score=m.score;m.message=points?'Clang! +'+points:'Just wide.';g.sound.play(points?'bell':'paper');if(m.step===5){this.finish(undefined,m.score);return;}
                }
                m.phase=-Math.PI/2;
            }
            m.flash=.22;g.save(false);this.drawMini();
        }
        updateMini(dt){const m=this.mini,a=this.active;if(!m||!a)return;m.phase+=dt*(m.id==='tinfish'?3.1+m.step*.33:2.8);m.time+=dt;m.flash=Math.max(0,m.flash-dt);a.elapsed+=dt;const input=this.g.game.input;
            if(m.id==='signal'){const keys=['up','right','down','left'];for(let i=0;i<4;i++)if(input.pressed(keys[i])){this.inputMini(i);break;}if(this.mini&&m.time>(this.g.settings.assisted?3:1.65)){a.misses++;m.message='Hold the signal clearly. Try once more.';m.time=0;}}
            else if(input.pressed('interact'))this.inputMini();if(this.mini)this.drawMini();
        }
        drawMini(){const m=this.mini,a=this.active;if(!m||!a)return;const g=$('side-canvas').getContext('2d');g.fillStyle='#173b44';g.fillRect(0,0,640,250);g.fillStyle='#315e64';g.fillRect(0,171,640,79);
            if(m.id==='signal'){
                const dir=a.sequence[a.done],arrow=['↑','→','↓','←'][dir];g.fillStyle='#e9bf7e';g.font='bold 82px Arial';g.textAlign='center';g.fillText(arrow,320,118);g.font='16px Arial';g.fillStyle='#dce3ce';g.fillText(['UP','RIGHT','DOWN','LEFT'][dir],320,151);g.fillStyle='#e9bf7e';g.fillRect(85,207,470*Math.max(0,1-m.time/(this.g.settings.assisted?3:1.65)),5);
                for(const x of[132,508]){g.fillStyle='#bec1a7';g.fillRect(x,67,4,111);g.fillStyle='#d59a70';g.beginPath();g.moveTo(x+4,70);g.lineTo(x+66,96);g.lineTo(x+4,117);g.fill();}
                $('side-mini-count').textContent=a.done+' / 6 signals';
            }else{
                if(m.id==='tinfish')for(let i=0;i<5;i++){const x=140+i*90,down=i<m.step;g.fillStyle=down?'#3e6764':['#b9816d','#87aaa0','#d6b677','#8299a2','#c68765'][i];g.beginPath();g.moveTo(x-29,95);g.lineTo(x-40,73);g.lineTo(x-40,117);g.closePath();g.fill();g.beginPath();g.arc(x,95,28,0,Math.PI*2);g.fill();g.fillStyle='#1b4149';g.beginPath();g.arc(x+12,88,3,0,Math.PI*2);g.fill();}
                else{g.strokeStyle='#b0b79c';g.lineWidth=2;for(let x=95;x<551;x+=25){g.beginPath();g.moveTo(x,31);g.lineTo(x,135);g.stroke();}for(let y=32;y<136;y+=20){g.beginPath();g.moveTo(95,y);g.lineTo(550,y);g.stroke();}g.fillStyle='#193e45';g.fillRect(280,67,81,53);g.strokeStyle='#e4bd7d';g.beginPath();g.moveTo(279,66);g.lineTo(322,91);g.lineTo(361,68);g.stroke();}
                g.fillStyle='#132f37';g.fillRect(86,190,468,23);const tolerance=this.g.settings.assisted&&m.id==='nets'?.2:.14;g.fillStyle='#b79563';g.fillRect(86+(0.5-tolerance)*468,190,tolerance*936,23);g.fillStyle='#f1d195';g.fillRect(316,184,8,35);const x=86+(Math.sin(m.phase)+1)/2*468;g.fillStyle=m.flash?'#fce8b3':'#d8eee2';g.fillRect(x-3,179,6,44);
                $('side-mini-count').textContent=m.id==='tinfish'?m.step+' / 5 throws · '+m.score+' points':a.items[m.frame].knots+' / 2 knots · '+a.done+' / 6 total';
            }
            $('side-mini-message').textContent=m.message||'Take your time. The town clock is paused.';
        }
        draw(r){
            if(!this.active||this.g.mode==='work')return;const t=this.g.game.time;
            for(const o of this.targets()){
                if(!r.visible(o.x,o.y,0,80,60,130))continue;r.groundRing(o.x,o.y,o.shape==='letter'?12:13,'#a7d7ba',.8);r.textAt(o.x,o.y,40,'+', '#dce9bd',{align:'center'});
                if(o.shape==='letter'||o.shape==='net')continue;
                r.queue(o.x,o.y,0,g=>{const w=this.g.world,q=r.w(o.x,o.y,7);if(o.shape==='orange'){P.disc(g,q[0],q[1],5,'#d8a05d');P.dot(g,q[0]-2,q[1]-2,'#f0ca7e');}
                    else if(o.shape==='bottle'){const c=['#b9d1bf','#6caa7e','#b58962'][o.color];P.rect(g,q[0]-3,q[1]-7,7,14,c);P.rect(g,q[0]-1,q[1]-12,3,6,c);P.line(g,q[0]-1,q[1]-5,q[0]-1,q[1]+4,'#d1dfc0');}
                    else if(o.shape==='rack'){w.box(r,g,o.x-9,o.y-8,0,18,16,14,['#b9b99b','#658e74','#947152'][o.color]);r.textAt(o.x,o.y,25,['CLEAR','GREEN','BROWN'][o.color],'#e4d9bc',{align:'center',font:'tiny'});}
                    else if(o.shape==='chime'){w.box(r,g,o.x,o.y,0,2,2,33,'#6c8b7c');const p=r.w(o.x+Math.sin(t)*2,o.y,28);P.disc(g,p[0],p[1],6,['#d9b675','#a9c1b8','#b08f83','#8cabb9'][o.color]);P.line(g,p[0],p[1]+5,p[0]+Math.sin(t)*3,p[1]+20,'#d0c5a4');r.textAt(o.x,o.y,44,o.name.split(' ')[0].toUpperCase(),'#e4d9bc',{align:'center',font:'tiny'});}
                    else {w.box(r,g,o.x-13,o.y-9,0,26,18,18,'#a18d6b');P.ell(g,q[0],q[1]-20,8,4,'#d9d1aa');}
                });
            }
            if(this.isCarrying()){const p=this.g.player;r.queue(p.x,p.y,23,g=>{const q=r.w(p.x,p.y,25);P.rect(g,q[0]-12,q[1],24,5,'#a08a62');P.ell(g,q[0],q[1],7,3,'#e0d4ae');});}
        }
        openDirectory(){
            const g=this.g;if(['title','cinema','chase','dialogue'].includes(g.mode))return;g.showModal('AONAMI · OPEN DISTRICT','An afternoon of your own',`<p class="text-small muted">Eight street activities. Mint rings show your active task. Amber marks follow the main case. Choose a destination to walk there.</p><div class="activity-directory">${D.activityDefs.map(a=>`<button class="activity-card" id="go-${a.id}"><small>${safe(a.place)} ${g.case.flags['side-'+a.id]?'· ✓':''}</small><strong>${safe(a.name)}</strong><span>${safe(a.desc)}</span><em>Walk to ${safe(g.world.npc(a.host).name)} →</em></button>`).join('')}</div>`);
            for(const d of D.activityDefs)$('go-'+d.id).onclick=()=>{g.closeModal();this.walkTo(d);};
        }
        walkTo(p){const g=this.g;const route=g.world.path(g.player,p);if(!route.length){g.toast('Move into the lane and try that route again.','PATH BLOCKED');return;}g.path=route;g.toast('Follow the route. Hold Shift to run, or use a bus stop.','ON YOUR WAY');}
        openBus(current){
            const g=this.g;if(g.work?.active){g.toast('Finish the cargo load before taking the bus.','AONAMI BUS');return;}
            g.showModal('AONAMI LOCAL · ¥20','Next stop?',`<p>Each trip takes five town minutes. You can keep your optional task. The bus runs throughout this afternoon.</p><div class="bus-options">${D.busStops.filter(b=>b.id!==current.id).map(b=>`<button class="secondary" id="ride-${b.id}">${safe(b.name)} <span>¥20 →</span></button>`).join('')}</div>`);
            for(const b of D.busStops.filter(b=>b.id!==current.id))$('ride-'+b.id).onclick=()=>{if(!g.case.spend(20)){g.toast('You need ¥20 for this trip.','AONAMI BUS');return;}g.closeModal();g.player.x=b.x+12;g.player.y=b.y+13;g.path=[];g.clock.waitUntil(Math.min(1200,g.clock.minutes+5));g.world.syncSchedules(g.clock);g.game.cam.snap=true;g.game.focus(g.player.x,g.player.y,17);g.save(false);g.toast('Welcome to '+b.name+'.','AONAMI BUS');};
        }
    }
    root.HarborActivities=HarborActivities;
})(window);
