FROM python:3.10-slim
WORKDIR /app

COPY requirements.txt .
# This is the line we were missing! It installs the libraries.
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]