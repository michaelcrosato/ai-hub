import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

/** First arrival in this repository, following renames rather than treating
 * repackaging a game as a new import. NUL delimiters also handle spaces and
 * non-ASCII names without Git's quoted-path escaping. */
export function parseAddedHistory(history) {
  const tokens = history.split('\0');
  const dates = new Map();
  let date;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i].trim();
    if (!token) continue;
    if (/^\d{4}-\d{2}-\d{2}T/.test(token)) {
      date = new Date(token).toISOString();
      continue;
    }
    const file = tokens[++i];
    if (token.startsWith('R')) {
      const target = tokens[++i];
      if (!dates.has(target)) dates.set(target, dates.get(file) || date);
    } else if (token.startsWith('C')) {
      const target = tokens[++i];
      if (!dates.has(target)) dates.set(target, date);
    } else if (token === 'A' && !dates.has(file)) {
      dates.set(file, date);
    }
  }
  return new Map(
    [...dates]
      .filter(([file, date]) => file?.startsWith('games/') && date)
      .map(([file, date]) => [file.slice('games/'.length), date]),
  );
}

/** First-commit dates of the games, from git history. Persisted dates always
 * win during scans: a shallow deployment checkout cannot recover historical
 * import dates, and then this is empty rather than wrong. */
export async function gitAddedDates(root) {
  try {
    const { stdout } = await run(
      'git',
      ['log', '--reverse', '--name-status', '-z', '--find-renames', '--format=%x00%cI', '--', 'games'],
      { cwd: root, maxBuffer: 64 * 1024 * 1024, timeout: 20_000 },
    );
    return parseAddedHistory(stdout);
  } catch {
    return new Map();
  }
}
