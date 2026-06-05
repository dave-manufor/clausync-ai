FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY apps/cleanup-worker/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY packages/shared-schemas/schemas /app/schemas
COPY apps/cleanup-worker/ .

# Run worker
CMD ["python", "main.py"]
