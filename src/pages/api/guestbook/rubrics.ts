import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "src/lib/db";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rubrics = await sql`
    SELECT r.id, r.name, r.description,
      COALESCE(
        json_agg(
          json_build_object(
            'id', e.id,
            'name', e.name,
            'description', e.description,
            'contributor', u.username
          ) ORDER BY e.name
        ) FILTER (WHERE e.id IS NOT NULL),
        '[]'
      ) AS elements
    FROM rubrics r
    LEFT JOIN elements e ON e.rubric_id = r.id
    LEFT JOIN users u ON u.id = e.user_id
    GROUP BY r.id, r.name, r.description
    ORDER BY r.id
  `;

  res.status(200).json(rubrics);
}
