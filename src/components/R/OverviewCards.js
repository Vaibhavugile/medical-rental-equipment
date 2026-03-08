import React from "react";
import "./overviewCards.css";

const formatCurrency = (v)=>
Number(v||0).toLocaleString("en-IN",{
minimumFractionDigits:0,
maximumFractionDigits:0
});

export default function OverviewCards({data={},onCardClick}){

return(

<div className="nor-overview-grid">

<Card title="Total Orders" value={data.orders} color="blue"
onClick={()=>onCardClick("orders")}
/>

<Card title="Total Staff" value={data.staff} color="purple"
onClick={()=>onCardClick("staff")}
/>

<Card title="Subtotal" value={`₹ ${formatCurrency(data.subtotal)}`} color="gray"
/>

<Card title="Tax" value={`₹ ${formatCurrency(data.taxTotal)}`} color="orange"
/>

<Card title="Discount" value={`₹ ${formatCurrency(data.discountTotal)}`} color="pink"
/>

<Card title="Invoice Total"
value={`₹ ${formatCurrency(data.invoiceTotal)}`}
color="orange"
/>

<Card
title="Revenue Collected"
value={`₹ ${formatCurrency(data.revenueCollected)}`}
color="green"
onClick={()=>onCardClick("revenueCollected")}
/>

<Card
title="Revenue Pending"
value={`₹ ${formatCurrency(data.revenuePending)}`}
color="yellow"
onClick={()=>onCardClick("revenuePending")}
/>

<Card
title="Salary Total"
value={`₹ ${formatCurrency(data.salaryTotal)}`}
color="red"
/>

<Card
title="Salary Paid"
value={`₹ ${formatCurrency(data.salaryPaid)}`}
color="teal"
onClick={()=>onCardClick("salaryPaid")}
/>

<Card
title="Salary Pending"
value={`₹ ${formatCurrency(data.salaryPending)}`}
color="yellow"
onClick={()=>onCardClick("salaryPending")}
/>

<Card
title="Profit"
value={`₹ ${formatCurrency(data.profit)}`}
color={data.profit >=0 ? "green" : "red"}
/>

</div>

)

}

function Card({title,value,color,onClick}){

return(

<div
className={`nor-card nor-${color}`}
onClick={onClick}
style={{cursor:onClick ? "pointer":"default"}}
>

<div className="nor-card-title">
{title}
</div>

<div className="nor-card-value">
{value}
</div>

</div>

)

}