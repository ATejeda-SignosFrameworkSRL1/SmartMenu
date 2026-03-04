'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
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
  return DRINK_KEYWORDS.some(k => name.includes(k));
}
function orderHasDrinkItem(order: any): boolean {
  const items = order?.items ?? order?.Items ?? [];
  return items.some((i: any) => isDrinkItem(i?.dishName ?? i?.DishName ?? ''));
}
function orderHasFoodItem(order: any): boolean {
  const items = order?.items ?? order?.Items ?? [];
  return items.some((i: any) => !isDrinkItem(i?.dishName ?? i?.DishName ?? ''));
}

const mainNavConfig = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard, badgeKey: null },
  { title: 'Órdenes', url: '/orders', icon: ShoppingBag, badgeKey: 'orders' },
  { title: 'Menú', url: '/menu', icon: Menu, badgeKey: null },
  { title: 'Mesas', url: '/tables', icon: MapPin, badgeKey: null },
  { title: 'Cocina (KDS)', url: '/kitchen', icon: ChefHat, badgeKey: 'kitchen' },
  { title: 'Bar', url: '/bar', icon: Wine, badgeKey: 'bar' },
  { title: 'Reservas', url: '/reservations', icon: CalendarCheck, badgeKey: 'reservations' },
  { title: 'Mantenimiento', url: '/maintenance', icon: Wrench, badgeKey: null },
  { title: 'Usuarios', url: '/users', icon: Users, badgeKey: null },
  { title: 'Reportes', url: '/reports', icon: BarChart3, badgeKey: null }
];

export function AppSidebar() {
  const pathname = usePathname();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const [counts, setCounts] = useState({ orders: 0, kitchen: 0, bar: 0, reservations: 0 });

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    if (!token) return;
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    const fetchCounts = async () => {
      try {
        const [ordersRes, reservationsRes] = await Promise.all([
          api.get('/api/order/active').catch(() => ({ data: [] })),
          api.get('/api/tablereservation', { params: { date: new Date().toISOString() } }).catch(() => ({ data: [] }))
        ]);
        const active = Array.isArray(ordersRes.data) ? ordersRes.data : [];
        const status = (o: any) => o?.status ?? o?.Status ?? '';
        const inProgress = active.filter((o: any) => !['Served', 'Completed', 'Cancelled'].includes(status(o)));
        const barCount = inProgress.filter((o: any) => orderHasDrinkItem(o)).length;
        const kitchenCount = inProgress.filter((o: any) => orderHasFoodItem(o)).length;
        const pendingReservations = Array.isArray(reservationsRes.data) ? reservationsRes.data.filter((r: any) => !(r.isConfirmed ?? r.IsConfirmed)).length : 0;
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

  const getBadge = (badgeKey: string | null) => {
    if (!badgeKey) return null;
    const n = badgeKey === 'orders' ? counts.orders : badgeKey === 'kitchen' ? counts.kitchen : badgeKey === 'bar' ? counts.bar : badgeKey === 'reservations' ? counts.reservations : 0;
    return n > 0 ? String(n) : null;
  };

  return (
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
                Sistema de Gestión
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs uppercase tracking-wider mb-2">
            Operaciones
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavConfig.map((item) => {
                const isActive = pathname === item.url;
                const badge = getBadge(item.badgeKey);
                return (
                  <SidebarMenuItem key={item.title}>
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
                            <span className="flex-1">{item.title}</span>
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
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-accent">
            <span className="text-sm font-medium text-sidebar-accent-foreground">AD</span>
          </div>
          {!collapsed && (
            <div className="flex flex-col flex-1">
              <span className="text-sm font-medium text-sidebar-foreground">Admin</span>
              <span className="text-xs text-sidebar-foreground/50">admin@smartmenu.com</span>
            </div>
          )}
          {!collapsed && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-sidebar-foreground/50 hover:text-sidebar-foreground">
              <Settings className="h-4 w-4" />
            </Button>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
