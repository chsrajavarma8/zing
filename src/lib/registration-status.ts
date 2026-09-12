import { formatDate } from "@/lib/date";

export interface RegistrationStatus {
  isOpen: boolean;
  opensAt: string | null;
  closesAt: string | null;
  isUpcoming: boolean;
  isClosed: boolean;
}

export function getRegistrationStatus(event: {
  status: string;
  registration_open_at: string | null;
  registration_close_at: string | null;
}): RegistrationStatus {
  if (event.status !== "published") {
    return { isOpen: false, opensAt: event.registration_open_at, closesAt: event.registration_close_at, isUpcoming: false, isClosed: false };
  }

  const now = Date.now();
  const isUpcoming = Boolean(event.registration_open_at && now < Date.parse(event.registration_open_at));
  const isClosed = Boolean(event.registration_close_at && now > Date.parse(event.registration_close_at));

  return {
    isOpen: !isUpcoming && !isClosed,
    opensAt: event.registration_open_at,
    closesAt: event.registration_close_at,
    isUpcoming,
    isClosed,
  };
}

// "Registration opening soon" / "opens <date>" / "Registration updates coming soon." /
// "Registration closed" - the one label used everywhere a register CTA appears.
export function registrationCtaLabel(status: RegistrationStatus): string {
  if (status.isOpen) return "Register your team";
  if (status.isUpcoming && status.opensAt) {
    return `Registration opens ${formatDate(status.opensAt)}`;
  }
  if (status.isClosed) return "Registration closed";
  return "Registration updates coming soon.";
}
