// The Language menu loads the page again in the language chosen, so a key
// that only steps the closed list must never choose. A fake select drives
// onChoice() in the order browsers fire events: a closed list's change comes
// while the key that made it is handled (keydown, then keypress for a
// letter); a choice from the open list comes on its own.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { onChoice, stepsClosedList } from '../assets/js/ui/language.js';

const NO_MODS = { altKey: false, ctrlKey: false, metaKey: false };
const nextTask = () => new Promise((resolve) => setTimeout(resolve));

function menu({ open = true, picker = () => {}, listOpen = false } = {}) {
  const select = new EventTarget();
  select.value = 'fr';
  select.matches = (selector) => selector === ':open' && listOpen;
  const chosen = [];
  const shown = [];
  if (picker) select.showPicker = () => { shown.push(select.value); picker(); };
  onChoice(select, (code) => chosen.push(code), { current: 'fr', open });
  const change = (value) => {
    select.value = value;
    select.dispatchEvent(new Event('change'));
  };
  /** A key on the list; `to`: the option the browser steps to, firing change while the key is handled. */
  const press = (key, { to, ...mods } = {}) => {
    const fire = (type) => select.dispatchEvent(Object.assign(new Event(type), { key, ...NO_MODS, ...mods }));
    fire('keydown');
    if ([...key].length === 1) fire('keypress');
    if (to) change(to);
  };
  return { select, chosen, shown, press, pick: change };
}

test('a key that steps the closed list never chooses: the list opens instead', () => {
  for (const key of ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown', 'e', 'E', 'é', '中']) {
    const m = menu();
    m.press(key, { to: 'bn' });
    assert.deepEqual(m.chosen, [], key);
    assert.equal(m.select.value, 'fr', `${key}: the menu shows the page's language again`);
    assert.deepEqual(m.shown, ['fr'], `${key}: the list opens on the page's language`);
  }
  const shifted = menu();
  shifted.press('ArrowDown', { to: 'bn', shiftKey: true, ctrlKey: true });
  assert.deepEqual(shifted.chosen, []);
});

test('a choice from the open list is taken, also right after a stepping key', () => {
  const m = menu();
  m.pick('ru');
  assert.deepEqual(m.chosen, ['ru']);
  const after = menu();
  after.press('ArrowRight', { to: 'bn' });
  after.pick('bn');
  assert.deepEqual(after.chosen, ['bn']);
});

test('Enter, Space, Tab, Escape, Alt+Up/Down and shortcuts leave a choice alone', () => {
  const keys = [['Enter'], [' '], ['Tab'], ['Escape'], ['ArrowDown', { altKey: true }], ['ArrowUp', { altKey: true }],
    ['f', { ctrlKey: true }], ['f', { metaKey: true }], ['f', { altKey: true }], ['F4'], ['Shift']];
  for (const [key, mods] of keys) {
    const m = menu();
    m.press(key, mods);
    m.pick('bn');
    assert.deepEqual(m.chosen, ['bn'], `${key} ${JSON.stringify(mods || {})}`);
  }
});

test('a stepping key that changed nothing is forgotten by the next task', async () => {
  const m = menu();
  m.press('ArrowUp');   // already on the first language
  await nextTask();
  m.pick('bn');
  assert.deepEqual(m.chosen, ['bn']);
});

test('with openOnKeys off (the Couch), a stepping key only puts the menu back', () => {
  const m = menu({ open: false });
  m.press('e', { to: 'es-419' });
  assert.deepEqual(m.chosen, []);
  assert.equal(m.select.value, 'fr');
  assert.deepEqual(m.shown, []);
});

test('an open list that passes its keys to the page is not opened again', () => {
  const m = menu({ listOpen: true });
  m.press('p', { to: 'pt-BR' });
  assert.deepEqual(m.chosen, []);
  assert.equal(m.select.value, 'fr');
  assert.deepEqual(m.shown, []);
});

test('no picker, or one the browser refuses, is no error', () => {
  const none = menu({ picker: null });
  assert.doesNotThrow(() => none.press('End', { to: 'id' }));
  assert.equal(none.select.value, 'fr');
  const refused = menu({ picker: () => { throw new DOMException('no', 'NotAllowedError'); } });
  assert.doesNotThrow(() => refused.press('End', { to: 'id' }));
  assert.deepEqual(refused.chosen, []);
});

test('which keys step a closed list', () => {
  const steps = (key, mods = {}) => stepsClosedList({ key, ...NO_MODS, ...mods });
  for (const key of ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown', 'a', 'Z', '7', 'ß', '😀']) {
    assert.equal(steps(key), true, key);
  }
  assert.equal(steps('ArrowLeft', { altKey: true }), true);
  for (const key of ['Enter', ' ', 'Tab', 'Escape', 'F4', 'Shift', 'Dead', 'Unidentified', 'Process', '']) {
    assert.equal(steps(key), false, JSON.stringify(key));
  }
  assert.equal(steps('ArrowDown', { altKey: true }), false);
  assert.equal(steps('ArrowUp', { altKey: true }), false);
  assert.equal(steps('f', { ctrlKey: true }), false);
  assert.equal(steps(undefined), false);
});
