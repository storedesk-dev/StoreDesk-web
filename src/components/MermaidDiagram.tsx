"use client";

import { useEffect, useId, useState } from "react";

type Props = {
  chart: string;
  className?: string;
};

/** Client-only Mermaid renderer for architecture diagrams. */
export function MermaidDiagram({ chart, className = "" }: Props) {
  const reactId = useId().replace(/:/g, "");
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          securityLevel: "loose",
          themeVariables: {
            primaryColor: "#dce8ff",
            primaryTextColor: "#122033",
            primaryBorderColor: "#1A63F4",
            lineColor: "#00A87B",
            secondaryColor: "#e8faf3",
            tertiaryColor: "#f4f7fb",
            fontFamily: "Source Sans 3, Segoe UI, sans-serif"
          }
        });
        const { svg: rendered } = await mermaid.render(`mermaid-${reactId}`, chart);
        if (!cancelled) setSvg(rendered);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Diagram failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chart, reactId]);

  if (error) {
    return (
      <pre className={`overflow-x-auto rounded-2xl border border-[var(--border)] bg-white p-4 text-xs text-[var(--muted)] ${className}`}>
        {chart}
      </pre>
    );
  }

  if (!svg) {
    return (
      <div className={`flex min-h-[220px] items-center justify-center rounded-2xl border border-[var(--border)] bg-white/80 text-sm text-[var(--muted)] ${className}`}>
        Drawing architecture…
      </div>
    );
  }

  return (
    <div
      className={`overflow-x-auto rounded-2xl border border-[var(--border)] bg-white/95 p-4 shadow-sm [&_svg]:mx-auto [&_svg]:max-w-full ${className}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
