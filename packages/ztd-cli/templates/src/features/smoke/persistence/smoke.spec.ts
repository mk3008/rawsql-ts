export const smokeSpec = {
  id: 'features.smoke.persistence.smoke',
  sqlFile: 'src/features/smoke/persistence/smoke.sql',
  params: {
    shape: 'named',
    example: {
      id: null,
      createdAt: null
    }
  },
  output: {
    mapping: {
      prefix: 'smoke',
      columnMap: {
        id: 'id',
        createdAt: 'created_at'
      }
    }
  }
} as const;

