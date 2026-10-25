import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { RecordingWorkflow } from '../recording/RecordingWorkflow'
import { fetchCommunicationAnswers, fetchCommunicationRun, parseCommunicationQuestions, type CommunicationAnswer, type CommunicationQuestion, type CommunicationRun } from './data'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function answerStatusText(answer: CommunicationAnswer) {
  if (answer.status === 'processing') return 'Analysing your recording'
  if (answer.status === 'completed') return 'Feedback ready'
  if (answer.status === 'failed') return 'Analysis failed'
  return answer.recording_path ? 'Ready for analysis' : 'Session started'
}

export function CommunicationPracticePage() {
  const { runId = '' } = useParams()
  const { client, session } = useAuth()
  const userId = session?.user.id
  const [run, setRun] = useState<CommunicationRun | null>(null)
  const [questions, setQuestions] = useState<CommunicationQuestion[] | null>(null)
  const [answers, setAnswers] = useState<CommunicationAnswer[]>([])
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const loadedRunId = useRef('')

  const load = useCallback(async () => {
    if (!client || !userId) { setError('Sign in again to open this practice.'); setLoading(false); return }
    if (!uuidPattern.test(runId)) { setError('This practice link is not valid.'); setLoading(false); return }
    if (loadedRunId.current !== runId) setLoading(true)
    setError(null)
    try {
      const [savedRun, savedAnswers] = await Promise.all([
        fetchCommunicationRun(client, userId, runId),
        fetchCommunicationAnswers(client, userId, runId),
      ])
      if (!savedRun) { setRun(null); setError('This communication practice could not be found in your account.'); return }
      setRun(savedRun)
      setAnswers(savedAnswers)
      if (savedRun.status !== 'generating') {
        try { window.sessionStorage.removeItem(`speakdaily-communication-request:${userId}`) } catch { /* route state remains available */ }
      }
      if (savedRun.status === 'ready') {
        const validated = parseCommunicationQuestions(savedRun.questions)
        if (!validated) { setQuestions(null); setError('The saved question set could not be validated. No unverified questions are shown.'); return }
        setQuestions(validated)
        setActiveIndex((current) => current === null ? validated.findIndex((_, index) => !savedAnswers.some((answer) => answer.communication_question_index === index)) : current)
      } else setQuestions(null)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'This communication practice could not be loaded. Check your connection and try again.')
    } finally { setLoading(false); loadedRunId.current = runId }
  }, [client, userId, runId])

  useEffect(() => { void load() }, [load, revision])
  useEffect(() => {
    if (run?.status !== 'generating') return
    const timer = window.setTimeout(() => setRevision((value) => value + 1), 1800)
    return () => window.clearTimeout(timer)
  }, [run?.status, revision])

  const answerByIndex = useMemo(() => new Map(answers.filter((answer) => answer.communication_question_index !== null).map((answer) => [answer.communication_question_index as number, answer])), [answers])
  const complete = Boolean(questions?.length && questions.every((_, index) => answerByIndex.has(index)))
  const currentQuestion = activeIndex === null ? null : questions?.[activeIndex] ?? null

  return (
    <div className="communication-page communication-lesson">
      <Link className="text-link exercise-back-link" to="/app">← Back to your dashboard</Link>
      {loading ? <p className="dashboard-loading" role="status">Loading your communication practice…</p>
        : error ? <div className="dashboard-error" role="alert"><p>{error}</p><button className="text-button" onClick={() => setRevision((value) => value + 1)} type="button">Try again</button></div>
        : !run ? <p className="dashboard-empty">This practice is unavailable.</p>
          : run.status === 'generating' ? <section className="communication-state-panel" aria-live="polite"><p className="eyebrow">Preparing your lesson</p><h1>Your questions are being prepared.</h1><p>They’ll appear here as soon as the saved question set is ready.</p></section>
            : run.status === 'failed' ? <section className="communication-state-panel"><p className="eyebrow">Question generation</p><h1>This lesson could not be prepared.</h1><p role="alert">No sample questions were substituted. Start a new practice set when you’re ready.</p><Link className="button-link" to="/app/communication">Set up another practice</Link></section>
              : !questions ? null : complete ? (
                <section className="communication-state-panel" aria-labelledby="lesson-complete-title">
                  <p className="eyebrow">Lesson complete</p><h1 id="lesson-complete-title">You’ve worked through all four questions.</h1>
                  <p>Open each saved response to review its transcript and English feedback.</p>
                  <ol className="communication-question-list">
                    {questions.map((question, index) => {
                      const answer = answerByIndex.get(index)
                      return <li key={`${index}-${question.title}`}><span>{question.title}</span><span className={`session-status status-${answer?.status}`}>{answer ? answerStatusText(answer) : 'Not answered'}</span>{answer && <Link className="text-link" to={`/app/sessions/${answer.id}`}>Review response</Link>}</li>
                    })}
                  </ol>
                  <Link className="button-link" to="/app/communication">Start another communication practice</Link>
                </section>
              ) : currentQuestion && activeIndex !== null ? (
                <>
                  <header className="communication-heading">
                    <p className="eyebrow">Daily communication practice · Question {activeIndex + 1} of {questions.length}</p>
                    <h1>{currentQuestion.title}</h1>
                    <p className="dashboard-lede">Read the situation, gather your thoughts, then answer in your own words. You can record for up to two minutes and review the audio before submitting.</p>
                  </header>
                  <div className="communication-question-block"><p className="eyebrow">Your question</p><p>{currentQuestion.prompt}</p></div>
                  <div className="communication-progress" role="progressbar" aria-label="Lesson progress" aria-valuemin={1} aria-valuemax={questions.length} aria-valuenow={activeIndex + 1}><span style={{ width: `${((activeIndex + 1) / questions.length) * 100}%` }} /></div>
                  <RecordingWorkflow
                    key={`${run.id}-${activeIndex}`}
                    topic={null}
                    communication={{ runId: run.id, questionIndex: activeIndex, title: currentQuestion.title, prompt: currentQuestion.prompt }}
                    onContinue={() => {
                      const nextIndex = questions.findIndex((_, index) => index > activeIndex && !answerByIndex.has(index))
                      if (nextIndex < 0) setRevision((value) => value + 1)
                      else setActiveIndex(nextIndex)
                    }}
                  />
                  {answers.length > 0 && <div className="communication-saved-answers"><h2>Saved responses</h2><ul className="session-list">{answers.map((answer) => {
                    const questionIndex = answer.communication_question_index ?? -1
                    const question = questions[questionIndex]
                    return <li key={answer.id}><Link className="dashboard-session-link" to={`/app/sessions/${answer.id}`}><span><span className="session-topic">{question?.title ?? 'Practice response'}</span><span className="session-date">{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(answer.created_at))}</span></span><span className={`session-status status-${answer.status}`}>{answerStatusText(answer)}</span></Link></li>
                  })}</ul></div>}
                </>
              ) : <section className="communication-state-panel"><h1>No unanswered questions remain.</h1><p>Refresh your saved lesson to see its result links.</p><button className="secondary-button" onClick={() => setRevision((value) => value + 1)} type="button">Refresh lesson</button></section>}
    </div>
  )
}
