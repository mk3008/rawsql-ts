import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    CandidateManifest,
    P0Reference,
    SCENARIO_NAMES,
    classifyConfirmationRow,
    compareSemanticSinks,
    runOrderForStage,
    validateManifestShape,
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
        expect(() => validateManifestShape(confirmation, readReference()))
            .toThrow('A self_comparison demonstration must use the screen stage.');

        const differingCommit = createSelfComparisonManifest();
        differingCommit.candidate.candidateCommit = 'b'.repeat(40);
        expect(() => validateManifestShape(differingCommit, readReference()))
            .toThrow('A self_comparison must use the same base and candidate commit.');
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

