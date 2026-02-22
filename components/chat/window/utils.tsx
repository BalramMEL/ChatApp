import type { ReactNode } from "react";

import type { ConversationMessage } from "../types";
import { DOCUMENT_EXTENSIONS } from "./constants";

export type TimelineItem =
  | { type: "divider"; key: string; label: string }
  | { type: "message"; key: string; message: ConversationMessage };

export function isNearBottom(container: HTMLDivElement) {
  const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
  return distance < 80;
}

export function getFileExtension(name: string) {
  const index = name.lastIndexOf(".");
  return index === -1 ? "" : name.slice(index).toLowerCase();
}

export function isSupportedDocument(file: File) {
  return DOCUMENT_EXTENSIONS.has(getFileExtension(file.name));
}

export function formatTypingLabel(names: string[]) {
  if (names.length === 0) return null;
  if (names.length === 1) return `${names[0]} is typing...`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`;
  return `${names[0]} and ${names.length - 1} others are typing...`;
}

export function toErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

export function formatFileSize(bytes: number | null) {
  if (!bytes || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function isSameCalendarDay(leftTimestamp: number, rightTimestamp: number) {
  const left = new Date(leftTimestamp);
  const right = new Date(rightTimestamp);
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function getDateDividerLabel(timestamp: number) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 24 * 60 * 60 * 1000;

  if (isSameCalendarDay(timestamp, today)) {
    return "Today";
  }
  if (isSameCalendarDay(timestamp, yesterday)) {
    return "Yesterday";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(timestamp));
}

export function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function highlightText(content: string, query: string): ReactNode {
  const trimmed = query.trim();
  if (!trimmed) {
    return content;
  }

  const parts = content.split(new RegExp(`(${escapeRegExp(trimmed)})`, "gi"));
  const lower = trimmed.toLowerCase();

  return parts.map((part, index) =>
    part.toLowerCase() === lower ? (
      <mark
        key={`${part}-${index}`}
        className="rounded-sm bg-amber-200 px-0.5 text-slate-900 dark:bg-amber-300 dark:text-slate-900"
      >
        {part}
      </mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    ),
  );
}

export function buildTimelineItems(messages: ConversationMessage[] | undefined): TimelineItem[] {
  if (!messages) {
    return [];
  }

  return messages.flatMap((message, index) => {
    const previous = messages[index - 1];
    const startsNewDay = !previous || !isSameCalendarDay(previous.createdAt, message.createdAt);

    const items: TimelineItem[] = [];
    if (startsNewDay) {
      items.push({
        type: "divider",
        key: `divider-${message._id}`,
        label: getDateDividerLabel(message.createdAt),
      });
    }

    items.push({
      type: "message",
      key: `message-${message._id}`,
      message,
    });

    return items;
  });
}

export function countSearchMatches(
  messages: ConversationMessage[] | undefined,
  query: string,
) {
  if (!messages || !query.trim()) {
    return 0;
  }

  const regex = new RegExp(escapeRegExp(query.trim()), "gi");
  let count = 0;
  for (const message of messages) {
    const textValues = [
      message.body,
      message.fileName ?? "",
      message.messageType === "file" ? message.fileMimeType ?? "" : "",
    ];
    for (const value of textValues) {
      if (!value) {
        continue;
      }
      const matches = value.match(regex);
      if (matches) {
        count += matches.length;
      }
    }
  }

  return count;
}
