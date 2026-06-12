import { defineConfig } from 'vitepress'
import type { DefaultTheme } from 'vitepress'
import typedocSidebar from '../api/typedoc-sidebar.json' with { type: 'json' }

const apiSidebar = typedocSidebar as DefaultTheme.SidebarItem[]
const apiSidebarWithIndex: DefaultTheme.SidebarItem[] = [
  { text: 'API Overview', link: '/api/index' },
  ...apiSidebar
]

export default defineConfig({
  title: 'rawsql-ts',
  description: 'High-performance SQL parser and formatter for TypeScript.',
  lang: 'en-US',
  base: '/rawsql-ts/',
  cleanUrls: true,
  lastUpdated: true,
  appearance: true,
  srcDir: '.',
  markdown: {
    config(md) {
      const defaultFence = md.renderer.rules.fence
      md.renderer.rules.fence = (tokens, idx, options, env, self) => {
        const token = tokens[idx]
        const info = token.info.trim().split(/\s+/)[0]
        if (info === 'mermaid') {
          return `<pre v-pre class="mermaid">${normalizeMermaid(token.content)}</pre>`
        }
        return defaultFence(tokens, idx, options, env, self)
      }
    }
  },
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/overview' },
      { text: 'API', link: '/api/index' },
      { text: 'Transfer Docs', link: '/transfer-docs' },
      { text: 'Playground', link: '/cud-demo/index.html', target: '_blank', rel: 'noopener' },
      { text: 'Migration Demo', link: '/migration-demo/index.html', target: '_blank', rel: 'noopener' }
    ],
    sidebar: {
      '/guide/': [
        { text: 'Overview', link: '/guide/overview' },
        { text: 'Getting Started', link: '/guide/getting-started' },
        { text: 'What Is RFBA?', link: '/guide/rfba-overview' },
        { text: 'What Is a Concept Spec?', link: '/guide/concept-spec-overview' },
        {
          text: 'Execution',
          items: [
            { text: 'Execution Scope', link: '/guide/execution-scope' },
          ]
        },
        { text: 'Formatting Recipes', link: '/guide/formatting-recipes' },
        { text: 'Querybuilding Recipes', link: '/guide/querybuilding-recipes' },
        {
          text: 'Query Uses',
          items: [
            { text: 'Overview', link: '/guide/query-uses-overview' },
            { text: 'Impact Checks', link: '/guide/query-uses-impact-checks' },
          ]
        },
        { text: 'Testkit Concept', link: '/guide/testkit-concept' },
        { text: 'ZTD Benchmarking', link: '/guide/ztd-benchmarking' },
        { text: 'SQLite Testkit How-To', link: '/guide/sqlite-testkit-howto' },
        {
          text: 'Conversion Guides',
          items: [
            { text: 'Conversion Philosophy', link: '/guide/conversion-philosophy' },
            { text: 'SELECT -> INSERT', link: '/guide/insert-conversion' },
            { text: 'SELECT -> UPDATE', link: '/guide/update-conversion' },
            { text: 'SELECT -> DELETE', link: '/guide/delete-conversion' },
            { text: 'SELECT -> CREATE TABLE', link: '/guide/create-table-conversion' },
            { text: 'SELECT -> MERGE', link: '/guide/merge-conversion' },
          ]
        },

        {
          text: 'Result-to-SELECT Guides',
          items: [
            { text: 'Select-Centered Philosophy', link: '/guide/select-centered-philosophy' },
            { text: 'SELECT -> SELECT(table-independent)', link: '/guide/select-to-select' },
            { text: 'INSERT -> SELECT', link: '/guide/insert-result-select' },
            { text: 'UPDATE -> SELECT', link: '/guide/update-result-select' },
            { text: 'DELETE -> SELECT', link: '/guide/delete-result-select' },
            { text: 'MERGE -> SELECT', link: '/guide/merge-result-select' },
          ]
        },
      ],
      '/api/': apiSidebarWithIndex
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/mk3008/rawsql-ts' }
    ],
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright (c) 2023-2025 msugiura'
    },
    editLink: {
      pattern: 'https://github.com/mk3008/rawsql-ts/edit/main/docs/:path',
      text: 'Edit this page on GitHub'
    },
    search: {
      provider: 'local'
    }
  }
})

function normalizeMermaid(value: string): string {
  return value
    .replace(/\{\{\s*"([^"]+)"\s*\}\}/g, (_, label) => `{{${normalizeMermaidLabel(label)}}}`)
    .replace(/\[\/\s*"([^"]+)"\s*"?\/\]/g, (_, label) => `[/${normalizeMermaidLabel(label)}/]`)
    .replace(/\|\s*"([^"]+)"\s*\|/g, (_, label) => `|${normalizeMermaidLabel(label)}|`)
    .replace(/\|\s*([^|\n]+)\s*\|/g, (_, label) => `|${normalizeMermaidLabel(label)}|`)
    .replace(/([-.=]+)\s+"([^"]+)"\s+([-.=]+>)/g, (_, left, label, right) => `${left} ${normalizeMermaidLabel(label)} ${right}`)
}

function normalizeMermaidLabel(value: string): string {
  return value.replace(/[<>\-]/g, ' ').replace(/\s+/g, ' ').trim()
}
