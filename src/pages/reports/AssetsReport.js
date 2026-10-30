import React, { useCallback, useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line
} from "recharts";
import "./AssetsReport.css";

const COLORS = ["#16a36b", "#6258e8", "#f59e0b", "#0ea5e9", "#e05b66"];
const money = (n) => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 0
}).format(Number(n) || 0);

function toDate(value) {
  if (!value) return null;
  const d = value?.toDate ? value.toDate()
    : value?.seconds ? new Date(value.seconds * 1000)
    : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
function dateLabel(value) {
  const d = toDate(value);
  return d ? d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
}
function daysBetween(start, end) {
  const a = toDate(start), b = toDate(end);
  if (!a || !b) return null;
  const aa = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const bb = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.max(0, Math.round((bb - aa) / 86400000));
}
function assetCost(asset) {
  // Support common purchase-cost field names without changing the stored asset.
  const candidates = [
    asset.purchasePricePerUnit, asset.purchasePrice, asset.purchaseRate,
    asset.purchaseCost, asset.costPrice, asset.buyingPrice, asset.unitCost
  ];
  const found = candidates.find(v => v !== undefined && v !== null && v !== "");
  return Math.max(0, Number(found) || 0);
}
function normalizedStatus(status) {
  return String(status || "unknown").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export default function AssetsReport() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("profitDate");
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");

  const loadReport = useCallback(async () => {
    setError("");
    const [assetSnap, orderSnap, productSnap] = await Promise.all([
      getDocs(collection(db, "assets")),
      getDocs(collection(db, "orders")),
      getDocs(collection(db, "products"))
    ]);

    const productNames = {};
    productSnap.forEach(d => {
      const p = d.data() || {};
      productNames[d.id] = p.name || p.productName || p.title || d.id;
    });

    // Revenue is derived from item.amount, which Orders.js recalculates as qty * rate.
    // OrderDrawer adds extension charges into rate, so extensionHistory must NOT be added again.
    const rentalsByAsset = {};
    orderSnap.forEach(orderDoc => {
      const order = orderDoc.data() || {};
      const state = String(order.status || order.orderStatus || "").toLowerCase();
      if (["cancelled", "canceled", "deleted", "void"].includes(state)) return;

      (order.items || []).forEach((item, itemIndex) => {
        const assigned = [...new Set((Array.isArray(item.assignedAssets) ? item.assignedAssets : []).filter(Boolean))];
        if (!assigned.length) return;

        const lineAmount = Number(item.amount ?? (Number(item.qty || 0) * Number(item.rate || 0))) || 0;
        // One order line may cover several physical assets. Split its amount so revenue isn't duplicated.
        const perAssetRevenue = lineAmount / assigned.length;
        const orderDate = toDate(order.createdAt) || toDate(order.orderDate);
        const rentalStart = toDate(item.actualStartDate) || toDate(item.expectedStartDate) || orderDate;
        const rentalEnd = toDate(item.actualEndDate) || toDate(item.expectedEndDate) || null;

        assigned.forEach(assetId => {
          (rentalsByAsset[assetId] ||= []).push({
            orderId: orderDoc.id,
            orderNo: order.orderNo || orderDoc.id,
            customer: order.customerName || order.customer || "—",
            itemName: item.name || item.productName || "",
            itemIndex,
            orderDate,
            rentalStart,
            rentalEnd,
            lineAmount,
            allocatedRevenue: perAssetRevenue,
            assignedAssetCount: assigned.length,
            extensionCount: (item.extensionHistory || []).length
          });
        });
      });
    });

    const rows = assetSnap.docs.map(assetDoc => {
      const a = assetDoc.data() || {};
      const cost = assetCost(a);
      const purchaseDate = toDate(a.purchaseDate) || toDate(a.purchasedAt) || toDate(a.createdAt);
      const rentals = (rentalsByAsset[assetDoc.id] || [])
        .sort((x, y) => (x.rentalStart?.getTime() || x.orderDate?.getTime() || 0) -
                        (y.rentalStart?.getTime() || y.orderDate?.getTime() || 0));

      let cumulative = 0;
      let breakEvenDate = null;
      let profitStartDate = null;
      let firstRental = null;
      const history = rentals.map(r => {
        if (!firstRental) firstRental = r.rentalStart || r.orderDate;
        cumulative += r.allocatedRevenue;
        if (!breakEvenDate && cost > 0 && cumulative >= cost) breakEvenDate = r.rentalStart || r.orderDate;
        // Profit starts only after cumulative rental revenue is strictly greater than purchase cost.
        if (!profitStartDate && cost > 0 && cumulative > cost) profitStartDate = r.rentalStart || r.orderDate;
        return { ...r, cumulativeRevenue: cumulative, remainingToRecover: Math.max(0, cost - cumulative),
          profitAfterPurchase: Math.max(0, cumulative - cost) };
      });

      const totalRevenue = rentals.reduce((sum, r) => sum + r.allocatedRevenue, 0);
      const profit = totalRevenue - cost;
      const profitDays = profitStartDate && purchaseDate ? daysBetween(purchaseDate, profitStartDate) : null;
      const breakEvenDays = breakEvenDate && purchaseDate ? daysBetween(purchaseDate, breakEvenDate) : null;
      return {
        id: assetDoc.id,
        assetId: a.assetId || assetDoc.id,
        productId: a.productId || "",
        productName: productNames[a.productId] || a.productName || a.productId || "Unknown product",
        branchId: a.branchId || "",
        supplier: a.purchaseSupplier || a.supplier || "",
        status: a.status || "in_stock",
        purchaseDate,
        cost,
        rentals: history,
        timesRented: history.length,
        firstRentalDate: firstRental,
        totalRevenue,
        profit,
        roi: cost > 0 ? profit / cost * 100 : null,
        breakEvenDate,
        breakEvenDays,
        profitStartDate,
        profitDays,
        remainingToRecover: Math.max(0, cost - totalRevenue),
        recovered: cost > 0 && totalRevenue >= cost,
        profitable: cost > 0 && totalRevenue > cost,
        lastRentalDate: history.length ? (history[history.length - 1].rentalEnd || history[history.length - 1].rentalStart) : null
      };
    });
    setAssets(rows);
  }, []);

  useEffect(() => {
    (async () => {
      try { await loadReport(); }
      catch (e) { console.error("Assets profit report:", e); setError(e?.message || "Unable to load asset report."); }
      finally { setLoading(false); }
    })();
  }, [loadReport]);

  const kpis = useMemo(() => {
    const totalCost = assets.reduce((s, a) => s + a.cost, 0);
    const revenue = assets.reduce((s, a) => s + a.totalRevenue, 0);
    const profitable = assets.filter(a => a.profitable).length;
    const recovered = assets.filter(a => a.recovered).length;
    const profitDurations = assets.map(a => a.profitDays).filter(v => v !== null);
    return {
      total: assets.length, totalCost, revenue, netProfit: revenue - totalCost,
      profitable, recovered,
      notRecovered: assets.filter(a => a.cost > a.totalRevenue).length,
      avgProfitDays: profitDurations.length ? profitDurations.reduce((s, v) => s + v, 0) / profitDurations.length : null,
      inStock: assets.filter(a => a.status === "in_stock").length,
      reserved: assets.filter(a => a.status === "reserved").length,
      checkedOut: assets.filter(a => a.status === "checked_out" || a.status === "out_for_rental").length
    };
  }, [assets]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const data = assets.filter(a =>
      (statusFilter === "all" || a.status === statusFilter) &&
      (!q || [a.assetId, a.productName, a.branchId, a.supplier].some(v => String(v).toLowerCase().includes(q)))
    );
    const sorts = {
      profitDate: (a, b) => (a.profitDays ?? Infinity) - (b.profitDays ?? Infinity),
      revenue: (a, b) => b.totalRevenue - a.totalRevenue,
      profit: (a, b) => b.profit - a.profit,
      roi: (a, b) => (b.roi ?? -Infinity) - (a.roi ?? -Infinity),
      rented: (a, b) => b.timesRented - a.timesRented,
      cost: (a, b) => b.cost - a.cost
    };
    return data.sort(sorts[sortBy] || sorts.profitDate);
  }, [assets, search, statusFilter, sortBy]);

  const statusData = [
    { name: "In Stock", value: kpis.inStock },
    { name: "Reserved", value: kpis.reserved },
    { name: "Checked Out", value: kpis.checkedOut },
    { name: "Other", value: Math.max(0, kpis.total - kpis.inStock - kpis.reserved - kpis.checkedOut) }
  ].filter(x => x.value > 0);
  const topAssets = [...assets].filter(a => a.totalRevenue > 0).sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 8)
    .map(a => ({ asset: a.assetId, revenue: Math.round(a.totalRevenue), cost: Math.round(a.cost) }));

  async function refresh() {
    setRefreshing(true);
    try { await loadReport(); }
    catch (e) { setError(e?.message || "Refresh failed."); }
    finally { setRefreshing(false); }
  }

  if (loading) return <div className="ar-loading"><i /><b>Calculating asset profitability…</b><span>Matching rental income against each asset's purchase cost.</span></div>;

  return <main className="assets-report">
    <header className="ar-hero">
      <div><div className="ar-eyebrow">INVENTORY · PROFITABILITY INTELLIGENCE</div><h1>Asset Profitability</h1>
        <p>See when each rental asset recovers its purchase cost and starts generating profit.</p></div>
      <button className="ar-refresh" onClick={refresh} disabled={refreshing}>{refreshing ? "Refreshing…" : "↻ Refresh report"}</button>
    </header>
    {error && <div className="ar-error">{error}</div>}

    <section className="ar-kpis">
      <Kpi label="Total assets" value={kpis.total.toLocaleString("en-IN")} hint={`${kpis.inStock} currently in stock`} icon="▦" />
      <Kpi label="Purchase investment" value={money(kpis.totalCost)} hint="Total recorded purchase cost" icon="₹" />
      <Kpi label="Rental revenue" value={money(kpis.revenue)} hint="Includes base rental + saved extensions" icon="↗" />
      <Kpi label="Profit / loss" value={money(kpis.netProfit)} hint="Rental revenue less purchase investment" icon="⌁" positive={kpis.netProfit >= 0} />
      <Kpi label="Assets generating profit" value={`${kpis.profitable} / ${kpis.total}`} hint={`${kpis.recovered} have at least recovered cost`} icon="✓" positive />
      <Kpi label="Average days to profit" value={kpis.avgProfitDays === null ? "—" : `${kpis.avgProfitDays.toFixed(1)} days`} hint="Purchase date until revenue exceeded cost" icon="◷" />
    </section>

    <section className="ar-recovery">
      <div className="ar-recovery-icon">↗</div>
      <div className="ar-recovery-copy"><b>Capital recovery snapshot</b>
        <span>{kpis.profitable} assets are generating profit · {kpis.notRecovered} have not yet recovered their purchase cost.</span></div>
      <div className="ar-recovery-meter"><b>{kpis.total ? (kpis.profitable / kpis.total * 100).toFixed(1) : "0.0"}%</b>
        <div><i style={{ width: `${kpis.total ? kpis.profitable / kpis.total * 100 : 0}%` }} /></div><small>assets profitable</small></div>
    </section>

    <section className="ar-charts">
      <article className="ar-panel"><PanelTitle title="Asset status" sub="Current distribution across your inventory" />
        {statusData.length ? <div className="ar-donut"><ResponsiveContainer width="100%" height={220}><PieChart>
          <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={3}>
            {statusData.map((x, i) => <Cell key={x.name} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
          <div className="ar-legend">{statusData.map((x, i) => <div key={x.name}><i style={{ background: COLORS[i % COLORS.length] }} /><span>{x.name}</span><b>{x.value}</b></div>)}</div></div> : <Empty text="No status data available." />}
      </article>
      <article className="ar-panel"><PanelTitle title="Revenue vs purchase cost" sub="Top earning individual assets" />
        {topAssets.length ? <ResponsiveContainer width="100%" height={250}><BarChart data={topAssets} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0f5" /><XAxis dataKey="asset" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} />
          <Tooltip formatter={v => money(v)} /><Bar dataKey="revenue" name="Rental revenue" fill="#6258e8" radius={[6, 6, 0, 0]} /><Bar dataKey="cost" name="Purchase cost" fill="#cbd5e1" radius={[6, 6, 0, 0]} />
        </BarChart></ResponsiveContainer> : <Empty text="Rental revenue will appear once assigned assets have order income." />}
      </article>
    </section>

    <section className="ar-panel ar-table-panel">
      <div className="ar-table-head"><PanelTitle title="Asset-wise profit journey" sub="Purchase → first rental → cost recovery → profit generation" /><span className="ar-count">{filtered.length} assets</span></div>
      <div className="ar-filters">
        <label className="ar-search">⌕ <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search asset, product, branch or supplier…" /></label>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="all">All statuses</option><option value="in_stock">In stock</option><option value="reserved">Reserved</option><option value="checked_out">Checked out</option><option value="out_for_rental">Out for rental</option></select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}><option value="profitDate">Sort: Fastest to profit</option><option value="revenue">Sort: Revenue</option><option value="profit">Sort: Profit</option><option value="roi">Sort: ROI</option><option value="rented">Sort: Times rented</option><option value="cost">Sort: Purchase cost</option></select>
      </div>
      <div className="ar-table-scroll"><table className="ar-table"><thead><tr>
        <th>Asset / Product</th><th>Purchase date</th><th>Purchase cost</th><th>First rental</th><th>First rental income</th>
        <th>Times rented</th><th>Total revenue</th><th>Cost recovery</th><th>Days to profit</th><th>Profit / loss</th><th>ROI</th>
      </tr></thead><tbody>
        {filtered.map(a => <tr key={a.id} onClick={() => setSelected(a)}>
          <td><b>{a.assetId}</b><small>{a.productName}</small><em className={`ar-status ar-${a.status}`}>{normalizedStatus(a.status)}</em></td>
          <td>{dateLabel(a.purchaseDate)}</td><td>{money(a.cost)}</td>
          <td>{dateLabel(a.firstRentalDate)}</td><td>{a.rentals.length ? money(a.rentals[0].allocatedRevenue) : "—"}</td>
          <td>{a.timesRented}</td><td className="ar-purple">{money(a.totalRevenue)}</td>
          <td><RecoveryPill asset={a} /></td>
          <td>{a.profitDays === null ? (a.cost > 0 ? "Not profitable yet" : "Add purchase cost") : <strong className="ar-green">{a.profitDays} days</strong>}</td>
          <td className={a.profit >= 0 ? "ar-green" : "ar-red"}>{money(a.profit)}</td>
          <td>{a.roi === null ? "—" : <span className={a.roi >= 0 ? "ar-green" : "ar-red"}>{a.roi.toFixed(1)}%</span>}</td>
        </tr>)}
        {!filtered.length && <tr><td colSpan="11"><Empty text="No assets match your filters." /></td></tr>}
      </tbody></table></div>
      <footer className="ar-footnote">Click any asset to see each rental's income, cumulative recovery and the exact rental at which it moved into profit.</footer>
    </section>
    {selected && <AssetDetail asset={selected} close={() => setSelected(null)} />}
  </main>;
}

function Kpi({ label, value, hint, icon, positive }) {
  return <article className="ar-kpi"><div className="ar-kpi-top"><span>{label}</span><i>{icon}</i></div>
    <strong className={positive === undefined ? "" : positive ? "ar-green" : "ar-red"}>{value}</strong><small>{hint}</small></article>;
}
function PanelTitle({ title, sub }) { return <div className="ar-panel-title"><h2>{title}</h2><p>{sub}</p></div>; }
function Empty({ text }) { return <div className="ar-empty">{text}</div>; }
function RecoveryPill({ asset }) {
  if (!asset.cost) return <span className="ar-pill ar-neutral">Purchase cost missing</span>;
  if (asset.profitable) return <span className="ar-pill ar-profit">Profit started</span>;
  if (asset.recovered) return <span className="ar-pill ar-break">Break-even</span>;
  return <span className="ar-pill ar-pending">{money(asset.remainingToRecover)} left</span>;
}
function AssetDetail({ asset: a, close }) {
  return <div className="ar-backdrop" onMouseDown={e => e.target === e.currentTarget && close()}>
    <section className="ar-modal">
      <header><div><div className="ar-eyebrow">ASSET PROFIT JOURNEY</div><h2>{a.assetId}</h2><p>{a.productName}</p></div><button onClick={close}>×</button></header>
      <div className="ar-modal-kpis">
        <div><small>Purchase cost</small><b>{money(a.cost)}</b></div><div><small>Total rental income</small><b>{money(a.totalRevenue)}</b></div>
        <div><small>Profit / loss</small><b className={a.profit >= 0 ? "ar-green" : "ar-red"}>{money(a.profit)}</b></div>
        <div><small>Days to profit</small><b>{a.profitDays === null ? "Not yet profitable" : `${a.profitDays} days`}</b></div>
      </div>
      <div className="ar-journey">
        <div><span>Purchased</span><b>{dateLabel(a.purchaseDate)}</b></div>
        <div><span>First rental</span><b>{dateLabel(a.firstRentalDate)}</b></div>
        <div><span>Break-even</span><b>{a.breakEvenDate ? dateLabel(a.breakEvenDate) : "Not reached"}</b></div>
        <div className={a.profitable ? "is-profit" : ""}><span>Profit started</span><b>{a.profitStartDate ? `${dateLabel(a.profitStartDate)} · ${a.profitDays} days after purchase` : "Not yet profitable"}</b></div>
      </div>
      <h3>Rental-by-rental recovery history</h3>
      <div className="ar-history-scroll"><table className="ar-table"><thead><tr>
        <th>Order</th><th>Customer</th><th>Rental start</th><th>Rental end</th><th>Rental income</th><th>Cumulative income</th><th>Still to recover</th><th>Profit after cost</th>
      </tr></thead><tbody>
        {a.rentals.map((r, i) => <tr key={`${r.orderId}-${r.itemIndex}-${i}`}>
          <td>{r.orderNo}</td><td>{r.customer}</td><td>{dateLabel(r.rentalStart)}</td><td>{dateLabel(r.rentalEnd)}</td>
          <td>{money(r.allocatedRevenue)}</td><td>{money(r.cumulativeRevenue)}</td><td>{money(r.remainingToRecover)}</td>
          <td className={r.profitAfterPurchase > 0 ? "ar-green" : ""}>{money(r.profitAfterPurchase)}</td>
        </tr>)}
        {!a.rentals.length && <tr><td colSpan="8">No assigned rental orders found for this asset.</td></tr>}
      </tbody></table></div>
      <p className="ar-note">A rental contributes the order item's saved amount, split equally between its assigned physical assets. The extension price is already included in the updated item rate/amount in OrderDrawer, so extensionHistory is not added a second time. Break-even is when cumulative income reaches purchase cost; profit starts on the first rental where cumulative income exceeds purchase cost.</p>
    </section>
  </div>;
}
