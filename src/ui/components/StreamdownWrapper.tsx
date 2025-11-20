import React from "react";
import { Streamdown } from "streamdown";
import { cn } from "@/ui/lib/utils";

interface StreamdownWrapperProps {
  content: string;
  className?: string;
}

export default function StreamdownWrapper({
  content,
  className,
}: StreamdownWrapperProps) {
  const baseClass =
    "markdown-container prose prose-neutral dark:prose-invert max-w-none prose-pre:bg-muted/50 prose-code:font-mono";

  return (
    <Streamdown className={cn(baseClass, className)} parseIncompleteMarkdown>
      {content}
    </Streamdown>
  );
}
