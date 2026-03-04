'use client';

import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { QRCodeSVG } from 'qrcode.react';
import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: '',
});

const CLIENT_URL = process.env.NEXT_PUBLIC_CLIENT_URL || 'https://172.31.98.64:3000';

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
}

export default function TablesPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedZone, setSelectedZone] = useState<number | null>(null);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ tableNumber: 0, capacity: 4, zoneId: 0 });
  const [createdTable, setCreatedTable] = useState<Table | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      if (token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      }

      const [tablesRes, zonesRes] = await Promise.all([
        api.get('/api/table'),
        api.get('/api/zone', { params: { type: 'Dining' } })
      ]);

      setTables(Array.isArray(tablesRes.data) ? tablesRes.data : []);
      const allZones = Array.isArray(zonesRes.data) ? zonesRes.data : [];
      setZones(allZones);
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
      window.location.href = 'https://172.31.98.64:3000/login';
      return;
    }
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const getVal = (obj: any, key: string) => obj?.[key] ?? obj?.[key.charAt(0).toUpperCase() + key.slice(1)] ?? '';
  const getTableStatus = (t: Table) => getVal(t, 'status');
  const getTableZoneId = (t: Table) => getVal(t, 'zoneId');
  const getZoneId = (z: Zone) => getVal(z, 'id');
  const filteredTables = selectedZone
    ? tables.filter(t => getTableZoneId(t) === selectedZone)
    : tables;

  const stats = {
    available: tables.filter(t => getTableStatus(t) === 'Available').length,
    occupied: tables.filter(t => getTableStatus(t) === 'Occupied').length,
    reserved: tables.filter(t => getTableStatus(t) === 'Reserved').length,
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'Available': 'bg-success border-success text-white',
      'Occupied': 'bg-danger border-danger text-white',
      'Reserved': 'bg-warning border-warning text-white',
      'Cleaning': 'bg-blue-500 border-blue-500 text-white',
    };
    return colors[status] || 'bg-muted border-muted';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'Available': 'Disponible',
      'Occupied': 'Ocupada',
      'Reserved': 'Reservada',
      'Cleaning': 'Limpieza',
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

  const getQrUrl = (table: Table) => {
    const qr = getVal(table, 'qrCode');
    return `${CLIENT_URL}/table/${qr}`;
  };

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
      link.download = `mesa-${getVal(table, 'tableNumber')}-qr.png`;
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
          <div className="flex gap-2">
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
        <div className="grid gap-4 md:grid-cols-3">
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
          <Card className="border-2 border-warning/30">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{stats.reserved}</div>
              <p className="text-xs text-muted-foreground">Mesas Reservadas</p>
            </CardContent>
          </Card>
        </div>

        {/* Zone Filter */}
        <Card>
          <CardHeader>
            <CardTitle>Filtrar por Zona</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={selectedZone === null ? 'default' : 'outline'}
                onClick={() => setSelectedZone(null)}
              >
                Todas ({tables.length})
              </Button>
              {zones.map((zone) => (
                <Button
                  key={getZoneId(zone)}
                  variant={selectedZone === getZoneId(zone) ? 'default' : 'outline'}
                  onClick={() => setSelectedZone(getZoneId(zone))}
                >
                  <MapPin className="h-4 w-4 mr-2" />
                  {getVal(zone, 'name')} ({getVal(zone, 'tableCount')})
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tables Grid */}
        <Card>
          <CardHeader>
            <CardTitle>Mesas ({filteredTables.length})</CardTitle>
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
                      getStatusColor(getTableStatus(table))
                    )}
                  >
                    <div className="text-3xl font-bold mb-2">#{getVal(table, 'tableNumber')}</div>
                    <div className="text-xs uppercase mb-2">{getVal(table, 'zoneName')}</div>
                    <div className="flex items-center justify-center gap-1 text-sm mb-2">
                      <Users className="h-4 w-4" />
                      {getVal(table, 'capacity')}
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {getStatusLabel(getTableStatus(table))}
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
              <h2 className="text-2xl font-bold">Mesa #{getVal(selectedTable, 'tableNumber')}</h2>
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
                <p className="font-semibold">{getVal(selectedTable, 'zoneName')}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                <span className="text-muted-foreground">Capacidad</span>
                <p className="font-semibold">{getVal(selectedTable, 'capacity')} personas</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 col-span-2">
                <span className="text-muted-foreground">Estado actual</span>
                <p className="font-semibold">{getStatusLabel(getTableStatus(selectedTable))}</p>
              </div>
            </div>

            {/* Cambiar Estado */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Cambiar Estado</h3>
              <div className="grid grid-cols-2 gap-2">
                {['Available', 'Occupied', 'Reserved', 'Cleaning'].map(status => (
                  <Button
                    key={status}
                    variant={getTableStatus(selectedTable) === status ? 'default' : 'outline'}
                    size="sm"
                    disabled={getTableStatus(selectedTable) === status}
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
                disabled={getTableStatus(selectedTable) === 'Occupied'}
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
                    <option key={getZoneId(z)} value={getZoneId(z)}>{getVal(z, 'name')}</option>
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
              <h2 className="text-xl font-bold">Mesa #{getVal(createdTable, 'tableNumber')} Creada</h2>
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
