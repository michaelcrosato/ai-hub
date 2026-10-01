/**
 * Compile a scene's pipelines before it is shown, but never hold a menu hostage to it: after
 * `ms` the episode carries on and anything left compiles on first draw.
 */
export async function warmUp(renderer, scene, camera, ms = 2500) {
    let timer = 0;
    const compile = Promise.resolve()
        .then(() => renderer.compileAsync(scene, camera))
        .catch(() => { /* compiles lazily instead */ });
    await Promise.race([compile, new Promise(resolve => { timer = setTimeout(resolve, ms); })]);
    clearTimeout(timer);
}
