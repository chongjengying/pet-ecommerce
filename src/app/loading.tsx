import { PetLogoLoader } from "@/components/ui/PetLogoLoader";

/** Full-page loading while Next.js resolves a route segment */
export default function RootLoading() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center bg-gradient-to-b from-cream via-cream to-amber-50/30 px-4 py-16">
      <PetLogoLoader label="Loading Pawluxe…" size="lg" />
    </div>
  );
}
