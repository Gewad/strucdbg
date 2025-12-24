import structlog

processors = [
    structlog.processors.dict_tracebacks,
    structlog.processors.add_log_level,
    structlog.processors.JSONRenderer(),
    # structlog.dev.ConsoleRenderer(),
]
structlog.configure(processors)

logger = structlog.get_logger()


def log_all():
    logger.debug("Debugging Structlog!", ev="app_start")
    logger.info("Hello, Structlog!", ev="app_start")
    logger.warning("Warning from Structlog!", ev="app_start")
    logger.error("Error in Structlog!", ev="app_start")
    logger.critical("Critical in Structlog!", ev="app_start")

    try:
        1 / 0
    except ZeroDivisionError:
        logger.exception("Caught an exception!", ev="exception_occurred")


if __name__ == "__main__":
    log_all()

    logger = logger.bind(operation_id="abcde")
    log_all()

    pass
