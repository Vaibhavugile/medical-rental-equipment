import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

import KpiSection from "../components/AccountReport/KpiSection";
import FunnelChart from "../components/AccountReport/FunnelChart";
import ChartsGrid from "../components/AccountReport/ChartsGrid";
import TablesSection from "../components/AccountReport/TablesSection";

import "./AccountDashboard.css";

export default function AccountDashboard(){

const today = new Date().toISOString().slice(0,10);

const [startDate,setStartDate] = useState(today);
const [endDate,setEndDate] = useState(today);

const [report,setReport] = useState(null);
const [loading,setLoading] = useState(false);

useEffect(()=>{
loadReports();
},[startDate,endDate]);

const loadReports = async ()=>{

try{

setLoading(true);

const ref = collection(db,"reports_account_daily");
const snap = await getDocs(ref);

let mergedReport = {};

snap.forEach(doc=>{

const data = doc.data();

if(data.date >= startDate && data.date <= endDate){

Object.keys(data).forEach(key=>{

if(typeof data[key] === "number"){

mergedReport[key] = (mergedReport[key] || 0) + data[key];

}

});

mergedReport.orders = [
...(mergedReport.orders || []),
...(data.orders || [])
];

mergedReport.extensions = [
...(mergedReport.extensions || []),
...(data.extensions || [])
];

mergedReport.payments = [
...(mergedReport.payments || []),
...(data.payments || [])
];

}

});

setReport(mergedReport);

}catch(err){

console.error(err);

}finally{

setLoading(false);

}

};

return(

<div className="account-page">

{/* HEADER */}

<div className="account-header">

<h1 className="account-title">
Account  Dashboard
</h1>

<div className="account-filters">

<div className="filter-group">
<label>Start Date</label>
<input
type="date"
value={startDate}
onChange={(e)=>setStartDate(e.target.value)}
className="date-input"
/>
</div>

<div className="filter-group">
<label>End Date</label>
<input
type="date"
value={endDate}
onChange={(e)=>setEndDate(e.target.value)}
className="date-input"
/>
</div>

</div>

</div>

{/* LOADING */}

{loading && (

<div className="loading">
Loading report...
</div>
)}

{/* DASHBOARD */}

{!loading && report && (

<>

<KpiSection report={report}/>

<FunnelChart report={report}/>

<ChartsGrid report={report}/>

<TablesSection report={report}/>

</>

)}

</div>

);

}
