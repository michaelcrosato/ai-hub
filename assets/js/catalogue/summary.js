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
import { lang, number, t, tx } from '../lang.js';
import { dayText, sizeText } from './query.js';

/** A size as its number and its unit, apart, in the language's own words: ["3.2", "GB"]. */
const UNITS = [[1024 ** 3, 'gigabyte'], [1024 ** 2, 'megabyte'], [1024, 'kilobyte'], [1, 'byte']];
function sizeParts(n) {
  const [scale, unit] = UNITS.find(([s]) => n >= s) || UNITS[UNITS.length - 1];
  const parts = new Intl.NumberFormat(lang, { style: 'unit', unit, unitDisplay: 'short', maximumSignificantDigits: 3 }).formatToParts(n / scale);
  const join = (keep) => parts.filter((p) => keep(p.type)).map((p) => p.value).join('').trim();
  return [join((type) => type !== 'unit' && type !== 'literal'), join((type) => type === 'unit')];
}

const tile = (label, ...content) => h('div', { class: 'tile' }, h('p', { class: 'tile__label' }, label), ...content);

export function createSummary(root, { onOrigin, onSelect, onQuery }) {
  return {
    render(s, { total, origin }) {
      const share = s.count ? s.originals / s.count : 0;
      const [size, unit] = sizeParts(s.bytes);
      root.replaceChildren(
        tile(
          t('catalogue.summary.records'),
          h('p', { class: 'tile__value' }, number(s.count), h('span', { class: 'tile__unit' }, ` ${t('catalogue.summary.of_total', { total })}`)),
          h(
            'p',
            { class: 'tile__sub' },
            s.count === total
              ? t('catalogue.summary.whole')
              : t('catalogue.summary.share', { percent: Math.round((s.count / total) * 100) })
          )
        ),
        tile(
          t('catalogue.summary.total_size'),
          h(
            'p',
            { class: 'tile__value' },
            s.bytes ? size : '0',
            h('span', { class: 'tile__unit' }, ` ${s.bytes ? unit : t('catalogue.summary.zero_unit')}`)
          ),
          h('p', { class: 'tile__sub' }, s.count ? t('catalogue.summary.median', { size: sizeText(s.median) }) : t('catalogue.summary.nothing'))
        ),
        tile(
          t('catalogue.summary.origin'),
          h(
            'div',
            { class: 'split', style: { '--share': share } },
            h(
              'button',
              {
                type: 'button',
                class: 'split__part split__part--original',
                'aria-pressed': String(origin === 'original'),
                'aria-label': t('catalogue.summary.filter_originals', { count: s.originals }),
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
                'aria-label': t('catalogue.summary.filter_inspired', { count: s.inspired }),
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
              tx('catalogue.summary.legend_original', { count: h('b', {}, number(s.originals)) })
            ),
            h(
              'span',
              {},
              h('i', { class: 'split__key split__key--inspired', 'aria-hidden': 'true' }),
              tx('catalogue.summary.legend_inspired', { count: h('b', {}, number(s.inspired)) })
            )
          )
        ),
        tile(
          t('catalogue.summary.models'),
          h('p', { class: 'tile__value' }, number(s.models.length)),
          h(
            'p',
            { class: 'tile__sub' },
            s.modelRecords
              ? h(
                  'button',
                  { type: 'button', class: 'xref', onclick: () => onQuery('has:model') },
                  t('catalogue.summary.on_records', { count: s.modelRecords })
                )
              : t('catalogue.summary.none_named')
          )
        ),
        tile(
          t('catalogue.summary.newest'),
          h('p', { class: 'tile__value tile__value--date' }, s.newest?.addedAt ? dayText(s.newest.addedAt) : '—'),
          h(
            'p',
            { class: 'tile__sub' },
            s.newest
              ? h('button', { type: 'button', class: 'xref', onclick: () => onSelect(s.newest.slug) }, s.newest.name)
              : t('catalogue.summary.nothing')
          )
        ),
        tile(
          t('catalogue.summary.several'),
          h('p', { class: 'tile__value' }, number(s.several)),
          h(
            'p',
            { class: 'tile__sub' },
            s.several
              ? h('button', { type: 'button', class: 'xref', onclick: () => onQuery('builds:>1') }, t('catalogue.summary.show_them'))
              : t('catalogue.summary.all_single')
          )
        )
      );
    },
  };
}
