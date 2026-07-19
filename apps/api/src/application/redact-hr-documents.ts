export const CRIMINAL_RECORD_DOC_TYPE = "criminal_record_clearance";

export type HrDocumentView = {
  readonly id: string;
  readonly docType: string;
  readonly status: string;
  readonly contentHash: string | null;
  readonly issuingAuthority: string | null;
  readonly expiresAt: string | null;
  readonly uploadedAt: string;
};

/**
 * PO employee-hr-module: non-HR may see clearance status only — never contentHash.
 */
export function redactHrDocumentsForViewer(
  documents: readonly HrDocumentView[],
  canSeeSensitive: boolean,
): readonly HrDocumentView[] {
  if (canSeeSensitive) return documents;
  return documents.map((doc) =>
    doc.docType === CRIMINAL_RECORD_DOC_TYPE
      ? { ...doc, contentHash: null }
      : doc,
  );
}

export function isCriminalRecordDocument(docType: string): boolean {
  return docType === CRIMINAL_RECORD_DOC_TYPE;
}
