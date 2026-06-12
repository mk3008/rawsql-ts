#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  buildOidcPublishFailureHint,
  classifyNpmFailure,
  getOidcPublishFailureReasonSignals,
} from "./ci-publish.mjs";

const tlogFailure = classifyNpmFailure(`
  npm error code TLOG_CREATE_ENTRY_ERROR
  npm error error creating tlog entry - (409) an equivalent entry already exists in the transparency log
`);

assert.equal(tlogFailure.tlogDuplicate, true);
assert.equal(tlogFailure.needAuth, false);
assert.equal(tlogFailure.e401, false);
assert.equal(tlogFailure.e403, false);
assert.equal(tlogFailure.e404, false);

const signals = getOidcPublishFailureReasonSignals(tlogFailure);
assert.deepEqual(signals, [
  "TLOG_CREATE_ENTRY_ERROR (npm provenance transparency log already has an equivalent entry)",
]);

const hint = buildOidcPublishFailureHint(tlogFailure, { allowTokenFallback: true });
assert.match(hint, /provenance transparency-log duplicate/);
assert.match(hint, /check whether the target package version became visible on npm/);
assert.match(hint, /prefer bumping the package version/);
assert.doesNotMatch(hint, /npm Trusted Publisher is configured/);
assert.doesNotMatch(hint, /fallback enabled/);

console.log("[verify-ci-publish-diagnostics] ok");
