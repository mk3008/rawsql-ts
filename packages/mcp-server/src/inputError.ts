/** A stable input-boundary error returned by MCP tools. */
export class McpInputError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'McpInputError';
    this.code = code;
  }
}
