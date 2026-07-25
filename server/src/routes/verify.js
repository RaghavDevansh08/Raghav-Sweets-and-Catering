import express from "express";
import { pool } from "../db.js";

const router = express.Router();

router.get("/:id", async (req, res) => {
  try {
    const invoiceId = req.params.id;

    const result = await pool.query("SELECT * FROM orders WHERE id = $1", [
      invoiceId,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});

export default router;
