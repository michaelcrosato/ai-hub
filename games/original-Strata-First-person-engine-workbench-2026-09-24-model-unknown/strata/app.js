import { boot } from 'kit/boot.js';
import { Engine } from './engine/Engine.js';
import { actionDefs } from './engine/Input.js';
import { Editor } from './editor/Editor.js';
import { Panel } from './editor/Panel.js';
import { Library } from './level/library.js';

function showError(error) {
    console.error(error);
    const message = error instanceof Error ? error.message : String(error);
    document.getElementById('loading-message').textContent = `The workbench could not start: ${message}. It needs WebGPU or WebGL 2 and WebAssembly.`;
    document.getElementById('loading').classList.remove('hidden');
}

async function main() {
    const host = document.getElementById('viewport');
    const kit = await boot({
        title: 'Strata — First-person engine workbench',
        physics: true,
        mount: host,
        // The workbench has Settings buttons in its toolbar and pause card (F9 works too).
        gear: 'none',
        holdLoading: true,
        accent: '#c8e7a6',
        background: '#171c1a',
        // Top pills (Reset, II) sit inside the view, below the workbench's top bar.
        touch: { top: 'right', topOffset: 72 },
        input: actionDefs(),
    });
    kit.loading.progress(.8, 'Building the level…');
    try {
        const engine = new Engine(kit);
        // Install project plugins here, before start(): engine.use({ id, install(engine) { … } }).
        const library = new Library(engine.prefabs.ids, engine.schemas);
        engine.saver = (slot, doc) => library.save(slot, doc);
        let slot = library.current, level;
        try {
            level = library.load(slot);
        }
        catch (error) {
            console.warn('Saved level was not loaded:', error);
            slot = 'yard';
            level = library.builtin(slot);
        }
        engine.slot = slot;
        engine.start(level);
        const editor = new Editor(engine);
        const panel = new Panel(engine, editor, library);
        engine.run();
        // Local development API. No network service or telemetry is present.
        Object.assign(window, { strata: { engine, editor, panel, library, exportLevel: () => structuredClone(engine.document) } });
    }
    finally {
        kit.loading.done();
    }
}
main().catch(showError);
