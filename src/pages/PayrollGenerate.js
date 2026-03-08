import React,{useState} from "react";


import useNursingReportData from "./useNursingReportData";
import ReportModal from "../components/R/ReportModal";
import ReportFilters from "../components/R/ReportFilters";
import DailyRevenueReport from "../components/R/DailyRevenueReport";
import DailySalaryReport from "../components/R/DailySalaryReport";
import OverviewCards from "../components/R/OverviewCards";
import RevenueAnalytics from "../components/R/RevenueAnalytics";
import ProfitAnalytics from "../components/R/ProfitAnalytics";
import OrderProfitTable from "../components/R/OrderProfitTable";
import StaffPerformanceTable from "../components/R/StaffPerformanceTable";
import StaffLeaderboard from "../components/R/StaffLeaderboard";
import ServiceAnalytics from "../components/R/ServiceAnalytics";
import SalaryInsights from "../components/R/SalaryInsights";
import LossOrdersTable from "../components/R/LossOrdersTable";
import ExtensionAnalytics from "../components/R/ExtensionAnalytics";
import ActivityAnalytics from "../components/R/ActivityAnalytics";

export default function PayrollGenerate(){

/* =========================
DATE FILTER STATE
========================= */

const [filters,setFilters] = useState({

type:"month",
start:null,
end:null

});

/* =========================
LOAD REPORT DATA
========================= */

const report = useNursingReportData(filters);
const [modal,setModal]=useState(null);
if(report.loading){

return(

<div className="nor-root">

Loading analytics...

</div>

)

}

/* =========================
UI
========================= */

return(

<div className="nor-root">

<h1 className="nor-title">

Nursing Operations Intelligence

</h1>

{/* FILTERS */}

<ReportFilters
filters={filters}
setFilters={setFilters}
/>

{/* OVERVIEW */}


<OverviewCards
data={report.summary}
onCardClick={(type)=>setModal(type)}
/>

<ReportModal
type={modal}
data={report}
onClose={()=>setModal(null)}
/>

<DailyRevenueReport/>
<DailySalaryReport/>

{/* FINANCIAL ANALYTICS */}

<RevenueAnalytics
data={report.paymentMethods}
/>

<ProfitAnalytics
data={report.summary}
/>

{/* ORDER ANALYTICS */}

<OrderProfitTable
data={report.orders}
/>

<LossOrdersTable
data={report.lossOrders}
/>

{/* STAFF ANALYTICS */}

<StaffLeaderboard
data={report.staffLeaderboard}
/>

<StaffPerformanceTable
data={report.staff}
/>

{/* SERVICE ANALYTICS */}

<ServiceAnalytics
data={report.services}
/>

{/* PAYROLL */}

<SalaryInsights
data={report.summary}
/>

{/* EXTENSIONS */}

<ExtensionAnalytics
data={report.extensions}
/>

{/* ACTIVITY */}

<ActivityAnalytics
data={report.activity}
/>

</div>

)

}