import { useState, useCallback } from "react";
import type { ARIAObservation } from "../types/aria.types";

const API_BASE = window.location.hostname === "localhost" ? "http://localhost:7860" : "";

export function useARIAEnv() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [initialObs, setInitialObs] = useState<ARIAObservation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Demo Trigger: Tells the server to start the internal agent loop
  const startDemo = useCallback(async (taskId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/aria/demo/start/${taskId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => response.statusText);
        throw new Error(`Demo Start Error ${response.status}: ${errText}`);
      }

      const data = await response.json();
      console.log("🚀 Internal Agent Loop Started:", data);
      setSessionId(data.session_id || "hackathon_demo_001");
      return data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Failed to start internal demo:", msg);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Standard OpenEnv reset (Used by judges/bots)
  const startEpisode = useCallback(
    async (taskName: string = "easy", seed: number = 42) => {
      setIsLoading(true);
      setError(null);
      setInitialObs(null);
      setSessionId(null);
      try {
        const response = await fetch(`${API_BASE}/reset`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task_name: taskName, seed: seed }),
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => response.statusText);
          throw new Error(`API Error ${response.status}: ${errText}`);
        }

        const data = await response.json();
        setSessionId(data.session_id);
        setInitialObs(data.observation || data);
        return data;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("Failed to start episode:", msg);
        setError(msg || "Failed to connect to backend");
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const clearError = useCallback(() => setError(null), []);

  return { sessionId, initialObs, isLoading, error, startEpisode, startDemo, clearError };
}