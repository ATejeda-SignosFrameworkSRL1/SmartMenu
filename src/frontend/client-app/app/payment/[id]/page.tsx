'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useState } from 'react';
import { CreditCard, DollarSign, Smartphone, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const paymentMethods = [
  { id: 'Cash', name: 'Efectivo', icon: DollarSign },
  { id: 'Card', name: 'Tarjeta', icon: CreditCard },
  { id: 'Transfer', name: 'Transferencia', icon: Smartphone },
];

export default function PaymentPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params?.id ? parseInt(params.id as string) : null;
  const [selectedMethod, setSelectedMethod] = useState('Cash');
  const [tipPercentage, setTipPercentage] = useState(0);
  const [customTip, setCustomTip] = useState('');
  const [processing, setProcessing] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [splitType, setSplitType] = useState<'None' | 'ByTime' | 'ByComensal' | 'Proportional' | 'ByCategory'>('None');
  const [splitParts, setSplitParts] = useState(2);
  const [byTimePart1, setByTimePart1] = useState('');
  const [byTimePart2, setByTimePart2] = useState('');
  const [proportionalAssignments, setProportionalAssignments] = useState<Record<number, number>>({});
  const [payAsPerson, setPayAsPerson] = useState(1);
  const [payCategory, setPayCategory] = useState('');
  const [byTimePayPart, setByTimePayPart] = useState<1 | 2>(1);

  const { data: orderData, isLoading } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => apiClient.getOrder(orderId!),
    enabled: !!orderId,
  });

  const order = orderData?.data;

  // API puede devolver PascalCase o camelCase; soportar ambos y evitar undefined
  const orderTotal = order ? (Number((order as any).total) || Number((order as any).Total) || 0) : 0;
  const orderSubtotal = order ? (Number((order as any).subtotal) || Number((order as any).Subtotal) || Number((order as any).subTotal) || 0) : 0;
  const orderTax = order ? (Number((order as any).tax) || Number((order as any).Tax) || Number((order as any).taxAmount) || 0) : 0;

  const orderItems = order?.items ?? [];
  const categoryTotals: Record<string, number> = {};
  orderItems.forEach((item: any) => {
    const cat = item.categoryName ?? item.CategoryName ?? 'Otros';
    const sub = Number(item.subtotal ?? item.Subtotal ?? 0);
    categoryTotals[cat] = (categoryTotals[cat] ?? 0) + sub;
  });
  const taxRate = orderSubtotal > 0 ? orderTax / orderSubtotal : 0.18;
  Object.keys(categoryTotals).forEach(cat => {
    const subtotalCat = categoryTotals[cat];
    categoryTotals[cat] = subtotalCat + subtotalCat * taxRate;
  });

  let myPortion = orderTotal;
  if (splitType === 'ByComensal' && splitParts > 0) myPortion = orderTotal / splitParts;
  else if (splitType === 'ByTime') {
    const p1 = parseFloat(byTimePart1) || 0;
    const p2 = parseFloat(byTimePart2) || 0;
    myPortion = byTimePayPart === 1 ? p1 : p2;
    if (p1 + p2 <= 0) myPortion = orderTotal;
  } else if (splitType === 'Proportional' && splitParts > 0) {
    const perPerson: Record<number, number> = {};
    for (let i = 1; i <= splitParts; i++) perPerson[i] = 0;
    orderItems.forEach((item: any) => {
      const sub = Number(item.subtotal ?? item.Subtotal ?? 0);
      const person = proportionalAssignments[item.id ?? item.Id] ?? 1;
      perPerson[person] = (perPerson[person] ?? 0) + sub;
    });
    const subtotalPerson = perPerson[payAsPerson] ?? 0;
    myPortion = subtotalPerson + subtotalPerson * taxRate;
  } else if (splitType === 'ByCategory' && payCategory) {
    myPortion = categoryTotals[payCategory] ?? 0;
  }

  const calculateTotal = () => {
    if (!order || orderTotal <= 0) return myPortion;
    let tipAmount = 0;
    const base = myPortion;
    if (tipPercentage > 0) {
      tipAmount = base * (tipPercentage / 100);
    } else if (customTip && parseFloat(customTip) > 0) {
      tipAmount = parseFloat(customTip);
    }
    return base + tipAmount;
  };

  const handlePayment = async () => {
    if (!order || orderTotal <= 0) return;

    setProcessing(true);
    try {
      const amountToPay = myPortion;
      let tipAmount = 0;
      let tipPct = 0;

      if (tipPercentage > 0) {
        tipPct = tipPercentage;
        tipAmount = amountToPay * (tipPercentage / 100);
      } else if (customTip && parseFloat(customTip) > 0) {
        tipAmount = parseFloat(customTip);
        tipPct = amountToPay > 0 ? (tipAmount / amountToPay) * 100 : 0;
      }

      await apiClient.createPayment({
        orderId: (order as any).id ?? (order as any).Id,
        paymentMethod: selectedMethod,
        amount: amountToPay,
        tipAmount,
        tipPercentage: tipPct,
        billSplitType: splitType === 'None' ? undefined : splitType,
        splitPartIndex: splitType === 'ByComensal' ? splitParts : splitType === 'ByTime' ? 2 : undefined,
      });

      setCompleted(true);
      toast.success('¡Pago procesado exitosamente!');

      // Notificar al mesero si es tarjeta
      if (selectedMethod === 'Card') {
        toast('Mesero notificado para recoger la tarjeta', { icon: '📱' });
      }

      // Redirigir al menú después de 3 segundos
      setTimeout(() => {
        router.push('/menu');
      }, 3000);
    } catch (error: any) {
      const msg = error?.response?.data?.error ?? error?.message ?? 'Error al procesar pago';
      toast.error(msg);
    } finally {
      setProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center">
        <div className="text-xl">Cargando...</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <p className="text-xl text-gray-700 mb-4">Orden no encontrada</p>
          <button
            onClick={() => router.push('/menu')}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Volver al Menú
          </button>
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="mb-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">¡Pago Exitoso!</h1>
            <p className="text-gray-600">Gracias por tu preferencia</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <p className="text-sm text-gray-600 mb-1">Orden</p>
            <p className="text-xl font-bold text-gray-900 mb-4">#{(order as any).orderNumber ?? (order as any).OrderNumber}</p>
            <p className="text-sm text-gray-600 mb-1">Total pagado</p>
            <p className="text-3xl font-bold text-primary-600">
              RD$ {orderTotal.toFixed(2)}
            </p>
          </div>
          <p className="text-sm text-gray-500">Redirigiendo al menú...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center">
            Solicitar Cuenta
          </h1>
          <p className="text-gray-600 text-center">Orden #{(order as any).orderNumber ?? (order as any).OrderNumber}</p>
        </div>

        {/* Order Summary */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Resumen</h2>
          
          <div className="space-y-3 mb-6">
            {order.items?.map((item: any, idx: number) => {
              const itemSub = Number(item.subtotal) ?? Number(item.Subtotal) ?? 0;
              return (
                <div key={item.id ?? idx} className="flex justify-between text-gray-700">
                  <span>{item.quantity}x {item.dishName ?? item.DishName}</span>
                  <span>RD$ {itemSub.toFixed(2)}</span>
                </div>
              );
            })}
          </div>

          <div className="border-t-2 border-gray-200 pt-4 space-y-2">
            <div className="flex justify-between text-gray-700">
              <span>Subtotal</span>
              <span>RD$ {orderSubtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-700">
              <span>ITBIS (18%)</span>
              <span>RD$ {orderTax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xl font-bold text-gray-900 pt-2 border-t border-gray-200">
              <span>Total</span>
              <span className="text-primary-600">RD$ {orderTotal.toFixed(2)}</span>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">División de cuenta</h3>
            <div className="flex flex-wrap gap-2 mb-3">
              {[
                { value: 'None', label: 'Cuenta única' },
                { value: 'ByTime', label: 'Por tiempo' },
                { value: 'ByComensal', label: 'Por comensal' },
                { value: 'Proportional', label: 'Proporcional' },
                { value: 'ByCategory', label: 'Por categoría' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => { setSplitType(value as any); setSplitParts(2); setByTimePart1(''); setByTimePart2(''); setProportionalAssignments({}); setPayCategory(''); }}
                  className={`px-3 py-2 rounded-lg border text-sm ${splitType === value ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-700'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {splitType === 'ByComensal' && (
              <div className="flex items-center gap-2 flex-wrap">
                <label className="text-sm text-gray-600">Entre</label>
                <select value={splitParts} onChange={(e) => setSplitParts(parseInt(e.target.value, 10) || 2)} className="border rounded-lg px-3 py-2">
                  {[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} personas</option>)}
                </select>
                <span className="text-sm text-gray-600">→ Tu parte: <strong>RD$ {myPortion.toFixed(2)}</strong></span>
              </div>
            )}
            {splitType === 'ByTime' && (
              <div className="space-y-2">
                <p className="text-sm text-gray-600">Indica el monto de cada parte (deben sumar RD$ {orderTotal.toFixed(2)})</p>
                <div className="flex gap-2 items-center flex-wrap">
                  <input type="number" step="0.01" placeholder="Parte 1 (ej. primera ronda)" value={byTimePart1} onChange={(e) => { setByTimePart1(e.target.value); setByTimePart2((orderTotal - (parseFloat(e.target.value) || 0)).toFixed(2)); }} className="border rounded-lg px-3 py-2 w-40" />
                  <input type="number" step="0.01" placeholder="Parte 2" value={byTimePart2} onChange={(e) => { setByTimePart2(e.target.value); setByTimePart1((orderTotal - (parseFloat(e.target.value) || 0)).toFixed(2)); }} className="border rounded-lg px-3 py-2 w-40" />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">Voy a pagar:</label>
                  <select value={byTimePayPart} onChange={(e) => setByTimePayPart(parseInt(e.target.value, 10) as 1 | 2)} className="border rounded-lg px-3 py-2">
                    <option value={1}>Parte 1 — RD$ {(parseFloat(byTimePart1) || 0).toFixed(2)}</option>
                    <option value={2}>Parte 2 — RD$ {(parseFloat(byTimePart2) || 0).toFixed(2)}</option>
                  </select>
                </div>
              </div>
            )}
            {splitType === 'Proportional' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">Entre</label>
                  <select value={splitParts} onChange={(e) => { setSplitParts(parseInt(e.target.value, 10) || 2); setProportionalAssignments({}); }} className="border rounded-lg px-3 py-2">
                    {[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} personas</option>)}
                  </select>
                </div>
                <p className="text-sm font-medium text-gray-700">Asigna cada ítem a quien lo consumió:</p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {orderItems.map((item: any, idx: number) => {
                    const id = item.id ?? item.Id ?? idx;
                    return (
                      <div key={id} className="flex justify-between items-center text-sm">
                        <span className="truncate flex-1">{item.quantity}x {item.dishName ?? item.DishName}</span>
                        <select value={proportionalAssignments[id] ?? 1} onChange={(e) => setProportionalAssignments(prev => ({ ...prev, [id]: parseInt(e.target.value, 10) }))} className="border rounded px-2 py-1 w-24">
                          {Array.from({ length: splitParts }, (_, i) => i + 1).map((n) => <option key={n} value={n}>Persona {n}</option>)}
                        </select>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">Yo soy persona</label>
                  <select value={payAsPerson} onChange={(e) => setPayAsPerson(parseInt(e.target.value, 10))} className="border rounded-lg px-3 py-2">
                    {Array.from({ length: splitParts }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <span className="text-sm text-gray-600">→ Mi parte: <strong>RD$ {myPortion.toFixed(2)}</strong></span>
                </div>
              </div>
            )}
            {splitType === 'ByCategory' && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Elige la categoría que vas a pagar:</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(categoryTotals).map(([cat, total]) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setPayCategory(cat)}
                      className={`px-3 py-2 rounded-lg border text-sm ${payCategory === cat ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-gray-200'}`}
                    >
                      {cat}: RD$ {total.toFixed(2)}
                    </button>
                  ))}
                </div>
                {payCategory && <p className="text-sm text-gray-600">Tu parte (<strong>{payCategory}</strong>): <strong>RD$ {myPortion.toFixed(2)}</strong></p>}
              </div>
            )}
          </div>
        </div>

        {/* Tip Section */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">¿Deseas dejar propina?</h2>
          
          <div className="grid grid-cols-4 gap-3 mb-4">
            <button
              onClick={() => { setTipPercentage(10); setCustomTip(''); }}
              className={`px-4 py-3 rounded-lg border-2 font-semibold transition-all ${
                tipPercentage === 10
                  ? 'border-primary-600 bg-primary-50 text-primary-600'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              10%
            </button>
            <button
              onClick={() => { setTipPercentage(15); setCustomTip(''); }}
              className={`px-4 py-3 rounded-lg border-2 font-semibold transition-all ${
                tipPercentage === 15
                  ? 'border-primary-600 bg-primary-50 text-primary-600'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              15%
            </button>
            <button
              onClick={() => { setTipPercentage(20); setCustomTip(''); }}
              className={`px-4 py-3 rounded-lg border-2 font-semibold transition-all ${
                tipPercentage === 20
                  ? 'border-primary-600 bg-primary-50 text-primary-600'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              20%
            </button>
            <button
              onClick={() => { setTipPercentage(0); setCustomTip(''); }}
              className={`px-4 py-3 rounded-lg border-2 font-semibold transition-all ${
                tipPercentage === 0 && !customTip
                  ? 'border-primary-600 bg-primary-50 text-primary-600'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              Sin
            </button>
          </div>

          <input
            type="number"
            placeholder="O ingresa un monto personalizado..."
            value={customTip}
            onChange={(e) => { setCustomTip(e.target.value); setTipPercentage(0); }}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-primary-600"
          />

          {(tipPercentage > 0 || customTip) && (
            <div className="mt-4 p-4 bg-green-50 rounded-lg">
              <div className="flex justify-between text-green-800 font-semibold">
                <span>Propina:</span>
                <span>RD$ {(
                  tipPercentage > 0
                    ? orderTotal * (tipPercentage / 100)
                    : parseFloat(customTip || '0')
                ).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-green-900 mt-2 pt-2 border-t border-green-200">
                <span>Total con propina:</span>
                <span>RD$ {calculateTotal().toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Payment Method */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Método de Pago</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {paymentMethods.map((method) => {
              const Icon = method.icon;
              const isSelected = selectedMethod === method.id;

              return (
                <button
                  key={method.id}
                  onClick={() => setSelectedMethod(method.id)}
                  className={`p-6 rounded-xl border-2 transition-all ${
                    isSelected
                      ? 'border-primary-600 bg-primary-50 shadow-lg'
                      : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                  }`}
                >
                  <Icon
                    className={`w-12 h-12 mx-auto mb-3 ${
                      isSelected ? 'text-primary-600' : 'text-gray-400'
                    }`}
                  />
                  <p
                    className={`font-semibold ${
                      isSelected ? 'text-primary-600' : 'text-gray-700'
                    }`}
                  >
                    {method.name}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <button
            onClick={() => router.back()}
            className="flex-1 px-6 py-4 bg-white text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors shadow-lg"
          >
            Cancelar
          </button>
          <button
            onClick={handlePayment}
            disabled={processing}
            className="flex-1 px-6 py-4 bg-gradient-to-r from-primary-600 to-secondary-600 text-white rounded-xl font-semibold hover:from-primary-700 hover:to-secondary-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? 'Procesando...' : `Pagar RD$ ${orderTotal.toFixed(2)}`}
          </button>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          * El mesero procesará tu pago de acuerdo al método seleccionado
        </p>
      </div>
    </div>
  );
}
