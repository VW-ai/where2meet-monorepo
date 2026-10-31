import { loadCatalog } from '@/features/blog/lib/source';
import { homeGuides } from '@/features/landing/lib/home-guides';
import { HomeSections } from '@/features/landing/ui/home-sections';
import { LandingView } from '@/features/landing/ui/landing-view';

export default async function LandingPage() {
  const guides = homeGuides(await loadCatalog());
  return (
    <LandingView>
      <HomeSections guides={guides} />
    </LandingView>
  );
}
