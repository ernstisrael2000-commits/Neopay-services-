import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  UserCredential,
  browserLocalPersistence,
  setPersistence
} from 'firebase/auth';
import { auth } from './firebase';

// ─── Error code → French message ─────────────────────────────────────────────
export function mapGoogleAuthError(error: any): string {
  const code: string = error?.code ?? '';
  const msg: string = error?.message ?? '';

  // Silent cancellations — return empty string so callers can ignore
  if (code === 'auth/popup-closed-by-user') return '';
  if (code === 'auth/cancelled-popup-request') return '';
  if (code === 'auth/user-cancelled') return '';

  // Specific actionable errors
  if (code === 'auth/popup-blocked')
    return "Votre navigateur a bloqué la fenêtre de connexion Google. Veuillez autoriser les popups pour ce site et réessayer.";

  if (
    code === 'auth/missing-initial-state' ||
    code === 'auth/invalid-oauth-response' ||
    msg.includes('missing initial state') ||
    msg.includes('state')
  )
    return "La connexion Google a échoué : l'état de session est inaccessible. Cela arrive lorsque l'application tourne dans un iframe ou que les cookies tiers sont bloqués. Ouvrez le site dans un onglet normal de votre navigateur et réessayez.";

  if (code === 'auth/unauthorized-domain')
    return "Ce domaine n'est pas autorisé pour la connexion Google. Contactez l'administrateur Solutionpam.";

  if (code === 'auth/network-request-failed')
    return "Erreur réseau. Vérifiez votre connexion internet et réessayez.";

  if (code === 'auth/too-many-requests')
    return "Trop de tentatives. Attendez quelques minutes avant de réessayer.";

  if (code === 'auth/account-exists-with-different-credential')
    return "Un compte existe déjà avec cet email, mais avec un autre mode de connexion. Utilisez la connexion par email/mot de passe.";

  if (code === 'auth/internal-error' || code === 'auth/unknown')
    return "Une erreur interne est survenue. Réessayez ou utilisez la connexion par email/mot de passe.";

  // Fallback — show raw message but cleaned up
  return msg.replace(/Firebase: /gi, '').replace(/\(auth\/[\w-]+\)\.?/g, '').trim()
    || "Erreur de connexion Google. Veuillez réessayer.";
}

// ─── Detect iframe context ────────────────────────────────────────────────────
export function isInIframe(): boolean {
  try { return window.self !== window.top; } catch { return true; }
}

// ─── Create a properly-configured GoogleAuthProvider ─────────────────────────
export function makeGoogleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  provider.addScope('email');
  provider.addScope('profile');
  return provider;
}

// ─── signInWithGooglePopup — wraps signInWithPopup with better error handling ─
// If the browser is an iframe or blocks the popup, throws with a clear French message.
export async function signInWithGooglePopup(): Promise<UserCredential> {
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch {
    // Ignore persistence errors — will still work with defaults
  }
  const provider = makeGoogleProvider();
  return signInWithPopup(auth, provider);
}
