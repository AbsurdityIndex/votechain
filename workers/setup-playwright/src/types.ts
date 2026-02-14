/**
 * Typed response contracts for the `/setup/playwright` automation worker.
 * These mirror the schema described in the Playwright setup PRD so that
 * downstream tickets can focus on business logic instead of guessing shapes.
 */

export type SetupPlaywrightErrorCode =
  | 'EWP_BAD_MANIFEST'
  | 'EWP_CHALLENGE_EXPIRED'
  | 'EWP_IDEMPOTENCY_MISMATCH'
  | 'EWP_PROOF_INVALID'
  | 'EWP_NULLIFIER_USED'
  | 'EWP_BALLOT_INVALID'
  | 'EWP_RATE_LIMITED'
  | 'EWP_GATEWAY_OVERLOADED';

export interface SetupPlaywrightCredentialBundle {
  manifestId: string;
  electionId: string;
  jurisdictionId: string;
  issuedAt: string;
  payload: Record<string, unknown>;
}

export interface SetupPlaywrightReceiptStub {
  receiptId: string;
  electionId: string;
  manifestId: string;
  issuedAt: string;
  nullifier: string;
  bbLeafHash?: string;
  sthRootHash?: string;
}

export interface SetupPlaywrightBundleArtifact {
  name: string;
  storageKey: string;
  checksum: string;
  sizeBytes?: number;
  contentType?: string;
  uploadedAt?: string;
}

export interface SetupPlaywrightResultMetadata {
  bundles: SetupPlaywrightBundleArtifact[];
  [key: string]: unknown;
}

export interface SetupPlaywrightResultBody {
  credentialBundle: SetupPlaywrightCredentialBundle;
  nullifier: string;
  receiptStub: SetupPlaywrightReceiptStub;
  snapshotKey: string;
  snapshotChecksum: string;
  runId: string;
  metadata: SetupPlaywrightResultMetadata;
}

export interface SetupPlaywrightSuccessBody {
  ok: true;
  result: SetupPlaywrightResultBody;
}

export interface SetupPlaywrightErrorBody {
  ok: false;
  error: {
    code: SetupPlaywrightErrorCode;
    message: string;
    retryable: boolean;
    details?: Record<string, unknown>;
    reference?: string;
  };
}

export type SetupPlaywrightResponseBody = SetupPlaywrightSuccessBody | SetupPlaywrightErrorBody;
