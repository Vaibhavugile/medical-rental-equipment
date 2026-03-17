import {
collection,
getDocs,
doc,
setDoc
} from "firebase/firestore";

import { db } from "../firebase";

export const migrateEquipmentReports = async () => {

console.log("Starting Equipment Report Migration...");

const reports = {};

/* =========================
HELPERS
========================= */

const getDateKey = (date) => {
return new Date(date).toISOString().slice(0,10);
};

const addValue = (dateKey, field, value) => {

if(!reports[dateKey]){
reports[dateKey] = { date: dateKey };
}

reports[dateKey][field] =
(reports[dateKey][field] || 0) + value;

};

/* =========================
LOAD ORDERS
========================= */

const ordersSnap = await getDocs(
collection(db,"orders")
);

for(const docSnap of ordersSnap.docs){

const o = docSnap.data();
const orderId = docSnap.id;

/* =========================
ORDER CREATED
========================= */

if(o.createdAt){

const dateKey = getDateKey(
o.createdAt.toDate()
);

const total = o.totals?.total || 0;

addValue(dateKey,"totalRevenue",total);
addValue(dateKey,"equipmentRevenue",total);

addValue(dateKey,"pendingAmount",total);

addValue(dateKey,"totalOrders",1);
addValue(dateKey,"equipmentOrders",1);

}

/* =========================
EXTENSIONS
========================= */

(o.items || []).forEach(item=>{

(item.extensionHistory || []).forEach(ext=>{

const dateKey = getDateKey(ext.date);

const amount = ext.extraPrice || 0;

addValue(dateKey,"totalRevenue",amount);
addValue(dateKey,"equipmentRevenue",amount);

addValue(dateKey,"totalExtensions",1);
addValue(dateKey,"equipmentExtensions",1);

addValue(dateKey,"totalExtensionRevenue",amount);
addValue(dateKey,"equipmentExtensionRevenue",amount);

addValue(dateKey,"pendingAmount",amount);

});

});

/* =========================
PAYMENTS
========================= */

const paySnap = await getDocs(
collection(db,"orders",orderId,"payments")
);

paySnap.forEach(p=>{

const pay = p.data();

const date =
pay.createdAt?.toDate?.() ||
new Date(pay.date);

const dateKey = getDateKey(date);

const amount = pay.amount || 0;

addValue(dateKey,"totalCollected",amount);
addValue(dateKey,"equipmentCollected",amount);

addValue(dateKey,"pendingAmount",-amount);

});

}

/* =========================
WRITE REPORTS
========================= */

for(const dateKey of Object.keys(reports)){

await setDoc(
doc(db,"reports_account_daily",dateKey),
reports[dateKey],
{ merge:true }
);

console.log("Report written:",dateKey);

}

console.log("Equipment report migration finished");

};