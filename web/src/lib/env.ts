import 'server-only';

const backendBaseUrl = process.env.BACKEND_BASE_URL;

if (!backendBaseUrl) {
  throw new Error('BACKEND_BASE_URL environment variable is not set');
}

export const BACKEND_BASE_URL: string = backendBaseUrl;
