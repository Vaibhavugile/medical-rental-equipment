import React from "react";
import "./KpiSection.css";

export default function KpiSection({ report }) {

const totalRevenue = report?.totalRevenue || 0;
const collected = report?.totalCollected || 0;
const pending = report?.pendingAmount || 0;
const orders = report?.ordersCreated ?? report?.totalOrders ?? 0;
const extensions = report?.totalExtensions || 0;
const extensionRevenue = report?.totalExtensionRevenue || 0;

const avgOrder = orders ? (totalRevenue / orders).toFixed(2) : 0;

const collectionRate = totalRevenue
? ((collected / totalRevenue) * 100).toFixed(1)
: 0;

const kpis = [
{
label: "Total Revenue",
value: `₹${totalRevenue.toLocaleString()}`,
color: "revenue"
},
{
label: "Collected",
value: `₹${collected.toLocaleString()}`,
color: "collected"
},
// {
// label: "Pending",
// value: `₹${pending.toLocaleString()}`,
// color: "pending"
// },
{
label: "Orders",
value: orders,
color: "orders"
},
{
label: "Extensions",
value: extensions,
color: "extensions"
},
{
label: "Extension Revenue",
value: `₹${extensionRevenue.toLocaleString()}`,
color: "extensionRevenue"
},
{
label: "Avg Order Value",
value: `₹${avgOrder}`,
color: "avg"
},
// {
// label: "Collection Rate",
// value: `${collectionRate}%`,
// color: "rate"
// }
];

return (

<div className="kpi-grid">

{kpis.map((kpi, i) => (

<div key={i} className={`kpi-card ${kpi.color}`}>

<div className="kpi-label">
{kpi.label}
</div>

<div className="kpi-value">
{kpi.value}
</div>

</div>

))}

</div>

);

}