import React from 'react';
import { Home, Compass, LibraryBig, UserCircle2 } from 'lucide-react';
import { Client } from '../types';

interface FormationsBottomTabBarProps {
  activeTab: 'all' | 'my';
  onGoHome: () => void;
  onExplore: () => void;
  onMyCourses: () => void;
  onProfile: () => void;
}

export default function FormationsBottomTabBar({
  activeTab, onGoHome, onExplore, onMyCourses, onProfile,
}: FormationsBottomTabBarProps) {
  const items = [
    { id: 'home' as const, label: 'Accueil', icon: Home, onClick: onGoHome, active: false },
    { id: 'explore' as const, label: 'Explorer', icon: Compass, onClick: onExplore, active: activeTab === 'all' },
    { id: 'my' as const, label: 'Mes cours', icon: LibraryBig, onClick: onMyCourses, active: activeTab === 'my' },
    { id: 'profile' as const, label: 'Profil', icon: UserCircle2, onClick: onProfile, active: false },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-stone-200">
      <div className="flex items-stretch h-16">
        {items.map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={item.onClick}
              className="flex-1 flex flex-col items-center justify-center gap-1 transition-colors"
            >
              <Icon
                className={`h-5 w-5 ${item.active ? 'text-orange-500' : 'text-gray-400'}`}
                strokeWidth={item.active ? 2.4 : 1.9}
              />
              <span className={`text-[10px] font-bold ${item.active ? 'text-violet-700' : 'text-gray-400'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
