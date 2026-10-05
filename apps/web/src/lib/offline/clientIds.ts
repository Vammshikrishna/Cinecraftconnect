/**
 * Utility for generating and tracking temporary client-side IDs
 * for optimistic UI entities before the server assigns a real UUID.
 */
export class ClientIdManager {
  private static PREFIX = 'client_';

  /**
   * Generates a temporary ID.
   */
  public static generate(): string {
    return `${this.PREFIX}${crypto.randomUUID()}`;
  }

  /**
   * Checks if a given ID is a temporary client ID.
   */
  public static isClientId(id: string): boolean {
    return id.startsWith(this.PREFIX);
  }
}
