import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

export default function useNursingReportData(filters, serviceType = "nursing") {

const [loading,setLoading]=useState(true);

const [summary,setSummary]=useState({});
const [orders,setOrders]=useState([]);
const [staff,setStaff]=useState([]);
const [services,setServices]=useState([]);
const [staffLeaderboard,setStaffLeaderboard]=useState([]);
const [paymentMethods,setPaymentMethods]=useState({});
const [lossOrders,setLossOrders]=useState([]);
const [extensions,setExtensions]=useState([]);
const [activity,setActivity]=useState([]);

useEffect(()=>{
setLoading(true);
load();
},[filters, serviceType]);

/* =========================
DATE FILTER
========================= */

function inRange(date){

if(!date) return true;

const now = new Date();
const d = date?.toDate ? date.toDate() : new Date(date);

if(filters?.type==="today"){
return d.toDateString() === now.toDateString();
}

if(filters?.type==="week"){
const start = new Date();
start.setDate(now.getDate()-7);
return d >= start;
}

if(filters?.type==="month"){
return (
d.getMonth()===now.getMonth() &&
d.getFullYear()===now.getFullYear()
);
}

if(filters?.type==="custom"){

if(!filters.start || !filters.end) return true;

const start=new Date(filters.start);
const end=new Date(filters.end);

end.setHours(23,59,59,999);

return d>=start && d<=end;
}

return true;

}

/* =========================
LOAD DATA
========================= */

const load = async()=>{

try{

/* =========================
ORDERS
========================= */

const orderSnap =
await getDocs(collection(db,"nursingOrders"));

const allOrders =
orderSnap.docs.map(d=>({
id:d.id,
...(d.data()||{})
}));

/* =========================
FILTER
========================= */

const filteredOrders =
allOrders.filter(o=>{

const dateOk = inRange(o.createdAt);

const typeOk =
serviceType === "all"
? true
: (o.serviceType || "nursing") === serviceType;

return dateOk && typeOk;

});

/* =========================
ASSIGNMENTS
========================= */

const assignSnap =
await getDocs(collection(db,"staffAssignments"));

const assignments =
assignSnap.docs.map(d=>({
id:d.id,
...(d.data()||{})
}));

const orderIds =
filteredOrders.map(o=>o.id);

const filteredAssignments =
assignments.filter(a =>
orderIds.includes(a.orderId)
);

/* =========================
FINANCIAL TOTALS
========================= */

let invoiceTotal=0;
let subtotal=0;
let taxTotal=0;
let discountTotal=0;

let revenueCollected=0;
let revenuePending=0;

let refundPaidTotal = 0;
let refundPendingTotal = 0;

const paymentMap={};

/* =========================
ORDER MAP
========================= */

const orderMap={};

filteredOrders.forEach(o=>{

const totals=o?.totals||{};

const sub = Number(totals.subtotal||0);
const disc = Number(totals.discountAmount||0);
const total = Number(totals.total||0);

const tax =
(totals.taxBreakdown||[])
.reduce((sum,t)=>sum+Number(t.amount||0),0);

subtotal+=sub;
discountTotal+=disc;
taxTotal+=tax;
invoiceTotal+=total;

/* =========================
PAYMENTS
========================= */

let paid=0;

(o.payments||[]).forEach(p=>{

const amount=Number(p.amount||0);

paid+=amount;
revenueCollected+=amount;

const method=(p.method||"other").toLowerCase();
paymentMap[method]=(paymentMap[method]||0)+amount;

});

/* =========================
REFUNDS
========================= */

let refundPaid = 0;
let refundPending = 0;

(o.refunds || []).forEach(r => {

const amt = Number(r.amount || 0);

if (r.status === "paid") {
refundPaid += amt;
refundPaidTotal += amt;

// subtract from payment method
const method=(r.method||"other").toLowerCase();
paymentMap[method]=(paymentMap[method]||0)-amt;

} else {
refundPending += amt;
refundPendingTotal += amt;
}

});

/* =========================
ADJUST COLLECTION
========================= */

revenueCollected -= refundPaid;

/* =========================
PENDING
========================= */

const pending = Math.max(total - paid + refundPending, 0);
revenuePending += pending;

/* =========================
SAVE ORDER
========================= */

orderMap[o.id]={

orderId:o.id,
orderNo:o.orderNo,
customer:o.customerName,

createdAt:o.createdAt,

invoiceTotal:total,
collected:paid - refundPaid,
pending:pending,

refundPaid,
refundPending,

staffCost:0

};

});

/* =========================
SALARY
========================= */

let salaryTotal=0;
let salaryPaid=0;
let salaryPending=0;

filteredAssignments.forEach(a=>{

const amount=Number(a.amount||0);
const paid=Number(a.paidAmount||0);
const balance=Number(a.balanceAmount||0);

salaryTotal+=amount;
salaryPaid+=paid;
salaryPending+=balance;

if(orderMap[a.orderId]){
orderMap[a.orderId].staffCost+=amount;
}

});

/* =========================
ORDER PROFIT (YOUR LOGIC)
========================= */

const orderData =
Object.values(orderMap).map(o=>({

...o,

revenue:o.invoiceTotal, // ✅ NO REFUND IMPACT
profit:o.invoiceTotal - o.staffCost

}));

/* =========================
LOSS ORDERS
========================= */

const loss =
orderData.filter(o=>o.profit<0);

/* =========================
STAFF PERFORMANCE
========================= */

const staffMap={};

filteredAssignments.forEach(a=>{

if(!staffMap[a.staffId]){

staffMap[a.staffId]={

staffId:a.staffId,
staffName:a.staffName,
staffType:a.staffType,

orders:new Set(),

earned:0,
paid:0,
pending:0

};

}

staffMap[a.staffId].orders.add(a.orderId);

staffMap[a.staffId].earned+=Number(a.amount||0);
staffMap[a.staffId].paid+=Number(a.paidAmount||0);
staffMap[a.staffId].pending+=Number(a.balanceAmount||0);

});

const staffData =
Object.values(staffMap).map(s=>({

staffId:s.staffId,
staffName:s.staffName,
staffType:s.staffType,

orders:s.orders.size,

earned:s.earned,
paid:s.paid,
pending:s.pending

}));

/* =========================
LEADERBOARD
========================= */

const leaderboard =
[...staffData]
.sort((a,b)=>b.earned-a.earned)
.slice(0,5);

/* =========================
SERVICE ANALYTICS
========================= */

const serviceMap={};

filteredAssignments.forEach(a=>{

if(!serviceMap[a.serviceName]){

serviceMap[a.serviceName]={

service:a.serviceName,
assignments:0,
salary:0

};

}

serviceMap[a.serviceName].assignments++;
serviceMap[a.serviceName].salary+=Number(a.amount||0);

});

const serviceData =
Object.values(serviceMap);

/* =========================
EXTENSIONS
========================= */

let extensionData=[];

filteredOrders.forEach(o=>{
(o.extensionHistory||[])
.forEach(e=>extensionData.push(e));
});

/* =========================
ACTIVITY
========================= */

let activityLogs=[];

filteredOrders.forEach(o=>{
(o.activityLog||[])
.forEach(a=>{
if(inRange(a.editedAt)){
activityLogs.push(a);
}
});
});

/* =========================
PROFIT SUMMARY (FINAL)
========================= */

const revenue = invoiceTotal; // ✅ FINAL
const profit = revenue - salaryTotal; // ✅ FINAL

/* =========================
SET STATE
========================= */

setSummary({

revenue,
invoiceTotal,
subtotal,
taxTotal,
discountTotal,

revenueCollected,
revenuePending,

refundPaid: refundPaidTotal,
refundPending: refundPendingTotal,

salaryTotal,
salaryPaid,
salaryPending,

profit,

orders: filteredOrders.length,
staff: staffData.length

});

setOrders(orderData);
setStaff(staffData);
setStaffLeaderboard(leaderboard);
setServices(serviceData);
setPaymentMethods(paymentMap);
setLossOrders(loss);
setExtensions(extensionData);
setActivity(activityLogs);

}catch(err){
console.error(err);
}

setLoading(false);

};

return{

loading,
summary,

orders,
staff,
services,

staffLeaderboard,
paymentMethods,

lossOrders,
extensions,
activity

};

}
