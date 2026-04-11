import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  doc, 
  serverTimestamp,
  getDocs,
  orderBy,
  setDoc,
  getDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, uploadBytesResumable } from 'firebase/storage';
import { db, storage, auth } from '../lib/firebase';
import { Parcel, ParcelStatus, PaymentStatus, Product, AppSettings, Game } from '../types';

// Helper for resumable uploads with progress
const uploadWithProgress = (
  file: File | Blob, 
  path: string, 
  onProgress?: (progress: number) => void
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const storageRef = ref(storage, path);
    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: 'image/jpeg'
    });

    uploadTask.on('state_changed', 
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        if (onProgress) onProgress(progress);
      }, 
      (error) => {
        console.error("Upload error:", error);
        reject(error);
      }, 
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        resolve(downloadURL);
      }
    );
  });
};

export const useParcels = () => {
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'parcels'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Parcel[];
      setParcels(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching parcels:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { parcels, loading };
};

export const searchParcel = async (trackingNumber: string): Promise<Parcel | null> => {
  const q = query(collection(db, 'parcels'), where('trackingNumber', '==', trackingNumber));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const docData = snapshot.docs[0];
  return { id: docData.id, ...docData.data() } as Parcel;
};

export const saveParcel = async (parcelData: Partial<Parcel>, id?: string) => {
  if (id) {
    const parcelRef = doc(db, 'parcels', id);
    await updateDoc(parcelRef, {
      ...parcelData,
      updatedAt: serverTimestamp()
    });
  } else {
    await addDoc(collection(db, 'parcels'), {
      ...parcelData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
};

export const deleteParcel = async (id: string) => {
  const parcelRef = doc(db, 'parcels', id);
  await deleteDoc(parcelRef);
};

export const uploadProof = async (
  file: File | Blob, 
  trackingNumber: string, 
  onProgress?: (progress: number) => void
): Promise<string> => {
  try {
    const path = `proofs/${trackingNumber}_${Date.now()}`;
    return await uploadWithProgress(file, path, onProgress);
  } catch (error) {
    console.error("Error uploading proof:", error);
    throw new Error("Échec du téléchargement de l'image. Veuillez vérifier votre connexion.");
  }
};

// Product Services
export const useProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      setProducts(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching products:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { products, loading };
};

export const saveProduct = async (productData: Partial<Product>, id?: string) => {
  if (id) {
    const productRef = doc(db, 'products', id);
    await updateDoc(productRef, {
      ...productData,
    });
  } else {
    await addDoc(collection(db, 'products'), {
      ...productData,
      createdAt: serverTimestamp(),
    });
  }
};

export const deleteProduct = async (id: string) => {
  const productRef = doc(db, 'products', id);
  await deleteDoc(productRef);
};

// Game Services
export const useGames = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'games'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Game[];
      setGames(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching games:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { games, loading };
};

export const saveGame = async (gameData: Partial<Game>, id?: string) => {
  if (id) {
    const gameRef = doc(db, 'games', id);
    await updateDoc(gameRef, {
      ...gameData,
    });
  } else {
    await addDoc(collection(db, 'games'), {
      ...gameData,
      createdAt: serverTimestamp(),
    });
  }
};

export const deleteGame = async (id: string) => {
  const gameRef = doc(db, 'games', id);
  await deleteDoc(gameRef);
};

// Settings Services
export const useSettings = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const docRef = doc(db, 'settings', 'global');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setSettings(docSnap.data() as AppSettings);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { settings, loading };
};

export const updateSettings = async (settingsData: AppSettings) => {
  const docRef = doc(db, 'settings', 'global');
  await setDoc(docRef, settingsData, { merge: true });
};

export const uploadLogo = async (
  file: File | Blob,
  onProgress?: (progress: number) => void
): Promise<string> => {
  try {
    const path = `logo/app_logo_${Date.now()}`;
    return await uploadWithProgress(file, path, onProgress);
  } catch (error) {
    console.error("Error uploading logo:", error);
    throw new Error("Échec du téléchargement du logo.");
  }
};
