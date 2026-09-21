import type { SocialConnector, CollectionResult } from './base'
import { ConnectorError } from './base'

// ─── iMirante Connector ───────────────────────────────────────────────────────
//
// PENDENTE DE CONFIGURAÇÃO (ETAPA 10):
//
// O site do iMirante não expõe uma API REST pública documentada.
// As opções disponíveis são:
//
//   1. RSS Feed:  iMirante provavelmente publica RSS — verificar URL e formato.
//   2. Scraping:  Coletar artigos e comentários via HTML parsing (Cheerio).
//                 Requer análise da estrutura do site antes de implementar.
//   3. Plugin/API interna: Caso o CMS (WordPress, etc.) tenha API REST ativada.
//
// Para avançar com este connector, você precisa fornecer:
//   - URL base do site
//   - Estrutura dos comentários (sistema próprio, Disqus, Facebook Comments, etc.)
//   - Credenciais de acesso à API (se houver)
//   - Permissão explícita para scraping (se necessário)
//
// Secrets necessários no Google Secret Manager:
//   - IMIRANTE_API_KEY (se houver API)
//   - IMIRANTE_BASE_URL

export class ImiranteConnector implements SocialConnector {
  readonly platform = 'imirante' as const

  private lastResult: CollectionResult | null = null

  async syncPosts(): Promise<void> {
    throw new ConnectorError(
      'imirante',
      'Connector não implementado — aguardando ETAPA 10. ' +
      'Forneça credenciais e estrutura da API do site iMirante.',
    )
  }

  async syncComments(_: string): Promise<void> {
    throw new ConnectorError(
      'imirante',
      'Connector não implementado — aguardando ETAPA 10.',
    )
  }

  async syncMetrics(_: string): Promise<void> {
    throw new ConnectorError(
      'imirante',
      'Connector não implementado — aguardando ETAPA 10.',
    )
  }

  getLastCollectionResult(): CollectionResult | null {
    return this.lastResult
  }

  protected setLastResult(result: CollectionResult): void {
    this.lastResult = result
  }
}
