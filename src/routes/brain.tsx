import { createFileRoute } from "@tanstack/react-router";
import JARVISBrainFinal from "@/components/JARVISBrainFinal";

export const Route = createFileRoute("/brain")({
  head: () => ({
    meta: [
      { title: "JARVIS Brain — Memory, Patterns, Knowledge" },
      { name: "description", content: "JARVIS multi-agent brain with persistent memory and knowledge extraction." },
    ],
  }),
  component: BrainPage,
  errorComponent: ({ error }) => <pre style={{ color: "tomato", padding: 24 }}>{String(error)}</pre>,
  notFoundComponent: () => <div style={{ padding: 24 }}>Not found.</div>,
});

function BrainPage() {
  return <JARVISBrainFinal userId="imran-001" voice={false} />;
}
