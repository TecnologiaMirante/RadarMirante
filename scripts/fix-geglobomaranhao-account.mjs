/**
 * Migração pontual: corrige o campo account dos posts coletados com o radarId
 * antigo 'geglobomaranhao' para 'ge.globomaranhao'.
 *
 * Uso: node scripts/fix-geglobomaranhao-account.mjs
 * Requer: GOOGLE_APPLICATION_CREDENTIALS ou gcloud auth application-default login
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

initializeApp({ projectId: 'radarimirante' })
const db = getFirestore()

const snap = await db.collection('posts')
  .where('account', '==', 'geglobomaranhao')
  .get()

if (snap.empty) {
  console.log('Nenhum post encontrado com account=geglobomaranhao. Nada a fazer.')
  process.exit(0)
}

console.log(`Encontrados ${snap.size} posts para migrar...`)

const batch = db.batch()
snap.docs.forEach(doc => {
  batch.update(doc.ref, { account: 'ge.globomaranhao' })
  console.log(`  → ${doc.id}`)
})

await batch.commit()
console.log(`✓ ${snap.size} posts migrados para account=ge.globomaranhao`)
