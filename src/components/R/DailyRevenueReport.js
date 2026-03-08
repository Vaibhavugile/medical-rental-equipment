import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase";
import "./dailyRevenueReport.css";

export default function DailyRevenueReport(){

const [start,setStart]=useState("");
const [end,setEnd]=useState("");

const [data,setData]=useState([]);
const [loading,setLoading]=useState(false);

const [selected,setSelected]=useState(null);

/* =========================
LOAD DATA WHEN DATE CHANGES
========================= */

useEffect(()=>{

if(start && end){
load();
}

},[start,end]);

/* =========================
LOAD ORDERS
========================= */

const load = async()=>{

setLoading(true);

try{

const snap =
await getDocs(collection(db,"nursingOrders"));

const orders =
snap.docs.map(d=>({
id:d.id,
...(d.data()||{})
}));

const map = {};

/* =========================
PROCESS PAYMENTS
========================= */

orders.forEach(o=>{

(o.payments || []).forEach(p=>{

const date =
p.date
? new Date(p.date)
: new Date(p.createdAt || o.createdAt);

if(!date) return;

const day =
date.toISOString().slice(0,10);

/* DATE FILTER */

if(day < start || day > end) return;

if(!map[day]){

map[day]={
date:day,
cash:0,
upi:0,
card:0,
bank:0,
other:0,
total:0,
orders:[]
};

}

const amount =
Number(p.amount || 0);

const method =
(p.method || "other").toLowerCase();

map[day][method] =
(map[day][method] || 0) + amount;

map[day].total += amount;

map[day].orders.push({

orderId:o.id,
orderNo:o.orderNo,
customer:o.customerName,
method,
amount

});

});

});

/* =========================
CONVERT TO ARRAY
========================= */

const result =
Object.values(map)
.sort((a,b)=>a.date.localeCompare(b.date));

setData(result);

}catch(err){

console.error(err);

}

setLoading(false);

};

/* =========================
UI
========================= */

return(

<div className="nor-block">

<h2 className="nor-section-title">
Daily Revenue Collection
</h2>

{/* DATE FILTER */}

<div className="nor-filter-row">

<input
type="date"
value={start}
onChange={e=>setStart(e.target.value)}
/>

<input
type="date"
value={end}
onChange={e=>setEnd(e.target.value)}
/>

</div>

{loading && <div>Loading...</div>}

<table className="nor-table">

<thead>

<tr>

<th>Date</th>
<th>Cash</th>
<th>UPI</th>
<th>Card</th>
<th>Bank</th>
<th>Total</th>

</tr>

</thead>

<tbody>

{data.map(d=>(

<tr
key={d.date}
onClick={()=>setSelected(d)}
className="nor-clickable"
>

<td>{d.date}</td>

<td>₹ {d.cash}</td>

<td>₹ {d.upi}</td>

<td>₹ {d.card}</td>

<td>₹ {d.bank}</td>

<td><strong>₹ {d.total}</strong></td>

</tr>

))}

</tbody>

</table>

{/* =========================
ORDER MODAL
========================= */}

{selected && (

<div className="nor-modal">

<div className="nor-modal-card">

<h3>
Orders for {selected.date}
</h3>

<table className="nor-table">

<thead>

<tr>

<th>Order</th>
<th>Customer</th>
<th>Method</th>
<th>Amount</th>

</tr>

</thead>

<tbody>

{selected.orders.map((o,i)=>(

<tr key={i}>

<td>{o.orderNo}</td>

<td>{o.customer}</td>

<td>{o.method}</td>

<td>₹ {o.amount}</td>

</tr>

))}

</tbody>

</table>

<button
className="nor-btn"
onClick={()=>setSelected(null)}
>
Close
</button>

</div>

</div>

)}

</div>

);

}