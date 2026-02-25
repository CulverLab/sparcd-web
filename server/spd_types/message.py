"""This script contains definition of a stored message
"""

from enum import Enum

class Priority(int, Enum):
    """ Message priority definition """
    NORMAL = 0
    IMPORTANT = 10
    URGENT = 20

# pylint: disable=too-many-instance-attributes
class Message(dict):
    """ Class containing message information
    """
    def __init__(self, mess_id: str):
        """ Initialization
        Arguments:
            id: the message ID
        """
        dict.__init__(self, id=mess_id, sender=None, receiver=None, subject=None,
                        message=None, priority=Priority.NORMAL, created_sec=None,
                        read_sec=None)

    @property
    def id(self):
        """ Returns the message's id """
        return self["id"]

    @property
    def sender(self):
        """ Returns the message's sender """
        return self["sender"]

    @property
    def receiver(self):
        """ Returns the message's receiver """
        return self["receiver"]

    @property
    def subject(self):
        """ Returns the message's subject """
        return self["subject"]

    @property
    def message(self):
        """ Returns the message's message text """
        return self["message"]

    @property
    def priority(self):
        """ Returns the message's priority """
        return self["priority"]

    @property
    def created(self):
        """ Returns the message's creation elapsed seconds """
        return self["created_sec"]

    @property
    def read(self):
        """ Returns the message's seconds from when it was read """
        return self["read_sec"]

    @id.setter
    def id(self, value: str) -> None:
        """ Sets the ID of this message
        Arguments:
            value: the unique ID of this message
        """
        self['id'] = value

    @sender.setter
    def sender(self, value: str):
        """ Sets the instance's sender
        Arguments:
            value: the new sender string
        """
        self['sender'] = value

    @receiver.setter
    def receiver(self, value: str):
        """ Sets the instance's receiver
        Arguments:
            value: the new receiver string
        """
        self['receiver'] = value

    @subject.setter
    def subject(self, value: str):
        """ Sets the instance's subject
        Arguments:
            value: the new subject string
        """
        self["subject"] = value

    @message.setter
    def message(self, value: str):
        """ Sets the instance's message
        Arguments:
            value: the new message string
        """
        self["message"] = value

    @priority.setter
    def priority(self, value: int):
        """ Sets the instance's priority
        Arguments:
            value: the new priority string
        Notes:
            If the value isn't in Priority class, it's not assigned
        """
        if value in Priority:
            self["priority"] = value
        else:
            raise ValueError(f'Invalid message priority specified {value}')

    @priority.setter
    def created(self, value: str) -> None:
        """ Sets the elapsed seconds from when this message was created
        Arguments:
            value: the elapsed seconds
        """
        self["created_sec"] = value

    @priority.setter
    def read(self, value: str) -> None:
        """ Sets the elapsed seconds from when this message was read
        Arguments:
            value: the elapsed seconds
        """
        self["read_sec"] = value
