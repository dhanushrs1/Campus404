# Judge0 API Contract (For Backend Developer)

## Overview

Due to Windows Docker kernel limitations, Judge0 is not running locally. You must build the Python FastAPI backend assuming Judge0 will respond exactly as documented below.

When we deploy to the Linux production server, Judge0 will be available at `http://judge0-server:2358`.

## 1. Submit Code for Execution

The Python Backend will make an HTTP POST request to Judge0 to run the student's code.

**Endpoint:** `POST http://judge0-server:2358/submissions?base64_encoded=false&wait=true`

**Request Body (JSON):**
{
"source_code": "print('Hello World')",
"language_id": 71, // 71 is always Python 3
"expected_output": "Hello World\n" // Optional: Judge0 will compare output to this
}

## 2. The Expected Response

Judge0 will wait for the code to run, and then return this exact JSON structure. Your FastAPI backend must parse this response.

**Response Body (JSON):**
{
"stdout": "Hello World\n",
"time": "0.015",
"memory": 3164,
"stderr": null,
"compile_output": null,
"status": {
"id": 3,
"description": "Accepted"
}
}

## 3. Important Status IDs to handle in Backend Logic:

Your Python code must check `response['status']['id']`:

- `id: 3` = **Accepted** (The code ran perfectly. Give the student XP).
- `id: 4` = **Wrong Answer** (The code ran, but the output was wrong. Mark as Failed).
- `id: 5` = **Time Limit Exceeded** (Infinite loop detected. Mark as Failed).
- `id: 6` = **Compilation Error** (Syntax error. Mark as Failed).
- `id: 11` = **Runtime Error** (The code crashed. Mark as Failed).

## Local Testing Instructions

While building locally, create a "Mock" function in your Python code. Instead of actually calling `http://judge0-server:2358`, just write a function that returns the JSON above so you can finish testing your database logic.
