import { NextResponse } from "next/server";
import { userStore } from "../store";

export async function POST(request: Request) {
  const body = await request.json();
  const { firstName, lastName, email, password } = body ?? {};

  if (!firstName || !lastName || !email || !password) {
    return NextResponse.json(
      { error: "All fields are required." },
      { status: 400 }
    );
  }

  const existing = userStore.find(
    (user) => user.email.toLowerCase() === String(email).toLowerCase()
  );
  if (existing) {
    return NextResponse.json(
      { error: "User with that email already exists." },
      { status: 400 }
    );
  }

  userStore.push({ firstName, lastName, email, password });

  const response = NextResponse.json({ ok: true });
  response.cookies.set("app_user", JSON.stringify({ firstName, email }), {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
