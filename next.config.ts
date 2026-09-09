import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Prisma client is generated into src/generated/prisma and loads its
  // native query engine (*.so.node) dynamically, so @vercel/nft misses it
  // when tracing files for the serverless bundle. Force it into every trace.
  outputFileTracingIncludes: {
    "/*": ["./src/generated/prisma/**/*"],
  },
};

export default nextConfig;
