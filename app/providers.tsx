"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { getDefaultConfig, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { mainnet, sepolia, polygon, arbitrum, base } from "wagmi/chains";
import { defineChain } from "viem";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

// Define Base Sepolia testnet
const baseSepolia = defineChain({
  id: 84532,
  name: 'Base Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: {
      http: ['https://sepolia.base.org'],
    },
    public: {
      http: ['https://sepolia.base.org'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Basescan',
      url: 'https://sepolia.basescan.org',
    },
  },
  testnet: true,
});

const config = getDefaultConfig({
  appName: "Paena",
  projectId: "9eba1cc09557dcaa6afb1cb7e963aac4",
  chains: [mainnet, sepolia, polygon, arbitrum, base, baseSepolia],
  ssr: true,
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  // Suppress WalletConnect session errors (stale session topics)
  useEffect(() => {
    const originalError = console.error;
    const originalWarn = console.warn;
    
    console.error = (...args: any[]) => {
      const errorMessage = args[0]?.toString() || "";
      if (
        errorMessage.includes("No matching key") ||
        errorMessage.includes("session topic doesn't exist") ||
        errorMessage.includes("isValidSessionTopic")
      ) {
        // Silently ignore WalletConnect session errors - these are harmless
        return;
      }
      originalError(...args);
    };

    console.warn = (...args: any[]) => {
      const warnMessage = args[0]?.toString() || "";
      if (warnMessage.includes("session topic")) {
        // Ignore session topic warnings
        return;
      }
      originalWarn(...args);
    };

    return () => {
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, []);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
