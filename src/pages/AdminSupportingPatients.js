"use client";
import React, { useEffect, useState } from "react";

import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";

import { db, storage } from "../firebase";

import "./AdminSupportingPatients.css";

export default function AdminSupportingPatients() {

  /* ================= STATES ================= */

  const [file, setFile] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  /* ================= FETCH ================= */

  const fetchHospitals = async () => {
    try {
      const snapshot = await getDocs(
        collection(db, "supportingPatients")
      );

      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setHospitals(data);

    } catch (err) {
      console.error("Hospitals fetch error:", err);
    }
  };

  useEffect(() => {
    fetchHospitals();
  }, []);

  /* ================= FILE SELECT ================= */

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  /* ================= UPLOAD ================= */

  const handleUpload = async () => {

    if (!file)
      return alert("Select hospital logo first");

    setUploading(true);

    const storageRef = ref(
      storage,
      `supportingPatients/${Date.now()}-${file.name}`
    );

    const uploadTask =
      uploadBytesResumable(storageRef, file);

    uploadTask.on(
      "state_changed",

      /* PROGRESS */
      (snapshot) => {
        const percent =
          (snapshot.bytesTransferred /
            snapshot.totalBytes) *
          100;

        setProgress(percent.toFixed(0));
      },

      /* ERROR */
      (error) => {
        console.error(error);
        setUploading(false);
      },

      /* COMPLETE */
      async () => {

        const url = await getDownloadURL(
          uploadTask.snapshot.ref
        );

        await addDoc(
          collection(db, "supportingPatients"),
          {
            logo: url,
            published: true,
            order: Date.now(),
            createdAt: serverTimestamp(),
          }
        );

        setUploading(false);
        setProgress(0);
        setFile(null);

        fetchHospitals();
      }
    );
  };

  /* ================= DELETE ================= */

  const handleDelete = async (id) => {

    if (!window.confirm("Delete this hospital?"))
      return;

    await deleteDoc(
      doc(db, "supportingPatients", id)
    );

    fetchHospitals();
  };

  /* ================= TOGGLE ================= */

  const togglePublish = async (item) => {

    await updateDoc(
      doc(db, "supportingPatients", item.id),
      {
        published: !item.published,
      }
    );

    fetchHospitals();
  };

  /* ================= UI ================= */

  return (
    <div className="adminSupporting">

      <h1>Supporting Patients Manager</h1>

      {/* ===== UPLOAD ===== */}
      <div className="uploadBox">

        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={uploading}
        />

        <button
          onClick={handleUpload}
          disabled={uploading}
        >
          {uploading
            ? "Uploading..."
            : "Upload Hospital Logo"}
        </button>

      </div>

      {/* ===== PROGRESS ===== */}
      {uploading && (
        <div className="progressWrapper">

          <div className="progressBar">
            <div
              className="progressFill"
              style={{
                width: `${progress}%`,
              }}
            />
          </div>

          <span>{progress}%</span>

        </div>
      )}

      {/* ===== GRID ===== */}
      <div className="hospitalsGrid">

        {hospitals.map((item) => (
          <div
            key={item.id}
            className="hospitalCard"
          >

            <img
              src={item.logo}
              alt="Hospital Logo"
            />

            <span
              className={`status ${
                item.published
                  ? "published"
                  : "hidden"
              }`}
            >
              {item.published
                ? "Published"
                : "Hidden"}
            </span>

            <div className="actions">

              <button
                className="toggle"
                onClick={() =>
                  togglePublish(item)
                }
              >
                Toggle
              </button>

              <button
                className="delete"
                onClick={() =>
                  handleDelete(item.id)
                }
              >
                Delete
              </button>

            </div>

          </div>
        ))}

      </div>

    </div>
  );
}
