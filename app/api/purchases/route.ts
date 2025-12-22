import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { cookies } from "next/headers";

async function getUserFromSession(appSession?: string | undefined | null) {
  if (!appSession) return null;

  const { rows } = await sql`
    SELECT users.id
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token = ${appSession}
      AND sessions.expires_at > NOW()
    LIMIT 1;
  `;
  return rows[0] ?? null;
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("app_session");
    const user = await getUserFromSession(sessionCookie?.value);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const printId = body?.printId?.toString();
    const quantity = Number(body?.quantity ?? 1);

    if (!printId || Number.isNaN(quantity) || quantity < 1) {
      return NextResponse.json(
        { error: "Invalid print or quantity." },
        { status: 400 }
      );
    }

    const printResult = await sql`
      SELECT id, price, quantity, size
      FROM prints
      WHERE id = ${printId}
      LIMIT 1;
    `;

    if (!printResult.rowCount) {
      return NextResponse.json({ error: "Print not found." }, { status: 404 });
    }

    const print = printResult.rows[0];
    const available = Number(print.quantity ?? 0);
    if (available < quantity) {
      return NextResponse.json(
        { error: "Not enough quantity available." },
        { status: 400 }
      );
    }

    const total = Number(print.price) * quantity;

    // Reserve and create order
    await sql`BEGIN`;
    const updateQuantity = await sql`
      UPDATE prints
      SET quantity = quantity - ${quantity}
      WHERE id = ${printId} AND quantity >= ${quantity}
      RETURNING id;
    `;

    if (!updateQuantity.rowCount) {
      await sql`ROLLBACK`;
      return NextResponse.json(
        { error: "Not enough quantity available." },
        { status: 400 }
      );
    }

    const orderInsert = await sql`
      INSERT INTO orders (user_id, status, total_amount, currency)
      VALUES (${user.id}, 'pending', ${total}, 'cad')
      RETURNING id;
    `;
    const orderId = orderInsert.rows[0].id;

    await sql`
      INSERT INTO order_items (order_id, print_id, quantity, unit_price)
      VALUES (${orderId}, ${printId}, ${quantity}, ${print.price});
    `;

    await sql`
      INSERT INTO print_inventory_events (print_id, delta, reason, order_id)
      VALUES (${printId}, ${-quantity}, 'sale', ${orderId});
    `;

    await sql`COMMIT`;

    return NextResponse.json({ ok: true, orderId });
  } catch (error) {
    console.error("Purchase error", error);
    try {
      await sql`ROLLBACK`;
    } catch {}
    return NextResponse.json({ error: "Purchase failed." }, { status: 500 });
  }
}
