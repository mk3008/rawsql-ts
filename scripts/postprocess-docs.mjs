import { promises as fs } from 'fs'
import path from 'path'

async function main() {
  const root = process.cwd()
  const apiDir = path.join(root, 'docs', 'api')

  await ensureIndexFrontMatter(apiDir)
  await wrapMarkdownWithVPre(apiDir)
}

async function ensureIndexFrontMatter(apiDir) {
  const indexPath = path.join(apiDir, 'README.md')
  const targetPath = path.join(apiDir, 'index.md')

  let source = indexPath
  try {
    await fs.access(indexPath)
  } catch {
    source = targetPath
  }

  try {
    await fs.access(source)
  } catch {
    console.warn('[postprocess-docs] index markdown not found, skipping front matter injection')
    return
  }

  if (source === indexPath) {
    await fs.rename(indexPath, targetPath)
  }

  const content = await fs.readFile(targetPath, 'utf8')
  if (!content.startsWith('---')) {
    const frontMatter = ['---', 'title: API Overview', 'outline: deep', '---', ''].join('\n')
    await fs.writeFile(targetPath, frontMatter + content, 'utf8')
    console.log('[postprocess-docs] Injected front matter into api/index.md')
  }
}

async function wrapMarkdownWithVPre(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      await wrapMarkdownWithVPre(fullPath)
      continue
    }
    if (!entry.name.endsWith('.md')) {
      continue
    }

    const original = await fs.readFile(fullPath, 'utf8')
    let frontMatter = ''
    let body = original

    if (original.startsWith('---')) {
      const end = original.indexOf('\n---', 3)
      if (end !== -1) {
        frontMatter = original.slice(0, end + 4).trimEnd()
        body = original.slice(end + 4).replace(/^\s+/, '')
      }
    }

    const genericLineRE = /^(\s*[-*>+]?\s*)([^`\n<>]*?\b[A-Za-z0-9_$]+<[^>\n]+>[^`\n]*)$/gm
    body = body.replace(genericLineRE, (match, prefix, content) => {
      const trimmed = content.trim()
      if (trimmed.startsWith('`') && trimmed.endsWith('`')) {
        return match
      }
      return `${prefix}\`${trimmed}\``
    })

    body = body.replace(/(?<=\b[A-Za-z0-9_$])<([^>\n]+)>/g, (_match, inner) => `&lt;${inner}&gt;`)
    body = body.replace(/\\<([^>\n]+)>/g, (_match, inner) => `&lt;${inner}&gt;`)

    const trimmedBody = body.trimStart()
    const hasWrapper = trimmedBody.startsWith('<div v-pre>') && trimmedBody.includes('</div>')

    if (hasWrapper) {
      const output = frontMatter ? `${frontMatter}\n\n${trimmedBody}\n` : `${trimmedBody}\n`
      await fs.writeFile(fullPath, output, 'utf8')
      continue
    }

    const wrappedBody = `<div v-pre>\n${body.trim()}\n</div>\n`
    const output = frontMatter ? `${frontMatter}\n\n${wrappedBody}` : wrappedBody
    await fs.writeFile(fullPath, output, 'utf8')
    console.log(`[postprocess-docs] Wrapped ${path.relative(dir, fullPath)} with <div v-pre> block`)
  }
}

main().catch((error) => {
  console.error('[postprocess-docs] Failed with error:', error)
  process.exitCode = 1
})
