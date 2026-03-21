export interface SmokeInput {
  id: number;
  createdAt: string | Date;
}

export interface SmokeOutput {
  id: number;
  createdAt: Date;
}

export function normalizeSmokeOutput(input: SmokeInput): SmokeOutput {
  const createdAt = input.createdAt instanceof Date ? input.createdAt : new Date(input.createdAt);
  if (Number.isNaN(createdAt.getTime())) {
    throw new Error('Invalid timestamp string.');
  }

  return {
    id: input.id,
    createdAt
  };
}

