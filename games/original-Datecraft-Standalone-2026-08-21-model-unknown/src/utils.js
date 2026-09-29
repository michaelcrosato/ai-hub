// Converted from the original AMD bundle; the code below is unchanged apart from the module wrapper.
const exports = {};
exports.hashSeed = hashSeed;
exports.randomFloat = randomFloat;
exports.randomInt = randomInt;
exports.pick = pick;
exports.weightedPick = weightedPick;
exports.uniqueId = uniqueId;
exports.chance = chance;
exports.average = average;
exports.boundedAdd = boundedAdd;
exports.invariant = invariant;
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Number(value) || 0));
exports.clamp = clamp;
const roundMoney = (value) => Math.round((Number(value) || 0) / 5) * 5;
exports.roundMoney = roundMoney;
const deepClone = (value) => typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
exports.deepClone = deepClone;
const absoluteSlot = (day, slot) => (Math.max(1, day) - 1) * 4 + Math.max(0, slot);
exports.absoluteSlot = absoluteSlot;
const fromAbsoluteSlot = (value) => ({ day: Math.floor(Math.max(0, value) / 4) + 1, slot: Math.max(0, value) % 4 });
exports.fromAbsoluteSlot = fromAbsoluteSlot;
const formatMoney = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value) || 0);
exports.formatMoney = formatMoney;
const titleCase = (value = '') => String(value).replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
exports.titleCase = titleCase;
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
exports.escapeHtml = escapeHtml;
function hashSeed(input = 'datecraft') {
    let hash = 2166136261 >>> 0;
    for (const char of String(input)) {
        hash ^= char.charCodeAt(0);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0 || 0x6d2b79f5;
}
function randomFloat(state) {
    let value = state.meta.rngState >>> 0;
    value += 0x6d2b79f5;
    state.meta.rngState = value >>> 0;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function randomInt(state, min, max) {
    const low = Math.ceil(min);
    const high = Math.floor(max);
    return Math.floor(randomFloat(state) * (high - low + 1)) + low;
}
function pick(state, collection) {
    if (!Array.isArray(collection) || collection.length === 0)
        return undefined;
    return collection[randomInt(state, 0, collection.length - 1)];
}
function weightedPick(state, entries) {
    const total = entries.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
    let roll = randomFloat(state) * total;
    for (const entry of entries) {
        roll -= Math.max(0, entry.weight);
        if (roll <= 0)
            return entry.value;
    }
    return entries.at(-1)?.value;
}
function uniqueId(state, prefix = 'id') {
    const count = ++state.meta.idCounter;
    const random = Math.floor(randomFloat(state) * 0xffffff).toString(36).padStart(4, '0');
    return `${prefix}-${count.toString(36)}-${random}`;
}
function chance(state, probability) {
    return randomFloat(state) < (0, exports.clamp)(probability, 0, 1);
}
function average(values) {
    const filtered = values.map(Number).filter(Number.isFinite);
    return filtered.length ? filtered.reduce((sum, value) => sum + value, 0) / filtered.length : 0;
}
function boundedAdd(object, key, amount, min = 0, max = 100) {
    object[key] = (0, exports.clamp)((Number(object[key]) || 0) + amount, min, max);
    return object[key];
}
function invariant(condition, message) {
    if (!condition)
        throw new Error(message);
}
export { hashSeed, randomFloat, randomInt, pick, weightedPick, uniqueId, chance, average, boundedAdd, invariant, clamp, roundMoney, deepClone, absoluteSlot, fromAbsoluteSlot, formatMoney, titleCase, escapeHtml };
