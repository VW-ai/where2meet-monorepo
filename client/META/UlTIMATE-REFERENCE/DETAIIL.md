### **Project: Where2Meet - Technical Specification**

Mascot is a Cat

**1. Core Stack**

- **Framework:** Next.js 14 (App Router)

**Styling:** Tailwind CSS (Playful/Warm color palette to match the "mascot" vibe )

- **Map Provider:** Google Map
- **Icons:** Lucide React.

**2. Page Structure**

**A. Landing Page (`/`)**

- **Layout:** Centered Flexbox container.
- **Components:**
    - `HeroInput`: Inputs for "Title" and "Time".
    - `ActionButtons`: "Create Event" button.
    - `Footer`: "About", “Contact”. .. text.
- **Share Component**: Appears after creation. A floating component one the main app interface and Shows generated link with a "Copy" button and Close 'X'.

**B. Main App Interface (`/meet/[id]`)**

- **Layout:** `Grid` layout. Top Header (10% height), Left Sidebar (30% width), Right Map Area (70% width). Mobile: Stack sidebar below map or use a drawer.
- **Component: Header**
    - **Top left Pill nav component: Logo:** "Where 2 Meet" mascot icon, **Venue:** A venue Icon, **Participant:** people Icon
    - **FilterPills:** Horizontal scrollable list: "Bar", "Gym", "Cafe", "Things to do".
    - **Top right Actions:** Settings icon, Share button(pops up the share component).
    - **Setting Component:** Contains “Edit”, “Publish”, “Delete”
        - Edit: Edits information of this meeting, ex. Meeting Name, Meeting Time
        - Publish: Publish the final decided meeting location
        - Delete: Delete this event
- **Component: Sidebar (Left Panel)**
    - **Mode Toggle:** "Only Organizer" toggle switch.
    - **Section 1: Participants (if clicked on the Participant in the Top left Pill search component):**
        - **“Add participant” component**
            - Input Name, a dice icon for a randomized name, ex(apple_cat)
            - Input Address, have autocompletition
            - an eye icon (For Fuzzy location) with explanation icon beside it (Hover to show instructions on what it does) and a Join Button (To join the participant list)
        - Participants + number of participants header
        - **participants list component**: A List with **Participant Component**s
        - **Participant Component**:
            - A Pill shaped list component with a cat tail attached to the left end with information ( Name + Address), and an avatar and color randomized for each participants on the right end of the participants pill component.
            - (When Clicked on a venue): A bubble that is attached to the right side showing the traveling time from that participant to the selected venue.
        - **Visuals:** Uses mascot faces for avatars.
        - (When Clicked on a venue): an arrow will appear on the right side attached to the **participant list component.**
            - (When Clicked on the arrow ):Analysis Component will slide out on the right. with two visualization graphs. On Top half is a time x distance dot chart, for participants(Dots are their avatars). On Bottom is a Bar Chart, participant x time.
        - (Organizer view): Have an add button, just + , the same width with the list component. On click shows the **“Add participant” component;**
    - **Section 2(if clicked on the Venue in the Top left Pill search component): Venue List:**
        - Travel Type filter: Car, Transit, Walk, Bike (After applying or changing travel type filter, the participant icon in the **Top left Pill nav component will flash 3 times, to remind the user that he can check out the participant section for changes**)
        - Search pill bar with autocompletion, when click on the search it will extend and take up the whole bar
        - Saved Button on the side of the search pill bar, when click on the save it will extend and take up the whole bar
        - After search, Scrollable list of venues (e.g., "Planet Fitness").
        - **Venue Detail :** Rating (4.7 stars), Open/Close hours (e.g., "Open Closes 12am"), and facility picture.
        - Venue Vote button
        - on hover of the venue, its point on the map will highlight
        - on click of the venue, **Venue Info Component** will slide out on its right
    - **Venue Info Component:**
        - Venue Title, with its picture as its background
        - Ratings, address, About, Open Hours, Google Map button that redirect to google map
    - **Voted/saved venue Info Component:**
        - **Venue Details and voting num, sorted by voting num**
    - on the first join of the user, it will be default on participant sections with **Add participant component**
- **Component: Map Area (Right Panel)**
    - **Markers:**
        - Participant locations (Colored mascot icons).
        - "Calculated Meeting MEC" (Minimum Enclosing Circle or Centroid) displayed as a Yellow circle. Low visibility not draggable
        - A draggable black circle(Default stack on top of the MEC), search venue will only search for venues in side this circle
        - **Interaction:** Draggable search radius.
        - **Route**: when user clicked on a venue, on the map will show its route to the the venue with it corresponding travel type. If the user then opens participant section and clicks on other participant, then the route will show going from that other participant to that venue.
    - **Popups:** Clicking a venue shows a detailed card overlay with "Travel Time" graphs.

**3. Critical Logic & Data**

- **Participant Interaction:** When a participant in the sidebar is clicked, the map should highlight their specific route and display travel time chips (e.g., "1h", "30min") next to their card.
- **Sort/Filter:** Clicking "Gym" in the header auto searches gym in the venue section