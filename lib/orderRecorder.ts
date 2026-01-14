import { sql } from "@vercel/postgres";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { adjustPrintStock } from "@/lib/locationStock";

type RecordResult =
  | { ok: true; orderId: string }
  | { ok: false; error: string };

function deriveTotals(full: Stripe.Checkout.Session) {
  const metadata = full.metadata ?? {};
  const grossMeta = Number(metadata.grossTotal ?? 0);
  const hstMeta = Number(metadata.hstCollected ?? 0);
  const netMeta = Number(metadata.netTotal ?? 0);

  const lineItems = full.line_items?.data ?? [];
  const grossFromLines = lineItems.reduce((sum, item) => {
    const qty = Number(item.quantity ?? 0);
    const unitPrice = Number(item.price?.unit_amount ?? 0) / 100;
    return sum + unitPrice * qty;
  }, 0);

  const grossTotal = Number.isFinite(grossMeta) && grossMeta > 0 ? grossMeta : grossFromLines;
  const hstCollected = Number.isFinite(hstMeta) ? hstMeta : 0;
  const netTotal = Number.isFinite(netMeta) && netMeta > 0 ? netMeta : grossTotal - hstCollected;

  return { grossTotal, hstCollected, netTotal };
}

export async function recordOrderFromSessionId(sessionId: string): Promise<RecordResult> {
  let full: Stripe.Checkout.Session;
  try {
    full = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items.data.price.product"],
    });
  } catch (err) {
    console.error("[orderRecorder] failed to retrieve session", sessionId, err);
    return { ok: false, error: "session_retrieve_failed" };
  }
  return recordOrderFromSession(full);
}

export async function recordOrderFromSession(full: Stripe.Checkout.Session): Promise<RecordResult> {
  if (!full?.id) {
    return { ok: false, error: "missing_session_id" };
  }

  // Some webhook payloads may omit shipping/customer details; ensure we have a fully populated session.
  let hydrated = full;
  const lineItemsPresent = Array.isArray(hydrated.line_items?.data) && hydrated.line_items.data.length > 0;
  const hasProductMeta =
    lineItemsPresent &&
    hydrated.line_items!.data.every(
      (item) =>
        (item.price as any)?.product?.metadata?.printId ||
        (item.price as any)?.product_data?.metadata?.printId
    );

  if (!hydrated.shipping_details || !hydrated.customer_details || !lineItemsPresent || !hasProductMeta) {
    try {
      hydrated = await stripe.checkout.sessions.retrieve(full.id, {
        expand: ["line_items.data.price.product"],
      });
    } catch (err) {
      console.error("[orderRecorder] failed to hydrate session", full.id, err);
    }
  }

  const sessionId = hydrated.id;
  const paymentIntentId = (hydrated.payment_intent as string | null) ?? null;
  const metadata = hydrated.metadata ?? {};
  const metadataPhone = (metadata.customerPhone ?? "").toString().trim() || null;
  const lineItems = hydrated.line_items?.data ?? [];
  const parsedItems: { printId: string; quantity: number; unitPrice: number }[] = [];

  for (const item of lineItems) {
    const qty = Number(item.quantity ?? 0);
    const unitPrice = Number(item.price?.unit_amount ?? 0) / 100;
    const printId =
      (item.price as any)?.product?.metadata?.printId ||
      (item.price as any)?.product_data?.metadata?.printId ||
      null;
    if (qty > 0 && unitPrice >= 0 && printId) {
      parsedItems.push({
        printId: String(printId),
        quantity: qty,
        unitPrice,
      });
    }
  }

  if (!parsedItems.length && metadata.items) {
    try {
      const metaItems = JSON.parse(String(metadata.items));
      if (Array.isArray(metaItems)) {
        for (const item of metaItems) {
          const printId = item?.printId?.toString();
          const quantity = Number(item?.quantity ?? 0);
          const unitPrice = Number(item?.unitPrice ?? 0);
          if (printId && quantity > 0) {
            parsedItems.push({
              printId,
              quantity,
              unitPrice: Number.isFinite(unitPrice) && unitPrice > 0 ? unitPrice : 0,
            });
          }
        }
      }
    } catch {
      // ignore
    }
  }

  if (!parsedItems.length) {
    console.error("[orderRecorder] missing line items", { sessionId });
    return { ok: false, error: "missing_items" };
  }

  const { grossTotal, hstCollected, netTotal } = deriveTotals(hydrated);

  const shippingDetails = hydrated.shipping_details;
  const customerDetails = hydrated.customer_details;
  const fullName = shippingDetails?.name || customerDetails?.name || "";
  const nameParts = fullName.trim().split(/\s+/);
  const customerFirstName = nameParts.shift() || null;
  const customerLastName = nameParts.join(" ") || null;
  const customerPhone = shippingDetails?.phone || customerDetails?.phone || metadataPhone;
  const customerEmail = customerDetails?.email || null;
  const shipAddress1 = shippingDetails?.address?.line1 || customerDetails?.address?.line1 || null;
  const shipAddress2 = shippingDetails?.address?.line2 || customerDetails?.address?.line2 || null;
  const shipCity = shippingDetails?.address?.city || customerDetails?.address?.city || null;
  const shipProvince = shippingDetails?.address?.state || customerDetails?.address?.state || null;
  const shipPostal = shippingDetails?.address?.postal_code || customerDetails?.address?.postal_code || null;
  const shipCountry = shippingDetails?.address?.country || customerDetails?.address?.country || null;

  try {
    await sql`BEGIN`;

    const existing = await sql<{
      id: string;
      customer_first_name: string | null;
      customer_last_name: string | null;
      customer_email: string | null;
      customer_phone: string | null;
      ship_address1: string | null;
    }>`
      SELECT id, customer_first_name, customer_last_name, customer_email, customer_phone, ship_address1
      FROM orders
      WHERE stripe_checkout_session_id = ${sessionId}
         OR stripe_payment_intent_id = ${paymentIntentId}
      LIMIT 1;
    `;
    if (existing.rowCount) {
      const existingOrder = existing.rows[0];
      const needsCustomerUpdate =
        customerEmail ||
        customerFirstName ||
        customerLastName ||
        customerPhone ||
        shipAddress1;
      if (needsCustomerUpdate) {
        await sql`
          UPDATE orders
          SET
            customer_email = COALESCE(${customerEmail}, customer_email),
            customer_first_name = COALESCE(${customerFirstName}, customer_first_name),
            customer_last_name = COALESCE(${customerLastName}, customer_last_name),
            customer_phone = COALESCE(${customerPhone}, customer_phone),
            ship_address1 = COALESCE(${shipAddress1}, ship_address1),
            ship_address2 = COALESCE(${shipAddress2}, ship_address2),
            ship_city = COALESCE(${shipCity}, ship_city),
            ship_province = COALESCE(${shipProvince}, ship_province),
            ship_postal = COALESCE(${shipPostal}, ship_postal),
            ship_country = COALESCE(${shipCountry}, ship_country),
            updated_at = NOW()
          WHERE id = ${existingOrder.id};
        `;
      }
      await sql`COMMIT`;
      return { ok: true, orderId: existingOrder.id };
    }

    const orderInsert = await sql`
      INSERT INTO orders (
        user_id,
        status,
        total_amount,
        currency,
        gross_amount,
        hst_collected,
        stripe_checkout_session_id,
        stripe_payment_intent_id,
        customer_email,
        customer_first_name,
        customer_last_name,
        customer_phone,
        ship_address1,
        ship_address2,
        ship_city,
        ship_province,
        ship_postal,
        ship_country
      )
      VALUES (
        NULL,
        'paid',
        ${netTotal},
        'cad',
        ${grossTotal},
        ${hstCollected},
        ${sessionId},
        ${paymentIntentId},
        ${customerEmail},
        ${customerFirstName},
        ${customerLastName},
        ${customerPhone},
        ${shipAddress1},
        ${shipAddress2},
        ${shipCity},
        ${shipProvince},
        ${shipPostal},
        ${shipCountry}
      )
      RETURNING id;
    `;

    const orderId = orderInsert.rows[0]?.id as string;

    for (const item of parsedItems) {
      try {
        await adjustPrintStock({
          printId: item.printId,
          delta: -item.quantity,
          reason: "sale",
          orderId,
        });
      } catch (err) {
        // Log but continue creating the order so checkout completion does not fail.
        console.error("[orderRecorder] inventory adjust failed; recording order anyway", {
          printId: item.printId,
          quantity: item.quantity,
          err,
        });
      }

      await sql`
        INSERT INTO order_items (order_id, print_id, quantity, unit_price)
        VALUES (${orderId}, ${item.printId}, ${item.quantity}, ${item.unitPrice});
      `;
    }

    await sql`COMMIT`;
    console.log("[orderRecorder] order recorded", { orderId, paymentIntentId, items: parsedItems.length });
    return { ok: true, orderId };
  } catch (error) {
    try {
      await sql`ROLLBACK`;
    } catch {}
    console.error("[orderRecorder] processing error", error);
    return { ok: false, error: "processing_error" };
  }
}
