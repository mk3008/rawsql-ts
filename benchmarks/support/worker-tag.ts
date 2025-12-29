const WORKER_ID_SANITIZER = /[^a-zA-Z0-9_-]/g;

export function normalizeWorkerId(workerId?: string): string {
  if (!workerId || workerId.length === 0) {
    return 'single';
  }
  const normalized = workerId.replace(WORKER_ID_SANITIZER, '-');
  return normalized.length > 0 ? normalized : 'single';
}

function ensureWorkerTag(tag: string): string {
  return tag.startsWith('worker-') ? tag : `worker-${tag}`;
}

export function appendWorkerTag(baseName: string, workerId?: string): string {
  const tag = normalizeWorkerId(workerId);
  return `${baseName}-${ensureWorkerTag(tag)}`;
}
