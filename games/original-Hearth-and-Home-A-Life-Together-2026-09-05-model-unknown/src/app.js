/**
 * Hearth & Home — the game screen: the day, the plan, the drawers and every
 * dialog. The 3D home itself lives in scene.js and is fed from here.
 */
import { h, Fragment, useState, useEffect, useRef, useMemo } from './react.js';
import Icon from './icons.js';
import { Logo, Meter, Modal, Portrait, Tag, duration, money, closeTopModal } from './ui.js';
import { CATEGORIES, ACTIONS, UPGRADES, ROUTINES, CHAPTERS, SEASONS } from './data.js';
import { createState, validateSave, nextEvent, chapter, year, season, eraIndex, dayIndex, goalStatus, liveChildren, quoteAction, performAction, applyChoice, endDay, advanceDay, beginEpilogue, actionLabel, homeSize, owns, age, budget, buyUpgrade, sellUpgrade, upgradeReason, toggleRoutine, transfer, lifeReflection, available } from './engine.js';
import { playCue, setMusic, setAudioPaused, unlockAudio } from './audio.js';
import { createMenuNav, modifierHeld } from './controls.js';
const KEY = 'hearth-home-story-v3', PREFS = 'hearth-home-preferences-v3', BACKUP = 'hearth-home-backup-v3', UNREADABLE = 'hearth-home-unreadable-v3', LIVES = 'hearth-home-lives-v1';
/** Finished stories, kept on a shelf in the album (newest first, at most 24). */
function loadLives() { try {
    const list = JSON.parse(localStorage.getItem(LIVES) || '[]');
    return Array.isArray(list) ? list.filter(l => l && typeof l.title === 'string' && typeof l.names === 'string').slice(0, 24) : [];
}
catch {
    return [];
} }
/** Put a finished story on the shelf; the epilogue's ending replaces the same story's anniversary entry. */
function shelveLife(s, lives) { const id = s.storyId || [s.profile.name, s.profile.partner, s.profile.surname, s.decisions.slice(0, 8).map(d => d.choice).join('/')].join('|'); if (lives.some(l => l.id === id && l.ending === s.ending))
    return lives; const r = lifeReflection(s); const next = [{ id, title: r.title, names: `${s.profile.name} & ${s.profile.partner} ${s.profile.surname}`, ending: s.ending, years: s.ending === 'legacy' ? '1952–2012' : '1952–2002', memories: r.memories, traditions: r.traditions, children: s.children.length, when: Date.now() }, ...lives.filter(l => l.id !== id)].slice(0, 24); try {
    localStorage.setItem(LIVES, JSON.stringify(next));
}
catch { } return next; }
const defaultPrefs = { sound: false, chimes: true, reduced: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false, instant: false };
const firstVisit = (() => { try {
    return !localStorage.getItem(KEY);
}
catch {
    return false;
} })();
function loadState() { let str = null; try {
    str = localStorage.getItem(KEY);
    if (str)
        return validateSave(JSON.parse(str));
}
catch {
    // Keep the unreadable save aside before the new story's autosave replaces it.
    try {
        if (str)
            localStorage.setItem(UNREADABLE, str);
    }
    catch { }
    window.__saveWarning = 'A previous save could not be read. A copy was kept on this device; a new story has begun.';
} return createState(); }
function loadPrefs() { try {
    const saved = JSON.parse(localStorage.getItem(PREFS) || '{}');
    delete saved.view; // the old compatibility renderer is gone
    return { ...defaultPrefs, ...saved };
}
catch {
    return defaultPrefs;
} }
const TARGET_CAT = { stove: 'kitchen', table: 'kitchen', sofa: 'house', bed: 'family', chair: 'self', desk: 'work', shelf: 'work', record: 'family', phone: 'community', laundry: 'house', garden: 'self', mailbox: 'community' };
const FOCUS = [['cook', 'tidy', 'talk'], ['care', 'laundry', 'rebalance'], ['laundry', 'visit', 'budget'], ['hobby', 'talk', 'rebalance'], ['care', 'repair', 'read'], ['date', 'declutter', 'budget'], ['rest', 'call', 'outing'], ['memory', 'host', 'date'], ['care', 'call', 'memory']];
function useToast() { const [toast, set] = useState(null); const timer = useRef(); function show(text, bad = false) { clearTimeout(timer.current); set({ text, bad, id: Date.now() }); timer.current = setTimeout(() => set(null), 4200); } useEffect(() => () => clearTimeout(timer.current), []); return [toast, show]; }
function DayStory({ s, choose, onClose }) { const ev = nextEvent(s); if (!ev)
    return null; return h(Modal, { title: ev.title, eyebrow: ev.eyebrow, onClose: onClose, className: "story-modal" },
    h("div", { className: "story-illustration" },
        h("div", { className: "stamp" },
            h(Icon, { name: ev.bereavement ? 'flower' : chapter(s).icon, size: 50 })),
        h("div", { className: "postmark" },
            "WILLOW LANE",
            h("span", null, year(s))),
        h("svg", { viewBox: "0 0 180 60", "aria-hidden": "true" },
            h("path", { d: "M0 15q30-15 60 0t60 0t60 0M0 30q30-15 60 0t60 0t60 0M0 45q30-15 60 0t60 0t60 0", fill: "none", stroke: "currentColor", strokeWidth: "1" }))),
    h("p", { className: "story-copy" }, ev.body),
    h("div", { className: "choice-list" }, ev.choices.map((c, i) => h("button", { key: i, className: "choice", onClick: () => choose(i), disabled: (c.cost || 0) > s.cash },
        h("span", { className: "choice-number" },
            "0",
            i + 1),
        h("span", null,
            h("strong", null, c.label),
            h("small", null, c.detail),
            (c.cost || 0) > s.cash && h("small", { className: "warning" }, "Not enough household cash for this option.")),
        h(Icon, { name: "arrow", size: 19 })))),
    h("p", { className: "footnote" }, "A life choice, not a test. Your answer belongs in your family\u2019s story.")); }
function Summary({ s, onNext, onClose }) { const b = s.lastSummary || budget(s); return h(Modal, { title: "Some things done. Some things can wait.", eyebrow: `${season(s)} ${year(s)} · A DAY WELL LIVED`, onClose: onClose, className: "summary-modal" },
    h("div", { className: "summary-sun" },
        h(Icon, { name: "moon", size: 40 })),
    h("p", { className: "story-copy" }, b.reflection || 'The house settles for the evening.'),
    h("div", { className: "summary-stats" },
        h("div", null,
            h("span", null, "Time you chose"),
            h("strong", null, duration(b.minutesUsed || 0))),
        h("div", null,
            h("span", null, "Income less bills"),
            h("strong", { className: b.net < 0 ? 'warning' : 'positive' },
                b.net >= 0 ? '+' : '',
                money(b.net))),
        h("div", null,
            h("span", null, "Evening rest"),
            h("strong", null,
                "+",
                b.rest || 0,
                h(Icon, { name: "bolt", size: 18 })))),
    b.aid > 0 && h("div", { className: "note" },
        h(Icon, { name: "hands" }),
        h("p", null,
            "A community advance of ",
            money(b.aid),
            " covered the essentials. It is added to your balance to repay at $15 per day.")),
    h("div", { className: "end-needs" },
        h(Meter, { label: "Companionship", icon: "heart", value: s.stats.bond, tone: "pink" }),
        h(Meter, { label: "A little joy of your own", icon: "sun", value: s.stats.joy, tone: "gold" })),
    h("div", { className: "next-chapter-note" }, s.turn === 31 ? h(Fragment, null,
        h(Icon, { name: "star" }),
        "Your golden-anniversary keepsake is ready.") : s.turn === 34 ? h(Fragment, null,
        h(Icon, { name: "flower" }),
        "Turn to the last page of your story.") : dayIndex(s) === 3 ? h(Fragment, null,
        h(Icon, { name: "book" }),
        "Next: ",
        CHAPTERS[Math.min(8, eraIndex(s) + 1)].name,
        ". The years move on.") : h(Fragment, null,
        h(Icon, { name: "sun" }),
        "Next: another representative day. Routines, upkeep, and the years between are applied at dawn.")),
    h("button", { className: "button primary full", onClick: onNext },
        s.turn === 31 || s.turn === 34 ? 'Look back on your life' : 'Turn the page',
        h(Icon, { name: "arrow" })),
    h("p", { className: "footnote" }, "Each playable day is a snapshot. Ordinary life continues between the pages.")); }
function Finale({ s, onEpilogue, onClose, onAlbum, onNewStory }) { const r = lifeReflection(s); const legacy = s.ending === 'legacy'; return h(Modal, { title: r.title, eyebrow: legacy ? '1952–2012 · THE LOVE THAT STAYS' : '1952–2002 · FIFTY YEARS, TOGETHER', onClose: onClose, className: "finale-modal" },
    h("div", { className: "anniversary-mark" },
        h(Icon, { name: legacy ? 'flower' : 'heart', size: 44 }),
        h("b", null, legacy ? '60' : '50'),
        h("span", null, "YEARS OF A LIFE")),
    h("p", { className: "story-copy" }, legacy ? 'The house will never mean exactly the same thing again. But the care given here has gone out into the world. It lives in people, in recipes, in the ways someone else now puts the kettle on.' : 'The dishes were not always done. The money did not always stretch. There were people to care for, and a person inside you worth caring for, too. A home was the work. A life was what you made.'),
    h("div", { className: "legacy-numbers four" },
        h("div", null,
            h("b", null, r.memories),
            h("span", null, "memories kept")),
        h("div", null,
            h("b", null, r.shared),
            h("span", null, "tasks shared")),
        h("div", null,
            h("b", null, r.rest),
            h("span", null, "moments of rest")),
        h("div", null,
            h("b", null, r.traditions),
            h("span", null, "traditions kept"))),
    h("div", { className: "end-needs" },
        h(Meter, { icon: "heart", label: "Companionship, through the years", value: r.values.companionship, tone: "pink" }),
        h(Meter, { icon: "sun", label: "Room for your own life", value: r.values.personalJoy, tone: "gold" }),
        h(Meter, { icon: "people", label: "A circle beyond the house", value: r.values.community })),
    h("p", { className: "footnote" }, "These are the average rhythms of the first eight chapters, not grades. Grief is never scored."),
    h("button", { className: "button primary full", onClick: onAlbum },
        "Open the family album",
        h(Icon, { name: "camera" })),
    !legacy && h("div", { className: "epilogue-option" },
        h("h3", null, "One more chapter, only when you are ready."),
        h("p", null, "An optional three-day epilogue follows later-life care, a peaceful off-screen death, and accepting support after loss. This anniversary can also be your ending."),
        h("button", { className: "button secondary", onClick: onEpilogue },
            "Continue to the optional epilogue",
            h(Icon, { name: "arrow", size: 16 }))),
    h("div", { className: "new-story-option" },
        h("span", null, legacy ? 'This story is complete. It stays on the shelf in your album.' : 'Or close the book here. This story stays on the shelf in your album.'),
        h("button", { className: "text-button", onClick: onNewStory },
            "Begin a new story",
            h(Icon, { name: "key", size: 14 })))); }
export default function App({ kit, stage, host }) {
    const [s, setS] = useState(loadState), [prefs, setPrefs] = useState(loadPrefs), [modal, setModal] = useState(firstVisit ? 'help' : null), [drawer, setDrawer] = useState(null), [homeTab, setHomeTab] = useState('improve'), [albumTab, setAlbumTab] = useState('memories'), [queue, setQueue] = useState([]), [playing, setPlaying] = useState(true), [active, setActive] = useState(null), [walls, setWalls] = useState(true), [hover, setHover] = useState(null), [saved, setSaved] = useState(true), [imported, setImported] = useState(null), [sellConfirm, setSellConfirm] = useState(null), [newNames, setNewNames] = useState({ name: 'June', partner: 'Sam', surname: 'Parker', skin: '#d5a078', mode: 'balanced' }), [source, setSource] = useState(kit.input.source), [kitPaused, setKitPaused] = useState(false), [lives, setLives] = useState(loadLives), [toast, showToast] = useToast();
    const stateRef = useRef(s), prefsRef = useRef(prefs), fileRef = useRef(), drawerRef = useRef(), sceneRef = useRef(), live = useRef({});
    stateRef.current = s;
    prefsRef.current = prefs;
    const e = eraIndex(s), ch = chapter(s), ev = nextEvent(s), focus = FOCUS[e], goals = goalStatus(s), members = liveChildren(s), clockMinutes = 480 + (480 - s.minutes), clock = `${Math.floor(clockMinutes / 60) > 12 ? Math.floor(clockMinutes / 60) - 12 : Math.floor(clockMinutes / 60)}:${String(clockMinutes % 60).padStart(2, '0')}`, am = clockMinutes >= 720 ? 'pm' : 'am';
    const tradition = ACTIONS.find(a => a.season === season(s)), traditionWaiting = !!tradition && !s.dayCounts[tradition.id] && !s.ended && !s.finished;
    useEffect(() => { if (window.__saveWarning) {
        showToast(window.__saveWarning, true);
        window.__saveWarning = null;
    } try {
        localStorage.setItem(KEY, JSON.stringify(s));
        setSaved(true);
    }
    catch {
        setSaved(false);
    } }, [s]);
    useEffect(() => { try {
        localStorage.setItem(PREFS, JSON.stringify(prefs));
    }
    catch { } }, [prefs]);
    useEffect(() => { setMusic(prefs.sound); }, [prefs.sound]);
    useEffect(() => { if (s.finished && s.ending)
        setLives(l => shelveLife(s, l)); }, [s.finished, s.ending]);
    useEffect(() => () => setMusic(false), []);
    // The plan runs one activity at a time, and waits while a dialog or the kit's settings panel is open.
    useEffect(() => { if (!queue.length || !playing || modal || kitPaused || s.ended || s.finished) {
        setActive(null);
        return;
    } const entry = queue[0], a = ACTIONS.find(a => a.id === entry.id); setActive({ ...entry, target: a.target, name: actionLabel(stateRef.current, a), start: Date.now() }); const t = setTimeout(() => { const before = stateRef.current, r = performAction(before, entry.id, entry.delegate); if (r.error) {
        showToast(r.error, true);
        playCue(prefsRef.current.chimes, 'bad');
    }
    else {
        setS(r.state);
        showToast(r.message);
        const wish = r.state.rewarded.length > before.rewarded.length;
        playCue(prefsRef.current.chimes, wish ? 'wish' : 'good');
        stage.burst(a.target);
        kit.input.rumble(wish ? 0.45 : 0.22, wish ? 160 : 70);
    } setQueue(q => q.slice(1)); setActive(null); }, prefs.instant ? 50 : 1550); return () => clearTimeout(t); }, [queue, playing, modal, kitPaused, s.ended, s.finished, prefs.instant]);
    useEffect(() => { if (new URLSearchParams(location.search).has('debug'))
        window.__HEARTH_DEBUG__ = { getState: () => stateRef.current, replace: x => { setQueue([]); setModal(null); setS(validateSave(x)); }, setPrefs: x => setPrefs(p => ({ ...p, ...x })), getQueue: () => queue }; }, [s, queue]);
    const projected = useMemo(() => { let n = s; for (const a of queue) {
        const r = performAction(n, a.id, a.delegate);
        if (!r.error)
            n = r.state;
    } return n; }, [s, queue]);
    function apply(r, cue = 'good') { if (r.error) {
        showToast(r.error, true);
        playCue(prefs.chimes, 'bad');
        return false;
    } setS(r.state); if (r.message)
        showToast(r.message); playCue(prefs.chimes, r.state.rewarded.length > s.rewarded.length ? 'wish' : cue); return true; }
    function schedule(id, delegate = false) { if (queue.length >= 4) {
        showToast('There is room for four activities in the plan.', true);
        return;
    } const q = quoteAction(projected, id, delegate); if (!q.ok) {
        showToast(q.reason, true);
        return;
    } setQueue(v => [...v, { id, delegate, uid: Date.now() + Math.random() }]); if (!playing)
        showToast('Added to your plan. Press play when you are ready.'); }
    function openModal(name) { setDrawer(null); setModal(name); setSellConfirm(null); }
    function closeModal() { setModal(null); setImported(null); }
    function endRequest() { setDrawer(null); if (s.finished) {
        openModal('finale');
        return;
    } if (s.ended) {
        openModal('summary');
        return;
    } if (queue.length) {
        showToast('Finish or clear the planned activities before ending the day.', true);
        return;
    } if (ev) {
        openModal('story');
        showToast('One little story choice before the day ends.');
        return;
    } const r = endDay(s); if (apply(r, 'page'))
        openModal('summary'); }
    function next() { const r = advanceDay(s); if (apply(r, 'page')) {
        setModal(r.state.finished ? 'finale' : null);
        setDrawer(null);
    } }
    function exportSave() { const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `Hearth-and-Home-${s.profile.surname}-${year(s)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); showToast('A copy of your story has been exported.'); }
    function backup() { try {
        localStorage.setItem(BACKUP, JSON.stringify(stateRef.current));
    }
    catch { } }
    async function importFile(event) { const f = event.target.files?.[0]; if (!f)
        return; try {
        if (f.size > 2000000)
            throw Error('This save file is too large. Choose a Hearth & Home JSON save.');
        const imported = validateSave(JSON.parse(await f.text()));
        setImported(imported);
        setModal('import');
    }
    catch (err) {
        showToast(err.message || 'This save could not be read.', true);
    } event.target.value = ''; }
    function changePrefs(k, v) { setPrefs(p => ({ ...p, [k]: v })); }
    function resetView() { stage.resetView(); setWalls(true); }
    function back() { if (closeTopModal())
        return; if (drawer) {
        setDrawer(null);
        return;
    } if (kit.input.source !== 'gamepad')
        openModal('settings'); }
    function cycleDrawer(dir) { const ids = CATEGORIES.map(c => c.id), i = ids.indexOf(drawer), n = ids.length; setDrawer(ids[i < 0 ? (dir > 0 ? 0 : n - 1) : (i + dir + n) % n]); if (kit.input.source === 'gamepad')
        setTimeout(() => nav.focusFirst('.activity-card-buttons button:not(:disabled)'), 90); }
    // Everything the per-frame input handler needs, fresh every render.
    live.current = { modal, drawer, back, endRequest, openModal, closeModal, cycleDrawer, resetView, setDrawer, setPlaying, setPrefs, setWalls };
    const nav = useMemo(() => createMenuNav(kit.input), []);
    // The 3D home follows the game state on every render (cheap when nothing changed).
    useEffect(() => { stage.sync({ state: s, walls, active, reduced: prefs.reduced, interactive: !modal }); });
    useEffect(() => {
        // The canvas host joins the scene panel; the loading card lifts once the pipelines are built.
        sceneRef.current.appendChild(host);
        let done = false;
        const finish = () => { if (!done) {
            done = true;
            kit.loading.done();
        } };
        stage.warm().then(finish);
        const fallback = setTimeout(finish, 5000);
        stage.handlers.onSelect = target => { const L = live.current; if (!L.modal)
            L.setDrawer(TARGET_CAT[target] || 'house'); };
        stage.handlers.onHover = setHover;
        const offSource = kit.input.onSourceChange(src => { setSource(src); document.documentElement.dataset.input = src; });
        document.documentElement.dataset.input = kit.input.source;
        const offPause = kit.onPause(p => { setKitPaused(p); setAudioPaused(p); });
        stage.beforeFrame = (dt, t) => {
            const L = live.current, inp = kit.input;
            nav.update(t);
            if (inp.pressed('confirm')) {
                unlockAudio();
                nav.confirm();
            }
            if (inp.pressed('back'))
                L.back();
            else if (inp.pressed('menu')) {
                if (L.modal === 'settings')
                    L.closeModal();
                else
                    L.openModal('settings');
            }
            if (L.modal) {
                // The right stick scrolls a long dialog (help, album) on a gamepad.
                const lk = inp.look('look');
                if (lk.y) {
                    const bodies = document.querySelectorAll('.modal-shade > .modal > .modal-body');
                    bodies[bodies.length - 1]?.scrollBy(0, lk.y * 420);
                }
                return;
            }
            if (modifierHeld())
                return;
            if (inp.pressed('play'))
                L.setPlaying(p => !p);
            if (inp.pressed('endDay'))
                L.endRequest();
            if (inp.pressed('help'))
                L.openModal('help');
            if (inp.pressed('music'))
                L.setPrefs(p => ({ ...p, sound: !p.sound }));
            if (inp.pressed('walls'))
                L.setWalls(w => !w);
            if (inp.pressed('resetView'))
                L.resetView();
            CATEGORIES.forEach((c, i) => { if (inp.pressed('cat' + (i + 1)))
                L.setDrawer(d => d === c.id ? null : c.id); });
            if (inp.pressed('prevCat'))
                L.cycleDrawer(-1);
            if (inp.pressed('nextCat'))
                L.cycleDrawer(1);
        };
        return () => { clearTimeout(fallback); offSource(); offPause(); stage.beforeFrame = null; stage.handlers.onSelect = stage.handlers.onHover = null; };
    }, []);
    const labelOf = t => ({ stove: 'The kitchen', table: 'The kitchen table', sofa: 'The living room', bed: 'A little care', chair: 'Your own quiet corner', desk: 'Make & mend', shelf: 'Stories worth keeping', record: 'Time together', phone: 'Keep in touch', laundry: 'Wash day', garden: 'The garden', mailbox: 'Your neighborhood' }[t]);
    return h(Fragment, null,
        h("div", { className: 'app ' + (prefs.reduced ? 'reduced-motion' : ''), "aria-hidden": modal ? 'true' : undefined },
            h("header", { className: "topbar" },
                h(Logo, null),
                h("div", { className: "date-pill" },
                    h("span", { className: 'season-icon season-' + season(s).toLowerCase() },
                        h(Icon, { name: ['sprout', 'sun', 'leaf', 'snow'][dayIndex(s) % 4], size: 25 })),
                    h("div", null,
                        h("strong", null,
                            season(s),
                            " ",
                            year(s)),
                        h("span", null, s.finished ? 'A life, remembered' : `Chapter ${String(e + 1).padStart(2, '0')} · ${ch.name}`)),
                    h("button", { className: "bare-button date-expand", "aria-label": "View your life chapters", onClick: () => openModal('chapters') },
                        h(Icon, { name: "down", size: 16 }))),
                h("div", { className: "top-resources" },
                    h("button", { className: "resource", onClick: () => openModal('budget'), title: "Household cash. Open the budget." },
                        h("span", { className: "resource-icon gold" },
                            h(Icon, { name: "coin", size: 21 })),
                        h("span", null,
                            h("small", null, "HOUSEHOLD"),
                            h("b", null, money(s.cash)))),
                    h("button", { className: "resource energy-resource", onClick: () => setDrawer('self'), title: "Your energy. Choose something restorative." },
                        h("span", { className: "resource-icon green" },
                            h(Icon, { name: "bolt", size: 21 })),
                        h("span", null,
                            h("small", null, "YOUR ENERGY"),
                            h("b", { className: s.stats.energy < 25 ? 'warning' : '' },
                                Math.round(s.stats.energy),
                                h("em", null, "/100")))),
                    h("button", { className: "icon-button settings-button", "aria-label": "Open settings and save options", onClick: () => openModal('settings') },
                        h(Icon, { name: "settings", size: 21 })))),
            h("div", { className: "subbar" },
                h("nav", { className: "main-nav", "aria-label": "Game sections" }, [['daybook', 'book', 'Daybook'], ['family', 'people', 'Family'], ['home', 'home', 'Home'], ['album', 'camera', 'Album'], ['budget', 'coin', 'Budget']].map(([id, icon, label]) => h("button", { key: id, className: 'nav-item ' + (!modal && id === 'daybook' ? 'selected' : ''), onClick: () => id === 'daybook' ? setDrawer(null) : openModal(id) },
                    h(Icon, { name: icon, size: 16 }),
                    h("span", null, label)))),
                h("div", { className: "season-progress" },
                    h("span", null,
                        "CHAPTER ",
                        String(e + 1).padStart(2, '0')),
                    ch.years.map((_, i) => h("i", { key: i, className: i <= dayIndex(s) ? 'complete' : '', title: `${SEASONS[i % 4]} ${ch.years[i]}` })),
                    h("span", null,
                        dayIndex(s) + 1,
                        "/",
                        ch.years.length)),
                h("div", { className: "subbar-right" },
                    h("span", { className: 'save-status ' + (!saved ? 'warning' : '') },
                        h(Icon, { name: saved ? 'check' : 'info', size: 13 }),
                        saved ? 'Saved on this device' : 'Export to keep your story'),
                    h("button", { className: "bare-button help-button", onClick: () => openModal('help') },
                        h(Icon, { name: "info", size: 17 }),
                        h("span", null, "How to play")))),
            h("main", { className: 'game-main ' + season(s).toLowerCase() },
                h("aside", { className: "left-sidebar" },
                    h("section", { className: "panel plan-panel" },
                        h("div", { className: "eyebrow" }, "ONE THING AT A TIME"),
                        h("div", { className: "panel-heading" },
                            h("h2", null, "Today\u2019s little plan"),
                            h("span", { className: "mini-count" },
                                focus.filter(id => s.dayCounts[id]).length,
                                "/3")),
                        h("p", { className: "panel-intro" }, "A few ideas. The day is yours."),
                        h("div", { className: "daily-plan" }, focus.map((id, i) => { const a = ACTIONS.find(a => a.id === id), done = !!s.dayCounts[id], q = quoteAction(projected, id); return h("button", { key: id, className: 'plan-item ' + (done ? 'done' : ''), onClick: () => done ? setDrawer(a.cat) : schedule(id), title: done ? 'Explore more activities' : q.ok ? `${q.time} minutes · ${q.food || 0} pantry · $${q.cost}` : q.reason },
                            h("span", { className: "plan-check" }, done ? h(Icon, { name: "check", size: 14 }) : h("span", null, i + 1)),
                            h("span", { className: "plan-copy" },
                                h("strong", null, id === 'cook' && s.turn === 0 ? 'Cook our first supper' : a.short),
                                h("small", null, done ? 'A little thing, done.' : `${duration(q.time || a.time)} · ${CATEGORIES.find(c => c.id === a.cat).name}`)),
                            !done && h(Icon, { name: "chevron", size: 13 })); })),
                        h("button", { className: "text-button", onClick: () => setDrawer('kitchen') },
                            "Make your own plan",
                            h(Icon, { name: "arrow", size: 15 }))),
                    ev ? h("button", { className: "letter-card", onClick: () => openModal('story') },
                        h("span", { className: "letter-icon" },
                            h(Icon, { name: "mail", size: 23 }),
                            h("i", null)),
                        h("span", null,
                            h("small", null, "A MOMENT IN YOUR STORY"),
                            h("strong", null, ev.title),
                            h("span", null,
                                "Open this little chapter",
                                h(Icon, { name: "arrow", size: 14 })))) : h("div", { className: "story-chosen" },
                        h(Icon, { name: "check", size: 18 }),
                        h("div", null,
                            h("span", null, "IN THE FAMILY STORY"),
                            h("p", null, s.decisions.find(d => d.turn === s.turn)?.choice))),
                    h("section", { className: "kind-note" },
                        h("span", { className: "tea-illustration" },
                            h(Icon, { name: "tea", size: 31 })),
                        h("h3", null, s.stats.energy < 30 ? 'A moment for you.' : 'You live here, too.'),
                        h("p", null, s.stats.energy < 30 ? 'Your energy is low. Rest is free, and the house can wait.' : 'A perfect home is not the goal. Leave a little room for yourself.'),
                        h("button", { className: "text-button", onClick: () => schedule('rest') },
                            "Tea & a sit-down",
                            h(Icon, { name: "arrow", size: 14 }))),
                    h("div", { className: "sidebar-footnote" },
                        h(Icon, { name: "hands", size: 15 }),
                        h("span", null,
                            s.helpRemaining,
                            " helping ",
                            s.helpRemaining === 1 ? 'hand' : 'hands',
                            " left today"),
                        h("button", { className: "bare-button", onClick: () => openModal('family'), "aria-label": "Learn about sharing the work" },
                            h(Icon, { name: "info", size: 13 })))),
                h("section", { className: "scene-stage", "aria-label": "Your home" },
                    h("div", { className: "scene-heading" },
                        h("span", null,
                            "WILLOW LANE \u00B7 THE ",
                            s.profile.surname.toUpperCase(),
                            " HOME"),
                        h("h1", null, s.finished ? 'A life, together.' : s.turn === 0 ? 'A new beginning.' : ch.subtitle),
                        h("div", { className: "weather" },
                            h(Icon, { name: ['sprout', 'sun', 'leaf', 'snow'][dayIndex(s) % 4], size: 13 }),
                            ['A little sunshine after the rain', 'A warm, unhurried afternoon', 'A cool breeze through the trees', 'A crisp day. A warm little home.'][dayIndex(s) % 4])),
                    h("div", { className: "mobile-quickbar" },
                        ev && h("button", { onClick: () => openModal('story') },
                            h(Icon, { name: "mail", size: 12 }),
                            "Today\u2019s story"),
                        h("button", { onClick: () => openModal('family') },
                            h(Icon, { name: "heart", size: 12 }),
                            "Our household")),
                    h("div", { className: "scene-canvas", ref: sceneRef }),
                    h("div", { className: "camera-tools" },
                        h("button", { "aria-label": "Rotate view left", onClick: () => stage.rotate(-.26), title: "Rotate left (Q)" },
                            h(Icon, { name: "rotate", size: 17 })),
                        h("button", { "aria-label": "Rotate view right", onClick: () => stage.rotate(.26), title: "Rotate right (E)" },
                            h(Icon, { name: "rotate", size: 17, className: "mirror" })),
                        h("span", null),
                        h("button", { "aria-label": "Zoom in", onClick: () => stage.zoomBy(.1), title: "Zoom in (+)" },
                            h(Icon, { name: "plus", size: 17 })),
                        h("button", { "aria-label": "Zoom out", onClick: () => stage.zoomBy(-.1), title: "Zoom out (−)" },
                            h(Icon, { name: "minus", size: 17 })),
                        h("span", null),
                        h("button", { "aria-label": walls ? 'Lower the walls' : 'Raise the walls', "aria-pressed": !walls, onClick: () => setWalls(x => !x), title: "Toggle cutaway walls (C)" },
                            h(Icon, { name: "layers", size: 17 })),
                        h("button", { "aria-label": "Reset the camera", onClick: resetView, title: "Reset view (R)" },
                            h(Icon, { name: "home", size: 17 }))),
                    h("div", { className: "home-label" },
                        h("span", { className: "home-label-icon" },
                            h(Icon, { name: "home", size: 17 })),
                        h("span", null,
                            homeSize(s) === 1 ? 'Our first little home' : homeSize(s) === 2 ? 'A little more room' : 'A house full of life',
                            h("small", null,
                                homeSize(s) === 1 ? '4 cozy rooms' : `${homeSize(s) + 3} lived-in rooms`,
                                " \u00B7 ",
                                s.owned.length,
                                " improvements"))),
                    h("div", { className: "renderer-label", title: `three.js r186 · ${kit.backendLabel}` },
                        h("i", { className: 'ready' }),
                        `3D VIEW · ${kit.backendLabel.toUpperCase()}`),
                    h("div", { className: 'scene-hint ' + (active ? 'working' : '') }, active ? h(Fragment, null,
                        h("span", { className: "working-spinner" }),
                        h("span", null,
                            active.delegate ? 'A helping hand' : s.profile.name,
                            h("b", null,
                                active.name.toLowerCase(),
                                "\u2026")),
                        h("i", { className: "work-progress", key: active.start, style: { animationDuration: prefs.instant ? '50ms' : '1550ms' } })) : hover ? h(Fragment, null,
                        h(Icon, { name: CATEGORIES.find(c => c.id === TARGET_CAT[hover])?.icon || 'home', size: 17 }),
                        h("span", null,
                            labelOf(hover),
                            h("b", null, "Click to choose an activity"))) : h(Fragment, null,
                        h(Icon, { name: source === 'gamepad' ? 'gamepad' : 'home', size: 16 }),
                        source === 'gamepad' ? h("span", null, "LT / RT open the activities.", h("b", null, "Right stick turns the house · LB / RB zoom")) : source === 'touch' ? h("span", null, "Tap a room, or choose an activity below.", h("b", null, "Drag to turn the house · pinch to zoom")) : h("span", null, "Click a room, or choose an activity below.", h("b", null, "Drag to turn the house · scroll to zoom"))))),
                h("aside", { className: "right-sidebar" },
                    h("section", { className: "panel household-panel" },
                        h("div", { className: "eyebrow" }, "THE HEART OF THE HOME"),
                        h("div", { className: "family-preview", onClick: () => openModal('family'), role: "button", tabIndex: 0, onKeyDown: e => { if (e.key === 'Enter' || e.key === ' ')
                                openModal('family'); }, "aria-label": "View your family" },
                            h("div", { className: "portrait-pair" },
                                h(Portrait, { name: s.profile.name, skin: s.profile.skin, apron: true, old: age(s) > 62 }),
                                s.partnerAlive && h(Portrait, { name: s.profile.partner, shirt: "#d5b174", old: age(s) > 62 }),
                                h("span", { className: "tiny-heart" },
                                    h(Icon, { name: "heart", size: 11 }))),
                            h("div", null,
                                h("h2", null,
                                    s.profile.name,
                                    s.partnerAlive ? ` & ${s.profile.partner}` : ''),
                                h("p", null, members.length ? `${members.length === 1 ? 'One little life' : 'Two growing lives'} to look after` : s.partnerAlive ? 'A home for the two of you' : 'A circle to hold you'))),
                        h("div", { className: "need-meters" },
                            h(Meter, { icon: "pot", label: "Nourishment", value: s.stats.meals }),
                            h(Meter, { icon: "sparkles", label: "Home comfort", value: s.stats.home }),
                            h(Meter, { icon: "hands", label: "Everyone cared for", value: s.stats.care })),
                        h("div", { className: "personal-needs" },
                            h("div", null,
                                h("span", null,
                                    h(Icon, { name: "heart", size: 15 }),
                                    "Companionship"),
                                h("b", null,
                                    Math.round(s.stats.bond),
                                    h("small", null, "%")),
                                h("div", { className: "small-track pink" },
                                    h("i", { style: { width: `${s.stats.bond}%` } }))),
                            h("div", null,
                                h("span", null,
                                    h(Icon, { name: "sun", size: 15 }),
                                    "Your own joy"),
                                h("b", null,
                                    Math.round(s.stats.joy),
                                    h("small", null, "%")),
                                h("div", { className: "small-track gold" },
                                    h("i", { style: { width: `${s.stats.joy}%` } })))),
                        h("button", { className: "pantry-line", onClick: () => setDrawer('kitchen') },
                            h("span", null,
                                h(Icon, { name: "jar", size: 15 }),
                                "In the pantry"),
                            h("b", null,
                                s.pantry,
                                " portions",
                                h(Icon, { name: "chevron", size: 12 })))),
                    h("section", { className: "panel wishes-panel" },
                        h("div", { className: "wish-top" },
                            h("span", { className: "wish-icon" },
                                h(Icon, { name: ch.icon, size: 19 })),
                            h("div", null,
                                h("div", { className: "eyebrow" }, "CHAPTER WISHES"),
                                h("h3", null, ch.name)),
                            h("span", { className: "wish-year" }, ch.range)),
                        h("div", { className: "wish-list" }, goals.map((g, i) => h("div", { key: i, className: 'wish ' + (g.done ? 'done' : '') },
                            h("span", { className: "wish-check" }, g.done && h(Icon, { name: "check", size: 11 })),
                            h("span", null, g.label),
                            h("b", null, g.done ? h(Icon, { name: "check", size: 12 }) : ['home', 'meals', 'joy', 'care', 'social', 'energy', 'bond', 'condition'].includes(g.key) ? `${g.value}%` : g.key === 'savings' ? money(g.value) : `${g.value}/${g.target}`)))),
                        h("div", { className: "wish-reward" },
                            h(Icon, { name: s.rewarded.includes(e) ? 'check' : 'camera', size: 14 }),
                            s.rewarded.includes(e) ? 'A chapter keepsake, earned.' : 'A keepsake + $35 · always optional')),
                    s.broken ? h("button", { className: "maintenance-alert", onClick: () => { schedule('repair'); } },
                        h(Icon, { name: "wrench", size: 17 }),
                        h("span", null,
                            "Your ",
                            UPGRADES.find(u => u.id === s.broken)?.name.toLowerCase(),
                            " needs a repair.")) : h("button", { className: "chapter-peek", onClick: () => openModal('chapters') },
                        h(Icon, { name: "book", size: 17 }),
                        h("span", null,
                            "A whole life ahead",
                            h("span", null, e === 8 ? 'The optional final chapter' : '8 chapters, from newlyweds to golden years')),
                        h(Icon, { name: "arrow", size: 15 })))),
            h("div", { className: "queue-strip" },
                h("div", { className: "queue-time" },
                    h("span", null, "8 am"),
                    h("div", null,
                        h("i", { style: { width: `${(480 - s.minutes) / 480 * 100}%` } }),
                        queue.length > 0 && h("i", { className: "reserved", style: { left: `${(480 - s.minutes) / 480 * 100}%`, width: `${(s.minutes - projected.minutes) / 480 * 100}%` } })),
                    h("span", null, "4 pm")),
                h("div", { className: "queue-items" }, queue.length ? h(Fragment, null,
                    h("span", { className: "queue-label" }, "YOUR PLAN"),
                    queue.map((q, i) => h("div", { className: 'queue-chip ' + (i === 0 && playing ? 'active' : ''), key: q.uid },
                        h(Icon, { name: q.delegate ? 'hands' : ACTIONS.find(a => a.id === q.id).icon, size: 12 }),
                        h("span", null, ACTIONS.find(a => a.id === q.id).short),
                        h("button", { onClick: () => setQueue(v => v.filter(x => x.uid !== q.uid)), "aria-label": `Remove ${ACTIONS.find(a => a.id === q.id).short} from plan` },
                            h(Icon, { name: "close", size: 11 }))))) : h("span", { className: "pace-note" },
                    h(Icon, { name: "leaf", size: 13 }),
                    "Your pace. No ticking clock. No perfect score.")),
                h("button", { className: "play-toggle", onClick: () => setPlaying(x => !x), "aria-label": playing ? 'Pause planned activities' : 'Play planned activities', title: "Space: pause or play the activity plan" },
                    h(Icon, { name: playing ? 'pause' : 'play', size: 13 }),
                    playing ? 'Pause' : 'Play')),
            h("footer", { className: "control-dock" },
                h("div", { className: "time-block" },
                    h("span", { className: "clock-circle" },
                        h(Icon, { name: s.minutes < 90 ? 'sun' : 'clock', size: 25 })),
                    h("div", null,
                        h("strong", null,
                            clock,
                            h("em", null, am)),
                        h("span", null,
                            s.minutes,
                            " minutes for your day"))),
                h("div", { className: "activities-nav", "aria-label": "Choose activities" }, CATEGORIES.map((c, i) => h("button", { key: c.id, className: 'activity-nav ' + (drawer === c.id ? 'selected' : ''), onClick: () => setDrawer(d => d === c.id ? null : c.id), "aria-expanded": drawer === c.id },
                    h("span", { className: "activity-icon" },
                        h(Icon, { name: c.icon, size: 24 })),
                    h("strong", null, c.name),
                    h("kbd", null, i + 1),
                    traditionWaiting && tradition.cat === c.id && h("i", { className: "tradition-dot", title: `A ${season(s).toLowerCase()} tradition is waiting here` })))),
                h("div", { className: "end-day-wrap" },
                    h("button", { className: "button primary end-day", onClick: endRequest },
                        h(Icon, { name: s.finished ? 'book' : 'moon', size: 18 }),
                        s.finished ? 'Your life, in stories' : s.ended ? 'Turn the page' : 'End the day',
                        h(Icon, { name: "arrow", size: 17 })),
                    h("span", null, s.finished ? 'There is a whole life in this album.' : 'Settle the bills. Turn the page.')))),
        drawer && !modal && h(Fragment, null,
            h("div", { className: "drawer-shade", onClick: () => setDrawer(null) }),
            h("section", { ref: drawerRef, className: "activity-drawer", "aria-label": `${CATEGORIES.find(c => c.id === drawer).name} activities` },
                h("header", { className: "drawer-header" },
                    h("span", { className: "drawer-icon" },
                        h(Icon, { name: CATEGORIES.find(c => c.id === drawer).icon, size: 27 })),
                    h("div", null,
                        h("div", { className: "eyebrow" }, "MAKE A LITTLE TIME FOR"),
                        h("h2", null, CATEGORIES.find(c => c.id === drawer).name),
                        h("p", null, CATEGORIES.find(c => c.id === drawer).tagline)),
                    h(Tag, { icon: "clock" },
                        duration(projected.minutes),
                        " unplanned"),
                    h("button", { className: "icon-button", "aria-label": "Close activity menu", onClick: () => setDrawer(null) },
                        h(Icon, { name: "close" }))),
                h("div", { className: "activity-grid" }, ACTIONS.filter(a => a.cat === drawer && available(s, a)).map(a => { const q = quoteAction(projected, a.id), d = quoteAction(projected, a.id, true); return h("article", { className: "activity-card", key: a.id },
                    h("div", { className: "activity-card-top" },
                        h("span", { className: "activity-card-icon" },
                            h(Icon, { name: a.icon, size: 20 })),
                        h("div", null,
                            h("h3", null, actionLabel(s, a)),
                            h("div", { className: "activity-costs" },
                                h("span", null,
                                    h(Icon, { name: "clock", size: 12 }),
                                    duration(q.time || a.time)),
                                q.energy !== 0 && h("span", { className: q.energy < 0 ? 'positive' : '' },
                                    h(Icon, { name: "bolt", size: 12 }),
                                    q.energy < 0 ? '+' : '−',
                                    Math.abs(q.energy ?? a.energy)),
                                q.cost > 0 && h("span", null, money(q.cost)),
                                q.food > 0 && h("span", null,
                                    h(Icon, { name: "jar", size: 12 }),
                                    q.food)))),
                    h("p", null, a.desc),
                    a.season && h("span", { className: "tradition-tag" },
                        h(Icon, { name: "leaf", size: 12 }),
                        `A ${a.season.toLowerCase()} tradition`,
                        s.counts[a.id] ? ` · kept ${s.counts[a.id]}×` : ''),
                    h("div", { className: "activity-benefits" },
                        Object.entries(a.effects || {}).filter(([k, v]) => v > 0).slice(0, 3).map(([k, v]) => h("span", { key: k },
                            "+",
                            v,
                            " ",
                            { meals: 'nourishment', home: 'comfort', bond: 'connection', joy: 'joy', care: 'care', social: 'your circle', condition: 'condition' }[k])),
                        a.addFood && h("span", null,
                            "+",
                            a.addFood,
                            " pantry"),
                        a.earn && h("span", null,
                            "+",
                            money(a.earn),
                            " or more"),
                        a.prepared && h("span", null, "Tomorrow\u2019s meal, ready")),
                    h("div", { className: "activity-card-buttons" },
                        h("button", { className: "button small primary", onClick: () => schedule(a.id), disabled: !q.ok || queue.length >= 4, title: q.reason || 'Add this activity to your plan' },
                            s.ended || s.finished ? 'Turn the page first' : !q.ok ? (a.once && projected.dayCounts[a.id] ? 'Done today' : projected.minutes < (q.time || a.time) ? 'Not enough time' : q.cost > projected.cash ? 'Needs cash' : q.food > projected.pantry ? 'Needs groceries' : 'Rest first') : queue.length >= 4 ? 'The plan is full' : 'Add to your day',
                            h(Icon, { name: "plus", size: 14 })),
                        a.delegate && h("button", { className: "button small share", onClick: () => schedule(a.id, true), disabled: !d.ok || queue.length >= 4, title: d.reason || 'Use one helping hand and 15 minutes. You spend no energy.' },
                            h(Icon, { name: "hands", size: 15 }),
                            "Share \u00B7 15m"))); })),
                h("div", { className: "drawer-footer" },
                    h(Icon, { name: "info", size: 14 }),
                    h("span", null,
                        "Plan up to four activities. Time and resources are spent when each activity finishes. ",
                        h("b", null,
                            projected.helpRemaining,
                            " helping hands"),
                        " unplanned.")))),
        modal === 'story' && h(DayStory, { s: s, onClose: closeModal, choose: i => { if (apply(applyChoice(s, i), 'story'))
                closeModal(); } }),
        modal === 'summary' && h(Summary, { s: s, onClose: closeModal, onNext: next }),
        modal === 'finale' && h(Finale, { s: s, onClose: closeModal, onAlbum: () => setModal('album'), onNewStory: () => setModal('new'), onEpilogue: () => { if (apply(beginEpilogue(s), 'page'))
                closeModal(); } }),
        modal === 'family' && h(Modal, { title: "The people make the home.", eyebrow: "YOUR HOUSEHOLD & YOUR CIRCLE", onClose: closeModal, wide: true },
            h("div", { className: "family-cards" },
                h("div", { className: "person-card" },
                    h(Portrait, { name: s.profile.name, skin: s.profile.skin, apron: true, old: age(s) > 62 }),
                    h("h3", null, s.profile.name),
                    h("span", null,
                        age(s),
                        " years old \u00B7 homemaker"),
                    h("p", null, "A person with a home to care for, and a life of your own."),
                    h(Meter, { label: "Your energy", icon: "bolt", value: s.stats.energy }),
                    h(Meter, { label: "Your own joy", icon: "sun", value: s.stats.joy, tone: "gold" }),
                    h("button", { className: "button secondary small", onClick: () => { closeModal(); setDrawer('self'); } },
                        "Make time for yourself",
                        h(Icon, { name: "arrow", size: 14 }))),
                h("div", { className: "person-card" },
                    h(Portrait, { name: s.profile.partner, shirt: "#d5b174", old: age(s) > 62 }),
                    h("h3", null, s.profile.partner),
                    h("span", null, s.partnerAlive ? `${age(s) + 2} years old · ${e >= 6 ? 'retired partner' : 'partner'}` : 'Remembered with love'),
                    h("p", null, s.partnerAlive ? 'Paid work, a shared life, and responsibility for the home you both live in.' : 'A life lived in the little things. The stories remain in your album.'),
                    h(Meter, { label: "Companionship", icon: "heart", value: s.stats.bond, tone: "pink" }),
                    h("div", { className: "help-count" },
                        h(Icon, { name: "hands", size: 24 }),
                        h("b", null, s.helpRemaining),
                        h("span", null, "helping hands left today")),
                    h("button", { className: "button secondary small", onClick: () => { closeModal(); setDrawer('family'); } },
                        "Time together",
                        h(Icon, { name: "arrow", size: 14 }))),
                s.children.map((c, i) => h("div", { className: "person-card", key: c.name },
                    h(Portrait, { name: c.name, skin: s.profile.skin, shirt: i ? '#bc91a1' : '#90aaba' }),
                    h("h3", null, c.name),
                    h("span", null,
                        year(s) - c.born,
                        " years old \u00B7 ",
                        year(s) - c.born < 18 ? 'at home' : 'building a life beyond home'),
                    h("p", null, year(s) - c.born < 3 ? 'Tiny hands, interrupted nights, and a whole new rhythm.' : year(s) - c.born < 13 ? 'Growing, learning, and needing someone to hear about their day.' : year(s) - c.born < 18 ? 'A little more privacy. A little more trust. Still your child.' : 'No longer under your roof. Always part of the story.'),
                    h(Meter, { icon: "heart", label: "Connection", value: c.connection, tone: "pink" }),
                    h("button", { className: "button secondary small", onClick: () => { closeModal(); schedule(year(s) - c.born < 18 ? 'care' : 'call'); } },
                        "Make a little time",
                        h(Icon, { name: "arrow", size: 14 }))))),
            !s.children.length && h("div", { className: "note" },
                h(Icon, { name: "sprout" }),
                h("p", null, e === 0 ? 'The shape of your family is still ahead. In the next chapter, you will choose whether to welcome children or build a life for two.' : 'A family can be two people and a wider circle of love. Your child-free path has its own care, commitments, and milestones.')),
            h("div", { className: "family-bottom" },
                h("section", null,
                    h("h3", null, "The work is shared."),
                    h("p", null,
                        "You have ",
                        s.helpBase,
                        " regular helping ",
                        s.helpBase === 1 ? 'hand' : 'hands',
                        " each morning",
                        e >= 6 && s.partnerAlive ? ', plus one in retirement' : '',
                        owns(s, 'help') ? ', plus a paid helper' : '',
                        ". Shared activities cost 15 minutes and no homemaker energy. Use \u201CShare\u201D on eligible activities."),
                    h("button", { className: "text-button", onClick: () => { closeModal(); schedule('rebalance'); } },
                        "Talk about sharing the load",
                        h(Icon, { name: "arrow", size: 15 }))),
                h("section", null,
                    h("h3", null, "A circle beyond these walls."),
                    h(Meter, { icon: "people", label: "Friends & community", value: s.stats.social }),
                    h("p", null,
                        "Mabel next door",
                        e >= 2 ? ', friends at the community center' : '',
                        e >= 4 ? ', old friends and a new generation' : '',
                        s.elder ? ', and Aunt Ruth, who needs regular care' : '',
                        ". Connection needs tending, too."),
                    h("button", { className: "text-button", onClick: () => { closeModal(); setDrawer('community'); } },
                        "Keep the door open",
                        h(Icon, { name: "arrow", size: 15 }))))),
        modal === 'home' && h(Modal, { title: "A home that grows with you.", eyebrow: `${homeSize(s) + 3} ROOMS · ${s.owned.length} IMPROVEMENTS · ${money(budget(s).upkeep)} DAILY UPKEEP`, onClose: closeModal, wide: true },
            h("div", { className: "home-health" },
                h(Meter, { icon: "wrench", label: "Condition of the home", value: s.stats.condition }),
                h(Meter, { icon: "box", label: "Accumulated clutter", value: s.clutter, tone: "gold" }),
                h("button", { className: "button secondary small", onClick: () => { closeModal(); schedule('repair'); } },
                    "Make a repair",
                    h(Icon, { name: "wrench", size: 15 }))),
            h("div", { className: "tabs", role: "tablist" }, [['improve', 'Make a little improvement'], ['routines', 'Find a daily rhythm'], ['inventory', 'What we own']].map(([id, t]) => h("button", { role: "tab", "aria-selected": homeTab === id, key: id, className: homeTab === id ? 'active' : '', onClick: () => { setHomeTab(id); setSellConfirm(null); } }, t))),
            homeTab === 'routines' ? h(Fragment, null,
                h("p", { className: "section-intro" }, "Choose up to two routines. They run once at the next dawn, using the time, energy, and ingredients shown. Change them as life changes."),
                h("div", { className: "routines-grid" }, ROUTINES.map(r => h("button", { className: 'routine-card ' + (s.routines.includes(r.id) ? 'selected' : ''), key: r.id, onClick: () => apply(toggleRoutine(s, r.id)) },
                    h("span", { className: "routine-icon" },
                        h(Icon, { name: r.icon, size: 28 })),
                    h("strong", null, r.name),
                    h("small", null, r.desc),
                    h("span", { className: "routine-toggle" }, s.routines.includes(r.id) ? h(Fragment, null,
                        h(Icon, { name: "check", size: 15 }),
                        "Part of our rhythm") : h(Fragment, null,
                        h(Icon, { name: "plus", size: 15 }),
                        "Add to our rhythm"))))),
                h("div", { className: "note" },
                    h(Icon, { name: "sun" }),
                    h("p", null,
                        s.routines.length,
                        "/2 routines chosen. Breakfast is skipped, with a journal note, when the pantry is empty. Routines are not free actions."))) : homeTab === 'inventory' ? h(Fragment, null,
                s.owned.length === 0 ? h("div", { className: "empty-state" },
                    h(Icon, { name: "home", size: 44 }),
                    h("h3", null, "The things you start with are enough to begin."),
                    h("p", null, "The stove, furniture, and simple household tools are included in the house. New improvements will appear here."),
                    h("button", { className: "button secondary", onClick: () => setHomeTab('improve') },
                        "Browse improvements",
                        h(Icon, { name: "arrow", size: 16 }))) : h("div", { className: "upgrade-grid" }, UPGRADES.filter(u => owns(s, u.id)).map(u => h("article", { className: "upgrade-card owned", key: u.id },
                    h("span", { className: "upgrade-icon" },
                        h(Icon, { name: u.icon, size: 29 })),
                    h(Tag, { icon: s.broken === u.id ? 'wrench' : 'check' }, s.broken === u.id ? 'Needs a repair' : 'Part of our home'),
                    h("h3", null, u.name),
                    h("p", null, u.desc),
                    h("div", { className: "upgrade-meta" },
                        h("span", null,
                            money(u.upkeep),
                            " / day"),
                        h("span", null, u.space ? 'Permanent room' : u.clutter ? `${u.clutter} added clutter` : 'Less to think about')),
                    !u.space && !u.keeps && !['accessible', 'insulation'].includes(u.id) && h("button", { className: "text-button", onClick: () => setSellConfirm(u.id) },
                        u.id === 'help' ? 'End regular help' : `Pass it on · +${money(Math.floor(u.cost * .4))}`,
                        h(Icon, { name: "arrow", size: 14 }))))),
                sellConfirm && h("div", { className: "confirm-inline" },
                    h("span", null,
                        sellConfirm === 'help' ? 'End the regular-help arrangement? The arrangement fee is not refundable.' : `Sell the ${UPGRADES.find(u => u.id === sellConfirm).name.toLowerCase()} for ${money(Math.floor(UPGRADES.find(u => u.id === sellConfirm).cost * .4))}?`,
                        " Its benefits and ongoing costs will end."),
                    h("button", { className: "button secondary small", onClick: () => setSellConfirm(null) }, "Keep it"),
                    h("button", { className: "button primary small", onClick: () => { apply(sellUpgrade(s, sellConfirm)); setSellConfirm(null); } }, sellConfirm === 'help' ? 'End arrangement' : 'Pass it on'))) : h(Fragment, null,
                h("p", { className: "section-intro" }, "Useful things can give you time back. More rooms and more possessions also bring more cleaning, maintenance, and bills. Nothing here is required to finish the story."),
                h("div", { className: "upgrade-grid" }, UPGRADES.map(u => { const isOwned = owns(s, u.id), locked = e < u.era, reason = upgradeReason(s, u.id); return h("article", { className: 'upgrade-card ' + (isOwned ? 'owned' : '') + (locked ? ' locked' : ''), key: u.id },
                    h("span", { className: "upgrade-icon" },
                        h(Icon, { name: u.icon, size: 29 })),
                    h("span", { className: "upgrade-era" }, isOwned ? 'ALREADY HOME' : locked ? CHAPTERS[u.era].range : 'AVAILABLE NOW'),
                    h("h3", null, u.name),
                    h("p", null, u.desc),
                    h("div", { className: "upgrade-meta" },
                        h("span", null,
                            u.upkeep < 0 ? 'Saves ' + money(-u.upkeep) : 'Upkeep ' + money(u.upkeep),
                            " / day"),
                        h("span", null, u.space ? '+1 room' : u.clutter ? '+ ' + u.clutter + ' clutter' : '')),
                    h("button", { className: 'button small ' + (isOwned ? 'secondary' : 'primary'), disabled: !!reason, title: reason || u.desc, onClick: () => apply(buyUpgrade(s, u.id), 'buy') }, isOwned ? h(Fragment, null,
                        h(Icon, { name: "check", size: 14 }),
                        "Part of our home") : locked ? `Arrives ${CHAPTERS[u.era].years[0]}` : h(Fragment, null,
                        money(u.cost),
                        h(Icon, { name: "plus", size: 15 })))); })))),
        modal === 'budget' && h(Modal, { title: "A little peace of mind.", eyebrow: "THE HOUSEHOLD BOOK", onClose: closeModal, wide: true },
            h(BudgetView, { s: s, apply: apply })),
        modal === 'album' && h(Modal, { title: "All the little things we kept.", eyebrow: `${s.profile.surname.toUpperCase()} FAMILY ALBUM · ${s.memories.length} MEMORIES`, onClose: closeModal, wide: true },
            h("div", { className: "tabs", role: "tablist" }, [['memories', 'The family album'], ['journal', 'The everyday journal'], ['choices', 'The choices we made'], ['shelf', 'Lives on the shelf']].map(([id, t]) => h("button", { key: id, role: "tab", "aria-selected": albumTab === id, className: albumTab === id ? 'active' : '', onClick: () => setAlbumTab(id) }, t))),
            albumTab === 'memories' ? h("div", { className: "memories-grid" }, [...s.memories].reverse().map((m, i) => h("article", { className: 'memory-card memory-' + i % 4, key: i },
                h("div", { className: "memory-picture" },
                    h(Icon, { name: m.type === 'milestone' ? 'home' : m.type === 'chapter' ? 'star' : m.type === 'tradition' ? 'leaf' : i % 3 === 0 ? 'flower' : i % 3 === 1 ? 'tea' : 'heart', size: 43 }),
                    h("span", null, m.year)),
                h("h3", null, m.title),
                h("small", null, m.type === 'milestone' ? 'A new beginning' : m.type === 'chapter' ? 'A chapter wish, fulfilled' : m.type === 'tradition' ? 'A tradition, begun' : 'An ordinary, precious thing')))) : albumTab === 'journal' ? h("div", { className: "journal-list" }, s.log.map((l, i) => h("div", { key: i },
                h("span", { className: 'journal-dot ' + l.kind }),
                h("p", null, l.text)))) : albumTab === 'shelf' ? h("div", { className: "shelf-list" }, lives.length ? lives.map(l => h("article", { key: l.id },
                h("span", { className: "shelf-spine" },
                    h(Icon, { name: l.ending === 'legacy' ? 'flower' : 'heart', size: 20 })),
                h("div", null,
                    h("h3", null, l.title),
                    h("p", null, `${l.names} · ${l.years}`),
                    h("small", null, `${l.memories} memories · ${l.traditions || 0} traditions kept · ${l.children ? (l.children === 1 ? 'one child' : 'two children') : 'a family of two'}`)))) : h("div", { className: "empty-state" },
                h(Icon, { name: "book", size: 40 }),
                h("h3", null, "The shelf is waiting for its first story."),
                h("p", null, "Every life you finish, at the golden anniversary or after the epilogue, is kept here."))) : h("div", { className: "decisions-list" }, s.decisions.length ? [...s.decisions].reverse().map((d, i) => h("article", { key: i },
                h("span", null, CHAPTERS[Math.min(8, Math.floor(d.turn / 4))].years[d.turn < 32 ? d.turn % 4 : d.turn - 32]),
                h("div", null,
                    h("h3", null, d.title),
                    h("p", null, d.choice)),
                h(Icon, { name: "heart", size: 17 }))) : h("div", { className: "empty-state" },
                h(Icon, { name: "book", size: 40 }),
                h("h3", null, "A whole book of choices is still ahead."),
                h("p", null, "Open the letter in your daybook to begin."))),
            h("div", { className: "album-footer" },
                h("span", null, "Ordinary moments make a life."),
                h("button", { className: "text-button", onClick: exportSave },
                    "Export your whole story",
                    h(Icon, { name: "download", size: 15 })))),
        modal === 'chapters' && h(Modal, { title: "A whole life, one ordinary day at a time.", eyebrow: "YOUR MARRIAGE, THROUGH THE YEARS", onClose: closeModal, wide: true },
            h("p", { className: "section-intro" }, "Eight chapters, four representative days each. Dates move forward between days: you are playing meaningful snapshots, not every calendar day. The final three-day epilogue is optional."),
            h("div", { className: "chapter-timeline" }, CHAPTERS.map((c, i) => h("article", { key: c.id, className: (i === e ? 'current ' : '') + (i < e ? 'past' : '') },
                h("span", { className: "chapter-number" }, i < e ? h(Icon, { name: "check", size: 18 }) : String(i + 1).padStart(2, '0')),
                h("div", { className: "chapter-text" },
                    h("span", null,
                        c.range,
                        i === 8 ? ' · OPTIONAL EPILOGUE' : '',
                        i === e ? ' · YOU ARE HERE' : ''),
                    h("h3", null, c.name),
                    h("p", null, c.description),
                    h("small", null, i === 8 ? '3 playable days · later-life care & non-graphic loss' : `${c.years.length} playable days · ${c.years.join(' / ')}`)),
                h("span", { className: "chapter-symbol" },
                    h(Icon, { name: c.icon, size: 29 }))))),
            h("div", { className: "note" },
                h(Icon, { name: "heart" }),
                h("p", null, "Chapter wishes are optional. Children are a choice. Needing help never ends the game. A perfect housekeeping score is not the ending you are working toward."))),
        modal === 'settings' && h(Modal, { title: "Make yourself at home.", eyebrow: "PAUSED · SETTINGS & YOUR STORY", onClose: closeModal },
            h("div", { className: "menu-actions" },
                h("button", { className: "button primary small", onClick: closeModal },
                    "Back to the house",
                    h(Icon, { name: "home", size: 15 })),
                h("button", { className: "button secondary small", onClick: () => openModal('help') },
                    h(Icon, { name: "info", size: 15 }),
                    "How to play"),
                h("button", { className: "button secondary small", onClick: () => kit.menu.open() },
                    h(Icon, { name: "settings", size: 15 }),
                    "Graphics & controls")),
            h("div", { className: "settings-list" },
                h(Setting, { icon: "volume", title: "A little music", desc: "A soft, original melody. Press M to switch it on or off.", checked: prefs.sound, change: v => changePrefs('sound', v) }),
                h(Setting, { icon: "sparkles", title: "Activity chimes", desc: "A small chime when an activity, a story choice or a purchase is done.", checked: prefs.chimes, change: v => changePrefs('chimes', v) }),
                h(Setting, { icon: "leaf", title: "Reduced motion", desc: "Less movement, without changing the game.", checked: prefs.reduced, change: v => changePrefs('reduced', v) }),
                h(Setting, { icon: "clock", title: "Instant activity animations", desc: "Complete planned activities without the short visual pause. Game time costs stay the same.", checked: prefs.instant, change: v => changePrefs('instant', v) })),
            h("div", { className: "settings-section" },
                h("h3", null, "A pace that suits you."),
                h("div", { className: "segmented" },
                    h("button", { className: s.mode === 'balanced' ? 'active' : '', onClick: () => setS(v => ({ ...v, mode: 'balanced' })) }, "Everyday life"),
                    h("button", { className: s.mode === 'gentle' ? 'active' : '', onClick: () => setS(v => ({ ...v, mode: 'gentle' })) }, "A gentler pace")),
                h("p", null, "Gentle mode reduces energy costs and household wear. Stories and milestones are unchanged. Change this whenever you need.")),
            h("div", { className: "settings-section" },
                h("h3", null, "Keep a copy of your story."),
                h("p", null,
                    saved ? 'Your progress is saved automatically in this browser.' : 'This browser is not allowing local saves. Export regularly to keep your progress.',
                    " A downloaded save can move between devices."),
                h("div", { className: "button-row" },
                    h("button", { className: "button secondary", onClick: exportSave },
                        h(Icon, { name: "download", size: 17 }),
                        "Export save"),
                    h("button", { className: "button secondary", onClick: () => fileRef.current.click() },
                        h(Icon, { name: "upload", size: 17 }),
                        "Import save")),
                h("button", { className: "text-button", onClick: () => { try {
                        const b = localStorage.getItem(BACKUP);
                        if (!b)
                            throw Error('There is no previous-story backup on this device.');
                        setImported(validateSave(JSON.parse(b)));
                        setModal('import');
                    }
                    catch (err) {
                        showToast(err.message, true);
                    } } },
                    "Restore the previous-story backup",
                    h(Icon, { name: "rotate", size: 14 }))),
            h("div", { className: "settings-bottom" },
                h("span", null,
                    "Hearth & Home \u00B7 Version 0.10",
                    h("br", null),
                    "No accounts. No tracking. No paid features."),
                h("button", { className: "button secondary small", onClick: () => setModal('new') },
                    "Begin a new story",
                    h(Icon, { name: "key", size: 15 }))),
            h("p", { className: "footnote" }, `Rendering with three.js r186 on ${kit.backendLabel}. F9 opens graphics and controls at any time.`)),
        modal === 'new' && h(Modal, { title: "Whose little life is this?", eyebrow: "A NEW STORY \u00B7 SPRING 1952", onClose: () => setModal('settings') },
            h("p", { className: "section-intro" }, "You are newly married, the keys are in your hand, and the role of homemaker is yours to shape. Names do not determine roles or story choices."),
            h("div", { className: "new-profile" },
                h(Portrait, { name: newNames.name, skin: newNames.skin, apron: true }),
                h("div", { className: "form-grid" },
                    h("label", null,
                        "Your name",
                        h("input", { value: newNames.name, maxLength: 22, onChange: e => setNewNames(v => ({ ...v, name: e.target.value })) })),
                    h("label", null,
                        "Your partner\u2019s name",
                        h("input", { value: newNames.partner, maxLength: 22, onChange: e => setNewNames(v => ({ ...v, partner: e.target.value })) })),
                    h("label", { className: "full-field" },
                        "The household name",
                        h("input", { value: newNames.surname, maxLength: 22, onChange: e => setNewNames(v => ({ ...v, surname: e.target.value })) })))),
            h("div", { className: "skin-choices" },
                h("span", null, "Your character"),
                ['#efc29c', '#d5a078', '#bd835e', '#936245', '#644833'].map(c => h("button", { key: c, onClick: () => setNewNames(v => ({ ...v, skin: c })), "aria-label": `Choose character skin color ${c}`, "aria-pressed": newNames.skin === c, style: { background: c } }, newNames.skin === c && h(Icon, { name: "check", size: 16 })))),
            h("div", { className: "settings-section" },
                h("h3", null, "How would you like to play?"),
                h("div", { className: "segmented" },
                    h("button", { className: newNames.mode === 'balanced' ? 'active' : '', onClick: () => setNewNames(v => ({ ...v, mode: 'balanced' })) }, "Everyday life"),
                    h("button", { className: newNames.mode === 'gentle' ? 'active' : '', onClick: () => setNewNames(v => ({ ...v, mode: 'gentle' })) }, "A gentler pace"))),
            h("div", { className: "note" },
                h(Icon, { name: "save" }),
                h("p", null, "Your current story will be kept as a local backup. Export it first for a permanent copy.")),
            h("button", { className: "button primary full", disabled: !newNames.name.trim() || !newNames.partner.trim() || !newNames.surname.trim(), onClick: () => { backup(); setQueue([]); setS(createState(newNames)); setModal(null); resetView(); showToast('The keys are yours. A whole life ahead.'); } },
                "Take the keys",
                h(Icon, { name: "key", size: 18 }))),
        modal === 'import' && imported && h(Modal, { title: "Open another chapter of your life?", eyebrow: "IMPORT YOUR SAVED STORY", onClose: () => { setImported(null); setModal('settings'); } },
            h("div", { className: "import-preview" },
                h(Portrait, { name: imported.profile.name, skin: imported.profile.skin, apron: true, old: age(imported) > 62 }),
                h("div", null,
                    h("h3", null,
                        imported.profile.name,
                        " & ",
                        imported.profile.partner),
                    h("p", null,
                        season(imported),
                        " ",
                        year(imported),
                        " \u00B7 ",
                        chapter(imported).name),
                    h("span", null,
                        imported.memories.length,
                        " memories \u00B7 ",
                        money(imported.cash),
                        " in the household pot"))),
            h("p", { className: "section-intro" }, "This replaces the story currently open. The current story will be saved as a local backup first."),
            h("div", { className: "button-row" },
                h("button", { className: "button secondary", onClick: () => { setImported(null); setModal('settings'); } }, "Keep this story open"),
                h("button", { className: "button primary", onClick: () => { backup(); setQueue([]); setS(imported); setImported(null); setModal(null); showToast('Your story is right where you left it.'); } },
                    "Open saved story",
                    h(Icon, { name: "book", size: 16 })))),
        modal === 'help' && h(Modal, { title: "Make a home. Keep a little life for yourself.", eyebrow: "WELCOME TO HEARTH & HOME", onClose: closeModal, wide: true },
            h("div", { className: "help-hero" },
                h(Icon, { name: "home", size: 42 }),
                h("p", null, "A life-management game about the real work of making a home, and the people \u2014 including you \u2014 who live inside it.")),
            h("div", { className: "help-grid" },
                h("section", null,
                    h("span", null, "01"),
                    h("h3", null, "Choose the ordinary things."),
                    h("p", null,
                        source === 'gamepad' ? h(Fragment, null, "Press ", h("kbd", null, "LT"), " or ", h("kbd", null, "RT"), " to open the activities, move with the D-pad and press ", h("kbd", null, "A"), ". ") : source === 'touch' ? "Tap a room or an activity button below the house. " : h(Fragment, null, "Click a room, use an activity button below the house, or press ", h("kbd", null, "1"), "\u2013", h("kbd", null, "6"), ". "),
                        "Add up to four activities to your plan. Every activity shows its minutes, energy, ingredients, and money costs.")),
                h("section", null,
                    h("span", null, "02"),
                    h("h3", null, "Nothing is quietly running away."),
                    h("p", null,
                        "You have 480 game minutes for each representative day. Needs change only when activities happen or you turn the page \u2014 not while you read, browse, or leave the game. ",
                        source === 'touch' ? 'The Pause button' : h("kbd", null, source === 'gamepad' ? 'X' : 'Space'),
                        " pauses the activity plan.")),
                h("section", null,
                    h("span", null, "03"),
                    h("h3", null, "Share the work. Take the rest."),
                    h("p", null, "\u201CShare\u201D uses one helping hand and only 15 of your minutes. Agree on fairer routines, use useful tools, or ask your circle. Tea and a sit-down restores energy for free. No one earns the right to rest by finishing everything.")),
                h("section", null,
                    h("span", null, "04"),
                    h("h3", null, "Turn the page, not every calendar day."),
                    h("p", null, "Open the day\u2019s story letter before ending the day. Settle income and bills, then move to the next snapshot. Four days make an era; eight eras reach your golden anniversary. The family ages and the home changes between snapshots.")),
                h("section", null,
                    h("span", null, "05"),
                    h("h3", null, "More is not always easier."),
                    h("p", null, "Rooms, appliances, and possessions increase upkeep and clutter. The home wears down and machines can need repair. Groceries refill the pantry. Savings cover lean days; a repayable community advance prevents money dead ends.")),
                h("section", null,
                    h("span", null, "06"),
                    h("h3", null, "There is no perfect homemaker ending."),
                    h("p", null, "Chapter wishes are optional. Choose parenthood or a child-free life, protect your own interests, and keep your friendships. Your ending remembers companionship, care, community, and personal joy \u2014 not spotless floors.")),
                h("section", null,
                    h("span", null, "07"),
                    h("h3", null, "Keep the seasons."),
                    h("p", null, "Each season brings one small tradition: spring bulbs, a summer picnic, autumn preserves, winter festivities. A dot on an activity button means one is waiting today. They leave their mark on the house, and the first of each goes in the album.")),
                h("section", null,
                    h("span", null, "08"),
                    h("h3", null, "Someone to walk with."),
                    h("p", null, "From 1956, a family dog can join you from Home improvements. Biscuit follows you from room to room and asks for a daily walk, which you can share like any other chore."))),
            h("div", { className: "help-footer" },
                h(ControlsHelp, { source }),
                h("button", { className: "button primary", onClick: closeModal },
                    "Back to our little home",
                    h(Icon, { name: "arrow", size: 17 }))),
            h("p", { className: "historical-note" }, "A stylized, fictional neighborhood beginning in the 1950s. Currency, prices, life transitions, and representative-day budgets are gameplay abstractions, not historical statistics. This is one chosen homemaking story, not a claim about what every family or gender should be. Optional later-life loss is clearly signposted and can be skipped.")),
        h("input", { ref: fileRef, type: "file", accept: "application/json,.json", className: "file-input", onChange: importFile, "aria-label": "Import a saved Hearth and Home story" }),
        h("div", { className: "toast-area", role: "status", "aria-live": "polite" }, toast && h("div", { className: 'toast ' + (toast.bad ? 'bad' : ''), key: toast.id },
            h(Icon, { name: toast.bad ? 'info' : 'leaf', size: 18 }),
            h("span", null, toast.text))));
}
const CONTROLS = {
    keyboard: [['1\u20136', 'Activities'], ['Space', 'Play or pause the plan'], ['N', 'End the day'], ['Q / E', 'Turn the house'], ['+ / \u2212', 'Zoom'], ['C', 'Walls'], ['R', 'Reset view'], ['M', 'Music'], ['H', 'Help'], ['Esc', 'Close, or the menu'], ['F9', 'Graphics']],
    gamepad: [['LT / RT', 'Activities'], ['D-pad', 'Move between buttons'], ['A', 'Choose'], ['B', 'Back'], ['X', 'Play or pause the plan'], ['Y', 'End the day'], ['Right stick', 'Turn the house'], ['LB / RB', 'Zoom'], ['LS click', 'Walls'], ['RS click', 'Reset view'], ['Select', 'Help'], ['Start', 'The menu']],
    touch: [['Tap', 'A room or a button'], ['Drag', 'Turn the house'], ['Pinch', 'Zoom'], ['Settings', 'The menu']],
};
/** The controls for whichever device the player is using right now. */
function ControlsHelp({ source }) { const list = CONTROLS[source] || CONTROLS.keyboard; return h("div", { className: "controls-help" },
    h(Icon, { name: source === 'gamepad' ? 'gamepad' : source === 'touch' ? 'touch' : 'keyboard', size: 18 }),
    list.map(([k, t]) => h("span", { key: k },
        h("kbd", null, k),
        " ",
        t))); }
function Setting({ icon, title, desc, checked, change }) { return h("label", { className: "setting-row" },
    h("span", { className: "setting-icon" },
        h(Icon, { name: icon, size: 21 })),
    h("span", null,
        h("strong", null, title),
        h("small", null, desc)),
    h("input", { type: "checkbox", checked: checked, onChange: e => change(e.target.checked) }),
    h("i", { className: "switch" })); }
function BudgetView({ s, apply }) { const b = budget(s); return h(Fragment, null,
    h("div", { className: "budget-cards" },
        h("div", { className: "budget-total" },
            h(Icon, { name: "coin", size: 29 }),
            h("small", null, "IN THE HOUSEHOLD POT"),
            h("strong", null, money(s.cash)),
            h("span", null, "Groceries, little improvements, everyday life.")),
        h("div", { className: "budget-total savings" },
            h(Icon, { name: "jar", size: 29 }),
            h("small", null, "SET ASIDE FOR A RAINY DAY"),
            h("strong", null, money(s.savings)),
            h("span", null, s.debt ? `${money(s.debt)} of community advances to repay.` : 'A little breathing room for the unexpected.'))),
    h("div", { className: "budget-columns" },
        h("section", null,
            h("h3", null, "The next evening\u2019s household book"),
            h("p", { className: "muted" }, "Settled when you end this representative day."),
            h("div", { className: "ledger" },
                h("div", { className: "income" },
                    h("span", null, eraIndex(s) >= 6 ? 'Pension & household income' : 'Household income'),
                    h("b", null,
                        "+",
                        money(b.gross))),
                [['The house', b.housing], ['Utilities & heating', b.utilities], ['Children at home', b.children], ['Elder care', b.elder], ['Possessions & regular help', b.upkeep], ['Urgent maintenance', b.repairs], ['Community advance repayment', b.repayment], ['Household-book savings', -b.discount]].filter(([, n]) => n !== 0).map(([t, n]) => h("div", { key: t },
                    h("span", null, t),
                    h("b", null,
                        n < 0 ? '+' : '−',
                        money(Math.abs(n))))),
                h("div", { className: "ledger-total" },
                    h("span", null, "Income less bills"),
                    h("b", { className: b.net < 0 ? 'warning' : 'positive' },
                        b.net >= 0 ? '+' : '',
                        money(b.net))))),
        h("section", { className: "savings-controls" },
            h("h3", null, "Give tomorrow a little room."),
            h("p", null, "Move money between the household pot and your savings. Saved money earns 3% when a new main chapter begins."),
            h("label", null, "Set some money aside"),
            h("div", { className: "button-row" }, [25, 50, 100].map(n => h("button", { className: "button secondary small", key: n, disabled: s.cash < n, onClick: () => apply(transfer(s, n)) },
                money(n),
                h(Icon, { name: "arrow", size: 13 })))),
            h("label", null, "Use the rainy-day money"),
            h("div", { className: "button-row" }, [25, 50, 100].map(n => h("button", { className: "button secondary small", key: n, disabled: s.savings < n, onClick: () => apply(transfer(s, -n)) },
                money(n),
                h(Icon, { name: "jar", size: 13 })))),
            h("div", { className: "note" },
                h(Icon, { name: "hands" }),
                h("p", null, "After bills, a cash balance below $45 triggers a small community advance, restored to $100. It is repaid at $15 per day. There is no bankruptcy game over.")))),
    h("p", { className: "historical-note" }, "All dollar amounts are balanced game units, not period-accurate prices or personal financial advice. Purchases and groceries are separate from the regular bills shown here.")); }
