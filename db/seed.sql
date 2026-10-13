-- CS-312 Mini Project 3: starter data (run after schema.sql)
-- Passwords are stored as bcrypt hashes. Plain-text versions for signing in:
--   isaac / isaac123
--   maria / maria2026
--   devon / devon2026

INSERT INTO users (user_id, password, name) VALUES
  ('isaac', '$2b$10$ZW/U4291omboHJlSl8jEL.qFaPRSTDe499y7Q5H/Z.DJWhWI2BeWq', 'Isaac Santiago'),
  ('maria', '$2b$10$Ae4vNbibzCFfBXvjxiZFk.B7rbVScUhzljjyTNeepatWhLKXcVF9i', 'Maria Lopez'),
  ('devon', '$2b$10$p8TRmeeomiXdgaZdzD33/ehlKK5pRW1hGq9.ptVa6kQQWLMZHOq0O', 'Devon Clark');

INSERT INTO blogs (creator_name, creator_user_id, title, body, category, date_created) VALUES
  ('Isaac Santiago', 'isaac', 'Welcome to the blog',
   E'This blog now runs on PostgreSQL, so posts survive server restarts.\n\nSign in to write your own posts. You can edit or delete only the posts you created.',
   'Other', '2026-09-28 09:15:00'),
  ('Maria Lopez', 'maria', 'Three habits that saved my semester',
   E'1. Block out study time on a calendar like it is a class.\n2. Start assignments the day they are posted, even if it is only 20 minutes.\n3. Go to office hours before you are stuck, not after.',
   'Education', '2026-10-01 14:40:00'),
  ('Devon Clark', 'devon', 'A weekend in Sedona',
   E'Red rocks, cool mornings, and the Cathedral Rock trail at sunrise. Bring more water than you think you need and start early to beat the crowds.',
   'Travel', '2026-10-03 18:05:00'),
  ('Isaac Santiago', 'isaac', 'Parameterized queries 101',
   E'Never build SQL by gluing strings together. With node-postgres you write placeholders like $1 and $2 and pass the values separately:\n\npool.query(''SELECT * FROM blogs WHERE blog_id = $1'', [id])\n\nThe driver sends the values apart from the SQL text, which shuts the door on SQL injection.',
   'Tech', '2026-10-06 11:30:00'),
  ('Maria Lopez', 'maria', 'Meal prep on a student budget',
   E'Sunday plan: one big tray of roasted vegetables, a pot of rice, and a protein. Mix and match through Wednesday, then repeat a smaller batch midweek.',
   'Lifestyle', '2026-10-08 08:20:00'),
  ('Devon Clark', 'devon', 'Why I switched to a standing desk',
   E'After a month: less afternoon slump and fewer stiff shoulders. The trick is alternating. Stand for 30 to 45 minutes, sit for a while, repeat.',
   'Lifestyle', '2026-10-10 16:50:00');
