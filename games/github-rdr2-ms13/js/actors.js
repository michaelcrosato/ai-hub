// RED HARROW — procedural characters, horses, animals, pickups.
export const ROLE_STYLE = {
  player: { outfit: 'coat', hat: 'cap', colors: { cloth: '#5a3a28', coat: '#4a3020', pants: '#3a3230', hair: '#2a2018', skin: '#d8a878', hat: '#3a2a1a' } },
  gang: { outfit: 'shirt', hat: 'cap', colors: { cloth: '#6a5a48', pants: '#3a3230', hair: '#4a3828', skin: '#d8a878' } },
  law: { outfit: 'coat', hat: 'cap', colors: { cloth: '#2a3a5a', coat: '#1f2a44', pants: '#1a1a22', skin: '#d8a878' } },
  bandit: { outfit: 'shirt', hat: null, colors: { cloth: '#7a3a2a', pants: '#2e2a26', hair: '#1f1610', skin: '#c89870' } },
  soldier: { outfit: 'coat', hat: 'cap', colors: { cloth: '#3a4a3a', coat: '#2c382c', pants: '#2a2a30', skin: '#d0a075' } },
  town: { outfit: 'shirt', hat: 'cap', colors: { cloth: '#8a8078', pants: '#4a4440', hair: '#6a5a48', skin: '#d8a878' } },
  lady: { outfit: 'robe', hat: null, colors: { cloth: '#7a4a6a', hair: '#8a5a2a', skin: '#e0b088' } },
  priest: { outfit: 'robe', hat: null, colors: { cloth: '#2a2a2a', hair: '#888888', skin: '#d8a878' } },
  native: { outfit: 'shirt', hat: null, colors: { cloth: '#a87848', pants: '#6a4a2a', hair: '#181008', skin: '#b07a4a' } },
  boss: { outfit: 'coat', hat: 'cap', colors: { cloth: '#8a1a1a', coat: '#5a1010', pants: '#1a1a1a', hair: '#101010', skin: '#d8a878' } },
};

export function npcStyle(id) {
  if (/AGENT|HALE|QUILL|GUARD|DEPUTY|SHERIFF|BOUNTY|LAW/.test(id)) return 'law';
  if (/MORAN|RAIDER|LOOTER|RUSTLER|THUG|POACHER|ROAD_AGENT|HECKLER|PURSUER|AMBUSHER|CLAIM|RATTLER_MAN|VECCHIO_MAN|ASHFORD_MAN|COLBRAND_MAN|SOLDIER|OVERSEER/.test(id)) return 'bandit';
  if (/COLE_RATTLER|KETT|GOV_CAZAL|COL_MARROW|DON_VECCHIO|AGENT_QUILL/.test(id)) return 'boss';
  if (/ADA_WARD|POPPY_ASHFORD|MONA_FAYE|KITTY_QUINN|MERCY_HART|WILLA_MARSH|MATRON_ASHFORD|MRS_GADDIS|NORA_ELLISON/.test(id)) return 'lady';
  if (/REV_HALLORAN/.test(id)) return 'priest';
  if (/CHIEF_TALL_PINE|YOUNG_HAWK/.test(id)) return 'native';
  if (/CADE_HOLLIS|ELI_WARD/.test(id)) return 'player';
  return 'gang';
}

export function makeRig(E, style, weapon = 'gun') {
  const s = ROLE_STYLE[style] || ROLE_STYLE.gang;
  return new E.Humanoid({ size: 1.25, weapon, outfit: s.outfit, hat: s.hat, hair: 'short', colors: s.colors });
}

// String-sprite sets. Built once per game (E.sprite is pure).
export function makeSprites(E) {
  const px = (rows, pal, scale = 1) => E.sprite(rows, pal, scale);
  const horseBody = ['....hhhh......', '...hhhhhhmm...', '..hhhhhhhh....', '.hhhhhhhhhh...', '.dhhhhhhhhd...', '..hh.hh.hh....', '..h...h..h....'];
  return {
    horse: px(horseBody, { h: '#7a5230', m: '#3a2a1a', d: '#2a2018' }, 2),
    horseDark: px(horseBody, { h: '#3a2e24', m: '#14100c', d: '#0c0a08' }, 2),
    strongbox: px(['bbbbbb', 'byyyyb', 'bbbbbb'], { b: '#5a4028', y: '#e8c040' }, 2),
    pickup: px(['.ww.', 'wwww', 'wwww', '.ww.'], { w: '#ffe08a' }, 1),
    herb: px(['.g.', 'ggg', '.g.', '.b.'], { g: '#40a040', b: '#7a5230' }, 1),
    fish: px(['..ff...', '.fffft.', '..ff...'], { f: '#7ab8d8', t: '#4a8898' }, 1),
    pelt: px(['ppppp', 'pwwwp', 'ppppp'], { p: '#8a5a32', w: '#d8b088' }, 1),
    gold: px(['gg', 'gg'], { g: '#ffd83a' }, 2),
    debt: px(['wwww', 'wbbw', 'wbbw', 'wwww'], { w: '#e8e0d0', b: '#3a3a4a' }, 1),
    hay: px(['yyyy', 'yyyy', 'yyyy'], { y: '#d8b83a' }, 1),
    lumber: px(['nnnnn', 'nnnnn'], { n: '#8a5f36' }, 2),
    water: px(['.b.', 'bbb', '.b.'], { b: '#4a90d8' }, 2),
    cane: px(['g.g', 'g.g', 'g.g', 'g.g'], { g: '#6aa848' }, 1),
    letter: px(['www', 'wbw', 'www'], { w: '#f0ead8', b: '#a83a3a' }, 1),
    tools: px(['ttt', '.t.', '.t.'], { t: '#9aa3b8' }, 1),
    marker: px(['..y..', '..y..', '..y..', '.....', '..y..'], { y: '#ffd83a' }, 1),
  };
}

export function pickupSpriteFor(sprites, item) {
  if (/GOLD|STRONGBOX|OIL_BONDS|BLACK_BOOK|LEDGER_PAGE|BONDS/.test(item)) return sprites.strongbox;
  if (/FISH/.test(item)) return sprites.fish;
  if (/PELT|HIDE/.test(item)) return sprites.pelt;
  if (/DEBT|LETTER|INVITATION/.test(item)) return sprites.debt;
  if (/HAY|CANE/.test(item)) return sprites.hay;
  if (/LUMBER/.test(item)) return sprites.lumber;
  if (/WATER/.test(item)) return sprites.water;
  if (/TOOLS/.test(item)) return sprites.tools;
  if (/SUPPLIES|RIFLE|CATTLE|HERB|GLUE|BEER|MILK/.test(item)) return sprites.pickup;
  return sprites.pickup;
}

export function makeAnimal(E, kind) {
  // Small critters = Blob rigs; big game = tinted Blobs with ears/horns.
  const big = /BEAR|GREY_MAW|GATOR|OLD_IVORY|BISON|ELK|MOOSE|COUGAR|PANTHER/.test(kind);
  const colors = /WOLF|COYOTE/.test(kind) ? { base: '#8a8078', dk: '#4a4440', lt: '#b8b0a8' }
    : /GATOR/.test(kind) ? { base: '#3f7a3a', dk: '#1f4020', lt: '#6aa848' }
    : /BEAR|GREY_MAW/.test(kind) ? { base: '#5a4028', dk: '#2e2014', lt: '#8a6a42' }
    : /RABBIT|HARE/.test(kind) ? { base: '#b8a890', dk: '#7a6a58', lt: '#e0d4c0' }
    : { base: '#7a6a52', dk: '#453c30', lt: '#a89478' };
  const rig = new E.Blob({ R: big ? 9 : 5, colors, ears: /RABBIT|HARE|FOX|WOLF|COYOTE/.test(kind) ? 'rabbit' : undefined, feet: true, mouth: big ? 'fangs' : true });
  return rig;
}

export function isAnimalTag(tag) {
  return /RABBIT|WOLF|GATOR|GREY_MAW|OLD_IVORY|BEAR|COYOTE|DEER|BOAR|BISON|FOX|COUGAR|PANTHER|HARE|TARGET/.test(tag);
}
