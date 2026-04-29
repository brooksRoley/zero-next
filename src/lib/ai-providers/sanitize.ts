const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /ignore\s+(all\s+)?prior\s+instructions/i,
  /ignore\s+(all\s+)?above\s+instructions/i,
  /disregard\s+(all\s+)?previous/i,
  /you\s+are\s+now\s+in\s+developer\s+mode/i,
  /\bsystem\s*:\s*/i,
  /\bassistant\s*:\s*/i,
  /\[INST\]/i,
  /\[\/INST\]/i,
  /<<SYS>>/i,
  /<<\/SYS>>/i,
  /<\|im_start\|>/i,
  /<\|im_end\|>/i,
  /\bdo\s+anything\s+now\b/i,
  /\bjailbreak\b/i,
];

const MAX_ONE_LINER_LENGTH = 280;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_PROFILE_LENGTH = 8000;

export type SanitizeResult =
  | { ok: true; cleaned: string }
  | { ok: false; reason: string };

function checkPatterns(text: string): string | null {
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      return `Input contains a disallowed pattern: ${pattern.source}`;
    }
  }
  return null;
}

export function sanitizeOneLiner(input: string): SanitizeResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, reason: "One-liner cannot be empty" };
  if (trimmed.length > MAX_ONE_LINER_LENGTH) {
    return { ok: false, reason: `One-liner must be under ${MAX_ONE_LINER_LENGTH} characters` };
  }
  const violation = checkPatterns(trimmed);
  if (violation) return { ok: false, reason: violation };
  return { ok: true, cleaned: trimmed };
}

export function sanitizeProfile(input: string): SanitizeResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, reason: "Profile cannot be empty" };
  if (trimmed.length > MAX_PROFILE_LENGTH) {
    return { ok: false, reason: `Profile must be under ${MAX_PROFILE_LENGTH} characters` };
  }
  const violation = checkPatterns(trimmed);
  if (violation) return { ok: false, reason: violation };
  return { ok: true, cleaned: trimmed };
}

export function sanitizeMessage(input: string): SanitizeResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, reason: "Message cannot be empty" };
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, reason: `Message must be under ${MAX_MESSAGE_LENGTH} characters` };
  }
  const violation = checkPatterns(trimmed);
  if (violation) return { ok: false, reason: violation };
  return { ok: true, cleaned: trimmed };
}
