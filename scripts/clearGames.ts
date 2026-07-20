/**
 * clearGames.ts
 * Supprime TOUS les documents de la collection Firestore "games"
 * (les vrais jeux viennent désormais de FazerCards, pas de Firebase).
 * Usage : npx tsx scripts/clearGames.ts
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const FIRESTORE_DB_ID = process.env.FIRESTORE_DB_ID || 'ai-studio-283d6370-7e1a-484a-aed2-4d5b3071d1e2';

function parseServiceAccount(raw: string): any {
  let json = raw.trim();
  if (!json.startsWith('{')) {
    try { const d = Buffer.from(json, 'base64').toString('utf8').trim(); if (d.startsWith('{')) json = d; } catch {}
  }
  if (!json.startsWith('{')) json = '{' + json;
  const sa = JSON.parse(json);
  if (sa.private_key) {
    let key: string = sa.private_key;
    let prev = '';
    while (prev !== key) { prev = key; key = key.replace(/\\n/g, '\n'); }
    if (!key.includes('\n')) key = key.split('\\n').join('\n');
    sa.private_key = key;
  }
  return sa;
}

async function main() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) { console.error('❌ FIREBASE_SERVICE_ACCOUNT manquant'); process.exit(1); }

  const app = getApps().length > 0 ? getApps()[0] : initializeApp({ credential: cert(parseServiceAccount(raw)) });
  const db = getFirestore(app, FIRESTORE_DB_ID);

  const snap = await db.collection('games').get();
  if (snap.empty) { console.log('✅ Collection "games" déjà vide.'); return; }

  console.log(`🗑  ${snap.size} jeu(x) trouvé(s) — suppression en cours…`);
  snap.docs.forEach(doc => console.log(`   • ${doc.id} — ${doc.data().name ?? '(sans nom)'}`));

  const BATCH_SIZE = 400;
  let batch = db.batch();
  let count = 0;
  for (const doc of snap.docs) {
    batch.delete(doc.ref);
    count++;
    if (count % BATCH_SIZE === 0) { await batch.commit(); batch = db.batch(); }
  }
  if (count % BATCH_SIZE !== 0) await batch.commit();

  console.log(`✅ ${snap.size} jeu(x) supprimé(s) avec succès.`);
}

main().catch(e => { console.error('❌ Erreur :', e); process.exit(1); });
