# Threshold

Threshold is a performance intelligence app for endurance athletes.

The app code lives in `webapp/`.

## What This Repo Contains

- `webapp/`: the Next.js application
- `README.md`: quick repo overview
- `PROJECT_CONTEXT.md`: product, business, and platform context

## Current Platform

- Frontend: Next.js
- Backend/database: Supabase
- Billing: Stripe
- Hosting: Vercel

## Local Development

1. Open PowerShell.
2. Go into the app folder:

```powershell
cd C:\Users\BAS\Desktop\UltraOS\Ultra_OS\webapp
```

3. Install packages:

```powershell
npm install
```

4. Create your local environment file:

```powershell
Copy-Item .env.local.example .env.local
```

5. Put your keys and URLs into `.env.local`.

6. Start the app:

```powershell
npm run dev
```

7. Open this in your browser:

```text
http://localhost:3000
```

## Production

- Active deployment platform: Vercel
- Main app domain: `mythreshold.co`

## Notes

- Generated files like `.next/`, `.vercel/`, dev logs, and PWA service worker build output should not be committed.
- The repo was cleaned to keep source files and active config only.
