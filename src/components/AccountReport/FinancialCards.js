import React from "react";

export default function FinancialCards({report}){

return(

<div className="finance-grid">

<div className="finance-card">

Subtotal

<strong>
₹{report.subtotalTotal}
</strong>

</div>

<div className="finance-card">

Tax

<strong>
₹{report.taxTotal}
</strong>

</div>

<div className="finance-card">

Discount

<strong>
₹{report.discountTotal}
</strong>

</div>

<div className="finance-card">

Revenue

<strong>
₹{report.totalRevenue}
</strong>

</div>

</div>

)

}