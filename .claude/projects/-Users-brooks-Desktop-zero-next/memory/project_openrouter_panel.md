---
name: OpenRouter free-tier panel
description: Planned feature to integrate OpenRouter free LLM models into the site for interactive experiences and AI-driven content/analysis
type: project
---

Brooks wants to add a panel/experience that uses OpenRouter's free-tier LLM models via the `OPENROUTER_API_KEY` env var (already set in `.env.local`).

**Goals:**
- Craft interactive experiences powered by free LLM allowances
- AI-written analysis of the site itself
- Build AI into the messaging experience and outputs

**Why:** Adds AI-powered interactivity at zero cost using OpenRouter's free model tier — fits the "games and tools" brand and increases dwell time.

**How to apply:** When building AI features on the site, use OpenRouter as the provider. The API key is a free-tier routing key (not sensitive). Server-side API route should call OpenRouter and stream responses to the client.
