import assert from "node:assert/strict";
import { test } from "node:test";
import { deckState, moveCard, shuffleDeck } from "../assets/js/explore/deck.js";

const games = Array.from({ length: 24 }, (_, index) => ({
	slug: `game-${index}`,
	name: `Game ${index}`,
}));
const slugs = (items) => items.map((game) => game.slug);

test("a deal is reproducible, independent of catalogue order, and never mutates the source", () => {
	const original = [...games];
	const first = shuffleDeck(games, "same-deal");
	assert.deepEqual(first, shuffleDeck([...games].reverse(), "same-deal"));
	assert.deepEqual(games, original);
	assert.equal(new Set(slugs(first)).size, games.length);
	assert.notDeepEqual(first, shuffleDeck(games, "another-deal"));
});

test("filtering preserves the relative order of surviving cards and removes duplicates", () => {
	const filtered = games.filter((_, index) => index % 2 === 0);
	const expected = shuffleDeck(games, "filter-deal").filter((game) =>
		filtered.includes(game),
	);
	assert.deepEqual(shuffleDeck(filtered, "filter-deal"), expected);
	assert.deepEqual(
		shuffleDeck([...filtered, filtered[0], null, {}], "filter-deal"),
		expected,
	);
});

test("every skip reaches one new game, then an explicit exhausted state without cycling", () => {
	let query = { seed: "no-repeats" };
	const visited = [];
	let state = deckState(games, query);
	while (state.current) {
		visited.push(state.current.slug);
		const patch = moveCard(state, 1);
		query = { ...query, card: patch.card, done: patch.deckDone === "1" };
		state = deckState(games, query);
	}
	assert.equal(visited.length, games.length);
	assert.equal(new Set(visited).size, games.length);
	assert.equal(state.exhausted, true);
	assert.equal(state.index, games.length);
	assert.equal(moveCard(state, 1).deckDone, "1");
	const back = moveCard(state, -1);
	assert.equal(back.card, visited.at(-1));
	assert.equal(back.deckDone, null);
});

test("URL card state restores a card and bounds stay valid for unknown, empty, and single-card deals", () => {
	const ordered = shuffleDeck(games, "shared");
	assert.equal(
		deckState(games, { seed: "shared", card: ordered[8].slug }).index,
		8,
	);
	assert.equal(deckState(games, { card: "missing" }).index, 0);
	assert.equal(deckState([], { done: true }).exhausted, false);
	assert.deepEqual(moveCard(deckState([]), 1), { card: null, deckDone: null });
	assert.equal(moveCard(deckState([games[0]]), -1).card, games[0].slug);
	assert.equal(moveCard(deckState([games[0]]), 1).deckDone, "1");
});

test("only-unplayed removes played games and safely handles a removed current card", () => {
	const hasPlayed = (slug) => Number(slug.split("-")[1]) < 12;
	const state = deckState(games, { unplayed: true, card: "game-2", hasPlayed });
	assert.equal(state.cards.length, 12);
	assert.ok(state.current);
	assert.ok(state.cards.every((game) => !hasPlayed(game.slug)));
	assert.deepEqual(
		deckState(games, { unplayed: true, hasPlayed: () => true }).cards,
		[],
	);
	assert.equal(
		deckState(games, { unplayed: false, hasPlayed: () => true }).cards.length,
		games.length,
	);
});

test("playing the current card in an unplayed deal advances without repeating earlier skips", () => {
	const seed = "played-card";
	const ordered = shuffleDeck(games, seed);
	const card = ordered[6].slug;
	const state = deckState(games, {
		seed,
		card,
		unplayed: true,
		hasPlayed: (slug) => slug === card,
	});
	assert.equal(state.current.slug, ordered[7].slug);
	const last = ordered.at(-1).slug;
	const final = deckState(games, {
		seed,
		card: last,
		unplayed: true,
		hasPlayed: (slug) => slug === last,
	});
	assert.equal(final.exhausted, true);
	assert.equal(final.current, null);
});

test("removing a favourite continues after its rank and retains the cursor across store updates", () => {
	const seed = "removed-favourite";
	const ordered = shuffleDeck(games, seed);
	const card = ordered[7].slug;
	const before = deckState(games, { seed, card });
	const remaining = games.filter((game) => game.slug !== card);
	const after = deckState(remaining, {
		seed,
		card,
		previousCard: before.anchor,
	});
	assert.equal(after.current.slug, ordered[8].slug);
	assert.equal(after.anchor, card);
	const refreshed = deckState(remaining, {
		seed,
		card,
		previousCard: after.anchor,
	});
	assert.equal(refreshed.current.slug, ordered[8].slug);
	const furtherRemoval = deckState(
		remaining.filter((game) => game.slug !== after.current.slug),
		{
			seed,
			card,
			previousCard: refreshed.anchor,
		},
	);
	assert.equal(furtherRemoval.current.slug, ordered[9].slug);
});

test("removing the first card without URL state advances; removing the final favourite exhausts the deal", () => {
	const seed = "favourite-bounds";
	const ordered = shuffleDeck(games, seed);
	const initial = deckState(games, { seed });
	const next = deckState(
		games.filter((game) => game.slug !== initial.current.slug),
		{
			seed,
			previousCard: initial.anchor,
		},
	);
	assert.equal(next.current.slug, ordered[1].slug);
	const finalCard = ordered.at(-1).slug;
	const final = deckState(
		games.filter((game) => game.slug !== finalCard),
		{
			seed,
			card: finalCard,
			previousCard: finalCard,
		},
	);
	assert.equal(final.exhausted, true);
	assert.equal(final.current, null);
	const reset = deckState(
		games.filter((game) => game.slug !== finalCard),
		{ seed },
	);
	assert.equal(reset.current.slug, ordered[0].slug);
});
