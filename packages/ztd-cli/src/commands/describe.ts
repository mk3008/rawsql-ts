import { Command } from 'commander';
import { isJsonOutput, writeCommandEnvelope } from '../utils/agentCli';

interface CommandFlagDescriptor {
  name: string;
  description: string;
  defaultValue?: string | boolean;
}

interface CommandDescriptor {
  name: string;
  summary: string;
  writesFiles: boolean;
  supportsDryRun: boolean;
  supportsJsonPayload: boolean;
  supportsDescribeOutput?: boolean;
  output?: {
    stdout?: string;
    files?: string[];
  };
  exitCodes: Record<string, string>;
  flags: CommandFlagDescriptor[];
}

const COMMANDS: CommandDescriptor[] = [
  {
    name: 'init',
    summary: 'Scaffold a ZTD project with templates, config, and optional demo assets.',
    writesFiles: true,
    supportsDryRun: true,
    supportsJsonPayload: true,
    output: {
      stdout: 'Human summary in text mode, JSON envelope in global json mode.',
      files: ['ztd.config.json', 'db/ddl/*.sql', '.ztd/generated/*', '.ztd/agents/*', 'CONTEXT.md']
    },
    exitCodes: {
      '0': 'Scaffold completed or dry-run plan emitted.',
      '1': 'Validation or filesystem error.'
    },
    flags: [
      { name: '--dry-run', description: 'Validate inputs and emit the planned scaffold without writing files.' },
      { name: '--json', description: 'Pass init options as a JSON object.' },
      { name: '--yes', description: 'Accept defaults and overwrite existing files.' }
    ]
  },
  {
    name: 'agents init',
    summary: 'Initialize the opt-in Codex bootstrap files from the managed templates.',
    writesFiles: true,
    supportsDryRun: true,
    supportsJsonPayload: false,
    output: {
      stdout: 'Human init summary in text mode, JSON envelope in global json mode.',
      files: [
        'AGENTS.md or AGENTS_ztd.md',
        'db/**/AGENTS.md',
        'src/**/AGENTS.md',
        '.codex/config.toml',
        '.codex/agents/*.md'
      ]
    },
    exitCodes: {
      '0': 'Codex bootstrap initialization completed, was already up to date, or dry-run output was emitted.',
      '1': 'Filesystem or validation error.'
    },
    flags: [
      { name: '--dry-run', description: 'Emit the planned Codex bootstrap files without writing them.' }
    ]
  },
  {
    name: 'agents install',
    summary: 'Alias for agents init.',
    writesFiles: true,
    supportsDryRun: true,
    supportsJsonPayload: false,
    output: {
      stdout: 'Human init summary in text mode, JSON envelope in global json mode.',
      files: [
        'AGENTS.md or AGENTS_ztd.md',
        'db/**/AGENTS.md',
        'src/**/AGENTS.md',
        '.codex/config.toml',
        '.codex/agents/*.md'
      ]
    },
    exitCodes: {
      '0': 'Codex bootstrap initialization completed, was already up to date, or dry-run output was emitted.',
      '1': 'Filesystem or validation error.'
    },
    flags: [
      { name: '--dry-run', description: 'Emit the planned Codex bootstrap files without writing them.' }
    ]
  },
  {
    name: 'agents status',
    summary: 'Report managed Codex bootstrap and AGENTS guidance state and drift signals.',
    writesFiles: false,
    supportsDryRun: false,
    supportsJsonPayload: false,
    output: {
      stdout: 'Human status report in text mode, JSON envelope in global json mode.'
    },
    exitCodes: {
      '0': 'Status emitted.',
      '1': 'Filesystem or parsing error.'
    },
    flags: []
  },
  {
    name: 'feature scaffold',
    summary: 'Scaffold a feature-local CRUD boundary skeleton from schema metadata.',
    writesFiles: true,
    supportsDryRun: true,
    supportsJsonPayload: false,
    output: {
      stdout: 'Human scaffold summary in text mode, JSON envelope in global json mode.',
      files: [
        'src/features/<feature-name>/',
        'src/features/<feature-name>/boundary.ts',
        'src/features/<feature-name>/queries/<query-name>/',
        'src/features/<feature-name>/queries/<query-name>/boundary.ts',
        'src/features/<feature-name>/queries/<query-name>/<query-name>.sql',
        'src/features/<feature-name>/tests/',
        'src/features/<feature-name>/tests/<feature-name>.boundary.test.ts',
        'src/features/<feature-name>/README.md',
        'src/features/_shared/featureQueryExecutor.ts on first scaffold run',
        'src/features/_shared/loadSqlResource.ts on first scaffold run'
      ]
    },
    exitCodes: {
      '0': 'Scaffold completed or dry-run plan emitted.',
      '1': 'Validation, metadata resolution, or filesystem error.'
    },
    flags: [
      { name: '--table <table>', description: 'Target table name for the scaffold.' },
      { name: '--action <action>', description: 'Action template to scaffold. v1 supports insert, update, delete, get-by-id, and list.' },
      { name: '--feature-name <name>', description: 'Override the derived resource-action feature name.' },
      { name: '--dry-run', description: 'Validate inputs and emit the planned scaffold without writing files.' },
      { name: '--force', description: 'Overwrite scaffold-owned feature files when they already exist.' }
    ]
  },
  {
    name: 'feature query scaffold',
    summary: 'Add one additive child query boundary under an existing boundary without rewriting the parent boundary.',
    writesFiles: true,
    supportsDryRun: true,
    supportsJsonPayload: false,
    output: {
      stdout: 'Human additive scaffold summary in text mode, JSON envelope in global json mode.',
      files: [
        '<target-boundary>/queries/<query-name>/',
        '<target-boundary>/queries/<query-name>/boundary.ts',
        '<target-boundary>/queries/<query-name>/<query-name>.sql',
        'src/features/_shared/featureQueryExecutor.ts on first scaffold run',
        'src/features/_shared/loadSqlResource.ts on first scaffold run'
      ]
    },
    exitCodes: {
      '0': 'Scaffold completed or dry-run plan emitted.',
      '1': 'Validation, metadata resolution, or filesystem error.'
    },
    flags: [
      { name: '--table <table>', description: 'Target table name for the new query boundary.' },
      { name: '--action <action>', description: 'Query action template to scaffold. v1 supports insert, update, delete, get-by-id, and list.' },
      { name: '--query-name <name>', description: 'Name of the child query boundary to create under queries/.' },
      { name: '--feature <name>', description: 'Resolve the target boundary as src/features/<feature-name>.' },
      { name: '--boundary-dir <path>', description: 'Resolve the target boundary from an explicit existing boundary folder. Use either --feature or --boundary-dir.' },
      { name: '--dry-run', description: 'Validate inputs and emit the planned additive scaffold without writing files.' }
    ]
  },
  {
    name: 'ztd-config',
    summary: 'Generate TestRowMap, runtime fixture metadata, and layout metadata from local DDL.',
    writesFiles: true,
    supportsDryRun: true,
    supportsJsonPayload: true,
    output: {
      stdout: 'Status or JSON envelope.',
      files: [
        '.ztd/generated/ztd-row-map.generated.ts',
        '.ztd/generated/ztd-fixture-manifest.generated.ts',
        '.ztd/generated/ztd-layout.generated.ts'
      ]
    },
    exitCodes: {
      '0': 'Generation completed or dry-run plan emitted.',
      '1': 'Generation failed.'
    },
    flags: [
      { name: '--dry-run', description: 'Render and validate generation without writing files.' },
      { name: '--json', description: 'Pass ztd-config options as a JSON object.' },
      { name: '--watch', description: 'Watch DDL files and regenerate on change.', defaultValue: false }
    ]
  },
  {
    name: 'model-gen',
    summary: 'Probe SQL metadata and generate QuerySpec scaffolding from feature-local or shared SQL assets.',
    writesFiles: true,
    supportsDryRun: true,
    supportsJsonPayload: true,
    supportsDescribeOutput: true,
    output: {
      stdout: 'Generated TypeScript when --out is omitted; JSON envelope in global json mode.',
      files: ['Specified --out file when present']
    },
    exitCodes: {
      '0': 'Generation completed, dry-run plan emitted, or output contract described.',
      '1': 'Validation or probing failed.'
    },
    flags: [
      { name: '--dry-run', description: 'Validate probing and show the planned output file without writing it.' },
      { name: '--json', description: 'Pass model-gen options as a JSON object.' },
      { name: '--describe-output', description: 'Print the generated artifact contract instead of probing.' },
      { name: '--sql-root', description: 'Compatibility helper for shared SQL roots; feature-local SQL resolves naturally without it.' }
    ]
  },
  {
    name: 'ddl pull',
    summary: 'Pull PostgreSQL schema DDL via pg_dump and normalize it into per-schema files.',
    writesFiles: true,
    supportsDryRun: true,
    supportsJsonPayload: true,
    output: {
      stdout: 'Status or JSON envelope.',
      files: ['<out>/<schema>.sql']
    },
    exitCodes: {
      '0': 'Pull completed or dry-run plan emitted.',
      '1': 'pg_dump or normalization failed.'
    },
    flags: [
      { name: '--dry-run', description: 'Run pg_dump and normalization without writing schema files.' },
      { name: '--json', description: 'Pass pull options as a JSON object.' }
    ]
  },
  {
    name: 'ddl diff',
    summary: 'Compare local DDL with a live database and emit logical summary, structured risks, and a pure SQL artifact.',
    writesFiles: true,
    supportsDryRun: true,
    supportsJsonPayload: true,
    output: {
      stdout: 'Human logical summary plus structured risks in text mode, JSON envelope in global json mode.',
      files: ['Specified --out SQL file plus companion .txt and .json review artifacts with summary/risks']
    },
    exitCodes: {
      '0': 'Diff completed or dry-run review emitted.',
      '1': 'Local discovery or pg_dump failed.'
    },
    flags: [
      { name: '--dry-run', description: 'Compute the logical summary and structured risks without writing the SQL or review artifacts.' },
      { name: '--json', description: 'Pass diff options as a JSON object.' }
    ]
  },
  {
    name: 'ddl risk',
    summary: 'Analyze a generated or hand-edited migration SQL file and emit the same structured risk contract used by ddl diff.',
    writesFiles: false,
    supportsDryRun: false,
    supportsJsonPayload: true,
    output: {
      stdout: 'Human structured risk report in text mode, JSON envelope in global json mode.'
    },
    exitCodes: {
      '0': 'Risk report emitted.',
      '1': 'Validation or file loading failed.'
    },
    flags: [
      { name: '--file', description: 'Migration SQL file to analyze.' },
      { name: '--json', description: 'Pass risk options as a JSON object.' }
    ]
  },
  {
    name: 'ddl gen-entities',
    summary: 'Generate helper interfaces from DDL metadata.',
    writesFiles: true,
    supportsDryRun: true,
    supportsJsonPayload: true,
    output: {
      stdout: 'Status or JSON envelope.',
      files: ['Specified --out entities file']
    },
    exitCodes: {
      '0': 'Generation completed or dry-run plan emitted.',
      '1': 'DDL parsing failed.'
    },
    flags: [
      { name: '--dry-run', description: 'Render entities without writing the output file.' },
      { name: '--json', description: 'Pass generation options as a JSON object.' }
    ]
  },
  {
    name: 'check contract',
    summary: 'Validate SQL contract specs and emit deterministic findings.',
    writesFiles: true,
    supportsDryRun: false,
    supportsJsonPayload: true,
    output: {
      stdout: 'Human report or deterministic JSON report.'
    },
    exitCodes: {
      '0': 'No violations.',
      '1': 'Violations detected.',
      '2': 'Runtime or config error.'
    },
    flags: [
      { name: '--format json', description: 'Emit the report as deterministic JSON.' },
      { name: '--json', description: 'Pass check options as a JSON object.' }
    ]
  },
  {
    name: 'perf init',
    summary: 'Scaffold the opt-in perf sandbox configuration and Docker assets.',
    writesFiles: true,
    supportsDryRun: true,
    supportsJsonPayload: true,
    output: {
      stdout: 'Human scaffold summary or JSON envelope.',
      files: ['perf/sandbox.json', 'perf/seed.yml', 'perf/params.yml', 'perf/docker-compose.yml', 'perf/README.md', 'perf/.gitignore']
    },
    exitCodes: {
      '0': 'Scaffold completed or dry-run plan emitted.',
      '1': 'Validation or filesystem error.'
    },
    flags: [
      { name: '--dry-run', description: 'Emit the planned perf sandbox scaffold without writing files.' },
      { name: '--json', description: 'Pass perf init options as a JSON object.' }
    ]
  },
  {
    name: 'perf db reset',
    summary: 'Recreate the perf sandbox schema from local DDL.',
    writesFiles: false,
    supportsDryRun: true,
    supportsJsonPayload: true,
    output: {
      stdout: 'Human reset summary or JSON envelope.'
    },
    exitCodes: {
      '0': 'Reset completed or dry-run plan emitted.',
      '1': 'Docker, connection, or DDL replay failed.'
    },
    flags: [
      { name: '--dry-run', description: 'Emit the DDL replay plan without touching Docker or PostgreSQL.' },
      { name: '--json', description: 'Pass perf db reset options as a JSON object.' }
    ]
  },
  {
    name: 'perf seed',
    summary: 'Generate deterministic synthetic data from perf/seed.yml.',
    writesFiles: false,
    supportsDryRun: true,
    supportsJsonPayload: true,
    output: {
      stdout: 'Human seed summary or JSON envelope.'
    },
    exitCodes: {
      '0': 'Seed completed or dry-run plan emitted.',
      '1': 'Connection, DDL parsing, or insert generation failed.'
    },
    flags: [
      { name: '--dry-run', description: 'Emit the seed plan without touching PostgreSQL.' },
      { name: '--json', description: 'Pass perf seed options as a JSON object.' }
    ]
  },
  {
    name: 'perf run',
    summary: 'Benchmark a SQL query and emit evidence for AI-driven tuning loops.',
    writesFiles: true,
    supportsDryRun: true,
    supportsJsonPayload: true,
    output: {
      stdout: 'Human benchmark summary or JSON envelope.',
      files: ['perf/evidence/run_xxx/* when --save is enabled']
    },
    exitCodes: {
      '0': 'Benchmark completed or dry-run plan emitted.',
      '1': 'Validation, connection, or execution failed.'
    },
    flags: [
      { name: '--query', description: 'SQL file to benchmark inside the perf sandbox.' },
      { name: '--params', description: 'JSON or YAML file with named or positional parameters.' },
      { name: '--strategy', description: 'Execution strategy (direct|decomposed).', defaultValue: 'direct' },
      { name: '--material', description: 'Comma-separated CTEs to materialize when using decomposed execution.' },
      { name: '--mode', description: 'Benchmark mode (auto|latency|completion).', defaultValue: 'auto' },
      { name: '--repeat', description: 'Measured repetitions for latency mode.', defaultValue: '10' },
      { name: '--warmup', description: 'Warmup repetitions for latency mode.', defaultValue: '3' },
      { name: '--classify-threshold-seconds', description: 'Threshold for auto mode classification.', defaultValue: '60' },
      { name: '--timeout-minutes', description: 'Timeout for measured runs.', defaultValue: '5' },
      { name: '--save', description: 'Persist benchmark evidence under perf/evidence/run_xxx.' },
      { name: '--dry-run', description: 'Resolve benchmark mode and evidence shape without touching PostgreSQL.' },
      { name: '--label', description: 'Attach a short label to the saved run directory.' },
      { name: '--json', description: 'Pass perf run options as a JSON object.' }
    ]
  },
  {
    name: 'perf report diff',
    summary: 'Compare two saved perf benchmark runs and report the primary delta.',
    writesFiles: false,
    supportsDryRun: false,
    supportsJsonPayload: true,
    output: {
      stdout: 'Human diff summary or JSON envelope.'
    },
    exitCodes: {
      '0': 'Diff report emitted.',
      '1': 'Evidence loading or validation failed.'
    },
    flags: [
      { name: '--format', description: 'Output format (text|json).', defaultValue: 'text' },
      { name: '--json', description: 'Pass perf report diff options as a JSON object.' }
    ]
  },  {
    name: 'query uses',
    summary: 'Inspect catalog SQL usage of tables or columns.',
    writesFiles: true,
    supportsDryRun: false,
    supportsJsonPayload: true,
    output: {
      stdout: 'Text report or versioned JSON report with optional display metadata.'
    },
    exitCodes: {
      '0': 'Report emitted.',
      '1': 'Validation failed.'
    },
    flags: [
      { name: '--format json', description: 'Emit a versioned JSON usage report.' },
      { name: '--json', description: 'Pass target and options as a JSON object.' },
      { name: '--summary-only', description: 'Emit only summary counts with display metadata.' },
      { name: '--limit', description: 'Truncate matches and warnings while preserving summary totals.' }
    ]
  },
  {
    name: 'query match-observed',
    summary: 'Rank likely source SQL assets for an observed SELECT statement.',
    writesFiles: true,
    supportsDryRun: false,
    supportsJsonPayload: false,
    output: {
      stdout: 'Text ranking report or JSON report for observed SQL candidates.',
      files: ['Specified --out file when present']
    },
    exitCodes: {
      '0': 'Report emitted.',
      '1': 'Validation failed or no candidate SELECT assets were found.'
    },
    flags: [
      { name: '--sql', description: 'Observed SQL text to rank.' },
      { name: '--sql-file', description: 'Read the observed SQL text from a file.' },
      { name: '--format json', description: 'Emit a machine-readable JSON ranking report.' },
      { name: '--out', description: 'Write output to a file.' }
    ]
  },
  {
    name: 'lint',
    summary: 'Lint SQL files with fixture-backed validation.',
    writesFiles: false,
    supportsDryRun: false,
    supportsJsonPayload: true,
    output: {
      stdout: 'Silent on success in text mode, JSON envelope in global json mode.'
    },
    exitCodes: {
      '0': 'Lint completed without failures.',
      '1': 'Lint failures or runtime error.'
    },
    flags: [
      { name: '--json', description: 'Pass lint options as a JSON object.' }
    ]
  },
  {
    name: 'evidence',
    summary: 'Generate deterministic specification evidence artifacts.',
    writesFiles: true,
    supportsDryRun: false,
    supportsJsonPayload: true,
    output: {
      files: ['<out-dir>/test-specification.json', '<out-dir>/test-specification.md']
    },
    exitCodes: {
      '0': 'Evidence generated.',
      '1': 'Generation failed.',
      '2': 'Runtime or config error.'
    },
    flags: [
      { name: '--json', description: 'Pass evidence options as a JSON object.' }
    ]
  }
];

export function getDescribeCommandDescriptors(): readonly CommandDescriptor[] {
  return COMMANDS;
}

export function registerDescribeCommand(program: Command): void {
  const describe = program.command('describe').description('Describe ztd-cli commands and output contracts');

  describe.action(() => {
    const payload = {
      schemaVersion: 1,
      commands: COMMANDS.map((command) => ({
        name: command.name,
        summary: command.summary,
        writesFiles: command.writesFiles,
        supportsDryRun: command.supportsDryRun,
        supportsJsonPayload: command.supportsJsonPayload,
        supportsDescribeOutput: command.supportsDescribeOutput ?? false
      }))
    };

    if (isJsonOutput()) {
      writeCommandEnvelope('describe', payload);
      return;
    }

    const lines = ['Available command descriptions:'];
    for (const command of COMMANDS) {
      lines.push(`- ${command.name}: ${command.summary}`);
    }
    process.stdout.write(`${lines.join('\n')}\n`);
  });

  describe
    .command('command <name>')
    .description('Describe one command in detail')
    .action((name: string) => {
      const descriptor = COMMANDS.find((command) => command.name === name.trim());
      if (!descriptor) {
        throw new Error(`Unknown command description: ${name}`);
      }

      if (isJsonOutput()) {
        writeCommandEnvelope('describe command', {
          schemaVersion: 1,
          command: descriptor
        });
        return;
      }

      const lines = [
        `${descriptor.name}`,
        descriptor.summary,
        `writesFiles: ${descriptor.writesFiles}`,
        `supportsDryRun: ${descriptor.supportsDryRun}`,
        `supportsJsonPayload: ${descriptor.supportsJsonPayload}`
      ];
      if (descriptor.supportsDescribeOutput) {
        lines.push('supportsDescribeOutput: true');
      }
      lines.push('flags:');
      for (const flag of descriptor.flags) {
        lines.push(`- ${flag.name}: ${flag.description}`);
      }
      lines.push('exitCodes:');
      for (const [code, message] of Object.entries(descriptor.exitCodes)) {
        lines.push(`- ${code}: ${message}`);
      }
      process.stdout.write(`${lines.join('\n')}\n`);
    });
}
