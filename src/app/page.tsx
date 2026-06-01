import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function Home() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center px-6 text-center">
      <div className="animate-fade-in">
        <div className="mb-6 text-6xl">🌙</div>
        <h1 className="mb-4 text-4xl font-bold sm:text-5xl">مُعبِّر الأحلام</h1>
        <p className="mx-auto mb-8 max-w-xl text-lg leading-relaxed text-night-100/80">
          احكِ حلمك، واحصل على تفسير مستند إلى كتب تفسير الأحلام الإسلامية
          (ابن سيرين، النابلسي). كل حلم محادثة مستقلة، تُحفظ بتاريخها، مع لوحة
          متابعة وملخص عام لرحلتك مع الأحلام — وتقدر تتكلم بدل ما تكتب. 🎤
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/register" className="btn-primary px-6 text-lg">
            ابدأ الآن
          </Link>
          <Link href="/login" className="btn-ghost px-6 text-lg">
            تسجيل الدخول
          </Link>
        </div>

        <div className="mt-14 grid gap-4 text-start sm:grid-cols-3">
          <Feature icon="💬" title="كل حلم محادثة">
            استوضح، اسأل، وتعمّق في تفسير كل حلم على حدة.
          </Feature>
          <Feature icon="📅" title="تتبّع بالتواريخ">
            احفظ أحلامك بتواريخها، حتى لو حلمت بها سابقاً.
          </Feature>
          <Feature icon="📊" title="ملخص عام">
            أنماط متكررة، رموز شائعة، ومزاج أحلامك في لوحة واحدة.
          </Feature>
        </div>
      </div>
    </main>
  );
}

function Feature({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-5">
      <div className="mb-2 text-2xl">{icon}</div>
      <h3 className="mb-1 font-bold">{title}</h3>
      <p className="text-sm text-night-100/70">{children}</p>
    </div>
  );
}
