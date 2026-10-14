/* Morrowglass: Lanterns. Original deterministic card game. No external dependencies. */
(() => {
  'use strict';
  const ICONS = {
    moth: '<path d="M32 19C15 1 3 10 9 27L27 35C10 30 5 42 19 48L30 38M32 19C49 1 61 10 55 27L37 35C54 30 59 42 45 48L34 38M32 16V48M28 11L32 19L36 11"/>',
    bell: '<path d="M18 37V25C18 7 46 7 46 25V37L51 43H13L18 37ZM26 48C28 55 36 55 38 48M29 8V4H35V8M24 26V34"/>',
    gate: '<path d="M13 53V26C13 1 51 1 51 26V53M20 53V26C20 11 44 11 44 26V53M25 26V52M32 22V52M39 26V52M20 37H44M8 53H56"/>',
    sun: '<circle cx="32" cy="30" r="12"/><path d="M32 7V2M32 58V53M9 30H4M60 30H55M16 14L12 10M52 50L48 46M48 14L52 10M12 50L16 46M27 30Q32 37 37 30"/>',
    thorn: '<path d="M18 54C45 42 18 23 43 5M24 46L11 39L26 35M31 29L46 27L34 20M36 14L24 8M40 10L52 12M28 52L40 54"/>'
  };
  const make = (id, name, art, edges) => Object.freeze({ id, name, art, edges: Object.freeze(edges) });
  const PLAYER = Object.freeze([
    make('p0', 'Silk Moth', 'moth', [3, 5, 2, 4]), make('p1', 'Evening Bell', 'bell', [5, 2, 4, 3]),
    make('p2', 'Old Gate', 'gate', [4, 3, 6, 2]), make('p3', 'Small Sun', 'sun', [2, 6, 3, 5]),
    make('p4', 'Briar Crown', 'thorn', [7, 4, 2, 3])
  ]);
  const OPPONENT = Object.freeze([
    make('o0', 'Brass Bell', 'bell', [4, 4, 3, 5]), make('o1', 'Night Moth', 'moth', [2, 5, 6, 3]),
    make('o2', 'Iron Gate', 'gate', [5, 3, 3, 4]), make('o3', 'Wild Briar', 'thorn', [3, 7, 4, 2])
  ]);
  const DIRECTIONS = [[-1, 0], [0, 1], [1, 0], [0, -1]];
  const DEFAULT_PRIZE = 'Moth Charm (+8 ATK for Ivo) and 40 crowns';
  const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  let serial = 0;
  const CSS = `
.mc-overlay{position:fixed;inset:0;z-index:2000;display:flex;align-items:center;justify-content:center;padding:18px;background:#050c18df;backdrop-filter:blur(8px);color:#eee2c5;font:15px/1.5 Georgia,serif;box-sizing:border-box}
.mc-overlay *{box-sizing:border-box}.mc-view{width:min(980px,100%);min-width:0}.mc-panel{width:100%;max-height:calc(100dvh - 36px);overflow:auto;border:1px solid #b59858;border-radius:14px;background:radial-gradient(ellipse at 50% 45%,#233745,#111e2b 75%);box-shadow:0 25px 100px #000b,inset 0 0 0 5px #b5985810;padding:25px 28px 20px}
.mc-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;border-bottom:1px solid #b598584a;padding-bottom:15px}.mc-eyebrow{margin:0;color:#c4ae7b;font:11px/1.4 Arial,sans-serif;letter-spacing:.2em;text-transform:uppercase}.mc-title{margin:2px 0 0;color:#fff0cf;font-size:34px;font-weight:normal;letter-spacing:.12em;line-height:1.2}.mc-head small{display:block;color:#c7c5b9;margin-top:5px;font:13px/1.4 Arial,sans-serif}
.mc-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.mc-btn{cursor:pointer;border:1px solid #bda36a77;border-radius:5px;background:#152535;color:#f4e8cb;padding:9px 12px;font:13px/1.3 Arial,sans-serif}.mc-btn:hover{background:#334753;border-color:#e8c583}.mc-btn:focus-visible,.mc-card:focus-visible,.mc-cell:focus-visible{outline:3px solid #ffe1a0;outline-offset:4px}.mc-primary{background:#bda068;color:#101b27;font-weight:bold}.mc-primary:hover{background:#e3c68d}
.mc-rules{margin:15px 0 0;padding:12px 16px;background:#07142280;border-left:2px solid #d4b16f;border-radius:3px;font:13px/1.6 Arial,sans-serif;color:#e0ded2}.mc-rules p{margin:0}.mc-rules p+p{margin-top:7px}.mc-rules strong{color:#ffe1a0}
.mc-scorebar{display:flex;align-items:center;justify-content:center;gap:26px;margin:19px 0 7px;font:14px/1.3 Arial,sans-serif}.mc-score{display:flex;align-items:center;gap:9px}.mc-score b{font:28px/1 Georgia,serif}.mc-dot{width:10px;height:10px;border-radius:50%;background:#4c9caf;border:1px solid #b7e5e7}.mc-dot.mc-tamsin{background:#e2c990;border-color:#fff4d0}.mc-turn-label{color:#b5b9b7;font-size:11px;letter-spacing:.09em;text-transform:uppercase}
.mc-layout{display:grid;grid-template-columns:200px minmax(260px,340px) 200px;gap:24px;justify-content:center;align-items:start;margin-top:19px}.mc-section-label{margin:0 0 10px;font:11px/1.4 Arial,sans-serif;letter-spacing:.15em;text-transform:uppercase;color:#d1bb8b}.mc-section-label span{float:right;color:#9aafa9;letter-spacing:0}.mc-hand{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;align-content:start}.mc-hand .mc-card:last-child:nth-child(odd){grid-column:1 / 3;justify-self:center;width:calc(50% - 4.5px)}
.mc-board{display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);gap:8px;aspect-ratio:1;background:#06111cb0;border:1px solid #ab8e5555;padding:10px;border-radius:9px;box-shadow:inset 0 0 30px #0006}.mc-cell{position:relative;min-width:0;min-height:0;border:1px solid #b39a6255;border-radius:5px;background:#1e2e3680;color:#bca16c;font:12px/1 Arial,sans-serif;padding:0;cursor:pointer}.mc-cell:disabled{cursor:default;opacity:.8}.mc-cell:not(:disabled):hover{background:#46564c77;border-color:#edce8b}.mc-cell .mc-position{opacity:.38;font:20px/1 Georgia,serif}.mc-cell .mc-preview{position:absolute;right:6px;top:6px;background:#e5c98e;color:#142538;padding:4px;border-radius:4px;font-weight:bold}.mc-board>.mc-card{height:100%;aspect-ratio:auto;min-height:0}.mc-board-wrap>p{text-align:center;margin:9px 0 0;color:#aebcb9;font:11px/1.4 Arial,sans-serif}
.mc-card{position:relative;display:block;width:100%;aspect-ratio:.91;border:1px solid #ceb880;border-radius:5px;overflow:hidden;background:linear-gradient(145deg,#e8d6ae,#bf9d61);color:#3b3225;box-shadow:0 3px 8px #0004;isolation:isolate;font-family:Georgia,serif;padding:0}.mc-card:before{content:'';position:absolute;inset:4px;border:1px solid currentColor;opacity:.2;border-radius:2px;pointer-events:none}.mc-card.mc-you{background:linear-gradient(145deg,#345e70,#203b54);color:#f6e7bd;border-color:#74b9bd}.mc-card svg{position:absolute;width:43%;height:43%;left:28.5%;top:25%;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;opacity:.85}.mc-edge{position:absolute;z-index:1;font:bold 18px/1 Georgia,serif;text-shadow:0 1px 2px #0002}.mc-n{top:6px;left:50%;transform:translateX(-50%)}.mc-e{right:6px;top:50%;transform:translateY(-50%)}.mc-s{bottom:5px;left:50%;transform:translateX(-50%)}.mc-w{left:6px;top:50%;transform:translateY(-50%)}.mc-card-name{position:absolute;left:5px;right:5px;top:69%;font:10px/1.1 Georgia,serif;text-align:center;white-space:nowrap}.mc-owner{position:absolute;left:6px;bottom:5px;font:bold 7px/1 Arial,sans-serif;letter-spacing:.05em;opacity:.7}.mc-hand button.mc-card{cursor:pointer;transition:transform .16s,box-shadow .16s}.mc-hand button.mc-card:not(:disabled):hover{transform:translateY(-3px);box-shadow:0 5px 18px #0007}.mc-hand button.mc-card:disabled{cursor:default;opacity:.7}.mc-card.mc-selected{outline:3px solid #ffe2a0;outline-offset:2px;transform:translateY(-3px);box-shadow:0 0 20px #e7b75955}.mc-empty-hand{grid-column:1/-1;margin:24px 0;color:#8eaaa9;font:13px/1.6 Arial,sans-serif;text-align:center}.mc-flip{animation:mc-turn .44s ease-out}
.mc-status{margin:19px 0 0;min-height:44px;text-align:center;font:14px/1.5 Arial,sans-serif;color:#f2e4c5}.mc-status:focus{outline:none}.mc-status strong{display:block;font:23px/1.4 Georgia,serif;color:#ffe5b4}.mc-footer{display:flex;align-items:center;justify-content:space-between;gap:15px;margin-top:10px;border-top:1px solid #b598583b;padding-top:13px}.mc-prize{font:12px/1.5 Arial,sans-serif;color:#b4c3bf;margin:0}.mc-prize b{color:#e8c58b;font-weight:normal}.mc-live{position:absolute!important;width:1px;height:1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@keyframes mc-turn{0%{transform:rotateY(90deg) scale(.94)}65%{transform:rotateY(-9deg) scale(1.03)}100%{transform:rotateY(0) scale(1)}}
@media(max-width:850px){.mc-panel{padding:20px}.mc-layout{grid-template-columns:160px minmax(230px,320px) 160px;gap:15px}.mc-edge{font-size:17px}.mc-card-name{font-size:9px}}
@media(max-width:690px){.mc-overlay{padding:8px}.mc-panel{max-height:calc(100dvh - 16px);padding:17px 14px}.mc-title{font-size:27px}.mc-head{gap:10px}.mc-actions{gap:5px}.mc-btn{padding:8px;font-size:12px}.mc-layout{grid-template-columns:1fr 1fr;gap:18px 14px;margin-top:15px}.mc-board-wrap{grid-column:1/-1;grid-row:1;max-width:330px;width:100%;justify-self:center}.mc-hand{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.mc-hand .mc-card:last-child:nth-child(odd){grid-column:auto;width:100%;justify-self:stretch}.mc-card{aspect-ratio:.73}.mc-edge{font-size:15px}.mc-card-name{font-size:8px;top:68%;white-space:normal}.mc-section-label{font-size:10px;letter-spacing:.07em}.mc-section-label span{float:none;display:block}.mc-scorebar{gap:15px}.mc-footer{align-items:flex-start}.mc-status{font-size:13px;margin-top:15px}.mc-owner{font-size:6px;left:4px}.mc-hand .mc-card svg{width:44%;left:28%}}
@media(prefers-reduced-motion:reduce){.mc-flip{animation:none}.mc-hand button.mc-card{transition:none}}
`;

  class MorrowCards {
    constructor(container, { onClose = () => {}, onWin = () => {}, rewardClaimed = false, opponentName = 'Tamsin', setting = '', prizeText = DEFAULT_PRIZE } = {}) {
      if (!container || typeof container.appendChild !== 'function') throw new TypeError('MorrowCards needs a DOM container.');
      this.id = `mc-${++serial}`;
      this.onClose = onClose; this.onWin = onWin; this.rewardClaimed = Boolean(rewardClaimed);
      this.opponentName = String(opponentName || 'Tamsin'); this.setting = String(setting || ''); this.prizeText = String(prizeText || DEFAULT_PRIZE);
      this.previousFocus = document.activeElement; this.closed = false; this.help = false;
      if (!document.getElementById('morrow-cards-style')) {
        const style = document.createElement('style'); style.id = 'morrow-cards-style'; style.textContent = CSS; document.head.appendChild(style);
      }
      this.root = document.createElement('div'); this.root.className = 'mc-overlay';
      this.live = document.createElement('div'); this.live.className = 'mc-live'; this.live.setAttribute('aria-live', 'polite'); this.live.setAttribute('aria-atomic', 'true');
      this.view = document.createElement('div'); this.view.className = 'mc-view'; this.root.append(this.live, this.view); container.appendChild(this.root);
      this.clickHandler = event => this.handleClick(event); this.keyHandler = event => this.handleKey(event);
      this.root.addEventListener('click', this.clickHandler); this.root.addEventListener('keydown', this.keyHandler);
      this.start();
    }

    get opponentLabel() { return this.opponentName || 'Tamsin'; }
    get prizeLabel() { return this.prizeText || DEFAULT_PRIZE; }
    get rewardLabel() { return this.prizeLabel.replace(/\s*\([^)]*\)/g, ''); }
    get tableLabel() { return this.setting ? `${this.opponentLabel} · ${this.setting}` : `${this.opponentLabel === 'Tamsin' ? 'Old Tamsin' : this.opponentLabel} · One quiet hand`; }

    // Edges are [north, east, south, west]. Captures use the board before the move.
    static simulate(board, cell, card, owner) {
      if (!Number.isInteger(cell) || cell < 0 || cell > 8 || board[cell]) throw new RangeError('Choose an empty board space.');
      const next = board.map(slot => slot ? { ...slot } : null), captures = [];
      next[cell] = { card, owner };
      const row = Math.floor(cell / 3), col = cell % 3;
      DIRECTIONS.forEach(([dr, dc], edge) => {
        const r = row + dr, c = col + dc;
        if (r < 0 || r > 2 || c < 0 || c > 2) return;
        const index = r * 3 + c, neighbor = board[index];
        if (neighbor && neighbor.owner !== owner && card.edges[edge] > neighbor.card.edges[(edge + 2) % 4]) {
          next[index] = { ...neighbor, owner }; captures.push(index);
        }
      });
      return { board: next, captures };
    }

    static bestMove(board, hand, owner = 'tamsin') {
      let best = null;
      hand.forEach((card, cardIndex) => board.forEach((slot, cell) => {
        if (slot) return;
        const count = MorrowCards.simulate(board, cell, card, owner).captures.length;
        if (!best || count > best.captures) best = { cardIndex, cell, captures: count };
      }));
      return best;
    }

    start() {
      clearTimeout(this.timer); this.board = Array(9).fill(null); this.hand = [...PLAYER]; this.opponent = [...OPPONENT];
      this.selected = null; this.turn = 'you'; this.finished = false; this.lastCaptures = [];
      this.message = 'Choose a card. Then choose an empty space. You play first.';
      this.render('card-p0');
    }

    cardHTML(card, owner, { button = false, selected = false, flip = false } = {}) {
      const label = `${card.name}. Top ${card.edges[0]}, right ${card.edges[1]}, bottom ${card.edges[2]}, left ${card.edges[3]}. ${owner === 'you' ? 'Your card' : this.opponentLabel + "'s card"}.`;
      const tag = button ? 'button' : 'div';
      const attrs = button ? `type="button" data-action="card" data-card="${card.id}" data-focus="card-${card.id}" aria-pressed="${selected}" ${this.turn !== 'you' || this.finished ? 'disabled' : ''}` : 'role="img"';
      return `<${tag} class="mc-card ${owner === 'you' ? 'mc-you' : ''} ${selected ? 'mc-selected' : ''} ${flip ? 'mc-flip' : ''}" ${attrs} aria-label="${esc(label)}">
        <svg viewBox="0 0 64 64" aria-hidden="true">${ICONS[card.art]}</svg><span class="mc-card-name" aria-hidden="true">${card.name}</span>
        ${['n','e','s','w'].map((dir, i) => `<span class="mc-edge mc-${dir}" aria-hidden="true">${card.edges[i]}</span>`).join('')}
        <span class="mc-owner" aria-hidden="true">${owner === 'you' ? 'YOU' : esc(this.opponentLabel.charAt(0).toUpperCase())}</span></${tag}>`;
    }

    render(focus = '') {
      if (this.closed) return;
      const score = this.board.reduce((sum, slot) => { if (slot) sum[slot.owner]++; return sum; }, { you: 0, tamsin: 0 });
      const opponent = esc(this.opponentLabel);
      const selected = this.hand.find(card => card.id === this.selected);
      const cells = this.board.map((slot, i) => {
        if (slot) return this.cardHTML(slot.card, slot.owner, { flip: this.lastCaptures.includes(i) });
        const captures = selected ? MorrowCards.simulate(this.board, i, selected, 'you').captures.length : 0;
        return `<button type="button" class="mc-cell" data-action="place" data-cell="${i}" data-focus="cell-${i}" ${!selected || this.turn !== 'you' || this.finished ? 'disabled' : ''} aria-label="Place ${selected ? selected.name : 'a card'} at row ${Math.floor(i/3)+1}, column ${i%3+1}. Captures ${captures} cards."><span class="mc-position" aria-hidden="true">✧</span>${captures ? `<span class="mc-preview" aria-hidden="true">+${captures}</span>` : ''}</button>`;
      }).join('');
      this.view.innerHTML = `<section class="mc-panel" role="dialog" aria-modal="true" aria-labelledby="${this.id}-title" aria-describedby="${this.id}-status">
        <header class="mc-head"><div><p class="mc-eyebrow">A card game of small victories</p><h2 class="mc-title" id="${this.id}-title">LANTERNS</h2><small>${esc(this.tableLabel)}</small></div>
        <div class="mc-actions"><button type="button" class="mc-btn" data-action="help" data-focus="help" aria-expanded="${this.help}" aria-controls="${this.id}-rules">${this.help ? 'Hide rules' : 'Rules'}</button><button type="button" class="mc-btn" data-action="close">Leave table</button></div></header>
        ${this.help ? `<div class="mc-rules" id="${this.id}-rules"><p><strong>Higher edge wins.</strong> Place a card in an empty space. Compare its edges with each touching card. A higher value captures that card. Equal values do not capture. Diagonal cards do not touch.</p><p>Captured cards do not cause more captures. You play five cards. ${opponent} plays four. All values are visible. After nine moves, the owner of five or more cards wins. Choose a card to preview its captures.</p></div>` : ''}
        <div class="mc-scorebar"><span class="mc-score"><i class="mc-dot" aria-hidden="true"></i>You <b>${score.you}</b></span><span class="mc-turn-label">${this.finished ? 'Final score' : this.turn === 'you' ? 'Your turn' : opponent + "'s turn"}</span><span class="mc-score"><b>${score.tamsin}</b>${opponent}<i class="mc-dot mc-tamsin" aria-hidden="true"></i></span></div>
        <div class="mc-layout"><section><h3 class="mc-section-label">Your hand <span>${this.hand.length} cards</span></h3><div class="mc-hand">${this.hand.map(card => this.cardHTML(card, 'you', { button: true, selected: card.id === this.selected })).join('') || '<p class="mc-empty-hand">All lanterns are lit.</p>'}</div></section>
        <div class="mc-board-wrap"><div class="mc-board" aria-label="Lanterns board. Three rows and three columns.">${cells}</div><p>Blue belongs to you. Gold belongs to ${opponent}.</p></div>
        <section><h3 class="mc-section-label">${opponent}'s hand <span>${this.opponent.length} cards</span></h3><div class="mc-hand">${this.opponent.map(card => this.cardHTML(card, 'tamsin')).join('') || '<p class="mc-empty-hand">A quiet table.</p>'}</div></section></div>
        <p class="mc-status" id="${this.id}-status" data-focus="status" tabindex="-1">${this.finished ? `<strong>${score.you > score.tamsin ? 'The lanterns are yours.' : opponent + ' takes this hand.'}</strong>` : ''}${esc(this.message)}</p>
        <footer class="mc-footer"><p class="mc-prize">${this.rewardClaimed ? 'The ' + esc(this.rewardLabel) + ' have been received.' : 'First win: <b>' + esc(this.prizeLabel) + '</b>.'}<br>Use Tab and Enter, or select with the pointer.</p>${this.finished ? '<button type="button" class="mc-btn mc-primary" data-action="again" data-focus="again">Play again</button>' : '<span class="mc-turn-label">Nine cards · One winner</span>'}</footer></section>`;
      this.live.textContent = this.message;
      if (focus) this.view.querySelector(`[data-focus="${focus}"]`)?.focus({ preventScroll: true });
    }

    handleClick(event) {
      const button = event.target.closest('button[data-action]');
      if (!button || !this.root.contains(button) || button.disabled || this.closed) return;
      switch (button.dataset.action) {
        case 'close': this.destroy(); this.onClose(); break;
        case 'help': this.help = !this.help; this.lastCaptures = []; this.render('help'); break;
        case 'again': this.start(); break;
        case 'card': {
          if (this.turn !== 'you' || this.finished) return;
          this.selected = button.dataset.card; this.lastCaptures = [];
          const card = this.hand.find(item => item.id === this.selected);
          this.message = `${card.name} is ready. Choose an empty space. A + number shows its captures.`;
          this.render(`cell-${this.board.findIndex(slot => !slot)}`); break;
        }
        case 'place': this.play(Number(button.dataset.cell)); break;
      }
    }

    play(cell) {
      if (this.turn !== 'you' || this.finished || this.board[cell] || !this.selected) return;
      const index = this.hand.findIndex(card => card.id === this.selected);
      if (index < 0) return;
      const card = this.hand.splice(index, 1)[0], move = MorrowCards.simulate(this.board, cell, card, 'you');
      this.board = move.board; this.lastCaptures = move.captures; this.selected = null;
      if (this.finish()) return;
      this.turn = 'tamsin'; this.message = `${card.name} captures ${move.captures.length} ${move.captures.length === 1 ? 'card' : 'cards'}. ${this.opponentLabel} considers her hand.`;
      this.render('status');
      this.timer = setTimeout(() => {
        if (this.closed) return;
        const choice = MorrowCards.bestMove(this.board, this.opponent);
        if (!choice) return;
        const reply = this.opponent.splice(choice.cardIndex, 1)[0], result = MorrowCards.simulate(this.board, choice.cell, reply, 'tamsin');
        this.board = result.board; this.lastCaptures = result.captures;
        if (this.finish()) return;
        this.turn = 'you'; this.message = `${this.opponentLabel} plays ${reply.name} and captures ${result.captures.length} ${result.captures.length === 1 ? 'card' : 'cards'}. Choose your next card.`;
        this.render(`card-${this.hand[0].id}`);
      }, 420);
    }

    finish() {
      if (this.board.some(slot => !slot)) return false;
      this.finished = true; const count = this.board.filter(slot => slot.owner === 'you').length, win = count >= 5;
      const grant = win && !this.rewardClaimed;
      if (grant) this.rewardClaimed = true;
      this.message = win ? (grant ? `You win ${count}–${9-count}. ${this.opponentLabel} gives you the ${this.rewardLabel}. “A well-kept light.”` : `You win ${count}–${9-count}. “Another fine hand,” says ${this.opponentLabel}.`) : `${this.opponentLabel} wins ${9-count}–${count}. “There is always another evening.” You can try again.`;
      this.render('again');
      if (grant) this.onWin();
      return true;
    }

    handleKey(event) {
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.destroy(); this.onClose(); return; }
      if (event.key !== 'Tab') return;
      const items = [...this.view.querySelectorAll('button:not(:disabled)')];
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1], active = document.activeElement;
      if (event.shiftKey && (active === first || !items.includes(active))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (active === last || !items.includes(active))) { event.preventDefault(); first.focus(); }
    }

    destroy() {
      if (this.closed) return;
      this.closed = true; clearTimeout(this.timer);
      this.root.removeEventListener('click', this.clickHandler); this.root.removeEventListener('keydown', this.keyHandler); this.root.remove();
      if (this.previousFocus?.isConnected) this.previousFocus.focus({ preventScroll: true });
    }
  }
  MorrowCards.CARDS = Object.freeze({ player: PLAYER, opponent: OPPONENT });
  (typeof window !== 'undefined' ? window : globalThis).MorrowCards = MorrowCards;
})();
