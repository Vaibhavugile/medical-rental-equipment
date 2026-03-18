import React, { useState } from "react";
import "./reportModal.css";

export default function ReportModal({ type, data = {}, onClose }) {

const orders = data.orders || [];
const staff = data.staff || [];
const summary = data.summary || {};

const [search,setSearch] = useState("");
const [sortKey,setSortKey] = useState("");
const [sortDir,setSortDir] = useState("desc");

if (!type) return null;

/* =========================
UTIL
========================= */

const formatCurrency = v =>
Number(v || 0).toLocaleString("en-IN");

const handleSort = key => {
if(sortKey === key){
setSortDir(sortDir === "asc" ? "desc" : "asc");
}else{
setSortKey(key);
setSortDir("desc");
}
};

const applySort = (arr) => {
if(!sortKey) return arr;

return [...arr].sort((a,b)=>{
let A = a[sortKey] || 0;
let B = b[sortKey] || 0;

if(typeof A === "string") A = A.toLowerCase();
if(typeof B === "string") B = B.toLowerCase();

if(A > B) return sortDir === "asc" ? 1 : -1;
if(A < B) return sortDir === "asc" ? -1 : 1;
return 0;
});
};

/* =========================
FILTER
========================= */

const filterOrders = (list) => {
if(!search) return list;

return list.filter(o =>
(o.orderNo || "").toLowerCase().includes(search.toLowerCase()) ||
(o.customer || "").toLowerCase().includes(search.toLowerCase())
);
};

const filterStaff = (list) => {
if(!search) return list;

return list.filter(s =>
(s.staffName || "").toLowerCase().includes(search.toLowerCase())
);
};

/* =========================
CASH COLLECTED
========================= */

const renderRevenueCollected = () => {

let list = orders.filter(o => Number(o.collected) > 0);

list = filterOrders(list);
list = applySort(list);

return (
<>

<h2 className="report-modal-title">Cash Collected</h2>

<div className="report-modal-summary">
Total Cash: ₹ {formatCurrency(summary.revenueCollected)}
</div>

<input
className="report-modal-search"
placeholder="Search order / customer..."
value={search}
onChange={e=>setSearch(e.target.value)}
/>

<table className="report-modal-table">

<thead>
<tr>
<th onClick={()=>handleSort("orderNo")}>Order</th>
<th onClick={()=>handleSort("customer")}>Customer</th>
<th onClick={()=>handleSort("invoiceTotal")}>Invoice</th>
<th className="report-modal-money" onClick={()=>handleSort("collected")}>
Cash
</th>
<th className="report-modal-money">Refund Paid</th>
<th className="report-modal-money">Profit</th>
</tr>
</thead>

<tbody>

{list.map(o => (

<tr key={o.orderId}>

<td className="report-modal-order">{o.orderNo}</td>
<td>{o.customer}</td>

<td className="report-modal-money">
₹ {formatCurrency(o.invoiceTotal)}
</td>

<td className="report-modal-money collected">
₹ {formatCurrency(o.collected)}
</td>

<td className="report-modal-money red">
₹ {formatCurrency(o.refundPaid)}
</td>

<td className="report-modal-money">
₹ {formatCurrency(o.profit)}
</td>

</tr>

))}

</tbody>

</table>
</>
);

};

/* =========================
CUSTOMER PENDING
========================= */

const renderRevenuePending = () => {

let list = orders.filter(o => Number(o.pending) > 0);

list = filterOrders(list);
list = applySort(list);

return (
<>

<h2 className="report-modal-title">Customer Pending</h2>

<div className="report-modal-summary">
Total Pending: ₹ {formatCurrency(summary.revenuePending)}
</div>

<input
className="report-modal-search"
placeholder="Search order / customer..."
value={search}
onChange={e=>setSearch(e.target.value)}
/>

<table className="report-modal-table">

<thead>
<tr>
<th onClick={()=>handleSort("orderNo")}>Order</th>
<th onClick={()=>handleSort("customer")}>Customer</th>
<th>Invoice</th>
<th>Collected</th>
<th>Refund Pending</th>
<th>Pending</th>
</tr>
</thead>

<tbody>

{list.map(o => (

<tr key={o.orderId}>

<td className="report-modal-order">{o.orderNo}</td>
<td>{o.customer}</td>

<td>₹ {formatCurrency(o.invoiceTotal)}</td>

<td className="collected">
₹ {formatCurrency(o.collected)}
</td>

<td className="pending">
₹ {formatCurrency(o.refundPending)}
</td>

<td className="pending">
₹ {formatCurrency(o.pending)}
</td>

</tr>

))}

</tbody>

</table>
</>
);

};

/* =========================
REFUND PAID
========================= */

const renderRefundPaid = () => {

let list = orders.filter(o => Number(o.refundPaid) > 0);

list = filterOrders(list);

return (
<>

<h2 className="report-modal-title">Refund Paid</h2>

<div className="report-modal-summary">
Total Refund Paid: ₹ {formatCurrency(summary.refundPaid)}
</div>

<table className="report-modal-table">

<thead>
<tr>
<th>Order</th>
<th>Customer</th>
<th>Refund Paid</th>
</tr>
</thead>

<tbody>

{list.map(o => (

<tr key={o.orderId}>
<td>{o.orderNo}</td>
<td>{o.customer}</td>
<td className="report-modal-money red">
₹ {formatCurrency(o.refundPaid)}
</td>
</tr>
))}

</tbody>

</table>
</>
);

};

/* =========================
REFUND PENDING
========================= */

const renderRefundPending = () => {

let list = orders.filter(o => Number(o.refundPending) > 0);

list = filterOrders(list);

return (
<>

<h2 className="report-modal-title">Refund Pending</h2>

<div className="report-modal-summary">
Total Refund Pending: ₹ {formatCurrency(summary.refundPending)}
</div>

<table className="report-modal-table">

<thead>
<tr>
<th>Order</th>
<th>Customer</th>
<th>Refund Pending</th>
</tr>
</thead>

<tbody>

{list.map(o => (

<tr key={o.orderId}>
<td>{o.orderNo}</td>
<td>{o.customer}</td>
<td className="report-modal-money pending">
₹ {formatCurrency(o.refundPending)}
</td>
</tr>
))}

</tbody>

</table>
</>
);

};

/* =========================
SALARY
========================= */

const renderSalaryPaid = () => {

let list = staff.filter(s => Number(s.paid) > 0);

list = filterStaff(list);
list = applySort(list);

return (
<>

<h2 className="report-modal-title">Salary Paid</h2>

<div className="report-modal-summary">
Total Paid: ₹ {formatCurrency(summary.salaryPaid)}
</div>

<table className="report-modal-table">
<thead>
<tr>
<th>Staff</th>
<th>Orders</th>
<th>Paid</th>
</tr>
</thead>
<tbody>

{list.map(s => (

<tr key={s.staffId}>
<td>{s.staffName}</td>
<td>{s.orders}</td>
<td>₹ {formatCurrency(s.paid)}</td>
</tr>
))}

</tbody>
</table>
</>
);

};

const renderSalaryPending = () => {

let list = staff.filter(s => Number(s.pending) > 0);

list = filterStaff(list);
list = applySort(list);

return (
<>

<h2 className="report-modal-title">Salary Pending</h2>

<div className="report-modal-summary">
Total Pending: ₹ {formatCurrency(summary.salaryPending)}
</div>

<table className="report-modal-table">
<thead>
<tr>
<th>Staff</th>
<th>Orders</th>
<th>Pending</th>
</tr>
</thead>
<tbody>

{list.map(s => (

<tr key={s.staffId}>
<td>{s.staffName}</td>
<td>{s.orders}</td>
<td>₹ {formatCurrency(s.pending)}</td>
</tr>
))}

</tbody>
</table>
</>
);

};

/* =========================
SWITCH
========================= */

const renderContent = () => {

switch(type){

case "revenueCollected":
return renderRevenueCollected();

case "revenuePending":
return renderRevenuePending();

case "refundPaid":
return renderRefundPaid();

case "refundPending":
return renderRefundPending();

case "salaryPaid":
return renderSalaryPaid();

case "salaryPending":
return renderSalaryPending();

default:
return null;

}

};

return (

<div className="report-modal-overlay">
<div className="report-modal-container">

{renderContent()}

<button
className="report-modal-close"
onClick={onClose}

>

Close </button>

</div>
</div>

);

}
