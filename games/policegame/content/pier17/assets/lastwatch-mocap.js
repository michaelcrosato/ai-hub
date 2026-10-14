/* LASTWATCH: an animation set in my-3D2dge's readable format (written by the tools in tools/; clips may be edited by hand).
 * CMU Graphics Lab Motion Capture Database, subject 141 take 20. Free for all uses; may be copied, modified, or redistributed without permission. Converted by my-3D2dge v0.34.0; selected for Last Watch.
 * 1 clips, 18 key poses. Played by src/mocap/mocap.js with src/mocap/readable.js. "sources" holds the proportions
 * each library was measured with; "fit" each clip's average and worst body-point error against its capture (mm).
 * my-3D2dge readable clip. Times in seconds; every other number is a whole number. Rig frame: forward, right, up.
 * L and R are the figure's own sides. Directions are percentages and need not add up: [100, 0, 0] and [50, 0, 0] agree.
 * hips   [forward, right, up]   the pelvis, in percent of standing hip height (100 = standing, 55 = sitting on a chair)
 * body   [turn, lean, tilt]     the pelvis, degrees: turn + = toward the right, lean + = forward, tilt + = toward the right
 * chest  [turn, lean, tilt]     the chest, relative to the pelvis        head [turn, lean, tilt]  relative to the chest
 * shL shR    [reach, shrug]     degrees the shoulder swings forward (into a punch or an aim) and up, from rest
 * armL armR  [forward, out, up, bend, twist]  which way the arm points from the shoulder to the fist, in chest space
 *            (out + = away from the body on that side; [0, 0, -100] hangs down, [100, 0, 0] punches ahead);
 *            bend = elbow bend in degrees (0 = straight); twist = degrees the elbow swings round the arm from its
 *            natural direction (back and down)
 * legL legR  [forward, out, up, bend, twist]  hip to ankle in pelvis space; bend: the knee; twist: from pointing forward
 * footL footR [down, out, toes]   degrees the foot points down from standing, turns outward, and the toes bend up
 * blade  [forward, right, up]   (sword clips) the direction of a blade held in the right fist, in chest space
 * root   [forward, right]       (clips that travel) how far the whole body has moved, in percent of standing hip height
 */
export const mocapSet = {
"set": "LASTWATCH",
"format": 1,
"credit": "CMU Graphics Lab Motion Capture Database, subject 141 take 20. Free for all uses; may be copied, modified, or redistributed without permission. Converted by my-3D2dge v0.34.0; selected for Last Watch.",
"from": "CMU",
"fps": 30,
"sources": {"CMU_02":{"file":"02.asf","rig":"cmu","label":"CMU motion capture, subject 2 (various expressions and human behaviors)","origin":"CMU Graphics Lab Motion Capture Database (mocap.cs.cmu.edu). The database was created with funding from NSF EIA-0196217.","license":"free for all uses (may be copied, modified, or redistributed without permission)","url":"http://mocap.cs.cmu.edu/search.php?subjectnumber=2","rest":{"H0":962.61,"hipZ":860.85,"ankleZ":71.56,"Pr":[[0.99818,0.06036,0],[-0.06036,0.99818,0],[0,0,1]],"Cr":[[0.99999,0,-0.00392],[0,1,0.00049],[0.00392,-0.00049,0.99999]],"Hr":[[0.99949,-0.00032,0.03182],[0,0.99995,0.00997],[-0.03183,-0.00996,0.99944]],"hip":{"L":[35.3,-93.5,-101.8],"R":[35.3,90.9,-101.8]},"spine":[[-7.9,-1.6,116],[-3.3,-0.8,116.5],[0.2,0,58.4],[0.2,0,58.4]],"neckSeg":[2.9,-2.2,176.5],"clav":{"L":[0.3,-30,7.7],"R":[-4.6,29.4,6.4]},"cv":{"L":[1.8,-170.1,43.5],"R":[-25.9,166.6,36.3]},"topH":[0,0,91.8],"faceH":[119.9,0,-3.8],"up":274.61,"fore":189.4,"knuck":132.02,"fist":147.06,"thigh":428.62,"shin":411.32,"ab":125.41,"bt":62.79,"abPitch":14.1,"btPitch":0,"spineW":[0.55,0.9,1,1],"neckW":0.95}},"CMU_141":{"file":"141.asf","rig":"cmu","label":"CMU motion capture, subject 141 (General Subject Capture)","origin":"CMU Graphics Lab Motion Capture Database (mocap.cs.cmu.edu). The database was created with funding from NSF EIA-0196217.","license":"free for all uses (may be copied, modified, or redistributed without permission)","url":"http://mocap.cs.cmu.edu/search.php?subjectnumber=141","rest":{"H0":859.32,"hipZ":770.58,"ankleZ":68.38,"Pr":[[0.99982,0.01874,0],[-0.01874,0.99982,0],[0,0,1]],"Cr":[[0.98901,0.00029,-0.14788],[0,1,0.00199],[0.14788,-0.00197,0.989]],"Hr":[[0.99576,-0.00006,0.09203],[0,1,0.00062],[-0.09203,-0.00062,0.99576]],"hip":{"L":[84.5,-177.2,-88.7],"R":[84.5,177.2,-88.7]},"spine":[[-9.3,-0.9,110.9],[11.1,-1,106.5],[8.1,-0.1,54.3],[8.1,-0.1,54.3]],"neckSeg":[-22.5,0.1,200.7],"clav":{"L":[0.4,-28.6,12.2],"R":[-3.7,26.2,13.3]},"cv":{"L":[2.3,-162.1,69.3],"R":[-21,148.6,75.6]},"topH":[0,0,103.9],"faceH":[119.5,0,-11],"up":244.24,"fore":185.47,"knuck":117.18,"fist":127.04,"thigh":348.14,"shin":399.12,"ab":94.15,"bt":48.07,"abPitch":4.45,"btPitch":0,"spineW":[0,0.3,1,1],"neckW":0.05}}},
"body": null,
"fit": {"Waiting_Loop":[33,105]},
"clips": {
"Waiting_Loop": {"clip": "Waiting_Loop", "src": "CMU_141", "take": "141_20 3.64-4.58", "dur": 0.933, "loop": true, "tags": ["idle"], "desc": "Waiting impatiently: shifting weight from foot to foot, looking about", "keys": [
  {"t":0,
   "hips":[0,0,102], "body":[-15,9,-10], "chest":[-11,-10,7], "head":[-24,23,0],
   "shL":[0,0], "shR":[0,0], "armL":[-3,24,-97,37,65], "armR":[26,27,-93,13,13],
   "legL":[42,23,-88,28,-9], "legR":[-5,-42,-91,19,-170], "footL":[-32,23,50], "footR":[-15,3,-4]},
  {"t":0.067,
   "hips":[-4,0,103], "body":[-11,11,-7], "chest":[-11,-8,3], "head":[-25,19,1],
   "shL":[0,0], "shR":[0,-1], "armL":[18,20,-96,33,38], "armR":[20,30,-93,0,7],
   "legL":[50,9,-86,32,-6], "legR":[-4,-37,-93,20,-164], "footL":[-35,35,51], "footR":[-15,1,1]},
  {"t":0.1,
   "hips":[-5,0,103], "body":[-10,12,-7], "chest":[-11,-8,3], "head":[-25,20,0],
   "shL":[0,1], "shR":[0,-2], "armL":[31,16,-94,34,24], "armR":[16,33,-93,0,16],
   "legL":[57,-1,-82,28,3], "legR":[-4,-37,-93,15,-166], "footL":[-24,38,53], "footR":[-16,1,1]},
  {"t":0.167,
   "hips":[-5,-1,100], "body":[-5,14,-7], "chest":[-13,-8,3], "head":[-26,22,-2],
   "shL":[0,0], "shR":[0,-3], "armL":[51,12,-85,50,19], "armR":[18,40,-90,0,11],
   "legL":[63,-10,-77,0,3], "legR":[-8,-34,-94,21,-163], "footL":[-31,42,31], "footR":[-15,-5,-2]},
  {"t":0.233,
   "hips":[-3,-2,102], "body":[0,16,-5], "chest":[-13,-9,-3], "head":[-20,21,-3],
   "shL":[0,0], "shR":[0,-4], "armL":[36,36,-86,38,27], "armR":[29,26,-92,0,10],
   "legL":[61,-11,-78,0,-4], "legR":[-14,-30,-94,22,-143], "footL":[-55,36,-4], "footR":[-10,-3,14]},
  {"t":0.3,
   "hips":[-1,-4,104], "body":[10,14,-5], "chest":[-15,-8,-6], "head":[-14,22,-5],
   "shL":[1,0], "shR":[-1,-6], "armL":[9,50,-86,26,37], "armR":[46,13,-88,13,23],
   "legL":[50,-9,-86,0,26], "legR":[-23,-19,-95,22,-95], "footL":[-68,47,-27], "footR":[8,-12,-7]},
  {"t":0.4,
   "hips":[2,-7,104], "body":[12,11,-4], "chest":[-15,-10,-10], "head":[2,22,-5],
   "shL":[1,0], "shR":[-1,-8], "armL":[8,49,-87,24,12], "armR":[43,12,-90,14,14],
   "legL":[41,-10,-91,15,15], "legR":[-31,-5,-95,28,-6], "footL":[-35,36,31], "footR":[42,15,-15]},
  {"t":0.433,
   "hips":[2,-8,103], "body":[11,9,-1], "chest":[-15,-9,-13], "head":[3,23,-4],
   "shL":[1,0], "shR":[-1,-8], "armL":[21,49,-85,29,2], "armR":[37,14,-92,0,21],
   "legL":[35,-19,-92,25,16], "legR":[-33,3,-94,42,-4], "footL":[-32,35,32], "footR":[46,31,-4]},
  {"t":0.467,
   "hips":[2,-8,103], "body":[9,8,0], "chest":[-14,-9,-13], "head":[6,20,-6],
   "shL":[1,0], "shR":[-1,-7], "armL":[37,47,-80,28,-1], "armR":[30,18,-94,0,24],
   "legL":[29,-27,-92,35,39], "legR":[-26,3,-97,52,-1], "footL":[-39,35,18], "footR":[36,24,12]},
  {"t":0.533,
   "hips":[1,-7,103], "body":[2,9,1], "chest":[-10,-9,-13], "head":[9,14,-7],
   "shL":[1,0], "shR":[-1,-8], "armL":[53,47,-71,32,-3], "armR":[20,22,-95,0,18],
   "legL":[28,-36,-89,39,49], "legR":[3,0,-100,51,17], "footL":[-31,31,21], "footR":[3,14,22]},
  {"t":0.567,
   "hips":[0,-6,103], "body":[-1,10,1], "chest":[-9,-8,-13], "head":[9,11,-8],
   "shL":[1,1], "shR":[-1,-9], "armL":[57,48,-67,28,-2], "armR":[18,24,-95,0,18],
   "legL":[30,-37,-88,37,32], "legR":[23,-3,-97,39,37], "footL":[-29,28,24], "footR":[-10,2,27]},
  {"t":0.6,
   "hips":[0,-5,103], "body":[-4,10,1], "chest":[-9,-7,-11], "head":[6,13,-12],
   "shL":[1,0], "shR":[-1,-8], "armL":[55,48,-68,19,-2], "armR":[15,27,-95,0,24],
   "legL":[29,-37,-88,37,16], "legR":[34,-9,-93,22,58], "footL":[-27,25,28], "footR":[-14,-14,29]},
  {"t":0.633,
   "hips":[2,-4,103], "body":[-8,10,2], "chest":[-8,-8,-10], "head":[-2,22,-13],
   "shL":[0,0], "shR":[0,-7], "armL":[46,51,-72,0,1], "armR":[12,28,-95,0,14],
   "legL":[26,-37,-89,35,-5], "legR":[32,-10,-94,15,73], "footL":[-23,20,34], "footR":[-10,-15,22]},
  {"t":0.733,
   "hips":[5,-3,104], "body":[-13,7,-4], "chest":[-9,-8,0], "head":[-16,29,-9],
   "shL":[0,-1], "shR":[0,-4], "armL":[0,49,-87,22,46], "armR":[26,27,-93,0,16],
   "legL":[23,-10,-97,37,-7], "legR":[6,-24,-97,19,195], "footL":[8,18,74], "footR":[-17,-5,0]},
  {"t":0.8,
   "hips":[6,0,102], "body":[-15,7,-12], "chest":[-9,-8,8], "head":[-17,28,-9],
   "shL":[0,0], "shR":[-1,-3], "armL":[-20,43,-88,30,75], "armR":[36,26,-89,18,22],
   "legL":[24,20,-95,59,34], "legR":[-3,-43,-90,20,213], "footL":[15,46,77], "footR":[-19,3,-8]},
  {"t":0.833,
   "hips":[6,0,100], "body":[-14,7,-16], "chest":[-10,-9,12], "head":[-20,29,-7],
   "shL":[0,1], "shR":[0,-3], "armL":[-24,36,-90,37,75], "armR":[37,30,-88,21,21],
   "legL":[28,36,-89,50,31], "legR":[-4,-50,-87,18,211], "footL":[-16,50,64], "footR":[-19,2,-9]},
  {"t":0.867,
   "hips":[4,0,100], "body":[-15,7,-14], "chest":[-11,-8,12], "head":[-20,27,-4],
   "shL":[1,0], "shR":[0,-1], "armL":[-16,26,-95,37,72], "armR":[36,33,-87,17,7],
   "legL":[34,33,-88,35,12], "legR":[-4,-47,-88,19,200], "footL":[-32,33,46], "footR":[-17,1,-8]},
  {"t":0.933,
   "hips":[0,0,102], "body":[-15,9,-10], "chest":[-11,-10,7], "head":[-24,23,0],
   "shL":[0,0], "shR":[0,0], "armL":[-3,24,-97,37,65], "armR":[26,27,-93,13,13],
   "legL":[42,23,-88,28,-9], "legR":[-5,-42,-91,19,190], "footL":[-32,23,50], "footR":[-15,3,-4]}
]}
}};

export default mocapSet;
