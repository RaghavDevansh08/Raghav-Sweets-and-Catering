// Get invoice ID from URL
const params = new URLSearchParams(window.location.search);
const invoiceId = params.get("id");

const container = document.getElementById("invoiceData");

if (!invoiceId) {
  container.innerHTML = "<h3>❌ Invalid Invoice Link</h3>";
} else {
  fetch(`/verify/${invoiceId}`)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error("Invoice not found");
      }

      return response.json();
    })
    .then((order) => {
      container.innerHTML = `
        <div class="row">
          <span class="label">Invoice No:</span>
          ${order.id}
        </div>

        <div class="row">
          <span class="label">Customer:</span>
          ${order.customer_name}
        </div>

        <div class="row">
          <span class="label">Phone:</span>
          ${order.phone}
        </div>

        <div class="row">
          <span class="label">Total:</span>
          ₹${order.total}
        </div>

        <div class="row">
          <span class="label">Status:</span>
          <span class="status">${order.status}</span>
        </div>

        <div class="row">
          <span class="label">Created:</span>
          ${new Date(order.created_at).toLocaleString("en-IN")}
        </div>
      `;
    })
    .catch(() => {
      container.innerHTML = `
        <h2 style="color:red;">
          ❌ Invoice Not Found
        </h2>

        <p>
          The invoice you are trying to verify does not exist.
        </p>
      `;
    });
}
