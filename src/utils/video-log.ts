// Video-calling error log, same format as Diskus's videoLog.js. Filter the
// DevTools console by "[VideoLog]" to see errors from both apps together;
// "[Zoom]" marks the ones from this iframe. console.error is used so the
// entries survive production console silencing.
export const logVideoError = (source: string, message: string, details?: unknown) => {
  try {
    console.error(`[VideoLog] ${new Date().toISOString()} [Zoom] [${source}] ${message}`, details ?? '');
  } catch {
    // Logging must never break the call.
  }
};
