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

// Step 1: What to do after successful login
const getUser = async (accessToken, refreshToken, results, profile, done) => {
  const { expires_in } = results;

  const user = {
    accessToken,
    refreshToken,
    expiresAt: Date.now() + expires_in * 1000,
    profile
  };

  return done(null, user);
};

// Step 2: How to get user profile from WHOOP
const fetchProfile = async (accessToken, done) => {
  try {
    const res = await fetch(
      "https://api.prod.whoop.com/developer/v1/user/profile/basic",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!res.ok) {
      // If response status not 2xx, throw error with status and message
      const text = await res.text();
      throw new Error(`WHOOP API error: ${res.status} ${res.statusText} - ${text}`);
    }

    const profile = await res.json();
    done(null, profile);
  } catch (error) {
    console.error("Error fetching WHOOP profile:", error);
    done(error);
  }
};

// Configure Passport strategy
const strategy = new OAuth2Strategy(whoopOAuthConfig, getUser);
strategy.userProfile = fetchProfile;
passport.use("withWhoop", strategy);

// Set up Express session and Passport
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
  passport.authenticate("withWhoop", { failureRedirect: "/login" }),
  (req, res) => {
    res.redirect("/welcome");
  }
);

app.get("/welcome", (req, res) => {
  if (!req.user) return res.redirect("/");

  res.send(`
    <h2>Welcome, ${req.user.profile.first_name || "user"}!</h2>
    <pre>${JSON.stringify(req.user, null, 2)}</pre>
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
