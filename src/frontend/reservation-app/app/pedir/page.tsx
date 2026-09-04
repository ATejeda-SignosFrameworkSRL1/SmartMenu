'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import {
  ArrowRight, CheckCircle2, ChevronLeft, Clock, Loader2, Mail, Minus, Phone, Plus,
  ShoppingBag, Trash2, User as UserIcon, UtensilsCrossed, X,
} from 'lucide-react';
import {
  getMenu, createInvoice,
  type MenuDish, type Invoice, type FulfillmentType,
} from '@/lib/order-api';
import { composePhone, DEFAULT_COUNTRY_ISO } from '@/lib/countryCodes';
import PhonePrefixSelect from '@/components/PhonePrefixSelect';
import LanguageSwitcher from '@/components/LanguageSwitcher';

function formatPrice(n: number) {
  return `RD$ ${n.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;
}

const ITBIS_RATE = 0.18;
const LEGAL_TIP_RATE = 0.1;

export default function PedirPage() {
  const t = useTranslations('pedidos');

  const [dishes, setDishes] = useState<MenuDish[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [category, setCategory] = useState<string | null>(null);

  const [cart, setCart] = useState<Record<number, number>>({});
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const [fulfillment, setFulfillment] = useState<FulfillmentType>('Pickup');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [countryIso, setCountryIso] = useState(DEFAULT_COUNTRY_ISO);
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [invoice, setInvoice] = useState<Invoice | null>(null);

  async function loadMenu() {
    setLoading(true);
    setLoadError(false);
    try {
      setDishes(await getMenu());
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMenu();
  }, []);

  const categories = useMemo(() => {
    const out: string[] = [];
    for (const d of dishes) {
      const c = d.categoryName?.trim() || t('otherCategory');
      if (!out.includes(c)) out.push(c);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dishes]);

  const visibleDishes = useMemo(() => {
    if (!category) return dishes;
    return dishes.filter((d) => (d.categoryName?.trim() || t('otherCategory')) === category);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dishes, category]);

  const cartLines = useMemo(
    () =>
      Object.entries(cart)
        .map(([id, qty]) => ({ dish: dishes.find((d) => d.id === Number(id)), qty }))
        .filter((l): l is { dish: MenuDish; qty: number } => !!l.dish && l.qty > 0),
    [cart, dishes],
  );
  const cartCount = useMemo(() => cartLines.reduce((s, l) => s + l.qty, 0), [cartLines]);
  const subTotal = useMemo(() => cartLines.reduce((s, l) => s + l.dish.price * l.qty, 0), [cartLines]);
  const itbis = subTotal * ITBIS_RATE;
  const legalTip = subTotal * LEGAL_TIP_RATE;
  const total = subTotal + itbis + legalTip;

  function addToCart(id: number) {
    setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
  }
  function removeFromCart(id: number) {
    setCart((c) => {
      const qty = (c[id] ?? 0) - 1;
      const next = { ...c };
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });
  }

  async function submit() {
    if (cartLines.length === 0) { toast.error(t('toastEmptyCart')); return; }
    if (!name.trim() || !phone.trim()) { toast.error(t('toastNamePhone')); return; }
    if (fulfillment === 'Delivery' && !address.trim()) { toast.error(t('toastAddress')); return; }
    setSubmitting(true);
    try {
      const inv = await createInvoice({
        customerName: name.trim(),
        customerPhone: composePhone(countryIso, phone),
        customerEmail: email.trim() || undefined,
        fulfillmentType: fulfillment,
        deliveryAddress: fulfillment === 'Delivery' ? address.trim() : undefined,
        notes: notes.trim() || undefined,
        items: cartLines.map((l) => ({ dishId: l.dish.id, quantity: l.qty })),
      });
      setInvoice(inv);
      setCheckoutOpen(false);
      setCart({});
    } catch (e) {
      toast.error((e as Error).message || t('toastCreateFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  function resetAll() {
    setInvoice(null);
    setCheckoutOpen(false);
    setFulfillment('Pickup');
    setName(''); setPhone(''); setCountryIso(DEFAULT_COUNTRY_ISO);
    setEmail(''); setAddress(''); setNotes('');
  }

  if (invoice) {
    return (
      <main className="min-h-screen bg-warm-950 px-4 py-16">
        <div className="mx-auto max-w-lg rounded-3xl border border-primary/20 bg-warm-900/50 p-10 text-center shadow-2xl sm:p-12">
          <CheckCircle2 className="mx-auto h-20 w-20 text-primary-light" />
          <h1 className="mt-6 font-display text-3xl font-bold text-white">{t('successTitle')}</h1>
          <p className="mt-3 text-warm-400">
            {invoice.fulfillmentType === 'Delivery' ? t('successDelivery') : t('successPickup')}
          </p>
          <div className="mt-6 inline-block rounded-xl border border-primary/30 bg-warm-900 px-6 py-4">
            <p className="text-xs uppercase tracking-wide text-warm-500">{t('orderNumber')}</p>
            <p className="font-mono text-3xl font-bold text-primary-light">#{invoice.id}</p>
          </div>
          <div className="mt-6 space-y-1 text-sm text-warm-300">
            <p>
              {t('typeLabel')}{' '}
              <span className="font-semibold text-white">
                {invoice.fulfillmentType === 'Delivery' ? `🛵 ${t('delivery')}` : `🛍️ ${t('pickup')}`}
              </span>
            </p>
            <p>
              {t('totalLabel')}{' '}
              <span className="font-semibold text-primary-light">{formatPrice(invoice.total)}</span>
            </p>
          </div>
          <div className="mt-8 flex flex-col items-center gap-3">
            <button onClick={resetAll} className="btn-primary-lg w-full justify-center">
              {t('newOrder')}
            </button>
            <Link href="/" className="text-sm font-medium text-warm-400 transition-colors hover:text-primary-light">
              {t('backHome')}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-warm-950 pb-32">

      <header className="sticky top-0 z-40 border-b border-warm-800 bg-warm-950/95 backdrop-blur-md">
        <div className="container-narrow flex h-16 items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="-ml-2 flex items-center gap-1 rounded-lg p-2 text-sm font-medium text-warm-300 transition-colors hover:text-primary-light"
          >
            <ChevronLeft className="h-5 w-5" /> {t('back')}
          </Link>
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary-light" />
            <span className="font-display text-lg font-bold text-white">{t('title')}</span>
          </div>
          <LanguageSwitcher />
        </div>
      </header>

      <div className="container-narrow px-4 pt-8 sm:px-6">
        <p className="text-center text-sm text-warm-400">{t('subtitle')}</p>

        {!loading && !loadError && categories.length > 0 && (
          <div className="mt-6 flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label={t('categoriesAria')}>
            <CategoryChip selected={category === null} onClick={() => setCategory(null)} label={t('allCategories')} />
            {categories.map((c) => (
              <CategoryChip key={c} selected={category === c} onClick={() => setCategory(c)} label={c} />
            ))}
          </div>
        )}

        {loading && (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse overflow-hidden rounded-2xl border border-warm-800 bg-warm-900/50">
                <div className="aspect-[4/3] bg-warm-800/60" />
                <div className="p-5">
                  <div className="h-5 w-3/4 rounded bg-warm-800/60" />
                  <div className="mt-3 h-3 w-full rounded bg-warm-800/40" />
                  <div className="mt-2 h-3 w-2/3 rounded bg-warm-800/40" />
                </div>
              </div>
            ))}
          </div>
        )}

        {loadError && !loading && (
          <div className="py-16 text-center">
            <p className="mb-4 text-warm-400">{t('loadFailed')}</p>
            <button onClick={loadMenu} className="btn-primary">{t('retry')}</button>
          </div>
        )}

        {!loading && !loadError && dishes.length === 0 && (
          <p className="py-16 text-center text-warm-400">{t('emptyMenu')}</p>
        )}

        {!loading && !loadError && visibleDishes.length > 0 && (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visibleDishes.map((dish) => {
              const qty = cart[dish.id] ?? 0;
              return (
                <div
                  key={dish.id}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-warm-800 bg-warm-900/50 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-xl"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-warm-800/50">
                    {dish.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={dish.imageUrl}
                        alt={dish.name}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <UtensilsCrossed className="h-14 w-14 text-warm-600" />
                      </div>
                    )}
                    {dish.categoryName && (
                      <span className="absolute left-3 top-3 rounded-full bg-warm-950/70 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                        {dish.categoryName}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-display text-lg font-bold text-white">{dish.name}</h3>
                      <span className="shrink-0 font-semibold text-primary-light">{formatPrice(dish.price)}</span>
                    </div>
                    {dish.description && (
                      <p className="mt-2 line-clamp-2 text-sm text-warm-400">{dish.description}</p>
                    )}
                    {!!dish.preparationTimeMinutes && (
                      <p className="mt-2 flex items-center gap-1 text-xs text-warm-500">
                        <Clock className="h-3.5 w-3.5" /> {t('minutes', { count: dish.preparationTimeMinutes })}
                      </p>
                    )}
                    <div className="mt-auto pt-4">
                      {qty === 0 ? (
                        <button onClick={() => addToCart(dish.id)} className="btn-primary w-full text-sm">
                          <Plus className="h-4 w-4" /> {t('add')}
                        </button>
                      ) : (
                        <div className="flex items-center justify-between rounded-lg border border-primary/40 bg-primary/10 p-1">
                          <button
                            onClick={() => removeFromCart(dish.id)}
                            className="flex h-10 w-10 items-center justify-center rounded-md bg-warm-800 text-white transition-colors hover:bg-warm-700"
                            aria-label={t('removeOne', { name: dish.name })}
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="text-lg font-bold tabular-nums text-white">{qty}</span>
                          <button
                            onClick={() => addToCart(dish.id)}
                            className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-warm-950 transition-colors hover:bg-primary-light"
                            aria-label={t('addOne', { name: dish.name })}
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {cartCount > 0 && !checkoutOpen && (
        <div className="fixed inset-x-0 bottom-0 z-40 p-4">
          <div className="container-narrow">
            <button
              onClick={() => setCheckoutOpen(true)}
              className="btn-primary-lg w-full justify-between shadow-2xl shadow-black/40"
            >
              <span className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5" />
                {t('cartItems', { count: cartCount })}
              </span>
              <span className="flex items-center gap-2">
                {formatPrice(total)} <ArrowRight className="h-5 w-5" />
              </span>
            </button>
          </div>
        </div>
      )}

      {checkoutOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={t('checkoutTitle')}>
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-warm-800 bg-warm-950 p-6 shadow-2xl sm:p-8">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold text-white">{t('checkoutTitle')}</h2>
              <button
                onClick={() => setCheckoutOpen(false)}
                className="rounded-lg p-2 text-warm-300 transition-colors hover:bg-warm-800/60"
                aria-label={t('closeCheckout')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-xl border border-warm-700 bg-warm-800/40 p-1">
              <button
                type="button"
                onClick={() => setFulfillment('Pickup')}
                className={[
                  'flex min-h-[52px] items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold transition',
                  fulfillment === 'Pickup' ? 'bg-primary text-warm-950 shadow' : 'text-warm-300 hover:text-white',
                ].join(' ')}
              >
                🛍️ {t('pickupToggle')}
              </button>
              <button
                type="button"
                onClick={() => setFulfillment('Delivery')}
                className={[
                  'flex min-h-[52px] items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold transition',
                  fulfillment === 'Delivery' ? 'bg-primary text-warm-950 shadow' : 'text-warm-300 hover:text-white',
                ].join(' ')}
              >
                🛵 {t('deliveryToggle')}
              </button>
            </div>

            <div className="mt-6 space-y-2 rounded-xl border border-warm-800 bg-warm-900/50 p-4">
              {cartLines.map((l) => (
                <div key={l.dish.id} className="flex items-center gap-3 text-sm">
                  <span className="w-8 shrink-0 font-bold tabular-nums text-primary-light">{l.qty}×</span>
                  <span className="flex-1 truncate text-warm-200">{l.dish.name}</span>
                  <span className="tabular-nums text-warm-300">{formatPrice(l.dish.price * l.qty)}</span>
                  <button
                    onClick={() => setCart((c) => { const n = { ...c }; delete n[l.dish.id]; return n; })}
                    className="rounded p-1 text-warm-500 transition-colors hover:text-rose-400"
                    aria-label={t('removeLine', { name: l.dish.name })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <div className="space-y-1 border-t border-warm-800 pt-3 text-sm">
                <SummaryRow label={t('subtotal')} value={formatPrice(subTotal)} />
                <SummaryRow label={t('itbis')} value={formatPrice(itbis)} />
                <SummaryRow label={t('legalTip')} value={formatPrice(legalTip)} />
                <div className="flex items-center justify-between pt-1 text-base font-bold">
                  <span className="text-white">{t('totalLabel')}</span>
                  <span className="tabular-nums text-primary-light">{formatPrice(total)}</span>
                </div>
                <p className="pt-1 text-xs text-warm-500">{t('totalsNote')}</p>
              </div>
            </div>

            <div className="mt-6 space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <WarmField icon={<UserIcon className="h-4 w-4" />} label={t('nameLabel')} required>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('namePh')} className="warm-inp" />
                </WarmField>
                <WarmField icon={<Phone className="h-4 w-4" />} label={t('phoneLabel')} required>
                  <div className="flex gap-2">
                    <PhonePrefixSelect value={countryIso} onChange={setCountryIso} variant="warm" />
                    <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder={t('phonePh')} className="warm-inp min-w-0 flex-1" />
                  </div>
                </WarmField>
              </div>
              <WarmField icon={<Mail className="h-4 w-4" />} label={t('emailLabel')}>
                <input value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" placeholder={t('emailPh')} className="warm-inp" />
              </WarmField>
              {fulfillment === 'Delivery' && (
                <WarmField label={t('addressLabel')} required>
                  <textarea rows={3} value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t('addressPh')} className="warm-inp resize-none" />
                </WarmField>
              )}
              <WarmField label={t('notesLabel')}>
                <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('notesPh')} className="warm-inp resize-none" />
              </WarmField>
              <button
                onClick={submit}
                disabled={submitting || cartLines.length === 0}
                className="btn-primary-lg w-full disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting
                  ? <><Loader2 className="h-5 w-5 animate-spin" /> {t('confirming')}</>
                  : <>{t('confirm')} <ArrowRight className="h-5 w-5" /></>}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .warm-inp { width: 100%; border-radius: 0.75rem; border: 1px solid #44403c; background: rgba(41, 37, 36, 0.5); padding: 0.75rem 1rem; color: #ffffff; outline: none; transition: border-color 0.15s, box-shadow 0.15s; }
        .warm-inp::placeholder { color: #78716c; }
        .warm-inp:focus { border-color: #b8860b; box-shadow: 0 0 0 1px #b8860b; }
      `}</style>
    </main>
  );
}

function CategoryChip({ selected, onClick, label }: { selected: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={[
        'inline-flex min-h-[44px] shrink-0 items-center rounded-full border px-4 py-2 text-sm font-medium transition',
        selected
          ? 'border-primary bg-primary text-warm-950 shadow-md'
          : 'border-warm-700 bg-warm-800/50 text-warm-200 hover:border-primary-light hover:bg-warm-800',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-warm-400">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function WarmField({ icon, label, required, children }: { icon?: ReactNode; label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-warm-300">
        {icon && <span className="text-primary-light">{icon}</span>}
        {label}
        {required && <span className="text-rose-400">*</span>}
      </span>
      {children}
    </label>
  );
}
