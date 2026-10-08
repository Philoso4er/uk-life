import { LocalTransport } from './local';
import type { Transport } from './types';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const hasRealtime = () => !!(SUPABASE_URL && SUPABASE_KEY);

export async function createTransport(): Promise<Transport> {
  if (hasRealtime()) {
    const { SupabaseTransport } = await import('./supabase');
    return new SupabaseTransport(SUPABASE_URL!, SUPABASE_KEY!);
  }
  return new LocalTransport();
}
