type LogLevel = 'info' | 'warn' | 'error'

let loggerNamespace: string = 'vite-plugin-fvtt'

const colors: Record<LogLevel, string> = {
  info: '\u001B[36m', // cyan
  warn: '\u001B[33m', // yellow
  error: '\u001B[31m', // red
}
const reset = '\u001B[0m'

export function initialize(namespace = 'vite-plugin-fvtt') {
  loggerNamespace = namespace
}

function format(level: LogLevel, message: unknown): string {
  const color = colors[level] ?? ''
  return `${color}[${loggerNamespace}] [${level.toUpperCase()}]${reset} ${message}`
}

export function info(message: unknown): void {
  console.log(format('info', message))
}

export function warn(message: unknown): void {
  console.warn(format('warn', message))
}

export function error(message: unknown): void {
  console.error(format('error', message))
}

export function fail(message: unknown): never {
  const formatted = format('error', stringify(message))
  console.error(formatted)
  throw new Error(formatted)
}

function stringify(message: unknown): string {
  if (message instanceof Error) return message.stack ?? message.message
  return typeof message === 'string' ? message : JSON.stringify(message, undefined, 2)
}
