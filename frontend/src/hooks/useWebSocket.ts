// src/hooks/useWebSocket.ts
import { useState, useEffect, useRef } from 'react';
import type { ARIAEvent, ARIAObservation } from '../types/aria.types';

export function useARIAWebSocket(sessionId: string) {
  const [events, setEvents] = useState<ARIAEvent[]>([]);
  const [lastObs, setLastObs] = useState<ARIAObservation | null>(null);
  const [connected, setConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    const connect = () => {
      // Connects to your FastAPI backend (adjust the port if your backend runs on something other than 7860 during dev)
      ws.current = new WebSocket(`ws://localhost:7860/ws/${sessionId}`);

      ws.current.onopen = () => setConnected(true);
      
      ws.current.onclose = () => {
        setConnected(false);
        // Auto-reconnect after 2 seconds
        setTimeout(connect, 2000);
      };

      ws.current.onmessage = (e) => {
        const event: ARIAEvent = JSON.parse(e.data);
        
        if (event.type === "step") {
          setLastObs(event.observation || null);
          setEvents(prev => [...prev.slice(-199), event]); // Keep last 200 events
        } else if (event.type === "incident_alert") {
          console.warn("EXPERT MODE: Incident Alert Triggered!", event);
        }
      };
    };

    connect();

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [sessionId]);

  return { events, lastObs, connected };
}