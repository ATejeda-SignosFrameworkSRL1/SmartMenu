'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle, UtensilsCrossed, Cake, CreditCard, Clock, GlassWater, UtensilsCrossed as MenuIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api';

export default function OrderServedPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => apiClient.getOrder(parseInt(orderId)),
    refetchInterval: 10000,
  });

  const handleFinishedEating = async () => {
    try {
      await apiClient.markCustomerFinished(parseInt(orderId));
      toast.success('Mesero notificado');
    } catch {
      toast.error('Error al notificar');
    }
  };

  const handleViewDesserts = () => {
    router.push(`/menu?category=Postres&addToOrder=${orderId}`);
  };

  const handleViewDrinks = () => {
    router.push(`/menu?category=Bebidas&addToOrder=${orderId}`);
  };

  const handleBackToMenu = () => {
    router.push(`/menu?addToOrder=${orderId}`);
  };

  const handleRequestAccount = () => {
    router.push(`/payment/${orderId}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Orden no encontrada</p>
        </div>
      </div>
    );
  }

  const timeElapsed = Math.floor((new Date().getTime() - new Date(order.data.createdAt).getTime()) / 60000);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            ¡Buen provecho!
          </h1>
          <p className="text-lg text-gray-600">
            Tu pedido ya fue servido
          </p>
        </div>

        {/* Info Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-sm text-gray-600">Mesa</p>
              <p className="text-2xl font-bold text-primary-600">{order.data.tableNumber || order.data.tableId}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Tiempo desde servido</p>
              <div className="flex items-center justify-center gap-2">
                <Clock className="w-5 h-5 text-gray-500" />
                <p className="text-2xl font-bold text-gray-900">{timeElapsed} min</p>
              </div>
            </div>
          </div>
        </div>

        {/* Options */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900 text-center mb-4">
            ¿Qué deseas hacer ahora?
          </h2>

          {/* Terminé mi plato */}
          <button
            onClick={handleFinishedEating}
            className="w-full bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center group-hover:bg-green-100 transition-colors">
                <UtensilsCrossed className="w-8 h-8 text-green-600" />
              </div>
              <div className="flex-1 text-left">
                <h3 className="text-lg font-bold text-gray-900 mb-1">
                  Terminé mi plato
                </h3>
                <p className="text-sm text-gray-600">
                  (Notificar al mesero)
                </p>
              </div>
            </div>
          </button>

          {/* Ver postres */}
          <button
            onClick={handleViewDesserts}
            className="w-full bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-pink-50 rounded-full flex items-center justify-center group-hover:bg-pink-100 transition-colors">
                <Cake className="w-8 h-8 text-pink-600" />
              </div>
              <div className="flex-1 text-left">
                <h3 className="text-lg font-bold text-gray-900 mb-1">
                  Ver postres
                </h3>
                <p className="text-sm text-gray-600">
                  (Agregar algo más)
                </p>
              </div>
            </div>
          </button>

          {/* Ver bebidas */}
          <button
            onClick={handleViewDrinks}
            className="w-full bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                <GlassWater className="w-8 h-8 text-blue-600" />
              </div>
              <div className="flex-1 text-left">
                <h3 className="text-lg font-bold text-gray-900 mb-1">
                  Ver bebidas
                </h3>
                <p className="text-sm text-gray-600">
                  (Pedir algo para tomar)
                </p>
              </div>
            </div>
          </button>

          {/* Volver al menú completo */}
          <button
            onClick={handleBackToMenu}
            className="w-full bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                <MenuIcon className="w-8 h-8 text-amber-600" />
              </div>
              <div className="flex-1 text-left">
                <h3 className="text-lg font-bold text-gray-900 mb-1">
                  Volver al menú
                </h3>
                <p className="text-sm text-gray-600">
                  (Ver todo el menú)
                </p>
              </div>
            </div>
          </button>

          {/* Pagar cuenta */}
          <button
            onClick={handleRequestAccount}
            className="w-full bg-gradient-to-r from-primary-600 to-secondary-600 text-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center group-hover:bg-white/30 transition-colors">
                <CreditCard className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1 text-left">
                <h3 className="text-lg font-bold text-white mb-1">
                  Pagar cuenta
                </h3>
                <p className="text-sm text-white/80">
                  (Efectivo, tarjeta o transferencia)
                </p>
              </div>
            </div>
          </button>
        </div>

        {/* Resumen de Cobro */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mt-6">
          <h3 className="text-lg font-bold text-gray-900 mb-5 border-b pb-3">Resumen de Cobro</h3>

          {/* Items */}
          <div className="space-y-2 mb-4">
            {order.data.items.map((item: any, idx: number) => (
              <div key={idx} className="flex justify-between text-sm">
                <span className="text-gray-700">{item.quantity}x {item.dishName}</span>
                <span className="font-medium text-gray-900">RD$ {(item.subtotal ?? 0).toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-gray-200 pt-4 space-y-3 text-sm">
            {/* Subtotal */}
            <div className="flex justify-between text-gray-700">
              <span>Subtotal</span>
              <span className="font-medium">RD$ {(order.data.subtotal ?? 0).toFixed(2)}</span>
            </div>

            {/* ITBIS 18% */}
            <div className="flex justify-between text-gray-700">
              <span className="flex items-center gap-1">
                ITBIS
                <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">18%</span>
              </span>
              <span className="font-medium">RD$ {(order.data.tax ?? 0).toFixed(2)}</span>
            </div>

            {/* Propina legal 10% */}
            <div className="flex justify-between text-gray-700">
              <span className="flex items-center gap-1">
                Propina legal
                <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">10%</span>
              </span>
              <span className="font-medium">RD$ {(order.data.tip ?? (order.data.subtotal ?? 0) * 0.10).toFixed(2)}</span>
            </div>

            {/* Descuento */}
            {(order.data.discount ?? 0) > 0 && (
              <div className="flex justify-between text-green-700">
                <span className="flex items-center gap-1">
                  Descuento
                  <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">–</span>
                </span>
                <span className="font-medium">– RD$ {(order.data.discount ?? 0).toFixed(2)}</span>
              </div>
            )}

            {/* Total */}
            <div className="border-t border-gray-200 pt-3">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-gray-900">Total a Pagar</span>
                <span className="text-2xl font-bold text-primary-600">
                  RD$ {(order.data.total ?? 0).toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1 text-right">ITBIS (18%) y propina legal (10%) incluidos</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
