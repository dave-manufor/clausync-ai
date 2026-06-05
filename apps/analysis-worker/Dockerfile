FROM python:3.11-slim

WORKDIR /app

COPY apps/analysis-worker/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY packages/shared-schemas/schemas /app/schemas
COPY apps/analysis-worker/ .

CMD ["python", "main.py"]
