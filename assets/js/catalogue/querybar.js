/**
 * catalogue/querybar.js — the query bar: the text, the chips read off it,
 * suggestions as you type, and the syntax by example.
 *
 * The text is the one source of truth, so this module never keeps a query of
 * its own. It reports what was typed, and draws whatever text it is given;
 * the chips, the facets and the charts all edit the same text through the
 * page, which hands it back here.
 */

import { h, icon, ICONS } from '../dom.js';
import { EXAMPLES, FIELDS } from './query.js';
import { accept, suggest } from './suggest.js';

/** A chip's words. A value that cannot mean anything shows as typed, underlined; its title says why. */
const chipText = (term) => (term.problem ? term.value : `${term.negate ? 'not ' : ''}${term.says}`);

export function createQueryBar(root, { vocabulary, onInput, onLeave }) {
  let suggestions = null;
  let active = -1;

  const input = h('input', {
    class: 'query__input',
    id: 'query-input',
    type: 'text',
    role: 'combobox',
    'aria-label': 'Query the catalogue',
    'aria-autocomplete': 'list',
    'aria-expanded': 'false',
    'aria-controls': 'query-suggest',
    'aria-describedby': 'query-terms',
    autocomplete: 'off',
    autocapitalize: 'off',
    spellcheck: 'false',
    enterkeyhint: 'search',
    placeholder: matchMedia('(max-width: 560px)').matches
      ? 'Query: genre:racing size:<1mb'
      : 'Query the catalogue: try genre:racing or size:<500kb',
  });
  const list = h('ul', {
    class: 'query__suggest',
    id: 'query-suggest',
    role: 'listbox',
    'aria-label': 'Suggestions',
    hidden: true,
  });
  const helpButton = h(
    'button',
    {
      type: 'button',
      class: 'query__help-toggle',
      'aria-expanded': 'false',
      'aria-controls': 'query-help',
      title: 'Query syntax',
    },
    h('span', { class: 'visually-hidden' }, 'Query syntax'),
    h('span', { 'aria-hidden': 'true' }, '?')
  );
  const help = h(
    'div',
    { class: 'query__help', id: 'query-help', role: 'dialog', 'aria-label': 'Query syntax', hidden: true },
    h(
      'p',
      { class: 'query__help-lede' },
      'Words search everything. A field narrows: ',
      h('code', {}, 'field:value'),
      '. Click any example to add it.'
    ),
    h(
      'div',
      { class: 'query__help-grid' },
      EXAMPLES.map(({ title, items }) =>
        h(
          'section',
          { class: 'query__help-group' },
          h('h3', { class: 'label' }, title),
          h(
            'ul',
            {},
            items.map(([example, meaning]) =>
              h(
                'li',
                {},
                h(
                  'button',
                  { type: 'button', class: 'example', dataset: { example } },
                  h('code', {}, example),
                  h('span', {}, meaning)
                )
              )
            )
          )
        )
      )
    ),
    h(
      'p',
      { class: 'query__help-foot' },
      'Fields: ',
      Object.keys(FIELDS).map((field, i) => [i ? ', ' : '', h('code', {}, `${field}:`)]),
      '. Facet bars and chart columns write terms here too.'
    )
  );
  // Not a live region: it is redrawn on every keystroke. The page announces the count instead.
  const chips = h('div', { class: 'query__chips', id: 'query-terms' });

  root.append(
    h(
      'div',
      { class: 'query__field' },
      icon(ICONS.search, { class: 'query__icon' }),
      input,
      h('kbd', { class: 'query__key', title: 'Press / to query' }, '/'),
      helpButton,
      list,
      help
    ),
    chips
  );

  /* --- suggestions --------------------------------------------------------- */

  function closeList() {
    suggestions = null;
    active = -1;
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }

  function paintActive() {
    [...list.children].forEach((li, i) => li.setAttribute('aria-selected', String(i === active)));
    if (active >= 0) input.setAttribute('aria-activedescendant', `query-option-${active}`);
    else input.removeAttribute('aria-activedescendant');
  }

  function refreshList() {
    if (document.activeElement !== input) return closeList();
    suggestions = suggest(input.value, input.selectionStart ?? input.value.length, vocabulary);
    if (!suggestions) return closeList();
    active = -1;
    list.replaceChildren(
      ...suggestions.items.map((item, i) =>
        h(
          'li',
          {
            id: `query-option-${i}`,
            role: 'option',
            class: 'query__option',
            'aria-selected': 'false',
            dataset: { index: i },
          },
          h('code', { class: 'query__option-text' }, item.label),
          h('span', { class: 'query__option-hint' }, item.hint)
        )
      )
    );
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  function take(index) {
    if (!suggestions?.items[index]) return;
    const { text, caret } = accept(input.value, suggestions, suggestions.items[index]);
    input.value = text;
    input.setSelectionRange(caret, caret);
    onInput(text);
    refreshList();
  }

  list.addEventListener('mousedown', (event) => event.preventDefault());
  list.addEventListener('click', (event) => {
    const option = event.target.closest('[data-index]');
    if (option) take(Number(option.dataset.index));
  });

  input.addEventListener('input', () => {
    onInput(input.value);
    refreshList();
  });
  input.addEventListener('click', refreshList);
  input.addEventListener('focus', refreshList);
  input.addEventListener('blur', () => setTimeout(closeList, 0));
  input.addEventListener('keyup', (event) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'Home' || event.key === 'End')
      refreshList();
  });

  input.addEventListener('keydown', (event) => {
    const open = Boolean(suggestions);
    if (event.key === 'ArrowDown' && open) {
      event.preventDefault();
      active = (active + 1) % suggestions.items.length;
      paintActive();
    } else if (event.key === 'ArrowUp' && open) {
      event.preventDefault();
      active = active <= 0 ? suggestions.items.length - 1 : active - 1;
      paintActive();
    } else if ((event.key === 'Enter' || event.key === 'Tab') && open && active >= 0) {
      event.preventDefault();
      take(active);
    } else if (event.key === 'Escape' && open) {
      // The list closes first; a second Escape leaves the bar.
      event.preventDefault();
      event.stopPropagation();
      closeList();
    } else if (event.key === 'ArrowDown' || event.key === 'Enter') {
      event.preventDefault();
      closeList();
      onLeave();
    }
  });

  /* --- the syntax by example ---------------------------------------------- */

  function setHelp(open, { focus = true } = {}) {
    help.hidden = !open;
    helpButton.setAttribute('aria-expanded', String(open));
    if (open && focus) help.querySelector('.example')?.focus();
  }

  helpButton.addEventListener('click', () => setHelp(help.hidden));
  help.addEventListener('click', (event) => {
    const example = event.target.closest('[data-example]');
    if (!example) return;
    const text = input.value.trim()
      ? `${input.value.replace(/\s+$/, '')} ${example.dataset.example}`
      : example.dataset.example;
    input.value = text;
    onInput(text);
  });
  help.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setHelp(false);
      helpButton.focus();
    }
  });
  document.addEventListener('pointerdown', (event) => {
    if (!help.hidden && !help.contains(event.target) && !helpButton.contains(event.target))
      setHelp(false, { focus: false });
  });

  /* --- chips ----------------------------------------------------------------- */

  function renderChips(parsed, { onRemove, onClear }) {
    const shown = parsed.terms.filter((term) => !term.incomplete);
    if (!shown.length) {
      chips.replaceChildren(
        h(
          'p',
          { class: 'query__empty' },
          'No filter yet. Type a query, or click any bar in the facets or figures to start one.'
        )
      );
      return;
    }
    // replaceChildren would print a stray false as text, so the list is filtered.
    const nodes = [
      ...shown.map((term) => {
        const field = term.field ? FIELDS[term.field].label : 'Text';
        const words = chipText(term) + (term.problem ? `, which ${term.problem}` : '');
        return h(
          'span',
          {
            class: `chip${term.negate ? ' is-not' : ''}${term.problem ? ' is-problem' : ''}`,
            title: term.problem ? `${field} ${term.problem}` : term.raw,
          },
          h(
            'button',
            {
              type: 'button',
              class: 'chip__edit',
              'aria-label': `Edit ${field} ${words}`,
              onclick: () => {
                input.focus();
                input.setSelectionRange(term.start, term.end);
              },
            },
            h('span', { class: 'chip__field' }, field),
            h('span', { class: 'chip__value' }, chipText(term))
          ),
          h(
            'button',
            {
              type: 'button',
              class: 'chip__remove',
              'aria-label': `Remove ${field} ${words}`,
              onclick: () => onRemove(term),
            },
            icon(ICONS.close)
          )
        );
      }),
      shown.length > 1 && h('button', { type: 'button', class: 'query__clear', onclick: onClear }, 'Clear all'),
    ];
    chips.replaceChildren(...nodes.filter(Boolean));
  }

  return {
    /** Draw the text and its chips. The caret is left alone while you type. */
    render(parsed, handlers) {
      if (input.value !== parsed.text) input.value = parsed.text;
      renderChips(parsed, handlers);
    },
    focus() {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    },
    blur: () => input.blur(),
    isFocused: () => document.activeElement === input,
    helpOpen: () => !help.hidden,
    toggleHelp: () => setHelp(help.hidden),
    closeHelp: () => setHelp(false, { focus: false }),
  };
}
