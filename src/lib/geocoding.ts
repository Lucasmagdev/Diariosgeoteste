import { supabase } from './supabaseClient';

export interface GeocodeResult {
  cidade: string | null;
  uf: string | null;
  lat: number;
  lon: number;
  displayName: string | null;
}

export const geocodeEndereco = async (endereco: string): Promise<GeocodeResult | null> => {
  if (!endereco.trim()) return null;
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) return null;

  try {
    const response = await fetch('/.netlify/functions/geocode-endereco', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ endereco }),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
};
