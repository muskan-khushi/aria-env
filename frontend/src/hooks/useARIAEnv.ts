import { useState, useCallback } from 'react';
import type { ARIAObservation } from '../types/aria.types';

const API_BASE = 'http://localhost:7860'; // Adjust if your FastAPI runs on a different port

export function useARIAEnv() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [initialObs, setInitialObs] = useState<ARIAObservation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The Ignition Switch: Starts a new episode
  const startEpisode = useCallback(async (taskName: string = 'easy', seed: number = 42) => {
    setIsLoading(true);
    setError(null);
    try {
      // Calls the required OpenEnv POST /reset endpoint
      const response = await fetch(`${API_BASE}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_name: taskName, seed: seed })
      });
      
      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      
      const data = await response.json();
      
      // The backend should return the new session ID and the initial observation
      setSessionId(data.session_id);
      setInitialObs(data.observation);
      
    } catch (err: any) {
      console.error("Failed to start episode:", err);
      setError(err.message || "Failed to connect to backend");
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { sessionId, initialObs, isLoading, error, startEpisode };
}