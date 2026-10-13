from contextlib import asynccontextmanager

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI

from .jobs.media import process_media_jobs
from .jobs.whatsapp import send_daily_wishes

scheduler = BackgroundScheduler(timezone="Asia/Kolkata")


@asynccontextmanager
async def lifespan(_: FastAPI):
    scheduler.add_job(send_daily_wishes, "cron", hour=7, minute=0, id="whatsapp-daily")
    scheduler.add_job(process_media_jobs, "interval", minutes=1, id="media-queue")
    scheduler.start()
    yield
    scheduler.shutdown()


app = FastAPI(title="VedaNeri worker", lifespan=lifespan)


@app.get("/health")
def health():
    return {"ok": True, "jobs": [j.id for j in scheduler.get_jobs()]}
