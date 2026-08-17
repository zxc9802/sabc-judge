import { getCompany, saveCompany } from "@/lib/store";
import { NextResponse } from "next/server";

export async function GET() {
  const c = getCompany();
  return NextResponse.json(c);
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    mainBusiness?: string;
    teamCapability?: string;
    resources?: string;
    strategy?: string;
    redLines?: string;
  };
  saveCompany({
    mainBusiness: body.mainBusiness || "",
    teamCapability: body.teamCapability || "",
    resources: body.resources || "",
    strategy: body.strategy || "",
    redLines: body.redLines || "",
  });
  return NextResponse.json({ ok: true });
}
