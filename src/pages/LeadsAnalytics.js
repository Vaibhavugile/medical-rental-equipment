import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import './LeadsAnalytics.css';
export default function LeadsAnalytics() {

  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
const [openCreator, setOpenCreator] = useState(null);
const [openSource, setOpenSource] = useState(null);
  /* =========================
     LOAD LEADS
  ========================= */

  useEffect(() => {

    const q = query(
      collection(db, "leads"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {

      const list = snap.docs.map(d => ({
        id: d.id,
        ...(d.data() || {})
      }));

      setLeads(list);
      setLoading(false);

    });

    return () => unsub();

  }, []);
  const formatSource = (text = "") => {
  return text
    .toLowerCase()
    .split(" ")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
};

  /* =========================
     SUMMARY
  ========================= */

  const summary = useMemo(() => {

    const total = leads.length;

    let valid = 0;
    let followup = 0;
    let reqShared = 0;

    leads.forEach(l => {

      const s = (l.status || "").toLowerCase();

      if (s === "valid" || s === "interested") valid++;
      if (s === "followup") followup++;
      if (s === "req shared") reqShared++;

    });

    return { total, valid, followup, reqShared };

  }, [leads]);

  /* =========================
     TOP CREATORS
  ========================= */

 const creators = useMemo(() => {

  const map = {};

  leads.forEach(l => {

    const creator = l.createdByName || "Unknown";
    const status = (l.status || "unknown").toLowerCase();

    if (!map[creator]) {
      map[creator] = {
        total: 0,
        statuses: {}
      };
    }

    map[creator].total++;

    if (!map[creator].statuses[status]) {
      map[creator].statuses[status] = 0;
    }

    map[creator].statuses[status]++;

  });

  return Object.entries(map)
    .map(([name,data]) => ({
      name,
      total: data.total,
      statuses: data.statuses
    }))
    .sort((a,b)=>b.total-a.total);

}, [leads]);
  /* =========================
     LEAD SOURCES
  ========================= */

  const sources = useMemo(() => {

  const map = {};

  leads.forEach(l => {

    const srcRaw = (l.leadSource || "Unknown").trim();
    const srcKey = srcRaw.toLowerCase();

    const status = (l.status || "unknown").toLowerCase();

    if (!map[srcKey]) {
      map[srcKey] = {
        name: srcRaw.charAt(0).toUpperCase() + srcRaw.slice(1),
        total: 0,
        statuses: {}
      };
    }

    map[srcKey].total++;

    if (!map[srcKey].statuses[status]) {
      map[srcKey].statuses[status] = 0;
    }

    map[srcKey].statuses[status]++;

  });

  return Object.values(map)
    .sort((a,b)=>b.total-a.total);

}, [leads]);

  /* =========================
     STATUS BREAKDOWN
  ========================= */

  

  /* =========================
     EXPORT ANALYTICS
  ========================= */

  const exportAnalytics = () => {

    const rows = creators.map(c => ({
      Creator: c.name,
      Leads: c.count
    }));

    const headers = Object.keys(rows[0]);

    const escapeCSV = (v) =>
      `"${String(v ?? "").replace(/"/g,'""')}"`;

    const csv = [
      headers.join(","),
      ...rows.map(r =>
        headers.map(h => escapeCSV(r[h])).join(",")
      )
    ].join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "leads_analytics.csv";
    a.click();

    URL.revokeObjectURL(url);

  };

  if (loading) {
    return <div style={{padding:30}}>Loading analytics...</div>;
  }

  return (

<div className="analytics-page">

  <div className="analytics-header">

    <h2>Leads Analytics</h2>

    <button
      className="cp-btn ghost"
      onClick={exportAnalytics}
    >
      Export
    </button>

  </div>


  {/* TOP LEAD CREATORS */}

  <div className="analytics-card">

    <h3>🏆 Top Lead Creators</h3>
{creators.map((c,i)=>{

  const isOpen = openCreator === i;

  return (

    <div key={i} className="creator-block">

      <div
        className="creator-header clickable"
        onClick={() =>
          setOpenCreator(isOpen ? null : i)
        }
      >

        <span className="rank">#{i+1}</span>

        <span className="name">{c.name}</span>

        <span className="count">{c.total}</span>

        <span className="arrow">
          {isOpen ? "▲" : "▼"}
        </span>

      </div>


      {isOpen && (

        <div className="status-breakdown">

          {Object.entries(c.statuses).map(([status,count]) => (

            <div key={status} className="status-row">

              <span>{status}</span>

              <strong>{count}</strong>

            </div>

          ))}

        </div>

      )}

    </div>

  );

})}

  </div>


  {/* LEAD SOURCES */}

  <div className="analytics-card">

    <h3>📢 Lead Sources</h3>

   {sources.map((s,i)=>{

  const isOpen = openSource === i;

  return(

    <div key={i} className="creator-block">

      <div
        className="creator-header clickable"
        onClick={() =>
          setOpenSource(isOpen ? null : i)
        }
      >

        <span className="name">{s.name}</span>

        <span className="count">{s.total}</span>

        <span className="arrow">
          {isOpen ? "▲" : "▼"}
        </span>

      </div>

      {isOpen && (

        <div className="status-breakdown">

          {Object.entries(s.statuses).map(([status,count]) => (

            <div key={status} className="status-row">

              <span>{status}</span>

              <strong>{count}</strong>

            </div>

          ))}

        </div>

      )}

    </div>

  )

})}
  </div>

</div>

);
}