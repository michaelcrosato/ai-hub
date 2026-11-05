import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseAddedHistory } from './lib/dates.mjs';

test('first arrival dates follow renames, while a copied game is a new arrival', () => {
  const history =
    '\0' +
    '2026-09-01T12:00:00Z\0\nA\0games/old name.html\0' +
    '\0' +
    '2026-10-13T12:00:00Z\0\nR100\0games/old name.html\0games/renamed/index.html\0' +
    'C100\0games/renamed/index.html\0games/copied.html\0';
  const dates = parseAddedHistory(history);
  assert.equal(dates.get('renamed/index.html'), '2026-09-01T12:00:00.000Z');
  assert.equal(dates.get('copied.html'), '2026-10-13T12:00:00.000Z');
});
