import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'DB Schema Docs',
  description: 'Database schema documentation generated from DDL',
  srcDir: '.',
  themeConfig: {
    search: { provider: 'local' },
    aside: false,
  },
})
