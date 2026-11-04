// Makes an account an admin, who can delete any public design and delete
// images on public designs for everyone (lib/auth/admin.ts). It's Neon
// Auth's own admin role, so the account can also use Neon Auth's admin API
// (list, ban and remove users). --revoke makes it a plain user again.
// Usage: pnpm make-admin <email> [--revoke]
//
// Only verified emails: email sign-ups aren't verified, so an account with
// your address isn't necessarily yours.
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const log = (message: string) => {
  process.stdout.write(`${message}\n`);
};

const main = async () => {
  const email = process.argv[2]?.trim().toLowerCase();
  const revoke = process.argv.includes("--revoke");
  const url = process.env.DATABASE_URL;
  if (!email || email.startsWith("--")) {
    throw new Error("Usage: pnpm make-admin <email> [--revoke]");
  }
  if (!url) {
    throw new Error("DATABASE_URL is missing; add it to .env.local");
  }

  const sql = neon(url);
  const [user] = await sql`
    SELECT id, name, "emailVerified" AS verified
    FROM neon_auth."user" WHERE lower(email) = ${email}
  `;
  if (!user) {
    throw new Error(`No account for ${email}; sign up with it first`);
  }
  if (!user.verified) {
    throw new Error(
      `${email} isn't verified; sign in with Google with it, or verify it first`
    );
  }

  const role = revoke ? "user" : "admin";
  await sql`UPDATE neon_auth."user" SET role = ${role} WHERE id = ${user.id}`;
  log(
    revoke
      ? `${user.name} (${email}) is no longer an admin`
      : `${user.name} (${email}) is an admin`
  );
};

try {
  await main();
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exitCode = 1;
}
