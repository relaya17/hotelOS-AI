import type {
  BookingRepository,
  FeedbackRepository,
  GuestProfileRepository,
  HotelRepository,
  ReputationRepository,
} from "@hotelos/database";
import type { HotelId, TenantId } from "@hotelos/shared";

export type Guest360Stay = {
  readonly id: string;
  readonly hotelId: string;
  readonly hotelName: string;
  readonly roomNumber: string;
  readonly guestName: string;
  readonly checkInDate: string;
  readonly checkOutDate: string;
  readonly status: string;
};

export type Guest360Feedback = {
  readonly id: string;
  readonly rating: number;
  readonly comment: string | null;
  readonly categories: readonly string[];
  readonly submittedAt: string;
  readonly source: string;
};

export type Guest360Review = {
  readonly id: string;
  readonly source: string;
  readonly rating: number;
  readonly title: string | null;
  readonly body: string;
  readonly sentiment: string;
  readonly reviewedAt: string;
};

export type Guest360Profile = {
  readonly email: string;
  readonly displayName: string;
  readonly phone: string | null;
  readonly notesHe: string | null;
  readonly preferences: Record<string, unknown>;
  readonly stayCount: number;
  readonly lastStayAt: string | null;
  readonly marketingConsent: boolean;
};

export type Guest360 = {
  readonly email: string;
  readonly hotelId: string;
  readonly profile: Guest360Profile | null;
  readonly staysAtHotel: readonly Guest360Stay[];
  readonly staysInChain: readonly Guest360Stay[];
  readonly chainStayCount: number;
  readonly lastFeedback: Guest360Feedback | null;
  readonly feedbackHistory: readonly Guest360Feedback[];
  readonly reputationSignals: readonly Guest360Review[];
};

export type BuildGuest360Deps = {
  readonly guestProfiles: GuestProfileRepository;
  readonly bookings: BookingRepository;
  readonly feedback: FeedbackRepository;
  readonly reputation: ReputationRepository;
  readonly hotels: HotelRepository;
};

export type BuildGuest360Input = {
  readonly tenantId: TenantId;
  readonly hotelId: HotelId;
  readonly email: string;
};

function mapStay(
  stay: Awaited<
    ReturnType<BookingRepository["listByGuestEmailAtHotel"]>
  >[number],
): Guest360Stay {
  return {
    id: stay.id,
    hotelId: stay.hotelId,
    hotelName: stay.hotelName,
    roomNumber: stay.roomNumber,
    guestName: stay.guestName,
    checkInDate: stay.checkInDate,
    checkOutDate: stay.checkOutDate,
    status: stay.status,
  };
}

function mapFeedback(
  item: Awaited<ReturnType<FeedbackRepository["listByGuestEmail"]>>[number],
): Guest360Feedback {
  return {
    id: item.id,
    rating: item.rating,
    comment: item.comment,
    categories: item.categories,
    submittedAt: item.submittedAt,
    source: item.source,
  };
}

function mapReview(
  item: Awaited<
    ReturnType<ReputationRepository["listByAuthorName"]>
  >[number],
): Guest360Review {
  return {
    id: item.id,
    source: item.source,
    rating: item.rating,
    title: item.title,
    body: item.body,
    sentiment: item.sentiment,
    reviewedAt: item.reviewedAt,
  };
}

function parsePreferences(json: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

function resolveGuestName(
  profile: Guest360Profile | null,
  staysAtHotel: readonly Guest360Stay[],
  staysInChain: readonly Guest360Stay[],
): string | null {
  if (profile?.displayName.trim()) {
    return profile.displayName.trim();
  }
  const fromHotel = staysAtHotel[0]?.guestName?.trim();
  if (fromHotel) {
    return fromHotel;
  }
  const fromChain = staysInChain[0]?.guestName?.trim();
  return fromChain ?? null;
}

export async function buildGuest360(
  deps: BuildGuest360Deps,
  input: BuildGuest360Input,
): Promise<Guest360 | null> {
  const email = input.email.trim().toLowerCase();
  const hotel = await deps.hotels.findById(input.hotelId);
  if (!hotel || hotel.tenantId !== input.tenantId) {
    return null;
  }

  const [profile, staysAtHotel, staysInChain, feedbackHistory] =
    await Promise.all([
      deps.guestProfiles.findByEmail(input.tenantId, email),
      deps.bookings.listByGuestEmailAtHotel(
        input.tenantId,
        input.hotelId,
        email,
        { limit: 10 },
      ),
      deps.bookings.listByGuestEmailInChain(
        input.tenantId,
        hotel.chainId,
        email,
        { limit: 10 },
      ),
      deps.feedback.listByGuestEmail(input.tenantId, input.hotelId, email, {
        limit: 5,
      }),
    ]);

  const mappedProfile = profile
    ? {
        email: profile.email,
        displayName: profile.displayName,
        phone: profile.phone,
        notesHe: profile.notesHe,
        preferences: parsePreferences(profile.preferencesJson),
        stayCount: profile.stayCount,
        lastStayAt: profile.lastStayAt,
        marketingConsent: profile.marketingConsent,
      }
    : null;

  const mappedStaysAtHotel = staysAtHotel.map(mapStay);
  const mappedStaysInChain = staysInChain.map(mapStay);

  const guestName = resolveGuestName(
    mappedProfile,
    mappedStaysAtHotel,
    mappedStaysInChain,
  );
  const reputationSignals =
    guestName !== null
      ? (
          await deps.reputation.listByAuthorName(
            input.tenantId,
            input.hotelId,
            guestName,
            { limit: 5 },
          )
        ).map(mapReview)
      : [];

  const mappedFeedback = feedbackHistory.map(mapFeedback);

  return {
    email,
    hotelId: input.hotelId,
    profile: mappedProfile,
    staysAtHotel: mappedStaysAtHotel,
    staysInChain: mappedStaysInChain,
    chainStayCount: mappedStaysInChain.length,
    lastFeedback: mappedFeedback[0] ?? null,
    feedbackHistory: mappedFeedback,
    reputationSignals,
  };
}
