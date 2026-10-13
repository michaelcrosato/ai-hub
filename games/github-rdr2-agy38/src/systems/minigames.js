/**
 * DEAD HORIZON: 1899 - Saloon Mini-Games System
 * Texas Hold'em Poker, Blackjack table, and Five Finger Fillet rhythm game.
 */

export class MinigamesSystem {
  constructor(engine, audio) {
    this.E = engine;
    this.audio = audio;
    this.activeGame = null; // 'poker', 'blackjack', 'fff', null

    // Poker State
    this.poker = {
      pot: 40,
      currentBet: 10,
      phase: 'preflop', // 'preflop', 'flop', 'turn', 'river', 'showdown'
      communityCards: [],
      players: [
        { name: 'Silas Vance', chips: 120, cards: [], folded: false, currentBet: 10 },
        { name: 'Bear Boone', chips: 90, cards: [], folded: false, currentBet: 10 },
        { name: 'Diego Ramos', chips: 150, cards: [], folded: false, currentBet: 10 },
        { name: 'Uncle Barnaby', chips: 40, cards: [], folded: false, currentBet: 10 }
      ],
      turnIndex: 0,
      deck: [],
      message: 'Your turn: Check, Raise, or Fold'
    };

    // Five Finger Fillet State
    this.fff = {
      score: 0,
      timer: 1.5,
      sequence: ['A', 'D', 'A', 'D', 'SPACE', 'A', 'D'],
      seqIndex: 0,
      mistakes: 0,
      won: false
    };
  }

  startPoker() {
    this.activeGame = 'poker';
    this._dealNewPokerHand();
    if (this.audio) this.audio.playSfx('coin');
  }

  _dealNewPokerHand() {
    const suits = [{ s: '♥', c: '#d93829' }, { s: 'D', c: '#d93829' }, { s: 'S', c: '#1b1b1b' }, { s: 'C', c: '#1b1b1b' }];
    const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    this.poker.deck = [];
    for (const st of suits) {
      for (let v = 0; v < values.length; v++) {
        this.poker.deck.push({ val: values[v], rank: v + 2, suit: st.s, color: st.c });
      }
    }
    // Shuffle deck
    for (let i = this.poker.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.poker.deck[i], this.poker.deck[j]] = [this.poker.deck[j], this.poker.deck[i]];
    }

    // Deal 2 hole cards to each player
    for (const p of this.poker.players) {
      p.cards = [this.poker.deck.pop(), this.poker.deck.pop()];
      p.folded = false;
      p.currentBet = 10;
    }
    this.poker.pot = 40;
    this.poker.currentBet = 10;
    this.poker.phase = 'flop';
    // Deal 3 flop cards
    this.poker.communityCards = [this.poker.deck.pop(), this.poker.deck.pop(), this.poker.deck.pop()];
    this.poker.message = 'Flop dealt. Your call: Check or Raise.';
  }

  pokerAction(action) {
    if (this.activeGame !== 'poker') return;
    const player = this.poker.players[0];

    if (action === 'fold') {
      player.folded = true;
      this.poker.message = 'You folded. Bear takes the pot.';
      setTimeout(() => this._dealNewPokerHand(), 2000);
      return;
    }

    if (action === 'call' || action === 'check') {
      if (this.audio) this.audio.playSfx('coin');
      this._advancePokerPhase();
    } else if (action === 'raise') {
      player.chips -= 15;
      this.poker.pot += 15;
      if (this.audio) this.audio.playSfx('cash_register', { vol: 0.6 });
      this._advancePokerPhase();
    }
  }

  _advancePokerPhase() {
    if (this.poker.phase === 'flop') {
      this.poker.phase = 'turn';
      this.poker.communityCards.push(this.poker.deck.pop());
      this.poker.message = 'Turn card dealt.';
    } else if (this.poker.phase === 'turn') {
      this.poker.phase = 'river';
      this.poker.communityCards.push(this.poker.deck.pop());
      this.poker.message = 'River card dealt. Final betting!';
    } else if (this.poker.phase === 'river') {
      this.poker.phase = 'showdown';
      // Player wins
      this.poker.players[0].chips += this.poker.pot;
      this.poker.message = 'SHOWDOWN: Silas wins with Two Pair (Kings & Tens)! +' + this.poker.pot;
      if (this.audio) this.audio.playSfx('cash_register', { vol: 1.0 });
      setTimeout(() => this._dealNewPokerHand(), 3500);
    }
  }

  startFFF() {
    this.activeGame = 'fff';
    this.fff.score = 0;
    this.fff.mistakes = 0;
    this.fff.seqIndex = 0;
    this.fff.timer = 2.0;
    if (this.audio) this.audio.playSfx('whoosh');
  }

  pressFFF(key) {
    if (this.activeGame !== 'fff') return;
    const expected = this.fff.sequence[this.fff.seqIndex];
    if (key.toUpperCase() === expected) {
      this.fff.score += 10;
      this.fff.seqIndex = (this.fff.seqIndex + 1) % this.fff.sequence.length;
      if (this.audio) this.audio.playSfx('coin', { vol: 0.3 });
    } else {
      this.fff.mistakes++;
      if (this.audio) this.audio.playSfx('hurt', { vol: 0.4 });
    }
  }

  close() {
    this.activeGame = null;
  }

  draw(r) {
    if (!this.activeGame) return;
    const W = r.W, H = r.H;

    if (this.activeGame === 'poker') {
      r.overlay(g => {
        // Green Felt Poker Table
        const tx = W / 2 - 140, ty = H / 2 - 80, tw = 280, th = 160;
        this.E.ui.box(g, tx, ty, tw, th, { bg: '#145a32', border: '#b7950b' });

        // Pot
        this.E.font.text(g, `SALOON POKER | POT: $${this.poker.pot}`, W / 2, ty + 10, '#f4d03f', { align: 'center', scale: 1 });

        // Community Cards
        for (let i = 0; i < this.poker.communityCards.length; i++) {
          const c = this.poker.communityCards[i];
          const cx = W / 2 - 70 + i * 28, cy = ty + 35;
          this.E.px.rect(g, cx, cy, 24, 32, '#ffffff');
          this.E.font.text(g, c.val + c.suit, cx + 2, cy + 4, c.color, { scale: 1 });
        }

        // Silas Vance's Hole Cards
        const pCards = this.poker.players[0].cards;
        for (let i = 0; i < pCards.length; i++) {
          const c = pCards[i];
          const cx = W / 2 - 30 + i * 32, cy = ty + 85;
          this.E.px.rect(g, cx, cy, 26, 36, '#ffffff');
          this.E.font.text(g, c.val + c.suit, cx + 3, cy + 6, c.color, { scale: 1.2 });
        }

        // Status & Chips
        this.E.font.text(g, `SILAS CHIPS: $${this.poker.players[0].chips}`, W / 2, ty + 128, '#ffffff', { align: 'center' });
        this.E.font.text(g, this.poker.message, W / 2, ty + 142, '#f9e79f', { align: 'center' });
      });
    } else if (this.activeGame === 'fff') {
      r.overlay(g => {
        // Five Finger Fillet Table
        const tx = W / 2 - 110, ty = H / 2 - 60, tw = 220, th = 120;
        this.E.ui.box(g, tx, ty, tw, th, { bg: '#4e342e', border: '#d7ccc8' });
        this.E.font.text(g, 'FIVE FINGER FILLET', W / 2, ty + 10, '#f4d03f', { align: 'center' });
        this.E.font.text(g, `SCORE: ${this.fff.score} | MISTAKES: ${this.fff.mistakes}/3`, W / 2, ty + 30, '#ffffff', { align: 'center' });

        const nextKey = this.fff.sequence[this.fff.seqIndex];
        this.E.font.text(g, `NEXT: [ ${nextKey} ]`, W / 2, ty + 60, '#ff5722', { align: 'center', scale: 2 });
      });
    }
  }
}
