import assert from "node:assert/strict";
import test from "node:test";
import { districtsOf, pageStops } from "../assets/js/explore/atlas.js";

test("districts normalize genre spelling, deduplicate memberships and retain untagged games", () => {
	const games = [
		{ slug: "a", genre: [" Action ", "action", "RPG"] },
		{ slug: "b", genre: "ACTION" },
		{ slug: "c", genre: "Café  Sim" },
		{ slug: "d", genre: "Cafe Sim" },
		{ slug: "e" },
		{ slug: "f", genre: [null, "", 123] },
	];
	const districts = districtsOf(games);
	assert.deepEqual(
		districts
			.find(({ key }) => key === "genre:action")
			.games.map((game) => game.slug),
		["a", "b"],
	);
	assert.deepEqual(
		districts
			.find(({ key }) => key === "genre:cafe sim")
			.games.map((game) => game.slug),
		["c", "d"],
	);
	assert.deepEqual(
		districts
			.find(({ key }) => key === "unmapped")
			.games.map((game) => game.slug),
		["e", "f"],
	);
	assert.equal(
		new Set(
			districts.flatMap(({ games: members }) =>
				members.map((game) => game.slug),
			),
		).size,
		games.length,
	);
	assert.equal(districts.at(-1).key, "genre:rpg");
});

test("an actual genre named Uncharted stays distinct from entries without a genre", () => {
	const districts = districtsOf([
		{ slug: "a", genre: "Uncharted" },
		{ slug: "b" },
	]);
	assert.equal(districts.length, 2);
	assert.deepEqual(
		new Set(districts.map(({ key }) => key)),
		new Set(["genre:uncharted", "unmapped"]),
	);
});

test("every result is reachable across pages without repetition or mutation", () => {
	const games = Array.from({ length: 103 }, (_, index) => ({
		slug: `stop-${index}`,
	}));
	const snapshot = [...games];
	const first = pageStops(games);
	const visited = Array.from(
		{ length: first.pages },
		(_, page) => pageStops(games, page).games,
	).flat();
	assert.deepEqual(visited, games);
	assert.deepEqual(games, snapshot);
	assert.equal(first.pages, 13);
	assert.deepEqual(pageStops(games, 12), {
		games: games.slice(96),
		page: 12,
		pages: 13,
		total: 103,
		start: 97,
		end: 103,
	});
});

test("page state clamps when filters shrink results and handles empty and invalid inputs", () => {
	const games = [{ slug: "last" }];
	assert.equal(pageStops(games, 20).page, 0);
	for (const requested of [-3, Number.NaN, Infinity, "oops"])
		assert.equal(pageStops(games, requested).page, 0);
	assert.deepEqual(pageStops([], 10), {
		games: [],
		page: 0,
		pages: 0,
		total: 0,
		start: 0,
		end: 0,
	});
	assert.equal(pageStops(Array(10).fill(null), 0, 0).games.length, 8);
	assert.equal(pageStops(Array(10).fill(null), 2, 2.8).start, 5);
});
