import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { supabase } from '../../core/supabase/supabase-client';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.scss'],
})
export class ResetPasswordComponent {
  loading = true;
  ready = false;
  errorMsg = '';
  successMsg = '';

  form = new FormGroup({
    password: new FormControl('', [Validators.required, Validators.minLength(8)]),
    password2: new FormControl('', [Validators.required, Validators.minLength(8)]),
  });

  constructor(private router: Router) {}

  async ngOnInit() {
    // Importante: Supabase marca el evento como PASSWORD_RECOVERY cuando vienes del link
    supabase.auth.onAuthStateChange((_event) => {
      // no hacemos nada aquí; solo sirve para que supabase procese el callback
    });

    // Esperamos a que supabase procese la URL y cree la sesión temporal
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      this.errorMsg = 'No se pudo validar el enlace de recuperación.';
      this.loading = false;
      return;
    }

    // Si hay sesión, estamos listos para cambiar password
    if (data.session) {
      this.ready = true;
    } else {
      this.errorMsg = 'El enlace de recuperación no es válido o ha caducado.';
    }

    this.loading = false;
  }

  async submit() {
    this.errorMsg = '';
    this.successMsg = '';

    const p1 = this.form.value.password ?? '';
    const p2 = this.form.value.password2 ?? '';

    if (!p1 || !p2) {
      this.errorMsg = 'Rellena la nueva contraseña.';
      return;
    }

    if (p1 !== p2) {
      this.errorMsg = 'Las contraseñas no coinciden.';
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ password: p1 });
      if (error) throw error;

      this.successMsg = 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.';
      // Cerramos sesión para forzar login con la nueva contraseña
      await supabase.auth.signOut();

      // Redirige al login
      setTimeout(() => this.router.navigateByUrl('/login'), 700);
    } catch (e: any) {
      this.errorMsg = e?.message ?? 'No se pudo actualizar la contraseña.';
    }
  }
}
