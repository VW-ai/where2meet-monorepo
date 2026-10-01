'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, Loader2, MapPin } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { useUIStore } from '@/features/meeting/model/ui-store';
import { useMapStore } from '@/features/meeting/model/map-store';
import {
  searchPlacesAutocomplete,
  type PlacePrediction,
} from '@/shared/lib/google-maps/places-autocomplete';

interface SearchPillBarProps {
  onSearchExecute?: (query: string) => void; // Callback for search execution (Phase 2)
  onPlaceSelect?: (prediction: PlacePrediction) => void; // A specific place was picked
  onFocus?: () => void;
}

export function SearchPillBar({ onSearchExecute, onPlaceSelect, onFocus }: SearchPillBarProps) {
  const { setSearchQuery } = useUIStore();
  const { searchCircle } = useMapStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlacePrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // 0 = the "search nearby" row, 1..n = place suggestions, -1 = nothing highlighted
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Debounced autocomplete function - uses Google Places Autocomplete API
  const performAutocomplete = useCallback(
    async (searchQueryText: string) => {
      if (!searchQueryText.trim()) {
        setResults([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        // Use Google Places Autocomplete with search circle center as bias
        const predictions = await searchPlacesAutocomplete(searchQueryText, {
          types: ['establishment'], // Only show businesses/venues
          location: searchCircle?.center,
          radius: 50000, // 50km radius for autocomplete suggestions
        });
        setResults(predictions);
      } catch (error) {
        console.error('Autocomplete error:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [searchCircle]
  );

  // Handle input change with debounce
  const handleInputChange = (value: string) => {
    setQuery(value);
    setIsExpanded(true);
    setHighlightedIndex(-1);
    // Don't sync to store - only local state for autocomplete

    // Clear previous timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Set new timeout for debounced autocomplete
    debounceRef.current = setTimeout(() => {
      performAutocomplete(value);
    }, 300);
  };

  const handleFocus = () => {
    if (!isExpanded) {
      setIsExpanded(true);
      onFocus?.();
    }
  };

  // Reset after a search ran (or on Escape)
  const handleCollapse = useCallback(() => {
    setIsExpanded(false);
    setQuery('');
    setResults([]);
    setHighlightedIndex(-1);
    setIsLoading(false);
    // Clear store search query
    setSearchQuery('');
  }, [setSearchQuery]);

  // Text search around the group (Phase 2)
  const runSearch = () => {
    if (!query.trim()) return;
    onSearchExecute?.(query.trim());
    handleCollapse();
    inputRef.current?.blur();
  };

  // A specific place was picked: add exactly that place instead of searching its name
  const handleSelectPrediction = (prediction: PlacePrediction) => {
    if (onPlaceSelect) {
      onPlaceSelect(prediction);
    } else {
      onSearchExecute?.(prediction.main_text);
    }
    handleCollapse();
    inputRef.current?.blur();
  };

  // Handle clear button
  const handleClear = () => {
    setQuery('');
    setResults([]);
    setHighlightedIndex(-1);
    // Don't clear store - only local state
    inputRef.current?.focus();
  };

  const optionCount = query.trim() ? results.length + 1 : 0;

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleCollapse();
      inputRef.current?.blur();
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 1) {
        handleSelectPrediction(results[highlightedIndex - 1]);
      } else {
        runSearch();
      }
      return;
    }

    if (!optionCount) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < optionCount - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    }
  };

  // Click outside closes the suggestions but keeps what was typed
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
        setHighlightedIndex(-1);
      }
    };

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isExpanded]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const showDropdown = isExpanded && !!query.trim();

  return (
    <div ref={containerRef} className="relative">
      {/* Search Input */}
      <div
        className={cn(
          'relative flex items-center gap-2 transition-all duration-300 ease-in-out',
          'bg-white/90 backdrop-blur-sm shadow-md border-2 border-border',
          'focus-within:shadow-lg focus-within:ring-2 focus-within:ring-coral-500/20',
          isExpanded
            ? 'w-full rounded-lg px-4 py-3'
            : 'w-full rounded-full px-4 py-2 cursor-text hover:shadow-lg hover:border-coral-500'
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {/* Search Icon */}
        <Search
          className={cn(
            'flex-shrink-0 transition-colors',
            isExpanded ? 'w-5 h-5 text-coral-500' : 'w-4 h-4 text-muted-foreground'
          )}
        />

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label="Search venues"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          aria-controls="venue-search-suggestions"
          aria-activedescendant={
            showDropdown && highlightedIndex >= 0
              ? `venue-search-option-${highlightedIndex}`
              : undefined
          }
          autoComplete="off"
          enterKeyHint="search"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={isExpanded ? 'Search a type of place or a name…' : 'Search venues'}
          className={cn(
            'flex-1 min-w-0 bg-transparent outline-none text-sm',
            'placeholder:text-muted-foreground'
          )}
        />

        {/* Loading Spinner */}
        {isLoading && isExpanded && (
          <Loader2 className="w-4 h-4 text-coral-500 animate-spin flex-shrink-0" />
        )}

        {/* Clear Button */}
        {query && !isLoading && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            className="flex-shrink-0 p-1 rounded-lg hover:bg-coral-50 text-muted-foreground hover:text-coral-600 transition-colors"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Suggestions: search-nearby first, then specific places */}
      {showDropdown && (
        <ul
          id="venue-search-suggestions"
          role="listbox"
          className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border-2 border-border max-h-80 overflow-y-auto z-50 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <li
            id="venue-search-option-0"
            role="option"
            aria-selected={highlightedIndex === 0}
            onMouseDown={(e) => e.preventDefault()}
            onClick={runSearch}
            onMouseEnter={() => setHighlightedIndex(0)}
            className={cn(
              'px-4 py-3 cursor-pointer border-b border-border transition-colors',
              highlightedIndex === 0 ? 'bg-coral-50 text-coral-700' : 'hover:bg-coral-50/50'
            )}
          >
            <div className="flex items-start gap-3">
              <Search className="w-4 h-4 text-coral-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-foreground truncate">
                  Search “{query.trim()}” near your group
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Show every match inside the search circle
                </p>
              </div>
            </div>
          </li>

          {results.map((prediction, index) => (
            <li
              key={prediction.place_id}
              id={`venue-search-option-${index + 1}`}
              role="option"
              aria-selected={highlightedIndex === index + 1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelectPrediction(prediction)}
              onMouseEnter={() => setHighlightedIndex(index + 1)}
              className={cn(
                'px-4 py-3 cursor-pointer border-b border-border last:border-b-0 transition-colors',
                highlightedIndex === index + 1
                  ? 'bg-coral-50 text-coral-700'
                  : 'hover:bg-coral-50/50'
              )}
            >
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-coral-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground truncate">
                    {prediction.main_text}
                  </p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {prediction.secondary_text}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
