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

export interface FieldError {
  field: string;
  message: string;
}

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

export type UserRole = 'TRAVELER' | 'GUIDE';
export type RequestType = 'GUIDE' | 'TRANSLATION' | 'FOOD' | 'EMERGENCY';
export type HelpRequestStatus = 'OPEN' | 'MATCHED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type PaymentStatus = 'AUTHORIZED' | 'CAPTURED' | 'REFUNDED' | 'FAILED';
export type MatchOfferStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED';

export interface AuthResponse {
  accessToken: string;
  userId: number;
  role: UserRole;
  name: string;
}

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

export interface ChatRoomResponse {
  id: number;
  requestId: number;
  travelerId: number;
  guideId: number;
  createdAt: string;
}

export interface ChatMessageResponse {
  messageId: number;
  roomId: number;
  senderId: number;
  content: string;
  sentAt: string;
  clientMessageId: string;
}

export interface PaymentIntentResponse {
  id: number;
  requestId: number;
  amountKrw: number;
  platformFeeKrw: number;
  guidePayout: number;
  status: PaymentStatus;
  createdAt: string;
}

export interface ReviewResponse {
  id: number;
  requestId: number;
  revieweeId: number;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface PageResponse<T> {
  items: T[];
  nextCursor: string | null;
}

export type StompEvent =
  | { type: 'NEW_REQUEST'; requestId: number; requestType: RequestType; budgetKrw: number }
  | { type: 'OFFER_ACCEPTED'; guideId: number }
  | { type: 'MATCH_CONFIRMED'; requestId: number }
  | { type: 'CHAT_MESSAGE'; roomId: number; preview: string };
