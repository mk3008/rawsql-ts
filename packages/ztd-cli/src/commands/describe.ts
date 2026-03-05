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
      files: ['ztd.config.json', 'ztd/ddl/*.sql', 'tests/generated/*', 'AGENTS.md', 'CONTEXT.md']
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
    name: 'ztd-config',
    summary: 'Generate TestRowMap and layout metadata from local DDL.',
    writesFiles: true,
    supportsDryRun: true,
    supportsJsonPayload: true,
    output: {
      stdout: 'Status or JSON envelope.',
      files: ['tests/generated/ztd-row-map.generated.ts', 'tests/generated/ztd-layout.generated.ts']
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
    summary: 'Probe SQL metadata and generate QuerySpec scaffolding.',
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
      { name: '--describe-output', description: 'Print the generated artifact contract instead of probing.' }
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
    summary: 'Compare local DDL with a live database and emit a diff plan.',
    writesFiles: true,
    supportsDryRun: true,
    supportsJsonPayload: true,
    output: {
      stdout: 'Status or JSON envelope.',
      files: ['Specified --out patch file']
    },
    exitCodes: {
      '0': 'Diff completed or dry-run plan emitted.',
      '1': 'Local discovery or pg_dump failed.'
    },
    flags: [
      { name: '--dry-run', description: 'Compute the patch without writing the plan file.' },
      { name: '--json', description: 'Pass diff options as a JSON object.' }
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
