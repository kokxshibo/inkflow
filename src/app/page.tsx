import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isDatabaseReady, areMigrationsApplied } from "@/lib/health";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  if (!(await isDatabaseReady()) || !(await areMigrationsApplied())) {
    redirect("/installation");
  }

  const session = await getSession();
  redirect(session ? "/tableau-de-bord" : "/login");
}
