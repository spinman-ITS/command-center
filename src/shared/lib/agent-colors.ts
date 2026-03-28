export const AGENT_COLORS = {
  atlas: "#4dd4ac",
  nova: "#8ea4ff",
  iris: "#ff8d73",
  echo: "#ffd166",
  pulse: "#5dd8ff",
  vector: "#c998ff",
} as const;

export function getAgentColor(color: string | null | undefined) {
  return color ?? "#4dd4ac";
}
