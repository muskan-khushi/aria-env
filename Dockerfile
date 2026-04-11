# Stage 1: Build React frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install --silent

COPY frontend/ .
RUN npm run build

# Stage 2: Final Production Image
FROM python:3.11-slim
WORKDIR /app

# Install system utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set up HuggingFace non-root user (UID 1000)
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
COPY --chown=user baseline/ ./baseline/
COPY --chown=user ACTION_SPACE.md .

# Copy built frontend to the static directory used by FastAPI
COPY --from=frontend-builder --chown=user /app/frontend/dist ./static/

# Create writable directories
RUN mkdir -p /home/user/aria_data /home/user/.local/share

# The port must be 7860 for HF Spaces
EXPOSE 7860

# Metadata for the Space
LABEL openenv="compliant"
LABEL version="1.0.0"
LABEL description="ARIA — Agentic Regulatory Intelligence Architecture"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:7860/health || exit 1

CMD ["uvicorn", "server.app:app", "--host", "0.0.0.0", "--port", "7860", "--forwarded-allow-ips", "*"]