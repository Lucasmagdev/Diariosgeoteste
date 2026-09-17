import { supabase } from './supabaseClient';

export type ConnectionState = 'open' | 'close' | 'connecting' | 'not_created' | 'unknown' | 'connected_or_unavailable';

const authedFetch = async (action: string) => {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error('Sua sessão expirou. Entre novamente.');

  const response = await fetch(`/.netlify/functions/evolution-instance?action=${action}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Não foi possível falar com o WhatsApp.');
  return payload;
};

export const fetchConnectionStatus = async (): Promise<ConnectionState> => {
  const payload = await authedFetch('status');
  return payload.state as ConnectionState;
};

export const fetchQrCode = async (): Promise<{ qrcodeBase64: string | null; pairingCode: string | null; state?: ConnectionState }> => {
  const payload = await authedFetch('qrcode');
  return { qrcodeBase64: payload.qrcodeBase64 || null, pairingCode: payload.pairingCode || null, state: payload.state };
};

export const disconnectWhatsapp = async (): Promise<void> => {
  await authedFetch('disconnect');
};
