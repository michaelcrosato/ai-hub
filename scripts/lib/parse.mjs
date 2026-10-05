/**
 * Pure helpers for turning an arbitrary self-contained game HTML file into
 * catalogue metadata. No I/O, no Node built-ins — everything here is a pure
 * function so `scripts/parse.test.mjs` can hammer it.
 *
 * These files were written by many different models under many different
 * harnesses, so nothing about their markup can be assumed: attribute order,
 * quoting style, entity usage and self-closing syntax all vary between files.
 */

const NAMED_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  mdash: '—',
  ndash: '–',
  minus: '−',
  middot: '·',
  bull: '•',
  hellip: '…',
  times: '×',
  divide: '÷',
  deg: '°',
  copy: '©',
  reg: '®',
  trade: '™',
  laquo: '«',
  raquo: '»',
  ldquo: '“',
  rdquo: '”',
  lsquo: '‘',
  rsquo: '’',
  sect: '§',
  para: '¶',
  dagger: '†',
  plusmn: '±',
  frac12: '½',
  frac14: '¼',
  sup2: '²',
  sup3: '³',
  larr: '←',
  uarr: '↑',
  rarr: '→',
  darr: '↓',
  harr: '↔',
  infin: '∞',
  ne: '≠',
  le: '≤',
  ge: '≥',
  star: '★',
  hearts: '♥',
  diams: '♦',
  clubs: '♣',
  spades: '♠',
  check: '✓',
  cross: '✗',
  ensp: ' ',
  emsp: ' ',
  thinsp: ' ',
  shy: '­',
  euro: '€',
  pound: '£',
  yen: '¥',
  cent: '¢',
};

const ENTITY_RE = /&(#x[0-9a-f]+|#[0-9]+|[a-z][a-z0-9]*);/gi;

/**
 * Decode HTML character references in a single pass, so `&amp;amp;` decodes to
 * `&amp;` rather than `&`. Unknown references are left verbatim.
 */
export function decodeEntities(input) {
  if (!input) return '';
  return String(input).replace(ENTITY_RE, (whole, ref) => {
    if (ref[0] === '#') {
      const code =
        ref[1] === 'x' || ref[1] === 'X'
          ? Number.parseInt(ref.slice(2), 16)
          : Number.parseInt(ref.slice(1), 10);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return whole;
      try {
        return String.fromCodePoint(code);
      } catch {
        return whole;
      }
    }
    const named = NAMED_ENTITIES[ref.toLowerCase()];
    return named === undefined ? whole : named;
  });
}

const ATTR_RE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>`]+))/g;

/**
 * Parse a raw tag body into a lowercase-keyed attribute map. Values keep their
 * original case; only the attribute names are normalised.
 */
export function parseAttrs(tagBody) {
  const out = {};
  if (!tagBody) return out;
  ATTR_RE.lastIndex = 0;
  let m;
  while ((m = ATTR_RE.exec(tagBody)) !== null) {
    out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return out;
}

/** Everything up to (not including) `</head>`, or the whole input if there is none. */
export function extractHead(html) {
  if (!html) return '';
  const end = html.search(/<\/head\s*>/i);
  return end === -1 ? html : html.slice(0, end);
}

// Quote-aware so a `>` inside an attribute value does not truncate the tag.
const TAG_RE = (name) => new RegExp(`<${name}\\b(?:[^>"']|"[^"]*"|'[^']*')*>`, 'gi');

function tagsOf(html, name) {
  const re = TAG_RE(name);
  const found = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    found.push(parseAttrs(m[0].slice(1 + name.length)));
  }
  return found;
}

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** Normalise a CSS colour to 6-digit lowercase hex, or null if unusable. */
export function normalizeColor(value) {
  if (!value) return null;
  const raw = String(value).trim().toLowerCase();
  if (HEX_RE.test(raw)) {
    const body = raw.slice(1);
    if (body.length === 3 || body.length === 4) {
      const rgb = body.slice(0, 3);
      return '#' + [...rgb].map((c) => c + c).join('');
    }
    return '#' + body.slice(0, 6);
  }
  const fn = raw.match(/^rgba?\(\s*([0-9.]+)[\s,]+([0-9.]+)[\s,]+([0-9.]+)/);
  if (fn) {
    const hex = fn
      .slice(1, 4)
      .map((n) => Math.max(0, Math.min(255, Math.round(Number(n)))).toString(16).padStart(2, '0'))
      .join('');
    return '#' + hex;
  }
  return null;
}

const SQUISH = (s) => decodeEntities(s).replace(/\s+/g, ' ').trim();

// Older names for a hub:* field. Games keep whatever their prompt told them to
// write, so `hub:inspired-by` still lands in `source`, the field the wall uses.
const HUB_ALIASES = { inspiredBy: 'source' };

/**
 * Pull catalogue metadata out of a document head. Attribute order is never
 * assumed: every `<meta>` is parsed into a map first, then looked up by name.
 */
export function parseHead(html) {
  const head = extractHead(html || '');

  const titleMatch = head.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i);
  const title = titleMatch ? SQUISH(titleMatch[1]) : '';

  const htmlTag = head.match(/<html\b(?:[^>"']|"[^"]*"|'[^']*')*>/i);
  const lang = htmlTag ? parseAttrs(htmlTag[0].slice(5)).lang || null : null;

  const byName = new Map();
  for (const attrs of tagsOf(head, 'meta')) {
    const key = (attrs.name || attrs.property || attrs.itemprop || '').toLowerCase();
    if (!key || attrs.content === undefined) continue;
    if (!byName.has(key)) byName.set(key, attrs.content);
  }

  const hub = {};
  for (const [key, value] of byName) {
    if (!key.startsWith('hub:')) continue;
    const raw = key
      .slice(4)
      .replace(/[-_ ](.)/g, (_, c) => c.toUpperCase())
      .trim();
    const field = HUB_ALIASES[raw] || raw;
    if (!field || (field !== raw && byName.has(`hub:${field}`))) continue;
    const text = SQUISH(value);
    hub[field] =
      field === 'tags' || field === 'controls'
        ? text
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : text;
  }

  let icon = null;
  let iconHref = null;
  for (const attrs of tagsOf(head, 'link')) {
    const rel = (attrs.rel || '').toLowerCase();
    if (!/\b(icon|shortcut icon|apple-touch-icon)\b/.test(rel)) continue;
    const href = decodeEntities((attrs.href || '').trim());
    // A data: URI travels anywhere. Anything else is kept as written and only
    // used if scan.mjs can find the file next to the game — taken as-is it
    // would resolve against the hub, not the game, and 404 on every tile.
    if (href.startsWith('data:')) {
      icon = href;
      break;
    }
    if (href && !iconHref) iconHref = href;
  }

  const image = decodeEntities(
    (byName.get('og:image') || byName.get('twitter:image') || '').trim()
  ) || null;

  return {
    title,
    lang,
    description: SQUISH(byName.get('description') || byName.get('og:description') || ''),
    themeColor: normalizeColor(byName.get('theme-color') || byName.get('msapplication-tilecolor')),
    icon,
    iconHref: icon ? null : iconHref,
    image,
    hub,
  };
}

// Leftmost separator wins, so a middot before an em dash still splits first.
const TITLE_SEP =
  /\s*[—–]\s*|\s+[·•|]\s+|\s*:\s+|\s+[-‒]\s+|\s+\/\s+/;

/**
 * Most of these titles are `Name <separator> Tagline`. Split once and keep the
 * right-hand side verbatim, so `AURORA / Surface 0.4` survives intact.
 */
export function splitTitle(title) {
  const full = SQUISH(title || '');
  if (!full) return { name: '', tagline: '' };
  const at = full.search(TITLE_SEP);
  if (at < 0) return { name: full, tagline: '' };
  const name = full.slice(0, at).trim();
  const sep = full.slice(at).match(TITLE_SEP);
  const tagline = full.slice(at + sep[0].length).trim();
  // A one-character left side is punctuation, not a name.
  if (name.length < 2 || !tagline) return { name: full, tagline: '' };
  return { name, tagline };
}

/** Lowercase, accent-free, URL-safe. Can legitimately return '' — callers fall back. */
export function slugify(input) {
  return String(input ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const WHOLE_VERSION = /^[vV]?(\d+(?:\.\d+)*)$/;
// Either an explicit `v` prefix or a dotted number. A bare trailing integer is
// NOT treated as a version: `snake-2.html` is far more likely a different game
// than build 2 of `snake`, and a false positive hides a game from the wall.
const TRAILING_VERSION = /^(.+?)[-_. ]+(?:[vV](\d+(?:\.\d+)*)|(\d+\.\d+(?:\.\d+)*))$/;

export function parseVersion(basename) {
  const name = String(basename ?? '').trim();
  const whole = name.match(WHOLE_VERSION);
  if (whole) return { base: '', version: whole[1] };
  const trailing = name.match(TRAILING_VERSION);
  if (trailing) return { base: trailing[1], version: trailing[2] ?? trailing[3] };
  return { base: name, version: null };
}

/** Numeric, segment-by-segment. `1.10` is newer than `1.9`; `1.0` outranks `1`. */
export function compareVersions(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  const A = String(a).split('.').map(Number);
  const B = String(b).split('.').map(Number);
  const len = Math.max(A.length, B.length);
  for (let i = 0; i < len; i++) {
    const x = A[i];
    const y = B[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (x !== y) return x - y;
  }
  return 0;
}

// src="/assets/x.js", href='/style.css' — but not "//cdn…" or a bare "/".
const ROOT_REF = /(\b(?:src|href|poster)\s*=\s*)(["'])\/(?![/"'])([^"'?#]*)([^"']*)\2/gi;

/**
 * Root-absolute references in a page (`/assets/index-3f2a.js`). A bundler
 * configured for its own domain writes these, and inside the hub they resolve
 * against the hub rather than the game's folder, so the game loads blank.
 * `/lib/` is the exception: the shared 3D stack lives there on purpose.
 */
export function rootAbsoluteRefs(html) {
  const found = new Set();
  for (const m of String(html || '').matchAll(ROOT_REF)) {
    if (m[3] && !m[3].startsWith('lib/')) found.add('/' + m[3]);
  }
  return [...found];
}

/**
 * Rewrite root-absolute references to relative ones, for the paths `keep`
 * says exist inside the project. `depth` is how many folders below the
 * project root the page sits, so a nested page climbs back up correctly.
 */
export function relativizeRefs(html, keep, depth = 0) {
  const up = depth > 0 ? '../'.repeat(depth) : './';
  return String(html).replace(ROOT_REF, (whole, attr, quote, path, rest) =>
    path && keep(path) ? `${attr}${quote}${up}${path}${rest}${quote}` : whole
  );
}
