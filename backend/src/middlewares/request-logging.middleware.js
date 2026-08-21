export function requestLoggingMiddleware(logger) {
  return (req, res, next) => {
    const startedAt = performance.now();
    res.on('finish', () =>
      logger.info({
        event: 'request.completed',
        requestId: req.requestId,
        method: req.method,
        endpoint: req.route?.path ?? req.path,
        status: res.statusCode,
        durationMs: Math.round(performance.now() - startedAt),
      }),
    );
    next();
  };
}
