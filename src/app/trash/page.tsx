import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { TopBar } from "@/components/TopBar";
import { TrashView } from "@/components/TrashView";

export default async function TrashPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <>
      <TopBar name={session.name} />
      <TrashView />
    </>
  );
}
