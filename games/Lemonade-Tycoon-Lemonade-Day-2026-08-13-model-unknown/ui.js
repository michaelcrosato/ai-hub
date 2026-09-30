/**
 * ui.js — every screen and panel as h() trees: title, top bar, the world
 * overlays, the planner, results, the week finale and the utility dialogs.
 * Views read `ctx = { state, app, d, act }` and never change state directly.
 */

import { h } from './dom.js';
import * as S from './sim.js';

const { money } = S;

// ---------------------------------------------------------------- small parts

const miniMeter = (value, tone = 'lemon') => h('span', { class: `mini-meter ${tone}` }, h('i', { style: { width: `${S.clamp(0, 100, value).toFixed(1)}%` } }));

function stepper({ value, onChange, min, max, step = 1, label, format }) {
  const text = format ? format(value) : String(value);
  return h(
    'div',
    { class: 'stepper', role: 'group', 'aria-label': `${label}: ${text}` },
    h('button', { type: 'button', onclick: () => onChange(Math.max(min, S.round2(value - step))), disabled: value <= min, 'aria-label': `Decrease ${label}` }, '−'),
    h('span', null, text),
    h('button', { type: 'button', onclick: () => onChange(Math.min(max, S.round2(value + step))), disabled: value >= max, 'aria-label': `Increase ${label}` }, '+')
  );
}

function contractCard(day, met) {
  const c = S.contractFor(day);
  return h('div', { class: `contract-card ${met ? 'met' : ''}` }, h('i', null, met ? '✓' : '★'), h('span', null, h('small', null, 'TODAY’S CONTRACT \xB7 +', money(c.reward)), h('b', null, c.title), h('em', null, c.note)));
}

const trim = (n) =>
  n
    .toFixed(2)
    .replace(/\.00$/, '')
    .replace(/(\.\d)0$/, '$1');

function staffPlanner(selected, roster, mods, onSelect) {
  const r = selected ? roster[selected] : null;
  const delight = mods.delightBonus ? ` \xB7 ${mods.delightBonus > 0 ? '+' : ''}${mods.delightBonus} delight` : '';
  const sign = mods.delightBonus >= 0 ? '+' : '';
  const effect =
    selected === 'mia'
      ? `+${mods.capacityBonus} service \xB7 ${sign}${mods.delightBonus} delight today`
      : selected === 'priya'
        ? `+${mods.qualityBonus} quality \xB7 ${Math.round(mods.supplyDiscount * 100)}% off stock${delight}`
        : selected === 'theo'
          ? `+${trim((mods.visitorMultiplier - 1) * 100)}% visitors today${delight}`
          : selected === 'june'
            ? `+${trim(mods.buyBonus * 100)}% purchase interest \xB7 ${sign}${mods.delightBonus} delight today`
            : '';
  return h(
    'div',
    { class: 'staff-planner' },
    h('div', { class: 'field-label' }, h('label', { id: 'staff-picker-label' }, 'Schedule the Sunshine Crew'), h('span', null, 'one teammate per day')),
    h(
      'div',
      { class: 'staff-picker', role: 'group', 'aria-labelledby': 'staff-picker-label' },
      h(
        'button',
        { type: 'button', 'aria-pressed': selected === null, class: `staff-choice solo ${selected === null ? 'selected' : ''}`, onclick: () => onSelect(null) },
        h('span', { class: 'staff-avatar solo', 'aria-hidden': 'true' }, '☀'),
        h('span', null, h('b', null, 'Run solo'), h('small', null, 'No wage \xB7 everyone rests')),
        h('em', null, 'Free')
      ),
      S.STAFF_IDS.map((id) => {
        const info = S.STAFF[id];
        const rr = roster[id];
        const locked = !rr.unlocked;
        return h(
          'button',
          {
            key: id,
            type: 'button',
            'aria-pressed': selected === id,
            'aria-disabled': locked,
            class: `staff-choice tone-${info.tone} ${selected === id ? 'selected' : ''} ${locked ? 'locked' : ''}`,
            onclick: () => {
              if (!locked) onSelect(id);
            },
          },
          h('span', { class: 'staff-avatar', 'aria-hidden': 'true' }, info.portrait),
          h('span', null, h('b', null, info.shortName), h('small', null, locked ? info.unlock : `${info.role} \xB7 ${S.fatigueLabel(rr.fatigue)}`)),
          h('em', null, locked ? 'Locked' : `$${info.wage}`)
        );
      })
    ),
    h(
      'div',
      { class: `staff-detail ${selected ? `tone-${S.STAFF[selected].tone}` : 'solo'}`, 'aria-live': 'polite' },
      selected && r
        ? [
            h('span', { class: 'staff-avatar', 'aria-hidden': 'true' }, S.STAFF[selected].portrait),
            h('span', null, h('b', null, S.STAFF[selected].name, ' \xB7 ', S.STAFF[selected].role), h('small', null, effect, r.fatigue === 2 ? ' \xB7 skills are reduced while tired' : '')),
            h('em', null, h('b', null, S.fatigueLabel(r.fatigue)), h('small', null, S.moraleLabel(r.morale), ' morale')),
          ]
        : [
            h('span', { class: 'staff-avatar solo', 'aria-hidden': 'true' }, '☀'),
            h('span', null, h('b', null, 'A solo day'), h('small', null, 'Save the wage while the whole crew recovers one fatigue level.')),
            h('em', null, h('b', null, '$0'), h('small', null, 'payroll')),
          ]
    )
  );
}

// ---------------------------------------------------------------- input prompts

/** What the scene pill says, for the device the player is using right now. */
function controlsHint(source, phase) {
  if (source === 'gamepad') return phase === 'open' ? ['RS turn \xB7 LB/RB zoom \xB7 ', h('kbd', null, 'Y'), ' 1\xD7/4\xD7'] : ['RS turn \xB7 LB/RB zoom \xB7 ', h('kbd', null, 'A'), ' select'];
  if (source === 'touch') return 'Drag to turn \xB7 pinch to zoom';
  return phase === 'open' ? ['Drag to turn \xB7 wheel zoom \xB7 ', h('kbd', null, 'F'), ' speed'] : 'Drag to turn \xB7 wheel to zoom';
}

function pitchHint(source) {
  if (source === 'touch') return 'Tap a pitch on the map or in the planner';
  if (source === 'gamepad') return 'Choose a pitch in the planner';
  return 'Choose a pitch in the planner or on the map';
}

export const CONTROLS = {
  keyboard: {
    label: 'Keyboard & mouse',
    rows: [
      [['Click'], 'Press buttons, pick a pitch on the map'],
      [['Tab', '←↑→↓', 'WASD'], 'Move between buttons and sliders'],
      [['Enter', 'Space'], 'Press the highlighted button'],
      [['Drag'], 'Turn the town (left or right mouse button)'],
      [['Wheel', '+', '−'], 'Zoom toward your stand'],
      [['C'], 'Recenter the view'],
      [['F'], 'Switch 1\xD7 / 4\xD7 while the stand is open'],
      [['J'], 'Open the journal'],
      [['Esc', 'P'], 'Pause, or close the open panel'],
      [['F9'], 'Graphics, resolution and control options'],
    ],
  },
  gamepad: {
    label: 'Gamepad',
    rows: [
      [['D-pad', 'Left stick'], 'Move between buttons; left / right change sliders'],
      [['A'], 'Press the highlighted button'],
      [['B'], 'Back: close the open panel'],
      [['Right stick'], 'Turn the town (scrolls long panels)'],
      [['LB', 'RB'], 'Zoom out / in'],
      [['RS click'], 'Recenter the view'],
      [['Y'], 'Switch 1\xD7 / 4\xD7 while the stand is open'],
      [['View'], 'Open the journal'],
      [['Start'], 'Pause menu'],
    ],
  },
  touch: {
    label: 'Touch',
    rows: [
      [['Tap'], 'Press buttons, pick a pitch on the map'],
      [['Drag the map'], 'Turn the town'],
      [['Pinch'], 'Zoom toward your stand'],
      [['Ⅱ'], 'Pause menu (top right)'],
      [['▤'], 'Journal (top right)'],
    ],
  },
};

// ---------------------------------------------------------------- title

export function titleView({ state, app, act }) {
  const hasSave = !!app.savedGame;
  const blocked = !!app.modal;
  return h(
    'main',
    { class: 'title-screen', 'data-layer': 'title', 'data-base': 'true', inert: blocked, 'aria-hidden': blocked ? 'true' : null },
    h('div', { class: 'title-sky', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')),
    h(
      'div',
      { class: 'title-diorama', 'aria-hidden': 'true' },
      h('span', { class: 'title-ground' }),
      h('span', { class: 'title-road' }),
      h('span', { class: 'title-tree tr1' }),
      h('span', { class: 'title-tree tr2' }),
      h('span', { class: 'title-tree tr3' }),
      h('span', { class: 'title-house h1' }),
      h('span', { class: 'title-house h2' }),
      h('span', { class: 'title-stand' }, h('i'), h('b', null, '●'), h('em')),
      h('span', { class: 'title-person tp1' }),
      h('span', { class: 'title-person tp2' }),
      h('span', { class: 'title-person tp3' })
    ),
    h(
      'section',
      { class: 'title-copy' },
      h('span', { class: 'eyebrow' }, 'A tiny business. A whole town to win over.'),
      h('div', { class: 'title-logo' }, h('span', { class: 'brand-fruit' }, '●'), h('div', null, h('h1', null, 'Lemonade', h('br'), 'Day'), h('p', null, 'Make a little sunshine.'))),
      h('p', { class: 'title-intro' }, 'Plan the perfect stand, meet your neighbors, and turn seven summer days into one sweet success story.')
    ),
    h(
      'section',
      { class: 'title-menu', 'aria-label': 'Main menu' },
      hasSave &&
        h(
          'button',
          { class: 'menu-primary continue', type: 'button', onclick: act.continueGame },
          h('span', null, h('small', null, app.savedGame.phase === 'week-end' ? 'REVIEW YOUR WEEK' : 'CONTINUE YOUR WEEK'), h('b', null, 'Day ', app.savedGame.day)),
          h('i', null, '→')
        ),
      h('div', { class: 'difficulty-label' }, h('span', null, 'NEW WEEK'), h('small', null, 'Choose a pace')),
      h(
        'div',
        { class: 'difficulty-options' },
        S.DIFFICULTY_IDS.map((id) => {
          const d = S.DIFFICULTY[id];
          const best = app.records[id];
          return h(
            'button',
            { key: id, type: 'button', 'aria-pressed': state.difficulty === id, class: state.difficulty === id ? 'selected' : '', onclick: () => act.selectDifficulty(id) },
            h('b', null, d.name),
            h('small', null, d.note),
            best && h('span', { class: 'best' }, `Best ${money(best.value)} \xB7 ${best.medal}`),
            h('em', null, money(d.target), ' goal')
          );
        })
      ),
      h('button', { class: 'menu-primary new', type: 'button', onclick: act.newGame }, h('span', null, 'START A NEW WEEK'), h('i', null, '→')),
      h(
        'div',
        { class: 'menu-secondary' },
        h('button', { type: 'button', onclick: () => act.openModal('tutorial') }, 'How to play'),
        h('button', { type: 'button', onclick: () => act.openModal('controls') }, 'Controls'),
        h('button', { type: 'button', onclick: () => act.openModal('settings') }, 'Settings'),
        h('button', { type: 'button', onclick: () => act.openModal('credits') }, 'Credits')
      ),
      h('p', { class: 'save-note' }, 'Progress saves automatically on this device.')
    ),
    h('footer', { class: 'title-footer' }, h('span', null, 'LEMONADE DAY'), h('span', null, 'A SUNSHINE BUSINESS STORY'))
  );
}

// ---------------------------------------------------------------- game: top bar

export function topbarView({ state: s, app, d, act }) {
  const diff = S.DIFFICULTY[s.difficulty];
  return [
    h('div', { class: 'brand-lockup' }, h('span', { class: 'brand-fruit', 'aria-hidden': 'true' }, '●'), h('div', null, h('b', null, 'Lemonade Day'), h('small', null, 'make a little sunshine'))),
    h('div', { class: 'day-chip', title: `${diff.name} goal: ${money(diff.target)} business value` }, h('span', null, 'DAY'), h('b', null, s.day), h('i', null, '/ 7')),
    h('div', { class: 'top-stat' }, h('span', null, 'Cash'), h('b', null, money(s.cash))),
    h('div', { class: 'top-stat reputation' }, h('span', null, 'Reputation'), h('b', null, s.reputation), miniMeter(s.reputation, 'teal')),
    h('div', { class: 'forecast-chip' }, h('span', { class: 'weather-icon' }, d.weather.icon), h('div', null, h('b', null, d.weather.label, ' \xB7 ', d.weather.temp, '\xB0C'), h('small', null, d.weather.event))),
    h(
      'div',
      { class: 'top-actions' },
      h('span', null, app.saveStatus),
      h('button', { type: 'button', onclick: act.toggleSound, 'aria-label': app.settings.sound ? 'Mute sound' : 'Turn sound on' }, app.settings.sound ? '♪' : '\xD7'),
      h('button', { type: 'button', onclick: () => act.openModal('journal'), 'aria-label': 'Open journal' }, '▤'),
      h('button', { type: 'button', onclick: act.openPause, 'aria-label': 'Pause game' }, 'Ⅱ')
    ),
  ];
}

// ---------------------------------------------------------------- game: world overlays

export function worldView({ state: s, app, d, act }) {
  const o = s.outcome;
  const open = s.phase === 'open' && o;
  return [
    h(
      'div',
      { class: 'scene-topline' },
      h('span', { class: 'scene-instruction' }, h('i', null, '⌖'), s.phase === 'plan' ? pitchHint(app.source) : `${S.LOCATIONS[s.location].name} \xB7 ${d.clock}`),
      h('span', { class: 'controls-pill' }, h('i'), controlsHint(app.source, s.phase))
    ),
    h(
      'div',
      { class: 'map-labels', 'aria-hidden': 'true' },
      S.LOCATION_IDS.map((id) =>
        h('span', { key: id, class: `map-label ${id} ${s.location === id ? 'active' : ''}`, 'data-loc': id, 'data-placed': 'false' }, S.LOCATIONS[id].name, h('small', null, money(S.LOCATIONS[id].fee), ' pitch'))
      )
    ),
    open &&
      h(
        'div',
        { class: 'open-hud' },
        h('span', { class: 'sr-only', role: 'status', 'aria-live': 'polite' }, d.clockStatus),
        h('div', { class: 'open-hud-head' }, h('span', null, h('i', { class: 'live-dot' }), ' Stand open'), h('b', null, d.clock)),
        h(
          'div',
          { class: 'open-metrics' },
          h('div', null, h('span', null, 'Cups sold'), h('b', null, d.sold), h('small', null, money(d.sold * o.price))),
          h('div', null, h('span', null, 'Stock left'), h('b', null, d.stockLeft), h('small', null, d.stockLeft < 6 ? 'running low' : 'cups ready')),
          h('div', null, h('span', null, 'Visitors'), h('b', null, d.visitorsSoFar), h('small', null, 'passing today')),
          h('div', null, h('span', null, 'Delight'), h('b', null, Math.round(d.delightNow)), miniMeter(d.delightNow, 'teal'))
        ),
        h(
          'div',
          { class: 'day-progress', role: 'progressbar', 'aria-label': 'Stand day progress', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(s.progress * 100) },
          h('i', { style: { width: `${(s.progress * 100).toFixed(1)}%` } })
        ),
        h(
          'div',
          { class: 'open-actions' },
          h('button', { type: 'button', 'aria-pressed': app.speed === 1, class: app.speed === 1 ? 'active' : '', onclick: () => act.setSpeed(1) }, '1\xD7'),
          h('button', { type: 'button', 'aria-pressed': app.speed === 4, class: app.speed === 4 ? 'active' : '', onclick: () => act.setSpeed(4) }, '4\xD7'),
          h('button', { type: 'button', class: 'close-now', onclick: act.skipDay }, 'Skip to close')
        )
      ),
    contractCard(s.day, d.showResults ? o?.contractMet : undefined),
    h('div', { class: 'event-feed', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' }, h('span', null, 'Today’s buzz'), h('p', null, app.buzz)),
    h(
      'div',
      { class: 'owned-row' },
      h('span', null, 'Booth'),
      d.specialty
        ? h('small', { class: 'specialty-name' }, S.UPGRADES[d.specialty].icon, ' ', S.UPGRADES[d.specialty].name)
        : s.upgrades.length
          ? s.upgrades.map((u) => h('i', { key: u, title: S.UPGRADES[u].name }, S.UPGRADES[u].icon))
          : h('small', null, 'starter setup')
    ),
  ];
}

// ---------------------------------------------------------------- game: planner

export function plannerView({ state: s, d, act }) {
  const plan = d.plan;
  const loc = S.LOCATIONS[s.location];
  const w = d.weather;
  const locked = s.phase !== 'plan';
  const marketDay = S.isMarketDay(s.day);
  const bulkNow = s.phase === 'plan' ? s.procurement.bulkPreset : s.outcome?.pack.bulkPreset ?? 'none';
  const eventTitle = w.eventMultiplier === 1 ? 'A weather-led day' : w.eventLocation ? (d.aligned ? 'Your pitch catches today’s event' : `Event favors ${S.LOCATIONS[w.eventLocation].name}`) : 'Townwide event traffic';
  const cornerPacks = Object.values(plan.pack.cornerPacks).reduce((a, b) => a + b, 0);
  return [
    h(
      'div',
      { class: 'planner-head' },
      h('div', null, h('span', null, 'Today’s plan'), h('h1', null, 'Build your day')),
      h('span', { class: 'plan-cost' }, h('small', null, 'Spend'), money(plan.expenses))
    ),
    h(
      'fieldset',
      { class: 'planner-scroll planner-fieldset', disabled: locked },
      h('legend', { class: 'sr-only' }, 'Daily business plan'),
      // 1 · pitch
      h(
        'section',
        { class: 'plan-section' },
        h('div', { class: 'section-title' }, h('span', { class: 'section-number' }, '1'), h('div', null, h('h2', null, 'Pick your pitch'), h('p', null, 'Foot traffic, taste and rent all change.'))),
        h(
          'div',
          { class: 'location-options', role: 'group', 'aria-label': 'Stand location' },
          S.LOCATION_IDS.map((id) =>
            h(
              'button',
              { key: id, type: 'button', 'aria-pressed': s.location === id, onclick: () => act.setLocation(id), class: s.location === id ? 'selected' : '' },
              h('i', null, S.LOCATIONS[id].icon),
              h('span', null, h('b', null, S.LOCATIONS[id].name), h('small', null, S.LOCATIONS[id].kicker)),
              h('em', null, money(S.LOCATIONS[id].fee))
            )
          )
        ),
        h(
          'div',
          { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true', class: `event-read ${d.aligned ? 'aligned' : 'elsewhere'}` },
          h('i', { 'aria-hidden': 'true' }, w.icon),
          h('span', null, h('b', null, eventTitle), h('small', null, w.event, d.aligned && s.upgrades.includes('festival') && w.eventMultiplier > 1 ? ' \xB7 Bunting adds 18% more visitors' : ''))
        ),
        (marketDay || s.location === 'market') &&
          h(
            'div',
            { class: `event-read market ${s.location === 'market' && marketDay ? 'aligned' : ''}` },
            h('i', { 'aria-hidden': 'true' }, S.LOCATIONS.market.icon),
            h(
              'span',
              null,
              h('b', null, marketDay ? 'Market day at Old Mill Market' : 'A quiet day at the mill'),
              h(
                'small',
                null,
                marketDay
                  ? `Growers’ stalls pull a crowd: +${Math.round((S.LOCATIONS.market.marketBoost - 1) * 100)}% visitors there today`
                  : 'Market days are 2, 4 and 6',
                ` \xB7 lemons ${Math.round(S.LOCATIONS.market.lemonDiscount * 100)}% off at the stalls`
              )
            )
          )
      ),
      // 2 · supplies
      h(
        'section',
        { class: 'plan-section two-col-section' },
        h(
          'div',
          null,
          h('div', { class: 'section-title compact' }, h('span', { class: 'section-number' }, '2'), h('div', null, h('h2', null, 'Pack supplies'), h('p', null, 'Fresh enough for ', s.prepared, ' cups.'))),
          h('div', { class: 'field-row prominent' }, h('label', null, 'Prepared cups'), stepper({ label: 'prepared cups', value: s.prepared, onChange: act.setPrepared, min: 10, max: S.TRANSPORT[s.transport].capacity, step: 10 }))
        ),
        h(
          'div',
          { class: 'pantry-box' },
          h('label', null, 'Home pantry'),
          h(
            'div',
            { class: 'pantry-mini' },
            S.SUPPLIES.map((k) =>
              h('span', { key: k, role: 'group', 'aria-label': `${S.SUPPLY[k].name}: ${d.pantryNow[k]} ${S.SUPPLY[k].unit}` }, h('i', { 'aria-hidden': 'true' }, S.SUPPLY[k].icon), h('b', { 'aria-hidden': 'true' }, d.pantryNow[k]))
            )
          ),
          h(
            'small',
            null,
            'Corner pickup today \xB7 ',
            cornerPacks,
            ' packs \xB7 ',
            money(d.cornerPaid),
            d.cornerSaving > 0 ? ` \xB7 Priya saves ${money(d.cornerSaving)}` : '',
            s.location === 'market' && plan.pack.cornerPacks.lemons > 0 ? ' \xB7 growers’ lemons' : ''
          )
        )
      ),
      h(
        'section',
        { class: 'plan-section' },
        h('div', { class: 'field-label' }, h('label', null, 'How will it get there?'), h('span', null, 'max ', S.TRANSPORT[s.transport].capacity, ' cups')),
        h(
          'div',
          { class: 'choice-strip transport-strip', role: 'group', 'aria-label': 'Transport method' },
          Object.keys(S.TRANSPORT).map((k) =>
            h(
              'button',
              { key: k, type: 'button', 'aria-pressed': s.transport === k, onclick: () => act.setTransport(k), class: s.transport === k ? 'selected' : '' },
              h('i', null, S.TRANSPORT[k].icon),
              h('b', null, S.TRANSPORT[k].name),
              h('small', null, S.TRANSPORT[k].cost ? `${money(S.TRANSPORT[k].cost)}/day` : 'free')
            )
          )
        )
      ),
      h(
        'section',
        { class: 'plan-section bulk-order-section' },
        h('div', { class: 'field-label' }, h('label', null, 'Order ahead from Bulk Club'), h('span', null, s.day === 1 ? 'unlocks day 2' : s.day === 7 ? 'final day' : '30% off cases \xB7 $16 min')),
        s.pantry.incoming.length > 0 &&
          h(
            'div',
            { class: 'incoming-orders' },
            s.pantry.incoming.map((o) =>
              h(
                'span',
                { key: `o${o.orderId}` },
                h('i', null, '▰'),
                h('b', null, S.BULK[o.preset].name),
                h('small', null, o.arrivalDay === s.day + 1 ? `Arrives tomorrow \xB7 paid ${money(d.receiptPaid(o.orderId, o.invoice))}` : `Expected day ${o.arrivalDay} \xB7 paid ${money(d.receiptPaid(o.orderId, o.invoice))}`)
              )
            )
          ),
        h(
          'div',
          { class: 'bulk-presets', role: 'group', 'aria-label': 'Bulk Club order for a future day' },
          S.BULK_IDS.map((k) => {
            const preset = S.BULK[k];
            const unavailable = k !== 'none' && (s.day === 1 || s.day === 7);
            const gross = S.bulkInvoice(k, S.DIFFICULTY[s.difficulty].cost);
            const withPriya = S.round2(gross * (1 - plan.staff.supplyDiscount));
            return h(
              'button',
              { key: k, type: 'button', disabled: unavailable, 'aria-pressed': bulkNow === k, onclick: () => act.setBulk(k), class: bulkNow === k ? 'selected' : '' },
              h('b', null, preset.name),
              h('small', null, unavailable ? (s.day === 1 ? 'Available tomorrow' : 'No later delivery') : preset.note),
              h('em', null, k === 'none' ? 'free' : plan.staff.supplyDiscount > 0 ? `${money(withPriya)} with Priya` : money(gross))
            );
          })
        ),
        h('p', { class: 'bulk-note' }, 'Orders arrive next morning 88% of the time; a late truck arrives one day later. Corner Market always fills today’s shortage.')
      ),
      // 3 · recipe
      h(
        'section',
        { class: 'plan-section recipe-section' },
        h(
          'div',
          { class: 'section-title' },
          h('span', { class: 'section-number' }, '3'),
          h('div', null, h('h2', null, 'Tune the recipe'), h('p', null, 'Per 10 cups \xB7 today wants about ', plan.idealIce, ' scoops of ice.')),
          h('span', { class: `quality-badge ${plan.quality >= 78 ? 'good' : 'warn'}` }, plan.quality, h('small', null, 'quality'))
        ),
        h(
          'div',
          { class: 'recipe-controls', role: 'group', 'aria-label': 'Recipe ingredients per ten cups' },
          recipeSlider('lemon', 'Lemons', '●', 'Lemons per batch', 2, 5, s.lemon, act.setLemon),
          recipeSlider('sugar', 'Sugar', '◆', 'Sugar scoops per batch', 3, 9, s.sugar, act.setSugar),
          recipeSlider('ice', 'Ice', '■', 'Ice scoops per batch', 0, 10, s.ice, act.setIce)
        )
      ),
      // 4 · experience
      h(
        'section',
        { class: 'plan-section' },
        h('div', { class: 'section-title' }, h('span', { class: 'section-number' }, '4'), h('div', null, h('h2', null, 'Make the experience'), h('p', null, 'Price, promotion and hospitality.'))),
        h(
          'div',
          { class: 'price-row' },
          h('div', null, h('label', null, 'Price per cup'), h('small', null, 'Local sweet spot: ', money(loc.wtp))),
          stepper({ label: 'price per cup', value: s.price, onChange: act.setPrice, min: 1, max: 5, step: 0.25, format: (v) => `$${v.toFixed(2)}` })
        ),
        h('div', { class: 'field-label' }, h('label', null, 'Get the word out')),
        h(
          'div',
          { class: 'choice-strip compact-strip', role: 'group', 'aria-label': 'Marketing plan' },
          Object.keys(S.MARKETING).map((k) =>
            h(
              'button',
              { key: k, type: 'button', 'aria-pressed': s.marketing === k, onclick: () => act.setMarketing(k), class: s.marketing === k ? 'selected' : '' },
              h('b', null, S.MARKETING[k].name),
              h('small', null, S.MARKETING[k].cost ? `${money(S.MARKETING[k].cost)} \xB7 +${Math.round((S.MARKETING[k].multiplier - 1) * 100)}%` : 'free')
            )
          )
        ),
        h('div', { class: 'field-label' }, h('label', null, 'Service style')),
        h(
          'div',
          { class: 'choice-strip compact-strip', role: 'group', 'aria-label': 'Service style' },
          Object.keys(S.SERVICE).map((k) =>
            h('button', { key: k, type: 'button', 'aria-pressed': s.service === k, onclick: () => act.setService(k), class: s.service === k ? 'selected' : '' }, h('b', null, S.SERVICE[k].name), h('small', null, S.SERVICE[k].note))
          )
        ),
        staffPlanner(s.scheduledStaff, s.staffRoster, plan.staff, act.setStaff)
      )
    ),
    h(
      'div',
      { class: 'planner-footer' },
      h(
        'div',
        { class: 'forecast-card' },
        h('div', null, h('span', null, 'Likely sales'), h('b', null, plan.low, '–', plan.high)),
        h('div', null, h('span', null, 'Gross'), h('b', null, money(plan.expected * s.price))),
        h('div', null, h('span', null, 'Spend'), h('b', null, '−', money(plan.expenses))),
        h('div', null, h('span', null, 'Est. net'), h('b', null, money(plan.expected * s.price - plan.expenses)))
      ),
      !plan.affordable && h('p', { class: 'budget-warning' }, '▲ Over budget by ', money(plan.expenses - s.cash)),
      s.phase === 'plan' && s.cash < d.minSpend && !s.emergencyUsed && h('button', { type: 'button', class: 'rescue-button', onclick: act.emergencyFund }, 'Use Sunshine Fund ', h('span', null, '+$15 \xB7 −3 reputation')),
      d.stranded && h('button', { type: 'button', class: 'rescue-button wrap-button', onclick: act.wrapWeek }, 'Close up for the week ', h('span', null, 'go to the finale')),
      h('button', { type: 'button', class: 'open-button', onclick: act.openStand, disabled: s.phase !== 'plan' || !plan.affordable }, h('span', null, 'OPEN THE STAND'), h('i', null, '→'))
    ),
  ];
}

function recipeSlider(kind, label, icon, aria, min, max, value, onChange) {
  return h(
    'div',
    null,
    h('label', null, h('i', { class: `ingredient ${kind}` }, icon), label),
    h('input', { 'aria-label': aria, type: 'range', min, max, step: 1, value, oninput: (e) => onChange(Number(e.target.value)) }),
    h('b', null, value)
  );
}

// ---------------------------------------------------------------- results and the finale

function insightsFor(o, weather) {
  const out = [];
  if (o.upgradesAtOpen.includes('festival') && (!weather.eventLocation || weather.eventLocation === o.location) && weather.eventMultiplier > 1)
    out.push({ tone: 'good', title: 'Bunting caught the event crowd', copy: 'Your booth specialty amplified today’s event traffic by 18%.' });
  if (o.location === 'market' && S.isMarketDay(o.day ?? 0)) out.push({ tone: 'good', title: 'Market day paid off', copy: 'Growers’ stalls drew extra browsers past your stand.' });
  if (o.pack.staffDiscount > 0) out.push({ tone: 'good', title: `${S.STAFF.priya.shortName} trimmed stock costs`, copy: `Her supplier relationships saved ${money(o.pack.staffDiscount)} on today’s stock orders.` });
  if (o.missedStock > 0) out.push({ tone: 'warn', title: 'Stock limited sales', copy: `${o.missedStock} interested neighbors arrived after the batch ran short.` });
  if (o.missedQueue > 0) out.push({ tone: 'warn', title: 'The line was the bottleneck', copy: `${o.missedQueue} potential orders exceeded service capacity.` });
  if (o.waste > Math.max(6, o.prepared * 0.3)) out.push({ tone: 'info', title: 'A smaller batch would save cash', copy: `${o.waste} cups were left at closing time.` });
  if (o.quality >= 90) out.push({ tone: 'good', title: 'The recipe landed', copy: `${o.quality} quality gave the stand a strong conversion and delight base.` });
  else if (o.quality < 75) out.push({ tone: 'warn', title: 'Recipe fit held demand back', copy: 'Use customer comments to tune lemon, sugar and ice for this pitch.' });
  if (o.price > S.LOCATIONS[o.location].wtp + 0.25) out.push({ tone: 'info', title: 'Premium pricing filtered the crowd', copy: 'Higher margin came with fewer willing buyers.' });
  if (o.pack.bulkInvoice > 0) out.push({ tone: 'info', title: 'Tomorrow is already stocked', copy: `${money(S.paidBulk(o.pack, o.staffShift))} of today’s spend became a Bulk Club order for a future day.` });
  if (out.length < 2) out.push({ tone: 'good', title: 'Hospitality built loyalty', copy: `${o.cx} delight moved reputation ${o.repNext >= o.reputationBefore ? 'upward' : 'toward recovery'}.` });
  return out;
}

function weekFinale({ state: s, app, d, act }) {
  const w = d.week;
  const diff = S.DIFFICULTY[s.difficulty];
  const best = app.records[s.difficulty];
  return h(
    'div',
    { class: 'week-finale' },
    h('span', null, w.medal.toUpperCase(), ' WEEK \xB7 BUSINESS VALUE'),
    h('b', null, money(w.value)),
    h(
      'p',
      null,
      w.medal === 'Gold'
        ? 'A golden week — your stand has become a town landmark.'
        : w.medal === 'Silver'
          ? 'A thriving neighborhood favorite, built one thoughtful cup at a time.'
          : w.medal === 'Bronze'
            ? 'A promising first week with a real business ready to grow.'
            : 'You found your footing. Every ledger entry is a clue for the next week.'
    ),
    app.newBest && h('span', { class: 'new-best' }, app.newBest === 'first' ? 'FIRST RECORD SET' : 'NEW BEST WEEK'),
    h(
      'div',
      { class: 'finale-breakdown' },
      h('span', null, s.history.reduce((a, x) => a + x.sales, 0), ' cups sold'),
      h('span', null, s.history.filter((x) => x.contractMet).length, ' / 7 contracts'),
      h('span', null, s.achievements.length, ' achievements')
    ),
    h('div', { class: 'value-formula' }, 'Cash ', money(s.cash), ' + 60% equipment + ', money(w.dryStock), ' dry-stock value \xB7 ', diff.name, ' goal ', money(diff.target)),
    best && h('div', { class: 'record-line' }, `Best ${diff.name} week: ${money(best.value)} \xB7 ${best.medal} \xB7 ${best.weeks} week${best.weeks === 1 ? '' : 's'} played`),
    h('button', { type: 'button', class: 'next-day-button', onclick: act.newWeek }, 'Start a new week', h('span', null, '→')),
    h('button', { type: 'button', class: 'next-day-button', onclick: act.saveAndTitle }, 'Return to title', h('span', null, '→'))
  );
}

export function resultView(ctx) {
  const { state: s, app, d, act } = ctx;
  const o = s.outcome;
  const blocked = !!app.specialty || !!app.modal;
  if (!o) {
    // The week closed early (the stand could not afford another day).
    return h(
      'div',
      { class: 'result-backdrop', key: 'finale-early', 'data-layer': 'results' },
      h(
        'section',
        { tabIndex: -1, class: 'result-modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'result-title', inert: blocked, 'aria-hidden': blocked ? 'true' : null },
        h(
          'div',
          { class: 'result-hero' },
          h('span', { class: 'result-kicker' }, 'WEEK COMPLETE'),
          h('h2', { id: 'result-title' }, 'The stand closed a little early.'),
          h('p', null, `After ${s.history.length} day${s.history.length === 1 ? '' : 's'}, the cash box ran too low for another batch.`),
          h('p', { class: 'early-note' }, 'Next week: smaller batches on quiet days, and save the vans and flyers for event crowds.')
        ),
        h('div', { class: 'result-body' }, weekFinale(ctx))
      )
    );
  }
  const insights = insightsFor({ ...o, day: s.day }, d.weather).slice(0, 3);
  const cashChange = o.net + o.contractReward;
  const roster = s.staffRoster;
  return h(
    'div',
    { class: 'result-backdrop', key: 'results', 'data-layer': 'results' },
    h(
      'section',
      { tabIndex: -1, class: 'result-modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'result-title', inert: blocked, 'aria-hidden': blocked ? 'true' : null },
      h(
        'div',
        { class: 'result-hero' },
        h('span', { class: 'result-kicker' }, s.phase === 'week-end' ? 'WEEK COMPLETE' : `DAY ${s.day} COMPLETE`),
        h('h2', { id: 'result-title' }, o.net >= 25 ? 'That hit the sweet spot!' : o.net >= 0 ? 'A sunny little profit.' : 'A tart lesson learned.'),
        h('p', null, o.sales, ' neighbors left with a cold cup from ', S.LOCATIONS[o.location].name, '.'),
        h('div', { class: 'result-score' }, h('span', null, cashChange >= 0 ? '+' : '−'), h('b', null, money(Math.abs(cashChange))), h('small', null, 'cash change'))
      ),
      h(
        'div',
        { class: 'result-body' },
        h(
          'div',
          { class: 'ledger' },
          h('div', null, h('span', null, 'Visitors'), h('b', null, o.visitors)),
          h('div', null, h('span', null, 'Interested'), h('b', null, o.buyers)),
          h('div', null, h('span', null, 'Cups sold'), h('b', null, o.sales)),
          h('div', null, h('span', null, 'Revenue'), h('b', { class: 'positive' }, money(o.revenue))),
          h('div', null, h('span', null, 'All expenses'), h('b', null, '−', money(o.expenses))),
          h('div', null, h('span', null, 'Waste'), h('b', null, o.waste, ' cups'))
        ),
        h(
          'div',
          { class: 'result-analysis' },
          h('div', null, h('span', null, 'FORECAST VS ACTUAL'), h('b', null, o.forecastLow, '–', o.forecastHigh, ' forecast \xB7 ', o.sales, ' sold')),
          h(
            'details',
            null,
            h('summary', null, 'Expense details'),
            h(
              'div',
              null,
              h('span', null, o.pack.staffDiscount > 0 ? 'Stock orders after saving' : 'Stock orders', ' ', h('b', null, money(o.expenseItems.supplies))),
              o.pack.staffDiscount > 0 && h('span', null, 'Included crew saving ', h('b', null, money(o.pack.staffDiscount))),
              h('span', null, 'Pitch ', h('b', null, money(o.expenseItems.pitch))),
              h('span', null, 'Transport ', h('b', null, money(o.expenseItems.transport))),
              h('span', null, 'Marketing ', h('b', null, money(o.expenseItems.marketing))),
              h('span', null, o.staffShift ? `${S.STAFF[o.staffShift.id].shortName}’s wage` : 'Team wage', ' ', h('b', null, money(o.expenseItems.staff))),
              h('span', null, 'Service choice ', h('b', null, money(o.expenseItems.service)))
            )
          )
        ),
        h(
          'div',
          { class: 'pantry-result' },
          h('span', null, h('i', null, '▣'), h('b', null, 'Pantry after packing'), h('small', null, S.SUPPLIES.map((k) => `${d.pantryNow[k]} ${k}`).join(' \xB7 '))),
          o.pack.queuedOrderId && h('em', null, 'Bulk order due day ', o.pack.expectedArrivalDay)
        ),
        o.staffShift
          ? h(
              'div',
              { class: `crew-result tone-${S.STAFF[o.staffShift.id].tone}` },
              h('span', { class: 'staff-avatar', 'aria-hidden': 'true' }, S.STAFF[o.staffShift.id].portrait),
              h('span', null, h('b', null, S.STAFF[o.staffShift.id].name, ' \xB7 ', S.STAFF[o.staffShift.id].role), h('small', null, S.STAFF[o.staffShift.id].resultBark)),
              h(
                'em',
                null,
                h('b', null, money(o.staffShift.wage), ' wage'),
                h('small', null, 'Opened ', S.fatigueLabel(o.staffShift.fatigueAtOpen), ' \xB7 now ', S.fatigueLabel(roster[o.staffShift.id].fatigue), ' \xB7 ', S.moraleLabel(roster[o.staffShift.id].morale), ' morale')
              )
            )
          : h(
              'div',
              { class: 'crew-result solo' },
              h('span', { class: 'staff-avatar solo', 'aria-hidden': 'true' }, '☀'),
              h('span', null, h('b', null, 'You ran the stand solo'), h('small', null, 'The whole Sunshine Crew got a chance to recover.')),
              h('em', null, h('b', null, '$0 wage'), h('small', null, 'Everyone rested'))
            ),
        o.contractMet && h('div', { class: 'contract-result' }, h('i', null, '★'), h('span', null, h('b', null, 'Daily contract complete'), h('small', null, 'Sunshine bonus')), h('em', null, '+', money(o.contractReward))),
        h(
          'div',
          { class: 'experience-summary' },
          h('div', null, h('span', null, 'Customer delight'), h('b', null, o.cx), miniMeter(o.cx, 'teal')),
          h(
            'div',
            null,
            h('span', null, 'Reputation'),
            h('b', null, o.repNext),
            h('small', null, o.repNext > o.reputationBefore ? `↗ up ${o.repNext - o.reputationBefore}` : o.repNext < o.reputationBefore ? `↘ down ${o.reputationBefore - o.repNext}` : '→ holding steady')
          )
        ),
        h(
          'div',
          { class: 'insight-strip', 'aria-label': 'What shaped the day' },
          insights.map((k) => h('div', { key: k.title, class: k.tone }, h('i', null, k.tone === 'good' ? '✓' : k.tone === 'warn' ? '!' : 'i'), h('span', null, h('b', null, k.title), h('small', null, k.copy))))
        ),
        h('div', { class: 'comments' }, h('span', null, 'What people said'), o.comments.map((c, i) => h('p', { key: c }, h('i', null, ['♥', '☀', '●'][i]), '“', c, '”'))),
        s.phase === 'results'
          ? [
              h('div', { class: 'upgrade-title' }, h('div', null, h('span', null, 'Booth workshop'), h('h3', null, 'Invest in tomorrow')), h('small', null, 'Your cash: ', money(s.cash))),
              h('div', { class: 'upgrade-grid' }, S.BASIC_UPGRADES.map((id) => upgradeCard(ctx, id))),
              h(
                'div',
                { class: 'specialty-title' },
                h('div', null, h('span', null, 'Booth specialties'), h('h3', null, 'Choose one permanent path')),
                h('small', null, d.specialty ? `${S.UPGRADES[d.specialty].name} chosen` : 'Available after day 3 \xB7 prerequisite required')
              ),
              h('div', { class: 'upgrade-grid specialty-grid' }, S.SPECIALTIES.map((id) => upgradeCard(ctx, id))),
              h('button', { type: 'button', class: 'next-day-button', onclick: act.nextDay }, 'Plan day ', s.day + 1, h('span', null, '→')),
            ]
          : weekFinale(ctx)
      )
    )
  );
}

function upgradeCard({ state: s, d, act }, id) {
  const u = S.UPGRADES[id];
  const check = S.upgradeCheck(s.day, s.difficulty, s.cash, s.upgrades, id);
  const owned = check.block === 'owned';
  const special = S.SPECIALTIES.includes(id);
  const label = owned
    ? special
      ? 'Your specialty'
      : 'Owned'
    : check.block === 'unlocks-later'
      ? 'After day 3'
      : check.block === 'requires' && u.requires
        ? `Needs ${S.UPGRADES[u.requires].name}`
        : check.block === 'specialty-chosen'
          ? 'Other path chosen'
          : check.block === 'reserve'
            ? 'Need reserve'
            : money(u.cost);
  return h(
    'button',
    {
      key: id,
      type: 'button',
      onclick: () => act.buyUpgrade(id),
      disabled: !check.allowed,
      class: `${owned ? 'owned' : ''} ${special ? 'specialty-card' : ''}`,
      title: check.block === 'reserve' ? `Keep at least ${money(d.minSpend)} for tomorrow’s stand` : null,
    },
    h('i', { 'aria-hidden': 'true' }, u.icon),
    h('span', null, h('b', null, u.name), h('small', null, u.note)),
    h('em', null, label)
  );
}

// ---------------------------------------------------------------- dialogs

const TUTORIAL = [
  { icon: '☀', title: 'Read the town', copy: 'Start with the forecast and today’s event. A hot beach and a rainy park can be completely different businesses.' },
  { icon: '▣', title: 'Pack with a purpose', copy: 'Prepared cups use your home pantry first, then Corner Market fills today’s shortage. Order Bulk Club cases ahead when a busy day is coming.' },
  { icon: '●', title: 'Mix for the crowd', copy: 'Each pitch likes a different lemon-to-sugar balance. Weather changes how much ice people want. On market days, Old Mill Market fills with browsers and its growers sell lemons cheap.' },
  { icon: '$', title: 'Price the whole experience', copy: 'Marketing brings visitors. Schedule one Sunshine Crew teammate for a role bonus, or let everyone rest while you work solo.' },
  { icon: '→', title: 'Learn, improve, repeat', copy: 'Open the stand, make one service-time decision, study the ledger and comments, then invest in upgrades for tomorrow.' },
];

function utilityHead(kicker, title, id, onClose, closeLabel) {
  return h('div', { class: 'utility-head' }, h('div', null, h('span', null, kicker), h('h2', { id }, title)), h('button', { type: 'button', onclick: onClose, 'aria-label': closeLabel }, '\xD7'));
}

const switchButton = (label, on, onClick) => h('button', { 'aria-label': label, class: `switch ${on ? 'on' : ''}`, type: 'button', onclick: onClick, 'aria-pressed': on }, h('i'));

function settingsModal({ app, act }) {
  const s = app.settings;
  const row = (title, note, control, extra = '') => h('div', { class: `setting-row ${extra}` }, h('span', null, h('b', null, title), h('small', null, note)), control);
  return h(
    'div',
    { class: 'utility-backdrop', key: 'modal-settings', 'data-layer': 'modal' },
    h(
      'section',
      { tabIndex: -1, class: 'utility-modal settings-modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'settings-title' },
      utilityHead('Preferences', 'Settings', 'settings-title', act.closeModal, 'Close settings'),
      h(
        'div',
        { class: 'settings-list' },
        row('Sound effects', 'Pouring, sales, goals and upgrades', switchButton('Sound effects', s.sound, () => act.setSetting('sound', !s.sound))),
        h(
          'div',
          { class: 'setting-row volume-row' },
          h('span', null, h('b', null, 'Sound volume'), h('small', null, Math.round(s.volume * 100), '%')),
          h('input', { 'aria-label': 'Sound volume', type: 'range', min: 0, max: 1, step: 0.05, value: s.volume, disabled: !s.sound, oninput: (e) => act.setSetting('volume', Number(e.target.value)) })
        ),
        row('Reduce motion', 'Stops decorative animation and camera drift', switchButton('Reduce motion', s.reducedMotion, () => act.setSetting('reducedMotion', !s.reducedMotion))),
        row('High contrast', 'Stronger borders and status distinction', switchButton('High contrast', s.highContrast, () => act.setSetting('highContrast', !s.highContrast))),
        row('Larger interface text', 'Increases game UI text sizing', switchButton('Larger interface text', s.largeText, () => act.setSetting('largeText', !s.largeText))),
        row(
          'Graphics & controls',
          `Quality, resolution, touch layout and more \xB7 ${app.backendLabel}`,
          h('div', { class: 'small-segment' }, h('button', { type: 'button', onclick: act.openKitMenu }, 'Open'))
        )
      ),
      h('button', { class: 'utility-done', type: 'button', onclick: act.closeModal }, 'Done')
    )
  );
}

function tutorialModal({ app, act }) {
  const i = app.tutorialStep;
  const step = TUTORIAL[i];
  const last = i === TUTORIAL.length - 1;
  return h(
    'div',
    { class: 'utility-backdrop tutorial-backdrop', key: 'modal-tutorial', 'data-layer': 'modal' },
    h(
      'section',
      { tabIndex: -1, class: 'tutorial-modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'tutorial-title' },
      h('div', { class: 'tutorial-visual' }, h('span', null, step.icon), h('i', { class: `tutorial-art art-${i}` })),
      h(
        'div',
        { class: 'tutorial-copy' },
        h('span', { class: 'tutorial-count' }, 'HOW TO PLAY \xB7 ', i + 1, ' OF ', TUTORIAL.length),
        h('h2', { id: 'tutorial-title' }, step.title),
        h('p', null, step.copy),
        h('div', { class: 'tutorial-dots' }, TUTORIAL.map((_, k) => h('i', { key: `d${k}`, class: k === i ? 'active' : '' }))),
        h(
          'div',
          { class: 'tutorial-actions' },
          h('button', { type: 'button', onclick: act.finishTutorial }, 'Skip'),
          i > 0 && h('button', { type: 'button', onclick: () => act.stepTutorial(-1) }, 'Back'),
          h('button', { class: 'primary', type: 'button', onclick: () => (last ? act.finishTutorial() : act.stepTutorial(1)) }, last ? 'Let’s play' : 'Next')
        )
      )
    )
  );
}

function pauseModal({ act }) {
  return h(
    'div',
    { class: 'utility-backdrop', key: 'modal-pause', 'data-layer': 'modal', 'data-focus': 'first' },
    h(
      'section',
      { tabIndex: -1, class: 'utility-modal pause-modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'pause-title' },
      h('span', { class: 'pause-lemon' }, '●'),
      h('span', null, 'TAKE A BREATHER'),
      h('h2', { id: 'pause-title' }, 'Paused'),
      h('button', { class: 'utility-done', type: 'button', onclick: act.resume }, 'Resume game'),
      h(
        'div',
        { class: 'pause-grid four' },
        h('button', { type: 'button', onclick: () => act.openModal('journal') }, 'Journal'),
        h('button', { type: 'button', onclick: () => act.openModal('settings') }, 'Settings'),
        h('button', { type: 'button', onclick: () => act.openModal('controls') }, 'Controls'),
        h('button', { type: 'button', onclick: () => act.openModal('tutorial') }, 'How to play')
      ),
      h('button', { class: 'quiet-button', type: 'button', onclick: act.saveAndTitle }, 'Save & return to title')
    )
  );
}

function journalModal({ state: s, d, act }) {
  const revenue = s.history.reduce((a, x) => a + x.revenue, 0);
  const cups = s.history.reduce((a, x) => a + x.sales, 0);
  const pantry = d.pantryNow;
  return h(
    'div',
    { class: 'utility-backdrop', key: 'modal-journal', 'data-layer': 'modal' },
    h(
      'section',
      { tabIndex: -1, class: 'utility-modal journal-modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'journal-title' },
      utilityHead('Business book', 'Stand Journal', 'journal-title', act.closeModal, 'Close journal'),
      h(
        'div',
        { class: 'journal-summary' },
        h('div', null, h('span', null, 'Current day'), h('b', null, s.day, ' / 7')),
        h('div', null, h('span', null, 'Total cups'), h('b', null, cups)),
        h('div', null, h('span', null, 'Revenue'), h('b', null, money(revenue))),
        h('div', null, h('span', null, 'Reputation'), h('b', null, s.reputation)),
        h('div', null, h('span', null, 'Cash'), h('b', null, money(s.cash)))
      ),
      h(
        'div',
        { class: 'journal-section' },
        h('h3', null, 'Home pantry ', h('small', null, s.pantry.incoming.length ? `${s.pantry.incoming.length} order incoming` : 'ready for today')),
        h(
          'div',
          { class: 'pantry-journal' },
          S.SUPPLIES.map((k) =>
            h('div', { key: k, 'aria-label': `${S.SUPPLY[k].name}: ${pantry[k]} ${S.SUPPLY[k].unit}` }, h('i', { 'aria-hidden': 'true' }, S.SUPPLY[k].icon), h('span', null, h('b', null, pantry[k]), h('small', null, S.SUPPLY[k].name, ' \xB7 ', S.SUPPLY[k].unit)))
          )
        ),
        s.pantry.incoming.map((o) =>
          h('p', { key: `in${o.orderId}`, class: 'incoming-journal' }, h('span', { 'aria-hidden': 'true' }, '▰ '), S.BULK[o.preset].name, ' \xB7 expected day ', o.arrivalDay, ' \xB7 paid ', money(d.receiptPaid(o.orderId, o.invoice)))
        )
      ),
      h(
        'div',
        { class: 'journal-section' },
        h('h3', null, 'Sunshine Crew ', h('small', null, S.STAFF_IDS.filter((id) => s.staffRoster[id].unlocked).length, ' / ', S.STAFF_IDS.length, ' joined')),
        h(
          'div',
          { class: 'journal-team' },
          S.STAFF_IDS.map((id) => {
            const r = s.staffRoster[id];
            const info = S.STAFF[id];
            return h(
              'div',
              { key: id, class: `${r.unlocked ? 'unlocked' : 'locked'} tone-${info.tone}` },
              h('i', { 'aria-hidden': 'true' }, r.unlocked ? info.portrait : '?'),
              h('span', null, h('b', null, r.unlocked ? info.name : info.shortName), h('small', null, r.unlocked ? `${info.role} \xB7 ${S.fatigueLabel(r.fatigue)} \xB7 ${S.moraleLabel(r.morale)}` : info.unlock)),
              h('em', null, r.shifts, ' shift', r.shifts === 1 ? '' : 's')
            );
          })
        )
      ),
      h(
        'div',
        { class: 'journal-section' },
        h('h3', null, 'Daily ledger'),
        s.history.length
          ? h(
              'table',
              { class: 'history-table' },
              h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Day'), h('th', { scope: 'col' }, 'Pitch \xB7 crew'), h('th', { scope: 'col' }, 'Sales'), h('th', { scope: 'col' }, 'Net'), h('th', { scope: 'col' }, 'Delight'))),
              h(
                'tbody',
                null,
                s.history.map((x) =>
                  h(
                    'tr',
                    { key: `h${x.day}` },
                    h('th', { scope: 'row' }, x.day),
                    h('td', null, S.LOCATIONS[x.location].name, h('small', null, x.staffId ? `with ${S.STAFF[x.staffId].shortName}` : 'solo')),
                    h('td', null, x.sales),
                    h('td', { class: x.net >= 0 ? 'positive' : 'negative' }, x.net >= 0 ? '+' : '', money(x.net)),
                    h('td', null, x.cx)
                  )
                )
              )
            )
          : h('p', { class: 'empty-journal' }, 'Your first day will appear here after closing time.')
      ),
      pitchNotebook(d.notes),
      h(
        'div',
        { class: 'journal-section' },
        h('h3', null, 'Achievements ', h('small', null, s.achievements.length, ' / ', S.ACHIEVEMENT_IDS.length)),
        h(
          'div',
          { class: 'achievement-grid' },
          S.ACHIEVEMENT_IDS.map((id) => {
            const have = s.achievements.includes(id);
            const a = S.ACHIEVEMENTS[id];
            return h('div', { key: id, class: have ? 'unlocked' : 'locked' }, h('i', null, have ? a.icon : '?'), h('span', null, h('b', null, a.name), h('small', null, a.note)));
          })
        )
      ),
      h('button', { class: 'utility-done', type: 'button', onclick: act.closeModal }, 'Back to game')
    )
  );
}

/** Each pitch's week so far, and the best-tasting recipe the player served there. */
function pitchNotebook(notes) {
  const tried = S.LOCATION_IDS.filter((id) => notes[id].days > 0).length;
  return h(
    'div',
    { class: 'journal-section' },
    h('h3', null, 'Pitch notebook ', h('small', null, tried, ' / ', S.LOCATION_IDS.length, ' pitches tried')),
    h(
      'div',
      { class: 'journal-team pitch-notes' },
      S.LOCATION_IDS.map((id) => {
        const n = notes[id];
        const loc = S.LOCATIONS[id];
        const b = n.best;
        const detail = b
          ? `Best mix ${b.lemon} lemon \xB7 ${b.sugar} sugar \xB7 ${b.ice} ice \xB7 ${money(b.price)} → ${b.quality} quality`
          : n.days
            ? 'Worked here this week'
            : `${loc.kicker} \xB7 ${money(loc.fee)} pitch \xB7 not tried yet`;
        return h(
          'div',
          { key: id, class: `${n.days ? 'unlocked' : 'locked'} pitch-${id}` },
          h('i', { 'aria-hidden': 'true' }, loc.icon),
          h('span', null, h('b', null, loc.name), h('small', null, detail)),
          h('em', null, n.days ? `${n.days} day${n.days === 1 ? '' : 's'} \xB7 ${n.cups} cups` : '—', n.days ? h('small', null, 'best ', n.bestNet >= 0 ? '+' : '', money(n.bestNet)) : null)
        );
      })
    )
  );
}

function creditsModal({ act }) {
  return h(
    'div',
    { class: 'utility-backdrop', key: 'modal-credits', 'data-layer': 'modal' },
    h(
      'section',
      { tabIndex: -1, class: 'utility-modal credits-modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'credits-title' },
      utilityHead('Made with care', 'Credits', 'credits-title', act.closeModal, 'Close credits'),
      h('div', { class: 'credits-lemon', 'aria-hidden': 'true' }, '●'),
      h('p', null, h('b', null, 'Lemonade Day'), ' is an original browser business game about finding your place in a colorful little town.'),
      h(
        'dl',
        null,
        h('div', null, h('dt', null, 'Design & direction'), h('dd', null, 'Michael Crosato with OpenAI Codex')),
        h('div', null, h('dt', null, 'Technology'), h('dd', null, 'Three.js r186 with WebGPU (WebGL2 fallback) on the ai-hub 3D kit')),
        h('div', null, h('dt', null, 'Privacy'), h('dd', null, 'No account or tracking. Campaign saves stay in this browser.'))
      ),
      h('p', { class: 'credits-note' }, 'All art, interface shapes, writing and synthesized sound cues are original to this release.'),
      h('button', { class: 'utility-done', type: 'button', onclick: act.closeModal }, 'Back')
    )
  );
}

function controlsModal({ app, act }) {
  const tab = app.controlsTab || (app.source === 'gamepad' ? 'gamepad' : app.source === 'touch' ? 'touch' : 'keyboard');
  const info = CONTROLS[tab];
  return h(
    'div',
    { class: 'utility-backdrop', key: 'modal-controls', 'data-layer': 'modal' },
    h(
      'section',
      { tabIndex: -1, class: 'utility-modal controls-modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'controls-title' },
      utilityHead('How to drive the stand', 'Controls', 'controls-title', act.closeModal, 'Close controls'),
      h(
        'div',
        { class: 'small-segment controls-tabs', role: 'group', 'aria-label': 'Input device' },
        Object.keys(CONTROLS).map((k) => h('button', { key: k, type: 'button', 'aria-pressed': tab === k, class: tab === k ? 'selected' : '', onclick: () => act.setControlsTab(k) }, CONTROLS[k].label))
      ),
      h(
        'div',
        { class: 'controls-list' },
        info.rows.map(([keys, what], i) => h('div', { key: `${tab}${i}` }, h('b', null, keys.map((k) => h('kbd', null, k))), h('span', null, what)))
      ),
      h('p', { class: 'controls-note' }, 'The game follows whichever device you touched last. Everything is a button, so any device can run the whole week.'),
      h('button', { class: 'utility-done', type: 'button', onclick: act.closeModal }, 'Done')
    )
  );
}

function newGameModal({ act }) {
  return h(
    'div',
    { class: 'utility-backdrop new-game-backdrop', key: 'modal-newgame', 'data-layer': 'modal' },
    h(
      'section',
      { tabIndex: -1, class: 'utility-modal new-game-dialog', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'new-game-title', 'aria-describedby': 'new-game-copy' },
      h('span', { class: 'new-game-mark', 'aria-hidden': 'true' }, '↻'),
      h('span', null, 'REPLACE SAVED WEEK?'),
      h('h2', { id: 'new-game-title' }, 'Start a fresh story'),
      h('p', { id: 'new-game-copy' }, 'Starting over replaces the current seven-day campaign on this device. Settings and tutorial preferences stay intact.'),
      h('div', null, h('button', { type: 'button', onclick: act.closeModal }, 'Keep my week'), h('button', { type: 'button', class: 'confirm-new-game', onclick: act.startNew }, 'Start over'))
    )
  );
}

function rushModal({ state: s, act }) {
  const o = s.outcome;
  const staff = o?.staffShift?.id ?? null;
  const cost = Math.max(0, (staff === 'mia' ? 3 : 4) - (o?.upgradesAtOpen.includes('rail') ? 2 : 0));
  return h(
    'div',
    { class: 'rush-backdrop', key: 'rush', 'data-layer': 'rush', 'data-focus': 'first' },
    h(
      'div',
      { tabIndex: -1, class: 'rush-decision', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'rush-title' },
      h('div', null, h('span', null, 'NOON RUSH'), h('h3', { id: 'rush-title' }, 'The line is growing!'), h('p', null, 'Choose how the stand handles its busiest hour.')),
      h(
        'div',
        { class: 'rush-options' },
        h('button', { type: 'button', onclick: () => act.chooseRush('hustle') }, h('i', null, '\xBB'), h('span', null, h('b', null, 'Hustle'), h('small', null, 'Up to +', staff === 'mia' ? 5 : 3, ' sales \xB7 −', cost, ' delight'))),
        h('button', { type: 'button', onclick: () => act.chooseRush('samples') }, h('i', null, '◒'), h('span', null, h('b', null, 'Pass samples'), h('small', null, 'More interest \xB7 +3 delight \xB7 $1.50'))),
        h('button', { type: 'button', onclick: () => act.chooseRush('steady') }, h('i', null, '♥'), h('span', null, h('b', null, 'Keep the rhythm'), h('small', null, 'No extra sales \xB7 +', staff === 'june' ? 4 : 2, ' delight')))
      )
    )
  );
}

function specialtyModal({ app, act }) {
  const u = S.UPGRADES[app.specialty];
  return h(
    'div',
    { class: 'specialty-backdrop', key: `specialty-${app.specialty}`, 'data-layer': 'modal' },
    h(
      'section',
      { tabIndex: -1, class: 'specialty-confirm', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'specialty-title', 'aria-describedby': 'specialty-copy' },
      h('span', { class: 'specialty-mark', 'aria-hidden': 'true' }, u.icon),
      h('span', null, 'PERMANENT BOOTH SPECIALTY'),
      h('h2', { id: 'specialty-title' }, 'Choose ', u.name, '?'),
      h('p', { id: 'specialty-copy' }, u.note, '. This defines your booth for the rest of the week and closes the other specialty paths.'),
      h('div', null, h('button', { type: 'button', onclick: act.cancelSpecialty }, 'Not yet'), h('button', { type: 'button', class: 'confirm-specialty', onclick: act.confirmSpecialty }, 'Choose specialty \xB7 ', money(u.cost)))
    )
  );
}

/** Everything that floats above the screen, in stacking order (last is on top). */
export function overlayView(ctx) {
  const { state: s, app, d } = ctx;
  const out = [];
  if (app.screen === 'game' && d.showResults) out.push(resultView(ctx));
  if (app.screen === 'game' && d.rushOpen && !app.modal) out.push(rushModal(ctx));
  const m = app.modal;
  if (m === 'settings') out.push(settingsModal(ctx));
  else if (m === 'tutorial') out.push(tutorialModal(ctx));
  else if (m === 'credits') out.push(creditsModal(ctx));
  else if (m === 'controls') out.push(controlsModal(ctx));
  else if (m === 'newgame') out.push(newGameModal(ctx));
  else if (m === 'pause' && app.screen === 'game') out.push(pauseModal(ctx));
  else if (m === 'journal' && app.screen === 'game') out.push(journalModal(ctx));
  if (app.specialty && s.phase === 'results') out.push(specialtyModal(ctx));
  return out;
}
