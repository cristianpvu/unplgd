import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(16),
  ANTHROPIC_API_KEY: z.string().min(1),
  // Modelul Claude folosit la chat-uri (story create/verify). Default = sonnet.
  // Pt dev/loc poti folosi haiku (mai ieftin) prin override in .env.
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-6'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
