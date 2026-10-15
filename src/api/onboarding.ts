import { authFetchWithStatus, fetchService, postService } from './service';

export interface OnboardingStatusResponse {
  completed: boolean;
  /** Absent on services that predate the lighting onboarding screen. */
  lightingCompleted?: boolean;
  /** Absent on services that predate the feature-pillars onboarding screen. */
  featuresCompleted?: boolean;
  /** True from a replay's reset until features-complete or skip. Absent on a service that predates it. */
  featuresReplay?: boolean;
  /** Ids of one-time hints the user has acted on or closed. Absent on a service that predates hints. */
  dismissedHints?: string[];
}

export async function fetchOnboardingStatus() {
  return fetchService<OnboardingStatusResponse>('/onboarding');
}

export async function completeOnboarding() {
  return postService<OnboardingStatusResponse>('/onboarding/complete', {});
}

export async function completeLightingOnboarding() {
  return postService<OnboardingStatusResponse>('/onboarding/lighting-complete', {});
}

export async function completeFeaturesOnboarding() {
  return postService<OnboardingStatusResponse>('/onboarding/features-complete', {});
}

/**
 * Marks one onboarding hint as done for good; the service keeps it across
 * restarts and /onboarding/reset. Resolves with the HTTP status (0 when the
 * service was unreachable) and the full status body when there is one, so the
 * caller can tell a refusal (400 bad id, 409 full list) from a transient failure.
 */
export async function dismissOnboardingHint(id: string): Promise<{ status: number; body: OnboardingStatusResponse | null }> {
  const { response, status } = await authFetchWithStatus('/onboarding/hints/dismiss', { method: 'POST', body: { id } });
  let body: OnboardingStatusResponse | null = null;
  try { body = response ? (await response.json()) as OnboardingStatusResponse : null; } catch { /* no JSON body */ }
  return { status, body };
}

export type ConflictStepAction = 'resolveAll' | 'skip' | 'skipOnboarding';

/** How the user left the onboarding conflict step, as catalog ids. */
export interface ConflictStepReport {
  action: ConflictStepAction;
  listed: string[];
  whitelisted: string[];
  /** Rows already gone when the user chose: ended here, closed elsewhere, or exited. */
  alreadyEnded: string[];
}

/** Log-only: writes the choice to the service log for support bundles. */
export async function reportConflictStep(report: ConflictStepReport) {
  return postService<OnboardingStatusResponse>('/onboarding/conflicts-step', report);
}

export interface PanelSwipeOnboardingResponse {
  completed: boolean;
  // Absent from a service that predates the immersive hint.
  immersiveCompleted?: boolean;
}

/** Touch-panel swipe-up hint flag; panel-reachable, unlike the flags above. */
export async function fetchPanelSwipeOnboarding() {
  return fetchService<PanelSwipeOnboardingResponse>('/onboarding/panel-swipe');
}

export async function completePanelSwipeOnboarding() {
  return postService<PanelSwipeOnboardingResponse>('/onboarding/panel-swipe/complete', {});
}

export async function completeImmersiveSwipeOnboarding() {
  return postService<PanelSwipeOnboardingResponse>('/onboarding/panel-swipe/immersive/complete', {});
}

/** Replays the whole first-run sequence, import steps included where still detected. */
export async function resetOnboarding() {
  return postService<OnboardingStatusResponse>('/onboarding/reset', {});
}

export interface DashboardBannerResponse {
  dismissedKey: string;
}

/** Key of the home-dashboard banner the user last closed or opened. */
export async function fetchDashboardBanner() {
  return fetchService<DashboardBannerResponse>('/onboarding/banner');
}

export async function dismissDashboardBanner(key: string) {
  return postService<DashboardBannerResponse>(`/onboarding/banner/dismiss/${encodeURIComponent(key)}`, {});
}
