import axios from 'axios';

// Cliente anónimo: el portal público de reservas no requiere login. Next reescribe /api → backend.
const api = axios.create({ baseURL: '' });

export type SlotStatus = 'available' | 'limited' | 'full';

export interface Slot {
  time: string;        // HH:mm
  status: SlotStatus;
  remaining: number;
  isPast: boolean;
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
  success?: boolean;
  reservationId: number;
  confirmationCode: string;
  status: string;
  holdExpiresAt?: string | null;
  reservationDateTime?: string | null;
}

export interface ZoneOption { id: number; name: string; capacity?: number; }

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
  } catch {
    return null;
  }
}

export const OCCASIONS: { value: number; label: string }[] = [
  { value: 0, label: 'Sin ocasión especial' },
  { value: 1, label: '🎂 Cumpleaños' },
  { value: 2, label: '💍 Aniversario' },
  { value: 3, label: '💼 Negocios' },
  { value: 4, label: '❤️ Romántica' },
  { value: 5, label: '🎉 Celebración familiar' },
  { value: 99, label: 'Otra' },
];
