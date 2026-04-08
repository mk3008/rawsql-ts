export interface SmokeInput {
  left: number;
  right: number;
}

export interface SmokeOutput {
  sum: number;
}

export function addSmokeNumbers(input: SmokeInput): SmokeOutput {
  return {
    sum: input.left + input.right
  };
}
