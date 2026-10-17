import vm from 'node:vm';
import {readFileSync} from 'node:fs';
export const root=new URL('../',import.meta.url);
// Isolated VM is the default. Long soaks may use native Node globals; runner.mjs
// checks a complete mission against the isolated execution before release.
export function boot(options={}) {
 const logs=[];const context=options.native?globalThis:{console:options.verbose?console:{log(){},warn:(...a)=>logs.push(a.join(' ')),error:(...a)=>logs.push(a.join(' '))},...options.globals};if(!options.native)vm.createContext(context);
 const html=readFileSync(new URL('index.html',root),'utf8');
 for(const m of html.matchAll(/<script defer src="([^"]+)"/g)){const source=readFileSync(new URL(m[1],root),'utf8');if(options.native)vm.runInThisContext(source,{filename:m[1]});else vm.runInContext(source,context,{filename:m[1]});}
 return {G:context.Drive,E:context.My3D2dge,app:context.Drive.app,game:context.My3D2dge.current,context,logs};
}
export function advance(game,seconds,hz=60){for(let i=0;i<Math.round(seconds*hz);i++)game.advance(1/hz);}
