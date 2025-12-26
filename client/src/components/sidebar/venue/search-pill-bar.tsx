'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, Loader2, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useUIStore } from '@/store/ui-store';
import { useMapStore } from '@/store/map-store';
import { searchPlacesAutocomplete, type PlacePrediction } from '@/lib/google-maps/places-autocomplete';

interface SearchPillBarProps {
  onSearchExecute?: (query: string) => void; // Callback for search execution (Phase 2)
  onFocus?: () => void;
}

export function SearchPillBar({ onSearchExecute, onFocus }: SearchPillBarProps) {
  const { searchQuery, setSearchQuery } = useUIStore();
  const { searchCircle } = useMapStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlacePrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
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

  // Sync store search query to local state when it changes
  useEffect(() => {
    if (searchQuery && searchQuery !== query) {
      setQuery(searchQuery);
      setIsExpanded(true);
      onFocus?.();
      // Trigger autocomplete immediately
      performAutocomplete(searchQuery);
      // Focus input after expansion
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [searchQuery, query, onFocus, performAutocomplete]);

  // Handle input change with debounce
  const handleInputChange = (value: string) => {
    setQuery(value);
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

  // Handle expand
  const handleExpand = () => {
    setIsExpanded(true);
    onFocus?.();
    // Auto-focus input after animation
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  // Handle collapse
  const handleCollapse = useCallback(() => {
    setIsExpanded(false);
    setQuery('');
    setResults([]);
    setHighlightedIndex(-1);
    setIsLoading(false);
    // Clear store search query
    setSearchQuery('');
  }, [setSearchQuery]);

  // Handle prediction selection (Phase 2: Execute search with selected term)
  const handleSelectPrediction = (prediction: PlacePrediction) => {
    // Execute search to populate venue list with the selected term
    onSearchExecute?.(prediction.main_text);
    handleCollapse();
  };

  // Handle clear button
  const handleClear = () => {
    setQuery('');
    setResults([]);
    setHighlightedIndex(-1);
    // Don't clear store - only local state
    inputRef.current?.focus();
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleCollapse();
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      // If an item is highlighted, select it
      if (highlightedIndex >= 0 && results.length > 0) {
        handleSelectPrediction(results[highlightedIndex]);
      } else if (query.trim()) {
        // Otherwise, execute search with the current query (Phase 2)
        onSearchExecute?.(query);
        handleCollapse();
      }
      return;
    }

    if (!results.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    }
  };

  // Click outside to collapse
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        handleCollapse();
      }
    };

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isExpanded, handleCollapse]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

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
            : 'w-full rounded-full px-4 py-2 cursor-pointer hover:shadow-lg hover:border-coral-500'
        )}
        onClick={!isExpanded ? handleExpand : undefined}
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
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isExpanded ? 'Search venues...' : 'Search'}
          className={cn(
            'flex-1 bg-transparent outline-none text-sm',
            'placeholder:text-muted-foreground',
            !isExpanded && 'pointer-events-none'
          )}
          disabled={!isExpanded}
        />

        {/* Loading Spinner */}
        {isLoading && isExpanded && (
          <Loader2 className="w-4 h-4 text-coral-500 animate-spin flex-shrink-0" />
        )}

        {/* Clear Button */}
        {query && isExpanded && !isLoading && (
          <button
            onClick={handleClear}
            className="flex-shrink-0 p-1 rounded-lg hover:bg-coral-50 text-muted-foreground hover:text-coral-600 transition-colors"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Autocomplete Dropdown */}
      {isExpanded && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border-2 border-border max-h-80 overflow-y-auto z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          {results.map((prediction, index) => (
            <button
              key={prediction.place_id}
              onClick={() => handleSelectPrediction(prediction)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={cn(
                'w-full px-4 py-3 text-left transition-colors',
                'border-b border-border last:border-b-0',
                'focus:outline-none',
                highlightedIndex === index ? 'bg-coral-50 text-coral-700' : 'hover:bg-coral-50/50'
              )}
            >
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-coral-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm text-foreground truncate">
                    {prediction.main_text}
                  </h4>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {prediction.secondary_text}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No Results */}
      {isExpanded && query && !isLoading && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border-2 border-border p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <p className="text-sm text-muted-foreground text-center">
            No suggestions found for &quot;{query}&quot;
          </p>
          <p className="text-xs text-muted-foreground text-center mt-1">
            Press Enter to search anyway
          </p>
        </div>
      )}
    </div>
  );
}
