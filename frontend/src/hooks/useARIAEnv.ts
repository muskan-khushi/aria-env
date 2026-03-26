import { useState, useCallback } from 'react';
import type {
  ARIAObservation,
  ARIAAction,
  Task,
  GradeResult,
  LeaderboardEntry,
  EpisodeReplay,
  FrameworkSpec,
} from '../types/aria.types';

const BASE = '';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API error ${res.status}: ${err}`);
  }
  return res.json() as Promise<T>;
}

// ── Session management ───────────────────────────────────────────────────────

interface ResetParams {
  task_name?: string;
  seed?: number;
}

interface ResetResponse {
  session_id: string;
  observation: ARIAObservation;
}

export function useARIAReset() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(async (params: ResetParams = {}): Promise<ResetResponse | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<ResetResponse>('/reset', {
        method: 'POST',
        body: JSON.stringify(params),
      });
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { reset, loading, error };
}

// ── Step ─────────────────────────────────────────────────────────────────────

interface StepResponse {
  observation: ARIAObservation;
  reward: number;
  done: boolean;
  info: Record<string, unknown>;
}

export function useARIAStep() {
  const [loading, setLoading] = useState(false);

  const step = useCallback(async (
    action: ARIAAction,
    sessionId: string
  ): Promise<StepResponse | null> => {
    setLoading(true);
    try {
      return await apiFetch<StepResponse>('/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Session-ID': sessionId },
        body: JSON.stringify({ action, session_id: sessionId }),
      });
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { step, loading };
}

// ── Tasks ────────────────────────────────────────────────────────────────────

export function useARIATasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ tasks: Task[] }>('/tasks');
      setTasks(data.tasks ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  return { tasks, loading, error, fetchTasks };
}

// ── Generate ─────────────────────────────────────────────────────────────────

interface GenerateParams {
  difficulty: string;
  seed: number;
  frameworks: string;
}

export function useARIAGenerate() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (params: GenerateParams): Promise<Task | null> => {
    setLoading(true);
    setError(null);
    try {
      return await apiFetch<Task>('/generate', {
        method: 'POST',
        body: JSON.stringify(params),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { generate, loading, error };
}

// ── Grader ───────────────────────────────────────────────────────────────────

export function useARIAGrader() {
  const [loading, setLoading] = useState(false);

  const grade = useCallback(async (sessionId: string): Promise<GradeResult | null> => {
    setLoading(true);
    try {
      return await apiFetch<GradeResult>('/grader', {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId }),
      });
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { grade, loading };
}

// ── Leaderboard ──────────────────────────────────────────────────────────────

export function useARIALeaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ entries: LeaderboardEntry[] }>('/leaderboard');
      setEntries(data.entries ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  }, []);

  return { entries, loading, error, fetchLeaderboard };
}

// ── Replay ───────────────────────────────────────────────────────────────────

export function useARIAReplay() {
  const [replay, setReplay] = useState<EpisodeReplay | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReplay = useCallback(async (episodeId: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<EpisodeReplay>(`/replay/${episodeId}`);
      setReplay(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load replay');
    } finally {
      setLoading(false);
    }
  }, []);

  return { replay, loading, error, fetchReplay };
}

// ── Frameworks ───────────────────────────────────────────────────────────────

export function useARIAFrameworks() {
  const [frameworks, setFrameworks] = useState<FrameworkSpec[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchFrameworks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ frameworks: FrameworkSpec[] }>('/frameworks');
      setFrameworks(data.frameworks ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  return { frameworks, loading, fetchFrameworks };
}

// ── Baseline ─────────────────────────────────────────────────────────────────

export function useARIABaseline() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Record<string, unknown> | null>(null);

  const runBaseline = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<Record<string, unknown>>('/baseline', { method: 'POST' });
      setResults(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  return { runBaseline, loading, results };
}