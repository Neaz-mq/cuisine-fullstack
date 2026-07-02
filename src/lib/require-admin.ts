import { auth } from "@/auth";
import { redirect } from "next/navigation";

export async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if ((session.user as { role?: string }).role !== "ADMIN") redirect("/");
  return session;
}