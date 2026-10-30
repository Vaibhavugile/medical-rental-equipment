// src/pages/Products.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  collection,
  arrayUnion,
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
  Timestamp,
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
  deleteAsset,
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

/* escape for safe inline HTML used in print popup */
const escapeHtml = (s) => String(s || "").replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

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
  const [assetPurchasePrice, setAssetPurchasePrice] = useState("");
  const [assetPurchaseDate, setAssetPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [assetSupplier, setAssetSupplier] = useState("");
  const [assetBranch, setAssetBranch] = useState("");
  const [assetSearch, setAssetSearch] = useState("");
  const [assetCompany, setAssetCompany] = useState("");

  const [assetStatusFilter, setAssetStatusFilter] = useState("");
  const [assetBranchFilter, setAssetBranchFilter] = useState("");
  const [assetPageSize, setAssetPageSize] = useState(24);
  const [selectedAssetIds, setSelectedAssetIds] = useState([]);
  const [bulkPurchaseRate, setBulkPurchaseRate] = useState("");
  const [bulkPurchaseBusy, setBulkPurchaseBusy] = useState(false);
  const [bulkPurchaseDateBusy, setBulkPurchaseDateBusy] = useState(false);


  // new: options for asset id generation & preview
  const [companyPrefix, setCompanyPrefix] = useState("BMM");
  const [batchOverride, setBatchOverride] = useState(""); // empty => use year suffix
  const [shortCodeOverride, setShortCodeOverride] = useState("");

  // product modal (add/edit)
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productForm, setProductForm] = useState({ name: "", sku: "", description: "", defaultRate: "", category: "" });
  const [productFormErrors, setProductFormErrors] = useState({});
  const [savingProduct, setSavingProduct] = useState(false);

  // maintenance modal
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [maintenanceAsset, setMaintenanceAsset] = useState(null);
  const [maintenanceForm, setMaintenanceForm] = useState({
    category: "general",
    priority: "normal",
    issue: "",
    technician: "",
    vendor: "",
    expectedCompletionDate: "",
    estimatedCost: "",
    initialCondition: "fair",
    startNotes: "",
    completionDate: new Date().toISOString().slice(0, 10),
    workPerformed: "",
    partsReplaced: "",
    laborCost: "",
    partsCost: "",
    finalCondition: "good",
    nextServiceDate: "",
    completionNotes: "",
  });
  const [maintenanceBusy, setMaintenanceBusy] = useState(false);
  const [assetCompanyFilter, setAssetCompanyFilter] = useState("");

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
    const tag = e.target?.tagName;
    const isTyping =
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      e.target?.isContentEditable;

    if (isTyping) return;

    // Ctrl+N / Cmd+N → Add product
    if (
      e.key.toLowerCase() === "n" &&
      (e.ctrlKey || e.metaKey)
    ) {
      e.preventDefault(); // stop browser "new window"
      openAddProduct();
      return;
    }

    // "/" → focus search
    if (e.key === "/" && searchRef.current) {
      e.preventDefault();
      searchRef.current.focus();
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

    return () => { try { unsubP(); unsubB(); } catch { } };
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
    return () => { try { unsub(); } catch { } };
  }, []);

  /* ── load assets for selected product ── */
  useEffect(() => {
  (async () => {
    if (!selectedProduct) {
      setAssetsForProduct([]);
      return;
    }

    try {
      const list = await listAssets({ productId: selectedProduct.id });
      setAssetsForProduct(list);

      // 🔥 RESET FILTERS ON PRODUCT CHANGE
      setAssetCompanyFilter("");
      setAssetSearch("");
      setSelectedAssetIds([]);
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

    if (assetStatusFilter) {
      list = list.filter((a) => a.status === assetStatusFilter);
    }

    if (assetBranchFilter) {
      list = list.filter((a) => a.branchId === assetBranchFilter);
    }

   if (assetCompanyFilter) {
  if (assetCompanyFilter === "__none__") {
    list = list.filter((a) => !a.company);
  } else {
    list = list.filter(
      (a) =>
        (a.company || "").toLowerCase() ===
        assetCompanyFilter.toLowerCase()
    );
  }
}


    if (assetSearch) {
      const s = assetSearch.trim().toLowerCase();
      list = list.filter(
        (a) =>
          (a.assetId || "").toLowerCase().includes(s) ||
          (a.company || "").toLowerCase().includes(s)
      );
    }

    return list.slice(0, assetPageSize);
  }, [
    assetsForProduct,
    assetStatusFilter,
    assetBranchFilter,
    assetCompanyFilter,
    assetSearch,
    assetPageSize,
  ]);

  const doDeleteAsset = async (assetId) => {
    const ok = window.confirm("Are you sure you want to delete this asset?");
    if (!ok) return;

    try {
      await deleteAsset(assetId);
      await refreshAssets();
      showToast("Asset deleted", "success");
    } catch (e) {
      setError(e.message || "Failed to delete asset");
    }
  };
  const doBulkDeleteAssets = async () => {
    if (selectedAssetIds.length === 0) {
      showToast("No assets selected", "error");
      return;
    }

    const ok = window.confirm(
      `Delete ${selectedAssetIds.length} selected assets? This cannot be undone.`
    );
    if (!ok) return;

    try {
      await Promise.all(
        selectedAssetIds.map((id) => deleteAsset(id))
      );

      setSelectedAssetIds([]);
      await refreshAssets();
      showToast("Assets deleted", "success");
    } catch (e) {
      setError(e.message || "Bulk delete failed");
    }
  };


  // Set purchaseDate from each asset's own createdAt for the entire assets collection.
  // This is intentionally global and does not depend on the currently selected product or filters.
  const doSetPurchaseDateFromCreatedAtForAllAssets = async () => {
    const ok = window.confirm(
      "Update ALL assets in Firestore? Each asset with a createdAt value will get purchaseDate = createdAt. Existing purchase dates will be overwritten. Assets without createdAt will be skipped."
    );
    if (!ok) return;

    setBulkPurchaseDateBusy(true);
    try {
      const snapshot = await getDocs(collection(db, "assets"));
      const docsWithCreatedAt = snapshot.docs.filter((assetDoc) => {
        const data = assetDoc.data() || {};
        return data.createdAt !== undefined && data.createdAt !== null && data.createdAt !== "";
      });

      if (!docsWithCreatedAt.length) {
        showToast("No assets with a createdAt value were found", "info");
        return;
      }

      for (let offset = 0; offset < docsWithCreatedAt.length; offset += 450) {
        const batch = writeBatch(db);
        docsWithCreatedAt.slice(offset, offset + 450).forEach((assetDoc) => {
          const data = assetDoc.data() || {};
          batch.update(doc(db, "assets", assetDoc.id), {
            purchaseDate: data.createdAt,
            purchaseDateSyncedFromCreatedAtAt: serverTimestamp(),
          });
        });
        await batch.commit();
      }

      const skipped = snapshot.size - docsWithCreatedAt.length;
      showToast(
        `Purchase date updated for ${docsWithCreatedAt.length} asset(s). ${skipped} skipped (missing createdAt).`,
        "success"
      );
      await refreshAssets();
    } catch (e) {
      console.error("Global purchase date update failed", e);
      setError(e.message || "Failed to update purchase dates for all assets");
      showToast("Could not update all asset purchase dates", "error");
    } finally {
      setBulkPurchaseDateBusy(false);
    }
  };

  const doBulkUpdatePurchaseRate = async () => {
    const rate = Number(bulkPurchaseRate);
    if (!selectedAssetIds.length) {
      showToast("Select assets first", "error");
      return;
    }
    if (bulkPurchaseRate === "" || !Number.isFinite(rate) || rate < 0) {
      showToast("Enter a valid purchase rate", "error");
      return;
    }
    const ok = window.confirm(
      `Update purchase rate to ₹${fmt.money(rate)} for ${selectedAssetIds.length} selected asset(s)?`
    );
    if (!ok) return;

    setBulkPurchaseBusy(true);
    try {
      const user = auth.currentUser || {};
      for (let offset = 0; offset < selectedAssetIds.length; offset += 450) {
        const batch = writeBatch(db);
        selectedAssetIds.slice(offset, offset + 450).forEach((id) => {
          batch.update(doc(db, "assets", id), {
            purchasePrice: rate,
            purchasePricePerUnit: rate,
            purchaseRateUpdatedAt: serverTimestamp(),
            purchaseRateUpdatedBy: user.uid || "",
            purchaseRateUpdatedByName: user.displayName || user.email || "",
            updatedAt: serverTimestamp(),
            history: arrayUnion({
              ts: new Date().toISOString(),
              by: user.uid || "system",
              byName: user.displayName || user.email || "system",
              type: "purchase_rate_updated",
              note: `Purchase rate updated to ${rate}`,
              data: { purchasePricePerUnit: rate },
            }),
          });
        });
        await batch.commit();
      }
      setBulkPurchaseRate("");
      setSelectedAssetIds([]);
      await refreshAssets();
      showToast(`Purchase rate updated for ${selectedAssetIds.length} asset(s)`, "success");
    } catch (e) {
      console.error("Bulk purchase rate update failed", e);
      setError(e.message || "Failed to update purchase rates");
    } finally {
      setBulkPurchaseBusy(false);
    }
  };

const allVisibleAssetIds = visibleAssets.map((a) => a.id);
const allSelected =
  allVisibleAssetIds.length > 0 &&
  allVisibleAssetIds.every((id) => selectedAssetIds.includes(id));
const toggleSelectCompany = (companyAssets) => {
  const ids = companyAssets.map((a) => a.id);
  const allSelected = ids.every((id) => selectedAssetIds.includes(id));

  setSelectedAssetIds((prev) =>
    allSelected
      ? prev.filter((id) => !ids.includes(id))
      : [...new Set([...prev, ...ids])]
  );
};

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
          category: productForm.category?.trim() || "general",
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


  // derive short code (same algorithm as backend)
  const deriveShortCode = (model) => {
    if (!model || typeof model !== "string") return "PRD";
    const parts = model
      .trim()
      .replace(/[^A-Za-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
    if (parts.length === 0) return "PRD";
    if (parts.length === 1) return parts[0].substring(0, 3).toUpperCase();
    return parts.slice(0, 3).map(p => p[0]).join("").toUpperCase();
  };

  // preview next asset id based on currently loaded assets (best-effort client-side)
  const makeCompanyCode = (company) => {
    return String(company || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 5) || "COMP";
  };

  const previewNextAssetId = (() => {
    if (!selectedProduct) return "—";
    if (!assetCompany.trim()) return "—";

    const companyCode = makeCompanyCode(assetCompany);
    const shortCode = (shortCodeOverride || "PRD").toUpperCase();
    const batch = batchOverride || String(new Date().getFullYear()).slice(-2);

    const prefix = `${(companyPrefix || "BMM").toUpperCase()}${companyCode}${shortCode}${batch}`;

    let maxSeq = 0;

    (assetsForProduct || []).forEach((a) => {
      if (!a.assetId || typeof a.assetId !== "string") return;
const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const match = a.assetId.match(
  new RegExp(`^${escapedPrefix}(\\d{3})$`)
);

if (!match) return;

const n = Number(match[1]);

if (!Number.isNaN(n) && n > maxSeq) {
  maxSeq = n;
}
    });

    const nextSeq = maxSeq + 1;
    const padLen = Math.max(3, String(nextSeq).length);

    return `${prefix}${String(nextSeq).padStart(padLen, "0")}`;
  })();


  const onCreateAssets = async () => {
    setError("");
    if (!selectedProduct) return setError("Select a product first.");

    const qty = Number(assetQty || 0);
    const purchasePrice = Number(assetPurchasePrice);
    if (!Number.isInteger(qty) || qty < 1) return setError("Quantity must be a whole number greater than 0");
    if (assetPurchasePrice === "" || !Number.isFinite(purchasePrice) || purchasePrice < 0) {
      return setError("Enter a valid purchase price per unit");
    }
    if (!assetPurchaseDate) return setError("Purchase date is required");

    try {
      const created = await createAssetsForProduct(
        selectedProduct.id,
        assetBranch || null,
        qty,
        assetCompany.trim() || null,
        "in_stock",
        {
          companyPrefix,
          batch: batchOverride || undefined,
          shortCode: shortCodeOverride || undefined,
          purchasePricePerUnit: purchasePrice,
          purchaseDate: assetPurchaseDate,
          supplier: assetSupplier.trim() || "",
        }
      );

      // Use the selected purchase date as the asset's created date as requested.
      // Keep purchaseDate as the canonical purchase date field as well.
      if (Array.isArray(created) && created.length) {
        for (let offset = 0; offset < created.length; offset += 450) {
          const batch = writeBatch(db);
          created.slice(offset, offset + 450).forEach((asset) => {
            if (!asset.id) return;
            batch.update(doc(db, "assets", asset.id), {
              createdAt: Timestamp.fromDate(new Date(`${assetPurchaseDate}T00:00:00`)),
              purchaseDate: assetPurchaseDate,
            });
          });
          await batch.commit();
        }
      }

      await refreshAssets();
      setAssetCompany("");
      setAssetPurchasePrice("");
      setAssetSupplier("");

      showToast(
        `Created ${Array.isArray(created) ? created.length : qty} asset(s). Purchase total: ${fmt.money(purchasePrice * qty)}`,
        "success"
      );
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

  /* ── maintenance lifecycle ── */
  const updateMaintenanceForm = (key, value) => {
    setMaintenanceForm((current) => ({ ...current, [key]: value }));
  };

  const openMaintenance = (asset) => {
    const current = asset.maintenance || {};
    const isActive = asset.status === "maintenance" && current.code;

    setMaintenanceAsset(asset);
    setMaintenanceForm({
      category: current.category || "general",
      priority: current.priority || "normal",
      issue: current.issue || "",
      technician: current.technician || auth.currentUser?.displayName || "",
      vendor: current.vendor || "",
      expectedCompletionDate: current.expectedCompletionDate || "",
      estimatedCost: current.estimatedCost ?? "",
      initialCondition: current.initialCondition || "fair",
      startNotes: current.startNotes || "",
      completionDate: new Date().toISOString().slice(0, 10),
      workPerformed: "",
      partsReplaced: "",
      laborCost: "",
      partsCost: "",
      finalCondition: "good",
      nextServiceDate: "",
      completionNotes: "",
    });

    setMaintenanceOpen(true);
  };

  const makeMaintenanceCode = () => {
    const date = new Date();
    const ymd = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("");
    return `MNT-${ymd}-${Date.now().toString().slice(-5)}`;
  };

  const startMaintenance = async () => {
    if (!maintenanceAsset) return;

    const form = maintenanceForm;
    if (!form.issue.trim()) {
      showToast("Describe the maintenance issue first", "error");
      return;
    }
    if (!form.technician.trim()) {
      showToast("Enter the technician or responsible person", "error");
      return;
    }
    if (maintenanceAsset.status === "out_for_rental" || maintenanceAsset.status === "reserved") {
      showToast("This asset must be checked in or released before maintenance", "error");
      return;
    }

    setMaintenanceBusy(true);
    try {
      const now = new Date().toISOString();
      const code = makeMaintenanceCode();
      const user = auth.currentUser || {};
      const record = {
        code,
        status: "in_progress",
        category: form.category,
        priority: form.priority,
        issue: form.issue.trim(),
        technician: form.technician.trim(),
        vendor: form.vendor.trim() || null,
        expectedCompletionDate: form.expectedCompletionDate || null,
        estimatedCost: Number(form.estimatedCost || 0),
        initialCondition: form.initialCondition,
        startNotes: form.startNotes.trim() || null,
        reportedAt: now,
        startedAt: now,
        startedBy: user.uid || "",
        startedByName: user.displayName || user.email || "Unknown",
      };

      const startEntry = {
        ts: now,
        by: user.uid || "system",
        byName: user.displayName || user.email || "system",
        type: "maintenance_start",
        note: `Maintenance started · ${code} · ${record.issue}`,
        data: { phase: "start", maintenanceCode: code, ...record },
      };

      // Save status, active work order and history together.
      await updateDoc(doc(db, "assets", maintenanceAsset.id), {
        status: "maintenance",
        maintenance: record,
        maintenanceUpdatedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: user.uid || "",
        updatedByName: user.displayName || user.email || "",
        history: arrayUnion(startEntry),
      });

      await refreshAssets();
      setMaintenanceOpen(false);
      showToast(`Maintenance ${code} started`, "success");
    } catch (e) {
      console.error("Start maintenance failed", e);
      setError(e.message || "Failed to start maintenance");
    } finally {
      setMaintenanceBusy(false);
    }
  };

  const completeMaintenance = async () => {
    if (!maintenanceAsset) return;

    const active = maintenanceAsset.maintenance || {};
    if (!active.code) {
      showToast("Maintenance record is missing. Refresh the asset and try again.", "error");
      return;
    }
    if (!maintenanceForm.workPerformed.trim()) {
      showToast("Enter the work performed before completing maintenance", "error");
      return;
    }

    const laborCost = Number(maintenanceForm.laborCost || 0);
    const partsCost = Number(maintenanceForm.partsCost || 0);
    if (!Number.isFinite(laborCost) || laborCost < 0 || !Number.isFinite(partsCost) || partsCost < 0) {
      showToast("Enter valid maintenance costs", "error");
      return;
    }

    setMaintenanceBusy(true);
    try {
      const now = new Date().toISOString();
      const user = auth.currentUser || {};
      const totalCost = laborCost + partsCost;
      const completedRecord = {
        ...active,
        status: "completed",
        completedAt: now,
        completionDate: maintenanceForm.completionDate || now.slice(0, 10),
        workPerformed: maintenanceForm.workPerformed.trim(),
        partsReplaced: maintenanceForm.partsReplaced.trim() || null,
        laborCost,
        partsCost,
        totalCost,
        finalCondition: maintenanceForm.finalCondition,
        nextServiceDate: maintenanceForm.nextServiceDate || null,
        completionNotes: maintenanceForm.completionNotes.trim() || null,
        completedBy: user.uid || "",
        completedByName: user.displayName || user.email || "Unknown",
      };

      if (["poor", "damaged"].includes(maintenanceForm.finalCondition)) {
        showToast("This asset is not ready for stock. Select Good, Fair or Excellent only after it is safe to use.", "error");
        setMaintenanceBusy(false);
        return;
      }

      const completionEntry = {
        ts: now,
        by: user.uid || "system",
        byName: user.displayName || user.email || "system",
        type: "maintenance_complete",
        note: `Maintenance completed · ${active.code} · Total cost ₹${fmt.money(totalCost)}`,
        data: {
          phase: "complete",
          maintenanceCode: active.code,
          technician: active.technician || "",
          category: active.category || "",
          issue: active.issue || "",
          workPerformed: completedRecord.workPerformed,
          partsReplaced: completedRecord.partsReplaced,
          laborCost,
          partsCost,
          totalCost,
          finalCondition: completedRecord.finalCondition,
          nextServiceDate: completedRecord.nextServiceDate,
          completionNotes: completedRecord.completionNotes,
        },
      };

      // Complete the work order, return the asset to stock and log the event atomically.
      await updateDoc(doc(db, "assets", maintenanceAsset.id), {
        status: "in_stock",
        maintenance: completedRecord,
        maintenanceUpdatedAt: serverTimestamp(),
        maintenanceHistory: arrayUnion(completedRecord),
        lastMaintenanceAt: now,
        nextServiceDate: completedRecord.nextServiceDate,
        totalMaintenanceCost: increment(totalCost),
        updatedAt: serverTimestamp(),
        updatedBy: user.uid || "",
        updatedByName: user.displayName || user.email || "",
        history: arrayUnion(completionEntry),
      });

      await refreshAssets();
      setMaintenanceOpen(false);
      showToast(`Maintenance ${active.code} completed · ₹${fmt.money(totalCost)}`, "success");
    } catch (e) {
      console.error("Complete maintenance failed", e);
      setError(e.message || "Failed to complete maintenance");
    } finally {
      setMaintenanceBusy(false);
    }
  };

  /* ── PRINT / EXPORT HELPERS ---------- */

  // Open printable page with stickers (QR image + assetId) and trigger print
  // Open printable page with stickers (QR image + assetId) and trigger print
  const printAssets = async (assets = []) => {
    if (!Array.isArray(assets) || assets.length === 0) {
      showToast("No assets to print", "error");
      return;
    }

    const htmlHeader = `
    <html>
      <head>
        <title>Print Asset QR Stickers</title>
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <style>
          body { margin: 8mm; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial; color: #111; }
          .stickers { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8mm; }
          .sticker { border: 1px solid #ddd; padding: 6mm; border-radius: 6px; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 65mm; box-sizing: border-box; }
          .sticker img { width: 48mm; height: 48mm; object-fit: contain; margin-bottom: 6px; }
          .asset-id { font-weight: 700; font-size: 12pt; word-break: break-all; text-align: center; }
          .product-name { font-size: 10pt; color: #444; margin-bottom: 4px; text-align: center; }
          @media print {
            body { margin: 4mm; }
            .sticker { page-break-inside: avoid; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <div><strong>Stickers</strong></div>
          <div class="no-print"><small>Generated: ${new Date().toLocaleString()}</small></div>
        </div>
        <div class="stickers">
  `;

    const htmlFooter = `
        </div>
      </body>
    </html>
  `;

    const stickerHtml = assets.map(a => {
      const id = (a.assetId || a.id || "—");
      const qr = a.qrUrl || a.metadata?.qrUrl || (`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(id)}`);
      const product = a.productName || a.metadata?.model || "";
      // escape minimal characters to avoid simple HTML issues
      const esc = (s) => String(s || "").replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      return `
      <div class="sticker">
        <div class="product-name">${esc(product)}</div>
        <img src="${qr}" alt="QR for ${esc(id)}" />
        <div class="asset-id">${esc(id)}</div>
      </div>
    `;
    }).join("\n");

    const w = window.open("", "_blank");
    if (!w) {
      showToast("Popup blocked. Allow popups for printing.", "error");
      return;
    }

    w.document.write(htmlHeader + stickerHtml + htmlFooter);
    w.document.close();

    // Wait for images in the new window to load (or timeout)
    const waitForImages = (win, timeout = 5000) => new Promise((resolve) => {
      const start = Date.now();
      function check() {
        try {
          const imgs = Array.from(win.document.images || []);
          if (imgs.length === 0) return resolve(); // nothing to wait for
          const allDone = imgs.every(img => img.complete && img.naturalWidth > 0);
          if (allDone) return resolve();
        } catch (err) {
          // If accessing win.document fails (rare), fallback to timeout
        }
        if (Date.now() - start > timeout) return resolve();
        setTimeout(check, 200);
      }
      // small initial delay to let browser begin fetching images
      setTimeout(check, 200);
    });

    // wait (await) then print
    try {
      await waitForImages(w, 5000); // wait up to 5s (adjust if needed)
      try {
        w.focus();
        w.print();
      } catch (e) {
        console.warn("Print call failed; user can manually print from the new tab.", e);
      }
    } catch (e) {
      console.warn("Error waiting for images:", e);
      try { w.print(); } catch { }
    }
  };


  // simple CSV exporter
  const exportAssetsCSV = (assets = []) => {
    if (!Array.isArray(assets) || assets.length === 0) {
      showToast("No assets to export", "error");
      return;
    }
    const rows = [["assetId", "qrUrl", "productName"]];
    assets.forEach(a => rows.push([a.assetId || a.id || "", a.qrUrl || "", a.productName || a.metadata?.model || ""]));
    const csv = rows.map(r => r.map(cell => `"${String(cell || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `assets-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast("CSV exported", "success");
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

  const assetsGroupedByCompany = useMemo(() => {
    const groups = {};
    (visibleAssets || []).forEach((a) => {
      const company = a.company || "Unknown company";
      if (!groups[company]) groups[company] = [];
      groups[company].push(a);
    });
    return groups;
  }, [visibleAssets]);
  const exportProducts = () => {

  const rows = filteredProducts.map((p, i) => {

    const st = productAssetStatusCounts[p.id] || {};

    return {

      No: i + 1,

      Product: p.name || "",

      SKU: p.sku || "",

      Rate: p.defaultRate || 0,

      Category: p.category || "",

      TotalAssets: productAssetCounts[p.id] || 0,

      InStock: st.in_stock || 0,

      OutForRental: st.out_for_rental || 0,

      Maintenance: st.maintenance || 0,

      Reserved: st.reserved || 0,

      Created: fmt.date(p.createdAt)

    };

  });

  if (!rows.length) return;

  const headers = Object.keys(rows[0]);

  const escapeCSV = (v) =>
    `"${String(v ?? "").replace(/"/g, '""')}"`;

  const csv = [
    headers.join(","),
    ...rows.map(r =>
      headers.map(h => escapeCSV(r[h])).join(",")
    )
  ].join("\n");

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");

  a.href = url;

  a.download = "products_inventory_export.csv";

  a.click();

  URL.revokeObjectURL(url);

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
        <div className="leads-header-actions">
          <button className="cp-btn ghost" onClick={openAddProduct}>+ Add Product</button>
           <button
    className="cp-btn ghost"
    onClick={exportProducts}
  >
    Export
  </button>
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
                {/* <button className="cp-btn" onClick={async () => {
                  const pid = selectedProduct.id;
                  try {
                    await updateDoc(doc(db, "products", pid), {
                      assetCount: productAssetCounts[pid] ?? 0,
                      assetCounts: productAssetStatusCounts[pid] ?? null,
                      assetsLastUpdatedAt: serverTimestamp(),
                    });
                    showToast("Product counts synced", "success");
                  } catch (e) { setError(e.message || "Failed to sync product"); }
                }}>Sync product</button> */}
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
                    {/* New: prefix / batch / shortcode overrides */}
                    <input className="cp-input" value={companyPrefix} onChange={(e) => setCompanyPrefix(e.target.value)} style={{ width: 100 }} placeholder="Prefix (BMM)" />
                    <input className="cp-input" value={batchOverride} onChange={(e) => setBatchOverride(e.target.value)} style={{ width: 90 }} placeholder="Batch e.g. 25" />
                    <input className="cp-input" value={shortCodeOverride} onChange={(e) => setShortCodeOverride(e.target.value)} style={{ width: 120 }} placeholder="Short code (optional)" />

                    <input className="cp-input" type="number" min="1" step="1" value={assetQty} onChange={(e) => setAssetQty(Number(e.target.value || 0))} style={{ width: 100 }} placeholder="Quantity" />
                    <input className="cp-input" type="number" min="0" step="0.01" value={assetPurchasePrice} onChange={(e) => setAssetPurchasePrice(e.target.value)} style={{ width: 160 }} placeholder="Purchase price / unit" />
                    <input className="cp-input" type="date" value={assetPurchaseDate} onChange={(e) => setAssetPurchaseDate(e.target.value)} style={{ width: 160 }} />
                    <input className="cp-input" value={assetSupplier} onChange={(e) => setAssetSupplier(e.target.value)} placeholder="Supplier (optional)" style={{ minWidth: 180 }} />
                    <select className="cp-input" value={assetBranch} onChange={(e) => setAssetBranch(e.target.value)} style={{ minWidth: 160 }}>
                      <option value="">Default branch</option>
                      {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                    <input className="cp-input" value={assetCompany} onChange={(e) => setAssetCompany(e.target.value)} placeholder="Company name (e.g. Company A)" style={{ minWidth: 200 }} />

                    <div style={{ flexBasis: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "10px 12px", borderRadius: 10, background: "rgba(99,102,241,.08)" }}>
                      <span className="muted">Total purchase cost</span>
                      <strong style={{ fontSize: 18 }}>{fmt.money((Number(assetQty) || 0) * (Number(assetPurchasePrice) || 0))}</strong>
                    </div>
                    <button className="cp-btn" onClick={onCreateAssets}>Add Inventory</button>
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                    Tip: add arbitrary metadata (JSON) to tag assets (e.g., serial, size, color). You can override prefix/batch/short code — preview below is best-effort.
                  </div>

                  {/* Preview line */}
                  <div style={{ marginTop: 6 }} className="muted">Preview next asset id: <strong>{previewNextAssetId}</strong></div>

                  {/* Print / Export Buttons */}
                  {/* Print all assets' QR for this product */}
                  <div style={{ marginTop: 8 }}>
                    <button
                      className="cp-btn"
                      onClick={async () => {
                        if (!selectedProduct) return setError("Select a product first.");
                        try {
                          const all = await listAssets({ productId: selectedProduct.id });
                          if (!Array.isArray(all) || all.length === 0) {
                            showToast("No assets found for this product", "error");
                            return;
                          }
                          all.forEach(a => a.productName = selectedProduct.name);
                          printAssets(all);
                        } catch (e) {
                          console.error("Failed to load assets for printing", e);
                          setError(e.message || "Failed to load assets");
                        }
                      }}
                    >
                      Print QR — All assets for this product
                    </button>
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

  {/* 🔥 BULK DELETE BAR — THIS WAS MISSING */}
  <div className="bulk-bar">
    <button
      className="cp-btn"
      onClick={doSetPurchaseDateFromCreatedAtForAllAssets}
      disabled={bulkPurchaseDateBusy}
      title="Applies to every asset in Firestore, not just the current product or filtered list"
    >
      {bulkPurchaseDateBusy ? "Updating all assets…" : "Set purchase date = created date (ALL assets)"}
    </button>

    {visibleAssets.length > 0 && <>
    <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <input
        type="checkbox"
        checked={allSelected}
        onChange={(e) => {
          setSelectedAssetIds(
            e.target.checked ? allVisibleAssetIds : []
          );
        }}
      />
      Select all assets
    </label>

    {selectedAssetIds.length > 0 && (
      <div className="asset-bulk-purchase">
        <strong>{selectedAssetIds.length} selected</strong>
        <input
          className="cp-input"
          type="number"
          min="0"
          step="0.01"
          value={bulkPurchaseRate}
          onChange={(e) => setBulkPurchaseRate(e.target.value)}
          placeholder="New purchase rate / asset"
          aria-label="New purchase rate per asset"
        />
        <button
          className="cp-btn"
          onClick={doBulkUpdatePurchaseRate}
          disabled={bulkPurchaseBusy}
        >
          {bulkPurchaseBusy ? "Updating…" : "Update purchase rate"}
        </button>
        <button className="cp-btn danger" onClick={doBulkDeleteAssets}>
          Delete selected ({selectedAssetIds.length})
        </button>
      </div>
    )}
    </>}
  </div>


  {/* Filters */}
  <div
    style={{
      display: "flex",
      gap: 8,
      marginTop: 8,
      alignItems: "center",
      flexWrap: "wrap",
    }}
  >
    <input
      className="cp-input"
      placeholder="Search assets by id or company…"
      value={assetSearch}
      onChange={(e) => setAssetSearch(e.target.value)}
      style={{ flex: "1 1 320px" }}
    />

    <select
      value={assetStatusFilter}
      onChange={(e) => setAssetStatusFilter(e.target.value)}
      className="cp-input"
      style={{ width: 160 }}
    >
      <option value="">All statuses</option>
      <option value="in_stock">In stock</option>
      <option value="out_for_rental">Out for rental</option>
      <option value="maintenance">Maintenance</option>
      <option value="reserved">Reserved</option>
    </select>

    <select
      value={assetBranchFilter}
      onChange={(e) => setAssetBranchFilter(e.target.value)}
      className="cp-input"
      style={{ width: 160 }}
    >
      <option value="">All branches</option>
      {branches.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
        </option>
      ))}
    </select>

    <select
      value={assetCompanyFilter}
      onChange={(e) => setAssetCompanyFilter(e.target.value)}
      className="cp-input"
      style={{ width: 180 }}
    >
      <option value="">All companies</option>
<option value="__none__">No company</option>

{[...new Set((assetsForProduct || [])
  .map((a) => a.company)
  .filter(Boolean))].map((company) => (
    <option key={company} value={company}>
      {company}
    </option>
))}

    </select>

    <select
      value={assetPageSize}
      onChange={(e) => setAssetPageSize(Number(e.target.value))}
      className="cp-input"
      style={{ width: 120 }}
    >
      {[12, 24, 48, 96].map((n) => (
        <option key={n} value={n}>
          {n}/page
        </option>
      ))}
    </select>

    <button className="cp-btn" onClick={refreshAssets}>
      Refresh
    </button>
  </div>

  {/* Assets grid */}
  <div className="assets-grid" style={{ marginTop: 12 }}>
    {visibleAssets.length === 0 && (
      <div className="muted" style={{ padding: 12 }}>
        No assets matching filters.
      </div>
    )}

    {Object.entries(
      visibleAssets.reduce((groups, asset) => {
        const company = asset.company || "Unknown company";
        if (!groups[company]) groups[company] = [];
        groups[company].push(asset);
        return groups;
      }, {})
    ).map(([company, assets]) => (
      <div key={company} style={{ gridColumn: "1 / -1" }}>
       <div
  style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    margin: "12px 0 6px",
  }}
>
  <h4>
    🏢 {company} <span className="muted">({assets.length})</span>
  </h4>

  <label className="muted" style={{ fontSize: 12 }}>
    <input
      type="checkbox"
      checked={assets.every((a) => selectedAssetIds.includes(a.id))}
      onChange={() => toggleSelectCompany(assets)}
    />{" "}
    Select all
  </label>
</div>


        <div className="assets-grid">
          {assets.map((a) => (
            <div key={a.id} className="asset-card">
              {/* Checkbox */}
              <input
                type="checkbox"
                checked={selectedAssetIds.includes(a.id)}
                onChange={(e) => {
                  setSelectedAssetIds((prev) =>
                    e.target.checked
                      ? [...prev, a.id]
                      : prev.filter((id) => id !== a.id)
                  );
                }}
                onClick={(e) => e.stopPropagation()}
                style={{ marginBottom: 6 }}
              />

              <div className="asset-top">
                <div>
                  <div style={{ fontWeight: 700 }}>{a.assetId}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {(branches.find((b) => b.id === a.branchId) || {}).name ||
                      a.branchId ||
                      "—"}
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div className="asset-company">🏢 {a.company || "—"}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    Status:{" "}
                    <span className={`status ${a.status}`}>{a.status}</span>
                  </div>
                </div>
              </div>

              <div className="asset-purchase-info">
                <div className="asset-purchase-price">
                  <span>Purchase price</span>
                  <strong>
                    {a.purchasePricePerUnit != null || a.purchasePrice != null
                      ? `₹${fmt.money(a.purchasePricePerUnit ?? a.purchasePrice)}`
                      : "Not recorded"}
                  </strong>
                </div>
                <div className="asset-purchase-extra">
                  {a.purchaseDate && <span>Purchased: {fmt.date(a.purchaseDate)}</span>}
                  {a.purchaseSupplier && <span>Supplier: {a.purchaseSupplier}</span>}
                </div>
              </div>

              <div className="asset-meta muted">
                {a.rental?.customer && (
                  <div>Rented to: {a.rental.customer}</div>
                )}
                <div>
                  Created: {fmt.date(a.createdAt)} · {a.createdByName || "—"}
                </div>
              </div>

              <div className="asset-actions">
                <button className="btn ghost" onClick={() => openAssetDetails(a)}>
                  Details
                </button>

                {a.status !== "out_for_rental" &&
                  a.status !== "reserved" &&
                  a.status !== "maintenance" && (
                    <button className="btn" onClick={() => doCheckout(a.id)}>
                      Checkout
                    </button>
                  )}

                {a.status === "out_for_rental" && (
                  <button className="btn" onClick={() => doCheckin(a.id)}>
                    Checkin
                  </button>
                )}

                {a.status === "reserved" ? (
                  <button className="btn ghost" onClick={() => doRelease(a.id)}>
                    Release
                  </button>
                ) : (
                  a.status !== "out_for_rental" &&
                  a.status !== "maintenance" && (
                    <button className="btn" onClick={() => doReserve(a.id)}>
                      Reserve
                    </button>
                  )
                )}

                <button
                  className={`btn ${a.status === "maintenance" ? "maintenance-active-btn" : "ghost"}`}
                  onClick={() => openMaintenance(a)}
                >
                  {a.status === "maintenance" ? "Complete Maintenance" : "Start Maintenance"}
                </button>

                <select
                  onChange={(e) => {
                    const to = e.target.value;
                    if (!to) return;
                    doMove(a.id, to);
                    e.target.value = "";
                  }}
                  defaultValue=""
                >
                  <option value="">Move</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>

                <button
                  className="btn ghost"
                  onClick={() => {
                    const item = [
                      {
                        ...a,
                        productName:
                          (selectedProduct && selectedProduct.name) || "",
                      },
                    ];
                    printAssets(item);
                  }}
                >
                  Print
                </button>

                <button
                  className="btn danger"
                  onClick={() => doDeleteAsset(a.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>

  <div className="cp-form-actions" style={{ marginTop: 12 }}>
    <button
      className="cp-btn ghost"
      onClick={() => setSelectedProduct(null)}
    >
      Close
    </button>
  </div>
</div>

          </div>
        </div>
      )}

      {/* Premium maintenance workflow */}
      {maintenanceOpen && maintenanceAsset && createPortal(
        <div
          className="cp-modal cp-maintenance-modal"
          role="dialog"
          aria-modal="true"
          onClick={() => !maintenanceBusy && setMaintenanceOpen(false)}
        >
          <div className="maintenance-workspace" onClick={(e) => e.stopPropagation()}>
            {(() => {
              const activeMaintenance = maintenanceAsset.maintenance || {};
              const isCompleting = maintenanceAsset.status === "maintenance" && !!activeMaintenance.code;
              const field = (label, key, type = "text", placeholder = "", extra = {}) => (
                <label className="maintenance-field">
                  <span>{label}</span>
                  <input
                    type={type}
                    value={maintenanceForm[key]}
                    onChange={(e) => updateMaintenanceForm(key, e.target.value)}
                    placeholder={placeholder}
                    {...extra}
                  />
                </label>
              );
              const selectField = (label, key, options) => (
                <label className="maintenance-field">
                  <span>{label}</span>
                  <select
                    value={maintenanceForm[key]}
                    onChange={(e) => updateMaintenanceForm(key, e.target.value)}
                  >
                    {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                  </select>
                </label>
              );
              const areaField = (label, key, placeholder) => (
                <label className="maintenance-field maintenance-field-wide">
                  <span>{label}</span>
                  <textarea
                    rows={3}
                    value={maintenanceForm[key]}
                    onChange={(e) => updateMaintenanceForm(key, e.target.value)}
                    placeholder={placeholder}
                  />
                </label>
              );

              return (
                <>
                  <div className="maintenance-head">
                    <div>
                      <div className="maintenance-eyebrow">ASSET SERVICE CENTER</div>
                      <h2>{isCompleting ? "Complete maintenance" : "Start maintenance"}</h2>
                      <p>{isCompleting
                        ? "Record the repair work, costs and final condition before returning this asset to stock."
                        : "Create a traceable service record and move this asset into maintenance."}</p>
                    </div>
                    <button className="maintenance-close" onClick={() => setMaintenanceOpen(false)} disabled={maintenanceBusy}>×</button>
                  </div>

                  <div className="maintenance-asset-strip">
                    <div className="maintenance-asset-icon">🔧</div>
                    <div className="maintenance-asset-main">
                      <strong>{maintenanceAsset.assetId}</strong>
                      <span>{selectedProduct?.name || "Inventory asset"} · {maintenanceAsset.company || "No company"}</span>
                    </div>
                    <span className={`maintenance-state-pill ${isCompleting ? "is-active" : "is-new"}`}>
                      {isCompleting ? "IN MAINTENANCE" : String(maintenanceAsset.status || "in_stock").replace(/_/g, " ").toUpperCase()}
                    </span>
                  </div>

                  {isCompleting && (
                    <div className="maintenance-code-banner">
                      <div>
                        <span>MAINTENANCE REFERENCE</span>
                        <strong>{activeMaintenance.code}</strong>
                      </div>
                      <div className="maintenance-code-meta">
                        <span>Started {activeMaintenance.startedAt ? new Date(activeMaintenance.startedAt).toLocaleString() : "—"}</span>
                        <span>Technician: {activeMaintenance.technician || "—"}</span>
                      </div>
                    </div>
                  )}

                  <div className="maintenance-scroll">
                    {!isCompleting ? (
                      <>
                        <div className="maintenance-section-heading">
                          <span>01</span>
                          <div><strong>Issue & service details</strong><small>What happened to this asset?</small></div>
                        </div>
                        <div className="maintenance-form-grid">
                          {selectField("Issue category", "category", [
                            ["general", "General repair"], ["electrical", "Electrical"], ["mechanical", "Mechanical"],
                            ["damage", "Physical damage"], ["cleaning", "Cleaning / servicing"],
                            ["inspection", "Inspection"], ["preventive", "Preventive maintenance"], ["other", "Other"],
                          ])}
                          {selectField("Priority", "priority", [
                            ["low", "Low"], ["normal", "Normal"], ["high", "High"], ["urgent", "Urgent"],
                          ])}
                          {field("Technician / responsible person *", "technician", "text", "Technician name")}
                          {field("Service center / vendor", "vendor", "text", "Internal team or vendor")}
                          {field("Expected completion", "expectedCompletionDate", "date")}
                          {field("Estimated cost (₹)", "estimatedCost", "number", "0", { min: "0", step: "0.01" })}
                          {selectField("Asset condition before repair", "initialCondition", [
                            ["excellent", "Excellent"], ["good", "Good"], ["fair", "Fair"], ["poor", "Poor"], ["damaged", "Damaged"],
                          ])}
                          {areaField("Problem description *", "issue", "Describe the fault, damage, symptoms or reason for servicing...")}
                          {areaField("Initial notes / handover details", "startNotes", "Accessories received, visible damage, customer notes, etc.")}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="maintenance-section-heading">
                          <span>02</span>
                          <div><strong>Repair completion report</strong><small>Capture exactly what was done to the asset.</small></div>
                        </div>
                        <div className="maintenance-form-grid">
                          {field("Completion date *", "completionDate", "date")}
                          {selectField("Final asset condition", "finalCondition", [
                            ["excellent", "Excellent — like new"], ["good", "Good — ready to use"],
                            ["fair", "Fair — usable with caution"], ["poor", "Poor — needs follow-up"],
                            ["damaged", "Damaged — do not release"],
                          ])}
                          {field("Labour cost (₹)", "laborCost", "number", "0", { min: "0", step: "0.01" })}
                          {field("Parts / materials cost (₹)", "partsCost", "number", "0", { min: "0", step: "0.01" })}
                          {field("Next service due", "nextServiceDate", "date")}
                          {field("Service vendor", "vendor", "text", "Vendor / workshop")}
                          {areaField("Work performed *", "workPerformed", "Describe repairs, checks, servicing and tests completed...")}
                          {areaField("Parts replaced", "partsReplaced", "Part name, quantity, part number or write None")}
                          {areaField("Completion notes", "completionNotes", "Warranty details, test results, recommendations or follow-up...")}
                        </div>
                        <div className="maintenance-cost-summary">
                          <div><span>Labour</span><strong>₹{fmt.money(maintenanceForm.laborCost || 0)}</strong></div>
                          <div><span>Parts</span><strong>₹{fmt.money(maintenanceForm.partsCost || 0)}</strong></div>
                          <div className="maintenance-cost-total"><span>Total maintenance cost</span><strong>₹{fmt.money(Number(maintenanceForm.laborCost || 0) + Number(maintenanceForm.partsCost || 0))}</strong></div>
                        </div>
                        {maintenanceForm.finalCondition === "poor" || maintenanceForm.finalCondition === "damaged" ? (
                          <div className="maintenance-warning">
                            <strong>Asset not ready for normal use</strong>
                            <span>Choose a safe final condition before completing. This action currently returns the asset to In Stock, so do not complete it while it remains unsafe.</span>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>

                  <div className="maintenance-footer">
                    <div className="maintenance-footer-hint">
                      {isCompleting
                        ? "Completing will close this service record and return the asset to In Stock."
                        : "Starting maintenance will block this asset from rental availability."}
                    </div>
                    <div className="maintenance-footer-actions">
                      <button className="maintenance-secondary-btn" onClick={() => setMaintenanceOpen(false)} disabled={maintenanceBusy}>Cancel</button>
                      {!isCompleting ? (
                        <button className="maintenance-primary-btn" onClick={startMaintenance} disabled={maintenanceBusy}>
                          {maintenanceBusy ? "Starting…" : "Start Maintenance"}
                        </button>
                      ) : (
                        <button
                          className="maintenance-primary-btn"
                          onClick={completeMaintenance}
                          disabled={maintenanceBusy || ["poor", "damaged"].includes(maintenanceForm.finalCondition)}
                        >
                          {maintenanceBusy ? "Saving report…" : "Complete Maintenance"}
                        </button>
                      )}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>,
        document.body
      )}

      {/* Asset details modal */}
     {assetDetailsOpen && assetDetails && (
  <div className="asset-modal-overlay" onClick={() => setAssetDetailsOpen(false)}>
    <div className="asset-modal-card" onClick={(e) => e.stopPropagation()}>

      <div className="asset-details-hero">
        <div className="asset-details-avatar">▦</div>
        <div className="asset-details-identity">
          <div className="asset-details-kicker">INVENTORY ASSET PROFILE</div>
          <h3 className="asset-modal-title">{assetDetails.assetId}</h3>
          <div className="asset-modal-subtitle">
            {selectedProduct?.name || assetDetails.productId}
            {assetDetails.company ? ` · ${assetDetails.company}` : ""}
            {" · "}
            {(branches.find(b => b.id === assetDetails.branchId) || {}).name || assetDetails.branchId || "Default branch"}
          </div>
        </div>
        <span className={`asset-details-status status ${assetDetails.status || "in_stock"}`}>
          {String(assetDetails.status || "in_stock").replace(/_/g, " ")}
        </span>
      </div>

      <div className="asset-overview-grid">
        <div><span>Purchase price</span><strong>₹{fmt.money(assetDetails.purchasePricePerUnit ?? assetDetails.purchasePrice ?? 0)}</strong></div>
        <div><span>Purchase date</span><strong>{assetDetails.purchaseDate ? fmt.date(assetDetails.purchaseDate) : "—"}</strong></div>
        <div><span>Current status</span><strong>{String(assetDetails.status || "in_stock").replace(/_/g, " ")}</strong></div>
        <div><span>Lifetime maintenance</span><strong>₹{fmt.money(assetDetails.totalMaintenanceCost || 0)}</strong></div>
      </div>

      <div className="asset-purchase-info asset-details-purchase">
        <div className="asset-purchase-price">
          <span>Purchase price per unit</span>
          <strong>
            {assetDetails.purchasePricePerUnit != null || assetDetails.purchasePrice != null
              ? `₹${fmt.money(assetDetails.purchasePricePerUnit ?? assetDetails.purchasePrice)}`
              : "Not recorded"}
          </strong>
        </div>
        <div className="asset-purchase-extra">
          {assetDetails.purchaseDate && <span>Purchase date: {fmt.date(assetDetails.purchaseDate)}</span>}
          {assetDetails.purchaseSupplier && <span>Supplier: {assetDetails.purchaseSupplier}</span>}
          {assetDetails.purchaseBatchId && <span>Batch: {assetDetails.purchaseBatchId}</span>}
        </div>
      </div>


      {/* MAINTENANCE OVERVIEW */}
      <div className="asset-section asset-maintenance-details">
        <div className="asset-details-section-head">
          <div>
            <h4 className="asset-section-title">Maintenance overview</h4>
            <p className="asset-muted">Service status, latest work order and lifetime maintenance cost</p>
          </div>
          <span className={`maintenance-state-pill ${assetDetails.status === "maintenance" ? "is-active" : "is-new"}`}>
            {assetDetails.status === "maintenance" ? "IN MAINTENANCE" : "NOT IN MAINTENANCE"}
          </span>
        </div>

        {assetDetails.maintenance?.code ? (
          <>
            <div className="asset-maintenance-grid">
              <div><span>Maintenance code</span><strong>{assetDetails.maintenance.code}</strong></div>
              <div><span>Category</span><strong>{String(assetDetails.maintenance.category || "—").replace(/_/g, " ")}</strong></div>
              <div><span>Priority</span><strong>{assetDetails.maintenance.priority || "—"}</strong></div>
              <div><span>Technician</span><strong>{assetDetails.maintenance.technician || "—"}</strong></div>
              <div><span>Started</span><strong>{fmt.date(assetDetails.maintenance.startedAt)}</strong></div>
              <div><span>Expected completion</span><strong>{assetDetails.maintenance.expectedCompletionDate || "—"}</strong></div>
              <div><span>Estimated cost</span><strong>₹{fmt.money(assetDetails.maintenance.estimatedCost || 0)}</strong></div>
              <div><span>Last maintenance cost</span><strong>₹{fmt.money(assetDetails.maintenance.totalCost || 0)}</strong></div>
            </div>
            <div className="asset-maintenance-description">
              <span>Reported issue</span>
              <p>{assetDetails.maintenance.issue || "—"}</p>
              {assetDetails.maintenance.workPerformed && <>
                <span>Work performed</span>
                <p>{assetDetails.maintenance.workPerformed}</p>
              </>}
              {assetDetails.maintenance.partsReplaced && <>
                <span>Parts replaced</span>
                <p>{assetDetails.maintenance.partsReplaced}</p>
              </>}
            </div>
            {assetDetails.maintenance.nextServiceDate && (
              <div className="asset-next-service">Next service due: <strong>{assetDetails.maintenance.nextServiceDate}</strong></div>
            )}
          </>
        ) : (
          <div className="asset-muted">No maintenance records have been added for this asset yet.</div>
        )}

        <div className="asset-maintenance-total">
          <span>Lifetime maintenance spend</span>
          <strong>₹{fmt.money(assetDetails.totalMaintenanceCost || 0)}</strong>
        </div>
      </div>

      {/* MAINTENANCE WORK ORDER HISTORY */}
      <div className="asset-section asset-maintenance-history-section">
        <h4 className="asset-section-title">Maintenance work orders</h4>
        {Array.isArray(assetDetails.maintenanceHistory) && assetDetails.maintenanceHistory.length > 0 ? (
          <div className="asset-maintenance-history-list">
            {assetDetails.maintenanceHistory
              .slice()
              .sort((a, b) => Date.parse(b.completedAt || b.startedAt || 0) - Date.parse(a.completedAt || a.startedAt || 0))
              .map((record, index) => (
                <div className="asset-maintenance-history-card" key={record.code || index}>
                  <div className="asset-maintenance-history-top">
                    <div>
                      <strong>{record.code || "Maintenance record"}</strong>
                      <span>{record.category || "General"} · {record.priority || "Normal"} priority</span>
                    </div>
                    <span className="maintenance-state-pill is-new">{record.status || "completed"}</span>
                  </div>
                  <div className="asset-maintenance-history-grid">
                    <div><span>Started</span><strong>{fmt.date(record.startedAt)}</strong></div>
                    <div><span>Completed</span><strong>{record.completionDate || fmt.date(record.completedAt)}</strong></div>
                    <div><span>Technician</span><strong>{record.technician || "—"}</strong></div>
                    <div><span>Total cost</span><strong>₹{fmt.money(record.totalCost || 0)}</strong></div>
                  </div>
                  {record.issue && <p><b>Issue:</b> {record.issue}</p>}
                  {record.workPerformed && <p><b>Work:</b> {record.workPerformed}</p>}
                  {record.partsReplaced && <p><b>Parts:</b> {record.partsReplaced}</p>}
                  {record.nextServiceDate && <div className="asset-next-service">Next service: <strong>{record.nextServiceDate}</strong></div>}
                </div>
              ))}
          </div>
        ) : (
          <div className="asset-muted">No completed maintenance work orders yet.</div>
        )}
      </div>

      {/* METADATA */}
      <div className="asset-section">

        <h4 className="asset-section-title">Metadata</h4>

        {assetDetails.metadata ? (
          <div className="asset-json-table-wrap">

            <table className="asset-json-table">
              <tbody>

                {Object.entries(assetDetails.metadata).map(([key, value]) => (

                  <tr key={key}>
                    <td className="asset-json-key">{key}</td>

                    <td className="asset-json-value">
                      {typeof value === "object"
                        ? JSON.stringify(value)
                        : String(value)}
                    </td>
                  </tr>

                ))}

              </tbody>
            </table>

          </div>
        ) : (
          <div className="asset-muted">No metadata available</div>
        )}

      </div>


      {/* QR */}
      {assetDetails.qrUrl && (
        <div className="asset-section">

          <h4 className="asset-section-title">QR Code</h4>

          <img
            src={assetDetails.qrUrl}
            alt={`QR for ${assetDetails.assetId}`}
            className="asset-qr-image"
          />

          <div className="asset-muted small">
            Scans to: assetId "{assetDetails.assetId}"
          </div>

        </div>
      )}


      {/* HISTORY */}
      <div className="asset-section">

        <h4 className="asset-section-title">History</h4>

        {Array.isArray(assetDetails.history) && assetDetails.history.length > 0 ? (

          <div className="asset-history-wrap">

            <table className="asset-history-table">

              <thead>
                <tr>
                  <th>When</th>
                  <th>Event</th>
                  <th>Customer</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Note</th>
                </tr>
              </thead>

              <tbody>

                {assetDetails.history
                  .slice()
                  .sort((a, b) => {

                    const ta = a?.ts?.seconds
                      ? a.ts.seconds * 1000
                      : Date.parse(a?.ts || 0);

                    const tb = b?.ts?.seconds
                      ? b.ts.seconds * 1000
                      : Date.parse(b?.ts || 0);

                    return tb - ta;

                  })
                  .map((h, i) => {

                    const ts = h?.ts?.seconds
                      ? new Date(h.ts.seconds * 1000)
                      : (h?.ts ? new Date(h.ts) : null);

                    const when = ts && !Number.isNaN(ts.getTime())
                      ? ts.toLocaleString()
                      : "—";

                    const type =
                      h.type || h.changeType ||
                      h.event || h.status || "update";

                    const data = h.data || {};

                    return (

                      <tr key={i}>

                        <td className="asset-muted">
                          {when}
                        </td>

                        <td>
                          <span className={`asset-ev asset-ev-${type}`}>
                            {String(type).replace(/_/g, " ")}
                          </span>
                        </td>

                        <td>
                          {data.customer || "—"}
                        </td>

                        <td>
                          {data.from
                            ? new Date(data.from).toLocaleDateString()
                            : "—"}
                        </td>

                        <td>
                          {data.to
                            ? new Date(data.to).toLocaleDateString()
                            : "—"}
                        </td>

                        
                        <td>
                          <div>{h.note || "—"}</div>
                          {data.maintenanceCode && (
                            <div className="asset-history-maintenance">
                              <strong>{data.maintenanceCode}</strong>
                              {data.technician && <span> · {data.technician}</span>}
                              {data.totalCost != null && <span> · ₹{fmt.money(data.totalCost)}</span>}
                              {data.workPerformed && <p>{data.workPerformed}</p>}
                            </div>
                          )}
                        </td>

                      </tr>

                    );

                  })}

              </tbody>

            </table>

          </div>

        ) : (

          <div className="asset-muted">
            No history recorded for this asset.
          </div>

        )}

      </div>


      {/* ACTIONS */}
      <div className="asset-modal-actions">

        <button
          className="asset-btn asset-btn-ghost"
          onClick={() => setAssetDetailsOpen(false)}
        >
          Close
        </button>

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
