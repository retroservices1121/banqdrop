// The app (onboarding + dashboard) is phone-width. The marketing landing at "/" is
// full-width, so the max-width constraint lives here on the /app route, not globally.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto min-h-screen w-full max-w-md">{children}</div>;
}
