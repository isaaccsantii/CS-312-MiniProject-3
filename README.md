# CS-312 Mini Project 3: Blog Web Application with PostgreSQL

A blog built with **Node.js, Express.js, EJS, and PostgreSQL**. It extends Mini Project 1: posts now live in a PostgreSQL database and persist between sessions, users sign up and sign in, and a user can edit or delete only the posts they created.

## Features

- **Sign up**: checks whether the `user_id` is taken before inserting a new user, then redirects to sign in
- **Sign in / sign out**: looks up the `user_id`, verifies the password, and starts a session
- **Blog feed**: all posts from the `blogs` table, newest first, with title, body, creator name, creator user ID, category, and created/edited times
- **Create / edit / delete posts**: `INSERT`, `UPDATE`, and `DELETE` against the database
- **Ownership checks**: Edit/Delete buttons appear only on your own posts, and the server compares the session's `user_id` with `creator_user_id` before any change (returns 403 otherwise)
- Category filter chips (carried over from Mini Project 1)
- Responsive styling for desktop and mobile
- **Bonus: hashed passwords.** Passwords are stored as bcrypt hashes, never in plain text. bcrypt was used instead of MD5 because MD5 is fast to brute-force and is no longer considered safe for passwords.
- **Bonus: Account page.** Signed-in users can change their user ID and name, and change their password. Changing the user ID updates their existing posts too (foreign key with `ON UPDATE CASCADE`).

## Step 1: Planning

### Database schema

```
users                                   blogs
-----------------------------           ---------------------------------------------
user_id     VARCHAR(255) PK  <──────┐   blog_id          SERIAL PK
password    VARCHAR(255)  (bcrypt)  └── creator_user_id  VARCHAR(255) FK → users.user_id
name        VARCHAR(255)                creator_name     VARCHAR(255)
created_at  TIMESTAMP                   title            VARCHAR(255)
                                        body             TEXT
                                        category         VARCHAR(50)
                                        date_created     TIMESTAMP
                                        date_updated     TIMESTAMP (null until edited)
```

The full SQL is in [`db/schema.sql`](db/schema.sql). Starter rows (3 users, 6 posts) are in [`db/seed.sql`](db/seed.sql).

### User action → database operation

| User action          | SQL                                                                                      |
| -------------------- | ---------------------------------------------------------------------------------------- |
| Sign up              | `SELECT 1 FROM users WHERE user_id = $1`, then `INSERT INTO users ...`                    |
| Sign in              | `SELECT ... FROM users WHERE user_id = $1`, then compare password hash                    |
| View feed            | `SELECT ... FROM blogs [WHERE category = $1] ORDER BY date_created DESC`                 |
| Create post          | `INSERT INTO blogs (creator_name, creator_user_id, title, body, category, date_created)`  |
| Edit post            | `UPDATE blogs SET ... WHERE blog_id = $1 AND creator_user_id = $2`                        |
| Delete post          | `DELETE FROM blogs WHERE blog_id = $1 AND creator_user_id = $2`                           |
| Change user ID/name  | `UPDATE users SET user_id = $1, name = $2 WHERE user_id = $3` (cascades to `blogs`)      |
| Change password      | `UPDATE users SET password = $1 WHERE user_id = $2`                                       |

All queries use parameterized placeholders (`$1`, `$2`, ...) to prevent SQL injection.

## Setup

**Requirements:** Node.js 18+ and PostgreSQL (with pgAdmin).

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and set `PGPASSWORD` to your PostgreSQL password.
3. Create the database and tables. Choose **one** option:
   - **pgAdmin:** right-click *Databases → Create → Database…* and name it `BlogDB`. Open *Query Tool* on `BlogDB`, then open and run `db/schema.sql`, then `db/seed.sql`.
   - **Script:** `npm run db:setup` creates `BlogDB` (if needed) and runs both files.
4. Start the app:
   ```bash
   npm start
   ```
   Open http://localhost:3000

### Starter accounts

| User ID | Password    | Name           |
| ------- | ----------- | -------------- |
| isaac   | isaac123    | Isaac Santiago |
| maria   | maria2026   | Maria Lopez    |
| devon   | devon2026   | Devon Clark    |

## Routes

| Method | Path                 | Purpose                                     | Sign-in needed |
| ------ | -------------------- | ------------------------------------------- | -------------- |
| GET    | `/`                  | Blog feed (+ new-post form when signed in)  | No             |
| GET    | `/signup`            | Sign-up form                                | No             |
| POST   | `/signup`            | Create account                              | No             |
| GET    | `/signin`            | Sign-in form                                | No             |
| POST   | `/signin`            | Sign in                                     | No             |
| POST   | `/signout`           | Sign out                                    | Yes            |
| POST   | `/posts`             | Create a post                               | Yes            |
| GET    | `/posts/:id/edit`    | Edit form (owner only)                      | Yes            |
| POST   | `/posts/:id/edit`    | Save edits (owner only)                     | Yes            |
| POST   | `/posts/:id/delete`  | Delete a post (owner only)                  | Yes            |
| GET    | `/account`           | Account page                                | Yes            |
| POST   | `/account/profile`   | Change user ID and name                     | Yes            |
| POST   | `/account/password`  | Change password                             | Yes            |

## Testing

Tested in Chrome (desktop at 1280px wide and mobile at 390px wide):

- Sign up with a taken user ID → error asking for a different ID; with a new ID → redirected to sign in
- Sign in with a wrong password → error; with correct credentials → redirected to the feed
- Create, edit, and delete your own posts; changes show on the feed and survive a server restart
- Trying to edit or delete another user's post (including sending the request directly) → 403
- Signed-out requests to create/edit/delete → redirected to sign in
- Account page: change user ID (posts follow), change name, change password (old password stops working)

Screenshots are in [`screenshots/`](screenshots).

## Structure

```
index.js              Express server and routes
db/index.js           PostgreSQL connection pool
db/schema.sql         CREATE TABLE statements
db/seed.sql           Starter users and posts
db/setup-db.js        Optional script that creates BlogDB and runs the SQL files
views/                EJS pages (index, signin, signup, edit, account, 404, error) and partials
public/css/style.css  Styling
screenshots/          Desktop and mobile screenshots
```
