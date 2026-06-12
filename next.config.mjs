/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Service worker + manifest are served from /public (PWA wired in Phase 8).
  //
  // NOTE: this repo lives on an exFAT volume locally (F:), which has no symlink
  // support, so a local `next build` (webpack/nft) throws EISDIR on readlink.
  // Local dev uses `next dev --turbopack` (works on exFAT). Production builds run
  // on Railway's Linux filesystem where readlink behaves normally — no hacks needed.
};

export default nextConfig;
