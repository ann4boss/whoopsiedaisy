require("dotenv").config();
const express = require("express");
const session = require("express-session");
const passport = require("passport");
const OAuth2Strategy = require("passport-oauth2");
const fetch = require("node-fetch");

const app = express();

// WHOOP OAuth config
const whoopOAuthConfig = {
  authorizationURL: `${process.env.WHOOP_API_HOSTNAME}/oauth/oauth2/auth`,
  tokenURL: `${process.env.WHOOP_API_HOSTNAME}/oauth/oauth2/token`,
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL: process.env.CALLBACK_URL,
  state: true,
  scope: ["offline", "read:sleep", "read:recovery", "read:body_measurement"]
};

// What to do after successful login
const getUser = async (accessToken, refreshToken, results, profile, done) => {
  const { expires_in } = results;

  // No profile fetch since read:profile is disallowed
  const user = {
    accessToken,
    refreshToken,
    expiresAt: Date.now() + expires_in * 1000,
    scopes: results.scope, // you can store granted scopes here
  };

  return done(null, user);
};


const strategy = new OAuth2Strategy(whoopOAuthConfig, getUser);
passport.use("withWhoop", strategy);

// Setup Express session and Passport
app.use(session({ secret: "keyboard cat", resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// Routes
app.get("/", (req, res) => {
  res.send(`
    <h2>WHOOP OAuth Example</h2>
    <a href="/auth/whoop">Login with WHOOP</a>
  `);
});

app.get("/auth/whoop", passport.authenticate("withWhoop"));

app.get("/auth/whoop/callback",
  passport.authenticate("withWhoop", { failureRedirect: "/" }),
  (req, res) => {
    res.redirect("/welcome");
  }
);
// wWlcome page
app.get("/welcome", (req, res) => {
  if (!req.user) return res.redirect("/");

  res.send(`
    <h2>Welcome!</h2>
    <p>Your authorized scopes: ${req.user.scopes}</p>
    <pre>Access Token: ${req.user.accessToken}</pre>
    <pre>Refresh Token: ${req.user.refreshToken}</pre>
    <a href="/recovery">View Recovery Data</a><br>
    <a href="/sleep">View Sleep Data</a><br>
    <a href="/body_measurement">View Body Measurement Data</a><br>
    <a href="/logout">Logout</a>
  `);
});

app.get("/logout", (req, res) => {
  req.logout(() => {
    res.redirect("/");
  });
});

app.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});

// Recovery
app.get("/recovery", async (req, res) => {
  if (!req.user) return res.redirect("/");

  try {
    const response = await fetch(
      "https://api.prod.whoop.com/developer/v1/recovery",
      {
        headers: {
          Authorization: `Bearer ${req.user.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).send(`WHOOP API error: ${errorText}`);
    }

    const recoveryData = await response.json();

    res.send(`
      <h2>Recovery Data</h2>
      <pre>${JSON.stringify(recoveryData, null, 2)}</pre>
      <a href="/welcome">Back</a>
    `);
  } catch (error) {
    console.error("Error fetching recovery data:", error);
    res.status(500).send("Error fetching recovery data");
  }
});


// Sleep
app.get("/sleep", async (req, res) => {
  if (!req.user) return res.redirect("/");

  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const formatDate = (d) => d.toISOString().split("T")[0]; // YYYY-MM-DD

    const url = "https://api.prod.whoop.com/developer/v1/activity/sleep";

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${req.user.accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).send(`WHOOP API error: ${errorText}`);
    }

    const sleepData = await response.json();

    res.send(`
      <h2>Sleep Data</h2>
      <pre>${JSON.stringify(sleepData, null, 2)}</pre>
      <a href="/welcome">Back</a>
    `);
  } catch (error) {
    console.error("Error fetching sleep data:", error);
    res.status(500).send("Error fetching sleep data");
  }
});

// Body measurment
app.get("/body_measurement", async (req, res) => {
  if (!req.user) return res.redirect("/");

  try {
    const response = await fetch(
      "https://api.prod.whoop.com/developer/v1/user/measurement/body",
      {
        headers: {
          Authorization: `Bearer ${req.user.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).send(`WHOOP API error: ${errorText}`);
    }

    const bodyMeasurementData = await response.json();

    res.send(`
      <h2>Body Measurement Data</h2>
      <pre>${JSON.stringify(bodyMeasurementData, null, 2)}</pre>
      <a href="/welcome">Back</a>
    `);
  } catch (error) {
    console.error("Error fetching body measurement data:", error);
    res.status(500).send("Error fetching body measurement data");
  }
});

app.get("/logout", (req, res) => {
  req.logout(() => {
    res.redirect("/");
  });
});

app.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
