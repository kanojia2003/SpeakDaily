export type EvaluationFeedback = {
  scores: { overall: number | null; fluency: number | null; grammar: number | null; vocabulary: number | null; clarity: number | null }
  strengths: string[]
  improvements: string[]
  grammar_corrections: Array<{ original: string; corrected: string; explanation: string }>
  follow_up_exercises: string[]
  flags: { silence: boolean; unintelligible_audio: boolean; insufficient_speech: boolean; unable_to_assess: boolean }
  limitations: string[]
}

export function asEvaluationFeedback(value: unknown): EvaluationFeedback | null {
  if (!value || typeof value !== 'object') return null
  const feedback = value as Partial<EvaluationFeedback>
  if (!feedback.scores || !feedback.flags) return null
  const scoreKeys = ['overall', 'fluency', 'grammar', 'vocabulary', 'clarity'] as const
  if (Object.keys(feedback.scores).length !== scoreKeys.length || !scoreKeys.every((key) => {
    const score = feedback.scores?.[key]
    return score === null || (typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 100)
  })) return null
  if (!['silence', 'unintelligible_audio', 'insufficient_speech', 'unable_to_assess'].every((key) => typeof feedback.flags?.[key as keyof EvaluationFeedback['flags']] === 'boolean')) return null
  const stringLists = [feedback.strengths, feedback.improvements, feedback.follow_up_exercises, feedback.limitations]
  if (!stringLists.every((list) => Array.isArray(list) && list.length <= 8 && list.every((item) => typeof item === 'string' && item.length <= 500))) return null
  if (!Array.isArray(feedback.grammar_corrections) || feedback.grammar_corrections.length > 8 || !feedback.grammar_corrections.every((item) => item && ['original', 'corrected', 'explanation'].every((key) => typeof item[key as keyof typeof item] === 'string' && item[key as keyof typeof item].length <= 500))) return null
  return feedback as EvaluationFeedback
}
