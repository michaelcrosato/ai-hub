/**
 * privacy.js — the privacy page's entry module: its lines in the player's
 * language, and, when that is not English, a note that the English page is
 * the one that counts.
 */

import { h } from './dom.js';
import { t, tx, lang, fillPage } from './lang.js';

fillPage();

// Two paragraphs name a control in bold, so they are built from one line each.
document.getElementById('relay-note')?.replaceChildren(
  ...tx('privacy.friends', { relay: h('strong', {}, t('privacy.relay_only')) })
);
document.getElementById('delete-note')?.replaceChildren(
  ...tx('privacy.delete', { delete: h('strong', {}, t('privacy.delete_data')) })
);

const note = document.getElementById('translated');
if (note && lang !== 'en') {
  note.replaceChildren(...tx('privacy.translated', { link: h('a', { href: '?lang=en' }, t('privacy.translated_link')) }));
  note.hidden = false;
}
