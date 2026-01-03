import uuid
import structlog
import time
import random

processors = [
    structlog.processors.dict_tracebacks,
    structlog.processors.add_log_level,
    structlog.processors.JSONRenderer(),
]
structlog.configure(processors)

logger = structlog.get_logger()


def log_all():
    logger.debug("Debugging Structlog!", ev="app_start")
    logger.info("Hello, Structlog!", ev="app_start")
    logger.warning("Warning from Structlog!", ev="app_start")
    logger.error("Error in Structlog!", ev="app_start")
    logger.critical("Critical in Structlog!", ev="app_start")

    # Generate really long logs
    long_message = "This is a very long log message. " * 20
    logger.info(long_message, ev="long_log")

    logger.info("abcdef"*50, ev="long_log_one_liner")

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

    logger = logger.bind(operation_id=str(uuid.uuid4()))
    logger.info("Starting long operation message start message", ev="long_operation_start_and_end")
    logger.info("Ending long operation message end message, but it gets longer so it doesn't fit on the page. probably need to double it"*2, ev="long_operation_start_and_end")
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
