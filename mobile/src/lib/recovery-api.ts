import { apiFetch } from './api-client';
import type { EmailHintVerifyResponse, SimpleTicketResponse } from '../types/api';

export async function postEmailHintRequest(body: { name: string; city: string }) {
  return apiFetch<SimpleTicketResponse>('/auth/recovery/email-hint/request', {
    method: 'POST',
    body,
    requiresAuth: false,
  });
}

export async function postEmailHintVerify(body: { ticketId: string; code: string }) {
  return apiFetch<EmailHintVerifyResponse>('/auth/recovery/email-hint/verify', {
    method: 'POST',
    body,
    requiresAuth: false,
  });
}

export async function postPasswordResetRequest(body: { email: string }) {
  return apiFetch<SimpleTicketResponse>('/auth/password-reset/request', {
    method: 'POST',
    body,
    requiresAuth: false,
  });
}

export async function postPasswordResetConfirm(body: {
  ticketId: string;
  code: string;
  newPassword: string;
}) {
  return apiFetch<null>('/auth/password-reset/confirm', {
    method: 'POST',
    body,
    requiresAuth: false,
  });
}
