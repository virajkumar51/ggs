# QuantPulse Firestore Security Specification

## 1. Data Invariants

1. **Master Gate & Ownership Invariant**: Every document in `/users/{userId}`, `/users/{userId}/private/{docId}`, `/users/{userId}/alerts/{alertId}`, and `/users/{userId}/presets/{presetId}` belongs exclusively to `request.auth.uid == userId`. Subcollections (`alerts`, `presets`, `private`) verify that the parent `/users/$(userId)` document exists.
2. **PII Isolation Invariant**: User email addresses are isolated in `/users/{userId}/private/info` and never exposed to non-owners or blanket signed-in reads.
3. **Strict Schema & Anti-Shadow-Field Invariant**: Every `create` and `update` operation calls `isValid[Entity](incoming())`, enforcing `.keys().hasAll(...)` and `.keys().hasOnly(...)` along with explicit `.size()` bounds on all strings and lists.
4. **Immutability & Temporal Integrity**: `uid`, `userId`, `id`, and `createdAt` are immutable across updates. Server timestamps (`request.time`) are enforced on `createdAt` and `updatedAt`.
5. **Query Enforcer Invariant**: Every `allow list` rule enforces ownership (`request.auth.uid == userId` and `resource.data.userId == request.auth.uid`) without delegating filtering to the client.

## 2. The "Dirty Dozen" Payloads

1. **Identity Spoofing**: Creating `/users/userA` where `uid: "userB"` while authenticated as `userA` -> `PERMISSION_DENIED`.
2. **Shadow Field Injection**: Updating `/users/userA` with `{ isAdmin: true }` -> `PERMISSION_DENIED` via `hasOnly`.
3. **Unverified Email Spoofing**: Writing to `/users/userA` when `request.auth.token.email_verified == false` -> `PERMISSION_DENIED`.
4. **PII Cross-Read**: Authenticated `userB` attempting `get` on `/users/userA/private/info` -> `PERMISSION_DENIED`.
5. **Path ID Poisoning**: Creating `/users/userA/alerts/invalid$id!with@spaces` -> `PERMISSION_DENIED` via `isValidId`.
6. **Denial-of-Wallet String Overflow**: Setting `bio` to a 5,000-character string (exceeding `maxLength: 300`) -> `PERMISSION_DENIED`.
7. **Unbounded Array Injection**: Setting `watchlist` to 100 tickers (exceeding `maxLength: 30`) -> `PERMISSION_DENIED`.
8. **Array Type Poisoning**: Setting `watchlist` to `[12345]` instead of strings -> `PERMISSION_DENIED`.
9. **Orphaned Subcollection Write**: Creating `/users/userA/alerts/alert1` when parent `/users/userA` does not exist -> `PERMISSION_DENIED`.
10. **Immutable Field Mutation**: Updating `createdAt` or `uid` on an existing `/users/userA` profile -> `PERMISSION_DENIED`.
11. **Forged Client Timestamp**: Creating `/users/userA` with a past/future `createdAt` not matching `request.time` -> `PERMISSION_DENIED`.
12. **Blanket Collection Scraping**: Listing `/users/userB/alerts` while signed in as `userA` -> `PERMISSION_DENIED`.
