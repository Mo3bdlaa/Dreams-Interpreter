import { SharedDream } from "@/components/SharedDream";

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <SharedDream token={token} />;
}
