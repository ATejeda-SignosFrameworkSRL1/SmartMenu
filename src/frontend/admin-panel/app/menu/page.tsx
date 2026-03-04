'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Edit, Trash2, Eye, EyeOff, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { MainLayout } from '@/components/layout/MainLayout';

const api = axios.create({
  baseURL: '',
});

interface Dish {
  id: number;
  name: string;
  description: string;
  price: number;
  categoryId: number;
  categoryName: string;
  imageUrl?: string;
  isAvailable: boolean;
  isVegetarian: boolean;
  isVegan: boolean;
  isGlutenFree: boolean;
  preparationTimeMinutes: number;
  tags?: { id: number; code: string; label: string; icon: string }[];
}

interface Category {
  id: number;
  name: string;
  dishCount: number;
}

export default function MenuManagementPage() {
  const router = useRouter();
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [dishTags, setDishTags] = useState<{ id: number; code: string; label: string; icon: string }[]>([]);
  const [kitchenBarZones, setKitchenBarZones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingDish, setEditingDish] = useState<Dish | null>(null);

  useEffect(() => {
    // Si llegamos con token/user en la URL (redirect desde login), guardarlos primero
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tokenFromUrl = params.get('token');
      const userFromUrl = params.get('user');
      if (tokenFromUrl && userFromUrl) {
        localStorage.setItem('admin_token', tokenFromUrl);
        localStorage.setItem('admin_user', userFromUrl);
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
    const token = localStorage.getItem('admin_token');
    if (!token) {
      window.location.href = 'https://172.31.98.64:3000/login';
      return;
    }
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [dishesRes, categoriesRes, tagsRes, kitchensRes, barsRes] = await Promise.all([
        api.get('/api/dish', { params: { all: true } }),
        api.get('/api/category'),
        api.get('/api/dishtag').catch(() => ({ data: [] })),
        api.get('/api/zone', { params: { type: 'Kitchen' } }).catch(() => ({ data: [] })),
        api.get('/api/zone', { params: { type: 'Bar' } }).catch(() => ({ data: [] })),
      ]);
      setDishes(Array.isArray(dishesRes.data) ? dishesRes.data : []);
      setCategories(Array.isArray(categoriesRes.data) ? categoriesRes.data : []);
      setDishTags(Array.isArray(tagsRes.data) ? tagsRes.data : []);
      setKitchenBarZones([...(kitchensRes.data ?? []), ...(barsRes.data ?? [])]);
    } catch (error) {
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const filteredDishes = dishes.filter((dish) => {
    const matchesSearch =
      dish.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dish.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      !selectedCategory || dish.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const toggleAvailability = async (dishId: number) => {
    try {
      await api.patch(`/api/dish/${dishId}/toggle-availability`);
      toast.success('Disponibilidad actualizada');
      loadData();
    } catch (error) {
      toast.error('Error al actualizar');
    }
  };

  const deleteDish = async (dishId: number) => {
    if (!confirm('¿Eliminar este platillo?')) return;
    try {
      await api.delete(`/api/dish/${dishId}`);
      toast.success('Platillo eliminado');
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error al eliminar');
    }
  };

  if (loading) {
    return (
      <MainLayout title="Gestión de Menú" subtitle="Cargando...">
        <div className="flex items-center justify-center py-12">
          <div className="text-xl">Cargando...</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Gestión de Menú" subtitle={`${dishes.length} platillos totales`}>
    <div className="space-y-6">
      {/* Acciones y filtros */}
      <div className="bg-white rounded-lg border p-4">
          <div className="flex justify-between items-center mb-4">
            <div />
            <button
              onClick={() => {
                setEditingDish(null);
                setShowModal(true);
              }}
              className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Agregar Platillo
            </button>
          </div>

          {/* Filters */}
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar platillos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <select
              value={selectedCategory || ''}
              onChange={(e) =>
                setSelectedCategory(e.target.value ? Number(e.target.value) : null)
              }
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">Todas las categorías</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name} ({cat.dishCount})
                </option>
              ))}
            </select>
          </div>
      </div>

      {/* Dishes Grid */}
      <div className="py-4">
        {filteredDishes.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No se encontraron platillos</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDishes.map((dish) => (
              <div
                key={dish.id}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
              >
                {/* Image */}
                {dish.imageUrl && (
                  <div className="h-48 bg-gray-200">
                    <img
                      src={dish.imageUrl.startsWith('http') ? dish.imageUrl : ('') + dish.imageUrl}
                      alt={dish.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div className="p-4">
                  {/* Name & Price */}
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-bold text-gray-900">{dish.name}</h3>
                    <span className="text-lg font-bold text-primary-600">
                      RD$ {dish.price.toFixed(2)}
                    </span>
                  </div>

                  {/* Category */}
                  <p className="text-sm text-gray-500 mb-2">{dish.categoryName}</p>

                  {/* Description */}
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {dish.description}
                  </p>

                  {/* Tags */}
                  <div className="flex gap-2 mb-3 flex-wrap">
                    {(dish as Dish).tags?.map((t) => (
                      <span key={t.id} className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">
                        {t.icon} {t.label}
                      </span>
                    ))}
                    {dish.isVegetarian && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">🌱 Vegetariano</span>
                    )}
                    {dish.isVegan && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">🌾 Vegano</span>
                    )}
                    {dish.isGlutenFree && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">🚫 Sin Gluten</span>
                    )}
                  </div>

                  {/* Status */}
                  <div className="mb-3">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        dish.isAvailable
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {dish.isAvailable ? '● Disponible' : '○ No disponible'}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleAvailability(dish.id)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                      title="Toggle disponibilidad"
                    >
                      {dish.isAvailable ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setEditingDish(dish);
                        setShowModal(true);
                      }}
                      className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
                    >
                      <Edit className="w-4 h-4" />
                      Editar
                    </button>
                    <button
                      onClick={() => deleteDish(dish.id)}
                      className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <DishFormModal
          dish={editingDish}
          categories={categories}
          dishTags={dishTags}
          kitchenBarZones={kitchenBarZones}
          onClose={() => {
            setShowModal(false);
            setEditingDish(null);
          }}
          onSuccess={() => {
            setShowModal(false);
            setEditingDish(null);
            loadData();
          }}
        />
      )}
    </div>
    </MainLayout>
  );
}

// Modal Component
function DishFormModal({
  dish,
  categories,
  dishTags,
  kitchenBarZones,
  onClose,
  onSuccess,
}: {
  dish: Dish | null;
  categories: Category[];
  dishTags: { id: number; code: string; label: string; icon: string }[];
  kitchenBarZones: any[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    name: dish?.name || '',
    description: dish?.description || '',
    price: dish?.price || 0,
    categoryId: dish?.categoryId || categories[0]?.id || 1,
    imageUrl: dish?.imageUrl || '',
    preparationTimeMinutes: dish?.preparationTimeMinutes || 15,
    isVegetarian: dish?.isVegetarian || false,
    isVegan: dish?.isVegan || false,
    isGlutenFree: dish?.isGlutenFree || false,
    tagIds: (dish?.tags ?? []).map((t: any) => t.id),
    kitchenZoneId: (dish as any)?.kitchenZoneId ?? (dish as any)?.KitchenZoneId ?? null as number | null,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('admin_token');
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const payload = { ...formData, tagIds: formData.tagIds };

      if (dish) {
        await api.put(`/api/dish/${dish.id}`, payload);
        toast.success('Platillo actualizado');
      } else {
        await api.post('/api/dish', payload);
        toast.success('Platillo creado');
      }
      onSuccess();
    } catch (error) {
      toast.error('Error al guardar');
    }
  };

  const toggleTag = (id: number) => {
    setFormData((prev) => ({
      ...prev,
      tagIds: prev.tagIds.includes(id) ? prev.tagIds.filter((t) => t !== id) : [...prev.tagIds, id],
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-6">
            {dish ? 'Editar Platillo' : 'Nuevo Platillo'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripción *
              </label>
              <textarea
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Precio (RD$) *
                </label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) =>
                    setFormData({ ...formData, price: parseFloat(e.target.value) })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Categoría *
                </label>
                <select
                  required
                  value={formData.categoryId}
                  onChange={(e) =>
                    setFormData({ ...formData, categoryId: parseInt(e.target.value) })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estación de preparación (Cocina / Bar)
              </label>
              <select
                value={formData.kitchenZoneId ?? ''}
                onChange={(e) => setFormData({ ...formData, kitchenZoneId: e.target.value ? Number(e.target.value) : null })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">Cocina Principal (por defecto)</option>
                {kitchenBarZones.map((z: any) => (
                  <option key={z.id ?? z.Id} value={z.id ?? z.Id}>
                    {z.name ?? z.Name} ({(z.type ?? z.Type) === 'Kitchen' ? 'Cocina' : 'Bar'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Imagen del plato
              </label>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 w-fit">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const token = localStorage.getItem('admin_token');
                        const formDataUpload = new FormData();
                        formDataUpload.append('file', file);
                        const baseURL = '';
                        const res = await fetch(`${baseURL}/api/upload/dish-image`, {
                          method: 'POST',
                          headers: token ? { Authorization: `Bearer ${token}` } : {},
                          body: formDataUpload,
                        });
                        if (!res.ok) {
                          const err = await res.json().catch(() => ({}));
                          throw new Error(err?.error || 'Error al subir');
                        }
                        const data = await res.json();
                        const url = data?.url || '';
                        setFormData((prev) => ({ ...prev, imageUrl: url }));
                        toast.success('Imagen subida');
                      } catch (err: any) {
                        toast.error(err?.message || 'Error al subir la imagen');
                      }
                      e.target.value = '';
                    }}
                  />
                  <span className="text-sm font-medium text-gray-700">Subir imagen</span>
                </label>
                <input
                  type="text"
                  value={formData.imageUrl}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  placeholder="URL o deja vacío si subiste archivo"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              {formData.imageUrl && (
                <div className="mt-2">
                  <p className="text-xs text-gray-500 mb-1">Vista previa:</p>
                  <img
                    src={formData.imageUrl.startsWith('http') ? formData.imageUrl : ('') + formData.imageUrl}
                    alt="Vista previa"
                    className="h-24 w-auto object-contain rounded border border-gray-200"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tiempo de Preparación (minutos)
              </label>
              <input
                type="number"
                min="1"
                max="180"
                value={formData.preparationTimeMinutes}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    preparationTimeMinutes: parseInt(e.target.value),
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isVegetarian}
                  onChange={(e) =>
                    setFormData({ ...formData, isVegetarian: e.target.checked })
                  }
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">🌱 Vegetariano</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isVegan}
                  onChange={(e) =>
                    setFormData({ ...formData, isVegan: e.target.checked })
                  }
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">🌾 Vegano</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isGlutenFree}
                  onChange={(e) =>
                    setFormData({ ...formData, isGlutenFree: e.target.checked })
                  }
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">🚫 Sin Gluten</span>
              </label>
            </div>

            {dishTags.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Etiquetas (picante, etc.)</label>
                <div className="flex flex-wrap gap-2">
                  {dishTags.map((tag) => (
                    <label key={tag.id} className="inline-flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={formData.tagIds.includes(tag.id)}
                        onChange={() => toggleTag(tag.id)}
                        className="w-4 h-4 text-primary-600 border-gray-300 rounded"
                      />
                      <span>{tag.icon} {tag.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors"
              >
                {dish ? 'Guardar Cambios' : 'Crear Platillo'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
