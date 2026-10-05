# Accounts

`store.ts` owns User, UserIdentity and UserSession operations. Registration creates all three atomically after hashing the password. Login compares the stored bcrypt hash and creates an independent session. New passwords retain bcrypt cost 12 and its existing byte-limit behavior. Imported hashes are never rehashed or normalized. A null or malformed hash cannot authenticate.

Sessions use a random `st_` credential with its full-token SHA-256 stored in the database. New sessions last seven days. Reads check the original expiry, remove expired rows idempotently, and never renew sessions. Logout deletes only the presented session and propagates database failure. Profile patches preserve omitted fields and clear nullable fields when explicitly given null.

The public interface returns safe account data and session issuance data. HTTP owns cookie serialization. Account cookies do not grant participant authority. Claims and dashboard links belong to Meetings. OAuth, password recovery and identity management remain unavailable.
