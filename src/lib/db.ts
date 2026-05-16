import { neon } from "@neondatabase/serverless";

if (!process.env.POSTGRES_URL) {
  throw new Error("POSTGRES_URL is not configured");
}

const sql = neon(process.env.POSTGRES_URL);

export { sql };
