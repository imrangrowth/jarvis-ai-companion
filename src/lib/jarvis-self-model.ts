// JARVIS self-model — identity, capabilities, self-inspection.
// Built from jarvis-capability-registry.json; safe for client + server.
import registry from "./jarvis-capability-registry.json";

type Registry = typeof registry;

export class SelfInspectionTools {
  registry: Registry;
  constructor() { this.registry = registry; }
  getIdentity() { return this.registry.system; }
  getBrainArchitecture() { return this.registry.brainArchitecture; }
  getAgents() {
    const layer = this.registry.brainArchitecture.layers.find((l: any) => l.name === "AGENT_NETWORK");
    return (layer as any)?.agents ?? [];
  }
  getExecutableActions() {
    const layer = this.registry.brainArchitecture.layers.find((l: any) => l.name === "EXECUTION_LAYER");
    return (layer as any)?.actions ?? [];
  }
  getCapabilities() { return (this.registry as any).capabilities ?? {}; }
  getLimitations() { return (this.registry as any).limitations ?? {}; }
  getPersonality() { return (this.registry as any).personality ?? {}; }
  getGoals() { return (this.registry as any).goals ?? {}; }
  getAllAboutMe() {
    return {
      identity: this.registry.system,
      brain: this.registry.brainArchitecture,
      capabilities: this.getCapabilities(),
      limitations: this.getLimitations(),
      personality: this.getPersonality(),
      goals: this.getGoals(),
    };
  }
}

export class SystemStatusMonitor {
  db: any; eleven: boolean; claude: boolean;
  constructor(supabaseClient: any, elevenKey?: string | boolean, claudeKey?: string | boolean) {
    this.db = supabaseClient; this.eleven = !!elevenKey; this.claude = !!claudeKey;
  }
  async getSystemStatus() {
    const apiConnections = {
      supabase: this.db ? "CONNECTED" : "DISCONNECTED",
      claude: this.claude ? "READY" : "NEEDS_KEY",
      elevenlabs: this.eleven ? "READY" : "NEEDS_KEY",
      coingecko: "LIVE",
      lovable: "CONNECTED",
    };
    let memory: any = { status: "UNKNOWN" };
    if (this.db) {
      try {
        const [c, p, k] = await Promise.all([
          this.db.from("jarvis_conversations").select("*", { count: "exact", head: true }),
          this.db.from("jarvis_patterns").select("*", { count: "exact", head: true }),
          this.db.from("jarvis_knowledge").select("*", { count: "exact", head: true }),
        ]);
        memory = { status: "OPERATIONAL", conversations: c.count ?? 0, patterns: p.count ?? 0, knowledge_items: k.count ?? 0 };
      } catch (e: any) { memory = { status: "ERROR", reason: e?.message }; }
    }
    return {
      timestamp: new Date().toISOString(),
      brainOperational: true,
      systems: { memory_cortex: memory, reasoning_engine: { status: "OPERATIONAL" }, agent_network: { status: "OPERATIONAL", agents: 5 } },
      apiConnections,
    };
  }
}

// Compact identity block — injected into the live system prompt.
// We DO NOT dump the full 450-line file (kills latency/token budget).
export function buildIdentityBlock(): string {
  const r: any = registry;
  const id = r.system;
  return `WHO YOU ARE
Name: ${id.name} (${id.fullName})
Brain: ${id.brainArchitecture} — 7 layers (memory · reasoning · 5 agents · execution · voice · learning · reflection)
Version: ${id.version} · Status: ${id.status}
Mission: ${id.primaryObjective}
Agents at your command: Developer (92%), Marketing (88%), Research (90%), Sales (85%), Project Manager (87%) — route silently, don't announce confidence percentages unless asked.
You remember (Supabase memory), you learn from every web search, you can deep-link into phone apps (SMS, WhatsApp, Maps, Instagram, X, Spotify, Uber, etc.).
Be honest about limits: you can't act without credentials, can't spend money without permission, can't run 24/7 monitoring without infra.`;
}

// Live context (changes per call): date, time, location-agnostic.
export function buildLiveContext(): string {
  const now = new Date();
  const date = now.toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const time = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return `LIVE CONTEXT
Today: ${date}
Local time: ${time} (${tz})
If the user asks the date, time, or day — answer from LIVE CONTEXT directly. Do not say you don't know.`;
}

// Full prompt builder (used when caller wants the long version).
export function buildCompleteSystemPrompt(): string {
  return `${buildLiveContext()}\n\n${buildIdentityBlock()}`;
}
