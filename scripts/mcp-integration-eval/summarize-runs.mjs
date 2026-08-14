import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const runRoot = resolve(process.argv[2] ?? '');
if (!process.argv[2]) throw new Error('Usage: node summarize-runs.mjs <run-root>');
const manifest = JSON.parse(await readFile(resolve(runRoot, 'manifest.json'), 'utf8'));
const scenarioPath = resolve(runRoot, 'scenarios.json');
const packet = JSON.parse(await readFile(scenarioPath, 'utf8'));

const runs = [];
for (const scenario of packet.scenarios) {
  const scenarioRoot = resolve(runRoot, scenario.id);
  const reps = (await readdir(scenarioRoot, { withFileTypes: true })).filter(x => x.isDirectory()).map(x => x.name).sort();
  for (const rep of reps) {
    const root = resolve(scenarioRoot, rep);
    const lines = (await readFile(resolve(root, 'trace.jsonl'), 'utf8')).split(/\r?\n/).filter(Boolean);
    const events = lines.flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
    const toolEvents = events.filter(e => e.type === 'item.completed' && e.item?.type === 'mcp_tool_call');
    const toolCalls = toolEvents.map(e => ({
      tool: e.item.tool,
      arguments: e.item.arguments,
      error: e.item.error,
      resultBytes: Buffer.byteLength(JSON.stringify(e.item.result ?? null), 'utf8')
    }));
    const final = events.filter(e => e.type === 'item.completed' && e.item?.type === 'agent_message').at(-1)?.item?.text ?? '';
    const usage = events.filter(e => e.type === 'turn.completed').at(-1)?.usage ?? {};
    const stderr = await readFile(resolve(root, 'stderr.log'), 'utf8');
    const metadata = JSON.parse(await readFile(resolve(root, 'metadata.json'), 'utf8'));
    const allowed = new Set(scenario.toolPolicy.allowed);
    const observed = toolCalls.map(x => x.tool);
    const requiredSatisfied = scenario.toolPolicy.requiredAnyOf.length === 0 || scenario.toolPolicy.requiredAnyOf.every(group => group.some(name => observed.includes(name)));
    const unnecessary = observed.filter(name => !allowed.has(name));
    const redundant = Math.max(0, observed.length - new Set(observed).size);
    const evidenceHits = scenario.answerEvidence.map(text => final.toLowerCase().includes(text.toLowerCase()));
    runs.push({
      scenarioId: scenario.id, category: scenario.category, repetition: rep,
      durationMilliseconds: metadata.durationMilliseconds, exitCode: metadata.exitCode,
      toolCalls, callCount: observed.length, requiredSatisfied, unnecessaryCalls: unnecessary.length,
      redundantCalls: redundant, overCallBudget: observed.length > scenario.toolPolicy.maxCalls,
      answerEvidenceHits: evidenceHits.filter(Boolean).length, answerEvidenceTotal: evidenceHits.length,
      hostSchemaWarnings: (stderr.match(/Skipping deferred MCP tool/g) ?? []).length,
      inputTokens: usage.input_tokens ?? null, cachedInputTokens: usage.cached_input_tokens ?? null,
      outputTokens: usage.output_tokens ?? null, reasoningTokens: usage.reasoning_output_tokens ?? null,
      finalAnswerBytes: Buffer.byteLength(final, 'utf8')
    });
  }
}

const positive = runs.filter(r => packet.scenarios.find(s => s.id === r.scenarioId).toolPolicy.requiredAnyOf.length > 0);
const negative = runs.filter(r => packet.scenarios.find(s => s.id === r.scenarioId).toolPolicy.requiredAnyOf.length === 0);
const sum = (xs, key) => xs.reduce((n, x) => n + (x[key] ?? 0), 0);
const mean = (xs, key) => xs.length ? sum(xs, key) / xs.length : 0;
const selectedUseful = runs.reduce((n, r) => n + r.toolCalls.filter(c => packet.scenarios.find(s => s.id === r.scenarioId).toolPolicy.allowed.includes(c.tool)).length, 0);
const totalCalls = sum(runs, 'callCount');
const summary = {
  schemaVersion: 1,
  manifest,
  runCount: runs.length,
  selectionRecall: positive.length ? positive.filter(r => r.requiredSatisfied).length / positive.length : 1,
  selectionPrecision: totalCalls ? selectedUseful / totalCalls : 1,
  negativeAvoidance: negative.length ? negative.filter(r => r.callCount === 0).length / negative.length : 1,
  unnecessaryCalls: sum(runs, 'unnecessaryCalls'),
  redundantCalls: sum(runs, 'redundantCalls'),
  overCallBudgetRuns: runs.filter(r => r.overCallBudget).length,
  hostSchemaWarnings: sum(runs, 'hostSchemaWarnings'),
  meanDurationMilliseconds: mean(runs, 'durationMilliseconds'),
  meanInputTokens: mean(runs, 'inputTokens'),
  meanOutputTokens: mean(runs, 'outputTokens'),
  meanToolResultBytes: totalCalls ? runs.flatMap(r => r.toolCalls).reduce((n, c) => n + c.resultBytes, 0) / totalCalls : 0,
  meanAnswerEvidenceRecall: runs.length ? runs.reduce((n, r) => n + (r.answerEvidenceTotal ? r.answerEvidenceHits / r.answerEvidenceTotal : 1), 0) / runs.length : 0,
  stability: Object.fromEntries(packet.scenarios.map(s => {
    const signatures = runs.filter(r => r.scenarioId === s.id).map(r => r.toolCalls.map(c => c.tool).join(','));
    return [s.id, new Set(signatures).size === 1];
  })),
  runs
};
const out = resolve(runRoot, 'summary.json');
await writeFile(out, JSON.stringify(summary, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ ...summary, runs: undefined }, null, 2));
