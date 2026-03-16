import React from "react";
import {
BarChart,
Bar,
XAxis,
YAxis,
Tooltip,
ResponsiveContainer,
LabelList
} from "recharts";

import "./funnel.css";

export default function FunnelChart({ report }) {

const data = [

{
step: "Leads",
value: report?.leadsAdded || 0
},

{
step: "Contacted",
value: report?.leadsContacted || 0
},

{
step: "Requirements",
value: report?.requirementsCreated || 0
},

{
step: "Quotations",
value: report?.quotationsSent || 0
},

{
step: "Accepted",
value: report?.quotationAccepted || 0
},

{
step: "Orders",
value: report?.ordersCreated || 0
}

];

return (

<div className="funnel-card">

<h3 className="funnel-title">

Sales Funnel

</h3>

<ResponsiveContainer width="100%" height={300}>

<BarChart data={data}>

<XAxis dataKey="step" />

<YAxis />

<Tooltip />

<Bar dataKey="value" fill="#6366f1">

<LabelList dataKey="value" position="top" />

</Bar>

</BarChart>

</ResponsiveContainer>

</div>

);

}