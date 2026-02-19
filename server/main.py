from fastapi import FastAPI
from sqlalchemy import Column, Integer, String, Text, ForeignKey, create_engine, Boolean
from sqlalchemy.orm import declarative_base, relationship
from sqladmin import Admin, ModelView

# ==========================================
# 1. DATABASE CONNECTION
# ==========================================
DATABASE_URL = "mysql+pymysql://campus_dev:dev_password@db:3306/campus404"
engine = create_engine(DATABASE_URL)
Base = declarative_base()

# ==========================================
# 2. DEFINE THE TABLES (The Memory)
# ==========================================
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String(50), unique=True)
    total_xp = Column(Integer, default=0)
    
    # Links to the progress table
    progress = relationship("UserProgress", back_populates="user")

class Lab(Base):
    __tablename__ = "labs"
    id = Column(Integer, primary_key=True)
    name = Column(String(100)) # e.g., "Python Lab", "Java Lab"
    description = Column(Text)
    
    # Links to the levels inside this lab
    levels = relationship("Level", back_populates="lab")

class Level(Base):
    __tablename__ = "levels"
    id = Column(Integer, primary_key=True)
    lab_id = Column(Integer, ForeignKey("labs.id"))
    order_number = Column(Integer) # Critical: 1, 2, 3... tells the system what unlocks next
    title = Column(String(100))
    broken_code = Column(Text)
    expected_output = Column(String(200))
    
    lab = relationship("Lab", back_populates="levels")
    user_progress = relationship("UserProgress", back_populates="level")

class UserProgress(Base):
    """The Bridge: Tracks exactly what a specific user has beaten"""
    __tablename__ = "user_progress"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    level_id = Column(Integer, ForeignKey("levels.id"))
    is_completed = Column(Boolean, default=False)
    failed_attempts = Column(Integer, default=0)

    user = relationship("User", back_populates="progress")
    level = relationship("Level", back_populates="user_progress")

# Automatically generate these tables in MySQL
Base.metadata.create_all(engine)

# ==========================================
# 3. INITIALIZE FASTAPI
# ==========================================
app = FastAPI(title="Campus404 API")

# ==========================================
# ==========================================
# 4. SETUP THE SQLADMIN PANEL
# ==========================================
from fastapi.staticfiles import StaticFiles

# Mount the static directory so we can serve the custom CSS
app.mount("/static", StaticFiles(directory="static"), name="static")

# Initialize Admin with templates_dir="templates" to prefer our overridden layout.html
admin = Admin(app, engine, templates_dir="templates")

class UserAdmin(ModelView, model=User):
    column_list = [User.id, User.username, User.total_xp]

class LabAdmin(ModelView, model=Lab):
    column_list = [Lab.id, Lab.name]
    form_columns = [Lab.name, Lab.description]

class LevelAdmin(ModelView, model=Level):
    column_list = [Level.id, Level.title, Level.lab, Level.order_number]
    form_columns = [Level.lab, Level.order_number, Level.title, Level.broken_code, Level.expected_output]

class UserProgressAdmin(ModelView, model=UserProgress):
    column_list = [UserProgress.id, UserProgress.user_id, UserProgress.level_id, UserProgress.is_completed]

# Attach the UI dashboards to the Admin Panel
admin.add_view(UserAdmin)
admin.add_view(LabAdmin)
admin.add_view(LevelAdmin)
admin.add_view(UserProgressAdmin)

# A simple test route to ensure the API is awake
@app.get("/")
def read_root():
    return {"message": "Campus404 Backend is Running!"}