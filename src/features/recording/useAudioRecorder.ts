import { useCallback, useEffect, useRef, useState } from 'react'

export const MAX_RECORDING_SECONDS = 120
export const MAX_RECORDING_BYTES = 10 * 1024 * 1024

export type RecorderState = 'idle' | 'requesting' | 'recording' | 'ready'

const supportedAudioTypes = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
  'audio/ogg',
]

function microphoneErrorMessage(error: unknown) {
  const name = error instanceof DOMException ? error.name : ''
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
    return 'Microphone access was denied. Allow microphone access in your browser settings, then try again.'
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No microphone was found. Connect a microphone and try again.'
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'Your microphone could not be started. Close other apps using it and try again.'
  }
  if (!window.isSecureContext) {
    return 'Microphone recording requires a secure connection. Open SpeakDaily on HTTPS or localhost.'
  }
  return 'The microphone could not be started. Check your browser permissions and try again.'
}

export function useAudioRecorder() {
  const [state, setState] = useState<RecorderState>('idle')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [recording, setRecording] = useState<Blob | null>(null)
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<number | null>(null)
  const startedAtRef = useRef<number | null>(null)
  const urlRef = useRef<string | null>(null)
  const mountedRef = useRef(false)

  const stopStream = useCallback((stream: MediaStream) => {
    stream.getTracks().forEach((track) => track.stop())
    if (streamRef.current === stream) streamRef.current = null
  }, [])

  const releaseMicrophone = useCallback(() => {
    if (streamRef.current) stopStream(streamRef.current)
  }, [stopStream])

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current)
    timerRef.current = null
  }, [])

  const clearRecording = useCallback(() => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = null
    setRecordingUrl(null)
    setRecording(null)
  }, [])

  const reset = useCallback(() => {
    clearRecording()
    setElapsedSeconds(0)
    setError(null)
    setState('idle')
  }, [clearRecording])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      clearTimer()
      const recorder = recorderRef.current
      if (recorder && recorder.state !== 'inactive') {
        try { recorder.stop() } catch { /* the component is already leaving */ }
      }
      releaseMicrophone()
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }
  }, [clearTimer, releaseMicrophone])

  const stop = useCallback(() => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') return
    const startedAt = startedAtRef.current
    if (startedAt !== null) {
      setElapsedSeconds(Math.min(MAX_RECORDING_SECONDS, Math.max(1, Math.ceil((Date.now() - startedAt) / 1000))))
    }
    clearTimer()
    try {
      recorder.stop()
    } catch {
      releaseMicrophone()
      setError('The recording could not be stopped. Please start a new recording.')
      setState('idle')
    }
  }, [clearTimer, releaseMicrophone])

  const start = useCallback(async () => {
    if (state === 'requesting' || state === 'recording') return
    setError(null)
    clearRecording()
    setElapsedSeconds(0)

    if (typeof MediaRecorder === 'undefined') {
      setError('Audio recording is not supported by this browser. Try a recent version of Chrome, Firefox, Safari, or Edge.')
      return
    }
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      setError('This browser cannot access a microphone. Open SpeakDaily on HTTPS or localhost in a supported browser.')
      return
    }

    setState('requesting')
    let stream: MediaStream | null = null
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream
      const activeStream = stream

      const mimeType = supportedAudioTypes.find((type) => MediaRecorder.isTypeSupported(type))
      let recorder: MediaRecorder
      try {
        recorder = mimeType
          ? new MediaRecorder(activeStream, { mimeType, audioBitsPerSecond: 64_000 })
          : new MediaRecorder(activeStream, { audioBitsPerSecond: 64_000 })
      } catch {
        recorder = new MediaRecorder(activeStream)
      }

      const chunks: Blob[] = []
      let byteCount = 0
      let exceededSize = false
      let recorderFailed = false
      let recordingStartedAt: number | null = null
      recorderRef.current = recorder
      recorder.ondataavailable = (event) => {
        if (event.data.size === 0) return
        chunks.push(event.data)
        byteCount += event.data.size
        if (byteCount > MAX_RECORDING_BYTES && recorder.state !== 'inactive') {
          exceededSize = true
          if (recorderRef.current === recorder) stop()
          else recorder.stop()
        }
      }
      recorder.onerror = () => {
        recorderFailed = true
        if (recorderRef.current === recorder) {
          recorderRef.current = null
          startedAtRef.current = null
          clearTimer()
        }
        if (mountedRef.current) {
          setError('The browser stopped recording unexpectedly. Please try again.')
          setState('idle')
        }
        stopStream(activeStream)
        if (recorder.state !== 'inactive') {
          try { recorder.stop() } catch { /* the error already ended this recording */ }
        }
      }
      recorder.onstop = () => {
        const isCurrentRecorder = recorderRef.current === recorder
        if (isCurrentRecorder) {
          clearTimer()
          recorderRef.current = null
        }
        stopStream(activeStream)
        if (!mountedRef.current || !isCurrentRecorder) return
        if (recorderFailed) {
          setState('idle')
          return
        }

        const elapsed = recordingStartedAt === null
          ? 0
          : Math.min(MAX_RECORDING_SECONDS, Math.max(1, Math.ceil((Date.now() - recordingStartedAt) / 1000)))
        startedAtRef.current = null
        setElapsedSeconds(elapsed)
        if (exceededSize || byteCount > MAX_RECORDING_BYTES) {
          setError('This recording is larger than 10 MB. Record a shorter clip and try again.')
          setState('idle')
          return
        }

        const actualMimeType = recorder.mimeType || chunks.find((chunk) => chunk.type)?.type || ''
        if (!actualMimeType.startsWith('audio/')) {
          setError('This browser did not provide a supported audio format. Try another browser.')
          setState('idle')
          return
        }
        const blob = new Blob(chunks, { type: actualMimeType })
        if (!blob.size) {
          setError('The recording was empty. Check your microphone and try again.')
          setState('idle')
          return
        }
        if (blob.size > MAX_RECORDING_BYTES) {
          setError('This recording is larger than 10 MB. Record a shorter clip and try again.')
          setState('idle')
          return
        }

        const url = URL.createObjectURL(blob)
        urlRef.current = url
        setRecording(blob)
        setRecordingUrl(url)
        setState('ready')
      }

      recorder.start(1000)
      recordingStartedAt = Date.now()
      startedAtRef.current = recordingStartedAt
      setState('recording')
      timerRef.current = window.setInterval(() => {
        if (recorderRef.current !== recorder) return
        const startedAt = recordingStartedAt
        if (startedAt === null) return
        const elapsed = Math.floor((Date.now() - startedAt) / 1000)
        if (elapsed >= MAX_RECORDING_SECONDS) {
          setElapsedSeconds(MAX_RECORDING_SECONDS)
          stop()
          return
        }
        setElapsedSeconds(elapsed)
      }, 200)
    } catch (startError) {
      if (stream) stopStream(stream)
      recorderRef.current = null
      clearTimer()
      if (mountedRef.current) {
        setError(microphoneErrorMessage(startError))
        setState('idle')
      }
    }
  }, [clearRecording, clearTimer, state, stop, stopStream])

  return { state, elapsedSeconds, recording, recordingUrl, error, start, stop, reset }
}
