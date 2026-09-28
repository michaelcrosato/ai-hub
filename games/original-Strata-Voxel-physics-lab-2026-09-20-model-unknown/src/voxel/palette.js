function linear(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }
function material(name, hex, roughness, metalness = 0, emission = 0, density = 2200, anchor = false) {
  return Object.freeze({ name, color: [linear(hex >> 16 & 255), linear(hex >> 8 & 255), linear(hex & 255)],
    roughness, metalness, emission, density, anchor });
}
export const MAT = Object.freeze({ AIR: 0, ANCHOR: 1, LIMESTONE: 2, BASALT: 3, SANDSTONE: 4,
  MOSS: 5, LEAF: 6, WOOD: 7, COPPER: 8, GLOW: 9, FLOWER: 10, PALE_LEAF: 11 });
export const PALETTE = Object.freeze([
  material('Air', 0x000000, 1),
  material('Foundation', 0x575750, 0.95, 0, 0, 2600, true),
  material('Limestone', 0xd8cbb2, 0.82),
  material('Basalt', 0x555e5e, 0.88, 0, 0, 2800),
  material('Sandstone', 0xad8164, 0.92),
  material('Moss', 0x748461, 0.98, 0, 0, 1200),
  material('Olive canopy', 0x526d4e, 0.96, 0, 0, 250),
  material('Timber', 0x65503c, 0.9, 0, 0, 650),
  material('Copper', 0xb57749, 0.3, 0.78, 0, 8900),
  material('Amber emitter', 0xffcf76, 0.35, 0.1, 3.5, 1800),
  material('Lavender', 0x9986ae, 0.9, 0, 0, 300),
  material('Sage canopy', 0x98a074, 0.97, 0, 0, 250),
]);
