import { Command } from 'commander';
import { getAgentsStatus, getVisibleAgentsInstallPaths, installVisibleAgents } from '../utils/agents';
import { isJsonOutput, writeCommandEnvelope } from '../utils/agentCli';

export function registerAgentsCommand(program: Command): void {
  const agents = program.command('agents').description('Manage internal and visible AGENTS guidance for ztd projects');

  agents
    .command('install')
    .description('Install visible AGENTS.md files from the managed templates')
    .action(() => {
      const plannedPaths = getVisibleAgentsInstallPaths(process.cwd());
      const lines = ['About to create:'];
      if (plannedPaths.length === 0) {
        lines.push(' - (none)');
      } else {
        for (const targetPath of plannedPaths) {
          lines.push(` - ${targetPath}`);
        }
      }
      lines.push('No files will be overwritten.');
      lines.push('Omit `ztd agents install` if you do not want visible AGENTS files.');

      const written = installVisibleAgents(process.cwd());
      if (isJsonOutput()) {
        writeCommandEnvelope('agents install', {
          schemaVersion: 1,
          plannedPaths,
          createdPaths: written.map((summary) => summary.relativePath),
          messageLines: lines
        });
        return;
      }

      const finalLines = [...lines];
      if (written.length === 0) {
        finalLines.push('Visible AGENTS guidance is already installed or intentionally preserved.');
      } else {
        finalLines.push('Installed visible AGENTS guidance:');
        for (const summary of written) {
          finalLines.push(` - ${summary.relativePath}`);
        }
      }
      process.stdout.write(`${finalLines.join('\n')}\n`);
    });

  agents
    .command('status')
    .description('Report managed AGENTS guidance state and drift signals')
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
          `- ${target.path}: installed=${target.installed} managed=${target.managed} installed_version=${target.installedVersion ?? 'null'} template_version=${target.templateVersion} drift=${target.drift}`
        );
      }
      lines.push(`recommended_actions: ${report.recommendedActions.length > 0 ? report.recommendedActions.join(', ') : '(none)'}`);
      process.stdout.write(`${lines.join('\n')}\n`);
    });
}
