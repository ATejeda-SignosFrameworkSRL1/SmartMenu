import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combina clases de Tailwind CSS de manera inteligente
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formatea precio en DOP (Pesos Dominicanos)
 */
export function formatPrice(amount: number): string {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Formatea fecha en formato local
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('es-DO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

/**
 * Formatea duración en minutos a formato legible
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins > 0 ? `${mins}min` : ''}`;
}

/**
 * Trunca texto largo
 */
export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.substring(0, length) + '...';
}

/**
 * Valida RNC dominicano
 */
export function validateRNC(rnc: string): boolean {
  // RNC debe tener 9 o 11 dígitos
  const cleaned = rnc.replace(/[^0-9]/g, '');
  return cleaned.length === 9 || cleaned.length === 11;
}

/**
 * Calcula ITBIS (18%)
 */
export function calculateITBIS(amount: number): number {
  return amount * 0.18;
}

/**
 * Calcula propina legal (10%)
 */
export function calculateLegalTip(amount: number): number {
  return amount * 0.10;
}

/**
 * Genera código QR para mesa
 */
export function generateTableQR(tableId: number, restaurantId: number): string {
  return `TABLE-${restaurantId}-${tableId}-${Date.now()}`;
}

/**
 * Obtiene iniciales de nombre
 */
export function getInitials(firstName: string, lastName: string): string {
  return `${firstName[0]}${lastName[0]}`.toUpperCase();
}

/**
 * Valida email
 */
export function validateEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * Genera número de orden único
 */
export function generateOrderNumber(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `ORD-${year}${month}${day}-${random}`;
}

/**
 * Debounce function
 */
export function debounce<T extends (..._args: any[]) => any>(
  func: T,
  wait: number
): (..._args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...rest: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...rest), wait);
  };
}
