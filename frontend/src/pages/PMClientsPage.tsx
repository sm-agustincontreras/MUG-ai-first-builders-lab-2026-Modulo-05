import { useEffect, useState, type FormEvent } from 'react';
import { z } from 'zod';
import { useAuth } from '../hooks/use-auth';
import { createClient, listClients } from '../services/clients.service';
import type { Client } from '../services/clients.service';
import './PMClientsPage.css';

// Espejo de `backend/src/clients/dto/create-client.dto.ts`: feedback
// inmediato de UX, nunca reemplaza la validación autoritativa del servidor.
const createClientSchema = z.object({
  name: z.string().min(1, 'Ingresá un nombre').max(30, 'Máximo 30 caracteres'),
  description: z.string().min(1, 'Ingresá una descripción').max(255, 'Máximo 255 caracteres'),
});

export function PMClientsPage() {
  const { user, accessToken } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);

  useEffect(() => {
    // La segunda capa de defensa de más abajo también bloquea el render para
    // roles no-PM, pero evitamos además la llamada de red innecesaria acá.
    if (user?.role !== 'PM') {
      setIsLoadingClients(false);
      return;
    }

    let active = true;
    setIsLoadingClients(true);
    listClients(accessToken ?? '')
      .then((result) => {
        if (!active) return;
        setClients(result);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        // Nunca se traga el error de la API — se muestra en pantalla, y el
        // listado queda vacío en vez de romper la página.
        setError(err instanceof Error ? err.message : 'No se pudo cargar el listado de clientes');
        setClients([]);
      })
      .finally(() => {
        if (!active) return;
        setIsLoadingClients(false);
      });

    return () => {
      active = false;
    };
  }, [user, accessToken]);

  // Segunda capa de defensa además de `ProtectedRoute`: esta página nunca se
  // renderiza para alguien que no sea PM (per spec).
  if (user?.role !== 'PM') {
    return <p role="alert">No tenés permiso para acceder a esta página.</p>;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const parsed = createClientSchema.safeParse({ name, description });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Datos inválidos');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await createClient(accessToken ?? '', parsed.data);
      // El listado está ordenado por `createdAt` ascendente (Block 1); un
      // cliente recién creado siempre es el más nuevo, por eso se agrega al
      // final.
      setClients((previous) => [...previous, created]);
      setSuccessMessage(`Cliente ${created.name} creado.`);
      setName('');
      setDescription('');
    } catch (err) {
      // Nunca se traga el error de la API — se muestra en pantalla (p. ej.
      // 409 nombre duplicado / AC-03) y el formulario conserva lo tipeado.
      setError(err instanceof Error ? err.message : 'No se pudo crear el cliente');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="pm-clients-page">
      <h1>Clientes</h1>
      <form onSubmit={handleSubmit} noValidate className="pm-clients-page__form">
        <div className="pm-clients-page__field">
          <label htmlFor="client-name">Nombre</label>
          <input
            id="client-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="pm-clients-page__field">
          <label htmlFor="client-description">Descripción</label>
          <textarea
            id="client-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <button type="submit" disabled={isSubmitting}>
          Crear cliente
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {successMessage && <p role="status">{successMessage}</p>}

      <h2>Clientes existentes</h2>
      {isLoadingClients ? (
        <p>Cargando clientes...</p>
      ) : clients.length === 0 ? (
        <p>No hay clientes cargados todavía.</p>
      ) : (
        <ul className="pm-clients-page__list">
          {clients.map((client) => (
            <li key={client.id} className="pm-clients-page__list-item">
              <strong>{client.name}</strong>
              <span>{client.description}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
