import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  limit,
} from "firebase/firestore";

import {
  User,
  Mail,
  Phone,
  CalendarDays,
  UserRound,
  Droplets,
  BriefcaseBusiness,
  Clock3,
  MapPin,
  ShieldCheck,
  ArrowLeft,
  Copy,
  Check,
  Building2,
  BadgeCheck,
  Hash,
  HeartPulse,
  Loader2,
  AlertCircle,
} from "lucide-react";

import { db } from "../firebase";
import "./EmployeeProfile.css";

/* =========================================================
   HELPERS
========================================================= */

const normalizeRole = (role) => {
  if (!role) return "";

  return String(role)
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
};

const formatDate = (value) => {
  if (!value) return "Not provided";

  try {
    let date;

    if (value?.toDate) {
      date = value.toDate();
    } else if (value?.seconds) {
      date = new Date(value.seconds * 1000);
    } else {
      date = new Date(value);
    }

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return value;
  }
};

const getInitials = (name = "") => {
  const parts = String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return "E";

  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const safeValue = (value, fallback = "Not provided") => {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    return fallback;
  }

  return value;
};

const getProfilePhoto = (data) => {
  return (
    data?.profilePhotoUrl ||
    data?.photoUrl ||
    data?.profilePhoto ||
    data?.photo ||
    ""
  );
};

const getEmployeeId = (data) => {
  return (
    data?.employeeId ||
    data?.employeeID ||
    data?.empId ||
    data?.employee_id ||
    ""
  );
};

const getDob = (data) => {
  return (
    data?.dob ||
    data?.dateOfBirth ||
    data?.birthDate ||
    ""
  );
};

const getJoiningDate = (data) => {
  return (
    data?.joiningDate ||
    data?.joinDate ||
    ""
  );
};

const getEmail = (data) => {
  return (
    data?.loginEmail ||
    data?.email ||
    ""
  );
};

const getPhone = (data) => {
  return (
    data?.phone ||
    data?.contactNumber ||
    data?.mobile ||
    ""
  );
};

const getAddress = (data) => {
  if (typeof data?.address === "string") {
    return data.address;
  }

  if (typeof data?.addressInformation === "string") {
    return data.addressInformation;
  }

  const addressParts = [
    data?.addressLine1,
    data?.addressLine2,
    data?.area,
    data?.city,
    data?.state,
    data?.pincode,
    data?.postalCode,
    data?.country,
  ].filter(Boolean);

  if (addressParts.length) {
    return addressParts.join(", ");
  }

  return "";
};

const getStatus = (data) => {
  if (data?.employeeStatus) {
    return data.employeeStatus;
  }

  if (typeof data?.active === "boolean") {
    return data.active ? "Active" : "Inactive";
  }

  if (typeof data?.available === "boolean") {
    return data.available ? "Active" : "Inactive";
  }

  if (data?.status) {
    return data.status;
  }

  return "Active";
};

const normalizeStatus = (status) => {
  return String(status || "")
    .trim()
    .toLowerCase();
};

/* =========================================================
   ROLE COLLECTION CONFIG
========================================================= */

const ROLE_COLLECTIONS = {
  staff: "staff",
  marketing: "marketing",
  driver: "drivers",
};

/* =========================================================
   COMPONENT
========================================================= */

export default function EmployeeProfile() {
  const { uid } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");

  const [copiedField, setCopiedField] = useState("");

  /* =======================================================
     COPY
  ======================================================= */

  const copyValue = async (value, field) => {
    if (!value || value === "Not provided") return;

    try {
      await navigator.clipboard.writeText(String(value));

      setCopiedField(field);

      setTimeout(() => {
        setCopiedField("");
      }, 1600);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  /* =======================================================
     LOAD PROFILE
  ======================================================= */

  useEffect(() => {
    let mounted = true;

    const loadProfile = async () => {
      if (!uid) {
        setError("Employee UID is missing.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        /* ---------------------------------------------------
           STEP 1
           users/{uid}
        --------------------------------------------------- */

        const userRef = doc(db, "users", uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          throw new Error("Employee account was not found.");
        }

        const userData = {
          id: userSnap.id,
          ...userSnap.data(),
        };

        const role = normalizeRole(userData.role);

        let employeeData = {};
        let sourceCollection = "users";

        /* ---------------------------------------------------
           STEP 2
           ROLE BASED COLLECTION
        --------------------------------------------------- */

        if (ROLE_COLLECTIONS[role]) {
          const collectionName = ROLE_COLLECTIONS[role];

          sourceCollection = collectionName;

          /*
           * First try authUid.
           */
          const authUidQuery = query(
            collection(db, collectionName),
            where("authUid", "==", uid),
            limit(1)
          );

          const authUidSnapshot = await getDocs(authUidQuery);

          if (!authUidSnapshot.empty) {
            const employeeDoc = authUidSnapshot.docs[0];

            employeeData = {
              id: employeeDoc.id,
              ...employeeDoc.data(),
            };
          } else {
            /*
             * Fallback:
             * Some records may use uid instead of authUid.
             */
            const uidQuery = query(
              collection(db, collectionName),
              where("uid", "==", uid),
              limit(1)
            );

            const uidSnapshot = await getDocs(uidQuery);

            if (!uidSnapshot.empty) {
              const employeeDoc = uidSnapshot.docs[0];

              employeeData = {
                id: employeeDoc.id,
                ...employeeDoc.data(),
              };
            }
          }
        }

        /* ---------------------------------------------------
           STEP 3
           MERGE USER + EMPLOYEE DATA
           
           Employee-specific data wins.
        --------------------------------------------------- */

        const mergedProfile = {
          ...userData,
          ...employeeData,

          uid,

          role,

          sourceCollection,

          name:
            employeeData?.name ||
            userData?.name ||
            userData?.displayName ||
            "",

          email:
            getEmail(employeeData) ||
            getEmail(userData),

          phone:
            getPhone(employeeData) ||
            getPhone(userData),

          employeeId:
            getEmployeeId(employeeData) ||
            getEmployeeId(userData),

          dob:
            getDob(employeeData) ||
            getDob(userData),

          fatherName:
            employeeData?.fatherName ||
            userData?.fatherName ||
            "",

          gender:
            employeeData?.gender ||
            userData?.gender ||
            "",

          bloodGroup:
            employeeData?.bloodGroup ||
            userData?.bloodGroup ||
            "",

          designation:
            employeeData?.designation ||
            userData?.designation ||
            "",

          workType:
            employeeData?.workType ||
            userData?.workType ||
            "",

          joiningDate:
            getJoiningDate(employeeData) ||
            getJoiningDate(userData),

          employeeStatus:
            getStatus(employeeData) ||
            getStatus(userData),

          address:
            getAddress(employeeData) ||
            getAddress(userData),

          profilePhotoUrl:
            getProfilePhoto(employeeData) ||
            getProfilePhoto(userData),
        };

        if (mounted) {
          setProfile(mergedProfile);
        }
      } catch (err) {
        console.error("Employee profile error:", err);

        if (mounted) {
          setError(
            err?.message ||
              "Unable to load employee profile."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [uid]);

  /* =======================================================
     DERIVED DATA
  ======================================================= */

  const initials = useMemo(() => {
    return getInitials(profile?.name);
  }, [profile?.name]);

  const status = useMemo(() => {
    return safeValue(profile?.employeeStatus, "Active");
  }, [profile?.employeeStatus]);

  const statusClass = useMemo(() => {
    const normalized = normalizeStatus(status);

    if (
      normalized.includes("inactive") ||
      normalized.includes("terminated") ||
      normalized.includes("blocked")
    ) {
      return "employee-profile-status inactive";
    }

    if (
      normalized.includes("leave") ||
      normalized.includes("pending")
    ) {
      return "employee-profile-status warning";
    }

    return "employee-profile-status active";
  }, [status]);

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <div className="employee-profile-page">
        <div className="employee-profile-loading">
          <div className="employee-profile-loader">
            <Loader2 size={30} />
          </div>

          <h2>Loading employee profile</h2>

          <p>
            Please wait while we securely retrieve
            the employee information.
          </p>
        </div>
      </div>
    );
  }

  /* =======================================================
     ERROR
  ======================================================= */

  if (error || !profile) {
    return (
      <div className="employee-profile-page">
        <div className="employee-profile-error">
          <div className="employee-profile-error-icon">
            <AlertCircle size={30} />
          </div>

          <h2>Profile unavailable</h2>

          <p>
            {error ||
              "The requested employee profile could not be found."}
          </p>

          <button
            className="employee-profile-back-button"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={17} />
            Go Back
          </button>
        </div>
      </div>
    );
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="employee-profile-page">

      {/* =================================================
          TOP NAVIGATION
      ================================================= */}

      <div className="employee-profile-topbar">

  {/* BRAND */}
  <div className="employee-profile-brand">

    <img
      src="/logo.png"
      alt="BookMyMedicare"
      className="employee-profile-brand-logo"
    />

    <div className="employee-profile-brand-name">
      <span className="brand-book">BookMy</span>
      <span className="brand-medicare">Medicare</span>
    </div>

  </div>

  {/* PAGE TITLE + BACK */}
  <div className="employee-profile-header-right">

    <div className="employee-profile-top-title">
      <ShieldCheck size={17} />
      <span>Employee Profile</span>
    </div>

    <button
      className="employee-profile-back"
      onClick={() => navigate(-1)}
    >
      <ArrowLeft size={18} />
      <span>Back</span>
    </button>

  </div>

</div>

      {/* =================================================
          MAIN CONTAINER
      ================================================= */}

      <main className="employee-profile-container">

        {/* =================================================
            HERO
        ================================================= */}

        <section className="employee-profile-hero">

          <div className="employee-profile-hero-glow glow-one" />
          <div className="employee-profile-hero-glow glow-two" />

          <div className="employee-profile-hero-content">

            {/* PROFILE PHOTO */}

            <div className="employee-profile-photo-wrapper">

              <div className="employee-profile-photo-ring">

                {profile.profilePhotoUrl ? (
                  <img
                    src={profile.profilePhotoUrl}
                    alt={profile.name || "Employee"}
                    className="employee-profile-photo"
                  />
                ) : (
                  <div className="employee-profile-photo-placeholder">
                    {initials}
                  </div>
                )}

              </div>

              <div className="employee-profile-photo-check">
                <BadgeCheck size={17} />
              </div>

            </div>

            {/* HERO INFORMATION */}

            <div className="employee-profile-hero-info">

              <div className="employee-profile-eyebrow">
                <span className="eyebrow-dot" />
                VERIFIED EMPLOYEE
              </div>

              <h1>
                {safeValue(profile.name, "Employee")}
              </h1>

              <div className="employee-profile-designation">

                <BriefcaseBusiness size={16} />

                <span>
                  {safeValue(
                    profile.designation,
                    "Employee"
                  )}
                </span>

              </div>

              <div className="employee-profile-meta-row">

                <div className="employee-profile-id-chip">
                  <Hash size={14} />

                  <span>
                    {safeValue(
                      profile.employeeId,
                      "Employee ID not assigned"
                    )}
                  </span>

                  {profile.employeeId && (
                    <button
                      className="hero-copy-button"
                      onClick={() =>
                        copyValue(
                          profile.employeeId,
                          "employeeId"
                        )
                      }
                    >
                      {copiedField === "employeeId" ? (
                        <Check size={13} />
                      ) : (
                        <Copy size={13} />
                      )}
                    </button>
                  )}
                </div>

                <div className={statusClass}>
                  <span className="status-dot" />
                  {status}
                </div>

              </div>

            </div>

          </div>

        </section>

        {/* =================================================
            CONTENT GRID
        ================================================= */}

        <div className="employee-profile-content">

          {/* =================================================
              PERSONAL INFORMATION
          ================================================= */}

          <section className="employee-profile-card">

            <div className="employee-profile-card-header">

              <div className="employee-profile-section-icon">
                <UserRound size={19} />
              </div>

              <div>
                <h2>Personal Information</h2>
                <p>
                  Basic personal and contact details
                </p>
              </div>

            </div>

            <div className="employee-profile-fields">

              <ProfileField
                icon={<User size={17} />}
                label="Full Name"
                value={safeValue(profile.name)}
              />

              <ProfileField
                icon={<Mail size={17} />}
                label="Email ID"
                value={safeValue(profile.email)}
                copyable={!!profile.email}
                copied={copiedField === "email"}
                onCopy={() =>
                  copyValue(profile.email, "email")
                }
              />

              <ProfileField
                icon={<Phone size={17} />}
                label="Contact No."
                value={safeValue(profile.phone)}
                copyable={!!profile.phone}
                copied={copiedField === "phone"}
                onCopy={() =>
                  copyValue(profile.phone, "phone")
                }
              />

              <ProfileField
                icon={<CalendarDays size={17} />}
                label="Date of Birth"
                value={formatDate(profile.dob)}
              />

              <ProfileField
                icon={<UserRound size={17} />}
                label="Father Name"
                value={safeValue(profile.fatherName)}
              />

              <ProfileField
                icon={<User size={17} />}
                label="Gender"
                value={safeValue(profile.gender)}
              />

              <ProfileField
                icon={<Droplets size={17} />}
                label="Blood Group"
                value={safeValue(profile.bloodGroup)}
              />

            </div>

          </section>

          {/* =================================================
              EMPLOYMENT INFORMATION
          ================================================= */}

          <section className="employee-profile-card">

            <div className="employee-profile-card-header">

              <div className="employee-profile-section-icon">
                <Building2 size={19} />
              </div>

              <div>
                <h2>Employment Details</h2>
                <p>
                  Current employment information
                </p>
              </div>

            </div>

            <div className="employee-profile-fields">

              <ProfileField
                icon={<Hash size={17} />}
                label="Employee ID"
                value={safeValue(profile.employeeId)}
              />

              <ProfileField
                icon={<BriefcaseBusiness size={17} />}
                label="Designation"
                value={safeValue(profile.designation)}
              />

              <ProfileField
                icon={<Clock3 size={17} />}
                label="Work Type"
                value={safeValue(profile.workType)}
              />

              <ProfileField
                icon={<CalendarDays size={17} />}
                label="Joining Date"
                value={formatDate(profile.joiningDate)}
              />

              <ProfileField
                icon={<ShieldCheck size={17} />}
                label="Employee Status"
                value={safeValue(profile.employeeStatus)}
                status
              />

              {profile.branchId && (
                <ProfileField
                  icon={<Building2 size={17} />}
                  label="Branch"
                  value={profile.branchId}
                />
              )}

              {profile.role && (
                <ProfileField
                  icon={<BadgeCheck size={17} />}
                  label="System Role"
                  value={profile.role}
                />
              )}

            </div>

          </section>

          {/* =================================================
              ADDRESS
          ================================================= */}

          <section className="employee-profile-card employee-profile-address-card">

            <div className="employee-profile-card-header">

              <div className="employee-profile-section-icon">
                <MapPin size={19} />
              </div>

              <div>
                <h2>Address Information</h2>
                <p>
                  Registered residential address
                </p>
              </div>

            </div>

            <div className="employee-profile-address">

              <div className="employee-profile-address-icon">
                <MapPin size={20} />
              </div>

              <div className="employee-profile-address-text">
                {safeValue(
                  profile.address,
                  "Address information has not been provided."
                )}
              </div>

            </div>

          </section>

        </div>

        {/* =================================================
            FOOTER
        ================================================= */}

        <div className="employee-profile-footer">

          <div className="employee-profile-footer-left">
            <ShieldCheck size={16} />
            <span>
              Employee information • Internal CRM Profile
            </span>
          </div>

          <div className="employee-profile-footer-right">
            <span>UID</span>
            <code>{uid}</code>
          </div>

        </div>

      </main>

    </div>
  );
}

/* =========================================================
   PROFILE FIELD COMPONENT
========================================================= */

function ProfileField({
  icon,
  label,
  value,
  copyable = false,
  copied = false,
  onCopy,
  status = false,
}) {
  return (
    <div className="employee-profile-field">

      <div className="employee-profile-field-icon">
        {icon}
      </div>

      <div className="employee-profile-field-content">

        <span className="employee-profile-field-label">
          {label}
        </span>

        <div className="employee-profile-field-value-row">

          <span
            className={
              status
                ? "employee-profile-field-value employee-profile-field-status"
                : "employee-profile-field-value"
            }
          >
            {value}
          </span>

          {copyable && (
            <button
              className="employee-profile-copy"
              onClick={onCopy}
              title="Copy"
            >
              {copied ? (
                <Check size={14} />
              ) : (
                <Copy size={14} />
              )}
            </button>
          )}

        </div>

      </div>

    </div>
  );
}