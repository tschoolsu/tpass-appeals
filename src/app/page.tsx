import Link from "next/link";
import { LogIn } from "lucide-react";
import { requireSession } from "@/lib/guard";
import { tpass, authConfig } from "@/config/auth";
import { listQuestions } from "@/lib/questions";
import { getSettings } from "@/lib/settings";
import { isAdmin } from "@/config/admin";
import { PortalLink } from "@/components/common/PortalLink";
import { AppealForm } from "@/components/AppealForm";

// 登出後的落地畫面。不能在這裡導回登入，否則使用者永遠登不出去。
function LoggedOutNotice() {
  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-50 h-16 bg-background/90 backdrop-blur-md border-b-2 border-foreground/20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-full flex items-center">
          <PortalLink href={authConfig.portalUrl} />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-24 flex flex-col items-center text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-foreground bg-card text-foreground shadow-[4px_4px_0_0_var(--color-foreground)]">
          <LogIn className="h-8 w-8" />
        </span>
        <h1 className="mt-6 font-extrabold text-2xl tracking-tight">您已登出</h1>
        <p className="mt-2 font-medium text-muted-foreground">
          您已安全登出 T-Appeals。要繼續使用申訴系統，請重新登入。
        </p>
        <a
          href={authConfig.loginUrl}
          className="mt-6 inline-flex items-center gap-2.5 rounded-xl border-2 border-foreground bg-primary px-4 py-2 font-bold text-primary-foreground shadow-[3px_3px_0_0_var(--color-foreground)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_var(--color-foreground)] active:translate-y-0 active:shadow-[2px_2px_0_0_var(--color-foreground)]"
        >
          使用學校帳號登入
        </a>
      </main>
    </div>
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ logout?: string }>;
}) {
  // 剛登出（auth 導回來帶 ?logout=1）時不能再導去登入，否則會被立刻彈回去、等於登不出去。
  // logout=1 只是畫面提示、不是憑證，所以仍要確認 session 真的無效才採信。
  const { logout } = await searchParams;
  if (logout === "1" && !(await tpass.getSession())) return <LoggedOutNotice />;

  const session = await requireSession("/");
  const [questions, settings, admin] = await Promise.all([
    listQuestions(),
    getSettings(),
    isAdmin(session),
  ]);

  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-50 h-16 bg-background/90 backdrop-blur-md border-b-2 border-foreground/20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between">
          <PortalLink href={authConfig.portalUrl} />
          <div className="flex items-center gap-3">
            {admin && (
              <Link
                href="/admin"
                className="rounded-md border-2 border-foreground bg-primary px-2.5 py-1 font-mono text-[11px] font-bold text-primary-foreground shadow-[2px_2px_0_0_var(--color-foreground)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[3px_3px_0_0_var(--color-foreground)]"
              >
                管理後台
              </Link>
            )}
            <form method="post" action={authConfig.logoutUrl}>
              <button
                type="submit"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-200"
              >
                登出
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-8">
        <AppealForm
          title={settings.title}
          introText={settings.introText}
          acceptingResponses={settings.acceptingResponses}
          questions={questions}
          identityNotice={`以 ${session.name}（${session.email}）身分送出`}
        />
      </main>
    </div>
  );
}
