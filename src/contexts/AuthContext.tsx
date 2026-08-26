import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthContextType, User } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock users for demo (persistidos em localStorage)
const defaultUsers: User[] = [
  {
    id: '1',
    name: 'Admin Geoteste',
    email: 'admin@geoteste.com',
    role: 'admin',
    createdAt: '2025-01-01'
  },
  {
    id: '2',
    name: 'João Silva',
    email: 'joao@geoteste.com',
    role: 'user',
    createdAt: '2025-01-02'
  }
];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      console.log('🔄 Inicializando AuthContext (modo local)');
      // Carregar lista de usuários do storage (com defaults se vazio)
      const storedUsers = localStorage.getItem('users');
      if (storedUsers) {
        try {
          setUsers(JSON.parse(storedUsers));
        } catch {
          setUsers(defaultUsers);
          localStorage.setItem('users', JSON.stringify(defaultUsers));
        }
      } else {
        setUsers(defaultUsers);
        localStorage.setItem('users', JSON.stringify(defaultUsers));
      }
      // Restaurar currentUser
      const storedCurrent = localStorage.getItem('currentUser');
      console.log('🔍 Verificando currentUser no localStorage:', storedCurrent ? 'Encontrado' : 'Não encontrado');
      if (storedCurrent) {
        try {
          const parsedUser = JSON.parse(storedCurrent);
          console.log('👤 Restaurando usuário:', parsedUser.email);
          setUser(parsedUser);
        } catch {
          console.error('❌ Erro ao parsear currentUser');
        }
      } else {
        console.log('🔓 Nenhum usuário logado - mostrando tela de login');
      }
      setIsLoading(false);
      return;
    }

    // Supabase: recuperar sessão e escutar mudanças
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Map básico para nosso tipo User
        const profile = await supabase.from('profiles').select('name, role, created_at, photo_url, phone, collaborator_role, collaborator_status').eq('id', session.user.id).single();
        setUser({
          id: session.user.id,
          name: profile.data?.name || session.user.email || 'Usuário',
          email: session.user.email || '',
          role: (profile.data?.role as 'admin' | 'user') || 'user',
          createdAt: profile.data?.created_at || new Date().toISOString(),
          photoUrl: profile.data?.photo_url || null,
          phone: profile.data?.phone || null,
          collaboratorRole: profile.data?.collaborator_role || null,
          collaboratorStatus: profile.data?.collaborator_status || null,
        });
      } else {
        setUser(null);
      }
      setIsLoading(false);
    };
    init();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setUser(null);
        return;
      }
      (async () => {
        const profile = await supabase.from('profiles').select('name, role, created_at, photo_url, phone, collaborator_role, collaborator_status').eq('id', session.user!.id).single();
        setUser({
          id: session.user!.id,
          name: profile.data?.name || session.user!.email || 'Usuário',
          email: session.user!.email || '',
          role: (profile.data?.role as 'admin' | 'user') || 'user',
          createdAt: profile.data?.created_at || new Date().toISOString(),
          photoUrl: profile.data?.photo_url || null,
          phone: profile.data?.phone || null,
          collaboratorRole: profile.data?.collaborator_role || null,
          collaboratorStatus: profile.data?.collaborator_status || null,
        });
      })();
    });

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<{ ok: boolean; code?: string; message?: string }> => {
    setIsLoading(true);
    if (!isSupabaseConfigured) {
      // Recarregar usuários do localStorage para garantir dados atualizados
      const storedUsers = localStorage.getItem('users');
      let currentUsers = users;
      if (storedUsers) {
        try {
          currentUsers = JSON.parse(storedUsers);
        } catch {
          currentUsers = defaultUsers;
          localStorage.setItem('users', JSON.stringify(defaultUsers));
        }
      } else {
        currentUsers = defaultUsers;
        localStorage.setItem('users', JSON.stringify(defaultUsers));
      }

      // Normalizar email para comparação (trim e lowercase)
      const normalizedEmail = email.trim().toLowerCase();
      console.log('Tentando login com email:', normalizedEmail);
      console.log('Usuários disponíveis:', currentUsers.map(u => u.email.toLowerCase()));
      
      const foundUser = currentUsers.find(u => u.email.trim().toLowerCase() === normalizedEmail);
      if (!foundUser) {
        console.error('Usuário não encontrado. Email buscado:', normalizedEmail);
        setIsLoading(false);
        return { ok: false, code: 'user_not_found', message: 'Email não encontrado' };
      }
      if (password !== '123456') {
        setIsLoading(false);
        return { ok: false, code: 'invalid_credentials', message: 'Senha incorreta' };
      }
      setUser(foundUser);
      localStorage.setItem('currentUser', JSON.stringify(foundUser));
      setIsLoading(false);
      return { ok: true };
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setIsLoading(false);
    if (!error) {
      return { ok: true };
    }

    // Mapear códigos de erro comuns do Supabase
    const msg = (error as any)?.message?.toLowerCase?.() || '';
    const status = (error as any)?.status;
    
    console.error('Erro de autenticação Supabase:', { msg, status, error });
    
    if (msg.includes('email not confirmed')) {
      return { ok: false, code: 'email_not_confirmed', message: 'E-mail não confirmado. Verifique sua caixa de entrada.' };
    }
    if (msg.includes('user not found')) {
      return { ok: false, code: 'user_not_found', message: 'Usuário não encontrado. Crie uma conta primeiro.' };
    }
    // Erro 400 geralmente significa credenciais inválidas
    if (status === 400 || msg.includes('invalid login credentials') || msg.includes('invalid')) {
      return {
        ok: false,
        code: 'invalid_credentials',
        message: 'Email ou senha incorretos. Se é seu primeiro acesso, crie uma conta primeiro.'
      };
    }
    return { ok: false, code: 'unknown', message: 'Não foi possível fazer login. Verifique suas credenciais e tente novamente.' };
  };

  const register: AuthContextType['register'] = async (name, email, password) => {
    // Regras simples de validação
    if (!name.trim() || !email.trim() || !password.trim()) {
      return { ok: false, message: 'Preencha todos os campos' };
    }
    if (!isSupabaseConfigured) {
      const exists = users.some(u => u.email.toLowerCase() === email.toLowerCase());
      if (exists) {
        return { ok: false, message: 'Este email já está cadastrado' };
      }
      // Criar usuário (papel padrão: user)
      const newUser: User = {
        id: Date.now().toString(),
        name: name.trim(),
        email: email.trim(),
        role: 'user',
        createdAt: new Date().toISOString(),
      };
      const nextUsers = [...users, newUser];
      setUsers(nextUsers);
      localStorage.setItem('users', JSON.stringify(nextUsers));
      return { ok: true };
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name.trim(),
          name: name.trim(),
          role: 'user'
        }
      }
    });
    if (error) return { ok: false, message: error.message };
    // Criar profile vinculado ao usuário
    const userId = data.user?.id;
    if (userId) {
      await supabase.from('profiles').upsert({ id: userId, name: name.trim(), email: email.trim(), role: 'user' });
    }
    return { ok: true };
  };

  const logout = () => {
    console.log('🚪 Fazendo logout...');
    if (!isSupabaseConfigured) {
      console.log('📦 Removendo usuário do localStorage');
      localStorage.removeItem('currentUser');
      console.log('✅ currentUser removido:', localStorage.getItem('currentUser'));
      setUser(null);
      console.log('🔄 Forçando reload da página...');
      // Forçar reload completo da página
      window.location.reload();
      return;
    }
    localStorage.clear();
    supabase.auth.signOut().then(() => {
      window.location.reload();
    });
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};