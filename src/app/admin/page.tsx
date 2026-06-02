import { redirect } from "next/navigation";
import { getSession, isAdminEmail } from "@/lib/auth";
import { TopBar } from "@/components/TopBar";
import { AdminPanel } from "@/components/AdminPanel";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdminEmail(session.email)) redirect("/dashboard");

  return (
    <>
      <TopBar name={session.name} isAdmin />
      <AdminPanel />
    </>
  );
}
