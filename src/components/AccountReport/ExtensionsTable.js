import React from "react";
import "./tables.css";

export default function ExtensionsTable({ report }) {

const extensions = report?.extensions || [];

return (

<div className="table-card">

<h3 className="table-title">Extensions</h3>

<table className="data-table">

<thead>

<tr>
<th>Order No</th>
<th>Service</th>
<th>Start</th>
<th>Old End</th>
<th>New End</th>
<th>Extra Amount</th>
<th>Date</th>
</tr>

</thead>

<tbody>

{extensions.length === 0 && (
<tr>
<td colSpan="7" className="empty">
No extensions
</td>
</tr>
)}

{extensions.map((ext, i) => (

<tr key={i}>

<td>{ext.orderNo}</td>

<td>{ext.serviceType}</td>

<td>{ext.startDate}</td>

<td>{ext.oldEndDate}</td>

<td>{ext.newEndDate}</td>

<td className="strong">
₹{ext.extraAmount}
</td>

<td>{new Date(ext.date).toLocaleDateString()}</td>

</tr>

))}

</tbody>

</table>

</div>

);

}