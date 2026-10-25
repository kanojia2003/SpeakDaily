import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import type { SpeakingTopic } from '../dashboard/data'
import { useAudioRecorder, MAX_RECORDING_BYTES, MAX_RECORDING_SECONDS } from './useAudioRecorder'
import { EvaluationResults } from './EvaluationResults'
import { asEvaluationFeedback, type EvaluationFeedback } from './evaluationFeedback'

function evaluationErrorMessage(code: string | null) {
  if (!code) return 'We couldn’t confirm the analysis. Check your connection and try again.'
  if (code.includes('cleanup_pending')) return 'Your analysis is ready, but private audio cleanup did not finish automatically. Contact support to request cleanup.'
  if (code.includes('quota')) return 'Today’s analysis limit has been reached. Your recording is saved privately; try again tomorrow with a new session.'
  if (code.includes('timeout')) return 'The analysis took too long to finish. This session could not be completed; you can start a new recording and try again.'
  if (code.includes('unavailable')) return 'The analysis service is temporarily unavailable. Your recording was not given invented feedback.'
  if (code.includes('recording_invalid')) return 'This recording could not be validated. Please make a new recording.'
  if (code.includes('topic_unavailable')) return 'This topic is no longer available for analysis. Please choose another topic.'
  if (code.includes('rejected_request')) return 'The analysis provider rejected this recording. Please try a new recording or contact support.'
  return 'This session could not be analyzed. Please start a new recording and try again.'
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes}:${remainder.toString().padStart(2, '0')}`
}

function extensionForMimeType(mimeType: string) {
  const baseType = mimeType.split(';', 1)[0]?.trim().toLowerCase()
  const extensionByType: Record<string, string> = {
    'audio/webm': 'webm',
    'audio/mp4': 'm4a',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/mpeg': 'mp3',
    'audio/aac': 'aac',
    'audio/flac': 'flac',
  }
  return baseType ? extensionByType[baseType] : undefined
}

export type CommunicationQuestionContext = {
  runId: string
  questionIndex: number
  title: string
  prompt: string
}

export function RecordingWorkflow({
  topic,
  communication,
  onContinue,
}: {
  topic: SpeakingTopic | null
  communication?: CommunicationQuestionContext
  onContinue?: () => void
}) {
  const { client, session } = useAuth()
  const recorder = useAudioRecorder()
  const [submitting, setSubmitting] = useState(false)
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const [evaluationSessionId, setEvaluationSessionId] = useState<string | null>(null)
  const [evaluationStatus, setEvaluationStatus] = useState<'pending' | 'processing' | 'completed' | 'failed'>('pending')
  const [evaluationError, setEvaluationError] = useState<string | null>(null)
  const [transcript, setTranscript] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<EvaluationFeedback | null>(null)
  const [checkingStatus, setCheckingStatus] = useState(false)
  const submissionLock = useRef(false)
  const evaluationLock = useRef(false)

  async function refreshEvaluationStatus(targetSessionId: string) {
    if (!client || !session) return null
    const { data, error } = await client
      .from('speaking_sessions')
      .select('status, transcript, feedback, error_message')
      .eq('id', targetSessionId)
      .eq('user_id', session.user.id)
      .maybeSingle()

    if (error || !data) {
      setEvaluationError('Your analysis status could not be loaded. Check your connection and try again.')
      return null
    }
    setEvaluationStatus(data.status)
    if (data.status === 'completed') {
      const result = asEvaluationFeedback(data.feedback)
      if (!result || typeof data.transcript !== 'string') {
        setEvaluationError('The analysis result could not be validated. No unverified feedback is displayed.')
        return data.status
      }
      setTranscript(data.transcript)
      setFeedback(result)
      setEvaluationError(data.error_message)
    } else if (data.status === 'failed') {
      setEvaluationError(data.error_message)
    } else {
      setEvaluationError(null)
    }
    return data.status
  }

  async function runEvaluation(targetSessionId: string) {
    if (!client || !session || evaluationLock.current) return
    evaluationLock.current = true
    setEvaluationSessionId(targetSessionId)
    setEvaluationStatus('processing')
    setEvaluationError(null)
    setFeedback(null)
    setTranscript(null)
    setCheckingStatus(true)
    let invocationErrorCode: string | null = null
    try {
      const { error } = await client.functions.invoke('evaluate-speaking', {
        body: { session_id: targetSessionId },
      })

      if (error) {
        invocationErrorCode = 'evaluation_unavailable'
        // The function may have finished even if the network response was lost.
        const response = (error as { context?: Response }).context
        const errorBody = response ? await response.clone().json().catch(() => null) as { error?: unknown } | null : null
        if (typeof errorBody?.error === 'string') invocationErrorCode = errorBody.error
      }

      let latestStatus = await refreshEvaluationStatus(targetSessionId)
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const { data } = await client.from('speaking_sessions')
          .select('status')
          .eq('id', targetSessionId)
          .eq('user_id', session.user.id)
          .maybeSingle()
        if (!data || data.status === 'completed' || data.status === 'failed') break
        await new Promise((resolve) => window.setTimeout(resolve, 1500))
      }
      latestStatus = await refreshEvaluationStatus(targetSessionId) ?? latestStatus
      if (latestStatus === 'pending' && invocationErrorCode) setEvaluationError(invocationErrorCode)
    } catch {
      const latestStatus = await refreshEvaluationStatus(targetSessionId)
      if (latestStatus === 'pending') setEvaluationError('evaluation_unavailable')
    } finally {
      evaluationLock.current = false
      setCheckingStatus(false)
    }
  }

  async function submitRecording() {
    if (submissionLock.current || submitting || evaluationSessionId) return
    if (!client || !session || !recorder.recording || (!topic && !communication)) {
      setSubmissionError('Sign in again and make a new recording before submitting.')
      return
    }
    if (recorder.recording.size > MAX_RECORDING_BYTES) {
      setSubmissionError('This recording is larger than 10 MB. Record a shorter clip and try again.')
      return
    }
    const mimeType = recorder.recording.type
    const extension = extensionForMimeType(mimeType)
    if (!extension || !mimeType.toLowerCase().startsWith('audio/')) {
      setSubmissionError('This recording format is not supported. Please record again in a supported browser.')
      return
    }

    submissionLock.current = true
    setSubmitting(true)
    setSubmissionError(null)
    let sessionId: string | null = null
    let storagePath: string | null = null
    let storageUploadAttempted = false
    let attachmentUncertain = false

    try {
      const { data: authData, error: authError } = await client.auth.getUser()
      if (authError || !authData.user || authData.user.id !== session.user.id) {
        throw new Error('Your sign-in could not be verified. Sign in again, then submit your recording.')
      }
      if (!crypto.randomUUID) {
        throw new Error('This browser cannot create a secure recording ID. Update your browser and try again.')
      }

      const { data: createdSession, error: createError } = await client
        .from('speaking_sessions')
        .insert({
          user_id: authData.user.id,
          topic_id: topic?.id ?? null,
          duration_seconds: recorder.elapsedSeconds,
          ...(communication ? {
            communication_practice_run_id: communication.runId,
            communication_question_index: communication.questionIndex,
          } : {}),
        })
        .select('id')
        .single()
      if (createError || !createdSession) {
        throw new Error('A session could not be started. Check your connection and try again.')
      }
      sessionId = createdSession.id
      storagePath = `${authData.user.id}/${sessionId}/${crypto.randomUUID()}.${extension}`

      storageUploadAttempted = true
      const { error: uploadError } = await client.storage
        .from('speaking-audio')
        .upload(storagePath, recorder.recording, {
          cacheControl: '3600',
          contentType: mimeType,
          upsert: false,
        })
      if (uploadError) throw new Error('The recording could not be uploaded. Check your connection and try again.')

      const { data: attached, error: attachError } = await client
        .from('speaking_sessions')
        .update({ recording_path: storagePath })
        .eq('id', sessionId)
        .eq('user_id', authData.user.id)
        .eq('status', 'pending')
        .is('recording_path', null)
        .select('id')
        .maybeSingle()

      if (attachError || !attached) {
        attachmentUncertain = true
        const { data: verifiedSession, error: verifyError } = await client
          .from('speaking_sessions')
          .select('recording_path')
          .eq('id', sessionId)
          .eq('user_id', authData.user.id)
          .maybeSingle()

        if (!verifyError && verifiedSession?.recording_path === storagePath) {
          recorder.reset()
          await runEvaluation(sessionId)
          return
        }
        if (!verifyError) attachmentUncertain = false
        throw new Error('The recording could not be attached to its session. It has not been confirmed as submitted.')
      }

      recorder.reset()
      await runEvaluation(sessionId)
    } catch (error) {
      let cleanupIncomplete = false
      if (!attachmentUncertain && storageUploadAttempted && storagePath) {
        try {
          const { error: removeError } = await client.storage.from('speaking-audio').remove([storagePath])
          cleanupIncomplete = Boolean(removeError)
        } catch {
          cleanupIncomplete = true
        }
      }
      if (!attachmentUncertain && sessionId) {
        try {
          const { error: deleteError } = await client
            .from('speaking_sessions')
            .delete()
            .eq('id', sessionId)
            .eq('user_id', session.user.id)
            .eq('status', 'pending')
            .is('recording_path', null)
          cleanupIncomplete ||= Boolean(deleteError)
        } catch {
          cleanupIncomplete = true
        }
      }

      const message = error instanceof Error ? error.message : 'The recording could not be submitted. Please try again.'
      setSubmissionError(attachmentUncertain
        ? `${message} Check Recent sessions before retrying.`
        : cleanupIncomplete
          ? `${message} Some temporary data may remain in your private account storage.`
          : message)
    } finally {
      submissionLock.current = false
      setSubmitting(false)
    }
  }

  if (evaluationSessionId) {
    return (
      <section className="recording-workflow recording-success" aria-labelledby="recording-success-title">
        <p className="eyebrow">Speaking session</p>
        <h2 id="recording-success-title">{evaluationStatus === 'completed' ? 'A little clearer, one session at a time.' : evaluationStatus === 'failed' ? 'Your session needs another try.' : 'Reviewing your response.'}</h2>
        {evaluationStatus === 'processing' && <p className="recording-status" role="status" aria-live="polite">Your private recording is being analyzed. This may take a short while.</p>}
        {evaluationStatus === 'pending' && <>
          <p>Your recording is saved privately, but analysis has not started.</p>
          {evaluationError && <p className="form-error" role="alert">{evaluationErrorMessage(evaluationError)}</p>}
          <button className="button-link" disabled={checkingStatus} onClick={() => { void runEvaluation(evaluationSessionId) }} type="button">Try analysis again</button>
          {onContinue && <button className="secondary-button communication-next-button" onClick={onContinue} type="button">Continue to the next question</button>}
        </>}
        {evaluationStatus === 'failed' && <>
          <p className="form-error" role="alert">{evaluationErrorMessage(evaluationError)}</p>
          <p>This answer could not be analyzed. You can continue the lesson and return to the saved failure status later.</p>
          {onContinue && <button className="secondary-button communication-next-button" onClick={onContinue} type="button">Continue to the next question</button>}
        </>}
        {evaluationStatus === 'completed' && feedback && transcript !== null && <>
          {evaluationError?.includes('cleanup_pending') && <p className="form-error" role="status">{evaluationErrorMessage(evaluationError)}</p>}
          <EvaluationResults transcript={transcript} feedback={feedback} />
          <Link className="text-link" to={`/app/sessions/${evaluationSessionId}`}>Open saved session results <span aria-hidden="true">↗</span></Link>
          {onContinue && <button className="button-link communication-next-button" onClick={onContinue} type="button">Continue to the next question <span aria-hidden="true">↗</span></button>}
        </>}
        {evaluationStatus === 'completed' && !feedback && evaluationError && <p className="form-error" role="alert">{evaluationError.startsWith('The analysis result') ? evaluationError : evaluationErrorMessage(evaluationError)}</p>}
        {evaluationStatus === 'processing' && !checkingStatus && <button className="secondary-button" onClick={() => { void refreshEvaluationStatus(evaluationSessionId) }} type="button">Check analysis status</button>}
        <Link className="text-link" to="/app">Back to your dashboard <span aria-hidden="true">↗</span></Link>
      </section>
    )
  }

  return (
    <section className="recording-workflow" aria-labelledby="recording-heading">
      <p className="eyebrow">Your turn to speak</p>
      <h2 id="recording-heading">Make it your own.</h2>
      <p className="recording-guidance">
        Record up to two minutes. Your audio stays private until it is submitted with your session.
      </p>

      {recorder.state === 'recording' && (
        <p className="recording-status" role="status" aria-live="polite">
          Recording · {formatTime(recorder.elapsedSeconds)} of {formatTime(MAX_RECORDING_SECONDS)}
        </p>
      )}
      {recorder.state === 'requesting' && <p className="recording-status" role="status">Waiting for microphone access…</p>}
      {recorder.error && <p className="form-error" role="alert">{recorder.error}</p>}
      {submissionError && <p className="form-error" role="alert">{submissionError}</p>}

      {recorder.state === 'idle' && (
        <button className="button-link" onClick={() => { void recorder.start() }} type="button">
          Start recording
        </button>
      )}
      {recorder.state === 'requesting' && (
        <button className="button-link" disabled type="button">Waiting for microphone…</button>
      )}
      {recorder.state === 'recording' && (
        <button className="button-link recording-stop" onClick={recorder.stop} type="button">
          Stop recording
        </button>
      )}
      {recorder.state === 'ready' && recorder.recordingUrl && recorder.recording && (
        <div className="recording-review">
          <p className="recording-review-label">Listen before submitting</p>
          <audio controls preload="metadata" src={recorder.recordingUrl} aria-label="Preview your speaking recording">
            Your browser does not support audio playback.
          </audio>
          <p className="recording-file-details">
            {formatTime(recorder.elapsedSeconds)} · {(recorder.recording.size / (1024 * 1024)).toFixed(2)} MB · {recorder.recording.type}
          </p>
          <div className="recording-actions">
            <button className="secondary-button" onClick={recorder.reset} type="button">Record again</button>
            <button className="button-link" disabled={submitting} onClick={() => { void submitRecording() }} type="button">
              {submitting ? 'Submitting…' : 'Submit recording'}
            </button>
          </div>
        </div>
      )}
      <p className="recording-limits">Maximum file size: 10 MB. You’ll review your recording before it is uploaded.</p>
    </section>
  )
}
