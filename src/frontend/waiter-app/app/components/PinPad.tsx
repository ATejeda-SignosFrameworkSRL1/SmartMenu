'use client';

import { useState } from 'react';
import { X, Delete } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface PinPadProps {
  /** Largo del PIN. Default: 6 (alineado con backend). */
  length?: number;
  /** Callback cuando el usuario completa los N dígitos. */
  onSubmit: (pin: string) => void | Promise<void>;
  /** Mensaje encima del display (ej. "Ingresa tu PIN"). */
  prompt?: string;
  /** Texto debajo en rojo cuando hay error. */
  error?: string | null;
  /** Si true, deshabilita los botones y muestra spinner. */
  loading?: boolean;
  /** Aleatorizar el orden de los dígitos (anti shoulder-surfing). Default: false. */
  shuffleKeys?: boolean;
}

/**
 * Numpad onscreen para ingreso de PIN.
 *
 * UX:
 * - Display de N dots, los activos se llenan al tipear
 * - Layout estándar de telefono: 1-9 en 3x3, "borrar" + 0 + "limpiar" abajo
 * - Auto-submit al llegar a N dígitos
 * - Borrar individual o todo (Clear)
 * - Opcional: orden aleatorio (Sprint 4 anti-fraud, Toast/Square lo hacen)
 */
export function PinPad({
  length = 6,
  onSubmit,
  prompt,
  error,
  loading = false,
  shuffleKeys = false,
}: PinPadProps) {
  const t = useTranslations('pin');
  const resolvedPrompt = prompt ?? t('prompt');
  const [pin, setPin] = useState('');

  // Aleatorizar 0-9 si shuffleKeys está activo
  const digits = (() => {
    const base = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
    if (!shuffleKeys) return base;
    // Fisher-Yates
    const arr = [...base];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  })();

  const handlePress = async (digit: string) => {
    if (loading) return;
    if (pin.length >= length) return;
    const next = pin + digit;
    setPin(next);
    if (next.length === length) {
      await onSubmit(next);
      // Si el padre maneja error, dejará `error` set y vaciamos input
      // Si éxito, el padre típicamente redirige (componente desmonta)
    }
  };

  const handleBackspace = () => {
    if (loading) return;
    setPin(p => p.slice(0, -1));
  };

  const handleClear = () => {
    if (loading) return;
    setPin('');
  };

  // Reset visual cuando el padre muestra un error nuevo
  // (en práctica el padre debería resetear via key prop)

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-xs mx-auto">
      <div className="text-center">
        <p className="text-sm text-gray-600 font-medium">{resolvedPrompt}</p>
      </div>

      {/* Display de N puntos */}
      <div className="flex gap-3 justify-center">
        {Array.from({ length }).map((_, i) => {
          const filled = i < pin.length;
          return (
            <div
              key={i}
              className={`w-3.5 h-3.5 rounded-full transition-colors ${
                error
                  ? 'bg-red-400'
                  : filled
                    ? 'bg-emerald-600'
                    : 'bg-gray-200'
              }`}
            />
          );
        })}
      </div>

      {error && (
        <p className="text-sm text-red-600 text-center -mt-2">{error}</p>
      )}

      {/* Keypad 3x4 */}
      <div className="watch-cols grid grid-cols-3 gap-3 w-full">
        {digits.slice(0, 9).map(d => (
          <button
            key={d}
            type="button"
            disabled={loading}
            onClick={() => handlePress(d)}
            className="aspect-square rounded-2xl bg-white border-2 border-gray-200 hover:border-emerald-400 active:bg-emerald-50 text-2xl font-bold text-gray-800 shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {d}
          </button>
        ))}
        {/* Fila inferior: Clear | 0 | Backspace */}
        <button
          type="button"
          disabled={loading || pin.length === 0}
          onClick={handleClear}
          className="aspect-square rounded-2xl bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
          title={t('clearTitle')}
        >
          <X className="w-5 h-5" />
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => handlePress(digits[9])}
          className="aspect-square rounded-2xl bg-white border-2 border-gray-200 hover:border-emerald-400 active:bg-emerald-50 text-2xl font-bold text-gray-800 shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {digits[9]}
        </button>
        <button
          type="button"
          disabled={loading || pin.length === 0}
          onClick={handleBackspace}
          className="aspect-square rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
          title={t('backspaceTitle')}
        >
          <Delete className="w-5 h-5" />
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <div className="w-4 h-4 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
          {t('verifying')}
        </div>
      )}
    </div>
  );
}
