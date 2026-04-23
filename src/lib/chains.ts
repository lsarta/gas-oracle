import { defineChain } from "viem";

// Arc Testnet — Circle's stablecoin-native L1 (gas paid in USDC, not ETH).
// Source: viem ships an arcTestnet definition (node_modules/viem/_esm/chains/definitions/arcTestnet.js).
// We mirror it here so app code has a single import surface for chain config + Circle contracts.
export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        "https://rpc.testnet.arc.network",
        "https://rpc.quicknode.testnet.arc.network",
        "https://rpc.blockdaemon.testnet.arc.network",
      ],
      webSocket: [
        "wss://rpc.testnet.arc.network",
        "wss://rpc.quicknode.testnet.arc.network",
      ],
    },
  },
  blockExplorers: {
    default: {
      name: "ArcScan",
      url: "https://testnet.arcscan.app",
      apiUrl: "https://testnet.arcscan.app/api",
    },
  },
  contracts: {
    multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11", blockCreated: 0 },
  },
  testnet: true,
});

// Source: @circle-fin/x402-batching/dist/client/index.js (CHAIN_CONFIGS.arcTestnet).
export const USDC_ADDRESS_ARC_TESTNET =
  "0x3600000000000000000000000000000000000000" as const;

// TESTNET_GATEWAY_WALLET, shared across all Circle Gateway testnet chains.
export const GATEWAY_WALLET_ADDRESS_ARC_TESTNET =
  "0x0077777d7EBA4688BDeF3E311b846F25870A19B9" as const;
