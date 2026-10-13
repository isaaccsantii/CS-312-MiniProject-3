require("dotenv").config({ quiet: true });

const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const path = require("path");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;
const SALT_ROUNDS = 10;
const CATEGORIES = ["Tech", "Lifestyle", "Education", "Travel", "Other"];

// ---------- Configuration ----------
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true })); // parse form bodies
app.use(express.static(path.join(__dirname, "public")));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-only-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax", maxAge: 1000 * 60 * 60 * 8 }, // 8 hours
  })
);

// Make the signed-in user and any one-time flash message available to every view.
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
});

// ---------- Helpers ----------
function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function setFlash(req, type, message) {
  req.session.flash = { type, message };
}

function requireLogin(req, res, next) {
  if (req.session.user) return next();
  setFlash(req, "error", "Please sign in first.");
  res.redirect("/signin");
}

function redirectIfLoggedIn(req, res, next) {
  if (req.session.user) return res.redirect("/");
  next();
}

const USER_ID_RE = /^[A-Za-z0-9_.-]{3,30}$/;

function validateUserId(userId, errors) {
  if (!USER_ID_RE.test(userId)) {
    errors.push("User ID must be 3-30 characters: letters, numbers, dot, dash or underscore.");
  }
}

function validatePassword(password, errors, label = "Password") {
  if (password.length < 6) errors.push(`${label} must be at least 6 characters.`);
  if (password.length > 72) errors.push(`${label} must be 72 characters or fewer.`);
}

function validatePost(body) {
  const data = {
    title: clean(body.title),
    body: clean(body.body),
    category: CATEGORIES.includes(body.category) ? body.category : "Other",
  };
  const errors = [];
  if (!data.title) errors.push("A title is required.");
  if (data.title.length > 255) errors.push("The title must be 255 characters or fewer.");
  if (!data.body) errors.push("The post content cannot be empty.");
  return { data, errors };
}

function parseId(raw) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function getUser(userId) {
  const { rows } = await db.query(
    "SELECT user_id, password, name, created_at FROM users WHERE user_id = $1",
    [userId]
  );
  return rows[0] || null;
}

async function getBlog(blogId) {
  const { rows } = await db.query("SELECT * FROM blogs WHERE blog_id = $1", [blogId]);
  return rows[0] || null;
}

// Load a blog and confirm the signed-in user created it.
// Sends the 404/403 page itself and returns null if access is not allowed.
async function loadOwnBlog(req, res) {
  const id = parseId(req.params.id);
  const blog = id && (await getBlog(id));
  if (!blog) {
    res.status(404).render("404");
    return null;
  }
  if (blog.creator_user_id !== req.session.user.user_id) {
    res.status(403).render("error", {
      title: "Not allowed",
      heading: "That isn't your post",
      message: "You can only edit or delete posts you created.",
    });
    return null;
  }
  return blog;
}

async function renderFeed(res, { selected = "All", errors = [], form = null, status = 200 } = {}) {
  const params = [];
  let sql =
    "SELECT blog_id, creator_name, creator_user_id, title, body, category, date_created, date_updated FROM blogs";
  if (selected !== "All") {
    sql += " WHERE category = $1";
    params.push(selected);
  }
  sql += " ORDER BY date_created DESC, blog_id DESC";

  const [{ rows: blogs }, { rows: countRows }] = await Promise.all([
    db.query(sql, params),
    db.query("SELECT COUNT(*)::int AS total FROM blogs"),
  ]);

  res.status(status).render("index", {
    blogs,
    totalBlogs: countRows[0].total,
    categories: CATEGORIES,
    selected,
    errors,
    form: form || { title: "", body: "", category: CATEGORIES[0] },
  });
}

// ---------- Sign up / sign in / sign out ----------

app.get("/signup", redirectIfLoggedIn, (req, res) => {
  res.render("signup", { errors: [], form: { user_id: "", name: "" } });
});

app.post("/signup", redirectIfLoggedIn, async (req, res) => {
  const form = { user_id: clean(req.body.user_id), name: clean(req.body.name) };
  const password = typeof req.body.password === "string" ? req.body.password : "";
  const confirm = typeof req.body.confirm_password === "string" ? req.body.confirm_password : "";

  const errors = [];
  validateUserId(form.user_id, errors);
  if (!form.name) errors.push("Your name is required.");
  validatePassword(password, errors);
  if (password !== confirm) errors.push("Passwords do not match.");

  // Is the user_id already taken?
  if (!errors.length) {
    const { rowCount } = await db.query("SELECT 1 FROM users WHERE user_id = $1", [form.user_id]);
    if (rowCount > 0) {
      errors.push(`The user ID "${form.user_id}" is already taken. Please choose a different one.`);
    }
  }
  if (errors.length) return res.status(400).render("signup", { errors, form });

  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  await db.query("INSERT INTO users (user_id, password, name) VALUES ($1, $2, $3)", [
    form.user_id,
    hash,
    form.name,
  ]);

  setFlash(req, "success", "Account created! Sign in with your new user ID and password.");
  res.redirect("/signin");
});

app.get("/signin", redirectIfLoggedIn, (req, res) => {
  res.render("signin", { errors: [], form: { user_id: "" } });
});

app.post("/signin", redirectIfLoggedIn, async (req, res, next) => {
  const form = { user_id: clean(req.body.user_id) };
  const password = typeof req.body.password === "string" ? req.body.password : "";

  // Look up the user_id with SELECT ... WHERE, then compare the password with its stored hash.
  const user = form.user_id ? await getUser(form.user_id) : null;
  const ok = user ? await bcrypt.compare(password, user.password) : false;

  if (!ok) {
    return res.status(401).render("signin", {
      errors: ["Incorrect user ID or password. Please enter your correct credentials."],
      form,
    });
  }

  // New session ID on login to prevent session fixation.
  req.session.regenerate((err) => {
    if (err) return next(err);
    req.session.user = { user_id: user.user_id, name: user.name };
    setFlash(req, "success", `Welcome back, ${user.name}!`);
    req.session.save(() => res.redirect("/"));
  });
});

app.post("/signout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.redirect("/signin");
  });
});

// ---------- Blog feed ----------

app.get("/", async (req, res) => {
  const selected = CATEGORIES.includes(req.query.category) ? req.query.category : "All";
  await renderFeed(res, { selected });
});

// Create a post
app.post("/posts", requireLogin, async (req, res) => {
  const { data, errors } = validatePost(req.body);
  if (errors.length) return renderFeed(res, { errors, form: data, status: 400 });

  const { user_id, name } = req.session.user;
  await db.query(
    `INSERT INTO blogs (creator_name, creator_user_id, title, body, category, date_created)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [name, user_id, data.title, data.body, data.category]
  );
  setFlash(req, "success", "Post published.");
  res.redirect("/");
});

// Show the edit form (owner only)
app.get("/posts/:id/edit", requireLogin, async (req, res) => {
  const blog = await loadOwnBlog(req, res);
  if (!blog) return;
  res.render("edit", { blog, categories: CATEGORIES, errors: [] });
});

// Save edits (owner only)
app.post("/posts/:id/edit", requireLogin, async (req, res) => {
  const blog = await loadOwnBlog(req, res);
  if (!blog) return;

  const { data, errors } = validatePost(req.body);
  if (errors.length) {
    return res.status(400).render("edit", {
      blog: { ...blog, ...data },
      categories: CATEGORIES,
      errors,
    });
  }

  // The creator_user_id check in WHERE is a second safety net on top of loadOwnBlog.
  await db.query(
    `UPDATE blogs SET title = $1, body = $2, category = $3, date_updated = NOW()
     WHERE blog_id = $4 AND creator_user_id = $5`,
    [data.title, data.body, data.category, blog.blog_id, req.session.user.user_id]
  );
  setFlash(req, "success", "Post updated.");
  res.redirect("/");
});

// Delete a post (owner only)
app.post("/posts/:id/delete", requireLogin, async (req, res) => {
  const blog = await loadOwnBlog(req, res);
  if (!blog) return;

  await db.query("DELETE FROM blogs WHERE blog_id = $1 AND creator_user_id = $2", [
    blog.blog_id,
    req.session.user.user_id,
  ]);
  setFlash(req, "success", "Post deleted.");
  res.redirect("/");
});

// ---------- Account page (bonus) ----------

async function renderAccount(req, res, { profileErrors = [], passwordErrors = [], form = null, status = 200 } = {}) {
  const user = await getUser(req.session.user.user_id);
  const { rows } = await db.query("SELECT COUNT(*)::int AS n FROM blogs WHERE creator_user_id = $1", [
    user.user_id,
  ]);
  res.status(status).render("account", {
    user,
    postCount: rows[0].n,
    profileErrors,
    passwordErrors,
    form: form || { user_id: user.user_id, name: user.name },
  });
}

app.get("/account", requireLogin, async (req, res) => {
  await renderAccount(req, res);
});

// Update user_id and/or display name
app.post("/account/profile", requireLogin, async (req, res) => {
  const current = await getUser(req.session.user.user_id);
  const form = { user_id: clean(req.body.user_id), name: clean(req.body.name) };
  const password = typeof req.body.current_password === "string" ? req.body.current_password : "";

  const errors = [];
  validateUserId(form.user_id, errors);
  if (!form.name) errors.push("Your name is required.");
  if (!(await bcrypt.compare(password, current.password))) {
    errors.push("Your current password is incorrect.");
  }
  if (!errors.length && form.user_id !== current.user_id) {
    const { rowCount } = await db.query("SELECT 1 FROM users WHERE user_id = $1", [form.user_id]);
    if (rowCount > 0) errors.push(`The user ID "${form.user_id}" is already taken.`);
  }
  if (errors.length) return renderAccount(req, res, { profileErrors: errors, form, status: 400 });

  // Transaction: the FK's ON UPDATE CASCADE moves blogs.creator_user_id to the new user_id,
  // and we also refresh creator_name on the user's existing posts.
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE users SET user_id = $1, name = $2 WHERE user_id = $3", [
      form.user_id,
      form.name,
      current.user_id,
    ]);
    await client.query("UPDATE blogs SET creator_name = $1 WHERE creator_user_id = $2", [
      form.name,
      form.user_id,
    ]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  req.session.user = { user_id: form.user_id, name: form.name };
  setFlash(req, "success", "Account details updated.");
  res.redirect("/account");
});

// Change password
app.post("/account/password", requireLogin, async (req, res) => {
  const current = await getUser(req.session.user.user_id);
  const pick = (k) => (typeof req.body[k] === "string" ? req.body[k] : "");
  const currentPassword = pick("current_password");
  const newPassword = pick("new_password");
  const confirm = pick("confirm_password");

  const errors = [];
  if (!(await bcrypt.compare(currentPassword, current.password))) {
    errors.push("Your current password is incorrect.");
  }
  validatePassword(newPassword, errors, "New password");
  if (newPassword !== confirm) errors.push("New passwords do not match.");
  if (errors.length) return renderAccount(req, res, { passwordErrors: errors, status: 400 });

  const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await db.query("UPDATE users SET password = $1 WHERE user_id = $2", [hash, current.user_id]);
  setFlash(req, "success", "Password changed.");
  res.redirect("/account");
});

// ---------- Fallbacks ----------

app.use((req, res) => {
  res.status(404).render("404");
});

// Express 5 forwards errors thrown in async handlers here.
app.use((err, req, res, next) => {
  console.error(err);
  const dbDown = ["ECONNREFUSED", "3D000", "28P01"].includes(err.code);
  res.status(500).render("error", {
    title: "Error",
    heading: "Something went wrong",
    message: dbDown
      ? "Could not reach the database. Check that PostgreSQL is running and your .env settings are correct."
      : "An unexpected error occurred. Please try again.",
  });
});

app.listen(PORT, () => {
  console.log(`Blog running at http://localhost:${PORT}`);
});
