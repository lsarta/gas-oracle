export { sql, createClient, createPool, db } from "@vercel/postgres";

export type Station = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  current_price_per_gallon: number | null;
  last_priced_at: Date | null;
  created_at: Date;
};

export type Report = {
  id: string;
  station_id: string;
  user_wallet: string;
  transaction_amount_usd: number;
  gallons: number | null;
  computed_price_per_gallon: number | null;
  freshness_score: number | null;
  payout_amount_usdc: number | null;
  payout_tx_hash: string | null;
  created_at: Date;
};

export type User = {
  id: string;
  privy_user_id: string;
  email: string | null;
  wallet_address: string;
  total_earned_usdc: number;
  total_saved_usd: number;
  home_lat: number | null;
  home_lng: number | null;
  created_at: Date;
};

export type OracleQuery = {
  id: string;
  caller_address: string;
  query_params: Record<string, unknown>;
  response_payload: Record<string, unknown>;
  amount_paid_usdc: number;
  payment_tx_id: string | null;
  created_at: Date;
};
