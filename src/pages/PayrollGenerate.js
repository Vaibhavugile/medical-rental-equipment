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

export default function PayrollGenerate({ serviceType="nursing" }){

const [filters,setFilters] = useState({
type:"month",
start:null,
end:null
});

const report = useNursingReportData(filters,serviceType);

const [modal,setModal]=useState(null);

if(report.loading){
return(
<div className="nor-root">
Loading analytics...
</div>
)
}

return(

<div className="nor-root">

<h1 className="nor-title">
{serviceType==="caretaker"
? "Caretaker Operations Intelligence"
: "Nursing Operations Intelligence"}
</h1>

<ReportFilters
filters={filters}
setFilters={setFilters}
/>

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

<RevenueAnalytics
data={report.paymentMethods}
/>

<ProfitAnalytics
data={report.summary}
/>

<OrderProfitTable
data={report.orders}
/>

<LossOrdersTable
data={report.lossOrders}
/>

<StaffLeaderboard
data={report.staffLeaderboard}
/>

<StaffPerformanceTable
data={report.staff}
/>

<ServiceAnalytics
data={report.services}
/>

<SalaryInsights
data={report.summary}
/>

<ExtensionAnalytics
data={report.extensions}
/>

<ActivityAnalytics
data={report.activity}
/>

</div>

)

}