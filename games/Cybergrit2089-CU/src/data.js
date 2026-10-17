export const ID = "cybergrit2089-cu";
export const TITLE = "CYBERGRIT";
export const BUILD = "2089 · CU";
export const SOURCE = {
  initialDate: "2026-10-16",
  source: "Cyberpunk 2077",
  engine: "my-3D2dge v0.46.1",
  commit: "cfa866aa45474868350cad1a7fc015e612f9305f",
  handoff: "https://github.com/michaelcrosato/my-3d2dge/tree/main/dist/handoff",
  environment:
    "Codex CLI workspace; Bash; WSL2 on Windows; Ubuntu 26.04.1 LTS; Node 22.23.3; Chromium, WebKit and Firefox verification.",
  model:
    "OpenAI GPT-6-based Codex. Exact model variant and reasoning effort are not exposed to the agent.",
};
export const INPUT = {
  up: ["KeyW", "ArrowUp", "Pad12", "PadAxisUp"],
  down: ["KeyS", "ArrowDown", "Pad13", "PadAxisDown"],
  left: ["KeyA", "ArrowLeft", "Pad14", "PadAxisLeft"],
  right: ["KeyD", "ArrowRight", "Pad15", "PadAxisRight"],
  confirm: ["Enter", "Pad0"],
  cancel: ["Escape", "Backspace", "Pad1"],
  pause: ["Escape", "KeyP", "Pad9"],
  start: ["Enter", "Pad9"],
  interact: ["KeyE", "Pad0"],
  fire: ["KeyJ", "Mouse0", "Pad7"],
  aim: ["KeyK", "Mouse2", "Pad6"],
  dash: ["Space", "ShiftLeft", "Pad1"],
  reload: ["KeyR", "Pad2"],
  weapon: ["KeyQ", "Pad3"],
  deck: ["Tab", "Pad4"],
  hack: ["KeyF", "Pad5"],
  crouch: ["KeyC", "Pad10"],
  heal: ["KeyH", "Digit1", "Pad11"],
  journal: ["KeyM", "Pad17", "Pad8"],
};
export const WEAPONS = {
  needle: {
    name: "NEEDLE / 9",
    kind: "Smart pistol",
    magazine: 12,
    damage: 24,
    interval: 0.24,
    reload: 1.1,
    speed: 380,
    range: 205,
    color: "#f4f8ba",
    spread: 0,
    pellets: 1,
  },
  scatter: {
    name: "RUPTURE / 6",
    kind: "Scattergun",
    magazine: 6,
    damage: 16,
    interval: 0.72,
    reload: 1.65,
    speed: 330,
    range: 130,
    color: "#ffb772",
    spread: 0.12,
    pellets: 5,
  },
};
export const HACKS = [
  {
    id: "overload",
    name: "Short circuit",
    cost: 2,
    text: "45 damage + 3s stun. Bypasses armor. Nonlethal.",
  },
  {
    id: "wipe",
    name: "Memory wipe",
    cost: 3,
    text: "Erase nearby hostility. Blind a target for 10s.",
  },
  {
    id: "cloak",
    name: "Optic cloak",
    cost: 4,
    text: "Break sight for 8s. Attacking ends the cloak.",
  },
];
export const UPGRADES = [
  {
    id: "dermal",
    name: "Dermal weave",
    cost: 70,
    text: "+35 maximum health; restore all health.",
  },
  {
    id: "ram",
    name: "Cortex expansion",
    cost: 80,
    text: "+2 RAM; 30% faster RAM regeneration.",
  },
  {
    id: "reflex",
    name: "Reflex spool",
    cost: 90,
    text: "Dash recharges twice as fast; +15% gun damage.",
  },
];
export const OBJECTIVES = [
  {
    title: "A debt in the rain",
    text: "Meet Rook at the noodle stall.",
    target: "rook",
  },
  {
    title: "Kill the signal",
    text: "Reach the relay. Cut Helix security.",
    target: "relay",
  },
  {
    title: "A heart of stolen memories",
    text: "Enter Helix. Recover the Mnemosyne core.",
    target: "core",
  },
  {
    title: "No clean hands",
    text: "Choose who owns the stolen memories.",
    target: "core",
  },
  {
    title: "Leave a ghost behind",
    text: "Reach the extraction vehicle.",
    target: "exit",
  },
];
export const DIALOGUE = {
  rook: {
    name: "ROOK",
    role: "Fixer · old friend",
    text: "Helix bought this block. Then they bought the people in it. The Mnemosyne core holds every memory they took. Cut the relay, get inside, get it out. The buyer pays well. Asking who the buyer is pays nothing.",
    choices: [
      "I’m in. Keep the channel open.",
      "Those memories belong to someone.",
    ],
    replies: [
      "That’s the runner I remember. Take the market alley. Security gets loud past the freight yard.",
      "They belong to all of us. I sent you a back route and a little extra RAM. Do what you can live with.",
    ],
  },
  iris: {
    name: "IRIS",
    role: "Street surgeon · no questions",
    text: "Chrome is just a promise your body has to keep. I can make you harder to kill, harder to see, or harder to forget. First patch-up is on me.",
    choices: ["Show me the implants.", "Patch me up."],
    replies: ["", "Still breathing. That’s a good start."],
  },
  captive: {
    name: "SABLE",
    role: "Memory technician · detained",
    text: "They put a kill-switch in my spine. The relay controls it. Free me and I can strip the Warden’s armor remotely. Please. I don’t want to be another file in that core.",
    choices: ["Sever the tether. [2 RAM]", "I’ll come back."],
    replies: [
      "I owe you my life. I’m opening the service passage. When the Warden wakes, watch its armor drop.",
      "Don’t leave me here.",
    ],
  },
  core: {
    name: "MNEMOSYNE",
    role: "Memory archive · 3,041 lives",
    text: "A thousand voices rise through the static. Rook’s buyer wants an exclusive copy. Broadcast it and Helix can never bury the evidence. Erase it and nobody can ever use these people again. The choice is yours.",
    choices: [
      "BROADCAST · Give the district its memories.",
      "SELL · Keep the contract. Take the money.",
      "ERASE · Let the ghosts rest.",
    ],
  },
};
export const ENDINGS = {
  broadcast: {
    title: "THE CITY REMEMBERS",
    text: "3,041 lives, returned to their owners. Every billboard in Lowlight carries the truth. Your fee is gone. Your name is everywhere.",
    reward: 120,
  },
  sell: {
    title: "ANOTHER KIND OF DEBT",
    text: "The buyer pays in full. By sunrise the archive has a new owner. Rook doesn’t ask what you heard inside. You don’t tell him.",
    reward: 350,
  },
  erase: {
    title: "A BEAUTIFUL SILENCE",
    text: "The archive is ash. Helix can’t sell the past again. Some call you a hero. Others will spend a lifetime wondering what you took away.",
    reward: 180,
  },
};
export const MUSIC = {
  bpm: 104,
  steps: 4,
  tracks: [
    {
      wave: "triangle",
      vol: 0.28,
      notes:
        "D2 - . D2 . . A2 . D2 - . . C2 . . . | Bb1 - . Bb1 . . F2 . Bb1 - . . C2 . . .",
    },
    {
      wave: "sine",
      vol: 0.09,
      notes:
        "D4 . . . A4 . . . F4 . . . E4 . . . | D4 . . . A4 . . . C5 . . . A4 . . .",
    },
    { wave: "drums", vol: 0.19, notes: "k . h . s . h h k . h . s . h ." },
  ],
};
