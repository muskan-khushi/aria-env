# Stage 1: Build React frontend
FROM node:18 AS frontend-builder

WORKDIR /app/frontend

# Copy only dependency files first (better caching)
COPY frontend/package*.json ./

# Use deterministic install
RUN npm ci

# Copy rest of frontend
COPY frontend/ ./

# Build frontend
RUN npm run build


# Stage 2: Final Production Image
FROM python:3.11-slim

WORKDIR /app

# Install system utilities
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Create non-root user (HF requirement)
RUN useradd -m -u 1000 user

# Set environment
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    PYTHONPATH=/app

# Switch to user
USER user

# Install Python dependencies
COPY --chown=user requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Copy backend code
COPY --chown=user aria/ ./aria/
COPY --chown=user server/ ./server/
COPY --chown=user tasks/ ./tasks/
COPY --chown=user inference.py .
COPY --chown=user openenv.yaml .
COPY --chown=user baseline/ ./baseline/

# Copy built frontend
COPY --from=frontend-builder --chown=user /app/frontend/dist ./static/

# Create writable directory
RUN mkdir -p /home/user/aria_data

# Expose HF port
EXPOSE 7860

# Metadata
LABEL openenv="compliant"

# Run app
CMD ["uvicorn", "server.app:app", "--host", "0.0.0.0", "--port", "7860", "--forwarded-allow-ips", "*"]