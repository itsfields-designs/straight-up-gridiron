/**
 * The single invite link members share. It carries the league's invite code
 * and the inviting member behind the scenes, so nobody handles two codes.
 */
const STORE_KEY = "gg_invite";

export type InviteAttribution = { code: string; ref: string };

export function inviteLink(leagueCode: string, referrerUserId: string) {
  const origin = typeof window === "undefined" ? "https://gridirongods.app" : window.location.origin;
  return `${origin}/join/${leagueCode}?ref=${referrerUserId}`;
}

export function rememberInvite(attribution: InviteAttribution) {
  try {
    const current = readInvite();
    // The first invite a new member opens is the one that counts.
    if (current?.ref) {
      if (current.code === attribution.code) return;
      localStorage.setItem(STORE_KEY, JSON.stringify({ ...attribution, ref: current.ref }));
      return;
    }
    localStorage.setItem(STORE_KEY, JSON.stringify(attribution));
  } catch {
    /* storage unavailable */
  }
}

export function readInvite(): InviteAttribution | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as InviteAttribution;
    return parsed?.code ? parsed : null;
  } catch {
    return null;
  }
}

export function clearInvite() {
  try {
    localStorage.removeItem(STORE_KEY);
  } catch {
    /* storage unavailable */
  }
}

export async function shareInvite(link: string, leagueName: string) {
  const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
  if (nav.share) {
    try {
      await nav.share({
        title: `Join ${leagueName} on Gridiron Gods`,
        text: `Come pick games with us. We both get $5 SZN Credit when you join.`,
        url: link,
      });
      return "shared";
    } catch {
      return "cancelled";
    }
  }
  await navigator.clipboard?.writeText(link);
  return "copied";
}
