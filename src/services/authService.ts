import { 
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { signInWithGooglePopup, mapGoogleAuthError } from '../lib/google-auth';
import { getAffiliateByEmail } from './affiliateService';
import { getAgentByEmail } from './agentService';
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
      const affiliate = await getAffiliateByEmail(email);
      if (!affiliate) {
        return {
          user, type: 'none', noAccount: true,
          googleUid: user.uid,
          googleEmail: email,
          googleName: user.displayName || '',
          googlePhotoUrl: user.photoURL || '',
        };
      }

      const updates: any = {
        uid: user.uid,
        email: email,
        updatedAt: serverTimestamp()
      };
      
      await updateDoc(doc(db, 'affiliates', affiliate.id!), updates);
      
      return { user, affiliate: { ...affiliate, ...updates }, type: 'affiliate' };
    } else {
      const agent = await getAgentByEmail(email);
      if (!agent) {
        return { user, type: 'none', error: "Aucun compte agent trouvé avec cet email." };
      }

      // Use backend endpoint (Admin SDK) to write uid/email — client-side
      // Firestore rules don't allow agents to write these fields themselves.
      const linkRes = await fetch('/api/agent/link-uid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: agent.id, uid: user.uid, email }),
      });
      if (!linkRes.ok) {
        const err = await linkRes.json().catch(() => ({}));
        throw new Error(err.error || 'Impossible de lier le compte Google.');
      }

      return { user, agent: { ...agent, uid: user.uid, email }, type: 'agent' };
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
