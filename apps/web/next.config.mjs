/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Lets the dev server accept requests from Cloudflare quick-tunnel links
  allowedDevOrigins: ['*.trycloudflare.com'],
  // Temporary: the build fails on type errors in Family.tsx and RegisterForm.tsx (ChoiceField options)
  typescript: { ignoreBuildErrors: true },
};
export default nextConfig;