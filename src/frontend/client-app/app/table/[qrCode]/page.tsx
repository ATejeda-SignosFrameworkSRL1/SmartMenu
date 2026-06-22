'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useCartStore } from '@/lib/stores/cartStore';
import { useEffect, useState } from 'react';
import { Loader2, Store, MapPin, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function TablePage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations('table');
  const tc = useTranslations('common');
  const qrCode = params?.qrCode as string;
  const { setTableId, setCustomerName, clearCart } = useCartStore();
  const [nameInput, setNameInput] = useState('');

  // Determinar si es un ID numérico o un GUID
  const isNumericId = qrCode?.startsWith('table-');
  const tableId = isNumericId && qrCode ? parseInt(qrCode.replace('table-', '')) : null;

  // Al escanear el QR siempre resetear: nombre, carrito y orden activa
  // para que cada comensal ingrese su propio nombre
  useEffect(() => {
    setCustomerName(null);
    clearCart();
    localStorage.removeItem('current_order_id');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: tableInfo, isLoading, error } = useQuery({
    queryKey: ['table', qrCode],
    queryFn: async () => {
      if (tableId) {
        return apiClient.getTable(tableId);
      } else if (qrCode) {
        return apiClient.getTableByQR(qrCode);
      }
      throw new Error('No table identifier provided');
    },
    enabled: !!(tableId || qrCode),
  });

  useEffect(() => {
    if (tableInfo?.data) {
      setTableId(tableInfo.data.id);
    }
  }, [tableInfo, setTableId]);

  const handleSubmitName = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) {
      toast.error(t('nameRequired'));
      return;
    }
    setCustomerName(trimmed);
    toast.success(t('greeting', { name: trimmed }));
    router.push('/menu');
  };

  useEffect(() => {
    if (error) {
      console.error('Error al cargar mesa:', error);
      toast.error(t('notFoundToast'));
      setTimeout(() => router.push('/'), 3000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-primary-600 animate-spin mx-auto mb-4" />
          <p className="text-xl text-gray-700">{t('loadingInfo')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-2xl shadow-xl max-w-md">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('notFoundTitle')}</h2>
          <p className="text-gray-600 mb-4">
            {t('notFoundBody')}
          </p>
        </div>
      </div>
    );
  }

  const table = tableInfo?.data;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full animate-fade-in">
        {/* Selector de idioma */}
        <div className="flex justify-end mb-2">
          <LanguageSwitcher />
        </div>

        {/* Icono de bienvenida */}
        <div className="flex justify-center mb-6">
          <div className="w-24 h-24 bg-gradient-to-br from-primary-100 to-secondary-100 rounded-full flex items-center justify-center">
            <Store className="w-12 h-12 text-primary-600" />
          </div>
        </div>

        {/* Título */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('welcome')}</h1>
          <p className="text-gray-600">SmartMenu</p>
        </div>

        {/* Table Info */}
        <div className="bg-gradient-to-r from-primary-100 to-secondary-100 rounded-xl p-6 mb-6">
          <div className="text-center">
            <p className="text-gray-600 text-sm mb-1">{t('tableLabel')}</p>
            <p className="text-4xl font-bold text-gray-900">{table?.tableNumber}</p>
            {table?.zoneName && (
              <div className="flex items-center justify-center gap-2 text-gray-600 text-sm mt-2">
                <MapPin className="w-4 h-4" />
                <span>{table.zoneName}</span>
              </div>
            )}
            <p className="text-gray-600 text-sm mt-2">
              {t('capacity', { count: table?.capacity ?? 0 })}
            </p>
          </div>
        </div>

        {/* Status */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-green-100 text-green-800 px-4 py-2 rounded-full">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="font-medium">{t('ready')}</span>
          </div>
        </div>

        {/* Siempre pedir nombre — cada comensal debe identificarse */}
        {table ? (
          <form onSubmit={handleSubmitName} className="space-y-4">
            <div className="flex items-center justify-center gap-2 text-gray-700 mb-2">
              <User className="w-5 h-5 text-primary-600" />
              <span className="font-medium">{t('askName')}</span>
            </div>
            <p className="text-sm text-gray-500 text-center mb-3">
              {t('nameHelp')}
            </p>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder={t('namePlaceholder')}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition"
              maxLength={100}
              autoFocus
            />
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-primary-600 to-secondary-600 text-white py-3 rounded-xl font-semibold hover:opacity-90 transition"
            >
              {t('enterMenu')}
            </button>
          </form>
        ) : (
          <div className="text-center text-gray-600">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            <p>{tc('loading')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
