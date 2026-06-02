import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { TopBar } from "@/components/TopBar";
import { CalendarView } from "@/components/CalendarView";

export default async function CalendarPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <>
      <TopBar name={session.name} />
      <CalendarView />
    </>
  );
}
