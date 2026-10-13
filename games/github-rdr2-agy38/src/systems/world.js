/**
 * DEAD HORIZON: 1899 - Multi-Region Frontier World & Atmosphere
 * Generates towns (Buffalo Springs, Scarlett Pines, New Bordeaux, Colter, Whispering Pines),
 * animated train routes, Day/Night lighting cycle, and weather particles.
 */

export class FrontierWorld {
  constructor(engine, game) {
    this.E = engine;
    this.game = game;
    this.timeOfDay = 0.35; // 0.0 = midnight, 0.25 = dawn, 0.5 = noon, 0.75 = dusk
    this.daySpeed = 0.004; // 1 full day every ~4 minutes
    this.weather = 'clear'; // 'clear', 'rain', 'fog', 'blizzard'
    this.activeRegion = 'buffalo_springs';

    // Steam train locomotive on tracks
    this.trainPos = 120;
    this.trainSpeed = 35;
    this.trainLoco = new this.E.TrainLocomotive();

    // Weather particles
    this.weatherParticles = [];
    for (let i = 0; i < 90; i++) {
      this.weatherParticles.push({
        x: Math.random() * 400,
        y: Math.random() * 300,
        z: Math.random() * 120 + 20,
        vz: -160 - Math.random() * 80
      });
    }

    // Interactive POIs (Points of Interest)
    this.locations = [
      { id: 'saloon', name: 'Smithfield Saloon', region: 'buffalo_springs', x: 260, y: 190, w: 48, h: 36, type: 'building' },
      { id: 'sheriff', name: 'Sheriff & Jail', region: 'buffalo_springs', x: 330, y: 190, w: 36, h: 32, type: 'building' },
      { id: 'store', name: 'General Store', region: 'buffalo_springs', x: 200, y: 190, w: 40, h: 32, type: 'building' },
      { id: 'camp', name: 'Horseshoe Overlook Camp', region: 'buffalo_springs', x: 120, y: 320, w: 60, h: 60, type: 'camp' },
      { id: 'station', name: 'Train Depot & Post Office', region: 'buffalo_springs', x: 280, y: 100, w: 50, h: 30, type: 'building' },
      { id: 'rhodes_manor', name: 'Blackwood Plantation', region: 'scarlett_pines', x: 300, y: 220, w: 60, h: 48, type: 'building' },
      { id: 'saint_denis_bank', name: 'New Bordeaux National Bank', region: 'new_bordeaux', x: 250, y: 200, w: 56, h: 44, type: 'building' },
      { id: 'colter_mine', name: 'Colter Mining Cabin', region: 'colter_ridge', x: 220, y: 210, w: 44, h: 36, type: 'cabin' },
      { id: 'ranch_house', name: 'Whispering Pines Ranch House', region: 'whispering_pines', x: 240, y: 230, w: 52, h: 40, type: 'ranch' }
    ];

    this._initTileMap();
  }

  _initTileMap() {
    // 24x20 TileMap with roads, boardwalks, buildings, and train tracks
    const rows = [
      'TTTTTTTTTTTTTTTTTTTTTTTT',
      'T......................T',
      'T.....1111..2222..3333.T',
      'T.....1111..2222..3333.T',
      'T=====................=T',
      'T======================T',
      'T......................T',
      'T.....4444..5555.......T',
      'T.....4444..5555.......T',
      'T......................T',
      'T~~..................~~T',
      'T~~~................~~~T',
      'T~~~~..............~~~~T',
      'T..~~..............~~..T',
      'T......................T',
      'T......6666............T',
      'T......6666............T',
      'T......................T',
      'T......................T',
      'TTTTTTTTTTTTTTTTTTTTTTTT'
    ];

    const legend = {
      'T': 1, // Perimeter trees / rocks
      '=': 2, // Railroad tracks
      '1': 3, // Saloon
      '2': 4, // Sheriff
      '3': 5, // General store
      '4': 6, // Stables
      '5': 7, // Doctor
      '6': 8, // Camp tents
      '~': { floor: 'water', block: false },
      '.': 0
    };

    const types = {
      1: { h: 36, top: '#2c3e2d', side: '#1a291b' }, // Forest border
      2: { h: 2, top: '#564d42', side: '#322c24' },  // Train track ties
      3: { h: 38, top: '#7d5236', side: '#4e3321' }, // Saloon
      4: { h: 32, top: '#5d6d7e', side: '#34495e' }, // Sheriff
      5: { h: 30, top: '#a04000', side: '#6e2c00' }, // Store
      6: { h: 26, top: '#6e472e', side: '#452b1b' }, // Stables
      7: { h: 28, top: '#d4ac0d', side: '#9a7d0a' }, // Doctor
      8: { h: 20, top: '#d5d8dc', side: '#a6acaf' }  // White canvas tents
    };

    this.map = new this.E.TileMap({
      rows,
      legend,
      types,
      floorTex: (x, y, tag) => {
        if (tag === 'water') return [45, 95, 140];
        // Muddy frontier earth vs grass
        if (this.activeRegion === 'colter_ridge') return [225, 230, 238]; // Snow
        if (this.activeRegion === 'scarlett_pines') return [160, 68, 48]; // Red Georgia clay
        if (this.activeRegion === 'new_bordeaux') return [75, 78, 82];    // Cobblestones
        return this.E.tex.dirt(x, y, { base: '#705335', dark: '#523c26', light: '#8c6943' });
      }
    });
  }

  setRegion(regionId) {
    this.activeRegion = regionId;
    if (regionId === 'colter_ridge') this.weather = 'blizzard';
    else if (regionId === 'new_bordeaux') this.weather = 'fog';
    else this.weather = 'clear';
    this._initTileMap();
  }

  update(dt) {
    // Advance day/night cycle
    this.timeOfDay = (this.timeOfDay + this.daySpeed * dt) % 1.0;

    // Advance train along tracks
    this.trainPos = (this.trainPos + this.trainSpeed * dt) % 360;
    this.trainLoco.update(dt, { speed: this.trainSpeed });

    // Weather particles
    if (this.weather === 'rain' || this.weather === 'blizzard') {
      const isSnow = (this.weather === 'blizzard');
      for (const p of this.weatherParticles) {
        p.z += (isSnow ? p.vz * 0.4 : p.vz) * dt;
        p.x += (isSnow ? Math.sin(p.z * 0.1) * 30 : -20) * dt;
        if (p.z <= 0) {
          p.z = 120 + Math.random() * 40;
          p.x = Math.random() * 400;
          p.y = Math.random() * 300;
        }
      }
    }
  }

  getSkyColors() {
    // Dynamic sky palette based on timeOfDay
    const t = this.timeOfDay;
    if (t >= 0.2 && t < 0.3) {
      // Dawn (Soft rose and amber gold)
      return ['#2d1b4e', '#c85a4a', '#f5b041'];
    } else if (t >= 0.3 && t < 0.7) {
      // Day (Crisp frontier sky blue)
      return ['#3498db', '#85c1e9', '#d4e6f1'];
    } else if (t >= 0.7 && t < 0.8) {
      // Golden Sunset / Dusk (Fiery crimson and orange)
      return ['#4a235a', '#b03a2e', '#e67e22'];
    } else {
      // Night (Deep indigo starfield with moonlight)
      return ['#0b0c10', '#151922', '#1f2839'];
    }
  }

  draw(r) {
    // Sky
    r.sky(this.getSkyColors());

    // Stars at night
    if (this.timeOfDay < 0.25 || this.timeOfDay > 0.75) {
      r.starfield({ count: 90, speed: 8, dir: 'left' });
    }

    // Floor and walls
    this.map.drawFloor(r);
    this.map.queueWalls(r);

    // Draw steam train on tracks (y = 80)
    r.actor(this.trainPos, 80, 2, (g, ox, oy) => {
      this.trainLoco.draw(g, ox, oy, r.view);
    });

    // Town Building Signboards
    for (const loc of this.locations) {
      if (loc.region === this.activeRegion) {
        const [sx, sy] = r.w(loc.x + loc.w / 2, loc.y + loc.h / 2, 28);
        if (r.visible(loc.x, loc.y, 28) && !(sy > r.H - 55 && sx < 115)) {
          r.overlay(g => {
            this.E.font.text(g, loc.name.toUpperCase(), sx, sy, '#f4d03f', {
              outline: '#151515',
              scale: 0.9,
              align: 'center'
            });
          });
        }
      }
    }

    // Weather overlay (Rain / Snow)
    if (this.weather === 'rain' || this.weather === 'blizzard') {
      const isSnow = (this.weather === 'blizzard');
      r.overlay(g => {
        for (const p of this.weatherParticles) {
          const [sx, sy] = r.w(p.x, p.y, p.z);
          if (sx >= 0 && sx <= r.W && sy >= 0 && sy <= r.H) {
            if (isSnow) {
              this.E.px.disc(g, sx, sy, 1.5, 'rgba(255,255,255,0.85)');
            } else {
              this.E.px.line(g, sx, sy, sx - 2, sy + 6, 'rgba(160,200,240,0.6)', 1);
            }
          }
        }
      });
    }
  }
}
