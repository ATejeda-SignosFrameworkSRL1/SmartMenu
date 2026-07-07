'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Clock, CheckCircle, ChefHat, Package, Utensils, Wine, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
const DRINK_KEYWORDS = ['cerveza', 'vino', 'cóctel', 'refresco', 'agua', 'cafe', 'té', 'bebida', 'margarita', 'ron', 'whisky', 'colada', 'piña colada', 'mojito', 'daiquiri', 'soda', 'jugo', 'limonada', 'batido', 'smoothie', 'copa', 'trago', 'coca', 'pepsi'];
function isDrinkItem(dishName: string): boolean {
  const name = (dishName || '').toLowerCase();
  // Match por PALABRA completa (con plurales), no substring: 'agua' no debe matchear
  // 'aguacate' ni 'ron' a 'macarrones'. Mantener en sync con KDS/waiter/admin y backend.
  const words = new Set(name.split(/[^a-záéíóúüñ]+/).filter(Boolean));
  return DRINK_KEYWORDS.some((k) =>
    k.includes(' ') ? name.includes(k) : words.has(k) || words.has(k + 's') || words.has(k + 'es')
  );
}

const statusSteps = [
  { status: 'Pending', label: 'Pendiente', icon: Clock, color: 'text-gray-500' },
  { status: 'Confirmed', label: 'Confirmada', icon: CheckCircle, color: 'text-blue-500' },
  { status: 'Preparing', label: 'Preparando', icon: ChefHat, color: 'text-yellow-500' },
  { status: 'Ready', label: 'Lista', icon: Package, color: 'text-green-500' },
  { status: 'Served', label: 'Servida', icon: Utensils, color: 'text-primary-600' },
];

export default function OrderStatusPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params?.id ? parseInt(params.id as string) : null;
  const [cancelling, setCancelling] = useState(false);

  const { data: orderData, isLoading, refetch } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => apiClient.getOrder(orderId!),
    enabled: !!orderId,
    refetchInterval: 5000, // Actualizar cada 5 segundos
  });

  const handleCancel = async () => {
    if (!orderId) return;
    const ok = window.confirm('¿Cancelar esta orden? Esto no se puede deshacer.');
    if (!ok) return;
    setCancelling(true);
    try {
      await apiClient.cancelOrder(orderId, 'Cancelada por cliente');
      toast.success('Orden cancelada');
      router.push('/menu');
    } catch (err: any) {
      const code = err?.response?.status;
      const msg = err?.response?.data?.error ?? 'No se pudo cancelar la orden';
      if (code === 409) toast.error(`No se puede cancelar: ${msg}`);
      else toast.error(msg);
      setCancelling(false);
      await refetch();
    }
  };

  const order = orderData?.data;
  const items = order?.items ?? [];
  // FASE 2 RUTEO — el flag isDrink del backend (zona del plato) manda; el matcher
  // por nombre queda como fallback para payloads sin el campo.
  const itemIsDrink = (item: any): boolean => {
    const flag = item?.isDrink ?? item?.IsDrink;
    return typeof flag === 'boolean' ? flag : isDrinkItem(item?.dishName ?? item?.DishName ?? '');
  };
  const kitchenItems = items.filter((item: any) => !itemIsDrink(item));
  const barItems = items.filter((item: any) => itemIsDrink(item));

  const hasFood = kitchenItems.length > 0;
  const hasBar  = barItems.length > 0;

  // Default: si solo hay bebidas → arrancar en 'bar', si no → 'general'
  const [statusView, setStatusView] = useState<'general' | 'bar'>(() =>
    !hasFood && hasBar ? 'bar' : 'general'
  );
  const kitchenPreparing = order?.kitchenPreparing ?? order?.KitchenPreparing ?? false;
  const kitchenReady     = order?.kitchenReady     ?? order?.KitchenReady     ?? false;
  const kitchenServed    = order?.kitchenServed    ?? order?.KitchenServed    ?? false;
  const barReady         = order?.barReady         ?? order?.BarReady         ?? false;
  const barPreparing     = order?.barPreparing     ?? order?.BarPreparing     ?? false;
  const barServed        = order?.barServed        ?? order?.BarServed        ?? false;

  // Sincronizar vista cuando cambien los ítems
  useEffect(() => {
    if (!hasBar && statusView === 'bar') setStatusView('general');
    if (!hasFood && hasBar && statusView === 'general') setStatusView('bar');
    // Cocina terminó pero el bar sigue pendiente → enfocar la bebida automáticamente
    if (hasBar && !barServed && kitchenServed && statusView === 'general') setStatusView('bar');
  }, [hasFood, hasBar, kitchenServed, barServed, statusView]);

  // Redirect to served page when order is served
  useEffect(() => {
    if (order && order.status === 'Served') {
      router.push(`/order-served/${orderId}`);
    }
  }, [order, orderId, router]);

  const currentStepIndex = order
    ? statusSteps.findIndex((step) => step.status === order.status)
    : -1;

  // Step general: el más avanzado entre status global y progreso real de cocina/bar
  const derivedGeneralStep = (() => {
    if (!order) return -1;
    const globalStep = currentStepIndex >= 0 ? currentStepIndex : 0;
    // Servida completa: todas las partes servidas
    const allServed = (!hasFood || kitchenServed) && (!hasBar || barServed);
    if (allServed) return 4;
    // Lista: al menos una parte lista
    if (kitchenReady || barReady) return 3;
    // Preparando: al menos una parte preparando
    if (kitchenPreparing || barPreparing) return 2;
    return globalStep;
  })();

  // Para la vista Bar: 0 Pendiente, 1 Confirmada, 2 Preparando, 3 Lista, 4 Servida
  const barStepIndex =
    order?.status === 'Served' || barServed
      ? 4
      : barReady
        ? 3
        : barPreparing
          ? 2
          : order?.status === 'Confirmed' || order?.status === 'Preparing' || order?.status === 'Ready'
            ? 1
            : 0;

  const displayStepIndex = statusView === 'bar' ? barStepIndex : derivedGeneralStep;

  // Etiqueta descriptiva para el estado actual
  const getGeneralLabel = () => {
    if (!order) return '';
    if (derivedGeneralStep >= 4) return 'Servida';
    if (hasFood && hasBar) {
      const kitchenDone = kitchenServed || kitchenReady;
      const barDone     = barServed || barReady;
      if (kitchenDone && !barDone) return 'Cocina lista • Bar preparando';
      if (!kitchenDone && barDone) return 'Bar listo • Cocina preparando';
    }
    return statusSteps[derivedGeneralStep]?.label ?? '';
  };

  const displayLabel = statusView === 'bar'
    ? (barServed ? 'Servida' : statusSteps[barStepIndex]?.label)
    : getGeneralLabel();

  const getTimeElapsed = () => {
    if (!order?.createdAt) return 0;
    // Forzar interpretación UTC (el servidor devuelve sin 'Z')
    const utcStr = !order.createdAt.endsWith('Z') ? order.createdAt + 'Z' : order.createdAt;
    return Math.floor((new Date().getTime() - new Date(utcStr).getTime()) / 60000);
  };

  // Mostrar "Solicitar Cuenta" cuando cocina sirvió (aunque bar aún no)
  const canRequestBill =
    order?.status === 'Served' ||
    (kitchenServed && (!hasBar || barServed)) ||
    (barServed && (!hasFood || kitchenServed));


  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center">
        <div className="text-center">
          <ChefHat className="w-16 h-16 text-primary-600 animate-bounce mx-auto mb-4" />
          <p className="text-xl text-gray-700">Cargando estado de orden...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <p className="text-xl text-gray-700 mb-4">Orden no encontrada</p>
          <button
            onClick={() => router.push('/menu')}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Volver al Menú
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Tu Orden
            </h1>
            <p className="text-2xl font-bold text-primary-600">Pedido #{(order.orderNumber ?? '').split('-').pop()?.toUpperCase()}</p>
            <p className="text-gray-600 mt-2">Mesa {order.tableId}</p>

            {/* Cancelar orden — solo antes de que la cocina empiece (Pending o Confirmed) */}
            {(order.status === 'Pending' || order.status === 'Confirmed') && (
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
              >
                <X className="w-4 h-4" />
                {cancelling ? 'Cancelando…' : 'Cancelar orden'}
              </button>
            )}

            {/* Selector debajo de #ORD: ver orden general o orden bar (5 estados) */}
            <div className="flex justify-center gap-2 mt-4">
              <button
                type="button"
                onClick={() => hasFood && setStatusView('general')}
                disabled={!hasFood}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                  !hasFood
                    ? 'opacity-50 cursor-not-allowed text-gray-400 bg-gray-100'
                    : statusView === 'general'
                      ? 'bg-primary-600 text-white shadow'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <ChefHat className="w-4 h-4" />
                Orden general
              </button>
              <button
                type="button"
                onClick={() => hasBar && setStatusView('bar')}
                disabled={!hasBar}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                  !hasBar
                    ? 'opacity-50 cursor-not-allowed text-gray-400 bg-gray-100'
                    : statusView === 'bar'
                      ? 'bg-primary-600 text-white shadow'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Wine className="w-4 h-4" />
                Orden bar
              </button>
            </div>
          </div>

          {/* Progress Steps (general o bar según statusView) */}
          <div className="mb-8">
            <div className="flex justify-between items-center relative">
              {/* Progress Line */}
              <div className="absolute left-0 right-0 h-1 bg-gray-200 top-1/2 -translate-y-1/2 -z-10">
                <div
                  className="h-full bg-primary-600 transition-all duration-500"
                  style={{
                    width: displayStepIndex >= 0 ? `${(displayStepIndex / (statusSteps.length - 1)) * 100}%` : '0%',
                  }}
                />
              </div>

              {/* Steps */}
              {statusSteps.map((step, index) => {
                const Icon = step.icon;
                const isActive = index <= displayStepIndex;
                const isCurrent = index === displayStepIndex;

                return (
                  <div key={step.status} className="flex flex-col items-center relative">
                    <div
                      className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                        isActive
                          ? 'bg-primary-600 text-white shadow-lg scale-110'
                          : 'bg-white text-gray-400 border-2 border-gray-300'
                      }`}
                    >
                      <Icon className="w-8 h-8" />
                    </div>
                    <p
                      className={`text-sm font-medium mt-2 text-center ${
                        isActive ? 'text-gray-900' : 'text-gray-500'
                      }`}
                    >
                      {step.label}
                    </p>
                    {isCurrent && (
                      <div className="absolute -bottom-6">
                        <div className="w-3 h-3 bg-primary-600 rounded-full animate-pulse" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Current Status (general o bar) */}
          <div className="bg-gradient-to-r from-primary-100 to-secondary-100 rounded-xl p-6 text-center">
            <p className="text-gray-700 text-sm mb-1">
              {statusView === 'bar' ? 'Estado orden bar:' : 'Estado Actual:'}
            </p>
            <p className="text-2xl font-bold text-gray-900 mb-4">
              {displayLabel}
            </p>
            <div className="flex justify-center gap-8 text-sm">
              <div>
                <p className="text-gray-600">Tiempo transcurrido</p>
                <p className="text-xl font-bold text-primary-600">{getTimeElapsed()} min</p>
              </div>
              {order.status !== 'Served' && order.status !== 'Completed' && (
                <div>
                  <p className="text-gray-600">Tiempo estimado</p>
                  <p className="text-xl font-bold text-primary-600">
                    ~{Math.max(0, 25 - getTimeElapsed())} min
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Cocina: como una orden aparte */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <ChefHat className="w-6 h-6 text-amber-600" />
            Cocina
          </h2>
          <div className="space-y-4">
            {kitchenItems.length === 0 ? (
              <p className="text-gray-500 py-4 text-center">No hay platos de cocina en esta orden.</p>
            ) : (
              kitchenItems.map((item: any) => (
                <div key={item.id} className="flex justify-between items-start border-b border-gray-200 pb-4 last:border-0">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">
                      {item.quantity}x {item.dishName ?? item.DishName}
                    </p>
                    {(item.notes ?? item.Notes) && (
                      <p className="text-sm text-gray-600 mt-1">Nota: {item.notes ?? item.Notes}</p>
                    )}
                    {(item.customizations ?? item.Customizations) && (
                      <p className="text-sm text-gray-600 mt-0.5">Personalización: {item.customizations ?? item.Customizations}</p>
                    )}
                    {(item.allergies ?? item.Allergies) && (
                      <p className="text-sm text-red-600 font-medium mt-0.5">Alergia: {item.allergies ?? item.Allergies}</p>
                    )}
                  </div>
                  <p className="text-lg font-semibold text-gray-900">
                    RD$ {(item.subtotal ?? item.Subtotal ?? 0).toFixed(2)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Bar: como una orden aparte */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Wine className="w-6 h-6 text-sky-600" />
            Bar
          </h2>
          <div className="space-y-4">
            {barItems.length === 0 ? (
              <p className="text-gray-500 py-4 text-center">No hay bebidas en esta orden.</p>
            ) : (
              barItems.map((item: any) => (
                <div key={item.id} className="flex justify-between items-start border-b border-gray-200 pb-4 last:border-0">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">
                      {item.quantity}x {item.dishName ?? item.DishName}
                    </p>
                    {(item.notes ?? item.Notes) && (
                      <p className="text-sm text-gray-600 mt-1">Nota: {item.notes ?? item.Notes}</p>
                    )}
                    {(item.customizations ?? item.Customizations) && (
                      <p className="text-sm text-gray-600 mt-0.5">Personalización: {item.customizations ?? item.Customizations}</p>
                    )}
                    {(item.allergies ?? item.Allergies) && (
                      <p className="text-sm text-red-600 font-medium mt-0.5">Alergia: {item.allergies ?? item.Allergies}</p>
                    )}
                  </div>
                  <p className="text-lg font-semibold text-gray-900">
                    RD$ {(item.subtotal ?? item.Subtotal ?? 0).toFixed(2)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Desglose de la orden */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-5 border-b pb-3">Resumen de Cobro</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between text-gray-700">
              <span>Subtotal</span>
              <span className="font-medium">RD$ {(order.subtotal ?? 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-700">
              <span className="flex items-center gap-1">
                ITBIS
                <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">18%</span>
              </span>
              <span className="font-medium">RD$ {(order.tax ?? 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-700">
              <span className="flex items-center gap-1">
                Propina legal
                <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">10%</span>
              </span>
              <span className="font-medium">RD$ {(order.tip ?? (order.subtotal ?? 0) * 0.10).toFixed(2)}</span>
            </div>
            {(order.discount ?? 0) > 0 && (
              <div className="flex justify-between text-green-700">
                <span className="flex items-center gap-1">
                  Descuento
                  <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">–</span>
                </span>
                <span className="font-medium">– RD$ {(order.discount ?? 0).toFixed(2)}</span>
              </div>
            )}
            <div className="border-t border-dashed border-gray-200 pt-3 mt-1">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-gray-900">Total a Pagar</span>
                <span className="text-2xl font-bold text-primary-600">
                  RD$ {(order.total ?? 0).toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1 text-right">ITBIS (18%) y propina legal (10%) incluidos</p>
            </div>
          </div>
        </div>


        {/* Actions */}
        <div className="flex gap-4">
          <button
            onClick={() => router.push(`/menu?activeOrder=${order.id}`)}
            className="flex-1 px-6 py-4 bg-white text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors shadow-lg"
          >
            Volver al Menú
          </button>
          {canRequestBill && (
            <button
              onClick={() => router.push(`/payment/${order.id}`)}
              className="flex-1 px-6 py-4 bg-gradient-to-r from-primary-600 to-secondary-600 text-white rounded-xl font-semibold hover:from-primary-700 hover:to-secondary-700 transition-all shadow-lg"
            >
              💰 Solicitar Cuenta
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
