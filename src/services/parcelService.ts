import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  orderBy,
  where,
  getDocs,
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage, auth } from '../lib/firebase';
import { handleFirestoreError } from '../lib/firebase-errors';
import { cacheGet, cacheSet } from '../lib/localCache';
import { Parcel, Product, AppSettings, Game, ShippingConfig, CardTopup, NavButton, OnlineSubService, Formation } from '../types';

// ── Admin API helper (toutes les écritures passent par le serveur) ────────────
async function adminApi(method: string, path: string, body?: object): Promise<any> {
  const opts: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-secret': (import.meta.env.VITE_ADMIN_SECRET ?? 'rena-admin-2024'),
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erreur serveur (${res.status})`);
  return data;
}

// ── Helper for resumable uploads with progress ────────────────────────────────
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
      (error) => { console.error("Upload error:", error); reject(error); },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        resolve(downloadURL);
      }
    );
  });
};

// Navigation Buttons Services
export const useNavButtons = () => {
  const cached = cacheGet<NavButton[]>('nav_buttons');
  const [buttons, setButtons] = useState<NavButton[]>(cached ?? []);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    const q = query(collection(db, 'nav_buttons'), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as NavButton[];
      setButtons(data);
      cacheSet('nav_buttons', data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching nav buttons:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return { buttons, loading };
};

export const saveNavButton = async (buttonData: Partial<NavButton>, id?: string) => {
  await adminApi('POST', '/api/admin/nav-button', { ...buttonData, ...(id && { id }) });
};

export const deleteNavButton = async (id: string) => {
  await adminApi('DELETE', `/api/admin/nav-button/${id}`);
};

// Card Topup Services
export const useCardTopups = () => {
  const cached = cacheGet<CardTopup[]>('card_topups');
  const [cards, setCards] = useState<CardTopup[]>(cached ?? []);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    const q = query(collection(db, 'card_topups'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as CardTopup[];
      setCards(data);
      cacheSet('card_topups', data, 60 * 60 * 1000); // 1h TTL
      setLoading(false);
    }, (error) => {
      console.error("Error fetching card topups:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return { cards, loading };
};

export const saveCardTopup = async (cardData: Partial<CardTopup>, id?: string) => {
  await adminApi('POST', '/api/admin/card-topup', { ...cardData, ...(id && { id }) });
};

export const deleteCardTopup = async (id: string) => {
  await adminApi('DELETE', `/api/admin/card-topup/${id}`);
};

export const useParcels = () => {
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'parcels'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setParcels(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Parcel[]);
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
  const snap = await getDocs(query(collection(db, 'parcels'), where('trackingNumber', '==', trackingNumber)));
  if (snap.empty) return null;
  const docData = snap.docs[0];
  return { id: docData.id, ...docData.data() } as Parcel;
};

export const saveParcel = async (parcelData: Partial<Parcel>, id?: string) => {
  await adminApi('POST', '/api/admin/parcel', { ...parcelData, ...(id && { id }) });
};

export const deleteParcel = async (id: string) => {
  await adminApi('DELETE', `/api/admin/parcel/${id}`);
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
  const cached = cacheGet<Product[]>('products');
  const [products, setProducts] = useState<Product[]>(cached ?? []);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[];
      setProducts(data);
      cacheSet('products', data, 60 * 60 * 1000); // 1h TTL
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
  await adminApi('POST', '/api/admin/product', { ...productData, ...(id && { id }) });
};

export const deleteProduct = async (id: string) => {
  await adminApi('DELETE', `/api/admin/product/${id}`);
};

// Game Services
export const useGames = () => {
  const cached = cacheGet<Game[]>('games');
  const [games, setGames] = useState<Game[]>(cached ?? []);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    const q = query(collection(db, 'games'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Game[];
      setGames(data);
      cacheSet('games', data, 60 * 60 * 1000); // 1h TTL
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
  await adminApi('POST', '/api/admin/game', { ...gameData, ...(id && { id }) });
};

export const deleteGame = async (id: string) => {
  await adminApi('DELETE', `/api/admin/game/${id}`);
};

// Settings Services
export const useSettings = () => {
  const cached = cacheGet<AppSettings>('settings_global');
  const [settings, setSettings] = useState<AppSettings | null>(cached ?? null);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    const docRef = doc(db, 'settings', 'global');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as AppSettings;
        setSettings(data);
        cacheSet('settings_global', data);
      }
      setLoading(false);
    }, (error) => {
      setLoading(false);
      try { handleFirestoreError(error, 'get', 'settings/global', auth); } catch (e) {}
    });
    return () => unsubscribe();
  }, []);

  return { settings, loading };
};

export const updateSettings = async (settingsData: Partial<AppSettings>) => {
  await adminApi('POST', '/api/admin/settings', settingsData);
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

// Slider Images Services
type SliderImage = { id: string; url: string; title?: string; description?: string };
export const useSliderImages = () => {
  const cached = cacheGet<SliderImage[]>('slider_images');
  const [sliderImages, setSliderImages] = useState<SliderImage[]>(cached ?? []);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    const q = query(collection(db, 'slider_images'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as SliderImage[];
      setSliderImages(data);
      cacheSet('slider_images', data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching slider images:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return { sliderImages, loading };
};

export const saveSliderImage = async (url: string, title?: string, description?: string) => {
  await adminApi('POST', '/api/admin/slider-image', { url, title: title || '', description: description || '' });
};

export const updateSliderImage = async (id: string, updates: { url?: string, title?: string, description?: string }) => {
  await adminApi('PUT', `/api/admin/slider-image/${id}`, updates);
};

export const deleteSliderImage = async (id: string) => {
  await adminApi('DELETE', `/api/admin/slider-image/${id}`);
};

// Shipping Services
export const useShippingConfigs = () => {
  const [configs, setConfigs] = useState<ShippingConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = collection(db, 'shipping_configs');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setConfigs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ShippingConfig[]);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching shipping configs:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return { configs, loading };
};

export const saveShippingConfig = async (configData: Partial<ShippingConfig>) => {
  await adminApi('POST', '/api/admin/shipping-config', configData);
};

export const deleteShippingConfig = async (id: string) => {
  await adminApi('DELETE', `/api/admin/shipping-config/${id}`);
};

// ── Online Sub-Services ────────────────────────────────────────────────────────
export const useOnlineServices = () => {
  const cached = cacheGet<OnlineSubService[]>('online_services');
  const [services, setServices] = useState<OnlineSubService[]>(cached ?? []);
  const [loading, setLoading] = useState(!cached);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!cached || refresh > 0) setLoading(true);
    fetch('/api/online-sub-services')
      .then(r => r.json())
      .then(data => {
        if (!cancelled) {
          const list = data.services || [];
          setServices(list);
          cacheSet('online_services', list, 30 * 60 * 1000); // 30min TTL
          setLoading(false);
        }
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refresh]);

  const forceRefresh = () => setRefresh(r => r + 1);
  return { services, loading, refresh: forceRefresh };
};

export const saveOnlineSubService = async (data: Partial<OnlineSubService>, id?: string) => {
  const payload = id ? { ...data, id } : data;
  const res = await fetch('/api/admin/online-sub-services', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-secret': (import.meta.env.VITE_ADMIN_SECRET ?? 'rena-admin-2024') },
    body: JSON.stringify(payload),
  });
  if (!res.ok) { const j = await res.json(); throw new Error(j.error || 'Erreur sauvegarde service'); }
};

export const deleteOnlineSubService = async (id: string) => {
  const res = await fetch(`/api/admin/online-sub-services/${id}`, {
    method: 'DELETE',
    headers: { 'x-admin-secret': (import.meta.env.VITE_ADMIN_SECRET ?? 'rena-admin-2024') },
  });
  if (!res.ok) { const j = await res.json(); throw new Error(j.error || 'Erreur suppression service'); }
};

// ─── Formations (Admin CRUD via API) ─────────────────────────────────────────
export const useAdminFormations = () => {
  const [formations, setFormations] = useState<Formation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/formations', { headers: { 'x-admin-secret': (import.meta.env.VITE_ADMIN_SECRET ?? 'rena-admin-2024') } })
      .then(r => r.json())
      .then(data => setFormations(data.formations || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const refresh = () => {
    setLoading(true);
    fetch('/api/admin/formations', { headers: { 'x-admin-secret': (import.meta.env.VITE_ADMIN_SECRET ?? 'rena-admin-2024') } })
      .then(r => r.json())
      .then(data => setFormations(data.formations || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  return { formations, loading, refresh };
};

export const saveAdminFormation = async (data: Partial<Formation>, id?: string): Promise<void> => {
  const url = id ? `/api/admin/formations/${id}` : '/api/admin/formations';
  const method = id ? 'PUT' : 'POST';
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-admin-secret': (import.meta.env.VITE_ADMIN_SECRET ?? 'rena-admin-2024') },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || 'Erreur lors de la sauvegarde.');
  }
};

export const deleteAdminFormation = async (id: string): Promise<void> => {
  const res = await fetch(`/api/admin/formations/${id}`, {
    method: 'DELETE',
    headers: { 'x-admin-secret': (import.meta.env.VITE_ADMIN_SECRET ?? 'rena-admin-2024') }
  });
  if (!res.ok) throw new Error('Erreur lors de la suppression.');
};
