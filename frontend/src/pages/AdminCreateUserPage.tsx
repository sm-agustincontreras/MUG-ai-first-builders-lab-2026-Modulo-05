import { useState, type FormEvent } from 'react';
import { z } from 'zod';
import { useAuth } from '../hooks/use-auth';
import { createUser } from '../services/users.service';
import type { UserRole } from '../services/users.service';

const ROLE_OPTIONS: UserRole[] = ['ADMIN', 'PM', 'LEADER', 'RESOURCE'];

// Espejo de `backend/src/users/dto/create-user.dto.ts`: feedback inmediato de
// UX, nunca reemplaza la validación autoritativa del servidor.
const createUserSchema = z.object({
  name: z.string().trim().min(1, 'Ingresá un nombre').max(100, 'Máximo 100 caracteres'),
  email: z.string().email('Ingresá un email válido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  role: z.enum(['ADMIN', 'PM', 'LEADER', 'RESOURCE']),
});

export function AdminCreateUserPage() {
  const { user, accessToken, logout } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('RESOURCE');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Segunda capa de defensa además de `ProtectedRoute`: esta página nunca se
  // renderiza para alguien que no sea Admin (per spec).
  if (user?.role !== 'ADMIN') {
    return <p role="alert">No tenés permiso para acceder a esta página.</p>;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const parsed = createUserSchema.safeParse({ name, email, password, role });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Datos inválidos');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await createUser(accessToken ?? '', parsed.data);
      setSuccessMessage(`Usuario ${created.email} creado con rol ${created.role}.`);
      setName('');
      setEmail('');
      setPassword('');
      setRole('RESOURCE');
    } catch (err) {
      // Nunca se traga el error de la API — se muestra en pantalla (NFR-04,
      // p. ej. 409 email duplicado / AC-06).
      setError(err instanceof Error ? err.message : 'No se pudo crear el usuario');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <h1>Alta de usuario</h1>
      <button type="button" onClick={() => void logout()}>
        Cerrar sesión
      </button>
      <form onSubmit={handleSubmit} noValidate>
        <div>
          <label htmlFor="new-user-name">Nombre</label>
          <input
            id="new-user-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="off"
          />
        </div>
        <div>
          <label htmlFor="new-user-email">Email</label>
          <input
            id="new-user-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="off"
          />
        </div>
        <div>
          <label htmlFor="new-user-password">Contraseña</label>
          <input
            id="new-user-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
          />
        </div>
        <div>
          <label htmlFor="new-user-role">Rol</label>
          <select
            id="new-user-role"
            value={role}
            onChange={(event) => setRole(event.target.value as UserRole)}
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" disabled={isSubmitting}>
          Crear usuario
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {successMessage && <p role="status">{successMessage}</p>}
    </div>
  );
}
