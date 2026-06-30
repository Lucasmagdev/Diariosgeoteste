import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const InstallPWA: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);

      if (!localStorage.getItem('pwa-install-declined')) {
        window.setTimeout(() => setShowInstallPrompt(true), 3000);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    localStorage.setItem('pwa-install-declined', 'true');
  };

  if (!showInstallPrompt) return null;

  return (
    <div className="fixed bottom-20 left-3 right-3 z-50 animate-slide-in md:hidden">
      <div className="flex items-center gap-3 rounded-xl border border-emerald-400/30 bg-gray-900 p-3 pr-10 text-white shadow-xl">
        <button
          onClick={handleDismiss}
          className="absolute right-2 top-2 rounded-lg p-1 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Fechar convite de instalação"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
          <Download className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">Instalar Geoteste</h3>
          <p className="truncate text-xs text-gray-400">Acesso rápido e uso offline</p>
        </div>
        <button
          onClick={handleInstall}
          className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-600"
        >
          Instalar
        </button>
      </div>
    </div>
  );
};
