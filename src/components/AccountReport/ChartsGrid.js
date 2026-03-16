import React from "react";

import RevenueChart from "./RevenueChart";
import OrdersChart from "./OrdersChart";
import CollectionsChart from "./CollectionsChart";
import ExtensionRevenueChart from "./ExtensionRevenueChart";

import "./charts.css";

export default function ChartsGrid({ report }) {

return (

<div className="charts-wrapper">

<div className="chart-grid">

<RevenueChart report={report} />
<OrdersChart report={report} />

</div>

<div className="chart-grid">

<CollectionsChart report={report} />
<ExtensionRevenueChart report={report} />

</div>

</div>

);

}