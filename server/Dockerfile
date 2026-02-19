# Use official Python runtime as a parent image
FROM python:3.10-slim

WORKDIR /app

# We will add requirements later
COPY requirements.txt .
RUN touch requirements.txt 

COPY . .

# Command to run the FastAPI server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]