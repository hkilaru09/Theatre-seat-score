import os


def pytest_addoption(parser):
    parser.addoption("--engine", choices=["node", "cpp"], default=None, help="SeatScore engine to score seats with (default: node)")


def pytest_configure(config):
    name = config.getoption("--engine")
    if name:
        os.environ["SEATSCORE_ENGINE"] = name
