import React from "react";
import "./staffLeaderboard.css";

const formatCurrency = v =>
Number(v||0).toLocaleString("en-IN");

export default function StaffLeaderboard({data=[]}){

return(

<div className="nor-block">

<h2 className="nor-section-title">
Top Performing Staff
</h2>

<div className="nor-leaderboard">

{data.map((s,i)=>{

const rank = i+1;

return(

<div
key={s.staffId}
className={`nor-leader-card nor-rank-${rank}`}
>

<div className="nor-rank">

{rank===1 && "🥇"}
{rank===2 && "🥈"}
{rank===3 && "🥉"}
{rank>3 && `#${rank}`}

</div>

<div className="nor-leader-info">

<div className="nor-leader-name">
{s.staffName}
</div>

<div className="nor-leader-type">
{s.staffType}
</div>

</div>

<div className="nor-leader-stats">

<div className="nor-leader-earned">
₹ {formatCurrency(s.earned)}
</div>

<div className="nor-leader-orders">
{s.orders} orders
</div>

</div>

</div>

)

})}

</div>

</div>

)

}