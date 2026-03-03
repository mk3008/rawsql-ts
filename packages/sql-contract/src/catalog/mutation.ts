import type { QueryParams } from '../query-params'

type ParamRecord = Record<string, unknown>

type TokenKind =
  | 'word'
  | 'parameter'
  | 'operator'
  | 'comma'
  | 'openParen'
  | 'closeParen'
  | 'dot'
  | 'literal'
  | 'other'

type SqlToken = {
  kind: TokenKind
  value: string
  start: number
  end: number
}

type SqlStatement = {
  kind: 'update' | 'delete' | 'insert' | 'unknown'
  tokens: SqlToken[]
  statementTokenIndex: number
}

type ClauseBounds = {
  startTokenIndex: number
  endTokenIndex: number
}

type AssignmentSegment = {
  startTokenIndex: number
  endTokenIndex: number
}

type WherePolicy = {
  requireWhereClause: boolean
  requireAllNamedParams: boolean
}

type UpdateMutationConfig = {
  subtractUndefinedAssignments: boolean
  failOnEmptySet: boolean
  where: WherePolicy
}

type DeleteMutationConfig = {
  where: WherePolicy
  affectedRowsGuard:
    | { mode: 'exactly'; count: number }
    | { mode: 'none' }
}

export type MutationSafety = 'safe' | 'unsafe' | 'unknown'

export type MutationAwareRewriter = {
  mutationSafety: 'safe'
}

export type NormalizedMutationSpec =
  | {
      kind: 'insert'
    }
  | {
      kind: 'update'
      update: UpdateMutationConfig
    }
  | {
      kind: 'delete'
      delete: DeleteMutationConfig
    }

export type MutationCatalogSpec = {
  id: string
  params: {
    shape: 'positional' | 'named'
  }
  mutation?:
    | {
        kind: 'insert'
      }
    | {
        kind: 'update'
        update?: {
          subtractUndefinedAssignments?: boolean
          failOnEmptySet?: boolean
        }
        where?: {
          requireWhereClause?: boolean
          requireAllNamedParams?: boolean
        }
      }
    | {
        kind: 'delete'
        where?: {
          requireWhereClause?: boolean
          requireAllNamedParams?: boolean
        }
        delete?: {
          affectedRowsGuard?:
            | { mode: 'exactly'; count: number }
            | { mode: 'none' }
        }
      }
}

export type MutationPreprocessResult = {
  sql: string
  params: QueryParams
  mutation: NormalizedMutationSpec
}

type ContractViolationLike = new (message: string, specId?: string, cause?: unknown) => Error

const IDENTIFIER_START = /^[A-Za-z_]$/
const IDENTIFIER_PART = /^[A-Za-z0-9_$]$/

function isIdentifierStart(char: string): boolean {
  return IDENTIFIER_START.test(char)
}

function isIdentifierPart(char: string): boolean {
  return IDENTIFIER_PART.test(char)
}

function parseDollarTag(sql: string, index: number): string | null {
  if (sql[index] !== '$') {
    return null
  }

  if (sql[index + 1] === '$') {
    return '$$'
  }

  if (!isIdentifierStart(sql[index + 1] ?? '')) {
    return null
  }

  let cursor = index + 1
  while (cursor < sql.length && isIdentifierPart(sql[cursor])) {
    cursor += 1
  }

  if (sql[cursor] !== '$') {
    return null
  }

  return sql.slice(index, cursor + 1)
}

function tokenizeSql(sql: string): SqlToken[] {
  const tokens: SqlToken[] = []
  let index = 0

  while (index < sql.length) {
    const char = sql[index]
    const next = sql[index + 1]

    if (/\s/.test(char)) {
      index += 1
      continue
    }

    if (char === '-' && next === '-') {
      index += 2
      while (index < sql.length && sql[index] !== '\n') {
        index += 1
      }
      continue
    }

    if (char === '/' && next === '*') {
      index += 2
      while (index < sql.length && !(sql[index] === '*' && sql[index + 1] === '/')) {
        index += 1
      }
      index = Math.min(index + 2, sql.length)
      continue
    }

    if (char === "'") {
      const start = index
      index += 1
      while (index < sql.length) {
        if (sql[index] === "'" && sql[index + 1] === "'") {
          index += 2
          continue
        }
        if (sql[index] === "'") {
          index += 1
          break
        }
        index += 1
      }
      tokens.push({ kind: 'literal', value: sql.slice(start, index), start, end: index })
      continue
    }

    if (char === '"') {
      const start = index
      index += 1
      while (index < sql.length) {
        if (sql[index] === '"' && sql[index + 1] === '"') {
          index += 2
          continue
        }
        if (sql[index] === '"') {
          index += 1
          break
        }
        index += 1
      }
      tokens.push({ kind: 'word', value: sql.slice(start, index), start, end: index })
      continue
    }

    if (char === '[') {
      const start = index
      index += 1
      while (index < sql.length) {
        if (sql[index] === ']' && sql[index + 1] === ']') {
          index += 2
          continue
        }
        if (sql[index] === ']') {
          index += 1
          break
        }
        index += 1
      }
      tokens.push({ kind: 'word', value: sql.slice(start, index), start, end: index })
      continue
    }

    if (char === '`') {
      const start = index
      index += 1
      while (index < sql.length) {
        if (sql[index] === '`' && sql[index + 1] === '`') {
          index += 2
          continue
        }
        if (sql[index] === '`') {
          index += 1
          break
        }
        index += 1
      }
      tokens.push({ kind: 'word', value: sql.slice(start, index), start, end: index })
      continue
    }

    if (char === '$') {
      const tag = parseDollarTag(sql, index)
      if (tag) {
        const start = index
        index += tag.length
        while (index < sql.length) {
          if (sql.startsWith(tag, index)) {
            index += tag.length
            break
          }
          index += 1
        }
        tokens.push({ kind: 'literal', value: sql.slice(start, index), start, end: index })
        continue
      }
    }

    if (char === ':' && next === ':') {
      tokens.push({ kind: 'operator', value: '::', start: index, end: index + 2 })
      index += 2
      continue
    }

    if ((char === ':' || char === '@' || char === '$') && isIdentifierStart(next ?? '')) {
      const start = index
      index += 2
      while (index < sql.length && isIdentifierPart(sql[index])) {
        index += 1
      }
      tokens.push({ kind: 'parameter', value: sql.slice(start, index), start, end: index })
      continue
    }

    if (char === '$' && next === '{') {
      const start = index
      index += 2
      while (index < sql.length && sql[index] !== '}') {
        index += 1
      }
      index = Math.min(index + 1, sql.length)
      tokens.push({ kind: 'parameter', value: sql.slice(start, index), start, end: index })
      continue
    }

    if (char === '?') {
      tokens.push({ kind: 'parameter', value: '?', start: index, end: index + 1 })
      index += 1
      continue
    }

    if (isIdentifierStart(char)) {
      const start = index
      index += 1
      while (index < sql.length && isIdentifierPart(sql[index])) {
        index += 1
      }
      tokens.push({ kind: 'word', value: sql.slice(start, index), start, end: index })
      continue
    }

    if (char === ',') {
      tokens.push({ kind: 'comma', value: char, start: index, end: index + 1 })
      index += 1
      continue
    }

    if (char === '(') {
      tokens.push({ kind: 'openParen', value: char, start: index, end: index + 1 })
      index += 1
      continue
    }

    if (char === ')') {
      tokens.push({ kind: 'closeParen', value: char, start: index, end: index + 1 })
      index += 1
      continue
    }

    if (char === '.') {
      tokens.push({ kind: 'dot', value: char, start: index, end: index + 1 })
      index += 1
      continue
    }

    if (char === '=') {
      tokens.push({ kind: 'operator', value: char, start: index, end: index + 1 })
      index += 1
      continue
    }

    tokens.push({ kind: 'other', value: char, start: index, end: index + 1 })
    index += 1
  }

  return tokens
}

function lowerWord(token: SqlToken): string {
  return token.value.toLowerCase()
}

function createContractViolation(
  ContractViolationError: ContractViolationLike,
  specId: string,
  message: string
): Error {
  return new ContractViolationError(message, specId)
}

function detectStatement(tokens: SqlToken[]): SqlStatement {
  let depth = 0
  let withSeen = false

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (token.kind === 'openParen') {
      depth += 1
      continue
    }
    if (token.kind === 'closeParen') {
      depth = Math.max(depth - 1, 0)
      continue
    }
    if (token.kind !== 'word' || depth !== 0) {
      continue
    }

    const word = lowerWord(token)
    if (!withSeen && word === 'with') {
      withSeen = true
      continue
    }

    if (word === 'update' || word === 'delete' || word === 'insert') {
      return {
        kind: word,
        tokens,
        statementTokenIndex: index,
      }
    }
  }

  return {
    kind: 'unknown',
    tokens,
    statementTokenIndex: -1,
  }
}

function findClauseBounds(
  statement: SqlStatement,
  clauseName: 'set' | 'where',
  terminators: string[]
): ClauseBounds | null {
  let depth = 0
  let startTokenIndex = -1

  for (let index = statement.statementTokenIndex + 1; index < statement.tokens.length; index += 1) {
    const token = statement.tokens[index]
    if (token.kind === 'openParen') {
      depth += 1
      continue
    }
    if (token.kind === 'closeParen') {
      depth = Math.max(depth - 1, 0)
      continue
    }
    if (depth !== 0 || token.kind !== 'word') {
      continue
    }

    const word = lowerWord(token)
    if (startTokenIndex < 0) {
      if (word === clauseName) {
        startTokenIndex = index + 1
      }
      continue
    }

    if (terminators.includes(word)) {
      return {
        startTokenIndex,
        endTokenIndex: index,
      }
    }
  }

  if (startTokenIndex < 0) {
    return null
  }

  return {
    startTokenIndex,
    endTokenIndex: statement.tokens.length,
  }
}

function normalizeNamedParameter(raw: string): string | null {
  if (raw === '?') {
    return null
  }
  if (raw.startsWith('${') && raw.endsWith('}')) {
    return raw.slice(2, -1)
  }
  if (raw.startsWith(':') || raw.startsWith('@') || raw.startsWith('$')) {
    return raw.slice(1)
  }
  return null
}

function sanitizeNamedParams(params: ParamRecord): ParamRecord {
  const sanitized: ParamRecord = {}
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      sanitized[key] = value
    }
  }
  return sanitized
}

function normalizeUpdateConfig(spec: MutationCatalogSpec): UpdateMutationConfig {
  const updateConfig = spec.mutation?.kind === 'update' ? spec.mutation.update : undefined
  const whereConfig = spec.mutation?.kind === 'update' ? spec.mutation.where : undefined
  return {
    subtractUndefinedAssignments: updateConfig?.subtractUndefinedAssignments ?? true,
    failOnEmptySet: updateConfig?.failOnEmptySet ?? true,
    where: {
      requireWhereClause: whereConfig?.requireWhereClause ?? true,
      requireAllNamedParams: whereConfig?.requireAllNamedParams ?? true,
    },
  }
}

function normalizeDeleteConfig(spec: MutationCatalogSpec): DeleteMutationConfig {
  const deleteConfig = spec.mutation?.kind === 'delete' ? spec.mutation.delete : undefined
  const whereConfig = spec.mutation?.kind === 'delete' ? spec.mutation.where : undefined
  return {
    where: {
      requireWhereClause: whereConfig?.requireWhereClause ?? true,
      requireAllNamedParams: whereConfig?.requireAllNamedParams ?? true,
    },
    affectedRowsGuard: deleteConfig?.affectedRowsGuard ?? { mode: 'exactly', count: 1 },
  }
}

function assertNamedMutationParams(
  ContractViolationError: ContractViolationLike,
  spec: MutationCatalogSpec,
  params: QueryParams
): ParamRecord {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    throw createContractViolation(
      ContractViolationError,
      spec.id,
      `Spec "${spec.id}" expects named parameters.`
    )
  }
  return params
}

function collectWhereParameterNames(
  ContractViolationError: ContractViolationLike,
  spec: MutationCatalogSpec,
  tokens: SqlToken[],
  bounds: ClauseBounds | null
): string[] {
  if (!bounds) {
    return []
  }

  const names = new Set<string>()
  for (let index = bounds.startTokenIndex; index < bounds.endTokenIndex; index += 1) {
    const token = tokens[index]
    if (token.kind !== 'parameter') {
      continue
    }

    const name = normalizeNamedParameter(token.value)
    if (!name) {
      throw createContractViolation(
        ContractViolationError,
        spec.id,
        `Spec "${spec.id}" requires named parameters in WHERE clauses.`
      )
    }
    names.add(name)
  }

  return Array.from(names)
}

function assertWherePolicy(
  ContractViolationError: ContractViolationLike,
  spec: MutationCatalogSpec,
  statementKind: 'update' | 'delete',
  whereBounds: ClauseBounds | null,
  params: ParamRecord,
  requireWhereClause: boolean,
  requireAllNamedParams: boolean,
  tokens: SqlToken[]
): void {
  if (requireWhereClause && !whereBounds) {
    throw createContractViolation(
      ContractViolationError,
      spec.id,
      `${statementKind === 'update' ? 'Update' : 'Delete'} spec "${spec.id}" requires a WHERE clause.`
    )
  }

  if (!whereBounds || !requireAllNamedParams) {
    return
  }

  for (const name of collectWhereParameterNames(ContractViolationError, spec, tokens, whereBounds)) {
    if (!Object.prototype.hasOwnProperty.call(params, name) || params[name] === undefined) {
      throw createContractViolation(
        ContractViolationError,
        spec.id,
        `Spec "${spec.id}" is missing required WHERE parameter ":${name}".`
      )
    }
  }
}

function splitAssignmentSegments(tokens: SqlToken[], bounds: ClauseBounds): AssignmentSegment[] {
  const segments: AssignmentSegment[] = []
  let depth = 0
  let segmentStart = bounds.startTokenIndex

  for (let index = bounds.startTokenIndex; index < bounds.endTokenIndex; index += 1) {
    const token = tokens[index]
    if (token.kind === 'openParen') {
      depth += 1
      continue
    }
    if (token.kind === 'closeParen') {
      depth = Math.max(depth - 1, 0)
      continue
    }
    if (depth === 0 && token.kind === 'comma') {
      segments.push({
        startTokenIndex: segmentStart,
        endTokenIndex: index,
      })
      segmentStart = index + 1
    }
  }

  if (segmentStart < bounds.endTokenIndex) {
    segments.push({
      startTokenIndex: segmentStart,
      endTokenIndex: bounds.endTokenIndex,
    })
  }

  return segments
}

function isSimpleIdentifierChain(tokens: SqlToken[]): boolean {
  if (tokens.length === 0 || tokens.length % 2 === 0) {
    return false
  }

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (index % 2 === 0) {
      if (token.kind !== 'word') {
        return false
      }
      continue
    }
    if (token.kind !== 'dot') {
      return false
    }
  }

  return true
}

function isSubtractableAssignment(
  segmentSql: string,
  segmentTokens: SqlToken[]
): { name: string } | null {
  if (segmentSql.includes('/*') || segmentSql.includes('--')) {
    return null
  }

  const equalsIndex = segmentTokens.findIndex(
    (token) => token.kind === 'operator' && token.value === '='
  )
  if (equalsIndex <= 0 || equalsIndex !== segmentTokens.length - 2) {
    return null
  }

  if (!isSimpleIdentifierChain(segmentTokens.slice(0, equalsIndex))) {
    return null
  }

  const rhs = segmentTokens[segmentTokens.length - 1]
  if (rhs.kind !== 'parameter') {
    return null
  }

  const name = normalizeNamedParameter(rhs.value)
  return name ? { name } : null
}

function rewriteUpdateSetClause(
  ContractViolationError: ContractViolationLike,
  spec: MutationCatalogSpec,
  sql: string,
  tokens: SqlToken[],
  setBounds: ClauseBounds | null,
  params: ParamRecord,
  config: UpdateMutationConfig
): string {
  if (!setBounds || !config.subtractUndefinedAssignments) {
    return sql
  }

  const keptSegments: string[] = []
  for (const segment of splitAssignmentSegments(tokens, setBounds)) {
    const segmentTokens = tokens.slice(segment.startTokenIndex, segment.endTokenIndex)
    if (segmentTokens.length === 0) {
      continue
    }

    const segmentStart = segmentTokens[0].start
    const segmentEnd = segmentTokens[segmentTokens.length - 1].end
    const segmentSql = sql.slice(segmentStart, segmentEnd)
    const subtractable = isSubtractableAssignment(segmentSql, segmentTokens)

    if (
      subtractable &&
      (!Object.prototype.hasOwnProperty.call(params, subtractable.name) ||
        params[subtractable.name] === undefined)
    ) {
      continue
    }

    keptSegments.push(segmentSql.trim())
  }

  if (config.failOnEmptySet && keptSegments.length === 0) {
    throw createContractViolation(
      ContractViolationError,
      spec.id,
      `Update spec "${spec.id}" removed every SET assignment.`
    )
  }

  if (keptSegments.length === 0) {
    return sql
  }

  const setStart = tokens[setBounds.startTokenIndex].start
  const setEnd = tokens[setBounds.endTokenIndex - 1].end
  return `${sql.slice(0, setStart)}${keptSegments.join(', ')}${sql.slice(setEnd)}`
}

export function preprocessMutationSpec(
  ContractViolationError: ContractViolationLike,
  spec: MutationCatalogSpec,
  sql: string,
  params: QueryParams
): MutationPreprocessResult {
  if (!spec.mutation || spec.mutation.kind === 'insert') {
    return {
      sql,
      params,
      mutation: { kind: 'insert' },
    }
  }

  if (spec.params.shape !== 'named') {
    throw createContractViolation(
      ContractViolationError,
      spec.id,
      `Spec "${spec.id}" declares mutation processing but does not use named parameters.`
    )
  }

  const namedParams = sanitizeNamedParams(
    assertNamedMutationParams(ContractViolationError, spec, params)
  )
  const tokens = tokenizeSql(sql)
  const statement = detectStatement(tokens)

  if (spec.mutation.kind === 'update') {
    if (statement.kind !== 'update') {
      throw createContractViolation(
        ContractViolationError,
        spec.id,
        `Spec "${spec.id}" declares an update mutation but the SQL is not an UPDATE statement.`
      )
    }

    const config = normalizeUpdateConfig(spec)
    const whereBounds = findClauseBounds(statement, 'where', ['returning'])
    assertWherePolicy(
      ContractViolationError,
      spec,
      'update',
      whereBounds,
      namedParams,
      config.where.requireWhereClause,
      config.where.requireAllNamedParams,
      tokens
    )
    const setBounds = findClauseBounds(statement, 'set', ['from', 'where', 'returning'])

    return {
      sql: rewriteUpdateSetClause(
        ContractViolationError,
        spec,
        sql,
        tokens,
        setBounds,
        namedParams,
        config
      ),
      params: namedParams,
      mutation: {
        kind: 'update',
        update: config,
      },
    }
  }

  if (statement.kind !== 'delete') {
    throw createContractViolation(
      ContractViolationError,
      spec.id,
      `Spec "${spec.id}" declares a delete mutation but the SQL is not a DELETE statement.`
    )
  }

  const config = normalizeDeleteConfig(spec)
  const whereBounds = findClauseBounds(statement, 'where', ['returning'])
  assertWherePolicy(
    ContractViolationError,
    spec,
    'delete',
    whereBounds,
    namedParams,
    config.where.requireWhereClause,
    config.where.requireAllNamedParams,
    tokens
  )

  return {
    sql,
    params: namedParams,
    mutation: {
      kind: 'delete',
      delete: config,
    },
  }
}

export function isMutationSafeRewriter(rewriter: unknown): rewriter is MutationAwareRewriter {
  return (
    !!rewriter &&
    typeof rewriter === 'object' &&
    'mutationSafety' in rewriter &&
    (rewriter as { mutationSafety?: unknown }).mutationSafety === 'safe'
  )
}

export function assertMutationSafeRewriters(
  ContractViolationError: ContractViolationLike,
  spec: MutationCatalogSpec,
  rewriters: readonly unknown[]
): void {
  for (const rewriter of rewriters) {
    if (!isMutationSafeRewriter(rewriter)) {
      const name =
        rewriter && typeof rewriter === 'object' && 'name' in rewriter
          ? String((rewriter as { name?: unknown }).name ?? 'unknown')
          : 'unknown'
      throw createContractViolation(
        ContractViolationError,
        spec.id,
        `Spec "${spec.id}" uses rewriter "${name}", which is not allowed for mutation preprocessing in Phase 1.`
      )
    }
  }
}

export function assertDeleteGuard(
  ContractViolationError: ContractViolationLike,
  spec: MutationCatalogSpec,
  mutation: NormalizedMutationSpec | undefined,
  rowCount: number | undefined
): void {
  if (!mutation || mutation.kind !== 'delete') {
    return
  }

  const guard = mutation.delete.affectedRowsGuard
  if (guard.mode === 'none') {
    return
  }

  if (rowCount === undefined) {
    throw createContractViolation(
      ContractViolationError,
      spec.id,
      `Delete spec "${spec.id}" requires affected row count, but the configured executor did not expose rowCount. Disable the guard explicitly or use an executor that returns rowCount.`
    )
  }

  if (rowCount !== guard.count) {
    throw createContractViolation(
      ContractViolationError,
      spec.id,
      `Delete spec "${spec.id}" expected exactly ${guard.count} affected row${guard.count === 1 ? '' : 's'} but received ${rowCount}.`
    )
  }
}
