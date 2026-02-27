"use client";
import React, { useEffect, useState } from "react";
import "./VideosPage.css";
import Header from "../frontend/Header"; // adjust path if Header lives in a subfolder
import TopBar from "../frontend/TopBar";

export default function VideosPage() {

  /* ================= STATE ================= */
  const [videos, setVideos] = useState([]);
  const [activeVideo, setActiveVideo] =
    useState(null);

  /* ================= CONFIG ================= */

  const API_KEY =
    "AIzaSyAuEiuDyaAYuMLIgU89oV8ZdcAQBTLZ5G4";

  const CHANNEL_ID =
    "UCAuGXsGAxKGZf9JJyGiVNgg";

  /* 👉 Your Channel Link */
  const CHANNEL_URL =
  "https://www.youtube.com/@BookMyMediCare_21";


  /* ================= FETCH VIDEOS ================= */

  useEffect(() => {

    const fetchVideos = async () => {
      try {
        const res = await fetch(
          `https://www.googleapis.com/youtube/v3/search?key=${API_KEY}&channelId=${CHANNEL_ID}&part=snippet,id&order=date&maxResults=12`
        );

        const data = await res.json();

        const formatted = data.items
          .filter(
            (item) =>
              item.id.kind ===
              "youtube#video"
          )
          .map((item) => ({
            id: item.id.videoId,
            title: item.snippet.title,
            thumbnail:
              item.snippet.thumbnails.high.url,
          }));

        setVideos(formatted);

      } catch (err) {
        console.error(
          "YouTube fetch error:",
          err
        );
      }
    };

    fetchVideos();

  }, []);

  /* ================= MODAL ================= */

  const openVideo = (id) => {
    setActiveVideo(id);
    document.body.style.overflow =
      "hidden";
  };

  const closeVideo = () => {
    setActiveVideo(null);
    document.body.style.overflow =
      "auto";
  };

  /* ================= JSX ================= */

  return (
    

    <div className="videosPage">
             <TopBar />
              <Header />
        

      {/* ===== HEADER ===== */}
      <div className="videosHeader">
        <h1>
          Our <span>Medical Setup Videos</span>
        </h1>

        <p>
          Latest ICU setups, ventilator installs
          and oxygen therapy demos.
        </p>
      </div>

      {/* ===== GRID ===== */}
      <div className="videosGrid">

        {videos.map((video) => (
          <div
            key={video.id}
            className="videoCard"
            onClick={() =>
              openVideo(video.id)
            }
          >
            <img
              src={video.thumbnail}
              alt={video.title}
            />

            <div className="playOverlay">
              ▶
            </div>

            <p className="videoTitle">
              {video.title}
            </p>
          </div>
        ))}

      </div>

      {/* ===== EXPLORE CHANNEL BUTTON ===== */}
      <div className="youtubeExploreWrap">

        <a
          href={CHANNEL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="youtubeExploreBtn"
        >
          Explore Our YouTube Channel →
        </a>

      </div>

      {/* ===== VIDEO MODAL ===== */}
      {activeVideo && (
        <div
          className="videoModal"
          onClick={closeVideo}
        >
          <div
            className="videoModalContent"
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <button
              className="videoClose"
              onClick={closeVideo}
            >
              ✕
            </button>

            <iframe
              src={`https://www.youtube.com/embed/${activeVideo}?autoplay=1`}
              allow="autoplay"
              allowFullScreen
            ></iframe>
          </div>
        </div>
      )}

    </div>
  );
}
