/**
 * Cached DOM writes for the HUD: an element is looked up once and touched only when its
 * value changes, so a frame never writes the same text twice or forces style recalculation.
 */
export function createHud(root = document) {
  const nodes = new Map(), last = new Map();
  const node = id => {
    let n = nodes.get(id);
    if (!n) {
      n = root.getElementById(id);
      if (!n) throw new Error(`Missing HUD element: ${id}`);
      nodes.set(id, n);
    }
    return n;
  };
  const changed = (key, value) => {
    if (last.get(key) === value) return false;
    last.set(key, value);
    return true;
  };
  return {
    node,
    text(id, value) { if (changed(`t:${id}`, value)) node(id).textContent = value; },
    /** Percent width, rounded to 0.5% so a draining meter does not rewrite every frame. */
    width(id, percent) {
      const v = Math.round(Math.max(0, Math.min(100, percent)) * 2) / 2;
      if (changed(`w:${id}`, v)) node(id).style.width = `${v}%`;
    },
    toggle(id, className, on) { if (changed(`c:${id}:${className}`, !!on)) node(id).classList.toggle(className, !!on); },
    hidden(id, hidden) { if (changed(`h:${id}`, !!hidden)) node(id).hidden = !!hidden; },
    opacity(id, value) {
      const v = Math.round(value * 50) / 50;
      if (changed(`o:${id}`, v)) node(id).style.opacity = String(v);
    },
    /** Forget cached values (after something else wrote to these elements). */
    reset() { last.clear(); },
  };
}
