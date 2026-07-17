import React from 'react';
import { motion } from 'motion/react';
import { Users, ShieldCheck, ArrowRight, UserCheck } from 'lucide-react';
import { Card } from './ui/card';

interface AccessChoiceProps {
  onChoice: (choice: 'affiliate' | 'agent' | 'admin') => void;
}

export default function AccessChoice({ onChoice }: AccessChoiceProps) {
  return (
    <div className="min-h-[calc(100vh-140px)] flex items-center justify-center p-4">
      <div className="max-w-3xl w-full grid grid-cols-1 md:grid-cols-3 gap-5">

        {/* Affiliate Option */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card
            onClick={() => onChoice('affiliate')}
            className="group relative h-full overflow-hidden border-0 shadow-xl rounded-[2.5rem] cursor-pointer hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 bg-white"
          >
            <div className="absolute top-0 left-0 w-full h-2 bg-primary" />
            <div className="p-8 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-500">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-black text-dark mb-2">Espace Affilié</h3>
              <p className="text-gray-500 font-medium mb-6 text-sm">
                Accédez à votre tableau de bord, gérez vos clients et commissions.
              </p>
              <div className="flex items-center gap-2 text-primary font-black uppercase text-xs tracking-widest group-hover:gap-4 transition-all mt-auto">
                Se Connecter <ArrowRight className="h-4 w-4" />
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Agent Option */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card
            onClick={() => onChoice('agent')}
            className="group relative h-full overflow-hidden border-0 shadow-xl rounded-[2.5rem] cursor-pointer hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 bg-white"
          >
            <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500" />
            <div className="p-8 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-500">
                <UserCheck className="h-8 w-8 text-emerald-600" />
              </div>
              <h3 className="text-xl font-black text-dark mb-2">Espace Agent</h3>
              <p className="text-gray-500 font-medium mb-6 text-sm">
                Traitez les dépôts et retraits de vos clients sur le terrain.
              </p>
              <div className="flex items-center gap-2 text-emerald-600 font-black uppercase text-xs tracking-widest group-hover:gap-4 transition-all mt-auto">
                Se Connecter <ArrowRight className="h-4 w-4" />
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Admin Option */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card
            onClick={() => onChoice('admin')}
            className="group relative h-full overflow-hidden border-0 shadow-xl rounded-[2.5rem] cursor-pointer hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 bg-dark"
          >
            <div className="absolute top-0 left-0 w-full h-2 bg-accent" />
            <div className="p-8 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-3xl bg-accent/10 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-500">
                <ShieldCheck className="h-8 w-8 text-accent" />
              </div>
              <h3 className="text-xl font-black text-white mb-2">Administration</h3>
              <p className="text-gray-400 font-medium mb-6 text-sm">
                Configuration système, gestion des comptes et surveillance.
              </p>
              <div className="flex items-center gap-2 text-accent font-black uppercase text-xs tracking-widest group-hover:gap-4 transition-all mt-auto">
                Panneau Admin <ArrowRight className="h-4 w-4" />
              </div>
            </div>
          </Card>
        </motion.div>

      </div>
    </div>
  );
}
