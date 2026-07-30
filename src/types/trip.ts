/**
 * Client-side shapes for the travel domain. These mirror what the API
 * serialises (dates arrive as ISO strings, not Date objects).
 */

export type Difficulty = "EASY" | "MODERATE" | "CHALLENGING";

export type DepartureStatus =
  | "OPEN"
  | "ALMOST_FULL"
  | "SOLD_OUT"
  | "CANCELLED"
  | "DEPARTED";

export type Departure = {
  id: string;
  tripId: string;
  label: string | null;
  startDate: string;
  endDate: string | null;
  seatsTotal: number | null;
  seatsLeft: number | null;
  price: number | null;
  childPrice: number | null;
  infantPrice: number | null;
  status: DepartureStatus;
};

export type ItineraryDay = {
  id: string;
  tripId: string;
  dayNumber: number;
  title: string;
  description: string | null;
  location: string | null;
  meals: string[];
  accommodation: string | null;
  image: string | null;
};

export type TripCategory = {
  id: string;
  categoryName: string;
  slug: string | null;
  image: string | null;
  parentId: string | null;
};

export type Trip = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  description: string;

  country: string | null;
  city: string | null;
  region: string | null;
  destinations: string[];
  meetingPoint: string | null;
  latitude: number | null;
  longitude: number | null;
  mapUrl: string | null;

  durationDays: number;
  durationNights: number;
  minTravelers: number;
  maxTravelers: number | null;
  difficulty: Difficulty;
  transport: string[];
  languages: string[];
  season: string | null;

  highlights: string[];
  included: string[];
  excluded: string[];
  requirements: string | null;
  cancellationPolicy: string | null;

  image: string;
  extraImages: string[];
  video: string | null;
  videos: string[];

  price: number;
  oldPrice: number | null;
  discount: number | null;
  childPrice: number | null;
  infantPrice: number | null;
  singleSupplement: number | null;
  depositPercent: number | null;
  currency: string;

  categoryId: string | null;
  category: TripCategory | null;

  isFeatured: boolean;
  isPublished: boolean;
  salesCount: number;
  avgRating: number;
  reviewCount: number;

  createdAt: string;
  updatedAt: string;

  departures: Departure[];
  itinerary: ItineraryDay[];
  reviews?: TripReview[];
};

export type TripReview = {
  id: string;
  tripId: string;
  userId: string;
  rating: number;
  comment: string;
  images: string[];
  verifiedPurchase: boolean;
  createdAt: string;
  user?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  } | null;
};

export type CategoryNode = {
  id: string;
  categoryName: string;
  slug: string | null;
  description: string | null;
  image: string | null;
  parentId: string | null;
  tripCount: number;
  children: CategoryNode[];
};

export type BookingStatus =
  | "PENDING"
  | "WAITING_PAYMENT"
  | "PAID"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED";

export type PaymentMethod = "BANK" | "QPAY" | "LEMON";

export type BookingItem = {
  id: string;
  tripId: string;
  departureId: string | null;
  departureDate: string | null;
  adults: number;
  children: number;
  infants: number;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  trip?: Pick<Trip, "id" | "slug" | "title" | "image" | "country" | "durationDays"> | null;
  departure?: Pick<Departure, "id" | "startDate" | "endDate" | "label"> | null;
};

export type Traveler = {
  id: string;
  bookingId: string;
  firstName: string;
  lastName: string;
  type: "ADULT" | "CHILD" | "INFANT";
  dateOfBirth: string | null;
  passportNumber: string | null;
  passportExpiry: string | null;
  nationality: string | null;
  gender: string | null;
  notes: string | null;
};

export type Booking = {
  id: string;
  bookingNumber: string;
  userId: string;
  totalPrice: number;
  paidAmount: number;
  depositDue: number | null;
  status: BookingStatus;
  paymentMethod: PaymentMethod;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  createdAt: string;
  updatedAt: string;
  items: BookingItem[];
  travelers?: Traveler[];
  payment?: {
    invoiceId: string;
    amount: number;
    status: "PENDING" | "PAID";
    qrText: string | null;
    qrImage: string | null;
    createdAt: string;
  } | null;
};

/** What the cart stores locally before a booking exists. */
export type CartLine = {
  tripId: string;
  departureId: string | null;
  departureDate: string | null;
  adults: number;
  children: number;
  infants: number;
  trip: {
    id: string;
    slug: string;
    title: string;
    image: string;
    price: number;
    childPrice: number | null;
    infantPrice: number | null;
    durationDays: number;
    country: string | null;
  };
};
