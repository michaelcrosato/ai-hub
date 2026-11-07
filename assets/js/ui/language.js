/**
 * ui/language.js — the Language menu every view carries beside its account
 * control: the hub's languages, each written in its own language. A choice is
 * kept on this device and the page loads again in it. With only one language
 * to show, the menu stays hidden.
 *
 * A key never chooses by accident. A closed list steps to another option on
 * an arrow, Home, End, Page Up, Page Down or a typed letter, which here would
 * load the page in another language, so those keys open the list instead, and
 * Enter or a click chooses in it.
 */

import { h, icon } from '../dom.js';
import { LANGUAGES, FAKE, lang, t, languageName, chooseLanguage } from '../lang.js';

const GLOBE = 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.4 2.5 3.6 5.5 3.6 9s-1.2 6.5-3.6 9M12 3c-2.4 2.5-3.6 5.5-3.6 9s1.2 6.5 3.6 9';

/**
 * `openOnKeys: false` is for a view whose keys are its own, like the Couch's
 * arrows and letter shortcuts: the keys that would step the closed list then
 * leave it as it is, and the view opens the list its own way.
 */
export function languageMenu({ className = '', openOnKeys = true } = {}) {
  const testing = FAKE.includes(lang);
  const root = h('label', { class: `language ${className}`.trim(), title: t('lang.menu_hint') });
  if (LANGUAGES.length < 2 && !testing) {
    root.hidden = true;
    return root;
  }
  const select = h(
    'select',
    { class: 'language__select', 'aria-label': t('lang.menu') },
    testing && h('option', { value: lang, selected: true }, `${t('lang.test')} · ${lang}`),
    LANGUAGES.map((code) => h('option', { value: code, lang: code, selected: code === lang }, languageName(code)))
  );
  onChoice(select, chooseLanguage, { current: lang, open: openOnKeys });
  root.append(icon(GLOBE), select);
  return root;
}

/** Keys a closed list answers by stepping to another option. Alt+Up and Alt+Down open it instead. */
const STEPS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown']);

/** True for a key that steps a closed list: one of STEPS, or a typed character, which jumps to a name. */
export const stepsClosedList = ({ key, altKey, ctrlKey, metaKey }) =>
  STEPS.has(key)
    ? !(altKey && (key === 'ArrowUp' || key === 'ArrowDown'))
    : typeof key === 'string' && [...key].length === 1 && key !== ' ' && !altKey && !ctrlKey && !metaKey;

/** True while the list is open, where the browser can tell. */
const isOpen = (select) => {
  try {
    return select.matches(':open');
  } catch {
    return false;
  }
};

/**
 * Calls `choose` with the select's value when a change is a choice, which a
 * change made while a stepping key is handled is not: the select goes back to
 * `current`, and with `open` the list opens. A choice from the open list, made
 * with Enter or a click, arrives with no stepping key behind it.
 *
 * The keys are only noted, never stopped, so an open list that a browser
 * passes its keys through to the page still moves with them. A key's change
 * comes while its own event is handled, so the note lasts until the next task.
 */
export function onChoice(select, choose, { current, open = true }) {
  let stepping = false;
  const note = (event) => {
    if (!stepsClosedList(event)) return;
    stepping = true;
    setTimeout(() => { stepping = false; });
  };
  select.addEventListener('keydown', note);
  select.addEventListener('keypress', note);   // a typed letter steps the list on keypress
  select.addEventListener('change', () => {
    if (!stepping) return choose(select.value);
    stepping = false;
    select.value = current;
    if (open && !isOpen(select)) {
      try { select.showPicker?.(); } catch {}   // without a picker to show, the key does nothing
    }
  });
}
