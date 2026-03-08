import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase";


export default function DailySalaryReport(){

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


const load = async()=>{

setLoading(true);

try{

const snap =
await getDocs(collection(db,"staffAssignments"));

const assignments =
snap.docs.map(d=>({
id:d.id,
...(d.data()||{})
}));

const map = {};

assignments.forEach(a=>{

(a.payments || []).forEach(p=>{

const date =
new Date(p.date);

const day =
date.toISOString().slice(0,10);

if(day < start || day > end) return;

if(!map[day]){

map[day]={
date:day,
total:0,
staff:[],
count:0
};

}

const amount =
Number(p.amount || 0);

map[day].total += amount;

map[day].staff.push({

staffName:a.staffName,
service:a.serviceName,
amount,
orderNo:a.orderNo

});

});

});

const result =
Object.values(map)
.sort((a,b)=>a.date.localeCompare(b.date));

result.forEach(d=>{
d.count = d.staff.length;
});

setData(result);

}catch(err){

console.error(err);

}

setLoading(false);

};


return(

<div className="nor-block">

<h2 className="nor-section-title">
Daily Salary Payments
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
<th>Staff Paid</th>
<th>Total Salary Paid</th>

</tr>

</thead>

<tbody>

{data.map(d=>(

<tr
key={d.date}
className="nor-clickable"
onClick={()=>setSelected(d)}
>

<td>{d.date}</td>

<td>{d.count}</td>

<td><strong>₹ {d.total}</strong></td>

</tr>

))}

</tbody>

</table>


{selected && (

<div className="nor-modal">

<div className="nor-modal-card">

<h3>
Salary Payments for {selected.date}
</h3>

<table className="nor-table">

<thead>

<tr>

<th>Staff</th>
<th>Service</th>
<th>Order</th>
<th>Amount</th>

</tr>

</thead>

<tbody>

{selected.staff.map((s,i)=>(

<tr key={i}>

<td>{s.staffName}</td>
<td>{s.service}</td>
<td>{s.orderNo}</td>
<td>₹ {s.amount}</td>

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