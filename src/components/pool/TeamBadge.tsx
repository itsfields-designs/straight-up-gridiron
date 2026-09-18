import { teamInfo } from "@/lib/teams";

export function TeamBadge({ name, size = 34 }: { name: string; size?: number }) {
  const { abbr, color } = teamInfo(name);
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center rounded-full font-display font-semibold text-white"
      style={{
        background: color,
        width: size,
        height: size,
        fontSize: Math.max(10, size * 0.32),
        letterSpacing: "0.02em",
      }}
    >
      {abbr}
    </span>
  );
}
