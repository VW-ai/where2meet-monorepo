# Accounts

`store.ts` hashes the supplied session credential, reads UserSession and User, checks the original expiry, and removes expired sessions. It returns domain account data through the interface in `types.ts`.

Reads do not renew sessions or issue cookies. Passwords, registration, login, logout, account updates, and identity management are not implemented in M1. Imported password hashes remain unchanged in the schema.
