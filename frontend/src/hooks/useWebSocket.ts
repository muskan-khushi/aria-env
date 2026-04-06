import { useState, useEffect, useRef } from 'react';
import type { ARIAEvent, ARIAObservation } from '../types/aria.types';

export function useARIAWebSocket(sessionId: string | null) {
  const [events, setEvents] = useState<ARIAEvent[]>([]);
  const [lastObs, setLastObs] = useState<ARIAObservation | null>(null);
  const [connected, setConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<number | null>(null);
  
  useEffect(() => {
    // Don't attempt connection if we don't have a session yet
    if (!sessionId) return;

    const connect = () => {
      const host = window.location.host;
      // Use wss:// for production (HTTPS) and ws:// for local development
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${host}/ws/${sessionId}`;

      console.log(`🔌 Attempting WebSocket connection: ${wsUrl}`);
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        console.log("✅ WebSocket Connected");
        setConnected(true);
      };
      
      ws.current.onclose = (e) => {
        setConnected(false);
        // Only reconnect if the session is still active and it wasn't a clean close
        if (sessionId && !e.wasClean) {
          console.log("🔄 WebSocket closed. Reconnecting in 2s...");
          reconnectTimeout.current = setTimeout(connect, 2000);
        }
      };

      ws.current.onerror = (err) => {
        console.error("❌ WebSocket Error:", err);
      };

      ws.current.onmessage = (e) => {
        try {
          const event: ARIAEvent = JSON.parse(e.data);
          
          if (event.type === "step") {
            setLastObs(event.observation || null);
            setEvents(prev => [...prev.slice(-199), event]); // Keep buffer at 200
          } else if (event.type === "incident_alert") {
            console.warn("⚠️ EXPERT MODE: Incident Alert!", event);
          }
        } catch (err) {
          console.error("Failed to parse WS message:", err);
        }
      };
    };

    connect();

    // Cleanup function: Close socket and clear timeouts when component unmounts or sessionId changes
    return () => {
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      if (ws.current) {
        console.log("⏏️ Closing WebSocket for session change/unmount");
        // Use a clean close code to prevent the auto-reconnector from firing
        ws.current.close(1000, "Component unmounted"); 
      }
    };
  }, [sessionId]);

  return { events, lastObs, connected };
}