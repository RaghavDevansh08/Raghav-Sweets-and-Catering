import "dotenv/config";
import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import QRCode from "qrcode";
import { z } from "zod";
import { pool, initDb } from "./db.js";
import { productMap } from "./products.js";
import generateInvoice from "./invoice.js";

const app = express();
const port = Number(process.env.PORT || 4000);
const configuredOrigins = (
  process.env.FRONTEND_ORIGIN || "http://127.0.0.1:5500,http://localhost:5500"
)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const upiId = process.env.UPI_ID || "raghavdevansh08@okicici";
const upiPayeeName =
  process.env.UPI_PAYEE_NAME || "Raghav Sweets and Catering and Namkeen";

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(
  cors({
    origin(requestOrigin, callback) {
      if (!requestOrigin || configuredOrigins.includes(requestOrigin))
        return callback(null, true);
      return callback(new Error(`CORS blocked origin: ${requestOrigin}`));
    },
    methods: ["GET", "POST", "PATCH"],
    allowedHeaders: ["Content-Type", "x-admin-key"],
  }),
);
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 150,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
app.use(express.json({ limit: "100kb" }));

const checkoutSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(2).max(80),
    phone: z.string().regex(/^\d{10}$/),
    email: z.string().email().max(120).optional().or(z.literal("")),
    fulfilment: z.enum(["Pickup", "Delivery"]),
    address: z.string().trim().max(500).optional().default(""),
    notes: z.string().trim().max(500).optional().default(""),
  }),
  items: z
    .array(z.object({ id: z.string(), qty: z.number().int().min(1).max(20) }))
    .min(1)
    .max(30),
});

app.get("/api/health", async (_req, res, next) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, paymentMode: "DIRECT_UPI" });
  } catch (error) {
    next(error);
  }
});

app.get("/api/config", (_req, res) => res.json({ upiId, upiPayeeName }));

app.post("/api/orders", async (req, res, next) => {
  try {
    const input = checkoutSchema.parse(req.body);

    if (!upiId) {
      return res.status(503).json({
        error: "The shop UPI ID has not been configured on the server.",
      });
    }

    if (
      input.customer.fulfilment === "Delivery" &&
      input.customer.address.length < 8
    ) {
      return res
        .status(400)
        .json({ error: "A complete delivery address is required." });
    }

    const calculatedItems = input.items.map(({ id, qty }) => {
      const product = productMap.get(id);
      if (!product) throw new Error(`Unknown product: ${id}`);
      return { ...product, qty, lineTotal: product.price * qty };
    });
    const subtotal = calculatedItems.reduce(
      (sum, item) => sum + item.lineTotal,
      0,
    );
    if (subtotal < 199)
      return res.status(400).json({ error: "Minimum order is ₹199." });
    const deliveryFee =
      input.customer.fulfilment === "Delivery" && subtotal < 999 ? 40 : 0;
    const total = subtotal + deliveryFee;
    const internalOrderId = `KSN-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO orders
        (id,customer_name,phone,email,fulfilment,address,notes,subtotal,delivery_fee,total,status)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'AWAITING_UPI_PAYMENT')`,
        [
          internalOrderId,
          input.customer.name,
          input.customer.phone,
          input.customer.email || null,
          input.customer.fulfilment,
          input.customer.address || null,
          input.customer.notes || null,
          subtotal,
          deliveryFee,
          total,
        ],
      );
      for (const item of calculatedItems) {
        await client.query(
          `INSERT INTO order_items(order_id,product_id,product_name,unit,quantity,unit_price,line_total) VALUES($1,$2,$3,$4,$5,$6,$7)`,
          [
            internalOrderId,
            item.id,
            item.name,
            item.unit,
            item.qty,
            item.price,
            item.lineTotal,
          ],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    const upiUri = buildUpiUri({ amount: total, orderId: internalOrderId });
    const qrCodeDataUrl = await QRCode.toDataURL(upiUri, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: "M",
    });
    res.status(201).json({
      orderId: internalOrderId,
      amount: total,
      currency: "INR",
      upiId,
      upiPayeeName,
      upiUri,
      qrCodeDataUrl,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/payments/upi-confirm", async (req, res, next) => {
  try {
    const input = z
      .object({
        orderId: z.string().min(1).max(80),
        upiReference: z
          .string()
          .trim()
          .regex(/^[A-Za-z0-9-]{6,40}$/),
      })
      .parse(req.body);
    const duplicate = await pool.query(
      "SELECT id FROM orders WHERE upi_reference=$1 AND id<>$2",
      [input.upiReference, input.orderId],
    );
    if (duplicate.rowCount)
      return res
        .status(409)
        .json({ error: "This payment reference has already been submitted." });
    const result = await pool.query(
      `UPDATE orders SET upi_reference=$1,status='PAYMENT_SUBMITTED',payment_submitted_at=NOW(),updated_at=NOW()
      WHERE id=$2 AND status IN ('AWAITING_UPI_PAYMENT','PAYMENT_SUBMITTED') RETURNING id,status,total`,
      [input.upiReference, input.orderId],
    );
    if (!result.rowCount)
      return res
        .status(404)
        .json({ error: "Order not found or already processed." });
    res.json({
      ok: true,
      ...result.rows[0],
      message: "Payment details submitted for shop verification.",
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/orders/:id", async (req, res, next) => {
  try {
    const order = await pool.query(
      `
      SELECT *
      FROM orders
      WHERE id = $1
      `,
      [req.params.id],
    );

    if (!order.rowCount) {
      return res.status(404).json({
        error: "Order not found.",
      });
    }

    const items = await pool.query(
      `
      SELECT
      product_name,
      unit,
      quantity,
      unit_price,
      line_total
      FROM order_items
      WHERE order_id = $1
      `,
      [req.params.id],
    );

    res.json({
      ...order.rows[0],
      items: items.rows,
    });
  } catch (err) {
    next(err);
  }
});

app.get("/api/orders/:id/invoice", async (req, res, next) => {
  try {
    const orderResult = await pool.query("SELECT * FROM orders WHERE id=$1", [
      req.params.id,
    ]);

    if (!orderResult.rowCount) {
      return res.status(404).json({
        error: "Order not found.",
      });
    }

    const itemsResult = await pool.query(
      `
      SELECT
        product_name,
        quantity,
        unit,
        unit_price,
        line_total
      FROM order_items
      WHERE order_id=$1
      `,
      [req.params.id],
    );

    const order = {
      ...orderResult.rows[0],
      items: itemsResult.rows,
    };

    const invoicePath = await generateInvoice(order);

    res.download(invoicePath);
  } catch (err) {
    next(err);
  }
});

app.get("/api/admin/orders", async (req, res, next) => {
  try {
    if (
      !process.env.ADMIN_API_KEY ||
      req.get("x-admin-key") !== process.env.ADMIN_API_KEY
    )
      return res.status(401).json({ error: "Unauthorized" });
    const result = await pool.query(
      "SELECT * FROM orders ORDER BY created_at DESC LIMIT 200",
    );
    res.json({ orders: result.rows });
  } catch (error) {
    next(error);
  }
});
app.get("/api/admin/analytics/sales", async (req, res, next) => {
  try {
    if (
      !process.env.ADMIN_API_KEY ||
      req.get("x-admin-key") !== process.env.ADMIN_API_KEY
    ) {
      return res.status(401).json({
        error: "Unauthorized",
      });
    }

    const result = await pool.query(`
      SELECT
        DATE(created_at) AS day,
        COUNT(*) AS orders,
        COALESCE(SUM(total),0) AS revenue
      FROM orders
      WHERE created_at >= CURRENT_DATE - INTERVAL '6 days'
      GROUP BY DATE(created_at)
      ORDER BY day
    `);

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});
app.patch("/api/admin/orders/:id/status", async (req, res, next) => {
  try {
    if (
      !process.env.ADMIN_API_KEY ||
      req.get("x-admin-key") !== process.env.ADMIN_API_KEY
    )
      return res.status(401).json({ error: "Unauthorized" });
    const { status } = z
      .object({
        status: z.enum([
          "PAYMENT_VERIFIED",
          "PAYMENT_REJECTED",
          "PREPARING",
          "READY",
          "COMPLETED",
          "CANCELLED",
        ]),
      })
      .parse(req.body);
    const result = await pool.query(
      "UPDATE orders SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING id,status",
      [status, req.params.id],
    );
    if (!result.rowCount)
      return res.status(404).json({ error: "Order not found." });
    res.json({ ok: true, ...result.rows[0] });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  if (error instanceof z.ZodError)
    return res
      .status(400)
      .json({ error: "Invalid request.", details: error.flatten() });
  if (String(error.message).startsWith("Unknown product:"))
    return res.status(400).json({ error: error.message });
  res.status(500).json({ error: "Unable to process the request right now." });
});

function buildUpiUri({ amount, orderId }) {
  const params = new URLSearchParams({
    pa: upiId,
    pn: upiPayeeName,
    am: amount.toFixed(2),
    cu: "INR",
    tn: `Raghav Sweets and Catering order ${orderId}`,
    tr: orderId,
  });
  return `upi://pay?${params.toString()}`;
}

await initDb();
app.listen(port, () =>
  console.log(
    `Raghav Sweets and Catering UPI backend running at http://localhost:${port}`,
  ),
);
