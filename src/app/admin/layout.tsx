// /admin 守門：未登入 → 導 login；登入但非管理員 → 顯示 Forbidden（不渲染後台）。
import { redirect } from "next/navigation";
import { tpass, loginUrlFor } from "@/config/auth";
import { isAdmin, isSuperAdmin } from "@/config/admin";
import { AdminShell } from "@/components/admin/AdminShell";
import { Forbidden } from "@/components/common/Forbidden";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await tpass.getSession();
  if (!session) redirect(loginUrlFor("/admin"));

  if (!isAdmin(session)) {
    return <Forbidden />;
  }

  return (
    <AdminShell email={session.email} superAdmin={isSuperAdmin(session)}>
      {children}
    </AdminShell>
  );
}
