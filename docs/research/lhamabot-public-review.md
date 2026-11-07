# LhamaBot product and safety review

**Reviewed:** 7 November 2026  
**Purpose:** Extract product-design and security lessons for NOVA. This is not an endorsement or a recommendation to use the service.

## Evidence assessment

The material reviewed was not sufficient to verify the service operator, financial performance, custody arrangements, or withdrawal reliability. Performance figures shown in promotional material were treated as **unverified claims**, not independently established results. A website being reachable, using HTTPS, or receiving a favourable automated website scan does not establish financial safety or legitimacy.

The reviewed terms stated an 18+ age requirement. NOVA's research is for product-design learning only; it does not encourage account creation, deposits, trading, or use of that service.

## Lessons applied to NOVA

1. **Provenance for every number.** Show the provider, symbol, currency, source timestamp, retrieval timestamp, and whether a value is live, delayed, simulated, or manually entered.
2. **Separate claims from verified facts.** Never present self-reported performance as independently verified.
3. **Read-only by default.** NOVA's market area displays provider data only. It does not connect to broker accounts, place orders, request withdrawal permissions, sign wallet transactions, or collect financial account passwords.
4. **Least-privilege secrets.** Provider credentials remain on the backend and are never embedded in the mobile application.
5. **Visible uncertainty.** Missing, stale, invalid, or unavailable data must be labelled rather than replaced with fabricated values.
6. **Human approval.** Consequential actions in any future integration require clear user review and approval before execution.
7. **No performance promises.** NOVA must not imply that past or promotional results guarantee future outcomes.

## NOVA implementation boundary

The current NOVA prototype is an AI productivity workspace with an informational, read-only market-data screen. The AI chat is advisory and conversational; it does not execute external actions. Authentication, persistent memory, cloud task sync, audit logs, rate limiting, and connected tools are not yet implemented.

This review is a point-in-time product-safety note, not financial advice and not a service endorsement.
