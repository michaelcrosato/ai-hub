/** account/toast.js — a small notice at the foot of any page, gone after a while. */

import { h } from '../dom.js';

let shown = null;

export function toast(content, ms = 6_000) {
  shown?.remove();
  const el = h('div', { class: 'account-toast', role: 'status' }, content);
  document.body.append(el);
  shown = el;
  setTimeout(() => {
    if (shown === el) {
      el.remove();
      shown = null;
    }
  }, ms);
  return el;
}
