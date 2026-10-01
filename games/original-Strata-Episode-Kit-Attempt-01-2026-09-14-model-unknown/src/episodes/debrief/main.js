import { Scope } from '../../campaign/scope.js';
import { downloadText } from '../../campaign/store.js';
import { applyScheme, menuScheme } from '../../schemes.js';
import { formatTime } from '../../records.js';

const $ = id => document.getElementById(id);

/**
 * 04 / The Handoff. This episode builds no scene of its own and steps no physics: it reads
 * the same small contract as the 3D episodes and reports what crossed it. The page keeps
 * drawing the shell's backdrop behind it.
 */
export async function create(ctx) {
    const { kit, session, nav, sound } = ctx;
    const scope = new Scope();
    const data = session.shared;
    const status = $('debrief-status');
    applyScheme(kit, menuScheme());
    kit.touch?.suspend(true, 'strata-menu');
    scope.own(() => kit.touch?.suspend(false, 'strata-menu'));
    void ctx.backdrop.use('breakwater', { lit: data['beacon-lit'] === true }).catch(error => console.error(error));

    const seconds = (v) => typeof v === 'number' && Number.isFinite(v) ? formatTime(v) : null;
    const lines = [
        data['yard-cleared'] === true
            ? `Loading bay cleared${seconds(data['yard-seconds']) ? ` in ${seconds(data['yard-seconds'])}` : ''}. Sentries defeated: ${String(data['sentries-defeated'] ?? '?')}.`
            : 'Loading bay was not completed in this run.',
        data['road-clear'] === true
            ? `Road complete${seconds(data['drive-seconds']) ? ` in ${seconds(data['drive-seconds'])}` : ''}. Car integrity: ${String(data['car-integrity'])}. Impacts: ${String(data['drive-collisions'])}.`
            : 'Road was not completed in this run.',
        data['beacon-lit'] === true
            ? `Breakwater beacon lit${seconds(data['breakwater-seconds']) ? ` in ${seconds(data['breakwater-seconds'])}` : ''}. Lamp sentries put out: ${String(data['lamps-defeated'] ?? 0)} of 3.`
            : 'The breakwater beacon was not lit in this run.',
        data['yard-cleared'] === true && data['road-clear'] === true && data['beacon-lit'] === true
            ? 'Every episode handed its result on. The story is complete.'
            : 'Open any episode from the collection to play it on its own.',
    ];
    const summary = $('debrief-summary');
    summary.textContent = '';
    for (const text of lines) {
        const p = document.createElement('p');
        p.textContent = text;
        summary.append(p);
    }
    $('debrief-state').textContent = JSON.stringify(data, null, 2);
    status.textContent = `Contract v1 / revision ${session.snapshot.revision}`;
    $('debrief').hidden = false;
    $('debrief-again').disabled = false;
    $('debrief-export').disabled = false;
    scope.own(() => {
        $('debrief').hidden = true;
        nav.set(null);
    });
    scope.listen($('debrief-again'), 'click', () => {
        sound.cue('confirm');
        try {
            session.complete('again');
        }
        catch (error) {
            status.textContent = String(error.message ?? error);
        }
    });
    scope.listen($('debrief-export'), 'click', () => downloadText('strata-run.json', session.export()));
    scope.listen($('debrief-portal'), 'click', () => ctx.toPortal());
    scope.listen($('debrief-new'), 'click', () => ctx.newRun());
    nav.set($('debrief'), { focus: $('debrief-again'), onBack: () => ctx.toPortal() });
    if (new URL(location.href).searchParams.has('test'))
        Object.assign(window, { strataTest: { session } });
    return {
        id: 'debrief',
        frame: (dt) => ctx.backdrop.frame(dt),
        save: () => true,
        dispose: () => scope.dispose(),
    };
}
