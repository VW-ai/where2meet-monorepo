'use client';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils/cn';

interface AppointmentPickerProps {
  date: Date | undefined;
  onDateTimeChange: (date: Date | undefined) => void;
  label?: string;
  placeholder?: string;
  className?: string;
}

export function AppointmentPicker({
  date,
  onDateTimeChange,
  label,
  placeholder = 'Pick a date and time',
  className,
}: AppointmentPickerProps) {
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState<Date>(date || today);
  const [selectedTime, setSelectedTime] = useState<string | null>(
    date ? format(date, 'HH:mm') : null
  );

  // Sync with prop changes
  useEffect(() => {
    if (date) {
      setSelectedDate(date);
      setSelectedTime(format(date, 'HH:mm'));
    }
  }, [date]);

  const timeSlots = [
    { time: '09:00', available: true },
    { time: '09:30', available: true },
    { time: '10:00', available: true },
    { time: '10:30', available: true },
    { time: '11:00', available: true },
    { time: '11:30', available: true },
    { time: '12:00', available: true },
    { time: '12:30', available: true },
    { time: '13:00', available: true },
    { time: '13:30', available: true },
    { time: '14:00', available: true },
    { time: '14:30', available: true },
    { time: '15:00', available: true },
    { time: '15:30', available: true },
    { time: '16:00', available: true },
    { time: '16:30', available: true },
    { time: '17:00', available: true },
    { time: '17:30', available: true },
  ];

  const handleDateSelect = (newDate: Date | undefined) => {
    if (newDate) {
      setSelectedDate(newDate);
      setSelectedTime(null);
      // Don't notify parent until time is also selected
    }
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);

    // Combine date and time
    const [hours, minutes] = time.split(':').map(Number);
    const combined = new Date(selectedDate);
    combined.setHours(hours);
    combined.setMinutes(minutes);
    combined.setSeconds(0);
    combined.setMilliseconds(0);

    onDateTimeChange(combined);
  };

  return (
    <div className={cn('w-full', className)}>
      {label && <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-full justify-start text-left font-normal px-4 py-3.5 h-auto rounded-2xl border-2 border-gray-200 hover:bg-transparent hover:border-gray-300',
              !date && 'text-gray-400',
              'focus:outline-none focus:border-coral-500 focus:ring-4 focus:ring-coral-100'
            )}
          >
            <CalendarIcon className="mr-2 h-5 w-5 text-coral-500" />
            {date ? format(date, "PPP 'at' p") : <span>{placeholder}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
            <div className="flex max-sm:flex-col">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                className="p-3 sm:pe-5 bg-white"
                disabled={[{ before: today }]}
              />
              <div className="relative w-full max-sm:h-64 sm:w-56">
                <div className="absolute inset-0 py-4 border-l border-gray-200 max-sm:border-l-0 max-sm:border-t">
                  <ScrollArea className="h-full">
                    <div className="space-y-3">
                      <div className="flex h-5 shrink-0 items-center px-5">
                        <p className="text-sm font-medium text-gray-700">
                          {format(selectedDate, 'EEEE, d')}
                        </p>
                      </div>
                      <div className="grid gap-2 px-5 max-sm:grid-cols-2">
                        {timeSlots.map(({ time: timeSlot, available }) => (
                          <Button
                            key={timeSlot}
                            variant={selectedTime === timeSlot ? 'default' : 'outline'}
                            size="sm"
                            className="w-full"
                            onClick={() => handleTimeSelect(timeSlot)}
                            disabled={!available}
                          >
                            {timeSlot}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
