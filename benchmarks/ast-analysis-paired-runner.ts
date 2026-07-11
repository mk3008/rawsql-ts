import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export const PHASE_NAMES = [
    'analyzer.select-output-collection',
    'analyzer.integrated-condition-optimization',
    'renderer.token-build',
    'renderer.print',
    'renderer.hot-format',
    'renderer.cold-format',
] as const;

export const SCENARIO_NAMES = [
    'tracked.customer-summary',
    'tracked.product-ranking',
    'tracked.sales-summary',
    'synthetic.cte-wildcard-duplicate',
    'synthetic.wide-output',
    'synthetic.boolean-parameter-comment',
    'synthetic.derived-union',
] as const;

type PhaseName = typeof PHASE_NAMES[number];
type ScenarioName = typeof SCENARIO_NAMES[number];
type Condition = 'baseline' | 'candidate';
type Stage = 'screen' | 'confirmation';
export type PerformanceStatus =
    | 'repeatable_signal'
    | 'adverse_signal'
    | 'neutral_or_inconclusive'
    | 'semantic_mismatch'
    | 'not_measured';

export interface CandidateManifest {
    schemaVersion: 1;
    stage: Stage;
    candidate: {
        id: string;
        kind: 'candidate' | 'self_comparison';
        summary: string;
        hypothesis: string;
        baseCommit: string;
        candidateCommit: string;
        limitation: string;
    };
    baselineDirectory: string;
    candidateDirectory: string;
    phaseScope: PhaseName[];
    scopeRationale: string;
    practicalThresholds: Array<{
        phase: PhaseName;
        scenario: ScenarioName;
        minimumAbsoluteMeanDeltaMs: number;
    }>;
}

export interface P0Reference {
    schemaVersion: 1;
    p0Commit: string;
    profile: 'pr';
    sourceDocument: string;
    protocolDocumentSha256: string;
    pairedBenchmarkSourceSha256: string;
    unit: 'mean milliseconds';
    rows: Array<{
        phase: PhaseName;
        scenario: ScenarioName;
        minimumMeanMs: number;
        maximumMeanMs: number;
        betweenProcessMeanRangeMs: number;
    }>;
}

interface RawBenchmarkReport {
    schemaVersion: number;
    profile: string;
    timestamp: string;
    commit: { sha: string; dirty: boolean };
    environment: Record<string, unknown>;
    method: {
        warmupSamples: number;
        measuredSamples: number;
        invocationsPerSample: number;
        corpusSeed: string;
        objectIdentityPolicy: string;
        semanticValidation: string;
        phaseScope: PhaseName[];
    };
    pairRun?: { candidateId: string; condition: Condition; pairIndex: number };
    formatterOptions: Record<string, unknown>;
    corpus: Array<{ name: string; sqlSha256: string; [key: string]: unknown }>;
    phases: Array<{ name: string; [key: string]: unknown }>;
    results: Array<{
        phase: PhaseName;
        scenario: ScenarioName;
        stats: { meanMs: number; [key: string]: unknown };
        semanticSink: Record<string, unknown>;
        [key: string]: unknown;
    }>;
    failure?: {
        kind: 'semantic_mismatch' | 'execution_failure';
        phase: PhaseName;
        scenario: ScenarioName;
        message: string;
    };
}

interface PairDelta {
    pairIndex: number;
    baselineMeanMs: number;
    candidateMeanMs: number;
    candidateMinusBaselineMeanMs: number;
    direction: 'favorable' | 'adverse' | 'equal';
}

interface OutcomeRow {
    phase: PhaseName;
    scenario: ScenarioName;
    status: PerformanceStatus;
    reason: string;
    practicalThresholdMs: number | null;
    p0BetweenProcessMeanRangeMs: number;
    sinkComparison: 'matched' | 'mismatch' | 'not_measured';
    semanticMismatchDetails?: Array<{
        pairIndex: number;
        baselineSink: Record<string, unknown>;
        candidateSink: Record<string, unknown>;
    }>;
    pairs: PairDelta[];
}

interface ProcessRun {
    pairIndex: number;
    condition: Condition;
    sequence: number;
    reportPath: string;
    processPath: string;
    command: string;
    args: string[];
    exitCode: number | null;
    report?: RawBenchmarkReport;
}

interface ValidatedAdmission {
    manifest: CandidateManifest;
    manifestPath: string;
    manifestSha256: string;
    p0Reference: P0Reference;
    phaseScope: PhaseName[];
    thresholdByRow: Map<string, number>;
    p0ByRow: Map<string, P0Reference['rows'][number]>;
    baselineDirectory: string;
    candidateDirectory: string;
    recordPath: string;
    outputRoot: string;
    benchmarkSourceSha256: string;
    protocolDocumentSha256: string;
}

const DEFAULT_P0_REFERENCE = 'docs/bench/ast-analysis-phase-p0-reference.json';
const DEFAULT_RECORD_PATH = 'docs/bench/ast-analysis-benchmark-candidate-records.jsonl';
const DEFAULT_OUTPUT_ROOT = 'tmp/ast-analysis-paired-runs';
const BENCHMARK_SOURCE = 'benchmarks/ast-analysis-phase-benchmark.ts';
const PROTOCOL_DOCUMENT = 'docs/bench/ast-analysis-benchmark-measurement-efficiency.md';
const P0_COMMIT = 'c6f28dbbf4594e99a8e1b1ab662334c010bd7281';

export function runOrderForStage(stage: Stage): Array<{ pairIndex: number; condition: Condition }> {
    if (stage === 'screen') {
        return [
            { pairIndex: 1, condition: 'baseline' },
            { pairIndex: 1, condition: 'candidate' },
        ];
    }

    return [
        { pairIndex: 1, condition: 'baseline' },
        { pairIndex: 1, condition: 'candidate' },
        { pairIndex: 2, condition: 'candidate' },
        { pairIndex: 2, condition: 'baseline' },
        { pairIndex: 3, condition: 'baseline' },
        { pairIndex: 3, condition: 'candidate' },
    ];
}

export function classifyConfirmationRow(
    deltas: number[],
    practicalThresholdMs: number,
    p0RangeMs: number,
): PerformanceStatus {
    if (deltas.length !== 3) {
        return 'neutral_or_inconclusive';
    }

    const magnitude = median(deltas.map((delta) => Math.abs(delta)));
    const clearsGuardrails = magnitude > practicalThresholdMs && magnitude > p0RangeMs;
    if (clearsGuardrails && deltas.every((delta) => delta < 0)) {
        return 'repeatable_signal';
    }
    if (clearsGuardrails && deltas.every((delta) => delta > 0)) {
        return 'adverse_signal';
    }
    return 'neutral_or_inconclusive';
}

export function compareSemanticSinks(
    baseline: Record<string, unknown>,
    candidate: Record<string, unknown>,
): 'matched' | 'semantic_mismatch' {
    return stableSerialize(baseline) === stableSerialize(candidate)
        ? 'matched'
        : 'semantic_mismatch';
}

export function validateP0Reference(reference: P0Reference): void {
    if (reference.schemaVersion !== 1
        || reference.profile !== 'pr'
        || reference.p0Commit !== P0_COMMIT
        || reference.sourceDocument !== 'docs/bench/ast-analysis-phase-benchmark.md'
        || reference.unit !== 'mean milliseconds'
        || !/^[0-9a-f]{64}$/.test(reference.protocolDocumentSha256)
        || !/^[0-9a-f]{64}$/.test(reference.pairedBenchmarkSourceSha256)) {
        throw new Error('The P0 reference must use schemaVersion 1 and the pr profile.');
    }

    const expected = new Set(allRowKeys());
    const actual = new Set<string>();
    for (const row of reference.rows) {
        const key = rowKey(row.phase, row.scenario);
        if (!expected.has(key) || actual.has(key)) {
            throw new Error(`The P0 reference has an invalid or duplicate row: ${key}.`);
        }
        const computedRange = round9(row.maximumMeanMs - row.minimumMeanMs);
        if (computedRange !== round9(row.betweenProcessMeanRangeMs)) {
            throw new Error(`The P0 range does not match min/max for ${key}.`);
        }
        actual.add(key);
    }
    if (actual.size !== expected.size) {
        throw new Error(`The P0 reference must contain all ${expected.size} phase/scenario rows.`);
    }
}

export function validateManifestShape(manifest: CandidateManifest, reference: P0Reference): void {
    if (manifest.schemaVersion !== 1) {
        throw new Error('The candidate manifest must use schemaVersion 1.');
    }
    if (manifest.stage !== 'screen' && manifest.stage !== 'confirmation') {
        throw new Error('stage must be screen or confirmation.');
    }
    if (!/^[a-z0-9][a-z0-9._-]*$/.test(manifest.candidate?.id ?? '')) {
        throw new Error('candidate.id must be a stable lowercase identifier.');
    }
    if (manifest.candidate?.kind !== 'candidate'
        && manifest.candidate?.kind !== 'self_comparison') {
        throw new Error('candidate.kind must be candidate or self_comparison.');
    }
    for (const field of ['summary', 'hypothesis', 'limitation'] as const) {
        if (!manifest.candidate?.[field]?.trim()) {
            throw new Error(`candidate.${field} is required.`);
        }
    }
    for (const field of ['baseCommit', 'candidateCommit'] as const) {
        if (!/^[0-9a-f]{40}$/.test(manifest.candidate?.[field] ?? '')) {
            throw new Error(`candidate.${field} must be a full lowercase Git commit.`);
        }
    }
    if (manifest.candidate.kind === 'self_comparison') {
        if (manifest.stage !== 'screen') {
            throw new Error('A self_comparison demonstration must use the screen stage.');
        }
        if (manifest.candidate.baseCommit !== manifest.candidate.candidateCommit) {
            throw new Error('A self_comparison must use the same base and candidate commit.');
        }
    } else if (manifest.candidate.baseCommit === manifest.candidate.candidateCommit) {
        throw new Error('A real candidate must differ from its base commit.');
    }
    if (!manifest.scopeRationale?.trim()) {
        throw new Error('scopeRationale is required before timing.');
    }
    if (!manifest.baselineDirectory?.trim() || !manifest.candidateDirectory?.trim()) {
        throw new Error('baselineDirectory and candidateDirectory are required before timing.');
    }
    if (!Array.isArray(manifest.phaseScope) || manifest.phaseScope.length === 0) {
        throw new Error('phaseScope must predeclare at least one phase.');
    }

    const allowedPhases = new Set<string>(PHASE_NAMES);
    const uniquePhases = new Set(manifest.phaseScope);
    if (uniquePhases.size !== manifest.phaseScope.length
        || manifest.phaseScope.some((phase) => !allowedPhases.has(phase))) {
        throw new Error('phaseScope contains an unsupported or duplicate phase.');
    }

    const requiredThresholds = new Set(
        manifest.phaseScope.flatMap((phase) => SCENARIO_NAMES.map((scenario) => rowKey(phase, scenario))),
    );
    const actualThresholds = new Set<string>();
    for (const threshold of manifest.practicalThresholds ?? []) {
        const key = rowKey(threshold.phase, threshold.scenario);
        if (!requiredThresholds.has(key) || actualThresholds.has(key)) {
            throw new Error(`Unexpected or duplicate practical threshold: ${key}.`);
        }
        if (!Number.isFinite(threshold.minimumAbsoluteMeanDeltaMs)
            || threshold.minimumAbsoluteMeanDeltaMs <= 0) {
            throw new Error(`Practical threshold must be positive for ${key}.`);
        }
        actualThresholds.add(key);
    }
    if (actualThresholds.size !== requiredThresholds.size) {
        throw new Error('Every declared phase/scenario row requires a practical threshold before timing.');
    }

    validateP0Reference(reference);
}

function validateAdmission(manifestPath: string, runnerRoot: string): ValidatedAdmission {
    const resolvedManifestPath = path.resolve(manifestPath);
    const manifestText = fs.readFileSync(resolvedManifestPath, 'utf8');
    const manifest = JSON.parse(manifestText) as CandidateManifest;
    const p0ReferencePath = path.resolve(runnerRoot, DEFAULT_P0_REFERENCE);
    const p0Reference = readJson<P0Reference>(p0ReferencePath);
    validateManifestShape(manifest, p0Reference);

    const baselineDirectory = path.resolve(manifest.baselineDirectory);
    const candidateDirectory = path.resolve(manifest.candidateDirectory);
    assertCleanCommit(baselineDirectory, manifest.candidate.baseCommit, 'baseline');
    assertCleanCommit(candidateDirectory, manifest.candidate.candidateCommit, 'candidate');
    if (manifest.candidate.kind === 'self_comparison' && baselineDirectory !== candidateDirectory) {
        throw new Error('A self_comparison must use the same baseline and candidate directory.');
    }

    const baselineBenchmarkPath = path.join(baselineDirectory, BENCHMARK_SOURCE);
    const candidateBenchmarkPath = path.join(candidateDirectory, BENCHMARK_SOURCE);
    const baselineBenchmarkSha = hashFile(baselineBenchmarkPath);
    const candidateBenchmarkSha = hashFile(candidateBenchmarkPath);
    if (baselineBenchmarkSha !== candidateBenchmarkSha) {
        throw new Error('Baseline and candidate benchmark sources differ; paired evidence would not share one protocol.');
    }
    if (baselineBenchmarkSha !== p0Reference.pairedBenchmarkSourceSha256) {
        throw new Error('The benchmark source does not match the admitted paired-protocol fingerprint.');
    }

    const protocolDocumentSha256 = hashFile(path.resolve(runnerRoot, PROTOCOL_DOCUMENT));
    if (protocolDocumentSha256 !== p0Reference.protocolDocumentSha256) {
        throw new Error('The accepted protocol document does not match the P0 reference fingerprint.');
    }

    const phaseScope = PHASE_NAMES.filter((phase) => manifest.phaseScope.includes(phase));
    const thresholdByRow = new Map(
        manifest.practicalThresholds.map((row) => [
            rowKey(row.phase, row.scenario),
            row.minimumAbsoluteMeanDeltaMs,
        ]),
    );
    const p0ByRow = new Map(p0Reference.rows.map((row) => [rowKey(row.phase, row.scenario), row]));

    return {
        manifest,
        manifestPath: resolvedManifestPath,
        manifestSha256: sha256(manifestText),
        p0Reference,
        phaseScope,
        thresholdByRow,
        p0ByRow,
        baselineDirectory,
        candidateDirectory,
        recordPath: path.resolve(runnerRoot, DEFAULT_RECORD_PATH),
        outputRoot: path.resolve(runnerRoot, DEFAULT_OUTPUT_ROOT),
        benchmarkSourceSha256: baselineBenchmarkSha,
        protocolDocumentSha256,
    };
}

function assertCleanCommit(directory: string, expectedCommit: string, label: string): void {
    if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
        throw new Error(`${label} directory does not exist: ${directory}.`);
    }
    const actualCommit = git(directory, ['rev-parse', 'HEAD']);
    if (actualCommit !== expectedCommit) {
        throw new Error(`${label} commit ${actualCommit} does not match predeclared ${expectedCommit}.`);
    }
    const status = git(directory, ['status', '--porcelain']);
    if (status.length > 0) {
        throw new Error(`${label} worktree must be clean before timing.`);
    }
}

function executeCondition(
    admission: ValidatedAdmission,
    outputDirectory: string,
    pairIndex: number,
    condition: Condition,
    sequence: number,
): ProcessRun {
    const cwd = condition === 'baseline'
        ? admission.baselineDirectory
        : admission.candidateDirectory;
    const stem = `${String(sequence).padStart(2, '0')}-pair-${pairIndex}-${condition}`;
    const reportPath = path.join(outputDirectory, `${stem}.json`);
    const processPath = path.join(outputDirectory, `${stem}.process.json`);
    const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
    const args = [
        'exec',
        'ts-node',
        BENCHMARK_SOURCE,
        '--profile=pr',
        `--phases=${admission.phaseScope.join(',')}`,
        `--condition=${condition}`,
        `--candidate-id=${admission.manifest.candidate.id}`,
        `--pair-index=${pairIndex}`,
        `--output-file=${reportPath}`,
    ];
    const startedAt = new Date().toISOString();
    const result = spawnSync(command, args, {
        cwd,
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
        windowsHide: true,
    });
    const endedAt = new Date().toISOString();
    const processArtifact = {
        schemaVersion: 1,
        sequence,
        pairIndex,
        condition,
        command,
        args,
        cwd,
        startedAt,
        endedAt,
        exitCode: result.status,
        signal: result.signal,
        error: result.error?.message ?? null,
        stdout: result.stdout ?? '',
        stderr: result.stderr ?? '',
        reportPath,
    };
    writeJson(processPath, processArtifact);

    const report = fs.existsSync(reportPath)
        ? readJson<RawBenchmarkReport>(reportPath)
        : undefined;
    return {
        pairIndex,
        condition,
        sequence,
        reportPath,
        processPath,
        command,
        args,
        exitCode: result.status,
        report,
    };
}

function validateRawReport(
    run: ProcessRun,
    admission: ValidatedAdmission,
): void {
    const report = run.report;
    if (!report) {
        throw new Error(`Process ${run.sequence} did not write its raw benchmark report.`);
    }
    const expectedCommit = run.condition === 'baseline'
        ? admission.manifest.candidate.baseCommit
        : admission.manifest.candidate.candidateCommit;
    if (report.profile !== 'pr'
        || report.commit.sha !== expectedCommit
        || report.commit.dirty
        || report.method.warmupSamples !== 4
        || report.method.measuredSamples !== 20
        || report.method.invocationsPerSample !== 8
        || report.method.corpusSeed !== 'rawsql-ts-ast-phase-v1') {
        throw new Error(`Process ${run.sequence} did not preserve the predeclared P0 PR method.`);
    }
    if (stableSerialize(report.method.phaseScope) !== stableSerialize(admission.phaseScope)) {
        throw new Error(`Process ${run.sequence} did not preserve the predeclared phase scope.`);
    }
    const pairRun = report.pairRun;
    if (!pairRun
        || pairRun.candidateId !== admission.manifest.candidate.id
        || pairRun.condition !== run.condition
        || pairRun.pairIndex !== run.pairIndex) {
        throw new Error(`Process ${run.sequence} has incorrect pair metadata.`);
    }
    if (report.corpus.length !== SCENARIO_NAMES.length
        || stableSerialize(report.corpus.map((row) => row.name)) !== stableSerialize(SCENARIO_NAMES)) {
        throw new Error(`Process ${run.sequence} did not retain all seven P0 scenarios.`);
    }
    if (stableSerialize(report.phases.map((row) => row.name)) !== stableSerialize(PHASE_NAMES)) {
        throw new Error(`Process ${run.sequence} did not retain the six P0 phase definitions.`);
    }
    if (!report.failure) {
        const expectedRows = new Set(
            admission.phaseScope.flatMap((phase) => SCENARIO_NAMES.map((scenario) => rowKey(phase, scenario))),
        );
        const actualRows = new Set(report.results.map((row) => rowKey(row.phase, row.scenario)));
        if (actualRows.size !== expectedRows.size
            || report.results.length !== expectedRows.size
            || [...actualRows].some((key) => !expectedRows.has(key))) {
            throw new Error(`Process ${run.sequence} omitted or duplicated a declared phase/scenario row.`);
        }
    }
}

function comparePair(
    baseline: RawBenchmarkReport,
    candidate: RawBenchmarkReport,
    pairIndex: number,
): {
    deltas: Map<string, PairDelta>;
    mismatches: Map<string, NonNullable<OutcomeRow['semanticMismatchDetails']>[number]>;
} {
    for (const field of ['method', 'formatterOptions', 'corpus', 'phases'] as const) {
        const baselineValue = field === 'method'
            ? omitPairIndependentMethodFields(baseline.method)
            : baseline[field];
        const candidateValue = field === 'method'
            ? omitPairIndependentMethodFields(candidate.method)
            : candidate[field];
        if (stableSerialize(baselineValue) !== stableSerialize(candidateValue)) {
            throw new Error(`Baseline/candidate ${field} drifted in pair ${pairIndex}.`);
        }
    }

    const baselineRows = new Map(baseline.results.map((row) => [rowKey(row.phase, row.scenario), row]));
    const candidateRows = new Map(candidate.results.map((row) => [rowKey(row.phase, row.scenario), row]));
    const deltas = new Map<string, PairDelta>();
    const mismatches = new Map<
        string,
        NonNullable<OutcomeRow['semanticMismatchDetails']>[number]
    >();

    for (const phase of baseline.method.phaseScope) {
        for (const scenario of SCENARIO_NAMES) {
            const key = rowKey(phase, scenario);
            const baselineRow = baselineRows.get(key);
            const candidateRow = candidateRows.get(key);
            if (!baselineRow || !candidateRow) {
                continue;
            }
            if (compareSemanticSinks(baselineRow.semanticSink, candidateRow.semanticSink)
                === 'semantic_mismatch') {
                mismatches.set(key, {
                    pairIndex,
                    baselineSink: baselineRow.semanticSink,
                    candidateSink: candidateRow.semanticSink,
                });
                continue;
            }
            const delta = round9(candidateRow.stats.meanMs - baselineRow.stats.meanMs);
            deltas.set(key, {
                pairIndex,
                baselineMeanMs: baselineRow.stats.meanMs,
                candidateMeanMs: candidateRow.stats.meanMs,
                candidateMinusBaselineMeanMs: delta,
                direction: delta < 0 ? 'favorable' : delta > 0 ? 'adverse' : 'equal',
            });
        }
    }
    return { deltas, mismatches };
}

function omitPairIndependentMethodFields(method: RawBenchmarkReport['method']): RawBenchmarkReport['method'] {
    return method;
}

function buildOutcomeRows(
    admission: ValidatedAdmission,
    pairDeltas: Map<string, PairDelta[]>,
    mismatchRows: Set<string>,
    mismatchDetails: Map<
        string,
        NonNullable<OutcomeRow['semanticMismatchDetails']>
    >,
    internalMismatchRows: Set<string>,
    executionFailed: boolean,
): OutcomeRow[] {
    const hasSemanticMismatch = mismatchRows.size > 0 || internalMismatchRows.size > 0;
    return PHASE_NAMES.flatMap((phase) => SCENARIO_NAMES.map((scenario) => {
        const key = rowKey(phase, scenario);
        const p0Range = admission.p0ByRow.get(key)?.betweenProcessMeanRangeMs;
        if (p0Range === undefined) {
            throw new Error(`Missing P0 reference row ${key}.`);
        }
        if (!admission.phaseScope.includes(phase)) {
            return {
                phase,
                scenario,
                status: 'not_measured' as const,
                reason: 'Phase was outside the predeclared scope.',
                practicalThresholdMs: null,
                p0BetweenProcessMeanRangeMs: p0Range,
                sinkComparison: 'not_measured' as const,
                pairs: [],
            };
        }
        const threshold = admission.thresholdByRow.get(key) as number;
        const pairs = pairDeltas.get(key) ?? [];
        if (mismatchRows.has(key) || internalMismatchRows.has(key)) {
            return {
                phase,
                scenario,
                status: 'semantic_mismatch' as const,
                reason: 'A semantic sink mismatch stopped performance interpretation.',
                practicalThresholdMs: threshold,
                p0BetweenProcessMeanRangeMs: p0Range,
                sinkComparison: 'mismatch' as const,
                semanticMismatchDetails: mismatchDetails.get(key),
                pairs,
            };
        }
        if (hasSemanticMismatch) {
            return {
                phase,
                scenario,
                status: 'not_measured' as const,
                reason: 'Performance effect was not measured because another row had a semantic mismatch.',
                practicalThresholdMs: threshold,
                p0BetweenProcessMeanRangeMs: p0Range,
                sinkComparison: pairs.length > 0 ? 'matched' as const : 'not_measured' as const,
                pairs,
            };
        }
        if (executionFailed || pairs.length === 0) {
            return {
                phase,
                scenario,
                status: 'not_measured' as const,
                reason: 'The paired run did not complete this row.',
                practicalThresholdMs: threshold,
                p0BetweenProcessMeanRangeMs: p0Range,
                sinkComparison: 'not_measured' as const,
                pairs,
            };
        }
        if (admission.manifest.candidate.kind === 'self_comparison') {
            return {
                phase,
                scenario,
                status: 'not_measured' as const,
                reason: 'Demonstration-only self-comparison; no optimization effect is claimed.',
                practicalThresholdMs: threshold,
                p0BetweenProcessMeanRangeMs: p0Range,
                sinkComparison: 'matched' as const,
                pairs,
            };
        }
        if (admission.manifest.stage === 'screen') {
            return {
                phase,
                scenario,
                status: 'neutral_or_inconclusive' as const,
                reason: 'A one-pair screen cannot establish a performance effect.',
                practicalThresholdMs: threshold,
                p0BetweenProcessMeanRangeMs: p0Range,
                sinkComparison: 'matched' as const,
                pairs,
            };
        }

        const status = classifyConfirmationRow(
            pairs.map((pair) => pair.candidateMinusBaselineMeanMs),
            threshold,
            p0Range,
        );
        return {
            phase,
            scenario,
            status,
            reason: confirmationReason(status),
            practicalThresholdMs: threshold,
            p0BetweenProcessMeanRangeMs: p0Range,
            sinkComparison: 'matched' as const,
            pairs,
        };
    }));
}

function confirmationReason(status: PerformanceStatus): string {
    switch (status) {
        case 'repeatable_signal':
            return 'All three pairs were favorable and the median magnitude exceeded both guardrails.';
        case 'adverse_signal':
            return 'All three pairs were adverse and the median magnitude exceeded both guardrails.';
        default:
            return 'Direction, magnitude, practical threshold, or retained P0 range was inconclusive.';
    }
}

function aggregateStatus(rows: OutcomeRow[]): PerformanceStatus {
    if (rows.some((row) => row.status === 'semantic_mismatch')) {
        return 'semantic_mismatch';
    }
    if (rows.some((row) => row.status === 'adverse_signal')) {
        return 'adverse_signal';
    }
    if (rows.some((row) => row.status === 'repeatable_signal')) {
        return 'repeatable_signal';
    }
    if (rows.some((row) => row.status === 'neutral_or_inconclusive')) {
        return 'neutral_or_inconclusive';
    }
    return 'not_measured';
}

function appendMismatchDetail(
    target: Map<string, NonNullable<OutcomeRow['semanticMismatchDetails']>>,
    key: string,
    detail: NonNullable<OutcomeRow['semanticMismatchDetails']>[number],
): void {
    const existing = target.get(key) ?? [];
    if (!existing.some((candidate) => candidate.pairIndex === detail.pairIndex
        && stableSerialize(candidate.candidateSink) === stableSerialize(detail.candidateSink))) {
        target.set(key, [...existing, detail]);
    }
}

function run(manifestPath: string): void {
    const runnerRoot = process.cwd();
    const admission = validateAdmission(manifestPath, runnerRoot);
    const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${admission.manifest.candidate.id}`;
    const outputDirectory = path.join(admission.outputRoot, runId);
    fs.mkdirSync(outputDirectory, { recursive: false });

    const order = runOrderForStage(admission.manifest.stage);
    const admissionPath = path.join(outputDirectory, 'admission.json');
    writeJson(admissionPath, {
        schemaVersion: 1,
        runId,
        admittedAt: new Date().toISOString(),
        manifestPath: admission.manifestPath,
        manifestSha256: admission.manifestSha256,
        manifest: admission.manifest,
        environment: collectEnvironment(),
        p0Commit: admission.p0Reference.p0Commit,
        protocolDocumentSha256: admission.protocolDocumentSha256,
        benchmarkSourceSha256: admission.benchmarkSourceSha256,
        normalizedPhaseScope: admission.phaseScope,
        plannedOrder: order,
        sampling: { profile: 'pr', warmupSamples: 4, measuredSamples: 20, invocationsPerSample: 8 },
    });

    const runs: ProcessRun[] = [];
    const pairDeltas = new Map<string, PairDelta[]>();
    const mismatchRows = new Set<string>();
    const mismatchDetails = new Map<
        string,
        NonNullable<OutcomeRow['semanticMismatchDetails']>
    >();
    const internalMismatchRows = new Set<string>();
    const referenceSinks = new Map<string, Record<string, unknown>>();
    let executionFailed = false;

    for (const item of order) {
        if (mismatchRows.size > 0 || internalMismatchRows.size > 0 || executionFailed) {
            break;
        }
        const processRun = executeCondition(
            admission,
            outputDirectory,
            item.pairIndex,
            item.condition,
            runs.length + 1,
        );
        runs.push(processRun);
        if (processRun.report) {
            validateRawReport(processRun, admission);
            if (processRun.report.failure?.kind === 'semantic_mismatch') {
                internalMismatchRows.add(rowKey(
                    processRun.report.failure.phase,
                    processRun.report.failure.scenario,
                ));
            } else if (processRun.report.failure) {
                executionFailed = true;
            } else {
                for (const row of processRun.report.results) {
                    const key = rowKey(row.phase, row.scenario);
                    const referenceSink = referenceSinks.get(key);
                    if (!referenceSink) {
                        referenceSinks.set(key, row.semanticSink);
                    } else if (compareSemanticSinks(referenceSink, row.semanticSink)
                        === 'semantic_mismatch') {
                        mismatchRows.add(key);
                        appendMismatchDetail(mismatchDetails, key, {
                            pairIndex: item.pairIndex,
                            baselineSink: referenceSink,
                            candidateSink: row.semanticSink,
                        });
                    }
                }
            }
        }
        if (processRun.exitCode !== 0 && internalMismatchRows.size === 0) {
            executionFailed = true;
        }

        const pairRuns = runs.filter((run) => run.pairIndex === item.pairIndex);
        const baseline = pairRuns.find((candidate) => candidate.condition === 'baseline')?.report;
        const candidate = pairRuns.find((candidate) => candidate.condition === 'candidate')?.report;
        if (baseline && candidate && !baseline.failure && !candidate.failure) {
            const comparison = comparePair(baseline, candidate, item.pairIndex);
            for (const [mismatch, detail] of comparison.mismatches) {
                mismatchRows.add(mismatch);
                appendMismatchDetail(mismatchDetails, mismatch, detail);
            }
            for (const [key, delta] of comparison.deltas) {
                pairDeltas.set(key, [...(pairDeltas.get(key) ?? []), delta]);
            }
        }
    }

    const rows = buildOutcomeRows(
        admission,
        pairDeltas,
        mismatchRows,
        mismatchDetails,
        internalMismatchRows,
        executionFailed,
    );
    const status = aggregateStatus(rows);
    const completedOrder = runs.map((processRun) => ({
        sequence: processRun.sequence,
        pairIndex: processRun.pairIndex,
        condition: processRun.condition,
        command: processRun.command,
        args: processRun.args.map((arg) => arg.startsWith('--output-file=')
            ? `--output-file=${relativeToRoot(runnerRoot, processRun.reportPath)}`
            : arg),
        cwdRole: processRun.condition,
        exitCode: processRun.exitCode,
        reportPath: processRun.report
            ? relativeToRoot(runnerRoot, processRun.reportPath)
            : null,
        processPath: relativeToRoot(runnerRoot, processRun.processPath),
        commit: processRun.report?.commit ?? null,
        environment: processRun.report?.environment ?? null,
    }));
    const rawArtifacts = [
        relativeToRoot(runnerRoot, admissionPath),
        ...runs.flatMap((processRun) => [
            ...(processRun.report ? [relativeToRoot(runnerRoot, processRun.reportPath)] : []),
            relativeToRoot(runnerRoot, processRun.processPath),
        ]),
    ];
    const escalationDecision = status === 'semantic_mismatch'
        ? 'reject_or_repair_candidate'
        : admission.manifest.candidate.kind === 'self_comparison'
            ? 'demonstration_only'
            : admission.manifest.stage === 'screen'
                ? 'human_decision_required_before_confirmation'
                : status === 'repeatable_signal'
                    ? 'full_profile_required_before_adoption'
                    : 'reject_defer_or_human_directed_escalation';
    const record = {
        recordVersion: 1,
        runId,
        recordedAt: new Date().toISOString(),
        candidate: admission.manifest.candidate,
        stage: admission.manifest.stage,
        status,
        escalationDecision,
        phaseScope: admission.phaseScope,
        scopeRationale: admission.manifest.scopeRationale,
        protocol: {
            p0Commit: admission.p0Reference.p0Commit,
            protocolDocumentSha256: admission.protocolDocumentSha256,
            benchmarkSourceSha256: admission.benchmarkSourceSha256,
            manifestSha256: admission.manifestSha256,
        },
        commands: completedOrder,
        rawArtifacts,
        failures: runs
            .filter((processRun) => processRun.exitCode !== 0 || processRun.report?.failure)
            .map((processRun) => ({
                sequence: processRun.sequence,
                pairIndex: processRun.pairIndex,
                condition: processRun.condition,
                exitCode: processRun.exitCode,
                failure: processRun.report?.failure ?? null,
                processPath: relativeToRoot(runnerRoot, processRun.processPath),
            })),
        scenarioRows: rows,
        limitation: admission.manifest.candidate.limitation,
    };
    const summaryPath = path.join(outputDirectory, 'paired-summary.json');
    writeJson(summaryPath, record);
    fs.mkdirSync(path.dirname(admission.recordPath), { recursive: true });
    fs.appendFileSync(admission.recordPath, `${JSON.stringify({
        ...record,
        rawArtifacts: [...record.rawArtifacts, relativeToRoot(runnerRoot, summaryPath)],
    })}\n`, 'utf8');

    console.log(`Paired status: ${status}`);
    console.log(`Escalation: ${escalationDecision}`);
    console.log(`Summary saved to ${relativeToRoot(runnerRoot, summaryPath)}`);
    console.log(`Candidate record appended to ${relativeToRoot(runnerRoot, admission.recordPath)}`);
    if (status === 'semantic_mismatch' || executionFailed) {
        process.exitCode = 1;
    }
}

function parseManifestArg(): string {
    const arg = process.argv.find((candidate) => candidate.startsWith('--manifest='));
    if (!arg) {
        throw new Error('--manifest=<path> is required.');
    }
    return arg.slice('--manifest='.length);
}

function collectEnvironment(): Record<string, unknown> {
    return {
        node: process.version,
        platform: os.type(),
        release: os.release(),
        architecture: os.arch(),
        cpu: os.cpus()[0]?.model ?? 'unknown',
        logicalCores: os.cpus().length,
        processId: process.pid,
    };
}

function allRowKeys(): string[] {
    return PHASE_NAMES.flatMap((phase) => SCENARIO_NAMES.map((scenario) => rowKey(phase, scenario)));
}

function rowKey(phase: string, scenario: string): string {
    return `${phase}::${scenario}`;
}

function median(values: number[]): number {
    const sorted = [...values].sort((left, right) => left - right);
    return sorted[Math.floor(sorted.length / 2)];
}

function round9(value: number): number {
    return Math.round(value * 1_000_000_000) / 1_000_000_000;
}

function hashFile(filePath: string): string {
    const normalizedText = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
    return sha256(normalizedText);
}

function sha256(value: string | Buffer): string {
    return createHash('sha256').update(value).digest('hex');
}

function git(directory: string, args: string[]): string {
    return execFileSync('git', ['-C', directory, ...args], { encoding: 'utf8' }).trim();
}

function readJson<T>(filePath: string): T {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function writeJson(filePath: string, value: unknown): void {
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2), { encoding: 'utf8', flag: 'wx' });
}

function relativeToRoot(root: string, filePath: string): string {
    return path.relative(root, filePath).replace(/\\/g, '/');
}

function stableSerialize(value: unknown): string {
    if (value === undefined) {
        return '{"$benchmarkType":"undefined"}';
    }
    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
    }
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
        .sort()
        .filter((key) => record[key] !== undefined)
        .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`);
    return `{${entries.join(',')}}`;
}

if (require.main === module) {
    try {
        run(parseManifestArg());
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    }
}
