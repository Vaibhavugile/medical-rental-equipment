// src/components/OrdersSidebar.jsx
import React from "react";
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
  const derivedOptions = [
    ["all", "All", derivedCounts.all],
    ["created", "Created", derivedCounts.created],
    ["assets_partial", "Assets Partial", derivedCounts.assets_partial],
    ["assets_assigned", "Assets Assigned", derivedCounts.assets_assigned],
    ["driver_assigned", "Driver Assigned", derivedCounts.driver_assigned],
    ["ready_to_dispatch", "Ready to Dispatch", derivedCounts.ready_to_dispatch],
    ["starts_today", "Starts Today", derivedCounts.starts_today],
    ["ending_today", "Ending Today", derivedCounts.ending_today],
    ["in_transit", "In Transit", derivedCounts.in_transit],
    ["delivered", "Delivered", derivedCounts.delivered],
    ["active", "Active", derivedCounts.active],
    ["completed", "Completed", derivedCounts.completed],
    ["cancelled", "Cancelled", derivedCounts.cancelled],
  ];

  const deliveryOptions = [
    ["all", "All", deliveryCounts.all],
    ["assigned", "Assigned", deliveryCounts.assigned],
    ["accepted", "Driver Accepted", deliveryCounts.accepted],
    ["picked_up", "Picked up", deliveryCounts.picked_up],
    ["in_transit", "In transit", deliveryCounts.in_transit],
    ["delivered", "Delivered", deliveryCounts.delivered],
    ["completed", "Completed", deliveryCounts.completed],
  ];

  return (
    <aside className="orders-sidebar">
      <div className="orders-sidebar-head">Filters</div>

      {/* Search */}
      <div className="orders-side-block">
        <div className="side-label">Search</div>
        <input
          className="cp-input side-search"
          placeholder="Order no / customer / address"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Derived Order Status */}
      <div className="orders-side-block">
        <div className="side-label">Order status</div>
        <ul className="side-chips">
          {derivedOptions.map(([val, label, count]) => (
            <li key={val}>
              <button
                className={`side-chip ${filterDerived === val ? "is-active" : ""} status-${val}`}
                onClick={() => setFilterDerived(val)}
                title={label}
              >
                <span className="chip-name">{label}</span>
                <span className="chip-count">{count ?? 0}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Delivery Status */}
      <div className="orders-side-block">
        <div className="side-label">Delivery</div>
        <ul className="side-chips">
          {deliveryOptions.map(([val, label, count]) => (
            <li key={val}>
              <button
                className={`side-chip ${filterDelivery === val ? "is-active" : ""}`}
                onClick={() => setFilterDelivery(val)}
                title={label}
              >
                <span className="chip-name">{label}</span>
                <span className="chip-count">{count ?? 0}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Quick reset */}
      <div className="orders-side-block">
        <button className="side-reset" onClick={onClearAll}>
          Clear all filters
        </button>
      </div>
    </aside>
  );
}
