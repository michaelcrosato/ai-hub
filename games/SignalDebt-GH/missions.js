import { distance, point } from "./navigation.js";

const at = (x, z, y = 0) => ({ x, y, z });
const interact = (label, x, z, line, extra = {}) => ({
  type: "interact",
  label,
  at: at(x, z),
  line,
  seconds: 2.5,
  ...extra,
});
const reach = (label, x, z, line, extra = {}) => ({
  type: "reach",
  label,
  at: at(x, z),
  line,
  radius: 9,
  ...extra,
});
const fight = (label, x, z, count, line, extra = {}) => ({
  type: "combat",
  label,
  at: at(x, z),
  count,
  line,
  ...extra,
});
const defend = (label, x, z, seconds, line, extra = {}) => ({
  type: "defend",
  label,
  at: at(x, z),
  seconds,
  line,
  ...extra,
});
const escape = {
  type: "escape",
  label: "Lose Civic Shield. Break sight in a side street.",
  line: [
    "IONA",
    "Their cameras only know where you were. Give them an old story.",
  ],
};

export const MISSIONS = [
  {
    title: "Borrowed Ignition",
    tagline: "They took the car. Bo kept the spare.",
    reward: 650,
    brief:
      "Bo’s getaway car was repossessed with the neighborhood’s relief funds inside. Recover his Cormorant, then collect the residents’ paper records before Civic Shield can erase them. The garage is your way home.",
    stages: [
      interact(
        "Meet Bo outside the garage",
        -18,
        15,
        [
          "BO",
          "The orange Cormorant is in their impound. Take the loaner on the street. Bring my car home and the fuel is on me.",
        ],
        { seconds: 0 },
      ),
      reach("Drive to the Civic Shield impound", -187, -187, [
        "REN",
        "Repossession is a fancy word for theft with a clipboard.",
      ]),
      fight("Clear the impound guards", -187, -187, 3, [
        "BO",
        "Stay moving. Their stun rounds still leave a mark. Aim at the nearest guard and watch the red charge.",
      ]),
      interact("Recover the impound release key", -186, -181, [
        "REN",
        "Got the key. And a very long list of people who want their lives back.",
      ]),
      {
        type: "enter",
        label: "Take back the orange Cormorant",
        vehicle: "cormorant",
        at: at(-183, -192),
        line: [
          "BO",
          "Good. The boxes are all over the Breakwater. Pick up the paper trail; this city still runs on receipts.",
        ],
      },
      reach(
        "Collect the market residents’ ledger",
        -80,
        90,
        [
          "IONA",
          "A hundred homes. All listed as vacant. Funny, I can hear their dinner plates.",
        ],
        { vehicle: true, stop: true },
      ),
      reach(
        "Collect the marina’s mooring records",
        235,
        120,
        ["REN", "They even sold the water under the boats."],
        { vehicle: true, stop: true },
      ),
      reach(
        "Collect the west relay’s power bills",
        -185,
        145,
        [
          "IONA",
          "Same shell company, different logo. Follow the money and it always drives in circles.",
        ],
        { vehicle: true, stop: true },
      ),
      reach(
        "Collect the exchange’s foreclosure notices",
        145,
        -80,
        [
          "BO",
          "There’s a broadcast engineer who needs to see those. Keep the suspension in one piece.",
        ],
        { vehicle: true, stop: true },
      ),
      reach(
        "Collect the freight workers’ contracts",
        145,
        145,
        ["REN", "One signature on all of them. Somebody had a busy afternoon."],
        { vehicle: true, stop: true },
      ),
      reach(
        "Bring the Cormorant and records to the garage",
        -9,
        0,
        [
          "BO",
          "You kept the paint mostly attached. That counts as a good evening.",
        ],
        { vehicle: true, stop: true },
      ),
      interact(
        "Give Bo the recovered records",
        -18,
        15,
        [
          "IONA",
          "This isn’t a bad landlord. It’s an extraction system. I can make the whole city hear it.",
        ],
        { seconds: 0 },
      ),
    ],
  },
  {
    title: "Terms of Service",
    tagline: "Every locked door has someone else’s password.",
    reward: 950,
    brief:
      "Iona needs three network keys and the original contract manifest. Choose your preparation: jam Civic Shield’s dispatch to reduce the finale’s reinforcements, or stage a diversion to give the crew more time and safer equipment.",
    choice: true,
    stages: [
      interact(
        "Meet Iona at the market relay",
        -80,
        90,
        [
          "IONA",
          "Three keys, one dirty contract. Hold the receiver steady at each cabinet. Use your signal scan if you lose the trail.",
        ],
        { seconds: 0 },
      ),
      fight("Secure the western relay cabinet", -185, 145, 3, [
        "REN",
        "First key. They brought more uniforms than engineers.",
      ]),
      interact(
        "Copy the western relay key",
        -185,
        145,
        ["IONA", "First signature copied. Keep the signal clear."],
        { seconds: 7 },
      ),
      fight("Secure the marina cabinet", 235, 120, 4, [
        "IONA",
        "They raised the docking fees the day after the vote. Look for a cabinet near the water.",
      ]),
      interact(
        "Copy the marina network key",
        235,
        120,
        [
          "REN",
          "Second key. Their network is better guarded than their paperwork.",
        ],
        { seconds: 7 },
      ),
      fight("Secure the freight cabinet", 145, 145, 4, [
        "BO",
        "The freight lane is narrow. Those cargo containers make useful cover.",
      ]),
      interact(
        "Copy the freight network key",
        145,
        145,
        [
          "IONA",
          "That’s all three. Now the exchange terminal will talk to us.",
        ],
        { seconds: 7 },
      ),
      fight("Reach the contract exchange terminal", 145, -80, 5, [
        "REN",
        "There’s our signature. Civic Shield owns the company that hired Civic Shield.",
      ]),
      defend("Keep the manifest uplink connected", 145, -80, 75, [
        "IONA",
        "The archive is copying. Stay near the terminal; I need your receiver within range.",
      ]),
      escape,
      interact(
        "Deliver the manifest to Bo",
        -18,
        15,
        [
          "BO",
          "The payments move in an armored van. Tomorrow’s contracts are in it. Tomorrow is happening tonight.",
        ],
        { seconds: 0 },
      ),
    ],
  },
  {
    title: "Moving Assets",
    tagline: "A balance sheet with four wheels.",
    reward: 1400,
    brief:
      "A Civic Shield courier is moving the original ledger around the ring road. Stop the vehicle, take its access case and bring it to Iona’s dockside copying station. Then get the crew and evidence out.",
    stages: [
      interact(
        "Get the courier route from Bo",
        -18,
        15,
        [
          "BO",
          "The van circles the ring road. Nudge it to a stop. You want the ledger, not a bonfire.",
        ],
        { seconds: 0 },
      ),
      {
        type: "intercept",
        label: "Intercept the moving courier. Ram its rear quarter.",
        at: at(216, -108),
        line: [
          "IONA",
          "I marked its live position. That blue van is carrying everybody’s future.",
        ],
      },
      fight(
        "Secure the courier’s access case",
        216,
        -108,
        4,
        ["REN", "Their insurance premium just became a plot point."],
        { dynamic: true },
      ),
      interact(
        "Recover the courier access case",
        216,
        -108,
        [
          "IONA",
          "Bring it to the freight station. I have a clean reader and a very nervous mechanic.",
        ],
        { seconds: 4, dynamic: true },
      ),
      reach(
        "Deliver the access case to the freight station",
        145,
        145,
        [
          "BO",
          "I’m going to copy it. You’re going to explain to the uniforms why that’s happening.",
        ],
        { vehicle: true, stop: true },
      ),
      defend("Protect Bo while he copies the ledger", 145, 145, 100, [
        "BO",
        "It’s encrypted. Of course it’s encrypted. Keep them off me.",
      ]),
      interact(
        "Take the copied evidence",
        145,
        145,
        ["BO", "Names, dates, bribes. Not a single line item for shame."],
        { seconds: 2 },
      ),
      reach(
        "Pick up the transmission coil at the west relay",
        -185,
        145,
        [
          "IONA",
          "The city’s old emergency band still reaches every receiver. We only need to wake it up.",
        ],
        { vehicle: true, stop: true },
      ),
      escape,
      reach(
        "Bring the evidence and coil to the garage",
        -9,
        0,
        ["REN", "We’re not selling this back to them. Everyone gets a copy."],
        { vehicle: true, stop: true },
      ),
      interact(
        "Plan the broadcast with Iona",
        -18,
        15,
        [
          "IONA",
          "Two relays, then the tower. Once we start, the whole Breakwater becomes an antenna.",
        ],
        { seconds: 0 },
      ),
    ],
  },
  {
    title: "Public Record",
    tagline: "Tonight, the city keeps the receipt.",
    reward: 2200,
    brief:
      "Install the coil, synchronize two district relays, then ride the tower’s service lift and put the ledger on the emergency band. The preparation you chose will change Civic Shield’s response. Finish the broadcast and meet Bo at the ferry.",
    stages: [
      interact(
        "Install the transmission coil at the west relay",
        -185,
        145,
        [
          "IONA",
          "Your preparation is live. Dispatch interference means fewer reinforcements; the diversion means a tougher transmitter.",
        ],
        { seconds: 6 },
      ),
      defend("Synchronize the market relay", -80, 90, 70, [
        "IONA",
        "Stay in the blue signal circle. Step out to dodge, but the sync only advances while you’re in range.",
      ]),
      defend("Synchronize the marina relay", 235, 120, 70, [
        "REN",
        "Every radio in the district is about to have an interesting evening.",
      ]),
      fight("Clear the broadcast tower service yard", 195, -185, 6, [
        "BO",
        "The lift still works. I checked it personally. By which I mean I kicked it.",
      ]),
      {
        type: "lift",
        label: "Ride the service lift to the transmitter roof",
        at: at(195, -194, 8.2),
        line: [
          "IONA",
          "Take the moving platform. The uplink is on the roof. Look down: that’s the city you’re keeping.",
        ],
      },
      interact(
        "Connect the ledger to the transmitter",
        195,
        -192,
        ["REN", "Port Sable, this is not a scheduled announcement."],
        { seconds: 6, at: at(195, -192, 8.2) },
      ),
      defend(
        "Keep the public broadcast alive",
        195,
        -192,
        100,
        [
          "IONA",
          "They can cut one transmitter. They can’t cut every recording. Hold this roof.",
        ],
        { at: at(195, -192, 8.2) },
      ),
      reach(
        "Return to street level",
        195,
        -178,
        ["BO", "Transmission confirmed. The ferry is running. So are we."],
        { radius: 12, below: 3 },
      ),
      reach(
        "Reach Bo’s ferry at the southern waterfront",
        235,
        220,
        [
          "IONA",
          "People are opening their windows. They’re hearing their own names.",
        ],
        { vehicle: true, stop: true },
      ),
      escape,
      interact(
        "Leave the ledger with the people of Port Sable",
        235,
        220,
        ["REN", "Debt paid. Signal stays."],
        { seconds: 0 },
      ),
    ],
  },
];

export class Story {
  constructor(game) {
    this.game = game;
    this.missions = structuredClone(MISSIONS);
    this.mission = 0;
    this.stage = 0;
    this.active = false;
    this.finished = false;
    this.progress = 0;
    this.stageTime = 0;
    this.wave = 0;
    this.completed = 0;
    this.approach = "jam";
    this.history = [];
  }
  get chapter() {
    return this.missions[this.mission];
  }
  get current() {
    return this.chapter?.stages[this.stage];
  }
  target() {
    if (!this.active)
      return this.completed > 0 && !this.finished
        ? { x: -18, y: 0, z: 15 }
        : null;
    const s = this.current;
    if (s.type === "escape") return null;
    if (s.type === "intercept") return this.game.courier?.position ?? s.at;
    return s.at;
  }
  brief(index = this.mission) {
    this.mission = index;
    const m = this.chapter;
    this.game.ui.show("brief", {
      title: m.title,
      subtitle: m.tagline,
      body: m.brief,
      missionIndex: index,
      replay: !!this.game.replaying,
      choices: m.choice
        ? [
            { label: "Jam dispatch · fewer reinforcements", value: "jam" },
            {
              label: "Stage diversion · stronger transmitter",
              value: "diversion",
            },
          ]
        : null,
    });
  }
  begin() {
    this.active = true;
    this.finished = false;
    this.game.ui.hide();
    this.enterStage();
  }
  enterStage(restoring = false) {
    this.progress = 0;
    this.stageTime = 0;
    this.wave = 0;
    this.stageArrived = false;
    const s = this.current;
    if (!s) return;
    this.game.placeCrew?.(this.mission, this.stage);
    if (s.dynamic && this.game.interceptPosition)
      s.at = { ...this.game.interceptPosition };
    this.game.clearEnemies();
    if (s.type === "combat") this.game.spawnEnemies(s.at, s.count);
    if (s.type === "defend") {
      this.game.spawnEnemies(s.at, 3);
      this.game.signalHealth = this.approach === "diversion" ? 150 : 100;
    }
    if (s.type === "intercept") this.game.startCourier();
    if (s.type === "escape" && this.game.heat < 1) this.game.addHeat(2, true);
    if (s.line) this.game.say(...s.line);
    if (!restoring) this.game.checkpoint();
  }
  advance() {
    const s = this.current;
    this.history.push({
      mission: this.mission,
      stage: this.stage,
      label: s.label,
      elapsed: this.game.playTime,
    });
    this.game.audio.event("interact");
    this.game.toast("CHECKPOINT · " + s.label, 3);
    this.stage++;
    if (this.stage >= this.chapter.stages.length) {
      this.active = false;
      this.completed = Math.max(this.completed, this.mission + 1);
      this.game.cash += this.chapter.reward;
      this.game.health = 100;
      this.game.ammo = 12;
      this.game.reserve = 192;
      this.game.clearEnemies();
      this.game.clearHeat();
      this.game.audio.event("mission");
      if (this.mission === 3) {
        this.finished = true;
        this.game.ui.show("ending", {
          title: "The signal stays.",
          subtitle: "PORT SABLE IS LISTENING",
          body: "The ledger is public. The evictions are frozen. Bo’s garage is still open, Iona has a new frequency, and Ren finally owes the city nothing. Explore the Breakwater, take a courier run, or replay the story.",
          stats: { time: this.game.playTime, cash: this.game.cash },
        });
      } else
        this.game.ui.show("debrief", {
          title: this.chapter.title,
          subtitle: "JOB COMPLETE",
          body: this.chapter.tagline,
          reward: this.chapter.reward,
          missionIndex: this.mission,
          replay: !!this.game.replaying,
        });
      this.game.checkpoint();
    } else this.enterStage();
  }
  tick(dt) {
    if (!this.active || this.game.ui.screen) return;
    this.stageTime += dt;
    const s = this.current,
      g = this.game,
      p = g.position;
    const near = s.at && distance(p, s.at) < (s.radius ?? 6);
    if (
      !this.stageArrived &&
      ["combat", "defend"].includes(s.type) &&
      distance(p, s.at) < (s.type === "defend" ? 23 : 30) &&
      Math.abs(p.y - (s.at.y ?? 0)) < 3
    ) {
      this.stageArrived = true;
      g.checkpoint();
    }
    if (
      s.type === "reach" &&
      near &&
      (!s.vehicle || g.ride) &&
      (!s.stop || Math.abs(g.ride?.speed ?? 0) < 3) &&
      (s.below === undefined || p.y < s.below)
    )
      this.advance();
    else if (s.type === "enter" && g.ride?.id === s.vehicle) this.advance();
    else if (
      s.type === "combat" &&
      g.enemies.every((e) => e.health <= 0) &&
      !g.pendingSpawns
    )
      this.advance();
    else if (s.type === "escape" && g.heat === 0) this.advance();
    else if (s.type === "intercept" && g.courierStopped) this.advance();
    else if (
      s.type === "lift" &&
      near &&
      p.y > 7.9 &&
      g.player.hero.grounded &&
      g.player.hero.groundCollider !== g.world.lift.body.collider(0).handle
    )
      this.advance();
    else if (s.type === "interact") {
      const height = s.y ?? s.at.y ?? 0;
      if (near && !g.ride && Math.abs(p.y - height) < 3) {
        g.contextPrompt = {
          text: s.seconds > 0 ? `Hold to ${s.label.toLowerCase()}` : s.label,
          key: "KeyF",
        };
        if (g.ctx.input.isDown("KeyF")) this.progress += dt;
        else if (s.seconds > 0)
          this.progress = Math.max(0, this.progress - dt * 0.7);
        if (g.ctx.input.consumePress("KeyF") && s.seconds === 0) this.advance();
        else if (s.seconds > 0 && this.progress >= s.seconds) this.advance();
      }
    } else if (s.type === "defend") {
      const inRange =
        distance(p, s.at) < 23 && Math.abs(p.y - (s.at.y ?? 0)) < 3;
      if (inRange && !g.ride) this.progress += dt;
      const interval = this.approach === "jam" ? 25 : 18;
      if (
        Math.floor(this.progress / interval) > this.wave &&
        this.progress < s.seconds - 8
      ) {
        this.wave++;
        g.spawnEnemies(s.at, 2 + Math.min(2, this.wave));
        g.say(
          "IONA",
          this.wave % 2
            ? "Signal is holding. Watch the side street."
            : "Another copy is out. Keep that receiver close.",
        );
      }
      if (
        this.progress >= s.seconds &&
        g.enemies.every((e) => e.health <= 0) &&
        !g.pendingSpawns
      )
        this.advance();
    }
  }
  data() {
    return {
      mission: this.mission,
      stage: this.stage,
      active: this.active,
      finished: this.finished,
      progress: this.progress,
      stageTime: this.stageTime,
      wave: this.wave,
      completed: this.completed,
      approach: this.approach,
      history: this.history,
    };
  }
  restore(data) {
    Object.assign(this, data);
    if (this.active) this.enterStage(true);
  }
  hud() {
    const s = this.current;
    return {
      chapter: this.mission + 1,
      title: this.chapter?.title ?? "The Breakwater",
      objective: this.active ? s.label : "Explore the Breakwater",
      detail: this.active
        ? s.type === "defend"
          ? `Signal ${Math.min(100, Math.floor((this.progress / s.seconds) * 100))}% · uplink ${Math.ceil(this.game.signalHealth)} · stay within 23 m`
          : s.type === "combat"
            ? `${this.game.enemies.filter((e) => e.health > 0).length} guards remaining`
            : s.type === "interact" && s.seconds > 0
              ? `${Math.floor((this.progress / s.seconds) * 100)}% copied`
              : "Follow the orange marker"
        : "Garage repairs · courier runs · hidden evidence",
      progress: this.active ? this.stage / this.chapter.stages.length : 1,
    };
  }
}
