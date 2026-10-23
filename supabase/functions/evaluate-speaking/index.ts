import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import {
  baseMimeType,
  hasMatchingAudioSignature,
  isValidRecordingDuration,
  isValidRecordingFormat,
  isValidRecordingPath,
  validateEvaluation,
} from "./validation.ts";

const corsHeadersBase = {
  "Access-Control-Allow-Headers":
    "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

const responseSchema = {
  type: "OBJECT",
  properties: {
    transcript: { type: "STRING" },
    scores: {
      type: "OBJECT",
      properties: {
        overall: { type: "NUMBER", nullable: true, minimum: 0, maximum: 100 },
        fluency: { type: "NUMBER", nullable: true, minimum: 0, maximum: 100 },
        grammar: { type: "NUMBER", nullable: true, minimum: 0, maximum: 100 },
        vocabulary: {
          type: "NUMBER",
          nullable: true,
          minimum: 0,
          maximum: 100,
        },
        clarity: { type: "NUMBER", nullable: true, minimum: 0, maximum: 100 },
      },
      required: ["overall", "fluency", "grammar", "vocabulary", "clarity"],
    },
    strengths: { type: "ARRAY", items: { type: "STRING" } },
    improvements: { type: "ARRAY", items: { type: "STRING" } },
    grammar_corrections: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          original: { type: "STRING" },
          corrected: { type: "STRING" },
          explanation: { type: "STRING" },
        },
        required: ["original", "corrected", "explanation"],
      },
    },
    follow_up_exercises: { type: "ARRAY", items: { type: "STRING" } },
    flags: {
      type: "OBJECT",
      properties: {
        silence: { type: "BOOLEAN" },
        unintelligible_audio: { type: "BOOLEAN" },
        insufficient_speech: { type: "BOOLEAN" },
        unable_to_assess: { type: "BOOLEAN" },
      },
      required: [
        "silence",
        "unintelligible_audio",
        "insufficient_speech",
        "unable_to_assess",
      ],
    },
    limitations: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: [
    "transcript",
    "scores",
    "strengths",
    "improvements",
    "grammar_corrections",
    "follow_up_exercises",
    "flags",
    "limitations",
  ],
};

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin");
  const configured = (Deno.env.get("SPEAKDAILY_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const allowed = new Set([
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    ...configured,
  ]);
  return {
    ...corsHeadersBase,
    ...(origin && allowed.has(origin)
      ? { "Access-Control-Allow-Origin": origin }
      : {}),
  };
}

function jsonResponse(
  request: Request,
  status: number,
  body: Record<string, unknown>,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function validUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(value);
}

function encodeBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, offset + chunkSize),
    );
  }
  return btoa(binary);
}

async function readJsonBody(
  request: Request,
  maxBytes: number,
): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]
    ?.trim().toLowerCase();
  if (contentType !== "application/json") throw new Error("invalid_body");
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error("body_too_large");
  }
  if (!request.body) throw new Error("invalid_body");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error("body_too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new Error("invalid_body");
  }
}

Deno.serve(async (request) => {
  const headers = corsHeaders(request);
  const origin = request.headers.get("origin");
  if (origin && !headers["Access-Control-Allow-Origin"]) {
    return jsonResponse(request, 403, { error: "origin_not_allowed" });
  }
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") {
    return jsonResponse(request, 405, { error: "method_not_allowed" });
  }

  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!token || !supabaseUrl || !anonKey || !serviceKey) {
    return jsonResponse(request, 401, { error: "unauthorized" });
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(
    token,
  );
  if (authError || !authData.user) {
    return jsonResponse(request, 401, { error: "unauthorized" });
  }

  let body: unknown;
  try {
    body = await readJsonBody(request, 2048);
  } catch (error) {
    if (error instanceof Error && error.message === "body_too_large") {
      return jsonResponse(request, 413, { error: "invalid_request" });
    }
    return jsonResponse(request, 400, { error: "invalid_request" });
  }
  const sessionId = body && typeof body === "object"
    ? (body as Record<string, unknown>).session_id
    : null;
  if (!validUuid(sessionId)) {
    return jsonResponse(request, 400, { error: "invalid_request" });
  }
  if (
    Object.keys(body as Record<string, unknown>).some((key) =>
      key !== "session_id"
    )
  ) {
    return jsonResponse(request, 400, { error: "invalid_request" });
  }

  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
  const geminiModel = Deno.env.get("GEMINI_MODEL");
  if (
    !geminiApiKey || !geminiModel ||
    !/^[a-z0-9][a-z0-9.-]{1,100}$/i.test(geminiModel)
  ) {
    return jsonResponse(request, 503, { error: "evaluation_unavailable" });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: claim, error: claimError } = await admin.rpc(
    "claim_speaking_evaluation",
    {
      p_session_id: sessionId,
      p_user_id: authData.user.id,
    },
  );
  if (claimError || !claim || typeof claim !== "object") {
    console.error("Evaluation claim failed", {
      sessionId,
      code: "claim_unavailable",
    });
    return jsonResponse(request, 503, { error: "evaluation_unavailable" });
  }

  const claimRecord = claim as Record<string, unknown>;
  const outcome = claimRecord.outcome;
  if (outcome === "not_found") {
    return jsonResponse(request, 404, { error: "session_not_found" });
  }
  if (outcome === "ineligible") {
    return jsonResponse(request, 409, { error: "session_ineligible" });
  }
  if (outcome === "quota_exceeded") {
    return jsonResponse(request, 429, { error: "daily_quota_exceeded" });
  }
  if (outcome === "processing") {
    return jsonResponse(request, 202, { status: "processing" });
  }
  if (outcome === "failed") {
    return jsonResponse(request, 409, { error: "session_failed" });
  }
  if (outcome === "completed") {
    const { data: result } = await admin.from("speaking_sessions")
      .select("id, status, transcript, feedback, error_message")
      .eq("id", sessionId)
      .eq("user_id", authData.user.id)
      .maybeSingle();
    if (result?.status === "completed") {
      return jsonResponse(request, 200, {
        status: "completed",
        transcript: result.transcript,
        feedback: result.feedback,
      });
    }
    return jsonResponse(request, 409, { error: "session_ineligible" });
  }

  const claimedUserId = claimRecord.user_id;
  const recordingPath = claimRecord.recording_path;
  const durationSeconds = claimRecord.duration_seconds;
  if (
    claimedUserId !== authData.user.id || typeof recordingPath !== "string" ||
    !validUuid(claimedUserId) || !validUuid(claimRecord.session_id)
  ) {
    console.error("Evaluation claim validation failed", {
      sessionId,
      code: "claim_invalid",
    });
    await admin.from("speaking_sessions").update({
      status: "failed",
      error_message: "session_invalid",
    }).eq("id", sessionId).eq("user_id", authData.user.id).eq(
      "status",
      "processing",
    );
    return jsonResponse(request, 409, { error: "session_ineligible" });
  }

  const cleanupRecording = async () => {
    const { error } = await admin.storage.from("speaking-audio").remove([
      recordingPath,
    ]);
    if (!error) {
      await admin.from("speaking_sessions").update({ recording_path: null }).eq(
        "id",
        sessionId,
      ).eq("user_id", authData.user.id);
      return true;
    }
    return false;
  };

  const failSession = async (safeCode: string, removeRecording = true) => {
    const removed = removeRecording
      ? await cleanupRecording().catch(() => false)
      : true;
    await admin
      .from("speaking_sessions")
      .update({
        status: "failed",
        error_message: removed ? safeCode : `${safeCode}_audio_cleanup_pending`,
      })
      .eq("id", sessionId)
      .eq("user_id", authData.user.id)
      .eq("status", "processing");
  };

  try {
    if (
      !isValidRecordingPath(recordingPath, authData.user.id, sessionId) ||
      !isValidRecordingDuration(durationSeconds)
    ) {
      await failSession("recording_invalid");
      return jsonResponse(request, 422, { error: "recording_invalid" });
    }

    const { data: sessionRow, error: sessionError } = await admin
      .from("speaking_sessions")
      .select("id, user_id, topic_id, status, duration_seconds, recording_path")
      .eq("id", sessionId)
      .eq("user_id", authData.user.id)
      .eq("status", "processing")
      .single();
    if (
      sessionError || !sessionRow || sessionRow.recording_path !== recordingPath
    ) {
      await failSession("session_invalid");
      return jsonResponse(request, 409, { error: "session_ineligible" });
    }

    let topicTitle = "Open speaking practice";
    let topicPrompt = "Speak about a topic of your choice.";
    if (sessionRow.topic_id) {
      const { data: topic, error: topicError } = await admin
        .from("speaking_topics")
        .select("title, prompt")
        .eq("id", sessionRow.topic_id)
        .maybeSingle();
      if (topicError || !topic) {
        await failSession("topic_unavailable");
        return jsonResponse(request, 422, { error: "topic_unavailable" });
      }
      topicTitle = topic.title;
      topicPrompt = topic.prompt;
    }

    const { data: blob, error: downloadError } = await admin.storage.from(
      "speaking-audio",
    ).download(recordingPath);
    if (
      downloadError || !blob || blob.size < 1 || blob.size > 10 * 1024 * 1024
    ) {
      await failSession("recording_invalid");
      return jsonResponse(request, 422, { error: "recording_invalid" });
    }
    const mimeType = baseMimeType(blob.type);
    if (
      !isValidRecordingFormat(recordingPath, mimeType) ||
      !await hasMatchingAudioSignature(blob, mimeType)
    ) {
      await failSession("recording_invalid");
      return jsonResponse(request, 422, { error: "recording_invalid" });
    }

    const bytes = new Uint8Array(await blob.arrayBuffer());
    const prompt =
      `Evaluate one short spoken English practice response. The assigned topic is: ${topicTitle}. The assigned prompt is: ${topicPrompt}\n\nReturn a faithful verbatim transcript using only words that are clearly audible. Never infer, complete, paraphrase, or invent words. Set silence, unintelligible_audio, insufficient_speech, and unable_to_assess flags honestly. If there is no clear speech or not enough speech to assess, return an empty transcript when appropriate, set unavailable scores to null, and do not invent strengths, corrections, or improvements. Score only what is supported by the audio and transcript. Assess fluency, grammar, vocabulary, clarity, and overall response quality; do not provide or claim a pronunciation-accuracy score because this evaluation does not reliably assess pronunciation. Grammar corrections must quote words actually heard. Give concise, evidence-based strengths, actionable improvements, and follow-up exercises. Add a limitations entry explaining pronunciation is not scored from this analysis. Keep all feedback constructive and avoid unsupported claims.`;

    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), 60_000);
    let providerResponse: Response;
    try {
      providerResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${
          encodeURIComponent(geminiModel)
        }:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": geminiApiKey,
          },
          signal: abortController.signal,
          body: JSON.stringify({
            contents: [{
              role: "user",
              parts: [{ text: prompt }, {
                inlineData: { mimeType, data: encodeBase64(bytes) },
              }],
            }],
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema,
              maxOutputTokens: 3000,
            },
          }),
        },
      );
    } catch (providerError) {
      const timedOut = providerError instanceof DOMException &&
        providerError.name === "AbortError";
      await failSession(timedOut ? "provider_timeout" : "provider_unavailable");
      return jsonResponse(request, timedOut ? 504 : 502, {
        error: timedOut ? "provider_timeout" : "provider_unavailable",
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!providerResponse.ok) {
      const providerStatus = providerResponse.status;
      const safeCode = providerStatus === 429
        ? "provider_quota"
        : providerStatus >= 500
        ? "provider_unavailable"
        : "provider_rejected_request";
      console.error("Gemini evaluation request failed", {
        sessionId,
        providerStatus,
        code: safeCode,
      });
      await failSession(safeCode);
      return jsonResponse(request, providerStatus === 429 ? 429 : 502, {
        error: safeCode,
      });
    }

    const providerBody = await providerResponse.json().catch(() => null) as
      | Record<string, unknown>
      | null;
    const candidates = providerBody?.candidates;
    const candidate = Array.isArray(candidates)
      ? candidates[0] as Record<string, unknown> | undefined
      : undefined;
    const content = candidate?.content as Record<string, unknown> | undefined;
    const parts = content?.parts;
    const text = Array.isArray(parts)
      ? parts.map((part) =>
        part && typeof part === "object"
          ? (part as Record<string, unknown>).text
          : null
      ).filter((part): part is string => typeof part === "string").join("\n")
      : "";
    let parsedOutput: unknown = null;
    try {
      parsedOutput = JSON.parse(text);
    } catch {
      /* invalid provider output is handled as a safe analysis failure */
    }
    const result = validateEvaluation(parsedOutput);
    if (!result) {
      console.error("Gemini returned an invalid evaluation shape", {
        sessionId,
        code: "malformed_response",
      });
      await failSession("analysis_unavailable");
      return jsonResponse(request, 502, { error: "analysis_unavailable" });
    }

    const { data: completed, error: persistError } = await admin
      .from("speaking_sessions")
      .update({
        transcript: result.transcript,
        feedback: result.feedback,
        duration_seconds: durationSeconds as number,
        error_message: null,
        status: "completed",
      })
      .eq("id", sessionId)
      .eq("user_id", authData.user.id)
      .eq("status", "processing")
      .select("id")
      .maybeSingle();

    if (persistError || !completed) {
      console.error("Evaluation result persistence failed", {
        sessionId,
        code: "persist_failed",
      });
      await failSession("analysis_unavailable");
      return jsonResponse(request, 500, { error: "analysis_unavailable" });
    }

    const audioRemoved = await cleanupRecording().catch(() => false);
    if (!audioRemoved) {
      await admin.from("speaking_sessions")
        .update({ error_message: "audio_cleanup_pending" })
        .eq("id", sessionId)
        .eq("user_id", authData.user.id)
        .eq("status", "completed");
    }
    return jsonResponse(request, 200, {
      status: "completed",
      transcript: result.transcript,
      feedback: result.feedback,
    });
  } catch {
    console.error("Evaluation request failed unexpectedly", {
      sessionId,
      code: "analysis_unavailable",
    });
    await failSession("analysis_unavailable");
    return jsonResponse(request, 500, { error: "analysis_unavailable" });
  }
});
