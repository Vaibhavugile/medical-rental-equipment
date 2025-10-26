// src/pages/Products.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
  increment,
  writeBatch,
  getDocs,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import {
  createAssetsForProduct,
  listAssets,
  listBranches,
  checkoutAsset,
  checkinAsset,
  changeAssetStatus,
  moveAssetToBranch,
} from "../utils/inventory";
import "./Products.css";
import "./Leads.css";

/**
 * Products page — client-side counts + reservation support
 *
 * Features:
 * - Realtime global assets listener builds:
 *     productAssetCounts: {productId: total}
 *     productAssetStatusCounts: {productId: {in_stock, out_for_rental, maintenance, reserved, other}}
 * - Reserve & Release flows (client-side) using changeAssetStatus helper
 * - Create assets with optimistic increment of product.assetCount
 * - Sync counts button to persist computed counts into product docs
 *
 * Notes:
 * - If your `assets` collection path differs (e.g., inventory/assets), change collection(db, "assets").
 * - changeAssetStatus(...) must accept (assetId, newStatus, note?, metadata?) here. Adapt if different.
 */

export default function Products() {
  const [products, setProducts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [assetsForProduct, setAssetsForProduct] = useState([]); // assets for selected product
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [error, setError] = useState("");

  // UI state
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [productForm, setProductForm] = useState({ name: "", sku: "", description: "", defaultRate: 0, category: "beds" });

  // asset create / filters
  const [assetQty, setAssetQty] = useState(1);
  const [assetBranch, setAssetBranch] = useState("");
  const [assetMetaJSON, setAssetMetaJSON] = useState("{}");
  const [productQuery, setProductQuery] = useState("");
  const [assetSearch, setAssetSearch] = useState("");
  const [assetStatusFilter, setAssetStatusFilter] = useState("");
  const [assetBranchFilter, setAssetBranchFilter] = useState("");
  const [pageSize, setPageSize] = useState(25);

  // maintenance modal
  const [maintenanceModalOpen, setMaintenanceModalOpen] = useState(false);
  const [maintenanceAsset, setMaintenanceAsset] = useState(null);
  const [maintenanceTechnician, setMaintenanceTechnician] = useState("");
  const [maintenanceNote, setMaintenanceNote] = useState("");
  const [maintenanceActionLoading, setMaintenanceActionLoading] = useState(false);

  // asset details modal
  const [assetDetailsOpen, setAssetDetailsOpen] = useState(false);
  const [assetDetails, setAssetDetails] = useState(null);

  // counts built from assets realtime listener
  const [productAssetCounts, setProductAssetCounts] = useState({}); // {productId: total}
  const [productAssetStatusCounts, setProductAssetStatusCounts] = useState({}); // {productId: {in_stock, out_for_rental, maintenance, reserved, other}}

  /* ---------- products & branches realtime ---------- */
  useEffect(() => {
    setLoadingProducts(true);
    const qP = query(collection(db, "products"), orderBy("name", "asc"));
    const unsubP = onSnapshot(
      qP,
      (snap) => {
        setProducts(snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) })));
        setLoadingProducts(false);
      },
      (err) => {
        console.error("products snapshot", err);
        setLoadingProducts(false);
      }
    );

    const qB = query(collection(db, "branches"), orderBy("name", "asc"));
    const unsubB = onSnapshot(
      qB,
      (snap) => setBranches(snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }))),
      (err) => console.error("branches snapshot", err)
    );

    return () => {
      try { unsubP(); unsubB(); } catch (e) {}
    };
  }, []);

  /* ---------- global assets realtime listener to build counts ---------- */
  useEffect(() => {
    // Warning: for very large assets collections this listener may be heavy.
    // Consider server-side aggregation or limiting the listener if needed.
    const qAll = query(collection(db, "assets"), orderBy("productId"));
    const unsub = onSnapshot(
      qAll,
      (snap) => {
        const totals = {};
        const statusTotals = {};
        snap.docs.forEach((d) => {
          const a = d.data() || {};
          const pid = a.productId;
          if (!pid) return;
          totals[pid] = (totals[pid] || 0) + 1;

          const st = a.status || "in_stock";
          if (!statusTotals[pid]) statusTotals[pid] = { in_stock: 0, out_for_rental: 0, maintenance: 0, reserved: 0, other: 0 };
          if (["in_stock", "out_for_rental", "maintenance", "reserved"].includes(st)) {
            statusTotals[pid][st] = (statusTotals[pid][st] || 0) + 1;
          } else {
            statusTotals[pid].other = (statusTotals[pid].other || 0) + 1;
          }
        });
        setProductAssetCounts(totals);
        setProductAssetStatusCounts(statusTotals);
      },
      (err) => {
        console.error("assets listener error", err);
      }
    );

    return () => {
      try { unsub(); } catch (e) {}
    };
  }, []);

  /* ---------- load assets for selected product ---------- */
  useEffect(() => {
    const load = async () => {
      if (!selectedProduct) {
        setAssetsForProduct([]);
        return;
      }
      try {
        const list = await listAssets({ productId: selectedProduct.id });
        setAssetsForProduct(list);
      } catch (err) {
        console.error("listAssets", err);
        setAssetsForProduct([]);
      }
    };
    load();
  }, [selectedProduct]);

  /* ---------- derived / filters ---------- */
  const filteredProducts = useMemo(() => {
    const q = (productQuery || "").trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => (p.name || "").toLowerCase().includes(q) || (p.sku || "").toLowerCase().includes(q));
  }, [products, productQuery]);

  const visibleAssets = useMemo(() => {
    let list = (assetsForProduct || []).slice();
    if (assetStatusFilter) list = list.filter((a) => (a.status || "") === assetStatusFilter);
    if (assetBranchFilter) list = list.filter((a) => (a.branchId || "") === assetBranchFilter);
    if (assetSearch) {
      const s = assetSearch.trim().toLowerCase();
      list = list.filter((a) => (a.assetId || "").toLowerCase().includes(s) || (a.metadata?.model || "").toLowerCase().includes(s));
    }
    return list.slice(0, pageSize);
  }, [assetsForProduct, assetStatusFilter, assetBranchFilter, assetSearch, pageSize]);

  const formatDate = (ts) => {
    if (!ts) return "—";
    if (ts.seconds) return new Date(ts.seconds * 1000).toLocaleString();
    try { return new Date(ts).toLocaleString(); } catch { return "—"; }
  };

  /* ---------- product creation ---------- */
  const openAddProduct = () => {
    setProductForm({ name: "", sku: "", description: "", defaultRate: 0, category: "beds" });
    setAddProductOpen(true);
  };
  const submitAddProduct = async (e) => {
    e?.preventDefault();
    if (!productForm.name?.trim()) return setError("Product name required");
    try {
      const user = auth.currentUser || {};
      await addDoc(collection(db, "products"), {
        ...productForm,
        defaultRate: Number(productForm.defaultRate || 0),
        createdAt: serverTimestamp(),
        createdBy: user.uid || "",
        createdByName: user.displayName || user.email || "",
        assetCount: productForm.assetCount ? Number(productForm.assetCount) : 0,
        assetCounts: productForm.assetCounts || null,
      });
      setAddProductOpen(false);
    } catch (err) {
      console.error("add product", err);
      setError(err.message || "Failed to add product");
    }
  };

  /* ---------- create assets + optimistic increment ---------- */
  const onCreateAssets = async () => {
    setError("");
    if (!selectedProduct) return setError("Select a product first.");
    if (!assetQty || Number(assetQty) < 1) return setError("Quantity must be >= 1");
    let meta = {};
    if (assetMetaJSON && assetMetaJSON.trim()) {
      try { meta = JSON.parse(assetMetaJSON); } catch { return setError("Invalid metadata JSON"); }
    }
    try {
      const created = await createAssetsForProduct(selectedProduct.id, assetBranch || null, Number(assetQty || 1), { model: selectedProduct.name, ...meta }, "in_stock");

      // optimistic DB update for product.assetCount
      try {
        const prodRef = doc(db, "products", selectedProduct.id);
        await updateDoc(prodRef, { assetCount: increment(Number(assetQty || 1)) });
      } catch (incErr) {
        console.warn("optimistic increment failed", incErr);
      }

      // refresh drawer assets
      const refreshed = await listAssets({ productId: selectedProduct.id });
      setAssetsForProduct(refreshed);
      alert(`Created ${Array.isArray(created) ? created.length : Number(assetQty)} assets for ${selectedProduct.name}`);
    } catch (err) {
      console.error("createAssetsForProduct", err);
      setError(err.message || "Failed to create assets");
    }
  };

  /* ---------- asset actions (checkout/checkin/move) ---------- */
  const refreshAssets = async () => {
    if (!selectedProduct) return;
    try {
      const refreshed = await listAssets({ productId: selectedProduct.id });
      setAssetsForProduct(refreshed);
    } catch (err) {
      console.error("refresh assets", err);
      setError(err.message || "Failed to refresh assets");
    }
  };

  const doCheckout = async (assetDocId) => {
    try {
      await checkoutAsset(assetDocId, { note: "Checked out via UI" });
      await refreshAssets();
    } catch (err) { console.error(err); setError(err.message || "Checkout failed"); }
  };
  const doCheckin = async (assetDocId) => {
    try {
      await checkinAsset(assetDocId, { note: "Checked in via UI" });
      await refreshAssets();
    } catch (err) { console.error(err); setError(err.message || "Checkin failed"); }
  };
  const doMove = async (assetDocId, toBranchId) => {
    if (!toBranchId) return;
    try {
      await moveAssetToBranch(assetDocId, toBranchId, `Moved via UI to branch ${toBranchId}`);
      await refreshAssets();
    } catch (err) { console.error(err); setError(err.message || "Move failed"); }
  };

  /* ---------- reservation support: reserve & release ---------- */
  const reserveAsset = async (assetDocId, reservedForName) => {
    try {
      if (!assetDocId) return;
      const note = reservedForName ? `Reserved for ${reservedForName}` : `Reserved`;
      // store reservedFor and reservedAt in metadata
      await changeAssetStatus(assetDocId, "reserved", note, { reservedFor: reservedForName || "unknown", reservedAtISO: new Date().toISOString() });

      await refreshAssets();
    } catch (err) {
      console.error("reserveAsset", err);
      setError(err.message || "Failed to reserve asset");
    }
  };

  const releaseReservation = async (assetDocId, note = "Reservation released") => {
    try {
      if (!assetDocId) return;
      await changeAssetStatus(assetDocId, "in_stock", note, { releasedAtISO: new Date().toISOString() });
      await refreshAssets();
    } catch (err) {
      console.error("releaseReservation", err);
      setError(err.message || "Failed to release reservation");
    }
  };

  /* ---------- maintenance ---------- */
  const openMaintenanceModal = (asset) => {
    setMaintenanceAsset(asset);
    setMaintenanceTechnician("");
    setMaintenanceNote("");
    setMaintenanceModalOpen(true);
  };

  const startMaintenance = async () => {
    if (!maintenanceAsset) return;
    setMaintenanceActionLoading(true);
    try {
      const tech = maintenanceTechnician?.trim() || (auth.currentUser && (auth.currentUser.displayName || auth.currentUser.email)) || "unknown";
      const note = `Maintenance started by ${tech}${maintenanceNote ? ` — ${maintenanceNote}` : ""}`;
      await changeAssetStatus(maintenanceAsset.id, "maintenance", note, { technician: tech, phase: "start" });
      await refreshAssets();
      setMaintenanceModalOpen(false);
    } catch (err) {
      console.error("startMaintenance", err);
      setError(err.message || "Failed to start maintenance");
    } finally {
      setMaintenanceActionLoading(false);
    }
  };

  const completeMaintenance = async (condition = "ok") => {
    if (!maintenanceAsset) return;
    setMaintenanceActionLoading(true);
    try {
      const tech = maintenanceTechnician?.trim() || (auth.currentUser && (auth.currentUser.displayName || auth.currentUser.email)) || "unknown";
      const note = `Maintenance completed by ${tech}${maintenanceNote ? ` — ${maintenanceNote}` : ""}`;
      await changeAssetStatus(maintenanceAsset.id, "in_stock", note, { technician: tech, phase: "complete", condition });
      await refreshAssets();
      setMaintenanceModalOpen(false);
    } catch (err) {
      console.error("completeMaintenance", err);
      setError(err.message || "Failed to complete maintenance");
    } finally {
      setMaintenanceActionLoading(false);
    }
  };

  /* ---------- asset details ---------- */
  const openAssetDetails = (asset) => {
    setAssetDetails(asset);
    setAssetDetailsOpen(true);
  };
  const renderHistoryEntry = (h, idx) => {
    const ts = h?.ts ? new Date(h.ts).toLocaleString() : (h?.ts?.seconds ? new Date(h.ts.seconds * 1000).toLocaleString() : "—");
    return (
      <div key={idx} className="history-row">
        <div className="history-left">
          <div className="history-type">{h.type || h.changeType || "update"}</div>
          <div className="history-meta muted">{h.byName || h.changedByName || h.by || h.changedBy || "system"} · {ts}</div>
        </div>
        <div className="history-right">
          {h.note && <div className="history-note">{h.note}</div>}
          {h.data && <pre className="history-data">{JSON.stringify(h.data, null, 2)}</pre>}
        </div>
      </div>
    );
  };

  /* ---------- sync utilities (client-side) ---------- */
  const syncAllCountsToProducts = async () => {
    setError("");
    if (!window.confirm("This will write computed counts for all products into product documents (assetCount & assetCounts). Proceed?")) return;
    try {
      const prods = await getDocs(collection(db, "products"));
      // Firestore batch limit is 500 operations; handle >500 by chunking
      const docs = prods.docs;
      const chunkSize = 450; // slightly below 500 to be safe
      for (let i = 0; i < docs.length; i += chunkSize) {
        const batch = writeBatch(db);
        const slice = docs.slice(i, i + chunkSize);
        slice.forEach((pd) => {
          const pid = pd.id;
          const totals = productAssetCounts[pid] ?? 0;
          const statusCounts = productAssetStatusCounts[pid] ?? null;
          const prodRef = doc(db, "products", pid);
          batch.update(prodRef, {
            assetCount: totals,
            assetCounts: statusCounts,
            assetsLastUpdatedAt: serverTimestamp(),
          });
        });
        await batch.commit();
      }
      alert("Synced asset counts into products (for all products).");
    } catch (err) {
      console.error("syncAllCountsToProducts", err);
      setError(err.message || "Failed to sync counts");
    }
  };

  const syncSelectedProduct = async () => {
    if (!selectedProduct) return setError("Select a product first");
    if (!window.confirm(`Write computed counts into product ${selectedProduct.name}?`)) return;
    try {
      const pid = selectedProduct.id;
      const totals = productAssetCounts[pid] ?? 0;
      const statusCounts = productAssetStatusCounts[pid] ?? null;
      const prodRef = doc(db, "products", pid);
      await updateDoc(prodRef, { assetCount: totals, assetCounts: statusCounts, assetsLastUpdatedAt: serverTimestamp() });
      alert(`Synced ${totals} assets into product ${selectedProduct.name}`);
    } catch (err) {
      console.error("syncSelectedProduct", err);
      setError(err.message || "Failed to sync product");
    }
  };

  /* ---------- render ---------- */
  return (
    <div className="coupons-wrap">
      {error && <div className="coupons-error">{error}</div>}

      <header className="coupons-header">
        <div>
          <h1>🧰 Products & Inventory (with Reservations)</h1>
          <p>Realtime asset counts + reservation (reserved) support. Use "Sync counts" to persist computed counts into product docs.</p>
        </div>
        <div className="coupons-actions">
          <button className="cp-btn" onClick={() => { setProductQuery(""); setSelectedProduct(null); }}>Reset</button>
          <button className="cp-btn primary" onClick={openAddProduct}>+ Add Product</button>
          <button className="cp-btn" onClick={syncAllCountsToProducts} title="Aggregate counts and write to all product docs">Sync counts to products</button>
        </div>
      </header>

      <section className="coupons-toolbar">
        <input className="cp-input" placeholder="Search products or SKU…" value={productQuery} onChange={(e) => setProductQuery(e.target.value)} />
        <div className="muted">Products: {products.length} · Products with assets: {Object.keys(productAssetCounts).length}</div>
      </section>

      <section className="coupons-card">
        <div className="tbl-wrap">
          <table className="cp-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Rate</th>
                <th>Category</th>
                <th>Created</th>
                <th>Assets (total)</th>
                <th>In stock</th>
                <th>Out</th>
                <th>Maint.</th>
                <th>Reserved</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingProducts && <tr><td colSpan="11" className="empty">Loading products…</td></tr>}
              {!loadingProducts && filteredProducts.map((p) => {
                const total = productAssetCounts[p.id] ?? p.assetCount ?? 0;
                const status = productAssetStatusCounts[p.id] ?? {};
                return (
                  <tr key={p.id} className={selectedProduct && selectedProduct.id === p.id ? "active-row" : ""}>
                    <td className="strong">{p.name}</td>
                    <td className="muted">{p.sku || "—"}</td>
                    <td>{p.defaultRate ?? 0}</td>
                    <td className="muted">{p.category || "—"}</td>
                    <td className="muted">{formatDate(p.createdAt)}</td>
                    <td>{total}</td>
                    <td>{(status.in_stock ?? 0)}</td>
                    <td>{(status.out_for_rental ?? 0)}</td>
                    <td>{(status.maintenance ?? 0)}</td>
                    <td>{(status.reserved ?? 0)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <button className="cp-link" onClick={() => setSelectedProduct(p)}>View</button>
                        <button className="cp-link" onClick={() => { setProductForm({ ...p }); setAddProductOpen(true); }}>Edit</button>
                        <button className="cp-btn small" onClick={() => { setSelectedProduct(p); /* effect loads assets */ }}>Open</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loadingProducts && filteredProducts.length === 0 && <tr><td colSpan="11"><div className="empty">No products found.</div></td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {/* Product drawer */}
      {selectedProduct && (
        <div className="cp-drawer" onClick={(e) => { if (e.target.classList.contains("cp-drawer")) setSelectedProduct(null); }}>
          <div className="cp-form details" onClick={(e) => e.stopPropagation()}>
            <div className="cp-form-head">
              <h2>Product — {selectedProduct.name}</h2>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button className="cp-btn" onClick={syncSelectedProduct} title="Write computed counts for this product">Sync product</button>
                <button type="button" className="cp-icon" onClick={() => setSelectedProduct(null)}>✕</button>
              </div>
            </div>

            <div className="details-grid">
              <div className="details-left">
                <div className="details-row">
                  <div className="label muted">Name</div>
                  <div className="value strong">{selectedProduct.name}</div>
                </div>

                <div className="details-row">
                  <div className="label muted">SKU</div>
                  <div className="value">{selectedProduct.sku || "—"}</div>
                </div>

                <div className="details-row">
                  <div className="label muted">Rate</div>
                  <div className="value">{selectedProduct.defaultRate ?? 0}</div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <h3 style={{ margin: "8px 0" }}>Description</h3>
                  <div className="details-notes">{selectedProduct.description || "—"}</div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <h3>Create Assets</h3>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                    <input className="cp-input" type="number" min="1" value={assetQty} onChange={(e) => setAssetQty(Number(e.target.value))} style={{ width: 90 }} />
                    <select className="cp-input" value={assetBranch} onChange={(e) => setAssetBranch(e.target.value)} style={{ minWidth: 160 }}>
                      <option value="">Default branch</option>
                      {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                    <input className="cp-input" value={assetMetaJSON} onChange={(e) => setAssetMetaJSON(e.target.value)} placeholder='{"model":"X"}' />
                    <button className="cp-btn" onClick={onCreateAssets}>Create</button>
                  </div>
                </div>

              </div>

              <div>
                <div className="details-meta">
                  <div className="meta-row"><div className="label muted">Category</div><div className="value">{selectedProduct.category || "—"}</div></div>
                  <div className="meta-row"><div className="label muted">Created</div><div className="value">{formatDate(selectedProduct.createdAt)} · {selectedProduct.createdByName || selectedProduct.createdBy || "—"}</div></div>
                  <div className="meta-row"><div className="label muted">Assets (total)</div>
                    <div className="value">{productAssetCounts[selectedProduct.id] ?? selectedProduct.assetCount ?? 0}</div></div>

                  <div style={{ marginTop: 12 }}>
                    <div className="label muted">Status breakdown</div>
                    <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                      <div className="chip">In stock: {(productAssetStatusCounts[selectedProduct.id]?.in_stock ?? 0)}</div>
                      <div className="chip">Out: {(productAssetStatusCounts[selectedProduct.id]?.out_for_rental ?? 0)}</div>
                      <div className="chip">Maint: {(productAssetStatusCounts[selectedProduct.id]?.maintenance ?? 0)}</div>
                      <div className="chip">Reserved: {(productAssetStatusCounts[selectedProduct.id]?.reserved ?? 0)}</div>
                    </div>
                  </div>

                </div>
              </div>
            </div>

            <hr className="hr" />

            <div style={{ marginTop: 8 }}>
              <h3>Assets</h3>
              <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input className="cp-input" placeholder="Search assets by id or model..." value={assetSearch} onChange={(e) => setAssetSearch(e.target.value)} style={{ flex: "1 1 320px" }} />
                <select value={assetStatusFilter} onChange={(e) => setAssetStatusFilter(e.target.value)} className="cp-input" style={{ width: 160 }}>
                  <option value="">All statuses</option>
                  <option value="in_stock">In stock</option>
                  <option value="out_for_rental">Out for rental</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="reserved">Reserved</option>
                </select>
                <select value={assetBranchFilter} onChange={(e) => setAssetBranchFilter(e.target.value)} className="cp-input" style={{ width: 160 }}>
                  <option value="">All branches</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <button className="cp-btn" onClick={refreshAssets}>Refresh</button>
              </div>

              <div style={{ marginTop: 12 }} className="assets-grid">
                {visibleAssets.length === 0 && <div className="muted" style={{ padding: 12 }}>No assets matching filters.</div>}
                {visibleAssets.map((a) => (
                  <div key={a.id} className="asset-card">
                    <div className="asset-top">
                      <div>
                        <div style={{ fontWeight: 700 }}>{a.assetId}</div>
                        <div className="muted" style={{ fontSize: 12 }}>{(branches.find(b => b.id === a.branchId) || {}).name || a.branchId || "—"}</div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <div className="muted" style={{ fontSize: 12 }}>{a.metadata?.model || ""}</div>
                        <div className="muted" style={{ fontSize: 12 }}>Status: <span className={`status ${a.status}`}>{a.status}</span></div>
                      </div>
                    </div>

                    <div className="asset-meta muted">
                      {a.rental && a.rental.customer && <div>Rented to: {a.rental.customer}</div>}
                      {/* If reserved metadata saved under top-level fields or metadata, adjust accordingly */}
                      {a.reservedFor && <div>Reserved for: {a.reservedFor}</div>}
                      {a.metadata?.reservedFor && <div>Reserved for: {a.metadata.reservedFor}</div>}
                      <div>Created: {formatDate(a.createdAt)} · {a.createdByName}</div>
                    </div>

                    {/* asset actions: details / checkout / checkin / reserve / release / maintenance / move */}
                    <div className="asset-actions">
                      <button className="btn ghost" onClick={() => openAssetDetails(a)}>Details</button>

                      {/* Checkout / Checkin */}
                      {a.status !== "out_for_rental" && a.status !== "reserved" && a.status !== "maintenance" && (
                        <button className="btn" onClick={() => doCheckout(a.id)}>Checkout</button>
                      )}
                      {a.status === "out_for_rental" && (
                        <button className="btn" onClick={() => doCheckin(a.id)}>Checkin</button>
                      )}

                      {/* Reserve / Release */}
                      {a.status === "reserved" ? (
                        <button className="btn ghost" onClick={() => {
                          const ok = window.confirm(`Release reservation for ${a.assetId}?`);
                          if (ok) releaseReservation(a.id);
                        }}>Release</button>
                      ) : (
                        // allow reserve if not out_for_rental and not maintenance
                        (a.status !== "out_for_rental" && a.status !== "maintenance") && (
                          <button className="btn" onClick={() => {
                            const who = window.prompt("Reserve for (customer name / order id):", a.reservedFor || "");
                            if (who !== null) { // null = user cancelled
                              // If you want to store reservedFor in metadata vs top-level, change helper accordingly
                              reserveAsset(a.id, who.trim() || "unknown");
                            }
                          }}>Reserve</button>
                        )
                      )}

                      <button className="btn ghost" onClick={() => openMaintenanceModal(a)}>Maintenance</button>

                      <select onChange={(e) => {
                        const to = e.target.value;
                        if (!to) return;
                        doMove(a.id, to);
                        e.target.value = "";
                      }} defaultValue="">
                        <option value="">Move</option>
                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="cp-form-actions" style={{ marginTop: 12 }}>
              <button className="cp-btn ghost" onClick={() => setSelectedProduct(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Maintenance modal */}
      {maintenanceModalOpen && maintenanceAsset && (
        <div className="cp-modal" onClick={() => setMaintenanceModalOpen(false)}>
          <div className="cp-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Maintenance — {maintenanceAsset.assetId}</h3>
            <div style={{ marginTop: 8 }} className="muted">Current status: <strong style={{ textTransform: "capitalize" }}>{maintenanceAsset.status}</strong></div>

            <label style={{ display: "block", marginTop: 12, fontWeight: 600 }}>Technician / Responsible</label>
            <input value={maintenanceTechnician} onChange={(e) => setMaintenanceTechnician(e.target.value)} placeholder="Technician name or team" className="cp-input" />

            <label style={{ display: "block", marginTop: 8, fontWeight: 600 }}>Note</label>
            <textarea rows={3} value={maintenanceNote} onChange={(e) => setMaintenanceNote(e.target.value)} className="cp-input" placeholder="Describe issue, parts replaced, expected return date..." />

            <div className="cp-form-actions" style={{ marginTop: 12 }}>
              <button className="cp-btn ghost" onClick={() => setMaintenanceModalOpen(false)}>Cancel</button>
              <button className="cp-btn" onClick={startMaintenance} disabled={maintenanceActionLoading}>{maintenanceActionLoading ? "Working…" : "Start Maintenance"}</button>
              <button className="cp-btn" onClick={() => completeMaintenance("ok")} disabled={maintenanceActionLoading}>{maintenanceActionLoading ? "Working…" : "Complete (In stock)"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Asset details modal */}
      {assetDetailsOpen && assetDetails && (
        <div className="cp-modal" onClick={() => setAssetDetailsOpen(false)}>
          <div className="cp-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Asset details — {assetDetails.assetId}</h3>
            <div style={{ marginTop: 6 }} className="muted">Product: {assetDetails.productId} · Branch: {(branches.find(b => b.id === assetDetails.branchId) || {}).name || assetDetails.branchId || "—"}</div>

            <div style={{ marginTop: 12 }}>
              <h4 style={{ marginBottom: 8 }}>Metadata</h4>
              <div className="muted">
                {assetDetails.reservedFor && <div>Reserved for: {assetDetails.reservedFor}</div>}
                {assetDetails.metadata && <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(assetDetails.metadata, null, 2)}</pre>}
              </div>

              <h4 style={{ marginTop: 12, marginBottom: 8 }}>History</h4>
              <div style={{ maxHeight: 340, overflow: "auto", paddingRight: 8 }}>
                {Array.isArray(assetDetails.history) && assetDetails.history.length > 0 ? (
                  assetDetails.history.slice().reverse().map((h, i) => renderHistoryEntry(h, i))
                ) : (
                  <div className="muted">No history recorded for this asset.</div>
                )}
              </div>
            </div>

            <div className="cp-form-actions" style={{ marginTop: 12 }}>
              <button className="cp-btn ghost" onClick={() => setAssetDetailsOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Product modal */}
      {addProductOpen && (
        <div className="cp-modal" role="dialog" aria-modal="true" onClick={() => setAddProductOpen(false)}>
          <div className="cp-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>{productForm.id ? "Edit product" : "Add product"}</h3>
            <form onSubmit={submitAddProduct} className="modal-form">
              <label className="label">Name</label>
              <input value={productForm.name} onChange={(e) => setProductForm((s) => ({ ...s, name: e.target.value }))} className="cp-input" required />

              <label className="label">SKU (optional)</label>
              <input value={productForm.sku} onChange={(e) => setProductForm((s) => ({ ...s, sku: e.target.value }))} className="cp-input" />

              <label className="label">Rate</label>
              <input type="number" value={productForm.defaultRate} onChange={(e) => setProductForm((s) => ({ ...s, defaultRate: e.target.value }))} className="cp-input" />

              <label className="label">Category</label>
              <input value={productForm.category} onChange={(e) => setProductForm((s) => ({ ...s, category: e.target.value }))} className="cp-input" />

              <label className="label">Description</label>
              <textarea value={productForm.description} onChange={(e) => setProductForm((s) => ({ ...s, description: e.target.value }))} rows={3} className="cp-input" />

              <div className="cp-form-actions" style={{ marginTop: 10 }}>
                <button type="button" className="cp-btn ghost" onClick={() => setAddProductOpen(false)}>Cancel</button>
                <button className="cp-btn" type="submit">Save product</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
