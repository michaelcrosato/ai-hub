import * as THREE from "three/webgpu";
import {
  dataset,
  predict,
  perceptronEpoch,
  IMAGE,
  KERNELS,
  convolution,
  attentionWeights,
  weightedValue,
  mseLoss,
  leastSquares,
  descend,
  GRIDWORLD,
  MOVES,
  makeQ,
  cellKind,
  greedy,
  qEpisode,
  seededRandom,
} from "./lesson-math.js";
import { icon } from "./icons.js";
import { PartsBuilder, textTexture } from "./geometry.js";

export const LESSONS = {
  perceptron: {
    number: "01",
    title: "A line that learns.",
    subtitle: "The perceptron · a first-principles experiment",
    intro: "Two kinds of examples. One boundary. Adjust the weights, then let the machine learn from its mistakes.",
    question: "Why can’t one perceptron solve XOR?",
    answers: ["It needs a faster computer.", "No single straight line separates the classes.", "It needs infinitely many examples."],
    correct: 1,
    takeaway:
      "A single thresholded linear unit cannot represent every pattern. Representation, not just compute, limits what can be learned.",
  },
  cnn: {
    number: "02",
    title: "Seeing, one patch at a time.",
    subtitle: "Convolution · shared weights and local features",
    intro: "Slide a 3 × 3 filter over this 7 × 7 image. Each output is a weighted sum of the pixels under the filter.",
    question: "What does weight sharing mean here?",
    answers: [
      "Every image has the same label.",
      "All the pixels have the same value.",
      "The same filter is reused at every image position.",
    ],
    correct: 2,
    takeaway:
      "A convolution reuses a local operation across an image. These hand-set filters are examples; a trained CNN learns its filters.",
  },
  attention: {
    number: "03",
    title: "Context changes everything.",
    subtitle: "Scaled dot-product attention · queries, keys, values",
    intro: "Choose a query token. Dot products with keys produce scores; softmax turns scores into weights; those weights mix values.",
    question: "What does an attention layer combine?",
    answers: [
      "Value vectors, using weights derived from queries and keys.",
      "Whole sentences chosen randomly.",
      "Human-written definitions for every word.",
    ],
    correct: 0,
    takeaway:
      "Attention is a differentiable weighted lookup. These hand-designed vectors show the calculation, not a trained model’s understanding.",
  },
  gradient: {
    number: "04",
    title: "Downhill, one step at a time.",
    subtitle: "Gradient descent · following the slope of the error",
    intro: "Six examples, one straight line to fit. The surface shows the squared error for every weight and bias. Pick a step size and walk downhill.",
    question: "What happens when the learning rate is far too large?",
    answers: [
      "Training becomes perfectly stable.",
      "Steps overshoot the valley, and the error can grow without limit.",
      "The gradient starts pointing uphill.",
    ],
    correct: 1,
    takeaway:
      "Gradient descent follows the local slope downhill. Small steps are slow; steps that are too large overshoot. Backpropagation is how a multilayer network computes that slope for every weight.",
  },
  reward: {
    number: "05",
    title: "Learning from reward.",
    subtitle: "Q-learning · values from trial and error",
    intro: "An agent starts in the corner knowing nothing. The gold square pays +1, dark pits cost −1, and every step costs a little. Run episodes and watch value spread back from the goal.",
    question: "What does the discount factor γ control?",
    answers: [
      "How much future reward counts compared with reward right now.",
      "How often the agent tries a random move.",
      "How many squares the grid world has.",
    ],
    correct: 0,
    takeaway:
      "Q-learning estimates the long-run value of each action from experience. The agent optimizes exactly the reward it is given, so a careless reward produces careless behavior.",
  },
};

const CAPTIONS = {
  perceptron: "SAGE / CLASS +1　·　CLAY / CLASS −1",
  cnn: "INPUT IMAGE　→　SHARED FILTER　→　FEATURE MAP",
  attention: "ILLUSTRATIVE VECTORS　·　NOT A TRAINED LANGUAGE MODEL",
  gradient: "HEIGHT = SQUARED ERROR　·　CLAY PATH = YOUR STEPS　·　GOLD = THE BEST FIT",
  reward: "GOLD = GOAL +1　·　DARK = PIT −1　·　HEIGHT AND ARROWS = LEARNED VALUE",
};

export function lessonMarkup(type, note = "") {
  const l = LESSONS[type];
  let controls = "";
  if (type === "perceptron")
    controls = `<div class="segmented"><button data-lesson="linear" class="active">Two clusters</button><button data-lesson="xor">Try XOR</button></div><label class="range-label">Boundary angle <output id="angle-value">25°</output><input id="angle" type="range" min="-180" max="180" value="25"></label><label class="range-label">Bias <output id="bias-value">0.00</output><input id="bias" type="range" min="-2" max="2" step=".02" value="0"></label><button class="btn primary wide" data-lesson="train">${icon("flask", 17)} Train one epoch</button><div class="equation">ŷ = sign(w₁x₁ + w₂x₂ + b)<br>mistake → w ← w + ηyx</div><div class="lesson-result" id="lesson-result"></div>`;
  if (type === "cnn")
    controls = `<label class="field-label" for="kernel">Choose a filter</label><select id="kernel"><option value="vertical">Vertical edges</option><option value="horizontal">Horizontal edges</option><option value="blur">Box blur</option></select><div class="kernel-grid" id="kernel-grid"></div><div class="button-row"><button class="btn" data-lesson="reset-scan">Reset</button><button class="btn primary" data-lesson="step">Next patch ${icon("arrow", 15)}</button></div><button class="btn subtle wide" data-lesson="auto">${icon("play", 15)} Scan automatically</button><div class="equation">output[r,c] = Σ kernel[i,j]<br>× image[r+i,c+j]</div><div class="lesson-result" id="lesson-result"></div>`;
  if (type === "attention")
    controls = `<label class="field-label">Query token</label><div class="word-options">${["The", "robot", "moved", "because", "it", "was", "curious"].map((w, i) => `<button data-lesson="query" data-value="${i}" class="${i === 4 ? "active" : ""}">${w}</button>`).join("")}</div><label class="range-label">Temperature <output id="temperature-value">0.60</output><input id="temperature" type="range" min=".2" max="2" step=".05" value=".6"></label><label class="check-row"><input type="checkbox" id="causal"> Causal mask (hide future tokens)</label><div class="attention-bars" id="attention-bars"></div><div class="equation">A = softmax(QKᵀ / √dₖ / T)<br>output = AV</div><div class="lesson-result" id="lesson-result"></div>`;
  if (type === "gradient")
    controls = `<label class="range-label">Learning rate η <output id="rate-value">0.30</output><input id="rate" type="range" min="0.05" max="1.2" step="0.05" value="0.3"></label><div class="button-row"><button class="btn" data-lesson="restart">New start</button><button class="btn primary" data-lesson="descend">One step ${icon("arrow", 15)}</button></div><button class="btn subtle wide" data-lesson="descend-10">${icon("play", 15)} Run ten steps</button><div class="equation">L(w,b) = mean((w·x + b − y)²)<br>w ← w − η ∂L/∂w<br>b ← b − η ∂L/∂b</div><div class="lesson-result" id="lesson-result"></div>`;
  if (type === "reward")
    controls = `<label class="range-label">Learning rate α <output id="alpha-value">0.50</output><input id="alpha" type="range" min="0.05" max="1" step="0.05" value="0.5"></label><label class="range-label">Discount γ <output id="gamma-value">0.90</output><input id="gamma" type="range" min="0" max="0.99" step="0.01" value="0.9"></label><label class="range-label">Exploration ε <output id="epsilon-value">0.20</output><input id="epsilon" type="range" min="0" max="0.6" step="0.02" value="0.2"></label><div class="button-row"><button class="btn" data-lesson="reset-q">Reset values</button><button class="btn primary" data-lesson="episode">One episode ${icon("arrow", 15)}</button></div><button class="btn subtle wide" data-lesson="episodes-25">${icon("play", 15)} Run 25 episodes</button><div class="equation">Q(s,a) ← Q(s,a) + α[r + γ maxₐ′ Q(s′,a′) − Q(s,a)]</div><div class="lesson-result" id="lesson-result"></div>`;
  return `<div class="lesson-heading"><div><span class="eyebrow">THE INTERACTIVE NOTEBOOK · LESSON ${l.number}</span><h1>${l.title}</h1><p>${l.subtitle}</p></div><button class="icon-btn" data-action="close-modal" aria-label="Close lesson">${icon("close")}</button></div><div class="lesson-body"><div class="lesson-main"><div class="lesson-intro">${l.intro}</div><div id="lesson-view"></div><div class="lesson-view-caption">${CAPTIONS[type]}　·　DRAG TO TURN</div></div><aside class="lesson-controls">${controls}</aside></div>${note ? `<p class="source-note">${note}</p>` : ""}<div class="lesson-quiz"><span class="eyebrow">CHECK YOUR INTUITION</span><h3>${l.question}</h3><div class="quiz-options">${l.answers.map((a, i) => `<button class="quiz-option" data-lesson="answer" data-value="${i}"><span>${String.fromCharCode(65 + i)}</span>${a}</button>`).join("")}</div><p id="quiz-feedback" aria-live="polite"></p></div>`;
}

/* Shared GPU resources. A notebook rebuilds its scene on every slider move, so it reuses
   one vertex-coloured material, a few see-through ones and cached text tags instead of
   creating new materials each time. */
const shared = { solid: null, box: null, glass: new Map(), tags: new Map() };
function solidMaterial() {
  return (shared.solid ??= new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
}
function unitBox() {
  return (shared.box ??= new THREE.BoxGeometry(1, 1, 1));
}
function glass(color, opacity) {
  const o = Math.round(opacity * 20) / 20;
  const key = color + ":" + o;
  let m = shared.glass.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color, flatShading: true, transparent: o < 1, opacity: o, depthWrite: o >= 1 });
    shared.glass.set(key, m);
  }
  return m;
}
function tagMaterial(text) {
  let m = shared.tags.get(text);
  if (!m) {
    m = new THREE.SpriteMaterial({
      map: textTexture(text, { width: 256, height: 80, bg: "#f5f2e8", fg: "#496254", font: "sans-serif", weight: 500, size: 30 }),
    });
    shared.tags.set(text, m);
  }
  return m;
}

/** Where each notebook's camera starts: distance, turn around the table, tilt from straight down. */
const CAMERAS = {
  perceptron: { dist: Math.hypot(6, 8, 9), yaw: Math.atan2(6, 9), polar: Math.acos(8 / Math.hypot(6, 8, 9)) },
  cnn: { dist: Math.hypot(6, 8, 9), yaw: Math.atan2(6, 9), polar: Math.acos(8 / Math.hypot(6, 8, 9)) },
  attention: { dist: Math.hypot(8, 12), yaw: 0, polar: Math.acos(8 / Math.hypot(8, 12)) },
  gradient: { dist: 12.4, yaw: 0.62, polar: 0.92 },
  reward: { dist: 10.8, yaw: 0.28, polar: 0.82 },
};
const _ca = new THREE.Color();
const _cb = new THREE.Color();
const mix = (a, b, t) => new THREE.Color().copy(_ca.set(a)).lerp(_cb.set(b), Math.max(0, Math.min(1, t)));
const WORDS = ["The", "robot", "moved", "because", "it", "was", "curious"];

export class LessonEngine {
  /**
   * @param {{kit: object, attach: (host: HTMLElement) => void, detach: () => void}} view  borrows the kit canvas
   */
  constructor(view, type, host, onComplete) {
    this.view = view;
    this.kit = view.kit;
    this.type = type;
    this.host = host;
    this.onComplete = onComplete;
    this.weights = [Math.cos(0.4363), Math.sin(0.4363), 0];
    this.points = dataset(false);
    this.epochs = 0;
    this.scan = 0;
    this.kernel = "vertical";
    this.query = 4;
    this.temperature = 0.6;
    this.causal = false;
    this.auto = false;
    this.last = 0;
    this.queue = 0;
    this.timer = 0;
    // Notebook 04
    this.optimum = leastSquares();
    this.starts = [
      [-1.9, 1.8],
      [1.8, -1.9],
      [-1.3, -2.0],
      [2.0, 1.4],
    ];
    this.startIndex = 0;
    this.rate = 0.3;
    this.resetDescent();
    // Notebook 05
    this.alpha = 0.5;
    this.gamma = 0.9;
    this.epsilon = 0.2;
    this.resetQ();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#edece3");
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    this.scene.add(new THREE.HemisphereLight(0xfffce8, 0x8a9d8e, 2.8));
    const sun = new THREE.DirectionalLight(0xfff8e9, 2.5);
    sun.position.set(-4, 8, 5);
    this.scene.add(sun);
    this.solid = new THREE.Mesh(new THREE.BufferGeometry(), solidMaterial());
    this.scene.add(this.solid);
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.tubes = [];
    this.base = CAMERAS[type] || CAMERAS.perceptron;
    this.orbitGoal = { yaw: 0, polar: this.base.polar, zoom: 1 };
    this.orbitView = { ...this.orbitGoal };
    this.target = new THREE.Vector3(0, 0, 0);
    view.attach(host);
    this.bind();
    this.update();
  }
  resetDescent() {
    const [dw, db] = this.starts[this.startIndex % this.starts.length];
    this.w = this.optimum.w + dw;
    this.b = this.optimum.b + db;
    this.trail = [];
    this.steps = 0;
    this.queue = 0;
    this.diverged = false;
  }
  resetQ() {
    this.Q = makeQ();
    this.rng = seededRandom(7);
    this.episodes = 0;
    this.outcomes = [];
    this.lastPath = null;
    this.lastReturn = 0;
    this.lastOutcome = null;
    this.queue = 0;
  }
  stepDescent() {
    const next = descend(this.w, this.b, this.rate);
    // Past this the walk has clearly diverged; stop before the numbers overflow.
    if (!Number.isFinite(next.w) || !Number.isFinite(next.b) || Math.abs(next.w) > 1e6 || Math.abs(next.b) > 1e6) {
      this.queue = 0;
      this.diverged = true;
      return;
    }
    this.trail.push([this.w, this.b]);
    if (this.trail.length > 40) this.trail.shift();
    this.w = next.w;
    this.b = next.b;
    this.steps++;
  }
  runEpisode() {
    const r = qEpisode(this.Q, { alpha: this.alpha, gamma: this.gamma, epsilon: this.epsilon }, this.rng);
    this.episodes++;
    this.lastPath = r.path;
    this.lastReturn = r.ret;
    this.lastOutcome = r.outcome;
    this.outcomes.push(r.outcome === "goal");
    if (this.outcomes.length > 25) this.outcomes.shift();
  }
  bind() {
    const modal = this.host.closest(".modal");
    this.modal = modal;
    this.click = (e) => {
      const b = e.target.closest("[data-lesson]");
      if (!b) return;
      switch (b.dataset.lesson) {
        case "linear":
        case "xor":
          this.points = dataset(b.dataset.lesson === "xor");
          this.weights = [Math.cos(0.4363), Math.sin(0.4363), 0];
          this.epochs = 0;
          modal.querySelectorAll(".segmented button").forEach((p) => p.classList.toggle("active", p === b));
          break;
        case "train":
          this.weights = perceptronEpoch(this.points, this.weights).weights;
          this.epochs++;
          break;
        case "step":
          this.scan = (this.scan + 1) % 25;
          break;
        case "reset-scan":
          this.scan = 0;
          this.setAuto(false);
          break;
        case "auto":
          this.setAuto(!this.auto);
          break;
        case "query":
          this.query = Number(b.dataset.value);
          modal.querySelectorAll('[data-lesson="query"]').forEach((p) => p.classList.toggle("active", p === b));
          break;
        case "restart":
          this.startIndex++;
          this.resetDescent();
          break;
        case "descend":
          this.queue = 0;
          this.stepDescent();
          break;
        case "descend-10":
          this.queue = 10;
          this.timer = 0;
          return;
        case "reset-q":
          this.resetQ();
          break;
        case "episode":
          this.queue = 0;
          this.runEpisode();
          break;
        case "episodes-25":
          this.queue = 25;
          this.timer = 0;
          return;
        case "answer": {
          const correct = Number(b.dataset.value) === LESSONS[this.type].correct;
          const feedback = modal.querySelector("#quiz-feedback");
          feedback.textContent = correct
            ? "Correct. " + LESSONS[this.type].takeaway
            : "Not quite. Change the controls and test the idea again.";
          feedback.className = correct ? "success-text" : "warning-text";
          b.classList.toggle("correct", correct);
          if (correct) this.onComplete(this.type);
          return;
        }
      }
      this.update();
    };
    modal.addEventListener("click", this.click);
    const field = (id, fn) => {
      const el = modal.querySelector("#" + id);
      if (el) el.addEventListener("input", () => fn(el));
      return el;
    };
    field("angle", (el) => {
      const a = (Number(el.value) * Math.PI) / 180;
      this.weights = [Math.cos(a), Math.sin(a), this.weights[2]];
      this.update();
    });
    field("bias", (el) => {
      this.weights[2] = Number(el.value);
      this.update();
    });
    const kernel = modal.querySelector("#kernel");
    if (kernel)
      kernel.addEventListener("change", () => {
        this.kernel = kernel.value;
        this.update();
      });
    field("temperature", (el) => {
      this.temperature = Number(el.value);
      this.update();
    });
    const causal = modal.querySelector("#causal");
    if (causal)
      causal.addEventListener("change", () => {
        this.causal = causal.checked;
        this.update();
      });
    field("rate", (el) => {
      this.rate = Number(el.value);
      this.update();
    });
    for (const k of ["alpha", "gamma", "epsilon"])
      field(k, (el) => {
        this[k] = Number(el.value);
        this.update();
      });
  }
  setAuto(on) {
    this.auto = on;
    const b = this.modal.querySelector('[data-lesson="auto"]');
    if (b) b.innerHTML = on ? `${icon("pause", 15)} Pause scanning` : `${icon("play", 15)} Scan automatically`;
  }
  $(q) {
    return this.modal.querySelector(q);
  }
  update() {
    if (this.type === "perceptron") {
      const correct = this.points.filter((p) => predict(p, this.weights) === p.label).length;
      const angle = (Math.atan2(this.weights[1], this.weights[0]) * 180) / Math.PI;
      this.$("#angle-value").textContent = angle.toFixed(0) + "°";
      this.$("#angle").value = angle;
      this.$("#bias-value").textContent = this.weights[2].toFixed(2);
      this.$("#bias").value = this.weights[2];
      this.$("#lesson-result").innerHTML =
        `<strong>${Math.round((correct / this.points.length) * 100)}% accuracy</strong><span>${correct} / ${this.points.length} examples · ${this.epochs} epochs</span>`;
    }
    if (this.type === "cnn") {
      this.output = convolution(IMAGE, KERNELS[this.kernel]);
      const row = Math.floor(this.scan / 5),
        col = this.scan % 5;
      this.$("#kernel-grid").innerHTML = KERNELS[this.kernel]
        .flat()
        .map((v) => `<span>${v === 1 / 9 ? "⅑" : v}</span>`)
        .join("");
      this.$("#lesson-result").innerHTML =
        `<strong>Response: ${this.output[row][col].toFixed(2)}</strong><span>Output [${row}, ${col}] · no padding · stride 1</span>`;
    }
    if (this.type === "attention") {
      const keys = [
        [0.1, 0.1, 0.2],
        [2.8, 0.1, 0.9],
        [0.3, 2, 0.4],
        [0.1, 0.8, 0.1],
        [0.7, 0.3, 1.1],
        [0.1, 0.5, 0.1],
        [0.6, 1.5, 1.6],
      ];
      const q = this.query === 4 ? [2.8, 0.25, 1.0] : keys[this.query];
      this.attention = attentionWeights(q, keys, this.temperature, (i) => this.causal && i > this.query);
      this.values = [
        [0.1, 0.2],
        [1, 0.1],
        [0.2, 0.9],
        [0.1, 0.1],
        [0.6, 0.5],
        [0.1, 0.2],
        [0.7, 0.8],
      ];
      const result = weightedValue(this.attention, this.values);
      this.$("#temperature-value").textContent = this.temperature.toFixed(2);
      this.$("#attention-bars").innerHTML = WORDS.map(
        (w, i) =>
          `<div><span>${w}</span><i style="--bar:${this.attention[i] * 100}%"></i><small>${(this.attention[i] * 100).toFixed(0)}%</small></div>`,
      ).join("");
      this.$("#lesson-result").innerHTML =
        `<strong>Weights sum to ${this.attention.reduce((a, b) => a + b, 0).toFixed(2)}</strong><span>Mixed value: [${result.map((v) => v.toFixed(3)).join(", ")}]</span>`;
    }
    if (this.type === "gradient") {
      const loss = mseLoss(this.w, this.b),
        best = mseLoss(this.optimum.w, this.optimum.b),
        prev = this.trail.length ? mseLoss(...this.trail.at(-1)) : null;
      const far = Math.abs(this.w - this.optimum.w) > 2.4 || Math.abs(this.b - this.optimum.b) > 2.4;
      const status = this.diverged
        ? "Diverged: every step overshot further. Lower η and choose New start."
        : loss - best < 0.002
          ? "Reached the valley floor: the best straight-line fit."
          : prev !== null && loss > prev
            ? far
              ? "Diverging: each step overshoots further than the last."
              : "Overshooting: the error rose on that step."
            : this.steps
              ? "Heading downhill."
              : "Choose a step size, then take a step.";
      this.$("#rate-value").textContent = this.rate.toFixed(2);
      this.$("#lesson-result").innerHTML =
        `<strong>Error ${loss < 1000 ? loss.toFixed(3) : loss.toExponential(1)}</strong><span>w = ${this.w.toFixed(2)} · b = ${Math.abs(this.b) < 1000 ? this.b.toFixed(2) : this.b.toExponential(1)} · ${this.steps} steps</span><span>${status}</span>`;
    }
    if (this.type === "reward") {
      const wins = this.outcomes.filter(Boolean).length;
      const rate = this.outcomes.length ? Math.round((wins / this.outcomes.length) * 100) : 0;
      this.$("#alpha-value").textContent = this.alpha.toFixed(2);
      this.$("#gamma-value").textContent = this.gamma.toFixed(2);
      this.$("#epsilon-value").textContent = this.epsilon.toFixed(2);
      this.$("#lesson-result").innerHTML = this.episodes
        ? `<strong>${rate}% of recent episodes reach the goal</strong><span>${this.episodes} episodes · last return ${this.lastReturn.toFixed(2)} · ${this.lastOutcome === "goal" ? "found the goal" : this.lastOutcome === "pit" ? "fell into a pit" : "ran out of steps"}</span>`
        : `<strong>No experience yet</strong><span>Every value starts at zero. Run an episode.</span>`;
    }
    this.rebuild();
  }

  /* ---- the 3D view */
  clearDynamic() {
    for (const t of this.tubes) t.dispose();
    this.tubes.length = 0;
    this.group.clear();
  }
  glassBox(w, h, d, x, y, z, color, opacity) {
    const m = new THREE.Mesh(unitBox(), glass(color, opacity));
    m.scale.set(w, h, d);
    m.position.set(x, y, z);
    m.renderOrder = 2;
    this.group.add(m);
    return m;
  }
  text(text, x, y, z, width = 1) {
    const sprite = new THREE.Sprite(tagMaterial(text));
    sprite.scale.set(width, width * 0.31, 1);
    sprite.position.set(x, y, z);
    this.group.add(sprite);
  }
  rebuild() {
    this.clearDynamic();
    const B = new PartsBuilder();
    if (this.type === "perceptron") {
      B.box(5, 0.13, 5, 0, -0.07, 0, "#d8ddca");
      for (let i = -2; i <= 2; i++) {
        B.box(0.013, 0.01, 4.8, i, 0.008, 0, "#b2bda5");
        B.box(4.8, 0.01, 0.013, 0, 0.008, i, "#b2bda5");
      }
      for (const p of this.points) B.ico(0.13, 1, p.x, 0.2, p.z, p.label === 1 ? "#789771" : "#c69270");
      const [w1, w2, b] = this.weights,
        n2 = w1 * w1 + w2 * w2;
      const plane = this.glassBox(6, 1.5, 0.026, (-b * w1) / n2, 0.77, (-b * w2) / n2, "#6f947b", 0.32);
      plane.rotation.y = Math.atan2(w1, w2);
      this.text("class +1", 1.5, 0.75, -2.5, 1.2);
      this.text("class −1", -1.5, 0.75, 2.3, 1.2);
    }
    if (this.type === "cnn") {
      for (let r = 0; r < 7; r++)
        for (let c = 0; c < 7; c++)
          B.box(0.47, 0.1 + IMAGE[r][c] * 0.25, 0.47, c * 0.51 - 4.4, 0.05 + IMAGE[r][c] * 0.125, r * 0.51 - 1.55, IMAGE[r][c] ? "#728c76" : "#d7ddca");
      const row = Math.floor(this.scan / 5),
        col = this.scan % 5;
      this.glassBox(1.54, 0.055, 1.54, col * 0.51 - 3.89, 0.56, row * 0.51 - 1.04, "#d5ac6e", 0.5);
      for (let r = 0; r < 5; r++)
        for (let c = 0; c < 5; c++) {
          const v = this.output[r][c];
          B.box(0.44, 0.14 + Math.abs(v) * 0.14, 0.44, c * 0.5 + 0.8, 0.06 + Math.abs(v) * 0.07, r * 0.5 - 1.05, v > 0 ? "#82a38a" : v < 0 ? "#c89777" : "#d5dccd");
        }
      this.glassBox(0.49, 0.045, 0.49, col * 0.5 + 0.8, 0.88, row * 0.5 - 1.05, "#c79c60", 0.6);
      this.text("7 × 7 input", -2.8, 0.8, 2.5, 2);
      this.text("5 × 5 feature map", 1.9, 1.0, 2.2, 2.5);
    }
    if (this.type === "attention") {
      for (let i = 0; i < 7; i++) {
        const x = (i - 3) * 1.15;
        B.box(0.94, 0.26 + 0.7 * this.attention[i], 0.65, x, 0.18 + 0.35 * this.attention[i], 0, i === this.query ? "#c19974" : "#a2b49b");
        this.text(WORDS[i], x, 1.5, 0, 1.03);
        if (i !== this.query && this.attention[i] > 0.005) {
          const curve = new THREE.QuadraticBezierCurve3(
            new THREE.Vector3((this.query - 3) * 1.15, 0.5, 0),
            new THREE.Vector3((i + this.query - 6) * 0.58, 2 + Math.abs(i - this.query) * 0.15, -0.8),
            new THREE.Vector3(x, 0.55, 0),
          );
          const geo = new THREE.TubeGeometry(curve, 18, 0.015 + this.attention[i] * 0.08, 4, false);
          this.tubes.push(geo);
          const tube = new THREE.Mesh(geo, glass("#86a98b", 0.3 + this.attention[i] * 0.7));
          tube.renderOrder = 2;
          this.group.add(tube);
        }
      }
      this.text("QUERY: " + WORDS[this.query], 0, 0.2, 2.5, 2.6);
    }
    if (this.type === "gradient") this.buildDescent(B);
    if (this.type === "reward") this.buildGridWorld(B);
    const old = this.solid.geometry;
    this.solid.geometry = B.build();
    old.dispose();
  }
  buildDescent(B) {
    const N = 13,
      R = 2.4,
      half = 2.6,
      cell = (2 * half) / N,
      k = half / R,
      { w: ow, b: ob } = this.optimum;
    const lmax = mseLoss(ow + R, ob + R);
    const height = (L) => 0.1 + 1.25 * Math.sqrt(Math.min(L, lmax) / lmax);
    B.box(2 * half + 0.3, 0.08, 2 * half + 0.3, 0, -0.04, 0, "#d8ddca");
    for (let i = 0; i < N; i++)
      for (let j = 0; j < N; j++) {
        const dw = -R + (i + 0.5) * ((2 * R) / N),
          db = -R + (j + 0.5) * ((2 * R) / N),
          L = mseLoss(ow + dw, ob + db),
          h = height(L);
        B.box(cell * 0.9, h, cell * 0.9, dw * k, h / 2, -db * k, mix("#728c76", "#e6e1d2", Math.sqrt(L / lmax)));
      }
    B.box(0.2, 0.05, 0.2, 0, height(mseLoss(ow, ob)) + 0.03, 0, "#d5ac6e");
    const place = (w, b) => {
      const x = Math.max(-half, Math.min(half, (w - ow) * k)),
        z = Math.max(-half, Math.min(half, -(b - ob) * k));
      return [x, z, height(mseLoss(w, b))];
    };
    this.trail.forEach(([w, b], i) => {
      const [x, z, h] = place(w, b);
      B.box(0.09, 0.09, 0.09, x, h + 0.1, z, i === this.trail.length - 1 ? "#b9855f" : "#c69270");
    });
    const [x, z, h] = place(this.w, this.b);
    const outside = Math.abs(this.w - ow) > R || Math.abs(this.b - ob) > R;
    B.ico(0.15, 1, x, h + 0.17, z, outside ? "#b77861" : "#c19974");
    this.text("weight w", 0, 0.12, half + 0.55, 1.4);
    this.text("bias b", half + 0.75, 0.12, 0, 1.2);
  }
  buildGridWorld(B) {
    const S = GRIDWORLD.size,
      gap = 0.95,
      pos = (c, r) => [(c - (S - 1) / 2) * gap, (r - (S - 1) / 2) * gap];
    B.box(S * gap + 0.3, 0.08, S * gap + 0.3, 0, -0.04, 0, "#d8ddca");
    const tileHeight = (c, r) => {
      const kind = cellKind(c, r);
      if (kind === "goal") return 0.3;
      if (kind === "pit") return 0.04;
      const q = this.Q[r * S + c];
      return q.some((v) => v !== 0) ? 0.12 + Math.max(0, Math.max(...q)) * 0.75 : 0.12;
    };
    for (let r = 0; r < S; r++)
      for (let c = 0; c < S; c++) {
        const [x, z] = pos(c, r),
          kind = cellKind(c, r);
        if (kind === "goal") {
          B.box(0.86, 0.3, 0.86, x, 0.15, z, "#d5ac6e");
          B.box(0.04, 0.6, 0.04, x + 0.26, 0.6, z - 0.26, "#8c8671");
          B.box(0.3, 0.17, 0.02, x + 0.41, 0.8, z - 0.26, "#c79c60");
          continue;
        }
        if (kind === "pit") {
          B.box(0.86, 0.04, 0.86, x, 0.02, z, "#55665a");
          B.box(0.58, 0.045, 0.58, x, 0.025, z, "#3f4c43");
          continue;
        }
        const q = this.Q[r * S + c],
          visited = q.some((v) => v !== 0),
          V = Math.max(...q),
          h = tileHeight(c, r);
        const color = !visited ? "#e3dfd0" : V >= 0 ? mix("#d7ddca", "#728c76", V) : mix("#d7ddca", "#c69270", -V);
        B.box(0.86, h, 0.86, x, h / 2, z, color);
        if (visited) {
          const [dx, dz] = MOVES[greedy(q)];
          B.box(dx ? 0.3 : 0.07, 0.04, dz ? 0.3 : 0.07, x + dx * 0.06, h + 0.02, z + dz * 0.06, "#496254");
          B.box(0.13, 0.04, 0.13, x + dx * 0.24, h + 0.02, z + dz * 0.24, "#496254", 0, Math.PI / 4, 0);
        }
      }
    const path = this.lastPath || [GRIDWORLD.start];
    const seen = new Set();
    path.forEach(([c, r], i) => {
      if (i === path.length - 1 || seen.has(c + "," + r)) return;
      seen.add(c + "," + r);
      const [x, z] = pos(c, r);
      B.box(0.1, 0.1, 0.1, x, tileHeight(c, r) + 0.11, z, "#c69270");
    });
    const [ec, er] = path.at(-1);
    const [ex, ez] = pos(ec, er);
    B.ico(0.16, 1, ex, tileHeight(ec, er) + 0.2, ez, this.lastOutcome === "pit" ? "#b77861" : "#c19974");
    const [sx, sz] = pos(...GRIDWORLD.start);
    this.text("start", sx, 0.95, sz + 0.2, 0.9);
    const [gx, gz] = pos(...GRIDWORLD.goal);
    this.text("goal +1", gx, 1.25, gz, 1.1);
    for (const [pc, pr] of GRIDWORLD.pits) {
      const [px, pz] = pos(pc, pr);
      this.text("pit −1", px, 0.55, pz, 0.9);
    }
  }

  /** Drag (or right stick) to turn the notebook view; wheel or pinch to move closer. */
  orbitBy(dx, dy) {
    const g = this.orbitGoal;
    g.yaw = Math.max(-1.1, Math.min(1.1, g.yaw - dx));
    g.polar = Math.max(0.3, Math.min(1.3, g.polar - dy));
  }
  zoomBy(f) {
    this.orbitGoal.zoom = Math.max(0.65, Math.min(1.5, this.orbitGoal.zoom * f));
  }
  render(t, dt) {
    if (this.type === "cnn" && this.auto && t - this.last > 0.65) {
      this.scan = (this.scan + 1) % 25;
      this.last = t;
      this.update();
    }
    if (this.queue > 0) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.queue--;
        if (this.type === "gradient") {
          this.stepDescent();
          this.timer = 0.14;
        } else if (this.type === "reward") {
          this.runEpisode();
          this.timer = 0.08;
        }
        this.update();
      }
    }
    const k = 1 - Math.exp(-10 * dt),
      v = this.orbitView,
      g = this.orbitGoal;
    v.yaw += (g.yaw - v.yaw) * k;
    v.polar += (g.polar - v.polar) * k;
    v.zoom += (g.zoom - v.zoom) * k;
    const dist = this.base.dist * v.zoom,
      yaw = this.base.yaw + v.yaw,
      sp = Math.sin(v.polar);
    this.camera.position.set(dist * sp * Math.sin(yaw), dist * Math.cos(v.polar), dist * sp * Math.cos(yaw));
    this.camera.lookAt(this.target);
    const { width, height } = this.kit.size;
    const aspect = width / Math.max(1, height);
    if (Math.abs(this.camera.aspect - aspect) > 1e-4) {
      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
    }
    this.kit.renderer.render(this.scene, this.camera);
  }
  dispose() {
    this.auto = false;
    this.queue = 0;
    this.modal.removeEventListener("click", this.click);
    this.clearDynamic();
    this.solid.geometry.dispose();
    this.view.detach();
  }
}
