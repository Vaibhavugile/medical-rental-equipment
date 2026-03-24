import React, { useEffect, useState } from "react";
import {
collection,
doc,
onSnapshot,
orderBy,
query,
deleteDoc,
setDoc
} from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import "./NursingOrders.css";

const fmtCurrency = (v) =>
Number(v || 0).toLocaleString(undefined, {
minimumFractionDigits: 2,
maximumFractionDigits: 2
});

export default function NursingOrdersRecycleBin() {

const navigate = useNavigate();

const [orders,setOrders] = useState([]);
const [error,setError] = useState("");
const [search,setSearch] = useState("");
const [statusFilter,setStatusFilter] = useState("all");
const [serviceFilter,setServiceFilter] = useState("all");
function getServiceType(order){

const name = order.items?.[0]?.name?.toLowerCase() || "";

if(name.includes("caretaker")) return "caretaker";
if(name.includes("nurs")) return "nursing";

return order.serviceType || "other";

}

/* ---------------------------
LOAD DELETED ORDERS
---------------------------- */

useEffect(()=>{


const q = query(
  collection(db,"nursingOrders_recycle_bin"),
  orderBy("deletedAt","desc")
);

const unsub = onSnapshot(q,(snap)=>{

  const docs = snap.docs.map(d=>({
    id:d.id,
    ...(d.data() || {})
  }));

  setOrders(docs);

});

return ()=>unsub();


},[]);

/* ---------------------------
RESTORE ORDER
---------------------------- */
const filteredOrders = orders.filter(o=>{

const q = search.toLowerCase();

const matchesSearch =
!q ||
o.orderNo?.toLowerCase().includes(q) ||
o.customerName?.toLowerCase().includes(q);

const matchesStatus =
statusFilter === "all" ||
o.status === statusFilter;

const serviceType = getServiceType(o);

const matchesService =
serviceFilter === "all" ||
serviceType === serviceFilter;

return matchesSearch && matchesStatus && matchesService;

});
const restoreOrder = async(order)=>{


const ok = window.confirm(
  `Restore order ${order.orderNo || order.id}?`
);

if(!ok) return;

try{

  const { deletedAt, originalId, ...clean } = order;

  const orderId = originalId || order.id;

  await setDoc(
    doc(db,"nursingOrders",orderId),
    clean
  );

  await deleteDoc(
    doc(db,"nursingOrders_recycle_bin",order.id)
  );

}catch(err){

  console.error(err);
  setError("Failed to restore order");

}


};

/* ---------------------------
DELETE FOREVER
---------------------------- */

const deleteForever = async(order)=>{


const ok = window.confirm(
  `Delete permanently ${order.orderNo || order.id}?`
);

if(!ok) return;

try{

  await deleteDoc(
    doc(db,"nursingOrders_recycle_bin",order.id)
  );

}catch(err){

  console.error(err);
  setError("Failed to delete order");

}


};

return(


<div className="no-wrap">

  <div className="no-head-top">
    <h2>Nursing Orders Recycle Bin</h2>

    <button
      className="cp-btn"
      onClick={()=>navigate("/crm/nursing-orders")}
    >
      ← Back
    </button>
  </div>
  <div className="no-filters">

<input
type="text"
className="no-input no-search"
placeholder="Search order or customer..."
value={search}
onChange={(e)=>setSearch(e.target.value)}
/>

<select
className="no-input no-compact"
value={statusFilter}
onChange={(e)=>setStatusFilter(e.target.value)}
>
<option value="all">All Status</option>
<option value="created">Created</option>
<option value="assigned">Assigned</option>
<option value="active">Active</option>
<option value="completed">Completed</option>
</select>

<select
className="no-input no-compact"
value={serviceFilter}
onChange={(e)=>setServiceFilter(e.target.value)}
>
<option value="all">All Services</option>
<option value="nursing">Nursing</option>
<option value="caretaker">Caretaker</option>
</select>

<button
className="cp-btn ghost"
onClick={()=>{
setSearch("");
setStatusFilter("all");
setServiceFilter("all");
}}
>
Clear
</button>

</div>

  {error && (
    <div className="orders-error">{error}</div>
  )}

  <div className="no-table-card">

    <table className="no-table">

      <thead>
        <tr>
          <th>Order No</th>
          <th>Customer</th>
          <th>Service</th>
          <th>Status</th>
          <th>Total</th>
          <th>Deleted</th>
          <th>Actions</th>
        </tr>
      </thead>

      <tbody>

        {filteredOrders.map(o=>{

          return(

            <tr key={o.id}>

              <td>{o.orderNo || o.id}</td>

              <td>{o.customerName || "—"}</td>
              <td>
<span className="pill blue">
{getServiceType(o)}
</span>
</td>

              <td>{o.status || "—"}</td>

              <td>
                ₹ {fmtCurrency(o.totals?.total || 0)}
              </td>

              <td>
                {o.deletedAt?.seconds
                  ? new Date(o.deletedAt.seconds*1000).toLocaleString()
                  : "—"}
              </td>

              <td className="actions">

                <button
                  className="link"
                  onClick={()=>restoreOrder(o)}
                >
                  Restore
                </button>

                <button
                  className="link danger"
                  onClick={()=>deleteForever(o)}
                >
                  Delete Forever
                </button>
                <button
  className="link"
  onClick={() =>
    navigate(`/crm/nursing-orders/${o.id}?deleted=true`)
  }
>
View
</button>


              </td>

            </tr>

          );

        })}

        {filteredOrders.length === 0 && (
          <tr>
            <td colSpan="6" className="no-muted">
              No deleted nursing orders
            </td>
          </tr>
        )}

      </tbody>

    </table>

  </div>

</div>


);

}
