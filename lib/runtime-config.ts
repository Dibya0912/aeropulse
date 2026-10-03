export const prognosticsApiUrl =
  process.env.NEXT_PUBLIC_PROGNOSTICS_API_URL?.replace(/\/$/, '') || 'http://127.0.0.1:8000'

