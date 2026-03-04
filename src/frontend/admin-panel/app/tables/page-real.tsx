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
  Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: '',
});

interface Table {
  id: number;
  tableNumber: number;
  capacity: number;
  status: string;
  zoneName: string;
  zoneId: number;
}

export default function TablesPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedZone, setSelectedZone] = useState<number | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      if (token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      }

      const [tablesRes, zonesRes] = await Promise.all([
        api.get('/api/table'),
        api.get('/api/zone')
      ]);

      setTables(tablesRes.data);
      setZones(zonesRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const filteredTables = selectedZone
    ? tables.filter(t => t.zoneId === selectedZone)
    : tables;

  const stats = {
    available: tables.filter(t => t.status === 'Available').length,
    occupied: tables.filter(t => t.status === 'Occupied').length,
    reserved: tables.filter(t => t.status === 'Reserved').length,
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'Available': 'bg-success border-success text-white',
      'Occupied': 'bg-danger border-danger text-white',
      'Reserved': 'bg-warning border-warning text-white',
    };
    return colors[status] || 'bg-muted border-muted';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'Available': 'Disponible',
      'Occupied': 'Ocupada',
      'Reserved': 'Reservada',
    };
    return labels[status] || status;
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Gestión de Mesas</h1>
            <p className="text-muted-foreground">Administra el estado y configuración de las mesas</p>
          </div>
          <Button onClick={loadData} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
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
                  key={zone.id}
                  variant={selectedZone === zone.id ? 'default' : 'outline'}
                  onClick={() => setSelectedZone(zone.id)}
                >
                  <MapPin className="h-4 w-4 mr-2" />
                  {zone.name} ({zone.tableCount})
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
                    className={cn(
                      'border-4 rounded-lg p-4 text-center transition-all',
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
    </MainLayout>
  );
}
