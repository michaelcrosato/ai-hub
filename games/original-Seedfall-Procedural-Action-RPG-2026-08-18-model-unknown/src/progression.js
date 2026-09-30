export class Progression {
  constructor(e, t) {
    this.player = e;
    this.events = t;
  }
  player;
  events;
  grantXp(e, t) {
    if (!(e <= 0)) {
      this.player.progress.xp += Math.round(e);
      if (t) {
        this.events.emit("toast", {
          title: `+${Math.round(e)} XP`,
          detail: t,
          tone: "good",
        });
      }
      while (this.player.progress.xp >= this.player.progress.xpToNext) {
        this.player.progress.xp -= this.player.progress.xpToNext;
        this.player.progress.level += 1;
        this.player.progress.xpToNext = Math.round(90 + Math.pow(this.player.progress.level, 1.35) * 55);
        this.player.progress.skillPoints += 1;
        this.player.progress.attributePoints += 2;
        this.player.refreshVitals(true);
        this.events.emit("levelUp", {
          level: this.player.progress.level,
        });
        this.events.emit("toast", {
          title: `Level ${this.player.progress.level}`,
          detail: "+1 skill point, +2 attribute points",
          tone: "rare",
        });
      }
      this.events.emit("playerChanged", undefined);
    }
  }
  grantGold(e) {
    this.player.progress.gold = Math.max(0, this.player.progress.gold + Math.round(e));
    this.events.emit("playerChanged", undefined);
  }
  addReputation(e, t) {
    this.player.progress.reputation[e] = (this.player.progress.reputation[e] ?? 0) + t;
    this.events.emit("playerChanged", undefined);
  }
  applyDeathPenalty() {
    let e = Math.min(this.player.progress.gold, Math.max(5, Math.floor(this.player.progress.gold * 0.08)));
    this.player.progress.gold -= e;
    this.events.emit("playerChanged", undefined);
    return e;
  }
}
