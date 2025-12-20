import { cookies } from "next/headers";

export default function DashboardPage() {
  const cookieStore = cookies();
  const userCookie = cookieStore.get("app_user");
  const payload = userCookie ? JSON.parse(userCookie.value) : null;
  const firstName = payload?.firstName ?? "friend";

  return (
    <div className="pb-12">
      <h1 className="text-3xl font-semibold text-neutral-900">
        Hi {firstName}
      </h1>
    </div>
  );
}
