/**
 * Seed script — popula Firestore com oportunidades mock para testar o dashboard.
 *
 * Pré-requisito: Application Default Credentials configurado.
 *   gcloud auth application-default login
 *
 * Uso:
 *   npm run seed
 */

import { createRequire } from 'module'
import { resolve } from 'path'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

const require = createRequire(import.meta.url)
const keyPath = resolve(process.cwd(), 'scripts/serviceAccountKey.json')

let serviceAccount: object
try {
  serviceAccount = require(keyPath)
} catch {
  console.error('\n[seed] Arquivo não encontrado: scripts/serviceAccountKey.json')
  console.error('[seed] Baixe a chave em: Firebase Console → Project Settings → Service Accounts → Generate new private key')
  console.error('[seed] Salve o JSON como: scripts/serviceAccountKey.json\n')
  process.exit(1)
}

if (getApps().length === 0) {
  initializeApp({ credential: cert(serviceAccount as Parameters<typeof cert>[0]) })
}

const db = getFirestore()

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ago(minutes: number): Timestamp {
  return Timestamp.fromMillis(Date.now() - minutes * 60 * 1000)
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const opportunities = [
  {
    postId: 'post_mock_001',
    platform: 'imirante',
    postUrl: 'https://imirante.com/noticias/acidente-br-135',
    postTitle: 'Acidente grave fecha BR-135 por quase 3 horas',
    mainTopic: 'ACIDENTE BR-135',
    summary: 'Colisão entre dois caminhões e um ônibus interdita rodovia na altura de São Luís. Três feridos graves, bombeiros e SAMU no local. Leitores relatam congestionamento de mais de 8 km.',
    whyTrending: 'Impacto direto no deslocamento de milhares de pessoas. Comentários expressam raiva por falta de sinalização no trecho.',
    clusters: [
      { topic: 'Condições da via', summary: 'Leitores reclamam da má sinalização e buracos no trecho', estimatedCommentCount: 180, percentage: 42 },
      { topic: 'Tempo de resposta', summary: 'Questionamentos sobre demora do SAMU e bombeiros', estimatedCommentCount: 98, percentage: 23 },
      { topic: 'Relatos de testemunhas', summary: 'Quem estava no local descreve o acidente', estimatedCommentCount: 64, percentage: 15 },
    ],
    audienceQuestions: ['Qual o estado dos feridos?', 'Vai abrir desvio?', 'Quem é responsável pela manutenção da via?'],
    complaints: ['Rodovia em péssimo estado há meses', 'Nenhuma iluminação no trecho à noite'],
    reports: ['Acidente ocorreu às 6h45, mais de 30 carros parados em fila'],
    claimsToVerify: [
      { claim: 'Acidente causado por buraco na pista', approximateMentions: 47, context: 'Motorista teria desviado de buraco e perdido controle' },
    ],
    editorialSignals: ['Alto número de testemunhas identificadas', 'Tema recorrente: má conservação de rodovias federais no MA'],
    storyIdeas: [
      { headline: 'BR-135 acumula X acidentes em 2026: o perigo ignorado', angle: 'Série de acidentes no mesmo trecho', whyNow: 'Novo acidente grave com feridos', suggestedSources: ['PRF', 'DNIT', 'moradores locais'], questionsToAnswer: ['Quantos acidentes neste trecho em 2026?', 'Há orçamento previsto para recuperação?'], priority: 'high' },
    ],
    trendScore: 87,
    trendConfidence: 0.91,
    editorialPotential: 82,
    analysisConfidence: 0.88,
    commentsAtAnalysis: 427,
    metricsAtAnalysis: { comments: 427, likes: 1203, shares: 318, views: 28400 },
    baselineComparison: 340,
    status: 'new',
    createdAt: ago(28),
    updatedAt: ago(5),
    lastAnalysisAt: ago(5),
  },
  {
    postId: 'post_mock_002',
    platform: 'instagram',
    postUrl: 'https://www.instagram.com/p/mock002',
    postTitle: null,
    mainTopic: 'FALTA DE ÁGUA SÃO LUÍS',
    summary: 'Post sobre interrupção no fornecimento de água em bairros da zona norte de São Luís. Caema sem previsão de retorno.',
    whyTrending: 'Afeta diretamente o cotidiano de moradores. Comentários relatam 3 dias sem abastecimento.',
    clusters: [
      { topic: 'Sem abastecimento há dias', summary: 'Moradores de múltiplos bairros sem água', estimatedCommentCount: 312, percentage: 55 },
      { topic: 'Resposta da Caema', summary: 'Críticas ao silêncio da concessionária', estimatedCommentCount: 143, percentage: 25 },
      { topic: 'Alternativas', summary: 'Comunidade organizando compra de água em caminhão-pipa', estimatedCommentCount: 57, percentage: 10 },
    ],
    audienceQuestions: ['Quando volta a água?', 'Caema vai ressarcir?', 'Quais bairros estão afetados?'],
    complaints: ['3 dias sem água no Cohatrac', 'Caema não atende o telefone'],
    reports: ['Caixa d\'água de escola municipal secou'],
    claimsToVerify: [
      { claim: 'Rompimento de adutora principal causou o problema', approximateMentions: 89, context: 'Moradores citam obra que teria danificado tubulação' },
    ],
    editorialSignals: ['Múltiplos bairros afetados', 'Prazo indeterminado para normalização'],
    storyIdeas: [
      { headline: 'Crise hídrica em São Luís: X bairros sem água e Caema sem resposta', angle: 'Falta de transparência e comunicação da concessionária', whyNow: 'Interrupção ultrapassa 72h', suggestedSources: ['Caema', 'Procon', 'vereadores da zona norte'], questionsToAnswer: ['Qual a causa oficial?', 'Há prazo para normalização?'], priority: 'high' },
    ],
    trendScore: 79,
    trendConfidence: 0.85,
    editorialPotential: 76,
    analysisConfidence: 0.82,
    commentsAtAnalysis: 568,
    metricsAtAnalysis: { comments: 568, likes: 892, shares: 445, views: 31200 },
    baselineComparison: 280,
    status: 'new',
    createdAt: ago(95),
    updatedAt: ago(15),
    lastAnalysisAt: ago(15),
  },
  {
    postId: 'post_mock_003',
    platform: 'imirante',
    postUrl: 'https://imirante.com/noticias/concurso-publico-ma',
    postTitle: 'Governo anuncia concurso público com 3.400 vagas para o Maranhão',
    mainTopic: 'CONCURSO PÚBLICO MA 2026',
    summary: 'Estado anuncia maior concurso público dos últimos 10 anos. Vagas para saúde, educação e segurança pública. Inscrições previstas para outubro.',
    whyTrending: 'Altíssimo interesse da população em emprego público. Enorme volume de perguntas sobre requisitos e datas.',
    clusters: [
      { topic: 'Datas e inscrição', summary: 'Quando abre? Quanto custa a taxa?', estimatedCommentCount: 534, percentage: 48 },
      { topic: 'Cargos disponíveis', summary: 'Quais cargos, salários e requisitos', estimatedCommentCount: 312, percentage: 28 },
      { topic: 'Banca organizadora', summary: 'Discussão sobre qual banca vai organizar', estimatedCommentCount: 134, percentage: 12 },
    ],
    audienceQuestions: ['Quando abre as inscrições?', 'Tem vaga para professor?', 'Precisa de nível superior?'],
    complaints: [],
    reports: ['Governador confirmou via decreto publicado no Diário Oficial'],
    claimsToVerify: [
      { claim: 'Parte das vagas seria para cargos já extintos', approximateMentions: 23, context: 'Usuário cita decreto anterior que teria extinguido alguns cargos' },
    ],
    editorialSignals: ['Tema de utilidade pública com alto engajamento', 'Oportunidade de guia prático'],
    storyIdeas: [
      { headline: 'Guia completo: tudo sobre o concurso público MA 2026', angle: 'Conteúdo de serviço com dados consolidados', whyNow: 'Anúncio oficial acaba de sair', suggestedSources: ['Secretaria de Planejamento', 'decreto oficial', 'especialistas em concursos'], questionsToAnswer: ['Quais cargos? Quais salários? Quando?'], priority: 'medium' },
    ],
    trendScore: 73,
    trendConfidence: 0.89,
    editorialPotential: 68,
    analysisConfidence: 0.91,
    commentsAtAnalysis: 1124,
    metricsAtAnalysis: { comments: 1124, likes: 2341, shares: 876, views: 89300 },
    baselineComparison: 520,
    status: 'reviewing',
    createdAt: ago(180),
    updatedAt: ago(45),
    lastAnalysisAt: ago(45),
  },
  {
    postId: 'post_mock_004',
    platform: 'facebook',
    postUrl: 'https://facebook.com/imirante/posts/mock004',
    postTitle: null,
    mainTopic: 'VIOLÊNCIA BAIRRO CIDADE OPERÁRIA',
    summary: 'Moradores relatam série de assaltos a mão armada em rua movimentada do bairro Cidade Operária. Vídeos de câmera de segurança circulam nas redes.',
    whyTrending: 'Medo e indignação. Comentários incluem relatos de moradores do bairro que sofreram ocorrências similares.',
    clusters: [
      { topic: 'Relatos de assaltos', summary: 'Moradores compartilham casos próprios', estimatedCommentCount: 198, percentage: 50 },
      { topic: 'Ausência de policiamento', summary: 'Questionamentos sobre ronda policial', estimatedCommentCount: 112, percentage: 28 },
      { topic: 'Câmeras de segurança', summary: 'Debate sobre quem pode instalar câmeras', estimatedCommentCount: 45, percentage: 11 },
    ],
    audienceQuestions: ['A polícia foi acionada?', 'Onde ficam as delegacias mais próximas?', 'Vai ter mais policiamento?'],
    complaints: ['Há semanas sem ronda policial na área', 'Iluminação pública quebrada há 3 meses'],
    reports: ['Assaltante identificado por morador como já tendo sido preso antes'],
    claimsToVerify: [
      { claim: 'PM teria sido acionada mas não compareceu', approximateMentions: 31, context: 'Moradores dizem ter ligado para 190 sem resultado' },
    ],
    editorialSignals: ['Evidências em vídeo disponíveis', 'Padrão que pode ser investigado com dados da SSP'],
    storyIdeas: [
      { headline: 'Onda de assaltos em Cidade Operária: moradores vivem em clima de terror', angle: 'Investigação com dados de ocorrências e oitiva de moradores', whyNow: 'Série de casos registrados na mesma semana', suggestedSources: ['SSP-MA', 'moradores', 'vereador local'], questionsToAnswer: ['Quantos BO registrados? Suspeitos presos?'], priority: 'high' },
    ],
    trendScore: 68,
    trendConfidence: 0.78,
    editorialPotential: 71,
    analysisConfidence: 0.75,
    commentsAtAnalysis: 397,
    metricsAtAnalysis: { comments: 397, likes: 534, shares: 289, views: 19800 },
    baselineComparison: 210,
    status: 'new',
    createdAt: ago(340),
    updatedAt: ago(120),
    lastAnalysisAt: ago(120),
  },
  {
    postId: 'post_mock_005',
    platform: 'imirante',
    postUrl: 'https://imirante.com/esportes/sampaio-correa-serie-b',
    postTitle: 'Sampaio Corrêa vence clássico e sobe para o G4 da Série B',
    mainTopic: 'SAMPAIO CORRÊA SÉRIE B',
    summary: 'Tricolor vence rival por 2x1 e entra no grupo de acesso. Torcida em êxtase nos comentários. Partida foi marcada por dois gols nos acréscimos.',
    whyTrending: 'Resultado inesperado com virada dramática nos acréscimos. Engajamento típico de futebol potencializado pela rivalidade.',
    clusters: [
      { topic: 'Reação da torcida', summary: 'Euforia com a virada e classificação', estimatedCommentCount: 445, percentage: 60 },
      { topic: 'Análise técnica', summary: 'Desempenho dos jogadores e tática do técnico', estimatedCommentCount: 167, percentage: 22 },
      { topic: 'Próximos jogos', summary: 'Calendário e chances de acesso', estimatedCommentCount: 89, percentage: 12 },
    ],
    audienceQuestions: ['Quando é o próximo jogo?', 'Quem marcou os gols?', 'Onde assistir?'],
    complaints: [],
    reports: ['Técnico confirmou lesão de atacante titular'],
    claimsToVerify: [],
    editorialSignals: ['Maior engajamento esportivo do mês', 'Oportunidade de análise de caminho para acesso'],
    storyIdeas: [
      { headline: 'Sampaio no G4: o que precisa para garantir o acesso?', angle: 'Análise matemática das chances e calendário', whyNow: 'Resultado coloca o time na zona de acesso', suggestedSources: ['técnico', 'jogadores', 'analistas'], questionsToAnswer: ['Quantos pontos faltam? Quais rivais restam?'], priority: 'medium' },
    ],
    trendScore: 65,
    trendConfidence: 0.93,
    editorialPotential: 58,
    analysisConfidence: 0.90,
    commentsAtAnalysis: 742,
    metricsAtAnalysis: { comments: 742, likes: 3102, shares: 523, views: 45600 },
    baselineComparison: 180,
    status: 'new',
    createdAt: ago(420),
    updatedAt: ago(180),
    lastAnalysisAt: ago(180),
  },
  {
    postId: 'post_mock_006',
    platform: 'instagram',
    postUrl: 'https://www.instagram.com/p/mock006',
    postTitle: null,
    mainTopic: 'DENGUE SURTO SÃO LUÍS',
    summary: 'Secretaria de Saúde confirma aumento de 180% nos casos de dengue em relação ao mesmo período do ano anterior. UPAs com filas de até 6 horas.',
    whyTrending: 'Medo de epidemia. Comentários com relatos de familiares internados e falta de medicamento nas UPAs.',
    clusters: [
      { topic: 'Casos na família', summary: 'Moradores relatam parentes doentes', estimatedCommentCount: 223, percentage: 38 },
      { topic: 'Falta de remédio', summary: 'Reclamações sobre ausência de dipirona e hidratação nas UPAs', estimatedCommentCount: 167, percentage: 28 },
      { topic: 'Foco do mosquito', summary: 'Denúncias de pontos com água parada', estimatedCommentCount: 118, percentage: 20 },
    ],
    audienceQuestions: ['Quais os sintomas da dengue hemorrágica?', 'Qual UPA está menos cheia?', 'Quando vem o fumacê?'],
    complaints: ['UPA Cohama sem kit de reidratação', 'Fumacê não passa há semanas'],
    reports: ['Médica anônima relata sobrecarga extrema nos plantões'],
    claimsToVerify: [
      { claim: 'Há 2 mortes não confirmadas pela Secretaria', approximateMentions: 34, context: 'Usuários citam óbitos em família mas sem confirmação oficial' },
    ],
    editorialSignals: ['Crise de saúde pública em andamento', 'Dados oficiais disponíveis para comparação'],
    storyIdeas: [
      { headline: 'Surto de dengue em São Luís: X casos, filas nas UPAs e alerta para epidemia', angle: 'Jornalismo de saúde com dados e orientações à população', whyNow: 'Secretaria confirmou aumento de 180%', suggestedSources: ['Secretaria de Saúde', 'médicos', 'Vigilância Epidemiológica'], questionsToAnswer: ['Quantos casos confirmados? Há risco de epidemia?'], priority: 'high' },
    ],
    trendScore: 82,
    trendConfidence: 0.87,
    editorialPotential: 88,
    analysisConfidence: 0.84,
    commentsAtAnalysis: 591,
    metricsAtAnalysis: { comments: 591, likes: 1456, shares: 612, views: 38900 },
    baselineComparison: 390,
    status: 'new',
    createdAt: ago(55),
    updatedAt: ago(10),
    lastAnalysisAt: ago(10),
  },
  {
    postId: 'post_mock_007',
    platform: 'youtube',
    postUrl: 'https://www.youtube.com/watch?v=mockid007',
    postTitle: 'AO VIVO: Sessão da Câmara Municipal de São Luís — votação do novo plano diretor',
    mainTopic: 'PLANO DIRETOR SÃO LUÍS',
    summary: 'Câmara Municipal vota plano diretor que define regras de uso do solo para os próximos 10 anos. Debate acalorado sobre área de preservação e especulação imobiliária.',
    whyTrending: 'Impacto direto em proprietários de imóveis, construtoras e moradores de áreas de risco. Chat ao vivo com debate polarizado.',
    clusters: [
      { topic: 'Área de preservação', summary: 'Debate sobre redução de zona de proteção ambiental', estimatedCommentCount: 145, percentage: 40 },
      { topic: 'Especulação imobiliária', summary: 'Acusações de favorecimento a construtoras', estimatedCommentCount: 112, percentage: 31 },
      { topic: 'Regularização fundiária', summary: 'Moradores de áreas irregulares perguntam sobre situação', estimatedCommentCount: 65, percentage: 18 },
    ],
    audienceQuestions: ['Meu bairro vai ser afetado?', 'Como participo das audiências públicas?', 'Quando entra em vigor?'],
    complaints: ['Audiências públicas foram realizadas em horário comercial, sem participação popular real'],
    reports: ['Vereador apresentou emenda de última hora reduzindo área verde'],
    claimsToVerify: [
      { claim: 'Emenda beneficia terreno de empresa ligada a vereador', approximateMentions: 56, context: 'Usuários citam endereço específico e nome de empresa' },
    ],
    editorialSignals: ['Possível conflito de interesse documentável', 'Tema de impacto duradouro na cidade'],
    storyIdeas: [
      { headline: 'Plano diretor aprovado: quem ganha e quem perde com as novas regras', angle: 'Análise dos vencedores e perdedores da nova legislação', whyNow: 'Votação acontecendo agora', suggestedSources: ['urbanistas', 'Câmara Municipal', 'movimentos de moradia'], questionsToAnswer: ['Quais áreas foram mais afetadas? Quem votou como?'], priority: 'medium' },
    ],
    trendScore: 71,
    trendConfidence: 0.80,
    editorialPotential: 79,
    analysisConfidence: 0.77,
    commentsAtAnalysis: 363,
    metricsAtAnalysis: { comments: 363, likes: 678, shares: 201, views: 12400 },
    baselineComparison: 240,
    status: 'new',
    createdAt: ago(150),
    updatedAt: ago(30),
    lastAnalysisAt: ago(30),
  },
  {
    postId: 'post_mock_008',
    platform: 'imirante',
    postUrl: 'https://imirante.com/noticias/enchente-imperatriz',
    postTitle: 'Chuvas fortes causam alagamentos em Imperatriz; famílias desalojadas',
    mainTopic: 'ENCHENTE IMPERATRIZ',
    summary: 'Chuvas de mais de 120mm em 6 horas causam transbordamento de córrego e alaga 3 bairros. Defesa Civil atende famílias desalojadas em ginásio municipal.',
    whyTrending: 'Situação de emergência em andamento. Leitores enviando fotos e atualizações em tempo real.',
    clusters: [
      { topic: 'Famílias desalojadas', summary: 'Relatos de moradores que perderam pertences', estimatedCommentCount: 267, percentage: 45 },
      { topic: 'Ruas intransitáveis', summary: 'Fotos e vídeos de bairros alagados', estimatedCommentCount: 178, percentage: 30 },
      { topic: 'Ação da Defesa Civil', summary: 'Questionamentos sobre atendimento e abrigo', estimatedCommentCount: 89, percentage: 15 },
    ],
    audienceQuestions: ['Como ajudar com doações?', 'Quais bairros estão alagados?', 'Escola vai ter aula amanhã?'],
    complaints: ['Obras de drenagem prometidas há 2 anos nunca começaram'],
    reports: ['Idosa resgatada com água até a cintura em residência no Bacuri'],
    claimsToVerify: [
      { claim: 'Verbas federais para drenagem foram devolvidas sem uso', approximateMentions: 41, context: 'Vereador menciona em comentário valor específico de R$ 3,2 milhões' },
    ],
    editorialSignals: ['Emergência em andamento — cobertura em tempo real possível', 'Ângulo de accountability: obras de drenagem não realizadas'],
    storyIdeas: [
      { headline: 'Enchente em Imperatriz expõe falha de décadas na drenagem urbana', angle: 'Crônica de uma enchente anunciada: obras prometidas, dinheiro não usado', whyNow: 'Situação de emergência agora', suggestedSources: ['Defesa Civil', 'Prefeitura', 'moradores desalojados', 'TCE'], questionsToAnswer: ['Onde estão as verbas de drenagem? Quando foram licitadas as obras?'], priority: 'high' },
    ],
    trendScore: 91,
    trendConfidence: 0.94,
    editorialPotential: 90,
    analysisConfidence: 0.92,
    commentsAtAnalysis: 834,
    metricsAtAnalysis: { comments: 834, likes: 2109, shares: 987, views: 67200 },
    baselineComparison: 510,
    status: 'new',
    createdAt: ago(12),
    updatedAt: ago(2),
    lastAnalysisAt: ago(2),
  },
]

// ─── Baseline histórico ───────────────────────────────────────────────────────
// Valores representativos do iMirante baseados em comportamento editorial típico.
// Atualizado automaticamente pelo pipeline quando há >= 30 amostras reais.

type Platform = 'imirante' | 'instagram' | 'facebook' | 'youtube' | 'x'
type Bucket = '0-30m' | '30-120m' | '2-6h' | '6-24h' | '1-3d'

interface BaselineSeed {
  platform: Platform
  bucket: Bucket
  sampleSize: number
  mean: number
  median: number
  p75: number
  p90: number
  p95: number
  p99: number
}

function baselineId(platform: string, bucket: string): string {
  return `${platform}_${bucket.replace('-', '_')}`
}

const baselines: BaselineSeed[] = [
  // iMirante — site jornalístico com picos em notícias locais
  { platform: 'imirante', bucket: '0-30m',   sampleSize: 120, mean:  12, median:  8, p75:  18, p90:  32, p95:  48, p99:  95 },
  { platform: 'imirante', bucket: '30-120m', sampleSize: 120, mean:  28, median: 20, p75:  42, p90:  70, p95: 110, p99: 210 },
  { platform: 'imirante', bucket: '2-6h',    sampleSize: 120, mean:  55, median: 38, p75:  82, p90: 140, p95: 220, p99: 420 },
  { platform: 'imirante', bucket: '6-24h',   sampleSize: 120, mean:  90, median: 60, p75: 130, p90: 220, p95: 340, p99: 650 },
  { platform: 'imirante', bucket: '1-3d',    sampleSize: 120, mean: 110, median: 75, p75: 160, p90: 270, p95: 400, p99: 750 },

  // Instagram — maior volume médio, picos mais altos
  { platform: 'instagram', bucket: '0-30m',   sampleSize: 80, mean:  25, median: 15, p75:  40, p90:  75, p95: 120, p99: 250 },
  { platform: 'instagram', bucket: '30-120m', sampleSize: 80, mean:  60, median: 38, p75:  95, p90: 170, p95: 280, p99: 520 },
  { platform: 'instagram', bucket: '2-6h',    sampleSize: 80, mean: 110, median: 70, p75: 170, p90: 310, p95: 480, p99: 900 },
  { platform: 'instagram', bucket: '6-24h',   sampleSize: 80, mean: 160, median: 95, p75: 240, p90: 430, p95: 680, p99: 1200 },
  { platform: 'instagram', bucket: '1-3d',    sampleSize: 80, mean: 190, median: 110, p75: 280, p90: 500, p95: 780, p99: 1400 },

  // Facebook — engajamento intermediário
  { platform: 'facebook', bucket: '0-30m',   sampleSize: 60, mean:  18, median: 10, p75:  28, p90:  55, p95:  85, p99: 170 },
  { platform: 'facebook', bucket: '30-120m', sampleSize: 60, mean:  42, median: 25, p75:  65, p90: 120, p95: 190, p99: 380 },
  { platform: 'facebook', bucket: '2-6h',    sampleSize: 60, mean:  80, median: 50, p75: 120, p90: 220, p95: 340, p99: 650 },
  { platform: 'facebook', bucket: '6-24h',   sampleSize: 60, mean: 120, median: 75, p75: 180, p90: 310, p95: 480, p99: 900 },
  { platform: 'facebook', bucket: '1-3d',    sampleSize: 60, mean: 145, median: 90, p75: 210, p90: 360, p95: 560, p99: 1050 },

  // YouTube — comentários mais lentos, menor volume
  { platform: 'youtube', bucket: '0-30m',   sampleSize: 45, mean:   5, median:  3, p75:   8, p90:  15, p95:  25, p99:  50 },
  { platform: 'youtube', bucket: '30-120m', sampleSize: 45, mean:  15, median:  9, p75:  22, p90:  40, p95:  65, p99: 130 },
  { platform: 'youtube', bucket: '2-6h',    sampleSize: 45, mean:  35, median: 22, p75:  52, p90:  90, p95: 145, p99: 280 },
  { platform: 'youtube', bucket: '6-24h',   sampleSize: 45, mean:  65, median: 40, p75:  95, p90: 165, p95: 260, p99: 490 },
  { platform: 'youtube', bucket: '1-3d',    sampleSize: 45, mean:  90, median: 55, p75: 130, p90: 225, p95: 350, p99: 650 },

  // X (Twitter) — menor presença do iMirante
  { platform: 'x', bucket: '0-30m',   sampleSize: 30, mean:   8, median:  4, p75:  12, p90:  22, p95:  35, p99:  70 },
  { platform: 'x', bucket: '30-120m', sampleSize: 30, mean:  20, median: 11, p75:  30, p90:  55, p95:  85, p99: 170 },
  { platform: 'x', bucket: '2-6h',    sampleSize: 30, mean:  38, median: 22, p75:  55, p90: 100, p95: 160, p99: 310 },
  { platform: 'x', bucket: '6-24h',   sampleSize: 30, mean:  55, median: 32, p75:  80, p90: 145, p95: 225, p99: 430 },
  { platform: 'x', bucket: '1-3d',    sampleSize: 30, mean:  65, median: 38, p75:  95, p90: 170, p95: 265, p99: 500 },
]

// ─── Seed ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log(`\nSeeding ${opportunities.length} oportunidades...\n`)

  const oppBatch = db.batch()
  for (const opp of opportunities) {
    const ref = db.collection('opportunities').doc()
    oppBatch.set(ref, opp)
    console.log(`  + ${opp.mainTopic} (score ${opp.trendScore}, ${opp.platform})`)
  }
  await oppBatch.commit()

  console.log(`\nSeeding ${baselines.length} registros de baseline...\n`)

  const baseBatch = db.batch()
  for (const b of baselines) {
    const id = baselineId(b.platform, b.bucket)
    const ref = db.collection('baseline').doc(id)
    baseBatch.set(ref, {
      ...b,
      updatedAt: Timestamp.now(),
    })
    console.log(`  + baseline ${b.platform} / ${b.bucket} (p90=${b.p90})`)
  }
  await baseBatch.commit()

  console.log('\n✓ Seed concluído!\n')
}

seed().catch((err) => {
  console.error('Erro no seed:', err)
  process.exit(1)
})
