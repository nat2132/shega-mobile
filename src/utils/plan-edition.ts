import { parsePlanEdition, type PlanEdition } from '@shega/shared';
import { PLAN_EDITIONS as API_PLAN_EDITIONS, type PlanEdition as ApiPlanEdition } from '@/services/api';

/**
 * The canonical edition list and type come from `@shega/shared`, which both apps
 * and the backend agree on. The `api` module re-exports them for the existing
 * call sites; keeping the indirection here means there is exactly one
 * implementation of the edition rules.
 */
export const PLAN_EDITIONS = API_PLAN_EDITIONS;
export type { PlanEdition as ApiPlanEdition };
export { parsePlanEdition, type PlanEdition };

/** i18n key that renders each edition's display name. */
export const PLAN_EDITION_LABEL_KEY: Record<PlanEdition, string> = {
  mobile: 'subscription.plan_mobile',
  desktop: 'subscription.plan_desktop',
  both: 'subscription.plan_both',
};

/**
 * Resolves a subscription/plan to its canonical edition.
 *
 * Prefers the backend's `edition` field. The display-name fallback only exists
 * for status payloads cached before `edition` was added to the contract, and
 * matches the three canonical plan names — it never infers a tier.
 */
export function resolvePlanEdition(
  source: { edition?: ApiPlanEdition | string | null; plan?: string | null; plan_name?: string | null } | null | undefined,
): PlanEdition | null {
  if (!source) return null;
  return parsePlanEdition(source.edition ?? source.plan ?? source.plan_name);
}

/** The edition's translated display name, or `fallback` when unknown. */
export function planEditionLabel(
  source: Parameters<typeof resolvePlanEdition>[0],
  t: (key: string) => string,
  fallback: string,
): string {
  const edition = resolvePlanEdition(source);
  return edition ? t(PLAN_EDITION_LABEL_KEY[edition]) : fallback;
}
