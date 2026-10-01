import { boot } from 'kit/boot.js';
import { Game, emptyInput } from './game.js';
import { other } from './math.js';
import { RapierPhysics } from './physics.js';
import { ArenaRenderer } from './render.js';
import { ArcadeAudio } from './audio.js';
import { UI, loadSettings, CAMERA_NAMES } from './ui.js';
import { ACTIONS, Controls } from './controls.js';
import { MenuNav } from './nav.js';
import { BrickCup } from './cup.js';
import { VENUE_ORDER, venueOf } from './art.js';

const STEP = 1 / 60;
const CAMERA_CYCLE = ['broadcast', 'wide', 'follow'];
/** Phases a press of Shoot / Enter (and A, except right after a goal) skips. */
const SKIPPABLE = new Set(['intermission', 'goal', 'replay', 'shootout-intro']);
/** Phases where Tab switches skaters; elsewhere it moves focus through the menus. */
const PLAYING = new Set(['faceoff', 'live', 'stoppage', 'goal', 'replay', 'duel', 'duel-result', 'shootout-intro']);

/** Top-row touch pills sit just under the scorebug at each layout breakpoint. */
const pillTop = () => (innerWidth <= 560 || (innerHeight <= 620 && innerWidth > 560) ? 73 : innerWidth <= 850 ? 81 : 101);

let booted = false;
async function main() {
    const root = document.querySelector('#app'), arena = document.querySelector('#arena');
    const settings = loadSettings();
    const kit = await boot({
        title: 'SLAPSHOT — Brick League',
        physics: true,
        mount: arena,
        gear: 'none', // the game's Settings screen has a Graphics & display button (and F9 works)
        accent: '#ff5745',
        background: '#173746',
        input: ACTIONS,
        touch: { top: 'center', topOffset: pillTop(), theme: 'light' },
    });
    booted = true;
    kit.loading.progress(.7, 'Building the arena…');

    const cup = new BrickCup();
    const game = new Game(new RapierPhysics(kit.RAPIER));
    game.settings = { ...settings, venue: settings.mode === 'cup' ? cup.venue : settings.venue };
    const audio = new ArcadeAudio();
    audio.settings(settings);
    const controls = new Controls(kit);
    const nav = new MenuNav(kit.input);
    const renderer = new ArenaRenderer(kit, game);

    const startMatch = () => {
        const match = { ...settings };
        if (settings.mode === 'cup') {
            if (cup.over)
                cup.reset();
            match.venue = cup.venue;
        }
        controls.discard();
        kit.input.settle();
        game.start(match);
        audio.unlock();
        audio.settings(settings);
        document.activeElement?.blur?.();
        ui.updateSettings();
        ui.update();
    };
    const toAttract = () => {
        controls.discard();
        game.start({ ...settings, venue: ui.nextVenue });
        game.phase = 'attract';
        game.paused = false;
        game.carrier = game.skatingPlayers(0)[0].id;
        game.bannerTime = 0;
        ui.updateSettings();
        ui.update();
    };
    const ui = new UI(root, game, settings, {
        play: startMatch,
        quit: toAttract,
        sound: () => {
            const enabled = !(settings.sound || settings.music);
            settings.sound = enabled;
            settings.music = enabled;
            audio.settings(settings);
            audio.unlock();
            game.settings.sound = enabled;
            game.settings.music = enabled;
        },
        settings: () => {
            audio.settings(settings);
            for (const field of ['sound', 'music', 'shake', 'camera'])
                game.settings[field] = settings[field];
            if (game.phase === 'attract')
                game.settings = { ...settings, venue: ui.nextVenue };
        },
        venue: () => {
            if (settings.mode === 'cup') {
                kit.toast(`The Brick Cup sets home ice: game ${cup.gameNumber} is at ${venueOf(cup.venue).title}.`);
                return;
            }
            settings.venue = VENUE_ORDER[(VENUE_ORDER.indexOf(settings.venue) + 1) % VENUE_ORDER.length];
            ui.updateSettings();
            ui.actions.settings();
            ui.announce(`Venue: ${venueOf(settings.venue).title}`);
        },
        fullscreen: () => {
            const promise = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
            promise?.catch?.(() => ui.announce('Fullscreen is not available in this browser.'));
        },
        skip: () => {
            game.skip();
            controls.discard();
        },
        modal: (open) => {
            controls.discard();
            if (!open)
                kit.input.settle();
        },
    }, { kit, cup });

    // Rumble on the right controller: player 1 on the kit's pad, player 2 on the second pad.
    const rumbleFor = (team, strength, ms) => {
        if (team === undefined || team === null || !game.isHuman(team))
            return;
        if (team === game.settings.team)
            kit.input.rumble(strength, ms);
        else if (kit.settings.get().vibration !== false)
            controls.pad2?.pad.vibrationActuator?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: strength, weakMagnitude: Math.min(1, strength * 1.2) }).catch(() => { });
    };
    game.onEvent = event => {
        if (game.phase !== 'attract')
            audio.play(event);
        if (event.kind === 'hit') {
            rumbleFor(event.team, .45, 110);
            rumbleFor(other(event.team), .85, 220);
        }
        else if (event.kind === 'goal' && game.phase !== 'attract')
            rumbleFor(event.team, .9, 380);
        else if (event.kind === 'power')
            rumbleFor(event.team, .7, 320);
        else if (event.kind === 'post' && game.phase !== 'attract')
            kit.input.rumble(.25, 80);
        if (['goal', 'whistle', 'period', 'finish', 'power'].includes(event.kind))
            ui.announce(`${event.text} ${event.detail ?? ''}`);
        if (event.kind === 'finish') {
            const clinched = game.settings.mode === 'cup' && cup.record(event.team, game.score, { so: game.shootout[0].length > 0, ot: game.overtime });
            ui.recordResult(clinched);
            if (clinched)
                audio.play({ kind: 'cup' });
        }
    };

    // Sound starts on the first touch, click or key (browsers require a gesture), and pauses with the game.
    const unlock = () => audio.unlock();
    for (const type of ['pointerdown', 'keydown', 'touchend'])
        addEventListener(type, unlock, true);
    kit.onPause(paused => audio.hold(paused || document.hidden));
    document.addEventListener('visibilitychange', () => {
        audio.hold(document.hidden || kit.paused);
        if (document.hidden && game.phase !== 'attract' && game.phase !== 'final' && !ui.modal)
            ui.open('pause');
    });
    // Tab switches skaters only during play; in menus it stays the browser's focus key. Stopping it
    // at the document (after the dialog's own focus trap ran) keeps it away from kit.input on window.
    document.addEventListener('keydown', e => {
        if (e.code === 'Tab' && (ui.modal || !PLAYING.has(game.phase)))
            e.stopPropagation();
    });
    kit.input.onSourceChange(source => ui.setSource(source));
    kit.onResize(() => kit.touch?.placeTop('center', pillTop()));

    const pauseKey = () => {
        if (ui.modal)
            ui.modal === 'pause' ? ui.close() : ui.back();
        else
            ui.action('pause');
    };
    const cycleCamera = () => {
        settings.camera = CAMERA_CYCLE[(CAMERA_CYCLE.indexOf(settings.camera) + 1) % CAMERA_CYCLE.length];
        game.settings.camera = settings.camera;
        ui.updateSettings();
        if (ui.modal === 'settings')
            ui.renderModal();
        kit.toast(`Camera: ${CAMERA_NAMES[settings.camera]}`);
    };
    const navRoots = () => {
        if (ui.modal)
            return [ui.el.modal];
        if (game.phase === 'final' || game.phase === 'intermission')
            return [ui.el.overlay];
        if (game.phase === 'attract')
            return [ui.el.topbar, ui.el.home];
        return null;
    };

    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const idle = [emptyInput(), emptyInput()];
    let accumulator = 0, uiClock = 0, lastPhase = '', manual = false, shakeCss = '', touchHidden = null;
    const frame = (dt, t) => {
        const input = kit.input;
        controls.readPad2();
        // Menu and match-flow keys first; a press they use is not also played.
        let used = false;
        if (input.pressed('pause') || controls.pad2Pause) {
            pauseKey();
            used = true;
        }
        if (input.pressed('help')) {
            if (!ui.modal)
                ui.open('help');
            else if (ui.modal === 'help')
                ui.back();
            used = true;
        }
        if (input.pressed('camera'))
            cycleCamera();
        const roots = navRoots();
        let okUnused = false;
        if (roots) {
            const r = nav.update(roots, t);
            okUnused = r.ok;
            if (input.pressed('ok'))
                used = true;
            if (r.back && ui.modal) {
                pauseKey();
                used = true;
            }
        }
        if (!ui.modal) {
            const shoot = input.pressed('shoot') || input.pressed('shoot2');
            if (game.phase === 'attract' && (shoot || okUnused)) {
                startMatch();
                used = true;
            }
            else if (SKIPPABLE.has(game.phase) && (shoot || okUnused || (!roots && game.phase !== 'goal' && input.pressed('ok')))) {
                game.skip();
                used = true;
            }
            else if (okUnused)
                nav.move(roots, 'down'); // nothing focused yet: A lands on the main button first
        }
        else if (okUnused)
            nav.move(roots, 'down');
        controls.gather(game, !used);

        // Fixed 60 Hz simulation.
        accumulator += dt;
        const blocked = !!ui.modal || game.paused;
        if (blocked)
            controls.discard();
        for (let step = 0; accumulator >= STEP && step < 7; step++) {
            if (!manual)
                game.update(STEP, blocked ? idle : controls.consume(game, kit.size.width, kit.size.height));
            accumulator -= STEP;
        }
        accumulator = Math.max(0, Math.min(accumulator, STEP));

        const shake = settings.shake && !reducedMotion.matches && !ui.modal ? game.impact : 0;
        const css = shake > 0 ? `translate(${(Math.sin(t * 70) * shake * 5).toFixed(2)}px,${(Math.cos(t * 59) * shake * 3).toFixed(2)}px)` : '';
        if (css !== shakeCss) {
            shakeCss = css;
            arena.style.transform = css;
        }
        renderer.render(game, dt, t);
        audio.tick(dt, game.phase !== 'attract');
        uiClock += dt;
        if (uiClock >= .075 || game.phase !== lastPhase) {
            ui.update();
            uiClock = 0;
            lastPhase = game.phase;
        }
        // On-screen controls only while skating; menus and the home screen get the whole screen.
        const hide = !!ui.modal || game.phase === 'attract' || game.phase === 'intermission' || game.phase === 'final';
        if (hide !== touchHidden) {
            touchHidden = hide;
            kit.touch?.suspend(hide, 'game');
        }
    };

    ui.update();
    kit.loading.progress(.85, 'Lacing up…');
    await renderer.warm(game);
    kit.start(frame);

    // Inspectable test/debug interface. No telemetry, server, or hidden network calls.
    Object.assign(window, { __SLAPSHOT__: {
            game, ui, controls, audio, cup, kit, get renderer() { return kit.backendLabel; },
            manual: (enabled = true) => { manual = enabled; },
            step: (seconds, inputs = [emptyInput(), emptyInput()]) => {
                for (let i = 0; i < Math.ceil(Math.max(0, Math.min(seconds, 3600)) * 60); i++)
                    game.update(STEP, inputs);
                ui.update();
            }
        } });
}

main().catch(error => {
    console.error(error);
    // boot() shows its own card when graphics cannot start; anything after that gets the game's.
    if (!booted)
        return;
    const message = document.createElement('section');
    message.className = 'fatal-error';
    const heading = document.createElement('h1');
    heading.textContent = 'TIME OUT.';
    const text = document.createElement('p');
    text.textContent = 'The game could not start. Reload the page, or try a current Chrome, Edge, Safari or Firefox.';
    const detail = document.createElement('pre');
    detail.textContent = error instanceof Error ? error.message : String(error);
    message.append(heading, text, detail);
    document.body.replaceChildren(message);
});
