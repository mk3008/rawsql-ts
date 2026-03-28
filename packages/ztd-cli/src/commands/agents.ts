import { Command } from 'commander';
import { getAgentsInstallPlan, getAgentsStatus, installAgentsBootstrap } from '../utils/agents';
import { isJsonOutput, writeCommandEnvelope } from '../utils/agentCli';

function runAgentsInit(commandName: 'agents init' | 'agents install', dryRun: boolean): void {
  const plan = getAgentsInstallPlan(process.cwd());
  const lines = ['About to create:'];
  if (plan.createPaths.length === 0) {
    lines.push(' - (none)');
  } else {
    for (const targetPath of plan.createPaths) {
      lines.push(` - ${targetPath}`);
    }
  }
  lines.push('No files will be overwritten.');
  if (plan.conflictPaths.length > 0) {
    lines.push('Unmanaged conflicts will be preserved:');
    for (const targetPath of plan.conflictPaths) {
      lines.push(` - ${targetPath}`);
    }
  }
  if (plan.customizedPaths.length > 0) {
    lines.push('Customized managed files will be preserved:');
    for (const targetPath of plan.customizedPaths) {
      lines.push(` - ${targetPath}`);
    }
  }
  lines.push(`Omit \`ztd ${commandName}\` if you do not want the Codex bootstrap files.`);

  if (dryRun) {
    lines.push('Dry run only; no files were written.');
    if (isJsonOutput()) {
      writeCommandEnvelope(commandName, {
        schemaVersion: 1,
        dryRun: true,
        plannedPaths: plan.createPaths,
        conflictPaths: plan.conflictPaths,
        customizedPaths: plan.customizedPaths,
        managedPaths: plan.managedPaths,
        messageLines: lines
      });
      return;
    }

    process.stdout.write(`${lines.join('\n')}\n`);
    return;
  }

  const written = installAgentsBootstrap(process.cwd());
  if (isJsonOutput()) {
    writeCommandEnvelope(commandName, {
      schemaVersion: 1,
      dryRun: false,
      plannedPaths: plan.createPaths,
      createdPaths: written.created.map((summary) => summary.relativePath),
      conflictPaths: written.conflictPaths,
      customizedPaths: written.customizedPaths,
      managedPaths: written.managedPaths,
      messageLines: lines
    });
    return;
  }

  const finalLines = [...lines];
  if (written.created.length === 0) {
    finalLines.push('Codex bootstrap guidance is already installed or intentionally preserved.');
  } else {
    finalLines.push('Installed Codex bootstrap guidance:');
    for (const summary of written.created) {
      finalLines.push(` - ${summary.relativePath}`);
    }
  }
  process.stdout.write(`${finalLines.join('\n')}\n`);
}

export function registerAgentsCommand(program: Command): void {
  const agents = program.command('agents').description('Manage internal guidance and the opt-in customer Codex bootstrap for ztd projects');

  agents
    .command('init')
    .alias('install')
    .description('Initialize the opt-in Codex bootstrap files from the managed templates')
    .option('--dry-run', 'Emit the planned Codex bootstrap files without writing them')
    .action((options: { dryRun?: boolean }) => {
      runAgentsInit('agents init', options.dryRun === true);
    });

  agents
    .command('status')
    .description('Report managed Codex bootstrap and AGENTS guidance state and drift signals')
    .action(() => {
      const report = getAgentsStatus(process.cwd());
      if (isJsonOutput()) {
        writeCommandEnvelope('agents status', {
          schemaVersion: 1,
          targets: report.targets,
          recommended_actions: report.recommendedActions
        });
        return;
      }

      const lines = ['AGENTS status:'];
      for (const target of report.targets) {
        lines.push(
          `- ${target.path}: status=${target.status} installed=${target.installed} managed=${target.managed} installed_version=${target.installedVersion ?? 'null'} template_version=${target.templateVersion} drift=${target.drift}`
        );
      }
      lines.push(`recommended_actions: ${report.recommendedActions.length > 0 ? report.recommendedActions.join(', ') : '(none)'}`);
      process.stdout.write(`${lines.join('\n')}\n`);
    });
}
