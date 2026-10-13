-- CS-312 Mini Project 3: database schema
-- Create the database first (pgAdmin: right-click Databases > Create > Database "BlogDB"),
-- or in psql:  CREATE DATABASE "BlogDB";
-- Then run this file inside BlogDB, followed by seed.sql.

DROP TABLE IF EXISTS blogs;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  user_id     VARCHAR(255) PRIMARY KEY,
  password    VARCHAR(255) NOT NULL,          -- bcrypt hash, never the raw password
  name        VARCHAR(255) NOT NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE blogs (
  blog_id          SERIAL PRIMARY KEY,
  creator_name     VARCHAR(255) NOT NULL,
  creator_user_id  VARCHAR(255) NOT NULL
                   REFERENCES users (user_id)
                   ON UPDATE CASCADE           -- changing a user_id on the Account page follows through to their posts
                   ON DELETE CASCADE,
  title            VARCHAR(255) NOT NULL,
  body             TEXT         NOT NULL,
  category         VARCHAR(50)  NOT NULL DEFAULT 'Other',
  date_created     TIMESTAMP    NOT NULL DEFAULT NOW(),
  date_updated     TIMESTAMP
);

CREATE INDEX blogs_creator_idx ON blogs (creator_user_id);
CREATE INDEX blogs_date_idx    ON blogs (date_created DESC);
