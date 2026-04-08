export interface SecretProvider {
  getSecret(key: string): Promise<string | null>;
}

export class EnvSecretProvider implements SecretProvider {
  constructor(private env: Record<string, string | undefined> = process.env) {}

  async getSecret(key: string): Promise<string | null> {
    return this.env[key] || null;
  }
}
