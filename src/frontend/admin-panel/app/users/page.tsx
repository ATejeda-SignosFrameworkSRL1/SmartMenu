'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { dateLocale } from '@/i18n/config';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Search,
  RefreshCw,
  Users as UsersIcon,
  CheckCircle,
  XCircle,
  KeyRound,
  Clock,
  AlertTriangle,
  Trash2,
  ShieldAlert,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import axios from 'axios';
import toast from 'react-hot-toast';
import { PinManagerModal } from '@/components/PinManagerModal';
import { WaiterAuthModeSelector } from '@/components/WaiterAuthModeSelector';

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
  // Sprint 5 — info PIN
  hasPin?: boolean;
  pinSetAt?: string | null;
}

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
  const t = useTranslations('users');
  const dl = dateLocale(useLocale());

  const ROLE_LABELS: Record<string, string> = {
    'Admin': t('roles.Admin'),
    'Manager': t('roles.Manager'),
    'Chef': t('roles.Chef'),
    'KitchenStaff': t('roles.KitchenStaff'),
    'Waiter': t('roles.Waiter'),
    'Host': t('roles.Host'),
    'Cashier': t('roles.Cashier'),
    'Customer': t('roles.Customer'),
  };

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formUser, setFormUser] = useState({ email: '', password: '', firstName: '', lastName: '', phone: '', role: 'Waiter', isActive: true, assignedZoneId: null as number | null });
  const [kitchenBarZones, setKitchenBarZones] = useState<any[]>([]);
  // USER-CREATE.2 — UX: loading state + error inline persistente + validaciones
  const [savingUser, setSavingUser] = useState(false);
  const [userFormError, setUserFormError] = useState<string | null>(null);
  // Sprint 5 — PIN management
  const [pinUser, setPinUser] = useState<User | null>(null);
  // USER-CRUD.1 — Modal de eliminación con impacto detallado
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [deletionImpact, setDeletionImpact] = useState<any>(null);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // SHIFT — "Tiempo en turno" en vivo por usuario (turno activo del waiter)
  const [shiftByWaiter, setShiftByWaiter] = useState<Record<number, { baseMinutes: number; fetchedAt: number }>>({});
  const [shiftNow, setShiftNow] = useState<number>(Date.now());

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
        toast.error(t('toast.sessionExpired'));
        window.location.href = '/login';
        return;
      }
      toast.error(t('toast.loadError'));
      setUsers([]);
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
    loadUsers();
    loadKitchenBarZones();
    loadActiveShifts();
    const refetch = setInterval(loadActiveShifts, 60000);           // refrescar turnos activos
    const tick = setInterval(() => setShiftNow(Date.now()), 30000); // duración en vivo
    return () => { clearInterval(refetch); clearInterval(tick); };
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

  // SHIFT — turnos activos (waiter) para la columna "Tiempo en turno"
  const loadActiveShifts = async () => {
    try {
      const res = await api.get('/api/waitershift/active');
      const fetchedAt = Date.now();
      const map: Record<number, { baseMinutes: number; fetchedAt: number }> = {};
      (Array.isArray(res.data) ? res.data : []).forEach((s: any) => {
        const wid = s.waiterId ?? s.WaiterId;
        const dm = Number(s.durationMinutes ?? s.DurationMinutes ?? 0) || 0;
        if (wid) map[wid] = { baseMinutes: dm, fetchedAt };
      });
      setShiftByWaiter(map);
    } catch { /* sin turnos o sin permiso: la columna mostrará "Fuera de turno" */ }
  };

  // Duración en vivo = base del servidor + minutos desde el fetch (evita problemas de zona horaria)
  const getOnShift = (u: User): { onShift: boolean; label: string } => {
    const uid = (u as any).id ?? (u as any).Id;
    const e = shiftByWaiter[uid];
    if (!e) return { onShift: false, label: t('shift.offShift') };
    const mins = e.baseMinutes + Math.max(0, Math.floor((shiftNow - e.fetchedAt) / 60000));
    const h = Math.floor(mins / 60), m = mins % 60;
    return { onShift: true, label: h > 0 ? `${h}h ${m}m` : `${m}m` };
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
    setUserFormError(null);
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
    setUserFormError(null);
    setShowUserModal(true);
  };

  // USER-CREATE.2 — Validación cliente con mensajes claros antes de tocar la red
  const validateUserForm = (): string | null => {
    const email = formUser.email.trim();
    if (!email) return t('validation.emailRequired');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return t('validation.emailInvalid');
    if (!editingUser) {
      if (!formUser.password) return t('validation.passwordRequired');
      if (formUser.password.length < 8) return t('validation.passwordTooShort');
    } else if (formUser.password && formUser.password.length > 0 && formUser.password.length < 8) {
      return t('validation.passwordChangeTooShort');
    }
    if (!formUser.firstName.trim()) return t('validation.firstNameRequired');
    if (!formUser.lastName.trim()) return t('validation.lastNameRequired');
    return null;
  };

  const saveUser = async () => {
    setUserFormError(null);
    const clientError = validateUserForm();
    if (clientError) { setUserFormError(clientError); return; }

    setSavingUser(true);
    try {
      const zoneId = ['Chef', 'KitchenStaff'].includes(formUser.role) || formUser.role === 'Waiter' ? formUser.assignedZoneId : null;
      if (editingUser) {
        await api.put(`/api/user/${(editingUser as any).id ?? (editingUser as any).Id}`, {
          email: formUser.email.trim(),
          password: formUser.password || undefined,
          firstName: formUser.firstName.trim(),
          lastName: formUser.lastName.trim(),
          phone: formUser.phone.trim(),
          role: formUser.role,
          isActive: formUser.isActive,
          assignedZoneId: zoneId ?? 0
        });
        toast.success(t('toast.userUpdated', { name: `${formUser.firstName} ${formUser.lastName}` }));
      } else {
        await api.post('/api/user', {
          email: formUser.email.trim(),
          password: formUser.password,
          firstName: formUser.firstName.trim(),
          lastName: formUser.lastName.trim(),
          phone: formUser.phone.trim(),
          role: formUser.role,
          isActive: formUser.isActive,
          assignedZoneId: zoneId
        });
        toast.success(t('toast.userCreated', { name: `${formUser.firstName} ${formUser.lastName}` }));
      }
      setShowUserModal(false);
      setUserFormError(null);
      loadUsers();
    } catch (e: any) {
      // Error inline (queda visible) + toast para usuarios con scroll lejos del modal
      const msg = e?.response?.data?.error || e?.response?.data?.message || e?.message || t('toast.saveError');
      setUserFormError(msg);
      toast.error(msg);
    } finally {
      setSavingUser(false);
    }
  };
  // USER-CRUD.1 — Abrir modal de eliminación: pide el "impact report" al backend
  // antes de confirmar (cuántas órdenes/audit/etc. quedarán huérfanas), para que
  // el admin sepa si será hard o soft delete antes de presionar el botón rojo.
  const openDeleteModal = async (u: User) => {
    const id = (u as any).id ?? (u as any).Id;
    setDeletingUser(u);
    setDeletionImpact(null);
    setLoadingImpact(true);
    try {
      const res = await api.get(`/api/user/${id}/deletion-impact`);
      setDeletionImpact(res.data);
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || t('toast.impactError');
      toast.error(msg);
      setDeletingUser(null);
    } finally {
      setLoadingImpact(false);
    }
  };

  const closeDeleteModal = () => {
    if (confirmingDelete) return;
    setDeletingUser(null);
    setDeletionImpact(null);
  };

  const confirmDelete = async () => {
    if (!deletingUser) return;
    const id = (deletingUser as any).id ?? (deletingUser as any).Id;
    setConfirmingDelete(true);
    try {
      const res = await api.delete(`/api/user/${id}`);
      const mode = res.data?.mode;
      const msg = res.data?.message ||
        (mode === 'hard' ? t('toast.userDeletedHard') : t('toast.userDeactivated'));
      toast.success(msg);
      setDeletingUser(null);
      setDeletionImpact(null);
      loadUsers();
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.response?.data?.detail || t('toast.deleteError');
      toast.error(msg);
    } finally {
      setConfirmingDelete(false);
    }
  };

  const stats = {
    total: users.length,
    active: users.filter(u => u.isActive).length,
    inactive: users.filter(u => !u.isActive).length,
  };

  return (
    <MainLayout title={t('pageTitle')}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t('pageTitle')}</h1>
            <p className="text-muted-foreground">{t('pageSubtitle')}</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={loadUsers} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              {t('actions.refresh')}
            </Button>
            <Button onClick={openCreate}>
              <UsersIcon className="h-4 w-4 mr-2" />
              {t('actions.createUser')}
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
                  <p className="text-xs text-muted-foreground">{t('stats.total')}</p>
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
                  <p className="text-xs text-muted-foreground">{t('stats.active')}</p>
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
                  <p className="text-xs text-muted-foreground">{t('stats.inactive')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sprint 5.2 — Selector de modo auth del waiter */}
        <WaiterAuthModeSelector />

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <input
                  type="text"
                  placeholder={t('search.placeholder')}
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
                  {t('filter.all', { count: users.length })}
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
                <p className="text-sm text-muted-foreground">{t('loading')}</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8">
                <UsersIcon className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">{t('empty')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-semibold">{t('table.user')}</th>
                      <th className="text-left p-3 font-semibold">{t('table.email')}</th>
                      <th className="text-left p-3 font-semibold">{t('table.phone')}</th>
                      <th className="text-left p-3 font-semibold">{t('table.role')}</th>
                      <th className="text-left p-3 font-semibold">{t('table.status')}</th>
                      <th className="text-left p-3 font-semibold">{t('table.shiftTime')}</th>
                      <th className="text-left p-3 font-semibold">{t('table.pin')}</th>
                      <th className="text-left p-3 font-semibold">{t('table.registrationDate')}</th>
                      <th className="text-left p-3 font-semibold">{t('table.actions')}</th>
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
                              {t('status.active')}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              <XCircle className="h-3 w-3 mr-1" />
                              {t('status.inactive')}
                            </Badge>
                          )}
                        </td>
                        <td className="p-3">
                          {(() => {
                            const s = getOnShift(user);
                            return s.onShift ? (
                              <Badge className="bg-emerald-500 text-white text-xs">
                                <Clock className="h-3 w-3 mr-1" />
                                {s.label}
                              </Badge>
                            ) : (
                              <span className="text-xs text-gray-400 italic">{t('shift.offShift')}</span>
                            );
                          })()}
                        </td>
                        <td className="p-3">
                          {/* Sprint 5.1 — columna PIN */}
                          {(() => {
                            const role = getRole(user);
                            // Solo mostrar PIN-relevante para roles que usan el waiter-app o cashier-app
                            const isPinRelevantRole = role === 'Waiter' || role === 'Cashier' || role === 'Manager' || role === 'Admin';
                            if (!isPinRelevantRole) {
                              return <span className="text-xs text-gray-400 italic">{t('pin.notApplicable')}</span>;
                            }
                            const hasPin = (user as any).hasPin ?? (user as any).HasPin ?? false;
                            return hasPin ? (
                              <Badge className="bg-emerald-500 text-white text-xs">
                                <KeyRound className="h-3 w-3 mr-1" />
                                {t('pin.configured')}
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs text-amber-700 bg-amber-50 border border-amber-200">
                                {t('pin.notSet')}
                              </Badge>
                            );
                          })()}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {new Date((user as any).createdAt ?? (user as any).CreatedAt ?? 0).toLocaleDateString(dl)}
                        </td>
                        <td className="p-3">
                          <div className="flex gap-2 flex-wrap">
                            <Button variant="outline" size="sm" onClick={() => openEdit(user)}>{t('actions.edit')}</Button>
                            {(() => {
                              const role = getRole(user);
                              const isPinRelevantRole = role === 'Waiter' || role === 'Cashier' || role === 'Manager' || role === 'Admin';
                              if (!isPinRelevantRole) return null;
                              const hasPin = (user as any).hasPin ?? (user as any).HasPin ?? false;
                              return (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setPinUser(user)}
                                  className={hasPin ? 'text-emerald-700 border-emerald-200 hover:bg-emerald-50' : 'text-amber-700 border-amber-200 hover:bg-amber-50'}
                                  title={hasPin ? t('pin.titleChange') : t('pin.titleCreate')}
                                >
                                  <KeyRound className="h-3.5 w-3.5 mr-1" />
                                  {hasPin ? t('pin.buttonChange') : t('pin.buttonCreate')}
                                </Button>
                              );
                            })()}
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600 border-red-200 hover:bg-red-50"
                              onClick={() => openDeleteModal(user)}
                              title={t('actions.deleteTitle')}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1" />
                              {t('actions.delete')}
                            </Button>
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

        {/* USER-CREATE.2 — Modal Crear/Editar usuario rediseñado con UX clara */}
        {showUserModal && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto"
            onClick={() => !savingUser && setShowUserModal(false)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden my-auto"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold">{editingUser ? t('modal.titleEdit') : t('modal.titleCreate')}</h2>
                  <p className="text-xs text-blue-100 mt-0.5">
                    {editingUser
                      ? t('modal.subtitleEdit', { name: `${editingUser.firstName} ${editingUser.lastName}` })
                      : t('modal.subtitleCreate')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => !savingUser && setShowUserModal(false)}
                  className="p-1.5 hover:bg-white/10 rounded-lg disabled:opacity-50"
                  disabled={savingUser}
                  aria-label={t('modal.closeAriaLabel')}
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
                {/* Error banner persistente */}
                {userFormError && (
                  <div className="bg-red-50 border-2 border-red-200 rounded-lg p-3 flex items-start gap-2.5">
                    <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-red-900">{t('modal.errorBannerTitle')}</p>
                      <p className="text-xs text-red-700 mt-0.5">{userFormError}</p>
                    </div>
                  </div>
                )}

                {/* Sección: Identidad */}
                <fieldset className="space-y-3" disabled={savingUser}>
                  <legend className="text-[11px] uppercase tracking-widest font-bold text-gray-500 mb-1 flex items-center gap-2">
                    <div className="w-1 h-3.5 bg-blue-500 rounded-full"></div>
                    {t('modal.sectionIdentity')}
                  </legend>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-xs font-semibold text-gray-700 mb-1 block">
                        {t('modal.labelFirstName')} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder={t('modal.placeholderFirstName')}
                        value={formUser.firstName}
                        onChange={e => setFormUser({ ...formUser, firstName: e.target.value })}
                        className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                        autoFocus={!editingUser}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 mb-1 block">
                        {t('modal.labelLastName')} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder={t('modal.placeholderLastName')}
                        value={formUser.lastName}
                        onChange={e => setFormUser({ ...formUser, lastName: e.target.value })}
                        className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">{t('modal.labelPhone')}</label>
                    <input
                      type="tel"
                      placeholder="809-555-0000"
                      value={formUser.phone}
                      onChange={e => setFormUser({ ...formUser, phone: e.target.value })}
                      className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                    />
                  </div>
                </fieldset>

                {/* Sección: Acceso */}
                <fieldset className="space-y-3 pt-2 border-t border-gray-100" disabled={savingUser}>
                  <legend className="text-[11px] uppercase tracking-widest font-bold text-gray-500 mb-1 flex items-center gap-2">
                    <div className="w-1 h-3.5 bg-emerald-500 rounded-full"></div>
                    {t('modal.sectionCredentials')}
                  </legend>

                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">
                      {t('modal.labelEmail')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      placeholder="usuario@smartmenu.com"
                      value={formUser.email}
                      onChange={e => setFormUser({ ...formUser, email: e.target.value })}
                      className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                      autoComplete="off"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">
                      {t('modal.labelPassword')} {!editingUser && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type="password"
                      placeholder={editingUser ? t('modal.placeholderPasswordEdit') : t('modal.placeholderPasswordCreate')}
                      value={formUser.password}
                      onChange={e => setFormUser({ ...formUser, password: e.target.value })}
                      className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                      autoComplete="new-password"
                    />
                    <p className="text-[11px] text-gray-500 mt-1">
                      {editingUser
                        ? t('modal.passwordHintEdit')
                        : t('modal.passwordHintCreate')}
                    </p>
                  </div>
                </fieldset>

                {/* Sección: Rol */}
                <fieldset className="space-y-3 pt-2 border-t border-gray-100" disabled={savingUser}>
                  <legend className="text-[11px] uppercase tracking-widest font-bold text-gray-500 mb-1 flex items-center gap-2">
                    <div className="w-1 h-3.5 bg-purple-500 rounded-full"></div>
                    {t('modal.sectionRole')}
                  </legend>

                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">{t('modal.labelRole')}</label>
                    <select
                      value={formUser.role}
                      onChange={e => setFormUser({ ...formUser, role: e.target.value, assignedZoneId: null })}
                      className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-400 focus:outline-none bg-white"
                    >
                      {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>)}
                    </select>
                  </div>

                  {['Chef', 'KitchenStaff'].includes(formUser.role) && (
                    <div className="bg-amber-50/50 border border-amber-200 rounded-lg p-3">
                      <label className="text-xs font-semibold text-amber-900 mb-1 block">{t('modal.labelKitchenZone')}</label>
                      <select
                        value={formUser.assignedZoneId ?? ''}
                        onChange={e => setFormUser({ ...formUser, assignedZoneId: e.target.value ? Number(e.target.value) : null })}
                        className="w-full border-2 border-amber-200 rounded-lg px-3 py-2 text-sm focus:border-amber-400 focus:outline-none bg-white"
                      >
                        <option value="">{t('modal.optionNoKitchen')}</option>
                        {kitchenBarZones.filter((z: any) => (z.type ?? z.Type) === 'Kitchen').map((z: any) => (
                          <option key={z.id ?? z.Id} value={z.id ?? z.Id}>{z.name ?? z.Name}</option>
                        ))}
                      </select>
                      <p className="text-[11px] text-amber-700 mt-1">{t('modal.kitchenZoneHint')}</p>
                    </div>
                  )}

                  {editingUser && (
                    <label className="flex items-center gap-2 cursor-pointer bg-gray-50 rounded-lg p-2.5 hover:bg-gray-100 transition-colors">
                      <input
                        type="checkbox"
                        checked={formUser.isActive}
                        onChange={e => setFormUser({ ...formUser, isActive: e.target.checked })}
                        className="w-4 h-4 accent-emerald-500"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-800">{t('modal.activeUserLabel')}</p>
                        <p className="text-[11px] text-gray-500">{t('modal.activeUserHint')}</p>
                      </div>
                      {formUser.isActive ? (
                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-gray-400" />
                      )}
                    </label>
                  )}
                </fieldset>
              </div>

              {/* Footer con botones */}
              <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowUserModal(false)}
                  disabled={savingUser}
                  className="min-w-[100px]"
                >
                  {t('actions.cancel')}
                </Button>
                <div className="flex-1"></div>
                <Button
                  onClick={saveUser}
                  disabled={savingUser}
                  className="min-w-[140px] bg-blue-600 hover:bg-blue-700"
                >
                  {savingUser ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
                      {t('modal.saving')}
                    </span>
                  ) : (
                    editingUser ? t('modal.buttonUpdate') : t('actions.createUser')
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Sprint 5.1 — Modal de gestión de PIN */}
        {pinUser && (
          <PinManagerModal
            user={pinUser as any}
            onClose={() => setPinUser(null)}
            onUpdated={() => loadUsers()}
          />
        )}

        {/* USER-CRUD.1 — Modal de eliminación con impact report */}
        {deletingUser && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={closeDeleteModal}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className={cn(
                'px-6 py-4 flex items-start gap-3',
                deletionImpact?.isBlocked
                  ? 'bg-gradient-to-r from-gray-600 to-gray-700 text-white'
                  : deletionImpact?.willSoftDelete
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
                    : 'bg-gradient-to-r from-red-600 to-red-700 text-white'
              )}>
                {deletionImpact?.isBlocked ? (
                  <ShieldAlert className="w-6 h-6 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-6 h-6 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <h2 className="text-lg font-bold">
                    {deletionImpact?.isBlocked
                      ? t('deleteModal.titleBlocked')
                      : deletionImpact?.willSoftDelete
                        ? t('deleteModal.titleDeactivate')
                        : t('deleteModal.titleDelete')}
                  </h2>
                  <p className="text-xs opacity-90 mt-0.5">
                    {getFirstName(deletingUser)} {getLastName(deletingUser)} · {getEmail(deletingUser)}
                  </p>
                </div>
              </div>

              <div className="px-6 py-5 space-y-4">
                {loadingImpact && (
                  <div className="flex items-center justify-center py-8 text-gray-500">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    {t('deleteModal.analyzingDeps')}
                  </div>
                )}

                {!loadingImpact && deletionImpact?.isBlocked && (
                  <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-4 text-sm">
                    <p className="font-semibold text-gray-900 mb-1">
                      {deletionImpact.blockedReason}
                    </p>
                    <p className="text-xs text-gray-600">
                      {deletionImpact.isCurrentUser
                        ? t('deleteModal.blockedSelf')
                        : t('deleteModal.blockedLastAdmin')}
                    </p>
                  </div>
                )}

                {!loadingImpact && deletionImpact && !deletionImpact.isBlocked && deletionImpact.canHardDelete && (
                  <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 space-y-2">
                    <p className="text-sm font-semibold text-red-900 flex items-center gap-2">
                      <Trash2 className="w-4 h-4" />
                      {t('deleteModal.hardDeleteTitle')}
                    </p>
                    <p className="text-xs text-red-800">
                      {t('deleteModal.hardDeleteDesc')}
                    </p>
                    <p className="text-xs text-red-700">
                      {t('deleteModal.hardDeleteEmailFree', { email: getEmail(deletingUser) })}
                    </p>
                  </div>
                )}

                {!loadingImpact && deletionImpact && !deletionImpact.isBlocked && deletionImpact.willSoftDelete && (
                  <>
                    <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4 space-y-2">
                      <p className="text-sm font-semibold text-amber-900 flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4" />
                        {t('deleteModal.softDeleteTitle')}
                      </p>
                      <p className="text-xs text-amber-800">
                        {t('deleteModal.softDeleteDesc')}
                      </p>
                      <ul className="text-xs text-amber-800 space-y-1 ml-4 list-disc">
                        <li>{t('deleteModal.softDeleteBullet1')}</li>
                        <li>{t('deleteModal.softDeleteBullet2')}</li>
                        <li>{t('deleteModal.softDeleteBullet3')}</li>
                        <li>{t('deleteModal.softDeleteBullet4')}</li>
                      </ul>
                    </div>

                    {/* Resumen de dependencias */}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <p className="text-[11px] uppercase tracking-wider font-bold text-gray-500 mb-2">
                        {t('deleteModal.historyTitle')}
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {deletionImpact.dependencies.orders > 0 && (
                          <div className="flex justify-between bg-white rounded px-2 py-1 border border-gray-100">
                            <span className="text-gray-600">{t('deleteModal.depOrders')}</span>
                            <span className="font-semibold">{deletionImpact.dependencies.orders}</span>
                          </div>
                        )}
                        {deletionImpact.dependencies.payments > 0 && (
                          <div className="flex justify-between bg-white rounded px-2 py-1 border border-gray-100">
                            <span className="text-gray-600">{t('deleteModal.depPayments')}</span>
                            <span className="font-semibold">{deletionImpact.dependencies.payments}</span>
                          </div>
                        )}
                        {deletionImpact.dependencies.tableSessions > 0 && (
                          <div className="flex justify-between bg-white rounded px-2 py-1 border border-gray-100">
                            <span className="text-gray-600">{t('deleteModal.depTableSessions')}</span>
                            <span className="font-semibold">{deletionImpact.dependencies.tableSessions}</span>
                          </div>
                        )}
                        {deletionImpact.dependencies.reservations > 0 && (
                          <div className="flex justify-between bg-white rounded px-2 py-1 border border-gray-100">
                            <span className="text-gray-600">{t('deleteModal.depReservations')}</span>
                            <span className="font-semibold">{deletionImpact.dependencies.reservations}</span>
                          </div>
                        )}
                        {deletionImpact.dependencies.auditEvents > 0 && (
                          <div className="flex justify-between bg-white rounded px-2 py-1 border border-gray-100">
                            <span className="text-gray-600">{t('deleteModal.depAuditLog')}</span>
                            <span className="font-semibold">{deletionImpact.dependencies.auditEvents}</span>
                          </div>
                        )}
                        {deletionImpact.dependencies.tableClaimRequests > 0 && (
                          <div className="flex justify-between bg-white rounded px-2 py-1 border border-gray-100">
                            <span className="text-gray-600">{t('deleteModal.depTableClaims')}</span>
                            <span className="font-semibold">{deletionImpact.dependencies.tableClaimRequests}</span>
                          </div>
                        )}
                        {deletionImpact.dependencies.virtualTables > 0 && (
                          <div className="flex justify-between bg-white rounded px-2 py-1 border border-gray-100">
                            <span className="text-gray-600">{t('deleteModal.depVirtualTables')}</span>
                            <span className="font-semibold">{deletionImpact.dependencies.virtualTables}</span>
                          </div>
                        )}
                        {deletionImpact.dependencies.tableTransfers > 0 && (
                          <div className="flex justify-between bg-white rounded px-2 py-1 border border-gray-100">
                            <span className="text-gray-600">{t('deleteModal.depTransfers')}</span>
                            <span className="font-semibold">{deletionImpact.dependencies.tableTransfers}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={closeDeleteModal}
                  disabled={confirmingDelete}
                  className="min-w-[100px]"
                >
                  {deletionImpact?.isBlocked ? t('actions.close') : t('actions.cancel')}
                </Button>
                <div className="flex-1"></div>
                {!loadingImpact && deletionImpact && !deletionImpact.isBlocked && (
                  <Button
                    onClick={confirmDelete}
                    disabled={confirmingDelete}
                    className={cn(
                      'min-w-[140px] text-white',
                      deletionImpact.willSoftDelete
                        ? 'bg-amber-600 hover:bg-amber-700'
                        : 'bg-red-600 hover:bg-red-700'
                    )}
                  >
                    {confirmingDelete ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        {t('deleteModal.processing')}
                      </span>
                    ) : deletionImpact.willSoftDelete ? (
                      t('deleteModal.confirmDeactivate')
                    ) : (
                      t('deleteModal.confirmDelete')
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
