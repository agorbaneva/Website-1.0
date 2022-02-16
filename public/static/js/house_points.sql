DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS houses;
DROP TABLE IF EXISTS points;

CREATE TABLE users(u_id VARCHAR(100), age INT, house INT, PRIMARY KEY(u_id));
CREATE TABLE houses(h_id INT, name VARCHAR(30), PRIMARY KEY(h_id));
CREATE TABLE points(p_id VARCHAR(100), pts INT);


INSERT INTO houses(h_id, name) VALUES (0, 'troll');
INSERT INTO houses(h_id, name) VALUES (1, 'princess');
INSERT INTO houses(h_id, name) VALUES (2, 'spider');
INSERT INTO houses(h_id, name) VALUES (3, 'bird');
