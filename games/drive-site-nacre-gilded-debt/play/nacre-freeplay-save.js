/* Nacre save transport. Hosted progress uses the authenticated same-origin API.
 * Local storage is used only when the caller explicitly selects offline:true.
 */
(function(root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NacreFreeplaySave = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(root) {
  'use strict';
  const STORAGE_KEY = 'my3d2dge:nacre:freeplay:v1';
  const SAVE_URL = '/api/freeplay/save';
  const FEEDBACK_URL = '/api/freeplay/feedback';
  const DEBOUNCE_MS = 1500;
  let idCounter = 0;

  function failure(code, message, httpStatus) {
    const error = new Error(message);
    error.name = 'NacreSaveError';
    error.code = code;
    if (httpStatus !== undefined) error.httpStatus = httpStatus;
    return error;
  }
  function jsonCopy(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw failure('invalid_data', label + ' must be an object.');
    let text;
    try {
      text = JSON.stringify(value, function(key, item) {
        if (typeof item === 'number' && !Number.isFinite(item) ||
            ['undefined', 'function', 'symbol', 'bigint'].includes(typeof item))
          throw new TypeError('Non-JSON value');
        return item;
      });
      const result = JSON.parse(text);
      if (!result || typeof result !== 'object' || Array.isArray(result)) throw new TypeError('Not an object');
      return result;
    } catch (_) { throw failure('invalid_data', label + ' must contain valid JSON data.'); }
  }
  function isRevision(value) { return Number.isSafeInteger(value) && value >= 0; }
  function randomId() {
    const crypto = root.crypto;
    if (crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    if (crypto && typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16); crypto.getRandomValues(bytes);
      return Array.from(bytes, n => n.toString(16).padStart(2, '0')).join('');
    }
    return 'nfs-' + Date.now().toString(36) + '-' + (++idCounter).toString(36) + '-' +
      Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  }
  function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object')
      return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
    return value;
  }
  function httpError(status, feedback) {
    if (status === 401) return failure('auth_required', feedback ? 'Sign in to send feedback.' : 'Sign in to save progress.', status);
    if (status === 503) return failure('unavailable', 'The save service is unavailable. Try again.', status);
    return failure('http_error', feedback ? 'Feedback was not sent. Try again.' : 'Progress was not saved. Try again.', status);
  }

  function create(options) {
    options = options || {};
    if (typeof options.validate !== 'function') throw new TypeError('A snapshot validator is required.');
    if (options.offline !== undefined && typeof options.offline !== 'boolean') throw new TypeError('offline must be a boolean.');
    const offline = options.offline === true;
    const fetcher = options.fetch || (typeof root.fetch === 'function' ? root.fetch.bind(root) : null);
    if (!offline && typeof fetcher !== 'function') throw new TypeError('A fetch function is required for hosted saves.');
    let observer = typeof options.onStatus === 'function' ? options.onStatus : function() {};
    let revision = 0, loaded = false, disposed = false, blocked = false, sequence = 0;
    let pending = null, attempt = null, timer = null, loadPromise = null, flushPromise = null;
    let current = { state: offline ? 'offline' : 'pending', message: 'Load progress to begin.' };
    const feedbackByContent = new Map(), feedbackById = new Map();

    function status() {
      return { ...current, revision, loaded, offline, hasPending: !!(pending || attempt), disposed };
    }
    function emit(state, message, extra) {
      current = { state, message, ...(extra || {}) };
      try { observer(status()); } catch (_) { /* A UI listener cannot interrupt a save. */ }
    }
    function checked(snapshot) {
      const copy = jsonCopy(snapshot, 'Progress');
      let valid;
      try { valid = options.validate(copy); }
      catch (_) { throw failure('invalid_snapshot', 'Progress data is not valid.'); }
      if (valid && typeof valid.then === 'function') throw failure('invalid_validator', 'Use a synchronous progress validator.');
      if (valid === false) throw failure('invalid_snapshot', 'Progress data is not valid.');
      return jsonCopy(copy, 'Progress');
    }
    function storage() {
      const value = options.storage !== undefined ? options.storage : root.localStorage;
      if (!value || typeof value.getItem !== 'function' || typeof value.setItem !== 'function')
        throw failure('storage_unavailable', 'Offline storage is unavailable.');
      return value;
    }
    function clearTimer() { if (timer !== null) { root.clearTimeout(timer); timer = null; } }
    function schedule() {
      clearTimer();
      if (!disposed && loaded && !blocked && !flushPromise)
        timer = root.setTimeout(function() { timer = null; flush(); }, DEBOUNCE_MS);
    }
    function savedState() {
      emit(offline ? 'offline' : 'saved', offline ? 'Progress saved on this device.' : 'Progress saved.');
    }
    function resultError(error, extra) {
      return { ok: false, code: error.code || 'network_error', message: error.message,
        revision, hasPending: !!(pending || attempt), ...(error.httpStatus ? { httpStatus: error.httpStatus } : {}), ...(extra || {}) };
    }
    function reportSaveError(error) {
      const code = error.code || 'network_error';
      const message = error.code ? error.message : 'The save could not be confirmed. Changes are kept.';
      emit('error', message, { code, retryable: true });
      return resultError(failure(code, message, error.httpStatus));
    }

    function load() {
      if (disposed) return Promise.reject(failure('disposed', 'This save session is closed.'));
      if (loadPromise) return loadPromise;
      if (blocked || loaded && (pending || attempt || flushPromise))
        return Promise.reject(failure('pending_changes', 'Keep or export pending changes before reloading.'));
      loadPromise = Promise.resolve().then(async function() {
        emit('loading', 'Loading progress.');
        try {
          let data;
          if (offline) {
            const text = storage().getItem(STORAGE_KEY);
            if (text === null) data = { snapshot: null, revision: 0 };
            else { try { data = JSON.parse(text); } catch (_) { throw failure('invalid_save', 'Saved progress is not valid. The saved copy was kept.'); } }
          } else {
            const response = await fetcher(SAVE_URL, { method: 'GET', credentials: 'same-origin', cache: 'no-store' });
            if (!response.ok) throw httpError(response.status);
            try { data = await response.json(); } catch (_) { throw failure('invalid_save', 'Saved progress is not valid. The saved copy was kept.'); }
          }
          if (!data || typeof data !== 'object' || Array.isArray(data) || !isRevision(data.revision) || !Object.prototype.hasOwnProperty.call(data, 'snapshot'))
            throw failure('invalid_save', 'Saved progress is not valid. The saved copy was kept.');
          const snapshot = data.snapshot === null ? null : checked(data.snapshot);
          revision = data.revision; loaded = true;
          if (pending) { emit('pending', 'Changes are waiting to save.'); schedule(); } else savedState();
          return { snapshot, revision };
        } catch (error) {
          reportSaveError(error);
          throw error.code ? error : failure('load_failed', 'Progress could not be loaded. Try again.');
        }
      }).finally(function() { loadPromise = null; });
      return loadPromise;
    }

    function queue(snapshot) {
      if (disposed) throw failure('disposed', 'This save session is closed.');
      const copy = checked(snapshot);
      pending = { snapshot: copy, sequence: ++sequence };
      if (blocked) emit('conflict', 'Another session changed this save. Your changes are kept.', { code: 'save_conflict', remoteRevision: current.remoteRevision, retryable: false });
      else emit(flushPromise ? 'saving' : 'pending', flushPromise ? 'Saving progress.' : 'Changes are waiting to save.');
      schedule();
    }

    async function drain() {
      if (loadPromise) { try { await loadPromise; } catch (error) { return resultError(error); } }
      if (!pending && !attempt) return { ok: true, revision, noop: true, hasPending: false };
      if (!loaded) return reportSaveError(failure('not_loaded', 'Load progress before saving. Your changes are kept.'));
      if (blocked) return resultError(failure('save_conflict', current.message), { remoteRevision: current.remoteRevision });
      while ((pending || attempt) && !disposed) {
        try {
          if (!attempt) {
            if (!isRevision(revision + 1)) throw failure('revision_limit', 'The save revision limit was reached. Export your progress.');
            const snapshot = checked(pending.snapshot);
            attempt = { snapshot, sequence: pending.sequence, expectedRevision: revision, writeId: randomId() };
          }
          const writing = attempt;
          emit('saving', offline ? 'Saving progress on this device.' : 'Saving progress.');
          let nextRevision;
          if (offline) {
            nextRevision = writing.expectedRevision + 1;
            try { storage().setItem(STORAGE_KEY, JSON.stringify({ snapshot: writing.snapshot, revision: nextRevision, writeId: writing.writeId })); }
            catch (_) { throw failure('storage_failed', 'Offline storage is full or unavailable. Changes are kept.'); }
          } else {
            const response = await fetcher(SAVE_URL, {
              method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ snapshot: writing.snapshot, expectedRevision: writing.expectedRevision, writeId: writing.writeId })
            });
            if (response.status === 409) {
              let info; try { info = await response.json(); } catch (_) { info = null; }
              blocked = true;
              const remoteRevision = info && isRevision(info.revision) ? info.revision : undefined;
              emit('conflict', 'Another session changed this save. Your changes are kept.', { code: 'save_conflict', remoteRevision, retryable: false });
              return resultError(failure('save_conflict', current.message, 409), { remoteRevision });
            }
            if (!response.ok) throw httpError(response.status);
            let data; try { data = await response.json(); } catch (_) { throw failure('invalid_reply', 'The save reply was not valid. Changes are kept.'); }
            if (!data || !isRevision(data.revision) || data.revision <= writing.expectedRevision || data.writeId !== writing.writeId)
              throw failure('invalid_reply', 'The save reply was not valid. Changes are kept.');
            nextRevision = data.revision;
          }
          revision = nextRevision;
          if (pending && pending.sequence === writing.sequence) pending = null;
          attempt = null;
        } catch (error) { return reportSaveError(error); }
      }
      if (disposed && (pending || attempt)) return resultError(failure('disposed', 'This save session is closed.'));
      savedState();
      return { ok: true, revision, hasPending: !!(pending || attempt) };
    }
    function flush() {
      clearTimer();
      if (flushPromise) return flushPromise;
      if (disposed) return Promise.resolve(resultError(failure('disposed', 'This save session is closed.')));
      let completed = false;
      flushPromise = Promise.resolve().then(drain).then(function(result) {
        completed = result.ok;
        return result;
      }).finally(function() {
        flushPromise = null;
        if (completed && pending && !attempt && loaded && !blocked && !disposed) schedule();
      });
      return flushPromise;
    }
    function pendingSnapshot() { return pending ? jsonCopy(pending.snapshot, 'Progress') : attempt ? jsonCopy(attempt.snapshot, 'Progress') : null; }

    function submitFeedback(report, transport) {
      if (disposed) return Promise.reject(failure('disposed', 'This save session is closed.'));
      const copy = jsonCopy(report, 'Feedback'), key = JSON.stringify(canonical(copy));
      const explicitId = transport && transport.id;
      if (explicitId !== undefined && (typeof explicitId !== 'string' || !/^[A-Za-z0-9:_-]{1,160}$/.test(explicitId)))
        throw failure('invalid_id', 'The feedback ID is not valid.');
      let entry = feedbackByContent.get(key);
      if (entry && explicitId !== undefined && entry.id !== explicitId)
        throw failure('feedback_id_changed', 'Retry this feedback with its original ID.');
      if (!entry) {
        const id = explicitId || randomId();
        if (feedbackById.has(id) && feedbackById.get(id) !== key)
          throw failure('feedback_id_reused', 'Use a new ID for changed feedback.');
        entry = { id, report: copy, promise: null };
        feedbackByContent.set(key, entry); feedbackById.set(id, key);
      }
      if (offline) return Promise.resolve({ ok: false, code: 'offline_feedback', id: entry.id, exportOnly: true, report: jsonCopy(entry.report, 'Feedback'), message: 'Offline feedback is ready to export.' });
      if (entry.promise) return entry.promise;
      entry.promise = Promise.resolve().then(async function() {
        try {
          const response = await fetcher(FEEDBACK_URL, {
            method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ report: entry.report, id: entry.id })
          });
          if (!response.ok) throw httpError(response.status, true);
          let data; try { data = await response.json(); } catch (_) { throw failure('invalid_reply', 'Feedback could not be confirmed. Try again.'); }
          if (!data || data.id !== entry.id || data.saved !== true) throw failure('invalid_reply', 'Feedback could not be confirmed. Try again.');
          feedbackByContent.delete(key);
          return { ok: true, id: entry.id, saved: true };
        } catch (error) {
          return { ok: false, id: entry.id, code: error.code || 'network_error', message: error.code ? error.message : 'Feedback could not be confirmed. Try again.' };
        }
      }).finally(function() { entry.promise = null; });
      return entry.promise;
    }
    function dispose() { clearTimer(); disposed = true; observer = function() {}; }
    return Object.freeze({ load, queue, flush, submitFeedback, status, pendingSnapshot, dispose });
  }
  return Object.freeze({ create, storageKey: STORAGE_KEY, debounceMs: DEBOUNCE_MS });
});
