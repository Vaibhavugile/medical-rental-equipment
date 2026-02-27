"use client";
import React, { useEffect, useState } from "react";

import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from "firebase/firestore";

import { db } from "../firebase";

import "./CommunitySupport.css";

export default function CommunitySupport() {

  /* ================= STATE ================= */

  const [media, setMedia] = useState([]);
  const [loading, setLoading] =
    useState(true);

  const [activeMedia, setActiveMedia] =
    useState(null);

  /* ================= FETCH ================= */

  useEffect(() => {

    const fetchMedia = async () => {
      try {
        const q = query(
          collection(
            db,
            "community_support"
          ),
          where(
            "published",
            "==",
            true
          ),
          orderBy("order", "asc")
        );

        const snapshot =
          await getDocs(q);

        const data =
          snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

        setMedia(data);

      } catch (err) {
        console.error(
          "Community fetch error:",
          err
        );
      } finally {
        setLoading(false);
      }
    };

    fetchMedia();

  }, []);

  /* ================= MODAL ================= */

  const openMedia = (item) => {
    setActiveMedia(item);
    document.body.style.overflow =
      "hidden";
  };

  const closeMedia = () => {
    setActiveMedia(null);
    document.body.style.overflow =
      "auto";
  };

  /* ================= JSX ================= */

  return (
    <div className="communityPage">

      {/* ===== HEADER ===== */}
      <div className="communityHeader">

        <h1>
          Our{" "}
          <span>
            Social Support to Community
          </span>
        </h1>

        <p>
          Free medical camps, oxygen
          support, ICU donations and
          healthcare initiatives for
          society.
        </p>

      </div>

      {/* ===== STATES ===== */}

      {loading && (
        <p className="communityState">
          Loading media...
        </p>
      )}

      {!loading &&
        media.length === 0 && (
          <p className="communityState">
            No community media added
            yet.
          </p>
        )}

      {/* ===== GRID ===== */}

      {!loading &&
        media.length > 0 && (
          <div className="communityGrid">

            {media.map((item) => (
              <div
                key={item.id}
                className="communityCard"
                onClick={() =>
                  openMedia(item)
                }
              >
                {item.type ===
                "image" ? (
                  <img
                    src={item.url}
                    alt={item.title}
                  />
                ) : (
                  <video
                    src={item.url}
                  />
                )}

                <div className="communityOverlay">
                  View
                </div>
              </div>
            ))}

          </div>
        )}

      {/* ===== MODAL ===== */}

      {activeMedia && (
        <div
          className="communityModal"
          onClick={closeMedia}
        >
          <div
            className="communityModalContent"
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <button
              className="communityClose"
              onClick={closeMedia}
            >
              ✕
            </button>

            {activeMedia.type ===
            "image" ? (
              <img
                src={activeMedia.url}
                alt={
                  activeMedia.title
                }
              />
            ) : (
              <video
                src={activeMedia.url}
                controls
                autoPlay
              />
            )}
          </div>
        </div>
      )}

    </div>
  );
}
