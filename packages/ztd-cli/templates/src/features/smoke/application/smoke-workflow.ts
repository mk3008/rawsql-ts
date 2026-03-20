import { normalizeSmokeOutput, type SmokeInput, type SmokeOutput } from '../domain/smoke-policy.js';
import { smokeSpec } from '../persistence/smoke.spec.js';

export interface SmokeWorkflowResult {
  feature: 'smoke';
  specFile: string;
  output: SmokeOutput;
}

export function buildSmokeWorkflow(input: SmokeInput): SmokeWorkflowResult {
  return {
    feature: 'smoke',
    specFile: smokeSpec.sqlFile,
    output: normalizeSmokeOutput(input)
  };
}

