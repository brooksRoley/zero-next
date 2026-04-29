const COLORS = [
  "#E57373", // red
  "#64B5F6", // blue
  "#81C784", // green
  "#FFB74D", // orange
  "#BA68C8", // purple
  "#4DD0E1", // cyan
  "#F06292", // pink
  "#AED581", // lime
  "#FFD54F", // amber
  "#7986CB", // indigo
];

const EMOJIS = [
  "\u{1F3AD}", "\u{1F409}", "\u{1F98A}", "\u{1F47B}", "\u{1F916}", "\u{1F9D9}", "\u{1F3AA}", "\u{1F989}", "\u{1F43A}", "\u{1F319}",
  "\u{1F52E}", "\u26A1", "\u{1F3B8}", "\u{1F5E1}\uFE0F", "\u{1F30A}", "\u{1F981}", "\u{1F419}", "\u{1F3A9}", "\u{1F480}", "\u{1F33A}",
];

export function assignColor(existingColors: string[]): string {
  const available = COLORS.filter((c) => !existingColors.includes(c));
  if (available.length > 0) return available[0];
  return COLORS[existingColors.length % COLORS.length];
}

export function assignEmoji(existingEmojis: string[]): string {
  const available = EMOJIS.filter((e) => !existingEmojis.includes(e));
  if (available.length > 0) return available[0];
  return EMOJIS[existingEmojis.length % EMOJIS.length];
}
