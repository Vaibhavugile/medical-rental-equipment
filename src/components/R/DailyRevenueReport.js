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

useEffect(()=>{
if(start && end){
load();
}
},[start,end]);

/* =========================
LOAD
========================= */

const load = async()=>{

setLoading(true);

try{

const snap = await getDocs(collection(db,"nursingOrders"));

const orders =
snap.docs.map(d=>({
id:d.id,
...(d.data()||{})
}));

const map = {};

/* =========================
PROCESS
========================= */

orders.forEach(o=>{

/* PAYMENTS */

(o.payments || []).forEach(p=>{

const date =
p.date
? new Date(p.date)
: new Date(p.createdAt || o.createdAt);

if(!date) return;

const day = date.toISOString().slice(0,10);

if(day < start || day > end) return;

if(!map[day]){
map[day]={
date:day,
cash:0,
upi:0,
card:0,
bank:0,
other:0,
refund:0,
total:0,
orders:[]
};
}

const amount = Number(p.amount || 0);
const method = (p.method || "other").toLowerCase();

/* ✅ ONLY ADD (no subtraction) */
map[day][method] += amount;
map[day].total += amount;

map[day].orders.push({
orderId:o.id,
orderNo:o.orderNo,
customer:o.customerName,
type:"payment",
method,
amount
});

});

/* REFUNDS */

(o.refunds || []).forEach(r=>{

if(r.status !== "paid") return;

const date =
r.date
? new Date(r.date)
: new Date(r.createdAt || o.createdAt);

if(!date) return;

const day = date.toISOString().slice(0,10);

if(day < start || day > end) return;

if(!map[day]){
map[day]={
date:day,
cash:0,
upi:0,
card:0,
bank:0,
other:0,
refund:0,
total:0,
orders:[]
};
}

const amount = Number(r.amount || 0);
const method = (r.method || "other").toLowerCase();

/* ✅ DO NOT TOUCH METHOD COLUMNS */
map[day].refund += amount;

/* ✅ ONLY SUBTRACT FROM TOTAL */
map[day].total -= amount;

map[day].orders.push({
orderId:o.id,
orderNo:o.orderNo,
customer:o.customerName,
type:"refund",
method,
amount
});

});

});

/* =========================
FINAL
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
Daily Cash Flow
</h2>

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
<th style={{color:"#dc2626"}}>Refund</th>
<th>Total (Net)</th>
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

<td style={{color:"#dc2626"}}>
₹ {d.refund}
</td>

<td>
<strong style={{color:d.total>=0 ? "#16a34a" : "#dc2626"}}>
₹ {d.total}
</strong>
</td>

</tr>

))}

</tbody>

</table>


{selected && (

<div className="nor-modal">

<div className="nor-modal-card">

<h3>Transactions for {selected.date}</h3>

<table className="nor-table">

<thead>
<tr>
<th>Order</th>
<th>Customer</th>
<th>Type</th>
<th>Method</th>
<th>Amount</th>
</tr>
</thead>

<tbody>

{selected.orders.map((o,i)=>(

<tr key={i}>

<td>{o.orderNo}</td>
<td>{o.customer}</td>

<td style={{
color:o.type==="refund" ? "#dc2626" : "#16a34a",
fontWeight:600
}}>
{o.type}
</td>

<td>{o.method}</td>

<td style={{
color:o.type==="refund" ? "#dc2626" : "#16a34a"
}}>
₹ {o.amount}
</td>

</tr>

))}

</tbody>

</table>

<button
className="nor-btn"
onClick={()=>setSelected(null)}

>

Close </button>

</div>

</div>

)}

</div>

);

}
