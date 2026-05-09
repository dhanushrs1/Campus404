# ============================================================================
# campus404 Judge — Docker Image
# ============================================================================
# This image runs in an isolated container with NO external network access.
# The main API communicates with it via the private Docker bridge network only.
# ============================================================================

FROM python:3.11-slim

# Security: run as non-root user
RUN groupadd -r judge && useradd -r -g judge judge

WORKDIR /app

# Install dependencies first (better Docker layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy service code
COPY . .

# Give judge user ownership
RUN chown -R judge:judge /app

# Switch to non-root
USER judge

# Expose internal port (NOT published to host — only accessible on Docker network)
EXPOSE 2358

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "2358"]
