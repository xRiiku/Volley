import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);

  mode: 'login' | 'register' = 'login';
  message = '';
  loading = false;

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  toggleMode() {
    this.mode = this.mode === 'login' ? 'register' : 'login';
    this.message = '';
  }

  async submit() {
    if (this.form.invalid || this.loading) return;
    this.message = '';
    this.loading = true;

    const { email, password } = this.form.getRawValue();

    try {
      if (this.mode === 'login') {
        await this.auth.signIn(email, password);
        this.message = '';
      } else {
        await this.auth.signUp(email, password);
        this.message =
          'Revisa tu correo para confirmar la cuenta (según la configuración de Supabase).';
      }
    } catch (err: any) {
      console.error(err);
      this.message = err?.message ?? 'Error al procesar la petición.';
    } finally {
      this.loading = false;
    }
  }

  async sendReset() {
    if (this.form.controls.email.invalid || this.loading) {
      this.message = 'Introduce un email válido para recuperar la contraseña.';
      return;
    }

    this.loading = true;
    this.message = '';
    const email = this.form.controls.email.value;

    try {
      await this.auth.resetPassword(email);
      this.message = 'Te hemos enviado un email para restablecer la contraseña.';
    } catch (err: any) {
      console.error(err);
      this.message = err?.message ?? 'No se ha podido enviar el email.';
    } finally {
      this.loading = false;
    }
  }
}
