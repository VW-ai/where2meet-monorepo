/**
 * Input Component
 *
 * Reusable input field with label and error handling
 * Follows the Where2Meet design system (rounded, warm colors)
 */

import { cn } from '@/shared/lib/cn';
import { InputHTMLAttributes, forwardRef } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, label, type = 'text', ...props }, ref) => {
    const isDateTimeInput = type === 'datetime-local' || type === 'date' || type === 'time';

    return (
      <div className="w-full">
        {label && <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>}
        <div className="relative">
          <input
            type={type}
            ref={ref}
            className={cn(
              // Base styles
              'w-full px-4 py-3.5 rounded-2xl',
              'border-2 border-gray-200',
              'transition-all duration-200',
              'placeholder:text-gray-400',
              'disabled:bg-gray-50 disabled:cursor-not-allowed',
              'text-gray-900 font-medium',

              // Focus states
              'focus:outline-none focus:border-coral-500 focus:ring-4 focus:ring-coral-100',
              'hover:border-gray-300',

              // Error states
              error && 'border-red-500 focus:border-red-500 focus:ring-red-200',

              // Special styling for datetime inputs
              isDateTimeInput && ['cursor-pointer', 'pr-3'],

              className
            )}
            {...props}
          />
        </div>
        {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
