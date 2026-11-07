# Automation product safety lessons

**Reviewed:** 7 November 2026  
**Purpose:** Record general product-design and security lessons from a review of an automated online service. This is not an endorsement or a recommendation to use that service.

## Evidence assessment

Promotional performance figures and operator statements should not be treated as independently verified facts. A reachable website, HTTPS, or a favourable automated website scan does not establish an operator's identity, service reliability, financial safety, or the accuracy of performance claims.

## Lessons applied to NOVA

1. **Provenance for every number.** Show the provider, source timestamp, retrieval timestamp, units, and whether a value is live, delayed, simulated, or manually entered.
2. **Separate claims from verified facts.** Never present self-reported performance as independently verified.
3. **Read-only by default.** NOVA's market area displays provider data only. It does not connect to accounts, place orders, request withdrawal permissions, sign transactions, or collect account passwords.
4. **Least-privilege secrets.** Provider credentials remain on the backend and are never embedded in the mobile application.
5. **Visible uncertainty.** Missing, stale, invalid, or unavailable data must be labelled rather than replaced with fabricated values.
6. **Human approval.** Consequential actions in any future integration require clear user review and approval before execution.
7. **No performance promises.** NOVA must not imply that past or promotional results guarantee future outcomes.

## NOVA implementation boundary

The current NOVA prototype is an AI productivity workspace with an informational, read-only data screen. AI chat is advisory and conversational; it does not execute external actions. Authentication, persistent memory, cloud task sync, audit logs, rate limiting, and connected tools are not yet implemented.

This is a point-in-time product-safety note, not financial advice and not a service endorsement.
