/* The Hollow Bell — original, responsive interface. No external assets or UI runtime. */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const esc = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const paths = {
    arrow: '<path d="M7 25 25 7M8 7h17v17"/>',
    bell: '<path d="M8 17c2-2 2-4 2-7a6 6 0 0 1 12 0c0 3 0 5 2 7l2 4H6l2-4Z"/><path d="M13 24a3 3 0 0 0 6 0M16 2V0M3 10l-2-1m28 1 2-1M3 24l-2 2m28-2 2 2"/><path d="M14 7c-2 1-2 4-2 6"/>',
    hand: '<path d="m9 16-3-4a2 2 0 0 0-3 2l5 8c1 2 3 3 6 3h6c3 0 5-3 5-6V9a2 2 0 0 0-4 0m0 7V5a2 2 0 0 0-4 0v10m0-2V3a2 2 0 0 0-4 0v12m0-3V6a2 2 0 0 0-4 0v10Z"/>',
    blade:
      '<path d="m8 23 15-17 5-2-1 6L12 27M5 19l10 10M8 26l-5 5m2-8 7 6M13 20l12-13"/>',
    magic:
      '<path d="m16 2 4 10 10 4-10 4-4 10-4-10-10-4 10-4Z"/><path d="M4 2v5M1 4h6m20 21v6m-3-3h6"/>',
    bag: '<path d="M7 11h18l3 18H4l3-18Z"/><path d="M11 11V7a5 5 0 0 1 10 0v4M5 19h22M13 17h6v5h-6z"/>',
    journal:
      '<path d="M7 4h19v25H7a3 3 0 0 1 0-6h19M7 4a3 3 0 0 0-3 3v19m8-17h9m-9 5h9m-9 5h5"/><path d="M22 4v9l-3-2-3 2V4"/>',
    map: '<path d="m3 6 8-3 10 4 8-3v22l-8 3-10-4-8 3V6Zm8-3v22M21 7v22"/><path d="m15 15 3 3m0-3-3 3M6 13l2-1m16 7 2-1"/>',
    menu: '<path d="M5 8h22M5 16h22M5 24h22"/>',
    sound:
      '<path d="M4 12h6l7-6v20l-7-6H4zM22 11a8 8 0 0 1 0 10m4-15a14 14 0 0 1 0 20"/>',
    mute: '<path d="M4 12h6l7-6v20l-7-6H4zM22 12l8 8m0-8-8 8"/>',
    fullscreen: '<path d="M12 4H4v8m16-8h8v8M4 20v8h8m16-8v8h-8"/>',
    help: '<circle cx="16" cy="16" r="12"/><path d="M12 12a4 4 0 1 1 6 3c-2 1-2 2-2 4m0 3v1"/>',
    potion:
      '<path d="M11 3h10v5h-2v6l6 9c2 4-2 6-4 6H11c-4 0-6-3-4-6l6-9V8h-2zM10 22h12"/>',
    key: '<circle cx="10" cy="10" r="6"/><path d="m14 14 15 15m-8-8 4-4m0 8 4-4"/>',
    bread:
      '<path d="M4 19c-5-6 0-16 7-12 4-7 14-5 14 1 8 1 9 12 2 15L9 28c-3 1-5-3-5-9Z"/><path d="m10 10 3 7m5-9 3 7M5 21l23-7"/>',
    letter:
      '<path d="M6 3h20v26H6zM11 9h10m-10 5h10m-10 5h7"/><circle cx="22" cy="24" r="4"/>',
    coin: '<circle cx="16" cy="16" r="12"/><circle cx="16" cy="16" r="8"/><path d="m16 10 4 6-4 6-4-6z"/>',
    flame:
      '<path d="M17 2c1 9-8 9-6 17-4-2-4-5-4-7-6 7-4 18 8 18 15 0 16-15 9-22 1 8-3 8-4 11 1-7-2-10-3-17Z"/>',
  };
  function icon(name, extra = "") {
    const record = asset(name),
      src = localImage(record?.src);
    if (src) return `<img src="${esc(src)}" alt="" ${extra}>`;
    return `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${paths[name] || paths.letter}</svg>`;
  }
  function icons(root = document) {
    root.querySelectorAll("[data-icon]").forEach((el) => {
      el.innerHTML = icon(el.dataset.icon);
    });
  }
  let handlers = {},
    modal = null,
    title = true,
    selected = -1,
    cache = {},
    inventoryItems = [],
    lastFocus = null,
    muted = false;
  let context = {
      regionName: "The coast",
      chapterName: "Your journey",
      assets: [],
    },
    previewCleanup = null,
    previewStatus = null;
  const preview =
    new URLSearchParams(location.search).has("preview") ||
    new URLSearchParams(location.search).get("dev") === "1";
  const panel = $("modal-panel");
  function invoke(name, ...args) {
    if (typeof handlers[name] === "function") return handlers[name](...args);
  }
  function htmlText(value) {
    return esc(value).replace(/\*([^*]+)\*/g, "<em>$1</em>");
  }
  function activeButtons() {
    const root = modal ? panel : title ? $("title-screen") : null;
    return root
      ? Array.from(
          root.querySelectorAll(
            "button:not(:disabled),a[href],input[type=file]:not(:disabled)",
          ),
        ).filter(
          (b) => !b.classList.contains("modal-close") && !b.closest(".hidden"),
        )
      : [];
  }
  function show(type, markup, className = "") {
    if (previewCleanup) {
      previewCleanup();
      previewCleanup = null;
    }
    if (!modal) lastFocus = document.activeElement;
    modal = type;
    $("toast-stack").classList.toggle("journal-quiet", type === "journal");
    panel.dataset.panelType = type;
    selected = -1;
    panel.className = `modal-panel ${className}`;
    panel.innerHTML = markup;
    $("modal-layer").classList.remove("hidden");
    panel.scrollTop = 0;
    panel.focus({ preventScroll: true });
    panel.querySelectorAll("[data-close]").forEach((b) => (b.onclick = close));
    icons(panel);
  }
  function header(kicker, heading) {
    return `<div class="modal-header"><span class="eyebrow">${esc(kicker)}</span><h2 id="modal-heading">${esc(heading)}</h2><button class="modal-close" data-close aria-label="Close">×</button></div>`;
  }
  function close() {
    if (previewCleanup) {
      previewCleanup();
      previewCleanup = null;
    }
    modal = null;
    $("toast-stack").classList.remove("journal-quiet");
    selected = -1;
    $("modal-layer").classList.add("hidden");
    panel.innerHTML = "";
    if (lastFocus?.isConnected) lastFocus.focus({ preventScroll: true });
    else if (!title) $("screen").focus({ preventScroll: true });
    lastFocus = null;
  }
  function configure(data = {}) {
    context = { ...context, ...data };
  }
  function asset(id) {
    if (!id) return null;
    if (typeof id === "object") return id;
    const source = context.assets;
    return (
      source?.get?.("assets", id) ||
      source?.find?.((a) => a.id === id) ||
      source?.[id] ||
      null
    );
  }
  function localImage(src) {
    return typeof src === "string" &&
      /^(?:data:image\/(?:png|webp|jpeg|gif|svg\+xml);|(?:\.?\.?\/)?[a-zA-Z0-9_-])/.test(
        src,
      ) &&
      !/^(?:[a-z]+:|\/\/)/i.test(src.replace(/^data:image\//, "image/"))
      ? src
      : "";
  }
  function cameo(id) {
    const record = asset(id) || {},
      image = localImage(record.src);
    if (image) return `<img src="${esc(image)}" alt="" loading="lazy">`;
    const fallback = [
      ["#80664a", "#64715a", "#c6aa82", "#394733"],
      ["#6e625b", "#577976", "#bca181", "#343c34"],
      ["#b28b55", "#7b6269", "#d1b08b", "#40332b"],
    ];
    const hash = Array.from(
      String(typeof id === "object" ? id.id : id || ""),
    ).reduce((n, c) => n + c.charCodeAt(0), 0);
    const palette = record.palette || record.colors;
    const c = (
      Array.isArray(palette) && palette.length >= 4
        ? palette
        : fallback[hash % fallback.length]
    ).map(esc);
    return `<svg viewBox="0 0 80 100" aria-hidden="true"><path fill="#253b2a" d="M0 0h80v100H0z"/><circle cx="40" cy="36" r="29" fill="#405640" stroke="#cab97a" stroke-opacity=".22"/><path d="M10 100q2-30 20-36h20q22 5 25 36" fill="${c[1]}"/><path d="m33 57-2 13 10 11 11-12-6-15" fill="${c[2]}"/><path d="M23 27q1-17 18-18 25 3 20 30L55 55 42 66 29 56 24 38Z" fill="${c[2]}"/><path d="M22 43Q11 7 40 6q31 0 23 35l-8-14-18-8-10 17-2 15" fill="${c[0]}"/><path d="m29 40 7-2m9 0 7 2" fill="none" stroke="${c[3]}" stroke-width="2"/><path d="m40 41-2 9 5 1m-10 6 11 1" fill="none" stroke="#806550" stroke-width="1.5"/><path d="m28 69 12 16 14-16m-14 16v15" fill="none" stroke="#cbb87c" stroke-width="1.2"/><path d="M0 97h80M3 3h74v94H3z" fill="none" stroke="#bca970" stroke-width=".6" opacity=".45"/>${record.accessory === "hood" ? '<path d="M17 45 25 13 42 6 60 17 65 47 55 29 38 18 28 33Z" fill="#8b8960"/>' : ""}${record.accessory === "rune" ? '<path d="m40 14 4 10 10 4-10 4-4 10-4-10-10-4 10-4Z" fill="#b6cfbb" opacity=".8"/>' : ""}</svg>`;
  }
  function dialog(data) {
    if (!data) {
      close();
      return;
    }
    const name = data.speaker || data.name || data.title || "A familiar voice";
    const choices = data.choices || [{ label: "Continue", action: "close" }];
    show(
      "dialog",
      `<div class="dialogue-header"><div class="npc-portrait">${cameo(data.portrait || data.id || name.toLowerCase())}</div><div><div class="eyebrow">${esc(data.regionName || context.regionName)} · CONVERSATION</div><h2 id="modal-heading">${esc(name)}</h2><div class="dialogue-role">${esc(data.role || data.subtitle || "A story waiting to be heard")}</div></div><button class="modal-close" data-close aria-label="Leave conversation">×</button></div><div class="dialogue-body"><p class="dialogue-text">${htmlText(data.text || "")}</p><div class="dialogue-choices">${choices.map((c, i) => `<button class="choice-button" data-choice="${i}" ${c.disabled || c.reason || c.disabledReason ? "disabled" : ""}><span class="choice-number">${i + 1}.</span><span>${esc(c.label || c.text || c)}${c.reason || c.disabledReason ? `<small class="disabled-reason">${esc(c.reason || c.disabledReason)}</small>` : ""}</span><span class="choice-arrow">›</span></button>`).join("")}</div><div class="dialogue-hint">Choose a reply · number keys or D-pad + × &nbsp; / &nbsp; Esc to leave</div></div>`,
      "dialogue-panel",
    );
    panel.querySelectorAll("[data-choice]").forEach(
      (b) =>
        (b.onclick = () => {
          const c = choices[Number(b.dataset.choice)];
          const action = c.action ?? c.id;
          if (c.command) runCommand(c.command, null);
          else if (c.panel) requestPanel(c.panel, c.params);
          else if (action === "close" && !handlers.choose) close();
          else invoke("choose", action);
        }),
    );
  }
  function itemIcon(item) {
    if (item.icon && (paths[item.icon] || asset(item.icon))) return item.icon;
    const text = [item.id, item.name, item.icon]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (paths[text]) return text;
    if (/bread|food|apple|meal|flour/.test(text)) return "bread";
    if (/tonic|potion|vial|salve|herb/.test(text)) return "potion";
    if (/key|lock/.test(text)) return "key";
    if (/sword|blade|knife/.test(text)) return "blade";
    if (/coin|gold/.test(text)) return "coin";
    if (/bell|clapper/.test(text)) return "bell";
    if (/ember|candle|torch/.test(text)) return "flame";
    return "letter";
  }
  function inventory(data = {}) {
    inventoryItems = Array.isArray(data)
      ? data
      : data.items || data.entries || [];
    const recipients = Array.isArray(data) ? [] : data.recipients || [],
      actions = [];
    const controls = (item, index) => {
      const buttons = [],
        protectedReason =
          item.dropReason ||
          (item.protected ? "This item is needed for your journey." : "");
      if (
        item.usable ||
        item.action ||
        (item.command &&
          (item.usable !== false || item.command.type !== "useItem")) ||
        item.useCommand
      )
        buttons.push(
          `<button data-use="${index}" ${reasonOf(item) ? "disabled" : ""}>${esc(item.useLabel || (/bread|tonic/.test(item.id) ? "Consume" : /note|ledger|token/.test(item.id) ? "Examine" : "Use"))} <span>↗</span></button>${smallReason(item)}`,
        );
      if (item.droppable !== false) {
        const dropCount = (count) => {
          actions.push({
            ...item.dropCommand,
            type: "drop",
            item: item.id,
            count,
          });
          return button(
            count === 1 ? "Drop one" : `Drop all (${count})`,
            `data-command="${actions.length - 1}"`,
            protectedReason,
          );
        };
        buttons.push(dropCount(1));
        if (Number(item.count) > 1) buttons.push(dropCount(Number(item.count)));
      }
      if (recipients.length)
        buttons.push(
          button("Give one…", `data-give="${index}"`, item.giveReason || ""),
        );
      return `<div class="inventory-actions">${buttons.join("")}</div>`;
    };
    show(
      "inventory",
      `${header("THE WAYFARER’S POSSESSIONS", "Your satchel")}<div class="modal-body"><p class="modal-intro">A few useful things, and the weight of what you know.</p><div class="inventory-grid">${inventoryItems.length ? inventoryItems.map((item, i) => `<article class="item-card"><div class="item-icon" data-icon="${esc(itemIcon(item))}"></div><div><h3>${esc(item.name || item.id)}</h3><div class="item-count">${(item.count ?? item.quantity ?? 1) > 1 ? `${esc(item.count ?? item.quantity)} in your satchel` : esc(item.type || "Carried item")}</div></div><p>${esc(item.description || item.desc || "")}</p>${controls(item, i)}</article>`).join("") : '<p class="empty-state">Your satchel is empty. Explore to find supplies.</p>'}</div><div class="modal-footer"><button class="text-button" data-kit>Open field kit ↗</button><button class="text-button" data-close>Return to the world →</button></div></div>`,
    );
    commandButtons(actions, "inventory");
    panel
      .querySelectorAll("[data-kit]")
      .forEach((b) => (b.onclick = () => requestPanel("kit")));
    panel.querySelectorAll("[data-use]").forEach(
      (b) =>
        (b.onclick = () => {
          const item = inventoryItems[Number(b.dataset.use)];
          if (item.useCommand || item.command)
            runCommand(item.useCommand || item.command, "inventory");
          else invoke("useItem", item.id);
        }),
    );
    panel.querySelectorAll("[data-give]").forEach(
      (b) =>
        (b.onclick = () => {
          const item = inventoryItems[Number(b.dataset.give)];
          menuPanel({
            title: `Give ${item.name || item.id}`,
            subtitle: "SHARE A USEFUL THING",
            text: "Give one item to a travelling companion. They must be within reach.",
            returnPanel: "inventory",
            choices: [
              ...recipients.map((recipient) => ({
                label: recipient.name || recipient.id,
                reason: recipient.reason,
                command: {
                  type: "transfer",
                  from: data.actor || data.owner || "player",
                  to: recipient.id,
                  item: item.id,
                  count: 1,
                },
              })),
              { label: "Keep it in my satchel", panel: "inventory" },
            ],
          });
        }),
    );
  }
  function journal(data) {
    const entries = Array.isArray(data) ? data : data?.entries || [];
    const objective = (!Array.isArray(data) && data?.objective) || cache.objective || "Follow the threads of your journey.";
    const groups = new Map();
    for (const entry of entries) {
      const e = typeof entry === "string" ? {text: entry} : entry;
      const key = e.quest || "notes";
      if (!groups.has(key)) groups.set(key, {id: e.quest, title: e.questTitle || "Field notes", complete: !!e.questComplete, tracked: !!e.tracked, primary: !!e.primary, entries: []});
      groups.get(key).entries.push(e);
    }
    const ordered = [...groups.values()].sort((a, b) => Number(a.complete) - Number(b.complete) || Number(b.tracked) - Number(a.tracked) || Number(b.primary) - Number(a.primary));
    const renderEntries = group => group.entries.map((e, i) => `<article class="journal-entry ${e.completed || e.done ? "completed" : ""}"><span class="entry-mark" aria-hidden="true">${e.completed || e.done ? "✓" : "◇"}</span><div><h4>${esc(e.title || e.name || `Discovery ${i + 1}`)}${e.optional ? ' <span class="entry-tag">Optional</span>' : ''}</h4><p>${esc(e.text || e.description || e.body || "")}</p></div></article>`).join("");
    show("journal", `${header(context.chapterName, "Field journal")}<div class="modal-body"><div class="journal-lead" aria-live="polite">${esc(objective)}</div><div class="eyebrow">${typeof data?.clues === "number" ? `${data.clues} / ${data.clueTotal ?? data.clues} MAIN STORY CLUES` : "OBSERVATIONS & DISCOVERIES"}</div>${
      ordered.length ? ordered.map(group => {
        const count = group.entries.filter(e => e.done || e.completed).length;
        const title = `<span>${esc(group.title)}</span><span class="quest-count">${group.complete ? 'Complete' : `${count} / ${group.entries.length}`}</span>`;
        if (group.complete) return `<details class="quest-group quest-closed"><summary>${title}</summary>${renderEntries(group)}</details>`;
        return `<section class="quest-group ${group.tracked ? 'quest-tracked' : ''}"><div class="quest-heading"><h3>${title}</h3>${group.id ? `<button class="text-button quest-track" data-track-quest="${esc(group.id)}" aria-pressed="${group.tracked}">${group.tracked ? 'Stop tracking' : 'Track quest'}</button>` : ''}</div>${renderEntries(group)}</section>`;
      }).join("") : '<p class="empty-state">Every person has a story. Begin by listening.</p>'
    }<div class="modal-footer"><span class="modal-hint">Track a quest to show its next step on screen. Progress is saved automatically.</span><button class="text-button" data-close>Close journal →</button></div></div>`);
    document.querySelectorAll("[data-track-quest]").forEach(button => {
      button.onclick = () => {
        const id = button.dataset.trackQuest;
        invoke("trackQuest", button.getAttribute("aria-pressed") === "true" ? null : id);
        // Rendering replaces the control. Restore focus for keyboard and gamepad use.
        [...document.querySelectorAll("[data-track-quest]")].find(next => next.dataset.trackQuest === id)?.focus();
      };
    });
  }
  function map(data = {}) {
    const width = Math.max(1, data.width || 768),
      height = Math.max(1, data.height || 704);
    const locations = data.locations || data.landmarks || [],
      name = data.name || data.regionName || context.regionName;
    const sx = (x) => Math.round(35 + ((Number(x) || 0) / width) * 530),
      sy = (y) => Math.round(40 + ((Number(y) || 0) / height) * 440);
    const rects = (rows, fill, stroke) =>
      rows
        .map(
          (r) =>
            `<rect x="${sx(r.x)}" y="${sy(r.y)}" width="${Math.max(1, ((r.w || r.width || 16) / width) * 530)}" height="${Math.max(1, ((r.h || r.height || 16) / height) * 440)}" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`,
        )
        .join("");
    const art = localImage(data.art),
      drawing = art
        ? `<image href="${esc(art)}" x="35" y="40" width="530" height="440" preserveAspectRatio="none"/>`
        : `${rects(data.water || [], "#779184", "#779184")}${(data.paths || []).map((points) => `<polyline points="${points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(" ")}" fill="none" stroke="#aaa17a" stroke-width="8"/>`).join("")}${rects(data.rooms || [], "#9a9b7b", "#586345")}`;
    const markers = locations
      .map(
        (p, i) =>
          `<g><circle cx="${sx(p.x)}" cy="${sy(p.y)}" r="11" fill="#d9cba0" stroke="#44543b"/><text x="${sx(p.x)}" y="${sy(p.y) + 4}" text-anchor="middle" font-size="11" fill="#37462f">${i + 1}</text></g>`,
      )
      .join("");
    show(
      "map",
      `${header("A TRAVELLER’S CHART", name)}<div class="modal-body"><div class="map-paper"><svg viewBox="0 0 600 520" role="img" aria-label="${esc(name)} map with landmarks and your position"><defs><pattern id="map-grid" width="35" height="35" patternUnits="userSpaceOnUse"><path d="M35 0H0V35" fill="none" stroke="#827b51" opacity=".15"/></pattern></defs><rect x="16" y="16" width="568" height="488" stroke="#677052" fill="url(#map-grid)" stroke-width=".8"/>${drawing}<g transform="translate(540 50)"><path d="m0-15 5 15-5-4-5 4z" fill="#536143"/><text x="0" y="-20" text-anchor="middle" font-size="12" fill="#415035">N</text></g>${markers}${data.player ? `<circle cx="${sx(data.player.x)}" cy="${sy(data.player.y)}" r="13" fill="#b26844" opacity=".22"/><path d="m${sx(data.player.x)} ${sy(data.player.y) - 8} 6 15-6-3-6 3z" fill="#a04f35" stroke="#efe0b5" stroke-width="1.5"/>` : ""}</svg></div><div class="map-locations">${locations.map((p, i) => `<span><b>${i + 1}</b>${esc(p.name)}</span>`).join("")}</div><div class="modal-footer"><div class="map-legend"><span><i style="color:#d39a76">▲</i>Your position</span><span><i>○</i>Landmark</span></div><button class="text-button" data-close>Fold map →</button></div></div>`,
      "map-panel",
    );
  }
  // Generic RPG panels consume derived view models and dispatch commands only.
  function requestPanel(name, params = {}) {
    if (name && typeof name === "object") { params = { ...params, ...(name.params || {}) }; name = name.name; }
    if (typeof handlers.panel === "function")
      return invoke("panel", name, params);
    if (name === "kit") return kit();
    if (["inventory", "journal", "map"].includes(name)) return invoke(name);
    toast("This view is not available here.", "warning");
  }
  async function runCommand(command, view, params = {}) {
    if (!command) return;
    try {
      const result = await invoke("command", command, { panel: view, params });
      if (result?.message)
        toast(result.message, result.ok ? "success" : "warning");
      if (!result?.handled && modal && view) requestPanel(view, params);
    } catch (error) {
      toast(error.message || "The action could not be completed.", "warning");
    }
  }
  function reasonOf(row) {
    return (
      row.reason || row.disabledReason || (row.disabled ? "Unavailable" : "")
    );
  }
  function smallReason(row) {
    const reason = reasonOf(row);
    return reason
      ? `<small class="disabled-reason">${esc(reason)}</small>`
      : "";
  }
  function button(label, attrs = "", reason = "") {
    return `<button class="kit-button" ${attrs} ${reason ? "disabled" : ""}>${esc(label)}</button>${reason ? `<small class="disabled-reason">${esc(reason)}</small>` : ""}`;
  }
  function footer() {
    return '<div class="modal-footer"><button class="text-button" data-panel="kit">← Field kit</button><button class="text-button" data-close>Return to the world →</button></div>';
  }
  function bindPanels() {
    panel
      .querySelectorAll("[data-panel]")
      .forEach((b) => (b.onclick = () => requestPanel(b.dataset.panel)));
  }
  function commandButtons(actions, view, params = {}) {
    panel.querySelectorAll("[data-command]").forEach((b) => {
      const command = actions[Number(b.dataset.command)];
      b.dataset.commandType = command?.type || "";
      b.dataset.commandTarget =
        command?.target || command?.item || command?.member || "";
      b.onclick = () => runCommand(command, view, params);
    });
    bindPanels();
  }
  function stats(values = {}) {
    return `<dl class="kit-stats">${Object.entries(values)
      .map(
        ([key, value]) =>
          `<div><dt>${esc(key.replace(/([a-z])([A-Z])/g, "$1 $2"))}</dt><dd>${esc(value)}</dd></div>`,
      )
      .join("")}</dl>`;
  }
  function modifierText(values = {}) {
    return (
      Object.entries(values)
        .map(([key, value]) => `${Number(value) > 0 ? "+" : ""}${value} ${key}`)
        .join(" · ") || "No stat changes"
    );
  }
  function itemHeading(item) {
    return `<div class="kit-item-heading"><span class="kit-item-icon" data-icon="${esc(itemIcon(item))}"></span><div><h3>${esc(item.name || item.id)}</h3>${item.count !== undefined ? `<span class="item-count">${esc(item.count)} available</span>` : ""}</div></div>`;
  }
  function listOrEmpty(rows, render, empty = "Nothing here yet.") {
    return rows?.length
      ? rows.map(render).join("")
      : `<p class="empty-state">${esc(empty)}</p>`;
  }

  function kit(data = {}) {
    const entries = data.entries
      ? [...data.entries]
      : [
          {
            id: "inventory",
            name: "Satchel",
            description: "Read, consume and inspect your belongings.",
          },
          {
            id: "equipment",
            name: "Equipment",
            description: "Compare bonuses and equip your gear.",
          },
          {
            id: "crafting",
            name: "Recipes",
            description: "Ingredients, stations and useful things to make.",
          },
          {
            id: "trading",
            name: "Trade",
            description: "Buy and sell with a nearby merchant.",
          },
          {
            id: "party",
            name: "Companions",
            description: "Follow, wait, share supplies and change equipment.",
          },
          {
            id: "progression",
            name: "Experience",
            description: "Your skills, rewards and lasting effects.",
          },
          {
            id: "saves",
            name: "Save & recovery",
            description: "Export, import or recover a saved journey.",
          },
        ];
    if (preview && !entries.some((e) => e.id === "inspector"))
      entries.push({
        id: "inspector",
        name: "Development inspector",
        description: "Isolated preview · state, events and content tools.",
      });
    show(
      "kit",
      `${header(context.regionName, data.title || "Field kit")}<div class="modal-body"><p class="modal-intro">${esc(data.text || "Make ready for the road ahead.")}</p><div class="kit-grid">${entries.map((entry, i) => `<button class="kit-card" data-kit-entry="${i}" ${reasonOf(entry) ? "disabled" : ""}><strong>${esc(entry.name)}</strong><span>${esc(entry.description || "")}</span>${smallReason(entry)}<i>↗</i></button>`).join("")}</div><div class="modal-footer"><span class="modal-hint">D-pad or arrow keys · × or Enter to choose</span><button class="text-button" data-close>Close kit →</button></div></div>`,
      "kit-panel",
    );
    panel.querySelectorAll("[data-kit-entry]").forEach(
      (b) =>
        (b.onclick = () => {
          const entry = entries[Number(b.dataset.kitEntry)];
          requestPanel(entry.id, entry.params || {});
        }),
    );
  }
  function container(data = {}) {
    const actions = [],
      player = data.playerId || "player",
      destinations = data.destinations || [
        { id: player, name: "Your satchel" },
      ];
    const destination = destinations.find(
      (d) => d.id === (data.destination || data.params?.destination),
    ) ||
      destinations[0] || { id: player, name: "Your satchel" };
    const params = { id: data.id, ...data.params, destination: destination.id };
    const ownerLabel =
      data.ownerLabel ||
      data.ownership ||
      (data.owner !== data.id ? data.owner : "");
    const transfer = (item, from, to, count, reason) => {
      actions.push(
        item.transferCommand ||
          (item.command?.type === "transfer"
            ? { ...item.command, count, from, to }
            : { type: "transfer", from, to, item: item.id, count }),
      );
      return button(
        count === 1 ? "Move one" : `Move all (${count})`,
        `data-command="${actions.length - 1}"`,
        reason,
      );
    };
    const rows = (items, from, to, direction) =>
      listOrEmpty(
        items,
        (item) => {
          const count = Number(item.count ?? 1),
            reason = item[`${direction}Reason`] || reasonOf(item);
          return `<article class="kit-row">${itemHeading(item)}<p>${esc(item.description || "")}</p><div class="kit-actions">${transfer(item, from, to, 1, reason)}${count > 1 ? transfer(item, from, to, count, reason) : ""}${item.openTarget ? button("Open contents", `data-open-container="${esc(item.openTarget)}"`) : ""}</div></article>`;
        },
        "This container is empty.",
      );
    show(
      "container",
      `${header("POSSESSIONS & CONTAINERS", data.name || "Container")}<div class="modal-body"><p class="modal-intro">${esc(data.description || "Transfer supplies with the buttons below.")}</p>${ownerLabel ? `<p class="ownership-note">Owned by ${esc(ownerLabel)}. Taking possessions may have consequences.</p>` : ""}<div class="kit-summary"><span>${data.capacity !== undefined ? `${esc(data.used ?? 0)} / ${esc(data.capacity)} capacity` : "Contents remain here when you travel."}</span>${button(`Transfer with: ${destination.name}`, "data-cycle-destination", destinations.length < 2 ? "" : "")}</div><div class="kit-columns"><section><h3 class="kit-column-title">${esc(data.name || "Container")}</h3>${rows(data.items || [], data.id, destination.id, "take")}</section><section><h3 class="kit-column-title">${esc(destination.name)}</h3>${rows(data.playerItems || [], destination.id, data.id, "put")}</section></div>${footer()}</div>`,
      "kit-panel",
    );
    commandButtons(actions, "container", params);
    panel.querySelector("[data-cycle-destination]").onclick = () => {
      if (destinations.length > 1) {
        const next =
          destinations[
            (destinations.indexOf(destination) + 1) % destinations.length
          ];
        requestPanel("container", { ...params, destination: next.id });
      }
    };
    panel
      .querySelectorAll("[data-open-container]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            requestPanel("container", { id: b.dataset.openContainer })),
      );
  }
  function equipment(data = {}) {
    const actions = [],
      actor = data.actor || "player",
      params = { actor, ...data.params };
    const slots = (data.slots || [])
      .map((slot) => {
        const item = slot.item,
          command = { type: "unequip", actor, slot: slot.id };
        actions.push(command);
        return `<article class="kit-slot"><span class="eyebrow">${esc(slot.name || slot.id)}</span><strong>${esc(item?.name || "Empty")}</strong>${item ? `${button("Unequip", `data-command="${actions.length - 1}"`, reasonOf(slot))}` : ""}</article>`;
      })
      .join("");
    const items = listOrEmpty(
      data.items,
      (item) => {
        actions.push(
          item.equipCommand ||
            (item.command?.type === "equip" ? item.command : null) || {
              type: "equip",
              actor,
              item: item.id,
              slot: item.slot,
            },
        );
        return `<article class="kit-row">${itemHeading(item)}<p>${esc(item.description || "")}</p><p class="stat-preview">${esc(modifierText(item.modifiers || item.stats))}</p><div class="kit-actions">${button(`Equip · ${item.slot || "appropriate slot"}`, `data-command="${actions.length - 1}"`, reasonOf(item))}</div></article>`;
      },
      "No spare equipment. Look for a merchant or supplies.",
    );
    show(
      "equipment",
      `${header(data.name || "THE WAYFARER", "Equipment")}<div class="modal-body">${stats(data.stats)}<div class="kit-slots">${slots}</div><h3 class="kit-column-title">Available gear · bonuses shown before equipping</h3>${items}${footer()}</div>`,
      "kit-panel",
    );
    commandButtons(actions, "equipment", params);
  }
  function crafting(data = {}) {
    const actions = [],
      params = { station: data.station, ...data.params };
    const recipes = listOrEmpty(
      data.recipes,
      (recipe) => {
        actions.push(
          recipe.command || {
            type: "craft",
            recipe: recipe.id,
            target: data.station,
          },
        );
        const ingredients = (recipe.ingredients || [])
            .map(
              (i) =>
                `${i.count} ${i.name || i.id}${i.have !== undefined ? ` (${i.have} carried)` : ""}`,
            )
            .join(" · "),
          outputs = (recipe.outputs || [])
            .map((i) => `${i.count || 1} ${i.name || i.id}`)
            .join(", ");
        return `<article class="kit-row"><h3>${esc(recipe.name || recipe.id)}</h3><p>${esc(recipe.description || "")}</p><p class="recipe-line"><b>Requires</b> ${esc(ingredients || "No ingredients")}</p><p class="recipe-line"><b>Produces</b> ${esc(outputs)}</p>${recipe.stationName ? `<p class="recipe-line"><b>Station</b> ${esc(recipe.stationName)}</p>` : ""}<div class="kit-actions">${button("Make recipe", `data-command="${actions.length - 1}"`, reasonOf(recipe))}</div></article>`;
      },
      "No recipes known yet.",
    );
    show(
      "crafting",
      `${header(data.name || "WORK & PROVISIONS", "Recipes")}<div class="modal-body"><p class="modal-intro">${esc(data.description || "Gather the ingredients, then approach the appropriate work station.")}</p>${recipes}${footer()}</div>`,
      "kit-panel",
    );
    commandButtons(actions, "crafting", params);
  }
  function trading(data = {}) {
    const actions = [],
      params = { vendor: data.vendor, ...data.params };
    const rows = (items, type) =>
      listOrEmpty(
        items,
        (item) => {
          actions.push(
            item.command || {
              type,
              vendor: data.vendor,
              item: item.id,
              count: 1,
            },
          );
          return `<article class="kit-row">${itemHeading(item)}<p>${esc(item.description || "")}</p><div class="kit-actions">${button(`${type === "buy" ? "Buy" : "Sell"} one · ${item.price ?? 0} gold`, `data-command="${actions.length - 1}"`, reasonOf(item))}</div></article>`;
        },
        type === "buy"
          ? "No goods available here."
          : "No eligible goods to sell.",
      );
    show(
      "trading",
      `${header("TRADE & SUPPLIES", data.name || "Trading")}<div class="modal-body"><div class="kit-summary"><strong>${esc(data.gold ?? 0)} gold carried</strong><span>${esc(data.description || "Prices shown are for one item.")}</span></div>${data.reason ? `<p class="ownership-note">${esc(data.reason)}</p>` : ""}<div class="kit-columns"><section><h3 class="kit-column-title">For sale</h3>${rows(data.stock, "buy")}</section><section><h3 class="kit-column-title">Your goods</h3>${rows(data.playerItems, "sell")}</section></div>${footer()}</div>`,
      "kit-panel",
    );
    commandButtons(actions, "trading", params);
  }
  function party(data = {}) {
    const actions = [],
      params = data.params || {};
    const control = (member, mode, label) => {
      actions.push({ type: "party", member: member.id, mode });
      return button(
        label,
        `data-command="${actions.length - 1}"`,
        reasonOf(member),
      );
    };
    const members = listOrEmpty(
      data.members,
      (member) =>
        `<article class="kit-row party-row"><div class="party-portrait">${cameo(member.portrait || member.id)}</div><div class="party-details"><h3>${esc(member.name || member.id)}</h3><p>${esc(member.description || "")}</p><span class="item-count">${esc(member.mode || "Following")} · ${esc(member.stance || "assist")}${member.hp !== undefined ? ` · ${Math.ceil(member.hp)} / ${member.maxHp || 100} vitality` : ""}</span><div class="kit-actions">${control(member, member.mode === "wait" ? "follow" : "wait", member.mode === "wait" ? "Follow me" : "Wait here")}${button("Inventory", `data-party-inventory="${esc(member.id)}"`)}${button("Equipment", `data-party-equipment="${esc(member.id)}"`)}${control(member, member.stance === "defensive" ? "assist" : "defensive", member.stance === "defensive" ? "Assist attacks" : "Defend only")}${control(member, "dismiss", "Part ways")}</div></div></article>`,
      "You are travelling alone. Speak with people who might join you.",
    );
    const candidates = listOrEmpty(
      data.candidates,
      (member) =>
        `<article class="kit-row"><h3>${esc(member.name || member.id)}</h3><p>${esc(member.description || "")}</p>${control(member, "recruit", "Invite to join")}</article>`,
      "",
    );
    show(
      "party",
      `${header("COMPANY ON THE ROAD", "Companions")}<div class="modal-body"><div class="kit-summary"><strong>${(data.members || []).length} / ${esc(data.limit ?? 3)} companions</strong><span>Waiting companions hold their position.</span></div>${members}${data.candidates?.length ? `<h3 class="kit-column-title">Available companions</h3>${candidates}` : ""}${footer()}</div>`,
      "kit-panel",
    );
    commandButtons(actions, "party", params);
    panel
      .querySelectorAll("[data-party-inventory]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            requestPanel("container", { id: b.dataset.partyInventory })),
      );
    panel
      .querySelectorAll("[data-party-equipment]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            requestPanel("equipment", { actor: b.dataset.partyEquipment })),
      );
  }
  function progression(data = {}) {
    const actions = [],
      xp = Number(data.xp) || 0,
      next = Number(data.nextLevelXp) || 0;
    const unlocks = listOrEmpty(
      data.unlocks,
      (unlock) => {
        if (unlock.command) actions.push(unlock.command);
        return `<article class="kit-row"><h3>${unlock.learned ? "✓ " : ""}${esc(unlock.name || unlock.id)}</h3><p>${esc(unlock.description || "")}</p><span class="item-count">${unlock.learned ? "Learned" : unlock.level ? `Available at level ${unlock.level}` : "Available through discovery"}</span>${smallReason(unlock)}${unlock.command ? button(unlock.label || "Learn", `data-command="${actions.length - 1}"`, reasonOf(unlock)) : ""}</article>`;
      },
      "Discoveries and challenges will shape your skills.",
    );
    show(
      "progression",
      `${header("EXPERIENCE & ABILITIES", "Your journey")}<div class="modal-body"><div class="progress-lead"><strong>Level ${esc(data.level || 1)}</strong><span>${xp} experience${next ? ` · next level at ${next}` : ""}</span></div>${next ? `<div class="progress-track"><span style="width:${Math.max(0, Math.min(100, (xp / next) * 100))}%"></span></div>` : ""}${stats(data.stats)}<h3 class="kit-column-title">Skills & rewards</h3>${unlocks}${data.statuses?.length ? `<h3 class="kit-column-title">Active effects</h3>${data.statuses.map((status) => `<article class="kit-row"><h3>${esc(status.name || status.id)}</h3><p>${esc(status.description || "")}</p><span class="item-count">${status.remaining === undefined ? "Persistent" : `${Math.ceil(status.remaining)} seconds remaining`}</span></article>`).join("")}` : ""}${footer()}</div>`,
      "kit-panel",
    );
    commandButtons(actions, "progression", data.params || {});
  }
  function downloadJSON(value, name) {
    if (value === undefined || value === null)
      throw new Error("No export is available.");
    const contents =
      typeof value === "string" ? value : JSON.stringify(value, null, 2);
    const url = URL.createObjectURL(
        new Blob([contents], { type: "application/json" }),
      ),
      anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function exportData(options = {}) {
    try {
      downloadJSON(
        await invoke("exportSave", options),
        options.replay
          ? "hollow-bell-replay.json"
          : options.backup
            ? "hollow-bell-legacy-backup.json"
            : "hollow-bell-journey.json",
      );
      toast("Export downloaded.", "success");
    } catch (error) {
      toast(error.message || "Unable to export this journey.", "warning");
    }
  }
  function saves(data = {}) {
    show(
      "saves",
      `${header("YOUR JOURNEY, SAFELY KEPT", "Save & recovery")}<div class="modal-body"><p class="modal-intro">${esc(data.status || "Your journey saves automatically on this device. Keep an exported copy before replacing it.")}</p>${data.error ? `<p class="ownership-note" role="alert">${esc(data.error)}</p>` : ""}<div class="kit-actions">${button("Export current journey", "data-export-save")}${button("Download original backup", "data-export-backup", data.backupAvailable ? "" : "No original backup is available.")}${button("Restore previous safe save", "data-restore-save", data.previousBackupAvailable ? "" : "No previous safe save is available.")}</div><section class="save-import"><h3>Import a journey</h3><p>Choose a JSON save file or paste its contents. Validation runs before your current journey is replaced.</p><input id="save-file" type="file" accept="application/json,.json" aria-label="Choose a saved journey"><label for="save-text">Save contents</label><textarea id="save-text" rows="5" placeholder="Paste the complete exported JSON here" spellcheck="false"></textarea><p id="save-import-status" class="save-status" role="status"></p>${button("Review import", "data-import-review")}</section>${footer()}</div>`,
      "kit-panel",
    );
    bindPanels();
    panel.querySelector("[data-export-save]").onclick = () => exportData();
    panel.querySelector("[data-export-backup]").onclick = () =>
      exportData({ backup: true });
    panel.querySelector("[data-restore-save]").onclick = () => {
      show(
        "save-restore",
        `${header("RECOVER A PREVIOUS JOURNEY", "Restore previous safe save?")}<div class="modal-body"><p class="modal-intro">Restore the previous validated save. Your current save is preserved as a recovery file before replacement.</p><div class="kit-actions">${button("Restore previous save", "data-restore-confirm")}${button("Keep current journey", "data-restore-cancel")}</div><p id="save-restore-status" class="save-status" role="status"></p></div>`,
        "kit-panel",
      );
      panel.querySelector("[data-restore-cancel]").onclick = () => saves(data);
      panel.querySelector("[data-restore-confirm]").onclick = async (event) => {
        const button = event.currentTarget;
        button.disabled = true;
        try {
          const result = await invoke("restoreSave", { source: "previous" });
          if (result?.ok) {
            toast(result.message || "Previous save restored.", "success");
            close();
          } else {
            $("save-restore-status").textContent =
              result?.message ||
              "Recovery was not available. Current data is preserved.";
            button.disabled = false;
          }
        } catch (error) {
          $("save-restore-status").textContent = error.message;
          button.disabled = false;
        }
      };
    };
    $("save-file").onchange = async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (file.size > 4 * 1024 * 1024) {
        $("save-import-status").textContent =
          "Save file is too large (4 MB maximum).";
        return;
      }
      try {
        $("save-text").value = await file.text();
        $("save-import-status").textContent =
          `Loaded ${file.name}. Review to continue.`;
      } catch (error) {
        $("save-import-status").textContent = error.message;
      }
    };
    panel.querySelector("[data-import-review]").onclick = () => {
      const contents = $("save-text").value;
      try {
        const parsed = JSON.parse(contents);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
          throw new Error("Expected a save object.");
      } catch (error) {
        $("save-import-status").textContent =
          `Cannot read save: ${error.message}`;
        return;
      }
      const source = data;
      show(
        "save-confirm",
        `${header("REPLACE THIS JOURNEY?", "Confirm import")}<div class="modal-body"><p class="modal-intro">This will replace the active journey after the save has passed validation. Export your current journey first if you wish to keep both.</p><div class="kit-actions">${button("Export current journey", "data-export-save")}${button("Import and continue", "data-import-confirm")}${button("Keep my current journey", "data-import-cancel")}</div><p id="save-import-status" class="save-status" role="status"></p></div>`,
        "kit-panel",
      );
      panel.querySelector("[data-export-save]").onclick = () => exportData();
      panel.querySelector("[data-import-cancel]").onclick = () => {
        saves(source);
        $("save-text").value = contents;
      };
      panel.querySelector("[data-import-confirm]").onclick = async (event) => {
        const confirmButton = event.currentTarget;
        confirmButton.disabled = true;
        try {
          const result = await invoke("importSave", contents);
          if (result?.ok) {
            toast(result.message || "Journey imported.", "success");
            close();
          } else {
            $("save-import-status").textContent =
              result?.message ||
              "The save was rejected. Your current journey is preserved.";
            confirmButton.disabled = false;
          }
        } catch (error) {
          $("save-import-status").textContent = error.message;
          confirmButton.disabled = false;
        }
      };
    };
  }
  function menuPanel(data = {}) {
    const choices = data.choices || [];
    show(
      "custom",
      `${header(data.subtitle || context.regionName, data.title || "Choose an action")}<div class="modal-body"><p class="modal-intro">${esc(data.text || "")}</p><div class="kit-grid">${choices.map((choice, i) => `<button class="kit-card" data-menu-choice="${i}" ${reasonOf(choice) ? "disabled" : ""}><strong>${esc(choice.label || choice.name)}</strong><span>${esc(choice.description || "")}</span>${smallReason(choice)}</button>`).join("")}</div>${footer()}</div>`,
      "kit-panel",
    );
    bindPanels();
    panel.querySelectorAll("[data-menu-choice]").forEach(
      (b) =>
        (b.onclick = () => {
          const choice = choices[Number(b.dataset.menuChoice)];
          if (choice.command)
            runCommand(choice.command, data.returnPanel || "kit", data.params);
          else if (choice.panel) requestPanel(choice.panel, choice.params);
          else if (choice.action) invoke("choose", choice.action);
        }),
    );
  }

  async function debugAction(command) {
    if (!preview) return;
    try {
      const result = await invoke("debug", command);
      if (result?.message)
        toast(result.message, result.ok ? "success" : "warning");
      if (!result?.handled && modal === "inspector") requestPanel("inspector");
    } catch (error) {
      toast(error.message, "warning");
    }
  }
  function jsonView(value) {
    return `<pre class="inspector-code">${esc(JSON.stringify(value ?? {}, null, 2))}</pre>`;
  }
  function inspector(data = {}) {
    if (!preview) {
      toast("Development tools require an isolated preview.", "warning");
      return;
    }
    const entities = data.entities || [],
      selectedEntity =
        typeof data.selected === "object"
          ? data.selected
          : entities.find((e) => e.id === data.selected) || entities[0];
    const time =
      typeof data.time === "number" ? data.time.toFixed(1) : data.time || "0";
    show(
      "inspector",
      `${header("ISOLATED DEVELOPMENT PREVIEW", "World inspector")}<div class="modal-body"><p class="preview-notice">Preview saves are separate from your normal journey. Development commands affect only this preview.</p><div class="kit-actions">${button("Asset & prefab gallery", 'data-panel="gallery"')}${button("Compatible content reload", 'data-dev="reload-compatible"')}${button("Restart content preview", 'data-dev="reload-restart"')}${button("Export command replay", 'data-dev="replay"')}</div><p class="save-status" id="preview-status">${esc(previewStatus?.errors?.length ? `${previewStatus.errors.length} validation issue(s); last working build retained.` : previewStatus?.revision ? `Content revision ${previewStatus.revision}` : "Content tools available in the development server.")}</p><div id="preview-errors">${previewStatus?.errors?.length ? jsonView(previewStatus.errors) : ""}</div><div class="kit-summary"><strong>World clock ${esc(time)}</strong><div class="kit-actions">${button("+1 minute", 'data-clock="1"')}${button("+1 hour", 'data-clock="60"')}${button("Collision overlay", 'data-dev="collision"')}${button("Path overlay", 'data-dev="paths"')}</div></div><h3 class="kit-column-title">Entities</h3><div class="inspector-entities">${entities.map((entity, i) => `<button class="kit-button ${entity.id === selectedEntity?.id ? "is-selected" : ""}" data-entity="${i}">${esc(entity.name || entity.id)}<small>${esc(entity.id)}</small></button>`).join("")}</div>${selectedEntity ? `<h3 class="kit-column-title">${esc(selectedEntity.id)}</h3><div class="kit-actions">${button("Teleport to entity", 'data-dev="teleport"')}${button("Select in world", 'data-dev="select"')}</div><p class="inspector-source" id="inspector-source-file">${esc(data.source?.file || selectedEntity.source || selectedEntity.definition || "")}</p>${jsonView({ definition: selectedEntity.definition, regionId: selectedEntity.regionId, x: selectedEntity.x, y: selectedEntity.y, z: selectedEntity.z, state: selectedEntity.state })}<details><summary>Source record</summary><div id="inspector-source-record">${jsonView(data.source?.record || data.source || selectedEntity)}</div></details>` : ""}<h3 class="kit-column-title">Conditions</h3>${listOrEmpty(data.conditions, (condition) => `<p class="condition-line ${condition.ok ? "condition-ok" : "condition-fail"}">${condition.ok ? "✓" : "×"} ${esc(condition.label || condition.id || "Condition")}${condition.reason ? ` · ${esc(condition.reason)}` : ""}</p>`, "Select an interaction to inspect its conditions.")}<h3 class="kit-column-title">Quest progress</h3>${jsonView(data.quests || [])}<h3 class="kit-column-title">Recent commands & effects</h3>${jsonView((data.events || []).slice(-40))}<div class="kit-actions">${button("Reset preview scenario", 'data-dev="reset"')}</div>${footer()}</div>`,
      "kit-panel inspector-panel",
    );
    bindPanels();
    if (window.HBAuthoring?.preview && selectedEntity?.definition) {
      const sourceFile = $("inspector-source-file"),
        sourceRecord = $("inspector-source-record");
      fetch(
        `/__preview/source?id=${encodeURIComponent(selectedEntity.definition)}`,
      )
        .then((response) => (response.ok ? response.json() : null))
        .then((source) => {
          if (source && sourceRecord?.isConnected) {
            sourceFile.textContent = `${source.file} · ${source.kind}/${source.id}`;
            sourceRecord.innerHTML = jsonView(source.record);
          }
        })
        .catch(() => {});
    }
    panel.querySelectorAll("[data-entity]").forEach(
      (b) =>
        (b.onclick = () =>
          requestPanel("inspector", {
            selected: entities[Number(b.dataset.entity)].id,
          })),
    );
    panel
      .querySelectorAll("[data-clock]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            debugAction({ type: "clock", minutes: Number(b.dataset.clock) })),
      );
    panel.querySelectorAll("[data-dev]").forEach(
      (b) =>
        (b.onclick = () => {
          const type = b.dataset.dev;
          if (type === "replay") return exportData({ replay: true });
          if (type === "reload-compatible" || type === "reload-restart")
            return debugAction({
              type: "reload",
              mode: type === "reload-restart" ? "restart" : "compatible",
            });
          if (type === "collision" || type === "paths")
            return debugAction({ type: "overlay", layer: type });
          if (type === "reset") return confirmPreviewReset();
          return debugAction({
            type,
            target: selectedEntity?.id,
            id: selectedEntity?.id,
          });
        }),
    );
  }
  function confirmPreviewReset() {
    menuPanel({
      title: "Restart this preview?",
      subtitle: "ISOLATED DEVELOPMENT PREVIEW",
      text: "The preview scenario will restart. Normal player saves are unaffected.",
      choices: [
        { label: "Reset preview", command: { type: "preview-reset" } },
        { label: "Keep exploring", panel: "inspector" },
      ],
    });
    panel.querySelector('[data-menu-choice="0"]').onclick = () =>
      debugAction({ type: "reset" });
  }
  function gallery(data = {}) {
    if (!preview) {
      toast(
        "The asset gallery is available in development preview.",
        "warning",
      );
      return;
    }
    const entries = data.entries ? [...data.entries] : [],
      entry = entries.find((e) => e.id === data.selected) || entries[0],
      params = { ...data.params, selected: entry?.id };
    const settings = {
      facing: Number(data.facing) || 0,
      pose: data.pose || entry?.poses?.[0] || "idle",
      scale: Number(data.scale) || 1,
      lighting: data.lighting || "soft",
      bounds: data.bounds !== false,
    };
    show(
      "gallery",
      `${header("ISOLATED DEVELOPMENT PREVIEW", "Asset & prefab gallery")}<div class="modal-body"><div class="inspector-entities">${entries.map((record, i) => `<button class="kit-button ${record.id === entry?.id ? "is-selected" : ""}" data-gallery-entry="${i}">${esc(record.name || record.id)}<small>${esc(record.kind || "asset")}</small></button>`).join("")}</div>${entry ? `<h3 class="kit-column-title">${esc(entry.name || entry.id)}</h3><div class="gallery-stage"><canvas id="gallery-canvas" width="480" height="320" aria-label="World appearance preview"></canvas><div class="gallery-portrait">${cameo(entry.portrait || entry.asset || entry.id)}<span>Portrait</span></div></div><p class="modal-hint">${typeof handlers.previewAsset === "function" ? "Actual world renderer · preview settings affect this gallery only." : "Appearance metadata preview; an engine preview adapter is not available."}</p><div class="kit-actions">${button(`Facing ${settings.facing}°`, 'data-gallery-control="facing"')}${button(`Pose: ${settings.pose}`, 'data-gallery-control="pose"')}${button(`Scale: ${settings.scale}×`, 'data-gallery-control="scale"')}${button(`Lighting: ${settings.lighting}`, 'data-gallery-control="lighting"')}${button(`Bounds: ${settings.bounds ? "visible" : "hidden"}`, 'data-gallery-control="bounds"')}</div>${jsonView({ id: entry.id, kind: entry.kind, appearance: entry.appearance, asset: entry.asset, collider: entry.collider, pick: entry.pick })}` : '<p class="empty-state">No assets or prefabs registered.</p>'}<div class="modal-footer"><button class="text-button" data-panel="inspector">← Inspector</button><button class="text-button" data-close>Return to preview →</button></div></div>`,
      "kit-panel",
    );
    bindPanels();
    panel.querySelectorAll("[data-gallery-entry]").forEach(
      (b) =>
        (b.onclick = () =>
          requestPanel("gallery", {
            ...params,
            selected: entries[Number(b.dataset.galleryEntry)].id,
          })),
    );
    panel.querySelectorAll("[data-gallery-control]").forEach(
      (b) =>
        (b.onclick = () => {
          const key = b.dataset.galleryControl;
          if (key === "facing") settings.facing = (settings.facing + 45) % 360;
          if (key === "pose") {
            const poses = entry.poses || ["idle", "walk", "attack"];
            settings.pose =
              poses[(poses.indexOf(settings.pose) + 1) % poses.length];
          }
          if (key === "scale")
            settings.scale = settings.scale >= 2 ? 0.5 : settings.scale + 0.5;
          if (key === "lighting")
            settings.lighting =
              settings.lighting === "soft" ? "dynamic" : "soft";
          if (key === "bounds") settings.bounds = !settings.bounds;
          requestPanel("gallery", { ...params, ...settings });
        }),
    );
    if (entry && typeof handlers.previewAsset === "function") {
      const canvas = $("gallery-canvas"),
        start = performance.now();
      let frame = 0,
        callbackCleanup = null,
        active = true;
      const drawPreview = (now) => {
        if (!active || !canvas.isConnected) return;
        const cleanup = invoke("previewAsset", canvas, {
          id: entry.id,
          kind: entry.kind,
          ...settings,
          time: (now - start) / 1000,
        });
        if (typeof cleanup === "function") {
          callbackCleanup = cleanup;
          return;
        }
        frame = requestAnimationFrame(drawPreview);
      };
      drawPreview(start);
      previewCleanup = () => {
        active = false;
        cancelAnimationFrame(frame);
        callbackCleanup?.();
      };
    } else if (entry) {
      const canvas = $("gallery-canvas"),
        ctx = canvas.getContext("2d");
      ctx.fillStyle = "#182c26";
      ctx.fillRect(0, 0, 480, 320);
      ctx.fillStyle = "#c4ad76";
      ctx.font = "16px Georgia";
      ctx.textAlign = "center";
      ctx.fillText("Engine preview adapter unavailable", 240, 155);
      ctx.font = "12px Arial";
      ctx.fillText("Appearance and collision metadata below", 240, 180);
    }
  }

  function help() {
    const controls = [
      ["Walk", "WASD / arrows"],
      ["Walk to a place", "Click / tap"],
      ["Speak or use", "E / ×"],
      ["Draw your blade", "J / □"],
      ["Small magic", "Q / △"],
      ["Open satchel", "I / L1"],
      ["Read journal", "L / R1"],
      ["Region map", "M / touchpad"],
      ["Field kit", "K / satchel link"],
      ["Run", "Shift / R2"],
      ["Pause / go back", "Esc / options"],
      ["Choose a reply", "1–9 / D-pad + ×"],
      ["Touch movement", "Left thumbstick"],
    ];
    show(
      "help",
      `${header("A FEW WORDS BEFORE YOU WANDER", "How to play")}<div class="modal-body"><p class="modal-intro">Listen closely. Look inside things. Follow what feels wrong. The world rewards curiosity.</p><div class="help-grid">${controls.map(([label, key]) => `<div class="control-row"><span>${label}</span><kbd>${key}</kbd></div>`).join("")}</div><p class="help-note">Approach people and objects to interact. Your journal keeps what you discover; your satchel holds what you find. Magic offers another way through danger. Your journey saves automatically on this device.</p><div class="modal-footer"><span class="modal-hint">Headphones recommended · portrait & landscape</span><button class="text-button" data-close>Let’s begin →</button></div></div>`,
    );
  }
  function about() {
    show(
      "about",
      `${header("AN ORIGINAL SPIRITUAL SUCCESSOR", "About this world")}<div class="modal-body"><p class="modal-intro">A small, living place. Ordinary people caught in something extraordinary. The Hollow Bell takes inspiration from the freedom and intimate mysteries of classic world-simulation roleplaying games.</p><div class="about-data"><p><b>Initial date:</b> October 13, 2026<br><b>SOURCE:</b> Ultima VII: The Black Gate for PC (1992)<br><b>GAME ENGINE:</b> <a href="https://github.com/michaelcrosato/my-3d2dge/tree/main/dist/handoff" target="_blank" rel="noopener">my-3D2dge v0.34.0</a><br><b>Environment:</b> Codex cloud, Linux; Chrome / Chromium target<br><b>Model:</b> GPT-6; exact variant and effort level unconfirmed</p><p>Original story, characters, procedural artwork, interface and sound. No artwork or game assets from Ultima VII are included.</p></div><div class="modal-footer"><span class="modal-hint">CHAPTER I · ASHWICK</span><button class="text-button" data-close>Return →</button></div></div>`,
    );
  }
  function ending(state = {}) {
    const heading =
      state.ending?.title || state.endingTitle || "A story changed";
    const narrative =
      state.ending?.text ||
      state.endingText ||
      "Your choices have left their mark on this place. The road remains open.";
    const clueCount = Array.isArray(state.clues)
      ? state.clues.length
      : Number(state.clues) || 0;
    const clueTotal = state.clueTotal ?? clueCount,
      region = state.regionName || context.regionName;
    show(
      "ending",
      `<div class="modal-header"><div class="ending-emblem" data-icon="bell"></div><span class="eyebrow">${esc(state.chapterName || context.chapterName)} · COMPLETE</span><h2 id="modal-heading">${esc(heading)}</h2></div><div class="modal-body"><p class="modal-intro">${esc(narrative)}</p><div class="ending-summary"><div class="ending-stat"><strong>${esc(region)}</strong><span>A story changed</span></div><div class="ending-stat"><strong>${`${clueCount}/${clueTotal}`}</strong><span>Truths uncovered</span></div><div class="ending-stat"><strong>You</strong><span>The choice was yours</span></div></div><p class="help-note">Some journeys end with an answer.<br>Others begin with what it asks of us.</p><div class="ending-actions"><button id="ending-continue" class="button button-gold">Remain in ${esc(region)} <span>→</span></button><button id="ending-restart" class="text-button">Begin a new journey</button></div></div>`,
      "ending-panel",
    );
    $("ending-continue").onclick = () => {
      close();
      invoke("continueEnding");
    };
    $("ending-restart").onclick = () => {
      show(
        "restart",
        `${header("A NEW CHAPTER", "Begin again?")}<div class="modal-body"><p class="modal-intro">This will replace your saved journey. Export a copy from the field kit first if you wish to keep it.</p><div class="pause-buttons"><button id="restart-confirm" class="button button-gold">Start a new journey <span>→</span></button><button id="restart-cancel" class="button button-outline">Keep this ending <span>↶</span></button></div></div>`,
      );
      $("restart-confirm").onclick = () => {
        close();
        invoke("begin", true);
      };
      $("restart-cancel").onclick = () => ending(state);
    };
  }
  function toast(message, kind = "") {
    if (!message) return;
    const el = document.createElement("div");
    el.className = `toast ${kind === "warning" ? "danger" : kind === "success" ? "success" : ""}`;
    el.textContent = String(message);
    $("toast-stack").appendChild(el);
    while ($("toast-stack").children.length > 3)
      $("toast-stack").firstChild.remove();
    setTimeout(() => {
      el.classList.add("is-leaving");
      setTimeout(() => el.remove(), 350);
    }, 4700);
  }
  function update(data = {}) {
    function set(key, value, fn) {
      if (value !== undefined && cache[key] !== value) {
        cache[key] = value;
        fn(value);
      }
    }
    const hp = typeof data.hp === "object" ? data.hp.current : data.hp,
      maxHp =
        typeof data.hp === "object" ? data.hp.max || 100 : data.maxHp || 100;
    const mana = typeof data.mana === "object" ? data.mana.current : data.mana,
      maxMana =
        typeof data.mana === "object"
          ? data.mana.max || 60
          : data.maxMana || 60;
    // Equipment can change a maximum without changing the current resource.
    if (cache.maxHp !== maxHp) { cache.maxHp = maxHp; cache.hp = undefined; }
    if (cache.maxMana !== maxMana) { cache.maxMana = maxMana; cache.mana = undefined; }
    set("hp", hp, (v) => {
      $("hp-fill").style.width =
        `${Math.max(0, Math.min(100, (v / maxHp) * 100))}%`;
      $("hp-number").textContent = Math.ceil(v);
    });
    set("mana", mana, (v) => {
      $("mana-fill").style.width =
        `${Math.max(0, Math.min(100, (v / maxMana) * 100))}%`;
      $("mana-number").textContent = Math.floor(v);
    });
    set("gold", data.gold, (v) => {
      $("gold-counter").innerHTML = `${esc(v)} <i>◈</i>`;
    });
    set("objectiveTitle", data.objectiveTitle, (v) => {
      if ($("objective-title")) $("objective-title").textContent = v;
    });
    set("objective", data.objective, (v) => {
      $("objective-text").textContent = v;
    });
    set("location", data.location, (v) => {
      $("location").textContent = v;
    });
    set(
      "time",
      typeof data.time === "number"
        ? `${String(Math.floor(data.time / 60) % 24).padStart(2, "0")}:${String(Math.floor(data.time) % 60).padStart(2, "0")}`
        : data.time,
      (v) => {
        $("world-time").textContent = v;
      },
    );
    set("companion", data.companion, (v) => {
      $("companion-line").classList.toggle("hidden", !v);
      $("companion-name").textContent =
        typeof v === "string" ? v : "Your companions are following";
    });
    set("nearName", data.nearName, (v) => {
      $("interaction-prompt").classList.toggle(
        "hidden",
        !v || title || !!modal,
      );
      $("near-name").textContent = v ? `Interact · ${v}` : "";
    });
    set("muted", data.muted, (v) => {
      muted = v;
      $("sound-button").innerHTML = icon(muted ? "mute" : "sound");
      $("sound-button").setAttribute(
        "aria-label",
        muted ? "Enable sound" : "Mute sound",
      );
    });
    if (data.labels)
      Object.entries(data.labels).forEach(([action, label]) =>
        set(`label:${action}`, label, (v) => {
          const key = document.querySelector(`[data-action="${action}"] kbd`);
          if (key) key.textContent = v;
        }),
      );
  }
  function showTitle(hasSave = false) {
    title = true;
    $("title-screen").classList.remove("hidden");
    $("hud").classList.add("hidden");
    $("continue-button").classList.toggle("hidden", !hasSave);
    $("begin-button").innerHTML =
      `${hasSave ? "Begin a new journey" : "Begin journey"} <span>${icon("arrow")}</span>`;
    $("loading-status").classList.add("hidden");
    selected = -1;
    close();
  }
  function hideTitle() {
    title = false;
    $("title-screen").classList.add("hidden");
    $("hud").classList.remove("hidden");
    $("loading-status").classList.add("hidden");
    $("screen").focus({ preventScroll: true });
  }
  function navigate(dir) {
    const buttons = activeButtons();
    if (!buttons.length) return;
    buttons.forEach((b) => b.classList.remove("gamepad-focus"));
    const focused = buttons.indexOf(document.activeElement);
    if (focused >= 0) selected = focused;
    selected =
      selected < 0
        ? dir < 0
          ? buttons.length - 1
          : 0
        : (selected + (dir < 0 ? -1 : 1) + buttons.length) % buttons.length;
    buttons[selected].classList.add("gamepad-focus");
    buttons[selected].focus({ preventScroll: true });
    buttons[selected].scrollIntoView({ block: "nearest" });
  }
  function confirm() {
    const buttons = activeButtons();
    if (!buttons.length) return;
    const focused = buttons.includes(document.activeElement)
      ? document.activeElement
      : null;
    (focused || buttons[Math.max(0, selected)])?.click();
  }
  function back() {
    if (modal) close();
  }
  function init(callbacks = {}) {
    handlers = callbacks;
    icons();
    $("loading-status").classList.add("hidden");
    if ($("kit-button")) $("kit-button").onclick = () => requestPanel("kit");
    if (preview && $("preview-badge")) {
      $("preview-badge").classList.remove("hidden");
      $("preview-badge").onclick = () => requestPanel("inspector");
    }
    if (preview && window.HBAuthoring?.preview) {
      const poll = async () => {
        try {
          const response = await fetch("/__preview/status");
          if (response.ok) {
            previewStatus = await response.json();
            const errors = $("preview-errors");
            if (errors)
              errors.innerHTML = previewStatus.errors?.length
                ? jsonView(previewStatus.errors)
                : "";
            const label = $("preview-status");
            if (label)
              label.textContent = previewStatus.errors?.length
                ? `${previewStatus.errors.length} validation issue(s); last working build retained.`
                : `Content revision ${previewStatus.revision || "ready"} · reload when ready`;
          }
        } catch {}
      };
      poll();
      setInterval(poll, 3000);
    }
    $("begin-button").onclick = () => {
      if (!$("continue-button").classList.contains("hidden")) {
        show(
          "restart",
          `${header("BEGIN A NEW JOURNEY", "Leave your old story behind?")}<div class="modal-body"><p class="modal-intro">Starting again will replace the journey saved on this device.</p><div class="pause-buttons"><button id="fresh-confirm" class="button button-gold">Begin anew <span>→</span></button><button class="button button-outline" data-close>Keep my journey <span>↶</span></button></div></div>`,
        );
        $("fresh-confirm").onclick = () => {
          close();
          invoke("begin", true);
        };
      } else invoke("begin", true);
    };
    $("continue-button").onclick = () => invoke("begin", false);
    $("title-help").onclick = help;
    $("help-button").onclick = help;
    $("about-button").onclick = about;
    $("objective-journal").onclick = () => invoke("journal");
    document.querySelectorAll("[data-action]").forEach((b) => {
      b.onclick = () => {
        if (modal) close();
        invoke(b.dataset.action);
      };
    });
    $("sound-button").onclick = () => {
      const game = window.My3D2dge?.current;
      if (game?.settings) {
        game.settings.set("sound", !game.settings.sound);
        update({ muted: !game.settings.sound });
      } else if (handlers.sound) invoke("sound");
    };
    $("fullscreen-button").onclick = () => {
      const fs = window.My3D2dge?.current?.fullscreen;
      if (fs) fs.toggle();
      else toast("Use your browser’s full-screen or home-screen mode.");
    };
    $("modal-layer").addEventListener("pointerdown", (e) => {
      if (e.target === $("modal-layer") && modal !== "ending") close();
    });
    document.addEventListener("keydown", (event) => {
      if (modal) {
        if (isEditing() && event.key !== "Tab") return;
        if (
          title &&
          ["Escape", "ArrowDown", "ArrowUp", "Enter"].includes(event.key)
        ) {
          event.preventDefault();
          event.stopPropagation();
          if (event.key === "Escape") back();
          else if (event.key === "Enter") confirm();
          else navigate(event.key === "ArrowUp" ? -1 : 1);
          return;
        }
        if (event.key === "Tab") {
          const buttons = Array.from(
            panel.querySelectorAll(
              "button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),summary",
            ),
          );
          if (buttons.length) {
            const first = buttons[0],
              last = buttons[buttons.length - 1];
            if (
              event.shiftKey &&
              (document.activeElement === first ||
                document.activeElement === panel)
            ) {
              event.preventDefault();
              last.focus();
            } else if (
              !event.shiftKey &&
              (document.activeElement === last ||
                document.activeElement === panel)
            ) {
              event.preventDefault();
              first.focus();
            }
          }
        }
        if (modal === "dialog" && /^[1-9]$/.test(event.key)) {
          const b = panel.querySelector(
            `[data-choice="${Number(event.key) - 1}"]`,
          );
          if (b && !b.disabled) {
            event.preventDefault();
            b.click();
          }
        }
      } else if (!title && event.key.toLowerCase() === "k") {
        event.preventDefault();
        requestPanel("kit");
      } else if (
        title &&
        ["ArrowDown", "ArrowUp", "Enter"].includes(event.key)
      ) {
        event.preventDefault();
        if (event.key === "Enter") confirm();
        else navigate(event.key === "ArrowUp" ? -1 : 1);
      }
    });
    document.addEventListener(
      "keydown",
      (event) => {
        if (isEditing() && event.key !== "Escape" && event.key !== "Tab")
          event.stopPropagation();
      },
      true,
    );
  }
  function isEditing() {
    return (
      !!modal &&
      ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)
    );
  }
  window.HBUI = {
    init,
    showTitle,
    hideTitle,
    update,
    dialog,
    inventory,
    journal,
    map,
    help,
    toast,
    ending,
    close,
    configure,
    kit,
    container,
    equipment,
    crafting,
    trading,
    party,
    progression,
    saves,
    menuPanel,
    inspector,
    gallery,
    isOpen: () => !!modal,
    titleOpen: () => title,
    navigate,
    confirm,
    back,
    about,
    isEditing,
    previewEnabled: () => preview,
  };
})();
