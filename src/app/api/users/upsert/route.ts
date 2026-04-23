import { sql } from "@/lib/db/client";

type Body = {
  privyUserId?: string;
  email?: string | null;
  walletAddress?: string;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { privyUserId, email, walletAddress } = body;
  if (!privyUserId || !walletAddress) {
    return Response.json(
      { error: "privyUserId and walletAddress are required" },
      { status: 400 },
    );
  }

  try {
    const result = await sql`
      INSERT INTO users (privy_user_id, email, wallet_address)
      VALUES (${privyUserId}, ${email ?? null}, ${walletAddress})
      ON CONFLICT (privy_user_id) DO UPDATE
        SET email = EXCLUDED.email,
            wallet_address = EXCLUDED.wallet_address
      RETURNING *
    `;
    return Response.json({ user: result.rows[0] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unexpected error";
    console.error("[/api/users/upsert] failed:", err);
    return Response.json({ error: message }, { status: 500 });
  }
}
