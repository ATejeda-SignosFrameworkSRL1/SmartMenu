'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  LogOut, RefreshCw, X, Building2, CheckCircle2,
  DollarSign, CreditCard, ArrowRightLeft, Layers, Receipt,
  AlertCircle, Loader2, ShoppingCart, Plus, Minus, Trash2,
  ShoppingBag, BarChart3, Search, User, Radio
} from 'lucide-react';
import * as signalR from '@microsoft/signalr';
import { useTranslations, useLocale } from 'next-intl';
import { createAuthApi, ensureFreshToken } from '@/lib/auth-client';
import { dateLocale } from '@/i18n/config';
import LanguageSwitcher from '@/components/LanguageSwitcher';

// F3 — auth-client centralizado reemplaza el interceptor JWT inline
// (refresh transparente con singleton lock, mismo prefijo cashier_*).
const { api } = createAuthApi('cashier');

// ─── Helpers ────────────────────────────────────────────────────────────────

// Color por método; la etiqueta se traduce vía cashier.method.<lower>.
const METHOD_COLORS: Record<string, string> = {
  Cash: 'bg-green-100 text-green-700',
  Card: 'bg-blue-100 text-blue-700',
  Transfer: 'bg-purple-100 text-purple-700',
  Mixed: 'bg-orange-100 text-orange-700',
};
function fmt(n: number) {
  return n.toLocaleString('es-DO', { minimumFractionDigits: 2 });
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface Summary {
  totalAmount: number; totalTips: number; totalWithTips: number; count: number;
  byCash: number; byCard: number; byTransfer: number; byMixed: number; fiscalCount: number;
}
interface Payment {
  id: number; orderId: number; orderNumber: string; tableNumber: number;
  method: string; amount: number; tipAmount: number; totalAmount: number;
  completedAt: string | null; requiresFiscalReceipt: boolean;
  rnc: string | null; businessName: string | null; waiterName: string | null;
}
interface Dish {
  id: number; name: string; description: string; price: number;
  categoryId: number; categoryName: string; imageUrl: string | null; isAvailable: boolean;
}
interface CartItem {
  dish: Dish; quantity: number; notes: string;
}

// ─── Caja del Día ────────────────────────────────────────────────────────────

function CajaTab({ user }: { user: any }) {
  const t = useTranslations('cashier');
  const dl = dateLocale(useLocale());
  const [summary, setSummary] = useState<Summary | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [liveConnected, setLiveConnected] = useState(false);
  const reloadRef = useRef<(() => void) | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fiscal modal
  const [showFiscalModal, setShowFiscalModal] = useState(false);
  const [fiscalPaymentId, setFiscalPaymentId] = useState<number | null>(null);
  const [fiscalRnc, setFiscalRnc] = useState('');
  const [fiscalBusinessName, setFiscalBusinessName] = useState('');
  const [fiscalValidated, setFiscalValidated] = useState(false);
  const [fiscalValidating, setFiscalValidating] = useState(false);
  const [fiscalSaving, setFiscalSaving] = useState(false);
  const [fiscalError, setFiscalError] = useState('');

  const loadPayments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/payment/list', {
        params: {
          from: new Date(date + 'T00:00:00').toISOString(),
          to: new Date(date + 'T23:59:59').toISOString(),
        },
      });
      setSummary(res.data?.summary ?? null);
      setPayments(Array.isArray(res.data?.payments) ? res.data.payments : []);
    } catch {
      setSummary(null); setPayments([]);
    } finally { setLoading(false); }
  }, [date]);

  useEffect(() => { loadPayments(); }, [loadPayments]);

  // Mantén una referencia mutable al último loadPayments para que el listener
  // de SignalR (registrado una sola vez) siempre llame la versión más reciente.
  useEffect(() => { reloadRef.current = loadPayments; }, [loadPayments]);

  // S5.1 — SignalR: refresca caja en vivo sin polling.
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('cashier_token') : null;
    if (!token) return;

    const hubUrl = typeof window !== 'undefined' ? `${window.location.origin}/hubs/orders` : '/hubs/orders';
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        // Token fresco por llamada (resiliencia ante rotación de token con la pestaña abierta).
        accessTokenFactory: () => ensureFreshToken('cashier'),
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    const triggerReload = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => { reloadRef.current?.(); }, 400);
    };

    connection.on('PaymentRegistered', triggerReload);
    connection.on('OrderCompleted', triggerReload);
    connection.onreconnected(() => setLiveConnected(true));
    connection.onclose(() => setLiveConnected(false));

    let cancelled = false;
    (async () => {
      const delays = [0, 2000, 4000, 8000];
      for (let i = 0; i < delays.length && !cancelled; i++) {
        if (delays[i] > 0) await new Promise(r => setTimeout(r, delays[i]));
        if (cancelled) return;
        try { await connection.start(); setLiveConnected(true); return; }
        catch { setLiveConnected(false); }
      }
    })();

    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      connection.stop().catch(() => {});
      setLiveConnected(false);
    };
  }, []);

  const openFiscalModal = (id: number) => {
    setFiscalPaymentId(id); setFiscalRnc(''); setFiscalBusinessName('');
    setFiscalValidated(false); setFiscalError(''); setShowFiscalModal(true);
  };

  const validateRnc = async () => {
    if (!fiscalRnc || fiscalRnc.length < 9) return;
    setFiscalValidating(true); setFiscalError(''); setFiscalValidated(false);
    try {
      const res = await api.get(`/api/payment/validate-rnc/${fiscalRnc}`);
      setFiscalBusinessName(res.data.businessName ?? ''); setFiscalValidated(true);
    } catch (err: any) {
      setFiscalError(err?.response?.data?.error ?? t('rncNotFound'));
    } finally { setFiscalValidating(false); }
  };

  const saveFiscalReceipt = async () => {
    if (!fiscalValidated || !fiscalPaymentId) return;
    setFiscalSaving(true);
    try {
      await api.patch(`/api/payment/${fiscalPaymentId}/fiscal`, { rnc: fiscalRnc, businessName: fiscalBusinessName });
      setShowFiscalModal(false);
      setPayments(prev => prev.map(p =>
        p.id === fiscalPaymentId ? { ...p, requiresFiscalReceipt: true, rnc: fiscalRnc, businessName: fiscalBusinessName } : p
      ));
      if (summary) setSummary({ ...summary, fiscalCount: summary.fiscalCount + 1 });
    } catch { setFiscalError(t('saveError')); }
    finally { setFiscalSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-3 items-center">
        <input type="date" value={date}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDate(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        <button onClick={loadPayments} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 text-sm font-medium">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} {t('refresh')}
        </button>
        <span title={liveConnected ? t('liveOn') : t('liveOff')}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${liveConnected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          <Radio className={`w-3.5 h-3.5 ${liveConnected ? 'animate-pulse' : ''}`} />
          {liveConnected ? t('live') : t('offline')}
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
        </div>
      ) : (
        <>
          {/* Resumen */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 col-span-2 md:col-span-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{t('totalDay')}</p>
              <p className="text-2xl font-bold text-gray-900">RD$ {fmt(summary?.totalWithTips ?? 0)}</p>
              <p className="text-xs text-gray-400 mt-1">{t('transactions', { count: summary?.count ?? 0 })}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{t('tips')}</p>
              <p className="text-xl font-bold text-blue-600">RD$ {fmt(summary?.totalTips ?? 0)}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{t('netSales')}</p>
              <p className="text-xl font-bold text-green-600">RD$ {fmt(summary?.totalAmount ?? 0)}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{t('withNcf')}</p>
              <div className="flex items-end gap-2">
                <p className="text-xl font-bold text-purple-600">{summary?.fiscalCount ?? 0}</p>
                <p className="text-xs text-gray-400 mb-0.5">{t('ofCount', { count: summary?.count ?? 0 })}</p>
              </div>
            </div>
          </div>

          {/* Desglose por método */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">{t('byMethod')}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { mk: 'cash', key: 'byCash', icon: DollarSign, color: 'bg-green-50 text-green-600 bg-green-100' },
                { mk: 'card', key: 'byCard', icon: CreditCard, color: 'bg-blue-50 text-blue-600 bg-blue-100' },
                { mk: 'transfer', key: 'byTransfer', icon: ArrowRightLeft, color: 'bg-purple-50 text-purple-600 bg-purple-100' },
                { mk: 'mixed', key: 'byMixed', icon: Layers, color: 'bg-orange-50 text-orange-600 bg-orange-100' },
              ].map(({ mk, key, icon: Icon, color }) => {
                const [bg, tc, ibg] = color.split(' ');
                return (
                  <div key={key} className={`flex items-center gap-3 p-3 ${bg} rounded-xl`}>
                    <div className={`w-9 h-9 ${ibg} rounded-lg flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 ${tc}`} />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-medium">{t(`method.${mk}`)}</p>
                      <p className={`text-base font-bold ${tc}`}>RD$ {fmt((summary as any)?.[key] ?? 0)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tabla */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-900">{t('dayMovements')}</h2>
              <span className="text-xs text-gray-400">{t('records', { count: payments.length })}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {[t('th.time'), t('th.order'), t('th.table'), t('th.waiter'), t('th.method'), t('th.amount'), t('th.tip'), t('th.total'), t('th.ncf')].map((h, i) => (
                      <th key={i} className={`px-4 py-3 font-semibold text-gray-600 ${i >= 5 ? 'text-right' : i === 8 ? 'text-center' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-500">
                        {p.completedAt ? new Date(p.completedAt).toLocaleTimeString(dl, { hour: 'numeric', minute: '2-digit', hour12: true }) : '-'}
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-700">{p.orderNumber ? t('orderNumber', { code: (p.orderNumber.split('-').pop() ?? '').toUpperCase() }) : '-'}</td>
                      <td className="px-4 py-3 font-medium">{p.tableNumber || t('counter')}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{p.waiterName || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${METHOD_COLORS[p.method] ?? 'bg-gray-100 text-gray-600'}`}>
                          {t(`method.${(p.method ?? '').toLowerCase()}`)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">RD$ {fmt(p.amount)}</td>
                      <td className="px-4 py-3 text-right text-blue-600">
                        {p.tipAmount > 0 ? `RD$ ${fmt(p.tipAmount)}` : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">RD$ {fmt(p.totalAmount)}</td>
                      <td className="px-4 py-3 text-center">
                        {p.requiresFiscalReceipt ? (
                          <span title={p.businessName ?? ''} className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold cursor-default">
                            <CheckCircle2 className="w-3 h-3" /> {p.rnc}
                          </span>
                        ) : (
                          <button onClick={() => openFiscalModal(p.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-gray-200 hover:border-blue-300">
                            <Receipt className="w-3 h-3" /> NCF
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {payments.length === 0 && <p className="px-6 py-10 text-gray-400 text-center text-sm">{t('noPayments')}</p>}
          </div>
        </>
      )}

      {/* Modal NCF */}
      {showFiscalModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-gray-900 px-6 py-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">{t('fiscalReceipt')}</p>
                <h2 className="text-lg font-bold text-white">{t('addNcfTitle')}</h2>
              </div>
              <button onClick={() => setShowFiscalModal(false)} className="p-2 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('companyRnc')}</label>
                <div className="flex gap-2">
                  <input type="text" value={fiscalRnc}
                    onChange={(e) => { setFiscalRnc(e.target.value.replace(/\D/g, '')); setFiscalValidated(false); setFiscalError(''); }}
                    placeholder={t('rncPlaceholder')} maxLength={11}
                    className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                  <button onClick={validateRnc} disabled={fiscalRnc.length < 9 || fiscalValidating}
                    className="px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 text-sm font-semibold min-w-[90px]">
                    {fiscalValidating ? <span className="flex items-center gap-1.5 justify-center"><Loader2 className="w-4 h-4 animate-spin" /></span> : t('validate')}
                  </button>
                </div>
              </div>
              {fiscalError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {fiscalError}
                </div>
              )}
              {fiscalValidated && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-semibold text-green-700">{t('companyFound')}</span>
                  </div>
                  <p className="text-sm text-green-800 font-medium">{fiscalBusinessName}</p>
                  <p className="text-xs text-green-600 mt-0.5">RNC: {fiscalRnc}</p>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowFiscalModal(false)} className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 text-sm font-semibold">{t('cancel')}</button>
                <button onClick={saveFiscalReceipt} disabled={!fiscalValidated || fiscalSaving}
                  className="flex-1 px-4 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 text-sm font-semibold">
                  {fiscalSaving ? <span className="flex items-center gap-1.5 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> {t('saving')}</span> : t('saveNcf')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Nueva Venta (POS) ────────────────────────────────────────────────────────

function NuevaVentaTab({ user }: { user: any }) {
  const t = useTranslations('cashier');
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');

  // Pago
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [tipAmount, setTipAmount] = useState(0);
  const [tipPct, setTipPct] = useState(0);
  const [requiresFiscal, setRequiresFiscal] = useState(false);
  const [fiscalRnc, setFiscalRnc] = useState('');
  const [fiscalBusinessName, setFiscalBusinessName] = useState('');
  const [fiscalValidated, setFiscalValidated] = useState(false);
  const [fiscalValidating, setFiscalValidating] = useState(false);
  const [fiscalError, setFiscalError] = useState('');

  // Mixto
  const [subPayments, setSubPayments] = useState([
    { method: 'Cash', amount: 0, tipAmount: 0 },
    { method: 'Card', amount: 0, tipAmount: 0 },
  ]);

  const [processing, setProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    api.get('/api/dish').then(r => {
      setDishes(Array.isArray(r.data) ? r.data : []);
    }).catch(() => {}).finally(() => setLoadingMenu(false));
  }, []);

  const categories = Array.from(new Set(dishes.map(d => d.categoryName))).sort();

  const filtered = dishes.filter(d =>
    d.isAvailable &&
    (selectedCategory === '' || d.categoryName === selectedCategory) &&
    (search === '' || d.name.toLowerCase().includes(search.toLowerCase()))
  );

  const addToCart = (dish: Dish) => {
    setCart(prev => {
      const existing = prev.find(c => c.dish.id === dish.id);
      if (existing) return prev.map(c => c.dish.id === dish.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { dish, quantity: 1, notes: '' }];
    });
  };

  const updateQty = (dishId: number, delta: number) => {
    setCart(prev => prev
      .map(c => c.dish.id === dishId ? { ...c, quantity: c.quantity + delta } : c)
      .filter(c => c.quantity > 0)
    );
  };

  const removeItem = (dishId: number) => setCart(prev => prev.filter(c => c.dish.id !== dishId));

  const subtotal = cart.reduce((s, c) => s + c.dish.price * c.quantity, 0);
  const tax = subtotal * 0.18;
  const legalTip = subtotal * 0.10;
  const orderTotal = subtotal + tax + legalTip;

  const applyTipPct = (pct: number) => {
    setTipPct(pct);
    setTipAmount(pct > 0 ? orderTotal * (pct / 100) : 0);
  };

  const validateRnc = async () => {
    if (!fiscalRnc || fiscalRnc.length < 9) return;
    setFiscalValidating(true); setFiscalError(''); setFiscalValidated(false);
    try {
      const res = await api.get(`/api/payment/validate-rnc/${fiscalRnc}`);
      setFiscalBusinessName(res.data.businessName ?? ''); setFiscalValidated(true);
    } catch (err: any) {
      setFiscalError(err?.response?.data?.error ?? t('rncNotFound'));
    } finally { setFiscalValidating(false); }
  };

  const submitSale = async () => {
    if (cart.length === 0) { setErrorMsg(t('cartEmptyError')); return; }
    if (requiresFiscal && !fiscalValidated) { setErrorMsg(t('validateRncFirst')); return; }
    setProcessing(true); setErrorMsg(''); setSuccessMsg('');
    try {
      const items = cart.map(c => ({
        dishId: c.dish.id,
        quantity: c.quantity,
        unitPrice: c.dish.price,
        notes: c.notes || null,
      }));

      const body: any = {
        customerName: customerName || 'Cliente mostrador',
        items,
        cashierId: user?.id,
        paymentMethod: paymentMethod !== 'Mixed' ? paymentMethod : undefined,
        amount: orderTotal,
        tipAmount,
        requiresFiscalReceipt: requiresFiscal,
        rnc: requiresFiscal ? fiscalRnc : null,
        businessName: requiresFiscal ? fiscalBusinessName : null,
      };

      if (paymentMethod === 'Mixed') {
        body.subPayments = subPayments.filter(s => s.amount > 0);
      }

      const res = await api.post('/api/order/pos', body);
      setSuccessMsg(t('saleRegistered', {
        code: (String(res.data.orderNumber ?? '').split('-').pop() ?? '').toUpperCase(),
        total: fmt(res.data.paid),
      }));
      setCart([]); setCustomerName(''); setTipAmount(0); setTipPct(0);
      setRequiresFiscal(false); setFiscalRnc(''); setFiscalBusinessName(''); setFiscalValidated(false);
      setPaymentMethod('Cash');
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.error ?? t('saleError'));
    } finally { setProcessing(false); }
  };

  const cartCount = cart.reduce((s, c) => s + c.quantity, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* ── Menú ── */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchDish')}
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {/* Categorías */}
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setSelectedCategory('')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${selectedCategory === '' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {t('allCategories')}
          </button>
          {categories.map(cat => (
            <button key={cat} onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${selectedCategory === cat ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {cat}
            </button>
          ))}
        </div>

        {loadingMenu ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-gray-300" /></div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filtered.map(dish => {
              const inCart = cart.find(c => c.dish.id === dish.id);
              return (
                <button key={dish.id} onClick={() => addToCart(dish)}
                  className={`relative text-left bg-white border rounded-xl p-3 hover:shadow-md transition-all ${inCart ? 'border-blue-400 bg-blue-50' : 'border-gray-100 hover:border-gray-300'}`}>
                  {inCart && (
                    <span className="absolute top-2 right-2 w-5 h-5 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-bold">
                      {inCart.quantity}
                    </span>
                  )}
                  <p className="font-semibold text-gray-900 text-sm leading-tight pr-5">{dish.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{dish.categoryName}</p>
                  <p className="text-sm font-bold text-green-700 mt-2">RD$ {fmt(dish.price)}</p>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="col-span-3 text-center py-8 text-gray-400 text-sm">{t('noDishes')}</p>
            )}
          </div>
        )}
      </div>

      {/* ── Carrito + Pago ── */}
      <div className="space-y-4">
        {/* Carrito */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="bg-gray-900 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white font-semibold text-sm">
              <ShoppingCart className="w-4 h-4" /> {t('cartTitle', { count: cartCount })}
            </div>
            {cart.length > 0 && (
              <button onClick={() => setCart([])} className="text-gray-400 hover:text-red-400 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="p-3">
            {/* Cliente */}
            <div className="flex items-center gap-2 mb-3">
              <User className="w-4 h-4 text-gray-400 shrink-0" />
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)}
                placeholder={t('customerNamePlaceholder')}
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>

            {cart.length === 0 ? (
              <p className="text-center text-gray-400 text-xs py-6">{t('addProducts')}</p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {cart.map(c => (
                  <div key={c.dish.id} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">{c.dish.name}</p>
                      <p className="text-xs text-gray-500">RD$ {fmt(c.dish.price)} {t('each')}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => updateQty(c.dish.id, -1)} className="w-6 h-6 rounded-full bg-gray-200 hover:bg-red-100 flex items-center justify-center">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-5 text-center text-xs font-bold">{c.quantity}</span>
                      <button onClick={() => updateQty(c.dish.id, 1)} className="w-6 h-6 rounded-full bg-gray-200 hover:bg-green-100 flex items-center justify-center">
                        <Plus className="w-3 h-3" />
                      </button>
                      <button onClick={() => removeItem(c.dish.id)} className="w-6 h-6 ml-1 rounded-full hover:bg-red-100 flex items-center justify-center text-gray-400 hover:text-red-500">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Totales */}
        {cart.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-4">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-500"><span>{t('subtotal')}</span><span>RD$ {fmt(subtotal)}</span></div>
              <div className="flex justify-between text-gray-500"><span>{t('itbis')}</span><span>RD$ {fmt(tax)}</span></div>
              <div className="flex justify-between text-gray-500"><span>{t('legalTip')}</span><span>RD$ {fmt(legalTip)}</span></div>
              <div className="flex justify-between font-bold text-gray-900 text-base border-t pt-1.5"><span>{t('total')}</span><span>RD$ {fmt(orderTotal)}</span></div>
            </div>

            {/* Propina extra */}
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2">{t('additionalTip')}</p>
              <div className="flex gap-2 flex-wrap">
                {[0, 5, 10, 15].map(pct => (
                  <button key={pct} onClick={() => applyTipPct(pct)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${tipPct === pct ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:border-blue-400'}`}>
                    {pct === 0 ? t('noTip') : `${pct}%`}
                  </button>
                ))}
              </div>
              {tipAmount > 0 && <p className="text-xs text-blue-600 mt-1">{t('tipAdded', { amount: fmt(tipAmount) })}</p>}
            </div>

            {/* Método de pago */}
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2">{t('paymentMethod')}</p>
              <div className="grid grid-cols-2 gap-2">
                {['Cash', 'Card', 'Transfer', 'Mixed'].map(m => (
                  <button key={m} onClick={() => setPaymentMethod(m)}
                    className={`py-2 rounded-xl text-xs font-semibold border transition-colors ${paymentMethod === m ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                    {t(`method.${m.toLowerCase()}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Subpagos si es Mixto */}
            {paymentMethod === 'Mixed' && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-600">{t('mixedBreakdown')}</p>
                {subPayments.map((sp, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <select value={sp.method} onChange={e => setSubPayments(prev => prev.map((s, j) => j === i ? { ...s, method: e.target.value } : s))}
                      className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs">
                      {['Cash', 'Card', 'Transfer'].map(m => <option key={m} value={m}>{t(`method.${m.toLowerCase()}`)}</option>)}
                    </select>
                    <input type="number" min={0} value={sp.amount || ''} onChange={e => setSubPayments(prev => prev.map((s, j) => j === i ? { ...s, amount: Number(e.target.value) } : s))}
                      placeholder={t('amount')}
                      className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs" />
                  </div>
                ))}
              </div>
            )}

            {/* Comprobante fiscal */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={requiresFiscal} onChange={e => setRequiresFiscal(e.target.checked)}
                  className="w-4 h-4 rounded" />
                <span className="text-xs font-semibold text-gray-700">{t('requiresFiscal')}</span>
              </label>
              {requiresFiscal && (
                <div className="mt-2 space-y-2">
                  <div className="flex gap-2">
                    <input type="text" value={fiscalRnc}
                      onChange={(e) => { setFiscalRnc(e.target.value.replace(/\D/g, '')); setFiscalValidated(false); setFiscalError(''); }}
                      placeholder={t('companyRnc')} maxLength={11}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <button onClick={validateRnc} disabled={fiscalRnc.length < 9 || fiscalValidating}
                      className="px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold disabled:opacity-50">
                      {fiscalValidating ? <Loader2 className="w-3 h-3 animate-spin" /> : t('validate')}
                    </button>
                  </div>
                  {fiscalError && <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{fiscalError}</p>}
                  {fiscalValidated && (
                    <div className="p-2 bg-green-50 rounded-lg border border-green-200">
                      <p className="text-xs font-semibold text-green-700">{fiscalBusinessName}</p>
                      <p className="text-xs text-green-500">RNC: {fiscalRnc}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Total final */}
            <div className="bg-gray-900 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-400">{t('totalToCharge')}</p>
              <p className="text-2xl font-bold text-white">RD$ {fmt(orderTotal + tipAmount)}</p>
            </div>

            {errorMsg && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
                <AlertCircle className="w-3 h-3 shrink-0" /> {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-700">
                <CheckCircle2 className="w-3 h-3 shrink-0" /> {successMsg}
              </div>
            )}

            <button onClick={submitSale} disabled={processing || cart.length === 0}
              className="w-full py-3.5 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors">
              {processing ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('processing')}</> : <><ShoppingBag className="w-4 h-4" /> {t('confirmSale')}</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── App principal ────────────────────────────────────────────────────────────

function CashierView({ user, onLogout }: { user: any; onLogout: () => void }) {
  const t = useTranslations('cashier');
  const [activeTab, setActiveTab] = useState<'caja' | 'pos'>('caja');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
            <p className="text-sm text-gray-500">
              {user?.firstName ?? user?.name} {user?.lastName ?? ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Tabs */}
            <div className="flex bg-gray-100 rounded-xl p-1">
              <button onClick={() => setActiveTab('caja')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'caja' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                <BarChart3 className="w-4 h-4" /> {t('cajaTab')}
              </button>
              <button onClick={() => setActiveTab('pos')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'pos' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                <ShoppingBag className="w-4 h-4" /> {t('posTab')}
              </button>
            </div>
            <LanguageSwitcher />
            <button onClick={onLogout}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium">
              <LogOut className="w-4 h-4" /> {t('logout')}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'caja' ? <CajaTab user={user} /> : <NuevaVentaTab user={user} />}
      </div>
    </div>
  );
}

export default function CashierApp() {
  const t = useTranslations('cashier');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    const userFromUrl = urlParams.get('user');
    if (tokenFromUrl && userFromUrl) {
      localStorage.setItem('cashier_token', tokenFromUrl);
      localStorage.setItem('cashier_user', decodeURIComponent(userFromUrl));
      window.history.replaceState({}, '', window.location.pathname);
    }
    const userData = localStorage.getItem('cashier_user');
    const token = localStorage.getItem('cashier_token');
    if (!userData || !token) {
      window.location.href = '/login';
      return;
    }
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(JSON.parse(userData));
    setLoading(false);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('cashier_token');
    localStorage.removeItem('cashier_user');
    window.location.href = '/login';
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">{t('loading')}</p>
        </div>
      </div>
    );
  }

  return <CashierView user={user} onLogout={handleLogout} />;
}
