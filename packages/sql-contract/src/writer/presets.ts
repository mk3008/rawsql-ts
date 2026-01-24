import type { ParamValue, WriterStatementResult, PlaceholderStyle } from './index'
import type { QueryParams } from '../query-params'

/** Indicates how writer parameters are emitted at runtime. */
export type WriterParamsShape = 'array' | 'object'

/** Tracks placeholders and their accumulated values for a single statement. */
export interface WriterPlaceholderBinder {
  readonly params: QueryParams
  bind(value: ParamValue, column: string): string
}

/** Defines how placeholders and parameter accumulation behave for a writer instance. */
export interface WriterPreset {
  readonly placeholderStyle: PlaceholderStyle
  readonly paramsShape: WriterParamsShape
  createBinder(): WriterPlaceholderBinder
  finalize?(result: WriterStatementResult): WriterStatementResult
}

type NamedWriterPresetOptions = {
  formatPlaceholder?: (paramName: string) => string
}

const sanitizeColumn = (column: string) =>
  column
    .replace(/[^A-Za-z0-9_]/g, '_')
    .replace(/__+/g, '_')
    .replace(/^_+|_+$/g, '') || 'param'

const createNumberedBinder = (format: (index: number) => string) => {
  let index = 0
  const params: ParamValue[] = []
  return {
    params,
    bind(value: ParamValue, _column: string) {
      index += 1
      params.push(value)
      return format(index)
    },
  }
}

export const writerPresets = {
  indexed(): WriterPreset {
    return {
      placeholderStyle: 'indexed',
      paramsShape: 'array',
      createBinder: () => createNumberedBinder((index) => `$${index}`),
    }
  },
  anonymous(): WriterPreset {
    return {
      placeholderStyle: 'question',
      paramsShape: 'array',
      createBinder: () => {
        const params: ParamValue[] = []
        return {
          params,
          bind(value: ParamValue) {
            params.push(value)
            return '?'
          },
        }
      },
    }
  },
  named(options?: NamedWriterPresetOptions): WriterPreset {
    const formatPlaceholder = options?.formatPlaceholder ?? ((paramName: string) => paramName)

    return {
      placeholderStyle: 'named',
      paramsShape: 'object',
      createBinder: () => {
        let counter = 0
        const params: Record<string, ParamValue> = {}
        return {
          params,
          bind(value: ParamValue, column: string) {
            counter += 1
            const sanitized = sanitizeColumn(column)
            const paramName = `${sanitized}_${counter}`
            params[paramName] = value
            return formatPlaceholder(paramName)
          },
        }
      },
    }
  },
}
