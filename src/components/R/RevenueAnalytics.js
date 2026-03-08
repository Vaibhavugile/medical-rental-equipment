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

export default function RevenueAnalytics({data={}}){

/* convert map -> chart array */

const chartData =
Object.entries(data).map(([method,value])=>({

method:method.toUpperCase(),

amount:Number(value||0)

}));

/* total revenue */

const total =
chartData.reduce(
(s,r)=>s+r.amount,
0
);

return(

<div className="nor-block">

<h2 className="nor-section-title">
Revenue Analytics
</h2>

<div className="nor-revenue-layout">

{/* LEFT SUMMARY */}

<div className="nor-revenue-summary">

<div className="nor-revenue-total">

<div className="nor-label">
Total Collected
</div>

<div className="nor-value">
₹ {formatCurrency(total)}
</div>

</div>

<div className="nor-method-list">

{chartData.map(m=>(

<div
key={m.method}
className="nor-method-row"
>

<div className="nor-method-name">
{m.method}
</div>

<div className="nor-method-amount">
₹ {formatCurrency(m.amount)}
</div>

<div className="nor-method-percent">

{total
?((m.amount/total)*100)
.toFixed(1)
:0}%

</div>

</div>

))}

</div>

</div>

{/* RIGHT CHART */}

<div className="nor-revenue-chart">

<ResponsiveContainer
width="100%"
height={260}
>

<BarChart
data={chartData}
>

<CartesianGrid strokeDasharray="3 3"/>

<XAxis dataKey="method"/>

<YAxis/>

<Tooltip
formatter={(v)=>
`₹ ${formatCurrency(v)}`
}
/>

<Bar
dataKey="amount"
radius={[6,6,0,0]}
/>

</BarChart>

</ResponsiveContainer>

</div>

</div>

</div>

);

}