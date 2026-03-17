import React, { useMemo, useState } from "react";
import "../pages/OrderCreate.css";

export default function AssetPickerModal({
  open,
  onClose,
  assets = [],
  selected = {},
  setSelected,
  onConfirm,
  loading,
  branches = [],
  itemIndex,
  productName,
}) {
  const [companyFilter, setCompanyFilter] = useState("");

  const fmtDate = (d) => {
    if (!d) return "";
    try {
      return new Date(d).toLocaleDateString();
    } catch {
      return d;
    }
  };

  const companies = useMemo(() => {
    const set = new Set();
    assets.forEach((a) => a.company && set.add(a.company));
    return Array.from(set).sort();
  }, [assets]);

  const visibleAssets = useMemo(() => {
    if (!companyFilter) return assets;
    return assets.filter((a) => a.company === companyFilter);
  }, [assets, companyFilter]);

  const grouped = useMemo(() => {
    const g = {};
    visibleAssets.forEach((a) => {
      const key = a.company || "Unknown company";
      if (!g[key]) g[key] = [];
      g[key].push(a);
    });
    return g;
  }, [visibleAssets]);

  const toggle = (id) => {
    setSelected((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  if (!open) return null;

  return (
    <div className="cp-modal" onClick={onClose}>
      <div className="cp-modal-card" onClick={(e) => e.stopPropagation()}>
        
        {/* ✅ FIX NaN */}
        <h4>
          Select assets{" "}
          {typeof itemIndex === "number" ? `for item #${itemIndex + 1}` : ""}
        </h4>

        {loading && <div className="muted">Loading…</div>}

        {!loading && (
          <>
            {/* Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 6,
              }}
            >
              <div className="muted">
                In stock: {assets.length}
              </div>
              <div className="muted">
                Product: {productName || "—"}
              </div>
            </div>

            {/* Company filter */}
            <select
              className="cp-input"
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              style={{ marginTop: 8 }}
            >
              <option value="">All companies</option>
              {companies.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </>
        )}

        {/* Asset list */}
        <div
          style={{
            maxHeight: 320,
            overflowY: "auto",
            marginTop: 10,
            paddingRight: 4,
          }}
        >
          {Object.keys(grouped).length === 0 && !loading && (
            <div className="muted">No assets available</div>
          )}

          {Object.entries(grouped).map(([company, list]) => {
            const allSelected = list.every((a) => selected[a.id]);

            return (
              <div key={company} style={{ marginBottom: 12 }}>
                
                {/* Company header */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 6,
                  }}
                >
                  <div style={{ fontWeight: 700 }}>
                    🏢 {company}
                  </div>

                  <button
                    className="cp-link"
                    style={{ fontSize: 12 }}
                    onClick={() => {
                      setSelected((prev) => {
                        const next = { ...prev };
                        list.forEach((a) => {
                          if (allSelected) delete next[a.id];
                          else next[a.id] = true;
                        });
                        return next;
                      });
                    }}
                  >
                    {allSelected ? "Unselect all" : "Select all"}
                  </button>
                </div>

                {/* Assets */}
                {list.map((a) => (
                  <label
                    key={a.id}
                    style={{
                      display: "flex",
                      gap: 10,
                      padding: 10,
                      borderBottom: "1px solid #eef2f7",
                      cursor: "pointer",
                      alignItems: "center",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!!selected[a.id]}
                      onChange={() => toggle(a.id)}
                      style={{ cursor: "pointer" }}
                    />

                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>
                        {a.assetId || a.id}
                      </div>

                      <div className="muted" style={{ fontSize: 12 }}>
                        {a.metadata?.model || a.productId} ·{" "}
                        {(branches.find((b) => b.id === a.branchId) || {})
                          .name || a.branchId}
                      </div>

                      {/* Reservation badge */}
                      {a.status === "reserved" &&
                        a.reservation?.from &&
                        a.reservation?.to && (
                          <div
                            style={{
                              marginTop: 4,
                              fontSize: 12,
                              color: "#92400e",
                              background: "#fff7ed",
                              padding: "2px 6px",
                              borderRadius: 6,
                              display: "inline-block",
                            }}
                          >
                            Reserved: {fmtDate(a.reservation.from)} →{" "}
                            {fmtDate(a.reservation.to)}
                          </div>
                        )}
                    </div>

                    <div
                      style={{
                        fontSize: 12,
                        color: "#6b7280",
                        textTransform: "capitalize",
                      }}
                    >
                      {a.status}
                    </div>
                  </label>
                ))}
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            marginTop: 12,
          }}
        >
          <button className="cp-btn ghost" onClick={onClose}>
            Cancel
          </button>

          <button className="cp-btn" onClick={onConfirm}>
            Assign selected
          </button>
        </div>
      </div>
    </div>
  );
}