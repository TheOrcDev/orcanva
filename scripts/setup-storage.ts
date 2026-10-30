// One-time Neon Object Storage setup: CORS for browser uploads + smoke test.
// Usage: pnpm storage:setup [origin ...]   (default: any origin)
//
// Any origin is safe here: uploads only work with a short-lived presigned
// URL the app hands out, and the bucket itself stays private.
import {
  DeleteObjectCommand,
  GetBucketCorsCommand,
  GetObjectCommand,
  PutBucketCorsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is missing; add it to .env.local`);
  }
  return value;
};

const log = (message: string) => {
  process.stdout.write(`${message}\n`);
};

const ANY_ORIGIN = "*";
// Checked in the smoke test; any dev port should be allowed
const PREFLIGHT_ORIGIN = "http://localhost:3001";

const main = async () => {
  const bucket = required("STORAGE_BUCKET");
  const client = new S3Client({
    credentials: {
      accessKeyId: required("AWS_ACCESS_KEY_ID"),
      secretAccessKey: required("AWS_SECRET_ACCESS_KEY"),
    },
    endpoint: required("AWS_ENDPOINT_URL_S3"),
    forcePathStyle: true,
    region: required("AWS_REGION"),
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });

  const requested = process.argv.slice(2);
  const origins = requested.length > 0 ? requested : [ANY_ORIGIN];

  await client.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedHeaders: ["*"],
            AllowedMethods: ["PUT", "GET", "HEAD"],
            AllowedOrigins: origins,
            ExposeHeaders: ["ETag"],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    })
  );
  const cors = await client.send(new GetBucketCorsCommand({ Bucket: bucket }));
  log(`✓ CORS rules set for: ${origins.join(", ")}`);
  log(`  ${JSON.stringify(cors.CORSRules)}`);

  // Smoke test the exact browser flow: presigned PUT with a Content-Type
  const key = `smoke-test/${Date.now()}.txt`;
  const body = "orcanva storage smoke test";
  const url = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucket,
      ContentType: "text/plain",
      Key: key,
    }),
    { expiresIn: 60 }
  );

  const origin = origins.includes(ANY_ORIGIN) ? PREFLIGHT_ORIGIN : origins[0];
  const preflight = await fetch(url, {
    headers: {
      "Access-Control-Request-Headers": "content-type",
      "Access-Control-Request-Method": "PUT",
      Origin: origin,
    },
    method: "OPTIONS",
  });
  const allowOrigin = preflight.headers.get("access-control-allow-origin");
  log(
    `${allowOrigin ? "✓" : "✗"} Preflight ${preflight.status}, allow-origin: ${allowOrigin ?? "(none)"}`
  );

  const put = await fetch(url, {
    body,
    headers: { "Content-Type": "text/plain", Origin: origin },
    method: "PUT",
  });
  if (!put.ok) {
    throw new Error(`Presigned PUT failed: ${put.status} ${await put.text()}`);
  }
  log(`✓ Presigned PUT ${put.status}`);

  const get = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key })
  );
  const roundTrip = await get.Body?.transformToString();
  if (roundTrip !== body) {
    throw new Error(`Read back mismatch: ${roundTrip}`);
  }
  log(`✓ GetObject returned the uploaded body (${get.ContentType})`);

  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  log("✓ Deleted smoke-test object");
};

try {
  await main();
} catch (error) {
  process.stderr.write(
    `✗ ${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exitCode = 1;
}
