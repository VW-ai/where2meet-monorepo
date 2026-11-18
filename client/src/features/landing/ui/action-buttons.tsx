'use client';

import { defineMessages, useMessages } from '@/shared/lib/i18n';
import { CatLoader } from '@/components/cat/cat-loader';

const messages = defineMessages({
  en: { creating: 'Creating Meeting...', create: 'Create Meeting' },
  zh: { creating: '正在创建…', create: '创建见面' },
});

interface ActionButtonsProps {
  onCreateEvent: () => void;
  isLoading: boolean;
}

export function ActionButtons({ onCreateEvent, isLoading }: ActionButtonsProps) {
  const t = useMessages(messages);
  return (
    <div className="mt-5">
      <button
        onClick={onCreateEvent}
        disabled={isLoading}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-[#c83f49] px-4 text-[15px] font-semibold text-white transition-colors hover:bg-[#b73540] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b73540] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? (
          <>
            <CatLoader size={20} onColor />
            {t.creating}
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
            {t.create}
          </>
        )}
      </button>
    </div>
  );
}
