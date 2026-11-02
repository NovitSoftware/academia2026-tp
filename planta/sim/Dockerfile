# Se construye desde la raíz del repo: docker build -f planta/sim/Dockerfile .
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app

# ffmpeg convierte las notas que se graban desde el celular (webm, m4a, ogg) a WAV 16 kHz mono.
RUN apt-get update && apt-get install -y --no-install-recommends curl ffmpeg && rm -rf /var/lib/apt/lists/*

COPY planta/sim/requirements.txt /tmp/requirements.txt
RUN pip install -r /tmp/requirements.txt

# Voces para las notas de voz (Piper, corre en CPU): una de hombre y una de mujer.
ARG VOCES=https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/es
RUN mkdir -p /opt/voces \
 && curl -fsSL -o /opt/voces/es_MX-ald-medium.onnx "$VOCES/es_MX/ald/medium/es_MX-ald-medium.onnx" \
 && curl -fsSL -o /opt/voces/es_MX-ald-medium.onnx.json "$VOCES/es_MX/ald/medium/es_MX-ald-medium.onnx.json" \
 && curl -fsSL -o /opt/voces/es_AR-daniela-high.onnx "$VOCES/es_AR/daniela/high/es_AR-daniela-high.onnx" \
 && curl -fsSL -o /opt/voces/es_AR-daniela-high.onnx.json "$VOCES/es_AR/daniela/high/es_AR-daniela-high.onnx.json" \
 && python -c "import json,glob;[json.dump({**json.load(open(f)),'phoneme_type':json.load(open(f)).get('phoneme_type') if json.load(open(f)).get('phoneme_type') in ('espeak','text') else 'espeak'},open(f+'.tmp','w')) for f in glob.glob('/opt/voces/*.json')]" \
 && for f in /opt/voces/*.json.tmp; do mv "$f" "${f%.tmp}"; done
# La voz es_MX-ald viene con phoneme_type "PhonemeType.ESPEAK", que Piper 1.2 rechaza: se corrige a "espeak".

COPY contrato /tmp/contrato
RUN pip install /tmp/contrato

COPY planta/sim/planta_sim /app/planta_sim
COPY datos /app/datos
COPY escenarios /app/escenarios

EXPOSE 8100
CMD ["uvicorn", "planta_sim.app:app", "--host", "0.0.0.0", "--port", "8100"]
