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

import "./AdminProviders.css";

export default function AdminProviders() {

  /* ================= STATES ================= */

  const [file, setFile] = useState(null);
  const [providers, setProviders] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  /* ================= FETCH PROVIDERS ================= */

  const fetchProviders = async () => {
    try {
      const snapshot = await getDocs(
        collection(db, "providers")
      );

      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setProviders(data);

    } catch (err) {
      console.error("Providers fetch error:", err);
    }
  };

  useEffect(() => {
    fetchProviders();
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
      return alert("Select logo first");

    setUploading(true);

    const storageRef = ref(
      storage,
      `providers/${Date.now()}-${file.name}`
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
          collection(db, "providers"),
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

        fetchProviders();
      }
    );
  };

  /* ================= DELETE ================= */

  const handleDelete = async (id) => {

    if (!window.confirm("Delete this provider?"))
      return;

    await deleteDoc(
      doc(db, "providers", id)
    );

    fetchProviders();
  };

  /* ================= TOGGLE ================= */

  const togglePublish = async (item) => {

    await updateDoc(
      doc(db, "providers", item.id),
      {
        published: !item.published,
      }
    );

    fetchProviders();
  };

  /* ================= UI ================= */

  return (
    <div className="adminProviders">

      <h1>Trusted Providers Manager</h1>

      {/* UPLOAD */}
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
            : "Upload Logo"}
        </button>

      </div>

      {/* PROGRESS */}
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

      {/* GRID */}
      <div className="providersGrid">

        {providers.map((item) => (
          <div
            key={item.id}
            className="providerCard"
          >

            <img
              src={item.logo}
              alt="Provider Logo"
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
