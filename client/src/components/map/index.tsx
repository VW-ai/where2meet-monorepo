'use client';

export function MapArea() {
  return (
    <main
      className="
      flex-1
      h-1/2 md:h-full
      bg-gray-50
      relative
      overflow-hidden
    "
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center space-y-4 p-8">
          <div className="text-6xl">🗺️</div>
          <h3 className="text-xl font-semibold text-foreground">Map Area</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Google Maps integration will be implemented here.
            <br />
            This will show participant markers, venue markers, MEC circle, and routes.
          </p>
        </div>
      </div>
    </main>
  );
}
