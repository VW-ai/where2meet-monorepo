### Feature-Lists

## Host (Organizer) Features

- **Create Event**: Hosts can set up a new meeting event by specifying a theme, preferred location type (e.g. “restaurant” or “café”), and time window.
    
    *User story:* “As an organizer, I want to create an event with details so that participants can join and add their locations.”
    
    *Status:* Planned.
    
- **Manage Participants**: Organizers can review submitted locations and control visibility (show/hide participants on the map).
    
    *User story:* “As an organizer, I want to manage and anonymize participant locations if needed.”
    
    *Status:* Planned.
    
- **Generate Candidate Locations**: After collecting participant locations, the system computes central meeting points. By default it uses the geographic centroid; it can also draw the minimum enclosing circle and query venue databases (e.g. “basketball court”) inside that circle.
    
    *User story:* “As an organizer, I want the system to suggest meeting spots based on all participants’ locations.”
    
    *Status:* Planned.
    
- **Coordinate Decision Process**: The host can enable or disable voting on the suggested spots and set decision deadlines.
    
    *User story:* “As an organizer, I want to control voting and deadlines to decide on the meeting place.”
    
    *Status:* Planned.
    

## Guest (Participant) Features

- **Submit Location**: Guests submit their own geographic location (latitude/longitude). This may be done via address autocomplete or GPS.
    
    *User story:* “As a participant, I want to enter my location so that the system can compute a fair meeting point.”
    
    *Status:* Planed.
    
- **Suggest Meeting Place**: Participants can suggest potential meeting venues (with optional reasons/weights).
    
    *User story:* “As a participant, I want to propose a venue I like, so the group can consider it.”
    
    *Status:* Planned.
    
- **Vote on Meeting Places**: If voting is enabled by the host, participants can vote on the candidate venues.
    
    *User story:* “As a participant, I want to vote on preferred meeting locations.”
    
    *Status:* Planned.
    
- **View Final Decision**: Participants can view the selected meeting spot and (optionally) suggested travel routes from their locations.
    
    *User story:* “As a participant, I want to see the final meeting location and how to get there.”
    
    *Status:* Planned.
    

## General / System Features

- **Add Multiple Participants**: The UI allows adding multiple starting locations (participants) via address search/autocomplete. Each added location is listed in the sidebar and shown as a marker on the map.
    
    *User story:* “As a user, I want to input several people’s addresses to plan a meetup.”
    
    *Status:* Planed.
    
- **Search Nearby Venues**: After the meeting center is calculated, the system shows “Search Nearby” category buttons (e.g. Coffee, Restaurants, Bars). Clicking one queries venues near the center and displays results in a list and on the map.
    
    *User story:* “As a user, I want to search for venues (like cafes) near the suggested meeting point.”
    
    *Status:* Planed.
    
- **Select Venue & View Details**: Users can select a venue from the list or map marker. The map highlights it and the sidebar shows details (rating, photos, open status). An “Open in Maps” button provides navigation.
    
    *User story:* “As a user, I want to click a venue to see more info and navigate there.”
    
    *Status:* Planed.
    
- **Geometric Calculations (Centroid/MEC)**: The system computes the average latitude/longitude (centroid) of all participants (and optionally the minimum enclosing circle). This is done client-side for instant feedback.
    
    *Purpose:* “Compute the optimal center point from all participant locations.”
    
    *Status:* Planed.
    
- **Shareable Meeting Link (URL state)**: The application can encode participant coordinates into the URL query parameters (e.g. `?p1=lat,lng...`) so that the session can be shared without a backend.
    
    *User story:* “As a user, I want to share a link to this meeting plan so others can join.”
    
    *Status:* Recommended.