import type { ErrorRequestHandler } from 'express';

/** Never reflect exception bodies, request text or provider credentials to clients/logs. */
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  let status = 500;
  let message = 'Internal server error.';
  if (error?.code === 'LIMIT_FILE_SIZE' || error?.type === 'entity.too.large') {
    status = 413; message = 'The uploaded file or request is too large.';
  } else if (error?.name === 'MulterError' || error?.message === 'Invalid file type. Only PDF documents (.pdf) are supported.') {
    status = 400; message = 'Please upload one valid PDF document.';
  } else if (error instanceof SyntaxError && error && 'body' in error) {
    status = 400; message = 'Invalid JSON request.';
  }
  if (status === 500) console.error('Unhandled server error.');
  res.status(status).json({ error: message, timestamp: new Date().toISOString() });
};
