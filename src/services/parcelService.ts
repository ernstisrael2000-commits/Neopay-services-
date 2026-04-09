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
  orderBy
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, auth } from '../lib/firebase';
import { Parcel, ParcelStatus, PaymentStatus } from '../types';

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

export const uploadProof = async (file: File, trackingNumber: string): Promise<string> => {
  const storageRef = ref(storage, `proofs/${trackingNumber}_${Date.now()}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
};
