import React from "react";

import {
PieChart,
Pie,
Cell,
Tooltip,
ResponsiveContainer,
Legend
} from "recharts";

import "./salaryInsights.css";

const formatCurrency = v =>
Number(v||0).toLocaleString("en-IN");

export default function SalaryInsights({data={}}){

const total = Number(data.salaryTotal||0);
const paid = Number(data.salaryPaid||0);
const pending = Number(data.salaryPending||0);

const completion =
total ? ((paid/total)*100).toFixed(1) : 0;

const chartData = [

{
name:"Paid",
value:paid
},

{
name:"Pending",
value:pending
}

];

const COLORS = [
"#16a34a",
"#f59e0b"
];

return(

<div className="nor-block">

<h2 className="nor-section-title">
Salary Insights
</h2>

<div className="nor-salary-layout">

{/* LEFT SUMMARY */}

<div className="nor-salary-summary">

<Metric
label="Total Salary"
value={`₹ ${formatCurrency(total)}`}
/>

<Metric
label="Salary Paid"
value={`₹ ${formatCurrency(paid)}`}
type="paid"
/>

<Metric
label="Salary Pending"
value={`₹ ${formatCurrency(pending)}`}
type="pending"
/>

<div className="nor-payroll-progress">

<div className="nor-progress-label">
Payroll Completion
</div>

<div className="nor-progress-value">
{completion} %
</div>

</div>

</div>

{/* RIGHT CHART */}

<div className="nor-salary-chart">

<ResponsiveContainer width="100%" height={260}>

<PieChart>

<Pie
data={chartData}
dataKey="value"
nameKey="name"
outerRadius={90}
label
>

{chartData.map((entry,i)=>(
<Cell
key={i}
fill={COLORS[i]}
/>
))}

</Pie>

<Tooltip
formatter={v =>
`₹ ${formatCurrency(v)}`
}
/>

<Legend/>

</PieChart>

</ResponsiveContainer>

</div>

</div>

</div>

)

}

function Metric({label,value,type}){

return(

<div className={`nor-salary-card ${
type==="paid"
?"nor-salary-paid"
:type==="pending"
?"nor-salary-pending"
:""
}`}>

<div className="nor-salary-label">
{label}
</div>

<div className="nor-salary-value">
{value}
</div>

</div>

)

}