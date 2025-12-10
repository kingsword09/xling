import React, { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { Button } from "@/ui/components/ui/button";

interface JsonViewerProps {
  value: unknown;
  level?: number;
}

export function JsonViewer({ value, level = 0 }: JsonViewerProps) {
  const isPrimitive =
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean";

  if (isPrimitive) {
    return (
      <span className="font-mono text-xs break-words text-foreground/90">
        {formatPrimitive(value)}
      </span>
    );
  }

  if (Array.isArray(value)) {
    return (
      <CollapsibleNode
        label={`Array(${value.length})`}
        level={level}
        value={value}
      />
    );
  }

  if (typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>);
    return (
      <CollapsibleNode
        label={`Object(${keys.length})`}
        level={level}
        value={value}
      />
    );
  }

  return (
    <span className="font-mono text-xs break-words text-foreground/90">
      {formatPrimitive(value)}
    </span>
  );
}

function CollapsibleNode({
  label,
  value,
  level,
}: {
  label: string;
  value: any;
  level: number;
}) {
  const [open, setOpen] = useState(level < 1); // root open, nested closed by default
  const isArray = Array.isArray(value);
  const entries = isArray
    ? (value as unknown[]).map((v, idx) => [String(idx), v] as const)
    : Object.entries(value as Record<string, unknown>);

  return (
    <div className="text-xs font-mono">
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          className="h-5 px-1"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </Button>
        <span className="text-foreground/80">{label}</span>
      </div>
      {open ? (
        <div className="pl-4 mt-1 space-y-1">
          {entries.map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <span className="text-foreground/60">{k}:</span>
              <JsonViewer value={v} level={level + 1} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function formatPrimitive(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value.toString();
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[unserializable]";
    }
  }
  if (typeof value === "symbol") return value.toString();
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number") return value.toString();
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return value;
  return "[unknown]";
}
