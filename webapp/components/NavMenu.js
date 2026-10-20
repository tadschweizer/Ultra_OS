import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/router';
import { useMe } from '../lib/meClient';
import { getMobileTabs, getSidebarSections } from '../lib/siteNavigation';


export default function NavMenu({ primaryLink = null, links = [], label = 'Navigation' }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dialogRef = useRef(null);
  const triggerRef = useRef(null);
  const titleId = useId();
  const router = useRouter();
  const me = useMe();
  const account = me?.account || null;
  const isAdmin = Boolean(account?.capabilities?.administrator);
  const coachFirst = account?.primary_role === 'coach' && account?.capabilities?.coach;
  const bottomNavHrefs = new Set(account ? getMobileTabs(account).map(item => item.href) : []);
  const sections = account
    ? getSidebarSections(account)
    : [{ title: 'Explore', items: links.length ? links : [
        { href: '/', label: 'Home' },
        { href: '/guide', label: 'How it works' },
        { href: '/content', label: 'Research' },
        { href: '/pricing', label: 'Access & pricing' },
      ] }];
  const action = account
    ? { href: coachFirst ? '/coach-command-center' : '/log-intervention', label: coachFirst ? 'Open Coach Roster' : 'Log intervention' }
    : { href: '/signup?role=coach', label: 'Create a coach pilot account' };

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { setOpen(false); }, [router.asPath]);

  // Native modal dialogs provide focus containment and make the page behind
  // the sheet inert. Never simulate a modal with only a visual backdrop.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!mounted || !dialog) return;
    if (!open) {
      if (dialog.open) dialog.close();
      return;
    }
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    const desktop = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => { if (desktop.matches) setOpen(false); };
    desktop.addEventListener('change', closeOnDesktop);
    closeOnDesktop();
    return () => {
      desktop.removeEventListener('change', closeOnDesktop);
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
      if (triggerRef.current?.isConnected) triggerRef.current.focus();
    };
  }, [open, mounted]);

  function keepTabInMenu(event) {
    if (event.key !== 'Tab') return;
    const items = [...dialogRef.current.querySelectorAll('a[href], button:not(:disabled), [tabindex="0"]')]
      .filter(element => element.getClientRects().length > 0);
    const first = items[0];
    const last = items[items.length - 1];
    if ((event.shiftKey && document.activeElement === first)
      || (!event.shiftKey && document.activeElement === last)) {
      event.preventDefault();
      (event.shiftKey ? last : first)?.focus();
    }
  }

  return <div className="lg:hidden">
    <div className="flex items-center gap-3">
      {primaryLink && <a href={primaryLink.href} className="ui-button-secondary min-h-11">{primaryLink.label}</a>}
      <button ref={triggerRef} type="button" onClick={() => setOpen(true)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-ink/20 bg-white text-ink"
        aria-expanded={open} aria-haspopup="dialog" aria-controls={titleId + '-dialog'} aria-label="Open menu">
        <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
          <path d="M3 5h14M3 10h14M3 15h14" />
        </svg>
      </button>
    </div>
    {mounted && createPortal(
      <dialog ref={dialogRef} id={titleId + '-dialog'} aria-labelledby={titleId}
        className="threshold-nav-dialog"
        onKeyDown={keepTabInMenu}
        onCancel={event => { event.preventDefault(); setOpen(false); }}
        onClose={() => setOpen(false)}
        onClick={event => { if (event.target === event.currentTarget) setOpen(false); }}>
        <div className="flex max-h-[calc(100dvh-2rem)] flex-col p-5">
          <div className="mb-3 flex shrink-0 items-center justify-between gap-4">
            <h2 id={titleId} className="text-xl font-semibold">{account ? 'More' : label}</h2>
            <button type="button" autoFocus onClick={() => setOpen(false)} aria-label="Close menu"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-ink/20">
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg>
            </button>
          </div>
          <div className="min-h-0 overflow-y-auto overscroll-contain">
            {isAdmin && <a className="mb-4 flex min-h-11 items-center font-semibold text-ink underline"
              href={router.pathname === '/admin' ? '/dashboard' : '/admin'} onClick={() => setOpen(false)}>
              {router.pathname === '/admin' ? 'Athlete view' : 'Admin panel'}
            </a>}
            <nav aria-label={label}>
              {sections.map(section => <div key={section.title} className="mb-4">
                {account && <h3 className="mb-2 text-sm font-semibold text-ink/75">{section.title}</h3>}
                <ul className="divide-y divide-ink/10">
                  {section.items.filter(item => !bottomNavHrefs.has(item.href)).map(item => <li key={item.href}>
                    <a href={item.href} onClick={() => setOpen(false)}
                      aria-current={router.pathname === item.href ? 'page' : undefined}
                      className="flex min-h-11 flex-col justify-center py-3 text-ink hover:underline">
                      <span className="font-semibold">{item.label}</span>
                      {item.description && <span className="mt-1 text-sm text-ink/75">{item.description}</span>}
                    </a>
                  </li>)}
                </ul>
              </div>)}
            </nav>
            <a href={action.href} onClick={() => setOpen(false)} className="ui-button-primary mt-2 w-full min-h-11">{action.label}</a>
            {!account && <div className="mt-3 flex flex-wrap gap-x-5">
              <a href="/signup" onClick={() => setOpen(false)} className="inline-flex min-h-11 items-center font-semibold text-ink underline">Join as an athlete</a>
              <a href={primaryLink?.href?.startsWith('/login') ? primaryLink.href : '/login'} onClick={() => setOpen(false)} className="inline-flex min-h-11 items-center font-semibold text-ink underline">Log in</a>
            </div>}
          </div>
        </div>
      </dialog>, document.body)}
  </div>;
}
