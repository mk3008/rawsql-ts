export const smokeSpec = {
  id: 'features.smoke.persistence.smoke',
  sqlFile: 'src/features/smoke/persistence/smoke.sql',
  params: {
    shape: 'named',
    example: {
      v1: 2,
      v2: 3
    }
  },
  output: {
    validate: (value: unknown) => Number(value),
    example: 5
  }
} as const;

