import '../styles/globals.css';

/**
 * Top-level custom App component.
 *
 * We simply import the global stylesheet and pass through the
 * component props. All other state management happens in the
 * individual pages or API routes.
 */
export default function MyApp({ Component, pageProps }) {
  return <Component {...pageProps} />;
}
