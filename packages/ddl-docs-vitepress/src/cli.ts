import path from 'node:path';
import fs from 'node:fs';

const TEMPLATE_GITIGNORE = 'gitignore';
const TARGET_GITIGNORE = '.gitignore';
const CLEAN_PREVIEW_LIMIT = 5;

interface TemplateLayout {
  files: string[];
  directories: string[];
}

interface ExistingEntry {
  relativePath: string;
  isDirectory: boolean;
}

export async function runCli(argv: string[]): Promise<void> {
  const [command, ...rest] = argv;

  if (!command || command === '--help' || command === '-h') {
    printGlobalHelp();
    return;
  }

  if (command === 'help') {
    const target = rest[0];
    if (target === 'init') {
      printInitHelp();
      return;
    }
    if (target) {
      throw new Error(`Unknown command for help: ${target}`);
    }
    printGlobalHelp();
    return;
  }

  if (command === 'init') {
    await runInit(rest);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

async function runInit(args: string[]): Promise<void> {
  let targetDir = '.';
  let force = false;
  let clean = false;
  let targetProvided = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') {
      printInitHelp();
      return;
    }
    if (arg === '--force') {
      force = true;
      continue;
    }
    if (arg === '--clean') {
      clean = true;
      continue;
    }
    if (!arg.startsWith('--')) {
      if (targetProvided) {
        throw new Error(`Only one target directory is allowed. Received extra argument: ${arg}`);
      }
      targetDir = arg;
      targetProvided = true;
      continue;
    }
    throw new Error(`Unknown option for init: ${arg}`);
  }

  if (clean && !force) {
    throw new Error('Option --clean requires --force. Use: init <targetDir> --force --clean');
  }

  const resolvedTarget = path.resolve(targetDir);
  const templatesDir = path.join(__dirname, '..', 'templates');

  if (!fs.existsSync(templatesDir)) {
    throw new Error(`Templates directory not found: ${templatesDir}`);
  }
  const layout = collectTemplateLayout(templatesDir);

  if (fs.existsSync(resolvedTarget)) {
    if (!fs.statSync(resolvedTarget).isDirectory()) {
      throw new Error(`Target path is not a directory: ${resolvedTarget}`);
    }

    // Protect existing projects from accidental overwrite unless --force is explicit.
    const existingEntries = fs.readdirSync(resolvedTarget);
    if (existingEntries.length > 0 && !force) {
      throw new Error(
        `Target directory is not empty: ${resolvedTarget}. Use --force to overwrite existing files.`,
      );
    }
  } else {
    fs.mkdirSync(resolvedTarget, { recursive: true });
  }

  const existingEntries = fs.readdirSync(resolvedTarget);
  let deleted = 0;
  if (clean && existingEntries.length > 0) {
    const removedPaths = pruneNonTemplatePaths(resolvedTarget, layout);
    deleted = removedPaths.length;
  }

  const { created, overwritten } = applyTemplate(resolvedTarget, templatesDir, layout);

  console.log(`Scaffold created at: ${resolvedTarget}`);
  console.log(`Summary: created=${created}, overwritten=${overwritten}, deleted=${deleted}`);
  console.log('');
  console.log('Next steps:');
  console.log(`  cd ${targetDir}`);
  console.log('  npm install');
  console.log('  # Add your .sql files to ddl/');
  console.log('  npm run dev');
}

function printGlobalHelp(): void {
  console.log(`ddl-docs-vitepress <command> [options]

Commands:
  init [targetDir]   Scaffold a new DDL docs VitePress project (default: current directory)
  help [command]     Show global help or command help

Options:
  --help, -h         Show this help message

Init options:
  --force            Overwrite template output paths in a non-empty directory (no deletion)
  --clean            Delete non-template files before scaffolding (requires --force)

Examples:
  ddl-docs-vitepress init my-db-docs
  ddl-docs-vitepress init existing-dir --force
  ddl-docs-vitepress init existing-dir --force --clean
  ddl-docs-vitepress help init
`);
}

function printInitHelp(): void {
  console.log(`ddl-docs-vitepress init [targetDir] [options]

Options:
  --force            Overwrite template output paths in a non-empty directory (does not delete other files)
  --clean            Delete non-template files before scaffolding (requires --force)
  --help, -h         Show init help

Examples:
  ddl-docs-vitepress init docs-site
  ddl-docs-vitepress init docs-site --force
  ddl-docs-vitepress init docs-site --force --clean
`);
}

function collectTemplateLayout(templatesDir: string): TemplateLayout {
  const files: string[] = [];
  const directories = new Set<string>();

  walkTemplateTree(templatesDir, '', files, directories);

  const mappedFiles = files.map(mapTemplateRelativePath);
  const mappedDirectories = Array.from(directories).map(mapTemplateRelativePath);

  // Include parent directories for mapped files such as ".gitignore".
  for (const filePath of mappedFiles) {
    let current = path.dirname(filePath);
    while (current && current !== '.') {
      mappedDirectories.push(current);
      current = path.dirname(current);
    }
  }

  return {
    files: mappedFiles,
    directories: Array.from(new Set(mappedDirectories)),
  };
}

function walkTemplateTree(
  rootDir: string,
  currentRelative: string,
  files: string[],
  directories: Set<string>,
): void {
  const currentDir = currentRelative ? path.join(rootDir, currentRelative) : rootDir;
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const relativePath = currentRelative ? path.join(currentRelative, entry.name) : entry.name;
    if (entry.isDirectory()) {
      directories.add(relativePath);
      walkTemplateTree(rootDir, relativePath, files, directories);
      continue;
    }
    files.push(relativePath);
  }
}

function mapTemplateRelativePath(relativePath: string): string {
  if (relativePath === TEMPLATE_GITIGNORE) {
    return TARGET_GITIGNORE;
  }
  return relativePath;
}

function collectTargetEntries(targetDir: string): ExistingEntry[] {
  const entries: ExistingEntry[] = [];
  walkTargetTree(targetDir, '', entries);
  return entries;
}

function walkTargetTree(rootDir: string, currentRelative: string, entries: ExistingEntry[]): void {
  const currentDir = currentRelative ? path.join(rootDir, currentRelative) : rootDir;
  const currentEntries = fs.readdirSync(currentDir, { withFileTypes: true });

  for (const entry of currentEntries) {
    const relativePath = currentRelative ? path.join(currentRelative, entry.name) : entry.name;
    if (entry.isDirectory()) {
      entries.push({ relativePath, isDirectory: true });
      walkTargetTree(rootDir, relativePath, entries);
      continue;
    }
    entries.push({ relativePath, isDirectory: false });
  }
}

function pruneNonTemplatePaths(targetDir: string, layout: TemplateLayout): string[] {
  const expectedPaths = new Set<string>([...layout.files, ...layout.directories]);
  const existingEntries = collectTargetEntries(targetDir);
  const pathsToDelete = existingEntries
    .filter((entry) => shouldDeleteEntry(entry, expectedPaths))
    .sort((left, right) => getPathDepth(right.relativePath) - getPathDepth(left.relativePath))
    .map((entry) => entry.relativePath);

  console.log(`Clean mode: removing ${pathsToDelete.length} non-template path(s) from ${targetDir}`);
  for (const relativePath of pathsToDelete.slice(0, CLEAN_PREVIEW_LIMIT)) {
    console.log(`  - ${relativePath}`);
  }
  if (pathsToDelete.length > CLEAN_PREVIEW_LIMIT) {
    console.log(`  ... and ${pathsToDelete.length - CLEAN_PREVIEW_LIMIT} more`);
  }

  for (const relativePath of pathsToDelete) {
    fs.rmSync(path.join(targetDir, relativePath), { recursive: true, force: true });
  }

  return pathsToDelete;
}

function shouldDeleteEntry(entry: ExistingEntry, expectedPaths: Set<string>): boolean {
  if (expectedPaths.has(entry.relativePath)) {
    return false;
  }

  // Keep parent directories when expected descendants exist under them.
  if (entry.isDirectory) {
    const directoryPrefix = `${entry.relativePath}${path.sep}`;
    for (const expectedPath of expectedPaths) {
      if (expectedPath.startsWith(directoryPrefix)) {
        return false;
      }
    }
  }

  return true;
}

function getPathDepth(relativePath: string): number {
  return relativePath.split(path.sep).length;
}

function applyTemplate(
  targetDir: string,
  templatesDir: string,
  layout: TemplateLayout,
): { created: number; overwritten: number } {
  let created = 0;
  let overwritten = 0;
  const sortedDirectories = [...layout.directories].sort((left, right) => left.length - right.length);

  for (const directory of sortedDirectories) {
    const targetDirectory = path.join(targetDir, directory);
    fs.mkdirSync(targetDirectory, { recursive: true });
  }

  for (const relativePath of layout.files) {
    const templateRelativePath = relativePath === TARGET_GITIGNORE ? TEMPLATE_GITIGNORE : relativePath;
    const sourcePath = path.join(templatesDir, templateRelativePath);
    const targetPath = path.join(targetDir, relativePath);

    if (fs.existsSync(targetPath)) {
      overwritten += 1;
    } else {
      created += 1;
    }
    fs.copyFileSync(sourcePath, targetPath);
  }

  return { created, overwritten };
}
