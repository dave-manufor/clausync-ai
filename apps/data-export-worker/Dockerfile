FROM python:3.11-slim

WORKDIR /app

COPY apps/data-export-worker/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY packages/shared-schemas/schemas /app/schemas
COPY apps/data-export-worker/ .

CMD ["python", "main.py"]
