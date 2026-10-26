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
import { plural } from '../format.js';
import { buildsOf, dayText, dayToken, sizeText, valuesOf } from './query.js';
import { keycaps } from './keycaps.js';
import { byName } from './order.js';
import { playersText } from './ledger.js';
import { sessionOf } from '../manifest.js';

const GLYPHS = {
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  link: 'M9.5 14.5l5-5M8 11l-2.2 2.2a3.2 3.2 0 0 0 4.5 4.5L12.5 15.5M16 13l2.2-2.2a3.2 3.2 0 0 0-4.5-4.5L11.5 8.5',
  compare: 'M4 5h6v14H4zM14 5h6v14h-6z',
};

const count = new Intl.NumberFormat('en-GB');

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
    h('button', { type: 'button', class: 'sheet__back', onclick: () => onBack() }, icon(ICONS.back), 'Records'),
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
        title: `Add ${field}:${value.toLowerCase()} to the query`,
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
      alt: `${entry.name}: still 1 of ${frames.length}`,
      width: 640,
      height: 480,
      decoding: 'async',
    });
    const show = (i) => {
      big.src = frames[i];
      big.alt = `${entry.name}: still ${i + 1} of ${frames.length}`;
    };
    const thumbs = frames.map((src, i) =>
      h(
        'button',
        {
          type: 'button',
          class: 'record__frame',
          'aria-pressed': String(i === 0),
          'aria-label': `Show still ${i + 1} of ${frames.length}`,
          onpointerenter: () => show(i),
          onfocus: () => show(i),
          onclick: () => {
            pinned = i;
            thumbs.forEach((t, j) => t.setAttribute('aria-pressed', String(j === i)));
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
          { class: 'record__frames', role: 'group', 'aria-label': 'Stills', onpointerleave: () => show(pinned) },
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
          ? ['An original. Nothing else in the catalogue is called ', title, '.']
          : ['The only attempt at ', title, ' in the catalogue.']
      );
    }
    return [
      h(
        'p',
        { class: 'record__note' },
        h('b', {}, `${at} of ${all.length}`),
        ' attempts at ',
        title,
        ', in the order they arrived.'
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
            h('th', { scope: 'col' }, 'Name'),
            h('th', { scope: 'col' }, 'Model'),
            h('th', { scope: 'col', class: 'num' }, 'Added'),
            h('th', { scope: 'col', class: 'num' }, 'Size')
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
    if (!list.length) return h('p', { class: 'record__note' }, 'Nothing else in the catalogue is much like it.');
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
            build.version ? `v${build.version}` : i ? `Build ${entry.builds.length - i}` : 'Current'
          ),
          h('span', { class: 'builds__date num' }, build.added ? dayText(Date.parse(build.added)) : ''),
          h('span', { class: 'builds__size num' }, sizeText(build.bytes)),
          h('button', { type: 'button', class: 'builds__play', onclick: () => onPlay(entry.slug, build) }, 'Play')
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
      h('span', { class: 'btn__text' }, 'Favourite')
    );
    const markButton = h(
      'button',
      { type: 'button', class: 'btn btn--mark', onclick: () => onMark(entry.slug) },
      icon(GLYPHS.compare),
      h('span', { class: 'btn__text' })
    );
    pressed(faveButton, isFave(entry.slug));
    pressed(markButton, isMarked(entry.slug), ['Marked', 'Compare']);

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
          h('span', { class: 'label' }, 'Record'),
          h('span', { class: 'record__no' }, `No. ${String(accession.get(entry.slug) ?? '').padStart(4, '0')}`),
          h('span', { class: 'record__kind' }, [entry.type || 'Game', ...genre].join(' · '))
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
            h('span', { class: 'btn__text' }, 'Play'),
            h('kbd', { class: 'btn__key' }, 'Enter')
          ),
          faveButton,
          markButton
        ),
        h(
          'p',
          { class: 'record__links' },
          h(
            'a',
            { class: 'quiet-link', href: build.path, target: '_blank', rel: 'noopener' },
            icon(GLYPHS.external),
            'Open on its own page'
          ),
          h(
            'button',
            { type: 'button', class: 'quiet-link', onclick: () => onCopy(entry) },
            icon(GLYPHS.link),
            'Copy link'
          )
        )
      ),
      entry.description &&
        h('section', { class: 'record__section' }, h('p', { class: 'record__desc' }, entry.description)),
      section(
        'Record',
        h(
          'dl',
          { class: 'facts' },
          fact('Slug', h('code', {}, entry.slug)),
          fact('Type', entry.type || 'Game'),
          fact('Genre', genre.length && genre.map((value) => query('genre', value))),
          fact('Origin', entry.lineage.original ? 'Original' : 'Inspired'),
          fact('Source', entry.source && query('source', entry.source)),
          fact(
            'Series',
            !entry.lineage.original && entry.lineage.series !== entry.source && query('series', entry.lineage.series)
          ),
          fact(
            'Model',
            models.length ? models.map((value) => query('model', value)) : h('span', { class: 'nil' }, 'Not named')
          ),
          fact('Players', playersText(entry)),
          fact('Hub session', sessionOf(entry)?.label),
          fact('Controls', entry.controls && controlsLine(entry.controls)),
          fact(
            'Tags',
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
                      title: `Add tag:${tag} to the query`,
                      onclick: () => onQuery(termFor('tag', tag)),
                    },
                    tag
                  )
                )
              )
          ),
          fact(
            'Size',
            h(
              'span',
              {},
              h('span', { class: 'num' }, sizeText(entry.bytes)),
              h('span', { class: 'facts__aside num' }, ` ${count.format(entry.bytes)} bytes`)
            )
          ),
          fact('Added', entry.addedAt && h('time', { datetime: dayToken(entry.addedAt) }, dayText(entry.addedAt))),
          fact(
            'Updated',
            entry.updatedAt && h('time', { datetime: dayToken(entry.updatedAt) }, dayText(entry.updatedAt))
          ),
          fact('Builds', String(buildsOf(entry))),
          fact('Path', h('code', {}, build.path)),
          fact(
            'Colour',
            h(
              'span',
              { class: 'proof' },
              colours.map((colour) => h('span', { class: 'proof__chip', style: { '--chip': colour }, title: colour })),
              h('code', {}, entry.themeColor || colours[0])
            )
          )
        )
      ),
      section('Lineage', lineage(entry)),
      section('Similar', similar(entry)),
      entry.builds.length > 1 && section('Builds', builds(entry))
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
        [['↑', '↓'], 'or', ['J', 'K'], 'Move through the records'],
        [['Enter'], '', [], 'Play the record'],
        [['Space'], '', [], 'Mark it for compare'],
        [['F'], '', [], 'Favourite it'],
        [['O'], '', [], 'Open it on its own page'],
        [['/'], '', [], 'Write a query'],
        [['?'], '', [], 'The query syntax, by example'],
        [['G', 'G'], 'and', ['⇧', 'G'], 'The top and the bottom'],
        [['Esc'], '', [], 'Leave the query, or clear the marks'],
      ];
      body.replaceChildren(
        h(
          'article',
          { class: 'colophon' },
          h('p', { class: 'label' }, 'The catalogue'),
          h('h2', { class: 'colophon__title' }, 'Every game, as a record'),
          h(
            'p',
            { class: 'colophon__lede' },
            `${plural(total, 'record')} of games built by AI models, ${sizeText(bytes)} in all, ` +
              `compiled ${dayText(compiled)}. `,
            'Query them, chart them, compare them, and play any of them without leaving the page.'
          ),
          h(
            'button',
            { type: 'button', class: 'btn btn--play colophon__start', onclick: onStart },
            h('span', { class: 'btn__text' }, 'Start at the first record'),
            h('kbd', { class: 'btn__key' }, 'J')
          ),
          h('h3', { class: 'record__head label' }, 'Reading the desk'),
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
            'Every bar in the facets and every column in the figures writes a term into the query. ' +
              'Shift-click a bar to leave its value out.'
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
      if (mark) pressed(mark, isMarked(game.slug), ['Marked', 'Compare']);
    },

    current: () => game,
    focusPlay: () => body.querySelector('.btn--play')?.focus(),
  };
}
