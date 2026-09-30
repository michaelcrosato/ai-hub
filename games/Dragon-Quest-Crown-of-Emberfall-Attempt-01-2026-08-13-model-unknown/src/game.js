// Crown of Emberfall: the rules. Movement, encounters, dialogue, quests, shops,
// the inn, saves and turn-based combat, with the original's numbers. State is a
// plain object (saved as JSON); presentation reads it every frame.

import {
  MAPS,
  ITEMS,
  SPELLS,
  ENEMIES,
  ENCOUNTERS,
  INN_PRICES,
  STORY,
  QUESTS,
  BOSS_INTROS,
  CHALLENGE,
  xpForLevel,
  newGame,
  SAVE_PREFIX,
  SAVE_VERSION,
} from './data.js';

export const DIRS = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };

const bonus = (player, key) => Object.values(player.equipment).reduce((sum, id) => sum + (id ? (ITEMS[id]?.[key] ?? 0) : 0), 0);

/** Derived stats from level and equipment. */
export function stats(p) {
  return {
    maxHp: 26 + p.level * 8 + bonus(p, 'maxHp'),
    maxMp: 5 + p.level * 3 + bonus(p, 'maxMp'),
    attack: p.baseAttack + p.level * 2 + bonus(p, 'power'),
    defense: p.baseDefense + Math.floor(p.level * 1.5) + bonus(p, 'defense'),
    agility: p.baseAgility + p.level + bonus(p, 'agility'),
  };
}

const addItem = (inv, id, n = 1) => {
  inv[id] = (inv[id] ?? 0) + n;
};
const removeItem = (inv, id, n = 1) => {
  inv[id] = Math.max(0, (inv[id] ?? 0) - n);
  if (!inv[id]) delete inv[id];
};

export const formatTime = (secs) => {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}`;
};

// ---- saves ------------------------------------------------------------------

export function readSave(slot) {
  try {
    const raw = JSON.parse(localStorage.getItem(`${SAVE_PREFIX}${slot}`) ?? 'null');
    const s = raw?.state;
    const ok =
      s &&
      (s.version === 1 || s.version === SAVE_VERSION) &&
      MAPS[s.mapId] &&
      s.player &&
      typeof s.player.name === 'string' &&
      s.player.inventory &&
      s.player.equipment &&
      Array.isArray(s.flags) &&
      Array.isArray(s.openedChests) &&
      s.quests &&
      s.counters &&
      Number.isFinite(s.x) &&
      Number.isFinite(s.y) &&
      Number.isFinite(s.storyStage) &&
      MAPS[s.mapId].tiles[s.y]?.[s.x] &&
      !MAPS[s.mapId].tiles[s.y][s.x].blocked;
    if (!ok) return null;
    // Saves from before the upgrade: fill in what the new content needs.
    const fresh = newGame(s.player.name);
    s.version = SAVE_VERSION;
    s.quests = { ...fresh.quests, ...s.quests };
    s.counters = { ...fresh.counters, ...s.counters };
    s.defeated = s.defeated && typeof s.defeated === 'object' ? s.defeated : {};
    s.lastSafe = s.lastSafe && MAPS[s.lastSafe.mapId] ? s.lastSafe : { ...fresh.lastSafe };
    s.facing = DIRS[s.facing] ? s.facing : 'north';
    s.rng = Number.isFinite(s.rng) ? s.rng : 7531;
    s.hazard = Number.isFinite(s.hazard) ? s.hazard : 0;
    s.steps = Number.isFinite(s.steps) ? s.steps : 0;
    s.playSeconds = Number.isFinite(s.playSeconds) ? s.playSeconds : 0;
    // Unknown items (a hand-edited or damaged save) would break the menus: drop them.
    for (const [id, n] of Object.entries(s.player.inventory)) if (!ITEMS[id] || !Number.isFinite(n) || n <= 0) delete s.player.inventory[id];
    for (const slotName of ['weapon', 'armor', 'charm']) if (!ITEMS[s.player.equipment[slotName]]) s.player.equipment[slotName] = null;
    return raw;
  } catch {
    return null;
  }
}

function writeSave(slot, state) {
  const copy = JSON.parse(JSON.stringify(state));
  Object.assign(copy, { mode: 'field', combat: null, dialogue: null, activeShop: null });
  localStorage.setItem(`${SAVE_PREFIX}${slot}`, JSON.stringify({ savedAt: Date.now(), state: copy }));
}

export const SAVE_SLOTS = ['1', '2', '3'];

export function listSaves() {
  return { auto: readSave('auto'), 1: readSave('1'), 2: readSave('2'), 3: readSave('3') };
}

/** The most recent save of any slot: [slot, save] or null. */
export function latestSave(saves = listSaves()) {
  let best = null;
  for (const [slot, save] of Object.entries(saves)) if (save && (!best || save.savedAt > best[1].savedAt)) best = [slot, save];
  return best;
}

// ---- the game ---------------------------------------------------------------

/**
 * @param {object} deps
 * @param {() => object} deps.settings   current settings
 * @param {object} deps.audio            from createAudio
 * @param {object} deps.fx               feedback hooks: hitEnemy, hitPlayer, heal, enemyDown, levelUp, snap, rumble
 */
export function createGame({ settings, audio, fx }) {
  const g = {
    /** null on the title screen. */
    state: null,
    ui: {
      menuTab: 'party',
      combatView: 'root',
      shopTab: 'buy',
      typed: 0,
      toast: null,
      toastT: 0,
      toastId: 0,
      saves: listSaves(),
      version: 0,
    },
  };
  let pending = [];
  let secondAcc = 0;

  const sfx = (f, d, o) => audio.sfx(f, d, o);
  const touch = () => {
    g.ui.version += 1;
  };
  const toast = (text) => {
    g.ui.toast = text;
    g.ui.toastT = 2.6;
    g.ui.toastId += 1;
    touch();
  };
  g.toast = toast;
  const challenge = () => CHALLENGE[settings().challenge] || CHALLENGE.standard;
  const later = (t, fn) => pending.push({ t, fn });

  const roll = () => {
    const s = g.state;
    const next = (s.rng * 1664525 + 1013904223) >>> 0;
    s.rng = next;
    return next / 4294967296;
  };

  const say = (speaker, pages, onDone) => {
    const s = g.state;
    s.mode = 'dialogue';
    s.dialogue = { speaker, pages, index: 0, onDone };
    s.activeShop = null;
    g.ui.typed = 0;
    touch();
  };

  g.refreshSaves = () => {
    g.ui.saves = listSaves();
    touch();
  };

  const autosave = () => {
    try {
      writeSave('auto', g.state);
      g.refreshSaves();
    } catch {
      toast('Autosave could not be written on this device.');
    }
  };

  // ---- starting and loading

  g.newJourney = (name) => {
    audio.unlock();
    pending = [];
    g.state = newGame((name || '').trim().slice(0, 12) || 'Aster');
    g.ui.combatView = 'root';
    g.ui.typed = 0;
    fx.snap();
    sfx(523, 0.14);
    toast('Welcome to Emberfall');
  };

  g.load = (slot) => {
    const save = readSave(slot);
    if (!save) {
      toast('That save slot is empty.');
      return false;
    }
    audio.unlock();
    pending = [];
    g.state = { ...save.state, mode: 'field', combat: null, dialogue: null, activeShop: null };
    g.ui.combatView = 'root';
    fx.snap();
    toast(`Welcome back, ${g.state.player.name}.`);
    sfx(659, 0.12);
    return true;
  };

  g.save = (slot) => {
    const s = g.state;
    if (!s || s.mode === 'combat' || s.mode === 'dialogue') {
      toast('Find a quiet moment before saving.');
      return;
    }
    try {
      writeSave(slot, s);
      g.refreshSaves();
      toast(`Journey saved in slot ${slot}.`);
      sfx(784, 0.12);
    } catch {
      toast('The save could not be written.');
    }
  };

  g.toTitle = () => {
    pending = [];
    g.state = null;
    g.refreshSaves();
  };

  // ---- dialogue

  g.advanceDialogue = () => {
    const s = g.state;
    if (!s?.dialogue) return;
    const page = s.dialogue.pages[s.dialogue.index];
    if (g.ui.typed < page.length) {
      g.ui.typed = page.length;
      sfx(520, 0.04);
      touch();
      return;
    }
    sfx(620, 0.04);
    if (s.dialogue.index < s.dialogue.pages.length - 1) {
      s.dialogue.index += 1;
      g.ui.typed = 0;
      touch();
      return;
    }
    finishDialogue(s.dialogue.onDone);
  };

  function finishDialogue(onDone) {
    const s = g.state;
    s.mode = 'field';
    s.dialogue = null;
    touch();
    if (!onDone) return;
    const [kind, arg] = onDone.split(':');
    if (kind === 'stage') {
      s.storyStage = Number(arg);
      autosave();
      toast(STORY[s.storyStage]);
    } else if (kind === 'boss') {
      const boss = MAPS[s.mapId].bosses.find((b) => b.id === arg);
      if (boss) {
        startCombat(boss.enemyId, 'boss', boss);
        sfx(110, 0.3);
      }
    } else if (kind === 'questaccept') {
      s.quests[arg] = 'active';
      toast(`Quest begun: ${QUESTS[arg]?.name ?? arg}`);
      sfx(698, 0.1);
    } else if (kind === 'questcomplete') {
      const inv = s.player.inventory;
      if (arg === 'moondew') {
        removeItem(inv, 'moondew');
        addItem(inv, 'wayfarer_tonic', 3);
      } else if (arg === 'shellbacks') addItem(inv, 'iron_sword');
      else if (arg === 'locket') {
        removeItem(inv, 'silver_locket');
        s.player.gold += 180;
      } else if (arg === 'starseeds') {
        removeItem(inv, 'star_seed', 3);
        addItem(inv, 'star_charm');
      } else if (arg === 'lasttoll') {
        addItem(inv, 'sun_elixir', 2);
        s.player.gold += 500;
      }
      s.quests[arg] = 'complete';
      autosave();
      toast(`Quest complete: ${QUESTS[arg]?.name ?? arg}`);
      audio.jingle([523, 659, 784, 1046], 0.08, 0.18);
    } else if (kind === 'credits') {
      s.mode = 'credits';
    }
  }

  // ---- the field

  const tileBlocked = (m, x, y) => {
    const t = m.tiles[y]?.[x];
    if (!t || t.blocked) return true;
    if (m.props.some((p) => p.x === x && p.y === y && p.solid !== false)) return true;
    if (m.npcs.some((n) => n.x === x && n.y === y)) return true;
    return m.chests.some((c) => c.x === x && c.y === y);
  };
  g.walkable = (x, y) => !!g.state && !tileBlocked(MAPS[g.state.mapId], x, y);

  /** Try one step. Returns true when the courier moved. */
  g.move = (dir) => {
    const s = g.state;
    if (!s || s.mode !== 'field') return false;
    audio.unlock();
    const m = MAPS[s.mapId];
    const [dx, dy] = DIRS[dir];
    const nx = s.x + dx;
    const ny = s.y + dy;
    if (tileBlocked(m, nx, ny)) {
      if (s.facing !== dir) touch();
      s.facing = dir;
      sfx(130, 0.035);
      return false;
    }
    // Walking into a waiting boss starts the encounter face to face (the courier no
    // longer steps inside the boss's model).
    const waiting = m.bosses.find((b) => b.x === nx && b.y === ny && !s.flags.includes(b.flag) && s.storyStage >= (b.minStage ?? 0));
    if (waiting) {
      s.facing = dir;
      touch();
      meetBoss(waiting);
      return false;
    }
    const from = { x: s.x, y: s.y };
    s.x = nx;
    s.y = ny;
    s.facing = dir;
    s.steps += 1;
    s.hazard += 1;
    touch();

    const exit = m.exits.find((e) => e.x === nx && e.y === ny);
    if (exit) {
      if (exit.minStage && s.storyStage < exit.minStage) {
        s.x = from.x;
        s.y = from.y;
        say('Sealed Road', [exit.deniedText ?? 'A pale seal bars the way. Another Ember must awaken first.']);
        return false;
      }
      const to = MAPS[exit.to];
      s.mapId = exit.to;
      s.x = exit.toX;
      s.y = exit.toY;
      s.hazard = 0;
      if (to.type === 'town') s.lastSafe = { mapId: exit.to, x: exit.toX, y: exit.toY };
      fx.snap();
      toast(`${to.name} — ${to.subtitle}`);
      autosave();
      sfx(392, 0.1);
      return true;
    }

    if (m.encounterTier && s.hazard >= 5) {
      const chance = Math.min(0.28, 0.08 + (s.hazard - 5) * 0.025) * challenge().encounter;
      if (roll() < chance) {
        const table = ENCOUNTERS[m.encounterTier];
        const fair = table.filter((id) => ENEMIES[id].level <= s.player.level + 3);
        const pick = fair[Math.floor(roll() * fair.length)] ?? table[0];
        s.hazard = 0;
        startCombat(pick, 'random');
        sfx(164, 0.14);
        fx.rumble(0.35, 140);
      }
    }
    return true;
  };

  function meetBoss(boss) {
    const [speaker, pages] = BOSS_INTROS[boss.enemyId](g.state.player.name);
    say(speaker, pages, `boss:${boss.id}`);
  }

  /** What the courier faces: { kind, npc | chest | prop | boss } or null. */
  g.facingTarget = () => {
    const s = g.state;
    if (!s) return null;
    const m = MAPS[s.mapId];
    const [dx, dy] = DIRS[s.facing];
    const x = s.x + dx;
    const y = s.y + dy;
    const npc = m.npcs.find((n) => n.x === x && n.y === y);
    if (npc) return { kind: 'npc', npc, x, y };
    const chest = m.chests.find((c) => c.x === x && c.y === y);
    if (chest) return { kind: 'chest', chest, x, y, opened: s.openedChests.includes(chest.id) };
    const boss = m.bosses.find((b) => b.x === x && b.y === y && !s.flags.includes(b.flag) && s.storyStage >= (b.minStage ?? 0));
    if (boss) return { kind: 'boss', boss, x, y };
    const prop = m.props.find((p) => p.x === x && p.y === y && ['well', 'crystal', 'bellframe'].includes(p.kind));
    if (prop) return { kind: 'prop', prop, x, y };
    return null;
  };

  g.interact = () => {
    const s = g.state;
    if (!s) return;
    if (s.mode === 'dialogue') {
      g.advanceDialogue();
      return;
    }
    if (s.mode !== 'field') return;
    audio.unlock();
    const target = g.facingTarget();
    if (!target) {
      toast('Only the wind answers.');
      return;
    }
    if (target.kind === 'npc') {
      talkTo(target.npc.id);
      return;
    }
    if (target.kind === 'boss') {
      meetBoss(target.boss);
      return;
    }
    if (target.kind === 'chest') {
      const c = target.chest;
      if (target.opened) {
        say('Chest', ['It is empty, but still smells faintly of adventure.']);
        return;
      }
      s.player.gold += c.gold ?? 0;
      if (c.itemId) addItem(s.player.inventory, c.itemId, c.amount ?? 1);
      s.openedChests.push(c.id);
      const what = c.itemId ? `${ITEMS[c.itemId].name}${(c.amount ?? 1) > 1 ? ` ×${c.amount}` : ''}` : `${c.gold} gold`;
      sfx(880, 0.12);
      fx.rumble(0.2, 60);
      say('Treasure', [`You found ${what}!`]);
      return;
    }
    const p = target.prop;
    if (p.kind === 'well') say('Old Well', ['The water reflects a sunrise that has not happened yet.']);
    else if (p.kind === 'crystal') say('Skyglass', ['A thousand tiny horizons turn inside the crystal.']);
    else if (p.kind === 'bellframe')
      say('Empty Frame', [
        s.flags.includes('boss_bell')
          ? 'The frame hangs empty. Somewhere below, a small bell is already practicing for morning.'
          : 'The rope is worn smooth. Whoever rang the Still Bell pulled it only once.',
      ]);
  };

  function talkTo(id) {
    const s = g.state;
    const name = s.player.name;
    const stage = s.storyStage;
    const q = s.quests;
    const inv = s.player.inventory;
    if (id === 'king_orin') {
      if (stage === 0)
        return say(
          'King Orin',
          [
            `${name}, you are the courier who outran the dusk. Emberfall needs that stubborn spark.`,
            'Lucen Veyr rang the forbidden Still Bell and shattered our Crown into three living Embers.',
            'Veyr dreams of a world where nothing changes, so nothing can be lost. But stillness is not peace.',
            'Begin west of town in Mossroot Hollow. Bring back the Verdant Ember, and let growing things remember the sun.',
          ],
          'stage:1',
        );
      if (stage === 1) return say('King Orin', ['Mossroot Hollow lies west of town, beneath the old green shrine. Guard when Thornmaw rears back; even courage may carry a shield.']);
      if (stage === 2)
        return say(
          'King Orin',
          [
            'The Verdant Ember burns because you chose growth over fear.',
            'Veyr seeks the blue fire next. Sailors in Tidehaven whisper that it sleeps inside the Sunken Shrine.',
            'Cross the southern flats. Remember: a tide honors the shore by leaving it.',
          ],
          'stage:3',
        );
      if (stage === 3) return say('King Orin', ['Seek Tidehaven in the south. The Sunken Shrine waits beyond its western reeds.']);
      if (stage === 4)
        return say(
          'King Orin',
          [
            'You carried memory without chaining it. The Tidal Ember is awake.',
            'One flame remains in Skyglass Spire, beyond Galecrest in the northeast.',
            'The Ash Regent has ordered the wind itself to stop. Remind it how to move.',
          ],
          'stage:5',
        );
      if (stage === 5) return say('King Orin', ['Follow the eastern road over the ice bridge. Galecrest stands beneath Skyglass Spire.']);
      if (stage === 6)
        return say(
          'King Orin',
          [
            'Root, Tide, and Sky answer together. No crown should have kept their voices secret.',
            "Their light opens the Obsidian Citadel in the southeast. Go now—not as my subject, but as Emberfall's equal.",
            'Tell Veyr this: grief must be carried. It cannot be cured by ending tomorrow.',
          ],
          'stage:7',
        );
      if (stage === 7) return say('King Orin', ['The Citadel gate is open. Every road you restored now leads to that last darkness.']);
      return say('Orin', [
        "I have melted the old Crown's empty band. Hearthglen will cast three beacon bells—one for every region, owned by all.",
        `Walk proudly, ${name}, Wayfarer of Emberfall.`,
      ]);
    }
    const npc = MAPS[s.mapId].npcs.find((n) => n.id === id);
    if (npc?.role === 'shop') {
      s.mode = 'shop';
      s.activeShop = npc.shopId;
      g.ui.shopTab = 'buy';
      touch();
      return;
    }
    if (INN_PRICES[id]) {
      s.mode = 'shop';
      s.activeShop = `inn:${INN_PRICES[id]}`;
      touch();
      return;
    }
    if (id === 'healer_ivy') {
      if (q.moondew === 'locked')
        return say('Ivy', ['Moondew gathers where old roots dream. Bring me one drop from Mossroot Hollow, and I can brew enough tonic for any road.'], 'questaccept:moondew');
      if (q.moondew === 'active' && inv.moondew) return say('Ivy', ['It shines like a tiny moon! Three strong tonics, as promised. May they bring you home.'], 'questcomplete:moondew');
      if (q.moondew === 'active') return say('Ivy', ["Moondew hides in a chest among Mossroot's oldest roots."]);
      return say('Ivy', ['The gardens have begun to bloom before sunrise. Perhaps hope keeps its own clock.']);
    }
    if (id === 'smith_bram') {
      if (q.shellbacks === 'locked')
        return say('Bram', ["Monsters have made the trade roads a mess. Defeat five slimes or shellbacks, and I'll put a proper iron edge in your hand."], 'questaccept:shellbacks');
      if (q.shellbacks === 'active' && (s.counters.slimes ?? 0) >= 5)
        return say('Bram', ['Five marks on the tally—and fewer dents in my caravans. This Iron Sword is yours.'], 'questcomplete:shellbacks');
      if (q.shellbacks === 'active') return say('Bram', [`Your tally stands at ${s.counters.slimes ?? 0}/5. Dewdrops, Shellbacks, and Prismites all count.`]);
      return say('Bram', ['Steel bends. Good steel bends back. People can, too.']);
    }
    if (id === 'captain_mira') {
      if (q.locket === 'locked')
        return say('Captain Mira', ['The Shrine took my silver locket on the night the tide stopped. It holds no magic—only a face I refuse to forget.'], 'questaccept:locket');
      if (q.locket === 'active' && inv.silver_locket)
        return say('Captain Mira', ['There she is. Memory should be an anchor you can lift, not one that drowns you. Take this reward.'], 'questcomplete:locket');
      if (q.locket === 'active') return say('Captain Mira', ["Look along the Shrine's western channel. The locket catches even drowned light."]);
      return say('Captain Mira', ['The sea is moving again. Every departure now promises a return.']);
    }
    if (id === 'sage_lyra') {
      if (q.starseeds === 'locked')
        return say('Lyra', ['Three Star Seeds fell across the old shrines. Gather them, and I will set their light in a charm for you.'], 'questaccept:starseeds');
      if (q.starseeds === 'active' && (inv.star_seed ?? 0) >= 3)
        return say('Lyra', ['Three small skies, carried safely. The Astral Loop will steady your heart in the Citadel.'], 'questcomplete:starseeds');
      if (q.starseeds === 'active') return say('Lyra', [`You carry ${inv.star_seed ?? 0}/3 Star Seeds. Search the Sunken Shrine and Skyglass Spire.`]);
      return say('Lyra', ['Stars move so slowly that mortals call them fixed. Even they know better than the Ash Regent.']);
    }
    if (id === 'elder_toma') {
      // New: Toma's quest, the Hushed Belfry.
      if (q.lasttoll !== 'complete' && s.flags.includes('boss_bell'))
        return say('Toma', ['I heard it from here: one clear note, and then birdsong. The valley can breathe again.', 'Take these, with the whole village’s thanks.'], 'questcomplete:lasttoll');
      if (q.lasttoll === 'locked' && stage >= 7)
        return say(
          'Toma',
          [
            'When Lucen rang the Still Bell, the whole valley held its breath. That bell still hangs in the Hushed Belfry, north across the river.',
            'Its silence will outlast even the Regent unless someone climbs up and answers it. Take the old pilgrim road north of the bridge.',
            'Mind the loft. When the bronze swings back, brace yourself—that is when it strikes.',
          ],
          'questaccept:lasttoll',
        );
      if (q.lasttoll === 'active') return say('Toma', ['The belfry stands north of the river, up the pilgrim road. Climb both stairways to the bell loft, and guard when the bronze swings back.']);
      if (q.lasttoll === 'complete') return say('Toma', ['Every morning now, somebody rings the Morningbell you set free. Mostly children. Loudly.']);
      return say('Toma', ['Roads are stories walked by many feet. Open your Atlas if you lose the next chapter.']);
    }
    if (id === 'sailor_fenn')
      return say('Fenn', [
        stage < 4 ? 'The tide has held its breath for seven days. I miss the sound of it arguing with the pier.' : 'Hear that? The sea remembers every song, but it never sings one twice.',
      ]);
    if (id === 'gale_child')
      return say('Kip', [stage < 6 ? 'When the wind comes back, I’m flying the biggest kite in history. It may need its own postal code.' : 'My kite reached the clouds! It sent no mail, though.']);
    return say('Traveler', ['May your road bend toward morning.']);
  }

  // ---- menus, shops, inn

  g.cancel = () => {
    const s = g.state;
    if (!s) return;
    if (s.mode === 'menu' || s.mode === 'shop') {
      s.mode = 'field';
      s.activeShop = null;
      sfx(260, 0.04);
      touch();
    } else if (s.mode === 'field') {
      g.ui.menuTab = 'party';
      s.mode = 'menu';
      g.refreshSaves();
      sfx(420, 0.04);
      touch();
    } else if (s.mode === 'combat' && g.ui.combatView !== 'root') {
      g.ui.combatView = 'root';
      touch();
    }
  };

  g.useItem = (id) => {
    const s = g.state;
    if (!s || !(s.player.inventory[id] ?? 0)) return;
    const item = ITEMS[id];
    if (item.kind !== 'consumable' || item.battleOnly) return;
    const p = s.player;
    const st = stats(p);
    // Don't waste a tonic: only use it when it would restore something.
    const helpsHp = (item.healHp ?? 0) > 0 && p.hp < st.maxHp;
    const helpsMp = (item.healMp ?? 0) > 0 && p.mp < st.maxMp;
    if (!helpsHp && !helpsMp) {
      toast(item.healMp && !item.healHp ? 'Your magic is already full.' : 'You are already at full strength.');
      return;
    }
    removeItem(p.inventory, id);
    const hp = p.hp;
    const mp = p.mp;
    p.hp = Math.min(st.maxHp, p.hp + (item.healHp ?? 0));
    p.mp = Math.min(st.maxMp, p.mp + (item.healMp ?? 0));
    sfx(610, 0.1);
    toast(`${item.name}: +${p.hp - hp} HP, +${p.mp - mp} MP`);
  };

  g.equip = (id) => {
    const s = g.state;
    const item = ITEMS[id];
    if (!s || !item || !['weapon', 'armor', 'charm'].includes(item.kind) || !(s.player.inventory[id] ?? 0)) return;
    const p = s.player;
    p.equipment[item.kind] = id;
    const st = stats(p);
    p.hp = Math.min(p.hp, st.maxHp);
    p.mp = Math.min(p.mp, st.maxMp);
    sfx(740, 0.07);
    touch();
  };

  g.buy = (id) => {
    const s = g.state;
    const item = ITEMS[id];
    if (!s || !item) return;
    if (s.player.gold < item.price) {
      toast('You need more gold.');
      return;
    }
    s.player.gold -= item.price;
    addItem(s.player.inventory, id);
    sfx(760, 0.06);
    touch();
  };

  g.sell = (id) => {
    const s = g.state;
    const item = ITEMS[id];
    if (!s || !item) return;
    if (item.kind === 'key' || item.price <= 0) {
      toast('Treasures of the journey cannot be sold.');
      return;
    }
    if (!(s.player.inventory[id] ?? 0)) return;
    if (Object.values(s.player.equipment).includes(id) && s.player.inventory[id] <= 1) {
      toast('Unequip that item before selling it.');
      return;
    }
    s.player.gold += Math.max(1, Math.floor(item.price / 2));
    removeItem(s.player.inventory, id);
    sfx(520, 0.06);
    touch();
  };

  g.rest = (price) => {
    const s = g.state;
    if (!s || s.player.gold < price) {
      toast('Not enough gold for a room.');
      return;
    }
    s.player.gold -= price;
    const st = stats(s.player);
    s.player.hp = st.maxHp;
    s.player.mp = st.maxMp;
    s.mode = 'field';
    s.activeShop = null;
    s.lastSafe = { mapId: s.mapId, x: s.x, y: s.y };
    autosave();
    toast('You wake rested beneath a kinder sky.');
    sfx(660, 0.25);
  };

  g.rise = () => {
    const s = g.state;
    if (!s || s.mode !== 'gameover') return;
    const p = s.player;
    p.gold = Math.floor(p.gold / 2);
    const st = stats(p);
    p.hp = st.maxHp;
    p.mp = Math.ceil(st.maxMp / 2);
    Object.assign(s, { mapId: s.lastSafe.mapId, x: s.lastSafe.x, y: s.lastSafe.y, hazard: 0, combat: null });
    pending = [];
    fx.snap();
    autosave();
    say('The First Flame', ['The dawn refuses to lose you. You awaken at the last safe hearth, lighter in purse but unbroken in spirit.']);
  };

  g.exploreAfterEnding = () => {
    const s = g.state;
    Object.assign(s, { mode: 'field', mapId: 'hearthglen', x: 7, y: 11, storyStage: 8, lastSafe: { mapId: 'hearthglen', x: 7, y: 11 } });
    fx.snap();
    autosave();
    touch();
  };

  // ---- combat

  function startCombat(enemyId, source, boss) {
    const s = g.state;
    const e = ENEMIES[enemyId];
    s.mode = 'combat';
    s.dialogue = null;
    s.activeShop = null;
    s.combat = {
      enemyId,
      hp: e.maxHp,
      maxHp: e.maxHp,
      bossFlag: boss?.flag,
      stageAfter: boss?.stageAfter,
      log: [`${e.name} draws near!`],
      busy: false,
      defending: false,
      enemyAsleep: 0,
      playerWard: 0,
      phase: 1,
      source,
      charging: false,
      chargeCount: 0,
    };
    g.ui.combatView = 'root';
    touch();
  }

  const log = (line) => {
    const c = g.state.combat;
    c.log = [...c.log, line].slice(-6);
    touch();
  };
  const turnDelay = () => (settings().reducedMotion ? 0.25 : settings().textSpeed === 'fast' ? 0.4 : 0.6);

  /** The courier's turn: attack, spell, item, guard or run. */
  g.combatAction = (kind, id) => {
    const s = g.state;
    const c = s?.combat;
    if (!c || s.mode !== 'combat' || c.busy) return;
    audio.unlock();
    const e = ENEMIES[c.enemyId];
    const p = s.player;
    const st = stats(p);
    c.defending = false;

    if (kind === 'attack') {
      const crit = roll() < 0.08;
      const dmg = Math.max(1, Math.round(st.attack * (0.88 + roll() * 0.24) - e.defense * 0.46)) * (crit ? 2 : 1);
      c.hp = Math.max(0, c.hp - dmg);
      log(`${p.name} attacks for ${dmg} damage${crit ? '—a radiant strike!' : '.'}`);
      fx.hitEnemy(dmg, crit);
      sfx(crit ? 920 : 240, 0.07);
    } else if (kind === 'spell') {
      const spell = SPELLS[id];
      if (!spell || p.level < spell.level || p.mp < spell.mp) {
        toast('Not enough MP.');
        return;
      }
      if (spell.kind === 'escape' && e.boss) {
        toast('The way is sealed until the battle is decided.');
        return;
      }
      p.mp -= spell.mp;
      if (spell.kind === 'damage') {
        const resist = e.resistFire ?? 0;
        const dmg = Math.max(2, Math.round((spell.power + p.level * 2.2) * (0.9 + roll() * 0.2) * (1 - resist)));
        c.hp = Math.max(0, c.hp - dmg);
        log(`${p.name} casts ${spell.name}! ${dmg} damage.`);
        fx.hitEnemy(dmg, spell.id === 'sunrise');
        sfx(spell.id === 'sunrise' ? 1046 : 700, 0.16);
      } else if (spell.kind === 'heal') {
        const before = p.hp;
        p.hp = Math.min(st.maxHp, p.hp + spell.power + p.level * 2);
        log(`${spell.name} restores ${p.hp - before} HP.`);
        fx.heal(p.hp - before);
        sfx(660, 0.15);
      } else if (spell.kind === 'status') {
        const slept = roll() < (e.boss ? 0.28 : 0.72);
        if (slept) c.enemyAsleep = spell.power;
        log(slept ? `${e.name} drifts into enchanted sleep.` : `${e.name} resists the lullaby.`);
        sfx(slept ? 494 : 196, 0.18, { wave: 'triangle' });
      } else if (spell.kind === 'escape') {
        endCombat();
        toast('You escaped on the Waywind.');
        sfx(880, 0.18, { wave: 'triangle', slide: 1.6 });
        return;
      } else if (spell.kind === 'buff') {
        c.playerWard = spell.power;
        log('A golden ward circles you.');
        sfx(587, 0.18, { wave: 'triangle' });
      }
    } else if (kind === 'item') {
      const item = ITEMS[id];
      if (!item || !(p.inventory[id] ?? 0) || item.kind !== 'consumable') return;
      if (item.id === 'smoke_pod') {
        if (e.boss) {
          toast('The smoke cannot cross this boss seal.');
          return;
        }
        removeItem(p.inventory, id);
        endCombat();
        toast('The smoke clears. You got away.');
        return;
      }
      removeItem(p.inventory, id);
      const hp = p.hp;
      const mp = p.mp;
      p.hp = Math.min(st.maxHp, p.hp + (item.healHp ?? 0));
      p.mp = Math.min(st.maxMp, p.mp + (item.healMp ?? 0));
      log(`${p.name} uses ${item.name}. +${p.hp - hp} HP, +${p.mp - mp} MP.`);
      if (p.hp > hp) fx.heal(p.hp - hp);
      sfx(610, 0.1);
    } else if (kind === 'defend') {
      c.defending = true;
      log(`${p.name} braces behind a veil of light.`);
      sfx(330, 0.08);
    } else if (kind === 'run') {
      if (e.boss) {
        toast('There is no road away from this oath.');
        return;
      }
      if (roll() < Math.min(0.92, 0.55 + (st.agility - e.agility) * 0.035)) {
        endCombat();
        toast('You escaped safely.');
        return;
      }
      log('The escape route is cut off!');
    }

    g.ui.combatView = 'root';
    c.busy = true;
    touch();
    if (c.hp <= 0) {
      fx.enemyDown();
      audio.jingle([392, 523, 659, 784], 0.07, 0.14);
      later(settings().reducedMotion ? 0.2 : 0.75, victory);
      return;
    }
    if (e.id === 'ash_regent' && c.phase === 1 && c.hp <= c.maxHp / 2) {
      c.phase = 2;
      log('The Crown shatters its first ring. Veyr becomes the Ash Regent Unbound!');
      sfx(98, 0.4, { slide: 0.5 });
      fx.rumble(0.7, 300);
    }
    later(turnDelay(), enemyTurn);
  };

  function enemyTurn() {
    const s = g.state;
    const c = s?.combat;
    if (!c || s.mode !== 'combat') return;
    const e = ENEMIES[c.enemyId];
    const p = s.player;
    const st = stats(p);
    if (c.enemyAsleep > 0) {
      c.enemyAsleep -= 1;
      log(`${e.name} is sleeping.`);
    } else if (e.charge && !c.charging && c.chargeCount + 1 >= e.charge.every) {
      // Wind-up turn: no damage, a warning. Guard now!
      c.chargeCount = 0;
      c.charging = true;
      log(e.charge.warn);
      sfx(147, 0.35, { wave: 'triangle', slide: 0.6 });
      fx.rumble(0.25, 200);
    } else {
      const unleash = !!(e.charge && c.charging);
      const magic = !unleash && e.spell && roll() < (e.spellChance ?? 0);
      let dmg;
      let verb;
      if (magic) {
        dmg = Math.max(2, Math.round((e.magic ?? e.attack) * (0.72 + roll() * 0.18) - st.defense * 0.2));
        verb = `${e.name} casts cinderfire`;
      } else {
        const fury = e.id === 'ash_regent' && c.phase === 2 ? 1.24 : 1;
        dmg = Math.max(1, Math.round(e.attack * fury * (0.84 + roll() * 0.22) - st.defense * 0.48));
        verb = `${e.name} strikes`;
      }
      if (unleash) {
        dmg = Math.round(dmg * e.charge.mult);
        verb = `${e.name} unleashes ${e.charge.name}`;
        c.charging = false;
      } else if (e.charge) c.chargeCount += 1;
      dmg = Math.max(1, Math.round(dmg * challenge().enemyDamage));
      const guarded = c.defending;
      if (c.defending) dmg = Math.ceil(dmg / 2);
      if (c.playerWard > 0) {
        dmg = Math.ceil(dmg / 2);
        c.playerWard -= 1;
      }
      log(`${verb} for ${dmg} damage${magic || unleash ? '!' : '.'}${unleash && guarded ? ' Your guard holds.' : ''}`);
      p.hp = Math.max(0, p.hp - dmg);
      fx.hitPlayer(dmg, unleash);
      sfx(120, 0.09);
    }
    c.defending = false;
    touch();
    if (p.hp <= 0) {
      log(`${p.name} falls…`);
      later(settings().reducedMotion ? 0.2 : 0.8, () => {
        if (!g.state) return;
        g.state.mode = 'gameover';
        g.state.combat = null;
        touch();
      });
      return;
    }
    c.busy = false;
  }

  function endCombat() {
    const s = g.state;
    s.mode = 'field';
    s.combat = null;
    s.hazard = 0;
    pending = [];
    touch();
  }

  function victory() {
    const s = g.state;
    const c = s?.combat;
    if (!c) return;
    const e = ENEMIES[c.enemyId];
    const p = s.player;
    const mult = challenge().reward ?? 1;
    const xp = Math.round(e.xp * mult);
    const gold = Math.round(e.gold * mult);
    p.xp += xp;
    p.gold += gold;
    let levels = 0;
    while (p.level < 20 && p.xp >= xpForLevel(p.level + 1)) {
      p.level += 1;
      levels += 1;
    }
    if (levels) {
      const st = stats(p);
      p.hp = st.maxHp;
      p.mp = st.maxMp;
      fx.levelUp(p.level);
    }
    let loot = '';
    if (e.loot && roll() < e.loot.chance) {
      addItem(p.inventory, e.loot.itemId);
      loot = ` · ${ITEMS[e.loot.itemId].name}`;
    }
    if (['dewdrop', 'shellback', 'prismite'].includes(e.id)) s.counters.slimes = (s.counters.slimes ?? 0) + 1;
    s.defeated[e.id] = (s.defeated[e.id] ?? 0) + 1;
    s.mode = 'field';
    s.combat = null;
    s.hazard = 0;
    pending = [];
    touch();

    if (c.bossFlag) {
      s.flags = [...new Set([...s.flags, c.bossFlag])];
      s.storyStage = Math.max(s.storyStage, c.stageAfter ?? s.storyStage);
      const inv = p.inventory;
      if (e.id === 'thornmaw') {
        addItem(inv, 'verdant_ember');
        say('Verdant Ember', [
          'The thorn-cage opens. A green flame settles into your hands—warm, alive, and growing.',
          'A distant voice whispers: “To remember is not to remain unchanged.”',
          'The Verdant Ember is restored. Return to King Orin.',
        ]);
      } else if (e.id === 'deep_oracle') {
        addItem(inv, 'tidal_ember');
        say('Tidal Ember', [
          'The flooded archive exhales. Blue fire rises like a wave and rests beside the green.',
          "The Oracle's last memory is a child laughing on a shore—and then, peacefully, the tide carries it onward.",
          'The Tidal Ember is restored. Return to King Orin.',
        ]);
      } else if (e.id === 'tempest_roc') {
        addItem(inv, 'sky_ember');
        say('Sky Ember', [
          'The storm breaks into a thousand bright feathers. White flame dances between them.',
          'For the first time in weeks, every windmill in Galecrest turns.',
          'The Sky Ember is restored. Return to King Orin.',
        ]);
      } else if (e.id === 'ash_regent') {
        say(
          'Lucen Veyr',
          [
            'The Still Crown cracks. Morning pours through it.',
            'Veyr looks toward the first moving cloud. “I only wanted one morning back.”',
            'You answer, “Then remember it. Do not bury every morning after it.”',
            "With his last strength, Veyr opens the Crown's clasp. Root, Tide, and Sky fly home—and the sun begins to move.",
            `${p.name}, Wayfarer of Emberfall, has restored the dawn.`,
          ],
          'credits',
        );
      } else if (e.id === 'still_bell') {
        addItem(inv, 'morningbell');
        say('The Still Bell', [
          'The bronze gives one long, clear note. It rolls down the stairways and out over the whole valley.',
          'Where the Still Bell hung, a crack opens along an old seam. Inside rests a small bell, warm as a hearthstone: the Morningbell.',
          s.quests.lasttoll === 'active' ? 'Toma will want to hear this. Return to Hearthglen.' : 'Somewhere in Hearthglen, an old man looks up from his porch and smiles.',
        ]);
      }
      autosave();
    } else {
      toast(`${e.name} defeated · +${xp} XP · +${gold}G${loot}${levels ? ` · Level ${p.level}!` : ''}`);
    }
  }

  // ---- per frame

  g.tick = (dt) => {
    const s = g.state;
    if (g.ui.toast) {
      g.ui.toastT -= dt;
      if (g.ui.toastT <= 0) {
        g.ui.toast = null;
        touch();
      }
    }
    if (!s) return;
    if (pending.length) {
      const due = [];
      for (const p of pending) {
        p.t -= dt;
        if (p.t <= 0) due.push(p);
      }
      if (due.length) {
        pending = pending.filter((p) => p.t > 0);
        for (const p of due) p.fn();
      }
    }
    if (s.dialogue) {
      const page = s.dialogue.pages[s.dialogue.index] ?? '';
      const speed = settings().textSpeed;
      if (g.ui.typed < page.length) g.ui.typed = speed === 'fast' ? page.length : Math.min(page.length, g.ui.typed + dt * (speed === 'slow' ? 28 : 50));
    }
    if (s.mode !== 'menu' && s.mode !== 'credits' && s.mode !== 'gameover') {
      secondAcc += dt;
      while (secondAcc >= 1) {
        secondAcc -= 1;
        s.playSeconds += 1;
      }
    }
  };

  return g;
}
