/**
 * catalogue/summary.js — the strip of figures under the masthead, read off
 * whatever is selected: how many records, how much they weigh, how many are
 * originals, which models made them, the newest arrival, and how many have
 * more than one build.
 *
 * Numbers, not charts, because each is one value. The one ratio, original
 * against inspired, is a meter whose halves are buttons that filter to it.
 */

import { h } from '../dom.js';
import { plural } from '../format.js';
import { dayText, sizeText } from './query.js';

const tile = (label, ...content) => h('div', { class: 'tile' }, h('p', { class: 'tile__label' }, label), ...content);

export function createSummary(root, { onOrigin, onSelect, onQuery }) {
  return {
    render(s, { total, origin }) {
      const share = s.count ? s.originals / s.count : 0;
      const [size, unit] = sizeText(s.bytes).split(' ');
      root.replaceChildren(
        tile(
          'Records',
          h('p', { class: 'tile__value' }, String(s.count), h('span', { class: 'tile__unit' }, ` of ${total}`)),
          h(
            'p',
            { class: 'tile__sub' },
            s.count === total ? 'The whole catalogue' : `${Math.round((s.count / total) * 100)}% of the catalogue`
          )
        ),
        tile(
          'Total size',
          h(
            'p',
            { class: 'tile__value' },
            s.bytes ? size : '0',
            h('span', { class: 'tile__unit' }, ` ${s.bytes ? unit : 'MB'}`)
          ),
          h('p', { class: 'tile__sub' }, s.count ? `Median ${sizeText(s.median)}` : 'Nothing selected')
        ),
        tile(
          'Original and inspired',
          h(
            'div',
            { class: 'split', style: { '--share': share } },
            h(
              'button',
              {
                type: 'button',
                class: 'split__part split__part--original',
                'aria-pressed': String(origin === 'original'),
                'aria-label': `${s.originals} original. Filter to originals`,
                onclick: () => onOrigin('original'),
              },
              h('span', { class: 'split__bar', 'aria-hidden': 'true' })
            ),
            h(
              'button',
              {
                type: 'button',
                class: 'split__part split__part--inspired',
                'aria-pressed': String(origin === 'inspired'),
                'aria-label': `${s.inspired} inspired. Filter to inspired`,
                onclick: () => onOrigin('inspired'),
              },
              h('span', { class: 'split__bar', 'aria-hidden': 'true' })
            )
          ),
          h(
            'p',
            { class: 'tile__sub split__legend' },
            h(
              'span',
              {},
              h('i', { class: 'split__key split__key--original', 'aria-hidden': 'true' }),
              h('b', {}, String(s.originals)),
              ' original'
            ),
            h(
              'span',
              {},
              h('i', { class: 'split__key split__key--inspired', 'aria-hidden': 'true' }),
              h('b', {}, String(s.inspired)),
              ' inspired'
            )
          )
        ),
        tile(
          'Models named',
          h('p', { class: 'tile__value' }, String(s.models.length)),
          h(
            'p',
            { class: 'tile__sub' },
            s.modelRecords
              ? h(
                  'button',
                  { type: 'button', class: 'xref', onclick: () => onQuery('has:model') },
                  `on ${plural(s.modelRecords, 'record')}`
                )
              : 'None named'
          )
        ),
        tile(
          'Newest addition',
          h('p', { class: 'tile__value tile__value--date' }, s.newest?.addedAt ? dayText(s.newest.addedAt) : '—'),
          h(
            'p',
            { class: 'tile__sub' },
            s.newest
              ? h('button', { type: 'button', class: 'xref', onclick: () => onSelect(s.newest.slug) }, s.newest.name)
              : 'Nothing selected'
          )
        ),
        tile(
          'Several builds',
          h('p', { class: 'tile__value' }, String(s.several)),
          h(
            'p',
            { class: 'tile__sub' },
            s.several
              ? h('button', { type: 'button', class: 'xref', onclick: () => onQuery('builds:>1') }, 'Show them')
              : 'All single builds'
          )
        )
      );
    },
  };
}
