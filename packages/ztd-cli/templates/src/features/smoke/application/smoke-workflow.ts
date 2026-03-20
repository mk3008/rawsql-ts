import { normalizeSmokeOutput, type SmokeInput, type SmokeOutput } from '../domain/smoke-policy.js';

export interface SmokeWorkflowResult {
  feature: 'smoke';
  output: SmokeOutput;
}

export function buildSmokeWorkflow(input: SmokeInput): SmokeWorkflowResult {
  return {
    feature: 'smoke',
    output: normalizeSmokeOutput(input)
  };
}
