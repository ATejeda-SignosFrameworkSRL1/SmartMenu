'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useState, useEffect, useRef } from 'react';
import { CreditCard, DollarSign, Smartphone, CheckCircle, ArrowLeftRight, Clock, FileText, Building2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const paymentMethods = [
  { id: 'Cash',     name: 'Efectivo',      icon: DollarSign },
  { id: 'Card',     name: 'Tarjeta',       icon: CreditCard },
  { id: 'Transfer', name: 'Transferencia', icon: Smartphone },
  { id: 'Mixed',    name: 'Mixto',         icon: ArrowLeftRight },
];

export default function PaymentPage() {
  const params  = useParams();
  const router  = useRouter();
  const orderId = params?.id ? parseInt(params.id as string) : null;

  const [selectedMethod,  setSelectedMethod]  = useState('Cash');
  const [tipPercentage,   setTipPercentage]   = useState(0);
  const [customTip,       setCustomTip]       = useState('');
  const [processing,      setProcessing]      = useState(false);
  const [stage, setStage] = useState<'idle' | 'waiting' | 'paid'>('idle');
  const [receipt, setReceipt] = useState<any>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [needsReceipt,    setNeedsReceipt]    = useState(false);
  const [rnc,             setRnc]             = useState('');
  const [rncBusiness,     setRncBusiness]     = useState('');
  const [rncValidating,   setRncValidating]   = useState(false);
  const [rncError,        setRncError]        = useState('');

  const { data: orderData, isLoading } = useQuery({
    queryKey: ['order', orderId],
    queryFn:  () => apiClient.getOrder(orderId!),
    enabled:  !!orderId,
  });

  useEffect(() => {
    if (!orderId) return;
    apiClient.requestBilling(orderId).catch(() => {});
  }, [orderId]);

  useEffect(() => {
    if (stage !== 'waiting' || !orderId) return;
    const check = async () => {
      try {
        const res = await apiClient.getOrder(orderId);
        const status: string = (res.data as any)?.status ?? (res.data as any)?.Status ?? '';
        if (status === 'Completed') {
          if (pollRef.current) clearInterval(pollRef.current);
          try {
            const r = await apiClient.getReceiptByOrder(orderId);
            setReceipt(r.data);
          } catch {  }
          setStage('paid');
          localStorage.removeItem('current_order_id');
        }
      } catch {  }
    };
    pollRef.current = setInterval(check, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [stage, orderId]);

  const order       = orderData?.data;
  const orderTotal    = order ? (Number((order as any).total)    || Number((order as any).Total)    || 0) : 0;
  const orderSubtotal = order ? (Number((order as any).subtotal) || Number((order as any).Subtotal) || 0) : 0;
  const orderTax      = order ? (Number((order as any).tax)      || Number((order as any).Tax)      || 0) : 0;

  const activeTipAmount = () => {
    if (tipPercentage > 0) return orderTotal * (tipPercentage / 100);
    if (customTip && parseFloat(customTip) > 0) return parseFloat(customTip);
    return 0;
  };
  const totalWithTip = () => orderTotal + activeTipAmount();

  const validateRnc = async () => {
    const cleaned = rnc.replace(/-/g, '').trim();
    if (cleaned.length < 9) { setRncError('El RNC debe tener al menos 9 dígitos'); return; }
    setRncValidating(true);
    setRncError('');
    setRncBusiness('');
    try {
      const res = await apiClient.validateRnc(cleaned);
      const name: string = (res.data as any)?.businessName ?? (res.data as any)?.nombre ?? '';
      if (!name) { setRncError('RNC no encontrado'); return; }
      setRncBusiness(name);
      toast.success(`RNC válido: ${name}`);
    } catch {
      setRncError('RNC no encontrado en la DGII');
    } finally {
      setRncValidating(false);
    }
  };

  const handleRequestBill = async () => {
    if (!order || orderTotal <= 0) return;

    if (needsReceipt && !rncBusiness) {
      toast.error('Valida el RNC antes de continuar');
      return;
    }

    setProcessing(true);
    try {
      const tipAmt = activeTipAmount();
      const tipPct = tipPercentage > 0
        ? tipPercentage
        : (customTip && orderTotal > 0 ? (parseFloat(customTip) / orderTotal) * 100 : 0);

      await apiClient.requestBilling(orderId!, {
        paymentMethod:         selectedMethod,
        tipPercentage:         tipPct,
        tipAmount:             tipAmt,
        requiresFiscalReceipt: needsReceipt,
        rnc:                   needsReceipt ? rnc.replace(/-/g, '').trim() : undefined,
        businessName:          needsReceipt ? rncBusiness : undefined,
      });

      setStage('waiting');
      toast.success('¡Solicitud enviada! El mesero procesará tu pago.');
    } catch (error: any) {
      const msg = error?.response?.data?.error ?? error?.message ?? 'Error al solicitar cuenta';
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
          <button onClick={() => router.push('/menu')} className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
            Volver al Menú
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'paid') {
    const r = receipt;
    const orderNum = r?.orderNumber ?? (order as any).orderNumber ?? (order as any).OrderNumber;
    const tableNum = r?.tableNumber ?? (order as any).tableId;
    const paidAt = r?.paidAt ? new Date(r.paidAt) : new Date();
    const totalFinal = r ? Number(r.total) : orderTotal;
    const tipFinal = r ? Number(r.tipExtra ?? 0) : 0;
    const methods = r?.methods ?? [selectedMethod];
    const fiscal = r?.requiresFiscalReceipt && r?.rnc;
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">¡Pago Completado!</h1>
            <p className="text-gray-500 text-sm mt-1">Gracias por tu preferencia</p>
          </div>

          <div className="bg-gray-50 rounded-xl p-5 mb-4 space-y-2 text-sm">
            <div className="flex justify-between text-gray-700"><span>Comprobante</span><span className="font-bold">#{orderNum}</span></div>
            {tableNum && <div className="flex justify-between text-gray-700"><span>Mesa</span><span>{tableNum}</span></div>}
            <div className="flex justify-between text-gray-700"><span>Fecha</span><span>{paidAt.toLocaleString('es-DO', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}</span></div>
            <div className="flex justify-between text-gray-700"><span>Método</span><span>{methods.join(', ')}</span></div>
          </div>

          {r?.items && r.items.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-5 mb-4 space-y-1.5 text-sm">
              <div className="font-semibold text-gray-800 mb-2">Detalle</div>
              {r.items.map((it: any, idx: number) => (
                <div key={idx} className="flex justify-between text-gray-600">
                  <span>{it.quantity}× {it.dishName}</span>
                  <span>RD$ {Number(it.subtotal).toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between text-gray-600 pt-2 border-t border-gray-200"><span>ITBIS</span><span>RD$ {Number(r.tax).toFixed(2)}</span></div>
              <div className="flex justify-between text-gray-600"><span>Propina legal</span><span>RD$ {Number(r.tipLegal).toFixed(2)}</span></div>
              {tipFinal > 0 && <div className="flex justify-between text-emerald-700"><span>Propina adicional</span><span>RD$ {tipFinal.toFixed(2)}</span></div>}
            </div>
          )}

          <div className="bg-primary-50 rounded-xl p-4 mb-4 flex justify-between items-center">
            <span className="text-gray-700 font-semibold">Total pagado</span>
            <span className="text-2xl font-bold text-primary-600">RD$ {totalFinal.toFixed(2)}</span>
          </div>

          {fiscal && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-4 text-sm">
              <div className="font-semibold text-indigo-900 mb-1">Comprobante Fiscal Emitido</div>
              <div className="text-indigo-700">RNC: {r.rnc}</div>
              <div className="text-indigo-700">A nombre de: {r.businessName}</div>
            </div>
          )}

          <button
            onClick={() => router.push('/menu')}
            className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-colors"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'waiting') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-11 h-11 text-amber-500 animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">¡Solicitud Enviada!</h1>
          <p className="text-gray-600 mb-6">El mesero procesará tu pago en breve</p>
          <div className="bg-gray-50 rounded-xl p-5 mb-6 space-y-3 text-left">
            <div className="flex justify-between text-gray-700">
              <span>Pedido</span>
              <span className="font-bold">#{(String((order as any).orderNumber ?? (order as any).OrderNumber ?? '')).split('-').pop()?.toUpperCase()}</span>
            </div>
            <div className="flex justify-between text-gray-700">
              <span>Total</span>
              <span className="font-bold text-primary-600">RD$ {orderTotal.toFixed(2)}</span>
            </div>
            {activeTipAmount() > 0 && (
              <div className="flex justify-between text-green-700">
                <span>Propina</span>
                <span className="font-bold">RD$ {activeTipAmount().toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-700">
              <span>Método</span>
              <span className="font-semibold">{paymentMethods.find(m => m.id === selectedMethod)?.name ?? selectedMethod}</span>
            </div>
            {needsReceipt && rncBusiness && (
              <div className="flex justify-between text-indigo-700 pt-1 border-t border-gray-200">
                <span>Comprobante</span>
                <span className="font-semibold text-right text-sm">{rncBusiness}</span>
              </div>
            )}
          </div>
          <div className="flex items-center justify-center gap-2">
            {[0, 150, 300].map(delay => (
              <span key={delay} className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: `${delay}ms` }} />
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">Esperando confirmación del mesero...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">

        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center">Solicitar Cuenta</h1>
          <p className="text-gray-600 text-center">Pedido #{(String((order as any).orderNumber ?? (order as any).OrderNumber ?? '')).split('-').pop()?.toUpperCase()}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Resumen</h2>
          <div className="space-y-3 mb-6">
            {order.items?.map((item: any, idx: number) => {
              const sub = Number(item.subtotal ?? item.Subtotal ?? 0);
              return (
                <div key={item.id ?? idx} className="flex justify-between text-gray-700">
                  <span>{item.quantity}x {item.dishName ?? item.DishName}</span>
                  <span>RD$ {sub.toFixed(2)}</span>
                </div>
              );
            })}
          </div>
          <div className="border-t-2 border-gray-200 pt-4 space-y-2">
            <div className="flex justify-between text-gray-700"><span>Subtotal</span><span>RD$ {orderSubtotal.toFixed(2)}</span></div>
            <div className="flex justify-between text-gray-700"><span>ITBIS (18%)</span><span>RD$ {orderTax.toFixed(2)}</span></div>
            <div className="flex justify-between text-xl font-bold text-gray-900 pt-2 border-t border-gray-200">
              <span>Total</span>
              <span className="text-primary-600">RD$ {orderTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">¿Deseas dejar propina?</h2>
          <div className="grid grid-cols-4 gap-3 mb-4">
            {[{pct:10,label:'10%'},{pct:15,label:'15%'},{pct:20,label:'20%'},{pct:0,label:'Sin'}].map(({pct,label}) => (
              <button key={label} onClick={() => { setTipPercentage(pct); setCustomTip(''); }}
                className={`px-4 py-3 text-gray-900 rounded-lg border-2 font-semibold transition-all ${
                  tipPercentage === pct && !customTip ? 'border-primary-600 bg-primary-50 text-primary-600' : 'border-gray-200 hover:border-gray-300'
                }`}>
                {label}
              </button>
            ))}
          </div>
          <input type="number" placeholder="O ingresa un monto personalizado..."
            value={customTip} onChange={(e) => { setCustomTip(e.target.value); setTipPercentage(0); }}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-primary-600" />
          {activeTipAmount() > 0 && (
            <div className="mt-4 p-4 bg-green-50 rounded-lg">
              <div className="flex justify-between text-green-800 font-semibold">
                <span>Propina:</span><span>RD$ {activeTipAmount().toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-green-900 mt-2 pt-2 border-t border-green-200">
                <span>Total con propina:</span><span>RD$ {totalWithTip().toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Método de Pago</h2>
          <p className="text-sm text-gray-500 mb-4">El mesero realizará el cobro según el método que elijas</p>
          <div className="grid grid-cols-2 gap-4">
            {paymentMethods.map((method) => {
              const Icon = method.icon;
              const isSelected = selectedMethod === method.id;
              return (
                <button key={method.id} onClick={() => setSelectedMethod(method.id)}
                  className={`p-5 rounded-xl border-2 transition-all ${isSelected ? 'border-primary-600 bg-primary-50 shadow-lg' : 'border-gray-200 hover:border-gray-300 hover:shadow-md'}`}>
                  <Icon className={`w-10 h-10 mx-auto mb-2 ${isSelected ? 'text-primary-600' : 'text-gray-400'}`} />
                  <p className={`font-semibold text-sm ${isSelected ? 'text-primary-600' : 'text-gray-700'}`}>{method.name}</p>
                  {method.id === 'Mixed' && <p className="text-xs text-gray-500 mt-1">Efectivo + Tarjeta</p>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-gray-600" />
              <h2 className="text-xl font-bold text-gray-900">Comprobante Fiscal</h2>
            </div>
            <span className="text-sm text-gray-500">Opcional</span>
          </div>

          <div className="flex gap-3 mb-4">
            <button
              onClick={() => { setNeedsReceipt(false); setRnc(''); setRncBusiness(''); setRncError(''); }}
              className={`flex-1 py-3 rounded-xl border-2 font-semibold transition-all text-sm ${
                !needsReceipt ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              No necesito
            </button>
            <button
              onClick={() => setNeedsReceipt(true)}
              className={`flex-1 py-3 rounded-xl border-2 font-semibold transition-all text-sm ${
                needsReceipt ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              Sí, necesito comprobante
            </button>
          </div>

          {needsReceipt && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">Ingresa el RNC de tu empresa para validarlo con la DGII</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ej. 1-31-12345-6"
                  value={rnc}
                  onChange={(e) => { setRnc(e.target.value); setRncBusiness(''); setRncError(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') validateRnc(); }}
                  maxLength={13}
                  className={`flex-1 px-4 py-3 border-2 rounded-lg focus:outline-none text-gray-900 transition-colors ${
                    rncBusiness ? 'border-green-500 bg-green-50' : rncError ? 'border-red-400' : 'border-gray-200 focus:border-primary-600'
                  }`}
                />
                <button
                  onClick={validateRnc}
                  disabled={rncValidating || rnc.replace(/-/g,'').trim().length < 9}
                  className="px-5 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
                >
                  {rncValidating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {rncValidating ? 'Validando...' : 'Validar'}
                </button>
              </div>

              {rncError && (
                <p className="text-sm text-red-600 flex items-center gap-1">
                  <span>⚠</span> {rncError}
                </p>
              )}

              {rncBusiness && (
                <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <Building2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-green-600 font-medium">Empresa verificada</p>
                    <p className="text-green-800 font-bold">{rncBusiness}</p>
                    <p className="text-xs text-green-600">RNC: {rnc}</p>
                  </div>
                  <CheckCircle className="w-5 h-5 text-green-500 ml-auto shrink-0" />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-4">
          <button onClick={() => router.back()}
            className="flex-1 px-6 py-4 bg-white text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors shadow-lg">
            Cancelar
          </button>
          <button
            onClick={handleRequestBill}
            disabled={processing || (needsReceipt && !rncBusiness)}
            title={needsReceipt && !rncBusiness ? 'Valida el RNC primero' : ''}
            className="flex-1 px-6 py-4 bg-gradient-to-r from-primary-600 to-secondary-600 text-white rounded-xl font-semibold hover:from-primary-700 hover:to-secondary-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? 'Enviando...' : 'Solicitar Cuenta'}
          </button>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          * El mesero se acercará para procesar tu pago
        </p>
      </div>
    </div>
  );
}
