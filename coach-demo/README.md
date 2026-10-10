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

READY immutable preview: https://ultra-os-tb77-r0amr2xjc-tadschweizers-projects.vercel.app. Draft PR: https://github.com/tadschweizer/Ultra_OS/pull/134. Runtime source is `edccc86a83b2c2e21cbad13f78ca0f3330ec3e5e`; later evidence/tooling changes do not change that artifact. See `preview-identity.json` and `../DEMO_VERIFICATION.md`. Local and hosted browser suites each pass 15/15; independent acceptance remains pending.
