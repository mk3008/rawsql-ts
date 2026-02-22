/**
 * Escapes markdown-sensitive characters for table cells and normalizes line breaks.
 */
export function escapeMarkdownText(input: string): string {
  return input
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, '<br>')
    .trim();
}

/**
 * Formats nullable plain-text values for markdown table cells.
 */
export function formatTableCell(value: string | null | undefined): string {
  if (value === null || value === undefined || value.trim().length === 0) {
    return '-';
  }
  return escapeMarkdownText(value);
}

/**
 * Formats nullable values as inline code for markdown table cells.
 */
export function formatCodeCell(value: string | null | undefined): string {
  if (value === null || value === undefined || value.trim().length === 0) {
    return '-';
  }
  const escaped = value.replace(/`/g, '\\`');
  return `\`${escaped}\``;
}
