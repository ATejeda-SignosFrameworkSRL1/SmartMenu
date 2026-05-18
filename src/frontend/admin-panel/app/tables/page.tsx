'use client';

import { useState, useEffect, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Users,
  RefreshCw,
  MapPin,
  Plus,
  X,
  Download,
  QrCode,
  Trash2,
  Edit,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { QRCodeSVG } from 'qrcode.react';
import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: '',
});

const CLIENT_URL = process.env.NEXT_PUBLIC_CLIENT_URL || (typeof window !== 'undefined' ? window.location.origin.replace(':3001', ':3000') : '');

interface Table {
  id: number;
  tableNumber: number;
  capacity: number;
  status: string;
  zoneName: string;
  zoneId: number;
  qrCode: string;
}

interface Zone {
  id: number;
  name: string;
  tableCount: number;
  type?: string;
}

export default function TablesPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedZone, setSelectedZone] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCapacity, setFilterCapacity] = useState<string>('all');
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ tableNumber: 0, capacity: 4, zoneId: 0 });
  const [createdTable, setCreatedTable] = useState<Table | null>(null);
  // Lee propiedad en camelCase o PascalCase
  const nv = (obj: any, key: string) =>
    obj?.[key] ?? obj?.[key.charAt(0).toUpperCase() + key.slice(1)];

  const loadData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      if (token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      }

      const [tablesRes, zonesRes] = await Promise.all([
        api.get('/api/table'),
        api.get('/api/zone'),
      ]);

      // Normalizar zonas — excluir cocinas y bares
      const allZonesRaw: any[] = Array.isArray(zonesRes.data) ? zonesRes.data : [];
      const normalizedZones: Zone[] = allZonesRaw
        .map(z => ({
          id: Number(nv(z, 'id')),
          name: String(nv(z, 'name') ?? ''),
          tableCount: Number(nv(z, 'tableCount') ?? 0),
          type: String(nv(z, 'type') ?? ''),
        }))
        .filter(z => {
          const t = z.type.toLowerCase();
          return t !== 'kitchen' && t !== 'bar';
        });
      setZones(normalizedZones);

      const diningZoneNames = new Set(normalizedZones.map(z => z.name));

      // Normalizar mesas — API no devuelve zoneId, solo zoneName
      const allTablesRaw: any[] = Array.isArray(tablesRes.data) ? tablesRes.data : [];
      const normalizedTables: Table[] = allTablesRaw
        .map(t => ({
          id: Number(nv(t, 'id')),
          tableNumber: Number(nv(t, 'tableNumber')),
          capacity: Number(nv(t, 'capacity')),
          status: String(nv(t, 'status') ?? 'Available'),
          zoneName: String(nv(t, 'zoneName') ?? ''),
          zoneId: 0, // no viene del API, no se usa
          qrCode: String(nv(t, 'qrCode') ?? ''),
        }))
        .filter(t => diningZoneNames.has(t.zoneName));
      setTables(normalizedTables);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      window.location.href = '/login';
      return;
    }
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tras normalización todos los campos son camelCase con tipos correctos
  const getVal = (obj: any, key: string) => obj?.[key] ?? obj?.[key.charAt(0).toUpperCase() + key.slice(1)] ?? '';
  const getTableStatus = (t: Table) => t.status;
  const getZoneId = (z: Zone) => z.id;

  const filteredTables = useMemo(() => {
    const selectedZoneName = selectedZone ? zones.find(z => z.id === selectedZone)?.name : null;
    return tables.filter(t => {
      const zoneMatch = !selectedZoneName || t.zoneName === selectedZoneName;
      const statusMatch = filterStatus === 'all' || t.status === filterStatus;
      const capacityMatch =
        filterCapacity === 'all' ||
        (filterCapacity === '2' && t.capacity <= 2) ||
        (filterCapacity === '4' && t.capacity >= 3 && t.capacity <= 4) ||
        (filterCapacity === '6+' && t.capacity >= 5);
      return zoneMatch && statusMatch && capacityMatch;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables, selectedZone, zones, filterStatus, filterCapacity]);

  const hasActiveFilters = filterStatus !== 'all' || filterCapacity !== 'all' || selectedZone !== null;

  const clearFilters = () => {
    setSelectedZone(null);
    setFilterStatus('all');
    setFilterCapacity('all');
  };

  const stats = {
    available: tables.filter(t => getTableStatus(t) === 'Available').length,
    occupied: tables.filter(t => getTableStatus(t) === 'Occupied').length,
    reserved: tables.filter(t => getTableStatus(t) === 'Reserved').length,
    billing: tables.filter(t => getTableStatus(t) === 'Billing').length,
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'Available': 'bg-success border-success text-white',
      'Occupied': 'bg-danger border-danger text-white',
      'Reserved': 'bg-warning border-warning text-white',
      'Cleaning': 'bg-blue-500 border-blue-500 text-white',
      'Billing': 'bg-billing border-billing text-white',
    };
    return colors[status] || 'bg-muted border-muted';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'Available': 'Disponible',
      'Occupied': 'Ocupada',
      'Reserved': 'Reservada',
      'Cleaning': 'Limpieza',
      'Billing': 'Por cobrar',
    };
    return labels[status] || status;
  };

  const updateTableStatus = async (tableId: number, newStatus: string) => {
    try {
      await api.put(`/api/table/${tableId}/status`, { newStatus });
      toast.success(`Estado cambiado a ${getStatusLabel(newStatus)}`);
      if (selectedTable && selectedTable.id === tableId) {
        setSelectedTable({ ...selectedTable, status: newStatus });
      }
      loadData();
    } catch (error) {
      toast.error('Error al cambiar estado');
    }
  };

  const deleteTable = async (tableId: number) => {
    if (!confirm('¿Seguro que deseas eliminar esta mesa?')) return;
    try {
      await api.delete(`/api/table/${tableId}`);
      toast.success('Mesa eliminada');
      setSelectedTable(null);
      loadData();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Error al eliminar mesa');
    }
  };

  const createTable = async () => {
    if (!createForm.tableNumber || !createForm.zoneId) {
      toast.error('Completa todos los campos');
      return;
    }
    try {
      const res = await api.post('/api/table', createForm);
      toast.success('Mesa creada exitosamente');
      setShowCreateModal(false);
      setCreatedTable(res.data);
      loadData();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Error al crear mesa');
    }
  };

  const getQrUrl = (table: Table) => `${CLIENT_URL}/table/${table.qrCode}`;

  const downloadQR = (table: Table) => {
    const svg = document.getElementById(`qr-svg-${table.id}`);
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = 400;
      canvas.height = 400;
      ctx?.drawImage(img, 0, 0, 400, 400);
      const link = document.createElement('a');
      link.download = `mesa-${table.tableNumber}-qr.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <MainLayout title="Gestión de Mesas" subtitle="Administra el estado y configuración de las mesas">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Gestión de Mesas</h1>
            <p className="text-muted-foreground">Administra el estado y configuración de las mesas</p>
          </div>
          <div className="flex gap-2 items-center">
            <Button onClick={() => { setShowCreateModal(true); setCreateForm({ tableNumber: tables.length + 1, capacity: 4, zoneId: zones[0] ? getZoneId(zones[0]) : 0 }); }} variant="default">
              <Plus className="h-4 w-4 mr-2" />
              Nueva Mesa
            </Button>
            <Button onClick={loadData} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualizar
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-2 border-success/30">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{stats.available}</div>
              <p className="text-xs text-muted-foreground">Mesas Disponibles</p>
            </CardContent>
          </Card>
          <Card className="border-2 border-danger/30">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{stats.occupied}</div>
              <p className="text-xs text-muted-foreground">Mesas Ocupadas</p>
            </CardContent>
          </Card>
          <Card className="border-2 border-billing/30">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{stats.billing}</div>
              <p className="text-xs text-muted-foreground">Por Cobrar</p>
            </CardContent>
          </Card>
          <Card className="border-2 border-warning/30">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{stats.reserved}</div>
              <p className="text-xs text-muted-foreground">Mesas Reservadas</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters Panel */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">

          {/* Zone tabs */}
          <div>
            <p className="text-xs font-semibold text-black uppercase tracking-wider mb-2">Zona</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedZone(null)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${
                  selectedZone === null
                    ? 'text-white shadow-sm'
                    : 'bg-white text-black border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
                style={selectedZone === null ? { backgroundColor: '#8a0000e6', borderColor: '#8a0000e6' } : {}}
              >
                Todas
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                  selectedZone === null ? 'bg-white/20 text-white' : 'bg-white text-gray-500'
                }`}>
                  {tables.length}
                </span>
              </button>
              {zones.map((zone) => (
                <button
                  key={getZoneId(zone)}
                  onClick={() => setSelectedZone(getZoneId(zone))}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${
                    selectedZone === getZoneId(zone)
                      ? 'text-white shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                  style={selectedZone === getZoneId(zone) ? { backgroundColor: '#8a0000e6', borderColor: '#8a0000e6' } : {}}
                >
                  {zone.name}
                  <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                    selectedZone === getZoneId(zone) ? 'bg-white/20 text-white' : 'bg-white text-gray-500'
                  }`}>
                    {zone.tableCount}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-gray-100" />

          {/* Status + Capacity + Results row */}
          <div className="flex flex-wrap items-end gap-6">

            {/* Estado */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Estado</p>
              <div className="flex gap-2">
                {[
                  { value: 'all', label: 'Todos', dot: null },
                  { value: 'Available', label: 'Disponible', dot: 'bg-green-500' },
                  { value: 'Occupied', label: 'Ocupada', dot: 'bg-red-500' },
                  { value: 'Billing', label: 'Por cobrar', dot: 'bg-purple-500' },
                  { value: 'Reserved', label: 'Reservada', dot: 'bg-yellow-400' },
                  { value: 'Cleaning', label: 'Limpieza', dot: 'bg-blue-400' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setFilterStatus(opt.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
                      filterStatus === opt.value
                        ? 'text-white shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                    style={filterStatus === opt.value ? { backgroundColor: '#8a0000e6', borderColor: '#8a0000e6' } : {}}
                  >
                    {opt.dot && <span className={`w-2 h-2 rounded-full ${opt.dot}`} />}
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Capacidad */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Capacidad</p>
              <div className="flex gap-2">
                {[
                  { value: 'all', label: 'Todas', icon: null },
                  { value: '2', label: '1–2 personas', icon: '🪑' },
                  { value: '4', label: '3–4 personas', icon: '🪑🪑' },
                  { value: '6+', label: '5+ personas', icon: '🪑🪑🪑' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setFilterCapacity(opt.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
                      filterCapacity === opt.value
                        ? 'text-white shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                    style={filterCapacity === opt.value ? { backgroundColor: '#8a0000e6', borderColor: '#8a0000e6' } : {}}
                  >
                    {opt.icon && <span className="text-xs">{opt.icon}</span>}
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Results + clear */}
            <div className="ml-auto flex items-center gap-3">
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-all border border-gray-200 hover:border-red-200"
                >
                  <X className="w-3.5 h-3.5" />
                  Limpiar
                </button>
              )}
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900 leading-none">{filteredTables.length}</p>
                <p className="text-xs text-gray-400">mesa{filteredTables.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tables Grid */}
        <Card>
          <CardHeader>
            <CardTitle>Mesas {hasActiveFilters ? `(${filteredTables.length} de ${tables.length})` : `(${tables.length})`}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">Cargando mesas...</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {filteredTables.map((table) => (
                  <div
                    key={table.id}
                    onClick={() => setSelectedTable(table)}
                    className={cn(
                      'border-4 rounded-lg p-4 text-center transition-all cursor-pointer hover:scale-105 hover:shadow-lg',
                      getStatusColor(table.status)
                    )}
                  >
                    <div className="text-3xl font-bold mb-2">#{table.tableNumber}</div>
                    <div className="text-xs uppercase mb-2">{table.zoneName}</div>
                    <div className="flex items-center justify-center gap-1 text-sm mb-2">
                      <Users className="h-4 w-4" />
                      {table.capacity}
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {getStatusLabel(table.status)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal: Detalle de Mesa */}
      {selectedTable && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedTable(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Mesa #{selectedTable.tableNumber}</h2>
              <button onClick={() => setSelectedTable(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* QR Code */}
            <div className="flex flex-col items-center mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <QRCodeSVG
                id={`qr-svg-${selectedTable.id}`}
                value={getQrUrl(selectedTable)}
                size={200}
                level="H"
                includeMargin
              />
              <p className="text-xs text-muted-foreground mt-2 break-all text-center">{getQrUrl(selectedTable)}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => downloadQR(selectedTable)}>
                <Download className="h-4 w-4 mr-2" />
                Descargar QR
              </Button>
            </div>

            {/* Info */}
            <div className="grid grid-cols-2 gap-3 mb-6 text-sm">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                <span className="text-muted-foreground">Zona</span>
                <p className="font-semibold">{selectedTable.zoneName}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                <span className="text-muted-foreground">Capacidad</span>
                <p className="font-semibold">{selectedTable.capacity} personas</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 col-span-2">
                <span className="text-muted-foreground">Estado actual</span>
                <p className="font-semibold">{getStatusLabel(selectedTable.status)}</p>
              </div>
            </div>

            {/* Cambiar Estado */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Cambiar Estado</h3>
              <div className="grid grid-cols-2 gap-2">
                {['Available', 'Occupied', 'Billing', 'Reserved', 'Cleaning'].map(status => (
                  <Button
                    key={status}
                    variant={selectedTable.status === status ? 'default' : 'outline'}
                    size="sm"
                    disabled={selectedTable.status === status}
                    onClick={() => updateTableStatus(selectedTable.id, status)}
                    className="w-full"
                  >
                    {getStatusLabel(status)}
                  </Button>
                ))}
              </div>
            </div>

            {/* Acciones */}
            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                className="flex-1"
                onClick={() => deleteTable(selectedTable.id)}
                disabled={selectedTable.status === 'Occupied'}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar Mesa
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Crear Mesa */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Nueva Mesa</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Número de Mesa</label>
                <input
                  type="number"
                  value={createForm.tableNumber}
                  onChange={e => setCreateForm({ ...createForm, tableNumber: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Capacidad</label>
                <input
                  type="number"
                  value={createForm.capacity}
                  onChange={e => setCreateForm({ ...createForm, capacity: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                  min={1}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Zona</label>
                <select
                  value={createForm.zoneId}
                  onChange={e => setCreateForm({ ...createForm, zoneId: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                >
                  <option value={0}>Seleccionar zona...</option>
                  {zones.map(z => (
                    <option key={z.id} value={z.id}>{z.name}</option>
                  ))}
                </select>
              </div>
              <Button className="w-full" onClick={createTable}>
                <Plus className="h-4 w-4 mr-2" />
                Crear Mesa
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Mesa Creada — muestra QR */}
      {createdTable && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setCreatedTable(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-md w-full p-6 text-center" onClick={e => e.stopPropagation()}>
            <div className="mb-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <QrCode className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold">Mesa #{createdTable.tableNumber} Creada</h2>
              <p className="text-sm text-muted-foreground">Este es el código QR de la mesa</p>
            </div>
            <div className="flex justify-center mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <QRCodeSVG
                id={`qr-svg-${createdTable.id}`}
                value={getQrUrl(createdTable)}
                size={220}
                level="H"
                includeMargin
              />
            </div>
            <p className="text-xs text-muted-foreground mb-4 break-all">{getQrUrl(createdTable)}</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => downloadQR(createdTable)}>
                <Download className="h-4 w-4 mr-2" />
                Descargar QR
              </Button>
              <Button className="flex-1" onClick={() => setCreatedTable(null)}>
                Aceptar
              </Button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
