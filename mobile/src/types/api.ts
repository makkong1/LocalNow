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

export type UserRole = 'TRAVELER' | 'GUIDE' | 'ADMIN';

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

export interface HelpRequestResponse {
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

/** @deprecated Use HelpRequestResponse */
export type HelpRequest = HelpRequestResponse;

export interface HelpRequestPageResponse {
  items: HelpRequestResponse[];
  nextCursor: number | null;
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

export interface MatchOfferResponse {
  id: number;
  requestId: number;
  guideId: number;
  guideName: string;
  guideAvgRating: number;
  status: MatchOfferStatus;
  message: string | null;
  createdAt: string;
}

/** @deprecated Use MatchOfferResponse */
export type MatchOffer = MatchOfferResponse;

// Chat
export interface ChatRoomResponse {
  id: number;
  requestId: number;
  travelerId: number;
  guideId: number;
  createdAt: string;
}

/** @deprecated Use ChatRoomResponse */
export type ChatRoom = ChatRoomResponse;

export interface ChatMessageResponse {
  messageId: number;
  roomId: number;
  senderId: number;
  content: string;
  sentAt: string;
  clientMessageId: string;
}

/** @deprecated Use ChatMessageResponse */
export type ChatMessage = ChatMessageResponse;

export interface SendMessageBody {
  content: string;
  clientMessageId: string;
}

// Payment
export type PaymentStatus = 'AUTHORIZED' | 'CAPTURED' | 'REFUNDED' | 'FAILED';

export interface PaymentIntentResponse {
  id: number;
  requestId: number;
  amountKrw: number;
  platformFeeKrw: number;
  guidePayout: number;
  status: PaymentStatus;
  createdAt: string;
}

/** @deprecated Use PaymentIntentResponse */
export type PaymentIntent = PaymentIntentResponse;

// Review
export interface ReviewResponse {
  id: number;
  requestId: number;
  revieweeId: number;
  rating: number;
  comment: string | null;
  createdAt: string;
}

/** @deprecated Use ReviewResponse */
export type Review = ReviewResponse;

// STOMP push events
export type StompEvent =
  | { type: 'NEW_REQUEST'; requestId: number; requestType: RequestType; budgetKrw: number }
  | { type: 'OFFER_ACCEPTED'; guideId: number }
  | { type: 'MATCH_CONFIRMED'; requestId: number }
  | { type: 'CHAT_MESSAGE'; roomId: number; preview: string };

/** @deprecated Use StompEvent */
export type NotificationPayload = StompEvent;
