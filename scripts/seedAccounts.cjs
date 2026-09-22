/**
 * One-time script: populate /radarAccounts in Firestore with the initial accounts.
 *
 * Usage (PowerShell):
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="path\to\serviceAccountKey.json"
 *   node scripts/seedAccounts.js
 *
 * Or with ADC (Application Default Credentials) if already authenticated:
 *   node scripts/seedAccounts.js
 */

const { initializeApp, cert, getApps } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')

if (!getApps().length) {
  initializeApp({ projectId: 'radarimirante' })
}

const db = getFirestore()

const ACCOUNTS = [
  {
    id: 'imirante',
    displayName: '@imirante',
    shortName: 'Imirante',
    color: '#38B6FF',
    active: true,
    emProducao: false,
    order: 0,
  },
  {
    id: 'imiranteesporte',
    displayName: '@imiranteesporte',
    shortName: 'Esporte',
    color: '#91BD32',
    active: true,
    emProducao: true,
    order: 1,
  },
]

async function seed() {
  for (const account of ACCOUNTS) {
    const { id, ...data } = account
    await db.collection('radarAccounts').doc(id).set(data, { merge: true })
    console.log(`✓ radarAccounts/${id}`)
  }
  console.log('Done.')
}

seed().catch(err => { console.error(err); process.exit(1) })
