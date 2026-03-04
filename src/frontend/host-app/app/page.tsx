'use client';

import { useEffect, useState } from 'react';
import { Users, Calendar, LogOut, Plus, X, Clock, Phone, Mail, User, DollarSign, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';

const api = axios.create({
  baseURL: '',
});

interface Zone {
  id: number;
  name: string;
  tableCount: number;
  availableTables: number;
}

interface Table {
  id: number;
  tableNumber: number;
  capacity: number;
  status: string;
  qrCode: string;
}

interface TableWithZone extends Table {
  zoneName: string;
}

export default function HostApp() {
  const [user, setUser] = useState<any>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZone, setSelectedZone] = useState<number | null>(null);
  const [tables, setTables] = useState<TableWithZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [selectedTable, setSelectedTable] = useState<TableWithZone | null>(null);

  // Assign form
  const [numberOfGuests, setNumberOfGuests] = useState('');
  const [specialNotes, setSpecialNotes] = useState('');

  // Reservation form
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [reservationDate, setReservationDate] = useState('');
  const [reservationTime, setReservationTime] = useState('');
  const [reservationGuests, setReservationGuests] = useState('');
  const [reservationNotes, setReservationNotes] = useState('');

  const loadData = async () => {
    try {
      const token = localStorage.getItem('host_token');
      if (!token) return;

      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      const [zonesRes, tablesRes] = await Promise.all([
        api.get('/api/zone'),
        api.get('/api/table')
      ]);

      setZones(zonesRes.data ?? []);
      // El backend devuelve zoneName (camelCase); asegurar que cada mesa tenga zoneName
      const tablesData = (tablesRes.data ?? []).map((table: any) => ({
        ...table,
        zoneName: table.zoneName ?? table.ZoneName ?? 'Sin zona'
      }));
      setTables(tablesData);
    } catch (error: any) {
      console.error('Error loading data:', error);
      const msg = error?.response?.data?.error || error?.message || 'Error al cargar mesas y zonas';
      toast.error(msg);
      setZones([]);
      setTables([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Auth check
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    const userFromUrl = urlParams.get('user');

    if (tokenFromUrl && userFromUrl) {
      localStorage.setItem('host_token', tokenFromUrl);
      localStorage.setItem('host_user', decodeURIComponent(userFromUrl));
      window.history.replaceState({}, '', '/');
    }

    const userData = localStorage.getItem('host_user');
    const token = localStorage.getItem('host_token');

    if (!userData || !token) {
      const clientAppUrl = process.env.NEXT_PUBLIC_CLIENT_APP_URL || window.location.origin.replace(':3004', ':3000');
      window.location.href = `${clientAppUrl}/login`;
      return;
    }

    setUser(JSON.parse(userData));
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    loadData();

    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const openAssignModal = (table: TableWithZone) => {
    if (table.status !== 'Available') {
      toast.error('Esta mesa no está disponible');
      return;
    }
    setSelectedTable(table);
    setNumberOfGuests('');
    setSpecialNotes('');
    setShowAssignModal(true);
  };

  const assignTable = async () => {
    if (!selectedTable || !numberOfGuests) {
      toast.error('Por favor completa todos los campos');
      return;
    }

    try {
      await api.post('/api/tablesession', {
        tableId: selectedTable.id,
        numberOfGuests: parseInt(numberOfGuests),
        hostId: user?.id,
        specialNotes
      });

      toast.success('Mesa asignada exitosamente');
      setShowAssignModal(false);
      loadData();
    } catch (error) {
      toast.error('Error al asignar mesa');
    }
  };

  const openReservationModal = (table: TableWithZone) => {
    setSelectedTable(table);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerEmail('');
    setReservationDate('');
    setReservationTime('');
    setReservationGuests('');
    setReservationNotes('');
    setShowReservationModal(true);
  };

  const createReservation = async () => {
    if (!selectedTable || !customerName || !customerPhone || !reservationDate || !reservationTime || !reservationGuests) {
      toast.error('Por favor completa todos los campos requeridos');
      return;
    }

    try {
      const reservationDateTime = new Date(`${reservationDate}T${reservationTime}`);
      
      await api.post('/api/tablereservation', {
        tableId: selectedTable.id,
        customerName,
        customerPhone,
        customerEmail,
        numberOfGuests: parseInt(reservationGuests),
        reservationDateTime: reservationDateTime.toISOString(),
        specialRequests: reservationNotes,
        hostId: user?.id
      });

      toast.success('Reserva creada exitosamente');
      setShowReservationModal(false);
      loadData();
    } catch (error) {
      toast.error('Error al crear reserva');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Available': return 'bg-green-100 border-green-500 text-green-800';
      case 'Occupied': return 'bg-red-100 border-red-500 text-red-800';
      case 'Reserved': return 'bg-yellow-100 border-yellow-500 text-yellow-800';
      default: return 'bg-gray-100 border-gray-500 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'Available': return 'Disponible';
      case 'Occupied': return 'Ocupada';
      case 'Reserved': return 'Reservada';
      default: return status;
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('host_token');
    localStorage.removeItem('host_user');
    const clientAppUrl = process.env.NEXT_PUBLIC_CLIENT_APP_URL || window.location.origin.replace(':3004', ':3000');
    window.location.href = `${clientAppUrl}/login`;
  };

  const filteredTables = selectedZone
    ? tables.filter(t => zones.find(z => z.id === selectedZone)?.name === t.zoneName)
    : tables;

  const totalCapacity = tables.reduce((sum, t) => sum + t.capacity, 0);
  const availableSeats = tables.filter(t => t.status === 'Available').reduce((sum, t) => sum + t.capacity, 0);
  const occupiedSeats = totalCapacity - availableSeats;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Host App</h1>
              <p className="text-sm text-gray-600">Bienvenido, {user?.name}</p>
            </div>
            <div className="flex items-center gap-4">
              {/* Aforo Stats */}
              <div className="flex gap-4 mr-6">
                <div className="bg-blue-50 px-4 py-2 rounded-lg">
                  <p className="text-xs text-blue-600 font-medium">Aforo Total</p>
                  <p className="text-lg font-bold text-blue-700">{totalCapacity} personas</p>
                </div>
                <div className="bg-green-50 px-4 py-2 rounded-lg">
                  <p className="text-xs text-green-600 font-medium">Disponible</p>
                  <p className="text-lg font-bold text-green-700">{availableSeats} asientos</p>
                </div>
                <div className="bg-red-50 px-4 py-2 rounded-lg">
                  <p className="text-xs text-red-600 font-medium">Ocupado</p>
                  <p className="text-lg font-bold text-red-700">{occupiedSeats} asientos</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                <LogOut className="w-4 h-4" />
                Salir
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Zone Filter */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedZone(null)}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              selectedZone === null
                ? 'bg-primary-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            Todas las Zonas
          </button>
          {zones.map((zone) => (
            <button
              key={zone.id}
              onClick={() => setSelectedZone(zone.id)}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                selectedZone === zone.id
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {zone.name} ({zone.availableTables}/{zone.tableCount})
            </button>
          ))}
        </div>
      </div>

      {/* Tables Grid */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {filteredTables.map((table) => (
            <div
              key={table.id}
              className={`border-4 rounded-2xl p-4 transition-all ${getStatusColor(table.status)}`}
            >
              <div className="text-center mb-3">
                <p className="text-3xl font-bold">#{table.tableNumber}</p>
                <p className="text-xs uppercase tracking-wide mt-1">{table.zoneName}</p>
                <p className="text-sm mt-1">
                  <Users className="w-4 h-4 inline mr-1" />
                  {table.capacity} personas
                </p>
              </div>
              
              <div className="mb-3">
                <span className="text-xs font-bold uppercase">
                  {getStatusLabel(table.status)}
                </span>
              </div>

              {table.status === 'Available' && (
                <div className="space-y-2">
                  <button
                    onClick={() => openAssignModal(table)}
                    className="w-full px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                  >
                    Asignar Ahora
                  </button>
                  <button
                    onClick={() => openReservationModal(table)}
                    className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                  >
                    Reservar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Assign Modal */}
      {showAssignModal && selectedTable && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Asignar Mesa #{selectedTable.tableNumber}</h2>
              <button onClick={() => setShowAssignModal(false)}>
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Número de Personas *
                </label>
                <input
                  type="number"
                  value={numberOfGuests}
                  onChange={(e) => setNumberOfGuests(e.target.value)}
                  max={selectedTable.capacity}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600"
                  placeholder={`Máximo ${selectedTable.capacity}`}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notas Especiales
                </label>
                <textarea
                  value={specialNotes}
                  onChange={(e) => setSpecialNotes(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600"
                  rows={3}
                  placeholder="Ocasión especial, preferencias, etc."
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowAssignModal(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={assignTable}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Asignar Mesa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reservation Modal */}
      {showReservationModal && selectedTable && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-md w-full p-6 my-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Reservar Mesa #{selectedTable.tableNumber}</h2>
              <button onClick={() => setShowReservationModal(false)}>
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Nombre del Cliente *
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Teléfono *
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email (opcional)
                </label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fecha *
                  </label>
                  <input
                    type="date"
                    value={reservationDate}
                    onChange={(e) => setReservationDate(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Hora *
                  </label>
                  <input
                    type="time"
                    value={reservationTime}
                    onChange={(e) => setReservationTime(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Número de Personas *
                </label>
                <input
                  type="number"
                  value={reservationGuests}
                  onChange={(e) => setReservationGuests(e.target.value)}
                  max={selectedTable.capacity}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600"
                  placeholder={`Máximo ${selectedTable.capacity}`}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notas / Solicitudes Especiales
                </label>
                <textarea
                  value={reservationNotes}
                  onChange={(e) => setReservationNotes(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowReservationModal(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={createReservation}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Crear Reserva
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
