import { useState, useCallback } from "react";
import type { ARIAObservation } from "../types/aria.types";

// CHANGE: Use an empty string or conditional for production
// When deployed on HF, the frontend is served by the backend, so relative paths work best.
const API_BASE = window.location.hostname === "localhost" ? "http://localhost:7860" : "";

export function useARIAEnv() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [initialObs, setInitialObs] = useState<ARIAObservation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. The Demo Trigger: Tells the server to start the internal agent loop
  const startDemo = useCallback(async (taskId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      // Hits our new BackgroundTask endpoint in server/app.py
      const response = await fetch(`${API_BASE}/aria/demo/start/${taskId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      
      if (!response.ok) throw new Error(`Demo Start Error: ${response.status}`);
      
      const data = await response.json();
      console.log("🚀 Internal Agent Loop Started:", data);
      
      // We set the session ID so the WebSocket hook knows which channel to listen to
      setSessionId(data.session_id || "ui_demo_session");
      return data;
    } catch (err: any) {
      console.error("Failed to start internal demo:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 2. The Reset Switch: Standard OpenEnv reset (Used by judges/bots)
  const startEpisode = useCallback(
    async (taskName: string = "easy", seed: number = 42) => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE}/reset`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task_name: taskName, seed: seed }),
        });

        if (!response.ok) throw new Error(`API Error: ${response.status}`);

        const data = await response.json();
        setSessionId(data.session_id);
        setInitialObs(data.observation);
      } catch (err: any) {
        console.error("Failed to start episode:", err);
        setError(err.message || "Failed to connect to backend");
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  return { sessionId, initialObs, isLoading, error, startEpisode, startDemo };
}