import { useState, useEffect, useRef, useCallback } from 'react';
import type { ARIAEvent, ARIAObservation } from '../types/aria.types';

interface UseARIAWebSocketReturn {
  events: ARIAEvent[];
  lastObs: ARIAObservation | null;
  connected: boolean;
  clearEvents: () => void;
}

export function useARIAWebSocket(sessionId: string | null): UseARIAWebSocketReturn {
  const [events, setEvents] = useState<ARIAEvent[]>([]);
  const [lastObs, setLastObs] = useState<ARIAObservation | null>(null);
  const [connected, setConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const clearEvents = useCallback(() => {
    setEvents([]);
    setLastObs(null);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    const connect = () => {
      if (!mountedRef.current) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/${sessionId}`;

      try {
        ws.current = new WebSocket(wsUrl);
      } catch {
        return;
      }

      ws.current.onopen = () => {
        if (mountedRef.current) setConnected(true);
      };

      ws.current.onclose = () => {
        if (mountedRef.current) {
          setConnected(false);
          reconnectTimer.current = setTimeout(connect, 2500);
        }
      };

      ws.current.onerror = () => {
        ws.current?.close();
      };

      ws.current.onmessage = (e) => {
        if (!mountedRef.current) return;
        try {
          const event: ARIAEvent = JSON.parse(e.data);
          if (event.type === 'step') {
            setLastObs(event.observation);
            setEvents(prev => [...prev.slice(-299), event]);
          } else if (event.type === 'episode_complete') {
            setEvents(prev => [...prev.slice(-299), event]);
          } else if (event.type === 'incident_alert') {
            setEvents(prev => [...prev.slice(-299), event]);
          }
        } catch {
          // ignore parse errors
        }
      };
    };

    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      ws.current?.close();
    };
  }, [sessionId]);

  return { events, lastObs, connected, clearEvents };
}