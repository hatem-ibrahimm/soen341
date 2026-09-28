import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getProfile, saveProfile } from "../services/authApi.js";
import "./ProfileManagement.css";

function ProfileManagement() {
  // Keeps track of the selected tab, clicking a tab changes it and the right side updates
  const [activeTab, setActiveTab] = useState("personal");

  // true = show the "Saved" message for a few seconds after the user clicks Save
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(() => Boolean(window.localStorage.getItem("token")));

  // Sample data
  const [profile, setProfile] = useState({
    firstName: "Ace",
    lastName: "Newton",
    title: "Software Developer",
    email: "ace.newton@gmail.com",
    phone: "(514) 121-3489",
    location: "Montreal, QC",
    about: "",
  });

  const [experiences, setExperiences] = useState([
    {
      title: "Software Engineering Intern",
      company: "Manulife",
      dates: "September 2025 - December 2025",
      description: "Developed and maintained software features using modern programming languages and tools",
    },
  ]);

  const [education, setEducation] = useState([
    { school: "Concordia University", degree: "B.Eng. Software Engineering", years: "2023 - 2027" },
  ]);

  const [skills, setSkills] = useState(["C++", "Python", "JavaScript"]);
  const [newSkill, setNewSkill] = useState("");

  useEffect(() => {
    if (!window.localStorage.getItem("token")) return;

    let isCurrent = true;
    getProfile()
      .then(({ profile: savedProfile }) => {
        if (!isCurrent) return;
        setProfile({
          firstName: savedProfile.first_name || "",
          lastName: savedProfile.last_name || "",
          title: savedProfile.title || "",
          email: savedProfile.email || "",
          phone: savedProfile.phone_number || "",
          location: savedProfile.location || "",
          about: savedProfile.bio || "",
        });
        setExperiences(savedProfile.experiences || []);
        setEducation(savedProfile.education || []);
        setSkills(savedProfile.skills || []);
      })
      .catch((error) => {
        if (isCurrent) setSaveError(error.message);
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
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
    if (
      newSkill.trim() === "" ||
      skills.some((skill) => skill.toLowerCase() === newSkill.trim().toLowerCase())
    ) return;
    setSkills([...skills, newSkill.trim()]);
    setNewSkill("");
  }

  function removeSkill(skillToRemove) {
    setSkills(skills.filter((skill) => skill !== skillToRemove));
  }



  // Save 
  async function handleSave() {
    setSaved(false);
    setSaveError("");
    const payload = {
      first_name: profile.firstName,
      last_name: profile.lastName,
      title: profile.title,
      email: profile.email,
      phone_number: profile.phone,
      location: profile.location,
      bio: profile.about,
      experiences: experiences.map((experience) => ({
        title: experience.title,
        company: experience.company,
        dates: experience.dates,
        description: experience.description,
      })),
      education: education.map((item) => ({
        school: item.school,
        degree: item.degree,
        years: item.years,
      })),
      skills,
    };

    if (Object.values(payload).some((value) => !value.trim())) {
      setSaveError("Please complete all personal information fields before saving.");
      return;
    }

    setIsSaving(true);
    try {
      await saveProfile(payload);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      setSaveError(error.message);
    } finally {
      setIsSaving(false);
    }
  }

  const tabs = [
    { id: "personal", label: "Personal information" },
    { id: "experience", label: "Work experience" },
    { id: "education", label: "Education" },
    { id: "skills", label: "Skills" },
    
  ];

  return (
    <div className="page">
      {/* Top bar */}
      <div className="appbar">
        <span className="logo-mark"></span>
        <Link className="logo" to="/">CareerConnect</Link>
        <Link className="profile-home-link" to="/">Home</Link>
      </div>

      {/* Profile card with initials */}
      <div className="summary">
        <div className="avatar">
          {profile.firstName.charAt(0)}
          {profile.lastName.charAt(0)}
        </div>
        <div>
          <h1>
            {profile.firstName} {profile.lastName}
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
                  <input name="firstName" value={profile.firstName} onChange={handleProfileChange} />
                </label>
                <label className="field">
                  Last name
                  <input name="lastName" value={profile.lastName} onChange={handleProfileChange} />
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
                  <input name="phone" value={profile.phone} onChange={handleProfileChange} />
                </label>
                <label className="field full">
                  Location
                  <input name="location" value={profile.location} onChange={handleProfileChange} />
                </label>
                <label className="field full">
                  About
                  <textarea name="about" rows="4" value={profile.about} onChange={handleProfileChange} />
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
            {isLoading && <span className="profile-status" role="status">Loading profile…</span>}
            {saveError && <span className="profile-error" role="alert">{saveError}</span>}
            <button className="btn-primary" onClick={handleSave} disabled={isSaving || isLoading}>
              {isSaving ? "Saving…" : "Save changes"}
            </button>
            {saved && <span className="saved">Saved</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfileManagement;