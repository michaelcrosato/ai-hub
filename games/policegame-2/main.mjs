import { cases } from "./content/catalog.mjs";
import { registry, assets } from "./content/catalog.mjs";
import { GameApp } from "./ui/game-app.mjs";
import { hooks } from "./content/hooks.mjs";

const selected =
  new URLSearchParams(location.search).get("case") || registry.defaultCase;
const definition = Object.hasOwn(cases, selected)
  ? cases[selected]
  : cases[registry.defaultCase];
await import("./presentation/harbor-world.js");
new GameApp(definition, { cases, registry, assets, hooks });
