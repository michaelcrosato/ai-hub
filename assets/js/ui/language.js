/**
 * ui/language.js — the Language menu every view carries beside its account
 * control: the hub's languages, each written in its own language. A choice is
 * kept on this device and the page loads again in it. With only one language
 * to show, the menu stays hidden.
 */

import { h, icon } from '../dom.js';
import { LANGUAGES, FAKE, lang, t, languageName, chooseLanguage } from '../lang.js';

const GLOBE = 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.4 2.5 3.6 5.5 3.6 9s-1.2 6.5-3.6 9M12 3c-2.4 2.5-3.6 5.5-3.6 9s1.2 6.5 3.6 9';

export function languageMenu({ className = '' } = {}) {
  const testing = FAKE.includes(lang);
  const root = h('label', { class: `language ${className}`.trim(), title: t('lang.menu_hint') });
  if (LANGUAGES.length < 2 && !testing) {
    root.hidden = true;
    return root;
  }
  const select = h(
    'select',
    { class: 'language__select', 'aria-label': t('lang.menu'), onchange: () => chooseLanguage(select.value) },
    testing && h('option', { value: lang, selected: true }, `${t('lang.test')} · ${lang}`),
    LANGUAGES.map((code) => h('option', { value: code, lang: code, selected: code === lang }, languageName(code)))
  );
  root.append(icon(GLOBE), select);
  return root;
}
