"""ARIA — Session Manager. Manages concurrent episode sessions."""
from __future__ import annotations
import threading
from aria.environment import ARIAEnv

class SessionManager:
    """Thread-safe store of active ARIAEnv sessions."""

    def __init__(self):
        self._sessions: dict[str, ARIAEnv] = {}
        self._lock = threading.Lock()

    def create(self, task_name: str = "easy", seed: int = 42, forced_session_id: str = None) -> tuple[str, ARIAEnv]:
        """
        Creates a session. 
        If forced_session_id is provided (from headers), we use that.
        Otherwise, we fall back to the environment's generated ID.
        """
        env = ARIAEnv()
        obs = env.reset(task_name=task_name, seed=seed)
        
        # FIX: Define sid before using it. 
        # Use the ID from the script/header if available.
        sid = forced_session_id if forced_session_id else obs.session_id
        
        # Crucial: Sync the internal observation ID so the UI matches the script
        obs.session_id = sid

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