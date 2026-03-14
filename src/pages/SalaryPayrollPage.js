import React, { useEffect, useState } from "react";
import {
collection,
getDocs,
doc,
getDoc,
setDoc
} from "firebase/firestore";
import { db } from "../firebase";
import "./SalaryPayrollPage.css";

const WORKING_DAYS = 26;

export default function SalaryPayrollPage(){

const [people,setPeople] = useState([]);
const [attendanceTotals,setAttendanceTotals] = useState({});
const [payroll,setPayroll] = useState({});
const [month,setMonth] = useState(new Date().toISOString().slice(0,7));

useEffect(()=>{
loadPeople();
},[]);

useEffect(()=>{
if(people.length){
loadAttendanceTotals();
loadPayrollForMonth();
}
},[people,month]);

async function loadPeople(){

const snap = await getDocs(collection(db,"marketing"));

const rows = snap.docs.map(d=>({
id:d.id,
...(d.data()||{})
}));

setPeople(rows);

}

async function loadPayrollForMonth(){

const map = {};

for(const p of people){

const ref = doc(db,"payroll",month,"employees",p.id);

const snap = await getDoc(ref);

if(snap.exists()){
map[p.id] = snap.data();
}

}

setPayroll(map);

}

async function loadAttendanceTotals(){

const map = {};

for(const p of people){

const attendanceSnap = await getDocs(
collection(db,"marketing",p.id,"attendance")
);

let present = 0;
let half = 0;
let absent = 0;

const graceState = {};

attendanceSnap.forEach(docSnap=>{

const d = docSnap.data();

const date = d.date || docSnap.id;

if(!date || !date.startsWith(month)) return;

const checkIn = d.checkInServer?.toDate?.();
const checkOut = d.checkOutServer?.toDate?.();

if(!checkIn || !checkOut){
absent++;
return;
}

const minutes = (checkOut - checkIn) / 60000;

const type = getAttendanceType(
minutes,
p.id,
date,
graceState
);

if(type === "present") present++;
else if(type === "half") half++;
else absent++;

});

map[p.id] = {
present,
half,
absent
};

}

setAttendanceTotals(map);

}

async function markPaid(personId,amount){

const ref = doc(db,"payroll",month,"employees",personId);

await setDoc(ref,{
paid:true,
paidAmount:amount,
paidAt:new Date()
},{merge:true});

alert("Salary marked as paid");

loadPayrollForMonth();

}

return(

<div className="salary-page">

<h2>Salary Payroll</h2>

<div className="toolbar">
<input
type="month"
value={month}
onChange={(e)=>setMonth(e.target.value)}
/>
</div>

<table className="salary-table">

<thead>
<tr>
<th>Name</th>
<th>Present</th>
<th>Half</th>
<th>Absent</th>
<th>Monthly Salary</th>
<th>Calculated Salary</th>
<th>Paid</th>
<th>Pending</th>
<th>Action</th>
</tr>
</thead>

<tbody>

{people.map(p=>{

const totals = attendanceTotals[p.id] || {
present:0,
half:0,
absent:0
};

const monthly = p.salaryMonthly || 0;

const perDay = monthly / WORKING_DAYS;

const salary =
(totals.present * perDay) +
(totals.half * (perDay/2));

const paid = payroll[p.id]?.paidAmount || 0;

const pending = salary - paid;

return(

<tr key={p.id}>

<td>{p.name || "-"}</td>

<td>{totals.present}</td>

<td>{totals.half}</td>

<td>{totals.absent}</td>

<td>₹{monthly}</td>

<td>₹{Math.round(salary)}</td>

<td>₹{paid}</td>

<td>₹{Math.round(pending)}</td>

<td>

{pending > 0 ? (

<button
onClick={()=>markPaid(p.id,Math.round(salary))}

>

Mark Paid </button>

) : (

<span style={{color:"green"}}>Paid</span>

)}

</td>

</tr>

);

})}

</tbody>

</table>

</div>

);

}

function getAttendanceType(durationMinutes,personId,dayId,graceState){

const month = dayId.slice(0,7);

if(!graceState[personId]) graceState[personId] = {};
if(!graceState[personId][month]) graceState[personId][month] = 0;

if(durationMinutes >= 525){
return "present";
}

if(durationMinutes >= 480){

if(graceState[personId][month] < 2){
graceState[personId][month] += 1;
return "present";
}

return "half";

}

if(durationMinutes >= 240){
return "half";
}

return "absent";

}
