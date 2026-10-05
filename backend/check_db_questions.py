import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

conn = psycopg2.connect(
    dbname=os.environ.get('DATABASE_NAME', 'api'),
    user=os.environ.get('DATABASE_USERNAME', 'postgres'),
    password=os.environ.get('DATABASE_PASSWORD', 'secret'),
    host=os.environ.get('DATABASE_HOST', 'localhost'),
    port=os.environ.get('DATABASE_PORT', '5432')
)
cur = conn.cursor()

cur.execute('SELECT id, title, topic, "hskLevel" FROM practice_set ORDER BY "hskLevel", id LIMIT 30;')
rows = cur.fetchall()
print('=== PRACTICE SETS ===')
for r in rows:
    print(r)

cur.execute('SELECT "hskLevel", COUNT(*) FROM question GROUP BY "hskLevel" ORDER BY "hskLevel";')
print('=== QUESTION COUNTS BY HSK ===')
for r in cur.fetchall():
    print(r)

cur.execute('SELECT id, "hskLevel", payload FROM question WHERE "hskLevel" = 1 LIMIT 5;')
print('=== SAMPLE HSK 1 QUESTIONS ===')
for r in cur.fetchall():
    print(r)

cur.execute('SELECT id, "hskLevel", payload FROM question WHERE "hskLevel" = 2 LIMIT 5;')
print('=== SAMPLE HSK 2 QUESTIONS ===')
for r in cur.fetchall():
    print(r)
