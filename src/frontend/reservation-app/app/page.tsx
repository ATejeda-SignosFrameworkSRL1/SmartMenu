'use client';

import { useState, useEffect } from 'react';
import {
  ChefHat,
  Leaf,
  Sparkles,
  Clock,
  MapPin,
  Phone,
  Star,
  Users,
  ArrowRight,
  Instagram,
  Facebook,
  MessageCircle,
  Menu as MenuIcon,
  X,
  UtensilsCrossed,
  Wine,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { createAuthApi } from '@/lib/auth-client';
import LanguageSwitcher from '@/components/LanguageSwitcher';

const BookingEngineWarm = dynamic(() => import('@/components/BookingEngineWarm'), { ssr: false });

const { api } = createAuthApi('reservation');

interface Dish {
  id: number;
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
  categoryName?: string;
}

function formatPrice(n: number) {
  return `RD$ ${n.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;
}

function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

export default function ReservationPage() {
  const t = useTranslations();
  const [scrolled, setScrolled] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (id: string) => {
    setMobileNav(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const navItems: [string, string][] = [
    ['nosotros', t('nav.about')],
    ['menu', t('nav.menu')],
    ['reservar', t('nav.reserve')],
    ['contacto', t('nav.contact')],
  ];

  return (
    <>

      <header
        className={cn(
          'fixed inset-x-0 top-0 z-50 transition-all duration-500',
          scrolled
            ? 'bg-warm-950/95 shadow-lg shadow-black/10 backdrop-blur-md'
            : 'bg-transparent',
        )}
      >
        <div className="container-narrow flex h-20 items-center justify-between">
          <button onClick={() => scrollTo('hero')} className="flex items-center gap-2">
            <UtensilsCrossed className="h-7 w-7 text-primary-light" />
            <span className="font-display text-2xl font-bold text-white">SmartMenu</span>
          </button>

          <nav className="hidden items-center gap-8 md:flex">
            {navItems.map(([id, label]) => (
              <button
                key={id}
                onClick={() => scrollTo(id)}
                className="text-sm font-medium tracking-wide text-warm-300 transition-colors hover:text-primary-light"
              >
                {label}
              </button>
            ))}
            <LanguageSwitcher />
            <button
              onClick={() => scrollTo('reservar')}
              className="btn-primary text-sm"
            >
              {t('nav.reserveNow')}
            </button>
          </nav>

          <div className="flex items-center gap-3 md:hidden">
            <LanguageSwitcher />
            <button
              className="text-white"
              onClick={() => setMobileNav(!mobileNav)}
              aria-label={t('nav.menuAria')}
            >
              {mobileNav ? <X className="h-7 w-7" /> : <MenuIcon className="h-7 w-7" />}
            </button>
          </div>
        </div>

        {mobileNav && (
          <div className="border-t border-warm-800 bg-warm-950/98 backdrop-blur-md md:hidden">
            <div className="container-narrow flex flex-col gap-1 py-4">
              {navItems.map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => scrollTo(id)}
                  className="rounded-lg px-4 py-3 text-left text-warm-200 transition-colors hover:bg-warm-800/60"
                >
                  {label}
                </button>
              ))}
              <button
                onClick={() => scrollTo('reservar')}
                className="btn-primary mt-2 w-full text-center"
              >
                {t('nav.reserveNow')}
              </button>
            </div>
          </div>
        )}
      </header>

      <main>

        <section
          id="hero"
          className="relative flex min-h-screen items-center justify-center overflow-hidden bg-warm-950"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-warm-950/80 via-warm-950/50 to-warm-950" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(218,165,32,0.08),transparent_70%)]" />

          <div className="container-narrow relative z-10 px-4 text-center">
            <span className="mb-6 inline-block rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-primary-light">
              {t('hero.badge')}
            </span>
            <h1 className="font-display text-4xl font-bold leading-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
              {t('hero.titleLine1')}
              <br />
              <span className="text-primary-light">{t('hero.titleHighlight')}</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-warm-400 sm:text-xl">
              {t('hero.subtitle')}
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <button
                onClick={() => scrollTo('reservar')}
                className="btn-primary-lg group"
              >
                {t('hero.ctaReserve')}
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </button>
              <button
                onClick={() => scrollTo('menu')}
                className="btn-outline border-warm-600 text-warm-300 hover:border-primary hover:bg-primary hover:text-white"
              >
                {t('hero.ctaMenu')}
              </button>

              <Link
                href="/pedir"
                className="btn-outline border-primary/50 text-primary-light hover:border-primary hover:bg-primary hover:text-white"
              >
                {t('pedidos.homeCta')}
              </Link>
            </div>

            <div className="mx-auto mt-16 flex max-w-lg flex-wrap items-center justify-center gap-8 border-t border-warm-800 pt-8">
              <div className="flex items-center gap-2 text-warm-400">
                <Star className="h-5 w-5 fill-primary-light text-primary-light" />
                <span className="text-sm font-medium">
                  <strong className="text-white">4.9</strong> {t('hero.ratingGoogle')}
                </span>
              </div>
              <div className="flex items-center gap-2 text-warm-400">
                <Users className="h-5 w-5 text-primary-light" />
                <span className="text-sm font-medium">
                  <strong className="text-white">500+</strong> {t('hero.reviews')}
                </span>
              </div>
              <div className="flex items-center gap-2 text-warm-400">
                <ChefHat className="h-5 w-5 text-primary-light" />
                <span className="text-sm font-medium text-white">{t('hero.awardedChef')}</span>
              </div>
            </div>
          </div>

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
            <div className="h-10 w-6 rounded-full border-2 border-warm-600 p-1">
              <div className="mx-auto h-2 w-1 animate-bounce rounded-full bg-primary-light" />
            </div>
          </div>
        </section>

        <section id="nosotros" className="section-padding bg-warm-50">
          <div className="container-narrow">
            <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
              <div>
                <span className="mb-3 inline-block text-xs font-semibold uppercase tracking-widest text-primary">
                  {t('about.kicker')}
                </span>
                <h2 className="font-display text-3xl font-bold text-warm-900 sm:text-4xl lg:text-5xl">
                  {t('about.titleA')}{' '}
                  <span className="text-primary">{t('about.titleHighlight')}</span>
                </h2>
                <p className="mt-6 text-lg leading-relaxed text-warm-600">
                  {t('about.p1')}
                </p>
                <p className="mt-4 text-lg leading-relaxed text-warm-600">
                  {t('about.p2a')}
                  <strong className="text-warm-800">{t('about.p2bold')}</strong>
                  {t('about.p2b')}
                </p>
                <button
                  onClick={() =>
                    document
                      .getElementById('reservar')
                      ?.scrollIntoView({ behavior: 'smooth' })
                  }
                  className="btn-primary mt-8"
                >
                  {t('about.cta')}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>

              <div className="relative">
                <div className="aspect-[4/5] overflow-hidden rounded-2xl bg-gradient-to-br from-warm-200 to-warm-300 shadow-2xl shadow-warm-300/40">
                  <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
                    <Wine className="h-20 w-20 text-primary/40" />
                    <p className="font-display text-xl text-warm-500">
                      {t('about.imagePlaceholder')}
                    </p>
                  </div>
                </div>
                <div className="absolute -bottom-6 -left-6 rounded-xl bg-primary p-6 text-center shadow-xl">
                  <span className="block font-display text-3xl font-bold text-white">
                    10+
                  </span>
                  <span className="text-sm text-primary-50">{t('about.yearsLabel')}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section-padding bg-warm-100/60">
          <div className="container-narrow text-center">
            <span className="mb-3 inline-block text-xs font-semibold uppercase tracking-widest text-primary">
              {t('pillars.kicker')}
            </span>
            <h2 className="font-display text-3xl font-bold text-warm-900 sm:text-4xl">
              {t('pillars.title')}
            </h2>

            <div className="mt-14 grid gap-8 sm:grid-cols-3">
              {[
                { icon: Leaf, title: t('pillars.freshTitle'), text: t('pillars.freshText') },
                { icon: Sparkles, title: t('pillars.ambienceTitle'), text: t('pillars.ambienceText') },
                { icon: ChefHat, title: t('pillars.chefTitle'), text: t('pillars.chefText') },
              ].map((item) => (
                <div
                  key={item.title}
                  className="group rounded-2xl border border-warm-200 bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5"
                >
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                    <item.icon className="h-8 w-8" />
                  </div>
                  <h3 className="mt-6 font-display text-xl font-bold text-warm-900">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-warm-600">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <MenuHighlights />

        <ReservationSection />

        <section id="contacto" className="section-padding bg-warm-100/60">
          <div className="container-narrow">
            <div className="text-center">
              <span className="mb-3 inline-block text-xs font-semibold uppercase tracking-widest text-primary">
                {t('contact.kicker')}
              </span>
              <h2 className="font-display text-3xl font-bold text-warm-900 sm:text-4xl">
                {t('contact.title')}
              </h2>
            </div>

            <div className="mt-14 grid gap-8 sm:grid-cols-3">

              <div className="rounded-2xl border border-warm-200 bg-white p-8 text-center shadow-sm">
                <Clock className="mx-auto h-10 w-10 text-primary" />
                <h3 className="mt-4 font-display text-xl font-bold text-warm-900">
                  {t('contact.hoursTitle')}
                </h3>
                <div className="mt-4 space-y-2 text-sm text-warm-600">
                  <p>
                    <strong className="text-warm-800">{t('contact.hoursMonThuDays')}</strong> {t('contact.hoursMonThuTime')}
                  </p>
                  <p>
                    <strong className="text-warm-800">{t('contact.hoursFriSatDays')}</strong> {t('contact.hoursFriSatTime')}
                  </p>
                  <p>
                    <strong className="text-warm-800">{t('contact.hoursSunDays')}</strong> {t('contact.hoursSunTime')}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-warm-200 bg-white p-8 text-center shadow-sm">
                <MapPin className="mx-auto h-10 w-10 text-primary" />
                <h3 className="mt-4 font-display text-xl font-bold text-warm-900">
                  {t('contact.addressTitle')}
                </h3>
                <p className="mt-4 text-sm leading-relaxed text-warm-600">
                  {t('contact.addressLine1')}
                  <br />
                  {t('contact.addressLine2')}
                </p>
              </div>

              <div className="rounded-2xl border border-warm-200 bg-white p-8 text-center shadow-sm">
                <Phone className="mx-auto h-10 w-10 text-primary" />
                <h3 className="mt-4 font-display text-xl font-bold text-warm-900">
                  {t('contact.contactTitle')}
                </h3>
                <div className="mt-4 space-y-2 text-sm text-warm-600">
                  <p>(809) 555-0100</p>
                  <p>reservas@smartmenu.com</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section-padding bg-warm-50">
          <div className="container-narrow text-center">
            <span className="mb-3 inline-block text-xs font-semibold uppercase tracking-widest text-primary">
              {t('testimonials.kicker')}
            </span>
            <h2 className="font-display text-3xl font-bold text-warm-900 sm:text-4xl">
              {t('testimonials.title')}
            </h2>

            <div className="mt-14 grid gap-8 sm:grid-cols-3">
              {[
                { name: 'María García', quote: t('testimonials.quote1'), stars: 5 },
                { name: 'Carlos Rodríguez', quote: t('testimonials.quote2'), stars: 5 },
                { name: 'Ana Martínez', quote: t('testimonials.quote3'), stars: 5 },
              ].map((tm) => (
                <div
                  key={tm.name}
                  className="rounded-2xl border border-warm-200 bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="flex justify-center gap-1">
                    {Array.from({ length: tm.stars }).map((_, i) => (
                      <Star
                        key={i}
                        className="h-5 w-5 fill-primary-light text-primary-light"
                      />
                    ))}
                  </div>
                  <p className="mt-5 text-sm italic leading-relaxed text-warm-600">
                    &ldquo;{tm.quote}&rdquo;
                  </p>
                  <p className="mt-5 font-display text-lg font-semibold text-warm-900">
                    {tm.name}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden bg-warm-950 py-20">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(218,165,32,0.1),transparent_70%)]" />
          <div className="container-narrow relative z-10 text-center">
            <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
              {t('ctaBanner.titleA')}
              <span className="text-primary-light"> {t('ctaBanner.titleHighlight')}</span>?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-warm-400">
              {t('ctaBanner.subtitle')}
            </p>
            <button
              onClick={() =>
                document
                  .getElementById('reservar')
                  ?.scrollIntoView({ behavior: 'smooth' })
              }
              className="btn-primary-lg mt-8"
            >
              {t('ctaBanner.button')}
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </section>
      </main>

      <footer className="bg-warm-950 px-4 py-12 sm:px-6 lg:px-8">
        <div className="container-narrow">
          <div className="flex flex-col items-center gap-8 border-b border-warm-800 pb-8 md:flex-row md:justify-between">
            <div className="flex items-center gap-2">
              <UtensilsCrossed className="h-6 w-6 text-primary-light" />
              <span className="font-display text-xl font-bold text-white">
                SmartMenu
              </span>
            </div>
            <div className="text-center text-sm text-warm-500 md:text-left">
              <p>Calle Principal #123, Santo Domingo, RD</p>
              <p className="mt-1">(809) 555-0100</p>
            </div>
            <div className="flex gap-4">
              <a
                href="#"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-warm-700 text-warm-400 transition-all hover:border-primary hover:bg-primary hover:text-white"
                aria-label={t('footer.instagram')}
              >
                <Instagram className="h-5 w-5" />
              </a>
              <a
                href="#"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-warm-700 text-warm-400 transition-all hover:border-primary hover:bg-primary hover:text-white"
                aria-label={t('footer.facebook')}
              >
                <Facebook className="h-5 w-5" />
              </a>
              <a
                href="#"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-warm-700 text-warm-400 transition-all hover:border-primary hover:bg-primary hover:text-white"
                aria-label={t('footer.whatsapp')}
              >
                <MessageCircle className="h-5 w-5" />
              </a>
            </div>
          </div>
          <p className="pt-8 text-center text-sm text-warm-600">
            {t('footer.rights')}
          </p>
        </div>
      </footer>
    </>
  );
}

function MenuHighlights() {
  const t = useTranslations('menuHighlights');
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/api/dish')
      .then((res) => {
        const data: Dish[] = Array.isArray(res.data)
          ? res.data
          : res.data?.data ?? res.data?.items ?? [];
        setDishes(data.slice(0, 6));
      })
      .catch(() => setDishes([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section id="menu" className="section-padding bg-warm-50">
      <div className="container-narrow">
        <div className="text-center">
          <span className="mb-3 inline-block text-xs font-semibold uppercase tracking-widest text-primary">
            {t('kicker')}
          </span>
          <h2 className="font-display text-3xl font-bold text-warm-900 sm:text-4xl">
            {t('title')}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-warm-600">
            {t('subtitle')}
          </p>
        </div>

        {loading ? (
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-2xl border border-warm-200 bg-white"
              >
                <div className="aspect-[4/3] rounded-t-2xl bg-warm-200" />
                <div className="p-5">
                  <div className="h-5 w-3/4 rounded bg-warm-200" />
                  <div className="mt-3 h-3 w-full rounded bg-warm-100" />
                  <div className="mt-2 h-3 w-2/3 rounded bg-warm-100" />
                </div>
              </div>
            ))}
          </div>
        ) : dishes.length > 0 ? (
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {dishes.map((dish) => (
              <div
                key={dish.id}
                className="group overflow-hidden rounded-2xl border border-warm-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-warm-200">
                  {dish.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={dish.imageUrl}
                      alt={dish.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <UtensilsCrossed className="h-16 w-16 text-warm-400" />
                    </div>
                  )}
                  {dish.categoryName && (
                    <span className="absolute left-3 top-3 rounded-full bg-warm-950/70 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                      {dish.categoryName}
                    </span>
                  )}
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display text-lg font-bold text-warm-900">
                      {dish.name}
                    </h3>
                    <span className="shrink-0 font-semibold text-primary">
                      {formatPrice(dish.price)}
                    </span>
                  </div>
                  {dish.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-warm-500">
                      {dish.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-14 text-center text-warm-500">
            {t('unavailable')}
          </p>
        )}

        <div className="mt-12 text-center">
          <button className="btn-outline">{t('viewFull')}</button>
        </div>
      </div>
    </section>
  );
}

function ReservationSection() {
  const t = useTranslations('reservation');
  const tp = useTranslations('pedidos');
  return (
    <section id="reservar" className="section-padding bg-warm-950">
      <div className="container-narrow">
        <div className="text-center mb-10 sm:mb-12">
          <span className="mb-3 inline-block text-xs font-semibold uppercase tracking-widest text-primary-light">
            {t('kicker')}
          </span>
          <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
            {t('title')}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-warm-400">
            {t('subtitle')}
          </p>
        </div>
        <BookingEngineWarm forceMode="mesa" />
        <div className="mx-auto mt-6 flex max-w-md flex-col items-center gap-3 text-center">
          <a
            href="/area-completa"
            className="inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-5 py-3 text-sm font-semibold text-primary-light transition hover:bg-primary/20"
          >
            {t('areaButton')}
          </a>
          <Link
            href="/pedir"
            className="inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-5 py-3 text-sm font-semibold text-primary-light transition hover:bg-primary/20"
          >
            {tp('homeCta')}
          </Link>
        </div>
      </div>
    </section>
  );
}
