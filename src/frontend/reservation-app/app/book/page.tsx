'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { useTranslations, useLocale } from 'next-intl';
import { dateLocale } from '@/i18n/config';
import {
  CalendarDays, Users, Clock, ChevronLeft, CheckCircle2, Loader2,
  Phone, Mail, User as UserIcon, PartyPopper, ArrowRight,
} from 'lucide-react';
import {
  getSlots, holdSlot, confirmPublic, OCCASIONS,
  type Availability, type Slot, type BookingResult,
} from '@/lib/booking-api';
import { composePhone, DEFAULT_COUNTRY_ISO } from '@/lib/countryCodes';
import PhonePrefixSelect from '@/components/PhonePrefixSelect';

type Step = 1 | 2 | 3 | 4;

// Hora dominicana 12h (ej. "18:00" → "6:00 PM").
function to12h(t?: string | null): string {
  if (!t) return '';
  const [hs, m = '00'] = String(t).split(':');
  let h = parseInt(hs, 10);
  if (Number.isNaN(h)) return String(t);
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m.padStart(2, '0')} ${ap}`;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function tomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function BookPage() {
  const t = useTranslations('booking');
  const to = useTranslations('occasions');
  const dl = dateLocale(useLocale());
  const [step, setStep] = useState<Step>(1);
  const [date, setDate] = useState(tomorrowStr());
  const [guests, setGuests] = useState(2);

  const [availability, setAvailability] = useState<Availability | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [hold, setHold] = useState<BookingResult | null>(null);
  const [holding, setHolding] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [countryIso, setCountryIso] = useState(DEFAULT_COUNTRY_ISO);   // prefijo telefónico internacional
  const [email, setEmail] = useState('');
  const [occasion, setOccasion] = useState(0);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [result, setResult] = useState<BookingResult | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  // Guarda de hidratación: la fecha inicial (tomorrowStr) se calcula con
  // `new Date()` y la ruta está prerenderizada; renderizar solo tras montar
  // evita el mismatch SSR/cliente (React #418/#423/#425).
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // ─── Fetch de slots (con debounce) ───
  const fetchSlots = useCallback(async () => {
    setLoadingSlots(true);
    setSlotsError(null);
    try {
      const data = await getSlots(date, guests);
      setAvailability(data);
    } catch {
      setSlotsError(t('toastLoadFailed'));
    } finally {
      setLoadingSlots(false);
    }
  }, [date, guests, t]);

  useEffect(() => {
    if (step !== 2) return;
    const tm = setTimeout(fetchSlots, 250);
    return () => clearTimeout(tm);
  }, [step, fetchSlots]);

  // ─── Polling de disponibilidad mientras se ve la rejilla (grey-out en vivo) ───
  useEffect(() => {
    if (step !== 2) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') fetchSlots();
    }, 15000);
    return () => clearInterval(id);
  }, [step, fetchSlots]);

  // ─── Cuenta regresiva del hold ───
  useEffect(() => {
    if (!hold?.holdExpiresAt) { setSecondsLeft(null); return; }
    const expiry = new Date(hold.holdExpiresAt).getTime();
    const tick = () => {
      const s = Math.round((expiry - Date.now()) / 1000);
      setSecondsLeft(s);
      if (s <= 0 && step === 3) {
        toast.error(t('toastHoldExpired'));
        setHold(null);
        setSelectedTime(null);
        setStep(2);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [hold, step, t]);

  const windowsWithSlots = useMemo(() => {
    if (!availability) return [];
    return availability.serviceWindows.map((w) => ({
      ...w,
      slots: availability.slots.filter((s) => s.time >= w.start && s.time < w.end),
    }));
  }, [availability]);

  const anyBookable = useMemo(
    () => (availability?.slots ?? []).some((s) => s.status !== 'full'),
    [availability],
  );

  async function pickSlot(slot: Slot) {
    if (slot.status === 'full' || holding) return;
    setHolding(true);
    setSelectedTime(slot.time);
    try {
      const h = await holdSlot(date, slot.time, guests);
      setHold(h);
      setStep(3);
    } catch (e) {
      const err = e as Error & { code?: string };
      toast.error(err.message || t('toastSlotTaken'));
      setSelectedTime(null);
      fetchSlots();
    } finally {
      setHolding(false);
    }
  }

  async function submit() {
    if (!hold) return;
    if (!name.trim() || !phone.trim()) {
      toast.error(t('toastNamePhone'));
      return;
    }
    setSubmitting(true);
    try {
      const r = await confirmPublic(hold.reservationId, {
        confirmationCode: hold.confirmationCode,
        customerName: name.trim(),
        customerPhone: composePhone(countryIso, phone),
        customerEmail: email.trim() || undefined,
        occasionType: occasion,
        specialRequests: notes.trim() || undefined,
      });
      setResult(r);
      setStep(4);
    } catch (e) {
      const err = e as Error & { code?: string };
      if (err.code === 'EXPIRED') {
        toast.error(t('toastHoldExpired'));
        setHold(null); setSelectedTime(null); setStep(2);
      } else {
        toast.error(err.message || t('toastConfirmFailed'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setStep(1); setSelectedTime(null); setHold(null); setResult(null);
    setName(''); setPhone(''); setCountryIso(DEFAULT_COUNTRY_ISO); setEmail(''); setOccasion(0); setNotes('');
  }

  const mmss = secondsLeft != null && secondsLeft > 0
    ? `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`
    : '0:00';

  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Toaster position="top-center" />
      {/* Header */}
      <header className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800">
        <div className="mx-auto max-w-lg px-4 py-3 flex items-center gap-3">
          {step > 1 && step < 4 && (
            <button
              onClick={() => setStep((s) => (s - 1) as Step)}
              className="p-2 -ml-2 rounded-lg hover:bg-slate-800"
              aria-label={t('back')}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-lg font-semibold leading-tight">{t('bookTitle')}</h1>
            <p className="text-xs text-amber-400/80">{t('stepOf', { current: step, total: 4 })}</p>
          </div>
        </div>
        <div className="h-1 bg-slate-800">
          <div className="h-full bg-amber-500 transition-all" style={{ width: `${(step / 4) * 100}%` }} />
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6 pb-28">
        {/* Paso 1 — fecha + party */}
        {step === 1 && (
          <section className="space-y-6">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium mb-2">
                <CalendarDays className="w-4 h-4 text-amber-400" /> {t('dateLabel')}
              </label>
              <input
                type="date"
                min={todayStr()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-14 rounded-xl bg-slate-900 border border-slate-700 px-4 text-lg focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium mb-2">
                <Users className="w-4 h-4 text-amber-400" /> {t('guestsLabel')}
              </label>
              <div className="flex items-center justify-between rounded-xl bg-slate-900 border border-slate-700 p-2">
                <button
                  onClick={() => setGuests((g) => Math.max(1, g - 1))}
                  className="h-12 w-12 rounded-lg bg-slate-800 text-2xl font-bold disabled:opacity-40"
                  disabled={guests <= 1}
                  aria-label={t('lessGuests')}
                >−</button>
                <span className="text-2xl font-semibold tabular-nums">{guests}</span>
                <button
                  onClick={() => setGuests((g) => Math.min(20, g + 1))}
                  className="h-12 w-12 rounded-lg bg-slate-800 text-2xl font-bold disabled:opacity-40"
                  disabled={guests >= 20}
                  aria-label={t('moreGuests')}
                >+</button>
              </div>
            </div>
          </section>
        )}

        {/* Paso 2 — slots */}
        {step === 2 && (
          <section className="space-y-5">
            <p className="text-sm text-slate-400">
              {new Date(date + 'T00:00:00').toLocaleDateString(dl, { weekday: 'long', day: 'numeric', month: 'long' })} · {t('persons', { count: guests })}
            </p>
            {loadingSlots && !availability && (
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="h-14 rounded-xl bg-slate-900 animate-pulse" />
                ))}
              </div>
            )}
            {slotsError && (
              <div className="text-center py-8">
                <p className="text-slate-400 mb-3">{slotsError}</p>
                <button onClick={fetchSlots} className="px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-semibold">{t('retry')}</button>
              </div>
            )}
            {availability && !anyBookable && !loadingSlots && (
              <div className="text-center py-10 text-slate-400">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                {t('noSlots')}
              </div>
            )}
            {windowsWithSlots.map((w) => (
              w.slots.length > 0 && (
                <div key={w.label}>
                  <h2 className="text-sm font-semibold text-amber-400 mb-2">{w.label} <span className="text-slate-500 font-normal">({to12h(w.start)}–{to12h(w.end)})</span></h2>
                  <div role="radiogroup" className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {w.slots.map((s) => {
                      const disabled = s.status === 'full';
                      const sel = selectedTime === s.time;
                      return (
                        <button
                          key={s.time}
                          role="radio"
                          aria-checked={sel}
                          disabled={disabled || holding}
                          onClick={() => pickSlot(s)}
                          className={[
                            'h-14 rounded-xl border text-center transition flex flex-col items-center justify-center',
                            disabled
                              ? 'border-slate-800 bg-slate-900/40 text-slate-600 line-through cursor-not-allowed'
                              : sel
                                ? 'border-amber-500 bg-amber-500 text-slate-950'
                                : s.status === 'limited'
                                  ? 'border-amber-700/60 bg-slate-900 text-amber-200'
                                  : 'border-slate-700 bg-slate-900 hover:border-amber-500',
                          ].join(' ')}
                        >
                          <span className="text-base font-semibold tabular-nums">{to12h(s.time)}</span>
                          {s.status === 'limited' && !disabled && <span className="text-[10px]">{t('few')}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )
            ))}
          </section>
        )}

        {/* Paso 3 — contacto */}
        {step === 3 && (
          <section className="space-y-4">
            {selectedTime && (
              <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-3 text-sm">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>{t('tableHeldForShort', { time: to12h(selectedTime) })} · {t('personsShort', { count: guests })}</span>
                {secondsLeft != null && <span className="ml-auto font-mono text-amber-400">{mmss}</span>}
              </div>
            )}
            <Field icon={<UserIcon className="w-4 h-4" />} label={t('nameLabelShort')} required>
              <input value={name} onChange={(e) => setName(e.target.value)} className="inp" placeholder={t('namePh')} />
            </Field>
            <Field icon={<Phone className="w-4 h-4" />} label={t('phoneLabel')} required>
              <div className="flex gap-2">
                <PhonePrefixSelect value={countryIso} onChange={setCountryIso} variant="slate" />
                <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className="inp flex-1 min-w-0" placeholder={t('phonePhAlt')} />
              </div>
            </Field>
            <Field icon={<Mail className="w-4 h-4" />} label={t('emailLabel')}>
              <input value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" className="inp" placeholder={t('emailPh')} />
            </Field>
            <Field icon={<PartyPopper className="w-4 h-4" />} label={t('occasionLabel')}>
              <select value={occasion} onChange={(e) => setOccasion(Number(e.target.value))} className="inp">
                {OCCASIONS.map((o) => <option key={o.value} value={o.value}>{to(o.key)}</option>)}
              </select>
            </Field>
            <Field label={t('notesLabel')}>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="inp" placeholder={t('notesPh')} />
            </Field>
            <style>{`.inp{width:100%;height:3rem;border-radius:0.75rem;background:#0f172a;border:1px solid #334155;padding:0 0.9rem;color:#e2e8f0}.inp:focus{outline:none;border-color:#f59e0b}textarea.inp{height:auto;padding:0.6rem 0.9rem}`}</style>
          </section>
        )}

        {/* Paso 4 — confirmación */}
        {step === 4 && result && (
          <section className="text-center py-8 space-y-4">
            <CheckCircle2 className="w-16 h-16 mx-auto text-emerald-400" />
            <h2 className="text-2xl font-bold">{result.status === 'Confirmed' ? t('confirmedTitle') : t('receivedTitle')}</h2>
            <p className="text-slate-400">
              {result.status === 'Confirmed'
                ? t('weWaitYou', { date: new Date(date + 'T00:00:00').toLocaleDateString(dl, { day: 'numeric', month: 'long' }), time: to12h(selectedTime) })
                : t('youRequested', { date: new Date(date + 'T00:00:00').toLocaleDateString(dl, { day: 'numeric', month: 'long' }), time: to12h(selectedTime) })}
              {result.status !== 'Confirmed' && t('needsApproval')}
            </p>
            <div className="inline-block rounded-xl bg-slate-900 border border-slate-700 px-6 py-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide">{t('confirmationCode')}</p>
              <p className="text-2xl font-mono font-bold text-amber-400">{result.confirmationCode}</p>
            </div>
            <p className="text-sm text-slate-400">{t('persons', { count: guests })} · {t('statusLabel')} {result.status === 'Confirmed' ? t('statusConfirmed') : t('statusPending')}</p>
            <button onClick={reset} className="mt-4 px-5 py-3 rounded-xl bg-slate-800 font-semibold">{t('anotherBooking')}</button>
          </section>
        )}
      </main>

      {/* CTA fijo */}
      {step < 4 && (
        <div className="fixed bottom-0 inset-x-0 bg-slate-900/95 backdrop-blur border-t border-slate-800 p-4" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
          <div className="mx-auto max-w-lg">
            {step === 1 && (
              <button onClick={() => setStep(2)} className="w-full h-14 rounded-xl bg-amber-500 text-slate-950 font-bold text-lg flex items-center justify-center gap-2">
                {t('seeSlotsShort')} <ArrowRight className="w-5 h-5" />
              </button>
            )}
            {step === 2 && (
              <p className="text-center text-sm text-slate-400 flex items-center justify-center gap-2">
                {holding ? (<><Loader2 className="w-4 h-4 animate-spin" /> {t('reserving')}</>) : t('pickSlotHint')}
              </p>
            )}
            {step === 3 && (
              <button onClick={submit} disabled={submitting} className="w-full h-14 rounded-xl bg-amber-500 text-slate-950 font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-60">
                {submitting ? <><Loader2 className="w-5 h-5 animate-spin" /> {t('confirming')}</> : t('submitTable')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ icon, label, required, children }: { icon?: ReactNode; label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className="flex items-center gap-2 text-sm font-medium mb-1.5">
        {icon && <span className="text-amber-400">{icon}</span>}{label}{required && <span className="text-rose-400">*</span>}
      </span>
      {children}
    </label>
  );
}
