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

import imageCompression from "browser-image-compression";

import { db, storage } from "../firebase";

import "./GalleryManager.css";

export default function GalleryManager() {

  const [files, setFiles] = useState([]);
  const [gallery, setGallery] = useState([]);
  const [progress, setProgress] = useState({});
  const [uploading, setUploading] = useState(false);

  /* ⭐ CATEGORY STATES */
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState([]);

  /* ⭐ EDIT STATES */
  const [editCategories, setEditCategories] = useState({});
  const [editingId, setEditingId] = useState(null);

  /* ================= FETCH ================= */

  const fetchGallery = async () => {
    const snapshot = await getDocs(collection(db, "gallery"));

    const data = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    setGallery(data);

    /* UNIQUE CATEGORY LIST */
    const unique = [
      ...new Set(
        data.map((i) => i.category).filter(Boolean)
      ),
    ];

    setCategories(unique);
  };

  useEffect(() => {
    fetchGallery();
  }, []);

  /* ================= FILE SELECT ================= */

  const handleFiles = (e) => {
    setFiles(Array.from(e.target.files));
  };

  /* ================= COMPRESS IMAGE ================= */

  const compressImage = async (file) => {
    const options = {
      maxSizeMB: 0.7,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
    };

    try {
      const blob = await imageCompression(file, options);

      return new File([blob], file.name, {
        type: file.type,
      });
    } catch {
      return file;
    }
  };

  /* ================= UPLOAD ================= */

  const handleUpload = async () => {
    if (!files.length) return alert("Select files");
    if (!category) return alert("Enter category");

    setUploading(true);

    let completed = 0;

    files.forEach(async (file) => {
      const isVideo = file.type.startsWith("video");
      let uploadFile = file;

      if (!isVideo) {
        uploadFile = await compressImage(file);
      }

      const storageRef = ref(
        storage,
        `gallery/${Date.now()}-${uploadFile.name}`
      );

      const uploadTask = uploadBytesResumable(
        storageRef,
        uploadFile
      );

      uploadTask.on(
        "state_changed",

        /* PROGRESS */
        (snapshot) => {
          const percent =
            (snapshot.bytesTransferred /
              snapshot.totalBytes) *
            100;

          setProgress((prev) => ({
            ...prev,
            [file.name]: percent.toFixed(0),
          }));
        },

        console.error,

        /* COMPLETE */
        async () => {
          const url = await getDownloadURL(
            uploadTask.snapshot.ref
          );

          await addDoc(collection(db, "gallery"), {
            type: isVideo ? "video" : "image",
            url,
            category,
            published: true,
            order: Date.now(),
            createdAt: serverTimestamp(),
          });

          completed++;

          if (completed === files.length) {
            setUploading(false);
            setFiles([]);
            setProgress({});
            setCategory("");
            fetchGallery();
          }
        }
      );
    });
  };

  /* ================= DELETE ================= */

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this media?")) return;

    await deleteDoc(doc(db, "gallery", id));
    fetchGallery();
  };

  /* ================= TOGGLE ================= */

  const togglePublish = async (item) => {
    await updateDoc(doc(db, "gallery", item.id), {
      published: !item.published,
    });

    fetchGallery();
  };

  /* ================= START EDIT ================= */

  const startEdit = (item) => {
    setEditingId(item.id);

    setEditCategories((prev) => ({
      ...prev,
      [item.id]: item.category || "",
    }));
  };

  /* ================= CHANGE ================= */

  const handleCategoryChange = (id, value) => {
    setEditCategories((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  /* ================= SAVE ================= */

  const saveCategory = async (id) => {
    const newCategory = editCategories[id];

    if (!newCategory) return alert("Enter category");

    await updateDoc(doc(db, "gallery", id), {
      category: newCategory,
    });

    setEditingId(null); // exit edit mode
    fetchGallery();
  };

  /* ================= UI ================= */

  return (
    <div className="admin-gallery">

      <h1>Gallery Manager</h1>

      {/* ================= UPLOAD ================= */}

      <div className="upload-box">

        <input
          type="text"
          placeholder="Enter category"
          value={category}
          onChange={(e) =>
            setCategory(e.target.value)
          }
          disabled={uploading}
        />

        {categories.length > 0 && (
          <select
            onChange={(e) =>
              setCategory(e.target.value)
            }
            disabled={uploading}
          >
            <option value="">
              Select Existing
            </option>

            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        )}

        <input
          type="file"
          multiple
          accept="image/*,video/*"
          onChange={handleFiles}
          disabled={uploading}
        />

        <button
          onClick={handleUpload}
          disabled={uploading}
        >
          {uploading
            ? "Uploading..."
            : "Upload Files"}
        </button>

      </div>

      {/* ================= PROGRESS ================= */}

      {files.map((file) => (
        <div
          key={file.name}
          className="progress-row"
        >
          <span>
            {file.name} —{" "}
            {progress[file.name] || 0}%
          </span>

          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${
                  progress[file.name] || 0
                }%`,
              }}
            />
          </div>
        </div>
      ))}

      {/* ================= GRID ================= */}

      <div className="gallery-grid">

        {gallery.map((item) => (
          <div
            key={item.id}
            className="gallery-card"
          >

            {/* MEDIA */}
            {item.type === "image" ? (
              <img src={item.url} alt="" />
            ) : (
              <video
                src={item.url}
                controls
              />
            )}

            {/* ================= CATEGORY ================= */}

            {editingId === item.id ? (

              /* ===== EDIT MODE ===== */
              <div className="category-edit-box">

                <input
                  type="text"
                  value={
                    editCategories[item.id] ?? ""
                  }
                  onChange={(e) =>
                    handleCategoryChange(
                      item.id,
                      e.target.value
                    )
                  }
                />

                <button
                  className="save-category"
                  onClick={() =>
                    saveCategory(item.id)
                  }
                >
                  Save
                </button>

              </div>

            ) : (

              /* ===== VIEW MODE ===== */
              <div className="category-view-box">

                <span className="category-text">
                  {item.category ||
                    "No Category"}
                </span>

                <button
                  className="edit-category"
                  onClick={() =>
                    startEdit(item)
                  }
                >
                  Edit
                </button>

              </div>

            )}

            {/* STATUS */}

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

            {/* ACTIONS */}

            <div className="card-actions">

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
