import { ERAS, TECHS, TECH, BUILDINGS, CONDUITS, PRODUCTS, CANDIDATES, PATHS, GRID, LESSON_IDS, DIFFICULTIES } from "./content.js";
export const VERSION = 1,
  SAVE_KEY = "singularity-tycoon-v1";
export const clamp = (n, a = 0, b = 100) => Math.max(a, Math.min(b, n));
const key = (x, z) => `${x},${z}`;
export function newGame(path = "academic", startYear = 1956, difficulty = "standard") {
  const state = {
    version: VERSION,
    difficulty: DIFFICULTIES[difficulty] ? difficulty : "standard",
    year: 1956,
    month: 0,
    elapsed: 0,
    paused: true,
    speed: 1,
    path,
    resources: { capital: 42000, data: 700, quality: 82, bias: 12, reputation: 35, safety: 78, citations: 0 },
    techTreeUnlocked: ["neuron"],
    research: null,
    labLayout: [
      { id: 1, type: "power", x: 0, z: 1, rotation: 0 },
      { id: 2, type: "cooling", x: 0, z: 3, rotation: 0 },
      { id: 3, type: "network", x: 0, z: 5, rotation: 0 },
      { id: 4, type: "vacuum", x: 2, z: 2, rotation: 0 },
      { id: 5, type: "desk", x: 5, z: 2, rotation: 0 },
      { id: 6, type: "desk", x: 6, z: 2, rotation: 0 },
      { id: 7, type: "archive", x: 8, z: 2, rotation: 0 },
    ],
    conduits: { power: [], cooling: [], network: [] },
    talent: CANDIDATES.slice(0, 2).map((t) => ({ ...t, morale: 85 })),
    products: [],
    releases: {},
    policy: { open: true, safety: 12, publishing: 60 },
    learned: [],
    events: [],
    event: null,
    seenEvents: [],
    logs: [{ date: "JAN 1956", text: "The university approved your founding grant. A new laboratory begins.", type: "milestone" }],
    grantCooldown: 0,
    auditCooldown: 0,
    licensing: 0,
    competition: 10,
    rng: 1456,
    nextId: 8,
    discovered: 0,
    gameOver: null,
    completed: false,
    history: [],
    objectives: [],
    training: null,
    revision: 0,
  };
  for (const layer of Object.keys(CONDUITS)) {
    for (let z = 1; z <= 6; z++) state.conduits[layer].push(key(0, z));
    for (let x = 1; x <= 8; x++) state.conduits[layer].push(key(x, 3));
  }
  if (startYear > 1956) {
    state.year = clamp(startYear, 1956, 2022);
    state.resources.capital = 175000;
    state.resources.reputation = 50;
    state.resources.data = 65000;
    state.resources.citations = 420;
    state.techTreeUnlocked = TECHS.filter((t) => t.year < Math.min(startYear - 2, 2012)).map((t) => t.id);
    state.discovered = state.techTreeUnlocked.length - 1;
    state.techTreeUnlocked.filter((id) => id !== "neuron").forEach((id) => (state.releases[id] = "open"));
    state.labLayout.find((b) => b.id === 4).type =
      startYear >= 2010 ? "gpu" : startYear >= 1993 ? "cluster" : startYear >= 1980 ? "micro" : "mainframe";
    state.products = [
      { id: "consulting", age: 8, released: true },
      { id: "reader", age: 8, released: true },
    ];
    state.logs = [
      {
        date: `JAN ${startYear}`,
        text: "Scenario start: an established lab, seeded capital, and a historical research archive.",
        type: "milestone",
      },
    ];
  }
  return state;
}
export function difficultyOf(s) {
  return DIFFICULTIES[s.difficulty] || DIFFICULTIES.standard;
}
export function eraFor(year) {
  return ERAS.find((e) => year >= e.start && year < e.end) || ERAS[6];
}
export function formatDate(s) {
  return `${["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][s.month]} ${s.year}`;
}
export function log(s, text, type = "info") {
  s.logs.unshift({ date: formatDate(s), text, type });
  s.logs = s.logs.slice(0, 70);
}
function random(s) {
  s.rng = (Math.imul(s.rng, 1664525) + 1013904223) >>> 0;
  return s.rng / 4294967296;
}
/** A utility reaches its own tile and orthogonally connected conduit tiles.
 * A machine connects on its tile or directly beside the reached conduit. */
export function connectedTiles(s, layer) {
  const sourceType = layer === "power" ? "power" : layer === "cooling" ? "cooling" : "network";
  const wires = new Set(s.conduits[layer]),
    reached = new Set(),
    queue = s.labLayout.filter((b) => b.type === sourceType).map((b) => [b.x, b.z]);
  for (let i = 0; i < queue.length; i++) {
    const [x, z] = queue[i],
      k = key(x, z);
    if (reached.has(k)) continue;
    reached.add(k);
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const n = key(x + dx, z + dz);
      if (wires.has(n) && !reached.has(n)) queue.push([x + dx, z + dz]);
    }
  }
  return reached;
}
function touching(set, b) {
  return [
    [0, 0],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ].some(([dx, dz]) => set.has(key(b.x + dx, b.z + dz)));
}
export function derive(s) {
  const powerNet = connectedTiles(s, "power"),
    coolNet = connectedTiles(s, "cooling"),
    dataNet = connectedTiles(s, "network");
  const supply = s.labLayout.reduce((a, b) => a + (BUILDINGS[b.type].supply || 0), 0);
  const load = s.labLayout.filter((b) => touching(powerNet, b)).reduce((a, b) => a + BUILDINGS[b.type].power, 0);
  const powerRatio = Math.min(1, supply / Math.max(load, 0.001));
  const cooling =
    s.labLayout.filter((b) => b.type === "cooling" && touching(powerNet, b)).reduce((a, b) => a + BUILDINGS[b.type].cooling, 0) *
    powerRatio;
  const heat = s.labLayout.filter((b) => touching(powerNet, b)).reduce((a, b) => a + BUILDINGS[b.type].heat, 0) * powerRatio;
  const thermal = Math.min(1, cooling / Math.max(heat, 0.001));
  const statuses = {},
    computeBuildings = s.labLayout.filter((b) => BUILDINGS[b.type].compute);
  let compute = 0,
    flops = 0,
    offline = 0;
  for (const b of computeBuildings) {
    const p = touching(powerNet, b),
      n = touching(dataNet, b),
      c = touching(coolNet, b),
      efficiency = (p && n ? powerRatio : 0) * (c ? thermal : 0.2);
    statuses[b.id] = { power: p, network: n, cooling: c, efficiency, temperature: 23 + (1 - (c ? thermal : 0)) * 58 + heat * 0.55 };
    compute += BUILDINGS[b.type].compute * efficiency;
    flops += BUILDINGS[b.type].flops * efficiency;
    if (efficiency < 0.5) offline++;
  }
  const desks = s.labLayout.filter((b) => b.type === "desk").length;
  const lounges = s.labLayout.filter((b) => b.type === "lounge").length;
  const ageFactor = 1 + (s.year - 1956) * 0.055;
  const diff = difficultyOf(s);
  const salaryFactor = ageFactor * diff.salary;
  const payroll = s.talent.reduce((a, t) => a + t.salary, 0) * salaryFactor;
  const upkeep = s.labLayout.reduce((a, b) => a + BUILDINGS[b.type].upkeep, 0);
  const electricity = load * 10;
  const rent = 300 + (s.year - 1956) * 6;
  const grants = (2000 + s.techTreeUnlocked.length * 85) * (1 + s.resources.reputation / 180) * eraFor(s.year).grant * diff.grant;
  const demand = s.products.reduce((a, p) => a + PRODUCTS.find((x) => x.id === p.id).compute, 0);
  const fulfillment = Math.min(1, compute / Math.max(demand, 0.001));
  const productDetails = s.products.map((p) => {
    const def = PRODUCTS.find((x) => x.id === p.id);
    const fit = Math.max(0.35, 1 - p.age / (def.life * 24));
    const quality = 0.45 + s.resources.quality / 180;
    const publicTrust = 0.6 + s.resources.reputation / 200;
    const competition = 1 - s.competition / 240;
    const revenue = def.revenue * fit * quality * publicTrust * competition * fulfillment * (p.released ? 0.8 : 1.12);
    return { ...p, def, fit, revenue };
  });
  const revenue = productDetails.reduce((a, p) => a + p.revenue, 0);
  const maintenance = productDetails.reduce((a, p) => a + p.def.revenue * 0.07, 0);
  const safetyCost = s.policy.safety * (12 + compute * 0.15);
  const expenses = payroll + upkeep + electricity + rent + maintenance + safetyCost;
  const morale = s.talent.length ? s.talent.reduce((a, t) => a + t.morale, 0) / s.talent.length : 0;
  const researchers = s.talent.reduce((a, t) => a + t.skill * (t.morale / 100), 0) * Math.min(1, desks / Math.max(s.talent.length, 1));
  const availableCompute = Math.max(0, compute - demand);
  const rawData =
    s.labLayout
      .filter((b) => b.type === "archive" && touching(powerNet, b) && touching(dataNet, b))
      .reduce((a, b) => a + BUILDINGS[b.type].data, 0) *
    (1 + Math.pow(Math.max(0, s.year - 1956) / 10, 2));
  const net = grants + revenue - expenses;
  return {
    supply,
    load,
    powerRatio,
    cooling,
    heat,
    thermal,
    compute,
    flops,
    offline,
    statuses,
    desks,
    lounges,
    ageFactor,
    salaryFactor,
    payroll,
    upkeep,
    electricity,
    rent,
    grants,
    demand,
    fulfillment,
    productDetails,
    revenue,
    maintenance,
    safetyCost,
    expenses,
    morale,
    researchers,
    availableCompute,
    rawData,
    net,
    runway: net < 0 ? s.resources.capital / -net : Infinity,
    valuation: Math.max(0, s.resources.capital) + revenue * 48 + s.discovered * 12000,
  };
}
export function researchRequirements(s, id) {
  const t = TECH[id],
    d = derive(s);
  if (!t) return ["Unknown research"];
  const reasons = [];
  if (s.techTreeUnlocked.includes(id)) reasons.push("Already discovered");
  if (s.research) reasons.push("Research already in progress");
  if (s.training) reasons.push("Finish the active scaling experiment first");
  if (t.year > s.year + 8) reasons.push(`Available from ${t.year - 8} (eight years ahead of history)`);
  for (const p of t.prereqs) if (!s.techTreeUnlocked.includes(p)) reasons.push(`Requires ${TECH[p].name}`);
  if (d.availableCompute < t.compute) reasons.push(`Needs ${t.compute} free compute; ${d.availableCompute.toFixed(1)} available`);
  if ((s.resources.data * s.resources.quality) / 100 < t.data) reasons.push(`Needs ${t.data.toLocaleString()} effective examples`);
  if (s.resources.capital < t.cost) reasons.push(`Needs $${t.cost.toLocaleString()} research funding`);
  if (!s.talent.length) reasons.push("Hire at least one researcher");
  return reasons;
}
export function researchRate(s, d = derive(s)) {
  if (!s.research) return 0;
  const t = TECH[s.research.id];
  const capacity = Math.min(1, d.availableCompute / Math.max(t.compute, 0.01));
  const early = Math.max(0, t.year - s.year),
    penalty = 1 + early * 0.3;
  const specialty = s.talent.some((p) => p.specialty === t.branch) ? 1.2 : 1;
  const dataFactor = Math.min(1, (s.resources.data * s.resources.quality) / 100 / Math.max(1, t.data));
  return (d.researchers * 2.6 * capacity * specialty * dataFactor * (0.7 + s.policy.publishing / 150)) / penalty;
}
export function startResearch(s, id) {
  const errors = researchRequirements(s, id);
  if (errors.length) return { ok: false, message: errors[0] };
  s.resources.capital -= TECH[id].cost;
  s.research = { id, progress: 0 };
  log(s, `Research started: ${TECH[id].name}.`);
  return { ok: true, message: "Research funded. Your team is on it." };
}
export function build(s, type, x, z, rotation = 0) {
  if (!Number.isInteger(x) || !Number.isInteger(z) || x < 0 || z < 0 || x >= GRID.w || z >= GRID.h)
    return { ok: false, message: "Build inside the laboratory floor." };
  const b = BUILDINGS[type];
  if (!b) return { ok: false, message: "Unknown module." };
  if (b.year > s.year) return { ok: false, message: `Available in ${b.year}.` };
  if (s.labLayout.some((b) => b.x === x && b.z === z)) return { ok: false, message: "That tile is occupied." };
  if (s.resources.capital < b.price) return { ok: false, message: "Not enough capital." };
  s.resources.capital -= b.price;
  s.labLayout.push({ id: s.nextId++, type, x, z, rotation });
  s.revision++;
  log(s, `${b.name} installed.`);
  return { ok: true, message: `${b.name} installed. Check utility connections.` };
}
export function conduit(s, layer, x, z, remove = false) {
  if (!CONDUITS[layer] || x < 0 || z < 0 || x >= GRID.w || z >= GRID.h || !Number.isInteger(x) || !Number.isInteger(z))
    return { ok: false, message: "Choose a floor tile." };
  const k = key(x, z),
    has = s.conduits[layer].includes(k);
  if (remove && has) {
    s.conduits[layer] = s.conduits[layer].filter((p) => p !== k);
    s.revision++;
    return { ok: true, message: "Connection removed." };
  }
  if (remove || has) return { ok: false, message: has ? "Already connected." : "No connection on this tile." };
  if (s.resources.capital < CONDUITS[layer].price) return { ok: false, message: "Not enough capital." };
  s.resources.capital -= CONDUITS[layer].price;
  s.conduits[layer].push(k);
  s.revision++;
  return { ok: true, message: `${CONDUITS[layer].name} laid.` };
}
export function demolish(s, id) {
  const b = s.labLayout.find((b) => b.id === id);
  if (!b) return { ok: false, message: "Select a module." };
  s.resources.capital += BUILDINGS[b.type].price * 0.5;
  s.labLayout = s.labLayout.filter((b) => b.id !== id);
  s.revision++;
  log(s, `${BUILDINGS[b.type].name} sold for 50% of its purchase price.`);
  return { ok: true, message: "Module sold. Half its cost recovered." };
}
export function hire(s, id) {
  const t = CANDIDATES.find((t) => t.id === id);
  if (!t || s.talent.some((p) => p.id === id)) return { ok: false, message: "Researcher unavailable." };
  if (s.resources.capital < 1500) return { ok: false, message: "Recruiting costs $1,500." };
  if (s.talent.length >= derive(s).desks) return { ok: false, message: "Build a research desk first." };
  s.resources.capital -= 1500;
  s.talent.push({ ...t, morale: 85 });
  s.revision++;
  log(s, `${t.name} joined the lab.`);
  return { ok: true, message: `${t.name} hired.` };
}
export function fire(s, id) {
  const t = s.talent.find((t) => t.id === id);
  if (!t) return { ok: false, message: "Researcher not found." };
  const fee = t.salary * derive(s).salaryFactor * 2;
  if (s.resources.capital < fee) return { ok: false, message: "Two months of severance required." };
  s.resources.capital -= fee;
  s.talent = s.talent.filter((t) => t.id !== id);
  s.resources.reputation = clamp(s.resources.reputation - 2);
  s.revision++;
  return { ok: true, message: "Contract ended with two months of severance." };
}
export function launchProduct(s, id) {
  const p = PRODUCTS.find((p) => p.id === id);
  if (!p) return { ok: false, message: "Unknown product." };
  if (s.products.some((p) => p.id === id)) return { ok: false, message: "Product already on the market." };
  if (!s.techTreeUnlocked.includes(p.tech)) return { ok: false, message: `Research ${TECH[p.tech].name} first.` };
  if (s.year < p.year - 3) return { ok: false, message: `Market opens in ${p.year - 3}.` };
  if (s.resources.capital < p.cost) return { ok: false, message: "Not enough launch capital." };
  if (derive(s).compute < derive(s).demand + p.compute) return { ok: false, message: "Add compute before promising more capacity." };
  s.resources.capital -= p.cost;
  s.products.push({ id, age: 0, released: s.policy.open });
  log(s, `${p.name} launched.`, "milestone");
  return { ok: true, message: `${p.name} is live. Revenue begins next month.` };
}
export function retireProduct(s, id) {
  s.products = s.products.filter((p) => p.id !== id);
  return { ok: true, message: "Product retired; compute released." };
}
export function acquireData(s, kind) {
  const scale = 1 + Math.pow((s.year - 1956) / 12, 2),
    options = {
      curated: { cost: 2200, amount: 1800 * scale, quality: 96, bias: -3, risk: 0 },
      scraped: { cost: 850, amount: 6000 * scale, quality: 45, bias: 6, risk: 12 },
      synthetic: { cost: 1200, amount: 4500 * scale, quality: Math.max(25, s.resources.quality - 15), bias: 3, risk: 0 },
    };
  if (kind === "clean") {
    if (s.resources.capital < 1500) return { ok: false, message: "Cleaning costs $1,500." };
    s.resources.capital -= 1500;
    s.resources.data *= 0.95;
    s.resources.quality = clamp(s.resources.quality + 8, 10, 99);
    s.resources.bias = clamp(s.resources.bias - 7);
    return { ok: true, message: "Duplicates removed, labels audited. 5% less data; better quality." };
  }
  const v = options[kind];
  if (!v) return { ok: false, message: "Unknown data source." };
  if (kind === "synthetic" && !s.techTreeUnlocked.includes("transformer"))
    return { ok: false, message: "Synthetic generation requires the Transformer." };
  if (kind === "scraped" && s.year < 1993) return { ok: false, message: "Web acquisition opens in 1993." };
  if (s.resources.capital < v.cost) return { ok: false, message: "Insufficient data budget." };
  const r = s.resources;
  r.capital -= v.cost;
  r.quality = (r.quality * r.data + v.quality * v.amount) / (r.data + v.amount);
  r.data += v.amount;
  r.bias = clamp(r.bias + v.bias);
  s.licensing = clamp(s.licensing + v.risk);
  return { ok: true, message: `${Math.round(v.amount).toLocaleString()} examples added. Quality is weighted by dataset size.` };
}
export function applyGrant(s) {
  if (s.grantCooldown > 0) return { ok: false, message: `Next application in ${s.grantCooldown} months.` };
  const amount = (8500 + s.resources.reputation * 110) * eraFor(s.year).grant * difficultyOf(s).grant;
  s.resources.capital += amount;
  s.grantCooldown = 24;
  s.resources.reputation = clamp(s.resources.reputation + 1);
  log(s, `Project grant awarded: $${Math.round(amount).toLocaleString()}.`);
  return { ok: true, message: "Grant awarded. Another application is possible in 24 months." };
}
export function safetyAudit(s) {
  if (s.auditCooldown > 0) return { ok: false, message: `Next audit in ${s.auditCooldown} months.` };
  const cost = 2200 + derive(s).compute * 25;
  if (s.resources.capital < cost) return { ok: false, message: "Not enough capital for an independent audit." };
  s.resources.capital -= cost;
  s.resources.safety = clamp(s.resources.safety + 12);
  s.resources.reputation = clamp(s.resources.reputation + 3);
  s.auditCooldown = 12;
  return { ok: true, message: "Audit complete: +12 safety, +3 reputation. No audit guarantees alignment." };
}
export function learn(s, lesson) {
  if (!LESSON_IDS.includes(lesson)) return false;
  if (!s.learned.includes(lesson)) {
    s.learned.push(lesson);
    s.resources.reputation = clamp(s.resources.reputation + 2);
    s.resources.citations += 10;
    log(s, `Interactive notebook completed: ${lesson}.`);
    return true;
  }
  return false;
}
export function tick(s) {
  if (s.gameOver || s.completed || s.event || s.paused) return;
  const d = derive(s),
    oldEra = eraFor(s.year).id;
  s.resources.capital += d.net;
  s.elapsed++;
  s.month++;
  if (s.month === 12) {
    s.month = 0;
    s.year++;
  }
  s.grantCooldown = Math.max(0, s.grantCooldown - 1);
  s.auditCooldown = Math.max(0, s.auditCooldown - 1);
  // Data is a reusable stock, not a currency spent each training run.
  const newData = d.rawData;
  const r = s.resources;
  r.quality = (r.quality * r.data + 94 * newData) / Math.max(1, r.data + newData);
  r.data += newData;
  s.products.forEach((p) => p.age++);
  s.competition = clamp(s.competition + (s.policy.open ? 0.03 : 0.012), 0, 85);
  const published = Object.values(s.releases).filter((p) => p === "open").length;
  r.citations += published * (0.2 + s.policy.publishing / 200);
  const deploymentCost = s.products.reduce((a, p) => a + PRODUCTS.find((x) => x.id === p.id).ethics, 0);
  r.safety = clamp(
    r.safety + s.policy.safety * 0.025 - deploymentCost * (s.techTreeUnlocked.includes("rlhf") ? 0.35 : 0.65) - s.resources.bias * 0.001,
  );
  const targetMorale = clamp(
    59 + d.lounges * 8 + s.policy.publishing * 0.23 + (d.desks >= s.talent.length ? 5 : -18) + (d.offline === 0 ? 3 : -8),
  );
  s.talent.forEach((t) => (t.morale = clamp(t.morale + (targetMorale - t.morale) * 0.08)));
  if (s.research) {
    s.research.progress += researchRate(s, d);
    const t = TECH[s.research.id];
    if (s.research.progress >= t.work) {
      s.techTreeUnlocked.push(t.id);
      s.releases[t.id] = s.policy.open ? "open" : "closed";
      s.discovered++;
      r.reputation = clamp(r.reputation + (s.policy.open ? 5 : 2));
      r.citations += s.policy.open ? 45 : 12;
      log(s, `Discovery: ${t.name}. ${s.policy.open ? "Published openly." : "Proprietary release."}`, "discovery");
      s.research = null;
    }
  }
  if (s.training) {
    s.training.progress += Math.max(0, d.availableCompute) * 1e17;
    if (s.training.progress >= s.training.compute) {
      r.citations += 60;
      r.reputation = clamp(r.reputation + 2);
      log(s, `Scaling experiment complete. Predicted loss ${s.training.loss.toFixed(3)}; abstract simulated compute.`, "discovery");
      s.training = null;
    }
  }
  if (oldEra !== eraFor(s.year).id && s.year <= 2022) {
    const e = eraFor(s.year);
    log(s, `${e.name}. ${e.blurb}`, "milestone");
    s.event = {
      id: `era-${e.id}`,
      kind: "era",
      title: e.name,
      body:
        e.blurb +
        " The annual funding multiplier changes immediately. Historical eras are simplified boundaries, not a globally synchronized timeline.",
      choices: [{ label: "Adapt the lab", detail: `Grant multiplier: ×${e.grant.toFixed(2)}`, effect: "none" }],
    };
  }
  if (!s.event && s.elapsed % 18 === 0 && s.elapsed > 5) rollEvent(s);
  if (s.elapsed % 3 === 0) {
    s.history.push({ year: s.year, month: s.month, capital: r.capital, revenue: d.revenue, compute: d.compute });
    s.history = s.history.slice(-80);
  }
  if (r.capital < 0) {
    s.gameOver =
      "Insolvent. Payroll and operating costs exhausted your capital. A winter is a cash-flow problem before it is a scientific one.";
    s.paused = true;
  }
  if (r.safety <= 5 && s.products.some((p) => p.id === "chat")) {
    s.gameOver =
      "Deployment shutdown. Repeated unsafe optimization triggered the fictional oversight board’s stop order. This game threshold is not a real risk probability.";
    s.paused = true;
  }
  if (r.reputation <= 1 && s.products.length > 2) {
    s.gameOver = "Public-trust failure. Your operating license was suspended in this fictional scenario.";
    s.paused = true;
  }
  if (s.year >= 2023) {
    s.year = 2022;
    s.month = 11;
    s.completed = true;
    s.paused = true;
    log(s, "The historical campaign is complete. The next chapter remains unwritten.", "milestone");
  }
}
function rollEvent(s) {
  let event;
  if (s.licensing > 25) {
    event = {
      id: "rights",
      title: "A dataset provenance challenge",
      body: "A rights holder challenges the provenance of your acquired corpus. This is a fictional event, not a statement about any real lawsuit or current legal requirement.",
      choices: [
        { label: "License and document", detail: "$6,000 · reduce licensing exposure", effect: "license" },
        { label: "Remove disputed data", detail: "Lose 20% of examples · +4 reputation", effect: "purge" },
      ],
    };
  } else if (s.resources.safety < 45 && s.products.length) {
    event = {
      id: "reward",
      title: "The metric looked excellent",
      body: "Your system found a shortcut: its reported score rose, while real user outcomes deteriorated. The proxy was not the goal. Investigate reward hacking before expanding deployment.",
      choices: [
        { label: "Pause and red-team", detail: "$4,000 · +16 safety", effect: "redteam" },
        { label: "Ship with a warning", detail: "−12 reputation · −8 safety", effect: "ignore" },
      ],
    };
  } else {
    const pool = [
      {
        id: "review",
        title: "A reviewer asks for the code",
        body: "Your latest result attracts attention. Releasing methods can strengthen reproducibility, but it also makes imitation easier.",
        choices: [
          { label: "Publish the implementation", detail: "+6 reputation · +50 citations · rivals learn", effect: "publish" },
          { label: "Keep the advantage", detail: "$3,000 licensing opportunity · −2 reputation", effect: "licenseTech" },
        ],
      },
      {
        id: "grant",
        title: "A funder wants a demonstration",
        body: "A funding panel asks whether your work can make a useful, testable promise. You can commit to a narrow milestone or sell a much larger vision.",
        choices: [
          { label: "Promise something measurable", detail: "$4,000 award · +3 reputation", effect: "measured" },
          { label: "Make a spectacular promise", detail: "$9,000 award · −7 reputation · −4 safety", effect: "hype" },
        ],
      },
      {
        id: "morale",
        title: "The team needs room to think",
        body: "Product maintenance is eating into research time. Your colleagues want a small workshop to exchange ideas and examine failed experiments.",
        choices: [
          { label: "Fund the workshop", detail: "$1,800 · morale +10 · +20 citations", effect: "workshop" },
          { label: "Protect the runway", detail: "Morale −5 · no spending", effect: "decline" },
        ],
      },
      {
        id: "bias",
        title: "The dataset has a blind spot",
        body: "An evaluation slice is much worse than the aggregate score. The average concealed a systematic gap. More examples alone may replicate the problem.",
        choices: [
          { label: "Audit labels and coverage", detail: "$2,400 · quality +5 · bias −10", effect: "biasAudit" },
          { label: "Document and defer", detail: "−4 reputation · −4 safety", effect: "defer" },
        ],
      },
    ];
    event = pool[Math.floor(random(s) * pool.length)];
  }
  s.event = { ...event, kind: "decision" };
}
export function chooseEvent(s, index) {
  if (!s.event) return { ok: false, message: "No event to resolve." };
  const ch = s.event.choices[index];
  if (!ch) return { ok: false, message: "Choose an available response." };
  const costs = { license: 6000, redteam: 4000, workshop: 1800, biasAudit: 2400 };
  if (costs[ch.effect] && s.resources.capital < costs[ch.effect])
    return { ok: false, message: "Not enough capital. Choose the no-cost response." };
  const r = s.resources;
  switch (ch.effect) {
    case "license":
      r.capital -= 6000;
      s.licensing = 0;
      break;
    case "purge":
      r.data *= 0.8;
      r.reputation = clamp(r.reputation + 4);
      s.licensing = 0;
      break;
    case "redteam":
      r.capital -= 4000;
      r.safety = clamp(r.safety + 16);
      break;
    case "ignore":
      r.reputation = clamp(r.reputation - 12);
      r.safety = clamp(r.safety - 8);
      break;
    case "publish":
      r.reputation = clamp(r.reputation + 6);
      r.citations += 50;
      s.competition = clamp(s.competition + 3);
      break;
    case "licenseTech":
      r.capital += 3000;
      r.reputation = clamp(r.reputation - 2);
      break;
    case "measured":
      r.capital += 4000;
      r.reputation = clamp(r.reputation + 3);
      break;
    case "hype":
      r.capital += 9000;
      r.reputation = clamp(r.reputation - 7);
      r.safety = clamp(r.safety - 4);
      break;
    case "workshop":
      r.capital -= 1800;
      s.talent.forEach((t) => (t.morale = clamp(t.morale + 10)));
      r.citations += 20;
      break;
    case "decline":
      s.talent.forEach((t) => (t.morale = clamp(t.morale - 5)));
      break;
    case "biasAudit":
      r.capital -= 2400;
      r.quality = clamp(r.quality + 5);
      r.bias = clamp(r.bias - 10);
      break;
    case "defer":
      r.reputation = clamp(r.reputation - 4);
      r.safety = clamp(r.safety - 4);
      break;
  }
  log(s, `${s.event.title} — ${ch.label}.`, "event");
  s.seenEvents.push(s.event.id);
  s.event = null;
  return { ok: true, message: "Decision recorded." };
}
export function score(s) {
  const d = derive(s),
    open = Object.values(s.releases).filter((v) => v === "open").length;
  const scores = {
    academic: Math.min(s.discovered / 16, s.resources.citations / 1500),
    capitalist: Math.min(d.valuation / 1e6, d.revenue / 12000),
    safe: Math.min(
      s.techTreeUnlocked.includes("rlhf") ? 1 : 0,
      s.resources.safety / 85,
      s.resources.reputation / 70,
      s.year >= 2022 ? 1 : 0,
    ),
    open: Math.min(open / 12, s.resources.reputation / 85, s.year >= 2022 ? 1 : 0),
    accelerator: ["transformer", "kaplan", "diffusion"].every((id) => s.techTreeUnlocked.includes(id))
      ? s.year < 2020
        ? 1
        : s.objectives.includes("pioneer")
          ? 1
          : 0
      : 0,
  };
  if (scores.accelerator >= 1 && !s.objectives.includes("pioneer")) s.objectives.push("pioneer");
  return { progress: clamp(scores[s.path] * 100), all: scores, open, won: scores[s.path] >= 1 };
}
// Published empirical fit, Hoffmann et al. (2022), Eq. 10. N and D are raw counts.
export function scalingLoss(N, D) {
  if (!(N > 0 && D > 0)) throw new RangeError("Parameters and tokens must be positive.");
  return 1.69 + 406.4 / N ** 0.34 + 410.7 / D ** 0.28;
}
export function optimalAllocation(C) {
  if (!(C > 0)) throw new RangeError("Compute must be positive.");
  const g = ((0.34 * 406.4) / (0.28 * 410.7)) ** (1 / (0.34 + 0.28));
  const N = g * (C / 6) ** (0.28 / (0.34 + 0.28));
  return { N, D: C / (6 * N) };
}
export function startTraining(s, N, D) {
  if (!Number.isFinite(N) || !Number.isFinite(D) || N < 1e6 || N > 1e12 || D < 1e7 || D > 1e14)
    return { ok: false, message: "Use 1 million–1 trillion parameters and 10 million–100 trillion tokens." };
  if (!s.techTreeUnlocked.includes("kaplan")) return { ok: false, message: "Research neural scaling laws first." };
  if (s.training) return { ok: false, message: "An experiment is already running." };
  if (s.research) return { ok: false, message: "Finish research before reserving the experiment queue." };
  const cost = 5000 + Math.log10(N) * 500;
  if (s.resources.capital < cost) return { ok: false, message: "Insufficient experiment funding." };
  s.resources.capital -= cost;
  s.training = { N, D, loss: scalingLoss(N, D), compute: 6 * N * D, progress: 0 };
  return { ok: true, message: "Scaling experiment queued. Training time uses compressed simulation units." };
}
/** Defensive load: allow known schema only, bound allocation sizes, never execute save content. */
export function validateSave(input) {
  if (!input || typeof input !== "object" || input.version !== VERSION) throw new Error("Unsupported save version.");
  const base = newGame();
  const num = (v, min, max, label) => {
    if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) throw new Error(`Invalid ${label}.`);
    return v;
  };
  base.year = num(input.year, 1956, 2022, "year");
  base.month = num(input.month, 0, 11, "month");
  if (!Number.isInteger(base.year) || !Number.isInteger(base.month)) throw new Error("Invalid date.");
  for (const k of Object.keys(base.resources))
    base.resources[k] = num(
      input.resources?.[k],
      k === "capital" ? -1e8 : 0,
      ["quality", "bias", "reputation", "safety"].includes(k) ? 100 : 1e15,
      k,
    );
  if (!Array.isArray(input.labLayout) || input.labLayout.length > 80) throw new Error("Invalid layout.");
  const seen = new Set(),
    ids = new Set();
  base.labLayout = input.labLayout.map((b) => {
    if (
      !BUILDINGS[b.type] ||
      !Number.isInteger(b.x) ||
      !Number.isInteger(b.z) ||
      b.x < 0 ||
      b.x >= GRID.w ||
      b.z < 0 ||
      b.z >= GRID.h ||
      seen.has(key(b.x, b.z)) ||
      ids.has(b.id)
    )
      throw new Error("Invalid building.");
    seen.add(key(b.x, b.z));
    ids.add(b.id);
    return {
      id: num(b.id, 1, 1e8, "building ID"),
      type: b.type,
      x: b.x,
      z: b.z,
      rotation: [0, 1, 2, 3].includes(b.rotation) ? b.rotation : 0,
    };
  });
  for (const layer of Object.keys(CONDUITS)) {
    const cells = input.conduits?.[layer];
    if (
      !Array.isArray(cells) ||
      cells.length > 80 ||
      cells.some((v) => typeof v !== "string" || !/^\d,\d$/.test(v) || Number(v[0]) >= GRID.w || Number(v[2]) >= GRID.h)
    )
      throw new Error("Invalid utility grid.");
    base.conduits[layer] = [...new Set(cells)];
  }
  if (!Array.isArray(input.techTreeUnlocked) || input.techTreeUnlocked.some((id) => !TECH[id]))
    throw new Error("Unknown research in save.");
  base.techTreeUnlocked = [...new Set(input.techTreeUnlocked)];
  if (!Array.isArray(input.talent) || input.talent.length > 8) throw new Error("Invalid team.");
  const talents = new Set();
  base.talent = input.talent.map((t) => {
    const ref = CANDIDATES.find((p) => p.id === t.id);
    if (!ref || talents.has(t.id)) throw new Error("Invalid researcher.");
    talents.add(t.id);
    return { ...ref, morale: num(t.morale, 0, 100, "morale") };
  });
  if (!Array.isArray(input.products) || input.products.length > PRODUCTS.length) throw new Error("Invalid products.");
  const products = new Set();
  base.products = input.products.map((p) => {
    if (!PRODUCTS.some((q) => q.id === p.id) || products.has(p.id)) throw new Error("Invalid product.");
    products.add(p.id);
    return { id: p.id, age: num(p.age, 0, 1e6, "product age"), released: !!p.released };
  });
  base.research =
    input.research && TECH[input.research.id]
      ? { id: input.research.id, progress: num(input.research.progress, 0, 1e7, "research progress") }
      : null;
  base.releases = Object.fromEntries(Object.entries(input.releases || {}).filter(([id, v]) => TECH[id] && ["open", "closed"].includes(v)));
  base.path = PATHS.some((p) => p.id === input.path) ? input.path : "academic";
  base.policy = {
    open: !!input.policy?.open,
    safety: num(input.policy?.safety, 0, 100, "safety policy"),
    publishing: num(input.policy?.publishing, 0, 100, "publishing policy"),
  };
  for (const k of ["elapsed", "grantCooldown", "auditCooldown", "licensing", "competition", "rng", "discovered"])
    base[k] = num(input[k] ?? base[k], 0, k === "rng" ? 4294967295 : 1e8, k);
  base.nextId = Math.max(0, ...base.labLayout.map((b) => b.id)) + 1;
  base.paused = true;
  base.speed = [1, 6, 24].includes(input.speed) ? input.speed : 1;
  base.learned = (Array.isArray(input.learned) ? input.learned : []).filter((v) => LESSON_IDS.includes(v));
  base.difficulty = DIFFICULTIES[input.difficulty] ? input.difficulty : "standard";
  base.seenEvents = (Array.isArray(input.seenEvents) ? input.seenEvents : [])
    .filter((v) => typeof v === "string")
    .slice(-200)
    .map((v) => v.slice(0, 50));
  base.objectives = (Array.isArray(input.objectives) ? input.objectives : []).filter((v) => v === "pioneer");
  base.logs = (Array.isArray(input.logs) ? input.logs : [])
    .slice(0, 70)
    .filter((v) => typeof v.text === "string" && typeof v.date === "string")
    .map((v) => ({
      text: v.text.slice(0, 500),
      date: v.date.slice(0, 30),
      type: ["info", "milestone", "discovery", "event"].includes(v.type) ? v.type : "info",
    }));
  // Events are regenerated from bounded fields; choice effects use an explicit switch.
  if (
    input.event &&
    typeof input.event.title === "string" &&
    typeof input.event.body === "string" &&
    Array.isArray(input.event.choices) &&
    input.event.choices.length <= 3
  ) {
    base.event = {
      id: String(input.event.id).slice(0, 50),
      kind: input.event.kind === "era" ? "era" : "decision",
      title: input.event.title.slice(0, 150),
      body: input.event.body.slice(0, 1200),
      choices: input.event.choices.map((c) => ({
        label: String(c.label).slice(0, 100),
        detail: String(c.detail).slice(0, 160),
        effect: String(c.effect).slice(0, 30),
      })),
    };
  }
  base.gameOver = typeof input.gameOver === "string" ? input.gameOver.slice(0, 700) : null;
  base.recorded = !!input.recorded;
  base.completed = !!input.completed;
  if (input.training) {
    const N = num(input.training.N, 1e6, 1e12, "parameters"),
      D = num(input.training.D, 1e6, 1e14, "tokens");
    base.training = {
      N,
      D,
      loss: scalingLoss(N, D),
      compute: 6 * N * D,
      progress: num(input.training.progress, 0, 1e30, "training progress"),
    };
  }
  base.history = (Array.isArray(input.history) ? input.history : [])
    .slice(-80)
    .filter((h) => ["year", "month", "capital", "revenue", "compute"].every((k) => Number.isFinite(h[k])));
  return base;
}
export function serialize(s) {
  return JSON.stringify(s);
}
export function saveLocal(s) {
  try {
    localStorage.setItem(SAVE_KEY, serialize(s));
    return { ok: true, message: "Laboratory saved on this device." };
  } catch {
    return { ok: false, message: "Browser storage is unavailable. Export a JSON save instead." };
  }
}
export function loadLocal() {
  const value = localStorage.getItem(SAVE_KEY);
  if (!value) return null;
  return validateSave(JSON.parse(value));
}
