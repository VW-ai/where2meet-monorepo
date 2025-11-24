'use client';

export function MapArea() {
  return (
    <main className="w-full h-full bg-gradient-to-br from-sky-50 via-coral-50/30 to-mint-50/30 relative overflow-hidden">
      {/* Background Pattern */}
      <div
        className="absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage: `
            radial-gradient(circle at 25px 25px, rgba(255, 107, 107, 0.2) 2%, transparent 0%),
            radial-gradient(circle at 75px 75px, rgba(107, 203, 119, 0.15) 2%, transparent 0%)
          `,
          backgroundSize: '100px 100px',
        }}
      />

      {/* Map Placeholder Content */}
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
