// src/pages/Products.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
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

/* ─────────────────────────────────────────────────────────────
   UX helpers
────────────────────────────────────────────────────────────── */
const useDebounced = (value, delay = 300) => {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
};

const fmt = {
  date(ts) {
    if (!ts) return "—";
    if (ts.seconds) return new Date(ts.seconds * 1000).toLocaleString();
    try { return new Date(ts).toLocaleString(); } catch { return "—"; }
  },
  money(n) {
    try {
      return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } catch {
      return String(n ?? 0);
    }
  },
};

/* ─────────────────────────────────────────────────────────────
   Main
────────────────────────────────────────────────────────────── */
export default function Products() {
  // data
  const [products, setProducts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [assetsForProduct, setAssetsForProduct] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [error, setError] = useState("");

  // computed counts (live from assets listener)
  const [productAssetCounts, setProductAssetCounts] = useState({});
  const [productAssetStatusCounts, setProductAssetStatusCounts] = useState({});

  // toolbar/filter
  const [queryText, setQueryText] = useState("");
  const debouncedQuery = useDebounced(queryText, 250);

  // drawer – create assets & filters
  const [assetQty, setAssetQty] = useState(1);
  const [assetBranch, setAssetBranch] = useState("");
  const [assetMetaJSON, setAssetMetaJSON] = useState('{"model":""}');
  const [assetSearch, setAssetSearch] = useState("");
  const [assetStatusFilter, setAssetStatusFilter] = useState("");
  const [assetBranchFilter, setAssetBranchFilter] = useState("");
  const [assetPageSize, setAssetPageSize] = useState(24);

  // product modal (add/edit)
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productForm, setProductForm] = useState({ name: "", sku: "", description: "", defaultRate: "", category: "" });
  const [productFormErrors, setProductFormErrors] = useState({});
  const [savingProduct, setSavingProduct] = useState(false);

  // maintenance modal
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [maintenanceAsset, setMaintenanceAsset] = useState(null);
  const [maintenanceTechnician, setMaintenanceTechnician] = useState("");
  const [maintenanceNote, setMaintenanceNote] = useState("");
  const [maintenanceBusy, setMaintenanceBusy] = useState(false);

  // asset details
  const [assetDetailsOpen, setAssetDetailsOpen] = useState(false);
  const [assetDetails, setAssetDetails] = useState(null);

  // toasts
  const [toast, setToast] = useState(null);
  const showToast = (msg, type = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  // shortcuts
  const searchRef = useRef(null);
  useEffect(() => {
    const key = (e) => {
      if (e.key === "/" && searchRef.current) {
        e.preventDefault();
        searchRef.current.focus();
      }
      if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        openAddProduct();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  /* ── realtime: products + branches ── */
  useEffect(() => {
    setLoadingProducts(true);
    const qp = query(collection(db, "products"), orderBy("name", "asc"));
    const unsubP = onSnapshot(qp, (snap) => {
      setProducts(snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) })));
      setLoadingProducts(false);
    }, () => setLoadingProducts(false));

    const qb = query(collection(db, "branches"), orderBy("name", "asc"));
    const unsubB = onSnapshot(qb, (snap) => setBranches(snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }))));

    return () => { try { unsubP(); unsubB(); } catch {} };
  }, []);

  /* ── realtime: assets → build counts ── */
  useEffect(() => {
    const qa = query(collection(db, "assets"), orderBy("productId"));
    const unsub = onSnapshot(qa, (snap) => {
      const totals = {};
      const statusTotals = {};
      snap.docs.forEach((d) => {
        const a = d.data() || {};
        const pid = a.productId;
        if (!pid) return;
        totals[pid] = (totals[pid] || 0) + 1;
        const st = a.status || "in_stock";
        statusTotals[pid] = statusTotals[pid] || { in_stock: 0, out_for_rental: 0, maintenance: 0, reserved: 0, other: 0 };
        if (statusTotals[pid][st] != null) statusTotals[pid][st] += 1;
        else statusTotals[pid].other += 1;
      });
      setProductAssetCounts(totals);
      setProductAssetStatusCounts(statusTotals);
    }, (err) => console.error("assets listener", err));
    return () => { try { unsub(); } catch {} };
  }, []);

  /* ── load assets for selected product ── */
  useEffect(() => {
    (async () => {
      if (!selectedProduct) return setAssetsForProduct([]);
      try {
        const list = await listAssets({ productId: selectedProduct.id });
        setAssetsForProduct(list);
      } catch (e) {
        console.error(e);
        setAssetsForProduct([]);
      }
    })();
  }, [selectedProduct]);

  /* ── filtering ── */
  const filteredProducts = useMemo(() => {
    const q = (debouncedQuery || "").trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      (p.name || "").toLowerCase().includes(q) ||
      (p.sku || "").toLowerCase().includes(q)
    );
  }, [products, debouncedQuery]);

  const visibleAssets = useMemo(() => {
    let list = (assetsForProduct || []).slice();
    if (assetStatusFilter) list = list.filter((a) => (a.status || "") === assetStatusFilter);
    if (assetBranchFilter) list = list.filter((a) => (a.branchId || "") === assetBranchFilter);
    if (assetSearch) {
      const s = assetSearch.trim().toLowerCase();
      list = list.filter((a) =>
        (a.assetId || "").toLowerCase().includes(s) ||
        (a.metadata?.model || "").toLowerCase().includes(s)
      );
    }
    return list.slice(0, assetPageSize);
  }, [assetsForProduct, assetStatusFilter, assetBranchFilter, assetSearch, assetPageSize]);

  /* ── product modal ── */
  const openAddProduct = () => {
    setProductForm({ id: null, name: "", sku: "", description: "", defaultRate: "", category: "" });
    setProductFormErrors({});
    setProductModalOpen(true);
  };
  const openEditProduct = (p) => {
    setProductForm({
      id: p.id,
      name: p.name || "",
      sku: p.sku || "",
      description: p.description || "",
      defaultRate: p.defaultRate ?? "",
      category: p.category || "",
    });
    setProductFormErrors({});
    setProductModalOpen(true);
  };
  const validateProduct = () => {
    const errs = {};
    if (!productForm.name?.trim()) errs.name = "Product name is required";
    if (productForm.defaultRate !== "" && Number.isNaN(Number(productForm.defaultRate))) errs.defaultRate = "Rate must be a number";
    setProductFormErrors(errs);
    return Object.keys(errs).length === 0;
  };
  const submitProduct = async (e) => {
    e?.preventDefault();
    if (!validateProduct()) return;
    setSavingProduct(true);
    try {
      const user = auth.currentUser || {};
      if (productForm.id) {
        await updateDoc(doc(db, "products", productForm.id), {
          name: productForm.name.trim(),
          sku: productForm.sku?.trim() || "",
          description: productForm.description?.trim() || "",
          defaultRate: Number(productForm.defaultRate || 0),
          category: productForm.category?.trim() || "",
          updatedAt: serverTimestamp(),
          updatedBy: user.uid || "",
          updatedByName: user.displayName || user.email || "",
        });
        showToast("Product updated", "success");
      } else {
        await addDoc(collection(db, "products"), {
          name: productForm.name.trim(),
          sku: productForm.sku?.trim() || `SKU-${Date.now()}`,
          description: productForm.description?.trim() || "",
          defaultRate: Number(productForm.defaultRate || 0),
          category: productForm.category?.trim() || "general",
          createdAt: serverTimestamp(),
          createdBy: user.uid || "",
          createdByName: user.displayName || user.email || "",
          assetCount: 0,
          assetCounts: null,
        });
        showToast("Product created", "success");
      }
      setProductModalOpen(false);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to save product");
      showToast("Failed to save product", "error");
    } finally {
      setSavingProduct(false);
    }
  };

  /* ── assets actions ── */
  const refreshAssets = async () => {
    if (!selectedProduct) return;
    const list = await listAssets({ productId: selectedProduct.id });
    setAssetsForProduct(list);
  };
  const safeJSON = (str) => {
    try { return JSON.parse(str || "{}"); } catch { return null; }
  };
  const onCreateAssets = async () => {
    setError("");
    if (!selectedProduct) return setError("Select a product first.");
    const qty = Number(assetQty || 0);
    if (!qty || qty < 1) return setError("Quantity must be at least 1");
    const meta = safeJSON(assetMetaJSON);
    if (meta == null) return setError("Invalid metadata JSON");
    try {
      const created = await createAssetsForProduct(
        selectedProduct.id,
        assetBranch || null,
        qty,
        { model: selectedProduct.name, ...meta },
        "in_stock"
      );
      try {
        await updateDoc(doc(db, "products", selectedProduct.id), { assetCount: increment(qty) });
      } catch {}
      await refreshAssets();
      showToast(`Created ${Array.isArray(created) ? created.length : qty} asset(s)`, "success");
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to create assets");
      showToast("Failed to create assets", "error");
    }
  };
  const doCheckout = async (id) => { try { await checkoutAsset(id, { note: "Checked out via UI" }); await refreshAssets(); } catch (e) { setError(e.message || "Checkout failed"); } };
  const doCheckin = async (id) => { try { await checkinAsset(id, { note: "Checked in via UI" }); await refreshAssets(); } catch (e) { setError(e.message || "Checkin failed"); } };
  const doReserve = async (id) => {
    const who = window.prompt("Reserve for (customer / order id)");
    if (who === null) return;
    try { await changeAssetStatus(id, "reserved", `Reserved for ${who || "unknown"}`, { reservedFor: who || "unknown" }); await refreshAssets(); }
    catch (e) { setError(e.message || "Reserve failed"); }
  };
  const doRelease = async (id) => {
    const ok = window.confirm("Release reservation?");
    if (!ok) return;
    try { await changeAssetStatus(id, "in_stock", "Reservation released", { releasedAtISO: new Date().toISOString() }); await refreshAssets(); }
    catch (e) { setError(e.message || "Release failed"); }
  };
  const doMove = async (id, to) => { if (!to) return; try { await moveAssetToBranch(id, to, `Moved via UI to ${to}`); await refreshAssets(); } catch (e) { setError(e.message || "Move failed"); } };

  /* ── maintenance ── */
  const openMaintenance = (a) => { setMaintenanceAsset(a); setMaintenanceTechnician(""); setMaintenanceNote(""); setMaintenanceOpen(true); };
  const startMaintenance = async () => {
    if (!maintenanceAsset) return;
    setMaintenanceBusy(true);
    try {
      const tech = maintenanceTechnician?.trim() || (auth.currentUser && (auth.currentUser.displayName || auth.currentUser.email)) || "unknown";
      const note = `Maintenance started by ${tech}${maintenanceNote ? ` — ${maintenanceNote}` : ""}`;
      await changeAssetStatus(maintenanceAsset.id, "maintenance", note, { technician: tech, phase: "start" });
      await refreshAssets();
      setMaintenanceOpen(false);
      showToast("Maintenance started", "success");
    } catch (e) {
      setError(e.message || "Failed to start maintenance");
    } finally { setMaintenanceBusy(false); }
  };
  const completeMaintenance = async () => {
    if (!maintenanceAsset) return;
    setMaintenanceBusy(true);
    try {
      const tech = maintenanceTechnician?.trim() || (auth.currentUser && (auth.currentUser.displayName || auth.currentUser.email)) || "unknown";
      const note = `Maintenance completed by ${tech}${maintenanceNote ? ` — ${maintenanceNote}` : ""}`;
      await changeAssetStatus(maintenanceAsset.id, "in_stock", note, { technician: tech, phase: "complete", condition: "ok" });
      await refreshAssets();
      setMaintenanceOpen(false);
      showToast("Maintenance completed", "success");
    } catch (e) {
      setError(e.message || "Failed to complete maintenance");
    } finally { setMaintenanceBusy(false); }
  };

  /* ── asset details ── */
  const openAssetDetails = (a) => { setAssetDetails(a); setAssetDetailsOpen(true); };

  /* ── sync counts ── */
  const syncAllCountsToProducts = async () => {
    if (!window.confirm("Write computed counts to ALL product docs?")) return;
    try {
      const prods = await getDocs(collection(db, "products"));
      const docs = prods.docs;
      const chunk = 450;
      for (let i = 0; i < docs.length; i += chunk) {
        const batch = writeBatch(db);
        docs.slice(i, i + chunk).forEach((pd) => {
          const pid = pd.id;
          batch.update(doc(db, "products", pid), {
            assetCount: productAssetCounts[pid] ?? 0,
            assetCounts: productAssetStatusCounts[pid] ?? null,
            assetsLastUpdatedAt: serverTimestamp(),
          });
        });
        await batch.commit();
      }
      showToast("Synced counts to products", "success");
    } catch (e) { setError(e.message || "Failed to sync counts"); }
  };

  /* ── render ── */
  return (
    <div className="products-wrap">
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
      {error && <div className="coupons-error">{error}</div>}

      {/* Header */}
      <header className="coupons-header">
        <div>
          <h1>🧰 Products & Inventory</h1>
          <p className="muted">Realtime asset counts, reservations, maintenance, and safe creation flows.</p>
        </div>
        <div className="coupons-actions">
          <button className="cp-btn" onClick={() => { setQueryText(""); setSelectedProduct(null); }}>Reset</button>
          <button className="cp-btn primary" onClick={openAddProduct}>+ Add Product</button>
          <button className="cp-btn" onClick={syncAllCountsToProducts}>Sync counts to products</button>
        </div>
      </header>

      {/* Toolbar */}
      <section className="coupons-toolbar">
        <input
          ref={searchRef}
          className="cp-input"
          placeholder="Search products or SKU…  ( / to focus )"
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
        />
        <div className="muted">
          Products: {products.length} · With assets: {Object.keys(productAssetCounts).length}
        </div>
      </section>

      {/* Table */}
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
                <th>Assets</th>
                <th>In stock</th>
                <th>Out</th>
                <th>Maint.</th>
                <th>Reserved</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingProducts && (
                <tr><td colSpan="11" className="empty">Loading products…</td></tr>
              )}

              {!loadingProducts && filteredProducts.map((p) => {
                const total = productAssetCounts[p.id] ?? p.assetCount ?? 0;
                const st = productAssetStatusCounts[p.id] ?? {};
                const active = selectedProduct?.id === p.id;

                return (
                  <tr key={p.id} className={active ? "active-row" : ""}>
                    <td className="strong">{p.name}</td>
                    <td className="muted">{p.sku || "—"}</td>
                    <td>{fmt.money(p.defaultRate ?? 0)}</td>
                    <td className="muted">{p.category || "—"}</td>
                    <td className="muted">{fmt.date(p.createdAt)}</td>
                    <td>{total}</td>
                    <td>{st.in_stock ?? 0}</td>
                    <td>{st.out_for_rental ?? 0}</td>
                    <td>{st.maintenance ?? 0}</td>
                    <td>{st.reserved ?? 0}</td>
                    <td>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <button className="cp-link" onClick={() => setSelectedProduct(p)}>View</button>
                        <button className="cp-link" onClick={() => openEditProduct(p)}>Edit</button>
                        <button className="cp-btn small" onClick={() => setSelectedProduct(p)}>Open</button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!loadingProducts && filteredProducts.length === 0 && (
                <tr><td colSpan="11"><div className="empty">No products found.</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Drawer */}
      {selectedProduct && (
        <div className="cp-drawer" onClick={(e) => e.target.classList.contains("cp-drawer") && setSelectedProduct(null)}>
          <div className="cp-form details" onClick={(e) => e.stopPropagation()}>
            <div className="cp-form-head">
              <h2>Product — {selectedProduct.name}</h2>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button className="cp-btn" onClick={async () => {
                  // sync selected product counts
                  const pid = selectedProduct.id;
                  try {
                    await updateDoc(doc(db, "products", pid), {
                      assetCount: productAssetCounts[pid] ?? 0,
                      assetCounts: productAssetStatusCounts[pid] ?? null,
                      assetsLastUpdatedAt: serverTimestamp(),
                    });
                    showToast("Product counts synced", "success");
                  } catch (e) { setError(e.message || "Failed to sync product"); }
                }}>Sync product</button>
                <button type="button" className="cp-icon" onClick={() => setSelectedProduct(null)}>✕</button>
              </div>
            </div>

            <div className="details-grid">
              <div className="details-left">
                <div className="details-row"><div className="label muted">Name</div><div className="value strong">{selectedProduct.name}</div></div>
                <div className="details-row"><div className="label muted">SKU</div><div className="value">{selectedProduct.sku || "—"}</div></div>
                <div className="details-row"><div className="label muted">Rate</div><div className="value">{fmt.money(selectedProduct.defaultRate ?? 0)}</div></div>

                <div style={{ marginTop: 12 }}>
                  <h3 style={{ margin: "8px 0" }}>Description</h3>
                  <div className="details-notes">{selectedProduct.description || "—"}</div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <h3>Create Assets</h3>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
                    <input className="cp-input" type="number" min="1" value={assetQty} onChange={(e) => setAssetQty(Number(e.target.value || 0))} style={{ width: 90 }} />
                    <select className="cp-input" value={assetBranch} onChange={(e) => setAssetBranch(e.target.value)} style={{ minWidth: 160 }}>
                      <option value="">Default branch</option>
                      {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                    <input className="cp-input" value={assetMetaJSON} onChange={(e) => setAssetMetaJSON(e.target.value)} placeholder='{"model":"X"}' style={{ minWidth: 240, flex: "1 1 260px" }} />
                    <button className="cp-btn" onClick={onCreateAssets}>Create</button>
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                    Tip: add arbitrary metadata (JSON) to tag assets (e.g., serial, size, color).
                  </div>
                </div>
              </div>

              <div>
                <div className="details-meta">
                  <div className="meta-row"><div className="label muted">Category</div><div className="value">{selectedProduct.category || "—"}</div></div>
                  <div className="meta-row"><div className="label muted">Created</div><div className="value">{fmt.date(selectedProduct.createdAt)} · {selectedProduct.createdByName || selectedProduct.createdBy || "—"}</div></div>
                  <div className="meta-row"><div className="label muted">Assets (total)</div><div className="value">{productAssetCounts[selectedProduct.id] ?? selectedProduct.assetCount ?? 0}</div></div>

                  <div style={{ marginTop: 12 }}>
                    <div className="label muted">Status breakdown</div>
                    <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
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

            {/* Assets */}
            <div style={{ marginTop: 8 }}>
              <h3>Assets</h3>
              <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input className="cp-input" placeholder="Search assets by id or model…" value={assetSearch} onChange={(e) => setAssetSearch(e.target.value)} style={{ flex: "1 1 320px" }} />
                <select value={assetStatusFilter} onChange={(e) => setAssetStatusFilter(e.target.value)} className="cp-input" style={{ width: 160 }}>
                  <option value="">All statuses</option>
                  <option value="in_stock">In stock</option>
                  <option value="out_for_rental">Out for rental</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="reserved">Reserved</option>
                </select>
                <select value={assetBranchFilter} onChange={(e) => setAssetBranchFilter(e.target.value)} className="cp-input" style={{ width: 160 }}>
                  <option value="">All branches</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <select value={assetPageSize} onChange={(e) => setAssetPageSize(Number(e.target.value))} className="cp-input" style={{ width: 120 }}>
                  {[12, 24, 48, 96].map(n => <option key={n} value={n}>{n}/page</option>)}
                </select>
                <button className="cp-btn" onClick={refreshAssets}>Refresh</button>
              </div>

              <div className="assets-grid" style={{ marginTop: 12 }}>
                {visibleAssets.length === 0 && <div className="muted" style={{ padding: 12 }}>No assets matching filters.</div>}
                {visibleAssets.map((a) => (
                  <div key={a.id} className="asset-card">
                    <div className="asset-top">
                      <div>
                        <div style={{ fontWeight: 700 }}>{a.assetId}</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {(branches.find(b => b.id === a.branchId) || {}).name || a.branchId || "—"}
                        </div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <div className="muted" style={{ fontSize: 12 }}>{a.metadata?.model || ""}</div>
                        <div className="muted" style={{ fontSize: 12 }}>Status: <span className={`status ${a.status}`}>{a.status}</span></div>
                      </div>
                    </div>

                    <div className="asset-meta muted">
                      {a.rental?.customer && <div>Rented to: {a.rental.customer}</div>}
                      {a.metadata?.reservedFor && <div>Reserved for: {a.metadata.reservedFor}</div>}
                      <div>Created: {fmt.date(a.createdAt)} · {a.createdByName}</div>
                    </div>

                    <div className="asset-actions">
                      <button className="btn ghost" onClick={() => openAssetDetails(a)}>Details</button>
                      {a.status !== "out_for_rental" && a.status !== "reserved" && a.status !== "maintenance" && (
                        <button className="btn" onClick={() => doCheckout(a.id)}>Checkout</button>
                      )}
                      {a.status === "out_for_rental" && (
                        <button className="btn" onClick={() => doCheckin(a.id)}>Checkin</button>
                      )}
                      {a.status === "reserved"
                        ? <button className="btn ghost" onClick={() => doRelease(a.id)}>Release</button>
                        : (a.status !== "out_for_rental" && a.status !== "maintenance") &&
                          <button className="btn" onClick={() => doReserve(a.id)}>Reserve</button>}
                      <button className="btn ghost" onClick={() => openMaintenance(a)}>Maintenance</button>

                      <select onChange={(e) => { const to = e.target.value; if (!to) return; doMove(a.id, to); e.target.value = ""; }} defaultValue="">
                        <option value="">Move</option>
                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                      <button
  className="btn ghost"
  onClick={() => { if (a.qrUrl) window.open(a.qrUrl, "_blank"); }}
>
  QR Code
</button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="cp-form-actions" style={{ marginTop: 12 }}>
                <button className="cp-btn ghost" onClick={() => setSelectedProduct(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Maintenance modal */}
      {maintenanceOpen && maintenanceAsset && (
        <div className="cp-modal" onClick={() => setMaintenanceOpen(false)}>
          <div className="cp-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Maintenance — {maintenanceAsset.assetId}</h3>
            <div className="muted" style={{ marginTop: 8 }}>
              Current status: <strong style={{ textTransform: "capitalize" }}>{maintenanceAsset.status}</strong>
            </div>

            <label className="label" style={{ marginTop: 12 }}>Technician / Responsible</label>
            <input value={maintenanceTechnician} onChange={(e) => setMaintenanceTechnician(e.target.value)} placeholder="Technician name or team" className="cp-input" />

            <label className="label" style={{ marginTop: 8 }}>Note</label>
            <textarea rows={3} value={maintenanceNote} onChange={(e) => setMaintenanceNote(e.target.value)} className="cp-input" placeholder="Describe issue, parts replaced, expected return date..." />

            <div className="cp-form-actions" style={{ marginTop: 12 }}>
              <button className="cp-btn ghost" onClick={() => setMaintenanceOpen(false)}>Cancel</button>
              <button className="cp-btn" onClick={startMaintenance} disabled={maintenanceBusy}>{maintenanceBusy ? "Working…" : "Start Maintenance"}</button>
              <button className="cp-btn" onClick={completeMaintenance} disabled={maintenanceBusy}>{maintenanceBusy ? "Working…" : "Complete (In stock)"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Asset details modal */}
      {assetDetailsOpen && assetDetails && (
        <div className="cp-modal" onClick={() => setAssetDetailsOpen(false)}>
          <div className="cp-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Asset details — {assetDetails.assetId}</h3>
            <div className="muted" style={{ marginTop: 6 }}>
              Product: {assetDetails.productId} · Branch: {(branches.find(b => b.id === assetDetails.branchId) || {}).name || assetDetails.branchId || "—"}
            </div>

            <div style={{ marginTop: 12 }}>
              <h4 style={{ marginBottom: 8 }}>Metadata</h4>
              <div className="muted">
                {assetDetails.metadata && <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(assetDetails.metadata, null, 2)}</pre>}
              </div>
              {assetDetails.qrUrl && (
  <div style={{ marginTop: 12 }}>
    <h4 style={{ marginBottom: 8 }}>QR Code</h4>
    <img
      src={assetDetails.qrUrl}
      alt={`QR for ${assetDetails.assetId}`}
      style={{ width: 180, height: 180 }}
    />
    <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
      Scans to: assetId “{assetDetails.assetId}”
    </div>
  </div>
)}

              {/* History */}
<h4 style={{ marginTop: 12, marginBottom: 8 }}>History</h4>

{Array.isArray(assetDetails.history) && assetDetails.history.length > 0 ? (
  <div className="history-wrap">
    <table className="history-table">
      <thead>
        <tr>
          <th style={{ width: 180 }}>When</th>
          <th style={{ width: 180 }}>By</th>
          <th style={{ width: 140 }}>Event</th>
          <th>Note</th>
          <th style={{ width: 120, textAlign: "right" }}>Data</th>
        </tr>
      </thead>
      <tbody>
        {assetDetails.history
          .slice()
          .sort((a, b) => {
            const ta = a?.ts?.seconds ? a.ts.seconds * 1000 : Date.parse(a?.ts || 0);
            const tb = b?.ts?.seconds ? b.ts.seconds * 1000 : Date.parse(b?.ts || 0);
            return tb - ta; // newest first
          })
          .map((h, i) => {
            const ts = h?.ts?.seconds
              ? new Date(h.ts.seconds * 1000)
              : (h?.ts ? new Date(h.ts) : null);
            const when = ts && !Number.isNaN(ts.getTime())
              ? ts.toLocaleString()
              : "—";

            const by =
              h.byName || h.changedByName || h.by || h.changedBy || "system";

            const type =
              h.type || h.changeType || h.event || h.status || "update";

            const hasData = h.data && Object.keys(h.data).length > 0;

            return (
              <tr key={i}>
                <td className="muted">{when}</td>
                <td className="muted">{by}</td>
                <td>
                  <span className={`ev ev-${String(type).toLowerCase()}`}>
                    {String(type).replace(/_/g, " ")}
                  </span>
                </td>
                <td>{h.note || "—"}</td>
                <td style={{ textAlign: "right" }}>
                  {hasData ? (
                    <details>
                      <summary className="history-view-json">View</summary>
                      <pre className="history-json">
                        {JSON.stringify(h.data, null, 2)}
                      </pre>
                    </details>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
              </tr>
            );
          })}
      </tbody>
    </table>
  </div>
) : (
  <div className="muted">No history recorded for this asset.</div>
)}

            </div>

            <div className="cp-form-actions" style={{ marginTop: 12 }}>
              <button className="cp-btn ghost" onClick={() => setAssetDetailsOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Product modal */}
      {productModalOpen && (
        <div className="cp-modal" role="dialog" aria-modal="true" onClick={() => setProductModalOpen(false)}>
          <div className="cp-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>{productForm.id ? "Edit product" : "Add product"}</h3>
            <form onSubmit={submitProduct} className="modal-form">
              <label className="label">Name</label>
              <input
                value={productForm.name}
                onChange={(e) => setProductForm((s) => ({ ...s, name: e.target.value }))}
                className={`cp-input ${productFormErrors.name ? "error" : ""}`}
                required
              />
              {productFormErrors.name && <div className="field-error">{productFormErrors.name}</div>}

              <label className="label">SKU (optional)</label>
              <input value={productForm.sku} onChange={(e) => setProductForm((s) => ({ ...s, sku: e.target.value }))} className="cp-input" />

              <label className="label">Rate</label>
              <input
                type="number"
                value={productForm.defaultRate}
                onChange={(e) => setProductForm((s) => ({ ...s, defaultRate: e.target.value }))}
                className={`cp-input ${productFormErrors.defaultRate ? "error" : ""}`}
              />
              {productFormErrors.defaultRate && <div className="field-error">{productFormErrors.defaultRate}</div>}

              <label className="label">Category</label>
              <input value={productForm.category} onChange={(e) => setProductForm((s) => ({ ...s, category: e.target.value }))} className="cp-input" />

              <label className="label">Description</label>
              <textarea value={productForm.description} onChange={(e) => setProductForm((s) => ({ ...s, description: e.target.value }))} rows={3} className="cp-input" />

              <div className="cp-form-actions" style={{ marginTop: 10 }}>
                <button type="button" className="cp-btn ghost" onClick={() => setProductModalOpen(false)}>Cancel</button>
                <button className="cp-btn" type="submit" disabled={savingProduct}>{savingProduct ? "Saving…" : "Save product"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
