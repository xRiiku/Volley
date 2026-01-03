import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { supabase } from '../supabase/supabase-client';
import type { Session, User } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private _session$ = new BehaviorSubject<Session | null>(null);
  private _user$ = new BehaviorSubject<User | null>(null);
  readonly session$ = this._session$.asObservable();
  readonly user$ = this._user$.asObservable();

  constructor() {
    this.init();
  }

  private async init() {
    // Sesión actual
    const { data } = await supabase.auth.getSession();
    this._session$.next(data.session ?? null);
    this._user$.next(data.session?.user ?? null);

    // Suscripción a cambios de auth
    supabase.auth.onAuthStateChange((_event, session) => {
      this._session$.next(session);
      this._user$.next(session?.user ?? null);
    });
  }

  // ================== LOGIN / LOGOUT ==================

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    this._session$.next(data.session);
    this._user$.next(data.session?.user ?? null);
    return data.session;
  }

  async signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) throw error;
    // Supabase puede requerir verificar email; aun así guardamos la sesión si existe
    this._session$.next(data.session ?? null);
    this._user$.next(data.user ?? null);
    return data;
  }

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    this._session$.next(null);
    this._user$.next(null);
  }

  // ================== PASSWORD ==================

  /** Cambiar contraseña estando logueado */
  async updatePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) throw error;
  }

  /** Enviar email de recuperación de contraseña */
  async resetPassword(email: string) {
    const redirectTo = `${window.location.origin}/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) throw error;
  }

}
