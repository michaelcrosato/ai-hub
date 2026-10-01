import { createFpsEpisode } from '../../fps/FpsEpisode.js';
import { glyph } from '../../schemes.js';
import { keysLabel } from '../../prefs.js';
import { registerYardArt, yardLevel } from './level.js';
import { YardSentries } from './local-ai.js';

/** 01 / Loading Bay: clear three sentries, open the north gate, board the car. */
export function create(ctx) {
    let sentries = null;
    return createFpsEpisode(ctx, {
        id: 'yard',
        eyebrow: '01 / First person',
        title: 'Loading Bay',
        menuEyebrow: 'Independent episode / FPS starter',
        intro: 'Clear the sentries. Use cover. Leave through the north gate and board the car. The next episode owns its driving rules.',
        note: 'A checkpoint saves sentry defeats, vitals, ammo and time. Re-entering starts at the safe player start, not at an arbitrary physics pose.',
        playLabel: 'Enter loading bay',
        countLabel: 'Sentries',
        respawnNotice: 'Returned to the safe start. Sentry defeats remain.',
        level: yardLevel,
        configure: ({ prefabs, behaviors }, api) => {
            registerYardArt(prefabs);
            behaviors.register('board-car', () => { }, () => ({
                prompt: () => sentries?.remaining === 0 ? 'Board car / take the Coast Road' : 'Clear all sentries first',
                interact: () => {
                    if (sentries?.remaining !== 0) {
                        api.notice('Clear all sentries before leaving.');
                        return;
                    }
                    api.sound.cue('door');
                    api.finish({
                        exit: 'drive',
                        title: 'Loading Bay cleared',
                        label: 'Continue to the Coast Road',
                        lines: [`Sentries defeated　${sentries.defeated.size} of ${sentries.actors.size}`],
                        shared: { 'yard-cleared': true, health: api.vitals.health, 'sentries-defeated': sentries.defeated.size, 'yard-accuracy': api.stats.shots ? Math.round(api.stats.hits / api.stats.shots * 100) : 0 },
                    });
                },
            }));
        },
        setup: (api, saved) => {
            const defeated = Array.isArray(saved.defeated) ? saved.defeated.filter((v) => typeof v === 'string') : [];
            sentries = new YardSentries(api, defeated);
            return {
                hit: (id, damage) => sentries.hit(id, damage),
                step: dt => sentries.step(dt),
                render: dt => sentries.render(dt),
                countText: () => String(sentries.remaining),
                objective: () => {
                    const use = glyph(api.kit.input.source, 'interact', keysLabel(api.prefs.bindings.interact));
                    return sentries.remaining === 0
                        ? `Gate open. Reach the car. ${use} to take the Coast Road.`
                        : `Clear ${sentries.remaining === 3 ? 'three' : sentries.remaining === 2 ? 'two' : 'the last'} sentr${sentries.remaining === 1 ? 'y' : 'ies'}. Reach the car. ${use} to drive.`;
                },
                snapshot: () => ({ defeated: [...sentries.defeated] }),
            };
        },
    });
}
