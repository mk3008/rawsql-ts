import path from 'node:path';

export type DefinitionLinkOptions = {
  mode?: 'path' | 'github';
  path?: {
    markdownDir: string;
    sourceRootDir: string;
  };
  github?: {
    serverUrl: string;
    repository: string;
    ref: string;
  };
};

function normalizePosixPath(input: string): string {
  return input.replace(/\\/g, '/').replace(/^\/+/, '');
}

function trimTrailingSlash(input: string): string {
  return input.endsWith('/') ? input.slice(0, -1) : input;
}

function toRelativePath(definitionPath: string, options: DefinitionLinkOptions): string {
  const normalizedPath = normalizePosixPath(definitionPath);
  if (options.mode !== 'path' || !options.path) {
    return normalizedPath;
  }

  const absoluteTarget = path.resolve(options.path.sourceRootDir, normalizedPath);
  const absoluteMarkdownDir = path.resolve(options.path.markdownDir);
  const relative = path.relative(absoluteMarkdownDir, absoluteTarget);
  return normalizePosixPath(relative || normalizedPath);
}

function toGithubBlobUrl(definitionPath: string, options: DefinitionLinkOptions): string | undefined {
  if (options.mode !== 'github' || !options.github) {
    return undefined;
  }
  const normalizedPath = normalizePosixPath(definitionPath);
  const serverUrl = trimTrailingSlash(options.github.serverUrl);
  const repository = options.github.repository.trim();
  const ref = options.github.ref.trim();
  if (!serverUrl || !repository || !ref || !normalizedPath) {
    return undefined;
  }
  const encodedPath = normalizedPath.split('/').map((part) => encodeURIComponent(part)).join('/');
  return `${serverUrl}/${repository}/blob/${encodeURIComponent(ref)}/${encodedPath}`;
}

export function formatDefinitionMarkdown(
  definitionPath: string | undefined,
  options?: DefinitionLinkOptions
): string {
  if (!definitionPath) {
    return '(unknown)';
  }
  const normalizedPath = normalizePosixPath(definitionPath);
  if (!normalizedPath) {
    return '(unknown)';
  }
  const resolvedOptions = options ?? {};
  const githubUrl = toGithubBlobUrl(normalizedPath, resolvedOptions);
  if (githubUrl) {
    return `[${normalizedPath}](${githubUrl})`;
  }
  const relativePath = toRelativePath(normalizedPath, resolvedOptions);
  return `[${normalizedPath}](${relativePath})`;
}

export function formatFileLinkMarkdown(
  definitionPath: string | undefined,
  options?: DefinitionLinkOptions
): string {
  if (!definitionPath) {
    return '(unknown)';
  }
  const normalizedPath = normalizePosixPath(definitionPath);
  if (!normalizedPath) {
    return '(unknown)';
  }
  const resolvedOptions = options ?? {};
  const githubUrl = toGithubBlobUrl(normalizedPath, resolvedOptions);
  if (githubUrl) {
    return `[File](${githubUrl})`;
  }
  const relativePath = toRelativePath(normalizedPath, resolvedOptions);
  return `[File](${relativePath})`;
}
