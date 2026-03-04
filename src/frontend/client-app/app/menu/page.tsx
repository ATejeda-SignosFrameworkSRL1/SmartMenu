'use client';

import { useCartStore } from '@/lib/stores/cartStore';
import { useState } from 'react';
import { ShoppingCart, Search, Leaf, ChefHat, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Dish, Category } from '@/types';
import { useMenu } from '@/lib/hooks';
import Link from 'next/link';
import { DishModal } from '@/components/DishModal';

export default function MenuPage() {
  const { getItemCount } = useCartStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [filters, setFilters] = useState({
    vegetarian: false,
    vegan: false,
    glutenFree: false,
  });
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [showModal, setShowModal] = useState(false);

  const { data: menuData, isLoading, error } = useMenu();

  const categories = menuData?.data || [];
  const cartItemCount = getItemCount();

  const handleAddToCart = (dish: Dish) => {
    setSelectedDish(dish);
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
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">SmartMenu</h1>
              <p className="text-sm text-gray-600">Menú Digital</p>
            </div>
            
            {/* Cart Button */}
            <Link href="/cart">
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
      </header>

      {/* Search Bar */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar platos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
            <button
              onClick={() => setFilters(prev => ({ ...prev, vegetarian: !prev.vegetarian }))}
              className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-colors ${
                filters.vegetarian
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Leaf className="w-4 h-4" />
              Vegetariano
            </button>
            <button
              onClick={() => setFilters(prev => ({ ...prev, vegan: !prev.vegan }))}
              className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-colors ${
                filters.vegan
                  ? 'bg-green-700 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Leaf className="w-4 h-4" />
              Vegano
            </button>
            <button
              onClick={() => setFilters(prev => ({ ...prev, glutenFree: !prev.glutenFree }))}
              className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-colors ${
                filters.glutenFree
                  ? 'bg-amber-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Sin Gluten
            </button>
          </div>
        </div>
      </div>

      {/* Categories */}
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

      {/* Menu Items */}
      <div className="container mx-auto px-4 py-6">
        {categories
          .filter((cat: Category) => !selectedCategory || cat.id === selectedCategory)
          .map((category: Category) => (
            <div key={category.id} className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{category.name}</h2>
              {category.description && (
                <p className="text-gray-600 mb-4">{category.description}</p>
              )}
              
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {category.dishes
                  .filter((dish: Dish) => {
                    if (searchQuery && !dish.name.toLowerCase().includes(searchQuery.toLowerCase()) && !dish.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
                    if (filters.vegetarian && !dish.isVegetarian) return false;
                    if (filters.vegan && !dish.isVegan) return false;
                    if (filters.glutenFree && !dish.isGlutenFree) return false;
                    return true;
                  })
                  .map((dish: Dish) => (
                    <motion.div
                      key={dish.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow"
                    >
                      {/* Image */}
                      {dish.imageUrl && (
                        <div className="h-48 bg-gray-200 overflow-hidden">
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

                      {/* Content */}
                      <div className="p-4">
                        {/* Tags */}
                        <div className="flex gap-2 mb-2 flex-wrap">
                          {dish.isVegetarian && (
                            <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full flex items-center gap-1">
                              <Leaf className="w-3 h-3" />
                              Vegetariano
                            </span>
                          )}
                          {dish.isVegan && (
                            <span className="bg-green-200 text-green-900 text-xs px-2 py-1 rounded-full flex items-center gap-1">
                              <Leaf className="w-3 h-3" />
                              Vegano
                            </span>
                          )}
                          {dish.isGlutenFree && (
                            <span className="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-full">
                              Sin Gluten
                            </span>
                          )}
                        </div>

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
                            onClick={() => handleAddToCart(dish)}
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
              
              {category.dishes.filter((dish: Dish) => {
                if (searchQuery && !dish.name.toLowerCase().includes(searchQuery.toLowerCase()) && !dish.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
                if (filters.vegetarian && !dish.isVegetarian) return false;
                if (filters.vegan && !dish.isVegan) return false;
                if (filters.glutenFree && !dish.isGlutenFree) return false;
                return true;
              }).length === 0 && (
                <p className="text-center text-gray-500 py-8">No se encontraron platos con los filtros seleccionados</p>
              )}
            </div>
          ))}

        {categories.filter((cat: Category) => !selectedCategory || cat.id === selectedCategory).length === 0 && (
          <div className="text-center py-12">
            <ChefHat className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-xl text-gray-600">No hay platos disponibles en este momento</p>
          </div>
        )}
      </div>

      {/* Dish Modal */}
      {selectedDish && (
        <DishModal
          dish={selectedDish}
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            setSelectedDish(null);
          }}
        />
      )}
    </div>
  );
}
