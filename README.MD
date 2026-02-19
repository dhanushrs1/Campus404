# 🎓 Campus404: Gamified Coding Platform

Welcome to the Campus404 developer repository! This is a containerized application using React (Frontend), FastAPI (Backend), MySQL (Database), and Judge0 (Code Execution Sandbox).

## 🚀 Architecture Overview

We use a **Single Domain Strategy** powered by Nginx. You do not need to worry about CORS errors.

- **Frontend UI:** Accessible at `http://localhost/`
- **Backend API:** Accessible at `http://localhost/api/`
- **Database:** MySQL 8.0 (Internal network only)
- **Sandbox:** Judge0 API (Internal network only)

---

## 💻 How to Install and Run Locally

You do not need to install MySQL, Python, or Node.js directly on your computer. Docker handles everything.

### Prerequisites

1. Install [Git](https://git-scm.com/).
2. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/).
3. **Windows Users Only:** You must have WSL2 (Windows Subsystem for Linux) installed and enabled in your Docker settings.
   - **How to check:** Open Command Prompt and run `wsl -l -v`. If it shows `VERSION 2`, you are good to go.
   - **How to install:** If you don't have it, watch this [3-Minute WSL2 Installation Guide](https://www.youtube.com/watch?v=4Sl4H6gersw) and simply run `wsl --install` in your terminal as Administrator.

### Step 1: Clone the Repository

Open your terminal and run:
\`\`\`bash
git clone https://github.com/dhanushrs1/Campus404.git
cd Campus404
\`\`\`

### Step 2: Start the Infrastructure

Make sure Docker Desktop is open and running in the background. Then, run:
\`\`\`bash
docker-compose up --build
\`\`\`
_Note: The first time you run this, it may take 5-10 minutes to download all the server images. Subsequent runs will take seconds._

To stop the servers, press `Ctrl + C` in your terminal.

---

## 🛠 Team Workflows

### For the UI Builder (Frontend)

- Your workspace is the `/client` folder.
- We are using React.
- **Important:** All API calls to the backend should be made to `/api/...` (e.g., `fetch('/api/login')`). Nginx will automatically route this to the Python server. Do not use `localhost:8000` in your React code.

### For the Logic Dev (Backend)

- Your workspace is the `/server` folder.
- We are using Python FastAPI.
- **Database Connection:** Your SQLAlchemy connection string is already configured by Docker:
  `mysql+pymysql://campus_dev:dev_password@db:3306/campus404`
- **Judge0 Notice:** Due to Windows Docker kernel limitations (cgroups v2), the Judge0 sandbox will crash locally on Windows. Please create a "Mock" function for code evaluation during local development. Read `/docs/judge0_contract.md` for the exact JSON structures you need to mock.

---

## 🗄️ Folder Structure

- `/client` - React frontend code and assets.
- `/server` - Python FastAPI backend code.
- `/infra` - Nginx routing configurations.
- `/sandbox` - Future Judge0 security limits.
- `/docs` - API contracts and database schemas.
