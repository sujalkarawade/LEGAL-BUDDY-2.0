import EventEmitter from 'events';
import { Request, Response, NextFunction } from 'express';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'http' | 'system';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  details?: any;
}

class LoggerService extends EventEmitter {
  private logs: LogEntry[] = [];
  private readonly maxLogs: number = 2000;
  private logIdCounter: number = 0;
  private isIntercepted: boolean = false;
  private startTime: number = Date.now();

  private originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
  };

  constructor() {
    super();
    this.initConsoleInterception();
  }

  private initConsoleInterception() {
    if (this.isIntercepted) return;
    this.isIntercepted = true;

    const formatArgs = (args: any[]): { message: string; details?: any } => {
      const parts = args.map((arg) => {
        if (typeof arg === 'string') return arg;
        if (arg instanceof Error) return `${arg.name}: ${arg.message}\n${arg.stack || ''}`;
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return String(arg);
        }
      });

      const message = parts.join(' ');
      let details: any = undefined;

      // Extract structured object details if single or last arg is an object/error
      if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
        details = args[0];
      } else if (args.length > 1 && typeof args[args.length - 1] === 'object') {
        details = args[args.length - 1];
      }

      return { message, details };
    };

    console.log = (...args: any[]) => {
      this.originalConsole.log(...args);
      const { message, details } = formatArgs(args);
      this.addLog('info', message, details);
    };

    console.info = (...args: any[]) => {
      this.originalConsole.info(...args);
      const { message, details } = formatArgs(args);
      this.addLog('info', message, details);
    };

    console.warn = (...args: any[]) => {
      this.originalConsole.warn(...args);
      const { message, details } = formatArgs(args);
      this.addLog('warn', message, details);
    };

    console.error = (...args: any[]) => {
      this.originalConsole.error(...args);
      const { message, details } = formatArgs(args);
      this.addLog('error', message, details);
    };

    console.debug = (...args: any[]) => {
      this.originalConsole.debug(...args);
      const { message, details } = formatArgs(args);
      this.addLog('debug', message, details);
    };
  }

  private detectModule(message: string): string {
    const clean = message.toLowerCase();
    if (clean.includes('[paddleocr') || clean.includes('paddleocr') || clean.includes('devanagari') || clean.includes('[ocr')) {
      return 'OCR';
    }
    if (clean.includes('[pdfservice]') || clean.includes('pdf-service')) {
      return 'PDF';
    }
    if (clean.includes('[aiservice]') || clean.includes('groq') || clean.includes('openrouter') || clean.includes('llama')) {
      return 'AI';
    }
    if (clean.includes('[rag]') || clean.includes('hybrid-search') || clean.includes('rrf') || clean.includes('embedding')) {
      return 'RAG';
    }
    if (clean.includes('[documentcontroller]') || clean.includes('document') || clean.includes('upload')) {
      return 'DOCS';
    }
    if (clean.includes('[prisma]') || clean.includes('database') || clean.includes('postgres') || clean.includes('seed')) {
      return 'DATABASE';
    }
    if (clean.includes('[auth]') || clean.includes('jwt') || clean.includes('login') || clean.includes('register')) {
      return 'AUTH';
    }
    if (clean.includes('[http]')) {
      return 'HTTP';
    }
    return 'SYSTEM';
  }

  public addLog(level: LogLevel, message: string, details?: any, customModule?: string): LogEntry {
    const module = customModule || this.detectModule(message);
    const entry: LogEntry = {
      id: `log-${Date.now()}-${++this.logIdCounter}`,
      timestamp: new Date().toISOString(),
      level,
      module,
      message,
      details,
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    this.emit('log', entry);
    return entry;
  }

  public getLogs(options?: {
    level?: string;
    module?: string;
    search?: string;
    limit?: number;
  }): LogEntry[] {
    let result = [...this.logs];

    if (options?.level && options.level !== 'all') {
      result = result.filter((l) => l.level.toLowerCase() === options.level?.toLowerCase());
    }

    if (options?.module && options.module !== 'all') {
      result = result.filter((l) => l.module.toLowerCase() === options.module?.toLowerCase());
    }

    if (options?.search) {
      const q = options.search.toLowerCase();
      result = result.filter(
        (l) =>
          l.message.toLowerCase().includes(q) ||
          l.module.toLowerCase().includes(q) ||
          l.level.toLowerCase().includes(q) ||
          (l.details && JSON.stringify(l.details).toLowerCase().includes(q))
      );
    }

    if (options?.limit && options.limit > 0) {
      result = result.slice(-options.limit);
    }

    return result;
  }

  public clearLogs() {
    this.logs = [];
    this.addLog('system', 'Log buffer cleared by user action.', undefined, 'SYSTEM');
  }

  public getMetrics() {
    const memory = process.memoryUsage();
    const counts = {
      total: this.logs.length,
      info: this.logs.filter((l) => l.level === 'info').length,
      warn: this.logs.filter((l) => l.level === 'warn').length,
      error: this.logs.filter((l) => l.level === 'error').length,
      http: this.logs.filter((l) => l.level === 'http').length,
      system: this.logs.filter((l) => l.level === 'system').length,
      debug: this.logs.filter((l) => l.level === 'debug').length,
    };

    return {
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      startedAt: new Date(this.startTime).toISOString(),
      counts,
      memory: {
        rssMb: +(memory.rss / (1024 * 1024)).toFixed(1),
        heapTotalMb: +(memory.heapTotal / (1024 * 1024)).toFixed(1),
        heapUsedMb: +(memory.heapUsed / (1024 * 1024)).toFixed(1),
      },
      nodeVersion: process.version,
      platform: process.platform,
    };
  }

  public httpLoggerMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Ignore static log UI polling to keep logs clean
      if (req.path === '/api/logs/stream' || req.path === '/api/logs/metrics') {
        return next();
      }

      const start = Date.now();
      const { method, originalUrl, ip } = req;

      res.on('finish', () => {
        const duration = Date.now() - start;
        const status = res.statusCode;
        const msg = `${method} ${originalUrl} ${status} (${duration}ms) - ${ip || '127.0.0.1'}`;

        let level: LogLevel = 'http';
        if (status >= 500) {
          level = 'error';
        } else if (status >= 400) {
          level = 'warn';
        }

        // Only log to in-memory buffer without polluting standard console stdout redundantly
        this.addLog(level, msg, { method, path: originalUrl, status, duration, ip }, 'HTTP');
      });

      next();
    };
  }
}

export const loggerService = new LoggerService();
