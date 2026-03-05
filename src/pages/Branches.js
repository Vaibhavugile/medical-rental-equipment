// src/pages/Branches.jsx
import React, { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  deleteDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import "./Branches.css";

export default function Branches() {
  const [branchList, setBranchList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeBranch, setActiveBranch] = useState(null);
  const [formState, setFormState] = useState({
    branchName: "",
    branchAddress: "",
    branchContact: "",
    branchPhone: "",
  });
  const [formError, setFormError] = useState("");

  useEffect(() => {
    setIsLoading(true);
    const q = query(collection(db, "branches"), orderBy("name", "asc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        setBranchList(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }))
        );
        setIsLoading(false);
      },
      (err) => {
        console.error("branches snapshot error", err);
        setFormError(err?.message || "Unable to load branches");
        setIsLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const resetForm = () => {
    setActiveBranch(null);
    setFormState({
      branchName: "",
      branchAddress: "",
      branchContact: "",
      branchPhone: "",
    });
    setFormError("");
  };

  const editBranch = (branch) => {
    setActiveBranch(branch);
    setFormState({
      branchName: branch.name || "",
      branchAddress: branch.address || "",
      branchContact: branch.contact || "",
      branchPhone: branch.phone || "",
    });
    setFormError("");
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError("");

    if (!formState.branchName.trim()) {
      return setFormError("Branch name is required");
    }

    const user = auth.currentUser || {};

    try {
      if (activeBranch) {
        await updateDoc(doc(db, "branches", activeBranch.id), {
          name: formState.branchName,
          address: formState.branchAddress,
          contact: formState.branchContact,
          phone: formState.branchPhone,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid || "",
        });
      } else {
        await addDoc(collection(db, "branches"), {
          name: formState.branchName,
          address: formState.branchAddress,
          contact: formState.branchContact,
          phone: formState.branchPhone,
          createdAt: serverTimestamp(),
          createdBy: user.uid || "",
        });
      }

      resetForm();
    } catch (err) {
      console.error("branch save error", err);
      setFormError(err.message || "Failed to save branch");
    }
  };

  const deleteBranch = async (branch) => {
    if (!window.confirm(`Delete branch "${branch.name}"?`)) return;
    try {
      await deleteDoc(doc(db, "branches", branch.id));
    } catch (err) {
      console.error("delete branch error", err);
      setFormError(err.message || "Delete failed");
    }
  };

  return (
    <div className="branch-layout">
      <div className="branch-header">
        <h2>Branch Locations</h2>
        <p className="branch-subtext">
          Manage inventory storage locations.
        </p>
      </div>

      {formError && (
        <div className="branch-alert" role="alert">
          {formError}
        </div>
      )}

      <div className="branch-grid">
        {/* LEFT SIDE */}
        <div className="branch-list-panel">
          <button className="branch-primary-btn" onClick={resetForm}>
            + Create Branch
          </button>

          {isLoading ? (
            <div className="branch-loading">Loading...</div>
          ) : (
            <div className="branch-card-grid">
              {branchList.map((b) => (
                <div key={b.id} className="branch-item">
                  <div className="branch-item-title">{b.name}</div>
                  <div className="branch-item-meta">
                    {b.address || "No address"}
                  </div>
                  <div className="branch-item-meta">
                    {b.contact || b.phone
                      ? `${b.contact || ""} ${b.phone ? " · " + b.phone : ""}`
                      : "No contact info"}
                  </div>

                  <div className="branch-item-actions">
                    <button
                      className="branch-outline-btn"
                      onClick={() => editBranch(b)}
                    >
                      Edit
                    </button>
                    <button
                      className="branch-danger-btn"
                      onClick={() => deleteBranch(b)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}

              {branchList.length === 0 && (
                <div className="branch-empty">
                  No branches created yet.
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT SIDE */}
        <div className="branch-form-panel">
          <form onSubmit={handleSave} className="branch-form-card">
            <h3>
              {activeBranch
                ? `Editing: ${activeBranch.name}`
                : "Create New Branch"}
            </h3>

            <div className="branch-field">
              <label>Branch Name</label>
              <input
                value={formState.branchName}
                onChange={(e) =>
                  setFormState({ ...formState, branchName: e.target.value })
                }
              />
            </div>

            <div className="branch-field">
              <label>Address</label>
              <input
                value={formState.branchAddress}
                onChange={(e) =>
                  setFormState({ ...formState, branchAddress: e.target.value })
                }
              />
            </div>

            <div className="branch-field">
              <label>Contact</label>
              <input
                value={formState.branchContact}
                onChange={(e) =>
                  setFormState({ ...formState, branchContact: e.target.value })
                }
              />
            </div>

            <div className="branch-field">
              <label>Phone</label>
              <input
                value={formState.branchPhone}
                onChange={(e) =>
                  setFormState({ ...formState, branchPhone: e.target.value })
                }
              />
            </div>

            <div className="branch-form-actions">
              <button className="branch-primary-btn" type="submit">
                Save
              </button>
              <button
                type="button"
                className="branch-outline-btn"
                onClick={resetForm}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}