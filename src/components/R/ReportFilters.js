import React from "react";

export default function ReportFilters({filters,setFilters}){

return(

<div className="nor-filters">

<select
value={filters.type || "today"}
onChange={e=>
setFilters({
...filters,
type:e.target.value
})
}

>

<option value="today">Today</option>
<option value="week">This Week</option>
<option value="month">This Month</option>
<option value="custom">Custom Range</option>

</select>

{filters.type==="custom" && (

<>

<input
type="date"
value={filters.start || ""}   // ✅ FIX
onChange={e=>
setFilters({
...filters,
start:e.target.value
})
}
/>

<input
type="date"
value={filters.end || ""}     // ✅ FIX
onChange={e=>
setFilters({
...filters,
end:e.target.value
})
}
/>

</>

)}

</div>

)

}
