import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile } from '../types';

const ADMIN_EMAILS = ['ernstisrael2000@gmail.com', 'ernstisrael508@gmail.com'];

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Max wait: 800ms — if Firebase Auth hasn't responded, unblock the app
    const timeout = setTimeout(() => setLoading(false), 800);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      clearTimeout(timeout);
      setUser(firebaseUser);
      if (firebaseUser) {
        const docRef = doc(db, 'users', firebaseUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
        } else {
          if (ADMIN_EMAILS.includes(firebaseUser.email || '')) {
            setProfile({
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              role: 'admin'
            });
          }
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => { clearTimeout(timeout); unsubscribe(); };
  }, []);

  const isAdmin = profile?.role === 'admin' || ADMIN_EMAILS.includes(user?.email || '');

  useEffect(() => {
    if (user) {
      console.log("Current user:", user.email, "isAdmin:", isAdmin);
    }
  }, [user, isAdmin]);

  return { user, profile, loading, isAdmin };
};
