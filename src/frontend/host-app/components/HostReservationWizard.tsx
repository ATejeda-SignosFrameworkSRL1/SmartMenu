'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import {
  CalendarDays, Users, Clock, ChevronLeft, ChevronRight, CheckCircle2, Loader2,
  Phone, Mail, User as UserIcon, PartyPopper, ArrowRight, MapPin, X, UtensilsCrossed,
} from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { dateLocale } from '@/i18n/config';

// ── Tipos locales (espejo del backend de disponibilidad) ──
type SlotStatus = 'available' | 'limited' | 'full';
interface Slot { time: string; status: SlotStatus; remaining: number; isPast: boolean; }
interface ServiceWindow { label: string; start: string; end: string; }
interface Availability { date: string; guests: number; slotMinutes: number; serviceWindows: ServiceWindow[]; slots: Slot[]; }

interface TableLite { id: number; tableNumber: number; capacity: number; zoneId: number; zoneName: string; }
interface PreOrderItem { dishId: number; name: string; price: number; quantity: number; }

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function tomorrowStr(): string {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type Step = 1 | 2 | 3;

/**
 * Asistente de reserva del host — mismo flujo de 3 pasos del portal público
 * (BookingEngineWarm), pero la reserva queda asociada a la mesa pulsada y se crea
 * vía el endpoint de staff (confirmada, atribuida al host). Conserva los extras del
 * host: "Bloquear mesa (min antes)" y "Pre-ordenar platos".
 */
// Hora dominicana 12h (ej. "18:00" → "6:00 PM"). Para horas en string "HH:mm".
function to12h(t?: string | null): string {
  if (!t) return '';
  const [hs, m = '00'] = String(t).split(':');
  let h = parseInt(hs, 10);
  if (Number.isNaN(h)) return String(t);
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m.padStart(2, '0')} ${ap}`;
}

export default function HostReservationWizard({
  table, hostId, menuDishes, api, onClose, onCreated,
}: {
  table: TableLite;
  hostId: number | null;
  menuDishes: any[];
  api: any;
  onClose: () => void;
  onCreated: () => void;
}) {
  const t = useTranslations();
  const dl = dateLocale(useLocale());

  const [step, setStep] = useState<Step>(1);
  const [date, setDate] = useState(tomorrowStr());
  const [calMonth, setCalMonth] = useState<Date>(() => { const d = new Date(); d.setDate(d.getDate() + 1); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [guests, setGuests] = useState(() => Math.min(2, table.capacity));
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  // Contacto
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [occasion, setOccasion] = useState(0);
  const [notes, setNotes] = useState('');
  // Extras del host
  const [advanceBlockMinutes, setAdvanceBlockMinutes] = useState('60');
  const [showPreOrder, setShowPreOrder] = useState(false);
  const [preOrderItems, setPreOrderItems] = useState<PreOrderItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const fetchSlots = useCallback(async () => {
    setLoadingSlots(true); setSlotsError(null);
    try {
      const params = new URLSearchParams({ date, guests: String(guests) });
      if (table.zoneId) params.set('zoneId', String(table.zoneId));
      const { data } = await api.get(`/api/tablereservation/availability/slots?${params.toString()}`);
      setAvailability(data);
    } catch {
      setSlotsError(t('wizard.slotsError'));
    } finally {
      setLoadingSlots(false);
    }
  }, [date, guests, table.zoneId, api, t]);

  // Al entrar al paso 2, (re)carga la disponibilidad.
  useEffect(() => {
    if (step !== 2) return;
    const timer = setTimeout(fetchSlots, 200);
    return () => clearTimeout(timer);
  }, [step, fetchSlots]);

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

  const preOrderTotal = preOrderItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString(dl, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const OCCASIONS: { value: number; label: string }[] = [
    { value: 0, label: t('wizard.occasionNone') },
    { value: 1, label: t('wizard.occasion1') },
    { value: 2, label: t('wizard.occasion2') },
    { value: 3, label: t('wizard.occasion3') },
    { value: 4, label: t('wizard.occasion4') },
    { value: 5, label: t('wizard.occasion5') },
    { value: 99, label: t('wizard.occasion99') },
  ];

  async function submit() {
    if (!name.trim() || !phone.trim()) { toast.error(t('wizard.nameRequired')); return; }
    if (!selectedTime) { toast.error(t('wizard.timeRequired')); setStep(2); return; }
    setSubmitting(true);
    try {
      const reservationDateTime = `${date}T${selectedTime}:00`;
      await api.post('/api/tablereservation', {
        tableId: table.id,
        customerName: name.trim(),
        customerPhone: phone.trim(),
        customerEmail: email.trim() || undefined,
        numberOfGuests: guests,
        reservationDateTime,
        specialRequests: notes.trim() || undefined,
        occasionType: occasion,
        hostId: hostId ?? undefined,
        advanceBlockMinutes: parseInt(advanceBlockMinutes) || 60,
      });
      // Pre-orden opcional (igual que el modal anterior).
      if (preOrderItems.length > 0) {
        try {
          const last = (await api.get('/api/tablereservation')).data?.slice?.(-1)?.[0]?.id;
          if (last) {
            await api.post(`/api/tablereservation/${last}/preorder`, {
              notes: notes.trim() || null,
              items: preOrderItems.map((i) => ({ dishId: i.dishId, quantity: i.quantity })),
            });
          }
        } catch { /* opcional */ }
      }
      toast.success(t('wizard.reservationCreated'));
      onCreated();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || t('wizard.createError'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
      <div className="my-8 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-warm-800 bg-warm-950 shadow-2xl">
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between bg-warm-900 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gold-light">{t('wizard.reserveLabel')}</p>
            <h2 className="text-xl font-bold text-white">{t('wizard.tableTitle', { num: table.tableNumber })}</h2>
            <p className="mt-0.5 text-xs text-warm-400">{t('wizard.zoneCapacity', { zone: table.zoneName, cap: table.capacity })}</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-warm-400 transition-colors hover:bg-white/10 hover:text-white" aria-label={t('wizard.closeLabel')}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Encabezado de paso + barra de progreso */}
        <div className="flex-shrink-0 px-6 pt-5">
          <div className="flex items-center gap-3">
            {step > 1 && (
              <button onClick={() => setStep((s) => (s - 1) as Step)} className="-ml-2 rounded-lg p-2 text-warm-300 transition-colors hover:bg-warm-800" aria-label={t('wizard.back')}>
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            <div className="flex-1">
              <p className="text-xs font-bold uppercase tracking-wider text-gold-light">{t('wizard.stepOf', { step })}</p>
              <h3 className="text-lg font-bold text-white">
                {step === 1 && t('wizard.step1Title')}
                {step === 2 && t('wizard.step2Title')}
                {step === 3 && t('wizard.step3Title')}
              </h3>
            </div>
          </div>
          <div className="mb-4 mt-3 h-1.5 overflow-hidden rounded-full bg-warm-800">
            <div className="h-full bg-gold transition-all" style={{ width: `${(step / 3) * 100}%` }} />
          </div>
        </div>

        {/* Cuerpo */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
          {/* ── Paso 1: fecha (calendario abierto) + comensales + zona fija ── */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-warm-300">
                  <CalendarDays className="h-4 w-4 text-gold-light" /> {t('wizard.dateLabel')}
                </span>
                <div className="rounded-xl border border-warm-700 bg-warm-800/50 p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <button type="button" onClick={() => setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                      disabled={calMonth.getFullYear() === new Date().getFullYear() && calMonth.getMonth() <= new Date().getMonth()}
                      className="rounded-lg p-2 text-warm-300 transition-colors hover:bg-warm-800 disabled:cursor-not-allowed disabled:opacity-30" aria-label={t('calendar.prevMonth')}>
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <p className="text-base font-bold capitalize text-warm-100">{calMonth.toLocaleDateString(dl, { month: 'long', year: 'numeric' })}</p>
                    <button type="button" onClick={() => setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                      className="rounded-lg p-2 text-warm-300 transition-colors hover:bg-warm-800" aria-label={t('calendar.nextMonth')}>
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="mb-1 grid grid-cols-7">
                    {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((d, i) => (
                      <span key={i} className="py-1 text-center text-xs font-bold uppercase text-warm-500">{d}</span>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {(() => {
                      const year = calMonth.getFullYear();
                      const month = calMonth.getMonth();
                      const firstDay = new Date(year, month, 1).getDay();
                      const daysInMonth = new Date(year, month + 1, 0).getDate();
                      const today = todayStr();
                      const cells: ReactNode[] = [];
                      for (let i = 0; i < firstDay; i++) cells.push(<div key={`b${i}`} />);
                      for (let d = 1; d <= daysInMonth; d++) {
                        const cellYmd = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                        const isPast = cellYmd < today;
                        const isToday = cellYmd === today;
                        const isSelected = cellYmd === date;
                        cells.push(
                          <button key={cellYmd} type="button" disabled={isPast} onClick={() => setDate(cellYmd)}
                            className={[
                              'flex h-11 w-full items-center justify-center rounded-lg text-base transition-colors',
                              isPast ? 'cursor-not-allowed text-warm-700'
                                : isSelected ? 'bg-gold font-bold text-warm-950 shadow-sm'
                                : isToday ? 'font-bold text-gold-light ring-1 ring-gold/40'
                                : 'text-warm-200 hover:bg-warm-800',
                            ].join(' ')}>
                            {d}
                          </button>,
                        );
                      }
                      return cells;
                    })()}
                  </div>
                  <p className="mt-3 border-t border-warm-800 pt-2.5 text-center text-sm capitalize text-warm-200">{dateLabel}</p>
                </div>
              </div>

              <div>
                <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-warm-300">
                  <Users className="h-4 w-4 text-gold-light" /> {t('wizard.guestsLabel')} <span className="text-xs font-normal text-warm-500">{t('wizard.guestsMax', { max: table.capacity })}</span>
                </span>
                <div className="flex items-center justify-between rounded-xl border border-warm-700 bg-warm-800/50 p-2">
                  <button onClick={() => setGuests((g) => Math.max(1, g - 1))} disabled={guests <= 1}
                    className="h-12 w-12 rounded-lg bg-warm-800 text-2xl font-bold text-white transition-colors hover:bg-warm-700 disabled:cursor-not-allowed disabled:opacity-40" aria-label={t('wizard.lessGuests')}>−</button>
                  <span className="text-2xl font-semibold tabular-nums text-white">{guests}</span>
                  <button onClick={() => setGuests((g) => Math.min(table.capacity, g + 1))} disabled={guests >= table.capacity}
                    className="h-12 w-12 rounded-lg bg-warm-800 text-2xl font-bold text-white transition-colors hover:bg-warm-700 disabled:cursor-not-allowed disabled:opacity-40" aria-label={t('wizard.moreGuests')}>+</button>
                </div>
              </div>

              <div>
                <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-warm-300">
                  <MapPin className="h-4 w-4 text-gold-light" /> {t('wizard.zoneLabel')}
                </span>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-4 py-2 text-sm font-medium text-gold-light">
                  {table.zoneName}
                </div>
              </div>

              <button onClick={() => setStep(2)}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-gold px-8 py-4 text-lg font-semibold text-white transition hover:bg-gold-light active:scale-[0.98]">
                {t('wizard.viewSlots')} <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          )}

          {/* ── Paso 2: rejilla de horarios ── */}
          {step === 2 && (
            <div className="space-y-5">
              <p className="text-sm capitalize text-warm-400">{t('wizard.step2Subtitle', { date: dateLabel, count: guests })}</p>
              {loadingSlots && !availability && (
                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-warm-800/50" />)}
                </div>
              )}
              {slotsError && (
                <div className="py-8 text-center">
                  <p className="mb-3 text-warm-400">{slotsError}</p>
                  <button onClick={fetchSlots} className="rounded-lg bg-gold px-6 py-3 font-semibold text-white transition hover:bg-gold-light">{t('common.retry')}</button>
                </div>
              )}
              {availability && !anyBookable && !loadingSlots && (
                <div className="py-10 text-center text-warm-400">
                  <Clock className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  {t('wizard.noSlotsAvailable')}
                </div>
              )}
              {windowsWithSlots.map((w) => (
                w.slots.length > 0 && (
                  <div key={w.label}>
                    <h4 className="mb-2 text-sm font-bold uppercase tracking-wider text-gold-light">
                      {w.label} <span className="font-normal normal-case text-warm-500">({to12h(w.start)}–{to12h(w.end)})</span>
                    </h4>
                    <div className="grid grid-cols-4 gap-2">
                      {w.slots.map((s) => {
                        const disabled = s.status === 'full';
                        const sel = selectedTime === s.time;
                        return (
                          <button key={s.time} type="button" disabled={disabled}
                            onClick={() => { setSelectedTime(s.time); setStep(3); }}
                            className={[
                              'flex h-14 flex-col items-center justify-center rounded-xl border text-center transition',
                              disabled ? 'cursor-not-allowed border-warm-800 bg-warm-900/30 text-warm-600 line-through'
                                : sel ? 'border-gold bg-gold text-warm-950'
                                : s.status === 'limited' ? 'border-amber-500/40 bg-warm-800/50 text-amber-200 hover:border-gold-light'
                                : 'border-warm-700 bg-warm-800/50 text-warm-200 hover:border-gold-light hover:bg-warm-800',
                            ].join(' ')}>
                            <span className="text-base font-semibold tabular-nums">{to12h(s.time)}</span>
                            {s.status === 'limited' && !disabled && <span className="text-[10px]">{t('wizard.few')}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )
              ))}
            </div>
          )}

          {/* ── Paso 3: contacto + ocasión + notas + extras del host ── */}
          {step === 3 && (
            <div className="space-y-4">
              {selectedTime && (
                <div className="flex items-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-warm-200">
                  <Clock className="h-4 w-4 text-gold-light" />
                  <span>{t('wizard.reservationSummary', { num: table.tableNumber, time: to12h(selectedTime), count: guests })}</span>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-warm-300"><UserIcon className="h-4 w-4 text-gold-light" /> {t('wizard.nameLabel')}</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('wizard.namePlaceholder')} className="w-full rounded-xl border border-warm-700 bg-warm-800/50 px-4 py-3 text-white outline-none transition-colors focus:border-gold focus:ring-1 focus:ring-gold" />
                </label>
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-warm-300"><Phone className="h-4 w-4 text-gold-light" /> {t('wizard.phoneLabel')}</span>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="(809) 555-0000" className="w-full rounded-xl border border-warm-700 bg-warm-800/50 px-4 py-3 text-white outline-none transition-colors focus:border-gold focus:ring-1 focus:ring-gold" />
                </label>
              </div>
              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-warm-300"><Mail className="h-4 w-4 text-gold-light" /> {t('wizard.emailLabel')} <span className="text-xs font-normal text-warm-500">{t('wizard.emailOptional')}</span></span>
                <input value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" placeholder="cliente@email.com" className="w-full rounded-xl border border-warm-700 bg-warm-800/50 px-4 py-3 text-white outline-none transition-colors focus:border-gold focus:ring-1 focus:ring-gold" />
              </label>
              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-warm-300"><PartyPopper className="h-4 w-4 text-gold-light" /> {t('wizard.occasionLabel')}</span>
                <select value={occasion} onChange={(e) => setOccasion(Number(e.target.value))} className="w-full rounded-xl border border-warm-700 bg-warm-800/50 px-4 py-3 text-white outline-none transition-colors focus:border-gold focus:ring-1 focus:ring-gold">
                  {OCCASIONS.map((o) => <option key={o.value} value={o.value} className="bg-warm-900 text-white">{o.label}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-warm-300">{t('wizard.notesLabel')}</span>
                <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('wizard.notesPlaceholder')} className="w-full resize-none rounded-xl border border-warm-700 bg-warm-800/50 px-4 py-3 text-white outline-none transition-colors focus:border-gold focus:ring-1 focus:ring-gold" />
              </label>

              {/* Extra host — bloquear mesa */}
              <div>
                <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-warm-300"><Clock className="h-4 w-4 text-gold-light" /> {t('wizard.blockLabel')}</span>
                <div className="flex gap-2">
                  {['30', '45', '60', '90', '120'].map((m) => (
                    <button key={m} type="button" onClick={() => setAdvanceBlockMinutes(m)}
                      className={[
                        'flex-1 rounded-xl border py-2 text-sm font-semibold transition',
                        advanceBlockMinutes === m ? 'border-gold bg-gold text-warm-950' : 'border-warm-700 bg-warm-800/50 text-warm-300 hover:border-gold-light',
                      ].join(' ')}>
                      {m}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[10px] text-warm-500">{t('wizard.blockHint')}</p>
              </div>

              {/* Extra host — pre-ordenar platos */}
              <div className="overflow-hidden rounded-xl border border-warm-700">
                <button type="button" onClick={() => setShowPreOrder((s) => !s)} className="flex w-full items-center justify-between bg-warm-800/50 px-4 py-3 transition-colors hover:bg-warm-800">
                  <span className="flex items-center gap-2 text-sm font-semibold text-warm-200"><UtensilsCrossed className="h-4 w-4 text-gold-light" /> {t('wizard.preOrderLabel')} <span className="font-normal text-warm-500">{t('wizard.preOrderOptional')}</span></span>
                  <span className={`text-xs text-warm-400 transition-transform ${showPreOrder ? 'rotate-180' : ''}`}>▼</span>
                </button>
                {showPreOrder && (
                  <div className="space-y-3 p-4">
                    <div className="max-h-44 space-y-2 overflow-y-auto">
                      {menuDishes.filter((d: any) => d.isAvailable !== false).map((dish: any) => {
                        const id = dish.id ?? dish.Id;
                        const inCart = preOrderItems.find((i) => i.dishId === id);
                        return (
                          <div key={id} className="flex items-center justify-between py-1.5">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-warm-100">{dish.name ?? dish.Name}</p>
                              <p className="text-xs text-gold-light">RD$ {Number(dish.price ?? dish.Price).toLocaleString('es-DO')}</p>
                            </div>
                            <div className="ml-2 flex items-center gap-1.5">
                              {inCart ? (
                                <>
                                  <button type="button" onClick={() => setPreOrderItems((prev) => { const ex = prev.find((i) => i.dishId === id); if (ex && ex.quantity > 1) return prev.map((i) => i.dishId === id ? { ...i, quantity: i.quantity - 1 } : i); return prev.filter((i) => i.dishId !== id); })} className="h-7 w-7 rounded-full bg-warm-800 text-sm font-bold text-warm-200">−</button>
                                  <span className="w-4 text-center text-sm font-bold text-warm-100">{inCart.quantity}</span>
                                  <button type="button" onClick={() => setPreOrderItems((prev) => prev.map((i) => i.dishId === id ? { ...i, quantity: i.quantity + 1 } : i))} className="h-7 w-7 rounded-full bg-gold text-sm font-bold text-warm-950">+</button>
                                </>
                              ) : (
                                <button type="button" onClick={() => setPreOrderItems((prev) => [...prev, { dishId: id, name: dish.name ?? dish.Name, price: Number(dish.price ?? dish.Price), quantity: 1 }])} className="rounded-lg border border-gold/40 bg-gold/10 px-2.5 py-1 text-xs font-semibold text-gold-light transition hover:bg-gold/20">+</button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {preOrderItems.length > 0 && (
                      <div className="rounded-xl border border-gold/30 bg-gold/10 p-3">
                        {preOrderItems.map((i) => (
                          <div key={i.dishId} className="flex justify-between text-xs text-warm-300"><span>{i.quantity}x {i.name}</span><span className="font-medium text-gold-light">RD$ {(i.price * i.quantity).toLocaleString('es-DO')}</span></div>
                        ))}
                        <div className="mt-1 flex justify-between border-t border-gold/30 pt-1 text-sm font-bold text-warm-100"><span>{t('wizard.preOrderTotal')}</span><span className="text-gold-light">RD$ {preOrderTotal.toLocaleString('es-DO')}</span></div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button onClick={submit} disabled={submitting}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-gold px-8 py-4 text-lg font-semibold text-white transition hover:bg-gold-light active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60">
                {submitting ? <><Loader2 className="h-5 w-5 animate-spin" /> {t('wizard.creating')}</> : <><CheckCircle2 className="h-5 w-5" /> {t('wizard.createButton')}</>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
