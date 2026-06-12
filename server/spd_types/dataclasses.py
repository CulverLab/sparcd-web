""" Common data classes """

from dataclasses import dataclass
from typing import Optional

@dataclass
class UploadResult:
    """ Contains the result of preparing and uploading a single file """
    working_name: str
    working_mimetype: str
    timestamp: Optional[str]
    species: Optional[tuple]
    location: Optional[dict]
    upload_id: str
    original_name: str
