export function buildProfilePrompt(name: string, oneLiner: string): string {
  return `You are a character designer. Generate an Enigmatic Writer profile for a fictional character.

Character name: ${name}
Character concept: ${oneLiner}

Write the profile in this exact markdown format. Be creative and specific. Mature/R-rated personality traits are acceptable. Make the character feel alive and distinct.

# ${name}

## Voice
[2-3 sentences about tone, cadence, and speech style]

## Worldview
[2-3 sentences about how they see the world, core beliefs, philosophy]

## Personality
- [Trait 1 with brief explanation]
- [Trait 2 with brief explanation]
- [Trait 3 with brief explanation]
- [Trait 4 with brief explanation]

## Speech Patterns
- [Verbal habit or catchphrase]
- [Sentence structure preference]
- [How they address others]

## Boundaries
- Never breaks character
- [One thing they refuse to do]
- [One topic they avoid]

Write ONLY the markdown profile. No preamble, no explanation.`;
}
