/* FRONTIER_IDLE: an animation set in my-3D2dge's readable format (written by the tools in tools/; clips may be edited by hand).
 * Quaternius Universal Animation Library, CC0; converted by my-3D2dge
 * 1 clips, 7 key poses. Played by src/mocap/mocap.js with src/mocap/readable.js. "sources" holds the proportions
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
(window.MOCAP = window.MOCAP || {})["FRONTIER_IDLE"] = {
"set": "FRONTIER_IDLE",
"format": 1,
"credit": "Quaternius Universal Animation Library, CC0; converted by my-3D2dge",
"from": "QUATERNIUS",
"fps": 30,
"sources": {"UAL1":{"file":"AnimationLibrary_Godot_Standard.glb","rig":"rigify","label":"Quaternius Universal Animation Library 1","origin":"Universal Animation Library by Quaternius: the free Standard edition (45 clips and a T-pose), as Quaternius exports it for Godot","license":"CC0 1.0","url":"https://quaternius.com/packs/universalanimationlibrary.html","rest":{"H0":916.7,"hipZ":932.1,"ankleZ":103.7,"Pr":[[1,0,0],[0,1,0],[0,0,1]],"Cr":[[0.99948,0,0.03239],[0,1,0],[-0.03239,0,0.99948]],"Hr":[[0.99947,0,-0.03252],[0,1,0],[0.03252,0,0.99947]],"hip":{"L":[51.5,-89,15.4],"R":[51.5,89,15.4]},"spine":[[34.5,0,133.8],[15.2,0,123.1],[-4.5,0,141.2],[-5.6,0,172.8]],"neckSeg":[15.6,0,81.1],"clav":{"L":[80.9,-18.8,-32.3],"R":[80.9,18.8,-32.3]},"cv":{"L":[-137.3,-173.1,-12.7],"R":[-137.3,173.1,-12.7]},"topH":[0,0,256],"faceH":[119.9,0,3.9],"up":274.44,"fore":272.64,"knuck":121.71,"fist":163.93,"thigh":400.31,"shin":429.48,"ab":173.3,"bt":92.24,"abPitch":30.71,"btPitch":0,"spineW":[0,0,0.25,1],"neckW":0.45}},"UAL2":{"file":"UAL2_Standard.glb","rig":"unreal","label":"Quaternius Universal Animation Library 2","origin":"Universal Animation Library 2 by Quaternius: the free Standard edition (42 clips), as Quaternius exports it for Unreal and Godot","license":"CC0 1.0","url":"https://quaternius.com/packs/universalanimationlibrary2.html","rest":{"H0":916.7,"hipZ":932.1,"ankleZ":103.7,"Pr":[[1,0,0],[0,1,0],[0,0,1]],"Cr":[[0.99948,0,0.03239],[0,1,0],[-0.03239,0,0.99948]],"Hr":[[0.99947,0,-0.03252],[0,1,0],[0.03252,0,0.99947]],"hip":{"L":[51.5,-89,15.4],"R":[51.5,89,15.4]},"spine":[[34.5,0,133.8],[15.2,0,123.1],[-4.5,0,141.2],[-5.6,0,172.8]],"neckSeg":[15.6,0,81.1],"clav":{"L":[80.9,-18.8,-32.3],"R":[80.9,18.8,-32.3]},"cv":{"L":[-137.3,-173.1,-12.7],"R":[-137.3,173.1,-12.7]},"topH":[0,0,256],"faceH":[119.9,0,3.9],"up":274.44,"fore":272.64,"knuck":121.71,"fist":163.93,"thigh":400.31,"shin":429.48,"ab":173.3,"bt":78.9,"abPitch":30.71,"btPitch":0,"spineW":[0,0,0.55,1],"neckW":0.65}}},
"body": {"height":1829,"segs":[{"a":"pelvis","b":"spine1","r":[134,141,140]},{"a":"spine1","b":"spine2","r":[122,128,124]},{"a":"spine2","b":"chest","r":[117,140,153]},{"a":"chest","b":"neck","r":[184,204,176]},{"a":"neck","b":"head","r":[57,122,84]},{"a":"head","b":"headTop","r":[94,106,98]},{"a":"clavL","b":"shL","r":[127,95,82]},{"a":"shL","b":"elbowL","r":[76,71,55]},{"a":"elbowL","b":"wristL","r":[54,65,46]},{"a":"wristL","b":"knuckL","r":[36,49,49]},{"a":"hipL","b":"kneeL","r":[87,98,67]},{"a":"kneeL","b":"ankleL","r":[61,90,48]},{"a":"ankleL","b":"ballL","r":[97,66,58]},{"a":"ballL","b":"toeL","r":[65,47,38]},{"a":"clavR","b":"shR","r":[145,95,82]},{"a":"shR","b":"elbowR","r":[76,71,55]},{"a":"elbowR","b":"wristR","r":[54,65,46]},{"a":"wristR","b":"knuckR","r":[36,49,49]},{"a":"hipR","b":"kneeR","r":[87,98,67]},{"a":"kneeR","b":"ankleR","r":[61,90,48]},{"a":"ankleR","b":"ballR","r":[97,66,58]},{"a":"ballR","b":"toeR","r":[65,47,38]}],"bands":[{"a":"spine1","b":"spine2","t0":0.16,"t1":0.31,"r":120},{"a":"spine2","b":"chest","t0":0.22,"t1":0.26,"r":115},{"a":"spine2","b":"chest","t0":0.4,"t1":0.44,"r":135},{"a":"spine2","b":"chest","t0":0.54,"t1":0.55,"r":125},{"a":"spine2","b":"chest","t0":0.64,"t1":0.66,"r":126},{"a":"neck","b":"head","t0":0.22,"t1":0.26,"r":57},{"a":"neck","b":"head","t0":0.4,"t1":0.42,"r":57},{"a":"neck","b":"head","t0":0.88,"t1":0.89,"r":84},{"a":"head","b":"headTop","t0":0.09,"t1":0.22,"r":87},{"a":"head","b":"headTop","t0":0.35,"t1":0.37,"r":98},{"a":"shL","b":"elbowL","t0":0.94,"t1":1.02,"r":50},{"a":"elbowL","b":"wristL","t0":0,"t1":0.07,"r":47},{"a":"elbowL","b":"wristL","t0":0.97,"t1":0.98,"r":39},{"a":"hipL","b":"kneeL","t0":-0.18,"t1":0.13,"r":86},{"a":"hipL","b":"kneeL","t0":0.92,"t1":1.02,"r":64},{"a":"kneeL","b":"ankleL","t0":-0.01,"t1":0.14,"r":63},{"a":"kneeL","b":"ankleL","t0":0.93,"t1":1.02,"r":47},{"a":"shR","b":"elbowR","t0":0.94,"t1":1.02,"r":50},{"a":"elbowR","b":"wristR","t0":0,"t1":0.07,"r":47},{"a":"elbowR","b":"wristR","t0":0.97,"t1":0.98,"r":39},{"a":"hipR","b":"kneeR","t0":-0.18,"t1":0.13,"r":86},{"a":"hipR","b":"kneeR","t0":0.92,"t1":1.02,"r":64},{"a":"kneeR","b":"ankleR","t0":-0.01,"t1":0.14,"r":63},{"a":"kneeR","b":"ankleR","t0":0.93,"t1":1.02,"r":47}]},
"fit": {"Idle_FoldArms_Loop":[18,101]},
"clips": {
"Idle_FoldArms_Loop": {"clip": "Idle_FoldArms_Loop", "src": "UAL2", "dur": 2.5, "loop": true, "tags": ["idle","talk"], "desc": "standing with the arms folded across the chest, shifting weight: waiting, listening", "keys": [
  {"t":0,
   "hips":[-9,-1,96], "body":[13,-5,0], "chest":[0,19,0], "head":[-11,-3,0],
   "shL":[7,-3], "shR":[-6,-2], "armL":[28,-89,-35,116,-99], "armR":[44,-90,-4,118,53],
   "legL":[5,17,-98,11,3], "legR":[-31,14,-94,0,-48], "footL":[5,8,0], "footR":[4,32,0]},
  {"t":0.7,
   "hips":[-10,0,95], "body":[13,-4,0], "chest":[0,20,0], "head":[-11,-3,0],
   "shL":[6,-5], "shR":[-6,-5], "armL":[32,-90,-31,117,-95], "armR":[45,-89,1,116,52],
   "legL":[8,19,-98,15,5], "legR":[-29,13,-95,12,-37], "footL":[4,8,0], "footR":[3,32,0]},
  {"t":0.9,
   "hips":[-10,0,95], "body":[13,-4,0], "chest":[0,21,0], "head":[-11,-4,0],
   "shL":[6,-4], "shR":[-6,-4], "armL":[31,-90,-32,117,-97], "armR":[45,-89,0,116,52],
   "legL":[6,18,-98,18,6], "legR":[-29,13,-95,14,-38], "footL":[-5,8,0], "footR":[3,32,0]},
  {"t":1.067,
   "hips":[-10,0,95], "body":[13,-5,0], "chest":[0,21,0], "head":[-11,-4,0],
   "shL":[6,-3], "shR":[-6,-3], "armL":[32,-89,-32,117,-97], "armR":[46,-89,-1,116,53],
   "legL":[6,19,-98,17,3], "legR":[-31,13,-94,15,-36], "footL":[5,8,0], "footR":[4,32,0]},
  {"t":1.267,
   "hips":[-9,0,96], "body":[13,-5,0], "chest":[0,19,0], "head":[-11,-3,0],
   "shL":[7,-3], "shR":[-6,-3], "armL":[28,-89,-35,116,-99], "armR":[44,-90,-3,118,53],
   "legL":[3,18,-98,12,3], "legR":[-32,13,-94,0,-42], "footL":[-4,8,0], "footR":[4,32,0]},
  {"t":2.033,
   "hips":[-10,0,95], "body":[13,-4,0], "chest":[0,21,0], "head":[-13,-4,-1],
   "shL":[6,-5], "shR":[-6,-5], "armL":[32,-90,-31,118,-96], "armR":[45,-89,1,115,52],
   "legL":[8,19,-98,15,6], "legR":[-29,13,-95,12,-37], "footL":[4,8,0], "footR":[3,32,0]},
  {"t":2.5,
   "hips":[-9,-1,96], "body":[13,-5,0], "chest":[0,19,0], "head":[-11,-3,0],
   "shL":[7,-3], "shR":[-6,-2], "armL":[28,-89,-35,116,-99], "armR":[44,-90,-4,118,53],
   "legL":[5,17,-98,11,3], "legR":[-31,14,-94,0,-48], "footL":[5,8,0], "footR":[4,32,0]}
]}
}};
