import React, { useEffect, useState } from 'react';
import { FileText, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const LoginPage: React.FC = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  
  const { login, register } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    if (isSignUp) {
      if (!name.trim()) {
        setError('Digite seu nome completo');
        setIsLoading(false);
        return;
      }
      if (password.length < 6) {
        setError('A senha deve ter no mínimo 6 caracteres');
        setIsLoading(false);
        return;
      }
      if (password !== confirmPassword) {
        setError('As senhas não são iguais');
        setIsLoading(false);
        return;
      }
      const result = await register(name, email, password);
      if (!result.ok) {
        setError(result.message || 'Não foi possível criar a conta. Tente novamente.');
        setToast({ type: 'error', message: result.message || 'Não foi possível criar a conta. Tente novamente.' });
        setIsLoading(false);
        return;
      }
      setSuccess('Conta criada! Verifique seu e-mail para confirmar o cadastro.');
      setToast({ type: 'success', message: 'Conta criada! Verifique seu e-mail.' });
      setIsSignUp(false);
      setPassword('');
      setConfirmPassword('');
      setIsLoading(false);
      return;
    }

    const result = await login(email, password);
    if (!result.ok) {
      const message = result.message || 'Não foi possível fazer login. Verifique suas credenciais.';
      setError(message);
      setToast({ type: 'error', message });
    } else {
      setError('');
    }
    setIsLoading(false);
  };

  // Auto esconder toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-white dark:from-gray-950 dark:to-gray-900 flex items-center justify-center p-3 sm:p-4">
      {toast && (
        <div
          role="alert"
          className={`fixed top-4 right-4 z-50 max-w-sm rounded-lg border shadow-lg px-4 py-3 ${
            toast.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-200'
              : 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/30 dark:border-green-800 dark:text-green-200'
          }`}
        >
          <p className="text-sm">{toast.message}</p>
        </div>
      )}
      <div className="w-full max-w-md">
        {/* Logo and Company Info */}
        <div className="text-center mb-6 sm:mb-8 animate-fade-in">
          <div className="inline-flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl mb-4">
            <img src="/logogeoteste.png" alt="Geoteste" className="w-full h-full object-contain p-1" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Geoteste</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Sistema de diários de obra</p>

        </div>

        {/* Auth Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 p-5 sm:p-6 md:p-8 animate-scale-in">
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mb-4 sm:mb-6 text-center">
            {isSignUp ? 'Criar Conta' : 'Fazer Login'}
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-600 dark:text-red-300 text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-green-700 dark:text-green-300 text-sm">{success}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {isSignUp && (
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Nome completo
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 input-focus-soft transition-all duration-200"
                  placeholder="Seu nome"
                  required
                />
              </div>
            )}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                inputMode="email"
                autoComplete="email"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 input-focus-soft transition-all duration-200"
                placeholder="seu@email.com"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 input-focus-soft transition-all duration-200 pr-12"
                  placeholder="Sua senha"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-all duration-200 active:scale-95"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {isSignUp && (
              <div>
                <label htmlFor="confirm" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Confirmar senha
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="confirm"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 input-focus-soft transition-all duration-200"
                  placeholder="Repita a senha"
                  required
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full"
            >
              {isLoading ? (isSignUp ? 'Criando...' : 'Entrando...') : (isSignUp ? 'Criar conta' : 'Entrar')}
            </button>
          </form>

          <p className="mt-5 text-center text-xs leading-relaxed text-gray-400 dark:text-gray-500">
            Acesso destinado a usuários autorizados pela Geoteste.<br />
            Novos acessos são criados pelo administrador.
          </p>
        </div>
      </div>
    </div>
  );
};
