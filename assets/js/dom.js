/**
 * dom.js — the only DOM helper this project has.
 *
 * h('div', { class: 'x', onclick: fn, style: { '--g-light': '#fff' } }, ...kids)
 * Children may be nodes, strings, numbers, arrays, or null/false/undefined
 * (skipped), so conditional markup reads as `cond && h(...)`.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const SVG_TAGS = new Set([
  'svg', 'path', 'circle', 'rect', 'g', 'line', 'ellipse', 'polygon', 'polyline',
  'defs', 'use', 'text', 'image', 'radialGradient', 'linearGradient', 'stop', 'clipPath',
]);

export function h(tag, props, ...children) {
  const el = SVG_TAGS.has(tag)
    ? document.createElementNS(SVG_NS, tag)
    : document.createElement(tag);

  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === 'style' && typeof value === 'object') {
      for (const [prop, v] of Object.entries(value)) {
        if (v != null) el.style.setProperty(prop, String(v));
      }
    } else if (key === 'dataset') {
      Object.assign(el.dataset, value);
    } else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2), value);
    } else if (key === 'html') {
      el.innerHTML = value;
    } else if (value === true) {
      el.setAttribute(key, '');
    } else {
      el.setAttribute(key, String(value));
    }
  }

  append(el, children);
  return el;
}

export function append(el, children) {
  for (const child of children.flat(4)) {
    if (child == null || child === false || child === true) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

export const clear = (el) => {
  while (el.firstChild) el.firstChild.remove();
  return el;
};

/** Inline icons. Small enough to keep here rather than ship a sprite. */
export const icon = (d, extra) =>
  h(
    'svg',
    { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.9', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', ...extra },
    h('path', { d })
  );

export const ICONS = {
  star: 'M12 3.6l2.5 5.3 5.5.8-4 4.1 1 5.9-5-2.8-5 2.8 1-5.9-4-4.1 5.5-.8z',
  back: 'M15 5l-7 7 7 7',
  caret: 'M6 9l6 6 6-6',
  close: 'M6 6l12 12M18 6L6 18',
  play: 'M7 4.5v15l13-7.5z',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  // Four big squares, then nine small ones: the two wall densities.
  roomy: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  dense: 'M4 4h4v4H4zM10 4h4v4h-4zM16 4h4v4h-4zM4 10h4v4H4zM10 10h4v4h-4zM16 10h4v4h-4zM4 16h4v4H4zM10 16h4v4h-4zM16 16h4v4h-4z',
  // Three cards fanned on top of each other: a stack of attempts.
  stack: 'M8 4h11a1 1 0 0 1 1 1v11M5 7h11a1 1 0 0 1 1 1v11M3 10h10a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z',
  // A die showing five; the pips are zero-length strokes drawn by round caps.
  dice: 'M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01',
};
