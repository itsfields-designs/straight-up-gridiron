// Team identity for pick rows: short code plus the club's primary colour.
type Team = { abbr: string; color: string };

const TEAMS: Record<string, Team> = {
  Cardinals: { abbr: "ARI", color: "#97233F" },
  Falcons: { abbr: "ATL", color: "#A71930" },
  Ravens: { abbr: "BAL", color: "#241773" },
  Bills: { abbr: "BUF", color: "#00338D" },
  Panthers: { abbr: "CAR", color: "#0085CA" },
  Bears: { abbr: "CHI", color: "#0B162A" },
  Bengals: { abbr: "CIN", color: "#FB4F14" },
  Browns: { abbr: "CLE", color: "#311D00" },
  Cowboys: { abbr: "DAL", color: "#041E42" },
  Broncos: { abbr: "DEN", color: "#FB4F14" },
  Lions: { abbr: "DET", color: "#0076B6" },
  Packers: { abbr: "GB", color: "#203731" },
  Texans: { abbr: "HOU", color: "#03202F" },
  Colts: { abbr: "IND", color: "#002C5F" },
  Jaguars: { abbr: "JAX", color: "#006778" },
  Chiefs: { abbr: "KC", color: "#E31837" },
  Raiders: { abbr: "LV", color: "#000000" },
  Chargers: { abbr: "LAC", color: "#0080C6" },
  Rams: { abbr: "LAR", color: "#003594" },
  Dolphins: { abbr: "MIA", color: "#008E97" },
  Vikings: { abbr: "MIN", color: "#4F2683" },
  Patriots: { abbr: "NE", color: "#002244" },
  Saints: { abbr: "NO", color: "#9F8958" },
  Giants: { abbr: "NYG", color: "#0B2265" },
  Jets: { abbr: "NYJ", color: "#125740" },
  Eagles: { abbr: "PHI", color: "#004C54" },
  Steelers: { abbr: "PIT", color: "#101820" },
  "49ers": { abbr: "SF", color: "#AA0000" },
  Seahawks: { abbr: "SEA", color: "#002244" },
  Buccaneers: { abbr: "TB", color: "#D50A0A" },
  Titans: { abbr: "TEN", color: "#4B92DB" },
  Commanders: { abbr: "WAS", color: "#5A1414" },
};

export function teamInfo(name: string): Team {
  const key = Object.keys(TEAMS).find((t) => name.toLowerCase().includes(t.toLowerCase()));
  if (key) return TEAMS[key];
  const letters = name.replace(/[^A-Za-z0-9]/g, "");
  return { abbr: letters.slice(0, 3).toUpperCase(), color: "#3f4a45" };
}
