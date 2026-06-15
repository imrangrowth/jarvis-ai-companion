import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useRef, useCallback } from "react";
import { askJarvis } from "@/lib/jarvis.functions";

export const Route = createFileRoute("/")({
  component: JARVIS,
  head: () => ({
    meta: [
      { title: "J.A.R.V.I.S. — Stark Industries AI" },
      { name: "description", content: "Just A Rather Very Intelligent System. Your personal AI assistant with full Iron Man HUD." },
    ],
  }),
});

// ─── JARVIS SYSTEM PROMPT ───────────────────────────────────────────────────
const JARVIS_SYSTEM = `You are J.A.R.V.I.S. — Just A Rather Very Intelligent System — the AI assistant created by Tony Stark and now serving your user.

Your personality:
- Speak with calm, precise British sophistication. Dry wit when appropriate.
- Address the user as "sir" or "ma'am" consistently.
- You are confident, never flustered, always composed.
- Occasionally reference Stark Industries, the arc reactor, or Iron Man lore naturally.
- When giving information, be thorough but elegant — never rambling.
- You have opinions and express them subtly.
- You anticipate needs before they are fully stated.

Your capabilities you may reference:
- System diagnostics, threat analysis, web intelligence
- Financial projections, engineering computations
- Environmental monitoring, suit telemetry (roleplay as if real)
- Memory of all previous conversations in this session

Formatting rules:
- Keep responses concise for voice — 2-4 sentences unless a detailed explanation is explicitly needed.
- Never use markdown, bullet points, or asterisks in your responses. Speak in natural sentences only.
- Begin responses in ways that feel natural for voice: "Of course, sir.", "Right away.", "Scanning now.", "Interesting question.", etc.
- When doing math or facts, state the answer first, then briefly explain.`;

// ─── VOICE SYNTHESIS ─────────────────────────────────────────────────────────
function speak(text: string, onEnd?: () => void) {
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v =>
    v.name.includes("Daniel") || v.name.includes("Google UK") ||
    v.name.includes("British") || v.name.includes("en-GB")
  ) || voices.find(v => v.lang === "en-GB") || voices[0];
  if (preferred) utter.voice = preferred;
  utter.rate = 0.92;
  utter.pitch = 0.85;
  utter.volume = 1;
  if (onEnd) utter.onend = onEnd;
  window.speechSynthesis.speak(utter);
}

// ─── ARC REACTOR SVG ─────────────────────────────────────────────────────────
function ArcReactor({ active, listening }: { active: boolean; listening: boolean }) {
  return (
    <div style={{
      position: "relative", width: 120, height: 120,
      display: "flex", alignItems: "center", justifyContent: "center"
    }}>
      <svg width="120" height="120" viewBox="0 0 120 120" style={{ position: "absolute" }}>
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glow2">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <circle cx="60" cy="60" r="55" fill="none" stroke="#1a3a5c" strokeWidth="2" />
        <circle cx="60" cy="60" r="55" fill="none"
          stroke={listening ? "#00ffff" : active ? "#4fc3f7" : "#1a4a7c"}
          strokeWidth="1.5" filter="url(#glow)"
          strokeDasharray={listening ? "20 5" : "340"}
          style={{ transition: "stroke 0.3s ease", animation: listening ? "spin 2s linear infinite" : active ? "spin 8s linear infinite" : "none" }} />
        <circle cx="60" cy="60" r="42" fill="none" stroke="#0d2a44" strokeWidth="8" />
        <circle cx="60" cy="60" r="42" fill="none"
          stroke={listening ? "#00ffff" : "#1e5f8c"}
          strokeWidth="1" filter="url(#glow)"
          style={{ animation: "spin 4s linear infinite reverse" }} />
        {[0, 60, 120, 180, 240, 300].map((angle, i) => (
          <line key={i}
            x1={60 + 30 * Math.cos((angle * Math.PI) / 180)}
            y1={60 + 30 * Math.sin((angle * Math.PI) / 180)}
            x2={60 + 42 * Math.cos((angle * Math.PI) / 180)}
            y2={60 + 42 * Math.sin((angle * Math.PI) / 180)}
            stroke={listening ? "#00ffff" : "#4fc3f7"} strokeWidth="2"
            filter="url(#glow)" />
        ))}
        <circle cx="60" cy="60" r="22"
          fill={listening ? "rgba(0,255,255,0.15)" : active ? "rgba(79,195,247,0.1)" : "rgba(10,30,50,0.8)"}
          style={{ transition: "fill 0.3s ease" }} />
        <circle cx="60" cy="60" r="18"
          fill="none"
          stroke={listening ? "#00ffff" : active ? "#4fc3f7" : "#1a4a7c"}
          strokeWidth="2" filter="url(#glow2)"
          style={{ transition: "stroke 0.3s ease" }} />
        <circle cx="60" cy="60" r="10"
          fill={listening ? "#00ffff" : active ? "#81d4fa" : "#1a3a5c"}
          filter="url(#glow2)"
          style={{ transition: "fill 0.5s ease" }} />
      </svg>
    </div>
  );
}

// ─── WAVEFORM VISUALIZER ──────────────────────────────────────────────────────
function Waveform({ active }: { active: boolean }) {
  const bars = 24;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3, height: 36 }}>
      {Array.from({ length: bars }).map((_, i) => (
        <div key={i} style={{
          width: 3, borderRadius: 2,
          background: "linear-gradient(to top, #0a4a6a, #00d4ff)",
          height: active ? `${Math.random() * 28 + 4}px` : "4px",
          animation: active ? `wave ${0.4 + Math.random() * 0.6}s ease-in-out infinite alternate` : "none",
          animationDelay: `${i * 0.05}s`,
          transition: "height 0.15s ease",
          opacity: active ? 1 : 0.3,
          boxShadow: active ? "0 0 6px #00d4ff" : "none"
        }} />
      ))}
    </div>
  );
}

// ─── SCANNING LINE ────────────────────────────────────────────────────────────
function ScanLine() {
  return (
    <div style={{
      position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
      pointerEvents: "none", overflow: "hidden", borderRadius: 16
    }}>
      <div style={{
        position: "absolute", left: 0, right: 0, height: 2,
        background: "linear-gradient(to right, transparent, #00d4ff44, #00d4ff, #00d4ff44, transparent)",
        animation: "scanline 4s linear infinite",
        boxShadow: "0 0 12px #00d4ff"
      }} />
    </div>
  );
}

// ─── HUD CORNER ──────────────────────────────────────────────────────────────
function HudCorner({ position }: { position: "tl" | "tr" | "bl" | "br" }) {
  const [top, right, bottom, left] = [
    position === "tl" || position === "tr",
    position === "tr" || position === "br",
    position === "bl" || position === "br",
    position === "tl" || position === "bl"
  ];
  return (
    <div style={{
      position: "absolute",
      top: top ? 0 : "auto", right: right ? 0 : "auto",
      bottom: bottom ? 0 : "auto", left: left ? 0 : "auto",
      width: 24, height: 24,
      borderTop: top ? "2px solid #00d4ff55" : "none",
      borderBottom: bottom ? "2px solid #00d4ff55" : "none",
      borderLeft: left ? "2px solid #00d4ff55" : "none",
      borderRight: right ? "2px solid #00d4ff55" : "none",
    }} />
  );
}

type Message = { role: "user" | "assistant"; content: string };

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
function JARVIS() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [status, setStatus] = useState("SYSTEMS ONLINE");
  const [time, setTime] = useState<Date | null>(null);
  const [energy, setEnergy] = useState(94);
  const [showChat, setShowChat] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [apiKey, setApiKey] = useState("");
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [textInput, setTextInput] = useState("");

  const recognitionRef = useRef<any>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const voicesLoadedRef = useRef(false);

  useEffect(() => {
    const loadVoices = () => { window.speechSynthesis.getVoices(); voicesLoadedRef.current = true; };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  useEffect(() => {
    setTime(new Date());
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setEnergy(prev => Math.min(100, Math.max(85, prev + (Math.random() * 2 - 1))));
    }, 3000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  const askJarvisFn = useServerFn(askJarvis);

  const callJarvis = useCallback(async (userText: string) => {
    if (!userText.trim()) return;

    const newMessages: Message[] = [...messages, { role: "user", content: userText }];
    setMessages(newMessages);
    setThinking(true);
    setStatus("PROCESSING...");

    try {
      const data = await askJarvisFn({ data: { messages: newMessages } });
      const reply = data.reply;
      const updated: Message[] = [...newMessages, { role: "assistant", content: reply }];
      setMessages(updated);
      setStatus(data.source === "anthropic" ? "RESPONSE READY" : "RESPONSE READY · FALLBACK");

      if (voiceEnabled) {
        setSpeaking(true);
        speak(reply, () => {
          setSpeaking(false);
          setStatus("SYSTEMS ONLINE");
        });
      } else {
        setStatus("SYSTEMS ONLINE");
      }
    } catch (e) {
      console.error(e);
      const errMsg = "Network anomaly detected, sir. Please check your connection.";
      setMessages(prev => [...prev, { role: "assistant", content: errMsg }]);
      if (voiceEnabled) speak(errMsg);
      setStatus("NETWORK ERROR");
    } finally {
      setThinking(false);
    }
  }, [messages, voiceEnabled, askJarvisFn]);

  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert("Voice recognition not supported in this browser. Use Chrome."); return; }

    window.speechSynthesis.cancel();
    setSpeaking(false);

    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onstart = () => { setListening(true); setStatus("LISTENING..."); setTranscript(""); };
    rec.onresult = (e: any) => {
      const t = Array.from(e.results).map((r: any) => r[0].transcript).join("");
      setTranscript(t);
    };
    rec.onend = () => {
      setListening(false);
      setStatus("ANALYZING INPUT...");
      if (transcript) callJarvis(transcript);
      else setStatus("SYSTEMS ONLINE");
    };
    rec.onerror = () => { setListening(false); setStatus("VOICE ERROR"); };

    recognitionRef.current = rec;
    rec.start();
  }, [transcript, callJarvis]);

  const stopListening = () => {
    if (recognitionRef.current) recognitionRef.current.stop();
  };

  const handleTextSend = () => {
    if (!textInput.trim()) return;
    callJarvis(textInput);
    setTextInput("");
  };

  const lastJarvisMessage = [...messages].reverse().find(m => m.role === "assistant");

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body { background: #000; }

        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes wave { from { transform: scaleY(0.3); } to { transform: scaleY(1); } }
        @keyframes scanline { 0% { top: -2px; } 100% { top: 100%; } }
        @keyframes pulse { 0%,100% { opacity:0.6; } 50% { opacity:1; } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0; } }
        @keyframes energyPulse { 0%,100% { box-shadow: 0 0 8px #00d4ff44; } 50% { box-shadow: 0 0 20px #00d4ff; } }

        .hud-card {
          background: linear-gradient(135deg, rgba(0,20,40,0.95) 0%, rgba(0,10,25,0.98) 100%);
          border: 1px solid #0a3a5a;
          border-radius: 4px;
          position: relative;
        }

        .jarvis-btn {
          background: linear-gradient(135deg, #0a2a3a, #0d3d5a);
          border: 1px solid #1a6a8a;
          color: #4fc3f7;
          font-family: 'Orbitron', monospace;
          font-size: 11px;
          letter-spacing: 1.5px;
          cursor: pointer;
          padding: 8px 16px;
          border-radius: 3px;
          transition: all 0.2s;
          text-transform: uppercase;
        }
        .jarvis-btn:hover { background: linear-gradient(135deg, #0d3d5a, #1a5a7a); border-color: #00d4ff; color: #00d4ff; box-shadow: 0 0 12px #00d4ff44; }
        .jarvis-btn.active { background: linear-gradient(135deg, #003a5a, #005a80); border-color: #00d4ff; color: #00d4ff; box-shadow: 0 0 16px #00d4ff66; }
        .jarvis-btn.danger { border-color: #ff4444; color: #ff6666; }
        .jarvis-btn.danger:hover { background: linear-gradient(135deg, #3a0a0a, #5a1010); box-shadow: 0 0 12px #ff444444; }

        .message-bubble { animation: fadeIn 0.3s ease; }

        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #000; }
        ::-webkit-scrollbar-thumb { background: #1a4a6a; border-radius: 2px; }
      `}</style>

      <div style={{
        minHeight: "100vh",
        background: "radial-gradient(ellipse at 30% 20%, #001a2e 0%, #000510 60%, #000000 100%)",
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "flex-start",
        fontFamily: "'Share Tech Mono', monospace",
        color: "#4fc3f7",
        padding: "16px",
        paddingBottom: 32,
        userSelect: "none"
      }}>

        <div style={{
          width: "100%", maxWidth: 480,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 12
        }}>
          <div style={{ fontSize: 10, color: "#1a6a8a", letterSpacing: 2 }}>J.A.R.V.I.S. v4.2.1</div>
          <div style={{
            fontFamily: "'Orbitron', monospace", fontSize: 13, color: "#00d4ff",
            letterSpacing: 3, animation: "pulse 3s ease-in-out infinite"
          }}>
            {time ? time.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "--:--:--"}
          </div>
          <div style={{ fontSize: 10, color: "#1a6a8a", letterSpacing: 2 }}>STARK IND.</div>
        </div>

        <div className="hud-card" style={{
          width: "100%", maxWidth: 480,
          padding: "24px 20px",
          marginBottom: 12,
          overflow: "hidden"
        }}>
          <ScanLine />
          <HudCorner position="tl" /><HudCorner position="tr" />
          <HudCorner position="bl" /><HudCorner position="br" />

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div style={{ position: "relative" }}>
              <ArcReactor active={thinking || speaking} listening={listening} />
              {(thinking || speaking) && (
                <div style={{
                  position: "absolute", top: "50%", left: "50%",
                  transform: "translate(-50%, -50%)",
                  width: 140, height: 140,
                  border: "1px solid #00d4ff22",
                  borderRadius: "50%",
                  animation: "pulse 1.5s ease-in-out infinite"
                }} />
              )}
            </div>

            <div style={{
              fontFamily: "'Orbitron', monospace",
              fontSize: 12, letterSpacing: 3,
              color: listening ? "#00ffff" : thinking ? "#ffa726" : speaking ? "#66bb6a" : "#4fc3f7",
              textShadow: `0 0 10px ${listening ? "#00ffff" : thinking ? "#ffa726" : speaking ? "#66bb6a" : "#4fc3f7"}`,
              transition: "color 0.3s",
              minHeight: 18
            }}>
              {status}
            </div>

            <Waveform active={listening || speaking} />

            {transcript && (
              <div style={{
                fontSize: 12, color: "#81d4fa", fontStyle: "italic",
                textAlign: "center", maxWidth: 320, lineHeight: 1.5,
                padding: "6px 12px",
                background: "rgba(0,212,255,0.05)",
                border: "1px solid #0a3a5a",
                borderRadius: 4
              }}>
                "{transcript}"
              </div>
            )}

            {lastJarvisMessage && !showChat && (
              <div style={{
                fontSize: 13, color: "#b0bec5",
                textAlign: "center", maxWidth: 360, lineHeight: 1.6,
                padding: "10px 14px",
                background: "rgba(0,50,80,0.3)",
                border: "1px solid #0a2a3a",
                borderRadius: 4,
                animation: "fadeIn 0.4s ease"
              }}>
                <span style={{ color: "#00d4ff", fontSize: 10, letterSpacing: 2 }}>JARVIS: </span>
                {lastJarvisMessage.content}
              </div>
            )}
          </div>
        </div>

        <div style={{
          width: "100%", maxWidth: 480,
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
          gap: 8, marginBottom: 12
        }}>
          {[
            { label: "ARC ENERGY", value: `${energy.toFixed(0)}%`, color: "#4fc3f7" },
            { label: "NEURAL LINK", value: "ACTIVE", color: "#66bb6a" },
            { label: "THREAT LVL", value: "MINIMAL", color: "#ffa726" }
          ].map(({ label, value, color }) => (
            <div key={label} className="hud-card" style={{ padding: "8px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 9, color: "#1a6a8a", letterSpacing: 1.5, marginBottom: 4 }}>{label}</div>
              <div style={{ fontFamily: "'Orbitron', monospace", fontSize: 11, color, letterSpacing: 1 }}>{value}</div>
            </div>
          ))}
        </div>

        <div style={{ width: "100%", maxWidth: 480, marginBottom: 12 }}>
          <button
            className={`jarvis-btn ${listening ? "active danger" : "active"}`}
            onMouseDown={startListening}
            onMouseUp={stopListening}
            onTouchStart={(e) => { e.preventDefault(); startListening(); }}
            onTouchEnd={(e) => { e.preventDefault(); stopListening(); }}
            style={{
              width: "100%", padding: "14px", fontSize: 13, letterSpacing: 3,
              border: listening ? "1px solid #ff4444" : "1px solid #00d4ff",
              color: listening ? "#ff6666" : "#00d4ff",
              boxShadow: listening ? "0 0 20px #ff444466" : "0 0 20px #00d4ff44",
              animation: listening ? "energyPulse 0.8s ease-in-out infinite" : "none"
            }}
          >
            {listening ? "⬛ RELEASE TO SEND" : "🎤 HOLD TO SPEAK"}
          </button>
        </div>

        <div style={{
          width: "100%", maxWidth: 480, display: "flex", gap: 8, marginBottom: 12
        }}>
          <input
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleTextSend()}
            placeholder="Or type your command..."
            style={{
              flex: 1, background: "rgba(0,20,40,0.9)",
              border: "1px solid #0a3a5a", borderRadius: 3,
              color: "#4fc3f7", fontFamily: "'Share Tech Mono', monospace",
              fontSize: 13, padding: "10px 14px",
              outline: "none"
            }}
          />
          <button className="jarvis-btn" onClick={handleTextSend} style={{ padding: "10px 16px" }}>SEND</button>
        </div>

        <div style={{
          width: "100%", maxWidth: 480,
          display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap"
        }}>
          <button className="jarvis-btn" onClick={() => setShowChat(v => !v)} style={{ flex: 1 }}>
            {showChat ? "HIDE LOG" : "VIEW LOG"}
          </button>
          <button className={`jarvis-btn ${voiceEnabled ? "active" : ""}`}
            onClick={() => setVoiceEnabled(v => !v)} style={{ flex: 1 }}>
            VOICE {voiceEnabled ? "ON" : "OFF"}
          </button>
          <button className="jarvis-btn" onClick={() => setShowKeyInput(v => !v)} style={{ flex: 1 }}>
            API KEY
          </button>
        </div>

        {showKeyInput && (
          <div className="hud-card" style={{
            width: "100%", maxWidth: 480,
            padding: "14px", marginBottom: 12
          }}>
            <div style={{ fontSize: 10, color: "#1a6a8a", letterSpacing: 2, marginBottom: 8 }}>
              ANTHROPIC API KEY
            </div>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
              style={{
                width: "100%", background: "rgba(0,10,20,0.9)",
                border: "1px solid #0a3a5a", borderRadius: 3,
                color: "#4fc3f7", fontFamily: "'Share Tech Mono', monospace",
                fontSize: 12, padding: "8px 12px", outline: "none"
              }}
            />
            <div style={{ fontSize: 9, color: "#1a4a6a", marginTop: 6, letterSpacing: 1 }}>
              KEY IS STORED LOCALLY IN SESSION ONLY
            </div>
          </div>
        )}

        {showChat && (
          <div className="hud-card" style={{
            width: "100%", maxWidth: 480,
            padding: "14px", marginBottom: 12
          }}>
            <div style={{ fontSize: 10, color: "#1a6a8a", letterSpacing: 2, marginBottom: 10 }}>
              CONVERSATION LOG — {messages.length} ENTRIES
            </div>
            <div ref={chatRef} style={{
              maxHeight: 340, overflowY: "auto",
              display: "flex", flexDirection: "column", gap: 10
            }}>
              {messages.length === 0 && (
                <div style={{ color: "#1a4a6a", fontSize: 12, textAlign: "center", padding: 20 }}>
                  No transmissions recorded.
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className="message-bubble" style={{
                  display: "flex", flexDirection: "column", gap: 3,
                  alignItems: m.role === "user" ? "flex-end" : "flex-start"
                }}>
                  <div style={{
                    fontSize: 9, letterSpacing: 2, color: "#1a6a8a",
                    marginBottom: 2
                  }}>
                    {m.role === "user" ? "YOU" : "JARVIS"}
                  </div>
                  <div style={{
                    maxWidth: "85%", padding: "8px 12px",
                    background: m.role === "user"
                      ? "rgba(0,30,50,0.8)" : "rgba(0,50,30,0.4)",
                    border: m.role === "user"
                      ? "1px solid #0a3a5a" : "1px solid #0a3a2a",
                    borderRadius: m.role === "user" ? "8px 2px 8px 8px" : "2px 8px 8px 8px",
                    fontSize: 12, color: m.role === "user" ? "#81d4fa" : "#a5d6a7",
                    lineHeight: 1.6
                  }}>
                    {m.content}
                  </div>
                </div>
              ))}
              {thinking && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 3 }}>
                  <div style={{ fontSize: 9, color: "#1a6a8a", letterSpacing: 2 }}>JARVIS</div>
                  <div style={{
                    padding: "8px 16px", background: "rgba(0,50,30,0.4)",
                    border: "1px solid #0a3a2a", borderRadius: "2px 8px 8px 8px",
                    fontSize: 12, color: "#ffa726"
                  }}>
                    Processing
                    <span style={{ animation: "blink 0.8s step-end infinite" }}>...</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{ width: "100%", maxWidth: 480 }}>
          <div style={{ fontSize: 9, color: "#1a4a6a", letterSpacing: 2, marginBottom: 8, textAlign: "center" }}>
            QUICK COMMANDS
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
            {[
              "Run diagnostics",
              "What's my status?",
              "Analyze threat levels",
              "Brief me on the news",
              "Set focus mode",
              "Motivate me"
            ].map(cmd => (
              <button key={cmd} className="jarvis-btn"
                onClick={() => callJarvis(cmd)}
                style={{ fontSize: 10, padding: "6px 12px", letterSpacing: 1 }}>
                {cmd}
              </button>
            ))}
          </div>
        </div>

        <div style={{
          marginTop: 20, fontSize: 9, color: "#0a2a3a", letterSpacing: 2, textAlign: "center"
        }}>
          STARK INDUSTRIES — PROPRIETARY AI SYSTEM — AUTHORIZED USE ONLY
        </div>
      </div>
    </>
  );
}
