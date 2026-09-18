
from database import Database
from datetime import datetime

db = Database()

unique_email = f"test_{datetime.now().strftime('%Y%m%d%H%M%S')}@email.com"
updated_email = f"updated_{datetime.now().strftime('%Y%m%d%H%M%S')}@email.com"

user_id = db.create_user(
    "Test User",
    unique_email,
    "fake_password_hash",
    "student"
)

print("Created user ID:", user_id)

user = db.get_user_by_email(unique_email)

print("\nUser by email:")
print(user)

user = db.get_user_by_id(user_id)

print("\nUser by ID:")
print(user)

result = db.update_user(
    user_id,
    "Updated User",
    updated_email,
    "student"
)

print("\nUpdate user:", result)

user = db.get_user_by_id(user_id)

print("\nAfter update:")
print(user)
