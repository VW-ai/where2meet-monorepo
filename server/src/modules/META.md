# Business modules

Each module exposes domain interfaces through `index.ts`. Only its private `store.ts` accesses its owned Prisma models. `app.ts` constructs the implementations; HTTP adapters receive the public interfaces.

Meetings owns Event, Participant, Vote, and UserEvent operations. Accounts owns User, UserSession, and UserIdentity operations. Places owns Venue. Routing receives coordinates, a travel mode, and opaque origin IDs. It never receives event credentials, private addresses, or database access.
