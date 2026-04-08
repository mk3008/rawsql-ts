import type { SmokeQueryBoundaryZtdCase } from '../boundary-ztd-types.js';

const cases: readonly SmokeQueryBoundaryZtdCase[] = [
  {
    name: 'selects the starter users row by id',
    beforeDb: {
      public: {
        users: [
          {
            user_id: 1,
            email: 'alice@example.com',
            display_name: 'Alice',
            is_active: true,
            created_at: '2024-01-01T00:00:00.000Z'
          }
        ]
      }
    },
    input: { user_id: 1 },
    output: { user_id: 1, email: 'alice@example.com' }
  }
];

export default cases;
