// src/pages/TeamPage.jsx
import React, { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import "./TeamPage.css";
import TopBar from "../frontend/TopBar";
import Header from "../frontend/Header";
import TEAM_MEMBERS from "./team_members"; // <-- imported

export default function TeamPage() {
  const [query, setQuery] = useState("");
  const [specialty, setSpecialty] = useState("all");

  const specialties = useMemo(() => {
    const s = new Set(TEAM_MEMBERS.map((m) => m.specialty));
    return ["all", ...Array.from(s)];
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TEAM_MEMBERS.filter((m) => {
      if (specialty !== "all" && m.specialty !== specialty) return false;
      if (!q) return true;
      return (m.name + " " + m.title + " " + (m.bio || "")).toLowerCase().includes(q);
    });
  }, [query, specialty]);

  useEffect(() => {
    document.title = "Our Medical Team | BookMyMedicare";
  }, []);

  return (
    <div className="tp-page">
      <TopBar />
      <Header />

      <main className="tp-main">
        <section className="tp-hero">
          <div className="tp-hero-inner">
            <div className="tp-hero-copy">
              <div className="tp-eyebrow">MEET OUR EXECUTIVE TEAM</div>
              <h1 className="tp-title">Committed to Providing the Best Care & Support</h1>
              <p className="tp-lead">Our multidisciplinary team of doctors, therapists and technical staff deliver hospital-grade care at home — empathetic, available and clinically governed.</p>
            </div>
          </div>
        </section>

        <section className="tp-controls container">
          <div className="tp-controls-left">
            <label className="tp-search">
              <input
                type="search"
                placeholder="Search doctors, specialties or keywords"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search team"
              />
            </label>
          </div>
          <div className="tp-controls-right">
            <label className="tp-filter">
              <span className="sr-only">Filter by specialty</span>
              <select value={specialty} onChange={(e) => setSpecialty(e.target.value)} aria-label="Filter by specialty">
                {specialties.map((s) => <option key={s} value={s}>{s === "all" ? "All specialties" : s}</option>)}
              </select>
            </label>
          </div>
        </section>

        <section className="tp-grid container" aria-live="polite">
          {filtered.length === 0 ? (
            <div className="tp-empty">No team members found matching your search.</div>
          ) : (
            <ul className="tp-list" role="list">
              {filtered.map((m, idx) => (
                <li key={m.key} className="tp-item">
                  <Link to={`/team/${m.key}`} className="tp-card" style={{ ["--i"]: idx }} aria-label={`${m.name} profile`}>
                    <div className="tp-avatar-wrap">
                      <img className="tp-avatar" src={`/team/${m.key}.jpg`} alt={m.name} onError={(e) => { e.currentTarget.src = "/team/placeholder.jpg"; }} />
                    </div>

                    <div className="tp-info">
                      <div className="tp-name">{m.name}</div>
                      <div className="tp-title">{m.title}</div>
                      <div className="tp-specialty">{m.specialty}</div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
