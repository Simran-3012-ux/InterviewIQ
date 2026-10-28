/**
 * Base URL of the API.
 * - Development: the Express server on port 3000 (override with VITE_API_URL).
 * - Production: the same origin, because the backend serves the built frontend.
 */
export const API_BASE_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://localhost:3000" : "")
