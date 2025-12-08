import type { DbConnectionContext } from './dbConnection';

export function formatConnectionTarget(context?: DbConnectionContext): string {
  if (!context) {
    return '';
  }

  // Collect metadata that identifies the destination without exposing secrets.
  const parts = [`source=${context.source}`];
  if (context.host) {
    parts.push(`host=${context.host}`);
  }
  if (context.port) {
    parts.push(`port=${context.port}`);
  }
  if (context.database) {
    parts.push(`db=${context.database}`);
  }
  if (context.user) {
    parts.push(`user=${context.user}`);
  }

  return `target: ${parts.join(', ')}`;
}

export function describeConnectionContext(context?: DbConnectionContext): string {
  const formatted = formatConnectionTarget(context);
  return formatted ? ` (${formatted})` : '';
}
