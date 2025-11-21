import { type ChatMessage } from "@/services/discuss/engine";

type FsWritable = {
  write: (data: string) => Promise<void>;
  close: () => Promise<void>;
};
type FsFileHandle = { createWritable: () => Promise<FsWritable> };
type FsDirectoryHandle = {
  getFileHandle: (
    name: string,
    options?: { create?: boolean },
  ) => Promise<FsFileHandle>;
  getDirectoryHandle: (
    name: string,
    options?: { create?: boolean },
  ) => Promise<FsDirectoryHandle>;
};

type FsWindow = Window &
  Partial<{
    showDirectoryPicker: () => Promise<FsDirectoryHandle>;
  }>;

export interface Participant {
  id: string;
  name: string;
  model?: string;
  type: "ai" | "human";
}

export interface SessionData {
  id: string;
  name: string;
  topic: string;
  participants: Participant[];
  history: ChatMessage[];
  createdAt: number;
}

type NormalizedSession = SessionData & {
  participants: Participant[];
  history: ChatMessage[];
};

const hasFileSystemAccess = () =>
  typeof window !== "undefined" &&
  typeof (window as FsWindow).showDirectoryPicker === "function";

const sanitizeFilename = (name: string) =>
  (name || "session")
    .replace(/[^a-z0-9\u4e00-\u9fa5]/gi, "_")
    .replace(/_+/g, "_");

const uniqueBasename = (
  base: string,
  used: Set<string>,
  fallbackIndex: number,
): string => {
  const safeBase = base || `session-${fallbackIndex}`;
  let candidate = safeBase;
  let counter = 1;
  while (used.has(candidate.toLowerCase())) {
    candidate = `${safeBase}-${counter}`;
    counter += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
};

const normalizeSession = (
  session: SessionData,
  index = 0,
): NormalizedSession => {
  const participants = Array.isArray(session.participants)
    ? session.participants
    : [];
  const history = Array.isArray(session.history) ? session.history : [];
  return {
    ...session,
    topic: session.topic || session.name || `Session ${index + 1}`,
    participants,
    history: [...history]
      .filter((entry): entry is ChatMessage => Boolean(entry))
      .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0)),
  };
};

const formatPodcastScript = (session: NormalizedSession): string => {
  const { topic, participants, history, createdAt, name } = session;
  const title = topic || name || "Session";
  const participantNames = participants
    .map((p) => `${p.name}${p.model ? ` (${p.model})` : ""}`)
    .join(", ");

  let script = `# ${title}\n\n`;
  script += `**Participants**: ${participantNames || "N/A"}\n`;
  if (createdAt) {
    script += `**Created**: ${new Date(createdAt).toLocaleString()}\n`;
  }
  script += `\n---\n\n`;

  history.forEach((msg) => {
    if (msg.role === "system") return;
    const participant = participants.find((p) => p.id === msg.senderId);
    const nameLabel = participant
      ? participant.name
      : msg.role === "user"
        ? "User"
        : "Unknown";

    const content =
      typeof msg.content === "string"
        ? msg.content
        : JSON.stringify(msg.content ?? "");

    script += `**${nameLabel}**:\n${content}\n\n`;
  });

  return script;
};

const writeContent = async (
  directory: FsDirectoryHandle,
  filename: string,
  content: string,
) => {
  const fileHandle = await directory.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
};

const downloadFile = (filename: string, content: string) => {
  const blob = new Blob([content], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

export async function exportSession(rawSession: SessionData): Promise<boolean> {
  const session = normalizeSession(rawSession);
  const filename = `${sanitizeFilename(session.topic || session.name)}.md`;
  const content = formatPodcastScript(session);

  if (hasFileSystemAccess()) {
    try {
      const handle = await (window as FsWindow).showDirectoryPicker!();
      await writeContent(handle, filename, content);
      return true;
    } catch (err) {
      if ((err as Error).name === "AbortError") return false;
      console.error("Export failed:", err);
    }
  }

  downloadFile(filename, content);
  return true;
}

export async function exportAllSessions(
  rawSessions: SessionData[],
): Promise<boolean> {
  const sessions = rawSessions.map(normalizeSession);
  const dateStr = new Date().toISOString().split("T")[0];
  const usedNames = new Set<string>();

  if (hasFileSystemAccess()) {
    try {
      const rootHandle = await (window as FsWindow).showDirectoryPicker!();
      const folderName = `xling-${dateStr}`;
      const subDir = await rootHandle.getDirectoryHandle(folderName, {
        create: true,
      });

      await Promise.all(
        sessions.map(async (session, index) => {
          const base = sanitizeFilename(session.topic || session.name);
          const uniqueName = uniqueBasename(base, usedNames, index + 1);
          await writeContent(
            subDir,
            `${uniqueName}.md`,
            formatPodcastScript(session),
          );
        }),
      );
      return true;
    } catch (err) {
      if ((err as Error).name === "AbortError") return false;
      console.error("Batch export failed:", err);
    }
  }

  const bundled = sessions
    .map((session) => formatPodcastScript(session))
    .join("\n\n---\n\n");
  downloadFile(`xling-${dateStr}.md`, bundled);
  return true;
}

export async function exportAllSessionsFromApi(): Promise<boolean> {
  const res = await fetch("/api/export/all");
  if (!res.ok) {
    throw new Error(`Export failed (${res.status})`);
  }
  const data = await res.json();
  return exportAllSessions(data.sessions || []);
}
