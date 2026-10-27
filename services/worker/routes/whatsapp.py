from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List
import logging

router = APIRouter(prefix="/whatsapp", tags=["WhatsApp Services"])
logger = logging.getLogger("worker")

class BookingReceiptRequest(BaseModel):
    phone: str
    devotee_name: str
    seva_name: str
    booking_date: str
    receipt_no: str
    amount: float
    notification_type: Optional[str] = "seva_booking_receipt"

class BulkBroadcastRequest(BaseModel):
    campaign_name: str
    phones: List[str]
    template_name: str
    parameters: dict

def send_whatsapp_message_task(phone: str, message: str):
    """
    Core function to trigger WhatsApp Cloud API or Meta Graph API.
    Runs as a background task to prevent blocking the worker event loop.
    """
    try:
        # TODO: Connect with your WhatsApp Business API / Meta Graph Token
        # Example: requests.post("https://graph.facebook.com/v19.0/{phone_number_id}/messages", ...)
        logger.info(f"[WhatsApp Dispatch] Sending receipt to +91{phone}: {message}")
    except Exception as e:
        logger.error(f"[WhatsApp Dispatch Error] Failed to send to {phone}: {str(e)}")

@router.post("/send-booking-receipt")
async def send_booking_receipt(payload: BookingReceiptRequest, background_tasks: BackgroundTasks):
    """
    Endpoint called directly by Node.js API upon verified Seva payment.
    """
    message_text = (
        f"Namaskaram {payload.devotee_name},\n\n"
        f"Your booking for '{payload.seva_name}' on {payload.booking_date} is confirmed.\n"
        f"Receipt Number: {payload.receipt_no}\n"
        f"Offering Amount: INR {payload.amount:,.2f}\n\n"
        f"Ashram pandits will recite the sankalpam on your scheduled ritual day.\n"
        f"- Sri Swami Chidbhavananda Ashramam, Vedaneri"
    )

    # Queue execution in background thread
    background_tasks.add_task(send_whatsapp_message_task, payload.phone, message_text)

    return {
        "status": "queued",
        "phone": payload.phone,
        "receipt_no": payload.receipt_no,
        "message": "Booking receipt queued for WhatsApp transmission"
    }

@router.post("/bulk-broadcast")
async def bulk_broadcast(payload: BulkBroadcastRequest, background_tasks: BackgroundTasks):
    """
    Reserved endpoint for upcoming bulk campaigns and festival announcements.
    """
    logger.info(f"[Bulk Campaign] '{payload.campaign_name}' initiated for {len(payload.phones)} devotees.")
    # Queue batch execution logic here
    return {
        "status": "broadcast_scheduled",
        "recipients_count": len(payload.phones),
        "campaign": payload.campaign_name
    }