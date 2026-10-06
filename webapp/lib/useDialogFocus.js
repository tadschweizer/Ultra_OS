import { useEffect, useRef } from 'react';

// Keep keyboard navigation inside the active workout panel and restore the
// calendar control that opened it. Callbacks live in a ref to avoid re-focusing
// the panel while the athlete types or a save refreshes its data.
export function useDialogFocus(onClose, busy = false) {
  const ref = useRef(null);
  const state = useRef({ onClose, busy });
  state.current = { onClose, busy };
  useEffect(() => {
    const previous = document.activeElement;
    const element = ref.current;
    const controls = () => [...element.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')]
      .filter((item) => item.getClientRects().length);
    controls()[0]?.focus();
    const keydown = (event) => {
      if (event.key === 'Escape' && !state.current.busy) { event.preventDefault(); state.current.onClose(); }
      if (event.key !== 'Tab') return;
      const items = controls(); const first = items[0]; const last = items.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || !element.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !element.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); if (previous?.isConnected) previous.focus(); };
  }, []);
  return ref;
}
