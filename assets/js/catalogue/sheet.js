/**
 * catalogue/sheet.js — the spec sheet: one record, set like an entry in a
 * museum catalogue. A band in the game's own colours, the plate and its
 * stills, the name, then the record itself: every fact in two columns, the
 * other attempts at the same game, what else is like it, and its builds.
 *
 * Values that name something the query can ask about (genre, model, source,
 * series, tags) are buttons that write that term, so the sheet is also a way
 * to search. With no record open, the sheet is the catalogue's colophon:
 * what it holds and how to read it.
 */

import { h, icon, ICONS } from '../dom.js';
import { cabinetPalette, paletteVars } from '../color.js';
import { attemptsAt, similarGames } from '../similar.js';
import { number, t, tx, withLanguage } from '../lang.js';
import { buildsOf, dayText, dayToken, sizeText, valuesOf } from './query.js';
import { keycaps } from './keycaps.js';
import { byName } from './order.js';
import { playersText } from './ledger.js';
import { thumbs as rateButtons } from '../account/thumbs.js';
import { sessionOf } from '../manifest.js';
import { friendsLink } from '../ui/friends.js';

const GLYPHS = {
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  link: 'M9.5 14.5l5-5M8 11l-2.2 2.2a3.2 3.2 0 0 0 4.5 4.5L12.5 15.5M16 13l2.2-2.2a3.2 3.2 0 0 0-4.5-4.5L11.5 8.5',
  compare: 'M4 5h6v14H4zM14 5h6v14h-6z',
};

/** The record's controls with every key set as a keycap. */
function controlsLine(controls) {
  const runs = keycaps(controls);
  if (!runs.length) return null;
  return h(
    'span',
    { class: 'controls' },
    runs.map((run) => (run.key ? h('kbd', {}, run.key) : run.text))
  );
}

export function createSheet(
  root,
  { library, accession, termFor, isFave, isMarked, onPlay, onFave, onMark, onSelect, onQuery, onCopy, onBack, onStart }
) {
  let game = null;
  const body = h('div', { class: 'sheet__body' });
  const barName = h('span', { class: 'sheet__bar-name' });
  const bar = h(
    'div',
    { class: 'sheet__bar' },
    h('button', { type: 'button', class: 'sheet__back', onclick: () => onBack() }, icon(ICONS.back), t('catalogue.sheet.back')),
    barName
  );
  root.append(bar, body);

  /** A value that searches for itself. */
  const query = (field, value) =>
    h(
      'button',
      {
        type: 'button',
        class: 'xref',
        title: t('catalogue.sheet.add_term', { term: `${field}:${value.toLowerCase()}` }),
        onclick: () => onQuery(termFor(field, value)),
      },
      value
    );

  const fact = (label, value) =>
    value ? h('div', { class: 'facts__row' }, h('dt', {}, label), h('dd', {}, value)) : null;

  /** A toggle's state, and its words when they change with it. */
  const pressed = (button, on, [onText, offText] = []) => {
    button.setAttribute('aria-pressed', String(on));
    if (onText) button.querySelector('.btn__text').textContent = on ? onText : offText;
  };

  function plate(entry) {
    const frames = (entry.frames?.length ? entry.frames : [entry.cover]).filter(Boolean);
    let pinned = 0;
    const big = h('img', {
      class: 'record__cover',
      src: frames[0],
      alt: t('catalogue.sheet.still_alt', { name: entry.name, n: 1, total: frames.length }),
      width: 640,
      height: 480,
      decoding: 'async',
    });
    const show = (i) => {
      big.src = frames[i];
      big.alt = t('catalogue.sheet.still_alt', { name: entry.name, n: i + 1, total: frames.length });
    };
    const thumbs = frames.map((src, i) =>
      h(
        'button',
        {
          type: 'button',
          class: 'record__frame',
          'aria-pressed': String(i === 0),
          'aria-label': t('catalogue.sheet.still_show', { n: i + 1, total: frames.length }),
          onpointerenter: () => show(i),
          onfocus: () => show(i),
          onclick: () => {
            pinned = i;
            thumbs.forEach((thumb, j) => thumb.setAttribute('aria-pressed', String(j === i)));
            show(i);
          },
        },
        h('img', { src, alt: '', loading: 'lazy', decoding: 'async', width: 640, height: 480 })
      )
    );
    return h(
      'figure',
      { class: 'record__plate' },
      h('div', { class: 'record__mat' }, big),
      frames.length > 1 &&
        h(
          'div',
          { class: 'record__frames', role: 'group', 'aria-label': t('catalogue.sheet.stills'), onpointerleave: () => show(pinned) },
          thumbs
        )
    );
  }

  function lineage(entry) {
    const all = [entry, ...attemptsAt(entry, library)].sort((a, b) => a.addedAt - b.addedAt || byName(a, b));
    const at = all.indexOf(entry) + 1;
    const title = h('cite', {}, entry.lineage.title);
    if (all.length === 1) {
      return h(
        'p',
        { class: 'record__note' },
        entry.lineage.original
          ? tx('catalogue.sheet.original_note', { title })
          : tx('catalogue.sheet.only_attempt', { title })
      );
    }
    return [
      h(
        'p',
        { class: 'record__note' },
        tx('catalogue.sheet.attempts', {
          position: h('b', {}, t('catalogue.sheet.position', { at, total: all.length })),
          title,
        })
      ),
      h(
        'table',
        { class: 'mini' },
        h(
          'thead',
          {},
          h(
            'tr',
            {},
            h('th', { scope: 'col' }, t('catalogue.sheet.col_name')),
            h('th', { scope: 'col' }, t('catalogue.sheet.col_model')),
            h('th', { scope: 'col', class: 'num' }, t('catalogue.sheet.col_added')),
            h('th', { scope: 'col', class: 'num' }, t('catalogue.sheet.col_size'))
          )
        ),
        h(
          'tbody',
          {},
          all.map((other) =>
            h(
              'tr',
              { class: other === entry ? 'is-here' : '', 'aria-current': other === entry ? 'true' : null },
              h(
                'th',
                { scope: 'row' },
                other === entry
                  ? h('span', { class: 'mini__here' }, other.name)
                  : h(
                      'button',
                      { type: 'button', class: 'mini__link', onclick: () => onSelect(other.slug) },
                      other.name
                    )
              ),
              h('td', {}, valuesOf(other.model).join(', ') || '—'),
              h('td', { class: 'num' }, other.addedAt ? dayText(other.addedAt) : '—'),
              h('td', { class: 'num' }, sizeText(other.bytes))
            )
          )
        )
      ),
    ];
  }

  function similar(entry) {
    const list = similarGames(entry, library, { limit: 6 });
    if (!list.length) return h('p', { class: 'record__note' }, t('catalogue.sheet.nothing_similar'));
    return h(
      'ol',
      { class: 'likeness' },
      list.map((other) =>
        h(
          'li',
          {},
          h(
            'button',
            {
              type: 'button',
              class: 'likeness__item',
              style: { '--swatch': cabinetPalette(other).light },
              onclick: () => onSelect(other.slug),
            },
            h('img', { src: other.cover, alt: '', loading: 'lazy', decoding: 'async', width: 640, height: 480 }),
            h('span', { class: 'likeness__name' }, other.name),
            h(
              'span',
              { class: 'likeness__meta' },
              [valuesOf(other.genre).join(', '), sizeText(other.bytes)].filter(Boolean).join(' · ')
            )
          )
        )
      )
    );
  }

  function builds(entry) {
    if (entry.builds.length < 2) return null;
    return h(
      'ol',
      { class: 'builds' },
      entry.builds.map((build, i) =>
        h(
          'li',
          { class: 'builds__item' },
          h(
            'span',
            { class: 'builds__label' },
            build.version
              ? `v${build.version}`
              : i
                ? t('catalogue.sheet.build_n', { n: entry.builds.length - i })
                : t('catalogue.sheet.build_current')
          ),
          h('span', { class: 'builds__date num' }, build.added ? dayText(Date.parse(build.added)) : ''),
          h('span', { class: 'builds__size num' }, sizeText(build.bytes)),
          h('button', { type: 'button', class: 'builds__play', onclick: () => onPlay(entry.slug, build) }, t('catalogue.sheet.play'))
        )
      )
    );
  }

  function section(title, ...content) {
    return h('section', { class: 'record__section' }, h('h3', { class: 'record__head label' }, title), ...content);
  }

  function record(entry) {
    const palette = cabinetPalette(entry);
    const build = entry.builds[0] || { path: entry.path };
    const faveButton = h(
      'button',
      { type: 'button', class: 'btn btn--fave', onclick: () => onFave(entry.slug) },
      icon(ICONS.star),
      h('span', { class: 'btn__text' }, t('catalogue.sheet.favourite'))
    );
    const markButton = h(
      'button',
      { type: 'button', class: 'btn btn--mark', onclick: () => onMark(entry.slug) },
      icon(GLYPHS.compare),
      h('span', { class: 'btn__text' })
    );
    pressed(faveButton, isFave(entry.slug));
    pressed(markButton, isMarked(entry.slug), [t('catalogue.sheet.marked'), t('catalogue.sheet.compare')]);

    const genre = valuesOf(entry.genre);
    const models = valuesOf(entry.model);
    const tags = valuesOf(entry.tags);
    const colours = [palette.light, palette.glow, palette.ink, palette.deep];

    return h(
      'article',
      { class: 'record', style: paletteVars(palette), 'aria-labelledby': 'record-name' },
      h('div', { class: 'record__band', 'aria-hidden': 'true' }),
      h(
        'header',
        { class: 'record__top' },
        h(
          'p',
          { class: 'record__eyebrow' },
          h('span', { class: 'label' }, t('catalogue.sheet.record')),
          h('span', { class: 'record__no' }, t('catalogue.sheet.number', { number: String(accession.get(entry.slug) ?? '').padStart(4, '0') })),
          h('span', { class: 'record__kind' }, [entry.type || t('catalogue.sheet.game'), ...genre].join(' · '))
        ),
        plate(entry),
        h('h2', { class: 'record__name', id: 'record-name' }, entry.name),
        entry.tagline && h('p', { class: 'record__tagline' }, entry.tagline),
        h(
          'div',
          { class: 'record__actions' },
          h(
            'button',
            { type: 'button', class: 'btn btn--play', onclick: () => onPlay(entry.slug) },
            icon(ICONS.play, { fill: 'currentColor', stroke: 'none' }),
            h('span', { class: 'btn__text' }, t('catalogue.sheet.play')),
            h('kbd', { class: 'btn__key' }, 'Enter')
          ),
          friendsLink(entry, { className: 'record__friends' }),
          faveButton,
          markButton,
          rateButtons(entry.slug, { className: 'record__thumbs' })
        ),
        h(
          'p',
          { class: 'record__links' },
          h(
            'a',
            { class: 'quiet-link', href: withLanguage(build.path), target: '_blank', rel: 'noopener' },
            icon(GLYPHS.external),
            t('catalogue.sheet.open_own')
          ),
          h(
            'button',
            { type: 'button', class: 'quiet-link', onclick: () => onCopy(entry) },
            icon(GLYPHS.link),
            t('catalogue.sheet.copy_link')
          )
        )
      ),
      entry.description &&
        h('section', { class: 'record__section' }, h('p', { class: 'record__desc' }, entry.description)),
      section(
        t('catalogue.sheet.record'),
        h(
          'dl',
          { class: 'facts' },
          fact(t('catalogue.sheet.fact_slug'), h('code', {}, entry.slug)),
          fact(t('catalogue.sheet.fact_type'), entry.type || t('catalogue.sheet.game')),
          fact(t('catalogue.sheet.fact_genre'), genre.length && genre.map((value) => query('genre', value))),
          fact(t('catalogue.sheet.fact_origin'), entry.lineage.original ? t('catalogue.sheet.original') : t('catalogue.sheet.inspired')),
          fact(t('catalogue.sheet.fact_source'), entry.source && query('source', entry.source)),
          fact(
            t('catalogue.sheet.fact_series'),
            !entry.lineage.original && entry.lineage.series !== entry.source && query('series', entry.lineage.series)
          ),
          fact(
            t('catalogue.sheet.fact_model'),
            models.length ? models.map((value) => query('model', value)) : h('span', { class: 'nil' }, t('catalogue.sheet.not_named'))
          ),
          fact(t('catalogue.sheet.fact_players'), playersText(entry)),
          fact(t('catalogue.sheet.fact_session'), sessionOf(entry)?.label),
          fact(t('catalogue.sheet.fact_controls'), entry.controls && controlsLine(entry.controls)),
          fact(
            t('catalogue.sheet.fact_tags'),
            tags.length &&
              h(
                'span',
                { class: 'tags' },
                tags.map((tag) =>
                  h(
                    'button',
                    {
                      type: 'button',
                      class: 'tag',
                      title: t('catalogue.sheet.add_term', { term: `tag:${tag}` }),
                      onclick: () => onQuery(termFor('tag', tag)),
                    },
                    tag
                  )
                )
              )
          ),
          fact(
            t('catalogue.sheet.fact_size'),
            h(
              'span',
              {},
              h('span', { class: 'num' }, sizeText(entry.bytes)),
              h('span', { class: 'facts__aside num' }, ` ${t('catalogue.sheet.bytes', { count: entry.bytes })}`)
            )
          ),
          fact(t('catalogue.sheet.fact_added'), entry.addedAt && h('time', { datetime: dayToken(entry.addedAt) }, dayText(entry.addedAt))),
          fact(
            t('catalogue.sheet.fact_updated'),
            entry.updatedAt && h('time', { datetime: dayToken(entry.updatedAt) }, dayText(entry.updatedAt))
          ),
          fact(t('catalogue.sheet.fact_builds'), number(buildsOf(entry))),
          fact(t('catalogue.sheet.fact_path'), h('code', {}, build.path)),
          fact(
            t('catalogue.sheet.fact_colour'),
            h(
              'span',
              { class: 'proof' },
              colours.map((colour) => h('span', { class: 'proof__chip', style: { '--chip': colour }, title: colour })),
              h('code', {}, entry.themeColor || colours[0])
            )
          )
        )
      ),
      section(t('catalogue.sheet.lineage'), lineage(entry)),
      section(t('catalogue.sheet.similar'), similar(entry)),
      entry.builds.length > 1 && section(t('catalogue.sheet.builds'), builds(entry))
    );
  }

  return {
    show(next) {
      game = next;
      barName.textContent = next.name;
      body.replaceChildren(record(next));
      root.scrollTop = 0;
    },

    /** The front matter, for when no record is open. */
    colophon({ total, compiled, bytes }) {
      game = null;
      barName.textContent = '';
      const keys = [
        [['↑', '↓'], t('catalogue.sheet.keys_or'), ['J', 'K'], t('catalogue.sheet.key_move')],
        [['Enter'], '', [], t('catalogue.sheet.key_play')],
        [['Space'], '', [], t('catalogue.sheet.key_mark')],
        [['F'], '', [], t('catalogue.sheet.key_fave')],
        [['O'], '', [], t('catalogue.sheet.key_open')],
        [['/'], '', [], t('catalogue.sheet.key_query')],
        [['?'], '', [], t('catalogue.sheet.key_syntax')],
        [['G', 'G'], t('catalogue.sheet.keys_and'), ['⇧', 'G'], t('catalogue.sheet.key_ends')],
        [['Esc'], '', [], t('catalogue.sheet.key_leave')],
      ];
      body.replaceChildren(
        h(
          'article',
          { class: 'colophon' },
          h('p', { class: 'label' }, t('catalogue.sheet.colophon_label')),
          h('h2', { class: 'colophon__title' }, t('catalogue.sheet.colophon_title')),
          h(
            'p',
            { class: 'colophon__lede' },
            t('catalogue.sheet.colophon_lede', { count: total, size: sizeText(bytes), date: dayText(compiled) })
          ),
          h(
            'button',
            { type: 'button', class: 'btn btn--play colophon__start', onclick: onStart },
            h('span', { class: 'btn__text' }, t('catalogue.sheet.start')),
            h('kbd', { class: 'btn__key' }, 'J')
          ),
          h('h3', { class: 'record__head label' }, t('catalogue.sheet.reading')),
          h(
            'dl',
            { class: 'keys' },
            keys.map(([a, joiner, b, meaning]) =>
              h(
                'div',
                { class: 'keys__row' },
                h(
                  'dt',
                  {},
                  a.map((k) => h('kbd', {}, k)),
                  joiner && h('span', { class: 'keys__or' }, ` ${joiner} `),
                  b.map((k) => h('kbd', {}, k))
                ),
                h('dd', {}, meaning)
              )
            )
          ),
          h(
            'p',
            { class: 'colophon__note' },
            t('catalogue.sheet.colophon_note')
          )
        )
      );
    },

    /** Refresh what can change without the record changing: favourite and mark. */
    refresh() {
      if (!game) return;
      const fave = body.querySelector('.btn--fave');
      const mark = body.querySelector('.btn--mark');
      if (fave) pressed(fave, isFave(game.slug));
      if (mark) pressed(mark, isMarked(game.slug), [t('catalogue.sheet.marked'), t('catalogue.sheet.compare')]);
    },

    current: () => game,
    focusPlay: () => body.querySelector('.btn--play')?.focus(),
  };
}
