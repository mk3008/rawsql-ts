import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ensureDirectory } from './fs';

const TEMPLATE_NAME = 'AGENTS_ZTD.md';
const TARGET_FILES = ['AGENTS.md', 'AGENTS_ZTD.md'];

export function copyAgentsTemplate(projectRoot: string): string | null {
  const templatePath = path.resolve(__dirname, '..', '..', TEMPLATE_NAME);
  if (!existsSync(templatePath)) {
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
