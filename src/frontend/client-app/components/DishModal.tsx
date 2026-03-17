'use client';

import { X, Plus, Minus, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useCartStore } from '@/lib/stores/cartStore';
import type { Dish } from '@/types';

const DRINK_KEYWORDS = ['cerveza', 'vino', 'cóctel', 'coctel', 'refresco', 'agua', 'cafe', 'café', 'té', 'te', 'bebida', 'margarita', 'ron', 'whisky', 'whiskey', 'colada', 'mojito', 'daiquiri', 'soda', 'jugo', 'limonada', 'batido', 'smoothie', 'copa', 'trago', 'coca', 'pepsi', 'sprite', 'fanta', 'ginger', 'tónica', 'tonica', 'cerveza', 'lager', 'pilsner'];

function detectIsDrink(name: string): boolean {
  const lower = name.toLowerCase();
  return DRINK_KEYWORDS.some((k) => lower.includes(k));
}

const MEAT_KEYWORDS = ['carne', 'filete', 'res', 'pollo', 'cerdo', 'chuleta', 'bistec', 'steak', 'costilla', 'lomo', 'pechuga', 'ternera'];

function detectHasMeat(name: string): boolean {
  const lower = name.toLowerCase();
  return MEAT_KEYWORDS.some((k) => lower.includes(k));
}

const COURSE_OPTIONS = [
  { value: 0, label: 'Entrada',      icon: '🥗', desc: 'Sirve primero' },
  { value: 1, label: 'Plato Fuerte', icon: '🍖', desc: 'Plato principal' },
  { value: 2, label: 'Postre',       icon: '🍰', desc: 'Al final' },
];

const LIGA_OPTIONS = [
  { value: '', label: 'Solo / Sin liga' },
  { value: 'Soda',             label: '🫧 Soda' },
  { value: 'Agua Tónica',      label: '💧 Agua Tónica' },
  { value: 'Jugo de Naranja',  label: '🍊 Jugo de Naranja' },
  { value: 'Jugo de Piña',     label: '🍍 Jugo de Piña' },
  { value: 'Refresco Cola',    label: '🥤 Refresco Cola' },
  { value: 'Agua Natural',     label: '💦 Agua Natural' },
  { value: 'Ginger Ale',       label: '🫙 Ginger Ale' },
  { value: 'Jugo de Tomate',   label: '🍅 Jugo de Tomate' },
];

interface DishModalProps {
  dish: Dish | null;
  isOpen: boolean;
  onClose: () => void;
  categoryName?: string;
}

const DESSERT_CATEGORY_KEYWORDS = ['postre', 'dulce', 'dessert', 'helado', 'repostería'];
const STARTER_CATEGORY_KEYWORDS = ['entrada', 'aperitivo', 'starter'];

export function DishModal({ dish, isOpen, onClose, categoryName }: DishModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [activeImageIdx, setActiveImageIdx] = useState(0);

  // Preferencias comida
  const [meatCooking, setMeatCooking] = useState<string>('');
  const [sideDish, setSideDish] = useState<string>('');
  const [customizations, setCustomizations] = useState<string>('');
  const [allergies, setAllergies] = useState<string>('');
  const [courseTiming, setCourseTiming] = useState<number>(1); // default PlatoFuerte

  // Preferencias bebida
  const [drinkTiming, setDrinkTiming] = useState<string>('');
  const [withAlcohol, setWithAlcohol] = useState<boolean | null>(null);
  const [liga, setLiga] = useState<string>('');

  const addItem = useCartStore((state) => state.addItem);

  useEffect(() => {
    if (isOpen && dish) {
      document.body.style.overflow = 'hidden';
      const catL = (categoryName ?? (dish as any).categoryName ?? '').toLowerCase();
      let course = dish.defaultCourse ?? 1;
      if (STARTER_CATEGORY_KEYWORDS.some(k => catL.includes(k))) course = 0;
      else if (DESSERT_CATEGORY_KEYWORDS.some(k => catL.includes(k))) course = 2;
      setCourseTiming(course);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, dish, categoryName]);

  if (!dish) return null;

  const isDrink = detectIsDrink(dish.name);
  const hasMeat = !isDrink && detectHasMeat(dish.name);
  const catLower = (categoryName ?? (dish as any).categoryName ?? '').toLowerCase();
  const isDessert = courseTiming === 2
    || DESSERT_CATEGORY_KEYWORDS.some(k => catLower.includes(k));
  const isAlcoholic = withAlcohol === true;

  const handleAddToCart = () => {
    const preferences: any = {};

    if (isDrink) {
      if (drinkTiming) preferences.drinkTiming = drinkTiming;
      if (withAlcohol !== null) preferences.withAlcohol = withAlcohol;
      if (isAlcoholic && liga) preferences.liga = liga;
      // Las bebidas usan DrinkTiming como courseTiming (Before→0, During→1, After→2)
      const dtMap: Record<string, number> = { Before: 0, During: 1, After: 2 };
      if (drinkTiming && dtMap[drinkTiming] !== undefined) {
        preferences.courseTiming = dtMap[drinkTiming];
      }
    } else {
      if (meatCooking) preferences.meatCooking = meatCooking;
      if (sideDish) preferences.sideDish = sideDish;
      if (customizations) preferences.customizations = customizations;
      if (allergies) preferences.allergies = allergies;
      preferences.courseTiming = courseTiming;
    }

    addItem({
      dishId: dish.id,
      dishName: dish.name,
      quantity,
      unitPrice: dish.price,
      notes: notes || undefined,
      ...preferences,
    });
    toast.success(`${quantity}x ${dish.name} agregado al carrito`);
    onClose();
    // Reset
    setQuantity(1);
    setNotes('');
    setDrinkTiming('');
    setWithAlcohol(null);
    setLiga('');
    setMeatCooking('');
    setSideDish('');
    setCustomizations('');
    setAllergies('');
    setCourseTiming(1);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 overflow-hidden"
          />

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto pointer-events-none"
          >
            <div className="pointer-events-auto">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden my-8"
              >
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/90 hover:bg-white shadow-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="overflow-y-auto max-h-[calc(100vh-2rem)]">
                  {(() => {
                    const images: { imageUrl: string }[] = (dish as any).images?.length > 0
                      ? (dish as any).images
                      : dish.imageUrl ? [{ imageUrl: dish.imageUrl }] : [];
                    if (images.length === 0) return null;
                    return (
                      <div className="relative h-64 bg-gradient-to-br from-primary-100 to-secondary-100">
                        <img
                          src={images[activeImageIdx]?.imageUrl ?? images[0]?.imageUrl}
                          alt={dish.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect fill='%23e5e7eb' width='400' height='300'/%3E%3Ctext fill='%239ca3af' font-size='20' x='50%25' y='50%25' text-anchor='middle' dy='.3em'%3EPlato%3C/text%3E%3C/svg%3E";
                            e.currentTarget.onerror = null;
                          }}
                        />
                        {images.length > 1 && (
                          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                            {images.map((_: any, idx: number) => (
                              <button
                                key={idx}
                                onClick={() => setActiveImageIdx(idx)}
                                className={`w-2.5 h-2.5 rounded-full transition-all ${
                                  idx === activeImageIdx ? 'bg-white scale-110 shadow' : 'bg-white/50'
                                }`}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  <div className="p-6">
                    {/* Header */}
                    <div className="mb-4">
                      <h2 className="text-3xl font-bold text-gray-900 mb-2">{dish.name}</h2>
                      <div className="flex items-center gap-3 flex-wrap">
                        {dish.isVegetarian && (
                          <span className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full">🌱 Vegetariano</span>
                        )}
                        {dish.isVegan && (
                          <span className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full">🌾 Vegano</span>
                        )}
                        {dish.isGlutenFree && (
                          <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">🚫 Sin Gluten</span>
                        )}
                      </div>
                    </div>

                    <p className="text-gray-600 text-lg mb-6 leading-relaxed">{dish.description}</p>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Clock className="w-5 h-5 text-primary-600" />
                        <span>{dish.preparationTimeMinutes} minutos</span>
                      </div>
                    </div>

                    <div className="mb-6">
                      <p className="text-4xl font-bold text-primary-600">RD$ {dish.price.toFixed(2)}</p>
                    </div>

                    {/* Cantidad */}
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Cantidad</label>
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => setQuantity(Math.max(1, quantity - 1))}
                          className="p-3 rounded-full bg-gray-100 text-gray-700 hover:bg-primary-600 hover:text-white transition-colors"
                          disabled={quantity <= 1}
                        >
                          <Minus className="w-5 h-5" />
                        </button>
                        <span className="text-2xl font-bold w-12 text-center text-gray-700">{quantity}</span>
                        <button
                          onClick={() => setQuantity(Math.min(10, quantity + 1))}
                          className="p-3 rounded-full bg-gray-100 text-gray-700 hover:bg-primary-600 hover:text-white transition-colors"
                          disabled={quantity >= 10}
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    {/* ─── SECCIÓN BEBIDAS ─── */}
                    {isDrink && (
                      <>
                        {/* ¿Con o sin alcohol? */}
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">¿Con o sin alcohol?</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => setWithAlcohol(true)}
                              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors text-gray-700 ${withAlcohol === true ? 'bg-primary-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
                            >
                              🍹 Con Alcohol
                            </button>
                            <button
                              onClick={() => setWithAlcohol(false)}
                              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors text-gray-700 ${withAlcohol === false ? 'bg-primary-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
                            >
                              🥤 Sin Alcohol
                            </button>
                          </div>
                        </div>

                        {/* Liga (solo si con alcohol) */}
                        {isAlcoholic && (
                          <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">¿Con qué liga?</label>
                            <div className="grid grid-cols-2 gap-2">
                              {LIGA_OPTIONS.map((opt) => (
                                <button
                                  key={opt.value}
                                  onClick={() => setLiga(opt.value)}
                                  className={`px-3 py-2 rounded-lg text-sm text-left transition-colors text-gray-700 ${liga === opt.value ? 'bg-primary-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* ¿Cuándo quieres tu bebida? */}
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">¿Cuándo deseas tu bebida?</label>
                          <div className="grid grid-cols-3 gap-2 text-gray-700">
                            {[
                              { key: 'Before', label: '🥗 Con la entrada' },
                              { key: 'During', label: '🍖 Con el plato fuerte' },
                              { key: 'After',  label: '🍰 Con el postre' },
                            ].map((opt) => (
                              <button
                                key={opt.key}
                                onClick={() => setDrinkTiming(opt.key)}
                                className={`px-2 py-2 rounded-lg text-xs font-medium text-center transition-colors ${drinkTiming === opt.key ? 'bg-primary-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Notas para bebida */}
                        <div className="mb-6">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Notas (opcional)</label>
                          <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Ej: Con hielo, sin hielo, temperatura..."
                            rows={2}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 text-gray-700 focus:ring-primary-500 focus:border-transparent resize-none"
                          />
                        </div>
                      </>
                    )}

                    {/* ─── SECCIÓN COMIDA ─── */}
                    {!isDrink && (
                      <>
                        {/* ¿Cuándo quieres este plato? */}
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">¿Cuándo lo quieres servir?</label>
                          <div className="grid grid-cols-3 gap-2">
                            {COURSE_OPTIONS.map((opt) => (
                              <button
                                key={opt.value}
                                onClick={() => setCourseTiming(opt.value)}
                                className={`flex flex-col items-center px-2 py-3 rounded-lg text-sm font-medium transition-colors ${courseTiming === opt.value ? 'bg-primary-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                              >
                                <span className="text-xl mb-1">{opt.icon}</span>
                                <span className="font-semibold text-xs">{opt.label}</span>
                                <span className={`text-xs mt-0.5 ${courseTiming === opt.value ? 'text-white/70' : 'text-gray-400'}`}>{opt.desc}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Nivel de cocción (si tiene carne) */}
                        {hasMeat && (
                          <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Nivel de cocción</label>
                            <div className="grid grid-cols-3 gap-2 text-gray-700">
                              {[
                                { key: 'Rare',     label: '🩸 Poco' },
                                { key: 'Medium',   label: '🔥 Medio' },
                                { key: 'WellDone', label: '✅ Bien cocido' },
                              ].map((opt) => (
                                <button
                                  key={opt.key}
                                  onClick={() => setMeatCooking(opt.key)}
                                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${meatCooking === opt.key ? 'bg-primary-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Guarnición — no aplica para postres */}
                        {!isDessert && <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Guarnición</label>
                          <select
                            value={sideDish}
                            onChange={(e) => setSideDish(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600 text-gray-700"
                          >
                            <option value="">Sin preferencia</option>
                            <option value="Arroz">Arroz</option>
                            <option value="Papas Fritas">Papas Fritas</option>
                            <option value="Ensalada">Ensalada</option>
                            <option value="Vegetales">Vegetales al Vapor</option>
                            <option value="Puré">Puré de Papa</option>
                          </select>
                        </div>}

                        {/* Personalizaciones */}
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Personalizaciones (opcional)</label>
                          <input
                            type="text"
                            value={customizations}
                            onChange={(e) => setCustomizations(e.target.value)}
                            placeholder="Ej: sin cebolla, extra queso"
                            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600 text-gray-700"
                          />
                        </div>

                        {/* Alergias */}
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">¿Alergias? (importante)</label>
                          <input
                            type="text"
                            value={allergies}
                            onChange={(e) => setAllergies(e.target.value)}
                            placeholder="Ej: alérgico a mariscos, nueces"
                            className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-orange-50 text-gray-700"
                          />
                        </div>

                        {/* Notas adicionales */}
                        <div className="mb-6">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Notas adicionales (opcional)</label>
                          <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Ej: Sin sal, extra salsa, término medio..."
                            rows={3}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 text-gray-700 focus:ring-primary-500 focus:border-transparent resize-none"
                          />
                        </div>
                      </>
                    )}

                    {/* Botones */}
                    <div className="flex gap-3">
                      <button
                        onClick={onClose}
                        className="flex-1 px-6 py-4 border-2 border-gray-300 rounded-xl font-semibold hover:bg-gray-50 text-gray-700 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleAddToCart}
                        className="flex-1 px-6 py-4 bg-gradient-to-r from-primary-600 to-secondary-600 text-white rounded-xl font-semibold hover:from-primary-700 hover:to-secondary-700 transition-all shadow-lg hover:shadow-xl"
                      >
                        Agregar RD$ {(dish.price * quantity).toFixed(2)}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
