import type { ObjectStoragePort } from '../ports';
import type { AuthConfig } from '../ports';

export class InMemoryStorageAdapter implements ObjectStoragePort {
  private store = new Map<string, Buffer>();
  constructor(private readonly config: Pick<AuthConfig, 's3Bucket' | 's3Region'>) {}

  async upload(key: string, body: Buffer, _contentType: string): Promise<{ url: string }> {
    this.store.set(key, body);
    const url = `https://${this.config.s3Bucket}.s3.${this.config.s3Region}.amazonaws.com/${key}`;
    return { url };
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  // test helpers
  has(key: string) {
    return this.store.has(key);
  }

  clear() {
    this.store.clear();
  }
}
