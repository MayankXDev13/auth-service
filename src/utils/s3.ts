import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { env } from "../config/env";

const s3Client = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

export const uploadBuffer = async (
  buffer: Buffer,
  userId: string,
  contentType: string,
  originalName: string
): Promise<string> => {
  // Validate file type
  if (!contentType.startsWith('image/')) {
    throw new Error('Invalid file type: only images allowed');
  }

  // Validate file size
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (buffer.length > maxSize) {
    throw new Error('File too large: max 5MB');
  }

  // Generate unique key
  const extension = contentType.split('/')[1] || 'jpg';
  const sanitizedName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const key = `${env.S3_PROFILE_PICS_PREFIX}${userId}/${sanitizedName}-${Date.now()}.${extension}`;

  // Upload to S3
  await s3Client.send(new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));

  return `https://${env.S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;
};

export const deleteObject = async (key: string): Promise<void> => {
  await s3Client.send(new DeleteObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
  }));
};