'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CalendarCheck,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Users,
  Phone,
  MapPin,
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: '',
});

interface Reservation {
  id: number;
  customerName: string;
  customerPhone: string;
  numberOfGuests: number;
  reservationDateTime: string;
  isConfirmed: boolean;
  tableNumber: number;
  zoneName: string;
  specialRequests?: string;
}

export default function ReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed'>('all');

  const loadReservations = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      if (token) api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      const res = await api.get('/api/tablereservation', { params: { date } });
      setReservations(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Error loading reservations:', error);
      toast.error('Error al cargar reservas');
      setReservations([]);
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
    loadReservations();
  }, [date]);

  useEffect(() => {
    const interval = setInterval(loadReservations, 30000);
    return () => clearInterval(interval);
  }, [date]);

  const confirmReservation = async (id: number) => {
    try {
      await api.put(`/api/tablereservation/${id}/confirm`);
      toast.success('Reserva confirmada');
      loadReservations();
    } catch (error) {
      toast.error('Error al confirmar reserva');
    }
  };

  const cancelReservation = async (id: number) => {
    if (!confirm('¿Cancelar esta reserva?')) return;
    try {
      await api.put(`/api/tablereservation/${id}/cancel`);
      toast.success('Reserva cancelada');
      loadReservations();
    } catch (error) {
      toast.error('Error al cancelar reserva');
    }
  };

  const getVal = (obj: any, key: string) => obj?.[key] ?? obj?.[key.charAt(0).toUpperCase() + key.slice(1)] ?? '';

  const filtered = reservations.filter(r => {
    if (filter === 'pending') return !(getVal(r, 'isConfirmed'));
    if (filter === 'confirmed') return !!(getVal(r, 'isConfirmed'));
    return true;
  });

  const pendingCount = reservations.filter(r => !(getVal(r, 'isConfirmed'))).length;
  const confirmedCount = reservations.filter(r => !!(getVal(r, 'isConfirmed'))).length;

  const formatTime = (dt: string) => {
    try { return new Date(dt).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' }); }
    catch { return '-'; }
  };

  const formatDate = (dt: string) => {
    try { return new Date(dt).toLocaleDateString('es-DO', { weekday: 'short', day: 'numeric', month: 'short' }); }
    catch { return '-'; }
  };

  const isUpcoming = (dt: string) => {
    const diff = new Date(dt).getTime() - Date.now();
    return diff > 0 && diff < 2 * 60 * 60 * 1000;
  };

  return (
    <MainLayout title="Reservas" subtitle="Visualiza y gestiona las reservas del restaurante">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Reservas</h1>
            <p className="text-muted-foreground">Visualiza y gestiona las reservas del restaurante</p>
          </div>
          <Button onClick={loadReservations} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-2 border-blue-500/30">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{reservations.length}</div>
              <p className="text-xs text-muted-foreground">Total Reservas del Día</p>
            </CardContent>
          </Card>
          <Card className="border-2 border-warning/30">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{pendingCount}</div>
              <p className="text-xs text-muted-foreground">Pendientes de Confirmar</p>
            </CardContent>
          </Card>
          <Card className="border-2 border-success/30">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{confirmedCount}</div>
              <p className="text-xs text-muted-foreground">Confirmadas</p>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
              />
              <div className="flex gap-2">
                <Button variant={filter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('all')}>
                  Todas ({reservations.length})
                </Button>
                <Button variant={filter === 'pending' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('pending')}>
                  <Clock className="h-4 w-4 mr-1" />
                  Pendientes ({pendingCount})
                </Button>
                <Button variant={filter === 'confirmed' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('confirmed')}>
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Confirmadas ({confirmedCount})
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista de reservas */}
        <Card>
          <CardHeader>
            <CardTitle>Reservas — {formatDate(date + 'T12:00:00')}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">Cargando reservas...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <CalendarCheck className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
                <p className="text-lg text-muted-foreground">No hay reservas para esta fecha</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map(reservation => {
                  const confirmed = !!(getVal(reservation, 'isConfirmed'));
                  const upcoming = isUpcoming(getVal(reservation, 'reservationDateTime'));

                  return (
                    <div
                      key={reservation.id}
                      className={`border-2 rounded-lg p-4 transition-all ${
                        upcoming && !confirmed
                          ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/20'
                          : confirmed
                          ? 'border-green-300 bg-green-50/50 dark:bg-green-950/10'
                          : 'border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg font-bold">{getVal(reservation, 'customerName')}</span>
                            {confirmed ? (
                              <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">Confirmada</Badge>
                            ) : upcoming ? (
                              <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 animate-pulse">Próxima — Sin confirmar</Badge>
                            ) : (
                              <Badge variant="secondary">Pendiente</Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              {formatTime(getVal(reservation, 'reservationDateTime'))}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="h-3.5 w-3.5" />
                              {getVal(reservation, 'numberOfGuests')} personas
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              Mesa {getVal(reservation, 'tableNumber')} — {getVal(reservation, 'zoneName')}
                            </span>
                            <span className="flex items-center gap-1">
                              <Phone className="h-3.5 w-3.5" />
                              {getVal(reservation, 'customerPhone')}
                            </span>
                          </div>
                          {getVal(reservation, 'specialRequests') && (
                            <p className="text-sm mt-2 text-amber-600 dark:text-amber-400">
                              Nota: {getVal(reservation, 'specialRequests')}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          {!confirmed && (
                            <Button size="sm" onClick={() => confirmReservation(reservation.id)}>
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Confirmar
                            </Button>
                          )}
                          <Button size="sm" variant="destructive" onClick={() => cancelReservation(reservation.id)}>
                            <XCircle className="h-4 w-4 mr-1" />
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
