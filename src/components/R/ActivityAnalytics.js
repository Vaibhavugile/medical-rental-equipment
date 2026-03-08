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

import "./activityAnalytics.css";

export default function ActivityAnalytics({data=[]}){

/* =====================
GROUP ACTIONS
===================== */

const actionMap = {};

data.forEach(a=>{

const key = a.action || "OTHER";

if(!actionMap[key]){

actionMap[key] = {
action:key,
count:0
};

}

actionMap[key].count++;

});

const chartData = Object.values(actionMap);

/* =====================
RECENT ACTIVITY
===================== */

const recent =
[...data]
.sort((a,b)=>new Date(b.editedAt)-new Date(a.editedAt))
.slice(0,8);

return(

<div className="nor-block">

<h2 className="nor-section-title">
Activity Analytics
</h2>

<div className="nor-activity-layout">

{/* RECENT ACTIVITY */}

<div className="nor-activity-list">

<h3 className="nor-activity-sub">
Recent Activity
</h3>

{recent.map((a,i)=>(

<div key={i} className="nor-activity-item">

<div className="nor-activity-action">

{a.action.replaceAll("_"," ")}

</div>

<div className="nor-activity-user">

{a.editedByName}

</div>

<div className="nor-activity-time">

{new Date(a.editedAt)
.toLocaleString()}

</div>

</div>

))}

</div>

{/* ACTION CHART */}

<div className="nor-activity-chart">

<h3 className="nor-activity-sub">
System Actions
</h3>

<ResponsiveContainer width="100%" height={260}>

<BarChart data={chartData}>

<CartesianGrid strokeDasharray="3 3"/>

<XAxis dataKey="action"/>

<YAxis/>

<Tooltip/>

<Bar
dataKey="count"
name="Actions"
radius={[6,6,0,0]}
/>

</BarChart>

</ResponsiveContainer>

</div>

</div>

</div>

)

}