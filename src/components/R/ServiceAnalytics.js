import React from "react";

import {
BarChart,
Bar,
XAxis,
YAxis,
Tooltip,
ResponsiveContainer,
CartesianGrid,
Legend
} from "recharts";

import "./serviceAnalytics.css";

const formatCurrency = v =>
Number(v||0).toLocaleString("en-IN");

export default function ServiceAnalytics({data=[]}){

const chartData = data.map(s=>({

service:s.service,

assignments:s.assignments,

salary:s.salary

}));

return(

<div className="nor-block">

<h2 className="nor-section-title">
Service Analytics
</h2>

<div className="nor-service-layout">

{/* SERVICE LIST */}

<div className="nor-service-list">

{data.map((s,i)=>(

<div
key={i}
className="nor-service-card"
>

<div className="nor-service-name">
{s.service}
</div>

<div className="nor-service-stats">

<div>
Assignments
<strong>
{s.assignments}
</strong>
</div>

<div>
Salary Cost
<strong>
₹ {formatCurrency(s.salary)}
</strong>
</div>

</div>

</div>

))}

</div>

{/* CHART */}

<div className="nor-service-chart">

<ResponsiveContainer width="100%" height={300}>

<BarChart data={chartData}>

<CartesianGrid strokeDasharray="3 3"/>

<XAxis dataKey="service"/>

<YAxis/>

<Tooltip
formatter={(v,name)=>
name==="salary"
?`₹ ${formatCurrency(v)}`
:v
}
/>

<Legend/>

<Bar
dataKey="assignments"
name="Assignments"
radius={[6,6,0,0]}
/>

<Bar
dataKey="salary"
name="Salary Cost"
radius={[6,6,0,0]}
/>

</BarChart>

</ResponsiveContainer>

</div>

</div>

</div>

)

}