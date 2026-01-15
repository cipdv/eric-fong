import { sql } from "@vercel/postgres";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { adjustPrintStock } from "@/lib/locationStock";
import nodemailer from "nodemailer";

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

function getPrintIdFromLineItem(item: Stripe.LineItem) {
  const price = item.price as Stripe.Price & {
    product?: Stripe.Product | Stripe.DeletedProduct | string | null;
    product_data?: { metadata?: Record<string, string> | null };
  };
  const productMeta =
    price?.product &&
    typeof price.product !== "string" &&
    "metadata" in price.product
      ? price.product.metadata
      : undefined;
  const productDataMeta = price?.product_data?.metadata ?? undefined;
  return productMeta?.printId || productDataMeta?.printId || null;
}

async function sendOrderNotification(params: {
  orderId: string;
  items: { printId: string; quantity: number; unitPrice: number }[];
  totalAmount: number;
  customer: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    address1: string | null;
    address2: string | null;
    city: string | null;
    province: string | null;
    postal: string | null;
    country: string | null;
  };
}) {
  const toAddress = process.env.CONTACT_EMAIL_TO;
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;

  if (!toAddress || !host || !user || !pass) {
    return;
  }

  const idsParam = params.items.map((item) => item.printId) as unknown as string;
  const { rows } = await sql<{
    id: string;
    size: string | null;
    title: string | null;
  }>`
    SELECT prints.id, prints.size, paintings.title
    FROM prints
    LEFT JOIN paintings ON paintings.id = prints.painting_id
    WHERE prints.id = ANY(${idsParam}::uuid[]);
  `;
  const printMap = new Map(rows.map((row) => [String(row.id), row]));

  const itemLines = params.items.map((item) => {
    const meta = printMap.get(item.printId);
    const title = meta?.title || "Print";
    const size = meta?.size ? ` (${meta.size})` : "";
    return `${title}${size} x${item.quantity} @ $${item.unitPrice.toLocaleString("en-CA")}`;
  });

  const customerName = [params.customer.firstName, params.customer.lastName]
    .filter(Boolean)
    .join(" ");
  const addressLines = [
    params.customer.address1,
    params.customer.address2,
    [params.customer.city, params.customer.province].filter(Boolean).join(", "),
    [params.customer.postal, params.customer.country].filter(Boolean).join(" "),
  ]
    .filter((line) => Boolean(line && line.trim()))
    .join("\n");

  const textBody = [
    `New print order: ${params.orderId}`,
    "",
    "Customer",
    `Name: ${customerName || "N/A"}`,
    `Email: ${params.customer.email || "N/A"}`,
    `Phone: ${params.customer.phone || "N/A"}`,
    addressLines ? `Address:\n${addressLines}` : "Address: N/A",
    "",
    "Items",
    ...itemLines,
    "",
    `Total: $${params.totalAmount.toLocaleString("en-CA")}`,
  ].join("\n");

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: toAddress,
    to: toAddress,
    replyTo: params.customer.email || undefined,
    subject: `New print order ${params.orderId}`,
    text: textBody,
  });
}

export async function recordOrderFromSessionId(sessionId: string): Promise<RecordResult> {
  const stripe = getStripe();
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

  const stripe = getStripe();
  // Some webhook payloads may omit shipping/customer details; ensure we have a fully populated session.
  let hydrated = full;
  const lineItemsPresent = Array.isArray(hydrated.line_items?.data) && hydrated.line_items.data.length > 0;
  const hasProductMeta =
    lineItemsPresent &&
    hydrated.line_items!.data.every((item) => Boolean(getPrintIdFromLineItem(item)));

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
    const printId = getPrintIdFromLineItem(item);
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
    try {
      await sendOrderNotification({
        orderId,
        items: parsedItems,
        totalAmount: netTotal,
        customer: {
          firstName: customerFirstName,
          lastName: customerLastName,
          email: customerEmail,
          phone: customerPhone,
          address1: shipAddress1,
          address2: shipAddress2,
          city: shipCity,
          province: shipProvince,
          postal: shipPostal,
          country: shipCountry,
        },
      });
    } catch (err) {
      console.error("[orderRecorder] email notification failed", err);
    }
    return { ok: true, orderId };
  } catch (error) {
    try {
      await sql`ROLLBACK`;
    } catch {}
    console.error("[orderRecorder] processing error", error);
    return { ok: false, error: "processing_error" };
  }
}
