DROP PROCEDURE IF EXISTS scan_devotee_ids//

CREATE PROCEDURE scan_devotee_ids()
BEGIN
  DECLARE done INT DEFAULT 0;
  DECLARE v_t VARCHAR(128);
  DECLARE v_c VARCHAR(128);
  DECLARE cur CURSOR FOR
    SELECT c.TABLE_NAME, c.COLUMN_NAME
    FROM information_schema.COLUMNS c
    JOIN information_schema.TABLES t
      ON t.TABLE_SCHEMA = c.TABLE_SCHEMA AND t.TABLE_NAME = c.TABLE_NAME
    WHERE c.TABLE_SCHEMA = DATABASE()
      AND t.TABLE_TYPE = 'BASE TABLE'
      AND c.DATA_TYPE IN ('char','varchar')
      AND (c.CHARACTER_MAXIMUM_LENGTH IS NULL OR c.CHARACTER_MAXIMUM_LENGTH >= 8);
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

  DROP TEMPORARY TABLE IF EXISTS tmp_scan;
  CREATE TEMPORARY TABLE tmp_scan (
    table_name VARCHAR(128), column_name VARCHAR(128), old_id_rows INT
  );

  OPEN cur;
  lp: LOOP
    FETCH cur INTO v_t, v_c;
    IF done = 1 THEN LEAVE lp; END IF;
    SET @q = CONCAT(
      'INSERT INTO tmp_scan SELECT ''', v_t, ''', ''', v_c, ''', COUNT(*) FROM `', v_t,
      '` WHERE `', v_c, '` LIKE ''dev\\_%'' AND `', v_c, '` REGEXP ''^dev_[0-9]+_[0-9]+$''');
    PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;
  END LOOP;
  CLOSE cur;

  SELECT table_name, column_name, old_id_rows
  FROM tmp_scan WHERE old_id_rows > 0
  ORDER BY table_name, column_name;
  DROP TEMPORARY TABLE tmp_scan;
END//

CALL scan_devotee_ids()//
DROP PROCEDURE scan_devotee_ids//