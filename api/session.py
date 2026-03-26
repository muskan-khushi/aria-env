"""ARIA — Session Manager. Manages concurrent episode sessions."""
from __future__ import annotations
import threading
from aria.environment import ARIAEnv


class SessionManager:
    """Thread-safe store of active ARIAEnv sessions."""

    def __init__(self):
        self._sessions: dict[str, ARIAEnv] = {}
        self._lock = threading.Lock()

    def create(self, task_name: str = "easy", seed: int = 42) -> tuple[str, ARIAEnv]:
        env = ARIAEnv()
        obs = env.reset(task_name=task_name, seed=seed)
        sid = obs.session_id
        with self._lock:
            self._sessions[sid] = env
        return sid, env

    def get(self, session_id: str) -> ARIAEnv | None:
        with self._lock:
            return self._sessions.get(session_id)

    def remove(self, session_id: str) -> None:
        with self._lock:
            self._sessions.pop(session_id, None)

    def count(self) -> int:
        with self._lock:
            return len(self._sessions)


# Global singleton
session_manager = SessionManager()