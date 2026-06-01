import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { TopBar } from "@/components/TopBar";
import { Conversation } from "@/components/Conversation";

export default async function DreamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;

  return (
    <>
      <TopBar name={session.name} />
      <Conversation dreamId={id} />
    </>
  );
}
