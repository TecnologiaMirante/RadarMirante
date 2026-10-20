# Mirante Radar

Plataforma interna de monitoramento de engajamento do Instagram para as contas do Grupo Mirante. Desenvolvida pela equipe Mirante IA.

## Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Firebase Cloud Functions v2 (Node.js 20)
- **Banco de dados**: Firestore
- **Autenticação**: Firebase Auth (Google Sign-In, restrito a @mirante.com.br)
- **Armazenamento de segredos**: Google Secret Manager
- **Hosting**: Firebase Hosting
- **API de dados**: Instagram Graph API v26.0

## Contas monitoradas

| Conta              | Perfil    | Monitorando desde |
|--------------------|-----------|-------------------|
| @imirante          | editorial | 21/09/2026        |
| @imiranteesporte   | esporte   | 08/10/2026        |
| @tvmirante         | viral     | 29/09/2026        |
| @imirantepolitica  | editorial | 01/10/2026        |
| Mirante FM 96,1    | rádio     | 05/10/2026        |
| @ge.globomaranhao  | esporte   | 19/10/2026        |
| @g1maranhao        | editorial | 20/10/2026        |

> **Nota**: `ge.globomaranhao` e `g1maranhao` são contas afiliadas à Globo — possuem perfil de engajamento estruturalmente diferente das contas Mirante. Considerar ao interpretar scores e comparativos.

## Desenvolvimento

```bash
npm install
npm run dev
```

O app sobe em `http://localhost:5173`. Autenticação exige conta `@mirante.com.br`.

## Deploy

```bash
npm run build
firebase deploy
```

O comando acima faz deploy de:
- Frontend (Firebase Hosting)
- Cloud Functions (coleta e sync de insights)
- Firestore Rules
- Firestore Indexes

## Funções agendadas

| Função           | Horário           | O que faz                                      |
|------------------|-------------------|------------------------------------------------|
| `collectInstagram` | Toda hora (00 min) | Coleta posts novos e atualiza métricas         |
| `syncInsights`   | Diário às 03h     | Sincroniza insights de perfil do Instagram     |

## Secrets (Google Secret Manager)

Todas as credenciais de acesso às APIs do Instagram ficam no Secret Manager do GCP (projeto `radarimirante`). Nunca commitar tokens ou IDs de conta no código.

Padrão de nomes:
- `instagram-token-<radarId>` — Token de acesso da conta
- `instagram-account-id-<radarId>` — Instagram Business Account ID

Para adicionar uma nova conta, consulte as instruções internas de onboarding de contas.

## Segurança

- Acesso restrito a usuários autenticados com e-mail `@mirante.com.br`
- Regras do Firestore garantem que dados nunca sejam gravados pelo frontend
- Nenhuma credencial no código — tudo via Google Secret Manager
- Projeto totalmente independente de outros sistemas internos

## Estrutura do projeto

```
src/
  components/     # Componentes React (layout, radar, ui)
  contexts/       # AccountContext, AuthContext
  hooks/          # useAuth, useRadar, useTheme, etc.
  pages/          # Radar, Dashboard, Insights, Análises, Impacto, Settings
  services/       # Firebase, radar queries, Instagram insights
  types/          # Tipos TypeScript
  utils/          # Exportação CSV/XLSX, formatação

functions/src/
  index.ts        # Funções agendadas (coleta + sync de insights)
  connectors/     # InstagramConnector (Graph API)
  calculators/    # TrendScore, Baseline, PostScorer

scripts/          # Scripts utilitários (seed, migrações)
```
