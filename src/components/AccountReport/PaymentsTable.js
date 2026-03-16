import React from "react";
import "./tables.css";

export default function PaymentsTable({ report }) {

const payments = report?.payments || [];

return (

<div className="table-card">

<h3 className="table-title">Payments</h3>

<table className="data-table">

<thead>

<tr>
<th>Date</th>
<th>Order No</th>
<th>Service</th>
<th>Method</th>
<th>Amount</th>
<th>Balance After</th>
<th>Order Total</th>
</tr>

</thead>

<tbody>

{payments.length === 0 && (
<tr>
<td colSpan="7" className="empty">
No payments
</td>
</tr>
)}

{payments.map((p, i) => (

<tr key={i}>

<td>{new Date(p.date).toLocaleDateString()}</td>

<td>{p.orderNo}</td>

<td>{p.serviceType}</td>

<td>{p.method}</td>

<td className="strong">
₹{p.amount}
</td>

<td>₹{p.balanceAfter}</td>

<td>₹{p.orderTotal}</td>

</tr>

))}

</tbody>

</table>

</div>

);

}