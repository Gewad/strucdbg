import structlog
import time
import random

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


def nested_traceback(levels=5):
    if levels <= 0:
        raise ValueError("Innermost exception")
    else:
        try:
            nested_traceback(levels - 1)
        except ValueError as e:
            raise RuntimeError("Outer exception") from e


if __name__ == "__main__":
    log_all()

    logger = logger.bind(operation_id="abcde")
    log_all()

    logger = logger.unbind("operation_id")

    try:
        nested_traceback()
    except RuntimeError:
        logger.exception("Nested exception occurred!", ev="nested_exception")


    # generate a random 5 letter string
    random_str = ''.join(random.choices(["a", "b", "c", "d", "e"], k=5))
    while True:
        logger.info("Running main loop...", ev="main_loop", random_str=random_str)
        time.sleep(5)
