/**
 * dom.js — a tiny declarative DOM layer: views return h() trees and
 * render() patches them onto real elements in place, so focus, slider drags
 * and scroll positions survive a re-render. Event handlers are properties
 * (onclick, oninput…), and only values that changed are written.
 */

const flatten = (list, out) => {
  for (const c of list) {
    if (c === null || c === undefined || c === false || c === true) continue;
    if (Array.isArray(c)) flatten(c, out);
    else out.push(typeof c === 'object' ? c : String(c));
  }
  return out;
};

export function h(tag, props, ...children) {
  return { tag, props: props || {}, children: flatten(children, []) };
}

const PROPERTY_KEYS = new Set(['value', 'checked', 'disabled', 'inert', 'hidden', 'tabIndex', 'open', 'min', 'max', 'step']);

function setProp(el, key, value, old) {
  if (key === 'key' || key === 'ref') return;
  if (key === 'class') {
    if (el.className !== (value || '')) el.className = value || '';
    return;
  }
  if (key === 'style') {
    const next = value || {};
    const prev = old || {};
    for (const k in prev) if (!(k in next)) el.style.setProperty(k, '');
    for (const k in next) if (prev[k] !== next[k]) el.style.setProperty(k, next[k]);
    return;
  }
  if (key.startsWith('on')) {
    el[key.toLowerCase()] = value || null;
    return;
  }
  if (key === 'value') {
    const v = value === undefined || value === null ? '' : String(value);
    if (el.value !== v) el.value = v;
    return;
  }
  if (key === 'tabIndex') {
    // Written as the attribute: a plain <section> already reports tabIndex -1,
    // so comparing the property would never add tabindex="-1" and the panel
    // could not take focus when it opens.
    if (value === undefined || value === null) el.removeAttribute('tabindex');
    else if (el.getAttribute('tabindex') !== String(value)) el.setAttribute('tabindex', String(value));
    return;
  }
  if (PROPERTY_KEYS.has(key)) {
    if (key === 'inert' || key === 'hidden' || key === 'disabled' || key === 'checked' || key === 'open') {
      if (el[key] !== !!value) el[key] = !!value;
    } else if (value === undefined || value === null) {
      el.removeAttribute(key === 'tabIndex' ? 'tabindex' : key);
    } else if (String(el[key]) !== String(value)) {
      el[key] = value;
    }
    return;
  }
  const aria = key.startsWith('aria-');
  if (value === undefined || value === null || (value === false && !aria)) {
    if (el.hasAttribute(key)) el.removeAttribute(key);
    return;
  }
  const v = typeof value === 'boolean' ? (aria ? String(value) : '') : String(value);
  if (el.getAttribute(key) !== v) el.setAttribute(key, v);
}

function setProps(el, oldProps, newProps) {
  for (const k in oldProps) if (!(k in newProps)) setProp(el, k, undefined, oldProps[k]);
  for (const k in newProps) {
    const v = newProps[k];
    if (k === 'style' || oldProps[k] !== v || k === 'value' || k === 'checked') setProp(el, k, v, oldProps[k]);
  }
}

function create(v) {
  if (typeof v === 'string') return document.createTextNode(v);
  const el = document.createElement(v.tag);
  el.__v = { tag: v.tag, props: {} };
  // Children first, so a range input's min/max exist before its value is set.
  for (const c of v.children) el.appendChild(create(c));
  setProps(el, {}, v.props);
  el.__v = v;
  if (v.props.ref) v.props.ref(el);
  return el;
}

function patch(parent, el, v) {
  if (typeof v === 'string') {
    if (el.nodeType === 3) {
      if (el.data !== v) el.data = v;
      return el;
    }
    const n = document.createTextNode(v);
    parent.replaceChild(n, el);
    return n;
  }
  const old = el.__v;
  if (el.nodeType !== 1 || !old || old.tag !== v.tag || old.props.key !== v.props.key) {
    const n = create(v);
    parent.replaceChild(n, el);
    return n;
  }
  patchChildren(el, v.children);
  setProps(el, old.props, v.props);
  el.__v = v;
  return el;
}

function patchChildren(el, children) {
  let node = el.firstChild;
  for (const c of children) {
    if (node) {
      const next = node.nextSibling;
      patch(el, node, c);
      node = next;
    } else {
      el.appendChild(create(c));
    }
  }
  while (node) {
    const next = node.nextSibling;
    el.removeChild(node);
    node = next;
  }
}

/** Patch a container's children to match a vnode (or list of vnodes). */
export function render(container, vnodes) {
  patchChildren(container, flatten([vnodes], []));
}
