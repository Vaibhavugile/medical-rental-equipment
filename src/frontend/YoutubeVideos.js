"use client";
import React, { useEffect, useState } from "react";

import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay } from "swiper/modules";

import "swiper/css";
import "./YoutubeVideos.css";

export default function YoutubeVideos() {

  /* ================= STATE ================= */
  const [videos, setVideos] = useState([]);

  /* ================= CONFIG ================= */
  const API_KEY = "AIzaSyAuEiuDyaAYuMLIgU89oV8ZdcAQBTLZ5G4";
  const CHANNEL_ID = "UCAuGXsGAxKGZf9JJyGiVNgg";

  /* ================= FETCH VIDEOS ================= */
  useEffect(() => {

    const fetchVideos = async () => {
      try {
        const res = await fetch(
          `https://www.googleapis.com/youtube/v3/search?key=${API_KEY}&channelId=${CHANNEL_ID}&part=snippet,id&order=date&maxResults=10`
        );

        const data = await res.json();

        const formatted = data.items
          .filter(
            (item) =>
              item.id.kind === "youtube#video"
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

  /* ================= OPEN VIDEO ================= */
  const openVideo = (id) => {
    window.open(
      `https://www.youtube.com/watch?v=${id}`,
      "_blank"
    );
  };

  return (
    <section className="youtubeSection">

      {/* ===== HEADER ===== */}
      <div className="youtubeHeader">
        <h2>
          Watch Our <span>Medical Setups</span>
        </h2>

        <p>
          ICU setups, ventilator installations,
          oxygen therapy & patient care demos.
        </p>
      </div>

      {/* ===== SLIDER ===== */}
      <Swiper
        modules={[Autoplay]}
        spaceBetween={24}
        slidesPerView={3}
        loop={videos.length > 3}
        autoplay={{
          delay: 2500,
          disableOnInteraction: false,
        }}
        breakpoints={{
          0: { slidesPerView: 1 },
          640: { slidesPerView: 2 },
          1024: { slidesPerView: 3 },
        }}
      >
        {videos.map((video) => (
          <SwiperSlide key={video.id}>
            <div
              className="youtubeCard"
              onClick={() => openVideo(video.id)}
            >
              <img
                src={video.thumbnail}
                alt={video.title}
              />

              <div className="playOverlay">
                ▶
              </div>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>

      {/* ===== VIEW ALL ===== */}
      <div className="viewAllWrap">
        <a
          href="/videos"
          className="viewAllBtn"
        >
          View All Videos →
        </a>
      </div>

    </section>
  );
}
