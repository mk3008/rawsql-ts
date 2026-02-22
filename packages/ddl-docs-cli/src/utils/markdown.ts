export function escapeMarkdownText(input: string): string {
  return input
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, '<br>')
    .trim();
}

export function formatTableCell(value: string | null | undefined): string {
  if (value === null || value === undefined || value.trim().length === 0) {
    return '-';
  }
  return escapeMarkdownText(value);
}

export function formatCodeCell(value: string | null | undefined): string {
  if (value === null || value === undefined || value.trim().length === 0) {
    return '-';
  }
  const escaped = value.replace(/`/g, '\\`');
  return `\`${escaped}\``;
}
