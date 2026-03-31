import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: ["rzzzmziuamvkqqlinzha.supabase.co", "picsum.photos"],
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos", pathname: "/**" },
      {
        protocol: "https",
        hostname: "rzzzmziuamvkqqlinzha.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
