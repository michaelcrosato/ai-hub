/**
 * session/names.js — the only names a session shows: two words picked from
 * lists the hub chose, "Teal Otter". Nobody types a name, so no name can carry
 * a message. Every combination fits the protocol's 16 characters.
 */

import { fnv1a } from '../color.js';

export const ADJECTIVES = [
  'Amber', 'Brave', 'Breezy', 'Bouncy', 'Calm', 'Cheery', 'Clever', 'Cosmic', 'Crimson', 'Dapper',
  'Daring', 'Eager', 'Frosty', 'Fuzzy', 'Gentle', 'Glowing', 'Golden', 'Happy', 'Humble', 'Jolly',
  'Lucky', 'Mellow', 'Mighty', 'Misty', 'Nimble', 'Noble', 'Peppy', 'Plucky', 'Quiet', 'Rapid',
  'Rusty', 'Silver', 'Sleepy', 'Snowy', 'Sunny', 'Swift', 'Teal', 'Tidy', 'Witty', 'Zesty',
];

export const ANIMALS = [
  'Badger', 'Beaver', 'Bison', 'Camel', 'Crane', 'Dingo', 'Falcon', 'Ferret', 'Fox', 'Gecko',
  'Hare', 'Heron', 'Ibis', 'Jackal', 'Koala', 'Lemur', 'Llama', 'Lynx', 'Marmot', 'Mole',
  'Moose', 'Newt', 'Orca', 'Otter', 'Owl', 'Panda', 'Pika', 'Puffin', 'Quokka', 'Raccoon',
  'Robin', 'Seal', 'Sloth', 'Swan', 'Tiger', 'Turtle', 'Walrus', 'Wombat', 'Yak', 'Zebra',
];

const ADJ = new Set(ADJECTIVES);
const ANI = new Set(ANIMALS);

/** A name the lists could have made: anything else is refused. */
export function isNickname(name) {
  const [adjective, animal, extra] = String(name ?? '').split(' ');
  return extra === undefined && ADJ.has(adjective) && ANI.has(animal);
}

/**
 * `count` different names to choose from, the same for the same seed, never
 * one already taken in the session and never two with the same animal.
 */
export function nameChoices(seed, count = 6, taken = []) {
  const busy = new Set(taken);
  const out = [];
  const animals = new Set();
  for (let i = 0; out.length < count && i < count * 50; i++) {
    const h = fnv1a(`${seed}:${i}`);
    const name = `${ADJECTIVES[h % ADJECTIVES.length]} ${ANIMALS[(h >>> 8) % ANIMALS.length]}`;
    const animal = name.split(' ')[1];
    if (busy.has(name) || animals.has(animal) || out.includes(name)) continue;
    animals.add(animal);
    out.push(name);
  }
  return out;
}
