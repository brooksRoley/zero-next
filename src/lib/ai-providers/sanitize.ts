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
const MAX_NAME_LENGTH = 80;

export type SanitizeResult =
  | { ok: true; cleaned: string }
  | { ok: false; reason: string };

// Every entry point below takes `unknown`, not `string`. These are called
// directly with fields off `req.body`, which is raw parsed JSON — a caller can
// send a number, an array, or an object where a string is declared. Without
// this guard the `.trim()` below throws an uncaught TypeError inside the
// handler (ahead of its try block), turning a bad request into a 500.
function isText(input: unknown): input is string {
  return typeof input === "string";
}

function checkPatterns(text: string): string | null {
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      return `Input contains a disallowed pattern: ${pattern.source}`;
    }
  }
  return null;
}

export function sanitizeOneLiner(input: unknown): SanitizeResult {
  if (!isText(input)) return { ok: false, reason: "One-liner must be text" };
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, reason: "One-liner cannot be empty" };
  if (trimmed.length > MAX_ONE_LINER_LENGTH) {
    return { ok: false, reason: `One-liner must be under ${MAX_ONE_LINER_LENGTH} characters` };
  }
  const violation = checkPatterns(trimmed);
  if (violation) return { ok: false, reason: violation };
  return { ok: true, cleaned: trimmed };
}

export function sanitizeProfile(input: unknown): SanitizeResult {
  if (!isText(input)) return { ok: false, reason: "Profile must be text" };
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, reason: "Profile cannot be empty" };
  if (trimmed.length > MAX_PROFILE_LENGTH) {
    return { ok: false, reason: `Profile must be under ${MAX_PROFILE_LENGTH} characters` };
  }
  const violation = checkPatterns(trimmed);
  if (violation) return { ok: false, reason: violation };
  return { ok: true, cleaned: trimmed };
}

export function sanitizeMessage(input: unknown): SanitizeResult {
  if (!isText(input)) return { ok: false, reason: "Message must be text" };
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, reason: "Message cannot be empty" };
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, reason: `Message must be under ${MAX_MESSAGE_LENGTH} characters` };
  }
  const violation = checkPatterns(trimmed);
  if (violation) return { ok: false, reason: violation };
  return { ok: true, cleaned: trimmed };
}

/**
 * Assistant turns echoed back by the client as conversation history.
 *
 * Type-checked and length-capped like every other field, but deliberately NOT
 * run through the injection blocklist. Assistant content is genuine model
 * output, and the blocklist matches strings a model legitimately produces
 * ("system:", "jailbreak"), so pattern-checking it would 400 working
 * conversations. The privilege boundary is the role allowlist in the gateway —
 * a caller cannot claim the `system` role at all — not this blocklist, which
 * is a speed bump rather than a security control.
 */
export function sanitizeAssistantMessage(input: unknown): SanitizeResult {
  if (!isText(input)) return { ok: false, reason: "Message must be text" };
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, reason: "Message cannot be empty" };
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, reason: `Message must be under ${MAX_MESSAGE_LENGTH} characters` };
  }
  return { ok: true, cleaned: trimmed };
}

/**
 * Character names for /api/tools/generate-profile.
 *
 * Previously the only unguarded field in either LLM route: `name` got a
 * truthiness check and nothing else, then was interpolated into the profile
 * prompt twice while `oneLiner` beside it was capped and pattern-checked. The
 * defended field was the one an attacker would ignore.
 */
export function sanitizeName(input: unknown): SanitizeResult {
  if (!isText(input)) return { ok: false, reason: "Name must be text" };
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, reason: "Name cannot be empty" };
  if (trimmed.length > MAX_NAME_LENGTH) {
    return { ok: false, reason: `Name must be under ${MAX_NAME_LENGTH} characters` };
  }
  const violation = checkPatterns(trimmed);
  if (violation) return { ok: false, reason: violation };
  return { ok: true, cleaned: trimmed };
}
