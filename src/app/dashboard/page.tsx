import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { TopBar } from "@/components/TopBar";
import { Dashboard } from "@/components/Dashboard";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <>
      <TopBar name={session.name} />
      <Dashboard />
    </>
  );
}
