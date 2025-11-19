import { useState, useEffect, useRef, useCallback } from "react";

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  model?: string; // The model that generated this message
  timestamp: number;
}

export interface ChatState {
  messages: Message[];
  isDiscussing: boolean;
  topic: string;
  selectedModels: string[];
  availableModels: string[];
}

export interface UseChatReturn {
  messages: Message[];
  isDiscussing: boolean;
  topic: string;
  selectedModels: string[];
  availableModels: string[];
  startDiscussion: (topic: string, models: string[]) => Promise<void>;
  stopDiscussion: () => Promise<void>;
  nextTurn: () => Promise<void>;
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isDiscussing, setIsDiscussing] = useState(false);
  const [topic, setTopic] = useState("");
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Fetch available models on mount
  useEffect(() => {
    fetch("/api/models")
      .then((res) => res.json())
      .then((data) => setAvailableModels(data.models))
      .catch((err) => console.error("Failed to fetch models:", err));
  }, []);

  // Subscribe to SSE stream
  useEffect(() => {
    if (!isDiscussing) return;

    const es = new EventSource("/api/chat/stream");
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "message") {
        setMessages((prev) => {
          // Check if we're updating an existing message (streaming)
          const existingIndex = prev.findIndex((m) => m.id === data.message.id);
          if (existingIndex >= 0) {
            const newMessages = [...prev];
            newMessages[existingIndex] = data.message;
            return newMessages;
          }
          return [...prev, data.message];
        });
      } else if (data.type === "stop") {
        setIsDiscussing(false);
        es.close();
      }
    };

    es.onerror = (err) => {
      console.error("SSE Error:", err);
      es.close();
      setIsDiscussing(false);
    };

    return () => {
      es.close();
    };
  }, [isDiscussing]);

  const startDiscussion = useCallback(
    async (newTopic: string, models: string[]) => {
      setTopic(newTopic);
      setSelectedModels(models);
      setMessages([]);
      setIsDiscussing(true);

      try {
        await fetch("/api/chat/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic: newTopic, models }),
        });
      } catch (err) {
        console.error("Failed to start discussion:", err);
        setIsDiscussing(false);
      }
    },
    [],
  );

  const stopDiscussion = useCallback(async () => {
    try {
      await fetch("/api/chat/stop", { method: "POST" });
      setIsDiscussing(false);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    } catch (err) {
      console.error("Failed to stop discussion:", err);
    }
  }, []);

  const nextTurn = useCallback(async () => {
    try {
      await fetch("/api/chat/next", { method: "POST" });
    } catch (err) {
      console.error("Failed to trigger next turn:", err);
    }
  }, []);

  return {
    messages,
    isDiscussing,
    topic,
    selectedModels,
    availableModels,
    startDiscussion,
    stopDiscussion,
    nextTurn,
  };
}
