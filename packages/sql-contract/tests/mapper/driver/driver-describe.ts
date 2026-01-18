import { execSync } from 'node:child_process'
import { describe } from 'vitest'

const dockerRuntimeAvailable = (() => {
  try {
    execSync('docker info', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
})()

export const driverDescribe = dockerRuntimeAvailable ? describe : describe.skip
export const dockerEnvironmentAvailable = dockerRuntimeAvailable
