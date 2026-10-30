import "server-only";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  NotFound,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { GetObjectCommandOutput } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { getEnv } from "@/lib/env";

let client: S3Client | undefined;

const getClient = (): S3Client => {
  const env = getEnv();
  client ??= new S3Client({
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
    endpoint: env.AWS_ENDPOINT_URL_S3,
    // Neon Object Storage only supports path-style addressing
    forcePathStyle: true,
    region: env.AWS_REGION,
    // Newer SDKs otherwise sign an empty-body checksum into presigned PUTs
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return client;
};

const bucket = () => getEnv().STORAGE_BUCKET;

export const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

export const createPresignedPut = (
  key: string,
  contentType: string,
  expiresInSeconds = 300
): Promise<string> =>
  getSignedUrl(
    getClient(),
    new PutObjectCommand({
      Bucket: bucket(),
      CacheControl: IMMUTABLE_CACHE_CONTROL,
      ContentType: contentType,
      Key: key,
    }),
    { expiresIn: expiresInSeconds }
  );

export const headObject = async (
  key: string
): Promise<{ size: number; contentType: string | undefined } | null> => {
  try {
    const result = await getClient().send(
      new HeadObjectCommand({ Bucket: bucket(), Key: key })
    );
    return { contentType: result.ContentType, size: result.ContentLength ?? 0 };
  } catch (error) {
    if (
      error instanceof NotFound ||
      (error instanceof Error && error.name === "NotFound")
    ) {
      return null;
    }
    throw error;
  }
};

export const getObject = (key: string): Promise<GetObjectCommandOutput> =>
  getClient().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));

export const putObject = async (
  key: string,
  body: Uint8Array,
  contentType: string
): Promise<void> => {
  await getClient().send(
    new PutObjectCommand({
      Body: body,
      Bucket: bucket(),
      CacheControl: IMMUTABLE_CACHE_CONTROL,
      ContentType: contentType,
      Key: key,
    })
  );
};

export const copyObject = async (
  sourceKey: string,
  targetKey: string
): Promise<void> => {
  await getClient().send(
    new CopyObjectCommand({
      Bucket: bucket(),
      CopySource: `${bucket()}/${sourceKey}`,
      Key: targetKey,
    })
  );
};

export const deleteObject = async (key: string): Promise<void> => {
  await getClient().send(
    new DeleteObjectCommand({ Bucket: bucket(), Key: key })
  );
};
