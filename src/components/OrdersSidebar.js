import React, { useState } from "react";
import "./OrdersSidebar.css";

export default function OrdersSidebar({
  search,
  setSearch,
  filterDerived,
  setFilterDerived,
  filterDelivery,
  setFilterDelivery,
  derivedCounts = {},
  deliveryCounts = {},
  onClearAll,
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  /* ---------------- PRIMARY (HIGH USE) ---------------- */
  const primaryDerived = [
    ["all", "All Orders", derivedCounts.all],
    ["starts_today", "Starts Today", derivedCounts.starts_today],
    ["ending_today", "Ending Today", derivedCounts.ending_today],
    ["ending_soon", "Ending Soon (5 days)", derivedCounts.ending_soon],
    ["ready_to_dispatch", "Ready to Dispatch", derivedCounts.ready_to_dispatch],
    ["in_transit", "In Transit", derivedCounts.in_transit],
    ["on_rent", "On Rent", derivedCounts.on_rent],
  ];

  /* ---------------- ADVANCED (LESS USED) ---------------- */
  const advancedDerived = [
    ["completed", "Completed", derivedCounts.completed],
    ["cancelled", "Cancelled", derivedCounts.cancelled],
  ];

  const deliveryOptions = [
    ["assigned", "Assigned", deliveryCounts.assigned],
    ["accepted", "Accepted", deliveryCounts.accepted],
    ["picked_up", "Picked Up", deliveryCounts.picked_up],
    ["in_transit", "In Transit", deliveryCounts.in_transit],
    ["delivered", "Delivered", deliveryCounts.delivered],
    ["completed", "Completed", deliveryCounts.completed],
  ];

  return (
    <aside className="orders-sidebar">
      <div className="orders-sidebar-head">Filters</div>

      {/* SEARCH */}
      <div className="orders-side-block">
        <div className="side-label">Search</div>
        <input
          className="cp-input side-search"
          placeholder="Order / customer / address"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* PRIMARY FILTERS */}
      <div className="orders-side-block">
        <div className="side-label">Today & Action</div>
        <ul className="side-chips">
          {primaryDerived.map(([value, label, count]) => (
            <li key={value}>
              <button
                className={`side-chip ${
                  filterDerived === value ? "is-active" : ""
                }`}
                onClick={() => setFilterDerived(value)}
              >
                <span className="chip-name">{label}</span>
                <span className="chip-count">{count ?? 0}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* ADVANCED TOGGLE */}
      <div className="orders-side-block">
        <button
          className="side-toggle"
          onClick={() => setShowAdvanced((v) => !v)}
        >
          {showAdvanced ? "Hide advanced filters" : "More filters"}
        </button>
      </div>

      {/* ADVANCED FILTERS */}
      {showAdvanced && (
        <>
          <div className="orders-side-block">
            <div className="side-label">Order status</div>
            <ul className="side-chips">
              {advancedDerived.map(([value, label, count]) => (
                <li key={value}>
                  <button
                    className={`side-chip ${
                      filterDerived === value ? "is-active" : ""
                    }`}
                    onClick={() => setFilterDerived(value)}
                  >
                    <span className="chip-name">{label}</span>
                    <span className="chip-count">{count ?? 0}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="orders-side-block">
            <div className="side-label">Delivery</div>
            <ul className="side-chips">
              {deliveryOptions.map(([value, label, count]) => (
                <li key={value}>
                  <button
                    className={`side-chip ${
                      filterDelivery === value ? "is-active" : ""
                    }`}
                    onClick={() => setFilterDelivery(value)}
                  >
                    <span className="chip-name">{label}</span>
                    <span className="chip-count">{count ?? 0}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {/* CLEAR */}
      <div className="orders-side-block">
        <button className="side-reset" onClick={onClearAll}>
          Clear all filters
        </button>
      </div>
    </aside>
  );
}
