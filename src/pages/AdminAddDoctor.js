import React, { useState } from "react";
import "./AdminAddDoctor.css";

/* 🔥 FIREBASE */
import { db, storage } from "../firebase";
import { collection, addDoc } from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

const AdminAddDoctor = () => {

  /* ================= STATES ================= */

  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [preview, setPreview] = useState("");

  const [form, setForm] = useState({
    name: "",
    degree: "",
    specialist: "",
    points: [""],
  });

  /* ================= HANDLE CHANGE ================= */

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  /* ================= IMAGE ================= */

  const handleImageChange = (file) => {
    if (!file) return;

    setImageFile(file);
    setPreview(URL.createObjectURL(file));
  };

  /* ================= POINTS ================= */

  const handlePointChange = (index, value) => {

    const updated = [...form.points];
    updated[index] = value;

    setForm({
      ...form,
      points: updated,
    });
  };

  const addPoint = () => {
    setForm({
      ...form,
      points: [...form.points, ""],
    });
  };

  const removePoint = (index) => {

    const updated = form.points.filter(
      (_, i) => i !== index
    );

    setForm({
      ...form,
      points: updated,
    });
  };

  /* ================= SUBMIT ================= */

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);

      let imageURL = "";

      /* 🔥 Upload Image */

      if (imageFile) {

        const imageRef = ref(
          storage,
          `doctors/${Date.now()}_${imageFile.name}`
        );

        await uploadBytes(
          imageRef,
          imageFile
        );

        imageURL = await getDownloadURL(
          imageRef
        );
      }

      /* 🔥 Save Doctor */

      await addDoc(
        collection(db, "doctors"),
        {
          ...form,
          image: imageURL,
          createdAt: new Date(),
          status: "active",
        }
      );

      alert("Doctor Added Successfully ✅");

      /* RESET */

      setForm({
        name: "",
        degree: "",
        specialist: "",
        points: [""],
      });

      setImageFile(null);
      setPreview("");

    } catch (err) {
      console.error(err);
      alert("Error Adding Doctor ❌");
    } finally {
      setLoading(false);
    }
  };

  /* ================= JSX ================= */

  return (
    <div className="adminAddDoctorPage">

      <div className="adminAddDoctorCard">

        <h2 className="adminAddDoctorTitle">
          Add Doctor
        </h2>

        <form
          onSubmit={handleSubmit}
          className="adminAddDoctorForm"
        >

          {/* NAME */}
          <input
            className="adminAddDoctorInput"
            name="name"
            placeholder="Doctor Name"
            value={form.name}
            onChange={handleChange}
            required
          />

          {/* DEGREE */}
          <input
            className="adminAddDoctorInput"
            name="degree"
            placeholder="Degree"
            value={form.degree}
            onChange={handleChange}
          />

          {/* SPECIALIST */}
          <input
            className="adminAddDoctorInput"
            name="specialist"
            placeholder="Specialist"
            value={form.specialist}
            onChange={handleChange}
          />

          {/* IMAGE */}
          <label className="adminAddDoctorLabel">
            Doctor Image
          </label>

          <input
            type="file"
            accept="image/*"
            className="adminAddDoctorFile"
            onChange={(e) =>
              handleImageChange(
                e.target.files[0]
              )
            }
          />

          {/* PREVIEW */}
          {preview && (
            <img
              src={preview}
              alt="Preview"
              className="adminAddDoctorPreview"
            />
          )}

          {/* POINTS */}
          <label className="adminAddDoctorLabel">
            Specialization Points
          </label>

          {form.points.map((p, i) => (

            <div
              key={i}
              className="adminAddDoctorPointRow"
            >

              <input
                className="adminAddDoctorPointInput"
                value={p}
                placeholder={`Point ${i + 1}`}
                onChange={(e) =>
                  handlePointChange(
                    i,
                    e.target.value
                  )
                }
              />

             

            </div>

          ))}

          <button
            type="button"
            className="adminAddDoctorAddBtn"
            onClick={addPoint}
          >
            + Add Point
          </button>

          {/* SUBMIT */}
          <button
            className="adminAddDoctorSubmitBtn"
            disabled={loading}
          >
            {loading
              ? "Saving..."
              : "Add Doctor"}
          </button>

        </form>

      </div>

    </div>
  );
};

export default AdminAddDoctor;
