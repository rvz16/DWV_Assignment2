import csv
import time
import requests
import json

CSV_FILE = 'ip_addresses.csv'
SERVER_URL = 'http://backend:5000/receive-package'  # Make sure this matches your Flask endpoint

def load_packages(filename):
    with open(filename, newline='') as csvfile:
        reader = csv.DictReader(csvfile)
        packages = []
        for row in reader:
            packages.append({
                "ip_address": row["ip address"],
                "latitude": float(row["Latitude"]),
                "longitude": float(row["Longitude"]),
                "timestamp": int(row["Timestamp"]),
                "suspicious": bool(float(row["suspicious"]))
            })
    return sorted(packages, key=lambda x: x["timestamp"])

def send_packages(packages):
    if not packages:
        return

    base_time = packages[0]["timestamp"]
    real_start = time.time()

    for i, package in enumerate(packages):
        current_time = time.time()
        target_time = real_start + (package["timestamp"] - base_time)
        sleep_duration = target_time - current_time

        if sleep_duration > 0:
            time.sleep(sleep_duration)

        try:
            response = requests.post(SERVER_URL, json=package)
            print(f"[{package['timestamp']}] Sent: {package['ip_address']} - Status: {response.status_code}")
        except requests.exceptions.RequestException as e:
            print(f"Failed to send package: {e}")

if __name__ == "__main__":
    packages = load_packages(CSV_FILE)
    send_packages(packages)
