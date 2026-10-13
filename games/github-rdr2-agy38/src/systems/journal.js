/**
 * DEAD HORIZON: 1899 - Silas Vance's Leatherbound Journal
 * Hand-drawn sketches, personal outlaw reflections after missions,
 * compendium discoveries, and moral philosophizing.
 */

export class JournalSystem {
  constructor(engine, audio) {
    this.E = engine;
    this.audio = audio;
    this.isOpen = false;
    this.page = 0;

    this.pages = [
      {
        title: 'May 1899 - The Storm on the Mountain',
        date: 'May 4, 1899',
        sketch: 'mountain',
        text: 'The ferry job in Blackwater went bad. Worse than bad. People died who didn’t need to. Now we are up in these mountains, freezing, starving, listening to the wind howl like a dying dog. Julian says we just need faith. I’ve had faith in him for twenty years. But faith don’t keep the cold out of your bones.'
      },
      {
        title: 'Horseshoe Overlook & Buffalo Springs',
        date: 'May 16, 1899',
        sketch: 'deer',
        text: 'Came down from the peaks. The plains are green and sweet. Camp is set on a bluff overlooking the river. Took Finch hunting for that big grizzly bear. Bear almost took my arm off, but we made it back. Town below is full of mud, livestock, and men looking for trouble. Found plenty of both.'
      },
      {
        title: 'The Sickness in the Air',
        date: 'June 2, 1899',
        sketch: 'skull',
        text: 'Went to collect from that farmer Downes for Herr Richter. Man was half dead already. Coughed right across my face. I beat him for a few paper dollars. Felt dirty doing it. My chest has had a rattle ever since. Don’t like the way Richter smiles when the money comes in.'
      },
      {
        title: 'Scarlett Pines & The Red Dirt',
        date: 'June 28, 1899',
        sketch: 'manor',
        text: 'Julian thinks he can play these two planter families against each other. Blackwoods on one side, Galloways on the other. It’s foolish. They’ve owned this soil for a hundred years. You can’t con men who’ve spent their whole lives cheating everyone else. Foley took a bullet in the street. I won’t forget it.'
      },
      {
        title: 'New Bordeaux & The Gilded Cage',
        date: 'July 14, 1899',
        sketch: 'trolley',
        text: 'This city stinks of coal smoke, machine oil, and greed. Electric wires humming above the street like angry bees. Don Cesare lives like a king in a marble house while children starve on the docks. We thought we were outlaws. The real outlaws have law books and bank vaults.'
      },
      {
        title: 'Final Reflections upon the Ridge',
        date: 'October 1899',
        sketch: 'stag',
        text: 'The doctor gave me the verdict. Tuberculosis. My time is short now. But looking at Jack, Alma, and the boy... maybe my life wasn’t all wasted. If I can help them get free, get clear of Julian’s madness, then maybe that’s my redemption. May I stand unbroken amidst a crashing world.'
      }
    ];
  }

  toggle() {
    this.isOpen = !this.isOpen;
    if (this.audio) this.audio.playSfx('lever_action', { vol: 0.3 });
  }

  nextPage() {
    if (this.page < this.pages.length - 1) {
      this.page++;
      if (this.audio) this.audio.playSfx('whoosh', { vol: 0.3 });
    }
  }

  prevPage() {
    if (this.page > 0) {
      this.page--;
      if (this.audio) this.audio.playSfx('whoosh', { vol: 0.3 });
    }
  }

  draw(r) {
    if (!this.isOpen) return;
    const W = r.W, H = r.H;

    r.overlay(g => {
      // Leather Notebook Outer Border
      const jw = 290, jh = 180;
      const jx = W / 2 - jw / 2, jy = H / 2 - jh / 2;
      this.E.ui.box(g, jx, jy, jw, jh, { bg: '#4a3222', border: '#2b1a10' });

      // Stitched Parchment Open Pages (Left & Right)
      const pw = (jw - 20) / 2, ph = jh - 16;
      this.E.px.rect(g, jx + 8, jy + 8, pw, ph, '#f5eeda');
      this.E.px.rect(g, jx + 12 + pw, jy + 8, pw, ph, '#ede4cc');

      // Center spine binding line
      this.E.px.line(g, jx + 10 + pw, jy + 6, jx + 10 + pw, jy + jh - 6, '#311b0e', 2);

      const cur = this.pages[this.page];

      // Left Page: Title & Hand-Drawn Sketch
      this.E.font.text(g, cur.title, jx + 14, jy + 16, '#2a1a10', { scale: 1, wrap: pw - 12 });
      this.E.font.text(g, cur.date, jx + 14, jy + 32, '#875d3d', { scale: 0.9 });

      // Draw Pixel Sketch on left page
      const skX = jx + 14 + pw / 2 - 20, skY = jy + 65;
      if (cur.sketch === 'stag' || cur.sketch === 'deer') {
        // Majestic Stag sketch
        this.E.px.ell(g, skX + 18, skY + 24, 14, 8, '#5d4037');
        this.E.px.disc(g, skX + 28, skY + 14, 5, '#4e342e');
        // Antlers
        this.E.px.line(g, skX + 28, skY + 12, skX + 22, skY + 2, '#3e2723', 1);
        this.E.px.line(g, skX + 28, skY + 12, skX + 34, skY + 2, '#3e2723', 1);
        this.E.px.line(g, skX + 24, skY + 6, skX + 18, skY + 6, '#3e2723', 1);
      } else if (cur.sketch === 'mountain') {
        // Mountain Peaks sketch
        this.E.px.poly(g, [[skX, skY + 40], [skX + 20, skY + 8], [skX + 40, skY + 40]], '#5d4037');
        this.E.px.poly(g, [[skX + 15, skY + 40], [skX + 32, skY + 14], [skX + 50, skY + 40]], '#795548');
        this.E.px.poly(g, [[skX + 16, skY + 16], [skX + 20, skY + 8], [skX + 24, skY + 16]], '#ffffff'); // snow cap
      } else {
        this.E.px.rect(g, skX + 4, skY + 10, 36, 24, '#5d4037');
      }

      // Right Page: Written Diary Entry
      this.E.font.text(g, cur.text, jx + 18 + pw, jy + 18, '#1b120c', {
        scale: 0.95,
        wrap: pw - 14
      });

      // Page Navigation Indicator
      this.E.font.text(g, `[A] PREV  PAGE ${this.page + 1}/${this.pages.length}  [D] NEXT`, W / 2, jy + jh - 12, '#ffffff', {
        align: 'center',
        scale: 0.9
      });
    });
  }
}
