import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  collection,
  getDocs,
  query,
  where,
  limit
} from "firebase/firestore";
import { db } from "../firebase";

import TopBar from "../frontend/TopBar";
import Header from "../frontend/Header";
import Footer from "../frontend/Footer";

import "./BlogDetail.css";

/* ================= SEO ================= */
function setMeta(title, description) {
  document.title = title || "Blog | BookMyMedicare";

  let meta = document.querySelector("meta[name='description']");
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "description");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", description || "");
}

/* ================= SCHEMA ================= */
function injectArticleSchema(blog) {
  if (!blog) return;

  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: blog.title,
    description: blog.metaDescription,
    image: blog.image ? [blog.image] : [],
    author: {
      "@type": "Organization",
      name: "BookMyMedicare"
    },
    publisher: {
      "@type": "Organization",
      name: "BookMyMedicare"
    },
    datePublished: blog.createdAt?.toDate
      ? blog.createdAt.toDate().toISOString()
      : ""
  };

  let script = document.getElementById("article-schema");
  if (!script) {
    script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "article-schema";
    document.head.appendChild(script);
  }

  script.textContent = JSON.stringify(schema);
}

export default function BlogDetail() {
  const { slug } = useParams();
  const [blog, setBlog] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBlog = async () => {
      try {
        const q = query(
          collection(db, "blogs"),
          where("slug", "==", slug),
          where("published", "==", true),
          limit(1)
        );

        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const data = snapshot.docs[0].data();
          setBlog(data);
          setMeta(data.metaTitle, data.metaDescription);
          injectArticleSchema(data);
        } else {
          setBlog(null);
        }
      } catch (err) {
        console.error(err);
        setBlog(null);
      } finally {
        setLoading(false);
      }
    };

    fetchBlog();
  }, [slug]);

  return (
    <>
      {/* GLOBAL */}
      <TopBar />
      <Header />

      {/* PAGE */}
      <main className="blogdetail">
        {loading && (
          <div className="blogdetail-state">Loading article…</div>
        )}

        {!loading && !blog && (
          <div className="blogdetail-state">
            <h1>Article not found</h1>
            <Link to="/blogs">← Back to Blogs</Link>
          </div>
        )}

        {!loading && blog && (
          <article className="blogdetail-article">
            <header className="blogdetail-header">
              <p className="blogdetail-breadcrumb">
                <Link to="/">Home</Link> / <Link to="/blogs">Blogs</Link>
              </p>

              <h1 className="blogdetail-title">{blog.title}</h1>

              <p className="blogdetail-meta">
                By {blog.author || "BookMyMedicare Team"}
                {blog.createdAt?.toDate
                  ? ` • ${blog.createdAt
                      .toDate()
                      .toLocaleDateString()}`
                  : ""}
              </p>
            </header>

            {blog.image && (
              <div className="blogdetail-image">
                <img src={blog.image} alt={blog.title} />
              </div>
            )}

            <section
              className="blogdetail-content"
              dangerouslySetInnerHTML={{ __html: blog.content }}
            />

            <div className="blogdetail-cta">
              <h3>Need Healthcare Services at Home?</h3>
              <p>
                Book trusted home nursing, ICU care, elderly care,
                physiotherapy and medical equipment with BookMyMedicare.
              </p>
              <Link
                to="/contact"
                className="blogdetail-cta-btn"
              >
                Request a Callback
              </Link>
            </div>
          </article>
        )}
      </main>

      {/* GLOBAL */}
      <Footer />
    </>
  );
}
