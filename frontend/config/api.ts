// Check if we are in a browser environment
const isBrowser = typeof window !== "undefined";

// Use 127.0.0.1 instead of localhost for better Windows compatibility
const DEFAULT_URL = "http://127.0.0.1:5000";

export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || DEFAULT_URL;
export const API_URL = process.env.NEXT_PUBLIC_API_URL || `${BACKEND_URL}/api`;
