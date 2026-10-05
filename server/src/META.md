# M4 server runtime

`app.ts` composes the modules and HTTP adapters. `makeApp` returns an application without listening. `index.ts` loads configuration, listens on the configured host and port, and closes resources on termination.

The runnable implementation is under this directory. Older architecture and milestone documents under `server/META` describe the previous runtime unless explicitly updated for the migration. The unchanged Prisma schema and migrations remain the storage contract.

The current slice supports anonymous meeting creation, event reads and edits, deletion, participant joining, organizer additions, participant updates and removal, participant identity, email registration and login, session revocation, profile updates, meeting claims and dashboard lists, vote reads and writes, organizer publication and reopening, and authenticated SSE. It also supports public venue search, details, photos, and authenticated meeting directions. Accounts owns User, UserIdentity and UserSession. Meetings owns Event, Participant, Vote and UserEvent. A claim does not replace participant credential authority. Places owns provider data and Venue summaries. Routing calculates routes from typed coordinates. MEC remains an explicit 501 operation. Nothing forwards to the legacy service.
