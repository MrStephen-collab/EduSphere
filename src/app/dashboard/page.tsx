import { redirect } from "next/navigation";
import { getAuthContext, redirectToRoleHome } from "@/lib/auth/auth-context";

export default async function DashboardPage() {
  const context = await getAuthContext();
  if (!context.user) {
    redirect("/auth/login");
  }
  redirectToRoleHome(context);
}