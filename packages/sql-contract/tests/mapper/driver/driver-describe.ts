import { execSync } from 'node:child_process'
import { describe } from 'vitest'

const dockerRuntimeAvailable = (() => {
  try {
    // Guard against hung docker probes by timing out rather than waiting forever.
    execSync('docker info', { stdio: 'ignore', timeout: 10000 })
    return true
  } catch {
    return false
  }
})()

export const driverDescribe = dockerRuntimeAvailable ? describe : describe.skip
export const dockerEnvironmentAvailable = dockerRuntimeAvailable
