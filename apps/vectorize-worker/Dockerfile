FROM python:3.11-slim

WORKDIR /app

COPY apps/vectorize-worker/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY packages/shared-schemas/schemas /app/schemas
COPY apps/vectorize-worker/ .

CMD ["python", "main.py"]
