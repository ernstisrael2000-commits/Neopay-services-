import { motion } from 'motion/react';

interface RenaLogoProps {
  size?: number;
  className?: string;
  animated?: boolean;
}

export default function RenaLogo({ size = 48, className = '', animated = true }: RenaLogoProps) {
  return (
    <motion.div
      className={className}
      style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden' }}
      animate={animated ? { scale: [1, 1.03, 1] } : undefined}
      transition={animated ? { duration: 2.8, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1.2 } : undefined}
    >
      <img
        src="/logo.png"
        alt="Rena"
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </motion.div>
  );
}
