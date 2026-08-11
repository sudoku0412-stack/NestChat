// Flipped to true in Phase 2b once every household member is on a build that can decrypt --
// see HANDOVER.md's E2EE rollout section. While false, the crypto layer is fully wired (keys
// generated/published, chat keys creatable) but nothing is actually sent encrypted yet, so this
// phase ships with zero behavior change.
export const SEND_ENCRYPTED = false;

export const CURRENT_ENVELOPE_VERSION = 1;
