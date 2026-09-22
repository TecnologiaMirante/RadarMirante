#!/usr/bin/env bash
# Configura alertas de erro no Google Cloud Monitoring para o projeto radarimirante.
#
# Pré-requisitos:
#   gcloud auth login
#   gcloud config set project radarimirante
#
# Uso:
#   bash scripts/setupAlerts.sh
#   bash scripts/setupAlerts.sh --email victor.moura@mirante.com.br

set -euo pipefail

PROJECT="radarimirante"
ALERT_EMAIL="${2:-victor.moura@mirante.com.br}"

# Usa o segundo argumento se --email foi passado
if [[ "${1:-}" == "--email" ]]; then
  ALERT_EMAIL="${2:?Forneça o email: --email <email>}"
fi

echo "Projeto : $PROJECT"
echo "Email   : $ALERT_EMAIL"
echo ""

# ─── 1. Notification channel ──────────────────────────────────────────────────
echo "→ Criando canal de notificação por email..."

CHANNEL_JSON=$(gcloud beta monitoring channels create \
  --display-name="Mirante Radar Alerts" \
  --type=email \
  --channel-labels="email_address=${ALERT_EMAIL}" \
  --project="${PROJECT}" \
  --format=json 2>&1)

CHANNEL_NAME=$(echo "$CHANNEL_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['name'])" 2>/dev/null \
  || echo "$CHANNEL_JSON" | grep -oP '"name":\s*"\K[^"]+' | head -1)

echo "✓ Canal: $CHANNEL_NAME"
echo ""

# ─── 2. Alert policy: Cloud Function errors ───────────────────────────────────
echo "→ Criando política de alerta para erros em Cloud Functions..."

cat > /tmp/radar_alert_policy.json << EOF
{
  "displayName": "Mirante Radar — Cloud Function Errors",
  "combiner": "OR",
  "conditions": [
    {
      "displayName": "Cloud Function error count > 0 (5 min window)",
      "conditionThreshold": {
        "filter": "resource.type=\"cloud_function\" AND metric.type=\"cloudfunctions.googleapis.com/function/execution_count\" AND metric.labels.status=\"error\"",
        "aggregations": [
          {
            "alignmentPeriod": "300s",
            "perSeriesAligner": "ALIGN_SUM",
            "crossSeriesReducer": "REDUCE_SUM",
            "groupByFields": ["resource.labels.function_name"]
          }
        ],
        "comparison": "COMPARISON_GT",
        "thresholdValue": 0,
        "duration": "0s",
        "trigger": { "count": 1 }
      }
    }
  ],
  "notificationChannels": ["${CHANNEL_NAME}"],
  "alertStrategy": {
    "notificationRateLimit": { "period": "300s" }
  },
  "documentation": {
    "content": "Uma ou mais Cloud Functions do Mirante Radar retornaram erro. Verifique os logs em: https://console.cloud.google.com/logs/query?project=${PROJECT}",
    "mimeType": "text/markdown"
  }
}
EOF

gcloud alpha monitoring policies create \
  --policy-from-file=/tmp/radar_alert_policy.json \
  --project="${PROJECT}"

echo "✓ Política criada com sucesso."
echo ""

# ─── 3. Alert policy: Firestore rules denied (optional, high volume) ──────────
echo "→ Criando política de alerta para tentativas de acesso negado (Firestore)..."

cat > /tmp/radar_firestore_denied.json << EOF
{
  "displayName": "Mirante Radar — Firestore Access Denied (spike)",
  "combiner": "OR",
  "conditions": [
    {
      "displayName": "Firestore denied requests > 20 per 5 min",
      "conditionThreshold": {
        "filter": "resource.type=\"firestore.googleapis.com/Database\" AND metric.type=\"firestore.googleapis.com/document/read_count\" AND metric.labels.result=\"denied\"",
        "aggregations": [
          {
            "alignmentPeriod": "300s",
            "perSeriesAligner": "ALIGN_SUM",
            "crossSeriesReducer": "REDUCE_SUM"
          }
        ],
        "comparison": "COMPARISON_GT",
        "thresholdValue": 20,
        "duration": "0s",
        "trigger": { "count": 1 }
      }
    }
  ],
  "notificationChannels": ["${CHANNEL_NAME}"],
  "alertStrategy": {
    "notificationRateLimit": { "period": "1800s" }
  },
  "documentation": {
    "content": "Spike de acessos negados no Firestore do Mirante Radar. Pode indicar tentativa de acesso não autorizado ou bug nas regras.",
    "mimeType": "text/markdown"
  }
}
EOF

gcloud alpha monitoring policies create \
  --policy-from-file=/tmp/radar_firestore_denied.json \
  --project="${PROJECT}"

echo "✓ Política Firestore criada."
echo ""

echo "══════════════════════════════════════════════════════════"
echo " Alertas configurados para o projeto ${PROJECT}"
echo " Notificações → ${ALERT_EMAIL}"
echo ""
echo " Para listar todas as políticas:"
echo "   gcloud alpha monitoring policies list --project=${PROJECT}"
echo ""
echo " Para ver canais de notificação:"
echo "   gcloud beta monitoring channels list --project=${PROJECT}"
echo "══════════════════════════════════════════════════════════"
