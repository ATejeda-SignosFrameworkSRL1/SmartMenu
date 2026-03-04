'use client';

import { ReactNode, useEffect } from 'react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Header } from './Header';

interface MainLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

/** Guarda token y usuario desde la URL al llegar desde el login (client-app en 3000 redirige a 3001?token=...&user=...) */
function useAuthFromUrl() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const user = params.get('user');
    if (token && user) {
      localStorage.setItem('admin_token', token);
      localStorage.setItem('admin_user', user);
      window.history.replaceState({}, '', window.location.pathname || '/');
    }
  }, []);
}

export function MainLayout({ children, title, subtitle }: MainLayoutProps) {
  useAuthFromUrl();
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1">
          <Header title={title} subtitle={subtitle} />
          <main className="flex-1 p-6 overflow-auto">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
