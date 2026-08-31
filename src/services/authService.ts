import { 
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { signInWithGooglePopup, mapGoogleAuthError } from '../lib/google-auth';
import { Affiliate, Agent } from '../types';

export interface SocialLoginResult {
  user: User;
  affiliate?: Affiliate;
  agent?: Agent;
  error?: string;
  type: 'affiliate' | 'agent' | 'none';
  noAccount?: boolean;
  googleUid?: string;
  googleEmail?: string;
  googleName?: string;
  googlePhotoUrl?: string;
  /** 2FA pending — sessionId must be verified via /api/{role}/verify-2fa */
  pending2fa?: boolean;
  sessionId?: string;
  maskedEmail?: string;
}

export const loginWithGoogle = async (targetType: 'affiliate' | 'agent'): Promise<SocialLoginResult> => {
  try {
    const result = await signInWithGooglePopup();
    const user = result.user;
    const email = user.email;

    if (!email) {
      throw new Error("L'email Google est requis.");
    }

    if (targetType === 'affiliate') {
      // Server-side: verify affiliate exists + trigger 2FA
      const idToken = await user.getIdToken();
      const linkRes = await fetch('/api/affiliate/google-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ idToken }),
      });
      const data = await linkRes.json();

      if (data.noAccount) {
        return {
          user, type: 'none', noAccount: true,
          googleUid: user.uid,
          googleEmail: email,
          googleName: user.displayName || '',
          googlePhotoUrl: user.photoURL || '',
        };
      }
      if (data.pending2fa) {
        return { user, type: 'affiliate', pending2fa: true, sessionId: data.sessionId, maskedEmail: data.maskedEmail };
      }
      if (!linkRes.ok || data.error) {
        return { user, type: 'none', error: data.error || 'Erreur de connexion.' };
      }
      return { user, type: 'none', error: 'Réponse inattendue du serveur.' };

    } else {
      // Agent: call link-uid which now returns pending2fa
      const idToken = await user.getIdToken();
      const linkRes = await fetch('/api/agent/link-uid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ idToken }),
      });
      const data = await linkRes.json();

      if (!linkRes.ok) {
        const err = data.error || 'Impossible de lier le compte Google.';
        return { user, type: 'none', error: err };
      }
      if (data.pending2fa) {
        return { user, type: 'agent', pending2fa: true, sessionId: data.sessionId, maskedEmail: data.maskedEmail };
      }
      // Fallback (should not happen in production — agent always requires 2FA)
      return { user, type: 'none', error: 'Réponse inattendue.' };
    }
  } catch (error: any) {
    const mapped = mapGoogleAuthError(error);
    if (!mapped) return { user: {} as User, type: 'none', error: '' };
    console.error("Google Login Error:", error);
    return { 
      user: {} as User, 
      type: 'none', 
      error: mapped
    };
  }
};

export { onAuthStateChanged, auth };
