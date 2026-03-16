import React from "react";

import OrdersTable from "./OrdersTable";
import ExtensionsTable from "./ExtensionsTable";
import PaymentsTable from "./PaymentsTable";

import "./tables.css";

export default function TablesSection({ report }) {

return (

<div className="tables-wrapper">

<OrdersTable report={report} />

<ExtensionsTable report={report} />

<PaymentsTable report={report} />

</div>

);

}