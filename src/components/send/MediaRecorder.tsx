import { useState, useRef, useCallback } from 'react'

type MediaType = 'audio' | 'video'

type MediaRecorderProps = {
  mediaType: MediaType
  onBlobReady: (blob: Blob, previewUrl: string) => void
  onClear: () => void
}

export default function MediaRecorderComponent({ mediaType, onBlobReady, onClear }: MediaRecorderProps) {
  const [recording, setRecording] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const isVideo = mediaType === 'video'

  const startRecording = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        isVideo ? { video: true, audio: true } : { audio: true }
      )
      streamRef.current = stream

      const mimeType = isVideo ? 'video/webm' : 'audio/webm'
      const recorder = new MediaRecorder(stream, { mimeType })

      chunksRef.current = []

      recorder.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType })
        const url = URL.createObjectURL(blob)
        setPreviewUrl(url)
        onBlobReady(blob, url)
        streamRef.current?.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }

      mediaRecorderRef.current = recorder
      recorder.start()
      setRecording(true)
    } catch {
      setError(isVideo ? 'Não foi possível acessar câmera e microfone' : 'Não foi possível acessar o microfone')
    }
  }, [isVideo, onBlobReady])

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }, [])

  const handleUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      const acceptType = isVideo ? 'video/' : 'audio/'
      if (!file.type.startsWith(acceptType)) {
        setError(`Selecione um arquivo de ${isVideo ? 'vídeo' : 'áudio'} válido`)
        return
      }

      setError(null)
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      onBlobReady(file, url)
    },
    [isVideo, onBlobReady]
  )

  const handleClear = useCallback(() => {
    setPreviewUrl(null)
    setError(null)
    chunksRef.current = []
    onClear()
  }, [onClear])

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={recording ? stopRecording : startRecording}
          className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
            recording
              ? 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse'
              : 'bg-neon/10 text-neon border border-neon/20 hover:bg-neon/20'
          }`}
        >
          {recording ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-400" />
              Parar gravação
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {isVideo ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 11-6 0 3 3 0 016 0z" />
                )}
              </svg>
              {isVideo ? 'Gravar vídeo' : 'Gravar áudio'}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-surface-hover text-sage border border-border hover:text-offwhite transition-all duration-200"
        >
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m0 0l4 4" />
            </svg>
            {isVideo ? 'Enviar vídeo' : 'Enviar áudio'}
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept={isVideo ? 'video/*' : 'audio/*'}
            className="hidden"
            onChange={handleUpload}
          />
        </button>
      </div>

      {previewUrl && (
        <div className="relative rounded-xl overflow-hidden border border-border bg-black/30">
          {isVideo ? (
            <video src={previewUrl} controls className="w-full max-h-64 object-contain" />
          ) : (
            <div className="flex items-center gap-3 p-4">
              <div className="w-10 h-10 rounded-full bg-neon/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-neon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586a4 4 0 005.658 0c1.204-1.204 1.204-3.149 0-4.354a1 1 0 010-1.414l1.414-1.414a1 1 0 011.414 0c.286.286.479.635.566 1.018" />
                </svg>
              </div>
              <audio src={previewUrl} controls className="flex-1 h-8" />
            </div>
          )}
          <button
            type="button"
            onClick={handleClear}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-sage hover:text-red-400 flex items-center justify-center transition-colors"
          >
            ×
          </button>
        </div>
      )}

      {error && (
        <div className="text-xs text-red-400 bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}
    </div>
  )
}
