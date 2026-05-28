/** @type {import('next').NextConfig} */
const { withSentryConfig } = require("@sentry/nextjs");

const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === 'development',
  workboxOptions: {
    disableDevLogs: true,
  },
});

const nextConfig = {
  reactStrictMode: true,
};

const { setupDevPlatform } = process.env.NODE_ENV === 'development'
  ? require('@cloudflare/next-on-pages/next-dev')
  : { setupDevPlatform: () => {} };

setupDevPlatform();

module.exports = withSentryConfig(withPWA(nextConfig), {
  silent: true,
  disableLogger: true,
  // Source map uploads require SENTRY_AUTH_TOKEN — skipped until token is configured.
  sourcemaps: {
    disable: true,
  },
  widenClientFileUpload: true,
});
