"""This script contains the definition of the stored user
"""

# pylint: disable=too-many-instance-attributes
class UserInfo:
    """ Class containing user information
    """

    def __init__(self, name: str, admin: int=0):
        """ Initialize an instance
        """
        self.__name = name
        self.__admin = admin

        self.__email = None
        self.__settings = None
        self.__species = None
        self.__url = None
        self.__timestamp = None
        self.__client_ip = None
        self.__user_agent = None

    def __str__(self):
        """ Return a string represenation
        """
        return f'name: {self.__name}, admin: {self.__admin}'

    @property
    def name(self):
        """ Returns the instance's name """
        return self.__name

    @property
    def email(self):
        """ Returns the instance's email """
        return self.__email

    @property
    def settings(self):
        """ Returns the instance's settings """
        return self.__settings

    @property
    def species(self):
        """ Returns the instance's species """
        return self.__species

    @property
    def admin(self):
        """ Returns the instance's admin """
        return self.__admin

    @property
    def url(self):
        """ Returns the instance's url """
        return self.__url

    @property
    def timestamp(self):
        """ Returns the instance's timestamp """
        return self.__timestamp

    @property
    def client_ip(self):
        """ Returns the instance's client IP address """
        return self.__client_ip

    @property
    def user_agent(self):
        """ Returns the instance's client user agent value """
        return self.__user_agent

    @email.setter
    def email(self, value: str):
        """ Sets the instance's email
        Arguments:
            value: the new email string
        """
        self.__email =  value

    @settings.setter
    def settings(self, value: str):
        """ Sets the instance's settings
        Arguments:
            value: the new settings string
        """
        self.__settings = value

    @species.setter
    def species(self, value: str):
        """ Sets the instance's species
        Arguments:
            value: the new species string
        """
        self.__species = value

    @url.setter
    def url(self, value: str):
        """ Sets the instance's url
        Arguments:
            value: the new url string
        """
        self.__url = value

    @timestamp.setter
    def timestamp(self, value: str):
        """ Sets the instance's timestamp
        Arguments:
            value: the new timestamp string
        """
        self.__timestamp = value

    @client_ip.setter
    def client_ip(self, value: str):
        """ Sets the instance's client IP address
        Arguments:
            value: the new client IP string
        """
        self.__client_ip = value

    @user_agent.setter
    def user_agent(self, value: str):
        """ Sets the instance's client user agent value
        Arguments:
            value: the new user agent string
        """
        self.__user_agent = value
