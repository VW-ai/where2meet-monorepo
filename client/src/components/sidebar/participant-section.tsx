'use client';

import { useState } from 'react';
import { useMeetingStore } from '@/store/useMeetingStore';
import { Users, Plus, EyeOff } from 'lucide-react';
import { AddParticipant, type ParticipantFormData } from './participant/add-participant';
import { geocodeAddress } from '@/lib/api/mock/geocoding';
import { getRandomColor } from '@/lib/utils/participant-colors';
import { applyFuzzyOffset } from '@/lib/utils/location';
import type { Participant } from '@/types';

export function ParticipantSection() {
  const { currentEvent, addParticipant } = useMeetingStore();
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const participantCount = currentEvent?.participants?.length || 0;

  // Handle participant form submission
  const handleAddParticipant = async (data: ParticipantFormData) => {
    setIsSubmitting(true);

    try {
      // Geocode the address to get coordinates
      let location = await geocodeAddress(data.address, data.placeId);

      // Apply fuzzy offset if enabled
      if (data.fuzzyLocation) {
        location = applyFuzzyOffset(location);
      }

      // Create new participant
      const newParticipant: Participant = {
        id: crypto.randomUUID(),
        name: data.name,
        address: data.address,
        location,
        color: getRandomColor(),
        fuzzyLocation: data.fuzzyLocation,
        createdAt: new Date().toISOString(),
      };

      // Add to store
      addParticipant(newParticipant);

      // Close form
      setShowAddForm(false);
    } catch (error) {
      console.error('Error adding participant:', error);
      alert('Failed to add participant. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Users className="w-5 h-5" />
          Participants
        </h2>
        {participantCount > 0 && (
          <span className="text-sm text-muted-foreground">
            {participantCount} {participantCount === 1 ? 'person' : 'people'}
          </span>
        )}
      </div>

      {/* Add Participant Button (when form is hidden) */}
      {!showAddForm && (
        <button
          onClick={() => setShowAddForm(true)}
          className="w-full px-4 py-3 bg-white border-2 border-dashed border-border hover:border-coral-500 hover:bg-coral-50 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:text-coral-600"
        >
          <Plus className="w-4 h-4" />
          Add Participant
        </button>
      )}

      {/* Add Participant Form */}
      {showAddForm && (
        <div className="p-4 bg-white border-2 border-coral-500 rounded-xl shadow-sm">
          <AddParticipant
            onSubmit={handleAddParticipant}
            onCancel={() => setShowAddForm(false)}
            isSubmitting={isSubmitting}
          />
        </div>
      )}

      {/* Participant List */}
      {participantCount > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground px-2">
            {participantCount} {participantCount === 1 ? 'participant' : 'participants'}
          </p>
          {currentEvent?.participants?.map((participant) => (
            <div
              key={participant.id}
              className="p-3 rounded-lg bg-gray-50 border border-border hover:border-coral-300 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-foreground">{participant.name}</p>
                    {participant.fuzzyLocation && (
                      <span className="inline-flex items-center" title="Fuzzy location enabled">
                        <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {participant.fuzzyLocation ? 'Approximate location' : participant.address}
                  </p>
                </div>
                <div
                  className={`w-8 h-8 rounded-full ${participant.color} flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 ml-3`}
                >
                  {participant.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State (when no participants) */}
      {participantCount === 0 && !showAddForm && (
        <div className="py-8 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-coral-100 flex items-center justify-center">
            <Users className="w-8 h-8 text-coral-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground mb-1">No participants yet</p>
            <p className="text-xs text-muted-foreground">
              Add participants to find the perfect meeting spot
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
