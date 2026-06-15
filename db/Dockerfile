# Runner de migrações (one-shot). Aplica as migrações SQL e encerra.
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY migrate.py .
COPY migrations ./migrations

CMD ["python", "migrate.py"]
