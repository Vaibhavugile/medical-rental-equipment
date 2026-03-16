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

export default function OrdersChart({ report }) {

const data = [

{
name: "Equipment",
value: report?.equipmentOrders || 0
},

{
name: "Nursing",
value: report?.nursingOrders || 0
},

{
name: "Caretaker",
value: report?.caretakerOrders || 0
}

];

return (

<div className="chart-card">

<h3 className="chart-title">
Orders by Service
</h3>

<ResponsiveContainer width="100%" height={260}>

<BarChart data={data}>

<XAxis dataKey="name" />

<YAxis />

<Tooltip />

<Bar dataKey="value" fill="#3b82f6" />

</BarChart>

</ResponsiveContainer>

</div>

);

}