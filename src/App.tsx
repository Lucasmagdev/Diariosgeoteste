import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { LoginPage } from './components/LoginPage';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { DiariesList } from './components/DiariesList';
import { NewDiary } from './components/NewDiary';
import { ClientsManagement } from './components/ClientsManagement';
import { UsersManagement } from './components/UsersManagement';
import { ProfilePage } from './components/ProfilePage';
import { AgentAssistant } from './components/AgentAssistant';
import { DiaryHelp } from './components/DiaryHelp';
import { SplashScreen } from './components/SplashScreen';
import { InstallPWA } from './components/InstallPWA';
import { useIsPWA } from './hooks/useIsPWA';
import { EquipmentMap } from './components/EquipmentMap';
import { PublicDiarySignature } from './components/PublicDiarySignature';
import { PublicChecklistFill } from './components/PublicChecklistFill';
import { PublicSurveyFill } from './components/PublicSurveyFill';
import { PortalManagement } from './components/PortalManagement';
import { ClientPortal } from './components/ClientPortal';
import { IntroScreen } from './components/IntroScreen';

const INTRO_KEY = 'geoteste-admin-intro-seen';

const AppContent: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [editDiaryId, setEditDiaryId] = useState<string | null>(null);
  const [showSplash, setShowSplash] = useState(true);
  const isPWA = useIsPWA();
  const signatureToken = useMemo(
    () => new URLSearchParams(window.location.search).get('assinar')?.trim() || '',
    []
  );
  const isPublicSignaturePage = Boolean(signatureToken);
  const checklistPublicToken = useMemo(
    () => new URLSearchParams(window.location.search).get('checklist_pub')?.trim() || '',
    []
  );
  const isPublicChecklistPage = Boolean(checklistPublicToken);
  const surveyPublicToken = useMemo(
    () => new URLSearchParams(window.location.search).get('pesquisa_pub')?.trim() || '',
    []
  );
  const isPublicSurveyPage = Boolean(surveyPublicToken);
  const isClientPortalPage = useMemo(
    () => new URLSearchParams(window.location.search).get('portal') != null,
    []
  );

  // Intro cinematográfica: apenas na área admin (interna), uma vez por sessão.
  // ?introPreview=1 força replay.
  const isAdminArea = !isClientPortalPage && !isPublicSignaturePage && !isPublicChecklistPage && !isPublicSurveyPage;
  const [showIntro, setShowIntro] = useState(() => {
    if (!isAdminArea) return false;
    const forceIntro = new URLSearchParams(window.location.search).get('introPreview') === '1';
    const alreadySeen = sessionStorage.getItem(INTRO_KEY) === '1';
    return forceIntro || !alreadySeen;
  });

  const handleIntroDone = useCallback(() => {
    sessionStorage.setItem(INTRO_KEY, '1');
    setShowIntro(false);
  }, []);

  // Mostrar splash screen apenas na primeira vez e se for PWA ou mobile
  useEffect(() => {
    if (isPublicSignaturePage || isClientPortalPage || isPublicChecklistPage || isPublicSurveyPage) {
      setShowSplash(false);
      return;
    }

    const hasShownSplash = sessionStorage.getItem('hasShownSplash');
    const isMobile = window.innerWidth < 768;
    
    if (hasShownSplash || (!isPWA && !isMobile)) {
      setShowSplash(false);
    } else {
      sessionStorage.setItem('hasShownSplash', 'true');
      const timer = setTimeout(() => {
        setShowSplash(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isPWA, isPublicSignaturePage]);

  if (isClientPortalPage) {
    return <ClientPortal />;
  }

  if (isPublicSignaturePage) {
    return <PublicDiarySignature token={signatureToken} />;
  }

  if (isPublicChecklistPage) {
    return <PublicChecklistFill token={checklistPublicToken} />;
  }

  if (isPublicSurveyPage) {
    return <PublicSurveyFill token={surveyPublicToken} />;
  }

  if (showIntro) {
    return <IntroScreen onDone={handleIntroDone} />;
  }

  if (showSplash) {
    return <SplashScreen />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onPageChange={setCurrentPage} />;
      case 'diaries':
        return (
          <DiariesList
            onNewDiary={() => setCurrentPage('new-diary')}
            onEditDiary={(diaryId) => { setEditDiaryId(diaryId); setCurrentPage('new-diary'); }}
          />
        );
      case 'new-diary':
        return (
          <NewDiary
            editDiaryId={editDiaryId}
            onBack={() => { setEditDiaryId(null); setCurrentPage('diaries'); }}
          />
        );
      case 'clients':
        return user.role === 'admin' ? <ClientsManagement /> : <Dashboard onPageChange={setCurrentPage} />;
      case 'users':
        return <UsersManagement />;
      case 'equipment':
        return user.role === 'admin' ? <EquipmentMap /> : <Dashboard onPageChange={setCurrentPage} />;
      case 'portal':
        return user.role === 'admin' ? <PortalManagement /> : <Dashboard onPageChange={setCurrentPage} />;
      case 'profile':
        return <ProfilePage />;
      default:
        return <Dashboard onPageChange={setCurrentPage} />;
    }
  };

  return (
    <Layout currentPage={currentPage} onPageChange={setCurrentPage}>
      {renderPage()}
      {currentPage === 'new-diary' ? <DiaryHelp /> : <AgentAssistant />}
      <InstallPWA />
    </Layout>
  );
};

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
