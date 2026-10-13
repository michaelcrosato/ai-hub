/* Original score: Port Meridian, 128 BPM. All notes and sounds are generated locally. */
(function () {
  const repeat = (s, n) => Array(n).fill(s).join(' | ');
  const combat = { bpm:128, steps:4, tracks:[
    {wave:'triangle',vol:.27,gate:.58,notes:'D2 . D2 D3 . D2 . A2 D2 . D2 . F2 . C3 . | D2 . D2 D3 . D2 . A2 D2 . F2 . C3 . A2 . | Bb1 . Bb1 Bb2 . Bb1 . F2 Bb1 . Bb1 . D2 . A2 . | C2 . C2 C3 . C2 . G2 C2 . G2 . Bb2 . C3 .'},
    {wave:'saw',vol:.043,gate:.6,notes:'D3 . . D3 . . A3 . D3 . F3 . . C4 . . | D3 . . D3 . . A3 . D3 . F3 . . E3 . . | Bb2 . . Bb2 . . F3 . Bb2 . D3 . . A3 . . | C3 . . C3 . . G3 . C3 . G3 . . Bb3 . .'},
    {wave:'sine',vol:.095,gate:.75,notes:'D5 - . . A4 . . . F5 - . . E5 . C5 . | D5 - . . A4 . . . C5 - . . A4 . . . | D5 - . . F5 . . . A5 - . . F5 . E5 . | E5 - . . C5 . . . G4 - . . C5 . E5 .'},
    {wave:'drums',vol:.16,notes:repeat('k . h . s . h . k . h k s . h o',4)},
    {wave:'sine',vol:.025,gate:.94,notes:'D4 - - - - - - - A3 - - - - - - - | F4 - - - - - - - E4 - - - - - - - | Bb3 - - - - - - - F4 - - - - - - - | C4 - - - - - - - G4 - - - - - - -'}
  ]};
  const quiet = { bpm:64,steps:2,tracks:[
    {wave:'triangle',vol:.095,gate:.95,notes:'D3 - - - - - . . | Bb2 - - - - - . . | F3 - - - - - . . | C3 - - - - - . .'},
    {wave:'sine',vol:.07,gate:.9,notes:'A4 - . . F4 - . . | E4 - . . D4 - . . | A4 - . . C5 - . . | G4 - . . E4 - . .'}
  ]};
  window.SableAudio = { combat, quiet, setup(audio) {
    audio.define('pistol',[{wave:'noise',freq:3400,to:280,dur:.11,vol:.46,filter:'lowpass'},{wave:'sine',freq:125,to:40,dur:.1,vol:.6}]);
    audio.define('shotgun',[{wave:'noise',freq:1700,to:130,dur:.24,vol:.62,filter:'lowpass'},{wave:'triangle',freq:90,to:30,dur:.23,vol:.45}]);
    audio.define('baton',[{wave:'noise',freq:1000,to:180,dur:.09,vol:.39,filter:'lowpass'},{wave:'sine',freq:90,to:35,dur:.1,vol:.5}]);
    audio.define('finish',[{wave:'noise',freq:600,to:120,dur:.18,vol:.44,filter:'lowpass'},{wave:'sine',freq:110,to:28,dur:.19,vol:.48}]);
    audio.define('glass',[{wave:'noise',freq:5800,to:1200,dur:.3,vol:.18,filter:'highpass'}]);
    audio.define('signal',[{wave:'sine',freq:780,to:130,dur:.5,vol:.25},{wave:'noise',freq:1200,to:250,dur:.35,vol:.12}]);
    audio.define('empty',{wave:'noise',freq:1800,to:800,dur:.025,vol:.17});
    audio.define('slam',[{wave:'noise',freq:600,to:150,dur:.18,vol:.36,filter:'lowpass'},{wave:'sine',freq:80,to:35,dur:.13,vol:.4}]);
    audio.define('tape',{wave:'sine',freq:660,arp:[0,7,12,19],step:.12,dur:.6,vol:.24});
    audio.define('failure',[{wave:'saw',freq:140,to:25,dur:.65,vol:.10},{wave:'noise',freq:1000,to:50,dur:.5,vol:.14,filter:'lowpass'}]);
  }};
})();
