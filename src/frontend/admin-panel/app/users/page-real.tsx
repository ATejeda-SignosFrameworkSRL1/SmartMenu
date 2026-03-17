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
  'Customer': 'Cliente',
};

const ROLE_COLORS: Record<string, string> = {
  'Admin': 'bg-purple-500 text-white',
  'Manager': 'bg-blue-500 text-white',
  'Chef': 'bg-orange-500 text-white',
  'KitchenStaff': 'bg-amber-500 text-white',
  'Waiter': 'bg-green-500 text-white',
  'Host': 'bg-pink-500 text-white',
  'Customer': 'bg-gray-500 text-white',
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const loadUsers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      if (token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      }

      const response = await api.get('/api/user');
      setUsers(response.data);
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredUsers = users.filter(user => {
    const matchesRole = selectedRole === 'all' || user.role === selectedRole;
    const matchesSearch = searchTerm === '' || 
      user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesRole && matchesSearch;
  });

  const allRoles = Array.from(new Set(users.map(u => u.role)));

  const roleStats = allRoles.map(role => ({
    role,
    count: users.filter(u => u.role === role).length
  }));

  const stats = {
    total: users.length,
    active: users.filter(u => u.isActive).length,
    inactive: users.filter(u => !u.isActive).length,
  };

  return (
    <MainLayout title="Gestión de Usuarios">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Gestión de Usuarios</h1>
            <p className="text-muted-foreground">Administra los usuarios del sistema</p>
          </div>
          <Button onClick={loadUsers} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
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
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="border-b hover:bg-muted/50">
                        <td className="p-3">
                          <div className="font-medium">{user.firstName} {user.lastName}</div>
                        </td>
                        <td className="p-3 text-muted-foreground">{user.email}</td>
                        <td className="p-3 text-muted-foreground">{user.phone}</td>
                        <td className="p-3">
                          <Badge className={cn('text-xs', ROLE_COLORS[user.role] || 'bg-gray-500')}>
                            {ROLE_LABELS[user.role] || user.role}
                          </Badge>
                        </td>
                        <td className="p-3">
                          {user.isActive ? (
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
                          {new Date(user.createdAt).toLocaleDateString('es-DO')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
