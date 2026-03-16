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

export default function ExtensionRevenueChart({ report }) {

const data = [

{
name: "Equipment",
value: report?.equipmentExtensionsAmount || 0
},

{
name: "Nursing",
value: report?.nursingExtensionRevenue || 0
},

{
name: "Caretaker",
value: report?.caretakerExtensionRevenue || 0
}

];

return (

<div className="chart-card">

<h3 className="chart-title">
Extension Revenue
</h3>

<ResponsiveContainer width="100%" height={260}>

<BarChart data={data}>

<XAxis dataKey="name" />

<YAxis />

<Tooltip />

<Bar dataKey="value" fill="#a855f7" />

</BarChart>

</ResponsiveContainer>

</div>

);

}