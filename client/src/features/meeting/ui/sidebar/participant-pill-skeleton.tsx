'use client';

export function ParticipantPillSkeleton() {
  return (
    <div className="relative w-full py-2 pl-6 pr-1">
      <div className="relative z-10 flex items-center animate-pulse">
        {/* Tail skeleton */}
        <div className="absolute -left-5 bottom-2 z-0 w-12 h-12">
          <div className="w-full h-full bg-border/30 rounded-full" />
        </div>

        {/* Main pill container skeleton */}
        <div className="flex-1 flex items-center justify-between bg-white border-2 border-border rounded-2xl px-4 py-2.5 shadow-sm">
          {/* Left side - Info skeleton */}
          <div className="flex flex-col gap-1.5 min-w-0 flex-1 mr-4">
            {/* Name skeleton */}
            <div className="h-4 bg-gray-200 rounded w-24" />
            {/* Address skeleton */}
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-gray-200 rounded" />
              <div className="h-3 bg-gray-200 rounded w-32" />
            </div>
          </div>

          {/* Right side - Avatar skeleton */}
          <div className="relative flex-shrink-0">
            <div className="relative z-10 w-10 h-10 rounded-full bg-gray-200" />
          </div>

          {/* Feet skeleton */}
          <div className="absolute -bottom-1.5 left-8 flex gap-4">
            <div className="w-2.5 h-1.5 rounded-b-full bg-gray-200" />
            <div className="w-2.5 h-1.5 rounded-b-full bg-gray-200" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ParticipantListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <ParticipantPillSkeleton key={index} />
      ))}
    </div>
  );
}
