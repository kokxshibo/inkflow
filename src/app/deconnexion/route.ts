import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

export async function GET() {
  await destroySession();
  // Adresse relative : correcte derrière nginx, quel que soit le domaine.
  return new NextResponse(null, { status: 307, headers: { Location: "/login" } });
}
