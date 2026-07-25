import { useState, useCallback, useRef } from 'react';

type PinResolver = (pin: string | null) => void;

/**
 * usePinGuard — show a PIN entry modal before a sensitive action.
 *
 * Usage:
 *   const { pinModalOpen, pinModalTitle, pinModalDesc, requirePin, handlePinConfirm, handlePinCancel } = usePinGuard();
 *
 *   // In your async handler:
 *   const pin = await requirePin('Confirmer le retrait', 'Saisissez votre PIN pour continuer.');
 *   await fetch('/api/...', { body: JSON.stringify({ ..., pin }) });
 *
 *   // In your JSX:
 *   <PinEntryModal open={pinModalOpen} title={pinModalTitle} description={pinModalDesc}
 *     onConfirm={handlePinConfirm} onCancel={handlePinCancel} />
 */
export function usePinGuard() {
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinModalTitle, setPinModalTitle] = useState('Code PIN requis');
  const [pinModalDesc, setPinModalDesc] = useState('Saisissez votre code PIN pour confirmer.');
  const resolverRef = useRef<PinResolver | null>(null);

  const requirePin = useCallback((title?: string, desc?: string): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
      setPinModalTitle(title || 'Code PIN requis');
      setPinModalDesc(desc || 'Saisissez votre code PIN à 8 chiffres pour confirmer cette action.');
      setPinModalOpen(true);
      resolverRef.current = (pin: string | null) => {
        if (pin === null) reject(new Error('PIN_CANCELLED'));
        else resolve(pin);
      };
    });
  }, []);

  const handlePinConfirm = useCallback((pin: string) => {
    setPinModalOpen(false);
    resolverRef.current?.(pin);
    resolverRef.current = null;
  }, []);

  const handlePinCancel = useCallback(() => {
    setPinModalOpen(false);
    resolverRef.current?.(null);
    resolverRef.current = null;
  }, []);

  return {
    pinModalOpen,
    pinModalTitle,
    pinModalDesc,
    requirePin,
    handlePinConfirm,
    handlePinCancel,
  };
}
