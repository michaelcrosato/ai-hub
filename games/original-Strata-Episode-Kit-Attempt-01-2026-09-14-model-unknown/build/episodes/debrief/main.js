import { connectEpisode, downloadText } from '../../kit/browser.js';
const el = (id) => document.getElementById(id);
try {
    const { session, scope } = await connectEpisode('debrief', new URL('../../campaign.json', location.href), text => { el('status').textContent = text; });
    const data = session.shared;
    const lines = [data['yard-cleared'] === true ? 'Loading bay cleared.' : 'Loading bay was not completed in this run.', data['road-clear'] === true ? `Road complete. Car integrity: ${String(data['car-integrity'])}.` : 'Road was not completed in this run.', data['drive-seconds'] !== undefined ? `Driving time: ${String(data['drive-seconds'])} seconds. Impacts: ${String(data['drive-collisions'])}.` : 'Open either episode directly to test it on its own.'];
    for (const text of lines) {
        const p = document.createElement('p');
        p.textContent = text;
        el('summary').append(p);
    }
    el('state').textContent = JSON.stringify(data, null, 2);
    el('status').textContent = `Contract v1 / revision ${session.snapshot.revision}`;
    el('again').disabled = false;
    el('export').disabled = false;
    scope.listen(el('again'), 'click', () => { try {
        session.complete('again');
    }
    catch (error) {
        el('status').textContent = String(error);
    } });
    scope.listen(el('export'), 'click', () => downloadText('strata-run.json', session.export()));
    if (new URL(location.href).searchParams.has('test'))
        Object.assign(window, { strataTest: { session } });
}
catch (error) {
    el('status').textContent = `Run could not be read: ${String(error)}`;
}
