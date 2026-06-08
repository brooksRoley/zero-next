import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";
import { createRateLimiter } from "src/lib/rate-limit";

const limiter = createRateLimiter(20, 60 * 60 * 1000); // 20 per hour

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const ip = limiter.getClientIp(req);
  if (limiter.isRateLimited(ip)) {
    return res.status(429).json({ error: "Too many requests. Please try again later." });
  }

  const { rubric_id, name, description, username } = req.body;

  if (!rubric_id || !name || !username) {
    return res.status(400).json({ error: "rubric_id, name, and username are required" });
  }

  // Get or create user
  let user = (await sql`
    SELECT id FROM users WHERE username = ${username}
  `)[0];

  if (!user) {
    user = (await sql`
      INSERT INTO users (username) VALUES (${username}) RETURNING id
    `)[0];
  }

  const element = (await sql`
    INSERT INTO elements (rubric_id, name, description, user_id)
    VALUES (${rubric_id}, ${name}, ${description || null}, ${user.id})
    ON CONFLICT (rubric_id, name) DO NOTHING
    RETURNING id, name, description
  `)[0];

  if (!element) {
    return res.status(409).json({ error: "An element with that name already exists in this rubric" });
  }

  res.status(201).json({ ...element, contributor: username });
}
