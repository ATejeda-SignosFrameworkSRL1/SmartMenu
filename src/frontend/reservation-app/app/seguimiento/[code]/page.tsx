'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Clock, Users, Building2, CheckCircle2, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { dateLocale } from '@/i18n/config';
import { getTrack, OCCASIONS, type ReservationTrack } from '@/lib/booking-api';

function to12h(iso: string, locale: string): string {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return iso ?? '';
  const [, y, mo, d, hh, mm] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  const fecha = date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
  let h = Number(hh);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${fecha} · ${h}:${mm} ${ampm}`;
}

const STATUS_UI: Record<string, { key: string; cls: string; icon: 'ok' | 'no' | 'wait' }> = {
  Pending:   { key: 'Pending',   cls: 'bg-amber-100 text-amber-800 border-amber-200', icon: 'wait' },
  Confirmed: { key: 'Confirmed', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: 'ok' },
  Seated:    { key: 'Seated',    cls: 'bg-blue-100 text-blue-800 border-blue-200', icon: 'ok' },
  Completed: { key: 'Completed', cls: 'bg-slate-100 text-slate-700 border-slate-200', icon: 'ok' },
  Cancelled: { key: 'Cancelled', cls: 'bg-red-100 text-red-800 border-red-200', icon: 'no' },
  NoShow:    { key: 'NoShow',    cls: 'bg-red-100 text-red-800 border-red-200', icon: 'no' },
  Expired:   { key: 'Expired',   cls: 'bg-slate-100 text-slate-600 border-slate-200', icon: 'no' },
};

export default function TrackPage({ params }: { params: { code: string } }) {
  const code = decodeURIComponent(params.code);
  const t = useTranslations('tracking');
  const tb = useTranslations('booking');
  const tc = useTranslations('common');
  const to = useTranslations('occasions');
  const dl = dateLocale(useLocale());
  const [track, setTrack] = useState<ReservationTrack | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const fetchTrack = useCallback(async () => {
    try {
      const r = await getTrack(code);

      if (r) { setTrack(r); setNotFound(false); } else { setNotFound(true); }
    } catch {

    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    fetchTrack();
    const id = setInterval(fetchTrack, 10000);
    return () => clearInterval(id);
  }, [fetchTrack]);

  if (loading && !track) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </main>
    );
  }

  if (notFound || !track) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-100 px-6 py-10 text-center">
          <XCircle className="mx-auto h-12 w-12 text-slate-300" />
          <h1 className="mt-3 text-lg font-bold text-slate-900">{t('notFoundTitle')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('notFoundBody', { code })}</p>
          <Link href="/seguimiento" className="mt-5 inline-block text-sm font-semibold text-indigo-600 hover:text-indigo-700">{t('tryAnother')}</Link>
        </div>
      </main>
    );
  }

  const ui = STATUS_UI[track.status] ?? { key: '', cls: 'bg-slate-100 text-slate-700 border-slate-200', icon: 'wait' as const };
  const statusLabel = ui.key ? t(`status${ui.key}`) : track.status;
  const occasion = OCCASIONS.find((o) => o.value === track.occasionType);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-2xl bg-white shadow-xl border border-slate-100 overflow-hidden">
          <div className="bg-indigo-600 px-6 py-5 flex items-center gap-3">
            <div className="rounded-full bg-white/15 w-11 h-11 flex items-center justify-center flex-shrink-0">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-white truncate">{track.isZoneExclusive ? t('areaReservation') : t('yourReservation')}</h1>
              <p className="text-xs text-indigo-100 font-mono">{code}</p>
            </div>
          </div>

          <div className="px-6 py-6">
            <div className={`rounded-xl border px-4 py-3 flex items-center gap-2 ${ui.cls}`}>
              {ui.icon === 'ok' ? <CheckCircle2 className="h-5 w-5" /> : ui.icon === 'no' ? <XCircle className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
              <span className="font-bold">{statusLabel}</span>
            </div>

            {track.status === 'Pending' && (
              <p className="mt-3 text-sm text-slate-500 flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('waitingHost')}
              </p>
            )}

            {track.hostResponseMessage && (
              <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{t('hostMessage')}</p>
                <p className="text-sm text-slate-700">{track.hostResponseMessage}</p>
              </div>
            )}

            <div className="mt-5 space-y-2.5 text-sm">
              {track.zoneName && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Building2 className="h-4 w-4 text-slate-400" />
                  <span>{t('zoneLabel')} <b>{track.zoneName}</b>{track.isZoneExclusive ? t('zoneComplete') : ''}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-slate-600">
                <Clock className="h-4 w-4 text-slate-400" /><span>{to12h(track.reservationDateTime, dl)}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Users className="h-4 w-4 text-slate-400" /><span>{tb('persons', { count: track.numberOfGuests })}</span>
              </div>
              {occasion && occasion.value !== 0 && (
                <div className="text-slate-600">{to(occasion.key)}</div>
              )}
              {track.status === 'Confirmed' && track.assignedTableCount > 0 && (
                <div className="text-xs font-medium text-emerald-600">{t('tablesReserved', { count: track.assignedTableCount })}</div>
              )}
            </div>

            <button onClick={() => fetchTrack()} className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-600">
              <RefreshCw className="h-3.5 w-3.5" /> {t('refresh')}
            </button>
          </div>
        </div>
        <Link href="/" className="mt-4 block text-center text-sm font-medium text-slate-500 hover:text-slate-700">{tc('backHome')}</Link>
      </div>
    </main>
  );
}
