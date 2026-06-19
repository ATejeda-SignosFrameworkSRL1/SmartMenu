'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as signalR from '@microsoft/signalr';
import { ensureFreshToken } from '@/lib/api';

export interface TableClaimNotification {
  id: string;
  requestId: number;
  waiterId: number;
  waiterName: string;
  tableId: number;
  tableNumber: number;
  orderId?: number;
  message: string;
  timestamp: Date;
  read: boolean;
}

function getHubUrl(): string {
  if (typeof window === 'undefined') return '/hubs/orders';
  // Ruta relativa al mismo origen → el proxy Next.js la enruta a localhost:5041
  // Evita que el browser tenga que aceptar el cert SSL del puerto 5042 por separado
  return `${window.location.origin}/hubs/orders`;
}

export function useAdminNotifications(token: string | null) {
  const [claimRequests, setClaimRequests] = useState<TableClaimNotification[]>([]);
  const [connected, setConnected] = useState(false);
  const connectionRef = useRef<signalR.HubConnection | null>(null);

  const unreadClaimCount = claimRequests.filter(r => !r.read).length;

  const markRead = useCallback((id: string) => {
    setClaimRequests(prev => prev.map(r => r.id === id ? { ...r, read: true } : r));
  }, []);

  const removeRequest = useCallback((id: string) => {
    setClaimRequests(prev => prev.filter(r => r.id !== id));
  }, []);

  const markAllRead = useCallback(() => {
    setClaimRequests(prev => prev.map(r => ({ ...r, read: true })));
  }, []);

  useEffect(() => {
    if (!token) return;

    const hubUrl = getHubUrl();
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        // Token fresco por llamada (resiliencia ante rotación de token con la pestaña abierta).
        accessTokenFactory: () => ensureFreshToken(),
        skipNegotiation: false,
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connectionRef.current = connection;

    connection.on('TableClaimRequested', (data: any) => {
      const notif: TableClaimNotification = {
        id: `claim-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        requestId: data.requestId,
        waiterId: data.waiterId,
        waiterName: data.waiterName,
        tableId: data.tableId,
        tableNumber: data.tableNumber,
        orderId: data.orderId,
        message: data.message ?? `${data.waiterName} quiere la Mesa ${data.tableNumber}`,
        timestamp: new Date(),
        read: false,
      };
      setClaimRequests(prev => [notif, ...prev].slice(0, 50));
      // Notificación del browser
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('SmartMenu — Admin', { body: notif.message, icon: '/favicon.ico' });
      }
    });

    connection.onreconnected(async () => {
      setConnected(true);
      await connection.invoke('JoinAdminGroup').catch(() => {});
    });

    connection.onclose(() => setConnected(false));

    const start = async () => {
      try {
        await connection.start();
        setConnected(true);
        await connection.invoke('JoinAdminGroup').catch(() => {});
        if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
          await Notification.requestPermission();
        }
      } catch {
        setConnected(false);
      }
    };

    start();

    return () => {
      connection.stop().catch(() => {});
      connectionRef.current = null;
      setConnected(false);
    };
  }, [token]);

  return { claimRequests, unreadClaimCount, connected, markRead, removeRequest, markAllRead };
}
