
import React, { useState } from 'react';
import { MapPin, Clock } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

interface Participant {
    id: string;
    name: string;
    address: string;
    avatarUrl?: string;
    color?: string;
}

interface ParticipantItemProps {
    participant: Participant;
    selectedVenue?: string;
    travelTime?: string;
    onClick?: () => void;
}

const COLORS = [
    'bg-red-500',
    'bg-blue-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-orange-500',
    'bg-teal-500',
    'bg-cyan-500',
];

const getRandomColor = (id: string): string => {
    const index = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return COLORS[index % COLORS.length];
};

const getInitials = (name: string): string => {
    return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
};

const ParticipantItem: React.FC<ParticipantItemProps> = ({
    participant,
    selectedVenue,
    travelTime,
    onClick,
}) => {
    const color = participant.color || getRandomColor(participant.id);
    const initials = getInitials(participant.name);

    return (
        <div className= "relative w-full pb-3" >
        <div
        className="flex items-center gap-3 cursor-pointer transition-all hover:scale-[1.02]"
    onClick = { onClick }
        >
        {/* Cat tail - attached to component */ }
        < div className = "relative flex items-center -mr-2" >
            <svg
            width="40"
    height = "64"
    viewBox = "0 0 40 64"
    className = "text-border"
    style = {{ overflow: 'visible' }
}
          >
    {/* Fluffy cat tail with double curve */ }
    < path
d = "M 6 32 Q 10 20, 18 28 Q 26 36, 42 32"
stroke = "currentColor"
strokeWidth = "4"
fill = "none"
strokeLinecap = "round"
className = "stroke-border"
    />
    {/* Inner curve for fluffiness */ }
    < path
d = "M 8 32 Q 12 24, 18 30 Q 24 34, 40 32"
stroke = "currentColor"
strokeWidth = "2"
fill = "none"
strokeLinecap = "round"
className = "stroke-muted-foreground/30"
    />
    {/* Fluffy tail tip */ }
    < circle
cx = "6"
cy = "32"
r = "4"
fill = "currentColor"
className = "fill-border"
    />
    <circle
              cx="6"
cy = "32"
r = "2.5"
fill = "currentColor"
className = "fill-background"
    />
    </svg>
    </div>

{/* Main pill container */ }
<div className="flex-1 flex items-center justify-between bg-background border border-border rounded-full px-4 py-2 shadow-sm hover:shadow-md transition-shadow" >
    {/* Left side - Info */ }
    < div className = "flex flex-col gap-0.5 min-w-0 flex-1" >
        <span className="text-sm font-medium text-foreground truncate" >
            { participant.name }
            </span>
            < div className = "flex items-center gap-1 text-xs text-muted-foreground" >
                <MapPin className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate" > { participant.address } </span>
                        </div>
                        </div>

{/* Right side - Avatar with cat ears */ }
<div className="ml-3 flex-shrink-0 relative" >
    {/* Cat ears */ }
    < div className = "absolute -top-1 left-0 right-0 flex justify-between px-0.5 z-10" >
        {/* Left ear */ }
        < div className = "relative" >
            <div className={ `w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[10px] ${color} rounded-sm` } style = {{ borderBottomColor: 'inherit' }} />
                < div className = "absolute top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-b-[5px] border-b-pink-300" />
                    </div>
{/* Right ear */ }
<div className="relative" >
    <div className={ `w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[10px] ${color} rounded-sm` } style = {{ borderBottomColor: 'inherit' }} />
        < div className = "absolute top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-b-[5px] border-b-pink-300" />
            </div>
            </div>

            < Avatar className = {`w-10 h-10 border-2 border-background ${color}`}>
            {
                participant.avatarUrl ? (
                    <AvatarImage src= { participant.avatarUrl } alt={ participant.name } />
              ) : null}
                < AvatarFallback className = "text-white font-semibold text-sm" >
                    { initials }
                    </AvatarFallback>
                    </Avatar>
                    </div>
                    </div>

{/* Little circle feet at the bottom */ }
<div className="absolute bottom-0 left-8 right-8 flex justify-around" >
    <div className="w-2 h-2 rounded-full bg-border" />
        <div className="w-2 h-2 rounded-full bg-border" />
            </div>

{/* Travel time bubble - appears when venue is selected */ }
{
    selectedVenue && travelTime && (
        <div className="absolute -right-2 top-1/2 -translate-y-1/2 translate-x-full ml-2 z-10 animate-in fade-in slide-in-from-left-2 duration-200" >
            <div className="relative" >
                {/* Connector triangle */ }
                < div className = "absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full" >
                    <div className="w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-r-[8px] border-r-primary" />
                        </div>

    {/* Bubble content */ }
    <Badge
                variant="default"
    className = "bg-primary text-primary-foreground px-3 py-1.5 rounded-full shadow-lg whitespace-nowrap"
        >
        <Clock className="w-3 h-3 mr-1.5" />
            <span className="text-xs font-medium" > { travelTime } </span>
                </Badge>
                </div>
                </div>
        )
}
</div>
    </div>
  );
};

const ParticipantList: React.FC = () => {
    const [selectedVenue, setSelectedVenue] = useState<string | null>(null);
    const [selectedParticipant, setSelectedParticipant] = useState<string | null>(null);

    const participants: Participant[] = [
        {
            id: '1',
            name: 'Alice Johnson',
            address: '123 Main St, New York, NY',
        },
        {
            id: '2',
            name: 'Bob Smith',
            address: '456 Oak Ave, Brooklyn, NY',
        },
        {
            id: '3',
            name: 'Charlie Davis',
            address: '789 Pine Rd, Queens, NY',
        },
        {
            id: '4',
            name: 'Diana Martinez',
            address: '321 Elm St, Manhattan, NY',
        },
        {
            id: '5',
            name: 'Ethan Wilson',
            address: '654 Maple Dr, Bronx, NY',
        },
    ];

    const venues = [
        { id: 'v1', name: 'Central Park Cafe' },
        { id: 'v2', name: 'Downtown Restaurant' },
        { id: 'v3', name: 'Riverside Bistro' },
    ];

    const getTravelTime = (participantId: string, venueId: string): string => {
        const times = ['5 min', '12 min', '8 min', '15 min', '20 min', '7 min', '18 min'];
        const hash = (participantId + venueId).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return times[hash % times.length];
    };

    const handleVenueClick = (venueId: string) => {
        setSelectedVenue(venueId === selectedVenue ? null : venueId);
    };

    const handleParticipantClick = (participantId: string) => {
        setSelectedParticipant(participantId === selectedParticipant ? null : participantId);
    };

    return (
        <div className= "w-full max-w-4xl mx-auto p-8 space-y-8" >
        <div className="space-y-4" >
            <h2 className="text-2xl font-bold text-foreground" > Select a Venue </h2>
                < div className = "flex flex-wrap gap-3" >
                {
                    venues.map((venue) => (
                        <button
              key= { venue.id }
              onClick = {() => handleVenueClick(venue.id)}
className = {`px-4 py-2 rounded-lg border transition-all ${selectedVenue === venue.id
    ? 'bg-primary text-primary-foreground border-primary shadow-md'
    : 'bg-background text-foreground border-border hover:border-primary'
    }`}
            >
    { venue.name }
    </button>
          ))}
</div>
    </div>

    < Card className = "p-6" >
        <h3 className="text-xl font-semibold text-foreground mb-6" > Participants </h3>
            < div className = "space-y-4" >
            {
                participants.map((participant) => (
                    <ParticipantItem
              key= { participant.id }
              participant = { participant }
              selectedVenue = { selectedVenue || undefined}
travelTime = {
    selectedVenue? getTravelTime(participant.id, selectedVenue) : undefined
}
onClick = {() => handleParticipantClick(participant.id)}
            />
          ))}
</div>
    </Card>

{
    selectedVenue && (
        <div className="text-sm text-muted-foreground text-center" >
            Click on a venue to see travel times for each participant
                </div>
      )}
</div>
  );
};

export default ParticipantList;