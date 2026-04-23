"""
High School Management System API

A super simple FastAPI application that allows students to view and sign up
for extracurricular activities at Mergington High School.
"""

import hashlib
import os
import secrets
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr
from starlette.middleware.sessions import SessionMiddleware

app = FastAPI(title="Mergington High School API",
              description="API for viewing and signing up for extracurricular activities")

app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("SESSION_SECRET", "development-secret-change-me"),
    same_site="lax",
)

# Mount the static files directory
current_dir = Path(__file__).parent
app.mount("/static", StaticFiles(directory=os.path.join(Path(__file__).parent,
          "static")), name="static")

# In-memory activity database
activities = {
    "Chess Club": {
        "description": "Learn strategies and compete in chess tournaments",
        "schedule": "Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 12,
        "participants": ["michael@mergington.edu", "daniel@mergington.edu"]
    },
    "Programming Class": {
        "description": "Learn programming fundamentals and build software projects",
        "schedule": "Tuesdays and Thursdays, 3:30 PM - 4:30 PM",
        "max_participants": 20,
        "participants": ["emma@mergington.edu", "sophia@mergington.edu"]
    },
    "Gym Class": {
        "description": "Physical education and sports activities",
        "schedule": "Mondays, Wednesdays, Fridays, 2:00 PM - 3:00 PM",
        "max_participants": 30,
        "participants": ["john@mergington.edu", "olivia@mergington.edu"]
    },
    "Soccer Team": {
        "description": "Join the school soccer team and compete in matches",
        "schedule": "Tuesdays and Thursdays, 4:00 PM - 5:30 PM",
        "max_participants": 22,
        "participants": ["liam@mergington.edu", "noah@mergington.edu"]
    },
    "Basketball Team": {
        "description": "Practice and play basketball with the school team",
        "schedule": "Wednesdays and Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["ava@mergington.edu", "mia@mergington.edu"]
    },
    "Art Club": {
        "description": "Explore your creativity through painting and drawing",
        "schedule": "Thursdays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["amelia@mergington.edu", "harper@mergington.edu"]
    },
    "Drama Club": {
        "description": "Act, direct, and produce plays and performances",
        "schedule": "Mondays and Wednesdays, 4:00 PM - 5:30 PM",
        "max_participants": 20,
        "participants": ["ella@mergington.edu", "scarlett@mergington.edu"]
    },
    "Math Club": {
        "description": "Solve challenging problems and participate in math competitions",
        "schedule": "Tuesdays, 3:30 PM - 4:30 PM",
        "max_participants": 10,
        "participants": ["james@mergington.edu", "benjamin@mergington.edu"]
    },
    "Debate Team": {
        "description": "Develop public speaking and argumentation skills",
        "schedule": "Fridays, 4:00 PM - 5:30 PM",
        "max_participants": 12,
        "participants": ["charlotte@mergington.edu", "henry@mergington.edu"]
    }
}

# In-memory user storage (for learning/demo purposes)
users = {
    "student": {
        "username": "student",
        "email": "student@mergington.edu",
        "password_hash": hashlib.sha256("password123".encode("utf-8")).hexdigest(),
    }
}


class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    identifier: str
    password: str


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def get_current_user(request: Request):
    username = request.session.get("username")
    if not username or username not in users:
        raise HTTPException(status_code=401, detail="Authentication required")
    return users[username]


def find_user_by_identifier(identifier: str):
    lowered = identifier.strip().lower()
    for user in users.values():
        if user["username"].lower() == lowered or user["email"].lower() == lowered:
            return user
    return None


@app.get("/")
def root():
    return RedirectResponse(url="/static/index.html")


@app.post("/auth/register")
def register(payload: RegisterRequest):
    username = payload.username.strip()
    email = payload.email.strip().lower()

    if len(username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")

    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    if username in users:
        raise HTTPException(status_code=400, detail="Username is already taken")

    if any(existing["email"].lower() == email for existing in users.values()):
        raise HTTPException(status_code=400, detail="Email is already registered")

    users[username] = {
        "username": username,
        "email": email,
        "password_hash": hash_password(payload.password),
    }

    return {"message": "Account created successfully"}


@app.post("/auth/login")
def login(payload: LoginRequest, request: Request):
    user = find_user_by_identifier(payload.identifier)

    if not user or user["password_hash"] != hash_password(payload.password):
        raise HTTPException(status_code=401, detail="Invalid username/email or password")

    request.session["username"] = user["username"]
    request.session["session_token"] = secrets.token_hex(16)

    return {
        "message": "Logged in successfully",
        "user": {
            "username": user["username"],
            "email": user["email"],
        },
    }


@app.post("/auth/logout")
def logout(request: Request):
    request.session.clear()
    return {"message": "Logged out successfully"}


@app.get("/auth/me")
def me(request: Request):
    username = request.session.get("username")
    if not username or username not in users:
        return {"authenticated": False}

    user = users[username]
    return {
        "authenticated": True,
        "user": {
            "username": user["username"],
            "email": user["email"],
        },
    }


@app.get("/activities")
def get_activities():
    return activities


@app.post("/activities/{activity_name}/signup")
def signup_for_activity(activity_name: str, request: Request):
    """Sign up a student for an activity"""
    current_user = get_current_user(request)

    # Validate activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Get the specific activity
    activity = activities[activity_name]
    email = current_user["email"]

    # Validate student is not already signed up
    if email in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is already signed up"
        )

    # Add student
    activity["participants"].append(email)
    return {"message": f"Signed up {email} for {activity_name}"}


@app.delete("/activities/{activity_name}/unregister")
def unregister_from_activity(activity_name: str, request: Request, email: str | None = None):
    """Unregister a student from an activity"""
    current_user = get_current_user(request)

    # Validate activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Get the specific activity
    activity = activities[activity_name]
    target_email = email or current_user["email"]

    if target_email.lower() != current_user["email"].lower():
        raise HTTPException(status_code=403, detail="You can only unregister your own account")

    # Validate student is signed up
    if target_email not in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is not signed up for this activity"
        )

    # Remove student
    activity["participants"].remove(target_email)
    return {"message": f"Unregistered {target_email} from {activity_name}"}
