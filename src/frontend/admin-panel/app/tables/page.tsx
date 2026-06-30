'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Users,
  RefreshCw,
  Plus,
  X,
  Download,
  QrCode,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { QRCodeSVG } from 'qrcode.react';
import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: '',
});

/**
 * QR-FIX.2 — URL base del client-app para QRs físicos.
 *
 * Prioridad:
 *   1. NEXT_PUBLIC_CLIENT_URL (build-time, ej. https://192.168.1.26:8443).
 *      Esta es la opción CORRECTA para producción/QA — sobreescribe todo.
 *   2. Fallback runtime: derivar del hostname actual.
 *      - Si admin está en https://localhost:8444 → cambiar a https://localhost:8451 (client Caddy)
 *      - Si admin está en https://admin.X.nip.io:8443 → cambiar a https://X.nip.io:8443
 *      - Si admin está en una IP directa → mismo origen
 *
 * IMPORTANTE: El QR generado se IMPRIME y se pega en mesas físicas. Los clientes
 * lo escanean con su celular. Por eso NUNCA debe contener "localhost" — ningún
 * celular puede resolverlo. Usar siempre IP LAN o domain accesible en la red.
 */
function deriveClientUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_CLIENT_URL;
  if (envUrl) return envUrl;
  if (typeof window === 'undefined') return '';

  const { protocol, hostname, port } = window.location;

  // localhost detection — usar la convención del stack QA (client en :8451)
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${protocol}//${hostname}:8451`;
  }

  // admin.X.nip.io → derivar el client.X.nip.io (mismo cert raíz)
  // Patrón: cualquier subdomain.* → reemplazar primer label
  if (hostname.includes('.nip.io') || hostname.includes('.qa.smartmenu.local')) {
    const parts = hostname.split('.');
    if (parts.length > 0) {
      parts[0] = 'client';
      return `${protocol}//${parts.join('.')}${port ? `:${port}` : ''}`;
    }
  }

  // IP directa (192.168.x, 172.x, 10.x) — mismo host, puerto del client (:8451).
  // Caddy sirve el client en :8451 para CUALQUIER IP (bloque ":8451"), asi el QR
  // funciona aunque cambie la IP de la PC: solo abre el admin por su IP actual.
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return `${protocol}//${hostname}:8451`;
  }

  // Fallback genérico: mismo origin (puede no funcionar, pero al menos no rompe)
  return window.location.origin;
}

const CLIENT_URL = deriveClientUrl();

interface Table {
  id: number;
  tableNumber: number;
  capacity: number;
  status: string;
  zoneName: string;
  zoneId: number;
  qrCode: string;
  name?: string;
  color?: string;
}

interface Zone {
  id: number;
  name: string;
  tableCount: number;
  type?: string;
}

export default function TablesPage() {
  const t = useTranslations('tables');
  const [tables, setTables] = useState<Table[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedZone, setSelectedZone] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCapacity, setFilterCapacity] = useState<string>('all');
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ tableNumber: 0, capacity: 4, zoneId: 0, name: '', color: '' });
  const [createdTable, setCreatedTable] = useState<Table | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  useEffect(() => {
    setEditName(selectedTable?.name ?? '');
    setEditColor(selectedTable?.color ?? '');
  }, [selectedTable]);
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
          name: (nv(t, 'name') ?? undefined) as string | undefined,
          color: (nv(t, 'color') ?? undefined) as string | undefined,
        }))
        .filter(t => diningZoneNames.has(t.zoneName));
      setTables(normalizedTables);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error(t('errorLoadData'));
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
      'Available': t('statusAvailable'),
      'Occupied': t('statusOccupied'),
      'Reserved': t('statusReserved'),
      'Cleaning': t('statusCleaning'),
      'Billing': t('statusBilling'),
    };
    return labels[status] || status;
  };

  const updateTableStatus = async (tableId: number, newStatus: string) => {
    try {
      await api.put(`/api/table/${tableId}/status`, { newStatus });
      toast.success(t('statusChanged', { status: getStatusLabel(newStatus) }));
      if (selectedTable && selectedTable.id === tableId) {
        setSelectedTable({ ...selectedTable, status: newStatus });
      }
      loadData();
    } catch (error) {
      toast.error(t('errorChangeStatus'));
    }
  };

  const deleteTable = async (tableId: number) => {
    if (!confirm(t('confirmDelete'))) return;
    try {
      await api.delete(`/api/table/${tableId}`);
      toast.success(t('tableDeleted'));
      setSelectedTable(null);
      loadData();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || t('errorDeleteTable'));
    }
  };

  const createTable = async () => {
    if (!createForm.tableNumber || !createForm.zoneId) {
      toast.error(t('errorRequiredFields'));
      return;
    }
    try {
      const res = await api.post('/api/table', createForm);
      toast.success(t('tableCreated'));
      setShowCreateModal(false);
      setCreatedTable(res.data);
      loadData();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || t('errorCreateTable'));
    }
  };

  const saveTableAppearance = async () => {
    if (!selectedTable) return;
    try {
      await api.put(`/api/table/${selectedTable.id}`, { name: editName.trim() || null, color: editColor || null });
      toast.success(t('tableUpdated'));
      setSelectedTable(null);
      loadData();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || t('errorUpdateTable'));
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
    <MainLayout title={t('pageTitle')} subtitle={t('pageSubtitle')}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t('pageTitle')}</h1>
            <p className="text-muted-foreground">{t('pageSubtitle')}</p>
          </div>
          <div className="flex gap-2 items-center">
            <Button onClick={() => { setShowCreateModal(true); setCreateForm({ tableNumber: tables.length + 1, capacity: 4, zoneId: zones[0] ? getZoneId(zones[0]) : 0, name: '', color: '' }); }} variant="default">
              <Plus className="h-4 w-4 mr-2" />
              {t('btnNewTable')}
            </Button>
            <Button onClick={loadData} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              {t('btnRefresh')}
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-2 border-success/30">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{stats.available}</div>
              <p className="text-xs text-muted-foreground">{t('statsAvailable')}</p>
            </CardContent>
          </Card>
          <Card className="border-2 border-danger/30">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{stats.occupied}</div>
              <p className="text-xs text-muted-foreground">{t('statsOccupied')}</p>
            </CardContent>
          </Card>
          <Card className="border-2 border-billing/30">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{stats.billing}</div>
              <p className="text-xs text-muted-foreground">{t('statsBilling')}</p>
            </CardContent>
          </Card>
          <Card className="border-2 border-warning/30">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{stats.reserved}</div>
              <p className="text-xs text-muted-foreground">{t('statsReserved')}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters Panel */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">

          {/* Zone tabs */}
          <div>
            <p className="text-xs font-semibold text-black uppercase tracking-wider mb-2">{t('filterZone')}</p>
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
                {t('zoneAll')}
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
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{t('filterStatus')}</p>
              <div className="flex gap-2">
                {[
                  { value: 'all', label: t('statusAll'), dot: null },
                  { value: 'Available', label: t('statusAvailable'), dot: 'bg-green-500' },
                  { value: 'Occupied', label: t('statusOccupied'), dot: 'bg-red-500' },
                  { value: 'Billing', label: t('statusBilling'), dot: 'bg-purple-500' },
                  { value: 'Reserved', label: t('statusReserved'), dot: 'bg-yellow-400' },
                  { value: 'Cleaning', label: t('statusCleaning'), dot: 'bg-blue-400' },
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
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{t('filterCapacity')}</p>
              <div className="flex gap-2">
                {[
                  { value: 'all', label: t('capacityAll'), icon: null },
                  { value: '2', label: t('capacity2'), icon: '🪑' },
                  { value: '4', label: t('capacity4'), icon: '🪑🪑' },
                  { value: '6+', label: t('capacity6plus'), icon: '🪑🪑🪑' },
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
                  {t('btnClear')}
                </button>
              )}
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900 leading-none">{filteredTables.length}</p>
                <p className="text-xs text-gray-400">{t('tableCount', { count: filteredTables.length })}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tables Grid */}
        <Card>
          <CardHeader>
            <CardTitle>{t('sectionTables')} {hasActiveFilters ? `(${filteredTables.length} de ${tables.length})` : `(${tables.length})`}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">{t('loadingTables')}</p>
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
                    {table.name && <div className="text-xs font-semibold mb-1 truncate">{table.name}</div>}
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
              <h2 className="text-2xl font-bold">{t('detailModalTitle', { number: selectedTable.tableNumber })}</h2>
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
                {t('btnDownloadQR')}
              </Button>
            </div>

            {/* Info */}
            <div className="grid grid-cols-2 gap-3 mb-6 text-sm">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                <span className="text-muted-foreground">{t('detailZone')}</span>
                <p className="font-semibold">{selectedTable.zoneName}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                <span className="text-muted-foreground">{t('detailCapacity')}</span>
                <p className="font-semibold">{selectedTable.capacity} {t('persons')}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 col-span-2">
                <span className="text-muted-foreground">{t('detailCurrentStatus')}</span>
                <p className="font-semibold">{getStatusLabel(selectedTable.status)}</p>
              </div>
            </div>

            {/* Apariencia: nombre + color */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold mb-2 text-muted-foreground">{t('sectionAppearance')}</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1 text-muted-foreground">{t('labelNameTag')}</label>
                  <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    placeholder={`#${selectedTable.tableNumber}`}
                    maxLength={80}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                  />
                </div>
                <div className="flex items-end gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1 text-muted-foreground">{t('labelColor')}</label>
                    <input
                      type="color"
                      value={editColor || '#2F9E78'}
                      onChange={e => setEditColor(e.target.value)}
                      className="h-9 w-12 cursor-pointer rounded border dark:border-gray-700 bg-white p-0.5"
                    />
                  </div>
                  {editColor && (
                    <button onClick={() => setEditColor('')} className="mb-1.5 text-xs text-muted-foreground underline">{t('btnRemoveColor')}</button>
                  )}
                  <Button size="sm" className="ml-auto" onClick={saveTableAppearance}>{t('btnSave')}</Button>
                </div>
              </div>
            </div>

            {/* Cambiar Estado */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold mb-2 text-muted-foreground">{t('sectionChangeStatus')}</h3>
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
                {t('btnDeleteTable')}
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
              <h2 className="text-xl font-bold">{t('createModalTitle')}</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t('labelTableNumber')}</label>
                <input
                  type="number"
                  value={createForm.tableNumber}
                  onChange={e => setCreateForm({ ...createForm, tableNumber: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('labelCapacity')}</label>
                <input
                  type="number"
                  value={createForm.capacity}
                  onChange={e => setCreateForm({ ...createForm, capacity: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                  min={1}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('labelZone')}</label>
                <select
                  value={createForm.zoneId}
                  onChange={e => setCreateForm({ ...createForm, zoneId: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                >
                  <option value={0}>{t('zoneSelectPlaceholder')}</option>
                  {zones.map(z => (
                    <option key={z.id} value={z.id}>{z.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('labelNameTagOptional')}</label>
                <input
                  value={createForm.name}
                  onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder={`#${createForm.tableNumber}`}
                  maxLength={80}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                />
              </div>
              <div className="flex items-end gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">{t('labelColorOptional')}</label>
                  <input
                    type="color"
                    value={createForm.color || '#2F9E78'}
                    onChange={e => setCreateForm({ ...createForm, color: e.target.value })}
                    className="h-9 w-12 cursor-pointer rounded border dark:border-gray-700 bg-white p-0.5"
                  />
                </div>
                {createForm.color && (
                  <button onClick={() => setCreateForm({ ...createForm, color: '' })} className="mb-1.5 text-xs text-muted-foreground underline">{t('btnRemove')}</button>
                )}
              </div>
              <Button className="w-full" onClick={createTable}>
                <Plus className="h-4 w-4 mr-2" />
                {t('btnCreateTable')}
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
              <h2 className="text-xl font-bold">{t('createdModalTitle', { number: createdTable.tableNumber })}</h2>
              <p className="text-sm text-muted-foreground">{t('createdModalSubtitle')}</p>
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
                {t('btnDownloadQR')}
              </Button>
              <Button className="flex-1" onClick={() => setCreatedTable(null)}>
                {t('btnAccept')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
