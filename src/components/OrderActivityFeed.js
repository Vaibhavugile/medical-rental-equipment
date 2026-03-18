import React, { useEffect, useState } from "react";
import {
    collection,
    getDocs,
    query,
    where
} from "firebase/firestore";

import { db } from "../firebase";
import OrderActivityModal from "../components/OrderActivityModal";

import "./OrderActivityFeed.css";

export default function OrderActivityFeed({ startDate, endDate }) {

    const [activities, setActivities] = useState([]);
    const [filtered, setFiltered] = useState([]);

    const [loading, setLoading] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);

    /* FILTER STATES */

    const [search, setSearch] = useState("");
    const [serviceFilter, setServiceFilter] = useState("all");
    const [eventFilter, setEventFilter] = useState("all");
    const [sortBy, setSortBy] = useState("latest");

    /* LOAD DATA */

    useEffect(() => {
        if (startDate && endDate) {
            loadActivities();
        }
    }, [startDate, endDate]);

    /* APPLY FILTERS */

    useEffect(() => {
        applyFilters();
    }, [activities, search, serviceFilter, eventFilter, sortBy]);

    /* ===============================
    LOAD ACTIVITIES
    ================================ */

    const loadActivities = async () => {

        setLoading(true);

        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);

        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        try {

            const queries = [

                // EQUIPMENT
                query(collection(db, "orders"),
                    where("createdAt", ">=", start),
                    where("createdAt", "<=", end)
                ),
                query(collection(db, "orders"),
                    where("lastPaymentAt", ">=", start),
                    where("lastPaymentAt", "<=", end)
                ),
                query(collection(db, "orders"),
                    where("lastExtendedAt", ">=", start),
                    where("lastExtendedAt", "<=", end)
                ),
                query(collection(db, "orders"),
                    where("lastStoppedAt", ">=", start),
                    where("lastStoppedAt", "<=", end)
                ),
                query(collection(db, "orders"),
                    where("lastRefundedAt", ">=", start),
                    where("lastRefundedAt", "<=", end)
                ),

                // NURSING
                query(collection(db, "nursingOrders"),
                    where("createdAt", ">=", start),
                    where("createdAt", "<=", end)
                ),
                query(collection(db, "nursingOrders"),
                    where("lastPaymentAt", ">=", start),
                    where("lastPaymentAt", "<=", end)
                ),
                query(collection(db, "nursingOrders"),
                    where("lastExtendedAt", ">=", start),
                    where("lastExtendedAt", "<=", end)
                ),
                query(collection(db, "nursingOrders"),
                    where("lastStoppedAt", ">=", start),
                    where("lastStoppedAt", "<=", end)
                ),
                query(collection(db, "nursingOrders"),
                    where("lastRefundedAt", ">=", start),
                    where("lastRefundedAt", "<=", end)
                )

            ];

            const snaps = await Promise.all(
                queries.map(q => getDocs(q))
            );

            let raw = [];

            snaps.forEach((snap, index) => {

                snap.forEach(docSnap => {

                    const o = docSnap.data();

                    const collectionName =
                        index < 5 ? "orders" : "nursingOrders";

                    const serviceType =
                        collectionName === "orders"
                            ? "equipment"
                            : (o.serviceType || "nursing");

                    raw.push({

                        id: docSnap.id,
                        collection: collectionName,

                        orderNo: o.orderNo,

                        customerName: o.customerName,
                        customerPhone: o.customerPhone,

                        start: o.items?.[0]?.expectedStartDate || "",
                        end: o.items?.[0]?.expectedEndDate || "",

                        total: o.totals?.total || 0,

                        serviceType,

                        createdAt: o.createdAt?.toDate?.(),
                        lastPaymentAt: o.lastPaymentAt?.toDate?.(),
                        lastExtendedAt: o.lastExtendedAt?.toDate?.(),
                        lastStoppedAt: o.lastStoppedAt?.toDate?.(),
                        lastRefundedAt: o.lastRefundedAt?.toDate?.(),
                    });

                });

            });

            /* PICK LATEST EVENT */

            const map = {};

            raw.forEach(o => {

                let latest = null;
                let label = "";

                if (o.createdAt && o.createdAt >= start && o.createdAt <= end) {
                    latest = o.createdAt;
                    label = "created";
                }

                if (o.lastPaymentAt && o.lastPaymentAt >= start && o.lastPaymentAt <= end) {
                    if (!latest || o.lastPaymentAt > latest) {
                        latest = o.lastPaymentAt;
                        label = "payment";
                    }
                }

                if (o.lastExtendedAt && o.lastExtendedAt >= start && o.lastExtendedAt <= end) {
                    if (!latest || o.lastExtendedAt > latest) {
                        latest = o.lastExtendedAt;
                        label = "extended";
                    }
                }
                /* 🔥 STOPPED */
                if (o.lastStoppedAt && o.lastStoppedAt >= start && o.lastStoppedAt <= end) {
                    if (!latest || o.lastStoppedAt > latest) {
                        latest = o.lastStoppedAt;
                        label = "stopped";
                    }
                }

                /* 🔥 REFUND */
                if (o.lastRefundedAt && o.lastRefundedAt >= start && o.lastRefundedAt <= end) {
                    if (!latest || o.lastRefundedAt > latest) {
                        latest = o.lastRefundedAt;
                        label = "refund";
                    }
                }

                if (!latest) return;

                const key = o.orderNo;

                if (!map[key] || map[key].date < latest) {

                    map[key] = {
                        ...o,
                        label,
                        date: latest
                    };

                }

            });

            const result = Object.values(map);

            result.sort((a, b) => b.date - a.date);

            setActivities(result);

        } catch (err) {
            console.error(err);
        }

        setLoading(false);

    };

    /* ===============================
    FILTER + SEARCH + SORT
    ================================ */

    const applyFilters = () => {

        let data = [...activities];

        /* SEARCH */

        if (search) {

            const s = search.toLowerCase();

            data = data.filter(a =>
                a.orderNo?.toLowerCase().includes(s) ||
                a.customerName?.toLowerCase().includes(s) ||
                a.customerPhone?.includes(s)
            );

        }

        /* SERVICE FILTER */

        if (serviceFilter !== "all") {
            data = data.filter(a => a.serviceType === serviceFilter);
        }

        /* EVENT FILTER */

        if (eventFilter !== "all") {
            data = data.filter(a => a.label === eventFilter);
        }

        /* SORTING */

        if (sortBy === "latest") {
            data.sort((a, b) => b.date - a.date);
        }

        if (sortBy === "oldest") {
            data.sort((a, b) => a.date - b.date);
        }

        if (sortBy === "highest") {
            data.sort((a, b) => b.total - a.total);
        }

        if (sortBy === "lowest") {
            data.sort((a, b) => a.total - b.total);
        }

        setFiltered(data);

    };

    /* ===============================
    HELPERS
    ================================ */

    const fmt = d => new Date(d).toLocaleString();

    const getLabel = type => {

        if (type === "created")
            return <span className="badge created">Created</span>;

        if (type === "payment")
            return <span className="badge payment">Payment</span>;

        if (type === "extended")
            return <span className="badge extended">Extended</span>;
        if (type === "stopped")
            return <span className="badge stopped">Stopped</span>;

        if (type === "refund")
            return <span className="badge refund">Refund</span>;


    };

    /* ===============================
    UI
    ================================ */

    return (

        <div className="activity-card">

            <h2 className="activity-title">Order Activity</h2>

            {/* FILTER BAR */}

            <div className="activity-toolbar">

                <input
                    type="text"
                    placeholder="Search order / customer / phone"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="activity-search"
                />

                <select
                    value={serviceFilter}
                    onChange={e => setServiceFilter(e.target.value)}
                >

                    <option value="all">All Services</option>
                    <option value="equipment">Equipment</option>
                    <option value="nursing">Nursing</option>
                    <option value="caretaker">Caretaker</option>

                </select>

                <select
                    value={eventFilter}
                    onChange={e => setEventFilter(e.target.value)}
                >

                    <option value="all">All Events</option>
                    <option value="created">Created</option>
                    <option value="payment">Payment</option>
                    <option value="extended">Extended</option>
                    <option value="stopped">Stopped</option>
                    <option value="refund">Refund</option>

                </select>

                <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value)}
                >

                    <option value="latest">Latest</option>
                    <option value="oldest">Oldest</option>
                    <option value="highest">Highest Value</option>
                    <option value="lowest">Lowest Value</option>

                </select>

            </div>

            {loading && <div>Loading...</div>}

            <table className="activity-table">

                <thead>

                    <tr>
                        <th>Order</th>
                        <th>Customer</th>
                        <th>Service</th>
                        <th>Start</th>
                        <th>End</th>
                        <th>Total</th>
                        <th>Event</th>
                        <th>Date</th>
                    </tr>

                </thead>

                <tbody>

                    {filtered.map((a, i) => (

                        <tr
                            key={i}
                            className="activity-row"
                            onClick={() => setSelectedOrder(a)}
                        >

                            <td>{a.orderNo}</td>

                            <td>
                                <div>{a.customerName}</div>
                                <div className="cust-phone">{a.customerPhone}</div>
                            </td>

                            <td>{a.serviceType}</td>

                            <td>{a.start}</td>

                            <td>{a.end}</td>

                            <td className="amount">₹{a.total}</td>

                            <td>{getLabel(a.label)}</td>

                            <td>{fmt(a.date)}</td>

                        </tr>

                    ))}

                </tbody>

            </table>

            <OrderActivityModal
                order={selectedOrder}
                onClose={() => setSelectedOrder(null)}
            />

        </div>

    );

}