import pymysql
from .config import DB


def connect():
    return pymysql.connect(**DB, cursorclass=pymysql.cursors.DictCursor, autocommit=True)
