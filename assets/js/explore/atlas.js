/** Atlas — pick a genre district, then follow its numbered game stops. */

import { hashInt } from "../color.js";
import { h, ICONS, icon } from "../dom.js";
import { sameKey } from "../manifest.js";
import { gameImage, gameMeta } from "./common.js";

const LINES = [
	"#265e9b",
	"#a23b38",
	"#497044",
	"#8b5425",
	"#72568f",
	"#25716c",
];
const MAP_SIZE = 8;
const PAGE_SIZE = 8;

/** A game may belong to several districts, but never twice to the same one.
 * Untagged entries get a district too, so the map never loses an entry. */
export function districtsOf(games) {
	const groups = new Map();
	for (const game of games) {
		const genres = (Array.isArray(game.genre) ? game.genre : [game.genre])
			.filter((value) => typeof value === "string" && value.trim())
			.map((value) => value.trim().replace(/\s+/g, " "));
		const entries = genres.length
			? genres.map((label) => ({ key: `genre:${sameKey(label)}`, label }))
			: [{ key: "unmapped", label: "Uncharted" }];
		for (const { key, label } of entries) {
			if (!groups.has(key))
				groups.set(key, { key, label, games: [], seen: new Set() });
			const group = groups.get(key);
			if (!group.seen.has(game.slug)) {
				group.seen.add(game.slug);
				group.games.push(game);
			}
		}
	}
	return [...groups.values()]
		.map(({ key, label, games: members }) => ({ key, label, games: members }))
		.sort(
			(a, b) =>
				b.games.length - a.games.length || a.label.localeCompare(b.label, "en"),
		);
}

/** Clamp stale page state after filtering, while keeping every result reachable. */
export function pageStops(games, requested = 0, size = PAGE_SIZE) {
	const pageSize =
		Number.isFinite(size) && size > 0
			? Math.max(1, Math.floor(size))
			: PAGE_SIZE;
	const pages = Math.ceil(games.length / pageSize);
	const page = Math.min(
		Math.max(0, Math.floor(Number(requested)) || 0),
		Math.max(0, pages - 1),
	);
	const start = page * pageSize;
	return {
		games: games.slice(start, start + pageSize),
		page,
		pages,
		total: games.length,
		start: games.length ? start + 1 : 0,
		end: Math.min(start + pageSize, games.length),
	};
}

const lineColor = (key) => LINES[hashInt(key, LINES.length)];
const twoDigits = (number) => String(number).padStart(2, "0");

export function createView(root, actions) {
	let state = { games: [], query: new URLSearchParams(), selected: null };
	let mapPage = 0;
	let gamePage = 0;
	let previousFilter = null;
	let previousDistrict = null;
	let focusAfterRender = null;

	function chooseDistrict(key) {
		// The router emits only when the URL changes. Re-selecting the current
		// district must leave both the visible page and its internal index alone.
		if ((key || "") === (state.query.get("district") || "")) return;
		gamePage = 0;
		if (window.matchMedia("(max-width: 720px)").matches)
			focusAfterRender = "stops-heading";
		actions.setQuery({ district: key || null });
	}

	function pagingButton(label, glyph, disabled, onClick, focusKey) {
		return h(
			"button",
			{
				type: "button",
				class: "atlas-page-button",
				disabled,
				"aria-label": label,
				"data-atlas-focus": focusKey,
				onclick: onClick,
			},
			glyph,
		);
	}

	function mapPanel(districts, selectedKey) {
		const shown = pageStops(districts, mapPage, MAP_SIZE);
		mapPage = shown.page;
		const station = (district, index) => {
			const row = Math.floor(index / 2);
			const column = row % 2 ? 1 - (index % 2) : index % 2;
			const active = district.key === selectedKey;
			return h(
				"button",
				{
					type: "button",
					class: `atlas-station${active ? " is-active" : ""}`,
					style: {
						"--station-x": `${column ? 74 : 24}%`,
						"--station-y": `${12 + row * 24}%`,
						"--atlas-line": lineColor(district.key),
					},
					"aria-pressed": String(active),
					"data-atlas-focus": `district:${district.key}`,
					onclick: () => chooseDistrict(district.key),
				},
				h(
					"span",
					{ class: "atlas-station-dot", "aria-hidden": "true" },
					twoDigits(shown.page * MAP_SIZE + index + 1),
				),
				h("span", { class: "atlas-station-name" }, district.label),
				h(
					"span",
					{ class: "atlas-station-count" },
					`${district.games.length} ${district.games.length === 1 ? "title" : "titles"}`,
				),
			);
		};

		return h(
			"section",
			{ class: "atlas-map-panel", "aria-labelledby": "atlas-map-heading" },
			h(
				"div",
				{ class: "atlas-map-heading" },
				h("span", { class: "atlas-kicker" }, "01 / Choose your district"),
				h("h2", { id: "atlas-map-heading" }, "The genre map"),
				h("p", null, "Take a familiar route. Or go somewhere new."),
			),
			h(
				"button",
				{
					type: "button",
					class: `atlas-all-lines${!selectedKey ? " is-active" : ""}`,
					"aria-pressed": String(!selectedKey),
					"data-atlas-focus": "all-districts",
					onclick: () => chooseDistrict(null),
				},
				h("span", { class: "atlas-interchange", "aria-hidden": "true" }, "◎"),
				h(
					"span",
					null,
					h("strong", null, "All districts"),
					h("span", null, "Explore the whole network"),
				),
				h("span", { class: "atlas-total" }, state.games.length),
			),
			shown.games.length
				? h(
						"div",
						{ class: "atlas-map", "aria-label": "Genre districts" },
						h(
							"svg",
							{
								class: "atlas-map-tracks",
								viewBox: "0 0 100 100",
								preserveAspectRatio: "none",
								"aria-hidden": "true",
							},
							h("path", {
								d: "M24 12H74V36H24V60H74V84H24",
								fill: "none",
								stroke: "currentColor",
								"stroke-width": "1.15",
								"stroke-linecap": "round",
								"stroke-linejoin": "round",
							}),
							h("path", {
								d: "M24 12V5M24 84V93",
								fill: "none",
								stroke: "currentColor",
								"stroke-width": "1.15",
								"stroke-dasharray": "1.5 1.5",
							}),
						),
						shown.games.map(station),
					)
				: h(
						"div",
						{ class: "atlas-map-empty" },
						h(
							"span",
							{ class: "atlas-map-empty-icon", "aria-hidden": "true" },
							"◎",
						),
						h(
							"p",
							null,
							"No districts on this route. Try a different search or shelf.",
						),
					),
			h(
				"div",
				{ class: "atlas-map-footer" },
				h(
					"span",
					{ class: "atlas-kicker" },
					districts.length
						? `Districts ${shown.start}–${shown.end} of ${districts.length}`
						: "No districts",
				),
				shown.pages > 1 &&
					h(
						"div",
						{ class: "atlas-pagination", "aria-label": "District map pages" },
						pagingButton(
							"Previous districts",
							"←",
							shown.page === 0,
							() => {
								mapPage--;
								focusAfterRender = "map-heading";
								render();
							},
							"map-prev",
						),
						pagingButton(
							"Next districts",
							"→",
							shown.page >= shown.pages - 1,
							() => {
								mapPage++;
								focusAfterRender = "map-heading";
								render();
							},
							"map-next",
						),
					),
			),
			h(
				"div",
				{ class: "atlas-map-note" },
				h("span", { class: "atlas-north", "aria-hidden": "true" }, "↑ N"),
				h("span", null, "A little direction.", h("br"), "A lot to discover."),
			),
		);
	}

	function gameStop(game, index, color) {
		const starred = actions.isFave(game.slug);
		const title = game.name || game.slug;
		return h(
			"li",
			{
				class: `atlas-stop${state.selected === game.slug ? " is-selected" : ""}`,
				"data-atlas-slug": game.slug,
				style: { "--atlas-line": color },
			},
			h(
				"span",
				{ class: "atlas-stop-number", "aria-hidden": "true" },
				twoDigits(index),
			),
			h(
				"div",
				{ class: "atlas-stop-content" },
				h(
					"button",
					{
						type: "button",
						class: "atlas-stop-art",
						"aria-label": `Details for ${title}`,
						"data-atlas-focus": `art:${game.slug}`,
						onclick: (event) => actions.info(game, event.currentTarget),
					},
					gameImage(game, { className: "atlas-game-image" }),
				),
				h(
					"div",
					{ class: "atlas-stop-copy" },
					h("span", { class: "atlas-stop-meta" }, gameMeta(game)),
					h(
						"h3",
						null,
						h(
							"button",
							{
								type: "button",
								class: "atlas-title-button",
								"data-atlas-focus": `title:${game.slug}`,
								onclick: (event) => actions.info(game, event.currentTarget),
							},
							title,
						),
					),
					h(
						"p",
						{ class: "atlas-stop-description" },
						game.tagline || game.description || "A new stop on your route.",
					),
					h(
						"div",
						{ class: "atlas-stop-actions" },
						h(
							"button",
							{
								type: "button",
								class: "atlas-play",
								"data-atlas-focus": `play:${game.slug}`,
								"aria-label": `Play ${title}`,
								onclick: (event) => actions.play(game, event.currentTarget),
							},
							icon(ICONS.play),
							"Play",
						),
						h(
							"button",
							{
								type: "button",
								class: "atlas-details",
								"data-atlas-focus": `details:${game.slug}`,
								"aria-label": `Details for ${title}`,
								onclick: (event) => actions.info(game, event.currentTarget),
							},
							"Details",
						),
						h(
							"button",
							{
								type: "button",
								class: `atlas-fave${starred ? " is-fave" : ""}`,
								"data-atlas-focus": `fave:${game.slug}`,
								"aria-pressed": String(starred),
								"aria-label": `${starred ? "Unfavourite" : "Favourite"} ${title}`,
								onclick: () => actions.fave(game),
							},
							icon(ICONS.star),
						),
					),
				),
			),
		);
	}

	function stopsPanel(districts, selectedKey) {
		const district = districts.find((entry) => entry.key === selectedKey);
		const games = selectedKey ? district?.games || [] : state.games;
		const page = pageStops(games, gamePage);
		gamePage = page.page;
		const color = selectedKey ? lineColor(selectedKey) : "#265e9b";
		const heading = selectedKey
			? district?.label || "District unavailable"
			: "All districts";
		return h(
			"section",
			{
				class: "atlas-departures",
				style: { "--atlas-line": color },
				"aria-labelledby": "atlas-stops-heading",
			},
			h(
				"div",
				{ class: "atlas-departures-heading" },
				h("span", { class: "atlas-kicker" }, "02 / Find your next stop"),
				h(
					"div",
					{ class: "atlas-line-title" },
					h("span", { class: "atlas-line-symbol", "aria-hidden": "true" }, "↗"),
					h(
						"h2",
						{
							id: "atlas-stops-heading",
							tabindex: "-1",
							"data-atlas-focus": "stops-heading",
						},
						heading,
					),
				),
				h(
					"div",
					{ class: "atlas-departures-summary", role: "status" },
					h(
						"span",
						null,
						`${page.total} ${page.total === 1 ? "title" : "titles"} on this route`,
					),
					h(
						"span",
						null,
						page.total ? `Stops ${page.start}–${page.end}` : "No departures",
					),
				),
			),
			games.length
				? h(
						"ol",
						{ class: "atlas-stops", start: page.start },
						page.games.map((game, index) =>
							gameStop(game, page.start + index, color),
						),
					)
				: h(
						"div",
						{ class: "atlas-empty" },
						h(
							"span",
							{ class: "atlas-empty-symbol", "aria-hidden": "true" },
							"⊙",
						),
						h("h3", null, "A quiet corner of the map"),
						h(
							"p",
							null,
							selectedKey
								? "No titles in this district match your current filters. Visit all districts or change your search."
								: "No titles match your current filters. Try another search or shelf.",
						),
						selectedKey &&
							h(
								"button",
								{
									type: "button",
									class: "atlas-return",
									onclick: () => chooseDistrict(null),
								},
								"Visit all districts →",
							),
					),
			page.pages > 1 &&
				h(
					"nav",
					{ class: "atlas-board-footer", "aria-label": "Game stops pages" },
					pagingButton(
						"Previous game stops",
						"← Previous stops",
						page.page === 0,
						() => {
							gamePage--;
							focusAfterRender = "stops-heading";
							render();
						},
						"stops-prev",
					),
					h(
						"span",
						{ class: "atlas-kicker" },
						`${page.page + 1} / ${page.pages}`,
					),
					pagingButton(
						"Next game stops",
						"Next stops →",
						page.page >= page.pages - 1,
						() => {
							gamePage++;
							focusAfterRender = "stops-heading";
							render();
						},
						"stops-next",
					),
				),
		);
	}

	function render() {
		const focusedKey = root.contains(document.activeElement)
			? document.activeElement.dataset.atlasFocus
			: null;
		const selectedKey = state.query.get("district") || "";
		const districts = districtsOf(state.games);
		// Restoring a shared link lands on the selected district's map page.
		if (selectedKey !== previousDistrict) {
			const index = districts.findIndex(
				(district) => district.key === selectedKey,
			);
			if (index >= 0) mapPage = Math.floor(index / MAP_SIZE);
			previousDistrict = selectedKey;
		}
		root.replaceChildren(
			h(
				"div",
				{ class: "atlas-layout" },
				mapPanel(districts, selectedKey),
				stopsPanel(districts, selectedKey),
			),
		);
		const focusKey = focusAfterRender || focusedKey;
		if (focusAfterRender === "map-heading") {
			const firstStation = root.querySelector(".atlas-station");
			firstStation?.focus({ preventScroll: true });
		} else if (focusKey) {
			[...root.querySelectorAll("[data-atlas-focus]")]
				.find((element) => element.dataset.atlasFocus === focusKey)
				?.focus({ preventScroll: true });
		}
		if (focusAfterRender === "stops-heading")
			root
				.querySelector("#atlas-stops-heading")
				?.scrollIntoView({ block: "start", behavior: "instant" });
		focusAfterRender = null;
	}

	return {
		setSelected(slug) {
			state = { ...state, selected: slug || null };
			for (const stop of root.querySelectorAll(".atlas-stop")) {
				stop.classList.toggle(
					"is-selected",
					stop.dataset.atlasSlug === state.selected,
				);
			}
		},
		getPool() {
			const key = state.query.get("district");
			return key
				? districtsOf(state.games).find((district) => district.key === key)
						?.games || []
				: state.games;
		},
		update(next) {
			state = next;
			// Detail routes should preserve paging; actual search/filter changes reset it.
			const filter = new URLSearchParams(next.query);
			const signature = filter.toString();
			if (signature !== previousFilter) gamePage = 0;
			previousFilter = signature;
			render();
		},
	};
}
