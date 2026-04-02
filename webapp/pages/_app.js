import '../styles/globals.css';
import { IBM_Plex_Mono } from 'next/font/google';
import Head from 'next/head';
import { useRouter } from 'next/router';
import AppShell from '../components/AppShell';
import OnboardingGate from '../components/OnboardingGate';

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
});

/**
 * Top-level custom App component.
 *
 * We simply import the global stylesheet and pass through the
 * component props. All other state management happens in the
 * individual pages or API routes.
 */
export default function MyApp({ Component, pageProps }) {
  const router = useRouter();
  const pageTitleMap = {
    '/': 'Threshold',
    '/dashboard': 'Dashboard',
    '/log-intervention': 'Log Intervention',
    '/history': 'Intervention History',
    '/insights': 'Insights',
    '/explorer': 'Explorer',
    '/connections': 'Connections',
    '/coaches': 'Coaches',
    '/content': 'Research',
    '/guide': 'Guide',
    '/pricing': 'Pricing',
    '/account': 'Account Settings',
    '/settings': 'Athlete Settings',
    '/notifications': 'Notifications',
    '/onboarding': 'Onboarding',
    '/join': 'Join Threshold',
    '/invite': 'Invite Athletes',
    '/admin': 'Admin',
  };
  const pageName = pageTitleMap[router.pathname] || 'Threshold';
  const title = pageName === 'Threshold' ? 'Threshold' : `${pageName} — Threshold`;

  return (
    <div className={mono.variable}>
      <Head>
        <title>{title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#EAE4DA" />
        <meta name="description" content="Performance intelligence for athletes who go long." />
        <meta property="og:title" content={title} />
        <meta property="og:description" content="Performance intelligence for athletes who go long." />
        <meta property="og:image" content="/og-image.svg" />
        <meta property="og:type" content="website" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Threshold" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </Head>
      <OnboardingGate>
        <AppShell>
          <div className="ui-page">
            <Component {...pageProps} />
          </div>
        </AppShell>
      </OnboardingGate>
    </div>
  );
}
