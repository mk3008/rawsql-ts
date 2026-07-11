import * as fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    CandidateManifest,
    PHASE_NAMES,
    P0Reference,
    PriorCandidateRecord,
    SCENARIO_NAMES,
    ValidatedAdmission,
    buildOutcomeRows,
    classifyConfirmationRow,
    compareSemanticSinks,
    normalizedFileSha256,
    runOrderForStage,
    runOrderForManifest,
    runPairedBenchmark,
    sanitizedGitEnvironment,
    validateManifestShape,
    validateConfirmationRecord,
    validateFullProfileRecord,
    validateP0Reference,
} from '../benchmarks/ast-analysis-paired-runner';

const COMMIT = 'a'.repeat(40);

function commitFixture(directory: string, message: string): string {
    const options = { cwd: directory, env: sanitizedGitEnvironment() };
    execFileSync('git', ['init'], options);
    execFileSync('git', ['add', '.'], options);
    execFileSync('git', [
        '-c',
        'user.name=Paired Runner Test',
        '-c',
        'user.email=paired-runner@example.invalid',
        'commit',
        '-m',
        message,
    ], options);
    return execFileSync('git', ['rev-parse', 'HEAD'], {
        ...options,
        encoding: 'utf8',
    }).trim();
}

function readReference(): P0Reference {
    const referencePath = path.resolve(
        process.cwd(),
        'docs/bench/ast-analysis-phase-p0-reference.json',
    );
    return JSON.parse(fs.readFileSync(referencePath, 'utf8')) as P0Reference;
}

function createSelfComparisonManifest(): CandidateManifest {
    return {
        schemaVersion: 1,
        stage: 'screen',
        candidate: {
            id: 'self-comparison-test',
            kind: 'self_comparison',
            summary: 'Exercise the paired runner without a product candidate.',
            hypothesis: 'The same commit should preserve every semantic sink.',
            baseCommit: COMMIT,
            candidateCommit: COMMIT,
            limitation: 'This demonstration cannot establish an optimization effect.',
        },
        baselineDirectory: '.',
        candidateDirectory: '.',
        phaseScope: ['renderer.print'],
        scopeRationale: 'The demonstration uses one phase to exercise phase-scoped execution.',
        practicalThresholds: SCENARIO_NAMES.map((scenario) => ({
            phase: 'renderer.print',
            scenario,
            minimumAbsoluteMeanDeltaMs: 0.01,
        })),
    };
}

function createFullProfileSelfComparisonManifest(): CandidateManifest {
    const manifest = createSelfComparisonManifest();
    manifest.stage = 'full_profile';
    manifest.phaseScope = [...PHASE_NAMES];
    manifest.scopeRationale = 'Exercise every direct P0 boundary with the full profile.';
    manifest.practicalThresholds = PHASE_NAMES.flatMap((phase) => SCENARIO_NAMES.map((scenario) => ({
        phase,
        scenario,
        minimumAbsoluteMeanDeltaMs: 0.01,
    })));
    return manifest;
}

function createFullProfileCandidateManifest(): CandidateManifest {
    const manifest = createSelfComparisonManifest();
    manifest.stage = 'full_profile';
    manifest.candidate.kind = 'candidate';
    manifest.candidate.candidateCommit = 'b'.repeat(40);
    manifest.confirmationRunId = 'confirmation-1';
    return manifest;
}

function createConfirmationRecord(
    manifest: CandidateManifest,
    status: PriorCandidateRecord['status'] = 'repeatable_signal',
): PriorCandidateRecord {
    const reference = readReference();
    const signalStatus = status === 'adverse_signal'
        ? 'adverse_signal'
        : status === 'neutral_or_inconclusive'
            ? 'neutral_or_inconclusive'
            : 'repeatable_signal';
    return {
        runId: manifest.confirmationRunId as string,
        stage: 'confirmation',
        status,
        candidate: { ...manifest.candidate },
        phaseScope: [...manifest.phaseScope],
        scopeRationale: manifest.scopeRationale,
        practicalThresholds: manifest.practicalThresholds.map((threshold) => ({ ...threshold })),
        protocol: {
            p0Commit: 'c6f28dbbf4594e99a8e1b1ab662334c010bd7281',
            protocolDocumentSha256: 'c'.repeat(64),
            benchmarkSourceSha256: 'd'.repeat(64),
            p0ReferenceSha256: 'e'.repeat(64),
            manifestSha256: 'f'.repeat(64),
        },
        failures: [],
        screenRunId: 'screen-1',
        escalationDecision: 'full_profile_required_before_adoption',
        commands: runOrderForStage('confirmation').map((item, index) => ({
            sequence: index + 1,
            pairIndex: item.pairIndex,
            condition: item.condition,
            args: ['--profile=pr', `--phases=${manifest.phaseScope.join(',')}`],
            exitCode: 0,
            reportPath: `tmp/prior/${index + 1}.json`,
            processPath: `tmp/prior/${index + 1}.process.json`,
            commit: {
                sha: item.condition === 'baseline'
                    ? manifest.candidate.baseCommit
                    : manifest.candidate.candidateCommit,
                dirty: false,
            },
            environment: { node: 'test' },
        })),
        rawArtifacts: [
            'tmp/prior/admission.json',
            ...runOrderForStage('confirmation').flatMap((_, index) => [
                `tmp/prior/${index + 1}.json`,
                `tmp/prior/${index + 1}.process.json`,
            ]),
            'tmp/prior/paired-summary.json',
        ],
        scenarioRows: PHASE_NAMES.flatMap((phase) => SCENARIO_NAMES.map((scenario, index) => {
            const declared = manifest.phaseScope.includes(phase);
            const threshold = manifest.practicalThresholds.find(
                (candidate) => candidate.phase === phase && candidate.scenario === scenario,
            )?.minimumAbsoluteMeanDeltaMs ?? null;
            return {
                phase,
                scenario,
                status: declared
                    ? index === 0 ? signalStatus : 'neutral_or_inconclusive'
                    : 'not_measured',
                reason: declared ? 'Retained confirmation result.' : 'Outside declared scope.',
                practicalThresholdMs: threshold,
                p0BetweenProcessMeanRangeMs: reference.rows.find(
                    (row) => row.phase === phase && row.scenario === scenario,
                )?.betweenProcessMeanRangeMs ?? 0,
                sinkComparison: declared ? 'matched' : 'not_measured',
                pairs: declared ? [1, 2, 3].map((pairIndex) => ({
                    pairIndex,
                    baselineMeanMs: 1,
                    candidateMeanMs: status === 'adverse_signal' ? 1.1 : 0.9,
                    candidateMinusBaselineMeanMs: status === 'adverse_signal' ? 0.1 : -0.1,
                    direction: status === 'adverse_signal' ? 'adverse' as const : 'favorable' as const,
                })) : [],
            };
        })),
    };
}

function createOutcomeAdmission(): ValidatedAdmission {
    const reference = readReference();
    const manifest = createFullProfileCandidateManifest();
    return {
        manifest,
        phaseScope: ['renderer.print'],
        executionPhaseScope: [...PHASE_NAMES],
        thresholdByRow: new Map(manifest.practicalThresholds.map((threshold) => [
            `${threshold.phase}::${threshold.scenario}`,
            threshold.minimumAbsoluteMeanDeltaMs,
        ])),
        p0ByRow: new Map(reference.rows.map((row) => [`${row.phase}::${row.scenario}`, row])),
    } as ValidatedAdmission;
}

describe('AST analysis paired runner admission', () => {
    it('accepts the tracked P0 reference and a complete self-comparison manifest', () => {
        const reference = readReference();
        expect(() => validateP0Reference(reference)).not.toThrow();
        expect(() => validateManifestShape(createSelfComparisonManifest(), reference)).not.toThrow();
        expect(normalizedFileSha256(path.resolve(
            process.cwd(),
            'docs/bench/ast-analysis-phase-benchmark.md',
        ))).toBe(reference.p0SourceDocumentSha256);
        expect(normalizedFileSha256(path.resolve(
            process.cwd(),
            'docs/bench/ast-analysis-benchmark-measurement-efficiency.md',
        ))).toBe(reference.protocolDocumentSha256);
        expect(normalizedFileSha256(path.resolve(
            process.cwd(),
            'benchmarks/ast-analysis-phase-benchmark.ts',
        ))).toBe(reference.pairedBenchmarkSourceSha256);
    });

    it('rejects a missing scenario threshold before timing', () => {
        const manifest = createSelfComparisonManifest();
        manifest.practicalThresholds.pop();

        expect(() => validateManifestShape(manifest, readReference()))
            .toThrow('Every declared phase/scenario row requires a practical threshold before timing.');
    });

    it('rejects confirmation or differing commits for a self-comparison', () => {
        const confirmation = createSelfComparisonManifest();
        confirmation.stage = 'confirmation';
        confirmation.screenRunId = 'prior-screen';
        expect(() => validateManifestShape(confirmation, readReference()))
            .toThrow('A self_comparison demonstration must use the screen or full_profile stage.');

        const differingCommit = createSelfComparisonManifest();
        differingCommit.candidate.candidateCommit = 'b'.repeat(40);
        expect(() => validateManifestShape(differingCommit, readReference()))
            .toThrow('A self_comparison must use the same base and candidate commit.');
    });

    it('admits only a complete six-phase full-profile self-comparison', () => {
        const manifest = createFullProfileSelfComparisonManifest();
        expect(() => validateManifestShape(manifest, readReference())).not.toThrow();

        manifest.phaseScope.pop();
        manifest.practicalThresholds = manifest.practicalThresholds.filter(
            (threshold) => manifest.phaseScope.includes(threshold.phase),
        );
        expect(() => validateManifestShape(manifest, readReference()))
            .toThrow('A full-profile self_comparison must declare all six P0 phases.');
    });

    it('requires a real full profile to reference a committed confirmation', () => {
        const manifest = createFullProfileCandidateManifest();
        delete manifest.confirmationRunId;
        expect(() => validateManifestShape(manifest, readReference()))
            .toThrow('A candidate full_profile manifest must reference its committed confirmationRunId.');
    });

    it('requires confirmation to inherit the successful screen thresholds and metadata', () => {
        const manifest = createSelfComparisonManifest();
        manifest.stage = 'confirmation';
        manifest.screenRunId = 'screen-1';
        manifest.candidate.kind = 'candidate';
        manifest.candidate.candidateCommit = 'b'.repeat(40);
        const screen: PriorCandidateRecord = {
            runId: 'screen-1',
            stage: 'screen',
            status: 'neutral_or_inconclusive',
            candidate: { ...manifest.candidate },
            phaseScope: ['renderer.print'],
            scopeRationale: manifest.scopeRationale,
            practicalThresholds: manifest.practicalThresholds.map((threshold) => ({ ...threshold })),
            protocol: {
                p0Commit: 'c6f28dbbf4594e99a8e1b1ab662334c010bd7281',
                protocolDocumentSha256: 'c'.repeat(64),
                benchmarkSourceSha256: 'd'.repeat(64),
                p0ReferenceSha256: 'e'.repeat(64),
            },
            failures: [],
        };
        expect(() => validateConfirmationRecord(
            manifest,
            screen,
            ['renderer.print'],
            'c'.repeat(64),
            'd'.repeat(64),
            'e'.repeat(64),
        )).not.toThrow();

        manifest.practicalThresholds[0].minimumAbsoluteMeanDeltaMs = 0.001;
        expect(() => validateConfirmationRecord(
            manifest,
            screen,
            ['renderer.print'],
            'c'.repeat(64),
            'd'.repeat(64),
            'e'.repeat(64),
        )).toThrow('Confirmation must exactly inherit');
    });

    it('requires full profile to inherit confirmation metadata, thresholds, and fingerprints', () => {
        const manifest = createFullProfileCandidateManifest();
        const confirmation = createConfirmationRecord(manifest);
        const validate = () => validateFullProfileRecord(
            manifest,
            confirmation,
            ['renderer.print'],
            'c'.repeat(64),
            'd'.repeat(64),
            'e'.repeat(64),
        );
        expect(validate).not.toThrow();

        manifest.candidate.summary = 'Changed after confirmation.';
        expect(validate).toThrow('Full profile must exactly inherit');

        manifest.candidate.summary = confirmation.candidate.summary;
        confirmation.scenarioRows?.pop();
        expect(validate).toThrow('Full profile must exactly inherit');
    });

    it('retains non-positive confirmation eligibility but rejects failed or invalid lineage', () => {
        const manifest = createFullProfileCandidateManifest();
        for (const status of ['adverse_signal', 'neutral_or_inconclusive'] as const) {
            expect(() => validateFullProfileRecord(
                manifest,
                createConfirmationRecord(manifest, status),
                ['renderer.print'],
                'c'.repeat(64),
                'd'.repeat(64),
                'e'.repeat(64),
            )).not.toThrow();
        }

        const failed = createConfirmationRecord(manifest);
        failed.failures = [{ kind: 'execution_failure' }];
        expect(() => validateFullProfileRecord(
            manifest,
            failed,
            ['renderer.print'],
            'c'.repeat(64),
            'd'.repeat(64),
            'e'.repeat(64),
        )).toThrow('Full profile must exactly inherit');

        const mismatch = createConfirmationRecord(manifest, 'semantic_mismatch');
        expect(() => validateFullProfileRecord(
            manifest,
            mismatch,
            ['renderer.print'],
            'c'.repeat(64),
            'd'.repeat(64),
            'e'.repeat(64),
        )).toThrow('Full profile must exactly inherit');
    });
});

describe('AST analysis paired runner ordering and outcomes', () => {
    it('alternates each pair and counterbalances the middle confirmation pair', () => {
        expect(runOrderForStage('screen')).toEqual([
            { pairIndex: 1, condition: 'baseline' },
            { pairIndex: 1, condition: 'candidate' },
        ]);
        expect(runOrderForStage('confirmation')).toEqual([
            { pairIndex: 1, condition: 'baseline' },
            { pairIndex: 1, condition: 'candidate' },
            { pairIndex: 2, condition: 'candidate' },
            { pairIndex: 2, condition: 'baseline' },
            { pairIndex: 3, condition: 'baseline' },
            { pairIndex: 3, condition: 'candidate' },
        ]);
        expect(runOrderForStage('full_profile')).toEqual([
            { pairIndex: 1, condition: 'baseline' },
            { pairIndex: 1, condition: 'candidate' },
            { pairIndex: 2, condition: 'candidate' },
            { pairIndex: 2, condition: 'baseline' },
            { pairIndex: 3, condition: 'baseline' },
            { pairIndex: 3, condition: 'candidate' },
        ]);
        expect(runOrderForManifest(createFullProfileSelfComparisonManifest())).toEqual([
            { pairIndex: 1, condition: 'baseline' },
            { pairIndex: 1, condition: 'candidate' },
        ]);
    });

    it('requires three consistent pairs and both magnitude guardrails', () => {
        expect(classifyConfirmationRow([-0.03, -0.04, -0.05], 0.01, 0.02))
            .toBe('repeatable_signal');
        expect(classifyConfirmationRow([0.03, 0.04, 0.05], 0.01, 0.02))
            .toBe('adverse_signal');
        expect(classifyConfirmationRow([-0.03, 0.04, -0.05], 0.01, 0.02))
            .toBe('neutral_or_inconclusive');
        expect(classifyConfirmationRow([-0.01, -0.01, -0.01], 0.01, 0.005))
            .toBe('neutral_or_inconclusive');
        expect(classifyConfirmationRow([-0.03], 0.01, 0.02))
            .toBe('neutral_or_inconclusive');
    });

    it('detects stable cross-condition semantic changes', () => {
        const baseline = {
            kind: 'formatted-sql-and-params',
            signatureSha256: 'baseline',
            summary: { sqlSha256: 'one', parameterCount: 2 },
        };
        expect(compareSemanticSinks(baseline, { ...baseline })).toBe('matched');
        expect(compareSemanticSinks(baseline, {
            ...baseline,
            summary: { sqlSha256: 'changed', parameterCount: 2 },
        })).toBe('semantic_mismatch');
    });

    it('retains a full-profile semantic mismatch and suppresses every speed verdict', () => {
        const admission = createOutcomeAdmission();
        const mismatchKey = 'renderer.hot-format::tracked.customer-summary';
        const rows = buildOutcomeRows(
            admission,
            new Map(),
            new Set([mismatchKey]),
            new Map([[mismatchKey, [{
                pairIndex: 1,
                baselineSink: { signatureSha256: 'baseline' },
                candidateSink: { signatureSha256: 'candidate' },
            }]]]),
            new Set(),
            false,
        );

        expect(rows).toHaveLength(42);
        expect(rows.find((row) => `${row.phase}::${row.scenario}` === mismatchKey)?.status)
            .toBe('semantic_mismatch');
        expect(rows.every((row) => row.status === 'semantic_mismatch'
            || row.status === 'not_measured')).toBe(true);
    });

    it('suppresses all performance interpretation after a full-profile execution failure', () => {
        const rows = buildOutcomeRows(
            createOutcomeAdmission(),
            new Map(),
            new Set(),
            new Map(),
            new Set(),
            true,
        );

        expect(rows).toHaveLength(42);
        expect(rows.every((row) => row.status === 'not_measured')).toBe(true);
    });
});

describe('AST analysis paired runner failure retention', () => {
    it('preserves Stage 1 failure retention and its 42-row append', () => {
        const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rawsql-screen-runner-'));
        try {
            const controllerRoot = path.join(temporaryRoot, 'controller');
            const conditionRoot = path.join(temporaryRoot, 'condition');
            fs.mkdirSync(path.join(controllerRoot, 'docs', 'bench'), { recursive: true });
            fs.mkdirSync(path.join(conditionRoot, 'benchmarks'), { recursive: true });
            for (const name of [
                'ast-analysis-phase-benchmark.md',
                'ast-analysis-benchmark-measurement-efficiency.md',
                'ast-analysis-phase-p0-reference.json',
            ]) {
                fs.copyFileSync(
                    path.resolve(process.cwd(), 'docs', 'bench', name),
                    path.join(controllerRoot, 'docs', 'bench', name),
                );
            }
            fs.copyFileSync(
                path.resolve(process.cwd(), 'benchmarks', 'ast-analysis-phase-benchmark.ts'),
                path.join(conditionRoot, 'benchmarks', 'ast-analysis-phase-benchmark.ts'),
            );
            const commit = commitFixture(conditionRoot, 'screen failure fixture');
            const manifest = createSelfComparisonManifest();
            manifest.candidate.baseCommit = commit;
            manifest.candidate.candidateCommit = commit;
            manifest.baselineDirectory = conditionRoot;
            manifest.candidateDirectory = conditionRoot;
            const manifestPath = path.join(controllerRoot, 'manifest.json');
            fs.writeFileSync(manifestPath, JSON.stringify(manifest), 'utf8');

            const result = runPairedBenchmark(manifestPath, controllerRoot);
            const recordPath = path.join(
                controllerRoot,
                'docs',
                'bench',
                'ast-analysis-benchmark-candidate-records.jsonl',
            );
            const record = JSON.parse(fs.readFileSync(recordPath, 'utf8')) as {
                profile: string;
                status: string;
                commands: Array<{ args: string[] }>;
                failures: unknown[];
                scenarioRows: Array<{ status: string }>;
            };

            expect(result.executionFailed).toBe(true);
            expect(record.profile).toBe('pr');
            expect(record.status).toBe('not_measured');
            expect(record.commands[0].args).toContain('--profile=pr');
            expect(record.failures.length).toBeGreaterThan(0);
            expect(record.scenarioRows).toHaveLength(42);
            expect(record.scenarioRows.every((row) => row.status === 'not_measured')).toBe(true);
        } finally {
            fs.rmSync(temporaryRoot, { recursive: true, force: true });
        }
    });

    it('appends a full-profile 42-row record without replacing a prior non-positive entry', () => {
        const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rawsql-paired-runner-'));
        try {
            const controllerRoot = path.join(temporaryRoot, 'controller');
            const conditionRoot = path.join(temporaryRoot, 'condition');
            fs.mkdirSync(path.join(controllerRoot, 'docs', 'bench'), { recursive: true });
            fs.mkdirSync(path.join(conditionRoot, 'benchmarks'), { recursive: true });
            for (const name of [
                'ast-analysis-phase-benchmark.md',
                'ast-analysis-benchmark-measurement-efficiency.md',
                'ast-analysis-phase-p0-reference.json',
            ]) {
                fs.copyFileSync(
                    path.resolve(process.cwd(), 'docs', 'bench', name),
                    path.join(controllerRoot, 'docs', 'bench', name),
                );
            }
            fs.copyFileSync(
                path.resolve(process.cwd(), 'benchmarks', 'ast-analysis-phase-benchmark.ts'),
                path.join(conditionRoot, 'benchmarks', 'ast-analysis-phase-benchmark.ts'),
            );
            const gitOptions = { cwd: conditionRoot, env: sanitizedGitEnvironment() };
            execFileSync('git', ['init'], gitOptions);
            execFileSync('git', ['add', '.'], gitOptions);
            execFileSync('git', [
                '-c',
                'user.name=Paired Runner Test',
                '-c',
                'user.email=paired-runner@example.invalid',
                'commit',
                '-m',
                'test fixture',
            ], gitOptions);
            const commit = execFileSync('git', ['rev-parse', 'HEAD'], {
                ...gitOptions,
                encoding: 'utf8',
            }).trim();
            const manifest = createFullProfileSelfComparisonManifest();
            manifest.candidate.baseCommit = commit;
            manifest.candidate.candidateCommit = commit;
            manifest.baselineDirectory = conditionRoot;
            manifest.candidateDirectory = conditionRoot;
            const manifestPath = path.join(controllerRoot, 'manifest.json');
            fs.writeFileSync(manifestPath, JSON.stringify(manifest), 'utf8');
            const recordPath = path.join(
                controllerRoot,
                'docs',
                'bench',
                'ast-analysis-benchmark-candidate-records.jsonl',
            );
            const sentinel = '{"runId":"retained-adverse-sentinel","status":"adverse_signal"}\n';
            fs.writeFileSync(recordPath, sentinel, 'utf8');

            const result = runPairedBenchmark(manifestPath, controllerRoot);
            const recordText = fs.readFileSync(recordPath, 'utf8');
            const records = recordText.trim().split(/\r?\n/);
            const record = JSON.parse(records[1]) as {
                profile: string;
                status: string;
                escalationDecision: string;
                failures: unknown[];
                executionPhaseScope: string[];
                plannedOrder: Array<{ pairIndex: number; condition: string }>;
                sampling: { profile: string; warmupSamples: number; measuredSamples: number; invocationsPerSample: number };
                commands: Array<{ args: string[] }>;
                rawArtifacts: string[];
                scenarioRows: Array<{ status: string }>;
            };

            expect(result.executionFailed).toBe(true);
            expect(fs.existsSync(result.summaryPath)).toBe(true);
            expect(recordText.startsWith(sentinel)).toBe(true);
            expect(records).toHaveLength(2);
            expect(record.profile).toBe('full');
            expect(record.status).toBe('not_measured');
            expect(record.escalationDecision).toBe('repair_runner_or_environment_then_rerun');
            expect(record.failures.length).toBeGreaterThan(0);
            expect(record.executionPhaseScope).toEqual(PHASE_NAMES);
            expect(record.plannedOrder).toEqual(runOrderForManifest(manifest));
            expect(record.sampling).toEqual({
                profile: 'full',
                warmupSamples: 8,
                measuredSamples: 50,
                invocationsPerSample: 16,
            });
            expect(record.commands[0].args).toContain('--profile=full');
            expect(record.commands[0].args).toContain(`--phases=${PHASE_NAMES.join(',')}`);
            expect(record.rawArtifacts.every((artifact) => fs.existsSync(
                path.join(controllerRoot, artifact),
            ))).toBe(true);
            expect(record.scenarioRows).toHaveLength(42);
            expect(record.scenarioRows.every((row) => row.status === 'not_measured')).toBe(true);
        } finally {
            fs.rmSync(temporaryRoot, { recursive: true, force: true });
        }
    });

    it('resolves full-profile inheritance from the committed confirmation record', () => {
        const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rawsql-full-profile-'));
        try {
            const controllerRoot = path.join(temporaryRoot, 'controller');
            const baselineRoot = path.join(temporaryRoot, 'baseline');
            const candidateRoot = path.join(temporaryRoot, 'candidate');
            fs.mkdirSync(path.join(controllerRoot, 'docs', 'bench'), { recursive: true });
            for (const name of [
                'ast-analysis-phase-benchmark.md',
                'ast-analysis-benchmark-measurement-efficiency.md',
                'ast-analysis-phase-p0-reference.json',
            ]) {
                fs.copyFileSync(
                    path.resolve(process.cwd(), 'docs', 'bench', name),
                    path.join(controllerRoot, 'docs', 'bench', name),
                );
            }
            for (const conditionRoot of [baselineRoot, candidateRoot]) {
                fs.mkdirSync(path.join(conditionRoot, 'benchmarks'), { recursive: true });
                fs.copyFileSync(
                    path.resolve(process.cwd(), 'benchmarks', 'ast-analysis-phase-benchmark.ts'),
                    path.join(conditionRoot, 'benchmarks', 'ast-analysis-phase-benchmark.ts'),
                );
            }
            const baselineCommit = commitFixture(baselineRoot, 'baseline fixture');
            const candidateCommit = commitFixture(candidateRoot, 'candidate fixture');
            const manifest = createFullProfileCandidateManifest();
            manifest.candidate.baseCommit = baselineCommit;
            manifest.candidate.candidateCommit = candidateCommit;
            manifest.baselineDirectory = baselineRoot;
            manifest.candidateDirectory = candidateRoot;

            const confirmation = createConfirmationRecord(manifest);
            confirmation.protocol.protocolDocumentSha256 = normalizedFileSha256(path.join(
                controllerRoot,
                'docs',
                'bench',
                'ast-analysis-benchmark-measurement-efficiency.md',
            ));
            confirmation.protocol.benchmarkSourceSha256 = normalizedFileSha256(path.join(
                baselineRoot,
                'benchmarks',
                'ast-analysis-phase-benchmark.ts',
            ));
            confirmation.protocol.p0ReferenceSha256 = normalizedFileSha256(path.join(
                controllerRoot,
                'docs',
                'bench',
                'ast-analysis-phase-p0-reference.json',
            ));
            const screen = {
                ...confirmation,
                runId: 'screen-1',
                stage: 'screen' as const,
                status: 'neutral_or_inconclusive' as const,
                screenRunId: null,
                failures: [],
            };
            const recordPath = path.join(
                controllerRoot,
                'docs',
                'bench',
                'ast-analysis-benchmark-candidate-records.jsonl',
            );
            const committedPrefix = `${JSON.stringify(screen)}\n${JSON.stringify(confirmation)}\n`;
            fs.writeFileSync(recordPath, committedPrefix, 'utf8');
            commitFixture(controllerRoot, 'committed confirmation fixture');

            const manifestPath = path.join(temporaryRoot, 'manifest.json');
            fs.writeFileSync(manifestPath, JSON.stringify(manifest), 'utf8');
            const result = runPairedBenchmark(manifestPath, controllerRoot);
            const recordText = fs.readFileSync(recordPath, 'utf8');
            const appended = JSON.parse(recordText.trim().split(/\r?\n/)[2]) as {
                stage: string;
                profile: string;
                confirmationRunId: string;
                executionPhaseScope: string[];
                failures: unknown[];
            };

            expect(result.executionFailed).toBe(true);
            expect(recordText.startsWith(committedPrefix)).toBe(true);
            expect(appended.stage).toBe('full_profile');
            expect(appended.profile).toBe('full');
            expect(appended.confirmationRunId).toBe(confirmation.runId);
            expect(appended.executionPhaseScope).toEqual(PHASE_NAMES);
            expect(appended.failures.length).toBeGreaterThan(0);
        } finally {
            fs.rmSync(temporaryRoot, { recursive: true, force: true });
        }
    });
});
