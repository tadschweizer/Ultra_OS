import { useEffect, useRef, useState } from 'react';

export default function NavMenu({ label = 'Menu', links = [], primaryLink = null }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-3">
        {primaryLink ? (
          <a
            href={primaryLink.href}
            className={`rounded-full px-5 py-2 text-sm font-semibold ${primaryLink.variant === 'secondary' ? 'border border-ink/10 bg-white/50 text-ink' : 'bg-ink text-paper'}`}
          >
            {primaryLink.label}
          </a>
        ) : null}
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-ink/10 bg-white/70 text-ink backdrop-blur"
          aria-expanded={open}
          aria-label={label}
        >
          <span className="flex flex-col gap-[4px]">
            <span className="block h-[2px] w-5 rounded bg-current" />
            <span className="block h-[2px] w-5 rounded bg-current" />
            <span className="block h-[2px] w-5 rounded bg-current" />
          </span>
        </button>
      </div>

      {open ? (
        <div className="absolute right-0 top-14 z-20 w-64 overflow-hidden rounded-[24px] border border-ink/10 bg-white p-2 shadow-[0_24px_60px_rgba(19,24,22,0.16)]">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block rounded-[18px] px-4 py-3 text-sm font-medium text-ink transition hover:bg-paper"
            >
              <span className="block">{link.label}</span>
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
