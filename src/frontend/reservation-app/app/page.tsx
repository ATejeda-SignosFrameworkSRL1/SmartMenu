'use client';

import { useState, useEffect, useCallback, FormEvent } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  ChefHat,
  Leaf,
  Sparkles,
  Clock,
  MapPin,
  Phone,
  Mail,
  Star,
  Users,
  CalendarDays,
  ArrowRight,
  Instagram,
  Facebook,
  MessageCircle,
  Menu as MenuIcon,
  X,
  UtensilsCrossed,
  Wine,
  CheckCircle2,
} from 'lucide-react';

const api = axios.create({ baseURL: '' });

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
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('reservation_token');
    if (!token) {
      window.location.href = '/login';
      return;
    }
    setAuthChecked(true);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-rose-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-600">Verificando sesión…</p>
        </div>
      </div>
    );
  }

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
  const [form, setForm] = useState({
    date: '',
    time: '19:00',
    guests: '2',
    tableId: '',
    name: '',
    phone: '',
    email: '',
    notes: '',
  });

  const [tables, setTables] = useState<AvailableTable[]>([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [reservationId, setReservationId] = useState<number | null>(null);

  // Pre-order state
  const [showPreOrder, setShowPreOrder] = useState(false);
  const [menuDishes, setMenuDishes] = useState<any[]>([]);
  const [preOrderItems, setPreOrderItems] = useState<{ dishId: number; name: string; price: number; quantity: number }[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(false);

  const loadMenu = async () => {
    if (menuDishes.length > 0) return;
    setLoadingMenu(true);
    try {
      const res = await api.get('/api/dish');
      setMenuDishes(Array.isArray(res.data) ? res.data : []);
    } catch { /* ignore */ }
    setLoadingMenu(false);
  };

  const addToPreOrder = (dish: any) => {
    setPreOrderItems(prev => {
      const existing = prev.find(i => i.dishId === dish.id);
      if (existing) return prev.map(i => i.dishId === dish.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { dishId: dish.id, name: dish.name, price: dish.price, quantity: 1 }];
    });
  };

  const removeFromPreOrder = (dishId: number) => {
    setPreOrderItems(prev => {
      const existing = prev.find(i => i.dishId === dishId);
      if (existing && existing.quantity > 1) return prev.map(i => i.dishId === dishId ? { ...i, quantity: i.quantity - 1 } : i);
      return prev.filter(i => i.dishId !== dishId);
    });
  };

  const preOrderTotal = preOrderItems.reduce((s, i) => s + i.price * i.quantity, 0);

  const fetchTables = useCallback(async () => {
    if (!form.date || !form.time) return;
    setLoadingTables(true);
    setForm((prev) => ({ ...prev, tableId: '' }));
    try {
      const dateTime = `${form.date}T${form.time}:00`;
      const res = await api.get('/api/tablereservation/public/available-tables', {
        params: { dateTime, guests: Number(form.guests) },
      });
      const data: AvailableTable[] = Array.isArray(res.data)
        ? res.data
        : res.data?.data ?? [];
      setTables(data);
    } catch {
      setTables([]);
    } finally {
      setLoadingTables(false);
    }
  }, [form.date, form.time, form.guests]);

  useEffect(() => {
    if (form.date && form.time && form.guests) {
      const debounce = setTimeout(fetchTables, 400);
      return () => clearTimeout(debounce);
    }
  }, [form.date, form.time, form.guests, fetchTables]);

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!form.date || !form.time || !form.tableId || !form.name || !form.phone) {
      toast.error('Por favor completa todos los campos requeridos.');
      return;
    }

    setSubmitting(true);
    try {
      const dateTime = `${form.date}T${form.time}:00`;
      const resv = await api.post('/api/tablereservation/public', {
        tableId: Number(form.tableId),
        reservationDateTime: dateTime,
        numberOfGuests: Number(form.guests),
        customerName: form.name,
        customerPhone: form.phone,
        customerEmail: form.email || undefined,
        specialRequests: form.notes || undefined,
      });
      const newReservationId = resv.data?.id;
      setReservationId(newReservationId);

      if (preOrderItems.length > 0 && newReservationId) {
        try {
          await api.post(`/api/tablereservation/${newReservationId}/preorder`, {
            notes: form.notes || null,
            items: preOrderItems.map(i => ({ dishId: i.dishId, quantity: i.quantity })),
          });
        } catch { /* pre-order is optional, don't fail the whole reservation */ }
      }

      setSuccess(true);
      toast.success('¡Reserva enviada correctamente!');
    } catch (err: unknown) {
      const message =
        axios.isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : 'No se pudo procesar la reserva. Intenta de nuevo.';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];

  if (success) {
    return (
      <section id="reservar" className="section-padding bg-warm-950">
        <div className="container-narrow">
          <div className="mx-auto max-w-lg rounded-3xl border border-primary/20 bg-warm-900/50 p-12 text-center shadow-2xl">
            <CheckCircle2 className="mx-auto h-20 w-20 text-primary-light" />
            <h2 className="mt-6 font-display text-3xl font-bold text-white">
              ¡Reserva Recibida!
            </h2>
            <p className="mt-4 text-warm-400">
              Te contactaremos pronto para confirmar tu reservación. Mientras tanto,
              puedes llamarnos al <strong className="text-white">(809) 555-0100</strong>{' '}
              si tienes alguna pregunta.
            </p>
            <button
              onClick={() => {
                setSuccess(false);
                setForm({
                  date: '',
                  time: '19:00',
                  guests: '2',
                  tableId: '',
                  name: '',
                  phone: '',
                  email: '',
                  notes: '',
                });
                setTables([]);
              }}
              className="btn-primary mt-8"
            >
              Hacer Otra Reserva
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="reservar" className="section-padding bg-warm-950">
      <div className="container-narrow">
        <div className="text-center">
          <span className="mb-3 inline-block text-xs font-semibold uppercase tracking-widest text-primary-light">
            Reservaciones
          </span>
          <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
            Reserva Tu Mesa
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-warm-400">
            Selecciona la fecha, hora y número de comensales para ver las mesas
            disponibles.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mx-auto mt-12 max-w-3xl rounded-3xl border border-warm-800 bg-warm-900/50 p-8 shadow-2xl backdrop-blur-sm sm:p-10"
        >
          {/* Row 1: Date, Time, Guests */}
          <div className="grid gap-5 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-warm-300">
                <CalendarDays className="h-4 w-4" /> Fecha *
              </span>
              <input
                type="date"
                required
                min={today}
                value={form.date}
                onChange={(e) => update('date', e.target.value)}
                className="w-full rounded-xl border border-warm-700 bg-warm-800/50 px-4 py-3 text-white outline-none transition-colors placeholder:text-warm-600 focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-warm-300">
                <Clock className="h-4 w-4" /> Hora *
              </span>
              <select
                required
                value={form.time}
                onChange={(e) => update('time', e.target.value)}
                className="w-full rounded-xl border border-warm-700 bg-warm-800/50 px-4 py-3 text-white outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
              >
                {[
                  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
                  '15:00', '15:30', '18:00', '18:30', '19:00', '19:30',
                  '20:00', '20:30', '21:00', '21:30', '22:00',
                ].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-warm-300">
                <Users className="h-4 w-4" /> Comensales *
              </span>
              <select
                required
                value={form.guests}
                onChange={(e) => update('guests', e.target.value)}
                className="w-full rounded-xl border border-warm-700 bg-warm-800/50 px-4 py-3 text-white outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
              >
                {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? 'persona' : 'personas'}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Available tables grouped by zone */}
          {form.date && (
            <div className="mt-6">
              <span className="mb-2 block text-sm font-medium text-warm-300">
                Mesa Disponible *
              </span>
              {loadingTables ? (
                <div className="flex items-center gap-2 text-sm text-warm-500">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-light border-t-transparent" />
                  Buscando mesas disponibles...
                </div>
              ) : tables.length > 0 ? (
                <div className="space-y-5">
                  {Object.entries(
                    tables.reduce<Record<string, AvailableTable[]>>((acc, t) => {
                      const zone = t.zoneName || 'Sin zona';
                      if (!acc[zone]) acc[zone] = [];
                      acc[zone].push(t);
                      return acc;
                    }, {})
                  ).map(([zone, zoneTables]) => (
                    <div key={zone}>
                      <div className="mb-2 flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-primary-light" />
                        <span className="text-sm font-semibold text-primary-light">{zone}</span>
                        <span className="text-xs text-warm-500">({zoneTables.length} mesa{zoneTables.length !== 1 ? 's' : ''})</span>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {zoneTables.map((table) => (
                          <button
                            key={table.id}
                            type="button"
                            onClick={() => update('tableId', String(table.id))}
                            className={cn(
                              'rounded-xl border px-4 py-3 text-left transition-all',
                              form.tableId === String(table.id)
                                ? 'border-primary bg-primary/20 text-white ring-1 ring-primary'
                                : 'border-warm-700 bg-warm-800/30 text-warm-400 hover:border-warm-600',
                            )}
                          >
                            <span className="font-semibold text-white">
                              Mesa {table.tableNumber}
                            </span>
                            <span className="ml-2 text-sm">
                              ({table.capacity} persona{table.capacity !== 1 ? 's' : ''})
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-warm-500">
                  No hay mesas disponibles para esta fecha/hora. Prueba otro horario.
                </p>
              )}
            </div>
          )}

          {/* Row 2: Name, Phone */}
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-warm-300">
                Nombre Completo *
              </span>
              <input
                type="text"
                required
                placeholder="Juan Pérez"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                className="w-full rounded-xl border border-warm-700 bg-warm-800/50 px-4 py-3 text-white outline-none transition-colors placeholder:text-warm-600 focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-warm-300">
                <Phone className="h-4 w-4" /> Teléfono *
              </span>
              <input
                type="tel"
                required
                placeholder="(809) 555-0000"
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                className="w-full rounded-xl border border-warm-700 bg-warm-800/50 px-4 py-3 text-white outline-none transition-colors placeholder:text-warm-600 focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </label>
          </div>

          {/* Row 3: Email */}
          <label className="mt-5 block">
            <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-warm-300">
              <Mail className="h-4 w-4" /> Correo Electrónico
            </span>
            <input
              type="email"
              placeholder="correo@ejemplo.com"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              className="w-full rounded-xl border border-warm-700 bg-warm-800/50 px-4 py-3 text-white outline-none transition-colors placeholder:text-warm-600 focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </label>

          {/* Row 4: Notes */}
          <label className="mt-5 block">
            <span className="mb-1.5 block text-sm font-medium text-warm-300">
              Solicitudes Especiales
            </span>
            <textarea
              rows={3}
              placeholder="Alergias, celebraciones, preferencias de ubicación..."
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              className="w-full resize-none rounded-xl border border-warm-700 bg-warm-800/50 px-4 py-3 text-white outline-none transition-colors placeholder:text-warm-600 focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </label>

          {/* Pre-order Section */}
          <div className="mt-8 rounded-2xl border border-warm-700/50 bg-warm-800/30 p-6">
            <button
              type="button"
              onClick={() => { setShowPreOrder(!showPreOrder); if (!showPreOrder) loadMenu(); }}
              className="flex w-full items-center justify-between text-left"
            >
              <div>
                <h3 className="text-lg font-semibold text-white">
                  ¿Deseas pre-ordenar? <span className="text-sm font-normal text-warm-400">(opcional)</span>
                </h3>
                <p className="text-sm text-warm-400">Selecciona platos anticipadamente para agilizar tu visita</p>
              </div>
              <span className={`text-primary-light transition-transform ${showPreOrder ? 'rotate-180' : ''}`}>▼</span>
            </button>

            {showPreOrder && (
              <div className="mt-4 space-y-4">
                {loadingMenu ? (
                  <p className="text-sm text-warm-400 animate-pulse">Cargando menú...</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 max-h-64 overflow-y-auto pr-2">
                    {menuDishes.filter((d: any) => d.isAvailable !== false).map((dish: any) => {
                      const inCart = preOrderItems.find(i => i.dishId === dish.id);
                      return (
                        <div key={dish.id} className="flex items-center justify-between rounded-xl border border-warm-700/50 bg-warm-800/50 p-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-white truncate">{dish.name}</p>
                            <p className="text-xs text-primary-light">RD$ {Number(dish.price).toLocaleString('es-DO')}</p>
                          </div>
                          <div className="flex items-center gap-1.5 ml-2">
                            {inCart ? (
                              <>
                                <button type="button" onClick={() => removeFromPreOrder(dish.id)} className="h-7 w-7 rounded-full bg-warm-700 text-white text-xs font-bold hover:bg-warm-600">-</button>
                                <span className="w-5 text-center text-sm text-white font-bold">{inCart.quantity}</span>
                                <button type="button" onClick={() => addToPreOrder(dish)} className="h-7 w-7 rounded-full bg-primary text-white text-xs font-bold hover:bg-primary-light">+</button>
                              </>
                            ) : (
                              <button type="button" onClick={() => addToPreOrder(dish)} className="rounded-lg bg-primary/20 px-3 py-1.5 text-xs font-semibold text-primary-light hover:bg-primary/30">Agregar</button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {preOrderItems.length > 0 && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <h4 className="text-sm font-semibold text-primary-light mb-2">Tu pre-orden</h4>
                    {preOrderItems.map(item => (
                      <div key={item.dishId} className="flex justify-between text-sm text-warm-300">
                        <span>{item.quantity}x {item.name}</span>
                        <span className="text-primary-light">RD$ {(item.price * item.quantity).toLocaleString('es-DO')}</span>
                      </div>
                    ))}
                    <div className="mt-2 border-t border-warm-700 pt-2 flex justify-between text-sm font-bold text-white">
                      <span>Total estimado</span>
                      <span className="text-primary-light">RD$ {preOrderTotal.toLocaleString('es-DO')}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary-lg mt-8 w-full disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <>
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Procesando...
              </>
            ) : (
              <>
                Confirmar Reserva
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </button>
        </form>
      </div>
    </section>
  );
}
