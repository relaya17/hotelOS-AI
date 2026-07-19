import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CRIMINAL_RECORD_DOC_TYPE,
  redactHrDocumentsForViewer,
} from "./redact-hr-documents.js";

describe("redactHrDocumentsForViewer", () => {
  const docs = [
    {
      id: "d1",
      docType: CRIMINAL_RECORD_DOC_TYPE,
      status: "pending_review",
      contentHash: "abc123hash",
      issuingAuthority: "משטרה",
      expiresAt: null,
      uploadedAt: "2026-07-19T00:00:00.000Z",
    },
    {
      id: "d2",
      docType: "contract",
      status: "approved",
      contentHash: "contract-hash",
      issuingAuthority: null,
      expiresAt: null,
      uploadedAt: "2026-07-19T00:00:00.000Z",
    },
  ] as const;

  it("keeps hashes for dedicated HR", () => {
    const result = redactHrDocumentsForViewer(docs, true);
    assert.equal(result[0]?.contentHash, "abc123hash");
    assert.equal(result[1]?.contentHash, "contract-hash");
  });

  it("redacts criminal-record hash for non-HR; keeps status", () => {
    const result = redactHrDocumentsForViewer(docs, false);
    assert.equal(result[0]?.contentHash, null);
    assert.equal(result[0]?.status, "pending_review");
    assert.equal(result[1]?.contentHash, "contract-hash");
  });
});
