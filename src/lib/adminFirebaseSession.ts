import { signInWithCustomToken } from 'firebase/auth';
import { auth } from './firebase';

/**
 * Establishes the Firebase identity only after the server has completed admin
 * credentials and 2FA verification. The token is short-lived and never stored.
 */
export async function establishAdminFirebaseSession(customToken?: string): Promise<void> {
  if (!customToken) throw new Error('Session Firebase administrateur manquante.');
  const credential = await signInWithCustomToken(auth, customToken);
  await credential.user.getIdToken(true);
}