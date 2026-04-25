// API contract types — mirrors docs/API_CONVENTIONS.md 1:1.
// Do NOT define API types anywhere else.

export type ErrorCode =
  | 'AUTH_UNAUTHENTICATED'
  | 'AUTH_FORBIDDEN'
  | 'VALIDATION_FAILED'
  | 'REQUEST_NOT_FOUND'
  | 'REQUEST_NOT_OPEN'
  | 'MATCH_ALREADY_CONFIRMED'
  | 'PAYMENT_INVALID_STATE'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export interface FieldError {
  field: string;
  message: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: ApiError | null;
  meta: { requestId: string };
}

export interface ApiError {
  code: ErrorCode;
  message: string;
  fields: FieldError[] | null;
}

export type UserRole = 'TRAVELER' | 'GUIDE';

// Auth
export interface AuthResponse {
  accessToken: string;
  userId: number;
  role: UserRole;
  name: string;
}

/** @deprecated Use AuthResponse */
export type LoginResponse = AuthResponse;

export interface UserProfileResponse {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  languages: string[];
  city: string;
  avgRating: number;
  ratingCount: number;
}

/** @deprecated Use UserProfileResponse */
export type UserProfile = UserProfileResponse;

export interface SignupParams {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  languages?: string[];
  city?: string;
}

// Help Request
export type RequestType = 'GUIDE' | 'TRANSLATION' | 'FOOD' | 'EMERGENCY';
export type HelpRequestStatus = 'OPEN' | 'MATCHED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
/** @deprecated Use HelpRequestStatus */
export type RequestStatus = HelpRequestStatus;

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
  status: HelpRequestStatus;
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
export type MatchOfferStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED';
/** @deprecated Use MatchOfferStatus */
export type OfferStatus = MatchOfferStatus;

export interface MatchOffer {
  id: number;
  requestId: number;
  guideId: number;
  guideName: string;
  guideRating: number | null;
  message: string | null;
  status: MatchOfferStatus;
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
export type PaymentStatus = 'AUTHORIZED' | 'CAPTURED' | 'REFUNDED' | 'FAILED';

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
