// src/pages/OrderCreate.jsx
import React, { useEffect, useState } from "react";
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import {
  listBranches,
  listAssets,
  reserveAsset,
} from "../utils/inventory";
import { makeHistoryEntry, propagateToLead } from "../utils/status";
import "./OrderCreate.css";

const safeNum = (v) => (typeof v === "number" ? v : Number(v || 0));
const fmtCurrency = (v) => {
  try {
    return Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } catch {
    return v ?? "0.00";
  }
};

function calcTotals(items = [], discount = { type: "percent", value: 0 }, taxes = []) {
  const subtotal = (items || []).reduce((s, it) => s + (safeNum(it.qty) * safeNum(it.rate)), 0);
  let discountAmount = 0;
  if (discount) {
    if ((discount.type || "").toLowerCase() === "percent") discountAmount = subtotal * (safeNum(discount.value) / 100);
    else discountAmount = safeNum(discount.value);
  }
  const taxable = Math.max(0, subtotal - discountAmount);
  const taxBreakdown = (taxes || []).map((t) => {
    const rate = safeNum(t.rate);
    return { name: t.name || "", rate, amount: taxable * (rate / 100) };
  });
  const totalTax = taxBreakdown.reduce((s, t) => s + (safeNum(t.amount)), 0);
  const total = Math.max(0, taxable + totalTax);
  return { subtotal, discountAmount, taxBreakdown, totalTax, total };
}

// --- helpers to normalize shape variations ---
const normAddress = (addr) => {
  if (!addr) return "";
  if (typeof addr === "string") return addr;
  const parts = [
    addr.line1 || addr.address1 || addr.street,
    addr.line2 || addr.address2,
    addr.city || addr.town,
    addr.state || addr.province,
    addr.postalCode || addr.zip,
    addr.country,
  ].filter(Boolean);
  return parts.join(", ");
};

const normContact = (c) => {
  if (!c) return null;
  if (typeof c === "string") return { name: c };
  return {
    name: c.name || c.person || c.contactPerson || c.contactperson || "",
    phone: c.phone || c.mobile || c.contact || "",
    email: c.email || "",
  };
};

export default function OrderCreate({ open, quotation: incomingQuotation, onClose, onCreated }) {
  const navigate = useNavigate();

  const [branches, setBranches] = useState([]);
  const [products, setProducts] = useState([]); // <-- new products list
  const [draft, setDraft] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerFor, setPickerFor] = useState(null);
  const [pickerAssets, setPickerAssets] = useState([]);
  const [pickerSelected, setPickerSelected] = useState({});
  const [pickerLoading, setPickerLoading] = useState(false);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(false);

  // fetch products & branches when open
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const init = async () => {
      setLoadingInitial(true);
      setError("");
      try {
        // fetch products once (snapshot not necessary)
        const prodSnap = await getDocs(collection(db, "products"));
        const prods = prodSnap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
        if (!cancelled) setProducts(prods);

        // branches
        try {
          const b = await listBranches();
          if (!cancelled) setBranches(b || []);
        } catch (err) {
          console.warn("listBranches failed", err);
        }
      } catch (err) {
        console.error("OrderCreate init (products) failed", err);
        if (!cancelled) setError(err.message || "Failed to load products/branches");
      } finally {
        if (!cancelled) setLoadingInitial(false);
      }
    };
    init();
    return () => { cancelled = true; };
  }, [open]);

  // build full draft (keeps same merging logic as before)
  useEffect(() => {
    if (!open) return;
    const loadAll = async () => {
      setLoadingInitial(true);
      setError("");
      try {
        // refresh quotation
        let freshQuotation = incomingQuotation;
        if (incomingQuotation?.id) {
          try {
            const qSnap = await getDoc(doc(db, "quotations", incomingQuotation.id));
            if (qSnap.exists()) freshQuotation = { id: qSnap.id, ...(qSnap.data() || {}) };
          } catch (err) { console.warn("Failed to fetch fresh quotation", err); }
        }

        // requirement
        let requirement = null;
        if (freshQuotation?.requirementId) {
          try {
            const rSnap = await getDoc(doc(db, "requirements", freshQuotation.requirementId));
            if (rSnap.exists()) requirement = { id: rSnap.id, ...(rSnap.data() || {}) };
          } catch (err) { console.warn("Failed to fetch requirement", err); }
        }

        // lead
        let lead = null;
        const leadId = requirement?.leadId || freshQuotation?.leadId;
        if (leadId) {
          try {
            const lSnap = await getDoc(doc(db, "leads", leadId));
            if (lSnap.exists()) lead = { id: lSnap.id, ...(lSnap.data() || {}) };
          } catch (err) { console.warn("Failed to fetch lead", err); }
        }

        // tolerant handle to leadSnapshot variants (leadsnapshot/leadssnapshot)
       // tolerant handle to leadSnapshot variants (leadsnapshot/leadssnapshot)
const ls =
  requirement?.leadSnapshot ||
  requirement?.leadsnapshot ||
  requirement?.leadssnapshot ||
  null;

// read customerName from snapshot with tolerant keys
const snapCustomerName =
  (ls && (ls.customerName ?? ls.customername ?? ls.customer)) || null;

// canonical fields (prefer leadSnapshot.* and never use createdByName or lead.name)
const customerName =
  snapCustomerName ||
  requirement?.customerName ||
  freshQuotation?.customerName ||
  lead?.customerName ||
  lead?.companyName ||
  lead?.organization ||
  lead?.orgName ||
  "";

// keep contact logic as-is (yours was correct)
const deliveryContact =
  normContact(ls?.contactPerson || ls?.contactperson) ||
  normContact(requirement?.deliveryContact) ||
  normContact(freshQuotation?.deliveryContact) ||
  normContact(lead?.contactPerson) ||
  null;

const deliveryAddress =
  normAddress(ls?.address) ||
  normAddress(freshQuotation?.deliveryAddress || freshQuotation?.address) ||
  normAddress(requirement?.deliveryAddress || requirement?.address || requirement?.deliveryCity) ||
  normAddress(lead?.address) ||
  "";

        // taxes & discount priority
        const taxes =
          (freshQuotation?.taxes && Array.isArray(freshQuotation.taxes) && freshQuotation.taxes.length)
            ? freshQuotation.taxes
            : (requirement?.taxes && Array.isArray(requirement.taxes) && requirement.taxes.length)
              ? requirement.taxes
              : (ls?.taxes && Array.isArray(ls.taxes) && ls.taxes.length)
                ? ls.taxes
                : (lead?.taxes && Array.isArray(lead.taxes) && lead.taxes.length)
                  ? lead.taxes
                  : (freshQuotation?.taxes || []);

        const discount = freshQuotation?.discount || requirement?.discount || { type: "percent", value: 0 };

        // items source
        let itemsSource = (freshQuotation?.items && Array.isArray(freshQuotation.items) && freshQuotation.items.length)
          ? freshQuotation.items
          : (requirement?.equipment && Array.isArray(requirement.equipment) && requirement.equipment.length)
            ? requirement.equipment
            : (requirement?.requirementItems && Array.isArray(requirement.requirementItems) && requirement.requirementItems.length)
              ? requirement.requirementItems
              : [];

        // normalize items and try to preserve productId if present
        const items = (itemsSource.length ? itemsSource : [{ name: "", qty: 1, rate: 0 }]).map((it, idx) => {
          const name = it.name || it.itemName || it.productName || it.productTitle || "";
          const qty = Number(it.qty ?? it.quantity ?? 1);
          const rate = Number(it.rate ?? it.price ?? 0);
          const amount = Number(it.amount ?? qty * rate);
          const notes = it.notes || it.unitNotes || it.specialInstructions || "";
          const days = it.expectedDurationDays ?? it.days ?? requirement?.expectedDurationDays ?? 0;
          const expectedStartDate = it.expectedStartDate || it.startDate || requirement?.expectedStartDate || "";
          const expectedEndDate = it.expectedEndDate || it.endDate || requirement?.expectedEndDate || "";
          const productId = it.productId || it.product || "";
          return {
            id: it.id || `i-${Date.now()}-${idx}`,
            name,
            qty,
            rate,
            amount,
            notes,
            days,
            expectedStartDate,
            expectedEndDate,
            productId,
            branchId: "", // user selects
            assignedAssets: [],
            autoAssigned: false,
          };
        });

        const draftObj = {
          quotationId: freshQuotation?.id || incomingQuotation?.id || null,
          quotationNo: freshQuotation?.quoNo || freshQuotation?.quotationId || incomingQuotation?.quoNo || "",
          requirementId: freshQuotation?.requirementId || requirement?.id || "",
          orderNo: `O-${Math.floor(Date.now() / 1000)}`,
          customerName,
          deliveryAddress,
          deliveryContact,
          leadId: requirement?.leadId || freshQuotation?.leadId || (lead?.id || null),
          items,
          discount,
          taxes,
          notes: freshQuotation?.notes || requirement?.notes || "",
          totals: freshQuotation?.totals || calcTotals(items, discount, taxes),
        };

        if (!open) return;
        setDraft(draftObj);
      } catch (err) {
        console.error("OrderCreate init error", err);
        setError(err.message || "Failed to prepare order draft");
      } finally {
        setTimeout(() => setLoadingInitial(false), 80);
      }
    };
    loadAll();
    return () => { /* cleanup if needed */ };
  }, [open, incomingQuotation]);

  // open asset picker for an item: product must be selected first
  const openAssetPicker = async (itemIndex) => {
    if (!draft) return;
    const it = draft.items[itemIndex];
    if (!it.productId) {
      setError("Please select a Product for this item before assigning assets.");
      return;
    }
    setPickerAssets([]);
    setPickerSelected({});
    setPickerFor({ itemIndex });
    setPickerOpen(true);
    setPickerLoading(true);
    setError("");
    try {
      // list only in_stock assets for product + branch
      const assets = await listAssets({ productId: it.productId || null, branchId: it.branchId || null, status: "in_stock" });
      setPickerAssets(assets || []);
    } catch (err) {
      console.error("openAssetPicker", err);
      setError(err.message || "Failed to load assets");
      setPickerAssets([]);
    } finally {
      setPickerLoading(false);
    }
  };

  const togglePickerSelect = (assetId) => {
    setPickerSelected((p) => ({ ...p, [assetId]: !p[assetId] }));
  };

  const confirmPickerSelection = () => {
    if (!pickerFor) return;
    const idx = pickerFor.itemIndex;
    const selectedIds = Object.keys(pickerSelected).filter((k) => pickerSelected[k]);
    setDraft((d) => {
      const nd = JSON.parse(JSON.stringify(d));
      nd.items[idx].assignedAssets = [...(nd.items[idx].assignedAssets || []), ...selectedIds];
      // update totals not needed here
      return nd;
    });
    setPickerOpen(false);
    setPickerFor(null);
    setPickerAssets([]);
    setPickerSelected({});
  };

  const autoAssignAssetsForItem = async (itemIndex, count = 1) => {
    try {
      const it = draft.items[itemIndex];
      if (!it.productId) { setError("Select product before auto-assign"); return; }
      const assets = await listAssets({ productId: it.productId || null, branchId: it.branchId || null, status: "in_stock" });
      if (!assets || assets.length === 0) {
        setError("No assets available to auto-assign");
        return;
      }
      const pick = assets.slice(0, Number(count || 1)).map(a => a.id);
      setDraft((d) => {
        const nd = JSON.parse(JSON.stringify(d));
        nd.items[itemIndex].assignedAssets = [...(nd.items[itemIndex].assignedAssets || []), ...pick];
        nd.items[itemIndex].autoAssigned = true;
        return nd;
      });
    } catch (err) {
      console.error("autoAssign failed", err);
      setError(err.message || "Auto-assign failed");
    }
  };

  const updateDraftItem = (idx, patch) => {
    setDraft((d) => {
      const nd = JSON.parse(JSON.stringify(d));
      nd.items[idx] = { ...(nd.items[idx] || {}), ...patch };
      nd.items[idx].amount = safeNum(nd.items[idx].qty) * safeNum(nd.items[idx].rate);
      nd.totals = calcTotals(nd.items, nd.discount, nd.taxes);
      // if productId changed, clear assigned assets to avoid mismatch
      if (patch.productId !== undefined) {
        nd.items[idx].assignedAssets = [];
      }
      return nd;
    });
  };

  const computeSubtotal = () => {
    if (!draft) return 0;
    return draft.items.reduce((s, it) => s + (safeNum(it.qty) * safeNum(it.rate)), 0);
  };

  const createOrder = async () => {
    setError("");
    if (!draft) return;
    setCreating(true);
    try {
      const user = auth.currentUser || {};
      const totals = calcTotals(draft.items, draft.discount, draft.taxes);

      const itemsPayload = draft.items.map((it) => ({
        name: it.name,
        qty: Number(it.qty || 0),
        rate: Number(it.rate || 0),
        amount: Number(it.amount || 0),
        notes: it.notes || "",
        days: it.days || 0,
        expectedStartDate: it.expectedStartDate || "",
        expectedEndDate: it.expectedEndDate || "",
        productId: it.productId || "",
        assignedAssets: it.assignedAssets || [],
        branchId: it.branchId || "",
      }));

      const orderPayload = {
        quotationId: draft.quotationId,
        requirementId: draft.requirementId || "",
        orderNo: draft.orderNo,
        customerName: draft.customerName || "",
        deliveryAddress: draft.deliveryAddress || "",
        deliveryContact: draft.deliveryContact || null,
        leadId: draft.leadId || null,
        items: itemsPayload,
        discount: draft.discount || { type: "percent", value: 0 },
        taxes: draft.taxes || [],
        totals,
        status: "created",
        createdAt: serverTimestamp(),
        createdBy: user.uid || "",
        createdByName: user.displayName || user.email || "",
      };

      const ref = await addDoc(collection(db, "orders"), orderPayload);

      // checkout assigned assets
      for (const it of itemsPayload) {
        if (Array.isArray(it.assignedAssets) && it.assignedAssets.length) {
          for (const assetDocId of it.assignedAssets) {
            try {
              await reserveAsset(assetDocId, {
                reservationId: ref.id,
                orderId: ref.id,
                customer: orderPayload.customerName || "",
                until: it.expectedEndDate || null,
                note: `Reserved for order ${orderPayload.orderNo}`,
              });
            } catch (err) {
              console.warn("reserveAsset failed", assetDocId, err);
            }
          }
        }
      }

      // update quotation & requirement history
      if (draft.quotationId) {
        await updateDoc(doc(db, "quotations", draft.quotationId), {
          orderId: ref.id,
          status: "order_created",
          updatedAt: serverTimestamp(),
          updatedBy: user.uid || "",
          updatedByName: user.displayName || user.email || "",
        });
      }

      if (draft.requirementId) {
        const entry = makeHistoryEntry(user, {
          type: "order",
          field: "status",
          oldValue: "",
          newValue: "order_created",
          note: `Order ${orderPayload.orderNo} created from quotation ${draft.quotationId || draft.quotationNo}`,
        });
        await updateDoc(doc(db, "requirements", draft.requirementId), {
          status: "order_created",
          updatedAt: serverTimestamp(),
          updatedBy: user.uid || "",
          updatedByName: user.displayName || user.email || "",
          history: arrayUnion(entry),
        });
        propagateToLead(draft.requirementId, "order", "", "order_created", entry.note);
      }

      if (onCreated) onCreated(ref.id);
      if (onClose) onClose();
      navigate("/orders");
    } catch (err) {
      console.error("createOrder error", err);
      setError(err.message || "Failed to create order");
    } finally {
      setCreating(false);
    }
  };

  if (!open) return null;

  return (
    <div className="cp-drawer" onClick={() => onClose && onClose()}>
      <div className="cp-form details" onClick={(e) => e.stopPropagation()}>
        <div className="cp-form-head">
          <h2>Create Order — {draft?.orderNo || "…"}</h2>
          <div>
            <button className="cp-btn ghost" onClick={() => onClose && onClose()}>Cancel</button>
            <button className="cp-btn" onClick={createOrder} disabled={creating || loadingInitial}>{creating ? "Creating…" : "Create Order"}</button>
          </div>
        </div>

        {loadingInitial && <div className="muted">Loading details…</div>}
        {error && <div style={{ background: "#fff5f5", color: "#9b1c1c", padding: 8, borderRadius: 6 }}>{error}</div>}

        {!loadingInitial && draft && (
          <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ marginBottom: 12 }}>
                <div className="label muted">Customer</div>
                <div style={{ fontWeight: 700 }}>{draft.customerName || "—"}</div>
                <div className="muted" style={{ marginTop: 6 }}>{draft.deliveryAddress || "—"}</div>

                {/* Contact rendered safely: name • phone • email */}
                {draft.deliveryContact ? (
                  <div style={{ marginTop: 6 }} className="muted">
                    Contact: {draft.deliveryContact.name || ""}
                    {draft.deliveryContact.phone ? ` • ${draft.deliveryContact.phone}` : ""}
                    {draft.deliveryContact.email ? ` • ${draft.deliveryContact.email}` : ""}
                  </div>
                ) : null}
              </div>

              <div>
                <h3>Items</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {draft.items.map((it, idx) => (
                    <div key={it.id} style={{ border: "1px solid #eef2f7", padding: 10, borderRadius: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{it.name || "—"}</div>
                          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>Product</div>

                          {/* Product select: populated from products collection */}
                          <select
                            className="cp-input"
                            value={it.productId || ""}
                            onChange={(e) => updateDraftItem(idx, { productId: e.target.value })}
                            style={{ marginTop: 6, width: 280 }}
                          >
                            <option value="">Select product (required before asset assign)</option>
                            {products.map((p) => <option key={p.id} value={p.id}>{p.name} {p.sku ? `· ${p.sku}` : ""}</option>)}
                          </select>
                        </div>

                        <div style={{ width: 220 }}>
                          <div className="muted">Branch</div>
                          <select className="cp-input" value={it.branchId || ""} onChange={(e) => updateDraftItem(idx, { branchId: e.target.value })}>
                            <option value="">Default branch</option>
                            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                          </select>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <input className="cp-input" style={{ width: 90 }} value={it.qty} onChange={(e) => updateDraftItem(idx, { qty: Number(e.target.value || 0) })} />
                        <input className="cp-input" style={{ width: 140 }} value={it.rate} onChange={(e) => updateDraftItem(idx, { rate: Number(e.target.value || 0) })} />
                        <input className="cp-input" style={{ width: 140 }} value={it.days} onChange={(e) => updateDraftItem(idx, { days: Number(e.target.value || 0) })} />
                        <input className="cp-input" placeholder="Start (YYYY-MM-DD)" value={it.expectedStartDate || ""} onChange={(e) => updateDraftItem(idx, { expectedStartDate: e.target.value })} />
                        <input className="cp-input" placeholder="End (YYYY-MM-DD)" value={it.expectedEndDate || ""} onChange={(e) => updateDraftItem(idx, { expectedEndDate: e.target.value })} />
                      </div>

                      <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
                        <div style={{ fontSize: 13 }}><strong>Assigned:</strong> {(it.assignedAssets || []).length}</div>
                        <button className="cp-btn ghost" onClick={() => openAssetPicker(idx)}>Assign Product</button>
                        <button className="cp-btn ghost" onClick={() => autoAssignAssetsForItem(idx, it.qty || 1)}>Auto-assign</button>
                        <div style={{ marginLeft: "auto", fontWeight: 700 }}>Amount: {fmtCurrency(it.amount || 0)}</div>
                      </div>

                      {(it.assignedAssets || []).length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <div className="muted">Assigned assets</div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                            {it.assignedAssets.map(a => <div key={a} className="chip">{a}</div>)}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ width: 320 }}>
              <div className="label muted">Totals</div>
              <div style={{ marginTop: 8 }}>
                <div className="meta-row"><div className="label">Subtotal</div><div className="value">{fmtCurrency(draft.totals?.subtotal || computeSubtotal())}</div></div>
                <div className="meta-row"><div className="label">Discount</div><div className="value">{draft.discount?.type === "percent" ? `${draft.discount?.value || 0}%` : fmtCurrency(draft.discount?.value || 0)}</div></div>

                <div style={{ marginTop: 8 }}>
                  <div className="label muted">Taxes</div>
                  <div style={{ marginTop: 6 }}>
                    {(draft.taxes || []).map((t, i) => <div key={i}>{t.name} — {t.rate}%</div>)}
                  </div>
                </div>

                <div className="meta-row" style={{ marginTop: 12 }}><div className="label">Total Tax</div><div className="value">{fmtCurrency(draft.totals?.totalTax || 0)}</div></div>
                <div className="meta-row"><div className="label strong">Total</div><div className="value strong">{fmtCurrency(draft.totals?.total || computeSubtotal())}</div></div>
              </div>

              <div style={{ marginTop: 18 }}>
                <button className="cp-btn" onClick={createOrder} disabled={creating || loadingInitial}>{creating ? "Creating…" : "Create Order"}</button>
                <button className="cp-btn ghost" style={{ marginLeft: 8 }} onClick={() => onClose && onClose()}>Cancel</button>
              </div>
            </div>
          </div>
        )}
        
        {/* Asset picker modal */}
        {pickerOpen && pickerFor !== null && (
          <div className="cp-modal" onClick={() => { setPickerOpen(false); setPickerFor(null); setPickerAssets([]); }}>
            <div className="cp-modal-card" onClick={(e) => e.stopPropagation()}>
              <h4>Select assets for item #{pickerFor.itemIndex + 1}</h4>

              {pickerLoading && <div className="muted">Loading…</div>}

              {/* In-stock summary at top */}
              {!pickerLoading && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                  <div className="muted">In stock: {(pickerAssets || []).length}</div>
                  <div style={{ fontSize: 13, color: "#6b7280" }}>
                    {(() => {
                      const it = draft?.items?.[pickerFor.itemIndex];
                      if (!it) return "";
                      const prod = products.find((p) => p.id === it.productId);
                      return prod ? `Product: ${prod.name}` : "Product: —";
                    })()}
                  </div>
                </div>
              )}

              {!pickerLoading && pickerAssets.length === 0 && <div className="muted" style={{ marginTop: 8 }}>No assets in stock for this product / branch.</div>}

              <div style={{ maxHeight: 300, overflowY: "auto", marginTop: 8 }}>
                {pickerAssets.map((a) => (
                  <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: 8, borderBottom: "1px solid #eef2f7" }}>
                    <input type="checkbox" checked={!!pickerSelected[a.id]} onChange={() => togglePickerSelect(a.id)} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700 }}>{a.assetId || a.id}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{a.metadata?.model || a.productId} · {(branches.find(b => b.id === a.branchId) || {}).name || a.branchId || "—"}</div>
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>Status: <strong style={{ textTransform: "capitalize" }}>{a.status}</strong></div>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
                <button className="cp-btn ghost" onClick={() => { setPickerOpen(false); setPickerFor(null); setPickerAssets([]); setPickerSelected({}); }}>Cancel</button>
                <button className="cp-btn" onClick={confirmPickerSelection}>Assign selected</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
