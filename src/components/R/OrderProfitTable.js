import React, {useMemo,useState} from "react";

import "./orderProfitTable.css";

const formatCurrency = v =>
Number(v||0).toLocaleString("en-IN");

export default function OrderProfitTable({data=[]}){

const [sort,setSort] = useState("profit");

/* sorting */

const sortedData = useMemo(()=>{

const arr = [...data];

if(sort==="profit"){

arr.sort((a,b)=>b.profit-a.profit);

}

if(sort==="revenue"){

arr.sort((a,b)=>b.revenue-a.revenue);

}

if(sort==="staffCost"){

arr.sort((a,b)=>b.staffCost-a.staffCost);

}

return arr;

},[data,sort]);

return(

<div className="nor-block">

<div className="nor-table-header">

<h2>Order Profit Analysis</h2>

<select
className="nor-sort"
value={sort}
onChange={e=>setSort(e.target.value)}
>

<option value="profit">
Sort by Profit
</option>

<option value="revenue">
Sort by Revenue
</option>

<option value="staffCost">
Sort by Staff Cost
</option>

</select>

</div>

<table className="nor-table">

<thead>

<tr>

<th>Order</th>

<th>Customer</th>

<th>Revenue</th>

<th>Staff Cost</th>

<th>Profit</th>

<th>Margin</th>

</tr>

</thead>

<tbody>

{sortedData.map(o=>{

const margin =
o.revenue
?((o.profit/o.revenue)*100).toFixed(1)
:0;

return(

<tr
key={o.orderId}
className={
o.profit<0
?"nor-loss-row"
:""
}
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

<td
className={
o.profit>=0
?"nor-profit-positive"
:"nor-profit-negative"
}
>

₹ {formatCurrency(o.profit)}

</td>

<td>

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