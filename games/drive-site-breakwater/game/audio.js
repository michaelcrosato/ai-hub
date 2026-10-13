/* BREAKWATER — Original synthesized score and sound design. MIT. */
(function(root){
'use strict';
const SCORE={bpm:94,steps:4,tracks:[
 {wave:'triangle',vol:.17,notes:'D2 - . . D2 . . . A2 - . . C3 . . . D2 - . . D2 . . . F2 - . . C2 - . .'},
 {wave:'sine',vol:.12,notes:'D4 - - - - - . . A4 - - - C5 - - - F4 - - - - - . . E4 - - - C4 - - -'},
 {wave:'pulse',vol:.033,notes:'D5 . . . . . A4 . C5 . . . . . A4 . F5 . . . . . D5 . E5 . . . . . C5 .'},
 {wave:'drums',vol:.08,notes:'k . h . . . h . s . h . . . h . k . h . . k h . s . h . . . h .'}
]};
const BATTLE={bpm:118,steps:4,tracks:[
 {wave:'triangle',vol:.18,notes:'D2 . D2 . D2 . A2 . D2 . D2 . C3 . A2 . F2 . F2 . F2 . C3 . C2 . C2 . A2 . C3 .'},
 {wave:'pulse',vol:.05,notes:'D4 . A4 . D5 . C5 . A4 . F4 . D4 . C4 . F4 . C5 . F5 . E5 . C5 . A4 . E4 . C4 .'},
 {wave:'drums',vol:.11,notes:'k h h . s h h . k h h k s h h .'}
]};
class SoundBank{
 constructor(game){this.game=game;this.audio=game.audio;this.rotorClock=0;this.musicOn=true;this.mode='';
  this.audio.setVolume(.52);
  const defs={
   'bw-cannon':[{wave:'noise',freq:2600,to:450,dur:.08,vol:.23},{wave:'triangle',freq:100,to:46,dur:.09,vol:.18}],
   'bw-rocket':[{wave:'noise',freq:500,to:1900,dur:.24,vol:.3},{wave:'saw',freq:100,to:55,dur:.19,vol:.08}],
   'bw-guided':[{wave:'noise',freq:1500,to:400,dur:.33,vol:.32},{wave:'sine',freq:750,to:250,dur:.2,vol:.1}],
   'bw-rotor':[{wave:'noise',freq:240,to:120,dur:.17,vol:.072,filter:'lowpass'},{wave:'sine',freq:53,to:45,dur:.11,vol:.05}],
   'bw-rescue':[{wave:'sine',freq:640,to:800,dur:.16,vol:.2},{wave:'sine',freq:960,dur:.28,vol:.17,delay:.13}],
   'bw-radio':[{wave:'noise',freq:2100,dur:.07,vol:.1},{wave:'sine',freq:1500,dur:.07,vol:.035,delay:.06}],
   'bw-flare':{wave:'noise',freq:4400,to:350,dur:.7,vol:.26},
   'bw-warning':[{wave:'sine',freq:440,dur:.1,vol:.18},{wave:'sine',freq:330,dur:.13,vol:.15,delay:.17}],
   'bw-objective':[{wave:'triangle',freq:'D5',dur:.25,vol:.19},{wave:'triangle',freq:'A5',dur:.3,vol:.16,delay:.15},{wave:'triangle',freq:'D6',dur:.35,vol:.14,delay:.3}],
   'bw-hit':[{wave:'noise',freq:150,to:45,dur:.21,vol:.4,filter:'lowpass'},{wave:'triangle',freq:65,to:25,dur:.22,vol:.32}],
   'bw-empty':{wave:'noise',freq:3000,to:1300,dur:.04,vol:.12},
   'bw-enemy':{wave:'noise',freq:700,to:300,dur:.1,vol:.055}
  };for(const [k,v]of Object.entries(defs))this.audio.define(k,v);
 }
 start(){this.audio.sfx('bw-radio');this.setMusic('flight');}
 setMusic(mode){if(!this.musicOn){this.audio.stopMusic();this.mode='';return;}if(this.mode===mode)return;this.mode=mode;this.audio.music(mode==='battle'?BATTLE:SCORE);}
 setMusicEnabled(on){this.musicOn=on;this.mode='';if(on)this.setMusic('flight');else this.audio.stopMusic();}
 update(dt,m){if(m.status!=='playing')return;this.rotorClock-=dt;if(this.rotorClock<=0){this.rotorClock=.135;this.audio.sfx('bw-rotor',{vol:m.player.landed?.3:1,pitch:m.player.module?.93:1});}this.setMusic(m.stage===3?'battle':'flight');}
 event(e){const a=this.audio;switch(e.type){case'shot':a.sfx(['bw-cannon','bw-rocket','bw-guided'][e.weapon]);break;case'enemyShot':a.sfx('bw-enemy');break;case'pickup':case'delivered':case'supply':a.sfx('bw-rescue');break;case'objective':case'phase':case'success':a.sfx('bw-objective');break;case'radio':a.sfx('bw-radio');break;case'flare':a.sfx('bw-flare');break;case'hit':a.sfx('bw-hit');break;case'failure':a.sfx('bw-warning');this.audio.stopMusic();this.mode='';break;case'empty':a.sfx('bw-empty');break;case'shield':a.sfx('bw-empty');break;}}
}
root.BWSound=SoundBank;
})(globalThis);
