import { randomUUID } from 'crypto';
import type { LogEntry, LogLevel } from '../types/index.js';

type LogHandler = (entry: LogEntry) => void;

/**
 * Lightweight structured logger.
 * Emits structured log entries to all registered handlers (WebSocket broadcast, console, etc.)
 */
class Logger {
  private handlers: LogHandler[] = [];

  addHandler(handler: LogHandler): void {
    this.handlers.push(handler);
  }

  private emit(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    const entry: LogEntry = {
      id: randomUUID(),
      ts: Date.now(),
      level,
      message,
      data,
    };
    // Always print to console for server-side debugging
    const tag = `[${level.toUpperCase().padEnd(7)}]`;
    const timestamp = new Date(entry.ts).toISOString();
    console.log(`${timestamp} ${tag} ${message}`, data ?? '');

    this.handlers.forEach((h) => h(entry));
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.emit('info', message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.emit('warn', message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.emit('error', message, data);
  }

  success(message: string, data?: Record<string, unknown>): void {
    this.emit('success', message, data);
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.emit('debug', message, data);
  }
}

export const logger = new Logger();
