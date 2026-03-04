'use client';

import { X, Plus, Minus, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useCartStore } from '@/lib/stores/cartStore';
import type { Dish } from '@/types';

interface DishModalProps {
  dish: Dish | null;
  isOpen: boolean;
  onClose: () => void;
}

export function DishModal({ dish, isOpen, onClose }: DishModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  
  // Preferencias
  const [drinkTiming, setDrinkTiming] = useState<string>('');
  const [withAlcohol, setWithAlcohol] = useState<boolean | null>(null);
  const [meatCooking, setMeatCooking] = useState<string>('');
  const [sideDish, setSideDish] = useState<string>('');
  const [customizations, setCustomizations] = useState<string>('');
  const [allergies, setAllergies] = useState<string>('');
  
  const addItem = useCartStore((state) => state.addItem);

  // Bloquear scroll del fondo cuando el modal está abierto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!dish) return null;

  // Detectar tipo de plato
  const isDrink = dish.name.toLowerCase().includes('vino') || 
                  dish.name.toLowerCase().includes('cerveza') ||
                  dish.name.toLowerCase().includes('cóctel') ||
                  dish.name.toLowerCase().includes('refresco');
  
  const hasMeat = dish.name.toLowerCase().includes('carne') || 
                  dish.name.toLowerCase().includes('filete') ||
                  dish.name.toLowerCase().includes('res') ||
                  dish.name.toLowerCase().includes('pollo');

  const handleAddToCart = () => {
    const preferences: any = {};
    if (drinkTiming) preferences.drinkTiming = drinkTiming;
    if (withAlcohol !== null) preferences.withAlcohol = withAlcohol;
    if (meatCooking) preferences.meatCooking = meatCooking;
    if (sideDish) preferences.sideDish = sideDish;
    if (customizations) preferences.customizations = customizations;
    if (allergies) preferences.allergies = allergies;

    addItem({
      dishId: dish.id,
      dishName: dish.name,
      quantity,
      unitPrice: dish.price,
      notes: notes || undefined,
      ...preferences
    });
    toast.success(`${quantity}x ${dish.name} agregado al carrito`);
    onClose();
    setQuantity(1);
    setNotes('');
    setDrinkTiming('');
    setWithAlcohol(null);
    setMeatCooking('');
    setSideDish('');
    setCustomizations('');
    setAllergies('');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop: pantalla completa, sin scroll */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 overflow-hidden"
          />

          {/* Contenedor centrado: flex para centrar el modal */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto pointer-events-none"
          >
            <div className="pointer-events-auto">
              {/* Modal */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden my-8"
              >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/90 hover:bg-white shadow-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Content */}
            <div className="overflow-y-auto max-h-[calc(100vh-2rem)]">
              {/* Image */}
              {dish.imageUrl && (
                <div className="relative h-64 bg-gradient-to-br from-primary-100 to-secondary-100">
                  <img
                    src={dish.imageUrl}
                    alt={dish.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect fill='%23e5e7eb' width='400' height='300'/%3E%3Ctext fill='%239ca3af' font-size='20' x='50%25' y='50%25' text-anchor='middle' dy='.3em'%3EPlato%3C/text%3E%3C/svg%3E";
                      e.currentTarget.onerror = null;
                    }}
                  />
                </div>
              )}

              <div className="p-6">
                {/* Header */}
                <div className="mb-4">
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">{dish.name}</h2>
                  <div className="flex items-center gap-3 flex-wrap">
                    {dish.isVegetarian && (
                      <span className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full">
                        🌱 Vegetariano
                      </span>
                    )}
                    {dish.isVegan && (
                      <span className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full">
                        🌾 Vegano
                      </span>
                    )}
                    {dish.isGlutenFree && (
                      <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                        🚫 Sin Gluten
                      </span>
                    )}
                  </div>
                </div>

                {/* Description */}
                <p className="text-gray-600 text-lg mb-6 leading-relaxed">
                  {dish.description}
                </p>

                {/* Info */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock className="w-5 h-5 text-primary-600" />
                    <span>{dish.preparationTimeMinutes} minutos</span>
                  </div>
                  {/* Puedes agregar calorías aquí cuando estén disponibles */}
                </div>

                {/* Price */}
                <div className="mb-6">
                  <p className="text-4xl font-bold text-primary-600">
                    RD$ {dish.price.toFixed(2)}
                  </p>
                </div>

                {/* Quantity */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cantidad
                  </label>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="p-3 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                      disabled={quantity <= 1}
                    >
                      <Minus className="w-5 h-5" />
                    </button>
                    <span className="text-2xl font-bold w-12 text-center">{quantity}</span>
                    <button
                      onClick={() => setQuantity(Math.min(10, quantity + 1))}
                      className="p-3 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                      disabled={quantity >= 10}
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Drink Timing (if drink) */}
                {isDrink && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ¿Cuándo deseas tu bebida?
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setDrinkTiming('Before')}
                        className={`px-3 py-2 rounded-lg text-sm ${drinkTiming === 'Before' ? 'bg-primary-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
                      >
                        Antes
                      </button>
                      <button
                        onClick={() => setDrinkTiming('During')}
                        className={`px-3 py-2 rounded-lg text-sm ${drinkTiming === 'During' ? 'bg-primary-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
                      >
                        Durante
                      </button>
                      <button
                        onClick={() => setDrinkTiming('After')}
                        className={`px-3 py-2 rounded-lg text-sm ${drinkTiming === 'After' ? 'bg-primary-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
                      >
                        Después
                      </button>
                    </div>
                  </div>
                )}

                {/* With/Without Alcohol (if drink) */}
                {isDrink && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ¿Con o sin alcohol?
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setWithAlcohol(true)}
                        className={`px-3 py-2 rounded-lg text-sm ${withAlcohol === true ? 'bg-primary-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
                      >
                        Con Alcohol
                      </button>
                      <button
                        onClick={() => setWithAlcohol(false)}
                        className={`px-3 py-2 rounded-lg text-sm ${withAlcohol === false ? 'bg-primary-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
                      >
                        Sin Alcohol
                      </button>
                    </div>
                  </div>
                )}

                {/* Meat Cooking (if has meat) */}
                {hasMeat && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nivel de cocción
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {['Rare', 'Medium', 'WellDone'].map((level) => (
                        <button
                          key={level}
                          onClick={() => setMeatCooking(level)}
                          className={`px-3 py-2 rounded-lg text-xs ${meatCooking === level ? 'bg-primary-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
                        >
                          {level === 'Rare' ? 'Poco' : level === 'Medium' ? 'Medio' : 'Bien cocido'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Side Dish */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Guarnición
                  </label>
                  <select
                    value={sideDish}
                    onChange={(e) => setSideDish(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600"
                  >
                    <option value="">Sin preferencia</option>
                    <option value="Arroz">Arroz</option>
                    <option value="Papas Fritas">Papas Fritas</option>
                    <option value="Ensalada">Ensalada</option>
                    <option value="Vegetales">Vegetales al Vapor</option>
                    <option value="Puré">Puré de Papa</option>
                  </select>
                </div>

                {/* Customizations */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Personalizaciones (opcional)
                  </label>
                  <input
                    type="text"
                    value={customizations}
                    onChange={(e) => setCustomizations(e.target.value)}
                    placeholder="Ej: sin cebolla, extra queso"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600"
                  />
                </div>

                {/* Allergies */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ¿Alergias? (importante)
                  </label>
                  <input
                    type="text"
                    value={allergies}
                    onChange={(e) => setAllergies(e.target.value)}
                    placeholder="Ej: alérgico a mariscos, nueces"
                    className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-orange-50"
                  />
                </div>

                {/* Notes */}
                <div className="mb-6">
                  <label
                    htmlFor="notes"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Notas adicionales (opcional)
                  </label>
                  <textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ej: Sin sal, extra salsa, término medio..."
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={onClose}
                    className="flex-1 px-6 py-4 border-2 border-gray-300 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
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
