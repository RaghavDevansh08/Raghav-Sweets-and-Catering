const API_BASE = "http://localhost:4000";
const ADMIN_KEY = "RaghavAdmin2026@SecureKey";
let salesChart = null;
let allOrders = [];

async function loadOrders() {
  try {
    const response = await fetch(`${API_BASE}/api/admin/orders`, {
      headers: {
        "x-admin-key": ADMIN_KEY,
      },
    });

    const data = await response.json();
    allOrders = data.orders || [];

    if (!response.ok) {
      alert(data.error || "Unable to load orders");
      return;
    }

    const orders = data.orders || [];

    // Update statistics
    document.getElementById("totalOrders").textContent = orders.length;

    const pending = orders.filter(
      (o) =>
        o.status === "AWAITING_UPI_PAYMENT" || o.status === "PAYMENT_SUBMITTED",
    ).length;

    document.getElementById("pendingOrders").textContent = pending;

    const revenue = orders.reduce((sum, order) => sum + Number(order.total), 0);

    document.getElementById("revenue").textContent = "₹" + revenue;

    // Update table
    const table = document.getElementById("ordersTable");

    if (orders.length === 0) {
      table.innerHTML = `
      <tr>
        <td colspan="5">No orders yet</td>
      </tr>`;
      return;
    }

    table.innerHTML = "";

    orders.forEach((order) => {
      table.innerHTML += `
<tr>

  <td>${order.id}</td>

  <td>${order.customer_name}</td>

  <td>${order.phone}</td>

  <td>₹${order.total}</td>

  <td>${order.status}</td>
 <td>
    <button onclick="viewOrder('${order.id}')">
        View
    </button>
</td>

<td>
    <button onclick="downloadInvoice('${order.id}')">
        📄 Invoice
    </button>
</td>

<td>

<select onchange="updateStatus('${order.id}', this.value)">

      <option value="">Change Status</option>

      <option value="PAYMENT_VERIFIED">Payment Verified</option>

      <option value="PREPARING">Preparing</option>

      <option value="READY">Ready</option>

      <option value="COMPLETED">Completed</option>

      <option value="CANCELLED">Cancelled</option>

    </select>

  </td>

</tr>
`;
    });
  } catch (error) {
    console.error(error);

    alert("Cannot connect to backend server.");
  }
}

loadOrders();

// Refresh every 10 seconds
setInterval(loadOrders, 10000);
async function updateStatus(orderId, status) {
  if (!status) return;

  try {
    const response = await fetch(
      `${API_BASE}/api/admin/orders/${orderId}/status`,
      {
        method: "PATCH",

        headers: {
          "Content-Type": "application/json",
          "x-admin-key": ADMIN_KEY,
        },

        body: JSON.stringify({
          status,
        }),
      },
    );

    const result = await response.json();

    if (!response.ok) {
      alert(result.error || "Unable to update status");

      return;
    }

    alert("Order updated successfully!");

    loadOrders();
  } catch (error) {
    console.error(error);

    alert("Server error");
  }
}
async function viewOrder(orderId) {
  try {
    const response = await fetch(`${API_BASE}/api/orders/${orderId}`);

    const order = await response.json();

    if (!response.ok) {
      alert(order.error || "Unable to load order.");
      return;
    }

    const box = document.getElementById("orderDetails");

    box.innerHTML = `
      <div class="details-row"><strong>Order ID:</strong> ${order.id}</div>

      <div class="details-row"><strong>Customer:</strong> ${order.customer_name}</div>

      <div class="details-row"><strong>Phone:</strong> ${order.phone || "-"}</div>

      <div class="details-row"><strong>Status:</strong> ${order.status}</div>

      <div class="details-row"><strong>Fulfilment:</strong> ${order.fulfilment}</div>

      <div class="details-row"><strong>Subtotal:</strong> ₹${order.subtotal}</div>

      <div class="details-row"><strong>Delivery Fee:</strong> ₹${order.delivery_fee}</div>

      <div class="details-row"><strong>Total:</strong> ₹${order.total}</div>

      <hr>

      <h3>Ordered Items</h3>

      ${order.items
        .map(
          (item) => `
          <div class="details-row">
            <strong>${item.product_name}</strong><br>
            Quantity: ${item.quantity}<br>
            Unit: ${item.unit}<br>
            Price: ₹${item.unit_price}<br>
            Total: ₹${item.line_total}
          </div>
        `,
        )
        .join("")}

    `;

    document.getElementById("orderModal").style.display = "block";
  } catch (error) {
    console.error(error);

    alert("Unable to fetch order details.");
  }
}
const closeBtn = document.querySelector(".close-btn");

closeBtn.addEventListener("click", function () {
  document.getElementById("orderModal").style.display = "none";
});
window.addEventListener("click", function (event) {
  const modal = document.getElementById("orderModal");

  if (event.target === modal) {
    modal.style.display = "none";
  }
});
async function loadSalesChart() {
  try {
    const response = await fetch(`${API_BASE}/api/admin/analytics/sales`, {
      headers: {
        "x-admin-key": ADMIN_KEY,
      },
    });

    const data = await response.json();

    console.log("Sales Data:", data);

    const canvas = document.getElementById("salesChart");

    console.log(canvas);

    const ctx = canvas.getContext("2d");

    const labels = data.map((d) => new Date(d.day).toLocaleDateString());

    const revenue = data.map((d) => Number(d.revenue));

    const oldChart = Chart.getChart(canvas);

    if (oldChart) {
      oldChart.destroy();
    }

    salesChart = new Chart(ctx, {
      type: "line",

      data: {
        labels,
        datasets: [
          {
            label: "Revenue",
            data: revenue,
            borderColor: "#d35400",
            backgroundColor: "rgba(211,84,0,0.2)",
            fill: true,
            tension: 0.3,
          },
        ],
      },

      options: {
        responsive: true,
        maintainAspectRatio: false,
      },
    });

    console.log("Chart created:", salesChart);
  } catch (err) {
    console.error(err);
  }
}
loadSalesChart();
function downloadInvoice(orderId) {
  window.open(`${API_BASE}/api/orders/${orderId}/invoice`, "_blank");
}
