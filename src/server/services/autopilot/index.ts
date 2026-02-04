/**
 * Autopilot Service
 *
 * Central export for all autopilot-related functionality.
 */

// Confidence calculation
export {
  calculateConfidence,
  getConfidenceLevel,
  shouldAutoExecute,
  requiresApproval,
  logOnly,
  getConfidenceLevelDescription,
  CONFIDENCE_LEVELS,
  VALUE_THRESHOLDS,
  type ConfidenceContext,
  type ConfidenceLevel,
  type ConfidenceResult,
  type ConfidenceFactor,
} from "./confidence";

// Offer evaluation engine
export {
  evaluateOffer,
  loadOfferRules,
  validateOfferRuleConfig,
  DEFAULT_OFFER_RULE_CONFIG,
  type OfferContext,
  type OfferDecision,
  type OfferEvaluationResult,
} from "./engine";

// Repricing service
export {
  evaluateReprice,
  calculateNewPrice,
  calculateTimeDecayDrop,
  checkRepriceLimit,
  incrementRepriceCount,
  getRepriceRules,
  getActiveListingsForRepricing,
  getRepriceHistory,
  createRepriceAction,
  markRepriceExecuted,
  markRepriceFailed,
  updateListingPrice,
  type RepricingContext,
  type RepricingResult,
  type RepriceRules,
  type RepriceHistoryEntry,
} from "./repricing";
