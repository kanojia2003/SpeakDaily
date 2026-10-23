import {
  baseMimeType,
  hasMatchingAudioSignature,
  isValidRecordingDuration,
  isValidRecordingFormat,
  isValidRecordingPath,
  validateEvaluation,
} from "./validation.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function sampleEvaluation(): {
  transcript: string;
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
} {
  return {
    transcript: "I enjoy reading books.",
    scores: {
      overall: 75,
      fluency: 70,
      grammar: 80,
      vocabulary: 72,
      clarity: 78,
    },
    strengths: ["The response answered the prompt."],
    improvements: ["Add one supporting example."],
    grammar_corrections: [{
      original: "I enjoy reading books.",
      corrected: "I enjoy reading books.",
      explanation: "The sentence is grammatically sound.",
    }],
    follow_up_exercises: ["Describe a book in three sentences."],
    flags: {
      silence: false,
      unintelligible_audio: false,
      insufficient_speech: false,
      unable_to_assess: false,
    },
    limitations: ["Pronunciation accuracy is not scored from this analysis."],
  };
}

Deno.test("accepts a complete bounded analysis result", () => {
  assert(
    validateEvaluation(sampleEvaluation()) !== null,
    "expected valid analysis",
  );
});

Deno.test("rejects invented correction text and out-of-range scores", () => {
  const invented = sampleEvaluation();
  invented.grammar_corrections[0]!.original = "I went to the park.";
  assert(
    validateEvaluation(invented) === null,
    "correction must quote transcript text",
  );

  const invalidScore = sampleEvaluation();
  invalidScore.scores.overall = 101;
  assert(
    validateEvaluation(invalidScore) === null,
    "score must remain within 0–100",
  );
});

Deno.test("requires unscored results when the response cannot be assessed", () => {
  const invalid = sampleEvaluation();
  invalid.flags.unable_to_assess = true;
  assert(
    validateEvaluation(invalid) === null,
    "unable-to-assess response must not contain scores",
  );

  const valid = sampleEvaluation();
  valid.transcript = "";
  valid.flags.silence = true;
  valid.flags.unable_to_assess = true;
  valid.scores = {
    overall: null,
    fluency: null,
    grammar: null,
    vocabulary: null,
    clarity: null,
  };
  valid.strengths = [];
  valid.improvements = [];
  valid.grammar_corrections = [];
  assert(
    validateEvaluation(valid) !== null,
    "honest silence result should be accepted",
  );
});

Deno.test("normalizes MIME values and checks an actual WebM signature", async () => {
  assert(
    baseMimeType("audio/webm;codecs=opus") === "audio/webm",
    "WebM MIME parameters should be removed",
  );
  const webm = new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x00])], {
    type: "audio/webm",
  });
  const mislabeled = new Blob([new Uint8Array([0x4f, 0x67, 0x67, 0x53])], {
    type: "audio/webm",
  });
  assert(
    await hasMatchingAudioSignature(webm, "audio/webm"),
    "WebM signature should validate",
  );
  assert(
    !await hasMatchingAudioSignature(mislabeled, "audio/webm"),
    "mismatched signature should fail",
  );
});

Deno.test("restricts audio path and duration to the claimed session", () => {
  const userId = "11111111-1111-4111-8111-111111111111";
  const sessionId = "22222222-2222-4222-8222-222222222222";
  const filename = "33333333-3333-4333-8333-333333333333.webm";
  assert(
    isValidRecordingPath(
      `${userId}/${sessionId}/${filename}`,
      userId,
      sessionId,
    ),
    "expected valid scoped path",
  );
  assert(
    isValidRecordingFormat(`${userId}/${sessionId}/${filename}`, "audio/webm"),
    "file extension should match detected MIME type",
  );
  assert(
    !isValidRecordingFormat(`${userId}/${sessionId}/${filename}`, "audio/ogg"),
    "mismatched extension should fail",
  );
  assert(
    !isValidRecordingPath(
      `44444444-4444-4444-8444-444444444444/${sessionId}/${filename}`,
      userId,
      sessionId,
    ),
    "cross-user path should fail",
  );
  assert(
    isValidRecordingDuration(120) && isValidRecordingDuration(1),
    "inclusive duration bounds should pass",
  );
  assert(
    !isValidRecordingDuration(0) && !isValidRecordingDuration(121),
    "out-of-range duration should fail",
  );
});
