/**
 * Pure helpers for upload → result navigation (testable).
 */

export function shouldNavigateToTender(alreadyNavigated: boolean): boolean {
  return !alreadyNavigated;
}

export function markTenderNavigation(): boolean {
  return true;
}
