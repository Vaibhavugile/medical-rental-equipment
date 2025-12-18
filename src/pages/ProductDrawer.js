import React from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

export default function ProductDrawer({
  selectedProduct,
  setSelectedProduct,

  // utils
  fmt,
  showToast,
  setError,

  // counts
  productAssetCounts,
  productAssetStatusCounts,

  // asset creation
  companyPrefix,
  setCompanyPrefix,
  batchOverride,
  setBatchOverride,
  shortCodeOverride,
  setShortCodeOverride,
  assetQty,
  setAssetQty,
  assetBranch,
  setAssetBranch,
  branches,
  assetMetaJSON,
  setAssetMetaJSON,
  onCreateAssets,
  previewNextAssetId,

  // assets list
  assetSearch,
  setAssetSearch,
  assetStatusFilter,
  setAssetStatusFilter,
  assetBranchFilter,
  setAssetBranchFilter,
  assetPageSize,
  setAssetPageSize,
  visibleAssets,
  refreshAssets,

  // actions
  listAssets,
  printAssets,
  doCheckout,
  doCheckin,
  doReserve,
  doRelease,
  doMove,
  openMaintenance,
  openAssetDetails,
}) {
  if (!selectedProduct) return null;

  return (
    <div
      className="cp-drawer"
      onClick={(e) =>
        e.target.classList.contains("cp-drawer") &&
        setSelectedProduct(null)
      }
    >
      <div className="cp-form details" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="cp-form-head">
          <h2>Product — {selectedProduct.name}</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="cp-btn"
              onClick={async () => {
                try {
                  const pid = selectedProduct.id;
                  await updateDoc(doc(db, "products", pid), {
                    assetCount: productAssetCounts[pid] ?? 0,
                    assetCounts: productAssetStatusCounts[pid] ?? null,
                    assetsLastUpdatedAt: serverTimestamp(),
                  });
                  showToast("Product counts synced", "success");
                } catch (e) {
                  setError(e.message || "Failed to sync product");
                }
              }}
            >
              Sync product
            </button>
            <button
              type="button"
              className="cp-icon"
              onClick={() => setSelectedProduct(null)}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Details */}
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
              <div className="value">
                {fmt.money(selectedProduct.defaultRate ?? 0)}
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <h3>Description</h3>
              <div className="details-notes">
                {selectedProduct.description || "—"}
              </div>
            </div>

            {/* Create Assets */}
            <div style={{ marginTop: 12 }}>
              <h3>Create Assets</h3>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginTop: 8,
                  flexWrap: "wrap",
                }}
              >
                <input
                  className="cp-input"
                  value={companyPrefix}
                  onChange={(e) => setCompanyPrefix(e.target.value)}
                  placeholder="Prefix"
                  style={{ width: 100 }}
                />
                <input
                  className="cp-input"
                  value={batchOverride}
                  onChange={(e) => setBatchOverride(e.target.value)}
                  placeholder="Batch"
                  style={{ width: 90 }}
                />
                <input
                  className="cp-input"
                  value={shortCodeOverride}
                  onChange={(e) => setShortCodeOverride(e.target.value)}
                  placeholder="Short code"
                  style={{ width: 120 }}
                />
                <input
                  className="cp-input"
                  type="number"
                  min="1"
                  value={assetQty}
                  onChange={(e) =>
                    setAssetQty(Number(e.target.value || 0))
                  }
                  style={{ width: 90 }}
                />
                <select
                  className="cp-input"
                  value={assetBranch}
                  onChange={(e) => setAssetBranch(e.target.value)}
                >
                  <option value="">Default branch</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <input
                  className="cp-input"
                  value={assetMetaJSON}
                  onChange={(e) => setAssetMetaJSON(e.target.value)}
                  placeholder='{"model":"X"}'
                  style={{ minWidth: 240 }}
                />
                <button className="cp-btn" onClick={onCreateAssets}>
                  Create
                </button>
              </div>

              <div className="muted" style={{ marginTop: 6 }}>
                Preview next asset id:{" "}
                <strong>{previewNextAssetId}</strong>
              </div>

              <button
                className="cp-btn"
                style={{ marginTop: 8 }}
                onClick={async () => {
                  try {
                    const all = await listAssets({
                      productId: selectedProduct.id,
                    });
                    if (!all.length) {
                      showToast("No assets found", "error");
                      return;
                    }
                    all.forEach(
                      (a) => (a.productName = selectedProduct.name)
                    );
                    printAssets(all);
                  } catch (e) {
                    setError(e.message || "Failed to load assets");
                  }
                }}
              >
                Print QR — All assets
              </button>
            </div>
          </div>

          {/* Meta */}
          <div className="details-meta">
            <div className="meta-row">
              <div className="label muted">Category</div>
              <div className="value">
                {selectedProduct.category || "—"}
              </div>
            </div>
            <div className="meta-row">
              <div className="label muted">Assets</div>
              <div className="value">
                {productAssetCounts[selectedProduct.id] ?? 0}
              </div>
            </div>
          </div>
        </div>

        <hr className="hr" />

        {/* Assets */}
        <h3>Assets</h3>
        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 8,
            flexWrap: "wrap",
          }}
        >
          <input
            className="cp-input"
            placeholder="Search assets…"
            value={assetSearch}
            onChange={(e) => setAssetSearch(e.target.value)}
          />
          <select
            className="cp-input"
            value={assetStatusFilter}
            onChange={(e) => setAssetStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="in_stock">In stock</option>
            <option value="out_for_rental">Out</option>
            <option value="maintenance">Maintenance</option>
            <option value="reserved">Reserved</option>
          </select>
          <button className="cp-btn" onClick={refreshAssets}>
            Refresh
          </button>
        </div>

        <div className="assets-grid" style={{ marginTop: 12 }}>
          {visibleAssets.map((a) => (
            <div key={a.id} className="asset-card">
              <div className="asset-top">
                <strong>{a.assetId}</strong>
                <span className={`status ${a.status}`}>{a.status}</span>
              </div>

              <div className="asset-actions">
                <button
                  className="btn ghost"
                  onClick={() => openAssetDetails(a)}
                >
                  Details
                </button>
                {a.status === "out_for_rental" ? (
                  <button
                    className="btn"
                    onClick={() => doCheckin(a.id)}
                  >
                    Checkin
                  </button>
                ) : (
                  <button
                    className="btn"
                    onClick={() => doCheckout(a.id)}
                  >
                    Checkout
                  </button>
                )}
                <button
                  className="btn ghost"
                  onClick={() => openMaintenance(a)}
                >
                  Maintenance
                </button>
                <button
                  className="btn ghost"
                  onClick={() =>
                    printAssets([
                      {
                        ...a,
                        productName: selectedProduct.name,
                      },
                    ])
                  }
                >
                  Print
                </button>
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
  );
}
