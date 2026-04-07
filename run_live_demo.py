"""
ARIA — Live Demo Bridge
Connects the MultiPassAgent to the FastAPI server to trigger real-time WebSocket UI updates.
"""
import time
import requests
import os

from dotenv import load_dotenv
load_dotenv() # This automatically finds and loads your .env file!
from openai import OpenAI
from aria.models import ARIAObservation

# Import the agent you just built!
from baseline.agent import MultiPassAgent

API_BASE = "http://localhost:7860"
SESSION_ID = "hackathon_demo_001"

def run_live_demo(task_name="easy"):
    print(f"🚀 Initializing Live Demo for task: {task_name.upper()}")
    
    # 1. Initialize Agent (Provider Agnostic for Groq/OpenAI)
    api_key = os.environ.get("GROQ_API_KEY") or os.environ.get("HF_TOKEN") or os.environ.get("OPENAI_API_KEY")
    base_url = os.environ.get("API_BASE_URL")
    model_name = os.environ.get("MODEL_NAME", "llama-3.1-8b-instant")
    
    if not api_key:
        print("⚠️ No API Key found. Agent will run in fallback heuristic mode.")
        client = None
    else:
        # If base_url is None, it defaults safely to OpenAI. If set to Groq, it routes to Groq!
        client = OpenAI(api_key=api_key, base_url=base_url)
        print(f"🔗 Connected to LLM: {model_name}")
    
    agent = MultiPassAgent(client)

    # 2. Reset Environment via API
    headers = {"X-Session-ID": SESSION_ID, "Content-Type": "application/json"}
    print(f"🔄 Resetting environment for session: {SESSION_ID}...")

    # Pass session_id inside the JSON body too for extra safety
    reset_payload = {
        "task_name": task_name, 
        "seed": 42,
        "session_id": SESSION_ID  # Add this line
    }

    resp = requests.post(f"{API_BASE}/reset", json=reset_payload, headers=headers)
    
    if resp.status_code != 200:
        print(f"❌ API Error: {resp.text}")
        print("Ensure you have run: uvicorn api.app:app --host 0.0.0.0 --port 7860")
        return

    obs_data = resp.json()
    done = False
    
    print("\n✅ API Connected! Switch to your React Dashboard NOW: http://localhost:7860")
    print("Waiting 3 seconds for you to switch tabs...\n")
    time.sleep(3)

    # 3. Execution Loop
    step_count = 0
    while not done:
        step_count += 1
        obs = ARIAObservation(**obs_data)
        
        # Agent decides next action
        action = agent.act(obs)
        print(f"[{step_count}] Agent Action: {action.action_type.value}")
        
        # Post action to API (This triggers the WebSocket broadcast to React!)
        step_resp = requests.post(f"{API_BASE}/step", json={"action": action.model_dump()}, headers=headers)
        
        if step_resp.status_code != 200:
            print(f"❌ Step Error: {step_resp.text}")
            break
            
        step_data = step_resp.json()
        obs_data = step_data["observation"]
        done = step_data["done"]
        
        # Pause for 1.5 seconds so the judges can watch the charts animate smoothly
        time.sleep(1.5)

    print("\n🏁 Episode Complete! Check the Replay and Leaderboard tabs.")
    
if __name__ == "__main__":
    # Change "easy" to "expert" to trigger the Live Incident Breach UI!
    run_live_demo("easy")