import assert from "node:assert/strict";
import { test } from "node:test";
import {
	addedDay,
	buildTimeline,
	timelinePage,
	timelineSelection,
} from "../assets/js/explore/timeline.js";

const entry = (slug, added, name = slug) => ({ slug, name, added });

test("arrival days are UTC and invalid or missing dates are undated", () => {
	assert.equal(addedDay(entry("a", "2026-10-15T23:30:00-07:00")), "2026-10-16");
	assert.equal(addedDay(entry("a", "2024-02-29")), "2024-02-29");
	for (const value of [
		undefined,
		null,
		"",
		0,
		"yesterday",
		"2026-02-29",
		"2026-02-30T12:00:00Z",
		"2026-13-01",
		"2026-00-10",
		"2026-10-32",
		"2026-10-01Tbad",
	]) {
		assert.equal(addedDay(entry("a", value)), null, String(value));
	}
});

test("newest and oldest orders include all games, keep undated last, and sort time within a day", () => {
	const games = [
		entry("unknown", null),
		entry("late", "2026-10-15T19:00:00Z"),
		entry("old", "2026-09-01"),
		entry("early", "2026-10-15T01:00:00Z"),
	];
	const original = [...games];
	const newest = buildTimeline(games);
	assert.deepEqual(
		newest.groups.map((group) => group.key),
		["2026-10-15", "2026-09-01", "undated"],
	);
	assert.deepEqual(
		newest.groups[0].games.map((game) => game.slug),
		["late", "early"],
	);
	const oldest = buildTimeline(games, { order: "oldest" });
	assert.deepEqual(
		oldest.groups.map((group) => group.key),
		["2026-09-01", "2026-10-15", "undated"],
	);
	assert.deepEqual(
		oldest.groups[1].games.map((game) => game.slug),
		["early", "late"],
	);
	assert.deepEqual(games, original);
	assert.equal(newest.total, games.length);
});

test("month and exact-day selections preserve the complete date index and counts", () => {
	const games = [
		entry("a", "2026-10-01"),
		entry("b", "2026-10-02"),
		entry("c", "2026-09-01"),
		entry("d", "bad"),
	];
	const month = buildTimeline(games, { month: "2026-10" });
	assert.equal(month.total, 2);
	assert.deepEqual(month.months, [
		{ key: "2026-10", count: 2 },
		{ key: "2026-09", count: 1 },
	]);
	assert.equal(month.undated, 1);
	assert.equal(month.days.length, 3);
	assert.deepEqual(
		buildTimeline(games, { month: "2026-10-02" }).groups[0].games.map(
			(game) => game.slug,
		),
		["b"],
	);
	assert.deepEqual(
		buildTimeline(games, { month: "undated" }).groups[0].games.map(
			(game) => game.slug,
		),
		["d"],
	);
	assert.equal(buildTimeline(games, { month: "2025-01" }).total, 0);
});

test("malformed date query falls back to all dates and empty libraries stay empty", () => {
	for (const value of [
		"anything",
		"2026-13",
		"2026-02-30",
		"2026-1",
		"2026-10-01T00:00:00Z",
	])
		assert.equal(timelineSelection(value), "");
	assert.equal(timelineSelection("2026-10"), "2026-10");
	assert.equal(timelineSelection("2026-10-15"), "2026-10-15");
	assert.equal(
		buildTimeline([entry("a", "2026-10-15")], { month: "bad" }).total,
		1,
	);
	assert.deepEqual(buildTimeline([]).groups, []);
	assert.equal(buildTimeline([]).total, 0);
});

test("pagination reaches every entry even when a day exceeds a whole batch", () => {
	const games = Array.from({ length: 61 }, (_, i) =>
		entry(
			`entry-${String(i).padStart(2, "0")}`,
			i < 55 ? "2026-10-15" : "2026-09-01",
		),
	);
	games.push(entry("undated", null));
	const timeline = buildTimeline(games);
	assert.equal(timelinePage(timeline.groups, 24)[0].games.length, 24);
	assert.equal(timelinePage(timeline.groups, 24)[0].total, 55);
	const all = timelinePage(timeline.groups, 72).flatMap((group) =>
		group.games.map((game) => game.slug),
	);
	assert.equal(all.length, games.length);
	assert.equal(new Set(all).size, games.length);
	assert.equal(all.at(-1), "undated");
	assert.deepEqual(timelinePage(timeline.groups, 0), []);
	assert.equal(timelinePage(timeline.groups, 56).at(-1).games.length, 1);
});
