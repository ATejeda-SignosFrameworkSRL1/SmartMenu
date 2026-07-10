import axios from 'axios';

// Cliente anónimo: el portal público de reservas no requiere login. Next reescribe /api → backend.
const api = axios.create({ baseURL: '' });

export type SlotStatus = 'available' | 'limited' | 'full';

export interface Slot {
  time: string;        // HH:mm
  status: SlotStatus;
  remaining: number;
}

export interface ServiceWindow {
  label: string;       // "Almuerzo", "Cena"
  start: string;       // HH:mm
  end: string;         // HH:mm
}

export interface Availability {
  date: string;
  guests: number;
  slotMinutes: number;
  serviceWindows: ServiceWindow[];
  slots: Slot[];
}

export interface BookingResult {
  reservationId: number;
  confirmationCode: string;
  status: string;
  holdExpiresAt?: string | null;
}

export interface ZoneOption { id: number; name: string; }

function extractError(e: unknown, fallback: string): { message: string; code?: string } {
  if (axios.isAxiosError(e) && e.response?.data) {
    const d = e.response.data as { error?: string; code?: string };
    return { message: d.error || fallback, code: d.code };
  }
  return { message: fallback };
}

export async function getSlots(date: string, guests: number, zoneId?: number | null): Promise<Availability> {
  const params = new URLSearchParams({ date, guests: String(guests) });
  if (zoneId) params.set('zoneId', String(zoneId));
  const { data } = await api.get<Availability>(`/api/tablereservation/availability/slots?${params.toString()}`);
  return data;
}

export async function holdSlot(date: string, time: string, guests: number, zoneId?: number | null): Promise<BookingResult> {
  try {
    const { data } = await api.post<BookingResult>('/api/tablereservation/hold', { date, time, guests, zoneId: zoneId ?? null });
    return data;
  } catch (e) {
    const { message, code } = extractError(e, 'No se pudo reservar ese horario');
    throw Object.assign(new Error(message), { code });
  }
}

export async function confirmPublic(
  id: number,
  body: { confirmationCode: string; customerName: string; customerPhone: string; customerEmail?: string; occasionType: number; specialRequests?: string },
): Promise<BookingResult> {
  try {
    const { data } = await api.put<BookingResult>(`/api/tablereservation/${id}/confirm-public`, body);
    return data;
  } catch (e) {
    const { message, code } = extractError(e, 'No se pudo confirmar la reserva');
    throw Object.assign(new Error(message), { code });
  }
}

export async function getZones(): Promise<ZoneOption[]> {
  try {
    const { data } = await api.get<ZoneOption[]>('/api/zone/public');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// ─────────────── Reserva de ÁREA/ZONA completa (exclusiva) + seguimiento ───────────────

export interface ZoneRequestBody {
  date: string;        // yyyy-MM-dd
  time: string;        // HH:mm
  guests: number;
  zoneId: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  occasionType: number;
  specialRequests?: string;
}

export async function createZoneRequest(body: ZoneRequestBody): Promise<BookingResult> {
  try {
    const { data } = await api.post<BookingResult>('/api/tablereservation/zone-request', body);
    return data;
  } catch (e) {
    const { message, code } = extractError(e, 'No se pudo enviar la solicitud de zona');
    throw Object.assign(new Error(message), { code });
  }
}

export interface ReservationTrack {
  status: string;
  isZoneExclusive: boolean;
  zoneName?: string | null;
  reservationDateTime: string;   // yyyy-MM-ddTHH:mm:ss
  numberOfGuests: number;
  occasionType: number;
  hostResponseMessage?: string | null;
  assignedTableCount: number;
  customerName: string;
}

export async function getTrack(code: string): Promise<ReservationTrack | null> {
  try {
    const { data } = await api.get<ReservationTrack>(`/api/tablereservation/track/${encodeURIComponent(code)}`);
    return data;
  } catch (e) {
    // Solo un 404 real significa "reserva no encontrada". Fallos de red/timeout/5xx se
    // propagan para que la UI conserve la última vista buena y el polling reintente.
    if (axios.isAxiosError(e) && e.response?.status === 404) return null;
    throw e;
  }
}

// Las etiquetas se traducen en la UI vía t(`occasions.${key}`); el value va al backend.
export const OCCASIONS: { value: number; key: string }[] = [
  { value: 0, key: 'none' },
  { value: 1, key: 'birthday' },
  { value: 2, key: 'anniversary' },
  { value: 3, key: 'business' },
  { value: 4, key: 'romantic' },
  { value: 5, key: 'family' },
  { value: 99, key: 'other' },
];
