import { motion } from 'motion/react';
import { Loader2, ArrowLeft, Shield } from 'lucide-react';
import { Button } from '../components/ui/button';

interface Props {
  onClose: () => void;
}

export default function PaymentSuccessPage({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gradient-to-br from-emerald-50 to-emerald-100 px-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="w-full max-w-sm bg-white rounded-[2rem] shadow-2xl overflow-hidden"
      >
        <div className="p-6 bg-gradient-to-br from-emerald-500 to-emerald-700 text-white text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 20 }}
            className="flex flex-col items-center gap-3"
          >
            <div className="h-16 w-16 rounded-2xl bg-white/20 flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-white animate-spin" />
            </div>
            <div>
              <p className="font-black text-lg">Paiement reçu</p>
              <p className="text-white/80 text-sm mt-1">Vérification en cours…</p>
            </div>
          </motion.div>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-center">
            <div className="flex justify-center gap-1.5 mb-3">
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  animate={{ scale: [1, 1.5, 1] }}
                  transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                  className="h-2 w-2 rounded-full bg-emerald-400"
                />
              ))}
            </div>
            <p className="text-sm font-bold text-emerald-800 leading-relaxed">
              Votre paiement MonCash a bien été reçu.
            </p>
            <p className="text-xs text-emerald-600 mt-1 leading-relaxed">
              Votre solde sera crédité automatiquement dès confirmation par MonCashConnect.
            </p>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100">
            <Shield className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
              Aucune action supplémentaire n'est requise. Ne fermez pas l'application — votre solde se mettra à jour automatiquement.
            </p>
          </div>

          <Button
            onClick={onClose}
            className="w-full h-12 rounded-xl font-black text-white bg-emerald-600 hover:bg-emerald-700 border-0"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour à mon compte
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
