import logging
from typing import Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(levelname)s] %(asctime)s - %(name)s - %(message)s'
)

logger = logging.getLogger(__name__)


def set_debug_mode(debug: bool) -> None:
    """Set debug mode for logging."""
    if debug:
        logging.getLogger().setLevel(logging.DEBUG)
        logger.debug("Debug mode enabled")
    else:
        logging.getLogger().setLevel(logging.INFO)


def log_debug(message: str, data: Optional[dict] = None) -> None:
    """Log debug message."""
    if data:
        logger.debug(f"{message} | {data}")
    else:
        logger.debug(message)


def log_info(message: str, data: Optional[dict] = None) -> None:
    """Log info message."""
    if data:
        logger.info(f"{message} | {data}")
    else:
        logger.info(message)


def log_warning(message: str, data: Optional[dict] = None) -> None:
    """Log warning message."""
    if data:
        logger.warning(f"{message} | {data}")
    else:
        logger.warning(message)


def log_error(message: str, error: Optional[Exception] = None) -> None:
    """Log error message."""
    if error:
        logger.error(f"{message} | {str(error)}")
    else:
        logger.error(message)
