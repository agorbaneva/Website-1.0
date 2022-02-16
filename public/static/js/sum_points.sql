DROP PROCEDURE IF EXISTS get_house_points; 

DELIMITER $$ 

CREATE PROCEDURE get_house_points(IN usr_house CHAR(20))

BEGIN
    SELECT sum(pts) FROM points 
    	JOIN users on points.p_id = users.u_id 
    	JOIN houses on users.house = houses.h_id 
    	WHERE name=usr_house;
END$$

DELIMITER ; 

-- use this way: 
-- CALL get_house_points('ravenclaw')
-- CALL get_house_points('gryffindor')