/** @type {import('next').NextConfig} */
const { withSentryConfig } = require("@sentry/nextjs");
const { securityHeaders } = require('./lib/securityHeaders.cjs');

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
  poweredByHeader: false,
  async headers() { return [{ source: '/:path*', headers: securityHeaders }]; },
  reactStrictMode: true,
  // Keep the development badge from covering the first mobile navigation tab.
  ...(process.env.PLAYWRIGHT_TEST === '1' ? { devIndicators: false } : {}),
};

const { setupDevPlatform } = process.env.NODE_ENV === 'development'
  ? require('@cloudflare/next-on-pages/next-dev')
  : { setupDevPlatform: () => {} };

setupDevPlatform();

module.exports = withSentryConfig(withPWA(nextConfig), {
  silent: true,
  disableLogger: true,
  widenClientFileUpload: true,
});
