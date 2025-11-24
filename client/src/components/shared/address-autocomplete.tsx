'use client';

import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { mockPlacesAutocomplete, type PlacePrediction } from '@/lib/api/mock/places-autocomplete';

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (prediction: PlacePrediction) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'Enter address...',
  className,
  disabled = false,
}: AddressAutocompleteProps) {
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced search
  useEffect(() => {
    if (!value || value.length < 2) {
      setPredictions([]);
      setIsOpen(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsLoading(true);
      try {
        const results = await mockPlacesAutocomplete(value);
        setPredictions(results);
        setIsOpen(results.length > 0);
        setSelectedIndex(-1);
      } catch (error) {
        console.error('Error fetching autocomplete results:', error);
        setPredictions([]);
      } finally {
        setIsLoading(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [value]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || predictions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < predictions.length - 1 ? prev + 1 : prev));
        break;

      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;

      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < predictions.length) {
          handleSelect(predictions[selectedIndex]);
        }
        break;

      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSelectedIndex(-1);
        break;

      default:
        break;
    }
  };

  const handleSelect = (prediction: PlacePrediction) => {
    onChange(prediction.full_address);
    onSelect(prediction);
    setIsOpen(false);
    setSelectedIndex(-1);
    inputRef.current?.blur();
  };

  const handleInputChange = (newValue: string) => {
    onChange(newValue);
    setSelectedIndex(-1);
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      {/* Input Field */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (predictions.length > 0) {
              setIsOpen(true);
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            'w-full px-4 py-2.5 pl-10 pr-4 text-sm',
            'bg-white/80 backdrop-blur-sm rounded-xl shadow-md',
            'focus:outline-none focus:shadow-lg focus:ring-2 focus:ring-coral-500/20',
            'transition-all duration-200',
            'placeholder:text-muted-foreground',
            disabled && 'opacity-50 cursor-not-allowed',
            className
          )}
        />

        {/* MapPin Icon */}
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />

        {/* Loading Spinner */}
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
        )}
      </div>

      {/* Dropdown Suggestions */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white/95 backdrop-blur-md rounded-xl shadow-xl max-h-60 overflow-y-auto">
          {predictions.length > 0 ? (
            <ul className="py-2">
              {predictions.map((prediction, index) => (
                <li key={prediction.place_id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(prediction)}
                    className={cn(
                      'w-full px-4 py-2.5 text-left flex items-start gap-3',
                      'hover:bg-coral-50 transition-colors',
                      selectedIndex === index && 'bg-coral-100',
                      'focus:outline-none focus:bg-coral-50'
                    )}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {prediction.main_text}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {prediction.secondary_text}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-4 px-4 text-center text-sm text-muted-foreground">
              No addresses found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
