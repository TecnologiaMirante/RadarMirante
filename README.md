# Radar Mirante

Plataforma interna de inteligência de audiência em tempo real para a redação do Mirante. Monitora posts de Instagram, YouTube e TikTok, detecta tendências via score estatístico e dispara análises editoriais com IA.

**Acesso restrito a contas `@mirante.com.br`.**

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + TypeScript + Vite + TailwindCSS |
| UI | shadcn/ui + Recharts + Lucide |
| Backend | Firebase Cloud Functions v2 (Node 22) |
| Banco de dados | Cloud Firestore |
| Autenticação | Firebase Auth (Google Sign-In) |
| Secrets | Google Secret Manager |
| IA | OpenAI GPT-4o |
| Hospedagem | Firebase Hosting |
| Região | `southamerica-east1` (São Paulo) |

---

## Estrutura do projeto

```
├── src/                    # Frontend React
│   ├── components/         # Componentes reutilizáveis
│   ├── contexts/           # AccountContext, AuthContext
│   ├── hooks/              # useAuth, etc.
│   ├── pages/              # Páginas (Login, Dashboard, Instagram…)
│   ├── services/           # Firestore queries (radar, instagram, auth)
│   ├── types/              # Tipos TypeScript compartilhados
│   └── config/radar.ts     # Configuração central (scores, thresholds)
│
├── functions/src/          # Cloud Functions
│   ├── scheduled/          # monitorPosts, syncInstagramInsights
│   ├── connectors/         # InstagramConnector
│   ├── radar/              # score, baseline, penalties, opportunity
│   ├── ai/                 # analyzeTrendingPost (OpenAI)
│   ├── tasks/              # queueAnalysis (Cloud Tasks)
│   └── index.ts            # Entry point — exports de todas as functions
│
├── firestore.rules         # Regras de segurança do Firestore
├── firestore.indexes.json  # Índices compostos
└── firebase.json           # Configuração de deploy
```

---

## Pré-requisitos

- Node.js 22+
- Firebase CLI: `npm install -g firebase-tools` (ou use `npx firebase`)
- Acesso ao projeto Firebase `radarimirante`
- Conta Google `@mirante.com.br`

---

## Configuração local

### 1. Variáveis de ambiente do frontend

```bash
cp .env.example .env
```

Preencha `.env` com os valores do Firebase Console → Configurações do projeto → Seus aplicativos.

### 2. Variáveis de ambiente das functions

```bash
cp functions/.env.example functions/.env
```

Preencha com os valores do Cloud Tasks (service account, fila, URL da function).

### 3. Instalar dependências

```bash
npm install
cd functions && npm install && cd ..
```

### 4. Rodar em desenvolvimento

```bash
npm run dev
```

O app abrirá em `http://localhost:5173`.

---

## Secrets no Google Secret Manager

Credenciais sensíveis **nunca ficam em código ou `.env`**. São gerenciadas via Secret Manager:

| Secret | Descrição |
|---|---|
| `OPENAI_API_KEY` | Chave da API OpenAI (GPT-4o) |
| `INSTAGRAM_ACCESS_TOKEN` | System User Token — Meta / Radar Mirante App |
| `INSTAGRAM_ACCOUNT_ID` | ID numérico da conta Business do Instagram |

Para adicionar ou atualizar uma versão:

```bash
echo "sk-..." | gcloud secrets versions add OPENAI_API_KEY --data-file=- --project radarimirante
```

---

## Deploy

### Tudo de uma vez

```bash
# PowerShell
npm run build; if ($?) { npx firebase deploy --project radarimirante }
```

### Por partes

```bash
# Só frontend
npm run build; npx firebase deploy --only hosting --project radarimirante

# Só Cloud Functions
npx firebase deploy --only functions --project radarimirante

# Só regras do Firestore
npx firebase deploy --only firestore:rules --project radarimirante
```

---

## Cloud Functions

| Function | Tipo | Trigger | Descrição |
|---|---|---|---|
| `onUserCreated` | v1 Auth | Criação de usuário | Bloqueia domínios não autorizados e cria doc em `/users` |
| `healthCheck` | v2 HTTP | GET | Status da API |
| `monitorPostsScheduled` | v2 Scheduler | A cada 15 min | Calcula score, detecta tendências, enfileira análise IA |
| `collectInstagram` | v2 Scheduler | A cada 30 min | Coleta posts e comentários do Instagram via Graph API |
| `syncInsights` | v2 Scheduler | A cada 6h | Sincroniza métricas de alcance, seguidores e audiência do Instagram |
| `analyzePost` | v2 HTTP | Cloud Tasks | Análise editorial com GPT-4o (enfileirada pelo monitor) |
| `processAnalysisRequest` | v2 Firestore | `/analysisRequests` | Análise manual acionada pelo frontend |

---

## Pipeline de monitoramento

```
collectInstagram (30min)
  └─► posts/{id} + comments/{id} no Firestore

monitorPostsScheduled (15min)
  └─► para cada post ativo (< 72h, status monitoring/candidate/trending):
        1. Snapshot de métricas
        2. Score estatístico (velocidade, aceleração, volume, autores únicos)
        3. Comparação com baseline histórico
        4. Penalidades (spam, duplicatas, concentração de autores)
        5. Atualiza trendScore e status no post
        6. Se score ≥ 40 e ≥ 5 comentários → enfileira analyzePost

analyzePost (Cloud Tasks)
  └─► OpenAI GPT-4o analisa post + comentários + histórico
        └─► Cria/atualiza Opportunity no Firestore
```

---

## Contas monitoradas

| ID interno | Conta | Status |
|---|---|---|
| `imirante` | Instagram @imirante | Ativo |
| `imiranteesporte` | Instagram @imiranteesporte | Em produção |

---

## Páginas com "Em produção"

Algumas features estão em modo placeholder enquanto aguardam aprovação de API ou configuração:

- **Instagram · Métricas do perfil** — aguarda Meta App Review (Advanced Access para `instagram_manage_insights`)
- **Radar Mirante Esporte** (toda a conta `imiranteesporte`) — aguarda configuração

Para reativar, ver comentários em `src/pages/Instagram.tsx` e `src/components/layout/AppLayout.tsx`.

---

## Hospedagem

| Ambiente | URL |
|---|---|
| Produção | https://radarimirante.web.app |
| Firebase Console | https://console.firebase.google.com/project/radarimirante |
