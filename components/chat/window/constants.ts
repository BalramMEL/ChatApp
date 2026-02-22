import type { ReactionKey } from "../types";

export const REACTION_META: Array<{ key: ReactionKey; label: string }> = [
  { key: "thumbs_up", label: "\u{1F44D}" },
  { key: "heart", label: "\u{2764}\u{FE0F}" },
  { key: "joy", label: "\u{1F602}" },
  { key: "wow", label: "\u{1F62E}" },
  { key: "sad", label: "\u{1F622}" },
];

export const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;
export const MAX_DOCUMENT_SIZE_BYTES = 15 * 1024 * 1024;
export const DOCUMENT_ACCEPT =
  ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z,.rtf";

export const DOCUMENT_EXTENSIONS = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".txt",
  ".csv",
  ".zip",
  ".rar",
  ".7z",
  ".rtf",
]);
