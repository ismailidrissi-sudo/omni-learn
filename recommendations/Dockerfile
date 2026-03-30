# LightFM: PyPI 1.17 breaks under modern pip (__builtins__ dict in PEP517). Use GitHub master.
# Pinned tarball — bump SHA when you need upstream fixes.
ARG LIGHTFM_REF=0c9c31e027b976beab2385e268b58010fff46096

FROM python:3.11-slim

WORKDIR /app

ARG LIGHTFM_REF
COPY requirements-docker.txt .

# Safer than -march=native when the image may run on a different host CPU than the builder.
ENV LIGHTFM_NO_CFLAGS=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    python3-dev \
    libgomp1 \
    && pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements-docker.txt \
    && pip install --no-cache-dir \
        "https://github.com/lyst/lightfm/archive/${LIGHTFM_REF}.tar.gz" \
    && python -c "from lightfm import LightFM; from lightfm.data import Dataset" \
    && apt-get purge -y gcc g++ python3-dev \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

COPY main.py .

RUN addgroup --system --gid 1001 appuser && \
    adduser --system --uid 1001 appuser && \
    mkdir -p /app/data && chown -R appuser:appuser /app

USER appuser

EXPOSE 5000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5000"]
