/**
 * en.js — every line the hub shows its players, in English, the hub's own
 * language. The shape is a game's `game-lines` block (lib/hub/languages.md):
 * lines by id, notes and max widths for the translator, the names that stay as
 * written, and the translator's brief. Code shows a line with t('id') from
 * assets/js/lang.js; translations are assets/lang/<code>.json, made by
 * scripts/translate.mjs.
 */
export default {
  version: 1,
  language: "en",
  names: ["AI Hub","Claude","GPT","Gemini","Grok","Google","Supabase","Cloudflare","GitHub"],
  brief: "AI Hub is a website: a free arcade of small browser games, each built by an AI model (Claude, GPT, Gemini and others). Players open a game and play it in the browser, alone or with friends in a shared session, and browse the library in several views: the Wall of arcade cabinets, the Couch (a big-screen view for a gamepad or the arrow keys), the Catalogue (a table with search and filters), the Atlas (the library as a map of genre districts), the Timeline (the library by date added) and the Deck (one shuffled game at a time). The lines are the site's own: menus, buttons, labels, help, short explanations and a privacy page.\n\nTone: plain, friendly and brief, like a good arcade attendant. Short sentences, no marketing. The site speaks to the player directly. Use the casual \"you\" (tú, tu, ты) where the language has one and games commonly use it; in Hindi and Bengali use the form apps usually use (आप, আপনি). Keep one form throughout.\n\nGame titles, AI model names, company and product names and the two-word nicknames the hub gives players in sessions (\"Teal Otter\") stay as written. The names of the views (Wall, Couch, Catalogue, Atlas, Timeline, Deck, Friends) are ordinary words: translate them, and use the same word every time.\n\nTerms: a \"session\" is a group of players on their own devices playing games together, run by the hub; the \"host\" starts it; a \"round\" is one game played in it. A \"build\" is one version of a game, made by one AI model; a game can have several builds. A \"cabinet\" is a game's tile on the Wall, drawn as an arcade cabinet. Buttons, tabs and column headings have little room: keep them short.",
  lines: {
    // lang
    "lang.menu": "Language",
    "lang.menu_hint": "Show the hub in another language",
    "lang.test": "Test language",
  },
  notes: {
    "lang.menu": "Label of the menu that picks the site's language.",
    "lang.test": "Shown instead of a language name when the address picks one of the made-up test languages.",
  },
  max: {
    "lang.menu": 14,
  },
};
