import React from "react";
import "./lossOrdersTable.css";

const formatCurrency = v =>
Number(v||0).toLocaleString("en-IN");

export default function LossOrdersTable({data=[]}){

if(!data.length){

return(

<div className="nor-block">

<h2 className="nor-section-title">
Loss Making Orders
</h2>

<div className="nor-loss-empty">

🎉 No loss-making orders found

</div>

</div>

)

}

return(

<div className="nor-block">

<h2 className="nor-section-title">
Loss Making Orders
</h2>

<table className="nor-table">

<thead>

<tr>

<th>Order</th>
<th>Customer</th>
<th>Revenue</th>
<th>Staff Cost</th>
<th>Loss</th>
<th>Margin</th>

</tr>

</thead>

<tbody>

{data.map(o=>{

const loss = Math.abs(o.profit);

const margin =
o.revenue
?((o.profit/o.revenue)*100).toFixed(1)
:0;

return(

<tr
key={o.orderId}
className="nor-loss-row"
>

<td className="nor-order">
{o.orderNo}
</td>

<td>
{o.customer}
</td>

<td>
₹ {formatCurrency(o.revenue)}
</td>

<td>
₹ {formatCurrency(o.staffCost)}
</td>

<td className="nor-loss-amount">

- ₹ {formatCurrency(loss)}

</td>

<td className="nor-loss-margin">

{margin} %

</td>

</tr>

)

})}

</tbody>

</table>

</div>

)

}