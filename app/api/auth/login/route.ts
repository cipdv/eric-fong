import { NextResponse } from "next/server";
import { userStore } from "../store";

export async function POST(request: Request) {
  const body = await request.json();
  const { email, password } = body ?? {};

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 }
    );
  }

  const user = userStore.find(
    (entry) =>
      entry.email.toLowerCase() === String(email).toLowerCase() &&
      entry.password === password
  );

  if (!user) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    "app_user",
    JSON.stringify({ firstName: user.firstName, email: user.email }),
    {
      httpOnly: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    }
  );
  return response;
}
