/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The `Env.create` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data types.
|
*/

import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  // Node
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),

  // App
  APP_KEY: Env.schema.secret(),
  APP_NAME: Env.schema.string.optional(),
  APP_URL: Env.schema.string.optional(),

  // Authentication
  LIBRARIAN_API_KEY: Env.schema.string(),

  // Anna's Archive
  ANNA_ARCHIVE_URL: Env.schema.string.optional(),

  // SMTP
  SMTP_HOST: Env.schema.string(),
  SMTP_PORT: Env.schema.number.optional(),
  SMTP_USER: Env.schema.string(),
  SMTP_PASSWORD: Env.schema.string(),
  SMTP_FROM: Env.schema.string(),

  // File handling
  MAX_FILE_SIZE_MB: Env.schema.number.optional(),
  TEMP_DIR: Env.schema.string.optional(),
})
