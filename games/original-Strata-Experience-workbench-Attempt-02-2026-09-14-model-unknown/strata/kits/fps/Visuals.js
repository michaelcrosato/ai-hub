export function createVisual(scene, data, blueprint, playing) {
  const root = scene.group();
  root.position = [...data.position];
  root.rotation = [...data.rotation];
  root.scale = [...data.scale];
  root.visible = !(playing && blueprint.editorOnly);
  root.entityId = data.id;
  for (const p of blueprint.visuals)
    scene.part(root, p.shape, p.position, p.scale, p.color, p.rotation || [0, 0, 0], {
      alpha: p.opacity ?? 1,
      unlit: (p.emissive ?? 0) > 0.5,
      castShadow: (p.opacity ?? 1) === 1,
      entityId: data.id,
    });
  return root;
}
export function buildGun(scene) {
  const root = scene.group();
  const part = (p, s, c) => scene.part(root, 'box', p, s, c, [0, 0, 0], { viewmodel: true, castShadow: false });
  part([0, 0, -0.2], [0.11, 0.14, 0.55], '#32473c');
  part([0, -0.04, -0.43], [0.12, 0.075, 0.3], '#9bad84');
  part([0, -0.18, -0.05], [0.08, 0.24, 0.13], '#1c3028');
  part([0, 0.094, -0.1], [0.055, 0.035, 0.09], '#bfd89c');
  part([0, 0.075, -0.43], [0.035, 0.08, 0.035], '#bad49c');
  part([-0.11, -0.19, 0.04], [0.13, 0.15, 0.24], '#536c57');
  part([0.11, -0.13, -0.25], [0.12, 0.12, 0.21], '#536c57');
  const flash = scene.part(root, 'sphere', [0, 0, -0.68], [0.055, 0.055, 0.1], '#fbe6ad', [0, 0, 0], {
    viewmodel: true,
    unlit: true,
    castShadow: false,
  });
  flash.visible = false;
  return { root, flash };
}
