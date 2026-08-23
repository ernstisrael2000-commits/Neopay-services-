import { motion, useReducedMotion } from 'motion/react';

interface LoadingScreenProps {
  message?: string;
}

export default function LoadingScreen({ message = 'Préparation de votre espace...' }: LoadingScreenProps) {
  const reduceMotion = useReducedMotion();
  const loop = reduceMotion ? undefined : Infinity;

  return (
    <motion.div
      className="relative min-h-screen overflow-hidden bg-[#f4f8f8] text-[#103447]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <motion.div
          className="absolute -left-32 top-[16%] h-80 w-80 rounded-full bg-[#6db3bc]/20 blur-3xl"
          animate={reduceMotion ? undefined : { x: [0, 36, 0], y: [0, -18, 0], opacity: [0.45, 0.9, 0.45] }}
          transition={{ duration: 8, repeat: loop, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -right-28 bottom-[8%] h-96 w-96 rounded-full bg-[#1d5b72]/15 blur-3xl"
          animate={reduceMotion ? undefined : { x: [0, -42, 0], y: [0, 22, 0], opacity: [0.35, 0.8, 0.35] }}
          transition={{ duration: 9, repeat: loop, ease: 'easeInOut', delay: 0.4 }}
        />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6">
        <div className="flex flex-col items-center">
          <div className="relative grid h-32 w-32 place-items-center sm:h-36 sm:w-36">
            <motion.div
              className="relative h-full w-full overflow-hidden"
              initial={{ opacity: 0, scale: 0.68, rotate: -10 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 190, damping: 18, delay: 0.08 }}
            >
              <motion.img
                src="/solution-pam-logo.png"
                alt="Solution PAM"
                className="absolute inset-0 h-full w-full scale-[1.72] object-cover mix-blend-multiply"
                initial={{ clipPath: 'inset(100% 0 0 0)' }}
                animate={{ clipPath: 'inset(0% 0 0 0)' }}
                transition={{ duration: reduceMotion ? 0.01 : 0.72, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
              />
            </motion.div>
          </div>

          <motion.div
            className="mt-9 text-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.48, duration: 0.45 }}
          >
            <p className="text-[10px] font-black uppercase tracking-[0.34em] text-[#367388]">Solution PAM</p>
            <p className="mt-3 text-sm font-medium text-[#5c737e]">{message}</p>
          </motion.div>
        </div>

        <motion.div
          className="mt-9 h-[3px] w-40 overflow-hidden rounded-full bg-[#1f6177]/10"
          initial={{ opacity: 0, scaleX: 0.6 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ delay: 0.65, duration: 0.35 }}
          role="status"
          aria-label="Chargement de Solution PAM"
        >
          <motion.div
            className="h-full w-[48%] rounded-full bg-[#27677d]"
            animate={reduceMotion ? { x: 0 } : { x: ['-110%', '230%'] }}
            transition={{ duration: 1.35, repeat: loop, ease: [0.65, 0, 0.35, 1], repeatDelay: 0.2 }}
          />
        </motion.div>

        <div className="mt-5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#6e8994]">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-[#3a788c]"
              animate={reduceMotion ? { opacity: 0.55 } : { opacity: [0.25, 1, 0.25], scale: [0.8, 1.25, 0.8] }}
              transition={{ duration: 0.9, repeat: loop, delay: i * 0.14, ease: 'easeInOut' }}
            />
          ))}
          <span>Connexion sécurisée</span>
        </div>
      </div>
    </motion.div>
  );
}
