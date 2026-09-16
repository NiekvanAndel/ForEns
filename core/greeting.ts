/**
 * Who is reading, and when.
 *
 * The page a grower opens at five in the morning and the one they open after dinner
 * are the same page, and greeting them by name is the cheapest way for it to feel
 * like theirs rather than like a dashboard. It is also the one line here that is not
 * about the weather, which is why it is one line and not a header.
 *
 * Facts, not sentences, like everything else this page draws: this says *which*
 * greeting and *which* name, and `core/i18n` says it in the reader's language.
 */

/** The four parts of the day Dutch greets separately. */
export type GreetingKind = 'night' | 'morning' | 'afternoon' | 'evening';

/**
 * Which greeting the hour calls for.
 *
 * The boundaries are the conventional Dutch ones — six, twelve, eighteen — and they
 * are the same in the other four languages this app speaks, so one table does.
 * "Goedenacht" runs from midnight because a grower up at four is having a night, not
 * an early morning, and being told otherwise is the kind of cheerfulness that grates.
 */
export function greetingFor(date: Date = new Date()): GreetingKind {
  const h = date.getHours();
  if (h < 6) return 'night';
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

/**
 * The name to greet, from whatever the account gave us.
 *
 * First name only: "Goedemorgen, Niek van Andel" reads like a letter from a bank.
 *
 * An email is refused rather than trimmed. The integration stores the email in
 * `account` and the display name is not always there, so the fallback path can hand
 * this an address — and "Goedemorgen, niek" derived from `niek@agroexact.nl` is a
 * guess at somebody's name from a mailbox, which is worse than not greeting them by
 * name at all. Null means the greeting goes out without one.
 */
export function greetingName(full: string | null | undefined): string | null {
  if (!full) return null;
  const trimmed = full.trim();
  if (!trimmed || trimmed.includes('@')) return null;
  // The trailing dot comes off before the length is judged, so "N. van Andel" is an
  // initial and not a one-letter name. Two letters is kept: Jo and Ed are names.
  const first = (trimmed.split(/\s+/)[0] ?? '').replace(/\.$/, '');
  return first.length > 1 ? first : null;
}
