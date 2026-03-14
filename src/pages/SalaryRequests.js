import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import "./SalaryRequests.css";

const fmtCurrency = (v) =>
  Number(v || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

export default function SalaryRequests() {

  const [requests,setRequests] = useState([]);
  const [loading,setLoading] = useState(true);
  const [processing,setProcessing] = useState(null);

  const navigate = useNavigate();

  const [search,setSearch] = useState("");
  const [statusFilter,setStatusFilter] = useState("all");
  const [careFilter,setCareFilter] = useState("all");
  const [sortBy,setSortBy] = useState("newest");

  const [detailModal,setDetailModal] = useState({
    open:false,
    request:null
  });

  /* ==========================
     LOAD REQUESTS
  ========================== */

  const loadRequests = async () => {

    setLoading(true);

    try{

      const snap = await getDocs(collection(db,"salaryOverrideRequests"));

      const data = snap.docs.map(d=>({
        id:d.id,
        ...(d.data() || {})
      }));

      setRequests(data);

    }
    catch(err){

      console.error("Failed loading requests",err);

    }
    finally{

      setLoading(false);

    }

  };

  useEffect(()=>{
    loadRequests();
  },[]);

  /* ==========================
     FILTER + SORT
  ========================== */

  const filteredRequests = requests
  .filter(req=>{

    if(statusFilter !== "all" && req.status !== statusFilter){
      return false;
    }

    if(careFilter !== "all" && req.careType !== careFilter){
      return false;
    }

    if(search){

      const s = search.toLowerCase();

      const staff = (req.staffName || "").toLowerCase();
      const order = (req.orderNo || "").toLowerCase();

      if(!staff.includes(s) && !order.includes(s)){
        return false;
      }

    }

    return true;

  })
  .sort((a,b)=>{

    if(sortBy==="newest"){
      return new Date(b.requestedAt || 0) - new Date(a.requestedAt || 0);
    }

    if(sortBy==="oldest"){
      return new Date(a.requestedAt || 0) - new Date(b.requestedAt || 0);
    }

    if(sortBy==="highest"){
      return (b.requestedAmount || 0) - (a.requestedAmount || 0);
    }

    return 0;

  });

  /* ==========================
     OPEN DETAILS
  ========================== */

  const openDetails = async (req) => {

    try{

      await updateDoc(doc(db,"salaryOverrideRequests",req.id),{
        seenBy: auth.currentUser?.uid || "",
        seenAt: serverTimestamp()
      });

    }catch(err){
      console.error("Seen update failed",err);
    }

    setDetailModal({
      open:true,
      request:req
    });

  };

  /* ==========================
     APPROVE REQUEST
  ========================== */

  const approveRequest = async (req) => {

    const confirmed = window.confirm(
      `Approve salary increase for ${req.staffName}?`
    );

    if(!confirmed) return;

    setProcessing(req.id);

    try{

      const assignmentRef = doc(db,"staffAssignments",req.assignmentId);

      const newAmount = Number(req.requestedAmount || 0);

      await updateDoc(assignmentRef,{
        rate:req.requestedRate,
        amount:newAmount,
        balanceAmount:newAmount,
        rateOverride:true,
        rateOverrideReason:req.note || "",
        rateOverrideApprovedAt:serverTimestamp()
      });

      await updateDoc(doc(db,"salaryOverrideRequests",req.id),{

        status:"approved",
        approvedAt:serverTimestamp(),
        approvedBy: auth.currentUser?.uid || "",
        approvedByName:
          auth.currentUser?.displayName ||
          auth.currentUser?.email ||
          "Admin"

      });

      await loadRequests();

    }
    catch(err){

      console.error(err);
      alert("Failed to approve request");

    }
    finally{

      setProcessing(null);

    }

  };

  /* ==========================
     REJECT REQUEST
  ========================== */

  const rejectRequest = async (req) => {

    const confirmed = window.confirm(
      `Reject salary increase for ${req.staffName}?`
    );

    if(!confirmed) return;

    setProcessing(req.id);

    try{

      await updateDoc(doc(db,"salaryOverrideRequests",req.id),{
        status:"rejected",
        rejectedAt:serverTimestamp()
      });

      await loadRequests();

    }
    catch(err){

      console.error(err);
      alert("Failed to reject request");

    }
    finally{

      setProcessing(null);

    }

  };

  /* ==========================
     UI
  ========================== */

  return(

  <div className="sr-wrap">

    <div className="sr-header">
      <h2>Salary Increase Requests</h2>
    </div>

    {/* FILTERS */}

    <div className="sr-filters">

      <input
        className="sr-search"
        placeholder="Search staff or order..."
        value={search}
        onChange={(e)=>setSearch(e.target.value)}
      />

      <select
        value={statusFilter}
        onChange={(e)=>setStatusFilter(e.target.value)}
      >
        <option value="all">All Status</option>
        <option value="pending">Pending</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
      </select>

      <select
        value={careFilter}
        onChange={(e)=>setCareFilter(e.target.value)}
      >
        <option value="all">All Care</option>
        <option value="base">Base Care</option>
        <option value="icu">ICU Care</option>
        <option value="vent">Ventilator</option>
      </select>

      <select
        value={sortBy}
        onChange={(e)=>setSortBy(e.target.value)}
      >
        <option value="newest">Newest</option>
        <option value="oldest">Oldest</option>
        <option value="highest">Highest Request</option>
      </select>

    </div>

    {loading && (
      <div className="sr-muted">Loading requests...</div>
    )}

    {!loading && filteredRequests.length>0 && (

      <table className="sr-table">

        <thead>
          <tr>
            <th>Staff</th>
            <th>Order</th>
            <th>Order Total</th>
            <th>Staff Type</th>
            <th>Care</th>
            <th>Shift</th>
            <th>Current Rate</th>
            <th>Requested Rate</th>
            <th>Requested Amount</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>

          {filteredRequests.map(req=>(

            <tr key={req.id}>

              <td><strong>{req.staffName}</strong></td>

              <td
                className="sr-order-link"
                onClick={()=>navigate(`/crm/nursing-orders/${req.orderId}`)}
              >
                {req.orderNo}
              </td>

              <td>₹ {fmtCurrency(req.orderTotal)}</td>

              <td>{req.staffType}</td>

              <td>{req.careType}</td>

              <td>{req.shift}</td>

              <td>₹ {fmtCurrency(req.currentRate)}</td>

              <td className="sr-highlight">
                ₹ {fmtCurrency(req.requestedRate)}
              </td>

              <td className="sr-highlight">
                ₹ {fmtCurrency(req.requestedAmount)}
              </td>

              <td>
                <span className={`sr-status sr-${req.status}`}>
                  {req.status}
                </span>
              </td>

              <td>

                <div className="sr-actions">

                  <button
                    className="sr-btn sr-detail"
                    onClick={()=>openDetails(req)}
                  >
                    Details
                  </button>

                  {req.status==="pending" && (

                  <>
                    <button
                      className="sr-btn sr-approve"
                      disabled={processing===req.id}
                      onClick={()=>approveRequest(req)}
                    >
                      Approve
                    </button>

                    <button
                      className="sr-btn sr-reject"
                      disabled={processing===req.id}
                      onClick={()=>rejectRequest(req)}
                    >
                      Reject
                    </button>
                  </>

                  )}

                </div>

              </td>

            </tr>

          ))}

        </tbody>

      </table>

    )}

{/* DETAILS MODAL */}

{detailModal.open && (

<div className="sr-modal">

<div className="sr-modal-card">

<h3>Salary Request Details</h3>

<p><strong>Staff:</strong> {detailModal.request.staffName}</p>
<p><strong>Order:</strong> {detailModal.request.orderNo}</p>
<p><strong>Care:</strong> {detailModal.request.careType}</p>
<p><strong>Shift:</strong> {detailModal.request.shift}</p>

<p>
<strong>Current Rate:</strong> ₹ {fmtCurrency(detailModal.request.currentRate)}
</p>

<p>
<strong>Requested Rate:</strong> ₹ {fmtCurrency(detailModal.request.requestedRate)}
</p>

<p>
<strong>Requested Amount:</strong> ₹ {fmtCurrency(detailModal.request.requestedAmount)}
</p>

<p>
<strong>Status:</strong> {detailModal.request.status}
</p>

{detailModal.request.approvedByName && (

<p>
<strong>Approved By:</strong> {detailModal.request.approvedByName}
</p>

)}

{detailModal.request.note && (

<div className="sr-note">
<strong>Note:</strong> {detailModal.request.note}
</div>

)}

<button
className="sr-btn sr-close"
onClick={()=>setDetailModal({open:false,request:null})}
>
Close
</button>

</div>

</div>

)}

  </div>

  );

}