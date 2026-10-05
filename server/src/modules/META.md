# Business modules

Each module exposes domain interfaces through `index.ts`. Only its private `store.ts` accesses its owned Prisma models. `app.ts` constructs the implementations; HTTP adapters receive the public interfaces.

Meetings owns Event, Participant, Vote, and UserEvent operations. Accounts owns User, UserSession, and UserIdentity operations. Places owns Venue. The current runtime does not implement Routing.
