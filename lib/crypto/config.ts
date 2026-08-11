// Flipped on for Phase 2b -- text messages sent from this build are now encrypted. See
// HANDOVER.md's E2EE rollout section: every household member MUST be on this build (or newer)
// before anyone sends anything, or an older build will render the encrypted message as a blank
// bubble (its body column is null and it has no idea what to do with enc_v/ciphertext).
export const SEND_ENCRYPTED = true;

export const CURRENT_ENVELOPE_VERSION = 1;
