require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");
const multer = require("multer");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const session = require("express-session"); // for session management
const app = express();

// DB Connection
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

// Middlewares
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.set("view engine", "ejs"); // Set the view engine to EJS
app.set("views", path.join(__dirname, "views")); // Ensure Express knows the views directory
app.use("/uploads", express.static("uploads"));

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = "./uploads";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage: storage });

// Serve static files (like CSS, JS) from the 'public' directory
app.use(express.static(path.join(__dirname, "public")));

// Serve HTML form
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "register.html"));
});

// Handle form submission
app.post("/register", upload.any(), (req, res) => {
  const teamData = req.body;
  const players = [];

  // Group player data
  Object.keys(req.body.players).forEach((i) => {
    players.push({
      ...req.body.players[i],
      photo: null,
    });
  });

  // Map uploaded photos to players
  req.files.forEach((file, index) => {
    if (players[index]) {
      players[index].photo = file.filename;
    }
  });

  // Insert team
  const teamSQL = `
    INSERT INTO teams (team_name, county, training_ground, coach_name, coach_phone, coach_email,
      manager_name, manager_phone, manager_email, age_category, home_jersey, away_jersey)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const teamValues = [
    teamData.team_name,
    teamData.county,
    teamData.training_ground,
    teamData.coach_name,
    teamData.coach_phone,
    teamData.coach_email,
    teamData.manager_name,
    teamData.manager_phone,
    teamData.manager_email,
    teamData.age_category,
    teamData.home_jersey,
    teamData.away_jersey,
  ];

  db.query(teamSQL, teamValues, (err, result) => {
    if (err) return res.status(500).send(err);
    const teamId = result.insertId;

    // Insert players
    const playerSQL = `
      INSERT INTO players (team_id, name, birth_cert, dob, age, father_name, school,
        county_of_birth, sub_county, photo, parent_contact)
      VALUES ?
    `;

    const playerValues = players.map((p) => [
      teamId,
      p.name,
      p.birth_cert,
      p.dob,
      p.age,
      p.father,
      p.school,
      p.county_of_birth,
      p.sub_county,
      p.photo,
      p.parent_contact,
    ]);

    db.query(playerSQL, [playerValues], (err2) => {
      if (err2) return res.status(500).send(err2);
      res.send("Team and players registered successfully!");
    });
  });
});

// Admin page route
app.get("/admin", (req, res) => {
  const teamsSQL = "SELECT * FROM teams";
  db.query(teamsSQL, (err, teams) => {
    if (err) return res.status(500).send("Error fetching teams.");

    // For each team, fetch the corresponding players
    const playerSQL = "SELECT * FROM players WHERE team_id = ?";
    const teamPlayers = [];

    let completedRequests = 0;
    teams.forEach((team, index) => {
      db.query(playerSQL, [team.id], (err2, players) => {
        if (err2) return res.status(500).send("Error fetching players.");

        teamPlayers.push({
          team,
          players,
        });

        completedRequests++;

        // Once all teams' players have been fetched, render the admin page
        if (completedRequests === teams.length) {
          res.render("admin", { teams: teamPlayers });
        }
      });
    });
  });
});

// Admin page authentication middleware
const adminAuth = (req, res, next) => {
  const { username, password } = req.query;
  if (username === "admin" && password === "password123") {
    return next();
  }
  res.status(403).send("Unauthorized");
};

// Admin page route (use authentication middleware)
app.get("/admin", adminAuth, (req, res) => {
  const teamsSQL = "SELECT * FROM teams";
  db.query(teamsSQL, (err, teams) => {
    if (err) return res.status(500).send("Error fetching teams.");
    // For each team, fetch the corresponding players
    const playerSQL = "SELECT * FROM players WHERE team_id = ?";
    const teamPlayers = [];

    let completedRequests = 0;
    teams.forEach((team, index) => {
      db.query(playerSQL, [team.id], (err2, players) => {
        if (err2) return res.status(500).send("Error fetching players.");

        teamPlayers.push({
          team,
          players,
        });

        completedRequests++;

        // Once all teams' players have been fetched, render the admin page
        if (completedRequests === teams.length) {
          res.render("admin", { teams: teamPlayers });
        }
      });
    });
  });
});

app.listen(3000, () => {
  console.log("Server started on http://localhost:3000");
});
