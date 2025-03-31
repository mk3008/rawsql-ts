/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
    test: {
        environment: 'node',
        include: ['tests/**/*.test.[jt]s'],
        exclude: ['dist/**'],
        root: resolve(__dirname),
        testTimeout: 3000,
    },
})