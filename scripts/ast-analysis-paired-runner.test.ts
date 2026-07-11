import * as fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    CandidateManifest,
    P0Reference,
    PriorCandidateRecord,
    SCENARIO_NAMES,
    classifyConfirmationRow,
    compareSemanticSinks,
    normalizedFileSha256,
    runOrderForStage,
    runPairedBenchmark,
    sanitizedGitEnvironment,
    validateManifestShape,
    validateConfirmationRecord,
    validateP0Reference,
} from '../benchmarks/ast-analysis-paired-runner';

const COMMIT = 'a'.repeat(40);

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
            .toThrow('A self_comparison demonstration must use the screen stage.');

        const differingCommit = createSelfComparisonManifest();
        differingCommit.candidate.candidateCommit = 'b'.repeat(40);
        expect(() => validateManifestShape(differingCommit, readReference()))
            .toThrow('A self_comparison must use the same base and candidate commit.');
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
});

describe('AST analysis paired runner failure retention', () => {
    it('appends a 42-row not-measured record after an admitted child failure', () => {
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
            const records = fs.readFileSync(recordPath, 'utf8').trim().split(/\r?\n/);
            const record = JSON.parse(records[0]) as {
                status: string;
                escalationDecision: string;
                failures: unknown[];
                scenarioRows: Array<{ status: string }>;
            };

            expect(result.executionFailed).toBe(true);
            expect(fs.existsSync(result.summaryPath)).toBe(true);
            expect(records).toHaveLength(1);
            expect(record.status).toBe('not_measured');
            expect(record.escalationDecision).toBe('repair_runner_or_environment_then_rerun');
            expect(record.failures.length).toBeGreaterThan(0);
            expect(record.scenarioRows).toHaveLength(42);
            expect(record.scenarioRows.every((row) => row.status === 'not_measured')).toBe(true);
        } finally {
            fs.rmSync(temporaryRoot, { recursive: true, force: true });
        }
    });
});
