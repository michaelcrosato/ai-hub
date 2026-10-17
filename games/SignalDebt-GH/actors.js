// Original Port Sable characters on the engine's reusable humanoid rig.
// Call move() once per fixed step, then update() once per rendered frame.
import {
  compileClips, ContactShadow, HERO_CLIPS, HERO_MODEL, HERO_RIG,
  PALETTE, PlatformerCharacter, setLookLayer, THREE, toonMaterial,
} from './pixel-engine.js';
import {equipment, PULSE_EMITTER} from './equipment.js';

const { Vector3, Mesh, BoxGeometry } = THREE;

// The controller can request these transitions without a button press (e.g. walking
// off a curb). Keep them with the locomotion clips instead of allowing a missing pose.
export const ACTOR_CLIP_NAMES = Object.freeze([
  'Idle', 'IdleLook', 'Teeter', 'Tiptoe', 'Walk', 'Run', 'Skid', 'SkidTurn',
  'StepUp', 'StepDown', 'Jump', 'JumpUp', 'Fall', 'Land', 'HardLand',
  'WallSlide', 'Slide', 'Hurt', 'Roll', 'Victory',
]);
const AIM_POSE={ArmR:[-78,0,-8],ForearmR:[-12,0,0],ArmL:[-65,0,25],ForearmL:[-35,0,0]};
const walkSource=HERO_CLIPS.find(clip=>clip.name==='Walk');
export const AIM_CLIPS=[
 {name:'SignalAim',frames:60,loop:true,grounded:true,keys:[[0,AIM_POSE],[60,AIM_POSE]]},
 {...walkSource,name:'SignalAimWalk',keys:walkSource.keys.map(([frame,pose,ease])=>[frame,{...pose,...AIM_POSE},ease])}
];
export const ACTOR_CLIPS = [...HERO_CLIPS.filter(clip => ACTOR_CLIP_NAMES.includes(clip.name)),...AIM_CLIPS];
let compiledClips;

/** Recolor clones by assigning cached materials: never mutate the shared originals. */
export function styleActor(model, { color = 'teal', role = 'player' } = {}) {
  const coat = PALETTE[color] ?? PALETTE.teal;
  const skin = role === 'pedestrian' ? PALETTE.orange : PALETTE.sand;
  model.traverse(part => {
    if (!part.isMesh) return;
    const name = part.name;
    part.castShadow = false;
    part.receiveShadow = true;
    if (['Brim', 'Moustache', 'ButtonR', 'ButtonL'].includes(name)) {
      part.visible = false;
      return;
    }
    let tint = PALETTE.ink;
    if (/Shirt|Sleeve|Forearm/.test(name)) tint = coat;
    else if (/Face|Nose|Glove/.test(name)) tint = skin;
    else if (name === 'Hat') tint = role === 'player' ? PALETTE.teal : PALETTE.ink;
    else if (name === 'Overalls') tint = role === 'enemy' ? PALETTE.navy : PALETTE.night;
    else if (/Shin|Thigh/.test(name)) tint = PALETTE.night;
    else if (/Shoe/.test(name)) tint = role === 'player' ? PALETTE.sand : PALETTE.ink;
    part.material = toonMaterial(tint);
    if (name === 'Hat') part.scale.y = 0.55; // short knit cap, no bill
    if (name === 'Nose') part.scale.set(0.65, 0.75, 0.65);
  });
  // A radio patch makes Ren recognizable from the chase camera. Contractor armor
  // gets a different patch, without any borrowed insignia or lettering.
  const torso = model.getObjectByName('Torso');
  if (torso && !torso.getObjectByName('PortSablePatch')) {
    const patch = new Mesh(new BoxGeometry(0.15, 0.19, 0.03), toonMaterial(role === 'enemy' ? PALETTE.red : PALETTE.orange));
    patch.name = 'PortSablePatch';
    patch.position.set(-0.15, 0.1, -0.16);
    torso.add(patch);
  }
  setLookLayer(model, 'actors');
  return model;
}

class CityCharacter extends PlatformerCharacter {
  dodgeTime = 0;
  // This district has walking, vault-free alleys and a rideable lift. The kit's
  // automatic platformer ledge hang would capture a player with no climb control.
  findLedge() { return null; }
  animationFor() {
    if (this.dodgeTime > 0) return { name: 'Roll', once: true, fade: 0.035 };
    if (this.aiming && this.grounded) return this.speed>.1?{name:'SignalAimWalk',speed:Math.max(.2,this.speed/walkSource.speed),fade:.08}:{name:'SignalAim',fade:.08};
    const request = super.animationFor();
    // The urban controls never request the platformer's combo moves. A rare
    // geometry-driven pose (such as a grab) still has a safe visible fallback.
    return ACTOR_CLIP_NAMES.includes(request.name) ? request : { name: this.grounded ? 'Idle' : 'Fall', fade: 0.08 };
  }
}

/** x/z are world-space analog movement axes; face(yaw) applies to the next step. */
export async function createActor(ctx, { at = [0, 0, 0], color = 'teal', role = 'player' } = {}) {
  const model = (await ctx.loadModel(HERO_MODEL, { castShadow: false })).scene;
  // Compile against the untouched rest transform once; AnimationClips can be shared
  // by mixers, whereas scene nodes and their animation state cannot.
  compiledClips ??= compileClips(ACTOR_CLIPS, HERO_RIG, model);
  styleActor(model, { color, role });
  if(role!=='pedestrian'){
    const emitter=equipment(PULSE_EMITTER);emitter.name='PulseEmitter';emitter.position.set(0,-.03,.07);emitter.rotation.x=Math.PI/2;
    (model.getObjectByName('HandR')??model.getObjectByName('ForearmR')).add(emitter);
  }
  const hero = new CityCharacter(ctx.physics, { position: [...at], runSpeed: role === 'player' ? 7.8 : 5.5 });
  hero.attachModel(model, compiledClips, HERO_RIG);
  hero.shove = role === 'player' ? 0.8 : 0;
  const shadow = new ContactShadow(0.4);
  ctx.scene.add(model, shadow);
  const move = new Vector3();
  const facing = new Vector3();
  const dodgeDirection = new Vector3();
  const feet = new Vector3();
  const groundOrigin = new Vector3();
  const input = { move, jump: false, jumpHeld: false, crouch: false, walk: false, face: null };
  let pendingFace = null;
  let dodgeCooldown = 0;
  let disposed = false;
  let hadDodge = false;

  const actor = {
    model, hero, shadow, role,
    setAiming(value) { hero.aiming=!!value; },
    get dodging() { return hero.dodgeTime > 0; },
    get dodgeCooldown() { return dodgeCooldown; },
    face(yaw) {
      if (Number.isFinite(yaw)) pendingFace = yaw;
    },
    move(dt, { x = 0, z = 0, sprint = false, dodge = false } = {}) {
      if (disposed) return;
      dodgeCooldown = Math.max(0, dodgeCooldown - dt);
      hero.dodgeTime = Math.max(0, hero.dodgeTime - dt);
      move.set(Number.isFinite(x) ? x : 0, 0, Number.isFinite(z) ? z : 0);
      if (move.lengthSq() > 1) move.normalize();
      if (dodge && !hadDodge && dodgeCooldown === 0 && hero.grounded) {
        if (move.lengthSq() > 0.02) dodgeDirection.copy(move).normalize();
        else hero.forwardInto(dodgeDirection);
        hero.facing = Math.atan2(dodgeDirection.x, dodgeDirection.z);
        hero.dodgeTime = 14 / 30;
        dodgeCooldown = 1.25;
        // A small launch keeps the rig's planted-foot solver out of the tucked
        // portion of the roll. Rapier still sweeps the body against solid geometry.
        hero.launch(3.7, { hvel: dodgeDirection.clone().multiplyScalar(8.5), kind: 'Jump' });
        ctx.audio.play('sd-dodge', { volume: 0.5 });
      }
      hadDodge = dodge;
      if (hero.dodgeTime > 0) {
        move.copy(dodgeDirection);
        input.walk = false;
        input.face = null;
      } else {
        // Normal travel is a brisk jog; full sprint and gentle analog movement
        // remain distinct without enabling the engine's crouch/attack key map.
        if (!sprint) move.multiplyScalar(0.6);
        input.walk = false;
        input.face = pendingFace === null ? null : facing.set(Math.sin(pendingFace), 0, Math.cos(pendingFace));
      }
      pendingFace = null;
      hero.fixedUpdate(dt, input);
    },
    update(dt) {
      if (disposed) return;
      hero.updateVisual(model, dt, ctx.physics.alpha);
      hero.feetInto(feet);
      groundOrigin.set(feet.x, feet.y + 0.2, feet.z);
      const ground = ctx.physics.groundBelow(groundOrigin, 30, hero.body);
      shadow.visible = model.visible && !!ground;
      if (ground) shadow.place(model.position.x, ground.y, model.position.z, Math.max(0, model.position.y - ground.y));
    },
    position(out = new Vector3()) { return hero.feetInto(out); },
    teleport(position) {
      hero.dodgeTime = 0;
      dodgeCooldown = 0;
      hadDodge = false;
      hero.teleport([...position]);
      model.position.set(...position);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      ctx.scene.remove(model, shadow);
      ctx.physics.remove(hero.body);
      ctx.physics.world.removeCharacterController(hero.kcc);
      // Model geometry and toon materials are cached by the engine and shared by
      // other characters. Their owner is responsible for freeing them at unload.
    },
  };
  actor.update(0);
  return actor;
}

export function createPedestrian(ctx, options = {}) {
  return createActor(ctx, { color: 'slate', ...options, role: 'pedestrian' });
}
