import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ensureDirectory } from './fs';

const TEMPLATE_NAME = 'AGENTS.md';
const TARGET_FILES = ['AGENTS.md', 'AGENTS_ztd.md'];

function resolveAgentsTemplatePath(): string | null {
  const candidates = [
    // Prefer the installed package layout: <pkg>/dist/utils → <pkg>/templates.
    path.resolve(__dirname, '..', '..', '..', 'templates', TEMPLATE_NAME),
    // Support legacy layouts that copied templates into dist/.
    path.resolve(__dirname, '..', '..', 'templates', TEMPLATE_NAME),
    // Support running tests directly from the monorepo source tree.
    path.resolve(process.cwd(), 'packages', 'ztd-cli', 'templates', TEMPLATE_NAME)
  ];

  // Avoid overwriting when the CLI package was installed without its template bundle.
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function copyAgentsTemplate(projectRoot: string): string | null {
  // Use the shared template bundle so generated AGENTS.md matches the distributable templates directory.
  const templatePath = resolveAgentsTemplatePath();
  if (!templatePath) {
    return null;
  }

  const contents = readFileSync(templatePath, 'utf8');

  // Try to materialize the template without overwriting any pre-existing AGENTS guidance.
  for (const fileName of TARGET_FILES) {
    const targetPath = path.join(projectRoot, fileName);
    if (existsSync(targetPath)) {
      continue;
    }

    ensureDirectory(path.dirname(targetPath));
    writeFileSync(targetPath, contents, 'utf8');
    return targetPath;
  }

  return null;
}
