/** One focus owner determines whether world movement and interaction may run. */
export const INPUT_OWNERS = Object.freeze(["world", "actions", "conversation", "inventory", "puzzle", "modal", "engine"]);

export function createInputFocus({ initial = "world", onChange = () => {} } = {}) {
  const check = (owner) => {
    if (!INPUT_OWNERS.includes(owner)) throw new Error(`Unknown input owner: ${owner}`);
    return owner;
  };
  let context = check(initial), modal = false, engine = false;
  const listeners = new Set([onChange]);
  const get = () => engine ? "engine" : modal ? "modal" : context;
  function change(fn) {
    const previous = get();
    fn();
    const owner = get();
    if (owner !== previous) for (const listener of listeners) listener(owner, previous);
    return owner;
  }
  return {
    get,
    context: () => context,
    set: (owner) => change(() => { context = check(owner); }),
    update: (overrides = {}) => change(() => {
      if (Object.hasOwn(overrides, "modal")) modal = !!overrides.modal;
      if (Object.hasOwn(overrides, "engine")) engine = !!overrides.engine;
    }),
    is: (owner) => get() === owner,
    worldEnabled: () => get() === "world",
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  };
}

/** Wrap around visible enabled controls. A newly opened UI starts at its first
 * control when moving forwards, or last when moving backwards. */
export function nextFocusIndex(index, direction, count) {
  if (!Number.isInteger(count) || count <= 0) return -1;
  if (index < 0 || index >= count) return direction < 0 ? count - 1 : 0;
  return (index + (direction < 0 ? -1 : 1) + count) % count;
}

/** Optional DOM bridge. Call refresh when opening/closing engine menus or a
 * dialog. Explicit focus.set('puzzle' etc.) remains the shell's responsibility.
 * [data-input-owner] declares a control's context. Capture filtering preserves
 * native button activation while preventing the engine's global input handler
 * from consuming it. onEscape returns false to leave an Escape unhandled.
 */
export function createDOMFocusAdapter({
  focus,
  document: doc = globalThis.document,
  window: win = globalThis.window,
  modal,
  worldRoot,
  actionRoot,
  getEnginePaused = () => false,
  onEscape = () => false,
  onOwnerChange = () => {},
} = {}) {
  if (!focus || !doc || !win) throw new Error("DOM focus adapter needs focus, document and window");
  const unsubscribe = focus.subscribe(onOwnerChange);
  const refresh = () => focus.update({ modal: !!modal?.open, engine: !!getEnginePaused() });
  const editingText = () => !!(doc.activeElement?.isContentEditable ||
    doc.activeElement?.matches?.("input,textarea,select,[contenteditable='true'],[contenteditable='']"));
  function focusin(event) {
    if (modal?.open || getEnginePaused()) return refresh();
    const target = event.target;
    const explicit = target?.closest?.("[data-input-owner]")?.dataset?.inputOwner;
    if (explicit && INPUT_OWNERS.includes(explicit)) focus.set(explicit);
    else if (worldRoot?.contains(target)) focus.set("world");
    else if (actionRoot?.contains(target) && focus.context() === "world") focus.set("actions");
    refresh();
  }
  function keydown(event) {
    refresh();
    if (focus.is("engine")) return;
    if (event.key === "Escape" && !focus.worldEnabled() && onEscape(focus.get(), event) !== false) {
      event.preventDefault();
      event.stopImmediatePropagation();
      refresh();
      return;
    }
    const active = doc.activeElement;
    const nativeControl = active?.matches?.("button,a[href],input,textarea,select,[contenteditable='true']");
    if (focus.is("modal") || editingText() || (nativeControl && ["Enter", " ", "Spacebar"].includes(event.key)))
      event.stopImmediatePropagation();
  }
  function keyup(event) {
    refresh();
    if (!focus.is("engine") && (focus.is("modal") || editingText())) event.stopImmediatePropagation();
  }
  doc.addEventListener("focusin", focusin);
  win.addEventListener("keydown", keydown, true);
  win.addEventListener("keyup", keyup, true);
  refresh();
  return {
    refresh,
    dispose() {
      unsubscribe();
      doc.removeEventListener("focusin", focusin);
      win.removeEventListener("keydown", keydown, true);
      win.removeEventListener("keyup", keyup, true);
    },
  };
}
