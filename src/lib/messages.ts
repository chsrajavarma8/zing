// Shared, reusable UX copy so loading/error/empty states read the same
// everywhere in the app. Prefer these over ad-hoc strings for the generic
// cases; write a specific message only when a safer, more helpful
// explanation is actually available (e.g. "That email or roll number is
// already registered" beats a generic error).
export const MESSAGES = {
  loading: "Loading your information…",
  saving: "Saving changes…",
  success: "Your changes have been saved.",
  error: "We couldn't complete that action. Please try again.",
  sessionExpired: "Your session has expired. Sign in to continue.",
  restricted: "You don't have permission to access this page.",
  notFound: "We couldn't find that page.",
  offline: "You appear to be offline. Check your connection before continuing.",
  unsavedChanges: "You have unsaved changes. Leave this page?",
  emptySearch: "No results match your search.",
} as const;
