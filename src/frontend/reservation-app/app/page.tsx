'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
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

import dynamic from 'next/dynamic';
import { createAuthApi } from '@/lib/auth-client';

// Client-only: BookingEngineWarm calcula fechas con `new Date()` en el render
// inicial; al prerenderizar (SSG) la fecha queda congelada a la hora de build y
// no coincide con la del cliente → mismatch de hidratación (React #418/#423/#425).
// Cargarlo solo en cliente elimina esos errores sin afectar el SEO del landing.
const BookingEngineWarm = dynamic(() => import('@/components/BookingEngineWarm'), { ssr: false });

// F3 — auth-client centralizado reemplaza el interceptor JWT inline.
const { api } = createAuthApi('reservation');

/* ───────── Types ───────── */
interface Dish {
  id: number;
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
  categoryName?: string;
}

interface AvailableTable {
  id: number;
  tableNumber: number;
  capacity: number;
  zoneName?: string;
}

interface ZoneOption {
  id: number;
  name: string;
}

/* ───────── Helpers ───────── */
function formatPrice(n: number) {
  return `RD$ ${n.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;
}

function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

/* ═══════════════════════════════════════════════════════
   PAGE COMPONENT
   ═══════════════════════════════════════════════════════ */
export default function ReservationPage() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);

  // Landing público — sin auth-gate. Staff entra a /login (panel propio) si necesita.

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (id: string) => {
    setMobileNav(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      {/* ─── HEADER ─── */}
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

          {/* Desktop nav */}
          <nav className="hidden items-center gap-8 md:flex">
            {[
              ['nosotros', 'Nosotros'],
              ['menu', 'Menú'],
              ['reservar', 'Reservar'],
              ['contacto', 'Contacto'],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => scrollTo(id)}
                className="text-sm font-medium tracking-wide text-warm-300 transition-colors hover:text-primary-light"
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => scrollTo('reservar')}
              className="btn-primary text-sm"
            >
              Reservar Ahora
            </button>
          </nav>

          {/* Mobile toggle */}
          <button
            className="text-white md:hidden"
            onClick={() => setMobileNav(!mobileNav)}
            aria-label="Menú"
          >
            {mobileNav ? <X className="h-7 w-7" /> : <MenuIcon className="h-7 w-7" />}
          </button>
        </div>

        {/* Mobile nav */}
        {mobileNav && (
          <div className="border-t border-warm-800 bg-warm-950/98 backdrop-blur-md md:hidden">
            <div className="container-narrow flex flex-col gap-1 py-4">
              {[
                ['nosotros', 'Nosotros'],
                ['menu', 'Menú'],
                ['reservar', 'Reservar'],
                ['contacto', 'Contacto'],
              ].map(([id, label]) => (
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
                Reservar Ahora
              </button>
            </div>
          </div>
        )}
      </header>

      <main>
        {/* ─── HERO ─── */}
        <section
          id="hero"
          className="relative flex min-h-screen items-center justify-center overflow-hidden bg-warm-950"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-warm-950/80 via-warm-950/50 to-warm-950" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(218,165,32,0.08),transparent_70%)]" />

          <div className="container-narrow relative z-10 px-4 text-center">
            <span className="mb-6 inline-block rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-primary-light">
              Experiencia Gastronómica
            </span>
            <h1 className="font-display text-4xl font-bold leading-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
              Una Experiencia
              <br />
              <span className="text-primary-light">Gastronómica Única</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-warm-400 sm:text-xl">
              Reserva tu mesa y disfruta de la mejor cocina en un ambiente excepcional
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <button
                onClick={() => scrollTo('reservar')}
                className="btn-primary-lg group"
              >
                Reservar Mi Mesa
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </button>
              <button
                onClick={() => scrollTo('menu')}
                className="btn-outline border-warm-600 text-warm-300 hover:border-primary hover:bg-primary hover:text-white"
              >
                Ver Menú
              </button>
            </div>

            {/* Trust */}
            <div className="mx-auto mt-16 flex max-w-lg flex-wrap items-center justify-center gap-8 border-t border-warm-800 pt-8">
              <div className="flex items-center gap-2 text-warm-400">
                <Star className="h-5 w-5 fill-primary-light text-primary-light" />
                <span className="text-sm font-medium">
                  <strong className="text-white">4.9</strong> en Google
                </span>
              </div>
              <div className="flex items-center gap-2 text-warm-400">
                <Users className="h-5 w-5 text-primary-light" />
                <span className="text-sm font-medium">
                  <strong className="text-white">500+</strong> Reseñas
                </span>
              </div>
              <div className="flex items-center gap-2 text-warm-400">
                <ChefHat className="h-5 w-5 text-primary-light" />
                <span className="text-sm font-medium text-white">Chef Premiado</span>
              </div>
            </div>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
            <div className="h-10 w-6 rounded-full border-2 border-warm-600 p-1">
              <div className="mx-auto h-2 w-1 animate-bounce rounded-full bg-primary-light" />
            </div>
          </div>
        </section>

        {/* ─── INTRO / ABOUT ─── */}
        <section id="nosotros" className="section-padding bg-warm-50">
          <div className="container-narrow">
            <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
              <div>
                <span className="mb-3 inline-block text-xs font-semibold uppercase tracking-widest text-primary">
                  Nuestra Historia
                </span>
                <h2 className="font-display text-3xl font-bold text-warm-900 sm:text-4xl lg:text-5xl">
                  Donde el Arte Culinario{' '}
                  <span className="text-primary">Cobra Vida</span>
                </h2>
                <p className="mt-6 text-lg leading-relaxed text-warm-600">
                  Nacimos de la pasión por la buena mesa y el deseo de crear momentos
                  inolvidables. Cada plato es una obra maestra que combina los sabores
                  más auténticos con técnicas innovadoras, todo servido en un ambiente
                  cuidadosamente diseñado para despertar tus sentidos.
                </p>
                <p className="mt-4 text-lg leading-relaxed text-warm-600">
                  Con{' '}
                  <strong className="text-warm-800">
                    más de 10 años de excelencia culinaria
                  </strong>
                  , hemos construido una reputación basada en la calidad, la frescura y
                  un servicio excepcional.
                </p>
                <button
                  onClick={() =>
                    document
                      .getElementById('reservar')
                      ?.scrollIntoView({ behavior: 'smooth' })
                  }
                  className="btn-primary mt-8"
                >
                  Reservar una Experiencia
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>

              {/* Image placeholder */}
              <div className="relative">
                <div className="aspect-[4/5] overflow-hidden rounded-2xl bg-gradient-to-br from-warm-200 to-warm-300 shadow-2xl shadow-warm-300/40">
                  <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
                    <Wine className="h-20 w-20 text-primary/40" />
                    <p className="font-display text-xl text-warm-500">
                      Imagen del Restaurante
                    </p>
                  </div>
                </div>
                <div className="absolute -bottom-6 -left-6 rounded-xl bg-primary p-6 text-center shadow-xl">
                  <span className="block font-display text-3xl font-bold text-white">
                    10+
                  </span>
                  <span className="text-sm text-primary-50">Años</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── EXPERIENCE PILLARS ─── */}
        <section className="section-padding bg-warm-100/60">
          <div className="container-narrow text-center">
            <span className="mb-3 inline-block text-xs font-semibold uppercase tracking-widest text-primary">
              Por Qué Elegirnos
            </span>
            <h2 className="font-display text-3xl font-bold text-warm-900 sm:text-4xl">
              Una Experiencia Incomparable
            </h2>

            <div className="mt-14 grid gap-8 sm:grid-cols-3">
              {[
                {
                  icon: Leaf,
                  title: 'Ingredientes Frescos',
                  text: 'Seleccionamos diariamente los mejores ingredientes de productores locales para garantizar la frescura y calidad en cada plato.',
                },
                {
                  icon: Sparkles,
                  title: 'Ambiente Exclusivo',
                  text: 'Un espacio diseñado para crear la atmósfera perfecta, donde cada detalle ha sido pensado para tu comodidad y disfrute.',
                },
                {
                  icon: ChefHat,
                  title: 'Chef de Clase Mundial',
                  text: 'Nuestro chef ejecutivo trae consigo años de experiencia internacional y una visión creativa que transforma cada cena en arte.',
                },
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

        {/* ─── MENU HIGHLIGHTS ─── */}
        <MenuHighlights />

        {/* ─── RESERVATION FORM ─── */}
        <ReservationSection />

        {/* ─── HOURS & LOCATION ─── */}
        <section id="contacto" className="section-padding bg-warm-100/60">
          <div className="container-narrow">
            <div className="text-center">
              <span className="mb-3 inline-block text-xs font-semibold uppercase tracking-widest text-primary">
                Visítanos
              </span>
              <h2 className="font-display text-3xl font-bold text-warm-900 sm:text-4xl">
                Horario &amp; Ubicación
              </h2>
            </div>

            <div className="mt-14 grid gap-8 sm:grid-cols-3">
              {/* Hours */}
              <div className="rounded-2xl border border-warm-200 bg-white p-8 text-center shadow-sm">
                <Clock className="mx-auto h-10 w-10 text-primary" />
                <h3 className="mt-4 font-display text-xl font-bold text-warm-900">
                  Horario
                </h3>
                <div className="mt-4 space-y-2 text-sm text-warm-600">
                  <p>
                    <strong className="text-warm-800">Lun – Jue:</strong> 12:00 pm – 10:00 pm
                  </p>
                  <p>
                    <strong className="text-warm-800">Vie – Sáb:</strong> 12:00 pm – 11:00 pm
                  </p>
                  <p>
                    <strong className="text-warm-800">Domingo:</strong> 12:00 pm – 9:00 pm
                  </p>
                </div>
              </div>

              {/* Address */}
              <div className="rounded-2xl border border-warm-200 bg-white p-8 text-center shadow-sm">
                <MapPin className="mx-auto h-10 w-10 text-primary" />
                <h3 className="mt-4 font-display text-xl font-bold text-warm-900">
                  Dirección
                </h3>
                <p className="mt-4 text-sm leading-relaxed text-warm-600">
                  Calle Principal #123
                  <br />
                  Santo Domingo, RD
                </p>
              </div>

              {/* Contact */}
              <div className="rounded-2xl border border-warm-200 bg-white p-8 text-center shadow-sm">
                <Phone className="mx-auto h-10 w-10 text-primary" />
                <h3 className="mt-4 font-display text-xl font-bold text-warm-900">
                  Contacto
                </h3>
                <div className="mt-4 space-y-2 text-sm text-warm-600">
                  <p>(809) 555-0100</p>
                  <p>reservas@smartmenu.com</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── TESTIMONIALS ─── */}
        <section className="section-padding bg-warm-50">
          <div className="container-narrow text-center">
            <span className="mb-3 inline-block text-xs font-semibold uppercase tracking-widest text-primary">
              Testimonios
            </span>
            <h2 className="font-display text-3xl font-bold text-warm-900 sm:text-4xl">
              Lo Que Dicen Nuestros Clientes
            </h2>

            <div className="mt-14 grid gap-8 sm:grid-cols-3">
              {[
                {
                  name: 'María García',
                  quote:
                    'Una experiencia inolvidable. La comida estaba espectacular y el servicio fue impecable. Sin duda, el mejor restaurante de la ciudad.',
                  stars: 5,
                },
                {
                  name: 'Carlos Rodríguez',
                  quote:
                    'Celebramos nuestro aniversario aquí y fue perfecto. El ambiente es elegante y acogedor, y cada plato fue una delicia.',
                  stars: 5,
                },
                {
                  name: 'Ana Martínez',
                  quote:
                    'Los ingredientes frescos realmente hacen la diferencia. Se nota la pasión del chef en cada bocado. Volveremos pronto.',
                  stars: 5,
                },
              ].map((t) => (
                <div
                  key={t.name}
                  className="rounded-2xl border border-warm-200 bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="flex justify-center gap-1">
                    {Array.from({ length: t.stars }).map((_, i) => (
                      <Star
                        key={i}
                        className="h-5 w-5 fill-primary-light text-primary-light"
                      />
                    ))}
                  </div>
                  <p className="mt-5 text-sm italic leading-relaxed text-warm-600">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <p className="mt-5 font-display text-lg font-semibold text-warm-900">
                    {t.name}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── CTA BANNER ─── */}
        <section className="relative overflow-hidden bg-warm-950 py-20">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(218,165,32,0.1),transparent_70%)]" />
          <div className="container-narrow relative z-10 text-center">
            <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
              ¿Listo para una Experiencia
              <span className="text-primary-light"> Inolvidable</span>?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-warm-400">
              Reserva tu mesa ahora y déjanos sorprenderte con lo mejor de nuestra
              cocina.
            </p>
            <button
              onClick={() =>
                document
                  .getElementById('reservar')
                  ?.scrollIntoView({ behavior: 'smooth' })
              }
              className="btn-primary-lg mt-8"
            >
              Reservar Ahora
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </section>
      </main>

      {/* ─── FOOTER ─── */}
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
                aria-label="Instagram"
              >
                <Instagram className="h-5 w-5" />
              </a>
              <a
                href="#"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-warm-700 text-warm-400 transition-all hover:border-primary hover:bg-primary hover:text-white"
                aria-label="Facebook"
              >
                <Facebook className="h-5 w-5" />
              </a>
              <a
                href="#"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-warm-700 text-warm-400 transition-all hover:border-primary hover:bg-primary hover:text-white"
                aria-label="WhatsApp"
              >
                <MessageCircle className="h-5 w-5" />
              </a>
            </div>
          </div>
          <p className="pt-8 text-center text-sm text-warm-600">
            &copy; 2026 SmartMenu. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </>
  );
}

/* ═══════════════════════════════════════════════════════
   MENU HIGHLIGHTS
   ═══════════════════════════════════════════════════════ */
function MenuHighlights() {
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
            Gastronomía
          </span>
          <h2 className="font-display text-3xl font-bold text-warm-900 sm:text-4xl">
            Nuestro Menú Destacado
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-warm-600">
            Descubre algunos de nuestros platos más populares, elaborados con los
            ingredientes más frescos y la creatividad de nuestro chef.
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
            Menú no disponible en este momento. ¡Visítanos para descubrir nuestras
            delicias!
          </p>
        )}

        <div className="mt-12 text-center">
          <button className="btn-outline">Ver Menú Completo</button>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════
   RESERVATION SECTION
   ═══════════════════════════════════════════════════════ */
function ReservationSection() {
  return (
    <section id="reservar" className="section-padding bg-warm-950">
      <div className="container-narrow">
        <div className="text-center mb-10 sm:mb-12">
          <span className="mb-3 inline-block text-xs font-semibold uppercase tracking-widest text-primary-light">
            Reservaciones
          </span>
          <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
            Reserva tu mesa
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-warm-400">
            Capacidad dinámica por intervalo — elige tu horario en vivo y te confirmamos en segundos.
          </p>
        </div>
        <BookingEngineWarm forceMode="mesa" />
        <div className="mx-auto mt-6 max-w-md text-center">
          <a
            href="/area-completa"
            className="inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-5 py-3 text-sm font-semibold text-primary-light transition hover:bg-primary/20"
          >
            🏛 ¿Evento privado? Reservá un área completa
          </a>
        </div>
      </div>
    </section>
  );
}
