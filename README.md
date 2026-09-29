# Radar iMirante

Dashboard de monitoramento de engajamento em redes sociais para as contas do Grupo Mirante. Detecta posts em tendência em tempo real, analisa comentários com IA e gera oportunidades editoriais.

---

## Stack

| Camada | Tecnologia |
|--------|------------|
| Frontend | React 18 + TypeScript + Vite |
| UI | Tailwind CSS + shadcn/ui + Recharts |
| Backend | Firebase Cloud Functions v2 (Node.js 22) |
| Banco | Firestore |
| Auth | Firebase Auth (restrito a `@mirante.com.br`) |
| IA | OpenAI GPT-4o |
| Agendamento | Cloud Scheduler |
| Filas | Cloud Tasks |
| Secrets | Google Secret Manager |
| Hosting | Firebase Hosting |
| Região | `southamerica-east1` |

---

## Contas monitoradas

| Radar ID | Conta | Perfil |
|----------|-------|--------|
| `imirante` | @imirante | `editorial` |
| `tvmirante` | @tvmirante | `viral` |
| `imiranteesporte` | @imiranteesporte | `viral` *(a configurar)* |

Para adicionar uma conta: crie os secrets no Secret Manager, declare com `defineSecret()` em `functions/src/index.ts` e adicione uma entrada em `getActiveAccounts()`.

---

## Secrets no Google Secret Manager

Cada conta Instagram tem seu próprio par de secrets. Nenhum valor sensível vai para o código ou para variáveis de ambiente commitadas.

| Secret | Descrição |
|--------|-----------|
| `OPENAI_API_KEY` | Chave da API OpenAI |
| `INSTAGRAM_ACCESS_TOKEN` | System User Token — @imirante |
| `INSTAGRAM_ACCOUNT_ID` | ID numérico Business — @imirante |
| `TVMIRANTE_INSTAGRAM_ACCESS_TOKEN` | System User Token — @tvmirante |
| `TVMIRANTE_INSTAGRAM_ACCOUNT_ID` | ID numérico Business — @tvmirante |

Para criar ou atualizar um secret:

```bash
echo "valor" | gcloud secrets versions add NOME_DO_SECRET --data-file=- --project radarimirante
```

---

## Variáveis de ambiente (não-sensíveis)

Copie `functions/.env.example` para `functions/.env` e preencha:

```
TASKS_SA_EMAIL=radar-tasks@radarimirante.iam.gserviceaccount.com
TASKS_LOCATION=southamerica-east1
TASKS_QUEUE=radar-analysis
ANALYZE_POST_URL=https://analyzepost-HASH-rj.a.run.app
```

O arquivo `functions/.env` **nunca deve ser commitado**.

---

## Desenvolvimento local

```bash
# Instalar dependências
npm install
cd functions && npm install && cd ..

# Rodar frontend
npm run dev

# Compilar functions
cd functions && npm run build
```

> O projeto **não usa emuladores**. Desenvolvimento aponta diretamente para o projeto `radarimirante` no Firebase.

---

## Deploy

```bash
# 1. Build das functions
cd functions && npm run build && cd ..

# 2. Build do frontend
npm run build

# 3. Deploy completo
npx firebase deploy --only functions,hosting,firestore:rules --project radarimirante
```

---

## Agendamentos (Cloud Scheduler)

| Função | Schedule | Descrição |
|--------|----------|-----------|
| `monitorPostsScheduled` | `0 6-20 * * *` | Monitora posts ativos a cada hora (6h–20h, horário de Brasília) |
| `collectInstagram` | `0 6-20 * * *` | Coleta novos posts do Instagram a cada hora |
| `syncInsights` | a cada 6 horas | Sincroniza métricas de alcance, seguidores e impressões |

Para forçar uma execução manual:

```bash
gcloud scheduler jobs run firebase-schedule-syncInsights-southamerica-east1 \
  --location=southamerica-east1 --project=radarimirante
```

---

## Estrutura

```
├── src/                        # Frontend React
│   ├── components/
│   │   ├── layout/             # Header, Sidebar
│   │   ├── radar/              # ActivityChart, WordCloud, etc.
│   │   └── ui/                 # shadcn/ui components
│   ├── pages/                  # Dashboard, Radar, Instagram, Analyses, PostDetails
│   ├── services/               # Acesso ao Firestore (radar.ts, instagram.ts)
│   ├── contexts/               # AccountContext
│   └── types/                  # radar.ts
├── functions/src/              # Cloud Functions
│   ├── ai/                     # analyzeTrendingPost, prompts
│   ├── connectors/             # InstagramConnector
│   ├── ingest/                 # normalizePost
│   ├── radar/                  # score, baseline, opportunity, snapshots
│   ├── scheduled/              # monitorPosts, syncInstagramInsights
│   ├── config/                 # radar.ts (configurações centralizadas)
│   └── index.ts                # Exports e agendamentos
├── scripts/                    # seedAccounts.cjs
├── firestore.rules
└── firebase.json
```

---

## Segurança

- Acesso restrito a contas `@mirante.com.br` — verificado no Cloud Function `onUserCreated`
- Secrets exclusivamente no Google Secret Manager (nunca em código ou `.env` commitado)
- Projeto independente — sem integração com outros sistemas do Grupo Mirante
- Regras do Firestore em `firestore.rules`
