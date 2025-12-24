import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from "recharts";
import "./ProductReport.css";

const COLORS = ["#22c55e", "#6366f1", "#f59e0b", "#ef4444"];

export default function AssetsReport() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAssetsReport();
  }, []);

  async function loadAssetsReport() {
    setLoading(true);
    const snap = await getDocs(collection(db, "reports_assets"));

    if (snap.empty) {
      await rebuildAssetsReport();
      return loadAssetsReport();
    }

    setAssets(snap.docs.map((d) => d.data()));
    setLoading(false);
  }

  /* ---------- KPIs ---------- */
  const kpis = useMemo(() => {
    const total = assets.length;
    const inStock = assets.filter((a) => a.status === "in_stock").length;
    const reserved = assets.filter((a) => a.status === "reserved").length;
    const checkedOut = assets.filter((a) => a.status === "checked_out").length;

    const avgUtil =
      assets.reduce((s, a) => s + (a.utilization || 0), 0) /
      (assets.length || 1);

    return { total, inStock, reserved, checkedOut, avgUtil };
  }, [assets]);

  const statusPie = [
    { name: "In Stock", value: kpis.inStock },
    { name: "Reserved", value: kpis.reserved },
    { name: "Checked Out", value: kpis.checkedOut },
  ];

  if (loading) return <div className="report-loading">Loading Assets Report…</div>;

  return (
    <div className="report-page">
      <h1>🏗 Asset Report</h1>
      <p className="muted">Asset utilization, status and performance</p>

      <button
        className="rebuild-btn"
        onClick={async () => {
          await rebuildAssetsReport();
          await loadAssetsReport();
          alert("Assets report rebuilt");
        }}
      >
        🔄 Rebuild Report
      </button>

      {/* KPIs */}
      <div className="kpi-grid">
        <Kpi label="Total Assets" value={kpis.total} />
        <Kpi label="In Stock" value={kpis.inStock} />
        <Kpi label="Reserved" value={kpis.reserved} />
        <Kpi label="Checked Out" value={kpis.checkedOut} />
        <Kpi label="Avg Utilization %" value={kpis.avgUtil.toFixed(1)} />
      </div>

      {/* Charts */}
      <div className="charts-grid">
        <ChartCard title="Asset Status Distribution">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={statusPie} dataKey="value" outerRadius={90}>
                {statusPie.map((_, i) => (
                  <Cell key={i} fill={COLORS[i]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top Utilized Assets">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={[...assets].sort((a, b) => b.utilization - a.utilization).slice(0, 10)}>
              <XAxis dataKey="assetId" hide />
              <YAxis />
              <Tooltip />
              <Bar dataKey="utilization" fill="#6366f1" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Table */}
      <div className="report-table">
        <table>
          <thead>
            <tr>
              <th>Asset</th>
              <th>Product</th>
              <th>Status</th>
              <th>Times Rented</th>
              <th>Utilization %</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a) => (
              <tr key={a.assetId}>
                <td>{a.assetId}</td>
                <td>{a.productName}</td>
                <td>{a.status}</td>
                <td>{a.timesRented}</td>
                <td>{a.utilization.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- UI COMPONENTS ---------- */

function Kpi({ label, value }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
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

/* ---------- REPORT BUILDER ---------- */

async function rebuildAssetsReport() {
  const assetsSnap = await getDocs(collection(db, "assets"));
  const ordersSnap = await getDocs(collection(db, "orders"));
  const productsSnap = await getDocs(collection(db, "products"));

  const productsMap = {};
  productsSnap.forEach((p) => {
    productsMap[p.id] = p.data()?.name || p.id;
  });

  const usage = {};

  ordersSnap.forEach((o) => {
    const order = o.data();
    (order.items || []).forEach((it) => {
      (it.assignedAssets || []).forEach((aid) => {
        if (!usage[aid]) usage[aid] = 0;
        usage[aid] += 1;
      });
    });
  });

  for (const a of assetsSnap.docs) {
    const asset = a.data();
    const timesRented = usage[a.id] || 0;

    const utilization = Math.min(100, timesRented * 10); // heuristic

    await setDoc(doc(db, "reports_assets", a.id), {
      assetId: asset.assetId || a.id,
      productName: productsMap[asset.productId] || asset.productId,
      status: asset.status || "in_stock",
      timesRented,
      utilization,
      lastUpdated: serverTimestamp(),
    });
  }
}
