# Gridiron Gods

import React, { useState, useEffect, useCallback } from "react";
import { Trophy, Users, LogOut, Plus, Check, X, Shield, ChevronRight, Copy, ClipboardList, Settings, ArrowLeft, AlertCircle } from "lucide-react";

/* ============================================================================
   GRIDIRON POOL — weekly NFL straight-up pick'em with league standings
   All data lives in shared persistent storage (window.storage) so every
   member of a league sees the same games, picks, and standings.

   Styling note: colors are applied via inline styles rather than Tailwind
   arbitrary-value classes (e.g. bg-[#xxxxxx]), because this environment has
   no Tailwind JIT compiler — bracket classes silently produce no CSS. Only
   plain layout utilities (flex, grid, gap, padding, rounded, text-sm, etc.)
   are used as Tailwind classes; every color, border-color and font-family
   is set directly with style={} for guaranteed, readable contrast.
   ============================================================================ */

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap');`;

// ---- palette --------------------------------------------------------------
const C = {
  bg: "#F7F5EF",
  card: "#FFFFFF",
  ink: "#16241E",
  inkSoft: "#4E5C55",
  inkFaint: "#7C8A82",
  line: "#DFD9C8",
  lineStrong: "#C9C2AC",
  green: "#1F5C43",
  greenDark: "#123C2B",
  greenTint: "#E6EFE9",
  amber: "#B4720A",
  amberBg: "#FBEFD9",
  amberText: "#7A4E07",
  danger: "#B5493A",
  dangerBg: "#F8E7E3",
  win: "#2F7A52",
};
const fontDisplay = { fontFamily: "Oswald, sans-serif" };
const fontBody = { fontFamily: "Inter, sans-serif" };

// ---- storage helpers --------------------------------------------------
function hasStorage() {
  return typeof window !== "undefined" && window.storage && typeof window.storage.get === "function" && typeof window.storage.set === "function";
}
async function getJSON(key, shared, fallback) {
  if (!hasStorage()) return fallback;
  try {
    const r = await window.storage.get(key, shared);
    return r ? JSON.parse(r.value) : fallback;
  } catch (e) {
    return fallback;
  }
}
async function setJSON(key, value, shared) {
  if (!hasStorage()) return false;
  try {
    await window.storage.set(key, JSON.stringify(value), shared);
    return true;
  } catch (e) {
    console.error("storage set failed", key, e);
    return false;
  }
}
// Round-trips a probe value so we can tell the difference between "this key
// genuinely doesn't exist yet" and "storage isn't actually working here" —
// the latter used to fail completely silently, which made the whole app look
// broken (created leagues/accounts that never actually saved).
async function probeStorage() {
  if (!hasStorage()) return false;
  const key = "healthcheck:probe";
  const val = { t: Date.now() };
  const wrote = await setJSON(key, val, false);
  if (!wrote) return false;
  const read = await getJSON(key, false, null);
  return !!read && read.t === val.t;
}
function code6() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
function uid(prefix) {
  return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---- seed data: 2026 NFL Week 1 (16 games, real matchups) -------------
const WEEK1_GAMES = [
  { id: "w1g1", away: "New England Patriots", home: "Seattle Seahawks", slot: "Wed 9/9 · 8:20 PM" },
  { id: "w1g2", away: "San Francisco 49ers", home: "Los Angeles Rams", slot: "Thu 9/10 · Melbourne" },
  { id: "w1g3", away: "Chicago Bears", home: "Carolina Panthers", slot: "Sun 9/13 · 1:00 PM" },
  { id: "w1g4", away: "Tampa Bay Buccaneers", home: "Cincinnati Bengals", slot: "Sun 9/13 · 1:00 PM" },
  { id: "w1g5", away: "Baltimore Ravens", home: "Indianapolis Colts", slot: "Sun 9/13 · 1:00 PM" },
  { id: "w1g6", away: "Buffalo Bills", home: "Houston Texans", slot: "Sun 9/13 · 1:00 PM" },
  { id: "w1g7", away: "New Orleans Saints", home: "Detroit Lions", slot: "Sun 9/13 · 1:00 PM" },
  { id: "w1g8", away: "New York Jets", home: "Tennessee Titans", slot: "Sun 9/13 · 1:00 PM" },
  { id: "w1g9", away: "Atlanta Falcons", home: "Pittsburgh Steelers", slot: "Sun 9/13 · 1:00 PM" },
  { id: "w1g10", away: "Cleveland Browns", home: "Jacksonville Jaguars", slot: "Sun 9/13 · 1:00 PM" },
  { id: "w1g11", away: "Arizona Cardinals", home: "Los Angeles Chargers", slot: "Sun 9/13 · 4:25 PM" },
  { id: "w1g12", away: "Green Bay Packers", home: "Minnesota Vikings", slot: "Sun 9/13 · 4:25 PM" },
  { id: "w1g13", away: "Washington Commanders", home: "Philadelphia Eagles", slot: "Sun 9/13 · 4:25 PM" },
  { id: "w1g14", away: "Miami Dolphins", home: "Las Vegas Raiders", slot: "Sun 9/13 · 4:25 PM" },
  { id: "w1g15", away: "Dallas Cowboys", home: "New York Giants", slot: "Sun 9/13 · 8:20 PM SNF" },
  { id: "w1g16", away: "Denver Broncos", home: "Kansas City Chiefs", slot: "Mon 9/14 · 8:15 PM MNF" },
];
const WEEK1_SEED = {
  weekNum: 1,
  label: "Week 1 · 2026",
  tiebreakerGameId: "w1g16",
  games: WEEK1_GAMES,
  finalScores: {},
  locked: false,
};

async function ensureWeekSeeded() {
  const existing = await getJSON("week:1", true, null);
  if (!existing) await setJSON("week:1", WEEK1_SEED, true);
}

// ---- scoring ------------------------------------------------------------
function gradeGame(game, finalScores) {
  const fs = finalScores?.[game.id];
  if (!fs || fs.home == null || fs.away == null || fs.home === "" || fs.away === "") return null;
  const h = Number(fs.home), a = Number(fs.away);
  if (h === a) return "tie";
  return h > a ? "home" : "away";
}

function computeStandingsForWeek(members, usersMap, weekData, picksByEmail) {
  const rows = members.map((email) => {
    const rec = picksByEmail[email];
    let correct = 0, graded = 0, tbDiff = null, hasTb = false;
    weekData.games.forEach((g) => {
      const winner = gradeGame(g, weekData.finalScores);
      if (winner && winner !== "tie") {
        graded++;
        if (rec && rec.picks && rec.picks[g.id] === winner) correct++;
      }
    });
    const tbGame = weekData.games.find((g) => g.id === weekData.tiebreakerGameId);
    const tbFinal = weekData.finalScores?.[weekData.tiebreakerGameId];
    if (tbGame && tbFinal && tbFinal.home !== "" && tbFinal.home != null && rec && rec.tiebreaker != null && rec.tiebreaker !== "") {
      const actualTotal = Number(tbFinal.home) + Number(tbFinal.away);
      tbDiff = Math.abs(Number(rec.tiebreaker) - actualTotal);
      hasTb = true;
    }
    return { email, username: usersMap[email]?.username || email, correct, graded, submitted: !!rec, tbDiff, hasTb };
  });
  rows.sort((a, b) => {
    if (b.correct !== a.correct) return b.correct - a.correct;
    if (a.hasTb && b.hasTb) return a.tbDiff - b.tbDiff;
    if (a.hasTb) return -1;
    if (b.hasTb) return 1;
    return 0;
  });
  return rows;
}

function computeSeasonStandings(members, usersMap, weeksData, picksByWeekByEmail) {
  const rows = members.map((email) => {
    let correct = 0, graded = 0, tbDiffSum = 0, tbCount = 0, weeksPlayed = 0;
    weeksData.forEach((wk) => {
      const rec = picksByWeekByEmail[wk.weekNum]?.[email];
      let any = false;
      wk.games.forEach((g) => {
        const winner = gradeGame(g, wk.finalScores);
        if (winner && winner !== "tie") {
          graded++;
          any = true;
          if (rec && rec.picks && rec.picks[g.id] === winner) correct++;
        }
      });
      const tbFinal = wk.finalScores?.[wk.tiebreakerGameId];
      if (tbFinal && tbFinal.home !== "" && tbFinal.home != null && rec && rec.tiebreaker != null && rec.tiebreaker !== "") {
        const actualTotal = Number(tbFinal.home) + Number(tbFinal.away);
        tbDiffSum += Math.abs(Number(rec.tiebreaker) - actualTotal);
        tbCount++;
      }
      if (any) weeksPlayed++;
    });
    return { email, username: usersMap[email]?.username || email, correct, graded, tbDiffSum, tbCount, weeksPlayed };
  });
  rows.sort((a, b) => {
    if (b.correct !== a.correct) return b.correct - a.correct;
    return a.tbDiffSum - b.tbDiffSum;
  });
  return rows;
}

// ---- small UI atoms -------------------------------------------------------
function Btn({ children, onClick, variant = "primary", className = "", disabled, type = "button" }) {
  const styles = {
    primary: { background: C.amber, color: "#FFFFFF", border: "1px solid " + C.amber },
    dark: { background: C.green, color: "#FFFFFF", border: "1px solid " + C.green },
    outline: { background: C.card, color: C.ink, border: "1px solid " + C.lineStrong },
    ghost: { background: "transparent", color: C.ink, border: "1px solid transparent" },
    danger: { background: C.dangerBg, color: C.danger, border: "1px solid " + C.dangerBg },
  };
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`px-4 py-2.5 rounded-md font-medium text-sm transition-opacity ${disabled ? "opacity-40 cursor-not-allowed" : "hover:opacity-85 cursor-pointer"} ${className}`}
      style={{ ...styles[variant], ...fontBody }}
    >
      {children}
    </button>
  );
}
function Field({ label, children }) {
  return (
    <label className="block mb-4">
      <span className="block text-sm font-medium mb-1.5" style={{ color: C.inkSoft }}>{label}</span>
      {children}
    </label>
  );
}
function Input(props) {
  return (
    <input
      {...props}
      className={`w-full px-3 py-2.5 rounded-md text-sm focus:outline-none ${props.className || ""}`}
      style={{ background: "#FFFFFF", color: C.ink, border: "1px solid " + C.lineStrong, ...(props.style || {}) }}
    />
  );
}
function TextArea(props) {
  return (
    <textarea
      {...props}
      className={`w-full px-3 py-2.5 rounded-md text-sm focus:outline-none ${props.className || ""}`}
      style={{ background: "#FFFFFF", color: C.ink, border: "1px solid " + C.lineStrong, ...(props.style || {}) }}
    />
  );
}
function Card({ children, className = "", style = {} }) {
  return (
    <div className={`rounded-lg ${className}`} style={{ background: C.card, border: "1px solid " + C.line, ...style }}>
      {children}
    </div>
  );
}
function Tag({ children, tone = "amber" }) {
  const tones = {
    amber: { background: C.amberBg, color: C.amberText },
    green: { background: C.greenTint, color: C.greenDark },
    danger: { background: C.dangerBg, color: C.danger },
  };
  return (
    <span className="text-xs font-medium px-1.5 py-0.5 rounded" style={tones[tone]}>{children}</span>
  );
}

// ============================================================================
export default function App() {
  const [booted, setBooted] = useState(false);
  const [storageOK, setStorageOK] = useState(true);
  const [session, setSession] = useState(null);
  const [usersMap, setUsersMap] = useState({});
  const [authMode, setAuthMode] = useState("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authUsername, setAuthUsername] = useState("");
  const [authError, setAuthError] = useState("");

  const [myLeagues, setMyLeagues] = useState([]);
  const [activeLeagueId, setActiveLeagueId] = useState(null);
  const [view, setView] = useState("hub");
  const [leagueTab, setLeagueTab] = useState("picks");

  useEffect(() => {
    (async () => {
      const ok = await probeStorage();
      setStorageOK(ok);
      if (!ok) { setBooted(true); return; }
      await ensureWeekSeeded();
      const sess = await getJSON("session:current", false, null);
      if (sess?.email) {
        const u = await getJSON(`user:${sess.email}`, true, null);
        if (u) {
          setSession({ email: sess.email });
          setUsersMap((m) => ({ ...m, [sess.email]: u }));
        }
      }
      setBooted(true);
    })();
  }, []);

  const loadMyLeagues = useCallback(async (email) => {
    const ids = await getJSON(`userLeagues:${email}`, true, []);
    const leagues = [];
    for (const id of ids) {
      const l = await getJSON(`league:${id}`, true, null);
      if (l) leagues.push(l);
    }
    setMyLeagues(leagues);
  }, []);

  useEffect(() => {
    if (session?.email) loadMyLeagues(session.email);
  }, [session, loadMyLeagues]);

  async function handleAuth(e) {
    e.preventDefault();
    setAuthError("");
    const email = authEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) return setAuthError("Enter a valid email address.");
    const existing = await getJSON(`user:${email}`, true, null);
    if (authMode === "login") {
      if (!existing) return setAuthError("No account found for that email. Switch to Sign up.");
      await setJSON("session:current", { email }, false);
      setUsersMap((m) => ({ ...m, [email]: existing }));
      setSession({ email });
    } else {
      if (existing) return setAuthError("An account already exists for that email. Switch to Log in.");
      const username = authUsername.trim();
      if (username.length < 3) return setAuthError("Username must be at least 3 characters.");
      const unameKey = `usernameIndex:${username.toLowerCase()}`;
      const taken = await getJSON(unameKey, true, null);
      if (taken) return setAuthError("That username is already taken.");
      const user = { email, username, createdAt: Date.now() };
      const ok1 = await setJSON(`user:${email}`, user, true);
      const ok2 = await setJSON(unameKey, email, true);
      const ok3 = await setJSON(`userLeagues:${email}`, [], true);
      if (!ok1 || !ok2 || !ok3) {
        return setAuthError("Couldn't save your account — storage didn't confirm the write. Please try again.");
      }
      // Verify the write actually round-tripped before treating signup as successful.
      const verify = await getJSON(`user:${email}`, true, null);
      if (!verify) {
        return setAuthError("Your account didn't save. Please try again in a moment.");
      }
      await setJSON("session:current", { email }, false);
      setUsersMap((m) => ({ ...m, [email]: user }));
      setSession({ email });
    }
  }

  async function handleLogout() {
    await setJSON("session:current", null, false);
    setSession(null);
    setMyLeagues([]);
    setActiveLeagueId(null);
    setView("hub");
  }

  if (!booted) {
    return (
      


        
        

Loading…


      


    );
  }

  if (!storageOK) {
    return (
      


        
        
          
          

Storage isn't available right now


          


            This app saves accounts, leagues, and picks using this session's persistent storage, and it isn't reachable at the moment — so nothing you create will be saved. Try reopening this artifact, or check back shortly.
          


           { setBooted(false); const ok = await probeStorage(); setStorageOK(ok); setBooted(true); }}>Try again
        
      


    );
  }

  if (!session) {
    return (
      


        
        


          


            


              
            


            

Gridiron Pool


            

Pick winners straight up. Beat your league.


          


          
            


               { setAuthMode("login"); setAuthError(""); }}
                className="flex-1 py-2 rounded text-sm font-medium transition-colors"
                style={authMode === "login" ? { background: "#FFFFFF", color: C.ink, boxShadow: "0 1px 2px rgba(0,0,0,0.06)" } : { color: C.inkSoft }}
              >
                Log in
              
               { setAuthMode("signup"); setAuthError(""); }}
                className="flex-1 py-2 rounded text-sm font-medium transition-colors"
                style={authMode === "signup" ? { background: "#FFFFFF", color: C.ink, boxShadow: "0 1px 2px rgba(0,0,0,0.06)" } : { color: C.inkSoft }}
              >
                Sign up
              
            


            


              
                 setAuthEmail(e.target.value)} placeholder="you@example.com" />
              
              {authMode === "signup" && (
                
                   setAuthUsername(e.target.value)} placeholder="how your league sees you" />
                
              )}
              {authError && (
                


                  
                  {authError}
                


              )}
              {authMode === "login" ? "Log in" : "Create account"}
            
          
          


            Prototype auth: accounts are identified by email only, with no password check — don't reuse a sensitive password here.
          


        
      
    );
  }

  const me = usersMap[session.email];

  return (
    


      
      


        


           { setView("hub"); setActiveLeagueId(null); }} className="flex items-center gap-2">
            
            Gridiron Pool
          
          


            {me?.username}
            
               Log out
            
          


        


      



      
        {view === "hub" && (
           loadMyLeagues(session.email)}
            onOpenLeague={(id) => { setActiveLeagueId(id); setView("league"); setLeagueTab("picks"); }}
          />
        )}
        {view === "league" && activeLeagueId && (
           { setView("hub"); setActiveLeagueId(null); loadMyLeagues(session.email); }}
            usersMap={usersMap}
            setUsersMap={setUsersMap}
          />
        )}
      
    


  );
}

// ============================================================================
function LeagueHub({ me, myLeagues, onRefresh, onOpenLeague, onLeagueAdded }) {
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [name, setName] = useState("");
  const [rules, setRules] = useState("Straight-up picks each week. Most correct picks wins. Monday-night total points breaks ties.");
  const [joinCode, setJoinCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function createLeague(e) {
    e.preventDefault();
    setErr("");
    if (!name.trim()) return;
    setBusy(true);
    const id = uid("league");
    const league = { id, name: name.trim(), ownerEmail: me.email, code: code6(), members: [me.email], rules: rules.trim(), createdAt: Date.now() };
    const ok1 = await setJSON(`league:${id}`, league, true);
    const ok2 = await setJSON(`leagueCode:${league.code}`, id, true);
    const mine = await getJSON(`userLeagues:${me.email}`, true, []);
    const ok3 = await setJSON(`userLeagues:${me.email}`, [...mine, id], true);
    // Confirm the league actually round-trips before telling the user it worked.
    const verify = await getJSON(`league:${id}`, true, null);
    setBusy(false);
    if (!ok1 || !ok2 || !ok3 || !verify) {
      setErr("Couldn't save the league — storage didn't confirm the write. Please try again.");
      return;
    }
    setShowCreate(false);
    setName("");
    onLeagueAdded(league); // update the list immediately, don't wait on a re-fetch
    onRefresh();
  }

  async function joinLeague(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    const codeVal = joinCode.trim().toUpperCase();
    const id = await getJSON(`leagueCode:${codeVal}`, true, null);
    if (!id) { setBusy(false); return setErr("No league found with that invite code."); }
    const league = await getJSON(`league:${id}`, true, null);
    if (!league) { setBusy(false); return setErr("That league no longer exists."); }
    if (league.members.includes(me.email)) { setBusy(false); return setErr("You're already in this league."); }
    league.members.push(me.email);
    const ok1 = await setJSON(`league:${id}`, league, true);
    const mine = await getJSON(`userLeagues:${me.email}`, true, []);
    const ok2 = await setJSON(`userLeagues:${me.email}`, [...mine, id], true);
    setBusy(false);
    if (!ok1 || !ok2) {
      setErr("Couldn't join the league — storage didn't confirm the write. Please try again.");
      return;
    }
    setShowJoin(false);
    setJoinCode("");
    onLeagueAdded(league);
    onRefresh();
  }

  return (
    


      


        

Your leagues


        

Join a league to make weekly picks against friends, or start your own.


      



      {myLeagues.length === 0 && (
        


          
          

You haven't joined a league yet.


        


      )}

      


        {myLeagues.map((l) => (
           onOpenLeague(l.id)} className="text-left">
            
              


                


                  

{l.name}


                  

{l.members.length} member{l.members.length !== 1 ? "s" : ""} · {l.ownerEmail === me.email ? "Commissioner" : "Member"}


                


                
              


            
          
        ))}
      



      


         { setShowCreate((v) => !v); setShowJoin(false); }}>
           Create a league
        
         { setShowJoin((v) => !v); setShowCreate(false); }}>Join with a code
      



      {showCreate && (
        
          


            
               setName(e.target.value)} placeholder="Sunday Ticket Degenerates" autoFocus />
            
            
               setRules(e.target.value)} />
            </Field>
            <Btn type="submit">Create league</Btn>
          </form>
        </Card>
      )}
      {showJoin && (
        <Card className="mt-5 p-5 max-w-md">
          <form onSubmit={joinLeague}>
            <Field label="Invite code">
              <Input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="ABC123" autoFocus />
            </Field>
            {err && <div className="text-sm mb-3" style={{ color: C.danger }}>{err}</div>}
            <Btn type="submit">Join league</Btn>
          </form>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
function LeagueDashboard({ me, leagueId, tab, setTab, onBack, usersMap, setUsersMap }) {
  const [league, setLeague] = useState(null);
  const [week, setWeek] = useState(1);
  const [loadingLeague, setLoadingLeague] = useState(true);

  const refreshLeague = useCallback(async () => {
    const l = await getJSON(`league:${leagueId}`, true, null);
    setLeague(l);
    setLoadingLeague(false);
  }, [leagueId]);

  useEffect(() => { refreshLeague(); }, [refreshLeague]);

  useEffect(() => {
    (async () => {
      if (!league) return;
      const missing = league.members.filter((e) => !usersMap[e]);
      if (missing.length) {
        const updates = {};
        for (const e of missing) {
          const u = await getJSON(`user:${e}`, true, null);
          if (u) updates[e] = u;
        }
        if (Object.keys(updates).length) setUsersMap((m) => ({ ...m, ...updates }));
      }
    })();
  }, [league, usersMap, setUsersMap]);

  if (loadingLeague || !league) {
    return <div className="text-sm" style={{ color: C.inkSoft }}>Loading league…</div>;
  }

  const isOwner = league.ownerEmail === me.email;
  const weekOptions = Array.from({ length: 18 }, (_, i) => i + 1);

  const tabs = [
    { id: "picks", label: "Make picks", icon: ClipboardList },
    { id: "standings", label: "Standings", icon: Trophy },
    { id: "members", label: "Members", icon: Users },
    { id: "schedule", label: "Schedule & results", icon: Settings },
  ];

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm mb-4" style={{ color: C.inkSoft }}>
        <ArrowLeft size={15} /> All leagues
      </button>

      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl" style={{ color: C.ink, ...fontDisplay, fontWeight: 600 }}>{league.name}</h2>
          <p className="text-sm mt-1" style={{ color: C.inkSoft }}>{league.rules}</p>
        </div>
        <div>
          <label className="text-xs block mb-1" style={{ color: C.inkFaint }}>Week</label>
          <select value={week} onChange={(e) => setWeek(Number(e.target.value))} className="w-28 px-3 py-2.5 rounded-md text-sm" style={{ background: "#FFFFFF", color: C.ink, border: "1px solid " + C.lineStrong }}>
            {weekOptions.map((w) => <option key={w} value={w}>Week {w}</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-1 mb-6 overflow-x-auto" style={{ borderBottom: "1px solid " + C.line }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium whitespace-nowrap"
            style={{
              color: tab === t.id ? C.ink : C.inkFaint,
              borderBottom: tab === t.id ? "2px solid " + C.amber : "2px solid transparent",
              marginBottom: "-1px",
            }}
          >
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {tab === "picks" && <PicksPanel me={me} league={league} week={week} />}
      {tab === "standings" && <StandingsPanel league={league} usersMap={usersMap} currentWeek={week} />}
      {tab === "members" && <MembersPanel me={me} league={league} isOwner={isOwner} usersMap={usersMap} onChanged={refreshLeague} />}
      {tab === "schedule" && <SchedulePanel week={week} />}
    </div>
  );
}

// ---- Picks panel -----------------------------------------------------------
function PicksPanel({ me, league, week }) {
  const [weekData, setWeekData] = useState(null);
  const [picks, setPicks] = useState({});
  const [tiebreaker, setTiebreaker] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setSaved(false);
      const wk = await getJSON(`week:${week}`, true, null);
      setWeekData(wk);
      const mine = await getJSON(`picks:${league.id}:${week}:${me.email}`, true, null);
      setPicks(mine?.picks || {});
      setTiebreaker(mine?.tiebreaker != null ? String(mine.tiebreaker) : "");
      setLoading(false);
    })();
  }, [week, league.id, me.email]);

  if (loading) return <div className="text-sm" style={{ color: C.inkSoft }}>Loading matchups…</div>;
  if (!weekData) {
    return (
      <div className="rounded-lg p-8 text-center" style={{ border: "1px dashed " + C.lineStrong }}>
        <p className="text-sm" style={{ color: C.inkSoft }}>No schedule has been entered for Week {week} yet. Any member can add it under "Schedule & results".</p>
      </div>
    );
  }

  const totalGames = weekData.games.length;
  const pickedCount = Object.keys(picks).length;
  const tbGameId = weekData.tiebreakerGameId;
  const canSubmit = pickedCount === totalGames && tiebreaker !== "" && !isNaN(Number(tiebreaker));

  function choose(gameId, side) {
    setPicks((p) => ({ ...p, [gameId]: side }));
    setSaved(false);
  }

  async function submit() {
    const rec = { picks, tiebreaker: Number(tiebreaker), submittedAt: Date.now() };
    const ok = await setJSON(`picks:${league.id}:${week}:${me.email}`, rec, true);
    setSaved(ok);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="text-sm" style={{ color: C.inkSoft }}>
          {pickedCount} of {totalGames} games picked
          {weekData.locked && <span className="ml-2" style={{ color: C.danger }}>· picks are locked for this week</span>}
        </div>
        <Btn onClick={submit} disabled={!canSubmit || weekData.locked}>
          {saved ? <span className="flex items-center gap-1.5"><Check size={15} /> Saved</span> : "Save my picks"}
        </Btn>
      </div>

      <div className="space-y-2.5">
        {weekData.games.map((g) => {
          const isTb = g.id === tbGameId;
          const winner = gradeGame(g, weekData.finalScores);
          return (
            <Card key={g.id} className="p-3.5">
              <div className="text-xs mb-2 flex items-center gap-2" style={{ color: C.inkFaint }}>
                <span>{g.slot}</span>
                {isTb && <Tag tone="amber">Tiebreaker game</Tag>}
                {winner && winner !== "tie" && <Tag tone="green">Final</Tag>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {["away", "home"].map((side) => {
                  const team = g[side];
                  const chosen = picks[g.id] === side;
                  const isWinner = winner === side;
                  const isLoser = winner && winner !== "tie" && winner !== side;
                  return (
                    <button
                      key={side}
                      disabled={weekData.locked}
                      onClick={() => choose(g.id, side)}
                      className={`text-left px-3 py-2.5 rounded-md text-sm font-medium flex items-center justify-between ${weekData.locked ? "cursor-default" : "cursor-pointer"}`}
                      style={chosen
                        ? { border: "1px solid " + C.amber, background: C.amberBg, color: C.ink }
                        : { border: "1px solid " + C.line, background: "#FFFFFF", color: C.inkSoft }}
                    >
                      <span>{team}{side === "home" && <span style={{ color: C.inkFaint, fontWeight: 400 }}> (home)</span>}</span>
                      {isWinner && <Check size={15} style={{ color: C.win }} />}
                      {isLoser && chosen && <X size={15} style={{ color: C.danger }} />}
                    </button>
                  );
                })}
              </div>
              {isTb && (
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <label className="text-sm" style={{ color: C.inkSoft }}>Combined final score, both teams:</label>
                  <Input
                    type="number"
                    disabled={weekData.locked}
                    className="w-24"
                    value={tiebreaker}
                    onChange={(e) => { setTiebreaker(e.target.value); setSaved(false); }}
                    placeholder="e.g. 33"
                  />
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ---- Standings panel --------------------------------------------------------
function StandingsPanel({ league, usersMap, currentWeek }) {
  const [mode, setMode] = useState("season");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      if (mode === "week") {
        const wk = await getJSON(`week:${currentWeek}`, true, null);
        if (!wk) { setRows([]); setLoading(false); return; }
        const picksByEmail = {};
        for (const email of league.members) {
          const rec = await getJSON(`picks:${league.id}:${currentWeek}:${email}`, true, null);
          if (rec) picksByEmail[email] = rec;
        }
        setRows(computeStandingsForWeek(league.members, usersMap, wk, picksByEmail));
      } else {
        const weeksData = [];
        const picksByWeekByEmail = {};
        for (let w = 1; w <= 18; w++) {
          const wk = await getJSON(`week:${w}`, true, null);
          if (!wk) continue;
          weeksData.push(wk);
          picksByWeekByEmail[w] = {};
          for (const email of league.members) {
            const rec = await getJSON(`picks:${league.id}:${w}:${email}`, true, null);
            if (rec) picksByWeekByEmail[w][email] = rec;
          }
        }
        setRows(computeSeasonStandings(league.members, usersMap, weeksData, picksByWeekByEmail));
      }
      setLoading(false);
    })();
  }, [mode, currentWeek, league, usersMap]);

  return (
    <div>
      <div className="flex gap-1 rounded-md p-1 w-fit mb-5" style={{ background: C.greenTint }}>
        <button onClick={() => setMode("season")} className="px-3.5 py-1.5 rounded text-sm font-medium" style={mode === "season" ? { background: "#FFFFFF", color: C.ink, boxShadow: "0 1px 2px rgba(0,0,0,0.06)" } : { color: C.inkSoft }}>Season</button>
        <button onClick={() => setMode("week")} className="px-3.5 py-1.5 rounded text-sm font-medium" style={mode === "week" ? { background: "#FFFFFF", color: C.ink, boxShadow: "0 1px 2px rgba(0,0,0,0.06)" } : { color: C.inkSoft }}>Week {currentWeek}</button>
      </div>

      {loading ? (
        <div className="text-sm" style={{ color: C.inkSoft }}>Calculating standings…</div>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: C.greenTint }}>
                <th className="text-left font-medium px-4 py-2.5 text-xs" style={{ color: C.inkSoft }}>Rank</th>
                <th className="text-left font-medium px-4 py-2.5 text-xs" style={{ color: C.inkSoft }}>Member</th>
                <th className="text-right font-medium px-4 py-2.5 text-xs" style={{ color: C.inkSoft }}>Record</th>
                <th className="text-right font-medium px-4 py-2.5 text-xs" style={{ color: C.inkSoft }}>Tiebreaker Δ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.email} style={{ borderTop: "1px solid " + C.line }}>
                  <td className="px-4 py-2.5" style={{ color: C.inkSoft }}>{i + 1}</td>
                  <td className="px-4 py-2.5 font-medium" style={{ color: C.ink }}>{r.username}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: C.ink }}>
                    {r.correct}-{Math.max(r.graded - r.correct, 0)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: C.inkSoft }}>
                    {mode === "week" ? (r.hasTb ? r.tbDiff : "—") : (r.tbCount ? r.tbDiffSum : "—")}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center" style={{ color: C.inkFaint }}>No results yet.</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      )}
      <p className="text-xs mt-3" style={{ color: C.inkFaint }}>Ranked by most correct picks; total-points guess on the tiebreaker game (lower difference from the actual combined score) breaks ties.</p>
    </div>
  );
}

// ---- Members panel -----------------------------------------------------------
function MembersPanel({ me, league, isOwner, usersMap, onChanged }) {
  const [copied, setCopied] = useState(false);
  const [rules, setRules] = useState(league.rules);

  async function removeMember(email) {
    if (email === league.ownerEmail) return;
    const updated = { ...league, members: league.members.filter((e) => e !== email) };
    await setJSON(`league:${league.id}`, updated, true);
    const theirs = await getJSON(`userLeagues:${email}`, true, []);
    await setJSON(`userLeagues:${email}`, theirs.filter((id) => id !== league.id), true);
    onChanged();
  }

  async function leaveLeague() {
    await removeMember(me.email);
  }

  async function saveRules() {
    const updated = { ...league, rules };
    await setJSON(`league:${league.id}`, updated, true);
    onChanged();
  }

  function copyCode() {
    navigator.clipboard?.writeText(league.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-6">
      <Card className="p-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs mb-1" style={{ color: C.inkFaint }}>Invite code</div>
          <div className="text-lg tracking-widest font-medium" style={{ color: C.ink, ...fontDisplay }}>{league.code}</div>
        </div>
        <Btn variant="outline" onClick={copyCode}>
          <span className="flex items-center gap-1.5"><Copy size={14} /> {copied ? "Copied" : "Copy code"}</span>
        </Btn>
      </Card>

      <div>
        <h3 className="text-sm font-medium mb-2" style={{ color: C.inkSoft }}>Members ({league.members.length})</h3>
        <Card>
          {league.members.map((email, i) => (
            <div key={email} className="px-4 py-3 flex items-center justify-between" style={i > 0 ? { borderTop: "1px solid " + C.line } : {}}>
              <div>
                <div className="text-sm font-medium" style={{ color: C.ink }}>{usersMap[email]?.username || email}</div>
                <div className="text-xs" style={{ color: C.inkFaint }}>{email === league.ownerEmail ? "Commissioner" : "Member"}</div>
              </div>
              {isOwner && email !== league.ownerEmail && (
                <button onClick={() => removeMember(email)} className="text-xs flex items-center gap-1" style={{ color: C.danger }}>
                  <X size={13} /> Remove
                </button>
              )}
            </div>
          ))}
        </Card>
      </div>

      {isOwner ? (
        <div>
          <h3 className="text-sm font-medium mb-2 flex items-center gap-1.5" style={{ color: C.inkSoft }}><Shield size={14} /> League rules</h3>
          <TextArea rows={3} value={rules} onChange={(e) => setRules(e.target.value)} />
          <Btn className="mt-2" onClick={saveRules}>Save rules</Btn>
        </div>
      ) : (
        <Btn variant="danger" onClick={leaveLeague}>Leave league</Btn>
      )}
    </div>
  );
}

// ---- Schedule & results panel -----------------------------------------------
function SchedulePanel({ week }) {
  const [wk, setWk] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draftGames, setDraftGames] = useState([]);
  const [scores, setScores] = useState({});
  const [locked, setLocked] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getJSON(`week:${week}`, true, null);
    setWk(data);
    setDraftGames(data?.games?.length ? data.games : [{ id: uid("g"), away: "", home: "", slot: "" }]);
    setScores(data?.finalScores || {});
    setLocked(!!data?.locked);
    setLoading(false);
  }, [week]);

  useEffect(() => { load(); }, [load]);

  function updateDraftGame(i, field, value) {
    setDraftGames((gs) => gs.map((g, idx) => (idx === i ? { ...g, [field]: value } : g)));
  }
  function addRow() {
    setDraftGames((gs) => [...gs, { id: uid("g"), away: "", home: "", slot: "" }]);
  }
  function removeRow(i) {
    setDraftGames((gs) => gs.filter((_, idx) => idx !== i));
  }

  async function saveSchedule() {
    const clean = draftGames.filter((g) => g.away.trim() && g.home.trim());
    const tbId = clean.length ? clean[clean.length - 1].id : null;
    const newWk = {
      weekNum: week,
      label: `Week ${week}`,
      games: clean,
      tiebreakerGameId: wk?.tiebreakerGameId && clean.find((g) => g.id === wk.tiebreakerGameId) ? wk.tiebreakerGameId : tbId,
      finalScores: wk?.finalScores || {},
      locked: wk?.locked || false,
    };
    await setJSON(`week:${week}`, newWk, true);
    setEditing(false);
    load();
  }

  async function saveScores() {
    const updated = { ...wk, finalScores: scores, locked };
    await setJSON(`week:${week}`, updated, true);
    load();
  }

  if (loading) return <div className="text-sm" style={{ color: C.inkSoft }}>Loading…</div>;

  return (
    <div className="space-y-6">
      <div className="rounded-lg p-3.5 text-sm flex gap-2" style={{ background: C.amberBg, color: C.amberText }}>
        <AlertCircle size={16} className="mt-0.5 shrink-0" />
        <span>Browsers can't pull nfl.com/schedules directly (the site blocks cross-site requests), so the week's matchups and final scores are entered here — any league member can keep them current for everyone, using the official schedule as the source of truth. Week 1's real matchups are pre-loaded.</span>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium" style={{ color: C.inkSoft }}>Week {week} matchups</h3>
        <Btn variant="outline" onClick={() => setEditing((v) => !v)}>{editing ? "Cancel" : "Edit matchups"}</Btn>
      </div>

      {editing ? (
        <div className="space-y-2">
          {draftGames.map((g, i) => (
            <div key={g.id} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
              <Input placeholder="Away team" value={g.away} onChange={(e) => updateDraftGame(i, "away", e.target.value)} />
              <Input placeholder="Home team" value={g.home} onChange={(e) => updateDraftGame(i, "home", e.target.value)} />
              <Input placeholder="Day / time (e.g. Mon 8:15 PM MNF)" value={g.slot} onChange={(e) => updateDraftGame(i, "slot", e.target.value)} />
              <button onClick={() => removeRow(i)} style={{ color: C.danger }}><X size={16} /></button>
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <Btn variant="ghost" onClick={addRow}><span className="flex items-center gap-1"><Plus size={14} /> Add game</span></Btn>
            <Btn onClick={saveSchedule}>Save schedule</Btn>
          </div>
          <p className="text-xs" style={{ color: C.inkFaint }}>The last game listed is used as the tiebreaker (total combined points).</p>
        </div>
      ) : (
        <Card>
          {(wk?.games || []).map((g, i) => (
            <div key={g.id} className="px-4 py-2.5 flex items-center justify-between text-sm flex-wrap gap-1" style={i > 0 ? { borderTop: "1px solid " + C.line } : {}}>
              <div>
                <span className="font-medium" style={{ color: C.ink }}>{g.away}</span>
                <span style={{ color: C.inkFaint }}> @ </span>
                <span className="font-medium" style={{ color: C.ink }}>{g.home}</span>
                {g.id === wk.tiebreakerGameId && <span className="ml-2"><Tag tone="amber">tiebreaker</Tag></span>}
              </div>
              <span className="text-xs" style={{ color: C.inkFaint }}>{g.slot}</span>
            </div>
          ))}
          {!wk?.games?.length && <div className="px-4 py-6 text-center text-sm" style={{ color: C.inkFaint }}>No matchups entered yet.</div>}
        </Card>
      )}

      <div>
        <h3 className="text-sm font-medium mb-2" style={{ color: C.inkSoft }}>Final scores</h3>
        <Card>
          {(wk?.games || []).map((g, i) => (
            <div key={g.id} className="px-4 py-2.5 grid grid-cols-[1fr_auto_auto] gap-3 items-center text-sm" style={i > 0 ? { borderTop: "1px solid " + C.line } : {}}>
              <div>
                <span style={{ color: C.ink }}>{g.away}</span> <span style={{ color: C.inkFaint }}></body>@</span> {g.home}
              
               setScores((s) => ({ ...s, [g.id]: { ...(s[g.id] || {}), away: e.target.value } }))}
              />
               setScores((s) => ({ ...s, [g.id]: { ...(s[g.id] || {}), home: e.target.value } }))}
              />
            
          ))}
        
        


          
             setLocked(e.target.checked)} />
            Lock picks for this week (prevents further changes)
          
          Save scores
        


      
    
  );
}

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://straight-up-gridiron.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ca24528c-16f5-457b-93b0-2d706bd12e7e).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
