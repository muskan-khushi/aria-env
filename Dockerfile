# Stage 1: Build React frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend

# Copy dependency files
COPY frontend/package*.json ./

# Use install instead of ci for flexibility
RUN npm install --silent

# Copy the rest of the frontend code
COPY frontend/ .

# Execute the build
RUN npm run build

# Stage 2: Final Production Image
FROM python:3.11-slim
WORKDIR /app

# Install system utilities
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Set up Hugging Face non-root user (UID 1000)
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    PYTHONPATH=/app 

# Install Python requirements
COPY --chown=user requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Copy application files
COPY --chown=user aria/ ./aria/
COPY --chown=user server/ ./server/
COPY --chown=user tasks/ ./tasks/
COPY --chown=user inference.py .
COPY --chown=user openenv.yaml .

# Copy built frontend to the static directory used by FastAPI
COPY --from=frontend-builder --chown=user /app/frontend/dist ./static/

# Create a writable directory for local data/logs
RUN mkdir -p /home/user/aria_data

# The port must be 7860 for HF Spaces
EXPOSE 7860

# Metadata for the Space
LABEL openenv="compliant"

CMD ["python", "-m", "uvicorn", "api.app:app", "--host", "0.0.0.0", "--port", "7860"]