import { helmetTexture } from "./art.js";
import { drawDefense, drawKick, drawOffense } from "./playbook.js";
import { DEFENSE_PAGES, DEFENSE_PLAYS, OFFENSE_PAGES, OFFENSE_PLAYS } from "./plays.js";
import { TEAMS, byPos, overall, teamRatings } from "./teams.js";
import { promptSet } from "./input.js";
import { CHALLENGES } from "./challenges.js";
import { challengeStatus, loadRecords } from "./records.js";

export const html = (e) => {
  let t = document.createElement(`template`);
  return ((t.innerHTML = e.trim()), t.content.firstElementChild);
};
export const teamBg = (e) =>
  `background: linear-gradient(160deg, ${e.colors.jersey}, ${e.colors.dark}); color: #fff;`;
export const UI = class {
  input;
  audio;
  root;
  hudEl;
  splashEl;
  flashEl;
  updaters = new Set();
  fireEl = null;
  hud;
  lbTop;
  lbBot;
  replayEl = null;
  frozen = null; // updaters paused underneath the pause menu
  openKitMenu = () => {}; // the kit's graphics & controls panel (set by main.js)
  onPauseRequest = null; // pause chip on the play-select screen (set by main.js)
  constructor(e, t) {
    this.input = e;
    this.audio = t;
    this.root = html(`<div id="ui"></div>`);
    document.body.appendChild(this.root);
    this.hudEl = html(`<div id="hud" class="hidden"></div>`);
    this.root.appendChild(this.hudEl);
    this.splashEl = html(`<div id="splash"></div>`);
    document.body.appendChild(this.splashEl);
    this.flashEl = html(`<div class="flash"></div>`);
    document.body.appendChild(this.flashEl);
    this.lbTop = html(`<div class="letterbox top"></div>`);
    this.lbBot = html(`<div class="letterbox bot"></div>`);
    document.body.append(this.lbTop, this.lbBot);
    this.hud = new Hud(this.hudEl);
  }
  update(e) {
    for (let t of [...this.updaters]) (this.frozen && this.frozen.has(t)) || t(e);
  }
  /** Freeze every screen that is running now (the pause menu opens on top and keeps running). */
  freeze(on) {
    this.frozen = on ? new Set(this.updaters) : null;
  }
  /** True while a menu, dialog or results screen is up (touch controls hide then). */
  hasScreen() {
    return this.root.childElementCount > 1;
  }
  loop(e) {
    return (this.updaters.add(e), () => this.updaters.delete(e));
  }
  mount(e) {
    return (e.classList.add(`screen`), this.root.appendChild(e), e);
  }
  ctrls() {
    return [this.input.p1, this.input.p2];
  }
  splash(e, t = `big`, n) {
    if (t === `big` || t === `bad` || t === `fire`)
      for (let e of Array.from(this.splashEl.querySelectorAll(`.big, .bad, .fire`))) e.remove();
    if (t === `small` || t === `mid`)
      for (let e of Array.from(this.splashEl.querySelectorAll(`.` + t))) e.remove();
    let r = html(`<div class="splash ${t}"></div>`);
    r.textContent = e;
    n && (r.style.color = n);
    this.splashEl.appendChild(r);
    setTimeout(() => r.remove(), t === `big` || t === `fire` ? 2300 : 1700);
    t === `big` && this.flash();
  }
  flash() {
    this.flashEl.classList.remove(`go`);
    this.flashEl.offsetWidth;
    this.flashEl.classList.add(`go`);
  }
  banner(e, t, n) {
    let r = html(`<div class="banner"><div class="a"></div><div class="b"></div></div>`);
    r.querySelector(`.a`).textContent = e;
    r.querySelector(`.b`).textContent = t;
    n && (r.querySelector(`.a`).style.color = n);
    document.body.appendChild(r);
    setTimeout(() => r.remove(), 3100);
  }
  fire(e) {
    e && !this.fireEl
      ? ((this.fireEl = html(`<div class="vignette-fire"></div>`)), document.body.appendChild(this.fireEl))
      : !e && this.fireEl && (this.fireEl.remove(), (this.fireEl = null));
  }
  replayMode(e) {
    this.lbTop.classList.toggle(`on`, e);
    this.lbBot.classList.toggle(`on`, e);
    e && !this.replayEl
      ? ((this.replayEl = html(`<div class="replay-tag">INSTANT REPLAY</div>`)),
        document.body.appendChild(this.replayEl))
      : !e && this.replayEl && (this.replayEl.remove(), (this.replayEl = null));
  }
  clearSplashes() {
    this.splashEl.innerHTML = ``;
  }
  /** "Press start" line for whatever the player is holding. */
  startPrompt() {
    const src = this.input.p1.source;
    return src === `gamepad`
      ? `<span class="key">A</span> / <span class="key">START</span>`
      : src === `touch`
        ? `<span class="key">TAP</span>`
        : `<span class="key">SPACE</span> / <span class="key">ENTER</span>`;
  }
  async title(e) {
    let t = this.mount(
      html(`<div id="title">
        <div class="stripes"></div>
        <div class="logo bounce"><div class="bricks"><i></i><i></i><i></i><i></i><i></i></div><div class="l1">BRICK BOWL</div><div class="l2"><span>TURBO!</span></div></div>
        <div class="press">PRESS START</div>
        <div class="sub">11-on-11 arcade football · <span class="prompt"></span></div>
        <div class="renderer-tag">${e}</div>
      </div>`),
    );
    const prompt = t.querySelector(`.prompt`);
    let shown = ``;
    this.audio.playMusic(`title`);
    await new Promise((e) => {
      let n = this.loop(() => {
        const p = this.startPrompt();
        p !== shown && (prompt.innerHTML = shown = p);
        for (let t of this.ctrls())
          if (t.consume(`confirm`) || t.consume(`action`) || t.consume(`pause`)) {
            n();
            e();
            return;
          }
      });
      t.addEventListener(`pointerdown`, () => {
        n();
        e();
      });
    });
    this.audio.play(`select`);
    t.remove();
  }
  /**
   * A vertical menu driven by keyboard, gamepad, mouse or touch.
   * items: { id, label, values?, value?, desc? } — values cycle with left/right.
   * back: allow Back/B/Esc; it picks backId (default: the last item).
   * foot: HTML or a function returning HTML (re-rendered when the input device changes).
   */
  async listMenu(e) {
    let t = this.mount(html(`<div class="menu-screen"><div class="stripes"></div></div>`));
    e.logo &&
      t.appendChild(
        html(
          `<div class="logo"><div class="bricks"><i></i><i></i><i></i><i></i><i></i></div><div class="l1">BRICK BOWL</div><div class="l2"><span>TURBO!</span></div></div>`,
        ),
      );
    e.title && t.appendChild(html(`<div class="screen-title">${e.title}</div>`));
    let n = html(`<div class="menu-list"></div>`);
    t.appendChild(n);
    const hasDesc = e.items.some((x) => x.desc),
      descEl = hasDesc ? html(`<div class="menu-desc"></div>`) : null;
    descEl && t.appendChild(descEl);
    const footEl = e.foot ? html(`<div class="menu-foot hint"></div>`) : null;
    footEl && t.appendChild(footEl);
    let footShown = null;
    const renderFoot = () => {
      if (!footEl) return;
      const f = typeof e.foot === `function` ? e.foot() : e.foot;
      f !== footShown && (footEl.innerHTML = footShown = f);
    };
    renderFoot();
    let r = {},
      i = e.items.map((e, t) => {
        r[e.id] = e.value ?? 0;
        let i = html(`<div class="btn"><span></span></div>`),
          a = () => {
            i.firstElementChild.innerHTML = e.values
              ? `${e.label}<span class="val">◀ ${e.values[r[e.id]]} ▶</span>`
              : e.label;
          };
        return (
          a(),
          i.addEventListener(`pointerenter`, () => o(t)),
          i.addEventListener(`pointerdown`, () => {
            o(t);
            e.values ? ((r[e.id] = (r[e.id] + 1) % e.values.length), a(), this.audio.play(`blip`)) : u();
          }),
          n.appendChild(i),
          { b: i, render: a }
        );
      }),
      a = 0,
      o = (t) => {
        a = (t + i.length) % i.length;
        i.forEach((e, t) => e.b.classList.toggle(`sel`, t === a));
        descEl && (descEl.textContent = e.items[a].desc ?? ``);
        // Keep the choice visible in long lists on short screens.
        i[a].b.scrollIntoView?.({ block: `nearest` });
      };
    o(Math.max(0, e.start ?? 0));
    let s,
      c = new Promise((e) => (s = e)),
      l = false,
      u = () => {
        l || ((l = true), this.audio.play(`select`), d(), t.remove(), s({ id: e.items[a].id, values: r }));
      },
      d = this.loop(() => {
        renderFoot();
        for (let t of this.ctrls()) {
          t.consume(`up`) && (o(a - 1), this.audio.play(`blip`));
          t.consume(`down`) && (o(a + 1), this.audio.play(`blip`));
          let n = e.items[a];
          if (n.values) {
            let e = t.consume(`right`) ? 1 : t.consume(`left`) ? -1 : 0;
            e &&
              ((r[n.id] = (r[n.id] + e + n.values.length) % n.values.length),
              i[a].render(),
              this.audio.play(`blip`));
          }
          (t.consume(`confirm`) || t.consume(`action`)) &&
            (n.values
              ? ((r[n.id] = (r[n.id] + 1) % n.values.length), i[a].render(), this.audio.play(`blip`))
              : u());
          if (e.back && (t.consume(`back`) || t.consume(`special`) || t.consume(`pause`))) {
            const idx = e.backId ? e.items.findIndex((x) => x.id === e.backId) : -1;
            a = idx >= 0 ? idx : e.items.length - 1;
            u();
          }
        }
      });
    return c;
  }
  /** Foot line for menus: navigation prompts for the device in use. */
  menuFoot(extra = ``) {
    const src = this.input.p1.source,
      nav =
        src === `gamepad`
          ? `<span class="key">D-PAD</span> choose · <span class="key">A</span> select · <span class="key">B</span> back`
          : src === `touch`
            ? `tap to choose`
            : `<span class="key">↑</span><span class="key">↓</span> choose · <span class="key">SPACE</span> select · <span class="key">BKSP</span> back`;
    return extra ? `${nav} &nbsp;·&nbsp; ${extra}` : nav;
  }
  async mainMenu(e, start = 0) {
    this.audio.playMusic(`title`);
    return (
      await this.listMenu({
        logo: true,
        start,
        items: [
          { id: `1p`, label: `1 PLAYER` },
          { id: `2p`, label: `2 PLAYERS` },
          { id: `challenges`, label: `CLUTCH CHALLENGES` },
          { id: `cpu`, label: `CPU VS CPU` },
          { id: `rosters`, label: `ROSTERS` },
          { id: `records`, label: `RECORDS` },
          { id: `howto`, label: `HOW TO PLAY` },
          { id: `settings`, label: `SETTINGS` },
        ],
        foot: () => this.menuFoot(e),
      })
    ).id;
  }
  /** Wait until the kit's settings panel has closed (the kit pauses our loop while it is open). */
  kitMenu() {
    this.openKitMenu();
    return new Promise((r) => {
      const off = this.loop(() => {
        off();
        r();
      });
    });
  }
  async settingsMenu(e) {
    let t = [`OFF`, `ON`],
      start = 0;
    for (;;) {
      const n = await this.listMenu({
        title: `SETTINGS`,
        back: true,
        backId: `done`,
        start,
        items: [
          {
            id: `penalties`,
            label: `PENALTIES`,
            values: t,
            value: +!!e.penalties,
            desc: `Flags for holding, pass interference, offside and more.`,
          },
          {
            id: `announcer`,
            label: `ANNOUNCER`,
            values: t,
            value: +!!e.announcer,
            desc: `Play-by-play voice (uses the browser's speech voices).`,
          },
          { id: `music`, label: `MUSIC`, values: t, value: +!!e.music, desc: `Menu and play-select music.` },
          {
            id: `sfx`,
            label: `SOUND FX`,
            values: t,
            value: +!!e.sfx,
            desc: `Hits, whistles, crowd and fireworks.`,
          },
          {
            id: `bloom`,
            label: `BLOOM FX`,
            values: t,
            value: +!!e.bloom,
            desc: `Glow on bright lights and scoreboards.`,
          },
          {
            id: `graphics`,
            label: `GRAPHICS & CONTROLS`,
            desc: `Quality, resolution, frame cap, touch layout, vibration (F9 anywhere).`,
          },
          { id: `done`, label: `DONE` },
        ],
        foot: () => this.menuFoot(),
      });
      e.penalties = n.values.penalties === 1;
      e.announcer = n.values.announcer === 1;
      e.music = n.values.music === 1;
      e.sfx = n.values.sfx === 1;
      e.bloom = n.values.bloom === 1;
      if (n.id !== `graphics`) return;
      start = 5;
      await this.kitMenu();
    }
  }
  async teamSelect(e, t) {
    let n = this.mount(html(`<div class="menu-screen"><div class="stripes"></div></div>`));
    n.appendChild(html(`<div class="screen-title">${e === `cpu` ? `EXHIBITION` : `PICK YOUR TEAM`}</div>`));
    let r = html(`<div class="teams-row"></div>`);
    n.appendChild(r);
    let i = TEAMS.map((e) => {
        let t = html(`<div class="team-card" style="${teamBg(e)}"><div class="stripes"></div>
        <div class="tag"></div>
        <div class="city">${e.city.toUpperCase()}</div><div class="name">${e.name.toUpperCase()}</div>
        <div class="motto">"${e.motto}"</div></div>`),
          n = helmetTexture(e).image,
          i = document.createElement(`canvas`);
        i.width = 96;
        i.height = 96;
        i.getContext(`2d`).drawImage(n, 0, 0, 96, 96);
        i.style.borderRadius = `18px`;
        i.style.border = `4px solid #0d0721`;
        t.appendChild(i);
        let a = teamRatings(e);
        for (let [e, n] of Object.entries(a))
          t.appendChild(
            html(
              `<div class="rating"><span>${e}</span><div class="bar"><div style="width:${n}%"></div></div><b>${n}</b></div>`,
            ),
          );
        let o = e.roster
          .filter((e) => e.nick)
          .slice(0, 4)
          .map((e) => `★ #${e.num} ${e.first} "${e.nick}" ${e.last} <i>(${e.pos})</i>`)
          .join(`<br>`);
        return (t.appendChild(html(`<div class="stars">${o}</div>`)), r.appendChild(t), t);
      }),
      a = [2, 3, 5, 8, 15],
      o = [`rookie`, `pro`, `legend`],
      s = Math.max(0, a.indexOf(t.quarterMinutes)),
      c = Math.max(0, o.indexOf(t.difficulty)),
      l = html(`<div class="opts-row"></div>`),
      u = html(`<div class="btn"><span></span></div>`),
      d = html(`<div class="btn"><span></span></div>`),
      f = html(`<div class="btn"><span>KICK OFF!</span></div>`),
      backBtn = html(`<div class="btn back-btn"><span>BACK</span></div>`);
    l.append(u, d, f, backBtn);
    n.appendChild(l);
    const footEl = html(`<div class="menu-foot hint"></div>`);
    n.appendChild(footEl);
    let footShown = ``;
    const renderFoot = () => {
      const src = this.input.p1.source,
        f =
          src === `gamepad`
            ? `<span class="key">◀</span><span class="key">▶</span> change · <span class="key">▲</span><span class="key">▼</span> row · <span class="key">A</span> start · <span class="key">B</span> back`
            : src === `touch`
              ? `tap a team, tap the options to change them, then KICK OFF!`
              : `<span class="key">◀</span><span class="key">▶</span> change · <span class="key">↑</span><span class="key">↓</span> row · <span class="key">SPACE</span> start · <span class="key">BKSP</span> back`;
      f !== footShown && (footEl.innerHTML = footShown = f);
    };
    renderFoot();
    let p = 0,
      m = 0,
      h = () => {
        i.forEach((t, n) => {
          t.classList.toggle(`sel`, n === p);
          t.classList.toggle(`dim`, e !== `cpu` && n !== p);
          let r = t.querySelector(`.tag`);
          r.textContent =
            e === `cpu` ? (n === 0 ? `HOME CPU` : `AWAY CPU`) : n === p ? `P1` : e === `2p` ? `P2` : `CPU`;
        });
        u.firstElementChild.innerHTML = `QUARTERS<span class="val">◀ ${a[s]} MIN ▶</span>`;
        d.firstElementChild.innerHTML = `CPU<span class="val">◀ ${o[c].toUpperCase()} ▶</span>`;
        u.classList.toggle(`sel`, m === 1);
        d.classList.toggle(`sel`, m === 2);
        f.classList.toggle(`sel`, m === 3);
        r.style.outline = ``;
      };
    h();
    i.forEach((e, t) =>
      e.addEventListener(`pointerdown`, () => {
        p = t;
        m = 0;
        h();
      }),
    );
    u.addEventListener(`pointerdown`, () => {
      s = (s + 1) % a.length;
      m = 1;
      h();
    });
    d.addEventListener(`pointerdown`, () => {
      c = (c + 1) % o.length;
      m = 2;
      h();
    });
    let g = await new Promise((e) => {
      f.addEventListener(`pointerdown`, () => {
        t();
        e({ p1Team: p });
      });
      backBtn.addEventListener(`pointerdown`, () => {
        t();
        e(null);
      });
      let t = this.loop(() => {
        renderFoot();
        let changed = false;
        for (let n of this.ctrls()) {
          n.edges.size && (changed = true);
          let r = n.consume(`right`) ? 1 : n.consume(`left`) ? -1 : 0;
          if (
            (n.consume(`down`) && ((m = Math.min(3, m + 1)), this.audio.play(`blip`)),
            n.consume(`up`) && ((m = Math.max(0, m - 1)), this.audio.play(`blip`)),
            r &&
              (this.audio.play(`blip`),
              m === 0 && (p = +(p === 0)),
              m === 1 && (s = (s + r + a.length) % a.length),
              m === 2 && (c = (c + r + o.length) % o.length)),
            n.consume(`confirm`) || n.consume(`action`))
          ) {
            if (m === 3 || m === 0) {
              t();
              e({ p1Team: p });
              return;
            }
            m++;
          }
          if (n.consume(`back`) || n.consume(`pause`)) {
            t();
            e(null);
            return;
          }
        }
        changed && h();
      });
    });
    if ((n.remove(), (t.quarterMinutes = a[s]), (t.difficulty = o[c]), !g)) throw Error(`back`);
    return (this.audio.play(`select`), g);
  }
  async rosters() {
    let e = this.mount(
        html(
          `<div class="menu-screen"><div class="panel roster-wrap"><div class="roster-tabs"></div><div class="roster-table"></div><div class="hint" style="margin-top:8px"><span class="key">◀</span><span class="key">▶</span> team · <span class="key">BKSP</span>/<span class="key">SPACE</span>/<span class="key">B</span> back</div><div class="btn back-btn"><span>BACK</span></div></div></div>`,
        ),
      ),
      t = e.querySelector(`.roster-tabs`),
      n = e.querySelector(`.roster-table`),
      r = 0,
      i = () => {
        t.innerHTML = ``;
        TEAMS.forEach((e, n) =>
          t.appendChild(
            html(
              `<div class="tab ${n === r ? `on` : ``}" style="${teamBg(e)}">${e.city.toUpperCase()} ${e.name.toUpperCase()}</div>`,
            ),
          ),
        );
        let e = TEAMS[r],
          i = [`QB`, `RB`, `WR`, `TE`, `OL`, `DE`, `DT`, `LB`, `CB`, `S`, `K`, `P`]
            .flatMap((t) => byPos(e, t))
            .map(
              (e) =>
                `<tr class="${e.nick ? `star` : ``}"><td class="num">#${e.num}</td><td>${e.first} ${e.nick ? `"${e.nick}" ` : ``}${e.last}</td><td>${e.pos}</td><td><span class="ovr" style="color:${overall(e) >= 85 ? `#ffd23f` : `#fff`}">${overall(e)}</span></td><td>${e.r.spd}</td><td>${e.r.str}</td><td>${e.r.agi}</td><td>${e.r.hnd}</td><td>${e.pos === `QB` || e.pos === `P` ? e.r.arm : `–`}</td><td>${e.pos === `QB` ? e.r.acc : `–`}</td><td>${e.r.tkl}</td><td>${e.r.cov}</td><td>${e.pos === `K` || e.pos === `P` ? e.r.kpw : `–`}</td></tr>`,
            );
        n.innerHTML = `<table><thead><tr><th>#</th><th>NAME</th><th>POS</th><th>OVR</th><th>SPD</th><th>STR</th><th>AGI</th><th>HND</th><th>ARM</th><th>ACC</th><th>TKL</th><th>COV</th><th>KPW</th></tr></thead><tbody>${i.join(``)}</tbody></table>`;
      };
    i();
    await new Promise((a) => {
      e.addEventListener(`pointerdown`, (e) => {
        let n = e.target.closest(`.tab`);
        n && ((r = Array.from(t.children).indexOf(n)), i());
        e.target.closest(`.back-btn`) && (o(), a());
      });
      let o = this.loop(() => {
        for (let e of this.ctrls()) {
          (e.consume(`left`) || e.consume(`right`)) && ((r = 1 - r), i(), this.audio.play(`blip`));
          e.consume(`down`) && (n.scrollTop += 60);
          e.consume(`up`) && (n.scrollTop -= 60);
          (e.consume(`back`) || e.consume(`confirm`) || e.consume(`action`) || e.consume(`pause`)) &&
            (o(), a());
        }
      });
    });
    this.audio.play(`back`);
    e.remove();
  }
  async howTo() {
    let e = this.mount(
      html(`<div class="menu-screen"><div class="panel howto">
      <h2>HOW TO PLAY</h2>
      <div class="cols">
        <div><h3>1 PLAYER (KEYBOARD)</h3><table>
          <tr><td><span class="key">WASD</span>/<span class="key">ARROWS</span></td><td>Move</td></tr>
          <tr><td><span class="key">SPACE</span>/<span class="key">J</span></td><td>Action: hike · pass · spin · dive · jump</td></tr>
          <tr><td><span class="key">SHIFT</span>/<span class="key">K</span></td><td>Turbo (hold)</td></tr>
          <tr><td><span class="key">E</span>/<span class="key">L</span></td><td>Special: switch player · hurdle · hard count · fair catch · kneel in end zone</td></tr>
          <tr><td><span class="key">1</span>–<span class="key">5</span></td><td>Throw to receiver #</td></tr>
          <tr><td><span class="key">Q</span>/<span class="key">F</span></td><td>Flip play (play select)</td></tr>
          <tr><td><span class="key">T</span></td><td>Timeout</td></tr>
          <tr><td><span class="key">ESC</span>/<span class="key">P</span></td><td>Pause</td></tr>
          <tr><td><span class="key">F9</span></td><td>Graphics &amp; controls</td></tr>
          <tr><td>Mouse</td><td>Click the field = Action · right-click = Special · menus are clickable</td></tr>
        </table>
        <h3>TOUCH</h3><table>
          <tr><td>Left thumb</td><td>Move (the stick appears where you touch)</td></tr>
          <tr><td><span class="key">A</span></td><td>Action · <span class="key">B</span> Special · <span class="key">TURBO</span> hold</td></tr>
          <tr><td><span class="key">❚❚</span> <span class="key">T/O</span></td><td>Pause · Timeout (top right)</td></tr>
          <tr><td>Play select</td><td>Tap a play to call it · tap FLIP to mirror it</td></tr>
        </table></div>
        <div><h3>2 PLAYERS</h3><table>
          <tr><td><b>P1</b></td><td><span class="key">WASD</span> move · <span class="key">SPACE</span> action · <span class="key">L-SHIFT</span> turbo · <span class="key">E</span> special · <span class="key">Q</span> flip · <span class="key">1-5</span> receivers · <span class="key">T</span> timeout · or the 1st gamepad</td></tr>
          <tr><td><b>P2</b></td><td><span class="key">ARROWS</span> move · <span class="key">ENTER</span>/<span class="key">.</span> action · <span class="key">R-SHIFT</span>/<span class="key">/</span> turbo · <span class="key">,</span> special · <span class="key">M</span> flip · <span class="key">NUM 1-5</span> receivers · <span class="key">Y</span> timeout · or the 2nd gamepad</td></tr>
        </table>
        <h3>GAMEPAD</h3><table>
          <tr><td>Stick / D-pad</td><td>Move</td></tr>
          <tr><td><span class="key">A</span></td><td>Action</td></tr><tr><td><span class="key">X</span>/<span class="key">RT</span>/<span class="key">RB</span></td><td>Turbo</td></tr>
          <tr><td><span class="key">B</span></td><td>Special (and back in menus)</td></tr><tr><td><span class="key">Y</span></td><td>Flip</td></tr>
          <tr><td><span class="key">START</span>/<span class="key">BACK</span></td><td>Pause / Timeout</td></tr>
        </table></div>
        <div><h3>ARCADE TIPS</h3><ul>
          <li><b>Passing:</b> point the stick at a receiver and tap ACTION for a bullet, hold ACTION for a lob. Number badges show who's who.</li>
          <li><b>Turbo</b> drains while held — Turbo into a ball carrier for a <b>BIG HIT</b> (and a shot at a fumble!).</li>
          <li>Ball carrier: <b>SPIN</b> (action) to dodge, <b>HURDLE</b> (special) over divers. Turbo into tacklers to stiff-arm.</li>
          <li>Rack up 3 big plays in a row and your team goes <b>ON FIRE</b>: unlimited turbo and superhuman plays.</li>
          <li>Kicks use the meter: press to set <b>power</b>, press again to set <b>accuracy</b>. Aim with left/right before the snap.</li>
          <li><b>Clutch Challenges</b> drop you into the last minutes of a close game. Only a win counts — ties go down as a miss.</li>
        </ul></div>
      </div>
      <h3>THE RULES (ALL OF THEM)</h3>
      <p>Four downs to gain ten yards. Touchdown 6, extra point kick 1 (from the 15) or two-point try from the 2, field goal 3, safety 2 (plus a free kick). Kickoffs from the 35: touchback to the 25, out of bounds to the 40, onside kicks must travel 10 yards. Punts: fair catch, touchback to the 20, downing and muffs. Missed field goals give the ball at the spot of the kick (or the 20). The clock stops on incompletions, out of bounds, scores, changes of possession, penalties and timeouts (3 per half), with a two-minute warning. Penalties: false start, offside, delay of game, holding (both sides), pass interference (both sides), intentional grounding, illegal forward pass, roughing the passer, face mask, unnecessary roughness and illegal block in the back — with half-the-distance, spot fouls, loss of down, automatic first downs, offsetting fouls and smart accept/decline. A half can't end on an accepted defensive foul (untimed down). Overtime: both teams get a possession, then sudden death; it can end in a tie.</p>
      <div class="btn back-btn"><span>BACK</span></div>
      </div></div>`),
    );
    const panel = e.querySelector(`.howto`);
    await new Promise((t) => {
      // Touch and mouse can scroll the panel; BACK or a tap outside it closes the page.
      e.addEventListener(`pointerdown`, (ev) => {
        if (ev.target.closest(`.back-btn`) || !ev.target.closest(`.howto`)) {
          n();
          t();
        }
      });
      let n = this.loop(() => {
        for (let r of this.ctrls()) {
          r.consume(`down`) && (panel.scrollTop += 80);
          r.consume(`up`) && (panel.scrollTop -= 80);
          (r.consume(`back`) || r.consume(`confirm`) || r.consume(`action`) || r.consume(`pause`)) &&
            (n(), t());
        }
      });
    });
    this.audio.play(`back`);
    e.remove();
  }
  async choose(e, t, n, r, i, a) {
    let o = this.mount(
      html(
        `<div class="dialog-wrap"><div class="panel dialog"><div class="stripes"></div><h2></h2><div class="sub"></div><div class="opts"></div></div></div>`,
      ),
    );
    o.querySelector(`h2`).textContent = e;
    o.querySelector(`.sub`).textContent = t;
    a && o.querySelector(`.dialog`).insertBefore(a, o.querySelector(`.opts`));
    let s = o.querySelector(`.opts`),
      c = n.map((e) => {
        let t = html(`<div class="btn"><span>${e}</span></div>`);
        return (s.appendChild(t), t);
      }),
      l = 0,
      u = () => c.forEach((e, t) => e.classList.toggle(`sel`, t === l));
    u();
    let d = await new Promise((e) => {
      let t = 0,
        n = r ? -1 : i();
      c.forEach((t, n) =>
        t.addEventListener(`pointerdown`, () => {
          r && (a(), e(n));
        }),
      );
      let a = this.loop((i) => {
        if (((t += i), !r)) {
          t > 0.6 && (l = n);
          u();
          t > 1.4 && (a(), e(n));
          return;
        }
        (r.consume(`up`) || r.consume(`left`)) &&
          ((l = (l - 1 + c.length) % c.length), this.audio.play(`blip`));
        (r.consume(`down`) || r.consume(`right`)) && ((l = (l + 1) % c.length), this.audio.play(`blip`));
        u();
        (r.consume(`confirm`) || r.consume(`action`)) && (a(), e(l));
      });
    });
    return (this.audio.play(`select`), await new Promise((e) => setTimeout(e, 250)), o.remove(), d);
  }
  async coinToss(e, t) {
    let n = html(`<div class="coin"><div class="face">HEADS</div><div class="face back">TAILS</div></div>`),
      r = await this.choose(
        `COIN TOSS`,
        `${e}, call it in the air!`,
        [`HEADS`, `TAILS`],
        t,
        () => (Math.random() < 0.5 ? 0 : 1),
        n,
      ),
      i = Math.random() < 0.5 ? 0 : 1,
      a = this.mount(
        html(
          `<div class="dialog-wrap"><div class="panel dialog"><div class="stripes"></div><h2>COIN TOSS</h2><div class="sub">${e} calls ${r === 0 ? `HEADS` : `TAILS`}...</div></div></div>`,
        ),
      ),
      o = html(`<div class="coin"><div class="face">HEADS</div><div class="face back">TAILS</div></div>`);
    o.style.setProperty(`--end`, i === 0 ? `2880deg` : `3060deg`);
    a.querySelector(`.dialog`).appendChild(o);
    requestAnimationFrame(() => o.classList.add(`spin`));
    this.audio.play(`coin`);
    await new Promise((e) => setTimeout(e, 2400));
    let s = html(`<h2 style="font-size:40px">${i === 0 ? `HEADS` : `TAILS`}!</h2>`);
    return (
      a.querySelector(`.dialog`).appendChild(s),
      this.audio.play(r === i ? `select` : `back`),
      await new Promise((e) => setTimeout(e, 1100)),
      a.remove(),
      { call: r, result: i }
    );
  }
  async playSelect(e, t, n, r) {
    let i = this.mount(
      html(
        `<div id="playselect"><div class="ps-timer"></div><div class="ps-sit"><span></span></div><div class="ps-pause" title="Pause">❚❚</div></div>`,
      ),
    );
    i.querySelector(`.ps-sit span`).textContent = t;
    // Pointer and touch players can pause from play select too (keys and pads use pause as usual).
    i.querySelector(`.ps-pause`).addEventListener(`pointerdown`, (ev) => {
      ev.stopPropagation();
      this.onPauseRequest?.();
    });
    let a = i.querySelector(`.ps-timer`),
      o = e.filter((e) => e.ctrl).length;
    this.audio.playMusic(`select`);
    let s = [null, null],
      c = [];
    e.forEach((t, n) => {
      let a = TEAMS[t.team];
      if (!t.ctrl) {
        let e = html(
          `<div class="panel ps-cpu" style="${teamBg(a)}"><div class="stripes"></div><div class="big">${a.name.toUpperCase()}</div><div class="hint">CPU ${t.kind === `offense` ? `OFFENSE` : t.kind === `defense` ? `DEFENSE` : t.kind === `kickoff` ? `KICKING` : `RECEIVING`}</div><div class="big think" style="margin-top:10px;font-size:18px">THINKING...</div></div>`,
        );
        o === 0 && e.classList.add(`hidden`);
        i.appendChild(e);
        let r = 0,
          l = 1 + Math.random() * 2.2;
        c.push({
          update: (i) => {
            r += i;
            r > l &&
              !s[n] &&
              ((s[n] = t.cpuPick()),
              (e.querySelector(`.think`).textContent = `READY!`),
              (e.querySelector(`.think`).style.color = `#3ddc68`));
          },
          lock: () => {
            s[n] || (s[n] = t.cpuPick());
          },
        });
        return;
      }
      let l = this.buildPanel(t, o === 1);
      i.appendChild(l.el);
      c.push({
        update: (e) => {
          if (s[n]) return;
          let i = l.update(e);
          i && (s[n] = i);
          t.ctrl && (t.ctrl.consume(`timeout`) || l.takeTimeout()) && r?.(t.team);
        },
        lock: () => {
          // Time ran out: take the highlighted play (the panel already shows LOCKED! if it was picked).
          if (s[n]) return;
          s[n] = l.current();
          l.el.appendChild(html(`<div class="ps-lock">LOCKED!</div>`));
        },
      });
      e.findIndex((e) => e.ctrl) !== n && (l.el.style.order = `2`);
    });
    let l = n,
      locked = false,
      u = await new Promise((e) => {
        let t = -1,
          r = this.loop((i) => {
            l -= i;
            a.style.width = `${Math.max(0, l / n) * 100}%`;
            c.forEach((e) => e.update(i));
            l <= 0 && !locked && ((locked = true), c.forEach((e) => e.lock()));
            s[0] && s[1] && t < 0 && (t = o ? 0.45 : 0);
            t >= 0 && ((t -= i), t <= 0 && (r(), e([s[0], s[1]])));
          });
      });
    return (this.audio.playMusic(null), i.remove(), u);
  }
  buildPanel(e, t) {
    let n = TEAMS[e.team],
      r = n.colors.jersey,
      i = [],
      a = [];
    if (e.kind === `offense`) {
      a = OFFENSE_PAGES;
      for (let e = 0; e < 3; e++)
        i.push(
          OFFENSE_PLAYS.filter((t) => t.page === e).map((e) => ({
            id: e.id,
            name: e.name,
            desc: e.desc,
            draw: (t, n) => drawOffense(t, e, n, r),
          })),
        );
    } else if (e.kind === `defense`) {
      a = DEFENSE_PAGES;
      for (let e = 0; e < 3; e++)
        i.push(
          DEFENSE_PLAYS.filter((t) => t.page === e).map((e) => ({
            id: e.id,
            name: e.name,
            desc: e.desc,
            draw: (t, n) => drawDefense(t, e, n, r),
          })),
        );
    } else
      e.kind === `kickoff`
        ? ((a = [`KICKOFF`]),
          i.push([
            {
              id: `deep`,
              name: `Deep Kick`,
              desc: `Boom it deep. Pin them back.`,
              draw: (e) => drawKick(e, `deep`, r),
            },
            {
              id: `squib`,
              name: `Squib Kick`,
              desc: `Low line drive. Hard to return.`,
              draw: (e) => drawKick(e, `squib`, r),
            },
            {
              id: `onside`,
              name: `Onside Kick`,
              desc: `Must go 10 yards. Recover it!`,
              draw: (e) => drawKick(e, `onside`, r),
            },
          ]))
        : ((a = [`RETURN`]),
          i.push([
            {
              id: `return`,
              name: `Return`,
              desc: `Set the wall and take it to the house.`,
              draw: (e) => drawKick(e, `return`, r),
            },
            {
              id: `hands`,
              name: `Hands Team`,
              desc: `Expecting an onside kick.`,
              draw: (e) => drawKick(e, `hands`, r),
            },
          ]));
    let o = html(`<div class="panel ps-panel ${t ? `solo` : ``}"><div class="stripes"></div>
      <div class="ps-head"><div class="ps-team" style="color:${n.colors.accent}">${n.city.toUpperCase()} ${n.name.toUpperCase()}</div>
      <div class="ps-side ${e.kind === `defense` || e.kind === `kickret` ? `def` : ``}">${e.kind === `offense` ? `OFFENSE` : e.kind === `defense` ? `DEFENSE` : e.kind === `kickoff` ? `KICKING` : `RECEIVING`}</div>
      <div class="ps-tabs"></div></div>
      <div class="ps-grid"></div>
      <div class="ps-foot"><div class="ps-desc"></div><div class="ps-to">T/O</div><div class="ps-flip">FLIP</div></div></div>`),
      s = o.querySelector(`.ps-tabs`),
      c = o.querySelector(`.ps-grid`),
      l = o.querySelector(`.ps-desc`),
      u = o.querySelector(`.ps-flip`),
      toBtn = o.querySelector(`.ps-to`),
      toReq = false;
    a.forEach((e) => s.appendChild(html(`<div class="ps-tab">${e}</div>`)));
    // Mouse and touch: tabs switch pages, FLIP mirrors the play, T/O calls a timeout.
    Array.from(s.children).forEach((tab, idx) =>
      tab.addEventListener(`pointerdown`, () => {
        if (idx === d) return;
        d = idx;
        f = Math.min(f, i[d].length - 1);
        this.audio.play(`blip`);
        _();
      }),
    );
    u.addEventListener(`pointerdown`, () => {
      p = !p;
      this.audio.play(`swoosh`);
      _();
    });
    e.kind === `offense` || e.kind === `defense`
      ? toBtn.addEventListener(`pointerdown`, () => (toReq = true))
      : toBtn.remove();
    let d = 0,
      f = 0,
      p = false,
      m = [],
      h = i.length === 1 ? i[0].length : 9;
    h < 9 && (c.classList.add(`compact`), o.classList.add(`kick`));
    for (let e = 0; e < h; e++) {
      let t = html(
        `<div class="ps-card"><canvas width="220" height="130"></canvas><div class="nm"></div></div>`,
      );
      c.appendChild(t);
      t.addEventListener(`pointerenter`, () => {
        i[d][e] && ((f = e), _(false));
      });
      t.addEventListener(`pointerdown`, () => {
        i[d][e] && ((f = e), (g = true));
      });
      m.push({ el: t, cv: t.querySelector(`canvas`) });
    }
    let g = false,
      _ = (e = true) => {
        Array.from(s.children).forEach((e, t) => e.classList.toggle(`on`, t === d));
        let t = i[d];
        m.forEach(({ el: n, cv: r }, i) => {
          let a = t[i];
          n.classList.toggle(`empty`, !a);
          n.classList.toggle(`sel`, i === f && !!a);
          n.querySelector(`.nm`).textContent = a ? a.name : ``;
          e && (a ? a.draw(r, p) : r.getContext(`2d`).clearRect(0, 0, r.width, r.height));
        });
        l.textContent = t[f]?.desc ?? ``;
        u.classList.toggle(`on`, p);
        const fk = promptSet(v, this.input.twoPlayer).flip;
        u.textContent = p ? `FLIPPED ⇄` : v?.source === `touch` ? `FLIP` : `FLIP [${fk}]`;
      };
    let v = e.ctrl;
    _();
    return {
      el: o,
      takeTimeout: () => {
        const r = toReq;
        toReq = false;
        return r;
      },
      current: () => ({ id: i[d][f]?.id ?? i[0][0].id, flip: p }),
      update: (e) => {
        let t = i[d].length,
          n = false;
        if (
          (v.consume(`right`) &&
            (f % 3 == 2 || f === t - 1
              ? i.length > 1 && ((d = (d + 1) % i.length), (f = Math.min(f - (f % 3), i[d].length - 1)))
              : f++,
            (n = true)),
          v.consume(`left`) &&
            (f % 3 == 0
              ? i.length > 1 && ((d = (d - 1 + i.length) % i.length), (f = Math.min(f + 2, i[d].length - 1)))
              : f--,
            (n = true)),
          v.consume(`down`) && (f + 3 < t && (f += 3), (n = true)),
          v.consume(`up`) && (f - 3 >= 0 && (f -= 3), (n = true)),
          v.consume(`special`) && ((d = (d + 1) % i.length), (f = Math.min(f, i[d].length - 1)), (n = true)),
          v.consume(`flip`) && ((p = !p), (n = true), this.audio.play(`swoosh`)),
          n && (this.audio.play(`blip`), _()),
          v.consume(`action`) || v.consume(`confirm`) || g)
        ) {
          g = false;
          let e = i[d][f];
          return e
            ? (this.audio.play(`select`),
              o.appendChild(html(`<div class="ps-lock">LOCKED!</div>`)),
              { id: e.id, flip: p })
            : null;
        }
        return null;
      },
    };
  }
  penaltyCard(e, t, n) {
    for (let e of Array.from(document.querySelectorAll(`.penalty`))) e.remove();
    let r = html(
        `<div class="penalty"><div class="t"><i></i>${e}</div>${t.map((e, t) => `<div class="${t === 0 ? `f` : `d`}"></div>`).join(``)}<div class="r"></div></div>`,
      ),
      i = r.querySelectorAll(`.f, .d`);
    t.forEach((e, t) => (i[t].textContent = e));
    r.querySelector(`.r`).textContent = n;
    document.body.appendChild(r);
    setTimeout(() => r.remove(), 4200);
  }
  async stats(e, t, n, labels = [`REMATCH`, `MAIN MENU`]) {
    let r = this.mount(
        html(`<div class="stats-wrap"><div class="panel stats"><div class="stripes"></div>${t}</div></div>`),
      ),
      i = r.querySelector(`.stats`);
    if (!n) {
      const src = this.input.p1.source,
        cont =
          src === `touch`
            ? `TAP TO CONTINUE`
            : src === `gamepad`
              ? `PRESS A TO CONTINUE`
              : `PRESS SPACE TO CONTINUE`;
      i.appendChild(html(`<div class="cont">${cont}</div>`));
      await new Promise((t) => {
        let n = 0;
        r.addEventListener(`pointerdown`, () => {
          n > 0.6 && (i(), t());
        });
        let i = this.loop((r) => {
          if (((n += r), !(n < 0.6))) {
            for (let e of this.ctrls())
              if (e.consume(`action`) || e.consume(`confirm`)) {
                i();
                t();
                return;
              }
            e === `quarter` && n > 3 && (i(), t());
            n > 25 && e === `half` && (i(), t());
          }
        });
      });
      r.remove();
      return `continue`;
    }
    let a = html(`<div class="opts"></div>`),
      o = html(`<div class="btn sel"><span>${labels[0]}</span></div>`),
      s = html(`<div class="btn"><span>${labels[1]}</span></div>`);
    a.append(o, s);
    i.appendChild(a);
    let c = 0,
      l = await new Promise((e) => {
        let t = 0;
        o.addEventListener(`pointerdown`, () => {
          n();
          e(`again`);
        });
        s.addEventListener(`pointerdown`, () => {
          n();
          e(`menu`);
        });
        let n = this.loop((r) => {
          t += r;
          for (let r of this.ctrls()) {
            (r.consume(`left`) || r.consume(`right`) || r.consume(`up`) || r.consume(`down`)) &&
              ((c = 1 - c), this.audio.play(`blip`));
            if (t > 1 && (r.consume(`back`) || r.consume(`pause`))) {
              n();
              e(`menu`);
              return;
            }
            if (t > 1 && (r.consume(`action`) || r.consume(`confirm`))) {
              n();
              e(c === 0 ? `again` : `menu`);
              return;
            }
          }
          o.classList.toggle(`sel`, c === 0);
          s.classList.toggle(`sel`, c === 1);
        });
      });
    return (this.audio.play(`select`), r.remove(), l);
  }
  async pauseMenu(e, challenge = false) {
    let start = 0;
    for (;;) {
      let t = await this.listMenu({
        title: `PAUSED`,
        back: true,
        backId: `resume`, // Esc / Start / B resume the game
        start,
        items: [
          { id: `resume`, label: `RESUME` },
          { id: `restart`, label: challenge ? `RESTART CHALLENGE` : `RESTART MATCH` },
          { id: `howto`, label: `CONTROLS & RULES` },
          { id: `settings`, label: `SETTINGS` },
          { id: `graphics`, label: `GRAPHICS & CONTROLS` },
          { id: `quit`, label: challenge ? `QUIT TO CHALLENGES` : `QUIT TO MENU` },
        ],
        foot: () => this.menuFoot(),
      });
      if (t.id === `howto`) {
        start = 2;
        await this.howTo();
      } else if (t.id === `settings`) {
        start = 3;
        await this.settingsMenu(e);
      } else if (t.id === `graphics`) {
        start = 4;
        await this.kitMenu();
      } else if (t.id === `restart` || t.id === `quit`) {
        // Leaving a game in progress: ask first so a stray press doesn't throw it away.
        const sure = await this.confirmBox(
          t.id === `restart` ? `RESTART?` : `QUIT?`,
          challenge ? `This attempt will be lost.` : `The current game will be lost.`,
        );
        if (sure) return t.id;
        start = t.id === `restart` ? 1 : 5;
      } else return t.id;
    }
  }
  /** Yes/No dialog for any controller, mouse or touch. Resolves true for YES. */
  async confirmBox(title, sub) {
    const r = await this.listMenu({
      title,
      back: true,
      backId: `no`,
      items: [
        { id: `no`, label: `NO, KEEP PLAYING`, desc: sub },
        { id: `yes`, label: `YES` },
      ],
      foot: () => this.menuFoot(),
    });
    return r.id === `yes`;
  }
  /** CLUTCH CHALLENGES picker. Resolves { challenge, team } or null for back. */
  async challengesMenu(settings, last = { team: 0, id: null }) {
    const diffs = [`rookie`, `pro`, `legend`],
      items = [
        {
          id: `team`,
          label: `YOUR TEAM`,
          values: TEAMS.map((t) => t.name.toUpperCase()),
          value: last.team,
          desc: `The team you take into every challenge.`,
        },
        {
          id: `difficulty`,
          label: `CPU`,
          values: diffs.map((d) => d.toUpperCase()),
          value: Math.max(0, diffs.indexOf(settings.difficulty)),
          desc: `Rookie CPUs react slower and miss more tackles; Legend CPUs don't.`,
        },
        ...CHALLENGES.map((c) => {
          const st = challengeStatus(c.id);
          const badge = st?.done ? `★ ` : ``,
            best = st?.done ? ` · BEST +${st.best}` : st?.tries ? ` · ${st.tries} TRIES` : ``;
          return { id: c.id, label: `${badge}${c.name}`, desc: `${c.brief}${best}. ${c.desc}` };
        }),
        { id: `back`, label: `BACK`, desc: `` },
      ];
    const idx = last.id ? items.findIndex((x) => x.id === last.id) : 2;
    const done = CHALLENGES.filter((c) => challengeStatus(c.id)?.done).length;
    const r = await this.listMenu({
      title: `CLUTCH CHALLENGES · ${done}/${CHALLENGES.length} ★`,
      back: true,
      backId: `back`,
      start: Math.max(0, idx),
      items,
      foot: () => this.menuFoot(`win to earn a ★`),
    });
    settings.difficulty = diffs[r.values.difficulty] ?? settings.difficulty;
    const team = r.values.team ?? 0;
    const challenge = CHALLENGES.find((c) => c.id === r.id) ?? null;
    return challenge ? { challenge, team } : null;
  }
  /** Records page: results vs the CPU, head-to-head, streaks, career totals and challenges. */
  async records() {
    const R = loadRecords(),
      row = (a, b) => `<tr><td class="c">${a}</td><td class="v">${b}</td></tr>`,
      wlt = (x) => `${x.w}-${x.l}-${x.t}`,
      cleared = CHALLENGES.filter((c) => R.challenges[c.id]?.done);
    const body = `<h1>RECORDS</h1><table class="records">
      ${row(`VS CPU · ROOKIE`, wlt(R.vsCpu.rookie))}
      ${row(`VS CPU · PRO`, wlt(R.vsCpu.pro))}
      ${row(`VS CPU · LEGEND`, wlt(R.vsCpu.legend))}
      ${row(`WIN STREAK (BEST)`, `${R.streak} (${R.bestStreak})`)}
      ${row(`BIGGEST WIN`, R.bestWin ? `${R.bestWin.score} ${R.bestWin.team} · ${String(R.bestWin.difficulty ?? ``).toUpperCase()}` : `–`)}
      ${row(`MOST POINTS`, R.mostPoints ? `${R.mostPoints.pts} ${R.mostPoints.team}` : `–`)}
      ${row(`2-PLAYER GAMES`, R.versus.played ? `${TEAMS[0].abbr} ${R.versus.wins[0]} · ${TEAMS[1].abbr} ${R.versus.wins[1]} · TIES ${R.versus.ties}` : `–`)}
      ${row(`CAREER GAMES vs CPU`, R.career.games)}
      ${row(`TOUCHDOWNS`, R.career.td)}
      ${row(`PASSING / RUSHING YDS`, `${R.career.passYds} / ${R.career.rushYds}`)}
      ${row(`SACKS / INTERCEPTIONS`, `${R.career.sacks} / ${R.career.ints}`)}
      ${row(`CLUTCH CHALLENGES`, `${cleared.length}/${CHALLENGES.length} ★`)}
      </table>`;
    await this.stats(`records`, body, false);
    this.audio.play(`back`);
  }
  clearScreens() {
    for (let e of Array.from(this.root.querySelectorAll(`.screen`))) e.remove();
    this.updaters.clear();
  }
};
export const Hud = class {
  el;
  sb;
  scoreEls = [];
  lastScores = [0, 0];
  clockEl;
  qEl;
  downEl;
  pcEl;
  turbos = [];
  badgeLayer;
  badges = [];
  tag;
  kick;
  hint;
  teamsEl = [];
  constructor(e) {
    this.el = e;
    this.sb = html(`<div class="scorebug">
      <div class="sb-team left"><span class="sb-abbr"></span><span class="sb-score">0</span><div class="sb-pos hidden"></div><div class="sb-tos"></div></div>
      <div class="sb-mid"><div class="sb-clock">3:00</div><div class="sb-q">1ST</div></div>
      <div class="sb-team right"><span class="sb-score">0</span><span class="sb-abbr"></span><div class="sb-pos hidden"></div><div class="sb-tos"></div></div></div>`);
    e.appendChild(this.sb);
    this.teamsEl = Array.from(this.sb.querySelectorAll(`.sb-team`));
    this.scoreEls = this.teamsEl.map((e) => e.querySelector(`.sb-score`));
    this.clockEl = this.sb.querySelector(`.sb-clock`);
    this.qEl = this.sb.querySelector(`.sb-q`);
    this.downEl = html(`<div class="downbar"><span class="txt"></span><span class="pc"></span></div>`);
    e.appendChild(this.downEl);
    this.pcEl = this.downEl.querySelector(`.pc`);
    for (let t of [`p1`, `p2`]) {
      let n = html(
        `<div class="turbo ${t} hidden"><div class="lbl"><span class="nm">P1</span><span>TURBO</span></div><div class="meter"><div></div></div><div class="who"></div></div>`,
      );
      e.appendChild(n);
      this.turbos.push(n);
    }
    this.badgeLayer = html(`<div></div>`);
    e.appendChild(this.badgeLayer);
    let t = [`#ff3b30`, `#0a84ff`, `#30d158`, `#ff9f0a`, `#bf5af2`];
    for (let e = 0; e < 5; e++) {
      let n = html(`<div class="badge hidden" style="background:${t[e]}">${e + 1}</div>`);
      this.badgeLayer.appendChild(n);
      this.badges.push(n);
    }
    this.tag = html(`<div class="nametag hidden"></div>`);
    e.appendChild(this.tag);
    this.kick = html(
      `<div class="kickmeter hidden"><div><div class="km-label">POWER</div><div class="km-power"><div></div></div></div><div><div class="km-label">ACCURACY</div><div class="km-acc"><i></i></div><div class="km-aim"></div></div></div>`,
    );
    e.appendChild(this.kick);
    this.hint = html(`<div class="controls-hint hidden"></div>`);
    e.appendChild(this.hint);
  }
  shown = false;
  // Last values written to the DOM: the HUD updates every frame but only touches what changed.
  cache = [{}, {}];
  top = {};
  show(e) {
    this.shown = !!e;
    this.el.classList.toggle(`hidden`, !e);
  }
  update(e) {
    for (let t = 0; t < 2; t++) {
      let n = e.teams[t],
        r = this.teamsEl[t],
        c = this.cache[t];
      if (c.team !== n) {
        c.team = n;
        r.style.background = `linear-gradient(160deg, ${n.colors.jersey}, ${n.colors.dark})`;
        r.querySelector(`.sb-abbr`).textContent = n.abbr;
      }
      this.lastScores[t] !== e.scores[t] &&
        ((this.scoreEls[t].textContent = String(e.scores[t])),
        this.scoreEls[t].classList.remove(`pop`),
        this.scoreEls[t].offsetWidth,
        this.scoreEls[t].classList.add(`pop`),
        (this.lastScores[t] = e.scores[t]));
      const hasBall = e.possession === t;
      if (c.hasBall !== hasBall) {
        c.hasBall = hasBall;
        r.querySelector(`.sb-pos`).classList.toggle(`hidden`, !hasBall);
      }
      if (c.tos !== e.timeouts[t]) {
        c.tos = e.timeouts[t];
        r.querySelector(`.sb-tos`).innerHTML = [0, 1, 2]
          .map((n) => `<i class="${n < e.timeouts[t] ? `` : `used`}"></i>`)
          .join(``);
      }
      let o = this.turbos[t];
      if (c.human !== e.humans[t]) {
        c.human = e.humans[t];
        o.classList.toggle(`hidden`, !c.human);
        o.classList.toggle(`p1`, t === 0);
        o.classList.toggle(`p2`, t === 1);
      }
      if (!e.humans[t]) continue;
      const pct = Math.round(e.turbo[t] * 100);
      if (c.pct !== pct) {
        c.pct = pct;
        o.querySelector(`.meter div`).style.width = `${pct}%`;
        o.classList.toggle(`low`, e.turbo[t] < 0.25);
      }
      if (c.fire !== e.onFire[t]) {
        c.fire = e.onFire[t];
        o.classList.toggle(`fire`, c.fire);
      }
      const nm = `${e.humanLabels[t]} · ${n.abbr}${e.onFire[t] ? ` 🔥` : ``}`;
      c.nm !== nm && (o.querySelector(`.nm`).textContent = c.nm = nm);
      c.who !== e.controlled[t] && (o.querySelector(`.who`).textContent = c.who = e.controlled[t]);
    }
    const T = this.top;
    T.clock !== e.clock && (this.clockEl.textContent = T.clock = e.clock);
    T.q !== e.quarter && (this.qEl.textContent = T.q = e.quarter);
    if (T.down !== e.down) {
      T.down = e.down;
      this.downEl.querySelector(`.txt`).textContent = e.down;
      this.downEl.classList.toggle(`hidden`, !e.down);
    }
    const pc = e.playClock === null ? null : Math.max(0, Math.ceil(e.playClock));
    if (T.pc !== pc) {
      T.pc = pc;
      pc === null
        ? this.pcEl.classList.add(`hidden`)
        : (this.pcEl.classList.remove(`hidden`),
          (this.pcEl.textContent = String(pc)),
          this.pcEl.classList.toggle(`warn`, pc < 5));
    }
  }
  setBadges(e) {
    this.badges.forEach((t, n) => {
      let r = e.find((e) => e.n === n + 1);
      t.classList.toggle(`hidden`, !r);
      r && ((t.style.left = `${r.x}px`), (t.style.top = `${r.y}px`), t.classList.toggle(`tgt`, r.targeted));
    });
  }
  setTag(e, t = 0, n = 0) {
    this.tag.classList.toggle(`hidden`, !e);
    e && ((this.tag.textContent = e), (this.tag.style.left = `${t}px`), (this.tag.style.top = `${n}px`));
  }
  setKick(e, key = `ACTION`) {
    const hidden = !e || e.stage >= 3;
    this.top.kickHidden !== hidden && this.kick.classList.toggle(`hidden`, (this.top.kickHidden = hidden));
    if (!e) return;
    this.kick.querySelector(`.km-power div`).style.height =
      `${Math.round((e.stage >= 2 || e.stage === 1 ? e.power : 0) * 100)}%`;
    this.kick.querySelector(`.km-acc i`).style.left = `${(e.stage === 2 ? (e.acc + 1) / 2 : 0.5) * 100}%`;
    const aim =
      e.stage === 0
        ? `AIM ${e.aim > 0.05 ? `▶`.repeat(Math.ceil(e.aim * 3)) : e.aim < -0.05 ? `◀`.repeat(Math.ceil(-e.aim * 3)) : `●`} · <span class="key">${key}</span> to snap`
        : e.stage === 1
          ? `PRESS <span class="key">${key}</span> FOR POWER`
          : `PRESS <span class="key">${key}</span> FOR ACCURACY`;
    this.top.aim !== aim && (this.kick.querySelector(`.km-aim`).innerHTML = this.top.aim = aim);
  }
  setHint(e) {
    if (this.top.hint === e) return;
    this.top.hint = e;
    this.hint.classList.toggle(`hidden`, !e);
    e && (this.hint.innerHTML = e);
  }
};
