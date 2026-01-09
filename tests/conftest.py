import pytest

def pytest_addoption(parser):
    parser.addoption('--s3_endpoint', action='store')
    parser.addoption('--s3_name', action='store')
    parser.addoption('--s3_secret', action='store')
    parser.addoption('--s3_test_bucket', action='store', default='sparcd-ffffffff-ffff-ffff-ffff-ffffffffffff')
    parser.addoption('--s3_test_upload', action='store', default='2026.01.06.13.09.23_schnaufer')
