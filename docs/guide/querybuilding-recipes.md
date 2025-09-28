---
title: Formatting Recipes
outline: deep
---

# Formatting Recipes

`rawsql-ts` ships with composable formatters that understand SQL semantics. This page highlights common recipes and shows how to extend them.

## Basic Usage

```ts
import { SqlFormatter, SelectQueryParser } from 'rawsql-ts'

const sql = `SELECT id, name FROM users WHERE status = :status`
const query = SelectQueryParser.parse(sql)

const formatter = new SqlFormatter({
  indent: 2,
  uppercase: ['select', 'from', 'where']
})

const formatted = formatter.format(query)
```

## Style Configuration

The playground persists user-defined presets under `localStorage`. To recreate the same options in code, load the style JSON export and pass it into the formatter constructor.

```ts
import { SqlFormatter } from 'rawsql-ts'
import style from './my-style.json'

const formatter = new SqlFormatter(style)
```

## Handling CTEs

```ts
import { CTENormalizer, SqlFormatter } from 'rawsql-ts'

const normalized = CTENormalizer.normalize(sql)
const formatter = new SqlFormatter({ indent: 4 })
const formatted = formatter.format(normalized)
```

## IntelliSense Helpers

Combine the formatter with the IntelliSense APIs to provide contextual suggestions inside an editor.

```ts
import { getCompletionSuggestions, parseToPosition } from 'rawsql-ts'

const { query, cursor } = parseToPosition(sqlText, cursorOffset)
const completions = getCompletionSuggestions({ query, cursor })
```

Use the [Formatter Playground](/demo/index.html) to experiment with configurations and export the preset that works best for your project.

