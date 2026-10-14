/** Versioned, case-scoped persistence. The store follows E.store's get/set API.
 * Validation always precedes restoration; an invalid/newer original is never
 * replaced by autosave. Call resolveRecovery('reset') after an explicit choice.
 */
export const SAVE_FORMAT = "last-watch-adventure";
export const SAVE_FORMAT_VERSION = 1;

const clone = (value) => JSON.parse(JSON.stringify(value));
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const failure = (message, code = "invalid-save") => ({ ok: false, error: message, code });

/** Browser persistence with E.store's namespace, but without its silent JSON
 * parse fallback. Malformed originals are returned verbatim for recovery. */
export function createBrowserSaveStore({ storage, prefix = "my3d2dge:" } = {}) {
  const getStorage = () => storage || globalThis.localStorage;
  return {
    get(key, fallback = null) {
      const raw = getStorage().getItem(prefix + key);
      if (raw === null) return fallback;
      try {
        const value = JSON.parse(raw);
        return value === null ? raw : value;
      } catch { return raw; }
    },
    set(key, value) {
      try { getStorage().setItem(prefix + key, JSON.stringify(value)); return true; }
      catch { return false; }
    },
  };
}

export function createSaveManager({ store, definition, adventure, development = false }) {
  if (!store?.get || !store?.set || !definition?.id || !adventure)
    throw new Error("createSaveManager needs store, definition.id and adventure");
  const fresh = adventure.freshCase || adventure.createState;
  const validate = adventure.validateCase || adventure.validateState;
  const restore = adventure.restoreCase || adventure.restoreState;
  if (![fresh, validate, restore].every((method) => typeof method === "function"))
    throw new Error("Save adventure needs freshCase, validateCase and restoreCase");
  const schemaVersion = definition.schemaVersion ?? 1;
  const contentVersion = definition.contentVersion ?? definition.version ?? 1;
  const tracksArea = Object.hasOwn(fresh.call(adventure), "area");
  const areaIDs = new Set((definition.areas || []).map((area) => area.id));
  const startArea = definition.startArea || definition.areas?.[0]?.id;
  if (!areaIDs.has(startArea)) throw new Error("Save definition needs a valid startArea");
  const storageKey = `lastwatch:${encodeURIComponent(definition.id)}:${development ? "development" : "player"}:save`;
  const checkpointKey = `${storageKey}:checkpoints`;
  let recovery = null;
  let current = null;
  let lastError = null;
  let initialized = false;

  const defaults = () => ({ state: fresh.call(adventure), area: startArea, begun: false });
  function read(key, fallback = null) {
    try { return store.get(key, fallback); }
    catch (error) { lastError = `Storage read failed: ${error.message}`; return fallback; }
  }
  function write(key, value) {
    try {
      if (store.set(key, clone(value)) === false) throw new Error("storage unavailable");
      return true;
    } catch (error) {
      lastError = `Storage write failed: ${error.message}`;
      return false;
    }
  }
  function sessionFrom(value) {
    if (!object(value) || typeof value.begun !== "boolean" || !areaIDs.has(value.area))
      return failure("Save has an unknown area or invalid begun value");
    try {
      if (!validate.call(adventure, value.state)) return failure("Save progression is invalid");
      const source = clone(value.state);
      // The session envelope is the location authority, including legacy saves
      // whose progression did not yet contain the runtime's area field.
      if (tracksArea) source.area = value.area;
      const state = restore.call(adventure, source);
      if (!validate.call(adventure, state)) return failure("Restored progression is invalid");
      return { ok: true, session: { state, area: value.area, begun: value.begun } };
    } catch (error) { return failure(`Save progression could not be restored: ${error.message}`); }
  }
  function envelope(session) {
    const checked = sessionFrom(session);
    if (!checked.ok) throw new Error(checked.error);
    return {
      format: SAVE_FORMAT,
      formatVersion: SAVE_FORMAT_VERSION,
      caseId: definition.id,
      schemaVersion,
      contentVersion,
      savedAt: new Date().toISOString(),
      ...checked.session,
    };
  }
  function inspect(raw, permitMigration = true) {
    let value;
    try { value = typeof raw === "string" ? JSON.parse(raw) : clone(raw); }
    catch { return failure("Save is not valid JSON"); }
    if (!object(value) || value.format !== SAVE_FORMAT)
      return failure("Unrecognized save format");
    if (value.caseId !== definition.id) return failure("Save belongs to a different case", "wrong-case");
    const compatible = value.formatVersion === SAVE_FORMAT_VERSION &&
      value.schemaVersion === schemaVersion && value.contentVersion === contentVersion;
    if (!compatible) {
      if (permitMigration && typeof definition.saves?.migrate === "function") {
        try {
          const migrated = definition.saves.migrate(clone(value), { definition, adventure });
          if (migrated) {
            const result = inspect(migrated, false);
            if (result.ok) return { ...result, migrated: true };
            return result;
          }
        } catch (error) { return failure(`Save migration failed: ${error.message}`, "migration-failed"); }
      }
      return failure(`Save versions are unsupported (format ${value.formatVersion}, schema ${value.schemaVersion}, content ${value.contentVersion})`, "unsupported-version");
    }
    return sessionFrom(value);
  }
  function retain(raw, result, sourceKey = storageKey) {
    recovery = { code: result.code || "invalid-save", message: result.error, sourceKey, original: clone(raw) };
    current = defaults();
    return { ...clone(current), recovery: clone(recovery) };
  }
  function load() {
    initialized = true;
    lastError = null;
    const raw = read(storageKey);
    if (raw !== null && raw !== undefined) {
      const result = inspect(raw);
      if (!result.ok) return retain(raw, result);
      recovery = null;
      current = result.session;
      // Loading is read-only, including supported migrations. Next normal save
      // writes the migrated envelope; unsupported originals remain untouched.
      return { ...clone(current), ...(result.migrated ? { migrated: true } : {}) };
    }
    const legacy = !development && definition.saves?.legacy;
    if (legacy?.stateKey) {
      const rawState = read(legacy.stateKey);
      if (rawState !== null && rawState !== undefined) {
        const bundle = {
          state: rawState,
          area: read(legacy.areaKey, startArea),
          begun: read(legacy.begunKey, false),
        };
        try {
          // Legacy callbacks must validate before any restore helper that falls
          // back to a fresh state. Without a callback, validation remains strict.
          const migrated = typeof legacy.migrate === "function"
            ? legacy.migrate(clone(bundle), adventure, definition) : bundle;
          const result = sessionFrom(migrated);
          if (!result.ok) return retain(bundle, result, legacy.stateKey);
          recovery = null;
          current = result.session;
          return { ...clone(current), migrated: true };
        } catch (error) {
          return retain(bundle, failure(`Legacy migration failed: ${error.message}`, "migration-failed"), legacy.stateKey);
        }
      }
    }
    recovery = null;
    current = defaults();
    return clone(current);
  }
  function save(session) {
    if (!initialized) load();
    if (recovery) { lastError = "Autosave paused until the incompatible save is resolved"; return false; }
    try {
      const value = envelope(session);
      if (!write(storageKey, value)) return false;
      current = sessionFrom(value).session;
      lastError = null;
      return true;
    } catch (error) { lastError = error.message; return false; }
  }
  function exportSave(session = current || defaults()) { return JSON.stringify(envelope(session), null, 2); }
  function importSave(raw, { persist = true } = {}) {
    const result = inspect(raw);
    if (!result.ok) return result;
    if (persist && !initialized) load();
    if (persist && recovery) return failure("Resolve the existing incompatible save before importing", "recovery-pending");
    if (persist && !save(result.session)) return failure(lastError || "Save could not be written", "storage-unavailable");
    return { ok: true, session: clone(result.session), ...(result.migrated ? { migrated: true } : {}) };
  }
  function resolveRecovery(choice) {
    if (!recovery) return { ok: true, session: clone(current || defaults()) };
    if (choice === "keep") return { ok: false, recovery: clone(recovery), error: "Original retained; autosave remains paused" };
    if (choice === "retry") {
      const session = load();
      return session.recovery ? { ok: false, recovery: session.recovery, error: session.recovery.message } : { ok: true, session };
    }
    if (choice !== "reset") return failure("Choose reset, retry or keep");
    const pending = recovery;
    const backupKey = `${storageKey}:recovery:${Date.now()}`;
    // A failed backup must never allow replacement of the only original.
    if (!write(backupKey, pending)) return failure(lastError, "storage-unavailable");
    recovery = null;
    const next = defaults();
    if (!save(next)) {
      recovery = pending;
      return failure(lastError, "storage-unavailable");
    }
    return { ok: true, session: clone(next), backupKey };
  }
  function checkpoint(name, session = current || defaults()) {
    if (typeof name !== "string" || !name.trim() || name.length > 80 || ["__proto__", "constructor", "prototype"].includes(name))
      return failure("Checkpoint name must be 1–80 characters");
    try {
      const value = envelope(session);
      const previous = read(checkpointKey, {});
      const entries = object(previous) ? { ...previous } : {};
      entries[name] = value;
      return write(checkpointKey, entries) ? { ok: true } : failure(lastError, "storage-unavailable");
    } catch (error) { return failure(error.message); }
  }
  function checkpoints() {
    const entries = read(checkpointKey, {});
    return object(entries) ? Object.keys(entries).sort() : [];
  }
  function restoreCheckpoint(name) {
    const entries = read(checkpointKey, {});
    if (!object(entries) || !Object.hasOwn(entries, name)) return failure("Unknown checkpoint");
    return importSave(entries[name], { persist: false });
  }
  return {
    storageKey, development, load, save, exportSave, importSave, resolveRecovery,
    checkpoint, checkpoints, restoreCheckpoint,
    getRecovery: () => recovery ? clone(recovery) : null,
    get lastError() { return lastError; },
  };
}
