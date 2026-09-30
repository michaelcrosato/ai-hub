/**
 * host.js — Iona Quade, the Signal Nine host. Turns game events into
 * prioritised commentary cues (captions, portrait, optional speech through
 * the browser's speechSynthesis), remembers the player across runs in
 * localStorage, and reveals the story archive a transmission at a time.
 */

import {
  SPONSORS,
  CAMPAIGN_LINES,
  LINES,
  ROOM_LINES,
  STYLE_LINES,
  UPGRADE_LINES,
  SPONSOR_LINES,
  STORY,
  PRIZE_LINES,
  PRIZE_CLEAR_LINES,
  OVERTIME_LINES,
  dossierFor,
  chapterFor,
} from "./lines.js";

const PROFILE_KEY = "neon-gauntlet-iona-memory-v3";
const LEGACY_PROFILE_KEY = "neon-gauntlet-iona-memory-v2";
const HISTORY_LIMIT = 36;
const QUEUE_LIMIT = 4;
const SPONSOR_IDS = Object.keys(SPONSORS);

export const STYLE_NAMES = {
  unread: "PATTERN UNRESOLVED",
  vanguard: "VANGUARD",
  survivor: "SURVIVOR",
  demolition: "DEMOLITION",
  ghost: "GHOST",
  specialist: "SPECIALIST",
  tactician: "TACTICIAN",
};

const PROFILE_DEFAULT = {
  runs: 0,
  wins: 0,
  losses: 0,
  lifetimeKills: 0,
  bestCombo: 0,
  trust: 8,
  storyCursor: 0,
  style: "unread",
  lastScore: 0,
  consecutiveLosses: 0,
  archiveBreach: false,
};

function freshRun() {
  return {
    kills: 0,
    maxCombo: 0,
    dashes: 0,
    bombs: 0,
    damage: 0,
    criticalEntries: 0,
    recoveries: 0,
    pickups: 0,
    upgrades: [],
    weaponKills: {},
    storyBeats: 0,
    selectedRooms: [],
    highRiskRoutes: 0,
  };
}

export function emptySnapshot() {
  return {
    line: null,
    speaking: false,
    emotion: "idle",
    history: [],
    profile: { ...PROFILE_DEFAULT },
    chapter: chapterFor(0),
    sponsor: null,
    dossier: dossierFor(0),
    voiceStatus: "loading",
  };
}

/** How long a caption stays up: roughly reading speed, 2.4–7.6 s. */
const captionMs = (text) => Math.max(2400, Math.min(7600, text.trim().split(/\s+/).length * 345 + 950));

/** Does a cue of this detail level play at the player's call frequency? */
const allowedAt = (frequency, detail) =>
  detail === "core" ? true : detail === "balanced" ? frequency !== "minimal" : frequency === "full";

/** The pattern Iona files a finished run under. */
function styleForResult(result) {
  if (result.bombsUsed >= 2) return "demolition";
  if (result.damageTaken >= 70) return "survivor";
  if (result.dashesUsed >= 11 && result.damageTaken <= 45) return "ghost";
  if (result.kills >= 48 || result.maxCombo >= 20) return "vanguard";
  if (result.favoriteWeapon !== "PULSE-9" && result.kills >= 15) return "specialist";
  if (result.kills >= 10) return "tactician";
  return "unread";
}

/** The pattern of the run so far (mid-run reads). */
function styleForRun(run, elapsed) {
  if (run.bombs >= 1) return "demolition";
  if (run.damage >= 58 || run.criticalEntries > 0) return "survivor";
  if (run.dashes >= 7 && run.damage <= 25) return "ghost";
  if (run.kills >= Math.max(12, elapsed * 0.55) || run.maxCombo >= 14) return "vanguard";
  if (Object.entries(run.weaponKills).some(([weapon, kills]) => weapon !== "PULSE-9" && kills >= 7)) return "specialist";
  if (run.kills >= 8) return "tactician";
  return "unread";
}

const patternLabel = (style) =>
  ({
    unread: "PATTERN UNRESOLVED",
    vanguard: "VANGUARD PATTERN",
    survivor: "SURVIVOR PATTERN",
    demolition: "DEMOLITION PATTERN",
    ghost: "GHOST PATTERN",
    specialist: "SPECIALIST PATTERN",
    tactician: "TACTICIAN PATTERN",
  })[style];

const pad2 = (n) => String(n).padStart(2, "0");

export class IonaHost {
  /**
   * @param {(snapshot) => void} onSnapshot  called whenever what the host shows changes
   * @param {object} settings  { voice, captions, portrait, frequency, volume }
   * @param {(speaking: boolean) => void} onSpeechState  duck the effects while she talks
   */
  constructor(onSnapshot, settings, onSpeechState) {
    this.run = freshRun();
    this.activeCue = null;
    this.currentPriority = 0;
    this.queue = [];
    this.generation = 0;
    this.instanceSequence = 0;
    this.clearTimer = 0;
    this.nextTimer = 0;
    this.recentIds = [];
    this.voices = [];
    this.currentSponsorSlot = 0;
    this.storyRevealedThisRun = false;
    this.breachUnlockedThisResult = false;
    this.roomPreferences = {};
    this.disposed = false;
    this.suspended = false;
    this.onSnapshot = onSnapshot;
    this.onSpeechState = onSpeechState;
    this.settings = settings;

    this.refreshVoices = () => {
      if (!("speechSynthesis" in window)) {
        this.voices = [];
        if (this.snapshot) this.publish({ voiceStatus: "unavailable" });
        return;
      }
      this.voices = window.speechSynthesis.getVoices();
      if (this.snapshot) this.publish({ voiceStatus: "ready" });
    };
    this.onVisibilityChange = () => {
      this.suspended = document.hidden;
      if (this.suspended) {
        this.queue = this.queue.filter((entry) => entry.cue.detail === "core");
        this.interruptActive(true);
      } else {
        this.startNext();
      }
    };

    this.profile = this.loadProfile();
    this.snapshot = {
      ...emptySnapshot(),
      profile: { ...this.profile },
      chapter: chapterFor(this.profile.storyCursor),
      dossier: dossierFor(this.profile.storyCursor),
      voiceStatus: "speechSynthesis" in window ? "ready" : "unavailable",
    };
    this.onSnapshot(this.snapshot);
    this.refreshVoices();
    window.speechSynthesis?.addEventListener?.("voiceschanged", this.refreshVoices);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
  }

  setSettings(settings) {
    const hadVoice = this.settings.voice;
    this.settings = settings;
    if (hadVoice && !settings.voice) this.stopSpeech();
  }

  /** Feed one game event (see engine.js broadcast()). */
  handle(event) {
    if (this.disposed) return;
    this.reduceEvent(event);
    if (event.type === "run_result") {
      this.handleResult(event.result);
      return;
    }
    if (event.type === "upgrade_selected") {
      this.handleUpgradeSelected(event.id, event.name);
      return;
    }
    const cue = this.cueForEvent(event);
    if (cue) this.submit(cue);
  }

  preview() {
    this.submit(
      {
        key: "preview",
        label: "VOICE CHECK // IONA QUADE",
        priority: 100,
        ttlMs: 0,
        detail: "core",
        policy: "replace",
        variants: LINES.preview,
      },
      true,
    );
  }

  replayLast() {
    const last = this.snapshot.history.at(-1);
    if (!last) {
      this.preview();
      return;
    }
    this.submit(
      {
        key: `replay:${last.instanceId}`,
        label: `REPLAY // ${last.label}`,
        priority: 100,
        ttlMs: 0,
        detail: "core",
        policy: "replace",
        variants: [
          { id: last.id, text: last.text, emotion: last.emotion, speaker: last.speaker, kind: last.kind, sponsorId: last.sponsorId },
        ],
      },
      true,
    );
  }

  resetMemory() {
    this.profile = { ...PROFILE_DEFAULT };
    this.roomPreferences = {};
    this.run = freshRun();
    this.storyRevealedThisRun = false;
    this.queue = [];
    try {
      localStorage.removeItem(LEGACY_PROFILE_KEY);
    } catch {
      /* ignore */
    }
    this.persistProfile();
    this.publish({ sponsor: null });
    this.submit(
      {
        key: "memory-reset",
        label: "SIGNAL NINE // ARCHIVE RESET",
        priority: 100,
        ttlMs: 0,
        detail: "core",
        policy: "replace",
        variants: [
          {
            id: "iona.v2.memory.reset.01",
            text: "Private archive cleared. The Network calls that a beginning. We can too.",
            emotion: "recap",
            kind: "system",
          },
        ],
      },
      true,
    );
  }

  /** Keep the run and profile statistics that the reads and the archive use. */
  reduceEvent(event) {
    switch (event.type) {
      case "run_start":
        this.run = freshRun();
        this.storyRevealedThisRun = false;
        this.breachUnlockedThisResult = false;
        this.profile = { ...this.profile, runs: this.profile.runs + 1 };
        this.currentSponsorSlot = 0;
        this.persistProfile();
        this.publish({ sponsor: null });
        break;
      case "enemy_defeated":
        this.run.kills = event.kills;
        this.run.maxCombo = Math.max(this.run.maxCombo, event.combo);
        this.run.weaponKills[event.weapon] = (this.run.weaponKills[event.weapon] ?? 0) + 1;
        break;
      case "dash_used":
        this.run.dashes += 1;
        break;
      case "combo_milestone":
        this.run.maxCombo = Math.max(this.run.maxCombo, event.combo);
        break;
      case "player_hurt":
        this.run.damage += event.damage;
        break;
      case "critical_health":
        this.run.criticalEntries += 1;
        break;
      case "health_recovered":
        this.run.recoveries += 1;
        break;
      case "bomb_used":
        this.run.bombs += 1;
        break;
      case "pickup_collected":
        this.run.pickups += 1;
        break;
      case "upgrade_selected":
        this.run.upgrades.push(event.id);
        break;
      case "room_selected":
        this.run.selectedRooms.push(event.choice.kind);
        if (event.choice.risk === "HIGH" || event.choice.risk === "EXTREME") this.run.highRiskRoutes += 1;
        this.roomPreferences[event.choice.kind] = (this.roomPreferences[event.choice.kind] ?? 0) + 1;
        this.persistProfile();
        break;
      case "upgrade_break": {
        this.currentSponsorSlot = event.slot;
        const index = (this.profile.runs * 2 + event.slot - 1) % SPONSOR_IDS.length;
        this.publish({ sponsor: SPONSORS[SPONSOR_IDS[index]] });
        break;
      }
      case "broadcast_beat":
        this.run.storyBeats += 1;
        break;
      case "run_result": {
        const result = event.result;
        const style = styleForResult(result);
        const victory = result.victory;
        const wins = this.profile.wins + Number(victory);
        // Overtime always ends with the signal lost; it is a score attack, not a defeat on record.
        const counted = !result.overtime;
        this.breachUnlockedThisResult = !this.profile.archiveBreach && wins >= 3;
        this.profile = {
          ...this.profile,
          wins,
          losses: this.profile.losses + Number(counted && !victory),
          lifetimeKills: this.profile.lifetimeKills + result.kills,
          bestCombo: Math.max(this.profile.bestCombo, result.maxCombo),
          trust: Math.min(100, this.profile.trust + (victory ? 7 : 2) + Number(result.maxCombo >= 20) * 2),
          style,
          lastScore: result.score,
          consecutiveLosses: victory || !counted ? (counted ? 0 : this.profile.consecutiveLosses) : this.profile.consecutiveLosses + 1,
          archiveBreach: this.profile.archiveBreach || wins >= 3,
        };
        this.persistProfile();
        this.publish({});
        break;
      }
      default:
        break;
    }
  }

  cueForEvent(event) {
    switch (event.type) {
      case "system_ready": {
        const gpu = event.backend === "webgpu";
        return {
          key: `system:${gpu ? "webgpu" : "compat"}`,
          label: gpu ? "SIGNAL NINE // LIVE" : "SIGNAL NINE // COMPAT FEED",
          priority: 58,
          ttlMs: 4500,
          detail: "balanced",
          policy: "drop",
          variants: LINES[gpu ? "system_webgpu" : "system_compat"],
          captionOnly: true,
        };
      }
      case "run_start": {
        if (event.overtime)
          return {
            key: "overtime:start",
            label: "OVERTIME // THE FEED KEEPS RUNNING",
            priority: 100,
            ttlMs: 0,
            detail: "core",
            policy: "hard",
            variants: OVERTIME_LINES.start,
          };
        if (event.level > 1)
          return {
            key: `campaign:start:${event.level}`,
            label: `LEVEL ${pad2(event.level)} // ${event.levelName}`,
            priority: 100,
            ttlMs: 0,
            detail: "core",
            policy: "hard",
            variants: CAMPAIGN_LINES[event.level].start,
          };
        if (this.profile.storyCursor === 0) return this.storyCue("OFF SCRIPT // FIRST TRANSMISSION", "replace");
        const variants =
          this.profile.consecutiveLosses >= 2
            ? LINES.run_return_streak
            : this.profile.runs > 1 && this.profile.wins > 0
              ? LINES.run_return_win
              : this.profile.runs > 1
                ? LINES.run_return_loss
                : LINES.run_start;
        return {
          key: "run:start",
          label: this.profile.runs > 1 ? `RETURNING SIGNAL // RUN ${pad2(this.profile.runs)}` : "OPENING CALL",
          priority: 94,
          ttlMs: 4000,
          detail: "core",
          policy: "replace",
          variants,
        };
      }
      case "level_started":
        return {
          key: `campaign:continue:${event.level}`,
          label: `LEVEL ${pad2(event.level)} // ${event.levelName}`,
          priority: 100,
          ttlMs: 0,
          detail: "core",
          policy: "hard",
          variants: CAMPAIGN_LINES[event.level].start,
        };
      case "level_complete":
        return {
          key: `campaign:clear:${event.level}`,
          label: event.nextLevel
            ? `LEVEL ${pad2(event.level)} CLEAR // NEXT GATE OPEN`
            : "FORECAST PRIME DOWN // RETURN DOOR OPEN",
          priority: 99,
          ttlMs: 0,
          detail: "core",
          policy: "hard",
          variants: CAMPAIGN_LINES[event.level].clear,
        };
      case "final_exit_open":
        return {
          key: "campaign:final-exit",
          label: "SIGNAL NINE // PHYSICAL EXIT RESTORED",
          priority: 100,
          ttlMs: 0,
          detail: "core",
          policy: "hard",
          variants: [
            {
              id: "iona.v2.campaign.final.exit.01",
              text: "Turn around. The door they trained you to ignore is open. Cross it, and make this a rescue instead of a victory lap.",
              emotion: "concerned",
              kind: "story",
            },
          ],
        };
      case "pause":
        return {
          key: "system:pause",
          label: "FEED HELD",
          priority: 42,
          ttlMs: 2500,
          detail: "full",
          policy: "drop",
          variants: LINES.pause,
          captionOnly: true,
        };
      case "resume":
        return {
          key: "system:resume",
          label: "BACK ON AIR",
          priority: 44,
          ttlMs: 1800,
          detail: "full",
          policy: "drop",
          variants: LINES.resume,
          captionOnly: true,
        };
      case "return_to_menu":
        return {
          key: "menu:return",
          label: "READY ROOM // PRIVATE ARCHIVE",
          priority: 70,
          ttlMs: 8000,
          detail: "balanced",
          policy: "queue",
          variants: LINES.menu,
        };
      case "route_offered": {
        const first = event.choices[0];
        if (first?.destination === "nextLevel" || first?.destination === "campaignExit") return null;
        const bossGate = event.choices.length === 1 && first?.destination === "boss";
        if (event.overtime) {
          const milestone = event.fromRoom % 10 === 0;
          return {
            key: `overtime:wave:${event.fromRoom}`,
            label: bossGate
              ? `OVERTIME // ENCORE GUEST // ${first.danger}`
              : `OVERTIME // WAVE ${pad2(event.fromRoom)} CLEARED`,
            priority: milestone || bossGate ? 92 : 80,
            ttlMs: 0,
            detail: milestone || bossGate ? "core" : "balanced",
            policy: "replace",
            variants: bossGate ? OVERTIME_LINES.boss : milestone ? OVERTIME_LINES.milestone : OVERTIME_LINES.wave,
          };
        }
        const offers =
          event.choices.length === 2
            ? LINES.route_offer.filter((line) => !line.text.startsWith("Three doors"))
            : LINES.route_offer.filter((line) => !line.text.startsWith("Two doors"));
        return {
          key: `route:offer:${event.fromRoom}`,
          label: bossGate
            ? `FINAL THRESHOLD // ${first.danger}`
            : event.fromRoom === 1
              ? "THE ROUTE OPENS // PICK YOUR PRICE"
              : `ROUTE BOARD // AFTER ROOM ${pad2(event.fromRoom)}`,
          priority: event.fromRoom === 1 ? 100 : bossGate ? 94 : 88,
          ttlMs: 0,
          detail: "core",
          policy: event.fromRoom === 1 ? "hard" : "replace",
          variants: event.fromRoom === 1 ? LINES.route_first : bossGate ? CAMPAIGN_LINES[first.level].bossIntro : offers,
        };
      }
      case "room_started": {
        const room = event.room;
        if (room.kind === "opening") return null;
        if (room.kind === "prize")
          return {
            key: `room:start:${room.id}`,
            label: `${room.name} // BONUS ROUND`,
            priority: 90,
            ttlMs: 9000,
            detail: "core",
            policy: "replace",
            variants: PRIZE_LINES,
          };
        const visits = this.roomPreferences[room.kind] ?? 0;
        const variants =
          room.level > 1
            ? CAMPAIGN_LINES[room.level].room
            : visits >= 3
              ? LINES.route_repeat.map((line) => ({
                  ...line,
                  id: `${line.id}.${room.kind}`,
                  text: line.text.replaceAll("%ROOM%", room.name),
                }))
              : ROOM_LINES[room.kind];
        return {
          key: `room:start:${room.id}`,
          label: visits >= 3 ? `${room.name} // PATTERN REMEMBERED` : `${room.name} // LIVE`,
          priority: 90,
          ttlMs: 9000,
          detail: "core",
          policy: "replace",
          variants,
        };
      }
      case "prize_round_over":
        return {
          key: "room:prize:over",
          label: `BONUS ROUND CLOSED // ${event.claimed} PRIZES CLAIMED`,
          priority: 84,
          ttlMs: 6000,
          detail: "balanced",
          policy: "queue",
          variants: PRIZE_CLEAR_LINES,
        };
      case "room_cleared":
      case "room_selected":
        return null;
      case "boss_intro":
        return {
          key: `boss:intro:${event.level}`,
          label: event.overtime ? `ENCORE GUEST // ${event.bossName}` : `FINAL GUEST // ${event.bossName}`,
          priority: 100,
          ttlMs: 7000,
          detail: "core",
          policy: "hard",
          variants: event.overtime ? OVERTIME_LINES.boss : CAMPAIGN_LINES[event.level].bossIntro,
        };
      case "boss_phase":
        return {
          key: `boss:phase:${event.phase}`,
          label: `${event.bossName} // PHASE ${event.phase}`,
          priority: 96,
          ttlMs: 13000,
          detail: "core",
          policy: "queue",
          variants: CAMPAIGN_LINES[event.level].bossPhase,
        };
      case "broadcast_beat":
        return this.cueForBeat(event.moment, event.elapsed);
      case "combo_milestone": {
        const detail = event.combo >= 35 ? "core" : event.combo >= 20 ? "balanced" : "full";
        return {
          key: `combo:${event.combo}`,
          label: `${event.combo} CHAIN // SIGNAL ANALYSIS`,
          priority: event.combo >= 35 ? 88 : event.combo >= 20 ? 76 : 62,
          ttlMs: 2200,
          detail,
          policy: event.combo >= 35 ? "replace" : "drop",
          variants: LINES[`combo_${event.combo}`],
        };
      }
      case "player_hurt":
        return {
          key: "player:hurt",
          label: "SIGNAL DAMAGE",
          priority: 48,
          ttlMs: 1100,
          detail: "full",
          policy: "drop",
          variants: LINES.hurt,
        };
      case "critical_health":
        return {
          key: "player:critical",
          label: "CRITICAL SIGNAL // PRIORITY CALL",
          priority: 99,
          ttlMs: 1800,
          detail: "core",
          policy: "hard",
          variants: LINES.critical,
        };
      case "health_recovered":
        return {
          key: "player:recovered",
          label: "SIGNAL RESTORED",
          priority: 82,
          ttlMs: 9000,
          detail: "balanced",
          policy: "queue",
          variants: LINES.recovered,
        };
      case "bomb_used":
        return {
          key: "bomb:used",
          label: event.remaining === 0 ? "FINAL WIPE // STOCK EMPTY" : `SCREEN WIPE // ${event.remaining} REMAIN`,
          priority: 76,
          ttlMs: 2600,
          detail: "balanced",
          policy: "replace",
          variants: LINES.bomb,
        };
      case "weapon_collected": {
        const name = event.weapon;
        const key = name.includes("SCATTER")
          ? "weapon_scatter"
          : name.includes("RAIL")
            ? "weapon_rail"
            : name.includes("ARC")
              ? "weapon_arc"
              : name.includes("GRAFT")
                ? "weapon_graft"
                : name.includes("DISC")
                  ? "weapon_disc"
                  : name.includes("CONTRADICTION")
                    ? "weapon_contradiction"
                    : "weapon_rocket";
        return {
          key: `weapon:${key}`,
          label: `LOADOUT CHANGE // ${name}`,
          priority: 80,
          ttlMs: 3200,
          detail: "balanced",
          policy: "replace",
          variants: LINES[key],
        };
      }
      case "upgrade_break":
        return this.cueForUpgradeBreak(event.slot);
      default:
        return null;
    }
  }

  cueForBeat(moment, elapsed) {
    if (moment === "mid" && !this.storyRevealedThisRun && this.profile.storyCursor < STORY.length)
      return this.storyCue("OFF SCRIPT // ENCRYPTED SIGNAL", "queue");
    const style = styleForRun(this.run, elapsed);
    if (style === "unread") return null;
    return {
      key: `style:${moment}:${style}`,
      label: `${patternLabel(style)} // ${moment.toUpperCase()} READ`,
      priority: moment === "late" ? 78 : 54,
      ttlMs: moment === "late" ? 5000 : 2400,
      detail: moment === "late" ? "balanced" : "full",
      policy: moment === "late" ? "queue" : "drop",
      variants: STYLE_LINES[style],
    };
  }

  cueForUpgradeBreak(slot) {
    const sponsor = this.snapshot.sponsor;
    if (sponsor && this.settings.frequency !== "minimal" && (slot === 1 || this.settings.frequency === "full"))
      return {
        key: `sponsor:${sponsor.id}:break:${slot}`,
        label: `PAID TRANSMISSION // ${sponsor.name}`,
        priority: 91,
        ttlMs: 0,
        detail: slot === 1 ? "balanced" : "full",
        policy: "replace",
        variants: SPONSOR_LINES[sponsor.id].break,
      };
    return {
      key: `upgrade:break:${slot}`,
      label: "SPONSOR WINDOW // READ THE TERMS",
      priority: 86,
      ttlMs: 0,
      detail: "core",
      policy: "replace",
      variants: LINES.upgrade_break,
    };
  }

  handleUpgradeSelected(id, name) {
    const sponsor = this.snapshot.sponsor;
    if (sponsor && this.settings.frequency !== "minimal" && (this.currentSponsorSlot === 1 || this.settings.frequency === "full")) {
      this.submit({
        key: `upgrade:${id}:sponsor-close`,
        label: `${sponsor.name} // CONTRACT CLOSED // IONA'S READ`,
        priority: 95,
        ttlMs: 0,
        detail: "core",
        policy: "replace",
        variants: UPGRADE_LINES[id],
      });
      return;
    }
    this.submit({
      key: `upgrade:${id}`,
      label: `${name.toUpperCase()} // LOCKED`,
      priority: 84,
      ttlMs: 9500,
      detail: "balanced",
      policy: "queue",
      variants: UPGRADE_LINES[id],
    });
  }

  handleResult(result) {
    this.submit({
      key: `result:${result.victory ? "victory" : "defeat"}`,
      label: result.victory
        ? "BROADCAST COMPLETE // UNEDITED"
        : result.overtime
          ? `OVERTIME OVER // WAVE ${pad2(result.wave)}`
          : "SIGNAL LOST // PRIVATE RECAP",
      priority: 100,
      ttlMs: 0,
      detail: "core",
      policy: "hard",
      variants: LINES[result.victory ? "victory" : "defeat"],
    });
    if (result.newBest)
      this.submit({
        key: "result:new-best",
        label: "NEW NETWORK RECORD // VERIFIED",
        priority: 94,
        ttlMs: 14000,
        detail: "core",
        policy: "queue",
        variants: LINES.new_best,
      });
    if (this.breachUnlockedThisResult)
      this.submit({
        key: "result:archive-breach",
        label: "SIGNAL NINE // ARCHIVE BREACH",
        priority: 97,
        ttlMs: 0,
        detail: "core",
        policy: "queue",
        variants: LINES.archive_breach,
      });
    if (!this.storyRevealedThisRun && this.profile.storyCursor < STORY.length)
      this.submit(this.storyCue("OFF AIR // ARCHIVE REVEAL", "queue"));
  }

  storyCue(label, policy) {
    const index = Math.min(this.profile.storyCursor, STORY.length - 1);
    return {
      key: `story:${index}`,
      label,
      priority: 93,
      ttlMs: 0,
      detail: "core",
      policy,
      storyIndex: index,
      variants: [STORY[index]],
    };
  }

  /** Play, queue or drop a cue by its policy and priority. */
  submit(cue, force = false) {
    if (this.disposed) return false;
    if (!force && !allowedAt(this.settings.frequency, cue.detail)) return false;
    if (!this.settings.voice && !this.settings.captions && !this.settings.portrait) return false;
    if (this.suspended) {
      if (cue.detail === "core") this.enqueue(cue);
      return false;
    }
    if (!this.activeCue || !this.snapshot.line) {
      this.activate(cue);
      return true;
    }
    if (cue.policy === "hard") {
      this.interruptActive(true);
      this.activate(cue);
      return true;
    }
    if (cue.policy === "replace") {
      if (cue.priority >= this.currentPriority) {
        this.interruptActive(true);
        this.activate(cue);
      } else {
        this.enqueue(cue);
      }
      return true;
    }
    if (cue.policy === "queue") {
      this.enqueue(cue);
      return true;
    }
    return false;
  }

  enqueue(cue) {
    const expiresAt = cue.ttlMs > 0 ? performance.now() + cue.ttlMs : Number.POSITIVE_INFINITY;
    const existing = this.queue.findIndex((entry) => entry.cue.key === cue.key);
    if (existing >= 0) this.queue[existing] = { cue, expiresAt };
    else this.queue.push({ cue, expiresAt });
    if (this.queue.length > QUEUE_LIMIT) {
      const optional = this.queue.findIndex((entry) => entry.cue.detail !== "core");
      this.queue.splice(optional >= 0 ? optional : 0, 1);
    }
  }

  activate(cue) {
    const variant = this.pickVariant(cue.variants);
    if (!variant) {
      this.startNext();
      return;
    }
    if (this.clearTimer) window.clearTimeout(this.clearTimer);
    if (this.nextTimer) window.clearTimeout(this.nextTimer);
    this.stopSpeech();
    this.activeCue = cue;
    this.currentPriority = cue.priority;
    const generation = ++this.generation;
    const line = {
      id: variant.id,
      instanceId: `${variant.id}:${Date.now()}:${++this.instanceSequence}`,
      text: variant.text,
      label: cue.label,
      emotion: variant.emotion,
      priority: cue.priority,
      durationMs: captionMs(variant.text),
      timestamp: Date.now(),
      speaker: variant.speaker ?? "iona",
      kind: variant.kind ?? "commentary",
      sponsorId: variant.sponsorId,
    };
    if (cue.storyIndex !== undefined && this.profile.storyCursor === cue.storyIndex) {
      this.storyRevealedThisRun = true;
      this.profile = {
        ...this.profile,
        storyCursor: Math.min(STORY.length, this.profile.storyCursor + 1),
        trust: Math.min(100, this.profile.trust + 2),
      };
      this.persistProfile();
    }
    const history = [...this.snapshot.history, line].slice(-HISTORY_LIMIT);
    this.publish({ line, speaking: false, emotion: line.emotion, history });
    if (this.settings.voice && !cue.captionOnly && "speechSynthesis" in window && this.snapshot.voiceStatus !== "unavailable")
      this.speak(line, generation);
    this.clearTimer = window.setTimeout(() => {
      if (generation === this.generation && !this.disposed) this.finishCurrent();
    }, line.durationMs + 550);
  }

  speak(line, generation) {
    let utterance;
    try {
      utterance = new SpeechSynthesisUtterance(line.text);
    } catch {
      return;
    }
    utterance.volume = this.settings.volume;
    utterance.rate =
      line.kind === "advertisement" ? 0.96 : line.emotion === "excited" ? 1.07 : line.emotion === "concerned" ? 0.92 : 0.99;
    utterance.pitch = line.speaker === "network" ? 0.76 : line.emotion === "surprised" ? 1.02 : 0.9;
    const voice =
      this.voices.find(
        (v) => /^en/i.test(v.lang) && /Samantha|Ava|Zira|Karen|Victoria|Serena|Google UK English Female/i.test(v.name),
      ) ?? this.voices.find((v) => /^en/i.test(v.lang));
    if (voice) utterance.voice = voice;
    utterance.onstart = () => {
      if (generation !== this.generation || this.disposed) return;
      this.publish({ speaking: true });
      this.onSpeechState?.(true);
    };
    utterance.onend = () => {
      if (generation !== this.generation || this.disposed) return;
      this.publish({ speaking: false });
      this.onSpeechState?.(false);
    };
    utterance.onerror = (event) => {
      if (generation !== this.generation || this.disposed) return;
      const unavailable = ["synthesis-unavailable", "voice-unavailable", "language-unavailable"].includes(event.error);
      this.publish({ speaking: false, ...(unavailable ? { voiceStatus: "unavailable" } : {}) });
      this.onSpeechState?.(false);
    };
    window.speechSynthesis.speak(utterance);
  }

  finishCurrent() {
    this.stopSpeech();
    this.activeCue = null;
    this.currentPriority = 0;
    this.publish({ line: null, speaking: false, emotion: "idle" });
    this.nextTimer = window.setTimeout(() => this.startNext(), 180);
  }

  startNext() {
    if (this.disposed || this.suspended || this.activeCue) return;
    const now = performance.now();
    this.queue = this.queue.filter((entry) => entry.expiresAt > now);
    let best = 0;
    for (let i = 1; i < this.queue.length; i += 1) if (this.queue[i].cue.priority > this.queue[best].cue.priority) best = i;
    const [next] = this.queue.splice(best, 1);
    if (next) this.activate(next.cue);
  }

  interruptActive(requeueStory) {
    // A story transmission that gets talked over comes back later instead of being lost.
    if (requeueStory && this.activeCue?.storyIndex !== undefined) this.enqueue(this.activeCue);
    this.generation += 1;
    if (this.clearTimer) window.clearTimeout(this.clearTimer);
    this.stopSpeech();
    this.activeCue = null;
    this.currentPriority = 0;
    this.publish({ line: null, speaking: false, emotion: "idle" });
  }

  stopSpeech() {
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* ignore */
    }
    if (this.snapshot.speaking) this.publish({ speaking: false });
    this.onSpeechState?.(false);
  }

  pickVariant(variants) {
    if (!variants?.length) return null;
    const fresh = variants.filter((v) => !this.recentIds.includes(v.id));
    const pool = fresh.length > 0 ? fresh : variants;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    this.recentIds = [pick.id, ...this.recentIds.filter((id) => id !== pick.id)].slice(0, 28);
    return pick;
  }

  publish(patch) {
    this.snapshot = {
      ...this.snapshot,
      ...patch,
      profile: { ...this.profile },
      chapter: chapterFor(this.profile.storyCursor),
      dossier: dossierFor(this.profile.storyCursor),
    };
    this.onSnapshot(this.snapshot);
  }

  loadProfile() {
    try {
      const current = localStorage.getItem(PROFILE_KEY);
      const legacy = localStorage.getItem(LEGACY_PROFILE_KEY);
      const saved = JSON.parse(current ?? legacy ?? "null");
      if (!saved || (saved.version !== 2 && saved.version !== 3)) return { ...PROFILE_DEFAULT };
      if (saved.version === 3) this.roomPreferences = { ...(saved.roomPreferences ?? {}) };
      return {
        runs: Math.max(0, saved.runs ?? 0),
        wins: Math.max(0, saved.wins ?? 0),
        losses: Math.max(0, saved.losses ?? 0),
        lifetimeKills: Math.max(0, saved.lifetimeKills ?? 0),
        bestCombo: Math.max(0, saved.bestCombo ?? 0),
        trust: Math.max(0, Math.min(100, saved.trust ?? PROFILE_DEFAULT.trust)),
        storyCursor: Math.max(0, Math.min(STORY.length, saved.storyCursor ?? 0)),
        style: STYLE_NAMES[saved.style] ? saved.style : "unread",
        lastScore: Math.max(0, saved.lastScore ?? 0),
        consecutiveLosses: Math.max(0, saved.consecutiveLosses ?? 0),
        archiveBreach: saved.archiveBreach ?? false,
      };
    } catch {
      try {
        localStorage.removeItem(PROFILE_KEY);
      } catch {
        /* ignore */
      }
      return { ...PROFILE_DEFAULT };
    }
  }

  persistProfile() {
    try {
      const saved = { version: 3, ...this.profile, roomPreferences: { ...this.roomPreferences } };
      localStorage.setItem(PROFILE_KEY, JSON.stringify(saved));
      localStorage.removeItem(LEGACY_PROFILE_KEY);
    } catch {
      /* private mode: the host simply forgets */
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.generation += 1;
    if (this.clearTimer) window.clearTimeout(this.clearTimer);
    if (this.nextTimer) window.clearTimeout(this.nextTimer);
    window.speechSynthesis?.removeEventListener?.("voiceschanged", this.refreshVoices);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    this.stopSpeech();
  }
}
