# Stage 1: Build React frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --silent
COPY frontend/ .
RUN npm run build

# Stage 2: Python backend + built frontend
FROM python:3.11-slim
WORKDIR /app

# System dependencies
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Application code
COPY aria/ ./aria/
COPY api/ ./api/
COPY tasks/ ./tasks/
COPY baseline/ ./baseline/
COPY openenv.yaml .

# Built React app
COPY --from=frontend-builder /app/frontend/dist ./static/

# Create writable dirs for SQLite (HF Spaces: /tmp is always writable)
RUN mkdir -p /tmp/aria_data

EXPOSE 7860

HEALTHCHECK --interval=30s --timeout=10s \
  CMD curl -f http://localhost:7860/health || exit 1

CMD ["uvicorn", "api.app:app", "--host", "0.0.0.0", "--port", "7860", "--workers", "1", "--log-level", "info"]