'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Plus,
  X,
  Pencil,
  Trash2,
  MapPin,
  ChefHat,
  Wine,
  RefreshCw,
  Power,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: '',
});

type ZoneType = 'Dining' | 'Kitchen' | 'Bar';

interface Zone {
  id: number;
  name: string;
  type: string;
  description: string | null;
  restaurantId: number;
  isActive: boolean;
  tableCount: number;
  availableTables: number;
}

const TAB_CONFIG: { key: ZoneType; label: string; icon: any; color: string; description: string }[] = [
  { key: 'Dining', label: 'Zonas (Mesas)', icon: MapPin, color: 'bg-blue-500', description: 'Áreas de las mesas donde se ubican las mesas' },
  { key: 'Kitchen', label: 'Cocinas', icon: ChefHat, color: 'bg-orange-500', description: 'Estaciones de cocina para preparación de alimentos' },
  { key: 'Bar', label: 'Bares', icon: Wine, color: 'bg-purple-500', description: 'Barras para preparación de bebidas y cócteles' },
];

export default function MaintenancePage() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ZoneType>('Dining');
  const [showModal, setShowModal] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });

  const g = (obj: any, key: string) => obj?.[key] ?? obj?.[key.charAt(0).toUpperCase() + key.slice(1)] ?? '';

  const loadZones = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      if (token) api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const res = await api.get('/api/zone');
      setZones(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Error loading zones:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      window.location.href = 'https://172.31.98.64:3000/login';
      return;
    }
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    loadZones();
  }, []);

  const filteredZones = zones.filter(z => {
    const type = g(z, 'type') || 'Dining';
    return type === activeTab;
  });

  const openCreateModal = () => {
    setEditingZone(null);
    setForm({ name: '', description: '' });
    setShowModal(true);
  };

  const openEditModal = (zone: Zone) => {
    setEditingZone(zone);
    setForm({ name: g(zone, 'name'), description: g(zone, 'description') || '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('El nombre es requerido');
      return;
    }

    try {
      if (editingZone) {
        await api.put(`/api/zone/${editingZone.id}`, {
          name: form.name,
          description: form.description || null,
        });
        toast.success('Actualizado correctamente');
      } else {
        await api.post('/api/zone', {
          name: form.name,
          type: activeTab,
          description: form.description || null,
          restaurantId: 1,
        });
        toast.success(getTypeLabel(activeTab) + ' creada exitosamente');
      }
      setShowModal(false);
      loadZones();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Error al guardar');
    }
  };

  const handleDelete = async (zone: Zone) => {
    const label = getTypeLabel(g(zone, 'type') || 'Dining').toLowerCase();
    if (!confirm(`¿Eliminar ${label} "${g(zone, 'name')}"?`)) return;
    try {
      await api.delete(`/api/zone/${zone.id}`);
      toast.success('Eliminado correctamente');
      loadZones();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Error al eliminar');
    }
  };

  const handleToggle = async (zone: Zone) => {
    try {
      await api.put(`/api/zone/${zone.id}/toggle`);
      toast.success(g(zone, 'isActive') ? 'Desactivado' : 'Activado');
      loadZones();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Error al cambiar estado');
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'Kitchen': return 'Cocina';
      case 'Bar': return 'Bar';
      default: return 'Zona';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Kitchen': return ChefHat;
      case 'Bar': return Wine;
      default: return MapPin;
    }
  };

  const currentTabConfig = TAB_CONFIG.find(t => t.key === activeTab)!;

  return (
    <MainLayout title="Mantenimiento" subtitle="Gestión de zonas, cocinas y bares">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Mantenimiento</h1>
            <p className="text-muted-foreground">Gestiona las zonas de comedor, cocinas y bares del restaurante</p>
          </div>
          <Button onClick={loadZones} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </div>

        {/* Stats resumen */}
        <div className="grid gap-4 md:grid-cols-3">
          {TAB_CONFIG.map(tab => {
            const count = zones.filter(z => (g(z, 'type') || 'Dining') === tab.key).length;
            const Icon = tab.icon;
            return (
              <Card
                key={tab.key}
                className={cn(
                  'border-2 cursor-pointer transition-all hover:shadow-md',
                  activeTab === tab.key ? 'border-primary shadow-md' : 'border-muted'
                )}
                onClick={() => setActiveTab(tab.key)}
              >
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold">{count}</div>
                      <p className="text-xs text-muted-foreground">{tab.label}</p>
                    </div>
                    <div className={cn('p-3 rounded-lg text-white', tab.color)}>
                      <Icon className="h-6 w-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
          {TAB_CONFIG.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
                  activeTab === tab.key
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Contenido del tab activo */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {(() => { const Icon = currentTabConfig.icon; return <Icon className="h-5 w-5" />; })()}
                  {currentTabConfig.label} ({filteredZones.length})
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">{currentTabConfig.description}</p>
              </div>
              <Button onClick={openCreateModal}>
                <Plus className="h-4 w-4 mr-2" />
                {activeTab === 'Kitchen' ? 'Nueva Cocina' : activeTab === 'Bar' ? 'Nuevo Bar' : 'Nueva Zona'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Cargando...</p>
              </div>
            ) : filteredZones.length === 0 ? (
              <div className="text-center py-12">
                {(() => { const Icon = currentTabConfig.icon; return <Icon className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />; })()}
                <p className="text-lg text-muted-foreground">
                  No hay {activeTab === 'Kitchen' ? 'cocinas' : activeTab === 'Bar' ? 'bares' : 'zonas'} configuradas
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Presiona el botón de arriba para crear {activeTab === 'Kitchen' ? 'una cocina' : activeTab === 'Bar' ? 'un bar' : 'una zona'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredZones.map(zone => {
                  const Icon = getTypeIcon(g(zone, 'type'));
                  const isActive = g(zone, 'isActive') !== false;
                  const tableCount = g(zone, 'tableCount') || 0;

                  return (
                    <div
                      key={zone.id}
                      className={cn(
                        'border-2 rounded-lg p-4 transition-all',
                        isActive ? 'border-border' : 'border-muted opacity-60'
                      )}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={cn('p-2 rounded-lg text-white', currentTabConfig.color)}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{g(zone, 'name')}</h3>
                            {g(zone, 'description') && (
                              <p className="text-xs text-muted-foreground">{g(zone, 'description')}</p>
                            )}
                          </div>
                        </div>
                        <Badge variant={isActive ? 'default' : 'secondary'} className="text-xs">
                          {isActive ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </div>

                      {activeTab === 'Dining' && (
                        <div className="text-sm text-muted-foreground mb-3">
                          {tableCount} mesa{tableCount !== 1 ? 's' : ''} asignada{tableCount !== 1 ? 's' : ''}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => openEditModal(zone)}>
                          <Pencil className="h-3.5 w-3.5 mr-1" />
                          Editar
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleToggle(zone)} title={isActive ? 'Desactivar' : 'Activar'}>
                          <Power className={cn('h-3.5 w-3.5', isActive ? 'text-green-500' : 'text-gray-400')} />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDelete(zone)} className="text-destructive hover:text-destructive" title="Eliminar">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal Crear / Editar */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">
                {editingZone ? 'Editar' : 'Crear'} {getTypeLabel(activeTab)}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder={
                    activeTab === 'Kitchen' ? 'Ej: Cocina Fría, Cocina Caliente, Pastelería...'
                    : activeTab === 'Bar' ? 'Ej: Bar Principal, Bar Sin Alcohol, Bar de Cócteles...'
                    : 'Ej: Terraza, Salón Principal, VIP...'
                  }
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Descripción</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder={
                    activeTab === 'Kitchen' ? 'Describe qué tipo de platos se preparan aquí...'
                    : activeTab === 'Bar' ? 'Describe qué tipo de bebidas se sirven...'
                    : 'Describe la ubicación o características de la zona...'
                  }
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 resize-none"
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowModal(false)}>
                  Cancelar
                </Button>
                <Button className="flex-1" onClick={handleSave}>
                  {editingZone ? 'Guardar Cambios' : 'Crear'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
