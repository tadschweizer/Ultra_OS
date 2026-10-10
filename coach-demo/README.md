# Threshold synthetic demo v3

Built from authoritative online main `fa8ebe2b377784007b4a40b4e982f92a11224075`. Imports actual current calendar/editor/detail/discussion and messages/draft components and pure reconciliation helpers from `../webapp`; the production transport remains the default. No production auth routes, protected API handlers, provider clients or server seeder are bundled.

Run in this directory:

```powershell
npm ci
npm run build
npx vite preview --host 127.0.0.1 --port 4173
```

Open `http://127.0.0.1:4173/`. Production preview is preferable to `npm run dev` because the strict `connect-src 'none'` policy intentionally prevents Vite's hot-reload connection. No secrets or service configuration are needed.

```powershell
npm test
npm run test:browser
```

The browser suite uses this machine's existing Chromium by default. Set `DEMO_CHROME` to another installed Chromium executable if necessary. Set `DEMO_BASE_URL` to test the immutable hosted preview instead of starting a local server. Tests use isolated browser contexts and synthetic data only. Desktop, 390px and 320px loop tests assert zero API/provider requests and capture screenshots. See `../DEMO_PARITY_MATRIX.md` for mappings and honest exclusions.

The sample date is fixed at October 9, 2026. Each tab uses `sessionStorage['threshold-synthetic-v3']`; refresh persists its changes. This is a single-tab participant simulation, not shared multi-user delivery. A separate browser session begins with the deterministic seed. Reset requires confirmation, clears local state and restores the seed. Email, payment, signup, integrations and provider sync are unavailable.

Try: select Robin Vale as coach; create a structured run and next workout; switch to athlete and log partial actuals/RPE/context; switch back to coach, review feedback/check-in, send a message and reduce the next plan; switch to athlete, see updates and reply; reload; reset. Demo boundaries includes a one-shot save failure for testing retained answers and retry.

Existing public Sites identity is preserved in `site-hosting.json`; this revision's validation preview is separate. Do not overwrite that public Site before independent QA acceptance. Neither merging nor production deployment is authorized.

Draft PR: https://github.com/tadschweizer/Ultra_OS/pull/134. See `preview-identity.json` and `../DEMO_VERIFICATION.md` for the current immutable preview and tests. The first `edccc86` preview remains available but was rejected by independent QA on three findings; historical evidence is in `evidence/preview-edccc86.json` and `../docs/demo-evidence/edccc86`. Repairs and retest instructions are in `../DEMO_QA_FIXES.md`. Independent acceptance remains pending.

Corrected READY preview: https://ultra-os-tb77-9vifc1i44-tadschweizers-projects.vercel.app. Runtime source: `683a5ebf42a6e86e56b62544f7b79d303a71aeda`. Adapter 15/15 and local/hosted browser suites 18/18 pass; independent exact-build retest remains pending. Production library metadata storage is intentionally unchanged; preserving the full library prescription is a demo adapter capability.
