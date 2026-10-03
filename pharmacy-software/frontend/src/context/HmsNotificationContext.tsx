import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import { getAccessToken } from '../services/apiClient';

export interface HmsNotification {
  id: string;
  requestNumber: string;
  patientName: string;
  admissionRef: string;
  urgency: string;
  medicinesSummary: string;
  timestamp: string;
  read: boolean;
}

interface HmsNotificationContextType {
  notifications: HmsNotification[];
  unreadCount: number;
  activeBanner: HmsNotification | null;
  dismissBanner: () => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  onNavigateToQueue?: () => void;
  setOnNavigateToQueue: (cb: () => void) => void;
}

const HmsNotificationContext = createContext<HmsNotificationContextType | undefined>(undefined);

// Web Audio API crystal chime for incoming requisitions
function playNotificationChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // Smooth subtle two-tone chime
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    gain1.gain.setValueAtTime(0.18, now);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.28);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.11); // A5
    gain2.gain.setValueAtTime(0.22, now + 0.11);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.11);
    osc2.stop(now + 0.55);
  } catch {
    // Audio autoplay restrictions; fail gracefully
  }
}

export const HmsNotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<HmsNotification[]>(() => {
    try {
      const saved = localStorage.getItem('hms_pharmacy_notifications');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const onNavigateRef = useRef<(() => void) | undefined>(undefined);

  const setOnNavigateToQueue = useCallback((cb: () => void) => {
    onNavigateRef.current = cb;
  }, []);

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('hms_pharmacy_notifications', JSON.stringify(notifications.slice(0, 50)));
    } catch {
      // quota exceeded; ignore
    }
  }, [notifications]);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  // Connect SSE EventSource
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: any = null;

    const connect = () => {
      const token = getAccessToken();
      if (!token) {
        reconnectTimeout = setTimeout(connect, 3000);
        return;
      }

      const streamUrl = `http://localhost:4100/api/v1/hms-requests/stream/events?token=${encodeURIComponent(token)}`;
      eventSource = new EventSource(streamUrl);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'NEW_HMS_REQUEST') {
            const notifId = `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
            const newNotif: HmsNotification = {
              id: notifId,
              requestNumber: data.requestNumber || 'REQ-NEW',
              patientName: data.patientName || 'Admitted Patient',
              admissionRef: data.admissionRef || 'IPD',
              urgency: data.urgency || 'ROUTINE',
              medicinesSummary: data.medicinesSummary || 'Medicines prescribed',
              timestamp: data.timestamp || new Date().toISOString(),
              read: false,
            };

            setNotifications((prev) => [newNotif, ...prev]);

            // Play notification chime
            playNotificationChime();

            // Dispatch global event for live table reloading
            window.dispatchEvent(new CustomEvent('hms-request-received', { detail: data }));

            // ── Clean White Toaster Card (react-toastify) matching user reference ──
            toast(
              ({ closeToast }) => (
                <div
                  className="flex flex-col gap-0.5 w-full cursor-pointer select-none text-left"
                  onClick={() => {
                    markAsRead(notifId);
                    closeToast();
                    if (onNavigateRef.current) {
                      onNavigateRef.current();
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[12.5px] font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Ward Requisition
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">now</span>
                  </div>
                  <div className="text-[12px] font-semibold text-slate-800 leading-snug mt-0.5">
                    {data.patientName || 'Admitted Patient'}{' '}
                    <span className="text-slate-400 font-normal">({data.admissionRef || 'IPD'})</span>
                  </div>
                  <div className="text-[11.5px] text-slate-500 truncate mt-0.5">
                    {data.medicinesSummary || 'New medicine requisition'}
                  </div>
                </div>
              ),
              {
                className: 'hms-white-toast',
                autoClose: 7000,
                hideProgressBar: false,
                closeOnClick: false,
                pauseOnHover: true,
                draggable: true,
                icon: false,
              }
            );
          }
        } catch {
          // ignore heartbeat / ping
        }
      };

      eventSource.onerror = () => {
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        reconnectTimeout = setTimeout(connect, 5000);
      };
    };

    connect();

    return () => {
      if (eventSource) eventSource.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [markAsRead]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <HmsNotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        activeBanner: null,
        dismissBanner: () => toast.dismiss(),
        markAsRead,
        markAllAsRead,
        clearAll,
        onNavigateToQueue: onNavigateRef.current,
        setOnNavigateToQueue,
      }}
    >
      {children}
    </HmsNotificationContext.Provider>
  );
};

export const useHmsNotifications = () => {
  const ctx = useContext(HmsNotificationContext);
  if (!ctx) throw new Error('useHmsNotifications must be used within HmsNotificationProvider');
  return ctx;
};
