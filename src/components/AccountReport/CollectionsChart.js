import React from "react";
import {
BarChart,
Bar,
XAxis,
YAxis,
Tooltip,
ResponsiveContainer
} from "recharts";

import "./charts.css";

export default function CollectionsChart({ report }) {

const data = [

{
name: "Equipment",
value: report?.equipmentCollected || 0
},

{
name: "Nursing",
value: report?.nursingCollected || 0
},

{
name: "Caretaker",
value: report?.caretakerCollected || 0
}

];

return (

<div className="chart-card">

<h3 className="chart-title">
Collections by Service
</h3>

<ResponsiveContainer width="100%" height={260}>

<BarChart data={data}>

<XAxis dataKey="name" />

<YAxis />

<Tooltip />

<Bar dataKey="value" fill="#22c55e" />

</BarChart>

</ResponsiveContainer>

</div>

);

}