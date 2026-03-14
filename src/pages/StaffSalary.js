import React, { useEffect, useState } from "react";
import {
collection,
addDoc,
getDocs,
updateDoc,
deleteDoc,
doc,
serverTimestamp
} from "firebase/firestore";
import { db } from "../firebase";
import "./StaffSalary.css";

export default function StaffSalary(){

const [rates,setRates] = useState([]);
const [careTypes,setCareTypes] = useState([]);

const [loading,setLoading] = useState(true);

const [formOpen,setFormOpen] = useState(false);
const [careTypeFormOpen,setCareTypeFormOpen] = useState(false);

const [editingRate,setEditingRate] = useState(null);

const [newCareType,setNewCareType] = useState("");

const [search,setSearch] = useState("");

const [filters,setFilters] = useState({
role:"all",
careType:"all",
shift:"all",
sort:"newest"
});

const [form,setForm] = useState({
role:"nurse",
careType:"",
shift:"day",
rateType:"daily",
rate:""
});


/* =============================
LOAD CARE TYPES
============================= */

const loadCareTypes = async()=>{

const snap = await getDocs(collection(db,"careTypes"));

const list = snap.docs.map(d=>({
id:d.id,
...(d.data()||{})
}));

setCareTypes(list);

if(list.length && !form.careType){
setForm(p=>({...p,careType:list[0].name}));
}

};


/* =============================
LOAD RATES
============================= */

const loadRates = async()=>{

setLoading(true);

const snap = await getDocs(collection(db,"staffRates"));

const list = snap.docs.map(d=>({
id:d.id,
...(d.data()||{})
}));

setRates(list);

setLoading(false);

};


useEffect(()=>{
loadRates();
loadCareTypes();
},[]);



/* =============================
ADD CARE TYPE
============================= */

const addCareType = async()=>{

if(!newCareType) return;

const name = newCareType.toLowerCase().trim();

const exists = careTypes.find(c=>c.name===name);

if(exists){
alert("Care type already exists");
return;
}

await addDoc(collection(db,"careTypes"),{
name,
createdAt:serverTimestamp()
});

setNewCareType("");
setCareTypeFormOpen(false);

loadCareTypes();

};



/* =============================
SAVE RATE (ADD OR EDIT)
============================= */

const saveRate = async()=>{

if(!form.rate){
alert("Enter rate");
return;
}

if(editingRate){

await updateDoc(doc(db,"staffRates",editingRate),{
...form,
rate:Number(form.rate)
});

}else{

const exists = rates.find(r=>
r.role===form.role &&
r.careType===form.careType &&
r.shift===form.shift
);

if(exists){
alert("Rate already exists");
return;
}

await addDoc(collection(db,"staffRates"),{
...form,
rate:Number(form.rate),
createdAt:serverTimestamp()
});

}

setEditingRate(null);

setForm({
role:"nurse",
careType:careTypes?.[0]?.name || "",
shift:"day",
rateType:"daily",
rate:""
});

setFormOpen(false);

loadRates();

};



/* =============================
EDIT RATE
============================= */

const openEditRate = (rate)=>{

setEditingRate(rate.id);

setForm({
role:rate.role,
careType:rate.careType,
shift:rate.shift,
rateType:rate.rateType,
rate:rate.rate
});

setFormOpen(true);

};



/* =============================
DELETE RATE
============================= */

const deleteRate = async(id)=>{

const confirmDelete = window.confirm("Delete this rate?");

if(!confirmDelete) return;

await deleteDoc(doc(db,"staffRates",id));

loadRates();

};



/* =============================
FILTER + SEARCH
============================= */

let filteredRates = rates.filter(r=>{

if(filters.role!=="all" && r.role!==filters.role) return false;

if(filters.careType!=="all" && r.careType!==filters.careType) return false;

if(filters.shift!=="all" && r.shift!==filters.shift) return false;

if(search){

const s = search.toLowerCase();

if(
!r.role?.toLowerCase().includes(s) &&
!r.careType?.toLowerCase().includes(s) &&
!r.shift?.toLowerCase().includes(s)
) return false;

}

return true;

});


if(filters.sort==="highest") filteredRates.sort((a,b)=>b.rate-a.rate);
if(filters.sort==="lowest") filteredRates.sort((a,b)=>a.rate-b.rate);



/* =============================
UI
============================= */

return(

<div className="ss-wrap">

<div className="ss-header">

<h2>Staff Salary Rates</h2>

<div className="ss-actions">

<button
className="ss-btn ss-secondary"
onClick={()=>setCareTypeFormOpen(!careTypeFormOpen)}
>
+ Add Care Type
</button>

<button
className="ss-btn ss-primary"
onClick={()=>setFormOpen(true)}
>
+ Add Rate
</button>

</div>

</div>



{/* ADD CARE TYPE */}

{careTypeFormOpen && (

<div className="ss-care-add-bar">

<input
placeholder="New care type..."
value={newCareType}
onChange={(e)=>setNewCareType(e.target.value)}
/>

<button
className="ss-btn ss-primary"
onClick={addCareType}
>
Add
</button>

<button
className="ss-btn"
onClick={()=>setCareTypeFormOpen(false)}
>
Cancel
</button>

</div>

)}



{/* FILTERS ROW */}

<div className="ss-filters-row">

<input
placeholder="Search..."
value={search}
onChange={(e)=>setSearch(e.target.value)}
/>

<select
value={filters.role}
onChange={(e)=>setFilters(p=>({...p,role:e.target.value}))}
>
<option value="all">All Roles</option>
<option value="nurse">Nurse</option>
<option value="caretaker">Caretaker</option>
</select>

<select
value={filters.careType}
onChange={(e)=>setFilters(p=>({...p,careType:e.target.value}))}
>
<option value="all">All Care Types</option>

{careTypes.map(c=>(
<option key={c.id} value={c.name}>{c.name}</option>
))}

</select>

<select
value={filters.shift}
onChange={(e)=>setFilters(p=>({...p,shift:e.target.value}))}
>
<option value="all">All Shifts</option>
<option value="day">Day</option>
<option value="night">Night</option>
<option value="full">Full</option>
</select>

<select
value={filters.sort}
onChange={(e)=>setFilters(p=>({...p,sort:e.target.value}))}
>
<option value="newest">Newest</option>
<option value="highest">Highest Rate</option>
<option value="lowest">Lowest Rate</option>
</select>

</div>



{/* TABLE */}

<table className="ss-table">

<thead>

<tr>
<th>Role</th>
<th>Care Type</th>
<th>Shift</th>
<th>Rate</th>
<th>Actions</th>
</tr>

</thead>

<tbody>

{filteredRates.map(r=>(

<tr key={r.id}>

<td>{r.role}</td>

<td>{r.careType}</td>

<td>{r.shift}</td>

<td className="ss-rate">
₹ {r.rate} / {r.rateType}
</td>

<td className="ss-actions-cell">

<button
className="ss-btn ss-edit"
onClick={()=>openEditRate(r)}
>
Edit
</button>

<button
className="ss-btn ss-delete"
onClick={()=>deleteRate(r.id)}
>
Delete
</button>

</td>

</tr>

))}

</tbody>

</table>

{loading && <div className="ss-muted">Loading...</div>}



{/* ADD / EDIT MODAL */}

{formOpen && (

<div className="ss-modal">

<div className="ss-modal-card">

<h3>{editingRate ? "Edit Rate" : "Add Salary Rate"}</h3>

<label>Role</label>

<select
value={form.role}
onChange={(e)=>setForm(p=>({...p,role:e.target.value}))}
>
<option value="nurse">Nurse</option>
<option value="caretaker">Caretaker</option>
</select>

<label>Care Type</label>

<select
value={form.careType}
onChange={(e)=>setForm(p=>({...p,careType:e.target.value}))}
>
{careTypes.map(c=>(
<option key={c.id} value={c.name}>{c.name}</option>
))}
</select>

<label>Shift</label>

<select
value={form.shift}
onChange={(e)=>setForm(p=>({...p,shift:e.target.value}))}
>
<option value="day">Day</option>
<option value="night">Night</option>
<option value="full">Full</option>
</select>

<label>Rate</label>

<input
type="number"
value={form.rate}
onChange={(e)=>setForm(p=>({...p,rate:e.target.value}))}
/>

<div className="ss-actions">

<button
className="ss-btn"
onClick={()=>{
setFormOpen(false);
setEditingRate(null);
}}
>
Cancel
</button>

<button
className="ss-btn ss-primary"
onClick={saveRate}
>
Save
</button>

</div>

</div>

</div>

)}

</div>

);

}