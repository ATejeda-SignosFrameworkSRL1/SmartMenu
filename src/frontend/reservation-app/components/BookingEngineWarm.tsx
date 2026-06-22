'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import {
  CalendarDays, Users, Clock, ChevronLeft, ChevronRight, CheckCircle2, Loader2,
  Phone, Mail, User as UserIcon, PartyPopper, ArrowRight, MapPin, Building2,
} from 'lucide-react';
import {
  getSlots, holdSlot, confirmPublic, createZoneRequest, getZones, OCCASIONS,
  type Availability, type Slot, type BookingResult, type ZoneOption,
} from '@/lib/booking-api';

type Step = 1 | 2 | 3 | 4;
function tomorrowStr(): string {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Motor de reservas con capacidad dinámica por intervalo, adaptado al tema warm/gold del landing.
 * Flujo: fecha+party → grid de slots en vivo → contacto → confirmación con código.
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

// Mínimo FIJO de comensales para reservar un área completa. El host confirma la capacidad
// real de cada zona contactando al cliente; el usuario puede subir desde este piso.
const AREA_MIN_GUESTS = 7;

// Horas para el modo "Área completa" (no hay grid de slots; el host aprueba). 12:00–22:00 cada 30 min.
const AREA_TIMES: string[] = (() => {
  const out: string[] = [];
  for (let h = 12; h <= 22; h++) { out.push(`${String(h).padStart(2, '0')}:00`); if (h < 22) out.push(`${String(h).padStart(2, '0')}:30`); }
  return out;
})();

export default function BookingEngineWarm({ forceMode }: { forceMode?: 'mesa' | 'area' } = {}) {
  const [step, setStep] = useState<Step>(1);
  const [mode, setMode] = useState<'mesa' | 'area'>(forceMode ?? 'mesa');   // 'area' = reservar zona completa (exclusiva)
  const [areaTime, setAreaTime] = useState('19:00');           // hora elegida en modo área (no hay grid de slots)
  const [date, setDate] = useState(tomorrowStr());
  const [calMonth, setCalMonth] = useState<Date>(() => { const t = new Date(); t.setDate(t.getDate() + 1); return new Date(t.getFullYear(), t.getMonth(), 1); });
  const [guests, setGuests] = useState(forceMode === 'area' ? AREA_MIN_GUESTS : 2);
  const [zoneId, setZoneId] = useState<number | null>(null);
  const [zones, setZones] = useState<ZoneOption[]>([]);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [hold, setHold] = useState<BookingResult | null>(null);
  const [holding, setHolding] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [occasion, setOccasion] = useState(0);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BookingResult | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  // Cargar zonas Dining una sola vez al montar; el cliente puede filtrar slots por zona.
  useEffect(() => {
    (async () => { setZones(await getZones()); })();
  }, []);

  // Mínimo FIJO de comensales para "Área completa" (el host confirma la capacidad real por zona).
  const minGuests = mode === 'area' ? AREA_MIN_GUESTS : 1;

  // Al entrar en modo área, asegura que los comensales arranquen en el mínimo.
  useEffect(() => {
    if (mode === 'area') setGuests((g) => Math.max(g, AREA_MIN_GUESTS));
  }, [mode]);

  const fetchSlots = useCallback(async () => {
    setLoadingSlots(true); setSlotsError(null);
    try { setAvailability(await getSlots(date, guests, zoneId)); }
    catch { setSlotsError('No pudimos cargar la disponibilidad. Reintenta.'); }
    finally { setLoadingSlots(false); }
  }, [date, guests, zoneId]);

  useEffect(() => {
    if (step !== 2) return;
    const t = setTimeout(fetchSlots, 250);
    return () => clearTimeout(t);
  }, [step, fetchSlots]);

  // Polling cada 15s mientras el grid está visible — grey-out en vivo si otro cliente toma el slot.
  useEffect(() => {
    if (step !== 2) return;
    const id = setInterval(() => { if (document.visibilityState === 'visible') fetchSlots(); }, 15000);
    return () => clearInterval(id);
  }, [step, fetchSlots]);

  // Cuenta regresiva del hold; si expira en paso 3, regresa a slots.
  useEffect(() => {
    if (!hold?.holdExpiresAt) { setSecondsLeft(null); return; }
    const expiry = new Date(hold.holdExpiresAt).getTime();
    const tick = () => {
      const s = Math.round((expiry - Date.now()) / 1000);
      setSecondsLeft(s);
      if (s <= 0 && step === 3) {
        toast.error('El tiempo de reserva expiró, elige otro horario');
        setHold(null); setSelectedTime(null); setStep(2);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [hold, step]);

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
    setHolding(true); setSelectedTime(slot.time);
    try {
      const h = await holdSlot(date, slot.time, guests, zoneId);
      setHold(h);
      setStep(3);
    } catch (e) {
      const err = e as Error & { code?: string };
      toast.error(err.message || 'Ese horario ya no está disponible');
      setSelectedTime(null);
      fetchSlots();
    } finally {
      setHolding(false);
    }
  }

  async function submit() {
    if (!name.trim() || !phone.trim()) { toast.error('Nombre y teléfono son obligatorios'); return; }
    setSubmitting(true);
    try {
      if (mode === 'area') {
        if (!zoneId) { toast.error('Elegí la zona a reservar'); return; }
        const r = await createZoneRequest({
          date, time: areaTime, guests, zoneId,
          customerName: name.trim(), customerPhone: phone.trim(),
          customerEmail: email.trim() || undefined,
          occasionType: occasion, specialRequests: notes.trim() || undefined,
        });
        setResult(r); setStep(4);
        return;
      }
      if (!hold) return;
      const r = await confirmPublic(hold.reservationId, {
        confirmationCode: hold.confirmationCode,
        customerName: name.trim(),
        customerPhone: phone.trim(),
        customerEmail: email.trim() || undefined,
        occasionType: occasion,
        specialRequests: notes.trim() || undefined,
      });
      setResult(r); setStep(4);
    } catch (e) {
      const err = e as Error & { code?: string };
      if (err.code === 'EXPIRED') {
        toast.error('El tiempo de reserva expiró, elige otro horario');
        setHold(null); setSelectedTime(null); setStep(2);
      } else {
        toast.error(err.message || (mode === 'area' ? 'No se pudo enviar la solicitud' : 'No se pudo confirmar la reserva'));
      }
    } finally { setSubmitting(false); }
  }

  function reset() {
    setStep(1); setSelectedTime(null); setHold(null); setResult(null);
    setName(''); setPhone(''); setEmail(''); setOccasion(0); setNotes('');
    setZoneId(null);
  }

  const mmss = secondsLeft != null && secondsLeft > 0
    ? `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`
    : '0:00';

  // ─── Confirmación ───
  if (step === 4 && result) {
    if (mode === 'area') {
      return (
        <div className="mx-auto max-w-lg rounded-3xl border border-primary/20 bg-warm-900/50 p-10 text-center shadow-2xl sm:p-12">
          <CheckCircle2 className="mx-auto h-20 w-20 text-primary-light" />
          <h2 className="mt-6 font-display text-3xl font-bold text-white">¡Solicitud enviada!</h2>
          <p className="mt-3 text-warm-400">
            Pediste <b className="text-white">toda la zona{zones.find((z) => z.id === zoneId) ? ` ${zones.find((z) => z.id === zoneId)!.name}` : ''}</b> para el{' '}
            {new Date(date + 'T00:00:00').toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long' })} a las {to12h(areaTime)}.
            {' '}El restaurante confirmará si es posible.
          </p>
          <div className="mt-6 inline-block rounded-xl border border-primary/30 bg-warm-900 px-6 py-4">
            <p className="text-xs text-warm-500 uppercase tracking-wide">Código de seguimiento</p>
            <p className="text-2xl font-mono font-bold text-primary-light">{result.confirmationCode}</p>
          </div>
          <div className="mt-8 flex flex-col items-center gap-3">
            <Link href={`/seguimiento/${result.confirmationCode}`} className="btn-primary-lg w-full justify-center">Ver estado de mi solicitud</Link>
            <button onClick={reset} className="text-sm font-medium text-warm-400 transition-colors hover:text-primary-light">Hacer otra reserva</button>
          </div>
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-lg rounded-3xl border border-primary/20 bg-warm-900/50 p-12 text-center shadow-2xl">
        <CheckCircle2 className="mx-auto h-20 w-20 text-primary-light" />
        <h2 className="mt-6 font-display text-3xl font-bold text-white">{result.status === 'Confirmed' ? '¡Reserva confirmada!' : '¡Reserva recibida!'}</h2>
        <p className="mt-3 text-warm-400">
          {result.status === 'Confirmed' ? 'Te esperamos el ' : 'Solicitaste el '}
          {new Date(date + 'T00:00:00').toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long' })}
          {' '}a las {to12h(selectedTime)}.
          {result.status !== 'Confirmed' && ' El restaurante debe aprobarla; te avisaremos al confirmarla.'}
        </p>
        <div className="mt-6 inline-block rounded-xl border border-primary/30 bg-warm-900 px-6 py-4">
          <p className="text-xs text-warm-500 uppercase tracking-wide">Código de confirmación</p>
          <p className="text-2xl font-mono font-bold text-primary-light">{result.confirmationCode}</p>
        </div>
        <p className="mt-4 text-sm text-warm-400">
          {guests} {guests === 1 ? 'persona' : 'personas'} · Estado: <span className="text-white">{result.status === 'Confirmed' ? 'Confirmada' : 'Pendiente de aprobación'}</span>
        </p>
        <button onClick={reset} className="btn-primary mt-8">Hacer otra reserva</button>
      </div>
    );
  }

  // ─── Wizard ───
  return (
    <div className="mx-auto max-w-3xl rounded-3xl border border-warm-800 bg-warm-900/50 p-6 shadow-2xl backdrop-blur-sm sm:p-10">
      {/* Header del wizard */}
      <div className="mb-6 flex items-center gap-3">
        {step > 1 && (
          <button onClick={() => setStep((s) => (mode === 'area' && s === 3 ? 1 : (s - 1)) as Step)} className="p-2 -ml-2 rounded-lg text-warm-300 hover:bg-warm-800/60" aria-label="Atrás">
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <div className="flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-primary-light">
            Paso {mode === 'area' ? (step === 3 ? 2 : 1) : step} de {mode === 'area' ? 2 : 3}
          </p>
          <h3 className="font-display text-2xl font-bold text-white">
            {step === 1 && '¿Cuándo y cuántos?'}
            {step === 2 && 'Elige tu horario'}
            {step === 3 && 'Tus datos'}
          </h3>
        </div>
      </div>
      <div className="mb-8 h-1.5 rounded-full bg-warm-800 overflow-hidden">
        <div className="h-full bg-primary transition-all" style={{ width: `${mode === 'area' ? (step === 3 ? 100 : 50) : (step / 3) * 100}%` }} />
      </div>

      {/* Paso 1 — fecha + party */}
      {step === 1 && (
        <div className="space-y-5">
          {/* Toggle de modo — solo cuando el widget NO está fijado a un modo (en /area-completa va sin toggle). */}
          {!forceMode && (
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-warm-700 bg-warm-800/40 p-1">
            <button type="button" onClick={() => setMode('mesa')}
              className={['flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold transition min-h-[44px]', mode === 'mesa' ? 'bg-primary text-warm-950 shadow' : 'text-warm-300 hover:text-white'].join(' ')}>
              🍽 Reservar mesa
            </button>
            <button type="button" onClick={() => setMode('area')}
              className={['flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold transition min-h-[44px]', mode === 'area' ? 'bg-primary text-warm-950 shadow' : 'text-warm-300 hover:text-white'].join(' ')}>
              🏛 Área completa
            </button>
          </div>
          )}
          {mode === 'area' && (
            <p className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-xs text-warm-300">
              Reservás <b className="text-warm-100">toda una zona</b> en exclusiva para tu evento. El restaurante confirma si es posible para tu fecha y horario.
            </p>
          )}
          {/* Fecha — calendario SIEMPRE abierto (mobile-first: un toque para elegir el día) */}
          <div className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-warm-300">
              <CalendarDays className="h-4 w-4 text-primary-light" /> Fecha *
            </span>
            <div className="rounded-xl border border-warm-700 bg-warm-800/50 p-3 sm:p-4">
              {/* Navegación de mes */}
              <div className="mb-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                  disabled={calMonth.getFullYear() === new Date().getFullYear() && calMonth.getMonth() <= new Date().getMonth()}
                  className="rounded-lg p-2 text-warm-300 transition-colors hover:bg-warm-800 disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="Mes anterior"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <p className="text-base font-bold capitalize text-warm-100">
                  {calMonth.toLocaleDateString('es-DO', { month: 'long', year: 'numeric' })}
                </p>
                <button
                  type="button"
                  onClick={() => setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                  className="rounded-lg p-2 text-warm-300 transition-colors hover:bg-warm-800"
                  aria-label="Mes siguiente"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
              {/* Días de la semana */}
              <div className="mb-1 grid grid-cols-7">
                {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((d, i) => (
                  <span key={i} className="py-1 text-center text-xs font-bold uppercase text-warm-500">{d}</span>
                ))}
              </div>
              {/* Grid de días del mes */}
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
                      <button
                        key={cellYmd}
                        type="button"
                        disabled={isPast}
                        onClick={() => setDate(cellYmd)}
                        className={[
                          'flex h-11 w-full items-center justify-center rounded-lg text-base transition-colors',
                          isPast
                            ? 'cursor-not-allowed text-warm-700'
                            : isSelected
                              ? 'bg-primary font-bold text-warm-950 shadow-sm'
                              : isToday
                                ? 'font-bold text-primary-light ring-1 ring-primary/40'
                                : 'text-warm-200 hover:bg-warm-800',
                        ].join(' ')}
                      >
                        {d}
                      </button>,
                    );
                  }
                  return cells;
                })()}
              </div>
              {/* Confirmación legible del día elegido */}
              <p className="mt-3 border-t border-warm-800 pt-2.5 text-center text-sm capitalize text-warm-200">
                {new Date(date + 'T00:00:00').toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
          <div className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-warm-300">
              <Users className="h-4 w-4 text-primary-light" /> Comensales *
            </span>
            <div className="flex items-center justify-between rounded-xl border border-warm-700 bg-warm-800/50 p-2">
              <button onClick={() => setGuests((g) => Math.max(minGuests, g - 1))} disabled={guests <= minGuests}
                className="h-12 w-12 rounded-lg bg-warm-800 text-2xl font-bold text-white hover:bg-warm-700 disabled:opacity-40 disabled:cursor-not-allowed" aria-label="Menos comensales">−</button>
              <span className="text-2xl font-semibold tabular-nums text-white">{guests}</span>
              <button onClick={() => setGuests((g) => Math.min(20, g + 1))} disabled={guests >= 20}
                className="h-12 w-12 rounded-lg bg-warm-800 text-2xl font-bold text-white hover:bg-warm-700 disabled:opacity-40 disabled:cursor-not-allowed" aria-label="Más comensales">+</button>
            </div>
            {mode === 'area' && (
              <p className="mt-1.5 text-xs text-primary-light">Mínimo {AREA_MIN_GUESTS} personas para área completa. El restaurante te contactará para confirmar la capacidad de la zona elegida.</p>
            )}
          </div>

          {/* Selector de zona — preferencia (mesa) u obligatoria + completa (área). */}
          {zones.length > 0 && (
            <div className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-warm-300">
                <MapPin className="h-4 w-4 text-primary-light" />
                {mode === 'area' ? 'Zona a reservar (completa)' : 'Zona preferida'}
                {mode === 'area'
                  ? <span className="text-rose-400">*</span>
                  : <span className="text-xs text-warm-500 font-normal">(opcional)</span>}
              </span>
              <div role="radiogroup" aria-label="Zona" className="flex flex-wrap gap-2">
                {mode !== 'area' && (
                  <ZoneChip selected={zoneId === null} onClick={() => setZoneId(null)} label="Sin preferencia" />
                )}
                {zones.map((z) => (
                  <ZoneChip key={z.id} selected={zoneId === z.id} onClick={() => setZoneId(z.id)} label={z.name} />
                ))}
              </div>
            </div>
          )}

          {mode === 'area' && (
            <div className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-warm-300">
                <Clock className="h-4 w-4 text-primary-light" /> Hora <span className="text-rose-400">*</span>
              </span>
              <div role="radiogroup" className="grid grid-cols-4 gap-2">
                {AREA_TIMES.map((t) => {
                  const sel = areaTime === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      role="radio"
                      aria-checked={sel}
                      onClick={() => setAreaTime(t)}
                      className={[
                        'h-12 rounded-xl border text-sm font-semibold tabular-nums transition',
                        sel
                          ? 'border-primary bg-primary text-warm-950'
                          : 'border-warm-700 bg-warm-800/50 text-warm-200 hover:border-primary-light hover:bg-warm-800',
                      ].join(' ')}
                    >
                      {to12h(t)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <button
            onClick={() => setStep(mode === 'area' ? 3 : 2)}
            disabled={mode === 'area' && (zoneId == null || guests < AREA_MIN_GUESTS)}
            className="btn-primary-lg mt-2 w-full disabled:cursor-not-allowed disabled:opacity-50"
          >
            {mode === 'area'
              ? <>Continuar <ArrowRight className="h-5 w-5" /></>
              : <>Ver horarios disponibles <ArrowRight className="h-5 w-5" /></>}
          </button>
        </div>
      )}

      {/* Paso 2 — slots */}
      {step === 2 && (
        <div className="space-y-5">
          <p className="text-sm text-warm-400">
            {new Date(date + 'T00:00:00').toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long' })} · {guests} {guests === 1 ? 'persona' : 'personas'}
          </p>
          {loadingSlots && !availability && (
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 12 }).map((_, i) => <div key={i} className="h-14 rounded-xl bg-warm-800/50 animate-pulse" />)}
            </div>
          )}
          {slotsError && (
            <div className="text-center py-8">
              <p className="text-warm-400 mb-3">{slotsError}</p>
              <button onClick={fetchSlots} className="btn-primary">Reintentar</button>
            </div>
          )}
          {availability && !anyBookable && !loadingSlots && (
            <div className="text-center py-10 text-warm-400">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
              No hay horarios disponibles para esta fecha. Prueba otro día.
            </div>
          )}
          {windowsWithSlots.map((w) => (
            w.slots.length > 0 && (
              <div key={w.label}>
                <h4 className="text-sm font-bold uppercase tracking-wider text-primary-light mb-2">
                  {w.label} <span className="text-warm-500 font-normal normal-case">({to12h(w.start)}–{to12h(w.end)})</span>
                </h4>
                <div role="radiogroup" className="grid grid-cols-4 gap-2">
                  {w.slots.map((s) => {
                    const disabled = s.status === 'full';
                    const sel = selectedTime === s.time;
                    return (
                      <button key={s.time} role="radio" aria-checked={sel} disabled={disabled || holding}
                        onClick={() => pickSlot(s)}
                        className={[
                          'h-14 rounded-xl border text-center transition flex flex-col items-center justify-center',
                          disabled ? 'border-warm-800 bg-warm-900/30 text-warm-600 line-through cursor-not-allowed'
                            : sel ? 'border-primary bg-primary text-warm-950'
                            : s.status === 'limited' ? 'border-amber-500/40 bg-warm-800/50 text-amber-200 hover:border-primary-light'
                            : 'border-warm-700 bg-warm-800/50 text-warm-200 hover:border-primary-light hover:bg-warm-800',
                        ].join(' ')}>
                        <span className="text-base font-semibold tabular-nums">{to12h(s.time)}</span>
                        {s.status === 'limited' && !disabled && <span className="text-[10px]">Pocos</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )
          ))}
          {holding && (
            <p className="text-center text-sm text-warm-400 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Reservando…
            </p>
          )}
        </div>
      )}

      {/* Paso 3 — contacto */}
      {step === 3 && (
        <div className="space-y-5">
          {mode === 'area' && (
            <div className="flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/30 px-4 py-3 text-sm text-warm-200">
              <Building2 className="w-4 h-4 text-primary-light flex-shrink-0" />
              <span>Zona <b className="text-white">{zones.find((z) => z.id === zoneId)?.name ?? ''}</b> (completa) · {new Date(date + 'T00:00:00').toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })} · {to12h(areaTime)} · {guests} pers.</span>
            </div>
          )}
          {selectedTime && (
            <div className="flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/30 px-4 py-3 text-sm text-warm-200">
              <Clock className="w-4 h-4 text-primary-light" />
              <span>Tu mesa está apartada para las <b className="text-white">{to12h(selectedTime)}</b> · {guests} pers.</span>
              {secondsLeft != null && <span className="ml-auto font-mono text-primary-light">{mmss}</span>}
            </div>
          )}
          <div className="grid gap-5 sm:grid-cols-2">
            <WarmField icon={<UserIcon className="w-4 h-4" />} label="Nombre completo" required>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" className="warm-inp" />
            </WarmField>
            <WarmField icon={<Phone className="w-4 h-4" />} label="Teléfono" required>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="(809) 555-0000" className="warm-inp" />
            </WarmField>
          </div>
          <WarmField icon={<Mail className="w-4 h-4" />} label="Email (opcional)">
            <input value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" placeholder="tu@email.com" className="warm-inp" />
          </WarmField>
          <WarmField icon={<PartyPopper className="w-4 h-4" />} label="Ocasión">
            <select value={occasion} onChange={(e) => setOccasion(Number(e.target.value))} className="warm-inp">
              {OCCASIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </WarmField>
          <WarmField label="Solicitudes especiales">
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Alergias, silla de bebé, mesa junto a la ventana…" className="warm-inp resize-none" />
          </WarmField>
          <button onClick={submit} disabled={submitting} className="btn-primary-lg mt-2 w-full disabled:cursor-not-allowed disabled:opacity-60">
            {submitting
              ? <><Loader2 className="h-5 w-5 animate-spin" /> {mode === 'area' ? 'Enviando…' : 'Confirmando…'}</>
              : <>{mode === 'area' ? 'Enviar solicitud' : 'Confirmar reserva'} <ArrowRight className="h-5 w-5" /></>}
          </button>
        </div>
      )}

      {/* estilos locales para los inputs warm/gold */}
      <style>{`
        .warm-inp { width: 100%; border-radius: 0.75rem; border: 1px solid #44403c; background: rgba(41, 37, 36, 0.5); padding: 0.75rem 1rem; color: #ffffff; outline: none; transition: border-color 0.15s, box-shadow 0.15s; }
        .warm-inp::placeholder { color: #78716c; }
        .warm-inp:focus { border-color: #b8860b; box-shadow: 0 0 0 1px #b8860b; }
      `}</style>
    </div>
  );
}

function ZoneChip({ selected, onClick, label }: { selected: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={[
        'inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition min-h-[44px]',
        selected
          ? 'border-primary bg-primary text-warm-950 shadow-md'
          : 'border-warm-700 bg-warm-800/50 text-warm-200 hover:border-primary-light hover:bg-warm-800',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

function WarmField({ icon, label, required, children }: { icon?: ReactNode; label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-warm-300">
        {icon && <span className="text-primary-light">{icon}</span>}{label}{required && <span className="text-rose-400">*</span>}
      </span>
      {children}
    </label>
  );
}
