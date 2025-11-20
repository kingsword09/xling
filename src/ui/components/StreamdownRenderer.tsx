import React, { Suspense, useMemo } from "react";
import { cn } from "@/ui/lib/utils";

const LazyStreamdown = React.lazy(() => import("./StreamdownWrapper"));

interface StreamdownRendererProps {
  content: string;
  className?: string;
}

export function StreamdownRenderer({
  content,
  className,
}: StreamdownRendererProps) {
  const renderedContent = useMemo(() => content, [content]);
  const baseClass =
    "markdown-container prose prose-neutral dark:prose-invert max-w-none prose-pre:bg-muted/50 prose-code:font-mono";

  return (
    <Suspense
      fallback={
        <div className={cn(baseClass, className)}>
          <pre className="whitespace-pre-wrap text-sm leading-relaxed">
            {renderedContent}
          </pre>
        </div>
      }
    >
      <LazyStreamdown
        content={renderedContent}
        className={cn(baseClass, className)}
      />
    </Suspense>
  );
}
