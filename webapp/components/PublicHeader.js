import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import NavMenu from './NavMenu';
import { useMe } from '../lib/meClient';

export const publicLinks = [
  { href: '/guide', label: 'How it works' },
  { href: '/content', label: 'Research' },
  { href: '/pricing', label: 'Access & pricing' },
];

export default function PublicHeader({ primaryLink }) {
  const router = useRouter();
  const me = useMe();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);
  const action = primaryLink || (hydrated && me?.athlete?.id
    ? { href: me.account?.default_path || '/dashboard', label: 'Open Threshold' }
    : { href: '/login', label: 'Log in' });

  return <header className="px-4 pt-4">
    <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-2xl border border-ink/10 bg-white px-4 py-3">
      <a href="/" aria-label="Threshold home" className="inline-flex min-h-11 items-center text-sm font-semibold tracking-[0.16em] text-ink">THRESHOLD</a>
      <nav aria-label="Public navigation" className="hidden items-center gap-6 lg:flex">
        {publicLinks.map(link => <a key={link.href} href={link.href}
          aria-current={router.pathname === link.href ? 'page' : undefined}
          className="inline-flex min-h-11 items-center text-sm font-semibold text-ink hover:underline">{link.label}</a>)}
        <a href={action.href} className="ui-button-primary min-h-11">{action.label}</a>
      </nav>
      <NavMenu label="Public navigation" links={publicLinks} primaryLink={action} />
    </div>
  </header>;
}
