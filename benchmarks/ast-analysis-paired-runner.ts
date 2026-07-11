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
export type Stage = 'screen' | 'confirmation' | 'full_profile';
type ProfileName = 'pr' | 'full';
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
    screenRunId?: string;
    confirmationRunId?: string;
}

export interface P0Reference {
    schemaVersion: 1;
    p0Commit: string;
    profile: 'pr';
    sourceDocument: string;
    p0SourceDocumentSha256: string;
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
        warmupSamples: number;
        measuredSamples: number;
        invocationsPerSample: number;
        rawSamplesMs: number[];
        stats: {
            meanMs: number;
            p95Ms: number;
            stddevMs: number;
            minMs: number;
            maxMs: number;
            sampleCount: number;
        };
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

export interface OutcomeRow {
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
    reportReadError?: string;
}

export interface ValidatedAdmission {
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
    p0SourceDocumentSha256: string;
    p0ReferenceSha256: string;
    tsNodeCliPath: string;
    executionPhaseScope: PhaseName[];
    profile: ProfileName;
    sampling: {
        warmupSamples: number;
        measuredSamples: number;
        invocationsPerSample: number;
    };
}

export interface PriorCandidateRecord {
    runId: string;
    stage: Stage;
    status: PerformanceStatus;
    candidate: CandidateManifest['candidate'];
    phaseScope: PhaseName[];
    scopeRationale: string;
    practicalThresholds: CandidateManifest['practicalThresholds'];
    protocol: {
        p0Commit: string;
        protocolDocumentSha256: string;
        benchmarkSourceSha256: string;
        p0ReferenceSha256: string;
        manifestSha256?: string;
    };
    failures: unknown[];
    screenRunId?: string | null;
    escalationDecision?: string;
    commands?: Array<{
        sequence: number;
        pairIndex: number;
        condition: Condition;
        command?: string;
        args: string[];
        cwdRole?: Condition;
        exitCode: number | null;
        reportPath: string | null;
        processPath: string;
        commit: { sha: string; dirty: boolean } | null;
        environment: Record<string, unknown> | null;
    }>;
    rawArtifacts?: string[];
    scenarioRows?: OutcomeRow[];
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

export function runOrderForManifest(
    manifest: Pick<CandidateManifest, 'stage' | 'candidate'>,
): Array<{ pairIndex: number; condition: Condition }> {
    if (manifest.stage === 'full_profile' && manifest.candidate.kind === 'self_comparison') {
        return runOrderForStage('screen');
    }
    return runOrderForStage(manifest.stage);
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
        || !/^[0-9a-f]{64}$/.test(reference.p0SourceDocumentSha256)
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
        if (![row.minimumMeanMs, row.maximumMeanMs, row.betweenProcessMeanRangeMs]
            .every((value) => Number.isFinite(value))
            || row.minimumMeanMs < 0
            || row.maximumMeanMs < row.minimumMeanMs
            || row.betweenProcessMeanRangeMs < 0
            || computedRange !== round9(row.betweenProcessMeanRangeMs)) {
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
    if (manifest.stage !== 'screen'
        && manifest.stage !== 'confirmation'
        && manifest.stage !== 'full_profile') {
        throw new Error('stage must be screen, confirmation, or full_profile.');
    }
    if (manifest.stage === 'confirmation' && !manifest.screenRunId?.trim()) {
        throw new Error('A confirmation manifest must reference its admitted screenRunId.');
    }
    if (manifest.stage !== 'confirmation' && manifest.screenRunId !== undefined) {
        throw new Error('Only a confirmation manifest may reference a prior screenRunId.');
    }
    if (manifest.stage === 'full_profile'
        && manifest.candidate?.kind === 'candidate'
        && !manifest.confirmationRunId?.trim()) {
        throw new Error('A candidate full_profile manifest must reference its committed confirmationRunId.');
    }
    if (manifest.stage !== 'full_profile' && manifest.confirmationRunId !== undefined) {
        throw new Error('Only a full_profile manifest may reference a prior confirmationRunId.');
    }
    if (manifest.stage === 'full_profile'
        && manifest.candidate?.kind === 'self_comparison'
        && manifest.confirmationRunId !== undefined) {
        throw new Error('A full-profile self_comparison must not inherit a real candidate confirmation.');
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
        if (manifest.stage !== 'screen' && manifest.stage !== 'full_profile') {
            throw new Error('A self_comparison demonstration must use the screen or full_profile stage.');
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
    if (manifest.stage === 'full_profile'
        && manifest.candidate.kind === 'self_comparison'
        && stableSerialize(PHASE_NAMES) !== stableSerialize(manifest.phaseScope)) {
        throw new Error('A full-profile self_comparison must declare all six P0 phases.');
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
    const p0ReferenceSha256 = normalizedFileSha256(p0ReferencePath);
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
    const baselineBenchmarkSha = normalizedFileSha256(baselineBenchmarkPath);
    const candidateBenchmarkSha = normalizedFileSha256(candidateBenchmarkPath);
    if (baselineBenchmarkSha !== candidateBenchmarkSha) {
        throw new Error('Baseline and candidate benchmark sources differ; paired evidence would not share one protocol.');
    }
    if (baselineBenchmarkSha !== p0Reference.pairedBenchmarkSourceSha256) {
        throw new Error('The benchmark source does not match the admitted paired-protocol fingerprint.');
    }

    const protocolDocumentSha256 = normalizedFileSha256(path.resolve(runnerRoot, PROTOCOL_DOCUMENT));
    if (protocolDocumentSha256 !== p0Reference.protocolDocumentSha256) {
        throw new Error('The accepted protocol document does not match the P0 reference fingerprint.');
    }
    const p0SourceDocumentSha256 = normalizedFileSha256(
        path.resolve(runnerRoot, p0Reference.sourceDocument),
    );
    if (p0SourceDocumentSha256 !== p0Reference.p0SourceDocumentSha256) {
        throw new Error('The P0 source document does not match the machine-readable reference.');
    }

    const phaseScope = PHASE_NAMES.filter((phase) => manifest.phaseScope.includes(phase));
    const executionPhaseScope = manifest.stage === 'full_profile'
        ? [...PHASE_NAMES]
        : phaseScope;
    const profile: ProfileName = manifest.stage === 'full_profile' ? 'full' : 'pr';
    const sampling = profile === 'full'
        ? { warmupSamples: 8, measuredSamples: 50, invocationsPerSample: 16 }
        : { warmupSamples: 4, measuredSamples: 20, invocationsPerSample: 8 };
    const thresholdByRow = new Map(
        manifest.practicalThresholds.map((row) => [
            rowKey(row.phase, row.scenario),
            row.minimumAbsoluteMeanDeltaMs,
        ]),
    );
    const p0ByRow = new Map(p0Reference.rows.map((row) => [rowKey(row.phase, row.scenario), row]));
    const recordPath = path.resolve(runnerRoot, DEFAULT_RECORD_PATH);
    if (manifest.stage === 'confirmation') {
        validateConfirmationLink(
            manifest,
            recordPath,
            runnerRoot,
            phaseScope,
            protocolDocumentSha256,
            baselineBenchmarkSha,
            p0ReferenceSha256,
        );
    } else if (manifest.stage === 'full_profile' && manifest.candidate.kind === 'candidate') {
        validateFullProfileLink(
            manifest,
            recordPath,
            runnerRoot,
            phaseScope,
            protocolDocumentSha256,
            baselineBenchmarkSha,
            p0ReferenceSha256,
        );
    }

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
        recordPath,
        outputRoot: path.resolve(runnerRoot, DEFAULT_OUTPUT_ROOT),
        benchmarkSourceSha256: baselineBenchmarkSha,
        protocolDocumentSha256,
        p0SourceDocumentSha256,
        p0ReferenceSha256,
        tsNodeCliPath: require.resolve('ts-node/dist/bin.js'),
        executionPhaseScope,
        profile,
        sampling,
    };
}

function validateConfirmationLink(
    manifest: CandidateManifest,
    recordPath: string,
    runnerRoot: string,
    phaseScope: PhaseName[],
    protocolDocumentSha256: string,
    benchmarkSourceSha256: string,
    p0ReferenceSha256: string,
): void {
    const records = readCommittedRecords(recordPath, runnerRoot, 'Confirmation');
    const screen = records.find((record) => record.runId === manifest.screenRunId);
    if (!screen) {
        throw new Error(`No screen record was found for ${manifest.screenRunId}.`);
    }
    validateCompleteScreenEvidence(screen, manifest, phaseScope);
    validateConfirmationRecord(
        manifest,
        screen,
        phaseScope,
        protocolDocumentSha256,
        benchmarkSourceSha256,
        p0ReferenceSha256,
    );
}

function validateFullProfileLink(
    manifest: CandidateManifest,
    recordPath: string,
    runnerRoot: string,
    phaseScope: PhaseName[],
    protocolDocumentSha256: string,
    benchmarkSourceSha256: string,
    p0ReferenceSha256: string,
): void {
    const records = readCommittedRecords(recordPath, runnerRoot, 'Full profile');
    const confirmation = records.find((record) => record.runId === manifest.confirmationRunId);
    if (!confirmation) {
        throw new Error(`No confirmation record was found for ${manifest.confirmationRunId}.`);
    }
    const screen = records.find((record) => record.runId === confirmation.screenRunId);
    if (!screen) {
        throw new Error(`No predecessor screen record was found for ${confirmation.screenRunId}.`);
    }
    validateConfirmationRecord(
        manifest,
        screen,
        phaseScope,
        protocolDocumentSha256,
        benchmarkSourceSha256,
        p0ReferenceSha256,
    );
    validateFullProfileRecord(
        manifest,
        confirmation,
        phaseScope,
        protocolDocumentSha256,
        benchmarkSourceSha256,
        p0ReferenceSha256,
    );
}

function readCommittedRecords(
    recordPath: string,
    runnerRoot: string,
    stageLabel: string,
): PriorCandidateRecord[] {
    if (!fs.existsSync(recordPath)) {
        throw new Error(`${stageLabel} requires the tracked append-only candidate record.`);
    }
    const recordRelativePath = relativeToRoot(runnerRoot, recordPath);
    if (recordRelativePath.startsWith('../') || path.isAbsolute(recordRelativePath)) {
        throw new Error('The candidate record must be inside the controller repository.');
    }
    try {
        git(runnerRoot, ['ls-files', '--error-unmatch', '--', recordRelativePath]);
    } catch {
        throw new Error(`${stageLabel} requires a Git-tracked candidate record.`);
    }
    if (git(runnerRoot, ['status', '--porcelain', '--', recordRelativePath]).length > 0) {
        throw new Error(`${stageLabel} requires the candidate record to match committed HEAD content.`);
    }
    return git(runnerRoot, ['show', `HEAD:${recordRelativePath}`])
        .split(/\r?\n/)
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line) as PriorCandidateRecord);
}

function validateCompleteScreenEvidence(
    screen: PriorCandidateRecord,
    manifest: CandidateManifest,
    phaseScope: PhaseName[],
): void {
    if (!Array.isArray(screen.failures) || screen.failures.length !== 0) {
        throw new Error('Confirmation requires an empty screen failures array.');
    }
    if (!/^[0-9a-f]{64}$/.test(screen.protocol?.manifestSha256 ?? '')) {
        throw new Error('Confirmation requires a lowercase 64-hex screen manifest SHA-256.');
    }

    const expectedOrder = runOrderForStage('screen');
    const expectedPhaseArg = `--phases=${phaseScope.join(',')}`;
    const commands = screen.commands;
    const commandRecords = Array.isArray(commands) ? commands : [];
    const commandsComplete = commandRecords.length === expectedOrder.length
        && commandRecords.every((command, index) => {
            if (command === null || typeof command !== 'object') {
                return false;
            }
            const expected = expectedOrder[index];
            const expectedCommit = command.condition === 'baseline'
                ? manifest.candidate.baseCommit
                : manifest.candidate.candidateCommit;
            const reportPath = command.reportPath;
            return command.sequence === index + 1
                && command.pairIndex === expected.pairIndex
                && command.condition === expected.condition
                && command.command === 'node'
                && command.cwdRole === expected.condition
                && typeof reportPath === 'string'
                && reportPath.length > 0
                && typeof command.processPath === 'string'
                && command.processPath.length > 0
                && stableSerialize(command.args) === stableSerialize([
                    '<ts-node-cli>',
                    BENCHMARK_SOURCE,
                    '--profile=pr',
                    expectedPhaseArg,
                    `--condition=${expected.condition}`,
                    `--candidate-id=${manifest.candidate.id}`,
                    '--pair-index=1',
                    `--output-file=${reportPath}`,
                ])
                && command.exitCode === 0
                && command.commit?.sha === expectedCommit
                && command.commit.dirty === false
                && command.environment !== null
                && typeof command.environment === 'object'
                && !Array.isArray(command.environment);
        });
    if (!commandsComplete) {
        throw new Error('Confirmation requires exactly two successful screen command records in planned order.');
    }

    const artifacts = screen.rawArtifacts;
    const artifactValues = Array.isArray(artifacts) ? artifacts : [];
    const artifactSet = new Set(artifactValues);
    const artifactIndexComplete = artifactValues.length === 6
        && artifactValues.every((artifact) => typeof artifact === 'string' && artifact.length > 0)
        && artifactSet.size === 6
        && [...artifactSet].some((artifact) => artifact.endsWith('/admission.json'))
        && [...artifactSet].some((artifact) => artifact.endsWith('/paired-summary.json'))
        && commandRecords.every((command) => command.reportPath !== null
            && artifactSet.has(command.reportPath)
            && artifactSet.has(command.processPath));
    if (!artifactIndexComplete) {
        throw new Error('Confirmation requires the complete six-entry screen raw-artifact index.');
    }

    const scenarioRows = screen.scenarioRows;
    const expectedRowKeys = allRowKeys();
    if (!Array.isArray(scenarioRows)
        || scenarioRows.length !== expectedRowKeys.length
        || !scenarioRows.every((row) => row !== null && typeof row === 'object')) {
        throw new Error('Confirmation requires exactly 42 unique screen scenario rows.');
    }
    const scenarioKeys = new Set(scenarioRows.map((row) => rowKey(row.phase, row.scenario)));
    if (scenarioKeys.size !== expectedRowKeys.length
        || !expectedRowKeys.every((key) => scenarioKeys.has(key))) {
        throw new Error('Confirmation requires exactly 42 unique screen scenario rows.');
    }

    const thresholdByRow = new Map(normalizeThresholds(manifest).map((threshold) => [
        rowKey(threshold.phase, threshold.scenario),
        threshold.minimumAbsoluteMeanDeltaMs,
    ]));
    const inScopeEvidenceComplete = scenarioRows
        .filter((row) => phaseScope.includes(row.phase))
        .every((row) => {
            const threshold = thresholdByRow.get(rowKey(row.phase, row.scenario));
            const pair = row.pairs?.[0];
            return row.status === 'neutral_or_inconclusive'
                && row.sinkComparison === 'matched'
                && row.practicalThresholdMs === threshold
                && Number.isFinite(row.p0BetweenProcessMeanRangeMs)
                && row.p0BetweenProcessMeanRangeMs >= 0
                && Array.isArray(row.pairs)
                && row.pairs.length === 1
                && pair?.pairIndex === 1
                && [
                    pair?.baselineMeanMs,
                    pair?.candidateMeanMs,
                    pair?.candidateMinusBaselineMeanMs,
                ].every(Number.isFinite)
                && (pair?.direction === 'favorable'
                    || pair?.direction === 'adverse'
                    || pair?.direction === 'equal');
        });
    if (!inScopeEvidenceComplete) {
        throw new Error('Confirmation requires complete in-scope screen comparison, sink, and threshold evidence.');
    }

    const outOfScopeEvidenceComplete = scenarioRows
        .filter((row) => !phaseScope.includes(row.phase))
        .every((row) => row.status === 'not_measured'
            && row.sinkComparison === 'not_measured'
            && row.practicalThresholdMs === null
            && Number.isFinite(row.p0BetweenProcessMeanRangeMs)
            && row.p0BetweenProcessMeanRangeMs >= 0
            && Array.isArray(row.pairs)
            && row.pairs.length === 0);
    if (!outOfScopeEvidenceComplete) {
        throw new Error('Confirmation requires not_measured screen rows outside the declared scope.');
    }
}

export function validateConfirmationRecord(
    manifest: CandidateManifest,
    screen: PriorCandidateRecord,
    phaseScope: PhaseName[],
    protocolDocumentSha256: string,
    benchmarkSourceSha256: string,
    p0ReferenceSha256: string,
): void {
    const candidateMatches = stableSerialize(screen.candidate) === stableSerialize(manifest.candidate);
    const thresholdsMatch = stableSerialize(screen.practicalThresholds)
        === stableSerialize(normalizeThresholds(manifest));
    const protocolMatches = screen.protocol?.p0Commit === P0_COMMIT
        && screen.protocol.protocolDocumentSha256 === protocolDocumentSha256
        && screen.protocol.benchmarkSourceSha256 === benchmarkSourceSha256
        && screen.protocol.p0ReferenceSha256 === p0ReferenceSha256;
    if (screen.stage !== 'screen'
        || screen.status !== 'neutral_or_inconclusive'
        || screen.failures?.length !== 0
        || !candidateMatches
        || stableSerialize(screen.phaseScope) !== stableSerialize(phaseScope)
        || screen.scopeRationale !== manifest.scopeRationale
        || !thresholdsMatch
        || !protocolMatches) {
        throw new Error('Confirmation must exactly inherit a successful screen candidate, scope, thresholds, rationale, and protocol.');
    }
}

export function validateFullProfileRecord(
    manifest: CandidateManifest,
    confirmation: PriorCandidateRecord,
    phaseScope: PhaseName[],
    protocolDocumentSha256: string,
    benchmarkSourceSha256: string,
    p0ReferenceSha256: string,
): void {
    const candidateMatches = stableSerialize(confirmation.candidate)
        === stableSerialize(manifest.candidate);
    const thresholdsMatch = stableSerialize(confirmation.practicalThresholds)
        === stableSerialize(normalizeThresholds(manifest));
    const protocolMatches = confirmation.protocol?.p0Commit === P0_COMMIT
        && confirmation.protocol.protocolDocumentSha256 === protocolDocumentSha256
        && confirmation.protocol.benchmarkSourceSha256 === benchmarkSourceSha256
        && confirmation.protocol.p0ReferenceSha256 === p0ReferenceSha256;
    const eligibleStatus = confirmation.status === 'repeatable_signal'
        || confirmation.status === 'adverse_signal'
        || confirmation.status === 'neutral_or_inconclusive';
    const completeEvidence = hasCompleteConfirmationEvidence(confirmation, phaseScope);
    if (confirmation.stage !== 'confirmation'
        || !eligibleStatus
        || confirmation.failures?.length !== 0
        || !completeEvidence
        || !candidateMatches
        || stableSerialize(confirmation.phaseScope) !== stableSerialize(phaseScope)
        || confirmation.scopeRationale !== manifest.scopeRationale
        || !thresholdsMatch
        || !protocolMatches) {
        throw new Error('Full profile must exactly inherit an admissible committed confirmation candidate, scope, thresholds, rationale, and protocol.');
    }
}

function hasCompleteConfirmationEvidence(
    confirmation: PriorCandidateRecord,
    phaseScope: PhaseName[],
): boolean {
    const expectedOrder = runOrderForStage('confirmation');
    const expectedPhaseArg = `--phases=${phaseScope.join(',')}`;
    const commands = confirmation.commands ?? [];
    const commandsComplete = commands.length === expectedOrder.length
        && commands.every((command, index) => {
            const expected = expectedOrder[index];
            const expectedCommit = command.condition === 'baseline'
                ? confirmation.candidate.baseCommit
                : confirmation.candidate.candidateCommit;
            return command.sequence === index + 1
                && command.pairIndex === expected.pairIndex
                && command.condition === expected.condition
                && command.args.includes('--profile=pr')
                && command.args.includes(expectedPhaseArg)
                && command.exitCode === 0
                && typeof command.reportPath === 'string'
                && command.reportPath.length > 0
                && typeof command.processPath === 'string'
                && command.processPath.length > 0
                && command.commit?.sha === expectedCommit
                && command.commit.dirty === false
                && command.environment !== null;
        });

    const artifacts = new Set(confirmation.rawArtifacts ?? []);
    const artifactIndexComplete = artifacts.size === 14
        && [...artifacts].some((artifact) => artifact.endsWith('/admission.json'))
        && [...artifacts].some((artifact) => artifact.endsWith('/paired-summary.json'))
        && commands.every((command) => command.reportPath !== null
            && artifacts.has(command.reportPath)
            && artifacts.has(command.processPath));

    const scenarioRows = confirmation.scenarioRows ?? [];
    const scenarioKeys = new Set(scenarioRows.map((row) => rowKey(row.phase, row.scenario)));
    const allowedStatuses = new Set<PerformanceStatus>([
        'repeatable_signal',
        'adverse_signal',
        'neutral_or_inconclusive',
        'not_measured',
    ]);
    const thresholdByRow = new Map(confirmation.practicalThresholds.map((threshold) => [
        rowKey(threshold.phase, threshold.scenario),
        threshold.minimumAbsoluteMeanDeltaMs,
    ]));
    const rowsComplete = scenarioRows.length === allRowKeys().length
        && scenarioKeys.size === allRowKeys().length
        && allRowKeys().every((key) => scenarioKeys.has(key))
        && scenarioRows.every((row) => {
            const declared = phaseScope.includes(row.phase);
            if (!allowedStatuses.has(row.status)
                || !Number.isFinite(row.p0BetweenProcessMeanRangeMs)
                || row.p0BetweenProcessMeanRangeMs < 0) {
                return false;
            }
            if (!declared) {
                return row.status === 'not_measured'
                    && row.sinkComparison === 'not_measured'
                    && row.practicalThresholdMs === null
                    && row.pairs.length === 0;
            }
            const threshold = thresholdByRow.get(rowKey(row.phase, row.scenario));
            return row.status !== 'not_measured'
                && row.sinkComparison === 'matched'
                && row.practicalThresholdMs === threshold
                && row.pairs.length === 3
                && row.pairs.every((pair, index) => pair.pairIndex === index + 1
                    && [
                        pair.baselineMeanMs,
                        pair.candidateMeanMs,
                        pair.candidateMinusBaselineMeanMs,
                    ].every(Number.isFinite));
        })
        && aggregateStatus(scenarioRows) === confirmation.status;

    return typeof confirmation.screenRunId === 'string'
        && confirmation.screenRunId.length > 0
        && typeof confirmation.escalationDecision === 'string'
        && confirmation.escalationDecision.length > 0
        && /^[0-9a-f]{64}$/.test(confirmation.protocol?.manifestSha256 ?? '')
        && commandsComplete
        && artifactIndexComplete
        && rowsComplete;
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
    const command = process.execPath;
    const args = [
        admission.tsNodeCliPath,
        path.join(cwd, BENCHMARK_SOURCE),
        `--profile=${admission.profile}`,
        `--phases=${admission.executionPhaseScope.join(',')}`,
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
        env: sanitizedGitEnvironment(),
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

    let report: RawBenchmarkReport | undefined;
    let reportReadError: string | undefined;
    if (fs.existsSync(reportPath)) {
        try {
            report = readJson<RawBenchmarkReport>(reportPath);
        } catch (error) {
            reportReadError = error instanceof Error ? error.message : String(error);
        }
    }
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
        reportReadError,
    };
}

function validateRawReport(
    run: ProcessRun,
    admission: ValidatedAdmission,
): void {
    const report = run.report;
    if (run.reportReadError) {
        throw new Error(`Process ${run.sequence} wrote invalid JSON: ${run.reportReadError}`);
    }
    if (!report) {
        throw new Error(`Process ${run.sequence} did not write its raw benchmark report.`);
    }
    const expectedCommit = run.condition === 'baseline'
        ? admission.manifest.candidate.baseCommit
        : admission.manifest.candidate.candidateCommit;
    if (report.profile !== admission.profile
        || report.commit.sha !== expectedCommit
        || report.commit.dirty
        || report.method.warmupSamples !== admission.sampling.warmupSamples
        || report.method.measuredSamples !== admission.sampling.measuredSamples
        || report.method.invocationsPerSample !== admission.sampling.invocationsPerSample
        || report.method.corpusSeed !== 'rawsql-ts-ast-phase-v1') {
        throw new Error(`Process ${run.sequence} did not preserve the predeclared ${admission.profile} method.`);
    }
    if (stableSerialize(report.method.phaseScope)
        !== stableSerialize(admission.executionPhaseScope)) {
        throw new Error(`Process ${run.sequence} did not preserve the executed phase scope.`);
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
    for (const row of report.results) {
        const sink = row.semanticSink as { kind?: unknown; signatureSha256?: unknown; summary?: unknown };
        const stats = [
            row.stats.meanMs,
            row.stats.p95Ms,
            row.stats.stddevMs,
            row.stats.minMs,
            row.stats.maxMs,
        ];
        if (row.warmupSamples !== admission.sampling.warmupSamples
            || row.measuredSamples !== admission.sampling.measuredSamples
            || row.invocationsPerSample !== admission.sampling.invocationsPerSample
            || row.rawSamplesMs.length !== admission.sampling.measuredSamples
            || !row.rawSamplesMs.every((sample) => Number.isFinite(sample) && sample >= 0)
            || row.stats.sampleCount !== admission.sampling.measuredSamples
            || !stats.every((value) => Number.isFinite(value) && value >= 0)
            || typeof sink.kind !== 'string'
            || typeof sink.signatureSha256 !== 'string'
            || !/^[0-9a-f]{64}$/.test(sink.signatureSha256)
            || !sink.summary
            || typeof sink.summary !== 'object') {
            throw new Error(`Process ${run.sequence} has invalid raw samples, stats, or semantic sink data.`);
        }
    }
    if (!report.failure) {
        const expectedRows = new Set(
            admission.executionPhaseScope.flatMap(
                (phase) => SCENARIO_NAMES.map((scenario) => rowKey(phase, scenario)),
            ),
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
    if (stableSerialize(stableEnvironment(baseline.environment))
        !== stableSerialize(stableEnvironment(candidate.environment))) {
        throw new Error(`Baseline/candidate environment drifted in pair ${pairIndex}.`);
    }
    for (const field of ['method', 'formatterOptions', 'corpus', 'phases'] as const) {
        const baselineValue = baseline[field];
        const candidateValue = candidate[field];
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

function stableEnvironment(environment: Record<string, unknown>): Record<string, unknown> {
    const keys = [
        'node',
        'pnpm',
        'platform',
        'release',
        'architecture',
        'cpu',
        'logicalCores',
        'launcher',
    ];
    return Object.fromEntries(keys.map((key) => [key, environment[key]]));
}

export function buildOutcomeRows(
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
        if (!admission.executionPhaseScope.includes(phase)) {
            return {
                phase,
                scenario,
                status: 'not_measured' as const,
                reason: 'Phase was outside the executed scope.',
                practicalThresholdMs: null,
                p0BetweenProcessMeanRangeMs: p0Range,
                sinkComparison: 'not_measured' as const,
                pairs: [],
            };
        }
        const threshold = admission.thresholdByRow.get(key) ?? null;
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
        if (!admission.phaseScope.includes(phase)) {
            return {
                phase,
                scenario,
                status: 'not_measured' as const,
                reason: 'The full profile retained timing and semantic evidence, but this phase was outside the inherited declared effect scope.',
                practicalThresholdMs: null,
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
        if (admission.manifest.stage === 'full_profile') {
            return {
                phase,
                scenario,
                status: 'neutral_or_inconclusive' as const,
                reason: 'The full profile retained three paired observations for human adoption or rejection review; the accepted protocol defines no automatic full-profile verdict.',
                practicalThresholdMs: threshold,
                p0BetweenProcessMeanRangeMs: p0Range,
                sinkComparison: 'matched' as const,
                pairs,
            };
        }

        const status = classifyConfirmationRow(
            pairs.map((pair) => pair.candidateMinusBaselineMeanMs),
            threshold as number,
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

export interface PairedRunResult {
    status: PerformanceStatus;
    executionFailed: boolean;
    summaryPath: string;
    recordPath: string;
}

export function runPairedBenchmark(
    manifestPath: string,
    runnerRoot = process.cwd(),
): PairedRunResult {
    const admission = validateAdmission(manifestPath, runnerRoot);
    const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${admission.manifest.candidate.id}`;
    const outputDirectory = path.join(admission.outputRoot, runId);
    fs.mkdirSync(admission.outputRoot, { recursive: true });
    fs.mkdirSync(outputDirectory, { recursive: false });

    const order = runOrderForManifest(admission.manifest);
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
        p0ReferenceSha256: admission.p0ReferenceSha256,
        protocolDocumentSha256: admission.protocolDocumentSha256,
        benchmarkSourceSha256: admission.benchmarkSourceSha256,
        normalizedPhaseScope: admission.phaseScope,
        executedPhaseScope: admission.executionPhaseScope,
        plannedOrder: order,
        sampling: { profile: admission.profile, ...admission.sampling },
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
    let referenceEnvironment: Record<string, unknown> | null = null;
    let executionFailed = false;
    let orchestrationFailure: string | null = null;

    try {
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
            validateRawReport(processRun, admission);
            const report = processRun.report as RawBenchmarkReport;
            const environment = stableEnvironment(report.environment);
            if (!referenceEnvironment) {
                referenceEnvironment = environment;
            } else if (stableSerialize(referenceEnvironment) !== stableSerialize(environment)) {
                throw new Error(`Stable environment drifted in process ${processRun.sequence}.`);
            }
            if (report.failure?.kind === 'semantic_mismatch') {
                internalMismatchRows.add(rowKey(
                    report.failure.phase,
                    report.failure.scenario,
                ));
            } else if (report.failure) {
                executionFailed = true;
            } else {
                for (const row of report.results) {
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
    } catch (error) {
        executionFailed = true;
        orchestrationFailure = error instanceof Error ? error.message : String(error);
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
        command: 'node',
        args: processRun.args.map((arg, index) => {
            if (index === 0) {
                return '<ts-node-cli>';
            }
            if (index === 1) {
                return BENCHMARK_SOURCE;
            }
            return arg.startsWith('--output-file=')
                ? `--output-file=${relativeToRoot(runnerRoot, processRun.reportPath)}`
                : arg;
        }),
        cwdRole: processRun.condition,
        exitCode: processRun.exitCode,
        reportPath: fs.existsSync(processRun.reportPath)
            ? relativeToRoot(runnerRoot, processRun.reportPath)
            : null,
        processPath: relativeToRoot(runnerRoot, processRun.processPath),
        commit: processRun.report?.commit ?? null,
        environment: processRun.report?.environment ?? null,
    }));
    const rawArtifacts = [
        relativeToRoot(runnerRoot, admissionPath),
        ...runs.flatMap((processRun) => [
            ...(fs.existsSync(processRun.reportPath)
                ? [relativeToRoot(runnerRoot, processRun.reportPath)]
                : []),
            relativeToRoot(runnerRoot, processRun.processPath),
        ]),
    ];
    const escalationDecision = executionFailed
        ? 'repair_runner_or_environment_then_rerun'
        : status === 'semantic_mismatch'
        ? 'reject_or_repair_candidate'
        : admission.manifest.candidate.kind === 'self_comparison'
            ? 'demonstration_only'
            : admission.manifest.stage === 'screen'
                ? 'human_decision_required_before_confirmation'
                : admission.manifest.stage === 'full_profile'
                    ? 'human_adoption_rejection_or_defer_decision'
                : status === 'repeatable_signal'
                    ? 'full_profile_required_before_adoption'
                    : 'reject_defer_or_human_directed_escalation';
    const summaryPath = path.join(outputDirectory, 'paired-summary.json');
    const failureRecords = [
        ...runs
            .filter((processRun) => processRun.exitCode !== 0 || processRun.report?.failure)
            .map((processRun) => ({
                sequence: processRun.sequence,
                pairIndex: processRun.pairIndex,
                condition: processRun.condition,
                exitCode: processRun.exitCode,
                failure: processRun.report?.failure ?? null,
                processPath: relativeToRoot(runnerRoot, processRun.processPath),
            })),
        ...(orchestrationFailure ? [{
            sequence: null,
            pairIndex: null,
            condition: null,
            exitCode: null,
            failure: { kind: 'runner_failure', message: orchestrationFailure },
            processPath: null,
        }] : []),
    ];
    const record = {
        recordVersion: 1,
        runId,
        recordedAt: new Date().toISOString(),
        candidate: admission.manifest.candidate,
        stage: admission.manifest.stage,
        profile: admission.profile,
        status,
        escalationDecision,
        phaseScope: admission.phaseScope,
        executionPhaseScope: admission.executionPhaseScope,
        scopeRationale: admission.manifest.scopeRationale,
        practicalThresholds: normalizeThresholds(admission.manifest),
        screenRunId: admission.manifest.screenRunId ?? null,
        confirmationRunId: admission.manifest.confirmationRunId ?? null,
        plannedOrder: order,
        sampling: { profile: admission.profile, ...admission.sampling },
        protocol: {
            p0Commit: admission.p0Reference.p0Commit,
            p0ReferenceSha256: admission.p0ReferenceSha256,
            protocolDocumentSha256: admission.protocolDocumentSha256,
            benchmarkSourceSha256: admission.benchmarkSourceSha256,
            manifestSha256: admission.manifestSha256,
        },
        commands: completedOrder,
        rawArtifacts: [...rawArtifacts, relativeToRoot(runnerRoot, summaryPath)],
        failures: failureRecords,
        scenarioRows: rows,
        limitation: admission.manifest.candidate.limitation,
    };
    writeJson(summaryPath, record);
    fs.mkdirSync(path.dirname(admission.recordPath), { recursive: true });
    fs.appendFileSync(admission.recordPath, `${JSON.stringify(record)}\n`, 'utf8');

    console.log(`Paired status: ${status}`);
    console.log(`Escalation: ${escalationDecision}`);
    console.log(`Summary saved to ${relativeToRoot(runnerRoot, summaryPath)}`);
    console.log(`Candidate record appended to ${relativeToRoot(runnerRoot, admission.recordPath)}`);
    return {
        status,
        executionFailed,
        summaryPath,
        recordPath: admission.recordPath,
    };
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

function normalizeThresholds(manifest: CandidateManifest): CandidateManifest['practicalThresholds'] {
    const byRow = new Map(manifest.practicalThresholds.map((threshold) => [
        rowKey(threshold.phase, threshold.scenario),
        threshold,
    ]));
    return PHASE_NAMES
        .filter((phase) => manifest.phaseScope.includes(phase))
        .flatMap((phase) => SCENARIO_NAMES.map((scenario) => {
            const threshold = byRow.get(rowKey(phase, scenario));
            if (!threshold) {
                throw new Error(`Missing practical threshold for ${phase}/${scenario}.`);
            }
            return threshold;
        }));
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

export function normalizedFileSha256(filePath: string): string {
    const normalizedText = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
    return sha256(normalizedText);
}

function sha256(value: string | Buffer): string {
    return createHash('sha256').update(value).digest('hex');
}

function git(directory: string, args: string[]): string {
    return execFileSync('git', ['-C', directory, ...args], {
        encoding: 'utf8',
        env: sanitizedGitEnvironment(),
    }).trim();
}

export function sanitizedGitEnvironment(): NodeJS.ProcessEnv {
    const environment = { ...process.env };
    for (const key of [
        'GIT_DIR',
        'GIT_WORK_TREE',
        'GIT_INDEX_FILE',
        'GIT_COMMON_DIR',
        'GIT_OBJECT_DIRECTORY',
        'GIT_ALTERNATE_OBJECT_DIRECTORIES',
        'GIT_PREFIX',
    ]) {
        delete environment[key];
    }
    return environment;
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
        const result = runPairedBenchmark(parseManifestArg());
        if (result.status === 'semantic_mismatch' || result.executionFailed) {
            process.exitCode = 1;
        }
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    }
}
