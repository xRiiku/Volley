import { createClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environments';

export const supabase = createClient(
  environment.supabaseUrl,
  environment.supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'volley-auth', // clave fija para evitar inconsistencias
    },
  }
);
