/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@vault/shared'],
  // Turbopack (dev) — empty config silences the warning; WASM is supported natively
  turbopack: {},
  // Webpack (production build) — enable WASM and browser fallbacks for XMTP
  webpack: (config, { isServer }) => {
    config.experiments = { ...config.experiments, asyncWebAssembly: true }
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      }
    }
    return config
  },
}

export default nextConfig
