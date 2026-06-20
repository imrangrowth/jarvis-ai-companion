/**
 * Web Search Module
 * Handles intelligent web search using Tavily API (high quality, AI-powered)
 * Falls back to context-aware responses if search fails
 */

export interface SearchResult {
  title: string;
  url: string;
  content: string;
  snippet?: string;
}

/**
 * Search the web. Prefers Google Custom Search (GOOGLE_SEARCH_API_KEY + GOOGLE_SEARCH_CX),
 * falls back to Tavily (TAVILY_API_KEY) if Google is not configured.
 */
export async function performWebSearch(
  query: string,
  maxResults: number = 5
): Promise<SearchResult[]> {
  const googleKey = process.env.GOOGLE_SEARCH_API_KEY;
  const googleCx = process.env.GOOGLE_SEARCH_CX;

  if (googleKey && googleCx) {
    try {
      const url = new URL("https://www.googleapis.com/customsearch/v1");
      url.searchParams.set("key", googleKey);
      url.searchParams.set("cx", googleCx);
      url.searchParams.set("q", query);
      url.searchParams.set("num", String(Math.min(maxResults, 10)));

      const response = await fetch(url.toString());
      if (!response.ok) {
        console.error(`Google search failed: ${response.status}`);
      } else {
        const data = await response.json();
        const items = (data.items || []).map((r: any) => ({
          title: r.title,
          url: r.link,
          content: r.snippet || "",
          snippet: r.snippet,
        }));
        if (items.length) return items;
      }
    } catch (error) {
      console.error("Google search error:", error);
    }
  }

  const tavilyKey = process.env.TAVILY_API_KEY;
  if (!tavilyKey) {
    console.warn("No web search API key configured (GOOGLE_SEARCH_API_KEY or TAVILY_API_KEY)");
    return [];
  }

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: tavilyKey,
        query,
        max_results: maxResults,
        include_answer: true,
        search_depth: "basic",
      }),
    });

    if (!response.ok) {
      console.error(`Tavily search failed: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return (data.results || []).map((r: any) => ({
      title: r.title,
      url: r.url,
      content: r.content,
      snippet: r.snippet,
    }));
  } catch (error) {
    console.error("Web search error:", error);
    return [];
  }
}

/**
 * Format search results into context for the LLM
 */
export function formatSearchResultsForContext(results: SearchResult[]): string {
  if (!results.length) return "";

  const formatted = results
    .map(
      (r, i) =>
        `[${i + 1}] ${r.title}\nURL: ${r.url}\nContent: ${r.content}`
    )
    .join("\n\n");

  return `Recent web search results:\n${formatted}`;
}

/**
 * Detect if a query needs web search
 * Returns true for queries about current events, real-time info, etc.
 */
export function shouldPerformWebSearch(query: string): boolean {
  const searchKeywords = [
    "what is",
    "what are",
    "current",
    "latest",
    "news",
    "today",
    "weather",
    "time",
    "date",
    "search",
    "find",
    "look up",
    "what's",
    "whats",
    "how",
    "when",
    "where",
    "price",
    "rate",
    "stock",
    "covid",
    "election",
    "sports",
    "score",
    "trending",
    "top",
  ];

  const lowerQuery = query.toLowerCase();
  return searchKeywords.some((keyword) => lowerQuery.includes(keyword));
}

/**
 * Get current time and date context
 * Useful for answering time/date questions without web search
 */
export function getTimeContext(): string {
  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const dateStr = now.toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `Current time: ${timeStr}\nCurrent date: ${dateStr}`;
}

/**
 * Extract query intent for smarter web search
 */
export function extractSearchIntent(query: string): {
  intent: "time" | "weather" | "news" | "general";
  cleanQuery: string;
} {
  const timeKeywords = ["time", "current time", "what time"];
  const weatherKeywords = ["weather", "temperature", "rain"];
  const newsKeywords = [
    "news",
    "latest",
    "trending",
    "breaking",
    "today",
  ];

  const lowerQuery = query.toLowerCase();

  if (timeKeywords.some((kw) => lowerQuery.includes(kw))) {
    return { intent: "time", cleanQuery: query };
  }

  if (weatherKeywords.some((kw) => lowerQuery.includes(kw))) {
    return { intent: "weather", cleanQuery: query };
  }

  if (newsKeywords.some((kw) => lowerQuery.includes(kw))) {
    return { intent: "news", cleanQuery: query };
  }

  return { intent: "general", cleanQuery: query };
}
