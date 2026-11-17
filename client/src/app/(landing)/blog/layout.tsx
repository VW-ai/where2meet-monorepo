import { SiteFooter } from '@/features/landing/ui/site-footer';
import { SiteHeader } from '@/features/landing/ui/site-header';

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#eef1f4] text-[#21252b]">
      <SiteHeader className="mx-auto max-w-4xl px-4 pt-4 sm:pt-5" />
      <main className="mx-auto max-w-4xl px-4 pb-12 pt-8">{children}</main>
      <SiteFooter className="mx-auto max-w-4xl px-4 pb-8" />
    </div>
  );
}
