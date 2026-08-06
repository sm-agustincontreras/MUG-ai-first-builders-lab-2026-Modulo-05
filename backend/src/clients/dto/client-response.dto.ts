export interface ClientEntityLike {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
}

/**
 * Shape returned by any endpoint that exposes a `Client` (creation, listing).
 * Deliberately excludes `nameNormalized` — the mapper only ever reads the
 * four whitelisted fields off the source entity, so there is no field to
 * accidentally leak (same pattern as `UserResponseDto` excludes
 * `passwordHash`/`refreshTokenHash`).
 */
export class ClientResponseDto {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly createdAt: Date;

  private constructor(id: string, name: string, description: string, createdAt: Date) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.createdAt = createdAt;
  }

  static fromEntity(client: ClientEntityLike): ClientResponseDto {
    return new ClientResponseDto(client.id, client.name, client.description, client.createdAt);
  }
}
