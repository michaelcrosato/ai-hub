/**
 * DEAD HORIZON: 1899 - Campaign Orchestrator & Mission Runner
 * Manages story progression across all 153 missions, Chapter progression,
 * Mission Replay / Select browser, objective tracking, and gold medal challenges.
 */

import { MISSIONS } from '../data/missions.js';

export class MissionRunner {
  constructor(engine, audio, combat, world, law) {
    this.E = engine;
    this.audio = audio;
    this.combat = combat;
    this.world = world;
    this.law = law;

    this.allMissions = MISSIONS;
    this.activeMission = null;
    this.missionIndex = 0;
    this.completedMissions = new Set();
    this.goldMedals = new Set();

    // Mission Replay / Select Browser Modal
    this.browserOpen = false;
    this.browserChapterFilter = 'ALL'; // 'ALL', 'Ch1', 'Ch2', 'Ch3', 'Ch4', 'Ch5', 'Ch6', 'Epi1', 'Epi2', 'Stranger'
    this.browserSelectedIndex = 0;

    // In-mission gameplay state
    this.missionState = 'idle'; // 'intro', 'active', 'complete', 'failed'
    this.stateTimer = 0;
    this.objectiveCount = 0;
    this.objectiveTarget = 4;
    this.bannerAlpha = 1.0;
  }

  startMissionByIndex(idx) {
    if (idx < 0 || idx >= this.allMissions.length) return;
    this.missionIndex = idx;
    this.activeMission = this.allMissions[idx];
    this.missionState = 'intro';
    this.stateTimer = 4.5;
    this.objectiveCount = 0;
    this.browserOpen = false;

    // Configure appropriate region and weather for the mission
    const code = this.activeMission.code;
    if (code === 'Ch1') this.world.setRegion('colter_ridge');
    else if (code === 'Ch3') this.world.setRegion('scarlett_pines');
    else if (code === 'Ch4') this.world.setRegion('new_bordeaux');
    else if (code === 'Ch5') this.world.setRegion('new_bordeaux');
    else if (code === 'Ch6') this.world.setRegion('colter_ridge');
    else if (code === 'Epi1' || code === 'Epi2') this.world.setRegion('whispering_pines');
    else this.world.setRegion('buffalo_springs');

    // Spawn encounter enemies
    this.combat.enemies = [];
    const count = (this.activeMission.mechanic === 'shootout' || this.activeMission.mechanic === 'heist' ? 5 : 3);
    this.objectiveTarget = count;
    for (let i = 0; i < count; i++) {
      this.combat.spawnEnemy({
        name: (code === 'Ch1' ? 'Colter Outlaw' : (code === 'Ch4' ? 'Cesare Syndicate' : 'Blackstone Agent')),
        faction: 'colter',
        x: 220 + Math.random() * 120,
        y: 180 + Math.random() * 80,
        hp: 60
      });
    }

    if (this.audio) {
      this.audio.playSfx('cash_register', { vol: 0.7 });
      this.audio.playMusic('shootout');
    }
  }

  completeActiveMission() {
    if (!this.activeMission) return;
    this.missionState = 'complete';
    this.stateTimer = 5.0;
    this.completedMissions.add(this.activeMission.id);
    this.goldMedals.add(this.activeMission.id);

    // Apply rewards
    if (this.law) {
      this.law.changeHonor(this.activeMission.honor, this.activeMission.title);
    }
    if (this.audio) {
      this.audio.playSfx('cash_register', { vol: 1.0 });
      this.audio.playMusic('redemption');
    }
  }

  update(dt, player) {
    if (!this.activeMission) return;

    if (this.missionState === 'intro') {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        this.missionState = 'active';
      }
    } else if (this.missionState === 'active') {
      // Check if all spawned enemies in mission were defeated
      const remaining = this.combat.enemies.filter(e => !e.dead).length;
      this.objectiveCount = this.objectiveTarget - remaining;
      if (remaining === 0 && this.objectiveTarget > 0) {
        this.completeActiveMission();
      }
    } else if (this.missionState === 'complete') {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        // Return to free roam or next mission
        this.activeMission = null;
        this.missionState = 'idle';
        if (this.audio) this.audio.playMusic('exploration');
      }
    }
  }

  toggleBrowser() {
    this.browserOpen = !this.browserOpen;
    if (this.browserOpen) {
      this.browserSelectedIndex = 0;
      if (this.audio) this.audio.playSfx('lever_action');
    }
  }

  getFilteredMissions() {
    if (this.browserChapterFilter === 'ALL') return this.allMissions;
    return this.allMissions.filter(m => m.code === this.browserChapterFilter);
  }

  draw(r) {
    const W = r.W, H = r.H;

    // Draw Active Mission Title & Objective HUD
    if (this.activeMission) {
      r.overlay(g => {
        if (this.missionState === 'intro') {
          // Grand cinematic title banner
          this.E.ui.box(g, W / 2 - 130, H / 2 - 40, 260, 65, { bg: '#17110c', border: '#d4ac0d', alpha: 0.95 });
          this.E.font.text(g, this.activeMission.chapter.toUpperCase(), W / 2, H / 2 - 30, '#e59866', { align: 'center', scale: 0.9 });
          this.E.font.text(g, this.activeMission.title, W / 2, H / 2 - 14, '#ffffff', { align: 'center', scale: 1.2 });
          this.E.font.text(g, `"${this.activeMission.dialogue}"`, W / 2, H / 2 + 6, '#f9e79f', { align: 'center', scale: 0.9, wrap: 240 });
        } else if (this.missionState === 'active') {
          // Objective reminder box in top right
          this.E.ui.box(g, W - 145, 8, 140, 36, { bg: '#1c1510', border: '#a04000', alpha: 0.85 });
          this.E.font.text(g, this.activeMission.title, W - 140, 12, '#f5b041', { scale: 0.95 });
          this.E.font.text(g, `Objective: ${this.objectiveCount}/${this.objectiveTarget}`, W - 140, 24, '#ffffff', { scale: 0.9 });
        } else if (this.missionState === 'complete') {
          // Gold Medal Mission Complete Splash
          this.E.ui.box(g, W / 2 - 130, H / 2 - 45, 260, 75, { bg: '#16120e', border: '#f1c40f', alpha: 0.95 });
          this.E.font.text(g, '★ MISSION PASSED ★', W / 2, H / 2 - 35, '#f1c40f', { align: 'center', scale: 1.3 });
          this.E.font.text(g, this.activeMission.title, W / 2, H / 2 - 18, '#ffffff', { align: 'center', scale: 1.1 });
          this.E.font.text(g, `REWARD: +$${this.activeMission.reward} | HONOR: +${this.activeMission.honor}`, W / 2, H / 2 - 2, '#2ecc71', { align: 'center' });
          this.E.font.text(g, `UNLOCKED: ${this.activeMission.unlock}`, W / 2, H / 2 + 12, '#e67e22', { align: 'center', scale: 0.9 });
        }
      });
    }

    // Draw Mission Replay / Select Browser Modal
    if (this.browserOpen) {
      r.overlay(g => {
        const bw = 300, bh = 190;
        const bx = W / 2 - bw / 2, by = H / 2 - bh / 2;
        this.E.ui.box(g, bx, by, bw, bh, { bg: '#1c1510', border: '#b7950b' });

        // Header
        this.E.font.text(g, `COMPENDIUM: ALL 153 MISSIONS [${this.browserChapterFilter}]`, W / 2, by + 8, '#f4d03f', { align: 'center', scale: 1 });
        this.E.font.text(g, 'Filter: [1-9] Chapters/Strangers | [W/S] Select | [ENTER] Launch Mission', W / 2, by + 20, '#bdc3c7', { align: 'center', scale: 0.85 });

        // Mission List (shows 5 items centered on selection)
        const filtered = this.getFilteredMissions();
        const start = Math.max(0, Math.min(filtered.length - 5, this.browserSelectedIndex - 2));
        for (let i = 0; i < 5; i++) {
          const idx = start + i;
          if (idx >= filtered.length) break;
          const m = filtered[idx];
          const isSel = (idx === this.browserSelectedIndex);
          const rowY = by + 36 + i * 24;

          this.E.ui.box(g, bx + 10, rowY, bw - 20, 22, {
            bg: (isSel ? '#5e3818' : '#2c1e13'),
            border: (isSel ? '#f39c12' : '#4a3320')
          });

          const completedIcon = (this.completedMissions.has(m.id) ? '★' : '•');
          this.E.font.text(g, `${completedIcon} ${m.title}`, bx + 16, rowY + 3, (isSel ? '#ffffff' : '#f5cba7'), { scale: 0.95 });
          this.E.font.text(g, `Ref: ${m.sourceTitle}`, bx + 16, rowY + 12, '#95a5a6', { scale: 0.8 });
        }

        // Details of selected mission
        const sel = filtered[this.browserSelectedIndex];
        if (sel) {
          this.E.ui.box(g, bx + 10, by + 160, bw - 20, 22, { bg: '#16100b', border: '#784212' });
          this.E.font.text(g, `Giver: ${sel.giver} | Reward: $${sel.reward} | ${sel.location}`, bx + 14, by + 166, '#f9e79f', { scale: 0.85 });
        }
      });
    }
  }
}
