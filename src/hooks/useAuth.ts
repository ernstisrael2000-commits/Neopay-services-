import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile } from '../types';

const ADMIN_EMAILS = ['ernstisrael2000@gmail.com', 'ernstisrael508@gmail.com'];
const AUTH_BOOT_TIMEOUT_MS = 2500;

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let bootFinished = false;

    const finishBoot = () => {
      if (!active || bootFinished) return;
      bootFinished = true;
      setLoading(false);
    };

    // Authentication must never prevent public pages from rendering.
    const timeout = window.setTimeout(finishBoot, AUTH_BOOT_TIMEOUT_MS);

    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        if (!active) return;

        setUser(firebaseUser);
        finishBoot();

        if (!firebaseUser) {
          setProfile(null);
          return;
        }

        // A profile is useful for permissions, but it is not required to render
        // the public site. Load it in the background and recover if Firestore
        // is slow or temporarily unavailable.
        void (async () => {
          try {
            const docSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
            if (!active) return;

            if (docSnap.exists()) {
              setProfile(docSnap.data() as UserProfile);
            } else if (ADMIN_EMAILS.includes(firebaseUser.email || '')) {
              setProfile({
                uid: firebaseUser.uid,
                email: firebaseUser.email || '',
                role: 'admin'
              });
            } else {
              setProfile(null);
            }
          } catch (error) {
            if (!active) return;
            console.warn('Impossible de charger le profil utilisateur.', error);
            setProfile(null);
          }
        })();
      },
      (error) => {
        if (!active) return;
        console.warn('Impossible d’initialiser la session Firebase.', error);
        setUser(null);
        setProfile(null);
        finishBoot();
      }
    );

    return () => {
      active = false;
      window.clearTimeout(timeout);
      unsubscribe();
    };
  }, []);

  const isAdmin = profile?.role === 'admin' || ADMIN_EMAILS.includes(user?.email || '');

  useEffect(() => {
    if (user) {
      console.log("Current user:", user.email, "isAdmin:", isAdmin);
    }
  }, [user, isAdmin]);

  return { user, profile, loading, isAdmin };
};
