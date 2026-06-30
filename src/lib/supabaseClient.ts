import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.toString().trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.toString().trim();

// Debug: verificar se as variáveis estão sendo carregadas
console.log('🔧 Debug Supabase Client:');
console.log('VITE_SUPABASE_URL:', supabaseUrl);
console.log('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'Presente' : 'Ausente');
console.log('isSupabaseConfigured:', Boolean(supabaseUrl && supabaseAnonKey));

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
  : (null as unknown as ReturnType<typeof createClient>);

// Client isolado (sem persistir sessão) para o admin criar usuários via signUp
// sem que a sessão do admin atual seja substituída pela do novo usuário.
export const createIsolatedAuthClient = () =>
  isSupabaseConfigured
    ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          storageKey: 'sb-admin-create-temp',
        },
      })
    : (null as unknown as ReturnType<typeof createClient>);


