/**
 * hub-client.mjs — the session client pasted into games, found, checked and
 * upgraded without a model.
 *
 * Every session game pastes lib/hub/session.js unmodified (lib/hub/README.md,
 * "Side by side"). A pasted copy runs from its banner, `/*! aihub-session
 * X.Y.Z`, to the client's last line. It is pristine when its text is, line
 * endings aside, exactly a released client: RELEASES holds each one's
 * SHA-256. Only a pristine copy is ever replaced, so a client someone edited
 * is reported and left alone, never overwritten.
 */

import { createHash } from 'node:crypto';

/** SHA-256 of each released client, banner to last line, with LF line endings. */
export const RELEASES = Object.freeze({
  '1.0.0': '6fc9b691a78c237944ba0e972f506079e9906fbcc6b83e3d6acb8e832f88bb19',
  '1.1.0': '6625a3a55ed0380baf268d593dd24e85f6c49fcd00d524fc308ae0fd4b484272',
  '1.2.0': '2d6e9bd677210500e7683deaa88dace3f70b28295f85b0525a1811b2bc9bd088',
  '1.3.0': '32ed0ff62e4e0880bc78db850a0cff8dd7c9277d34ef76cafc60d535d41761db',
});

const BANNER = '/*! aihub-session ';
export const CLIENT_END = "})(typeof window !== 'undefined' ? window : globalThis);";

const sha256 = (text) => createHash('sha256').update(text).digest('hex');
const lf = (text) => text.replace(/\r\n/g, '\n');

/** Compare dotted versions: negative when a is older than b. */
export function compareVersions(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

/**
 * Every pasted client in a page or script: where it sits, the version its
 * banner names, and whether it is exactly that release.
 */
export function findClients(text) {
  const out = [];
  let from = 0;
  for (;;) {
    const start = text.indexOf(BANNER, from);
    if (start === -1) break;
    const close = text.indexOf(CLIENT_END, start);
    const version = text.slice(start + BANNER.length).match(/^\d+\.\d+\.\d+/)?.[0] ?? null;
    if (close === -1) {
      out.push({ start, end: text.length, version, pristine: false, complete: false });
      break;
    }
    const end = close + CLIENT_END.length;
    const hash = sha256(lf(text.slice(start, end)));
    out.push({ start, end, version, pristine: !!version && RELEASES[version] === hash, complete: true, hash });
    from = end;
  }
  return out;
}

/** The released client's version and the hash a pasted copy of it must have. */
export function describeClient(source) {
  const [found] = findClients(source);
  if (!found?.complete || !found.version) throw new Error('lib/hub/session.js has no banner or no last line');
  return { version: found.version, hash: found.hash, text: lf(source.slice(found.start, found.end)) };
}

/**
 * Replace every pristine client older than `current` with it, keeping the
 * file's own line endings. Returns the new text and what happened to each copy.
 */
export function upgradeText(text, current) {
  const copies = findClients(text);
  const crlf = text.includes('\r\n');
  const replacement = crlf ? current.text.replace(/\n/g, '\r\n') : current.text;
  let out = '';
  let at = 0;
  const report = [];
  for (const copy of copies) {
    let action = 'kept';
    if (!copy.complete || !copy.pristine) action = 'edited';
    else if (compareVersions(copy.version, current.version) < 0) action = 'upgraded';
    else if (compareVersions(copy.version, current.version) > 0) action = 'newer';
    report.push({ version: copy.version, action });
    if (action !== 'upgraded') continue;
    out += text.slice(at, copy.start) + replacement;
    at = copy.end;
  }
  out += text.slice(at);
  return { text: out, copies: report, changed: report.some((r) => r.action === 'upgraded') };
}
