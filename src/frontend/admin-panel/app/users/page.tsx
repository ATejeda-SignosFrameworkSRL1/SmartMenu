'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Search,
  RefreshCw,
  Users as UsersIcon,
  ToggleLeft,
  ToggleRight,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: '',
});

interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  'Admin': 'Administrador',
  'Manager': 'Gerente',
  'Chef': 'Chef',
  'KitchenStaff': 'Personal de Cocina',
  'Waiter': 'Mesero',
  'Host': 'Recepcionista',
  'Cashier': 'Cajero',
  'Customer': 'Cliente',
};

const ROLE_COLORS: Record<string, string> = {
  'Admin': 'bg-purple-500 text-white',
  'Manager': 'bg-blue-500 text-white',
  'Chef': 'bg-orange-500 text-white',
  'KitchenStaff': 'bg-amber-500 text-white',
  'Waiter': 'bg-green-500 text-white',
  'Host': 'bg-pink-500 text-white',
  'Cashier': 'bg-cyan-500 text-white',
  'Customer': 'bg-gray-500 text-white',
};

const ROLES = ['Admin', 'Manager', 'Chef', 'KitchenStaff', 'Waiter', 'Host', 'Cashier', 'Customer'];

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formUser, setFormUser] = useState({ email: '', password: '', firstName: '', lastName: '', phone: '', role: 'Waiter', isActive: true, assignedZoneId: null as number | null });
  const [kitchenBarZones, setKitchenBarZones] = useState<any[]>([]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      if (token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      }

      const response = await api.get('/api/user');
      const list = Array.isArray(response.data) ? response.data : (response.data?.data ?? []);
      setUsers(list);
    } catch (error: any) {
      console.error('Error loading users:', error);
      if (error?.response?.status === 401) {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        toast.error('Sesión expirada. Inicia sesión de nuevo.');
        window.location.href = 'https://172.31.98.64:3000/login';
        return;
      }
      toast.error('Error al cargar usuarios');
      setUsers([]);
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
    loadUsers();
    loadKitchenBarZones();
  }, []);

  const loadKitchenBarZones = async () => {
    try {
      const res = await api.get('/api/zone');
      const all = Array.isArray(res.data) ? res.data : [];
      setKitchenBarZones(all.filter((z: any) => {
        const t = z.type ?? z.Type;
        return t === 'Kitchen' || t === 'Bar';
      }));
    } catch (e) {
      console.error('Error loading kitchen/bar zones:', e);
    }
  };

  const getRole = (u: User) => (u as any).role ?? (u as any).Role ?? '';
  const getFirstName = (u: User) => (u as any).firstName ?? (u as any).FirstName ?? '';
  const getLastName = (u: User) => (u as any).lastName ?? (u as any).LastName ?? '';
  const getEmail = (u: User) => (u as any).email ?? (u as any).Email ?? '';
  const filteredUsers = users.filter(user => {
    const role = getRole(user);
    const matchesRole = selectedRole === 'all' || role === selectedRole;
    const matchesSearch = searchTerm === '' || 
      getFirstName(user).toLowerCase().includes(searchTerm.toLowerCase()) ||
      getLastName(user).toLowerCase().includes(searchTerm.toLowerCase()) ||
      getEmail(user).toLowerCase().includes(searchTerm.toLowerCase());
    return matchesRole && matchesSearch;
  });

  const allRoles = Array.from(new Set(users.map(u => getRole(u))));

  const roleStats = allRoles.map(role => ({
    role,
    count: users.filter(u => getRole(u) === role).length
  }));

  const openCreate = () => {
    setEditingUser(null);
    setFormUser({ email: '', password: '', firstName: '', lastName: '', phone: '', role: 'Waiter', isActive: true, assignedZoneId: null });
    setShowUserModal(true);
  };
  const openEdit = (u: User) => {
    setEditingUser(u);
    setFormUser({
      email: getEmail(u),
      password: '',
      firstName: getFirstName(u),
      lastName: getLastName(u),
      phone: (u as any).phone ?? (u as any).Phone ?? '',
      role: getRole(u),
      isActive: (u as any).isActive ?? (u as any).IsActive ?? true,
      assignedZoneId: (u as any).assignedZoneId ?? (u as any).AssignedZoneId ?? null
    });
    setShowUserModal(true);
  };
  const saveUser = async () => {
    try {
      const zoneId = ['Chef', 'KitchenStaff'].includes(formUser.role) || formUser.role === 'Waiter' ? formUser.assignedZoneId : null;
      if (editingUser) {
        await api.put(`/api/user/${(editingUser as any).id ?? (editingUser as any).Id}`, {
          email: formUser.email,
          password: formUser.password || undefined,
          firstName: formUser.firstName,
          lastName: formUser.lastName,
          phone: formUser.phone,
          role: formUser.role,
          isActive: formUser.isActive,
          assignedZoneId: zoneId ?? 0
        });
        toast.success('Usuario actualizado');
      } else {
        await api.post('/api/user', {
          email: formUser.email,
          password: formUser.password,
          firstName: formUser.firstName,
          lastName: formUser.lastName,
          phone: formUser.phone,
          role: formUser.role,
          isActive: formUser.isActive,
          assignedZoneId: zoneId
        });
        toast.success('Usuario creado');
      }
      setShowUserModal(false);
      loadUsers();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Error al guardar');
    }
  };
  const deleteUser = async (u: User) => {
    if (!confirm('¿Eliminar este usuario?')) return;
    try {
      await api.delete(`/api/user/${(u as any).id ?? (u as any).Id}`);
      toast.success('Usuario eliminado');
      loadUsers();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Error al eliminar');
    }
  };

  const stats = {
    total: users.length,
    active: users.filter(u => u.isActive).length,
    inactive: users.filter(u => !u.isActive).length,
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Gestión de Usuarios</h1>
            <p className="text-muted-foreground">Administra los usuarios del sistema</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={loadUsers} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualizar
            </Button>
            <Button onClick={openCreate}>
              <UsersIcon className="h-4 w-4 mr-2" />
              Crear usuario
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <UsersIcon className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="text-2xl font-bold">{stats.total}</div>
                  <p className="text-xs text-muted-foreground">Total Usuarios</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-success" />
                <div>
                  <div className="text-2xl font-bold">{stats.active}</div>
                  <p className="text-xs text-muted-foreground">Activos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-danger" />
                <div>
                  <div className="text-2xl font-bold">{stats.inactive}</div>
                  <p className="text-xs text-muted-foreground">Inactivos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <input
                  type="text"
                  placeholder="Buscar por nombre o email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full border rounded-lg px-3 py-2"
                />
              </div>

              {/* Role Filter */}
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={selectedRole === 'all' ? 'default' : 'outline'}
                  onClick={() => setSelectedRole('all')}
                  size="sm"
                >
                  Todos ({users.length})
                </Button>
                {roleStats.map(({ role, count }) => (
                  <Button
                    key={role}
                    variant={selectedRole === role ? 'default' : 'outline'}
                    onClick={() => setSelectedRole(role)}
                    size="sm"
                  >
                    {ROLE_LABELS[role] || role} ({count})
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Users List */}
        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">Cargando usuarios...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8">
                <UsersIcon className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">No se encontraron usuarios</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-semibold">Usuario</th>
                      <th className="text-left p-3 font-semibold">Email</th>
                      <th className="text-left p-3 font-semibold">Teléfono</th>
                      <th className="text-left p-3 font-semibold">Rol</th>
                      <th className="text-left p-3 font-semibold">Estado</th>
                      <th className="text-left p-3 font-semibold">Fecha Registro</th>
                    <th className="text-left p-3 font-semibold">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="border-b hover:bg-muted/50">
                        <td className="p-3">
                          <div className="font-medium">{getFirstName(user)} {getLastName(user)}</div>
                        </td>
                        <td className="p-3 text-muted-foreground">{getEmail(user)}</td>
                        <td className="p-3 text-muted-foreground">{(user as any).phone ?? (user as any).Phone ?? ''}</td>
                        <td className="p-3">
                          <Badge className={cn('text-xs', ROLE_COLORS[getRole(user)] || 'bg-gray-500')}>
                            {ROLE_LABELS[getRole(user)] || getRole(user)}
                          </Badge>
                          {((user as any).assignedZoneName ?? (user as any).AssignedZoneName) && (
                            <span className="ml-1 text-xs text-gray-500">({(user as any).assignedZoneName ?? (user as any).AssignedZoneName})</span>
                          )}
                        </td>
                        <td className="p-3">
                          {((user as any).isActive ?? (user as any).IsActive ?? true) ? (
                            <Badge className="bg-success text-white text-xs">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Activo
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              <XCircle className="h-3 w-3 mr-1" />
                              Inactivo
                            </Badge>
                          )}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {new Date((user as any).createdAt ?? (user as any).CreatedAt ?? 0).toLocaleDateString('es-DO')}
                        </td>
                        <td className="p-3">
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => openEdit(user)}>Editar</Button>
                            <Button variant="outline" size="sm" className="text-red-600" onClick={() => deleteUser(user)}>Eliminar</Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal Crear/Editar usuario */}
        {showUserModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowUserModal(false)}>
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
              <h2 className="text-xl font-bold mb-4">{editingUser ? 'Editar usuario' : 'Crear usuario'}</h2>
              <div className="space-y-3 mb-4">
                <input type="text" placeholder="Email" value={formUser.email} onChange={e => setFormUser({ ...formUser, email: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
                <input type="password" placeholder={editingUser ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña'} value={formUser.password} onChange={e => setFormUser({ ...formUser, password: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
                <input type="text" placeholder="Nombre" value={formUser.firstName} onChange={e => setFormUser({ ...formUser, firstName: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
                <input type="text" placeholder="Apellido" value={formUser.lastName} onChange={e => setFormUser({ ...formUser, lastName: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
                <input type="text" placeholder="Teléfono" value={formUser.phone} onChange={e => setFormUser({ ...formUser, phone: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
                <select value={formUser.role} onChange={e => setFormUser({ ...formUser, role: e.target.value, assignedZoneId: null })} className="w-full border rounded-lg px-3 py-2">
                  {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>)}
                </select>
                {['Chef', 'KitchenStaff'].includes(formUser.role) && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Cocina asignada</label>
                    <select
                      value={formUser.assignedZoneId ?? ''}
                      onChange={e => setFormUser({ ...formUser, assignedZoneId: e.target.value ? Number(e.target.value) : null })}
                      className="w-full border rounded-lg px-3 py-2"
                    >
                      <option value="">Sin asignar</option>
                      {kitchenBarZones.filter((z: any) => (z.type ?? z.Type) === 'Kitchen').map((z: any) => (
                        <option key={z.id ?? z.Id} value={z.id ?? z.Id}>{z.name ?? z.Name}</option>
                      ))}
                    </select>
                  </div>
                )}
                {editingUser && (
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={formUser.isActive} onChange={e => setFormUser({ ...formUser, isActive: e.target.checked })} />
                    Activo
                  </label>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowUserModal(false)}>Cancelar</Button>
                <Button className="flex-1" onClick={saveUser} disabled={!formUser.email || (!editingUser && !formUser.password)}>Guardar</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
