import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
// This suite uses native .mjs only. Playwright 1.51's optional TS ESM loader
// stalls on this Node 24 Windows runtime; disabling that test-only transformer
// leaves application code, authentication and browser security unchanged.
const result=spawnSync(process.execPath,[fileURLToPath(new URL('../node_modules/@playwright/test/cli.js',import.meta.url)),
  'test','--config','playwright.gaps.config.mjs',...process.argv.slice(2)],
  {stdio:'inherit',env:{...process.env,PW_DISABLE_TS_ESM:'1',NEXT_TELEMETRY_DISABLED:'1',TZ:'UTC'}});
if(result.error)throw result.error;
process.exit(result.status??1);
