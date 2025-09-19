from fastapi import FastAPI, WebSocket
import os, asyncio
BASE = os.path.dirname(__file__)
DATA_DIR = os.path.join(BASE, "data")
COUNT_FILE = os.path.join(DATA_DIR, "traffic.count")
app = FastAPI()
def read_count():
    try:
        with open(COUNT_FILE, "r") as f:
            s = f.read().strip()
            return int(s) if s else 0
    except FileNotFoundError:
        return 0
@app.websocket("/traffic")
async def traffic_ws(ws: WebSocket):
    await ws.accept()
    last = None
    while True:
        n = read_count()
        if n != last:
            await ws.send_text(f"{n:05d}")
            last = n
        await asyncio.sleep(1.0)
