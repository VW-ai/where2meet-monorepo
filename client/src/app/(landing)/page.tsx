import { loadCatalog } from '@/features/blog/lib/source';
import { homeGuides } from '@/features/landing/lib/home-guides';
import { HomeSections } from '@/features/landing/ui/home-sections';
import { LandingView } from '@/features/landing/ui/landing-view';
import { OpeningIntro } from '@/features/portal/ui/opening-intro';

export default async function LandingPage() {
  const guides = homeGuides(await loadCatalog());
  return (
    <>
      <OpeningIntro />
      <LandingView>
        <HomeSections guides={guides} />
      </LandingView>
    </>
  );
}
