'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Armchair,
  LayoutDashboard,
  MapPin,
  ChefHat,
  Wine,
  Users,
  Menu,
  Settings,
  UtensilsCrossed,
  ShoppingBag,
  BarChart3,
  CalendarCheck,
  Wrench,
  LogOut,
  X,
  KeyRound,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import axios from 'axios';

const api = axios.create({
  baseURL: '',
});

// Misma lógica que Bar: solo contar bebidas para badge Bar y solo comida para Cocina
const DRINK_KEYWORDS = ['cerveza', 'vino', 'cóctel', 'refresco', 'agua', 'cafe', 'té', 'bebida', 'margarita', 'ron', 'whisky', 'colada', 'piña colada', 'mojito', 'daiquiri', 'soda', 'jugo', 'limonada', 'batido', 'smoothie', 'copa', 'trago', 'coca', 'pepsi'];
function isDrinkItem(dishName: string): boolean {
  const name = (dishName || '').toLowerCase();
  // Match por PALABRA completa (con plurales), no substring: 'agua' no debe matchear
  // 'aguacate' ni 'ron' a 'macarrones'. Mantener en sync con KDS/waiter/client y backend.
  const words = new Set(name.split(/[^a-záéíóúüñ]+/).filter(Boolean));
  return DRINK_KEYWORDS.some(k =>
    k.includes(' ') ? name.includes(k) : words.has(k) || words.has(k + 's') || words.has(k + 'es')
  );
}
// FASE 2 RUTEO — el flag isDrink del backend (zona del plato) MANDA; el matcher
// por nombre queda solo como fallback para payloads sin el campo.
function itemIsDrink(item: any): boolean {
  const flag = item?.isDrink ?? item?.IsDrink;
  return typeof flag === 'boolean' ? flag : isDrinkItem(item?.dishName ?? item?.DishName ?? '');
}
function orderHasDrinkItem(order: any): boolean {
  const items = order?.items ?? order?.Items ?? [];
  return items.some((i: any) => itemIsDrink(i));
}
function orderHasFoodItem(order: any): boolean {
  const items = order?.items ?? order?.Items ?? [];
  return items.some((i: any) => !itemIsDrink(i));
}

const mainNavConfig = [
  { titleKey: 'nav.dashboard', url: '/', icon: LayoutDashboard, badgeKey: null },
  { titleKey: 'nav.orders', url: '/orders', icon: ShoppingBag, badgeKey: 'orders' },
  { titleKey: 'nav.menu', url: '/menu', icon: Menu, badgeKey: null },
  { titleKey: 'nav.tables', url: '/tables', icon: MapPin, badgeKey: null },
  { titleKey: 'nav.floorPlan', url: '/floor-plan', icon: Armchair, badgeKey: null },
  { titleKey: 'nav.kitchen', url: '/kitchen', icon: ChefHat, badgeKey: 'kitchen' },
  { titleKey: 'nav.bar', url: '/bar', icon: Wine, badgeKey: 'bar' },
  { titleKey: 'nav.reservations', url: '/reservations', icon: CalendarCheck, badgeKey: 'reservations' },
  { titleKey: 'nav.maintenance', url: '/maintenance', icon: Wrench, badgeKey: null },
  { titleKey: 'nav.users', url: '/users', icon: Users, badgeKey: null },
  { titleKey: 'nav.reports', url: '/reports', icon: BarChart3, badgeKey: null }
];

export function AppSidebar() {
  const t = useTranslations('sidebar');
  const pathname = usePathname();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const [counts, setCounts] = useState({ orders: 0, kitchen: 0, bar: 0, reservations: 0 });
  const [showSettings, setShowSettings] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ firstName?: string; lastName?: string; email?: string; role?: string } | null>(null);
  const [changePwForm, setChangePwForm] = useState({ current: '', next: '', confirm: '' });
  const [changingPw, setChangingPw] = useState(false);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    if (!token) return;
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    // Cargar usuario actual
    const stored = localStorage.getItem('admin_user');
    if (stored) {
      try { setCurrentUser(JSON.parse(stored)); } catch { /* ignore */ }
    }
    const fetchCounts = async () => {
      try {
        const [ordersRes, reservationsRes] = await Promise.all([
          api.get('/api/order/active').catch(() => ({ data: [] })),
          api.get('/api/tablereservation').catch(() => ({ data: [] }))
        ]);
        const active = Array.isArray(ordersRes.data) ? ordersRes.data : [];
        const status = (o: any) => o?.status ?? o?.Status ?? '';
        const inProgress = active.filter((o: any) => !['Served', 'Completed', 'Cancelled'].includes(status(o)));
        const barCount = inProgress.filter((o: any) => orderHasDrinkItem(o)).length;
        const kitchenCount = inProgress.filter((o: any) => orderHasFoodItem(o)).length;
        const todayLocal = new Date().toLocaleDateString('sv-SE');
        const pendingReservations = Array.isArray(reservationsRes.data)
          ? reservationsRes.data.filter((r: any) => {
              const confirmed = r.isConfirmed ?? r.IsConfirmed;
              const dt = r.reservationDateTime ?? r.ReservationDateTime ?? '';
              const dayLocal = dt ? new Date(dt).toLocaleDateString('sv-SE') : '';
              return !confirmed && dayLocal === todayLocal;
            }).length
          : 0;
        setCounts({
          orders: inProgress.length,
          kitchen: kitchenCount,
          bar: barCount,
          reservations: pendingReservations
        });
      } catch {
        setCounts({ orders: 0, kitchen: 0, bar: 0, reservations: 0 });
      }
    };
    fetchCounts();
    const interval = setInterval(fetchCounts, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    window.location.href = '/login';
  };

  const handleChangePassword = async () => {
    if (!changePwForm.next || changePwForm.next !== changePwForm.confirm) {
      alert(t('password.mismatch')); return;
    }
    if (changePwForm.next.length < 6) {
      alert(t('password.tooShort')); return;
    }
    setChangingPw(true);
    try {
      await api.put('/api/auth/change-password', {
        currentPassword: changePwForm.current,
        newPassword: changePwForm.next,
      });
      alert(t('password.updated'));
      setChangePwForm({ current: '', next: '', confirm: '' });
    } catch (e: any) {
      alert(e?.response?.data?.error || t('password.updateError'));
    } finally {
      setChangingPw(false);
    }
  };

  const userInitials = currentUser
    ? `${(currentUser.firstName ?? 'A')[0]}${(currentUser.lastName ?? 'D')[0]}`.toUpperCase()
    : 'AD';
  const userFullName = currentUser
    ? `${currentUser.firstName ?? ''} ${currentUser.lastName ?? ''}`.trim() || 'Admin'
    : 'Admin';
  const userEmail = currentUser?.email ?? 'admin@smartmenu.com';
  const userRole = currentUser?.role ?? 'Admin';

  const getBadge = (badgeKey: string | null) => {
    if (!badgeKey) return null;
    const n = badgeKey === 'orders' ? counts.orders : badgeKey === 'kitchen' ? counts.kitchen : badgeKey === 'bar' ? counts.bar : badgeKey === 'reservations' ? counts.reservations : 0;
    return n > 0 ? String(n) : null;
  };

  return (
    <>
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <UtensilsCrossed className="h-5 w-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-display text-lg font-bold text-sidebar-foreground">
                SmartMenu
              </span>
              <span className="text-xs text-sidebar-foreground/60">
                {t('header.subtitle')}
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs uppercase tracking-wider mb-2">
            {t('nav.groupLabel')}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavConfig.map((item) => {
                const isActive = pathname === item.url;
                const badge = getBadge(item.badgeKey);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild>
                      <Link
                        href={item.url}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sidebar-foreground/70 transition-all duration-200',
                          'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                          isActive && 'bg-sidebar-primary text-sidebar-primary-foreground font-medium'
                        )}
                      >
                        <item.icon className="h-5 w-5 flex-shrink-0" />
                        {!collapsed && (
                          <>
                            <span className="flex-1">{t(item.titleKey as Parameters<typeof t>[0])}</span>
                            {badge != null && (
                              <Badge
                                variant="secondary"
                                className={cn(
                                  'h-5 min-w-5 px-1.5 text-xs',
                                  isActive
                                    ? 'bg-sidebar-primary-foreground/20 text-sidebar-primary-foreground'
                                    : 'bg-primary/20 text-primary'
                                )}
                              >
                                {badge}
                              </Badge>
                            )}
                          </>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-accent flex-shrink-0">
            <span className="text-sm font-medium text-sidebar-accent-foreground">{userInitials}</span>
          </div>
          {!collapsed && (
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-sm font-medium text-sidebar-foreground truncate">{userFullName}</span>
              <span className="text-xs text-sidebar-foreground/50 truncate">{userEmail}</span>
            </div>
          )}
          {!collapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-sidebar-foreground/50 hover:text-sidebar-foreground"
              onClick={() => setShowSettings(true)}
              title={t('settings.title')}
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>

    {/* Modal Configuración / Perfil */}
    {showSettings && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowSettings(false)}>
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>

          {/* Header modal */}
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <h2 className="text-lg font-bold">{t('settings.accountTitle')}</h2>
            <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Info usuario */}
            <div className="flex items-center gap-4 p-4 bg-muted/40 rounded-xl">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold flex-shrink-0">
                {userInitials}
              </div>
              <div>
                <p className="font-semibold text-base">{userFullName}</p>
                <p className="text-sm text-muted-foreground">{userEmail}</p>
                <div className="flex items-center gap-1 mt-1">
                  <Shield className="h-3 w-3 text-primary" />
                  <span className="text-xs text-primary font-medium">{userRole}</span>
                </div>
              </div>
            </div>

            {/* Cambiar contraseña */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <KeyRound className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">{t('password.sectionTitle')}</h3>
              </div>
              <div className="space-y-2">
                <input
                  type="password"
                  placeholder={t('password.currentPlaceholder')}
                  value={changePwForm.current}
                  onChange={e => setChangePwForm(p => ({ ...p, current: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <input
                  type="password"
                  placeholder={t('password.newPlaceholder')}
                  value={changePwForm.next}
                  onChange={e => setChangePwForm(p => ({ ...p, next: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <input
                  type="password"
                  placeholder={t('password.confirmPlaceholder')}
                  value={changePwForm.confirm}
                  onChange={e => setChangePwForm(p => ({ ...p, confirm: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <Button
                  size="sm"
                  className="w-full"
                  onClick={handleChangePassword}
                  disabled={changingPw || !changePwForm.current || !changePwForm.next}
                >
                  {changingPw ? t('password.saving') : t('password.updateButton')}
                </Button>
              </div>
            </div>

            {/* Cerrar sesión */}
            <div className="border-t pt-4">
              <Button
                variant="outline"
                className="w-full text-destructive border-destructive/30 hover:bg-destructive/10 hover:border-destructive"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4 mr-2" />
                {t('logout')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
