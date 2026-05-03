import asyncio
import logging

logger = logging.getLogger(__name__)

async def auto_sync_loop(db, interval_minutes: int = 10):
    """Каждые interval_minutes минут импортирует данные из Google Sheets."""
    while True:
        await asyncio.sleep(interval_minutes * 60)
        try:
            from sheets_import import run_import
            result = await run_import(db)
            logger.info(f"[AutoSync] {result}")
        except Exception as e:
            logger.error(f"[AutoSync] failed: {e}")
