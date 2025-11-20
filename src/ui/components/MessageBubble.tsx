import React from "react";
import { Message } from "../hooks/useChat";
import { cn } from "@/ui/lib/utils";

interface MessageBubbleProps {
  message: Message;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  if (isSystem) {
    return (
      <div className="flex justify-center my-6">
        <span className="text-xs font-bold text-black bg-neo-yellow border-2 border-neo-black px-4 py-1 shadow-neo-sm">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn("flex flex-col mb-6", isUser ? "items-end" : "items-start")}
    >
      <div className="flex items-baseline gap-2 mb-2 px-1">
        <span className="text-sm font-bold text-neo-black uppercase tracking-wide">
          {message.model || "User"}
        </span>
        <span className="text-xs text-muted-foreground font-medium">
          {new Date(message.timestamp).toLocaleTimeString()}
        </span>
      </div>
      <div
        className={cn(
          "max-w-[85%] p-4 border-2 border-neo-black shadow-neo transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none",
          isUser ? "bg-neo-white text-neo-black" : "bg-neo-purple text-black",
        )}
      >
        <div className="whitespace-pre-wrap font-medium leading-relaxed">
          {message.content}
        </div>
      </div>
    </div>
  );
};
