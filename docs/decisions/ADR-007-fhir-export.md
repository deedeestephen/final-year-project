# ADR-007: De-identified FHIR R4 export and the SmartCare Pro mock

- **Status:** Accepted (Phase 14, 2026-09-28).
- **Context:**
  - The proposal requires de-identified patient records as HL7 FHIR R4 JSON bundles "via secured API integration" with SmartCare Pro (FR-09, UC-08, NFR-06), using Safe Harbour (NFR-10).
  - The SmartCare Pro API is not public, and real access needs a data-sharing agreement.
  - The AI layer still returns labelled development mocks.

## Decisions

1. **Purpose limitation through consent.**
   - A research export includes only patients with `RESEARCH_USE` consent.
   - A national-EHR export includes only patients with `EHR_SHARING` consent.
   - The purpose is written on the bundle as an HL7 purpose-of-use label (`HRESCH` / `PUBHLTH`).
2. **Safe Harbor, applied strictly.**
   - Dates are reduced to the year. From age 90 the birth year is removed and the age is given as "90 or older".
   - No names, contact details, national ids, record numbers, sub-national places, free text or files are exported.
   - The database query does not even read those fields.
   - Date shifting was rejected: it is not Safe Harbor, and it would need expert determination and ethics approval.
3. **Stable keyed pseudonyms.**
   - Resource ids are HMACs of internal (random) ids with the server key, shaped as UUIDs.
   - Stable pseudonyms let research follow a person across exports; only the server can recompute them.
   - Per-export random ids were rejected because they would break longitudinal research.
4. **Codes are verified, never guessed.**
   - Every LOINC and HL7 code was checked on the HL7 terminology server.
   - Where no standard code could be verified, the project's own code systems are used and published as FHIR definitions (`2-api-gateway/fhir/definitions/`, generated from the code).
   - The namespace uses the reserved `.example` domain until the Ministry assigns one.
5. **Development mock AI results are never exported.**
   - Only research-model results can be exported. They are marked `preliminary` and labelled `AIAST`, with each model version as a `Device`.
   - An AI-predicted grade group never reuses the pathology LOINC code.
6. **A single `collection` Bundle per export**, not FHIR Bulk Data (NDJSON).
   - It is simple to download, send and validate at prototype scale.
   - A patient limit (default 5,000) asks for one facility at a time. Bulk Data is the upgrade path at national scale.
7. **SmartCare Pro is reached through a standard FHIR `POST {base}/Bundle`** with a Bearer token and a timeout. Redirects are refused, and https is required in production.
   - Development uses a local mock (`npm run smartcare:mock`).
   - The receiver's error text is untrusted: it goes to the audit log only.
8. **Conformance is checked with the official HL7 validator**, kept outside the repository. The gate runs it offline when it is installed; the full check also uses the terminology server.

## Consequences

- The export is safe to hand to an approved research team or a registry under an agreement, but it is not anonymous. A rare combination of values can still point to a person.
- Receiving data back from SmartCare Pro (the "bidirectional" part of UC-08) needs identified data and patient matching, so a data-sharing agreement. It is documented as future work. `readExport()` is the start of an inbound adapter.
- The validator's remaining warnings are best practice only:
  - no narrative text
  - no `performer`, because staff are deliberately not exported
