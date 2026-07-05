import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";
import { isValidAdminKey } from "src/lib/adminAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const characters = await sql`
      SELECT id, name, one_liner, profile, model, color, avatar_emoji, created_at, updated_at
      FROM characters
      ORDER BY created_at DESC
    `;
    return res.status(200).json(characters);
  }

  if (req.method === "POST" || req.method === "PUT" || req.method === "DELETE") {
    if (!isValidAdminKey(req)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  if (req.method === "POST") {
    const { name, one_liner, profile, model, color, avatar_emoji } = req.body;

    if (!name?.trim() || !one_liner?.trim() || !profile?.trim() || !model?.trim()) {
      return res.status(400).json({ error: "name, one_liner, profile, and model are required" });
    }

    const character = (
      await sql`
        INSERT INTO characters (name, one_liner, profile, model, color, avatar_emoji)
        VALUES (${name.trim()}, ${one_liner.trim()}, ${profile.trim()}, ${model.trim()}, ${color}, ${avatar_emoji})
        RETURNING id, name, one_liner, profile, model, color, avatar_emoji, created_at, updated_at
      `
    )[0];

    return res.status(201).json(character);
  }

  if (req.method === "DELETE") {
    const { id } = req.query;
    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "id query parameter is required" });
    }

    await sql`DELETE FROM characters WHERE id = ${id}`;
    return res.status(200).json({ success: true });
  }

  if (req.method === "PUT") {
    const { id, profile } = req.body;
    if (!id || !profile?.trim()) {
      return res.status(400).json({ error: "id and profile are required" });
    }

    const updated = (
      await sql`
        UPDATE characters SET profile = ${profile.trim()}, updated_at = now()
        WHERE id = ${id}
        RETURNING id, name, one_liner, profile, model, color, avatar_emoji, created_at, updated_at
      `
    )[0];

    if (!updated) return res.status(404).json({ error: "Character not found" });
    return res.status(200).json(updated);
  }

  return res.status(405).json({ error: "Method not allowed" });
}
