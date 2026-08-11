import { realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { McpInputError } from './inputError';

const MAX_WORKSPACE_RELATIVE_PATH_LENGTH = 1024;

/** Canonical identity and kind for one confined workspace path. */
export interface ResolvedWorkspacePath {
  absolutePath: string;
  kind: 'directory' | 'file';
  relativePath: string;
}

/** Expected filesystem kind for workspace path resolution. */
export type WorkspacePathKind = ResolvedWorkspacePath['kind'] | 'file-or-directory';

/** Resolve and canonicalize the configured MCP workspace root. */
export function normalizeWorkspaceRoot(workspace: string): string {
  if (!workspace || !path.isAbsolute(workspace)) {
    throw new McpInputError('WORKSPACE_REQUIRED', 'The workspace must be an absolute directory path.');
  }
  try {
    const resolved = realpathSync(workspace);
    if (!statSync(resolved).isDirectory()) throw new Error('not a directory');
    return resolved;
  } catch {
    throw new McpInputError('WORKSPACE_INVALID', 'The workspace must be an existing directory.');
  }
}

/**
 * Resolve one workspace-relative path without allowing lexical or realpath escape.
 * The returned absolute path is canonical, so later reads do not follow a different
 * symlink spelling than the path that passed confinement.
 */
export function resolveWorkspacePath(
  workspaceRoot: string,
  requestedPath: string,
  expectedKind: WorkspacePathKind,
): ResolvedWorkspacePath {
  const root = normalizeWorkspaceRoot(workspaceRoot);
  if (!requestedPath || requestedPath.length > MAX_WORKSPACE_RELATIVE_PATH_LENGTH || requestedPath.includes('\0')) {
    throw new McpInputError('WORKSPACE_PATH_INVALID', 'Workspace paths must be non-empty text of at most 1024 characters.');
  }
  if (path.isAbsolute(requestedPath)) {
    throw new McpInputError('WORKSPACE_PATH_ABSOLUTE', 'Workspace paths must be relative.');
  }
  const segments = requestedPath.replace(/\\/g, '/').split('/');
  if (segments.includes('..')) {
    throw new McpInputError('WORKSPACE_PATH_TRAVERSAL', 'Workspace paths must not contain parent-directory segments.');
  }

  const lexicalCandidate = path.resolve(root, requestedPath);
  let candidate: string;
  let stats: ReturnType<typeof statSync>;
  try {
    candidate = realpathSync(lexicalCandidate);
    stats = statSync(candidate);
  } catch {
    throw new McpInputError('WORKSPACE_PATH_NOT_FOUND', `Workspace path does not exist: ${requestedPath}`);
  }
  if (!isWithinWorkspace(root, candidate)) {
    throw new McpInputError('WORKSPACE_PATH_ESCAPE', `Workspace path resolves outside the configured workspace: ${requestedPath}`);
  }

  const kind = stats.isFile() ? 'file' : stats.isDirectory() ? 'directory' : undefined;
  if (!kind || (expectedKind !== 'file-or-directory' && kind !== expectedKind)) {
    throw new McpInputError('WORKSPACE_PATH_TYPE', `Workspace path is not a ${expectedKind}: ${requestedPath}`);
  }
  return {
    absolutePath: candidate,
    kind,
    relativePath: normalizePath(path.relative(root, candidate) || '.'),
  };
}

function isWithinWorkspace(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === ''
    || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`));
}

function normalizePath(value: string): string {
  return value.split(path.sep).join('/');
}
