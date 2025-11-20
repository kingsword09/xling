import React, { useState, useEffect, useRef } from "react";

interface Participant {
  id: string;
  name: string;
  type: "ai" | "human";
  model?: string;
}

interface Message {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
  senderId: string;
  timestamp: number;
}

export function Chat() {
  const [status, setStatus] = useState("idle");
  const [mode, setMode] = useState("auto");
  const [topic, setTopic] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [input, setInput] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void fetch("/api/models")
      .then((res) => res.json())
      .then((data) => setAvailableModels(data.models))
      .catch(() => setAvailableModels([]));

    const evtSource = new EventSource("/api/chat/stream");

    evtSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case "status":
          setStatus(data.status);
          break;
        case "mode":
          setMode(data.mode);
          break;
        case "participants":
          setParticipants(data.participants);
          break;
        case "message":
          setMessages((prev) => [...prev, data.message]);
          break;
        case "chunk":
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.id === data.chunk.id) {
              return [
                ...prev.slice(0, -1),
                { ...last, content: data.chunk.content },
              ];
            }
            return prev;
          });
          break;
      }
    };

    return () => evtSource.close();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const startChat = async () => {
    await fetch("/api/chat/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, models: selectedModels }),
    });
  };

  const stopChat = async () => {
    await fetch("/api/chat/stop", { method: "POST" });
  };

  const togglePause = async () => {
    const endpoint = status === "paused" ? "resume" : "pause";
    await fetch(`/api/chat/${endpoint}`, { method: "POST" });
  };

  const toggleMode = async () => {
    const newMode = mode === "auto" ? "manual" : "auto";
    await fetch("/api/chat/mode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: newMode }),
    });
  };

  const nextTurn = async (participantId?: string) => {
    await fetch("/api/chat/next", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId }),
    });
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    await fetch("/api/chat/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: input }),
    });
    setInput("");
  };

  const generateSummary = async (modelId: string) => {
    const res = await fetch("/api/chat/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelId }),
    });
    const data = await res.json();
    alert(data.summary || data.error);
  };

  if (status === "idle") {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Start Discussion</h1>

        <div className="mb-4">
          <label className="block mb-2 font-medium">Topic</label>
          <input
            className="w-full p-2 border rounded"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. The Future of AI"
          />
        </div>

        <div className="mb-6">
          <label className="block mb-2 font-medium">Select Models</label>
          <div className="grid grid-cols-2 gap-2">
            {availableModels.map((m) => (
              <label
                key={m}
                className="flex items-center space-x-2 p-2 border rounded hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={selectedModels.includes(m)}
                  onChange={(e) => {
                    if (e.target.checked)
                      setSelectedModels([...selectedModels, m]);
                    else
                      setSelectedModels(selectedModels.filter((x) => x !== m));
                  }}
                />
                <span>{m}</span>
              </label>
            ))}
          </div>
        </div>

        <button
          onClick={() => void startChat()}
          disabled={!topic || selectedModels.length < 2}
          className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          Start Discussion
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="p-4 border-b bg-white flex items-center justify-between">
        <div>
          <h1 className="font-bold text-lg">{topic}</h1>
          <div className="text-sm text-gray-500 flex items-center space-x-2">
            <span
              className={`w-2 h-2 rounded-full ${status === "discussing" ? "bg-green-500" : "bg-yellow-500"}`}
            />
            <span className="capitalize">{status}</span>
            <span>•</span>
            <span className="capitalize">{mode} Mode</span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => void togglePause()}
            className="px-3 py-1 border rounded hover:bg-gray-50"
          >
            {status === "paused" ? "Resume" : "Pause"}
          </button>
          <button
            onClick={() => void toggleMode()}
            className="px-3 py-1 border rounded hover:bg-gray-50"
          >
            Switch to {mode === "auto" ? "Manual" : "Auto"}
          </button>
          <button
            onClick={() => void stopChat()}
            className="px-3 py-1 border rounded text-red-600 hover:bg-red-50"
          >
            Stop
          </button>
        </div>
      </header>

      {/* Main Chat */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.map((msg) => {
          const p = participants.find((x) => x.id === msg.senderId);
          const isSystem = msg.role === "system";
          const isUser = msg.role === "user";

          if (isSystem) {
            return (
              <div
                key={msg.id}
                className="text-center text-gray-500 text-sm my-4"
              >
                {msg.content}
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={`flex ${isUser ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-4 ${isUser ? "bg-blue-600 text-white" : "bg-white border shadow-sm"}`}
              >
                <div className="text-xs opacity-75 mb-1 font-medium">
                  {p?.name || msg.senderId}
                </div>
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </main>

      {/* Controls & Input */}
      <footer className="p-4 border-t bg-white">
        {mode === "manual" && (
          <div className="mb-4 flex space-x-2 overflow-x-auto pb-2">
            {participants
              .filter((p) => p.type === "ai")
              .map((p) => (
                <button
                  key={p.id}
                  onClick={() => void nextTurn(p.id)}
                  className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200 text-sm whitespace-nowrap"
                >
                  Next: {p.name}
                </button>
              ))}
            <button
              onClick={() => void nextTurn()}
              className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm whitespace-nowrap"
            >
              Next: Random
            </button>
          </div>
        )}

        <form
          onSubmit={(e) => {
            void sendMessage(e);
          }}
          className="flex space-x-2"
        >
          <input
            className="flex-1 p-2 border rounded"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message to interrupt..."
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Send
          </button>
        </form>

        <div className="mt-2 flex justify-end">
          <select
            className="text-sm border rounded p-1"
            onChange={(e) => {
              if (e.target.value) {
                void generateSummary(e.target.value);
              }
              e.target.value = "";
            }}
          >
            <option value="">Generate Summary...</option>
            {participants
              .filter((p) => p.type === "ai")
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </div>
      </footer>
    </div>
  );
}
