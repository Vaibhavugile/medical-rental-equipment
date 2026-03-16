import React from "react";
import {
PieChart,
Pie,
Tooltip,
ResponsiveContainer,
Cell
} from "recharts";

import "./charts.css";

export default function RevenueChart({ report }) {

const data = [
{
name: "Equipment",
value: report?.equipmentRevenue || 0
},
{
name: "Nursing",
value: report?.nursingRevenue || 0
},
{
name: "Caretaker",
value: report?.caretakerRevenue || 0
}
];

const COLORS = ["#6366f1","#22c55e","#f59e0b"];

return (

<div className="chart-card">

<h3 className="chart-title">
Revenue by Service
</h3>

<ResponsiveContainer width="100%" height={260}>

<PieChart>

<Pie
data={data}
dataKey="value"
outerRadius={100}
label
>

{data.map((entry, index) => (
<Cell key={index} fill={COLORS[index]} />
))}

</Pie>

<Tooltip />

</PieChart>

</ResponsiveContainer>

</div>

);

}