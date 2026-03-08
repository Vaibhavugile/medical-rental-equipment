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

import "./extensionAnalytics.css";

const formatCurrency = v =>
Number(v||0).toLocaleString("en-IN");

export default function ExtensionAnalytics({data=[]}){

/* summary */

let totalRevenue = 0;

const serviceMap = {};

data.forEach(e=>{

const amount = Number(e.extraAmount||0);

totalRevenue += amount;

if(!serviceMap[e.serviceName]){

serviceMap[e.serviceName]={
service:e.serviceName,
extensions:0,
revenue:0
};

}

serviceMap[e.serviceName].extensions++;

serviceMap[e.serviceName].revenue += amount;

});

const chartData = Object.values(serviceMap);

return(

<div className="nor-block">

<h2 className="nor-section-title">
Service Extensions
</h2>

<div className="nor-extension-summary">

<div className="nor-ext-card">

<div className="nor-ext-label">
Total Extensions
</div>

<div className="nor-ext-value">
{data.length}
</div>

</div>

<div className="nor-ext-card">

<div className="nor-ext-label">
Extra Revenue
</div>

<div className="nor-ext-value">
₹ {formatCurrency(totalRevenue)}
</div>

</div>

</div>

<div className="nor-extension-layout">

{/* LIST */}

<div className="nor-extension-list">

{data.slice(0,8).map((e,i)=>(
<div key={i} className="nor-extension-item">

<div className="nor-extension-service">
{e.serviceName}
</div>

<div className="nor-extension-dates">

{new Date(e.oldEndDate).toLocaleDateString()}
 →
{new Date(e.newEndDate).toLocaleDateString()}

</div>

<div className="nor-extension-amount">
+ ₹ {formatCurrency(e.extraAmount)}
</div>

</div>
))}

</div>

{/* CHART */}

<div className="nor-extension-chart">

<ResponsiveContainer width="100%" height={260}>

<BarChart data={chartData}>

<CartesianGrid strokeDasharray="3 3"/>

<XAxis dataKey="service"/>

<YAxis/>

<Tooltip
formatter={v =>
`₹ ${formatCurrency(v)}`
}
/>

<Bar
dataKey="revenue"
name="Extension Revenue"
radius={[6,6,0,0]}
/>

</BarChart>

</ResponsiveContainer>

</div>

</div>

</div>

)

}