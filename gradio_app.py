import gradio as gr
import os
import subprocess
import json

# Make sure HF_TOKEN is injected via environment variables.

def run_evaluation(task_name):
    # Set the environment variable for task if your inference.py supports it
    env = os.environ.copy()
    env["TASK_NAME"] = task_name 
    
    # Execute the baseline inference script
    try:
        result = subprocess.run(["python", "inference.py"], env=env, capture_output=True, text=True, check=True)
        # return the stdout to be displayed
        stdout_output = result.stdout
        stderr_output = result.stderr
        
        return f"==== STDOUT ====\n{stdout_output}\n\n==== SUMMARY LOGS (STDERR) ====\n{stderr_output}"
        
    except subprocess.CalledProcessError as e:
        return f"Execution Failed!\n\nSTDOUT:\n{e.stdout}\n\nSTDERR:\n{e.stderr}"

# Gradio Interface
with gr.Blocks(title="ARIA Baseline Evaluation") as demo:
    gr.Markdown("# ⚖️ ARIA - Compliance Audit Agent")
    gr.Markdown("This optional Gradio UI serves as a wrapper to interactively run the single-episode evaluation pipeline (`inference.py`) on Hugging Face Spaces using the Qwen model. Note: Formal evaluations strictly execute the `inference.py` script directly across the baseline environment.")
    
    with gr.Row():
        with gr.Column():
            task_choice = gr.Dropdown(choices=["easy", "medium", "hard", "expert"], value="hard", label="Select Task Tier")
            run_btn = gr.Button("Evaluate Task", variant="primary")
        
        with gr.Column():
            output_display = gr.Textbox(label="Agent Walkthrough & Output", lines=25)
            
    run_btn.click(fn=run_evaluation, inputs=[task_choice], outputs=[output_display])

if __name__ == "__main__":
    demo.launch()
