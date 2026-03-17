'use client';

import { useCartStore } from '@/lib/stores/cartStore';
import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ShoppingCart, Search, ChefHat, Clock, ArrowLeft, ClipboardList } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Dish, Category } from '@/types';
import { useMenu, useDishTags } from '@/lib/hooks';
import Link from 'next/link';
import { DishModal } from '@/components/DishModal';

const TAG_STYLES: Record<string, { bg: string; text: string; activeBg: string; activeText: string }> = {
  popular:     { bg: 'bg-yellow-50',  text: 'text-yellow-700',  activeBg: 'bg-yellow-400',  activeText: 'text-white' },
  muy_picante: { bg: 'bg-red-50',     text: 'text-red-700',     activeBg: 'bg-red-500',     activeText: 'text-white' },
  picante:     { bg: 'bg-orange-50',  text: 'text-orange-700',  activeBg: 'bg-orange-500',  activeText: 'text-white' },
  vegetariano: { bg: 'bg-green-50',   text: 'text-green-700',   activeBg: 'bg-green-600',   activeText: 'text-white' },
  vegano:      { bg: 'bg-emerald-50', text: 'text-emerald-700', activeBg: 'bg-emerald-600', activeText: 'text-white' },
  sin_gluten:  { bg: 'bg-amber-50',   text: 'text-amber-700',   activeBg: 'bg-amber-500',   activeText: 'text-white' },
};

const BADGE_STYLES: Record<string, string> = {
  popular:     'bg-yellow-100 text-yellow-800',
  muy_picante: 'bg-red-100 text-red-800',
  picante:     'bg-orange-100 text-orange-800',
  vegetariano: 'bg-green-100 text-green-800',
  vegano:      'bg-emerald-100 text-emerald-800',
  sin_gluten:  'bg-amber-100 text-amber-800',
};

export default function MenuPage() {
  const { getItemCount, setAddToOrderId } = useCartStore();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [selectedDishCategory, setSelectedDishCategory] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const activeOrderParam = searchParams?.get('activeOrder');

  const { data: menuData, isLoading, error } = useMenu();
  const { data: allTags = [] } = useDishTags();
  const categories = useMemo(() => menuData?.data ?? [], [menuData]);
  const cartItemCount = getItemCount();

  // Parámetros de URL: ?category=Postres&addToOrder=71
  const categoryParam = searchParams?.get('category');
  const addToOrderParam = searchParams?.get('addToOrder');
  const addToOrderId = addToOrderParam ? parseInt(addToOrderParam) : null;

  // Al montar: pre-seleccionar categoría y guardar orderId en el store
  useEffect(() => {
    if (addToOrderId) setAddToOrderId(addToOrderId);

    if (categoryParam && categories.length > 0) {
      const match = categories.find(
        (c: Category) => c.name.toLowerCase() === categoryParam.toLowerCase()
      );
      if (match) setSelectedCategory(match.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryParam, categories.length, addToOrderId]);

  const toggleTag = (code: string) =>
    setActiveTags(prev => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });

  const dishMatchesTags = (dish: Dish) => {
    if (activeTags.size === 0) return true;
    const codes = new Set((dish.tags ?? []).map(t => t.code));
    if (dish.isVegetarian) codes.add('vegetariano');
    if (dish.isVegan)      codes.add('vegano');
    if (dish.isGlutenFree) codes.add('sin_gluten');
    for (const code of activeTags) if (!codes.has(code)) return false;
    return true;
  };

  useEffect(() => {
    const candidateId = activeOrderParam || localStorage.getItem('current_order_id');
    if (!candidateId) return;

    // Verificar que la orden siga activa (no completada ni cancelada ni pagada)
    fetch(`/api/orders/${candidateId}`)
      .then(r => r.ok ? r.json() : null)
      .then((order: any) => {
        if (!order) { localStorage.removeItem('current_order_id'); return; }
        const status = (order.status ?? order.Status ?? '').toLowerCase();
        const isActive = !['completed', 'cancelled', 'paid'].includes(status);
        if (isActive) {
          setActiveOrderId(String(candidateId));
          localStorage.setItem('current_order_id', String(candidateId));
        } else {
          setActiveOrderId(null);
          localStorage.removeItem('current_order_id');
        }
      })
      .catch(() => {
        localStorage.removeItem('current_order_id');
        setActiveOrderId(null);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrderParam]);

  const handleAddToCart = (dish: Dish, catName: string) => {
    setSelectedDish(dish);
    setSelectedDishCategory(catName);
    setShowModal(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ChefHat className="w-16 h-16 text-primary-600 animate-bounce mx-auto mb-4" />
          <p className="text-xl text-gray-700">Cargando menú...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-red-600">Error al cargar el menú</p>
          <p className="text-sm text-gray-600 mt-2">Por favor, intenta de nuevo más tarde</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Banner modo "agregar a orden existente" */}
      {addToOrderId && (
        <div className="bg-gradient-to-r from-pink-500 to-rose-500 text-white px-4 py-2 flex items-center justify-between gap-3">
          <span className="text-sm font-medium">🍰 Agregando postres a tu orden #{addToOrderParam}</span>
          <button
            onClick={() => router.push(`/order-served/${addToOrderId}`)}
            className="flex items-center gap-1 text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded-full transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            Volver
          </button>
        </div>
      )}

      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">SmartMenu</h1>
              <p className="text-sm text-gray-600">{addToOrderId ? '🍰 Elige tus postres' : 'Menú Digital'}</p>
            </div>
            <div className="flex items-center gap-2">
              {activeOrderId && !addToOrderId && (
                <button
                  onClick={() => router.push(`/order-status/${activeOrderId}`)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full shadow-lg transition-colors text-sm font-semibold"
                >
                  <ClipboardList className="w-4 h-4" />
                  Ver mi orden
                </button>
              )}
              <Link href={addToOrderId ? `/cart?orderId=${addToOrderId}` : '/cart'}>
                <button className="relative bg-primary-600 text-white p-3 rounded-full shadow-lg hover:bg-primary-700 transition-colors">
                  <ShoppingCart className="w-6 h-6" />
                  {cartItemCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                      {cartItemCount}
                    </span>
                  )}
                </button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Search + Tag filters */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar platos..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Tags */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {allTags.map(tag => {
              const active = activeTags.has(tag.code);
              const s = TAG_STYLES[tag.code] ?? { activeBg: 'bg-gray-700', activeText: 'text-white', text: 'text-gray-700', bg: 'bg-gray-50' };
              return (
                <button
                  key={tag.code}
                  onClick={() => toggleTag(tag.code)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium border transition-all
                    ${active
                      ? `${s.activeBg} ${s.activeText} border-transparent shadow-sm`
                      : `bg-white ${s.text} border-gray-200 hover:${s.bg}`
                    }`}
                >
                  <span className="text-base leading-none">{tag.icon}</span>
                  {tag.label}
                </button>
              );
            })}
            {activeTags.size > 0 && (
              <button
                onClick={() => setActiveTags(new Set())}
                className="flex items-center gap-1 px-3 py-2 rounded-full text-xs text-gray-400 hover:text-red-500 whitespace-nowrap border border-gray-200 hover:border-red-200 transition-colors"
              >
                ✕ Limpiar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Category tabs */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-3 overflow-x-auto">
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors ${
                selectedCategory === null
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Todos
            </button>
            {categories.map((category: Category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors ${
                  selectedCategory === category.id
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Dishes */}
      <div className="container mx-auto px-4 py-6">
        {categories
          .filter((cat: Category) => !selectedCategory || cat.id === selectedCategory)
          .map((category: Category) => {
            const visibleDishes = category.dishes.filter((dish: Dish) => {
              if (searchQuery) {
                const q = searchQuery.toLowerCase();
                if (!dish.name.toLowerCase().includes(q) && !dish.description.toLowerCase().includes(q)) return false;
              }
              return dishMatchesTags(dish);
            });

            return (
              <div key={category.id} className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-1">{category.name}</h2>
                {category.description && (
                  <p className="text-gray-600 mb-4">{category.description}</p>
                )}

                {visibleDishes.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No se encontraron platos con los filtros seleccionados</p>
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {visibleDishes.map((dish: Dish) => (
                      <motion.div
                        key={dish.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow"
                      >
                        {dish.imageUrl && (
                          <div className="h-48 bg-gray-200 overflow-hidden">
                            <img
                              src={dish.imageUrl}
                              alt={dish.name}
                              className="w-full h-full object-cover"
                              onError={e => {
                                e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect fill='%23e5e7eb' width='400' height='300'/%3E%3Ctext fill='%239ca3af' font-size='20' x='50%25' y='50%25' text-anchor='middle' dy='.3em'%3EPlato%3C/text%3E%3C/svg%3E";
                                e.currentTarget.onerror = null;
                              }}
                            />
                          </div>
                        )}

                        <div className="p-4">
                          {/* Tag badges */}
                          {(() => {
                            const tagList = dish.tags && dish.tags.length > 0
                              ? dish.tags
                              : [
                                  ...(dish.isVegetarian ? [{ code: 'vegetariano', label: 'Vegetariano', icon: '🥬' }] : []),
                                  ...(dish.isVegan      ? [{ code: 'vegano',      label: 'Vegano',      icon: '🌱' }] : []),
                                  ...(dish.isGlutenFree ? [{ code: 'sin_gluten',  label: 'Sin gluten',  icon: '🌾' }] : []),
                                ];
                            return tagList.length > 0 ? (
                              <div className="flex gap-1.5 mb-2 flex-wrap">
                                {tagList.map(tag => (
                                  <span
                                    key={tag.code}
                                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${BADGE_STYLES[tag.code] ?? 'bg-gray-100 text-gray-700'}`}
                                  >
                                    {tag.icon} {tag.label}
                                  </span>
                                ))}
                              </div>
                            ) : null;
                          })()}

                          <h3 className="text-lg font-semibold text-gray-900 mb-2">{dish.name}</h3>
                          <p className="text-sm text-gray-600 mb-3 line-clamp-2">{dish.description}</p>

                          <div className="flex items-center justify-between mt-4">
                            <div>
                              <p className="text-2xl font-bold text-primary-600">
                                RD${dish.price.toFixed(2)}
                              </p>
                              <p className="text-xs text-gray-500 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {dish.preparationTimeMinutes} min
                              </p>
                            </div>
                            <button
                              onClick={() => handleAddToCart(dish, category.name)}
                              disabled={!dish.isAvailable}
                              className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
                            >
                              {dish.isAvailable ? 'Agregar' : 'No disponible'}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

        {categories.filter((cat: Category) => !selectedCategory || cat.id === selectedCategory).length === 0 && (
          <div className="text-center py-12">
            <ChefHat className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-xl text-gray-600">No hay platos disponibles en este momento</p>
          </div>
        )}
      </div>

      {selectedDish && (
        <DishModal
          dish={selectedDish}
          isOpen={showModal}
          onClose={() => { setShowModal(false); setSelectedDish(null); setSelectedDishCategory(''); }}
          categoryName={selectedDishCategory}
        />
      )}
    </div>
  );
}
