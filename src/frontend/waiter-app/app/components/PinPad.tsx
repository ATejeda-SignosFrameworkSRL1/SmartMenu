'use client';

import { useState } from 'react';
import { X, Delete } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface PinPadProps {

  length?: number;

  onSubmit: (pin: string) => void | Promise<void>;

  prompt?: string;

  error?: string | null;

  loading?: boolean;

  shuffleKeys?: boolean;
}

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

  const digits = (() => {
    const base = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
    if (!shuffleKeys) return base;

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

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-xs mx-auto">
      <div className="text-center">
        <p className="text-sm text-gray-600 font-medium">{resolvedPrompt}</p>
      </div>

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
