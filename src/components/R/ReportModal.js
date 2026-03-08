import React, { useState, useMemo } from "react";
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
SEARCH FILTER
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
REVENUE COLLECTED
========================= */

const renderRevenueCollected = () => {

let collected = orders.filter(o => Number(o.collected) > 0);

collected = filterOrders(collected);
collected = applySort(collected);

return (
<>
<h2 className="report-modal-title">Revenue Collected</h2>

<div className="report-modal-summary">
Total Collected: ₹ {formatCurrency(summary.revenueCollected)}
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

<th className="report-modal-money"
onClick={()=>handleSort("collected")}
>
Collected
</th>

<th className="report-modal-money"
onClick={()=>handleSort("staffCost")}
>
Staff Cost
</th>

<th className="report-modal-money"
onClick={()=>handleSort("profit")}
>
Profit
</th>

</tr>
</thead>

<tbody>

{collected.map(o => (

<tr key={o.orderId}>

<td className="report-modal-order">{o.orderNo}</td>

<td>{o.customer}</td>

<td className="report-modal-money collected">
₹ {formatCurrency(o.collected)}
</td>

<td className="report-modal-money">
₹ {formatCurrency(o.staffCost)}
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
REVENUE PENDING
========================= */

const renderRevenuePending = () => {

let pending = orders.filter(o => Number(o.pending) > 0);

pending = filterOrders(pending);
pending = applySort(pending);

return (
<>
<h2 className="report-modal-title">Revenue Pending</h2>

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

<th className="report-modal-money"
onClick={()=>handleSort("invoiceTotal")}
>
Invoice
</th>

<th className="report-modal-money"
onClick={()=>handleSort("collected")}
>
Collected
</th>

<th className="report-modal-money"
onClick={()=>handleSort("pending")}
>
Pending
</th>

</tr>
</thead>

<tbody>

{pending.map(o => (

<tr key={o.orderId}>

<td className="report-modal-order">{o.orderNo}</td>

<td>{o.customer}</td>

<td className="report-modal-money">
₹ {formatCurrency(o.invoiceTotal)}
</td>

<td className="report-modal-money collected">
₹ {formatCurrency(o.collected)}
</td>

<td className="report-modal-money pending">
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
SALARY PAID
========================= */

const renderSalaryPaid = () => {

let paid = staff.filter(s => Number(s.paid) > 0);

paid = filterStaff(paid);
paid = applySort(paid);

return (
<>
<h2 className="report-modal-title">Salary Paid</h2>

<div className="report-modal-summary">
Total Paid: ₹ {formatCurrency(summary.salaryPaid)}
</div>

<input
className="report-modal-search"
placeholder="Search staff..."
value={search}
onChange={e=>setSearch(e.target.value)}
/>

<table className="report-modal-table">

<thead>
<tr>

<th onClick={()=>handleSort("staffName")}>Staff</th>

<th onClick={()=>handleSort("orders")}>Orders</th>

<th className="report-modal-money"
onClick={()=>handleSort("paid")}
>
Paid
</th>

</tr>
</thead>

<tbody>

{paid.map(s => (

<tr key={s.staffId}>

<td>{s.staffName}</td>

<td>{s.orders}</td>

<td className="report-modal-money">
₹ {formatCurrency(s.paid)}
</td>

</tr>

))}

</tbody>

</table>
</>
);

};



/* =========================
SALARY PENDING
========================= */

const renderSalaryPending = () => {

let pending = staff.filter(s => Number(s.pending) > 0);

pending = filterStaff(pending);
pending = applySort(pending);

return (
<>
<h2 className="report-modal-title">Salary Pending</h2>

<div className="report-modal-summary">
Total Pending: ₹ {formatCurrency(summary.salaryPending)}
</div>

<input
className="report-modal-search"
placeholder="Search staff..."
value={search}
onChange={e=>setSearch(e.target.value)}
/>

<table className="report-modal-table">

<thead>
<tr>

<th onClick={()=>handleSort("staffName")}>Staff</th>

<th onClick={()=>handleSort("orders")}>Orders</th>

<th className="report-modal-money"
onClick={()=>handleSort("pending")}
>
Pending
</th>

</tr>
</thead>

<tbody>

{pending.map(s => (

<tr key={s.staffId}>

<td>{s.staffName}</td>

<td>{s.orders}</td>

<td className="report-modal-money pending">
₹ {formatCurrency(s.pending)}
</td>

</tr>

))}

</tbody>

</table>
</>
);

};



/* =========================
CONTENT SWITCH
========================= */

const renderContent = () => {

switch(type){

case "revenueCollected":
return renderRevenueCollected();

case "revenuePending":
return renderRevenuePending();

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
Close
</button>

</div>

</div>

);

}