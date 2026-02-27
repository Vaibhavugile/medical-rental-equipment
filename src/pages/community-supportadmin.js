"use client";
import React, { useEffect, useState } from "react";

import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";

import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";

import { db, storage } from "../firebase";

export default function AdminCommunity() {

  /* ================= STATE ================= */

  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [type, setType] = useState("image");
  const [published, setPublished] =
    useState(true);
  const [order, setOrder] = useState(1);

  const [media, setMedia] = useState([]);
  const [uploading, setUploading] =
    useState(false);

  /* ================= FETCH ================= */

  const fetchMedia = async () => {
    const snapshot = await getDocs(
      collection(db, "community_support")
    );

    const data = snapshot.docs.map(
      (doc) => ({
        id: doc.id,
        ...doc.data(),
      })
    );

    setMedia(data);
  };

  useEffect(() => {
    fetchMedia();
  }, []);

  /* ================= UPLOAD ================= */

  const handleUpload = async () => {
    if (!file) {
      alert("Select file first");
      return;
    }

    try {
      setUploading(true);

      /* FILE PATH */
      const filePath =
        `community_support/${Date.now()}_${file.name}`;

      const fileRef = ref(
        storage,
        filePath
      );

      /* UPLOAD FILE */
      await uploadBytes(fileRef, file);

      /* GET URL */
      const downloadURL =
        await getDownloadURL(fileRef);

      /* SAVE FIRESTORE */
      await addDoc(
        collection(
          db,
          "community_support"
        ),
        {
          title,
          url: downloadURL,
          filePath,   // ⭐ important
          type,
          published,
          order: Number(order),
          createdAt:
            serverTimestamp(),
        }
      );

      /* RESET */
      setTitle("");
      setFile(null);
      setOrder(1);

      fetchMedia();

    } catch (err) {
      console.error(
        "Upload error:",
        err
      );
    } finally {
      setUploading(false);
    }
  };

  /* ================= DELETE ================= */

  const handleDelete = async (item) => {
    try {

      /* DELETE FILE FROM STORAGE */
      if (item.filePath) {
        const fileRef = ref(
          storage,
          item.filePath
        );

        await deleteObject(fileRef);
      }

      /* DELETE FIRESTORE DOC */
      await deleteDoc(
        doc(
          db,
          "community_support",
          item.id
        )
      );

      fetchMedia();

    } catch (err) {
      console.error(
        "Delete error:",
        err
      );
    }
  };

  /* ================= UI ================= */

  return (
    <div style={{ padding: 80 }}>

      <h1>
        Community Support Admin
      </h1>

      {/* ===== FORM ===== */}

      <div
        style={{
          display: "grid",
          gap: 12,
          maxWidth: 400,
          marginBottom: 40,
        }}
      >

        {/* TITLE */}
        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={(e) =>
            setTitle(e.target.value)
          }
        />

        {/* FILE */}
        <input
          type="file"
          accept="image/*,video/*"
          onChange={(e) =>
            setFile(e.target.files[0])
          }
        />

        {/* TYPE */}
        <select
          value={type}
          onChange={(e) =>
            setType(e.target.value)
          }
        >
          <option value="image">
            Image
          </option>
          <option value="video">
            Video
          </option>
        </select>

        {/* ORDER */}
        <input
          type="number"
          value={order}
          onChange={(e) =>
            setOrder(e.target.value)
          }
        />

        {/* PUBLISH */}
        <label>
          <input
            type="checkbox"
            checked={published}
            onChange={(e) =>
              setPublished(
                e.target.checked
              )
            }
          />
          Published
        </label>

        {/* BUTTON */}
        <button
          onClick={handleUpload}
          disabled={uploading}
        >
          {uploading
            ? "Uploading..."
            : "Upload Media"}
        </button>

      </div>

      {/* ===== MEDIA LIST ===== */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fill,minmax(200px,1fr))",
          gap: 20,
        }}
      >

        {media.map((item) => (
          <div key={item.id}>

            {item.type === "image" ? (
              <img
                src={item.url}
                style={{
                  width: "100%",
                  height: 140,
                  objectFit: "cover",
                }}
              />
            ) : (
              <video
                src={item.url}
                style={{
                  width: "100%",
                  height: 140,
                }}
              />
            )}

            <p>{item.title}</p>

            <button
              onClick={() =>
                handleDelete(item)
              }
            >
              Delete
            </button>

          </div>
        ))}

      </div>

    </div>
  );
}
