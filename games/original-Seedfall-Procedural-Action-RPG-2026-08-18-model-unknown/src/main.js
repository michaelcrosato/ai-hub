import { boot } from "kit/boot.js";
import { ACTIONS } from "./input.js";
import { Game } from "./game.js";

const appRoot = document.querySelector("#app");
if (!appRoot) {
  throw new Error("Missing #app root");
}

const kit = await boot({
  title: "Seedfall",
  input: ACTIONS,
  // The pause menu and the title screen have their own Settings buttons (kit.menu.open()),
  // and the minimap owns the top-right corner, so there is no floating gear (F9 still opens it).
  gear: "none",
  touch: { top: "center", topOffset: 8 },
  accent: "#e6c777",
  background: "#0c1216",
});

const game = new Game(appRoot, kit);
kit.start((dt) => game.frame(dt));
