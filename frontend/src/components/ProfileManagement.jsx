import React, { useState, useEffect } from "react";
import "./ProfileManagement.css";

// address of the Flask backend (app.py runs on port 5000)
const API_URL = "http://127.0.0.1:5000";

function ProfileManagement() {
  // saved by the login page after a successful login
  const userId = localStorage.getItem("userId");
  const token = localStorage.getItem("accessToken");

  // Keeps track of the selected tab, clicking a tab changes it and the right side updates
  const [activeTab, setActiveTab] = useState("personal");

  // true = show the "Saved" message for a few seconds after the user clicks Save
  const [saved, setSaved] = useState(false);

  // true while the profile is being loaded from the backend
  const [loading, setLoading] = useState(true);

  // error message to show the user (empty = no error)
  const [error, setError] = useState("");

  // starts empty, filled in from the backend when the page opens
  // key names match the backend/database so we can send it as-is
  const [profile, setProfile] = useState({
    first_name: "",
    last_name: "",
    title: "",
    email: "",
    phone_number: "",
    location: "",
    bio: "",
  });

  // experience, education and skills are not saved to the backend yet (next sprint)
  const [experiences, setExperiences] = useState([]);
  const [education, setEducation] = useState([]);
  const [skills, setSkills] = useState([]);
  const [newSkill, setNewSkill] = useState("");



  // Load the profile once when the page opens
  useEffect(() => {
    async function loadProfile() {
      try {
        const response = await fetch(`${API_URL}/api/profiles/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Could not load your profile.");
          return;
        }

        // the database can have empty (null) fields, so use "" instead
        const p = data.profile;
        setProfile({
          first_name: p.first_name || "",
          last_name: p.last_name || "",
          title: p.title || "",
          email: p.email || "",
          phone_number: p.phone_number || "",
          location: p.location || "",
          bio: p.bio || "",
        });
      } catch {
        setError("Could not reach the server. Is the backend running?");
      } finally {
        setLoading(false);
      }
    }

    if (userId) {
      loadProfile();
    }
  }, []);



  // Personal information 
  // name on each input matches the key in profile, so this works for all fields
  function handleProfileChange(e) {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  }


  
  // Experience
  function handleExperienceChange(index, e) {
    const updated = [...experiences];
    updated[index] = { ...updated[index], [e.target.name]: e.target.value };
    setExperiences(updated);
  }

  function addExperience() {
    setExperiences([...experiences, { title: "", company: "", dates: "", description: "" }]);
  }

  function removeExperience(index) {
    setExperiences(experiences.filter((item, i) => i !== index));
  }



  // Education 
  function handleEducationChange(index, e) {
    const updated = [...education];
    updated[index] = { ...updated[index], [e.target.name]: e.target.value };
    setEducation(updated);
  }

  function addEducation() {
    setEducation([...education, { school: "", degree: "", years: "" }]);
  }

  function removeEducation(index) {
    setEducation(education.filter((item, i) => i !== index));
  }



  // Skills
  function addSkill(e) {
    e.preventDefault();  // stops the page from refreshing
    if (newSkill.trim() === "") return;
    setSkills([...skills, newSkill.trim()]);
    setNewSkill("");
  }

  function removeSkill(skillToRemove) {
    setSkills(skills.filter((skill) => skill !== skillToRemove));
  }



  // Save: send the personal info to the backend
  async function handleSave() {
    setError("");

    try {
      const response = await fetch(`${API_URL}/api/profiles/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(profile),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Could not save your profile.");
        return;
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Could not reach the server. Is the backend running?");
    }
  }

  const tabs = [
    { id: "personal", label: "Personal information" },
    { id: "experience", label: "Work experience" },
    { id: "education", label: "Education" },
    { id: "skills", label: "Skills" },
    
  ];

  // not logged in: nothing to load
  if (!userId) {
    return (
      <div className="page">
        <p>
          Please <a href="/login">log in</a> to see your profile.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page">
        <p>Loading your profile...</p>
      </div>
    );
  }

  return (
    <div className="page">
      {/* Top bar */}
      <div className="appbar">
        <span className="logo-mark"></span>
        <span className="logo">CareerConnect</span>
      </div>

      {/* Profile card with initials */}
      <div className="summary">
        <div className="avatar">
          {profile.first_name.charAt(0)}
          {profile.last_name.charAt(0)}
        </div>
        <div>
          <h1>
            {profile.first_name} {profile.last_name}
          </h1>
          <p className="title">{profile.title}</p>
          <p className="muted">{profile.location}</p>
        </div>
      </div>

      <div className="layout">
        {/* Sidebar tabs (tabs on the left)*/}
        <nav className="tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={activeTab === tab.id ? "tab active" : "tab"}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Right side, changes depending on the tab */}
        <div className="panel">
          {activeTab === "personal" && (
            <div>
              <h2>Personal information</h2>
              <div className="grid">
                <label className="field">
                  First name
                  <input name="first_name" value={profile.first_name} onChange={handleProfileChange} />
                </label>
                <label className="field">
                  Last name
                  <input name="last_name" value={profile.last_name} onChange={handleProfileChange} />
                </label>
                <label className="field full">
                  Title
                  <input name="title" value={profile.title} onChange={handleProfileChange} />
                </label>
                <label className="field">
                  Email
                  <input name="email" type="email" value={profile.email} onChange={handleProfileChange} />
                </label>
                <label className="field">
                  Phone
                  <input name="phone_number" value={profile.phone_number} onChange={handleProfileChange} />
                </label>
                <label className="field full">
                  Location
                  <input name="location" value={profile.location} onChange={handleProfileChange} />
                </label>
                <label className="field full">
                  About
                  <textarea name="bio" rows="4" value={profile.bio} onChange={handleProfileChange} />
                </label>
              </div>
            </div>
          )}
      

          {activeTab === "experience" && (
            <div>
              <h2>Work experience</h2>
              {experiences.map((exp, index) => (
                <div className="entry" key={index}>
                  <div className="grid">
                    <label className="field">
                      Job title
                      <input name="title" value={exp.title} onChange={(e) => handleExperienceChange(index, e)} />
                    </label>
                    <label className="field">
                      Company
                      <input name="company" value={exp.company} onChange={(e) => handleExperienceChange(index, e)} />
                    </label>
                    <label className="field full">
                      Dates
                      <input
                        name="dates"
                        placeholder="September 2023 - May 2024"
                        value={exp.dates}
                        onChange={(e) => handleExperienceChange(index, e)}
                      />
                    </label>
                    <label className="field full">
                      Description
                      <textarea
                        name="description"
                        rows="3"
                        value={exp.description}
                        onChange={(e) => handleExperienceChange(index, e)}
                      />
                    </label>
                  </div>
                  <button className="btn-link" onClick={() => removeExperience(index)}>
                    Remove
                  </button>
                </div>
              ))}
              <button className="btn" onClick={addExperience}>
                + Add experience
              </button>
            </div>
          )}

          {activeTab === "education" && (
            <div>
              <h2>Education</h2>
              {education.map((ed, index) => (
                <div className="entry" key={index}>
                  <div className="grid">
                    <label className="field full">
                      School
                      <input name="school" value={ed.school} onChange={(e) => handleEducationChange(index, e)} />
                    </label>
                    <label className="field">
                      Degree
                      <input name="degree" value={ed.degree} onChange={(e) => handleEducationChange(index, e)} />
                    </label>
                    <label className="field">
                      Years
                      <input
                        name="years"
                        placeholder="Start - End"
                        value={ed.years}
                        onChange={(e) => handleEducationChange(index, e)}
                      />
                    </label>
                  </div>
                  <button className="btn-link" onClick={() => removeEducation(index)}>
                    Remove
                  </button>
                </div>
              ))}
              <button className="btn" onClick={addEducation}>
                + Add education
              </button>
            </div>
          )}

          {activeTab === "skills" && (
            <div>
              <h2>Skills</h2>
              {/* form lets Enter or the Add button add a skill */}
              <form className="skill-form" onSubmit={addSkill}>
                <input
                  placeholder="Enter a new skill"
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                />
                <button className="btn" type="submit">
                  Add
                </button>
              </form>
              <div className="chips">
                {skills.map((skill) => (
                  <span className="chip" key={skill}>
                    {skill}
                    <button onClick={() => removeSkill(skill)}>×</button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* One Save button shared by every tab */}
          <div className="save-row">
            <button className="btn-primary" onClick={handleSave}>
              Save changes
            </button>
            {saved && <span className="saved">Saved</span>}
            {error && <span className="error">{error}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfileManagement;