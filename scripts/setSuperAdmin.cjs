/**
 * One-time script: promote a user to superadmin.
 *
 * Usage:
 *   node scripts/setSuperAdmin.cjs               <- lista todos os usuários
 *   node scripts/setSuperAdmin.cjs <email>        <- promove por email
 *   node scripts/setSuperAdmin.cjs --uid <uid>    <- promove por UID
 */

const { initializeApp, getApps } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')
const { getFirestore } = require('firebase-admin/firestore')

if (!getApps().length) {
  initializeApp({ projectId: 'radarimirante' })
}

const auth = getAuth()
const db = getFirestore()

async function promote(uid, email) {
  await db.collection('users').doc(uid).update({
    role: 'superadmin',
    isAdmin: true,
    updatedAt: new Date(),
  })
  console.log(`✓ ${email ?? uid} → superadmin`)
}

async function run() {
  const args = process.argv.slice(2)

  // --uid <uid>
  if (args[0] === '--uid') {
    const uid = args[1]
    if (!uid) { console.error('Forneça o UID: node setSuperAdmin.cjs --uid <uid>'); process.exit(1) }
    await promote(uid, uid)
    return
  }

  // <email>
  if (args[0]) {
    const email = args[0]
    const user = await auth.getUserByEmail(email)
    await promote(user.uid, email)
    return
  }

  // Sem argumento: lista usuários do Firestore
  const snap = await db.collection('users').get()
  if (snap.empty) {
    console.log('Nenhum usuário encontrado no Firestore.')
    console.log('Faça login no app pelo menos uma vez antes de rodar este script.')
    return
  }

  console.log('\nUsuários cadastrados:\n')
  snap.docs.forEach(d => {
    const data = d.data()
    console.log(`  UID: ${d.id}`)
    console.log(`  Email: ${data.email}`)
    console.log(`  Role atual: ${data.role ?? (data.isAdmin ? 'admin' : 'user')}`)
    console.log()
  })
  console.log('Para promover, rode:')
  console.log('  node scripts/setSuperAdmin.cjs <email>')
  console.log('  ou: node scripts/setSuperAdmin.cjs --uid <uid>')
}

run().catch(err => { console.error(err); process.exit(1) })
