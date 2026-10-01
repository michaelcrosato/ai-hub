import { createFpsEpisode } from '../../fps/FpsEpisode.js';
import { glyph } from '../../schemes.js';
import { keysLabel } from '../../prefs.js';
import { breakwaterLevel, registerBreakwaterArt } from './level.js';
import { BeaconBeam, LampSentries, Surf } from './local-ai.js';

const CELLS = ['cell-container', 'cell-causeway', 'cell-crane'];
const LAMPS = 3;

/**
 * 03 / Breakwater Light. A first-person episode built from the starter's own blocks:
 * pickups feed a counter that powers the lift, a one-way beacon switch feeds a relay that
 * opens the jetty gate, and the boarding gate is the exit. The lamp sentries, the timed
 * surf and the beacon itself are this episode's local rules.
 */
export function create(ctx) {
    let lit = false, power = false, dock = false, mute = 0;
    let lamps = null, surf = null, beam = null, api = null;
    const cellsTaken = () => CELLS.filter(id => api.game.runtime.behavior(id, 'collected')?.collected).length;
    return createFpsEpisode(ctx, {
        id: 'breakwater',
        eyebrow: '03 / First person',
        title: 'Breakwater Light',
        menuEyebrow: 'New episode / FPS starter signal blocks',
        intro: 'The coast road ends at the harbor. Power the lighthouse lift with three signal cells, light the beacon on the roof, and board the launch at the end of the jetty. Lamp sentries only see what their lamps light.',
        note: 'A checkpoint saves collected cells, the beacon, lamp sentry defeats, vitals, ammo and the last checkpoint you touched.',
        playLabel: 'Enter the harbor',
        countLabel: 'Cells',
        respawnNotice: 'Returned to the last checkpoint. Cells and the beacon stay as they are.',
        followShadow: true,
        shadowExtent: 30,
        level: breakwaterLevel,
        configure: ({ prefabs, behaviors }, a) => {
            api = a;
            registerBreakwaterArt(prefabs);
            // A one-way switch: once the beacon burns it stays lit (the starter's switch toggles).
            behaviors.register('beacon-switch', () => { }, (e, d, rctx) => {
                const light = (quietly = false) => {
                    if (lit)
                        return;
                    lit = true;
                    rctx.signals.send('lamp', true, e.data.id);
                    beam?.light();
                    if (!quietly) {
                        rctx.notify('The beacon is lit. The jetty gate opens in a moment.');
                        api.sound.cue('beacon');
                        api.rumble(.5, 220);
                    }
                };
                return { prompt: () => lit ? 'The beacon is lit' : 'Light the beacon', interact: () => light(), light, get lit() { return lit; } };
            });
        },
        setup: (a, saved) => {
            const game = a.game;
            game.view.decorative.position.set(0, 0, -26);
            const defeated = Array.isArray(saved.defeated) ? saved.defeated.filter(v => typeof v === 'string') : [];
            lamps = new LampSentries(a, defeated);
            surf = new Surf(game, ['surf-1', 'surf-2', 'surf-3', 'surf-4']);
            beam = new BeaconBeam(game.runtime.physics.entities.get('beacon')?.root);
            const rt = game.runtime;
            rt.signals.on('power', s => { power = !!s.value; });
            rt.signals.on('dock', s => {
                dock = !!s.value;
                if (dock && mute === 0)
                    a.notice('Jetty gate open. Walk through the boarding gate.');
            });
            // Replay the checkpoint through the same signals the player would have sent.
            const cells = Array.isArray(saved.cells) ? saved.cells.filter(id => CELLS.includes(id)) : [];
            if (cells.length || saved.lit === true) {
                mute = 3;
                a.quietly(() => {
                    for (const id of cells)
                        rt.behavior(id, 'collect')?.collect(true);
                    if (saved.lit === true)
                        rt.behavior('beacon-switch', 'light')?.light(true);
                });
            }
            return {
                hit: (id, damage) => lamps.hit(id, damage),
                step: dt => {
                    if (mute > 0)
                        mute--;
                    lamps.step(dt);
                    surf.step(dt);
                },
                render: dt => {
                    lamps.render(dt);
                    surf.render();
                    beam.render(dt);
                },
                /** Mute the starter's sounds while a restored checkpoint replays its signals. */
                event: (type) => {
                    if (mute > 0)
                        return false;
                    if (type === 'mover')
                        a.notice('Three cells in. The service lift by the tower is running.');
                    return true;
                },
                prewarm: on => { lamps.prewarm(on); beam.prewarm(on); },
                complete: () => a.finish({
                    exit: 'handoff',
                    title: 'Breakwater Light is burning',
                    label: 'Continue to the handoff',
                    lines: [`Lamp sentries put out　${lamps.defeated.size} of ${LAMPS}`],
                    shared: { 'beacon-lit': true, 'breakwater-health': a.vitals.health, 'lamps-defeated': lamps.defeated.size },
                }),
                countText: () => `${cellsTaken()} / 3`,
                objective: () => {
                    const use = glyph(a.kit.input.source, 'interact', keysLabel(a.prefs.bindings.interact));
                    if (dock)
                        return 'Jetty gate open. Walk through the boarding gate at the end of the jetty.';
                    if (lit)
                        return 'Beacon lit. The jetty gate is opening…';
                    if (power)
                        return `Lift running. Ride it to the lamp room roof and ${use} to light the beacon.`;
                    const n = cellsTaken();
                    return `Collect signal cells (${n} of 3) to power the lighthouse lift. One is on a container; one is on the crane deck.`;
                },
                snapshot: () => ({ defeated: [...lamps.defeated], cells: CELLS.filter(id => rt.behavior(id, 'collected')?.collected), lit }),
                dispose: () => {
                    lamps.dispose();
                    surf.dispose();
                    beam.dispose();
                },
            };
        },
    });
}
