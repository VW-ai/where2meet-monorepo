'use client';

interface ActionButtonsProps {
  onCreateEvent: () => void;
  isLoading: boolean;
  disabled: boolean;
}

export function ActionButtons({ onCreateEvent, isLoading, disabled }: ActionButtonsProps) {
  return (
    <div className="mt-5">
      <button
        onClick={onCreateEvent}
        disabled={disabled || isLoading}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-[#c83f49] px-4 text-[15px] font-semibold text-white transition-colors hover:bg-[#b73540] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b73540] disabled:cursor-not-allowed disabled:opacity-50"
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
