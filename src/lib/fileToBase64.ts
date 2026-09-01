function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function base64FromBytes(bytes: ArrayBuffer): string {
  const encoded = bytesToBase64(new Uint8Array(bytes));
  if (!encoded) throw new Error('Le fichier est vide.');
  return encoded;
}

/**
 * Read a file while it is still available from a mobile document picker.
 * Android can invalidate the picker-backed File between selection and form
 * submission, so callers should cache this result only in transient UI state.
 */
export async function fileToBase64(file: File | null | undefined): Promise<string | undefined> {
  if (!file) return undefined;

  let lastError: unknown;

  try {
    if (typeof file.arrayBuffer === 'function') {
      return base64FromBytes(await file.arrayBuffer());
    }
  } catch (error) {
    lastError = error;
  }

  try {
    if (typeof URL !== 'undefined' && typeof fetch === 'function') {
      const objectUrl = URL.createObjectURL(file);
      try {
        const response = await fetch(objectUrl);
        if (!response.ok) throw new Error(`Lecture du fichier impossible (${response.status}).`);
        return base64FromBytes(await response.arrayBuffer());
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    }
  } catch (error) {
    lastError = error;
  }

  try {
    if (typeof FileReader !== 'undefined') {
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('FileReader n’a pas pu lire le fichier.'));
        reader.onload = () => {
          const result = String(reader.result || '');
          const encoded = result.includes(',') ? result.slice(result.indexOf(',') + 1) : result;
          if (!encoded) reject(new Error('Le fichier est vide.'));
          else resolve(encoded);
        };
        reader.readAsDataURL(file);
      });
    }
  } catch (error) {
    lastError = error;
  }

  void lastError;
  throw new Error(`Impossible de lire ${file.name}. Vérifiez que le fichier est toujours disponible, puis réessayez.`);
}