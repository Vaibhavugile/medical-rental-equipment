import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import "./ProductReport.css";

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4"];

export default function ProductReport() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // ✅ UNIQUE ORDERS
  const [uniqueOrders, setUniqueOrders] = useState(0);

  // filters
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("revenue");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // drill-down
  const [drillProduct, setDrillProduct] = useState(null);
  const [drillOrders, setDrillOrders] = useState([]);

  const isDateFilterActive = startDate && endDate;

  /* ---------------- INITIAL LOAD ---------------- */
  useEffect(() => {
    loadAggregatedReport();
  }, []);

  async function loadAggregatedReport() {
    setLoading(true);

    // ✅ REAL UNIQUE ORDERS
    const ordersSnap = await getDocs(collection(db, "orders"));
    setUniqueOrders(ordersSnap.size);

    const snap = await getDocs(collection(db, "reports_products"));

    if (snap.empty) {
      await rebuildProductReport();
      return loadAggregatedReport();
    }

    setProducts(snap.docs.map((d) => d.data()));
    setLoading(false);
  }

  /* ---------------- DATE RANGE ---------------- */
  useEffect(() => {
    if (!isDateFilterActive) return;

    (async () => {
      setLoading(true);

      const qOrders = query(
        collection(db, "orders"),
        where("createdAt", ">=", Timestamp.fromDate(new Date(startDate))),
        where("createdAt", "<=", Timestamp.fromDate(new Date(endDate + "T23:59:59")))
      );

      const ordersSnap = await getDocs(qOrders);
      setUniqueOrders(ordersSnap.size);

      const data = await buildProductReportByDate(startDate, endDate);
      setProducts(data);
      setLoading(false);
    })();
  }, [startDate, endDate]);

  /* ---------------- KPIs ---------------- */
  const kpis = useMemo(() => {
    const totalRevenue = products.reduce((s, p) => s + p.totalRevenue, 0);
    const totalQty = products.reduce((s, p) => s + p.totalQty, 0);
    const productOrders = products.reduce((s, p) => s + p.orderCount, 0);

    return {
      totalRevenue,
      totalQty,
      productOrders,
      avgRevenue:
        products.length > 0 ? totalRevenue / products.length : 0,
    };
  }, [products]);

  /* ---------------- FILTER + SORT ---------------- */
  const filtered = useMemo(() => {
    let arr = [...products];

    if (search) {
      arr = arr.filter((p) =>
        (p.productName || "").toLowerCase().includes(search.toLowerCase())
      );
    }

    if (sortBy === "revenue") arr.sort((a, b) => b.totalRevenue - a.totalRevenue);
    if (sortBy === "qty") arr.sort((a, b) => b.totalQty - a.totalQty);
    if (sortBy === "orders") arr.sort((a, b) => b.orderCount - a.orderCount);

    return arr;
  }, [products, search, sortBy]);

  const topRevenueProducts = filtered.slice(0, 5);

  if (loading) {
    return <div className="report-loading">Loading Product Report…</div>;
  }

  return (
    <div className="report-page">
      <h1>📦 Product Report</h1>
      <p className="muted">
        Revenue, quantity and order performance by product
      </p>

      {/* Admin rebuild */}
      <button
        className="rebuild-btn"
        onClick={async () => {
          await rebuildProductReport();
          await loadAggregatedReport();
          alert("Product report rebuilt successfully");
        }}
      >
        🔄 Rebuild Report
      </button>

      {/* KPIs */}
      <div className="kpi-grid">
        <Kpi label="Total Revenue" value={kpis.totalRevenue} />
        <Kpi label="Total Quantity" value={kpis.totalQty} />
        <Kpi label="Unique Orders" value={uniqueOrders} />
        <Kpi label="Product Orders" value={kpis.productOrders} />
      </div>

      {/* Filters */}
      <div className="report-filters">
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />

        <input
          placeholder="Search product…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="revenue">Sort by Revenue</option>
          <option value="qty">Sort by Quantity</option>
          <option value="orders">Sort by Orders</option>
        </select>

        <button onClick={() => exportCSV(filtered)}>Export CSV</button>
      </div>

      {/* Charts */}
      <div className="charts-grid">
        <ChartCard title="Revenue by Product (Top 10)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={filtered.slice(0, 10)}>
              <XAxis dataKey="productName" hide />
              <YAxis />
              <Tooltip />
              <Bar dataKey="totalRevenue" fill="#6366f1" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Revenue Share (Top 5)">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={topRevenueProducts}
                dataKey="totalRevenue"
                nameKey="productName"
                outerRadius={90}
              >
                {topRevenueProducts.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Table */}
      <div className="report-table">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Qty</th>
              <th>Revenue</th>
              <th>Orders</th>
              <th>Avg Rate</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr
                key={p.productId}
                className="clickable-row"
                onClick={() => openProductOrders(p, setDrillProduct, setDrillOrders)}
              >
                <td>{p.productName}</td>
                <td>{p.totalQty}</td>
                <td>₹ {p.totalRevenue.toLocaleString()}</td>
                <td>{p.orderCount}</td>
                <td>₹ {Math.round(p.avgRate).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {drillProduct && (
        <DrillDownModal
          product={drillProduct}
          orders={drillOrders}
          onClose={() => setDrillProduct(null)}
        />
      )}
    </div>
  );
}

/* ---------------- UI COMPONENTS ---------------- */

function Kpi({ label, value }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">₹ {Math.round(value).toLocaleString()}</div>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="chart-card">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function DrillDownModal({ product, orders, onClose }) {
  return (
    <div className="report-modal">
      <div className="modal-card">
        <h3>{product.productName} — Orders</h3>

        <table>
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Days</th>
              <th>Qty</th>
              <th>Revenue</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o, i) => (
              <tr key={i}>
                <td>{o.orderNo}</td>
                <td>{o.customer}</td>
                <td>{o.startDate}</td>
                <td>{o.endDate}</td>
                <td>{o.days}</td>
                <td>{o.qty}</td>
                <td>₹ {o.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

/* ---------------- DATA HELPERS ---------------- */

async function getProductsMap() {
  const snap = await getDocs(collection(db, "products"));
  const map = {};
  snap.forEach((d) => {
    map[d.id] = d.data()?.name || d.id;
  });
  return map;
}

async function rebuildProductReport() {
  const productsMap = await getProductsMap();
  const ordersSnap = await getDocs(collection(db, "orders"));
  const map = {};

  ordersSnap.forEach((docSnap) => {
    const order = docSnap.data();
    const orderId = docSnap.id;

    (order.items || []).forEach((it) => {
      if (!it.productId) return;

      if (!map[it.productId]) {
        map[it.productId] = {
          productId: it.productId,
          productName: productsMap[it.productId] || it.productId,
          totalQty: 0,
          totalRevenue: 0,
          orders: new Set(),
        };
      }

      map[it.productId].totalQty += Number(it.qty || 0);
      map[it.productId].totalRevenue += Number(it.amount || 0);
      map[it.productId].orders.add(orderId);
    });
  });

  for (const p of Object.values(map)) {
    await setDoc(doc(db, "reports_products", p.productId), {
      productId: p.productId,
      productName: p.productName,
      totalQty: p.totalQty,
      totalRevenue: p.totalRevenue,
      orderCount: p.orders.size,
      avgRate: p.totalQty ? p.totalRevenue / p.totalQty : 0,
      lastUpdated: serverTimestamp(),
    });
  }
}

async function buildProductReportByDate(start, end) {
  const productsMap = await getProductsMap();

  const q = query(
    collection(db, "orders"),
    where("createdAt", ">=", Timestamp.fromDate(new Date(start))),
    where("createdAt", "<=", Timestamp.fromDate(new Date(end + "T23:59:59")))
  );

  const snap = await getDocs(q);
  const map = {};

  snap.forEach((doc) => {
    const order = doc.data();
    const orderId = doc.id;

    (order.items || []).forEach((it) => {
      if (!it.productId) return;

      if (!map[it.productId]) {
        map[it.productId] = {
          productId: it.productId,
          productName: productsMap[it.productId] || it.productId,
          totalQty: 0,
          totalRevenue: 0,
          orders: new Set(),
        };
      }

      map[it.productId].totalQty += Number(it.qty || 0);
      map[it.productId].totalRevenue += Number(it.amount || 0);
      map[it.productId].orders.add(orderId);
    });
  });

  return Object.values(map).map((p) => ({
    productId: p.productId,
    productName: p.productName,
    totalQty: p.totalQty,
    totalRevenue: p.totalRevenue,
    orderCount: p.orders.size,
    avgRate: p.totalQty ? p.totalRevenue / p.totalQty : 0,
  }));
}

async function openProductOrders(product, setDrillProduct, setDrillOrders) {
  setDrillProduct(product);
  const snap = await getDocs(collection(db, "orders"));
  const rows = [];

  snap.forEach((doc) => {
    const order = doc.data();

    (order.items || []).forEach((it) => {
      if (it.productId === product.productId) {
        rows.push({
          orderNo: order.orderNo,
          customer: order.customerName,
          qty: it.qty,
          amount: it.amount,
          startDate: it.expectedStartDate || "",
          endDate: it.expectedEndDate || "",
          days: it.days || "",
        });
      }
    });
  });

  setDrillOrders(rows);
}

function exportCSV(rows) {
  const header = ["Product", "Quantity", "Revenue", "Orders", "Avg Rate"];
  const csv = [
    header.join(","),
    ...rows.map((p) =>
      [
        p.productName,
        p.totalQty,
        p.totalRevenue,
        p.orderCount,
        Math.round(p.avgRate),
      ].join(",")
    ),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "product-report.csv";
  a.click();
}
