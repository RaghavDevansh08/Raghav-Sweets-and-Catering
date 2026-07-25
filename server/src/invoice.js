import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateInvoice(order) {
  // ============================================================
  // CREATE INVOICE DIRECTORY
  // ============================================================

  const invoicesDir = path.join(__dirname, "..", "invoices");

  if (!fs.existsSync(invoicesDir)) {
    fs.mkdirSync(invoicesDir, { recursive: true });
  }

  const invoicePath = path.join(invoicesDir, `${order.id}.pdf`);

  const qrPath = path.join(invoicesDir, `${order.id}-qr.png`);

  const BASE_URL =
    process.env.BASE_URL || "https://raghav-sweets-and-catering.onrender.com";

  const qrData = `${BASE_URL}/verify.html?id=${order.id}`;

  await QRCode.toFile(qrPath, qrData, {
    width: 180,
    margin: 1,
  });

  // ============================================================
  // CREATE PDF
  // ============================================================

  const doc = new PDFDocument({
    size: "A4",
    margins: {
      top: 40,
      bottom: 40,
      left: 45,
      right: 45,
    },
    bufferPages: true,
  });
  const stream = fs.createWriteStream(invoicePath);

  doc.pipe(stream);

  // ============================================================
  // COLORS
  // ============================================================

  const primary = "#7d1d17";
  const secondary = "#d35400";
  const dark = "#333333";
  const gray = "#666666";
  const border = "#dddddd";
  const light = "#faf8f5";

  //--------------------------------------------------
  // GST CONFIGURATION
  //--------------------------------------------------

  const GST_ENABLED = false;

  const CGST_RATE = 2.5;

  const SGST_RATE = 2.5;

  // ============================================================
  // PAGE SETTINGS
  // ============================================================

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;

  const left = 45;
  const right = pageWidth - 45;

  // ======================================
  // PRINT SAFE AREA
  // ======================================

  const topMargin = 40;
  const bottomMargin = 40;

  const printableWidth = right - left;
  const printableHeight = pageHeight - topMargin - bottomMargin;

  // ======================================
  // LEFT ACCENT BAR
  // ======================================

  doc.rect(0, 0, 12, doc.page.height).fill(primary);

  doc.fillColor(dark);

  // ============================================================
  // TABLE SETTINGS
  // ============================================================

  const columns = {
    item: left + 12,
    qty: 315,
    unit: 365,
    rate: 425,
    total: 495,
  };

  let rowY = 0;

  //--------------------------------------------------
  // GST CALCULATIONS
  //--------------------------------------------------

  const subtotal = Number(order.subtotal || 0);

  const delivery = Number(order.delivery_fee || 0);

  const taxableAmount = subtotal + delivery;

  const cgst = GST_ENABLED ? (taxableAmount * CGST_RATE) / 100 : 0;

  const sgst = GST_ENABLED ? (taxableAmount * SGST_RATE) / 100 : 0;

  const totalGST = cgst + sgst;

  const grandTotal = GST_ENABLED
    ? taxableAmount + totalGST
    : Number(order.total || 0);

  // ============================================================
  // PAGE BREAK
  // ============================================================

  function ensureSpace(requiredHeight = 120) {
    const usableBottom = pageHeight - bottomMargin;

    if (doc.y + requiredHeight > usableBottom) {
      doc.addPage();

      doc.y = topMargin;

      // If we're inside the items table, redraw the header
      if (rowY > 0) {
        rowY = topMargin;
        drawTableHeader();
      }
    }
  }

  // ============================================================
  // TABLE HEADER
  // ============================================================

  function drawTableHeader() {
    doc.roundedRect(left, rowY, right - left, 28, 4).fill(primary);

    doc.fillColor("white").font("Helvetica-Bold").fontSize(11);

    doc.text("Product", columns.item, rowY + 8);

    doc.text("Qty", columns.qty, rowY + 8);

    doc.text("Unit", columns.unit, rowY + 8);

    doc.text("Rate", columns.rate, rowY + 8);

    doc.text("Amount", columns.total, rowY + 8);

    rowY += 28;
  }

  // ============================================================
  // AUTOMATIC PAGE BREAK FOR TABLE
  // ============================================================

  function checkTablePageBreak(rowHeight = 26) {
    const footerSpace = 120;

    if (rowY + rowHeight > pageHeight - footerSpace) {
      doc.addPage();

      rowY = topMargin;

      drawTableHeader();
    }
  }
  // ============================================================
  // DRAW SINGLE ITEM ROW
  // ============================================================

  function drawItemRow(item, index) {
    const rowHeight = 28;

    checkTablePageBreak(rowHeight);

    if (index % 2 === 0) {
      doc.rect(left, rowY, right - left, rowHeight).fill("#fafafa");
    }

    doc
      .strokeColor(border)
      .rect(left, rowY, right - left, rowHeight)
      .stroke();

    doc.fillColor(dark).font("Helvetica").fontSize(10);

    doc.text(item.product_name, columns.item, rowY + 7, {
      width: 220,
      ellipsis: true,
    });
    doc.text(String(item.quantity), columns.qty, rowY + 7, {
      width: 30,
      align: "center",
    });

    doc.text(item.unit, columns.unit, rowY + 8);

    doc.text(`₹${Number(item.unit_price).toFixed(2)}`, columns.rate, rowY + 7, {
      width: 60,
      align: "right",
    });

    doc.text(
      `₹${Number(item.line_total).toFixed(2)}`,
      columns.total,
      rowY + 7,
      {
        width: 70,
        align: "right",
      },
    );

    rowY += rowHeight;
  }

  // ============================================================
  // LOGO
  // ============================================================

  const logo = path.join(__dirname, "..", "assets", "logo.png");

  if (fs.existsSync(logo)) {
    doc.image(logo, pageWidth / 2 - 45, 30, {
      width: 90,
    });
  }

  // Position content below logo
  doc.y = 135;

  // ======================================
  // WATERMARK
  // ======================================

  if (fs.existsSync(logo)) {
    doc.save();

    doc.opacity(0.1);

    doc.image(logo, pageWidth / 2 - 140, 220, {
      width: 280,
    });

    doc.restore();
  }

  // ============================================================
  // SHOP HEADER
  // ============================================================

  doc
    .font("Helvetica-Bold")
    .fontSize(24)
    .fillColor(primary)
    .text("RAGHAV SWEETS & CATERING", {
      align: "center",
    });

  doc.moveDown(0.3);

  doc
    .font("Helvetica")
    .fontSize(11)
    .fillColor(gray)
    .text("Premium Indian Sweets • Namkeen • Catering", {
      align: "center",
    });

  doc.moveDown(0.2);

  doc.fontSize(10).fillColor(dark).text("Mathura, Uttar Pradesh", {
    align: "center",
  });

  doc.text("UPI : raghavdevansh08@okicici", {
    align: "center",
  });

  doc.text("Phone : +91-XXXXXXXXXX", {
    align: "center",
  });

  if (GST_ENABLED) {
    doc.text("GSTIN : 09ABCDE1234F1Z5", {
      align: "center",
    });

    doc.text("State : Uttar Pradesh", {
      align: "center",
    });
  }
  doc.moveDown();

  doc
    .strokeColor(primary)
    .lineWidth(2)
    .moveTo(left, doc.y)
    .lineTo(right, doc.y)
    .stroke();

  doc.moveDown();

  // ======================================
  // PROFESSIONAL INVOICE BANNER
  // ======================================

  const bannerY = doc.y;

  doc.roundedRect(left, bannerY, right - left, 55, 8).fill(primary);

  doc
    .fillColor("white")
    .font("Helvetica-Bold")
    .fontSize(22)
    .text(GST_ENABLED ? "GST TAX INVOICE" : "TAX INVOICE", {
      align: "center",
    });

  doc
    .font("Helvetica")
    .fontSize(11)
    .text(`Invoice # ${order.id}`, left, bannerY + 35, {
      width: right - left,
      align: "center",
    });

  doc.fillColor(dark);

  doc.y = bannerY + 70;

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(gray)
    .text("Original Customer Copy", left, doc.y, {
      width: right - left,
      align: "center",
    });

  doc.moveDown(1);

  // ============================================================
  // INVOICE INFORMATION
  // ============================================================

  ensureSpace(120);

  const infoTop = doc.y;

  doc
    .roundedRect(left, infoTop, right - left, 105, 8)
    .fillAndStroke(light, border);

  doc.fillColor(dark).font("Helvetica").fontSize(11);

  // Left Column

  doc.font("Helvetica-Bold");
  doc.text("Invoice No", left + 15, infoTop + 15);
  doc.text("Invoice Date", left + 15, infoTop + 38);
  if (GST_ENABLED) {
    doc.font("Helvetica-Bold");
    doc.text("Place of Supply:", left + 15, infoTop + 75);

    doc.font("Helvetica");
    doc.text("Uttar Pradesh", 170, infoTop + 75);
  }
  doc.text("Order Status", left + 15, infoTop + 61);

  doc.font("Helvetica");

  doc.text(order.id, 145, infoTop + 15);

  const verificationCode =
    order.id.slice(-6).toUpperCase() +
    "-" +
    String(new Date(order.created_at).getFullYear());

  doc.font("Helvetica-Bold");
  doc.text("Verification Code:", left + 15, infoTop + 75);

  doc.font("Helvetica");
  doc.text(verificationCode, 150, infoTop + 75);

  doc.text(
    new Date(order.created_at).toLocaleString("en-IN"),
    145,
    infoTop + 38,
  );

  // ======================================
  // ORDER STATUS BADGE
  // ======================================

  const statusColors = {
    AWAITING_UPI_PAYMENT: "#f39c12",
    PAYMENT_SUBMITTED: "#3498db",
    PAYMENT_VERIFIED: "#27ae60",
    PAYMENT_REJECTED: "#e74c3c",
    PREPARING: "#9b59b6",
    READY: "#16a085",
    COMPLETED: "#2ecc71",
    CANCELLED: "#c0392b",
  };

  const badgeColor = statusColors[order.status] || "#7f8c8d";

  doc.roundedRect(150, infoTop + 50, 150, 24, 6).fill(badgeColor);

  doc
    .fillColor("white")
    .font("Helvetica-Bold")
    .fontSize(10)
    .text(order.status.replaceAll("_", " "), 150, infoTop + 57, {
      width: 150,
      align: "center",
    });

  doc.fillColor(dark);

  // Right Column

  doc.font("Helvetica-Bold");

  doc.text("Payment", 335, infoTop + 15);

  doc.text("Fulfilment", 335, infoTop + 38);

  doc.text("Phone", 335, infoTop + 61);

  const paymentPaid = Boolean(order.upi_reference);

  doc
    .roundedRect(430, infoTop + 10, 75, 22, 6)
    .fill(paymentPaid ? "#2ecc71" : "#f39c12");

  doc
    .fillColor("white")
    .font("Helvetica-Bold")
    .fontSize(10)
    .text(paymentPaid ? "PAID" : "PENDING", 430, infoTop + 16, {
      width: 75,
      align: "center",
    });

  doc.fillColor(dark);
  doc.font("Helvetica");

  doc.text(order.fulfilment || "-", 435, infoTop + 38);

  doc.text(order.phone || "-", 435, infoTop + 61);

  doc.y = infoTop + 120;

  // ============================================================
  // CUSTOMER DETAILS
  // ============================================================

  ensureSpace(150);

  doc
    .font("Helvetica-Bold")
    .fontSize(15)
    .fillColor(primary)
    .text("CUSTOMER DETAILS");

  doc.moveDown(0.5);

  const customerTop = doc.y;

  doc
    .roundedRect(left, customerTop, right - left, 105, 8)
    .fillAndStroke("white", border);

  doc.fillColor(dark).fontSize(11);

  doc.font("Helvetica-Bold");
  doc.text("Customer Name", left + 15, customerTop + 15);

  doc.font("Helvetica");
  doc.text(order.customer_name || "-", 175, customerTop + 15);

  doc.font("Helvetica-Bold");
  doc.text("Phone", left + 15, customerTop + 38);

  doc.font("Helvetica");
  doc.text(order.phone || "-", 175, customerTop + 38);

  doc.font("Helvetica-Bold");
  doc.text("Email", left + 15, customerTop + 61);

  doc.font("Helvetica");
  doc.text(order.email || "-", 175, customerTop + 61);

  doc.font("Helvetica-Bold");
  doc.text("Address", left + 15, customerTop + 84);

  doc.font("Helvetica");

  doc.text(order.address || "Pickup Order", 175, customerTop + 84, {
    width: 320,
  });

  doc.y = customerTop + 130;

  // ============================================================
  // ORDER ITEMS
  // ============================================================

  ensureSpace(180);

  doc
    .font("Helvetica-Bold")
    .fontSize(15)
    .fillColor(primary)
    .text("ORDER ITEMS");

  doc.moveDown(0.5);

  rowY = doc.y;

  drawTableHeader();

  order.items.forEach((item, index) => {
    drawItemRow(item, index);
  });

  doc.y = rowY + 25;

  // ============================================
  // PREMIUM ORDER SUMMARY
  // ============================================

  const summaryTop = doc.y;

  const summaryWidth = 240;
  const summaryX = right - summaryWidth;

  const summaryHeight = GST_ENABLED ? 200 : 130;

  doc
    .roundedRect(summaryX, summaryTop, summaryWidth, summaryHeight, 8)
    .fillAndStroke("#ffffff", border);

  doc
    .font("Helvetica-Bold")
    .fontSize(14)
    .fillColor(primary)
    .text("ORDER SUMMARY", summaryX + 15, summaryTop + 15);

  let sy = summaryTop + 45;

  doc.font("Helvetica").fontSize(11).fillColor(dark);

  doc.text("Subtotal", summaryX + 15, sy);

  doc.text(`₹${subtotal.toFixed(2)}`, summaryX + 130, sy, {
    width: 90,
    align: "right",
  });
  sy += 22;

  doc.text("Delivery", summaryX + 15, sy);

  doc.text(`₹${delivery.toFixed(2)}`, summaryX + 130, sy, {
    width: 90,
    align: "right",
  });

  sy += 22;
  if (GST_ENABLED) {
    doc.text("Taxable Amount", summaryX + 15, sy);

    doc.text(`₹${taxableAmount.toFixed(2)}`, summaryX + 130, sy, {
      width: 90,
      align: "right",
    });

    sy += 22;

    doc.text(`CGST (${CGST_RATE}%)`, summaryX + 15, sy);

    doc.text(`₹${cgst.toFixed(2)}`, summaryX + 130, sy, {
      width: 90,
      align: "right",
    });

    sy += 22;

    doc.text(`SGST (${SGST_RATE}%)`, summaryX + 15, sy);

    doc.text(`₹${sgst.toFixed(2)}`, summaryX + 130, sy, {
      width: 90,
      align: "right",
    });

    sy += 12;
  }

  // Divider

  doc
    .strokeColor(border)
    .moveTo(summaryX + 15, sy)
    .lineTo(summaryX + summaryWidth - 15, sy)
    .stroke();

  sy += 12;

  // Grand Total Background

  doc.roundedRect(summaryX + 10, sy, summaryWidth - 20, 40, 6).fill(primary);

  doc
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor("white")
    .text("GRAND TOTAL", summaryX + 20, sy + 13);

  doc.text(`₹${grandTotal.toFixed(2)}`, summaryX + 120, sy + 13, {
    width: 90,
    align: "right",
  });

  doc.y = summaryTop + summaryHeight + 20;

  // ============================================================
  // PAYMENT INFORMATION
  // ============================================================

  ensureSpace(120);

  doc
    .font("Helvetica-Bold")
    .fontSize(15)
    .fillColor(primary)
    .text("PAYMENT INFORMATION");

  doc.moveDown(0.5);

  const paymentTop = doc.y;

  doc
    .roundedRect(left, paymentTop, right - left, 130, 8)
    .fillAndStroke("white", border);

  doc.font("Helvetica").fontSize(11).fillColor(dark);

  doc.text("Payment Method", left + 15, paymentTop + 15);
  doc.text("UPI", 185, paymentTop + 15);

  doc.text("UPI Reference", left + 15, paymentTop + 40);
  doc.text(order.upi_reference || "Pending Verification", 185, paymentTop + 40);

  doc.text("Payment Status", left + 15, paymentTop + 65);
  doc.text(order.status, 185, paymentTop + 65);

  doc.y = paymentTop + 150;

  // ========================================
  // QR CODE
  // ========================================

  if (fs.existsSync(qrPath)) {
    // Title
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor(primary)
      .text("Invoice Verification", 400, paymentTop + 5, {
        width: 140,
        align: "center",
      });

    // QR Image
    doc.image(qrPath, 425, paymentTop + 22, {
      width: 90,
    });

    // Caption
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(gray)
      .text("Scan to Verify Invoice", 400, paymentTop + 118, {
        width: 140,
        align: "center",
      });
  }

  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(dark)
    .text(`Invoice : ${order.id}`, 400, paymentTop + 138, {
      width: 140,
      align: "center",
    });

  doc.text(`Status : ${order.status}`, 400, paymentTop + 150, {
    width: 140,
    align: "center",
  });

  doc.text(
    new Date(order.created_at).toLocaleDateString("en-IN"),
    400,
    paymentTop + 162,
    {
      width: 140,
      align: "center",
    },
  );

  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(dark)
    .text(`Invoice : ${order.id}`, 400, paymentTop + 138, {
      width: 140,
      align: "center",
    });

  doc.text(`Status : ${order.status}`, 400, paymentTop + 150, {
    width: 140,
    align: "center",
  });

  doc.text(
    new Date(order.created_at).toLocaleDateString("en-IN"),
    400,
    paymentTop + 162,
    {
      width: 140,
      align: "center",
    },
  );
  // ============================================================
  // THANK YOU MESSAGE
  // ============================================================

  ensureSpace(100);

  doc
    .strokeColor(primary)
    .lineWidth(1)
    .moveTo(left, doc.y)
    .lineTo(right, doc.y)
    .stroke();

  doc.moveDown();

  doc
    .font("Helvetica-Bold")
    .fontSize(18)
    .fillColor(primary)
    .text("Thank You!", {
      align: "center",
    });

  doc.moveDown(0.3);

  doc
    .font("Helvetica")
    .fontSize(11)
    .fillColor(gray)
    .text("Thank you for choosing Raghav Sweets & Catering.", {
      align: "center",
    });

  doc.text("We look forward to serving you again.", {
    align: "center",
  });

  doc.moveDown(1);

  // ============================================
  // TERMS & CONDITIONS
  // ============================================

  ensureSpace(150);

  doc.moveDown();

  doc
    .font("Helvetica-Bold")
    .fontSize(15)
    .fillColor(primary)
    .text("TERMS & CONDITIONS");

  doc.moveDown(0.5);

  const termsTop = doc.y;

  doc
    .roundedRect(left, termsTop, right - left, 110, 8)
    .fillAndStroke(light, border);

  doc.font("Helvetica").fontSize(10).fillColor(dark);

  const terms = [
    "• Goods once sold will not be taken back or exchanged.",
    "• Please retain this invoice for future reference.",
    "• UPI payments are subject to successful verification.",
    "• Delivery times may vary depending on location and order volume.",
    "• Catering orders should be confirmed in advance.",
    "• For any queries, please contact Raghav Sweets & Catering.",
  ];

  let y = termsTop + 15;

  terms.forEach((line) => {
    doc.text(line, left + 15, y, {
      width: right - left - 30,
    });
    y += 15;
  });

  // ============================================
  // INVOICE GENERATED TIME
  // ============================================

  doc.y = termsTop + 125;

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(gray)
    .text(
      `Invoice Generated: ${new Date().toLocaleString("en-IN")}`,
      left,
      doc.y,
    );

  doc.moveDown();

  doc
    .font("Helvetica-Oblique")
    .fontSize(9)
    .fillColor("#777777")
    .text(
      "This invoice can be verified using the Invoice Number and Verification Code.",
      {
        align: "center",
      },
    );

  doc.moveDown();

  // ============================================================
  // FOOTER
  // ============================================================

  doc.strokeColor(border).moveTo(left, doc.y).lineTo(right, doc.y).stroke();

  doc.moveDown(0.5);

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(gray)
    .text("Raghav Sweets & Catering | Mathura, Uttar Pradesh", {
      align: "center",
    });

  doc.text("UPI : raghavdevansh08@okicici", {
    align: "center",
  });

  doc.text("Premium Indian Sweets • Namkeen • Catering", {
    align: "center",
  });

  // ============================================================
  // PAGE NUMBERS
  // ============================================================

  const pages = doc.bufferedPageRange();

  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#999999")
      .text(`Page ${i + 1} of ${pages.count}`, 45, doc.page.height - 35, {
        width: doc.page.width - 90,
        align: "center",
      });
  }

  // ============================================
  // FINALIZE PDF
  // ============================================

  doc.end();

  await new Promise((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });

  // Delete temporary QR image
  if (fs.existsSync(qrPath)) {
    try {
      fs.unlinkSync(qrPath);
    } catch (err) {
      console.error("Unable to delete QR image:", err);
    }
  }

  return invoicePath;
}

export default generateInvoice;
