import type { PreviewJson } from '@rawsql-ts/test-evidence-core'

type DecimalTrimmedScenario = {
  caseId: string
  caseTitle: string
  input: string
  expectedOutput: number
}

export const decimalTrimmedScenario: DecimalTrimmedScenario = {
  caseId: 'decimal-trimmed',
  caseTitle: 'accepts trimmed decimal string',
  input: '  33.5  ',
  expectedOutput: 33.5,
}

export const bigintTrimmedScenario = {
  id: 'bigint-trimmed',
  title: 'accepts trimmed bigint string',
  input: '  123456789012345678901234567890  ',
  expectedOutput: 123456789012345678901234567890n,
} as const

export function createCoercionCatalogPreviewJson(args: {
  decimalOutput?: number
  includeBigIntCase: boolean
}): PreviewJson {
  return {
    schemaVersion: 1,
    sqlCaseCatalogs: [],
    testCaseCatalogs: [
      {
        id: 'sql-contract-zod.coercions',
        title: 'coercion helper parity',
        definitionPath: 'packages/sql-contract-zod/tests/coercions.test.ts',
        cases: [
          {
            id: decimalTrimmedScenario.caseId,
            title: decimalTrimmedScenario.caseTitle,
            input: decimalTrimmedScenario.input,
            output: args.decimalOutput ?? decimalTrimmedScenario.expectedOutput,
          },
          ...(args.includeBigIntCase
            ? [
                {
                  id: bigintTrimmedScenario.id,
                  title: bigintTrimmedScenario.title,
                  input: bigintTrimmedScenario.input,
                  output: `${bigintTrimmedScenario.expectedOutput.toString()}n`,
                },
              ]
            : []),
        ],
      },
    ],
  }
}
