import React from "react";
import "./tables.css";

export default function OrdersTable({ report }) {

const orders = report?.orders || [];

return (

<div className="table-card">

<h3 className="table-title">Orders</h3>

<table className="data-table">

<thead>

<tr>
<th>Order No</th>
<th>Customer</th>
<th>Service</th>
<th>Start</th>
<th>End</th>
<th>Subtotal</th>
<th>Tax</th>
<th>Total</th>
</tr>

</thead>

<tbody>

{orders.length === 0 && (
<tr>
<td colSpan="8" className="empty">
No orders
</td>
</tr>
)}

{orders.map((order, i) => (

<tr key={i}>

<td>{order.orderNo}</td>

<td>{order.customer}</td>

<td>{order.serviceType}</td>

<td>{order.items?.[0]?.startDate}</td>

<td>{order.items?.[0]?.endDate}</td>

<td>₹{order.subtotal}</td>

<td>₹{order.tax}</td>

<td className="strong">
₹{order.total}
</td>

</tr>

))}

</tbody>

</table>

</div>

);

}