import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "GET") {
    const pages = await sql`
      SELECT p.id, p.title, p.prompt_text, p.generated_story,
             p.font_family, p.is_public, p.created_at,
             u.username,
             COALESCE(
               json_agg(
                 json_build_object(
                   'rubric', r.name,
                   'element', e.name,
                   'contributor', eu.username
                 ) ORDER BY r.id
               ) FILTER (WHERE e.id IS NOT NULL),
               '[]'
             ) AS selections
      FROM pages p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN page_elements pe ON pe.page_id = p.id
      LEFT JOIN elements e ON e.id = pe.element_id
      LEFT JOIN rubrics r ON r.id = e.rubric_id
      LEFT JOIN users eu ON eu.id = e.user_id
      WHERE p.is_public = true
      GROUP BY p.id, p.title, p.prompt_text, p.generated_story,
               p.font_family, p.is_public, p.created_at, u.username
      ORDER BY p.created_at DESC
      LIMIT 50
    `;
    return res.status(200).json(pages);
  }

  if (req.method === "POST") {
    const { title, username, font_family, element_ids } = req.body;

    if (!title || !username || !element_ids?.length) {
      return res.status(400).json({
        error: "title, username, and at least one element selection are required",
      });
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

    // Fetch selected elements to build prompt
    const elements = await sql`
      SELECT e.name AS element_name, r.name AS rubric_name
      FROM elements e
      JOIN rubrics r ON r.id = e.rubric_id
      WHERE e.id = ANY(${element_ids})
      ORDER BY r.id
    `;

    const promptParts = elements.map(
      (e) => `${e.rubric_name}: ${e.element_name}`
    );
    const promptText = `Write a short story with the following ingredients:\n${promptParts.join("\n")}`;

    // Create page
    const page = (await sql`
      INSERT INTO pages (title, prompt_text, font_family, user_id)
      VALUES (${title}, ${promptText}, ${font_family || "Inter"}, ${user.id})
      RETURNING id, title, prompt_text, font_family, created_at
    `)[0];

    // Link elements
    for (const elementId of element_ids) {
      await sql`
        INSERT INTO page_elements (page_id, element_id)
        VALUES (${page.id}, ${elementId})
        ON CONFLICT DO NOTHING
      `;
    }

    return res.status(201).json({ ...page, username, selections: elements });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
