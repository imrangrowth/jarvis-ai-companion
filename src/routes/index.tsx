import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  routeIntent,
  chatAgentic,
  buildWebsite,
  synthesizeSpeech,
  type ApiMessage,
} from "@/lib/jarvis.functions";

export const Route = createFileRoute("/")({
  component: JARVIS,
  head: () => ({
    meta: [
      { title: "J.A.R.V.I.S. v6.0 — Stark Industries AI" },
      {
        name: "description",
        content:
          "Multi-agent AI with voice, vision, web search, memory, phone actions and a live website builder.",
      },
    ],
  }),
});

// ══════════════════════════════════════════════════════════
//  CONSTANTS
// ══════════════════════════════════════════════════════════
const ELEVENLABS_VOICE_ID = "onwK4e9ZLuTAKqWW03F9"; // Daniel — British

const WMO_CODES: Record<number, string> = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Foggy", 48: "Icy fog", 51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
  61: "Light rain", 63: "Moderate rain", 65: "Heavy rain", 71: "Light snow", 73: "Snow",
  75: "Heavy snow", 80: "Showers", 81: "Heavy showers", 82: "Violent showers",
  95: "Thunderstorm", 96: "Thunderstorm & hail",
};

const AGENTS: Record<string, { prompt: string }> = {
  developer: { prompt: "You are channeling JARVIS's Developer Agent: a senior full-stack engineer fluent in React, Node, APIs, architecture, and deployment. Think like a pragmatic senior dev, give concrete code or technical direction when useful. Stay in JARVIS's voice — calm, precise, British, address the user as sir." },
  marketing: { prompt: "You are channeling JARVIS's Marketing Agent: an expert in digital marketing, Meta/Google Ads, ad copywriting, campaign strategy, and ROAS optimization. Be punchy and conversion-focused. Stay in JARVIS's voice — calm, precise, British, address the user as sir." },
  research: { prompt: "You are channeling JARVIS's Research Agent: a meticulous analyst who synthesizes information from multiple sources into clear, well-structured findings. Use the web search tool actively and cite what you found in plain spoken language. Stay in JARVIS's voice — calm, precise, British, address the user as sir." },
  sales: { prompt: "You are channeling JARVIS's Sales Agent: skilled at drafting proposals, outreach messages, and persuasive, professional client communication. Stay in JARVIS's voice — calm, precise, British, address the user as sir." },
  pm: { prompt: "You are channeling JARVIS's Project Manager Agent: organized, tracks tasks and deadlines, gives clear status updates and concrete next steps. Reference the user's stored projects, clients, and tasks from memory context when relevant. Stay in JARVIS's voice — calm, precise, British, address the user as sir." },
};

const AGENT_META: Record<string, { label: string; icon: string; color: string }> = {
  jarvis: { label: "JARVIS CORE", icon: "🤖", color: "#00d4ff" },
  developer: { label: "DEVELOPER AGENT", icon: "💻", color: "#34d399" },
  marketing: { label: "MARKETING AGENT", icon: "📣", color: "#f472b6" },
  research: { label: "RESEARCH AGENT", icon: "🔎", color: "#60a5fa" },
  sales: { label: "SALES AGENT", icon: "🤝", color: "#fbbf24" },
  pm: { label: "PROJECT MANAGER", icon: "🗂️", color: "#c084fc" },
  builder: { label: "WEBSITE BUILDER", icon: "🌐", color: "#fb923c" },
  memory: { label: "MEMORY CORE", icon: "🧠", color: "#22d3ee" },
};

const JARVIS_SYSTEM = `You are J.A.R.V.I.S. — Just A Rather Very Intelligent System — Tony Stark's AI, now serving your user.

Personality:
- Calm, sophisticated British demeanor. Dry wit when appropriate.
- Always address the user as "sir".
- You execute phone actions, search the web, manage memory, and route to specialist agents — all behind the scenes. Speak as if you did it yourself.
- When told [ACTION_EXECUTED: X], acknowledge naturally: "Done, sir. I've opened..." not "I see that X happened".
- When told [ACTION_NEEDED: X], explain what's missing.
- Never use markdown, bullets, or asterisks. Spoken sentences only.
- Concise by default: 1-3 sentences unless detail is requested.
- Open with: "Right away.", "Of course, sir.", "Done.", "Certainly.", "On it.", "Noted."`;

// ══════════════════════════════════════════════════════════
//  MEMORY (localStorage)
// ══════════════════════════════════════════════════════════
type MemEntry = { id: string; title: string; content: string };
type Memory = { projects: MemEntry[]; clients: MemEntry[]; tasks: MemEntry[]; preferences: MemEntry[] };
const MEMORY_CATEGORIES: (keyof Memory)[] = ["projects", "clients", "tasks", "preferences"];

function loadMemory(): Memory {
  const out: Memory = { projects: [], clients: [], tasks: [], preferences: [] };
  if (typeof window === "undefined") return out;
  for (const cat of MEMORY_CATEGORIES) {
    try {
      const raw = localStorage.getItem(`memory:${cat}`);
      if (raw) out[cat] = JSON.parse(raw);
    } catch { /* ignore */ }
  }
  return out;
}
function saveMemoryCategory(category: keyof Memory, list: MemEntry[]) {
  try { localStorage.setItem(`memory:${category}`, JSON.stringify(list)); } catch { /* ignore */ }
}
function buildMemoryContext(memory: Memory): string {
  if (!memory) return "";
  const fmt = (arr: MemEntry[]) => arr.slice(-8).map((e) => `${e.title}: ${e.content}`).join(" | ");
  const sections: string[] = [];
  if (memory.projects.length) sections.push(`PROJECTS — ${fmt(memory.projects)}`);
  if (memory.clients.length) sections.push(`CLIENTS — ${fmt(memory.clients)}`);
  if (memory.tasks.length) sections.push(`TASKS — ${fmt(memory.tasks)}`);
  if (memory.preferences.length) sections.push(`PREFERENCES — ${fmt(memory.preferences)}`);
  if (!sections.length) return "";
  return `MEMORY CONTEXT (reference naturally, never recite verbatim unless asked):\n${sections.join("\n")}`;
}

// ══════════════════════════════════════════════════════════
//  WEATHER + ELEVENLABS
// ══════════════════════════════════════════════════════════
async function getWeather(lat: number, lon: number) {
  try {
    const [wRes, gRes] = await Promise.all([
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`),
      fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`),
    ]);
    const [w, g] = await Promise.all([wRes.json(), gRes.json()]);
    return {
      temp: Math.round(w.current_weather.temperature),
      windspeed: Math.round(w.current_weather.windspeed),
      condition: WMO_CODES[w.current_weather.weathercode] || "Unknown",
      city: g.address?.city || g.address?.town || g.address?.state || "Unknown",
    };
  } catch { return null; }
}

async function speakElevenLabs(text: string, key: string, onEnd?: () => void) {
  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: "eleven_turbo_v2_5",
        voice_settings: { stability: 0.55, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true },
      }),
    });
    if (!r.ok) throw new Error();
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => { URL.revokeObjectURL(url); onEnd?.(); };
    audio.play();
  } catch { speakFallback(text, onEnd); }
}

async function speakElevenLabsServer(
  text: string,
  synth: (args: { data: { text: string } }) => Promise<{ audioBase64: string; mimeType: string }>,
  onEnd?: () => void,
) {
  try {
    const { audioBase64, mimeType } = await synth({ data: { text } });
    const audio = new Audio(`data:${mimeType};base64,${audioBase64}`);
    audio.onended = () => onEnd?.();
    await audio.play();
  } catch { speakFallback(text, onEnd); }
}

function speakFallback(text: string, onEnd?: () => void) {
  window.speechSynthesis?.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const vs = window.speechSynthesis?.getVoices() || [];
  const v = vs.find((v) => v.name.includes("Daniel") || v.name.includes("Google UK") || v.lang === "en-GB") || vs[0];
  if (v) u.voice = v;
  u.rate = 0.9;
  u.pitch = 0.85;
  if (onEnd) u.onend = onEnd;
  window.speechSynthesis?.speak(u);
}

// ══════════════════════════════════════════════════════════
//  ACTIONS
// ══════════════════════════════════════════════════════════
type Intent = any;
async function executeAction(intent: Intent, location: { lat: number; lon: number; city?: string } | null) {
  try { navigator.vibrate?.([50, 30, 50]); } catch { /* ignore */ }
  switch (intent.action) {
    case "call":
      if (!intent.number) return { success: false, msg: `I need ${intent.contact}'s phone number, sir.` };
      window.location.href = `tel:${intent.number}`;
      return { success: true, msg: `Calling ${intent.contact || intent.number}, sir.` };
    case "whatsapp":
      if (!intent.number) return { success: false, msg: `I need ${intent.contact}'s WhatsApp number, sir.` };
      window.open(`https://wa.me/${intent.number.replace(/\D/g, "")}?text=${encodeURIComponent(intent.message || "")}`);
      return { success: true, msg: `Opening WhatsApp to ${intent.contact}, sir.` };
    case "sms":
      if (!intent.number) return { success: false, msg: `I need ${intent.contact}'s number for the message, sir.` };
      window.location.href = `sms:${intent.number}${intent.message ? `?body=${encodeURIComponent(intent.message)}` : ""}`;
      return { success: true, msg: `Drafting SMS to ${intent.contact || intent.number}, sir.` };
    case "navigate":
      window.open(`https://maps.google.com/?q=${encodeURIComponent(intent.destination)}`);
      return { success: true, msg: `Navigation to ${intent.destination} initiated, sir.` };
    case "youtube":
      window.open(`https://youtube.com/results?search_query=${encodeURIComponent(intent.query)}`);
      return { success: true, msg: `Pulling up ${intent.query} on YouTube, sir.` };
    case "search":
      window.open(`https://google.com/search?q=${encodeURIComponent(intent.query)}`);
      return { success: true, msg: `Searching for ${intent.query}, sir.` };
    case "email":
      window.location.href = `mailto:${intent.to || ""}?subject=${encodeURIComponent(intent.subject || "")}&body=${encodeURIComponent(intent.body || "")}`;
      return { success: true, msg: `Composing email to ${intent.to}, sir.` };
    case "alarm":
      return { success: true, msg: `Alarm set for ${intent.hour}:${String(intent.minute || 0).padStart(2, "0")}, sir.` };
    case "timer":
      return { success: true, timerSeconds: intent.seconds, msg: `Timer started for ${intent.label || intent.seconds + " seconds"}, sir.` };
    case "weather": {
      if (!location?.lat) return { success: false, msg: "Location access required for weather, sir." };
      const w = await getWeather(location.lat, location.lon);
      if (!w) return { success: false, msg: "Weather service unavailable, sir." };
      return { success: true, weatherData: w, msg: `Weather in ${w.city}: ${w.temp}°C, ${w.condition}. Wind at ${w.windspeed} km/h, sir.` };
    }
    case "battery":
      try {
        const bat = await (navigator as any).getBattery?.();
        if (bat) return { success: true, msg: `Battery is at ${Math.round(bat.level * 100)}%, ${bat.charging ? "currently charging" : "not charging"}, sir.` };
      } catch { /* ignore */ }
      return { success: false, msg: "Battery information unavailable in this browser, sir." };
    default:
      return null;
  }
}

// ══════════════════════════════════════════════════════════
//  UI ATOMS
// ══════════════════════════════════════════════════════════
const STATE_COLORS: Record<string, string> = { idle: "#00d4ff", listening: "#ff4455", thinking: "#c084fc", executing: "#34d399", searching: "#fbbf24", speaking: "#4ade80", building: "#fb923c", analyzing: "#22d3ee" };
const STATE_LABELS: Record<string, string> = { idle: "SYSTEMS ONLINE", listening: "VOICE CAPTURE ACTIVE", thinking: "NEURAL PROCESSING", executing: "EXECUTING COMMAND", searching: "SCANNING GLOBAL NETWORK", speaking: "TRANSMITTING RESPONSE", building: "CONSTRUCTING WEBSITE", analyzing: "ANALYZING IMAGE" };

function ArcReactor({ state }: { state: string }) {
  const c = STATE_COLORS[state] || "#00d4ff";
  const spin = ["listening", "searching", "executing", "building", "analyzing"].includes(state);
  return (
    <div style={{ position: "relative", width: 140, height: 140, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width="140" height="140" viewBox="0 0 140 140">
        <defs>
          <filter id="rg1"><feGaussianBlur stdDeviation="2.5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          <filter id="rg2"><feGaussianBlur stdDeviation="7" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          <radialGradient id="core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={c} stopOpacity="1" />
            <stop offset="100%" stopColor={c} stopOpacity="0.3" />
          </radialGradient>
        </defs>
        <circle cx="70" cy="70" r="65" fill="none" stroke="#0a1f30" strokeWidth="3" />
        <circle cx="70" cy="70" r="65" fill="none" stroke={c} strokeWidth="1.5" opacity="0.5" filter="url(#rg1)"
          strokeDasharray={spin ? "18 7" : "408"}
          style={{ transformOrigin: "70px 70px", animation: spin ? "reactorSpin 1.2s linear infinite" : "reactorSpin 12s linear infinite" }} />
        <circle cx="70" cy="70" r="50" fill="none" stroke={c} strokeWidth="1" opacity="0.3" filter="url(#rg1)"
          style={{ transformOrigin: "70px 70px", animation: "reactorSpinR 6s linear infinite" }} />
        {[0, 60, 120, 180, 240, 300].map((a, i) => (
          <g key={i} style={{ transformOrigin: "70px 70px", animation: `reactorSpin ${8 + i}s linear infinite` }}>
            <line x1={70 + 36 * Math.cos((a * Math.PI) / 180)} y1={70 + 36 * Math.sin((a * Math.PI) / 180)}
              x2={70 + 50 * Math.cos((a * Math.PI) / 180)} y2={70 + 50 * Math.sin((a * Math.PI) / 180)}
              stroke={c} strokeWidth="2.5" filter="url(#rg1)" opacity="0.8" />
          </g>
        ))}
        <circle cx="70" cy="70" r="30" fill="#020c18" stroke={c} strokeWidth="1" opacity="0.3" />
        <circle cx="70" cy="70" r="22" fill="none" stroke={c} strokeWidth="2.5" filter="url(#rg2)" opacity="0.9"
          style={{ animation: state === "speaking" ? "corePulse 0.5s ease-in-out infinite" : "corePulse 2.5s ease-in-out infinite" }} />
        <circle cx="70" cy="70" r="13" fill="url(#core)" filter="url(#rg2)" style={{ transition: "fill 0.4s" }} />
        <circle cx="70" cy="70" r="5" fill="#fff" opacity="0.9" filter="url(#rg2)" />
      </svg>
      {["thinking", "speaking", "executing", "building", "analyzing"].includes(state) && (
        <div style={{ position: "absolute", width: 165, height: 165, border: `1px solid ${c}25`, borderRadius: "50%", animation: "rippleOut 1.8s ease-out infinite" }} />
      )}
    </div>
  );
}

function Waveform({ active, color }: { active: boolean; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, height: 28 }}>
      {Array.from({ length: 32 }).map((_, i) => (
        <div key={i} style={{
          width: 2, borderRadius: 1, background: `linear-gradient(to top, ${color}44, ${color})`,
          height: active ? `${Math.random() * 22 + 3}px` : "2px",
          animation: active ? `wvBar ${0.3 + Math.random() * 0.5}s ease-in-out infinite alternate` : "none",
          animationDelay: `${i * 0.035}s`, opacity: active ? 1 : 0.2, transition: "height 0.1s ease",
          boxShadow: active ? `0 0 4px ${color}` : "none",
        }} />
      ))}
    </div>
  );
}

function AgentBadge({ agentId }: { agentId: string }) {
  const a = AGENT_META[agentId] || AGENT_META.jarvis;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 11px", background: `${a.color}14`, border: `1px solid ${a.color}40`, borderRadius: 20 }}>
      <span style={{ fontSize: 11 }}>{a.icon}</span>
      <span style={{ fontFamily: "'Orbitron',monospace", fontSize: 8, color: a.color, letterSpacing: 1.5 }}>{a.label}</span>
    </div>
  );
}

function WeatherBadge({ data }: { data: any }) {
  if (!data) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", background: "rgba(0,212,255,0.06)", border: "1px solid #00d4ff22", borderRadius: 20 }}>
      <span style={{ fontSize: 13 }}>{data.temp > 30 ? "☀️" : data.condition.includes("rain") ? "🌧️" : data.condition.includes("cloud") ? "☁️" : "🌤️"}</span>
      <span style={{ fontFamily: "'Orbitron',monospace", fontSize: 10, color: "#81d4fa" }}>{data.temp}°C</span>
      <span style={{ fontSize: 9, color: "#1a6a8a" }}>{data.city}</span>
    </div>
  );
}

function Corner({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const t = pos === "tl" || pos === "tr", r = pos === "tr" || pos === "br", b = pos === "bl" || pos === "br", l = pos === "tl" || pos === "bl";
  return <div style={{
    position: "absolute", top: t ? 0 : "auto", right: r ? 0 : "auto", bottom: b ? 0 : "auto", left: l ? 0 : "auto",
    width: 16, height: 16,
    borderTop: t ? "1px solid #00d4ff33" : "none", borderRight: r ? "1px solid #00d4ff33" : "none",
    borderBottom: b ? "1px solid #00d4ff33" : "none", borderLeft: l ? "1px solid #00d4ff33" : "none",
  }} />;
}

function ScanLine() {
  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none", overflow: "hidden", borderRadius: 6 }}>
      <div style={{ position: "absolute", left: 0, right: 0, height: 1, background: "linear-gradient(to right,transparent,#00d4ff22,#00d4ff88,#00d4ff22,transparent)", animation: "scanLine 6s linear infinite" }} />
    </div>
  );
}

function ActionCard({ intent, countdown, onExecute, onCancel }: { intent: any; countdown: number; onExecute: () => void; onCancel: () => void }) {
  const icons: Record<string, string> = { call: "📞", whatsapp: "💬", sms: "✉️", navigate: "🗺️", youtube: "▶️", search: "🔍", email: "📧", alarm: "⏰", timer: "⏱️", weather: "🌤️", battery: "🔋" };
  const labels: Record<string, string> = { call: "CALLING", whatsapp: "WHATSAPP", sms: "MESSAGE", navigate: "NAVIGATE", youtube: "YOUTUBE", search: "SEARCH", email: "EMAIL", alarm: "ALARM", timer: "TIMER", weather: "WEATHER", battery: "BATTERY" };
  return (
    <div style={{ width: "100%", padding: "14px 16px", background: "linear-gradient(135deg,rgba(0,25,45,0.98),rgba(0,15,30,0.99))", border: "1px solid #00d4ff55", borderRadius: 6, animation: "slideUp 0.3s cubic-bezier(0.16,1,0.3,1)", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(to right,transparent,#00d4ff,transparent)", animation: "shimmer 1.5s linear infinite" }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>{icons[intent.action]}</span>
          <div>
            <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 9, color: "#00d4ff", letterSpacing: 2 }}>{labels[intent.action] || "ACTION"} QUEUED</div>
            <div style={{ fontSize: 12, color: "#81d4fa", marginTop: 2 }}>
              {intent.contact || intent.destination || intent.query || intent.to || (intent.hour != null ? `${intent.hour}:${String(intent.minute || 0).padStart(2, "0")}` : "") || "Executing..."}
              {intent.message ? ` — "${intent.message.slice(0, 30)}${intent.message.length > 30 ? "..." : ""}"` : ""}
            </div>
          </div>
        </div>
        <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 22, color: "#fbbf24", minWidth: 32, textAlign: "center" }}>{countdown}</div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onExecute} style={{ flex: 1, padding: 9, fontFamily: "'Orbitron',monospace", fontSize: 10, letterSpacing: 2, background: "linear-gradient(135deg,#003a5a,#005580)", border: "1px solid #00d4ff", color: "#00d4ff", borderRadius: 3, cursor: "pointer", boxShadow: "0 0 12px #00d4ff33" }}>EXECUTE NOW</button>
        <button onClick={onCancel} style={{ flex: 1, padding: 9, fontFamily: "'Orbitron',monospace", fontSize: 10, letterSpacing: 2, background: "linear-gradient(135deg,#3a000a,#550010)", border: "1px solid #ff4455", color: "#ff4455", borderRadius: 3, cursor: "pointer" }}>ABORT</button>
      </div>
      <div style={{ marginTop: 10, height: 2, background: "#0a2030", borderRadius: 1, overflow: "hidden" }}>
        <div style={{ height: "100%", background: "#fbbf24", width: `${(countdown / 3) * 100}%`, transition: "width 0.9s linear", boxShadow: "0 0 6px #fbbf24" }} />
      </div>
    </div>
  );
}

function TimerWidget({ seconds, label, onDone }: { seconds: number; label?: string; onDone?: () => void }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (left <= 0) { onDone?.(); return; }
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  const pct = (left / seconds) * 100, m = Math.floor(left / 60), s = left % 60;
  return (
    <div style={{ padding: "10px 14px", background: "rgba(0,20,40,0.9)", border: "1px solid #fbbf2444", borderRadius: 6, textAlign: "center" }}>
      <div style={{ fontSize: 8, color: "#fbbf24", letterSpacing: 2, marginBottom: 4 }}>⏱️ {label || "TIMER"}</div>
      <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 20, color: "#fbbf24" }}>{m}:{String(s).padStart(2, "0")}</div>
      <div style={{ marginTop: 8, height: 2, background: "#0a2030", borderRadius: 1, overflow: "hidden" }}>
        <div style={{ height: "100%", background: "#fbbf24", width: `${pct}%`, transition: "width 1s linear" }} />
      </div>
    </div>
  );
}

function WebsitePreview({ result, onClose }: { result: { html: string; summary: string } | null; onClose: () => void }) {
  if (!result) return null;
  const download = () => {
    const blob = new Blob([result.html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "jarvis-website.html"; a.click();
    URL.revokeObjectURL(url);
  };
  const copy = () => { navigator.clipboard?.writeText(result.html); };
  return (
    <div className="card" style={{ width: "100%", padding: 14, animation: "slideUp 0.3s ease" }}>
      <Corner pos="tl" /><Corner pos="br" />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <AgentBadge agentId="builder" />
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#ff6677", fontSize: 16, cursor: "pointer" }}>✕</button>
      </div>
      <iframe srcDoc={result.html} sandbox="allow-scripts" title="Website preview"
        style={{ width: "100%", height: 240, border: "1px solid #0a2a40", borderRadius: 4, background: "#fff" }} />
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button className="btn active" onClick={copy} style={{ flex: 1 }}>COPY CODE</button>
        <button className="btn active" onClick={download} style={{ flex: 1 }}>DOWNLOAD .HTML</button>
      </div>
    </div>
  );
}

function MemoryPanel({ memory, onAdd, onDelete }: {
  memory: Memory;
  onAdd: (cat: keyof Memory, title: string, content: string) => void;
  onDelete: (cat: keyof Memory, id: string) => void;
}) {
  const [cat, setCat] = useState<"project" | "client" | "task" | "preference">("project");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const catMap: Record<string, keyof Memory> = { project: "projects", client: "clients", task: "tasks", preference: "preferences" };
  const labels: Record<string, string> = { projects: "📁 PROJECTS", clients: "👤 CLIENTS", tasks: "✅ TASKS", preferences: "⚙️ PREFERENCES" };

  return (
    <div className="card" style={{ width: "100%", padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
      <Corner pos="tl" /><Corner pos="br" />
      <div style={{ fontSize: 8, color: "#0a5070", letterSpacing: 2 }}>LONG-TERM MEMORY — PERSISTS ACROSS SESSIONS</div>

      {MEMORY_CATEGORIES.map((catKey) => (
        <div key={catKey}>
          <div style={{ fontSize: 9, color: "#22d3ee", letterSpacing: 1.5, marginBottom: 6 }}>{labels[catKey]} ({memory[catKey]?.length || 0})</div>
          {(!memory[catKey] || memory[catKey].length === 0) && (
            <div style={{ fontSize: 10, color: "#0a3050", fontStyle: "italic", marginBottom: 4 }}>Nothing logged yet.</div>
          )}
          {memory[catKey]?.map((entry) => (
            <div key={entry.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, padding: "6px 9px", background: "rgba(0,212,255,0.04)", border: "1px solid #0a3050", borderRadius: 4, marginBottom: 5 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: "#81d4fa", fontWeight: 600 }}>{entry.title}</div>
                <div style={{ fontSize: 10, color: "#5a8aa5", marginTop: 1 }}>{entry.content}</div>
              </div>
              <button onClick={() => onDelete(catKey, entry.id)} style={{ background: "none", border: "none", color: "#ff6677", fontSize: 13, cursor: "pointer", padding: 0 }}>✕</button>
            </div>
          ))}
        </div>
      ))}

      <div style={{ borderTop: "1px solid #0a2a40", paddingTop: 10, display: "flex", flexDirection: "column", gap: 7 }}>
        <div style={{ fontSize: 8, color: "#1a6a8a", letterSpacing: 1.5 }}>ADD NEW ENTRY</div>
        <select value={cat} onChange={(e) => setCat(e.target.value as any)} style={{ background: "rgba(0,10,20,0.9)", border: "1px solid #0a3050", borderRadius: 3, color: "#4fc3f7", fontFamily: "'Share Tech Mono',monospace", fontSize: 11, padding: "7px 9px", outline: "none" }}>
          <option value="project">Project</option>
          <option value="client">Client</option>
          <option value="task">Task</option>
          <option value="preference">Preference</option>
        </select>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (e.g. Auto Galle NG)"
          style={{ background: "rgba(0,10,20,0.9)", border: "1px solid #0a3050", borderRadius: 3, color: "#4fc3f7", fontFamily: "'Share Tech Mono',monospace", fontSize: 11, padding: "7px 9px", outline: "none" }} />
        <input value={content} onChange={(e) => setContent(e.target.value)} placeholder="Details"
          style={{ background: "rgba(0,10,20,0.9)", border: "1px solid #0a3050", borderRadius: 3, color: "#4fc3f7", fontFamily: "'Share Tech Mono',monospace", fontSize: 11, padding: "7px 9px", outline: "none" }} />
        <button className="btn active" onClick={() => {
          if (!title.trim()) return;
          onAdd(catMap[cat], title.trim(), content.trim());
          setTitle(""); setContent("");
        }}>+ ADD TO MEMORY</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ══════════════════════════════════════════════════════════
type ChatMessage = { role: "user" | "assistant"; content: string; agent?: string; searches?: string[] };

function JARVIS() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [state, setState] = useState<string>("idle");
  const [activeAgent, setActiveAgent] = useState("jarvis");
  const [transcript, setTranscript] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [location, setLocation] = useState<{ lat: number; lon: number; city?: string } | null>(null);
  const [weather, setWeather] = useState<any>(null);
  const [battery, setBattery] = useState<{ level: number; charging: boolean } | null>(null);
  const [pendingAction, setPendingAction] = useState<any>(null);
  const [countdown, setCountdown] = useState(3);
  const [activeTimer, setActiveTimer] = useState<{ seconds: number; label?: string } | null>(null);
  const [lastActionMsg, setLastActionMsg] = useState("");
  const [websiteResult, setWebsiteResult] = useState<{ html: string; summary: string } | null>(null);
  const [memory, setMemory] = useState<Memory>({ projects: [], clients: [], tasks: [], preferences: [] });
  const [showChat, setShowChat] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [elevenKey, setElevenKey] = useState("");
  const [textInput, setTextInput] = useState("");
  const [pendingImage, setPendingImage] = useState<{ mediaType: string; data: string; previewUrl: string } | null>(null);
  const [time, setTime] = useState<Date | null>(null);

  const recRef = useRef<any>(null);
  const liveRef = useRef("");
  const chatRef = useRef<HTMLDivElement>(null);
  const countdownRef = useRef<any>(null);
  const pendingRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const memoryRef = useRef<Memory>(memory);
  memoryRef.current = memory;

  const routeIntentFn = useServerFn(routeIntent);
  const chatAgenticFn = useServerFn(chatAgentic);
  const buildWebsiteFn = useServerFn(buildWebsite);
  const synthesizeSpeechFn = useServerFn(synthesizeSpeech);

  const color = STATE_COLORS[state] || "#00d4ff";

  useEffect(() => { setTime(new Date()); const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; }, [messages]);
  useEffect(() => { setMemory(loadMemory()); }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const loc = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      setLocation(loc);
      const w = await getWeather(loc.lat, loc.lon);
      if (w) { setWeather(w); setLocation((prev) => ({ ...(prev || loc), city: w.city })); }
    }, undefined, { enableHighAccuracy: true });
  }, []);

  useEffect(() => {
    (navigator as any).getBattery?.().then((bat: any) => {
      const update = () => setBattery({ level: Math.round(bat.level * 100), charging: bat.charging });
      update(); bat.onlevelchange = update; bat.onchargingchange = update;
    }).catch(() => { /* ignore */ });
  }, []);

  // Memory mutators
  const addMemoryEntry = useCallback((category: keyof Memory, title: string, content: string) => {
    const entry: MemEntry = { id: Date.now().toString(36), title, content };
    setMemory((prev) => {
      const updated: Memory = { ...prev, [category]: [...(prev[category] || []), entry] };
      saveMemoryCategory(category, updated[category]);
      return updated;
    });
  }, []);
  const deleteMemoryEntry = useCallback((category: keyof Memory, id: string) => {
    setMemory((prev) => {
      const updated: Memory = { ...prev, [category]: prev[category].filter((e) => e.id !== id) };
      saveMemoryCategory(category, updated[category]);
      return updated;
    });
  }, []);

  // Voice output: user key > server secret > browser TTS
  const finishWithVoice = useCallback((text: string) => {
    if (voiceOn) {
      setState("speaking");
      const done = () => { setState("idle"); setSearchQuery(""); };
      if (elevenKey) speakElevenLabs(text, elevenKey, done);
      else speakElevenLabsServer(text, synthesizeSpeechFn, done);
    } else {
      setState("idle");
    }
  }, [voiceOn, elevenKey, synthesizeSpeechFn]);

  const handleApiError = useCallback(() => {
    const err = "System anomaly detected, sir. Please verify connectivity.";
    setMessages((prev) => [...prev, { role: "assistant", content: err, agent: "jarvis" }]);
    if (voiceOn) speakFallback(err, () => setState("idle")); else setState("idle");
  }, [voiceOn]);

  const respondAsJarvisCore = useCallback(async (contextTag: string | null, baseMsgs: ChatMessage[]) => {
    setActiveAgent("jarvis");
    setState("thinking");
    try {
      const memCtx = buildMemoryContext(memoryRef.current);
      const sys = `${JARVIS_SYSTEM}\n\n${memCtx}`;
      const lastUser = baseMsgs[baseMsgs.length - 1];
      const augmented = contextTag && lastUser
        ? [...baseMsgs.slice(0, -1), { ...lastUser, content: lastUser.content + "\n" + contextTag }]
        : baseMsgs;
      const apiMsgs: ApiMessage[] = augmented.map((m) => ({ role: m.role, content: m.content }));
      const { reply, searches } = await chatAgenticFn({ data: { system: sys, messages: apiMsgs, useTools: true } });
      setMessages((prev) => [...prev, { role: "assistant", content: reply, agent: "jarvis", searches }]);
      finishWithVoice(reply);
    } catch { handleApiError(); }
  }, [finishWithVoice, handleApiError, chatAgenticFn]);

  // Execute pending action
  const runPendingAction = useCallback(async () => {
    const intent = pendingRef.current;
    if (!intent) return;
    setPendingAction(null);
    clearInterval(countdownRef.current);
    setState("executing");
    const result = await executeAction(intent, location);
    if (!result) return;
    if ((result as any).timerSeconds) setActiveTimer({ seconds: (result as any).timerSeconds, label: intent.label });
    setLastActionMsg(result.msg);
    const tag = result.success ? `[ACTION_EXECUTED: ${result.msg}]` : `[ACTION_NEEDED: ${result.msg}]`;
    await respondAsJarvisCore(tag, messages);
  }, [location, messages, respondAsJarvisCore]);

  const cancelPendingAction = () => {
    setPendingAction(null);
    clearInterval(countdownRef.current);
    setState("idle");
    setLastActionMsg("Action aborted, sir.");
  };

  useEffect(() => {
    if (!pendingAction) return;
    setCountdown(3);
    clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { clearInterval(countdownRef.current); runPendingAction(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(countdownRef.current);
  }, [pendingAction, runPendingAction]);

  // Image handling
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [header, dataPart] = result.split(",");
      const mediaType = header.match(/data:(.*);base64/)?.[1] || "image/png";
      setPendingImage({ mediaType, data: dataPart, previewUrl: result });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Main dispatch
  const sendToJarvis = useCallback(async (userText: string, imageAttachment?: { mediaType: string; data: string } | null) => {
    if (!userText?.trim() && !imageAttachment) return;
    if (state !== "idle") return;

    const displayContent = imageAttachment ? (userText || "[Image attached]") : userText;
    const newMsgs: ChatMessage[] = [...messages, { role: "user", content: displayContent }];
    setMessages(newMsgs);

    // Vision path
    if (imageAttachment) {
      setActiveAgent("jarvis");
      setState("analyzing");
      try {
        const memCtx = buildMemoryContext(memoryRef.current);
        const history: ApiMessage[] = messages.map((m) => ({ role: m.role, content: m.content }));
        const apiMsgs: ApiMessage[] = [...history, {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: imageAttachment.mediaType, data: imageAttachment.data } },
            { type: "text", text: userText || "Analyze this image, sir." },
          ],
        }];
        const { reply } = await chatAgenticFn({ data: { system: `${JARVIS_SYSTEM}\n\n${memCtx}`, messages: apiMsgs, useTools: false, maxTokens: 1200 } });
        setMessages((prev) => [...prev, { role: "assistant", content: reply, agent: "jarvis" }]);
        finishWithVoice(reply);
      } catch { handleApiError(); }
      return;
    }

    setState("thinking");
    let intent: any;
    try { intent = await routeIntentFn({ data: { text: userText } }); }
    catch { intent = { action: "chat" }; }

    // Remember
    if (intent.action === "remember") {
      setActiveAgent("memory");
      addMemoryEntry((intent.category ? (intent.category + "s") as keyof Memory : "tasks"), intent.title || "Untitled", intent.content || "");
      const msg = `Noted, sir. I've logged "${intent.title || "that"}" under ${(intent.category || "task")}s.`;
      setMessages((prev) => [...prev, { role: "assistant", content: msg, agent: "memory" }]);
      finishWithVoice(msg);
      return;
    }

    // Specialist agent
    if (intent.action === "agent" && AGENTS[intent.agent]) {
      setActiveAgent(intent.agent);
      try {
        const memCtx = buildMemoryContext(memoryRef.current);
        const sys = `${JARVIS_SYSTEM}\n\n${AGENTS[intent.agent].prompt}\n\n${memCtx}`;
        const apiMsgs: ApiMessage[] = newMsgs.map((m) => ({ role: m.role, content: m.content }));
        setState("thinking");
        const { reply, searches } = await chatAgenticFn({ data: { system: sys, messages: apiMsgs, useTools: true } });
        setMessages((prev) => [...prev, { role: "assistant", content: reply, agent: intent.agent, searches }]);
        finishWithVoice(reply);
      } catch { handleApiError(); }
      return;
    }

    // Builder
    if (intent.action === "build_website") {
      setActiveAgent("builder");
      setState("building");
      try {
        const memCtx = buildMemoryContext(memoryRef.current);
        const { html, summary } = await buildWebsiteFn({ data: { description: intent.description || userText, memoryContext: memCtx } });
        setWebsiteResult({ html, summary });
        setMessages((prev) => [...prev, { role: "assistant", content: summary, agent: "builder" }]);
        finishWithVoice(summary);
      } catch { handleApiError(); }
      return;
    }

    // Confirmable
    const confirmable = ["call", "whatsapp", "sms"];
    if (confirmable.includes(intent.action) && intent.number) {
      pendingRef.current = intent;
      setPendingAction(intent);
      const msg = `I've detected a ${intent.action} command to ${intent.contact || intent.number}, sir. Execute?`;
      if (voiceOn) (elevenKey ? speakElevenLabs(msg, elevenKey) : speakFallback(msg));
      setState("idle");
      return;
    }

    // Immediate
    const immediateActions = ["navigate", "youtube", "search", "email", "alarm", "timer", "weather", "battery"];
    if (immediateActions.includes(intent.action)) {
      setState("executing");
      const result = await executeAction(intent, location);
      if (result) {
        if ((result as any).timerSeconds) setActiveTimer({ seconds: (result as any).timerSeconds, label: intent.label });
        setLastActionMsg(result.msg);
        const tag = result.success ? `[ACTION_EXECUTED: ${result.msg}]` : `[ACTION_NEEDED: ${result.msg}]`;
        await respondAsJarvisCore(tag, newMsgs);
        return;
      }
    }

    await respondAsJarvisCore(null, newMsgs);
  }, [state, messages, location, voiceOn, elevenKey, addMemoryEntry, finishWithVoice, handleApiError, respondAsJarvisCore, routeIntentFn, chatAgenticFn, buildWebsiteFn]);

  // Voice input
  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert("Use Chrome for voice recognition."); return; }
    if (state !== "idle") return;
    window.speechSynthesis?.cancel();
    liveRef.current = ""; setTranscript("");
    const rec = new SR();
    rec.continuous = false; rec.interimResults = true; rec.lang = "en-US";
    rec.onstart = () => setState("listening");
    rec.onresult = (e: any) => { const t = Array.from(e.results).map((r: any) => r[0].transcript).join(""); liveRef.current = t; setTranscript(t); };
    rec.onend = () => { const said = liveRef.current; setTranscript(""); if (said.trim()) sendToJarvis(said); else setState("idle"); };
    rec.onerror = () => setState("idle");
    recRef.current = rec;
    rec.start();
  }, [state, sendToJarvis]);

  const stopListening = () => recRef.current?.stop();

  const handleText = () => {
    if (state !== "idle") return;
    if (!textInput.trim() && !pendingImage) return;
    const img = pendingImage;
    setPendingImage(null);
    const txt = textInput;
    setTextInput("");
    sendToJarvis(txt, img);
  };

  const lastJarvisMsg = [...messages].reverse().find((m) => m.role === "assistant");

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;900&family=Share+Tech+Mono&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{background:#000;}
        @keyframes reactorSpin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
        @keyframes reactorSpinR{0%{transform:rotate(0deg)}100%{transform:rotate(-360deg)}}
        @keyframes corePulse{0%,100%{opacity:0.65}50%{opacity:1}}
        @keyframes rippleOut{0%{transform:scale(1);opacity:0.5}100%{transform:scale(1.4);opacity:0}}
        @keyframes scanLine{0%{top:-2px}100%{top:100%}}
        @keyframes shimmer{0%{background-position:200% center}100%{background-position:-200% center}}
        @keyframes slideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
        @keyframes wvBar{from{transform:scaleY(0.15)}to{transform:scaleY(1)}}
        @keyframes pulse{0%,100%{opacity:0.45}50%{opacity:1}}
        @keyframes blinkCursor{0%,100%{opacity:1}50%{opacity:0}}
        .card{background:linear-gradient(145deg,rgba(0,16,32,0.97),rgba(0,8,18,0.99));border:1px solid #0a2a44;border-radius:6px;position:relative;}
        .btn{background:linear-gradient(135deg,#061524,#0a2030);border:1px solid #1a4a6a;color:#4fc3f7;font-family:'Orbitron',monospace;font-size:10px;letter-spacing:1.5px;cursor:pointer;padding:8px 13px;border-radius:3px;transition:all 0.2s;text-transform:uppercase;}
        .btn:hover{border-color:#00d4ff;color:#00d4ff;box-shadow:0 0 10px #00d4ff22;}
        .btn.active{border-color:#00d4ff;color:#00d4ff;box-shadow:0 0 14px #00d4ff33;}
        .btn:disabled{opacity:0.35;cursor:not-allowed;}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-thumb{background:#0a3050;border-radius:2px}
      `}</style>

      <div style={{
        minHeight: "100vh",
        background: "radial-gradient(ellipse at 20% 10%,#001525 0%,#000812 50%,#000000 100%)",
        display: "flex", flexDirection: "column", alignItems: "center",
        fontFamily: "'Share Tech Mono',monospace", color: "#4fc3f7",
        padding: "12px 12px 48px", gap: 9,
      }}>

        {/* TOP BAR */}
        <div style={{ width: "100%", maxWidth: 480, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <div style={{ fontSize: 8, color: "#0a4060", letterSpacing: 2 }}>J.A.R.V.I.S v6.0</div>
            {location?.city && <div style={{ fontSize: 8, color: "#0a5070", letterSpacing: 1 }}>📍 {location.city}</div>}
          </div>
          <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 15, color: "#00d4ff", letterSpacing: 3, animation: "pulse 4s ease-in-out infinite", textShadow: "0 0 12px #00d4ff" }}>
            {time ? time.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "--:--:--"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1, alignItems: "flex-end" }}>
            <div style={{ fontSize: 8, color: "#0a4060", letterSpacing: 2 }}>STARK IND.</div>
            {battery && <div style={{ fontSize: 8, color: battery.charging ? "#4ade80" : "#fbbf24", letterSpacing: 1 }}>{battery.charging ? "⚡" : "🔋"} {battery.level}%</div>}
          </div>
        </div>

        {/* MAIN HUD */}
        <div className="card" style={{ width: "100%", maxWidth: 480, padding: "20px 16px", overflow: "hidden" }}>
          <ScanLine />
          <Corner pos="tl" /><Corner pos="tr" /><Corner pos="bl" /><Corner pos="br" />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>

            {weather && <WeatherBadge data={weather} />}
            <ArcReactor state={state} />
            <AgentBadge agentId={activeAgent} />

            <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 10, letterSpacing: 2.5, color, textShadow: `0 0 8px ${color}`, textAlign: "center", transition: "color 0.3s", minHeight: 14 }}>
              {STATE_LABELS[state]}
            </div>

            {state === "searching" && searchQuery && (
              <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 12px", background: "rgba(251,191,36,0.07)", border: "1px solid #fbbf2422", borderRadius: 20, animation: "fadeUp 0.2s ease" }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#fbbf24", animation: "blinkCursor 0.5s step-end infinite" }} />
                <span style={{ fontSize: 9, color: "#fbbf24", letterSpacing: 1 }}>{searchQuery.slice(0, 40)}</span>
              </div>
            )}

            <Waveform active={state === "listening" || state === "speaking"} color={color} />

            {transcript && (
              <div style={{ fontSize: 12, color: "#81d4fa", fontStyle: "italic", textAlign: "center", maxWidth: 340, lineHeight: 1.5, padding: "6px 12px", background: "rgba(0,212,255,0.05)", border: "1px solid #0a2a40", borderRadius: 4, animation: "fadeUp 0.2s ease" }}>
                "{transcript}"
              </div>
            )}

            {lastJarvisMsg && state === "idle" && (
              <div style={{ fontSize: 12, color: "#b0c8d8", textAlign: "center", maxWidth: 400, lineHeight: 1.7, padding: "10px 14px", background: "rgba(0,40,70,0.2)", border: "1px solid #0a2035", borderRadius: 4, animation: "fadeUp 0.4s ease" }}>
                {lastJarvisMsg.searches && lastJarvisMsg.searches.length > 0 && (
                  <div style={{ fontSize: 8, color: "#fbbf2466", marginBottom: 5, letterSpacing: 1 }}>🔍 {lastJarvisMsg.searches.join(" · ")}</div>
                )}
                <span style={{ color: "#00d4ff88", fontSize: 8, letterSpacing: 2 }}>JARVIS › </span>{lastJarvisMsg.content}
              </div>
            )}

            {lastActionMsg && state === "idle" && (
              <div style={{ fontSize: 10, color: "#34d39988", letterSpacing: 1, fontStyle: "italic" }}>✓ {lastActionMsg}</div>
            )}
          </div>
        </div>

        {pendingAction && (
          <div style={{ width: "100%", maxWidth: 480 }}>
            <ActionCard intent={pendingAction} countdown={countdown} onExecute={runPendingAction} onCancel={cancelPendingAction} />
          </div>
        )}

        {activeTimer && (
          <div style={{ width: "100%", maxWidth: 480 }}>
            <TimerWidget seconds={activeTimer.seconds} label={activeTimer.label}
              onDone={() => { setActiveTimer(null); if (voiceOn) speakFallback("Timer complete, sir."); }} />
          </div>
        )}

        {websiteResult && (
          <div style={{ width: "100%", maxWidth: 480 }}>
            <WebsitePreview result={websiteResult} onClose={() => setWebsiteResult(null)} />
          </div>
        )}

        {/* STATS */}
        <div style={{ width: "100%", maxWidth: 480, display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 7 }}>
          {[
            { label: "WEB SEARCH", value: "LIVE", c: "#4ade80" },
            { label: "AGENTS", value: "5 ONLINE", c: "#c084fc" },
            { label: "MEMORY", value: `${memory.projects.length + memory.clients.length + memory.tasks.length + memory.preferences.length} ENTRIES`, c: "#22d3ee" },
            { label: "VOICE", value: elevenKey ? "ELEVEN AI" : "SYSTEM", c: elevenKey ? "#c084fc" : "#64748b" },
          ].map(({ label, value, c }) => (
            <div key={label} className="card" style={{ padding: "6px 7px", textAlign: "center" }}>
              <Corner pos="tl" /><Corner pos="br" />
              <div style={{ fontSize: 7, color: "#1a5a7a", letterSpacing: 1, marginBottom: 3 }}>{label}</div>
              <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 8, color: c, letterSpacing: 0.5 }}>{value}</div>
            </div>
          ))}
        </div>

        {/* HOLD TO SPEAK */}
        <div style={{ width: "100%", maxWidth: 480 }}>
          <button className={`btn ${state === "listening" ? "active" : ""}`} disabled={!["idle", "listening"].includes(state)}
            onMouseDown={startListening} onMouseUp={stopListening}
            onTouchStart={(e) => { e.preventDefault(); startListening(); }} onTouchEnd={(e) => { e.preventDefault(); stopListening(); }}
            style={{
              width: "100%", padding: 14, fontSize: 12, letterSpacing: 3,
              border: state === "listening" ? "1px solid #ff4455" : "1px solid #00d4ff55",
              color: state === "listening" ? "#ff4455" : "#00d4ff",
              boxShadow: state === "listening" ? "0 0 24px #ff445544" : "0 0 14px #00d4ff22",
              background: state === "listening" ? "linear-gradient(135deg,#1a0008,#2a000e)" : "linear-gradient(135deg,#020c18,#04162a)",
            }}>
            {state === "listening" ? "⬛  RELEASE TO PROCESS" : "🎤  HOLD TO SPEAK"}
          </button>
        </div>

        {/* IMAGE PREVIEW */}
        {pendingImage && (
          <div style={{ width: "100%", maxWidth: 480, display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "rgba(0,212,255,0.06)", border: "1px solid #00d4ff33", borderRadius: 6 }}>
            <img src={pendingImage.previewUrl} alt="attachment" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 4 }} />
            <span style={{ fontSize: 10, color: "#81d4fa", flex: 1 }}>Image attached — add a caption or just hit send</span>
            <button onClick={() => setPendingImage(null)} style={{ background: "none", border: "none", color: "#ff6677", fontSize: 14, cursor: "pointer" }}>✕</button>
          </div>
        )}

        {/* TEXT INPUT */}
        <div style={{ width: "100%", maxWidth: 480, display: "flex", gap: 8 }}>
          <input value={textInput} onChange={(e) => setTextInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleText()}
            disabled={state !== "idle"} placeholder="Type a command, sir..."
            style={{ flex: 1, background: "rgba(0,12,24,0.95)", border: "1px solid #0a2a40", borderRadius: 3, color: "#4fc3f7", fontFamily: "'Share Tech Mono',monospace", fontSize: 12, padding: "10px 13px", outline: "none", opacity: state !== "idle" ? 0.5 : 1 }} />
          <input type="file" accept="image/*" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileSelect} />
          <button className="btn" onClick={() => fileInputRef.current?.click()} disabled={state !== "idle"} style={{ padding: "10px 12px" }}>📷</button>
          <button className="btn active" onClick={handleText} disabled={state !== "idle"} style={{ padding: "10px 14px" }}>SEND</button>
        </div>

        {/* CONTROLS */}
        <div style={{ width: "100%", maxWidth: 480, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className={`btn ${showChat ? "active" : ""}`} onClick={() => setShowChat((v) => !v)} style={{ flex: 1, minWidth: 90 }}>LOG ({messages.length})</button>
          <button className={`btn ${voiceOn ? "active" : ""}`} onClick={() => setVoiceOn((v) => !v)} style={{ flex: 1, minWidth: 90 }}>VOICE {voiceOn ? "ON" : "OFF"}</button>
          <button className={`btn ${showMemory ? "active" : ""}`} onClick={() => setShowMemory((v) => !v)} style={{ flex: 1, minWidth: 90 }}>🧠 MEMORY</button>
          <button className={`btn ${showKeys ? "active" : ""}`} onClick={() => setShowKeys((v) => !v)} style={{ flex: 1, minWidth: 90 }}>KEYS</button>
        </div>

        {showKeys && (
          <div className="card" style={{ width: "100%", maxWidth: 480, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            <Corner pos="tl" /><Corner pos="br" />
            <div>
              <div style={{ fontSize: 8, color: "#0a5070", letterSpacing: 2, marginBottom: 5 }}>ELEVENLABS API KEY — DANIEL VOICE (FREE AT ELEVENLABS.IO)</div>
              <input type="password" value={elevenKey} onChange={(e) => setElevenKey(e.target.value)} placeholder="sk_..."
                style={{ width: "100%", background: "rgba(0,6,14,0.95)", border: "1px solid #0a2a40", borderRadius: 3, color: "#c084fc", fontFamily: "'Share Tech Mono',monospace", fontSize: 11, padding: "8px 11px", outline: "none" }} />
            </div>
            <div style={{ fontSize: 8, color: "#061828", letterSpacing: 1 }}>KEYS ARE SESSION-ONLY. AUTO-CLEARED ON CLOSE.</div>
          </div>
        )}

        {showMemory && <MemoryPanel memory={memory} onAdd={addMemoryEntry} onDelete={deleteMemoryEntry} />}

        {showChat && (
          <div className="card" style={{ width: "100%", maxWidth: 480, padding: 14 }}>
            <Corner pos="tl" /><Corner pos="br" />
            <div style={{ fontSize: 8, color: "#0a5070", letterSpacing: 2, marginBottom: 10 }}>TRANSMISSION LOG — {messages.length} ENTRIES</div>
            <div ref={chatRef} style={{ maxHeight: 380, overflowY: "auto", display: "flex", flexDirection: "column", gap: 9 }}>
              {messages.length === 0 && <div style={{ color: "#061828", fontSize: 11, textAlign: "center", padding: 20 }}>No transmissions recorded.</div>}
              {messages.map((m, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: m.role === "user" ? "flex-end" : "flex-start", animation: "fadeUp 0.25s ease" }}>
                  <div style={{ fontSize: 7, color: "#0a4060", letterSpacing: 2 }}>{m.role === "user" ? "YOU ›" : "‹ " + (AGENT_META[m.agent || "jarvis"]?.label || "JARVIS")}</div>
                  {m.searches && m.searches.length > 0 && <div style={{ fontSize: 8, color: "#fbbf2255", alignSelf: "flex-start" }}>🔍 {m.searches.join(", ")}</div>}
                  <div style={{
                    maxWidth: "88%", padding: "8px 12px",
                    background: m.role === "user" ? "rgba(0,25,50,0.7)" : "rgba(0,50,30,0.3)",
                    border: m.role === "user" ? "1px solid #0a2540" : "1px solid #0a2820",
                    borderRadius: m.role === "user" ? "7px 2px 7px 7px" : "2px 7px 7px 7px",
                    fontSize: 12, color: m.role === "user" ? "#81d4fa" : "#86efac", lineHeight: 1.65,
                  }}>{m.content}</div>
                </div>
              ))}
              {["thinking", "searching", "executing", "building", "analyzing"].includes(state) && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                  <div style={{ fontSize: 7, color: "#0a4060", letterSpacing: 2 }}>‹ {AGENT_META[activeAgent]?.label}</div>
                  <div style={{ padding: "8px 14px", background: "rgba(0,50,30,0.3)", border: "1px solid #0a2820", borderRadius: "2px 7px 7px 7px", fontSize: 12, color }}>
                    {state === "searching" ? `Scanning "${searchQuery}"...` : state === "building" ? "Constructing site..." : state === "executing" ? "Executing..." : state === "analyzing" ? "Analyzing image..." : "Processing"}
                    <span style={{ animation: "blinkCursor 0.6s step-end infinite" }}>▋</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </>
  );
}
