'use client';

interface ActionButtonsProps {
  onCreateEvent: () => void;
  isLoading: boolean;
  disabled: boolean;
}

export function ActionButtons({ onCreateEvent, isLoading, disabled }: ActionButtonsProps) {
  return (
    <div className="flex justify-center mt-6">
      <button
        onClick={onCreateEvent}
        disabled={disabled || isLoading}
        className="inline-flex items-center justify-center gap-2 px-8 py-4 text-lg font-semibold text-white bg-coral-500 rounded-full shadow-lg hover:bg-coral-600 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-coral-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 w-full sm:w-auto min-w-[240px]"
      >
        {isLoading ? (
          <>
            <svg
              className="animate-spin h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Creating Meeting...
          </>
        ) : (
          <>
            <svg
              className="w-5 h-5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M12 4v16m8-8H4" />
            </svg>
            Create Meeting
          </>
        )}
      </button>
    </div>
  );
}
