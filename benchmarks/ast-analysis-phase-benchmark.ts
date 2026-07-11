import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { SelectQuery } from '../packages/core/src/models/SelectQuery';
import { SqlPrintToken } from '../packages/core/src/models/SqlPrintToken';
import {
    PRESETS,
    SqlPrintTokenParser,
} from '../packages/core/src/parsers/SqlPrintTokenParser';
import { SelectQueryParser } from '../packages/core/src/parsers/SelectQueryParser';
import {
    ConditionOptimizationOptions,
    ConditionOptimizationResult,
    optimizeConditions,
} from '../packages/core/src/transformers/ConditionOptimization';
import { ParameterCollector } from '../packages/core/src/transformers/ParameterCollector';
import {
    SelectOutputCollector,
    SelectOutputColumn,
} from '../packages/core/src/transformers/SelectOutputCollector';
import {
    SqlFormatter,
    SqlFormatterOptions,
} from '../packages/core/src/transformers/SqlFormatter';
import { SqlPrinter, SqlPrinterOptions } from '../packages/core/src/transformers/SqlPrinter';
import { customerSummarySql } from './ztd-bench-vs-raw/sql/customer_summary';
import { productRankingSql } from './ztd-bench-vs-raw/sql/product_ranking';
import { salesSummarySql } from './ztd-bench-vs-raw/sql/sales_summary';

type ProfileName = 'pr' | 'full';
type PairCondition = 'baseline' | 'candidate';
type PhaseName =
    | 'analyzer.select-output-collection'
    | 'analyzer.integrated-condition-optimization'
    | 'renderer.token-build'
    | 'renderer.print'
    | 'renderer.hot-format'
    | 'renderer.cold-format';

interface ProfileConfig {
    name: ProfileName;
    warmupSamples: number;
    measuredSamples: number;
    invocationsPerSample: number;
    syntheticSize: number;
}

interface CorpusDefinition {
    name: string;
    source: 'tracked' | 'synthetic';
    features: string[];
    sql: string;
    conditionOptions?: ConditionOptimizationOptions;
}

interface CorpusRecord {
    name: string;
    source: 'tracked' | 'synthetic';
    features: string[];
    sqlBytes: number;
    sqlSha256: string;
}

interface PhaseDefinition {
    name: PhaseName;
    boundary: string;
    includedWork: string;
    excludedWork: string;
}

interface PhaseStats {
    meanMs: number;
    p95Ms: number;
    stddevMs: number;
    minMs: number;
    maxMs: number;
    sampleCount: number;
}

interface PhaseScenarioResult {
    phase: PhaseName;
    scenario: string;
    boundary: string;
    includedWork: string;
    excludedWork: string;
    warmupSamples: number;
    measuredSamples: number;
    invocationsPerSample: number;
    rawSamplesMs: number[];
    stats: PhaseStats;
    semanticSink: SemanticSink;
    optimizationEffectConclusion: 'not_measured';
}

interface SemanticSink {
    kind: string;
    signatureSha256: string;
    summary: Record<string, string | number | boolean>;
}

interface BenchmarkReport {
    schemaVersion: 1;
    profile: ProfileName;
    timestamp: string;
    commit: {
        sha: string;
        dirty: boolean;
    };
    environment: {
        node: string;
        pnpm: string;
        platform: string;
        release: string;
        architecture: string;
        cpu: string;
        logicalCores: number;
        processId: number;
        launcher: 'ts-node';
    };
    method: {
        timer: 'process.hrtime.bigint';
        percentile: 'nearest-rank';
        warmupSamples: number;
        measuredSamples: number;
        invocationsPerSample: number;
        corpusSeed: string;
        objectIdentityPolicy: string;
        semanticValidation: string;
        candidateComparison: 'absent';
        phaseScope: PhaseName[];
    };
    pairRun?: {
        candidateId: string;
        condition: PairCondition;
        pairIndex: number;
    };
    failure?: {
        kind: 'semantic_mismatch' | 'execution_failure';
        phase: PhaseName;
        scenario: string;
        message: string;
    };
    formatterOptions: SqlFormatterOptions;
    corpus: CorpusRecord[];
    phases: PhaseDefinition[];
    results: PhaseScenarioResult[];
    limitations: string[];
}

type PreparedInput =
    | { kind: 'ast'; ast: SelectQuery }
    | { kind: 'token'; token: SqlPrintToken };

interface PhaseContext {
    tokenParser: SqlPrintTokenParser;
    printer: SqlPrinter;
    formatter: SqlFormatter;
}

const CORPUS_SEED = 'rawsql-ts-ast-phase-v1';

const FORMATTER_OPTIONS: SqlFormatterOptions = {
    preset: 'postgres',
    keywordCase: 'lower',
    indentChar: 'space',
    indentSize: 2,
    newline: 'lf',
    commaBreak: 'after',
    andBreak: 'before',
    orBreak: 'before',
    exportComment: 'full',
    commentStyle: 'smart',
    parenthesesOneLine: true,
    inOneLine: true,
    caseOneLine: true,
    subqueryOneLine: true,
    oneLineMaxLength: 88,
};

const PRINTER_OPTIONS: SqlPrinterOptions = {
    keywordCase: FORMATTER_OPTIONS.keywordCase,
    indentChar: FORMATTER_OPTIONS.indentChar,
    indentSize: FORMATTER_OPTIONS.indentSize,
    newline: FORMATTER_OPTIONS.newline,
    commaBreak: FORMATTER_OPTIONS.commaBreak,
    andBreak: FORMATTER_OPTIONS.andBreak,
    orBreak: FORMATTER_OPTIONS.orBreak,
    exportComment: FORMATTER_OPTIONS.exportComment,
    commentStyle: FORMATTER_OPTIONS.commentStyle,
    parenthesesOneLine: FORMATTER_OPTIONS.parenthesesOneLine,
    inOneLine: FORMATTER_OPTIONS.inOneLine,
    caseOneLine: FORMATTER_OPTIONS.caseOneLine,
    subqueryOneLine: FORMATTER_OPTIONS.subqueryOneLine,
    oneLineMaxLength: FORMATTER_OPTIONS.oneLineMaxLength,
};

const PHASES: PhaseDefinition[] = [
    {
        name: 'analyzer.select-output-collection',
        boundary: 'new SelectOutputCollector(resolver).collect(preParsedAst)',
        includedWork: 'Collector construction, CTE/source resolution, wildcard expansion, and output metadata collection.',
        excludedWork: 'SQL parsing, result projection, hashing, and semantic comparison.',
    },
    {
        name: 'analyzer.integrated-condition-optimization',
        boundary: 'optimizeConditions(preParsedOneShotAst, { cloneInput: false, ...scenarioOptions })',
        includedWork: 'The complete safe-only condition pipeline and its compatibility SQL rendering.',
        excludedWork: 'Initial SQL parsing, result projection, hashing, and semantic comparison. This is not a pure analyzer micro-phase.',
    },
    {
        name: 'renderer.token-build',
        boundary: 'reusedSqlPrintTokenParser.parse(preParsedOneShotAst)',
        includedWork: 'Print-token construction and parameter collection.',
        excludedWork: 'SQL parsing, SqlPrinter.print, result projection, hashing, and semantic comparison.',
    },
    {
        name: 'renderer.print',
        boundary: 'reusedSqlPrinter.print(prebuiltOneShotToken)',
        includedWork: 'Print-token traversal and SQL string assembly.',
        excludedWork: 'SQL parsing, token construction, parameter collection, hashing, and semantic comparison.',
    },
    {
        name: 'renderer.hot-format',
        boundary: 'reusedSqlFormatter.format(preParsedOneShotAst)',
        includedWork: 'Token construction, parameter collection, printing, and result assembly with a reused formatter.',
        excludedWork: 'SQL parsing, formatter construction, hashing, and semantic comparison.',
    },
    {
        name: 'renderer.cold-format',
        boundary: 'new SqlFormatter(options).format(preParsedOneShotAst)',
        includedWork: 'Formatter construction, token construction, parameter collection, printing, and result assembly.',
        excludedWork: 'SQL parsing, hashing, and semantic comparison.',
    },
];

const TABLE_COLUMNS: Record<string, string[]> = {
    accounts: ['account_id', 'status', 'category', 'score', 'flag'],
    customer: ['customer_id', 'customer_name', 'customer_email'],
    metrics: Array.from({ length: 160 }, (_, index) => `metric_${index + 1}`),
    orders: ['id', 'customer_id', 'status', 'amount', 'created_at'],
    product: ['product_id', 'product_name'],
    sales_order: ['sales_order_id', 'customer_id', 'sales_order_date'],
    sales_order_item: ['sales_order_id', 'product_id', 'quantity', 'unit_price'],
    users: ['id', 'status', 'category', 'score'],
};

let observableSink = 0;

function parseProfileArg(): ProfileName {
    const profileArg = process.argv.find((arg) => arg.startsWith('--profile='));
    if (!profileArg) {
        return 'pr';
    }

    const value = profileArg.split('=')[1];
    if (value === 'pr' || value === 'full') {
        return value;
    }

    throw new Error(`Unsupported profile: ${value}. Expected --profile=pr or --profile=full.`);
}

function parsePhaseScopeArg(): PhaseDefinition[] {
    const phasesArg = process.argv.find((arg) => arg.startsWith('--phases='));
    if (!phasesArg) {
        return PHASES;
    }

    const requestedNames = phasesArg.split('=')[1]
        .split(',')
        .filter((name) => name.length > 0);
    if (requestedNames.length === 0 || new Set(requestedNames).size !== requestedNames.length) {
        throw new Error('--phases must contain one or more unique comma-separated phase names.');
    }

    const requested = new Set(requestedNames);
    const unknown = requestedNames.filter((name) => !PHASES.some((phase) => phase.name === name));
    if (unknown.length > 0) {
        throw new Error(`Unsupported phases: ${unknown.join(', ')}.`);
    }

    return PHASES.filter((phase) => requested.has(phase.name));
}

function parsePairRunArg(): BenchmarkReport['pairRun'] {
    const condition = parseOptionalArg('--condition');
    const candidateId = parseOptionalArg('--candidate-id');
    const pairIndexText = parseOptionalArg('--pair-index');
    const suppliedCount = [condition, candidateId, pairIndexText]
        .filter((value) => value !== undefined).length;

    if (suppliedCount === 0) {
        return undefined;
    }
    if (suppliedCount !== 3) {
        throw new Error('--condition, --candidate-id, and --pair-index must be supplied together.');
    }
    if (condition !== 'baseline' && condition !== 'candidate') {
        throw new Error('--condition must be baseline or candidate.');
    }

    const pairIndex = Number.parseInt(pairIndexText as string, 10);
    if (!Number.isSafeInteger(pairIndex) || pairIndex < 1) {
        throw new Error('--pair-index must be a positive integer.');
    }

    return {
        candidateId: candidateId as string,
        condition,
        pairIndex,
    };
}

function parseOptionalArg(name: string): string | undefined {
    const prefix = `${name}=`;
    const arg = process.argv.find((candidate) => candidate.startsWith(prefix));
    return arg?.slice(prefix.length);
}

function getProfileConfig(profile: ProfileName): ProfileConfig {
    if (profile === 'pr') {
        return {
            name: 'pr',
            warmupSamples: 4,
            measuredSamples: 20,
            invocationsPerSample: 8,
            syntheticSize: 32,
        };
    }

    return {
        name: 'full',
        warmupSamples: 8,
        measuredSamples: 50,
        invocationsPerSample: 16,
        syntheticSize: 128,
    };
}

function createCteWildcardSql(size: number): string {
    const cteCount = Math.max(4, Math.floor(size / 4));
    const ctes = [
        `stage_0 AS (\n  SELECT o.id, o.customer_id, o.status, o.amount\n  FROM orders o\n)`,
    ];

    for (let index = 1; index <= cteCount; index += 1) {
        ctes.push(
            `stage_${index} AS (\n  SELECT s.*, s.amount + ${index} AS derived_${index}\n  FROM stage_${index - 1} s\n)`,
        );
    }

    return `
WITH ${ctes.join(',\n')}
SELECT final_stage.*, final_stage.id AS duplicate_id, final_stage.customer_id AS duplicate_id
FROM stage_${cteCount} final_stage
WHERE final_stage.status = :status
  AND final_stage.amount >= :minimum_amount;
`;
}

function createWideOutputSql(size: number): string {
    const outputs = Array.from({ length: size }, (_, index) => {
        const column = `metric_${index + 1}`;
        const alias = index % 11 === 0 ? 'repeated_metric' : column;
        return `m.${column} AS ${alias}`;
    });

    return `SELECT\n  ${outputs.join(',\n  ')}\nFROM metrics m;`;
}

function createBooleanParameterSql(size: number): string {
    const termCount = Math.max(12, size);
    const terms = Array.from({ length: termCount }, (_, index) => {
        if (index % 3 === 0) {
            return `a.score >= :score_${index}`;
        }
        if (index % 3 === 1) {
            return `(a.category = 'category_${index}' OR a.flag = :flag_${index})`;
        }
        return `a.account_id <> ${index}`;
    });
    const inValues = Array.from({ length: Math.max(16, Math.floor(size / 2)) }, (_, index) => index + 1);

    return `
SELECT
  a.account_id,
  CASE WHEN a.score >= 90 THEN 'high' WHEN a.score >= 50 THEN 'medium' ELSE 'low' END AS score_band
FROM accounts a
WHERE (:status IS NULL OR a.status = :status)
  /* logical comment retained by the semantic sink */
  AND ${terms.join('\n  AND ')}
  AND a.account_id IN (${inValues.join(', ')});
`;
}

function createDerivedUnionSql(size: number): string {
    const branchCount = Math.max(4, Math.floor(size / 8));
    const branches = Array.from({ length: branchCount }, (_, index) => (
        `SELECT u.id, u.status AS label FROM users u WHERE u.category = 'category_${index}'`
    ));

    return `
SELECT combined.id, combined.label
FROM (
  ${branches.join('\n  UNION ALL\n  ')}
) combined
WHERE combined.id = :target_id;
`;
}

function createCorpus(config: ProfileConfig): CorpusDefinition[] {
    return [
        {
            name: 'tracked.customer-summary',
            source: 'tracked',
            features: ['joins', 'aggregate', 'distinct', 'group-by', 'order-by'],
            sql: customerSummarySql.trim(),
        },
        {
            name: 'tracked.product-ranking',
            source: 'tracked',
            features: ['left-join', 'aggregate', 'coalesce', 'order-by'],
            sql: productRankingSql.trim(),
        },
        {
            name: 'tracked.sales-summary',
            source: 'tracked',
            features: ['function-call', 'join', 'aggregate', 'group-by'],
            sql: salesSummarySql.trim(),
        },
        {
            name: 'synthetic.cte-wildcard-duplicate',
            source: 'synthetic',
            features: ['cte-chain', 'wildcard', 'duplicate-output', 'parameters'],
            sql: createCteWildcardSql(config.syntheticSize),
        },
        {
            name: 'synthetic.wide-output',
            source: 'synthetic',
            features: ['wide-select', 'resolver', 'duplicate-output'],
            sql: createWideOutputSql(config.syntheticSize),
        },
        {
            name: 'synthetic.boolean-parameter-comment',
            source: 'synthetic',
            features: ['boolean-chain', 'or-boundary', 'parameters', 'comment', 'one-line-rejection', 'case'],
            sql: createBooleanParameterSql(config.syntheticSize),
            conditionOptions: {
                optionalConditionParameters: { status: null },
            },
        },
        {
            name: 'synthetic.derived-union',
            source: 'synthetic',
            features: ['derived-table', 'union-all', 'parameter-placement'],
            sql: createDerivedUnionSql(config.syntheticSize),
        },
    ];
}

function createTokenParser(): SqlPrintTokenParser {
    return new SqlPrintTokenParser({
        preset: PRESETS.postgres,
        parameterStyle: 'indexed',
    });
}

function createPhaseContext(): PhaseContext {
    return {
        tokenParser: createTokenParser(),
        printer: new SqlPrinter(PRINTER_OPTIONS),
        formatter: new SqlFormatter(FORMATTER_OPTIONS),
    };
}

function prepareInputs(phase: PhaseName, scenario: CorpusDefinition, count: number): PreparedInput[] {
    const inputs: PreparedInput[] = [];
    const tokenParser = createTokenParser();

    for (let index = 0; index < count; index += 1) {
        const ast = parseScenarioAst(scenario.sql);
        if (phase === 'renderer.print') {
            inputs.push({ kind: 'token', token: tokenParser.parse(ast).token });
        } else {
            inputs.push({ kind: 'ast', ast });
        }
    }

    return inputs;
}

function executePhase(
    phase: PhaseName,
    input: PreparedInput,
    context: PhaseContext,
    scenario: CorpusDefinition,
): unknown {
    if (phase === 'renderer.print') {
        if (input.kind !== 'token') {
            throw new Error(`Expected a print token for ${phase}.`);
        }
        return context.printer.print(input.token);
    }

    if (input.kind !== 'ast') {
        throw new Error(`Expected an AST for ${phase}.`);
    }

    switch (phase) {
        case 'analyzer.select-output-collection':
            return new SelectOutputCollector(resolveTableColumns).collect(input.ast);
        case 'analyzer.integrated-condition-optimization':
            return optimizeConditions(input.ast, {
                ...scenario.conditionOptions,
                cloneInput: false,
            });
        case 'renderer.token-build':
            return context.tokenParser.parse(input.ast);
        case 'renderer.hot-format':
            return context.formatter.format(input.ast);
        case 'renderer.cold-format':
            return new SqlFormatter(FORMATTER_OPTIONS).format(input.ast);
        default:
            return assertNever(phase);
    }
}

function projectPhaseOutput(phase: PhaseName, output: unknown): SemanticSink {
    switch (phase) {
        case 'analyzer.select-output-collection':
            return projectSelectOutputs(output as SelectOutputColumn[]);
        case 'analyzer.integrated-condition-optimization':
            return projectConditionResult(output as ConditionOptimizationResult);
        case 'renderer.token-build': {
            const parsed = output as ReturnType<SqlPrintTokenParser['parse']>;
            const sql = new SqlPrinter(PRINTER_OPTIONS).print(parsed.token);
            return projectSqlResult('token-build-sql-and-params', sql, parsed.params);
        }
        case 'renderer.print':
            return projectSqlResult('printed-sql', output as string, null);
        case 'renderer.hot-format':
        case 'renderer.cold-format': {
            const formatted = output as ReturnType<SqlFormatter['format']>;
            return projectSqlResult('formatted-sql-and-params', formatted.formattedSql, formatted.params);
        }
        default:
            return assertNever(phase);
    }
}

function projectSelectOutputs(outputs: SelectOutputColumn[]): SemanticSink {
    const valueFormatter = new SqlFormatter(FORMATTER_OPTIONS);
    const projection = outputs.map((output) => ({
        name: output.name,
        outputIndex: output.outputIndex,
        sourceAlias: output.sourceAlias,
        sourceName: output.sourceName,
        sourceColumnName: output.sourceColumnName,
        valueSql: valueFormatter.format(output.value).formattedSql,
    }));
    const duplicateNames = projection.length - new Set(projection.map((output) => output.name)).size;

    return {
        kind: 'ordered-select-output-metadata',
        signatureSha256: hashStableValue(projection),
        summary: {
            outputCount: projection.length,
            duplicateNameCount: duplicateNames,
        },
    };
}

function projectConditionResult(result: ConditionOptimizationResult): SemanticSink {
    const queryProjection = result.query
        ? new SqlFormatter(FORMATTER_OPTIONS).format(result.query)
        : null;
    const debugQueryProjection = result.diagnostics?.debugQuery
        ? new SqlFormatter(FORMATTER_OPTIONS).format(result.diagnostics.debugQuery)
        : null;
    const diagnostics = result.diagnostics
        ? {
            probes: result.diagnostics.probes,
            skippedProbes: result.diagnostics.skippedProbes,
            debugSql: result.diagnostics.debugSql,
            debugQueryProjection,
        }
        : null;
    const projection = {
        ok: result.ok,
        sql: result.sql,
        queryProjection,
        phases: result.phases,
        applied: result.applied,
        skipped: result.skipped,
        warnings: result.warnings,
        errors: result.errors,
        safety: result.safety,
        diagnostics,
    };

    return {
        kind: 'condition-optimization-result-without-query-object',
        signatureSha256: hashStableValue(projection),
        summary: {
            ok: result.ok,
            sqlBytes: Buffer.byteLength(result.sql, 'utf8'),
            sqlSha256: sha256(result.sql),
            queryProjectionSha256: queryProjection ? hashStableValue(queryProjection) : 'null',
            debugQueryProjectionSha256: debugQueryProjection
                ? hashStableValue(debugQueryProjection)
                : 'null',
            appliedCount: result.applied.length,
            skippedCount: result.skipped.length,
            warningCount: result.warnings.length,
            errorCount: result.errors.length,
        },
    };
}

function projectSqlResult(kind: string, sql: string, params: unknown): SemanticSink {
    const parameterCount = Array.isArray(params)
        ? params.length
        : params && typeof params === 'object'
            ? Object.keys(params).length
            : 0;
    return {
        kind,
        signatureSha256: hashStableValue({ sql, params }),
        summary: {
            sqlBytes: Buffer.byteLength(sql, 'utf8'),
            sqlSha256: sha256(sql),
            paramsSha256: hashStableValue(params),
            parameterCount,
        },
    };
}

function measurePhaseScenario(
    phase: PhaseDefinition,
    scenario: CorpusDefinition,
    config: ProfileConfig,
): PhaseScenarioResult {
    const totalSamples = config.warmupSamples + config.measuredSamples;
    const inputs = prepareInputs(
        phase.name,
        scenario,
        totalSamples * config.invocationsPerSample,
    );
    const expectedInput = prepareInputs(phase.name, scenario, 1)[0];
    const expectedOutput = executePhase(phase.name, expectedInput, createPhaseContext(), scenario);
    const expectedSink = projectPhaseOutput(phase.name, expectedOutput);
    const context = createPhaseContext();
    const rawSamplesMs: number[] = [];
    let inputIndex = 0;

    for (let sampleIndex = 0; sampleIndex < totalSamples; sampleIndex += 1) {
        const sampleOutputs = new Array<unknown>(config.invocationsPerSample);
        const start = process.hrtime.bigint();
        for (let invocation = 0; invocation < config.invocationsPerSample; invocation += 1) {
            sampleOutputs[invocation] = executePhase(phase.name, inputs[inputIndex], context, scenario);
            inputIndex += 1;
        }
        const elapsedNanoseconds = process.hrtime.bigint() - start;
        for (let invocation = 0; invocation < sampleOutputs.length; invocation += 1) {
            const output = sampleOutputs[invocation];
            if (output === undefined) {
                throw new Error(
                    `No output was produced for ${phase.name}/${scenario.name} invocation ${invocation}.`,
                );
            }
            const actualSink = projectPhaseOutput(phase.name, output);
            assertSemanticSink(
                phase.name,
                scenario.name,
                sampleIndex,
                invocation,
                expectedSink,
                actualSink,
            );
            observeSink(actualSink);
        }

        if (sampleIndex >= config.warmupSamples) {
            rawSamplesMs.push(round6(
                Number(elapsedNanoseconds) / 1_000_000 / config.invocationsPerSample,
            ));
        }
    }

    return {
        phase: phase.name,
        scenario: scenario.name,
        boundary: phase.boundary,
        includedWork: phase.includedWork,
        excludedWork: phase.excludedWork,
        warmupSamples: config.warmupSamples,
        measuredSamples: config.measuredSamples,
        invocationsPerSample: config.invocationsPerSample,
        rawSamplesMs,
        stats: computeStats(rawSamplesMs),
        semanticSink: expectedSink,
        optimizationEffectConclusion: 'not_measured',
    };
}

function assertSemanticSink(
    phase: PhaseName,
    scenario: string,
    sampleIndex: number,
    invocation: number,
    expected: SemanticSink,
    actual: SemanticSink,
): void {
    if (stableSerialize(expected) !== stableSerialize(actual)) {
        throw new Error(
            `Semantic sink mismatch for ${phase}/${scenario} at sample ${sampleIndex}: `
            + `invocation ${invocation}: `
            + `expected ${expected.signatureSha256}, received ${actual.signatureSha256}.`,
        );
    }
}

function observeSink(sink: SemanticSink): void {
    observableSink = ((observableSink * 33) ^ Number.parseInt(sink.signatureSha256.slice(0, 8), 16)) >>> 0;
}

function resolveTableColumns(tableName: string): string[] {
    return [...(TABLE_COLUMNS[tableName.toLowerCase()] ?? [])];
}

function parseScenarioAst(sql: string): SelectQuery {
    const ast = SelectQueryParser.parse(sql);
    const parameterValues = new Map<string, string>();
    for (const parameter of ParameterCollector.collect(ast)) {
        const name = parameter.name.value;
        const value = parameterValues.get(name) ?? `benchmark-value:${name}`;
        parameterValues.set(name, value);
        parameter.value = value;
    }
    return ast;
}

function computeStats(samples: number[]): PhaseStats {
    const sorted = [...samples].sort((left, right) => left - right);
    const mean = samples.reduce((sum, sample) => sum + sample, 0) / samples.length;
    const variance = samples.reduce((sum, sample) => sum + (sample - mean) ** 2, 0) / samples.length;
    const p95Index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);

    return {
        meanMs: round6(mean),
        p95Ms: round6(sorted[p95Index]),
        stddevMs: round6(Math.sqrt(variance)),
        minMs: round6(sorted[0]),
        maxMs: round6(sorted[sorted.length - 1]),
        sampleCount: samples.length,
    };
}

function collectEnvironment(): BenchmarkReport['environment'] {
    const cpu = os.cpus()[0];
    const userAgent = process.env.npm_config_user_agent ?? '';
    const pnpmMatch = /pnpm\/([^\s]+)/.exec(userAgent);

    return {
        node: process.version,
        pnpm: pnpmMatch?.[1] ?? 'unknown',
        platform: os.type(),
        release: os.release(),
        architecture: os.arch(),
        cpu: cpu?.model ?? 'unknown',
        logicalCores: os.cpus().length,
        processId: process.pid,
        launcher: 'ts-node',
    };
}

function collectCommit(): BenchmarkReport['commit'] {
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const status = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();
    return { sha, dirty: status.length > 0 };
}

function createReport(
    config: ProfileConfig,
    corpus: CorpusDefinition[],
    phases: PhaseDefinition[],
    results: PhaseScenarioResult[],
    pairRun: BenchmarkReport['pairRun'],
): BenchmarkReport {
    return {
        schemaVersion: 1,
        profile: config.name,
        timestamp: new Date().toISOString(),
        commit: collectCommit(),
        environment: collectEnvironment(),
        method: {
            timer: 'process.hrtime.bigint',
            percentile: 'nearest-rank',
            warmupSamples: config.warmupSamples,
            measuredSamples: config.measuredSamples,
            invocationsPerSample: config.invocationsPerSample,
            corpusSeed: CORPUS_SEED,
            objectIdentityPolicy: 'Every warmup and measured invocation consumes a distinct AST parsed before its timed region.',
            semanticValidation: 'Every invocation result is retained, then projected, hashed, and deep-compared with an expected signature after timing.',
            candidateComparison: 'absent',
            phaseScope: phases.map((phase) => phase.name),
        },
        pairRun,
        formatterOptions: FORMATTER_OPTIONS,
        corpus: corpus.map((scenario) => ({
            name: scenario.name,
            source: scenario.source,
            features: scenario.features,
            sqlBytes: Buffer.byteLength(scenario.sql, 'utf8'),
            sqlSha256: sha256(scenario.sql),
        })),
        phases: PHASES,
        results,
        limitations: [
            'This baseline-only run does not measure an optimization effect or identify a causal hotspot.',
            'The integrated condition phase includes compatibility SQL rendering and must not be treated as a pure analyzer micro-phase.',
            'The hot and cold formatter results are whole-envelope measurements; their difference is not constructor cost.',
            'Each scenario is reported separately; no blended workload distribution or production frequency is claimed.',
            'The PR profile batches eight one-shot invocations per sample, but sub-millisecond phases can remain scheduler, GC, and JIT sensitive.',
            'ts-node overhead is outside most timed calls but affects process startup and runtime instrumentation; profile built JavaScript for causal work.',
            'Run the command in multiple independent processes before comparing a future candidate with this baseline.',
        ],
    };
}

function printResults(report: BenchmarkReport, phases: PhaseDefinition[]): void {
    console.log(`Profile: ${report.profile}`);
    console.log(`Commit: ${report.commit.sha} (${report.commit.dirty ? 'dirty' : 'clean'})`);
    console.log(`Node: ${report.environment.node}`);
    console.log(`Process: ${report.environment.processId}`);
    console.log('');

    for (const phase of phases) {
        console.log(`Phase: ${phase.name}`);
        console.log('| Scenario | mean(ms) | p95(ms) | stddev(ms) | sink |');
        console.log('|---|---:|---:|---:|---|');
        for (const result of report.results.filter((candidate) => candidate.phase === phase.name)) {
            console.log(
                `| ${result.scenario} | ${result.stats.meanMs.toFixed(6)} | ${result.stats.p95Ms.toFixed(6)} | `
                + `${result.stats.stddevMs.toFixed(6)} | ${result.semanticSink.signatureSha256.slice(0, 12)} |`,
            );
        }
        console.log('');
    }
}

function writeReport(report: BenchmarkReport): string {
    const explicitOutputFile = parseOptionalArg('--output-file');
    if (explicitOutputFile) {
        const outputPath = path.resolve(explicitOutputFile);
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), { encoding: 'utf8', flag: 'wx' });
        return outputPath;
    }

    const tmpDir = path.resolve(__dirname, '../tmp');
    fs.mkdirSync(tmpDir, { recursive: true });
    const timestamp = report.timestamp.replace(/[:]/g, '-');
    const outputPath = path.join(
        tmpDir,
        `ast-analysis-phase-benchmark-${report.profile}-${timestamp}-pid${process.pid}.json`,
    );
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');
    return outputPath;
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

function hashStableValue(value: unknown): string {
    return sha256(stableSerialize(value));
}

function sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
}

function round6(value: number): number {
    return Math.round(value * 1_000_000) / 1_000_000;
}

function assertNever(value: never): never {
    throw new Error(`Unhandled phase: ${String(value)}`);
}

function main(): void {
    const profile = parseProfileArg();
    const config = getProfileConfig(profile);
    const phases = parsePhaseScopeArg();
    const pairRun = parsePairRunArg();
    const corpus = createCorpus(config);
    const results: PhaseScenarioResult[] = [];

    for (const phase of phases) {
        for (const scenario of corpus) {
            try {
                results.push(measurePhaseScenario(phase, scenario, config));
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                const report = createReport(config, corpus, phases, results, pairRun);
                report.failure = {
                    kind: message.startsWith('Semantic sink mismatch')
                        ? 'semantic_mismatch'
                        : 'execution_failure',
                    phase: phase.name,
                    scenario: scenario.name,
                    message,
                };
                const reportPath = writeReport(report);
                console.error(message);
                console.error(`Partial report saved to ${path.relative(process.cwd(), reportPath)}`);
                process.exitCode = 1;
                return;
            }
        }
    }

    const report = createReport(config, corpus, phases, results, pairRun);
    printResults(report, phases);
    const reportPath = writeReport(report);
    console.log(`Observable sink: ${observableSink >>> 0}`);
    console.log(`Report saved to ${path.relative(process.cwd(), reportPath)}`);
}

main();
