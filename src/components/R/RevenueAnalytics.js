import React from "react";

import {
BarChart,
Bar,
XAxis,
YAxis,
Tooltip,
ResponsiveContainer,
CartesianGrid
} from "recharts";

import "./revenueAnalytics.css";

const formatCurrency = v =>
Number(v||0).toLocaleString("en-IN");

/* =========================
CUSTOM TOOLTIP
========================= */

const CustomTooltip = ({active, payload}) => {

if(active && payload && payload.length){

const d = payload[0].payload;

return (

<div style={{
background:"#fff",
padding:"10px 12px",
border:"1px solid #e5e7eb",
borderRadius:8,
boxShadow:"0 10px 25px rgba(0,0,0,0.1)"
}}>

<div><strong>{d.method}</strong></div>

<div>Gross: ₹ {formatCurrency(d.gross)}</div>
<div style={{color:"#dc2626"}}>
Refund: ₹ {formatCurrency(d.refund)}
</div>

<div style={{marginTop:6,fontWeight:600}}>
Net: ₹ {formatCurrency(d.net)}
</div>

</div>
);

}

return null;

};

export default function RevenueAnalytics({data={}}){

/*
Expected:
{
cash: 30000,
upi: 0,
card: 0,
bank: 0,
refund_cash: 9000
}
*/

/* =========================
PROCESS DATA
========================= */

const methods = ["cash","upi","card","bank","other"];

const chartData = methods.map(m=>{

const gross = Number(data[m] || 0);
const refund = Number(data[`refund_${m}`] || 0);
const net = gross - refund;

return {
method: m.toUpperCase(),
gross,
refund,
net
};

});

/* =========================
TOTALS
========================= */

const totalGross =
chartData.reduce((s,r)=>s+r.gross,0);

const totalRefund =
chartData.reduce((s,r)=>s+r.refund,0);

const totalNet =
chartData.reduce((s,r)=>s+r.net,0);

/* =========================
UI
========================= */

return(

<div className="nor-block">

<h2 className="nor-section-title">
Revenue Analytics
</h2>

<div className="nor-revenue-layout">

{/* =========================
LEFT SUMMARY
========================= */}

<div className="nor-revenue-summary">

<div className="nor-revenue-total">

<div className="nor-label">
Gross Collection
</div>

<div className="nor-value">
₹ {formatCurrency(totalGross)}
</div>

</div>

<div className="nor-revenue-total refund">

<div className="nor-label">
Refund
</div>

<div className="nor-value red">
₹ {formatCurrency(totalRefund)}
</div>

</div>

<div className="nor-revenue-total net">

<div className="nor-label">
Net Collection
</div>

<div className="nor-value green">
₹ {formatCurrency(totalNet)}
</div>

</div>

{/* =========================
METHOD LIST
========================= */}

<div className="nor-method-list">

{chartData.map(m=>{

const percent =
totalGross
?((m.gross/totalGross)*100).toFixed(1)
:0;

return(

<div key={m.method} className="nor-method-row">

<div className="nor-method-name">
{m.method}
</div>

<div className="nor-method-amount">
₹ {formatCurrency(m.gross)}
</div>

<div className="nor-method-percent">
{percent}%
</div>

{/* 🔥 show refund if exists */}
{m.refund > 0 && (

<div className="nor-method-refund">
Refund: ₹ {formatCurrency(m.refund)}
</div>
)}

</div>

);

})}

</div>

</div>

{/* =========================
CHART (NET)
========================= */}

<div className="nor-revenue-chart">

<ResponsiveContainer width="100%" height={260}>

<BarChart data={chartData}>

<CartesianGrid strokeDasharray="3 3"/>

<XAxis dataKey="method"/>

<YAxis/>

<Tooltip content={<CustomTooltip />} />

{/* NET BAR */} <Bar
dataKey="net"
radius={[6,6,0,0]}
/>

</BarChart>

</ResponsiveContainer>

</div>

</div>

</div>

);

}
