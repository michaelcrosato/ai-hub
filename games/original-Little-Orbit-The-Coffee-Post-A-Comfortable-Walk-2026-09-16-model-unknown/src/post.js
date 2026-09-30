/**
 * post.js — The Morning Post: a letter round beside the coffee round.
 *
 * A post box stands by the café. Its flag is up when letters are waiting.
 * The first bundle holds four letters for the town's shopkeepers; once they
 * are delivered, the shopkeepers' replies wait at the box for the four coffee
 * neighbors. Letters never use coffee and never change the coffee round.
 * Progress is saved with the rest of the walk.
 */
import { Node } from './engine.js';
import { frameAt, framePoint } from './physics.js';
import { norm, len } from './math.js';

const POST_BUNDLES = [
  {
    id: 'town', title: 'Letters for the town',
    pickup: 'Four letters for the shops. The stamps are still warm from the press.',
    letters: [
      { id: 'town-bramble', to: 'local_bramble', name: 'Baker Bramble', from: 'Pip', where: 'Crumb Bakery · Thread & Crumb Lane', voice: 'bramble',
        reply: 'From Pip? "Please save me the smallest bun. The big ones make me nervous." I will save two. Small ones.' },
      { id: 'town-fen', to: 'local_baths', name: 'Bathkeeper Fen', from: 'Miso', where: 'Cloudwater Baths', voice: 'baths',
        reply: 'Miso asks if the water is warm enough to read beside. Tell Miso yes. Always yes.' },
      { id: 'town-ash', to: 'local_kiln', name: 'Potter Ash', from: 'Mochi', where: 'Ember Kiln', voice: 'kiln',
        reply: 'Mochi wants a cup for apricot tea. Round, not too tall. I know the exact shape already.' },
      { id: 'town-lumi', to: 'local_usher', name: 'Usher Lumi', from: 'Pebble', where: 'The Pocket Picturehouse', voice: 'usher',
        reply: 'Pebble would like a film with more ripples. I will look through the reels tonight.' },
    ],
  },
  {
    id: 'replies', title: 'Replies for the neighbors',
    pickup: 'The town wrote back. Four replies for your neighbors. No coffee needed.',
    letters: [
      { id: 'reply-pip', to: 'pip', name: 'Pip', from: 'Baker Bramble', where: 'Button Square', voice: 'pip',
        reply: 'Two small buns! One for me. One for the leaves. They are very brave leaves.' },
      { id: 'reply-miso', to: 'miso', name: 'Miso', from: 'Bathkeeper Fen', where: 'Skybridge Library', voice: 'miso',
        reply: 'Warm water and a good chapter. I will bring a towel for the book.' },
      { id: 'reply-mochi', to: 'mochi', name: 'Mochi', from: 'Potter Ash', where: 'Apricot Orchard', voice: 'mochi',
        reply: 'A round cup for apricot tea. The trees are going to be so jealous.' },
      { id: 'reply-pebble', to: 'pebble', name: 'Pebble', from: 'Usher Lumi', where: 'Lily Pond', voice: 'pebble',
        reply: 'A film with ripples? I will count them while I wait. One. Two. Oh, a new one.' },
    ],
  },
];
const ALL_LETTERS = POST_BUNDLES.flatMap(b => b.letters);

/** Persistent letter progress. No DOM or renderer access. */
class PostState {
  constructor() { this.bundle = 0; this.carrying = false; this.delivered = new Set(); this.track = ''; }
  get complete() { return this.bundle >= POST_BUNDLES.length; }
  get count() { return this.delivered.size; }
  get total() { return ALL_LETTERS.length; }
  current() { return POST_BUNDLES[this.bundle] || null; }
  /** Letters in the bag that are not delivered yet. */
  remaining() { return this.carrying && this.current() ? this.current().letters.filter(l => !this.delivered.has(l.id)) : []; }
  /** The letter for this interaction id, if the courier carries one. */
  letterFor(targetId) { return this.remaining().find(l => l.to === targetId) || null; }
  pickup() {
    if (this.complete) return { ok: false, title: 'The Morning Post', text: 'Every letter is delivered. The flag rests. Thank you, courier.' };
    if (this.carrying) return { ok: false, title: 'Letters in your bag', text: `${this.remaining().length} still to deliver. The journal shows who they are for.` };
    this.carrying = true;
    const b = this.current();
    return { ok: true, title: b.title, text: b.pickup };
  }
  deliver(id) {
    const letter = this.remaining().find(l => l.id === id);
    if (!letter) return { ok: false };
    this.delivered.add(id);
    const bundleDone = this.remaining().length === 0;
    if (bundleDone) { this.carrying = false; this.bundle++; }
    return { ok: true, letter, bundleDone, complete: this.complete };
  }
  snapshot() { return { bundle: this.bundle, carrying: this.carrying, delivered: [...this.delivered], track: this.track }; }
  restore(d) {
    if (!d || typeof d !== 'object') return;
    this.delivered = new Set((Array.isArray(d.delivered) ? d.delivered : []).filter(id => ALL_LETTERS.some(l => l.id === id)));
    // The bundle follows the delivered letters, so a damaged save cannot skip or repeat one.
    let bundle = 0;
    while (bundle < POST_BUNDLES.length && POST_BUNDLES[bundle].letters.every(l => this.delivered.has(l.id))) bundle++;
    this.bundle = bundle;
    this.carrying = d.carrying === true && bundle < POST_BUNDLES.length;
    this.track = typeof d.track === 'string' && (d.track === 'box' || ALL_LETTERS.some(l => l.id === d.track)) ? d.track : '';
  }
}

/** The post box by the café and the letter rack inside it. */
function addPost(w) {
  const { prefab, rod, sign, solid, box } = w;
  const g = new Node('post_box'); g.matrix = frameAt(-3.0, 4.1, 0); w.dynamics.push(g);
  const mailbox = prefab(g, 'mailbox', [0, 0, 0], 1.1);
  solid(g, [0, .81, 0], [.72, 1.62, .78], 'post_box');
  rod(g, [0, 1.62, 0], [0, 1.98, 0], .03, '#aa7955');
  const board = sign(g, [0, 2.1, 0], 'THE MORNING POST', 1.25, .29);
  const back = board.part('plane', '#ffffff', [0, 0, -.093], [1.25, .29, 1], [0, Math.PI, 0]);
  back.texture = board.children.find(n => n.texture).texture; back.unlit = true;
  const p = framePoint(g.matrix, [0, 0, 1.0]);
  const target = { id: 'post-box', type: 'post', name: 'The Morning Post', n: norm(p), h: Math.max(0, len(p) - 26), prompt: 'Collect the morning post', node: mailbox };
  w.interactions.push(target);
  // Eight envelopes on the café wall: one appears for every delivered letter.
  const rack = new Node('post_rack'); rack.matrix = w.cafe.matrix; w.dynamics.push(rack);
  const envelopes = [];
  for (let i = 0; i < 8; i++) {
    const e = new Node('envelope_' + i); e.position = [-3.80, 1.72 + Math.floor(i / 4) * .32, -1.35 + (i % 4) * .5]; e.rotation = [(i % 3 - 1) * .07, 0, 0];
    box(e, i % 2 ? '#f6e9cf' : '#fbf1dc', [0, 0, 0], [.02, .22, .34]);
    box(e, ['#d98a5f', '#7f9c86', '#d7b36a', '#c08a86'][i % 4], [.012, .05, .11], [.012, .06, .06]);
    rack.add(e); envelopes.push(e);
  }
  w.post = { root: g, mailbox, flag: mailbox.find('flag'), target, rack, envelopes };
}

/** Show the state of the post in the world: the flag and the rack. */
function updatePost(w, post) {
  const flag = w.post.flag;
  const waiting = !post.carrying && !post.complete;
  if (flag) flag.position[1] = waiting ? 1.55 : 1.24;
  w.post.envelopes.forEach((e, i) => { e.visible = i < post.count; });
}

export { POST_BUNDLES, ALL_LETTERS, PostState, addPost, updatePost };
