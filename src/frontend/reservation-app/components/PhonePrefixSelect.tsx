'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { COUNTRIES, countryByIso, flagEmoji } from '@/lib/countryCodes';

type Variant = 'warm' | 'slate';

const PALETTES: Record<Variant, Record<string, string>> = {
  warm: {
    '--pps-bg': 'rgba(41,37,36,0.5)', '--pps-border': '#44403c', '--pps-accent': '#b8860b',
    '--pps-panel': '#1c1917', '--pps-panel-border': '#57534e', '--pps-text': '#e7e5e4',
    '--pps-muted': '#a8a29e', '--pps-ph': '#78716c',
    '--pps-hover': 'rgba(184,134,11,0.15)', '--pps-sel': 'rgba(184,134,11,0.25)',
  },
  slate: {
    '--pps-bg': '#0f172a', '--pps-border': '#334155', '--pps-accent': '#f59e0b',
    '--pps-panel': '#0f172a', '--pps-panel-border': '#334155', '--pps-text': '#e2e8f0',
    '--pps-muted': '#94a3b8', '--pps-ph': '#64748b',
    '--pps-hover': 'rgba(245,158,11,0.15)', '--pps-sel': 'rgba(245,158,11,0.25)',
  },
};

export default function PhonePrefixSelect({
  value,
  onChange,
  variant = 'warm',
}: {
  value: string;
  onChange: (iso: string) => void;
  variant?: Variant;
}) {
  const t = useTranslations('booking');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const current = countryByIso(value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    const qDigits = q.replace(/[^\d+]/g, '');
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.iso.toLowerCase().includes(q) ||
        (qDigits.length > 0 && c.dial.includes(qDigits)),
    );
  }, [query]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      const id = setTimeout(() => searchRef.current?.focus(), 0);
      return () => clearTimeout(id);
    }
  }, [open]);

  function pick(iso: string) {
    onChange(iso);
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className="pps-wrap" style={PALETTES[variant] as React.CSSProperties}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('phonePrefixAria')}
        className="pps-trigger"
      >
        <span className="pps-flag">{flagEmoji(current.iso)}</span>
        <span className="pps-dial">{current.dial}</span>
        <ChevronDown className="pps-chev" aria-hidden />
      </button>

      {open && (
        <div className="pps-panel">
          <div className="pps-search">
            <Search className="pps-search-ic" aria-hidden />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('phonePrefixSearch')}
              className="pps-search-inp"
              onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
            />
          </div>
          <ul className="pps-list" role="listbox" aria-label={t('phonePrefixAria')}>
            {filtered.length === 0 && <li className="pps-empty">{t('phonePrefixEmpty')}</li>}
            {filtered.map((c) => (
              <li key={c.iso}>
                <button
                  type="button"
                  role="option"
                  aria-selected={c.iso === value}
                  onClick={() => pick(c.iso)}
                  className={['pps-opt', c.iso === value ? 'pps-opt-sel' : ''].join(' ')}
                >
                  <span className="pps-flag">{flagEmoji(c.iso)}</span>
                  <span className="pps-name">{c.name}</span>
                  <span className="pps-opt-dial">{c.dial}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <style>{`
        .pps-wrap { position: relative; flex-shrink: 0; }
        .pps-trigger {
          display: inline-flex; align-items: center; gap: 0.4rem; align-self: stretch;
          min-height: 3rem; border-radius: 0.75rem;
          border: 1px solid var(--pps-border); background: var(--pps-bg);
          padding: 0 0.7rem; color: var(--pps-text); cursor: pointer;
          transition: border-color .15s, box-shadow .15s; white-space: nowrap;
        }
        .pps-trigger:focus-visible { outline: none; border-color: var(--pps-accent); box-shadow: 0 0 0 1px var(--pps-accent); }
        .pps-flag { font-size: 1.2rem; line-height: 1; }
        .pps-dial { font-variant-numeric: tabular-nums; font-size: 0.95rem; }
        .pps-chev { width: 1rem; height: 1rem; opacity: 0.55; }
        .pps-panel {
          position: absolute; z-index: 50; top: calc(100% + 0.4rem); left: 0;
          width: 18rem; max-width: 86vw; border-radius: 0.75rem;
          border: 1px solid var(--pps-panel-border); background: var(--pps-panel);
          box-shadow: 0 12px 32px rgba(0,0,0,0.5); overflow: hidden;
        }
        .pps-search { display: flex; align-items: center; gap: 0.5rem; padding: 0.55rem 0.7rem; border-bottom: 1px solid var(--pps-panel-border); }
        .pps-search-ic { width: 1rem; height: 1rem; color: var(--pps-muted); flex-shrink: 0; }
        .pps-search-inp { flex: 1; min-width: 0; background: transparent; border: 0; outline: none; color: var(--pps-text); font-size: 0.9rem; }
        .pps-search-inp::placeholder { color: var(--pps-ph); }
        .pps-list { max-height: 16rem; overflow-y: auto; margin: 0; padding: 0.25rem; list-style: none; }
        .pps-opt {
          display: flex; align-items: center; gap: 0.6rem; width: 100%;
          padding: 0.55rem 0.6rem; border-radius: 0.5rem; border: 0; background: transparent;
          color: var(--pps-text); cursor: pointer; text-align: left; font-size: 0.9rem;
        }
        .pps-opt:hover { background: var(--pps-hover); }
        .pps-opt-sel { background: var(--pps-sel); }
        .pps-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pps-opt-dial { color: var(--pps-muted); font-variant-numeric: tabular-nums; flex-shrink: 0; }
        .pps-empty { padding: 1rem; text-align: center; color: var(--pps-muted); font-size: 0.85rem; }
      `}</style>
    </div>
  );
}
