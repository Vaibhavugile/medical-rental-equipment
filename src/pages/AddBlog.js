import React, { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useNavigate } from "react-router-dom";
import { db, storage } from "../firebase";

/* ================= RICH TEXT EDITOR (REACT 19 SAFE) ================= */
function RichTextEditor({ value, onChange }) {
  return (
    <div
      contentEditable
      suppressContentEditableWarning
      onInput={(e) => onChange(e.currentTarget.innerHTML)}
      dangerouslySetInnerHTML={{ __html: value }}
      style={{
        minHeight: "260px",
        padding: "14px",
        border: "1px solid #d1d5db",
        borderRadius: "10px",
        background: "#ffffff",
        fontSize: "16px",
        lineHeight: "1.65",
        outline: "none"
      }}
    />
  );
}

export default function AddBlog() {
  const navigate = useNavigate();

  const [blog, setBlog] = useState({
    title: "",
    slug: "",
    metaTitle: "",
    metaDescription: "",
    image: "",
    content: "",
    published: false
  });

  const [uploading, setUploading] = useState(false);

  /* ================= SLUG GENERATOR ================= */
  const generateSlug = (text) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, "")
      .replace(/\s+/g, "-")
      .trim();

  /* ================= INPUT HANDLER ================= */
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name === "title") {
      const slug = generateSlug(value);
      setBlog((prev) => ({
        ...prev,
        title: value,
        slug,
        metaTitle: `${value} | BookMyMedicare`
      }));
    } else {
      setBlog((prev) => ({
        ...prev,
        [name]: type === "checkbox" ? checked : value
      }));
    }
  };

  /* ================= IMAGE UPLOAD ================= */
  const handleImageUpload = async (file) => {
    if (!file) return;

    try {
      setUploading(true);

      const imageRef = ref(
        storage,
        `blogs/${Date.now()}-${file.name}`
      );

      await uploadBytes(imageRef, file);
      const url = await getDownloadURL(imageRef);

      setBlog((prev) => ({ ...prev, image: url }));
    } catch (err) {
      console.error("Image upload failed:", err);
      alert("Image upload failed.");
    } finally {
      setUploading(false);
    }
  };

  /* ================= SUBMIT ================= */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!blog.title || !blog.slug || !blog.content) {
      alert("Title, slug, and content are required.");
      return;
    }

    try {
      await addDoc(collection(db, "blogs"), {
        ...blog,
        author: "BookMyMedicare Team",
        createdAt: serverTimestamp()
      });

      alert("Blog saved successfully!");
      navigate("/blogs");
    } catch (err) {
      console.error("Error saving blog:", err);
      alert("Failed to save blog.");
    }
  };

  /* ================= UI ================= */
  return (
    <main style={{ padding: "80px 4vw", maxWidth: "900px", margin: "0 auto" }}>
      <h1>Add New Blog</h1>

      <form
        onSubmit={handleSubmit}
        style={{ display: "grid", gap: "18px", marginTop: "24px" }}
      >
        {/* Title */}
        <input
          name="title"
          placeholder="Blog Title"
          value={blog.title}
          onChange={handleChange}
          required
        />

        {/* Slug */}
        <input
          name="slug"
          placeholder="Slug (auto-generated)"
          value={blog.slug}
          onChange={handleChange}
          required
        />

        {/* Meta Title */}
        <input
          name="metaTitle"
          placeholder="Meta Title"
          value={blog.metaTitle}
          onChange={handleChange}
        />

        {/* Meta Description */}
        <textarea
          name="metaDescription"
          placeholder="Meta Description (SEO)"
          value={blog.metaDescription}
          onChange={handleChange}
          rows={3}
        />

        {/* Image Upload */}
        <div>
          <label style={{ fontWeight: 700 }}>Featured Image</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleImageUpload(e.target.files[0])}
          />

          {uploading && <p>Uploading image...</p>}

          {blog.image && (
            <img
              src={blog.image}
              alt="Preview"
              style={{
                marginTop: "10px",
                maxWidth: "100%",
                borderRadius: "10px"
              }}
            />
          )}
        </div>

        {/* Content */}
        <div>
          <label style={{ fontWeight: 700 }}>Blog Content</label>
          <RichTextEditor
            value={blog.content}
            onChange={(html) =>
              setBlog((prev) => ({ ...prev, content: html }))
            }
          />
        </div>

        {/* Publish Toggle */}
        <label style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <input
            type="checkbox"
            name="published"
            checked={blog.published}
            onChange={handleChange}
          />
          Publish immediately
        </label>

        {/* Submit */}
        <button
          type="submit"
          disabled={uploading}
          style={{
            padding: "12px 18px",
            fontWeight: "700",
            cursor: "pointer"
          }}
        >
          Save Blog
        </button>
      </form>
    </main>
  );
}
