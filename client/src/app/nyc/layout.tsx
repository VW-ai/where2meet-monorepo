import { themeFontVariables } from '@/features/nyc-map/ui/fonts';

export default function NycLayout({ children }: { children: React.ReactNode }) {
  return <div className={themeFontVariables}>{children}</div>;
}
