import { NextResponse } from "next/server";
import { portfolioAssetSchema } from "@/features/portfolio/submission";
import { createClient } from "@/server/supabase/client";

const privateHeaders = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Origem inválida." }, { status: 403, headers: privateHeaders });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401, headers: privateHeaders });
  }

  const input = await request.json().catch(() => null);
  const parsed = portfolioAssetSchema.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Revise os dados do ativo e tente novamente." },
      { status: 400, headers: privateHeaders },
    );
  }

  const { data, error } = await supabase.rpc("create_portfolio_asset", {
    p_institution_name: parsed.data.institutionName,
    p_symbol: parsed.data.symbol,
    p_name: parsed.data.name,
    p_asset_class: parsed.data.assetClass,
    p_quantity: parsed.data.quantity,
    p_unit_price: parsed.data.unitPrice,
    p_fees: parsed.data.fees,
    p_trade_date: parsed.data.tradeDate,
  });

  if (error) {
    const duplicate = error.code === "23505";
    return NextResponse.json(
      { error: duplicate ? "Este ativo já existe nessa instituição." : "Não foi possível adicionar o ativo agora." },
      { status: duplicate ? 409 : 500, headers: privateHeaders },
    );
  }

  return NextResponse.json({ id: data }, { status: 201, headers: privateHeaders });
}
