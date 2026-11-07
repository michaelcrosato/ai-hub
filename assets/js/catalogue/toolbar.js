/**
 * catalogue/toolbar.js — the strip over the ledger: how the records are laid
 * out (figures, grouping, density, and on a phone the filters and the sort),
 * the marks waiting to be compared, and the ways out (CSV, Markdown).
 */

import { h, icon } from '../dom.js';
import { COLUMNS, GROUPS } from './order.js';
import { lang, t } from '../lang.js';

const GLYPHS = {
  figures: 'M4 20V10M9 20V4M14 20v-7M19 20v-11M3 20h18',
  filters: 'M4 6h16M7 12h10M10 18h4',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  caret: 'M6 9l6 6 6-6',
};

/** What a phone's sort menu offers: every column, both ways, said plainly. */
const SORT_OPTIONS = COLUMNS.flatMap((column) => {
  const words = {
    name: [t('catalogue.toolbar.sort_name_up'), t('catalogue.toolbar.sort_name_down')],
    added: [t('catalogue.toolbar.sort_added_up'), t('catalogue.toolbar.sort_added_down')],
    size: [t('catalogue.toolbar.sort_size_up'), t('catalogue.toolbar.sort_size_down')],
    builds: [t('catalogue.toolbar.sort_builds_up'), t('catalogue.toolbar.sort_builds_down')],
    players: [t('catalogue.toolbar.sort_players_up'), t('catalogue.toolbar.sort_players_down')],
  }[column.key] || [
    t('catalogue.toolbar.sort_other_up', { column: column.label }),
    t('catalogue.toolbar.sort_other_down', { column: column.label }),
  ];
  return [
    { value: column.key, label: words[0] },
    { value: `-${column.key}`, label: words[1] },
  ];
});

export function createToolbar(
  root,
  { onFigures, onGroup, onDensity, onSort, onFilters, onCompare, onClearMarks, onCSV, onMarkdown }
) {
  const figures = h(
    'button',
    {
      type: 'button',
      class: 'tool tool--toggle',
      'aria-pressed': 'true',
      'aria-controls': 'figures',
      onclick: () => onFigures(),
    },
    icon(GLYPHS.figures),
    h('span', { class: 'tool__text' }, t('catalogue.toolbar.figures'))
  );
  const filters = h(
    'button',
    { type: 'button', class: 'tool tool--filters', onclick: () => onFilters() },
    icon(GLYPHS.filters),
    h('span', {}, t('catalogue.toolbar.filters')),
    h('span', { class: 'tool__badge', hidden: true })
  );
  const group = h(
    'select',
    { class: 'tool__select', 'aria-label': t('catalogue.toolbar.group_label'), onchange: (event) => onGroup(event.target.value) },
    GROUPS.map((g) => h('option', { value: g.key }, g.key ? t('catalogue.toolbar.group_by', { group: g.label.toLocaleLowerCase(lang) }) : t('catalogue.toolbar.no_grouping')))
  );
  const sort = h(
    'select',
    { class: 'tool__select', 'aria-label': t('catalogue.toolbar.sort_label'), onchange: (event) => onSort(event.target.value) },
    SORT_OPTIONS.map((option) => h('option', { value: option.value }, option.label))
  );
  const density = ['compact', 'comfortable'].map((key) =>
    h(
      'button',
      {
        type: 'button',
        class: 'seg__option',
        'aria-pressed': 'false',
        dataset: { density: key },
        onclick: () => onDensity(key),
      },
      key === 'compact' ? t('catalogue.toolbar.compact') : t('catalogue.toolbar.comfortable')
    )
  );
  const marks = h('span', { class: 'toolbar__marks', hidden: true });
  const compare = h('button', {
    type: 'button',
    class: 'tool tool--primary',
    onclick: () => onCompare(),
    hidden: true,
  });

  const menu = h(
    'ul',
    { class: 'menu', role: 'menu', id: 'export-menu', hidden: true },
    h(
      'li',
      { role: 'none' },
      h('button', { type: 'button', role: 'menuitem', class: 'menu__item', onclick: () => run(onCSV) }, t('catalogue.toolbar.download_csv'))
    ),
    h(
      'li',
      { role: 'none' },
      h(
        'button',
        { type: 'button', role: 'menuitem', class: 'menu__item', onclick: () => run(onMarkdown) },
        t('catalogue.toolbar.copy_markdown')
      )
    )
  );
  const exportButton = h(
    'button',
    {
      type: 'button',
      class: 'tool',
      'aria-haspopup': 'menu',
      'aria-expanded': 'false',
      'aria-controls': 'export-menu',
    },
    icon(GLYPHS.download),
    h('span', { class: 'tool__text' }, t('catalogue.toolbar.export')),
    icon(GLYPHS.caret, { class: 'tool__caret' })
  );

  function setMenu(open, { focus = false } = {}) {
    menu.hidden = !open;
    exportButton.setAttribute('aria-expanded', String(open));
    if (open && focus) menu.querySelector('.menu__item').focus();
  }
  function run(action) {
    setMenu(false);
    exportButton.focus();
    action();
  }
  exportButton.addEventListener('click', () => setMenu(menu.hidden, { focus: true }));
  menu.addEventListener('keydown', (event) => {
    const items = [...menu.querySelectorAll('.menu__item')];
    const at = items.indexOf(document.activeElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      items[(at + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setMenu(false);
      exportButton.focus();
    } else if (event.key === 'Tab') {
      setMenu(false);
    }
  });
  document.addEventListener('pointerdown', (event) => {
    if (!menu.hidden && !menu.contains(event.target) && !exportButton.contains(event.target)) setMenu(false);
  });

  root.append(
    h(
      'div',
      { class: 'toolbar__start' },
      filters,
      figures,
      h('span', { class: 'tool tool--select tool--sort' }, sort),
      h('span', { class: 'tool tool--select tool--group' }, group),
      h('div', { class: 'seg', role: 'group', 'aria-label': t('catalogue.toolbar.density_label') }, density)
    ),
    h(
      'div',
      { class: 'toolbar__end' },
      marks,
      compare,
      h('div', { class: 'tool__menu' }, exportButton, menu),
      // On a phone the selects take a second row; this is where it breaks.
      h('span', { class: 'toolbar__break', 'aria-hidden': 'true' })
    )
  );

  return {
    render({ figuresOn, groupKey, densityKey, sortValue, markCount, filterCount }) {
      figures.setAttribute('aria-pressed', String(figuresOn));
      group.value = groupKey;
      sort.value = sortValue;
      for (const button of density) button.setAttribute('aria-pressed', String(button.dataset.density === densityKey));
      const badge = filters.querySelector('.tool__badge');
      badge.hidden = !filterCount;
      badge.textContent = String(filterCount);
      marks.hidden = !markCount;
      // From two marks on, the Compare button carries the count.
      marks.replaceChildren(
        ...(markCount
          ? [
              markCount === 1 && h('span', {}, t('catalogue.toolbar.one_marked')),
              h(
                'button',
                { type: 'button', class: 'toolbar__unmark', onclick: onClearMarks },
                markCount === 1 ? t('catalogue.toolbar.clear') : t('catalogue.toolbar.clear_marks')
              ),
            ].filter(Boolean)
          : [])
      );
      compare.hidden = markCount < 2;
      compare.textContent = t('catalogue.toolbar.compare', { count: markCount });
    },
  };
}
