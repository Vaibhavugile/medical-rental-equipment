import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy
} from "firebase/firestore";
import { db } from "../firebase";

import TopBar from "../frontend/TopBar";
import Header from "../frontend/Header";
import Footer from "../frontend/Footer";
import SEO from "../components/SEO";


import "./BlogList.css";

/* ================= SEO ================= */

export default function BlogList() {
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {

    const fetchBlogs = async () => {
      try {
        const q = query(
          collection(db, "blogs"),
          where("published", "==", true),
          orderBy("createdAt", "desc")
        );

        const snapshot = await getDocs(q);
        setBlogs(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Error fetching blogs:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchBlogs();
  }, []);

  return (
    <>
	 <SEO
        title="Blogs | Home Health Care Services in Mumbai | Book My Medicare"
        description="Explore blogs on home health care services, nursing services, ICU at home, medical equipment on rent and expert health care at home guidance for families."
        keywords="home nursing care, ICU setup at home, ambulance service, physiotherapy at home, medical equipment rental"
        canonical="https://www.bookmymediccare.com/blogs"
      />
      {/* GLOBAL */}
      <TopBar />
      <Header />

      {/* PAGE */}
      <main className="bloglist">
        <header className="bloglist-header">
          <h1> Blogs</h1>
          <p>
            Expert-written healthcare articles by BookMyMedicare covering home
            nursing, ICU care at home, elderly care, physiotherapy, and recovery
            services.
          </p>
        </header>

        {loading && <p className="bloglist-state">Loading blogs…</p>}

        {!loading && blogs.length === 0 && (
          <p className="bloglist-state">No blogs published yet.</p>
        )}

        {!loading && blogs.length > 0 && (
          <section className="bloglist-grid">
            {blogs.map((blog) => (
              <article key={blog.id} className="blog-card">
                {blog.image && (
                  <Link
                    to={`/blogs/${blog.slug}`}
                    className="blog-card-img"
                  >
                    <img src={blog.image} alt="Blogs" />
                  </Link>
                )}

                <div className="blog-card-body">
                  <p className="blog-card-date">
                    {blog.createdAt?.toDate
                      ? blog.createdAt.toDate().toLocaleDateString()
                      : ""}
                  </p>

                  <h2 className="blog-card-title">
                    <Link to={`/blogs/${blog.slug}`}>
                      {blog.title}
                    </Link>
                  </h2>

                  <p className="blog-card-excerpt">
                    {blog.metaDescription}
                  </p>

                  <Link
                    to={`/blogs/${blog.slug}`}
                    className="blog-card-link"
                  >
                    Read Article →
                  </Link>
                </div>
              </article>
            ))}
          </section>
        )}
      </main>

      {/* GLOBAL */}
      <Footer />
    </>
  );
}
