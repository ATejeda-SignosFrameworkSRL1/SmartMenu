'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as signalR from '@microsoft/signalr';

export type NotificationType = 'kitchen_ready' | 'bar_ready' | 'customer_finished' | 'items_added' | 'billing_requested' | 'claim_approved' | 'claim_rejected';

export interface WaiterNotification {
  id: string;
  type: NotificationType;
  orderId: number;
  orderNumber: string;
  tableNumber: string;
  message: string;
  timestamp: Date;
  read: boolean;
  /** Para notificaciones de claim: ID de la solicitud */
  claimRequestId?: number;
  /** Para notificaciones de claim: nota del admin */
  adminNote?: string;
  /** Para notificaciones de claim: ID de DB de la mesa (distinto de tableNumber) */
  tableId?: number;
}

interface UseWaiterNotificationsOptions {
  waiterId: number | null;
  token: string | null;
}

/**
 * URL del hub de SignalR.
 * Usa el proxy de Next.js (/hubs/orders → http://localhost:5041/hubs/orders)
 * para evitar problemas de certificado SSL en el navegador.
 * El transporte es LongPolling (HTTP puro) para máxima compatibilidad con proxies.
 */
function getHubUrl(): string {
  if (typeof window === 'undefined') return '/hubs/orders';
  // Ruta relativa → el proxy de Next.js lo enruta a localhost:5041
  // Esto evita que el browser tenga que aceptar el cert de :5042 por separado
  return `${window.location.origin}/hubs/orders`;
}

export function useWaiterNotifications({ waiterId, token }: UseWaiterNotificationsOptions) {
  const [notifications, setNotifications] = useState<WaiterNotification[]>([]);
  const [connected, setConnected] = useState(false);
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const waiterId_ref = useRef<number | null>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const dismiss = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const addNotification = useCallback((notification: Omit<WaiterNotification, 'id' | 'read'>) => {
    const newNotif: WaiterNotification = {
      ...notification,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      read: false,
    };
    setNotifications(prev => [newNotif, ...prev].slice(0, 50));

    // Intentar vibrar el dispositivo (mobile)
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }
    // Notificación del browser si hay permiso
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification('SmartMenu — Mesero', {
        body: notification.message,
        icon: '/favicon.ico',
      });
    }
  }, []);

  useEffect(() => {
    if (!waiterId || !token) return;
    waiterId_ref.current = waiterId;

    const hubUrl = getHubUrl();
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => token,
        // Intenta WebSocket primero; si el proxy no soporta upgrade, cae a LongPolling.
        // Ambos van a través del proxy Next.js (mismo origen → sin problema de cert SSL).
        skipNegotiation: false,
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connectionRef.current = connection;

    connection.on('OrderReadyForService', (data: any) => {
      const type: NotificationType = data?.type === 'bar' ? 'bar_ready' : 'kitchen_ready';
      addNotification({
        type,
        orderId: data.orderId,
        orderNumber: data.orderNumber,
        tableNumber: data.tableNumber,
        message: data.message ?? `Orden #${data.orderNumber} lista para servir`,
        timestamp: new Date(),
      });
    });

    connection.on('CustomerFinished', (data: any) => {
      addNotification({
        type: 'customer_finished',
        orderId: data.orderId,
        orderNumber: data.orderNumber,
        tableNumber: data.tableNumber,
        message: data.message ?? `Mesa ${data.tableNumber} terminó de comer`,
        timestamp: new Date(),
      });
    });

    connection.on('ItemsAddedToOrder', (data: any) => {
      addNotification({
        type: 'items_added',
        orderId: data.orderId,
        orderNumber: data.orderNumber,
        tableNumber: data.tableNumber,
        message: data.message ?? `Mesa ${data.tableNumber} agregó más ítems`,
        timestamp: new Date(),
      });
    });

    connection.on('BillingRequested', (data: any) => {
      addNotification({
        type: 'billing_requested',
        orderId: data.orderId,
        orderNumber: data.orderNumber,
        tableNumber: String(data.tableNumber ?? ''),
        message: data.message ?? `Mesa ${data.tableNumber} solicita la cuenta`,
        timestamp: new Date(),
      });
    });

    connection.on('TableClaimApproved', (data: any) => {
      addNotification({
        type: 'claim_approved',
        orderId: data.orderId ?? 0,
        orderNumber: '',
        tableNumber: String(data.tableNumber ?? ''),
        tableId: data.tableId,
        message: data.message ?? `¡Solicitud aprobada! La Mesa ${data.tableNumber} es tuya.`,
        timestamp: new Date(),
        claimRequestId: data.requestId,
        adminNote: data.adminNote,
      });
    });

    connection.on('TableClaimRejected', (data: any) => {
      addNotification({
        type: 'claim_rejected',
        orderId: data.orderId ?? 0,
        orderNumber: '',
        tableNumber: String(data.tableNumber ?? ''),
        tableId: data.tableId,
        message: data.message ?? `El admin rechazó tu solicitud para la Mesa ${data.tableNumber}.`,
        timestamp: new Date(),
        claimRequestId: data.requestId,
        adminNote: data.adminNote,
      });
    });

    connection.onreconnected(async () => {
      setConnected(true);
      if (waiterId_ref.current) {
        await connection.invoke('JoinWaiterGroup', waiterId_ref.current).catch(() => {});
      }
    });

    connection.onclose(() => setConnected(false));

    let cancelled = false;

    const joinGroup = async () => {
      if (waiterId_ref.current) {
        await connection.invoke('JoinWaiterGroup', waiterId_ref.current).catch(() => {});
      }
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        await Notification.requestPermission().catch(() => {});
      }
    };

    // Reintentar la conexión inicial hasta 6 veces con backoff exponencial
    const start = async () => {
      const delays = [0, 2000, 4000, 8000, 15000, 30000];
      for (let attempt = 0; attempt < delays.length; attempt++) {
        if (cancelled) return;
        if (delays[attempt] > 0) {
          await new Promise(res => setTimeout(res, delays[attempt]));
        }
        if (cancelled) return;
        try {
          await connection.start();
          setConnected(true);
          await joinGroup();
          return; // éxito
        } catch (err) {
          console.warn(`[SignalR] Intento ${attempt + 1} fallido:`, err);
          setConnected(false);
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      connection.stop().catch(() => {});
      connectionRef.current = null;
      setConnected(false);
    };
  }, [waiterId, token, addNotification]);

  return { notifications, unreadCount, connected, markAllRead, dismiss, clearAll };
}
