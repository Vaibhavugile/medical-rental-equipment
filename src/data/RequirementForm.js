import React, { useEffect, useRef, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import "./Requirements.css";

const emptyLine = () => ({ productId: "", name: "", qty: 1, unitNotes: "" });

export default function RequirementForm({ lead, requirement = null, onSaved, onCancel }) {
  const [form, setForm] = useState({
    requirementId: null,
    leadId: lead?.id || "",
    leadSnapshot: {
      customerName: lead?.customerName || "",
      contactPerson: lead?.contactPerson || "",
      phone: lead?.phone || "",
    },
    equipment: [emptyLine()],
    expectedStartDate: "",
    expectedDurationDays: 7,
    expectedEndDate: "",
    deliveryAddress: lead?.address || "",
    deliveryCity: lead?.address ? (lead.address.split(",").pop() || "") : "",
    deliveryContact: {
      name: lead?.contactPerson || "",
      phone: lead?.phone || "",
      email: lead?.email || "",
    },
    urgency: "normal",
    specialInstructions: "",
    status: "draft",
    assignedTo: "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [lastSaved, setLastSaved] = useState(null);

  // ───────────────────────────────────────────────────────────
  // Products for suggestions
  // ───────────────────────────────────────────────────────────
  const [products, setProducts] = useState([]); // [{id, name, sku, defaultRate, ...}]
  useEffect(() => {
    const q = query(collection(db, "products"), orderBy("name", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setProducts(snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) })));
    });
    return () => unsub();
  }, []);

  // Suggestion UI state
  const [suggestFor, setSuggestFor] = useState(null); // row index or null
  const wrapsRef = useRef([]); // ref to each name input wrapper

  // Close suggestions on outside click
  useEffect(() => {
    function handleDocMouseDown(e) {
      if (suggestFor == null) return;
      const el = wrapsRef.current[suggestFor];
      if (!el) return;
      if (!el.contains(e.target)) setSuggestFor(null);
    }
    document.addEventListener("mousedown", handleDocMouseDown);
    return () => document.removeEventListener("mousedown", handleDocMouseDown);
  }, [suggestFor]);

  const findSuggestions = (qstr) => {
    const q = (qstr || "").trim().toLowerCase();
    if (!q) return [];
    const out = [];
    for (const p of products) {
      const name = String(p.name || "").toLowerCase();
      const sku = String(p.sku || "").toLowerCase();
      if (name.includes(q) || (sku && sku.includes(q))) {
        out.push(p);
        if (out.length >= 8) break; // cap results
      }
    }
    return out;
  };

  // Load requirement or seed from lead
  useEffect(() => {
    if (requirement) {
      setForm((prev) => ({
        ...prev,
        ...requirement,
        requirementId: requirement.id || requirement.requirementId,
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        leadId: lead?.id || prev.leadId,
        leadSnapshot: {
          customerName: lead?.customerName || prev.leadSnapshot.customerName,
          contactPerson: lead?.contactPerson || prev.leadSnapshot.contactPerson,
          phone: lead?.phone || prev.leadSnapshot.phone,
        },
        deliveryAddress: lead?.address || prev.deliveryAddress,
      }));
    }
  }, [requirement, lead]);

  // Compute end date from start + duration
  useEffect(() => {
    if (form.expectedStartDate && form.expectedDurationDays) {
      const start = new Date(form.expectedStartDate);
      const end = new Date(start);
      end.setDate(start.getDate() + Number(form.expectedDurationDays));
      setForm((prev) => ({ ...prev, expectedEndDate: end.toISOString().slice(0, 10) }));
    } else {
      setForm((prev) => ({ ...prev, expectedEndDate: "" }));
    }
  }, [form.expectedStartDate, form.expectedDurationDays]);

  // Autosave draft every 15s (only if already created)
  useEffect(() => {
    const handler = setTimeout(() => {
      if (form.requirementId) {
        save(form.status || "draft", true).catch(() => {});
      }
    }, 15000);
    return () => clearTimeout(handler);
  }, [form]);

  // Equipment handlers
  const addLine = () => setForm((f) => ({ ...f, equipment: [...f.equipment, emptyLine()] }));
  const removeLine = (i) => setForm((f) => ({ ...f, equipment: f.equipment.filter((_, idx) => idx !== i) }));
  const setLine = (i, patch) =>
    setForm((f) => {
      const arr = [...f.equipment];
      arr[i] = { ...arr[i], ...patch };
      return { ...f, equipment: arr };
    });

  // Validation
  const validate = () => {
    if (!form.equipment || !form.equipment.length) return "Add at least one equipment line.";
    for (const l of form.equipment) {
      if (!l.name || !l.qty || Number(l.qty) < 1) return "Each equipment line needs a name and qty >= 1.";
    }
    if (!form.expectedStartDate) return "Expected start date is required.";
    if (!form.deliveryAddress) return "Delivery address is required.";
    return null;
  };

  // Save (create/update)
  async function save(nextStatus = "draft", silent = false) {
    const v = validate();
    if (v) {
      if (!silent) setError(v);
      throw new Error(v);
    }
    setSaving(true);
    setError("");
    try {
      const user = auth.currentUser || {};
      const payload = {
        leadId: form.leadId || "",
        leadSnapshot: form.leadSnapshot || {},
        equipment: form.equipment,
        expectedStartDate: form.expectedStartDate || "",
        expectedDurationDays: Number(form.expectedDurationDays) || 0,
        expectedEndDate: form.expectedEndDate || "",
        deliveryAddress: form.deliveryAddress || "",
        deliveryCity: form.deliveryCity || "",
        deliveryContact: form.deliveryContact || {},
        urgency: form.urgency || "normal",
        specialInstructions: form.specialInstructions || "",
        status: nextStatus || "draft",
        assignedTo: form.assignedTo || "",
        updatedAt: serverTimestamp(),
        updatedBy: user.uid || "",
        updatedByName: user.displayName || user.email || "",
      };

      if (form.requirementId) {
        const ref = doc(db, "requirements", form.requirementId);
        await updateDoc(ref, payload);
      } else {
        payload.createdAt = serverTimestamp();
        payload.createdBy = user.uid || "";
        payload.createdByName = user.displayName || user.email || "";
        const ref = await addDoc(collection(db, "requirements"), payload);
        await updateDoc(ref, { requirementId: ref.id });
        setForm((f) => ({ ...f, requirementId: ref.id }));
      }

      setLastSaved(new Date());
      if (!silent && onSaved) onSaved(payload);
      return true;
    } catch (err) {
      console.error("Requirement save error:", err);
      if (!silent) setError(err.message || "Failed to save requirement");
      throw err;
    } finally {
      setSaving(false);
    }
  }

  const saveReady = () => save("ready_for_quotation").catch(() => {});

  // Render (React.createElement)
  return React.createElement(
    "div",
    { className: "req-drawer req-animate-in" },
    // Header
    React.createElement(
      "div",
      { className: "req-header" },
      React.createElement(
        "div",
        { className: "req-title" },
        React.createElement("h2", null, form.requirementId ? "Edit Requirement" : "Create Requirement"),
        React.createElement(
          "div",
          { className: "req-sub" },
          "Lead: ",
          form.leadSnapshot.customerName,
          " — ",
          form.leadSnapshot.contactPerson
        )
      ),
      React.createElement(
        "div",
        { className: "req-actions" },
        React.createElement(
          "button",
          { className: "btn ghost", onClick: onCancel, "aria-label": "Close" },
          "Close"
        )
      )
    ),

    // Body
    React.createElement(
      "div",
      { className: "req-body" },
      React.createElement(
        "div",
        { className: "req-grid" },

        // Contact & Delivery
        React.createElement(
          "div",
          { className: "card" },
          React.createElement("h3", null, "Contact & Delivery"),
          React.createElement("label", null, "Delivery Address"),
          React.createElement("input", {
            className: "input",
            value: form.deliveryAddress,
            onChange: (e) => setForm((f) => ({ ...f, deliveryAddress: e.target.value })),
          }),
          React.createElement("label", null, "City"),
          React.createElement("input", {
            className: "input",
            value: form.deliveryCity,
            onChange: (e) => setForm((f) => ({ ...f, deliveryCity: e.target.value })),
          }),
          React.createElement("label", null, "Contact Name"),
          React.createElement("input", {
            className: "input",
            value: form.deliveryContact.name,
            onChange: (e) =>
              setForm((f) => ({
                ...f,
                deliveryContact: { ...form.deliveryContact, name: e.target.value },
              })),
          }),
          React.createElement("label", null, "Contact Phone"),
          React.createElement("input", {
            className: "input",
            value: form.deliveryContact.phone,
            onChange: (e) =>
              setForm((f) => ({
                ...f,
                deliveryContact: { ...form.deliveryContact, phone: e.target.value },
              })),
          })
        ),

        // Timing & Urgency
        React.createElement(
          "div",
          { className: "card" },
          React.createElement("h3", null, "Timing & Urgency"),
          React.createElement("label", null, "Expected Start Date"),
          React.createElement("input", {
            className: "input",
            type: "date",
            value: form.expectedStartDate,
            onChange: (e) => setForm((f) => ({ ...f, expectedStartDate: e.target.value })),
          }),
          React.createElement("label", null, "Duration (days)"),
          React.createElement("input", {
            className: "input",
            type: "number",
            value: form.expectedDurationDays,
            onChange: (e) =>
              setForm((f) => ({
                ...f,
                expectedDurationDays: Number(e.target.value),
              })),
          }),
          React.createElement("label", null, "Expected End Date"),
          React.createElement("input", {
            className: "input",
            type: "date",
            value: form.expectedEndDate,
            readOnly: true,
          }),
          React.createElement("label", null, "Urgency"),
          React.createElement(
            "select",
            {
              className: "input",
              value: form.urgency,
              onChange: (e) => setForm((f) => ({ ...f, urgency: e.target.value })),
            },
            React.createElement("option", { value: "normal" }, "Normal"),
            React.createElement("option", { value: "urgent" }, "Urgent"),
            React.createElement("option", { value: "immediate" }, "Immediate")
          )
        ),

        // Equipment (full width) with right-aligned Add button
        React.createElement(
          "div",
          { className: "card card-equip", style: { gridColumn: "1 / -1" } },
          React.createElement(
            "h3",
            { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
            "Equipment",
            React.createElement(
              "button",
              { className: "btn", onClick: () => addLine() },
              "+ Add"
            )
          ),

          // Rows
          form.equipment.map((line, i) =>
            React.createElement(
              "div",
              { key: i, className: "equip-row" },

              // Name + suggestions dropdown (stable)
              React.createElement(
                "div",
                {
                  className: "equip-name-wrap",
                  style: { position: "relative" },
                  ref: (el) => (wrapsRef.current[i] = el),
                  onMouseDown: (e) => e.stopPropagation(), // prevent outer click handlers
                },
                React.createElement("input", {
                  className: "input equip-name",
                  placeholder: "Product name",
                  value: line.name,
                  onFocus: () => setSuggestFor(i),
                  onChange: (e) => {
                    const v = e.target.value;
                    setLine(i, { name: v, productId: "" }); // user typing breaks link
                    setSuggestFor(i);
                  },
                }),

                // linked indicator
                line.productId
                  ? React.createElement(
                      "div",
                      { className: "caps", style: { position: "absolute", right: 8, top: -14, color: "#16a34a" } },
                      "linked"
                    )
                  : null,

                // Suggestion dropdown
                suggestFor === i && findSuggestions(line.name).length
                  ? React.createElement(
                      "div",
                      {
                        className: "suggest-pop",
                        style: {
                          position: "absolute",
                          zIndex: 9999,
                          left: 0,
                          right: 0,
                          top: "calc(100% + 4px)",
                          background: "#fff",
                          border: "1px solid rgba(15,23,42,0.08)",
                          borderRadius: 8,
                          boxShadow: "0 10px 24px rgba(15,23,42,0.08)",
                          maxHeight: 260,
                          overflowY: "auto",
                          overflowX: "hidden",
                        },
                        onMouseDown: (e) => {
                          // keep focus so click doesn't blur/close first
                          e.preventDefault();
                          e.stopPropagation();
                        },
                      },
                      ...findSuggestions(line.name).map((p) =>
                        React.createElement(
                          "button",
                          {
                            key: p.id,
                            type: "button",
                            className: "suggest-item",
                            onClick: () => {
                              setLine(i, { name: p.name || "", productId: p.id });
                              setSuggestFor(null);
                            },
                            style: {
                              display: "flex",
                              width: "100%",
                              textAlign: "left",
                              gap: 8,
                              padding: "10px 12px",
                              border: "none",
                              background: "white",
                              cursor: "pointer",
                              alignItems: "center",
                              borderBottom: "1px solid rgba(15,23,42,0.04)",
                              color: "#111827",
                            },
                          },
                          React.createElement("div", { style: { fontWeight: 700 } }, p.name || "Unnamed"),
                          React.createElement(
                            "div",
                            { className: "muted", style: { marginLeft: "auto", fontSize: 12, color: "#6b7280" } },
                            p.sku ? `SKU: ${p.sku}` : ""
                          )
                        )
                      )
                    )
                  : null
              ),

              // Qty
              React.createElement("input", {
                className: "input equip-qty",
                type: "number",
                min: "1",
                value: line.qty,
                onChange: (e) => setLine(i, { qty: Number(e.target.value) }),
              }),

              // Notes
              React.createElement("input", {
                className: "input equip-note",
                placeholder: "Notes (optional)",
                value: line.unitNotes,
                onChange: (e) => setLine(i, { unitNotes: e.target.value }),
              }),

              // Remove row
              React.createElement(
                "button",
                { className: "btn icon", onClick: () => removeLine(i) },
                "✕"
              )
            )
          )
        ),

        // Special Instructions
        React.createElement(
          "div",
          { className: "card", style: { gridColumn: "1 / -1" } },
          React.createElement("h3", null, "Special Instructions"),
          React.createElement("textarea", {
            className: "input textarea",
            value: form.specialInstructions,
            onChange: (e) => setForm((f) => ({ ...f, specialInstructions: e.target.value })),
          })
        )
      ),

      error && React.createElement("div", { className: "req-error" }, error),

      // Footer (Save only, no "Save Draft")
      React.createElement(
        "div",
        { className: "req-footer" },
        React.createElement(
          "div",
          { className: "req-left" },
          lastSaved &&
            React.createElement("div", { className: "req-saved" }, "Last saved: ", lastSaved.toLocaleString())
        ),
        React.createElement(
          "div",
          { className: "req-right" },
          React.createElement("button", { className: "btn ghost", onClick: onCancel }, "Cancel"),
          
          React.createElement(
            "button",
            {
              className: "btn primary",
              onClick: saveReady,
              disabled: saving,
            },
            saving ? "Saving…" : "Save & Mark Ready"
          )
        )
      )
    )
  );
}
