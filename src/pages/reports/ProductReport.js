import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  collection, getDocs, query, where, Timestamp, doc, setDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid,
} from "recharts";
import "./ProductReport.css";

const COLORS = ["#625bf6", "#16a678", "#f5a524", "#e45d75", "#269bd1"];
const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const number = (value) => Number(value || 0).toLocaleString("en-IN");
const dateValue = (value) => {
  if (!value) return "—";
  const date = value?.toDate ? value.toDate() :
    value?.seconds ? new Date(value.seconds * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
};
const timestampDate = (value) => {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  if (value?.seconds) return new Date(value.seconds * 1000);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

export default function ProductReport() {
  const [products, setProducts] = useState([]);
  const [inventoryByProduct, setInventoryByProduct] = useState({});
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [error, setError] = useState("");
  const [uniqueOrders, setUniqueOrders] = useState(0);
  const [totalOrdersInScope, setTotalOrdersInScope] = useState(0);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("revenue");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [drillProduct, setDrillProduct] = useState(null);
  const [drillOrders, setDrillOrders] = useState([]);
  const [drillLoading, setDrillLoading] = useState(false);

  const hasDateFilter = Boolean(startDate || endDate);

  const loadAggregatedReport = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [ordersSnap, reportSnap, assetsSnap] = await Promise.all([
        getDocs(collection(db, "orders")),
        getDocs(collection(db, "reports_products")),
        getDocs(collection(db, "assets")),
      ]);
      setInventoryByProduct(buildAvailableInventoryMap(assetsSnap));
      setUniqueOrders(ordersSnap.size);
      setTotalOrdersInScope(ordersSnap.size);
      if (reportSnap.empty) {
        await rebuildProductReport();
        const rebuilt = await getDocs(collection(db, "reports_products"));
        setProducts(rebuilt.docs.map((d) => ({ productId: d.id, ...d.data() })));
      } else {
        setProducts(reportSnap.docs.map((d) => ({ productId: d.id, ...d.data() })));
      }
    } catch (e) {
      console.error("Product report load failed", e);
      setError(e.message || "Could not load product report.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDateReport = useCallback(async () => {
    if (!startDate && !endDate) return loadAggregatedReport();
    setLoading(true);
    setError("");
    try {
      const start = startDate ? new Date(`${startDate}T00:00:00`) : new Date("2000-01-01T00:00:00");
      const end = endDate ? new Date(`${endDate}T23:59:59.999`) : new Date();
      if (start > end) throw new Error("Start date must be before end date.");
      const qOrders = query(
        collection(db, "orders"),
        where("createdAt", ">=", Timestamp.fromDate(start)),
        where("createdAt", "<=", Timestamp.fromDate(end))
      );
      const [ordersSnap, assetsSnap] = await Promise.all([
        getDocs(qOrders),
        getDocs(collection(db, "assets")),
      ]);
      setInventoryByProduct(buildAvailableInventoryMap(assetsSnap));
      const report = await buildProductReportByDate(start, end, ordersSnap);
      setProducts(report.products);
      setUniqueOrders(ordersSnap.size);
      setTotalOrdersInScope(ordersSnap.size);
    } catch (e) {
      console.error("Date-filtered product report failed", e);
      setError(e.message || "Could not apply the selected date range.");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, loadAggregatedReport]);

  useEffect(() => { loadAggregatedReport(); }, [loadAggregatedReport]);
  useEffect(() => {
    if (hasDateFilter) loadDateReport();
    else if (!loading) loadAggregatedReport();
  }, [startDate, endDate]); // date changes intentionally reload the report

  const filtered = useMemo(() => {
    let rows = [...products];
    const term = search.trim().toLowerCase();
    if (term) rows = rows.filter((p) =>
      String(p.productName || "").toLowerCase().includes(term) ||
      String(p.sku || "").toLowerCase().includes(term) ||
      String(p.productId || "").toLowerCase().includes(term)
    );
    if (sortBy === "revenue") rows.sort((a, b) => Number(b.totalRevenue || 0) - Number(a.totalRevenue || 0));
    if (sortBy === "qty") rows.sort((a, b) => Number(b.totalQty || 0) - Number(a.totalQty || 0));
    if (sortBy === "orders") rows.sort((a, b) => Number(b.orderCount || 0) - Number(a.orderCount || 0));
    if (sortBy === "name") rows.sort((a, b) => String(a.productName || "").localeCompare(String(b.productName || "")));
    return rows;
  }, [products, search, sortBy]);

  const kpis = useMemo(() => {
    const totalRevenue = products.reduce((sum, p) => sum + Number(p.totalRevenue || 0), 0);
    const totalQty = products.reduce((sum, p) => sum + Number(p.totalQty || 0), 0);
    const productOrders = products.reduce((sum, p) => sum + Number(p.orderCount || 0), 0);
    const averageProductRevenue = products.length ? totalRevenue / products.length : 0;
    const averageOrderValue = uniqueOrders ? totalRevenue / uniqueOrders : 0;
    return { totalRevenue, totalQty, productOrders, averageProductRevenue, averageOrderValue, productCount: products.length };
  }, [products, uniqueOrders]);

  const topProducts = filtered.slice(0, 5);
  const chartProducts = filtered.slice(0, 10);

  const rebuild = async () => {
    const ok = window.confirm("Rebuild the product report from all order documents? This refreshes the reports_products summary collection.");
    if (!ok) return;
    setRebuilding(true);
    setError("");
    try {
      await rebuildProductReport();
      if (hasDateFilter) await loadDateReport();
      else await loadAggregatedReport();
      window.alert("Product report rebuilt successfully.");
    } catch (e) {
      console.error(e);
      setError(e.message || "Report rebuild failed.");
    } finally {
      setRebuilding(false);
    }
  };

  const openProductOrders = async (product) => {
    setDrillProduct(product);
    setDrillOrders([]);
    setDrillLoading(true);
    try {
      const snap = await getDocs(collection(db, "orders"));
      const rows = [];
      snap.forEach((docSnap) => {
        const order = docSnap.data() || {};
        const created = timestampDate(order.createdAt || order.orderDate);
        if (startDate && created && created < new Date(`${startDate}T00:00:00`)) return;
        if (endDate && created && created > new Date(`${endDate}T23:59:59.999`)) return;
        (order.items || []).forEach((item) => {
          if (item.productId !== product.productId) return;
          rows.push({
            id: docSnap.id,
            orderNo: order.orderNo || docSnap.id,
            customer: order.customerName || order.customer || "—",
            date: created,
            startDate: item.expectedStartDate || item.actualStartDate || "",
            endDate: item.expectedEndDate || item.actualEndDate || "",
            qty: Number(item.qty || 0),
            amount: Number(item.amount ?? (Number(item.qty || 0) * Number(item.rate || 0))),
          });
        });
      });
      rows.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
      setDrillOrders(rows);
    } catch (e) {
      setError(e.message || "Could not load product orders.");
    } finally {
      setDrillLoading(false);
    }
  };

  const clearDates = () => { setStartDate(""); setEndDate(""); };

  if (loading && !products.length) {
    return <div className="pr-loading"><div className="pr-loader" /><strong>Preparing product insights</strong><span>Loading your sales and order data…</span></div>;
  }

  return (
    <main className="pr-page">
      <section className="pr-hero">
        <div>
          <div className="pr-eyebrow"><span className="pr-eyebrow-dot" /> BUSINESS INTELLIGENCE</div>
          <h1>Product performance</h1>
          <p>Understand which products drive revenue, order volume and sales activity.</p>
        </div>
        <div className="pr-hero-actions">
          <span className="pr-updated-pill"><span /> {hasDateFilter ? "Filtered view" : "All-time overview"}</span>
          <button className="pr-rebuild-btn" onClick={rebuild} disabled={rebuilding}>
            <span className={rebuilding ? "pr-spin" : ""}>↻</span> {rebuilding ? "Rebuilding…" : "Rebuild report"}
          </button>
        </div>
      </section>

      {error && <div className="pr-error"><strong>Something needs attention</strong><span>{error}</span><button onClick={() => setError("")}>Dismiss</button></div>}

      <section className="pr-kpi-grid">
        <KpiCard icon="₹" tone="violet" label="Total revenue" value={money(kpis.totalRevenue)} hint="Sum of item amounts across the selected orders" />
        <KpiCard icon="▦" tone="blue" label="Quantity rented / sold" value={number(kpis.totalQty)} hint="Total item quantity recorded in orders" />
        <KpiCard icon="↗" tone="green" label="Unique orders" value={number(uniqueOrders)} hint="Each order document counted once" />
        <KpiCard icon="◫" tone="amber" label="Product order lines" value={number(kpis.productOrders)} hint="Sum of each product’s distinct order count; one order can count for multiple products" />
      </section>

      <section className="pr-insight-strip">
        <div className="pr-insight-mark">✦</div>
        <div className="pr-insight-copy">
          <strong>At-a-glance summary</strong>
          <span>
            {number(kpis.productCount)} products generated {money(kpis.totalRevenue)} from {number(uniqueOrders)} unique orders,
            with {number(kpis.totalQty)} total units and an average order value of {money(kpis.averageOrderValue)}.
          </span>
        </div>
        <div className="pr-insight-metric"><small>Avg. revenue / product</small><strong>{money(kpis.averageProductRevenue)}</strong></div>
      </section>

      <section className="pr-toolbar">
        <div className="pr-toolbar-title"><strong>Explore performance</strong><span>Filter the report and compare products</span></div>
        <div className="pr-controls">
          <label className="pr-date-control"><span>From</span><input type="date" value={startDate} max={endDate || undefined} onChange={(e) => setStartDate(e.target.value)} /></label>
          <label className="pr-date-control"><span>To</span><input type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} /></label>
          <label className="pr-search" aria-label="Search products by name, SKU or product ID"><span>⌕</span><input placeholder="Search product, SKU or ID…" value={search} onChange={(e) => setSearch(e.target.value)} /><button type="button" aria-label="Clear search" title="Clear search" onClick={() => setSearch("")} disabled={!search}>×</button></label>
          <select className="pr-sort" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="revenue">Highest revenue</option><option value="qty">Highest quantity</option><option value="orders">Most orders</option><option value="name">Product name</option>
          </select>
          {hasDateFilter && <button className="pr-clear-btn" onClick={clearDates}>Clear dates</button>}
          <button className="pr-export-btn" onClick={() => exportCSV(filtered)}>↓ Export CSV</button>
        </div>
      </section>

      {loading && <div className="pr-inline-loading"><div className="pr-loader small" /> Updating report…</div>}

      <section className="pr-charts-grid">
        <div className="pr-panel pr-main-chart">
          <PanelHeading title="Revenue by product" subtitle="Top 10 products ranked by revenue" tag="REVENUE" />
          {chartProducts.length ? <ResponsiveContainer width="100%" height={290}>
            <BarChart data={chartProducts} margin={{ top: 12, right: 12, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0f6" />
              <XAxis dataKey="productName" tick={false} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`} axisLine={false} tickLine={false} width={58} tick={{ fill: "#8993a7", fontSize: 11 }} />
              <Tooltip formatter={(v) => [money(v), "Revenue"]} labelFormatter={(label) => label} contentStyle={{ border: "1px solid #e8ebf3", borderRadius: 12, boxShadow: "0 10px 30px rgba(20,30,60,.12)" }} />
              <Bar dataKey="totalRevenue" fill="#655cf5" radius={[7, 7, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer> : <EmptyState text="No product revenue available for this view." />}
        </div>
        <div className="pr-panel pr-share-chart">
          <PanelHeading title="Revenue contribution" subtitle="Share of revenue from the top 5" />
          {topProducts.length ? <>
            <div className="pr-donut-wrap">
              <ResponsiveContainer width="100%" height={210}>
                <PieChart><Pie data={topProducts} dataKey="totalRevenue" nameKey="productName" innerRadius={58} outerRadius={82} paddingAngle={3} stroke="none">
                  {topProducts.map((p, i) => <Cell key={p.productId || i} fill={COLORS[i % COLORS.length]} />)}
                </Pie><Tooltip formatter={(v) => money(v)} /></PieChart>
              </ResponsiveContainer>
              <div className="pr-donut-center"><strong>{money(topProducts.reduce((s, p) => s + Number(p.totalRevenue || 0), 0))}</strong><span>Top 5 revenue</span></div>
            </div>
            <div className="pr-legend">{topProducts.map((p, i) => <div className="pr-legend-row" key={p.productId || i}><span className="pr-legend-dot" style={{ background: COLORS[i % COLORS.length] }} /><span title={p.productName}>{p.productName}</span><strong>{money(p.totalRevenue)}</strong></div>)}</div>
          </> : <EmptyState text="No revenue share to display." />}
        </div>
      </section>

      <section className="pr-table-panel">
        <div className="pr-table-heading">
          <div><strong>Product breakdown</strong><span>{number(filtered.length)} products shown · Select a row to view its orders</span></div>
          <span className="pr-table-count">{number(filtered.length)} RESULTS</span>
        </div>
        <div className="pr-table-scroll">
          <table className="pr-table">
            <thead><tr><th>Product</th><th>Total inventory</th><th>Available inventory</th><th>Quantity rented / sold</th><th>Revenue</th><th>Orders</th><th>Average rate</th><th>Revenue share</th><th /></tr></thead>
            <tbody>
              {filtered.map((p) => {
                const share = kpis.totalRevenue ? (Number(p.totalRevenue || 0) / kpis.totalRevenue) * 100 : 0;
                return <tr key={p.productId} onClick={() => openProductOrders(p)}>
                  <td><div className="pr-product-cell"><span className="pr-product-avatar">{String(p.productName || "P").trim().charAt(0).toUpperCase()}</span><span><strong>{p.productName || "Unnamed product"}</strong><small>{p.sku || p.productId}</small></span></div></td>
                  <td><strong>{number(inventoryByProduct[p.productId]?.total || 0)}</strong><small className="pr-cell-sub">all asset statuses</small></td>
                  <td><strong className="pr-stock-value">{number(inventoryByProduct[p.productId]?.available || 0)}</strong><small className="pr-cell-sub">in stock now</small></td>
                  <td><strong>{number(p.totalQty)}</strong><small className="pr-cell-sub">units</small></td>
                  <td><strong className="pr-revenue">{money(p.totalRevenue)}</strong></td>
                  <td><strong>{number(p.orderCount)}</strong><small className="pr-cell-sub">orders</small></td>
                  <td>{money(p.avgRate)}</td>
                  <td><div className="pr-share-cell"><div><i style={{ width: `${Math.min(100, share)}%` }} /></div><small>{share.toFixed(1)}%</small></div></td>
                  <td><button className="pr-row-open" aria-label={`View ${p.productName} orders`} onClick={(e) => { e.stopPropagation(); openProductOrders(p); }}>↗</button></td>
                </tr>;
              })}
              {!filtered.length && <tr><td colSpan="9"><EmptyState text="No products match your filters." /></td></tr>}
            </tbody>
          </table>
        </div>
        <div className="pr-table-foot"><span>Revenue is based on the order item amount stored in Firestore.</span><span>Click any product to inspect order-level details <b>→</b></span></div>
      </section>

      {drillProduct && <DrillDownModal product={drillProduct} orders={drillOrders} loading={drillLoading} onClose={() => setDrillProduct(null)} />}
    </main>
  );
}

function KpiCard({ icon, tone, label, value, hint }) {
  return <article className={`pr-kpi-card tone-${tone}`}><div className="pr-kpi-top"><span className="pr-kpi-icon">{icon}</span><span className="pr-kpi-label">{label}</span><span className="pr-kpi-info" title={hint}>i</span></div><strong className="pr-kpi-value">{value}</strong><span className="pr-kpi-hint">{hint}</span></article>;
}
function PanelHeading({ title, subtitle, tag }) {
  return <div className="pr-panel-heading"><div><h2>{title}</h2><p>{subtitle}</p></div>{tag && <span>{tag}</span>}</div>;
}
function EmptyState({ text }) { return <div className="pr-empty"><span>▤</span><strong>{text}</strong></div>; }

function DrillDownModal({ product, orders, loading, onClose }) {
  const total = orders.reduce((sum, o) => sum + Number(o.amount || 0), 0);
  return <div className="pr-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="pr-modal">
      <header className="pr-modal-head"><div><span className="pr-modal-eyebrow">PRODUCT ORDER HISTORY</span><h2>{product.productName}</h2><p>Order-level activity and revenue for this product</p></div><button onClick={onClose} aria-label="Close">×</button></header>
      <div className="pr-modal-stats"><div><small>Orders / line entries</small><strong>{number(orders.length)}</strong></div><div><small>Total quantity</small><strong>{number(orders.reduce((s, o) => s + o.qty, 0))}</strong></div><div><small>Revenue in list</small><strong>{money(total)}</strong></div></div>
      <div className="pr-modal-table-wrap"><table className="pr-modal-table"><thead><tr><th>Order</th><th>Customer</th><th>Order date</th><th>Rental start</th><th>Rental end</th><th>Qty</th><th>Revenue</th></tr></thead><tbody>
        {loading ? <tr><td colSpan="7" className="pr-modal-empty">Loading order history…</td></tr> : orders.map((o, i) => <tr key={`${o.id}-${i}`}><td><strong>{o.orderNo}</strong></td><td>{o.customer}</td><td>{dateValue(o.date)}</td><td>{dateValue(o.startDate)}</td><td>{dateValue(o.endDate)}</td><td>{number(o.qty)}</td><td><strong>{money(o.amount)}</strong></td></tr>)}
        {!loading && !orders.length && <tr><td colSpan="7" className="pr-modal-empty">No matching orders found.</td></tr>}
      </tbody></table></div>
      <footer className="pr-modal-footer"><span>Dates support Firestore Timestamp and date-string values.</span><button onClick={onClose}>Close details</button></footer>
    </section>
  </div>;
}

// Counts every asset linked to a product, plus the subset currently in stock.
function buildAvailableInventoryMap(assetsSnap) {
  const counts = {};
  assetsSnap.forEach((assetDoc) => {
    const asset = assetDoc.data() || {};
    if (!asset.productId) return;
    if (!counts[asset.productId]) counts[asset.productId] = { total: 0, available: 0 };
    counts[asset.productId].total += 1;
    const status = String(asset.status || "in_stock").toLowerCase();
    if (status === "in_stock") counts[asset.productId].available += 1;
  });
  return counts;
}

async function getProductsMap() {
  const snap = await getDocs(collection(db, "products"));
  const map = {};
  snap.forEach((d) => { map[d.id] = { name: d.data()?.name || d.id, sku: d.data()?.sku || "" }; });
  return map;
}
async function rebuildProductReport() {
  const productsMap = await getProductsMap();
  const ordersSnap = await getDocs(collection(db, "orders"));
  const map = {};
  ordersSnap.forEach((docSnap) => {
    const order = docSnap.data() || {};
    (order.items || []).forEach((item) => {
      if (!item.productId) return;
      if (!map[item.productId]) map[item.productId] = {
        productId: item.productId, productName: productsMap[item.productId]?.name || item.productName || item.productId,
        sku: productsMap[item.productId]?.sku || item.sku || "", totalQty: 0, totalRevenue: 0, orders: new Set(),
      };
      map[item.productId].totalQty += Number(item.qty || 0);
      map[item.productId].totalRevenue += Number(item.amount ?? (Number(item.qty || 0) * Number(item.rate || 0)));
      map[item.productId].orders.add(docSnap.id);
    });
  });
  const writes = Object.values(map).map((p) => setDoc(doc(db, "reports_products", p.productId), {
    productId: p.productId, productName: p.productName, sku: p.sku,
    totalQty: p.totalQty, totalRevenue: p.totalRevenue, orderCount: p.orders.size,
    avgRate: p.totalQty ? p.totalRevenue / p.totalQty : 0, lastUpdated: serverTimestamp(),
  }));
  await Promise.all(writes);
}
async function buildProductReportByDate(start, end, ordersSnap) {
  const productsMap = await getProductsMap();
  const map = {};
  ordersSnap.forEach((docSnap) => {
    const order = docSnap.data() || {};
    (order.items || []).forEach((item) => {
      if (!item.productId) return;
      if (!map[item.productId]) map[item.productId] = {
        productId: item.productId, productName: productsMap[item.productId]?.name || item.productName || item.productId,
        sku: productsMap[item.productId]?.sku || item.sku || "", totalQty: 0, totalRevenue: 0, orders: new Set(),
      };
      map[item.productId].totalQty += Number(item.qty || 0);
      map[item.productId].totalRevenue += Number(item.amount ?? (Number(item.qty || 0) * Number(item.rate || 0)));
      map[item.productId].orders.add(docSnap.id);
    });
  });
  return { products: Object.values(map).map((p) => ({
    productId: p.productId, productName: p.productName, sku: p.sku,
    totalQty: p.totalQty, totalRevenue: p.totalRevenue, orderCount: p.orders.size,
    avgRate: p.totalQty ? p.totalRevenue / p.totalQty : 0,
  })) };
}
function exportCSV(rows) {
  const header = ["Product", "SKU", "Quantity", "Revenue", "Unique Orders", "Average Rate"];
  const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = [header.map(escape).join(","), ...rows.map((p) => [
    p.productName, p.sku, p.totalQty, p.totalRevenue, p.orderCount, p.avgRate,
  ].map(escape).join(","))].join("\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "product-performance-report.csv"; a.click();
  URL.revokeObjectURL(url);
}
