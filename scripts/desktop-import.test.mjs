import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";

for (const [slug, current, obsolete] of [
	["desktop-greywater", "greywater-fded80a19c", "greywater-previous"],
	["desktop-urethane-switchyard", "urethane-c284530527", "urethane-previous"],
]) {
	test(`${slug} activation preserves other games' offline caches`, async () => {
		const listeners = new Map();
		const removed = [];
		const caches = [current, obsolete, "encore-1", "another-game-offline"];
		const source = await readFile(
			new URL(`../games/${slug}/sw.js`, import.meta.url),
			"utf8",
		);
		vm.runInNewContext(source, {
			self: {
				addEventListener: (name, listener) => listeners.set(name, listener),
				clients: { claim: async () => {} },
			},
			caches: {
				keys: async () => caches,
				delete: async (key) => {
					removed.push(key);
					return true;
				},
			},
		});
		let activation;
		listeners.get("activate")({
			waitUntil: (promise) => {
				activation = promise;
			},
		});
		await activation;
		assert.deepEqual(removed, [obsolete]);
	});
}
