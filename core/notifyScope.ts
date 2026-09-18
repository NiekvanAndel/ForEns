/**
 * What may send a notification, beyond significant weather.
 *
 * The warnings have had per-kind switches since the beginning — rain, wind, frost —
 * because a notification is a different promise from a block on a screen: the block is
 * read when the app is opened and a push arrives whether it is or not. Everything the
 * app has learned to say since then makes the same promise and had no such switch.
 *
 * So: one list, covering both tiers.
 *
 *  - **The basis version** — the disease models and the four rule-based families.
 *  - **AgroIntelligence** — the area conclusions and the chances on the ladder.
 *
 * ## Three gates, all of which must be open
 *
 * A topic notifies only when the reader **asked for it**, the component it belongs to
 * is **switched on**, and — for the add-on — the **tier is on**. They are genuinely
 * different questions: switching the spray window off means the app should stop
 * working it out, while leaving its notification off means it may keep telling you on
 * screen and stay quiet at six in the morning. Collapsing the two would make one of
 * them unsayable.
 *
 * Opt-in throughout, like every notification in this app. A push nobody asked for is
 * how an app gets its notifications switched off wholesale, and the reader who wants
 * to be woken for blossom frost is the one who will go and find the switch.
 *
 * ## What is deliberately not notifiable
 *
 * The window comparison. It is a way of *looking* at three days, not an event that
 * happens at a moment, and a notification needs a moment to be about. The area
 * conclusions cover what would otherwise be worth saying about it — a joint window is
 * exactly the moment-shaped half of that widget.
 */
import { basisComponentOn, type BasisComponent } from './basisLayer';
import type { Prefs } from './prefs';
import { ADVICE_FAMILIES, type AdviceFamily } from './model/fieldAdvice';

/** A thing that may notify. Ids match the components they belong to. */
export type NotifyTopic = 'disease' | AdviceFamily | 'area' | 'risk';

/** The basis version's, in the order the settings page lists them. */
export const BASIS_NOTIFY_TOPICS: readonly NotifyTopic[] = ['disease', ...ADVICE_FAMILIES];

/** And the add-on's. Both are events: a boundary crossed, a chance reaching a rung. */
export const INTEL_NOTIFY_TOPICS: readonly NotifyTopic[] = ['area', 'risk'];

export const NOTIFY_TOPICS: readonly NotifyTopic[] = [
  ...BASIS_NOTIFY_TOPICS, ...INTEL_NOTIFY_TOPICS,
];

/** Whether a topic belongs to the add-on tier rather than to the basis version. */
export function isIntelTopic(topic: NotifyTopic): boolean {
  return INTEL_NOTIFY_TOPICS.includes(topic);
}

/** Whether the reader has asked for this one. The stored answer on its own — the
 *  component it belongs to may still be off, which `notifyAllowed` is for. */
export function notifyRequested(prefs: Pick<Prefs, 'notifyAgro'>, topic: NotifyTopic): boolean {
  return prefs.notifyAgro.includes(topic);
}

/**
 * Whether this topic may actually send anything: asked for, switched on, and — for
 * the add-on — licensed.
 *
 * The one function everything downstream reads, so the three gates cannot be checked
 * in two places and drift.
 */
export function notifyAllowed(
  prefs: Pick<Prefs, 'notifyAgro' | 'alertsEnabled' | 'advice' | 'agroIntel'>,
  topic: NotifyTopic
): boolean {
  if (!notifyRequested(prefs, topic)) return false;
  if (isIntelTopic(topic)) return prefs.agroIntel.enabled;
  // Everything left is a basis component with the same id, which is why the two lists
  // share their names: a topic is the component it is about.
  return basisComponentOn(prefs, topic as BasisComponent);
}

/** Everything that may send, in a stable order — what a registration carries. */
export function allowedNotifyTopics(
  prefs: Pick<Prefs, 'notifyAgro' | 'alertsEnabled' | 'advice' | 'agroIntel'>
): NotifyTopic[] {
  return NOTIFY_TOPICS.filter((topic) => notifyAllowed(prefs, topic));
}

/** Ask for one, or stop asking. */
export function toggleNotifyTopic(asked: readonly string[], topic: NotifyTopic): string[] {
  return asked.includes(topic)
    ? asked.filter((t) => t !== topic)
    : [...asked, topic];
}
