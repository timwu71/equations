/* deprecated */

PRAGMA foreign_keys = ON;

INSERT INTO users(username, password)
VALUES ('Server', 'sha512$bc01cc83f48a4f9692d79b7a7a2e3eae$a2cadd82b348fc1516da2832072bec487cf7deed04dce75d4bea014e5a73d6ab1ceba676030fdf9177098f332997c70f4d04aa2eaa35a3f638a8c9a6f08eb5c6'),
	('Tony', 'sha512$a45ffdcc71884853a2cba9e6bc55e812$c739cef1aec45c6e345c8463136dc1ae2fe19963106cf748baf87c7102937aa96928aa1db7fe1d8da6bd343428ff3167f4500c8a61095fb771957b4367868fb8'),
	('FreezingTiger', 'sha512$a45ffdcc71884853a2cba9e6bc55e812$c739cef1aec45c6e345c8463136dc1ae2fe19963106cf748baf87c7102937aa96928aa1db7fe1d8da6bd343428ff3167f4500c8a61095fb771957b4367868fb8');
	
INSERT INTO games(nonce, ended, players) 
VALUES('example', 1, "Kern,Danny,Brian");

INSERT INTO games(nonce, ended, players, p1scores, p2scores, p3scores, cube_index, resources, goal, required, turn)  
VALUES('example2', 1, "Kern,Danny,Brian", "4,2,6", "2,6,4", "6,4,2", "4,3,5,1,4,2,4,5,1,2,1,4,1,5,0,0,0,2,4,2,0,1,4,1", 
"4,3,5,1,4,2,4,5,1,2,1,4,1,5,0,0,0,2,4,2,0,1,-1,-1", "23", "22", 0);
