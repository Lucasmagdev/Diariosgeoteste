import React from 'react';
import { FileText, Home, Map, User } from 'lucide-react';

interface BottomNavProps {
  currentPage: string;
  onPageChange: (page: string) => void;
  userRole?: string;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentPage, onPageChange, userRole }) => {
  const items = userRole === 'admin'
    ? [
        { key: 'dashboard', label: 'Início', icon: Home },
        { key: 'diaries', label: 'Diários', icon: FileText },
        { key: 'equipment', label: 'Equipamentos', icon: Map },
        { key: 'profile', label: 'Perfil', icon: User },
      ]
    : [
        { key: 'dashboard', label: 'Início', icon: Home },
        { key: 'diaries', label: 'Diários', icon: FileText },
        { key: 'profile', label: 'Perfil', icon: User },
      ];

  const handleClick = (key: string) => {
    navigator.vibrate?.(10);
    onPageChange(key);
  };

  return (
    <nav aria-label="Navegação principal" className="safe-area-bottom fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white/95 backdrop-blur-lg dark:border-gray-800 dark:bg-gray-900/95 md:hidden">
      <div className="flex h-16 items-center justify-around px-2">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.key;
          return (
            <button
              key={item.key}
              onClick={() => handleClick(item.key)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex h-full flex-1 flex-col items-center justify-center gap-1 transition-colors duration-150 ${
                isActive ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="max-w-full truncate px-1 text-[11px] font-medium">{item.label}</span>
              {isActive && <span className="absolute bottom-0 h-0.5 w-8 rounded-t-full bg-emerald-600 dark:bg-emerald-400" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
