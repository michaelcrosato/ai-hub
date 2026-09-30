// The field journal: places visited, animals spotted and photographed, and
// photo challenges. It belongs to the player, not the world, so it survives
// a new seed, and it is kept in localStorage.

import { PLACES, SPECIES } from './config.js';

const KEY = 'verdant-journal-v1';
const LISTS = ['places', 'seen', 'photographed', 'challenges'];

/**
 * Each challenge looks at the animals in a photo. `test(entry, ctx)` checks one
 * animal (entry: { animal, distance }); `group(entries, ctx)` checks the whole frame.
 */
export const CHALLENGES = [
  { id: 'deer-drink', title: 'A fallow deer drinking', hint: 'Deer drink at open banks of rivers and ponds.', test: (e) => e.animal.species === 'deer' && e.animal.state === 'drink' },
  { id: 'fox-asleep', title: 'A red fox asleep', hint: 'Tired foxes curl up on dry ground.', test: (e) => e.animal.species === 'fox' && e.animal.state === 'sleep' },
  { id: 'rabbit-meal', title: 'A rabbit at a meal', hint: 'Hungry rabbits graze almost anywhere.', test: (e) => e.animal.species === 'rabbit' && e.animal.state === 'eat' },
  { id: 'sheep-fields', title: 'Sheep in the Golden Fields', hint: 'The flock stays close to the farms.', test: (e, ctx) => e.animal.species === 'sheep' && ctx.world.biome(e.animal.x, e.animal.z) === 'farmland' },
  { id: 'boar-forage', title: 'A wild boar foraging', hint: 'Boar go rooting when they get hungry.', test: (e) => e.animal.species === 'boar' && (e.animal.state === 'seekFood' || e.animal.state === 'eat') },
  { id: 'capybara-water', title: 'A capybara by the water', hint: 'Look around Stillwater Marsh.', test: (e) => e.animal.species === 'capybara' && (e.animal.state === 'drink' || e.animal.state === 'seekWater') },
  { id: 'goat-heights', title: 'A mountain goat above 120 m', hint: 'Goats climb the Frostspires.', test: (e) => e.animal.species === 'goat' && e.animal.y >= 120 },
  { id: 'bear-berries', title: 'A brown bear at the berries', hint: 'Bears roam deep in Whispering Woods.', test: (e) => e.animal.species === 'bear' && e.animal.state === 'eat' },
  { id: 'after-dark', title: 'Any animal after dark', hint: 'Your lantern helps (L).', test: (e, ctx) => ctx.night },
  { id: 'in-the-rain', title: 'An animal in the rain', hint: 'Wait for rain, or choose it in World settings.', test: (e, ctx) => ctx.raining },
  { id: 'close-up', title: 'A close-up, within 12 m', hint: 'Walk up slowly on foot.', test: (e) => e.distance <= 12 },
  { id: 'gathering', title: 'Three animals in one frame', hint: 'Herds meet at water and good grass.', group: (list) => list.length >= 3 },
  { id: 'ring-dawn', title: 'The Sunstone Ring at sunrise', hint: 'Stand among the stones between 05:45 and 07:30.', group: (list, ctx) => ctx.atRing && ctx.dawn },
];

export class Journal {
  constructor() {
    this.data = { places: [], seen: [], photographed: [], challenges: [], photos: 0 };
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (raw && typeof raw === 'object') {
        for (const list of LISTS) if (Array.isArray(raw[list])) this.data[list] = raw[list].filter((v) => typeof v === 'string');
        if (Number.isFinite(raw.photos)) this.data.photos = Math.max(0, Math.floor(raw.photos));
      }
    } catch {
      /* a damaged save starts a fresh journal */
    }
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* private mode: the journal lasts for this visit */
    }
  }

  has(list, id) {
    return this.data[list].includes(id);
  }

  /** Record an entry; true when it is new. */
  add(list, id) {
    if (this.has(list, id)) return false;
    this.data[list].push(id);
    this.save();
    return true;
  }

  countPhoto() {
    this.data.photos += 1;
    this.save();
  }

  get total() {
    return PLACES.length + Object.keys(SPECIES).length * 2 + CHALLENGES.length;
  }

  get done() {
    const places = PLACES.filter((p) => this.has('places', p.name)).length;
    const seen = Object.keys(SPECIES).filter((s) => this.has('seen', s)).length;
    const shot = Object.keys(SPECIES).filter((s) => this.has('photographed', s)).length;
    const challenges = CHALLENGES.filter((c) => this.has('challenges', c.id)).length;
    return places + seen + shot + challenges;
  }
}
