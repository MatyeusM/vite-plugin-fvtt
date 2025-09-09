import dotenv from 'dotenv'
import path from 'path'
import { ENVOptions } from 'src/context'

export default function loadEnv(): ENVOptions {
  const envPath = path.resolve(process.cwd(), '.env.foundryvtt.local')
  const { parsed } = dotenv.config({ path: envPath, quiet: true })

  return {
    foundryUrl: parsed?.FOUNDRY_URL ?? 'localhost',
    foundryPort: parseInt(parsed?.FOUNDRY_PORT ?? '30000', 10),
  }
}
