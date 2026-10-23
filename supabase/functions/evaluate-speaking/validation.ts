export type Feedback = {
  scores: {
    overall: number | null;
    fluency: number | null;
    grammar: number | null;
    vocabulary: number | null;
    clarity: number | null;
  };
  strengths: string[];
  improvements: string[];
  grammar_corrections: Array<
    { original: string; corrected: string; explanation: string }
  >;
  follow_up_exercises: string[];
  flags: {
    silence: boolean;
    unintelligible_audio: boolean;
    insufficient_speech: boolean;
    unable_to_assess: boolean;
  };
  limitations: string[];
};

export function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= 8 &&
    value.every((item) => typeof item === "string" && item.length <= 500);
}

function validScore(value: unknown): value is number | null {
  return value === null ||
    (typeof value === "number" && Number.isFinite(value) && value >= 0 &&
      value <= 100);
}

export function validateEvaluation(
  value: unknown,
): { transcript: string; feedback: Feedback } | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const scores = record.scores as Record<string, unknown> | undefined;
  const flags = record.flags as Record<string, unknown> | undefined;
  const corrections = record.grammar_corrections;
  if (
    typeof record.transcript !== "string" ||
    record.transcript.length > 20_000 || !scores || !flags
  ) return null;
  if (
    !["overall", "fluency", "grammar", "vocabulary", "clarity"].every((key) =>
      validScore(scores[key])
    )
  ) return null;
  if (
    ![
      "silence",
      "unintelligible_audio",
      "insufficient_speech",
      "unable_to_assess",
    ].every((key) => typeof flags[key] === "boolean")
  ) return null;
  if (
    !isStringList(record.strengths) || !isStringList(record.improvements) ||
    !isStringList(record.follow_up_exercises) ||
    !isStringList(record.limitations)
  ) return null;
  if (
    !Array.isArray(corrections) || corrections.length > 8 ||
    !corrections.every((item) => {
      if (!item || typeof item !== "object") return false;
      const correction = item as Record<string, unknown>;
      return ["original", "corrected", "explanation"].every((key) =>
        typeof correction[key] === "string" &&
        (correction[key] as string).length <= 500
      );
    })
  ) return null;

  const feedback = record as unknown as Feedback;
  if (
    feedback.flags.unable_to_assess &&
    Object.values(feedback.scores).some((score) => score !== null)
  ) return null;
  const transcript = record.transcript;
  if (
    !transcript.trim() && !feedback.flags.silence &&
    !feedback.flags.unintelligible_audio &&
    !feedback.flags.insufficient_speech && !feedback.flags.unable_to_assess
  ) return null;
  if (
    !feedback.limitations.some((limitation) =>
      limitation.toLowerCase().includes("pronunciation")
    )
  ) return null;
  if (
    Object.values(feedback.scores).some((score) => score === null) &&
    feedback.limitations.length === 0
  ) return null;

  const normalizedTranscript = transcript.toLocaleLowerCase().replace(
    /\s+/g,
    " ",
  ).trim();
  for (const correction of feedback.grammar_corrections) {
    const original = correction.original.toLocaleLowerCase().replace(
      /\s+/g,
      " ",
    ).trim();
    if (!original || !normalizedTranscript.includes(original)) return null;
  }
  return { transcript, feedback };
}

export function baseMimeType(value: string) {
  const normalized = value.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  return normalized === "audio/x-wav" ? "audio/wav" : normalized;
}

export async function hasMatchingAudioSignature(blob: Blob, mimeType: string) {
  const bytes = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  switch (mimeType) {
    case "audio/webm":
      return bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 &&
        bytes[2] === 0xdf && bytes[3] === 0xa3;
    case "audio/ogg":
      return new TextDecoder().decode(bytes.slice(0, 4)) === "OggS";
    case "audio/mp4":
      return bytes.length >= 8 &&
        new TextDecoder().decode(bytes.slice(4, 8)) === "ftyp";
    case "audio/wav":
      return new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
        new TextDecoder().decode(bytes.slice(8, 12)) === "WAVE";
    case "audio/mpeg":
      return new TextDecoder().decode(bytes.slice(0, 3)) === "ID3" ||
        (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
    case "audio/aac":
      return bytes.length >= 2 && bytes[0] === 0xff &&
        (bytes[1] & 0xf6) === 0xf0;
    case "audio/flac":
      return new TextDecoder().decode(bytes.slice(0, 4)) === "fLaC";
    default:
      return false;
  }
}

export function isValidRecordingPath(
  path: string,
  userId: string,
  sessionId: string,
) {
  const pathPattern = new RegExp(
    `^${userId}/${sessionId}/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.(webm|m4a|ogg|wav|mp3|aac|flac)$`,
    "i",
  );
  return pathPattern.test(path);
}

export function isValidRecordingFormat(path: string, mimeType: string) {
  const extensions: Record<string, string> = {
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/mp4": "m4a",
    "audio/wav": "wav",
    "audio/mpeg": "mp3",
    "audio/aac": "aac",
    "audio/flac": "flac",
  };
  const extension = path.split(".").at(-1)?.toLowerCase();
  return Boolean(extension && extension === extensions[mimeType]);
}

export function isValidRecordingDuration(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === "number" && value >= 1 &&
    value <= 120;
}
