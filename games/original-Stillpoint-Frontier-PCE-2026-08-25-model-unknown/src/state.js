/**
 * state.js — the durable field record: a small reducer, the contract status
 * rules, crafting, and the localStorage save (campaign plus the isolated
 * GRID LAB sandbox). Every value read from storage goes through
 * sanitizeFieldState, so a damaged or old save still loads.
 */
import { ITEMS, DEPLOYABLES, RECIPES, CONTRACTS, CORE_CONTRACT_IDS, STORAGE } from './data.js';

const LIMIT = 48000;

export function emptyInventory() {
  return Object.fromEntries(Object.keys(ITEMS).map((id) => [id, 0]));
}

export function createFieldState() {
  const inventory = emptyInventory();
  inventory.fiber = 1;
  inventory.wood = 1;
  return {
    version: 4,
    inventory,
    collected: [],
    scanned: [],
    opened: [],
    inspected: [],
    crafted: [],
    conversations: [],
    discovered: ['field-unit'],
    deployments: [],
    acceptedContracts: ['field-calibration'],
    turnedInContracts: [],
    reputation: 0,
    restCount: 0,
    health: 100,
    wetness: 0,
    cold: 0,
    worldMinutes: 1058,
    playerPosition: { x: 0, y: null, z: 26 },
    waypointId: null,
    stats: { distance: 0, seconds: 0 },
  };
}

function clampNumber(value, min, max, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function cleanIds(value) {
  return Array.isArray(value) ? [...new Set(value.filter((v) => typeof v === 'string' && v.length <= 120))].slice(0, 512) : [];
}

function addItems(inventory, delta) {
  const out = { ...inventory };
  for (const id of Object.keys(ITEMS)) {
    const change = delta[id] ?? 0;
    out[id] = Math.min(ITEMS[id].stackLimit, Math.max(0, out[id] + Math.floor(Number.isFinite(change) ? change : 0)));
  }
  return out;
}

/** Pure state transitions. Unknown actions return the state unchanged. */
export function reduceField(state, action) {
  switch (action.type) {
    case 'collect':
      return state.collected.includes(action.persistentId)
        ? { ...state }
        : { ...state, collected: [...state.collected, action.persistentId], inventory: addItems(state.inventory, { [action.item]: Math.max(0, action.quantity) }) };
    case 'scan':
      return state.scanned.includes(action.entryId) ? { ...state } : { ...state, scanned: [...state.scanned, action.entryId] };
    case 'open':
      return state.opened.includes(action.containerId)
        ? { ...state }
        : { ...state, opened: [...state.opened, action.containerId], inventory: addItems(state.inventory, action.loot) };
    case 'inspect':
      return state.inspected.includes(action.targetId) ? { ...state } : { ...state, inspected: [...state.inspected, action.targetId] };
    case 'talk':
      return state.conversations.includes(action.npcId) ? { ...state } : { ...state, conversations: [...state.conversations, action.npcId] };
    case 'discover':
      return state.discovered.includes(action.locationId) ? { ...state } : { ...state, discovered: [...state.discovered, action.locationId] };
    case 'deploy':
      return state.deployments.some((d) => d.id === action.deployment.id) || state.inventory[action.deployment.item] < 1
        ? { ...state }
        : {
            ...state,
            inventory: addItems(state.inventory, { [action.deployment.item]: -1 }),
            deployments: [...state.deployments, { ...action.deployment }].slice(-128),
          };
    case 'use-medkit':
      return state.inventory.first_aid_kit < 1 || state.health >= 100
        ? { ...state }
        : { ...state, inventory: addItems(state.inventory, { first_aid_kit: -1 }), health: Math.min(100, state.health + 55), cold: Math.max(0, state.cold - 12) };
    case 'accept-contract':
      return state.acceptedContracts.includes(action.contractId) ? { ...state } : { ...state, acceptedContracts: [...state.acceptedContracts, action.contractId] };
    case 'turn-in-contract':
      return state.turnedInContracts.includes(action.contractId)
        ? { ...state }
        : {
            ...state,
            acceptedContracts: state.acceptedContracts.includes(action.contractId) ? [...state.acceptedContracts] : [...state.acceptedContracts, action.contractId],
            turnedInContracts: [...state.turnedInContracts, action.contractId],
            inventory: addItems(state.inventory, action.reward ?? {}),
            reputation: Math.min(9999, state.reputation + 100),
          };
    case 'rest':
      return {
        ...state,
        restCount: Math.min(9999, state.restCount + 1),
        health: 100,
        wetness: Math.max(0, state.wetness - 70),
        cold: Math.max(0, state.cold - 65),
        worldMinutes: Math.min(9999999, state.worldMinutes + Math.max(0, action.minutes)),
      };
    case 'set-condition':
      return {
        ...state,
        health: clampNumber(action.health, 0, 100, state.health),
        wetness: clampNumber(action.wetness, 0, 100, state.wetness),
        cold: clampNumber(action.cold, 0, 100, state.cold),
      };
    case 'set-time':
      return { ...state, worldMinutes: clampNumber(action.worldMinutes, 0, 9999999, state.worldMinutes) };
    case 'set-player':
      return {
        ...state,
        playerPosition: {
          x: clampNumber(action.x, -LIMIT, LIMIT, state.playerPosition.x),
          y: clampNumber(action.y, -256, 4096, state.playerPosition.y ?? 0),
          z: clampNumber(action.z, -LIMIT, LIMIT, state.playerPosition.z),
        },
      };
    case 'set-waypoint':
      return { ...state, waypointId: action.waypointId && action.waypointId.length <= 120 ? action.waypointId : null };
    case 'grant':
      return { ...state, inventory: addItems(state.inventory, action.items) };
    case 'clear-inventory':
      return { ...state, inventory: emptyInventory() };
    case 'reputation':
      return { ...state, reputation: Math.max(0, Math.min(9999, state.reputation + Math.floor(action.amount || 0))) };
    case 'track':
      return {
        ...state,
        stats: {
          distance: Math.min(1e9, state.stats.distance + Math.max(0, action.distance || 0)),
          seconds: Math.min(1e9, state.stats.seconds + Math.max(0, action.seconds || 0)),
        },
      };
    default:
      return state;
  }
}

export function findRecipe(id) {
  return RECIPES.find((r) => r.id === id) ?? null;
}

export function canCraft(state, recipe) {
  return Object.keys(recipe.ingredients).every((id) => state.inventory[id] >= (recipe.ingredients[id] ?? 0));
}

export function craft(state, recipeId, station) {
  const recipe = findRecipe(recipeId);
  if (!recipe) return { state: { ...state }, crafted: false, reason: 'Unknown field recipe.' };
  if (recipe.station === 'workbench' && station !== 'workbench') return { state: { ...state }, crafted: false, reason: 'A workbench is required.' };
  if (!canCraft(state, recipe)) return { state: { ...state }, crafted: false, reason: 'Required materials are missing.' };
  const delta = { [recipe.output.item]: recipe.output.quantity };
  for (const id of Object.keys(recipe.ingredients)) delta[id] = -(recipe.ingredients[id] ?? 0);
  return {
    crafted: true,
    reason: `${recipe.label} fabricated.`,
    state: {
      ...state,
      inventory: addItems(state.inventory, delta),
      crafted: state.crafted.includes(recipe.id) ? [...state.crafted] : [...state.crafted, recipe.id],
    },
  };
}

export function inventoryWeight(inventory) {
  return Object.keys(ITEMS).reduce((sum, id) => sum + inventory[id] * ITEMS[id].unitWeight, 0);
}

export function contractStatus(state) {
  return CONTRACTS.map((contract, index) => {
    const completed = contract.objectives.filter((o) => o.complete(state)).length;
    const objectivesComplete = completed === contract.objectives.length;
    const accepted = state.acceptedContracts.includes(contract.id);
    const turnedIn = state.turnedInContracts.includes(contract.id);
    const unlocked = index === 0 || state.turnedInContracts.includes(CONTRACTS[index - 1].id);
    const status = turnedIn ? 'complete' : accepted ? (objectivesComplete ? 'ready' : 'active') : unlocked ? 'available' : 'locked';
    const next =
      status === 'complete'
        ? 'Filed with Meridian Field Office'
        : status === 'ready'
          ? 'Return to Mara Venn for field sign-off'
          : status === 'available'
            ? 'Speak with Mara Venn to accept'
            : status === 'locked'
              ? 'Complete the preceding field file'
              : (contract.objectives.find((o) => !o.complete(state))?.label ?? 'Return to Mara Venn');
    return {
      id: contract.id,
      code: contract.code,
      title: contract.title,
      complete: turnedIn,
      objectivesComplete,
      completed,
      total: contract.objectives.length,
      next,
      status,
      core: CORE_CONTRACT_IDS.includes(contract.id),
    };
  });
}

function cleanDeployments(value) {
  if (!Array.isArray(value)) return [];
  const allowed = new Set(DEPLOYABLES);
  const seen = new Set();
  const out = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    if (typeof raw.id !== 'string' || raw.id.length > 120 || seen.has(raw.id)) continue;
    if (typeof raw.item !== 'string' || !allowed.has(raw.item)) continue;
    if (!Number.isFinite(raw.x) || !Number.isFinite(raw.z)) continue;
    seen.add(raw.id);
    out.push({ id: raw.id, item: raw.item, x: Math.max(-LIMIT, Math.min(LIMIT, raw.x)), z: Math.max(-LIMIT, Math.min(LIMIT, raw.z)) });
    if (out.length >= 128) break;
  }
  return out;
}

export function sanitizeFieldState(raw) {
  const fresh = createFieldState();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fresh;
  const inventory = emptyInventory();
  for (const id of Object.keys(ITEMS)) inventory[id] = Math.floor(clampNumber(raw.inventory?.[id], 0, ITEMS[id].stackLimit, fresh.inventory[id]));
  const accepted = cleanIds(raw.acceptedContracts);
  const discovered = cleanIds(raw.discovered);
  return {
    version: 4,
    inventory,
    collected: cleanIds(raw.collected),
    scanned: cleanIds(raw.scanned),
    opened: cleanIds(raw.opened),
    inspected: cleanIds(raw.inspected),
    crafted: cleanIds(raw.crafted),
    conversations: cleanIds(raw.conversations),
    discovered: discovered.length > 0 ? discovered : [...fresh.discovered],
    deployments: cleanDeployments(raw.deployments),
    acceptedContracts: accepted.length > 0 ? accepted : [...fresh.acceptedContracts],
    turnedInContracts: cleanIds(raw.turnedInContracts),
    reputation: Math.floor(clampNumber(raw.reputation, 0, 9999, 0)),
    restCount: Math.floor(clampNumber(raw.restCount, 0, 9999, 0)),
    health: clampNumber(raw.health, 0, 100, 100),
    wetness: clampNumber(raw.wetness, 0, 100, 0),
    cold: clampNumber(raw.cold, 0, 100, 0),
    worldMinutes: clampNumber(raw.worldMinutes, 0, 9999999, fresh.worldMinutes),
    playerPosition: {
      x: clampNumber(raw.playerPosition?.x, -LIMIT, LIMIT, fresh.playerPosition.x),
      y: typeof raw.playerPosition?.y === 'number' && Number.isFinite(raw.playerPosition.y) ? clampNumber(raw.playerPosition.y, -256, 4096, 0) : null,
      z: clampNumber(raw.playerPosition?.z, -LIMIT, LIMIT, fresh.playerPosition.z),
    },
    waypointId: typeof raw.waypointId === 'string' && raw.waypointId.length <= 120 ? raw.waypointId : null,
    stats: {
      distance: clampNumber(raw.stats?.distance, 0, 1e9, 0),
      seconds: clampNumber(raw.stats?.seconds, 0, 1e9, 0),
    },
  };
}

export class FieldSaveStore {
  load() {
    try {
      const raw = localStorage.getItem(STORAGE.field);
      return sanitizeFieldState(raw ? JSON.parse(raw) : null);
    } catch {
      return sanitizeFieldState(null);
    }
  }

  hasSave() {
    try {
      return localStorage.getItem(STORAGE.field) !== null;
    } catch {
      return false;
    }
  }

  save(state) {
    return this.write(STORAGE.field, state);
  }

  loadSandbox(fallback) {
    try {
      const raw = localStorage.getItem(STORAGE.sandbox);
      return sanitizeFieldState(raw ? JSON.parse(raw) : (fallback ?? null));
    } catch {
      return sanitizeFieldState(fallback ?? null);
    }
  }

  saveSandbox(state) {
    return this.write(STORAGE.sandbox, state);
  }

  hasSandbox() {
    try {
      return localStorage.getItem(STORAGE.sandbox) !== null;
    } catch {
      return false;
    }
  }

  clearSandbox() {
    try {
      localStorage.removeItem(STORAGE.sandbox);
      return true;
    } catch {
      return false;
    }
  }

  /** New expedition: forget the campaign, the relays and the sandbox (field-stamp layouts stay). */
  clearCampaign() {
    try {
      localStorage.removeItem(STORAGE.field);
      localStorage.removeItem(STORAGE.relays);
      localStorage.removeItem(STORAGE.sandbox);
      return true;
    } catch {
      return false;
    }
  }

  write(key, state) {
    try {
      localStorage.setItem(key, JSON.stringify(sanitizeFieldState(state)));
      return true;
    } catch {
      return false;
    }
  }
}
