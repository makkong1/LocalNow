// API contract types — mirrors docs/API_CONVENTIONS.md 1:1.
// Do NOT define API types anywhere else.

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: ApiError | null;
  meta: { requestId: string };
}

export interface ApiError {
  code: string;
  message: string;
  fields: Record<string, string[]> | null;
}

// Auth
export interface LoginResponse {
  accessToken: string;
  userId: number;
  role: UserRole;
  name: string;
}

export interface UserProfile {
  userId: number;
  email: string;
  name: string;
  role: UserRole;
  city: string;
  averageRating: number | null;
}

export type UserRole = 'TRAVELER' | 'GUIDE';

// Help Request
export type RequestType = 'GUIDE' | 'TRANSLATION' | 'FOOD' | 'EMERGENCY';
export type RequestStatus = 'OPEN' | 'MATCHED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface HelpRequest {
  id: number;
  travelerId: number;
  requestType: RequestType;
  lat: number;
  lng: number;
  description: string;
  startAt: string;
  durationMin: number;
  budgetKrw: number;
  status: RequestStatus;
  createdAt: string;
}

export interface CreateRequestBody {
  requestType: RequestType;
  lat: number;
  lng: number;
  description: string;
  startAt: string;
  durationMin: number;
  budgetKrw: number;
}

// Match Offer
export type OfferStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED';

export interface MatchOffer {
  id: number;
  requestId: number;
  guideId: number;
  guideName: string;
  guideRating: number | null;
  message: string | null;
  status: OfferStatus;
  createdAt: string;
}

// Chat
export interface ChatRoom {
  roomId: number;
  requestId: number;
}

export interface ChatMessage {
  messageId: number;
  roomId: number;
  senderId: number;
  content: string;
  sentAt: string;
  clientMessageId: string;
}

export interface SendMessageBody {
  content: string;
  clientMessageId: string;
}

// Payment
export type PaymentStatus = 'AUTHORIZED' | 'CAPTURED' | 'REFUNDED';

export interface PaymentIntent {
  requestId: number;
  payerId: number;
  payeeId: number;
  amountKrw: number;
  feeKrw: number;
  status: PaymentStatus;
  createdAt: string;
}

// Review
export interface Review {
  id: number;
  requestId: number;
  travelerId: number;
  guideId: number;
  rating: number;
  comment: string | null;
  createdAt: string;
}

// Cursor pagination
export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

// STOMP notification payloads
export type NotificationPayload =
  | { type: 'NEW_REQUEST'; requestId: number; requestType: RequestType; budgetKrw: number }
  | { type: 'MATCH_CONFIRMED'; requestId: number }
  | { type: 'OFFER_ACCEPTED'; guideId: number }
  | { type: 'CHAT_MESSAGE'; roomId: number; preview: string };
