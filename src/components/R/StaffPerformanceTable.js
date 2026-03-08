import React,{useState,useMemo} from "react";

import "./staffPerformanceTable.css";

const formatCurrency = v =>
Number(v||0).toLocaleString("en-IN");

export default function StaffPerformanceTable({data=[]}){

const [sort,setSort] = useState("earned");

const sorted = useMemo(()=>{

const arr = [...data];

if(sort==="earned"){

arr.sort((a,b)=>b.earned-a.earned);

}

if(sort==="orders"){

arr.sort((a,b)=>b.orders-a.orders);

}

if(sort==="pending"){

arr.sort((a,b)=>b.pending-a.pending);

}

return arr;

},[data,sort]);

return(

<div className="nor-block">

<div className="nor-table-header">

<h2>Staff Performance</h2>

<select
className="nor-sort"
value={sort}
onChange={e=>setSort(e.target.value)}
>

<option value="earned">
Sort by Earnings
</option>

<option value="orders">
Sort by Orders
</option>

<option value="pending">
Sort by Pending Salary
</option>

</select>

</div>

<table className="nor-table">

<thead>

<tr>

<th>Staff</th>

<th>Type</th>

<th>Orders</th>

<th>Total Earned</th>

<th>Paid</th>

<th>Pending</th>

<th>Payment Status</th>

</tr>

</thead>

<tbody>

{sorted.map(s=>{

const paymentStatus =
s.pending>0
?"Pending"
:"Cleared";

return(

<tr key={s.staffId}>

<td className="nor-staff-name">
{s.staffName}
</td>

<td className="nor-staff-type">
{s.staffType}
</td>

<td>
{s.orders}
</td>

<td>
₹ {formatCurrency(s.earned)}
</td>

<td className="nor-paid">
₹ {formatCurrency(s.paid)}
</td>

<td className="nor-pending">
₹ {formatCurrency(s.pending)}
</td>

<td>

<span className={
paymentStatus==="Cleared"
?"nor-badge-green"
:"nor-badge-orange"
}>

{paymentStatus}

</span>

</td>

</tr>

)

})}

</tbody>

</table>

</div>

)

}