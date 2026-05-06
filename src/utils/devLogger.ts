const isDev = import.meta.env.DEV || process.env.NODE_ENV !== 'production'

type LogLevel = 'log' | 'warn' | 'error' | 'info'

interface LogEntry {
  level: LogLevel
  module: string
  message: string
  data?: unknown
  timestamp: string
}

const logHistory: LogEntry[] = []

function formatTimestamp(): string {
  return new Date().toISOString().split('T')[1].replace('Z', '')
}

function addEntry(entry: LogEntry) {
  if (!isDev) return
  logHistory.push(entry)
  if (logHistory.length > 500) {
    logHistory.shift()
  }
}

export function devLog(module: string, message: string, data?: unknown) {
  if (!isDev) return
  const entry: LogEntry = { level: 'log', module, message, data, timestamp: formatTimestamp() }
  addEntry(entry)
  console.log(`[StreamPix:${module}] ${message}`, data ?? '')
}

export function devWarn(module: string, message: string, data?: unknown) {
  if (!isDev) return
  const entry: LogEntry = { level: 'warn', module, message, data, timestamp: formatTimestamp() }
  addEntry(entry)
  console.warn(`[StreamPix:${module}] ${message}`, data ?? '')
}

export function devError(module: string, message: string, data?: unknown) {
  if (!isDev) return
  const entry: LogEntry = { level: 'error', module, message, data, timestamp: formatTimestamp() }
  addEntry(entry)
  console.error(`[StreamPix:${module}] ${message}`, data ?? '')
}

export function devInfo(module: string, message: string, data?: unknown) {
  if (!isDev) return
  const entry: LogEntry = { level: 'info', module, message, data, timestamp: formatTimestamp() }
  addEntry(entry)
  console.info(`[StreamPix:${module}] ${message}`, data ?? '')
}

export function getLogHistory(): LogEntry[] {
  return [...logHistory]
}

export function clearLogHistory(): void {
  logHistory.length = 0
}
