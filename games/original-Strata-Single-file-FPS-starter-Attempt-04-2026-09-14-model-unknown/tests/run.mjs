// Pure logic checks for the Strata starter: node games/<this folder>/tests/run.mjs
// They need no browser, GPU, three.js or Rapier. The guide's "Run logic checks" runs the same set.
import { runChecks } from '../strata/tests/self-test.js';

const result = runChecks();
for (const r of result.results) console.log(`${r.passed ? 'PASS' : 'FAIL'}  ${r.name}${r.error ? `\n      ${r.error}` : ''}`);
console.log(`\n${result.passed} passed / ${result.failed} failed. ${result.scope}`);
if (result.failed) process.exitCode = 1;
