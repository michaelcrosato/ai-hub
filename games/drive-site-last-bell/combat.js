/* Last Bell: the combat rules are independent of graphics and browser state. */
export const DIFFICULTIES = {
  club: { label: 'Club', cue: 1.24, damage: .68, window: 1.22, health: 100 },
  contender: { label: 'Contender', cue: 1, damage: 1, window: 1, health: 100 },
  champion: { label: 'Champion', cue: .82, damage: 1.2, window: .86, health: 100 }
};
export const MOVES = {
  jabL: { name: 'LEFT STRAIGHT', defense: 'right', key: 'D', cue: .83, damage: 12, pose: 1, blockable: true, target: 'head', opening: 'body' },
  jabR: { name: 'RIGHT STRAIGHT', defense: 'left', key: 'A', cue: .83, damage: 12, pose: 2, blockable: true, target: 'head', opening: 'head' },
  crossL: { name: 'LEFT CROSS', defense: 'right', key: 'D', cue: .77, damage: 17, pose: 1, blockable: false, target: 'head', opening: 'body' },
  crossR: { name: 'RIGHT CROSS', defense: 'left', key: 'A', cue: .77, damage: 17, pose: 2, blockable: false, target: 'head', opening: 'head' },
  hook: { name: 'HIGH SWEEP', defense: 'duck', key: 'S', cue: .98, damage: 21, pose: 3, blockable: false, target: 'head', opening: 'body' },
  body: { name: 'BODY DRIVE', defense: 'either', key: 'A / D', cue: .92, damage: 17, pose: 2, blockable: false, target: 'body', opening: 'head' },
  delay: { name: 'DELAYED CROSS', defense: 'left', key: 'A', cue: 1.27, damage: 19, pose: 2, blockable: false, target: 'head', opening: 'body', feint: true }
};
export const PATTERNS = [
  [['jabL'], ['jabR'], ['hook'], ['body'], ['jabR'], ['jabL']],
  [['jabL','crossR'], ['hook'], ['delay'], ['body','jabL'], ['jabR','hook']],
  [['crossL','crossR','hook'], ['delay','body'], ['body','hook'], ['jabR','crossL','hook']]
];
export const LESSONS = [
  { title: '01 / READ THE PUNCH', text: 'Wait for the cue to fill. Tap D to slip right.', goal: 'Avoid a left straight.', moves: ['jabL'], need: 'evade' },
  { title: '02 / TAKE THE OPENING', text: 'Slip right. Then press U or I for a body punch.', goal: 'Land a body counter.', moves: ['jabL'], need: 'counterBody' },
  { title: '03 / CHANGE YOUR LEVEL', text: 'A wide hook beats your guard. Tap S to duck.', goal: 'Duck the high sweep.', moves: ['hook'], need: 'duck' },
  { title: '04 / BREAK THE RHYTHM', text: 'Slip the punch. Press L during the opening.', goal: 'Land your full-power Break punch.', moves: ['jabR'], need: 'special' }
];
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));

export class Bout {
  constructor(options={}) {
    this.onEvent = options.onEvent || (()=>{});
    this.difficulty = DIFFICULTIES[options.difficulty] ? options.difficulty : 'contender';
    this.coach = options.coach !== false;
    this.reset(false);
    this.mode = 'title';
  }
  emit(type, data={}) { this.onEvent({type, ...data}); }
  get config() { return this.training ? {...DIFFICULTIES.club, cue:1.42} : DIFFICULTIES[this.difficulty]; }
  reset(training=false) {
    this.training=training; this.mode='intro'; this.modeTime=0; this.time=180; this.elapsed=0; this.worldTime=0;
    this.phase=1; this.pattern=0; this.sequence=[]; this.sequenceIndex=0; this.sequenceClean=true;
    this.enemyHP=100; this.enemyMaxHP=100; this.playerHP=100; this.focus=0; this.breakMeter=0;
    this.enemyDowns=0; this.playerDowns=0; this.combo=0; this.bestCombo=0; this.downProgress=0;
    this.playerAction=null; this.actionCooldown=0; this.punch=null; this.punchCooldown=0;
    this.playerHurt=0; this.enemyHurt=0; this.guard=false; this.enemyGuard='head';
    this.enemy={state:'idle',time:0,duration:1,move:null,opening:false,openTarget:'body'};
    this.notice=''; this.noticeTime=0; this.lastError=''; this.result=null; this.knockout=false;
    this.lesson=0; this.lessonWait=0; this.lessonPassed=false; this.focusAnnounced=false;
    this.stats={thrown:0,landed:0,counters:0,perfect:0,evades:0,blocks:0,damageTaken:0,head:0,body:0,specials:0};
    this.emit('reset',{training});
  }
  start(training=false) {this.reset(training);this.emit('intro');}
  setMode(mode) { this.mode=mode;this.modeTime=0;this.emit('mode',{mode}); }
  showNotice(text,time=1.3) {this.notice=text;this.noticeTime=time;}
  action(name, options={}) {
    if (this.mode!=='fight') return false;
    if (name==='left'||name==='right'||name==='duck') {
      if(this.playerHurt>0 || this.actionCooldown>0 || this.punch || this.guard) return false;
      this.playerAction={kind:name,time:0,duration:.54};this.actionCooldown=.61;
      this.emit('move',{direction:name});return true;
    }
    const attacks={leftHead:['left','head'],rightHead:['right','head'],leftBody:['left','body'],rightBody:['right','body'],special:['right',options.target||'head']};
    if(!attacks[name])return false;
    const special=name==='special';
    if(this.playerHurt>0||this.punchCooldown>0||this.punch||this.playerAction||this.guard)return false;
    if(special&&this.focus<100){this.showNotice('Fill FOCUS with clean hits.',.9);this.emit('empty');return false;}
    const [hand,target]=attacks[name];
    if(special){this.focus=0;this.focusAnnounced=false;}
    this.punch={hand,target,special,time:0,impact:special?.17:.095,duration:special?.49:.29,resolved:false};
    this.punchCooldown=special?.50:.245;this.stats.thrown++;
    this.emit('punch',{hand,target,special});return true;
  }
  update(dt, held={}) {
    dt=Math.min(dt,.05);this.worldTime+=dt;this.modeTime+=dt;
    this.noticeTime=Math.max(0,this.noticeTime-dt);
    this.enemyHurt=Math.max(0,this.enemyHurt-dt);this.playerHurt=Math.max(0,this.playerHurt-dt);
    if(this.mode==='title'||this.mode==='result'||this.mode==='trainingDone')return;
    if(this.mode==='intro') {
      if(this.modeTime>3.2){this.setMode('fight');this.enemy.duration=this.training?1.6:1.15;this.emit('bell');}
      return;
    }
    if(this.mode==='opponentDown') {
      if(this.enemyDowns>=3){
        if(this.modeTime> (this.knockout?6.3:2.7))this.finish(true,this.knockout?'KO':'TKO');
      }else if(this.modeTime>4.7){
        this.phase++;this.pattern=0;this.enemyMaxHP=this.phase===2?112:126;this.enemyHP=this.enemyMaxHP;
        this.playerHP=clamp(this.playerHP+13,0,100);this.breakMeter=0;this.combo=0;
        this.enemy={state:'idle',time:0,duration:2.0,move:null,opening:false,openTarget:'body'};
        this.setMode('phase');this.emit('phase',{phase:this.phase});
      }return;
    }
    if(this.mode==='phase') {if(this.modeTime>2.4){this.setMode('fight');this.emit('bell');}return;}
    if(this.mode==='playerDown') {
      if(this.playerDowns>=3){if(this.modeTime>2.8)this.finish(false,'TKO');return;}
      if(held.recover)this.downProgress=clamp(this.downProgress+dt/(2.8+this.playerDowns*.65),0,1);
      else this.downProgress=Math.max(0,this.downProgress-dt*.022);
      if(this.downProgress>=1 && this.modeTime>1.4){
        this.playerHP=this.playerDowns===1?70:58;this.playerHurt=0;this.focus=Math.max(0,this.focus-20);
        this.enemy={state:'idle',time:0,duration:1.65,move:null,opening:false,openTarget:'body'};
        this.setMode('fight');this.emit('rise');this.showNotice('BACK ON YOUR FEET',1.6);
      }else if(this.modeTime>=10)this.finish(false,'KO');return;
    }
    if(this.mode!=='fight')return;
    this.elapsed+=dt;if(!this.training)this.time=Math.max(0,180-this.elapsed);
    if(!this.training&&this.time<=0){this.finish(false,'TIME');return;}
    this.actionCooldown=Math.max(0,this.actionCooldown-dt);this.punchCooldown=Math.max(0,this.punchCooldown-dt);
    this.guard=!!held.guard&&!this.punch&&!this.playerAction&&this.playerHurt<=0;
    if(this.playerAction){this.playerAction.time+=dt;if(this.playerAction.time>=this.playerAction.duration)this.playerAction=null;}
    if(this.punch){
      this.punch.time+=dt;
      if(!this.punch.resolved&&this.punch.time>=this.punch.impact){this.punch.resolved=true;this.resolvePunch(this.punch);}
      if(this.punch&&this.punch.time>=this.punch.duration)this.punch=null;
    }
    if(this.mode!=='fight')return;
    if(this.training&&this.lessonPassed){
      this.lessonWait+=dt;
      if(this.lessonWait>1.5){
        this.lesson++;this.lessonPassed=false;this.lessonWait=0;
        if(this.lesson>=LESSONS.length){this.setMode('trainingDone');this.emit('trainingDone');return;}
        if(this.lesson===3)this.focus=100;
        this.enemy={state:'idle',time:0,duration:1.3,move:null,opening:false,openTarget:'body'};
        this.playerAction=null;this.punch=null;this.combo=0;
        this.emit('lesson',{lesson:this.lesson});
      }return;
    }
    const e=this.enemy;e.time+=dt;
    if(e.state==='idle'&&e.time>=e.duration)this.startSequence();
    else if(e.state==='telegraph'&&e.time>=e.duration){e.state='strike';e.time=0;e.duration=.16;this.resolveEnemyAttack();}
    else if(e.state==='strike'&&e.time>=e.duration){
      if(this.sequenceIndex<this.sequence.length-1){e.state='between';e.time=0;e.duration=.23;e.opening=false;}
      else this.openRecovery();
    }else if(e.state==='between'&&e.time>=e.duration){this.sequenceIndex++;this.startMove();}
    else if((e.state==='recover'||e.state==='stagger')&&e.time>=e.duration){
      e.state='idle';e.time=0;e.duration=(this.phase===1?.8:.52)*this.config.cue;e.opening=false;e.move=null;
      this.combo=0;this.enemyGuard=this.pattern%2?'head':'body';
    }
    if(this.focus>=100&&!this.focusAnnounced){this.focusAnnounced=true;this.emit('focusReady');}
    if(this.training&&this.lesson===3&&this.focus<100&&!this.punch)this.focus=100;
  }
  startSequence() {
    this.sequence=this.training?[...LESSONS[this.lesson].moves]:[...PATTERNS[this.phase-1][this.pattern%PATTERNS[this.phase-1].length]];
    this.pattern++;this.sequenceIndex=0;this.sequenceClean=true;this.startMove();
    if(this.phase===3&&this.sequence.length===3)this.emit('signature');
  }
  startMove() {
    const key=this.sequence[this.sequenceIndex],move={...MOVES[key],id:key};
    const duration=move.cue*this.config.cue*(this.sequenceIndex>0?.86:1);
    this.enemy={state:'telegraph',time:0,duration,move,opening:false,openTarget:move.opening};
    this.emit('telegraph',{move,sequence:this.sequenceIndex+1,total:this.sequence.length});
  }
  resolveEnemyAttack() {
    const m=this.enemy.move;if(!m)return;
    const p=this.playerAction;
    const active=p&&p.time<=.405;
    const correct=active&&(m.defense===p.kind||(m.defense==='either'&&(p.kind==='left'||p.kind==='right')));
    if(correct){
      const perfect=p.time<.145;
      this.stats.evades++;if(perfect)this.stats.perfect++;
      this.focus=clamp(this.focus+(perfect?11:7),0,100);
      this.breakMeter=clamp(this.breakMeter+(perfect?9:5),0,99);
      this.enemy.defended=true;this.enemy.perfect=perfect;
      this.emit('evade',{perfect,direction:p.kind,last:this.sequenceIndex===this.sequence.length-1});
      this.showNotice(perfect?'PERFECT SLIP':'CLEAN SLIP',.7);
      if(this.training&&this.lesson===0)this.completeLesson();
      if(this.training&&this.lesson===2&&p.kind==='duck')this.completeLesson();
      return;
    }
    if(this.guard&&m.blockable){
      this.stats.blocks++;this.focus=Math.max(0,this.focus-3);this.enemy.defended=true;this.enemy.blocked=true;
      if(!this.training){const before=this.playerHP;this.playerHP=Math.max(1,this.playerHP-2);this.stats.damageTaken+=before-this.playerHP;}
      this.emit('block');this.showNotice('GUARD HELD',.8);return;
    }
    this.sequenceClean=false;this.combo=0;
    const damage=Math.round(m.damage*this.config.damage);
    if(!this.training)this.playerHP=Math.max(0,this.playerHP-damage);
    this.stats.damageTaken+=damage;this.focus=Math.max(0,this.focus-17);this.focusAnnounced=false;
    const wasGuarding=this.guard;
    this.playerHurt=.43;this.punch=null;this.guard=false;
    this.lastError=m.defense==='duck'?'Duck under the high sweep.':m.defense==='either'?'Slip left or right. A duck cannot stop a body punch.':m.feint?'Wait through the feint. Then slip left.':`Slip ${m.defense} just before the punch lands.`;
    if(wasGuarding&&!m.blockable)this.lastError='Heavy punches break your guard. Use a slip or duck.';
    this.emit('hurt',{damage,move:m});this.showNotice(this.lastError,2);
    if(this.playerHP<=0)this.playerKnockdown();
  }
  openRecovery() {
    const e=this.enemy;let duration=(this.sequence.length>=3?1.48:this.sequence.length===2?1.10:.83)*this.config.window;
    if(e.blocked)duration*=.68;
    e.state='recover';e.time=0;e.duration=duration;e.opening=!!e.defended;
    this.enemyGuard=e.openTarget==='body'?'head':'body';
    if(this.sequenceClean&&this.sequence.length>1){this.focus=clamp(this.focus+8,0,100);this.breakMeter=clamp(this.breakMeter+8,0,99);}
    if(e.opening){this.emit('opening',{target:e.openTarget,duration});this.showNotice(e.openTarget==='body'?'BODY OPEN':'HEAD OPEN',duration);}
  }
  resolvePunch(p) {
    const e=this.enemy;
    if(this.mode!=='fight')return;
    const precise=e.state==='telegraph'&&!e.move?.feint&&e.duration-e.time<.125&&e.duration-e.time>0&&p.target===e.move.opening;
    const opening=(e.state==='recover'&&e.opening)||e.state==='stagger';
    const vulnerable=opening||precise;
    const resting=e.state==='idle';
    if(!vulnerable&&(!resting||p.target===this.enemyGuard)){
      this.combo=0;this.emit('guarded',{hand:p.hand,target:p.target});
      this.showNotice(e.state==='between'?'WAIT FOR THE NEXT PUNCH':resting?(this.enemyGuard==='head'?'GUARD HIGH · TRY THE BODY':'GUARD LOW · TRY THE HEAD'):'READ THE ATTACK',.8);
      return;
    }
    const correctTarget=e.state==='stagger'||p.target===e.openTarget;
    let damage=p.special?(e.state==='stagger'?47:33):vulnerable?(correctTarget?11:7):4;
    if(precise){damage+=4;this.sequenceIndex=this.sequence.length-1;e.defended=true;e.state='recover';e.time=0;e.duration=.95*this.config.window;e.opening=true;}
    this.stats.landed++;this.stats[p.target]++;if(p.special)this.stats.specials++;
    if(vulnerable){this.stats.counters++;this.combo++;this.bestCombo=Math.max(this.bestCombo,this.combo);}
    else{this.combo=1;this.enemyGuard=p.target;}
    if(!p.special)this.focus=clamp(this.focus+(vulnerable?11:5),0,100);
    this.playerHP=clamp(this.playerHP+(vulnerable?1.1:.25),0,100);
    this.breakMeter=clamp(this.breakMeter+(p.special?23:vulnerable?(correctTarget?15:8):3),0,100);
    this.enemyHurt=p.special?.3:.19;
    if(!this.training)this.enemyHP=Math.max(0,this.enemyHP-damage);
    this.emit('hit',{hand:p.hand,target:p.target,special:p.special,counter:vulnerable,damage,combo:this.combo});
    if(vulnerable)this.showNotice(p.special?'BREAK PUNCH':`${this.combo} HIT${this.combo>1?'S':''} · COUNTER`,.8);
    if(this.training&&this.lesson===1&&vulnerable&&p.target==='body')this.completeLesson();
    if(this.training&&this.lesson===3&&p.special&&vulnerable)this.completeLesson();
    if(this.enemyHP<=0){this.knockout=this.phase===3&&p.special;this.enemyKnockdown();return;}
    if(this.breakMeter>=100 && e.state!=='stagger'){
      this.breakMeter=0;e.state='stagger';e.time=0;e.duration=1.65*this.config.window;e.opening=true;
      this.sequenceIndex=this.sequence.length-1;this.emit('stagger');this.showNotice('RHYTHM BROKEN',1.6);
    }
  }
  completeLesson(){if(this.lessonPassed)return;this.lessonPassed=true;this.lessonWait=0;this.emit('lessonComplete',{lesson:this.lesson});this.showNotice('THAT’S IT. GOOD WORK.',1.5);}
  enemyKnockdown(){
    this.enemyDowns++;this.punch=null;this.playerAction=null;this.guard=false;
    this.setMode('opponentDown');this.emit('opponentDown',{count:this.enemyDowns,knockout:this.knockout});
  }
  playerKnockdown(){
    this.playerDowns++;this.downProgress=0;this.playerAction=null;this.punch=null;this.guard=false;
    this.setMode('playerDown');this.emit('playerDown',{count:this.playerDowns});
  }
  finish(won,method){
    if(this.mode==='result')return;
    const accuracy=this.stats.thrown?this.stats.landed/this.stats.thrown:0;
    const score=Math.max(0,Math.round((won?3000:0)+this.stats.counters*140+this.stats.perfect*180+this.bestCombo*90+this.stats.landed*30+(won?this.time*18:0)-this.stats.damageTaken*4-this.playerDowns*350));
    const rank=!won?'—':this.playerDowns===0&&accuracy>=.8&&this.stats.damageTaken<35?'S':this.playerDowns===0&&accuracy>=.55?'A':this.playerDowns<2?'B':'C';
    this.result={won,method,rank,score,accuracy,time:this.elapsed,difficulty:this.difficulty,coach:this.coach,stats:{...this.stats},bestCombo:this.bestCombo,playerDowns:this.playerDowns,enemyDowns:this.enemyDowns};
    this.setMode('result');this.emit('result',{result:this.result});
  }
  snapshot(){return {mode:this.mode,phase:this.phase,time:this.time,playerHP:this.playerHP,enemyHP:this.enemyHP,focus:this.focus,breakMeter:this.breakMeter,enemyDowns:this.enemyDowns,playerDowns:this.playerDowns,enemyState:this.enemy.state,move:this.enemy.move?.id||null,training:this.training,lesson:this.lesson,result:this.result};}
}
