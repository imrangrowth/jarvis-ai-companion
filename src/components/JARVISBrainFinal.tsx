import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { chatAgentic, synthesizeSpeech } from "@/lib/jarvis.functions";

// ══════════════════════════════════════════════════════════════════════════════
//  JARVIS COMPLETE BRAIN — adapted for Lovable (TanStack Start + Supabase)
//  Claude key stays server-side via chatAgentic. ElevenLabs via synthesizeSpeech.
// ══════════════════════════════════════════════════════════════════════════════

type Conv = { user_input: string; jarvis_response: string };
type Pat = { pattern_name: string; frequency: number };
type Goal = { goal_name: string };
type Know = { content: string; topic: string };

class MemorySystem {
  async saveConversation(userId: string, userInput: string, jarvisResponse: string, metadata: Record<string, unknown> = {}) {
    try {
      await supabase.from("jarvis_conversations" as never).insert([{ user_id: userId, user_input: userInput, jarvis_response: jarvisResponse, metadata } as never]);
    } catch (e) { console.error("save conv", e); }
  }
  async savePattern(userId: string, pattern: string, frequency: number, confidence: number, action: string) {
    try {
      await supabase.from("jarvis_patterns" as never).insert([{ user_id: userId, pattern_name: pattern, frequency, confidence, action_taken: action } as never]);
    } catch (e) { console.error("save pat", e); }
  }
  async saveDecision(userId: string, userInput: string, classification: string, agent: string, data: unknown) {
    try {
      await supabase.from("jarvis_decision_history" as never).insert([{ user_id: userId, user_input: userInput, classification, agent_selected: agent, decision_data: data } as never]);
    } catch (e) { console.error("save dec", e); }
  }
  async logAction(userId: string, actionType: string, target: string, payload: unknown, result: string) {
    try {
      await supabase.from("jarvis_actions" as never).insert([{ user_id: userId, action_type: actionType, target, payload, result } as never]);
    } catch (e) { console.error("log act", e); }
  }
  async storeKnowledge(userId: string, topic: string, facts: string[], source: string) {
    if (!facts.length) return;
    try {
      await supabase.from("jarvis_knowledge" as never).insert(facts.map((fact) => ({
        user_id: userId, topic, content: fact, source, category: categorize(fact), learned_from_query: true,
      })) as never);
    } catch (e) { console.error("store know", e); }
  }
  async getContext(userId: string) {
    try {
      const [conv, pat, goal, know] = await Promise.all([
        supabase.from("jarvis_conversations" as never).select("user_input,jarvis_response").eq("user_id", userId).order("timestamp", { ascending: false }).limit(15),
        supabase.from("jarvis_patterns" as never).select("pattern_name,frequency").eq("user_id", userId).order("frequency", { ascending: false }).limit(10),
        supabase.from("jarvis_goals" as never).select("goal_name").eq("user_id", userId).eq("status", "active").limit(5),
        supabase.from("jarvis_knowledge" as never).select("content,topic").eq("user_id", userId).order("timestamp", { ascending: false }).limit(10),
      ]);
      return {
        conversations: (conv.data ?? []) as Conv[],
        patterns: (pat.data ?? []) as Pat[],
        goals: (goal.data ?? []) as Goal[],
        knowledge: (know.data ?? []) as Know[],
      };
    } catch (e) {
      console.error("get ctx", e);
      return { conversations: [], patterns: [], goals: [], knowledge: [] };
    }
  }
}

function categorize(fact: string) {
  const f = fact.toLowerCase();
  if (f.includes("price") || f.includes("crypto") || f.includes("trade")) return "TRADING";
  if (f.includes("market") || f.includes("audience") || f.includes("roas")) return "MARKETING";
  if (f.includes("code") || f.includes("build") || f.includes("api")) return "DEVELOPMENT";
  if (f.includes("client") || f.includes("sell")) return "SALES";
  return "GENERAL";
}

function classify(input: string) {
  const l = input.toLowerCase();
  if (l.includes("website") || l.includes("build") || l.includes("design")) return "WEB_DEVELOPMENT";
  if (l.includes("marketing") || l.includes("ads") || l.includes("campaign")) return "MARKETING";
  if (l.includes("code") || l.includes("program")) return "CODING";
  if (l.includes("trade") || l.includes("crypto") || l.includes("forex")) return "TRADING";
  if (l.includes("car") || l.includes("vehicle") || l.includes("dealer")) return "AUTO_BUSINESS";
  if (l.includes("learn") || l.includes("teach")) return "LEARNING";
  return "GENERAL";
}

const AGENT_PROMPTS: Record<string, { key: string; prompt: string }> = {
  WEB_DEVELOPMENT: { key: "developer", prompt: `You are JARVIS's Developer Agent. Expert in full-stack development, architecture, and performance. Provide technical guidance with code examples. Address user as "sir". Be concise.` },
  CODING: { key: "developer", prompt: `You are JARVIS's Developer Agent. Expert in coding & architecture. Address user as "sir". Be concise.` },
  MARKETING: { key: "marketing", prompt: `You are JARVIS's Marketing Agent. Expert in Meta Ads, copywriting, ROAS. Address user as "sir". Focus on ROI.` },
  TRADING: { key: "research", prompt: `You are JARVIS's Research Agent. Provide risk-aware trading insights. Address user as "sir".` },
  AUTO_BUSINESS: { key: "sales", prompt: `You are JARVIS's Sales Agent for auto-business. Inventory, leads, client acquisition. Address user as "sir".` },
  LEARNING: { key: "research", prompt: `You are JARVIS's Research Agent. Teach clearly with structured findings. Address user as "sir".` },
  GENERAL: { key: "developer", prompt: `You are JARVIS. Helpful, concise, address user as "sir".` },
};

function buildContextPrompt(ctx: { knowledge: Know[]; patterns: Pat[]; goals: Goal[] }) {
  let out = "";
  if (ctx.knowledge.length) {
    out += "\nRELEVANT KNOWLEDGE:\n" + ctx.knowledge.slice(0, 3).map((k) => `- ${k.content}`).join("\n");
  }
  if (ctx.patterns.length) {
    out += "\nPATTERNS:\n" + ctx.patterns.slice(0, 2).map((p) => `- ${p.pattern_name} (x${p.frequency})`).join("\n");
  }
  if (ctx.goals.length) {
    out += `\nACTIVE GOAL: ${ctx.goals[0].goal_name}\n`;
  }
  return out;
}

function extractFacts(text: string) {
  return text.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 15).slice(0, 3);
}

export default function JARVISBrainFinal({ userId = "imran-001", voice = false }: { userId?: string; voice?: boolean }) {
  const [memory] = useState(() => new MemorySystem());
  const chat = useServerFn(chatAgentic);
  const tts = useServerFn(synthesizeSpeech);

  const [userInput, setUserInput] = useState("");
  const [response, setResponse] = useState("");
  const [status, setStatus] = useState("READY");
  const [stats, setStats] = useState({ processed: 0, knowledge: 0 });

  const handleSend = async () => {
    const input = userInput.trim();
    if (!input || status !== "READY") return;
    setResponse("");
    setStatus("ANALYZING");
    try {
      const ctx = await memory.getContext(userId);
      setStatus("CONTEXT_LOADED");

      const classification = classify(input);
      const { key: agentKey, prompt: agentPrompt } = AGENT_PROMPTS[classification] ?? AGENT_PROMPTS.GENERAL;
      await memory.saveDecision(userId, input, classification, agentKey, { hasContext: ctx.conversations.length > 0 });

      setStatus(`AGENT_${agentKey.toUpperCase()}`);
      const system = `${agentPrompt}\n${buildContextPrompt(ctx)}`;

      setStatus("CALLING_CLAUDE");
      const result = await chat({ data: { system, messages: [{ role: "user", content: input }], useTools: false, maxTokens: 600 } });
      const reply = result.reply ?? "No response, sir.";

      setStatus("STORING");
      const facts = extractFacts(reply);
      await Promise.all([
        memory.storeKnowledge(userId, classification, facts, "CLAUDE"),
        memory.saveConversation(userId, input, reply, { agent: agentKey, classification, source: result.source }),
        memory.logAction(userId, "chat", agentKey, { input }, "ok"),
      ]);

      setResponse(reply);
      setStats((s) => ({ processed: s.processed + 1, knowledge: s.knowledge + facts.length }));
      setStatus("READY");
      setUserInput("");

      if (voice) {
        try {
          const { audio, mimeType } = await tts({ data: { text: reply.slice(0, 1200) } });
          const a = new Audio(`data:${mimeType};base64,${audio}`);
          a.play().catch(() => {});
        } catch (e) { console.error("voice", e); }
      }
    } catch (e) {
      console.error(e);
      setResponse(`Error: ${(e as Error).message}`);
      setStatus("READY");
    }
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 20, fontFamily: "'Share Tech Mono', monospace", background: "radial-gradient(ellipse at 20% 10%, #001525 0%, #000812 50%, #000 100%)", color: "#4fc3f7", minHeight: "100vh" }}>
      <h1 style={{ textAlign: "center", color: "#00d4ff", letterSpacing: 3, marginBottom: 8 }}>✓ JARVIS BRAIN</h1>
      <p style={{ textAlign: "center", fontSize: 11, color: "#0a5070", marginBottom: 20 }}>
        Status: {status} · Processed: {stats.processed} · Knowledge stored: {stats.knowledge} · user_id: {userId}
      </p>

      <div style={{ background: "linear-gradient(135deg, rgba(0,16,32,.97), rgba(0,8,18,.99))", border: "1px solid #0a2a44", borderRadius: 8, padding: 15, marginBottom: 20 }}>
        <textarea
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSend(); }}
          placeholder="Ask JARVIS... (Ctrl/Cmd + Enter)"
          style={{ width: "100%", height: 90, background: "rgba(0,6,14,.95)", border: "1px solid #0a2a40", borderRadius: 4, color: "#4fc3f7", padding: 12, fontFamily: "inherit", fontSize: 12, marginBottom: 10 }}
        />
        <button
          onClick={handleSend}
          disabled={!userInput.trim() || status !== "READY"}
          style={{ padding: "12px 24px", background: status === "READY" ? "#003a5a" : "#1a2a4a", border: "1px solid #00d4ff", color: "#00d4ff", borderRadius: 4, cursor: status === "READY" ? "pointer" : "not-allowed", fontSize: 11, letterSpacing: 2, opacity: status === "READY" ? 1 : .5 }}
        >
          {status === "READY" ? "SEND" : status}
        </button>
      </div>

      {response && (
        <div style={{ background: "linear-gradient(135deg, rgba(0,16,32,.97), rgba(0,8,18,.99))", border: "1px solid #00d4ff", borderRadius: 8, padding: 20, marginBottom: 20 }}>
          <h3 style={{ color: "#00d4ff", marginBottom: 10, fontSize: 12 }}>✓ JARVIS RESPONSE</h3>
          <p style={{ fontSize: 13, lineHeight: 1.8, color: "#b0c8d8", whiteSpace: "pre-wrap" }}>{response}</p>
        </div>
      )}

      <div style={{ background: "linear-gradient(135deg, rgba(0,16,32,.97), rgba(0,8,18,.99))", border: "1px solid #22d3ee", borderRadius: 8, padding: 12, textAlign: "center" }}>
        <p style={{ fontSize: 10, color: "#81d4fa", margin: 0 }}>✓ MEMORY · PATTERNS · GOALS · KNOWLEDGE · DECISIONS · ACTIONS — ALL WIRED</p>
      </div>
    </div>
  );
}
