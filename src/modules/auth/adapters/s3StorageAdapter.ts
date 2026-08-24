import type { ObjectStoragePort } from '../ports';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

export class S3StorageAdapter implements ObjectStoragePort {
  private client: S3Client;
  constructor(private readonly opts: { region: string; bucket: string; credentials: { accessKeyId: string; secretAccessKey: string } }) {
    this.client = new S3Client({
      region: opts.region,
      credentials: { accessKeyId: opts.credentials.accessKeyId, secretAccessKey: opts.credentials.secretAccessKey },
    });
  }

  async upload(key: string, body: Buffer, contentType: string): Promise<{ url: string }> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.opts.bucket, Key: key, Body: body, ContentType: contentType })
    );
    return { url: `https://${this.opts.bucket}.s3.${this.opts.region}.amazonaws.com/${key}` };
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.opts.bucket, Key: key }));
  }
}
