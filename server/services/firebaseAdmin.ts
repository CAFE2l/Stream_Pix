import 'dotenv/config'
import admin from 'firebase-admin'
import fs from 'fs'
import path from 'path'

let adminDbInstance: admin.firestore.Firestore | null = null
let isConfigured = false

if (!admin.apps.length) {
  // Método 1: caminho para o arquivo JSON (mais confiável)
  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS

  if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    })
    isConfigured = true
    console.log('[FirebaseAdmin] Inicializado via arquivo JSON:', serviceAccountPath)
  }
  // Método 2: variáveis individuais no .env
  else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    })
    isConfigured = true
    console.log('[FirebaseAdmin] Inicializado via variáveis de ambiente')
  }
  else {
    console.warn('[FirebaseAdmin] NÃO configurado — endpoints que usam Firestore retornarão 503.')
    console.warn('[FirebaseAdmin] Coloque o JSON de service account e configure GOOGLE_APPLICATION_CREDENTIALS no server/.env')
  }
}

if (isConfigured) {
  adminDbInstance = admin.firestore()
}

export const adminDb = adminDbInstance as admin.firestore.Firestore
export const adminAuth = isConfigured ? admin.auth() : null
export { admin, isConfigured }
