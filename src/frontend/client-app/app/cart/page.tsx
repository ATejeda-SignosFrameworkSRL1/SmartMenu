'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useCartStore } from '@/lib/stores/cartStore';
import { apiClient } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, Plus, Minus, ShoppingBag, ArrowLeft, Receipt } from 'lucide-react';
import toast from 'react-hot-toast';
import { useState, Suspense } from 'react';
import { useTranslations } from 'next-intl';

function CartPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const t = useTranslations('cart');
  const tc = useTranslations('common');
  const tt = useTranslations('toast');
  const {
    items,
    tableId,
    customerName,
    addToOrderId: storeAddToOrderId,
    takeaway,
    setTakeaway,
    setAddToOrderId,
    removeItem,
    updateQuantity,
    clearCart,
    getSubtotal,
    getTax,
    getTip,
    getTotal,
  } = useCartStore();

  // Modal "¿Estás seguro?" antes de confirmar un pedido PARA LLEVAR.
  const [showTakeawayConfirm, setShowTakeawayConfirm] = useState(false);

  // orderId puede venir por URL (?orderId=71) o por el store
  const urlOrderId = searchParams?.get('orderId') ? parseInt(searchParams.get('orderId')!) : null;
  const addToOrderId = urlOrderId ?? storeAddToOrderId;
  const isAddingToOrder = !!addToOrderId;

  const [specialInstructions, setSpecialInstructions] = useState('');

  // Mutación para orden nueva
  const createOrderMutation = useMutation({
    mutationFn: (orderData: unknown) => apiClient.createOrder(orderData),
    onSuccess: (response: any) => {
      const order = response?.data;
      const orderId = order?.id ?? order?.Id;
      if (!orderId) { toast.error(tt('noOrderId')); return; }
      toast.success(tt('orderCreated'));
      localStorage.setItem('current_order_id', String(orderId));
      clearCart();
      router.push(`/order-status/${orderId}`);
    },
    onError: (error: any) => {
      const data = error?.response?.data;
      toast.error(data?.error ?? data?.message ?? tt('createOrderError'));
    },
  });

  // Mutación para agregar ítems a orden existente
  const addItemsMutation = useMutation({
    mutationFn: (items: any[]) => apiClient.addItemsToOrder(addToOrderId!, items),
    onSuccess: (response: any) => {
      toast.success(tt('itemsAdded'));
      // Actualizar el cache de React Query con la respuesta actualizada del backend
      // (que ya tiene status='Confirmed'), evitando que order-status redirija a order-served
      if (addToOrderId) {
        queryClient.setQueryData(['order', addToOrderId], response);
      }
      clearCart();
      router.push(`/order-status/${addToOrderId}`);
    },
    onError: (error: any) => {
      const data = (error as any)?.response?.data;
      toast.error(data?.error ?? data?.message ?? tt('addItemsError'));
    },
  });

  const isPending = createOrderMutation.isPending || addItemsMutation.isPending;

  const handleCheckout = () => {
    if (items.length === 0) { toast.error(tt('cartEmpty')); return; }

    const mappedItems = items.map(item => ({
      dishId: item.dishId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      // PARA LLEVAR: la marca va POR ÍTEM (en notes). Así sobrevive tanto al CREAR la
      // orden como al AGREGAR a una orden viva de la mesa (AddItemsToOrderAsync persiste
      // notes pero NO specialInstructions), y el print-agent la imprime en la línea de
      // cada plato para llevar. En mesa compartida solo se marcan los ítems para llevar.
      notes: [takeaway ? 'PARA LLEVAR' : '', item.notes || item.specialInstructions || '']
        .filter(Boolean).join(' · ') || undefined,
      drinkTiming: item.drinkTiming || undefined,
      withAlcohol: item.withAlcohol !== undefined ? item.withAlcohol : undefined,
      meatCooking: item.meatCooking || undefined,
      sideDish: item.sideDish || undefined,
      customizations: [item.customizations, item.liga ? `Liga: ${item.liga}` : ''].filter(Boolean).join(' | ') || undefined,
      allergies: item.allergies || undefined,
      courseTiming: item.courseTiming !== undefined ? item.courseTiming : undefined,
    }));

    if (isAddingToOrder) {
      addItemsMutation.mutate(mappedItems);
      return;
    }

    // Nunca enviar a una mesa por defecto: sin mesa escaneada el pedido
    // llegaria (y se cobraria) a la Mesa 1 fisica de otro comensal.
    if (!tableId) {
      toast.error(tt('noTableSelected'));
      router.push('/table');
      return;
    }

    const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    createOrderMutation.mutate({
      tableId,
      sessionId,
      customerName: customerName?.trim() || undefined,
      specialInstructions: specialInstructions || undefined,
      items: mappedItems,
    });
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-8">
          <ShoppingBag className="w-24 h-24 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-700 mb-2">
            {t('emptyTitle')}
          </h2>
          <p className="text-gray-500 mb-6">
            {t('emptyHint')}
          </p>
          <Link
            href="/menu"
            className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-5 h-5" />
            {t('backToMenuButton')}
          </Link>
        </div>
      </div>
    );
  }

  const subtotal = getSubtotal();
  const tax = getTax();
  const tip = getTip();
  const total = getTotal();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label={tc('back')}
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {isAddingToOrder ? t('addToMyOrderTitle') : t('yourOrder')}
                </h1>
                <p className="text-sm text-gray-600">
                  {isAddingToOrder ? t('willAddToExisting') : t('dishCount', { count: items.length })}
                </p>
              </div>
            </div>
            <Link
              href="/menu"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              {tc('backToMenu')}
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Items List */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">{t('yourDishes')}</h2>

          <div className="space-y-4">
            {items.map((item) => (
              <div
                key={item.lineId ?? item.dishId}
                className="flex items-center gap-4 pb-4 border-b last:border-b-0"
              >
                {/* Item Info */}
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{item.dishName}</h3>
                  <p className="text-sm text-gray-600">
                    RD${item.unitPrice.toFixed(2)} {t('eachAbbr')}
                  </p>
                  {item.specialInstructions && (
                    <p className="text-xs text-gray-500 mt-1">
                      {t('noteInline', { note: item.specialInstructions })}
                    </p>
                  )}
                </div>

                {/* Quantity Controls */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQuantity(item.lineId!, Math.max(1, item.quantity - 1))}
                    className="p-1 rounded-lg bg-gray-100 text-gray-700 hover:bg-primary-600 hover:text-white transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-8 text-center font-semibold text-gray-700">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.lineId!, item.quantity + 1)}
                    className="p-1 rounded-lg bg-gray-100 text-gray-700 hover:bg-primary-600 hover:text-white transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Price */}
                <div className="text-right min-w-[80px]">
                  <p className="font-bold text-gray-900">
                    RD${(item.unitPrice * item.quantity).toFixed(2)}
                  </p>
                </div>

                {/* Remove Button */}
                <button
                  onClick={() => removeItem(item.lineId!)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Special Instructions */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            {t('specialInstructions')}
          </h2>
          <textarea
            value={specialInstructions}
            onChange={(e) => setSpecialInstructions(e.target.value)}
            placeholder={t('specialInstructionsPlaceholder')}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            rows={3}
          />
        </div>

        {/* Tu orden detallada - Revisa antes de confirmar */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6 border-2 border-primary-100">
          <h2 className="text-xl font-bold text-gray-900 mb-1">{t('detailedOrder')}</h2>
          <p className="text-sm text-gray-500 mb-4">{t('reviewBeforeConfirm')}</p>

          <div className="space-y-3">
            {items.map((item) => {
              const hasDetails = item.notes || item.specialInstructions || item.customizations || item.allergies || item.meatCooking || item.sideDish || item.drinkTiming;
              return (
                <div key={item.lineId ?? item.dishId} className="rounded-lg bg-gray-50 border border-gray-200 p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-gray-900">
                        <span className="text-primary-600">{item.quantity}x</span> {item.dishName}
                      </p>
                      <p className="text-sm text-gray-600">RD$ {item.unitPrice.toFixed(2)} {t('eachAbbr')}</p>
                    </div>
                    <p className="font-bold text-gray-900">RD$ {(item.unitPrice * item.quantity).toFixed(2)}</p>
                  </div>
                  {hasDetails && (
                    <div className="mt-3 pt-3 border-t border-gray-200 space-y-1.5 text-sm">
                      {item.notes && <div className="text-gray-700"><span className="font-medium">{t('labelNotes')}</span> {item.notes}</div>}
                      {item.specialInstructions && <div className="text-gray-700"><span className="font-medium">{t('labelInstructions')}</span> {item.specialInstructions}</div>}
                      {item.meatCooking && <div className="text-gray-700">🔥 <span className="font-medium">{t('labelCooking')}</span> {item.meatCooking}</div>}
                      {item.sideDish && <div className="text-gray-700"><span className="font-medium">{t('labelSide')}</span> {item.sideDish}</div>}
                      {item.drinkTiming && <div className="text-gray-700"><span className="font-medium">{t('labelDrinkTiming')}</span> {item.drinkTiming}</div>}
                      {item.customizations && <div className="text-gray-700"><span className="font-medium">{t('labelCustomization')}</span> {item.customizations}</div>}
                      {item.allergies && (
                        <div className="flex items-center gap-1.5 text-red-700 font-medium bg-red-50 px-2 py-1 rounded">
                          <span>⚠</span> <span>{t('labelAllergy')}</span> {item.allergies}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Summary */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">{t('summary')}</h2>

          <div className="space-y-3">
            <div className="flex justify-between text-gray-700">
              <span>{t('subtotal')}</span>
              <span>RD${subtotal.toFixed(2)}</span>
            </div>

            <div className="flex justify-between text-gray-700">
              <span>{t('itbis')}</span>
              <span>RD${tax.toFixed(2)}</span>
            </div>

            <div className="flex justify-between text-gray-700">
              <span>{t('legalTip')}</span>
              <span>RD${tip.toFixed(2)}</span>
            </div>

            <div className="border-t pt-3 flex justify-between text-xl font-bold text-gray-900">
              <span>{t('total')}</span>
              <span>RD${total.toFixed(2)}</span>
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              {t.rich('legalTipNote', { strong: (chunks) => <strong>{chunks}</strong> })}
            </p>
          </div>
        </div>

        {/* Checkout */}
        <div className="sticky bottom-0 bg-white p-6 rounded-t-xl shadow-lg space-y-3">
          {takeaway && (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-primary-200 bg-primary-50 py-2 text-sm font-semibold text-primary-700">
              🥡 {t('takeawayBanner')}
            </div>
          )}
          {/* Móvil: apilados (CTA principal arriba, cada uno ancho completo → sin quiebre de
              texto ni botones apretados). ≥sm: lado a lado. */}
          <div className="flex flex-col-reverse sm:flex-row gap-3">
            {/* Secundario: entra al modo PARA LLEVAR (→ menú) o sigue agregando.
                UX/UI: mismo alto/radio/tipografía que el primario; delineado = acción secundaria. */}
            <button
              type="button"
              onClick={() => { setTakeaway(true); setAddToOrderId(null); router.push('/menu'); }}
              className="w-full sm:w-auto px-6 py-4 rounded-xl border-2 border-primary-600 bg-white text-primary-700 font-semibold text-lg whitespace-nowrap shadow-sm hover:bg-primary-50 hover:shadow-md transition-all duration-200 flex items-center justify-center gap-2"
            >
              {takeaway ? <Plus className="w-5 h-5" /> : <ShoppingBag className="w-5 h-5" />}
              {takeaway ? t('takeawayContinue') : t('takeawayButton')}
            </button>
            <button
              onClick={takeaway ? () => setShowTakeawayConfirm(true) : handleCheckout}
              disabled={isPending}
              className="w-full sm:flex-1 bg-gradient-to-r from-primary-600 to-secondary-600 text-white py-4 rounded-xl font-semibold text-lg whitespace-nowrap shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isPending ? (
                <>
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {t('processing')}
                </>
              ) : isAddingToOrder ? (
                <>
                  <Receipt className="w-6 h-6" />
                  {t('addToMyOrderButton')}
                </>
              ) : (
                <>
                  <Receipt className="w-6 h-6" />
                  {t('confirmOrder')}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Modal "¿Estás seguro?" del pedido PARA LLEVAR */}
        {showTakeawayConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
              <span className="text-5xl" aria-hidden>🥡</span>
              <h3 className="mt-2 text-lg font-bold text-gray-900">{t('takeawayConfirmTitle')}</h3>
              <p className="mt-1 text-sm text-gray-600">{t('takeawayConfirmBody')}</p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShowTakeawayConfirm(false)}
                  className="py-3 rounded-xl border-2 border-gray-200 font-semibold text-gray-700 hover:bg-gray-50"
                >
                  {t('takeawayConfirmNo')}
                </button>
                <button
                  onClick={() => { setShowTakeawayConfirm(false); handleCheckout(); }}
                  disabled={isPending}
                  className="py-3 rounded-xl bg-gradient-to-r from-primary-600 to-secondary-600 text-white font-semibold disabled:opacity-50"
                >
                  {t('takeawayConfirmYes')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CartPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <ShoppingBag className="w-24 h-24 text-gray-300 mx-auto animate-pulse" />
      </div>
    }>
      <CartPageInner />
    </Suspense>
  );
}
