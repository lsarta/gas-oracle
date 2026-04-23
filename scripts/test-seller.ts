import express from "express";
import { privateKeyToAccount } from "viem/accounts";
import { createGatewayMiddleware } from "@circle-fin/x402-batching/server";

const PORT = 3100;

async function main() {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) throw new Error("PRIVATE_KEY missing from environment");

  const seller = privateKeyToAccount(pk as `0x${string}`);
  const sellerAddress = seller.address;

  const app = express();

  const gateway = createGatewayMiddleware({
    sellerAddress,
    networks: "eip155:5042002",
    facilitatorUrl: "https://gateway-api-testnet.circle.com",
  });

  app.get(
    "/test-paid-endpoint",
    gateway.require("$0.001") as express.RequestHandler,
    (req: express.Request, res: express.Response) => {
      const payment = (req as any).payment;
      console.log(
        `[paid] payer=${payment?.payer} amount=${payment?.amount} network=${payment?.network} tx=${payment?.transaction ?? "n/a"}`,
      );
      res.json({
        message: "you paid for this",
        paidBy: payment?.payer,
        amount: payment?.amount,
        network: payment?.network,
        timestamp: new Date().toISOString(),
      });
    },
  );

  app.listen(PORT, () => {
    console.log("=".repeat(60));
    console.log(`Gyas test-seller listening on http://localhost:${PORT}`);
    console.log(`Seller address: ${sellerAddress}`);
    console.log(`Network: Arc Testnet (eip155:5042002)`);
    console.log(`Facilitator: https://gateway-api-testnet.circle.com`);
    console.log(`Paid route: GET /test-paid-endpoint  ($0.001)`);
    console.log("=".repeat(60));
  });
}

main().catch((err) => {
  console.error("[test-seller] failed to start:");
  console.error(err);
  process.exit(1);
});
