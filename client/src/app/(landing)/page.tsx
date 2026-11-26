import { loadCatalog } from '@/features/blog/lib/source';
import { homeCities } from '@/features/landing/lib/home-cities';
import { CityTiles } from '@/features/landing/ui/city-tiles';
import { LandingView } from '@/features/landing/ui/landing-view';
import { OpeningIntro } from '@/features/portal/ui/opening-intro';

export default async function LandingPage() {
  const cities = homeCities(await loadCatalog());
  return (
    <>
      <OpeningIntro />
      <LandingView>
        <CityTiles cities={cities} />
      </LandingView>
    </>
  );
}
