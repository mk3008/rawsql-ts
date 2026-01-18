import path from 'node:path';
import { defineConfig, env } from 'prisma/config';

type Env = {
  DATABASE_URL: string;
};

export default defineConfig({
  schema: path.join('tests', 'prisma-app', 'schema.prisma'),
  datasource: {
    url: env<Env>('DATABASE_URL'),
  },
});
