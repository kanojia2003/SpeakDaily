import type { EvaluationFeedback } from './evaluationFeedback'

export function EvaluationResults({ transcript, feedback }: { transcript: string; feedback: EvaluationFeedback }) {
  return (
    <div className="evaluation-result">
      {(feedback.flags.silence || feedback.flags.unintelligible_audio || feedback.flags.insufficient_speech || feedback.flags.unable_to_assess) && (
        <p className="evaluation-notice" role="status">
          {feedback.flags.silence ? 'No speech was detected.' : feedback.flags.unintelligible_audio ? 'The speech could not be understood clearly.' : 'There was not enough clear speech to assess this session.'}
        </p>
      )}
      <section aria-labelledby="transcript-title">
        <h3 id="transcript-title">Transcript</h3>
        <p className="evaluation-transcript">{transcript || 'No transcript is available for this recording.'}</p>
      </section>
      <section aria-labelledby="scores-title">
        <h3 id="scores-title">Speaking scores</h3>
        <dl className="evaluation-scores">
          {Object.entries(feedback.scores).map(([key, score]) => <div key={key}><dt>{key === 'overall' ? 'Overall' : key[0]?.toUpperCase() + key.slice(1)}</dt><dd>{score === null ? 'Not assessed' : `${score}/100`}</dd></div>)}
        </dl>
      </section>
      {feedback.strengths.length > 0 && <section><h3>What worked</h3><ul>{feedback.strengths.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></section>}
      {feedback.improvements.length > 0 && <section><h3>Try next</h3><ul>{feedback.improvements.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></section>}
      {feedback.grammar_corrections.length > 0 && <section><h3>Grammar notes</h3><ul className="grammar-corrections">{feedback.grammar_corrections.map((item, index) => <li key={`${index}-${item.original}`}><p><del>{item.original}</del> <span aria-hidden="true">→</span> <strong>{item.corrected}</strong></p><p>{item.explanation}</p></li>)}</ul></section>}
      {feedback.follow_up_exercises.length > 0 && <section><h3>Practice next</h3><ul>{feedback.follow_up_exercises.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></section>}
      {feedback.limitations.length > 0 && <p className="evaluation-limitations">{feedback.limitations.join(' ')}</p>}
    </div>
  )
}
